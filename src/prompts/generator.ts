import { ANIMATION_PRESETS } from '@/animation/engine';
/**
 * AI Prompt Center generator. Every list in the prompts below is produced from the
 * live registries (element types, layouts, effects, transitions, themes, icons...),
 * so a prompt can never advertise a feature the website does not support.
 */
import {
  ANIMATION_EFFECTS, ANIMATION_TRIGGERS, ASPECT_RATIOS, CHART_TYPES, DECOR_KINDS, DIAGRAM_KINDS, EASINGS, ELEMENT_TYPES, INFOGRAPHIC_KINDS,
  PROMPT_VERSION, REGISTRY_UPDATED, SCHEMA_VERSION, SHAPE_IDS, TIMELINE_STYLES, TRANSITIONS, VISUAL3D_KINDS,
} from '@/types/registry';
import { presentationJsonSchema } from '@/types/schema';
import { LAYOUTS } from '@/layouts/engine';
import { THEMES } from '@/themes/themes';
import { ICON_NAMES } from '@/media/icons';
import { importPresentation } from '@/code-parser';
import { EXAMPLE_INPUT, EXAMPLE_OUTPUT } from './example';

export type PromptKind = 'master' | 'quick' | 'specialized';
export interface PromptOptions { kind: PromptKind; specialty?: SpecialtyId; language?: string }

/* ------------------------------ element docs ------------------------------ */
/** Content field documentation per element type. Every ELEMENT_TYPES key must be present (unit-tested). */
export const ELEMENT_CONTENT_DOCS: Record<keyof typeof ELEMENT_TYPES, string> = {
  text: '{ "text": "markdown-lite string" }',
  heading: '{ "text": "Title" } — uses the theme heading font',
  paragraph: '{ "text": "Body text" } — uses the theme body font',
  richText: '{ "paragraphs": [{ "runs": [{ "text": "Hi", "bold": true, "color": "$accent" }], "list": "bullet"|"number", "level": 0-4, "align": "left|center|right|justify" }] } or { "text": "..." }',
  image: '{ "src"?: "verified https URL", "query"?: "search intent", "alt": "description", "credit"?, "license"?, "sourceUrl"? } — src OR query is required',
  svg: '{ "markup": "<svg ...>...</svg>" } (scripts/event handlers are stripped)',
  icon: '{ "name": "<icon name from the ICON list>" }',
  shape: `{ "shape": one of SHAPES, "text"?: "markdown-lite label" }`,
  line: '{ "x1", "y1", "x2", "y2" } absolute slide coordinates (x/y/width/height are computed)',
  arrow: '{ "x1", "y1", "x2", "y2" } + style.headEnd / style.headStart',
  table: '{ "rows": [["Header A","Header B"],["1","2"]], "header": true, "firstColumn"?: bool, "columnWidths"?: [2,1], "highlightRows"?: [rowIndex], "caption"? }',
  chart: '{ "chartType": one of CHART TYPES, "categories": [...], "series": [{ "name", "values": [...], "color"?, "type"?: "bar|line|area" (combo), "axis"?: "primary|secondary" }], "title"?, "valuePrefix"?, "valueSuffix"?, "decimals"?, "showLegend"?, "showLabels"?, "showGrid"?, "stacked"?, "smooth"?, "xAxisTitle"?, "yAxisTitle"?, "centerLabel"? (donut), "totals"? (waterfall total bar indexes), "bins"? (histogram), "source"? } — scatter/bubble use series[].points [{x,y,size?,label?}]; histogram uses raw values',
  diagram: '{ "kind": one of DIAGRAM KINDS, "items": [{ "title", "text"?, "icon"?, "value"?, "status"?: "done|active|planned", "children"?: [...] }], "center"?, "direction"?: "horizontal|vertical", "axes"?: { "x", "y" } (matrix), "nodes"/"edges" (flowchart: nodes [{id,label,shape?}], edges [{from,to,label?}]) }',
  timeline: '{ "orientation": "horizontal|vertical", "style": one of TIMELINE STYLES, "items": [{ "date", "title", "text"?, "icon"?, "highlight"? }] }',
  infographic: '{ "kind": one of INFOGRAPHIC KINDS, "items": [{ "label", "value"?, "unit"?, "delta"?, "trend"?: "up|down|flat", "icon"?, "text"?, "progress"?: 0-1, "compare"? }], "columns"?, "total"? (pictogram), "icon"? (pictogram), "labels"? ([A,B] comparisonBars) }',
  formula: '{ "latex": "E = mc^2", "display": true }',
  code: '{ "code": "source", "language": "typescript", "showLineNumbers"?: true, "title"?, "highlightLines"?: [lineNumbers] }',
  video: '{ "src": "https URL to .mp4/.webm or a YouTube link", "poster"?, "autoplay"?, "loop"?, "muted"? }',
  audio: '{ "src": "https URL to .mp3/.wav/.ogg", "autoplay"?, "loop"? }',
  group: '{ "children": [elements with x/y RELATIVE to the group] }',
  smartart: 'same as diagram (SmartArt-style visual)',
  decorative: '{ "kind": one of DECOR KINDS, "colors"?: ["$primary","$accent"] }',
  visual3d: '{ "kind": one of 3D KINDS, "colors"?, "items"?: ["label", ...] (isometricStack/layers/pillars) }',
};

