import DOMPurify from 'dompurify';

const DANGEROUS = /^\s*(javascript|vbscript|file|data:text\/html|data:application)/i;

/** Allow only https/http, data:image/*, data:audio|video/*, blob:, asset: and relative /samples paths. */
export function isSafeUrl(url: unknown, kind: 'image' | 'media' | 'link' = 'image'): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const u = url.trim();
  if (DANGEROUS.test(u)) return false;
  if (u.startsWith('asset:')) return true;
  if (u.startsWith('blob:')) return true;
  if (/^https?:\/\//i.test(u)) return u.length < 4096;
  if (u.startsWith('/') && !u.startsWith('//')) return true;
  if (kind === 'image' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif);/i.test(u)) return true;
  if (kind === 'media' && /^data:(audio|video)\//i.test(u)) return true;
  if (kind === 'link' && /^mailto:/i.test(u)) return true;
  return false;
}

let purifier: ReturnType<typeof DOMPurify> | null = null;
function getPurifier(): ReturnType<typeof DOMPurify> | null {
  if (purifier) return purifier;
  if (typeof window === 'undefined') return null;
  purifier = DOMPurify(window);
  return purifier;
}

/** Sanitize inline SVG markup: no scripts, event handlers, foreignObject or external refs. */
export function sanitizeSvg(markup: string): string {
  const p = getPurifier();
  if (!p) {
    // Non-DOM environments (tests/server): conservative regex strip.
    return markup
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  }
  return p.sanitize(markup, { USE_PROFILES: { svg: true, svgFilters: true }, FORBID_TAGS: ['foreignObject', 'script'], FORBID_ATTR: ['onload', 'onerror', 'onclick'] }) as string;
}

export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_SLIDES = 1000;
export const MAX_ELEMENTS_PER_SLIDE = 500;
