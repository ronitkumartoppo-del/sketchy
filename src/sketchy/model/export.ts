/** Names of pictures. None of these is a .sketchy project. */
export const PICTURE_FILES = {
  view: "sketchy-view.png",
  image: "sketchy-image.png",
  frame: "sketchy-frame.png",
} as const;

/** The saved image uses the original pixel size, not the size of the board object. */
export function imageExportPixels(asset: { width: number; height: number }): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(asset.width)),
    height: Math.max(1, Math.round(asset.height)),
  };
}

/** A frame picture is the artboard, twice as sharp, not the zoomed view on screen. */
export function frameExportPixels(
  frame: { width: number; height: number },
  ratio = 2,
): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(frame.width * ratio)),
    height: Math.max(1, Math.round(frame.height * ratio)),
  };
}