const STYLE_FIELDS = 'fontFamily ("$heading"|"$body"|font name), fontSize (px at 1080p), fontWeight, color, align, verticalAlign (top|middle|bottom), lineHeight, letterSpacing, paragraphSpacing, italic, underline, textTransform, textShadow {x,y,blur,color}, textGradient, padding, fill, gradient {type:"linear"|"radial", angle, stops:[{color,offset 0-1}]}, stroke {color,width,dash:"solid|dash|dot|dashDot"}, radius, shadow {x,y,blur,color}, blur (glass), fit (cover|contain|fill), focalX/focalY (0-1), crop {x,y,width,height fractions}, mask (none|circle|rounded|arch|hexagon|blob|diamond), flipH, flipV, grayscale, brightness, overlay {color,opacity}, headStart/headEnd (none|arrow|triangle|oval|diamond), strokeWidth (icons), palette, variant ("light"|"dark" for code)';

/* ------------------------------- sections ------------------------------- */
const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```';

function metadataBlock(): string {
  return [
    `Prompt Version: ${PROMPT_VERSION}`,
    `Schema Version: ${SCHEMA_VERSION}`,
    `Last Updated: ${REGISTRY_UPDATED}`,
    `Supported Features: ${Object.keys(ELEMENT_TYPES).length} element types, ${LAYOUTS.length} layouts, ${Object.keys(CHART_TYPES).length} chart types, ${Object.keys(DIAGRAM_KINDS).length} diagram kinds, ${Object.keys(ANIMATION_EFFECTS).length} animation effects, ${Object.keys(TRANSITIONS).length} transitions (incl. Morph), ${THEMES.length} themes, ${ICON_NAMES.length} icons.`,
  ].join('\n');
}

function languageLine(language?: string): string {
  if (!language || language === 'auto') return 'Write all slide text, speaker notes and alt text in the SAME language as the user\'s content (keep JSON keys and ids in English).';
  return `Write all slide text, speaker notes and alt text in ${language} (keep JSON keys, ids and enum values in English).`;
}

function contractCore(): string {
  const W = ASPECT_RATIOS['16:9'];
  const layouts = LAYOUTS.map((l) => `- \`${l.id}\` (${l.name}) — ${l.description} Slots: ${l.slots.map((s) => `\`${s}\``).join(', ')}`).join('\n');
  const elements = (Object.keys(ELEMENT_TYPES) as (keyof typeof ELEMENT_TYPES)[]).map((k) => `- \`${k}\` — ${ELEMENT_TYPES[k].description} content: ${ELEMENT_CONTENT_DOCS[k]}`).join('\n');
  const charts = Object.entries(CHART_TYPES).map(([k, v]) => `- \`${k}\` — ${v.use}`).join('\n');
  const diagrams = Object.entries(DIAGRAM_KINDS).map(([k, v]) => `- \`${k}\` — ${v}`).join('\n');
  const infos = Object.entries(INFOGRAPHIC_KINDS).map(([k, v]) => `- \`${k}\` — ${v}`).join('\n');
  const effects = (['entrance', 'emphasis', 'exit', 'motion'] as const).map((cat) => `- ${cat}: ${Object.entries(ANIMATION_EFFECTS).filter(([, v]) => v.category === cat).map(([k, v]) => `\`${k}\`${'directions' in v && v.directions ? ` (direction: ${v.directions.join('|')})` : ''}`).join(', ')}`).join('\n');
  const triggers = Object.entries(ANIMATION_TRIGGERS).map(([k, v]) => `\`${k}\` (${v})`).join('; ');
  const transitions = Object.entries(TRANSITIONS).map(([k, v]) => `\`${k}\`${'directions' in v && v.directions ? ` (direction: ${v.directions.join('|')})` : ''}`).join(', ');
  const themes = THEMES.map((t) => `- \`${t.id}\` — ${t.name} (${t.mode}): ${t.description ?? ''}`).join('\n');
  const ratios = Object.entries(ASPECT_RATIOS).map(([k, v]) => `\`${k}\` = ${v.width}×${v.height}`).join(', ');
  return `## 1. OUTPUT FORMAT (SlideCraft Authoring Contract v${SCHEMA_VERSION})

Return exactly ONE fenced \`\`\`json code block containing ONE JSON document (no prose inside it, no comments, no trailing commas, never truncated). Root object:

${fence('json', `{
  "schemaVersion": "${SCHEMA_VERSION}",
  "id": "kebab-case-id",
  "title": "Presentation title",
  "description": "optional",
  "author": "optional",
  "language": "en",
  "aspectRatio": "16:9",
  "theme": "<theme id>",
  "globalStyles": { "slideNumbers": true, "footer": "optional footer text" },
  "slides": [ /* Slide objects */ ]
}`)}

Aspect ratios and canvas sizes (px): ${ratios}. All coordinates are pixels on that canvas (16:9 → ${W.width}×${W.height}, origin top-left).

### Slide object
\`{ "id" (unique in the deck), "title"?, "section"?, "layout"?, "content"?, "elements"?: [...], "background"?, "transition"?, "notes"?, "duration"? (ms, auto-play), "animationPreset"?, "animations"?, "hidden"? }\`
- Animating layout slides: \`"animationPreset": "<preset id>"\` animates every element in reading order (presets: ${ANIMATION_PRESETS.map((x) => `\`${x.id}\` (${x.description})`).join(', ')}), and/or \`"animations": { "<element id>": [Animation, ...] }\` targets layout-generated ids (\`heading\`, \`subheading\`, \`eyebrow\`, \`body\`, \`bullets\`, \`image\`, \`chart\`, \`table\`, \`timeline\`, \`diagram\`, \`quote-text\`, \`stat-N-value\`, \`card-N-title\`, \`step-N-title\` …; N starts at 1). Give most content slides one of these so the deck has motion.
- Visuals: give roughly one third of the slides a relevant image intent (\`image: { query, alt }\` in hero / imageLeft / imageRight / splitScreen / fullImage / magazine / cinematic / productShowcase, or an \`image\` element). Queries must describe a concrete, photographable subject that matches the slide (e.g. "barista preparing coffee in a busy cafe"), not abstract words.
- background: \`{ "type": "color", "color": "$surface" }\` | \`{ "type": "gradient", "gradient": { "type": "linear", "angle": 135, "stops": [{ "color": "$primary", "offset": 0 }, { "color": "$accent", "offset": 1 }] } }\` | \`{ "type": "image", "image": { "query": "...", "alt": "..." }, "overlay": { "color": "#000000", "opacity": 0.45 } }\`
- transition: \`{ "type": <transition id>, "duration": ms, "direction"?: ... }\`

### Two authoring modes (mix them across the deck)
**A. Layout mode (preferred for most slides)** — set \`"layout"\` and fill \`"content"\` slots; the Layout Engine places everything and produces fully editable elements. Only use the slots a layout lists (others are not shown). Content slots: \`eyebrow, heading, subheading, body (markdown-lite), bullets [string], image {src|query, alt}, images [...], stats [{value,label,text?,trend?}], items [{title,text?,icon?,value?,image?}], columns [{heading?,body?,bullets?,image?}], quote {text,author?,role?}, chart {chart content}, table {table content}, timeline {timeline content}, diagram {diagram content}, code {code content}, formula {latex}, before {heading?,body?,bullets?,image?}, after {...}, cta, footer, number, caption\`.

Layouts (id — purpose — slots):
${layouts}

**B. Free design mode** — \`"elements"\` with absolute positions for custom compositions, Morph and per-element animation. You may also add \`elements\` to a layout slide (they are drawn on top).

### Element object
\`{ "id" (unique within the slide), "type", "x", "y", "width", "height", "rotation"?, "opacity"? (0-1), "zIndex"?, "content", "style"?, "animation"?: [Animation], "locked"?, "visible"?, "link"?, "alt"? }\`

Element types and their \`content\`:
${elements}

SHAPES: ${SHAPE_IDS.map((s) => `\`${s}\``).join(', ')}

