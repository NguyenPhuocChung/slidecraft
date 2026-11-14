/**
 * Presentation Quality Checker — pure analysis, never modifies slides.
 * Scores: Layout 20 · Typography 20 · Visual Hierarchy 20 · Color 15 · Content Density 15 · Consistency 10.
 */
import type { Paragraph, Presentation, Slide, SlideElement, Theme } from '@/types/schema';
import { getTheme, resolveColor, resolveFont } from '@/themes/themes';
import { contrastRatio, parseColor } from '@/utils/color';
import { measureParagraphs, paragraphsToPlain } from '@/utils/richtext';

export type QualityCategory = 'layout' | 'typography' | 'hierarchy' | 'color' | 'density' | 'consistency';
export interface QualityIssue {
  slideId: string;
  slideIndex: number;
  elementId?: string;
  category: QualityCategory;
  severity: 'high' | 'medium' | 'low';
  code: string;
  message: string;
  suggestion: string;
}
export interface CategoryScore { category: QualityCategory; label: string; score: number; max: number }
export interface QualityReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: CategoryScore[];
  issues: QualityIssue[];
  slides: { slideId: string; slideIndex: number; score: number; issues: number }[];
}

export const CATEGORY_MAX: Record<QualityCategory, { label: string; max: number }> = {
  layout: { label: 'Layout', max: 20 },
  typography: { label: 'Typography', max: 20 },
  hierarchy: { label: 'Visual Hierarchy', max: 20 },
  color: { label: 'Color', max: 15 },
  density: { label: 'Content Density', max: 15 },
  consistency: { label: 'Consistency', max: 10 },
};
const PENALTY = { high: 1, medium: 0.5, low: 0.2 };

