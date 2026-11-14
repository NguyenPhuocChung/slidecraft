/** Every label the editor UX shows (pictogram names, animation/transition wording, new dialogs) has Vietnamese. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { VI } from '@/i18n/vi';
import * as L from '@/animation/labels';
import * as P from '@/editor/pickers';
import { ANIMATION_EFFECTS, ANIMATION_TRIGGER_IDS, EASINGS } from '@/types/registry';

const FILES = ['src/editor/pickers.tsx', 'src/editor/InsertBar.tsx', 'src/editor/dialogs/ChartDataEditor.tsx', 'src/editor/dialogs/SourceCodeDialog.tsx', 'src/editor/properties/SlideProps.tsx', 'src/editor/properties/PropertiesPanel.tsx', 'src/editor/TopBar.tsx', 'src/animation/AnimationPanel.tsx', 'src/animation/Timeline.tsx', 'src/transitions/TransitionPanel.tsx', 'src/components/ui.tsx'];
const ignorable = (k: string) => !k || /^[\s\W\d]*$/.test(k);

function collect(): string[] {
  const keys = new Set<string>();
  for (const f of FILES) {
    const s = fs.readFileSync(path.resolve(f), 'utf8');
    for (const m of s.matchAll(/\b(?:tr|t)\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  }
  [L.CATEGORY_LABEL, L.CATEGORY_HELP, L.TRIGGER_LABEL, L.EASING_LABEL, L.EFFECT_HELP, L.TRANSITION_HELP, L.SOUND_LABEL, P.SHAPE_LABELS, P.DIAGRAM_LABELS, P.INFOGRAPHIC_LABELS, P.TIMELINE_LABELS, P.DECOR_LABELS, P.VISUAL3D_LABELS]
    .forEach((o) => Object.values(o as Record<string, string>).forEach((v) => keys.add(v)));
  ['supported', 'partial', 'none'].forEach((x) => keys.add(L.supportLabel(x)));
  for (const [id, e] of Object.entries(ANIMATION_EFFECTS)) for (const d of ((e as { directions?: readonly string[] }).directions ?? [])) keys.add(L.directionLabel(id, d));
  ['left', 'right', 'up', 'down', 'horizontal', 'vertical'].forEach((d) => keys.add(L.directionLabel('transition', d)));
  return [...keys].filter((k) => !ignorable(k));
}

describe('editor UX — Vietnamese coverage', () => {
  it('every new label/explanation has a Vietnamese translation', () => {
    const missing = collect().filter((k) => !(k in VI));
    expect(missing).toEqual([]);
  });
  it('every animation effect, trigger and easing has a plain explanation', () => {
    for (const id of Object.keys(ANIMATION_EFFECTS)) expect(L.EFFECT_HELP[id], id).toBeTruthy();
    for (const id of ANIMATION_TRIGGER_IDS) expect(L.TRIGGER_LABEL[id], id).toBeTruthy();
    for (const id of EASINGS) expect(L.EASING_LABEL[id], id).toBeTruthy();
  });
  it('triggers read as plain Vietnamese', () => {
    expect(VI[L.TRIGGER_LABEL.onClick]).toBe('Khi bấm chuột');
    expect(VI[L.TRIGGER_LABEL.withPrevious]).toBe('Cùng lúc với hiệu ứng trước');
    expect(VI[L.TRIGGER_LABEL.afterPrevious]).toBe('Sau hiệu ứng trước');
    expect(VI[L.TRIGGER_LABEL.onEnter]).toBe('Tự chạy khi vào slide');
    expect(VI[L.TRIGGER_LABEL.onExit]).toBe('Khi rời slide');
  });
  it('Vietnamese strings do not leak English technical words', () => {
    const english = /\b(onClick|withPrevious|afterPrevious|onEnter|onExit|easeIn|easeOut|linear|dx|dy)\b/;
    for (const k of collect()) if (VI[k]) expect(english.test(VI[k]), `${k} → ${VI[k]}`).toBe(false);
  });
});
