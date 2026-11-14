/**
 * SlideCraft Presentation Schema v1.0 (zod is the source of truth).
 * The JSON Schema served to external AIs is generated from these definitions
 * (see `presentationJsonSchema()`), so the documentation cannot drift.
 */
import { z } from 'zod';
import {
  ANIMATION_EFFECT_IDS, ANIMATION_TRIGGER_IDS, ASPECT_RATIOS, CHART_TYPE_IDS, DECOR_KINDS, DIAGRAM_KIND_IDS,
  EASINGS, ELEMENT_TYPE_IDS, INFOGRAPHIC_KIND_IDS, SHAPE_IDS, TIMELINE_STYLES, TRANSITION_IDS, VISUAL3D_KINDS,
} from './registry';

const enumOf = <T extends string>(vals: readonly T[]) => z.enum(vals as unknown as [T, ...T[]]);
const num = z.number();
const color = z.string().describe('Hex (#RRGGBB / #RRGGBBAA), rgb()/rgba(), CSS color name, or a theme token such as "$primary"');

/* ----------------------------- Rich text ----------------------------- */
export const RunSchema = z.looseObject({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  color: color.optional(),
  highlight: color.optional(),
  fontSize: num.optional(),
  fontFamily: z.string().optional(),
  link: z.string().optional(),
  superscript: z.boolean().optional(),
  subscript: z.boolean().optional(),
});
export const ParagraphSchema = z.looseObject({
  runs: z.array(RunSchema),
  list: z.enum(['bullet', 'number']).optional(),
  level: z.number().int().min(0).max(4).optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
});
export type Run = z.infer<typeof RunSchema>;
export type Paragraph = z.infer<typeof ParagraphSchema>;

/* ------------------------------- Style ------------------------------- */
export const GradientSchema = z.looseObject({
  type: z.enum(['linear', 'radial']).default('linear'),
  angle: num.optional().describe('Degrees, 0 = left→right, 90 = top→bottom'),
  stops: z.array(z.looseObject({ color, offset: num.min(0).max(1) })).min(2),
});
export type Gradient = z.infer<typeof GradientSchema>;
export const ShadowSchema = z.looseObject({ x: num.default(0), y: num.default(8), blur: num.default(24), color: color.default('rgba(0,0,0,0.25)') });
export const StrokeSchema = z.looseObject({ color: color.optional(), width: num.optional(), dash: z.enum(['solid', 'dash', 'dot', 'dashDot']).optional() });

export const StyleSchema = z.looseObject({
  // text
  fontFamily: z.string().optional(),
  fontSize: num.optional(),
  fontWeight: z.union([num, z.enum(['normal', 'bold'])]).optional(),
  color: color.optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  lineHeight: num.optional().describe('Multiplier, e.g. 1.2'),
  letterSpacing: num.optional().describe('px'),
  paragraphSpacing: num.optional().describe('px after each paragraph'),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  textShadow: ShadowSchema.optional(),
  textGradient: GradientSchema.optional().describe('Web: gradient text fill. PPTX: first stop color'),
  padding: z.union([num, z.array(num).length(4)]).optional(),
  autoFit: z.enum(['none', 'shrink']).optional(),
  // box
  fill: color.optional(),
  gradient: GradientSchema.optional(),
  stroke: StrokeSchema.optional(),
  radius: num.optional(),
  shadow: ShadowSchema.optional(),
  blur: num.optional().describe('Backdrop blur in px (glass effect, web only)'),
  // image
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  focalX: num.min(0).max(1).optional(),
  focalY: num.min(0).max(1).optional(),
  crop: z.looseObject({ x: num, y: num, width: num, height: num }).optional().describe('Fractions 0–1 of the source image'),
  mask: z.enum(['none', 'circle', 'rounded', 'arch', 'hexagon', 'blob', 'diamond']).optional(),
  flipH: z.boolean().optional(),
  flipV: z.boolean().optional(),
  grayscale: z.boolean().optional(),
  brightness: num.optional(),
  overlay: z.looseObject({ color, opacity: num.min(0).max(1) }).optional(),
  // line
  headStart: z.enum(['none', 'arrow', 'triangle', 'oval', 'diamond']).optional(),
  headEnd: z.enum(['none', 'arrow', 'triangle', 'oval', 'diamond']).optional(),
  // icon
  strokeWidth: num.optional(),
  // palette for composites (charts, diagrams)
  palette: z.array(color).optional(),
  variant: z.string().optional(),
});
export type Style = z.infer<typeof StyleSchema>;