CHART TYPES (choose by the nature of the data):
${charts}

DIAGRAM KINDS:
${diagrams}

TIMELINE STYLES: ${TIMELINE_STYLES.map((s) => `\`${s}\``).join(', ')}

INFOGRAPHIC KINDS:
${infos}

DECOR KINDS: ${DECOR_KINDS.map((s) => `\`${s}\``).join(', ')}
3D KINDS: ${VISUAL3D_KINDS.map((s) => `\`${s}\``).join(', ')}

Style fields: ${STYLE_FIELDS}.
Theme tokens (prefer them over hex so theme changes recolor everything): \`$primary $secondary $accent $background $surface $text $textMuted $border $success $warning $danger $chart1 … $chart6\`; fonts \`$heading $body $mono\`.
Markdown-lite inside any text: \`**bold**\`, \`*italic*\`, \`~~strike~~\`, \`\\\`code\\\`\`, \`==accent highlight==\`, \`[label](https://url)\`, lines starting with \`- \` = bullets, \`1. \` = numbered, two leading spaces = nested level, \`\\n\` = new paragraph.

### Animation object (per element; array, played in order)
\`{ "effect", "trigger", "duration" (ms), "delay"? (ms), "direction"?, "easing"?, "repeat"? (number|"infinite"), "order"?, "path"? (motion: { "type": "line|curve|circle|custom", "dx", "dy", "radius", "d": "SVG path relative to the element" }), "scale"?, "opacity"?, "color"? }\`
Effects:
${effects}
Triggers: ${triggers}.
Easings: ${EASINGS.map((e) => `\`${e}\``).join(', ')}.

