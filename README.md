<<<<<<< HEAD
# SlideCraft AI

**Code → Slides → Editable PowerPoint**

A professional web application where users paste React presentation code (from ChatGPT, Claude, Gemini, etc.), run it in an isolated environment, navigate slides, visually edit supported elements, and export native editable PPTX files.

This is **not** an AI presentation generator. No AI APIs are integrated.

---

## Status (v0.1 foundation)

### Completed in this vertical slice

| Area | Status |
|------|--------|
| Vite + React 18 + TypeScript scaffold | Done |
| Design tokens (dark SaaS palette) + Tailwind | Done |
| Landing page | Done |
| Dashboard + project create (in-memory) | Done |
| App shell + routing | Done |
| Authoring contract component library | Done |
| Copyable authoring prompt for external AIs | Done (`src/engine/renderer/authoring-contract.md`) |
| Zod Slide Document Model | Done |
| Contract source parser → Slide Document | Done |
| Host-side slide preview from model | Done |
| PPTX export (text, shapes, images) via PptxGenJS | Done |
| Zustand project + editor stores | Done |
| Default demo presentation code | Done |

### Explicitly deferred (by design)

- Monaco editor (textarea placeholder for now)
- Sandpack / iframe isolated runtime + postMessage bridge
- DOM measurement middle-path for arbitrary JSX
- Visual drag/resize editor + properties panel
- IndexedDB persistence
- Animation engine (schema fields reserved)
- Sign-in / Templates / About (labeled future or removed per "no nonfunctional buttons")

### Critical review items addressed

1. **Adoption gap** — Authoring contract + example system prompt for external AIs.
2. **Middle path** — Planned; parser currently supports contract only and clearly errors on bare JSX.
3. **Two-renderer rule** — Host canvas used for fully supported contract slides; iframe path reserved.
4. **Override reconciliation** — Types include `source: contract | measured | model-only | override`.
5. **Spec cleanups** — `SlideLine` / table types added; dependency allowlist defined; animation fields reserved only.
=======
# SlideCraft AI Studio

Turn presentation code written by **any AI** (ChatGPT, Claude, Gemini, DeepSeek, Grok…) into a fully editable, animated deck — then present it on the web or export **native, editable PowerPoint**.

```
Content → any AI + SlideCraft Master Prompt → SlideCraft code → Code Import → edit / animate / present → .pptx · .pdf · images · web
```

No AI API key is required: the whole product works through **Code Import**. Integrated AI providers are optional (server-side keys only).
>>>>>>> origin/master

---

## Quick start

```bash
<<<<<<< HEAD
cd slidecraft-ai
npm install
npm run dev
```

Open http://localhost:5173

1. Click **Get Started** → Dashboard  
2. **New Project** → opens workspace with demo contract code  
3. **Run Code** → slides appear in the right panel  
4. **Export PPTX** → downloads an editable PowerPoint file  

---

## Authoring contract (give this to your AI tool)

See `src/engine/renderer/authoring-contract.md` for the full prompt.

Key rule: use `PresentationDeck`, `Slide`, `SlideText`, `SlideShape`, `SlideImage` with **absolute** `x/y/width/height` props. Slide size is always **1280×720**.

---

## Architecture notes

```
src/
  engine/
    document-model/   # Zod schemas
    renderer/         # Contract components + docs
    slide-parser/     # Source → SlideDocument
  services/export/    # PptxGenJS mapping
  stores/             # Zustand
  features/           # Landing, Dashboard, Workspace
  types/              # Element, Slide, Project
```

**Security (planned):** iframe sandbox without `allow-same-origin` on host origin; postMessage origin checks; ZIP path/size limits; dependency allowlist.

**Units:** 1280×720 px → 13.333×7.5 in; font size `px * 0.75 → pt`.

---

## Next implementation steps

1. Finish `npm install` if still in progress; run `npm run build` and fix TS errors.
2. Add Monaco Editor + multi-file explorer.
3. Sandpack (or self-hosted iframe) runtime + bridge that posts measured elements.
4. Visual selection / drag / properties panel for contract elements.
5. IndexedDB project storage.
6. Compatibility report UI on export.

---

