import type { ChartContent, Theme } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { formatNumber } from '@/utils/misc';
import { textWidth } from '@/utils/richtext';
import { withAlpha } from '@/utils/color';
import { arcPoints, niceScale, ringSlice, type Prim, type Scene } from './scene';

interface Ctx { c: ChartContent; t: Theme; w: number; h: number; fs: number; prims: Prim[]; muted: string; grid: string; text: string; font: string }

export function seriesColor(ctx: { c: ChartContent; t: Theme }, i: number): string {
  const s = ctx.c.series[i];
  const pal = ctx.t.colors.chart;
  return resolveColor(s?.color, ctx.t, pal[i % pal.length]);
}
function catColor(ctx: Ctx, i: number): string {
  const pal = ctx.t.colors.chart;
  return pal[i % pal.length];
}
const fmt = (ctx: Ctx, v: number | null | undefined) => formatNumber(v, { prefix: ctx.c.valuePrefix, suffix: ctx.c.valueSuffix, decimals: ctx.c.decimals });

/** Header (title + legend), returns top y of the plot area. */
function header(ctx: Ctx, legend: { label: string; color: string }[]): number {
  let y = 0;
  const { c, w, fs } = ctx;
  if (c.title) {
    ctx.prims.push({ k: 'text', x: 0, y, w, h: fs * 1.6, text: c.title, size: fs * 1.15, color: ctx.text, weight: 700, font: 'heading' });
    y += fs * 1.9;
  }
  const show = c.showLegend ?? legend.length > 1;
  if (show && legend.length && (c.legendPosition ?? 'top') !== 'right') {
    let x = 0;
    let row = 0;
    legend.forEach((l) => {
      const lw = textWidth(l.label, fs * 0.85, ctx.font) + fs * 2.2;
      if (x + lw > w && x > 0) { x = 0; row++; }
      ctx.prims.push({ k: 'rect', x, y: y + row * fs * 1.6 + fs * 0.25, w: fs * 0.8, h: fs * 0.8, r: fs * 0.2, fill: l.color });
      ctx.prims.push({ k: 'text', x: x + fs * 1.15, y: y + row * fs * 1.6, w: lw, h: fs * 1.4, text: l.label, size: fs * 0.85, color: ctx.muted, weight: 500 });
      x += lw;
    });
    y += (row + 1) * fs * 1.6 + fs * 0.6;
  }
  return y;
}

function rightLegend(ctx: Ctx, legend: { label: string; color: string }[], x: number, y: number): void {
  legend.forEach((l, i) => {
    const yy = y + i * ctx.fs * 1.7;
    ctx.prims.push({ k: 'ellipse', x, y: yy + ctx.fs * 0.25, w: ctx.fs * 0.8, h: ctx.fs * 0.8, fill: l.color });
    ctx.prims.push({ k: 'text', x: x + ctx.fs * 1.2, y: yy, w: ctx.w - x - ctx.fs * 1.2, h: ctx.fs * 1.4, text: l.label, size: ctx.fs * 0.85, color: ctx.muted });
  });
}

