/**
 * Layout Intelligence Engine.
 * Each layout turns slot-based `content` into positioned, fully editable elements.
 * Layouts declare the slots they render so the engine can (a) rank layouts for a
 * given content shape and (b) warn before any slot would become invisible.
 */
import type { Background, LayoutContent, SlideElement, Theme } from '@/types/schema';
import { textWidth } from '@/utils/richtext';
import {
  addAccentBar, addBullets, addCard, addDecor, addEl, addImage, addShape, addText, LayoutCtx, makeCtx, measure, textStyle, themeDecor,
} from './builders';

export type Slot = keyof LayoutContent;
export interface LayoutDef {
  id: string;
  name: string;
  category: 'Opening' | 'Text' | 'Image' | 'Data' | 'Story' | 'Structure' | 'Closing';
  description: string;
  slots: Slot[];
  /** Score 0–100 for how well the layout suits the content. */
  score: (f: ContentFeatures) => number;
  build: (ctx: LayoutCtx) => { background?: Background } | void;
}

export interface ContentFeatures {
  hasHeading: boolean; hasSub: boolean; bodyLen: number; bullets: number; images: number; stats: number; items: number; columns: number;
  quote: boolean; chart: boolean; table: boolean; timeline: boolean; diagram: boolean; code: boolean; formula: boolean; beforeAfter: boolean; number: boolean;
}
export function features(c: LayoutContent): ContentFeatures {
  return {
    hasHeading: !!c.heading, hasSub: !!c.subheading, bodyLen: (c.body ?? '').length, bullets: c.bullets?.length ?? 0,
    images: (c.image ? 1 : 0) + (c.images?.length ?? 0), stats: c.stats?.length ?? 0, items: c.items?.length ?? 0, columns: c.columns?.length ?? 0,
    quote: !!c.quote, chart: !!c.chart, table: !!c.table, timeline: !!c.timeline, diagram: !!c.diagram, code: !!c.code, formula: !!c.formula,
    beforeAfter: !!(c.before && c.after), number: !!c.number,
  };
}
const richness = (f: ContentFeatures) => f.bullets + f.stats + f.items + f.columns + f.images + (f.chart ? 3 : 0) + (f.table ? 3 : 0) + (f.timeline ? 3 : 0) + (f.diagram ? 3 : 0) + (f.quote ? 2 : 0) + (f.code ? 3 : 0);

/* ------------------------------ helpers ------------------------------ */
interface HeaderOpts { align?: 'left' | 'center'; kind?: 'display' | 'h1' | 'h2' | 'h3'; maxHeadingH?: number; color?: string; mutedColor?: string; sub?: boolean }
function header(ctx: LayoutCtx, x: number, y: number, w: number, o: HeaderOpts = {}): number {
  const { c } = ctx;
  const align = o.align ?? 'left';
  let cy = y;
  if (c.eyebrow) {
    const el = addText(ctx, 'eyebrow', 'eyebrow', c.eyebrow, x, cy, w, { style: { align } });
    cy += el.height + 18;
  }
  if (c.heading) {
    const el = addText(ctx, 'heading', o.kind ?? 'h2', c.heading, x, cy, w, { style: { align, ...(o.color ? { color: o.color } : {}) }, maxHeight: o.maxHeadingH ?? 260 });
    cy += el.height + 20;
  }
  if (c.subheading && o.sub !== false) {
    const el = addText(ctx, 'subheading', 'body', c.subheading, x, cy, w, { style: { align, fontSize: ctx.theme.fontScale.body * 1.08, ...(o.mutedColor ? { color: o.mutedColor } : {}) }, maxHeight: 160 });
    cy += el.height + 12;
  }
  return cy;
}
function bodyAndBullets(ctx: LayoutCtx, x: number, y: number, w: number, maxH: number, color?: string): number {
  const { c } = ctx;
  let cy = y;
  if (c.body) {
    const el = addText(ctx, 'body', 'body', c.body, x, cy, w, { maxHeight: c.bullets?.length ? maxH * 0.45 : maxH, style: color ? { color } : {} });
    cy += el.height + 24;
  }
  if (c.bullets?.length) {
    const el = addBullets(ctx, 'bullets', c.bullets, x, cy, w, { maxHeight: Math.max(120, y + maxH - cy), style: color ? { color } : {} });
    cy += el.height;
  }
  return cy;
}
function footer(ctx: LayoutCtx) {
  if (!ctx.c.footer) return;
  addText(ctx, 'footer', 'caption', ctx.c.footer, ctx.M, ctx.H - ctx.M * 0.6, ctx.W - ctx.M * 2, { style: { color: '$textMuted' } });
}
function imgOrQuery(c: LayoutContent, i = 0) {
  if (i === 0 && c.image) return c.image;
  const list = c.images ?? [];
  return c.image ? list[i - 1] : list[i];
}
function allImages(c: LayoutContent) {
  return [...(c.image ? [c.image] : []), ...(c.images ?? [])];
}
function statBlock(ctx: LayoutCtx, i: number, s: NonNullable<LayoutContent['stats']>[number], x: number, y: number, w: number, big = false): number {
  // value must stay on one line: shrink until it fits the column width
  let fs = big ? ctx.theme.fontScale.display : ctx.theme.fontScale.h1;
  const fam = ctx.theme.fonts.heading;
  while (fs > 28 && textWidth(String(s.value), fs, fam, ctx.theme.typography.headingWeight) * 1.08 > w) fs = Math.round(fs * 0.92);
  const v = addText(ctx, `stat-${i + 1}-value`, big ? 'display' : 'h1', String(s.value), x, y, w, { style: { color: '$primary', letterSpacing: -2, fontSize: fs }, maxHeight: big ? 200 : 130 });
  const l = addText(ctx, `stat-${i + 1}-label`, 'h3', s.label, x, y + v.height + 8, w, { style: { fontSize: ctx.theme.fontScale.small * 1.15, color: '$text', fontWeight: 600 }, maxHeight: 90 });
  let bottom = l.y + l.height;
  if (s.text) { const t = addText(ctx, `stat-${i + 1}-text`, 'small', s.text, x, bottom + 6, w, { maxHeight: 120 }); bottom = t.y + t.height; }
  return bottom;
}
function cardItem(ctx: LayoutCtx, i: number, it: NonNullable<LayoutContent['items']>[number], x: number, y: number, w: number, h: number, opts: { numbered?: boolean; iconColor?: string } = {}) {
  addCard(ctx, `card-${i + 1}`, x, y, w, h);
  const pad = Math.min(48, w * 0.12);
  let cy = y + pad;
  if (it.image) {
    addImage(ctx, `card-${i + 1}-image`, it.image, x, y, w, h * 0.42, { radius: ctx.theme.radius });
    cy = y + h * 0.42 + pad * 0.7;
  } else if (opts.numbered) {
    const n = addText(ctx, `card-${i + 1}-num`, 'h2', String(i + 1).padStart(2, '0'), x + pad, cy, w - pad * 2, { style: { color: '$accent' } });
    cy += n.height + 8;
  } else if (it.icon) {
    addShape(ctx, `card-${i + 1}-icon-bg`, 'roundRect', x + pad, cy, 84, 84, { fill: opts.iconColor ?? '$primary', radius: 22, opacity: undefined });
    addEl(ctx, { id: `card-${i + 1}-icon`, type: 'icon', x: x + pad + 20, y: cy + 20, width: 44, height: 44, content: { name: it.icon }, style: { color: '$background', strokeWidth: 2 } });
    cy += 84 + 26;
  } else if (it.value !== undefined) {
    const v = addText(ctx, `card-${i + 1}-value`, 'h1', String(it.value), x + pad, cy, w - pad * 2, { style: { color: '$primary' }, maxHeight: 110 });
    cy += v.height + 4;
  }
  const t = addText(ctx, `card-${i + 1}-title`, 'h3', it.title, x + pad, cy, w - pad * 2, { style: { fontSize: Math.min(ctx.theme.fontScale.h3, 38), color: '$text' }, maxHeight: 110 });
  cy += t.height + 10;
  if (it.text) addText(ctx, `card-${i + 1}-text`, 'small', it.text, x + pad, cy, w - pad * 2, { maxHeight: Math.max(60, y + h - pad - cy) });
}
function grid(n: number, maxCols: number): { cols: number; rows: number } {
  const cols = n <= maxCols ? n : n === 4 ? 2 : n <= 6 ? 3 : Math.min(maxCols, 4);
  return { cols, rows: Math.ceil(n / cols) };
}
function heroBg(ctx: LayoutCtx): Background | undefined {
  const t = ctx.theme;
  if (t.background) return t.background;
  return undefined;
}
function darkOverlayImageBg(c: LayoutContent): Background | undefined {
  const img = imgOrQuery(c, 0);
  if (!img) return undefined;
  return { type: 'image', image: img, fit: 'cover', overlay: { color: '#000000', opacity: 0.5 } };
}

