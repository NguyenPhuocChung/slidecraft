import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { AlertCircle, AlertTriangle, BookOpen, CheckCircle2, ClipboardPaste, Eraser, Eye, FileUp, Hammer, Info, Layers, Loader2, Play, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';
import type { Presentation } from '@/types/schema';
import { analyzeCode, normalizePresentation, type Analysis, type Issue, type SourceFormat } from '@/code-parser';
import { AppHeader } from '@/components/AppHeader';
import { Badge, Button, Modal, Popover, MenuButton, Tabs, cx, inputCls, toast } from '@/components/ui';
import { useUiTheme } from '@/hooks/useUiTheme';
import { LazyThumb } from '@/editor/SlidesPanel';
import { saveNewProject } from '@/services/projects';
import { storage } from '@/services/storage';
import { api, auth } from '@/services/api';
import { loadFonts } from '@/hooks/useFonts';
import { getTheme } from '@/themes/themes';
import { EXAMPLES } from './examples';
import { tr, trMsg, useT } from '@/i18n';

const AUTOSAVE_KEY = 'slidecraft.importEditor';
const FORMATS: { value: SourceFormat | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' }, { value: 'json', label: 'JSON' }, { value: 'js', label: 'JavaScript object' },
  { value: 'tsx', label: 'React TSX' }, { value: 'html', label: 'HTML' }, { value: 'markdown', label: 'Markdown' },
];

function partsToSource(parts: string[], current: string): string {
  const all = [...parts, current].filter((s) => s.trim());
  if (all.length <= 1) return all[0] ?? '';
  return all.map((p) => (p.trim().startsWith('```') ? p : '```json\n' + p + '\n```')).join('\n\n');
}

export default function ImportPage() {
  const t = useT();
  const nav = useNavigate();
  const ui = useUiTheme((s) => s.mode);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState<string>(() => {
    const draft = sessionStorage.getItem('slidecraft.importDraft');
    if (draft) return draft; // removed in an effect (StrictMode runs initializers twice)
    try { return localStorage.getItem(AUTOSAVE_KEY) ?? ''; } catch { return ''; }
  });
  useEffect(() => { const t = setTimeout(() => sessionStorage.removeItem('slidecraft.importDraft'), 0); return () => clearTimeout(t); }, []);
  const [format, setFormat] = useState<SourceFormat | 'auto'>('auto');
  const [parts, setParts] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [validating, setValidating] = useState(false);
  const [tab, setTab] = useState<'report' | 'preview'>('report');
  const [fixPreview, setFixPreview] = useState<{ fixes: string[]; code: string } | null>(null);
  const [building, setBuilding] = useState(false);

  const run = useCallback((src: string, fmt = format) => {
    const a = analyzeCode(src, { formatHint: fmt === 'auto' ? undefined : fmt, domParser: typeof DOMParser !== 'undefined' ? new DOMParser() : undefined });
    setAnalysis(a);
    setValidating(false);
    return a;
  }, [format]);

  const source = useMemo(() => partsToSource(parts, code), [parts, code]);
  // debounced auto-validation + autosave
  useEffect(() => {
    try { localStorage.setItem(AUTOSAVE_KEY, code); } catch { /* quota */ }
    if (!source.trim()) { setAnalysis(null); return; }
    setValidating(true);
    const t = setTimeout(() => run(source), 400);
    return () => clearTimeout(t);
  }, [source, code, run]);

  const preview: Presentation | null = useMemo(() => {
    if (!analysis?.data) return null;
    try {
      const errs = analysis.report.issues.filter((i) => i.severity === 'error' && i.code === 'syntax');
      if (errs.length) return null;
      const p = normalizePresentation(analysis.data);
      const t = getTheme(p.theme, p.themeOverrides);
      loadFonts([t.fonts.heading, t.fonts.body]);
      return p;
    } catch { return null; }
  }, [analysis]);

  const report = analysis?.report;
  const part = (analysis?.data as { part?: { index: number; total: number; presentationId: string } } | undefined)?.part;
  const loadedParts = parts.length + (code.trim() ? 1 : 0);
  const totalParts = part?.total ?? 0;

  const lintExt = useMemo(() => linter((view) => {
    if (!report || parts.length) return [];
    const doc = view.state.doc;
    const out: Diagnostic[] = [];
    for (const i of report.issues) {
      if (!i.line || i.line > doc.lines || i.severity === 'info') continue;
      const line = doc.line(i.line);
      const from = Math.min(line.to, line.from + Math.max(0, (i.column ?? 1) - 1));
      out.push({ from, to: Math.max(from + 1, line.to), severity: i.severity, message: i.message });
    }
    return out;
  }, { delay: 50 }), [report, parts.length]);

  const lang = useMemo(() => {
    const f = format === 'auto' ? report?.format ?? 'json' : format;
    if (f === 'html') return html();
    if (f === 'tsx' || f === 'js') return javascript({ jsx: true, typescript: true });
    if (f === 'markdown') return [];
    return json();
  }, [format, report?.format]);

  const jump = (i: Issue) => {
    const view = cmRef.current?.view;
    if (!view || !i.line) return;
    const line = view.state.doc.line(Math.min(i.line, view.state.doc.lines));
    view.dispatch({ selection: { anchor: line.from + Math.max(0, (i.column ?? 1) - 1) }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.focus();
  };

  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (!t.trim()) return toast.info(tr('Clipboard is empty')); setCode(t); toast.success(tr('Pasted from clipboard')); }
    catch { toast.error(tr('Clipboard access was blocked — press Ctrl+V inside the editor instead.')); }
  };
  const openFile = async (f: File) => {
    if (f.size > 8e6) return toast.error(tr('File is larger than 8 MB'));
    const t = await f.text();
    const ext = f.name.split('.').pop()?.toLowerCase();
    setFormat(ext === 'json' ? 'json' : ext === 'tsx' || ext === 'jsx' ? 'tsx' : ext === 'js' || ext === 'ts' ? 'js' : ext === 'html' || ext === 'htm' ? 'html' : ext === 'md' ? 'markdown' : 'auto');
    setParts([]);
    setCode(t);
    toast.success(tr('Loaded {name}', { name: f.name }));
  };
  const autoFix = () => {
    const a = analyzeCode(source, { autoFix: true, formatHint: format === 'auto' ? undefined : format, domParser: new DOMParser() });
    if (!a.data) return toast.error(tr('Fix syntax errors first — Auto Fix only works on parseable code.'));
    if (!a.report.fixesApplied.length) return toast.info(tr('Nothing to fix automatically.'));
    setFixPreview({ fixes: a.report.fixesApplied, code: JSON.stringify(a.data, null, 2) });
  };
  const applyFix = () => {
    if (!fixPreview) return;
    setParts([]);
    setFormat('json');
    setCode(fixPreview.code);
    setFixPreview(null);
    toast.success(tr('Applied {n} safe fixes', { n: fixPreview.fixes.length }));
  };
  const appendPart = () => {
    if (!code.trim()) return;
    setParts((p) => [...p, code]);
    setCode('');
    toast.info(tr('Part {n} stored — paste the next part', { n: loadedParts }));
  };
  const build = async () => {
    const a = run(source);
    if (!a.report.ok || !a.data) return toast.error(tr('Fix the errors before building.'));
    setBuilding(true);
    try {
      const p = normalizePresentation(a.data);
      const saved = await saveNewProject(p, 'Imported from code');
      const s = a.report.stats;
      await storage.addHistory({ kind: 'import', format: a.format, detail: `${s.slides} slides, ${s.elements} objects, ${a.report.warningCount} warnings`, projectId: saved.id, ok: true });
      if (auth.token) api.post('/imports', { format: a.format, slides: s.slides, errors: a.report.errorCount, warnings: a.report.warningCount }).catch(() => undefined);
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
      toast.success(tr('Built “{title}” — {n} slides', { title: saved.title, n: s.slides }));
      nav(`/editor/${saved.id}`);
    } catch (e) {
      await storage.addHistory({ kind: 'import', format: a.format, detail: (e as Error).message, ok: false });
      toast.error(tr('Build failed: {msg}', { msg: (e as Error).message }));
    } finally { setBuilding(false); }
  };

  const errors = report?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = report?.issues.filter((i) => i.severity === 'warning') ?? [];
  const infos = report?.issues.filter((i) => i.severity === 'info') ?? [];
  const partIncomplete = totalParts > 1 && loadedParts < totalParts;

  return (
    <div className="flex h-full flex-col bg-white dark:bg-ink-950">
      <AppHeader />
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-2 dark:border-ink-800">
        <h1 className="mr-2 text-[15px] font-semibold text-ink-900 dark:text-white">{t('Code Import Studio')}</h1>
        <Button size="sm" icon={<ClipboardPaste size={14} />} onClick={() => void paste()} data-testid="paste-code">{t('Paste')}</Button>
        <Button size="sm" icon={<FileUp size={14} />} onClick={() => fileRef.current?.click()}>{t('Import file')}</Button>
        <input ref={fileRef} hidden type="file" accept=".json,.js,.ts,.tsx,.jsx,.html,.htm,.md,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openFile(f); e.target.value = ''; }} data-testid="import-file" />
        <select className={cx(inputCls, 'h-7 !w-40 text-xs')} value={format} onChange={(e) => { setFormat(e.target.value as SourceFormat | 'auto'); }} data-testid="format-select">
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{t(f.label)}</option>)}
        </select>
        <Button size="sm" icon={<ShieldCheck size={14} />} onClick={() => { run(source); setTab('report'); toast.info(tr('Validated')); }} data-testid="validate">{t('Validate')}</Button>
        <Button size="sm" icon={<Wand2 size={14} />} disabled={!report?.fixableCount && !report?.ok} onClick={autoFix} data-testid="auto-fix">{t('Auto Fix')}{report?.fixableCount ? ` (${report.fixableCount})` : ''}</Button>
        <Button size="sm" icon={<Eye size={14} />} disabled={!preview} onClick={() => setTab('preview')} data-testid="preview">{t('Preview')}</Button>
        <Button size="sm" icon={<Eraser size={14} />} onClick={() => { setCode(''); setParts([]); setAnalysis(null); }}>{t('Clear')}</Button>
        <Popover width={320} trigger={(_o, toggleMenu) => <Button size="sm" icon={<Sparkles size={14} />} onClick={toggleMenu} data-testid="examples">{t('Example code')}</Button>}>
          {(close) => EXAMPLES.map((ex) => <MenuButton key={ex.id} onClick={() => { setParts([]); setFormat(ex.format as SourceFormat); setCode(ex.code()); close(); }} testId={`example-${ex.id}`}>{t(ex.label, ex.vars)}</MenuButton>)}
        </Popover>
        <Link to="/docs/contract" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-ink-500 hover:text-ink-900 dark:hover:text-white"><BookOpen size={14} />{t('Contract docs')}</Link>
        <Link to="/prompts" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-ink-500 hover:text-ink-900 dark:hover:text-white">{t('Get AI prompt')}</Link>
        <div className="ml-auto flex items-center gap-2">
          {validating && <Loader2 size={14} className="animate-spin text-ink-400" />}
          <Button variant="primary" icon={building ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />} disabled={!report?.ok || building || partIncomplete} onClick={() => void build()} data-testid="build-presentation" title={partIncomplete ? t('Paste all parts first') : undefined}>{t('Build presentation')}</Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <div className="flex min-h-[320px] flex-col border-r border-ink-100 dark:border-ink-800">
          {(parts.length > 0 || totalParts > 1) && (
            <div className="flex items-center gap-3 border-b border-ink-100 bg-brand-50 px-4 py-2 text-xs text-brand-800 dark:border-ink-800 dark:bg-brand-500/10 dark:text-brand-200" data-testid="parts-banner">
              <Layers size={14} />
              <span>{totalParts > 1 ? (partIncomplete ? t('Part {a}/{b} loaded — paste the next part', { a: Math.min(loadedParts, totalParts), b: totalParts }) : t('Part {a}/{b} loaded — all parts loaded', { a: Math.min(loadedParts, totalParts), b: totalParts })) : t('{n} stored part(s) + editor', { n: parts.length })}</span>
              {partIncomplete && <Button size="sm" variant="primary" onClick={appendPart} data-testid="append-part">{t('Store & paste next part')}</Button>}
              {parts.length > 0 && <button className="ml-auto underline" onClick={() => setParts([])}>{t('Discard stored parts')}</button>}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden" data-testid="code-editor">
            <CodeMirror
              ref={cmRef}
              value={code}
              height="100%"
              theme={ui === 'dark' ? 'dark' : 'light'}
              extensions={[lang, lintGutter(), lintExt, EditorView.lineWrapping].flat()}
              onChange={(v) => setCode(v)}
              placeholder={t('Paste the code generated by ChatGPT, Claude, Gemini, DeepSeek or Grok here…') + '\n\n' + t('Tip: get the SlideCraft Master Prompt in the Prompt Center.')}
              basicSetup={{ foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
              style={{ height: '100%' }}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="border-b border-ink-100 px-4 py-2 dark:border-ink-800">
            <Tabs value={tab} onChange={setTab} tabs={[{ id: 'report', label: t('Report') }, { id: 'preview', label: `${t('Preview')}${preview ? ` (${preview.slides.length})` : ''}` }]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="import-report">
            {!report ? (
              <EmptyState />
            ) : tab === 'report' ? (
              <div className="space-y-4">
                <div className={cx('flex items-center gap-3 rounded-xl border p-3', report.ok ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10')} data-testid="import-status">
                  {report.ok ? <CheckCircle2 className="text-emerald-600" size={20} /> : <AlertCircle className="text-red-600" size={20} />}
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-ink-900 dark:text-white">{report.ok ? t('Ready to build') : t('{n} errors to fix', { n: report.errorCount })}</div>
                    <div className="text-xs text-ink-500">{t('Format')}: <b className="uppercase">{report.format}</b> · {t('{n} warnings', { n: report.warningCount })} · {t('{n} notes', { n: infos.length })}{report.fixableCount ? ` · ${t('{n} fixable', { n: report.fixableCount })}` : ''}</div>
                  </div>
                  {report.fixableCount > 0 && <Badge tone="brand">{t('{n} fixable', { n: report.fixableCount })}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {([['Slides', report.stats.slides], ['Objects', report.stats.elements], ['Images', report.stats.images], ['Charts', report.stats.charts], ['Tables', report.stats.tables], ['Diagrams', report.stats.diagrams], ['Animations', report.stats.animations], ['Transitions', report.stats.transitions], ['Morph', report.stats.morphs], ['Notes', report.stats.notes]] as [string, number][]).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-ink-100 p-2.5 dark:border-ink-800" data-testid={`stat-${k.toLowerCase()}`}>
                      <div className="text-lg font-semibold tabular-nums text-ink-900 dark:text-white">{v}</div>
                      <div className="text-[11px] text-ink-500">{t(k)}</div>
                    </div>
                  ))}
                </div>
                {report.fixesApplied.length > 0 && <IssueGroup title={t('Fixes applied')} tone="green" items={report.fixesApplied.map((m) => ({ severity: 'info', code: 'fix', message: m }))} onJump={jump} />}
                <IssueGroup title={t('Errors')} tone="red" items={errors} onJump={jump} />
                <IssueGroup title={t('Warnings')} tone="amber" items={warnings} onJump={jump} />
                {report.unsupported.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Unsupported components / properties')}</h3>
                    <div className="flex flex-wrap gap-1">{report.unsupported.map((u) => <Badge key={u} tone="amber">{u}</Badge>)}</div>
                  </div>
                )}
                <IssueGroup title={t('Notes')} tone="blue" items={infos} onJump={jump} collapsed />
              </div>
            ) : preview ? (
              <div className="grid grid-cols-2 gap-3" data-testid="import-preview">
                {preview.slides.map((s, i) => (
                  <div key={s.id}>
                    <div className="overflow-hidden rounded-lg ring-1 ring-ink-200 dark:ring-ink-700"><LazyThumb slide={s} presentation={preview} width={250} index={i} /></div>
                    <div className="mt-1 truncate text-[11px] text-ink-500">{i + 1}. {s.title ?? s.id}{s.layout ? ` · ${s.layout}` : ''}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-ink-400">{t('Preview appears when the code parses.')}</p>}
          </div>
        </div>
      </div>
      <Modal open={!!fixPreview} onClose={() => setFixPreview(null)} title={t('Apply safe auto fixes?')} width={640} footer={<><Button variant="ghost" onClick={() => setFixPreview(null)}>{t('Cancel')}</Button><Button variant="primary" onClick={applyFix} data-testid="apply-fixes">{t('Apply {n} fixes', { n: fixPreview?.fixes.length ?? 0 })}</Button></>}>
        <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{t('The editor content will be replaced by normalized JSON with these changes. No text, data or images are removed.')}</p>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-[13px]">{fixPreview?.fixes.map((f, i) => <li key={i} className="flex gap-2"><Wand2 size={13} className="mt-0.5 shrink-0 text-brand-500" />{trMsg(f)}</li>)}</ul>
      </Modal>
    </div>
  );
}

function IssueGroup({ title, items, tone, onJump, collapsed }: { title: string; items: Issue[]; tone: 'red' | 'amber' | 'blue' | 'green'; onJump: (i: Issue) => void; collapsed?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(!collapsed);
  if (!items.length) return null;
  const Icon = tone === 'red' ? AlertCircle : tone === 'amber' ? AlertTriangle : tone === 'green' ? CheckCircle2 : Info;
  const color = { red: 'text-red-600', amber: 'text-amber-600', blue: 'text-sky-600', green: 'text-emerald-600' }[tone];
  return (
    <div>
      <button className="mb-1.5 flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500" onClick={() => setOpen(!open)}>{title} <Badge tone={tone === 'blue' ? 'blue' : tone}>{items.length}</Badge></button>
      {open && (
        <ul className="space-y-1">
          {items.slice(0, 300).map((i, k) => (
            <li key={k}>
              <button onClick={() => onJump(i)} className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-ink-50 dark:hover:bg-ink-900" data-testid={`issue-${i.severity}`}>
                <Icon size={14} className={cx('mt-0.5 shrink-0', color)} />
                <span className="min-w-0 flex-1">
                  <span className="text-ink-800 dark:text-ink-100">{trMsg(i.message)}</span>
                  {(i.line || i.path) && <span className="mt-0.5 block font-mono text-[11px] text-ink-400">{i.line ? `${t('line')} ${i.line}${i.column ? `:${i.column}` : ''}` : ''}{i.line && i.path ? ' · ' : ''}{i.path ?? ''}{i.fixable ? ` · ${t('auto-fixable')}` : ''}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="space-y-4 text-sm text-ink-600 dark:text-ink-300">
      <div className="rounded-2xl border border-dashed border-ink-200 p-5 dark:border-ink-700">
        <Play className="mb-2 text-brand-500" size={20} />
        <h3 className="font-semibold text-ink-900 dark:text-white">{t('Paste AI-generated code to begin')}</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px]">
          <li>{t('Copy the Master Prompt from the')} <Link to="/prompts" className="text-brand-600 underline">{t('Prompt Center')}</Link>.</li>
          <li>{t('Give it to any AI together with your content.')}</li>
          <li>{t('Paste the returned ```json block here (code fences are removed automatically).')}</li>
          <li>{t('Review the report, Auto Fix safe issues, preview, then Build presentation.')}</li>
        </ol>
      </div>
      <p className="text-xs text-ink-400">{t('Accepted: SlideCraft JSON (official), JavaScript object, React TSX with SlideCraft components, HTML <section> slides and Markdown. Code is parsed statically — it is never executed.')}</p>
    </div>
  );
}
