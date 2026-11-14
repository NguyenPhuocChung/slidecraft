/**
 * PowerPoint (.pptx) import glue for the UI: lazy-loads the importer (keeps it out of
 * the main bundle), loads the deck's fonts and saves the result as a new project.
 */
import type { Presentation } from '@/types/schema';
import type { PptxImportReport } from '@/pptx-import';
import { getTheme } from '@/themes/themes';
import { loadFonts } from '@/hooks/useFonts';
import { saveNewProject } from './projects';
import { storage } from './storage';
import { useLang } from '@/i18n';
import { VI } from '@/i18n/vi';
import { PPTX_MESSAGE_PATTERNS } from '@/i18n/vi/pptximport';

export const PPTX_MAX_BYTES = 200 * 1024 * 1024;
export const PPTX_ACCEPT = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function isPptxFile(f: { name: string; type?: string }): boolean {
  return /\.(pptx|ppsx|pptm|potx)$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

export interface PptxImportOutcome { presentation: Presentation; report: PptxImportReport; fileName: string }

export async function readPptx(data: ArrayBuffer | Uint8Array, fileName: string, onProgress?: (p: number, label: string) => void): Promise<PptxImportOutcome> {
  if (data.byteLength > PPTX_MAX_BYTES) throw new Error('File is larger than 200 MB');
  const { importPptx } = await import('@/pptx-import');
  const { presentation, report } = await importPptx(data, { fileName, onProgress });
  const fonts = new Set<string>();
  const th = getTheme(presentation.theme, presentation.themeOverrides);
  fonts.add(th.fonts.heading); fonts.add(th.fonts.body);
  const walk = (els: Presentation['slides'][number]['elements']) => els.forEach((e) => {
    if (e.style?.fontFamily && !e.style.fontFamily.startsWith('$')) fonts.add(e.style.fontFamily);
    (e.content?.paragraphs as { runs: { fontFamily?: string }[] }[] | undefined)?.forEach((p) => p.runs.forEach((r) => { if (r.fontFamily) fonts.add(r.fontFamily); }));
    if (e.type === 'group') walk(e.content?.children ?? []);
  });
  presentation.slides.forEach((s) => walk(s.elements));
  // one request per family: a single unknown family would make a combined Google Fonts request fail
  for (const f of [...fonts].slice(0, 16)) { try { loadFonts([f]); } catch { /* fonts are optional */ } }
  return { presentation, report, fileName };
}

/** Save an imported deck as a new project and record it in the import history. */
export async function savePptxImport(o: PptxImportOutcome): Promise<Presentation> {
  const saved = await saveNewProject(o.presentation, 'Imported from PowerPoint');
  const s = o.report.stats;
  await storage.addHistory({ kind: 'import', format: 'pptx', detail: `${o.fileName}: ${s.slides} slides, ${s.elements} objects, ${o.report.warnings.length} warnings`, projectId: saved.id, ok: true }).catch(() => undefined);
  return saved;
}

/** One step: bytes → saved project (used by the dashboard and the desktop "Open PowerPoint…" menu). */
export async function importPptxAsProject(data: ArrayBuffer | Uint8Array, fileName: string, onProgress?: (p: number, label: string) => void): Promise<{ saved: Presentation; report: PptxImportReport }> {
  try {
    const o = await readPptx(data, fileName, onProgress);
    return { saved: await savePptxImport(o), report: o.report };
  } catch (e) {
    await storage.addHistory({ kind: 'import', format: 'pptx', detail: `${fileName}: ${(e as Error).message}`, ok: false }).catch(() => undefined);
    throw e;
  }
}

/** Translate an importer message ("Slide 3: picture … could not be read …") to the UI language. */
export function trPptx(msg: string): string {
  if (useLang.getState().lang === 'en') return msg;
  let prefix = '';
  let rest = msg;
  const m = /^Slide (\d+): (.*)$/s.exec(msg);
  if (m) { prefix = `Trang ${m[1]}: `; rest = m[2]; }
  if (VI[rest]) return prefix + VI[rest];
  for (const [re, fn] of PPTX_MESSAGE_PATTERNS) {
    const mm = re.exec(rest);
    if (mm) return prefix + fn(mm);
  }
  return prefix + rest;
}

