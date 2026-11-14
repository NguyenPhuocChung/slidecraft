/**
 * Scene graph shared by the web renderer (SVG) and the PPTX exporter (native shapes).
 * Coordinates are in element-local px. Colors are concrete (theme tokens resolved).
 */
import { textWidth } from '@/utils/richtext';

export interface PBase { opacity?: number; id?: string }
export interface PRect extends PBase { k: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string; sw?: number; dash?: boolean; preset?: string; flipH?: boolean; text?: string; textColor?: string; fontSize?: number; bold?: boolean }
export interface PEllipse extends PBase { k: 'ellipse'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number; text?: string; textColor?: string; fontSize?: number; bold?: boolean }
export interface PPoly extends PBase { k: 'poly'; pts: [number, number][]; closed?: boolean; fill?: string; stroke?: string; sw?: number; dash?: boolean }
export interface PLine extends PBase { k: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; head?: 'triangle' | 'none'; tail?: 'triangle' | 'oval' | 'none'; dash?: boolean }
export interface PText extends PBase {
  k: 'text'; x: number; y: number; w: number; h: number; text: string; size: number; color: string; weight?: number;
  align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; font?: 'heading' | 'body' | 'mono'; italic?: boolean; lineHeight?: number;
}
export interface PIcon extends PBase { k: 'icon'; x: number; y: number; w: number; h: number; name: string; color: string }
export type Prim = PRect | PEllipse | PPoly | PLine | PText | PIcon;

export interface Scene { w: number; h: number; prims: Prim[]; fonts: { heading: string; body: string; mono: string } }

/** Wrap text into lines that fit `maxW` (used by SVG output; PPTX uses native wrapping). */
export function wrapText(text: string, maxW: number, size: number, font: string, weight: number | string = 400): string[] {
  const out: string[] = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (textWidth(t, size, font, weight) <= maxW || !line) line = t;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 48): [number, number][] {
  const pts: [number, number][] = [];
  const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) / (Math.PI * 2)) * steps));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}
/** Annular sector (donut slice) polygon. Angles in radians, 0 = 3 o'clock, clockwise. */
export function ringSlice(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): [number, number][] {
  const outer = arcPoints(cx, cy, r1, r1, a0, a1);
  if (r0 <= 0) return [[cx, cy], ...outer];
  const inner = arcPoints(cx, cy, r0, r0, a1, a0);
  return [...outer, ...inner];
}

export function niceScale(min: number, max: number, ticks = 5): { min: number; max: number; step: number } {
  if (min === max) { max = min + 1; }
  const range = max - min;
  const rough = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rough))));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step };
}
