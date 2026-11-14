# SlideCraft AI Studio — Development Status

_Last updated: 2026-11-12 · Schema 1.0 · Prompt 1.0.0_

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1 Foundation | ✅ | Vite/React/TS + Express server, zod schema + generated JSON Schema, feature registry, parsers (JSON w/ line mapping, JS + TSX via Babel AST static evaluation, HTML, Markdown), validator, Auto Fix, normalizer, multi-part import, renderer |
| 2 Editor | ✅ | Canvas (select, multi-select, marquee, drag, resize, rotate, line endpoints, smart guides, snap to grid/objects, rulers, zoom/pan, inline rich text), slide sidebar (lazy thumbnails, DnD, multi-select, sections, search, hide, star), outline, layers, properties for every element type, undo/redo (120 steps), clipboard, group/ungroup, align/distribute, shortcuts, autosave + versions |
| 3 Design engine | ✅ | 18 themes with tokens, 34 layouts + Smart Layout Assistant (11 actions, previews, apply on confirm), 15 chart types + data editor (Excel/CSV paste, XLSX import, chart-type suggestions), 18 diagram kinds, timelines, 7 infographic kinds, decor & 3D visuals, 251 icons, media search (Unsplash/Pexels/Pixabay/Openverse/Wikimedia), media library |
| 4 Motion engine | ✅ | 38 effects (entrance/emphasis/exit/motion paths), 5 triggers, delay/duration/repeat/easing/direction, timeline (drag delay, resize duration, reorder, play/pause/reset), 8 presets, 17 transitions incl. real Morph, presets/random/consistency tools, presentation modes (normal, presenter, audience, rehearsal) |
| 5 Export engine | ✅ | Native PPTX (PptxGenJS + OOXML post-processing for transitions, Morph, `<p:timing>` animations, gradients, groups), preflight with Supported/Partial/Unsupported report, post-export validation, PDF/PNG/JPEG/SVG/HTML/JSON |
| 6 Completion | ✅ | JWT auth, dashboard, project management (archive/restore/duplicate/rename), version history, share links, export/import history, Quality Checker, AI Prompt Center, docs, tests |

## Verification done

- `npm test`: 173 unit/integration tests passing (frontend engines, export, quality, prompts, backend API).
- `npm run test:e2e`: 4 Playwright flows passing (import → edit → slides → undo/redo → save/reload; present + presenter; PPTX (opened with python-pptx) + PDF export; Prompt Center download + Auto Fix import).
- Exported decks converted with LibreOffice and inspected visually; python-pptx confirms native charts/tables/groups/notes.
- **External-AI test**: the generated Master Prompt was given to an independent AI with raw Vietnamese content (business proposal; university lecture). Both answers imported with 0 errors / 0 warnings and exported valid PPTX (fixtures in `tests/fixtures`, regression test `tests/unit/external-ai.test.ts`). Round 1 revealed that layout slides could not be animated → contract extended with `animationPreset` and `animations` (by element id); round 2 produced 105 animated elements.

## Known limitations / next steps

1. Not yet opened in Microsoft PowerPoint (not available in the build environment). OOXML was validated structurally and with LibreOffice/python-pptx; Morph (`p159:morph`) needs PowerPoint 2019/365 to verify visually.
2. MP4 video export is not implemented (clearly marked in the UI).
3. MongoDB driver is typechecked but was only exercised through the file driver in tests (MongoDB binaries could not be downloaded here).
4. Integrated AI (`/api/ai/generate`) is an architecture stub returning 501; Code Import is the supported path.
5. Real-time collaboration and comments are not implemented (share links are read-only).
6. Text "autoFit: shrink" is validated but not applied dynamically on the web canvas; the quality checker flags overflow instead.
7. Image search requires network access to providers; offline, query images render as designed placeholders and export as editable placeholders with a warning.

## How to resume

```bash
npm install && npm run dev:all
npm test && npm run test:e2e
```
Keep `src/types/registry.ts` as the single source of truth: the validator, editor, exporter, docs and prompts are generated from it; `tests/unit/prompts.test.ts` fails if a registry id is missing from the Master Prompt.
