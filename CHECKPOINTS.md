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
| 8 Compare | Shipped | Side by side and fade overlay. Original versus current, or two session images. Download is `comparison.png`, not a project. Original blobs unchanged. Hash recorded after push. |

Typecheck, production build, and browser QA are recorded in `DEVELOPMENT_LOG.md`.
