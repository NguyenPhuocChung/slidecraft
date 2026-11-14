import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CheckCircle2, Copy, Download, FileJson, Maximize2, XCircle } from 'lucide-react';
import { PageShell } from '@/components/AppHeader';
import { Badge, Button, Modal, cx, inputCls, toast } from '@/components/ui';
import { ANIMATION_EFFECTS, ANIMATION_TRIGGERS, CHART_TYPES, DIAGRAM_KINDS, ELEMENT_TYPES, INFOGRAPHIC_KINDS, PROMPT_VERSION, REGISTRY_UPDATED, SCHEMA_VERSION, TRANSITIONS } from '@/types/registry';
import { LAYOUTS } from '@/layouts/engine';
import { THEMES } from '@/themes/themes';
import { ICON_NAMES } from '@/media/icons';
import { tr, useT } from '@/i18n';
import { copyText, download } from '@/pages/components/helpers';
import { EXAMPLE_INPUT } from './example';
import { buildPrompt, checkPromptCompatibility, exampleOutputCode, schemaAppendix, SPECIALTIES, SPECIALTY_IDS, type PromptKind, type SpecialtyId } from './generator';

const LANGS = ['auto', 'English', 'Vietnamese', 'Chinese', 'Japanese', 'Korean', 'French', 'German', 'Spanish', 'Portuguese', 'Thai', 'Indonesian'];
const AIS = ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Grok'];

