import { ASPECT_RATIOS } from '@/types/registry';
import { measureParagraphs, parseMarkdownLite } from '@/utils/richtext';
import { COMPONENTS, type Frame, type Raw } from './components';
import { isJsx, parseProgram, StaticEvaluator, type JsxNode } from './static-eval';
import type { Issue, LocMap } from './types';
import { ParseError, pathKey } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STYLE_PROPS = ['color', 'fontSize', 'fontWeight', 'fontFamily', 'align', 'verticalAlign', 'lineHeight', 'letterSpacing', 'fill', 'radius', 'italic', 'underline', 'textTransform', 'fit', 'mask', 'gradient', 'shadow', 'stroke', 'padding', 'headStart', 'headEnd', 'strokeWidth', 'palette', 'grayscale', 'overlay', 'flipH', 'flipV', 'focalX', 'focalY', 'crop'];
const BASE_PROPS = ['id', 'name', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex', 'locked', 'visible', 'link', 'alt', 'responsive'];
const HEADING_SIZES = [120, 80, 56, 40];

/** Inline JSX children → markdown-lite string */
function inlineText(children: unknown[]): string {
  return children.map((c) => {
    if (typeof c === 'string' || typeof c === 'number') return String(c);
    if (isJsx(c)) {
      const inner = inlineText(c.children);
      switch (c.name) {
        case 'b': case 'strong': return `**${inner}**`;
        case 'i': case 'em': return `*${inner}*`;
        case 's': case 'del': return `~~${inner}~~`;
        case 'code': return '`' + inner + '`';
        case 'mark': return `==${inner}==`;
        case 'a': return `[${inner}](${String(c.props.href ?? '')})`;
        case 'br': return '\n';
        case 'li': return `\n- ${inner}`;
        case 'ul': case 'ol': return inner + '\n';
        case 'p': case 'span': return inner;
        default: return inner;
      }
    }
    return '';
  }).join('').replace(/^\n+/, '');
}

interface Ctx { W: number; H: number; locs: LocMap; issues: Issue[]; idSeq: number; unknown: Set<string> }

function normalizeAnimation(a: unknown): unknown {
  if (typeof a === 'string') return [{ effect: a }];
  return a;
}

function estimateHeight(type: string, props: Raw, text: string, width: number): number {
  const fs = props.fontSize ?? (type === 'heading' ? HEADING_SIZES[Math.min(3, Math.max(0, Number(props.level ?? 2)))] : 30);
  const { height } = measureParagraphs(parseMarkdownLite(text || ' '), width, { fontSize: fs, lineHeight: props.lineHeight ?? (type === 'heading' ? 1.1 : 1.4), paragraphSpacing: 8 });
  return Math.ceil(height * 1.08 + 6);
}

/** Convert one JSX node into one or more raw elements, laid out inside `area`. */
function convertNode(node: JsxNode, ctx: Ctx, area: Frame, path: (string | number)[]): Raw[] {
  const def = COMPONENTS[node.name];
  const p = node.props as Raw;
  const text = inlineText(node.children);
  if (!def) {
    ctx.unknown.add(node.name);
    ctx.issues.push({ severity: 'warning', code: 'tsx.unknownComponent', message: `Unknown component <${node.name}> — converted to a text box so no content is lost.`, line: node.loc?.line, column: node.loc?.column });
    if (!text.trim()) return [];
    return convertNode({ ...node, name: 'Text' }, ctx, area, path);
  }
  if (def.kind === 'meta') {
    ctx.issues.push({ severity: 'warning', code: 'tsx.misplaced', message: `<${node.name}> is not allowed here.`, line: node.loc?.line });
    return [];
  }
  const id = String(p.id ?? `${node.name.toLowerCase()}-${++ctx.idSeq}`);
  const width = Number(p.width ?? p.w ?? (def.defaultSize.width === 'fill' ? area.width : Math.min(area.width, def.defaultSize.width as number)));
  const x = Number(p.x ?? area.x);
  const y = Number(p.y ?? area.y);
  if (node.loc) ctx.locs.set(pathKey(path), node.loc);

  if (def.kind === 'container') {
    const gap = Number(p.gap ?? 32);
    const kids = node.children.filter(isJsx);
    const out: Raw[] = [];
    if (node.name === 'Group') {
      const children: Raw[] = [];
      let cy = 0;
      kids.forEach((k, i) => {
        const els = convertNode(k, ctx, { x: 0, y: cy, width, height: 10000 }, [...path, 'content', 'children', i]);
        els.forEach((e) => { cy = Math.max(cy, e.y + e.height + gap); });
        children.push(...els);
      });
      const h = Number(p.height ?? p.h ?? Math.max(1, ...children.map((c) => c.y + c.height)));
      return [{ id, type: 'group', x, y, width, height: h, content: { children }, ...pickBase(p) }];
    }
    if (node.name === 'Stack') {
      let cy = y;
      kids.forEach((k, i) => {
        const els = convertNode(k, ctx, { x, y: cy, width, height: 10000 }, [...path, i]);
        out.push(...els);
        const bottom = Math.max(cy, ...els.map((e) => e.y + e.height));
        cy = bottom + gap;
      });
      return out;
    }
    if (node.name === 'Flex') {
      const n = Math.max(1, kids.length);
      const cw = (width - gap * (n - 1)) / n;
      const h = Number(p.height ?? p.h ?? 400);
      kids.forEach((k, i) => out.push(...convertNode(k, ctx, { x: x + i * (cw + gap), y, width: cw, height: h }, [...path, i])));
      return out;
    }
    // Grid
    const cols = Math.max(1, Number(p.columns ?? 3));
    const rows = Math.ceil(kids.length / cols);
    const h = Number(p.height ?? p.h ?? rows * 320);
    const cw = (width - gap * (cols - 1)) / cols;
    const rh = (h - gap * (rows - 1)) / rows;
    kids.forEach((k, i) => {
      const kk = { ...k, props: { ...k.props } };
      const f = { x: x + (i % cols) * (cw + gap), y: y + Math.floor(i / cols) * (rh + gap), width: cw, height: rh };
      if (kk.props.width === undefined) kk.props.width = cw;
      if (kk.props.height === undefined) kk.props.height = rh;
      out.push(...convertNode(kk, ctx, f, [...path, i]));
    });
    return out;
  }

  let height = Number(p.height ?? p.h ?? 0);
  if (!height) height = def.defaultSize.height === 'auto' ? estimateHeight(def.type ?? 'text', p, text, width) : (def.defaultSize.height as number);
  const frame = { x, y, width, height };

  if (def.kind === 'expand') return def.expand!(p, text, frame, id).map((e) => (p.animation && e.id.endsWith('-bg') ? e : { ...e, ...(p.animation ? { animation: normalizeAnimation(p.animation) } : {}) }));

  const style: Raw = { ...(p.style ?? {}) };
  for (const k of STYLE_PROPS) if (p[k] !== undefined && style[k] === undefined) style[k] = p[k];
  if (p.thickness !== undefined) style.stroke = { ...(style.stroke ?? {}), width: p.thickness, color: p.color ?? style.stroke?.color };
  if (def.type === 'heading' && style.fontSize === undefined && p.level !== undefined) style.fontSize = HEADING_SIZES[Math.min(3, Math.max(0, Number(p.level)))];
  const el: Raw = { ...pickBase(p), id, type: def.type, x, y, width, height, content: def.content!(p, text) };
  if (def.type === 'line' || def.type === 'arrow') {
    el.content = { x1: p.x1 ?? x, y1: p.y1 ?? y, x2: p.x2 ?? x + width, y2: p.y2 ?? y + (p.height ?? 0) };
    if (def.type === 'arrow' && !style.headEnd) style.headEnd = 'triangle';
    if (p.color && !style.stroke) style.stroke = { color: p.color, width: p.thickness ?? 4 };
    delete style.color;
  }
  if (Object.keys(style).length) el.style = style;
  if (p.animation) el.animation = normalizeAnimation(p.animation);
  return [el];
}

function pickBase(p: Raw): Raw {
  const r: Raw = {};
  for (const k of BASE_PROPS) if (p[k] !== undefined) r[k] = p[k];
  if (p.w !== undefined && r.width === undefined) r.width = p.w;
  if (p.h !== undefined && r.height === undefined) r.height = p.h;
  return r;
}

function convertSlide(node: JsxNode, index: number, ctx: Ctx): Raw {
  const p = node.props as Raw;
  const slide: Raw = { id: String(p.id ?? `slide-${index + 1}`) };
  for (const k of ['type', 'title', 'section', 'layout', 'content', 'background', 'theme', 'transition', 'duration', 'hidden', 'starred', 'notes', 'metadata']) if (p[k] !== undefined) slide[k] = p[k];
  if (node.loc) ctx.locs.set(`slides[${index}]`, node.loc);
  const elements: Raw[] = [];
  const M = 120;
  let flowY = 100;
  const kids = node.children;
  kids.forEach((k) => {
    if (typeof k === 'string' && k.trim()) {
      ctx.issues.push({ severity: 'warning', code: 'tsx.looseText', message: `Loose text in <Slide> wrapped in a <Text> element: "${k.slice(0, 40)}"`, line: node.loc?.line });
      k = { __jsx: true, name: 'Text', props: {}, children: [k] } as JsxNode;
    }
    if (!isJsx(k)) return;
    if (k.name === 'Notes') { slide.notes = [slide.notes, inlineText(k.children)].filter(Boolean).join('\n'); return; }
    const auto = k.props.x === undefined && k.props.y === undefined && !['Decor'].includes(k.name);
    const area = { x: M, y: flowY, width: ctx.W - M * 2, height: ctx.H - flowY - M };
    const els = convertNode(k, ctx, area, ['slides', index, 'elements', elements.length]);
    if (auto && els.length) flowY = Math.max(flowY, ...els.map((e) => e.y + e.height)) + 36;
    elements.push(...els);
  });
  slide.elements = elements;
  return slide;
}

export function parseTsx(code: string): { data?: unknown; locs: LocMap; issues: Issue[]; unknownComponents: string[] } {
  const locs: LocMap = new Map();
  const issues: Issue[] = [];
  const ctx: Ctx = { W: 1920, H: 1080, locs, issues, idSeq: 0, unknown: new Set() };
  try {
    const ast = parseProgram(code, true);
    const ev = new StaticEvaluator(locs);
    ev.registerProgram(ast.program);
    // Locate root JSX: default-exported component or any <Presentation>.
    let root: unknown;
    for (const st of ast.program.body) {
      if (st.type !== 'ExportDefaultDeclaration') continue;
      let d = st.declaration;
      if (d.type === 'Identifier') d = ev.getGlobal(d.name) ?? d;
      if (d.type === 'FunctionDeclaration' || d.type === 'ArrowFunctionExpression' || d.type === 'FunctionExpression') root = ev.apply({ __fn: d, scope: new Map() }, [{}]);
      else root = ev.eval(d);
    }
    if (!isJsx(root) || root.name !== 'Presentation') root = findPresentation(ast.program, ev);
    if (!isJsx(root)) throw new ParseError('No <Presentation> root element found. Wrap slides in <Presentation>…</Presentation>.');
    const p = root.props as Raw;
    const ar = (p.aspectRatio as keyof typeof ASPECT_RATIOS) ?? '16:9';
    const size = p.size ?? ASPECT_RATIOS[ar] ?? ASPECT_RATIOS['16:9'];
    ctx.W = size.width; ctx.H = size.height;
    const slides = root.children.filter((c): c is JsxNode => isJsx(c) && c.name === 'Slide');
    root.children.filter((c) => isJsx(c) && c.name !== 'Slide').forEach((c) => issues.push({ severity: 'warning', code: 'tsx.misplaced', message: `<${(c as JsxNode).name}> must be inside a <Slide>.`, line: (c as JsxNode).loc?.line }));
    const data: Raw = { schemaVersion: String(p.schemaVersion ?? '1.0') };
    for (const k of ['id', 'title', 'description', 'author', 'version', 'language', 'direction', 'aspectRatio', 'size', 'theme', 'typography', 'globalStyles', 'sections', 'assets', 'metadata', 'part']) if (p[k] !== undefined) data[k] = p[k];
    data.slides = slides.map((s, i) => convertSlide(s, i, ctx));
    ev.warnings.forEach((w) => issues.push({ severity: 'warning', code: 'tsx.identifier', message: w.message, ...w.loc }));
    return { data, locs, issues, unknownComponents: [...ctx.unknown] };
  } catch (e) {
    const err = e as ParseError;
    issues.push({ severity: 'error', code: 'syntax', message: err.message, ...(err.loc ?? {}) });
    return { locs, issues, unknownComponents: [...ctx.unknown] };
  }
}

function findPresentation(program: any, ev: StaticEvaluator): unknown {
  let found: any;
  const visit = (n: any) => {
    if (found || !n || typeof n !== 'object') return;
    if (n.type === 'JSXElement' && n.openingElement.name.name === 'Presentation') { found = n; return; }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object' && v.type) visit(v);
    }
  };
  visit(program);
  return found ? ev.eval(found) : undefined;
}
