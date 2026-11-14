import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { tr } from '@/i18n';
import type { Draft } from 'immer';
import type { Slide, SlideElement } from '@/types/schema';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { useEditor, translateEl } from '@/stores/editor';
import { HANDLES, intersects, isTextLike, keepsRatio, resizeBox, snapBox, unionBox, type Box, type Guide, type Handle } from './geometry';
import { serializeEditable } from './serialize';
import { ContextMenu, type MenuItem } from '@/components/ContextMenu';
import { Rulers } from './Rulers';
import { importDataTransfer, pasteFromSystemClipboard } from '@/editor/clipboardImport';

type Drag =
  | { kind: 'move'; startX: number; startY: number; ids: string[]; origin: Map<string, Box>; moved: boolean }
  | { kind: 'resize'; handle: Handle; startX: number; startY: number; ids: string[]; origin: Map<string, SlideElement>; box: Box; ratio: boolean }
  | { kind: 'rotate'; id: string; cx: number; cy: number; start: number; startAngle: number }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: boolean; base: string[] }
  | { kind: 'pan'; startX: number; startY: number; ox: number; oy: number }
  | { kind: 'endpoint'; id: string; which: 1 | 2; startX: number; startY: number; c0: { x1: number; y1: number; x2: number; y2: number } };

