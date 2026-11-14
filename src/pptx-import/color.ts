/** DrawingML colors: srgbClr / schemeClr / sysClr / prstClr / hslClr / scrgbClr + modifiers. */
import { attr, kids, num, type XNode } from './xml';

export interface ThemeInfo {
  colors: Record<string, string>; // dk1 lt1 dk2 lt2 accent1..6 hlink folHlink → RRGGBB
  majorFont?: string;
  minorFont?: string;
  name?: string;
  /** bgFillStyleLst entries (for bgRef idx ≥ 1001) */
  bgFills: XNode[];
  /** fillStyleLst entries (for fillRef idx 1..3) */
  fills: XNode[];
  lines: XNode[];
}
/** Color map (master clrMap): bg1→lt1, tx1→dk1 … */
export type ClrMap = Record<string, string>;
export const DEFAULT_CLRMAP: ClrMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', accent1: 'accent1', accent2: 'accent2', accent3: 'accent3', accent4: 'accent4', accent5: 'accent5', accent6: 'accent6', hlink: 'hlink', folHlink: 'folHlink' };
export const DEFAULT_THEME_COLORS: Record<string, string> = {
  dk1: '000000', lt1: 'FFFFFF', dk2: '44546A', lt2: 'E7E6E6', accent1: '4472C4', accent2: 'ED7D31', accent3: 'A5A5A5', accent4: 'FFC000', accent5: '5B9BD5', accent6: '70AD47', hlink: '0563C1', folHlink: '954F72',
};

const PRESET: Record<string, string> = {
  black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080',
  darkGray: 'A9A9A9', lightGray: 'D3D3D3', darkBlue: '00008B', darkRed: '8B0000', darkGreen: '006400', navy: '000080', silver: 'C0C0C0', maroon: '800000', teal: '008080', cyan: '00FFFF', magenta: 'FF00FF', lime: '00FF00', pink: 'FFC0CB', brown: 'A52A2A', gold: 'FFD700',
};

export interface RGBA { r: number; g: number; b: number; a: number }

const hexToRgb = (h: string): RGBA => { const v = parseInt((h || '000000').replace('#', '').slice(0, 6).padEnd(6, '0'), 16); return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 1 }; };
const clamp = (v: number, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));

function rgbToHsl({ r, g, b }: RGBA): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number, a: number): RGBA {
  if (s === 0) { const v = Math.round(l * 255); return { r: v, g: v, b: v, a }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255), a };
}

function applyMods(c: RGBA, mods: XNode[]): RGBA {
  let out = { ...c };
  for (const m of mods) {
    const v = num(attr(m, 'val'), 100000) / 100000;
    switch (m.tag) {
      case 'alpha': out.a = clamp(v, 0, 1); break;
      case 'alphaMod': out.a = clamp(out.a * v, 0, 1); break;
      case 'alphaOff': out.a = clamp(out.a + v, 0, 1); break;
      case 'lumMod': case 'lumOff': case 'satMod': case 'satOff': case 'hueMod': case 'hueOff': {
        let [h, s, l] = rgbToHsl(out);
        if (m.tag === 'lumMod') l = clamp(l * v, 0, 1);
        if (m.tag === 'lumOff') l = clamp(l + v, 0, 1);
        if (m.tag === 'satMod') s = clamp(s * v, 0, 1);
        if (m.tag === 'satOff') s = clamp(s + v, 0, 1);
        if (m.tag === 'hueMod') h = (h * v) % 1;
        if (m.tag === 'hueOff') h = (h + num(attr(m, 'val')) / 21600000) % 1;
        out = hslToRgb(h, s, l, out.a);
        break;
      }
      case 'tint': out = { r: Math.round(out.r + (255 - out.r) * (1 - v)), g: Math.round(out.g + (255 - out.g) * (1 - v)), b: Math.round(out.b + (255 - out.b) * (1 - v)), a: out.a }; break;
      case 'shade': out = { r: Math.round(out.r * v), g: Math.round(out.g * v), b: Math.round(out.b * v), a: out.a }; break;
      case 'inv': out = { r: 255 - out.r, g: 255 - out.g, b: 255 - out.b, a: out.a }; break;
      case 'gray': { const y = Math.round(0.299 * out.r + 0.587 * out.g + 0.114 * out.b); out = { r: y, g: y, b: y, a: out.a }; break; }
      default: break;
    }
  }
  return out;
}

