import { useMemo, useState } from 'react';
import { tr } from '@/i18n';
import type { Draft } from 'immer';
import {
  AlignCenter, AlignLeft, AlignRight, AlignJustify, Bold, Italic, Underline, List, ListOrdered, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, ArrowUpToLine, ArrowDownToLine, ChevronUp, ChevronDown,
  Lock, LockOpen, FlipHorizontal, FlipVertical, Plus, Trash2, Sparkles,
} from 'lucide-react';
import type { Paragraph, SlideElement, Style, Theme } from '@/types/schema';
import { ELEMENT_TYPES, CHART_TYPES, DECOR_KINDS, DIAGRAM_KINDS, INFOGRAPHIC_KINDS, TIMELINE_STYLES, VISUAL3D_KINDS, type ChartType } from '@/types/registry';
import { ChartTypePicker, DECOR_LABELS, DecorGlyph, DiagramKindPicker, InfographicKindPicker, ShapePicker, TIMELINE_LABELS, TileGrid, VISUAL3D_LABELS, Visual3DGlyph } from '../pickers';
import { convertContent } from '../dialogs/chartGrid';
import { useEditor, useSelectedElements } from '@/stores/editor';
import { presentationTheme } from '@/slides/SlideRenderer';
import { ICON_NAMES, IconSvg } from '@/media/icons';
import { suggestChartType } from '@/charts/suggest';
import { Button, Field, IconButton, NumberInput, Section, Select, Toggle, cx, inputCls } from '@/components/ui';
import { ColorField, FONT_CHOICES, GradientField, Row, Seg } from './fields';
import { SlideProps } from './SlideProps';

type Upd = (recipe: (e: Draft<SlideElement>) => void, label?: string) => void;
const setStyle = (upd: Upd, patch: Partial<Style>, label = 'Style') => upd((e) => { e.style = { ...(e.style ?? {}), ...patch } as Draft<Style>; Object.keys(patch).forEach((k) => { if ((patch as Record<string, unknown>)[k] === undefined) delete (e.style as Record<string, unknown>)[k]; }); }, label);
const mapRuns = (ps: Paragraph[], f: (r: Paragraph['runs'][number]) => Paragraph['runs'][number]) => ps.map((p) => ({ ...p, runs: p.runs.map(f) }));

/** Inline formatting: when text is being edited, use execCommand on the selection; otherwise apply to the whole element. */
function exec(cmd: string, value?: string): boolean {
  const ed = useEditor.getState().editingId;
  if (!ed) return false;
  document.execCommand('styleWithCSS', false, 'true');
  return document.execCommand(cmd, false, value);
}