/* ------------------------------ layouts ------------------------------ */
export const LAYOUTS: LayoutDef[] = [
  {
    id: 'title', name: 'Title Slide', category: 'Opening', description: 'Centered title with subtitle and presenter line.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'footer'],
    score: (f) => (f.hasHeading && richness(f) === 0 && f.bodyLen < 160 ? 80 : 10),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      themeDecor(ctx, 'hero');
      const w = Math.min(W - M * 2, 1400);
      const x = (W - w) / 2;
      const est = (c.heading ? measure(c.heading, w, textStyle(ctx, 'display')) : 0) + 220;
      let y = Math.max(M, (H - est) / 2);
      y = header(ctx, x, y, w, { align: 'center', kind: 'display', maxHeadingH: H * 0.42 });
      if (c.body) addText(ctx, 'body', 'small', c.body, x, y + 28, w, { style: { align: 'center' } });
      footer(ctx);
      return { background: heroBg(ctx) };
    },
  },
  {
    id: 'hero', name: 'Hero Slide', category: 'Opening', description: 'Left-aligned statement headline with large image.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'image', 'cta', 'footer'],
    score: (f) => (f.hasHeading && f.images === 1 && richness(f) <= 1 ? 78 : f.hasHeading && richness(f) === 0 ? 45 : 5),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const img = imgOrQuery(c, 0);
      const textW = img && !ctx.portrait ? W * 0.46 : W - M * 2;
      if (!img) themeDecor(ctx, 'hero');
      if (img) {
        if (ctx.portrait) addImage(ctx, 'image', img, 0, H * 0.55, W, H * 0.45, { radius: 0 });
        else addImage(ctx, 'image', img, W * 0.54, M * 0.6, W * 0.46 - M * 0.6, H - M * 1.2, { radius: ctx.theme.radius * 1.5 });
      }
      let y = H * (ctx.portrait ? 0.1 : 0.22);
      y = header(ctx, M, y, textW - M * 0.5, { kind: 'h1', maxHeadingH: H * 0.4 });
      if (c.body) { const b = addText(ctx, 'body', 'body', c.body, M, y + 10, textW - M * 0.5, { maxHeight: 220 }); y = b.y + b.height; }
      if (c.cta) addShape(ctx, 'cta', 'pill', M, y + 40, Math.min(520, 60 + c.cta.length * 17), 84, { fill: '$primary', radius: 42, color: '$background', fontSize: 28, fontWeight: 600, align: 'center', verticalAlign: 'middle' }, c.cta);
      footer(ctx);
      return { background: heroBg(ctx) };
    },
  },
  {
    id: 'sectionDivider', name: 'Section Divider', category: 'Structure', description: 'Big section number and title on a bold color field.',
    slots: ['number', 'eyebrow', 'heading', 'subheading'],
    score: (f) => (f.hasHeading && f.number && richness(f) === 0 ? 90 : f.hasHeading && richness(f) === 0 && f.bodyLen === 0 ? 40 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      themeDecor(ctx, 'corner');
      if (c.number) addText(ctx, 'number', 'display', c.number, M, H * 0.16, W * 0.5, { style: { fontSize: Math.min(340, H * 0.34), color: '$background', opacity: undefined, lineHeight: 1 }, type: 'heading' });
      addAccentBar(ctx, 'accent', M, H * 0.58 - 40, 120, 12).style!.fill = '$background';
      header(ctx, M, H * 0.58, W * 0.7, { kind: 'h1', color: '$background', mutedColor: '$background' });
      return { background: { type: 'color', color: '$primary' } };
    },
  },
  {
    id: 'singleColumn', name: 'Single Column', category: 'Text', description: 'Comfortable reading column with title and bullets.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'bullets', 'footer'],
    score: (f) => (f.bullets + (f.bodyLen > 0 ? 1 : 0) > 0 && f.images === 0 && richness(f) - f.bullets === 0 ? 60 : 15),
    build: (ctx) => {
      const { W, H, M } = ctx;
      const w = Math.min(1280, W - M * 2);
      const y = header(ctx, M, M, w, { kind: 'h2' });
      bodyAndBullets(ctx, M, y + 20, w, H - y - M * 1.2);
      footer(ctx);
    },
  },
  {
    id: 'twoColumns', name: 'Two Columns', category: 'Text', description: 'Header across, two balanced text columns.',
    slots: ['eyebrow', 'heading', 'subheading', 'columns', 'body', 'bullets'],
    score: (f) => (f.columns === 2 ? 85 : f.bullets >= 6 && f.images === 0 ? 55 : 5),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2' }) + 30;
      const cols = c.columns?.length ? c.columns.slice(0, 2) : [{ body: c.body, bullets: (c.bullets ?? []).slice(0, Math.ceil((c.bullets?.length ?? 0) / 2)) }, { bullets: (c.bullets ?? []).slice(Math.ceil((c.bullets?.length ?? 0) / 2)) }];
      const cw = ctx.portrait ? W - M * 2 : (W - M * 2 - G * 2) / 2;
      cols.forEach((col, i) => {
        const x = ctx.portrait ? M : M + i * (cw + G * 2);
        let y = ctx.portrait ? y0 + i * ((H - y0) / 2) : y0;
        if (!ctx.portrait && i === 1) addShape(ctx, 'divider', 'rect', M + cw + G - 1, y0, 2, H - y0 - M, { fill: '$border' });
        if (col.heading) { const h = addText(ctx, `col-${i + 1}-heading`, 'h3', col.heading, x, y, cw, { style: { color: '$text' } }); y += h.height + 16; }
        if (col.body) { const b = addText(ctx, `col-${i + 1}-body`, 'body', col.body, x, y, cw, { maxHeight: 260 }); y += b.height + 16; }
        if (col.bullets?.length) addBullets(ctx, `col-${i + 1}-bullets`, col.bullets, x, y, cw, { maxHeight: H - y - M });
      });
    },
  },
  {
    id: 'threeColumns', name: 'Three Columns', category: 'Text', description: 'Three parallel ideas with icons or numbers.',
    slots: ['eyebrow', 'heading', 'subheading', 'items', 'columns'],
    score: (f) => (f.items === 3 || f.columns === 3 ? 82 : 5),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W * 0.7, { kind: 'h2' }) + 40;
      const items: { title: string; text?: string; icon?: string }[] = c.items?.length ? c.items.slice(0, 3) : (c.columns ?? []).map((col) => ({ title: col.heading ?? '', text: [col.body, ...(col.bullets ?? []).map((b) => `• ${b}`)].filter(Boolean).join('\n') }));
      const cw = (W - M * 2 - G * 2) / 3;
      const ch = H - y0 - M;
      items.forEach((it, i) => {
        const x = M + i * (cw + G);
        addAccentBar(ctx, `col-${i + 1}-bar`, x, y0, 64, 8);
        let y = y0 + 40;
        if (it.icon) { addEl(ctx, { id: `col-${i + 1}-icon`, type: 'icon', x, y, width: 64, height: 64, content: { name: it.icon }, style: { color: '$primary', strokeWidth: 1.75 } }); y += 96; }
        const t = addText(ctx, `col-${i + 1}-title`, 'h3', it.title, x, y, cw, { style: { color: '$text' }, maxHeight: 120 });
        if (it.text) addText(ctx, `col-${i + 1}-text`, 'body', it.text, x, y + t.height + 16, cw, { maxHeight: ch - (y - y0) - t.height - 30 });
      });
    },
  },
  {
    id: 'asymmetric', name: 'Asymmetric Layout', category: 'Text', description: 'Oversized heading on a narrow left rail, content on a wide right column.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'bullets', 'image'],
    score: (f) => (f.hasHeading && (f.bullets >= 2 || f.bodyLen > 120) && f.images <= 1 && f.stats + f.items === 0 ? 62 : 10),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const leftW = W * 0.34;
      addShape(ctx, 'rail', 'rect', 0, 0, leftW + M * 0.5, H, { fill: '$surface' });
      header(ctx, M, M, leftW - M * 0.5, { kind: 'h1', maxHeadingH: H * 0.6 });
      const x = leftW + M * 1.2;
      const w = W - x - M;
      let y = M + 10;
      const img = imgOrQuery(c, 0);
      if (img) { addImage(ctx, 'image', img, x, y, w, H * 0.38); y += H * 0.38 + 40; }
      bodyAndBullets(ctx, x, y, w, H - y - M);
    },
  },
  {
    id: 'splitScreen', name: 'Split Screen', category: 'Image', description: 'Half color field with statement, half content.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'bullets', 'image'],
    score: (f) => (f.hasHeading && f.images <= 1 && (f.bullets > 0 || f.bodyLen > 0) && f.stats + f.items === 0 ? 58 : 8),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const half = W / 2;
      const img = imgOrQuery(c, 0);
      if (img) addImage(ctx, 'image', img, 0, 0, half, H, { radius: 0 });
      else addShape(ctx, 'panel', 'rect', 0, 0, half, H, { fill: '$primary' });
      if (!img) header(ctx, M, H * 0.3, half - M * 2, { kind: 'h1', color: '$background', mutedColor: '$background' });
      let y = M * 1.2;
      if (img) y = header(ctx, half + M * 0.8, y, half - M * 1.6, { kind: 'h2' }) + 20;
      bodyAndBullets(ctx, half + M * 0.8, img ? y : H * 0.3, half - M * 1.6, H - (img ? y : H * 0.3) - M);
    },
  },
  {
    id: 'imageLeft', name: 'Image Left – Text Right', category: 'Image', description: 'Framed image on the left, text on the right.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'bullets', 'image', 'caption'],
    score: (f) => (f.images === 1 && (f.bullets > 0 || f.bodyLen > 0) && f.stats + f.items === 0 ? 74 : 5),
    build: (ctx) => imageSide(ctx, 'left'),
  },
  {
    id: 'imageRight', name: 'Text Left – Image Right', category: 'Image', description: 'Text on the left, framed image on the right.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'bullets', 'image', 'caption'],
    score: (f) => (f.images === 1 && (f.bullets > 0 || f.bodyLen > 0) && f.stats + f.items === 0 ? 76 : 5),
    build: (ctx) => imageSide(ctx, 'right'),
  },
  {
    id: 'fullImage', name: 'Full Image Background', category: 'Image', description: 'Full-bleed photo with overlay and statement.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'image', 'caption'],
    score: (f) => (f.images === 1 && f.bullets === 0 && f.bodyLen < 220 && richness(f) <= 1 ? 72 : 3),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const y = header(ctx, M, H * 0.46, W * 0.62, { kind: 'h1', color: '#ffffff', mutedColor: 'rgba(255,255,255,0.85)', maxHeadingH: H * 0.32 });
      if (c.body) addText(ctx, 'body', 'body', c.body, M, y + 10, W * 0.5, { style: { color: 'rgba(255,255,255,0.85)' }, maxHeight: 180 });
      if (c.caption) addText(ctx, 'caption', 'caption', c.caption, M, H - M * 0.7, W - M * 2, { style: { color: 'rgba(255,255,255,0.7)' } });
      return { background: darkOverlayImageBg(c) ?? { type: 'color', color: '$primary' } };
    },
  },
  {
    id: 'bigNumber', name: 'Big Number', category: 'Data', description: 'One giant figure with its meaning.',
    slots: ['eyebrow', 'heading', 'stats', 'number', 'body', 'subheading'],
    score: (f) => (f.stats === 1 || (f.number && !f.hasHeading) ? 90 : f.number ? 45 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      themeDecor(ctx, 'subtle');
      const s = c.stats?.[0] ?? { value: c.number ?? '', label: c.subheading ?? '' };
      if (c.eyebrow) addText(ctx, 'eyebrow', 'eyebrow', c.eyebrow, M, M, W - M * 2);
      const v = addText(ctx, 'stat-1-value', 'display', String(s.value), M, H * 0.18, W - M * 2, { style: { fontSize: Math.min(300, H * 0.3), color: '$primary', lineHeight: 1, letterSpacing: -8 }, maxHeight: H * 0.36 });
      let y = v.y + v.height + 20;
      const label = c.heading ?? s.label;
      if (label) { const l = addText(ctx, 'heading', 'h2', label, M, y, W * 0.66, { maxHeight: 200 }); y += l.height + 16; }
      const txt = c.body ?? s.text ?? (c.heading ? s.label : undefined);
      if (txt) addText(ctx, 'body', 'body', txt, M, y, W * 0.56, { maxHeight: H - y - M });
    },
  },
  {
    id: 'statistics', name: 'Statistics', category: 'Data', description: 'Row of 2–4 key figures with labels.',
    slots: ['eyebrow', 'heading', 'subheading', 'stats', 'body'],
    score: (f) => (f.stats >= 2 && f.stats <= 4 ? 88 : f.stats > 4 ? 50 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W * 0.72, { kind: 'h2' }) + 50;
      const stats = c.stats ?? [];
      const n = stats.length;
      const { cols, rows } = grid(n, 4);
      const cw = (W - M * 2 - G * (cols - 1)) / cols;
      const blockH = rows * 300 - 40;
      const avail = H - M - (c.body ? 90 : 0) - y0;
      const top = y0 + Math.max(0, (avail - blockH) / 2.4);
      stats.forEach((s, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = M + col * (cw + G);
        const y = top + row * 300;
        addShape(ctx, `stat-${i + 1}-rule`, 'rect', x, y, cw, 3, { fill: '$border' });
        addShape(ctx, `stat-${i + 1}-mark`, 'rect', x, y, 72, 3, { fill: '$accent' });
        statBlock(ctx, i, s, x, y + 36, cw - 20);
      });
      if (c.body) addText(ctx, 'body', 'small', c.body, M, H - M - 60, W - M * 2, { maxHeight: 70 });
    },
  },
  {
    id: 'quote', name: 'Quote Slide', category: 'Story', description: 'Large pull quote with attribution.',
    slots: ['quote', 'image', 'eyebrow'],
    score: (f) => (f.quote ? 92 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const q = c.quote!;
      const img = imgOrQuery(c, 0);
      const w = img && !ctx.portrait ? W * 0.56 : W - M * 2.4;
      const x = img ? M : M * 1.2;
      if (img && !ctx.portrait) addImage(ctx, 'image', img, W * 0.64, 0, W * 0.36, H, { radius: 0 });
      addText(ctx, 'quote-mark', 'display', '“', x - 10, H * 0.1, 200, { style: { fontSize: 260, color: '$accent', lineHeight: 1, fontFamily: 'Georgia' }, type: 'text' });
      const qt = addText(ctx, 'quote-text', 'h2', q.text, x, H * 0.3, w, { style: { fontWeight: 500, letterSpacing: -0.5, lineHeight: 1.2 }, maxHeight: H * 0.45, type: 'paragraph' });
      let y = qt.y + qt.height + 40;
      if (q.author) { const a = addText(ctx, 'quote-author', 'h3', `— ${q.author}`, x, y, w, { style: { fontSize: 32, color: '$text' } }); y += a.height + 6; }
      if (q.role) addText(ctx, 'quote-role', 'small', q.role, x + 34, y, w);
    },
  },
  {
    id: 'timeline', name: 'Timeline', category: 'Story', description: 'Milestones across time.',
    slots: ['eyebrow', 'heading', 'subheading', 'timeline', 'items'],
    score: (f) => (f.timeline ? 92 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const y0 = header(ctx, M, M, W * 0.75, { kind: 'h2' }) + 30;
      const tl = c.timeline!;
      const vertical = tl.orientation === 'vertical' || ctx.portrait;
      addEl(ctx, { id: 'timeline', type: 'timeline', x: M, y: y0, width: W - M * 2, height: H - y0 - M * 0.8, content: { ...tl, orientation: vertical ? 'vertical' : tl.orientation ?? 'horizontal' } });
    },
  },
  {
    id: 'process', name: 'Process', category: 'Structure', description: 'Numbered steps or a process diagram.',
    slots: ['eyebrow', 'heading', 'subheading', 'items', 'diagram'],
    score: (f) => (f.diagram ? 70 : f.items >= 3 && f.items <= 6 ? 66 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W * 0.75, { kind: 'h2' }) + 40;
      if (c.diagram) {
        addEl(ctx, { id: 'diagram', type: 'diagram', x: M, y: y0, width: W - M * 2, height: H - y0 - M, content: c.diagram });
        return;
      }
      const items = c.items ?? [];
      const n = items.length;
      const cw = (W - M * 2 - G * (n - 1)) / n;
      const lineY = y0 + 48;
      addShape(ctx, 'process-line', 'rect', M + cw / 2, lineY - 2, (cw + G) * (n - 1), 4, { fill: '$border' });
      items.forEach((it, i) => {
        const x = M + i * (cw + G);
        addShape(ctx, `step-${i + 1}-dot`, 'ellipse', x + cw / 2 - 48, lineY - 48, 96, 96, { fill: i === 0 ? '$accent' : '$primary', color: '$background', fontSize: 34, fontWeight: 700, align: 'center', verticalAlign: 'middle' }, String(i + 1));
        const t = addText(ctx, `step-${i + 1}-title`, 'h3', it.title, x, lineY + 80, cw, { style: { align: 'center', color: '$text', fontSize: Math.min(36, ctx.theme.fontScale.h3) }, maxHeight: 110 });
        if (it.text) addText(ctx, `step-${i + 1}-text`, 'small', it.text, x, t.y + t.height + 12, cw, { style: { align: 'center' }, maxHeight: H - t.y - t.height - M });
      });
    },
  },
  {
    id: 'comparison', name: 'Comparison', category: 'Structure', description: 'Side-by-side options with a VS badge.',
    slots: ['eyebrow', 'heading', 'subheading', 'columns', 'items'],
    score: (f) => (f.columns === 2 ? 80 : f.columns === 3 ? 60 : f.items === 2 ? 70 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2', align: 'center' }) + 36;
      const cols: { heading?: string; body?: string; bullets?: string[] }[] = c.columns?.length ? c.columns : (c.items ?? []).map((it) => ({ heading: it.title, body: it.text }));
      const n = Math.max(1, cols.length);
      const cw = (W - M * 2 - G * 2 * (n - 1)) / n;
      const ch = H - y0 - M * 0.8;
      cols.forEach((col, i) => {
        const x = M + i * (cw + G * 2);
        addCard(ctx, `option-${i + 1}-card`, x, y0, cw, ch, i === 0 ? {} : { fill: i === 1 ? '$primary' : '$surface' });
        const fg = i === 1 ? '$background' : '$text';
        let y = y0 + 48;
        if (col.heading) { const h = addText(ctx, `option-${i + 1}-heading`, 'h3', col.heading, x + 48, y, cw - 96, { style: { color: fg } }); y += h.height + 18; }
        if (col.body) { const b = addText(ctx, `option-${i + 1}-body`, 'body', col.body, x + 48, y, cw - 96, { style: { color: fg, opacity: undefined }, maxHeight: 200 }); y += b.height + 16; }
        if (col.bullets?.length) addBullets(ctx, `option-${i + 1}-bullets`, col.bullets, x + 48, y, cw - 96, { style: { color: fg }, maxHeight: y0 + ch - y - 40 });
      });
      if (n === 2) addShape(ctx, 'vs', 'ellipse', W / 2 - 60, y0 + ch / 2 - 60, 120, 120, { fill: '$accent', color: '#ffffff', fontWeight: 800, fontSize: 28, align: 'center', verticalAlign: 'middle', padding: 0 }, 'VS');
    },
  },
  {
    id: 'beforeAfter', name: 'Before & After', category: 'Structure', description: 'Contrast the old state with the new.',
    slots: ['eyebrow', 'heading', 'subheading', 'before', 'after'],
    score: (f) => (f.beforeAfter ? 95 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2' }) + 30;
      const cw = (W - M * 2 - G * 3) / 2;
      ([['before', c.before, 'Before'], ['after', c.after, 'After']] as const).forEach(([key, side, label], i) => {
        const x = M + i * (cw + G * 3);
        let y = y0;
        addShape(ctx, `${key}-tag`, 'pill', x, y, 170, 56, { fill: i ? '$accent' : '$border', color: i ? '#ffffff' : '$text', fontSize: 22, fontWeight: 700, align: 'center', verticalAlign: 'middle', radius: 28 }, side?.heading ? label : label);
        y += 84;
        if (side?.image) { addImage(ctx, `${key}-image`, side.image, x, y, cw, H * 0.3, i ? {} : { grayscale: true }); y += H * 0.3 + 28; }
        if (side?.heading) { const h = addText(ctx, `${key}-heading`, 'h3', side.heading, x, y, cw, { style: { color: '$text' } }); y += h.height + 12; }
        if (side?.body) { const b = addText(ctx, `${key}-body`, 'body', side.body, x, y, cw, { maxHeight: 200 }); y += b.height + 12; }
        if (side?.bullets?.length) addBullets(ctx, `${key}-bullets`, side.bullets, x, y, cw, { maxHeight: H - y - M });
      });
      addEl(ctx, { id: 'ba-arrow', type: 'arrow', x: W / 2 - 50, y: y0 + 28, width: 100, height: 1, content: { x1: W / 2 - 50, y1: y0 + 28, x2: W / 2 + 50, y2: y0 + 28 }, style: { stroke: { color: '$accent', width: 6 }, headEnd: 'triangle' } });
    },
  },
  {
    id: 'caseStudy', name: 'Case Study', category: 'Story', description: 'Challenge → solution → results with an image and metrics.',
    slots: ['eyebrow', 'heading', 'subheading', 'columns', 'stats', 'image', 'body'],
    score: (f) => (f.columns >= 2 && f.stats >= 1 ? 86 : f.stats >= 2 && f.images === 1 ? 60 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const img = imgOrQuery(c, 0);
      const leftW = img ? W * 0.58 : W - M * 2;
      let y = header(ctx, M, M, leftW - M, { kind: 'h2' }) + 20;
      if (img) addImage(ctx, 'image', img, W * 0.62, 0, W * 0.38, H * 0.62, { radius: 0 });
      const cols = c.columns ?? [];
      const cw = (leftW - M - G * (cols.length - 1)) / Math.max(1, cols.length);
      let maxB = y;
      cols.forEach((col, i) => {
        const x = M + i * (cw + G);
        let cy = y;
        if (col.heading) { const h = addText(ctx, `phase-${i + 1}-heading`, 'eyebrow', col.heading, x, cy, cw); cy += h.height + 12; }
        if (col.body) { const b = addText(ctx, `phase-${i + 1}-body`, 'small', col.body, x, cy, cw, { style: { color: '$text' }, maxHeight: 220 }); cy += b.height; }
        if (col.bullets?.length) { const b = addBullets(ctx, `phase-${i + 1}-bullets`, col.bullets, x, cy + 8, cw, { style: { fontSize: ctx.theme.fontScale.small }, maxHeight: 220 }); cy = b.y + b.height; }
        maxB = Math.max(maxB, cy);
      });
      if (!cols.length && c.body) { const b = addText(ctx, 'body', 'body', c.body, M, y, leftW - M, { maxHeight: 260 }); maxB = b.y + b.height; }
      y = Math.max(maxB + 40, H * 0.66);
      const stats = c.stats ?? [];
      addShape(ctx, 'results-band', 'rect', 0, y - 10, W, H - y + 10, { fill: '$surface' });
      const sw = (W - M * 2 - G * (stats.length - 1)) / Math.max(1, stats.length);
      stats.forEach((s, i) => statBlock(ctx, i, s, M + i * (sw + G), y + 30, sw));
    },
  },
  {
    id: 'dataStory', name: 'Data Storytelling', category: 'Data', description: 'Insight headline + annotated chart + key takeaway.',
    slots: ['eyebrow', 'heading', 'subheading', 'chart', 'body', 'bullets', 'stats'],
    score: (f) => (f.chart && (f.bodyLen > 0 || f.bullets > 0 || f.stats > 0) ? 88 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2', maxHeadingH: 170 }) + 20;
      const chartW = ctx.portrait ? W - M * 2 : (W - M * 2) * 0.64;
      const chartH = ctx.portrait ? H * 0.42 : H - y0 - M;
      addEl(ctx, { id: 'chart', type: 'chart', x: M, y: y0, width: chartW, height: chartH, content: c.chart });
      const x = ctx.portrait ? M : M + chartW + G * 1.5;
      const w = ctx.portrait ? W - M * 2 : W - x - M;
      let y = ctx.portrait ? y0 + chartH + 40 : y0 + 20;
      (c.stats ?? []).slice(0, 2).forEach((s, i) => { y = statBlock(ctx, i, s, x, y, w) + 36; });
      addAccentBar(ctx, 'insight-bar', x, y, 6, 0.0001 + 6);
      bodyAndBullets(ctx, x, y + 20, w, H - y - M);
      if (c.chart?.source) addText(ctx, 'source', 'caption', `Source: ${c.chart.source}`, M, H - M * 0.65, chartW, { style: { color: '$textMuted' } });
    },
  },
  {
    id: 'chartFocus', name: 'Chart Focus', category: 'Data', description: 'Large chart with title — data first.',
    slots: ['eyebrow', 'heading', 'subheading', 'chart', 'caption'],
    score: (f) => (f.chart ? 78 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const y0 = header(ctx, M, M * 0.9, W - M * 2, { kind: 'h2', maxHeadingH: 150 }) + 10;
      addEl(ctx, { id: 'chart', type: 'chart', x: M, y: y0, width: W - M * 2, height: H - y0 - M * 0.9, content: c.chart });
      const cap = c.caption ?? (c.chart?.source ? `Source: ${c.chart.source}` : undefined);
      if (cap) addText(ctx, 'caption', 'caption', cap, M, H - M * 0.7, W - M * 2);
    },
  },
  {
    id: 'dashboard', name: 'Dashboard', category: 'Data', description: 'KPI tiles on top, chart and table/list below.',
    slots: ['eyebrow', 'heading', 'stats', 'chart', 'table', 'bullets'],
    score: (f) => (f.stats >= 2 && (f.chart || f.table) ? 92 : f.chart && f.table ? 75 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M * 0.75, W - M * 2, { kind: 'h3', sub: false }) + 10;
      const stats = c.stats ?? [];
      const tileH = stats.length ? 190 : 0;
      const tw = (W - M * 2 - G * (stats.length - 1)) / Math.max(1, stats.length);
      stats.forEach((s, i) => {
        const x = M + i * (tw + G);
        addCard(ctx, `kpi-${i + 1}-card`, x, y0, tw, tileH);
        addText(ctx, `kpi-${i + 1}-label`, 'small', s.label, x + 32, y0 + 26, tw - 64, { style: { fontWeight: 600 }, maxHeight: 40 });
        addText(ctx, `kpi-${i + 1}-value`, 'h1', String(s.value), x + 32, y0 + 66, tw - 64, { style: { fontSize: 64, color: '$text' }, maxHeight: 80 });
        if (s.text || s.trend) addText(ctx, `kpi-${i + 1}-delta`, 'caption', `${s.trend === 'up' ? '▲ ' : s.trend === 'down' ? '▼ ' : ''}${s.text ?? ''}`, x + 32, y0 + 146, tw - 64, { style: { color: s.trend === 'down' ? '$danger' : s.trend === 'up' ? '$success' : '$textMuted', fontWeight: 600 } });
      });
      const y1 = y0 + tileH + (tileH ? G : 0);
      const bh = H - y1 - M * 0.75;
      const hasSide = !!(c.table || c.bullets?.length);
      const cw = hasSide && c.chart ? (W - M * 2 - G) * 0.6 : W - M * 2;
      if (c.chart) { addCard(ctx, 'chart-card', M, y1, cw, bh); addEl(ctx, { id: 'chart', type: 'chart', x: M + 24, y: y1 + 20, width: cw - 48, height: bh - 40, content: c.chart }); }
      const sx = c.chart ? M + cw + G : M, sw = c.chart ? W - M - sx : W - M * 2;
      if (c.table) addEl(ctx, { id: 'table', type: 'table', x: sx, y: y1, width: sw, height: bh, content: c.table, style: { fontSize: 20 } });
      else if (c.bullets?.length) { addCard(ctx, 'notes-card', sx, y1, sw, bh); addBullets(ctx, 'bullets', c.bullets, sx + 32, y1 + 32, sw - 64, { style: { fontSize: ctx.theme.fontScale.small }, maxHeight: bh - 64 }); }
    },
  },
  {
    id: 'editorial', name: 'Editorial Layout', category: 'Text', description: 'Serif headline, drop-in lead paragraph and supporting image.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'image', 'caption', 'quote'],
    score: (f) => (f.bodyLen > 180 && f.images <= 1 ? 70 : f.bodyLen > 80 && f.images === 1 ? 50 : 5),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      addShape(ctx, 'rule-top', 'rect', M, M * 0.7, W - M * 2, 2, { fill: '$text' });
      if (c.eyebrow) addText(ctx, 'eyebrow', 'eyebrow', c.eyebrow, M, M * 0.7 + 18, W - M * 2, { style: { color: '$text' } });
      const img = imgOrQuery(c, 0);
      const colW = img ? (W - M * 2 - G * 2) * 0.55 : W - M * 2;
      const h = addText(ctx, 'heading', 'h1', c.heading ?? '', M, M * 1.5, colW, { style: { fontFamily: '$heading', fontWeight: 400, letterSpacing: -1.5 }, maxHeight: H * 0.36 });
      let y = h.y + h.height + 24;
      if (c.subheading) { const s = addText(ctx, 'subheading', 'h3', c.subheading, M, y, colW, { style: { italic: true, fontWeight: 400, color: '$textMuted', fontSize: 34 }, maxHeight: 140 }); y += s.height + 20; }
      if (c.body) addText(ctx, 'body', 'body', c.body, M, y, colW, { style: { color: '$text', lineHeight: 1.6 }, maxHeight: H - y - M * 0.8 });
      if (img) {
        const ix = M + colW + G * 2;
        addImage(ctx, 'image', img, ix, M * 1.5, W - ix - M, H * 0.62, { radius: 0 });
        if (c.caption) addText(ctx, 'caption', 'caption', c.caption, ix, M * 1.5 + H * 0.62 + 14, W - ix - M, { style: { italic: true } });
        if (c.quote) addText(ctx, 'pull-quote', 'h3', `“${c.quote.text}”`, ix, H * 0.8, W - ix - M, { style: { color: '$accent', fontSize: 30, italic: true }, maxHeight: H * 0.16 });
      }
    },
  },
  {
    id: 'magazine', name: 'Magazine Layout', category: 'Image', description: 'Huge image, overlapping headline block and columns.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'image', 'images', 'columns'],
    score: (f) => (f.images >= 2 && f.hasHeading ? 66 : f.images === 1 && f.bodyLen > 100 ? 45 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const imgs = allImages(c);
      addImage(ctx, 'image', imgs[0], 0, 0, W * 0.62, H, { radius: 0 });
      if (imgs[1]) addImage(ctx, 'image-2', imgs[1], W * 0.64, H * 0.58, W * 0.36 - M * 0.5, H * 0.42 - M * 0.5);
      addCard(ctx, 'headline-card', W * 0.46, M * 0.8, W * 0.54 - M * 0.6, H * (imgs[1] ? 0.5 : 0.8), { fill: '$background', radius: 0 });
      let y = header(ctx, W * 0.46 + 56, M * 0.8 + 56, W * 0.54 - M * 0.6 - 112, { kind: 'h2', maxHeadingH: H * 0.25 });
      if (c.body) { const b = addText(ctx, 'body', 'small', c.body, W * 0.46 + 56, y + 8, W * 0.54 - M * 0.6 - 112, { maxHeight: H * (imgs[1] ? 0.5 : 0.8) - (y - M * 0.8) - 80 }); y = b.y + b.height; }
      void G;
    },
  },
  {
    id: 'bento', name: 'Bento Grid', category: 'Structure', description: 'Asymmetric tile mosaic mixing text, numbers and images.',
    slots: ['eyebrow', 'heading', 'items', 'stats', 'images', 'image'],
    score: (f) => (f.items + f.stats + f.images >= 4 && (f.images >= 1 || f.stats >= 1) ? 84 : f.items >= 4 ? 50 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M * 0.75, W - M * 2, { kind: 'h2', sub: false, maxHeadingH: 140 }) + 16;
      const gh = H - y0 - M * 0.75;
      const gw = W - M * 2;
      // 4-col × 2-row grid; tiles: big(2x2), wide(2x1), small(1x1)
      const cw = (gw - G * 3) / 4, rh = (gh - G) / 2;
      const slots = [
        { cx: 0, cy: 0, w: 2, h: 2 }, { cx: 2, cy: 0, w: 1, h: 1 }, { cx: 3, cy: 0, w: 1, h: 1 }, { cx: 2, cy: 1, w: 2, h: 1 },
        { cx: 3, cy: 1, w: 1, h: 1 },
      ];
      const imgs = allImages(c);
      type Tile = { kind: 'image'; img: (typeof imgs)[number] } | { kind: 'stat'; s: NonNullable<LayoutContent['stats']>[number] } | { kind: 'item'; it: NonNullable<LayoutContent['items']>[number] };
      const tiles: Tile[] = [];
      if (imgs[0]) tiles.push({ kind: 'image', img: imgs[0] });
      (c.stats ?? []).forEach((s) => tiles.push({ kind: 'stat', s }));
      (c.items ?? []).forEach((it) => tiles.push({ kind: 'item', it }));
      imgs.slice(1).forEach((img) => tiles.push({ kind: 'image', img }));
      const n = Math.min(tiles.length, 5);
      const layout = n === 5 ? [slots[0], slots[1], slots[2], { cx: 2, cy: 1, w: 1, h: 1 }, slots[4]] : slots.slice(0, n);
      tiles.slice(0, n).forEach((t, i) => {
        const s = layout[i];
        const x = M + s.cx * (cw + G), y = y0 + s.cy * (rh + G), w = s.w * cw + (s.w - 1) * G, h = s.h * rh + (s.h - 1) * G;
        if (t.kind === 'image') { addImage(ctx, `tile-${i + 1}-image`, t.img, x, y, w, h); return; }
        const accent = i % 3 === 1;
        addCard(ctx, `tile-${i + 1}`, x, y, w, h, accent ? { fill: '$primary' } : {});
        const fg = accent ? '$background' : '$text';
        if (t.kind === 'stat') {
          addText(ctx, `tile-${i + 1}-value`, 'h1', String(t.s.value), x + 36, y + 30, w - 72, { style: { color: accent ? '$background' : '$primary', fontSize: Math.min(96, h * 0.4) }, maxHeight: h * 0.5 });
          addText(ctx, `tile-${i + 1}-label`, 'small', t.s.label, x + 36, y + h - 36 - 70, w - 72, { style: { color: fg, fontWeight: 600 }, maxHeight: 70 });
        } else {
          let ty = y + 34;
          if (t.it.icon) { addEl(ctx, { id: `tile-${i + 1}-icon`, type: 'icon', x: x + 36, y: ty, width: 52, height: 52, content: { name: t.it.icon }, style: { color: accent ? '$background' : '$accent' } }); ty += 76; }
          const tt = addText(ctx, `tile-${i + 1}-title`, 'h3', t.it.title, x + 36, ty, w - 72, { style: { color: fg, fontSize: 34 }, maxHeight: 90 });
          if (t.it.text) addText(ctx, `tile-${i + 1}-text`, 'small', t.it.text, x + 36, ty + tt.height + 10, w - 72, { style: { color: accent ? '$background' : '$textMuted' }, maxHeight: Math.max(40, y + h - (ty + tt.height + 10) - 30) });
        }
      });
    },
  },
  {
    id: 'cardGrid', name: 'Card Grid', category: 'Structure', description: 'Uniform cards for 3–8 parallel items.',
    slots: ['eyebrow', 'heading', 'subheading', 'items'],
    score: (f) => (f.items >= 4 && f.items <= 8 ? 72 : f.items === 3 ? 55 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M * 0.85, W * 0.8, { kind: 'h2', maxHeadingH: 150 }) + 30;
      const items = c.items ?? [];
      const { cols, rows } = grid(items.length, 4);
      const cw = (W - M * 2 - G * (cols - 1)) / cols;
      const ch = (H - y0 - M * 0.8 - G * (rows - 1)) / rows;
      items.forEach((it, i) => cardItem(ctx, i, it, M + (i % cols) * (cw + G), y0 + Math.floor(i / cols) * (ch + G), cw, ch, { numbered: !it.icon && !it.image && it.value === undefined }));
    },
  },
  {
    id: 'infographic', name: 'Infographic', category: 'Data', description: 'Diagram-first layout (cycle, pyramid, funnel, mind map…).',
    slots: ['eyebrow', 'heading', 'subheading', 'diagram', 'body'],
    score: (f) => (f.diagram ? 90 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const side = !!c.body && !ctx.portrait;
      const hw = side ? W * 0.32 : W - M * 2;
      let y = header(ctx, M, M, hw, { kind: 'h2', maxHeadingH: side ? 360 : 150 });
      if (side && c.body) addText(ctx, 'body', 'body', c.body, M, y + 10, hw, { maxHeight: H - y - M });
      const dx = side ? M + hw + G * 1.5 : M;
      const dy = side ? M * 0.6 : y + 20;
      addEl(ctx, { id: 'diagram', type: 'diagram', x: dx, y: dy, width: W - dx - M * (side ? 0.6 : 1), height: H - dy - M * 0.6, content: c.diagram });
      y = 0;
    },
  },
  {
    id: 'minimalType', name: 'Minimal Typography', category: 'Text', description: 'One sentence, huge type, nothing else.',
    slots: ['eyebrow', 'heading', 'subheading'],
    score: (f) => (f.hasHeading && richness(f) === 0 && f.bodyLen === 0 && !f.number ? 55 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      if (c.eyebrow) addText(ctx, 'eyebrow', 'eyebrow', c.eyebrow, M * 1.3, H * 0.22, W - M * 2.6);
      const h = addText(ctx, 'heading', 'display', c.heading ?? '', M * 1.3, H * 0.3, W - M * 2.6, { style: { letterSpacing: -4 }, maxHeight: H * 0.48 });
      if (c.subheading) addText(ctx, 'subheading', 'body', c.subheading, M * 1.3, h.y + h.height + 30, W * 0.55, { maxHeight: 140 });
    },
  },
  {
    id: 'cinematic', name: 'Cinematic Layout', category: 'Image', description: 'Letterboxed widescreen image with title in the bar.',
    slots: ['eyebrow', 'heading', 'subheading', 'image', 'caption'],
    score: (f) => (f.images === 1 && f.hasHeading && f.bullets === 0 && f.bodyLen === 0 && richness(f) === 1 ? 64 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const bar = H * 0.14;
      addImage(ctx, 'image', imgOrQuery(c, 0), 0, bar, W, H - bar * 2, { radius: 0 });
      addShape(ctx, 'bar-top', 'rect', 0, 0, W, bar, { fill: '#000000' });
      addShape(ctx, 'bar-bottom', 'rect', 0, H - bar, W, bar, { fill: '#000000' });
      if (c.eyebrow) addText(ctx, 'eyebrow', 'eyebrow', c.eyebrow, M, bar * 0.36, W - M * 2, { style: { color: '#ffffff', align: 'center' } });
      addText(ctx, 'heading', 'h2', c.heading ?? '', M, H - bar + bar * 0.18, W - M * 2, { style: { color: '#ffffff', align: 'center', fontSize: 58 }, maxHeight: bar * 0.7 });
      if (c.subheading) addText(ctx, 'subheading', 'small', c.subheading, M, H * 0.7, W * 0.5, { style: { color: '#ffffff' } });
      return { background: { type: 'color', color: '#000000' } };
    },
  },
  {
    id: 'productShowcase', name: 'Product Showcase', category: 'Image', description: 'Hero product image centered, feature callouts around it.',
    slots: ['eyebrow', 'heading', 'subheading', 'image', 'items', 'cta'],
    score: (f) => (f.images === 1 && f.items >= 2 && f.items <= 6 ? 82 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      header(ctx, M, M * 0.75, W - M * 2, { kind: 'h2', align: 'center', maxHeadingH: 140 });
      const iw = W * 0.34, ih = H * 0.56;
      const ix = (W - iw) / 2, iy = H * 0.34;
      addDecor(ctx, 'product-glow', 'orb', ix - iw * 0.2, iy - ih * 0.1, iw * 1.4, iw * 1.4, ['$accent'], 0.35);
      addImage(ctx, 'image', imgOrQuery(c, 0), ix, iy, iw, ih, { fit: 'contain', radius: 0 });
      const items = (c.items ?? []).slice(0, 6);
      const half = Math.ceil(items.length / 2);
      items.forEach((it, i) => {
        const left = i < half;
        const row = left ? i : i - half;
        const rows = left ? half : items.length - half;
        const cy = iy + (ih / (rows + 1)) * (row + 1) - 60;
        const x = left ? M : ix + iw + 60;
        const w = ix - M - 60;
        const t = addText(ctx, `feature-${i + 1}-title`, 'h3', it.title, x, cy, w, { style: { align: left ? 'right' : 'left', color: '$text', fontSize: 32 }, maxHeight: 80 });
        if (it.text) addText(ctx, `feature-${i + 1}-text`, 'small', it.text, x, cy + t.height + 6, w, { style: { align: left ? 'right' : 'left' }, maxHeight: 90 });
      });
    },
  },
  {
    id: 'agenda', name: 'Agenda', category: 'Structure', description: 'Numbered agenda list with large indices.',
    slots: ['eyebrow', 'heading', 'items', 'bullets'],
    score: (f) => (f.items >= 3 && f.items <= 7 && f.images === 0 ? 50 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      const leftW = W * 0.34;
      header(ctx, M, M, leftW - M * 0.5, { kind: 'h1' });
      const items = c.items?.length ? c.items : (c.bullets ?? []).map((b) => ({ title: b, text: undefined as string | undefined }));
      const rowH = Math.min(150, (H - M * 2) / Math.max(1, items.length));
      items.forEach((it, i) => {
        const y = M + i * rowH;
        addText(ctx, `agenda-${i + 1}-num`, 'h2', String(i + 1).padStart(2, '0'), leftW + M * 0.5, y, 140, { style: { color: '$accent', fontSize: Math.min(64, rowH * 0.5) } });
        const t = addText(ctx, `agenda-${i + 1}-title`, 'h3', it.title, leftW + M * 0.5 + 160, y + 4, W - leftW - M * 2 - 160, { style: { color: '$text', fontSize: Math.min(40, rowH * 0.32) }, maxHeight: rowH * 0.5 });
        if (it.text) addText(ctx, `agenda-${i + 1}-text`, 'small', it.text, leftW + M * 0.5 + 160, y + t.height + 8, W - leftW - M * 2 - 160, { maxHeight: rowH * 0.4 });
        if (i < items.length - 1) addShape(ctx, `agenda-${i + 1}-rule`, 'rect', leftW + M * 0.5, y + rowH - 14, W - leftW - M * 1.5, 2, { fill: '$border' });
      });
    },
  },
  {
    id: 'tableFocus', name: 'Table', category: 'Data', description: 'Readable data table with optional takeaway.',
    slots: ['eyebrow', 'heading', 'subheading', 'table', 'body', 'caption'],
    score: (f) => (f.table ? 85 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2', maxHeadingH: 160 }) + 20;
      const side = !!c.body && !ctx.portrait;
      const tw = side ? (W - M * 2) * 0.68 : W - M * 2;
      const rows = c.table?.rows.length ?? 1;
      const th = Math.min(H - y0 - M, rows * 78 + 10);
      addEl(ctx, { id: 'table', type: 'table', x: M, y: y0, width: tw, height: th, content: c.table });
      if (side) { addAccentBar(ctx, 'takeaway-bar', M + tw + G, y0, 60, 8); addText(ctx, 'body', 'body', c.body!, M + tw + G, y0 + 30, W - M * 2 - tw - G, { style: { color: '$text' }, maxHeight: H - y0 - M }); }
      if (c.caption) addText(ctx, 'caption', 'caption', c.caption, M, H - M * 0.7, W - M * 2);
    },
  },
  {
    id: 'codeFocus', name: 'Code Focus', category: 'Data', description: 'Code block with explanation.',
    slots: ['eyebrow', 'heading', 'subheading', 'code', 'body', 'bullets', 'formula'],
    score: (f) => (f.code ? 90 : f.formula ? 70 : 0),
    build: (ctx) => {
      const { W, H, M, G, c } = ctx;
      const y0 = header(ctx, M, M, W - M * 2, { kind: 'h2', maxHeadingH: 160 }) + 20;
      const side = (c.body || c.bullets?.length) && !ctx.portrait;
      const cw = side ? (W - M * 2 - G) * 0.6 : W - M * 2;
      if (c.code) addEl(ctx, { id: 'code', type: 'code', x: M, y: y0, width: cw, height: H - y0 - M, content: { showLineNumbers: true, ...c.code }, style: { fontSize: 22, radius: ctx.theme.radius } });
      else if (c.formula) addEl(ctx, { id: 'formula', type: 'formula', x: M, y: y0, width: cw, height: (H - y0 - M) * 0.6, content: { display: true, ...c.formula }, style: { fontSize: 64, color: '$text' } });
      if (side) bodyAndBullets(ctx, M + cw + G, y0, W - M * 2 - cw - G, H - y0 - M);
    },
  },
  {
    id: 'closing', name: 'Closing Slide', category: 'Closing', description: 'Thank you / call to action with contact.',
    slots: ['eyebrow', 'heading', 'subheading', 'body', 'cta', 'image', 'footer'],
    score: (f) => (f.hasHeading && richness(f) <= 1 && (f.bodyLen > 0 || f.hasSub) ? 40 : 0),
    build: (ctx) => {
      const { W, H, M, c } = ctx;
      themeDecor(ctx, 'hero');
      const img = imgOrQuery(c, 0);
      if (img) addImage(ctx, 'image', img, W * 0.62, H * 0.18, W * 0.3, W * 0.3, { mask: 'circle' });
      const w = img ? W * 0.52 : W - M * 2;
      let y = header(ctx, M, H * 0.28, w, { kind: 'display', align: img ? 'left' : 'center', maxHeadingH: H * 0.36 });
      if (c.body) { const b = addText(ctx, 'body', 'body', c.body, M, y + 10, w, { style: { align: img ? 'left' : 'center' }, maxHeight: 160 }); y = b.y + b.height; }
      if (c.cta) {
        const bw = Math.min(640, 80 + c.cta.length * 17);
        addShape(ctx, 'cta', 'pill', img ? M : (W - bw) / 2, y + 40, bw, 88, { fill: '$accent', radius: 44, color: '#ffffff', fontSize: 30, fontWeight: 700, align: 'center', verticalAlign: 'middle' }, c.cta);
      }
      footer(ctx);
      return { background: heroBg(ctx) };
    },
  },
];

