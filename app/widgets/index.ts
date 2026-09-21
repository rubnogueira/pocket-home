import ClockWidget from "./ClockWidget.tsx";
import WeatherWidget from "./WeatherWidget.tsx";
import CalendarWidget from "./CalendarWidget.tsx";
import LightsWidget from "./LightsWidget.tsx";
import ClimateWidget from "./ClimateWidget.tsx";
import ScenesWidget from "./ScenesWidget.tsx";
import SecurityWidget from "./SecurityWidget.tsx";
import EnergyWidget from "./EnergyWidget.tsx";
import NotesWidget from "./NotesWidget.tsx";
import MediaWidget from "./MediaWidget.tsx";
import RoomsWidget from "./RoomsWidget.tsx";

export interface WidgetDefinition {
  title: string;
  category: string;
  component: () => any;
}

export const widgetRegistry: Record<string, WidgetDefinition> = {
  clock: { title: "Clock", category: "home", component: ClockWidget },
  weather: { title: "Weather", category: "home", component: WeatherWidget },
  calendar: { title: "Calendar", category: "home", component: CalendarWidget },
  lights: { title: "Lights", category: "lights", component: LightsWidget },
  scenes: { title: "Scenes", category: "lights", component: ScenesWidget },
  rooms: { title: "Rooms", category: "lights", component: RoomsWidget },
  climate: { title: "Climate", category: "climate", component: ClimateWidget },
  security: { title: "Security", category: "security", component: SecurityWidget },
  tasks: { title: "Tasks", category: "security", component: NotesWidget },
  media: { title: "Media", category: "media", component: MediaWidget },
  energy: { title: "Energy", category: "energy", component: EnergyWidget },
};

export interface WidgetLayout {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
}

// ── Per-category layouts ────────────────────────────────────────────────
// Column breakpoints: 6 (≥1100), 4 (≥700), 2 (≥400), 1 (<400).
// `rows` = visible rows at the computed cell height; used to distinguish
// landscape (≤ 4) from portrait orientations on narrow viewports.

export function layoutForCategory(category: string, cols: number, rows: number): WidgetLayout[] {
  if (category === "home") return homeLayout(cols, rows);
  if (category === "lights") return lightsLayout(cols, rows);
  if (category === "climate") return climateLayout(cols, rows);
  if (category === "security") return securityLayout(cols, rows);
  if (category === "media") return mediaLayout(cols, rows);
  if (category === "energy") return energyLayout(cols, rows);

  // Auto-layout for unknown categories
  const ids = Object.entries(widgetRegistry)
    .filter(([, def]) => def.category === category)
    .map(([id]) => id);
  const result: WidgetLayout[] = [];
  let col = 0;
  let row = 0;
  const w = Math.min(cols, 2);
  const h = 2;
  for (const id of ids) {
    if (col + w > cols) {
      col = 0;
      row += h;
    }
    result.push({ id, col, row, w, h });
    col += w;
  }
  return result;
}

// ── Home ─────────────────────────────────────────────────────────────────

function homeLayout(cols: number, rows: number): WidgetLayout[] {
  if (cols >= 6) {
    // 6-col: top row overview, bottom row lists
    return [
      { id: "clock", col: 0, row: 0, w: 2, h: 2 },
      { id: "weather", col: 2, row: 0, w: 2, h: 2 },
      { id: "calendar", col: 4, row: 0, w: 2, h: 2 },
      { id: "rooms", col: 0, row: 2, w: 3, h: 2 },
      { id: "scenes", col: 3, row: 2, w: 3, h: 2 },
    ];
  }
  if (cols >= 4) {
    return [
      { id: "clock", col: 0, row: 0, w: 2, h: 2 },
      { id: "weather", col: 2, row: 0, w: 2, h: 2 },
      { id: "calendar", col: 0, row: 2, w: 2, h: 2 },
      { id: "rooms", col: 2, row: 2, w: 2, h: 2 },
    ];
  }
  if (cols >= 2) {
    if (rows <= 4) {
      // Landscape — two side-by-side, scrolls down
      return [
        { id: "clock", col: 0, row: 0, w: 1, h: 2 },
        { id: "weather", col: 1, row: 0, w: 1, h: 2 },
        { id: "calendar", col: 0, row: 2, w: 1, h: 2 },
        { id: "rooms", col: 1, row: 2, w: 1, h: 2 },
      ];
    }
    // Portrait — full-width cards stacked
    return [
      { id: "clock", col: 0, row: 0, w: 2, h: 2 },
      { id: "weather", col: 0, row: 2, w: 2, h: 2 },
      { id: "calendar", col: 0, row: 4, w: 2, h: 2 },
      { id: "rooms", col: 0, row: 6, w: 2, h: 2 },
    ];
  }
  // 1-col: everything stacks, scroll is expected
  return [
    { id: "clock", col: 0, row: 0, w: 1, h: 2 },
    { id: "weather", col: 0, row: 2, w: 1, h: 2 },
    { id: "calendar", col: 0, row: 4, w: 1, h: 2 },
    { id: "rooms", col: 0, row: 6, w: 1, h: 2 },
  ];
}