/* ----------------------------- Animation ----------------------------- */
export const MotionPathSchema = z.looseObject({
  type: z.enum(['line', 'curve', 'circle', 'custom']).default('line'),
  dx: num.optional().describe('Horizontal offset in px (line/curve)'),
  dy: num.optional().describe('Vertical offset in px (line/curve)'),
  radius: num.optional().describe('Circle radius in px'),
  d: z.string().optional().describe('SVG path data relative to the element origin, e.g. "M0 0 C 200 -200 400 200 600 0"'),
});
export const AnimationSchema = z.looseObject({
  id: z.string().optional(),
  effect: enumOf(ANIMATION_EFFECT_IDS),
  trigger: enumOf(ANIMATION_TRIGGER_IDS).default('onClick'),
  duration: num.min(0).max(60000).default(600).describe('ms'),
  delay: num.min(0).max(60000).default(0).describe('ms'),
  repeat: z.union([num.int().min(0), z.literal('infinite')]).optional(),
  direction: z.string().optional(),
  easing: enumOf(EASINGS).optional(),
  order: num.optional().describe('Global order within the slide; lower runs first'),
  path: MotionPathSchema.optional(),
  color: color.optional().describe('Target color for colorChange'),
  scale: num.optional().describe('Scale for growShrink/pulse (e.g. 1.15)'),
  opacity: num.optional().describe('Target opacity for transparency'),
  byParagraph: z.boolean().optional(),
});
export type Animation = z.infer<typeof AnimationSchema>;

/* ----------------------------- Transition ---------------------------- */
export const TransitionSchema = z.looseObject({
  type: enumOf(TRANSITION_IDS),
  duration: num.min(0).max(10000).default(700).describe('ms'),
  direction: z.string().optional(),
  easing: enumOf(EASINGS).optional(),
  sound: z.enum(['none', 'click', 'whoosh', 'chime']).optional(),
  advanceOnClick: z.boolean().optional(),
  autoAdvance: num.min(0).optional().describe('Advance automatically after N ms'),
  delay: num.min(0).optional(),
});
export type Transition = z.infer<typeof TransitionSchema>;

/* ------------------------------ Content ------------------------------ */
export const ImageRefSchema = z.looseObject({
  src: z.string().optional().describe('https URL, data URI, or "asset:<id>"'),
  query: z.string().optional().describe('Search intent when no verified URL exists'),
  alt: z.string().optional(),
  credit: z.string().optional(),
  license: z.string().optional(),
  sourceUrl: z.string().optional(),
});
export type ImageRef = z.infer<typeof ImageRefSchema>;

