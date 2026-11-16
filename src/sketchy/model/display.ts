/** Longest edge used for the picture on the board. The stored file stays full size. */
export const BOARD_EDGE = 560;

export function displayPixelSize(
  width: number,
  height: number,
  maxEdge = BOARD_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height, 1);
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function needsDisplayBitmap(width: number, height: number, maxEdge = BOARD_EDGE): boolean {
  const fitted = displayPixelSize(width, height, maxEdge);
  return fitted.width !== Math.max(1, Math.round(width)) || fitted.height !== Math.max(1, Math.round(height));
}
