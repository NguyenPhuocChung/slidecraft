import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { produce, type Draft } from 'immer';
import type { Animation, Presentation, Slide, SlideElement, Theme, Transition } from '@/types/schema';
import { buildLayout } from '@/layouts/engine';
import { extractContent } from '@/layouts/extract';
import { getTheme } from '@/themes/themes';
import { normalizeElement } from '@/code-parser/normalize';
import { uid } from '@/utils/id';
import { debounce, deepClone } from '@/utils/misc';
import { cloud, storage, type ProjectMeta } from '@/services/storage';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'offline';
interface HistoryItem { doc: Presentation; label: string; slideId: string | null }

export interface EditorState {
  doc: Presentation | null;
  meta: ProjectMeta | null;
  saveStatus: SaveStatus;
  saveError?: string;
  lastSavedAt?: number;
  past: HistoryItem[];
  future: HistoryItem[];
  transientBase: Presentation | null;
  currentSlideId: string | null;
  selectedSlideIds: string[];
  selectedIds: string[];
  editingId: string | null;
  clipboard: { elements: SlideElement[]; slides?: Slide[] } | null;
  zoom: number; // 0 = fit
  showGrid: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  showRulers: boolean;
  gridSize: number;
  leftTab: string;
  rightTab: string;
  timelineOpen: boolean;

  load: (doc: Presentation, meta?: ProjectMeta | null) => void;
  close: () => void;
  commit: (label: string, recipe: (d: Draft<Presentation>) => void, opts?: { keepSelection?: boolean }) => void;
  beginTransient: () => void;
  transient: (recipe: (d: Draft<Presentation>) => void) => void;
  endTransient: (label: string) => void;
  cancelTransient: () => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<EditorState>) => void;
  // slides
  currentSlide: () => Slide | null;
  selectSlide: (id: string, mode?: 'single' | 'toggle' | 'range') => void;
  addSlide: (afterId?: string | null, slide?: Partial<Slide>) => string;
  deleteSlides: (ids: string[]) => void;
  duplicateSlides: (ids: string[]) => void;
  moveSlides: (ids: string[], toIndex: number) => void;
  updateSlide: (id: string, patch: Partial<Slide>, label?: string) => void;
  applyLayout: (slideId: string, layoutId: string) => void;
  applyTransition: (t: Transition | undefined, scope: 'current' | 'selected' | 'all') => void;
  setTheme: (themeId: string, scope?: 'all' | 'selected') => void;
  setThemeOverrides: (o: Partial<Theme> | undefined) => void;
  // elements
  select: (ids: string[], additive?: boolean) => void;
  addElement: (el: Partial<SlideElement> & Pick<SlideElement, 'type'>, select?: boolean) => string;
  updateElements: (ids: string[], recipe: (el: Draft<SlideElement>) => void, label?: string) => void;
  deleteElements: (ids?: string[]) => void;
  duplicateElements: (ids?: string[]) => void;
  copy: (cut?: boolean) => void;
  paste: () => void;
  group: () => void;
  ungroup: () => void;
  arrange: (op: 'forward' | 'backward' | 'front' | 'back') => void;
  align: (op: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distribute: (axis: 'h' | 'v') => void;
  setAnimations: (elId: string, anims: Animation[] | undefined, label?: string) => void;
  // persistence
  save: (opts?: { snapshot?: boolean; label?: string }) => Promise<void>;
}

const HISTORY_LIMIT = 120;