export const TextContentSchema = z.looseObject({
  text: z.string().optional().describe('Plain text; supports **bold**, *italic*, `code`, ==accent==, [link](url), "- " bullets, "1. " numbers, "\\n" line breaks'),
  paragraphs: z.array(ParagraphSchema).optional(),
});
export const ShapeContentSchema = TextContentSchema.extend({ shape: enumOf(SHAPE_IDS).default('rect') });
export const LineContentSchema = z.looseObject({ x1: num, y1: num, x2: num, y2: num });
export const TableContentSchema = z.looseObject({
  rows: z.array(z.array(z.union([z.string(), num]))).min(1),
  header: z.boolean().default(true),
  firstColumn: z.boolean().optional(),
  columnWidths: z.array(num).optional().describe('Relative widths, e.g. [2,1,1]'),
  highlightRows: z.array(num.int()).optional(),
  caption: z.string().optional(),
});
export const ChartPointSchema = z.looseObject({ x: num, y: num, size: num.optional(), label: z.string().optional() });
export const ChartSeriesSchema = z.looseObject({
  name: z.string(),
  values: z.array(z.union([num, z.null()])).optional(),
  points: z.array(ChartPointSchema).optional().describe('scatter / bubble'),
  color: color.optional(),
  type: z.enum(['bar', 'line', 'area']).optional().describe('combo charts'),
  axis: z.enum(['primary', 'secondary']).optional(),
});
export const ChartContentSchema = z.looseObject({
  chartType: enumOf(CHART_TYPE_IDS),
  title: z.string().optional(),
  categories: z.array(z.string()).optional(),
  series: z.array(ChartSeriesSchema).min(1),
  valuePrefix: z.string().optional(),
  valueSuffix: z.string().optional(),
  decimals: num.int().min(0).max(6).optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  showLabels: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  showAxis: z.boolean().optional(),
  stacked: z.boolean().optional(),
  horizontal: z.boolean().optional(),
  smooth: z.boolean().optional(),
  xAxisTitle: z.string().optional(),
  yAxisTitle: z.string().optional(),
  bins: num.int().min(2).max(50).optional().describe('histogram'),
  totals: z.array(num.int()).optional().describe('waterfall: indexes of total bars'),
  centerLabel: z.string().optional().describe('donut'),
  source: z.string().optional().describe('Data source / citation'),
});
export type ChartContent = z.infer<typeof ChartContentSchema>;
export type ChartSeries = z.infer<typeof ChartSeriesSchema>;

export interface DiagramItem {
  id?: string;
  title: string;
  text?: string;
  icon?: string;
  value?: number | string;
  color?: string;
  status?: 'done' | 'active' | 'planned';
  children?: DiagramItem[];
  [k: string]: unknown;
}
export const DiagramItemSchema: z.ZodType<DiagramItem> = z.lazy(() =>
  z.looseObject({
    id: z.string().optional(),
    title: z.string(),
    text: z.string().optional(),
    icon: z.string().optional(),
    value: z.union([num, z.string()]).optional(),
    color: color.optional(),
    status: z.enum(['done', 'active', 'planned']).optional(),
    children: z.array(DiagramItemSchema).optional(),
  }),
) as z.ZodType<DiagramItem>;
export const DiagramContentSchema = z.looseObject({
  kind: enumOf(DIAGRAM_KIND_IDS),
  items: z.array(DiagramItemSchema).optional(),
  nodes: z.array(z.looseObject({ id: z.string(), label: z.string(), shape: z.enum(['rect', 'roundRect', 'ellipse', 'diamond', 'pill']).optional(), color: color.optional() })).optional(),
  edges: z.array(z.looseObject({ from: z.string(), to: z.string(), label: z.string().optional() })).optional(),
  direction: z.enum(['horizontal', 'vertical']).optional(),
  center: z.string().optional().describe('Center label for hub / cycle / mindmap'),
  axes: z.looseObject({ x: z.string().optional(), y: z.string().optional() }).optional(),
});
export type DiagramContent = z.infer<typeof DiagramContentSchema>;

export const TimelineContentSchema = z.looseObject({
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
  style: enumOf(TIMELINE_STYLES).default('milestones'),
  items: z.array(z.looseObject({ date: z.string(), title: z.string(), text: z.string().optional(), icon: z.string().optional(), highlight: z.boolean().optional() })).min(1),
});
export type TimelineContent = z.infer<typeof TimelineContentSchema>;

export const InfographicItemSchema = z.looseObject({
  label: z.string(),
  value: z.union([num, z.string()]).optional(),
  unit: z.string().optional(),
  delta: z.string().optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  icon: z.string().optional(),
  text: z.string().optional(),
  progress: num.min(0).max(1).optional(),
  compare: num.optional().describe('comparisonBars: B value'),
  color: color.optional(),
});
export const InfographicContentSchema = z.looseObject({
  kind: enumOf(INFOGRAPHIC_KIND_IDS),
  items: z.array(InfographicItemSchema).min(1),
  columns: num.int().min(1).max(6).optional(),
  total: num.optional().describe('pictogram total icons'),
  icon: z.string().optional().describe('pictogram icon'),
  labels: z.array(z.string()).optional().describe('comparisonBars legend [A, B]'),
});
export type InfographicContent = z.infer<typeof InfographicContentSchema>;