function catmull(pts: [number, number][], samples = 8): [number, number][] {
  if (pts.length < 3) return pts;
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* ------------------------- Cartesian (bar/col/line/area/combo) ------------------------- */
function cartesian(ctx: Ctx, top: number) {
  const { c, w, h, fs } = ctx;
  const cats = c.categories ?? [];
  const horizontal = c.chartType === 'bar' || (c.chartType === 'stackedBar' && c.horizontal);
  const stacked = c.chartType === 'stackedBar' || !!c.stacked;
  const series = c.series;
  const kindOf = (i: number) => (c.chartType === 'combo' ? series[i].type ?? (i === 0 ? 'bar' : 'line') : c.chartType === 'line' ? 'line' : c.chartType === 'area' ? 'area' : 'bar');
  const secondary = c.chartType === 'combo' && series.some((s) => s.axis === 'secondary');
  const primIdx = series.map((_, i) => i).filter((i) => !(secondary && series[i].axis === 'secondary'));
  const secIdx = series.map((_, i) => i).filter((i) => secondary && series[i].axis === 'secondary');
  const range = (idx: number[]) => {
    let lo = 0, hi = 0;
    if (stacked) {
      cats.forEach((_, ci) => {
        let pos = 0, neg = 0;
        idx.forEach((si) => { const v = series[si].values?.[ci] ?? 0; if ((v ?? 0) >= 0) pos += v ?? 0; else neg += v ?? 0; });
        hi = Math.max(hi, pos); lo = Math.min(lo, neg);
      });
    } else idx.forEach((si) => (series[si].values ?? []).forEach((v) => { if (v !== null && v !== undefined) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }));
    if (kindOf(idx[0] ?? 0) !== 'bar' && lo > 0 && !stacked) lo = Math.max(0, lo - (hi - lo) * 0.25);
    return niceScale(lo, hi, 5);
  };
  const s1 = range(primIdx);
  const s2 = secIdx.length ? range(secIdx) : null;
  const showAxis = c.showAxis !== false;
  const labelW = showAxis ? Math.max(...[s1.min, s1.max].map((v) => textWidth(fmt(ctx, v), fs * 0.8, ctx.font))) + fs * 0.8 : 0;
  const catLabelW = horizontal && showAxis ? Math.min(w * 0.3, Math.max(...cats.map((cc) => textWidth(cc, fs * 0.85, ctx.font))) + fs) : 0;
  const left = horizontal ? catLabelW : labelW;
  const right = s2 ? labelW : fs * 0.5;
  const bottom = showAxis ? fs * (horizontal ? 1.8 : 2.2) + (c.xAxisTitle ? fs * 1.4 : 0) : fs * 0.5;
  const px = left, py = top + fs * 0.4, pw = Math.max(10, w - left - right), ph = Math.max(10, h - py - bottom);
  const val = (v: number, s = s1) => (horizontal ? px + ((v - s.min) / (s.max - s.min)) * pw : py + ph - ((v - s.min) / (s.max - s.min)) * ph);
  // grid & axis labels
  for (let v = s1.min; v <= s1.max + 1e-9; v += s1.step) {
    const p = val(v);
    if (c.showGrid !== false) ctx.prims.push(horizontal ? { k: 'line', x1: p, y1: py, x2: p, y2: py + ph, stroke: ctx.grid, sw: 1.5 } : { k: 'line', x1: px, y1: p, x2: px + pw, y2: p, stroke: ctx.grid, sw: 1.5 });
    if (showAxis) ctx.prims.push(horizontal ? { k: 'text', x: p - 60, y: py + ph + fs * 0.4, w: 120, h: fs * 1.3, text: fmt(ctx, v), size: fs * 0.8, color: ctx.muted, align: 'center' } : { k: 'text', x: 0, y: p - fs * 0.6, w: labelW - fs * 0.5, h: fs * 1.2, text: fmt(ctx, v), size: fs * 0.8, color: ctx.muted, align: 'right' });
  }
  if (s2 && showAxis) for (let v = s2.min; v <= s2.max + 1e-9; v += s2.step) ctx.prims.push({ k: 'text', x: px + pw + fs * 0.4, y: val(v, s2) - fs * 0.6, w: labelW, h: fs * 1.2, text: fmt(ctx, v), size: fs * 0.8, color: ctx.muted });
  const zero = val(Math.max(s1.min, Math.min(0, s1.max)));
  ctx.prims.push(horizontal ? { k: 'line', x1: zero, y1: py, x2: zero, y2: py + ph, stroke: ctx.muted, sw: 2 } : { k: 'line', x1: px, y1: zero, x2: px + pw, y2: zero, stroke: ctx.muted, sw: 2, opacity: 0.6 });
  const n = Math.max(1, cats.length);
  const band = (horizontal ? ph : pw) / n;
  if (showAxis) cats.forEach((cat, ci) => {
    const center = (horizontal ? py : px) + band * (ci + 0.5);
    if (horizontal) ctx.prims.push({ k: 'text', x: 0, y: center - fs * 0.65, w: catLabelW - fs * 0.6, h: fs * 1.3, text: cat, size: fs * 0.85, color: ctx.text, align: 'right', weight: 500 });
    else ctx.prims.push({ k: 'text', x: center - band / 2, y: py + ph + fs * 0.45, w: band, h: fs * 1.4, text: cat, size: Math.min(fs * 0.85, (band / Math.max(1, cat.length)) * 1.9), color: ctx.muted, align: 'center' });
  });
  if (c.xAxisTitle) ctx.prims.push({ k: 'text', x: px, y: h - fs * 1.3, w: pw, h: fs * 1.3, text: c.xAxisTitle, size: fs * 0.8, color: ctx.muted, align: 'center', weight: 600 });
  if (c.yAxisTitle) ctx.prims.push({ k: 'text', x: 0, y: top - fs * 0.2, w: pw, h: fs * 1.2, text: c.yAxisTitle, size: fs * 0.75, color: ctx.muted, weight: 600 });
  // bars
  const barSeries = series.map((_, i) => i).filter((i) => kindOf(i) === 'bar');
  const groups = stacked ? 1 : Math.max(1, barSeries.length);
  const groupW = band * (groups > 1 ? 0.78 : 0.6);
  const bw = groupW / groups;
  const stackPos = cats.map(() => 0), stackNeg = cats.map(() => 0);
  barSeries.forEach((si, bi) => {
    const color = seriesColor(ctx, si);
    (series[si].values ?? []).forEach((v, ci) => {
      if (v === null || v === undefined) return;
      const s = series[si].axis === 'secondary' && s2 ? s2 : s1;
      let a0 = 0, a1 = v;
      if (stacked) { if (v >= 0) { a0 = stackPos[ci]; stackPos[ci] += v; a1 = stackPos[ci]; } else { a0 = stackNeg[ci]; stackNeg[ci] += v; a1 = stackNeg[ci]; } }
      const b0 = (horizontal ? py : px) + band * ci + (band - groupW) / 2 + (stacked ? 0 : bi * bw);
      const p0 = val(a0, s), p1 = val(a1, s);
      const gap = groups > 1 ? Math.min(6, bw * 0.12) : 0;
      const r = Math.min(8, bw * 0.18);
      if (horizontal) ctx.prims.push({ k: 'rect', x: Math.min(p0, p1), y: b0 + gap / 2, w: Math.abs(p1 - p0), h: bw - gap, r: stacked ? 0 : r, fill: color });
      else ctx.prims.push({ k: 'rect', x: b0 + gap / 2, y: Math.min(p0, p1), w: bw - gap, h: Math.abs(p1 - p0), r: stacked ? 0 : r, fill: color });
      if (c.showLabels && !stacked) {
        const label = fmt(ctx, v);
        if (horizontal) ctx.prims.push({ k: 'text', x: Math.max(p0, p1) + fs * 0.3, y: b0 + bw / 2 - fs * 0.6, w: 200, h: fs * 1.2, text: label, size: fs * 0.8, color: ctx.text, weight: 600 });
        else ctx.prims.push({ k: 'text', x: b0 - 40, y: Math.min(p0, p1) - fs * 1.35, w: bw + 80, h: fs * 1.2, text: label, size: Math.min(fs * 0.8, bw * 0.45 + 8), color: ctx.text, weight: 600, align: 'center' });
      } else if (c.showLabels && stacked && Math.abs(p1 - p0) > fs * 1.2) {
        if (horizontal) ctx.prims.push({ k: 'text', x: Math.min(p0, p1), y: b0 + bw / 2 - fs * 0.6, w: Math.abs(p1 - p0), h: fs * 1.2, text: fmt(ctx, v), size: fs * 0.75, color: '#ffffff', weight: 600, align: 'center' });
        else ctx.prims.push({ k: 'text', x: b0, y: (p0 + p1) / 2 - fs * 0.6, w: bw, h: fs * 1.2, text: fmt(ctx, v), size: fs * 0.75, color: '#ffffff', weight: 600, align: 'center' });
      }
    });
  });
  // lines / areas
  series.forEach((sr, si) => {
    const k = kindOf(si);
    if (k === 'bar') return;
    const s = sr.axis === 'secondary' && s2 ? s2 : s1;
    const color = seriesColor(ctx, si);
    const pts: [number, number][] = [];
    (sr.values ?? []).forEach((v, ci) => { if (v !== null && v !== undefined) pts.push([px + band * (ci + 0.5), val(stacked && k === 'area' ? v : v, s)]); });
    if (!pts.length) return;
    const path = c.smooth ? catmull(pts) : pts;
    if (k === 'area') ctx.prims.push({ k: 'poly', pts: [[path[0][0], zero], ...path, [path[path.length - 1][0], zero]], fill: withAlpha(color, 0.22), closed: true });
    ctx.prims.push({ k: 'poly', pts: path, stroke: color, sw: Math.max(3, fs * 0.2), closed: false });
    pts.forEach((p, pi) => {
      ctx.prims.push({ k: 'ellipse', x: p[0] - fs * 0.32, y: p[1] - fs * 0.32, w: fs * 0.64, h: fs * 0.64, fill: ctx.t.colors.background, stroke: color, sw: 3 });
      if (c.showLabels) ctx.prims.push({ k: 'text', x: p[0] - 60, y: p[1] - fs * 1.6, w: 120, h: fs * 1.2, text: fmt(ctx, (sr.values ?? []).filter((v) => v !== null)[pi] as number), size: fs * 0.78, color: ctx.text, weight: 600, align: 'center' });
    });
  });
}

/* -------------------------------- Pie / Donut -------------------------------- */
function pie(ctx: Ctx, top: number, donut: boolean) {
  const { c, w, h, fs } = ctx;
  const vals = (c.series[0]?.values ?? []).map((v) => Math.max(0, v ?? 0));
  const cats = c.categories ?? vals.map((_, i) => `Item ${i + 1}`);
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const legendW = c.showLegend === false ? 0 : Math.min(w * 0.38, Math.max(...cats.map((cc) => textWidth(cc, fs * 0.85, ctx.font))) + fs * 5);
  const size = Math.min(w - legendW - fs, h - top - fs * 0.5);
  const cx = (w - legendW) / 2, cy = top + (h - top) / 2;
  const r1 = size / 2, r0 = donut ? r1 * 0.6 : 0;
  let a = -Math.PI / 2;
  vals.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    if (sweep <= 0) return;
    ctx.prims.push({ k: 'poly', pts: ringSlice(cx, cy, r0, r1, a, a + sweep), fill: c.series[0]?.color && vals.length === 1 ? seriesColor(ctx, 0) : catColor(ctx, i), stroke: ctx.t.colors.background, sw: 3, closed: true });
    if ((c.showLabels ?? true) && sweep > 0.3) {
      const mid = a + sweep / 2, rr = donut ? (r0 + r1) / 2 : r1 * 0.66;
      ctx.prims.push({ k: 'text', x: cx + Math.cos(mid) * rr - 60, y: cy + Math.sin(mid) * rr - fs * 0.65, w: 120, h: fs * 1.3, text: `${Math.round((v / total) * 100)}%`, size: fs * 0.9, color: '#ffffff', weight: 700, align: 'center' });
    }
    a += sweep;
  });
  if (donut) {
    const label = c.centerLabel ?? fmt(ctx, vals.reduce((x, y) => x + y, 0));
    ctx.prims.push({ k: 'text', x: cx - r0, y: cy - fs * 1.4, w: r0 * 2, h: fs * 2.8, text: label, size: Math.min(fs * 2, r0 * 0.5), color: ctx.text, weight: 700, align: 'center', valign: 'middle', font: 'heading' });
  }
  if (legendW) rightLegend(ctx, cats.map((cc, i) => ({ label: `${cc} · ${fmt(ctx, vals[i])}`, color: catColor(ctx, i) })), w - legendW + fs, cy - (cats.length * fs * 1.7) / 2);
}

