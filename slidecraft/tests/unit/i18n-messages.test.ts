import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as R from '@/types/registry';
import { LAYOUTS } from '@/layouts/engine';
import { THEMES, getTheme } from '@/themes/themes';
import { ANIMATION_PRESETS } from '@/animation/engine';
import { EXPORT_PROFILES, exportPptx, preflight } from '@/pptx-export';
import { analyzeCode, autoFix, importPresentation } from '@/code-parser';
import { checkPresentation } from '@/quality/checker';
import { generateCandidates, type AssistantAction } from '@/layouts/assistant';
import { suggestChartType, chartMisuse } from '@/charts/suggest';
import { SAMPLES } from '@/samples';
import { REGISTRY } from '@/i18n/vi/registry';
import { useLang, trMsg } from '@/i18n';
import { buildLayout } from '@/layouts/engine';
import { normalizeElement } from '@/code-parser/normalize';
import type { ChartContent, Presentation, Slide } from '@/types/schema';

function registryStrings(): string[] {
  const s = new Set<string>();
  const add = (v: unknown) => { if (typeof v === 'string' && v.trim()) s.add(v); };
  Object.values(R.ELEMENT_TYPES).forEach((e) => { add(e.label); add(e.description); add(e.pptxNote); });
  Object.values(R.CHART_TYPES).forEach((e) => { add(e.label); add(e.use); });
  Object.values(R.DIAGRAM_KINDS).forEach(add);
  Object.values(R.INFOGRAPHIC_KINDS).forEach(add);
  Object.values(R.ANIMATION_EFFECTS).forEach((e) => { add(e.label); add((e as { ppt?: { note?: string } }).ppt?.note); });
  Object.values(R.ANIMATION_TRIGGERS).forEach(add);
  Object.values(R.TRANSITIONS).forEach((e) => { add(e.label); add(e.pptxNote); });
  Object.values(R.ASPECT_RATIOS).forEach((e) => add(e.label));
  LAYOUTS.forEach((l) => { add(l.name); add(l.description); add(l.category); });
  THEMES.forEach((t) => { add(t.name); add(t.description); add(t.category); });
  ANIMATION_PRESETS.forEach((p) => { add(p.name); add(p.description); });
  EXPORT_PROFILES.forEach((p) => { add(p.name); add(p.description); });
  return [...s];
}