export const FormulaContentSchema = z.looseObject({ latex: z.string(), display: z.boolean().optional() });
export const CodeContentSchema = z.looseObject({ code: z.string(), language: z.string().optional(), showLineNumbers: z.boolean().optional(), title: z.string().optional(), highlightLines: z.array(num.int()).optional() });
export const MediaContentSchema = z.looseObject({ src: z.string(), poster: z.string().optional(), autoplay: z.boolean().optional(), loop: z.boolean().optional(), muted: z.boolean().optional(), controls: z.boolean().optional(), title: z.string().optional() });
export const IconContentSchema = z.looseObject({ name: z.string().describe('Icon name from the SlideCraft icon set (kebab-case)') });
export const SvgContentSchema = z.looseObject({ markup: z.string() });
export const DecorContentSchema = z.looseObject({ kind: enumOf(DECOR_KINDS), colors: z.array(color).optional(), density: num.optional(), seed: num.optional() });
export const Visual3DContentSchema = z.looseObject({ kind: enumOf(VISUAL3D_KINDS), colors: z.array(color).optional(), items: z.array(z.string()).optional() });

export const CONTENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  text: TextContentSchema, heading: TextContentSchema, paragraph: TextContentSchema, richText: TextContentSchema,
  image: ImageRefSchema, svg: SvgContentSchema, icon: IconContentSchema, shape: ShapeContentSchema,
  line: LineContentSchema, arrow: LineContentSchema, table: TableContentSchema, chart: ChartContentSchema,
  diagram: DiagramContentSchema, smartart: DiagramContentSchema, timeline: TimelineContentSchema,
  infographic: InfographicContentSchema, formula: FormulaContentSchema, code: CodeContentSchema,
  video: MediaContentSchema, audio: MediaContentSchema, decorative: DecorContentSchema, visual3d: Visual3DContentSchema,
  group: z.looseObject({ children: z.array(z.any()) }),
};

/* ------------------------------ Element ------------------------------ */
export const ElementBaseSchema = z.looseObject({
  id: z.string().min(1),
  type: enumOf(ELEMENT_TYPE_IDS),
  name: z.string().optional(),
  x: num,
  y: num,
  width: num.positive(),
  height: num.positive(),
  rotation: num.optional(),
  opacity: num.min(0).max(1).optional(),
  zIndex: num.optional(),
  content: z.any(),
  style: StyleSchema.optional(),
  animation: z.union([AnimationSchema, z.array(AnimationSchema)]).optional(),
  responsive: z.looseObject({ hideOnSmall: z.boolean().optional(), scaleText: z.boolean().optional() }).optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  link: z.string().optional(),
  alt: z.string().optional(),
});

export interface SlideElement {
  id: string;
  type: (typeof ELEMENT_TYPE_IDS)[number];
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  style?: Style;
  animation?: Animation[];
  responsive?: { hideOnSmall?: boolean; scaleText?: boolean };
  locked?: boolean;
  visible?: boolean;
  link?: string;
  alt?: string;
  [k: string]: unknown;
}

/* ------------------------------- Slide ------------------------------- */
export const BackgroundSchema = z.looseObject({
  type: z.enum(['color', 'gradient', 'image']).default('color'),
  color: color.optional(),
  gradient: GradientSchema.optional(),
  image: ImageRefSchema.optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  overlay: z.looseObject({ color, opacity: num.min(0).max(1) }).optional(),
});
export type Background = z.infer<typeof BackgroundSchema>;

