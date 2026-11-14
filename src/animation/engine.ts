/**
 * Animation Engine — per-element animations built on the Web Animations API.
 * The same step model drives the editor preview, the timeline and the
 * presentation player, and is mirrored by the PPTX OOXML timing adapter.
 */
import type { Animation, Slide, SlideElement } from '@/types/schema';
import { ANIMATION_EFFECTS, type AnimationEffect, type Easing } from '@/types/registry';

export interface TimedAnim { elId: string; anim: Animation; start: number; end: number; category: string; el: SlideElement }
export interface AnimStep { trigger: 'auto' | 'click'; items: TimedAnim[]; duration: number }
export interface SlideTimeline { steps: AnimStep[]; initialHidden: Set<string>; exitItems: TimedAnim[]; total: number }

export const EASING_CSS: Record<Easing, string> = {
  linear: 'linear', ease: 'ease', easeIn: 'cubic-bezier(.42,0,1,1)', easeOut: 'cubic-bezier(0,0,.2,1)', easeInOut: 'cubic-bezier(.65,0,.35,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)', bounce: 'cubic-bezier(.68,-0.55,.27,1.55)', backOut: 'cubic-bezier(.34,1.56,.64,1)',
};

export function categoryOf(effect: string): string {
  return (ANIMATION_EFFECTS as Record<string, { category: string }>)[effect]?.category ?? 'entrance';
}

/** All animations of a slide in play order (explicit `order` first, then element order). */
export function orderedAnimations(slide: Slide): { el: SlideElement; anim: Animation; idx: number }[] {
  const list: { el: SlideElement; anim: Animation; idx: number; seq: number }[] = [];
  let seq = 0;
  slide.elements.forEach((el) => (el.animation ?? []).forEach((anim, idx) => list.push({ el, anim, idx, seq: seq++ })));
  return list.sort((a, b) => (a.anim.order ?? a.seq + 10000) - (b.anim.order ?? b.seq + 10000) || a.seq - b.seq);
}

export function buildTimeline(slide: Slide): SlideTimeline {
  const auto: AnimStep = { trigger: 'auto', items: [], duration: 0 };
  const steps: AnimStep[] = [auto];
  const exitItems: TimedAnim[] = [];
  const initialHidden = new Set<string>();
  const seenFirst = new Set<string>();
  let cur: AnimStep = auto;
  let prevStart = 0, prevEnd = 0;
  for (const { el, anim } of orderedAnimations(slide)) {
    const category = categoryOf(anim.effect);
    const trigger = anim.trigger ?? 'onClick';
    if (!seenFirst.has(el.id)) { seenFirst.add(el.id); if (category === 'entrance' && trigger !== 'onExit') initialHidden.add(el.id); }
    const dur = anim.duration ?? 600, delay = anim.delay ?? 0;
    const reps = anim.repeat === 'infinite' ? 1 : Math.max(1, (anim.repeat ?? 0) + 1);
    if (trigger === 'onExit') { exitItems.push({ elId: el.id, anim, start: delay, end: delay + dur, category, el }); continue; }
    let start: number;
    let step = cur;
    if (trigger === 'onClick') { cur = step = { trigger: 'click', items: [], duration: 0 }; steps.push(step); start = delay; }
    else if (trigger === 'onEnter') { step = auto; start = delay; }
    else if (trigger === 'withPrevious') start = prevStart + delay;
    else start = prevEnd + delay; // afterPrevious
    const end = start + dur * reps;
    step.items.push({ elId: el.id, anim, start, end, category, el });
    step.duration = Math.max(step.duration, end);
    if (step === cur) { prevStart = start; prevEnd = end; }
  }
  const out = auto.items.length ? steps : steps.slice(1);
  return { steps: out, initialHidden, exitItems, total: out.reduce((s, st) => s + st.duration, 0) };
}

/* ----------------------------------------------------------------------------
 * Keyframes per effect
 * -------------------------------------------------------------------------- */
interface KF { frames: Keyframe[]; opts?: KeyframeAnimationOptions; target?: 'inner' | 'outer' | 'text' | 'path' }

function samplePath(d: string, n = 40): { x: number; y: number }[] {
  if (typeof document === 'undefined') return [];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('d', d);
  const len = svg.getTotalLength();
  return Array.from({ length: n + 1 }, (_, i) => { const p = svg.getPointAtLength((len * i) / n); return { x: p.x, y: p.y }; });
}

