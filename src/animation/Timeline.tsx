import { useEffect, useRef, useState } from 'react';
import { tr } from '@/i18n';
import { GripVertical, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { paragraphsToPlain } from '@/utils/richtext';
import { ANIMATION_EFFECTS } from '@/types/registry';
import { IconButton, cx } from '@/components/ui';
import { buildTimeline, orderedAnimations } from './engine';
import { canvasPreview } from './preview';
import { TRIGGER_LABEL } from './labels';

const CAT_COLOR: Record<string, string> = { entrance: 'bg-emerald-500', emphasis: 'bg-amber-500', exit: 'bg-rose-500', motion: 'bg-sky-500' };

/** Professional animation timeline: drag bars to change delay, drag the right edge to change duration, drag rows to reorder. */
export function AnimationTimeline() {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const selectedIds = useEditor((s) => s.selectedIds);
  const st = useEditor.getState;
  const [pxPerMs, setPxPerMs] = useState(0.12);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const drag = useRef<{ kind: 'move' | 'resize'; elId: string; idx: number; x0: number; v0: number } | null>(null);
  const [dragRow, setDragRow] = useState<number | null>(null);
  useEffect(() => () => canvasPreview.reset(), []);
  if (!slide) return null;
  const tl = buildTimeline(slide);
  const rows = tl.steps.flatMap((step, si) => step.items.map((it) => ({ ...it, step: si, trigger: step.trigger })));
  const offsets: number[] = [];
  let acc = 0;
  tl.steps.forEach((s) => { offsets.push(acc); acc += s.duration + 300; });
  const total = Math.max(3000, acc);
  const ordered = orderedAnimations(slide);

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dv = Math.round(((e.clientX - d.x0) / pxPerMs) / 50) * 50;
    st().transient((doc) => {
      const el = doc.slides.find((s) => s.id === slide.id)!.elements.find((x) => x.id === d.elId)!;
      const a = el.animation![d.idx];
      if (d.kind === 'move') a.delay = Math.max(0, d.v0 + dv);
      else a.duration = Math.max(50, d.v0 + dv);
    });
  };
  const onUp = () => { if (drag.current) { st().endTransient(drag.current.kind === 'move' ? 'Animation delay' : 'Animation duration'); drag.current = null; } };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const list = [...ordered];
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    st().commit('Reorder animations', (d) => {
      const s = d.slides.find((x) => x.id === slide.id)!;
      list.forEach((o, i) => { const el = s.elements.find((e) => e.id === o.el.id)!; el.animation![o.idx].order = i; });
    });
  };
  const play = async () => {
    if (paused) { canvasPreview.resume(); setPaused(false); return; }
    setPlaying(true);
    await canvasPreview.playSlide(slide, doc.size, (ms) => setPlayhead(ms));
    setPlaying(false);
  };
  const label = (elId: string) => {
    const e = slide.elements.find((x) => x.id === elId);
    if (!e) return elId;
    return e.name ?? (e.content?.paragraphs ? paragraphsToPlain(e.content.paragraphs).slice(0, 26) : `${e.type} ${e.content?.kind ?? e.content?.chartType ?? ''}`);
  };
  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900" data-testid="anim-timeline" onPointerMove={onMove} onPointerUp={onUp}>
      <div className="flex items-center gap-1 border-b border-ink-100 px-3 py-1 dark:border-ink-800">
        <span className="mr-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr('Animation timeline')}</span>
        <IconButton title={playing && !paused ? tr('Pause') : tr('Play')} onClick={() => { if (playing && !paused) { canvasPreview.pause(); setPaused(true); } else void play(); }} data-testid="tl-play">{playing && !paused ? <Pause size={14} /> : <Play size={14} />}</IconButton>
        <IconButton title={tr('Reset')} onClick={() => { canvasPreview.reset(); setPlaying(false); setPaused(false); setPlayhead(null); }}><RotateCcw size={14} /></IconButton>
        <span className="ml-2 text-[11px] tabular-nums text-ink-400">{tr('{n} animations · {s}s · {c} clicks', { n: rows.length, s: (tl.total / 1000).toFixed(1), c: tl.steps.filter((s) => s.trigger === 'click').length })}</span>
        <div className="flex-1" />
        <input type="range" min={0.03} max={0.4} step={0.01} value={pxPerMs} onChange={(e) => setPxPerMs(Number(e.target.value))} title={tr('Zoom timeline')} />
        <IconButton title={tr('Close')} onClick={() => { canvasPreview.reset(); st().set({ timelineOpen: false }); }}><X size={14} /></IconButton>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto">
        {!rows.length && <p className="p-4 text-xs text-ink-400">{tr('No animations on this slide. Select an element and add one in the Animate panel, or apply a preset.')}</p>}
        <div className="relative" style={{ width: 220 + total * pxPerMs + 80 }}>
          {/* ruler */}
          <div className="sticky top-0 z-10 ml-[220px] flex h-5 border-b border-ink-100 bg-white text-[9px] text-ink-400 dark:border-ink-800 dark:bg-ink-900">
            {Array.from({ length: Math.ceil(total / 500) + 1 }, (_, i) => <span key={i} className="absolute border-l border-ink-200 pl-0.5 dark:border-ink-700" style={{ left: i * 500 * pxPerMs }}>{(i * 0.5).toFixed(1)}s</span>)}
          </div>
          {tl.steps.map((s, si) => <div key={si} className="absolute bottom-0 top-5 border-l border-dashed border-brand-300" style={{ left: 220 + offsets[si] * pxPerMs }}><span className="ml-1 text-[9px] font-semibold text-brand-500">{s.trigger === 'click' ? `${tr('Click')} ${tl.steps.slice(0, si + 1).filter((x) => x.trigger === 'click').length}` : tr('On enter')}</span></div>)}
          {rows.map((r) => {
            const oi = ordered.findIndex((o) => o.el.id === r.elId && o.anim === r.anim);
            const idx = slide.elements.find((e) => e.id === r.elId)!.animation!.indexOf(r.anim);
            const left = 220 + (offsets[r.step] + r.start) * pxPerMs;
            const width = Math.max(8, (r.end - r.start) * pxPerMs);
            return (
              <div key={`${r.elId}-${idx}`} className={cx('relative flex h-7 items-center border-b border-ink-50 dark:border-ink-850', selectedIds.includes(r.elId) && 'bg-brand-50/60 dark:bg-brand-500/10', dragRow === oi && 'opacity-50')}
                draggable onDragStart={() => setDragRow(oi)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragRow !== null) reorder(dragRow, oi); setDragRow(null); }}>
                <div className="sticky left-0 z-[5] flex h-full w-[220px] items-center gap-1 bg-white pl-1 pr-2 text-[11px] dark:bg-ink-900" onClick={() => st().select([r.elId])}>
                  <GripVertical size={12} className="cursor-grab text-ink-300" />
                  <span className="w-4 text-ink-400">{oi + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{label(r.elId)}</span>
                  <span className="text-[10px] text-ink-400">{tr((ANIMATION_EFFECTS as Record<string, { label: string }>)[r.anim.effect]?.label ?? '')}</span>
                </div>
                <div className={cx('absolute flex h-4 cursor-grab items-center rounded px-1 text-[9px] font-medium text-white shadow-sm', CAT_COLOR[r.category])} style={{ left, width }} title={tr('{start} · wait {delay}s · lasts {dur}s', { start: tr(TRIGGER_LABEL[r.anim.trigger ?? 'onClick'] ?? ''), delay: ((r.anim.delay ?? 0) / 1000).toFixed(1), dur: ((r.anim.duration ?? 600) / 1000).toFixed(1) })}
                  onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); st().beginTransient(); drag.current = { kind: 'move', elId: r.elId, idx, x0: e.clientX, v0: r.anim.delay ?? 0 }; }}>
                  <span className="truncate"><span title={tr(TRIGGER_LABEL[r.anim.trigger ?? 'onClick'] ?? '')}>{tr(TRIGGER_LABEL[r.anim.trigger ?? 'onClick'] ?? '')}</span></span>
                  <span className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r bg-black/20" onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); st().beginTransient(); drag.current = { kind: 'resize', elId: r.elId, idx, x0: e.clientX, v0: r.anim.duration ?? 600 }; }} />
                </div>
              </div>
            );
          })}
          {playhead !== null && <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-red-500" style={{ left: 220 + playhead * pxPerMs }} />}
        </div>
      </div>
    </div>
  );
}