/* ------------------------------ Scatter / Bubble ------------------------------ */
function scatter(ctx: Ctx, top: number, bubble: boolean) {
  const { c, w, h, fs } = ctx;
  const all = c.series.flatMap((s) => s.points ?? []);
  if (!all.length) return;
  const sx = niceScale(Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x)), 5);
  const sy = niceScale(Math.min(0, ...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)), 5);
  const maxSize = Math.max(...all.map((p) => p.size ?? 1));
  const left = fs * 3.2, bottom = fs * 2.2 + (c.xAxisTitle ? fs * 1.4 : 0);
  const px = left, py = top + fs * 0.5, pw = w - left - fs, ph = h - py - bottom;
  const X = (v: number) => px + ((v - sx.min) / (sx.max - sx.min)) * pw;
  const Y = (v: number) => py + ph - ((v - sy.min) / (sy.max - sy.min)) * ph;
  for (let v = sy.min; v <= sy.max + 1e-9; v += sy.step) {
    ctx.prims.push({ k: 'line', x1: px, y1: Y(v), x2: px + pw, y2: Y(v), stroke: ctx.grid, sw: 1.5 });
    ctx.prims.push({ k: 'text', x: 0, y: Y(v) - fs * 0.6, w: left - fs * 0.5, h: fs * 1.2, text: formatNumber(v), size: fs * 0.8, color: ctx.muted, align: 'right' });
  }
  for (let v = sx.min; v <= sx.max + 1e-9; v += sx.step) ctx.prims.push({ k: 'text', x: X(v) - 50, y: py + ph + fs * 0.4, w: 100, h: fs * 1.2, text: formatNumber(v), size: fs * 0.8, color: ctx.muted, align: 'center' });
  ctx.prims.push({ k: 'line', x1: px, y1: py + ph, x2: px + pw, y2: py + ph, stroke: ctx.muted, sw: 2, opacity: 0.6 });
  if (c.xAxisTitle) ctx.prims.push({ k: 'text', x: px, y: h - fs * 1.3, w: pw, h: fs * 1.3, text: c.xAxisTitle, size: fs * 0.8, color: ctx.muted, align: 'center', weight: 600 });
  if (c.yAxisTitle) ctx.prims.push({ k: 'text', x: px, y: top - fs * 0.6, w: pw, h: fs * 1.2, text: c.yAxisTitle, size: fs * 0.75, color: ctx.muted, weight: 600 });
  c.series.forEach((s, si) => {
    const color = seriesColor(ctx, si);
    (s.points ?? []).forEach((p) => {
      const r = bubble ? fs * 0.6 + Math.sqrt((p.size ?? 1) / maxSize) * Math.min(pw, ph) * 0.09 : fs * 0.42;
      ctx.prims.push({ k: 'ellipse', x: X(p.x) - r, y: Y(p.y) - r, w: r * 2, h: r * 2, fill: withAlpha(color, bubble ? 0.55 : 0.85), stroke: color, sw: 2 });
      if (p.label && (c.showLabels ?? bubble)) ctx.prims.push({ k: 'text', x: X(p.x) - 100, y: Y(p.y) - r - fs * 1.3, w: 200, h: fs * 1.2, text: p.label, size: fs * 0.75, color: ctx.text, align: 'center', weight: 600 });
    });
  });
}

