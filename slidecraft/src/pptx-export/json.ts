import type { Presentation } from '@/types/schema';
import { SCHEMA_VERSION } from '@/types/registry';

/** Serialize a presentation as SlideCraft contract JSON (themeOverrides folded back into `theme`). */
export function presentationJsonSchemaSafe(p: Presentation): string {
  const { themeOverrides, ...rest } = p;
  const out = {
    $schema: 'https://slidecraft.app/schema/1.0.json',
    ...rest,
    schemaVersion: SCHEMA_VERSION,
    theme: themeOverrides && Object.keys(themeOverrides).length ? { base: p.theme, ...themeOverrides } : p.theme,
  };
  return JSON.stringify(out, null, 2);
}
