/** DrawingML chart part (c:chartSpace) → SlideCraft ChartContent. */
import type { ChartContent, ChartSeries } from '@/types/schema';
import { attr, child, children, find, kids, num, path, textOf, type XNode } from './xml';
import { colorIn, css, type ColorCtx } from './color';

function cacheValues(ref: XNode | undefined): (string | null)[] {
  if (!ref) return [];
  // numRef/strRef → numCache/strCache ; numLit/strLit ; multiLvlStrRef → multiLvlStrCache/lvl (first level)
  const cache = find(ref, 'numCache') ?? find(ref, 'strCache') ?? (ref.tag === 'numLit' || ref.tag === 'strLit' ? ref : undefined) ?? find(ref, 'numLit') ?? find(ref, 'strLit');
  let holder = cache;
  if (!holder) {
    const ml = find(ref, 'multiLvlStrCache');
    holder = ml ? child(ml, 'lvl') : undefined;
  }
  if (!holder) return [];
  const count = num(attr(child(holder, 'ptCount') ?? child(cache, 'ptCount'), 'val'), -1);
  const pts = children(holder, 'pt');
  const n = Math.max(count, pts.reduce((m, p) => Math.max(m, num(attr(p, 'idx')) + 1), 0));
  const out: (string | null)[] = new Array(Math.max(0, n)).fill(null);
  for (const p of pts) out[num(attr(p, 'idx'))] = textOf(child(p, 'v'));
  return out;
}
const toNum = (v: string | null): number | null => { if (v === null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };

function serName(ser: XNode, i: number): string {
  const tx = child(ser, 'tx');
  if (tx) {
    const v = cacheValues(child(tx, 'strRef') ?? tx).filter((x) => x !== null)[0];
    if (v) return v;
    const direct = textOf(child(tx, 'v'));
    if (direct) return direct;
  }
  return `Series ${i + 1}`;
}
function serColor(ser: XNode, cc: ColorCtx): string | undefined {
  const sp = child(ser, 'spPr');
  const solid = child(sp, 'solidFill');
  if (solid) return css(colorIn(solid, cc));
  const ln = child(sp, 'ln');
  const lf = child(ln, 'solidFill');
  return lf ? css(colorIn(lf, cc)) : undefined;
}

/** Parse number format like "$"#,##0.0"M" or 0% into prefix/suffix/decimals. */
function parseFormat(code: string | undefined): Pick<ChartContent, 'valuePrefix' | 'valueSuffix' | 'decimals'> {
  if (!code || code === 'General') return {};
  const out: Pick<ChartContent, 'valuePrefix' | 'valueSuffix' | 'decimals'> = {};
  const m = /^(?:"([^"]*)"|\\?([$€£¥]))?\[?[^#0]*?([#,0]+)(?:\.(0+))?(?:"([^"]*)"|(%))?/.exec(code);
  if (!m) return {};
  const pre = m[1] ?? m[2];
  const suf = m[5] ?? m[6];
  if (pre) out.valuePrefix = pre;
  if (suf) out.valueSuffix = suf;
  if (m[4]) out.decimals = m[4].length;
  return out;
}

const PLOTS = ['barChart', 'bar3DChart', 'lineChart', 'line3DChart', 'areaChart', 'area3DChart', 'pieChart', 'pie3DChart', 'ofPieChart', 'doughnutChart', 'scatterChart', 'bubbleChart', 'radarChart', 'stockChart', 'surfaceChart', 'surface3DChart'];

export function parseChart(root: XNode, cc: ColorCtx, warn: (m: string) => void): ChartContent | null {
  const chart = child(root, 'chart');
  const plotArea = child(chart, 'plotArea');
  if (!plotArea) return null;
  const plots = kids(plotArea).filter((k) => PLOTS.includes(k.tag));
  if (!plots.length) return null;
  const first = plots[0];
  const type = first.tag;
  let chartType: ChartContent['chartType'] = 'column';
  const extra: Partial<ChartContent> = {};
  const grouping = attr(child(first, 'grouping'), 'val');
  if (type.startsWith('bar')) {
    const dir = attr(child(first, 'barDir'), 'val') ?? 'col';
    const stacked = grouping === 'stacked' || grouping === 'percentStacked';
    chartType = stacked ? 'stackedBar' : dir === 'bar' ? 'bar' : 'column';
    if (stacked && dir === 'bar') extra.horizontal = true;
    if (grouping === 'percentStacked') warn('100% stacked chart imported as a stacked chart.');
  } else if (type.startsWith('line') || type === 'stockChart') {
    chartType = 'line';
    if (children(first, 'ser').some((s) => attr(child(s, 'smooth'), 'val') === '1')) extra.smooth = true;
    if (type === 'stockChart') warn('Stock chart imported as a line chart.');
  } else if (type.startsWith('area')) {
    chartType = 'area';
    if (grouping === 'stacked' || grouping === 'percentStacked') extra.stacked = true;
  } else if (type.startsWith('pie') || type === 'ofPieChart') chartType = 'pie';
  else if (type === 'doughnutChart') chartType = 'donut';
  else if (type === 'scatterChart') chartType = 'scatter';
  else if (type === 'bubbleChart') chartType = 'bubble';
  else if (type === 'radarChart') chartType = 'radar';
  else { chartType = 'line'; warn(`${type} imported as a line chart.`); }
  if (type.includes('3D')) warn('3-D chart imported as a flat chart.');

  const combo = plots.length > 1 && plots.every((p) => /^(bar|line|area)/.test(p.tag));
  if (plots.length > 1 && !combo) warn('Chart combines unsupported chart types; only the first type was imported.');
  const usePlots = combo ? plots : [first];
  if (combo) chartType = 'combo';

  // secondary axis: the plot whose valAx (by axId) has axPos r / is not the first valAx
  const valAxes = children(plotArea, 'valAx');
  const primaryValId = attr(child(valAxes[0], 'axId'), 'val');

  let categories: string[] | undefined;
  const series: ChartSeries[] = [];
  let fmt: string | undefined;
  for (const plot of usePlots) {
    const kind: ChartSeries['type'] = plot.tag.startsWith('line') ? 'line' : plot.tag.startsWith('area') ? 'area' : 'bar';
    const axIds = children(plot, 'axId').map((a) => attr(a, 'val'));
    const secondary = combo && valAxes.length > 1 && !axIds.includes(primaryValId);
    for (const ser of children(plot, 'ser')) {
      const i = series.length;
      const s: ChartSeries = { name: serName(ser, i) };
      const color = serColor(ser, cc);
      if (color && !['pie', 'donut'].includes(chartType)) s.color = color;
      if (chartType === 'scatter' || chartType === 'bubble') {
        const xs = cacheValues(child(child(ser, 'xVal'), 'numRef') ?? child(child(ser, 'xVal'), 'numLit') ?? child(child(ser, 'xVal'), 'strRef') ?? child(ser, 'xVal'));
        const ys = cacheValues(child(ser, 'yVal'));
        const sizes = cacheValues(child(ser, 'bubbleSize'));
        s.points = ys.map((y, k) => {
          const yv = toNum(y);
          if (yv === null) return null;
          const xv = toNum(xs[k] ?? null) ?? k + 1;
          const pt: { x: number; y: number; size?: number } = { x: xv, y: yv };
          if (chartType === 'bubble') pt.size = toNum(sizes[k] ?? null) ?? 1;
          return pt;
        }).filter(Boolean) as { x: number; y: number; size?: number }[];
      } else {
        const cats = cacheValues(child(ser, 'cat'));
        if (!categories && cats.length) categories = cats.map((c) => c ?? '');
        s.values = cacheValues(child(ser, 'val')).map(toNum);
        if (!fmt) { const fc = find(child(ser, 'val'), 'formatCode'); if (fc) fmt = textOf(fc); }
      }
      if (combo) { s.type = kind; if (secondary) s.axis = 'secondary'; }
      series.push(s);
    }
  }
  if (!series.length) return null;
  if (!categories && series[0].values) categories = series[0].values.map((_, i) => String(i + 1));

  const out: ChartContent = { chartType, series, ...extra };
  if (categories) out.categories = categories;
  // title
  const title = child(chart, 'title');
  const t = findTextRuns(title);
  if (t) out.title = t;
  // PowerPoint shows the series name as an automatic title for single-series charts unless it was deleted
  else if (series.length === 1 && attr(child(chart, 'autoTitleDeleted'), 'val') !== '1') out.title = series[0].name;
  // legend
  const legend = child(chart, 'legend');
  out.showLegend = !!legend;
  const pos = attr(child(legend, 'legendPos'), 'val');
  if (legend && pos) out.legendPosition = ({ t: 'top', b: 'bottom', l: 'left', r: 'right', tr: 'right' } as Record<string, ChartContent['legendPosition']>)[pos] ?? 'top';
  // labels
  const on = (d: XNode | undefined) => !!d && attr(child(d, 'delete'), 'val') !== '1' && (attr(child(d, 'showVal'), 'val') === '1' || attr(child(d, 'showPercent'), 'val') === '1');
  const serDl = children(first, 'ser').map((s) => child(s, 'dLbls')).filter(Boolean) as XNode[];
  const plotDl = child(first, 'dLbls');
  const dl = serDl.find(on) ?? plotDl ?? serDl[0];
  out.showLabels = serDl.some(on) || on(plotDl);
  // number format: axis or data labels
  const axFmt = attr(child(valAxes[0], 'numFmt'), 'formatCode');
  const dlFmt = attr(child(dl, 'numFmt'), 'formatCode');
  Object.assign(out, parseFormat(axFmt && axFmt !== 'General' ? axFmt : dlFmt ?? fmt));
  if (chartType === 'pie' || chartType === 'donut') {
    delete out.valuePrefix; delete out.valueSuffix; delete out.decimals;
    // slice colors (c:dPt) — returned separately: SlideCraft colors slices from the theme chart palette
    const ser0 = children(first, 'ser')[0];
    const pts = children(ser0, 'dPt').map((d) => ({ i: num(attr(child(d, 'idx'), 'val')), c: css(colorIn(child(child(d, 'spPr'), 'solidFill'), cc)) })).filter((x) => x.c);
    if (pts.length) (out as ChartContent & { _sliceColors?: string[] })._sliceColors = pts.sort((a, b) => a.i - b.i).map((x) => x.c!);
  }
  // grid / axes
  if (valAxes[0]) {
    out.showGrid = !!child(valAxes[0], 'majorGridlines');
    out.showAxis = attr(child(valAxes[0], 'delete'), 'val') !== '1';
    const yt = findTextRuns(child(valAxes[0], 'title'));
    if (yt) out.yAxisTitle = yt;
  }
  const catAx = child(plotArea, 'catAx') ?? (chartType === 'scatter' || chartType === 'bubble' ? valAxes[1] : undefined);
  const xt = findTextRuns(child(catAx, 'title'));
  if (xt) out.xAxisTitle = xt;
  return out;
}

function findTextRuns(n: XNode | undefined): string | undefined {
  if (!n) return undefined;
  const rich = path(n, 'tx', 'rich');
  if (rich) {
    const t = children(rich, 'p').map((p) => kids(p).filter((r) => r.tag === 'r' || r.tag === 'fld').map((r) => textOf(child(r, 't'))).join('')).join(' ').trim();
    if (t) return t;
  }
  const ref = path(n, 'tx', 'strRef');
  const v = ref ? cacheValues(ref).filter(Boolean)[0] : undefined;
  return v ?? undefined;
}
