import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@/i18n';
import { Copy, Eye, EyeOff, Plus, Search, Star, Trash2, ArrowUpDown, FolderPlus } from 'lucide-react';
import type { Presentation, Slide } from '@/types/schema';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { useEditor } from '@/stores/editor';
import { paragraphsToPlain } from '@/utils/richtext';
import { ContextMenu, type MenuItem } from '@/components/ContextMenu';
import { IconButton, cx, inputCls } from '@/components/ui';

/** Renders only when scrolled into view (virtualization for long decks). */
export const LazyThumb = memo(function LazyThumb({ slide, presentation, width, index }: { slide: Slide; presentation: Presentation; width: number; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(index < 12);
  useEffect(() => {
    if (visible || !ref.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '400px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  const scale = width / presentation.size.width;
  const h = presentation.size.height * scale;
  return (
    <div ref={ref} style={{ width, height: h }} className="overflow-hidden rounded-md bg-ink-100 dark:bg-ink-800">
      {visible && <SlideRenderer slide={slide} presentation={presentation} scale={scale} mode="thumb" slideNumber={index + 1} />}
    </div>
  );
});

export function slideSearchText(s: Slide): string {
  return [s.title, s.section, s.notes, ...s.elements.map((e) => (e.content?.paragraphs ? paragraphsToPlain(e.content.paragraphs) : ''))].join(' ').toLowerCase();
}

export function SlidesPanel() {
  const doc = useEditor((s) => s.doc)!;
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const selectedSlideIds = useEditor((s) => s.selectedSlideIds);
  const st = useEditor.getState;
  const [query, setQuery] = useState('');
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doc.slides.map((s, i) => ({ s, i })).filter(({ s }) => (!q || slideSearchText(s).includes(q)) && (!onlyStarred || s.starred));
  }, [doc.slides, query, onlyStarred]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-thumb="${currentSlideId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [currentSlideId]);

  const sectionOf = (i: number) => doc.slides[i]?.section;
  const menuItems = (id: string): MenuItem[] => {
    const s = doc.slides.find((x) => x.id === id)!;
    const ids = selectedSlideIds.includes(id) ? selectedSlideIds : [id];
    return [
      { label: tr('New slide after'), action: () => st().addSlide(id) },
      { label: ids.length > 1 ? tr('Duplicate {n} slides', { n: ids.length }) : tr('Duplicate'), shortcut: 'Ctrl+D', action: () => st().duplicateSlides(ids) },
      { label: ids.length > 1 ? tr('Delete {n} slides', { n: ids.length }) : tr('Delete'), disabled: ids.length >= doc.slides.length, action: () => st().deleteSlides(ids) },
      { sep: true },
      { label: s.hidden ? tr('Show slide') : tr('Hide slide'), action: () => st().commit(s.hidden ? 'Show slide' : 'Hide slide', (d) => { d.slides.forEach((x) => { if (ids.includes(x.id)) x.hidden = !s.hidden; }); }) },
      { label: s.starred ? tr('Remove mark') : tr('Mark as important'), action: () => st().commit('Mark slide', (d) => { d.slides.forEach((x) => { if (ids.includes(x.id)) x.starred = !s.starred; }); }) },
      { label: tr('Add section here…'), action: () => { const name = prompt(tr('Section name'), s.section ?? ''); if (name !== null) st().commit('Section', (d) => { const start = d.slides.findIndex((x) => x.id === id); const old = d.slides[start].section; for (let k = start; k < d.slides.length && (k === start || d.slides[k].section === old); k++) d.slides[k].section = name || undefined; }); } },
      { sep: true },
      { label: tr('Move up'), disabled: doc.slides[0].id === id, action: () => st().moveSlides(ids, Math.max(0, doc.slides.findIndex((x) => x.id === ids[0]) - 1)) },
      { label: tr('Move down'), disabled: doc.slides[doc.slides.length - 1].id === id, action: () => st().moveSlides(ids, doc.slides.findIndex((x) => x.id === ids[ids.length - 1]) + 2) },
    ];
  };

  return (
    <div className="flex h-full flex-col" data-testid="slides-panel">
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className={cx(inputCls, 'h-7 pl-7 text-xs')} placeholder={tr('Search slides')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <IconButton title={tr('Show important only')} active={onlyStarred} onClick={() => setOnlyStarred(!onlyStarred)}><Star size={14} /></IconButton>
        <IconButton title={tr('Group by section (sort)')} onClick={() => st().commit('Sort by section', (d) => { const order: string[] = []; d.slides.forEach((s) => { const k = s.section ?? ''; if (!order.includes(k)) order.push(k); }); d.slides.sort((a, b) => order.indexOf(a.section ?? '') - order.indexOf(b.section ?? '')); })}><ArrowUpDown size={14} /></IconButton>
        <IconButton title={tr('Add slide')} onClick={() => st().addSlide()} data-testid="add-slide"><Plus size={15} /></IconButton>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-6" onDragOver={(e) => e.preventDefault()}>
        {visible.map(({ s, i }) => {
          const showSection = s.section && (i === 0 || sectionOf(i - 1) !== s.section);
          const active = s.id === currentSlideId;
          const selected = selectedSlideIds.includes(s.id);
          return (
            <div key={s.id}>
              {showSection && <div className="mb-1 mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500"><FolderPlus size={12} />{s.section}</div>}
              {dropIndex === i && <div className="mb-1 h-0.5 rounded bg-brand-500" />}
              <div
                data-thumb={s.id}
                data-testid="slide-thumb"
                draggable={!query}
                onDragStart={(e) => { const ids = selected ? selectedSlideIds : [s.id]; setDragIds(ids); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ids.join(',')); }}
                onDragOver={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropIndex(e.clientY < r.top + r.height / 2 ? i : i + 1); }}
                onDrop={(e) => { e.preventDefault(); if (dragIds && dropIndex !== null) st().moveSlides(dragIds, dropIndex); setDragIds(null); setDropIndex(null); }}
                onDragEnd={() => { setDragIds(null); setDropIndex(null); }}
                onClick={(e) => st().selectSlide(s.id, e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single')}
                onContextMenu={(e) => { e.preventDefault(); if (!selected) st().selectSlide(s.id); setMenu({ x: e.clientX, y: e.clientY, id: s.id }); }}
                className={cx('group relative flex cursor-pointer gap-2 rounded-lg p-1.5 transition', active ? 'bg-brand-50 dark:bg-brand-500/10' : selected ? 'bg-ink-100 dark:bg-ink-800/70' : 'hover:bg-ink-50 dark:hover:bg-ink-850', dragIds?.includes(s.id) && 'opacity-40')}
              >
                <div className="w-5 pt-0.5 text-right text-[11px] font-medium tabular-nums text-ink-400">{i + 1}</div>
                <div className={cx('relative rounded-md ring-2', active ? 'ring-brand-500' : selected ? 'ring-brand-300' : 'ring-transparent', s.hidden && 'opacity-40')}>
                  <LazyThumb slide={s} presentation={doc} width={168} index={i} />
                  <div className="absolute right-1 top-1 flex gap-0.5">
                    {s.starred && <span className="rounded bg-amber-400 p-0.5 text-white"><Star size={10} fill="currentColor" /></span>}
                    {s.hidden && <span className="rounded bg-ink-700 p-0.5 text-white"><EyeOff size={10} /></span>}
                    {s.transition && s.transition.type !== 'none' && <span className="rounded bg-black/55 px-1 text-[9px] font-medium leading-[14px] text-white">{s.transition.type}</span>}
                  </div>
                  <div className="absolute bottom-1 right-1 hidden gap-0.5 group-hover:flex">
                    <button title={tr('Duplicate')} className="rounded bg-white/90 p-1 text-ink-700 shadow hover:bg-white" onClick={(e) => { e.stopPropagation(); st().duplicateSlides([s.id]); }}><Copy size={11} /></button>
                    <button title={s.hidden ? tr('Show') : tr('Hide')} className="rounded bg-white/90 p-1 text-ink-700 shadow hover:bg-white" onClick={(e) => { e.stopPropagation(); st().updateSlide(s.id, { hidden: !s.hidden }, s.hidden ? 'Show slide' : 'Hide slide'); }}>{s.hidden ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                    <button title={tr('Delete')} disabled={doc.slides.length <= 1} className="rounded bg-white/90 p-1 text-red-600 shadow hover:bg-white disabled:opacity-40" onClick={(e) => { e.stopPropagation(); st().deleteSlides([s.id]); }} data-testid="thumb-delete"><Trash2 size={11} /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {dropIndex === doc.slides.length && <div className="h-0.5 rounded bg-brand-500" />}
        {!visible.length && <p className="px-2 py-6 text-center text-xs text-ink-400">{tr('No slides match.')}</p>}
      </div>
      {menu && <div className="fixed inset-0 z-40" onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}><ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.id)} onClose={() => setMenu(null)} /></div>}
    </div>
  );
}
