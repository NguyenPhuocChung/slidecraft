/**
 * Auto Fix — only transformations that cannot change meaning or numbers:
 * ids, aliases of effect/transition/type names, unit strings ("120px" → 120),
 * schema version, clamping opacity, wrapping single animations, dangerous URLs.
 * Content (text, data, images) is never deleted.
 */
import {
  ANIMATION_EFFECTS, EFFECT_ALIASES, ELEMENT_TYPES, SCHEMA_VERSION, SHAPES, TRANSITION_ALIASES, TRANSITIONS,
} from '@/types/registry';
import { uid } from '@/utils/id';
import { isSafeUrl } from './security';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const TYPE_ALIASES: Record<string, string> = {
  title: 'heading', h1: 'heading', h2: 'heading', h3: 'heading', header: 'heading', subtitle: 'text', label: 'text', caption: 'text',
  p: 'paragraph', body: 'paragraph', textbox: 'text', textBox: 'text', 'text-box': 'text', bullets: 'text', list: 'text',
  rich_text: 'richText', richtext: 'richText', img: 'image', picture: 'image', photo: 'image',
  rect: 'shape', rectangle: 'shape', circle: 'shape', ellipse: 'shape', box: 'shape',
  connector: 'arrow', graph: 'chart', math: 'formula', equation: 'formula', latex: 'formula', codeblock: 'code', codeBlock: 'code', 'code-block': 'code',
  youtube: 'video', 'smart-art': 'smartart', smartArt: 'smartart', decor: 'decorative', decoration: 'decorative', '3d': 'visual3d', visual3D: 'visual3d',
};
const SHAPE_ALIASES: Record<string, string> = { rectangle: 'rect', square: 'rect', circle: 'ellipse', oval: 'ellipse', rounded: 'roundRect', roundedRect: 'roundRect', 'rounded-rect': 'roundRect', star: 'star5', arrow: 'arrowRight', capsule: 'pill', donut: 'ring' };
const CHART_ALIASES: Record<string, string> = { doughnut: 'donut', horizontalBar: 'bar', barChart: 'column', vertical: 'column', columnChart: 'column', lineChart: 'line', pieChart: 'pie', stacked: 'stackedBar', 'stacked-bar': 'stackedBar', stackedColumn: 'stackedBar', spider: 'radar', mixed: 'combo' };

function num(v: unknown): unknown {
  if (typeof v === 'string' && /^-?\d+(\.\d+)?\s*(px)?$/.test(v.trim())) return parseFloat(v);
  return v;
}

