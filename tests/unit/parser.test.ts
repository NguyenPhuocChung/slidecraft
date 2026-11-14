import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { analyzeCode, autoFix, importPresentation } from '@/code-parser';
import { detectFormat } from '@/code-parser/detect';

const minimal = { schemaVersion: '1.0', title: 'T', slides: [{ id: 's1', elements: [{ id: 'h', type: 'heading', x: 100, y: 100, width: 800, height: 120, content: { text: 'Hello **world**' } }] }] };
const dom = { parseFromString: (s: string, t: string) => new new JSDOM('').window.DOMParser().parseFromString(s, t as DOMParserSupportedType) };

describe('format detection', () => {
  it('detects formats', () => {
    expect(detectFormat('{"a":1}')).toBe('json');
    expect(detectFormat('export default { slides: [] }')).toBe('js');
    expect(detectFormat('export default function D(){ return (<Presentation title="x"><Slide/></Presentation>) }')).toBe('tsx');
    expect(detectFormat('<section><h1>Hi</h1></section>')).toBe('html');
    expect(detectFormat('# Title\n\n---\n\n## Two')).toBe('markdown');
  });
});

describe('JSON import', () => {
  it('imports a minimal presentation and converts markdown-lite', () => {
    const { presentation, analysis } = importPresentation(JSON.stringify(minimal));
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.slides[0].elements[0].content.paragraphs[0].runs).toEqual([{ text: 'Hello ' }, { text: 'world', bold: true }]);
    expect(presentation!.size).toEqual({ width: 1920, height: 1080 });
  });
  it('strips ```json fences and tolerates comments / trailing commas', () => {
    const code = '```json\n{ // c\n"schemaVersion":"1.0","title":"T","slides":[{"id":"a","layout":"title","content":{"heading":"Hi"}},],}\n```';
    const a = analyzeCode(code);
    expect(a.report.ok).toBe(true);
    expect(a.report.issues.some((i) => i.code === 'markdown.fence')).toBe(true);
  });
  it('reports syntax errors with line numbers', () => {
    const a = analyzeCode('{\n  "schemaVersion": "1.0",\n  "title": "x"\n  "slides": []\n}');
    const e = a.report.issues.find((i) => i.code === 'syntax');
    expect(e?.line).toBe(4);
    expect(a.report.ok).toBe(false);
  });
  it('maps schema errors to source lines', () => {
    const src = JSON.stringify({ ...minimal, slides: [{ id: 's1', elements: [{ id: 'x', type: 'heading', x: 'abc', y: 0, width: 10, height: 10, content: { text: 'a' } }] }] }, null, 2);
    const a = analyzeCode(src);
    const e = a.report.issues.find((i) => i.code === 'element.geometry');
    expect(e).toBeTruthy();
    expect(e!.line).toBeGreaterThan(5);
  });
  it('flags chart data mismatches and never pads data', () => {
    const p = { ...minimal, slides: [{ id: 's', elements: [{ id: 'c', type: 'chart', x: 0, y: 0, width: 800, height: 400, content: { chartType: 'column', categories: ['a', 'b', 'c'], series: [{ name: 'S', values: [1, 2] }] } }] }] };
    const a = analyzeCode(JSON.stringify(p), { autoFix: true });
    expect(a.report.issues.some((i) => i.code === 'chart.length')).toBe(true);
    expect(a.report.ok).toBe(false);
  });
  it('blocks javascript: URLs', () => {
    const p = { ...minimal, slides: [{ id: 's', elements: [{ id: 'i', type: 'image', x: 0, y: 0, width: 10, height: 10, content: { src: 'javascript:alert(1)', alt: 'x' } }] }] };
    expect(analyzeCode(JSON.stringify(p)).report.issues.some((i) => i.code === 'security.url')).toBe(true);
    const fixed = autoFix(p).data as typeof p;
    expect((fixed.slides[0].elements[0].content as Record<string, unknown>).src).toBeUndefined();
    expect((fixed.slides[0].elements[0].content as Record<string, unknown>).query).toBe('x');
  });
});

