import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { SAMPLES } from '@/samples';
import { importPresentation } from '@/code-parser';
import { exportPptx, preflight, validatePptx } from '@/pptx-export';
import { transitionXml, pptMotionPath } from '@/pptx-export/ooxml';

const OUT = process.env.PPTX_OUT_DIR;

describe('PPTX export engine', () => {
  for (const sample of SAMPLES) {
    it(`exports "${sample.title}" as a valid PPTX`, async () => {
      const { presentation: p } = importPresentation(JSON.stringify(sample.data));
      expect(p).toBeDefined();
      const pre = preflight(p!);
      expect(pre.slideCount).toBe(p!.slides.length);
      const { blob, report } = await exportPptx(p!);
      const bytes = blob as Uint8Array;
      if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `${sample.id}.pptx`), bytes); fs.writeFileSync(path.join(OUT, `${sample.id}.report.json`), JSON.stringify(report, null, 2)); }
      const failed = report.checks.filter((c) => !c.ok && c.name.startsWith('Post-export'));
      expect(failed, JSON.stringify(failed)).toEqual([]);
      expect(report.errors).toEqual([]);
      expect(report.ok).toBe(true);
      const v = await validatePptx(bytes, p!.slides.length);
      expect(v.ok, JSON.stringify(v.checks.filter((c) => !c.ok))).toBe(true);
      const zip = await JSZip.loadAsync(bytes);
      for (let i = 0; i < p!.slides.length; i++) {
        const s = p!.slides[i];
        const xml = await zip.file(`ppt/slides/slide${i + 1}.xml`)!.async('string');
        if (s.transition && s.transition.type !== 'none') expect(xml, `slide ${i + 1} transition`).toMatch(/<p:transition/);
        if (s.transition?.type === 'morph') { expect(xml).toMatch(/p159:morph/); expect(xml).toMatch(/name="!!/); }
        const animated = s.elements.some((e) => e.animation?.some((a) => a.trigger !== 'onExit'));
        if (animated) {
          expect(xml, `slide ${i + 1} timing`).toMatch(/<p:timing>/);
          const ids = new Set([...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]));
          for (const m of xml.matchAll(/<p:spTgt spid="(\d+)"/g)) expect(ids.has(m[1])).toBe(true);
        }
        if (s.notes) {
          const notes = await zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`)!.async('string');
          expect(notes).toContain(s.notes.slice(0, 20).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'));
        }
      }
    }, 60000);
  }

  it('maps transitions to OOXML with fallbacks', () => {
    expect(transitionXml({ type: 'push', duration: 800, direction: 'up' }).xml).toContain('<p:push dir="u"/>');
    const m = transitionXml({ type: 'morph', duration: 1500 }).xml;
    expect(m).toContain('Requires="p159"');
    expect(m).toContain('<p159:morph option="byObject"/>');
    expect(m).toContain('<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback>');
    expect(transitionXml({ type: 'cube', duration: 700 }).xml).toContain('p14:prism');
    expect(transitionXml({ type: 'fade', duration: 700, autoAdvance: 3000 }, 3000).xml).toContain('advTm="3000"');
  });

  it('converts motion paths to slide-relative units', () => {
    expect(pptMotionPath({ effect: 'motionLine', trigger: 'onClick', duration: 500, delay: 0, path: { type: 'line', dx: 192, dy: 0 } }, 1920, 1080).path).toBe('M 0 0 L 0.1 0 E');
    expect(pptMotionPath({ effect: 'motionCircle', trigger: 'onClick', duration: 500, delay: 0 }, 1920, 1080).path).toMatch(/^M 0 0 C .* Z E$/);
  });
});