export default function PromptCenterPage() {
  const t = useT();
  const [kind, setKind] = useState<PromptKind>('master');
  const [specialty, setSpecialty] = useState<SpecialtyId>('pitchDeck');
  const [language, setLanguage] = useState('auto');
  const [full, setFull] = useState(false);
  const prompt = useMemo(() => buildPrompt({ kind, specialty, language }), [kind, specialty, language]);
  const compat = useMemo(() => checkPromptCompatibility(), []);
  const name = kind === 'master' ? 'master' : kind === 'quick' ? 'quick' : `specialized-${specialty}`;
  const fileBase = `slidecraft-${name}-prompt-v${PROMPT_VERSION}`;
  const copy = async (text: string, what: string) => { if (await copyText(text)) toast.success(tr('{what} copied ({n} characters)', { what: tr(what), n: text.length.toLocaleString() })); else toast.error(tr('Copy failed — use Download instead')); };
  const example = useMemo(() => exampleOutputCode(), []);
  const features = [
    t('{n} element types', { n: Object.keys(ELEMENT_TYPES).length }), t('{n} smart layouts', { n: LAYOUTS.length }), t('{n} chart types', { n: Object.keys(CHART_TYPES).length }),
    t('{a} diagram / SmartArt kinds, {b} infographic kinds, timelines', { a: Object.keys(DIAGRAM_KINDS).length, b: Object.keys(INFOGRAPHIC_KINDS).length }),
    t('{a} animation effects with {b} triggers and motion paths', { a: Object.keys(ANIMATION_EFFECTS).length, b: Object.keys(ANIMATION_TRIGGERS).length }),
    t('{n} transitions including Morph', { n: Object.keys(TRANSITIONS).length }), t('{a} themes, {b} icons, image search intents', { a: THEMES.length, b: ICON_NAMES.length }),
    t('Speaker notes, sections, multi-part import for long decks'),
  ];

  return (
    <PageShell>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Bot className="text-brand-600" size={22} /><h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">{t('AI Prompt Center')}</h1></div>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">{t('Prompts generated from the live SlideCraft contract — give them to {ais} with your content and paste the result into Code Import.', { ais: AIS.join(', ') })}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">Prompt v{PROMPT_VERSION}</Badge>
          <Badge tone="blue">Schema v{SCHEMA_VERSION}</Badge>
          <Badge>{t('Updated {when}', { when: REGISTRY_UPDATED })}</Badge>
        </div>
      </div>

      <div className={cx('mt-5 flex items-start gap-3 rounded-xl border p-3 text-sm', compat.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100' : 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100')} data-testid="compat-panel">
        {compat.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <XCircle size={18} className="mt-0.5 shrink-0" />}
        <div>
          <b>{t('Compatibility')}: {compat.ok ? t('✓ in sync with website schema v{v}', { v: compat.schemaVersion }) : t('problems found')}</b>
          <span className="ml-1 opacity-80">— {t('{n} registry ids checked, example output re-imported with 0 errors.', { n: compat.checked })}</span>
          {!compat.ok && <ul className="mt-1 list-disc pl-5">{compat.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Prompt type')}</h3>
            <div className="space-y-1.5">
              {([['master', 'A. Master Prompt', 'Full, highest quality'], ['quick', 'B. Quick Prompt', 'Short, for fast drafts'], ['specialized', 'C. Specialized Prompt', 'Domain-tuned structure']] as [PromptKind, string, string][]).map(([k, l, d]) => (
                <button key={k} onClick={() => setKind(k)} className={cx('w-full rounded-xl border px-3 py-2.5 text-left', kind === k ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-900')} data-testid={`prompt-kind-${k}`}>
                  <div className="text-sm font-medium text-ink-900 dark:text-white">{t(l)}</div><div className="text-xs text-ink-500">{t(d)}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Presentation type')}</span>
            <select className={inputCls} value={kind === 'specialized' ? specialty : ''} onChange={(e) => { if (!e.target.value) { setKind('master'); return; } setSpecialty(e.target.value as SpecialtyId); setKind('specialized'); }} data-testid="specialty-select">
              <option value="">{t('General (Master)')}</option>
              {SPECIALTY_IDS.map((id) => <option key={id} value={id}>{t(SPECIALTIES[id].label)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Slide language')}</span>
            <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)} data-testid="language-select">
              {LANGS.map((l) => <option key={l} value={l}>{l === 'auto' ? t('Same as my content') : t(l)}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-ink-400">{t('Prompts are in English (best AI compliance); slide text follows this setting.')}</span>
          </label>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Supported features')}</h3>
            <ul className="space-y-1 text-[12px] text-ink-600 dark:text-ink-300">{features.map((f) => <li key={f} className="flex gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />{f}</li>)}</ul>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-900">
              <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{kind === 'master' ? 'Master Prompt' : kind === 'quick' ? 'Quick Prompt' : `${t('Specialized')} — ${t(SPECIALTIES[specialty].label)}`}</span>
              <span className="text-xs text-ink-400">{t('{n} chars · ~{k} tokens', { n: prompt.length.toLocaleString(), k: Math.round(prompt.length / 4).toLocaleString() })}</span>
              <div className="ml-auto flex flex-wrap gap-1.5">
                <Button size="sm" variant="primary" icon={<Copy size={13} />} onClick={() => void copy(prompt, 'Prompt')} data-testid="copy-prompt">{t('Copy prompt')}</Button>
                <Button size="sm" icon={<Copy size={13} />} onClick={() => void copy(`${prompt}\n\n---\n\n${schemaAppendix()}`, 'Prompt + schema')} data-testid="copy-all">{t('Copy all')}</Button>
                <Button size="sm" icon={<Download size={13} />} onClick={() => download(prompt, `${fileBase}.md`, 'text/markdown;charset=utf-8')} data-testid="download-md">.MD</Button>
                <Button size="sm" icon={<Download size={13} />} onClick={() => download(prompt, `${fileBase}.txt`)} data-testid="download-txt">.TXT</Button>
                <Button size="sm" icon={<FileJson size={13} />} onClick={() => download(schemaAppendix().replace(/^[\s\S]*?```json\n/, '').replace(/\n```$/, ''), `slidecraft-schema-v${SCHEMA_VERSION}.json`, 'application/json')} data-testid="download-schema">JSON Schema</Button>
                <Button size="sm" variant="ghost" icon={<Maximize2 size={13} />} onClick={() => setFull(true)} data-testid="view-full">{t('View full')}</Button>
              </div>
            </div>
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-relaxed text-ink-700 dark:text-ink-200" data-testid="prompt-viewer">{prompt}</pre>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-ink-100 p-5 dark:border-ink-800">
              <h3 className="mb-3 font-semibold text-ink-900 dark:text-white">{t('How to use')}</h3>
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-600 dark:text-ink-300">
                <li>{t('Pick the prompt type (and presentation type / language).')}</li>
                <li>{t('Click Copy prompt.')}</li>
                <li>{t('Open {ais} and paste the prompt.', { ais: AIS.join(', ') })}</li>
                <li>{t('Add your content (text, notes, data, outline) below it and send.')}</li>
                <li>{t('Copy the ```json code block the AI returns (all parts if it split them).')}</li>
                <li>{t('Open')} <Link to="/import" className="text-brand-600 underline">{t('Code Import')}</Link>{t(', paste, check the report, then Build presentation.')}</li>
                <li>{t('Edit, animate, present and export to PowerPoint.')}</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-ink-100 p-5 dark:border-ink-800">
              <h3 className="mb-3 font-semibold text-ink-900 dark:text-white">{t('Example input content')}</h3>
              <pre className="whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-[12px] text-ink-700 dark:bg-ink-900 dark:text-ink-200">{EXAMPLE_INPUT}</pre>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-900">
              <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{t('Example output code')}</span>
              <Badge tone="green">{t('imports with 0 errors')}</Badge>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" icon={<Copy size={13} />} onClick={() => void copy(example, 'Example code')}>{t('Copy')}</Button>
                <Button size="sm" onClick={() => { sessionStorage.setItem('slidecraft.importDraft', example); location.href = '/import'; }}>{t('Open in Code Import')}</Button>
              </div>
            </div>
            <pre className="max-h-[380px] overflow-auto p-4 font-mono text-[12px] text-ink-700 dark:text-ink-200">{example}</pre>
          </div>
        </section>
      </div>

      <Modal open={full} onClose={() => setFull(false)} title={t('Full prompt')} width={1100} footer={<Button variant="primary" icon={<Copy size={13} />} onClick={() => void copy(prompt, 'Prompt')}>{t('Copy prompt')}</Button>}>
        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">{prompt}</pre>
      </Modal>
    </PageShell>
  );
}
