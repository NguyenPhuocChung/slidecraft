/**
 * OOXML post-processor: applies what pptxgenjs cannot write — gradient fills,
 * image crop/masks, native groups, gradient backgrounds, slide transitions
 * (incl. PowerPoint 2010 effects and Morph) and the animation timing tree.
 */
import type { Animation, Slide, Transition } from '@/types/schema';
import { ANIMATION_EFFECTS, TRANSITIONS } from '@/types/registry';
import { buildTimeline, motionPathD } from '@/animation/engine';
import type { GradientPatch } from './build';

export const NS = {
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
  p159: 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK_TAGS = ['p:sp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:cxnSp'];

/** Locate the shape-level element whose cNvPr has the given name. */
export function findBlock(xml: string, name: string): { start: number; end: number; tag: string } | null {
  const re = new RegExp(`<p:cNvPr id="\\d+" name="${esc(name)}"[ />]`);
  const m = re.exec(xml);
  if (!m) return null;
  let start = -1, tag = '';
  for (const t of BLOCK_TAGS) {
    const i = Math.max(xml.lastIndexOf(`<${t}>`, m.index), xml.lastIndexOf(`<${t} `, m.index));
    if (i > start) { start = i; tag = t; }
  }
  if (start < 0) return null;
  // walk forward balancing nested tags of the same kind
  const open = new RegExp(`<${tag}[ >]|</${tag}>`, 'g');
  open.lastIndex = start;
  let depth = 0, mm: RegExpExecArray | null;
  while ((mm = open.exec(xml))) {
    if (mm[0].startsWith('</')) { depth--; if (depth === 0) return { start, end: mm.index + mm[0].length, tag }; }
    else depth++;
  }
  return null;
}

export function shapeIds(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /<p:cNvPr id="(\d+)" name="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) if (!map.has(m[2])) map.set(m[2], Number(m[1]));
  return map;
}

function gradFillXml(g: GradientPatch['gradient']): string {
  const stops = g.stops.map((s) => `<a:gs pos="${Math.round(s.pos * 100000)}"><a:srgbClr val="${s.hex}"><a:alpha val="${Math.round(s.alpha * 100000)}"/></a:srgbClr></a:gs>`).join('');
  const shade = g.radial ? '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>' : `<a:lin ang="${Math.round((((g.angle % 360) + 360) % 360) * 60000)}" scaled="0"/>`;
  return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst>${shade}</a:gradFill>`;
}

function replaceInBlock(xml: string, name: string, fn: (block: string) => string): { xml: string; ok: boolean } {
  const b = findBlock(xml, name);
  if (!b) return { xml, ok: false };
  const block = xml.slice(b.start, b.end);
  const next = fn(block);
  return { xml: xml.slice(0, b.start) + next + xml.slice(b.end), ok: next !== block };
}

export function applyGradient(xml: string, name: string, g: GradientPatch['gradient']): { xml: string; ok: boolean } {
  return replaceInBlock(xml, name, (block) => {
    const sp = /<p:spPr>[\s\S]*?<\/p:spPr>|<p:spPr\/>/.exec(block);
    if (!sp) return block;
    let spPr = sp[0];
    const lnIdx = spPr.indexOf('<a:ln');
    const head = lnIdx >= 0 ? spPr.slice(0, lnIdx) : spPr;
    const tail = lnIdx >= 0 ? spPr.slice(lnIdx) : '';
    let newHead = head.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>|<a:noFill\/>/, gradFillXml(g));
    if (newHead === head) newHead = head.replace(/(<\/a:prstGeom>|<\/a:custGeom>)/, `$1${gradFillXml(g)}`);
    spPr = newHead + tail;
    return block.slice(0, sp.index) + spPr + block.slice(sp.index + sp[0].length);
  });
}

export function applyImagePatch(xml: string, name: string, p: { srcRect?: { l: number; t: number; r: number; b: number }; prst?: string }): { xml: string; ok: boolean } {
  return replaceInBlock(xml, name, (block) => {
    let b = block;
    if (p.srcRect) {
      const r = p.srcRect;
      const pct = (v: number) => Math.round(Math.max(0, Math.min(0.99, v)) * 100000);
      b = b.replace(/<a:srcRect[^>]*\/>/, '').replace('<a:stretch>', `<a:srcRect l="${pct(r.l)}" t="${pct(r.t)}" r="${pct(r.r)}" b="${pct(r.b)}"/><a:stretch>`);
    }
    if (p.prst) {
      const geom = p.prst === 'roundRect' ? '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 12000"/></a:avLst></a:prstGeom>' : `<a:prstGeom prst="${p.prst}"><a:avLst/></a:prstGeom>`;
      b = b.replace(/<a:prstGeom prst="rect">\s*<a:avLst\s*\/>\s*<\/a:prstGeom>|<a:prstGeom prst="rect"><a:avLst><\/a:avLst><\/a:prstGeom>/, geom);
    }
    return b;
  });
}

/** Wrap named shapes into a native <p:grpSp>. */
export function applyGroup(xml: string, groupName: string, childNames: string[], newId: number): { xml: string; ok: boolean } {
  const blocks = childNames.map((n) => findBlock(xml, n)).filter((b): b is NonNullable<typeof b> => !!b);
  if (blocks.length < 2 || blocks.length !== childNames.length) return { xml, ok: false };
  blocks.sort((a, b) => a.start - b.start);
  // reject overlapping/nested matches
  for (let i = 1; i < blocks.length; i++) if (blocks[i].start < blocks[i - 1].end) return { xml, ok: false };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const parts: string[] = [];
  for (const b of blocks) {
    const s = xml.slice(b.start, b.end);
    parts.push(s);
    const m = /<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(s);
    if (!m) return { xml, ok: false };
    x0 = Math.min(x0, +m[1]); y0 = Math.min(y0, +m[2]); x1 = Math.max(x1, +m[1] + +m[3]); y1 = Math.max(y1, +m[2] + +m[4]);
  }
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const grp = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${newId}" name="${groupName}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${w}" cy="${h}"/><a:chOff x="${x0}" y="${y0}"/><a:chExt cx="${w}" cy="${h}"/></a:xfrm></p:grpSpPr>${parts.join('')}</p:grpSp>`;
  let out = xml;
  for (let i = blocks.length - 1; i >= 0; i--) out = out.slice(0, blocks[i].start) + (i === 0 ? grp : '') + out.slice(blocks[i].end);
  return { xml: out, ok: true };
}

export function applyBackgroundGradient(xml: string, g: GradientPatch['gradient']): string {
  const bg = `<p:bg><p:bgPr>${gradFillXml(g)}<a:effectLst/></p:bgPr></p:bg>`;
  if (/<p:bg>[\s\S]*?<\/p:bg>/.test(xml)) return xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/, bg);
  return xml.replace(/(<p:cSld(?: [^>]*)?>)/, `$1${bg}`);
}

