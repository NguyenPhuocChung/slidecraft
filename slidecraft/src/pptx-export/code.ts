/* eslint-disable @typescript-eslint/no-explicit-any */
import hljs from 'highlight.js/lib/common';
import type { SlideElement, Theme } from '@/types/schema';
import { CODE_THEME_TOKENS } from './codeTheme';
import { pt } from './util';

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Syntax-highlighted code → pptxgenjs text runs (one paragraph per line). */
export function codeRuns(el: SlideElement, theme: Theme): any[] {
  const c = el.content ?? {};
  const dark = el.style?.variant ? el.style.variant !== 'light' : true;
  const pal = dark ? CODE_THEME_TOKENS.dark : CODE_THEME_TOKENS.light;
  const code = String(c.code ?? '');
  let html: string;
  try { html = c.language && hljs.getLanguage(c.language) ? hljs.highlight(code, { language: c.language }).value : hljs.highlightAuto(code).value; } catch { html = code.replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[m]!); }
  const tokens: { text: string; cls: string | null }[] = [];
  const stack: string[] = [];
  const re = /<span class="hljs-([\w-]+)[^"]*">|<\/span>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) stack.push(m[1]);
    else if (m[0] === '</span>') stack.pop();
    else if (m[2]) tokens.push({ text: decode(m[2]), cls: stack[stack.length - 1] ?? null });
  }
  const fs = pt(el.style?.fontSize ?? 22);
  const lines: { text: string; cls: string | null }[][] = [[]];
  tokens.forEach((t) => {
    const parts = t.text.split('\n');
    parts.forEach((p, i) => { if (i > 0) lines.push([]); if (p) lines[lines.length - 1].push({ text: p, cls: t.cls }); });
  });
  const width = String(lines.length).length;
  const out: any[] = [];
  lines.forEach((line, li) => {
    const runs = [...(c.showLineNumbers ? [{ text: `${String(li + 1).padStart(width, ' ')}  `, cls: '__ln' }] : []), ...(line.length ? line : [{ text: ' ', cls: null }])];
    runs.forEach((r, ri) => {
      const color = r.cls === '__ln' ? pal.comment : (r.cls && (pal as Record<string, string>)[r.cls.split('-')[0]]) || pal.fg;
      out.push({ text: r.text, options: { color: color.replace('#', ''), fontFace: theme.fonts.mono, fontSize: fs, ...(ri === runs.length - 1 && li < lines.length - 1 ? { breakLine: true } : {}) } });
    });
  });
  return out;
}
