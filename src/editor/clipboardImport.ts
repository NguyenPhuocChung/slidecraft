/**
 * Paste & drop from outside SlideCraft:
 *  - image files / screenshots from the system clipboard or dropped from the desktop
 *  - images copied or dragged from a web page (HTML <img> or an image URL)
 *  - plain text → new text box
 *  - SlideCraft elements copied in another tab (JSON marker)
 * Remote images are embedded (data URL asset) when they can be downloaded, so they
 * survive the source page going away and export reliably; otherwise the URL is kept.
 */
import type { Asset, SlideElement } from '@/types/schema';
import { useEditor } from '@/stores/editor';
import { fileToAsset, library } from '@/media/library';
import { isSafeUrl } from '@/code-parser/security';
import { fetchImageAsDataUrl } from './dialogs/exportHelpers';
import { normalizeElement } from '@/code-parser/normalize';
import { uid } from '@/utils/id';
import { toast } from '@/components/ui';
import { tr } from '@/i18n';

type Pt = { x: number; y: number } | null;

function placeBox(w0: number, h0: number, at: Pt) {
  const doc = useEditor.getState().doc!;
  const maxW = doc.size.width * 0.6, maxH = doc.size.height * 0.7;
  const k = Math.min(1, maxW / w0, maxH / h0);
  const w = Math.round(w0 * k), h = Math.round(h0 * k);
  const x = at ? at.x - w / 2 : (doc.size.width - w) / 2;
  const y = at ? at.y - h / 2 : (doc.size.height - h) / 2;
  return { x: Math.round(Math.max(0, Math.min(doc.size.width - w, x))), y: Math.round(Math.max(0, Math.min(doc.size.height - h, y))), width: w, height: h };
}

function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth || 800, h: i.naturalHeight || 500 });
    i.onerror = () => res({ w: 800, h: 500 });
    i.src = src;
    setTimeout(() => res({ w: 800, h: 500 }), 8000);
  });
}

async function addAssetImage(a: Asset, at: Pt) {
  const st = useEditor.getState();
  st.commit(tr('Add asset'), (d) => { if (!d.assets.some((x) => x.id === a.id)) d.assets.push(a as never); });
  if (a.type === 'video' || a.type === 'audio') {
    st.addElement({ type: a.type, ...placeBox(a.type === 'video' ? 960 : 560, a.type === 'video' ? 540 : 96, at), content: { src: a.src, title: a.name } });
    return;
  }
  const s = a.width && a.height ? { w: a.width, h: a.height } : await imageSize(a.src);
  st.addElement({ type: 'image', ...placeBox(s.w, s.h, at), content: { src: `asset:${a.id}`, alt: a.name ?? 'Image', license: a.license as string | undefined } });
}

export async function insertFiles(files: File[], at: Pt = null): Promise<number> {
  let n = 0;
  for (const f of files) {
    try {
      const a = await fileToAsset(f);
      void library.add(a);
      await addAssetImage(a, at);
      n++;
    } catch (e) { toast.error((e as Error).message); }
  }
  return n;
}

/** Insert an image from a web URL: embed it when downloadable, otherwise link it. */
export async function insertImageUrl(url: string, at: Pt = null, alt = 'Image'): Promise<boolean> {
  if (!isSafeUrl(url, 'image')) { toast.error(tr('This link is not a supported image URL.')); return false; }
  const busy = toast.info(tr('Adding image…'));
  void busy;
  const data = url.startsWith('data:') ? url : await fetchImageAsDataUrl(url);
  if (data) {
    let host = '';
    try { host = new URL(url).hostname; } catch { /* data url */ }
    const s = await imageSize(data);
    const a: Asset = { id: uid('asset'), type: data.startsWith('data:image/svg') ? 'svg' : 'image', src: data, name: alt, width: s.w, height: s.h, sourceUrl: url.startsWith('data:') ? undefined : url, credit: host || undefined, size: Math.round(data.length * 0.75) };
    await addAssetImage(a, at);
    if (host) toast.success(tr('Image added from {host}. Check you have the right to use it.', { host }));
    return true;
  }
  // Could not download (CORS / offline): keep the link; it still displays if the site allows hotlinking.
  const s = await imageSize(url);
  useEditor.getState().addElement({ type: 'image', ...placeBox(s.w, s.h, at), content: { src: url, alt, sourceUrl: url } });
  toast.warning(tr('The image could not be downloaded, so it is linked instead. If it does not appear, save the image to your computer and drag it in.'));
  return true;
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
function imgFromHtml(html: string): { src: string; alt: string } | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const img = doc.querySelector('img');
  const src = img?.getAttribute('src') ?? img?.getAttribute('data-src') ?? '';
  if (!src) return null;
  return { src: src.startsWith('//') ? `https:${src}` : src, alt: img?.getAttribute('alt') || 'Image' };
}

