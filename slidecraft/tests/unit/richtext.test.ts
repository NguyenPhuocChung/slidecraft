import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdownLite, paragraphsToMarkdown } from '@/utils/richtext';

describe('markdown-lite', () => {
  it('parses nested inline formatting without hanging', () => {
    const runs = parseInline('A **bold *and italic*** word, `code`, ==accent== and [link](https://x.y)');
    expect(runs.map((r) => r.text).join('')).toBe('A bold and italic word, code, accent and link');
    expect(runs.find((r) => r.text === 'and italic')).toMatchObject({ bold: true, italic: true });
    expect(runs.find((r) => r.text === 'accent')).toMatchObject({ color: '$accent' });
    expect(runs.find((r) => r.text === 'link')).toMatchObject({ link: 'https://x.y' });
  });
  it('parses bullets, numbers and levels', () => {
    const ps = parseMarkdownLite('Intro\n- one\n  - nested\n1. first\n2. second');
    expect(ps.map((p) => p.list ?? null)).toEqual([null, 'bullet', 'bullet', 'number', 'number']);
    expect(ps[2].level).toBe(1);
  });
  it('round-trips to markdown', () => {
    const src = 'Hello **world**\n- item *one*\n1. step';
    expect(paragraphsToMarkdown(parseMarkdownLite(src))).toBe(src);
  });
});
