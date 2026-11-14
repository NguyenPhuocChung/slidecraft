/**
 * Normalize validated (raw) data into the canonical in-app Presentation:
 * defaults filled, text → paragraphs, layouts materialized, animations as arrays.
 * The canonical form is itself valid contract JSON, so exports re-import losslessly.
 */
import type { Animation, Background, Paragraph, Presentation, Slide, SlideElement, Theme, Transition } from '@/types/schema';
import { AnimationSchema } from '@/types/schema';
import { ASPECT_RATIOS, SCHEMA_VERSION, TEXT_TYPES, TRANSITIONS } from '@/types/registry';
import { buildLayout } from '@/layouts/engine';
import { DEFAULT_THEME_ID, getTheme, THEME_MAP } from '@/themes/themes';
import { parseMarkdownLite } from '@/utils/richtext';
import { uid } from '@/utils/id';
import { applyPreset } from '@/animation/engine';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export function normalizeParagraphs(content: Raw | string | undefined): Paragraph[] {
  if (content === undefined || content === null) return [{ runs: [{ text: '' }] }];
  if (typeof content === 'string') return parseMarkdownLite(content);
  if (Array.isArray(content.paragraphs) && content.paragraphs.length) {
    return content.paragraphs.map((p: Raw) => (typeof p === 'string' ? parseMarkdownLite(p)[0] : { ...p, runs: (p.runs ?? [{ text: p.text ?? '' }]).map((r: Raw) => (typeof r === 'string' ? { text: r } : r)) }));
  }
  return parseMarkdownLite(String(content.text ?? ''));
}

export function normalizeTransition(t: unknown): Transition | undefined {
  if (!t) return undefined;
  const obj = typeof t === 'string' ? { type: t } : (t as Raw);
  if (!(obj.type in TRANSITIONS)) return undefined;
  return { duration: 700, ...obj } as Transition;
}

export function normalizeBackground(bg: unknown): Background | undefined {
  if (!bg) return undefined;
  if (typeof bg === 'string') {
    if (/gradient\(/.test(bg)) {
      const colors = bg.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)/gi) ?? [];
      const angle = /(\d+)deg/.exec(bg)?.[1];
      if (colors.length >= 2) return { type: 'gradient', gradient: { type: /radial/.test(bg) ? 'radial' : 'linear', angle: angle ? Number(angle) - 90 : 90, stops: colors.map((c, i) => ({ color: c, offset: i / (colors.length - 1) })) } };
    }
    return { type: 'color', color: bg };
  }
  const b = bg as Raw;
  return { type: b.type ?? (b.gradient ? 'gradient' : b.image ? 'image' : 'color'), ...b } as Background;
}

function normAnimations(a: unknown): Animation[] | undefined {
  if (a === undefined || a === null) return undefined;
  const arr = Array.isArray(a) ? a : [a];
  const out = arr
    .map((x) => (typeof x === 'string' ? { effect: x } : x))
    .map((x) => AnimationSchema.safeParse(x))
    .filter((r) => r.success)
    .map((r) => ({ id: uid('anim'), ...(r.data as Animation) }));
  return out.length ? out : undefined;
}

