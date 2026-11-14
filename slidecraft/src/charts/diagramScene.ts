import type { DiagramContent, DiagramItem, InfographicContent, Theme, TimelineContent } from '@/types/schema';
import { resolveColor } from '@/themes/themes';
import { readableOn, withAlpha } from '@/utils/color';
import { formatNumber } from '@/utils/misc';
import { arcPoints, ringSlice, type Prim, type Scene } from './scene';

interface D { t: Theme; w: number; h: number; fs: number; prims: Prim[]; text: string; muted: string; surface: string; border: string }

const pal = (d: D, i: number, item?: { color?: string }) => resolveColor(item?.color, d.t, d.t.colors.chart[i % d.t.colors.chart.length]);
const T = (_d: D, x: number, y: number, w: number, h: number, text: string, size: number, color: string, extra: Partial<Extract<Prim, { k: 'text' }>> = {}): Prim => ({ k: 'text', x, y, w, h, text, size, color, ...extra });

function card(d: D, x: number, y: number, w: number, h: number, item: DiagramItem, i: number, opts: { filled?: boolean; align?: 'left' | 'center'; icon?: boolean } = {}) {
  const color = pal(d, i, item);
  const filled = opts.filled ?? false;
  const fg = filled ? readableOn(color) : d.text;
  d.prims.push({ k: 'rect', x, y, w, h, r: Math.min(18, h * 0.12), fill: filled ? color : d.surface, stroke: filled ? undefined : d.border, sw: filled ? undefined : 2 });
  if (!filled) d.prims.push({ k: 'rect', x, y, w: Math.min(10, w * 0.04), h, r: 0, fill: color });
  const pad = Math.min(d.fs * 1.1, w * 0.08);
  let cy = y + pad * 0.8;
  const align = opts.align ?? 'left';
  if (item.icon && opts.icon !== false && h > d.fs * 5) {
    const s = d.fs * 2;
    d.prims.push({ k: 'icon', x: align === 'center' ? x + w / 2 - s / 2 : x + pad, y: cy, w: s, h: s, name: item.icon, color: filled ? fg : color });
    cy += s + d.fs * 0.5;
  }
  const titleSize = Math.min(d.fs * 1.05, h * 0.3);
  d.prims.push(T(d, x + pad, cy, w - pad * 2, titleSize * 2.6, item.title, titleSize, fg, { weight: 700, align, font: 'heading' }));
  cy += titleSize * (item.title.length * titleSize * 0.55 > w - pad * 2 ? 2.5 : 1.35);
  if (item.text) d.prims.push(T(d, x + pad, cy, w - pad * 2, y + h - cy - pad * 0.5, item.text, Math.min(d.fs * 0.82, h * 0.2), filled ? withAlpha(fg, 0.88) : d.muted, { align, lineHeight: 1.3 }));
}

function process(d: D, items: DiagramItem[], vertical: boolean) {
  const n = items.length;
  const gap = d.fs * 2.4;
  if (vertical) {
    const bh = (d.h - gap * (n - 1)) / n;
    items.forEach((it, i) => {
      const y = i * (bh + gap);
      const s = Math.min(bh * 0.7, d.fs * 3);
      d.prims.push({ k: 'ellipse', x: 0, y: y + bh / 2 - s / 2, w: s, h: s, fill: pal(d, i, it), text: String(i + 1), textColor: '#fff', fontSize: s * 0.42, bold: true });
      card(d, s + d.fs, y, d.w - s - d.fs, bh, it, i);
      if (i < n - 1) d.prims.push({ k: 'line', x1: s / 2, y1: y + bh / 2 + s / 2 + 4, x2: s / 2, y2: y + bh + gap + bh / 2 - s / 2 - 6, stroke: d.border, sw: 3, head: 'triangle' });
    });
    return;
  }
  const bw = (d.w - gap * (n - 1)) / n;
  const s = d.fs * 3;
  items.forEach((it, i) => {
    const x = i * (bw + gap);
    d.prims.push({ k: 'ellipse', x: x + bw / 2 - s / 2, y: 0, w: s, h: s, fill: pal(d, i, it), text: String(i + 1).padStart(2, '0'), textColor: '#fff', fontSize: s * 0.36, bold: true });
    card(d, x, s + d.fs, bw, d.h - s - d.fs, it, i, { align: 'center' });
    if (i < n - 1) d.prims.push({ k: 'line', x1: x + bw + 6, y1: s / 2, x2: x + bw + gap - 8, y2: s / 2, stroke: d.muted, sw: 3, head: 'triangle' });
  });
}

function chevrons(d: D, items: DiagramItem[]) {
  const n = items.length;
  const ch = Math.min(d.h * 0.32, d.fs * 5);
  const ov = ch * 0.3;
  const cw = (d.w + ov * (n - 1)) / n;
  items.forEach((it, i) => {
    const x = i * (cw - ov);
    const color = pal(d, i, it);
    d.prims.push({ k: 'rect', x, y: 0, w: cw, h: ch, preset: i === 0 ? 'homePlate' : 'chevron', fill: color, text: it.title, textColor: readableOn(color), fontSize: Math.min(d.fs * 1.05, ch * 0.28), bold: true });
    if (it.text) d.prims.push(T(d, x + ov * 0.6, ch + d.fs * 1.2, cw - ov * 1.4, d.h - ch - d.fs, it.text, d.fs * 0.85, d.muted, { lineHeight: 1.35 }));
    if (it.value !== undefined) d.prims.push(T(d, x + ov * 0.6, d.h - d.fs * 2.4, cw - ov, d.fs * 2, String(it.value), d.fs * 1.3, color, { weight: 800, font: 'heading' }));
  });
}