### Transitions
${transitions}.
Morph: give the SAME element \`id\` (and same type) to objects on two consecutive slides and set \`"transition": { "type": "morph" }\` on the SECOND slide — position, size, rotation, color and opacity are interpolated (exported to PowerPoint 2019/365 Morph).

### Themes (\`theme\` value)
${themes}

### Icons (\`icon\` elements, \`items[].icon\`) — use ONLY these names
${ICON_NAMES.join(', ')}`;
}

function rulesCore(): string {
  return `## 2. HARD RULES
1. Output must be valid JSON for schemaVersion "${SCHEMA_VERSION}" — only properties, ids, enums and component names documented above. Never invent syntax, layouts, effects or element types.
2. Slide ids unique across the deck; element ids unique within a slide (reuse an id on the next slide ONLY for Morph).
3. Images: put a URL in \`src\` ONLY if you are certain it is a real, direct, publicly accessible image file. Otherwise give \`"query"\` (specific search intent: subject + context + style, e.g. "aerial view of solar farm at sunset") and \`"alt"\`. Never fabricate URLs. SlideCraft finds licensed photos from the query.
4. Data: never invent numbers. Charts, stats and tables must use the user's figures exactly (no rounding that changes meaning). \`series[].values.length\` must equal \`categories.length\`. If the user gives no data, do not create a chart — use a text/diagram layout. Illustrative numbers must be explicitly labeled "illustrative" in \`source\`.
5. Keep every piece of information the user provided; do not change meaning. Long content → more slides or speaker notes, never silent deletion.
6. Absolute elements must stay inside the canvas, text boxes must be large enough for their text (≈ fontSize × 1.3 per line), body text ≥ 22px, headings 48–120px.
7. Use only icon names from the list. Use theme tokens for colors where possible.
8. Long decks: if the JSON would exceed your output limit, split into parts — each part is a complete valid document in its own \`\`\`json block with \`"part": { "index": n, "total": N, "presentationId": "same-id" }\`; part 1 carries title, theme and globalStyles; never cut a slide in half. Tell the user to paste all parts into Code Import.
9. Do not wrap the JSON in any other structure, do not add explanations inside the code block.`;
}

