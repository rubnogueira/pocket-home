import type { FeatureRenderProps, PocketComponent } from "../types/pocket-component.ts";

type FeatureComponent = PocketComponent<FeatureRenderProps>;

const registry: Map<string, FeatureComponent> = new Map();

export function registerFeature<T extends FeatureRenderProps>(
  type: string,
  component: (props: T) => JSX.Element | null,
): void {
  registry.set(type, component as FeatureComponent);
}

export function getFeatureComponent(type: string): FeatureComponent | undefined {
  return registry.get(type);
}
