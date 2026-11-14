/**
 * SlideCraft Component Library (TSX authoring).
 * Every component maps to contract elements — primitives are kept 1:1, higher-level
 * components (Card, Statistic, Quote, ...) expand to editable primitives.
 */
import { CHART_TYPE_IDS, DIAGRAM_KIND_IDS } from '@/types/registry';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Raw = Record<string, any>;
export interface Frame { x: number; y: number; width: number; height: number }

export interface ComponentDef {
  /** primitive element type, or 'expand' for composites, or 'container' */
  kind: 'element' | 'expand' | 'container' | 'meta';
  type?: string;
  defaultSize: { width: number | 'fill'; height: number | 'auto' };
  description: string;
  props: string;
  /** Build `content` from props + text children for primitives */
  content?: (p: Raw, text: string) => Raw;
  /** Expand into primitives for composites */
  expand?: (p: Raw, text: string, f: Frame, id: string) => Raw[];
}

const chartAlias = (chartType: string): ComponentDef => ({
  kind: 'element', type: 'chart', defaultSize: { width: 'fill', height: 560 },
  description: `${chartType} chart`, props: 'categories, series=[{name, values}], title, valueSuffix, showLegend, showLabels, source',
  content: (p) => ({ ...pick(p, CHART_KEYS), chartType: p.chartType ?? chartType, series: p.series ?? (p.data ? [{ name: p.name ?? 'Series 1', values: p.data }] : []) }),
});
const diagramAlias = (kind: string, desc: string): ComponentDef => ({
  kind: 'element', type: 'diagram', defaultSize: { width: 'fill', height: 560 }, description: desc, props: 'items=[{title, text, icon, children}], center, nodes, edges, direction',
  content: (p) => ({ kind, ...pick(p, ['items', 'nodes', 'edges', 'direction', 'center', 'axes']) }),
});
const CHART_KEYS = ['chartType', 'title', 'categories', 'series', 'valuePrefix', 'valueSuffix', 'decimals', 'showLegend', 'legendPosition', 'showLabels', 'showGrid', 'showAxis', 'stacked', 'horizontal', 'smooth', 'xAxisTitle', 'yAxisTitle', 'bins', 'totals', 'centerLabel', 'source'];

export function pick(o: Raw, keys: string[]): Raw {
  const r: Raw = {};
  for (const k of keys) if (o[k] !== undefined) r[k] = o[k];
  return r;
}

const textContent = (_p: Raw, text: string) => ({ text });