function designCore(): string {
  return `## 3. DESIGN THINKING
- First analyse the content: main message, supporting points, data to visualise, ideas that need images, relationships (sequence, comparison, hierarchy, cycle), reading order and density.
- Build a narrative: opening → context/problem → insight/solution → evidence/data → plan → closing with a clear ask. Decide the number of slides from the content (one message per slide).
- Every slide has one clear purpose and one focal point (big number, chart, image or statement). Strong hierarchy: eyebrow → heading → support.
- Vary structure: do not use the same layout on consecutive slides; alternate text-heavy and visual slides; vary title position, image/text ratio and data presentation. Not every slide needs an image, cards or a chart.
- Visualise: comparisons → \`comparison\`/\`beforeAfter\`; sequences → \`process\`/\`timeline\`; numbers → \`statistics\`/\`bigNumber\`/charts; many parallel items → \`cardGrid\`/\`bento\`; cycles/hierarchies → \`infographic\` with a diagram.
- Whitespace: ≤ 6 bullets per slide, ≤ ~40 words of body text per slide; move detail to speaker notes.
- Choose ONE theme that fits the audience and keep the deck consistent.
- Motion with purpose: entrance animations reveal ideas in reading order (onEnter / afterPrevious; onClick for step-by-step talks); emphasis sparingly; transitions mostly subtle (fade, push, wipe), Morph for continuity between related slides.
- Write speaker notes (2–4 sentences) for every content slide.`;
}

function selfCheck(): string {
  return `## 4. SELF-CHECK BEFORE ANSWERING (do it silently, then fix)
[ ] One \`\`\`json block (or several for parts), parseable JSON, schemaVersion "${SCHEMA_VERSION}", no comments/trailing commas, not truncated.
[ ] Every layout id, element type, effect, trigger, transition, theme, shape, chart type, diagram kind and icon name is from the lists above.
[ ] Layout slides only use slots their layout lists.
[ ] Ids unique (slides in deck, elements per slide); Morph pairs share ids on consecutive slides.
[ ] Every chart: categories length = each series values length; numbers come from the user.
[ ] No fabricated image URLs; every image has query or verified src, plus alt.
[ ] All user content is present (slides or notes); no slide is cramped; layouts vary.
[ ] Elements inside the canvas; text boxes tall enough.`;
}

function exampleSection(): string {
  return `## 5. EXAMPLE
Input:
${fence('text', EXAMPLE_INPUT)}
Output:
${fence('json', JSON.stringify(EXAMPLE_OUTPUT, null, 2))}`;
}

const ROLES = 'You are a team of: Senior Presentation Designer, Professional Art Director, UI/UX Presentation Specialist, Data Visualization Expert, Motion Graphics Designer and Presentation Developer.';

