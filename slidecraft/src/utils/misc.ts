export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
export function deepClone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: A) => { if (t) clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a: A) => { if (t) clearTimeout(t); fn(...a); };
  return d;
}
export function formatNumber(v: number | null | undefined, opts: { prefix?: string; suffix?: string; decimals?: number } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  const d = opts.decimals ?? (Math.abs(v) >= 100 || Number.isInteger(v) ? 0 : 1);
  let s: string;
  const abs = Math.abs(v);
  if (opts.decimals === undefined && abs >= 1e9) s = (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  else if (opts.decimals === undefined && abs >= 1e6) s = (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  else if (opts.decimals === undefined && abs >= 1e4) s = (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  else s = v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (s.startsWith('-') && opts.prefix) return `-${opts.prefix}${s.slice(1)}${opts.suffix ?? ''}`;
  return `${opts.prefix ?? ''}${s}${opts.suffix ?? ''}`;
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export function safeFilename(name: string) {
  return (name || 'presentation').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'presentation';
}
