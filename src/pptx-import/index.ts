/**
 * SlideCraft PowerPoint Import.
 * Reads a .pptx (OOXML zip) and builds a canonical, fully editable Presentation:
 * text (runs, bullets, alignment, placeholders inherited from layout/master),
 * shapes, lines/connectors, pictures (crop), tables, native charts, groups,
 * SmartArt (drawing fallback), backgrounds, notes, transitions (incl. Morph)
 * and animations. Pure: works in the browser and in Node (tests).
 */
import JSZip from 'jszip';
import type { Animation, Asset, Background, ChartContent, Gradient, Paragraph, Presentation, Run, Slide, SlideElement, Style, Theme } from '@/types/schema';
import { ASPECT_RATIOS, ELEMENT_TYPE_IDS, SHAPES } from '@/types/registry';
import { normalizePresentation } from '@/code-parser/normalize';
import { attr, bool, child, children, find, findAll, kids, num, parseXml, rel, resolveAlternate, textOf, type XNode } from './xml';
import { colorIn, colorNode, css, DEFAULT_CLRMAP, luminance, parseTheme, resolveTypeface, type ClrMap, type ColorCtx, type RGBA, type ThemeInfo } from './color';
import { parseChart } from './chart';
import { parseTiming, parseTransition } from './timing';

export interface PptxImportReport {
  warnings: string[];
  info: string[];
  stats: { slides: number; elements: number; images: number; charts: number; tables: number; groups: number; notes: number };
}
export interface PptxImportResult { presentation: Presentation; report: PptxImportReport }
export interface PptxImportOptions { fileName?: string; onProgress?: (p: number, label: string) => void }

const MAX_MEDIA = 40 * 1024 * 1024;
const NS_REL = (t: string) => t.slice(t.lastIndexOf('/') + 1);

/* --------------------------------- package -------------------------------- */
interface Rel { id: string; type: string; target: string; external: boolean }
interface Part { path: string; root: XNode; rels: Map<string, Rel> }

function dirOf(p: string): string { const i = p.lastIndexOf('/'); return i >= 0 ? p.slice(0, i) : ''; }
function joinPath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (base ? base.split('/') : []).concat(target.split('/'));
  const out: string[] = [];
  for (const s of parts) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}

class Pkg {
  private cache = new Map<string, Part | null>();
  constructor(public zip: JSZip) {}
  has(p: string): boolean { return !!this.zip.file(p); }
  async text(p: string): Promise<string | null> { const f = this.zip.file(p); return f ? f.async('string') : null; }
  async rels(p: string): Promise<Map<string, Rel>> {
    const relPath = `${dirOf(p) ? dirOf(p) + '/' : ''}_rels/${p.slice(p.lastIndexOf('/') + 1)}.rels`;
    const xml = await this.text(relPath);
    const m = new Map<string, Rel>();
    if (!xml) return m;
    for (const r of children(parseXml(xml), 'Relationship')) {
      const external = attr(r, 'TargetMode') === 'External';
      const target = attr(r, 'Target') ?? '';
      m.set(attr(r, 'Id') ?? '', { id: attr(r, 'Id') ?? '', type: NS_REL(attr(r, 'Type') ?? ''), target: external ? target : joinPath(dirOf(p), target), external });
    }
    return m;
  }
  async part(p: string | undefined): Promise<Part | null> {
    if (!p) return null;
    if (this.cache.has(p)) return this.cache.get(p)!;
    const xml = await this.text(p);
    const part = xml === null ? null : { path: p, root: parseXml(xml), rels: await this.rels(p) };
    this.cache.set(p, part);
    return part;
  }
}
const relOfType = (part: Part | null, type: string): Rel | undefined => (part ? [...part.rels.values()].find((r) => r.type === type) : undefined);

/* --------------------------------- helpers -------------------------------- */
const r2 = (v: number) => Math.round(v * 100) / 100;
function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function mimeOf(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf', wdp: 'image/vnd.ms-photo',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg', wmv: 'video/x-ms-wmv', avi: 'video/x-msvideo', mpg: 'video/mpeg', mpeg: 'video/mpeg',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', wma: 'audio/x-ms-wma', aac: 'audio/aac',
  } as Record<string, string>)[ext] ?? 'application/octet-stream';
}
const WEB_IMAGE = /^image\/(png|jpeg|gif|webp|svg\+xml|avif)$/;

function imageSize(bytes: Uint8Array, mime: string): { width?: number; height?: number } {
  try {
    if (mime === 'image/png' && bytes.length > 24) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { width: dv.getUint32(16), height: dv.getUint32(20) };
    }
    if (mime === 'image/gif' && bytes.length > 10) return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
        i += 2 + len;
      }
    }
  } catch { /* ignore */ }
  return {};
}

/* ----------------------------- placeholder model ---------------------------- */
interface PhInfo { type: string; idx?: string }
function phOf(sp: XNode): PhInfo | undefined {
  const nv = kids(sp).find((k) => k.tag.startsWith('nv'));
  const ph = child(child(nv, 'nvPr'), 'ph');
  if (!ph) return undefined;
  return { type: attr(ph, 'type') ?? 'obj', idx: attr(ph, 'idx') };
}
const isTitle = (t: string) => t === 'title' || t === 'ctrTitle';
function findPh(tree: XNode | undefined, ph: PhInfo, master: boolean): XNode | undefined {
  if (!tree) return undefined;
  const all = findAll(tree, 'sp').filter((s) => phOf(s));
  if (!master && ph.idx !== undefined) {
    const byIdx = all.find((s) => phOf(s)!.idx === ph.idx);
    if (byIdx) return byIdx;
  }
  const want = isTitle(ph.type) ? ['title', 'ctrTitle'] : ['subTitle', 'obj', 'body'].includes(ph.type) ? (master ? ['body'] : [ph.type, 'body', 'obj']) : [ph.type];
  for (const w of want) { const s = all.find((x) => phOf(x)!.type === w); if (s) return s; }
  if (master && !['dt', 'ftr', 'sldNum', 'title', 'ctrTitle'].includes(ph.type)) return all.find((x) => phOf(x)!.type === 'body');
  return undefined;
}

/* -------------------------------- transforms -------------------------------- */
/** Affine map from EMU (in the current coordinate space) to slide px. */
interface Tx { sx: number; sy: number; ox: number; oy: number }
const apply = (t: Tx, x: number, y: number) => ({ x: t.ox + x * t.sx, y: t.oy + y * t.sy });

interface Xfrm { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean; chOff?: { x: number; y: number }; chExt?: { w: number; h: number } }
function readXfrm(n: XNode | undefined): Xfrm | undefined {
  if (!n) return undefined;
  const off = child(n, 'off'), ext = child(n, 'ext');
  if (!off && !ext) return undefined;
  const x: Xfrm = { x: num(attr(off, 'x')), y: num(attr(off, 'y')), w: num(attr(ext, 'cx')), h: num(attr(ext, 'cy')), rot: num(attr(n, 'rot')) / 60000, flipH: attr(n, 'flipH') === '1', flipV: attr(n, 'flipV') === '1' };
  const co = child(n, 'chOff'), ce = child(n, 'chExt');
  if (co) x.chOff = { x: num(attr(co, 'x')), y: num(attr(co, 'y')) };
  if (ce) x.chExt = { w: num(attr(ce, 'cx')), h: num(attr(ce, 'cy')) };
  return x;
}

/* --------------------------------- context --------------------------------- */
interface SlideCtx {
  pkg: Pkg;
  part: Part; // part whose rels resolve r:ids of the nodes being read
  layout: Part | null;
  master: Part | null;
  theme: ThemeInfo;
  clr: ColorCtx;
  scale: number; // px per EMU
  size: { width: number; height: number };
  report: PptxImportReport;
  assets: Asset[];
  assetByPath: Map<string, string>;
  presDefaults?: XNode; // presentation defaultTextStyle
  idsUsed: Set<string>;
  spidToId: Map<string, string>;
  slideNo: number;
  slideTitle?: string;
  warnOnce: Set<string>;
  z: number;
  /** slice colors of the first pie/donut chart (becomes the theme chart palette) */
  sliceColors?: string[];
}
function warn(ctx: SlideCtx, msg: string, once = false) {
  if (once) { if (ctx.warnOnce.has(msg)) return; ctx.warnOnce.add(msg); }
  ctx.report.warnings.push(`Slide ${ctx.slideNo}: ${msg}`);
}
function info(ctx: SlideCtx, msg: string, once = true) {
  if (once) { if (ctx.warnOnce.has('i:' + msg)) return; ctx.warnOnce.add('i:' + msg); }
  ctx.report.info.push(`Slide ${ctx.slideNo}: ${msg}`);
}

