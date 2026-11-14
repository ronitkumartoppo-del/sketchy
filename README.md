# Sketchy

Be Sketchy.

Sketchy is a browser workspace for arranging images, marking them up, and comparing them. Nothing here requires an account or a paid API. The working copy stays in this browser. A portable `.sketchy` file comes later; a flattened PNG is not that file.

## What works now

- **Mindspace.** Pan and zoom, pen, rectangle, ellipse, arrow, text, sticky note. Select, move, resize, rotate. Recolor, duplicate, lock, reorder, undo, redo. Several boards.
- **Images.** PNG, JPG, and WebP from a file, a drop, or a paste. The original blob is kept. Each image also gets an edit project so markup does not paint over the file.
- **Image Studio.** Open one image from Mindspace (Edit image, or double-click). Pen, rectangle, ellipse, arrow, and text are separate drawings in source-image pixels. Move, resize, rotate, recolor, duplicate, delete, undo. Lasso, polygon, and rectangle crops save a mask only. Keep inside hides the rest of the picture. Cut out punches the shape out. Mindspace shows the mask and the drawings. The imported file is not replaced.
- **Projects.** Download or open a `.sketchy` file. It stores the boards, the masks, the drawings, and the original images. Opening one replaces the session in this browser.
- **This browser.** The session is written to IndexedDB and restored on the next visit.
- **View PNG.** Downloads a picture of the current viewport. The button says so. It is not the editable project.

## Not built yet

Adjustments, Compare, grouping, connectors, and design frames. See [docs/FEASIBILITY.md](docs/FEASIBILITY.md).

## Run

```bash
npm install
npm run dev
```

The dev server listens on port 8080. `npm run typecheck`, `npm test`, and `npm run build` are the checks used for each checkpoint.

## Project file

A `.sketchy` file is a ZIP:

- `manifest.json` — boards, objects, masks, drawings, adjustments
- `assets/` — original images
- `settings/export.json` — when it was saved

Previews are not required. The reader ignores them.