const BROKEN: string[] = [
  '{ "schemaVersion": "1.0", "title": "x" "slides": [] }',
  JSON.stringify([{ elements: [] }]),
  JSON.stringify({ title: 'T', slides: [
    { elements: [
      { type: 'title', x: '100px', y: 0, w: 400, h: 80, text: 'Hi' },
      { id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, content: 'T', opacity: 50, animation: { type: 'fade-in', duration: '0.5s', trigger: 'click' } },
      { id: 'a', type: 'img', x: 0, y: 0, width: 10, height: 10, src: 'javascript:alert(1)' },
      { id: 'c', type: 'chart', x: 0, y: 0, width: 100, height: 100, content: { type: 'doughnut', labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, 2] }] } },
      { id: 'sh', type: 'shape', x: 0, y: 0, width: 10, height: 10, content: { shape: 'circle' } },
      { id: 'im', type: 'image', x: 0, y: 0, width: 10, height: 10, content: { url: 'https://example.com/a.png' } },
    ] },
    { id: 'x', transition: 'slide', elements: [] },
    { id: 'x', transition: { type: 'magicMove', duration: '1s' }, elements: [] },
  ] }),
  JSON.stringify({ schemaVersion: '0.9', title: 'B', theme: 'nope', aspectRatio: 'weird', extra: 1, slides: [
    { id: 's1', layout: 'whatever', content: { heading: 'h' }, foo: 1, animationPreset: 'zzz', animations: { heading: [{ effect: 'nope' }] } },
    { id: 's2', layout: 'title', content: { heading: 'h', chart: { chartType: 'column', categories: ['a'], series: [{ name: 's', values: [1] }] } } },
    { id: 's3', transition: 'morph', elements: [{ id: 'q', type: 'text', x: 0, y: 0, width: 10, height: 10, content: { text: 'a' } }] },
    { id: 's4', transition: 'cube', background: 'notacolor', elements: [
      { id: 'e1', type: 'text', x: 'abc', y: 0, width: 10, height: 10, content: { text: '' }, bogus: 1, style: { weird: 1, color: 'xyz' } },
      { id: 'e2', type: 'nonsense', x: 0, y: 0, width: 10, height: 10, content: {} },
      { id: 'e3', type: 'image', x: 5000, y: 5000, width: 10, height: 10, content: {} },
      { id: 'e4', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'column', categories: ['a', 'b', 'c'], series: [{ name: 'S', values: [1, 'x'] }] } },
      { id: 'e5', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'pie', categories: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], series: [{ name: 'S', values: [1, -2, 3, 4, 5, 6, 7, 8, 9] }, { name: 'T', values: [1, 2, 3, 4, 5, 6, 7, 8, 9] }] } },
      { id: 'e6', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'scatter', series: [{ name: 'S' }] } },
      { id: 'e7', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'line', categories: ['a', 'b'], series: [{ name: 'S', values: [1, 2] }] } },
      { id: 'e8', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'nope', series: [] } },
      { id: 'e9', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'histogram', series: [{ name: 'h', values: [1] }] } },
      { id: 'e10', type: 'chart', x: 0, y: 0, width: 10, height: 10, content: { chartType: 'bar', series: [{ name: 'h', values: [1] }] } },
      { id: 'e11', type: 'diagram', x: 0, y: 0, width: 10, height: 10, content: { kind: 'flowchart', nodes: [{ id: 'a', label: 'A' }], edges: [{ from: 'a', to: 'z' }] } },
      { id: 'e12', type: 'diagram', x: 0, y: 0, width: 10, height: 10, content: { kind: 'swot', items: [{ title: 'a' }] } },
      { id: 'e13', type: 'diagram', x: 0, y: 0, width: 10, height: 10, content: { kind: 'process' } },
      { id: 'e14', type: 'table', x: 1900, y: 0, width: 100, height: 10, content: { rows: [['a', 'b'], ['c']] } },
      { id: 'e15', type: 'video', x: 0, y: 0, width: 10, height: 10, content: { src: 'javascript:x' } },
      { id: 'e16', type: 'shape', x: 0, y: 0, width: 10, height: 10, content: { shape: 'blob' }, animation: [{ effect: 'blurIn' }, { effect: 'fadeIn', trigger: 'onExit', foo: 1 }, 'fade', { duration: 1 }] },
      { id: 'e17', type: 'image', x: 0, y: 0, width: 10, height: 10, content: { src: 'ftp://x' } },
      { id: 'e18', type: 'group', x: 0, y: 0, width: 10, height: 10, content: { children: [{ id: 'k', type: 'text', x: 0, y: 0, width: 5, height: 5 }] } },
      { id: 'e19', type: 'text', x: 0, y: 0, width: 10, height: 10, opacity: 7, content: { text: 'a' }, animation: { effect: 'fadeIn' } },
    ] },
    { id: 's5' },
  ], part: { index: 1, total: 2, presentationId: 'p' } }),
  'export default { schemaVersion: "1.0", title: fetch("x"), slides: [] }',
  'export const x = 1;',
  'const a = foo; export default { schemaVersion: "1.0", title: a, slides: [{ id: "s", layout: "title", content: { heading: "h" } }] }',
  'export default () => <Presentation title="x"><Slide>loose text<Fancy>Keep</Fancy><Notes>n</Notes></Slide><Heading>out</Heading></Presentation>',
  'export default function D(){ return <div/> }',
  'hello there',
  '',
  '# Title\n\n---\n',
  '```json\n{"schemaVersion":"1.0","title":"T","slides":[{"id":"a","layout":"title","content":{"heading":"Hi"}},],} // c\n```',
  '```json\n' + JSON.stringify({ schemaVersion: '1.0', title: 'L', part: { index: 1, total: 2, presentationId: 'd' }, slides: [{ id: 'a', layout: 'title', content: { heading: 'A' } }] }) + '\n```\n```json\n' + JSON.stringify({ schemaVersion: '1.0', title: 'L', part: { index: 2, total: 2, presentationId: 'd' }, slides: [{ id: 'b', layout: 'title', content: { heading: 'B' } }] }) + '\n```',
];