SlideCraft AI is a **code-to-presentation platform**, not an AI presentation generator.
=======
npm install
```

```bash
npm run dev:all        # web on http://localhost:5173 + API on http://localhost:4000
```

Or run them separately: `npm run dev` (web) and `npm run server` (API). The web app is **local-first** — it works fully without the API (projects live in IndexedDB); the API adds accounts, cloud sync, share links, uploads, image-search keys and export/import history.

Production (single service):

```bash
npm run build && NODE_ENV=production JWT_SECRET=$(openssl rand -hex 32) npm start
```

Copy `.env.example` to `.env` to configure MongoDB (`MONGODB_URI`; without it a JSON-file store is used), image providers (Unsplash / Pexels / Pixabay keys — Openverse and Wikimedia work without keys), CORS and JWT.

### Desktop app (Windows)

SlideCraft also ships as a desktop app (Electron). The SlideCraft server runs inside the app on `127.0.0.1`, signs in a local account automatically and stores presentations as files in `%APPDATA%/SlideCraft AI Studio/data` — no MongoDB or internet needed (except online image search and Google Fonts).

```bash
npm run desktop        # run the desktop app in development
npm run dist:win       # build the Windows installer → release/SlideCraft-Setup-<version>.exe
```

Build `dist:win` on Windows (or on Linux with Wine installed). The GitHub Actions workflow `.github/workflows/desktop-windows.yml` builds the installer on `windows-latest` (run it manually or push a `v*` tag). Menu: File (new, open code file, import AI code, data folder), Edit, View (zoom, full screen), Help (Prompt Center, docs, shortcuts). Exports open a Save dialog; presenter view opens in its own window.

### Tests

| Command | What it covers |
|---|---|
| `npm test` | Unit tests: PPTX import (round trip of all samples, python-pptx and LibreOffice decks), parsers (JSON/JS/TSX/HTML/Markdown), Auto Fix, validator, 34 layouts, 15 chart types, 18 diagram kinds, animation timeline, layout assistant, 5 sample decks, PPTX export + post-validation of every element/transition, quality checker, prompt generator & compatibility, backend API (auth, CRUD, versions, sharing, uploads, media proxy security) |
| `npm run test:e2e` | Playwright end-to-end: import → render → edit/drag/inline text → add/duplicate/delete slide → undo/redo → animation & transition → save → reload → present/presenter → export PPTX (opened with python-pptx) → export PDF → Prompt Center download → Auto Fix flow |
| `npm run typecheck` | Frontend + server TypeScript |
| `npm run verify:pptx -- file.pptx` | Inspect an exported deck with python-pptx |

---

## Architecture

```
src/
  types/          schema.ts (zod — source of truth, JSON Schema generated), registry.ts (every supported feature + PowerPoint support level)
  code-parser/    detect, json (jsonc, line mapping), js + tsx (Babel AST static evaluator — nothing executed), html/markdown adapters,
                  components (TSX component library), validate, autofix, normalize, security
  layouts/        Layout Intelligence Engine (34 layouts), content extraction, Smart Layout Assistant
  themes/         18 themes, theme tokens ($primary, $chart1, $heading …)
  slides/         DOM/SVG renderer (one renderer for editor, thumbnails, presenting, PDF/PNG, Morph)
  charts/         scene graph → SVG (web) and → native shapes (PPTX); 15 chart types, diagrams, timelines, infographics, chart-type suggestions
  canvas/         editing canvas: select, drag, resize, rotate, marquee, smart guides, snapping, rulers, zoom/pan, inline rich-text editing
  editor/         editor page, panels (slides, outline, assets, templates, themes, media, layers), properties, assistant, quality, dialogs
  animation/      animation engine (WAAPI), presets, timeline UI, canvas preview
  transitions/    transition engine incl. real Morph (id matching + interpolation), transition panel
  presentation/   player, present / presenter / audience / rehearsal modes
  pptx-export/    PptxGenJS + OOXML post-processing (transitions, Morph, animation timing, gradients, groups), preflight, post-export validation, PDF/PNG/JPEG/SVG/HTML
  quality/        Presentation Quality Checker (score /100)
  prompts/        AI Prompt Center + prompt generator built from the live registries
  media/          image intents → Unsplash/Pexels/Pixabay/Openverse/Wikimedia, media library, icon set
  pages/ code-import/ services/ stores/ hooks/ components/ utils/ samples/
