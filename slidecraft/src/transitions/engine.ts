/**
 * Transition Engine — animates an outgoing and incoming slide layer.
 * Morph matches elements with the same id on both slides and interpolates
 * position, size, rotation, opacity and fill/text color (real morph, not a fade).
 */
import type { Slide, SlideElement, Transition } from '@/types/schema';
import { EASING_CSS } from '@/animation/engine';
import type { Easing } from '@/types/registry';

export interface TransitionLayers { container: HTMLElement; outLayer: HTMLElement | null; inLayer: HTMLElement }

function rnd(seed: number) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

/** Union of rectangles as one polygon (connected through zero-width bridges on the left edge). */
function stripsPolygon(rects: { x: number; y: number; w: number; h: number }[]): string {
  const pts: string[] = [];
  rects.forEach((r) => {
    pts.push(`0% ${r.y}%`, `${r.x}% ${r.y}%`, `${r.x}% ${r.y}%`, `${r.x + r.w}% ${r.y}%`, `${r.x + r.w}% ${r.y + r.h}%`, `${r.x}% ${r.y + r.h}%`, `${r.x}% ${r.y}%`, `0% ${r.y}%`);
  });
  return `polygon(${pts.join(', ')})`;
}
function barsFrames(kind: 'blinds' | 'randomBars' | 'checkerboard', vertical: boolean, steps = 12): Keyframe[] {
  const n = kind === 'checkerboard' ? 8 : kind === 'blinds' ? 6 : 24;
  const r = rnd(42);
  const order = Array.from({ length: n }, () => (kind === 'randomBars' ? r() : kind === 'checkerboard' ? 0 : 0));
  const frames: Keyframe[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    if (kind === 'checkerboard') {
      for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
        const delay = ((row + col) % 2) * 0.5;
        const p = Math.max(0, Math.min(1, (t - delay) / 0.5));
        const size = 100 / n;
        if (vertical) rects.push({ x: col * size, y: row * size, w: size, h: size * p });
        else rects.push({ x: col * size, y: row * size, w: size * p, h: size });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const size = 100 / n;
        const p = kind === 'randomBars' ? (t >= order[i] * 0.8 ? Math.min(1, (t - order[i] * 0.8) / 0.2) : 0) : t;
        if (vertical) rects.push({ x: i * size, y: 0, w: size * p, h: 100 });
        else rects.push({ x: 0, y: i * size, w: 100, h: size * p });
      }
    }
    frames.push({ clipPath: stripsPolygon(rects), offset: t });
  }
  return frames;
}

const dirVec = (d?: string): [number, number] => (d === 'right' ? [-1, 0] : d === 'up' ? [0, 1] : d === 'down' ? [0, -1] : [1, 0]); // "from right" by default for push (content moves left)