/* ----------------------------- specialisations ----------------------------- */
export const SPECIALTIES = {
  lecture: { label: 'Lecture (Bài giảng)', theme: 'education-modern', guide: 'Audience: students. Structure: title → learning objectives (agenda) → prior knowledge hook → concepts one per slide (definition, example, visual) → worked example / formula → check-your-understanding question slide → summary → further reading. Use codeFocus or formula elements for technical subjects, timeline for history, process/cycle diagrams for mechanisms. Reveal points onClick (Educational pacing). Notes: what to say + questions to ask.' },
  businessReport: { label: 'Business report', theme: 'modern-corporate', guide: 'Audience: management. Structure: title → executive summary (statistics) → KPIs (dashboard) → performance vs target (column/combo charts) → highlights & issues (comparison) → initiatives (cardGrid) → risks (swot or matrix) → next steps (process) → decisions needed (closing). Lead each slide with the conclusion as the heading.' },
  thesisDefense: { label: 'Thesis defense (Bảo vệ đồ án)', theme: 'academic-research', guide: 'Audience: examination committee. Structure: title (student, supervisor, institution in body/footer) → agenda → problem & motivation → objectives & scope → related work (tableFocus) → methodology (process/flowchart) → system design/architecture (diagram, codeFocus if relevant) → experiments & results (charts/tables with exact numbers) → evaluation/discussion → limitations → conclusion & future work → thank you / Q&A. Formal tone, cite sources in captions.' },
  pitchDeck: { label: 'Pitch deck', theme: 'startup-pitch', guide: 'Audience: investors. Structure: hook/title → problem (bigNumber) → solution (hero / productShowcase) → how it works (process) → market size (statistics, Morph TAM/SAM/SOM) → business model → traction (dataStory with the user\'s numbers) → competition (comparison) → team (cardGrid) → roadmap (timeline) → the ask (closing). Bold, confident, one number per slide.' },
  marketing: { label: 'Marketing', theme: 'marketing-campaign', guide: 'Audience: marketing/brand stakeholders. Structure: campaign big idea (fullImage) → insight (minimalType / quote) → audience personas (cardGrid) → message & creative (magazine/bento) → channels (iconList infographic) → timeline → KPIs & budget (statistics / donut chart) → closing CTA. Image-led, punchy headlines, Creative Motion presets.' },
  finance: { label: 'Finance', theme: 'financial-report', guide: 'Audience: CFO/board. Structure: title → headline results (statistics) → revenue & margin trend (line/combo) → P&L (tableFocus with exact figures) → bridge (waterfall with totals) → cost breakdown (treemap/donut) → cash & balance sheet → forecast vs budget → risks → outlook. Exact numbers, units in valueSuffix/valuePrefix, sources stated.' },
  technology: { label: 'Technology', theme: 'tech-futuristic', guide: 'Audience: engineers/tech leaders. Structure: title → problem/context → architecture (flowchart or hub diagram) → key components (cardGrid with icons) → code walkthrough (codeFocus) → performance (charts with real benchmarks) → before/after → roadmap → closing. Dark theme, Modern Technology motion, Morph to zoom into architecture parts.' },
  education: { label: 'Education', theme: 'education-modern', guide: 'Audience: learners/teachers. Friendly, clear, high legibility (body ≥ 28px). Structure: welcome → what you will learn → story/example → concepts with visuals → activity/quiz slide (numbered list) → recap (iconList) → resources. Use icons and simple diagrams; reveal step by step.' },
  research: { label: 'Scientific research', theme: 'academic-research', guide: 'Audience: researchers/conference. Structure: title (authors, affiliations) → background → research question/hypothesis → methods (process diagram, formulas) → data & results (charts/tables with exact values, error notes) → discussion → limitations → conclusion → references (body list) → acknowledgments. Cite sources in chart source / captions; never extrapolate data.' },
  projectReport: { label: 'Project report', theme: 'modern-corporate', guide: 'Audience: sponsors/steering committee. Structure: title → status summary (kpiGrid infographic with on-track/at-risk) → scope & objectives → timeline/roadmap with status (done/active/planned) → progress (progressBars) → budget (chart) → risks & issues (matrix) → next milestones (process) → decisions needed. Concise, factual.' },
} as const;
export type SpecialtyId = keyof typeof SPECIALTIES;
export const SPECIALTY_IDS = Object.keys(SPECIALTIES) as SpecialtyId[];