export function PropertiesPanel({ onOpenChartEditor, onReplaceImage }: { onOpenChartEditor: (id: string) => void; onReplaceImage: (id: string) => void }) {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const selected = useSelectedElements();
  const st = useEditor.getState;
  const theme = useMemo(() => presentationTheme(doc, slide ?? undefined), [doc, slide]);
  if (!slide) return null;
  if (!selected.length) return <SlideProps slide={slide} theme={theme} />;
  const ids = selected.map((e) => e.id);
  const el = selected[0];
  const upd: Upd = (recipe, label) => st().updateElements(ids, recipe, label);
  const same = selected.every((e) => e.type === el.type);
  const textual = selected.every((e) => ['text', 'heading', 'paragraph', 'richText'].includes(e.type) || (e.type === 'shape' && e.content?.paragraphs));
  return (
    <div className="pb-10" data-testid="properties-panel">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 dark:border-ink-800">
        <div className="text-[13px] font-semibold">{selected.length > 1 ? tr('{n} elements', { n: selected.length }) : el.name ?? tr(ELEMENT_TYPES[el.type]?.label ?? el.type)}<span className="ml-2 text-[11px] font-normal text-ink-400">{selected.length === 1 ? el.id : ''}</span></div>
        <IconButton title={el.locked ? tr('Unlock') : tr('Lock')} onClick={() => upd((e) => { e.locked = !el.locked; }, el.locked ? 'Unlock' : 'Lock')}>{el.locked ? <Lock size={14} className="text-amber-500" /> : <LockOpen size={14} />}</IconButton>
      </div>
      <Section title={tr('Arrange')}>
        <div className="flex flex-wrap gap-0.5">
          <IconButton title={tr('Align left')} onClick={() => st().align('left')}><AlignStartVertical size={15} /></IconButton>
          <IconButton title={tr('Align center')} onClick={() => st().align('center')}><AlignCenterVertical size={15} /></IconButton>
          <IconButton title={tr('Align right')} onClick={() => st().align('right')}><AlignEndVertical size={15} /></IconButton>
          <IconButton title={tr('Align top')} onClick={() => st().align('top')}><AlignStartHorizontal size={15} /></IconButton>
          <IconButton title={tr('Align middle')} onClick={() => st().align('middle')}><AlignCenterHorizontal size={15} /></IconButton>
          <IconButton title={tr('Align bottom')} onClick={() => st().align('bottom')}><AlignEndHorizontal size={15} /></IconButton>
          <IconButton title={tr('Distribute horizontally (3+)')} disabled={selected.length < 3} onClick={() => st().distribute('h')}><AlignHorizontalSpaceAround size={15} /></IconButton>
          <IconButton title={tr('Distribute vertically (3+)')} disabled={selected.length < 3} onClick={() => st().distribute('v')}><AlignVerticalSpaceAround size={15} /></IconButton>
          <IconButton title={tr('Bring to front')} onClick={() => st().arrange('front')}><ArrowUpToLine size={15} /></IconButton>
          <IconButton title={tr('Bring forward')} onClick={() => st().arrange('forward')}><ChevronUp size={15} /></IconButton>
          <IconButton title={tr('Send backward')} onClick={() => st().arrange('backward')}><ChevronDown size={15} /></IconButton>
          <IconButton title={tr('Send to back')} onClick={() => st().arrange('back')}><ArrowDownToLine size={15} /></IconButton>
        </div>
        {selected.length === 1 && (
          <>
            <Row cols={4}>
              <Field label={tr('X')}><NumberInput testId="pos-x" value={el.x} onChange={(v) => upd((e) => { const dx = v - e.x; e.x = v; if (e.type === 'line' || e.type === 'arrow') { e.content.x1 += dx; e.content.x2 += dx; } }, 'Move')} /></Field>
              <Field label={tr('Y')}><NumberInput testId="pos-y" value={el.y} onChange={(v) => upd((e) => { const dy = v - e.y; e.y = v; if (e.type === 'line' || e.type === 'arrow') { e.content.y1 += dy; e.content.y2 += dy; } }, 'Move')} /></Field>
              <Field label={tr('W')}><NumberInput value={el.width} min={1} onChange={(v) => upd((e) => { e.width = v; }, 'Resize')} /></Field>
              <Field label={tr('H')}><NumberInput value={el.height} min={1} onChange={(v) => upd((e) => { e.height = v; }, 'Resize')} /></Field>
            </Row>
            <Row cols={2}>
              <Field label={tr('Rotation')}><NumberInput value={el.rotation ?? 0} suffix="°" onChange={(v) => upd((e) => { e.rotation = ((v % 360) + 360) % 360; }, 'Rotate')} /></Field>
              <Field label={tr('Opacity')}><NumberInput value={Math.round((el.opacity ?? 1) * 100)} min={0} max={100} suffix="%" onChange={(v) => upd((e) => { e.opacity = v / 100; }, 'Opacity')} /></Field>
            </Row>
          </>
        )}
      </Section>

      {textual && <TextProps selected={selected} upd={upd} theme={theme} />}
      {same && el.type === 'image' && selected.length === 1 && <ImageProps el={el} upd={upd} theme={theme} onReplace={() => onReplaceImage(el.id)} />}
      {same && el.type === 'shape' && <ShapeProps el={el} upd={upd} theme={theme} />}
      {same && (el.type === 'line' || el.type === 'arrow') && <LineProps el={el} upd={upd} theme={theme} />}
      {same && el.type === 'chart' && selected.length === 1 && <ChartProps key={el.id} el={el} upd={upd} theme={theme} onEdit={() => onOpenChartEditor(el.id)} />}
      {same && el.type === 'table' && selected.length === 1 && <TableProps el={el} upd={upd} theme={theme} />}
      {same && ['diagram', 'smartart', 'timeline', 'infographic'].includes(el.type) && selected.length === 1 && <CompositeProps el={el} upd={upd} />}
      {same && el.type === 'formula' && <FormulaProps el={el} upd={upd} theme={theme} />}
      {same && el.type === 'code' && <CodeProps el={el} upd={upd} />}
      {same && (el.type === 'video' || el.type === 'audio') && <MediaProps el={el} upd={upd} />}
      {same && el.type === 'icon' && <IconProps el={el} upd={upd} theme={theme} />}
      {same && (el.type === 'decorative' || el.type === 'visual3d') && <DecorProps el={el} upd={upd} />}
      {same && el.type === 'svg' && <Section title={tr('SVG markup')}><textarea className={cx(inputCls, 'h-40 py-1 font-mono text-[11px]')} defaultValue={el.content?.markup} onBlur={(e) => upd((x) => { x.content.markup = e.target.value; }, 'Edit SVG')} /><p className="text-[11px] text-ink-400">{tr('Markup is sanitized (no scripts or event handlers).')}</p></Section>}
      {same && el.type === 'group' && <Section title={tr('Group')}><p className="text-xs text-ink-500">{el.content?.children?.length ?? 0} elements. Ungroup to edit them individually.</p><Button size="sm" onClick={() => st().ungroup()}>{tr('Ungroup')}</Button></Section>}

      {selected.length === 1 && (
        <Section title={tr('Link & accessibility')} defaultOpen={false}>
          <Field label={tr('Hyperlink')}><input className={inputCls} placeholder={tr('https://…')} defaultValue={el.link ?? ''} onBlur={(e) => upd((x) => { const v = e.target.value.trim(); if (v && /^(https?:|mailto:)/.test(v)) x.link = v; else delete x.link; }, 'Link')} /></Field>
          <Field label={tr('Name (for Morph / layers)')}><input className={inputCls} defaultValue={el.name ?? ''} onBlur={(e) => upd((x) => { if (e.target.value.trim()) x.name = e.target.value.trim(); else delete x.name; }, 'Rename')} /></Field>
          <Field label={tr('Alt text')}><input className={inputCls} defaultValue={el.alt ?? el.content?.alt ?? ''} onBlur={(e) => upd((x) => { x.alt = e.target.value; if (x.type === 'image') x.content.alt = e.target.value; }, 'Alt text')} /></Field>
          <Toggle checked={el.visible !== false} onChange={(v) => upd((x) => { if (v) delete x.visible; else x.visible = false; }, 'Visibility')} label={tr('Visible')} />
        </Section>
      )}
    </div>
  );
}

