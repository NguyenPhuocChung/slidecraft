/**
 * SlideCraft feature registry — the single source of truth for everything the
 * Authoring Contract supports. The validator, the editor UI, the PPTX exporter
 * and the AI Prompt Center all read from these tables, so a feature that is not
 * listed here cannot be advertised to external AIs.
 */

export const SCHEMA_VERSION = '1.0';
export const SCHEMA_ID = `slidecraft/${SCHEMA_VERSION}`;
export const PROMPT_VERSION = '1.0.0';
export const REGISTRY_UPDATED = '2026-11-12';

export type SupportLevel = 'supported' | 'partial' | 'unsupported';

/* ------------------------------------------------------------------ */
/* Aspect ratios — logical canvas size in px                            */
/* ------------------------------------------------------------------ */
export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080, label: 'Widescreen 16:9' },
  '4:3': { width: 1440, height: 1080, label: 'Standard 4:3' },
  '16:10': { width: 1728, height: 1080, label: 'Widescreen 16:10' },
  'A4-landscape': { width: 1527, height: 1080, label: 'A4 Landscape' },
  'A4-portrait': { width: 1080, height: 1527, label: 'A4 Portrait' },
  custom: { width: 1920, height: 1080, label: 'Custom size' },
} as const;
export type AspectRatio = keyof typeof ASPECT_RATIOS;
/** Logical px per inch used for PPTX conversion (1920px == 13.333in). */
export const PX_PER_INCH = 144;

/* ------------------------------------------------------------------ */
/* Element types                                                        */
/* ------------------------------------------------------------------ */
export interface ElementTypeInfo {
  label: string;
  description: string;
  pptx: SupportLevel;
  pptxNote: string;
}
export const ELEMENT_TYPES = {
  text: { label: 'Text', description: 'Generic text box (markdown-lite supported).', pptx: 'supported', pptxNote: 'Native text box' },
  heading: { label: 'Heading', description: 'Title text using the theme heading font.', pptx: 'supported', pptxNote: 'Native text box' },
  paragraph: { label: 'Paragraph', description: 'Body text using the theme body font.', pptx: 'supported', pptxNote: 'Native text box' },
  richText: { label: 'Rich Text', description: 'Paragraphs with runs, lists and per-run formatting.', pptx: 'supported', pptxNote: 'Native text box with runs' },
  image: { label: 'Image', description: 'Photo or illustration by URL, asset or search query.', pptx: 'supported', pptxNote: 'Native picture (cropped to frame)' },
  svg: { label: 'SVG', description: 'Inline vector markup (sanitized).', pptx: 'supported', pptxNote: 'SVG picture with PNG fallback' },
  icon: { label: 'Icon', description: 'Icon from the built-in icon set.', pptx: 'supported', pptxNote: 'SVG picture' },
  shape: { label: 'Shape', description: 'Geometric shape, optionally with text.', pptx: 'supported', pptxNote: 'Native shape (gradients via OOXML)' },
  line: { label: 'Line', description: 'Straight line between two points.', pptx: 'supported', pptxNote: 'Native line' },
  arrow: { label: 'Arrow', description: 'Line with arrow heads.', pptx: 'supported', pptxNote: 'Native line with arrow heads' },
  table: { label: 'Table', description: 'Data table with header row.', pptx: 'supported', pptxNote: 'Native table' },
  chart: { label: 'Chart', description: 'Data chart (15 types).', pptx: 'partial', pptxNote: 'Native chart for most types; shapes for waterfall/funnel/treemap/histogram' },
  diagram: { label: 'Diagram', description: 'Process, cycle, pyramid, funnel, flowchart, mind map, org chart, SWOT...', pptx: 'supported', pptxNote: 'Native shapes' },
  timeline: { label: 'Timeline', description: 'Horizontal or vertical milestones.', pptx: 'supported', pptxNote: 'Native shapes' },
  infographic: { label: 'Infographic', description: 'KPI grid, progress bars, pictogram, numbered list, stat rings...', pptx: 'supported', pptxNote: 'Native shapes' },
  formula: { label: 'Formula', description: 'LaTeX math rendered with KaTeX.', pptx: 'partial', pptxNote: 'High-resolution image; LaTeX kept in alt text' },
  code: { label: 'Code Block', description: 'Syntax-highlighted source code.', pptx: 'supported', pptxNote: 'Native text box with colored runs' },
  video: { label: 'Video Embed', description: 'MP4/WebM file or YouTube link.', pptx: 'partial', pptxNote: 'YouTube as online video; files embedded when downloadable, else poster + link' },
  audio: { label: 'Audio Embed', description: 'MP3/WAV/OGG audio.', pptx: 'partial', pptxNote: 'Embedded when downloadable, else link' },
  group: { label: 'Group', description: 'Container of child elements (relative coordinates).', pptx: 'supported', pptxNote: 'Native group (OOXML)' },
  smartart: { label: 'SmartArt-like', description: 'SmartArt-style list/cycle/hierarchy/matrix graphics.', pptx: 'supported', pptxNote: 'Native shapes (not real SmartArt)' },
  decorative: { label: 'Decorative', description: 'Blobs, orbs, grids, dots, waves, rings.', pptx: 'partial', pptxNote: 'Picture (vector rendered)' },
  visual3d: { label: '3D-like Visual', description: 'Isometric cube, stack, sphere, cylinder, layers.', pptx: 'partial', pptxNote: 'Picture (vector rendered)' },
} as const satisfies Record<string, ElementTypeInfo>;
export type ElementType = keyof typeof ELEMENT_TYPES;
export const ELEMENT_TYPE_IDS = Object.keys(ELEMENT_TYPES) as ElementType[];
export const TEXT_TYPES = ['text', 'heading', 'paragraph', 'richText'] as const;

