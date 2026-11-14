import { describe, expect, it } from 'vitest';
import { SAMPLES } from '@/samples';
import { importPresentation } from '@/code-parser';
import { checkPresentation } from '@/quality/checker';

describe('Presentation Quality Checker', () => {
  it('scores every sample deck within 0–100 with consistent category maxima', () => {
    for (const s of SAMPLES) {
      const { presentation: p } = importPresentation(JSON.stringify(s.data));
      const r = checkPresentation(p!);
      expect(r.score).toBeGreaterThanOrEqual(40);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.categories.reduce((a, c) => a + c.max, 0)).toBe(100);
      expect(r.slides).toHaveLength(p!.slides.length);
      r.issues.forEach((i) => { expect(i.suggestion.length).toBeGreaterThan(5); expect(i.slideId).toBeTruthy(); });
    }
  });

  it('detects low contrast, tiny text, overlap and too much text on a crafted slide', () => {
    const long = Array.from({ length: 160 }, (_, i) => `word${i}`).join(' ');
    const { presentation: p } = importPresentation(JSON.stringify({
      schemaVersion: '1.0', title: 'Bad', theme: 'minimal-white',
      slides: [{ id: 's1', elements: [
        { id: 'h', type: 'heading', x: 100, y: 100, width: 1600, height: 120, content: { text: 'Pale heading' }, style: { color: '#f2f2f2' } },
        { id: 't1', type: 'paragraph', x: 100, y: 300, width: 800, height: 200, content: { text: 'Tiny text that nobody can read from the back row' }, style: { fontSize: 12 } },
        { id: 't2', type: 'paragraph', x: 150, y: 320, width: 800, height: 200, content: { text: long } },
      ] }],
    }));
    const r = checkPresentation(p!);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('lowContrast');
    expect(codes).toContain('smallText');
    expect(codes).toContain('textOverlap');
    expect(codes).toContain('tooMuchText');
    expect(r.issues.find((i) => i.code === 'lowContrast')?.elementId).toBe('h');
    expect(r.score).toBeLessThan(90);
  });

  it('does not modify the presentation', () => {
    const { presentation: p } = importPresentation(JSON.stringify(SAMPLES[0].data));
    const before = JSON.stringify(p);
    checkPresentation(p!);
    expect(JSON.stringify(p)).toBe(before);
  });
});
