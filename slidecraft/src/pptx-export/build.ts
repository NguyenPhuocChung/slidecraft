/**
 * Element → PowerPoint object mapping (pptxgenjs). Anything pptxgenjs cannot express
 * (gradients, groups, image crop/masks, transitions, animations) is recorded as a
 * patch and applied by the OOXML post-processor (ooxml.ts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Gradient, Paragraph, Presentation, Slide, SlideElement, Theme } from '@/types/schema';
import { CHART_TYPES, ELEMENT_TYPES, SHAPES } from '@/types/registry';
import { resolveColor, resolveFont } from '@/themes/themes';
import { buildChartScene, seriesColor } from '@/charts/chartScene';
import { buildDiagramScene, buildInfographicScene, buildTimelineScene } from '@/charts/diagramScene';
import type { Prim, Scene } from '@/charts/scene';
import { decorSvg, visual3dSvg } from '@/slides/decor';
import { iconSvgString } from '@/media/icons';
import { formatNumber } from '@/utils/misc';
import { color, imageSize, inch, pt, safeName, svgDataUrl } from './util';
import { codeRuns } from './code';

export interface ExportOptionsInternal {
  profile: 'standard' | 'editable' | 'highFidelity' | 'presentation';
  rasterize?: (svg: string, w: number, h: number) => Promise<string>;
  fetchImage?: (url: string) => Promise<string | null>;
  resolveImage?: (el: SlideElement) => string | null;
  renderFormula?: (latex: string, opts: { color: string; fontSize: number }) => Promise<string | null>;
}

export interface GradientPatch { name: string; gradient: { stops: { hex: string; alpha: number; pos: number }[]; angle: number; radial: boolean } }
export interface ImagePatch { name: string; srcRect?: { l: number; t: number; r: number; b: number }; prst?: string }
export interface GroupPatch { name: string; childNames: string[] }
export interface SlidePatches {
  gradients: GradientPatch[];
  images: ImagePatch[];
  groups: GroupPatch[];
  bgGradient?: GradientPatch['gradient'];
  /** element id → object name used for animation targets */
  targets: Map<string, string>;
  /** names of shapes holding text (for bldP) */
  textShapes: Set<string>;
}

export interface BuildReport { warnings: string[]; info: string[]; partial: Set<string>; unsupported: Set<string>; supported: Set<string> }

export interface Ctx {
  pptx: any;
  s: any; // pptxgenjs slide
  slide: Slide;
  slideIndex: number;
  theme: Theme;
  p: Presentation;
  opts: ExportOptionsInternal;
  patches: SlidePatches;
  report: BuildReport;
  morphIds: Set<string>;
  used: Set<string>;
  seq: number;
}

const label = (ctx: Ctx, el: SlideElement) => `Slide ${ctx.slideIndex + 1} › ${ELEMENT_TYPES[el.type]?.label ?? el.type} "${el.id}"`;

export function objectName(ctx: Ctx, el: { id: string; type: string }, suffix = ''): string {
  let base = ctx.morphIds.has(el.id) && !suffix ? `!!${el.id}` : `${el.type}:${el.id}${suffix}`;
  base = safeName(base);
  let n = base;
  let k = 2;
  while (ctx.used.has(n)) n = `${base}~${k++}`;
  ctx.used.add(n);
  return n;
}

export function gradientPatch(g: Gradient, theme: Theme): GradientPatch['gradient'] {
  return {
    radial: g.type === 'radial',
    angle: g.angle ?? 0,
    stops: g.stops.map((s) => { const c = color(s.color, theme, '000000'); return { hex: c?.hex ?? '000000', alpha: c ? 1 - c.transparency / 100 : 0, pos: Math.max(0, Math.min(1, s.offset)) }; }),
  };
}

/* --------------------------------- text --------------------------------- */
function textDefaults(el: SlideElement, theme: Theme) {
  const s = el.style ?? {};
  const heading = el.type === 'heading';
  return {
    fontSize: s.fontSize ?? (heading ? theme.fontScale.h2 : el.type === 'shape' ? 26 : theme.fontScale.body),
    fontFace: resolveFont(s.fontFamily, theme, heading ? 'heading' : 'body'),
    bold: Number(s.fontWeight ?? (heading ? theme.typography.headingWeight : theme.typography.bodyWeight)) >= 600 || s.fontWeight === 'bold',
    color: s.color ?? (el.type === 'shape' ? '#ffffff' : '$text'),
    lineHeight: s.lineHeight ?? (heading ? theme.typography.headingLineHeight : theme.typography.bodyLineHeight),
    letterSpacing: s.letterSpacing ?? (heading ? theme.typography.headingLetterSpacing * ((s.fontSize ?? theme.fontScale.h2) / 80) : 0),
    upper: (s.textTransform ?? (heading && theme.typography.headingTransform === 'uppercase' ? 'uppercase' : undefined)) === 'uppercase',
  };
}