function findSlide(d: Presentation | Draft<Presentation>, id: string | null) {
  return d.slides.find((s) => s.id === id) ?? null;
}
function bbox(els: SlideElement[]) {
  const x0 = Math.min(...els.map((e) => e.x)), y0 = Math.min(...els.map((e) => e.y));
  const x1 = Math.max(...els.map((e) => e.x + e.width)), y1 = Math.max(...els.map((e) => e.y + e.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
/** Move element (incl. line endpoints) by dx/dy. */
export function translateEl(el: Draft<SlideElement> | SlideElement, dx: number, dy: number) {
  el.x += dx; el.y += dy;
  if ((el.type === 'line' || el.type === 'arrow') && el.content) { el.content.x1 += dx; el.content.x2 += dx; el.content.y1 += dy; el.content.y2 += dy; }
}
function freshIds(el: SlideElement): SlideElement {
  const c = deepClone(el);
  c.id = uid(el.type);
  if (c.animation) c.animation = c.animation.map((a) => ({ ...a, id: uid('anim') }));
  if (c.type === 'group') c.content.children = (c.content.children as SlideElement[]).map(freshIds);
  return c;
}

let autosave: ReturnType<typeof debounce<[]>> | null = null;
let lastSnapshotAt = 0;
const SNAPSHOT_EVERY = 5 * 60 * 1000;

export const useEditor = create<EditorState>((set, get) => ({
  doc: null, meta: null, saveStatus: 'saved', past: [], future: [], transientBase: null,
  currentSlideId: null, selectedSlideIds: [], selectedIds: [], editingId: null, clipboard: null,
  zoom: 0, showGrid: false, snapToGrid: false, snapToObjects: true, showRulers: true, gridSize: 40,
  leftTab: 'slides', rightTab: 'design', timelineOpen: false,

  load: (doc, meta = null) => {
    lastSnapshotAt = Date.now();
    set({ doc, meta, past: [], future: [], currentSlideId: doc.slides[0]?.id ?? null, selectedSlideIds: doc.slides[0] ? [doc.slides[0].id] : [], selectedIds: [], editingId: null, saveStatus: 'saved', transientBase: null });
    // first open of a project that was never synced (new import, desktop app, newly signed in): push it to the server once
    if (!meta?.cloudId) void cloud.enabled().then((ok) => { if (ok && get().doc === doc) void get().save(); });
  },
  close: () => { autosave?.flush(); set({ doc: null, meta: null, past: [], future: [] }); },
  set: (p) => set(p),

  commit: (label, recipe, opts) => {
    const { doc, past, currentSlideId } = get();
    if (!doc) return;
    const next = produce(doc, recipe);
    if (next === doc) return;
    set({ doc: next, past: [...past, { doc, label, slideId: currentSlideId }].slice(-HISTORY_LIMIT), future: [], saveStatus: 'unsaved', ...(opts?.keepSelection === false ? { selectedIds: [] } : {}) });
    scheduleSave();
  },
  beginTransient: () => { const { doc } = get(); if (doc) set({ transientBase: doc }); },
  transient: (recipe) => { const { doc } = get(); if (doc) set({ doc: produce(doc, recipe) }); },
  endTransient: (label) => {
    const { transientBase, doc, past, currentSlideId } = get();
    if (!transientBase || !doc) return;
    if (transientBase !== doc) {
      set({ past: [...past, { doc: transientBase, label, slideId: currentSlideId }].slice(-HISTORY_LIMIT), future: [], saveStatus: 'unsaved' });
      scheduleSave();
    }
    set({ transientBase: null });
  },
  cancelTransient: () => { const { transientBase } = get(); if (transientBase) set({ doc: transientBase, transientBase: null }); },
  undo: () => {
    const { past, future, doc, currentSlideId } = get();
    const prev = past[past.length - 1];
    if (!prev || !doc) return;
    const slideStill = prev.doc.slides.some((s) => s.id === (prev.slideId ?? currentSlideId));
    set({ doc: prev.doc, past: past.slice(0, -1), future: [{ doc, label: prev.label, slideId: currentSlideId }, ...future], currentSlideId: slideStill ? prev.slideId ?? currentSlideId : prev.doc.slides[0]?.id ?? null, selectedIds: [], editingId: null, saveStatus: 'unsaved' });
    scheduleSave();
  },
  redo: () => {
    const { past, future, doc, currentSlideId } = get();
    const next = future[0];
    if (!next || !doc) return;
    set({ doc: next.doc, future: future.slice(1), past: [...past, { doc, label: next.label, slideId: currentSlideId }], selectedIds: [], editingId: null, saveStatus: 'unsaved', currentSlideId: next.doc.slides.some((s) => s.id === currentSlideId) ? currentSlideId : next.doc.slides[0]?.id ?? null });
    scheduleSave();
  },

  currentSlide: () => { const { doc, currentSlideId } = get(); return doc ? findSlide(doc, currentSlideId) : null; },
  selectSlide: (id, mode = 'single') => {
    const { doc, selectedSlideIds, currentSlideId } = get();
    if (!doc) return;
    if (mode === 'toggle') {
      const has = selectedSlideIds.includes(id);
      const next = has ? selectedSlideIds.filter((s) => s !== id) : [...selectedSlideIds, id];
      set({ selectedSlideIds: next.length ? next : [id], currentSlideId: id, selectedIds: [], editingId: null });
    } else if (mode === 'range' && currentSlideId) {
      const a = doc.slides.findIndex((s) => s.id === currentSlideId), b = doc.slides.findIndex((s) => s.id === id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      set({ selectedSlideIds: doc.slides.slice(lo, hi + 1).map((s) => s.id), selectedIds: [], editingId: null });
    } else set({ currentSlideId: id, selectedSlideIds: [id], selectedIds: [], editingId: null });
  },
  addSlide: (afterId, partial) => {
    const { doc, currentSlideId } = get();
    if (!doc) return '';
    const id = uid('slide');
    const theme = getTheme(doc.theme, doc.themeOverrides);
    let slide: Slide;
    if (partial?.layout && partial.content) {
      const res = buildLayout(partial.layout, partial.content, theme, doc.size);
      slide = { id, ...partial, layout: res.layout, elements: res.elements.map((e) => normalizeElement(e)), background: partial.background ?? res.background } as Slide;
    } else slide = { id, title: 'New slide', elements: [], ...partial } as Slide;
    if (!partial?.elements && !partial?.layout) {
      const res = buildLayout('singleColumn', { heading: 'New slide', body: 'Double-click to edit this text.' }, theme, doc.size);
      slide.layout = 'singleColumn';
      slide.content = { heading: 'New slide', body: 'Double-click to edit this text.' };
      slide.elements = res.elements.map((e) => normalizeElement(e));
    }
    const ref = afterId === undefined ? currentSlideId : afterId;
    get().commit('Add slide', (d) => {
      const idx = ref ? d.slides.findIndex((s) => s.id === ref) : d.slides.length - 1;
      d.slides.splice(idx + 1, 0, slide as Draft<Slide>);
    });
    set({ currentSlideId: id, selectedSlideIds: [id], selectedIds: [] });
    return id;
  },
  deleteSlides: (ids) => {
    const { doc } = get();
    if (!doc) return;
    if (ids.length >= doc.slides.length) return; // keep at least one slide
    const firstIdx = doc.slides.findIndex((s) => ids.includes(s.id));
    get().commit(ids.length > 1 ? `Delete ${ids.length} slides` : 'Delete slide', (d) => { d.slides = d.slides.filter((s) => !ids.includes(s.id)); });
    const after = get().doc!;
    const next = after.slides[Math.min(firstIdx, after.slides.length - 1)];
    set({ currentSlideId: next?.id ?? null, selectedSlideIds: next ? [next.id] : [], selectedIds: [] });
  },
  duplicateSlides: (ids) => {
    const { doc } = get();
    if (!doc) return;
    const newIds: string[] = [];
    get().commit('Duplicate slide', (d) => {
      const order = d.slides.map((s) => s.id).filter((id) => ids.includes(id));
      let lastIdx = d.slides.findIndex((s) => s.id === order[order.length - 1]);
      order.forEach((id) => {
        const src = doc.slides.find((s) => s.id === id)!; // clone from the committed doc (drafts are Proxies)
        // keep element ids so Morph can match objects between the original and the copy (like PowerPoint)
        const copy = { ...deepClone(src), id: uid('slide') };
        newIds.push(copy.id);
        d.slides.splice(++lastIdx, 0, copy as Draft<Slide>);
      });
    });
    set({ currentSlideId: newIds[0] ?? get().currentSlideId, selectedSlideIds: newIds, selectedIds: [] });
  },
  moveSlides: (ids, toIndex) => {
    get().commit('Move slides', (d) => {
      const moving = d.slides.filter((s) => ids.includes(s.id));
      const before = d.slides.slice(0, toIndex).filter((s) => !ids.includes(s.id)).length;
      const rest = d.slides.filter((s) => !ids.includes(s.id));
      rest.splice(before, 0, ...moving);
      d.slides = rest;
    });
  },
  updateSlide: (id, patch, label = 'Edit slide') => {
    get().commit(label, (d) => { const s = findSlide(d, id); if (s) Object.assign(s, patch); });
  },
  applyLayout: (slideId, layoutId) => {
    const { doc } = get();
    if (!doc) return;
    const slide = findSlide(doc, slideId);
    if (!slide) return;
    const content = extractContent(slide);
    const theme = getTheme(slide.theme ?? doc.theme, slide.theme ? undefined : doc.themeOverrides);
    const res = buildLayout(layoutId, content, theme, doc.size);
    // keep user-added elements that carry no slot data (e.g. decorative shapes) and their animations
    const animById = new Map(slide.elements.filter((e) => e.animation?.length).map((e) => [e.id, e.animation]));
    get().commit(`Layout: ${layoutId}`, (d) => {
      const s = findSlide(d, slideId)!;
      s.layout = res.layout;
      s.content = content as Draft<typeof content>;
      s.elements = res.elements.map((e) => ({ ...normalizeElement(e), ...(animById.get(e.id) ? { animation: animById.get(e.id) } : {}) })) as Draft<SlideElement>[];
      if (res.background) s.background = res.background as Draft<typeof res.background>;
    });
    set({ selectedIds: [] });
  },
  applyTransition: (t, scope) => {
    const { selectedSlideIds, currentSlideId } = get();
    get().commit('Transition', (d) => {
      d.slides.forEach((s) => {
        const hit = scope === 'all' || (scope === 'selected' ? selectedSlideIds.includes(s.id) : s.id === currentSlideId);
        if (!hit) return;
        if (!t || t.type === 'none') delete s.transition;
        else s.transition = { ...t } as Draft<Transition>;
      });
    });
  },
  setTheme: (themeId, scope = 'all') => {
    const { selectedSlideIds } = get();
    get().commit('Change theme', (d) => {
      if (scope === 'all') { d.theme = themeId; d.slides.forEach((s) => { delete s.theme; }); }
      else d.slides.forEach((s) => { if (selectedSlideIds.includes(s.id)) s.theme = themeId; });
    });
  },
  setThemeOverrides: (o) => get().commit('Customize theme', (d) => { if (o) d.themeOverrides = o as Draft<Partial<Theme>>; else delete d.themeOverrides; }),

  select: (ids, additive) => {
    const { selectedIds } = get();
    if (!additive) return set({ selectedIds: ids, editingId: null });
    const s = new Set(selectedIds);
    ids.forEach((id) => (s.has(id) ? s.delete(id) : s.add(id)));
    set({ selectedIds: [...s], editingId: null });
  },
  addElement: (partial, select = true) => {
    const { currentSlideId } = get();
    const slide = get().currentSlide();
    if (!slide) return '';
    const el = normalizeElement({ id: uid(partial.type), x: 160, y: 160, width: 600, height: 200, ...partial });
    el.zIndex = Math.max(0, ...slide.elements.map((e) => e.zIndex ?? 0)) + 1;
    get().commit(`Add ${partial.type}`, (d) => { findSlide(d, currentSlideId)?.elements.push(el as Draft<SlideElement>); });
    if (select) set({ selectedIds: [el.id] });
    return el.id;
  },
  updateElements: (ids, recipe, label = 'Edit') => {
    const { currentSlideId } = get();
    get().commit(label, (d) => { findSlide(d, currentSlideId)?.elements.forEach((e) => { if (ids.includes(e.id)) recipe(e); }); });
  },
  deleteElements: (ids) => {
    const { selectedIds, currentSlideId } = get();
    const del = ids ?? selectedIds;
    if (!del.length) return;
    const slide = get().currentSlide();
    const deletable = del.filter((id) => !slide?.elements.find((e) => e.id === id)?.locked);
    if (!deletable.length) return;
    get().commit('Delete', (d) => { const s = findSlide(d, currentSlideId); if (s) s.elements = s.elements.filter((e) => !deletable.includes(e.id)); });
    set({ selectedIds: [], editingId: null });
  },
  duplicateElements: (ids) => {
    const slide = get().currentSlide();
    const src = (ids ?? get().selectedIds).map((id) => slide?.elements.find((e) => e.id === id)).filter(Boolean) as SlideElement[];
    if (!src.length) return;
    const maxZ = Math.max(0, ...(slide?.elements ?? []).map((e) => e.zIndex ?? 0));
    const copies = src.map((e, i) => { const c = freshIds(e); translateEl(c, 32, 32); c.zIndex = maxZ + i + 1; c.locked = false; return c; });
    get().commit('Duplicate', (d) => { findSlide(d, get().currentSlideId)?.elements.push(...(copies as Draft<SlideElement>[])); });
    set({ selectedIds: copies.map((c) => c.id) });
  },
  copy: (cut) => {
    const slide = get().currentSlide();
    const { selectedIds, selectedSlideIds, doc } = get();
    if (selectedIds.length && slide) {
      const elements = selectedIds.map((id) => slide.elements.find((e) => e.id === id)).filter(Boolean) as SlideElement[];
      set({ clipboard: { elements: deepClone(elements) } });
      try { void navigator.clipboard?.writeText(JSON.stringify({ slidecraft: 'elements', elements })); } catch { /* clipboard denied */ }
      if (cut) get().deleteElements();
    } else if (doc) {
      const slides = doc.slides.filter((s) => selectedSlideIds.includes(s.id));
      set({ clipboard: { elements: [], slides: deepClone(slides) } });
      try { void navigator.clipboard?.writeText(JSON.stringify({ slidecraft: 'slides', count: slides.length })); } catch { /* clipboard denied */ }
      if (cut) get().deleteSlides(selectedSlideIds);
    }
  },
  paste: () => {
    const { clipboard, currentSlideId } = get();
    if (!clipboard) return;
    if (clipboard.elements.length) {
      const slide = get().currentSlide();
      const maxZ = Math.max(0, ...(slide?.elements ?? []).map((e) => e.zIndex ?? 0));
      const copies = clipboard.elements.map((e, i) => { const c = freshIds(e); const same = slide?.elements.some((x) => x.x === c.x && x.y === c.y); if (same) translateEl(c, 32, 32); c.zIndex = maxZ + i + 1; return c; });
      get().commit('Paste', (d) => { findSlide(d, currentSlideId)?.elements.push(...(copies as Draft<SlideElement>[])); });
      set({ selectedIds: copies.map((c) => c.id), clipboard: { elements: copies } });
    } else if (clipboard.slides?.length) {
      const copies = clipboard.slides.map((s) => ({ ...deepClone(s), id: uid('slide') }));
      get().commit('Paste slides', (d) => {
        const idx = d.slides.findIndex((s) => s.id === currentSlideId);
        d.slides.splice(idx + 1, 0, ...(copies as Draft<Slide>[]));
      });
      set({ currentSlideId: copies[0].id, selectedSlideIds: copies.map((c) => c.id) });
    }
  },
  group: () => {
    const slide = get().currentSlide();
    const { selectedIds, currentSlideId } = get();
    if (!slide || selectedIds.length < 2) return;
    const els = slide.elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
    if (els.length < 2) return;
    const b = bbox(els);
    const children = els.sort((a, z) => (a.zIndex ?? 0) - (z.zIndex ?? 0)).map((e) => { const c = deepClone(e); translateEl(c, -b.x, -b.y); return c; });
    const group: SlideElement = { id: uid('group'), type: 'group', ...b, zIndex: Math.max(...els.map((e) => e.zIndex ?? 0)), content: { children } };
    get().commit('Group', (d) => {
      const s = findSlide(d, currentSlideId)!;
      s.elements = s.elements.filter((e) => !selectedIds.includes(e.id));
      s.elements.push(group as Draft<SlideElement>);
    });
    set({ selectedIds: [group.id] });
  },
  ungroup: () => {
    const slide = get().currentSlide();
    const { selectedIds, currentSlideId } = get();
    const groups = slide?.elements.filter((e) => selectedIds.includes(e.id) && e.type === 'group') ?? [];
    if (!groups.length) return;
    const released: string[] = [];
    get().commit('Ungroup', (d) => {
      const s = findSlide(d, currentSlideId)!;
      groups.forEach((g) => {
        const kids = (g.content.children as SlideElement[]).map((c, i) => {
          const k = deepClone(c);
          translateEl(k, g.x, g.y);
          k.zIndex = (g.zIndex ?? 0) + i * 0.01;
          released.push(k.id);
          return k;
        });
        s.elements = s.elements.filter((e) => e.id !== g.id);
        s.elements.push(...(kids as Draft<SlideElement>[]));
      });
      const sorted = [...s.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      sorted.forEach((e, i) => { e.zIndex = i + 1; });
    });
    set({ selectedIds: released });
  },
  arrange: (op) => {
    const { selectedIds, currentSlideId } = get();
    if (!selectedIds.length) return;
    get().commit('Arrange', (d) => {
      const s = findSlide(d, currentSlideId)!;
      const sorted = [...s.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
      const sel = sorted.filter((e) => selectedIds.includes(e.id));
      let order = sorted.filter((e) => !selectedIds.includes(e.id));
      if (op === 'front') order = [...order, ...sel];
      else if (op === 'back') order = [...sel, ...order];
      else {
        const arr = [...sorted];
        const idxs = arr.map((e, i) => (selectedIds.includes(e.id) ? i : -1)).filter((i) => i >= 0);
        if (op === 'forward') for (let k = idxs.length - 1; k >= 0; k--) { const i = idxs[k]; if (i < arr.length - 1 && !selectedIds.includes(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; }
        else for (const i of idxs) { if (i > 0 && !selectedIds.includes(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]; }
        order = arr;
      }
      order.forEach((e, i) => { e.zIndex = i + 1; });
    });
  },
  align: (op) => {
    const { doc, selectedIds, currentSlideId } = get();
    const slide = get().currentSlide();
    if (!doc || !slide || !selectedIds.length) return;
    const els = slide.elements.filter((e) => selectedIds.includes(e.id) && !e.locked);
    const b = els.length === 1 ? { x: 0, y: 0, width: doc.size.width, height: doc.size.height } : bbox(els);
    get().commit(`Align ${op}`, (d) => {
      findSlide(d, currentSlideId)!.elements.forEach((e) => {
        if (!selectedIds.includes(e.id) || e.locked) return;
        let dx = 0, dy = 0;
        if (op === 'left') dx = b.x - e.x;
        if (op === 'center') dx = b.x + b.width / 2 - (e.x + e.width / 2);
        if (op === 'right') dx = b.x + b.width - (e.x + e.width);
        if (op === 'top') dy = b.y - e.y;
        if (op === 'middle') dy = b.y + b.height / 2 - (e.y + e.height / 2);
        if (op === 'bottom') dy = b.y + b.height - (e.y + e.height);
        translateEl(e, Math.round(dx), Math.round(dy));
      });
    });
  },
  distribute: (axis) => {
    const { selectedIds, currentSlideId } = get();
    const slide = get().currentSlide();
    if (!slide || selectedIds.length < 3) return;
    const els = slide.elements.filter((e) => selectedIds.includes(e.id) && !e.locked).sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
    const first = els[0], last = els[els.length - 1];
    const total = axis === 'h' ? last.x + last.width - first.x : last.y + last.height - first.y;
    const sizes = els.reduce((s, e) => s + (axis === 'h' ? e.width : e.height), 0);
    const gap = (total - sizes) / (els.length - 1);
    let pos = axis === 'h' ? first.x : first.y;
    const target = new Map<string, number>();
    els.forEach((e) => { target.set(e.id, pos); pos += (axis === 'h' ? e.width : e.height) + gap; });
    get().commit(`Distribute ${axis === 'h' ? 'horizontally' : 'vertically'}`, (d) => {
      findSlide(d, currentSlideId)!.elements.forEach((e) => {
        const t = target.get(e.id);
        if (t === undefined) return;
        translateEl(e, axis === 'h' ? Math.round(t - e.x) : 0, axis === 'v' ? Math.round(t - e.y) : 0);
      });
    });
  },
  setAnimations: (elId, anims, label = 'Animation') => {
    get().updateElements([elId], (e) => { if (anims?.length) e.animation = anims as Draft<Animation>[]; else delete e.animation; }, label);
  },

  save: async (opts = {}) => {
    const { doc } = get();
    if (!doc) return;
    set({ saveStatus: 'saving', saveError: undefined });
    try {
      let meta = await storage.save(doc);
      const snapshot = opts.snapshot || Date.now() - lastSnapshotAt > SNAPSHOT_EVERY;
      if (snapshot) { await storage.addVersion(doc, opts.label ?? (opts.snapshot ? 'Manual save' : 'Auto snapshot')); lastSnapshotAt = Date.now(); }
      if (get().doc !== doc) { set({ meta }); return; } // changed while saving; next autosave will follow
      let status: SaveStatus = 'saved';
      if (await cloud.enabled()) {
        try {
          const cloudId = await cloud.push(doc, meta, snapshot);
          await storage.updateMeta(doc.id, { cloudId, cloudSyncedAt: Date.now() });
          meta = { ...meta, cloudId, cloudSyncedAt: Date.now() };
        } catch (e) {
          status = 'offline';
          set({ saveError: `Saved locally; cloud sync failed: ${(e as Error).message}` });
        }
      }
      set({ saveStatus: status, meta, lastSavedAt: Date.now() });
    } catch (e) {
      set({ saveStatus: 'error', saveError: (e as Error).message });
    }
  },
}));

function scheduleSave() {
  if (!autosave) autosave = debounce(() => { void useEditor.getState().save(); }, 900);
  autosave();
}
export function flushSave() { autosave?.flush(); }

/** Selected elements of the current slide. */
export function useSelectedElements(): SlideElement[] {
  return useEditor(useShallow((s) => {
    const slide = s.doc?.slides.find((x) => x.id === s.currentSlideId);
    return (slide?.elements ?? []).filter((e) => s.selectedIds.includes(e.id));
  }));
}
