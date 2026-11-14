# Development log

## 2026-11-14 — Phase 0 and Mindspace foundation

Repository `ronitkumartoppo-del/sketchy` inspected. Default branch `main`, one commit `b6e653d` (“Initial commit”), README only. No app source to preserve. Work continues on `grok-development`. Never force-push `main`.

Feasibility: **PASS**, with the corrections in `docs/FEASIBILITY.md`. Konva 10 + react-konva 19 can host independent objects. The non-destructive rule is a separate asset blob plus an image edit project (drawings, mask, adjustments). A flattened PNG is not a project.

Shipped in this checkpoint:

- App shell and paper/ink UI.
- Mindspace board: tools, transformer, pan/zoom, undo/redo, multiple boards, PNG/JPG/WebP import, IndexedDB session.
- Model tests for geometry, history, recolor isolation, mask + drawing preservation, duplicate, and project parse.

Explicitly not shipped: Image Studio UI, freeform crop UI, Compare, `.sketchy` ZIP, groups, connectors, frames.

### Verification

- `npm test` — pass (platform suite and Sketchy model tests).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Browser smoke on the dev server — desktop and mobile rendered, no console errors, no horizontal overflow.
- Interactive check — Rectangle tool, drag on the board, empty state cleared, interior pixels stayed paper (transparent fill), cobalt transformer pixels present, console clean.
- Production build serves the same board. The first automated snapshot caught the “Opening Mindspace…” frame before the canvas module finished loading. A follow-up check showed the canvas, the empty board, and a clean console.
- IndexedDB restore across a reload was implemented but not separately proven in this pass.
- Pixel-level freeform crop, Image Studio, and `.sketchy` round-trip are not claimed.

Canvas apps are treated as game unfurls by the share-card check, so `site.json` includes `type: x:game` and `public/x-banner.jpg`. Sketchy is still a design tool, not a video game.

## Resume

Next checkpoint: freeform crop on the image edit project (`mask` only, original blob stays), or `.sketchy` ZIP once crop is honest. Do not flatten the asset. Branch `grok-development`.

## 2026-11-14 — Image Studio drawings

Pushed Mindspace foundation as `749f2a8` on `grok-development`.

Shipped:

- Image Studio opens one image edit project (Mindspace “Edit image”, double-click, or the studio list).
- Pen, rectangle, ellipse, arrow, and text are `DrawingObject`s in source-image pixels.
- Each drawing can be moved, resized, rotated, recolored, duplicated, and deleted without changing `assets[].byteLength` or dimensions.
- Mindspace draws those marks on top of the original, scaled to the board object. They are not baked into the blob.
- Undo/redo is the same project history.

Not shipped: freeform crop, adjustments, Compare interaction, `.sketchy` ZIP.

### Verification

