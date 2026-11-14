/**
 * Raster / document exports (browser only). The editor supplies `renderSlide(i)`,
 * which mounts <SlideRenderer mode="export" scale={1}/> offscreen and resolves
 * with the slide root element once fonts and images have loaded.
 */
import JSZip from 'jszip';
import type { Presentation } from '@/types/schema';
import { safeFilename } from '@/utils/misc';
import { presentationJsonSchemaSafe } from './json';

export type RenderSlide = (slideIndex: number) => Promise<HTMLElement>;
export interface RasterOptions { slides?: number[]; scale?: number; onProgress?: (p: number, label: string) => void; quality?: number }

async function toImage() { return import('html-to-image'); }
const filter = (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset?.exportIgnore !== undefined);

function indices(p: Presentation, o: RasterOptions) { return o.slides ?? p.slides.map((_, i) => i).filter((i) => !p.slides[i].hidden); }

async function snap(node: HTMLElement, p: Presentation, format: 'png' | 'jpeg' | 'svg', scale: number, quality = 0.92): Promise<string> {
  const h2i = await toImage();
  const opts = { width: p.size.width, height: p.size.height, pixelRatio: scale, cacheBust: false, filter, skipFonts: false, quality, backgroundColor: '#ffffff' };
  if (format === 'svg') return h2i.toSvg(node, opts);
  if (format === 'jpeg') return h2i.toJpeg(node, opts);
  return h2i.toPng(node, opts);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** One image per slide; multiple slides are zipped. */
export async function exportImages(p: Presentation, renderSlide: RenderSlide, format: 'png' | 'jpeg', o: RasterOptions = {}): Promise<{ blob: Blob; filename: string; count: number }> {
  const list = indices(p, o);
  const urls: string[] = [];
  for (let k = 0; k < list.length; k++) {
    o.onProgress?.(k / list.length, `Rendering slide ${list[k] + 1}`);
    urls.push(await snap(await renderSlide(list[k]), p, format, o.scale ?? 1, o.quality));
  }
  const base = safeFilename(p.title);
  if (urls.length === 1) return { blob: await dataUrlToBlob(urls[0]), filename: `${base}-slide-${list[0] + 1}.${format === 'jpeg' ? 'jpg' : 'png'}`, count: 1 };
  const zip = new JSZip();
  for (let k = 0; k < urls.length; k++) zip.file(`${base}-slide-${String(list[k] + 1).padStart(2, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`, urls[k].split(',')[1], { base64: true });
  o.onProgress?.(1, 'Zipping');
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: `${base}-${format}.zip`, count: urls.length };
}

export async function exportSvg(p: Presentation, renderSlide: RenderSlide, o: RasterOptions = {}): Promise<{ blob: Blob; filename: string; count: number }> {
  const list = indices(p, o);
  const svgs: string[] = [];
  for (let k = 0; k < list.length; k++) {
    o.onProgress?.(k / list.length, `Rendering slide ${list[k] + 1}`);
    const url = await snap(await renderSlide(list[k]), p, 'svg', 1);
    svgs.push(decodeURIComponent(url.slice(url.indexOf(',') + 1)));
  }
  const base = safeFilename(p.title);
  if (svgs.length === 1) return { blob: new Blob([svgs[0]], { type: 'image/svg+xml' }), filename: `${base}-slide-${list[0] + 1}.svg`, count: 1 };
  const zip = new JSZip();
  svgs.forEach((s, k) => zip.file(`${base}-slide-${String(list[k] + 1).padStart(2, '0')}.svg`, s));
  return { blob: await zip.generateAsync({ type: 'blob' }), filename: `${base}-svg.zip`, count: svgs.length };
}

