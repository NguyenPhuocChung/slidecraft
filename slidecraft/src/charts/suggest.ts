import type { ChartContent } from '@/types/schema';
import type { ChartType } from '@/types/registry';

const TIME = /^(19|20)\d{2}$|^q[1-4]|^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|^(th[áa]ng|tháng)\s?\d|^(mon|tue|wed|thu|fri|sat|sun)|^week|^w\d|^h[12]\b|^fy|^\d{4}[-/]\d{1,2}/i;

/**
 * Suggest a chart type from the data shape (never changes data).
 * comparison → bar/column, time trend → line, share of whole → donut,
 * sequential conversion → funnel, x/y numeric → scatter.
 */
export function suggestChartType(c: Pick<ChartContent, 'chartType' | 'categories' | 'series'>): { type: ChartType; reason: string } | null {
  const cats = c.categories ?? [];
  const series = c.series ?? [];
  if (series.some((s) => s.points?.length)) {
    const hasSize = series.some((s) => s.points?.some((p) => p.size !== undefined));
    return hasSize ? { type: 'bubble', reason: 'Points have x, y and size — a bubble chart shows all three.' } : { type: 'scatter', reason: 'Numeric x/y pairs show correlation best as a scatter plot.' };
  }
  if (!cats.length) return null;
  const vals = series[0]?.values?.filter((v): v is number => typeof v === 'number') ?? [];
  const timeLike = cats.filter((x) => TIME.test(x.trim())).length >= Math.ceil(cats.length * 0.6);
  if (timeLike && cats.length >= 4) return { type: series.length > 1 && series.some((s) => s.axis === 'secondary') ? 'combo' : 'line', reason: 'Categories are time periods — a line chart shows the trend over time.' };
  const decreasing = vals.length >= 3 && vals.every((v, i) => i === 0 || v <= vals[i - 1]) && vals[vals.length - 1] < vals[0] * 0.6;
  if (series.length === 1 && decreasing && /visit|lead|trial|sign|order|customer|stage|view|click|cart|checkout|purchase/i.test(cats.join(' '))) return { type: 'funnel', reason: 'Values shrink stage by stage — a funnel shows conversion.' };
  const total = vals.reduce((a, b) => a + b, 0);
  const isShare = series.length === 1 && vals.length >= 2 && vals.length <= 6 && vals.every((v) => v >= 0) && (Math.abs(total - 100) < 1.5 || Math.abs(total - 1) < 0.02 || /%/.test(c.series[0]?.name ?? ''));
  if (isShare) return { type: 'donut', reason: 'Values add up to a whole (100%) — a donut shows each share clearly.' };
  if (series.length === 1 && vals.length > 8 && !timeLike) return { type: 'bar', reason: 'Many categories read better as horizontal bars.' };
  const longLabels = cats.some((x) => x.length > 14);
  if (longLabels) return { type: 'bar', reason: 'Long category labels fit better on a horizontal bar chart.' };
  return { type: 'column', reason: 'Comparing values across a few categories works best as columns.' };
}

/** True when the chart type misrepresents the data (e.g. pie with negatives or many series). */
export function chartMisuse(c: ChartContent): string | null {
  const vals = c.series[0]?.values ?? [];
  if ((c.chartType === 'pie' || c.chartType === 'donut') && vals.some((v) => (v ?? 0) < 0)) return 'Pie/donut cannot show negative values.';
  if ((c.chartType === 'pie' || c.chartType === 'donut') && c.series.length > 1) return 'Pie/donut shows only one series — use a column chart to compare series.';
  if (c.chartType === 'line' && (c.categories?.length ?? 0) < 3) return 'A line needs at least 3 points to show a trend.';
  return null;
}