export function Canvas({ onOpenChartEditor, onReplaceImage }: { onOpenChartEditor?: (id: string) => void; onReplaceImage?: (id: string) => void }) {
  const doc = useEditor((s) => s.doc);
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId) ?? null);
  const selectedIds = useEditor((s) => s.selectedIds);
  const editingId = useEditor((s) => s.editingId);
  const zoom = useEditor((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const showRulers = useEditor((s) => s.showRulers);
  const gridSize = useEditor((s) => s.gridSize);
  const ed = useEditor.getState;
  const wrapRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 800, h: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<Drag | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [space, setSpace] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setView({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const W = doc?.size.width ?? 1920, H = doc?.size.height ?? 1080;
  const ruler = showRulers ? 22 : 0;
  const fit = Math.max(0.05, Math.min((view.w - ruler - 64) / W, (view.h - ruler - 64) / H));
  const scale = zoom || fit;
  useEffect(() => { if (!zoom) setPan({ x: 0, y: 0 }); }, [zoom]);
  useEffect(() => { useEditor.setState({ fitScale: fit } as never); }, [fit]);
  const ox = ruler + Math.max(16, (view.w - ruler - W * scale) / 2) + pan.x;
  const oy = ruler + Math.max(16, (view.h - ruler - H * scale) / 2) + pan.y;

  const toLogical = useCallback((clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left - ox) / scale, y: (clientY - r.top - oy) / scale };
  }, [ox, oy, scale]);

  // keyboard: space for panning
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !ed().editingId && !(e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]')) { setSpace(true); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [ed]);

  // wheel: ctrl = zoom around cursor, otherwise pan
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const cur = ed().zoom || fit;
        const next = Math.max(0.05, Math.min(4, cur * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        useEditor.setState({ zoom: next });
      } else setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fit, ed]);

  // finish text editing
  const commitEditing = useCallback(() => {
    const st = ed();
    const id = st.editingId;
    const root = editableRef.current;
    if (!id) return;
    if (root) {
      const paragraphs = serializeEditable(root);
      st.updateElements([id], (e) => { e.content = { ...e.content, paragraphs }; }, 'Edit text');
    }
    useEditor.setState({ editingId: null });
  }, [ed]);
  useEffect(() => {
    if (!editingId) return;
    const root = editableRef.current;
    if (!root) return;
    root.contentEditable = 'true';
    root.spellcheck = true;
    root.style.outline = 'none';
    root.style.cursor = 'text';
    root.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(root);
    sel?.removeAllRanges();
    sel?.addRange(range);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); commitEditing(); } e.stopPropagation(); };
    const onBlur = (e: FocusEvent) => { if ((e.relatedTarget as HTMLElement | null)?.closest?.('[data-keep-editing]')) return; commitEditing(); };
    root.addEventListener('keydown', onKey);
    root.addEventListener('blur', onBlur);
    return () => { root.removeEventListener('keydown', onKey); root.removeEventListener('blur', onBlur); root.contentEditable = 'false'; };
  }, [editingId, commitEditing]);

  const others = useMemo(() => (slide?.elements ?? []).filter((e) => !selectedIds.includes(e.id) && e.visible !== false), [slide, selectedIds]);

  const hitTest = (clientX: number, clientY: number): SlideElement | null => {
    if (!slide) return null;
    const nodes = document.elementsFromPoint(clientX, clientY);
    for (const n of nodes) {
      const host = (n as HTMLElement).closest?.('[data-el-id]') as HTMLElement | null;
      if (host && wrapRef.current?.contains(host)) {
        const el = slide.elements.find((e) => e.id === host.dataset.elId);
        if (el) return el;
      }
    }
    return null;
  };

  const onPointerDown = (e: RPE<HTMLDivElement>) => {
    if (!slide || e.button === 2) return;
    setMenu(null);
    if ((e.target as HTMLElement).closest('[data-handle],[data-ctx-menu]')) return;
    if (editingId) {
      if ((e.target as HTMLElement).closest('[contenteditable="true"]')) return;
      commitEditing();
    }
    if (space || e.button === 1) {
      setDrag({ kind: 'pan', startX: e.clientX, startY: e.clientY, ox: pan.x, oy: pan.y });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    const hit = hitTest(e.clientX, e.clientY);
    const p = toLogical(e.clientX, e.clientY);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!hit) {
      setDrag({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey, base: e.shiftKey ? selectedIds : [] });
      if (!e.shiftKey) ed().select([]);
      return;
    }
    let ids = selectedIds;
    if (e.shiftKey || e.metaKey || e.ctrlKey) { ed().select([hit.id], true); ids = ed().selectedIds; }
    else if (!selectedIds.includes(hit.id)) { ed().select([hit.id]); ids = [hit.id]; }
    const movable = ids.filter((id) => !slide.elements.find((x) => x.id === id)?.locked);
    if (!movable.length) return;
    const origin = new Map(movable.map((id) => { const el = slide.elements.find((x) => x.id === id)!; return [id, { x: el.x, y: el.y, width: el.width, height: el.height }]; }));
    ed().beginTransient();
    setDrag({ kind: 'move', startX: p.x, startY: p.y, ids: movable, origin, moved: false });
  };

  const onPointerMove = (e: RPE<HTMLDivElement>) => {
    if (!drag || !slide) return;
    const p = toLogical(e.clientX, e.clientY);
    const st = ed();
    if (drag.kind === 'pan') { setPan({ x: drag.ox + e.clientX - drag.startX, y: drag.oy + e.clientY - drag.startY }); return; }
    if (drag.kind === 'marquee') {
      const d = { ...drag, x1: p.x, y1: p.y };
      setDrag(d);
      const box = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), width: Math.abs(d.x1 - d.x0), height: Math.abs(d.y1 - d.y0) };
      const hits = slide.elements.filter((el) => el.visible !== false && intersects(box, el)).map((el) => el.id);
      useEditor.setState({ selectedIds: [...new Set([...d.base, ...hits])] });
      return;
    }
    if (drag.kind === 'move') {
      let dx = p.x - drag.startX, dy = p.y - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) * scale < 3) return;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const boxes = [...drag.origin.values()].map((b) => ({ ...b, x: b.x + dx, y: b.y + dy }));
      const u = unionBox(boxes);
      const snap = snapBox(u, others, { width: W, height: H }, 6 / scale, { grid: st.snapToGrid ? st.gridSize : undefined, objects: st.snapToObjects && !e.altKey });
      dx += snap.dx; dy += snap.dy;
      setGuides(snap.guides);
      st.transient((d) => {
        const s = d.slides.find((x) => x.id === st.currentSlideId)!;
        s.elements.forEach((el) => {
          const o = drag.origin.get(el.id);
          if (!o) return;
          translateEl(el, Math.round(o.x + dx) - el.x, Math.round(o.y + dy) - el.y);
        });
      });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag.kind === 'resize') {
      const dx = p.x - drag.startX, dy = p.y - drag.startY;
      let nb = resizeBox(drag.box, drag.handle, dx, dy, drag.ratio !== e.shiftKey);
      // snap the moving edges
      const snap = snapBox(nb, others, { width: W, height: H }, 6 / scale, { grid: st.snapToGrid ? st.gridSize : undefined, objects: st.snapToObjects && !e.altKey });
      if (drag.handle.includes('e') && snap.guides.some((g) => g.axis === 'x')) nb = { ...nb, width: nb.width + snap.dx };
      if (drag.handle.includes('s') && snap.guides.some((g) => g.axis === 'y')) nb = { ...nb, height: nb.height + snap.dy };
      setGuides(snap.guides);
      const sx = nb.width / drag.box.width, sy = nb.height / drag.box.height;
      st.transient((d) => {
        const s = d.slides.find((x) => x.id === st.currentSlideId)!;
        s.elements.forEach((el) => {
          const o = drag.origin.get(el.id);
          if (!o) return;
          el.x = Math.round(nb.x + (o.x - drag.box.x) * sx);
          el.y = Math.round(nb.y + (o.y - drag.box.y) * sy);
          el.width = Math.max(4, Math.round(o.width * sx));
          el.height = Math.max(1, Math.round(o.height * sy));
          if ((el.type === 'line' || el.type === 'arrow') && o.content) {
            const c = o.content;
            el.content.x1 = nb.x + (c.x1 - drag.box.x) * sx; el.content.x2 = nb.x + (c.x2 - drag.box.x) * sx;
            el.content.y1 = nb.y + (c.y1 - drag.box.y) * sy; el.content.y2 = nb.y + (c.y2 - drag.box.y) * sy;
          }
          if (el.type === 'group' && o.type === 'group') scaleChildren(el, o, sx, sy);
        });
      });
      return;
    }
    if (drag.kind === 'rotate') {
      const a = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI;
      let r = drag.start + (a - drag.startAngle);
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      else { const near = Math.round(r / 90) * 90; if (Math.abs(near - r) < 3) r = near; }
      r = ((r % 360) + 360) % 360;
      st.transient((d) => { const el = d.slides.find((x) => x.id === st.currentSlideId)!.elements.find((x) => x.id === drag.id); if (el) el.rotation = Math.round(r); });
      return;
    }
    if (drag.kind === 'endpoint') {
      let nx = p.x, ny = p.y;
      if (e.shiftKey) {
        const ax = drag.which === 1 ? drag.c0.x2 : drag.c0.x1, ay = drag.which === 1 ? drag.c0.y2 : drag.c0.y1;
        const ang = Math.round(Math.atan2(ny - ay, nx - ax) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(nx - ax, ny - ay);
        nx = ax + Math.cos(ang) * len; ny = ay + Math.sin(ang) * len;
      }
      st.transient((d) => {
        const el = d.slides.find((x) => x.id === st.currentSlideId)!.elements.find((x) => x.id === drag.id);
        if (!el) return;
        if (drag.which === 1) { el.content.x1 = Math.round(nx); el.content.y1 = Math.round(ny); } else { el.content.x2 = Math.round(nx); el.content.y2 = Math.round(ny); }
        el.x = Math.min(el.content.x1, el.content.x2); el.y = Math.min(el.content.y1, el.content.y2);
        el.width = Math.max(1, Math.abs(el.content.x2 - el.content.x1)); el.height = Math.max(1, Math.abs(el.content.y2 - el.content.y1));
      });
    }
  };

  const onPointerUp = () => {
    if (!drag) return;
    const st = ed();
    if (drag.kind === 'move') { if (drag.moved) st.endTransient('Move'); else st.cancelTransient(); }
    if (drag.kind === 'resize') st.endTransient('Resize');
    if (drag.kind === 'rotate') st.endTransient('Rotate');
    if (drag.kind === 'endpoint') st.endTransient('Edit line');
    setDrag(null);
    setGuides([]);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit || hit.locked) return;
    if (isTextLike(hit)) {
      if (hit.type === 'shape' && !hit.content?.paragraphs) ed().updateElements([hit.id], (el) => { el.content = { ...el.content, paragraphs: [{ runs: [{ text: '' }] }] }; }, 'Add text');
      useEditor.setState({ selectedIds: [hit.id], editingId: hit.id });
    } else if (hit.type === 'chart') onOpenChartEditor?.(hit.id);
    else if (hit.type === 'image') onReplaceImage?.(hit.id);
  };

  const startResize = (e: RPE, h: Handle) => {
    e.stopPropagation();
    if (!slide) return;
    const els = slide.elements.filter((x) => selectedIds.includes(x.id) && !x.locked);
    if (!els.length) return;
    const p = toLogical(e.clientX, e.clientY);
    ed().beginTransient();
    (wrapRef.current as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'resize', handle: h, startX: p.x, startY: p.y, ids: els.map((x) => x.id), origin: new Map(els.map((x) => [x.id, structuredClone(x)])), box: unionBox(els), ratio: els.length > 1 || els.some(keepsRatio) || (els[0].type === 'image' && !!els[0].style?.mask && els[0].style.mask !== 'none') });
  };
  const startRotate = (e: RPE, el: SlideElement) => {
    e.stopPropagation();
    const p = toLogical(e.clientX, e.clientY);
    const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
    ed().beginTransient();
    (wrapRef.current as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'rotate', id: el.id, cx, cy, start: el.rotation ?? 0, startAngle: (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI });
  };
  const startEndpoint = (e: RPE, el: SlideElement, which: 1 | 2) => {
    e.stopPropagation();
    const p = toLogical(e.clientX, e.clientY);
    ed().beginTransient();
    (wrapRef.current as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ kind: 'endpoint', id: el.id, which, startX: p.x, startY: p.y, c0: { ...el.content } });
  };

  const selected = (slide?.elements ?? []).filter((e) => selectedIds.includes(e.id));
  const single = selected.length === 1 ? selected[0] : null;
  const box = selected.length ? unionBox(selected) : null;

  const menuItems = (): MenuItem[] => {
    const st = ed();
    const has = selectedIds.length > 0;
    const locked = selected.some((x) => x.locked);
    return [
      { label: tr('Cut'), shortcut: 'Ctrl+X', disabled: !has, action: () => st.copy(true) },
      { label: tr('Copy'), shortcut: 'Ctrl+C', disabled: !has, action: () => st.copy() },
      { label: tr('Paste'), shortcut: 'Ctrl+V', action: () => { if (st.clipboard) st.paste(); else void pasteFromSystemClipboard(); } },
      { label: tr('Duplicate'), shortcut: 'Ctrl+D', disabled: !has, action: () => st.duplicateElements() },
      { label: tr('Delete'), shortcut: 'Del', disabled: !has || locked, action: () => st.deleteElements() },
      { sep: true },
      { label: tr('Group'), shortcut: 'Ctrl+G', disabled: selectedIds.length < 2, action: () => st.group() },
      { label: tr('Ungroup'), shortcut: 'Ctrl+Shift+G', disabled: !selected.some((x) => x.type === 'group'), action: () => st.ungroup() },
      { label: locked ? tr('Unlock') : tr('Lock'), disabled: !has, action: () => st.updateElements(selectedIds, (x) => { x.locked = !locked; }, locked ? 'Unlock' : 'Lock') },
      { sep: true },
      { label: tr('Bring to front'), disabled: !has, action: () => st.arrange('front') },
      { label: tr('Bring forward'), disabled: !has, action: () => st.arrange('forward') },
      { label: tr('Send backward'), disabled: !has, action: () => st.arrange('backward') },
      { label: tr('Send to back'), disabled: !has, action: () => st.arrange('back') },
      ...(single?.type === 'chart' ? [{ sep: true } as MenuItem, { label: tr('Edit chart data…'), action: () => onOpenChartEditor?.(single.id) }] : []),
      ...(single?.type === 'image' ? [{ sep: true } as MenuItem, { label: tr('Replace image…'), action: () => onReplaceImage?.(single.id) }] : []),
    ];
  };

  if (!doc || !slide) return <div ref={wrapRef} className="flex-1" />;
  const hs = 9; // handle size in screen px
  const cursor = drag?.kind === 'pan' || space ? (drag ? 'grabbing' : 'grab') : 'default';

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 overflow-hidden bg-ink-100 dark:bg-ink-950 select-none"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => { if (Array.from(e.dataTransfer.types).some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/html')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDrop={(e) => {
        const dt = e.dataTransfer;
        if (!Array.from(dt.types).some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/html' || t === 'text/plain')) return;
        e.preventDefault();
        const p = toLogical(e.clientX, e.clientY);
        const inside = p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H;
        void importDataTransfer(dt, inside ? p : null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const hit = hitTest(e.clientX, e.clientY);
        if (hit && !selectedIds.includes(hit.id)) ed().select([hit.id]);
        const r = wrapRef.current!.getBoundingClientRect();
        setMenu({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      data-testid="canvas"
    >
      {showRulers && <Rulers scale={scale} ox={ox} oy={oy} size={ruler} width={view.w} height={view.h} selection={box} />}
      <div className="absolute shadow-[0_10px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5" style={{ left: ox, top: oy }}>
        <SlideRenderer slide={slide} presentation={doc} scale={scale} mode="edit" editingId={editingId} editableRef={editableRef} slideNumber={doc.slides.indexOf(slide) + 1} />
        {showGrid && (
          <svg className="pointer-events-none absolute inset-0" width={W * scale} height={H * scale}>
            <defs><pattern id="grid" width={gridSize * scale} height={gridSize * scale} patternUnits="userSpaceOnUse"><path d={`M ${gridSize * scale} 0 L 0 0 0 ${gridSize * scale}`} fill="none" stroke="rgba(99,102,241,0.25)" strokeWidth="1" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        )}
      </div>

      {/* Overlay: selection, handles, guides, marquee */}
      <div className="pointer-events-none absolute inset-0" style={{ left: 0, top: 0 }}>
        {selected.map((el) => (
          <div key={el.id} className={`absolute ${el.locked ? 'border-amber-500' : 'border-brand-500'} border-[1.5px]`} style={{ left: ox + el.x * scale, top: oy + el.y * scale, width: el.width * scale, height: el.height * scale, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, borderStyle: el.locked ? 'dashed' : 'solid' }} />
        ))}
        {box && selected.length > 1 && <div className="absolute border border-dashed border-brand-400" style={{ left: ox + box.x * scale, top: oy + box.y * scale, width: box.width * scale, height: box.height * scale }} />}
        {box && !editingId && !selected.every((e) => e.locked) && !(single && (single.type === 'line' || single.type === 'arrow')) && !(single?.rotation) && (
          HANDLES.map((h) => {
            const x = ox + (box.x + (h.includes('w') ? 0 : h.includes('e') ? box.width : box.width / 2)) * scale;
            const y = oy + (box.y + (h.includes('n') ? 0 : h.includes('s') ? box.height : box.height / 2)) * scale;
            return (
              <div key={h} data-handle className="pointer-events-auto absolute rounded-sm border-[1.5px] border-brand-500 bg-white shadow" style={{ left: x - hs / 2, top: y - hs / 2, width: hs, height: hs, cursor: `${h}-resize` }} onPointerDown={(e) => startResize(e, h)} data-testid={`handle-${h}`} />
            );
          })
        )}
        {single && single.rotation ? (
          // rotated element: only corner handle for uniform resize
          <div data-handle className="pointer-events-auto absolute rounded-sm border-[1.5px] border-brand-500 bg-white" style={{ left: ox + (single.x + single.width) * scale - hs / 2, top: oy + (single.y + single.height) * scale - hs / 2, width: hs, height: hs, cursor: 'se-resize' }} onPointerDown={(e) => startResize(e, 'se')} />
        ) : null}
        {single && !single.locked && !editingId && single.type !== 'line' && single.type !== 'arrow' && (
          <div data-handle title={tr('Rotate (Shift = 15° steps)')} className="pointer-events-auto absolute flex items-center justify-center rounded-full border-[1.5px] border-brand-500 bg-white shadow" style={{ left: ox + (single.x + single.width / 2) * scale - 7, top: oy + single.y * scale - 30, width: 14, height: 14, cursor: 'grab' }} onPointerDown={(e) => startRotate(e, single)} data-testid="handle-rotate" />
        )}
        {single && (single.type === 'line' || single.type === 'arrow') && !single.locked && ([1, 2] as const).map((w) => (
          <div key={w} data-handle className="pointer-events-auto absolute rounded-full border-2 border-brand-500 bg-white" style={{ left: ox + single.content[`x${w}`] * scale - 6, top: oy + single.content[`y${w}`] * scale - 6, width: 12, height: 12, cursor: 'crosshair' }} onPointerDown={(e) => startEndpoint(e, single, w)} />
        ))}
        {guides.map((g, i) => (
          <div key={i} className="absolute bg-pink-500" style={g.axis === 'x' ? { left: ox + g.pos * scale, top: oy + g.from * scale, width: 1, height: (g.to - g.from) * scale } : { top: oy + g.pos * scale, left: ox + g.from * scale, height: 1, width: (g.to - g.from) * scale }} />
        ))}
        {drag?.kind === 'marquee' && (
          <div className="absolute border border-brand-500 bg-brand-500/10" style={{ left: ox + Math.min(drag.x0, drag.x1) * scale, top: oy + Math.min(drag.y0, drag.y1) * scale, width: Math.abs(drag.x1 - drag.x0) * scale, height: Math.abs(drag.y1 - drag.y0) * scale }} />
        )}
        {single && drag?.kind !== 'marquee' && (drag?.kind === 'move' || drag?.kind === 'resize' || drag?.kind === 'rotate') && (
          <div className="absolute rounded bg-ink-900 px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ left: ox + single.x * scale, top: oy + (single.y + single.height) * scale + 8 }}>
            {drag.kind === 'rotate' ? `${single.rotation ?? 0}°` : `${single.x}, ${single.y} · ${single.width}×${single.height}`}
          </div>
        )}
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </div>
  );
}

function scaleChildren(g: Draft<SlideElement>, o: SlideElement, sx: number, sy: number) {
  (g.content.children as Draft<SlideElement>[]).forEach((c, i) => {
    const oc = (o.content.children as SlideElement[])[i];
    if (!oc) return;
    c.x = oc.x * sx; c.y = oc.y * sy; c.width = oc.width * sx; c.height = oc.height * sy;
    if ((c.type === 'line' || c.type === 'arrow') && oc.content) { c.content.x1 = oc.content.x1 * sx; c.content.x2 = oc.content.x2 * sx; c.content.y1 = oc.content.y1 * sy; c.content.y2 = oc.content.y2 * sy; }
  });
}

export type { Slide };
