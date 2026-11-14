import { useEffect, useMemo, useRef, useState } from 'react';
import { tr } from '@/i18n';
import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen, Search, Trash2, Upload, ImagePlus, Loader2 } from 'lucide-react';
import type { Asset, Paragraph, SlideElement } from '@/types/schema';
import { useEditor } from '@/stores/editor';
import { ELEMENT_TYPES } from '@/types/registry';
import { THEMES, getTheme } from '@/themes/themes';
import { LAYOUTS, buildLayout } from '@/layouts/engine';
import { extractContent } from '@/layouts/extract';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { normalizeElement } from '@/code-parser/normalize';
import { paragraphsToMarkdown, paragraphsToPlain, parseMarkdownLite } from '@/utils/richtext';
import { fileToAsset, library, ACCEPT_ATTR } from '@/media/library';
import { searchImages, smartQuery, type MediaResult } from '@/media/resolver';
import { Badge, Button, IconButton, cx, inputCls, toast } from '@/components/ui';

/* ------------------------------- Outline ------------------------------- */
export function OutlinePanel() {
  const doc = useEditor((s) => s.doc)!;
  const current = useEditor((s) => s.currentSlideId);
  const st = useEditor.getState;
  return (
    <div className="h-full overflow-y-auto px-3 py-3" data-testid="outline-panel">
      <p className="mb-3 text-[11px] text-ink-400">{tr('Edit titles and text directly. Changes apply to the slide elements.')}</p>
      {doc.slides.map((s, i) => {
        const texts = s.elements.filter((e) => ['heading', 'text', 'paragraph', 'richText'].includes(e.type)).sort((a, b) => a.y - b.y || a.x - b.x);
        return (
          <div key={s.id} className={cx('mb-3 rounded-lg border p-2', s.id === current ? 'border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5' : 'border-ink-100 dark:border-ink-800')} onClick={() => st().selectSlide(s.id)}>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ink-400"><span>{i + 1}</span>{s.section && <Badge>{s.section}</Badge>}{s.hidden && <Badge tone="amber">{tr('hidden')}</Badge>}</div>
            {texts.length === 0 && <p className="text-xs italic text-ink-400">{tr('No text on this slide')}</p>}
            {texts.map((e) => (
              <OutlineText key={e.id} el={e} slideId={s.id} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
function OutlineText({ el, slideId }: { el: SlideElement; slideId: string }) {
  const [v, setV] = useState(paragraphsToMarkdown(el.content?.paragraphs as Paragraph[]));
  useEffect(() => setV(paragraphsToMarkdown(el.content?.paragraphs as Paragraph[])), [el.content]);
  return (
    <textarea
      className={cx('mb-1 w-full resize-none rounded border-0 bg-transparent px-1 py-0.5 text-ink-800 outline-none focus:bg-white focus:ring-1 focus:ring-brand-400 dark:text-ink-100 dark:focus:bg-ink-850', el.type === 'heading' ? 'text-[13px] font-semibold' : 'text-xs text-ink-600 dark:text-ink-300')}
      rows={Math.min(6, Math.max(1, v.split('\n').length))}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === paragraphsToMarkdown(el.content?.paragraphs as Paragraph[])) return;
        useEditor.getState().commit('Edit text (outline)', (d) => { const e = d.slides.find((s) => s.id === slideId)?.elements.find((x) => x.id === el.id); if (e) e.content = { ...e.content, paragraphs: parseMarkdownLite(v) }; });
      }}
    />
  );
}

/* -------------------------------- Layers -------------------------------- */
export function LayersPanel() {
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const selectedIds = useEditor((s) => s.selectedIds);
  const st = useEditor.getState;
  if (!slide) return null;
  const sorted = [...slide.elements].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  const label = (e: SlideElement) => {
    const t = e.content?.paragraphs ? paragraphsToPlain(e.content.paragraphs).slice(0, 40) : e.type === 'image' ? e.content?.alt ?? e.content?.query : e.type === 'chart' ? e.content?.chartType : e.content?.kind ?? e.content?.shape ?? e.content?.name;
    return e.name ?? (t ? String(t) : e.id);
  };
  return (
    <div className="h-full overflow-y-auto px-2 py-3" data-testid="layers-panel">
      <p className="mb-2 px-1 text-[11px] text-ink-400">{tr('Top = front. Click to select, Shift/Ctrl for multi-select.')}</p>
      {sorted.map((e) => (
        <div key={e.id} onClick={(ev) => st().select([e.id], ev.shiftKey || ev.ctrlKey || ev.metaKey)} className={cx('group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs', selectedIds.includes(e.id) ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-850')}>
          <span className="w-16 shrink-0 truncate text-[10px] uppercase tracking-wide text-ink-400">{tr(ELEMENT_TYPES[e.type]?.label ?? e.type)}</span>
          <span className={cx('flex-1 truncate', e.visible === false && 'opacity-40')}>{label(e)}</span>
          <button title={tr('Bring forward')} className="hidden group-hover:block" onClick={(ev) => { ev.stopPropagation(); st().select([e.id]); st().arrange('forward'); }}><ChevronUp size={13} /></button>
          <button title={tr('Send backward')} className="hidden group-hover:block" onClick={(ev) => { ev.stopPropagation(); st().select([e.id]); st().arrange('backward'); }}><ChevronDown size={13} /></button>
          <button title={e.visible === false ? 'Show' : 'Hide'} onClick={(ev) => { ev.stopPropagation(); st().updateElements([e.id], (x) => { x.visible = x.visible === false ? undefined : false; }, 'Visibility'); }}>{e.visible === false ? <EyeOff size={13} /> : <Eye size={13} className="opacity-40 group-hover:opacity-100" />}</button>
          <button title={e.locked ? 'Unlock' : 'Lock'} onClick={(ev) => { ev.stopPropagation(); st().updateElements([e.id], (x) => { x.locked = !x.locked; }, e.locked ? 'Unlock' : 'Lock'); }}>{e.locked ? <Lock size={13} className="text-amber-500" /> : <LockOpen size={13} className="opacity-40 group-hover:opacity-100" />}</button>
        </div>
      ))}
      {!sorted.length && <p className="px-2 py-6 text-center text-xs text-ink-400">{tr('This slide is empty.')}</p>}
    </div>
  );
}

/* ------------------------------ Templates ------------------------------- */
export function TemplatesPanel() {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const st = useEditor.getState;
  const theme = getTheme(doc.theme, doc.themeOverrides);
  const sampleContent = useMemo(() => (slide ? extractContent(slide) : {}), [slide]);
  const categories = [...new Set(LAYOUTS.map((l) => l.category))];
  const demo = (id: string) => {
    const base = {
      heading: tr('Your headline here'), eyebrow: tr('Section'), subheading: tr('A short supporting line'), body: tr('Body text explains the idea in a sentence or two.'),
      bullets: [tr('First point'), tr('Second point'), tr('Third point')], image: { query: 'abstract gradient', alt: 'Image' },
      stats: [{ value: '87%', label: tr('Metric one') }, { value: '3.2x', label: tr('Metric two') }, { value: '$4M', label: tr('Metric three') }],
      items: [1, 2, 3, 4].map((n) => ({ title: tr('Item {n}', { n }), text: tr('Short description') })),
      columns: [{ heading: 'Option A', bullets: ['Point', 'Point'] }, { heading: 'Option B', bullets: ['Point', 'Point'] }],
      quote: { text: tr('Design is not just what it looks like. It is how it works.'), author: tr('Author') },
      chart: { chartType: 'column' as const, categories: ['A', 'B', 'C', 'D'], series: [{ name: 'S', values: [3, 5, 4, 7] }] },
      table: { rows: [['Col', 'Col'], ['1', '2']], header: true }, timeline: { orientation: 'horizontal' as const, style: 'milestones' as const, items: [{ date: '2024', title: 'Start' }, { date: '2025', title: 'Grow' }, { date: '2026', title: 'Scale' }] },
      diagram: { kind: 'cycle' as const, items: [{ title: 'Plan' }, { title: 'Do' }, { title: 'Check' }, { title: 'Act' }] }, code: { code: 'const x = 42;', language: 'ts' },
      before: { heading: 'Before', bullets: ['Slow'] }, after: { heading: 'After', bullets: ['Fast'] }, number: '01', cta: 'Get started',
    };
    const def = LAYOUTS.find((l) => l.id === id)!;
    const c: Record<string, unknown> = {};
    def.slots.forEach((k) => { if (k in base) c[k] = (base as Record<string, unknown>)[k]; });
    return c;
  };
  return (
    <div className="h-full overflow-y-auto px-3 py-3" data-testid="templates-panel">
      <p className="mb-3 text-[11px] text-ink-400">{tr('Click a layout to add a new slide. Use the')} <b>{tr('Layout')}</b> {tr('tab on the right to restyle the current slide while keeping its content.')}</p>
      {categories.map((cat) => (
        <div key={cat} className="mb-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr(cat)}</h4>
          <div className="grid grid-cols-2 gap-2">
            {LAYOUTS.filter((l) => l.category === cat).map((l) => {
              const c = demo(l.id);
              const res = buildLayout(l.id, c, theme, doc.size);
              const preview = { id: `tpl-${l.id}`, elements: res.elements.map((e) => normalizeElement(e)), background: res.background };
              return (
                <button key={l.id} title={tr(l.description)} className="group text-left" onClick={() => st().addSlide(undefined, { layout: l.id, content: c, title: tr(l.name) })} data-testid={`template-${l.id}`}>
                  <div className="overflow-hidden rounded-md ring-1 ring-ink-200 transition group-hover:ring-2 group-hover:ring-brand-500 dark:ring-ink-700">
                    <SlideRenderer slide={preview} presentation={doc} scale={124 / doc.size.width} mode="thumb" />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-ink-600 dark:text-ink-300">{tr(l.name)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {void sampleContent}
    </div>
  );
}

/* -------------------------------- Themes -------------------------------- */
export function ThemesPanel() {
  const doc = useEditor((s) => s.doc)!;
  const selectedSlideIds = useEditor((s) => s.selectedSlideIds);
  const st = useEditor.getState;
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const sample = doc.slides[0];
  return (
    <div className="h-full overflow-y-auto px-3 py-3" data-testid="themes-panel">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-ink-500">{tr('Apply to')}</span>
        <select className={cx(inputCls, 'h-7 w-auto text-xs')} value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'selected')}>
          <option value="all">{tr('All slides')}</option>
          <option value="selected">{tr('Selected slides ({n})', { n: selectedSlideIds.length })}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => { st().setTheme(t.id, scope); toast.success(scope === 'selected' ? tr('Theme “{name}” applied to selected slides', { name: tr(t.name) }) : tr('Theme “{name}” applied', { name: tr(t.name) })); }} className="group text-left" data-testid={`theme-${t.id}`}>
            <div className={cx('overflow-hidden rounded-md ring-1 transition group-hover:ring-2 group-hover:ring-brand-500', doc.theme === t.id ? 'ring-2 ring-brand-500' : 'ring-ink-200 dark:ring-ink-700')}>
              {sample && <SlideRenderer slide={{ ...sample, theme: t.id }} presentation={{ ...doc, theme: t.id, themeOverrides: undefined }} scale={124 / doc.size.width} mode="thumb" />}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {[t.colors.primary, t.colors.accent, t.colors.secondary].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}
              <span className="truncate text-[11px] text-ink-600 dark:text-ink-300">{tr(t.name)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Media / Assets ------------------------------ */
export function insertAsset(a: Asset) {
  const st = useEditor.getState();
  const doc = st.doc!;
  st.commit('Add asset', (d) => { if (!d.assets.some((x) => x.id === a.id)) d.assets.push(a as never); });
  const w = a.width && a.height ? Math.min(1000, a.width) : 800;
  const h = a.width && a.height ? (w * a.height) / a.width : 500;
  const base = { x: (doc.size.width - w) / 2, y: (doc.size.height - h) / 2, width: w, height: h };
  if (a.type === 'video') st.addElement({ type: 'video', ...base, width: 960, height: 540, content: { src: a.src, title: a.name } });
  else if (a.type === 'audio') st.addElement({ type: 'audio', ...base, width: 560, height: 96, content: { src: a.src, title: a.name } });
  else st.addElement({ type: 'image', ...base, content: { src: `asset:${a.id}`, alt: a.name, license: a.license, credit: a.credit } });
}

export function MediaPanel({ onPick }: { onPick?: (r: MediaResult | Asset) => void }) {
  const doc = useEditor((s) => s.doc)!;
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const [q, setQ] = useState('');
  const [provider, setProvider] = useState('');
  const [orientation, setOrientation] = useState<'' | 'landscape' | 'portrait' | 'squarish'>('');
  const [results, setResults] = useState<MediaResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lib, setLib] = useState<Asset[]>([]);
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void library.list().then(setLib); }, []);
  const heading = slide ? paragraphsToPlain(slide.elements.find((e) => e.type === 'heading')?.content?.paragraphs) : '';
  const suggestions = useMemo(() => {
    const imgs = slide?.elements.filter((e) => e.type === 'image') ?? [];
    const qs = imgs.map((e) => smartQuery(e.content ?? {}, { heading })).filter(Boolean);
    if (heading) qs.push(heading.split(/\s+/).slice(0, 6).join(' '));
    return [...new Set(qs)].slice(0, 4);
  }, [slide, heading]);
  const run = async (query = q) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    const r = await searchImages(query, { provider: provider || undefined, orientation: orientation || undefined });
    setResults(r.results);
    setErrors(r.errors);
    setLoading(false);
  };
  const upload = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      try {
        const a = await fileToAsset(f);
        await library.add(a);
        setLib((l) => [a, ...l]);
        if (onPick) onPick(a); else insertAsset(a);
        toast.success(`Uploaded ${f.name}`);
      } catch (e) { toast.error((e as Error).message); }
    }
  };
  const pick = (r: MediaResult) => {
    if (onPick) return onPick(r);
    useEditor.getState().addElement({ type: 'image', x: (doc.size.width - 800) / 2, y: (doc.size.height - 500) / 2, width: 800, height: r.width && r.height ? Math.round((800 * r.height) / r.width) : 500, content: { src: r.url, alt: r.alt, credit: r.credit, license: r.license, sourceUrl: r.sourceUrl, query: q } });
  };
  return (
    <div className="flex h-full flex-col" data-testid="media-panel">
      <div className="space-y-2 px-3 pt-3">
        <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="relative">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className={cx(inputCls, 'pl-7')} placeholder={tr('Search Unsplash, Pexels, Pixabay, Openverse, Wikimedia')} value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="flex gap-1.5">
          <select className={cx(inputCls, 'h-7 text-xs')} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">{tr('All sources')}</option>
            {['unsplash', 'pexels', 'pixabay', 'openverse', 'wikimedia'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className={cx(inputCls, 'h-7 text-xs')} value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}>
            <option value="">{tr('Any shape')}</option><option value="landscape">{tr('Landscape')}</option><option value="portrait">{tr('Portrait')}</option><option value="squarish">{tr('Square')}</option>
          </select>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Suggested for this slide:')}</span>
            {suggestions.map((s) => <button key={s} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-700 hover:bg-brand-100 dark:bg-ink-800 dark:text-ink-200" onClick={() => void run(s)}>{s}</button>)}
          </div>
        )}
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()} className="flex-1">{tr('Upload')}</Button>
          <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} data-testid="media-upload" />
        </div>
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (!/^https?:\/\//.test(url)) { toast.error(tr('Enter an http(s) image URL')); return; } pick({ id: url, provider: 'upload', url, thumb: url, alt: 'Image' }); setUrl(''); }}>
          <input className={cx(inputCls, 'h-7 text-xs')} placeholder={tr('…or paste an image URL')} value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button size="sm" type="submit">{tr('Add')}</Button>
        </form>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && <div className="flex items-center gap-2 py-4 text-xs text-ink-400"><Loader2 size={14} className="animate-spin" />{tr('Searching…')}</div>}
        {!loading && errors.length > 0 && !results.length && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {tr('No results.')} {errors.slice(0, 3).join(' · ')}
            <div className="mt-1 text-amber-700/80">{tr('Configure API keys on the server (.env) or upload your own images.')}</div>
          </div>
        )}
        <div className="columns-2 gap-2">
          {results.map((r) => (
            <button key={r.provider + r.id} className="group relative mb-2 block w-full overflow-hidden rounded-md" onClick={() => pick(r)} title={`${r.alt ?? ''}\n${r.credit ?? ''} · ${r.license ?? ''}`}>
              <img src={r.thumb} alt={r.alt ?? ''} className="w-full" loading="lazy" referrerPolicy="no-referrer" />
              <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100">{r.provider} · {r.license}</span>
            </button>
          ))}
        </div>
        <h4 className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr('Library ({n})', { n: lib.length })}</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {lib.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md bg-ink-100 dark:bg-ink-800">
              <button className="h-full w-full" onClick={() => (onPick ? onPick(a) : insertAsset(a))} title={a.name}>
                {a.type === 'image' || a.type === 'svg' ? <img src={a.src} alt={a.name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] uppercase text-ink-500">{a.type}</span>}
              </button>
              <button title={tr('Remove from library')} className="absolute right-0.5 top-0.5 hidden rounded bg-white/90 p-0.5 text-red-600 group-hover:block" onClick={() => { void library.remove(a.id); setLib((l) => l.filter((x) => x.id !== a.id)); }}><Trash2 size={11} /></button>
            </div>
          ))}
          {!lib.length && <p className="col-span-3 text-[11px] text-ink-400">{tr('Uploaded files appear here and can be reused in any presentation.')}</p>}
        </div>
      </div>
    </div>
  );
}

export function AssetsPanel() {
  const doc = useEditor((s) => s.doc)!;
  const st = useEditor.getState;
  const used = useMemo(() => {
    const ids = new Set<string>();
    doc.slides.forEach((s) => s.elements.forEach((e) => { const src = e.content?.src; if (typeof src === 'string' && src.startsWith('asset:')) ids.add(src.slice(6)); }));
    return ids;
  }, [doc]);
  const external = useMemo(() => doc.slides.flatMap((s, i) => s.elements.filter((e) => e.type === 'image').map((e) => ({ slide: i + 1, el: e }))), [doc]);
  return (
    <div className="h-full overflow-y-auto px-3 py-3" data-testid="assets-panel">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr('Embedded assets ({n})', { n: doc.assets.length })}</h4>
      {!doc.assets.length && <p className="mb-3 text-[11px] text-ink-400">{tr('No uploaded files in this presentation yet.')}</p>}
      <div className="mb-4 space-y-1.5">
        {doc.assets.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-md border border-ink-100 p-1.5 text-xs dark:border-ink-800">
            {a.type === 'image' || a.type === 'svg' ? <img src={a.src} alt="" className="h-9 w-12 rounded object-cover" /> : <span className="flex h-9 w-12 items-center justify-center rounded bg-ink-100 text-[10px] dark:bg-ink-800">{a.type}</span>}
            <div className="min-w-0 flex-1"><div className="truncate">{a.name}</div><div className="text-[10px] text-ink-400">{a.size ? `${(a.size / 1024).toFixed(0)} KB` : ''} {used.has(a.id) ? `· ${tr('in use')}` : `· ${tr('unused')}`}</div></div>
            <IconButton title={tr('Insert')} onClick={() => insertAsset(a)}><ImagePlus size={13} /></IconButton>
            <IconButton title={tr('Remove (only if unused)')} disabled={used.has(a.id)} onClick={() => st().commit('Remove asset', (d) => { d.assets = d.assets.filter((x) => x.id !== a.id); })}><Trash2 size={13} /></IconButton>
          </div>
        ))}
      </div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{tr('Images in slides ({n})', { n: external.length })}</h4>
      <div className="space-y-1">
        {external.map(({ slide, el }) => (
          <button key={`${slide}-${el.id}`} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] hover:bg-ink-50 dark:hover:bg-ink-850" onClick={() => { const s = doc.slides[slide - 1]; st().selectSlide(s.id); st().select([el.id]); }}>
            <Badge>#{slide}</Badge>
            <span className="min-w-0 flex-1 truncate">{el.content?.src ? (String(el.content.src).startsWith('data:') ? tr('embedded image') : el.content.src) : `${tr('query')}: ${el.content?.query}`}</span>
            {el.content?.license && <Badge tone="green">{String(el.content.license).slice(0, 14)}</Badge>}
          </button>
        ))}
      </div>
    </div>
  );
}
