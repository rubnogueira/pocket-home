import { View } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import { isEntityOn } from "../store/entity-store.ts";
import type { DataSource } from "../store/data-source.ts";
import { Switch } from "../ui/index.ts";

export interface ToggleFeatureProps {
  config: { type: "toggle" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function ToggleFeature(props: ToggleFeatureProps) {
  const on = isEntityOn(props.entity);

  function handlePress() {
    if (!props.entity) return;
    const domain = entityDomain(props.entity.entity_id);
    const svcDomain = TOGGLE_DOMAINS.has(domain) ? domain : "homeassistant";
    props.source.callService(svcDomain, "toggle", {}, { entity_id: props.entity.entity_id });
  }

  return (
    <View class="flex-row items-center justify-end px-1">
      <Switch checked={on} onPress={handlePress} />
    </View>
  );
}
