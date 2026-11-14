/**
 * Smart Layout Assistant — produces candidate redesigns of a slide.
 * Candidates are previews only; nothing changes until the user applies one.
 * Text is never dropped: when text is reduced on the slide, it moves to speaker notes.
 */
import type { LayoutContent, Paragraph, Slide, SlideElement, Theme } from '@/types/schema';
import { buildLayout, suggestLayouts, LAYOUT_MAP } from './engine';
import { extractContent } from './extract';
import { normalizeElement } from '@/code-parser/normalize';
import { contrastRatio, readableOn } from '@/utils/color';
import { resolveColor } from '@/themes/themes';
import { paragraphsToPlain } from '@/utils/richtext';

export interface Candidate { id: string; title: string; description: string; slide: Slide; warnings?: string[] }
export type AssistantAction = 'suggest' | 'visual' | 'reduce' | 'hierarchy' | 'balance' | 'contrast' | 'infographic' | 'timeline' | 'chart' | 'alternative';

function materialize(slide: Slide, layout: string, content: LayoutContent, theme: Theme, size: { width: number; height: number }, notesExtra?: string): Slide {
  const res = buildLayout(layout, content, theme, size);
  const anim = new Map(slide.elements.filter((e) => e.animation?.length).map((e) => [e.id, e.animation]));
  return {
    ...slide, layout: res.layout, content,
    elements: res.elements.map((e) => ({ ...normalizeElement(e), ...(anim.get(e.id) ? { animation: anim.get(e.id) } : {}) })),
    background: res.background ?? (slide.layout ? undefined : slide.background),
    notes: notesExtra ? [slide.notes, notesExtra].filter(Boolean).join('\n\n') : slide.notes,
  };
}