function TextProps({ selected, upd, theme }: { selected: SlideElement[]; upd: Upd; theme: Theme }) {
  const el = selected[0];
  const s = el.style ?? {};
  const ps: Paragraph[] = el.content?.paragraphs ?? [];
  const allBold = ps.every((p) => p.runs.every((r) => r.bold || !r.text)) || Number(s.fontWeight) >= 700;
  const toggleRun = (key: 'bold' | 'italic' | 'underline', cmd: string) => {
    if (exec(cmd)) return;
    const on = ps.every((p) => p.runs.every((r) => r[key] || !r.text)) || (key === 'italic' && s.italic) || (key === 'underline' && s.underline);
    upd((e) => { e.content.paragraphs = mapRuns(e.content.paragraphs ?? [], (r) => ({ ...r, [key]: !on || undefined })); if (key === 'italic') delete e.style?.italic; if (key === 'underline') delete e.style?.underline; if (key === 'bold' && on && e.style) delete e.style.fontWeight; }, key);
  };
  const setList = (list: 'bullet' | 'number' | undefined) => upd((e) => { const all = (e.content.paragraphs as Paragraph[]).every((p) => p.list === list); e.content.paragraphs = (e.content.paragraphs as Paragraph[]).map((p) => ({ ...p, list: all ? undefined : list })); }, 'List');
  return (
    <Section title={tr('Text')}>
      <Row>
        <Field label={tr('Font')}><Select value={s.fontFamily ?? (el.type === 'heading' ? '$heading' : '$body')} options={FONT_CHOICES.map((f) => ({ value: f, label: f === '$heading' ? `${tr('Heading')} (${theme.fonts.heading})` : f === '$body' ? `${tr('Body')} (${theme.fonts.body})` : f }))} onChange={(v) => setStyle(upd, { fontFamily: v }, 'Font')} /></Field>
        <Field label={tr('Size')}><NumberInput value={s.fontSize ?? (el.type === 'heading' ? theme.fontScale.h2 : theme.fontScale.body)} min={6} max={600} suffix="px" onChange={(v) => setStyle(upd, { fontSize: v }, 'Font size')} /></Field>
      </Row>
      <Row>
        <Field label={tr('Weight')}><Select value={String(s.fontWeight ?? (el.type === 'heading' ? theme.typography.headingWeight : 400))} options={['300', '400', '500', '600', '700', '800', '900'].map((w) => ({ value: w, label: w }))} onChange={(v) => setStyle(upd, { fontWeight: Number(v) }, 'Weight')} /></Field>
        <Field label={tr('Color')}><ColorField value={s.color} theme={theme} onChange={(c) => { if (c && exec('foreColor', c.startsWith('$') ? undefined : c)) return; setStyle(upd, { color: c }, 'Text color'); }} /></Field>
      </Row>
      <div className="flex flex-wrap items-center gap-1">
        <IconButton title={tr('Bold (Ctrl+B)')} data-keep-editing onMouseDown={(e) => e.preventDefault()} active={allBold} onClick={() => toggleRun('bold', 'bold')}><Bold size={15} /></IconButton>
        <IconButton title={tr('Italic (Ctrl+I)')} data-keep-editing onMouseDown={(e) => e.preventDefault()} onClick={() => toggleRun('italic', 'italic')}><Italic size={15} /></IconButton>
        <IconButton title={tr('Underline (Ctrl+U)')} data-keep-editing onMouseDown={(e) => e.preventDefault()} onClick={() => toggleRun('underline', 'underline')}><Underline size={15} /></IconButton>
        <IconButton title={tr('Bullets')} onClick={() => setList('bullet')} active={ps.some((p) => p.list === 'bullet')}><List size={15} /></IconButton>
        <IconButton title={tr('Numbering')} onClick={() => setList('number')} active={ps.some((p) => p.list === 'number')}><ListOrdered size={15} /></IconButton>
        <div className="flex-1" />
        <Seg value={s.align ?? 'left'} onChange={(v) => setStyle(upd, { align: v }, 'Align text')} options={[{ value: 'left', label: <AlignLeft size={13} /> }, { value: 'center', label: <AlignCenter size={13} /> }, { value: 'right', label: <AlignRight size={13} /> }, { value: 'justify', label: <AlignJustify size={13} /> }]} />
      </div>
      <Row>
        <Field label={tr('Vertical')}><Seg value={s.verticalAlign ?? (el.type === 'shape' ? 'middle' : 'top')} onChange={(v) => setStyle(upd, { verticalAlign: v }, 'Vertical align')} options={[{ value: 'top', label: tr('Top') }, { value: 'middle', label: tr('Mid') }, { value: 'bottom', label: tr('Bot') }]} /></Field>
        <Field label={tr('Case')}><Select value={s.textTransform ?? 'none'} options={[{ value: 'none', label: tr('Normal') }, { value: 'uppercase', label: tr('UPPERCASE') }, { value: 'lowercase', label: tr('lowercase') }, { value: 'capitalize', label: tr('Capitalize') }]} onChange={(v) => setStyle(upd, { textTransform: v === 'none' ? undefined : v }, 'Case')} /></Field>
      </Row>
      <Row cols={3}>
        <Field label={tr('Line height')}><NumberInput value={s.lineHeight ?? (el.type === 'heading' ? theme.typography.headingLineHeight : theme.typography.bodyLineHeight)} step={0.05} min={0.6} max={4} onChange={(v) => setStyle(upd, { lineHeight: v }, 'Line height')} /></Field>
        <Field label={tr('Letter sp.')}><NumberInput value={s.letterSpacing ?? 0} step={0.5} suffix="px" onChange={(v) => setStyle(upd, { letterSpacing: v }, 'Letter spacing')} /></Field>
        <Field label={tr('Para sp.')}><NumberInput value={s.paragraphSpacing ?? 0} min={0} suffix="px" onChange={(v) => setStyle(upd, { paragraphSpacing: v }, 'Paragraph spacing')} /></Field>
      </Row>
      <Row>
        <Field label={tr('Padding')}><NumberInput value={typeof s.padding === 'number' ? s.padding : 0} min={0} suffix="px" onChange={(v) => setStyle(upd, { padding: v }, 'Padding')} /></Field>
        <Field label={tr('Box fill')}><ColorField value={el.type === 'shape' ? undefined : s.fill} allowNone theme={theme} onChange={(c) => el.type !== 'shape' && setStyle(upd, { fill: c }, 'Text box fill')} /></Field>
      </Row>
      <Field label={tr('Text effects')}>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={s.textShadow ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { textShadow: s.textShadow ? undefined : { x: 0, y: 4, blur: 16, color: 'rgba(0,0,0,0.35)' } }, 'Text shadow')}>{tr('Shadow')}</Button>
          <Button size="sm" variant={s.textGradient ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { textGradient: s.textGradient ? undefined : { type: 'linear', angle: 0, stops: [{ color: '$primary', offset: 0 }, { color: '$accent', offset: 1 }] } }, 'Gradient text')}>{tr('Gradient')}</Button>
        </div>
      </Field>
      {s.textGradient && <GradientField value={s.textGradient} theme={theme} onChange={(g) => setStyle(upd, { textGradient: g }, 'Gradient text')} />}
    </Section>
  );
}

