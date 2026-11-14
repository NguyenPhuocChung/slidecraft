import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { analyzeCode, importPresentation } from '@/code-parser';
import { EXAMPLES, HTML_EXAMPLE, MARKDOWN_EXAMPLE, TSX_EXAMPLE } from '@/code-import/examples';
import { EXAMPLE_OUTPUT } from '@/prompts/example';

const domParser = new new JSDOM('').window.DOMParser();

describe('Code Import examples', () => {
  it('every example in the Example Code menu builds', () => {
    for (const ex of EXAMPLES) {
      const { presentation, analysis } = importPresentation(ex.code(), { domParser });
      expect(analysis.report.errorCount, `${ex.id}: ${analysis.report.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`).toBe(0);
      expect(presentation?.slides.length, ex.id).toBeGreaterThan(0);
    }
  });
  it('TSX example is detected and converted', () => {
    const a = analyzeCode(TSX_EXAMPLE);
    expect(a.format).toBe('tsx');
    expect(a.report.stats.slides).toBe(4);
    expect(a.report.stats.charts).toBeGreaterThanOrEqual(1);
  });
  it('Markdown and HTML examples are detected', () => {
    expect(analyzeCode(MARKDOWN_EXAMPLE).format).toBe('markdown');
    expect(analyzeCode(HTML_EXAMPLE, { domParser }).format).toBe('html');
  });
  it('strips AI chat code fences', () => {
    const r = analyzeCode('Here is your deck:\n```json\n' + JSON.stringify(EXAMPLE_OUTPUT) + '\n```\nEnjoy!');
    expect(r.report.ok).toBe(true);
  });
  it('merges multi-part documents pasted as separate blocks', () => {
    const slides = EXAMPLE_OUTPUT.slides;
    const p1 = { ...EXAMPLE_OUTPUT, part: { index: 1, total: 2, presentationId: 'x' }, slides: slides.slice(0, 3) };
    const p2 = { schemaVersion: '1.0', title: 'x', part: { index: 2, total: 2, presentationId: 'x' }, slides: slides.slice(3) };
    const src = '```json\n' + JSON.stringify(p2) + '\n```\n```json\n' + JSON.stringify(p1) + '\n```';
    const { presentation, analysis } = importPresentation(src);
    expect(analysis.report.errorCount).toBe(0);
    expect(presentation?.slides.map((s) => s.id)).toEqual(slides.map((s) => s.id));
    expect(presentation?.theme).toBe('startup-pitch');
  });
  it('auto fix repairs safe issues without losing content and reports line numbers', () => {
    const bad = `{
  "title": "Fix me",
  "slides": [
    { "elements": [
      { "type": "title", "x": "120px", "y": 100, "width": 800, "height": 120, "content": "Hello world", "animation": "fade" },
      { "type": "chart", "x": 100, "y": 300, "width": 900, "height": 500, "content": { "type": "doughnut", "labels": ["A","B"], "datasets": [{ "label": "Share", "data": [60, 40] }] } }
    ] }
  ]
}`;
    const before = analyzeCode(bad);
    expect(before.report.ok).toBe(false);
    const errWithLine = before.report.issues.find((i) => i.severity === 'error' && i.path?.includes('elements'));
    expect(errWithLine?.line).toBeGreaterThan(1);
    const after = analyzeCode(bad, { autoFix: true });
    expect(after.report.errorCount).toBe(0);
    expect(after.report.fixesApplied.length).toBeGreaterThan(3);
    const json = JSON.stringify(after.data);
    expect(json).toContain('Hello world');
    expect(json).toContain('[60,40]');
  });
  it('reports syntax errors with position', () => {
    const r = analyzeCode('{ "schemaVersion": "1.0", "title": "x", "slides": [ { "id": "a" } ');
    expect(r.report.ok).toBe(false);
    expect(r.report.issues[0].line).toBeDefined();
  });
});
