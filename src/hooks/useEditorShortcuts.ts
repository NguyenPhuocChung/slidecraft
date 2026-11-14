import { useEffect } from 'react';
import { useEditor, translateEl } from '@/stores/editor';
import { importDataTransfer } from '@/editor/clipboardImport';

/** Global editor keyboard shortcuts (ignored while typing in inputs or editing text). */
export function useEditorShortcuts(handlers: { present: () => void; save: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      if (!st.doc) return;
      const t = e.target as HTMLElement;
      const typing = t.closest('input, textarea, select, [contenteditable="true"], .cm-editor');
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') { e.preventDefault(); handlers.save(); return; }
      if (e.key === 'F5') { e.preventDefault(); handlers.present(); return; }
      if (typing) return;
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); st.undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); st.redo(); return; }
      if (mod && k === 'c') { e.preventDefault(); st.copy(); return; }
      if (mod && k === 'x') { e.preventDefault(); st.copy(true); return; }
      if (mod && k === 'v') return; // handled by the 'paste' event (system clipboard: images, links, text, SlideCraft elements)
      if (mod && k === 'a') { e.preventDefault(); const s = st.currentSlide(); if (s) st.select(s.elements.filter((x) => !x.locked).map((x) => x.id)); return; }
      if (mod && k === 'd') { e.preventDefault(); if (st.selectedIds.length) st.duplicateElements(); else if (st.currentSlideId) st.duplicateSlides(st.selectedSlideIds.length ? st.selectedSlideIds : [st.currentSlideId]); return; }
      if (mod && k === 'g' && e.shiftKey) { e.preventDefault(); st.ungroup(); return; }
      if (mod && k === 'g') { e.preventDefault(); st.group(); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); st.set({ zoom: Math.min(4, (st.zoom || (useEditor.getState() as unknown as { fitScale?: number }).fitScale || 0.5) * 1.2) }); return; }
      if (mod && k === '-') { e.preventDefault(); st.set({ zoom: Math.max(0.05, (st.zoom || (useEditor.getState() as unknown as { fitScale?: number }).fitScale || 0.5) / 1.2) }); return; }
      if (mod && k === '0') { e.preventDefault(); st.set({ zoom: 0 }); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedIds.length) { e.preventDefault(); st.deleteElements(); }
        return;
      }
      if (e.key === 'Escape') { if (!document.querySelector('[role=dialog], [data-popover]')) st.select([]); return; }
      if (e.key === 'Enter' && st.selectedIds.length === 1) {
        const el = st.currentSlide()?.elements.find((x) => x.id === st.selectedIds[0]);
        if (el && ['text', 'heading', 'paragraph', 'richText', 'shape'].includes(el.type) && el.content?.paragraphs && !el.locked) { e.preventDefault(); st.set({ editingId: el.id }); }
        return;
      }
      if (e.key.startsWith('Arrow')) {
        if (st.selectedIds.length) {
          e.preventDefault();
          const d = e.shiftKey ? 10 : 1;
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
          const ids = st.selectedIds;
          st.commit('Nudge', (doc) => { doc.slides.find((s) => s.id === st.currentSlideId)?.elements.forEach((el) => { if (ids.includes(el.id) && !el.locked) translateEl(el, dx, dy); }); });
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const i = st.doc.slides.findIndex((s) => s.id === st.currentSlideId);
          const n = st.doc.slides[i + (e.key === 'ArrowDown' ? 1 : -1)];
          if (n) { e.preventDefault(); st.selectSlide(n.id); }
        }
        return;
      }
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        const i = st.doc.slides.findIndex((s) => s.id === st.currentSlideId);
        const n = st.doc.slides[i + (e.key === 'PageDown' ? 1 : -1)];
        if (n) { e.preventDefault(); st.selectSlide(n.id); }
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const st = useEditor.getState();
      if (!st.doc || !e.clipboardData) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"], .cm-editor')) return;
      const dt = e.clipboardData;
      const text = dt.getData('text/plain');
      const external = Array.from(dt.files ?? []).length > 0 || Array.from(dt.items ?? []).some((i) => i.kind === 'file') || !!dt.getData('text/html') || (!!text.trim() && !text.startsWith('{"slidecraft":'));
      e.preventDefault();
      if (!external) { if (st.clipboard) st.paste(); return; }
      void importDataTransfer(dt, null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('paste', onPaste); };
  }, [handlers]);
}

export const SHORTCUTS: [string, string][] = [
  ['Ctrl + Z', 'Undo'], ['Ctrl + Y / Ctrl + Shift + Z', 'Redo'], ['Ctrl + C / X / V', 'Copy / Cut / Paste'], ['Ctrl + A', 'Select all elements'],
  ['Delete', 'Delete selection'], ['Ctrl + D', 'Duplicate element (or slide)'], ['Ctrl + G', 'Group'], ['Ctrl + Shift + G', 'Ungroup'],
  ['Arrows / Shift + Arrows', 'Nudge 1px / 10px'], ['Enter / Double-click', 'Edit text'], ['Esc', 'Deselect / finish editing'], ['Space + Drag', 'Pan canvas'],
  ['Ctrl + wheel / Ctrl + = / -', 'Zoom'], ['Ctrl + 0', 'Fit to screen'], ['Shift + drag', 'Constrain move / keep ratio'], ['Alt + drag', 'Disable smart guides'],
  ['Ctrl + S', 'Save + create version'], ['F5', 'Present'], ['PageUp / PageDown', 'Previous / next slide'],
];
