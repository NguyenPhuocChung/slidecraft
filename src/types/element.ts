/** Element types supported by the Slide Document Model and PPTX export */

export type ElementType =
  | 'text'
  | 'image'
  | 'shape'
  | 'line'
  | 'table'
  | 'chart'
  | 'group'
  | 'unsupported';

export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'rounded-rectangle';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  locked?: boolean;
  /** Origin of this element: from authoring contract, measured from DOM, or model-only */
  source: 'contract' | 'measured' | 'model-only' | 'override';
  /** True when geometry/style came from getBoundingClientRect and may be approximate */
  approximate?: boolean;
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  /** Rich runs; if present, content is derived from runs */
  runs?: TextRun[];
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  /** Asset id in IndexedDB when stored locally */
  assetId?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius?: number;
  alt?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
  stroke?: string;
  strokeWidth?: number;
}

export interface TableCell {
  content: string;
  bold?: boolean;
  color?: string;
  backgroundColor?: string;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: TableCell[][];
  borderColor?: string;
  borderWidth?: number;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartElement extends BaseElement {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area';
  categories: string[];
  series: ChartSeries[];
  title?: string;
}

export interface GroupElement extends BaseElement {
  type: 'group';
  children: string[]; // element ids
}

export interface UnsupportedElement extends BaseElement {
  type: 'unsupported';
  tagName?: string;
  reason: string;
  /** Snapshot HTML for iframe-only rendering when needed */
  htmlSnapshot?: string;
}

export type SlideElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | LineElement
  | TableElement
  | ChartElement
  | GroupElement
  | UnsupportedElement;
