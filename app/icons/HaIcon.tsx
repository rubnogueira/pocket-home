/**
 * HaIcon — rasterized MDI icon (same names as Home Assistant `mdi:*`).
 */

import { Image } from "@pocketjs/framework/components";
import { computed } from "vue";
import { haIconAssetPath, normalizeIconName } from "./resolve.ts";

export interface HaIconProps {
  /** `mdi:lightbulb`, entity `attributes.icon`, or bare `lightbulb`. */
  icon?: string | null;
  domain?: string;
  deviceClass?: string;
  size?: number;
  class?: string;
  style?: Record<string, number | string>;
}

export default function HaIcon(props: HaIconProps) {
  const size = props.size ?? 20;
  const src = computed(() =>
    haIconAssetPath(props.icon, {
      domain: props.domain,
      deviceClass: props.deviceClass,
    }),
  );
  const hasIcon = computed(() =>
    Boolean(normalizeIconName(props.icon) || props.domain || props.deviceClass),
  );

  if (!hasIcon.value) return null;

  return (
    <Image
      class={props.class}
      src={src.value}
      style={{ width: size, height: size, ...props.style }}
    />
  );
}