async function collectMessages(): Promise<string[]> {
  const out = new Set<string>();
  const add = (s?: string) => { if (s && s.trim()) out.add(s); };
  for (const code of BROKEN) {
    const a = analyzeCode(code);
    a.report.issues.forEach((i) => add(i.message));
    const f = analyzeCode(code, { autoFix: true });
    f.report.fixesApplied.forEach(add);
    f.report.issues.forEach((i) => add(i.message));
    if (a.data) autoFix(a.data).fixes.forEach(add);
  }
  const decks: Presentation[] = SAMPLES.map((s) => importPresentation(JSON.stringify(s.data)).presentation!);
  // deck with unresolved image queries, media, formula, fonts, overflow, offcanvas, morph without match
  const odd = importPresentation(JSON.stringify({ schemaVersion: '1.0', title: 'Odd', theme: 'luxury-black-gold', slides: [
    { id: 'a', elements: [
      { id: 'i', type: 'image', x: 0, y: 0, width: 400, height: 300, content: { query: 'cat', alt: 'cat' } },
      { id: 'i2', type: 'image', x: 0, y: 0, width: 400, height: 300, content: { src: 'https://example.com/x.png', alt: 'x' } },
      { id: 'v', type: 'video', x: 0, y: 0, width: 400, height: 300, content: { src: 'https://example.com/v.mp4' } },
      { id: 'y', type: 'video', x: 0, y: 0, width: 400, height: 300, content: { src: 'https://youtu.be/abcdefg' } },
      { id: 'au', type: 'audio', x: 0, y: 0, width: 400, height: 100, content: { src: 'https://example.com/a.mp3' } },
      { id: 'f', type: 'formula', x: 0, y: 0, width: 400, height: 100, content: { latex: 'x^2' } },
      { id: 't', type: 'text', x: 1800, y: 1000, width: 400, height: 20, opacity: 0.5, content: { text: 'very long text '.repeat(40) }, style: { fontFamily: 'Comic Neue', fontSize: 12 } },
      { id: 'dc', type: 'decorative', x: 0, y: 0, width: 100, height: 100, content: { kind: 'blob' } },
      { id: 'v3', type: 'visual3d', x: 0, y: 0, width: 100, height: 100, content: { kind: 'cube' } },
      { id: 'w', type: 'chart', x: 0, y: 0, width: 600, height: 400, content: { chartType: 'waterfall', categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] } },
      { id: 'ic', type: 'icon', x: 0, y: 0, width: 100, height: 100, content: { name: 'star' } },
      { id: 'sv', type: 'svg', x: 0, y: 0, width: 100, height: 100, content: { markup: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>' } },
      { id: 'mk', type: 'image', x: 0, y: 0, width: 100, height: 100, content: { query: 'x' }, style: { mask: 'blob', grayscale: true } },
      { id: 'g', type: 'group', x: 0, y: 0, width: 100, height: 100, content: { children: [{ id: 'k', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' } }] } },
    ] },
    { id: 'b', transition: { type: 'morph' }, background: { type: 'image', image: { query: 'sea' } }, elements: [
      { id: 'zz', type: 'text', x: 0, y: 0, width: 10, height: 10, content: { text: 'x' }, animation: [{ effect: 'typewriter' }, { effect: 'fadeIn', trigger: 'onExit' }, { effect: 'motionPath', path: { type: 'custom', d: 'M0 0 A 10 10 0 0 1 20 20' } }] },
    ] },
    { id: 'c', transition: { type: 'cube', sound: 'whoosh' }, hidden: true, elements: [] },
  ] })).presentation!;
  decks.push(odd);
  for (const d of decks) {
    for (const profile of ['standard', 'highFidelity', 'presentation', 'editable'] as const) {
      const pf = preflight(d, { profile });
      [...pf.errors, ...pf.warnings, ...pf.info, ...pf.support.supported, ...pf.support.partial, ...pf.support.unsupported].forEach(add);
      pf.checks.forEach((c) => { add(c.name); add(c.detail); });
    }
    const { report } = await exportPptx(d);
    [...report.errors, ...report.warnings, ...report.info, ...report.support.supported, ...report.support.partial, ...report.support.unsupported].forEach(add);
    report.checks.forEach((c) => { add(c.name); add(c.detail); });
    const q = checkPresentation(d);
    q.issues.forEach((i) => { add(i.message); add(i.suggestion); });
    q.categories.forEach((c) => add(c.label));
  }
  // crafted bad slide for quality checker
  const bad = importPresentation(JSON.stringify({ schemaVersion: '1.0', title: 'Bad', slides: [{ id: 'b', elements: [
    { id: 'h', type: 'heading', x: 2, y: 2, width: 1900, height: 60, content: { text: 'A very very long heading that keeps going and going far beyond what any reasonable slide title should ever be allowed to contain' }, style: { fontSize: 20, color: '#eeeeee', fontFamily: 'A' } },
    { id: 'p', type: 'paragraph', x: 10, y: 10, width: 300, height: 30, content: { text: 'word '.repeat(220) }, style: { fontSize: 12, color: '#f0f0f0', fontFamily: 'B' } },
    { id: 'p2', type: 'paragraph', x: 10, y: 10, width: 300, height: 30, content: { text: 'x' }, style: { fontFamily: 'C', fill: '#123456' } },
    { id: 'p3', type: 'text', x: 20, y: 20, width: 300, height: 30, content: { text: 'y' }, style: { fontFamily: 'D', fill: '#ab1234' } },
    { id: 's1', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#ff0000' } },
    { id: 's2', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#00ff00' } },
    { id: 's3', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#0000ff' } },
    { id: 's4', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#ffff00' } },
    { id: 's5', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#00ffff' } },
    { id: 's6', type: 'shape', x: 0, y: 0, width: 50, height: 50, content: { shape: 'rect' }, style: { fill: '#ff00ff' } },
    { id: 'c', type: 'chart', x: 0, y: 500, width: 400, height: 300, content: { chartType: 'column', categories: ['a', 'b'], series: [{ name: 'a', values: [1, 2] }, { name: 'b', values: [1, 2] }], showLegend: false, showAxis: false } },
    { id: 'i', type: 'image', x: 1500, y: 500, width: 400, height: 300, content: { query: 'q' } },
  ] }, { id: 'e', elements: [] }, { id: 'f', elements: [{ id: 't', type: 'text', x: 100, y: 100, width: 500, height: 50, content: { text: 'same' } }, { id: 't2', type: 'text', x: 100, y: 200, width: 500, height: 50, content: { text: 'same' } }] }] })).presentation!;
  const q = checkPresentation(bad);
  q.issues.forEach((i) => { add(i.message); add(i.suggestion); });
  const pf = preflight(bad);
  [...pf.errors, ...pf.warnings, ...pf.info].forEach(add);
  // assistant
  const theme = getTheme('modern-corporate');
  const size = { width: 1920, height: 1080 };
  const mk = (c: Record<string, unknown>): Slide => { const r = buildLayout('singleColumn', c, theme, size); return { id: 's', layout: r.layout, content: c, elements: r.elements.map((e) => normalizeElement(e)) }; };
  const slides = [
    mk({ heading: 'H', body: 'One sentence here. Second sentence follows. Third sentence also. Fourth is long enough to exceed the threshold for reduction of text.', bullets: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'] }),
    mk({ heading: 'H', bullets: ['North: 42%', 'South: 35%', 'East: 23%'] }),
    mk({ heading: 'H', bullets: ['2023: Founded', '2024: Launch – first users'] }),
    mk({ heading: 'H', bullets: ['plain'] }),
    mk({ heading: 'H', body: 'short' }),
    { ...mk({ heading: 'H', body: 'b' }), layout: undefined },
  ];
  slides[4].elements.forEach((e) => { if (e.content?.paragraphs) e.style = { ...e.style, color: '#fefefe' }; });
  const actions: AssistantAction[] = ['suggest', 'visual', 'reduce', 'hierarchy', 'balance', 'contrast', 'infographic', 'timeline', 'chart', 'alternative'];
  for (const s of slides) for (const a of actions) generateCandidates(a, s, theme, size).forEach((c) => { add(c.title); add(c.description); c.warnings?.forEach(add); });
  // chart suggestions
  const charts: Partial<ChartContent>[] = [
    { categories: ['2021', '2022', '2023', '2024'], series: [{ name: 's', values: [1, 2, 3, 4] }] },
    { categories: ['2021', '2022', '2023', '2024'], series: [{ name: 's', values: [1, 2, 3, 4] }, { name: 't', values: [1, 2, 3, 4], axis: 'secondary' }] },
    { categories: ['Visitors', 'Sign-ups', 'Trials', 'Customers'], series: [{ name: 'n', values: [1000, 300, 100, 30] }] },
    { categories: ['a', 'b', 'c'], series: [{ name: 'Share %', values: [50, 30, 20] }] },
    { categories: 'abcdefghij'.split(''), series: [{ name: 's', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }] },
    { categories: ['a very long label indeed', 'b'], series: [{ name: 's', values: [1, 2] }] },
    { categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] },
    { series: [{ name: 's', points: [{ x: 1, y: 2 }] }] },
    { series: [{ name: 's', points: [{ x: 1, y: 2, size: 3 }] }] },
  ];
  charts.forEach((c) => add(suggestChartType({ chartType: 'bar', ...c } as ChartContent)?.reason));
  add(chartMisuse({ chartType: 'pie', categories: ['a'], series: [{ name: 's', values: [-1] }] } as ChartContent) ?? undefined);
  add(chartMisuse({ chartType: 'donut', categories: ['a'], series: [{ name: 's', values: [1] }, { name: 't', values: [1] }] } as ChartContent) ?? undefined);
  add(chartMisuse({ chartType: 'line', categories: ['a', 'b'], series: [{ name: 's', values: [1, 2] }] } as ChartContent) ?? undefined);
  return [...out];
}

describe('Vietnamese i18n — registry & generated messages', () => {
  it('every registry label has a Vietnamese entry', () => {
    const missing = registryStrings().filter((s) => !(s in REGISTRY));
    expect(missing).toEqual([]);
  });

  it('translates ≥ 95% of real generated messages, without template leftovers', async () => {
    useLang.setState({ lang: 'vi' });
    const msgs = await collectMessages();
    // proper-noun data (font lists, "13.33\" × 7.50\" (16:9)") needs no translation
    const isData = (m: string) => /^[\s\d%·.,:;/()\-–—"×x]+$/.test(m) || /^[A-Z0-9][\w-]*( [A-Z0-9][\w-]*)*(, [A-Z0-9][\w-]*( [A-Z0-9][\w-]*)*)*$/.test(m) || /^[\d.]+" × [\d.]+" \([\w:-]+\)$/.test(m);
    const untranslated = msgs.filter((m) => trMsg(m) === m && !isData(m));
    const bad = msgs.filter((m) => { const t = trMsg(m); return (/\$\d/.test(t) && !/\$\d/.test(m)) || (/undefined/.test(t) && !/undefined/.test(m)); });
    if (bad.length) console.log('BAD', bad.map((m) => `${m} => ${trMsg(m)}`).join('\n'));
    if (process.env.I18N_DUMP) fs.writeFileSync(process.env.I18N_DUMP, JSON.stringify({ total: msgs.length, untranslated }, null, 1));
    if (untranslated.length) console.log(`untranslated ${untranslated.length}/${msgs.length}:\n` + untranslated.slice(0, 80).join('\n'));
    expect(bad).toEqual([]);
    expect(msgs.length).toBeGreaterThan(100);
    expect(1 - untranslated.length / msgs.length).toBeGreaterThanOrEqual(0.95);
    useLang.setState({ lang: 'en' });
  }, 120_000);
});
