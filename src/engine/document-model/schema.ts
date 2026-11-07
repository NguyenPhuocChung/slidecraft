import { z } from 'zod';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/slide';

const TextRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
});

const BaseElementSchema = z.object({
  id: z.string().min(1).max(128),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  zIndex: z.number().optional(),
  locked: z.boolean().optional(),
  source: z.enum(['contract', 'measured', 'model-only', 'override']),
  approximate: z.boolean().optional(),
});

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string(),
  runs: z.array(TextRunSchema).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  verticalAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  backgroundColor: z.string().optional(),
});

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  src: z.string(),
  assetId: z.string().optional(),
  objectFit: z.enum(['cover', 'contain', 'fill', 'none']).optional(),
  borderRadius: z.number().optional(),
  alt: z.string().optional(),
});

export const ShapeElementSchema = BaseElementSchema.extend({
  type: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'circle', 'ellipse', 'triangle', 'rounded-rectangle']),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  borderRadius: z.number().optional(),
});

export const LineElementSchema = BaseElementSchema.extend({
  type: z.literal('line'),
  x2: z.number(),
  y2: z.number(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
});

export const TableElementSchema = BaseElementSchema.extend({
  type: z.literal('table'),
  rows: z.number().int().positive(),
  cols: z.number().int().positive(),
  cells: z.array(z.array(z.object({
    content: z.string(),
    bold: z.boolean().optional(),
    color: z.string().optional(),
    backgroundColor: z.string().optional(),
  }))),
  borderColor: z.string().optional(),
  borderWidth: z.number().optional(),
});

export const ChartElementSchema = BaseElementSchema.extend({
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie', 'area']),
  categories: z.array(z.string()),
  series: z.array(z.object({
    name: z.string(),
    values: z.array(z.number()),
  })),
  title: z.string().optional(),
});

export const UnsupportedElementSchema = BaseElementSchema.extend({
  type: z.literal('unsupported'),
  tagName: z.string().optional(),
  reason: z.string(),
  htmlSnapshot: z.string().optional(),
});

export const SlideElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  LineElementSchema,
  TableElementSchema,
  ChartElementSchema,
  UnsupportedElementSchema,
]);

export const ElementAnimationSchema = z.object({
  id: z.string(),
  elementId: z.string(),
  category: z.enum(['entrance', 'emphasis', 'exit']),
  effect: z.string(),
  duration: z.number().nonnegative(),
  delay: z.number().nonnegative(),
  trigger: z.enum(['on-click', 'with-previous', 'after-previous']),
  direction: z.string().optional(),
  order: z.number().int(),
  repeat: z.number().int().optional(),
});

export const SlideTransitionSchema = z.object({
  effect: z.enum(['none', 'fade', 'push', 'wipe', 'split', 'reveal', 'cover', 'uncover']),
  duration: z.number().nonnegative(),
  direction: z.string().optional(),
});

export const SlideBackgroundSchema = z.object({
  type: z.enum(['solid', 'gradient', 'image']),
  color: z.string().optional(),
  gradient: z.object({
    from: z.string(),
    to: z.string(),
    angle: z.number().optional(),
  }).optional(),
  imageSrc: z.string().optional(),
  assetId: z.string().optional(),
});

export const SlideSchema = z.object({
  id: z.string().min(1),
  width: z.number().positive().default(SLIDE_WIDTH),
  height: z.number().positive().default(SLIDE_HEIGHT),
  background: SlideBackgroundSchema.optional(),
  elements: z.array(SlideElementSchema).max(500),
  animations: z.array(ElementAnimationSchema).optional(),
  transition: SlideTransitionSchema.optional(),
  notes: z.string().optional(),
  hasUnsupportedContent: z.boolean().optional(),
  source: z.enum(['contract', 'measured', 'model-only']),
});

export const CompatibilityIssueSchema = z.object({
  slideId: z.string(),
  elementId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']),
  code: z.string(),
  message: z.string(),
});

export const CompatibilityReportSchema = z.object({
  generatedAt: z.string(),
  fullyEditable: z.boolean(),
  approximateElements: z.number().int().nonnegative(),
  unsupportedElements: z.number().int().nonnegative(),
  issues: z.array(CompatibilityIssueSchema),
});

export const SlideDocumentSchema = z.object({
  version: z.number().int().positive(),
  slideWidth: z.number().positive(),
  slideHeight: z.number().positive(),
  slides: z.array(SlideSchema).max(200),
  compatibility: CompatibilityReportSchema.optional(),
});

export type ValidatedSlideDocument = z.infer<typeof SlideDocumentSchema>;