/* ------------------------------------------------------------------ */
/* Shapes                                                               */
/* ------------------------------------------------------------------ */
/** shape id -> PptxGenJS ShapeType name */
export const SHAPES = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  triangle: 'triangle',
  rightTriangle: 'rtTriangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  octagon: 'octagon',
  star5: 'star5',
  star8: 'star8',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  chevron: 'chevron',
  homePlate: 'homePlate',
  arrowRight: 'rightArrow',
  arrowLeft: 'leftArrow',
  arrowUp: 'upArrow',
  arrowDown: 'downArrow',
  heart: 'heart',
  plus: 'mathPlus',
  ring: 'donut',
  blockArc: 'blockArc',
  speechBubble: 'wedgeRoundRectCallout',
  cloud: 'cloud',
  halfFrame: 'halfFrame',
  pill: 'roundRect',
} as const;
export type ShapeKind = keyof typeof SHAPES;
export const SHAPE_IDS = Object.keys(SHAPES) as ShapeKind[];

/* ------------------------------------------------------------------ */
/* Charts                                                               */
/* ------------------------------------------------------------------ */
export const CHART_TYPES = {
  bar: { label: 'Bar (horizontal)', pptx: 'supported', use: 'Compare values across categories with long labels' },
  column: { label: 'Column', pptx: 'supported', use: 'Compare values across a few categories' },
  stackedBar: { label: 'Stacked Bar/Column', pptx: 'supported', use: 'Part-to-whole across categories' },
  line: { label: 'Line', pptx: 'supported', use: 'Trend over time' },
  area: { label: 'Area', pptx: 'supported', use: 'Cumulative trend / volume over time' },
  pie: { label: 'Pie', pptx: 'supported', use: 'Share of a whole (≤ 6 slices)' },
  donut: { label: 'Donut', pptx: 'supported', use: 'Share of a whole with a center label' },
  scatter: { label: 'Scatter', pptx: 'supported', use: 'Correlation between two numeric variables' },
  bubble: { label: 'Bubble', pptx: 'supported', use: 'Three numeric variables (x, y, size)' },
  radar: { label: 'Radar', pptx: 'supported', use: 'Multi-criteria profile comparison' },
  waterfall: { label: 'Waterfall', pptx: 'partial', use: 'How increments/decrements build a total' },
  funnel: { label: 'Funnel', pptx: 'partial', use: 'Conversion through sequential stages' },
  combo: { label: 'Combo (bar + line)', pptx: 'supported', use: 'Volume vs rate on two axes' },
  histogram: { label: 'Histogram', pptx: 'partial', use: 'Distribution of raw numeric values' },
  treemap: { label: 'Treemap', pptx: 'partial', use: 'Hierarchical share with many items' },
} as const satisfies Record<string, { label: string; pptx: SupportLevel; use: string }>;
export type ChartType = keyof typeof CHART_TYPES;
export const CHART_TYPE_IDS = Object.keys(CHART_TYPES) as ChartType[];