function cycle(d: D, items: DiagramItem[], center?: string) {
  const n = items.length;
  const cx = d.w / 2, cy = d.h / 2;
  const R = Math.min(d.w, d.h) / 2 - d.fs * 3.2;
  const nodeR = Math.min(R * 0.42, (Math.PI * R) / n * 0.55, d.fs * 4.8);
  d.prims.push({ k: 'poly', pts: arcPoints(cx, cy, R, R, 0, Math.PI * 2, 96), stroke: d.border, sw: 4, closed: false, dash: true });
  if (center) d.prims.push({ k: 'ellipse', x: cx - R * 0.48, y: cy - R * 0.48, w: R * 0.96, h: R * 0.96, fill: d.surface, stroke: d.border, sw: 2, text: center, textColor: d.text, fontSize: Math.min(d.fs * 1.2, R * 0.14), bold: true });
  items.forEach((it, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    const color = pal(d, i, it);
    // arrow along the circle to next node
    const a2 = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2;
    const ax = cx + Math.cos(a2) * R, ay = cy + Math.sin(a2) * R;
    const tx = -Math.sin(a2), ty = Math.cos(a2);
    d.prims.push({ k: 'line', x1: ax - tx * 8, y1: ay - ty * 8, x2: ax + tx * 8, y2: ay + ty * 8, stroke: d.muted, sw: 4, head: 'triangle' });
    d.prims.push({ k: 'ellipse', x: x - nodeR, y: y - nodeR, w: nodeR * 2, h: nodeR * 2, fill: color, stroke: d.t.colors.background, sw: 6 });
    if (it.icon) d.prims.push({ k: 'icon', x: x - nodeR * 0.32, y: y - nodeR * 0.62, w: nodeR * 0.64, h: nodeR * 0.64, name: it.icon, color: readableOn(color) });
    d.prims.push(T(d, x - nodeR * 0.9, it.icon ? y + nodeR * 0.05 : y - nodeR * 0.6, nodeR * 1.8, nodeR * (it.icon ? 0.8 : 1.2), it.title, Math.min(d.fs * 0.95, nodeR * 0.3), readableOn(color), { weight: 700, align: 'center', valign: 'middle' }));
    if (it.text) {
      const out = Math.cos(a) >= 0;
      const tw = Math.min(d.w * 0.22, d.fs * 11);
      const lx = Math.abs(Math.cos(a)) < 0.3 ? x - tw / 2 : out ? x + nodeR + d.fs * 0.6 : x - nodeR - d.fs * 0.6 - tw;
      const ly = Math.abs(Math.cos(a)) < 0.3 ? (Math.sin(a) < 0 ? y - nodeR - d.fs * 3.2 : y + nodeR + d.fs * 0.4) : y - d.fs * 1.4;
      d.prims.push(T(d, lx, ly, tw, d.fs * 3, it.text, d.fs * 0.75, d.muted, { align: Math.abs(Math.cos(a)) < 0.3 ? 'center' : out ? 'left' : 'right' }));
    }
  });
}

function pyramid(d: D, items: DiagramItem[], invert: boolean) {
  const n = items.length;
  const gap = d.fs * 0.35;
  const pw = d.w * (items.some((i) => i.text) ? 0.55 : 1);
  const lh = (d.h - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const idx = invert ? i : i;
    const t0 = invert ? 1 - idx / n : idx / n, t1 = invert ? 1 - (idx + 1) / n : (idx + 1) / n;
    const y = i * (lh + gap);
    const w0 = pw * (invert ? Math.max(0.18, t0) : Math.max(0.0, t0)), w1 = pw * (invert ? Math.max(0.18, t1) : t1);
    const cx = pw / 2;
    const color = pal(d, i, it);
    d.prims.push({ k: 'poly', pts: [[cx - w0 / 2, y], [cx + w0 / 2, y], [cx + w1 / 2, y + lh], [cx - w1 / 2, y + lh]], fill: color, closed: true });
    d.prims.push(T(d, cx - pw * 0.3, y, pw * 0.6, lh, it.title, Math.min(d.fs * 1.0, lh * 0.32), readableOn(color), { weight: 700, align: 'center', valign: 'middle' }));
    if (it.text) {
      d.prims.push({ k: 'line', x1: cx + Math.max(w0, w1) / 2 + d.fs * 0.4, y1: y + lh / 2, x2: pw + d.fs * 1.2, y2: y + lh / 2, stroke: d.border, sw: 2, dash: true });
      d.prims.push(T(d, pw + d.fs * 1.6, y, d.w - pw - d.fs * 1.6, lh, it.text, Math.min(d.fs * 0.85, lh * 0.3), d.text, { valign: 'middle' }));
    }
  });
}

interface TreeNode { item: DiagramItem; children: TreeNode[]; x: number; y: number; depth: number; w: number }
function tree(d: D, items: DiagramItem[], mode: 'org' | 'mind', center?: string) {
  if (mode === 'mind') return mindmap(d, items, center);
  const roots: DiagramItem[] = items.length === 1 ? items : [{ title: center ?? '', children: items }];
  const build = (it: DiagramItem, depth: number): TreeNode => ({ item: it, children: (it.children ?? []).map((c) => build(c, depth + 1)), x: 0, y: 0, depth, w: 0 });
  const root = build(roots[0], 0);
  let leaves = 0, maxDepth = 0;
  const count = (n: TreeNode) => { maxDepth = Math.max(maxDepth, n.depth); if (!n.children.length) leaves++; n.children.forEach(count); };
  count(root);
  const colW = d.w / Math.max(1, leaves);
  const rowH = d.h / (maxDepth + 1);
  const boxW = Math.min(colW * 0.9, d.fs * 13), boxH = Math.min(rowH * 0.62, d.fs * 4.6);
  let li = 0;
  const place = (n: TreeNode) => {
    if (!n.children.length) { n.x = colW * (li++ + 0.5); }
    else { n.children.forEach(place); n.x = (n.children[0].x + n.children[n.children.length - 1].x) / 2; }
    n.y = n.depth * rowH + (rowH - boxH) / 2;
  };
  place(root);
  const draw = (n: TreeNode, i: number) => {
    const hidden = !n.item.title && n.depth === 0;
    n.children.forEach((c, ci) => {
      const midY = n.y + boxH + (c.y - n.y - boxH) / 2;
      if (!hidden) {
        d.prims.push({ k: 'line', x1: n.x, y1: n.y + boxH, x2: n.x, y2: midY, stroke: d.border, sw: 3 });
        d.prims.push({ k: 'line', x1: n.x, y1: midY, x2: c.x, y2: midY, stroke: d.border, sw: 3 });
        d.prims.push({ k: 'line', x1: c.x, y1: midY, x2: c.x, y2: c.y, stroke: d.border, sw: 3 });
      }
      draw(c, n.depth === 0 ? ci : i);
    });
    if (hidden) return;
    const color = n.depth === 0 ? d.t.colors.primary : pal(d, i, n.item);
    const filled = n.depth <= 1;
    d.prims.push({ k: 'rect', x: n.x - boxW / 2, y: n.y, w: boxW, h: boxH, r: 12, fill: filled ? color : d.surface, stroke: filled ? undefined : color, sw: 2.5 });
    const fg = filled ? readableOn(color) : d.text;
    const ts = Math.min(d.fs * 0.95, boxH * 0.3);
    d.prims.push(T(d, n.x - boxW / 2 + 8, n.y + (n.item.text ? boxH * 0.12 : 0), boxW - 16, n.item.text ? boxH * 0.45 : boxH, n.item.title, ts, fg, { weight: 700, align: 'center', valign: n.item.text ? 'top' : 'middle' }));
    if (n.item.text) d.prims.push(T(d, n.x - boxW / 2 + 8, n.y + boxH * 0.52, boxW - 16, boxH * 0.45, n.item.text, ts * 0.8, filled ? withAlpha(fg, 0.85) : d.muted, { align: 'center' }));
  };
  draw(root, 0);
}

