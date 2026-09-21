const DEFAULT_W = 480;
const DEFAULT_H = 272;

export const MIN_CELL_H = 80;
export const MAX_CELL_H = 100;

/**
 * Grid content never exceeds this width. On screens wider than
 * MAX_CONTENT_W the grid is centered horizontally, like Lovelace.
 */
export const MAX_CONTENT_W = 1100;

export interface GridConfig {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  gap: number;
  padding: number;
  /** Horizontal offset to center the grid when viewport > MAX_CONTENT_W. */
  offsetX: number;
}

export function computeGrid(w: number, h: number): GridConfig {
  const isLandscape = w >= h;

  // Center the grid when the viewport exceeds MAX_CONTENT_W.
  const effectiveW = Math.min(w, MAX_CONTENT_W);
  const offsetX = Math.floor((w - effectiveW) / 2);

  let cols: number;
  let padding: number;
  let gap: number;

  if (effectiveW >= 1100) {
    cols = 6;
    padding = 10;
    gap = 6;
  } else if (effectiveW >= 700) {
    cols = 4;
    padding = 8;
    gap = 6;
  } else if (effectiveW >= 400) {
    cols = 2;
    padding = 6;
    gap = 6;
  } else {
    cols = 1;
    padding = 6;
    gap = 6;
  }

  const availW = effectiveW - 2 * padding - (cols - 1) * gap;
  const cellWidth = Math.floor(availW / cols);

  const refRows = isLandscape ? 4 : 6;
  const availH = h - 2 * padding - (refRows - 1) * gap;
  const naturalH = Math.floor(availH / refRows);
  const cellHeight = Math.max(MIN_CELL_H, Math.min(MAX_CELL_H, naturalH));

  const rows = Math.max(1, Math.floor((h - 2 * padding + gap) / (cellHeight + gap)));

  return { cols, rows, cellWidth, cellHeight, gap, padding, offsetX };
}

export function widgetWidth(colSpan: number, grid: GridConfig): number {
  return colSpan * grid.cellWidth + (colSpan - 1) * grid.gap;
}

export function widgetHeight(rowSpan: number, grid: GridConfig): number {
  return rowSpan * grid.cellHeight + (rowSpan - 1) * grid.gap;
}

export function widgetX(col: number, grid: GridConfig): number {
  return grid.offsetX + grid.padding + col * (grid.cellWidth + grid.gap);
}

export function widgetY(row: number, grid: GridConfig): number {
  return grid.padding + row * (grid.cellHeight + grid.gap);
}

/** Total content height for a laid-out widget set (scroll range). */
export function layoutContentHeight(
  layout: readonly { row: number; h: number }[],
  grid: GridConfig,
): number {
  let maxBottom = 0;
  for (const item of layout) {
    const bottom = widgetY(item.row, grid) + widgetHeight(item.h, grid);
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom + grid.padding;
}

export function getViewport(): { w: number; h: number } {
  const ops = (globalThis as any).ui;
  if (ops?.__viewport) return ops.__viewport;
  return { w: DEFAULT_W, h: DEFAULT_H };
}
