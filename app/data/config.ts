export const CONFIG = {
  /**
   * Live Home Assistant (optional).
   * - `wsUrl` empty: browser dev uses the Bun mock at `/api/ws` (no failed connections).
   * - Set `wsUrl` + `accessToken` to hit a real instance (Profile → Long-Lived Access Tokens).
   */
  homeAssistant: {
    wsUrl: "",
    accessToken: "",
  },
  location: {
    latitude: 38.7223,
    longitude: -9.1393,
    city: "Lisbon",
    country: "Portugal",
  },
  weather: {
    units: "metric" as "metric" | "imperial",
    refreshIntervalSeconds: 900,
  },
  dashboard: {
    title: "Pocket Home",
    showSeconds: true,
    use24Hour: true,
  },
} as const;

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "home", label: "Overview", icon: "H" },
  { id: "map", label: "Map", icon: "M" },
  { id: "energy", label: "Energy", icon: "E" },
  { id: "settings", label: "Settings", icon: "*" },
];
