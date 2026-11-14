/**
 * Tiny XML tree over fast-xml-parser (preserveOrder keeps document order —
 * required for z-order in spTree and run order in paragraphs).
 * Element names are stored WITHOUT namespace prefix (p:sp → "sp", dsp:sp → "sp"),
 * attributes keep their raw names (use attr()/rel() to read them).
 */
import { XMLParser } from 'fast-xml-parser';

export interface XNode {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
  text?: string;
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

const local = (name: string) => { const i = name.indexOf(':'); return i >= 0 ? name.slice(i + 1) : name; };

/* eslint-disable @typescript-eslint/no-explicit-any */
function convert(arr: any[]): XNode[] {
  const out: XNode[] = [];
  for (const item of arr ?? []) {
    if (!item || typeof item !== 'object') continue;
    const attrs = (item[':@'] ?? {}) as Record<string, string>;
    for (const key of Object.keys(item)) {
      if (key === ':@') continue;
      if (key === '#text') { out.push({ tag: '#text', attrs: {}, children: [], text: String(item[key]) }); continue; }
      const v = item[key];
      out.push({ tag: local(key), attrs, children: Array.isArray(v) ? convert(v) : [] });
    }
  }
  return out;
}

/** Parse an XML string and return the document element (or an empty node). */
export function parseXml(xml: string): XNode {
  try {
    const nodes = convert(parser.parse(xml) as any[]);
    return nodes.find((n) => n.tag !== '#text') ?? { tag: '', attrs: {}, children: [] };
  } catch {
    return { tag: '', attrs: {}, children: [] };
  }
}

export const kids = (n: XNode | undefined): XNode[] => (n ? n.children.filter((c) => c.tag !== '#text') : []);
export const child = (n: XNode | undefined, tag: string): XNode | undefined => n?.children.find((c) => c.tag === tag);
export const children = (n: XNode | undefined, tag: string): XNode[] => (n ? n.children.filter((c) => c.tag === tag) : []);
/** Follow a path of local tag names. */
export function path(n: XNode | undefined, ...tags: string[]): XNode | undefined {
  let cur = n;
  for (const t of tags) { cur = child(cur, t); if (!cur) return undefined; }
  return cur;
}
/** Depth-first search for the first descendant with the given tag. */
export function find(n: XNode | undefined, tag: string): XNode | undefined {
  if (!n) return undefined;
  for (const c of n.children) {
    if (c.tag === tag) return c;
    const f = find(c, tag);
    if (f) return f;
  }
  return undefined;
}
export function findAll(n: XNode | undefined, tag: string, out: XNode[] = []): XNode[] {
  if (!n) return out;
  for (const c of n.children) {
    if (c.tag === tag) out.push(c);
    findAll(c, tag, out);
  }
  return out;
}
/** Attribute by local name: exact (unprefixed) first, then any prefixed variant. */
export function attr(n: XNode | undefined, name: string): string | undefined {
  if (!n) return undefined;
  if (n.attrs[name] !== undefined) return n.attrs[name];
  for (const k of Object.keys(n.attrs)) if (k.includes(':') && local(k) === name && !k.startsWith('xmlns')) return n.attrs[k];
  return undefined;
}
/** Relationship attribute (r:id, r:embed, r:link …) — only prefixed names. */
export function rel(n: XNode | undefined, name: string): string | undefined {
  if (!n) return undefined;
  for (const k of Object.keys(n.attrs)) if (k.includes(':') && !k.startsWith('xmlns') && local(k) === name) return n.attrs[k];
  return undefined;
}
export const num = (v: string | undefined, d = 0): number => { const x = v === undefined ? NaN : Number(v); return Number.isFinite(x) ? x : d; };
export const bool = (v: string | undefined): boolean | undefined => (v === undefined ? undefined : v === '1' || v === 'true' || v === 'on');
/** Concatenated text of all descendant text nodes. */
export function textOf(n: XNode | undefined): string {
  if (!n) return '';
  if (n.tag === '#text') return n.text ?? '';
  return n.children.map(textOf).join('');
}

/**
 * Resolve mc:AlternateContent: prefer a Choice whose namespaces we understand,
 * else the Fallback. Returns the replacement child nodes.
 */
export function resolveAlternate(n: XNode, supported: string[] = ['p14', 'p159', 'a14', 'p15']): XNode[] {
  for (const c of kids(n)) {
    if (c.tag !== 'Choice') continue;
    const req = (attr(c, 'Requires') ?? '').split(/\s+/).filter(Boolean);
    if (req.every((r) => supported.includes(r))) return kids(c);
  }
  const fb = child(n, 'Fallback');
  return fb ? kids(fb) : [];
}
