import type { BadgeRenderProps, PocketComponent } from "../types/pocket-component.ts";

type BadgeComponent = PocketComponent<BadgeRenderProps>;

const registry: Map<string, BadgeComponent> = new Map();

export function registerBadge<T extends BadgeRenderProps>(
  type: string,
  component: (props: T) => JSX.Element | null,
): void {
  registry.set(type, component as BadgeComponent);
}

export function getBadgeComponent(type: string): BadgeComponent | undefined {
  return registry.get(type);
}
