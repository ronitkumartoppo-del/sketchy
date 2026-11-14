# Checkpoints

Branch: `grok-development`

| Checkpoint | Status | Notes |
| --- | --- | --- |
| 0.0 Repository inspection | Verified | `ronitkumartoppo-del/sketchy` had only the initial README on `main` (`b6e653d`). No existing app code. |
| 0.1 Feasibility | Verified `749f2a8` | PASS. See `docs/FEASIBILITY.md`. Pixel workflow is not claimed. |
| 0.2 Shell | Verified `749f2a8` | Mindspace, Image Studio, Compare, Projects. |
| 0.3 Konva prototype | Verified `749f2a8` | Board objects, transformer, pan/zoom, undo. |
| 1.1 Images, paste, drop | Verified `749f2a8` | Original blob + edit project. Duplicate shares the asset. |
| 1.2 Session restore | Verified `fc39ac0` | IndexedDB `sketchy`. A reload after opening a file restored the crop and the drawing. |
| 1.3 Boards, lock, order, text | Verified `749f2a8` | Groups, connectors, and design frames are not in this checkpoint. |
| 3 Image Studio drawings | Verified `be39876` | Independent drawings in source pixels. Recolor, transform, delete, undo. Mindspace overlays them. Original blob is not replaced. |
| 4 Freeform crop | Verified `f6a24d8` | Lasso, polygon, and rectangle write `mask` only. Keep-inside and cut-out. Drawings stay. Browser check: lasso removed the unselected half and undo restored it. |
| 7 `.sketchy` file | Verified `fc39ac0` | ZIP with `manifest.json` and original blobs. Open replaces the browser session. Round-trip kept the mask, the drawing, and the pixels after a reload. Adjustments are not in this checkpoint. |
| 8 Compare | Verified `4be4340` | Side by side and fade overlay. Original versus current, or two session images. Download is `comparison.png`, not a project. Original blobs unchanged. |
| 9 Adjustments | Verified `00e9491` | Brightness, contrast, color, blur, pixelate, grayscale, flip, and rotation. Drawn after the original and before the mask. The file bytes stay put. |
| 2 Groups, connectors, frames | Verified `a43a09d` | Groups move independent objects together. Connectors follow their ends. Story, Square, and Wide frames keep a fixed size. Image bytes are not rewritten. |
| 8.1 Picture export | Verified `883d3b6` | An image PNG uses the original pixel size. A frame PNG is the artboard at 2×. Neither file is a project. Original bytes stay put. |
| 1.4 Delete and bytes | Verified `bb45e80` | Deleting the last use removes the asset from the project. Undo in the same visit restores it. A reload drops bytes undo can no longer reach. |
| 8.2 Frame connectors | Verified `eace451` | A frame PNG includes connectors that touch that frame. A connector between objects outside it is left out. The picture is still not a project. |
| 3.1 Curves | Verified `26378d2` | Curve (B) on the board and in Image Studio stores a cubic Bézier. The picture is not flattened into the file. |
| 9.1 Board bitmap | Verified `71d40d8` | Photos larger than 560px on the long side are decoded smaller for the board. The stored file, Image Studio, and Save PNG stay full size. |
| 9.2 Pinch | Verified in this commit | Two fingers zoom around their midpoint and cancel a one-finger stroke. One finger does not pinch. A physical phone is still not claimed. |

Typecheck, production build, and browser QA are recorded in `DEVELOPMENT_LOG.md`.
