/** Pure helpers for the chart data editor (unit-tested). */
import type { ChartContent } from '@/types/schema';

export type Grid = string[][]; // [0] = header row

export const XY_TYPES = ['scatter', 'bubble'];
export const SINGLE_SERIES_TYPES = ['pie', 'donut', 'funnel', 'treemap', 'waterfall', 'histogram'];

/**
 * Parse a number typed the Vietnamese or English way.
 *  "1,5" → 1.5 · "2.5" → 2.5 · "1.240" / "1,240" / "12.345.678" → thousands groups
 *  "1.234,5" → 1234.5 · "1,234.5" → 1234.5 · "45%" → 45 · "500.000 đ" → 500000
 * Returns null for an empty cell, NaN when not a number.
 */
export function parseNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  let t = String(raw).trim().replace(/[\s ]/g, '').replace(/^[+]/, '').replace(/(đồng|đ|vnd|usd|[$€£¥₫%])/gi, '');
  if (t === '' || t === '-') return null;
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/^[(-]+|[)]+$/g, '');
  const hasDot = t.includes('.'), hasComma = t.includes(',');
  if (hasDot && hasComma) {
    const dec = t.lastIndexOf('.') > t.lastIndexOf(',') ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    t = t.split(thou).join('').replace(dec, '.');
  } else if (hasComma) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3}){2,}$/.test(t) || /^\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  }
  if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(t) && !/^\d+\.$/.test(t)) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function toGrid(c: ChartContent): Grid {
  const series = Array.isArray(c.series) ? c.series : [];
  if (XY_TYPES.includes(c.chartType)) {
    const rows: Grid = [['Series', 'X', 'Y', 'Size', 'Label']];
    series.forEach((sr) => (sr.points ?? []).forEach((p) => rows.push([sr.name ?? '', s(p.x), s(p.y), s(p.size), p.label ?? ''])));
    if (rows.length === 1) rows.push([series[0]?.name ?? 'Series 1', '', '', '', '']);
    return rows;
  }
  if (c.chartType === 'histogram') {
    const vals = series[0]?.values ?? [];
    return [[series[0]?.name ?? 'Value'], ...(vals.length ? vals.map((v) => [s(v)]) : [['']])];
  }
  const cats = c.categories ?? [];
  const used = SINGLE_SERIES_TYPES.includes(c.chartType) ? series.slice(0, 1) : series;
  const header = ['Category', ...(used.length ? used.map((sr, i) => sr.name || `Series ${i + 1}`) : ['Series 1'])];
  const n = Math.max(cats.length, ...used.map((sr) => sr.values?.length ?? 0), 1);
  const rows = Array.from({ length: n }, (_, i) => [cats[i] ?? '', ...(used.length ? used.map((sr) => s(sr.values?.[i])) : [''])]);
  return [header, ...rows];
}