export function autoFix(input: unknown): { data: unknown; fixes: string[] } {
  const fixes: string[] = [];
  if (!input || typeof input !== 'object') return { data: input, fixes };
  const data: Raw = structuredClone(input as Raw);
  // Presentation wrapper: {presentation: {...}} or bare slides array
  let p: Raw = data;
  if (Array.isArray(data)) { p = { title: 'Untitled presentation', slides: data }; fixes.push('Wrapped a bare slides array in a presentation object.'); }
  else if (!data.slides && data.presentation && typeof data.presentation === 'object') { p = data.presentation; fixes.push('Unwrapped "presentation" root object.'); }
  if (p.schemaVersion !== SCHEMA_VERSION) { fixes.push(`Set schemaVersion to "${SCHEMA_VERSION}" (was ${JSON.stringify(p.schemaVersion)}).`); p.schemaVersion = SCHEMA_VERSION; }
  if (typeof p.title !== 'string' || !p.title.trim()) { p.title = String(p.title ?? p.slides?.[0]?.title ?? 'Untitled presentation'); fixes.push('Added missing presentation title.'); }
  if (!Array.isArray(p.slides)) return { data: p, fixes };

  const slideIds = new Set<string>();
  p.slides.forEach((s: Raw, si: number) => {
    if (!s || typeof s !== 'object') return;
    if (!s.id || typeof s.id !== 'string') { s.id = `slide-${si + 1}`; fixes.push(`Slide ${si + 1}: added id "${s.id}".`); }
    if (slideIds.has(s.id)) { const old = s.id; s.id = `${old}-${si + 1}`; fixes.push(`Slide ${si + 1}: duplicate id "${old}" renamed to "${s.id}".`); }
    slideIds.add(s.id);
    if (typeof s.transition === 'string') {
      const t = TRANSITION_ALIASES[s.transition] ?? s.transition;
      if (t !== s.transition && t in TRANSITIONS) { fixes.push(`Slide ${si + 1}: transition "${s.transition}" → "${t}".`); s.transition = t; }
    } else if (s.transition && typeof s.transition === 'object') {
      const t = s.transition.type;
      if (t && !(t in TRANSITIONS) && TRANSITION_ALIASES[t]) { fixes.push(`Slide ${si + 1}: transition "${t}" → "${TRANSITION_ALIASES[t]}".`); s.transition.type = TRANSITION_ALIASES[t]; }
      if (typeof s.transition.duration === 'string') { const v = num(s.transition.duration.replace(/ms$/, '')); if (typeof v === 'number') { s.transition.duration = /s$/.test(s.transition.duration) && !/ms$/.test(s.transition.duration) ? v * 1000 : v; fixes.push(`Slide ${si + 1}: transition duration normalized.`); } }
    }
    if (!Array.isArray(s.elements)) { if (s.elements === undefined) { s.elements = []; } }
    const ids = new Set<string>();
    const fixEl = (el: Raw, label: string) => {
      if (!el || typeof el !== 'object') return;
      if (el.type && !(el.type in ELEMENT_TYPES)) {
        const alias = TYPE_ALIASES[el.type] ?? TYPE_ALIASES[String(el.type).toLowerCase()];
        if (alias) {
          if (['circle', 'ellipse', 'rect', 'rectangle', 'box'].includes(el.type)) el.content = { shape: el.type === 'circle' || el.type === 'ellipse' ? 'ellipse' : 'rect', ...(typeof el.content === 'object' ? el.content : el.content ? { text: String(el.content) } : {}) };
          fixes.push(`${label}: type "${el.type}" → "${alias}".`);
          el.type = alias;
        }
      }
      if (!el.id || typeof el.id !== 'string') { el.id = uid(el.type ?? 'el'); fixes.push(`${label}: added id "${el.id}".`); }
      if (ids.has(el.id)) { const old = el.id; el.id = `${old}-${uid('d').slice(2)}`; fixes.push(`${label}: duplicate id "${old}" renamed to "${el.id}".`); }
      ids.add(el.id);
      for (const k of ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex']) {
        const v = num(el[k]);
        if (v !== el[k]) { fixes.push(`${label}: ${k} "${el[k]}" → ${v}.`); el[k] = v; }
      }
      if (el.w !== undefined && el.width === undefined) { el.width = num(el.w); delete el.w; fixes.push(`${label}: "w" renamed to "width".`); }
      if (el.h !== undefined && el.height === undefined) { el.height = num(el.h); delete el.h; fixes.push(`${label}: "h" renamed to "height".`); }
      if (typeof el.opacity === 'number' && el.opacity > 1 && el.opacity <= 100) { el.opacity = el.opacity / 100; fixes.push(`${label}: opacity percent converted to 0–1.`); }
      if (typeof el.content === 'string' && ['text', 'heading', 'paragraph', 'richText'].includes(el.type)) { el.content = { text: el.content }; fixes.push(`${label}: string content wrapped as { text }.`); }
      if (el.text !== undefined && el.content === undefined && ['text', 'heading', 'paragraph', 'richText', 'shape'].includes(el.type)) { el.content = { text: el.text }; delete el.text; fixes.push(`${label}: "text" moved into content.`); }
      if (el.type === 'image' && el.content === undefined && (el.src || el.query)) { el.content = { src: el.src, query: el.query, alt: el.alt }; delete el.src; delete el.query; fixes.push(`${label}: image src moved into content.`); }
      if (el.type === 'image' && el.content?.url && !el.content.src) { el.content.src = el.content.url; delete el.content.url; fixes.push(`${label}: content.url renamed to src.`); }
      if (el.type === 'image' && el.content?.src && !isSafeUrl(el.content.src, 'image')) { el.content.query = el.content.query ?? el.content.alt ?? 'image'; fixes.push(`${label}: blocked unsafe image URL "${String(el.content.src).slice(0, 40)}" (kept as search query).`); delete el.content.src; }
      if (el.type === 'shape' && el.content?.shape && !(el.content.shape in SHAPES)) { const a = SHAPE_ALIASES[el.content.shape]; if (a) { fixes.push(`${label}: shape "${el.content.shape}" → "${a}".`); el.content.shape = a; } }
      if (el.type === 'chart' && el.content) {
        if (!el.content.chartType && el.content.type) { el.content.chartType = el.content.type; delete el.content.type; fixes.push(`${label}: chart "type" renamed to "chartType".`); }
        const a = CHART_ALIASES[el.content.chartType];
        if (a) { fixes.push(`${label}: chartType "${el.content.chartType}" → "${a}".`); el.content.chartType = a; }
        if (!el.content.categories && Array.isArray(el.content.labels)) { el.content.categories = el.content.labels; delete el.content.labels; fixes.push(`${label}: chart "labels" renamed to "categories".`); }
        if (!el.content.series && Array.isArray(el.content.datasets)) { el.content.series = el.content.datasets.map((d: Raw) => ({ name: d.label ?? d.name ?? 'Series', values: d.data ?? d.values, ...(d.color || d.backgroundColor ? { color: typeof (d.color ?? d.backgroundColor) === 'string' ? d.color ?? d.backgroundColor : undefined } : {}) })); delete el.content.datasets; fixes.push(`${label}: Chart.js "datasets" converted to "series" (values unchanged).`); }
        (el.content.series ?? []).forEach((s: Raw) => { if (s && Array.isArray(s.data) && !s.values) { s.values = s.data; delete s.data; fixes.push(`${label}: series "data" renamed to "values".`); } });
      }
      if (el.animation && !Array.isArray(el.animation)) { el.animation = typeof el.animation === 'string' ? [{ effect: el.animation }] : [el.animation]; fixes.push(`${label}: animation wrapped in an array.`); }
      (el.animation ?? []).forEach((a: Raw, ai: number) => {
        if (typeof a === 'string') { el.animation[ai] = a = { effect: a }; }
        if (!a.effect && a.type) { a.effect = a.type; delete a.type; fixes.push(`${label}: animation "type" renamed to "effect".`); }
        if (a.effect && !(a.effect in ANIMATION_EFFECTS)) {
          const al = EFFECT_ALIASES[a.effect] ?? EFFECT_ALIASES[String(a.effect).toLowerCase()];
          if (al) { fixes.push(`${label}: animation "${a.effect}" → "${al}".`); a.effect = al; }
        }
        for (const k of ['duration', 'delay']) if (typeof a[k] === 'string') { const s = a[k] as string; const v = parseFloat(s); if (!Number.isNaN(v)) { a[k] = /\ds$/.test(s) && !/ms$/.test(s) ? v * 1000 : v; fixes.push(`${label}: animation ${k} "${s}" → ${a[k]}ms.`); } }
        if (typeof a.duration === 'number' && a.duration > 0 && a.duration < 20) { a.duration = a.duration * 1000; fixes.push(`${label}: animation duration in seconds converted to ms.`); }
        if (a.trigger && typeof a.trigger === 'string') { const t = ({ click: 'onClick', 'on-click': 'onClick', with: 'withPrevious', after: 'afterPrevious', auto: 'onEnter', onLoad: 'onEnter', load: 'onEnter' } as Record<string, string>)[a.trigger]; if (t) { fixes.push(`${label}: trigger "${a.trigger}" → "${t}".`); a.trigger = t; } }
      });
      if (el.type === 'group' && Array.isArray(el.content?.children)) el.content.children.forEach((c: Raw, ci: number) => fixEl(c, `${label} › child ${ci + 1}`));
    };
    (s.elements ?? []).forEach((el: Raw, ei: number) => fixEl(el, `Slide ${si + 1} › element ${ei + 1}`));
  });
  return { data: p, fixes };
}
