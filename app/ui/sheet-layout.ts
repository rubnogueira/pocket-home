/** Viewports narrower than this use a full-width sheet (matches sidebar breakpoint). */
export const SHEET_FULL_WIDTH_BREAKPOINT = 500;

/**
 * Sheet panel width: full viewport on small screens, capped preferred width on larger.
 */
export function sheetPanelWidth(
  viewportW: number,
  preferredW = 280,
  breakpoint = SHEET_FULL_WIDTH_BREAKPOINT,
): number {
  if (viewportW < breakpoint) return viewportW;
  return Math.min(preferredW, viewportW);
}
