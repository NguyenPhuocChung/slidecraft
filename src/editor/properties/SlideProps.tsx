import type { Background, Slide, Theme } from '@/types/schema';
import { tr } from '@/i18n';
import { useEditor } from '@/stores/editor';
import { LAYOUT_MAP } from '@/layouts/engine';
import { Field, NumberInput, Section, Toggle, cx, inputCls, Button, toast } from '@/components/ui';
import { ColorField, GradientField, Seg } from './fields';
import { MediaPicker } from '../dialogs/MediaPicker';
import { useState } from 'react';
import { Copy, Layers, RotateCcw } from 'lucide-react';
import { useImageSrc } from '@/media/resolver';

export function SlideProps({ slide, theme }: { slide: Slide; theme: Theme }) {
  const st = useEditor.getState;
  const doc = useEditor((s) => s.doc)!;
  const bg: Background = slide.background ?? theme.background ?? { type: 'color', color: '$background' };
  const setBg = (b: Background | undefined, label = 'Background') => st().commit(label, (d) => { const s = d.slides.find((x) => x.id === slide.id)!; if (b) s.background = b as never; else delete s.background; });
  const [pick, setPick] = useState(false);
  const selectedSlideIds = useEditor((s) => s.selectedSlideIds);
  const preview = useImageSrc(bg.type === 'image' ? bg.image : undefined, doc.assets, 16, 9);
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  /** Copy this slide's background to other slides (one undo step). */
  const applyTo = (ids: string[], label: string) => {
    const b = slide.background;
    st().commit(label, (d) => { d.slides.forEach((s) => { if (!ids.includes(s.id)) return; if (b) s.background = clone(b) as never; else delete s.background; }); });
    toast.success(tr('Background applied to {n} slides', { n: ids.length }));
  };
  const resetAll = () => {
    st().commit('Reset all backgrounds', (d) => { d.slides.forEach((s) => { delete s.background; }); });
    toast.success(tr('All slides now use the theme background'));
  };
  const otherSelected = selectedSlideIds.filter((id) => id !== slide.id);
  return (
    <div className="pb-10" data-testid="slide-props">
      <div className="border-b border-ink-100 px-4 py-2.5 text-[13px] font-semibold dark:border-ink-800">{tr('Slide {n}', { n: doc.slides.indexOf(slide) + 1 })}{slide.layout && <span className="ml-2 text-[11px] font-normal text-ink-400">{tr('layout')}: {tr(LAYOUT_MAP[slide.layout]?.name ?? slide.layout)}</span>}</div>
      <Section title={tr('Slide')}>
        <Field label={tr('Title (navigation)')}><input className={inputCls} defaultValue={slide.title ?? ''} key={slide.id + 't'} onBlur={(e) => st().updateSlide(slide.id, { title: e.target.value || undefined }, 'Slide title')} /></Field>
        <Field label={tr('Section')}><input className={inputCls} defaultValue={slide.section ?? ''} key={slide.id + 's'} onBlur={(e) => st().updateSlide(slide.id, { section: e.target.value || undefined }, 'Section')} /></Field>
        <div className="grid grid-cols-2 gap-1.5">
          <Toggle checked={!!slide.hidden} onChange={(v) => st().updateSlide(slide.id, { hidden: v || undefined }, 'Hide slide')} label={tr('Hidden')} />
          <Toggle checked={!!slide.starred} onChange={(v) => st().updateSlide(slide.id, { starred: v || undefined }, 'Mark slide')} label={tr('Important')} />
        </div>
        <Field label={tr('Auto-advance (Auto Play)')} hint={tr('Seconds this slide stays on screen in Auto Play / exported PPTX. Empty = manual.')}><NumberInput value={slide.duration ? slide.duration / 1000 : undefined} min={0} step={0.5} suffix="s" onChange={(v) => st().updateSlide(slide.id, { duration: v ? v * 1000 : undefined }, 'Slide duration')} /></Field>
      </Section>
      <Section title={tr('Background')}>
        <Seg value={bg.type} onChange={(t) => setBg(t === 'color' ? { type: 'color', color: bg.color ?? '$background' } : t === 'gradient' ? { type: 'gradient', gradient: bg.gradient ?? { type: 'linear', angle: 135, stops: [{ color: '$primary', offset: 0 }, { color: '$accent', offset: 1 }] } } : { type: 'image', image: bg.image ?? { query: slide.title ?? 'abstract background', alt: 'Background' }, overlay: bg.overlay ?? { color: '#000000', opacity: 0.4 } })} options={[{ value: 'color', label: tr('Color') }, { value: 'gradient', label: tr('Gradient') }, { value: 'image', label: tr('Image') }]} />
        {bg.type === 'color' && <ColorField value={bg.color ?? '$background'} theme={theme} onChange={(c) => setBg({ type: 'color', color: c ?? '$background' })} />}
        {bg.type === 'gradient' && <GradientField value={bg.gradient} theme={theme} onChange={(g) => setBg(g ? { type: 'gradient', gradient: g } : undefined)} />}
        {bg.type === 'image' && (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-ink-200 bg-ink-100 bg-cover bg-center dark:border-ink-700 dark:bg-ink-800" style={preview.src ? { backgroundImage: `url("${preview.src.replace(/"/g, '%22')}")` } : undefined} data-testid="bg-preview">
              {!preview.src && <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-ink-500">{preview.loading ? tr('Loading image…') : tr('No image yet — click "Choose image…"')}</div>}
            </div>
            <p className="truncate text-[11px] text-ink-500">{bg.image?.src ? (bg.image.src.startsWith('data:') || bg.image.src.startsWith('asset:') ? tr('Uploaded image') : bg.image.src) : `${tr('Search keyword')}: ${bg.image?.query ?? ''}`}</p>
            <Button size="sm" onClick={() => setPick(true)} data-testid="bg-choose-image">{tr('Choose image…')}</Button>
            <Field label={tr('Overlay')}><div className="flex gap-1.5"><div className="flex-1"><ColorField value={bg.overlay?.color ?? '#000000'} theme={theme} onChange={(c) => setBg({ ...bg, overlay: { color: c ?? '#000', opacity: bg.overlay?.opacity ?? 0.4 } })} /></div><NumberInput className="w-20" value={Math.round((bg.overlay?.opacity ?? 0) * 100)} min={0} max={100} suffix="%" onChange={(v) => setBg({ ...bg, overlay: { color: bg.overlay?.color ?? '#000000', opacity: v / 100 } })} /></div></Field>
          </>
        )}
        <button className="text-xs text-ink-500 hover:text-ink-800" onClick={() => setBg(undefined, 'Reset background')}>{tr('Reset to theme background')}</button>
        <div className="space-y-1 border-t border-ink-100 pt-2 dark:border-ink-800">
          <Button size="sm" className="w-full justify-start" icon={<Copy size={13} />} onClick={() => applyTo(doc.slides.map((s) => s.id), 'Apply background to all slides')} data-testid="bg-apply-all">{tr('Apply this background to all slides')}</Button>
          <Button size="sm" className="w-full justify-start" icon={<Layers size={13} />} disabled={!otherSelected.length} title={otherSelected.length ? undefined : tr('Select several slides in the slide list first (Ctrl/Shift + click).')} onClick={() => applyTo([slide.id, ...otherSelected], 'Apply background to selected slides')} data-testid="bg-apply-selected">{tr('Apply to selected slides ({n})', { n: otherSelected.length + 1 })}</Button>
          <Button size="sm" className="w-full justify-start" icon={<RotateCcw size={13} />} onClick={resetAll} data-testid="bg-reset-all">{tr('Reset every slide to the theme background')}</Button>
          <p className="text-[10.5px] text-ink-400">{tr('You can undo these with Ctrl+Z.')}</p>
        </div>
      </Section>
      <Section title={tr('Speaker notes')}>
        <textarea key={slide.id + 'n'} className={cx(inputCls, 'h-40 py-2 leading-relaxed')} placeholder={tr('What you will say on this slide…')} defaultValue={slide.notes ?? ''} onBlur={(e) => e.target.value !== (slide.notes ?? '') && st().updateSlide(slide.id, { notes: e.target.value || undefined }, 'Speaker notes')} data-testid="notes-input" />
      </Section>
      <MediaPicker open={pick} onClose={() => setPick(false)} onPick={(ref) => { setBg({ type: 'image', image: ref, overlay: bg.type === 'image' ? bg.overlay : { color: '#000000', opacity: 0.25 }, ...(bg.type === 'image' && bg.fit ? { fit: bg.fit } : {}) } as Background); setPick(false); }} />
    </div>
  );
}