function uniqueId(ctx: SlideCtx, base: string): string {
  let id = base || 'el';
  let n = 2;
  while (ctx.idsUsed.has(id)) id = `${base}-${n++}`;
  ctx.idsUsed.add(id);
  return id;
}
/** Element id from the shape name: "type:id" / "!!id" (SlideCraft round trip) or a slug of the name. */
function idFromName(ctx: SlideCtx, name: string | undefined, cnvId: string | undefined, fallback: string): { id: string; type?: SlideElement['type'] } {
  const n = (name ?? '').trim();
  let base = '';
  let type: SlideElement['type'] | undefined;
  if (n.startsWith('!!')) base = n.slice(2);
  else {
    const m = /^([a-zA-Z0-9]+):(.+)$/.exec(n);
    if (m && (ELEMENT_TYPE_IDS as readonly string[]).includes(m[1])) { type = m[1] as SlideElement['type']; base = m[2]; }
    else base = n;
  }
  base = slug(base.replace(/\//g, '-'));
  if (!base) base = `${fallback}-${cnvId ?? ctx.z}`;
  return { id: uniqueId(ctx, base), type };
}

/* --------------------------------- media --------------------------------- */
async function mediaAsset(ctx: SlideCtx, part: Part, rid: string | undefined, kind: 'image' | 'video' | 'audio'): Promise<string | null> {
  if (!rid) return null;
  const r = part.rels.get(rid);
  if (!r) return null;
  if (r.external) return /^https?:\/\//i.test(r.target) ? r.target : null;
  const known = ctx.assetByPath.get(r.target);
  if (known) return `asset:${known}`;
  const f = ctx.pkg.zip.file(r.target);
  if (!f) { warn(ctx, `missing media file ${r.target}.`); return null; }
  const mime = mimeOf(r.target);
  if (kind === 'image' && !WEB_IMAGE.test(mime)) { warn(ctx, `image format ${mime.replace('image/', '').toUpperCase()} cannot be shown in the browser (${r.target.split('/').pop()}) — replaced by a placeholder.`); return null; }
  const bytes = await f.async('uint8array');
  if (kind !== 'image' && bytes.length > MAX_MEDIA) { warn(ctx, `${kind} ${r.target.split('/').pop()} is larger than 40 MB and was not embedded.`); return null; }
  const b64 = await f.async('base64');
  const id = `pptx-${kind === 'image' ? 'img' : kind}-${ctx.assets.length + 1}`;
  const a: Asset = { id, type: mime === 'image/svg+xml' ? 'svg' : kind, src: `data:${mime};base64,${b64}`, name: r.target.split('/').pop(), mime, size: bytes.length };
  if (kind === 'image') Object.assign(a, imageSize(bytes, mime));
  ctx.assets.push(a);
  ctx.assetByPath.set(r.target, id);
  return `asset:${id}`;
}

/* ---------------------------------- fills ---------------------------------- */
interface FillResult { fill?: string; gradient?: Gradient; image?: { node: XNode }; none?: boolean }
function gradientOf(g: XNode, cc: ColorCtx): Gradient | undefined {
  const stops = children(child(g, 'gsLst'), 'gs').map((gs) => ({ color: css(colorIn(gs, cc)) ?? '#000000', offset: Math.max(0, Math.min(1, num(attr(gs, 'pos')) / 100000)) })).sort((a, b) => a.offset - b.offset);
  if (stops.length < 2) return stops.length === 1 ? { type: 'linear', angle: 0, stops: [stops[0], { ...stops[0], offset: 1 }] } : undefined;
  const lin = child(g, 'lin');
  const pathN = child(g, 'path');
  if (pathN && !lin) return { type: 'radial', stops };
  return { type: 'linear', angle: lin ? Math.round(num(attr(lin, 'ang')) / 60000) : 90, stops };
}
function fillOf(container: XNode | undefined, cc: ColorCtx): FillResult | undefined {
  for (const k of kids(container)) {
    switch (k.tag) {
      case 'noFill': return { none: true };
      case 'solidFill': { const c = colorIn(k, cc); return c ? { fill: css(c) } : undefined; }
      case 'gradFill': { const g = gradientOf(k, cc); return g ? { gradient: g, fill: g.stops[0].color } : undefined; }
      case 'pattFill': { const c = colorIn(child(k, 'fgClr'), cc); return c ? { fill: css(c) } : undefined; }
      case 'blipFill': return { image: { node: k } };
      case 'grpFill': return undefined;
      default: break;
    }
  }
  return undefined;
}
/** Fill from the theme style matrix (fillRef / bgRef). */
function styleRefFill(list: XNode[], idx: number, ref: XNode, cc: ColorCtx): FillResult | undefined {
  const ph = colorIn(ref, cc);
  const entry = list[idx - 1];
  if (!entry) return ph ? { fill: css(ph) } : undefined;
  const sub: ColorCtx = { ...cc, phClr: ph };
  return fillOf({ tag: 'x', attrs: {}, children: [entry] }, sub);
}

interface LineResult { color?: string; width: number; dash?: 'solid' | 'dash' | 'dot' | 'dashDot'; head?: string; tail?: string; none?: boolean }
const HEAD: Record<string, string> = { triangle: 'triangle', arrow: 'arrow', stealth: 'triangle', oval: 'oval', diamond: 'diamond' };
function lineOf(ln: XNode | undefined, cc: ColorCtx, scale: number, refColor?: RGBA, refW?: number): LineResult | undefined {
  if (!ln && !refColor) return undefined;
  if (child(ln, 'noFill')) return { none: true, width: 0 };
  const solid = child(ln, 'solidFill');
  const grad = child(ln, 'gradFill');
  let c = solid ? colorIn(solid, cc) : grad ? colorIn(child(child(grad, 'gsLst'), 'gs'), cc) : refColor;
  if (!c && ln && attr(ln, 'w')) c = refColor;
  if (!c) return undefined;
  const w = attr(ln, 'w') !== undefined ? num(attr(ln, 'w')) : refW ?? 9525;
  const dash = attr(child(ln, 'prstDash'), 'val');
  const out: LineResult = { color: css(c), width: Math.max(0.5, r2(w * scale)) };
  if (dash && dash !== 'solid') out.dash = /dot/i.test(dash) && !/dash/i.test(dash) ? 'dot' : /dashDot/i.test(dash) ? 'dashDot' : 'dash';
  const he = attr(child(ln, 'headEnd'), 'type'), te = attr(child(ln, 'tailEnd'), 'type');
  if (he && he !== 'none') out.head = HEAD[he] ?? 'triangle';
  if (te && te !== 'none') out.tail = HEAD[te] ?? 'triangle';
  return out;
}

function shadowOf(spPr: XNode | undefined, cc: ColorCtx, scale: number): Style['shadow'] | undefined {
  const sh = child(child(spPr, 'effectLst'), 'outerShdw');
  if (!sh) return undefined;
  const dist = num(attr(sh, 'dist')) * scale, dir = (num(attr(sh, 'dir')) / 60000) * (Math.PI / 180);
  const c = colorIn(sh, cc) ?? { r: 0, g: 0, b: 0, a: 0.35 };
  return { x: r2(Math.cos(dir) * dist), y: r2(Math.sin(dir) * dist), blur: r2(num(attr(sh, 'blurRad')) * scale), color: css(c)! };
}

/* ----------------------------------- text ----------------------------------- */
interface TextChain {
  lvl: (level: number) => XNode[];
  /** number of leading entries of lvl() that come from the shape / its placeholders (the rest are master/presentation defaults) */
  ownCount: (level: number) => number;
  fontRefColor?: RGBA;
  bodyPr: Record<string, string>;
  bodyPrNodes: XNode[];
}

function lstLevel(lst: XNode | undefined, level: number): XNode | undefined {
  return lst ? child(lst, `lvl${level + 1}pPr`) : undefined;
}
function buildChain(ctx: SlideCtx, sp: XNode, inherited: XNode[], kind: 'title' | 'body' | 'other', isPh: boolean): TextChain {
  const lists: XNode[] = [];
  const own = child(child(sp, 'txBody'), 'lstStyle');
  if (own) lists.push(own);
  for (const s of inherited) { const l = child(child(s, 'txBody'), 'lstStyle'); if (l) lists.push(l); }
  const txStyles = child(ctx.master?.root, 'txStyles');
  const masterStyle = isPh ? child(txStyles, kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle') : undefined;
  const tail: XNode[] = [];
  if (masterStyle) tail.push(masterStyle);
  if (ctx.presDefaults) tail.push(ctx.presDefaults);
  const fontRef = child(child(sp, 'style'), 'fontRef');
  const bodyPrNodes = [child(child(sp, 'txBody'), 'bodyPr'), ...inherited.map((s) => child(child(s, 'txBody'), 'bodyPr'))].filter(Boolean) as XNode[];
  const bodyPr: Record<string, string> = {};
  for (const b of [...bodyPrNodes].reverse()) Object.assign(bodyPr, b.attrs);
  return {
    lvl: (level) => [...lists, ...tail].map((l) => lstLevel(l, level) ?? (l === ctx.presDefaults ? child(l, 'defPPr') : undefined)).filter(Boolean) as XNode[],
    ownCount: (level) => lists.filter((l) => lstLevel(l, level)).length,
    fontRefColor: fontRef ? colorIn(fontRef, ctx.clr) : undefined,
    bodyPr,
    bodyPrNodes,
  };
}

interface RunOut extends Run { _size: number; _font?: string; _color?: string; _bold: boolean; _italic: boolean; _caps?: boolean }
interface ParaOut { runs: RunOut[]; list?: 'bullet' | 'number'; level: number; align?: Paragraph['align']; lnSpc?: number; spcAft: number; spcBef: number }

function parseParagraphs(ctx: SlideCtx, part: Part, txBody: XNode, chain: TextChain, fontScale: number): ParaOut[] {
  const ptPx = 12700 * ctx.scale; // px per point
  const out: ParaOut[] = [];
  for (const p of children(txBody, 'p')) {
    const pPr = child(p, 'pPr');
    const level = Math.min(4, num(attr(pPr, 'lvl')));
    const levels = chain.lvl(level);
    const pa = (name: string) => attr(pPr, name) ?? levels.map((l) => attr(l, name)).find((v) => v !== undefined);
    const pc = (name: string) => child(pPr, name) ?? levels.map((l) => child(l, name)).find(Boolean);
    const bu = (() => {
      const nodes = [pPr, ...levels];
      for (const n of nodes) {
        if (!n) continue;
        if (child(n, 'buNone')) return undefined;
        if (child(n, 'buAutoNum')) return 'number' as const;
        if (child(n, 'buChar') || child(n, 'buBlip')) return 'bullet' as const;
      }
      return undefined;
    })();
    const algn = pa('algn');
    const align = ({ l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify', justLow: 'justify' } as Record<string, Paragraph['align']>)[algn ?? ''];
    const lnSpcNode = pc('lnSpc');
    let lnSpc: number | undefined;
    if (child(lnSpcNode, 'spcPct')) lnSpc = num(attr(child(lnSpcNode, 'spcPct'), 'val'), 100000) / 100000;
    const spcOf = (n: XNode | undefined) => (child(n, 'spcPts') ? (num(attr(child(n, 'spcPts'), 'val')) / 100) * ptPx : 0);
    const spcAft = spcOf(pc('spcAft')), spcBef = spcOf(pc('spcBef'));
    const runs: RunOut[] = [];
    const endRPr = child(p, 'endParaRPr');
    const runProps = (rPr: XNode | undefined) => {
      const ra = (name: string) => attr(rPr, name) ?? levels.map((l) => attr(child(l, 'defRPr'), name)).find((v) => v !== undefined);
      const rc = (name: string) => child(rPr, name) ?? levels.map((l) => child(child(l, 'defRPr'), name)).find(Boolean);
      return { ra, rc };
    };
    const mkRun = (text: string, rPr: XNode | undefined, link?: string): RunOut => {
      const { ra, rc } = runProps(rPr);
      const sz = num(ra('sz'), 1800) / 100;
      // color priority: run → shape/placeholder list styles → shape style (fontRef) → master/presentation defaults
      const own = levels.slice(0, chain.ownCount(level));
      const tail = levels.slice(chain.ownCount(level));
      const fillFrom = (n: XNode | undefined) => child(n, 'solidFill') ?? (child(n, 'gradFill') ? child(child(child(n, 'gradFill'), 'gsLst'), 'gs') : undefined);
      const ownFill = fillFrom(rPr) ?? own.map((l) => fillFrom(child(l, 'defRPr'))).find(Boolean);
      const tailFill = tail.map((l) => fillFrom(child(l, 'defRPr'))).find(Boolean);
      const col = ownFill ? colorIn(ownFill, ctx.clr) : chain.fontRefColor ?? (tailFill ? colorIn(tailFill, ctx.clr) : undefined);
      const color = css(col ?? colorNode({ tag: 'schemeClr', attrs: { val: 'tx1' }, children: [] }, ctx.clr));
      const latin = rc('latin');
      const font = resolveTypeface(attr(latin, 'typeface'), ctx.theme) ?? resolveTypeface(attr(rc('ea'), 'typeface'), ctx.theme) ?? ctx.theme.minorFont;
      const r: RunOut = { text, _size: r2(sz * fontScale * ptPx), _font: font, _color: color, _bold: bool(ra('b')) ?? false, _italic: bool(ra('i')) ?? false, _caps: ra('cap') === 'all' };
      const u = ra('u');
      if (u && u !== 'none') r.underline = true;
      const st = ra('strike');
      if (st && st !== 'noStrike') r.strike = true;
      const base = num(ra('baseline'));
      if (base > 0) r.superscript = true; else if (base < 0) r.subscript = true;
      const hl = rc('highlight');
      if (hl) { const h = colorIn(hl, ctx.clr); if (h) r.highlight = css(h); }
      const hlink = child(rPr, 'hlinkClick');
      const href = link ?? (hlink ? part.rels.get(rel(hlink, 'id') ?? '')?.target : undefined);
      if (href && /^(https?:|mailto:)/i.test(href)) r.link = href;
      return r;
    };
    for (const k of kids(p)) {
      if (k.tag === 'r') runs.push(mkRun(textOf(child(k, 't')), child(k, 'rPr')));
      else if (k.tag === 'fld') runs.push(mkRun(textOf(child(k, 't')), child(k, 'rPr')));
      else if (k.tag === 'br') { const last = runs[runs.length - 1]; if (last) last.text += '\n'; else runs.push({ ...mkRun('\n', child(k, 'rPr')) }); }
      else if (k.tag === 'AlternateContent') {
        const alt = resolveAlternate(k, []);
        const t = alt.map((a) => textOf(find(a, 't') ?? a)).join('');
        if (t) runs.push(mkRun(t, undefined));
        info(ctx, 'equations are imported as plain text.');
      } else if (k.tag === 'm' || k.tag === 'oMathPara' || k.tag === 'oMath') {
        runs.push(mkRun(textOf(k), undefined));
        info(ctx, 'equations are imported as plain text.');
      }
    }
    if (!runs.length) runs.push(mkRun('', endRPr));
    out.push({ runs, list: runs.some((r) => r.text.trim()) ? bu : undefined, level, align, lnSpc, spcAft, spcBef });
  }
  return out;
}

/** Convert parsed paragraphs into element style + compact paragraphs (runs only keep differences). */
function finishText(ps: ParaOut[], lnReduction: number): { style: Style; paragraphs: Paragraph[]; caps: boolean } {
  const all = ps.flatMap((p) => p.runs);
  const textRuns = all.filter((r) => r.text.trim());
  const ref = textRuns[0] ?? all[0];
  const style: Style = {};
  style.fontSize = ref?._size ?? 36;
  if (ref?._font) style.fontFamily = ref._font;
  if (ref?._color) style.color = ref._color;
  const allBold = textRuns.length > 0 && textRuns.every((r) => r._bold);
  const allItalic = textRuns.length > 0 && textRuns.every((r) => r._italic);
  style.fontWeight = allBold ? 700 : 400;
  if (allItalic) style.italic = true;
  const caps = textRuns.length > 0 && textRuns.every((r) => r._caps);
  if (caps) style.textTransform = 'uppercase';
  const aligns = ps.filter((p) => p.runs.some((r) => r.text)).map((p) => p.align ?? 'left');
  const mainAlign = aligns[0] ?? ps[0]?.align ?? 'left';
  style.align = mainAlign;
  const ln = ps.find((p) => p.lnSpc !== undefined)?.lnSpc;
  // PowerPoint "single" spacing ≈ CSS line-height 1.2; explicit percentages map 1:1 (same convention as the exporter)
  style.lineHeight = ln === undefined ? r2(1.2 * (1 - lnReduction)) : r2(Math.max(0.6, ln * (1 - lnReduction)));
  const spc = ps.map((p) => p.spcAft + p.spcBef).find((v) => v > 0);
  if (spc) style.paragraphSpacing = r2(spc);
  const paragraphs: Paragraph[] = ps.map((p) => {
    const runs: Run[] = p.runs.map((r) => {
      const o: Run = { text: caps ? r.text : r._caps ? r.text.toUpperCase() : r.text };
      if (r._bold && !allBold) o.bold = true;
      if (r._italic && !allItalic) o.italic = true;
      if (r.underline) o.underline = true;
      if (r.strike) o.strike = true;
      if (r.superscript) o.superscript = true;
      if (r.subscript) o.subscript = true;
      if (r.highlight) o.highlight = r.highlight;
      if (r.link) o.link = r.link;
      if (r._color && r._color !== style.color) o.color = r._color;
      if (Math.abs(r._size - (style.fontSize ?? 0)) > 0.4) o.fontSize = r._size;
      if (r._font && r._font !== style.fontFamily) o.fontFamily = r._font;
      return o;
    });
    // merge adjacent runs with identical formatting
    const fmt = (r: Run) => JSON.stringify({ ...r, text: undefined });
    const merged: Run[] = [];
    for (const r of runs) {
      const prev = merged[merged.length - 1];
      if (prev && fmt(prev) === fmt(r)) prev.text += r.text; else merged.push(r);
    }
    const para: Paragraph = { runs: merged };
    if (p.list) para.list = p.list;
    if (p.level) para.level = p.level;
    if (p.align && p.align !== mainAlign) para.align = p.align;
    return para;
  });
  return { style, paragraphs, caps };
}

/* ------------------------------ custom geometry ------------------------------ */
function custGeomSvg(geom: XNode, w: number, h: number, fill: FillResult | undefined, line: LineResult | undefined, id: string): string | null {
  const paths = children(child(geom, 'pathLst'), 'path');
  if (!paths.length) return null;
  const parts: string[] = [];
  for (const p of paths) {
    const pw = num(attr(p, 'w')) || 1, ph = num(attr(p, 'h')) || 1;
    const sx = w / pw, sy = h / ph;
    const pt = (n: XNode | undefined) => [num(attr(n, 'x')) * sx, num(attr(n, 'y')) * sy];
    let cx = 0, cy = 0;
    const d: string[] = [];
    for (const c of kids(p)) {
      const pts = children(c, 'pt').map(pt);
      if (c.tag === 'moveTo' && pts[0]) { d.push(`M${r2(pts[0][0])} ${r2(pts[0][1])}`); [cx, cy] = pts[0]; }
      else if (c.tag === 'lnTo' && pts[0]) { d.push(`L${r2(pts[0][0])} ${r2(pts[0][1])}`); [cx, cy] = pts[0]; }
      else if (c.tag === 'cubicBezTo' && pts.length === 3) { d.push(`C${pts.map((q) => `${r2(q[0])} ${r2(q[1])}`).join(' ')}`); [cx, cy] = pts[2]; }
      else if (c.tag === 'quadBezTo' && pts.length === 2) { d.push(`Q${pts.map((q) => `${r2(q[0])} ${r2(q[1])}`).join(' ')}`); [cx, cy] = pts[1]; }
      else if (c.tag === 'arcTo') {
        const wR = num(attr(c, 'wR')) * sx, hR = num(attr(c, 'hR')) * sy;
        const st = (num(attr(c, 'stAng')) / 60000) * (Math.PI / 180), sw = (num(attr(c, 'swAng')) / 60000) * (Math.PI / 180);
        const ccx = cx - wR * Math.cos(st), ccy = cy - hR * Math.sin(st);
        const ex = ccx + wR * Math.cos(st + sw), ey = ccy + hR * Math.sin(st + sw);
        d.push(`A${r2(wR)} ${r2(hR)} 0 ${Math.abs(sw) > Math.PI ? 1 : 0} ${sw > 0 ? 1 : 0} ${r2(ex)} ${r2(ey)}`);
        cx = ex; cy = ey;
      } else if (c.tag === 'close') d.push('Z');
    }
    const noFill = attr(p, 'fill') === 'none';
    const stroke = attr(p, 'stroke') !== '0' && line && !line.none ? `stroke="${line.color}" stroke-width="${line.width}"${line.dash === 'dash' ? ` stroke-dasharray="${line.width * 3} ${line.width * 2}"` : line.dash === 'dot' ? ` stroke-dasharray="${line.width} ${line.width * 1.6}"` : ''}` : 'stroke="none"';
    const f = noFill || !fill || fill.none ? 'none' : fill.gradient ? `url(#${id}-g)` : fill.fill ?? 'none';
    parts.push(`<path d="${d.join(' ')}" fill="${f}" ${stroke} fill-rule="evenodd"/>`);
  }
  let defs = '';
  if (fill?.gradient) {
    const g = fill.gradient;
    const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
    defs = g.type === 'radial' ? `<defs><radialGradient id="${id}-g">${stops}</radialGradient></defs>` : `<defs><linearGradient id="${id}-g" gradientTransform="rotate(${g.angle ?? 0} .5 .5)">${stops}</linearGradient></defs>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(Math.max(1, w))} ${r2(Math.max(1, h))}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="none" overflow="visible">${defs}${parts.join('')}</svg>`;
}

/* ------------------------------ shape mapping ------------------------------ */
const PRST_TO_SHAPE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, v] of Object.entries(SHAPES)) if (!m[v]) m[v] = k;
  Object.assign(m, {
    rect: 'rect', roundRect: 'roundRect', snip1Rect: 'roundRect', snip2SameRect: 'roundRect', round1Rect: 'roundRect', round2SameRect: 'roundRect', round2DiagRect: 'roundRect', snipRoundRect: 'roundRect', flowChartAlternateProcess: 'roundRect', flowChartTerminator: 'pill',
    flowChartProcess: 'rect', flowChartPredefinedProcess: 'rect', flowChartInternalStorage: 'rect', flowChartDocument: 'rect', plaque: 'roundRect', frame: 'rect', bevel: 'rect', foldedCorner: 'rect', textBox: 'rect',
    ellipse: 'ellipse', flowChartConnector: 'ellipse', circle: 'ellipse', pie: 'ellipse', chord: 'ellipse', flowChartOnlineStorage: 'rect',
    triangle: 'triangle', flowChartExtract: 'triangle', flowChartMerge: 'triangle', rtTriangle: 'rightTriangle', diamond: 'diamond', flowChartDecision: 'diamond',
    pentagon: 'pentagon', homePlate: 'homePlate', hexagon: 'hexagon', flowChartPreparation: 'hexagon', heptagon: 'hexagon', octagon: 'octagon', decagon: 'octagon', dodecagon: 'octagon',
    star4: 'star5', star5: 'star5', star6: 'star5', star7: 'star5', star8: 'star8', star10: 'star8', star12: 'star8', star16: 'star8', star24: 'star8', star32: 'star8', irregularSeal1: 'star8', irregularSeal2: 'star8',
    parallelogram: 'parallelogram', flowChartInputOutput: 'parallelogram', trapezoid: 'trapezoid', flowChartManualOperation: 'trapezoid', chevron: 'chevron',
    rightArrow: 'arrowRight', notchedRightArrow: 'arrowRight', stripedRightArrow: 'arrowRight', rightArrowCallout: 'arrowRight', leftArrow: 'arrowLeft', leftArrowCallout: 'arrowLeft', upArrow: 'arrowUp', upArrowCallout: 'arrowUp', downArrow: 'arrowDown', downArrowCallout: 'arrowDown',
    heart: 'heart', mathPlus: 'plus', plus: 'plus', donut: 'ring', noSmoking: 'ring', blockArc: 'blockArc', arc: 'blockArc',
    wedgeRoundRectCallout: 'speechBubble', wedgeRectCallout: 'speechBubble', wedgeEllipseCallout: 'speechBubble', borderCallout1: 'speechBubble', callout1: 'speechBubble', cloudCallout: 'cloud', cloud: 'cloud', halfFrame: 'halfFrame', corner: 'halfFrame',
  });
  return m;
})();
const LINE_PRST = /^(line|straightConnector1|bentConnector\d|curvedConnector\d|lineInv)$/;

/* ------------------------------ element building ------------------------------ */
type Raw = SlideElement;

function geomBox(t: Tx, x: Xfrm): { x: number; y: number; width: number; height: number; rotation?: number } {
  const p = apply(t, x.x, x.y);
  const out: { x: number; y: number; width: number; height: number; rotation?: number } = { x: r2(p.x), y: r2(p.y), width: r2(Math.max(1, x.w * t.sx)), height: r2(Math.max(1, x.h * t.sy)) };
  const rot = ((x.rot % 360) + 360) % 360;
  if (rot > 0.01 && rot < 359.99) out.rotation = r2(rot > 180 ? rot - 360 : rot);
  return out;
}

async function buildSp(ctx: SlideCtx, sp: XNode, t: Tx, grpFill: FillResult | undefined, source: 'slide' | 'layout' | 'master'): Promise<Raw | Raw[] | null> {
  const nv = child(sp, 'nvSpPr') ?? child(sp, 'nvCxnSpPr');
  const cNvPr = child(nv, 'cNvPr');
  const name = attr(cNvPr, 'name');
  const cnvId = attr(cNvPr, 'id');
  const ph = phOf(sp);
  if (ph && source !== 'slide') return null; // layout/master placeholders are prompts only
  // inheritance chain
  const inherited: XNode[] = [];
  if (ph && source === 'slide') {
    const lsp = findPh(child(ctx.layout?.root, 'cSld'), ph, false);
    if (lsp) inherited.push(lsp);
    const msp = findPh(child(ctx.master?.root, 'cSld'), ph, true);
    if (msp) inherited.push(msp);
  }
  const spPr = child(sp, 'spPr');
  const xf = readXfrm(child(spPr, 'xfrm')) ?? inherited.map((s) => readXfrm(child(child(s, 'spPr'), 'xfrm'))).find(Boolean);
  const txBody = child(sp, 'txBody');
  const hasText = !!txBody && children(txBody, 'p').some((p) => textOf(p).length > 0 || kids(p).some((k) => k.tag === 'br'));
  if (ph && !hasText) return null; // empty placeholders are never shown in a slide show
  if (!xf) { if (hasText) warn(ctx, `"${name || 'shape'}" has no position; placed at the top-left.`); else return null; }
  const box = geomBox(t, xf ?? { x: 0, y: 0, w: ctx.size.width / ctx.scale / 2, h: ctx.size.height / ctx.scale / 4, rot: 0, flipH: false, flipV: false });
  const geom = child(spPr, 'prstGeom') ?? inherited.map((s) => child(child(s, 'spPr'), 'prstGeom')).find(Boolean);
  const cust = child(spPr, 'custGeom');
  const prst = attr(geom, 'prst') ?? (cust ? 'custom' : 'rect');
  // style matrix refs
  const styleN = child(sp, 'style');
  const fillRef = child(styleN, 'fillRef'), lnRef = child(styleN, 'lnRef');
  let fill = fillOf(spPr, ctx.clr) ?? inherited.map((s) => fillOf(child(s, 'spPr'), ctx.clr)).find(Boolean);
  if (!fill && fillRef && num(attr(fillRef, 'idx')) > 0) fill = styleRefFill(ctx.theme.fills, num(attr(fillRef, 'idx')), fillRef, ctx.clr);
  if (!fill && child(spPr, 'grpFill')) fill = grpFill;
  const lnIdx = num(attr(lnRef, 'idx'));
  const themeLine = lnIdx > 0 ? ctx.theme.lines[lnIdx - 1] : undefined;
  const ln = lineOf(child(spPr, 'ln') ?? inherited.map((s) => child(child(s, 'spPr'), 'ln')).find(Boolean), ctx.clr, ctx.scale, lnIdx > 0 && lnRef ? colorIn(lnRef, ctx.clr) : undefined, themeLine ? num(attr(themeLine, 'w'), 9525) : undefined);
  const shadow = shadowOf(spPr, ctx.clr, ctx.scale);
  const hidden = attr(cNvPr, 'hidden') === '1';
  const hl = child(cNvPr, 'hlinkClick');
  const href = hl ? ctx.part.rels.get(rel(hl, 'id') ?? '')?.target : undefined;
  const common = (el: Raw) => {
    if (hidden) el.visible = false;
    if (href && /^(https?:|mailto:)/i.test(href)) el.link = href;
    if (name && !/^(!!|[a-zA-Z0-9]+:)/.test(name)) el.name = name;
    if (cnvId && source === 'slide') ctx.spidToId.set(cnvId, el.id);
    el.zIndex = ctx.z++;
    return el;
  };

  // ---- connectors / lines ----
  if (LINE_PRST.test(prst) || sp.tag === 'cxnSp') {
    if (!/^(line|straightConnector1|lineInv)$/.test(prst)) info(ctx, 'elbow/curved connectors are imported as straight lines.');
    const x0 = box.x, y0 = box.y, x1 = box.x + (xf ? xf.w * t.sx : box.width), y1 = box.y + (xf ? xf.h * t.sy : box.height);
    let [ax, ay, bx, by] = [x0, y0, x1, y1];
    if (xf?.flipH) [ax, bx] = [bx, ax];
    if (xf?.flipV) [ay, by] = [by, ay];
    if (box.rotation) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, a = (box.rotation * Math.PI) / 180;
      const rot = (px: number, py: number) => [cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a), cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)];
      [ax, ay] = rot(ax, ay); [bx, by] = rot(bx, by);
    }
    const l = ln && !ln.none ? ln : { color: css(colorNode({ tag: 'schemeClr', attrs: { val: 'tx1' }, children: [] }, ctx.clr)), width: 2 } as LineResult;
    const { id } = idFromName(ctx, name, cnvId, 'line');
    const style: Style = { stroke: { color: l.color, width: l.width, ...(l.dash ? { dash: l.dash } : {}) } };
    if (l.head) style.headStart = l.head as Style['headStart'];
    if (l.tail) style.headEnd = l.tail as Style['headEnd'];
    if (!l.head && !l.tail) { style.headStart = 'none'; style.headEnd = 'none'; }
    return common({ id, type: l.head || l.tail ? 'arrow' : 'line', x: 0, y: 0, width: 1, height: 1, content: { x1: r2(ax), y1: r2(ay), x2: r2(bx), y2: r2(by) }, style });
  }

  // ---- shape filled with a picture → image element ----
  if (fill?.image && !hasText) {
    const img = await pictureFrom(ctx, fill.image.node, box, name, cnvId, prst);
    if (img) { if (shadow) img.style = { ...img.style, shadow }; return common(img); }
  }

  // ---- text ----
  let paragraphs: Paragraph[] | undefined;
  let textStyle: Style = {};
  if (hasText && txBody) {
    const kind = ph ? (isTitle(ph.type) ? 'title' : ['body', 'subTitle', 'obj'].includes(ph.type) || !['dt', 'ftr', 'sldNum'].includes(ph.type) ? 'body' : 'other') : 'other';
    const chain = buildChain(ctx, sp, inherited, kind, !!ph);
    const auto = chain.bodyPrNodes.map((b) => child(b, 'normAutofit')).find(Boolean);
    const fontScale = auto ? num(attr(auto, 'fontScale'), 100000) / 100000 : 1;
    const lnRed = auto ? num(attr(auto, 'lnSpcReduction')) / 100000 : 0;
    const ps = parseParagraphs(ctx, ctx.part, txBody, chain, fontScale);
    const fin = finishText(ps, lnRed);
    paragraphs = fin.paragraphs;
    textStyle = fin.style;
    const b = chain.bodyPr;
    const ins = (k: string, d: number) => r2((b[k] !== undefined ? num(b[k]) : d) * ctx.scale);
    textStyle.padding = [ins('tIns', 45720), ins('rIns', 91440), ins('bIns', 45720), ins('lIns', 91440)];
    const anchor = b.anchor;
    textStyle.verticalAlign = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top';
    if (b.vert && b.vert !== 'horz') warn(ctx, `vertical text in "${name || 'text box'}" is shown horizontally.`, true);
    if (Number(b.rot)) info(ctx, 'rotated text inside shapes is not rotated separately.');
  }

  const visibleFill = !!fill && !fill.none && (fill.fill || fill.gradient);
  const visibleLine = !!ln && !ln.none;
  const { id, type: hinted } = idFromName(ctx, name, cnvId, hasText ? 'text' : 'shape');

  // ---- custom geometry without text → vector picture ----
  if (prst === 'custom' && cust && !hasText) {
    const markup = custGeomSvg(cust, box.width, box.height, fill, ln, id);
    if (markup) {
      info(ctx, 'freeform shapes are imported as vector graphics (SVG).');
      const el: Raw = { id, type: 'svg', ...box, content: { markup }, style: {} };
      if (xf?.flipH) el.style!.flipH = true;
      if (xf?.flipV) el.style!.flipV = true;
      return common(el);
    }
  }
  // custom geometry WITH text → vector shape + an editable text box on top (same box)
  if (prst === 'custom' && cust && hasText) {
    const markup = custGeomSvg(cust, box.width, box.height, fill, ln, `${id}-shape`);
    if (markup) {
      info(ctx, 'freeform shapes with text are imported as a vector graphic plus a text box.');
      const shapeEl: Raw = { id: uniqueId(ctx, `${id}-shape`), type: 'svg', ...box, content: { markup }, style: {}, zIndex: ctx.z++ };
      if (name) shapeEl.name = `${name} (shape)`;
      const textEl = common({ id, type: 'text', ...box, content: { paragraphs }, style: { ...textStyle, ...(shadow ? { textShadow: shadow } : {}) } });
      return [shapeEl, textEl];
    }
  }
  if (prst === 'custom') warn(ctx, `freeform shape "${name || id}" with text is imported as a rectangle.`, true);

  const shapeKind = PRST_TO_SHAPE[prst] ?? (prst === 'custom' ? 'rect' : undefined);
  if (!shapeKind) warn(ctx, `shape "${prst}" is not available; imported as a rectangle.`, true);
  const isPlainBox = (shapeKind ?? 'rect') === 'rect' && !visibleFill && !visibleLine;

  if (hasText && isPlainBox) {
    const type: SlideElement['type'] = hinted && ['text', 'heading', 'paragraph', 'richText'].includes(hinted) ? hinted : ph && isTitle(ph.type) ? 'heading' : (paragraphs?.length ?? 0) > 1 || paragraphs?.some((p) => p.list) ? 'paragraph' : 'text';
    const style: Style = { ...textStyle };
    if (shadow) style.textShadow = shadow;
    if (ph && isTitle(ph.type) && !ctx.slideTitle) ctx.slideTitle = paragraphs!.map((p) => p.runs.map((r) => r.text).join('')).join(' ').trim();
    return common({ id, type, ...box, content: { paragraphs }, style });
  }

  const style: Style = { ...textStyle };
  if (visibleFill) { if (fill!.gradient) style.gradient = fill!.gradient; style.fill = fill!.fill; } else style.fill = 'transparent';
  if (visibleLine) style.stroke = { color: ln!.color, width: ln!.width, ...(ln!.dash ? { dash: ln!.dash } : {}) };
  if (shadow) style.shadow = shadow;
  if (xf?.flipH) style.flipH = true;
  if (xf?.flipV) style.flipV = true;
  let kind = shapeKind ?? 'rect';
  if (kind === 'roundRect' || kind === 'pill') {
    const adj = child(child(geom, 'avLst'), 'gd');
    const a = adj ? Math.min(50000, num((attr(adj, 'fmla') ?? '').replace('val ', ''), 16667)) : 16667;
    style.radius = r2((a / 100000) * Math.min(box.width, box.height));
    kind = 'roundRect';
  }
  if (!hasText) { delete style.padding; }
  if (ph && isTitle(ph.type) && hasText && !ctx.slideTitle) ctx.slideTitle = paragraphs!.map((p) => p.runs.map((r) => r.text).join('')).join(' ').trim();
  const content: Record<string, unknown> = { shape: kind };
  if (hasText) content.paragraphs = paragraphs;
  return common({ id, type: 'shape', ...box, content, style });
}

