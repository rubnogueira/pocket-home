/**
 * Lovelace grid/layout options for cards within views.
 * Mirrors home-assistant/frontend `src/panels/lovelace/types.ts`.
 */

export interface LovelaceGridOptions {
  columns?: number | "full";
  rows?: number | "auto";
  max_columns?: number;
  min_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

/** @deprecated Use LovelaceGridOptions instead. */
export interface LovelaceLayoutOptions {
  grid_columns?: number | "full";
  grid_rows?: number | "auto";
  grid_min_columns?: number;
  grid_max_columns?: number;
  grid_min_rows?: number;
  grid_max_rows?: number;
}