function mindmap(d: D, items: DiagramItem[], center?: string) {
  const cx = d.w / 2, cy = d.h / 2;
  const cw = Math.min(d.w * 0.24, d.fs * 12), chh = d.fs * 4.2;
  const left = items.filter((_, i) => i % 2 === 1), right = items.filter((_, i) => i % 2 === 0);
  const side = (list: DiagramItem[], dir: 1 | -1, offset: number) => {
    const rows = list.reduce((s, it) => s + Math.max(1, it.children?.length ?? 0), 0);
    const rh = d.h / Math.max(1, rows);
    let r = 0;
    list.forEach((it, j) => {
      const i = j * 2 + offset;
      const span = Math.max(1, it.children?.length ?? 0);
      const y = (r + span / 2) * rh;
      r += span;
      const bx = cx + dir * (cw / 2 + d.w * 0.12);
      const bw = Math.min(d.w * 0.16, d.fs * 9), bh = d.fs * 2.6;
      const color = pal(d, i, it);
      const pts: [number, number][] = [];
      const x0 = cx + dir * cw * 0.45, x1 = bx - dir * (bw / 2);
      for (let s = 0; s <= 20; s++) { const t = s / 20; const e = t * t * (3 - 2 * t); pts.push([x0 + (x1 - x0) * t, cy + (y - cy) * e]); }
      d.prims.push({ k: 'poly', pts, stroke: color, sw: 5, closed: false });
      d.prims.push({ k: 'rect', x: bx - bw / 2, y: y - bh / 2, w: bw, h: bh, r: bh / 2, fill: color, text: it.title, textColor: readableOn(color), fontSize: Math.min(d.fs * 0.9, bh * 0.36), bold: true });
      (it.children ?? []).forEach((c, ci) => {
        const yy = (r - span + ci + 0.5) * rh;
        const tx = bx + dir * (bw / 2 + d.fs * 1.6);
        const tw = Math.min(d.w * 0.18, Math.abs((dir > 0 ? d.w : 0) - tx) - 4);
        d.prims.push({ k: 'line', x1: bx + dir * bw / 2, y1: y, x2: tx - dir * 6, y2: yy, stroke: withAlpha(color, 0.6), sw: 2.5 });
        d.prims.push(T(d, dir > 0 ? tx : tx - tw, yy - d.fs * 0.7, tw, d.fs * 1.6, c.title, d.fs * 0.8, d.text, { align: dir > 0 ? 'left' : 'right', weight: 500 }));
      });
    });
  };
  side(right, 1, 0);
  side(left, -1, 1);
  d.prims.push({ k: 'ellipse', x: cx - cw / 2, y: cy - chh / 2, w: cw, h: chh, fill: d.t.colors.primary, text: center ?? 'Topic', textColor: readableOn(d.t.colors.primary), fontSize: Math.min(d.fs * 1.15, chh * 0.3), bold: true });
}

function flowchart(d: D, c: DiagramContent) {
  const nodes = c.nodes ?? [];
  const edges = c.edges ?? [];
  const vertical = c.direction === 'vertical';
  const layer = new Map<string, number>();
  nodes.forEach((n) => layer.set(n.id, 0));
  for (let k = 0; k < nodes.length; k++) edges.forEach((e) => { const l = (layer.get(e.from) ?? 0) + 1; if (layer.has(e.to) && l > (layer.get(e.to) ?? 0) && l < nodes.length) layer.set(e.to, l); });
  const layers: string[][] = [];
  nodes.forEach((n) => { const l = layer.get(n.id) ?? 0; (layers[l] ??= []).push(n.id); });
  const L = layers.length;
  const mainN = Math.max(...layers.map((l) => l?.length ?? 0), 1);
  const along = vertical ? d.h : d.w, across = vertical ? d.w : d.h;
  const step = along / L, cross = across / mainN;
  const bw = vertical ? Math.min(cross * 0.8, d.fs * 12) : Math.min(step * 0.7, d.fs * 11);
  const bh = vertical ? Math.min(step * 0.55, d.fs * 3.6) : Math.min(cross * 0.6, d.fs * 3.6);
  const pos = new Map<string, { x: number; y: number }>();
  layers.forEach((ids, li) => (ids ?? []).forEach((id, j) => {
    const a = step * (li + 0.5), b = (across / ids.length) * (j + 0.5);
    pos.set(id, vertical ? { x: b, y: a } : { x: a, y: b });
  }));
  edges.forEach((e) => {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) return;
    let x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;
    if (vertical) { y1 += bh / 2; y2 -= bh / 2 + 4; } else if (b.x > a.x) { x1 += bw / 2; x2 -= bw / 2 + 4; } else { y1 += bh / 2; y2 += bh / 2 + 4; x1 = a.x; x2 = b.x; }
    d.prims.push({ k: 'line', x1, y1, x2, y2, stroke: d.muted, sw: 3, head: 'triangle' });
    if (e.label) d.prims.push(T(d, (x1 + x2) / 2 - 80, (y1 + y2) / 2 - d.fs * 1.4, 160, d.fs * 1.2, e.label, d.fs * 0.72, d.muted, { align: 'center', italic: true }));
  });
  nodes.forEach((n, i) => {
    const p = pos.get(n.id)!;
    const color = resolveColor(n.color, d.t, i === 0 ? d.t.colors.primary : d.t.colors.surface);
    const filled = !!n.color || i === 0;
    const fg = filled ? readableOn(color) : d.text;
    const shape = n.shape ?? 'roundRect';
    const fsz = Math.min(d.fs * 0.9, bh * 0.3);
    if (shape === 'ellipse' || shape === 'pill') d.prims.push({ k: shape === 'pill' ? 'rect' : 'ellipse', x: p.x - bw / 2, y: p.y - bh / 2, w: bw, h: bh, r: bh / 2, fill: color, stroke: filled ? undefined : d.border, sw: 2, text: n.label, textColor: fg, fontSize: fsz, bold: true } as Prim);
    else if (shape === 'diamond') d.prims.push({ k: 'rect', preset: 'diamond', x: p.x - bw / 2, y: p.y - bh * 0.7, w: bw, h: bh * 1.4, fill: filled ? color : d.t.colors.accent, text: n.label, textColor: readableOn(filled ? color : d.t.colors.accent), fontSize: fsz * 0.9, bold: true });
    else d.prims.push({ k: 'rect', x: p.x - bw / 2, y: p.y - bh / 2, w: bw, h: bh, r: shape === 'rect' ? 2 : 12, fill: color, stroke: filled ? undefined : d.border, sw: 2, text: n.label, textColor: fg, fontSize: fsz, bold: true });
  });
}