/* ---------------------------------- Radar ---------------------------------- */
function radar(ctx: Ctx, top: number) {
  const { c, w, h, fs } = ctx;
  const cats = c.categories ?? [];
  const n = Math.max(3, cats.length);
  const max = niceScale(0, Math.max(...c.series.flatMap((s) => (s.values ?? []).map((v) => v ?? 0))), 4);
  const r = Math.min(w, h - top) / 2 - fs * 3.2;
  const cx = w / 2, cy = top + (h - top) / 2;
  const pt = (i: number, v: number): [number, number] => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; };
  for (let k = 1; k <= 4; k++) ctx.prims.push({ k: 'poly', pts: Array.from({ length: n + 1 }, (_, i) => pt(i % n, k / 4)), stroke: ctx.grid, sw: 1.5, closed: false });
  cats.forEach((cat, i) => {
    const [x, y] = pt(i, 1);
    ctx.prims.push({ k: 'line', x1: cx, y1: cy, x2: x, y2: y, stroke: ctx.grid, sw: 1.5 });
    const [lx, ly] = pt(i, 1.16);
    ctx.prims.push({ k: 'text', x: lx - 110, y: ly - fs * 0.7, w: 220, h: fs * 1.4, text: cat, size: fs * 0.82, color: ctx.text, align: 'center', weight: 500 });
  });
  c.series.forEach((s, si) => {
    const color = seriesColor(ctx, si);
    const pts = (s.values ?? []).map((v, i) => pt(i, (v ?? 0) / max.max));
    ctx.prims.push({ k: 'poly', pts, fill: withAlpha(color, 0.2), stroke: color, sw: 3, closed: true });
    pts.forEach((p) => ctx.prims.push({ k: 'ellipse', x: p[0] - 5, y: p[1] - 5, w: 10, h: 10, fill: color }));
  });
}

