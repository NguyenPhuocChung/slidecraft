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

---

## Quick start

```bash
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
