/**
 * Lovelace view configs.
 * A dashboard has one or more views (tabs).
 */

import type { LovelaceBadgeConfig } from "./badge.ts";
import type { LovelaceCardConfig } from "./card.ts";
import type { VisibilityCondition } from "./condition.ts";

export type ViewType = "sections" | "masonry" | "panel" | "sidebar";

export interface LovelaceViewSection {
  title?: string;
  type?: string;
  cards?: LovelaceCardConfig[];
  column_span?: number;
  /** Max card columns in this section's grid (default 4, max 10). */
  max_columns?: number;
}

export interface LovelaceViewConfig {
  index?: number;
  title?: string;
  path?: string;
  icon?: string;
  type?: ViewType;
  theme?: string;
  background?: string;
  subview?: boolean;
  back_path?: string;
  max_columns?: number;
  dense_section_placement?: boolean;

  /** Cards in the view (masonry, panel, sidebar view types). */
  cards?: LovelaceCardConfig[];

  /** Sections in the view (sections view type). */
  sections?: LovelaceViewSection[];

  /** Badges shown at the top of the view. */
  badges?: (string | LovelaceBadgeConfig)[];

  visibility?: VisibilityCondition[];
}