export function motionPathD(anim: Animation): string {
  const p = anim.path ?? { type: 'line' };
  const dx = p.dx ?? 400, dy = p.dy ?? 0;
  switch (anim.effect === 'motionCircle' ? 'circle' : anim.effect === 'motionCurve' ? 'curve' : anim.effect === 'motionPath' && p.d ? 'custom' : p.type) {
    case 'circle': { const r = p.radius ?? 150; return `M0,0 a${r},${r} 0 1,1 0,${2 * r} a${r},${r} 0 1,1 0,${-2 * r}`; }
    case 'curve': return `M0,0 Q${dx / 2},${(p.dy ?? 0) - Math.max(160, Math.abs(dx) * 0.4)} ${dx},${dy}`;
    case 'custom': return p.d ?? 'M0,0 L400,0';
    default: return `M0,0 L${dx},${dy}`;
  }
}

export function effectKeyframes(anim: Animation, el: SlideElement, canvas: { width: number; height: number }): KF {
  const dir = anim.direction ?? (anim.effect === 'flyIn' || anim.effect === 'flyOut' ? 'left' : 'left');
  const e = anim.effect as AnimationEffect;
  const off = { left: `translate(${-(el.x + el.width + 40)}px, 0)`, right: `translate(${canvas.width - el.x + 40}px, 0)`, up: `translate(0, ${-(el.y + el.height + 40)}px)`, down: `translate(0, ${canvas.height - el.y + 40}px)` } as Record<string, string>;
  const wipeFrom: Record<string, string> = { left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', up: 'inset(100% 0 0 0)', down: 'inset(0 0 100% 0)' };
  const wipeTo: Record<string, string> = { left: 'inset(0 0 100% 0)', right: 'inset(0 100% 0 0)', up: 'inset(0 0 100% 0)', down: 'inset(100% 0 0 0)' };
  switch (e) {
    case 'fadeIn': return { frames: [{ opacity: 0 }, { opacity: 1 }] };
    case 'appear': return { frames: [{ opacity: 0 }, { opacity: 1 }], opts: { easing: 'step-start' } };
    case 'flyIn': return { frames: [{ transform: off[dir] ?? off.left }, { transform: 'translate(0,0)' }] };
    case 'floatIn': return { frames: [{ opacity: 0, transform: `translateY(${dir === 'down' ? -80 : 80}px)` }, { opacity: 1, transform: 'translateY(0)' }] };
    case 'zoomIn': return { frames: [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'scale(1)' }] };
    case 'grow': return { frames: [{ transform: 'scale(0)' }, { transform: 'scale(1)' }] };
    case 'wipe': case 'reveal': case 'draw':
      if (e === 'draw' && (el.type === 'line' || el.type === 'arrow')) return { frames: [{ strokeDasharray: '4000', strokeDashoffset: '4000' }, { strokeDasharray: '4000', strokeDashoffset: '0' }], target: 'path' };
      return { frames: [{ clipPath: wipeFrom[dir] ?? wipeFrom.left, ...(e === 'reveal' ? { transform: 'translateX(-24px)', opacity: 0.4 } : {}) }, { clipPath: 'inset(0 0 0 0)', ...(e === 'reveal' ? { transform: 'translateX(0)', opacity: 1 } : {}) }] };
    case 'split': return { frames: [{ clipPath: dir === 'vertical' ? 'inset(50% 0 50% 0)' : 'inset(0 50% 0 50%)' }, { clipPath: 'inset(0 0 0 0)' }] };
    case 'rise': return { frames: [{ opacity: 0, transform: 'translateY(90px)' }, { opacity: 1, transform: 'translateY(0)' }], opts: { easing: EASING_CSS.backOut } };
    case 'bounce': return { frames: [{ opacity: 0, transform: 'translateY(-260px)', offset: 0 }, { opacity: 1, transform: 'translateY(0)', offset: 0.55 }, { transform: 'translateY(-60px)', offset: 0.72 }, { transform: 'translateY(0)', offset: 0.86 }, { transform: 'translateY(-16px)', offset: 0.93 }, { transform: 'translateY(0)', offset: 1 }], opts: { easing: 'ease-out' } };
    case 'blurIn': return { frames: [{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0)' }] };
    case 'rotateIn': return { frames: [{ opacity: 0, transform: 'rotate(-200deg) scale(0.3)' }, { opacity: 1, transform: 'rotate(0) scale(1)' }] };
    case 'flipIn': return { frames: [{ opacity: 0, transform: 'perspective(1200px) rotateY(90deg)' }, { opacity: 1, transform: 'perspective(1200px) rotateY(0)' }] };
    case 'typewriter': {
      const chars = Math.max(4, JSON.stringify(el.content?.paragraphs ?? '').length / 3);
      return { frames: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], opts: { easing: `steps(${Math.round(Math.min(120, chars))}, end)` } };
    }
    case 'pop': return { frames: [{ opacity: 0, transform: 'scale(0)', offset: 0 }, { opacity: 1, transform: 'scale(1.15)', offset: 0.65 }, { transform: 'scale(1)', offset: 1 }] };
    // emphasis
    case 'pulse': return { frames: [{ transform: 'scale(1)' }, { transform: `scale(${anim.scale ?? 1.08})` }, { transform: 'scale(1)' }] };
    case 'growShrink': return { frames: [{ transform: 'scale(1)' }, { transform: `scale(${anim.scale ?? 1.15})` }], opts: { fill: 'forwards' } };
    case 'spin': return { frames: [{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], opts: { easing: 'ease-in-out' } };
    case 'teeter': return { frames: [0, 5, -5, 4, -4, 2, 0].map((r) => ({ transform: `rotate(${r}deg)` })) };
    case 'transparency': return { frames: [{ opacity: 1 }, { opacity: anim.opacity ?? 0.35 }], opts: { fill: 'forwards' } };
    case 'colorChange':
      return el.type === 'shape' ? { frames: [{}, { fill: anim.color ?? '#ef4444' }], opts: { fill: 'forwards' }, target: 'path' } : { frames: [{}, { color: anim.color ?? '#ef4444' }], opts: { fill: 'forwards' }, target: 'text' };
    case 'flash': return { frames: [{ opacity: 1 }, { opacity: 0.1 }, { opacity: 1 }, { opacity: 0.1 }, { opacity: 1 }] };
    case 'shake': return { frames: [0, -14, 14, -12, 12, -6, 6, 0].map((x) => ({ transform: `translateX(${x}px)` })) };
    case 'highlight': return { frames: [{ filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,214,0,0))' }, { filter: 'brightness(1.15) drop-shadow(0 0 24px rgba(255,214,0,.85))' }, { filter: 'brightness(1) drop-shadow(0 0 0 rgba(255,214,0,0))' }] };
    // exit
    case 'fadeOut': return { frames: [{ opacity: 1 }, { opacity: 0 }], opts: { fill: 'forwards' } };
    case 'flyOut': return { frames: [{ transform: 'translate(0,0)' }, { transform: off[dir] ?? off.right }], opts: { fill: 'forwards' } };
    case 'zoomOut': return { frames: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }], opts: { fill: 'forwards' } };
    case 'shrink': return { frames: [{ transform: 'scale(1)' }, { transform: 'scale(0)' }], opts: { fill: 'forwards' } };
    case 'collapse': return { frames: [{ transform: 'scaleY(1)', opacity: 1 }, { transform: 'scaleY(0)', opacity: 0 }], opts: { fill: 'forwards' } };
    case 'wipeOut': return { frames: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: wipeTo[dir] ?? 'inset(0 0 0 100%)' }], opts: { fill: 'forwards' } };
    case 'rotateOut': return { frames: [{ opacity: 1, transform: 'rotate(0) scale(1)' }, { opacity: 0, transform: 'rotate(200deg) scale(0.3)' }], opts: { fill: 'forwards' } };
    case 'blurOut': return { frames: [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(24px)' }], opts: { fill: 'forwards' } };
    // motion
    case 'motionLine': case 'motionCurve': case 'motionCircle': case 'motionPath': {
      const pts = samplePath(motionPathD(anim));
      return { frames: pts.length ? pts.map((p) => ({ transform: `translate(${p.x}px, ${p.y}px)` })) : [{ transform: 'translate(0,0)' }, { transform: 'translate(300px,0)' }], opts: { fill: 'forwards' }, target: 'outer-motion' as 'outer' };
    }
    default: return { frames: [{ opacity: 0 }, { opacity: 1 }] };
  }
}

export interface PlayHandle { finished: Promise<void>; finish: () => void; cancel: () => void }

function targetNode(root: HTMLElement, elId: string, target: KF['target']): Element[] {
  const outer = root.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(elId)}"]`);
  if (!outer) return [];
  const inner = outer.querySelector<HTMLElement>(':scope > [data-el-inner]') ?? outer;
  if (target === 'path') return Array.from(outer.querySelectorAll('path, line')).slice(0, 1);
  if (target === 'text') return Array.from(outer.querySelectorAll('[data-text-root]'));
  if ((target as string) === 'outer-motion') {
    // wrap motion in a dedicated layer so it composes with other transforms
    let layer = inner.querySelector<HTMLElement>(':scope > [data-motion-layer]');
    if (!layer) {
      layer = document.createElement('div');
      layer.setAttribute('data-motion-layer', '');
      layer.style.cssText = 'position:absolute;inset:0;';
      while (inner.firstChild) layer.appendChild(inner.firstChild);
      inner.appendChild(layer);
    }
    return [inner];
  }
  return [inner];
}

