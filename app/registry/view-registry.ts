import type { PocketComponent } from "../types/pocket-component.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import type { LovelaceViewConfig } from "../types/view.ts";

export interface ViewRenderProps {
  config: LovelaceViewConfig;
  entities: EntityState;
  source: DataSource;
}

type ViewComponent = PocketComponent<ViewRenderProps>;

const registry: Map<string, ViewComponent> = new Map();

export function registerView(type: string, component: ViewComponent): void {
  registry.set(type, component);
}

export function getViewComponent(type: string): ViewComponent | undefined {
  return registry.get(type);
}

export { registry as viewRegistry };
