/**
 * HeadingCard — matches Home Assistant heading card rendering.
 *
 * Renders heading text (optional) with icon (optional) and badges (optional).
 * In the HA demo, headings like "Living room" have icon + text + badges on the right.
 */

import { View, Text } from "@pocketjs/framework/components";
import type { HeadingCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import BadgeRenderer from "../renderer/BadgeRenderer.tsx";
import HaIcon from "../icons/HaIcon.tsx";

export interface HeadingCardProps {
  config: HeadingCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function HeadingCard(props: HeadingCardProps) {
  const heading = props.config.heading ?? "";
  const isTitle = (props.config.heading_style ?? "title") === "title";
  const badges = props.config.badges ?? [];
  const iconKey = props.config.icon ?? "";

  const hasText = heading.trim().length > 0;
  const hasIcon = iconKey.length > 0;

  const textClass = isTitle
    ? "text-sm text-slate-300 font-bold"
    : "text-xs text-slate-400 font-bold";

  return (
    <View class="flex-row items-center gap-2 bg-transparent overflow-hidden py-2">
      {/* Icon + heading text */}
      {hasIcon || hasText ? (
        <View class="flex-row items-center gap-1 overflow-hidden">
          {hasIcon ? <HaIcon icon={iconKey} size={18} /> : null}
          {hasText ? (
            <Text class={textClass} style={{ maxLines: 1 }}>
              {heading}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Spacer pushes badges to the right */}
      {badges.length > 0 ? <View class="flex-1" /> : null}

      {/* Badges */}
      {badges.length > 0 ? (
        <View class="flex-row flex-wrap gap-1">
          {badges.map((b, i) => (
            <BadgeRenderer
              key={`hb-${i}`}
              config={b}
              entities={props.entities}
              source={props.source}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
