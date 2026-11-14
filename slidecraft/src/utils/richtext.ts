import type { Paragraph, Run } from '@/types/schema';

/**
 * Markdown-lite → paragraphs.
 * Supports: **bold**, __bold__, *italic*, _italic_, ~~strike~~, `code`, ==accent==,
 * [label](url), "- "/"• "/"* " bullets, "1. " numbering, two-space indentation for levels.
 */
export function parseMarkdownLite(text: string): Paragraph[] {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  return lines.map((raw) => {
    let line = raw;
    const indent = /^(\s*)/.exec(line)?.[1].replace(/\t/g, '  ').length ?? 0;
    line = line.trimStart();
    let list: Paragraph['list'];
    let m: RegExpExecArray | null;
    if ((m = /^([-•*▪◦–])\s+/.exec(line))) { list = 'bullet'; line = line.slice(m[0].length); }
    else if ((m = /^(\d+)[.)]\s+/.exec(line))) { list = 'number'; line = line.slice(m[0].length); }
    const p: Paragraph = { runs: parseInline(line) };
    if (list) { p.list = list; const lvl = Math.min(4, Math.floor(indent / 2)); if (lvl) p.level = lvl; }
    return p;
  });
}

const INLINE = /(\*\*(.+?)\*\*(?!\*)|__(.+?)__(?!_)|~~([^~]+)~~|==([^=]+)==|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|(?<![\w])_([^_\s][^_]*)_(?![\w]))/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  const re = new RegExp(INLINE.source, 'g'); // fresh regex per call: parseInline recurses
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined || m[3] !== undefined) runs.push(...parseInline(m[2] ?? m[3]).map((r) => ({ ...r, bold: true })));
    else if (m[4] !== undefined) runs.push({ text: m[4], strike: true });
    else if (m[5] !== undefined) runs.push({ text: m[5], color: '$accent', bold: true });
    else if (m[6] !== undefined) runs.push({ text: m[6], code: true });
    else if (m[7] !== undefined) runs.push({ text: m[7], link: m[8], underline: true });
    else if (m[9] !== undefined || m[10] !== undefined) runs.push(...parseInline(m[9] ?? m[10]).map((r) => ({ ...r, italic: true })));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  if (!runs.length) runs.push({ text: '' });
  return runs;
}

export function paragraphsToPlain(ps: Paragraph[] | undefined): string {
  return (ps ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n');
}

/** Serialize paragraphs back to markdown-lite (used by "Edit as text" and the outline view). */
export function paragraphsToMarkdown(ps: Paragraph[] | undefined): string {
  let n = 0;
  return (ps ?? []).map((p) => {
    const body = p.runs.map((r) => {
      let t = r.text;
      if (!t) return '';
      if (r.code) t = '`' + t + '`';
      if (r.link) t = `[${t}](${r.link})`;
      if (r.strike) t = `~~${t}~~`;
      if (r.italic) t = `*${t}*`;
      if (r.color === '$accent' && r.bold) return `==${r.text}==`;
      if (r.bold) t = `**${t}**`;
      return t;
    }).join('');
    const ind = '  '.repeat(p.level ?? 0);
    if (p.list === 'bullet') { n = 0; return `${ind}- ${body}`; }
    if (p.list === 'number') { n += 1; return `${ind}${n}. ${body}`; }
    n = 0;
    return body;
  }).join('\n');
}

/* ----------------------- Text measurement ----------------------- */
let ctx: CanvasRenderingContext2D | null | undefined;
function getCtx(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

const WIDE_FONTS = /bebas|condensed|oswald/i;
export function textWidth(text: string, fontSize: number, fontFamily = 'Inter', weight: number | string = 400): number {
  const c = getCtx();
  if (c) {
    c.font = `${weight} ${fontSize}px "${fontFamily}", Inter, Arial, sans-serif`;
    const w = c.measureText(text).width;
    // Web font not loaded yet → the canvas measured a fallback font; leave headroom so text does not overflow later.
    let loaded = true;
    try { loaded = typeof document === 'undefined' || !document.fonts || document.fonts.check(`${weight} ${fontSize}px "${fontFamily}"`); } catch { loaded = true; }
    return loaded ? w : w * 1.12;
  }
  // Node fallback: average glyph width heuristic
  const serif = /playfair|serif|lora|georgia|times|slab/i.test(fontFamily) ? 0.05 : 0;
  const factor = (WIDE_FONTS.test(fontFamily) ? 0.42 : Number(weight) >= 700 ? 0.56 : 0.52) + serif;
  let w = 0;
  for (const ch of text) w += /[A-Z0-9MW@%]/.test(ch) ? fontSize * (factor + 0.1) : ch === ' ' ? fontSize * 0.28 : /[il.,'|!:;]/.test(ch) ? fontSize * 0.26 : fontSize * factor;
  return w;
}

/** Estimate wrapped line count for a paragraph at a given box width. */
export function wrapLines(text: string, maxWidth: number, fontSize: number, fontFamily?: string, weight?: number | string, letterSpacing = 0): number {
  if (!text) return 1;
  const words = text.split(/(\s+)/);
  let lines = 1, cur = 0;
  const space = textWidth(' ', fontSize, fontFamily, weight);
  for (const w of words) {
    if (!w.trim()) { cur += space; continue; }
    const ww = textWidth(w, fontSize, fontFamily, weight) + letterSpacing * w.length;
    if (cur + ww > maxWidth && cur > 0) { lines += 1; cur = ww; }
    else cur += ww;
    while (cur > maxWidth && maxWidth > 0) { lines += 1; cur -= maxWidth; }
  }
  return lines;
}

export interface MeasureOpts { fontSize: number; fontFamily?: string; fontWeight?: number | string; lineHeight?: number; paragraphSpacing?: number; letterSpacing?: number; padding?: number }
export function measureParagraphs(ps: Paragraph[], width: number, o: MeasureOpts): { height: number; lines: number } {
  const lh = (o.lineHeight ?? 1.3) * o.fontSize;
  const pad = o.padding ?? 0;
  let lines = 0, h = 0;
  ps.forEach((p, i) => {
    const fs = Math.max(...p.runs.map((r) => r.fontSize ?? o.fontSize), o.fontSize);
    const indent = p.list ? fs * 1.2 + (p.level ?? 0) * fs : 0;
    const txt = p.runs.map((r) => r.text).join('');
    const n = wrapLines(txt, Math.max(10, width - pad * 2 - indent), fs, o.fontFamily, o.fontWeight, o.letterSpacing);
    lines += n;
    h += n * (lh * (fs / o.fontSize));
    if (i < ps.length - 1) h += o.paragraphSpacing ?? 0;
  });
  return { height: h + pad * 2, lines };
}
