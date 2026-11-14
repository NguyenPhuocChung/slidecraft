import { describe, expect, it } from 'vitest';
import { LAYOUTS, buildLayout, suggestLayouts, unusedSlots } from '@/layouts/engine';
import { extractContent } from '@/layouts/extract';
import { generateCandidates } from '@/layouts/assistant';
import { THEMES, getTheme } from '@/themes/themes';
import { buildChartScene } from '@/charts/chartScene';
import { buildDiagramScene, buildInfographicScene, buildTimelineScene } from '@/charts/diagramScene';
import { suggestChartType } from '@/charts/suggest';
import { SAMPLE_CHART_DATA, SAMPLE_DIAGRAM_ITEMS, SAMPLE_INFOGRAPHIC } from '@/editor/insert';
import { CHART_TYPE_IDS, DIAGRAM_KIND_IDS, INFOGRAPHIC_KIND_IDS } from '@/types/registry';
import { buildTimeline, applyPreset, ANIMATION_PRESETS } from '@/animation/engine';
import { normalizeElement } from '@/code-parser/normalize';
import type { ChartContent, LayoutContent, Slide } from '@/types/schema';
import { contrastRatio } from '@/utils/color';

const theme = getTheme('modern-corporate');
const size = { width: 1920, height: 1080 };
const RICH: LayoutContent = {
  eyebrow: 'Eyebrow', heading: 'A reasonably long heading for testing layout fit', subheading: 'Sub', body: 'Body text sentence one. Sentence two.',
  bullets: ['One', 'Two', 'Three'], image: { query: 'office', alt: 'x' }, images: [{ query: 'b', alt: 'b' }],
  stats: [{ value: '42%', label: 'Stat' }, { value: '3x', label: 'Stat 2' }], items: [{ title: 'I1', text: 't' }, { title: 'I2' }, { title: 'I3' }],
  columns: [{ heading: 'C1', bullets: ['a'] }, { heading: 'C2', body: 'b' }], quote: { text: 'Q', author: 'A' },
  chart: { chartType: 'column', categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] }, table: { rows: [['a', 'b'], ['1', '2']], header: true },
  timeline: { orientation: 'horizontal', style: 'milestones', items: [{ date: '2024', title: 'x' }] }, diagram: { kind: 'process', items: [{ title: 'a' }, { title: 'b' }] },
  code: { code: 'x', language: 'ts' }, formula: { latex: 'x^2' }, before: { heading: 'B' }, after: { heading: 'A' }, cta: 'Go', footer: 'F', number: '01', caption: 'cap',
};

describe('Layout engine', () => {
  it('has at least 31 layouts covering the required list', () => {
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(31);
  });
  it.each(LAYOUTS.map((l) => l.id))('layout %s builds valid in-canvas elements with unique ids', (id) => {
    const def = LAYOUTS.find((l) => l.id === id)!;
    const c: LayoutContent = {};
    def.slots.forEach((k) => { (c as Record<string, unknown>)[k] = (RICH as Record<string, unknown>)[k]; });
    for (const t of [THEMES[0], getTheme('cinematic')]) {
      const { elements } = buildLayout(id, c, t, size);
      expect(elements.length).toBeGreaterThan(0);
      const ids = elements.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const e of elements) {
        expect(Number.isFinite(e.x) && Number.isFinite(e.y) && e.width > 0 && e.height > 0).toBe(true);
        if (e.type !== 'decorative') expect(e.x + e.width).toBeLessThanOrEqual(size.width + 2);
      }
      expect(unusedSlots(id, c)).toEqual([]);
    }
  });
  it('works in portrait (A4)', () => {
    const { elements } = buildLayout('imageRight', { heading: 'H', bullets: ['a'], image: { query: 'q' } }, theme, { width: 1080, height: 1527 });
    elements.forEach((e) => expect(e.x + e.width).toBeLessThanOrEqual(1080 + 2));
  });
  it('suggests sensible layouts for content shapes', () => {
    expect(suggestLayouts({ heading: 'H', quote: { text: 'q' } })[0].layout.id).toBe('quote');
    expect(suggestLayouts({ heading: 'H', stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }, { value: '3', label: 'c' }] })[0].layout.id).toBe('statistics');
    expect(suggestLayouts({ heading: 'H', timeline: RICH.timeline })[0].layout.id).toBe('timeline');
    expect(suggestLayouts({ heading: 'H', before: { heading: 'a' }, after: { heading: 'b' } })[0].layout.id).toBe('beforeAfter');
  });
  it('round-trips content through elements (extract)', () => {
    const c: LayoutContent = { heading: 'Title', eyebrow: 'E', body: 'Body', stats: [{ value: '9', label: 'L' }, { value: '8', label: 'M' }] };
    const { elements, layout } = buildLayout('statistics', c, theme, size);
    const slide: Slide = { id: 's', layout, content: c, elements: elements.map((e) => normalizeElement(e)) };
    const x = extractContent(slide);
    expect(x.heading).toBe('Title');
    expect(x.stats?.map((s) => s.value)).toEqual(['9', '8']);
  });
});

