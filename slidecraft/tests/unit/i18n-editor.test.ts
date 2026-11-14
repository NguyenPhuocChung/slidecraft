import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EDITOR } from '@/i18n/vi/editor';
import { COMMON } from '@/i18n/vi/common';
import { VI } from '@/i18n/vi';
import { ANIMATION_EFFECTS, ANIMATION_TRIGGERS, CHART_TYPES, DIAGRAM_KINDS, ELEMENT_TYPES, INFOGRAPHIC_KINDS, TRANSITIONS } from '@/types/registry';
import { LAYOUTS } from '@/layouts/engine';
import { THEMES } from '@/themes/themes';
import { ANIMATION_PRESETS } from '@/animation/engine';

const OWNED = ['src/editor', 'src/canvas', 'src/presentation', 'src/animation/AnimationPanel.tsx', 'src/animation/Timeline.tsx', 'src/transitions/TransitionPanel.tsx'];
function files(p: string): string[] {
  if (!fs.statSync(p).isDirectory()) return [p];
  return fs.readdirSync(p).flatMap((f) => files(path.join(p, f))).filter((f) => f.endsWith('.tsx'));
}
const registryLabels = new Set<string>([
  ...Object.values(ELEMENT_TYPES).flatMap((x) => [x.label, x.description, x.pptxNote]),
  ...Object.values(ANIMATION_EFFECTS).flatMap((x) => [x.label, (x as { ppt?: { note?: string } }).ppt?.note ?? '']),
  ...Object.values(TRANSITIONS).flatMap((x) => [x.label, x.pptxNote]),
  ...Object.values(CHART_TYPES).flatMap((x) => [x.label, x.use]),
  ...Object.values(DIAGRAM_KINDS), ...Object.values(INFOGRAPHIC_KINDS), ...Object.values(ANIMATION_TRIGGERS),
  ...LAYOUTS.flatMap((l) => [l.name, l.description, l.category]), ...THEMES.flatMap((t) => [t.name, t.description ?? '']),
  ...ANIMATION_PRESETS.flatMap((p) => [p.name, p.description]),
]);

describe('editor i18n', () => {
  const keys = new Set<string>();
  for (const root of OWNED) for (const f of files(root)) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  it('finds translatable strings', () => expect(keys.size).toBeGreaterThan(400));
  it('every literal key has a Vietnamese translation', () => {
    const missing = [...keys].filter((k) => !(k in EDITOR) && !(k in COMMON) && !registryLabels.has(k));
    expect(missing).toEqual([]);
  });
  it('translations keep {placeholders}', () => {
    for (const [k, v] of Object.entries(EDITOR)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(v), k).toBe(ph(k));
    }
  });
  it('merged dictionary contains editor strings', () => expect(VI['Add slide']).toBe('Thêm slide'));
});
