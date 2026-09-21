/**
 * Card registry — maps card type string to PocketJS component.
 * Unknown types fall back to StubCard.
 */

import StubCard from "../cards/StubCard.tsx";
import type { CardRenderProps, PocketComponent } from "../types/pocket-component.ts";

type CardComponent = PocketComponent<CardRenderProps>;

const registry: Map<string, CardComponent> = new Map();

export function registerCard<T extends CardRenderProps>(
  type: string,
  component: (props: T) => JSX.Element | null,
): void {
  registry.set(type, component as CardComponent);
}

export function getCardComponent(type: string): CardComponent {
  return registry.get(type) ?? StubCard;
}

export function hasCard(type: string): boolean {
  return registry.has(type);
}

export { registry as cardRegistry };