server/           Express + JWT + Mongoose (or file store), presentations/versions/sharing/assets/media proxy/history
```

Key decisions:
- **DOM/SVG renderer instead of Konva/Fabric**: one renderer gives crisp rich text, native SVG charts, CSS-animatable elements (Web Animations API for animations, transitions and Morph) and pixel-identical PDF/PNG output.
- **Scene graph for charts & diagrams**: the same primitives draw the web SVG and generate native PowerPoint shapes, so diagrams stay editable in PowerPoint.
- **Static AST evaluation for JS/TSX**: imported code is parsed with Babel and only literals, constants, templates and `.map()` are folded — no code is executed (no sandbox escape possible).
- **Local-first storage** (IndexedDB) with optional cloud sync: refresh never loses work; Version History is kept locally and on the server.

## The Authoring Contract (schema 1.0)

- Presentation → `schemaVersion, title, theme, aspectRatio, slides[], assets[]…`
- Slide → either **layout mode** (`layout` + `content` slots, the Layout Engine places editable elements) or **absolute mode** (`elements[]` on a 1920×1080 grid), or both.
- 23 element types, animations per element (`entrance / emphasis / exit / motion path`, triggers `onClick / withPrevious / afterPrevious / onEnter / onExit`), 17 transitions incl. **Morph** (same element `id` on consecutive slides).
- Images are **intents** (`query` + `alt`) unless a verified URL is known — never fake URLs.

Full docs in the app: **/docs** (generated from the registries), prompts for external AIs: **/prompts**.

## PowerPoint export — what is real

Native & editable: text (runs, bullets, spacing), shapes (incl. gradients via OOXML), lines/arrows, tables, images (crop/masks), native charts (bar, column, stacked, line, area, pie, donut, scatter, bubble, radar, combo), diagrams/timelines/infographics as native grouped shapes, code blocks, speaker notes, hidden slides, auto-advance.
Transitions are written as `<p:transition>` (Morph as `p159:morph` with a fade fallback; objects named `!!id`). Animations are written as `<p:timing>` trees with real shape ids.
Partial / honest limits (shown in the export report before exporting): waterfall/funnel/histogram/treemap become editable shapes (not chart objects), decorative & 3D visuals and formulas are pictures, some web-only effects are approximated (e.g. Blur In → Fade), `onExit` triggers and transition sounds are web-only. MP4 video export is not implemented. Every exported file is re-opened and validated (ZIP, XML well-formedness, element order, relationships, shape ids, slide count, notes) before it is offered for download.
Verified with python-pptx and LibreOffice in CI-like runs; Microsoft PowerPoint itself was not available in the build environment.

## PowerPoint import (.pptx)

Open an existing deck with **Import → Open PowerPoint (.pptx)**, by dropping a `.pptx` on the Import page or the Dashboard, or in the desktop app with **File → Open PowerPoint file… (Ctrl+Shift+O)**. The importer (`src/pptx-import`, pure TypeScript: JSZip + fast-xml-parser, no server) rebuilds every slide as editable SlideCraft objects and shows a report before anything is saved.

- **Imported natively:** slide size, hidden slides, notes; text boxes and placeholders with layout/master inheritance (position, fonts, sizes, colors, bold/italic/underline, bullets & numbering with levels, alignment, insets, autofit scale, hyperlinks); preset shapes with solid/gradient fills, outlines, shadows, rotation/flip; lines & connectors with arrow heads; pictures (crop, circle/rounded masks, SVG); tables; native charts (bar, column, stacked, line, area, pie, doughnut, scatter, bubble, radar, bar+line combo) with categories, values, series colors, number formats; groups; slide backgrounds (color, gradient, picture); theme colors & fonts; transitions (incl. Morph) and entrance/emphasis/exit/motion-path animations with their triggers; embedded video/audio (< 40 MB); master/layout decorations.
- **Approximated (listed in the report):** freeform shapes → vector graphics (SVG), SmartArt → group of shapes, elbow connectors → straight lines, uncommon transitions/animations → closest effect, merged table cells, 3-D/stock charts, rotated groups, equations → text.
- **Not imported (placeholder + warning, text never dropped silently):** Office 2016 charts (waterfall/treemap/funnel…), EMF/WMF/TIFF pictures, OLE objects without a preview, ink, password-protected files, old binary `.ppt`.

## Security

No user code execution (AST-only), SVG sanitization (DOMPurify), URL allow-listing (blocks `javascript:`, `file:`, html data URIs), upload type sniffing + size limits, server-side SVG/magic-byte validation, SSRF-safe image proxy (private IPs blocked after DNS resolution), helmet, CORS, rate limits, JWT with required secret in production, API keys only on the server.
>>>>>>> origin/master
