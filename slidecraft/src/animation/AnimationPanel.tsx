import { useState } from 'react';
import { tr } from '@/i18n';
import { Play, Plus, Trash2, Wand2 } from 'lucide-react';
import type { Animation } from '@/types/schema';
import { ELEMENT_TYPES, ANIMATION_EFFECTS, ANIMATION_EFFECT_IDS, ANIMATION_TRIGGERS, ANIMATION_TRIGGER_IDS, EASINGS, type AnimationCategory } from '@/types/registry';
import { useEditor, useSelectedElements } from '@/stores/editor';
import { uid } from '@/utils/id';
import { Badge, Button, Field, IconButton, NumberInput, Section, Select, inputCls } from '@/components/ui';
import { ANIMATION_PRESETS, applyPreset, buildTimeline, categoryOf } from './engine';
import { canvasPreview } from './preview';

const CAT_LABEL: Record<AnimationCategory, string> = { entrance: 'Entrance', emphasis: 'Emphasis', exit: 'Exit', motion: 'Motion path' };
const DEFAULT_EFFECT: Record<AnimationCategory, string> = { entrance: 'fadeIn', emphasis: 'pulse', exit: 'fadeOut', motion: 'motionLine' };
const support = (e: string) => (ANIMATION_EFFECTS as Record<string, { pptx: string }>)[e]?.pptx;

