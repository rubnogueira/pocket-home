// App chrome icons — MDI raster assets (same icon set as Home Assistant).
import { HA_ICON_ASSETS, NAV_CATEGORY_ICONS, mdiAssetPath } from "./icons/index.ts";

function navIcon(categoryId: string): string | undefined {
  const mdi = NAV_CATEGORY_ICONS[categoryId];
  return mdi ? mdiAssetPath(mdi) : undefined;
}

export const ICONS = {
  home: navIcon("home") ?? HA_ICON_ASSETS["view-dashboard"],
  map: navIcon("map") ?? HA_ICON_ASSETS["map"],
  energy: navIcon("energy") ?? HA_ICON_ASSETS["lightning-bolt"],
  settings: navIcon("settings") ?? HA_ICON_ASSETS["cog"],
  lights: navIcon("lights") ?? HA_ICON_ASSETS["lightbulb"],
  climate: navIcon("climate") ?? HA_ICON_ASSETS["thermostat"],
  security: navIcon("security") ?? HA_ICON_ASSETS["shield"],
  media: navIcon("media") ?? HA_ICON_ASSETS["cast"],
  sun: HA_ICON_ASSETS["white-balance-sunny"],
  menu: HA_ICON_ASSETS["menu"],
  pencil: HA_ICON_ASSETS["pencil"],
  close: HA_ICON_ASSETS["close"],
} as const;

export type IconName = keyof typeof ICONS;