/* --------------------------------- builders --------------------------------- */
export function buildMasterPrompt(language?: string): string {
  return `# SLIDECRAFT AI STUDIO — MASTER PROMPT
${metadataBlock()}

${ROLES}
Your job: read ALL of the content the user provides below (or in following messages), design a complete professional presentation and output it as SlideCraft code that imports directly into SlideCraft AI Studio (web editor + native PowerPoint export).

You must: (1) analyse the whole content; (2) design the structure and decide the number of slides; (3) split content in a logical flow; (4) define the key message of each slide; (5) choose a fitting theme and style; (6) use varied layouts; (7) propose relevant images via search intents; (8) build charts only from real data; (9) create infographics and diagrams; (10) set professional typography; (11) add per-element animations; (12) add slide transitions; (13) use Morph where it adds continuity; (14) write speaker notes; (15) check consistency; (16) output complete code in the exact format below.
${languageLine(language)}

${contractCore()}

${rulesCore()}

${designCore()}

${selfCheck()}

${exampleSection()}

---
Now wait for (or read) the user's content and produce the presentation. If the user content is missing, ask for it in one short sentence instead of inventing a topic.`;
}

export function buildQuickPrompt(language?: string): string {
  const layoutIds = LAYOUTS.map((l) => `${l.id}[${l.slots.join(',')}]`).join('; ');
  return `# SLIDECRAFT — QUICK PROMPT
${metadataBlock()}

Act as a senior presentation designer. Turn my content into a SlideCraft presentation. Output ONLY one \`\`\`json block: { "schemaVersion": "${SCHEMA_VERSION}", "title", "theme", "aspectRatio": "16:9", "slides": [...] }.
${languageLine(language)}
- Slides use "layout" + "content" slots (preferred) or absolute "elements" on a 1920×1080 canvas.
- Layouts[slots]: ${layoutIds}
- Element types: ${Object.keys(ELEMENT_TYPES).join(', ')}. Charts: ${Object.keys(CHART_TYPES).join(', ')}. Diagrams: ${Object.keys(DIAGRAM_KINDS).join(', ')}.
- Animation per element: [{ "effect": ${Object.keys(ANIMATION_EFFECTS).join('|')}, "trigger": ${Object.keys(ANIMATION_TRIGGERS).join('|')}, "duration": ms }]
- Transitions: { "type": ${Object.keys(TRANSITIONS).join('|')} } — Morph = same element id on consecutive slides + morph on the second.
- Themes: ${THEMES.map((t) => t.id).join(', ')}. Colors may use $primary/$accent/$text/$surface tokens.
- Images: { "query": "specific search intent", "alt": "..." } unless you have a verified real URL. Never invent URLs or numbers; series length = categories length.
- Unique slide ids; unique element ids per slide; vary layouts; ≤ 6 bullets; speaker notes on each slide; no comments/trailing commas; never truncate (split into parts with "part": {index,total,presentationId} if too long).`;
}

export function buildSpecializedPrompt(id: SpecialtyId, language?: string): string {
  const s = SPECIALTIES[id];
  return `${buildMasterPrompt(language).replace('# SLIDECRAFT AI STUDIO — MASTER PROMPT', `# SLIDECRAFT AI STUDIO — SPECIALIZED PROMPT: ${s.label.toUpperCase()}`)}

## 6. DOMAIN GUIDANCE — ${s.label}
Recommended theme: \`${s.theme}\` (choose another listed theme only if the content clearly calls for it).
${s.guide}`;
}

