import type { ConditionalCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import { checkConditionsMet } from "../store/condition-engine.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface ConditionalCardProps {
  config: ConditionalCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ConditionalCard(props: ConditionalCardProps) {
  const met = checkConditionsMet(props.config.conditions, props.entities);
  if (!met) return null;
  return (
    <CardRenderer config={props.config.card} entities={props.entities} source={props.source} />
  );
}
