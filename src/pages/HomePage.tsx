import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Bot, ClipboardPaste, Code2, FileDown, Layers, Plus, Presentation as PresIcon, Sparkles, Wand2 } from 'lucide-react';
import { PageShell } from '@/components/AppHeader';
import { Button, toast } from '@/components/ui';
import { useT, tr } from '@/i18n';
import { SAMPLES } from '@/samples';
import { THEMES, THEME_FONTS } from '@/themes/themes';
import { storage, type ProjectMeta } from '@/services/storage';
import { loadFonts } from '@/hooks/useFonts';
import { NewPresentationDialog } from './components/NewPresentationDialog';
import { SampleThumb, openSampleAsProject } from './components/samples';
import { ProjectThumb, relativeTime, useWidth } from './components/helpers';

const FLOW = [
  { icon: Bot, title: 'Give your content to any AI', text: 'ChatGPT, Claude, Gemini, DeepSeek, Grok… using the SlideCraft Master Prompt.' },
  { icon: Code2, title: 'AI writes SlideCraft code', text: 'A versioned JSON contract (TSX, JS, HTML and Markdown also accepted).' },
  { icon: ClipboardPaste, title: 'Paste into Code Import', text: 'Validated, auto-fixed safely, previewed — nothing is executed.' },
  { icon: Wand2, title: 'Edit everything', text: 'Every text, image, chart and shape is an independent, editable object.' },
  { icon: Sparkles, title: 'Animate', text: 'Per-object animations, timeline, transitions and real Morph.' },
  { icon: PresIcon, title: 'Present', text: 'Fullscreen player with presenter view, notes, laser and timer.' },
  { icon: FileDown, title: 'Export PowerPoint', text: 'Native, editable PPTX with converted animations, plus PDF & images.' },
];