function grid2x2(d: D, items: DiagramItem[], kind: 'swot' | 'matrix', axes?: { x?: string; y?: string }) {
  const off = kind === 'matrix' && (axes?.x || axes?.y) ? d.fs * 2 : 0;
  const gw = (d.w - off - d.fs) / 2, gh = (d.h - off - d.fs) / 2;
  const letters = ['S', 'W', 'O', 'T'];
  const swotColors = [d.t.colors.success ?? '#16a34a', d.t.colors.danger ?? '#dc2626', d.t.colors.primary, d.t.colors.warning ?? '#d97706'];
  items.slice(0, 4).forEach((it, i) => {
    const x = off + (i % 2) * (gw + d.fs), y = Math.floor(i / 2) * (gh + d.fs);
    const color = kind === 'swot' ? resolveColor(it.color, d.t, swotColors[i]) : pal(d, i, it);
    d.prims.push({ k: 'rect', x, y, w: gw, h: gh, r: 18, fill: withAlpha(color, d.t.mode === 'dark' ? 0.22 : 0.1), stroke: withAlpha(color, 0.5), sw: 2 });
    if (kind === 'swot') d.prims.push(T(d, x + gw - d.fs * 5, y + d.fs * 0.2, d.fs * 4.5, d.fs * 5, letters[i], d.fs * 4.2, withAlpha(color, 0.35), { weight: 900, align: 'right', font: 'heading' }));
    d.prims.push(T(d, x + d.fs, y + d.fs * 0.9, gw - d.fs * 2, d.fs * 1.6, it.title, d.fs * 1.1, color, { weight: 800, font: 'heading' }));
    if (it.text) d.prims.push(T(d, x + d.fs, y + d.fs * 2.7, gw - d.fs * (kind === 'swot' ? 5 : 2), gh - d.fs * 3.2, it.text, d.fs * 0.82, d.text, { lineHeight: 1.4 }));
  });
  if (off) {
    if (axes?.y) d.prims.push(T(d, 0, 0, off, d.h - off, `↑ ${axes.y}`, d.fs * 0.8, d.muted, { weight: 700, valign: 'middle' }));
    if (axes?.x) d.prims.push(T(d, off, d.h - off + d.fs * 0.3, d.w - off, off, `${axes.x} →`, d.fs * 0.8, d.muted, { weight: 700, align: 'center' }));
  }
}

function columns(d: D, items: DiagramItem[]) {
  const n = items.length;
  const gap = d.fs * 1.2;
  const cw = (d.w - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const x = i * (cw + gap);
    const color = pal(d, i, it);
    const hh = d.fs * 3.4;
    d.prims.push({ k: 'rect', x, y: 0, w: cw, h: hh, r: 14, fill: color, text: it.title, textColor: readableOn(color), fontSize: d.fs * 1.05, bold: true });
    d.prims.push({ k: 'rect', x, y: hh + d.fs * 0.5, w: cw, h: d.h - hh - d.fs * 0.5, r: 14, fill: d.surface, stroke: d.border, sw: 2 });
    const lines = [it.text, ...(it.children ?? []).map((c) => `• ${c.title}${c.text ? ` — ${c.text}` : ''}`)].filter(Boolean).join('\n');
    d.prims.push(T(d, x + d.fs, hh + d.fs * 1.4, cw - d.fs * 2, d.h - hh - d.fs * 2, lines, d.fs * 0.85, d.text, { lineHeight: 1.45 }));
  });
}

function beforeAfter(d: D, items: DiagramItem[]) {
  const gap = d.fs * 4;
  const cw = (d.w - gap) / 2;
  items.slice(0, 2).forEach((it, i) => {
    const x = i * (cw + gap);
    const color = i ? d.t.colors.accent : d.t.colors.textMuted;
    d.prims.push({ k: 'rect', x, y: 0, w: cw, h: d.h, r: 20, fill: i ? withAlpha(color, 0.12) : d.surface, stroke: i ? color : d.border, sw: i ? 3 : 2 });
    d.prims.push({ k: 'rect', x: x + d.fs, y: d.fs, w: d.fs * 6, h: d.fs * 1.8, r: d.fs * 0.9, fill: color, text: i ? 'AFTER' : 'BEFORE', textColor: '#fff', fontSize: d.fs * 0.7, bold: true });
    d.prims.push(T(d, x + d.fs, d.fs * 3.6, cw - d.fs * 2, d.fs * 2.8, it.title, d.fs * 1.25, d.text, { weight: 800, font: 'heading' }));
    const lines = [it.text, ...(it.children ?? []).map((c) => `• ${c.title}`)].filter(Boolean).join('\n');
    if (lines) d.prims.push(T(d, x + d.fs, d.fs * 6.6, cw - d.fs * 2, d.h - d.fs * 7, lines, d.fs * 0.88, d.muted, { lineHeight: 1.45 }));
  });
  d.prims.push({ k: 'ellipse', x: d.w / 2 - d.fs * 1.6, y: d.h / 2 - d.fs * 1.6, w: d.fs * 3.2, h: d.fs * 3.2, fill: d.t.colors.accent });
  d.prims.push({ k: 'icon', x: d.w / 2 - d.fs * 0.9, y: d.h / 2 - d.fs * 0.9, w: d.fs * 1.8, h: d.fs * 1.8, name: 'arrow-right', color: '#ffffff' });
}