/** Handle a clipboard/drag DataTransfer. Returns true when something was inserted. */
export async function importDataTransfer(dt: DataTransfer, at: Pt = null): Promise<boolean> {
  const files = Array.from(dt.files ?? []).filter((f) => /^(image|video|audio)\//.test(f.type) || /\.(svg|png|jpe?g|gif|webp|mp4|webm|mp3|wav|ogg)$/i.test(f.name));
  if (!files.length) {
    for (const it of Array.from(dt.items ?? [])) {
      if (it.kind === 'file' && /^(image|video|audio)\//.test(it.type)) { const f = it.getAsFile(); if (f) files.push(f); }
    }
  }
  if (files.length) return (await insertFiles(files, at)) > 0;
  const html = dt.getData('text/html');
  const text = dt.getData('text/plain').trim();
  const uri = dt.getData('text/uri-list').split('\n').find((l) => l && !l.startsWith('#'))?.trim() ?? '';
  // SlideCraft elements copied from another tab
  if (text.startsWith('{"slidecraft":"elements"')) {
    try {
      const { elements } = JSON.parse(text) as { elements: SlideElement[] };
      const st = useEditor.getState();
      const slide = st.currentSlide();
      const maxZ = Math.max(0, ...(slide?.elements ?? []).map((e) => e.zIndex ?? 0));
      const copies = elements.map((e, i) => ({ ...normalizeElement({ ...e, id: uid(e.type) }), zIndex: maxZ + i + 1 }));
      st.commit(tr('Paste'), (d) => { d.slides.find((s) => s.id === st.currentSlideId)?.elements.push(...(copies as never[])); });
      st.select(copies.map((c) => c.id));
      return true;
    } catch { /* fall through */ }
  }
  const fromHtml = html ? imgFromHtml(html) : null;
  if (fromHtml) return insertImageUrl(fromHtml.src, at, fromHtml.alt);
  const url = uri || text;
  if (/^https?:\/\/\S+$/i.test(url) && (IMG_EXT.test(url) || uri)) return insertImageUrl(url, at);
  if (/^data:image\//.test(url)) return insertImageUrl(url, at);
  if (text) {
    const st = useEditor.getState();
    const lines = text.split('\n').length;
    st.addElement({ type: 'paragraph', ...placeBox(1000, Math.min(700, 60 + lines * 44), at), content: { text } });
    return true;
  }
  return false;
}

/** Context-menu "Paste": read the system clipboard via the async Clipboard API (needs permission). */
export async function pasteFromSystemClipboard(at: Pt = null): Promise<boolean> {
  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    let html = '', text = '';
    for (const it of items) {
      const img = it.types.find((t) => t.startsWith('image/'));
      if (img) { const b = await it.getType(img); files.push(new File([b], `pasted.${img.split('/')[1].replace('svg+xml', 'svg')}`, { type: img })); continue; }
      if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
      if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
    }
    if (files.length) return (await insertFiles(files, at)) > 0;
    const dt = new DataTransfer();
    if (html) dt.setData('text/html', html);
    if (text) dt.setData('text/plain', text);
    return importDataTransfer(dt, at);
  } catch {
    return false;
  }
}