function ImageProps({ el, upd, theme, onReplace }: { el: SlideElement; upd: Upd; theme: Theme; onReplace: () => void }) {
  const s = el.style ?? {};
  const crop = s.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const setCrop = (k: 'x' | 'y' | 'width' | 'height', v: number) => {
    const c = { ...crop, [k]: v };
    c.width = Math.max(0.1, Math.min(c.width, 1 - c.x)); c.height = Math.max(0.1, Math.min(c.height, 1 - c.y));
    setStyle(upd, { crop: c }, 'Crop');
  };
  const [cropOpen, setCropOpen] = useState(!!s.crop);
  return (
    <Section title={tr('Image')}>
      <div className="flex gap-1.5"><Button size="sm" variant="primary" onClick={onReplace}>{tr('Replace image')}</Button></div>
      {el.content?.query && !el.content?.src && <p className="text-[11px] text-ink-500">{tr('Image intent: “{q}” — resolved automatically from image providers.', { q: el.content.query })}</p>}
      {(el.content?.credit || el.content?.license) && <p className="text-[11px] text-ink-500">{el.content.credit} {el.content.license ? `· ${el.content.license}` : ''}</p>}
      <Row>
        <Field label={tr('Fit')}><Seg value={s.fit ?? 'cover'} onChange={(v) => setStyle(upd, { fit: v, crop: undefined }, 'Fit')} options={[{ value: 'cover', label: tr('Fill') }, { value: 'contain', label: tr('Fit') }, { value: 'fill', label: tr('Stretch') }]} /></Field>
        <Field label={tr('Mask')}><Select value={s.mask ?? 'none'} options={['none', 'rounded', 'circle', 'arch', 'hexagon', 'diamond', 'blob'].map((m) => ({ value: m, label: tr(m) }))} onChange={(v) => setStyle(upd, { mask: v as Style['mask'] }, 'Mask')} /></Field>
      </Row>
      {(s.fit ?? 'cover') === 'cover' && !s.crop && (
        <Row><Field label={tr('Focus X')}><input type="range" min={0} max={1} step={0.05} value={s.focalX ?? 0.5} className="w-full" onChange={(e) => setStyle(upd, { focalX: Number(e.target.value) }, 'Focal point')} /></Field><Field label={tr('Focus Y')}><input type="range" min={0} max={1} step={0.05} value={s.focalY ?? 0.5} className="w-full" onChange={(e) => setStyle(upd, { focalY: Number(e.target.value) }, 'Focal point')} /></Field></Row>
      )}
      <Toggle checked={cropOpen} onChange={(v) => { setCropOpen(v); if (!v) setStyle(upd, { crop: undefined }, 'Remove crop'); }} label={tr('Crop')} />
      {cropOpen && (
        <Row cols={1}>
          {(['x', 'y', 'width', 'height'] as const).map((k) => (
            <Field key={k} label={`${tr('Crop')} ${tr(k)} (%)`}>
              <div className="flex items-center gap-1.5">
                <input type="range" min={k === 'width' || k === 'height' ? 0.1 : 0} max={1} step={0.01} value={crop[k]} className="min-w-0 flex-1" onChange={(e) => setCrop(k, Number(e.target.value))} />
                <NumberInput className="w-[72px] shrink-0" min={k === 'width' || k === 'height' ? 10 : 0} max={100} step={1} value={Math.round(crop[k] * 100)} onChange={(v) => setCrop(k, v / 100)} testId={`crop-${k}`} />
              </div>
            </Field>
          ))}
        </Row>
      )}
      <Row>
        <Field label={tr('Radius')}><NumberInput value={s.radius ?? 0} min={0} suffix="px" onChange={(v) => setStyle(upd, { radius: v }, 'Radius')} /></Field>
        <Field label={tr('Brightness')}><NumberInput value={Math.round((s.brightness ?? 1) * 100)} min={0} max={300} suffix="%" onChange={(v) => setStyle(upd, { brightness: v / 100 }, 'Brightness')} /></Field>
      </Row>
      <Row>
        <Field label={tr('Border')}><ColorField value={s.stroke?.color} allowNone theme={theme} onChange={(c) => setStyle(upd, { stroke: c ? { color: c, width: s.stroke?.width ?? 4 } : undefined }, 'Border')} /></Field>
        <Field label={tr('Border width')}><NumberInput value={s.stroke?.width ?? 0} min={0} onChange={(v) => setStyle(upd, { stroke: { color: s.stroke?.color ?? '$border', width: v } }, 'Border')} /></Field>
      </Row>
      <div className="flex flex-wrap gap-1.5">
        <IconButton title={tr('Flip horizontal')} active={s.flipH} onClick={() => setStyle(upd, { flipH: !s.flipH || undefined }, 'Flip')}><FlipHorizontal size={15} /></IconButton>
        <IconButton title={tr('Flip vertical')} active={s.flipV} onClick={() => setStyle(upd, { flipV: !s.flipV || undefined }, 'Flip')}><FlipVertical size={15} /></IconButton>
        <Button size="sm" variant={s.shadow ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { shadow: s.shadow ? undefined : { x: 0, y: 18, blur: 48, color: 'rgba(0,0,0,0.28)' } }, 'Shadow')}>{tr('Shadow')}</Button>
        <Button size="sm" variant={s.grayscale ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { grayscale: !s.grayscale || undefined }, 'Grayscale')}>{tr('Grayscale')}</Button>
        <Button size="sm" variant={s.overlay ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { overlay: s.overlay ? undefined : { color: '#000000', opacity: 0.35 } }, 'Overlay')}>{tr('Overlay')}</Button>
      </div>
      {s.overlay && <Row><ColorField value={s.overlay.color} theme={theme} onChange={(c) => setStyle(upd, { overlay: { ...s.overlay!, color: c ?? '#000' } }, 'Overlay')} /><NumberInput value={Math.round(s.overlay.opacity * 100)} min={0} max={100} suffix="%" onChange={(v) => setStyle(upd, { overlay: { ...s.overlay!, opacity: v / 100 } }, 'Overlay')} /></Row>}
    </Section>
  );
}

