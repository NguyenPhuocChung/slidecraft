import { useMemo, useState } from 'react';
import { tr } from '@/i18n';
import { Play, Shuffle, Wand2 } from 'lucide-react';
import type { Transition } from '@/types/schema';
import { EASINGS, TRANSITIONS, TRANSITION_IDS, type TransitionType } from '@/types/registry';
import { useEditor } from '@/stores/editor';
import { Badge, Button, Field, NumberInput, Section, Select, Toggle, cx, toast } from '@/components/ui';
import { morphPairs } from './engine';
import { PreviewModal } from '@/presentation/PreviewModal';
import { EASING_LABEL, SOUND_LABEL, TRANSITION_HELP, directionLabel, supportLabel } from '@/animation/labels';

const PRESETS: { id: string; name: string; t: Transition }[] = [
  { id: 'smooth', name: 'Smooth fade', t: { type: 'fade', duration: 500 } },
  { id: 'dynamic', name: 'Dynamic push', t: { type: 'push', duration: 600, direction: 'left' } },
  { id: 'elegant', name: 'Elegant morph', t: { type: 'morph', duration: 1000 } },
  { id: 'cinematic', name: 'Cinematic zoom', t: { type: 'zoom', duration: 1200, easing: 'easeInOut' } },
  { id: 'deck', name: 'Gallery', t: { type: 'gallery', duration: 900, direction: 'left' } },
  { id: 'none', name: 'No transitions', t: { type: 'none', duration: 0 } },
];