/* --------------------------------- Waterfall --------------------------------- */
function waterfall(ctx: Ctx, top: number) {
  const { c, w, h, fs } = ctx;
  const cats = c.categories ?? [];
  const vals = (c.series[0]?.values ?? []).map((v) => v ?? 0);
  const totals = new Set(c.totals ?? []);
  let run = 0;
  const bars = vals.map((v, i) => {
    if (totals.has(i)) { const b = { a: 0, b: v, total: true, v }; run = v; return b; }
    const b = { a: run, b: run + v, total: false, v };
    run += v;
    return b;
  });
  const lo = Math.min(0, ...bars.map((b) => Math.min(b.a, b.b))), hi = Math.max(...bars.map((b) => Math.max(b.a, b.b)));
  const s = niceScale(lo, hi, 5);
  const left = Math.max(...[s.min, s.max].map((v) => textWidth(fmt(ctx, v), fs * 0.8, ctx.font))) + fs;
  const px = left, py = top + fs, pw = w - left - fs * 0.5, ph = h - py - fs * 2.4;
  const Y = (v: number) => py + ph - ((v - s.min) / (s.max - s.min)) * ph;
  for (let v = s.min; v <= s.max + 1e-9; v += s.step) {
    ctx.prims.push({ k: 'line', x1: px, y1: Y(v), x2: px + pw, y2: Y(v), stroke: ctx.grid, sw: 1.5 });
    ctx.prims.push({ k: 'text', x: 0, y: Y(v) - fs * 0.6, w: left - fs * 0.5, h: fs * 1.2, text: fmt(ctx, v), size: fs * 0.8, color: ctx.muted, align: 'right' });
  }
  const band = pw / Math.max(1, bars.length);
  const up = resolveColor('$success', ctx.t, '#16a34a'), down = resolveColor('$danger', ctx.t, '#dc2626'), tot = ctx.t.colors.primary;
  bars.forEach((b, i) => {
    const x = px + band * i + band * 0.18, bw = band * 0.64;
    const color = b.total ? tot : b.v >= 0 ? up : down;
    ctx.prims.push({ k: 'rect', x, y: Math.min(Y(b.a), Y(b.b)), w: bw, h: Math.max(2, Math.abs(Y(b.a) - Y(b.b))), r: 4, fill: color });
    ctx.prims.push({ k: 'text', x: x - 30, y: Math.min(Y(b.a), Y(b.b)) - fs * 1.3, w: bw + 60, h: fs * 1.2, text: (b.total || b.v < 0 ? '' : '+') + fmt(ctx, b.v), size: fs * 0.78, color: ctx.text, weight: 600, align: 'center' });
    ctx.prims.push({ k: 'text', x: px + band * i, y: py + ph + fs * 0.5, w: band, h: fs * 1.3, text: cats[i] ?? '', size: fs * 0.8, color: ctx.muted, align: 'center' });
    if (i < bars.length - 1) ctx.prims.push({ k: 'line', x1: x + bw, y1: Y(b.b), x2: x + band, y2: Y(b.b), stroke: ctx.muted, sw: 1.5, dash: true, opacity: 0.7 });
  });
}

