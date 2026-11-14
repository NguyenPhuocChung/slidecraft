import type { ImageRef, LayoutContent, Paragraph, SlideElement, Style, Theme } from '@/types/schema';
import { measureParagraphs, parseMarkdownLite } from '@/utils/richtext';
import { resolveFont } from '@/themes/themes';

export interface LayoutCtx {
  W: number;
  H: number;
  M: number; // outer margin
  G: number; // gutter
  theme: Theme;
  portrait: boolean;
  c: LayoutContent;
  els: SlideElement[];
  z: number;
}

/** Theme of the layout being built — lets measure() resolve "$heading" / "$body" to the real font. */
let measureTheme: Theme | null = null;

export function makeCtx(content: LayoutContent, theme: Theme, size: { width: number; height: number }): LayoutCtx {
  measureTheme = theme;
  const W = size.width, H = size.height;
  const scale = Math.min(W / 1920, H / 1080) || 1;
  return { W, H, M: Math.round(theme.spacing.margin * Math.max(0.7, scale)), G: Math.round(theme.grid.gutter * Math.max(0.8, scale)), theme, portrait: H > W, c: content, els: [], z: 1 };
}

function push(ctx: LayoutCtx, el: SlideElement): SlideElement {
  el.zIndex = ctx.z++;
  ctx.els.push(el);
  return el;
}

export type TextKind = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'eyebrow';

export function textStyle(ctx: LayoutCtx, kind: TextKind, extra: Style = {}): Style {
  const { theme } = ctx;
  const t = theme.typography;
  const fs = theme.fontScale;
  const heading = kind === 'display' || kind === 'h1' || kind === 'h2' || kind === 'h3';
  if (kind === 'eyebrow') {
    return { fontFamily: '$body', fontSize: Math.round(fs.caption * 1.05), fontWeight: 700, color: '$accent', letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1.2, ...extra };
  }
  if (heading) {
    return {
      fontFamily: '$heading', fontSize: fs[kind], fontWeight: t.headingWeight, color: '$text', lineHeight: t.headingLineHeight,
      letterSpacing: t.headingLetterSpacing * (fs[kind] / 80), textTransform: t.headingTransform === 'uppercase' ? 'uppercase' : undefined, ...extra,
    };
  }
  return { fontFamily: '$body', fontSize: fs[kind as 'body' | 'small' | 'caption'], fontWeight: t.bodyWeight, color: kind === 'body' ? '$textMuted' : '$textMuted', lineHeight: t.bodyLineHeight, paragraphSpacing: kind === 'body' ? 10 : 6, ...extra };
}

/** Measure text height for the given width + style. */
export function measure(text: string | Paragraph[], width: number, style: Style): number {
  const ps = typeof text === 'string' ? parseMarkdownLite(text) : text;
  const tr = style.textTransform === 'uppercase';
  const ps2 = tr ? ps.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, text: r.text.toUpperCase() })) })) : ps;
  const { height } = measureParagraphs(ps2, width, {
    fontSize: style.fontSize ?? 30,
    fontFamily: style.fontFamily?.startsWith('$') ? (measureTheme ? resolveFont(style.fontFamily, measureTheme) : undefined) : style.fontFamily,
    fontWeight: style.fontWeight, lineHeight: style.lineHeight ?? 1.3, paragraphSpacing: style.paragraphSpacing, letterSpacing: style.letterSpacing,
    padding: typeof style.padding === 'number' ? style.padding : 0,
  });
  return Math.ceil(height * 1.06 + 4);
}

/** Shrink font until text fits `maxLines` lines-ish height. */
export function fitFont(text: string, width: number, style: Style, maxHeight: number, minSize = 18): Style {
  let s = { ...style };
  let guard = 0;
  while (measure(text, width, s) > maxHeight && (s.fontSize ?? 30) > minSize && guard++ < 30) {
    s = { ...s, fontSize: Math.round((s.fontSize ?? 30) * 0.92) };
  }
  return s;
}

export function addText(ctx: LayoutCtx, id: string, kind: TextKind, text: string, x: number, y: number, w: number, opts: { style?: Style; maxHeight?: number; height?: number; type?: SlideElement['type'] } = {}): SlideElement {
  let style = textStyle(ctx, kind, opts.style);
  if (opts.maxHeight) style = fitFont(text, w, style, opts.maxHeight, kind === 'body' || kind === 'small' ? 18 : 28);
  const h = opts.height ?? measure(text, w, style);
  const type: SlideElement['type'] = opts.type ?? (kind === 'display' || kind === 'h1' || kind === 'h2' || kind === 'h3' ? 'heading' : kind === 'eyebrow' || kind === 'caption' ? 'text' : 'paragraph');
  return push(ctx, { id, type, x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.max(20, Math.round(h)), content: { text }, style });
}

