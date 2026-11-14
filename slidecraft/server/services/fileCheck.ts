/** Upload validation: magic bytes for raster/media, SVG safety scan, image dimensions. */
export type AssetKind = 'image' | 'svg' | 'video' | 'audio';
export const ALLOWED: Record<string, { kind: AssetKind; ext: string }> = {
  'image/png': { kind: 'image', ext: 'png' }, 'image/jpeg': { kind: 'image', ext: 'jpg' }, 'image/webp': { kind: 'image', ext: 'webp' }, 'image/gif': { kind: 'image', ext: 'gif' },
  'image/svg+xml': { kind: 'svg', ext: 'svg' }, 'video/mp4': { kind: 'video', ext: 'mp4' }, 'video/webm': { kind: 'video', ext: 'webm' },
  'audio/mpeg': { kind: 'audio', ext: 'mp3' }, 'audio/wav': { kind: 'audio', ext: 'wav' }, 'audio/x-wav': { kind: 'audio', ext: 'wav' }, 'audio/ogg': { kind: 'audio', ext: 'ogg' },
};
const starts = (b: Buffer, sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
const ascii = (b: Buffer, s: string, off = 0) => b.subarray(off, off + s.length).toString('latin1') === s;

export function magicMatches(mime: string, b: Buffer): boolean {
  switch (mime) {
    case 'image/png': return starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg': return starts(b, [0xff, 0xd8, 0xff]);
    case 'image/gif': return ascii(b, 'GIF87a') || ascii(b, 'GIF89a');
    case 'image/webp': return ascii(b, 'RIFF') && ascii(b, 'WEBP', 8);
    case 'video/mp4': return ascii(b, 'ftyp', 4);
    case 'video/webm': return starts(b, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'audio/mpeg': return ascii(b, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case 'audio/wav': case 'audio/x-wav': return ascii(b, 'RIFF') && ascii(b, 'WAVE', 8);
    case 'audio/ogg': return ascii(b, 'OggS');
    case 'image/svg+xml': return /<svg[\s>]/i.test(b.subarray(0, 4096).toString('utf8'));
    default: return false;
  }
}

export function svgIsSafe(text: string): boolean {
  return !/<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|<!ENTITY|xlink:href\s*=\s*["']\s*(?!#)|href\s*=\s*["']\s*(?:https?:|data:|\/\/)/i.test(text);
}

export function imageSize(mime: string, b: Buffer): { width?: number; height?: number } {
  try {
    if (mime === 'image/png') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (mime === 'image/gif') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* ignore */ }
  return {};
}