// ── Lights ───────────────────────────────────────────────────────────────

function lightsLayout(cols: number, _rows: number): WidgetLayout[] {
  if (cols >= 6) {
    return [
      { id: "lights", col: 0, row: 0, w: 3, h: 4 },
      { id: "scenes", col: 3, row: 0, w: 3, h: 2 },
      { id: "rooms", col: 3, row: 2, w: 3, h: 2 },
    ];
  }
  if (cols >= 4) {
    return [
      { id: "lights", col: 0, row: 0, w: 2, h: 3 },
      { id: "scenes", col: 2, row: 0, w: 2, h: 2 },
      { id: "rooms", col: 2, row: 2, w: 2, h: 2 },
    ];
  }
  if (cols >= 2) {
    return [
      { id: "lights", col: 0, row: 0, w: 2, h: 3 },
      { id: "scenes", col: 0, row: 3, w: 1, h: 2 },
      { id: "rooms", col: 1, row: 3, w: 1, h: 2 },
    ];
  }
  return [
    { id: "lights", col: 0, row: 0, w: 1, h: 3 },
    { id: "scenes", col: 0, row: 3, w: 1, h: 2 },
    { id: "rooms", col: 0, row: 5, w: 1, h: 2 },
  ];
}

// ── Climate ──────────────────────────────────────────────────────────────

function climateLayout(cols: number, _rows: number): WidgetLayout[] {
  if (cols >= 6) return [{ id: "climate", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 4) return [{ id: "climate", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 2) return [{ id: "climate", col: 0, row: 0, w: 2, h: 3 }];
  return [{ id: "climate", col: 0, row: 0, w: 1, h: 3 }];
}

// ── Security ─────────────────────────────────────────────────────────────

function securityLayout(cols: number, _rows: number): WidgetLayout[] {
  if (cols >= 6) {
    return [
      { id: "security", col: 0, row: 0, w: 3, h: 3 },
      { id: "tasks", col: 3, row: 0, w: 3, h: 3 },
    ];
  }
  if (cols >= 4) {
    return [
      { id: "security", col: 0, row: 0, w: 2, h: 3 },
      { id: "tasks", col: 2, row: 0, w: 2, h: 3 },
    ];
  }
  if (cols >= 2) {
    return [
      { id: "security", col: 0, row: 0, w: 2, h: 2 },
      { id: "tasks", col: 0, row: 2, w: 2, h: 2 },
    ];
  }
  return [
    { id: "security", col: 0, row: 0, w: 1, h: 3 },
    { id: "tasks", col: 0, row: 3, w: 1, h: 3 },
  ];
}

// ── Media ────────────────────────────────────────────────────────────────

function mediaLayout(cols: number, _rows: number): WidgetLayout[] {
  if (cols >= 6) return [{ id: "media", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 4) return [{ id: "media", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 2) return [{ id: "media", col: 0, row: 0, w: 2, h: 3 }];
  return [{ id: "media", col: 0, row: 0, w: 1, h: 3 }];
}

// ── Energy ───────────────────────────────────────────────────────────────

function energyLayout(cols: number, _rows: number): WidgetLayout[] {
  if (cols >= 6) return [{ id: "energy", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 4) return [{ id: "energy", col: 0, row: 0, w: 4, h: 3 }];
  if (cols >= 2) return [{ id: "energy", col: 0, row: 0, w: 2, h: 3 }];
  return [{ id: "energy", col: 0, row: 0, w: 1, h: 3 }];
}
