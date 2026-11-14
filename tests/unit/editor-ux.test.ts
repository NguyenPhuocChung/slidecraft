/** Editor UX batch: chart data editing (Vietnamese numbers, every chart type, real decks) and in-place source editing. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { importPresentation } from '@/code-parser';
import { SAMPLES } from '@/samples';
import { CHART_TYPE_IDS, type ChartType } from '@/types/registry';
import type { ChartContent, Presentation } from '@/types/schema';
import { SAMPLE_CHART_DATA } from '@/editor/insert';
import { convertContent, fromGrid, parseNumber, toGrid } from '@/editor/dialogs/chartGrid';
import { presentationToSource, sourceToPresentation } from '@/editor/dialogs/SourceCodeDialog';
import { buildChartScene } from '@/charts/chartScene';
import { getTheme } from '@/themes/themes';

const theme = getTheme('modern-minimal');
const sample = (t: ChartType) => ({ chartType: t, ...SAMPLE_CHART_DATA[t]() }) as unknown as ChartContent;

describe('parseNumber (Vietnamese + English formats)', () => {
  it.each([
    ['1,5', 1.5], ['1.5', 1.5], ['2,75', 2.75], ['1.240', 1240], ['1.240.000', 1240000], ['1,240', 1240], ['12,345,678', 12345678],
    ['1.234,5', 1234.5], ['1,234.5', 1234.5], ['45%', 45], ['500.000 đ', 500000], ['$1,200', 1200], ['-3,5', -3.5], ['(12)', -12], ['0,05', 0.05], ['  7  ', 7], ['1e3', 1000],
  ])('%s → %s', (s, n) => expect(parseNumber(s)).toBe(n));
  it('empty → null, junk → NaN', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(Number.isNaN(parseNumber('abc') as number)).toBe(true);
    expect(Number.isNaN(parseNumber('1,2,3x') as number)).toBe(true);
  });
});

describe('chart data grid round-trip', () => {
  it.each(CHART_TYPE_IDS)('%s: grid → content keeps every value and renders', (t) => {
    const c = sample(t);
    const g = toGrid(c);
    expect(g.length).toBeGreaterThan(1);
    const r = fromGrid(g, c);
    expect(r.error).toBeUndefined();
    const back = r.content!;
    if (t === 'scatter' || t === 'bubble') expect(back.series.flatMap((s) => s.points ?? []).length).toBe(c.series.flatMap((s) => s.points ?? []).length);
    else if (t === 'histogram') expect(back.series[0].values).toEqual(c.series[0].values);
    else {
      expect(back.categories).toEqual(c.categories);
      const used = ['pie', 'donut', 'funnel', 'treemap', 'waterfall'].includes(t) ? c.series.slice(0, 1) : c.series;
      expect(back.series.map((s) => s.values)).toEqual(used.map((s) => s.values));
    }
    expect(() => buildChartScene(back, theme, 640, 400)).not.toThrow();
  });

  it('editing a cell with a Vietnamese decimal changes the value', () => {
    const c = sample('column');
    const g = toGrid(c);
    g[1][1] = '12,5';
    expect(fromGrid(g, c).content!.series[0].values![0]).toBe(12.5);
  });

  it('reports the exact bad cell instead of crashing', () => {
    const c = sample('line');
    const g = toGrid(c);
    g[2][1] = 'abc';
    expect(fromGrid(g, c).error).toBe('cell:2:1');
  });

  it('never crashes on empty / malformed content (old dialog crashed on first render)', () => {
    expect(fromGrid([], sample('column')).error).toBe('empty');
    const broken = { chartType: 'column', series: undefined } as unknown as ChartContent;
    expect(() => toGrid(broken)).not.toThrow();
    expect(toGrid(broken).length).toBeGreaterThan(1);
    expect(fromGrid([['Category', 'A'], ['', '']], sample('column')).error).toBe('empty');
  });

  it('adding a row and a series works', () => {
    const c = sample('column');
    const g = toGrid(c).map((r, i) => [...r, i === 0 ? 'New' : String(i)]);
    g.push(['Q5', '1', '2', '3']);
    const r = fromGrid(g, c).content!;
    expect(r.series.length).toBe(3);
    expect(r.categories!.at(-1)).toBe('Q5');
  });

  it('switching chart family converts data without losing values', () => {
    const col = sample('column');
    const sc = convertContent(col, 'scatter');
    expect(sc.series[0].points!.length).toBe(4);
    expect(sc.series[0].points!.map((p) => p.y)).toEqual(col.series[0].values);
    const back = convertContent(sc, 'line');
    expect(back.series[0].values).toEqual(col.series[0].values);
    const h = convertContent(col, 'histogram');
    expect(h.series[0].values!.length).toBe(8);
    for (const t of CHART_TYPE_IDS) {
      const conv = convertContent(sample('bar'), t);
      expect(() => buildChartScene(conv, theme, 640, 400), t).not.toThrow();
      expect(fromGrid(toGrid(conv), conv).error, t).toBeUndefined();
    }
  });
});

function chartsOf(p: Presentation): ChartContent[] {
  return p.slides.flatMap((s) => s.elements.filter((e) => e.type === 'chart').map((e) => e.content as ChartContent));
}

describe('Edit data works on charts from real decks (layout slides + external AI code)', () => {
  const decks: [string, string][] = [
    ...SAMPLES.map((s) => [s.id, JSON.stringify(s.data)] as [string, string]),
    ...['external-ai-business-report.md', 'external-ai-lecture.md'].map((f) => [f, fs.readFileSync(`tests/fixtures/${f}`, 'utf8')] as [string, string]),
    ...(fs.existsSync('ai-prompts/TEST_CODE.json') ? [['TEST_CODE.json', fs.readFileSync('ai-prompts/TEST_CODE.json', 'utf8')] as [string, string]] : []),
  ];
  it.each(decks)('%s', (_name, code) => {
    const { presentation } = importPresentation(code);
    expect(presentation).toBeTruthy();
    for (const c of chartsOf(presentation!)) {
      const g = toGrid(c);
      const r = fromGrid(g, c);
      expect(r.error, `${c.chartType}`).toBeUndefined();
      expect(() => buildChartScene(r.content!, theme, 640, 400)).not.toThrow();
    }
  });
  it('the data-report sample has charts to edit', () => {
    const p = importPresentation(JSON.stringify(SAMPLES.find((s) => s.id === 'sample-data-report')!.data)).presentation!;
    expect(chartsOf(p).length).toBeGreaterThan(0);
  });
});

describe('Edit source code (in place)', () => {
  const p = importPresentation(JSON.stringify(SAMPLES[0].data)).presentation!;
  it('source is valid contract JSON that re-imports with no errors', () => {
    const src = presentationToSource(p);
    const r = importPresentation(src);
    expect(r.analysis.report.errorCount).toBe(0);
    expect(r.presentation!.slides.length).toBe(p.slides.length);
  });
  it('applying edited code keeps the project id and embedded assets', () => {
    const withAsset = { ...p, assets: [{ id: 'logo', type: 'image', src: 'data:image/png;base64,AAAA', name: 'logo.png' }] } as Presentation;
    const src = presentationToSource(withAsset);
    expect(src).not.toContain('data:image/png;base64,AAAA');
    const data = JSON.parse(src);
    data.title = 'Tiêu đề mới';
    const next = sourceToPresentation(data, withAsset);
    expect(next.id).toBe(p.id);
    expect(next.title).toBe('Tiêu đề mới');
    expect(next.assets?.[0]?.id).toBe('logo');
  });
});