const NUM = /^(.*?)[\s:–-]+([-+]?[$€£]?\d[\d.,]*)\s*(%|[kmb]|bn|tr|tỷ|triệu)?\b/i;
const DATE = /^((?:19|20)\d{2}|q[1-4]\s?\d{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s?\d{0,4}|(?:th[aá]ng)\s?\d+)\s*[:–-]\s*(.+)$/i;

export function textAmount(slide: Slide): { words: number; chars: number } {
  const t = slide.elements.filter((e) => e.content?.paragraphs).map((e) => paragraphsToPlain(e.content.paragraphs as Paragraph[])).join(' ');
  return { words: t.split(/\s+/).filter(Boolean).length, chars: t.length };
}

export function generateCandidates(action: AssistantAction, slide: Slide, theme: Theme, size: { width: number; height: number }): Candidate[] {
  const c = extractContent(slide);
  const out: Candidate[] = [];
  const add = (id: string, title: string, description: string, s: Slide, warnings?: string[]) => out.push({ id, title, description, slide: s, warnings });
  const bullets = c.bullets ?? (c.body ? c.body.split(/\n+/).filter(Boolean) : []);
  switch (action) {
    case 'suggest': case 'alternative': {
      const list = suggestLayouts(c, slide.layout).filter((s) => s.score > 0 && s.missing.length === 0 && s.layout.id !== slide.layout);
      const pick = action === 'alternative' ? list.slice(0, 12).sort(() => Math.random() - 0.5).slice(0, 4) : list.slice(0, 6);
      pick.forEach((s) => add(s.layout.id, s.layout.name, `${s.layout.description} (fit ${s.score}/100)`, materialize(slide, s.layout.id, c, theme, size)));
      break;
    }
    case 'visual': {
      const withImg: LayoutContent = { ...c, image: c.image ?? { query: [c.heading, c.subheading].filter(Boolean).join(' ').slice(0, 80) || 'abstract', alt: c.heading ?? 'Illustration' } };
      ['imageRight', 'imageLeft', 'splitScreen', 'hero'].forEach((l) => { if (LAYOUT_MAP[l].slots.every((k) => k !== 'stats')) add(`visual-${l}`, `${LAYOUT_MAP[l].name} with image`, 'Adds an image chosen from the slide topic (resolved via image search).', materialize(slide, l, withImg, theme, size)); });
      if (bullets.length >= 3 && bullets.length <= 8) {
        const items = bullets.map((b) => { const [t, ...rest] = b.split(/[:–—-]\s+/); return { title: t.trim(), text: rest.join(' – ').trim() || undefined }; });
        add('visual-cards', 'Card grid', 'Turns each point into a card.', materialize(slide, items.length === 3 ? 'threeColumns' : 'cardGrid', { ...c, items, bullets: undefined, body: undefined }, theme, size), c.body && c.bullets ? ['Body paragraph moved to speaker notes'] : undefined);
      }
      break;
    }
    case 'reduce': {
      const words = textAmount(slide).words;
      if (c.body && c.body.length > 160) {
        const sentences = c.body.split(/(?<=[.!?])\s+/).filter(Boolean);
        const keep = sentences.slice(0, 1).join(' ');
        const moved = sentences.slice(1).join(' ');
        add('reduce-body', 'Keep the key sentence', 'First sentence stays on the slide; the rest moves to speaker notes.', materialize(slide, slide.layout ?? 'singleColumn', { ...c, body: keep }, theme, size, moved ? `[Moved from slide] ${moved}` : undefined));
        if (sentences.length >= 3) add('reduce-bullets', 'Sentences → bullets', 'Each sentence becomes a short bullet.', materialize(slide, 'singleColumn', { ...c, body: undefined, bullets: sentences.map((s) => s.replace(/[.]$/, '')) }, theme, size));
      }
      if ((c.bullets?.length ?? 0) > 5) {
        const keep = c.bullets!.slice(0, 5), moved = c.bullets!.slice(5);
        add('reduce-top5', 'Top 5 points', `Keeps 5 points on the slide; ${moved.length} move to speaker notes.`, materialize(slide, slide.layout ?? 'singleColumn', { ...c, bullets: keep }, theme, size, `[Moved from slide]\n- ${moved.join('\n- ')}`));
        const half = Math.ceil(c.bullets!.length / 2);
        add('reduce-2col', 'Split into two columns', 'All points kept, arranged in two balanced columns.', materialize(slide, 'twoColumns', { ...c, bullets: undefined, columns: [{ bullets: c.bullets!.slice(0, half) }, { bullets: c.bullets!.slice(half) }] }, theme, size));
      }
      if (!out.length) add('reduce-none', 'Text density is fine', `${words} words on this slide — no reduction needed.`, slide);
      break;
    }
    case 'hierarchy': {
      const s = structuredClone(slide);
      const texts = s.elements.filter((e) => e.content?.paragraphs && e.type !== 'shape');
      const heading = texts.find((e) => e.id === 'heading') ?? [...texts].sort((a, b) => (b.style?.fontSize ?? 30) - (a.style?.fontSize ?? 30))[0];
      texts.forEach((e) => {
        e.style = { ...(e.style ?? {}) };
        if (e === heading) { e.type = 'heading'; e.style.fontSize = Math.max(e.style.fontSize ?? 0, theme.fontScale.h2); e.style.fontWeight = theme.typography.headingWeight; e.style.color = '$text'; e.style.fontFamily = '$heading'; }
        else if ((e.style.fontSize ?? 30) >= (heading?.style?.fontSize ?? 56)) { e.style.fontSize = Math.round((heading?.style?.fontSize ?? 56) * 0.5); }
        else if (e.type !== 'heading') { e.style.color = e.style.color ?? '$textMuted'; }
      });
      add('hierarchy', 'Clear type scale', 'Makes the headline dominant and secondary text quieter.', s);
      if (slide.layout) add('hierarchy-relayout', 'Rebuild with layout scale', 'Re-applies the layout so all sizes follow the theme type scale.', materialize(slide, slide.layout, c, theme, size));
      break;
    }
    case 'balance': {
      if (slide.layout) add('balance-relayout', 'Snap to layout grid', 'Re-aligns all elements to the layout grid and margins.', materialize(slide, slide.layout, c, theme, size));
      const s = structuredClone(slide);
      const els = s.elements.filter((e) => e.width < size.width * 0.95);
      if (els.length) {
        const x0 = Math.min(...els.map((e) => e.x)), x1 = Math.max(...els.map((e) => e.x + e.width));
        const y0 = Math.min(...els.map((e) => e.y)), y1 = Math.max(...els.map((e) => e.y + e.height));
        const dx = Math.round((size.width - (x1 - x0)) / 2 - x0), dy = Math.round((size.height - (y1 - y0)) / 2 - y0);
        els.forEach((e) => { e.x += dx; e.y += dy; if (e.type === 'line' || e.type === 'arrow') { e.content.x1 += dx; e.content.x2 += dx; e.content.y1 += dy; e.content.y2 += dy; } });
        add('balance-center', 'Center composition', 'Centers the content block optically on the slide.', s);
      }
      break;
    }
    case 'contrast': {
      const s = structuredClone(slide);
      const bg = resolveColor(slide.background?.type === 'color' ? slide.background.color : undefined, theme, theme.colors.background);
      const fixed: string[] = [];
      s.elements.forEach((e) => {
        if (!e.content?.paragraphs || e.type === 'shape') return;
        const col = resolveColor(e.style?.color ?? '$text', theme, theme.colors.text);
        const under = e.style?.fill ? resolveColor(e.style.fill, theme) : backdropFor(e, s.elements, theme) ?? bg;
        if (contrastRatio(col, under) < 4.5) { e.style = { ...(e.style ?? {}), color: readableOn(under, '#ffffff', '#111827') }; fixed.push(e.id); }
      });
      add('contrast', fixed.length ? `Fix ${fixed.length} low-contrast text` : 'Contrast is OK', fixed.length ? 'Text colors adjusted to meet WCAG AA (4.5:1).' : 'All text meets WCAG AA against its background.', s);
      break;
    }
    case 'infographic': {
      if (bullets.length >= 2) {
        const items = bullets.map((b) => { const [t, ...rest] = b.split(/[:–—-]\s+/); return { title: t.trim(), ...(rest.length ? { text: rest.join(' – ').trim() } : {}) }; });
        (['process', 'cycle', 'list', 'pyramid'] as const).forEach((k) => add(`info-${k}`, `${k[0].toUpperCase()}${k.slice(1)} diagram`, `Shows the ${items.length} points as a ${k} diagram.`, materialize(slide, 'infographic', { ...c, bullets: undefined, body: c.bullets ? c.body : undefined, diagram: { kind: k, items } }, theme, size)));
      } else add('info-none', 'Not enough points', 'Add at least 2 bullet points to convert into an infographic.', slide);
      break;
    }
    case 'timeline': {
      const items = bullets.map((b) => DATE.exec(b.trim())).filter(Boolean).map((m) => { const [t, ...rest] = m![2].split(/[:–—-]\s+/); return { date: m![1], title: t.trim(), ...(rest.length ? { text: rest.join(' – ') } : {}) }; });
      if (items.length >= 2 && items.length === bullets.length) {
        add('timeline-h', 'Horizontal timeline', 'Dated points become milestones.', materialize(slide, 'timeline', { ...c, bullets: undefined, timeline: { orientation: 'horizontal', style: 'milestones', items } }, theme, size));
        add('timeline-v', 'Vertical timeline', 'Milestones stacked top to bottom.', materialize(slide, 'timeline', { ...c, bullets: undefined, timeline: { orientation: 'vertical', style: 'line', items } }, theme, size));
      } else add('timeline-none', 'No dates found', 'Each bullet must start with a date or period, e.g. “2024: Launch”. Content was not changed.', slide);
      break;
    }
    case 'chart': {
      const pairs = bullets.map((b) => NUM.exec(b.trim())).filter(Boolean).map((m) => ({ label: m![1].replace(/[*_]/g, '').trim(), value: Number(m![2].replace(/[$€£,]/g, '')), unit: m![3] ?? '' }));
      if (pairs.length >= 2 && pairs.length === bullets.length && pairs.every((p) => Number.isFinite(p.value))) {
        const suffix = pairs[0].unit === '%' ? '%' : pairs[0].unit ? pairs[0].unit.toUpperCase() : undefined;
        const chart = { chartType: 'column' as const, categories: pairs.map((p) => p.label), series: [{ name: c.heading ?? 'Value', values: pairs.map((p) => p.value) }], valueSuffix: suffix, showLabels: true };
        add('chart-col', 'Column chart', 'Numbers in the bullets become a column chart (values unchanged).', materialize(slide, 'chartFocus', { ...c, bullets: undefined, chart }, theme, size));
        add('chart-bar', 'Bar chart', 'Horizontal bars for longer labels.', materialize(slide, 'chartFocus', { ...c, bullets: undefined, chart: { ...chart, chartType: 'bar' } }, theme, size));
        const total = pairs.reduce((a, p) => a + p.value, 0);
        if (Math.abs(total - 100) < 1.5) add('chart-donut', 'Donut chart', 'Values add up to 100% — shown as shares.', materialize(slide, 'chartFocus', { ...c, bullets: undefined, chart: { ...chart, chartType: 'donut' } }, theme, size));
        add('chart-stats', 'Big statistics', 'Numbers shown as large stat blocks.', materialize(slide, 'statistics', { ...c, bullets: undefined, stats: pairs.slice(0, 4).map((p) => ({ value: `${p.value}${p.unit}`, label: p.label })) }, theme, size), pairs.length > 4 ? ['Only the first 4 numbers fit; others moved to notes'] : undefined);
      } else add('chart-none', 'No numeric data found', 'Bullets must look like “Label: 42” to build a chart. Data is never invented.', slide);
      break;
    }
  }
  return out;
}

function backdropFor(e: SlideElement, els: SlideElement[], theme: Theme): string | undefined {
  const under = els.filter((o) => o !== e && (o.zIndex ?? 0) < (e.zIndex ?? 0) && o.type === 'shape' && o.style?.fill && o.x <= e.x + 4 && o.y <= e.y + 4 && o.x + o.width >= e.x + e.width - 4 && o.y + o.height >= e.y + e.height - 4);
  const top = under.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0];
  return top ? resolveColor(top.style!.fill, theme) : undefined;
}
