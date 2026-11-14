/**
 * SlideCraft PowerPoint Export Engine.
 * pptxgenjs writes native objects; the OOXML adapter (ooxml.ts) adds gradients,
 * groups, crops, transitions (incl. Morph) and animation timing; validatePptx()
 * re-opens the result and checks it before success is reported.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import type { Presentation, Slide, SlideElement } from '@/types/schema';
import { getTheme } from '@/themes/themes';
import { presentationJsonSchemaSafe } from './json';
import { addElement, gradientPatch, type BuildReport, type Ctx, type ExportOptionsInternal, type SlidePatches } from './build';
import { dedupeShapeIds, fixParagraphProperties, applyBackgroundGradient, applyGradient, applyGroup, applyImagePatch, ensureNamespaces, insertTransitionTiming, shapeIds, timingXml, transitionXml } from './ooxml';
import { emptyReport, preflight } from './preflight';
import { color, inch, isNode, pt } from './util';
import { validatePptx } from './validate';

export type ExportProfile = 'standard' | 'editable' | 'highFidelity' | 'presentation';
export interface ExportReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
  support: { supported: string[]; partial: string[]; unsupported: string[] };
  slideCount: number;
  checks: { name: string; ok: boolean; detail?: string }[];
}
export interface ExportPptxOptions {
  profile?: ExportProfile;
  rasterize?: (svg: string, w: number, h: number) => Promise<string>;
  fetchImage?: (url: string) => Promise<string | null>;
  resolveImage?: (el: SlideElement) => string | null;
  /** Browser: render LaTeX to a PNG data URL (KaTeX → canvas). */
  renderFormula?: (latex: string, opts: { color: string; fontSize: number }) => Promise<string | null>;
  /** Called with progress 0–1 */
  onProgress?: (p: number, label: string) => void;
}

export const EXPORT_PROFILES: { id: ExportProfile; name: string; description: string }[] = [
  { id: 'standard', name: 'PowerPoint Standard', description: 'Native, editable objects; decorative visuals as vector pictures; transitions and animations included.' },
  { id: 'editable', name: 'PowerPoint Editable', description: 'Maximum native objects (shapes, text, tables, charts). Same as Standard plus no rasterization ever.' },
  { id: 'highFidelity', name: 'PowerPoint High Fidelity', description: 'Rasterizes decorative / complex vectors and icons to PNG for pixel-faithful look in older PowerPoint versions.' },
  { id: 'presentation', name: 'PowerPoint Presentation', description: 'Prioritizes motion: transitions, animations and auto-advance timings (rehearsed durations applied).' },
];

export { preflight, validatePptx };

function morphIdsFor(p: Presentation, i: number): Set<string> {
  const ids = new Set<string>();
  const add = (a: Slide | undefined, b: Slide | undefined) => {
    if (!a || !b || b.transition?.type !== 'morph') return;
    const prev = new Set(a.elements.map((e) => e.id));
    b.elements.forEach((e) => { if (prev.has(e.id)) ids.add(e.id); });
  };
  add(p.slides[i - 1], p.slides[i]);
  add(p.slides[i], p.slides[i + 1]);
  return ids;
}

