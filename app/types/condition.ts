/**
 * Lovelace visibility conditions.
 * Mirrors home-assistant/frontend `src/panels/lovelace/common/validate-condition.ts`.
 */

export interface BaseCondition {
  condition: string;
}

export interface StateCondition extends BaseCondition {
  condition: "state";
  entity?: string;
  entity_id?: string;
  attribute?: string;
  state?: string | string[];
  state_not?: string | string[];
}

export interface NumericStateCondition extends BaseCondition {
  condition: "numeric_state";
  entity?: string;
  entity_id?: string;
  attribute?: string;
  below?: string | number;
  above?: string | number;
}

export interface ScreenCondition extends BaseCondition {
  condition: "screen";
  media_query?: string;
}

export interface UserCondition extends BaseCondition {
  condition: "user";
  users?: string[];
}

export interface ViewColumnsCondition extends BaseCondition {
  condition: "view_columns";
  min?: number;
  max?: number;
}

export interface LocationCondition extends BaseCondition {
  condition: "location";
  locations?: string[];
}

export interface TimeCondition extends BaseCondition {
  condition: "time";
  after?: string;
  before?: string;
  weekdays?: string[];
}

export interface OrCondition extends BaseCondition {
  condition: "or";
  conditions?: Condition[];
}

export interface AndCondition extends BaseCondition {
  condition: "and";
  conditions?: Condition[];
}

export interface NotCondition extends BaseCondition {
  condition: "not";
  conditions?: Condition[];
}

/** Legacy conditional card condition (no `condition` discriminator). */
export interface LegacyCondition {
  entity?: string;
  state?: string | string[];
  state_not?: string | string[];
}

export type Condition =
  | StateCondition
  | NumericStateCondition
  | ScreenCondition
  | UserCondition
  | ViewColumnsCondition
  | LocationCondition
  | TimeCondition
  | OrCondition
  | AndCondition
  | NotCondition;

/**
 * VisibilityCondition includes both structured conditions and legacy shapes.
 * Used in `visibility` arrays on cards, badges, and views.
 */
export type VisibilityCondition = Condition | LegacyCondition;

export interface ConditionContext {
  max_columns?: number;
  entity_id?: string;
}
