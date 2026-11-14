/**
 * Read slot content back from a slide's current elements, so layout changes
 * reflect user edits. Semantic ids from the Layout Engine are mapped back; for
 * free-form slides the strongest candidates (largest heading, longest text,
 * first image/chart/table...) are used. Original `slide.content` fills gaps.
 */
import type { LayoutContent, Paragraph, Slide, SlideElement } from '@/types/schema';
import { paragraphsToMarkdown, paragraphsToPlain } from '@/utils/richtext';

const text = (el?: SlideElement) => (el ? paragraphsToPlain(el.content?.paragraphs as Paragraph[]) : undefined);
const md = (el?: SlideElement) => (el ? paragraphsToMarkdown(el.content?.paragraphs as Paragraph[]) : undefined);

export function extractContent(slide: Slide): LayoutContent {
  const c: LayoutContent = structuredClone(slide.content ?? {});
  const byId = new Map(slide.elements.map((e) => [e.id, e]));
  const textEls = slide.elements.filter((e) => ['text', 'heading', 'paragraph', 'richText'].includes(e.type) && e.visible !== false);
  const used = new Set<string>();
  const take = (id: string) => { const e = byId.get(id); if (e) used.add(id); return e; };

  const h = take('heading') ?? [...textEls].filter((e) => e.type === 'heading').sort((a, b) => (b.style?.fontSize ?? 56) - (a.style?.fontSize ?? 56))[0];
  if (h) { used.add(h.id); c.heading = text(h); }
  const eb = take('eyebrow'); if (eb) c.eyebrow = text(eb);
  const sub = take('subheading'); if (sub) c.subheading = text(sub);
  const body = take('body'); if (body) c.body = md(body);
  const bullets = take('bullets');
  if (bullets) {
    const ps = (bullets.content?.paragraphs ?? []) as Paragraph[];
    c.bullets = ps.map((p) => paragraphsToMarkdown([{ ...p, list: undefined }])).filter(Boolean);
  }
  const cta = take('cta'); if (cta) c.cta = text(cta);
  const caption = take('caption'); if (caption) c.caption = text(caption);
  const footer = take('footer'); if (footer) c.footer = text(footer);
  const number = take('number'); if (number) c.number = text(number);
  const qt = take('quote-text');
  if (qt) c.quote = { text: text(qt) ?? '', author: text(take('quote-author'))?.replace(/^—\s*/, ''), role: text(take('quote-role')) };

  // stats: stat-N-value / -label / -text
  const statIdx = new Set<number>();
  slide.elements.forEach((e) => { const m = /^(?:stat|kpi)-(\d+)-value$/.exec(e.id); if (m) statIdx.add(+m[1]); });
  if (statIdx.size) {
    c.stats = [...statIdx].sort((a, b) => a - b).map((i, k) => {
      const prefix = byId.has(`stat-${i}-value`) ? 'stat' : 'kpi';
      return {
        ...(c.stats?.[k] ?? {}),
        value: text(take(`${prefix}-${i}-value`)) ?? '',
        label: text(take(`${prefix}-${i}-label`)) ?? c.stats?.[k]?.label ?? '',
        ...(byId.has(`${prefix}-${i}-text`) ? { text: text(take(`${prefix}-${i}-text`)) } : {}),
      };
    });
  }
  // items from card-N / col-N / step-N / tile-N / feature-N / agenda-N
  const itemIdx = new Map<number, { prefix: string }>();
  slide.elements.forEach((e) => { const m = /^(card|col|step|tile|feature|agenda)-(\d+)-title$/.exec(e.id); if (m) itemIdx.set(+m[2], { prefix: m[1] }); });
  if (itemIdx.size) {
    c.items = [...itemIdx.entries()].sort((a, b) => a[0] - b[0]).map(([i, { prefix }], k) => ({
      ...(c.items?.[k] ?? {}),
      title: text(take(`${prefix}-${i}-title`)) ?? '',
      ...(byId.has(`${prefix}-${i}-text`) ? { text: text(take(`${prefix}-${i}-text`)) } : {}),
      ...(byId.get(`${prefix}-${i}-icon`)?.content?.name ? { icon: byId.get(`${prefix}-${i}-icon`)!.content.name } : {}),
    }));
  }
  // images
  const imgs = slide.elements.filter((e) => e.type === 'image');
  if (imgs.length) {
    const main = take('image') ?? imgs[0];
    used.add(main.id);
    c.image = { ...main.content };
    const rest = imgs.filter((e) => e.id !== main.id && !/^card-\d+-image$/.test(e.id));
    if (rest.length) c.images = rest.map((e) => ({ ...e.content }));
  }
  const chart = slide.elements.find((e) => e.type === 'chart'); if (chart) c.chart = structuredClone(chart.content);
  const table = slide.elements.find((e) => e.type === 'table'); if (table) c.table = structuredClone(table.content);
  const tl = slide.elements.find((e) => e.type === 'timeline'); if (tl) c.timeline = structuredClone(tl.content);
  const dg = slide.elements.find((e) => e.type === 'diagram' || e.type === 'smartart'); if (dg) c.diagram = structuredClone(dg.content);
  const code = slide.elements.find((e) => e.type === 'code'); if (code) c.code = structuredClone(code.content);
  const fm = slide.elements.find((e) => e.type === 'formula'); if (fm) c.formula = structuredClone(fm.content);

  // free-form leftovers: longest unused text → body (never drop text)
  if (!slide.layout) {
    const leftovers = textEls.filter((e) => !used.has(e.id) && e.id !== h?.id);
    if (leftovers.length && !c.body && !c.bullets) {
      const listy = leftovers.find((e) => (e.content?.paragraphs as Paragraph[] | undefined)?.some((p) => p.list));
      if (listy) {
        c.bullets = ((listy.content?.paragraphs ?? []) as Paragraph[]).map((p) => paragraphsToMarkdown([{ ...p, list: undefined }])).filter(Boolean);
        used.add(listy.id);
      }
      const others = leftovers.filter((e) => !used.has(e.id));
      if (others.length) c.body = others.map((e) => md(e)).filter(Boolean).join('\n');
    }
  }
  return c;
}