function ShapeProps({ el, upd, theme }: { el: SlideElement; upd: Upd; theme: Theme }) {
  const s = el.style ?? {};
  return (
    <Section title={tr('Shape')}>
      <Field label={tr('Shape')}><ShapePicker value={el.content?.shape ?? 'rect'} onChange={(v) => upd((e) => { e.content.shape = v; }, 'Shape type')} /></Field>
      <Row>
        <Field label={tr('Fill')}><ColorField value={s.fill} allowNone theme={theme} onChange={(c) => setStyle(upd, { fill: c }, 'Fill')} /></Field>
        <Field label={tr('Radius')}><NumberInput value={s.radius ?? 0} min={0} suffix="px" onChange={(v) => setStyle(upd, { radius: v }, 'Radius')} /></Field>
      </Row>
      <Field label={tr('Gradient')}><GradientField value={s.gradient} theme={theme} onChange={(g) => setStyle(upd, { gradient: g }, 'Gradient')} /></Field>
      <Row cols={3}>
        <Field label={tr('Stroke')}><ColorField value={s.stroke?.color} allowNone theme={theme} onChange={(c) => setStyle(upd, { stroke: c ? { ...s.stroke, color: c, width: s.stroke?.width || 3 } : undefined }, 'Stroke')} /></Field>
        <Field label={tr('Width')}><NumberInput value={s.stroke?.width ?? 0} min={0} onChange={(v) => setStyle(upd, { stroke: { ...s.stroke, color: s.stroke?.color ?? '$border', width: v } }, 'Stroke')} /></Field>
        <Field label={tr('Dash')}><Select value={s.stroke?.dash ?? 'solid'} options={['solid', 'dash', 'dot', 'dashDot'].map((d) => ({ value: d, label: tr(d) }))} onChange={(v) => setStyle(upd, { stroke: { ...s.stroke, dash: v as 'solid' } }, 'Dash')} /></Field>
      </Row>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={s.shadow ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { shadow: s.shadow ? undefined : { x: 0, y: 14, blur: 40, color: 'rgba(15,23,42,0.18)' } }, 'Shadow')}>{tr('Shadow')}</Button>
        <Button size="sm" variant={s.blur ? 'primary' : 'secondary'} onClick={() => setStyle(upd, { blur: s.blur ? undefined : 20 }, 'Glass')}>{tr('Glass blur')}</Button>
        {!el.content?.paragraphs && <Button size="sm" onClick={() => upd((e) => { e.content.paragraphs = [{ runs: [{ text: 'Text' }] }]; }, 'Add text')}>{tr('Add text')}</Button>}
      </div>
    </Section>
  );
}

function LineProps({ el, upd, theme }: { el: SlideElement; upd: Upd; theme: Theme }) {
  const s = el.style ?? {};
  const heads = ['none', 'arrow', 'triangle', 'oval', 'diamond'].map((h) => ({ value: h, label: tr(h) }));
  return (
    <Section title={tr('Line')}>
      <Row cols={3}>
        <Field label={tr('Color')}><ColorField value={s.stroke?.color} theme={theme} onChange={(c) => setStyle(upd, { stroke: { ...s.stroke, color: c ?? '$text' } }, 'Line color')} /></Field>
        <Field label={tr('Width')}><NumberInput value={s.stroke?.width ?? 4} min={1} onChange={(v) => setStyle(upd, { stroke: { ...s.stroke, width: v } }, 'Line width')} /></Field>
        <Field label={tr('Dash')}><Select value={s.stroke?.dash ?? 'solid'} options={['solid', 'dash', 'dot'].map((d) => ({ value: d, label: tr(d) }))} onChange={(v) => setStyle(upd, { stroke: { ...s.stroke, dash: v as 'solid' } }, 'Dash')} /></Field>
      </Row>
      <Row>
        <Field label={tr('Start')}><Select value={s.headStart ?? 'none'} options={heads} onChange={(v) => setStyle(upd, { headStart: v as Style['headStart'] }, 'Arrow head')} /></Field>
        <Field label={tr('End')}><Select value={s.headEnd ?? 'none'} options={heads} onChange={(v) => setStyle(upd, { headEnd: v as Style['headEnd'] }, 'Arrow head')} /></Field>
      </Row>
    </Section>
  );
}

