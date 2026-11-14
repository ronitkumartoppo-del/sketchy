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

