/**
 * HTML and Markdown adapters. Both produce slot-based slides (`layout` + `content`)
 * and let the Layout Engine choose a fitting layout, so no coordinates are needed.
 */
import type { Issue } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export interface DomParserLike { parseFromString(s: string, type: string): Document }

const tableFromRows = (rows: string[][]) => ({ rows, header: true });

function md(el: Element): string {
  // inline → markdown-lite
  let out = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) out += n.textContent ?? '';
    else if (n.nodeType === 1) {
      const e = n as Element;
      const inner = md(e);
      const tag = e.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b') out += `**${inner}**`;
      else if (tag === 'em' || tag === 'i') out += `*${inner}*`;
      else if (tag === 'code') out += '`' + inner + '`';
      else if (tag === 'mark') out += `==${inner}==`;
      else if (tag === 'a') out += `[${inner}](${e.getAttribute('href') ?? ''})`;
      else if (tag === 'br') out += '\n';
      else out += inner;
    }
  });
  return out.replace(/\s+/g, (m) => (m.includes('\n') && !m.trim() ? ' ' : ' ')).trim();
}

export function parseHtml(code: string, parser: DomParserLike | undefined): { data?: unknown; issues: Issue[] } {
  const issues: Issue[] = [];
  if (!parser) {
    issues.push({ severity: 'error', code: 'html.noParser', message: 'HTML import requires a DOM parser (available in the browser).' });
    return { issues };
  }
  const doc = parser.parseFromString(code, 'text/html');
  // Strip scripts & handlers before reading anything.
  doc.querySelectorAll('script, iframe, object, embed, link, meta, style').forEach((n) => n.remove());
  let sections = Array.from(doc.querySelectorAll('section, .slide, [data-slide]'));
  // nested reveal.js sections → leaf sections only
  sections = sections.filter((s) => !s.querySelector('section'));
  if (!sections.length) {
    // split by <hr> or by h1/h2
    const body = doc.body;
    const groups: Element[][] = [[]];
    Array.from(body.children).forEach((c) => {
      const tag = c.tagName.toLowerCase();
      if (tag === 'hr') { groups.push([]); return; }
      if ((tag === 'h1' || tag === 'h2') && groups[groups.length - 1].length) groups.push([]);
      groups[groups.length - 1].push(c);
    });
    sections = groups.filter((g) => g.length).map((g) => { const s = doc.createElement('section'); g.forEach((c) => s.appendChild(c)); return s; });
  }
  if (!sections.length) {
    issues.push({ severity: 'error', code: 'html.empty', message: 'No slides found. Use <section> per slide.' });
    return { issues };
  }
  const title = doc.querySelector('title')?.textContent?.trim() || sections[0].querySelector('h1,h2')?.textContent?.trim() || 'Imported presentation';
  const slides = sections.map((s, i) => {
    const content: Raw = {};
    const h = s.querySelector('h1, h2');
    if (h) content.heading = md(h);
    const sub = s.querySelector('h3, h4, .subtitle');
    if (sub) content.subheading = md(sub);
    const eyebrow = s.querySelector('.eyebrow, .kicker');
    if (eyebrow) content.eyebrow = md(eyebrow);
    const ps = Array.from(s.querySelectorAll(':scope > p, :scope > div > p')).filter((p) => !p.closest('blockquote, aside, li, td, th, .notes')).map(md).filter(Boolean);
    if (ps.length) content.body = ps.join('\n');
    const lists = Array.from(s.querySelectorAll('ul, ol')).filter((l) => !l.closest('aside, .notes'));
    const bullets = lists.flatMap((l) => Array.from(l.querySelectorAll(':scope > li')).map(md));
    if (bullets.length) content.bullets = bullets;
    const imgs = Array.from(s.querySelectorAll('img')).map((img) => ({ src: img.getAttribute('src') ?? undefined, alt: img.getAttribute('alt') ?? undefined }));
    if (imgs[0]) content.image = imgs[0];
    if (imgs.length > 1) content.images = imgs.slice(1);
    const bq = s.querySelector('blockquote');
    if (bq) {
      const cite = bq.querySelector('cite, footer');
      const author = cite ? md(cite).replace(/^[—-]\s*/, '') : undefined;
      cite?.remove();
      content.quote = { text: md(bq), ...(author ? { author } : {}) };
    }
    const table = s.querySelector('table');
    if (table) content.table = tableFromRows(Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => md(c))));
    const pre = s.querySelector('pre');
    if (pre) {
      const codeEl = pre.querySelector('code');
      const lang = /language-(\w+)/.exec(codeEl?.className ?? '')?.[1];
      content.code = { code: (codeEl ?? pre).textContent ?? '', ...(lang ? { language: lang } : {}) };
    }
    const slide: Raw = { id: s.getAttribute('id') || `slide-${i + 1}`, content };
    const layout = s.getAttribute('data-layout');
    if (layout) slide.layout = layout;
    const tr = s.getAttribute('data-transition');
    if (tr) slide.transition = tr.split(/\s+/)[0].replace(/-(in|out)$/, '');
    const bg = s.getAttribute('data-background-color') ?? s.getAttribute('data-background');
    const bgImg = s.getAttribute('data-background-image');
    if (bgImg) slide.background = { type: 'image', image: { src: bgImg }, overlay: { color: '#000000', opacity: 0.45 } };
    else if (bg && !/url\(/.test(bg)) slide.background = { type: 'color', color: bg };
    const notes = s.querySelector('aside.notes, .notes');
    if (notes) slide.notes = notes.textContent?.trim();
    if (!Object.keys(content).length) issues.push({ severity: 'warning', code: 'html.emptySlide', message: `Section ${i + 1} has no recognizable content.`, slideIndex: i });
    return slide;
  });
  return { data: { schemaVersion: '1.0', title, slides }, issues };
}

