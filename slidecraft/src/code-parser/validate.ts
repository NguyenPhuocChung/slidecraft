import type { z } from 'zod';
import {
  AnimationSchema, BackgroundSchema, CONTENT_SCHEMAS, ElementBaseSchema, PresentationSchema, SlideSchema, StyleSchema, TransitionSchema,
} from '@/types/schema';
import {
  ANIMATION_EFFECTS, ASPECT_RATIOS, CHART_TYPES, EFFECT_ALIASES, ELEMENT_TYPES, SCHEMA_VERSION, SHAPES, TRANSITION_ALIASES, TRANSITIONS,
} from '@/types/registry';
import { LAYOUT_MAP, unusedSlots } from '@/layouts/engine';
import { THEME_MAP } from '@/themes/themes';
import { ANIMATION_PRESETS } from '@/animation/engine';
import { isValidColor } from '@/utils/color';
import { TYPE_ALIASES } from './autofix';
import { isSafeUrl, MAX_ELEMENTS_PER_SLIDE, MAX_SLIDES } from './security';
import type { ImportStats, Issue, LocMap } from './types';
import { pathKey } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

const keysOf = (s: z.ZodObject<any>) => new Set(Object.keys(s.shape));
const ELEMENT_KEYS = keysOf(ElementBaseSchema as unknown as z.ZodObject<any>);
const SLIDE_KEYS = keysOf(SlideSchema as unknown as z.ZodObject<any>);
const PRES_KEYS = keysOf(PresentationSchema as unknown as z.ZodObject<any>);
const STYLE_KEYS = keysOf(StyleSchema as unknown as z.ZodObject<any>);
const ANIM_KEYS = keysOf(AnimationSchema as unknown as z.ZodObject<any>);

export interface ValidationResult { issues: Issue[]; stats: ImportStats; unsupported: string[] }