function ChartProps({ el, upd, theme, onEdit }: { el: SlideElement; upd: Upd; theme: Theme; onEdit: () => void }) {
  const c = el.content;
  const sug = suggestChartType(c);
  const set = (patch: Record<string, unknown>, label = 'Chart') => upd((e) => { Object.assign(e.content, patch); Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete e.content[k]; }); }, label);
  // Switching between families (e.g. column ↔ scatter ↔ histogram) converts the data instead of breaking the chart.
  const changeType = (v: ChartType) => { const next = convertContent(c, v); upd((e) => { e.content = JSON.parse(JSON.stringify(next)); }, 'Chart type'); };
  return (
    <Section title={tr('Chart')}>
      <Button size="sm" variant="primary" onClick={onEdit} data-testid="chart-edit-data">{tr('Edit data…')}</Button>
      <Field label={tr('Chart type')}><ChartTypePicker value={c.chartType} onChange={(v) => changeType(v)} testId="props-chart-type" /></Field>
      <p className="text-[11px] text-ink-400">{tr(CHART_TYPES[c.chartType as keyof typeof CHART_TYPES]?.use ?? '')}</p>
      {sug && sug.type !== c.chartType && (
        <button className="flex w-full items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-2 text-left text-[11px] text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200" onClick={() => changeType(sug.type)}>
          <Sparkles size={13} className="mt-0.5 shrink-0" /><span><b>{tr('Suggested')}: {tr(CHART_TYPES[sug.type].label)}</b> — {tr(sug.reason)}</span>
        </button>
      )}
      <Field label={tr('Title')}><input className={inputCls} defaultValue={c.title ?? ''} onBlur={(e) => set({ title: e.target.value || undefined }, 'Chart title')} /></Field>
      <div className="grid grid-cols-2 gap-1.5">
        <Toggle checked={!!c.showLabels} onChange={(v) => set({ showLabels: v }, 'Labels')} label={tr('Labels')} />
        <Toggle checked={c.showLegend !== false} onChange={(v) => set({ showLegend: v }, 'Legend')} label={tr('Legend')} />
        <Toggle checked={c.showGrid !== false} onChange={(v) => set({ showGrid: v }, 'Grid')} label={tr('Grid')} />
        <Toggle checked={c.showAxis !== false} onChange={(v) => set({ showAxis: v }, 'Axis')} label={tr('Axis')} />
        {['line', 'area', 'combo'].includes(c.chartType) && <Toggle checked={!!c.smooth} onChange={(v) => set({ smooth: v }, 'Smooth')} label={tr('Smooth')} />}
        {['column', 'stackedBar', 'area'].includes(c.chartType) && <Toggle checked={!!c.stacked || c.chartType === 'stackedBar'} onChange={(v) => set({ stacked: v }, 'Stacked')} label={tr('Stacked')} />}
      </div>
      <Field label={tr('Legend position')}><Select value={c.legendPosition ?? 'top'} options={['top', 'bottom', 'right'].map((p) => ({ value: p, label: tr(p) }))} onChange={(v) => set({ legendPosition: v }, 'Legend')} /></Field>
      <Row cols={3}>
        <Field label={tr('Prefix')}><input className={inputCls} defaultValue={c.valuePrefix ?? ''} onBlur={(e) => set({ valuePrefix: e.target.value || undefined }, 'Format')} /></Field>
        <Field label={tr('Suffix')}><input className={inputCls} defaultValue={c.valueSuffix ?? ''} onBlur={(e) => set({ valueSuffix: e.target.value || undefined }, 'Format')} /></Field>
        <Field label={tr('Decimals')}><NumberInput value={c.decimals} min={0} max={6} onChange={(v) => set({ decimals: v }, 'Format')} /></Field>
      </Row>
      <Row>
        <Field label={tr('X axis title')}><input className={inputCls} defaultValue={c.xAxisTitle ?? ''} onBlur={(e) => set({ xAxisTitle: e.target.value || undefined }, 'Axis title')} /></Field>
        <Field label={tr('Y axis title')}><input className={inputCls} defaultValue={c.yAxisTitle ?? ''} onBlur={(e) => set({ yAxisTitle: e.target.value || undefined }, 'Axis title')} /></Field>
      </Row>
      <Field label={tr('Series colors')}>
        <div className="space-y-1">{(c.series ?? []).map((s: { name: string; color?: string }, i: number) => (
          <div key={i} className="flex items-center gap-2 text-xs"><span className="w-24 truncate">{s.name}</span><div className="flex-1"><ColorField value={s.color ?? `$chart${i + 1}`} theme={theme} onChange={(col) => upd((e) => { e.content.series[i].color = col; }, 'Series color')} /></div></div>
        ))}</div>
      </Field>
      <Field label={tr('Source / citation')}><input className={inputCls} defaultValue={c.source ?? ''} onBlur={(e) => set({ source: e.target.value || undefined }, 'Source')} /></Field>
    </Section>
  );
}