describe('Auto Fix', () => {
  it('fixes aliases, ids, units and versions without losing content', () => {
    const raw = { title: 'X', slides: [{ elements: [
      { type: 'title', x: '100px', y: 50, w: 400, h: 80, text: 'Hi' },
      { type: 'img', x: 0, y: 0, width: 10, height: 10, src: 'https://example.com/a.png' },
      { id: 'c', type: 'chart', x: 0, y: 0, width: 100, height: 100, content: { type: 'doughnut', labels: ['a', 'b'], datasets: [{ label: 'S', data: [1, 2] }] } },
      { id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, content: 'T', animation: { type: 'fade-in', duration: '0.5s', trigger: 'click' } },
    ] }, { transition: 'slide', elements: [] }] };
    const { data, fixes } = autoFix(raw);
    const d = data as { schemaVersion: string; slides: { id: string; transition: string; elements: Record<string, any>[] }[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(d.schemaVersion).toBe('1.0');
    expect(d.slides[0].id).toBe('slide-1');
    const [h, img, chart, txt] = d.slides[0].elements;
    expect(h).toMatchObject({ type: 'heading', x: 100, width: 400, height: 80, content: { text: 'Hi' } });
    expect(img.content.src).toBe('https://example.com/a.png');
    expect(chart.content).toMatchObject({ chartType: 'donut', categories: ['a', 'b'], series: [{ name: 'S', values: [1, 2] }] });
    expect(txt.animation[0]).toMatchObject({ effect: 'fadeIn', duration: 500, trigger: 'onClick' });
    expect(d.slides[1].transition).toBe('push');
    expect(fixes.length).toBeGreaterThan(8);
    expect(importPresentation(JSON.stringify(d)).analysis.report.ok).toBe(true);
  });
});

describe('JS object import (static, nothing executed)', () => {
  it('evaluates consts, templates, spreads and .map', () => {
    const code = `const brand = '$accent';
const points = ['One', 'Two', 'Three'];
const base = { schemaVersion: '1.0' };
export default { ...base, title: \`Deck \${1 + 1}\`, slides: points.map((p, i) => ({ id: 's' + i, layout: 'title', content: { heading: p.toUpperCase(), eyebrow: brand } })) };`;
    const { presentation, analysis } = importPresentation(code);
    expect(analysis.report.format).toBe('js');
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.title).toBe('Deck 2');
    expect(presentation!.slides).toHaveLength(3);
  });
  it('refuses to execute function calls', () => {
    const a = analyzeCode('export default { schemaVersion: "1.0", title: fetch("x"), slides: [] }');
    expect(a.report.ok).toBe(false);
    expect(a.report.issues[0].message).toMatch(/not allowed/);
  });
});

describe('TSX import', () => {
  it('converts components, containers and composite components', () => {
    const code = `import { Presentation, Slide, Heading, Text, Chart, Card, Stack, Grid } from 'slidecraft';
const data = [3, 5, 8];
export default function Deck() {
  return (
    <Presentation title="TSX deck" theme="dark-premium">
      <Slide id="one" transition="fade" notes="hi">
        <Heading level={1} animation="fadeIn">Hello <b>TSX</b></Heading>
        <Text>Auto-stacked paragraph</Text>
        <Chart type="column" categories={['A','B','C']} series={[{ name: 'S', values: data }]} height={400} />
      </Slide>
      <Slide id="two">
        <Grid x={120} y={200} width={1680} height={600} columns={3}>
          {['a','b','c'].map((t) => <Card key={t} title={t} text="desc" icon="star" />)}
        </Grid>
        <Notes>Speaker notes here</Notes>
      </Slide>
    </Presentation>
  );
}`;
    const { presentation, analysis } = importPresentation(code);
    expect(analysis.report.format).toBe('tsx');
    expect(analysis.report.errorCount).toBe(0);
    const [s1, s2] = presentation!.slides;
    expect(s1.transition?.type).toBe('fade');
    expect(s1.elements.map((e) => e.type)).toEqual(['heading', 'text', 'chart']);
    expect(s1.elements[1].y).toBeGreaterThan(s1.elements[0].y + s1.elements[0].height - 1);
    expect(s1.elements[0].animation?.[0].effect).toBe('fadeIn');
    expect(s2.elements.filter((e) => e.id.endsWith('-title'))).toHaveLength(3);
    expect(s2.notes).toBe('Speaker notes here');
  });
  it('keeps text of unknown components with a warning', () => {
    const { presentation, analysis } = importPresentation('export default () => <Presentation title="x"><Slide><Fancy>Keep me</Fancy></Slide></Presentation>');
    expect(analysis.report.issues.some((i) => i.code === 'tsx.unknownComponent')).toBe(true);
    expect(JSON.stringify(presentation!.slides[0].elements)).toContain('Keep me');
  });
});

describe('HTML and Markdown adapters', () => {
  it('converts reveal-style HTML into layout slides', () => {
    const html = `<section data-transition="fade"><h1>Title</h1><h3>Sub</h3></section>
<section><h2>Points</h2><ul><li>A</li><li><strong>B</strong></li></ul><aside class="notes">n</aside><script>alert(1)</script></section>
<section><blockquote>Quote text<cite>— Ada</cite></blockquote></section>`;
    const { presentation, analysis } = importPresentation(html, { domParser: dom });
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.slides).toHaveLength(3);
    expect(presentation!.slides[1].content?.bullets).toEqual(['A', '**B**']);
    expect(presentation!.slides[1].notes).toBe('n');
    expect(presentation!.slides[2].layout).toBe('quote');
    expect(JSON.stringify(presentation)).not.toContain('alert(1)');
  });
  it('converts markdown slides', () => {
    const md = `---\ntitle: MD deck\ntheme: swiss-design\n---\n# Intro\nWelcome\n\n---\n## Data\n| A | B |\n|---|---|\n| 1 | 2 |\n\n---\n## Code\n\`\`\`ts\nconst a = 1;\n\`\`\``;
    const { presentation, analysis } = importPresentation(md);
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.theme).toBe('swiss-design');
    expect(presentation!.slides[1].layout).toBe('tableFocus');
    expect(presentation!.slides[2].layout).toBe('codeFocus');
  });
});