/* ------------------------------------------------------------------ */
/* Diagrams / timelines / infographics / decor / 3d                     */
/* ------------------------------------------------------------------ */
export const DIAGRAM_KINDS = {
  process: 'Linear steps with arrows',
  chevronProcess: 'Chevron arrow steps',
  cycle: 'Circular repeating process',
  pyramid: 'Layered hierarchy (top = smallest)',
  funnel: 'Narrowing stages',
  flowchart: 'Nodes and edges (auto-layout); use nodes + edges',
  mindmap: 'Central idea with branches; use items with children',
  orgchart: 'Organization tree; use items with children',
  hierarchy: 'Generic tree; use items with children',
  swot: 'Strengths / Weaknesses / Opportunities / Threats (exactly 4 items)',
  comparison: 'Two or three columns compared side by side',
  beforeAfter: 'Before vs after (exactly 2 items)',
  roadmap: 'Phases along a road with status',
  venn: 'Overlapping circles (2–3 items)',
  matrix: '2×2 matrix (exactly 4 items, optional axis labels)',
  hub: 'Central hub with satellites',
  strategyMap: 'Layered perspectives (rows) each with objectives (children)',
  list: 'Stacked labeled blocks (SmartArt list)',
} as const;
export type DiagramKind = keyof typeof DIAGRAM_KINDS;
export const DIAGRAM_KIND_IDS = Object.keys(DIAGRAM_KINDS) as DiagramKind[];

export const TIMELINE_STYLES = ['line', 'milestones', 'alternating'] as const;

export const INFOGRAPHIC_KINDS = {
  kpiGrid: 'Grid of KPI tiles: value, label, delta, trend',
  progressBars: 'Labeled horizontal progress bars (progress 0–1)',
  statRings: 'Donut rings showing percentages (progress 0–1)',
  numberedList: 'Big numbers with title + text',
  iconList: 'Icons with title + text',
  pictogram: 'Icon array showing a ratio (value of total)',
  comparisonBars: 'Two-sided bars comparing A vs B per label',
} as const;
export type InfographicKind = keyof typeof INFOGRAPHIC_KINDS;
export const INFOGRAPHIC_KIND_IDS = Object.keys(INFOGRAPHIC_KINDS) as InfographicKind[];

export const DECOR_KINDS = ['blob', 'orb', 'grid', 'dots', 'waves', 'rings', 'lines', 'mesh', 'corner', 'noise'] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];
export const VISUAL3D_KINDS = ['cube', 'isometricStack', 'sphere', 'cylinder', 'layers', 'pillars'] as const;
export type Visual3DKind = (typeof VISUAL3D_KINDS)[number];