export interface ColorCtx { theme: ThemeInfo; clrMap: ClrMap; /** value for schemeClr phClr (style matrix placeholder color) */ phClr?: RGBA }

/** Resolve a color choice node (srgbClr, schemeClr …) to RGBA. */
export function colorNode(n: XNode | undefined, ctx: ColorCtx): RGBA | undefined {
  if (!n) return undefined;
  let base: RGBA | undefined;
  switch (n.tag) {
    case 'srgbClr': base = hexToRgb(attr(n, 'val') ?? '000000'); break;
    case 'sysClr': base = hexToRgb(attr(n, 'lastClr') ?? (attr(n, 'val') === 'window' ? 'FFFFFF' : '000000')); break;
    case 'prstClr': base = hexToRgb(PRESET[attr(n, 'val') ?? ''] ?? '000000'); break;
    case 'scrgbClr': base = { r: Math.round(clamp(num(attr(n, 'r')) / 100000, 0, 1) * 255), g: Math.round(clamp(num(attr(n, 'g')) / 100000, 0, 1) * 255), b: Math.round(clamp(num(attr(n, 'b')) / 100000, 0, 1) * 255), a: 1 }; break;
    case 'hslClr': base = hslToRgb(num(attr(n, 'hue')) / 21600000, num(attr(n, 'sat')) / 100000, num(attr(n, 'lum')) / 100000, 1); break;
    case 'schemeClr': {
      const v = attr(n, 'val') ?? 'tx1';
      if (v === 'phClr') { base = ctx.phClr ?? hexToRgb('000000'); break; }
      const key = ctx.clrMap[v] ?? v;
      base = hexToRgb(ctx.theme.colors[key] ?? DEFAULT_THEME_COLORS[key] ?? '000000');
      break;
    }
    default: return undefined;
  }
  return applyMods(base, kids(n));
}

/** First color child of a container (solidFill, gs, …). */
export function colorIn(container: XNode | undefined, ctx: ColorCtx): RGBA | undefined {
  for (const c of kids(container)) { const v = colorNode(c, ctx); if (v) return v; }
  return undefined;
}

export const hex = (c: RGBA): string => '#' + [c.r, c.g, c.b].map((v) => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
/** CSS color: #RRGGBB, or rgba() when translucent. */
export const css = (c: RGBA | undefined): string | undefined => (!c ? undefined : c.a >= 0.999 ? hex(c) : `rgba(${c.r},${c.g},${c.b},${+c.a.toFixed(3)})`);
export const luminance = (c: RGBA): number => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;

export function parseTheme(root: XNode | undefined): ThemeInfo {
  const t: ThemeInfo = { colors: { ...DEFAULT_THEME_COLORS }, bgFills: [], fills: [], lines: [] };
  if (!root) return t;
  t.name = attr(root, 'name');
  const el = kids(root).find((k) => k.tag === 'themeElements');
  const scheme = kids(el).find((k) => k.tag === 'clrScheme');
  for (const c of kids(scheme)) {
    const v = kids(c)[0];
    if (!v) continue;
    const rgb = v.tag === 'srgbClr' ? attr(v, 'val') : v.tag === 'sysClr' ? attr(v, 'lastClr') ?? (attr(v, 'val') === 'window' ? 'FFFFFF' : '000000') : undefined;
    if (rgb) t.colors[c.tag] = rgb.toUpperCase();
  }
  const fonts = kids(el).find((k) => k.tag === 'fontScheme');
  const major = kids(fonts).find((k) => k.tag === 'majorFont');
  const minor = kids(fonts).find((k) => k.tag === 'minorFont');
  t.majorFont = attr(kids(major).find((k) => k.tag === 'latin'), 'typeface') || undefined;
  t.minorFont = attr(kids(minor).find((k) => k.tag === 'latin'), 'typeface') || undefined;
  const fmt = kids(el).find((k) => k.tag === 'fmtScheme');
  t.fills = kids(kids(fmt).find((k) => k.tag === 'fillStyleLst'));
  t.lines = kids(kids(fmt).find((k) => k.tag === 'lnStyleLst'));
  t.bgFills = kids(kids(fmt).find((k) => k.tag === 'bgFillStyleLst'));
  return t;
}

/** Resolve theme font references (+mj-lt, +mn-lt …). */
export function resolveTypeface(face: string | undefined, theme: ThemeInfo): string | undefined {
  if (!face) return undefined;
  if (face.startsWith('+mj')) return theme.majorFont;
  if (face.startsWith('+mn')) return theme.minorFont;
  return face;
}