async function pictureFrom(ctx: SlideCtx, blipFill: XNode, box: ReturnType<typeof geomBox>, name: string | undefined, cnvId: string | undefined, prst: string, alt?: string): Promise<Raw | null> {
  const blip = child(blipFill, 'blip');
  const svgBlip = find(blip, 'svgBlip');
  let src = svgBlip ? await mediaAsset(ctx, ctx.part, rel(svgBlip, 'embed'), 'image') : null;
  if (!src) src = await mediaAsset(ctx, ctx.part, rel(blip, 'embed') ?? rel(blip, 'link'), 'image');
  const { id } = idFromName(ctx, name, cnvId, 'image');
  const style: Style = { fit: 'fill' };
  const sr = child(blipFill, 'srcRect');
  if (sr) {
    const l = num(attr(sr, 'l')) / 100000, tp = num(attr(sr, 't')) / 100000, r = num(attr(sr, 'r')) / 100000, b = num(attr(sr, 'b')) / 100000;
    if (l || tp || r || b) style.crop = { x: r2(l * 1000) / 1000, y: r2(tp * 1000) / 1000, width: Math.max(0.01, r2((1 - l - r) * 1000) / 1000), height: Math.max(0.01, r2((1 - tp - b) * 1000) / 1000) };
  }
  if (prst === 'ellipse') style.mask = 'circle';
  else if (prst === 'roundRect') style.mask = 'rounded';
  else if (prst === 'hexagon') style.mask = 'hexagon';
  else if (prst === 'diamond') style.mask = 'diamond';
  const amt = child(blip, 'alphaModFix');
  const el: Raw = { id, type: 'image', ...box, content: src ? { src, alt: alt ?? name ?? '' } : { alt: alt ?? name ?? 'Image', query: alt || undefined }, style };
  if (amt) el.opacity = r2(num(attr(amt, 'amt'), 100000) / 100000);
  if (find(blip, 'grayscl')) style.grayscale = true;
  if (!src) warn(ctx, `picture "${name || id}" could not be read; an image placeholder was inserted.`);
  ctx.report.stats.images++;
  return el;
}