export function TransitionPanel() {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const selectedSlideIds = useEditor((s) => s.selectedSlideIds);
  const st = useEditor.getState;
  const [preview, setPreview] = useState(false);
  const idx = slide ? doc.slides.indexOf(slide) : 0;
  const t: Transition = slide?.transition ?? { type: 'none', duration: 700 };
  const info = TRANSITIONS[t.type as TransitionType];
  const pairs = useMemo(() => (slide && idx > 0 ? morphPairs(doc.slides[idx - 1], slide) : []), [doc.slides, slide, idx]);
  const counts = useMemo(() => { const m = new Map<string, number>(); doc.slides.forEach((s) => m.set(s.transition?.type ?? 'none', (m.get(s.transition?.type ?? 'none') ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [doc.slides]);
  if (!slide) return null;
  const set = (p: Partial<Transition>) => st().applyTransition({ ...t, ...p } as Transition, 'current');
  return (
    <div className="pb-10" data-testid="transition-panel">
      <Section title={tr('Transition into slide {n}', { n: idx + 1 })}>
        <div className="grid grid-cols-3 gap-1">
          {TRANSITION_IDS.map((id) => (
            <button key={id} title={tr(TRANSITION_HELP[id] ?? '')} onClick={() => set({ type: id, duration: id === 'morph' ? 1000 : t.duration || 700 })} className={cx('rounded-lg border px-1.5 py-2 text-[11px] font-medium transition', t.type === id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700')} data-testid={`transition-${id}`}>
              {tr(TRANSITIONS[id].label)}
            </button>
          ))}
        </div>
        {TRANSITION_HELP[t.type] && <p className="text-[11.5px] leading-snug text-ink-600 dark:text-ink-300" data-testid="transition-help"><b>{tr(info.label)}:</b> {tr(TRANSITION_HELP[t.type])}</p>}
        <div className="flex items-center gap-1.5"><Badge tone={info.pptx === 'supported' ? 'green' : info.pptx === 'partial' ? 'amber' : 'red'}>{tr(supportLabel(info.pptx))}</Badge>{t.type !== 'none' && info.pptx !== 'supported' && <span className="text-[11px] text-ink-400">{tr(info.pptxNote)}</span>}</div>
        {t.type !== 'none' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr('Duration (seconds)')}><NumberInput value={(t.duration ?? 700) / 1000} min={0.1} max={10} step={0.1} suffix="s" onChange={(v) => set({ duration: Math.round(v * 1000) })} testId="transition-duration" /></Field>
              <Field label={tr('Speed')}><Select value={(t.duration ?? 700) <= 500 ? 'fast' : (t.duration ?? 700) <= 1000 ? 'medium' : 'slow'} options={[{ value: 'fast', label: tr('Fast') }, { value: 'medium', label: tr('Medium') }, { value: 'slow', label: tr('Slow') }]} onChange={(v) => set({ duration: v === 'fast' ? 400 : v === 'medium' ? 800 : 1500 })} /></Field>
              {'directions' in info && <Field label={tr('Direction')}><Select value={t.direction ?? info.directions![0]} options={info.directions!.map((d) => ({ value: d, label: tr(directionLabel('transition', d)) }))} onChange={(v) => set({ direction: v })} /></Field>}
              <Field label={tr('Speed style')}><Select value={t.easing ?? 'easeInOut'} options={EASINGS.map((e) => ({ value: e, label: tr(EASING_LABEL[e] ?? e) }))} onChange={(v) => set({ easing: v })} /></Field>
              <Field label={tr('Sound')}><Select value={t.sound ?? 'none'} options={['none', 'click', 'whoosh', 'chime'].map((s) => ({ value: s, label: tr(SOUND_LABEL[s]) }))} onChange={(v) => set({ sound: v as Transition['sound'] })} /></Field>
              <Field label={tr('Wait before start (seconds)')}><NumberInput value={(t.delay ?? 0) / 1000} min={0} max={30} step={0.1} suffix="s" onChange={(v) => set({ delay: v ? Math.round(v * 1000) : undefined })} /></Field>
            </div>
            <Toggle checked={t.advanceOnClick !== false} onChange={(v) => set({ advanceOnClick: v ? undefined : false })} label={tr('Advance on click')} />
            <Field label={tr('Go to next slide automatically after (seconds)')} hint={tr('Leave empty to wait for a click.')}><NumberInput value={t.autoAdvance ? t.autoAdvance / 1000 : undefined} min={0} step={0.5} suffix="s" onChange={(v) => set({ autoAdvance: v ? v * 1000 : undefined })} /></Field>
          </>
        )}
        <Button size="sm" variant="primary" icon={<Play size={12} />} disabled={idx === 0 && t.type !== 'none'} onClick={() => setPreview(true)} data-testid="preview-transition">{tr('Preview transition')}</Button>
        {idx === 0 && <p className="text-[11px] text-ink-400">{tr('The first slide has no previous slide to transition from.')}</p>}
      </Section>
      {t.type === 'morph' && (
        <Section title={tr('Morph')}>
          {pairs.length ? <p className="text-xs text-ink-600 dark:text-ink-300">{tr('{n} matching objects with slide {s}:', { n: pairs.length, s: idx })} <span className="text-ink-400">{pairs.slice(0, 8).join(', ')}{pairs.length > 8 ? '…' : ''}</span></p> : <p className="text-xs text-amber-600">{tr('No objects match the previous slide. Duplicate the previous slide (element ids are kept) and move/resize/recolor objects to morph them.')}</p>}
          <p className="text-[11px] text-ink-400">{tr('Objects with the same id interpolate position, size, rotation, opacity and color. In PowerPoint they are named “!!id” so PowerPoint 2019/365 Morph matches them.')}</p>
          {idx > 0 && <Button size="sm" onClick={() => { const prevId = doc.slides[idx - 1].id; st().duplicateSlides([prevId]); toast.info(tr('Duplicated previous slide — edit it, then set Morph on it.')); }}>{tr('Duplicate previous slide for morph')}</Button>}
        </Section>
      )}
      <Section title={tr('Apply')}>
        <div className="grid grid-cols-1 gap-1.5">
          <Button size="sm" onClick={() => st().applyTransition(t, 'selected')} disabled={selectedSlideIds.length < 1}>{tr('Apply to selected slides ({n})', { n: selectedSlideIds.length })}</Button>
          <Button size="sm" onClick={() => { st().applyTransition(t, 'all'); toast.success(tr('Applied to all slides')); }} data-testid="transition-apply-all">{tr('Apply to all slides')}</Button>
          <Button size="sm" icon={<Shuffle size={12} />} onClick={() => st().commit('Random transitions', (d) => { const pool = TRANSITION_IDS.filter((x) => x !== 'none' && x !== 'morph'); d.slides.forEach((s, i) => { if (i === 0) return; s.transition = { type: pool[Math.floor(Math.random() * pool.length)], duration: 700 } as never; }); })}>{tr('Random transition per slide')}</Button>
        </div>
      </Section>
      <Section title={tr('Presets')}>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => <Button key={p.id} size="sm" icon={<Wand2 size={12} />} onClick={() => { st().applyTransition(p.t, 'all'); toast.success(tr('Preset “{name}” applied to all slides', { name: tr(p.name) })); }}>{tr(p.name)}</Button>)}
        </div>
      </Section>
      <Section title={tr('Consistency')}>
        <div className="flex flex-wrap gap-1">{counts.map(([k, n]) => <Badge key={k}>{tr(TRANSITIONS[k as keyof typeof TRANSITIONS]?.label ?? k)}: {n}</Badge>)}</div>
        {counts.filter(([k]) => k !== 'none').length > 2 ? (
          <>
            <p className="text-[11px] text-amber-600">{tr('{n} different transitions — decks feel calmer with 1–2.', { n: counts.filter(([k]) => k !== 'none').length })}</p>
            <Button size="sm" onClick={() => { const top = counts.find(([k]) => k !== 'none' && k !== 'morph')?.[0] ?? 'fade'; st().commit('Consistent transitions', (d) => { d.slides.forEach((s, i) => { if (i > 0 && s.transition?.type !== 'morph') s.transition = { type: top, duration: 700 } as never; }); }); }}>{tr('Make consistent (keep Morph)')}</Button>
          </>
        ) : <p className="text-[11px] text-ink-400">{tr('Transitions are consistent.')}</p>}
      </Section>
      {preview && <PreviewModal startIndex={Math.max(0, idx - 1)} onClose={() => setPreview(false)} autoNext={idx > 0} />}
    </div>
  );
}