export function textRuns(paragraphs: Paragraph[], el: SlideElement, theme: Theme): any[] {
  const d = textDefaults(el, theme);
  const s = el.style ?? {};
  const out: any[] = [];
  const baseColor = color(d.color, theme, '000000');
  paragraphs.forEach((p, pi) => {
    const runs = p.runs.length ? p.runs : [{ text: '' }];
    runs.forEach((r, ri) => {
      const c = r.color ? color(r.color, theme) : baseColor;
      const o: any = {
        fontFace: r.code ? theme.fonts.mono : r.fontFamily ? resolveFont(r.fontFamily, theme) : d.fontFace,
        fontSize: pt(r.fontSize ?? d.fontSize),
        bold: r.bold ?? d.bold,
        italic: r.italic ?? s.italic ?? false,
        underline: r.underline || s.underline ? { style: 'sng' } : undefined,
        strike: r.strike ? 'sngStrike' : undefined,
        color: c?.hex,
        transparency: c?.transparency || undefined,
        highlight: r.highlight ? color(r.highlight, theme)?.hex : undefined,
        hyperlink: r.link && /^(https?:|mailto:)/.test(r.link) ? { url: r.link } : undefined,
        superscript: r.superscript || undefined,
        subscript: r.subscript || undefined,
        charSpacing: d.letterSpacing ? pt(d.letterSpacing) : undefined,
      };
      { // paragraph-level options repeated on every run (pptxgenjs emits a stray <a:pPr> otherwise)
        o.align = p.align ?? s.align ?? (el.type === 'shape' ? 'center' : 'left');
        o.lineSpacingMultiple = Math.max(0.7, Math.min(3, d.lineHeight));
        if (s.paragraphSpacing && pi < paragraphs.length - 1) o.paraSpaceAfter = pt(s.paragraphSpacing);
        if (p.list === 'bullet') o.bullet = { indent: pt(d.fontSize * 1.1) };
        if (p.list === 'number') o.bullet = { type: 'number', indent: pt(d.fontSize * 1.3) };
        if (p.level) o.indentLevel = p.level;
      }
      if (ri === runs.length - 1 && pi < paragraphs.length - 1) o.breakLine = true;
      Object.keys(o).forEach((k) => o[k] === undefined && delete o[k]);
      out.push({ text: d.upper ? r.text.toUpperCase() : r.text, options: o });
    });
  });
  return out;
}

function boxStyle(el: SlideElement, theme: Theme): any {
  const s = el.style ?? {};
  const o: any = {};
  const f = color(s.fill, theme);
  if (f) o.fill = { color: f.hex, transparency: f.transparency };
  if (s.stroke?.width) { const lc = color(s.stroke.color ?? '$border', theme); if (lc) o.line = { color: lc.hex, width: pt(s.stroke.width), transparency: lc.transparency, dashType: s.stroke.dash === 'dash' ? 'dash' : s.stroke.dash === 'dot' ? 'sysDot' : s.stroke.dash === 'dashDot' ? 'dashDot' : 'solid' }; }
  if (s.shadow) {
    const sc = color(s.shadow.color ?? 'rgba(0,0,0,0.25)', theme);
    const dist = Math.hypot(s.shadow.x ?? 0, s.shadow.y ?? 8);
    o.shadow = { type: 'outer', color: sc?.hex ?? '000000', opacity: sc ? Math.max(0.05, 1 - sc.transparency / 100) : 0.25, blur: Math.min(100, pt(s.shadow.blur ?? 24)), offset: Math.min(200, pt(dist)), angle: Math.round(((Math.atan2(s.shadow.y ?? 8, s.shadow.x ?? 0) * 180) / Math.PI + 360) % 360) };
  }
  return o;
}

function geo(el: { x: number; y: number; width: number; height: number; rotation?: number }, dx = 0, dy = 0) {
  return { x: inch(el.x + dx), y: inch(el.y + dy), w: inch(Math.max(1, el.width)), h: inch(Math.max(1, el.height)), ...(el.rotation ? { rotate: el.rotation } : {}) };
}
function margin(el: SlideElement): number | [number, number, number, number] {
  const p = el.style?.padding;
  if (p === undefined) return el.type === 'shape' ? [pt(12), pt(20), pt(12), pt(20)] : 0;
  if (Array.isArray(p)) return [pt(p[0]), pt(p[1]), pt(p[2]), pt(p[3])];
  return pt(p);
}

/* ------------------------------ element types ------------------------------ */
function addText(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const s = el.style ?? {};
  const o: any = { ...geo(el, dx, dy), ...boxStyle(el, ctx.theme), objectName: name, margin: margin(el), valign: s.verticalAlign ?? 'top', fit: 'none', isTextBox: true, wrap: true };
  if (el.link) o.hyperlink = { url: el.link };
  if (el.opacity !== undefined && el.opacity < 1 && !o.fill) ctx.report.info.push(`${label(ctx, el)}: element opacity on text is approximated with text transparency.`);
  const runs = textRuns(el.content?.paragraphs ?? [], el, ctx.theme);
  if (el.opacity !== undefined && el.opacity < 1) runs.forEach((r) => { r.options.transparency = Math.max(r.options.transparency ?? 0, Math.round((1 - el.opacity!) * 100)); });
  if (s.gradient) ctx.patches.gradients.push({ name, gradient: gradientPatch(s.gradient, ctx.theme) });
  if (s.gradient && !o.fill) o.fill = { color: 'FFFFFF' };
  if (s.textGradient) ctx.report.partial.add('Gradient text → first gradient color');
  ctx.s.addText(runs.length ? runs : [{ text: '' }], o);
  ctx.patches.textShapes.add(name);
}