export function validatePresentation(data: unknown, locs: LocMap = new Map()): ValidationResult {
  const issues: Issue[] = [];
  const unsupported = new Set<string>();
  const stats: ImportStats = { slides: 0, elements: 0, images: 0, charts: 0, tables: 0, diagrams: 0, animations: 0, transitions: 0, morphs: 0, notes: 0 };
  const at = (path: (string | number)[]) => {
    for (let i = path.length; i >= 0; i--) {
      const l = locs.get(pathKey(path.slice(0, i)));
      if (l) return l;
    }
    return undefined;
  };
  const add = (severity: Issue['severity'], code: string, message: string, path: (string | number)[], extra: Partial<Issue> = {}) => {
    const slideIndex = path[0] === 'slides' && typeof path[1] === 'number' ? path[1] : undefined;
    issues.push({ severity, code, message, path: pathKey(path), ...at(path), slideIndex, ...extra });
  };
  const zodIssues = (res: { success: boolean; error?: z.ZodError }, base: (string | number)[], prefix = '') => {
    if (res.success || !res.error) return;
    for (const e of res.error.issues) {
      const p = [...base, ...(e.path as (string | number)[])];
      add('error', 'schema', `${prefix}${pathKey(p) || 'root'}: ${e.message}`, p);
    }
  };

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    add('error', 'schema.root', 'Root must be a presentation object with "schemaVersion", "title" and "slides".', [], { fixable: Array.isArray(data) });
    return { issues, stats, unsupported: [] };
  }
  const p = data as Raw;
  if (p.schemaVersion === undefined) add('error', 'schema.version', `Missing "schemaVersion" (expected "${SCHEMA_VERSION}").`, ['schemaVersion'], { fixable: true });
  else if (String(p.schemaVersion) !== SCHEMA_VERSION) add('warning', 'schema.version', `schemaVersion "${p.schemaVersion}" differs from supported "${SCHEMA_VERSION}".`, ['schemaVersion'], { fixable: true });
  const pres = PresentationSchema.safeParse({ ...p, schemaVersion: String(p.schemaVersion ?? SCHEMA_VERSION) });
  zodIssues(pres, []);
  for (const k of Object.keys(p)) if (!PRES_KEYS.has(k)) { add('warning', 'unsupported.property', `Unsupported presentation property "${k}" (kept in metadata, not rendered).`, [k]); unsupported.add(`presentation.${k}`); }
  if (typeof p.theme === 'string' && !THEME_MAP[p.theme]) add('warning', 'theme.unknown', `Unknown theme "${p.theme}" — the default theme will be used. Available: ${Object.keys(THEME_MAP).join(', ')}.`, ['theme']);
  if (p.aspectRatio && !(p.aspectRatio in ASPECT_RATIOS)) add('error', 'schema.aspectRatio', `Unsupported aspectRatio "${p.aspectRatio}".`, ['aspectRatio']);
  if (p.aspectRatio === 'custom' && !p.size) add('error', 'schema.size', 'aspectRatio "custom" requires "size": { width, height }.', ['size']);
  const size = p.size ?? ASPECT_RATIOS[(p.aspectRatio as keyof typeof ASPECT_RATIOS) ?? '16:9'] ?? ASPECT_RATIOS['16:9'];
  if (!Array.isArray(p.slides)) return { issues, stats, unsupported: [...unsupported] };
  if (p.slides.length > MAX_SLIDES) add('error', 'limit.slides', `Too many slides (${p.slides.length} > ${MAX_SLIDES}). Split into parts.`, ['slides']);

  const slideIds = new Map<string, number>();
  let prevIds = new Set<string>();
  p.slides.forEach((s: Raw, si: number) => {
    const sp = ['slides', si];
    stats.slides++;
    if (!s || typeof s !== 'object') { add('error', 'schema.slide', `Slide ${si + 1} must be an object.`, sp); return; }
    zodIssues(SlideSchema.safeParse(s), sp, `Slide ${si + 1} › `);
    if (s.id && slideIds.has(s.id)) add('error', 'id.duplicateSlide', `Duplicate slide id "${s.id}" (also slide ${(slideIds.get(s.id) ?? 0) + 1}).`, [...sp, 'id'], { fixable: true });
    if (s.id) slideIds.set(s.id, si);
    if (!s.id) add('error', 'id.missing', `Slide ${si + 1} has no id.`, sp, { fixable: true });
    for (const k of Object.keys(s)) if (!SLIDE_KEYS.has(k)) { add('warning', 'unsupported.property', `Slide ${si + 1}: unsupported property "${k}" (ignored).`, [...sp, k]); unsupported.add(`slide.${k}`); }
    if (s.notes) stats.notes++;
    if (s.animationPreset !== undefined && !ANIMATION_PRESETS.some((x) => x.id === s.animationPreset)) add('error', 'animation.preset', `Slide ${si + 1}: unknown animationPreset "${s.animationPreset}". Use: ${ANIMATION_PRESETS.map((x) => x.id).join(', ')}.`, [...sp, 'animationPreset']);
    if (s.animations && typeof s.animations === 'object') Object.entries(s.animations as Record<string, unknown>).forEach(([id, a]) => {
      (Array.isArray(a) ? a : [a]).forEach((x, ai) => { stats.animations++; const eff = (x as Raw)?.effect; if (!eff || !(eff in ANIMATION_EFFECTS)) add('error', 'animation.unknown', `Slide ${si + 1}: animations["${id}"][${ai}] has unknown effect "${eff}".`, [...sp, 'animations', id]); });
    });
    if (s.animationPreset) stats.animations++;
    if (s.layout && !LAYOUT_MAP[s.layout]) add('warning', 'layout.unknown', `Slide ${si + 1}: unknown layout "${s.layout}" — the best matching layout will be chosen automatically.`, [...sp, 'layout']);
    if (s.layout && LAYOUT_MAP[s.layout] && s.content) {
      const missing = unusedSlots(s.layout, s.content);
      if (missing.length) add('warning', 'layout.unusedSlots', `Slide ${si + 1}: layout "${s.layout}" does not display ${missing.map((m) => `"${m}"`).join(', ')}. The data is kept; choose another layout to show it.`, [...sp, 'content']);
    }
    if (!s.layout && !s.content && (!Array.isArray(s.elements) || s.elements.length === 0)) add('warning', 'slide.empty', `Slide ${si + 1} has no elements and no content.`, sp);
    if (s.content?.image) stats.images++;
    stats.images += s.content?.images?.length ?? 0;
    if (s.content?.chart) { stats.charts++; checkChart(s.content.chart, [...sp, 'content', 'chart'], add); }
    if (s.content?.table) stats.tables++;
    if (s.content?.diagram || s.content?.timeline) stats.diagrams++;
    if (typeof s.background === 'object' && s.background) {
      zodIssues(BackgroundSchema.safeParse(s.background), [...sp, 'background']);
      if (s.background.image?.src && !isSafeUrl(s.background.image.src)) add('error', 'security.url', `Slide ${si + 1}: unsafe background image URL.`, [...sp, 'background', 'image', 'src']);
    } else if (typeof s.background === 'string' && !isValidColor(s.background)) add('warning', 'color.invalid', `Slide ${si + 1}: background "${s.background}" is not a valid color.`, [...sp, 'background']);
    // transitions
    const t = typeof s.transition === 'string' ? { type: s.transition } : s.transition;
    if (t) {
      stats.transitions++;
      if (!(t.type in TRANSITIONS)) add('error', 'transition.unknown', `Slide ${si + 1}: unknown transition "${t.type}".${TRANSITION_ALIASES[t.type] ? ` Did you mean "${TRANSITION_ALIASES[t.type]}"?` : ''}`, [...sp, 'transition'], { fixable: !!TRANSITION_ALIASES[t.type] });
      else {
        if (typeof s.transition === 'object') zodIssues(TransitionSchema.safeParse(s.transition), [...sp, 'transition']);
        const info = TRANSITIONS[t.type as keyof typeof TRANSITIONS];
        if (info.pptx !== 'supported') add('info', 'pptx.transitionPartial', `Slide ${si + 1}: transition "${t.type}" — PowerPoint export: ${info.pptxNote}.`, [...sp, 'transition']);
        if (t.type === 'morph') {
          stats.morphs++;
          const ids = new Set<string>((s.elements ?? []).map((e: Raw) => e?.id));
          const shared = [...ids].filter((id) => prevIds.has(id));
          if (si === 0) add('warning', 'morph.first', 'Morph on the first slide has nothing to morph from.', [...sp, 'transition']);
          else if (!shared.length && !s.layout) add('warning', 'morph.noMatch', `Slide ${si + 1}: Morph found no element ids shared with slide ${si}. Reuse the same element "id" on both slides to animate it.`, [...sp, 'transition']);
        }
      }
    }
    // elements
    const els = Array.isArray(s.elements) ? s.elements : [];
    if (els.length > MAX_ELEMENTS_PER_SLIDE) add('error', 'limit.elements', `Slide ${si + 1}: too many elements (${els.length}).`, [...sp, 'elements']);
    const ids = new Set<string>();
    const checkEl = (el: Raw, ep: (string | number)[], label: string, inGroup = false) => {
      stats.elements++;
      if (!el || typeof el !== 'object') { add('error', 'schema.element', `${label} must be an object.`, ep); return; }
      if (!el.type) { add('error', 'element.type', `${label}: missing "type".`, ep); return; }
      if (!(el.type in ELEMENT_TYPES)) {
        const alias = TYPE_ALIASES[el.type] ?? TYPE_ALIASES[String(el.type).toLowerCase()];
        add('error', 'element.typeUnknown', `${label}: unknown element type "${el.type}".${alias ? ` Auto Fix → "${alias}".` : ''}`, [...ep, 'type'], { fixable: !!alias });
        unsupported.add(`element.${el.type}`);
        return;
      }
      if (!el.id) add('error', 'id.missing', `${label}: missing "id".`, ep, { fixable: true });
      else if (ids.has(el.id)) add('error', 'id.duplicateElement', `${label}: duplicate element id "${el.id}" on the same slide.`, [...ep, 'id'], { fixable: true });
      if (el.id) ids.add(el.id);
      const needsCoords = !(el.type === 'line' || el.type === 'arrow') || !el.content || el.content.x1 === undefined;
      if (needsCoords) for (const k of ['x', 'y', 'width', 'height']) {
        if (typeof el[k] !== 'number' || Number.isNaN(el[k])) add('error', 'element.geometry', `${label}: "${k}" must be a number (got ${JSON.stringify(el[k])}).`, [...ep, k], { fixable: typeof el[k] === 'string' && /^-?\d+(\.\d+)?\s*(px)?$/.test(el[k]) });
      }
      for (const k of Object.keys(el)) if (!ELEMENT_KEYS.has(k)) { add('warning', 'unsupported.property', `${label}: unsupported property "${k}" (ignored).`, [...ep, k], { fixable: ['w', 'h', 'text', 'src'].includes(k) }); unsupported.add(`element.${k}`); }
      if (el.style && typeof el.style === 'object') {
        for (const k of Object.keys(el.style)) if (!STYLE_KEYS.has(k)) { add('info', 'unsupported.style', `${label}: style "${k}" is not supported (ignored).`, [...ep, 'style', k]); unsupported.add(`style.${k}`); }
        for (const k of ['color', 'fill']) if (typeof el.style[k] === 'string' && !isValidColor(el.style[k])) add('warning', 'color.invalid', `${label}: style.${k} "${el.style[k]}" is not a valid color.`, [...ep, 'style', k]);
        zodIssues(StyleSchema.safeParse(el.style), [...ep, 'style'], `${label} › `);
      }
      if (typeof el.opacity === 'number' && (el.opacity < 0 || el.opacity > 1)) add('error', 'element.opacity', `${label}: opacity must be 0–1.`, [...ep, 'opacity'], { fixable: el.opacity <= 100 });
      // content
      const cs = CONTENT_SCHEMAS[el.type];
      if (el.content === undefined || el.content === null) add('error', 'element.content', `${label}: missing "content".`, [...ep, 'content'], { fixable: typeof el.text === 'string' || typeof el.src === 'string' });
      else if (cs) {
        const content = typeof el.content === 'string' && ['text', 'heading', 'paragraph', 'richText'].includes(el.type) ? { text: el.content } : el.content;
        zodIssues(cs.safeParse(content), [...ep, 'content'], `${label} › `);
        if (['text', 'heading', 'paragraph', 'richText', 'shape'].includes(el.type) && typeof content === 'object' && !content.text && !content.paragraphs && el.type !== 'shape') add('warning', 'text.empty', `${label}: text element has no text.`, [...ep, 'content']);
      }
      if (!inGroup && needsCoords && typeof el.x === 'number' && typeof el.width === 'number') {
        const outside = el.x + el.width <= 0 || el.y + el.height <= 0 || el.x >= size.width || el.y >= size.height;
        const overflow = !outside && (el.x < -2 || el.y < -2 || el.x + el.width > size.width + 2 || el.y + el.height > size.height + 2);
        if (outside) add('warning', 'element.offCanvas', `${label}: element is completely outside the ${size.width}×${size.height} canvas.`, ep);
        else if (overflow && el.type !== 'decorative' && el.type !== 'image') add('info', 'element.bleed', `${label}: element extends beyond the canvas edge.`, ep);
      }
      switch (el.type) {
        case 'image':
          stats.images++;
          if (el.content && !el.content.src && !el.content.query) add('error', 'image.source', `${label}: image needs "src" (verified URL) or "query" (search intent).`, [...ep, 'content']);
          if (el.content?.src && !isSafeUrl(el.content.src)) add('error', 'security.url', `${label}: unsafe or unsupported image URL "${String(el.content.src).slice(0, 60)}".`, [...ep, 'content', 'src'], { fixable: true });
          if (el.content && !el.content.alt) add('info', 'a11y.alt', `${label}: image has no alt text.`, [...ep, 'content']);
          break;
        case 'chart':
          stats.charts++;
          if (el.content) checkChart(el.content, [...ep, 'content'], add, label);
          break;
        case 'table':
          stats.tables++;
          if (Array.isArray(el.content?.rows)) {
            const w = el.content.rows[0]?.length;
            el.content.rows.forEach((r: unknown[], ri: number) => { if (Array.isArray(r) && r.length !== w) add('warning', 'table.ragged', `${label}: row ${ri + 1} has ${r.length} cells (header has ${w}).`, [...ep, 'content', 'rows', ri]); });
          }
          break;
        case 'diagram': case 'smartart': case 'timeline': case 'infographic':
          stats.diagrams++;
          if (el.type !== 'timeline' && el.type !== 'infographic' && el.content?.kind === 'flowchart' && el.content) {
            const nodeIds = new Set((el.content.nodes ?? []).map((n: Raw) => n.id));
            (el.content.edges ?? []).forEach((e: Raw, ei: number) => { if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) add('error', 'diagram.edge', `${label}: edge ${ei + 1} references unknown node "${!nodeIds.has(e.from) ? e.from : e.to}".`, [...ep, 'content', 'edges', ei]); });
            if (!(el.content.nodes ?? []).length) add('error', 'diagram.nodes', `${label}: flowchart needs "nodes".`, [...ep, 'content']);
          } else if (el.type !== 'timeline' && el.content && !(el.content.items ?? []).length) add('error', 'diagram.items', `${label}: "${el.content.kind}" needs "items".`, [...ep, 'content']);
          if (el.content?.kind === 'swot' && (el.content.items ?? []).length !== 4) add('warning', 'diagram.swot', `${label}: SWOT expects exactly 4 items.`, [...ep, 'content']);
          break;
        case 'video': case 'audio':
          if (el.content?.src && !isSafeUrl(el.content.src, 'media')) add('error', 'security.url', `${label}: unsafe media URL.`, [...ep, 'content', 'src']);
          break;
        case 'shape':
          if (el.content?.shape && !(el.content.shape in SHAPES)) add('error', 'shape.unknown', `${label}: unknown shape "${el.content.shape}". Use one of: ${Object.keys(SHAPES).join(', ')}.`, [...ep, 'content', 'shape']);
          break;
        case 'group':
          (el.content?.children ?? []).forEach((c: Raw, ci: number) => checkEl(c, [...ep, 'content', 'children', ci], `${label} › child ${ci + 1}`, true));
          break;
        default:
          break;
      }
      // animations
      const anims = el.animation === undefined ? [] : Array.isArray(el.animation) ? el.animation : [el.animation];
      if (el.animation !== undefined && !Array.isArray(el.animation)) add('info', 'animation.single', `${label}: animation should be an array.`, [...ep, 'animation'], { fixable: true });
      anims.forEach((a: Raw, ai: number) => {
        stats.animations++;
        const ap = [...ep, 'animation', ai];
        if (typeof a === 'string') { add('warning', 'animation.string', `${label}: animation "${a}" should be an object { effect }.`, ap, { fixable: true }); return; }
        if (!a?.effect) { add('error', 'animation.effect', `${label}: animation ${ai + 1} needs "effect".`, ap, { fixable: !!a?.type }); return; }
        if (!(a.effect in ANIMATION_EFFECTS)) {
          const alias = EFFECT_ALIASES[a.effect] ?? EFFECT_ALIASES[String(a.effect).toLowerCase()];
          add('error', 'animation.unknown', `${label}: unknown animation effect "${a.effect}".${alias ? ` Auto Fix → "${alias}".` : ''}`, [...ap, 'effect'], { fixable: !!alias });
          return;
        }
        zodIssues(AnimationSchema.safeParse(a), ap, `${label} › `);
        for (const k of Object.keys(a)) if (!ANIM_KEYS.has(k)) add('info', 'unsupported.animation', `${label}: animation property "${k}" is not supported.`, [...ap, k]);
        const info = ANIMATION_EFFECTS[a.effect as keyof typeof ANIMATION_EFFECTS];
        if (info.pptx === 'partial') add('info', 'pptx.animationPartial', `${label}: "${a.effect}" — PowerPoint export: ${'note' in info.ppt ? info.ppt.note : 'approximated'}.`, ap);
        if (a.trigger === 'onExit') add('info', 'pptx.animationWebOnly', `${label}: "onExit" trigger plays in web presentation only.`, ap);
      });
    };
    els.forEach((el: Raw, ei: number) => checkEl(el, [...sp, 'elements', ei], `Slide ${si + 1} › element ${ei + 1}${el?.id ? ` (${el.id})` : ''}`));
    prevIds = ids;
  });
  if (p.part) add('info', 'import.part', `This is part ${p.part.index} of ${p.part.total} for presentation "${p.part.presentationId}".`, ['part']);
  return { issues, stats, unsupported: [...unsupported] };
}

