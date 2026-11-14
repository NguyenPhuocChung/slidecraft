/** Browser helpers for export: offscreen slide rendering, image fetching/resolution, SVG rasterizing, formula rendering. */
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import katex from 'katex';
import { toPng } from 'html-to-image';
import type { Presentation, SlideElement } from '@/types/schema';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { assetSrc, resolveQuery, useMediaStore } from '@/media/resolver';

const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  const tries = [url, `/api/media/proxy?url=${encodeURIComponent(url)}`];
  for (const u of tries) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(u, { signal: ctrl.signal, mode: 'cors' });
      clearTimeout(t);
      if (!r.ok) continue;
      const b = await r.blob();
      if (!b.type.startsWith('image/')) continue;
      return await blobToDataUrl(b);
    } catch { /* try next */ }
  }
  return null;
}

/** Make sure every query-only image has been resolved before exporting (waits up to `ms`). */
export async function resolvePendingImages(p: Presentation, ms = 8000): Promise<void> {
  const queries = new Set<string>();
  p.slides.forEach((s) => {
    s.elements.forEach((e) => { if (e.type === 'image' && !e.content?.src && e.content?.query) queries.add(e.content.query); });
    if (s.background?.type === 'image' && !s.background.image?.src && s.background.image?.query) queries.add(s.background.image.query);
  });
  queries.forEach((q) => resolveQuery(q));
  const end = Date.now() + ms;
  while (Date.now() < end && [...queries].some((q) => !(q in useMediaStore.getState().cache))) await new Promise((r) => setTimeout(r, 200));
}

export function makeResolveImage(p: Presentation) {
  return (el: SlideElement): string | null => {
    const c = el.content ?? {};
    const direct = assetSrc(c.src, p.assets);
    if (direct) return direct;
    if (c.query) return useMediaStore.getState().cache[c.query]?.url ?? null;
    return null;
  };
}

export async function rasterizeSvg(svg: string, w: number, h: number, scale = 2): Promise<string> {
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('SVG rasterize failed')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export async function renderFormulaPng(latex: string, opts: { color: string; fontSize: number }): Promise<string | null> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;padding:8px;color:${opts.color};font-size:${opts.fontSize}px;background:transparent;display:inline-block`;
  host.innerHTML = katex.renderToString(latex, { displayMode: true, throwOnError: false });
  document.body.appendChild(host);
  try { return await toPng(host, { pixelRatio: 2, backgroundColor: undefined }); } catch { return null; } finally { host.remove(); }
}

/** Mount a slide offscreen at 1:1 and return its DOM node (call `dispose` afterwards). */
export async function renderSlideOffscreen(p: Presentation, index: number): Promise<{ node: HTMLElement; dispose: () => void }> {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${p.size.width + 200}px;top:0;width:${p.size.width}px;height:${p.size.height}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<SlideRenderer slide={p.slides[index]} presentation={p} scale={1} mode="export" slideNumber={index + 1} />));
  await document.fonts?.ready;
  const imgs = Array.from(host.querySelectorAll('img'));
  await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise<void>((r) => { im.onload = () => r(); im.onerror = () => r(); setTimeout(r, 8000); }))));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return { node: host.firstElementChild as HTMLElement, dispose: () => { root.unmount(); host.remove(); } };
}
