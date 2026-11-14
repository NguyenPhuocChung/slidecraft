import type { SourceFormat } from './types';

/** Remove a surrounding ```lang fence (AI chat output) and BOM. Returns all fenced blocks when several exist. */
export function extractCodeBlocks(input: string): { blocks: string[]; langs: string[] } {
  const src = input.replace(/^﻿/, '');
  const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  const langs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    blocks.push(m[2]);
    langs.push(m[1].toLowerCase());
  }
  if (blocks.length) {
    // A Markdown deck may itself contain code fences (```ts …```). Only unwrap fences when the
    // surrounding text is not a Markdown slide deck.
    const outside = src.replace(/```[\s\S]*?```/g, '');
    const markdownDeck = /^#{1,3}\s/m.test(outside) && /^-{3,}\s*$/m.test(outside);
    const codeLangs = ['json', 'jsonc', 'json5', 'js', 'javascript', 'ts', 'typescript', 'tsx', 'jsx', 'html', ''];
    if (!markdownDeck || langs.some((l) => ['json', 'jsonc', 'json5', 'tsx', 'jsx'].includes(l)) && !langs.some((l) => !codeLangs.includes(l))) return { blocks, langs };
  }
  return { blocks: [src], langs: [''] };
}

export function detectFormat(code: string, hint = ''): SourceFormat {
  const h = hint.toLowerCase();
  if (['json', 'jsonc', 'json5'].includes(h)) return 'json';
  if (['tsx', 'jsx'].includes(h)) return 'tsx';
  if (['html', 'htm', 'xml'].includes(h)) return 'html';
  if (['md', 'markdown'].includes(h)) return 'markdown';
  const s = code.trim();
  if (!s) return 'unknown';
  if (/^[[{]/.test(s)) return 'json';
  if (/^<!doctype html|^<html|^<section|^<div|^<body/i.test(s)) return 'html';
  if (/<Presentation[\s>]|<Slide[\s>]/.test(s)) return 'tsx';
  if (/^(export|const|let|var|module\.exports|import)\b/m.test(s) && /[{[]/.test(s)) return /return\s*\(?\s*</.test(s) || /=>\s*\(?\s*</.test(s) ? 'tsx' : 'js';
  if (/^#\s|\n---\s*\n|^---\s*\n/m.test(s)) return 'markdown';
  if (/<\/?[a-z][\s\S]*>/i.test(s)) return 'html';
  return 'unknown';
}