/* ------------------------------------------------------------------ */
/* Animations                                                           */
/* ------------------------------------------------------------------ */
export type AnimationCategory = 'entrance' | 'emphasis' | 'exit' | 'motion';
export interface EffectInfo {
  label: string;
  category: AnimationCategory;
  pptx: SupportLevel;
  /** PowerPoint preset id + class (used by OOXML adapter) */
  ppt?: { presetID: number; presetClass: 'entr' | 'emph' | 'exit' | 'path'; note?: string };
  directions?: readonly string[];
}
const DIR4 = ['left', 'right', 'up', 'down'] as const;
export const ANIMATION_EFFECTS = {
  // Entrance
  fadeIn: { label: 'Fade In', category: 'entrance', pptx: 'supported', ppt: { presetID: 10, presetClass: 'entr' } },
  appear: { label: 'Appear', category: 'entrance', pptx: 'supported', ppt: { presetID: 1, presetClass: 'entr' } },
  flyIn: { label: 'Fly In', category: 'entrance', pptx: 'supported', ppt: { presetID: 2, presetClass: 'entr' }, directions: DIR4 },
  floatIn: { label: 'Float In', category: 'entrance', pptx: 'supported', ppt: { presetID: 42, presetClass: 'entr' }, directions: ['up', 'down'] },
  zoomIn: { label: 'Zoom In', category: 'entrance', pptx: 'supported', ppt: { presetID: 53, presetClass: 'entr' } },
  grow: { label: 'Grow', category: 'entrance', pptx: 'supported', ppt: { presetID: 55, presetClass: 'entr', note: 'Exported as Grow & Turn' } },
  wipe: { label: 'Wipe', category: 'entrance', pptx: 'supported', ppt: { presetID: 22, presetClass: 'entr' }, directions: DIR4 },
  split: { label: 'Split', category: 'entrance', pptx: 'supported', ppt: { presetID: 16, presetClass: 'entr' }, directions: ['horizontal', 'vertical'] },
  rise: { label: 'Rise', category: 'entrance', pptx: 'supported', ppt: { presetID: 42, presetClass: 'entr', note: 'Exported as Float In (up)' } },
  bounce: { label: 'Bounce', category: 'entrance', pptx: 'partial', ppt: { presetID: 42, presetClass: 'entr', note: 'Exported as Float In (no bounce easing)' } },
  blurIn: { label: 'Blur In', category: 'entrance', pptx: 'partial', ppt: { presetID: 10, presetClass: 'entr', note: 'Exported as Fade (PowerPoint has no blur)' } },
  rotateIn: { label: 'Rotate In', category: 'entrance', pptx: 'partial', ppt: { presetID: 55, presetClass: 'entr', note: 'Exported as Grow & Turn' } },
  flipIn: { label: 'Flip In', category: 'entrance', pptx: 'partial', ppt: { presetID: 53, presetClass: 'entr', note: 'Exported as Zoom' } },
  reveal: { label: 'Reveal', category: 'entrance', pptx: 'supported', ppt: { presetID: 22, presetClass: 'entr', note: 'Exported as Wipe' }, directions: DIR4 },
  typewriter: { label: 'Typewriter', category: 'entrance', pptx: 'partial', ppt: { presetID: 1, presetClass: 'entr', note: 'Exported as Appear (by paragraph); per-letter timing is web only' } },
  draw: { label: 'Draw', category: 'entrance', pptx: 'partial', ppt: { presetID: 22, presetClass: 'entr', note: 'Exported as Wipe' }, directions: DIR4 },
  pop: { label: 'Pop', category: 'entrance', pptx: 'partial', ppt: { presetID: 53, presetClass: 'entr', note: 'Exported as Zoom' } },
  // Emphasis
  pulse: { label: 'Pulse', category: 'emphasis', pptx: 'supported', ppt: { presetID: 6, presetClass: 'emph', note: 'Exported as Grow/Shrink with auto-reverse' } },
  growShrink: { label: 'Grow/Shrink', category: 'emphasis', pptx: 'supported', ppt: { presetID: 6, presetClass: 'emph' } },
  spin: { label: 'Spin', category: 'emphasis', pptx: 'supported', ppt: { presetID: 8, presetClass: 'emph' } },
  teeter: { label: 'Teeter', category: 'emphasis', pptx: 'supported', ppt: { presetID: 32, presetClass: 'emph' } },
  transparency: { label: 'Transparency', category: 'emphasis', pptx: 'supported', ppt: { presetID: 9, presetClass: 'emph' } },
  colorChange: { label: 'Color Change', category: 'emphasis', pptx: 'partial', ppt: { presetID: 19, presetClass: 'emph', note: 'Exported as Fill Color change for shapes only' } },
  flash: { label: 'Flash', category: 'emphasis', pptx: 'partial', ppt: { presetID: 9, presetClass: 'emph', note: 'Exported as Transparency with auto-reverse' } },
  shake: { label: 'Shake', category: 'emphasis', pptx: 'partial', ppt: { presetID: 32, presetClass: 'emph', note: 'Exported as Teeter' } },
  highlight: { label: 'Highlight', category: 'emphasis', pptx: 'partial', ppt: { presetID: 6, presetClass: 'emph', note: 'Exported as Grow/Shrink 105%' } },
  // Exit
  fadeOut: { label: 'Fade Out', category: 'exit', pptx: 'supported', ppt: { presetID: 10, presetClass: 'exit' } },
  flyOut: { label: 'Fly Out', category: 'exit', pptx: 'supported', ppt: { presetID: 2, presetClass: 'exit' }, directions: DIR4 },
  zoomOut: { label: 'Zoom Out', category: 'exit', pptx: 'supported', ppt: { presetID: 53, presetClass: 'exit' } },
  shrink: { label: 'Shrink', category: 'exit', pptx: 'supported', ppt: { presetID: 55, presetClass: 'exit', note: 'Exported as Shrink & Turn' } },
  collapse: { label: 'Collapse', category: 'exit', pptx: 'supported', ppt: { presetID: 16, presetClass: 'exit', note: 'Exported as Split' } },
  wipeOut: { label: 'Wipe Out', category: 'exit', pptx: 'supported', ppt: { presetID: 22, presetClass: 'exit' }, directions: DIR4 },
  rotateOut: { label: 'Rotate Out', category: 'exit', pptx: 'partial', ppt: { presetID: 55, presetClass: 'exit', note: 'Exported as Shrink & Turn' } },
  blurOut: { label: 'Blur Out', category: 'exit', pptx: 'partial', ppt: { presetID: 10, presetClass: 'exit', note: 'Exported as Fade' } },
  // Motion paths
  motionLine: { label: 'Motion: Straight Line', category: 'motion', pptx: 'supported', ppt: { presetID: 0, presetClass: 'path' } },
  motionCurve: { label: 'Motion: Curve', category: 'motion', pptx: 'supported', ppt: { presetID: 0, presetClass: 'path' } },
  motionCircle: { label: 'Motion: Circle', category: 'motion', pptx: 'supported', ppt: { presetID: 0, presetClass: 'path' } },
  motionPath: { label: 'Motion: Custom / Bézier Path', category: 'motion', pptx: 'supported', ppt: { presetID: 0, presetClass: 'path' } },
} as const satisfies Record<string, EffectInfo>;
export type AnimationEffect = keyof typeof ANIMATION_EFFECTS;
export const ANIMATION_EFFECT_IDS = Object.keys(ANIMATION_EFFECTS) as AnimationEffect[];