/** PDF: one page per slide at the exact slide size (pt), high-quality PNG pages + speaker notes as PDF annotations-free text pages optional. */
export async function exportPdf(p: Presentation, renderSlide: RenderSlide, o: RasterOptions & { includeNotes?: boolean } = {}): Promise<{ blob: Blob; filename: string; count: number }> {
  const { jsPDF } = await import('jspdf');
  const wPt = (p.size.width * 72) / 144, hPt = (p.size.height * 72) / 144;
  const pdf = new jsPDF({ orientation: wPt >= hPt ? 'landscape' : 'portrait', unit: 'pt', format: [wPt, hPt], compress: true });
  pdf.setProperties({ title: p.title, author: p.author ?? 'SlideCraft AI Studio', creator: 'SlideCraft AI Studio' });
  const list = indices(p, o);
  for (let k = 0; k < list.length; k++) {
    o.onProgress?.(k / list.length, `Rendering slide ${list[k] + 1}`);
    const url = await snap(await renderSlide(list[k]), p, o.quality && o.quality < 0.9 ? 'jpeg' : 'png', o.scale ?? 2, o.quality);
    if (k > 0) pdf.addPage([wPt, hPt], wPt >= hPt ? 'landscape' : 'portrait');
    pdf.addImage(url, url.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG', 0, 0, wPt, hPt, undefined, 'FAST');
    const notes = p.slides[list[k]].notes;
    if (o.includeNotes && notes) {
      pdf.addPage([wPt, hPt], wPt >= hPt ? 'landscape' : 'portrait');
      pdf.setFontSize(14);
      pdf.text(`Notes — slide ${list[k] + 1}`, 36, 40);
      pdf.setFontSize(11);
      pdf.text(pdf.splitTextToSize(notes, wPt - 72), 36, 64);
    }
  }
  o.onProgress?.(1, 'Writing PDF');
  return { blob: pdf.output('blob'), filename: `${safeFilename(p.title)}.pdf`, count: list.length };
}

/** Contract JSON (re-importable into SlideCraft). */
export function exportJsonFile(p: Presentation): { blob: Blob; filename: string } {
  return { blob: new Blob([presentationJsonSchemaSafe(p)], { type: 'application/json' }), filename: `${safeFilename(p.title)}.slidecraft.json` };
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** Self-contained single-file web presentation (rasterized slides, keyboard/click navigation, notes toggle, embedded contract JSON). */
export function buildHtmlPresentation(p: Presentation, slideImages: string[], slideIdx?: number[]): string {
  const idx = slideIdx ?? slideImages.map((_, i) => i);
  const notes = idx.map((i) => p.slides[i]?.notes ?? '');
  const json = presentationJsonSchemaSafe(p).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="${esc(p.language ?? 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title>
<style>html,body{margin:0;height:100%;background:#0b0b0f;color:#fff;font-family:system-ui,sans-serif;overflow:hidden}#s{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}#s img{max-width:100vw;max-height:100vh;box-shadow:0 20px 60px rgba(0,0,0,.5)}#bar{position:fixed;left:0;bottom:0;height:4px;background:#6366f1;transition:width .3s}#c{position:fixed;right:16px;bottom:12px;font-size:13px;opacity:.6}#n{position:fixed;left:0;right:0;bottom:0;max-height:30vh;overflow:auto;background:rgba(0,0,0,.85);padding:16px 24px;font-size:16px;line-height:1.5;display:none;white-space:pre-wrap}</style></head>
<body><div id="s"><img id="i" alt=""></div><div id="bar"></div><div id="c"></div><div id="n"></div>
<script type="application/json" id="slidecraft-data">${json}</script>
<script>const S=${JSON.stringify(slideImages)},N=${JSON.stringify(notes)};let k=0;const I=document.getElementById('i'),B=document.getElementById('bar'),C=document.getElementById('c'),T=document.getElementById('n');
function go(n){k=Math.max(0,Math.min(S.length-1,n));I.src=S[k];I.alt='Slide '+(k+1);B.style.width=((k+1)/S.length*100)+'%';C.textContent=(k+1)+' / '+S.length;T.textContent=N[k]||'(no notes)';location.hash=k+1}
addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' ','Enter'].includes(e.key))go(k+1);if(['ArrowLeft','PageUp','Backspace'].includes(e.key))go(k-1);if(e.key==='Home')go(0);if(e.key==='End')go(S.length-1);if(e.key==='n')T.style.display=T.style.display==='block'?'none':'block';if(e.key==='f')document.documentElement.requestFullscreen?.()});
document.getElementById('s').addEventListener('click',e=>go(e.clientX<innerWidth/3?k-1:k+1));go((parseInt(location.hash.slice(1))||1)-1);</script></body></html>`;
}

export async function exportHtml(p: Presentation, renderSlide: RenderSlide, o: RasterOptions = {}): Promise<{ blob: Blob; filename: string; count: number }> {
  const list = indices(p, o);
  const imgs: string[] = [];
  for (let k = 0; k < list.length; k++) {
    o.onProgress?.(k / list.length, `Rendering slide ${list[k] + 1}`);
    imgs.push(await snap(await renderSlide(list[k]), p, 'jpeg', o.scale ?? 1, o.quality ?? 0.9));
  }
  return { blob: new Blob([buildHtmlPresentation(p, imgs, list)], { type: 'text/html' }), filename: `${safeFilename(p.title)}.html`, count: imgs.length };
}

/** Rasterize an SVG string to a PNG data URL (used by the High Fidelity PPTX profile). */
export async function rasterizeSvg(svg: string, w: number, h: number): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('SVG decode failed')); i.src = url; });
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

/** Download a remote image as a data URL (via the SlideCraft proxy to avoid CORS). */
export async function fetchImageAsDataUrl(url: string, proxyBase = '/api/media/proxy?url='): Promise<string | null> {
  const read = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  const tryUrl = async (u: string) => { const r = await fetch(u); if (!r.ok) return null; const b = await r.blob(); return /^(image|video|audio)\//.test(b.type) ? read(b) : null; };
  try { const d = await tryUrl(url); if (d) return d; } catch { /* CORS — try the proxy */ }
  try { return /^https?:/.test(url) ? await tryUrl(proxyBase + encodeURIComponent(url)) : null; } catch { return null; }
}