export function ensureNamespaces(xml: string): string {
  return xml.replace(/<p:sld ([^>]*)>/, (_m, attrs: string) => {
    let a = attrs;
    if (!a.includes('xmlns:mc=')) a += ` xmlns:mc="${NS.mc}"`;
    if (!a.includes('xmlns:p14=')) a += ` xmlns:p14="${NS.p14}"`;
    if (!a.includes('xmlns:p159=')) a += ` xmlns:p159="${NS.p159}"`;
    if (!a.includes('mc:Ignorable=')) a += ' mc:Ignorable="p14 p159"';
    return `<p:sld ${a}>`;
  });
}

/* ------------------------------- Transitions ------------------------------- */
const DIR4: Record<string, string> = { left: 'l', right: 'r', up: 'u', down: 'd' };
const WIPE_DIR: Record<string, string> = { left: 'r', right: 'l', up: 'u', down: 'd' };
const OPP: Record<string, string> = { left: 'r', right: 'l', up: 'd', down: 'u' };

export function transitionXml(t: Transition, advanceMs?: number): { xml: string; note?: string } {
  const dur = Math.round(t.duration ?? 700);
  const spd = dur < 500 ? 'fast' : dur < 1000 ? 'med' : 'slow';
  const adv = `${t.advanceOnClick === false ? ' advClick="0"' : ''}${advanceMs ? ` advTm="${Math.round(advanceMs)}"` : ''}`;
  const d = t.direction;
  let inner = '';
  let p14Inner = '';
  let note: string | undefined;
  switch (t.type) {
    case 'none': return { xml: advanceMs || t.advanceOnClick === false ? `<p:transition${adv}/>` : '' };
    case 'fade': inner = '<p:fade/>'; break;
    case 'dissolve': inner = '<p:dissolve/>'; break;
    case 'push': inner = `<p:push dir="${DIR4[d ?? 'left'] ?? 'l'}"/>`; break;
    case 'wipe': inner = `<p:wipe dir="${WIPE_DIR[d ?? 'left'] ?? 'r'}"/>`; break;
    case 'split': inner = `<p:split orient="${d === 'vertical' ? 'vert' : 'horz'}" dir="out"/>`; break;
    case 'cover': inner = `<p:cover dir="${DIR4[d ?? 'left'] ?? 'l'}"/>`; break;
    case 'uncover': inner = `<p:pull dir="${DIR4[d ?? 'left'] ?? 'l'}"/>`; break;
    case 'zoom': inner = '<p:zoom/>'; break;
    case 'randomBars': inner = `<p:randomBar dir="${d === 'vertical' ? 'vert' : 'horz'}"/>`; break;
    case 'blinds': inner = `<p:blinds dir="${d === 'vertical' ? 'vert' : 'horz'}"/>`; break;
    case 'checkerboard': inner = `<p:checker dir="${d === 'vertical' ? 'vert' : 'horz'}"/>`; break;
    case 'reveal': p14Inner = `<p14:reveal dir="${d === 'right' ? 'r' : 'l'}"/>`; inner = '<p:fade/>'; break;
    case 'flip': p14Inner = `<p14:flip dir="${d === 'right' ? 'r' : 'l'}"/>`; inner = '<p:fade/>'; break;
    case 'gallery': p14Inner = `<p14:gallery dir="${d === 'right' ? 'r' : 'l'}"/>`; inner = `<p:push dir="${d === 'right' ? 'r' : 'l'}"/>`; break;
    case 'cube': p14Inner = `<p14:prism dir="${OPP[d ?? 'left'] === 'r' ? 'l' : DIR4[d ?? 'left'] ?? 'l'}" isContent="1"/>`; inner = `<p:push dir="${DIR4[d ?? 'left'] ?? 'l'}"/>`; note = 'Cube → PowerPoint "Prism (content)" transition'; break;
    case 'morph':
      return {
        xml: `<mc:AlternateContent xmlns:mc="${NS.mc}"><mc:Choice xmlns:p159="${NS.p159}" Requires="p159"><p:transition spd="slow" p14:dur="${dur}"${adv}><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"${adv}><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`,
      };
    default: inner = '<p:fade/>'; note = `Transition "${t.type}" → Fade`;
  }
  if (t.sound && t.sound !== 'none') note = [note, 'Transition sounds are not exported'].filter(Boolean).join('; ');
  const choice = p14Inner || inner;
  return {
    xml: `<mc:AlternateContent xmlns:mc="${NS.mc}"><mc:Choice xmlns:p14="${NS.p14}" Requires="p14"><p:transition spd="${spd}" p14:dur="${dur}"${adv}>${choice}</p:transition></mc:Choice><mc:Fallback><p:transition spd="${spd}"${adv}>${inner}</p:transition></mc:Fallback></mc:AlternateContent>`,
    note,
  };
}

