import type { Paragraph, Presentation, SlideElement } from '@/types/schema';
import { ANIMATION_EFFECTS, ASPECT_RATIOS, CHART_TYPES, ELEMENT_TYPES, TRANSITIONS } from '@/types/registry';
import { getTheme, resolveFont } from '@/themes/themes';
import { measureParagraphs } from '@/utils/richtext';
import type { ExportProfile, ExportReport } from './index';

/** Fonts that ship with Windows/macOS Office installs. */
export const SAFE_FONTS = new Set(['Arial', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Aptos', 'Helvetica', 'Garamond', 'Century Gothic', 'Franklin Gothic', 'Gill Sans MT', 'Impact', 'Palatino Linotype', 'Book Antiqua']);

export function emptyReport(slideCount: number): ExportReport {
  return { ok: true, errors: [], warnings: [], info: [], support: { supported: [], partial: [], unsupported: [] }, slideCount, checks: [] };
}

function fontsOf(el: SlideElement, p: Presentation, out: Set<string>) {
  const theme = getTheme(p.theme, p.themeOverrides);
  if (['text', 'heading', 'paragraph', 'richText', 'shape'].includes(el.type)) {
    out.add(resolveFont(el.style?.fontFamily, theme, el.type === 'heading' ? 'heading' : 'body'));
    (el.content?.paragraphs as Paragraph[] | undefined)?.forEach((pp) => pp.runs.forEach((r) => { if (r.fontFamily) out.add(resolveFont(r.fontFamily, theme)); }));
  }
  if (el.type === 'code') out.add(theme.fonts.mono);
  if (el.type === 'group') (el.content?.children ?? []).forEach((c: SlideElement) => fontsOf(c, p, out));
}

export function preflight(p: Presentation, opts: { profile?: ExportProfile; resolveImage?: (el: SlideElement) => string | null } = {}): ExportReport {
  const r = emptyReport(p.slides.length);
  const partial = new Set<string>(), supported = new Set<string>(), unsupported = new Set<string>();
  const W = p.size.width, H = p.size.height;
  const theme = getTheme(p.theme, p.themeOverrides);
  // aspect ratio
  const ratio = W / H;
  const known = Object.values(ASPECT_RATIOS).some((a) => Math.abs(a.width / a.height - ratio) < 0.01);
  r.checks.push({ name: 'Slide size', ok: W > 0 && H > 0 && W / 144 <= 56 && H / 144 <= 56, detail: `${(W / 144).toFixed(2)}" × ${(H / 144).toFixed(2)}" (${p.aspectRatio})` });
  if (!known) r.info.push(`Custom slide size ${W}×${H} px is exported exactly (${(W / 144).toFixed(2)}×${(H / 144).toFixed(2)} in).`);
  if (W / 144 > 56 || H / 144 > 56) r.errors.push('Slide size exceeds PowerPoint maximum (56 inches).');
  // fonts
  const fonts = new Set<string>();
  p.slides.forEach((s) => s.elements.forEach((e) => fontsOf(e, p, fonts)));
  const nonSystem = [...fonts].filter((f) => !SAFE_FONTS.has(f));
  r.checks.push({ name: 'Fonts', ok: true, detail: [...fonts].join(', ') });
  if (nonSystem.length) r.warnings.push(`Fonts not bundled with Office: ${nonSystem.join(', ')}. Install them (free on Google Fonts) on the presenting computer, or PowerPoint will substitute a fallback font and line breaks may change.`);
  let imagesMissing = 0, overflow = 0, outside = 0, chartIssues = 0;
  p.slides.forEach((s, si) => {
    const tag = `Slide ${si + 1}`;
    const walk = (el: SlideElement, dx = 0, dy = 0) => {
      const info = ELEMENT_TYPES[el.type];
      if (info) (info.pptx === 'supported' ? supported : info.pptx === 'partial' ? partial : unsupported).add(`${info.label}: ${info.pptxNote}`);
      if (el.type === 'group') { (el.content?.children ?? []).forEach((c: SlideElement) => walk(c, el.x + dx, el.y + dy)); return; }
      const x = el.x + dx, y = el.y + dy;
      if (x + el.width <= 0 || y + el.height <= 0 || x >= W || y >= H) { outside++; r.warnings.push(`${tag}: "${el.id}" lies completely outside the slide and will be invisible.`); }
      if (el.type === 'image') {
        const src = opts.resolveImage?.(el) ?? el.content?.src;
        if (!src) { imagesMissing++; r.warnings.push(`${tag}: image "${el.content?.alt ?? el.content?.query ?? el.id}" has no resolved file — it will be exported as a placeholder.`); }
        else if (String(src).startsWith('asset:') && !p.assets.some((a) => a.id === String(src).slice(6))) { imagesMissing++; r.errors.push(`${tag}: image "${el.id}" references a missing asset.`); }
      }
      if (['text', 'heading', 'paragraph', 'richText'].includes(el.type) && el.content?.paragraphs) {
        const st = el.style ?? {};
        const fs = st.fontSize ?? (el.type === 'heading' ? theme.fontScale.h2 : theme.fontScale.body);
        const pad = typeof st.padding === 'number' ? st.padding : 0;
        const m = measureParagraphs(el.content.paragraphs, el.width, { fontSize: fs, lineHeight: st.lineHeight ?? (el.type === 'heading' ? theme.typography.headingLineHeight : theme.typography.bodyLineHeight), paragraphSpacing: st.paragraphSpacing, padding: pad });
        if (m.height > el.height * 1.25 + 8) { overflow++; r.warnings.push(`${tag}: text in "${el.id}" may overflow its box (~${Math.round(m.height)}px needed, ${Math.round(el.height)}px available).`); }
      }
      if (el.type === 'chart') {
        const c = el.content ?? {};
        const t = CHART_TYPES[c.chartType as keyof typeof CHART_TYPES];
        if (!t) { chartIssues++; r.errors.push(`${tag}: unknown chart type "${c.chartType}".`); }
        else if (t.pptx !== 'supported') r.info.push(`${tag}: ${t.label} has no native PowerPoint chart type — exported as editable shapes.`);
        (c.series ?? []).forEach((se: { name: string; values?: (number | null)[] }) => {
          if (se.values && c.categories && se.values.length !== c.categories.length) { chartIssues++; r.errors.push(`${tag}: chart series "${se.name}" length does not match categories.`); }
        });
      }
      (el.animation ?? []).forEach((a) => {
        const ai = (ANIMATION_EFFECTS as Record<string, { label: string; pptx: string; ppt?: { note?: string } }>)[a.effect];
        if (!ai) { unsupported.add(`Animation "${a.effect}"`); return; }
        if (a.trigger === 'onExit') { unsupported.add('Animation trigger "onExit" (web presentation only)'); return; }
        (ai.pptx === 'supported' ? supported : partial).add(`Animation ${ai.label}${ai.ppt?.note ? ` — ${ai.ppt.note}` : ''}`);
      });
    };
    s.elements.forEach((e) => walk(e));
    if (s.transition && s.transition.type !== 'none') {
      const ti = TRANSITIONS[s.transition.type as keyof typeof TRANSITIONS];
      if (ti) (ti.pptx === 'supported' ? supported : partial).add(`Transition ${ti.label} — ${ti.pptxNote}`);
      if (s.transition.sound && s.transition.sound !== 'none') unsupported.add('Transition sound');
      if (s.transition.type === 'morph' && si > 0) {
        const prev = new Set(p.slides[si - 1].elements.map((e) => e.id));
        const shared = s.elements.filter((e) => prev.has(e.id)).length;
        if (!shared) r.warnings.push(`${tag}: Morph has no matching objects with slide ${si}; PowerPoint will perform a plain fade.`);
        else r.info.push(`${tag}: Morph matches ${shared} object(s) by "!!" names (PowerPoint 2019 / Microsoft 365; older versions fall back to Fade).`);
      }
    }
    if (s.background?.type === 'image' && !s.background.image?.src && !opts.resolveImage) r.warnings.push(`${tag}: background image has no resolved file — exported as a solid color.`);
  });
  r.checks.push({ name: 'Images', ok: imagesMissing === 0, detail: imagesMissing ? `${imagesMissing} unresolved` : 'all resolved' });
  r.checks.push({ name: 'Text overflow', ok: overflow === 0, detail: overflow ? `${overflow} box(es) may overflow` : 'none detected' });
  r.checks.push({ name: 'Elements inside canvas', ok: outside === 0, detail: outside ? `${outside} outside` : 'ok' });
  r.checks.push({ name: 'Charts', ok: chartIssues === 0 });
  r.checks.push({ name: 'Animations & transitions classified', ok: true, detail: `${supported.size} supported, ${partial.size} partial, ${unsupported.size} unsupported mappings` });
  r.support = { supported: [...supported].sort(), partial: [...partial].sort(), unsupported: [...unsupported].sort() };
  r.ok = r.errors.length === 0;
  return r;
}
