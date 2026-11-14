/**
 * "Edit source code": shows the open presentation as SlideCraft contract JSON so a person
 * who pasted the wrong code can fix it (or paste new code) and apply it IN PLACE —
 * same project id, one undo step (Ctrl+Z), with a version snapshot taken first.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { AlertTriangle, CheckCircle2, ClipboardPaste, Code2, RotateCcw, Wand2 } from 'lucide-react';
import { tr, trMsg, useT } from '@/i18n';
import type { Presentation } from '@/types/schema';
import { analyzeCode, normalizePresentation, type Analysis } from '@/code-parser';
import { presentationJsonSchemaSafe } from '@/pptx-export/json';
import { useEditor } from '@/stores/editor';
import { storage } from '@/services/storage';
import { Badge, Button, Modal, cx, toast } from '@/components/ui';

/** Contract JSON for the code editor. Large embedded assets are kept out (they are preserved on apply). */
export function presentationToSource(p: Presentation): string {
  const { assets: _assets, part: _part, ...rest } = p as Presentation & { part?: unknown };
  return presentationJsonSchemaSafe(rest as Presentation);
}

/** Build the replacement presentation: keeps the project id, size and (unless given) the embedded assets. */
export function sourceToPresentation(data: unknown, current: Presentation): Presentation {
  const next = normalizePresentation(data);
  const given = (data as { assets?: unknown[] })?.assets;
  return { ...next, id: current.id, assets: Array.isArray(given) && given.length ? next.assets : current.assets ?? [] };
}

const DOM = () => (typeof DOMParser !== 'undefined' ? new DOMParser() : undefined);

export function SourceCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  if (!open || !doc) return null;
  return <SourceCodeEditor doc={doc} onClose={onClose} />;
}

