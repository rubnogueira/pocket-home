import type { PocketComponent, RowRenderProps } from "../types/pocket-component.ts";

type RowComponent = PocketComponent<RowRenderProps>;

const registry: Map<string, RowComponent> = new Map();

export function registerRow<T extends RowRenderProps>(
  type: string,
  component: (props: T) => JSX.Element | null,
): void {
  registry.set(type, component as RowComponent);
}

export function getRowComponent(type: string): RowComponent | undefined {
  return registry.get(type);
}
