import { parseTree, printParseErrorCode, type Node, type ParseError as JsoncError } from 'jsonc-parser';
import type { Issue, LocMap } from './types';
import { pathKey } from './types';

function offsetToLoc(text: string, offset: number) {
  let line = 1, col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') { line++; col = 1; } else col++;
  }
  return { line, column: col };
}

function nodeValue(n: Node): unknown {
  switch (n.type) {
    case 'object': {
      const o: Record<string, unknown> = {};
      for (const p of n.children ?? []) if (p.children?.[0] && p.children[1]) o[String(p.children[0].value)] = nodeValue(p.children[1]);
      return o;
    }
    case 'array':
      return (n.children ?? []).map(nodeValue);
    default:
      return n.value;
  }
}

function walk(n: Node, text: string, path: (string | number)[], locs: LocMap) {
  locs.set(pathKey(path), offsetToLoc(text, n.offset));
  if (n.type === 'object') for (const p of n.children ?? []) { if (p.children?.[1]) walk(p.children[1], text, [...path, String(p.children[0].value)], locs); }
  else if (n.type === 'array') (n.children ?? []).forEach((c, i) => walk(c, text, [...path, i], locs));
}

/** Tolerant JSON parser: accepts comments and trailing commas (reported as warnings), maps every path to line/column. */
export function parseJson(text: string): { data?: unknown; locs: LocMap; issues: Issue[] } {
  const errors: JsoncError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false, allowEmptyContent: false });
  const locs: LocMap = new Map();
  const issues: Issue[] = [];
  const hasComments = /(^|[^:"'])\/\/|\/\*/.test(text.replace(/"(?:\\.|[^"\\])*"/g, '""'));
  if (hasComments) issues.push({ severity: 'info', code: 'json.comments', message: 'JSON contains comments — they were ignored.' });
  if (/,\s*[}\]]/.test(text.replace(/"(?:\\.|[^"\\])*"/g, '""'))) issues.push({ severity: 'info', code: 'json.trailingComma', message: 'Trailing commas were tolerated.' });
  for (const e of errors) {
    const loc = offsetToLoc(text, e.offset);
    issues.push({ severity: 'error', code: 'syntax', message: `JSON syntax error: ${printParseErrorCode(e.error)}`, ...loc });
  }
  if (!tree || errors.length) {
    if (!errors.length) issues.push({ severity: 'error', code: 'syntax', message: 'Empty or invalid JSON document.' });
    return { locs, issues };
  }
  walk(tree, text, [], locs);
  return { data: nodeValue(tree), locs, issues };
}
