import { View, Text } from "@pocketjs/framework/components";
import { computed } from "vue";
import { getViewport } from "../theme/sizes.ts";
import type { MarkdownCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import {
  HA_FONT_SLOT_SM,
  HA_FONT_SLOT_XS,
  haCardBodyTextMaxWidth,
  wrapTextToLines,
} from "../ui/wrap-text.ts";

export interface MarkdownCardProps {
  config: MarkdownCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function MarkdownCard(props: MarkdownCardProps) {
  const title = props.config.title;
  const content = props.config.content ?? "";

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const textMaxW = computed(() => haCardBodyTextMaxWidth(getViewport().w));

  return (
    <View class="flex-col flex-1 p-3 gap-1 w-full">
      {title ? (
        <Text class="text-sm text-slate-100 font-bold w-full">
          {wrapTextToLines(title, HA_FONT_SLOT_SM, textMaxW.value)}
        </Text>
      ) : null}
      {lines.map((line, i) => {
        const stripped = line.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        const isBold = line.startsWith("**") && line.endsWith("**");
        const isHeading = line.startsWith("# ") || line.startsWith("## ");
        const isLink = /^\[.+\]\(.+\)$/.test(line.trim());
        const text = isHeading ? line.replace(/^#+\s*/, "") : stripped;
        const slot = isBold || isHeading ? HA_FONT_SLOT_SM : HA_FONT_SLOT_XS;
        const wrapped = wrapTextToLines(text, slot, textMaxW.value);

        if (isLink) {
          return (
            <Text key={`md-${i}`} class="text-xs text-blue-400 w-full">
              {wrapped}
            </Text>
          );
        }

        return (
          <Text
            key={`md-${i}`}
            class={
              isBold || isHeading
                ? "text-sm text-slate-100 font-bold w-full"
                : "text-xs text-slate-300 w-full"
            }
          >
            {wrapped}
          </Text>
        );
      })}
    </View>
  );
}
