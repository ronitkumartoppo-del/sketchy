# Sketchy

Be Sketchy.

Sketchy is a browser workspace for arranging images, marking them up, and comparing them. Nothing here requires an account or a paid API. The working copy stays in this browser. A portable `.sketchy` file comes later; a flattened PNG is not that file.

## What works now

- **Mindspace.** Pan and zoom, pen, rectangle, ellipse, arrow, text, sticky note. Select, move, resize, rotate. Recolor, duplicate, lock, reorder, undo, redo. Several boards.
- **Images.** PNG, JPG, and WebP from a file, a drop, or a paste. The original blob is kept. Each image also gets an empty edit project so later markup does not paint over the file.
- **This browser.** The session is written to IndexedDB and restored on the next visit.
- **View PNG.** Downloads a picture of the current viewport. The button says so. It is not the editable project.

## Not built yet

Image Studio (drawing on an image, freeform crop, adjustments), Compare, grouping, connectors, design frames, and `.sketchy` import/export. See [docs/FEASIBILITY.md](docs/FEASIBILITY.md).

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run typecheck`, `npm test`, and `npm run build` are the checks used for each checkpoint.

## Project file (planned)

Version 1 JSON inside a ZIP:

- `manifest.json` — boards, objects, masks, drawings, adjustments
- `assets/` — original images
- `previews/` — disposable

The TypeScript model lives in `src/sketchy/model`.
