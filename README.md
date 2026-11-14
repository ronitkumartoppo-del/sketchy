# Sketchy

Be Sketchy.

Sketchy is a browser workspace for arranging images, marking them up, and comparing them. Nothing here requires an account or a paid API. The working copy stays in this browser. Download a `.sketchy` file to take it with you. A flattened PNG is not that file.

## What works now

- **Mindspace.** Pan and zoom, pen, curve, rectangle, ellipse, arrow, text, sticky note. Select, move, resize, rotate. Recolor, duplicate, lock, reorder, undo, redo. Several boards. Group objects so they move together, then ungroup them. Connect draws a line between two objects and follows when they move. Story, Square, and Wide frames are fixed artboards. A shape whose center lands in a frame stays in that frame until you drag it out.
- **Images.** PNG, JPG, and WebP from a file, a drop, or a paste. The original blob is kept. A photo larger than 560px on its long side is shown smaller on the board; Image Studio, Compare, and Save PNG still use the full file. Each image also gets an edit project so markup does not paint over the file. Deleting the last use of an image removes it from the project you download. Undo in the same visit still restores it. After a reload, undo is gone and the unused file bytes are dropped. A copy that still uses the file keeps those bytes.
- **Image Studio.** Open one image from Mindspace (Edit image, or double-click). Pen, curve, rectangle, ellipse, arrow, and text are separate drawings in source-image pixels. Move, resize, rotate, recolor, duplicate, delete, undo. Lasso, polygon, and rectangle crops save a mask only. Keep inside hides the rest of the picture. Cut out punches the shape out. Brightness, contrast, color, blur, pixelate, grayscale, flip, and rotation are a view on top of the file. Mindspace shows the mask, the adjustments, and the drawings. The imported file is not replaced.
- **Projects.** Download or open a `.sketchy` file. It stores the boards, the masks, the drawings, and the original images. Opening one replaces the session in this browser.
- **Compare.** Line up two images from this session, or the original file against the current crop and marks. Side by side, or a fade overlay. Download comparison PNG is a picture, not the editable project. Originals are not rewritten.
- **This browser.** The session is written to IndexedDB and restored on the next visit.
- **View PNG.** Downloads a picture of the current viewport. The button says so. It is not the editable project.
- **Save PNG.** With one image selected, or from Image Studio, downloads that image at its original pixel size: the file, then the adjustments, then the crop, then the drawings. With a frame selected, downloads that frame, the objects inside it, and connectors that touch it. A connector between objects outside the frame is left out. Neither file is the editable project, and neither replaces the original image.

## Not built yet

A pass on a physical phone. The narrow layout is checked in a browser, not on a device. See [docs/FEASIBILITY.md](docs/FEASIBILITY.md).

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