function addShape(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const s = el.style ?? {};
  const kind = (el.content?.shape ?? 'rect') as keyof typeof SHAPES;
  let prst: string = SHAPES[kind] ?? 'rect';
  const o: any = { ...geo(el, dx, dy), ...boxStyle(el, ctx.theme), objectName: name, flipH: s.flipH, flipV: s.flipV };
  if ((kind === 'rect' && s.radius) || kind === 'roundRect' || kind === 'pill') {
    prst = 'roundRect';
    const r = kind === 'pill' ? Math.min(el.width, el.height) / 2 : s.radius ?? Math.min(el.width, el.height) * 0.12;
    o.rectRadius = Math.max(0, Math.min(0.5, r / Math.max(1, Math.min(el.width, el.height))));
  }
  const fillC = color(s.fill ?? (s.gradient ? undefined : kind === 'rect' && s.stroke && !s.fill ? undefined : '$primary'), ctx.theme);
  if (fillC) o.fill = { color: fillC.hex, transparency: Math.max(fillC.transparency, el.opacity !== undefined ? Math.round((1 - el.opacity) * 100) : 0) };
  else if (!s.gradient) o.fill = { type: 'none' };
  if (s.gradient) { o.fill = { color: 'FFFFFF' }; ctx.patches.gradients.push({ name, gradient: gradientPatch(s.gradient, ctx.theme) }); }
  if (!s.stroke?.width) o.line = { type: 'none' };
  if (s.blur) ctx.report.partial.add('Glass/backdrop blur → plain translucent fill');
  if (el.link) o.hyperlink = { url: el.link };
  const paragraphs: Paragraph[] | undefined = el.content?.paragraphs;
  if (paragraphs?.length && paragraphs.some((p) => p.runs.some((r) => r.text))) {
    o.shape = prst; o.margin = margin(el); o.valign = s.verticalAlign ?? 'middle'; o.fit = 'none';
    ctx.s.addText(textRuns(paragraphs, el, ctx.theme), o);
    ctx.patches.textShapes.add(name);
  } else ctx.s.addShape(prst, o);
}

function addLine(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const s = el.style ?? {};
  const c = el.content ?? {};
  const x1 = c.x1 + dx, y1 = c.y1 + dy, x2 = c.x2 + dx, y2 = c.y2 + dy;
  const lc = color(s.stroke?.color ?? '$text', ctx.theme, '000000');
  const head = (h?: string) => (h === 'arrow' ? 'arrow' : h === 'triangle' ? 'triangle' : h === 'oval' ? 'oval' : h === 'diamond' ? 'diamond' : undefined);
  ctx.s.addShape('line', {
    x: inch(Math.min(x1, x2)), y: inch(Math.min(y1, y2)), w: inch(Math.max(0.5, Math.abs(x2 - x1))), h: inch(Math.max(0.5, Math.abs(y2 - y1))),
    flipH: x2 < x1, flipV: y2 < y1, objectName: name,
    line: { color: lc?.hex ?? '000000', transparency: lc?.transparency, width: pt(s.stroke?.width ?? 4), dashType: s.stroke?.dash === 'dash' ? 'dash' : s.stroke?.dash === 'dot' ? 'sysDot' : 'solid', beginArrowType: head(s.headStart), endArrowType: head(s.headEnd) ?? (el.type === 'arrow' && !s.headStart ? 'triangle' : undefined) },
  });
}

function addTable(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const c = el.content ?? {};
  const s = el.style ?? {};
  const t = ctx.theme;
  const rows: string[][] = (c.rows ?? []).map((r: unknown[]) => r.map((x) => String(x ?? '')));
  if (!rows.length) return;
  const cols = Math.max(...rows.map((r) => r.length));
  const fs = s.fontSize ?? Math.max(14, Math.min(26, el.height / Math.max(1, rows.length) / 2.4));
  const header = c.header !== false;
  const hdr = color(s.fill ?? '$primary', t, '1F2937');
  const hdrText = color(s.color ?? '#ffffff', t, 'FFFFFF');
  const surface = color('$surface', t, 'F3F4F6');
  const bg = color('$background', t, 'FFFFFF');
  const txt = color('$text', t, '111827');
  const border = color('$border', t, 'E5E7EB');
  const accent = color('$accent', t, 'F59E0B');
  const data = rows.map((r, ri) => Array.from({ length: cols }, (_, ci) => {
    const cell = r[ci] ?? '';
    const isH = header && ri === 0;
    const hl = (c.highlightRows as number[] | undefined)?.includes(ri);
    const num = /^[-+]?[$€£¥₫]?[\d.,]+%?[KMB]?$/.test(cell.trim());
    return {
      text: cell,
      options: {
        bold: isH || hl || (c.firstColumn && ci === 0),
        color: isH ? hdrText?.hex : txt?.hex,
        fill: { color: isH ? hdr?.hex : hl ? accent?.hex : ri % 2 === 0 ? surface?.hex : bg?.hex, transparency: hl ? 75 : 0 },
        align: s.align ?? (num && !isH ? 'right' : 'left'),
        valign: 'middle',
        fontFace: t.fonts.body,
        fontSize: pt(fs),
        border: [{ type: 'none' }, { type: 'none' }, { pt: 0.75, color: border?.hex ?? 'E5E7EB' }, { type: 'none' }],
        margin: [pt(fs * 0.3), pt(fs * 0.6), pt(fs * 0.3), pt(fs * 0.6)],
      },
    };
  }));
  const widths: number[] | undefined = c.columnWidths;
  const total = widths?.reduce((a, b) => a + b, 0);
  const colW = Array.from({ length: cols }, (_, i) => inch(total && widths?.[i] ? (widths[i] / total) * el.width : el.width / cols));
  ctx.s.addTable(data, { x: inch(el.x + dx), y: inch(el.y + dy), w: inch(el.width), colW, rowH: inch(el.height / rows.length), objectName: name, autoPage: false });
  ctx.report.supported.add('Table → native table');
}

