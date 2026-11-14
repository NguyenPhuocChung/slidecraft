/**
 * Media Intelligence: resolves image intents (`query`) to real, licensed images
 * through the SlideCraft API (Unsplash / Pexels / Pixabay with server-side keys,
 * Openverse and Wikimedia Commons without keys). Results are cached; failures fall
 * back to a designed placeholder — never to a random or fake URL.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { Asset, ImageRef } from '@/types/schema';
import { isSafeUrl } from '@/code-parser/security';
import { api } from '@/services/api';

export interface MediaResult {
  id: string;
  provider: 'unsplash' | 'pexels' | 'pixabay' | 'openverse' | 'wikimedia' | 'upload';
  url: string; // full-size (≤ 2000px)
  thumb: string;
  width?: number;
  height?: number;
  alt?: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
  color?: string;
}

interface MediaState {
  cache: Record<string, MediaResult | null>; // query → best result (null = no result)
  pending: Record<string, boolean>;
  broken: Record<string, boolean>; // url → failed to load
  set: (q: string, r: MediaResult | null) => void;
  markBroken: (url: string) => void;
}
export const useMediaStore = create<MediaState>((set) => ({
  cache: loadCache(),
  pending: {},
  broken: {},
  set: (q, r) => set((s) => { const cache = { ...s.cache, [q]: r }; saveCache(cache); return { cache, pending: { ...s.pending, [q]: false } }; }),
  markBroken: (url) => set((s) => ({ broken: { ...s.broken, [url]: true } })),
}));

function loadCache(): Record<string, MediaResult | null> {
  try { return JSON.parse(localStorage.getItem('slidecraft.mediaCache') ?? '{}'); } catch { return {}; }
}
function saveCache(c: Record<string, MediaResult | null>) {
  try {
    const entries = Object.entries(c).filter(([, v]) => v).slice(-300);
    localStorage.setItem('slidecraft.mediaCache', JSON.stringify(Object.fromEntries(entries)));
  } catch { /* storage full or unavailable */ }
}

export const PROVIDERS = ['unsplash', 'pexels', 'pixabay', 'openverse', 'wikimedia'] as const;

/** Search images through the backend; falls back to browser-side Openverse/Wikimedia when the API is offline. */
export async function searchImages(query: string, opts: { orientation?: 'landscape' | 'portrait' | 'squarish'; provider?: string; page?: number } = {}): Promise<{ results: MediaResult[]; errors: string[] }> {
  const errors: string[] = [];
  try {
    const r = await api.get<{ results: MediaResult[]; errors?: string[] }>(`/media/search?q=${encodeURIComponent(query)}&orientation=${opts.orientation ?? ''}&provider=${opts.provider ?? ''}&page=${opts.page ?? 1}`);
    if (r.results.length) return { results: r.results, errors: r.errors ?? [] };
    errors.push(...(r.errors ?? []));
  } catch (e) {
    errors.push(`SlideCraft API: ${(e as Error).message}`);
  }
  // Browser fallback: Openverse (CORS-enabled, CC licensed)
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12${opts.orientation === 'landscape' ? '&aspect_ratio=wide' : opts.orientation === 'portrait' ? '&aspect_ratio=tall' : ''}`);
    if (res.ok) {
      const j = await res.json();
      const results: MediaResult[] = (j.results ?? []).map((x: Record<string, string | number>) => ({
        id: String(x.id), provider: 'openverse', url: String(x.url), thumb: String(x.thumbnail ?? x.url), width: Number(x.width) || undefined, height: Number(x.height) || undefined,
        alt: String(x.title ?? query), credit: `${x.creator ?? 'Unknown'} / ${x.source ?? 'Openverse'}`, license: `CC ${String(x.license ?? '').toUpperCase()} ${x.license_version ?? ''}`.trim(), sourceUrl: String(x.foreign_landing_url ?? ''),
      }));
      if (results.length) return { results, errors };
    } else errors.push(`Openverse: HTTP ${res.status}`);
  } catch (e) {
    errors.push(`Openverse: ${(e as Error).message}`);
  }
  return { results: [], errors };
}

/** Build a context-aware query: image intent + slide topic, without inventing subjects. */
export function smartQuery(ref: ImageRef, context?: { heading?: string; theme?: string }): string {
  const base = (ref.query ?? ref.alt ?? '').trim();
  if (base.split(/\s+/).length >= 3 || !context?.heading) return base || context?.heading || 'abstract background';
  return `${base} ${context.heading}`.trim().slice(0, 100);
}

const inflight = new Map<string, Promise<void>>();
export function resolveQuery(q: string, orientation?: 'landscape' | 'portrait' | 'squarish') {
  const st = useMediaStore.getState();
  if (q in st.cache || inflight.has(q)) return;
  useMediaStore.setState((s) => ({ pending: { ...s.pending, [q]: true } }));
  const p = searchImages(q, { orientation }).then(({ results }) => {
    // prefer images matching the orientation and large enough
    const sorted = [...results].sort((a, b) => score(b, orientation) - score(a, orientation));
    useMediaStore.getState().set(q, sorted[0] ?? null);
  }).catch(() => useMediaStore.getState().set(q, null)).finally(() => inflight.delete(q));
  inflight.set(q, p);
}
function score(r: MediaResult, o?: string): number {
  const ar = r.width && r.height ? r.width / r.height : 1.5;
  const fit = o === 'portrait' ? (ar < 1 ? 2 : 0) : o === 'squarish' ? (Math.abs(ar - 1) < 0.3 ? 2 : 0) : ar > 1.2 ? 2 : 0;
  return fit + (r.width && r.width >= 1200 ? 1 : 0);
}

export function assetSrc(src: string | undefined, assets: Asset[] | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith('asset:')) return assets?.find((a) => a.id === src.slice(6))?.src;
  return src;
}

/** React hook: returns a displayable URL for an image ref (or null → placeholder). */
export function useImageSrc(ref: ImageRef | undefined, assets: Asset[] | undefined, w = 16, h = 9): { src: string | null; loading: boolean; credit?: string; result?: MediaResult } {
  const direct = assetSrc(ref?.src, assets);
  const q = !direct && ref?.query ? ref.query : undefined;
  const cached = useMediaStore((s) => (q ? s.cache[q] : undefined));
  const pending = useMediaStore((s) => (q ? !!s.pending[q] : false));
  const broken = useMediaStore((s) => (direct ? !!s.broken[direct] : false));
  const [, force] = useState(0);
  useEffect(() => {
    if (q && cached === undefined) resolveQuery(q, w / h > 1.2 ? 'landscape' : w / h < 0.83 ? 'portrait' : 'squarish');
    else force((n) => n + 1);
  }, [q, cached, w, h]);
  if (direct) return { src: broken || !isSafeUrl(direct) ? null : direct, loading: false };
  if (cached) return { src: cached.url, loading: false, credit: cached.credit, result: cached };
  return { src: null, loading: pending };
}
