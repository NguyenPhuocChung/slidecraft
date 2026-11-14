import { describe, expect, it } from 'vitest';
import { importPresentation } from '@/code-parser';
import { SAMPLES } from '@/samples';

const EXPECTED: Record<string, number> = {
  'sample-business-pitch': 10,
  'sample-academic': 15,
  'sample-technology': 12,
  'sample-marketing': 10,
  'sample-data-report': 15,
};

describe('sample presentations', () => {
  it('has the five required samples', () => {
    expect(SAMPLES.map((s) => s.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const sample of SAMPLES) {
    describe(sample.title, () => {
      const code = JSON.stringify(sample.data, null, 2);
      const { presentation, analysis } = importPresentation(code);
      const { report } = analysis;

      it('imports without errors', () => {
        const errors = report.issues.filter((i) => i.severity === 'error');
        expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
        expect(report.ok).toBe(true);
        expect(report.errorCount).toBe(0);
        expect(report.format).toBe('json');
      });

      it('has the expected slide count', () => {
        expect(report.stats.slides).toBe(EXPECTED[sample.id]);
        expect(presentation?.slides.length).toBe(EXPECTED[sample.id]);
        expect(sample.slideCount).toBe(EXPECTED[sample.id]);
      });

      it('every slide renders at least one element', () => {
        for (const s of presentation!.slides) expect(s.elements.length, s.id).toBeGreaterThan(0);
      });

      it('uses only slots the chosen layouts display', () => {
        const unused = report.issues.filter((i) => i.code === 'layout.unusedSlots' || i.code === 'layout.unknown');
        expect(unused, JSON.stringify(unused, null, 2)).toEqual([]);
      });

      it('has no unsupported properties', () => {
        const w = report.issues.filter((i) => i.code.startsWith('unsupported'));
        expect(w, JSON.stringify(w, null, 2)).toEqual([]);
      });
    });
  }
});