export function buildPrompt(o: PromptOptions): string {
  if (o.kind === 'quick') return buildQuickPrompt(o.language);
  if (o.kind === 'specialized') return buildSpecializedPrompt(o.specialty ?? 'pitchDeck', o.language);
  return buildMasterPrompt(o.language);
}

export function schemaAppendix(): string {
  return `# SLIDECRAFT JSON SCHEMA (v${SCHEMA_VERSION})\n\n${fence('json', JSON.stringify(presentationJsonSchema(), null, 2))}`;
}

export function exampleOutputCode(): string {
  return JSON.stringify(EXAMPLE_OUTPUT, null, 2);
}

/* ------------------------------ compatibility ------------------------------ */
export interface CompatibilityResult { ok: boolean; problems: string[]; checked: number; schemaVersion: string; promptVersion: string }

export function checkPromptCompatibility(prompt = buildMasterPrompt()): CompatibilityResult {
  const problems: string[] = [];
  const ids: [string, string[]][] = [
    ['layout', LAYOUTS.map((l) => l.id)],
    ['element type', Object.keys(ELEMENT_TYPES)],
    ['animation effect', Object.keys(ANIMATION_EFFECTS)],
    ['transition', Object.keys(TRANSITIONS)],
    ['chart type', Object.keys(CHART_TYPES)],
    ['diagram kind', Object.keys(DIAGRAM_KINDS)],
    ['theme', THEMES.map((t) => t.id)],
    ['trigger', Object.keys(ANIMATION_TRIGGERS)],
  ];
  let checked = 0;
  for (const [label, list] of ids) for (const id of list) {
    checked++;
    if (!prompt.includes(`\`${id}\``) && !prompt.includes(id)) problems.push(`Prompt does not mention ${label} "${id}"`);
  }
  for (const k of Object.keys(ELEMENT_TYPES)) if (!(k in ELEMENT_CONTENT_DOCS)) problems.push(`No content docs for element type "${k}"`);
  if (!prompt.includes(`Schema Version: ${SCHEMA_VERSION}`)) problems.push('Prompt schema version is not current');
  if (EXAMPLE_OUTPUT.schemaVersion !== SCHEMA_VERSION) problems.push(`Example output uses schemaVersion ${EXAMPLE_OUTPUT.schemaVersion}`);
  const { analysis } = importPresentation(JSON.stringify(EXAMPLE_OUTPUT));
  analysis.report.issues.filter((i) => i.severity === 'error').forEach((i) => problems.push(`Example output error: ${i.message}`));
  // used ids in example must exist
  for (const s of EXAMPLE_OUTPUT.slides as { layout?: string; transition?: { type: string } }[]) {
    if (s.layout && !LAYOUTS.some((l) => l.id === s.layout)) problems.push(`Example uses unknown layout ${s.layout}`);
    if (s.transition && !(s.transition.type in TRANSITIONS)) problems.push(`Example uses unknown transition ${s.transition.type}`);
  }
  return { ok: problems.length === 0, problems, checked, schemaVersion: SCHEMA_VERSION, promptVersion: PROMPT_VERSION };
}

export const SUPPORTED_FEATURES = () => [
  `${Object.keys(ELEMENT_TYPES).length} element types (${Object.values(ELEMENT_TYPES).map((e) => e.label).join(', ')})`,
  `${LAYOUTS.length} smart layouts`,
  `${Object.keys(CHART_TYPES).length} chart types`,
  `${Object.keys(DIAGRAM_KINDS).length} diagram / SmartArt kinds, ${Object.keys(INFOGRAPHIC_KINDS).length} infographic kinds, timelines`,
  `${Object.keys(ANIMATION_EFFECTS).length} animation effects with ${Object.keys(ANIMATION_TRIGGERS).length} triggers and motion paths`,
  `${Object.keys(TRANSITIONS).length} transitions including Morph`,
  `${THEMES.length} themes, ${ICON_NAMES.length} icons, image search intents`,
  'Speaker notes, sections, multi-part import for long decks',
];
