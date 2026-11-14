# Sketchy — architecture verification

Date: 2026-11-14
Canvas library checked: Konva 10.9.1 + react-konva 19.3.2 (React 19).

## A. Workflow feasibility: PASS

The required loop can be built in the browser with no paid API and no account.

Open Mindspace, paste an image, select it, open Image Studio, draw independent objects, freeform-crop, return to the board, export a PNG, save a `.sketchy` file, and reopen it with the source, mask, and drawings still editable.

Image Studio drawings, freeform crop, adjustments, `.sketchy` import/export, and Compare are implemented. Adjustments are redrawn from the edit project and are not written into the original file. A flattened PNG is not a project. Compare’s download is a picture of the comparison, not a `.sketchy` file. The file round-trip keeps the mask, the drawings, the adjustments, and the original bytes.

## B. Architecture for each step

| Step | Mechanism |
| --- | --- |
| Mindspace | One Konva stage per board. Camera is `{x, y, scale}` on the stage. Objects are React-Konva groups with stable ids. |
| Paste or drop an image | Decode with `createImageBitmap`. Store the original `Blob` in IndexedDB. Store only `AssetRecord` metadata in the project JSON. |
| Select | Konva hit graph + `Transformer` on unlocked nodes. Shift toggles. Locked nodes stay selectable but are not attached to the transformer. |
| Open Image Studio | The board image holds `assetId` + `imageProjectId`. Studio loads that edit project. The board camera and object position stay on the board object. |
| Draw editable objects | Each mark is a `DrawingObject` in **source-image pixel space**, not a burnt pixel. Konva nodes are a view. Move, resize, recolor, and delete patch one id. |
| Freeform crop | Lasso or polygon is simplified (Ramer–Douglas–Peucker) and stored normalized 0..1. Render clips with canvas `destination-in` / `destination-out`. The asset blob is not rewritten. |
| Preserve source and drawings | Crop writes `mask` only. Drawings stay on the edit project. Duplicate shares `assetId` and clones the edit project. |
| Return to Mindspace | Studio writes a preview blob for fast board paint and leaves `assetId` + edit project in place. The board object does not change id or position. |
| Export PNG | Composite offscreen: original pixels, adjustments, mask, then drawings. Mindspace “View PNG” (already in the app) is only a picture of the current viewport and is labeled as such. |
| Save `.sketchy` | JSZip. `manifest.json` is the project JSON. `assets/{id}` are the original blobs. Previews are optional and disposable. |
| Reopen | Parse + version check, unzip assets, detect missing ids, rebuild object URLs, rehydrate boards and edit projects. |

Host app: TanStack Start on Vite, because this workspace deploys that way. Konva is loaded only in the browser (`import()` after mount) so the server render never touches `window`.

## C. Proposed data structure

`SketchyProject` version 1 (`format: "sketchy"`):

- `boards[]` — camera, ordered objects (rect, ellipse, arrow, pen, text, note, image)
- `assets{}` — metadata only (`mime`, pixel size, byte length, name)
- `imageProjects{}` — `adjustments`, `mask | null`, `drawings[]`
- An image board object points at `assetId` and `imageProjectId`

Ids are `prefix_` + UUID. History stores JSON snapshots (max 80), never blobs. Undo of a board edit restores the previous edit-project JSON; the blob is immutable so it does not need to be in the snapshot.

## D. Image and drawing layer management

Paint order for a final image:

1. Original bitmap (downscaled only for a working copy; the blob stays full size)
2. Adjustment parameters (brightness, contrast, saturation, grayscale, blur, pixelate, rotation, flips) reapplied from the record. Konva filters, if used, run on a clone canvas. They must not write back into the source `HTMLImageElement`.
3. Vector mask
4. Drawing objects in array order

The board shows either the live composite or a cached preview blob. The preview is never the file the editor reopens.

Large images: the board decodes a working bitmap whose longest edge is 560. The asset keeps natural width and height, and the original blob is what Image Studio, Compare, and Save PNG read.

## E. Freeform selection and masking

- Rectangle, lasso, and polygon selections become an `ImageMask`.
- Lasso points are simplified, then stored normalized so a later resize does not warp the crop.
- Modes: `keep`, `remove-outside`, `remove-inside`.
- `pointInPolygon` is the hit test for “is this image pixel selected”.
- Add / subtract / invert are boolean ops on the polygon or on a cached alpha canvas derived from it. The stored source of truth stays the vector mask until the user explicitly converts it.
- Antialiased edges are a derived raster. They are not the editable document.

