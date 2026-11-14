import type { Paragraph, Run } from '@/types/schema';

function toHex(rgb: string): string | undefined {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(rgb);
  if (!m) return undefined;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return undefined;
  return '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('');
}

/** Serialize a contentEditable text root (rendered by ParagraphsView) back to paragraphs. */
export function serializeEditable(root: HTMLElement): Paragraph[] {
  const base = getComputedStyle(root);
  const baseWeight = parseInt(base.fontWeight, 10) || 400;
  const baseColor = base.color;
  const paragraphs: Paragraph[] = [];
  const blocks = Array.from(root.childNodes);
  const pushRun = (runs: Run[], text: string, el: Element) => {
    if (!text) return;
    const cs = getComputedStyle(el);
    const r: Run = { text };
    const w = parseInt(cs.fontWeight, 10) || 400;
    if (w >= 600 && w > baseWeight) r.bold = true;
    if (cs.fontStyle === 'italic' && base.fontStyle !== 'italic') r.italic = true;
    const deco = cs.textDecorationLine || cs.textDecoration;
    let ancestorDeco = '';
    for (let n: Element | null = el; n && n !== root; n = n.parentElement) ancestorDeco += ' ' + (n as HTMLElement).style?.textDecoration;
    if ((deco.includes('underline') || ancestorDeco.includes('underline') || el.closest('u')) && !base.textDecorationLine.includes('underline')) r.underline = true;
    if (deco.includes('line-through') || ancestorDeco.includes('line-through') || el.closest('s,strike,del')) r.strike = true;
    if (cs.color !== baseColor && !el.closest('a')) { const hx = toHex(cs.color); if (hx) r.color = hx; }
    const a = el.closest('a');
    if (a?.getAttribute('href')) r.link = a.getAttribute('href')!;
    const fam = cs.fontFamily;
    if (/mono/i.test(fam) && !/mono/i.test(base.fontFamily)) r.code = true;
    const prev = runs[runs.length - 1];
    if (prev && JSON.stringify({ ...prev, text: '' }) === JSON.stringify({ ...r, text: '' })) prev.text += text;
    else runs.push(r);
  };
  const walk = (node: Node, runs: Run[]) => {
    if (node.nodeType === Node.TEXT_NODE) { pushRun(runs, (node.textContent ?? '').replace(/​/g, ''), node.parentElement ?? root); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.getAttribute('contenteditable') === 'false') return;
    if (el.tagName === 'BR') { runs.push({ text: '\n' }); return; }
    el.childNodes.forEach((c) => walk(c, runs));
  };
  for (const b of blocks) {
    if (b.nodeType === Node.TEXT_NODE) {
      const t = (b.textContent ?? '').replace(/​/g, '');
      if (t.trim() || paragraphs.length === 0) paragraphs.push({ runs: [{ text: t }] });
      continue;
    }
    if (b.nodeType !== Node.ELEMENT_NODE) continue;
    const el = b as HTMLElement;
    const runs: Run[] = [];
    walk(el, runs);
    // split on <br> runs into separate paragraphs
    const groups: Run[][] = [[]];
    runs.forEach((r) => { if (r.text === '\n') groups.push([]); else groups[groups.length - 1].push(r); });
    groups.forEach((g, gi) => {
      if (gi > 0 && !g.length && gi === groups.length - 1) return;
      const p: Paragraph = { runs: g.length ? g : [{ text: '' }] };
      const list = el.dataset.list as Paragraph['list'];
      if (list === 'bullet' || list === 'number') p.list = list;
      const lvl = parseInt(el.dataset.level ?? '0', 10);
      if (lvl) p.level = lvl;
      const align = el.style.textAlign;
      if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') p.align = align;
      paragraphs.push(p);
    });
  }
  return paragraphs.length ? paragraphs : [{ runs: [{ text: '' }] }];
}