const TEXT = ['text', 'heading', 'paragraph', 'richText'];
const isText = (e: SlideElement) => TEXT.includes(e.type) || (e.type === 'shape' && !!e.content?.paragraphs?.length);
const textOf = (e: SlideElement) => paragraphsToPlain(e.content?.paragraphs as Paragraph[] | undefined).trim();
const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
function fontSizeOf(e: SlideElement, t: Theme) { return e.style?.fontSize ?? (e.type === 'heading' ? t.fontScale.h2 : e.type === 'shape' ? 26 : t.fontScale.body); }
function overlapArea(a: SlideElement, b: SlideElement) {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
function slideBg(slide: Slide, t: Theme): string {
  const bg = slide.background ?? t.background;
  if (!bg) return t.colors.background;
  if (bg.type === 'color') return resolveColor(bg.color, t, t.colors.background);
  if (bg.type === 'gradient' && bg.gradient?.stops?.length) return resolveColor(bg.gradient.stops[Math.floor(bg.gradient.stops.length / 2)].color, t, t.colors.background);
  if (bg.type === 'image') return bg.overlay ? resolveColor(bg.overlay.color, t, '#000000') : '#777777';
  return t.colors.background;
}
/** Background directly behind an element: topmost filled shape below it that covers its center, else the slide bg. */
function backdropFor(el: SlideElement, slide: Slide, t: Theme): { color: string; overImage: boolean } {
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const below = slide.elements.filter((o) => o.id !== el.id && (o.zIndex ?? 0) < (el.zIndex ?? 0) && o.visible !== false && cx >= o.x && cx <= o.x + o.width && cy >= o.y && cy <= o.y + o.height).sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  for (const o of below) {
    if (o.type === 'image') return { color: o.style?.overlay ? resolveColor(o.style.overlay.color, t, '#000') : '#808080', overImage: !o.style?.overlay || o.style.overlay.opacity < 0.35 };
    if (o.type === 'shape' && (o.style?.fill || !o.style?.stroke)) {
      const f = resolveColor(o.style?.fill ?? '$primary', t, '');
      const c = parseColor(f);
      if (c && c.a > 0.6 && (o.opacity ?? 1) > 0.6) return { color: f, overImage: false };
    }
    if (TEXT.includes(o.type) && o.style?.fill) return { color: resolveColor(o.style.fill, t, t.colors.background), overImage: false };
  }
  const bg = slide.background ?? t.background;
  return { color: slideBg(slide, t), overImage: bg?.type === 'image' && !(bg.overlay && bg.overlay.opacity >= 0.35) };
}

export function checkSlide(slide: Slide, index: number, p: Presentation): QualityIssue[] {
  const t = slide.theme && slide.theme !== p.theme ? getTheme(slide.theme) : getTheme(p.theme, p.themeOverrides);
  const W = p.size.width, H = p.size.height;
  const scale = H / 1080;
  const issues: QualityIssue[] = [];
  const add = (i: Omit<QualityIssue, 'slideId' | 'slideIndex'>) => issues.push({ slideId: slide.id, slideIndex: index, ...i });
  const els = slide.elements.filter((e) => e.visible !== false);
  const texts = els.filter((e) => isText(e) && textOf(e));
  const isDecor = (e: SlideElement) => e.type === 'decorative' || (e.width >= W * 0.95 && e.height >= H * 0.95);

  if (!els.length) { add({ category: 'density', severity: 'high', code: 'empty', message: 'Slide is empty.', suggestion: 'Add a clear message or remove the slide.' }); return issues; }

  // Hierarchy: heading present and dominant
  const headings = texts.filter((e) => e.type === 'heading');
  const sizes = texts.map((e) => fontSizeOf(e, t));
  const maxSize = Math.max(0, ...sizes);
  if (!headings.length && !els.some((e) => ['chart', 'image', 'diagram', 'timeline', 'infographic'].includes(e.type) && e.width * e.height > W * H * 0.4)) add({ category: 'hierarchy', severity: 'medium', code: 'noHeading', message: 'No heading — the slide has no clear entry point.', suggestion: 'Add a short headline that states the takeaway.' });
  if (texts.length >= 2 && sizes.every((s) => Math.abs(s - sizes[0]) < 2)) add({ category: 'hierarchy', severity: 'medium', code: 'flatHierarchy', message: 'All text uses the same size — nothing stands out.', suggestion: 'Make the key message at least 1.5× larger than body text.' });
  else if (headings.length && texts.some((e) => e.type !== 'heading' && fontSizeOf(e, t) > Math.max(...headings.map((h) => fontSizeOf(h, t))) * 1.05 && words(textOf(e)) > 6)) add({ category: 'hierarchy', severity: 'low', code: 'bodyBiggerThanHeading', message: 'Body text is larger than the heading.', suggestion: 'Reserve the largest size for the main message.' });

  // Title length
  headings.forEach((h) => {
    const w = words(textOf(h));
    if (w > 15) add({ elementId: h.id, category: 'typography', severity: w > 22 ? 'high' : 'medium', code: 'longTitle', message: `Heading has ${w} words.`, suggestion: 'Keep headlines under ~12 words; move detail into body text or notes.' });
  });

  // Text too small / too much / overflow
  let totalWords = 0;
  texts.forEach((e) => {
    const fs = fontSizeOf(e, t) / scale;
    const w = words(textOf(e));
    totalWords += w;
    if (fs < 18 && w > 3) add({ elementId: e.id, category: 'typography', severity: fs < 14 ? 'high' : 'medium', code: 'smallText', message: `Text "${textOf(e).slice(0, 40)}…" is ${Math.round(fs)}px (at 1080p).`, suggestion: 'Use at least 18–20px for readable body text when projected.' });
    if (e.content?.paragraphs) {
      const m = measureParagraphs(e.content.paragraphs, e.width, { fontSize: fontSizeOf(e, t), lineHeight: e.style?.lineHeight ?? (e.type === 'heading' ? t.typography.headingLineHeight : t.typography.bodyLineHeight), paragraphSpacing: e.style?.paragraphSpacing, padding: typeof e.style?.padding === 'number' ? e.style.padding : 0 });
      if (m.height > e.height * 1.25 + 8) add({ elementId: e.id, category: 'layout', severity: 'high', code: 'overflow', message: 'Text likely overflows its box and may be cut off.', suggestion: 'Enlarge the box, shorten the text or split the slide.' });
    }
  });
  if (totalWords > 90) add({ category: 'density', severity: totalWords > 140 ? 'high' : 'medium', code: 'tooMuchText', message: `${totalWords} words on one slide.`, suggestion: 'Aim for under ~60 words; move detail to speaker notes or a second slide.' });
  const bulletCount = texts.reduce((n, e) => n + ((e.content?.paragraphs ?? []) as Paragraph[]).filter((pp) => pp.list).length, 0);
  if (bulletCount > 7) add({ category: 'density', severity: 'medium', code: 'manyBullets', message: `${bulletCount} bullet points.`, suggestion: 'Limit to 3–6 bullets, or convert to a diagram / card grid.' });

  // Contrast
  texts.forEach((e) => {
    const { color: bg, overImage } = backdropFor(e, slide, t);
    const fg = resolveColor(e.style?.color ?? (e.type === 'shape' ? '#ffffff' : '$text'), t, t.colors.text);
    const runColors = ((e.content?.paragraphs ?? []) as Paragraph[]).flatMap((pp) => pp.runs.filter((r) => r.color && r.text.trim()).map((r) => resolveColor(r.color, t, fg)));
    const ownBg = e.type === 'shape' ? resolveColor(e.style?.fill ?? '$primary', t, bg) : e.style?.fill ? resolveColor(e.style.fill, t, bg) : bg;
    const worst = Math.min(...[fg, ...runColors].map((c) => contrastRatio(c, ownBg, slideBg(slide, t))));
    const large = fontSizeOf(e, t) / scale >= 36;
    const need = large ? 3 : 4.5;
    if (overImage && e.type !== 'shape' && !e.style?.fill && !e.style?.textShadow) add({ elementId: e.id, category: 'color', severity: 'medium', code: 'textOverImage', message: 'Text sits directly on an image; readability depends on the photo.', suggestion: 'Add a dark overlay (≥35%), a text shadow or a solid backing shape.' });
    else if (worst < need) add({ elementId: e.id, category: 'color', severity: worst < need * 0.66 ? 'high' : 'medium', code: 'lowContrast', message: `Low contrast ${worst.toFixed(1)}:1 for "${textOf(e).slice(0, 30)}" (needs ${need}:1).`, suggestion: 'Darken the text or lighten the background (WCAG AA).' });
  });

  // Fonts & colors on the slide
  const fonts = new Set(texts.map((e) => resolveFont(e.style?.fontFamily, t, e.type === 'heading' ? 'heading' : 'body')));
  if (fonts.size > 3) add({ category: 'consistency', severity: 'medium', code: 'manyFonts', message: `${fonts.size} font families on one slide (${[...fonts].join(', ')}).`, suggestion: 'Use the theme heading + body fonts only.' });
  const fills = new Set(els.filter((e) => e.type === 'shape' && !isDecor(e)).map((e) => resolveColor(e.style?.fill ?? '$primary', t, '').toLowerCase()).filter(Boolean));
  const textColors = new Set(texts.map((e) => resolveColor(e.style?.color ?? '$text', t, '').toLowerCase()));
  if (fills.size + textColors.size > 7) add({ category: 'color', severity: 'low', code: 'manyColors', message: `${fills.size + textColors.size} distinct colors.`, suggestion: 'Stick to theme colors: one accent for emphasis.' });

  // Edges & margins
  const margin = 24 * scale;
  els.filter((e) => !isDecor(e) && e.type !== 'image' && e.type !== 'shape' && e.type !== 'line').forEach((e) => {
    const hug = e.x < margin || e.y < margin || e.x + e.width > W - margin || e.y + e.height > H - margin;
    const outside = e.x + e.width <= 0 || e.y + e.height <= 0 || e.x >= W || e.y >= H;
    if (outside) add({ elementId: e.id, category: 'layout', severity: 'high', code: 'offCanvas', message: 'Element is outside the slide.', suggestion: 'Move it onto the canvas or delete it.' });
    else if (hug && isText(e)) add({ elementId: e.id, category: 'layout', severity: 'low', code: 'edgeHug', message: 'Text is closer than 24px to the slide edge.', suggestion: 'Keep a consistent outer margin (≈80–120px at 1080p).' });
  });

  // Overlapping text
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    const ov = overlapArea(a, b);
    if (ov > Math.min(a.width * a.height, b.width * b.height) * 0.15) add({ elementId: b.id, category: 'layout', severity: 'high', code: 'textOverlap', message: `Text boxes "${a.id}" and "${b.id}" overlap.`, suggestion: 'Separate them or align them on a grid.' });
  }

  // Balance (visual mass left vs right)
  const content = els.filter((e) => !isDecor(e));
  const mass = content.reduce((m, e) => { const area = e.width * e.height * (e.type === 'image' ? 1.4 : isText(e) ? 0.8 : 1); const cx = e.x + e.width / 2; return { l: m.l + (cx < W / 2 ? area : 0), r: m.r + (cx >= W / 2 ? area : 0) }; }, { l: 0, r: 0 });
  const total = mass.l + mass.r;
  if (total > W * H * 0.15 && Math.min(mass.l, mass.r) / total < 0.08 && content.length > 2) add({ category: 'layout', severity: 'low', code: 'unbalanced', message: `Visual weight is concentrated on the ${mass.l > mass.r ? 'left' : 'right'}.`, suggestion: 'Balance with an image, whitespace or a visual on the other side (unless intentional).' });

  // Charts
  els.filter((e) => e.type === 'chart').forEach((e) => {
    const c = e.content ?? {};
    if ((c.series?.length ?? 0) > 1 && c.showLegend === false) add({ elementId: e.id, category: 'hierarchy', severity: 'medium', code: 'chartLegend', message: 'Multi-series chart without a legend.', suggestion: 'Show the legend or label series directly.' });
    if (!c.title && !headings.length) add({ elementId: e.id, category: 'hierarchy', severity: 'medium', code: 'chartTitle', message: 'Chart has no title and the slide has no heading.', suggestion: 'State what the chart proves in a headline.' });
    if (c.showAxis === false && !c.showLabels && !['pie', 'donut', 'treemap', 'funnel'].includes(c.chartType)) add({ elementId: e.id, category: 'hierarchy', severity: 'medium', code: 'chartLabels', message: 'Chart has neither axes nor data labels.', suggestion: 'Show axis or value labels so numbers can be read.' });
    if (!c.source) add({ elementId: e.id, category: 'consistency', severity: 'low', code: 'chartSource', message: 'Chart has no data source.', suggestion: 'Add a "source" so the audience can trust the data.' });
  });

  // Images
  els.filter((e) => e.type === 'image').forEach((e) => {
    if (!e.content?.src && e.content?.query) add({ elementId: e.id, category: 'consistency', severity: 'medium', code: 'imageUnresolved', message: `Image “${e.content.query}” is only a search intent (not chosen yet).`, suggestion: 'Pick a relevant image in the Media panel or upload your own.' });
    if (!e.content?.alt) add({ elementId: e.id, category: 'consistency', severity: 'low', code: 'imageAlt', message: 'Image has no alt text.', suggestion: 'Describe the image for accessibility.' });
  });

  // Emphasis: a slide with only body-sized text of similar weight
  if (texts.length && maxSize / scale < 34 && !els.some((e) => ['chart', 'image', 'diagram', 'timeline', 'infographic', 'visual3d', 'table', 'code', 'formula', 'video'].includes(e.type))) add({ category: 'hierarchy', severity: 'medium', code: 'noEmphasis', message: 'No focal point — no large text, image or visual.', suggestion: 'Add a key number, image or diagram, or enlarge the main message.' });
  return issues;
}

