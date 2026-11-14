import type { SlideElement } from '@/types/schema';

export interface Box { x: number; y: number; width: number; height: number }
export const boxOf = (e: Box): Box => ({ x: e.x, y: e.y, width: e.width, height: e.height });
export function unionBox(els: Box[]): Box {
  const x0 = Math.min(...els.map((e) => e.x)), y0 = Math.min(...els.map((e) => e.y));
  const x1 = Math.max(...els.map((e) => e.x + e.width)), y1 = Math.max(...els.map((e) => e.y + e.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
export function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export interface Guide { axis: 'x' | 'y'; pos: number; from: number; to: number }

/** Smart guides: snap the moving box's edges/centers to other elements and the slide. */
export function snapBox(moving: Box, others: Box[], slide: { width: number; height: number }, threshold: number, opts: { grid?: number; objects?: boolean }): { dx: number; dy: number; guides: Guide[] } {
  let dx = 0, dy = 0;
  const guides: Guide[] = [];
  if (opts.grid) {
    const gx = Math.round(moving.x / opts.grid) * opts.grid - moving.x;
    const gy = Math.round(moving.y / opts.grid) * opts.grid - moving.y;
    if (Math.abs(gx) <= threshold) dx = gx;
    if (Math.abs(gy) <= threshold) dy = gy;
  }
  if (opts.objects === false) return { dx, dy, guides };
  const targets: Box[] = [{ x: 0, y: 0, width: slide.width, height: slide.height }, ...others];
  const xs = (b: Box) => [b.x, b.x + b.width / 2, b.x + b.width];
  const ys = (b: Box) => [b.y, b.y + b.height / 2, b.y + b.height];
  let bestX = threshold + 1, bestY = threshold + 1;
  let gx: Guide | null = null, gy: Guide | null = null;
  for (const t of targets) {
    for (const mx of xs(moving)) for (const tx of xs(t)) {
      const d = tx - mx;
      if (Math.abs(d) < bestX && Math.abs(d) <= threshold) { bestX = Math.abs(d); dx = d; gx = { axis: 'x', pos: tx, from: Math.min(t.y, moving.y), to: Math.max(t.y + t.height, moving.y + moving.height) }; }
    }
    for (const my of ys(moving)) for (const ty of ys(t)) {
      const d = ty - my;
      if (Math.abs(d) < bestY && Math.abs(d) <= threshold) { bestY = Math.abs(d); dy = d; gy = { axis: 'y', pos: ty, from: Math.min(t.x, moving.x), to: Math.max(t.x + t.width, moving.x + moving.width) }; }
    }
  }
  if (gx) guides.push(gx);
  if (gy) guides.push(gy);
  return { dx, dy, guides };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export function resizeBox(start: Box, h: Handle, dx: number, dy: number, keepRatio: boolean, min = 8): Box {
  let { x, y, width, height } = start;
  if (h.includes('e')) width = start.width + dx;
  if (h.includes('s')) height = start.height + dy;
  if (h.includes('w')) { width = start.width - dx; x = start.x + dx; }
  if (h.includes('n')) { height = start.height - dy; y = start.y + dy; }
  if (keepRatio && start.width > 0 && start.height > 0) {
    const r = start.width / start.height;
    if (h === 'n' || h === 's') { width = height * r; x = start.x + (start.width - width) / 2; }
    else if (h === 'e' || h === 'w') { height = width / r; y = start.y + (start.height - height) / 2; }
    else {
      if (Math.abs(width / start.width) > Math.abs(height / start.height)) height = width / r; else width = height * r;
      if (h.includes('w')) x = start.x + start.width - width;
      if (h.includes('n')) y = start.y + start.height - height;
    }
  }
  if (width < min) { if (h.includes('w')) x -= min - width; width = min; }
  if (height < min) { if (h.includes('n')) y -= min - height; height = min; }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export const isTextLike = (e: SlideElement) => ['text', 'heading', 'paragraph', 'richText'].includes(e.type) || (e.type === 'shape');
export const keepsRatio = (e: SlideElement) => ['icon', 'visual3d'].includes(e.type);
