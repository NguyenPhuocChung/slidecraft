import { PX_PER_INCH } from '@/types/registry';
import type { Theme } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { alphaOf, toHex6 } from '@/utils/color';

/** logical px → inches */
export const inch = (px: number) => Math.round((px / PX_PER_INCH) * 10000) / 10000;
/** logical px → points (font sizes, line widths) */
export const pt = (px: number) => Math.round(((px * 72) / PX_PER_INCH) * 100) / 100;
/** logical px → EMU */
export const emu = (px: number) => Math.round((px / PX_PER_INCH) * 914400);

/** Theme-resolved color → { hex, transparency 0–100 } for pptxgenjs */
export function color(value: string | undefined, theme: Theme, fallback = '000000'): { hex: string; transparency: number } | null {
  if (!value) return null;
  const c = resolveColor(value, theme, '');
  if (!c || c === 'transparent' || c === 'none') return null;
  const a = alphaOf(c);
  if (a <= 0.001) return null;
  return { hex: toHex6(c, fallback), transparency: Math.round((1 - a) * 100) };
}

export const xmlEsc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

/** Object names must be stable, XML-safe and unique per slide. */
export const safeName = (s: string) => s.replace(/[^\w!:./-]/g, '_').slice(0, 120);

/** Natural pixel size of a PNG/JPEG/GIF/WebP data URL (no DOM). */
export function imageSize(dataUrl: string): { w: number; h: number } | null {
  const m = /^data:image\/[\w+.-]+;base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  let bytes: Uint8Array;
  try {
    const bin = typeof atob === 'function' ? atob(m[1].slice(0, 200000)) : Buffer.from(m[1].slice(0, 200000), 'base64').toString('binary');
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return null; }
  const u16 = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const u32 = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { w: u32(16), h: u32(20) };
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return { w: bytes[6] | (bytes[7] << 8), h: bytes[8] | (bytes[9] << 8) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: u16(i + 5), w: u16(i + 7) };
      i += 2 + u16(i + 2);
    }
    return null;
  }
  if (bytes[0] === 0x52 && bytes[8] === 0x57) {
    const tag = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (tag === 'VP8X') return { w: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), h: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (tag === 'VP8 ') return { w: (bytes[26] | (bytes[27] << 8)) & 0x3fff, h: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (tag === 'VP8L') { const b = bytes.slice(21, 25); return { w: 1 + (((b[1] & 0x3f) << 8) | b[0]), h: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) }; }
  }
  return null;
}

export function svgDataUrl(svg: string): string {
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(svg))) : Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

export const isNode = typeof window === 'undefined' || typeof document === 'undefined';