function SourceCodeEditor({ doc, onClose }: { doc: Presentation; onClose: () => void }) {
  const t = useT();
  const original = useMemo(() => presentationToSource(doc), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [code, setCode] = useState(original);
  const [analysis, setAnalysis] = useState<Analysis>(() => analyzeCode(original, { formatHint: 'json', domParser: DOM() }));
  const [busy, setBusy] = useState(false);
  const cm = useRef<ReactCodeMirrorRef>(null);
  useEffect(() => {
    const id = setTimeout(() => setAnalysis(analyzeCode(code, { domParser: DOM() })), 300);
    return () => clearTimeout(id);
  }, [code]);
  const r = analysis.report;
  const errors = r.issues.filter((i) => i.severity === 'error');
  const warnings = r.issues.filter((i) => i.severity === 'warning');
  const changed = code !== original;

  const lint = useMemo(() => linter((view) => {
    const out: Diagnostic[] = [];
    for (const i of analysis.report.issues) {
      if (!i.line || i.severity === 'info') continue;
      const ln = Math.min(Math.max(1, i.line), view.state.doc.lines);
      const line = view.state.doc.line(ln);
      out.push({ from: line.from, to: Math.max(line.from, line.to), severity: i.severity === 'error' ? 'error' : 'warning', message: trMsg(i.message) });
    }
    return out;
  }, { delay: 200 }), [analysis]);

  const jump = (line?: number) => {
    const view = cm.current?.view;
    if (!view || !line) return;
    const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
    view.dispatch({ selection: { anchor: l.from, head: l.to }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
    view.focus();
  };

  const autoFix = () => {
    const a = analyzeCode(code, { autoFix: true, domParser: DOM() });
    if (!a.data) return toast.error(tr('Fix syntax errors first — Auto Fix only works on parseable code.'));
    if (!a.report.fixesApplied.length) return toast.info(tr('Nothing to fix automatically.'));
    setCode(JSON.stringify(a.data, null, 2));
    toast.success(tr('Applied {n} safe fixes', { n: a.report.fixesApplied.length }));
  };

  const pasteNew = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt.trim()) return toast.info(tr('The clipboard is empty. Copy the new code first.'));
      setCode(txt);
      toast.success(tr('New code pasted — check it, then click "Apply changes".'));
    } catch {
      setCode('');
      toast.info(tr('The editor was cleared. Press Ctrl+V inside it to paste the new code.'));
      setTimeout(() => cm.current?.view?.focus(), 50);
    }
  };

  const apply = async () => {
    const a = analyzeCode(code, { domParser: DOM() });
    setAnalysis(a);
    if (!a.report.ok || !a.data) return toast.error(tr('Fix the errors before applying.'));
    setBusy(true);
    try {
      const st = useEditor.getState();
      const cur = st.doc;
      if (!cur) return;
      // Version snapshot first, so the old deck can always be restored from Version history.
      try { await storage.addVersion(cur, 'Before code edit'); } catch { /* storage may be unavailable (private mode) */ }
      const next = sourceToPresentation(a.data, cur);
      st.commit('Edit source code', () => next as never, { keepSelection: false });
      const now = useEditor.getState();
      const keep = now.doc?.slides.find((s) => s.id === now.currentSlideId) ? now.currentSlideId : now.doc?.slides[0]?.id ?? null;
      now.set({ currentSlideId: keep, selectedSlideIds: keep ? [keep] : [], selectedIds: [], editingId: null });
      toast.success(tr('Code applied: {n} slides. Press Ctrl+Z to undo.', { n: next.slides.length }));
      onClose();
    } catch (e) {
      toast.error(`${tr('Could not apply the code')}: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={1180} testId="source-dialog" title={<span className="flex items-center gap-2"><Code2 size={16} />{t('Edit source code')}</span>}
      footer={<>
        <span className="mr-auto text-[11px] text-ink-400">{t('A copy of the current version is saved to Version history before applying.')}</span>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="primary" onClick={() => void apply()} disabled={busy || !r.ok || !changed} data-testid="source-apply">{t('Apply changes')}</Button>
      </>}>
      <p className="mb-2 rounded-lg bg-brand-50 p-2 text-[12px] leading-relaxed text-brand-900 dark:bg-brand-500/10 dark:text-brand-100">
        {t('This is the code of the open presentation. Fix a mistake here, or click "Paste new code" to replace everything with code from your AI. Lines with errors are underlined in red — click an error below to jump to it.')}
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" icon={<ClipboardPaste size={13} />} onClick={() => void pasteNew()} data-testid="source-paste">{t('Paste new code')}</Button>
        <Button size="sm" icon={<Wand2 size={13} />} onClick={autoFix} disabled={!analysis.data && !code.trim()} data-testid="source-autofix">{t('Auto Fix')}{r.fixableCount ? ` (${r.fixableCount})` : ''}</Button>
        <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} disabled={!changed} onClick={() => setCode(original)}>{t('Undo my code changes')}</Button>
        <div className="flex-1" />
        {r.ok ? <Badge tone="green"><CheckCircle2 size={12} />{t('Code is valid · {n} slides', { n: r.stats.slides })}</Badge> : <Badge tone="red"><AlertTriangle size={12} />{t('{n} errors', { n: r.errorCount })}</Badge>}
        {r.warningCount > 0 && <Badge tone="amber">{t('{n} warnings', { n: r.warningCount })}</Badge>}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_320px]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-ink-200 dark:border-ink-700" data-testid="source-editor">
          <CodeMirror ref={cm} value={code} height="58vh" extensions={[json(), lintGutter(), lint, EditorView.lineWrapping]} onChange={(v) => setCode(v)} basicSetup={{ lineNumbers: true, foldGutter: true }} />
        </div>
        <div className="max-h-[58vh] space-y-1.5 overflow-y-auto" data-testid="source-issues">
          {!errors.length && !warnings.length && <p className="text-[12px] text-emerald-700 dark:text-emerald-300">{t('No problems found.')}</p>}
          {[...errors, ...warnings].slice(0, 80).map((i, k) => (
            <button key={k} type="button" onClick={() => jump(i.line)} className={cx('block w-full rounded-lg border p-2 text-left text-[11.5px] leading-snug', i.severity === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200')}>
              {i.line ? <b className="mr-1">{t('Line {n}', { n: i.line })}:</b> : null}{trMsg(i.message)}{i.fixable && <span className="ml-1 text-[10px] opacity-70">({t('Auto Fix can repair this')})</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
