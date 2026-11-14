import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { importPresentation } from '@/code-parser';
import { exportPptx, validatePptx } from '@/pptx-export';

/** Raw chat answers produced by an independent AI that was given only the Master Prompt + user content. */
const FIXTURES = ['external-ai-business-report.md', 'external-ai-lecture.md'];

describe('external AI output (Master Prompt round-trip)', () => {
  it.each(FIXTURES)('%s imports with 0 errors and exports a valid PPTX', async (f) => {
    const src = fs.readFileSync(`tests/fixtures/${f}`, 'utf8');
    const { presentation, analysis } = importPresentation(src);
    expect(analysis.report.errorCount).toBe(0);
    expect(presentation!.slides.length).toBeGreaterThanOrEqual(10);
    expect(new Set(presentation!.slides.map((s) => s.layout)).size).toBeGreaterThanOrEqual(8);
    const { blob, report } = await exportPptx(presentation!);
    expect(report.ok).toBe(true);
    expect((await validatePptx(blob as Uint8Array, presentation!.slides.length)).ok).toBe(true);
  });
});