/** Play a list of timed animations inside `root` (the slide canvas). */
export function playItems(root: HTMLElement, items: TimedAnim[], canvas: { width: number; height: number }, opts: { speed?: number; onStart?: (elId: string) => void } = {}): PlayHandle {
  const speed = opts.speed ?? 1;
  const anims: globalThis.Animation[] = [];
  for (const it of items) {
    const kf = effectKeyframes(it.anim, it.el, canvas);
    const nodes = targetNode(root, it.elId, kf.target);
    const cat = it.category;
    const outer = root.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(it.elId)}"]`);
    if (outer && cat === 'entrance') { outer.style.opacity = String(it.el.opacity ?? 1); }
    for (const n of nodes) {
      try {
        const a = n.animate(kf.frames, {
          duration: Math.max(1, (it.anim.duration ?? 600) / speed),
          delay: it.start / speed,
          easing: kf.opts?.easing ?? EASING_CSS[(it.anim.easing as Easing) ?? (cat === 'exit' ? 'easeIn' : cat === 'emphasis' ? 'easeInOut' : 'easeOut')],
          iterations: it.anim.repeat === 'infinite' ? Infinity : Math.max(1, (it.anim.repeat ?? 0) + 1),
          fill: kf.opts?.fill ?? (cat === 'entrance' ? 'both' : cat === 'exit' ? 'forwards' : 'none'),
        });
        anims.push(a);
      } catch { /* unsupported property on this node */ }
    }
    opts.onStart?.(it.elId);
  }
  const finite = anims.filter((a) => (a.effect?.getComputedTiming().endTime ?? 0) !== Infinity);
  return {
    finished: Promise.all(finite.map((a) => a.finished.catch(() => undefined))).then(() => undefined),
    finish: () => anims.forEach((a) => { try { if ((a.effect?.getComputedTiming().endTime ?? 0) !== Infinity) a.finish(); } catch { /* ignore */ } }),
    cancel: () => anims.forEach((a) => a.cancel()),
  };
}