export function runTransition(t: Transition | undefined, layers: TransitionLayers, opts: { prevSlide?: Slide; nextSlide?: Slide; speed?: number } = {}): { finished: Promise<void>; finish: () => void } {
  const type = t?.type ?? 'none';
  const duration = Math.max(1, (t?.duration ?? 700) / (opts.speed ?? 1));
  const easing = t?.easing ? EASING_CSS[t.easing as Easing] : 'cubic-bezier(.65,0,.35,1)';
  const anims: globalThis.Animation[] = [];
  const { outLayer: out, inLayer: inn } = layers;
  const A = (el: Element | null, frames: Keyframe[], o: KeyframeAnimationOptions = {}) => { if (el) anims.push(el.animate(frames, { duration, easing, fill: 'both', ...o })); };
  const dir = t?.direction;
  const [vx, vy] = dirVec(dir);
  const pct = (x: number, y: number) => `translate(${x * 100}%, ${y * 100}%)`;
  if (out) out.style.zIndex = '1';
  inn.style.zIndex = '2';
  switch (type) {
    case 'none':
      break;
    case 'fade': A(inn, [{ opacity: 0 }, { opacity: 1 }]); break;
    case 'dissolve': A(inn, [{ opacity: 0, filter: 'contrast(1.6) blur(6px)' }, { opacity: 1, filter: 'contrast(1) blur(0)' }], { easing: 'steps(14, end)' }); break;
    case 'push': A(out, [{ transform: pct(0, 0) }, { transform: pct(-vx, -vy) }]); A(inn, [{ transform: pct(vx, vy) }, { transform: pct(0, 0) }]); break;
    case 'cover': A(inn, [{ transform: pct(vx, vy) }, { transform: pct(0, 0) }]); break;
    case 'uncover': if (out) { out.style.zIndex = '3'; } A(out, [{ transform: pct(0, 0) }, { transform: pct(-vx, -vy) }]); break;
    case 'wipe': {
      const from = dir === 'right' ? 'inset(0 0 0 100%)' : dir === 'up' ? 'inset(100% 0 0 0)' : dir === 'down' ? 'inset(0 0 100% 0)' : 'inset(0 100% 0 0)';
      A(inn, [{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }]);
      break;
    }
    case 'split': A(inn, [{ clipPath: dir === 'vertical' ? 'inset(50% 0 50% 0)' : 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }]); break;
    case 'reveal': if (out) out.style.zIndex = '3'; A(out, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${dir === 'right' ? 8 : -8}%)` }]); A(inn, [{ opacity: 0.2, transform: 'scale(1.04)' }, { opacity: 1, transform: 'scale(1)' }]); break;
    case 'zoom': A(out, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.35)' }]); A(inn, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }]); break;
    case 'cube': {
      layers.container.style.perspective = '2400px';
      const left = dir !== 'right';
      A(out, [{ transform: 'rotateY(0deg)', transformOrigin: left ? '0% 50%' : '100% 50%' }, { transform: `translateX(${left ? -100 : 100}%) rotateY(${left ? -90 : 90}deg)`, transformOrigin: left ? '100% 50%' : '0% 50%' }]);
      A(inn, [{ transform: `translateX(${left ? 100 : -100}%) rotateY(${left ? 90 : -90}deg)`, transformOrigin: left ? '0% 50%' : '100% 50%' }, { transform: 'translateX(0) rotateY(0deg)', transformOrigin: left ? '0% 50%' : '100% 50%' }]);
      break;
    }
    case 'flip': {
      layers.container.style.perspective = '2400px';
      A(out, [{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: 'rotateY(90deg)', opacity: 1, offset: 0.5 }, { transform: 'rotateY(90deg)', opacity: 0 }]);
      A(inn, [{ transform: 'rotateY(-90deg)', opacity: 0 }, { transform: 'rotateY(-90deg)', opacity: 1, offset: 0.5 }, { transform: 'rotateY(0deg)', opacity: 1 }]);
      break;
    }
    case 'gallery': A(out, [{ transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-60%) scale(0.75)', opacity: 0.4 }]); A(inn, [{ transform: 'translateX(60%) scale(0.75)', opacity: 0.4 }, { transform: 'translateX(0) scale(1)', opacity: 1 }]); break;
    case 'randomBars': A(inn, barsFrames('randomBars', dir === 'vertical'), { easing: 'linear' }); break;
    case 'blinds': A(inn, barsFrames('blinds', dir === 'vertical'), { easing: 'linear' }); break;
    case 'checkerboard': A(inn, barsFrames('checkerboard', dir === 'vertical'), { easing: 'linear' }); break;
    case 'morph': runMorph(layers, opts.prevSlide, opts.nextSlide, duration, easing, anims); break;
    default: A(inn, [{ opacity: 0 }, { opacity: 1 }]);
  }
  return {
    finished: Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(() => { layers.container.style.perspective = ''; }),
    finish: () => anims.forEach((a) => { try { a.finish(); } catch { /* ignore */ } }),
  };
}

function q(layer: HTMLElement | null, id: string) {
  return layer?.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(id)}"]`) ?? null;
}
function fillOf(el: SlideElement): string | undefined { return el.style?.fill; }

/**
 * Morph: for every element id present on both slides, the incoming element is
 * animated from the outgoing geometry. Unmatched outgoing elements fade out,
 * unmatched incoming elements fade in; backgrounds cross-fade.
 */