export const ANIMATION_TRIGGERS = {
  onClick: 'Starts on the next click',
  withPrevious: 'Starts together with the previous animation',
  afterPrevious: 'Starts when the previous animation finishes',
  onEnter: 'Starts automatically when the slide appears (before any click)',
  onExit: 'Plays when leaving the slide (web preview only)',
} as const;
export type AnimationTrigger = keyof typeof ANIMATION_TRIGGERS;
export const ANIMATION_TRIGGER_IDS = Object.keys(ANIMATION_TRIGGERS) as AnimationTrigger[];

export const EASINGS = ['linear', 'ease', 'easeIn', 'easeOut', 'easeInOut', 'spring', 'bounce', 'backOut'] as const;
export type Easing = (typeof EASINGS)[number];

/* ------------------------------------------------------------------ */
/* Transitions                                                          */
/* ------------------------------------------------------------------ */
export interface TransitionInfo {
  label: string;
  pptx: SupportLevel;
  pptxNote: string;
  directions?: readonly string[];
}
export const TRANSITIONS = {
  none: { label: 'None', pptx: 'supported', pptxNote: 'No transition' },
  fade: { label: 'Fade', pptx: 'supported', pptxNote: '<p:fade/>' },
  dissolve: { label: 'Dissolve', pptx: 'supported', pptxNote: '<p:dissolve/>' },
  push: { label: 'Push', pptx: 'supported', pptxNote: '<p:push/>', directions: DIR4 },
  wipe: { label: 'Wipe', pptx: 'supported', pptxNote: '<p:wipe/>', directions: DIR4 },
  split: { label: 'Split', pptx: 'supported', pptxNote: '<p:split/>', directions: ['horizontal', 'vertical'] },
  reveal: { label: 'Reveal', pptx: 'supported', pptxNote: 'PowerPoint 2010 <p14:reveal/> with fade fallback', directions: ['left', 'right'] },
  cover: { label: 'Cover', pptx: 'supported', pptxNote: '<p:cover/>', directions: DIR4 },
  uncover: { label: 'Uncover', pptx: 'supported', pptxNote: '<p:pull/>', directions: DIR4 },
  zoom: { label: 'Zoom', pptx: 'supported', pptxNote: '<p:zoom/>' },
  morph: { label: 'Morph', pptx: 'supported', pptxNote: 'PowerPoint 365/2019+ <p159:morph> with fade fallback; objects matched by "!!id" names' },
  cube: { label: 'Cube', pptx: 'partial', pptxNote: 'PowerPoint 2010 <p14:prism isContent="1"/> (Cube-like) with push fallback', directions: DIR4 },
  flip: { label: 'Flip', pptx: 'supported', pptxNote: 'PowerPoint 2010 <p14:flip/> with fade fallback', directions: ['left', 'right'] },
  gallery: { label: 'Gallery', pptx: 'supported', pptxNote: 'PowerPoint 2010 <p14:gallery/> with push fallback', directions: ['left', 'right'] },
  randomBars: { label: 'Random Bars', pptx: 'supported', pptxNote: '<p:randomBar/>', directions: ['horizontal', 'vertical'] },
  blinds: { label: 'Blinds', pptx: 'supported', pptxNote: '<p:blinds/>', directions: ['horizontal', 'vertical'] },
  checkerboard: { label: 'Checkerboard', pptx: 'supported', pptxNote: '<p:checker/>', directions: ['horizontal', 'vertical'] },
} as const satisfies Record<string, TransitionInfo>;
export type TransitionType = keyof typeof TRANSITIONS;
export const TRANSITION_IDS = Object.keys(TRANSITIONS) as TransitionType[];