function checkChart(c: Raw, path: (string | number)[], add: (s: Issue['severity'], code: string, m: string, p: (string | number)[], e?: Partial<Issue>) => void, label = 'Chart') {
  if (!c.chartType || !(c.chartType in CHART_TYPES)) { add('error', 'chart.type', `${label}: unknown chartType "${c.chartType}". Use: ${Object.keys(CHART_TYPES).join(', ')}.`, [...path, 'chartType'], { fixable: !!c.type }); return; }
  const series: Raw[] = Array.isArray(c.series) ? c.series : [];
  if (!series.length) { add('error', 'chart.series', `${label}: chart has no series.`, [...path, 'series'], { fixable: Array.isArray(c.datasets) }); return; }
  const xy = c.chartType === 'scatter' || c.chartType === 'bubble';
  const n = c.categories?.length;
  series.forEach((s, i) => {
    if (xy) { if (!Array.isArray(s.points) || !s.points.length) add('error', 'chart.points', `${label}: series "${s.name}" needs "points" [{x,y${c.chartType === 'bubble' ? ',size' : ''}}] for ${c.chartType}.`, [...path, 'series', i]); return; }
    if (c.chartType === 'histogram') { if (!Array.isArray(s.values) || s.values.length < 2) add('error', 'chart.values', `${label}: histogram series needs raw "values".`, [...path, 'series', i]); return; }
    if (!Array.isArray(s.values)) { add('error', 'chart.values', `${label}: series "${s.name ?? i + 1}" needs "values".`, [...path, 'series', i], { fixable: Array.isArray(s.data) }); return; }
    if (n !== undefined && s.values.length !== n) add('error', 'chart.length', `${label}: series "${s.name}" has ${s.values.length} values but there are ${n} categories. Data is never padded automatically — please correct it.`, [...path, 'series', i, 'values']);
    if (s.values.some((v: unknown) => v !== null && typeof v !== 'number')) add('error', 'chart.nonNumeric', `${label}: series "${s.name}" contains non-numeric values.`, [...path, 'series', i, 'values']);
    if ((c.chartType === 'pie' || c.chartType === 'donut') && s.values.some((v: number) => v < 0)) add('error', 'chart.negative', `${label}: ${c.chartType} charts cannot show negative values.`, [...path, 'series', i, 'values']);
  });
  if (!xy && c.chartType !== 'histogram' && n === undefined) add('error', 'chart.categories', `${label}: "categories" is required.`, [...path, 'categories']);
  if ((c.chartType === 'pie' || c.chartType === 'donut') && series.length > 1) add('warning', 'chart.pieSeries', `${label}: ${c.chartType} shows only the first series.`, [...path, 'series']);
  if ((c.chartType === 'pie' || c.chartType === 'donut') && (n ?? 0) > 8) add('warning', 'chart.pieSlices', `${label}: ${n} slices is hard to read — consider a bar chart.`, [...path, 'categories']);
  if (c.chartType === 'line' && (n ?? 0) < 3) add('info', 'chart.lineShort', `${label}: a line chart with fewer than 3 points rarely shows a trend.`, path);
}