/* -------------------------------- Animations -------------------------------- */
interface TimingCtx { id: number; W: number; H: number; notes: string[]; partial: Set<string> }
const tgt = (spid: number) => `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
const setVis = (c: TimingCtx, spid: number, val: 'visible' | 'hidden', delay = 0) =>
  `<p:set><p:cBhvr><p:cTn id="${c.id++}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>${tgt(spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${val}"/></p:to></p:set>`;
const animProp = (c: TimingCtx, spid: number, attr: string, from: string, to: string, dur: number) =>
  `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
const animEffect = (c: TimingCtx, spid: number, transition: 'in' | 'out' | null, filter: string, dur: number, prLst?: string) =>
  `<p:animEffect${transition ? ` transition="${transition}"` : ''} filter="${filter}"${prLst ? ` prLst="${prLst}"` : ''}><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}"/>${tgt(spid)}</p:cBhvr></p:animEffect>`;

/** Convert our relative motion path (px) to PowerPoint's slide-fraction path syntax. */
export function pptMotionPath(anim: Animation, W: number, H: number): { path: string; approx: boolean } {
  const X = (v: number) => +(v / W).toFixed(4), Y = (v: number) => +(v / H).toFixed(4);
  const p = anim.path ?? { type: 'line' };
  if (anim.effect === 'motionCircle' || p.type === 'circle') {
    const r = p.radius ?? 150, k = 0.5523 * r;
    // circle through origin, centered at (0, r)
    const pts = [[0, 0], [k, 0, r, r - k, r, r], [r, r + k, k, 2 * r, 0, 2 * r], [-k, 2 * r, -r, r + k, -r, r], [-r, r - k, -k, 0, 0, 0]];
    return { path: `M 0 0 ${pts.slice(1).map((q) => `C ${X(q[0])} ${Y(q[1])} ${X(q[2])} ${Y(q[3])} ${X(q[4])} ${Y(q[5])}`).join(' ')} Z E`, approx: false };
  }
  const d = motionPathD(anim);
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0, cx = 0, cy = 0, cmd = 'M', approx = false;
  const out: string[] = [];
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ax = (v: number) => (rel ? cx + v : v), ay = (v: number) => (rel ? cy + v : v);
    if (C === 'M' || C === 'L') { const x = ax(num()), y = ay(num()); out.push(`${out.length ? 'L' : 'M'} ${X(x)} ${Y(y)}`); cx = x; cy = y; if (C === 'M') cmd = rel ? 'l' : 'L'; }
    else if (C === 'H') { const x = rel ? cx + num() : num(); out.push(`L ${X(x)} ${Y(cy)}`); cx = x; }
    else if (C === 'V') { const y = rel ? cy + num() : num(); out.push(`L ${X(cx)} ${Y(y)}`); cy = y; }
    else if (C === 'C') { const a = [ax(num()), ay(num()), ax(num()), ay(num()), ax(num()), ay(num())]; out.push(`C ${X(a[0])} ${Y(a[1])} ${X(a[2])} ${Y(a[3])} ${X(a[4])} ${Y(a[5])}`); cx = a[4]; cy = a[5]; }
    else if (C === 'Q') { const qx = ax(num()), qy = ay(num()), x = ax(num()), y = ay(num()); out.push(`C ${X(cx + (2 / 3) * (qx - cx))} ${Y(cy + (2 / 3) * (qy - cy))} ${X(x + (2 / 3) * (qx - x))} ${Y(y + (2 / 3) * (qy - y))} ${X(x)} ${Y(y)}`); cx = x; cy = y; }
    else if (C === 'A') { num(); num(); num(); num(); num(); const x = ax(num()), y = ay(num()); out.push(`L ${X(x)} ${Y(y)}`); cx = x; cy = y; approx = true; }
    else if (C === 'Z') { out.push('Z'); }
    else { i++; approx = true; }
  }
  if (!out.length || !out[0].startsWith('M')) out.unshift('M 0 0');
  return { path: `${out.join(' ')} E`, approx };
}