export function checkPresentation(p: Presentation): QualityReport {
  const issues: QualityIssue[] = [];
  p.slides.forEach((s, i) => { if (!s.hidden) issues.push(...checkSlide(s, i, p)); });
  // Deck-level consistency
  const t = getTheme(p.theme, p.themeOverrides);
  const fonts = new Set<string>();
  p.slides.forEach((s) => s.elements.forEach((e) => { if (isText(e)) fonts.add(resolveFont(e.style?.fontFamily, t, e.type === 'heading' ? 'heading' : 'body')); }));
  if (fonts.size > 4) issues.push({ slideId: p.slides[0]?.id ?? '', slideIndex: 0, category: 'consistency', severity: 'medium', code: 'deckFonts', message: `${fonts.size} font families across the deck.`, suggestion: 'Use one heading and one body font (theme fonts).' });
  const layouts = p.slides.map((s) => s.layout).filter(Boolean);
  for (let i = 2; i < layouts.length; i++) if (layouts[i] && layouts[i] === layouts[i - 1] && layouts[i] === layouts[i - 2]) { const s = p.slides[i]; issues.push({ slideId: s.id, slideIndex: i, category: 'consistency', severity: 'low', code: 'repetitiveLayout', message: `Three consecutive slides use the "${layouts[i]}" layout.`, suggestion: 'Vary the composition to keep rhythm (Smart Layout Assistant → alternatives).' }); }
  const nSlides = Math.max(1, p.slides.filter((s) => !s.hidden).length);
  const categories: CategoryScore[] = (Object.keys(CATEGORY_MAX) as QualityCategory[]).map((cat) => {
    const { label, max } = CATEGORY_MAX[cat];
    const pen = issues.filter((i) => i.category === cat).reduce((s, i) => s + PENALTY[i.severity], 0);
    // normalize per slide: one high issue per slide costs ~60% of the category
    const ratio = Math.min(1, (pen / nSlides) * 0.6);
    return { category: cat, label, max, score: Math.round(max * (1 - ratio) * 10) / 10 };
  });
  const score = Math.round(categories.reduce((s, c) => s + c.score, 0));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
  const slides = p.slides.map((s, i) => {
    const own = issues.filter((x) => x.slideIndex === i);
    const pen = own.reduce((acc, x) => acc + PENALTY[x.severity] * 12, 0);
    return { slideId: s.id, slideIndex: i, score: Math.max(0, Math.round(100 - pen)), issues: own.length };
  });
  return { score, grade, categories, issues, slides };
}
