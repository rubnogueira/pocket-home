/**
 * Condition evaluator — checks visibility conditions.
 * Mirrors home-assistant/frontend validate-condition.ts logic.
 */

import type {
  VisibilityCondition,
  Condition,
  LegacyCondition,
  StateCondition,
  NumericStateCondition,
  ViewColumnsCondition,
  TimeCondition,
  OrCondition,
  AndCondition,
  NotCondition,
  ConditionContext,
} from "../types/condition.ts";
import type { EntityState } from "../types/entity.ts";

export function checkConditionsMet(
  conditions: VisibilityCondition[],
  entities: EntityState,
  context: ConditionContext = {},
): boolean {
  return conditions.every((c) => checkSingleCondition(c, entities, context));
}

function checkSingleCondition(
  c: VisibilityCondition,
  entities: EntityState,
  context: ConditionContext,
): boolean {
  if ("condition" in c) {
    const cond = c as Condition;
    switch (cond.condition) {
      case "state":
        return checkState(cond as StateCondition, entities, context);
      case "numeric_state":
        return checkNumericState(cond as NumericStateCondition, entities, context);
      case "view_columns":
        return checkViewColumns(cond as ViewColumnsCondition, context);
      case "screen":
        return true; // No matchMedia in PocketJS — pass through.
      case "user":
        return true; // No user context in PocketJS — pass through.
      case "time":
        return checkTime(cond as TimeCondition);
      case "or":
        return checkOr(cond as OrCondition, entities, context);
      case "and":
        return checkAnd(cond as AndCondition, entities, context);
      case "not":
        return checkNot(cond as NotCondition, entities, context);
      default:
        return checkState(cond as unknown as StateCondition, entities, context);
    }
  }
  // Legacy condition (no `condition` key).
  return checkLegacy(c as LegacyCondition, entities, context);
}

function resolveEntityId(
  c: { entity?: string; entity_id?: string },
  context: ConditionContext,
): string | undefined {
  return c.entity_id ?? c.entity ?? context.entity_id;
}

function getEntityState(
  entities: EntityState,
  entityId: string | undefined,
  attribute?: string,
): string {
  if (!entityId) return "unknown";
  const e = entities[entityId];
  if (!e) return "unknown";
  if (attribute) {
    const v = e.attributes[attribute];
    return v == null ? "unknown" : String(v);
  }
  return e.state;
}

function checkState(c: StateCondition, entities: EntityState, context: ConditionContext): boolean {
  const eid = resolveEntityId(c, context);
  const state = getEntityState(entities, eid, c.attribute);
  const value = c.state ?? c.state_not;
  if (value === undefined) return false;
  const values = Array.isArray(value) ? value : [value];
  return c.state != null ? values.includes(state) : !values.includes(state);
}

function checkLegacy(
  c: LegacyCondition,
  entities: EntityState,
  context: ConditionContext,
): boolean {
  const eid = c.entity ?? context.entity_id;
  const state = getEntityState(entities, eid);
  const value = c.state ?? c.state_not;
  if (value === undefined) return false;
  const values = Array.isArray(value) ? value : [value];
  return c.state != null ? values.includes(state) : !values.includes(state);
}

function checkNumericState(
  c: NumericStateCondition,
  entities: EntityState,
  context: ConditionContext,
): boolean {
  const eid = resolveEntityId(c, context);
  const raw = getEntityState(entities, eid, c.attribute);
  const num = Number(raw);
  if (isNaN(num)) return false;

  let above = c.above;
  let below = c.below;
  if (typeof above === "string") {
    const s = getEntityState(entities, above);
    above = Number(s);
  }
  if (typeof below === "string") {
    const s = getEntityState(entities, below);
    below = Number(s);
  }

  return (
    (above == null || isNaN(Number(above)) || Number(above) < num) &&
    (below == null || isNaN(Number(below)) || Number(below) > num)
  );
}

function checkViewColumns(c: ViewColumnsCondition, context: ConditionContext): boolean {
  if (!context.max_columns) return true;
  return (
    (c.min == null || context.max_columns >= c.min) &&
    (c.max == null || context.max_columns <= c.max)
  );
}

function checkTime(c: TimeCondition): boolean {
  const now = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();

  if (c.after) {
    const [h, m] = c.after.split(":").map(Number);
    if (hhmm < h * 60 + m) return false;
  }
  if (c.before) {
    const [h, m] = c.before.split(":").map(Number);
    if (hhmm >= h * 60 + m) return false;
  }
  if (c.weekdays?.length) {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const today = days[now.getDay()];
    if (!c.weekdays.includes(today!)) return false;
  }
  return true;
}

function checkOr(c: OrCondition, entities: EntityState, context: ConditionContext): boolean {
  if (!c.conditions?.length) return true;
  return c.conditions.some((sub) =>
    checkSingleCondition(sub as VisibilityCondition, entities, context),
  );
}

function checkAnd(c: AndCondition, entities: EntityState, context: ConditionContext): boolean {
  if (!c.conditions?.length) return true;
  return c.conditions.every((sub) =>
    checkSingleCondition(sub as VisibilityCondition, entities, context),
  );
}

function checkNot(c: NotCondition, entities: EntityState, context: ConditionContext): boolean {
  if (!c.conditions?.length) return true;
  return !c.conditions.every((sub) =>
    checkSingleCondition(sub as VisibilityCondition, entities, context),
  );
}