function runMorph(layers: TransitionLayers, prev: Slide | undefined, next: Slide | undefined, duration: number, easing: string, anims: globalThis.Animation[]) {
  const { outLayer: out, inLayer: inn } = layers;
  if (!prev || !next || !out) { anims.push(inn.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'both' })); return; }
  const prevById = new Map(prev.elements.map((e) => [e.id, e]));
  const matched = next.elements.filter((e) => prevById.has(e.id) && prevById.get(e.id)!.type === e.type);
  const matchedIds = new Set(matched.map((e) => e.id));
  // Outgoing layer stays below; hide its matched elements (the incoming copies travel instead)
  out.style.zIndex = '1';
  inn.style.zIndex = '2';
  matchedIds.forEach((id) => { const n = q(out, id); if (n) n.style.visibility = 'hidden'; });
  // incoming background cross-fades in
  const bg = inn.querySelector<HTMLElement>('[data-slide-bg]');
  if (bg) anims.push(bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing, fill: 'both' }));
  // unmatched outgoing: fade out (outgoing layer is under, so fade it as the incoming bg appears)
  prev.elements.filter((e) => !matchedIds.has(e.id)).forEach((e) => { const n = q(out, e.id); if (n) anims.push(n.animate([{ opacity: e.opacity ?? 1 }, { opacity: 0 }], { duration: duration * 0.6, easing, fill: 'both' })); });
  // unmatched incoming: fade in during second half
  next.elements.filter((e) => !matchedIds.has(e.id)).forEach((e) => { const n = q(inn, e.id); if (n) anims.push(n.animate([{ opacity: 0 }, { opacity: e.opacity ?? 1 }], { duration: duration * 0.6, delay: duration * 0.4, easing, fill: 'both' })); });
  // matched: interpolate geometry + rotation + opacity (+ fill & text color)
  matched.forEach((e) => {
    const p = prevById.get(e.id)!;
    const n = q(inn, e.id);
    if (!n) return;
    anims.push(n.animate([
      { left: `${p.x}px`, top: `${p.y}px`, width: `${p.width}px`, height: `${p.height}px`, transform: `rotate(${p.rotation ?? 0}deg)`, opacity: p.opacity ?? 1 },
      { left: `${e.x}px`, top: `${e.y}px`, width: `${e.width}px`, height: `${e.height}px`, transform: `rotate(${e.rotation ?? 0}deg)`, opacity: e.opacity ?? 1 },
    ], { duration, easing, fill: 'both' }));
    const pf = fillOf(p), nf = fillOf(e);
    if (e.type === 'shape' && pf !== nf) {
      const fromNode = q(out, e.id)?.querySelector('path');
      const toNode = n.querySelector('path');
      const from = fromNode ? getComputedStyle(fromNode).fill : undefined;
      const to = toNode ? getComputedStyle(toNode).fill : undefined;
      if (toNode && from && to) anims.push(toNode.animate([{ fill: from }, { fill: to }], { duration, easing, fill: 'both' }));
    }
    const pt = q(out, e.id)?.querySelector<HTMLElement>('[data-text-root]');
    const nt = n.querySelector<HTMLElement>('[data-text-root]');
    if (pt && nt) {
      const fc = getComputedStyle(pt).color, tc = getComputedStyle(nt).color;
      const fs = parseFloat(getComputedStyle(pt).fontSize), ts = parseFloat(getComputedStyle(nt).fontSize);
      const kf: Keyframe[] = [{ color: fc }, { color: tc }];
      if (fs && ts && Math.abs(fs - ts) > 0.5) { kf[0].fontSize = `${fs}px`; kf[1].fontSize = `${ts}px`; }
      if (fc !== tc || kf[0].fontSize) anims.push(nt.animate(kf, { duration, easing, fill: 'both' }));
    }
  });
}

/** Ids shared between two slides — used by the Morph inspector and the PPTX adapter. */
export function morphPairs(prev: Slide | undefined, next: Slide | undefined): string[] {
  if (!prev || !next) return [];
  const ids = new Set(prev.elements.map((e) => e.id));
  return next.elements.filter((e) => ids.has(e.id)).map((e) => e.id);
}