/* ------------------------------------------------------------------ */
/* Aliases accepted by Auto Fix (other AIs often use these names)       */
/* ------------------------------------------------------------------ */
export const EFFECT_ALIASES: Record<string, AnimationEffect> = {
  fade: 'fadeIn', 'fade-in': 'fadeIn', fade_in: 'fadeIn', fadein: 'fadeIn', opacity: 'fadeIn',
  fly: 'flyIn', 'fly-in': 'flyIn', slidein: 'flyIn', 'slide-in': 'flyIn', slideIn: 'flyIn', slideUp: 'rise', 'slide-up': 'rise', slideup: 'rise',
  float: 'floatIn', zoom: 'zoomIn', 'zoom-in': 'zoomIn', scaleIn: 'zoomIn', scale: 'zoomIn', 'scale-in': 'zoomIn',
  fadeUp: 'rise', 'fade-up': 'rise', fadeInUp: 'rise', riseUp: 'rise', blur: 'blurIn', rotate: 'rotateIn', flip: 'flipIn',
  type: 'typewriter', typing: 'typewriter', 'draw-line': 'draw', popIn: 'pop', 'pop-in': 'pop',
  'fade-out': 'fadeOut', fadeout: 'fadeOut', 'zoom-out': 'zoomOut', 'fly-out': 'flyOut',
  wiggle: 'shake', heartbeat: 'pulse', glow: 'highlight', blink: 'flash',
};
export const TRANSITION_ALIASES: Record<string, TransitionType> = {
  slide: 'push', slideLeft: 'push', 'slide-left': 'push', crossfade: 'fade', 'cross-fade': 'fade', magicMove: 'morph', 'magic-move': 'morph',
  cube3d: 'cube', 'flip3d': 'flip', bars: 'randomBars', checker: 'checkerboard', zoomIn: 'zoom', scale: 'zoom', smooth: 'morph',
};
