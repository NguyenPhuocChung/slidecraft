import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@/i18n';
import type { Presentation, Slide } from '@/types/schema';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { buildTimeline, playItems, settleThrough, type PlayHandle } from '@/animation/engine';
import { runTransition } from '@/transitions/engine';
import { playTransitionSound } from './sound';

export interface PlayerState { index: number; step: number; steps: number; total: number; transitioning: boolean }
export interface PlayerHandle { next: () => void; prev: () => void; goto: (index: number, step?: number) => void; state: () => PlayerState }

interface Props {
  presentation: Presentation;
  slides?: Slide[]; // defaults to non-hidden slides
  startIndex?: number;
  width: number;
  height: number;
  autoPlay?: boolean;
  paused?: boolean;
  /** play transitions/animations (false = static, used by presenter "next slide" view) */
  animate?: boolean;
  onState?: (s: PlayerState) => void;
  onEnd?: () => void;
  clickToAdvance?: boolean;
}

/** Slide player: transitions between slides + click-step animations + auto-advance. */
export const Player = forwardRef<PlayerHandle, Props>(function Player({ presentation, slides: slidesIn, startIndex = 0, width, height, autoPlay, paused, animate = true, onState, onEnd, clickToAdvance = true }, ref) {
  const slides = useMemo(() => slidesIn ?? presentation.slides.filter((s) => !s.hidden), [slidesIn, presentation.slides]);
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, slides.length - 1)));
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const curRoot = useRef<HTMLDivElement>(null);
  const prevRoot = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const curLayer = useRef<HTMLDivElement>(null);
  const prevLayer = useRef<HTMLDivElement>(null);
  const playing = useRef<PlayHandle | null>(null);
  const transitionHandle = useRef<{ finish: () => void } | null>(null);
  const settleAt = useRef<number | null>(null); // when navigating back: show final state
  const scale = Math.min(width / presentation.size.width, height / presentation.size.height);
  const slide = slides[index];
  const tl = useMemo(() => (slide ? buildTimeline(slide) : null), [slide]);
  const clickSteps = tl ? tl.steps.filter((s) => s.trigger === 'click').length : 0;
  const hasAuto = !!tl?.steps[0] && tl.steps[0].trigger === 'auto';

  const state = useCallback((): PlayerState => ({ index, step, steps: clickSteps, total: slides.length, transitioning }), [index, step, clickSteps, slides.length, transitioning]);
  useEffect(() => { onState?.(state()); }, [state, onState]);

  const size = presentation.size;
  const playStep = useCallback((k: number) => {
    // k = index into tl.steps
    if (!tl || !curRoot.current || !tl.steps[k]) return;
    playing.current?.finish();
    playing.current = playItems(curRoot.current, tl.steps[k].items, size);
  }, [tl, size]);

  // After a slide becomes current: run transition, then the auto step.
  useLayoutEffect(() => {
    if (!slide || !curRoot.current) return;
    const root = curRoot.current;
    if (settleAt.current !== null && tl) {
      settleThrough(root, tl, tl.steps.length, size);
      setPrevIndex(null);
      settleAt.current = null;
      return;
    }
    if (tl && animate) settleThrough(root, tl, 0, size);
    const t = prevIndex !== null && animate ? slide.transition : undefined;
    let cancelled = false;
    const startAuto = () => { if (!cancelled && hasAuto && animate) playStep(0); };
    if (t && t.type !== 'none' && curLayer.current && container.current) {
      setTransitioning(true);
      playTransitionSound(t.sound);
      const h = runTransition(t, { container: container.current, outLayer: prevLayer.current, inLayer: curLayer.current }, { prevSlide: prevIndex !== null ? slides[prevIndex] : undefined, nextSlide: slide });
      transitionHandle.current = h;
      void h.finished.then(() => { if (cancelled) return; setTransitioning(false); setPrevIndex(null); transitionHandle.current = null; startAuto(); });
    } else {
      setPrevIndex(null);
      startAuto();
    }
    return () => { cancelled = true; };
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((i: number, opts: { settle?: boolean } = {}) => {
    if (i < 0 || i >= slides.length) { if (i >= slides.length) onEnd?.(); return; }
    transitionHandle.current?.finish();
    playing.current?.finish();
    if (opts.settle) settleAt.current = i;
    setPrevIndex(i === index ? null : index);
    setStep(0);
    setIndex(i);
  }, [slides.length, index, onEnd]);

  const next = useCallback(() => {
    if (transitioning) { transitionHandle.current?.finish(); return; }
    if (tl && step < clickSteps) {
      const k = tl.steps.findIndex((s, i) => s.trigger === 'click' && tl.steps.slice(0, i + 1).filter((x) => x.trigger === 'click').length === step + 1);
      playStep(k);
      setStep(step + 1);
      return;
    }
    if (tl?.exitItems.length && curRoot.current && animate) {
      const h = playItems(curRoot.current, tl.exitItems, size);
      void h.finished.then(() => go(index + 1));
      return;
    }
    go(index + 1);
  }, [transitioning, tl, step, clickSteps, playStep, go, index, size, animate]);
  const prev = useCallback(() => {
    if (step > 0 && tl && curRoot.current) {
      // undo last click step: settle to previous state
      const clickIdx = tl.steps.map((s, i) => (s.trigger === 'click' ? i : -1)).filter((i) => i >= 0);
      const target = step - 1 === 0 ? (hasAuto ? 1 : 0) : clickIdx[step - 2] + 1;
      settleThrough(curRoot.current, tl, target, size);
      setStep(step - 1);
      return;
    }
    go(index - 1, { settle: true });
  }, [step, tl, go, index, size, hasAuto]);
  const gotoFn = useCallback((i: number, s = 0) => {
    if (i === index && s === step) return;
    if (i === index && tl && curRoot.current) {
      const clickIdx = tl.steps.map((st, k) => (st.trigger === 'click' ? k : -1)).filter((k) => k >= 0);
      if (s > step) { for (let k = step; k < s; k++) playStep(clickIdx[k]); }
      else settleThrough(curRoot.current, tl, s === 0 ? (hasAuto ? 1 : 0) : clickIdx[s - 1] + 1, size);
      setStep(s);
      return;
    }
    go(i, { settle: s > 0 });
    if (s > 0) setStep(Math.min(s, buildTimeline(slides[i]).steps.filter((x) => x.trigger === 'click').length));
  }, [index, step, tl, go, playStep, size, hasAuto, slides]);
  useImperativeHandle(ref, () => ({ next, prev, goto: gotoFn, state }), [next, prev, gotoFn, state]);

  // Auto-advance (per-slide duration, transition.autoAdvance, or Auto Play)
  useEffect(() => {
    if (!slide || paused || transitioning) return;
    const explicit = slide.duration ?? slide.transition?.autoAdvance;
    if (!autoPlay && !explicit) return;
    const wait = step < clickSteps ? 1400 : explicit ?? 5000;
    const t = setTimeout(() => next(), wait + (step === 0 && tl ? (tl.steps[0]?.trigger === 'auto' ? tl.steps[0].duration : 0) : 0));
    return () => clearTimeout(t);
  }, [slide, step, autoPlay, paused, transitioning, next, clickSteps, tl]);

  if (!slide) return <div style={{ width, height }} className="flex items-center justify-center text-white/60">{tr('No visible slides')}</div>;
  const W = presentation.size.width * scale, H = presentation.size.height * scale;
  return (
    <div style={{ width, height }} className="relative flex items-center justify-center overflow-hidden" onClick={clickToAdvance ? (e) => { if (!(e.target as HTMLElement).closest('a,video,audio,iframe,button')) next(); } : undefined} data-present>
      <div ref={container} style={{ width: W, height: H, position: 'relative' }}>
        {prevIndex !== null && slides[prevIndex] && (
          <div ref={prevLayer} style={{ position: 'absolute', inset: 0 }} key={`p-${slides[prevIndex].id}-${prevIndex}`}>
            <SlideRenderer slide={slides[prevIndex]} presentation={presentation} scale={scale} mode="present" rootRef={prevRoot} slideNumber={prevIndex + 1} />
          </div>
        )}
        <div ref={curLayer} style={{ position: 'absolute', inset: 0 }} key={`c-${slide.id}-${index}`}>
          <SlideRenderer slide={slide} presentation={presentation} scale={scale} mode="present" rootRef={curRoot} slideNumber={index + 1} hiddenIds={animate && settleAt.current === null ? tl?.initialHidden : undefined} />
        </div>
      </div>
    </div>
  );
});