describe('Smart Layout Assistant', () => {
  const mk = (c: LayoutContent): Slide => { const r = buildLayout('singleColumn', c, theme, size); return { id: 's', layout: r.layout, content: c, elements: r.elements.map((e) => normalizeElement(e)) }; };
  it('converts numeric bullets to a chart without changing values', () => {
    const cands = generateCandidates('chart', mk({ heading: 'Revenue', bullets: ['North: 42', 'South: 35', 'East: 28'] }), theme, size);
    const chart = cands[0].slide.elements.find((e) => e.type === 'chart')!;
    expect(chart.content.series[0].values).toEqual([42, 35, 28]);
  });
  it('refuses to invent chart data', () => {
    const cands = generateCandidates('chart', mk({ heading: 'X', bullets: ['no numbers here'] }), theme, size);
    expect(cands[0].id).toBe('chart-none');
  });
  it('reduce text moves overflow to notes instead of deleting', () => {
    const bullets = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'];
    const c = generateCandidates('reduce', mk({ heading: 'H', bullets }), theme, size).find((x) => x.id === 'reduce-top5')!;
    expect(c.slide.notes).toContain('a7');
  });
  it('timeline conversion requires dates', () => {
    const c = generateCandidates('timeline', mk({ heading: 'H', bullets: ['2023: Founded', '2024: Launch', '2025: Scale'] }), theme, size);
    expect(c[0].slide.elements.find((e) => e.type === 'timeline')!.content.items).toHaveLength(3);
  });
  it('contrast fix reaches WCAG AA', () => {
    const s = mk({ heading: 'H', body: 'Body' });
    s.elements.forEach((e) => { if (e.content?.paragraphs) e.style = { ...e.style, color: '#f4f4f4' }; });
    const fixed = generateCandidates('contrast', s, theme, size)[0].slide;
    fixed.elements.filter((e) => e.content?.paragraphs).forEach((e) => expect(contrastRatio(e.style!.color!, '#ffffff')).toBeGreaterThanOrEqual(4.5));
  });
});

describe('Chart / diagram / infographic scenes', () => {
  it.each(CHART_TYPE_IDS)('chart %s renders primitives', (t) => {
    const scene = buildChartScene({ chartType: t, ...SAMPLE_CHART_DATA[t]() } as ChartContent, theme, 1200, 640);
    expect(scene.prims.length).toBeGreaterThan(3);
    expect(scene.prims.some((p) => p.k === 'text' && /could not be rendered/.test(p.text))).toBe(false);
  });
  it.each(DIAGRAM_KIND_IDS)('diagram %s renders primitives', (k) => {
    const scene = buildDiagramScene({ kind: k, ...SAMPLE_DIAGRAM_ITEMS[k]() } as never, theme, 1500, 620);
    expect(scene.prims.length).toBeGreaterThan(2);
    expect(scene.prims.some((p) => p.k === 'text' && /could not be rendered/.test(p.text))).toBe(false);
  });
  it.each(INFOGRAPHIC_KIND_IDS)('infographic %s renders primitives', (k) => {
    expect(buildInfographicScene({ kind: k, ...SAMPLE_INFOGRAPHIC[k]() } as never, theme, 1500, 420).prims.length).toBeGreaterThan(2);
  });
  it('timeline renders both orientations', () => {
    const items = [{ date: '2024', title: 'A' }, { date: '2025', title: 'B' }];
    expect(buildTimelineScene({ orientation: 'horizontal', style: 'alternating', items }, theme, 1600, 400).prims.length).toBeGreaterThan(4);
    expect(buildTimelineScene({ orientation: 'vertical', style: 'line', items }, theme, 800, 600).prims.length).toBeGreaterThan(4);
  });
  it('suggests chart types by data shape', () => {
    expect(suggestChartType({ chartType: 'bar', categories: ['2021', '2022', '2023', '2024'], series: [{ name: 's', values: [1, 2, 3, 4] }] })?.type).toBe('line');
    expect(suggestChartType({ chartType: 'bar', categories: ['a', 'b', 'c'], series: [{ name: 'Share %', values: [50, 30, 20] }] })?.type).toBe('donut');
    expect(suggestChartType({ chartType: 'bar', categories: ['Visitors', 'Sign-ups', 'Trials', 'Customers'], series: [{ name: 'n', values: [1000, 300, 100, 30] }] })?.type).toBe('funnel');
  });
});

describe('Animation timeline', () => {
  const el = (id: string, anim: object[]) => normalizeElement({ id, type: 'text', x: 0, y: 0, width: 10, height: 10, content: { text: id }, animation: anim });
  it('groups click steps and computes with/after timing', () => {
    const slide: Slide = { id: 's', elements: [
      el('a', [{ effect: 'fadeIn', trigger: 'onEnter', duration: 500 }]),
      el('b', [{ effect: 'rise', trigger: 'afterPrevious', duration: 400, delay: 100 }]),
      el('c', [{ effect: 'zoomIn', trigger: 'onClick', duration: 300 }]),
      el('d', [{ effect: 'wipe', trigger: 'withPrevious', duration: 300, delay: 50 }]),
      el('e', [{ effect: 'pulse', trigger: 'onClick', duration: 600 }]),
    ] };
    const tl = buildTimeline(slide);
    expect(tl.steps.map((s) => s.trigger)).toEqual(['auto', 'click', 'click']);
    expect(tl.steps[0].items.map((i) => [i.elId, i.start])).toEqual([['a', 0], ['b', 600]]);
    expect(tl.steps[1].items.map((i) => [i.elId, i.start])).toEqual([['c', 0], ['d', 50]]);
    expect([...tl.initialHidden].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('presets assign animations to content and skip full-bleed backgrounds', () => {
    const r = buildLayout('imageRight', { heading: 'H', bullets: ['a'], image: { query: 'q' } }, theme, size);
    const slide: Slide = { id: 's', elements: [...r.elements, { id: 'bg', type: 'shape', x: 0, y: 0, width: 1920, height: 1080, content: { shape: 'rect' } }].map((e) => normalizeElement(e)) };
    for (const p of ANIMATION_PRESETS) {
      const els = applyPreset(slide, p.id, size);
      expect(els.find((e) => e.id === 'bg')!.animation).toBeUndefined();
      expect(els.filter((e) => e.animation?.length).length).toBeGreaterThan(0);
    }
  });
});
