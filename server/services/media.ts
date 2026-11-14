/** Image search across licensed providers via official APIs (no scraping). */
import type { AppConfig } from '../config';

export type Provider = 'unsplash' | 'pexels' | 'pixabay' | 'openverse' | 'wikimedia';
export interface MediaResult {
  id: string; provider: Provider; url: string; thumb: string; width?: number; height?: number;
  alt?: string; credit?: string; license?: string; sourceUrl?: string; color?: string;
}
export const PROVIDER_ORDER: Provider[] = ['unsplash', 'pexels', 'pixabay', 'openverse', 'wikimedia'];
const TIMEOUT = 6000;
const UA = 'SlideCraft/1.0 (presentation image search)';

class LRU<V> {
  private m = new Map<string, { v: V; at: number }>();
  constructor(private max = 300, private ttl = 3600_000) {}
  get(k: string): V | undefined {
    const e = this.m.get(k);
    if (!e) return undefined;
    if (Date.now() - e.at > this.ttl) { this.m.delete(k); return undefined; }
    this.m.delete(k); this.m.set(k, e);
    return e.v;
  }
  set(k: string, v: V) { this.m.delete(k); this.m.set(k, { v, at: Date.now() }); if (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string); }
  clear() { this.m.clear(); }
}
export const mediaCache = new LRU<MediaResult[]>();

async function getJson(url: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as Record<string, unknown>;
  } catch (e) {
    throw new Error((e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message);
  } finally { clearTimeout(t); }
}
const stripHtml = (s: unknown) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : undefined);

type Opts = { orientation?: string; page: number; keys: AppConfig['keys'] };
/* eslint-disable @typescript-eslint/no-explicit-any */
const searchers: Record<Provider, (q: string, o: Opts) => Promise<MediaResult[]>> = {
  async unsplash(q, o) {
    const j: any = await getJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&page=${o.page}${o.orientation ? `&orientation=${o.orientation}` : ''}&content_filter=high`, { Authorization: `Client-ID ${o.keys.unsplash}`, 'Accept-Version': 'v1' });
    return (j.results ?? []).map((x: any) => ({ id: `unsplash-${x.id}`, provider: 'unsplash', url: `${x.urls.raw}&w=2000&q=80&fm=jpg`, thumb: x.urls.small, width: x.width, height: x.height, alt: x.alt_description ?? x.description ?? q, credit: `Photo by ${x.user?.name} on Unsplash`, license: 'Unsplash License', sourceUrl: x.links?.html, color: x.color }));
  },
  async pexels(q, o) {
    const j: any = await getJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&page=${o.page}${o.orientation ? `&orientation=${o.orientation === 'squarish' ? 'square' : o.orientation}` : ''}`, { Authorization: String(o.keys.pexels) });
    return (j.photos ?? []).map((x: any) => ({ id: `pexels-${x.id}`, provider: 'pexels', url: x.src.large2x, thumb: x.src.medium, width: x.width, height: x.height, alt: x.alt || q, credit: `Photo by ${x.photographer} on Pexels`, license: 'Pexels License', sourceUrl: x.url, color: x.avg_color }));
  },
  async pixabay(q, o) {
    const j: any = await getJson(`https://pixabay.com/api/?key=${encodeURIComponent(String(o.keys.pixabay))}&q=${encodeURIComponent(q)}&per_page=12&page=${o.page}&image_type=photo&safesearch=true${o.orientation === 'landscape' ? '&orientation=horizontal' : o.orientation === 'portrait' ? '&orientation=vertical' : ''}`);
    return (j.hits ?? []).map((x: any) => ({ id: `pixabay-${x.id}`, provider: 'pixabay', url: x.largeImageURL, thumb: x.webformatURL, width: x.imageWidth, height: x.imageHeight, alt: x.tags || q, credit: `Image by ${x.user} on Pixabay`, license: 'Pixabay Content License', sourceUrl: x.pageURL }));
  },
  async openverse(q, o) {
    const ar = o.orientation === 'landscape' ? '&aspect_ratio=wide' : o.orientation === 'portrait' ? '&aspect_ratio=tall' : o.orientation === 'squarish' ? '&aspect_ratio=square' : '';
    const j: any = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=12&page=${o.page}&mature=false${ar}`);
    return (j.results ?? []).map((x: any) => ({ id: `openverse-${x.id}`, provider: 'openverse', url: x.url, thumb: x.thumbnail ?? x.url, width: x.width ?? undefined, height: x.height ?? undefined, alt: x.title || q, credit: `${x.creator ?? 'Unknown'} via ${x.source ?? 'Openverse'}`, license: `CC ${String(x.license ?? '').toUpperCase()} ${x.license_version ?? ''}`.trim(), sourceUrl: x.foreign_landing_url }));
  },
  async wikimedia(q, o) {
    const j: any = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsroffset=${(o.page - 1) * 12}&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600`);
    const pages = Object.values(j.query?.pages ?? {}) as any[];
    return pages.filter((p) => p.imageinfo?.[0]).map((p) => {
      const ii = p.imageinfo[0]; const md = ii.extmetadata ?? {};
      return { id: `wikimedia-${p.pageid}`, provider: 'wikimedia', url: ii.thumburl ?? ii.url, thumb: ii.thumburl ?? ii.url, width: ii.thumbwidth ?? ii.width, height: ii.thumbheight ?? ii.height, alt: stripHtml(md.ImageDescription?.value) ?? String(p.title).replace(/^File:/, ''), credit: `${stripHtml(md.Artist?.value) ?? 'Unknown'} via Wikimedia Commons`, license: stripHtml(md.LicenseShortName?.value), sourceUrl: ii.descriptionurl } as MediaResult;
    });
  },
};

export function configuredProviders(keys: AppConfig['keys']): Record<Provider, boolean> {
  return { unsplash: !!keys.unsplash, pexels: !!keys.pexels, pixabay: !!keys.pixabay, openverse: true, wikimedia: true };
}

export async function searchMedia(q: string, opts: { orientation?: string; provider?: Provider; page?: number }, keys: AppConfig['keys']): Promise<{ results: MediaResult[]; errors: string[] }> {
  const page = opts.page ?? 1;
  const conf = configuredProviders(keys);
  const list = opts.provider ? [opts.provider] : PROVIDER_ORDER;
  const errors: string[] = [];
  for (const p of list) {
    if (!conf[p]) { if (opts.provider) errors.push(`${p}: API key not configured`); continue; }
    const key = `${p}|${q.toLowerCase()}|${opts.orientation ?? ''}|${page}`;
    const hit = mediaCache.get(key);
    if (hit) { if (hit.length) return { results: hit, errors }; continue; }
    try {
      const res = (await searchers[p](q, { orientation: opts.orientation || undefined, page, keys })).filter((r) => /^https:\/\//.test(r.url));
      mediaCache.set(key, res);
      if (res.length) return { results: res, errors };
    } catch (e) {
      errors.push(`${p}: ${(e as Error).message}`);
    }
  }
  return { results: [], errors };
}