function effectXml(c: TimingCtx, anim: Animation, spid: number, nodeType: string, delay: number, grpId: number, hasText: boolean): string {
  const info = (ANIMATION_EFFECTS as Record<string, { category: string; ppt?: { presetID: number; presetClass: string } }>)[anim.effect];
  if (!info?.ppt) return '';
  const eid = c.id++; // allocate before children so ids follow document order
  const dur = Math.max(1, Math.round(anim.duration ?? 600));
  const dir = anim.direction;
  const e = anim.effect;
  let subtype = 0;
  let body = '';
  const presetClass = info.ppt.presetClass;
  const presetID = info.ppt.presetID;
  const flyFrom: Record<string, [string, string, number]> = { left: ['0-#ppt_w/2', '#ppt_y', 8], right: ['1+#ppt_w/2', '#ppt_y', 2], up: ['#ppt_x', '0-#ppt_h/2', 1], down: ['#ppt_x', '1+#ppt_h/2', 4] };
  const wipe: Record<string, [string, number]> = { left: ['wipe(right)', 8], right: ['wipe(left)', 2], up: ['wipe(up)', 4], down: ['wipe(down)', 1] };
  switch (e) {
    case 'appear': case 'typewriter':
      body = setVis(c, spid, 'visible'); break;
    case 'fadeIn': case 'blurIn':
      body = setVis(c, spid, 'visible') + animEffect(c, spid, 'in', 'fade', dur); break;
    case 'flyIn': { const f = flyFrom[dir ?? 'left'] ?? flyFrom.left; subtype = f[2]; body = setVis(c, spid, 'visible') + animProp(c, spid, 'ppt_x', f[0], '#ppt_x', dur) + animProp(c, spid, 'ppt_y', f[1], '#ppt_y', dur); break; }
    case 'floatIn': case 'rise': case 'bounce': {
      const off = dir === 'down' ? '#ppt_y-.1' : '#ppt_y+.1';
      body = setVis(c, spid, 'visible') + animEffect(c, spid, 'in', 'fade', dur) + animProp(c, spid, 'ppt_x', '#ppt_x', '#ppt_x', dur) + animProp(c, spid, 'ppt_y', off, '#ppt_y', dur); break;
    }
    case 'wipe': case 'reveal': case 'draw': { const w = wipe[dir ?? 'left'] ?? wipe.left; subtype = w[1]; body = setVis(c, spid, 'visible') + animEffect(c, spid, 'in', w[0], dur); break; }
    case 'split': subtype = dir === 'vertical' ? 21 : 42; body = setVis(c, spid, 'visible') + animEffect(c, spid, 'in', dir === 'vertical' ? 'barn(inVertical)' : 'barn(inHorizontal)', dur); break;
    case 'zoomIn': case 'flipIn': case 'pop':
      subtype = 16; body = setVis(c, spid, 'visible') + animProp(c, spid, 'ppt_w', '0', '#ppt_w', dur) + animProp(c, spid, 'ppt_h', '0', '#ppt_h', dur) + animEffect(c, spid, 'in', 'fade', dur); break;
    case 'grow': case 'rotateIn':
      body = setVis(c, spid, 'visible') + animProp(c, spid, 'ppt_w', '0', '#ppt_w', dur) + animProp(c, spid, 'ppt_h', '0', '#ppt_h', dur) + animProp(c, spid, 'style.rotation', '-90', '0', dur) + animEffect(c, spid, 'in', 'fade', dur); break;
    // emphasis
    case 'growShrink': case 'pulse': case 'highlight': {
      const s = Math.round((anim.scale ?? (e === 'growShrink' ? 1.15 : e === 'highlight' ? 1.05 : 1.08)) * 100000);
      body = `<p:animScale><p:cBhvr><p:cTn id="${c.id++}" dur="${e === 'growShrink' ? dur : Math.round(dur / 2)}" fill="hold"${e !== 'growShrink' ? ' autoRev="1"' : ''}/>${tgt(spid)}</p:cBhvr><p:by x="${s}" y="${s}"/></p:animScale>`; break;
    }
    case 'spin':
      body = `<p:animRot by="21600000"><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`; break;
    case 'teeter': case 'shake':
      body = `<p:animRot by="240000"><p:cBhvr><p:cTn id="${c.id++}" dur="${Math.max(1, Math.round(dur / 8))}" fill="hold" autoRev="1" repeatCount="4000"/>${tgt(spid)}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`; break;
    case 'transparency': case 'flash': {
      const o = e === 'flash' ? 0.1 : anim.opacity ?? 0.35;
      body = `<p:set><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"${e === 'flash' ? ' autoRev="1"' : ''}/>${tgt(spid)}<p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${o}"/></p:to></p:set>` + animEffect(c, spid, null, 'image', dur, `opacity: ${o}`); break;
    }
    case 'colorChange': {
      const hex = (anim.color ?? '#EF4444').replace('#', '').slice(0, 6).toUpperCase();
      body = `<p:animClr clrSpc="rgb" dir="cw"><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>fillcolor</p:attrName></p:attrNameLst></p:cBhvr><p:to><a:srgbClr val="${/^[0-9A-F]{6}$/.test(hex) ? hex : 'EF4444'}"/></p:to></p:animClr>`
        + `<p:set><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>fill.type</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="solid"/></p:to></p:set>`
        + `<p:set><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>fill.on</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="true"/></p:to></p:set>`;
      break;
    }
    // exit
    case 'fadeOut': case 'blurOut':
      body = animEffect(c, spid, 'out', 'fade', dur) + setVis(c, spid, 'hidden', dur - 1); break;
    case 'flyOut': { const f = flyFrom[dir ?? 'right'] ?? flyFrom.right; subtype = f[2]; body = animProp(c, spid, 'ppt_x', '#ppt_x', f[0], dur) + animProp(c, spid, 'ppt_y', '#ppt_y', f[1], dur) + setVis(c, spid, 'hidden', dur - 1); break; }
    case 'zoomOut': case 'shrink': case 'rotateOut':
      subtype = 16; body = animProp(c, spid, 'ppt_w', '#ppt_w', '0', dur) + animProp(c, spid, 'ppt_h', '#ppt_h', '0', dur) + animEffect(c, spid, 'out', 'fade', dur) + setVis(c, spid, 'hidden', dur - 1); break;
    case 'collapse': subtype = 21; body = animEffect(c, spid, 'out', 'barn(outVertical)', dur) + setVis(c, spid, 'hidden', dur - 1); break;
    case 'wipeOut': { const w = wipe[dir ?? 'left'] ?? wipe.left; subtype = w[1]; body = animEffect(c, spid, 'out', w[0], dur) + setVis(c, spid, 'hidden', dur - 1); break; }
    // motion
    case 'motionLine': case 'motionCurve': case 'motionCircle': case 'motionPath': {
      const mp = pptMotionPath(anim, c.W, c.H);
      if (mp.approx) c.partial.add('Motion path arcs → straight segments');
      body = `<p:animMotion origin="layout" path="${mp.path}" pathEditMode="relative" ptsTypes=""><p:cBhvr><p:cTn id="${c.id++}" dur="${dur}" fill="hold"/>${tgt(spid)}<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>`;
      break;
    }
    default:
      body = setVis(c, spid, 'visible') + animEffect(c, spid, 'in', 'fade', dur);
  }
  const repeat = anim.repeat === 'infinite' ? ' repeatCount="indefinite"' : anim.repeat ? ` repeatCount="${(anim.repeat + 1) * 1000}"` : '';
  void hasText;
  const grp = ` grpId="${grpId}"`;
  return `<p:par><p:cTn id="${eid}" presetID="${presetID}" presetClass="${presetClass}" presetSubtype="${subtype}"${repeat} fill="hold"${grp} nodeType="${nodeType}"><p:stCondLst><p:cond delay="${Math.round(delay)}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
}

/**
 * Build <p:timing> for a slide. Returns '' when there is nothing exportable.
 * `spidOf` maps element ids to the real cNvPr ids in the slide XML.
 */
export function timingXml(slide: Slide, spidOf: (elId: string) => { spid: number; isSp: boolean } | null, size: { width: number; height: number }, report: { partial: Set<string>; info: string[]; warnings: string[] }, slideIndex: number): string {
  const tl = buildTimeline(slide);
  if (!tl.steps.length) {
    if (tl.exitItems.length) report.info.push(`Slide ${slideIndex + 1}: "onExit" animations play in the web presentation only.`);
    return '';
  }
  if (tl.exitItems.length) report.info.push(`Slide ${slideIndex + 1}: ${tl.exitItems.length} "onExit" animation(s) play in the web presentation only.`);
  const c: TimingCtx = { id: 3, W: size.width, H: size.height, notes: [], partial: report.partial };
  const grpCounter = new Map<number, number>();
  const bld: { spid: number; grpId: number }[] = [];
  const clickPars: string[] = [];
  for (const step of tl.steps) {
    const items = step.items.map((it) => ({ it, t: spidOf(it.elId) })).filter((x) => {
      if (!x.t) report.warnings.push(`Slide ${slideIndex + 1}: animation on "${x.it.elId}" skipped (object not exported).`);
      return !!x.t;
    }) as { it: (typeof step.items)[number]; t: { spid: number; isSp: boolean } }[];
    if (!items.length) continue;
    const sorted = [...items].sort((a, b) => a.it.start - b.it.start);
    const groups: { start: number; list: typeof sorted }[] = [];
    sorted.forEach((x) => { const g = groups[groups.length - 1]; if (g && Math.abs(g.start - x.it.start) < 1) g.list.push(x); else groups.push({ start: x.it.start, list: [x] }); });
    const outerId = c.id++;
    const subPars = groups.map((g, gi) => {
      const subId = c.id++;
      const effects = g.list.map((x, k) => {
        const nodeType = k > 0 ? 'withEffect' : gi === 0 ? (step.trigger === 'click' ? 'clickEffect' : 'afterEffect') : 'afterEffect';
        const gid = grpCounter.get(x.t.spid) ?? 0;
        grpCounter.set(x.t.spid, gid + 1);
        if (x.t.isSp) bld.push({ spid: x.t.spid, grpId: gid });
        return effectXml(c, x.it.anim, x.t.spid, nodeType, 0, gid, x.t.isSp);
      }).join('');
      return `<p:par><p:cTn id="${subId}" fill="hold"><p:stCondLst><p:cond delay="${Math.round(g.start)}"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par>`;
    }).join('');
    const cond = step.trigger === 'auto' ? '<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>' : '<p:cond delay="indefinite"/>';
    clickPars.push(`<p:par><p:cTn id="${outerId}" fill="hold"><p:stCondLst>${cond}</p:stCondLst><p:childTnLst>${subPars}</p:childTnLst></p:cTn></p:par>`);
  }
  if (!clickPars.length) return '';
  const bldLst = bld.length ? `<p:bldLst>${bld.map((b) => `<p:bldP spid="${b.spid}" grpId="${b.grpId}" animBg="1"/>`).join('')}</p:bldLst>` : '';
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clickPars.join('')}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bldLst}</p:timing>`;
}