function roadmap(d: D, items: DiagramItem[]) {
  const n = items.length;
  const midY = d.h / 2;
  d.prims.push({ k: 'rect', x: 0, y: midY - d.fs * 0.5, w: d.w, h: d.fs, r: d.fs / 2, fill: withAlpha(d.t.colors.text, 0.12) });
  const doneUntil = items.reduce((acc, it, i) => (it.status === 'done' ? i : acc), -1);
  if (doneUntil >= 0) d.prims.push({ k: 'rect', x: 0, y: midY - d.fs * 0.5, w: (d.w / n) * (doneUntil + 1), h: d.fs, r: d.fs / 2, fill: d.t.colors.accent });
  const cw = d.w / n;
  items.forEach((it, i) => {
    const x = cw * (i + 0.5);
    const up = i % 2 === 0;
    const color = it.status === 'done' ? d.t.colors.accent : it.status === 'active' ? d.t.colors.primary : d.t.colors.textMuted;
    d.prims.push({ k: 'ellipse', x: x - d.fs * 1.1, y: midY - d.fs * 1.1, w: d.fs * 2.2, h: d.fs * 2.2, fill: it.status === 'planned' || !it.status ? d.t.colors.background : color, stroke: color, sw: 5 });
    d.prims.push({ k: 'line', x1: x, y1: up ? midY - d.fs * 1.3 : midY + d.fs * 1.3, x2: x, y2: up ? midY - d.fs * 3 : midY + d.fs * 3, stroke: withAlpha(color, 0.6), sw: 2 });
    const by = up ? 0 : midY + d.fs * 3.2;
    const bh = midY - d.fs * 3.4;
    if (it.value !== undefined) d.prims.push(T(d, x - cw * 0.48, up ? by + bh - d.fs * 5.2 : by, cw * 0.96, d.fs * 1.4, String(it.value), d.fs * 0.8, color, { weight: 800, align: 'center' }));
    d.prims.push(T(d, x - cw * 0.48, up ? by + bh - d.fs * (it.text ? 3.8 : 1.6) : by + d.fs * (it.value !== undefined ? 1.6 : 0), cw * 0.96, d.fs * 1.6, it.title, d.fs * 1.0, d.text, { weight: 700, align: 'center', font: 'heading' }));
    if (it.text) d.prims.push(T(d, x - cw * 0.48, up ? by + bh - d.fs * 2.2 : by + d.fs * (it.value !== undefined ? 3.2 : 1.6), cw * 0.96, d.fs * 2.4, it.text, d.fs * 0.75, d.muted, { align: 'center' }));
  });
}

function venn(d: D, items: DiagramItem[]) {
  const n = Math.min(3, items.length);
  const r = Math.min(d.w, d.h) * (n === 3 ? 0.3 : 0.36);
  const cx = d.w / 2, cy = d.h / 2;
  const centers: [number, number][] = n === 2 ? [[cx - r * 0.55, cy], [cx + r * 0.55, cy]] : [[cx, cy - r * 0.55], [cx - r * 0.62, cy + r * 0.45], [cx + r * 0.62, cy + r * 0.45]];
  items.slice(0, n).forEach((it, i) => {
    const [x, y] = centers[i];
    const color = pal(d, i, it);
    d.prims.push({ k: 'ellipse', x: x - r, y: y - r, w: r * 2, h: r * 2, fill: withAlpha(color, 0.35), stroke: color, sw: 3 });
    const ox = (x - cx) * 0.9, oy = (y - cy) * 0.9;
    d.prims.push(T(d, x + ox - r * 0.6, y + oy - d.fs * 1.4, r * 1.2, d.fs * 1.6, it.title, d.fs * 1.0, d.text, { weight: 800, align: 'center' }));
    if (it.text) d.prims.push(T(d, x + ox - r * 0.6, y + oy + d.fs * 0.4, r * 1.2, d.fs * 3, it.text, d.fs * 0.75, d.muted, { align: 'center' }));
  });
}

function hub(d: D, items: DiagramItem[], center?: string) {
  const n = items.length;
  const cx = d.w / 2, cy = d.h / 2;
  let R = Math.min(d.w * 0.36, d.h * 0.4);
  const sr = Math.min(R * 0.3, d.fs * 3.4, (Math.PI * R) / n * 0.4);
  R = Math.min(R, d.h / 2 - sr - d.fs * 3.4); // keep top/bottom labels inside the frame
  const hr = Math.min(R * 0.36, d.fs * 4.5);
  items.forEach((it, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * R * 1.05, y = cy + Math.sin(a) * R;
    const color = pal(d, i, it);
    d.prims.push({ k: 'line', x1: cx, y1: cy, x2: x, y2: y, stroke: withAlpha(color, 0.5), sw: 4 });
    d.prims.push({ k: 'ellipse', x: x - sr, y: y - sr, w: sr * 2, h: sr * 2, fill: color, stroke: d.t.colors.background, sw: 5 });
    if (it.icon) d.prims.push({ k: 'icon', x: x - sr * 0.45, y: y - sr * 0.45, w: sr * 0.9, h: sr * 0.9, name: it.icon, color: readableOn(color) });
    else d.prims.push(T(d, x - sr, y - sr, sr * 2, sr * 2, String(i + 1), sr * 0.7, readableOn(color), { weight: 800, align: 'center', valign: 'middle' }));
    const right = Math.cos(a) > 0.2, left = Math.cos(a) < -0.2;
    const tw = d.fs * 10;
    const tx = right ? x + sr + d.fs * 0.5 : left ? x - sr - d.fs * 0.5 - tw : x - tw / 2;
    const ty = right || left ? y - d.fs * 1.3 : Math.sin(a) < 0 ? y - sr - d.fs * 3 : y + sr + d.fs * 0.3;
    d.prims.push(T(d, tx, ty, tw, d.fs * 1.4, it.title, d.fs * 0.95, d.text, { weight: 700, align: right ? 'left' : left ? 'right' : 'center' }));
    if (it.text) d.prims.push(T(d, tx, ty + d.fs * 1.35, tw, d.fs * 2.4, it.text, d.fs * 0.72, d.muted, { align: right ? 'left' : left ? 'right' : 'center' }));
  });
  d.prims.push({ k: 'ellipse', x: cx - hr, y: cy - hr, w: hr * 2, h: hr * 2, fill: d.t.colors.primary, text: center ?? '', textColor: readableOn(d.t.colors.primary), fontSize: Math.min(d.fs * 1.1, hr * 0.32), bold: true });
}