/** Grid → chart content. Never invents values; reports the first problem with its location. */
export function fromGrid(g: Grid, base: ChartContent): { content?: ChartContent; error?: string } {
  if (!g.length || !g[0]) return { error: 'empty' };
  const series = Array.isArray(base.series) ? base.series : [];
  if (XY_TYPES.includes(base.chartType)) {
    const map = new Map<string, NonNullable<ChartContent['series'][number]['points']>>();
    for (let ri = 1; ri < g.length; ri++) {
      const r = g[ri];
      if (!r.some((x) => s(x).trim())) continue;
      const x = parseNumber(r[1]), y = parseNumber(r[2]), size = parseNumber(r[3]);
      if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) return { error: `row:${ri}:xy` };
      const name = s(r[0]).trim() || 'Series 1';
      const list = map.get(name) ?? [];
      list.push({ x, y, ...(size !== null && !Number.isNaN(size) ? { size } : {}), ...(s(r[4]).trim() ? { label: s(r[4]).trim() } : {}) });
      map.set(name, list);
    }
    if (!map.size) return { error: 'empty' };
    return { content: { ...base, categories: undefined, series: [...map.entries()].map(([name, points], i) => ({ name, points, ...(series[i]?.color ? { color: series[i].color } : {}) })) } };
  }
  if (base.chartType === 'histogram') {
    const values: number[] = [];
    for (let ri = 1; ri < g.length; ri++) {
      const v = parseNumber(g[ri][0]);
      if (v === null) continue;
      if (Number.isNaN(v)) return { error: `cell:${ri}:0` };
      values.push(v);
    }
    if (values.length < 2) return { error: 'histogram' };
    return { content: { ...base, categories: undefined, series: [{ name: s(g[0][0]) || series[0]?.name || 'Values', values, ...(series[0]?.color ? { color: series[0].color } : {}) }] } };
  }
  const header = g[0];
  const rows = g.slice(1).filter((r) => r.some((x) => s(x).trim()));
  if (!rows.length) return { error: 'empty' };
  const width = Math.max(header.length, ...rows.map((r) => r.length));
  const out: ChartContent['series'] = [];
  for (let ci = 1; ci < width; ci++) {
    const values: (number | null)[] = [];
    for (let k = 0; k < rows.length; k++) {
      const v = parseNumber(rows[k][ci]);
      if (Number.isNaN(v)) return { error: `cell:${g.indexOf(rows[k])}:${ci}` };
      values.push(v);
    }
    const prev = series[ci - 1] ?? {};
    out.push({ ...prev, name: s(header[ci]).trim() || `Series ${ci}`, values, points: undefined } as ChartContent['series'][number]);
  }
  if (!out.length) return { error: 'noseries' };
  out.forEach((sr) => { delete (sr as Record<string, unknown>).points; });
  if (['pie', 'donut'].includes(base.chartType) && out[0].values!.some((v) => (v ?? 0) < 0)) return { error: 'negative' };
  return { content: { ...base, categories: rows.map((r, i) => s(r[0]).trim() || String(i + 1)), series: out } };
}

/** Convert data when the chart type changes, keeping every value (no data loss between families). */
export function convertContent(c: ChartContent, to: ChartContent['chartType']): ChartContent {
  const from = c.chartType;
  const series = Array.isArray(c.series) ? c.series : [];
  const fromXY = XY_TYPES.includes(from), toXY = XY_TYPES.includes(to);
  if (fromXY && !toXY) {
    // points → categories (x) + values (y)
    const xs = [...new Set(series.flatMap((sr) => (sr.points ?? []).map((p) => p.x)))].sort((a, b) => a - b);
    if (to === 'histogram') return { ...c, chartType: to, categories: undefined, series: [{ name: series[0]?.name ?? 'Values', values: series.flatMap((sr) => (sr.points ?? []).map((p) => p.y)) }] };
    return { ...c, chartType: to, categories: xs.map(String), series: series.map((sr) => ({ name: sr.name, color: sr.color, values: xs.map((x) => sr.points?.find((p) => p.x === x)?.y ?? null) })) };
  }
  if (!fromXY && toXY) {
    const cats = c.categories ?? [];
    return { ...c, chartType: to, categories: undefined, series: series.map((sr) => ({ name: sr.name, color: sr.color, points: (sr.values ?? []).map((v, i) => ({ x: Number.isFinite(Number(cats[i])) && cats[i] !== '' ? Number(cats[i]) : i + 1, y: v ?? 0, ...(to === 'bubble' ? { size: Math.abs(v ?? 1) || 1 } : {}), ...(cats[i] && !Number.isFinite(Number(cats[i])) ? { label: cats[i] } : {}) })) })) };
  }
  if (from === 'histogram' && to !== 'histogram') {
    const vals = series[0]?.values ?? [];
    return { ...c, chartType: to, categories: vals.map((_, i) => String(i + 1)), series: [{ name: series[0]?.name ?? 'Values', values: vals }] };
  }
  if (to === 'histogram' && from !== 'histogram') {
    return { ...c, chartType: to, categories: undefined, series: [{ name: series[0]?.name ?? 'Values', values: series.flatMap((sr) => sr.values ?? []) }] };
  }
  return { ...c, chartType: to };
}
