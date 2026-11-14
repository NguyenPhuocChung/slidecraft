import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PAGES } from '@/i18n/vi/pages';
import { COMMON } from '@/i18n/vi/common';
import { PPTXIMPORT } from '@/i18n/vi/pptximport';
import { LAYOUTS } from '@/layouts/engine';
import { THEMES } from '@/themes/themes';
import { ANIMATION_EFFECTS, ANIMATION_TRIGGERS, ASPECT_RATIOS, CHART_TYPES, DIAGRAM_KINDS, ELEMENT_TYPES, INFOGRAPHIC_KINDS, TRANSITIONS } from '@/types/registry';

/** Every literal key passed to t()/tr()/<RP k="…"> in the page files must have a Vietnamese translation (or be a registry label). */
const FILES = [
  'src/pages', 'src/pages/components', 'src/code-import', 'src/prompts/PromptCenterPage.tsx', 'src/components/AppHeader.tsx', 'src/components/ErrorBoundary.tsx', 'src/components/LanguageSwitch.tsx',
].flatMap((p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(p, f)) : [p]));

const registryLabels = new Set<string>([
  ...LAYOUTS.flatMap((l) => [l.name, l.description, l.category]),
  ...THEMES.flatMap((t) => [t.name, t.description ?? '', t.category ?? '']),
  ...Object.values(ELEMENT_TYPES).flatMap((e) => [e.label, e.description, e.pptxNote]),
  ...Object.values(ANIMATION_EFFECTS).flatMap((e) => [e.label, ('note' in e.ppt ? e.ppt.note : '') as string]),
  ...Object.values(TRANSITIONS).flatMap((t) => [t.label, t.pptxNote]),
  ...Object.values(CHART_TYPES).flatMap((c) => [c.label, c.use]),
  ...Object.values(DIAGRAM_KINDS), ...Object.values(INFOGRAPHIC_KINDS), ...Object.values(ANIMATION_TRIGGERS), ...Object.values(ASPECT_RATIOS).map((a) => a.label),
]);

function keysIn(src: string): string[] {
  const out: string[] = [];
  const re = /\b(?:t|tr)\(\s*'((?:[^'\\]|\\.)*)'|<RP k="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push((m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\n/g, '\n'));
  return out;
}

describe('i18n — app pages', () => {
  const vi = { ...COMMON, ...PAGES, ...PPTXIMPORT };
  it.each(FILES)('%s: every literal key has a Vietnamese translation', (f) => {
    const missing = keysIn(fs.readFileSync(f, 'utf8')).filter((k) => !(k in vi) && !registryLabels.has(k));
    expect(missing).toEqual([]);
  });
  it('translations keep the same {placeholders}', () => {
    const bad = Object.entries(vi).filter(([k, v]) => {
      const a = (k.match(/\{\w+\}/g) ?? []).sort().join(), b = (v.match(/\{\w+\}/g) ?? []).sort().join();
      return a !== b;
    });
    expect(bad).toEqual([]);
  });
  it('no empty translations', () => {
    expect(Object.entries(vi).filter(([, v]) => !v.trim())).toEqual([]);
  });
});