function strategyMap(d: D, items: DiagramItem[]) {
  const n = items.length;
  const gap = d.fs * 0.6;
  const rh = (d.h - gap * (n - 1)) / n;
  const lw = Math.min(d.w * 0.2, d.fs * 9);
  items.forEach((row, i) => {
    const y = i * (rh + gap);
    const color = pal(d, i, row);
    d.prims.push({ k: 'rect', x: 0, y, w: lw, h: rh, r: 12, fill: color, text: row.title, textColor: readableOn(color), fontSize: Math.min(d.fs * 0.95, rh * 0.25), bold: true });
    d.prims.push({ k: 'rect', x: lw + gap, y, w: d.w - lw - gap, h: rh, r: 12, fill: withAlpha(color, 0.08), stroke: withAlpha(color, 0.35), sw: 2 });
    const kids = row.children ?? [];
    const kw = (d.w - lw - gap * 2 - gap * Math.max(0, kids.length - 1) - d.fs) / Math.max(1, kids.length);
    kids.forEach((k, j) => {
      const x = lw + gap * 2 + j * (kw + gap);
      d.prims.push({ k: 'rect', x, y: y + rh * 0.18, w: kw, h: rh * 0.64, r: rh * 0.32, fill: d.t.colors.background, stroke: color, sw: 2.5, text: k.title, textColor: d.text, fontSize: Math.min(d.fs * 0.8, rh * 0.2), bold: false });
    });
  });
}

function list(d: D, items: DiagramItem[]) {
  const n = items.length;
  const gap = d.fs * 0.5;
  const rh = (d.h - gap * (n - 1)) / n;
  const tw = Math.min(d.w * 0.3, d.fs * 12);
  items.forEach((it, i) => {
    const y = i * (rh + gap);
    const color = pal(d, i, it);
    d.prims.push({ k: 'rect', x: 0, y, w: tw, h: rh, r: 12, fill: color, text: it.title, textColor: readableOn(color), fontSize: Math.min(d.fs * 1.0, rh * 0.32), bold: true });
    d.prims.push({ k: 'rect', x: tw - 12, y, w: d.w - tw + 12, h: rh, r: 12, fill: withAlpha(color, 0.1) });
    if (it.text) d.prims.push(T(d, tw + d.fs, y, d.w - tw - d.fs * 2, rh, it.text, Math.min(d.fs * 0.85, rh * 0.3), d.text, { valign: 'middle' }));
  });
}

function mk(t: Theme, w: number, h: number): D {
  return { t, w, h, fs: Math.max(13, Math.min(28, Math.round(Math.min(w / 46, h / 20)))), prims: [], text: t.colors.text, muted: t.colors.textMuted, surface: t.colors.surface, border: t.colors.border };
}

export function buildDiagramScene(c: DiagramContent, t: Theme, w: number, h: number): Scene {
  const d = mk(t, w, h);
  const items = (c.items ?? []) as DiagramItem[];
  try {
    switch (c.kind) {
      case 'process': process(d, items, c.direction === 'vertical'); break;
      case 'chevronProcess': chevrons(d, items); break;
      case 'cycle': cycle(d, items, c.center); break;
      case 'pyramid': pyramid(d, items, false); break;
      case 'funnel': pyramid(d, items, true); break;
      case 'flowchart': flowchart(d, c); break;
      case 'mindmap': tree(d, items, 'mind', c.center); break;
      case 'orgchart': case 'hierarchy': tree(d, items, 'org', c.center); break;
      case 'swot': grid2x2(d, items, 'swot'); break;
      case 'matrix': grid2x2(d, items, 'matrix', c.axes); break;
      case 'comparison': columns(d, items); break;
      case 'beforeAfter': beforeAfter(d, items); break;
      case 'roadmap': roadmap(d, items); break;
      case 'venn': venn(d, items); break;
      case 'hub': hub(d, items, c.center); break;
      case 'strategyMap': strategyMap(d, items); break;
      case 'list': list(d, items); break;
      default: list(d, items);
    }
  } catch {
    d.prims.push(T(d, 0, h / 2 - 20, w, 40, 'Diagram could not be rendered', d.fs, d.muted, { align: 'center' }));
  }
  return { w, h, prims: d.prims, fonts: t.fonts };
}

/* --------------------------------- Timeline --------------------------------- */
export function buildTimelineScene(c: TimelineContent, t: Theme, w: number, h: number): Scene {
  const d = mk(t, w, h);
  const items = c.items ?? [];
  const n = items.length;
  if (c.orientation === 'vertical') {
    const rh = h / Math.max(1, n);
    const lx = Math.min(w * 0.22, d.fs * 8);
    d.prims.push({ k: 'rect', x: lx - 2, y: 0, w: 4, h, fill: d.border });
    items.forEach((it, i) => {
      const y = i * rh;
      const color = it.highlight ? t.colors.accent : t.colors.primary;
      d.prims.push(T(d, 0, y + rh * 0.15, lx - d.fs * 1.4, d.fs * 1.6, it.date, d.fs * 0.95, color, { weight: 800, align: 'right', font: 'heading' }));
      d.prims.push({ k: 'ellipse', x: lx - d.fs * 0.6, y: y + rh * 0.15 + d.fs * 0.2, w: d.fs * 1.2, h: d.fs * 1.2, fill: color, stroke: t.colors.background, sw: 4 });
      d.prims.push(T(d, lx + d.fs * 1.4, y + rh * 0.15, w - lx - d.fs * 1.4, d.fs * 1.6, it.title, d.fs * 1.05, d.text, { weight: 700, font: 'heading' }));
      if (it.text) d.prims.push(T(d, lx + d.fs * 1.4, y + rh * 0.15 + d.fs * 1.7, w - lx - d.fs * 1.4, rh - d.fs * 2.2, it.text, d.fs * 0.82, d.muted));
    });
    return { w, h, prims: d.prims, fonts: t.fonts };
  }
  const style = c.style ?? 'milestones';
  const cw = w / Math.max(1, n);
  const lineY = style === 'alternating' ? h / 2 : Math.min(h * 0.3, d.fs * 5);
  d.prims.push({ k: 'rect', x: 0, y: lineY - 3, w, h: 6, r: 3, fill: d.border });
  items.forEach((it, i) => {
    const x = cw * (i + 0.5);
    const color = it.highlight ? t.colors.accent : pal(d, i);
    const big = style === 'milestones';
    const s = big ? d.fs * 2.2 : d.fs * 1.2;
    d.prims.push({ k: 'ellipse', x: x - s / 2, y: lineY - s / 2, w: s, h: s, fill: big ? color : t.colors.background, stroke: color, sw: big ? 0 : 5 });
    if (big && it.icon) d.prims.push({ k: 'icon', x: x - s * 0.3, y: lineY - s * 0.3, w: s * 0.6, h: s * 0.6, name: it.icon, color: readableOn(color) });
    const up = style === 'alternating' && i % 2 === 1;
    const dateY = up ? lineY - s / 2 - d.fs * 2 : lineY - s / 2 - d.fs * 2;
    if (style === 'alternating') {
      const by = up ? d.fs * 0.2 : lineY + s;
      const bh = lineY - s - d.fs * 0.4;
      d.prims.push(T(d, x - cw * 0.47, up ? by : by + d.fs * 0.6, cw * 0.94, d.fs * 1.4, it.date, d.fs * 0.9, color, { weight: 800, align: 'center', font: 'heading' }));
      d.prims.push(T(d, x - cw * 0.47, (up ? by : by + d.fs * 0.6) + d.fs * 1.5, cw * 0.94, d.fs * 2.8, it.title, d.fs * 0.98, d.text, { weight: 700, align: 'center' }));
      if (it.text) d.prims.push(T(d, x - cw * 0.47, (up ? by : by + d.fs * 0.6) + d.fs * 3.3, cw * 0.94, bh - d.fs * 3.6, it.text, d.fs * 0.78, d.muted, { align: 'center' }));
    } else {
      d.prims.push(T(d, x - cw * 0.47, Math.max(0, dateY), cw * 0.94, d.fs * 1.5, it.date, d.fs * 0.95, color, { weight: 800, align: 'center', font: 'heading' }));
      d.prims.push(T(d, x - cw * 0.47, lineY + s / 2 + d.fs * 0.9, cw * 0.94, d.fs * 2.8, it.title, d.fs * 1.0, d.text, { weight: 700, align: 'center', font: 'heading' }));
      if (it.text) d.prims.push(T(d, x - cw * 0.46, lineY + s / 2 + d.fs * (it.title.length * d.fs * 0.55 > cw * 0.94 ? 3.6 : 2.4), cw * 0.92, h - lineY - s / 2 - d.fs * 2.6, it.text, d.fs * 0.8, d.muted, { align: 'center', lineHeight: 1.35 }));
    }
  });
  return { w, h, prims: d.prims, fonts: t.fonts };
}