export function normalizeElement(raw: Raw, inGroup = false): SlideElement {
  const el: Raw = { ...raw };
  el.id = String(el.id ?? uid(el.type ?? 'el'));
  if (TEXT_TYPES.includes(el.type) || el.type === 'shape') {
    const c = typeof el.content === 'string' ? { text: el.content } : { ...(el.content ?? {}) };
    if (el.type === 'shape') {
      const hasText = c.text !== undefined || c.paragraphs !== undefined;
      el.content = { shape: c.shape ?? 'rect', ...(hasText ? { paragraphs: normalizeParagraphs(c) } : {}) };
    } else {
      const { text: _t, ...rest } = c;
      void _t;
      el.content = { ...rest, paragraphs: normalizeParagraphs(c) };
    }
  }
  if (el.type === 'line' || el.type === 'arrow') {
    const c = el.content ?? {};
    let { x1, y1, x2, y2 } = c;
    if ([x1, y1, x2, y2].some((v) => typeof v !== 'number')) {
      x1 = el.x ?? 0; y1 = el.y ?? 0; x2 = (el.x ?? 0) + (el.width ?? 200); y2 = (el.y ?? 0) + ((el.height ?? 0) > 4 ? el.height : 0);
    }
    el.content = { x1, y1, x2, y2 };
    el.x = Math.min(x1, x2); el.y = Math.min(y1, y2);
    el.width = Math.max(1, Math.abs(x2 - x1)); el.height = Math.max(1, Math.abs(y2 - y1));
    el.style = { stroke: { color: '$text', width: 4 }, ...(el.style ?? {}) };
    if (el.type === 'arrow' && !el.style.headEnd && !el.style.headStart) el.style.headEnd = 'triangle';
  }
  if (el.type === 'group') el.content = { children: (el.content?.children ?? []).map((c: Raw) => normalizeElement(c, true)) };
  if (el.type === 'table' && el.content?.rows) el.content = { header: true, ...el.content, rows: el.content.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map((c) => (c === null || c === undefined ? '' : String(c))) : [])) };
  if (el.type === 'chart' && el.content) el.content = { showLegend: (el.content.series?.length ?? 0) > 1 || ['pie', 'donut'].includes(el.content.chartType), showGrid: true, showAxis: true, ...el.content };
  el.x = Number(el.x ?? 0); el.y = Number(el.y ?? 0);
  el.width = Math.max(1, Number(el.width ?? 200)); el.height = Math.max(1, Number(el.height ?? 100));
  const anims = normAnimations(el.animation);
  if (anims) el.animation = anims; else delete el.animation;
  if (el.visible === undefined) delete el.visible;
  void inGroup;
  return el as SlideElement;
}

export function materializeSlide(raw: Raw, theme: Theme, size: { width: number; height: number }, defaults: { transition?: Transition } = {}): Slide {
  const s: Raw = { ...raw };
  s.id = String(s.id ?? uid('slide'));
  const bg = normalizeBackground(s.background);
  let elements: SlideElement[] = (Array.isArray(s.elements) ? s.elements : []).filter((e: unknown) => e && typeof e === 'object').map((e: Raw) => normalizeElement(e));
  if (s.content && typeof s.content === 'object' && (s.layout || !elements.length)) {
    const res = buildLayout(s.layout, s.content, theme, size);
    s.layout = res.layout;
    const explicit = new Set(elements.map((e) => e.id));
    const generated = res.elements.filter((e) => !explicit.has(e.id)).map((e) => normalizeElement(e));
    const maxZ = generated.reduce((m, e) => Math.max(m, e.zIndex ?? 0), 0);
    elements = [...generated, ...elements.map((e, i) => ({ ...e, zIndex: e.zIndex ?? maxZ + i + 1 }))];
    if (!bg && res.background) s.background = res.background;
    else s.background = bg;
  } else s.background = bg;
  elements.forEach((e, i) => { if (e.zIndex === undefined) e.zIndex = i + 1; });
  if (typeof s.animationPreset === 'string') elements = applyPreset({ ...(s as Slide), elements }, s.animationPreset, size);
  if (s.animations && typeof s.animations === 'object') {
    const map = s.animations as Record<string, unknown>;
    elements = elements.map((e) => (map[e.id] ? { ...e, animation: normAnimations(map[e.id]) } : e));
  }
  delete s.animationPreset;
  delete s.animations;
  s.elements = elements;
  const t = normalizeTransition(s.transition) ?? defaults.transition;
  if (t) s.transition = t; else delete s.transition;
  if (!s.title) {
    const h = elements.find((e) => e.type === 'heading');
    if (h) s.title = (h.content.paragraphs as Paragraph[]).map((p) => p.runs.map((r) => r.text).join('')).join(' ').slice(0, 120);
  }
  return s as Slide;
}