- `npm test` — pass (197 script tests, 73 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Interactive — uploaded a PNG, drew a rectangle in Image Studio, returned to Mindspace with the mark on the image and the original stripe still visible. Undo restored the previous stroke.
- Production build shows the same empty board after the canvas chunk loads. The first automated snapshot caught “Opening Mindspace…”. A follow-up check showed one canvas and a clean console.
- IndexedDB restore across a reload is still not separately proven.
- Freeform crop and `.sketchy` round-trip are not claimed.

## 2026-11-14 — Freeform crop

Shipped:

- Image Studio lasso, polygon, and rectangle crop. The result is an `ImageMask` in normalized image space (`remove-outside` / `keep`, or `remove-inside`).
- The original asset’s byte length and dimensions are not written. Drawings stay on the edit project and still paint after the mask.
- Mindspace shows the masked bitmap. Clearing the crop or undo restores the full picture.
- Cut-out is the inverse mask. Model tests cover it. The browser pass used keep-inside.

Not shipped: adjustments, Compare, `.sketchy` ZIP.

### Verification

- `npm test` — pass (197 script tests, 76 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Interactive — uploaded a left-cobalt / right-coral PNG, lassoed the left half. Studio pixels: inside stayed `(35,71,214)`, outside became the checker `(231,223,208)`, not coral. Added a rectangle. Mindspace then counted cobalt pixels and zero coral, plus the ink stroke. Two undos restored cobalt and coral in equal counts. Console had no errors.
- IndexedDB reload is still not separately proven.

## 2026-11-14 — .sketchy file

Shipped:

- Projects can download and open a `.sketchy` ZIP: `manifest.json`, `assets/{id}`, `settings/export.json`.
- The archive stores the project JSON and the original blobs. Masks and drawings stay in the manifest.
- Opening a file replaces the session in this browser after a confirm when the board is not empty. A missing image is reported and does not drop the marks. A file without `manifest.json`, or a manifest that is not a Sketchy project, is rejected.
- A PNG is not accepted as a project.

Not shipped: adjustments, Compare, groups, connectors, frames.

### Verification

- Model round-trip — mask, drawing text, and original bytes survive pack/unpack. A ZIP without the blob reports the missing id. A ZIP without a manifest and a non-Sketchy manifest are rejected.
- Browser — downloaded the live session (1 rect, polygon mask, 1659-byte PNG). Deleted IndexedDB. Opened the file into an empty session. Mindspace pixels: cobalt present, coral 0, ink stroke present. Reloaded the page and the same pixels were still there.
- `npm test` — pass (197 script tests, 78 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads.

## 2026-11-14 — Compare

Shipped:

- Compare lines up two images already in the session, or the original file against the current crop and marks on one image.
- Side by side, and an overlay with a fade. Original skips the mask and the drawings. Current paints the mask, then the drawings. The source bitmap is not written.
- Download comparison PNG is a picture named `comparison.png`. It is not a `.sketchy` file.
- At this checkpoint, adjustments were stored but not drawn.

Not shipped: adjustments, groups, connectors, frames. A phone device pass is still not claimed.

### Verification

- Model — listing images does not change the project JSON or asset byte length. One image defaults to original versus current. Two images default to both current. Overlay math goes from A to B. The download name is a PNG.
- Browser — cobalt image, one rectangle in Image Studio. Compare left was solid cobalt `(35,71,214)`. Compare right’s darkest pixel was the ink stroke `(26,22,12)`. Overlay at 0% was only cobalt. Overlay at 100% showed the stroke. After adding coral, the left stayed cobalt plus ink and the right was solid coral `(226,61,43)`. Both blobs stayed 551 bytes. The download began with PNG magic bytes.
- `npm test` — pass (197 script tests, 83 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads. The first automated snapshot caught “Opening Mindspace…”. A follow-up check showed one canvas, the empty board, and a clean console. Compare on that build showed the empty-state copy.

## 2026-11-14 — Adjustments

Shipped:

- Image Studio can change brightness, contrast, color, blur, pixelate, grayscale, flip, and rotation.
- The look is redrawn from those numbers. Paint order is the original bitmap, then the adjustments, then the mask, then the drawings.
- Mindspace and Compare use the same redraw. Compare’s Original view skips it.
- Undo returns the previous look. Reset clears it. The original blob is not rewritten.

Not shipped: groups, connectors, frames. A phone device pass is still not claimed.

### Verification

- Model — a filter string is omitted when the controls are at rest. Setting brightness and a flip does not change `byteLength` or the previous project.
- Browser — brightness at the dark end turned the cobalt picture black (0 cobalt pixels, darkest `(0,0,0)`). Undo restored cobalt `(35,71,214)` and the ink stroke, and the slider returned to 0. Compare Original of that image was cobalt again. Both stored blobs stayed 551 bytes.
- `npm test` — pass (197 script tests, 84 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Phone width — Compare and Image Studio did not widen the page. The Original control was the thing under the tap.

## Resume

Next checkpoint: a physical phone pass, if one is still required. Do not flatten the asset. Do not treat a PNG or a comparison picture as a project. Branch `grok-development`.

## 2026-11-14 — Groups, connectors, and frames

Shipped:

- Group two or more objects that share a parent. They keep their own ids and move with the group. Ungroup puts them back. Delete removes the members. Duplicate copies the members. An image in a group still points at the original blob.
- Connect two objects. The line is derived from their centers, so moving either end moves the line. Deleting an end deletes the connector.
- Story, Square, and Wide frames are fixed artboards. A new shape whose center is inside a frame is parented there. Dragging it out returns it to the board. Frames do not resize to fit their contents.
- Objects in different parents cannot be grouped. That case is a no-op.

Not shipped: a pass on a physical phone.

### Verification

- Model — grouping keeps world centers, a group move shifts both members, ungroup restores board positions, mixed parents are refused, a connector follows a moved end and is removed with that end, duplicating a group that holds an image keeps `byteLength` 40, and deleting the original group does not delete the asset.
- Browser — placed a Story frame, drew a rectangle inside it and an ellipse outside, and connected them. Dragging the ellipse moved the arrow with it. Grouped the ellipse with another rectangle: the dashed group moved down 80 pixels and the connector still met the ellipse. The rectangle inside the frame stayed put. Console had no errors.
- Phone width 390 did not widen the page. The frame, the group, and the tool row were on screen. This was a browser viewport, not a device.
- `npm test` — pass (197 script tests, 88 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads, including the frame, connect, and group hint.

## Resume

Next checkpoint: a physical phone pass, if one is still required. Do not flatten the asset. Do not treat a PNG or a comparison picture as a project. Branch `grok-development`.

## 2026-11-14 — Picture export

Shipped:

- Save PNG on one selected image, and in Image Studio, writes `sketchy-image.png` at the original pixel size. Paint order is the file, then adjustments, then the mask, then the drawings.
- Save PNG on one selected frame writes `sketchy-frame.png` at twice the artboard size. It includes the objects inside the frame. Connectors are not in that picture.
- View PNG is still only the current viewport, named `sketchy-view.png`.
- None of these pictures is a `.sketchy` file. The original blob is not rewritten.

Not shipped: a pass on a physical phone.

### Verification

- Model — an 80×40 asset stays 80×40 even when the board object is larger. A 270×480 frame exports at 540×960. The names are PNG, not `.sketchy`.
- Browser — uploaded an 80×40 PNG (171 bytes). Drew a rectangle in Image Studio. The download was an 80×40 PNG: 1555 cobalt pixels, 1494 coral pixels, 83 ink pixels from the stroke. The stored blob stayed 171 bytes. A Story frame downloaded as 540×960, filled with the paper color `#fffdf8`, and did not include the image sitting outside the frame. Console had no errors.
- `npm test` — pass (197 script tests, 90 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads.

## Resume

Next checkpoint: a physical phone pass, if one is still required. Do not flatten the asset. Do not treat a PNG or a comparison picture as a project. Branch `grok-development`.

## 2026-11-14 — Deleted images leave the project file

Shipped:

- Deleting the last board image that uses a file removes that asset and its edit project from the current document. A downloaded `.sketchy` file is that document, so the deleted image is not in it.
- Undo and redo snapshots still name the asset. The original bytes stay in this browser until no snapshot names them.
- A reload does not restore the undo stack. Bytes that the saved session no longer names are deleted then.
- A second image that shares the file keeps the asset and the bytes.

Not shipped: a pass on a physical phone.

### Verification

- Model — deleting the only image clears the asset. While that older snapshot is still in history, the blob id is not unreachable. After the history cap drops that snapshot, it is. Deleting one of two images that share a file leaves `byteLength` 171.
- Browser — uploaded an 80×40 PNG. Delete left the board empty and the saved session with no assets, and the blob was still stored. Undo put the image back; a pixel read `(35,71,214)`. Delete again, reload, and the blob list was empty. Console had no errors.
- `npm test` — pass (197 script tests, 92 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads.

## Resume

Next checkpoint: a physical phone pass, if one is still required. Do not flatten the asset. Do not treat a PNG or a comparison picture as a project. Branch `grok-development`.

## 2026-11-14 — Frame pictures include connectors that touch the frame

Shipped:

- Save PNG on a frame still writes `sketchy-frame.png` at twice the artboard size.
- A connector is in that picture when at least one end is inside the frame. The line is drawn in the frame's own coordinates, so a rotated frame does not twist it.
- A connector whose ends are both outside the frame is left out.
- The file is still a PNG, not a `.sketchy` project. No image bytes are rewritten.

Not shipped: a pass on a physical phone.

### Verification

- Model — on a frame rotated 90°, the connector between a rectangle and a grouped rectangle lands on their frame-local centers `(20, 25)` and `(40, 10)`. A connector that leaves the frame is included and its outside end is outside the artboard. A connector between two outside objects is omitted.
- Browser — placed a Story frame, drew a rectangle and an ellipse inside it, and connected them. Recolored that connector coral. The download was 540×960 with 2000 coral pixels and no cobalt. Console had no errors.
- `npm test` — pass (197 script tests, 93 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.
- `npm run build` — pass.
- Dev smoke — desktop and mobile, canvas present, no console errors, no horizontal overflow.
- Production build shows the empty board after the canvas chunk loads.

## 2026-11-14 — Curves

Shipped:

- Curve (B) on Mindspace and in Image Studio.
- A drag stores a cubic Bézier: start, two controls bowed off the chord, and end.
- On the board the type is `curve`. In Image Studio the drawing kind is `bezier`, in source pixels.
- Save PNG paints that curve after the photo. The original file is not rewritten.

Not shipped: a pass on a physical phone. Per-anchor handle editing is not a separate mode; the whole curve moves, scales, and rotates with the transformer.

### Verification

- Model — a 120px horizontal drag bows more than 10px off the chord at the midpoint. The object survives `parseProject`.
- `npm test` — pass (197 script tests, 94 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.

## 2026-11-14 — Smaller board bitmaps

Shipped:

- A photo whose longest side is over 560px is decoded with `createImageBitmap({ resizeWidth })` for the board only.
- The asset width, height, and blob stay the original size.
- Image Studio, Compare, and Save PNG keep using that original blob.

Not shipped: a pass on a physical phone.

### Verification

- Model — 2000×1000 becomes 560×280. 80×40 stays 80×40.
- `npm test` — pass (197 script tests, 95 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.

## 2026-11-14 — Two-finger pinch

Shipped:

- Mindspace and Image Studio use the same pinch. Two fingers scale around the midpoint and cancel a stroke that the first finger started.
- A touch moving on the board or the studio does not scroll the page.
- One finger still draws. A physical phone was not used.

### Verification

- Model — one point does not start a pinch. Spreading 100px to 200px doubles the scale, and the world point under the old midpoint stays under the new midpoint.
- `npm test` — pass (197 script tests, 96 TypeScript tests, 0 fail).
- `npx tsc --noEmit` — pass.











