/** Media Library: validated uploads, image optimization, reusable cross-project asset library. */
import { createStore, get, set } from 'idb-keyval';
import type { Asset } from '@/types/schema';
import { sanitizeSvg } from '@/code-parser/security';
import { uid } from '@/utils/id';

const store = typeof indexedDB !== 'undefined' ? createStore('slidecraft-media', 'assets') : undefined;
const MAX_BYTES: Record<Asset['type'], number> = { image: 15e6, svg: 2e6, video: 40e6, audio: 20e6, font: 5e6 };
const ACCEPT: Record<string, Asset['type']> = {
  'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image', 'image/avif': 'image', 'image/svg+xml': 'svg',
  'video/mp4': 'video', 'video/webm': 'video', 'audio/mpeg': 'audio', 'audio/mp3': 'audio', 'audio/wav': 'audio', 'audio/x-wav': 'audio', 'audio/ogg': 'audio',
};
export const ACCEPT_ATTR = Object.keys(ACCEPT).join(',');

const readAsDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const readAsText = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsText(b); });

async function sniff(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const hex = Array.from(head).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'image/webp';
  if (hex.slice(8, 24).includes('66747970')) return file.type.startsWith('image/avif') ? 'image/avif' : 'video/mp4';
  if (hex.startsWith('1a45dfa3')) return 'video/webm';
  if (hex.startsWith('494433') || hex.startsWith('fffb') || hex.startsWith('fff3')) return 'audio/mpeg';
  if (hex.startsWith('52494646') && hex.slice(16, 24) === '57415645') return 'audio/wav';
  if (hex.startsWith('4f676753')) return 'audio/ogg';
  return null;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image could not be decoded')); i.src = src; });
}

/** Downscale very large raster images (keeps aspect ratio, never upscales). */
async function optimize(dataUrl: string, mime: string, maxSide = 2560): Promise<{ src: string; width: number; height: number; mime: string }> {
  const img = await loadImage(dataUrl);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (Math.max(w, h) <= maxSide || mime === 'image/gif') return { src: dataUrl, width: w, height: h, mime };
  const k = maxSide / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const outMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  return { src: c.toDataURL(outMime, 0.9), width: c.width, height: c.height, mime: outMime };
}

export async function fileToAsset(file: File): Promise<Asset> {
  const declared = file.type || '';
  let mime = declared;
  if (declared !== 'image/svg+xml') {
    const sniffed = await sniff(file);
    if (!sniffed) throw new Error(`"${file.name}" is not a supported image, video or audio file.`);
    if (declared && sniffed.split('/')[0] !== declared.split('/')[0]) throw new Error(`"${file.name}" content does not match its type (${declared}).`);
    mime = sniffed;
  }
  const type = ACCEPT[mime];
  if (!type) throw new Error(`Unsupported file type: ${mime || file.name}`);
  if (file.size > MAX_BYTES[type]) throw new Error(`"${file.name}" is too large (${(file.size / 1e6).toFixed(1)} MB, max ${MAX_BYTES[type] / 1e6} MB).`);
  if (type === 'svg') {
    const raw = await readAsText(file);
    if (!/<svg[\s>]/i.test(raw)) throw new Error('SVG file has no <svg> root.');
    const clean = sanitizeSvg(raw);
    return { id: uid('asset'), type: 'svg', src: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clean)))}`, name: file.name, mime, size: clean.length };
  }
  const dataUrl = await readAsDataUrl(file);
  if (type === 'image') {
    const o = await optimize(dataUrl, mime);
    return { id: uid('asset'), type, src: o.src, name: file.name, mime: o.mime, width: o.width, height: o.height, size: Math.round(o.src.length * 0.75), license: 'Uploaded by user' };
  }
  return { id: uid('asset'), type, src: dataUrl, name: file.name, mime, size: file.size };
}

export const library = {
  async list(): Promise<Asset[]> { return store ? ((await get<Asset[]>('library', store)) ?? []) : []; },
  async add(a: Asset): Promise<void> { if (!store) return; const l = await this.list(); await set('library', [a, ...l.filter((x) => x.id !== a.id)].slice(0, 300), store); },
  async remove(id: string): Promise<void> { if (!store) return; const l = await this.list(); await set('library', l.filter((x) => x.id !== id), store); },
};