export function normalizePresentation(raw: unknown): Presentation {
  const r = raw as Raw;
  let themeId = DEFAULT_THEME_ID;
  let themeOverrides: Raw | undefined;
  if (typeof r.theme === 'string') themeId = THEME_MAP[r.theme] ? r.theme : DEFAULT_THEME_ID;
  else if (r.theme && typeof r.theme === 'object') {
    const { base, id, ...rest } = r.theme as Raw;
    themeId = THEME_MAP[base ?? id] ? base ?? id : DEFAULT_THEME_ID;
    themeOverrides = rest;
  }
  if (r.typography?.headingFont || r.typography?.bodyFont) {
    themeOverrides = { ...(themeOverrides ?? {}), fonts: { ...(themeOverrides?.fonts ?? {}), ...(r.typography.headingFont ? { heading: r.typography.headingFont } : {}), ...(r.typography.bodyFont ? { body: r.typography.bodyFont } : {}) } };
  }
  const theme = getTheme(themeId, themeOverrides as Partial<Theme> | undefined);
  const aspectRatio = r.aspectRatio && r.aspectRatio in ASPECT_RATIOS ? r.aspectRatio : '16:9';
  const ar = ASPECT_RATIOS[aspectRatio as keyof typeof ASPECT_RATIOS];
  const size = r.size && r.size.width > 0 && r.size.height > 0 ? { width: Number(r.size.width), height: Number(r.size.height) } : { width: ar.width, height: ar.height };
  const defaultTransition = normalizeTransition(r.globalStyles?.defaultTransition);
  const slides = (r.slides as Raw[]).filter((s) => s && typeof s === 'object').map((s) => {
    const st = typeof s.theme === 'string' && THEME_MAP[s.theme] ? getTheme(s.theme) : theme;
    return materializeSlide(s, st, size, { transition: defaultTransition });
  });
  const known = new Set(['$schema', 'schemaVersion', 'id', 'title', 'description', 'author', 'version', 'language', 'direction', 'aspectRatio', 'size', 'theme', 'typography', 'globalStyles', 'sections', 'slides', 'assets', 'metadata', 'part']);
  const extra = Object.fromEntries(Object.entries(r).filter(([k]) => !known.has(k)));
  return {
    schemaVersion: SCHEMA_VERSION,
    id: String(r.part?.presentationId ?? r.id ?? uid('pres')),
    title: String(r.title ?? 'Untitled presentation'),
    description: r.description,
    author: r.author,
    version: r.version,
    language: r.language,
    direction: r.direction,
    aspectRatio,
    size,
    theme: themeId,
    ...(themeOverrides ? { themeOverrides: themeOverrides as Partial<Theme> } : {}),
    typography: r.typography,
    globalStyles: r.globalStyles ? { ...r.globalStyles, defaultTransition } : undefined,
    sections: r.sections,
    slides,
    assets: Array.isArray(r.assets) ? r.assets : [],
    metadata: { ...(r.metadata ?? {}), ...(Object.keys(extra).length ? { unsupported: extra } : {}) },
  };
}

/** Merge multi-part imports (same presentationId) preserving order by part.index. */
export function mergeParts(parts: Raw[]): Raw {
  const sorted = [...parts].sort((a, b) => (a.part?.index ?? 0) - (b.part?.index ?? 0));
  const first = { ...sorted[0] };
  const seen = new Set<string>();
  const slides: Raw[] = [];
  for (const p of sorted) for (const s of p.slides ?? []) {
    let id = s.id ?? `slide-${slides.length + 1}`;
    if (seen.has(id)) id = `${id}-p${p.part?.index ?? 0}`;
    seen.add(id);
    slides.push({ ...s, id });
  }
  const assets = sorted.flatMap((p) => p.assets ?? []);
  const pid = first.part?.presentationId;
  delete first.part;
  return { ...first, ...(pid && !first.id ? { id: pid } : {}), slides, assets };
}
