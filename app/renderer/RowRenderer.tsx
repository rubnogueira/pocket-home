import { View, Text } from "@pocketjs/framework/components";
import type { LovelaceRowConfig, EntityRowConfig } from "../types/row.ts";
import { DOMAIN_TO_ROW_TYPE } from "../types/row.ts";
import type { EntityState } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import { getRowComponent } from "../registry/row-registry.ts";
import type { DataSource } from "../store/data-source.ts";

export interface RowRendererProps {
  config: LovelaceRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function RowRenderer(props: RowRendererProps) {
  // String shorthand → entity row.
  let cfg: EntityRowConfig;
  if (typeof props.config === "string") {
    cfg = { entity: props.config };
  } else {
    cfg = props.config as EntityRowConfig;
  }

  // Determine row type: explicit type or domain-based.
  let rowType = cfg.type;
  if (!rowType && cfg.entity) {
    const domain = entityDomain(cfg.entity);
    const mapped = DOMAIN_TO_ROW_TYPE[domain] ?? DOMAIN_TO_ROW_TYPE["_domain_not_found"];
    rowType = `${mapped}-entity`;
  }
  if (!rowType) rowType = "simple-entity";

  const Comp = getRowComponent(rowType);
  if (!Comp) {
    // Fallback: try simple-entity.
    const Simple = getRowComponent("simple-entity");
    if (Simple) return <Simple config={cfg} entities={props.entities} source={props.source} />;
    return (
      <View class="flex-row items-center px-3 py-2">
        <Text class="text-sm text-slate-400">{cfg.entity ?? rowType}</Text>
      </View>
    );
  }

  return <Comp config={cfg} entities={props.entities} source={props.source} />;
}