function imageSide(ctx: LayoutCtx, side: 'left' | 'right') {
  const { W, H, M, G, c } = ctx;
  const img = imgOrQuery(c, 0);
  const iw = ctx.portrait ? W : W * 0.46;
  if (ctx.portrait) {
    addImage(ctx, 'image', img, 0, 0, W, H * 0.4, { radius: 0 });
    const y = header(ctx, M, H * 0.44, W - M * 2, { kind: 'h2' }) + 16;
    bodyAndBullets(ctx, M, y, W - M * 2, H - y - M);
    return;
  }
  const ix = side === 'left' ? M * 0.6 : W - iw - M * 0.6;
  addImage(ctx, 'image', img, ix, M * 0.6, iw, H - M * 1.2, { radius: ctx.theme.radius * 1.25 });
  if (c.caption) addText(ctx, 'caption', 'caption', c.caption, ix + 24, H - M * 0.6 - 60, iw - 48, { style: { color: '#ffffff' } });
  const tx = side === 'left' ? ix + iw + G * 2.5 : M;
  const tw = W - iw - M * 0.6 - G * 2.5 - M;
  const est = (c.heading ? measure(c.heading, tw, textStyle(ctx, 'h2')) : 0) + (c.body ? 200 : 0) + (c.bullets?.length ?? 0) * 70;
  let y = Math.max(M, (H - est) / 2 - 40);
  y = header(ctx, tx, y, tw, { kind: 'h2', maxHeadingH: H * 0.32 }) + 16;
  bodyAndBullets(ctx, tx, y, tw, H - y - M);
}