/* ---------------------------------- Funnel ---------------------------------- */
function funnelChart(ctx: Ctx, top: number) {
  const { c, w, h, fs } = ctx;
  const vals = (c.series[0]?.values ?? []).map((v) => v ?? 0);
  const cats = c.categories ?? [];
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const gap = fs * 0.35;
  const sh = (h - top - gap * (n - 1)) / n;
  const labelW = w * 0.3;
  const fw = w - labelW;
  vals.forEach((v, i) => {
    const w0 = (v / max) * fw * 0.98, w1 = ((vals[i + 1] ?? v * 0.85) / max) * fw * 0.98;
    const y = top + i * (sh + gap);
    const cx = fw / 2;
    ctx.prims.push({ k: 'poly', pts: [[cx - w0 / 2, y], [cx + w0 / 2, y], [cx + Math.max(w1, w0 * 0.6) / 2, y + sh], [cx - Math.max(w1, w0 * 0.6) / 2, y + sh]], fill: catColor(ctx, i), closed: true });
    ctx.prims.push({ k: 'text', x: cx - fw / 2, y, w: fw, h: sh, text: fmt(ctx, v), size: Math.min(fs * 1.1, sh * 0.42), color: '#ffffff', weight: 700, align: 'center', valign: 'middle' });
    const conv = i > 0 && vals[i - 1] ? ` · ${Math.round((v / vals[i - 1]) * 100)}%` : '';
    ctx.prims.push({ k: 'text', x: fw + fs, y, w: labelW - fs, h: sh, text: `${cats[i] ?? ''}${conv}`, size: Math.min(fs * 0.95, sh * 0.38), color: ctx.text, weight: 600, valign: 'middle' });
  });
}