/** Slot-based content that the Layout Engine turns into positioned elements. */
export const LayoutContentSchema = z.looseObject({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  image: ImageRefSchema.optional(),
  images: z.array(ImageRefSchema).optional(),
  stats: z.array(z.looseObject({ value: z.union([z.string(), num]), label: z.string(), text: z.string().optional(), trend: z.enum(['up', 'down', 'flat']).optional() })).optional(),
  items: z.array(z.looseObject({ title: z.string(), text: z.string().optional(), icon: z.string().optional(), value: z.union([z.string(), num]).optional(), image: ImageRefSchema.optional() })).optional(),
  columns: z.array(z.looseObject({ heading: z.string().optional(), body: z.string().optional(), bullets: z.array(z.string()).optional(), image: ImageRefSchema.optional() })).optional(),
  quote: z.looseObject({ text: z.string(), author: z.string().optional(), role: z.string().optional() }).optional(),
  chart: ChartContentSchema.optional(),
  table: TableContentSchema.optional(),
  timeline: TimelineContentSchema.optional(),
  diagram: DiagramContentSchema.optional(),
  code: CodeContentSchema.optional(),
  formula: FormulaContentSchema.optional(),
  before: z.looseObject({ heading: z.string().optional(), body: z.string().optional(), bullets: z.array(z.string()).optional(), image: ImageRefSchema.optional() }).optional(),
  after: z.looseObject({ heading: z.string().optional(), body: z.string().optional(), bullets: z.array(z.string()).optional(), image: ImageRefSchema.optional() }).optional(),
  cta: z.string().optional(),
  footer: z.string().optional(),
  number: z.string().optional().describe('Big number / section number'),
  caption: z.string().optional(),
});
export type LayoutContent = z.infer<typeof LayoutContentSchema>;

export const SlideSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().optional().describe('Semantic purpose, e.g. "title", "agenda", "data", "closing"'),
  title: z.string().optional(),
  section: z.string().optional(),
  layout: z.string().optional().describe('Layout Engine id; combine with `content` slots'),
  content: LayoutContentSchema.optional(),
  background: z.union([BackgroundSchema, z.string()]).optional(),
  theme: z.string().optional().describe('Per-slide theme override (theme id)'),
  elements: z.array(z.any()).default([]),
  notes: z.string().optional(),
  transition: z.union([TransitionSchema, enumOf(TRANSITION_IDS)]).optional(),
  duration: num.optional().describe('Auto-advance after N ms in Auto Play'),
  animationPreset: z.string().optional().describe('Animation preset id applied to all elements of the slide (layout mode friendly)'),
  animations: z.record(z.string(), z.union([AnimationSchema, z.array(AnimationSchema)])).optional().describe('Per-element animations keyed by element id (works for layout-generated ids such as "heading", "chart", "stat-1-value")'),
  hidden: z.boolean().optional(),
  starred: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export interface Slide {
  id: string;
  type?: string;
  title?: string;
  section?: string;
  layout?: string;
  content?: LayoutContent;
  background?: Background;
  theme?: string;
  elements: SlideElement[];
  notes?: string;
  transition?: Transition;
  duration?: number;
  hidden?: boolean;
  starred?: boolean;
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

/* ------------------------------- Theme ------------------------------- */
export const ThemeColorsSchema = z.looseObject({
  primary: color, secondary: color, accent: color, background: color, surface: color, text: color,
  textMuted: color.optional(), border: color.optional(), success: color.optional(), warning: color.optional(), danger: color.optional(),
  chart: z.array(color).optional(),
});
export const ThemeSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  mode: z.enum(['light', 'dark']).default('light'),
  colors: ThemeColorsSchema,
  fonts: z.looseObject({ heading: z.string(), body: z.string(), mono: z.string().optional() }),
  fontScale: z.looseObject({ display: num, h1: num, h2: num, h3: num, body: num, small: num, caption: num }).partial().optional(),
  spacing: z.looseObject({ unit: num, margin: num }).partial().optional(),
  radius: num.optional(),
  shadow: z.enum(['none', 'soft', 'medium', 'strong']).optional(),
  grid: z.looseObject({ columns: num, gutter: num }).partial().optional(),
  typography: z.looseObject({ headingWeight: num, bodyWeight: num, headingLetterSpacing: num, headingTransform: z.enum(['none', 'uppercase']), bodyLineHeight: num, headingLineHeight: num }).partial().optional(),
  background: BackgroundSchema.optional(),
  decor: z.enum(['none', 'orbs', 'grid', 'lines', 'dots', 'mesh', 'frame', 'noise']).optional(),
});
export interface ThemeColors {
  primary: string; secondary: string; accent: string; background: string; surface: string; text: string;
  textMuted?: string; border?: string; success?: string; warning?: string; danger?: string; chart?: string[];
}
export interface Theme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors & { textMuted: string; border: string; chart: string[] };
  fonts: { heading: string; body: string; mono: string };
  fontScale: { display: number; h1: number; h2: number; h3: number; body: number; small: number; caption: number };
  spacing: { unit: number; margin: number };
  radius: number;
  shadow: 'none' | 'soft' | 'medium' | 'strong';
  grid: { columns: number; gutter: number };
  typography: { headingWeight: number; bodyWeight: number; headingLetterSpacing: number; headingTransform: 'none' | 'uppercase'; bodyLineHeight: number; headingLineHeight: number };
  background?: Background;
  decor: 'none' | 'orbs' | 'grid' | 'lines' | 'dots' | 'mesh' | 'frame' | 'noise';
  description?: string;
  category?: string;
}