/** Markdown: slides separated by `---`. Supports #, ##, ###, paragraphs, lists, images, > quotes, tables, ``` code, $$ math $$, <!-- notes --> */
export function parseMarkdown(code: string): { data?: unknown; issues: Issue[] } {
  const issues: Issue[] = [];
  let src = code.replace(/\r\n?/g, '\n');
  let title: string | undefined;
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(src);
  const meta: Raw = {};
  if (fm && /^\w+:/m.test(fm[1])) {
    fm[1].split('\n').forEach((l) => { const m = /^(\w+):\s*(.*)$/.exec(l); if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
    src = src.slice(fm[0].length);
    title = meta.title;
  }
  const chunks = src.split(/\n-{3,}\s*\n/).map((c) => c.trim()).filter(Boolean);
  const slides = chunks.map((chunk, i) => {
    const content: Raw = {};
    const slide: Raw = { id: `slide-${i + 1}` };
    const notes: string[] = [];
    chunk = chunk.replace(/<!--\s*(?:notes?:)?([\s\S]*?)-->/g, (_m, n) => { notes.push(n.trim()); return ''; });
    chunk = chunk.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, c) => { content.code = { code: c.replace(/\n$/, ''), ...(lang ? { language: lang } : {}) }; return ''; });
    chunk = chunk.replace(/\$\$([\s\S]*?)\$\$/g, (_m, f) => { content.formula = { latex: f.trim() }; return ''; });
    const lines = chunk.split('\n');
    const body: string[] = [];
    const bullets: string[] = [];
    const tableRows: string[][] = [];
    lines.forEach((l) => {
      const t = l.trim();
      let m: RegExpExecArray | null;
      if (!t) return;
      if ((m = /^layout:\s*(\w+)/i.exec(t))) { slide.layout = m[1]; return; }
      if ((m = /^transition:\s*(\w+)/i.exec(t))) { slide.transition = m[1]; return; }
      if ((m = /^#\s+(.*)/.exec(t))) { content.heading ??= m[1]; if (i === 0) title ??= m[1]; return; }
      if ((m = /^##\s+(.*)/.exec(t))) { if (content.heading) content.subheading ??= m[1]; else content.heading = m[1]; return; }
      if ((m = /^###\s+(.*)/.exec(t))) { content.subheading ??= m[1]; return; }
      if ((m = /^!\[([^\]]*)\]\(([^)\s]+)\)/.exec(t))) { const img = { src: m[2], alt: m[1] }; if (!content.image) content.image = img; else (content.images ??= []).push(img); return; }
      if ((m = /^>\s?(.*)/.exec(t))) { const q = m[1]; const a = /^[—-]\s*(.+)/.exec(q); if (a && content.quote) content.quote.author = a[1]; else content.quote = { text: [content.quote?.text, q].filter(Boolean).join(' ') }; return; }
      if (/^\|.*\|$/.test(t)) { if (/^\|[\s:|-]+\|$/.test(t)) return; tableRows.push(t.slice(1, -1).split('|').map((c) => c.trim())); return; }
      if ((m = /^([-*+]|\d+[.)])\s+(.*)/.exec(t))) { bullets.push(m[2]); return; }
      body.push(t);
    });
    if (body.length) content.body = body.join('\n');
    if (bullets.length) content.bullets = bullets;
    if (tableRows.length) content.table = tableFromRows(tableRows);
    if (notes.length) slide.notes = notes.join('\n');
    slide.content = content;
    return slide;
  });
  if (!slides.length) issues.push({ severity: 'error', code: 'md.empty', message: 'No slides found in Markdown.' });
  return { data: { schemaVersion: '1.0', title: title ?? 'Imported presentation', ...(meta.theme ? { theme: meta.theme } : {}), slides }, issues };
}