/* ------------------------------ native charts ------------------------------ */
function addChart(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string): boolean {
  const c = el.content ?? {};
  const type = c.chartType as keyof typeof CHART_TYPES;
  if (!CHART_TYPES[type] || CHART_TYPES[type].pptx !== 'supported') return false;
  const t = ctx.theme;
  const pptx = ctx.pptx;
  const cats: string[] = c.categories ?? [];
  const palette = c.series.map((_: unknown, i: number) => (color(seriesColor({ c, t }, i), t, '4472C4')?.hex ?? '4472C4'));
  const catPalette = t.colors.chart.map((x) => color(x, t, '4472C4')!.hex);
  const fmt = `${c.valuePrefix ? `"${c.valuePrefix.replace(/"/g, '')}"` : ''}#,##0${c.decimals ? '.' + '0'.repeat(c.decimals) : ''}${c.valueSuffix ? `"${c.valueSuffix.replace(/"/g, '')}"` : ''}`;
  const muted = color('$textMuted', t, '6B7280')!.hex;
  const text = color('$text', t, '111827')!.hex;
  const grid = color('$border', t, 'E5E7EB')!.hex;
  const base: any = {
    x: inch(el.x + dx), y: inch(el.y + dy), w: inch(el.width), h: inch(el.height), objectName: name,
    showLegend: c.showLegend ?? (c.series.length > 1 || type === 'pie' || type === 'donut'), legendPos: ({ top: 't', bottom: 'b', left: 'l', right: 'r' } as Record<string, string>)[c.legendPosition ?? (type === 'pie' || type === 'donut' ? 'right' : 'top')],
    legendFontFace: t.fonts.body, legendFontSize: 11, legendColor: muted,
    showTitle: !!c.title, title: c.title, titleFontFace: t.fonts.heading, titleColor: text, titleFontSize: 16,
    catAxisLabelColor: muted, valAxisLabelColor: muted, catAxisLabelFontFace: t.fonts.body, valAxisLabelFontFace: t.fonts.body, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
    valGridLine: c.showGrid === false ? { style: 'none' } : { color: grid, size: 0.75 }, catGridLine: { style: 'none' },
    catAxisHidden: c.showAxis === false, valAxisHidden: c.showAxis === false,
    valAxisLabelFormatCode: fmt, dataLabelFormatCode: fmt, showValue: !!c.showLabels, dataLabelColor: text, dataLabelFontSize: 10,
    chartColors: palette,
    showCatAxisTitle: !!c.xAxisTitle, catAxisTitle: c.xAxisTitle, showValAxisTitle: !!c.yAxisTitle, valAxisTitle: c.yAxisTitle, catAxisTitleColor: muted, valAxisTitleColor: muted,
  };
  const series = (s: any) => ({ name: s.name, labels: cats, values: (s.values ?? []).map((v: number | null) => (v === null ? null : v)) });
  try {
    switch (type) {
      case 'bar': case 'column': case 'stackedBar':
        ctx.s.addChart(pptx.ChartType.bar, c.series.map(series), { ...base, barDir: type === 'bar' || c.horizontal ? 'bar' : 'col', barGrouping: type === 'stackedBar' || c.stacked ? 'stacked' : 'clustered', barGapWidthPct: 60, ...(type === 'stackedBar' || c.stacked ? { barOverlapPct: 100 } : {}) });
        break;
      case 'line':
        ctx.s.addChart(pptx.ChartType.line, c.series.map(series), { ...base, lineSmooth: !!c.smooth, lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 7 });
        break;
      case 'area':
        ctx.s.addChart(pptx.ChartType.area, c.series.map(series), { ...base, barGrouping: c.stacked ? 'stacked' : 'standard', chartColorsOpacity: 70 });
        break;
      case 'pie': case 'donut':
        ctx.s.addChart(type === 'pie' ? pptx.ChartType.pie : pptx.ChartType.doughnut, [series(c.series[0])], { ...base, chartColors: catPalette, showPercent: c.showLabels ?? true, showValue: false, dataLabelColor: 'FFFFFF', dataLabelFormatCode: '0%', holeSize: 60, dataLabelPosition: type === 'pie' ? 'bestFit' : undefined });
        if (type === 'donut' && c.centerLabel) ctx.report.partial.add('Donut center label → not shown in native chart');
        break;
      case 'radar':
        ctx.s.addChart(pptx.ChartType.radar, c.series.map(series), { ...base, radarStyle: 'marker' });
        break;
      case 'scatter': {
        const pts = c.series.flatMap((s: any) => s.points ?? []);
        const xs = [...new Set(pts.map((p: any) => p.x))] as number[];
        const data = [{ name: 'X', values: xs }, ...c.series.map((s: any) => ({ name: s.name, values: xs.map((x) => (s.points ?? []).find((p: any) => p.x === x)?.y ?? null) }))];
        ctx.s.addChart(pptx.ChartType.scatter, data, { ...base, showValue: false, lineSize: 0, lineDataSymbolSize: 9 });
        break;
      }
      case 'bubble': {
        const pts = c.series.flatMap((s: any) => s.points ?? []);
        const xs = [...new Set(pts.map((p: any) => p.x))] as number[];
        const data = [{ name: 'X', values: xs }, ...c.series.map((s: any) => ({ name: s.name, values: xs.map((x) => (s.points ?? []).find((p: any) => p.x === x)?.y ?? null), sizes: xs.map((x) => (s.points ?? []).find((p: any) => p.x === x)?.size ?? 1) }))];
        ctx.s.addChart(pptx.ChartType.bubble, data, { ...base, showValue: false, chartColorsOpacity: 60 });
        break;
      }
      case 'combo': {
        const types = c.series.map((s: any, i: number) => {
          const k = s.type ?? (i === 0 ? 'bar' : 'line');
          return {
            type: k === 'line' ? pptx.ChartType.line : k === 'area' ? pptx.ChartType.area : pptx.ChartType.bar,
            data: [series(s)],
            options: { chartColors: [palette[i]], barGrouping: 'clustered', secondaryValAxis: s.axis === 'secondary', secondaryCatAxis: s.axis === 'secondary', lineSize: 2.5, lineDataSymbol: 'circle' },
          };
        });
        const hasSecondary = c.series.some((s: any) => s.axis === 'secondary');
        ctx.s.addChart(types, { ...base, ...(hasSecondary ? { valAxes: [{ showValAxisTitle: false, valAxisLabelColor: muted }, { showValAxisTitle: false, valGridLine: { style: 'none' }, valAxisLabelColor: muted }], catAxes: [{ catAxisTitle: c.xAxisTitle }, { catAxisHidden: true }] } : {}) });
        break;
      }
      default:
        return false;
    }
  } catch (e) {
    ctx.report.warnings.push(`${label(ctx, el)}: native chart failed (${(e as Error).message}); exported as shapes.`);
    return false;
  }
  ctx.report.supported.add(`Chart (${CHART_TYPES[type].label}) → native chart`);
  return true;
}

/* ---------------------------- scene → shapes ---------------------------- */
async function addScene(ctx: Ctx, el: SlideElement, scene: Scene, dx: number, dy: number, groupName: string) {
  const ox = el.x + dx, oy = el.y + dy;
  const names: string[] = [];
  const nm = (i: number) => { const n = safeName(`${groupName}/p${i}`); ctx.used.add(n); names.push(n); return n; };
  const fonts = scene.fonts;
  const T = ctx.theme;
  for (let i = 0; i < scene.prims.length; i++) {
    const p = scene.prims[i] as Prim;
    const op = p.opacity;
    const fillOf = (c?: string) => { const f = color(c, T); return f ? { color: f.hex, transparency: Math.max(f.transparency, op !== undefined ? Math.round((1 - op) * 100) : 0) } : { type: 'none' }; };
    const lineOf = (c?: string, w?: number, dash?: boolean) => { const l = color(c, T); return l && w ? { color: l.hex, width: pt(w), transparency: l.transparency, dashType: dash ? 'dash' : 'solid' } : { type: 'none' }; };
    switch (p.k) {
      case 'rect': case 'ellipse': {
        const preset = p.k === 'ellipse' ? 'ellipse' : p.preset && p.preset !== 'rect' ? p.preset : p.r ? 'roundRect' : 'rect';
        const o: any = { x: inch(ox + p.x), y: inch(oy + p.y), w: inch(Math.max(0.5, p.w)), h: inch(Math.max(0.5, p.h)), fill: fillOf(p.fill), line: lineOf(p.stroke, p.sw, p.k === 'rect' ? p.dash : false), objectName: nm(i) };
        if (preset === 'roundRect') o.rectRadius = Math.min(0.5, (p.k === 'rect' ? p.r ?? 0 : 0) / Math.max(1, Math.min(p.w, p.h)));
        if (p.k === 'rect' && p.flipH) o.flipH = true;
        if (p.text) {
          const tc = color(p.textColor ?? '#ffffff', T, 'FFFFFF');
          ctx.s.addText(p.text, { ...o, shape: preset, fontSize: pt(p.fontSize ?? 18), bold: !!p.bold, color: tc?.hex, fontFace: fonts.body, align: 'center', valign: 'middle', margin: [0, pt(6), 0, pt(6)], fit: 'none' });
        } else ctx.s.addShape(preset, o);
        break;
      }
      case 'poly': {
        if (p.pts.length < 2) break;
        const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
        const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(0.5, Math.max(...xs) - x0), h = Math.max(0.5, Math.max(...ys) - y0);
        const closed = p.closed !== false && !!p.fill;
        const points: any[] = p.pts.map((q, k) => ({ x: inch(q[0] - x0), y: inch(q[1] - y0), ...(k === 0 ? { moveTo: true } : {}) }));
        if (closed) points.push({ close: true });
        ctx.s.addShape('custGeom', { x: inch(ox + x0), y: inch(oy + y0), w: inch(w), h: inch(h), points, fill: closed ? fillOf(p.fill) : { type: 'none' }, line: lineOf(p.stroke, p.sw, p.dash), objectName: nm(i) });
        break;
      }
      case 'line': {
        const l = color(p.stroke, T, '000000');
        ctx.s.addShape('line', { x: inch(ox + Math.min(p.x1, p.x2)), y: inch(oy + Math.min(p.y1, p.y2)), w: inch(Math.max(0.3, Math.abs(p.x2 - p.x1))), h: inch(Math.max(0.3, Math.abs(p.y2 - p.y1))), flipH: p.x2 < p.x1, flipV: p.y2 < p.y1, line: { color: l?.hex ?? '000000', transparency: Math.max(l?.transparency ?? 0, op !== undefined ? Math.round((1 - op) * 100) : 0), width: pt(p.sw), dashType: p.dash ? 'dash' : 'solid', endArrowType: p.head === 'triangle' ? 'triangle' : undefined }, objectName: nm(i) });
        break;
      }
      case 'text': {
        const tc = color(p.color, T, '000000');
        const face = p.font === 'heading' ? fonts.heading : p.font === 'mono' ? fonts.mono : fonts.body;
        ctx.s.addText(p.text, { x: inch(ox + p.x), y: inch(oy + p.y), w: inch(Math.max(4, p.w)), h: inch(Math.max(4, p.h)), fontSize: pt(p.size), color: tc?.hex, transparency: Math.max(tc?.transparency ?? 0, op !== undefined ? Math.round((1 - op) * 100) : 0) || undefined, bold: (p.weight ?? 400) >= 600, italic: !!p.italic, fontFace: face, align: p.align ?? 'left', valign: p.valign ?? 'top', margin: 0, fit: 'none', lineSpacingMultiple: p.lineHeight ?? 1.2, objectName: nm(i) });
        break;
      }
      case 'icon': {
        const svg = iconSvgString(p.name, resolveColor(p.color, T, '#000000'), 2, 96);
        await addVector(ctx, svg, ox + p.x, oy + p.y, p.w, p.h, nm(i), 96, 96);
        break;
      }
      default:
        break;
    }
  }
  if (names.length > 1) ctx.patches.groups.push({ name: groupName, childNames: names });
  else if (names.length === 1) ctx.patches.targets.set(el.id, names[0]);
}

async function addVector(ctx: Ctx, svg: string, x: number, y: number, w: number, h: number, name: string, vw?: number, vh?: number, opacity?: number) {
  if (opacity !== undefined && opacity < 1) svg = svg.replace(/<svg\b/, `<svg opacity="${Math.max(0, opacity)}"`);
  const hiFi = ctx.opts.profile === 'highFidelity' && ctx.opts.rasterize;
  if (hiFi) {
    try {
      const png = await ctx.opts.rasterize!(svg, Math.round((vw ?? w) * 2), Math.round((vh ?? h) * 2));
      ctx.s.addImage({ data: png, x: inch(x), y: inch(y), w: inch(w), h: inch(h), objectName: name });
      return;
    } catch { /* fall back to SVG */ }
  }
  ctx.s.addImage({ data: svgDataUrl(svg), x: inch(x), y: inch(y), w: inch(w), h: inch(h), objectName: name });
}

/* ---------------------------------- image ---------------------------------- */
async function imageData(ctx: Ctx, el: SlideElement): Promise<string | null> {
  const resolved = ctx.opts.resolveImage?.(el) ?? null;
  let src: string | undefined = resolved ?? el.content?.src;
  if (src?.startsWith('asset:')) src = ctx.p.assets.find((a) => a.id === src!.slice(6))?.src;
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  if (/^https?:\/\//.test(src) || src.startsWith('/') || src.startsWith('blob:')) {
    if (!ctx.opts.fetchImage) return null;
    try { return await ctx.opts.fetchImage(src); } catch { return null; }
  }
  return null;
}

async function addImage(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const s = el.style ?? {};
  const data = await imageData(ctx, el);
  if (!data) {
    const what = el.content?.query ? `search intent “${el.content.query}”` : el.content?.src ? 'URL could not be downloaded' : 'no source';
    ctx.report.warnings.push(`${label(ctx, el)}: image unavailable (${what}) — exported as an editable placeholder shape. Replace it in PowerPoint or resolve it in the editor before exporting.`);
    const p = color('$primary', ctx.theme, '6366F1')!;
    ctx.s.addText(`Image: ${el.content?.alt ?? el.content?.query ?? 'unavailable'}`, { ...geo(el, dx, dy), shape: s.mask === 'circle' ? 'ellipse' : 'rect', fill: { color: p.hex, transparency: 20 }, color: 'FFFFFF', fontSize: 14, fontFace: ctx.theme.fonts.body, align: 'center', valign: 'middle', objectName: name, line: { type: 'none' } });
    return;
  }
  const o: any = { data, ...geo(el, dx, dy), objectName: name, altText: el.content?.alt ?? el.alt ?? '', flipH: !!s.flipH, flipV: !!s.flipV };
  if (el.opacity !== undefined && el.opacity < 1) o.transparency = Math.round((1 - el.opacity) * 100);
  if (el.link) o.hyperlink = { url: el.link };
  if (data.startsWith('data:image/svg')) {
    ctx.s.addImage(o);
  } else {
    // object-fit cover/contain → srcRect crop (computed from natural size)
    const nat = imageSize(data);
    const patch: ImagePatch = { name };
    if (s.crop) patch.srcRect = { l: s.crop.x, t: s.crop.y, r: Math.max(0, 1 - s.crop.x - s.crop.width), b: Math.max(0, 1 - s.crop.y - s.crop.height) };
    else if (nat && (s.fit ?? 'cover') === 'cover') {
      const ir = nat.w / nat.h, br = el.width / el.height;
      const fx = s.focalX ?? 0.5, fy = s.focalY ?? 0.5;
      if (ir > br) { const keep = br / ir; const l = (1 - keep) * fx; patch.srcRect = { l, r: 1 - keep - l, t: 0, b: 0 }; }
      else if (ir < br) { const keep = ir / br; const t = (1 - keep) * fy; patch.srcRect = { t, b: 1 - keep - t, l: 0, r: 0 }; }
    } else if (nat && s.fit === 'contain') {
      const ir = nat.w / nat.h, br = el.width / el.height;
      if (ir > br) { const h = el.width / ir; o.y = inch(el.y + dy + (el.height - h) / 2); o.h = inch(h); }
      else { const w = el.height * ir; o.x = inch(el.x + dx + (el.width - w) / 2); o.w = inch(w); }
    } else if (!nat && (s.fit ?? 'cover') === 'cover') ctx.report.info.push(`${label(ctx, el)}: image size unknown — exported stretched to its frame.`);
    if (s.mask === 'circle') patch.prst = 'ellipse';
    else if (s.mask === 'hexagon') patch.prst = 'hexagon';
    else if (s.mask === 'diamond') patch.prst = 'diamond';
    else if (s.mask === 'rounded' || (s.radius && s.radius > 0)) patch.prst = 'roundRect';
    else if (s.mask === 'arch' || s.mask === 'blob') { patch.prst = 'roundRect'; ctx.report.partial.add(`Image mask "${s.mask}" → rounded rectangle`); }
    ctx.patches.images.push(patch);
    ctx.s.addImage(o);
  }
  ctx.report.supported.add('Image → native picture');
  if (s.overlay) {
    const oc = color(s.overlay.color, ctx.theme, '000000')!;
    ctx.s.addShape('rect', { ...geo(el, dx, dy), fill: { color: oc.hex, transparency: Math.round((1 - s.overlay.opacity) * 100) }, line: { type: 'none' }, objectName: safeName(`${name}/overlay`) });
  }
  if (s.grayscale || s.brightness !== undefined) ctx.report.partial.add('Image filters (grayscale/brightness) → not exported');
}

/* ---------------------------------- media ---------------------------------- */
function youtubeId(url: string): string | null {
  const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  return m ? m[1] : null;
}
async function addMedia(ctx: Ctx, el: SlideElement, dx: number, dy: number, name: string) {
  const src = String(el.content?.src ?? '');
  const yt = youtubeId(src);
  const g = geo(el, dx, dy);
  if (yt && el.type === 'video') {
    ctx.s.addMedia({ type: 'online', link: `https://www.youtube.com/embed/${yt}`, ...g, objectName: name });
    ctx.report.partial.add('YouTube video → online video (requires internet & PowerPoint 2013+)');
    return;
  }
  let data: string | null = src.startsWith('data:') ? src : null;
  if (!data && /^https?:/.test(src) && ctx.opts.fetchImage) { try { data = await ctx.opts.fetchImage(src); } catch { data = null; } }
  const m = data ? /^data:(audio|video)\/([\w.+-]+);base64,/.exec(data) : null;
  if (data && m) {
    const extn = m[2] === 'mpeg' ? 'mp3' : m[2] === 'x-wav' ? 'wav' : m[2];
    ctx.s.addMedia({ type: m[1] as 'audio' | 'video', data, extn, ...g, objectName: name });
    ctx.report.supported.add(`${m[1] === 'audio' ? 'Audio' : 'Video'} file → embedded media`);
    return;
  }
  ctx.report.warnings.push(`${label(ctx, el)}: ${el.type} could not be embedded — exported as a linked placeholder.`);
  ctx.s.addText(`▶ ${el.content?.title ?? (el.type === 'audio' ? 'Audio' : 'Video')}`, { ...g, shape: 'rect', fill: { color: '111111' }, color: 'FFFFFF', fontSize: 18, align: 'center', valign: 'middle', hyperlink: /^https?:/.test(src) ? { url: src } : undefined, objectName: name });
}

/* ------------------------------- dispatcher ------------------------------- */
export async function addElement(ctx: Ctx, el: SlideElement, dx = 0, dy = 0, forcedName?: string): Promise<void> {
  if (el.visible === false) { ctx.report.info.push(`${label(ctx, el)}: hidden element not exported.`); return; }
  const name = forcedName ?? objectName(ctx, el);
  ctx.patches.targets.set(el.id, name);
  const t = ctx.theme;
  switch (el.type) {
    case 'text': case 'heading': case 'paragraph': case 'richText':
      addText(ctx, el, dx, dy, name); ctx.report.supported.add('Text → native text box'); break;
    case 'shape':
      addShape(ctx, el, dx, dy, name); ctx.report.supported.add('Shape → native shape'); break;
    case 'line': case 'arrow':
      addLine(ctx, el, dx, dy, name); ctx.report.supported.add('Line/Arrow → native line'); break;
    case 'table':
      addTable(ctx, el, dx, dy, name); break;
    case 'image':
      await addImage(ctx, el, dx, dy, name); break;
    case 'chart':
      if (!addChart(ctx, el, dx, dy, name)) {
        await addScene(ctx, el, buildChartScene(el.content, t, el.width, el.height), dx, dy, name);
        ctx.report.partial.add(`Chart (${CHART_TYPES[el.content?.chartType as keyof typeof CHART_TYPES]?.label ?? el.content?.chartType}) → editable native shapes (no native PowerPoint chart type)`);
      }
      break;
    case 'diagram': case 'smartart':
      await addScene(ctx, el, buildDiagramScene(el.content, t, el.width, el.height), dx, dy, name); ctx.report.supported.add('Diagram → grouped native shapes'); break;
    case 'timeline':
      await addScene(ctx, el, buildTimelineScene(el.content, t, el.width, el.height), dx, dy, name); ctx.report.supported.add('Timeline → grouped native shapes'); break;
    case 'infographic':
      await addScene(ctx, el, buildInfographicScene(el.content, t, el.width, el.height), dx, dy, name); ctx.report.supported.add('Infographic → grouped native shapes'); break;
    case 'icon': {
      const s = el.style ?? {};
      const size = Math.min(el.width, el.height);
      const fill = color(s.fill, t);
      if (fill) ctx.s.addShape('ellipse', { ...geo(el, dx, dy), fill: { color: fill.hex, transparency: fill.transparency }, line: { type: 'none' }, objectName: safeName(`${name}/bg`) });
      const inner = fill ? size * 0.56 : size;
      const svg = iconSvgString(el.content?.name ?? 'circle', resolveColor(s.color ?? '$primary', t, '#000000'), s.strokeWidth ?? 2, 96);
      await addVector(ctx, svg, el.x + dx + (el.width - inner) / 2, el.y + dy + (el.height - inner) / 2, inner, inner, fill ? safeName(`${name}/glyph`) : name, 96, 96);
      if (fill) ctx.patches.groups.push({ name, childNames: [safeName(`${name}/bg`), safeName(`${name}/glyph`)] });
      ctx.report.supported.add('Icon → SVG picture');
      break;
    }
    case 'svg': {
      const markup = String(el.content?.markup ?? '');
      const clean = markup.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
      const withNs = /xmlns=/.test(clean) ? clean : clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      await addVector(ctx, withNs, el.x + dx, el.y + dy, el.width, el.height, name);
      ctx.report.supported.add('SVG → SVG picture');
      break;
    }
    case 'decorative':
      await addVector(ctx, decorSvg(el.content?.kind, Math.round(el.width), Math.round(el.height), el.content?.colors, t, el.content?.seed ?? 7, el.id), el.x + dx, el.y + dy, el.width, el.height, name, undefined, undefined, el.opacity);
      ctx.report.partial.add('Decorative visuals → vector picture (not editable shapes)');
      break;
    case 'visual3d':
      await addVector(ctx, visual3dSvg(el.content?.kind, Math.round(el.width), Math.round(el.height), el.content?.colors, el.content?.items, t, el.id), el.x + dx, el.y + dy, el.width, el.height, name, undefined, undefined, el.opacity);
      ctx.report.partial.add('3D-like visuals → vector picture (not editable shapes)');
      break;
    case 'formula': {
      const latex = String(el.content?.latex ?? '');
      const fs = el.style?.fontSize ?? 48;
      const col = resolveColor(el.style?.color ?? '$text', t, '#000000');
      let png: string | null = null;
      if (ctx.opts.renderFormula) { try { png = await ctx.opts.renderFormula(latex, { color: col, fontSize: fs }); } catch { png = null; } }
      if (png) {
        const nat = imageSize(png);
        let { width: w, height: h } = el;
        if (nat) { const k = Math.min(el.width / nat.w, el.height / nat.h); w = nat.w * k; h = nat.h * k; }
        ctx.s.addImage({ data: png, x: inch(el.x + dx + (el.width - w) / 2), y: inch(el.y + dy + (el.height - h) / 2), w: inch(w), h: inch(h), altText: `LaTeX: ${latex}`, objectName: name });
        ctx.report.partial.add('Formula → high-resolution picture (LaTeX kept in alt text)');
      } else {
        ctx.s.addText(latex, { ...geo(el, dx, dy), fontFace: 'Cambria Math', fontSize: pt(Math.min(fs, 40)), color: color(col, t, '000000')?.hex, align: 'center', valign: 'middle', objectName: name, fit: 'none' });
        ctx.report.warnings.push(`${label(ctx, el)}: formula exported as LaTeX source text (renderer unavailable in this environment).`);
        ctx.patches.textShapes.add(name);
      }
      break;
    }
    case 'code': {
      const runs = codeRuns(el, t);
      const dark = el.style?.variant ? el.style.variant !== 'light' : true;
      ctx.s.addText(runs, { ...geo(el, dx, dy), fill: { color: dark ? '0D1117' : 'F6F8FA' }, fontFace: t.fonts.mono, fontSize: pt(el.style?.fontSize ?? 22), valign: 'top', margin: pt((el.style?.fontSize ?? 22) * 0.8), objectName: name, fit: 'none', rectRadius: 0.04, shape: 'roundRect', lineSpacingMultiple: 1.2 });
      ctx.patches.textShapes.add(name);
      ctx.report.supported.add('Code block → native text box with syntax colors');
      break;
    }
    case 'video': case 'audio':
      await addMedia(ctx, el, dx, dy, name); break;
    case 'group': {
      const kids = (el.content?.children ?? []) as SlideElement[];
      const childNames: string[] = [];
      for (const c of [...kids].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
        const n = objectName(ctx, { id: `${el.id}.${c.id}`, type: c.type });
        await addElement(ctx, c, el.x + dx, el.y + dy, n);
        childNames.push(n);
      }
      if (childNames.length) ctx.patches.groups.push({ name, childNames });
      ctx.report.supported.add('Group → native group');
      break;
    }
    default:
      ctx.report.unsupported.add(`Element type "${el.type}"`);
  }
  if (el.rotation && ['chart', 'diagram', 'smartart', 'timeline', 'infographic', 'table', 'group'].includes(el.type)) ctx.report.partial.add(`Rotation on ${el.type} → not exported`);
}

export { formatNumber };
