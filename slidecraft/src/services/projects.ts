import type { Presentation } from '@/types/schema';
import { normalizePresentation } from '@/code-parser/normalize';
import { SCHEMA_VERSION } from '@/types/registry';
import { DEFAULT_THEME_ID } from '@/themes/themes';
import { uid } from '@/utils/id';
import { storage } from './storage';

export async function createBlankPresentation(opts: { title?: string; theme?: string; aspectRatio?: string; size?: { width: number; height: number } } = {}): Promise<Presentation> {
  const p = normalizePresentation({
    schemaVersion: SCHEMA_VERSION,
    id: uid('pres'),
    title: opts.title ?? 'Untitled presentation',
    theme: opts.theme ?? DEFAULT_THEME_ID,
    aspectRatio: opts.aspectRatio ?? '16:9',
    ...(opts.size ? { size: opts.size } : {}),
    slides: [
      { id: uid('slide'), layout: 'title', content: { eyebrow: 'SlideCraft', heading: opts.title ?? 'Untitled presentation', subheading: 'Double-click any text to edit it' } },
    ],
  });
  await storage.save(p);
  await storage.addVersion(p, 'Created');
  return p;
}

/** Persist an imported/normalized presentation as a new project (fresh id, never overwrites). */
export async function saveNewProject(p: Presentation, label = 'Imported'): Promise<Presentation> {
  const existing = await storage.getMeta(p.id);
  const doc = existing ? { ...p, id: uid('pres') } : p;
  await storage.save(doc);
  await storage.addVersion(doc, label);
  return doc;
}

export async function duplicateProject(id: string): Promise<Presentation | undefined> {
  const p = await storage.load(id);
  if (!p) return undefined;
  const copy = { ...structuredClone(p), id: uid('pres'), title: `${p.title} (copy)` };
  await storage.save(copy);
  return copy;
}