## F. Project saving and reopening

Working session: IndexedDB database `sketchy`, store `kv` key `session` (project JSON) and store `blobs` keyed by asset id. Restored on load. Camera is included.

Portable file: ZIP via JSZip.

```text
manifest.json
assets/{assetId}
previews/{assetId}.png
settings/export.json
```

`parseProject` rejects unknown object types, a missing board list, and any `version` other than 1. `missingAssetIds` lists ids that the JSON references but the blob set does not contain. A flattened PNG is not accepted as a project (the parser requires `format: "sketchy"`).

## G. Technical risks and limitations

- A curve is a cubic Bézier: start, two controls, and end, stored on the object. The controls bow off the chord. Konva strokes that path. It is not baked into the bitmap.
- Transformer flips are baked with `Math.abs` on width and height so a negative scale does not stick. Explicit flip lives on `adjustments`, not on the board transformer.
- Pinch-zoom is custom. Konva does not ship it.
- Two-finger gestures and one-finger drawing must not scroll the page (`touch-action: none`, `preventDefault` on the wheel).
- History is full JSON snapshots. Fine for vector data. It will get heavy if someone snapshots pixel buffers. Blobs stay outside history.
- Deleting the last use of an image removes that asset from the current project, so a downloaded file does not keep it. Undo snapshots still name the asset, and the blob stays until no snapshot does. A reload does not restore undo, so the bytes are dropped then. A second image that shares the file keeps it.
- “View PNG” exports the viewport, including only what is on screen. “Save PNG” on an image exports that image at its original pixel size. “Save PNG” on a frame exports the artboard at twice its size, including connectors that touch that frame. Neither picture is a project, and neither rewrites the original file.
- IndexedDB can fail in locked-down browsers. The image still shows until reload; the user is told.
- Server-side rendering must never import `react-konva` at module top level.

## H. Architecture corrections

1. **Do not store drawings inside the bitmap.** The first plan of “edit the Konva image node and export” would destroy the source. Rejected.
2. **Do not put the original bytes in the undo stack.**
3. **Do not use the board camera as the image’s crop.** Crop is a mask in image space.
4. **Duplicate shares the asset and clones the edit project** so two boards can diverge without doubling the file.
5. **Undo does not jump the camera or the active board** (`preserveView`). Otherwise every undo would yank the viewport.
6. **App shell stays TanStack Start.** A second Vite app would fight the preview and deploy setup. Konva is a client island inside it.
7. **No accounts, no database rows, no AI.** IndexedDB + a downloaded file only. The platform auth provider stays mounted because the shell requires it; there is no sign-in UI.

## I. Integration tests that prove the workflow

Implemented and passing (model only, no pixels):

- Zoom keeps the world point under the cursor fixed.
- Point-in-polygon, normalized mask round-trip, closed-lasso simplify.
- Scale bakes into width and height without changing color.
- Undo, redo, redo-stack clear, history cap.
- Recolor changes one board object and does not mutate the previous project.
- Insert image → two drawings → recolor one → polygon mask → duplicate (same asset id, different edit project) → recolor original drawing does not recolor the copy → JSON round-trip → missing-asset detection → delete removes edit projects and keeps the asset record.
- `parseProject` rejects a non-Sketchy JSON blob.
- A lasso crop keeps pixels inside the polygon and drops pixels outside. Cut-out inverts that. Setting the mask does not change the asset byte length or the drawings.

Browser, not just the model:

- A lasso crop removed the unselected half of an image on the board, left a drawing in place, and undo restored the original pixels.
- Download `.sketchy`, wipe the browser store, open the file, and reload. The crop and the drawing were still there. A PNG is rejected as a project by the parser.
- Compare: one image showed the original (solid cobalt, no stroke) beside the current view (same cobalt plus the ink stroke). Overlay fade 0 hid the stroke and fade 100 showed it. Two images sat side by side (cobalt with the stroke, solid coral). The downloaded file was a PNG. Asset byte lengths stayed 551.
- Brightness pulled a cobalt image to black in Image Studio. Undo restored cobalt `(35,71,214)` and the ink stroke. Compare’s Original view stayed cobalt while Current was black. Both original blobs stayed 551 bytes.

Not yet run, and not claimed:

- Phone pass on a physical device: one-finger draw, two-finger pan/zoom, no page scroll. A 390px browser layout does not overflow.

Groups, connectors, and frames are in the board model. Grouping does not merge pixels. A connector is a line between two object ids. A frame is a fixed artboard. Image bytes are not rewritten.
