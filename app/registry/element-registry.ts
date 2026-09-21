import type { PocketComponent } from "../types/pocket-component.ts";

type ElementComponent = PocketComponent<Record<string, unknown>>;

const registry: Map<string, ElementComponent> = new Map();

export function registerElement<T extends Record<string, unknown>>(
  type: string,
  component: (props: T) => JSX.Element | null,
): void {
  registry.set(type, component as ElementComponent);
}

export function getElementComponent(type: string): ElementComponent | undefined {
  return registry.get(type);
}