export const LAYOUT_MAP: Record<string, LayoutDef> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));
export const LAYOUT_IDS = LAYOUTS.map((l) => l.id);

/** Slots that carry data in `content` but are not rendered by the layout. */
export function unusedSlots(layoutId: string, c: LayoutContent): Slot[] {
  const def = LAYOUT_MAP[layoutId];
  if (!def) return [];
  return (Object.keys(c) as Slot[]).filter((k) => {
    const v = c[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return false;
    if (k === 'images' && def.slots.includes('image') && (v as unknown[]).length === 0) return false;
    return !def.slots.includes(k) && !(k === 'images' && def.slots.includes('image') && !c.image && (v as unknown[]).length === 1);
  });
}

export interface LayoutSuggestion { layout: LayoutDef; score: number; missing: Slot[] }
export function suggestLayouts(c: LayoutContent, current?: string): LayoutSuggestion[] {
  const f = features(c);
  return LAYOUTS.map((l) => {
    const missing = unusedSlots(l.id, c);
    let s = l.score(f) - missing.length * 30;
    if (l.id === current) s -= 3; // prefer alternatives slightly
    return { layout: l, score: Math.max(0, Math.min(100, s)), missing };
  }).sort((a, b) => b.score - a.score);
}

export function pickLayout(c: LayoutContent): string {
  return suggestLayouts(c)[0]?.layout.id ?? 'singleColumn';
}

/** Materialize a layout into elements. Unknown layout ids fall back to the best suggestion. */
export function buildLayout(layoutId: string | undefined, content: LayoutContent, theme: Theme, size: { width: number; height: number }): { elements: SlideElement[]; background?: Background; layout: string } {
  const id = layoutId && LAYOUT_MAP[layoutId] ? layoutId : pickLayout(content);
  const ctx = makeCtx(content, theme, size);
  const res = LAYOUT_MAP[id].build(ctx) || {};
  return { elements: ctx.els, background: res.background, layout: id };
}