export function AnimationPanel() {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const selected = useSelectedElements();
  const st = useEditor.getState;
  const [preset, setPreset] = useState(ANIMATION_PRESETS[0].id);
  if (!slide) return null;
  const el = selected.length === 1 ? selected[0] : null;
  const anims = el?.animation ?? [];
  const setAnims = (list: Animation[], label = 'Animation') => el && st().setAnimations(el.id, list, label);
  const patch = (i: number, p: Partial<Animation>) => setAnims(anims.map((a, j) => (j === i ? { ...a, ...p } : a)));
  const add = (cat: AnimationCategory) => {
    const maxOrder = Math.max(-1, ...slide.elements.flatMap((e) => (e.animation ?? []).map((a) => a.order ?? 0)));
    setAnims([...anims, { id: uid('anim'), effect: DEFAULT_EFFECT[cat] as Animation['effect'], trigger: 'onClick', duration: cat === 'motion' ? 1200 : 600, delay: 0, order: maxOrder + 1, ...(cat === 'motion' ? { path: { type: 'line', dx: 400, dy: 0 } } : {}) }], 'Add animation');
  };
  const tl = buildTimeline(slide);
  const total = slide.elements.reduce((n, e) => n + (e.animation?.length ?? 0), 0);
  return (
    <div className="pb-10" data-testid="animation-panel">
      <Section title={tr('Slide animations')} actions={<Badge>{tr('{n} on slide · {c} clicks', { n: total, c: tl.steps.filter((s) => s.trigger === 'click').length })}</Badge>}>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" icon={<Play size={12} />} disabled={!total} onClick={() => void canvasPreview.playSlide(slide, doc.size)} data-testid="preview-slide-anim">{tr('Preview slide')}</Button>
          <Button size="sm" onClick={() => { canvasPreview.reset(); st().set({ timelineOpen: !st().timelineOpen }); }}>{tr('Timeline')}</Button>
          <Button size="sm" variant="ghost" disabled={!total} onClick={() => st().commit('Clear animations', (d) => { d.slides.find((s) => s.id === slide.id)!.elements.forEach((e) => { delete e.animation; }); })}>{tr('Clear')}</Button>
        </div>
        <Field label={tr('Animation preset')}>
          <div className="flex gap-1.5">
            <Select value={preset} options={ANIMATION_PRESETS.map((p) => ({ value: p.id, label: p.name }))} onChange={setPreset} />
          </div>
        </Field>
        <p className="text-[11px] text-ink-400">{tr(ANIMATION_PRESETS.find((p) => p.id === preset)?.description ?? '')}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" icon={<Wand2 size={12} />} onClick={() => st().commit('Animation preset', (d) => { const s = d.slides.find((x) => x.id === slide.id)!; s.elements = applyPreset(s as never, preset, doc.size) as never; })} data-testid="apply-preset">{tr('Apply to slide')}</Button>
          <Button size="sm" onClick={() => st().commit('Animation preset (all slides)', (d) => { d.slides.forEach((s) => { s.elements = applyPreset(s as never, preset, doc.size) as never; }); })}>{tr('Apply to all slides')}</Button>
        </div>
      </Section>
      {!el && <p className="px-4 py-4 text-xs text-ink-400">{tr('Select one element to add entrance, emphasis, exit or motion-path animations.')}</p>}
      {el && (
        <Section title={`${tr('Element')}: ${el.name ?? tr(ELEMENT_TYPES[el.type]?.label ?? el.type)}`}>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(CAT_LABEL) as AnimationCategory[]).map((c) => <Button key={c} size="sm" icon={<Plus size={12} />} onClick={() => add(c)} data-testid={`add-anim-${c}`}>{tr(CAT_LABEL[c])}</Button>)}
          </div>
          {anims.map((a, i) => {
            const cat = categoryOf(a.effect) as AnimationCategory;
            const info = (ANIMATION_EFFECTS as Record<string, { directions?: readonly string[]; ppt?: { note?: string } }>)[a.effect];
            return (
              <div key={a.id ?? i} className="space-y-2 rounded-xl border border-ink-200 p-2.5 dark:border-ink-700">
                <div className="flex items-center gap-1.5">
                  <Badge tone={cat === 'entrance' ? 'green' : cat === 'exit' ? 'red' : cat === 'motion' ? 'blue' : 'amber'}>{tr(CAT_LABEL[cat])}</Badge>
                  <Badge tone={support(a.effect) === 'supported' ? 'green' : 'amber'}>PPTX: {tr(support(a.effect) ?? '')}</Badge>
                  <div className="flex-1" />
                  <IconButton title={tr('Preview')} onClick={() => void canvasPreview.playOne({ elId: el.id, anim: a, start: 0, end: a.duration ?? 600, category: cat, el }, doc.size)}><Play size={13} /></IconButton>
                  <IconButton title={tr('Remove')} onClick={() => setAnims(anims.filter((_, j) => j !== i), 'Remove animation')}><Trash2 size={13} /></IconButton>
                </div>
                <Select value={a.effect} options={ANIMATION_EFFECT_IDS.filter((e) => categoryOf(e) === cat).map((e) => ({ value: e, label: tr(ANIMATION_EFFECTS[e].label) }))} onChange={(v) => patch(i, { effect: v })} testId="anim-effect" />
                {info?.ppt?.note && <p className="text-[11px] text-amber-600 dark:text-amber-400">PowerPoint: {tr(info.ppt.note)}</p>}
                <div className="grid grid-cols-2 gap-1.5">
                  <Field label={tr('Trigger')}><Select value={a.trigger ?? 'onClick'} options={ANIMATION_TRIGGER_IDS.map((t) => ({ value: t, label: tr(t) }))} onChange={(v) => patch(i, { trigger: v })} /></Field>
                  <Field label={tr('Easing')}><Select value={a.easing ?? 'easeOut'} options={EASINGS.map((e) => ({ value: e, label: tr(e) }))} onChange={(v) => patch(i, { easing: v })} /></Field>
                  <Field label={tr('Duration')}><NumberInput value={a.duration ?? 600} min={50} max={60000} step={50} suffix="ms" onChange={(v) => patch(i, { duration: v })} /></Field>
                  <Field label={tr('Delay')}><NumberInput value={a.delay ?? 0} min={0} max={60000} step={50} suffix="ms" onChange={(v) => patch(i, { delay: v })} /></Field>
                  <Field label={tr('Repeat')}><Select value={a.repeat === 'infinite' ? 'infinite' : String(a.repeat ?? 0)} options={[...['0', '1', '2', '3', '5'].map((v) => ({ value: v, label: v === '0' ? tr('None') : `${v}×` })), { value: 'infinite', label: tr('Until next click') }]} onChange={(v) => patch(i, { repeat: v === 'infinite' ? 'infinite' : Number(v) })} /></Field>
                  <Field label={tr('Order')}><NumberInput value={a.order ?? 0} step={1} onChange={(v) => patch(i, { order: v })} /></Field>
                  {info?.directions && <Field label={tr('Direction')}><Select value={a.direction ?? info.directions[0]} options={info.directions.map((d) => ({ value: d, label: tr(d) }))} onChange={(v) => patch(i, { direction: v })} /></Field>}
                  {(a.effect === 'growShrink' || a.effect === 'pulse') && <Field label={tr('Scale')}><NumberInput value={a.scale ?? (a.effect === 'pulse' ? 1.08 : 1.15)} step={0.05} min={0.1} max={4} onChange={(v) => patch(i, { scale: v })} /></Field>}
                  {a.effect === 'transparency' && <Field label={tr('Target opacity')}><NumberInput value={a.opacity ?? 0.35} step={0.05} min={0} max={1} onChange={(v) => patch(i, { opacity: v })} /></Field>}
                  {a.effect === 'colorChange' && <Field label={tr('Color')}><input className={inputCls} defaultValue={a.color ?? '#ef4444'} onBlur={(e) => patch(i, { color: e.target.value })} /></Field>}
                </div>
                <p className="text-[11px] text-ink-400">{tr(ANIMATION_TRIGGERS[a.trigger ?? 'onClick'])}</p>
                {cat === 'motion' && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {a.effect !== 'motionCircle' && a.effect !== 'motionPath' && <><Field label={tr('dx')}><NumberInput value={a.path?.dx ?? 400} onChange={(v) => patch(i, { path: { type: a.effect === 'motionCurve' ? 'curve' : 'line', ...a.path, dx: v } })} /></Field><Field label={tr('dy')}><NumberInput value={a.path?.dy ?? 0} onChange={(v) => patch(i, { path: { type: a.effect === 'motionCurve' ? 'curve' : 'line', ...a.path, dy: v } })} /></Field></>}
                    {a.effect === 'motionCircle' && <Field label={tr('Radius')}><NumberInput value={a.path?.radius ?? 150} min={10} onChange={(v) => patch(i, { path: { type: 'circle', ...a.path, radius: v } })} /></Field>}
                    {a.effect === 'motionPath' && <Field label={tr('SVG path (relative)')} className="col-span-3"><input className={inputCls} defaultValue={a.path?.d ?? 'M0 0 C 200 -200 400 200 600 0'} onBlur={(e) => patch(i, { path: { type: 'custom', d: e.target.value } })} /></Field>}
                  </div>
                )}
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}