export async function exportPptx(p: Presentation, options: ExportPptxOptions = {}): Promise<{ blob: Blob | Uint8Array; report: ExportReport }> {
  const profile = options.profile ?? 'standard';
  const opts: ExportOptionsInternal = { profile, rasterize: profile === 'editable' ? undefined : options.rasterize, fetchImage: options.fetchImage, resolveImage: options.resolveImage, renderFormula: options.renderFormula };
  const report = preflight(p, { profile, resolveImage: options.resolveImage });
  const br: BuildReport = { warnings: [], info: [], partial: new Set(report.support.partial), unsupported: new Set(report.support.unsupported), supported: new Set(report.support.supported) };
  const pptx: any = new (PptxGenJS as any)();
  pptx.defineLayout({ name: 'SLIDECRAFT', width: inch(p.size.width), height: inch(p.size.height) });
  pptx.layout = 'SLIDECRAFT';
  pptx.title = p.title;
  pptx.author = p.author ?? 'SlideCraft AI Studio';
  pptx.company = 'SlideCraft AI Studio';
  pptx.subject = p.description ?? '';
  const baseTheme = getTheme(p.theme, p.themeOverrides);
  pptx.theme = { headFontFace: baseTheme.fonts.heading, bodyFontFace: baseTheme.fonts.body };
  if (p.direction === 'rtl') pptx.rtlMode = true;

  const allPatches: SlidePatches[] = [];
  for (let i = 0; i < p.slides.length; i++) {
    const slide = p.slides[i];
    options.onProgress?.(i / (p.slides.length + 1), `Slide ${i + 1}`);
    const theme = slide.theme && slide.theme !== p.theme ? getTheme(slide.theme) : baseTheme;
    const s = pptx.addSlide();
    if (slide.hidden) s.hidden = true;
    const patches: SlidePatches = { gradients: [], images: [], groups: [], targets: new Map(), textShapes: new Set() };
    allPatches.push(patches);
    const ctx: Ctx = { pptx, s, slide, slideIndex: i, theme, p, opts, patches, report: br, morphIds: morphIdsFor(p, i), used: new Set(), seq: 0 };
    // background
    const bg = slide.background ?? theme.background;
    const bgFallback = color('$background', theme, 'FFFFFF')!;
    if (!bg || bg.type === 'color') {
      const c = color(bg?.color ?? '$background', theme, 'FFFFFF') ?? bgFallback;
      s.background = { color: c.hex, transparency: c.transparency || undefined };
    } else if (bg.type === 'gradient' && bg.gradient) {
      s.background = { color: color(bg.gradient.stops[0]?.color, theme, 'FFFFFF')?.hex ?? bgFallback.hex };
      patches.bgGradient = gradientPatch(bg.gradient, theme);
      br.supported.add('Gradient background → native gradient fill');
    } else if (bg.type === 'image') {
      const fake = { id: '__bg', type: 'image', x: 0, y: 0, width: p.size.width, height: p.size.height, content: bg.image ?? {} } as SlideElement;
      let data: string | null = options.resolveImage?.(fake) ?? bg.image?.src ?? null;
      if (data?.startsWith('asset:')) data = p.assets.find((a) => a.id === data!.slice(6))?.src ?? null;
      if (data && !data.startsWith('data:')) data = options.fetchImage ? await options.fetchImage(data).catch(() => null) : null;
      const base = color(bg.color ?? '$primary', theme, '1F2937')!;
      s.background = { color: base.hex };
      if (data) s.addImage({ data, x: 0, y: 0, w: inch(p.size.width), h: inch(p.size.height), objectName: 'background:image', sizing: undefined });
      else br.warnings.push(`Slide ${i + 1}: background image unavailable — solid color used.`);
      if (bg.overlay) { const oc = color(bg.overlay.color, theme, '000000')!; s.addShape('rect', { x: 0, y: 0, w: inch(p.size.width), h: inch(p.size.height), fill: { color: oc.hex, transparency: Math.round((1 - bg.overlay.opacity) * 100) }, line: { type: 'none' }, objectName: 'background:overlay' }); }
    }
    for (const el of [...slide.elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))) {
      try { await addElement(ctx, el); }
      catch (e) { br.warnings.push(`Slide ${i + 1}: element "${el.id}" could not be exported (${(e as Error).message}).`); }
    }
    if (p.globalStyles?.footer || p.globalStyles?.slideNumbers) {
      const muted = color('$textMuted', theme, '6B7280')!.hex;
      if (p.globalStyles.footer) s.addText(p.globalStyles.footer, { x: inch(48), y: inch(p.size.height - 56), w: inch(p.size.width / 2), h: inch(32), fontSize: pt(18), color: muted, fontFace: theme.fonts.body, margin: 0, objectName: 'footer' });
      if (p.globalStyles.slideNumbers) s.addText(String(i + 1), { x: inch(p.size.width - 248), y: inch(p.size.height - 56), w: inch(200), h: inch(32), fontSize: pt(18), color: muted, fontFace: theme.fonts.body, align: 'right', margin: 0, objectName: 'slide-number' });
    }
    if (slide.notes) s.addNotes(slide.notes);
  }
  options.onProgress?.(p.slides.length / (p.slides.length + 1), 'Writing OOXML');

  const raw: Uint8Array = await pptx.write({ outputType: 'uint8array' });
  const zip = await JSZip.loadAsync(raw);
  for (let i = 0; i < p.slides.length; i++) {
    const path = `ppt/slides/slide${i + 1}.xml`;
    const f = zip.file(path);
    if (!f) { report.errors.push(`Internal: ${path} missing.`); continue; }
    let xml = await f.async('string');
    const patches = allPatches[i];
    const slide = p.slides[i];
    xml = fixParagraphProperties(dedupeShapeIds(ensureNamespaces(xml)));
    for (const g of patches.gradients) { const r = applyGradient(xml, g.name, g.gradient); xml = r.xml; if (!r.ok) br.warnings.push(`Slide ${i + 1}: gradient on "${g.name}" exported as solid color.`); }
    for (const im of patches.images) { const r = applyImagePatch(xml, im.name, im); xml = r.xml; }
    if (patches.bgGradient) xml = applyBackgroundGradient(xml, patches.bgGradient);
    let nextId = Math.max(1, ...shapeIds(xml).values()) + 1;
    for (const g of patches.groups) {
      const r = applyGroup(xml, g.name, g.childNames, nextId);
      if (r.ok) { xml = r.xml; nextId++; } else br.warnings.push(`Slide ${i + 1}: "${g.name}" could not be grouped; its shapes are exported ungrouped.`);
    }
    // transition
    let tXml = '';
    const advance = slide.transition?.autoAdvance ?? (profile === 'presentation' || slide.duration ? slide.duration : undefined);
    if (slide.transition && slide.transition.type !== 'none') {
      const t = transitionXml(slide.transition, advance);
      tXml = t.xml;
      if (t.note) br.partial.add(t.note);
    } else if (advance) tXml = transitionXml({ type: 'none', duration: 0 }, advance).xml;
    // timing
    const ids = shapeIds(xml);
    const spidOf = (elId: string) => {
      const name = patches.targets.get(elId) ?? (patches.groups.find((g) => g.name.endsWith(`:${elId}`) || g.name === `!!${elId}`)?.name);
      if (!name) return null;
      const id = ids.get(name);
      if (!id) return null;
      const b = new RegExp(`<p:sp><p:nvSpPr><p:cNvPr id="${id}"`).test(xml);
      return { spid: id, isSp: b };
    };
    const timing = timingXml(slide, spidOf, p.size, { partial: br.partial, info: br.info, warnings: br.warnings }, i);
    xml = insertTransitionTiming(xml, tXml, timing);
    zip.file(path, xml);
  }
  const out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  const notes = p.slides.map((s, i) => (s.notes?.trim() ? i + 1 : 0)).filter(Boolean);
  const v = await validatePptx(out, p.slides.length, { expectNotes: notes });
  report.checks.push(...v.checks.map((c) => ({ ...c, name: `Post-export: ${c.name}` })));
  report.warnings.push(...br.warnings);
  report.info.push(...br.info);
  report.support = { supported: [...br.supported].sort(), partial: [...br.partial].sort(), unsupported: [...br.unsupported].sort() };
  if (!v.ok) report.errors.push('The generated PPTX failed post-export validation — see checks.');
  report.ok = report.errors.length === 0 && v.ok;
  options.onProgress?.(1, 'Done');
  const blob = isNode ? out : new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  return { blob, report };
}

/** Contract JSON export (re-importable). */
export function exportJson(p: Presentation): string {
  return presentationJsonSchemaSafe(p);
}

/** MP4 video rendering is not implemented — reported honestly instead of faking it. */
export async function exportVideo(): Promise<never> {
  throw new Error('MP4 video export is not available in this version. Use PowerPoint (File → Export → Create a Video) on the exported PPTX.');
}

export { emptyReport };
