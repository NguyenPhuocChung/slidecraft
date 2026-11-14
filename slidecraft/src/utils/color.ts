import { hexToRgb } from '@/themes/themes';

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500',
  purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080', navy: '#000080', teal: '#008080', gold: '#ffd700',
  silver: '#c0c0c0', maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', magenta: '#ff00ff',
  fuchsia: '#ff00ff', indigo: '#4b0082', violet: '#ee82ee', brown: '#a52a2a', coral: '#ff7f50', crimson: '#dc143c', salmon: '#fa8072',
  transparent: '#00000000',
};

export interface RGBA { r: number; g: number; b: number; a: number }

/** Parse #hex, rgb(), rgba(), hsl() or a named color. Returns null when unparseable. */
export function parseColor(input: string | undefined | null): RGBA | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (NAMED[v]) return hexToRgb(NAMED[v]);
  if (v.startsWith('#')) return hexToRgb(v);
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    const f = (n: number) => { const k = (n + h * 12) % 12; const c = s * Math.min(l, 1 - l); return l - c * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a };
  }
  return null;
}

export function isValidColor(input: string): boolean {
  return input.startsWith('$') || parseColor(input) !== null || /gradient\(/.test(input);
}

export function toHex6(input: string | undefined, fallback = '000000'): string {
  const c = parseColor(input ?? '');
  if (!c) return fallback;
  return [c.r, c.g, c.b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function alphaOf(input: string | undefined): number {
  return parseColor(input ?? '')?.a ?? 1;
}
export function withAlpha(input: string, alpha: number): string {
  const c = parseColor(input);
  if (!c) return input;
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function lum(c: RGBA): number {
  const ch = [c.r, c.g, c.b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
/** WCAG contrast ratio, 1–21. Alpha is composited over `over` (default white). */
export function contrastRatio(fg: string, bg: string, over = '#ffffff'): number {
  const base = parseColor(over) ?? { r: 255, g: 255, b: 255, a: 1 };
  const comp = (c: RGBA | null, under: RGBA): RGBA => c ? { r: c.r * c.a + under.r * (1 - c.a), g: c.g * c.a + under.g * (1 - c.a), b: c.b * c.a + under.b * (1 - c.a), a: 1 } : under;
  const b = comp(parseColor(bg), base);
  const f = comp(parseColor(fg), b);
  const L1 = lum(f), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
export function isDark(color: string): boolean {
  const c = parseColor(color);
  if (!c) return false;
  return lum(c) < 0.4;
}
export function readableOn(bg: string, light = '#ffffff', dark = '#0f172a'): string {
  return contrastRatio(light, bg) >= contrastRatio(dark, bg) ? light : dark;
}