/* ---------------------------- Presentation --------------------------- */
export const AssetSchema = z.looseObject({
  id: z.string(),
  type: z.enum(['image', 'svg', 'video', 'audio', 'font']),
  src: z.string(),
  name: z.string().optional(),
  mime: z.string().optional(),
  width: num.optional(),
  height: num.optional(),
  size: num.optional(),
  credit: z.string().optional(),
  license: z.string().optional(),
  sourceUrl: z.string().optional(),
  query: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const PresentationSchema = z.looseObject({
  $schema: z.string().optional(),
  schemaVersion: z.string().describe('Must be "1.0"'),
  id: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  version: z.union([z.string(), num]).optional(),
  language: z.string().optional().describe('BCP-47, e.g. "vi", "en"'),
  direction: z.enum(['ltr', 'rtl']).optional(),
  aspectRatio: z.enum(Object.keys(ASPECT_RATIOS) as [string, ...string[]]).default('16:9'),
  size: z.looseObject({ width: num.positive(), height: num.positive() }).optional(),
  theme: z.union([z.string(), ThemeSchema.partial().extend({ base: z.string().optional() })]).optional(),
  typography: z.looseObject({ headingFont: z.string().optional(), bodyFont: z.string().optional(), scale: num.optional() }).optional(),
  globalStyles: z.looseObject({ defaultTransition: z.union([TransitionSchema, enumOf(TRANSITION_IDS)]).optional(), slideNumbers: z.boolean().optional(), footer: z.string().optional() }).optional(),
  sections: z.array(z.looseObject({ id: z.string(), title: z.string() })).optional(),
  slides: z.array(z.any()).min(1),
  assets: z.array(AssetSchema).optional(),
  part: z.looseObject({ index: num.int().min(1), total: num.int().min(1), presentationId: z.string() }).optional().describe('Multi-part import for very long decks'),
  metadata: z.record(z.string(), z.any()).optional(),
});

export interface Presentation {
  $schema?: string;
  schemaVersion: string;
  id: string;
  title: string;
  description?: string;
  author?: string;
  version?: string | number;
  language?: string;
  direction?: 'ltr' | 'rtl';
  aspectRatio: string;
  size: { width: number; height: number };
  theme: string;
  themeOverrides?: Partial<Theme>;
  typography?: { headingFont?: string; bodyFont?: string; scale?: number };
  globalStyles?: { defaultTransition?: Transition; slideNumbers?: boolean; footer?: string };
  sections?: { id: string; title: string }[];
  slides: Slide[];
  assets: Asset[];
  metadata?: Record<string, unknown>;
  [k: string]: unknown;
}

/** JSON Schema (draft 2020-12) generated from zod — used by docs & Prompt Center. */
export function presentationJsonSchema(): Record<string, unknown> {
  const base = z.toJSONSchema(PresentationSchema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
  const slide = z.toJSONSchema(SlideSchema, { unrepresentable: 'any', io: 'input' });
  const element = z.toJSONSchema(ElementBaseSchema, { unrepresentable: 'any', io: 'input' });
  const contents: Record<string, unknown> = {};
  for (const [k, s] of Object.entries(CONTENT_SCHEMAS)) contents[k] = z.toJSONSchema(s, { unrepresentable: 'any', io: 'input' });
  return { ...base, $id: 'https://slidecraft.app/schema/1.0.json', title: 'SlideCraft Presentation 1.0', $defs: { slide, element, elementContent: contents } };
}