/** Bring every element into its final state for a given step (used when navigating backwards). */
export function settleThrough(root: HTMLElement, tl: SlideTimeline, stepIndex: number, canvas: { width: number; height: number }) {
  root.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
  const items = tl.steps.slice(0, stepIndex).flatMap((s) => s.items);
  const visible = new Set<string>();
  items.forEach((it) => { if (it.category === 'entrance') visible.add(it.elId); });
  tl.initialHidden.forEach((id) => {
    const n = root.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(id)}"]`);
    if (n) n.style.opacity = visible.has(id) ? '' : '0';
  });
  // exits / motion / persistent emphasis that already happened → apply end state instantly
  const persistent = items.filter((it) => it.category === 'exit' || it.category === 'motion' || it.anim.effect === 'growShrink' || it.anim.effect === 'transparency' || it.anim.effect === 'colorChange');
  if (persistent.length) playItems(root, persistent.map((p) => ({ ...p, start: 0 })), canvas, { speed: 1000 }).finish();
}

/* ----------------------------------------------------------------------------
 * Animation presets — assign tasteful animations by element role & reading order
 * -------------------------------------------------------------------------- */
export interface AnimPreset { id: string; name: string; description: string; assign: (role: string, i: number) => Partial<Animation> | null }
export const ANIMATION_PRESETS: AnimPreset[] = [
  { id: 'corporate', name: 'Corporate Professional', description: 'Calm fades, one click per idea.', assign: (r, i) => (r === 'decor' ? null : r === 'heading' ? { effect: 'fadeIn', trigger: i === 0 ? 'onEnter' : 'afterPrevious', duration: 500 } : { effect: 'fadeIn', trigger: 'afterPrevious', duration: 450, delay: 60 }) },
  { id: 'apple', name: 'Apple Style', description: 'Slow, confident rises with generous easing.', assign: (r, i) => (r === 'decor' ? { effect: 'fadeIn', trigger: 'onEnter', duration: 1200 } : r === 'heading' ? { effect: 'rise', trigger: i === 0 ? 'onEnter' : 'afterPrevious', duration: 900, easing: 'easeOut' } : r === 'image' ? { effect: 'zoomIn', trigger: 'withPrevious', duration: 1100, easing: 'easeOut' } : { effect: 'fadeIn', trigger: 'afterPrevious', duration: 700 }) },
  { id: 'minimal', name: 'Minimal Elegant', description: 'Subtle fades and wipes.', assign: (r) => (r === 'decor' ? null : r === 'heading' ? { effect: 'wipe', direction: 'left', trigger: 'onEnter', duration: 700 } : { effect: 'fadeIn', trigger: 'afterPrevious', duration: 500 }) },
  { id: 'cinematic', name: 'Cinematic', description: 'Blur-ins, slow zooms, dramatic pacing.', assign: (r) => (r === 'image' ? { effect: 'zoomIn', trigger: 'onEnter', duration: 1800, easing: 'easeOut' } : r === 'heading' ? { effect: 'blurIn', trigger: 'afterPrevious', duration: 1200 } : r === 'decor' ? { effect: 'fadeIn', trigger: 'withPrevious', duration: 2000 } : { effect: 'fadeIn', trigger: 'afterPrevious', duration: 900 }) },
  { id: 'tech', name: 'Modern Technology', description: 'Snappy wipes and typewriter headings.', assign: (r) => (r === 'heading' ? { effect: 'typewriter', trigger: 'onEnter', duration: 900 } : r === 'chart' || r === 'diagram' ? { effect: 'wipe', direction: 'left', trigger: 'afterPrevious', duration: 800 } : r === 'decor' ? { effect: 'fadeIn', trigger: 'withPrevious', duration: 600 } : { effect: 'floatIn', trigger: 'afterPrevious', duration: 500 }) },
  { id: 'education', name: 'Educational', description: 'Reveal one point per click.', assign: (r, i) => (r === 'decor' ? null : r === 'heading' ? { effect: 'fadeIn', trigger: 'onEnter', duration: 500 } : { effect: 'floatIn', trigger: i <= 1 ? 'afterPrevious' : 'onClick', duration: 500 }) },
  { id: 'creative', name: 'Creative Motion', description: 'Pops, bounces and spins.', assign: (r) => (r === 'heading' ? { effect: 'bounce', trigger: 'onEnter', duration: 1000 } : r === 'image' ? { effect: 'rotateIn', trigger: 'afterPrevious', duration: 700 } : r === 'decor' ? { effect: 'pop', trigger: 'withPrevious', duration: 600 } : { effect: 'pop', trigger: 'afterPrevious', duration: 500 }) },
  { id: 'data', name: 'Data Storytelling', description: 'Headline first, then data, then insight on click.', assign: (r) => (r === 'heading' ? { effect: 'fadeIn', trigger: 'onEnter', duration: 500 } : r === 'chart' || r === 'diagram' || r === 'table' ? { effect: 'wipe', direction: 'up', trigger: 'afterPrevious', duration: 900 } : r === 'stat' ? { effect: 'zoomIn', trigger: 'afterPrevious', duration: 500 } : r === 'decor' ? null : { effect: 'fadeIn', trigger: 'onClick', duration: 500 }) },
];

