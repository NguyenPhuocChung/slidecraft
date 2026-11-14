import { describe, expect, it } from 'vitest';
import { importPresentation } from '@/code-parser';
import { EXAMPLE_OUTPUT } from '@/prompts/example';
import { buildMasterPrompt, buildPrompt, buildQuickPrompt, checkPromptCompatibility, ELEMENT_CONTENT_DOCS, schemaAppendix, SPECIALTY_IDS } from '@/prompts/generator';
import { ANIMATION_EFFECTS, ELEMENT_TYPES, PROMPT_VERSION, SCHEMA_VERSION, TRANSITIONS } from '@/types/registry';
import { LAYOUTS } from '@/layouts/engine';

describe('AI Prompt Center generator', () => {
  it('example output imports with 0 errors and 0 warnings', () => {
    const { analysis, presentation } = importPresentation(JSON.stringify(EXAMPLE_OUTPUT));
    expect(analysis.report.issues.filter((i) => i.severity !== 'info')).toEqual([]);
    expect(presentation?.slides.length).toBe(EXAMPLE_OUTPUT.slides.length);
    expect(analysis.report.stats.morphs).toBe(1);
  });
  it('generates every prompt type with version metadata', () => {
    const all = [buildMasterPrompt(), buildQuickPrompt(), ...SPECIALTY_IDS.map((id) => buildPrompt({ kind: 'specialized', specialty: id }))];
    for (const p of all) {
      expect(p).toContain(`Schema Version: ${SCHEMA_VERSION}`);
      expect(p).toContain(`Prompt Version: ${PROMPT_VERSION}`);
      expect(p.length).toBeGreaterThan(800);
    }
    expect(SPECIALTY_IDS.length).toBe(10);
  });
  it('master prompt mentions every layout, effect, transition and element type', () => {
    const p = buildMasterPrompt();
    LAYOUTS.forEach((l) => expect(p).toContain(`\`${l.id}\``));
    Object.keys(ANIMATION_EFFECTS).forEach((e) => expect(p).toContain(`\`${e}\``));
    Object.keys(TRANSITIONS).forEach((t) => expect(p).toContain(`\`${t}\``));
    Object.keys(ELEMENT_TYPES).forEach((t) => { expect(p).toContain(`\`${t}\``); expect(ELEMENT_CONTENT_DOCS).toHaveProperty(t); });
  });
  it('compatibility check passes', () => {
    const r = checkPromptCompatibility();
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it('language option and schema appendix', () => {
    expect(buildMasterPrompt('Vietnamese')).toContain('in Vietnamese');
    expect(JSON.parse(schemaAppendix().split('```json\n')[1].split('\n```')[0]).title).toContain('SlideCraft');
  });
});