/* --------------------------------- Histogram --------------------------------- */
function histogram(ctx: Ctx, top: number) {
  const { c } = ctx;
  const raw = (c.series[0]?.values ?? []).filter((v): v is number => typeof v === 'number');
  const bins = c.bins ?? Math.max(4, Math.min(14, Math.ceil(Math.sqrt(raw.length))));
  const lo = Math.min(...raw), hi = Math.max(...raw);
  const step = (hi - lo) / bins || 1;
  const counts = Array.from({ length: bins }, () => 0);
  raw.forEach((v) => { counts[Math.min(bins - 1, Math.floor((v - lo) / step))]++; });
  const cats = counts.map((_, i) => `${formatNumber(lo + i * step, { decimals: step < 1 ? 1 : 0 })}–${formatNumber(lo + (i + 1) * step, { decimals: step < 1 ? 1 : 0 })}`);
  const sub: Ctx = { ...ctx, c: { ...c, chartType: 'column', categories: cats, series: [{ name: c.series[0]?.name ?? 'Count', values: counts, color: c.series[0]?.color }], valuePrefix: undefined, valueSuffix: undefined, decimals: 0 } };
  cartesian(sub, top);
}

/* ---------------------------------- Treemap ---------------------------------- */
function treemap(ctx: Ctx, top: number) {
  const { c, w, h, fs } = ctx;
  const items = (c.categories ?? []).map((label, i) => ({ label, v: Math.max(0, c.series[0]?.values?.[i] ?? 0), i })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const total = items.reduce((s, x) => s + x.v, 0) || 1;
  type R = { x: number; y: number; w: number; h: number };
  const out: { it: (typeof items)[number]; r: R }[] = [];
  // squarified
  const layout = (list: typeof items, r: R) => {
    if (!list.length) return;
    if (list.length === 1) { out.push({ it: list[0], r }); return; }
    const sum = list.reduce((s, x) => s + x.v, 0);
    const horizontal = r.w >= r.h;
    let acc = 0, k = 0;
    const worst = (row: typeof items, side: number) => {
      const s = row.reduce((a, x) => a + x.v, 0) * ((r.w * r.h) / sum);
      const mx = Math.max(...row.map((x) => (x.v * (r.w * r.h)) / sum)), mn = Math.min(...row.map((x) => (x.v * (r.w * r.h)) / sum));
      return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
    };
    const side = horizontal ? r.h : r.w;
    let best = Infinity;
    for (k = 1; k <= list.length; k++) { const wv = worst(list.slice(0, k), side); if (wv > best) { k--; break; } best = wv; }
    k = Math.max(1, Math.min(k, list.length));
    const row = list.slice(0, k);
    acc = row.reduce((a, x) => a + x.v, 0);
    const frac = acc / sum;
    let off = 0;
    row.forEach((it) => {
      const f = it.v / acc;
      if (horizontal) { out.push({ it, r: { x: r.x, y: r.y + off, w: r.w * frac, h: r.h * f } }); off += r.h * f; }
      else { out.push({ it, r: { x: r.x + off, y: r.y, w: r.w * f, h: r.h * frac } }); off += r.w * f; }
    });
    layout(list.slice(k), horizontal ? { x: r.x + r.w * frac, y: r.y, w: r.w * (1 - frac), h: r.h } : { x: r.x, y: r.y + r.h * frac, w: r.w, h: r.h * (1 - frac) });
  };
  layout(items, { x: 0, y: top, w, h: h - top });
  out.forEach(({ it, r }) => {
    const g = 3;
    ctx.prims.push({ k: 'rect', x: r.x + g, y: r.y + g, w: Math.max(0, r.w - g * 2), h: Math.max(0, r.h - g * 2), r: 8, fill: catColor(ctx, it.i) });
    if (r.w > fs * 4 && r.h > fs * 2.6) {
      ctx.prims.push({ k: 'text', x: r.x + fs * 0.7, y: r.y + fs * 0.5, w: r.w - fs * 1.4, h: fs * 1.4, text: it.label, size: Math.min(fs, r.h * 0.25), color: '#ffffff', weight: 700 });
      ctx.prims.push({ k: 'text', x: r.x + fs * 0.7, y: r.y + fs * 1.8, w: r.w - fs * 1.4, h: fs * 1.3, text: `${fmt(ctx, it.v)} · ${Math.round((it.v / total) * 100)}%`, size: Math.min(fs * 0.85, r.h * 0.2), color: 'rgba(255,255,255,0.9)' });
    }
  });
}

export function buildChartScene(content: ChartContent, theme: Theme, w: number, h: number): Scene {
  const fs = Math.max(13, Math.min(26, Math.round(Math.min(w, h * 1.6) / 34)));
  const ctx: Ctx = {
    c: content, t: theme, w, h, fs, prims: [], muted: theme.colors.textMuted, grid: withAlpha(theme.colors.border, theme.mode === 'dark' ? 0.5 : 0.9), text: theme.colors.text, font: theme.fonts.body,
  };
  const ct = content.chartType;
  const legend = ['pie', 'donut', 'funnel', 'treemap', 'waterfall', 'histogram'].includes(ct) ? [] : content.series.map((s, i) => ({ label: s.name, color: seriesColor(ctx, i) }));
  const top = header(ctx, legend);
  try {
    switch (ct) {
      case 'pie': pie(ctx, top, false); break;
      case 'donut': pie(ctx, top, true); break;
      case 'scatter': scatter(ctx, top, false); break;
      case 'bubble': scatter(ctx, top, true); break;
      case 'radar': radar(ctx, top); break;
      case 'waterfall': waterfall(ctx, top); break;
      case 'funnel': funnelChart(ctx, top); break;
      case 'histogram': histogram(ctx, top); break;
      case 'treemap': treemap(ctx, top); break;
      default: cartesian(ctx, top);
    }
  } catch {
    ctx.prims.push({ k: 'text', x: 0, y: h / 2 - 20, w, h: 40, text: 'Chart data could not be rendered', size: fs, color: ctx.muted, align: 'center' });
  }
  void arcPoints;
  return { w, h, prims: ctx.prims, fonts: theme.fonts };
}