/* -------------------------------- Infographic -------------------------------- */
export function buildInfographicScene(c: InfographicContent, t: Theme, w: number, h: number): Scene {
  const d = mk(t, w, h);
  const items = c.items ?? [];
  const n = items.length;
  const val = (it: (typeof items)[number]) => (typeof it.value === 'number' ? formatNumber(it.value) : it.value ?? '') + (it.unit ?? '');
  switch (c.kind) {
    case 'kpiGrid': {
      const cols = c.columns ?? Math.min(4, n);
      const rows = Math.ceil(n / cols);
      const gap = d.fs * 0.9;
      const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
      items.forEach((it, i) => {
        const x = (i % cols) * (cw + gap), y = Math.floor(i / cols) * (ch + gap);
        const color = resolveColor(it.color, t, t.colors.chart[i % t.colors.chart.length]);
        d.prims.push({ k: 'rect', x, y, w: cw, h: ch, r: 16, fill: d.surface, stroke: d.border, sw: 2 });
        d.prims.push({ k: 'rect', x, y, w: cw, h: 6, r: 3, fill: color });
        const pad = d.fs;
        let ty = y + pad;
        if (it.icon) { d.prims.push({ k: 'icon', x: x + cw - pad - d.fs * 1.8, y: ty, w: d.fs * 1.8, h: d.fs * 1.8, name: it.icon, color }); }
        d.prims.push(T(d, x + pad, ty, cw - pad * 3.5, d.fs * 1.4, it.label, d.fs * 0.85, d.muted, { weight: 600 }));
        ty += d.fs * 1.7;
        const vs = Math.min(d.fs * 2.6, ch * 0.32, (cw - pad * 2) / Math.max(3, String(val(it)).length) * 1.6);
        d.prims.push(T(d, x + pad, ty, cw - pad * 2, vs * 1.3, String(val(it)), vs, d.text, { weight: 800, font: 'heading' }));
        ty += vs * 1.3;
        if (it.delta) {
          const tc = it.trend === 'down' ? t.colors.danger ?? '#dc2626' : it.trend === 'up' ? t.colors.success ?? '#16a34a' : d.muted;
          d.prims.push(T(d, x + pad, ty, cw - pad * 2, d.fs * 1.3, `${it.trend === 'down' ? '▼' : it.trend === 'up' ? '▲' : '•'} ${it.delta}`, d.fs * 0.8, tc, { weight: 700 }));
          ty += d.fs * 1.4;
        }
        if (it.text) d.prims.push(T(d, x + pad, ty, cw - pad * 2, y + ch - ty - pad * 0.5, it.text, d.fs * 0.72, d.muted));
      });
      break;
    }
    case 'progressBars': {
      const rh = h / Math.max(1, n);
      items.forEach((it, i) => {
        const y = i * rh;
        const p = Math.max(0, Math.min(1, it.progress ?? (typeof it.value === 'number' ? it.value / 100 : 0)));
        const color = resolveColor(it.color, t, t.colors.chart[i % t.colors.chart.length]);
        const bh = Math.min(rh * 0.28, d.fs * 1.1);
        d.prims.push(T(d, 0, y + rh * 0.12, w * 0.7, d.fs * 1.4, it.label, d.fs * 0.95, d.text, { weight: 600 }));
        d.prims.push(T(d, w * 0.7, y + rh * 0.12, w * 0.3, d.fs * 1.4, it.value !== undefined ? String(val(it)) : `${Math.round(p * 100)}%`, d.fs * 0.95, color, { weight: 800, align: 'right' }));
        d.prims.push({ k: 'rect', x: 0, y: y + rh * 0.12 + d.fs * 1.7, w, h: bh, r: bh / 2, fill: withAlpha(t.colors.text, 0.08) });
        d.prims.push({ k: 'rect', x: 0, y: y + rh * 0.12 + d.fs * 1.7, w: Math.max(bh, w * p), h: bh, r: bh / 2, fill: color });
      });
      break;
    }
    case 'statRings': {
      const cols = Math.min(n, c.columns ?? n);
      const cw = w / cols;
      const r = Math.min(cw * 0.36, h * 0.32);
      items.forEach((it, i) => {
        const cx = cw * (i % cols + 0.5), cy = r + d.fs * 0.5 + Math.floor(i / cols) * (r * 2 + d.fs * 4);
        const p = Math.max(0, Math.min(1, it.progress ?? (typeof it.value === 'number' ? it.value / 100 : 0)));
        const color = resolveColor(it.color, t, t.colors.chart[i % t.colors.chart.length]);
        d.prims.push({ k: 'poly', pts: ringSlice(cx, cy, r * 0.78, r, 0, Math.PI * 2 - 0.0001), fill: withAlpha(t.colors.text, 0.08), closed: true });
        if (p > 0) d.prims.push({ k: 'poly', pts: ringSlice(cx, cy, r * 0.78, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p), fill: color, closed: true });
        d.prims.push(T(d, cx - r, cy - r, r * 2, r * 2, it.value !== undefined ? String(val(it)) : `${Math.round(p * 100)}%`, Math.min(r * 0.45, d.fs * 2), d.text, { weight: 800, align: 'center', valign: 'middle', font: 'heading' }));
        d.prims.push(T(d, cx - cw * 0.45, cy + r + d.fs * 0.6, cw * 0.9, d.fs * 2.8, it.label, d.fs * 0.9, d.text, { weight: 600, align: 'center' }));
        if (it.text) d.prims.push(T(d, cx - cw * 0.45, cy + r + d.fs * 2.1, cw * 0.9, d.fs * 2.6, it.text, d.fs * 0.72, d.muted, { align: 'center' }));
      });
      break;
    }
    case 'numberedList': case 'iconList': {
      const cols = c.columns ?? (n > 4 ? 2 : 1);
      const rows = Math.ceil(n / cols);
      const cw = w / cols, rh = h / rows;
      items.forEach((it, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * rh;
        const color = resolveColor(it.color, t, t.colors.chart[i % t.colors.chart.length]);
        const s = Math.min(rh * 0.7, d.fs * 3);
        if (c.kind === 'iconList') {
          d.prims.push({ k: 'rect', x, y: y + (rh - s) / 2 - rh * 0.1, w: s, h: s, r: s * 0.28, fill: withAlpha(color, 0.15) });
          d.prims.push({ k: 'icon', x: x + s * 0.22, y: y + (rh - s) / 2 - rh * 0.1 + s * 0.22, w: s * 0.56, h: s * 0.56, name: it.icon ?? 'check', color });
        } else d.prims.push(T(d, x, y + (rh - s) / 2 - rh * 0.1, s * 1.4, s, String(i + 1).padStart(2, '0'), s * 0.7, color, { weight: 800, font: 'heading' }));
        const tx = x + s * (c.kind === 'iconList' ? 1.35 : 1.55);
        d.prims.push(T(d, tx, y + rh * 0.12, cw - (tx - x) - d.fs, d.fs * 1.5, it.label, d.fs * 1.0, d.text, { weight: 700, font: 'heading' }));
        if (it.text) d.prims.push(T(d, tx, y + rh * 0.12 + d.fs * 1.5, cw - (tx - x) - d.fs, rh - d.fs * 2, it.text, d.fs * 0.8, d.muted));
      });
      break;
    }
    case 'pictogram': {
      const it = items[0];
      const total = c.total ?? 10;
      const value = Math.round(typeof it.value === 'number' ? it.value : parseFloat(String(it.value ?? 0)) || 0);
      const cols = Math.min(total, 10);
      const rows = Math.ceil(total / cols);
      const textW = w * 0.34;
      const s = Math.min((w - textW) / cols, (h / rows)) * 0.86;
      for (let i = 0; i < total; i++) {
        const x = (i % cols) * (s / 0.86), y = Math.floor(i / cols) * (s / 0.86) + (h - rows * (s / 0.86)) / 2;
        d.prims.push({ k: 'icon', x, y, w: s, h: s, name: c.icon ?? 'user', color: i < value ? resolveColor(it.color, t, t.colors.accent) : withAlpha(t.colors.text, 0.18) });
      }
      d.prims.push(T(d, w - textW + d.fs, h / 2 - d.fs * 3, textW - d.fs, d.fs * 3.4, `${value} / ${total}`, d.fs * 2.6, resolveColor(it.color, t, t.colors.accent), { weight: 800, font: 'heading' }));
      d.prims.push(T(d, w - textW + d.fs, h / 2 + d.fs * 0.6, textW - d.fs, d.fs * 4, [it.label, it.text].filter(Boolean).join('\n'), d.fs * 0.95, d.text));
      break;
    }
    case 'comparisonBars': {
      const rh = (h - d.fs * 2.2) / Math.max(1, n);
      const max = Math.max(...items.flatMap((it) => [Number(it.value ?? 0), Number(it.compare ?? 0)]), 1);
      const lw = w * 0.22;
      const half = (w - lw) / 2;
      const [la, lb] = c.labels ?? ['A', 'B'];
      const ca = t.colors.chart[0], cb = t.colors.chart[1];
      d.prims.push(T(d, 0, 0, half, d.fs * 1.6, la, d.fs * 0.9, ca, { weight: 800, align: 'right' }));
      d.prims.push(T(d, half + lw, 0, half, d.fs * 1.6, lb, d.fs * 0.9, cb, { weight: 800 }));
      items.forEach((it, i) => {
        const y = d.fs * 2.2 + i * rh;
        const bh = Math.min(rh * 0.56, d.fs * 1.8);
        const a = Number(it.value ?? 0) / max * (half - d.fs), b = Number(it.compare ?? 0) / max * (half - d.fs);
        d.prims.push({ k: 'rect', x: half - a, y: y + (rh - bh) / 2, w: a, h: bh, r: 6, fill: ca });
        d.prims.push({ k: 'rect', x: half + lw, y: y + (rh - bh) / 2, w: b, h: bh, r: 6, fill: cb });
        d.prims.push(T(d, half, y, lw, rh, it.label, d.fs * 0.85, d.text, { weight: 600, align: 'center', valign: 'middle' }));
        d.prims.push(T(d, half - a - 120, y, 110, rh, String(it.value ?? ''), d.fs * 0.8, d.muted, { align: 'right', valign: 'middle' }));
        d.prims.push(T(d, half + lw + b + 10, y, 120, rh, String(it.compare ?? ''), d.fs * 0.8, d.muted, { valign: 'middle' }));
      });
      break;
    }
    default:
      break;
  }
  return { w, h, prims: d.prims, fonts: t.fonts };
}