function TableProps({ el, upd, theme }: { el: SlideElement; upd: Upd; theme: Theme }) {
  const rows: string[][] = el.content?.rows ?? [];
  const setCell = (r: number, c: number, v: string) => upd((e) => { e.content.rows[r][c] = v; }, 'Edit cell');
  return (
    <Section title={tr('Table')}>
      <div className="max-h-64 overflow-auto rounded-lg border border-ink-200 dark:border-ink-700">
        <table className="w-full border-collapse text-[11px]">
          <tbody>{rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, ci) => (
              <td key={ci} className="border border-ink-100 p-0 dark:border-ink-800"><input className={cx('w-full min-w-[60px] bg-transparent px-1 py-0.5 outline-none focus:bg-brand-50 dark:focus:bg-brand-500/10', ri === 0 && el.content.header !== false && 'font-semibold')} defaultValue={cell} onBlur={(e) => e.target.value !== cell && setCell(ri, ci, e.target.value)} /></td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" icon={<Plus size={12} />} onClick={() => upd((e) => { e.content.rows.push(new Array(e.content.rows[0]?.length ?? 1).fill('')); e.height += 60; }, 'Add row')}>{tr('Row')}</Button>
        <Button size="sm" icon={<Plus size={12} />} onClick={() => upd((e) => { e.content.rows.forEach((r: string[]) => r.push('')); delete e.content.columnWidths; }, 'Add column')}>{tr('Column')}</Button>
        <Button size="sm" icon={<Trash2 size={12} />} disabled={rows.length <= 1} onClick={() => upd((e) => { e.content.rows.pop(); }, 'Remove row')}>{tr('Row')}</Button>
        <Button size="sm" icon={<Trash2 size={12} />} disabled={(rows[0]?.length ?? 0) <= 1} onClick={() => upd((e) => { e.content.rows.forEach((r: string[]) => r.pop()); delete e.content.columnWidths; }, 'Remove column')}>{tr('Column')}</Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Toggle checked={el.content.header !== false} onChange={(v) => upd((e) => { e.content.header = v; }, 'Header row')} label={tr('Header row')} />
        <Toggle checked={!!el.content.firstColumn} onChange={(v) => upd((e) => { e.content.firstColumn = v; }, 'First column')} label={tr('Bold 1st col')} />
      </div>
      <Row>
        <Field label={tr('Font size')}><NumberInput value={el.style?.fontSize} min={8} max={60} onChange={(v) => setStyle(upd, { fontSize: v }, 'Table font')} /></Field>
        <Field label={tr('Header fill')}><ColorField value={el.style?.fill ?? '$primary'} theme={theme} onChange={(c) => setStyle(upd, { fill: c }, 'Header fill')} /></Field>
      </Row>
    </Section>
  );
}

function CompositeProps({ el, upd }: { el: SlideElement; upd: Upd }) {
  const c = el.content;
  const isTimeline = el.type === 'timeline';
  const isInfo = el.type === 'infographic';
  const items: Record<string, unknown>[] = c.items ?? [];
  const tKey = isTimeline ? 'title' : isInfo ? 'label' : 'title';
  return (
    <Section title={isTimeline ? tr('Timeline') : isInfo ? tr('Infographic') : tr('Diagram')}>
      {!isTimeline && (
        <Field label={tr('Kind')}>{isInfo ? <InfographicKindPicker value={c.kind} onChange={(v) => upd((e) => { e.content.kind = v; }, 'Diagram kind')} /> : <DiagramKindPicker value={c.kind} onChange={(v) => upd((e) => { e.content.kind = v; }, 'Diagram kind')} />}</Field>
      )}
      {!isTimeline && <p className="text-[11px] text-ink-400">{tr(isInfo ? INFOGRAPHIC_KINDS[c.kind as keyof typeof INFOGRAPHIC_KINDS] : DIAGRAM_KINDS[c.kind as keyof typeof DIAGRAM_KINDS])}</p>}
      {isTimeline && (
        <Row>
          <Field label={tr('Orientation')}><Select value={c.orientation ?? 'horizontal'} options={[{ value: 'horizontal', label: tr('Horizontal') }, { value: 'vertical', label: tr('Vertical') }]} onChange={(v) => upd((e) => { e.content.orientation = v; }, 'Timeline')} /></Field>
          <Field label={tr('Style')}><Select value={c.style ?? 'milestones'} options={TIMELINE_STYLES.map((s) => ({ value: s, label: tr(TIMELINE_LABELS[s] ?? s) }))} onChange={(v) => upd((e) => { e.content.style = v; }, 'Timeline')} /></Field>
        </Row>
      )}
      {['cycle', 'hub', 'mindmap', 'orgchart', 'hierarchy'].includes(c.kind) && <Field label={tr('Center label')}><input className={inputCls} defaultValue={c.center ?? ''} onBlur={(e) => upd((x) => { x.content.center = e.target.value || undefined; }, 'Center label')} /></Field>}
      {c.kind === 'flowchart' ? (
        <p className="text-[11px] text-ink-500">{tr('Flowchart nodes/edges: edit via JSON below.')}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-ink-100 p-1.5 dark:border-ink-800">
              <div className="flex gap-1">
                {isTimeline && <input className={cx(inputCls, 'h-7 w-20 text-xs')} defaultValue={String(it.date ?? '')} onBlur={(e) => upd((x) => { x.content.items[i].date = e.target.value; }, 'Edit item')} placeholder={tr('Date')} />}
                <input className={cx(inputCls, 'h-7 text-xs font-medium')} defaultValue={String(it[tKey] ?? '')} onBlur={(e) => upd((x) => { x.content.items[i][tKey] = e.target.value; }, 'Edit item')} />
                {isInfo && <input className={cx(inputCls, 'h-7 w-20 text-xs')} defaultValue={String(it.value ?? it.progress ?? '')} placeholder={tr('Value')} onBlur={(e) => upd((x) => { const v = e.target.value; if (c.kind === 'progressBars' || c.kind === 'statRings') { const n = parseFloat(v); x.content.items[i].progress = n > 1 ? n / 100 : n; } else x.content.items[i].value = Number.isNaN(Number(v)) || v === '' ? v : Number(v); }, 'Edit value')} />}
                <IconButton title={tr('Remove')} className="h-7 w-7" onClick={() => upd((x) => { x.content.items.splice(i, 1); }, 'Remove item')}><Trash2 size={12} /></IconButton>
              </div>
              <textarea className={cx(inputCls, 'mt-1 h-auto py-1 text-[11px]')} rows={1} placeholder={tr('Description')} defaultValue={String(it.text ?? '')} onBlur={(e) => upd((x) => { if (e.target.value) x.content.items[i].text = e.target.value; else delete x.content.items[i].text; }, 'Edit item')} />
            </div>
          ))}
          <Button size="sm" icon={<Plus size={12} />} onClick={() => upd((x) => { x.content.items = [...(x.content.items ?? []), isTimeline ? { date: tr('Date'), title: tr('Milestone') } : isInfo ? { label: tr('New item'), value: 0, progress: 0.5 } : { title: 'New item' }]; }, 'Add item')}>{tr('Add item')}</Button>
        </div>
      )}
      <details className="text-xs"><summary className="cursor-pointer text-ink-500">{tr('Advanced (JSON)')}</summary>
        <textarea className={cx(inputCls, 'mt-1 h-48 py-1 font-mono text-[11px]')} defaultValue={JSON.stringify(c, null, 2)} onBlur={(e) => { try { const v = JSON.parse(e.target.value); upd((x) => { x.content = v; }, 'Edit JSON'); } catch { /* keep invalid text until fixed */ } }} />
      </details>
    </Section>
  );
}

function FormulaProps({ el, upd, theme }: { el: SlideElement; upd: Upd; theme: Theme }) {
  return (
    <Section title={tr('Formula (LaTeX)')}>
      <textarea className={cx(inputCls, 'h-24 py-1 font-mono text-xs')} defaultValue={el.content?.latex} onBlur={(e) => upd((x) => { x.content.latex = e.target.value; }, 'Edit formula')} />
      <Row>
        <Field label={tr('Size')}><NumberInput value={el.style?.fontSize ?? 48} min={10} max={300} onChange={(v) => setStyle(upd, { fontSize: v }, 'Formula size')} /></Field>
        <Field label={tr('Color')}><ColorField value={el.style?.color} theme={theme} onChange={(c) => setStyle(upd, { color: c }, 'Formula color')} /></Field>
      </Row>
    </Section>
  );
}