export default function HomePage() {
  const t = useT();
  const nav = useNavigate();
  const [recent, setRecent] = useState<ProjectMeta[]>([]);
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1');
  useEffect(() => { const on = () => { if (new URLSearchParams(window.location.search).get('new') === '1') setOpen(true); }; window.addEventListener('popstate', on); return () => window.removeEventListener('popstate', on); }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [gridRef, gw] = useWidth<HTMLDivElement>();
  useEffect(() => { void storage.list().then((l) => setRecent(l.filter((p) => p.status !== 'archived').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4))); loadFonts(THEME_FONTS); }, []);
  const cardW = gw ? Math.floor((gw - 3 * 20) / (gw > 900 ? 4 : gw > 600 ? 2 : 1)) : 0;
  const useTemplate = async (id: string) => {
    setBusy(id);
    try { const p = await openSampleAsProject(id); nav(`/editor/${p.id}`); } catch (e) { toast.error(tr((e as Error).message)); } finally { setBusy(null); }
  };
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden pb-14 pt-16 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-400/25 via-fuchsia-400/20 to-amber-300/20 blur-3xl dark:from-brand-600/20 dark:via-fuchsia-600/15 dark:to-amber-500/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white/70 px-3 py-1 text-xs font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-900/70 dark:text-ink-300"><Sparkles size={13} className="text-brand-500" />{t('Works with ChatGPT, Claude, Gemini, DeepSeek and Grok')}</span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-ink-900 sm:text-6xl dark:text-white">
            {t('Paste code from any AI.')}<br />
            <span className="bg-gradient-to-r from-brand-600 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">{t('Get an editable, animated deck.')}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-500 dark:text-ink-400">{t('SlideCraft turns AI-generated presentation code into professional slides you can edit object by object, present with real Morph — and export as native PowerPoint.')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)} data-testid="new-presentation">{t('New presentation')}</Button>
            <Button size="lg" icon={<ClipboardPaste size={16} />} onClick={() => nav('/import')} data-testid="import-ai-code">{t('Import AI code')}</Button>
            <Button size="lg" variant="ghost" icon={<Bot size={16} />} onClick={() => nav('/prompts')}>{t('Get the AI prompt')}</Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-16">
        <h2 className="mb-1 text-xl font-semibold text-ink-900 dark:text-white">{t('How it works')}</h2>
        <p className="mb-6 text-sm text-ink-500">{t('Seven steps from raw content to a PowerPoint you can keep editing.')}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f, i) => (
            <div key={f.title} className="rounded-2xl border border-ink-100 bg-white p-5 dark:border-ink-800 dark:bg-ink-900">
              <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><f.icon size={16} /></span><span className="text-xs font-semibold text-ink-400">{t('STEP {n}', { n: i + 1 })}</span></div>
              <h3 className="text-[15px] font-semibold text-ink-900 dark:text-white">{t(f.title)}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500 dark:text-ink-400">{t(f.text)}</p>
            </div>
          ))}
          <Link to="/prompts" className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-brand-600 to-fuchsia-600 p-5 text-white">
            <span className="text-xs font-semibold opacity-80">{t('START HERE')}</span>
            <span className="text-lg font-semibold">{t('Copy the Master Prompt')} <ArrowRight className="inline" size={18} /></span>
          </Link>
        </div>
      </section>

      {/* Recent */}
      {recent.length > 0 && (
        <section className="mb-16">
          <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-semibold text-ink-900 dark:text-white">{t('Recent projects')}</h2><Link to="/dashboard" className="text-sm text-brand-600 hover:underline">{t('All projects →')}</Link></div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((p) => (
              <button key={p.id} onClick={() => nav(`/editor/${p.id}`)} className="group overflow-hidden rounded-xl border border-ink-100 text-left transition hover:shadow-panel dark:border-ink-800" data-testid="recent-project">
                <ProjectThumb id={p.id} width={cardW || 280} />
                <div className="p-3"><div className="truncate text-sm font-medium text-ink-900 dark:text-white">{p.title}</div><div className="text-xs text-ink-400">{t('{n} slides', { n: p.slideCount })} · {relativeTime(p.updatedAt)}</div></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Templates */}
      <section className="mb-16" ref={gridRef}>
        <h2 className="mb-1 text-xl font-semibold text-ink-900 dark:text-white">{t('Templates')}</h2>
        <p className="mb-5 text-sm text-ink-500">{t('Complete example decks — open one, then make it yours.')}</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((s) => (
            <button key={s.id} disabled={!!busy} onClick={() => void useTemplate(s.id)} className="group overflow-hidden rounded-xl border border-ink-100 text-left transition hover:-translate-y-0.5 hover:shadow-panel disabled:opacity-60 dark:border-ink-800" data-testid={`template-card-${s.id}`}>
              <SampleThumb sample={s} width={gw ? Math.floor((gw - 40) / (gw > 900 ? 3 : gw > 600 ? 2 : 1)) : 360} />
              <div className="p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{t(s.category)}</div>
                <div className="mt-0.5 font-medium text-ink-900 dark:text-white">{s.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-ink-500">{s.description}</div>
                <div className="mt-2 text-xs text-ink-400">{t('{n} slides', { n: s.slideCount })} · {t(THEMES.find((x) => x.id === s.theme)?.name ?? '')}{busy === s.id ? ` · ${t('opening…')}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section className="mb-16">
        <h2 className="mb-1 text-xl font-semibold text-ink-900 dark:text-white">{t('{n} professional themes', { n: THEMES.length })}</h2>
        <p className="mb-5 text-sm text-ink-500">{t('Colors, typography, spacing and motion that switch for the whole deck in one click.')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THEMES.map((th) => (
            <div key={th.id} className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800" title={t(th.description ?? '')}>
              <div className="flex h-20 flex-col justify-between p-3" style={{ background: th.background?.type === 'gradient' ? `linear-gradient(135deg, ${th.background.gradient?.stops.map((x) => x.color).join(',')})` : th.colors.background, color: th.colors.text }}>
                <span style={{ fontFamily: `"${th.fonts.heading}"`, fontWeight: th.typography.headingWeight }} className="text-lg leading-none">Aa</span>
                <div className="flex gap-1">{[th.colors.primary, th.colors.accent, th.colors.secondary, th.colors.surface].map((c, i) => <span key={i} className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}</div>
              </div>
              <div className="px-3 py-2 text-xs font-medium text-ink-700 dark:text-ink-200">{t(th.name)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Learning center */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { to: '/docs/getting-started', icon: BookOpen, title: 'Learning Center', text: 'From AI content to a finished PowerPoint in 7 steps.' },
          { to: '/docs/contract', icon: Layers, title: 'Contract documentation', text: 'Schema, layouts, elements, animations and transitions.' },
          { to: '/prompts', icon: Bot, title: 'AI Prompt Center', text: 'Master, quick and 10 specialized prompts, always in sync.' },
        ].map((c) => (
          <Link key={c.to} to={c.to} className="group rounded-2xl border border-ink-100 p-6 transition hover:border-brand-300 dark:border-ink-800 dark:hover:border-brand-500/50">
            <c.icon className="mb-3 text-brand-600" size={22} />
            <div className="font-semibold text-ink-900 dark:text-white">{t(c.title)}</div>
            <p className="mt-1 text-sm text-ink-500">{t(c.text)}</p>
          </Link>
        ))}
      </section>
      <NewPresentationDialog open={open} onClose={() => setOpen(false)} />
    </PageShell>
  );
}
