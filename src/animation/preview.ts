import type { Slide } from '@/types/schema';
import { buildTimeline, playItems, type TimedAnim } from './engine';

/** Plays animations directly on the editor canvas DOM (non-destructive: reset restores). */
export class CanvasPreview {
  private root: HTMLElement | null = null;
  private cancelled = false;
  private touched = new Set<HTMLElement>();
  running = false;
  paused = false;
  startedAt = 0;
  pausedAt = 0;
  offset = 0;

  private getRoot(): HTMLElement | null {
    return document.querySelector('[data-testid="canvas"] [data-slide-canvas]');
  }
  private hide(ids: Iterable<string>) {
    for (const id of ids) {
      const n = this.root?.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(id)}"]`);
      if (n) { n.style.opacity = '0'; this.touched.add(n); }
    }
  }
  async playSlide(slide: Slide, size: { width: number; height: number }, onProgress?: (ms: number) => void) {
    this.reset();
    this.root = this.getRoot();
    if (!this.root) return;
    const tl = buildTimeline(slide);
    this.cancelled = false;
    this.running = true;
    this.hide(tl.initialHidden);
    this.startedAt = performance.now();
    const tick = () => { if (!this.running) return; if (!this.paused) onProgress?.(performance.now() - this.startedAt - this.offset); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (const step of tl.steps) {
      if (this.cancelled) break;
      step.items.forEach((it) => { const n = this.root!.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(it.elId)}"]`); if (n) this.touched.add(n); });
      const h = playItems(this.root, step.items, size);
      await h.finished;
      if (this.cancelled) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    this.running = false;
  }
  async playOne(item: TimedAnim, size: { width: number; height: number }) {
    this.reset();
    this.root = this.getRoot();
    if (!this.root) return;
    const n = this.root.querySelector<HTMLElement>(`[data-el-id="${CSS.escape(item.elId)}"]`);
    if (n) this.touched.add(n);
    this.running = true;
    await playItems(this.root, [{ ...item, start: 0 }], size).finished;
    this.running = false;
    setTimeout(() => this.reset(), 600);
  }
  pause() { if (!this.root) return; this.paused = true; this.pausedAt = performance.now(); this.root.getAnimations({ subtree: true }).forEach((a) => a.pause()); }
  resume() { if (!this.root) return; this.paused = false; this.offset += performance.now() - this.pausedAt; this.root.getAnimations({ subtree: true }).forEach((a) => a.play()); }
  reset() {
    this.cancelled = true;
    this.running = false;
    this.paused = false;
    this.offset = 0;
    const root = this.root ?? this.getRoot();
    root?.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    this.touched.forEach((n) => { n.style.opacity = ''; });
    // unwrap motion layers
    root?.querySelectorAll<HTMLElement>('[data-motion-layer]').forEach((l) => { const p = l.parentElement!; while (l.firstChild) p.insertBefore(l.firstChild, l); l.remove(); });
    this.touched.clear();
  }
}
export const canvasPreview = new CanvasPreview();