async function buildPic(ctx: SlideCtx, pic: XNode, t: Tx, source: string): Promise<Raw | null> {
  const nv = child(pic, 'nvPicPr');
  const cNvPr = child(nv, 'cNvPr');
  const name = attr(cNvPr, 'name');
  const cnvId = attr(cNvPr, 'id');
  const ph = phOf(pic);
  const spPr = child(pic, 'spPr');
  let xf = readXfrm(child(spPr, 'xfrm'));
  if (!xf && ph && source === 'slide') {
    const lsp = findPh(child(ctx.layout?.root, 'cSld'), ph, false) ?? findPh(child(ctx.master?.root, 'cSld'), ph, true);
    xf = readXfrm(child(child(lsp, 'spPr'), 'xfrm'));
  }
  if (!xf) return null;
  const box = geomBox(t, xf);
  const nvPr = child(nv, 'nvPr');
  const video = child(nvPr, 'videoFile'), audio = child(nvPr, 'audioFile');
  const p14media = findAll(nvPr, 'media')[0];
  const register = (el: Raw) => { if (cnvId && source === 'slide') ctx.spidToId.set(cnvId, el.id); el.zIndex = ctx.z++; if (attr(cNvPr, 'hidden') === '1') el.visible = false; return el; };
  if (video || audio || p14media) {
    const kind = audio ? 'audio' : video ? 'video' : (mimeOf(ctx.part.rels.get(rel(p14media, 'embed') ?? '')?.target ?? '').startsWith('audio') ? 'audio' : 'video');
    const src = (await mediaAsset(ctx, ctx.part, rel(p14media, 'embed'), kind)) ?? (await mediaAsset(ctx, ctx.part, rel(video ?? audio, 'link'), kind));
    const { id } = idFromName(ctx, name, cnvId, kind);
    if (src) {
      const asset = src.startsWith('asset:') ? ctx.assets.find((a) => a.id === src.slice(6)) : undefined;
      // media elements carry their data URL directly (the player does not resolve asset: refs) — don't store it twice
      if (asset) { ctx.assets.splice(ctx.assets.indexOf(asset), 1); for (const [k, v] of ctx.assetByPath) if (v === asset.id) ctx.assetByPath.delete(k); }
      const poster = await mediaAsset(ctx, ctx.part, rel(child(child(pic, 'blipFill'), 'blip'), 'embed'), 'image');
      const posterSrc = poster?.startsWith('asset:') ? ctx.assets.find((a) => a.id === poster.slice(6))?.src : poster;
      info(ctx, `${kind} imported (plays in the web presentation).`);
      return register({ id, type: kind, ...box, content: { src: asset ? asset.src : src, title: name ?? kind, controls: true, ...(posterSrc ? { poster: posterSrc } : {}) }, style: {} });
    }
    warn(ctx, `${kind} "${name || id}" could not be imported (linked or unsupported file); its poster frame is used.`);
  }
  const blipFill = child(pic, 'blipFill');
  if (!blipFill) return null;
  const prst = attr(child(spPr, 'prstGeom'), 'prst') ?? 'rect';
  const el = await pictureFrom(ctx, blipFill, box, name, cnvId, prst, attr(cNvPr, 'descr'));
  if (!el) return null;
  if (xf.flipH) el.style!.flipH = true;
  if (xf.flipV) el.style!.flipV = true;
  const ln = lineOf(child(spPr, 'ln'), ctx.clr, ctx.scale);
  if (ln && !ln.none) info(ctx, 'picture borders are not imported.');
  const shadow = shadowOf(spPr, ctx.clr, ctx.scale);
  if (shadow) el.style!.shadow = shadow;
  return register(el);
}

