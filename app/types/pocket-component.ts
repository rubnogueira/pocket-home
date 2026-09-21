import type { EntityState } from "./entity.ts";
import type { LovelaceCardConfig } from "./card.ts";
import type { LovelaceCardFeatureConfig } from "./feature.ts";
import type { LovelaceBadgeConfig } from "./badge.ts";
import type { LovelaceRowConfig } from "./row.ts";
import type { HassEntity } from "./entity.ts";
import type { DataSource } from "../store/data-source.ts";

/** Functional component type for PocketJS Vue Vapor JSX. */
export type PocketComponent<P> = (props: P) => JSX.Element | null;

export interface CardRenderProps {
  config: LovelaceCardConfig;
  entities: EntityState;
  source: DataSource;
}

export interface FeatureRenderProps {
  config: LovelaceCardFeatureConfig;
  entity: HassEntity | undefined;
  source: DataSource;
}

export interface BadgeRenderProps {
  config: string | LovelaceBadgeConfig;
  entities: EntityState;
  source: DataSource;
}

export interface RowRenderProps {
  config: Exclude<LovelaceRowConfig, string>;
  entities: EntityState;
  source: DataSource;
}