function CodeProps({ el, upd }: { el: SlideElement; upd: Upd }) {
  const langs = ['typescript', 'javascript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust', 'sql', 'bash', 'json', 'yaml', 'html', 'css', 'kotlin', 'swift', 'php', 'ruby'];
  return (
    <Section title={tr('Code block')}>
      <textarea className={cx(inputCls, 'h-40 py-1 font-mono text-[11px]')} defaultValue={el.content?.code} spellCheck={false} onBlur={(e) => upd((x) => { x.content.code = e.target.value; }, 'Edit code')} />
      <Row>
        <Field label={tr('Language')}><Select value={el.content?.language ?? 'typescript'} options={langs.map((l) => ({ value: l, label: l }))} onChange={(v) => upd((x) => { x.content.language = v; }, 'Language')} /></Field>
        <Field label={tr('Theme')}><Seg value={el.style?.variant === 'light' ? 'light' : 'dark'} onChange={(v) => setStyle(upd, { variant: v }, 'Code theme')} options={[{ value: 'dark', label: tr('Dark') }, { value: 'light', label: tr('Light') }]} /></Field>
      </Row>
      <Row>
        <Field label={tr('Font size')}><NumberInput value={el.style?.fontSize ?? 22} min={10} max={60} onChange={(v) => setStyle(upd, { fontSize: v }, 'Code size')} /></Field>
        <Field label={tr('Title')}><input className={inputCls} defaultValue={el.content?.title ?? ''} onBlur={(e) => upd((x) => { x.content.title = e.target.value || undefined; }, 'Code title')} /></Field>
      </Row>
      <Toggle checked={!!el.content?.showLineNumbers} onChange={(v) => upd((x) => { x.content.showLineNumbers = v; }, 'Line numbers')} label={tr('Line numbers')} />
    </Section>
  );
}

function MediaProps({ el, upd }: { el: SlideElement; upd: Upd }) {
  return (
    <Section title={el.type === 'video' ? tr('Video') : tr('Audio')}>
      <Field label={tr('Source URL')} hint={el.type === 'video' ? tr('MP4/WebM URL or YouTube link') : tr('MP3/WAV/OGG URL')}><input className={inputCls} defaultValue={String(el.content?.src ?? '').startsWith('data:') ? tr('(embedded file)') : el.content?.src} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tr('(embedded file)')) upd((x) => { x.content.src = v; }, 'Media source'); }} /></Field>
      {el.type === 'video' && <Field label={tr('Poster image URL')}><input className={inputCls} defaultValue={el.content?.poster ?? ''} onBlur={(e) => upd((x) => { x.content.poster = e.target.value || undefined; }, 'Poster')} /></Field>}
      <div className="grid grid-cols-2 gap-1.5">
        <Toggle checked={!!el.content?.autoplay} onChange={(v) => upd((x) => { x.content.autoplay = v; }, 'Autoplay')} label={tr('Autoplay')} />
        <Toggle checked={!!el.content?.loop} onChange={(v) => upd((x) => { x.content.loop = v; }, 'Loop')} label={tr('Loop')} />
        {el.type === 'video' && <Toggle checked={!!el.content?.muted} onChange={(v) => upd((x) => { x.content.muted = v; }, 'Muted')} label={tr('Muted')} />}
      </div>
      <p className="text-[11px] text-ink-400">{tr('Media plays in Present mode.')}</p>
    </Section>
  );
}

function IconProps({ el, upd, theme }: { el: SlideElement; upd: Upd; theme: Theme }) {
  const [q, setQ] = useState('');
  const list = ICON_NAMES.filter((n) => n.includes(q.toLowerCase())).slice(0, 120);
  return (
    <Section title={tr('Icon')}>
      <Row>
        <Field label={tr('Color')}><ColorField value={el.style?.color ?? '$primary'} theme={theme} onChange={(c) => setStyle(upd, { color: c }, 'Icon color')} /></Field>
        <Field label={tr('Background')}><ColorField value={el.style?.fill} allowNone theme={theme} onChange={(c) => setStyle(upd, { fill: c }, 'Icon background')} /></Field>
      </Row>
      <Field label={tr('Stroke')}><NumberInput value={el.style?.strokeWidth ?? 2} min={0.5} max={4} step={0.25} onChange={(v) => setStyle(upd, { strokeWidth: v }, 'Icon stroke')} /></Field>
      <input className={inputCls} placeholder={tr('Search {n} icons', { n: ICON_NAMES.length })} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
        {list.map((n) => (
          <button key={n} title={n} className={cx('flex aspect-square items-center justify-center rounded hover:bg-ink-100 dark:hover:bg-ink-800', el.content?.name === n && 'bg-brand-100 dark:bg-brand-500/20')} onClick={() => upd((x) => { x.content.name = n; }, 'Icon')}>
            <IconSvg name={n} size={18} color="currentColor" />
          </button>
        ))}
      </div>
    </Section>
  );
}

function DecorProps({ el, upd }: { el: SlideElement; upd: Upd }) {
  const kinds = el.type === 'decorative' ? DECOR_KINDS : VISUAL3D_KINDS;
  return (
    <Section title={el.type === 'decorative' ? tr('Decoration') : tr('3D visual')}>
      <Field label={tr('Kind')}><TileGrid cols={3} value={el.content?.kind} testPrefix="pick-kind" items={kinds.map((k) => ({ id: k, label: (el.type === 'decorative' ? DECOR_LABELS : VISUAL3D_LABELS)[k] ?? k, glyph: el.type === 'decorative' ? <DecorGlyph kind={k} /> : <Visual3DGlyph kind={k} /> }))} onPick={(v) => upd((x) => { x.content.kind = v; }, 'Kind')} /></Field>
      <Field label={tr('Colors (comma separated, tokens allowed)')}><input className={inputCls} defaultValue={(el.content?.colors ?? []).join(', ')} onBlur={(e) => upd((x) => { x.content.colors = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); }, 'Colors')} /></Field>
      {el.type === 'visual3d' && <Field label={tr('Labels (comma separated)')}><input className={inputCls} defaultValue={(el.content?.items ?? []).join(', ')} onBlur={(e) => upd((x) => { x.content.items = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); }, 'Labels')} /></Field>}
    </Section>
  );
}
