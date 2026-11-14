import { useMemo, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { PageShell } from '@/components/AppHeader';
import { Badge, cx } from '@/components/ui';
import {
  ANIMATION_EFFECTS, ANIMATION_TRIGGERS, ASPECT_RATIOS, CHART_TYPES, DECOR_KINDS, DIAGRAM_KINDS, EASINGS, ELEMENT_TYPES, INFOGRAPHIC_KINDS,
  SCHEMA_VERSION, SHAPE_IDS, TIMELINE_STYLES, TRANSITIONS, VISUAL3D_KINDS, type SupportLevel,
} from '@/types/registry';
import { LAYOUTS, buildLayout } from '@/layouts/engine';
import { THEMES, getTheme } from '@/themes/themes';
import { COMPONENTS } from '@/code-parser/components';
import { normalizeElement } from '@/code-parser/normalize';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { ICON_NAMES, IconSvg } from '@/media/icons';
import { ELEMENT_CONTENT_DOCS } from '@/prompts/generator';
import { TSX_EXAMPLE } from '@/code-import/examples';
import type { LayoutContent, Presentation } from '@/types/schema';
import { tr, useT } from '@/i18n';

/** Render a translated string: `code` → <C>, [label](/path) → <Link>, **bold** → <b>. */
function rich(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<C key={k++}>{m[1]}</C>);
    else if (m[2] !== undefined) out.push(<Link key={k++} className="text-brand-600 underline" to={m[3]}>{m[2]}</Link>);
    else out.push(<b key={k++}>{m[4]}</b>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
const RP = ({ k, v }: { k: string; v?: Record<string, string | number> }) => <P>{rich(tr(k, v))}</P>;

const TOPICS = [
  ['getting-started', 'Getting started'], ['contract', 'Authoring contract'], ['elements', 'Elements'], ['layouts', 'Layouts'], ['components', 'TSX components'],
  ['animations', 'Animations & transitions'], ['charts', 'Charts & diagrams'], ['themes', 'Themes'], ['media', 'Images & media'], ['export', 'PowerPoint export'],
  ['shortcuts', 'Keyboard shortcuts'], ['faq', 'FAQ'],
] as const;

const CATEGORY_LABEL: Record<string, string> = { entrance: 'Entrance', emphasis: 'Emphasis', exit: 'Exit', motion: 'Motion path' };
const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded-xl bg-ink-950 p-4 font-mono text-[12px] leading-relaxed text-ink-100">{children}</pre>;
const H2 = ({ children }: { children: ReactNode }) => <h2 className="mb-3 mt-8 text-lg font-semibold text-ink-900 first:mt-0 dark:text-white">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-3 text-[14px] leading-relaxed text-ink-600 dark:text-ink-300">{children}</p>;
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-ink-100 dark:border-ink-800">
      <table className="w-full text-[13px]">
        <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-900"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{tr(h)}</th>)}</tr></thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top text-ink-700 dark:text-ink-200">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
const Support = ({ s }: { s: SupportLevel }) => <Badge tone={s === 'supported' ? 'green' : s === 'partial' ? 'amber' : 'red'}>{tr(s === 'supported' ? 'Supported' : s === 'partial' ? 'Partially supported' : 'Unsupported')}</Badge>;
const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[12px] text-ink-800 dark:bg-ink-800 dark:text-ink-100">{children}</code>;

const DEMO: LayoutContent = {
  eyebrow: 'Section', heading: 'Your headline here', subheading: 'A short supporting line', body: 'Body text explains the idea in a sentence or two.',
  bullets: ['First point', 'Second point', 'Third point'], image: { query: 'abstract gradient', alt: 'Image' },
  stats: [{ value: '87%', label: 'Metric one' }, { value: '3.2x', label: 'Metric two' }, { value: '$4M', label: 'Metric three' }],
  items: [{ title: 'Item one', text: 'Short description', icon: 'zap' }, { title: 'Item two', text: 'Short description', icon: 'shield-check' }, { title: 'Item three', text: 'Short description', icon: 'globe' }, { title: 'Item four', text: 'Short description', icon: 'users' }],
  columns: [{ heading: 'Option A', bullets: ['Point', 'Point'] }, { heading: 'Option B', bullets: ['Point', 'Point'] }],
  quote: { text: 'Design is how it works.', author: 'Author' }, chart: { chartType: 'column', categories: ['A', 'B', 'C', 'D'], series: [{ name: 'S', values: [3, 5, 4, 7] }] },
  table: { rows: [['Metric', 'Value'], ['Revenue', '$4M'], ['Users', '12K']], header: true },
  timeline: { orientation: 'horizontal', style: 'milestones', items: [{ date: '2024', title: 'Start' }, { date: '2025', title: 'Grow' }, { date: '2026', title: 'Scale' }] },
  diagram: { kind: 'cycle', items: [{ title: 'Plan' }, { title: 'Do' }, { title: 'Check' }, { title: 'Act' }] }, code: { code: 'const answer = 42;', language: 'ts' },
  before: { heading: 'Before', bullets: ['Slow'] }, after: { heading: 'After', bullets: ['Fast'] }, number: '01', cta: 'Get started', caption: 'Caption', footer: 'Footer',
};

function LayoutPreview({ id, pres }: { id: string; pres: Presentation }) {
  const def = LAYOUTS.find((l) => l.id === id)!;
  const c: LayoutContent = {};
  def.slots.forEach((k) => { if (k in DEMO) (c as Record<string, unknown>)[k] = (DEMO as Record<string, unknown>)[k]; });
  const res = buildLayout(id, c, getTheme(pres.theme), pres.size);
  return <SlideRenderer slide={{ id, elements: res.elements.map((e) => normalizeElement(e)), background: res.background }} presentation={pres} scale={300 / 1920} mode="thumb" />;
}

export default function DocsPage() {
  const t = useT();
  const { topic = 'getting-started' } = useParams();
  const pres = useMemo<Presentation>(() => ({ schemaVersion: SCHEMA_VERSION, id: 'docs', title: 'docs', aspectRatio: '16:9', size: { width: 1920, height: 1080 }, theme: 'modern-corporate', slides: [], assets: [] }), []);
  return (
    <PageShell>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{t('Learning Center')}</div>
          <div className="flex flex-wrap gap-1 lg:flex-col">
            {TOPICS.map(([id, label]) => <NavLink key={id} to={`/docs/${id}`} className={() => cx('rounded-lg px-3 py-1.5 text-[13px]', topic === id ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'text-ink-600 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-900')}>{t(label)}</NavLink>)}
          </div>
        </nav>
        <article className="min-w-0 pb-10" data-testid={`docs-${topic}`}>
          <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">{t(TOPICS.find(([id]) => id === topic)?.[1] ?? 'Documentation')}</h1>
          {topic === 'getting-started' && (
            <>
              <RP k="SlideCraft does not require its own AI. Any AI can write a presentation for you in the SlideCraft Authoring Contract, and SlideCraft turns that code into a fully editable deck." />
              <ol className="mb-6 list-decimal space-y-2 pl-5 text-[14px] text-ink-700 dark:text-ink-200">
                {['Give your content to any AI (ChatGPT, Claude, Gemini, DeepSeek, Grok…) together with the [Master Prompt](/prompts).',
                  'The AI generates presentation code following the Authoring Contract (JSON schema v{v}).',
                  'Copy the whole code block.',
                  'Open [Code Import](/import) and paste it.',
                  'SlideCraft parses and validates structure, images, charts, layouts and effects, then shows a report (with safe Auto Fix).',
                  'Build, then edit every object, add animations and transitions, change themes and layouts, and present.',
                  'Export a native, editable PowerPoint (.pptx) that keeps the supported effects — or PDF/PNG/JPEG/SVG.'].map((x) => <li key={x}>{rich(t(x, { v: SCHEMA_VERSION }))}</li>)}
              </ol>
              <RP k="You can also start from a blank presentation or a template on the home page. Everything is saved locally in your browser automatically; sign in to sync to the cloud and create share links." />
            </>
          )}
          {topic === 'contract' && (
            <>
              <RP k="The official input format is a versioned JSON document. JavaScript objects, React TSX (SlideCraft components), HTML `<section>` slides and Markdown are also accepted and converted to the same JSON. Code is parsed statically — never executed." />
              <H2>{t('Presentation')}</H2>
              <Code>{`{
  "schemaVersion": "${SCHEMA_VERSION}",
  "id": "my-deck", "title": "Title", "description": "", "author": "",
  "aspectRatio": "16:9", "theme": "modern-corporate",
  "globalStyles": { "slideNumbers": true, "footer": "Company", "defaultTransition": { "type": "fade" } },
  "sections": [], "assets": [], "metadata": {},
  "slides": [ ... ]
}`}</Code>
              <RP k="Canvas sizes: {sizes}. Coordinates are pixels, origin at the top-left." v={{ sizes: Object.entries(ASPECT_RATIOS).map(([k, v]) => `${k} → ${v.width}×${v.height}`).join(' · ') }} />
              <H2>Slide</H2>
              <Code>{`{ "id": "unique-slide-id", "title": "", "section": "", "layout": "statistics", "content": { ... },
  "elements": [ ... ], "background": { "type": "color", "color": "$surface" },
  "transition": { "type": "fade", "duration": 700 }, "notes": "Speaker notes", "duration": 8000, "hidden": false,
  "animationPreset": "corporate", "animations": { "heading": [{ "effect": "rise", "trigger": "onEnter" }] } }`}</Code>
              <H2>{t('Two authoring modes')}</H2>
              <RP k="**Layout mode**: set `layout` and fill `content` slots; the Layout Engine produces editable elements (see [Layouts](/docs/layouts)). Animate them with `animationPreset` or `animations` keyed by element id. **Free mode**: give absolute `elements`. Both can be combined on the same slide." />
              <H2>{t('Element')}</H2>
              <Code>{`{ "id": "unique-in-slide", "type": "heading", "x": 120, "y": 96, "width": 1200, "height": 120,
  "rotation": 0, "opacity": 1, "zIndex": 2, "content": { "text": "**Bold** and ==accent==" },
  "style": { "fontSize": 72, "color": "$text" }, "animation": [{ "effect": "fadeIn", "trigger": "onEnter", "duration": 600 }],
  "locked": false, "visible": true }`}</Code>
              <H2>{t('IDs, Morph and multi-part import')}</H2>
              <RP k="Slide ids are unique in the deck; element ids are unique within a slide. Reusing an element id on the next slide (with a `morph` transition on that slide) animates the object between slides. Very long decks may be split into parts: each part is a valid document with `{part}`; paste them one after another (or all at once) in Code Import." v={{ part: '"part": { "index": 1, "total": 3, "presentationId": "id" }' }} />
              <H2>{t('Colors and fonts')}</H2>
              <RP k="Use theme tokens — `$primary $secondary $accent $background $surface $text $textMuted $border $success $warning $danger $chart1…$chart6` and fonts `$heading $body $mono` — so changing the theme recolors the whole deck. Text supports markdown-lite: `**bold**` `*italic*` `==accent==` `[link](url)`, `- ` bullets and `1. ` numbering." />
              <RP k="Download the full JSON Schema from the [Prompt Center](/prompts)." />
            </>
          )}
          {topic === 'elements' && (
            <>
              <RP k="{n} element types. Every element can be moved, resized, rotated, layered, locked and animated in the editor." v={{ n: Object.keys(ELEMENT_TYPES).length }} />
              <Table head={['Type', 'Description', 'content', 'PowerPoint']} rows={(Object.keys(ELEMENT_TYPES) as (keyof typeof ELEMENT_TYPES)[]).map((k) => [<C key="k">{k}</C>, t(ELEMENT_TYPES[k].description), <span key="c" className="font-mono text-[11px]">{ELEMENT_CONTENT_DOCS[k]}</span>, <div key="p" className="space-y-1"><Support s={ELEMENT_TYPES[k].pptx} /><div className="text-[11px] text-ink-400">{t(ELEMENT_TYPES[k].pptxNote)}</div></div>])} />
              <H2>{t('Shapes')}</H2>
              <P>{SHAPE_IDS.map((x) => <C key={x}>{x}</C>).reduce<ReactNode[]>((a, b, i) => (i ? [...a, ' ', b] : [b]), [])}</P>
              <H2>{t('Icons ({n})', { n: ICON_NAMES.length })}</H2>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-10">{ICON_NAMES.map((n) => <div key={n} className="flex flex-col items-center gap-1 rounded-lg p-2 text-center text-[10px] text-ink-500" title={n}><IconSvg name={n} size={22} color="currentColor" /><span className="w-full truncate">{n}</span></div>)}</div>
            </>
          )}
          {topic === 'layouts' && (
            <>
              <RP k="{n} layouts. Use `{code}` with `content` slots; slots not listed for a layout are kept but not displayed (the importer warns). The editor’s Smart Layout Assistant can switch layouts later without losing content." v={{ n: LAYOUTS.length, code: '"layout": "<id>"' }} />
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {LAYOUTS.map((l) => (
                  <div key={l.id} className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
                    <LayoutPreview id={l.id} pres={pres} />
                    <div className="p-3"><div className="flex items-center gap-2"><span className="text-sm font-medium text-ink-900 dark:text-white">{t(l.name)}</span><C>{l.id}</C></div><p className="mt-1 text-xs text-ink-500">{t(l.description)}</p><div className="mt-2 flex flex-wrap gap-1">{l.slots.map((x) => <Badge key={x}>{x}</Badge>)}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
          {topic === 'components' && (
            <>
              <RP k="React TSX sources may use these components (imports are ignored; only static values, constants, template strings and `.map()` are evaluated). Elements without x/y are stacked automatically." />
              <Table head={['Component', 'Kind', 'Description', 'Props']} rows={Object.entries(COMPONENTS).map(([n, d]) => [<C key="n">{`<${n}>`}</C>, d.kind === 'element' ? `→ ${d.type}` : d.kind, d.description, <span key="p" className="text-[12px] text-ink-500">{d.props}</span>])} />
              <H2>{t('Example')}</H2>
              <Code>{TSX_EXAMPLE}</Code>
            </>
          )}
          {topic === 'animations' && (
            <>
              <RP k="Each element has its own animation list. Triggers: {triggers}. Easing: {easings}. Every animation has duration, delay, repeat, direction and order; the editor timeline edits them visually." v={{ triggers: Object.entries(ANIMATION_TRIGGERS).map(([k, v]) => `${k} (${t(v).toLowerCase()})`).join('; '), easings: EASINGS.join(', ') }} />
              <Table head={['Effect', 'Category', 'Directions', 'PowerPoint export']} rows={Object.entries(ANIMATION_EFFECTS).map(([k, v]) => [<span key="k" className="flex flex-col items-start"><C>{k}</C><span className="text-[11px] text-ink-400">{t(v.label)}</span></span>, t(CATEGORY_LABEL[v.category] ?? v.category), 'directions' in v && v.directions ? v.directions.join(', ') : '—', <div key="s" className="space-y-1"><Support s={v.pptx} />{v.ppt && 'note' in v.ppt && v.ppt.note ? <div className="text-[11px] text-ink-400">{t(v.ppt.note)}</div> : null}</div>])} />
              <H2>{t('Transitions')}</H2>
              <Table head={['Transition', 'Directions', 'PowerPoint export']} rows={Object.entries(TRANSITIONS).map(([k, v]) => [<span key="k" className="flex flex-col items-start"><C>{k}</C><span className="text-[11px] text-ink-400">{t(v.label)}</span></span>, 'directions' in v && v.directions ? v.directions.join(', ') : '—', <div key="s" className="space-y-1"><Support s={v.pptx} /><div className="text-[11px] text-ink-400">{t(v.pptxNote)}</div></div>])} />
              <H2>Morph</H2>
              <RP k="Objects with the same id on two consecutive slides are matched; position, size, rotation, opacity and colors are interpolated in the web player. In PowerPoint the objects are named `!!id` and the slide receives a Morph transition (PowerPoint 2019 / Microsoft 365; older versions fall back to Fade)." />
            </>
          )}
          {topic === 'charts' && (
            <>
              <Table head={['Chart type', 'Best for', 'PowerPoint']} rows={Object.entries(CHART_TYPES).map(([k, v]) => [<span key="k" className="flex flex-col items-start"><C>{k}</C><span className="text-[11px] text-ink-400">{t(v.label)}</span></span>, t(v.use), <Support key="s" s={v.pptx} />])} />
              <RP k="Rules: `series[].values.length` must equal `categories.length`; scatter/bubble use `points`; histogram takes raw values; waterfall can mark total bars with `totals`. The importer never pads or changes your numbers." />
              <H2>{t('Diagrams & SmartArt-like graphics')}</H2>
              <Table head={['Kind', 'Description']} rows={Object.entries(DIAGRAM_KINDS).map(([k, v]) => [<C key="k">{k}</C>, t(v)])} />
              <H2>{t('Infographics')}</H2>
              <Table head={['Kind', 'Description']} rows={Object.entries(INFOGRAPHIC_KINDS).map(([k, v]) => [<C key="k">{k}</C>, t(v)])} />
              <RP k="Timeline styles: {a} (horizontal or vertical). Decorative kinds: {b}. 3D-like visuals: {c}." v={{ a: TIMELINE_STYLES.join(', '), b: DECOR_KINDS.join(', '), c: VISUAL3D_KINDS.join(', ') }} />
            </>
          )}
          {topic === 'themes' && (
            <>
              <RP k="Themes control colors, fonts, type scale, spacing, radius, shadows, grid and decoration. Apply a theme to the whole deck or to selected slides; customize colors and fonts in the editor." />
              <Table head={['Theme id', 'Name', 'Mode', 'Fonts', 'Colors']} rows={THEMES.map((th) => [<C key="i">{th.id}</C>, t(th.name), t(th.mode === 'dark' ? 'Dark' : 'Light'), `${th.fonts.heading} / ${th.fonts.body}`, <div key="c" className="flex gap-1">{[th.colors.primary, th.colors.secondary, th.colors.accent, th.colors.background, th.colors.text].map((c, i) => <span key={i} className="h-4 w-4 rounded ring-1 ring-black/10" style={{ background: c }} />)}</div>])} />
            </>
          )}
          {topic === 'media' && (
            <>
              <RP k="Images are given either as a verified URL (`src`) or as an **image intent**: `{example}`. SlideCraft searches licensed sources and picks a result that fits the frame orientation; credits and licenses are stored with the image. If nothing is found (or a URL is broken/blocked) a designed placeholder is shown instead of a random photo, and the QC panel reports it." v={{ example: '{ "query": "aerial view of a solar farm at sunset", "alt": "Solar farm" }' }} />
              <Table head={['Provider', 'Key (server .env)', 'Notes']} rows={[
                ['Unsplash', <C key="u">UNSPLASH_ACCESS_KEY</C>, t('High-quality photos')], ['Pexels', <C key="p">PEXELS_API_KEY</C>, t('Photos')], ['Pixabay', <C key="x">PIXABAY_API_KEY</C>, t('Photos & illustrations')],
                ['Openverse', t('not required'), 'Creative Commons'], ['Wikimedia Commons', t('not required'), t('Free media; license per file')],
              ]} />
              <RP k="Media Library: upload PNG, JPEG, WebP, GIF, SVG (sanitized), MP4/WebM video and MP3/WAV/OGG audio. Files are validated by content, large images are optimized, and uploads are reusable across presentations. Unsafe URLs (javascript:, file:, data:text/html…) are always blocked." />
            </>
          )}
          {topic === 'export' && (
            <>
              <RP k="PowerPoint export creates native objects, not slide images: text → text boxes, shapes → shapes, images → pictures, lines/arrows → lines with arrow heads, tables → tables, most charts → native editable charts, diagrams/timelines/infographics → grouped native shapes, notes → speaker notes. Transitions and animations are written to the slide XML." />
              <Table head={['Feature', 'PowerPoint']} rows={[
                ...Object.entries(ELEMENT_TYPES).map(([k, v]) => [`${t('Element')}: ${k}`, <span key={k} className="flex flex-wrap items-center gap-2"><Support s={v.pptx} /><span className="text-[11px] text-ink-400">{t(v.pptxNote)}</span></span>]),
              ]} />
              <RP k="Honest limitations: blur/backdrop effects, text gradients and some 3D/decorative visuals become pictures; effects without a PowerPoint equivalent are approximated (listed as Partially supported above) and the export dialog warns before exporting. Morph requires PowerPoint 2019 or Microsoft 365. Fonts must be installed on the viewing computer (QC warns about non-standard fonts)." />
              <RP k="Other formats: PDF, PNG, JPEG, SVG per slide or the whole deck." />
            </>
          )}
          {topic === 'shortcuts' && (
            <>
              <H2>{t('Editor')}</H2>
              <Table head={['Shortcut', 'Action']} rows={[
                ['Ctrl+Z', 'Undo'], ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'], ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copy / cut / paste'], ['Ctrl+A', 'Select all objects'], ['Delete / Backspace', 'Delete selection'],
                ['Ctrl+D', 'Duplicate'], ['Ctrl+G', 'Group'], ['Ctrl+Shift+G', 'Ungroup'], ['Arrow keys (Shift = 10px)', 'Nudge'], ['Space + drag', 'Pan the canvas'], ['Ctrl + wheel', 'Zoom'],
                ['Double-click', 'Edit text / chart data / replace image'], ['Esc', 'Finish editing / deselect'], ['Ctrl+S', 'Save a version'], ['F5', 'Present from current slide'],
              ].map((r) => [<C key="k">{t(r[0])}</C>, t(r[1])])} />
              <H2>{t('Presentation mode')}</H2>
              <Table head={['Shortcut', 'Action']} rows={[
                ['→ / Space / PageDown / click', 'Next animation or slide'], ['← / PageUp', 'Previous'], ['Home / End', 'First / last slide'], ['B / W', 'Black / white screen'], ['L', 'Laser pointer'],
                ['T', 'Show timer'], ['P', 'Pause / resume auto-play'], ['F', 'Fullscreen'], ['S', 'Open presenter view'], ['Esc', 'Exit'],
              ].map((r) => [<C key="k">{t(r[0])}</C>, t(r[1])])} />
            </>
          )}
          {topic === 'faq' && (
            <div className="space-y-4">
              {[
                ['Do I need an AI API key?', 'No. SlideCraft works fully with code from any external AI via Code Import. The server can optionally be configured with AI provider keys for future in-app features.'],
                ['Is pasted code executed?', 'Never. JSON is parsed, JS/TSX is read through an AST with a static evaluator (literals, constants, templates, .map), HTML is read through a sanitizing DOM parser.'],
                ['What if the AI made mistakes?', 'The report lists each problem with line/column and path. Auto Fix repairs safe issues (ids, aliases, units, versions) without deleting content or changing numbers.'],
                ['Will my work survive a refresh?', 'Yes — projects auto-save to your browser (IndexedDB) and keep a version history. Signing in syncs them to the server.'],
                ['Why does an image show a placeholder?', 'The URL was broken or blocked, or no image provider is reachable/configured for the search query. Replace it from the Media panel or configure provider keys.'],
                ['Does Morph work in PowerPoint?', 'Yes in PowerPoint 2019 and Microsoft 365 (objects named !!id + p159:morph). Older versions show a fade.'],
                ['How do I switch the interface language?', 'Use the language button (Tiếng Việt / English) in the top bar. Slide content is not translated — it stays exactly as you or the AI wrote it.'],
              ].map(([q, a]) => <div key={q}><h3 className="font-medium text-ink-900 dark:text-white">{t(q)}</h3><P>{t(a)}</P></div>)}
            </div>
          )}
        </article>
      </div>
    </PageShell>
  );
}
