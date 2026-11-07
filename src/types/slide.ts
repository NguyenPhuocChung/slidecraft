import type { SlideElement } from './element';

/** Reserved animation fields (full engine post-v1) */
export type AnimationCategory = 'entrance' | 'emphasis' | 'exit';
export type AnimationTrigger = 'on-click' | 'with-previous' | 'after-previous';

export interface ElementAnimation {
  id: string;
  elementId: string;
  category: AnimationCategory;
  effect: string;
  duration: number;
  delay: number;
  trigger: AnimationTrigger;
  direction?: string;
  order: number;
  repeat?: number;
}

export interface SlideTransition {
  effect: 'none' | 'fade' | 'push' | 'wipe' | 'split' | 'reveal' | 'cover' | 'uncover';
  duration: number;
  direction?: string;
}

export interface SlideBackground {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: { from: string; to: string; angle?: number };
  imageSrc?: string;
  assetId?: string;
}

export interface Slide {
  id: string;
  width: number;
  height: number;
  background?: SlideBackground;
  elements: SlideElement[];
  /** Reserved for post-v1 animation engine */
  animations?: ElementAnimation[];
  transition?: SlideTransition;
  notes?: string;
  /** True when this slide contains unsupported elements and must open in iframe */
  hasUnsupportedContent?: boolean;
  /** Origin: authored with contract components, measured from arbitrary JSX, or model-only */
  source: 'contract' | 'measured' | 'model-only';
}

export interface SlideDocument {
  version: number;
  slideWidth: number;
  slideHeight: number;
  slides: Slide[];
  /** Compatibility flags from last parse/export */
  compatibility?: CompatibilityReport;
}

export interface CompatibilityIssue {
  slideId: string;
  elementId?: string;
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface CompatibilityReport {
  generatedAt: string;
  fullyEditable: boolean;
  approximateElements: number;
  unsupportedElements: number;
  issues: CompatibilityIssue[];
}

/** Canonical 16:9 size used throughout the app and for PPTX mapping */
export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;
/** PowerPoint inches: 13.333 × 7.5 */
export const PPTX_WIDTH_IN = 13.333;
export const PPTX_HEIGHT_IN = 7.5;
/** px → pt for fonts (approximate; PowerPoint uses 96 dpi web mapping) */
export const PX_TO_PT = 0.75;