describe('multi-part import', () => {
  it('merges parts in order', () => {
    const p1 = { schemaVersion: '1.0', title: 'Long', part: { index: 1, total: 2, presentationId: 'deck-x' }, slides: [{ id: 'a', layout: 'title', content: { heading: 'A' } }] };
    const p2 = { schemaVersion: '1.0', title: 'Long', part: { index: 2, total: 2, presentationId: 'deck-x' }, slides: [{ id: 'b', layout: 'title', content: { heading: 'B' } }, { id: 'a', layout: 'title', content: { heading: 'dup' } }] };
    const code = '```json\n' + JSON.stringify(p2) + '\n```\n\n```json\n' + JSON.stringify(p1) + '\n```';
    const { presentation, analysis } = importPresentation(code);
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.slides.map((s) => s.id)).toEqual(['a', 'b', 'a-p2']);
    expect(presentation!.id).toBe('deck-x');
  });
});

describe('slide-level animations (layout mode)', () => {
  it('applies animationPreset and per-id animations to layout-generated elements', () => {
    const p = { schemaVersion: '1.0', title: 'A', slides: [
      { id: 's1', layout: 'statistics', content: { heading: 'H', stats: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }] }, animationPreset: 'data' },
      { id: 's2', layout: 'title', content: { heading: 'T', subheading: 'S' }, animations: { heading: [{ effect: 'rise', trigger: 'onEnter' }], subheading: { effect: 'fadeIn', trigger: 'afterPrevious' } } },
    ] };
    const { presentation, analysis } = importPresentation(JSON.stringify(p));
    expect(analysis.report.ok).toBe(true);
    expect(presentation!.slides[0].elements.filter((e) => e.animation?.length).length).toBeGreaterThan(2);
    const s2 = presentation!.slides[1];
    expect(s2.elements.find((e) => e.id === 'heading')!.animation![0].effect).toBe('rise');
    expect(s2.elements.find((e) => e.id === 'subheading')!.animation![0].trigger).toBe('afterPrevious');
    expect((s2 as Record<string, unknown>).animations).toBeUndefined();
  });
  it('rejects unknown presets', () => {
    const a = analyzeCode(JSON.stringify({ schemaVersion: '1.0', title: 'A', slides: [{ id: 's', layout: 'title', content: { heading: 'x' }, animationPreset: 'nope' }] }));
    expect(a.report.issues.some((i) => i.code === 'animation.preset')).toBe(true);
  });
});
