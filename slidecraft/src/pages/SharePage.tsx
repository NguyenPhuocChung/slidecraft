import { useCallback, useEffect, useState } from 'react';
import { tr, useT } from '@/i18n';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Maximize, X } from 'lucide-react';
import type { Presentation } from '@/types/schema';
import { api } from '@/services/api';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { LazyThumb } from '@/editor/SlidesPanel';
import { normalizePresentation } from '@/code-parser';
import { Logo } from '@/components/AppHeader';
import { Badge, Button, IconButton, cx } from '@/components/ui';
import { presentationFonts, relativeTime, useWidth } from './components/helpers';

export default function SharePage() {
  const t = useT();
  const { shareId = '' } = useParams();
  const [doc, setDoc] = useState<Presentation | null>(null);
  const [meta, setMeta] = useState<{ title: string; updatedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const [stageRef, stageW] = useWidth<HTMLDivElement>();
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    api.get<{ title: string; updatedAt: string; data: unknown }>(`/share/${encodeURIComponent(shareId)}`)
      .then((r) => { const p = normalizePresentation(r.data); presentationFonts(p); setDoc({ ...p, slides: p.slides.filter((s) => !s.hidden) }); setMeta({ title: r.title, updatedAt: r.updatedAt }); })
      .catch((e) => setError((e as { status?: number }).status === 404 ? tr('This share link does not exist or is no longer shared.') : tr('Could not load the presentation: {msg}', { msg: (e as Error).message })));
  }, [shareId]);
  useEffect(() => { const r = () => setVp({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const n = doc?.slides.length ?? 0;
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(n - 1, i + d))), [n]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) go(-1);
      else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(n - 1);
      else if (e.key === 'Escape') { setFull(false); if (document.fullscreenElement) void document.exitFullscreen(); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [go, n]);

  if (error) return <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"><Logo /><p className="text-sm text-ink-500">{error}</p></div>;
  if (!doc) return <div className="flex h-full items-center justify-center text-sm text-ink-400">{t('Loading presentation…')}</div>;
  const slide = doc.slides[index];
  if (full) {
    const scale = Math.min(vp.w / doc.size.width, vp.h / doc.size.height);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={(e) => go(e.clientX < vp.w / 3 ? -1 : 1)} data-present>
        {slide && <SlideRenderer slide={slide} presentation={doc} scale={scale} mode="present" slideNumber={index + 1} />}
        <div className="absolute bottom-3 right-4 text-xs text-white/50">{index + 1} / {n}</div>
        <button title={t('Close')} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setFull(false); if (document.fullscreenElement) void document.exitFullscreen(); }}><X size={16} /></button>
      </div>
    );
  }
  const mainW = Math.max(200, stageW);
  return (
    <div className="flex h-full flex-col bg-ink-50 dark:bg-ink-950">
      <header className="flex items-center gap-4 border-b border-ink-100 bg-white px-5 py-3 dark:border-ink-800 dark:bg-ink-900">
        <Logo small />
        <div className="min-w-0"><div className="truncate text-sm font-medium text-ink-900 dark:text-white">{meta?.title}</div><div className="text-xs text-ink-400">{t('Updated {when}', { when: relativeTime(meta?.updatedAt) })} · {t('{n} slides', { n })}</div></div>
        <Badge tone="blue">{t('Read-only')}</Badge>
        <div className="ml-auto"><LanguageSwitch compact /></div>
        <Button variant="primary" icon={<Maximize size={14} />} onClick={() => { setFull(true); void document.documentElement.requestFullscreen?.().catch(() => undefined); }}>{t('Present')}</Button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
        <div className="space-y-2 overflow-y-auto border-r border-ink-100 p-3 dark:border-ink-800">
          {doc.slides.map((s, i) => (
            <button key={s.id} onClick={() => setIndex(i)} className={cx('block rounded-md ring-2', i === index ? 'ring-brand-500' : 'ring-transparent')}><LazyThumb slide={s} presentation={doc} width={170} index={i} /></button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col items-center justify-center gap-4 p-6">
          <div ref={stageRef} className="w-full max-w-6xl">
            {slide && <div className="overflow-hidden rounded-lg shadow-panel"><SlideRenderer slide={slide} presentation={doc} scale={mainW / doc.size.width} mode="thumb" slideNumber={index + 1} /></div>}
          </div>
          <div className="flex items-center gap-3">
            <IconButton title={t('Previous')} disabled={index === 0} onClick={() => go(-1)}><ChevronLeft size={18} /></IconButton>
            <span className="text-sm tabular-nums text-ink-500">{index + 1} / {n}</span>
            <IconButton title={t('Next')} disabled={index >= n - 1} onClick={() => go(1)}><ChevronRight size={18} /></IconButton>
          </div>
          {slide?.notes && <p className="max-w-3xl text-center text-xs text-ink-400">{slide.notes}</p>}
        </div>
      </div>
    </div>
  );
}