export const COMPONENTS: Record<string, ComponentDef> = {
  Presentation: { kind: 'meta', defaultSize: { width: 0, height: 0 }, description: 'Root. Props: title, theme, aspectRatio, author, description, language', props: 'title, theme, aspectRatio, author, description, language, globalStyles' },
  Slide: { kind: 'meta', defaultSize: { width: 0, height: 0 }, description: 'One slide. Children are elements (auto-stacked when x/y are omitted).', props: 'id, layout, content, background, transition, notes, duration, section, title' },
  Notes: { kind: 'meta', defaultSize: { width: 0, height: 0 }, description: 'Speaker notes (text children).', props: '' },
  Heading: { kind: 'element', type: 'heading', defaultSize: { width: 'fill', height: 'auto' }, description: 'Title text. level 0 (display) – 3', props: 'level, color, align, fontSize', content: textContent },
  Text: { kind: 'element', type: 'text', defaultSize: { width: 'fill', height: 'auto' }, description: 'Text (markdown-lite)', props: 'color, align, fontSize', content: textContent },
  Paragraph: { kind: 'element', type: 'paragraph', defaultSize: { width: 'fill', height: 'auto' }, description: 'Body paragraph', props: 'color, align, fontSize', content: textContent },
  RichText: { kind: 'element', type: 'richText', defaultSize: { width: 'fill', height: 'auto' }, description: 'Paragraph runs', props: 'paragraphs', content: (p, t) => (p.paragraphs ? { paragraphs: p.paragraphs } : { text: t }) },
  Image: { kind: 'element', type: 'image', defaultSize: { width: 800, height: 500 }, description: 'Image by src or query', props: 'src, query, alt, credit, fit, mask, radius', content: (p) => pick(p, ['src', 'query', 'alt', 'credit', 'license', 'sourceUrl']) },
  Picture: { kind: 'element', type: 'image', defaultSize: { width: 800, height: 500 }, description: 'Alias of Image', props: 'src, query, alt', content: (p) => pick(p, ['src', 'query', 'alt', 'credit', 'license', 'sourceUrl']) },
  Icon: { kind: 'element', type: 'icon', defaultSize: { width: 96, height: 96 }, description: 'Icon by name', props: 'name, color, strokeWidth', content: (p) => ({ name: p.name }) },
  Svg: { kind: 'element', type: 'svg', defaultSize: { width: 400, height: 400 }, description: 'Inline SVG markup', props: 'markup', content: (p, t) => ({ markup: p.markup ?? t }) },
  Shape: { kind: 'element', type: 'shape', defaultSize: { width: 400, height: 240 }, description: 'Shape with optional text', props: 'shape, fill, stroke, radius', content: (p, t) => ({ shape: p.shape ?? 'rect', ...(t ? { text: t } : {}) }) },
  Line: { kind: 'element', type: 'line', defaultSize: { width: 400, height: 1 }, description: 'Line x1,y1 → x2,y2', props: 'x1, y1, x2, y2, color, thickness', content: (p) => pick(p, ['x1', 'y1', 'x2', 'y2']) },
  Arrow: { kind: 'element', type: 'arrow', defaultSize: { width: 400, height: 1 }, description: 'Arrow x1,y1 → x2,y2', props: 'x1, y1, x2, y2, color, thickness, headStart, headEnd', content: (p) => pick(p, ['x1', 'y1', 'x2', 'y2']) },
  Table: { kind: 'element', type: 'table', defaultSize: { width: 'fill', height: 420 }, description: 'Table', props: 'rows, header, firstColumn, columnWidths, highlightRows, caption', content: (p) => pick(p, ['rows', 'header', 'firstColumn', 'columnWidths', 'highlightRows', 'caption']) },
  Chart: { kind: 'element', type: 'chart', defaultSize: { width: 'fill', height: 560 }, description: `Chart (type: ${CHART_TYPE_IDS.join(' | ')})`, props: 'type, categories, series, ...', content: (p) => ({ ...pick(p, CHART_KEYS), chartType: p.type ?? p.chartType ?? 'column' }) },
  BarChart: chartAlias('bar'),
  ColumnChart: chartAlias('column'),
  StackedBarChart: chartAlias('stackedBar'),
  LineChart: chartAlias('line'),
  AreaChart: chartAlias('area'),
  PieChart: chartAlias('pie'),
  DonutChart: chartAlias('donut'),
  ScatterChart: chartAlias('scatter'),
  BubbleChart: chartAlias('bubble'),
  RadarChart: chartAlias('radar'),
  WaterfallChart: chartAlias('waterfall'),
  FunnelChart: chartAlias('funnel'),
  ComboChart: chartAlias('combo'),
  Histogram: chartAlias('histogram'),
  Treemap: chartAlias('treemap'),
  Diagram: { kind: 'element', type: 'diagram', defaultSize: { width: 'fill', height: 560 }, description: `Diagram (kind: ${DIAGRAM_KIND_IDS.join(' | ')})`, props: 'kind, items, nodes, edges, center', content: (p) => ({ kind: p.kind ?? 'process', ...pick(p, ['items', 'nodes', 'edges', 'direction', 'center', 'axes']) }) },
  SmartArt: { kind: 'element', type: 'smartart', defaultSize: { width: 'fill', height: 560 }, description: 'SmartArt-like graphic', props: 'kind, items', content: (p) => ({ kind: p.kind ?? 'list', ...pick(p, ['items', 'nodes', 'edges', 'direction', 'center', 'axes']) }) },
  Process: diagramAlias('process', 'Linear process'),
  ChevronProcess: diagramAlias('chevronProcess', 'Chevron process'),
  Cycle: diagramAlias('cycle', 'Cycle diagram'),
  Pyramid: diagramAlias('pyramid', 'Pyramid'),
  Funnel: diagramAlias('funnel', 'Funnel diagram'),
  FlowChart: diagramAlias('flowchart', 'Flowchart (nodes + edges)'),
  MindMap: diagramAlias('mindmap', 'Mind map (center + items/children)'),
  OrgChart: diagramAlias('orgchart', 'Org chart (items/children)'),
  Hierarchy: diagramAlias('hierarchy', 'Hierarchy tree'),
  Roadmap: diagramAlias('roadmap', 'Roadmap phases'),
  Comparison: diagramAlias('comparison', 'Comparison columns'),
  BeforeAfter: diagramAlias('beforeAfter', 'Before / After'),
  SWOT: diagramAlias('swot', 'SWOT matrix'),
  Matrix: diagramAlias('matrix', '2×2 matrix'),
  Venn: diagramAlias('venn', 'Venn diagram'),
  Hub: diagramAlias('hub', 'Hub & spoke'),
  StrategyMap: diagramAlias('strategyMap', 'Strategy map'),
  Timeline: { kind: 'element', type: 'timeline', defaultSize: { width: 'fill', height: 420 }, description: 'Timeline', props: 'items=[{date, title, text}], orientation, style', content: (p) => ({ items: p.items ?? [], orientation: p.orientation ?? 'horizontal', style: p.variant ?? p.timelineStyle ?? 'milestones' }) },
  Infographic: { kind: 'element', type: 'infographic', defaultSize: { width: 'fill', height: 440 }, description: 'Infographic (kpiGrid, progressBars, statRings, numberedList, iconList, pictogram, comparisonBars)', props: 'kind, items, columns, total, icon, labels', content: (p) => ({ kind: p.kind ?? 'kpiGrid', ...pick(p, ['items', 'columns', 'total', 'icon', 'labels']) }) },
  Equation: { kind: 'element', type: 'formula', defaultSize: { width: 900, height: 200 }, description: 'LaTeX formula', props: 'latex, display', content: (p, t) => ({ latex: p.latex ?? t, display: p.display ?? true }) },
  Formula: { kind: 'element', type: 'formula', defaultSize: { width: 900, height: 200 }, description: 'Alias of Equation', props: 'latex', content: (p, t) => ({ latex: p.latex ?? t, display: p.display ?? true }) },
  CodeBlock: { kind: 'element', type: 'code', defaultSize: { width: 'fill', height: 480 }, description: 'Code block', props: 'language, code, showLineNumbers, title', content: (p, t) => ({ code: p.code ?? t, ...pick(p, ['language', 'showLineNumbers', 'title', 'highlightLines']) }) },
  Video: { kind: 'element', type: 'video', defaultSize: { width: 960, height: 540 }, description: 'Video embed', props: 'src, poster, autoplay, loop, muted', content: (p) => pick(p, ['src', 'poster', 'autoplay', 'loop', 'muted', 'controls', 'title']) },
  Audio: { kind: 'element', type: 'audio', defaultSize: { width: 520, height: 96 }, description: 'Audio embed', props: 'src, autoplay, loop', content: (p) => pick(p, ['src', 'autoplay', 'loop', 'controls', 'title']) },
  Decor: { kind: 'element', type: 'decorative', defaultSize: { width: 600, height: 600 }, description: 'Decorative background element', props: 'kind, colors', content: (p) => pick(p, ['kind', 'colors', 'density', 'seed']) },
  Visual3D: { kind: 'element', type: 'visual3d', defaultSize: { width: 520, height: 520 }, description: '3D-like visual', props: 'kind, colors, items', content: (p) => pick(p, ['kind', 'colors', 'items']) },
  Group: { kind: 'container', defaultSize: { width: 'fill', height: 'auto' }, description: 'Group children (child x/y are relative to the group)', props: 'x, y, width, height' },
  Stack: { kind: 'container', defaultSize: { width: 'fill', height: 'auto' }, description: 'Vertical stack — positions children top to bottom', props: 'x, y, width, gap, align' },
  Flex: { kind: 'container', defaultSize: { width: 'fill', height: 'auto' }, description: 'Horizontal row — children share the width', props: 'x, y, width, height, gap' },
  Grid: { kind: 'container', defaultSize: { width: 'fill', height: 'auto' }, description: 'Grid — columns × rows', props: 'x, y, width, height, columns, gap' },

  /* ------------------------- composite components ------------------------- */
  Card: {
    kind: 'expand', defaultSize: { width: 520, height: 360 }, description: 'Card with optional icon, title, text, value', props: 'title, text, icon, value, fill',
    expand: (p, text, f, id) => {
      const out: Raw[] = [{ id: `${id}-bg`, type: 'shape', ...f, content: { shape: 'roundRect' }, style: { fill: p.fill ?? '$surface', radius: p.radius ?? 24, shadow: { x: 0, y: 12, blur: 40, color: 'rgba(15,23,42,0.10)' }, ...(p.style ?? {}) } }];
      let y = f.y + 40;
      const fg = p.color ?? '$text';
      if (p.icon) { out.push({ id: `${id}-icon`, type: 'icon', x: f.x + 40, y, width: 64, height: 64, content: { name: p.icon }, style: { color: p.iconColor ?? '$accent' } }); y += 88; }
      if (p.value !== undefined) { out.push({ id: `${id}-value`, type: 'heading', x: f.x + 40, y, width: f.width - 80, height: 90, content: { text: String(p.value) }, style: { fontSize: 72, color: '$primary' } }); y += 96; }
      if (p.title) { out.push({ id: `${id}-title`, type: 'heading', x: f.x + 40, y, width: f.width - 80, height: 56, content: { text: p.title }, style: { fontSize: 36, color: fg } }); y += 66; }
      const body = p.text ?? text;
      if (body) out.push({ id: `${id}-text`, type: 'paragraph', x: f.x + 40, y, width: f.width - 80, height: Math.max(40, f.y + f.height - y - 32), content: { text: body }, style: { fontSize: 24, color: p.color ?? '$textMuted' } });
      return out;
    },
  },
  Statistic: {
    kind: 'expand', defaultSize: { width: 420, height: 220 }, description: 'Big value + label', props: 'value, label, text, color',
    expand: (p, text, f, id) => [
      { id: `${id}-value`, type: 'heading', x: f.x, y: f.y, width: f.width, height: Math.round(f.height * 0.55), content: { text: String(p.value ?? '') }, style: { fontSize: p.fontSize ?? 96, color: p.color ?? '$primary', letterSpacing: -2 } },
      { id: `${id}-label`, type: 'text', x: f.x, y: f.y + Math.round(f.height * 0.58), width: f.width, height: Math.round(f.height * 0.42), content: { text: [p.label, p.text ?? text].filter(Boolean).join('\n') }, style: { fontSize: 26, color: '$textMuted' } },
    ],
  },
  Metric: {
    kind: 'expand', defaultSize: { width: 400, height: 200 }, description: 'KPI tile with delta & trend', props: 'value, label, delta, trend',
    expand: (p, _t, f, id) => [
      { id: `${id}-bg`, type: 'shape', ...f, content: { shape: 'roundRect' }, style: { fill: '$surface', radius: 20, stroke: { color: '$border', width: 2 } } },
      { id: `${id}-label`, type: 'text', x: f.x + 32, y: f.y + 24, width: f.width - 64, height: 40, content: { text: p.label ?? '' }, style: { fontSize: 22, fontWeight: 600, color: '$textMuted' } },
      { id: `${id}-value`, type: 'heading', x: f.x + 32, y: f.y + 64, width: f.width - 64, height: 80, content: { text: String(p.value ?? '') }, style: { fontSize: 60, color: '$text' } },
      ...(p.delta ? [{ id: `${id}-delta`, type: 'text', x: f.x + 32, y: f.y + f.height - 52, width: f.width - 64, height: 36, content: { text: `${p.trend === 'down' ? '▼' : p.trend === 'up' ? '▲' : '•'} ${p.delta}` }, style: { fontSize: 22, fontWeight: 700, color: p.trend === 'down' ? '$danger' : '$success' } }] : []),
    ],
  },
  Quote: {
    kind: 'expand', defaultSize: { width: 1400, height: 420 }, description: 'Pull quote with author', props: 'author, role (children = quote text)',
    expand: (p, text, f, id) => [
      { id: `${id}-mark`, type: 'text', x: f.x - 8, y: f.y - 40, width: 180, height: 200, content: { text: '“' }, style: { fontSize: 220, color: '$accent', fontFamily: 'Georgia', lineHeight: 1 } },
      { id: `${id}-text`, type: 'paragraph', x: f.x, y: f.y + 110, width: f.width, height: Math.round(f.height * 0.55), content: { text: p.text ?? text }, style: { fontSize: p.fontSize ?? 52, color: '$text', fontFamily: '$heading', lineHeight: 1.2 } },
      ...(p.author ? [{ id: `${id}-author`, type: 'text', x: f.x, y: f.y + f.height - 70, width: f.width, height: 60, content: { text: `**— ${p.author}**${p.role ? `, ${p.role}` : ''}` }, style: { fontSize: 28, color: '$textMuted' } }] : []),
    ],
  },
  Callout: {
    kind: 'expand', defaultSize: { width: 900, height: 180 }, description: 'Highlighted note box', props: 'title, tone (info|success|warning|danger), icon',
    expand: (p, text, f, id) => {
      const tone = ({ info: '$primary', success: '$success', warning: '$warning', danger: '$danger' } as Record<string, string>)[p.tone ?? 'info'] ?? '$accent';
      return [
        { id: `${id}-bg`, type: 'shape', ...f, content: { shape: 'roundRect' }, style: { fill: '$surface', radius: 18 } },
        { id: `${id}-bar`, type: 'shape', x: f.x, y: f.y, width: 10, height: f.height, content: { shape: 'rect' }, style: { fill: tone } },
        { id: `${id}-icon`, type: 'icon', x: f.x + 40, y: f.y + 36, width: 52, height: 52, content: { name: p.icon ?? 'info' }, style: { color: tone } },
        { id: `${id}-text`, type: 'paragraph', x: f.x + 116, y: f.y + 30, width: f.width - 150, height: f.height - 60, content: { text: p.title ? `**${p.title}**\n${p.text ?? text}` : p.text ?? text }, style: { fontSize: 28, color: '$text', verticalAlign: 'middle' } },
      ];
    },
  },
  SectionDivider: {
    kind: 'expand', defaultSize: { width: 1680, height: 600 }, description: 'Section number + title', props: 'number, title, subtitle',
    expand: (p, text, f, id) => [
      ...(p.number ? [{ id: `${id}-number`, type: 'heading', x: f.x, y: f.y, width: f.width, height: 280, content: { text: String(p.number) }, style: { fontSize: 260, color: '$accent', lineHeight: 1 } }] : []),
      { id: `${id}-title`, type: 'heading', x: f.x, y: f.y + (p.number ? 300 : 0), width: f.width, height: 130, content: { text: p.title ?? text }, style: { fontSize: 96 } },
      ...(p.subtitle ? [{ id: `${id}-subtitle`, type: 'paragraph', x: f.x, y: f.y + (p.number ? 450 : 150), width: f.width, height: 80, content: { text: p.subtitle }, style: { fontSize: 32 } }] : []),
    ],
  },
  NumberedList: {
    kind: 'expand', defaultSize: { width: 1680, height: 640 }, description: 'Big numbered items', props: 'items=[{title, text}]',
    expand: (p, _t, f, id) => {
      const items: Raw[] = p.items ?? [];
      const rowH = f.height / Math.max(1, items.length);
      return items.flatMap((it, i) => [
        { id: `${id}-${i + 1}-num`, type: 'heading', x: f.x, y: f.y + i * rowH, width: 130, height: Math.min(100, rowH), content: { text: String(i + 1).padStart(2, '0') }, style: { fontSize: Math.min(64, rowH * 0.6), color: '$accent' } },
        { id: `${id}-${i + 1}-text`, type: 'paragraph', x: f.x + 160, y: f.y + i * rowH + 4, width: f.width - 160, height: rowH - 12, content: { text: it.text ? `**${it.title}**\n${it.text}` : it.title }, style: { fontSize: Math.min(30, rowH * 0.3), color: '$text' } },
      ]);
    },
  },
};

export const COMPONENT_NAMES = Object.keys(COMPONENTS);