export function roleOf(el: SlideElement): string {
  if (el.type === 'decorative' || (el.type === 'shape' && !el.content?.paragraphs && (el.width < 40 || el.height < 14 || el.id.startsWith('decor')))) return 'decor';
  if (el.type === 'heading') return /value$/.test(el.id) ? 'stat' : 'heading';
  if (el.type === 'image' || el.type === 'video' || el.type === 'visual3d') return 'image';
  if (el.type === 'chart') return 'chart';
  if (el.type === 'table') return 'table';
  if (['diagram', 'smartart', 'timeline', 'infographic'].includes(el.type)) return 'diagram';
  if (el.type === 'shape') return 'shape';
  return 'text';
}

/** Returns new elements with preset animations (reading order: top→bottom, left→right). Background-size shapes are skipped. */
export function applyPreset(slide: Slide, presetId: string, canvas: { width: number; height: number }): SlideElement[] {
  const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return slide.elements;
  const ordered = [...slide.elements].filter((e) => !(e.width >= canvas.width * 0.95 && e.height >= canvas.height * 0.95)).sort((a, b) => (Math.abs(a.y - b.y) < 40 ? a.x - b.x : a.y - b.y));
  const rank = new Map(ordered.map((e, i) => [e.id, i]));
  let n = 0;
  return slide.elements.map((el) => {
    if (!rank.has(el.id)) { const { animation: _a, ...rest } = el; void _a; return rest as SlideElement; }
    const a = preset.assign(roleOf(el), n);
    if (!a) { const { animation: _a, ...rest } = el; void _a; return rest as SlideElement; }
    n++;
    return { ...el, animation: [{ id: `anim-${el.id}`, effect: 'fadeIn', trigger: 'afterPrevious', duration: 500, delay: 0, order: rank.get(el.id), ...a } as Animation] };
  });
}