function tableFrom(ctx: SlideCtx, tbl: XNode, box: ReturnType<typeof geomBox>, id: string): Raw {
  const rowsN = children(tbl, 'tr');
  const rows = rowsN.map((tr) => children(tr, 'tc').map((tc) => {
    if (attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1') return '';
    return children(child(tc, 'txBody'), 'p').map((p) => kids(p).filter((k) => k.tag === 'r' || k.tag === 'fld' || k.tag === 'br').map((k) => (k.tag === 'br' ? '\n' : textOf(child(k, 't')))).join('')).join('\n');
  }));
  if (rowsN.some((tr) => children(tr, 'tc').some((tc) => attr(tc, 'gridSpan') || attr(tc, 'rowSpan') || attr(tc, 'hMerge') || attr(tc, 'vMerge')))) warn(ctx, 'merged table cells are imported as separate cells.', true);
  const tblPr = child(tbl, 'tblPr');
  const widths = children(child(tbl, 'tblGrid'), 'gridCol').map((g) => num(attr(g, 'w')));
  // header row: explicit flag, or a first row that is styled differently (fill / bold) from the body
  const cellFill = (tc: XNode | undefined) => fillOf(child(tc, 'tcPr'), ctx.clr)?.fill;
  const rowBold = (tr: XNode | undefined) => { const rs = findAll(tr, 'rPr').filter((r) => r); return rs.length > 0 && rs.every((r) => attr(r, 'b') === '1'); };
  const f0 = cellFill(child(rowsN[0], 'tc')), f1 = cellFill(child(rowsN[1], 'tc')), f2 = cellFill(child(rowsN[2], 'tc'));
  const header = attr(tblPr, 'firstRow') === '1' || attr(tblPr, 'firstRow') === 'true' || (rowsN.length > 1 && ((!!f0 && f0 !== f1 && f0 !== f2) || (rowBold(rowsN[0]) && !rowBold(rowsN[1]))));
  const body = rowsN.slice(1);
  const firstColBold = body.length > 0 && body.every((tr) => { const r = find(child(tr, 'tc'), 'rPr'); return attr(r, 'b') === '1'; }) && !body.every((tr) => { const r = find(children(tr, 'tc')[1], 'rPr'); return attr(r, 'b') === '1'; });
  const style: Style = {};
  const firstCell = child(rowsN[0], 'tc');
  const hdrFill = fillOf(child(firstCell, 'tcPr'), ctx.clr);
  if (hdrFill?.fill) style.fill = hdrFill.fill;
  const r0 = find(firstCell, 'rPr');
  const sz = attr(r0, 'sz');
  const anyRun = findAll(tbl, 'rPr').map((r) => attr(r, 'sz')).find(Boolean);
  if (sz || anyRun) style.fontSize = r2((num(sz ?? anyRun) / 100) * 12700 * ctx.scale);
  const hdrColor = colorIn(child(r0, 'solidFill'), ctx.clr);
  if (hdrColor) style.color = css(hdrColor);
  const content: Record<string, unknown> = { rows: rows.length ? rows : [['']], header };
  if (widths.length && widths.some((w) => w > 0)) content.columnWidths = widths.map((w) => r2(w / Math.max(1, Math.min(...widths.filter((x) => x > 0)))));
  if (attr(tblPr, 'firstCol') === '1' || firstColBold) content.firstColumn = true;
  ctx.report.stats.tables++;
  return { id, type: 'table', ...box, content, style };
}

async function buildFrame(ctx: SlideCtx, gf: XNode, t: Tx, source: string): Promise<Raw | Raw[] | null> {
  const nv = child(gf, 'nvGraphicFramePr');
  const cNvPr = child(nv, 'cNvPr');
  const name = attr(cNvPr, 'name');
  const cnvId = attr(cNvPr, 'id');
  const xf = readXfrm(child(gf, 'xfrm'));
  if (!xf) return null;
  const box = geomBox(t, xf);
  const gd = find(gf, 'graphicData');
  const uri = attr(gd, 'uri') ?? '';
  const register = (el: Raw) => { if (cnvId && source === 'slide') ctx.spidToId.set(cnvId, el.id); el.zIndex = ctx.z++; return el; };
  if (uri.endsWith('/table')) {
    const { id } = idFromName(ctx, name, cnvId, 'table');
    const tbl = child(gd, 'tbl')!;
    // the frame extent is often stale: PowerPoint grows rows to fit their text — trust the row/column sizes
    const rowsH = children(tbl, 'tr').reduce((a, tr) => a + num(attr(tr, 'h')), 0) * t.sy;
    const colsW = children(child(tbl, 'tblGrid'), 'gridCol').reduce((a, g) => a + num(attr(g, 'w')), 0) * t.sx;
    const tbox = { ...box, height: r2(Math.max(box.height, rowsH)), width: colsW > 1 ? r2(colsW) : box.width };
    return register(tableFrom(ctx, tbl, tbox, id));
  }
  if (uri.endsWith('/chart')) {
    const c = child(gd, 'chart');
    const r = ctx.part.rels.get(rel(c, 'id') ?? '');
    const part = r ? await ctx.pkg.part(r.target) : null;
    const { id } = idFromName(ctx, name, cnvId, 'chart');
    if (part) {
      const content = parseChart(part.root, ctx.clr, (m) => warn(ctx, `chart "${name || id}": ${m}`));
      if (content) {
        const slices = (content as ChartContent & { _sliceColors?: string[] })._sliceColors;
        if (slices) { delete (content as ChartContent & { _sliceColors?: string[] })._sliceColors; if (!ctx.sliceColors) ctx.sliceColors = slices; }
        ctx.report.stats.charts++;
        return register({ id, type: 'chart', ...box, content, style: {} });
      }
    }
    warn(ctx, `chart "${name || id}" could not be read; a placeholder box was inserted.`);
    return register(placeholderBox(ctx, id, box, `Chart: ${name ?? ''}`.trim()));
  }
  if (uri.includes('chartex') || uri.includes('chartEx')) {
    const { id } = idFromName(ctx, name, cnvId, 'chart');
    warn(ctx, `"${name || 'chart'}" uses a newer Office chart type (waterfall/treemap/funnel…) that cannot be read; a placeholder box was inserted — recreate it with Insert → Chart.`);
    return register(placeholderBox(ctx, id, box, name ?? 'Chart'));
  }
  if (uri.endsWith('/diagram')) return smartArt(ctx, gf, gd!, xf, t, name, cnvId, source);
  if (uri.endsWith('/ole') || find(gd, 'oleObj')) {
    const pic = find(gd, 'pic');
    if (pic) {
      warn(ctx, `embedded object "${name || 'OLE'}" (e.g. Excel/Word) is imported as its preview picture.`);
      const el = await buildPic(ctx, { ...pic, children: pic.children.map((c) => (c.tag === 'spPr' && !child(c, 'xfrm') ? { ...c, children: [{ tag: 'xfrm', attrs: {}, children: [{ tag: 'off', attrs: { x: String(xf.x), y: String(xf.y) }, children: [] }, { tag: 'ext', attrs: { cx: String(xf.w), cy: String(xf.h) }, children: [] }] }, ...c.children] } : c)) }, t, source);
      if (el) return el;
    }
    const { id } = idFromName(ctx, name, cnvId, 'object');
    warn(ctx, `embedded object "${name || 'OLE'}" cannot be shown; a placeholder box was inserted.`);
    return register(placeholderBox(ctx, id, box, name ?? 'Embedded object'));
  }
  const { id } = idFromName(ctx, name, cnvId, 'object');
  warn(ctx, `unsupported object "${name || uri}" replaced by a placeholder box.`);
  return register(placeholderBox(ctx, id, box, name ?? 'Object'));
}

function placeholderBox(_ctx: SlideCtx, id: string, box: ReturnType<typeof geomBox>, label: string): Raw {
  return { id, type: 'shape', ...box, content: { shape: 'roundRect', paragraphs: [{ runs: [{ text: label || 'Object' }], align: 'center' }] }, style: { fill: 'rgba(148,163,184,0.18)', stroke: { color: '#94A3B8', width: 2, dash: 'dash' }, color: '#475569', fontSize: 24, radius: 12 } };
}

async function smartArt(ctx: SlideCtx, _gf: XNode, gd: XNode, xf: Xfrm, t: Tx, name: string | undefined, cnvId: string | undefined, source: string): Promise<Raw | null> {
  const relIds = child(gd, 'relIds');
  const dmRel = ctx.part.rels.get(rel(relIds, 'dm') ?? '');
  const dataPart = dmRel ? await ctx.pkg.part(dmRel.target) : null;
  // drawing part: dataModelExt relId (slide rels) or the data part's own rels
  let drawingPath: string | undefined;
  const ext = dataPart ? find(dataPart.root, 'dataModelExt') : undefined;
  const extRel = ext ? ctx.part.rels.get(attr(ext, 'relId') ?? '') : undefined;
  if (extRel) drawingPath = extRel.target;
  if (!drawingPath) {
    const drawings = [...ctx.part.rels.values()].filter((r) => r.type === 'diagramDrawing');
    if (drawings.length === 1) drawingPath = drawings[0].target;
  }
  const drawing = drawingPath ? await ctx.pkg.part(drawingPath) : null;
  const { id } = idFromName(ctx, name, cnvId, 'smartart');
  const box = geomBox(t, xf);
  const register = (el: Raw) => { if (cnvId && source === 'slide') ctx.spidToId.set(cnvId, el.id); return el; };
  if (drawing) {
    const tree = find(drawing.root, 'spTree');
    if (tree) {
      const sub: Tx = { sx: t.sx, sy: t.sy, ox: apply(t, xf.x, xf.y).x, oy: apply(t, xf.x, xf.y).y };
      const saved = ctx.part;
      ctx.part = drawing;
      const kidsEls = await walkTree(ctx, tree, sub, undefined, 'smartart');
      ctx.part = saved;
      if (kidsEls.length) {
        info(ctx, 'SmartArt is imported as an editable group of shapes.');
        ctx.report.stats.groups++;
        const z = ctx.z++;
        return register({ id, type: 'group', ...box, zIndex: z, content: { children: kidsEls.map((k) => relativize(k, box.x, box.y)) }, style: {} });
      }
    }
  }
  // fallback: text of the data model
  const pts = dataPart ? findAll(dataPart.root, 'pt').filter((p) => !attr(p, 'type') || attr(p, 'type') === 'node') : [];
  const lines = pts.map((p) => textOf(find(p, 't') ? child(p, 't') ?? find(p, 'txBody') : undefined).trim() || findAll(p, 't').map((x) => textOf(x)).join('').trim()).filter(Boolean);
  warn(ctx, `SmartArt "${name || id}" has no drawing; its text was imported as a bulleted list.`);
  const z = ctx.z++;
  return register({ id, type: 'paragraph', ...box, zIndex: z, content: { paragraphs: (lines.length ? lines : ['SmartArt']).map((l) => ({ runs: [{ text: l }], list: 'bullet' as const })) }, style: { fontSize: 28, color: css(colorNode({ tag: 'schemeClr', attrs: { val: 'tx1' }, children: [] }, ctx.clr)) } });
}

/** Group children use coordinates relative to the group origin. */
function relativize(el: Raw, gx: number, gy: number): Raw {
  const out: Raw = { ...el, x: r2(el.x - gx), y: r2(el.y - gy) };
  if ((el.type === 'line' || el.type === 'arrow') && el.content) out.content = { x1: r2(el.content.x1 - gx), y1: r2(el.content.y1 - gy), x2: r2(el.content.x2 - gx), y2: r2(el.content.y2 - gy) };
  if (el.type === 'line' || el.type === 'arrow') { const c = out.content; out.x = Math.min(c.x1, c.x2); out.y = Math.min(c.y1, c.y2); out.width = Math.max(1, Math.abs(c.x2 - c.x1)); out.height = Math.max(1, Math.abs(c.y2 - c.y1)); }
  return out;
}

async function buildGroup(ctx: SlideCtx, g: XNode, t: Tx, grpFillParent: FillResult | undefined, source: 'slide' | 'layout' | 'master'): Promise<Raw | null> {
  const nv = child(g, 'nvGrpSpPr');
  const cNvPr = child(nv, 'cNvPr');
  const name = attr(cNvPr, 'name');
  const cnvId = attr(cNvPr, 'id');
  const gp = child(g, 'grpSpPr');
  const xf = readXfrm(child(gp, 'xfrm'));
  const grpFill = fillOf(gp, ctx.clr) ?? grpFillParent;
  let sub = t;
  if (xf) {
    const chOff = xf.chOff ?? { x: xf.x, y: xf.y };
    const chExt = xf.chExt ?? { w: xf.w, h: xf.h };
    const kx = chExt.w ? xf.w / chExt.w : 1, ky = chExt.h ? xf.h / chExt.h : 1;
    const o = apply(t, xf.x - chOff.x * kx, xf.y - chOff.y * ky);
    sub = { sx: t.sx * kx, sy: t.sy * ky, ox: o.x, oy: o.y };
    if (xf.rot) warn(ctx, `rotated group "${name || 'group'}" — its rotation is not applied to the shapes inside.`, true);
  }
  const zStart = ctx.z++;
  const items = await walkTree(ctx, g, sub, grpFill, source);
  if (!items.length) return null;
  const box = xf ? geomBox(t, xf) : (() => {
    const x0 = Math.min(...items.map((i) => i.x)), y0 = Math.min(...items.map((i) => i.y));
    return { x: x0, y: y0, width: Math.max(...items.map((i) => i.x + i.width)) - x0, height: Math.max(...items.map((i) => i.y + i.height)) - y0 };
  })();
  delete (box as { rotation?: number }).rotation;
  const { id } = idFromName(ctx, name, cnvId, 'group');
  if (cnvId && source === 'slide') ctx.spidToId.set(cnvId, id);
  ctx.report.stats.groups++;
  const el: Raw = { id, type: 'group', ...box, zIndex: zStart, content: { children: items.map((k) => relativize(k, box.x, box.y)) }, style: {} };
  if (attr(cNvPr, 'hidden') === '1') el.visible = false;
  return el;
}

async function walkTree(ctx: SlideCtx, tree: XNode, t: Tx, grpFill: FillResult | undefined, source: 'slide' | 'layout' | 'master' | 'smartart'): Promise<Raw[]> {
  const out: Raw[] = [];
  const src = source === 'smartart' ? 'layout' : source;
  const visit = async (n: XNode) => {
    switch (n.tag) {
      case 'sp': case 'cxnSp': { const e = await buildSp(ctx, n, t, grpFill, source === 'smartart' ? 'slide' : src); if (Array.isArray(e)) out.push(...e); else if (e) out.push(e); break; }
      case 'pic': { const e = await buildPic(ctx, n, t, src); if (e) out.push(e); break; }
      case 'grpSp': { const e = await buildGroup(ctx, n, t, grpFill, src); if (e) out.push(e); break; }
      case 'graphicFrame': { const e = await buildFrame(ctx, n, t, src); if (Array.isArray(e)) out.push(...e); else if (e) out.push(e); break; }
      case 'AlternateContent': for (const k of resolveAlternate(n, ['a14', 'p14', 'p15'])) await visit(k); break;
      case 'contentPart': warn(ctx, 'ink drawings are not imported.', true); break;
      default: break;
    }
  };
  for (const k of kids(tree)) await visit(k);
  return out;
}

/* -------------------------------- backgrounds -------------------------------- */
async function backgroundOf(ctx: SlideCtx, parts: (Part | null)[]): Promise<Background | undefined> {
  for (const part of parts) {
    const bg = child(child(part?.root, 'cSld'), 'bg');
    if (!bg || !part) continue;
    const bgPr = child(bg, 'bgPr');
    let f: FillResult | undefined;
    if (bgPr) f = fillOf(bgPr, ctx.clr);
    else {
      const ref = child(bg, 'bgRef');
      const idx = num(attr(ref, 'idx'));
      if (ref) f = idx >= 1001 ? styleRefFill(ctx.theme.bgFills, idx - 1000, ref, ctx.clr) : idx > 0 ? styleRefFill(ctx.theme.fills, idx, ref, ctx.clr) : { fill: css(colorIn(ref, ctx.clr)) };
    }
    if (!f || f.none) continue;
    if (f.image) {
      const saved = ctx.part;
      ctx.part = part;
      const src = await mediaAsset(ctx, part, rel(child(f.image.node, 'blip'), 'embed'), 'image');
      ctx.part = saved;
      if (src) return { type: 'image', image: { src }, fit: 'cover', color: '#FFFFFF' };
      continue;
    }
    if (f.gradient) return { type: 'gradient', gradient: f.gradient };
    if (f.fill) return { type: 'color', color: f.fill };
  }
  return undefined;
}

/* ---------------------------------- notes ---------------------------------- */
async function notesOf(pkg: Pkg, slide: Part): Promise<string | undefined> {
  const r = relOfType(slide, 'notesSlide');
  const part = r ? await pkg.part(r.target) : null;
  if (!part) return undefined;
  const sps = findAll(child(part.root, 'cSld'), 'sp').filter((s) => { const ph = phOf(s); return ph && (ph.type === 'body' || (ph.type === 'obj' && ph.idx === '1')); });
  const text = sps.map((sp) => children(child(sp, 'txBody'), 'p').map((p) => kids(p).map((k) => (k.tag === 'br' ? '\n' : k.tag === 'r' || k.tag === 'fld' ? textOf(child(k, 't')) : '')).join('')).join('\n')).join('\n').trim();
  return text || undefined;
}

/* ----------------------------------- main ----------------------------------- */
function pickAspect(cx: number, cy: number): { key: string; width: number; height: number } {
  const ratio = cx / cy;
  const cands: [string, number][] = [['16:9', 16 / 9], ['4:3', 4 / 3], ['16:10', 16 / 10], ['A4-landscape', 1527 / 1080], ['A4-portrait', 1080 / 1527]];
  for (const [k, r] of cands) if (Math.abs(ratio - r) < 0.012) { const a = ASPECT_RATIOS[k as keyof typeof ASPECT_RATIOS]; return { key: k, width: a.width, height: a.height }; }
  // custom: keep 1080 px tall (or 1920 wide when portrait-ish wide)
  return ratio >= 1 ? { key: 'custom', width: Math.round(1080 * ratio), height: 1080 } : { key: 'custom', width: 1080, height: Math.round(1080 / ratio) };
}

export async function importPptx(data: ArrayBuffer | Uint8Array, opts: PptxImportOptions = {}): Promise<PptxImportResult> {
  const report: PptxImportReport = { warnings: [], info: [], stats: { slides: 0, elements: 0, images: 0, charts: 0, tables: 0, groups: 0, notes: 0 } };
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(data); } catch { throw new Error('This file is not a valid PowerPoint (.pptx) file — it could not be opened as a ZIP package.'); }
  const pkg = new Pkg(zip);
  if (!pkg.has('ppt/presentation.xml')) {
    if (pkg.has('[Content_Types].xml') && zip.file(/ppt\//).length === 0) throw new Error('This ZIP is not a PowerPoint presentation (no ppt/presentation.xml).');
    throw new Error('Not a PowerPoint .pptx file (ppt/presentation.xml is missing). Old .ppt files must first be saved as .pptx in PowerPoint.');
  }
  if (zip.file('EncryptedPackage')) throw new Error('This presentation is password-protected. Remove the password in PowerPoint and try again.');
  const pres = (await pkg.part('ppt/presentation.xml'))!;
  const sldSz = child(pres.root, 'sldSz');
  const cx = num(attr(sldSz, 'cx'), 12192000), cy = num(attr(sldSz, 'cy'), 6858000);
  const aspect = pickAspect(cx, cy);
  const scale = aspect.width / cx;
  const size = { width: aspect.width, height: aspect.height };
  const presDefaults = child(pres.root, 'defaultTextStyle');

  const slideRels = children(child(pres.root, 'sldIdLst'), 'sldId').map((s) => pres.rels.get(rel(s, 'id') ?? '')).filter(Boolean) as Rel[];
  if (!slideRels.length) throw new Error('The presentation has no slides.');

  // theme (first master)
  const firstMasterRel = [...pres.rels.values()].find((r) => r.type === 'slideMaster');
  const firstMaster = await pkg.part(firstMasterRel?.target);
  const themePart = await pkg.part(relOfType(firstMaster, 'theme')?.target ?? relOfType(pres, 'theme')?.target);
  const theme = parseTheme(themePart?.root);
  const clrMapOf = (n: XNode | undefined): ClrMap => (n ? { ...DEFAULT_CLRMAP, ...n.attrs } : { ...DEFAULT_CLRMAP });
  const masterClr = clrMapOf(child(firstMaster?.root, 'clrMap'));

  const assets: Asset[] = [];
  const assetByPath = new Map<string, string>();
  const slides: Slide[] = [];
  let firstBg: Background | undefined;
  let sliceColors: string[] | undefined;

  for (let i = 0; i < slideRels.length; i++) {
    opts.onProgress?.(i / slideRels.length, `Slide ${i + 1}/${slideRels.length}`);
    const part = await pkg.part(slideRels[i].target);
    if (!part) { report.warnings.push(`Slide ${i + 1}: slide part is missing — skipped.`); continue; }
    const layout = await pkg.part(relOfType(part, 'slideLayout')?.target);
    const master = await pkg.part(relOfType(layout, 'slideMaster')?.target) ?? firstMaster;
    const mTheme = master === firstMaster ? theme : parseTheme((await pkg.part(relOfType(master, 'theme')?.target))?.root);
    let clrMap = master === firstMaster ? masterClr : clrMapOf(child(master?.root, 'clrMap'));
    for (const ov of [child(layout?.root, 'clrMapOvr'), child(part.root, 'clrMapOvr')]) { const o = child(ov, 'overrideClrMapping'); if (o) clrMap = clrMapOf(o); }
    const ctx: SlideCtx = {
      pkg, part, layout, master, theme: mTheme, clr: { theme: mTheme, clrMap }, scale, size, report, assets, assetByPath, presDefaults,
      idsUsed: new Set(), spidToId: new Map(), slideNo: i + 1, warnOnce: new Set(), z: 1,
    };
    const t: Tx = { sx: scale, sy: scale, ox: 0, oy: 0 };
    const elements: Raw[] = [];
    // master + layout decorations (non-placeholder shapes)
    const showMaster = attr(part.root, 'showMasterSp') !== '0';
    if (showMaster) {
      const layoutShowsMaster = attr(layout?.root, 'showMasterSp') !== '0';
      for (const [p, src] of [[layoutShowsMaster ? master : null, 'master'], [layout, 'layout']] as [Part | null, 'master' | 'layout'][]) {
        const tree = find(child(p?.root, 'cSld'), 'spTree');
        if (!tree || !p) continue;
        ctx.part = p;
        const els = await walkTree(ctx, tree, t, undefined, src);
        for (const e of els) { e.name = e.name ?? `${src === 'master' ? 'Master' : 'Layout'} decoration`; elements.push(e); }
        ctx.part = part;
      }
      if (elements.length) info(ctx, `${elements.length} decoration(s) from the slide master/layout were added as normal objects.`);
    }
    const tree = find(child(part.root, 'cSld'), 'spTree');
    if (tree) elements.push(...(await walkTree(ctx, tree, t, undefined, 'slide')));
    // timing → animations
    const notes: string[] = [];
    const anims = parseTiming(part.root, size, notes);
    notes.forEach((n) => info(ctx, n));
    const byId = new Map<string, Raw>();
    const index = (els: Raw[]) => els.forEach((e) => { byId.set(e.id, e); if (e.type === 'group') index(e.content?.children ?? []); });
    index(elements);
    for (const a of anims) {
      const elId = ctx.spidToId.get(a.spid);
      const el = elId ? byId.get(elId) : undefined;
      if (!el) { warn(ctx, 'an animation targets an object that could not be imported — skipped.', true); continue; }
      if (!elements.includes(el)) { warn(ctx, 'animations on shapes inside groups are applied to nothing (not supported) — skipped.', true); continue; }
      (el.animation ??= [] as Animation[]).push(a.anim);
    }
    const tr = parseTransition(part.root);
    if (tr.note) info(ctx, tr.note);
    const background = await backgroundOf(ctx, [part, layout, master]);
    if (i === 0) firstBg = background;
    const s: Slide = { id: `slide-${i + 1}`, elements, ...(background ? { background } : {}) };
    if (attr(part.root, 'show') === '0') s.hidden = true;
    if (tr.transition) s.transition = tr.transition;
    if (tr.advance) s.duration = tr.advance;
    const n = await notesOf(pkg, part);
    if (n) { s.notes = n; report.stats.notes++; }
    const cname = attr(child(part.root, 'cSld'), 'name');
    if (!ctx.slideTitle) {
      // no title placeholder: use the largest text on the slide
      const texts = elements.filter((e) => e.content?.paragraphs && ['text', 'heading', 'paragraph', 'richText', 'shape'].includes(e.type))
        .map((e) => ({ size: Math.max(e.style?.fontSize ?? 0, ...(e.content.paragraphs as Paragraph[]).flatMap((p) => p.runs.map((r) => r.fontSize ?? 0))), text: (e.content.paragraphs as Paragraph[]).map((p) => p.runs.map((r) => r.text).join('')).join(' ').replace(/\s+/g, ' ').trim(), heading: e.type === 'heading' }))
        .filter((x) => x.text.length > 1);
      const best = texts.find((x) => x.heading) ?? texts.sort((a, b) => b.size - a.size)[0];
      if (best) ctx.slideTitle = best.text;
    }
    if (ctx.slideTitle) s.title = ctx.slideTitle.slice(0, 120);
    else if (cname && !/^Slide \d+$/i.test(cname)) s.title = cname;
    if (ctx.sliceColors && !sliceColors) sliceColors = ctx.sliceColors;
    report.stats.elements += elements.length;
    slides.push(s);
  }
  report.stats.slides = slides.length;
  if (!slides.length) throw new Error('No slide could be read from this file.');

  // theme overrides from the PowerPoint theme
  const cc: ColorCtx = { theme, clrMap: masterClr };
  const sc = (v: string) => colorNode({ tag: 'schemeClr', attrs: { val: v }, children: [] }, cc)!;
  const bgRgb = firstBg?.type === 'color' && firstBg.color?.startsWith('#') ? hexRgb(firstBg.color) : sc('bg1');
  const dark = luminance(bgRgb) < 0.45;
  const accents = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((a) => css(sc(a))!);
  // Text color of the theme: the scheme's tx1 unless it does not contrast with the background —
  // then the color most used by the deck's own text (weighted by length).
  const contrast = (a: RGBA, b: RGBA) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  let textRgb = sc('tx1');
  if (contrast(textRgb, bgRgb) < 3) {
    const tally = new Map<string, number>();
    const walk = (els: SlideElement[]) => els.forEach((e) => {
      if (e.type === 'group') walk(e.content?.children ?? []);
      const c = e.style?.color;
      if (!c || !c.startsWith('#') || !e.content?.paragraphs) return;
      const n = (e.content.paragraphs as Paragraph[]).reduce((a, p) => a + p.runs.reduce((b, r) => b + r.text.length, 0), 0);
      tally.set(c, (tally.get(c) ?? 0) + n);
    });
    slides.forEach((sl) => walk(sl.elements));
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => hexRgb(c)).find((c) => contrast(c, bgRgb) >= 3);
    textRgb = best ?? (dark ? { r: 255, g: 255, b: 255, a: 1 } : { r: 17, g: 24, b: 39, a: 1 });
  }
  let surfaceRgb = sc('bg2');
  if (Math.abs(luminance(surfaceRgb) - luminance(bgRgb)) > 0.25) surfaceRgb = mix(bgRgb, textRgb, 0.06);
  const mutedRgb = mix(bgRgb, textRgb, 0.62);
  const themeOverrides: Partial<Theme> = {
    name: theme.name ? `PowerPoint: ${theme.name}` : 'PowerPoint theme',
    colors: {
      primary: accents[0], secondary: css(sc('tx2'))!, accent: accents[1], background: css(bgRgb)!, surface: css(surfaceRgb)!, text: css(textRgb)!, textMuted: css(mutedRgb)!, border: css(mix(bgRgb, textRgb, 0.16))!,
      chart: sliceColors && sliceColors.length >= 2 ? [...sliceColors, ...accents].slice(0, Math.max(6, sliceColors.length)) : accents,
    } as Theme['colors'],
    ...(theme.majorFont || theme.minorFont ? { fonts: { heading: theme.majorFont ?? theme.minorFont!, body: theme.minorFont ?? theme.majorFont!, mono: 'JetBrains Mono' } } : {}),
  };
  const title = (opts.fileName ?? '').replace(/\.pptx$/i, '').trim() || textOf(find((await pkg.part('docProps/core.xml'))?.root, 'title')) || slides.find((s) => s.title)?.title || 'Imported PowerPoint';

  const raw = {
    schemaVersion: '1.0',
    title,
    aspectRatio: aspect.key,
    size,
    theme: { base: dark ? 'dark-premium' : 'minimal-white', ...themeOverrides },
    slides,
    assets,
    metadata: { importedFrom: 'pptx', sourceFile: opts.fileName, importedAt: new Date().toISOString() },
  };
  const presentation = normalizePresentation(raw);
  opts.onProgress?.(1, 'Done');
  if (aspect.key === 'custom') report.info.push(`Custom slide size ${(cx / 914400).toFixed(2)}″ × ${(cy / 914400).toFixed(2)}″ kept as ${size.width}×${size.height} px.`);
  report.info.unshift(`${slides.length} slide(s), ${report.stats.elements} object(s), ${report.stats.images} picture(s), ${report.stats.charts} chart(s), ${report.stats.tables} table(s) imported.`);
  return { presentation, report };
}

function mix(a: RGBA, b: RGBA, t: number): RGBA { return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t), a: 1 }; }
function hexRgb(h: string): RGBA { const v = parseInt(h.slice(1, 7), 16); return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 1 }; }

/** Quick check used by file pickers: is this a PPTX (zip with ppt/presentation.xml)? */
export function looksLikePptx(name: string, bytes?: Uint8Array): boolean {
  if (/\.pptx$/i.test(name)) return true;
  return !!bytes && bytes[0] === 0x50 && bytes[1] === 0x4b && /\.(pptm|ppsx|potx)$/i.test(name);
}

export type { ChartContent };