/** Insert transition + timing in schema order (after clrMapOvr, before extLst). */
export function insertTransitionTiming(xml: string, transition: string, timing: string): string {
  if (!transition && !timing) return xml;
  const anchor = xml.indexOf('</p:clrMapOvr>');
  if (anchor < 0) return xml.replace('</p:sld>', `${transition}${timing}</p:sld>`);
  const at = anchor + '</p:clrMapOvr>'.length;
  return xml.slice(0, at) + transition + timing + xml.slice(at);
}

export function transitionSupport(t: Transition | undefined): 'supported' | 'partial' | 'unsupported' {
  if (!t) return 'supported';
  return (TRANSITIONS as Record<string, { pptx: 'supported' | 'partial' | 'unsupported' }>)[t.type]?.pptx ?? 'unsupported';
}

/** pptxgenjs can assign colliding cNvPr ids (tables/charts); make every id unique. */
export function dedupeShapeIds(xml: string): string {
  const seen = new Set<string>();
  const all = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => Number(m[1]));
  let next = Math.max(1, ...all) + 1;
  return xml.replace(/<p:cNvPr id="(\d+)"/g, (m, id: string) => {
    if (!seen.has(id)) { seen.add(id); return m; }
    const nid = String(next++);
    seen.add(nid);
    return `<p:cNvPr id="${nid}"`;
  });
}

/**
 * pptxgenjs writes an <a:pPr> before every run; the schema allows exactly one,
 * as the first child of <a:p>. Keep the first and drop the rest.
 */
export function fixParagraphProperties(xml: string): string {
  const PPR = /<a:pPr\b[^>]*\/>|<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/g;
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (whole, body: string) => {
    const all = body.match(PPR);
    if (!all || (all.length === 1 && body.startsWith(all[0]))) return whole;
    const first = all[0];
    const rest = body.replace(PPR, '');
    return `<a:p>${first}${rest}</a:p>`;
  });
}