export function addBullets(ctx: LayoutCtx, id: string, bullets: string[], x: number, y: number, w: number, opts: { style?: Style; maxHeight?: number; numbered?: boolean } = {}): SlideElement {
  const text = bullets.map((b, i) => (opts.numbered ? `${i + 1}. ${b}` : `- ${b}`)).join('\n');
  return addText(ctx, id, 'body', text, x, y, w, { style: { color: '$text', paragraphSpacing: 18, ...opts.style }, maxHeight: opts.maxHeight });
}

export function addImage(ctx: LayoutCtx, id: string, img: ImageRef | undefined, x: number, y: number, w: number, h: number, style: Style = {}): SlideElement | null {
  if (!img) return null;
  return push(ctx, { id, type: 'image', x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), content: { ...img }, style: { fit: 'cover', radius: ctx.theme.radius, ...style }, alt: img.alt });
}

export function addShape(ctx: LayoutCtx, id: string, shape: string, x: number, y: number, w: number, h: number, style: Style = {}, text?: string): SlideElement {
  return push(ctx, { id, type: 'shape', x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), content: { shape, ...(text ? { text } : {}) }, style });
}

export function addCard(ctx: LayoutCtx, id: string, x: number, y: number, w: number, h: number, style: Style = {}): SlideElement {
  const glass = ctx.theme.id === 'glassmorphism';
  return addShape(ctx, id, 'roundRect', x, y, w, h, {
    fill: '$surface', radius: ctx.theme.radius, stroke: glass || ctx.theme.shadow === 'none' ? { color: '$border', width: 2 } : undefined,
    shadow: ctx.theme.shadow === 'none' || glass ? undefined : { x: 0, y: 12, blur: 40, color: ctx.theme.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.10)' },
    blur: glass ? 24 : undefined, ...style,
  });
}

export function addAccentBar(ctx: LayoutCtx, id: string, x: number, y: number, w = 96, h = 10): SlideElement {
  return addShape(ctx, id, 'rect', x, y, w, h, { fill: '$accent', radius: h / 2 });
}

export function addEl(ctx: LayoutCtx, el: Omit<SlideElement, 'zIndex'>): SlideElement {
  return push(ctx, el as SlideElement);
}

export function addDecor(ctx: LayoutCtx, id: string, kind: string, x: number, y: number, w: number, h: number, colors?: string[], opacity = 1): SlideElement {
  return push(ctx, { id, type: 'decorative', x, y, width: w, height: h, opacity, content: { kind, colors: colors ?? ['$primary', '$accent'] }, locked: false });
}

/** Theme decor applied behind selected layouts so slides get rhythm but are not identical. */
export function themeDecor(ctx: LayoutCtx, variant: 'hero' | 'subtle' | 'corner' = 'subtle'): void {
  const { theme, W, H } = ctx;
  switch (theme.decor) {
    case 'orbs':
      if (variant === 'hero') { addDecor(ctx, 'decor-orb-1', 'orb', W * 0.58, -H * 0.25, W * 0.62, W * 0.62, ['$accent'], 0.55); addDecor(ctx, 'decor-orb-2', 'orb', -W * 0.12, H * 0.55, W * 0.4, W * 0.4, ['$primary'], 0.35); }
      else addDecor(ctx, 'decor-orb-1', 'orb', W * 0.78, -H * 0.2, W * 0.36, W * 0.36, ['$accent'], 0.3);
      break;
    case 'grid':
      addDecor(ctx, 'decor-grid', 'grid', 0, 0, W, H, ['$border'], variant === 'hero' ? 0.9 : 0.5);
      break;
    case 'lines':
      if (variant !== 'subtle') addDecor(ctx, 'decor-lines', 'lines', W * 0.72, 0, W * 0.28, H, ['$primary'], 0.12);
      break;
    case 'dots':
      addDecor(ctx, 'decor-dots', 'dots', W - 420, variant === 'hero' ? H - 360 : 40, 380, 320, ['$accent'], 0.35);
      break;
    case 'mesh':
      addDecor(ctx, 'decor-mesh', 'mesh', 0, 0, W, H, ['$accent', '$secondary'], variant === 'hero' ? 0.8 : 0.45);
      break;
    case 'frame':
      if (variant !== 'subtle') addDecor(ctx, 'decor-frame', 'corner', 36, 36, W - 72, H - 72, ['$primary'], 0.8);
      break;
    case 'noise':
      if (variant === 'hero') addDecor(ctx, 'decor-noise', 'noise', 0, 0, W, H, ['$text'], 0.08);
      break;
    default:
      break;
  }
}
