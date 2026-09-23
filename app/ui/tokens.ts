/** Build-time Tailwind literals for the Pocket Home UI kit (Pocket-native, shadcn-inspired). */
/** PocketJS does not compile `bg-* /opacity` modifiers — use solid palette shades only. */

export const SURFACE_CARD =
  "rounded-xl shadow-lg bg-slate-800 border-slate-700 overflow-hidden flex-col";

/** Inset panel (stat blocks, climate readouts). */
export const SURFACE_INSET = "flex-1 flex-col items-center p-2 rounded-xl bg-slate-800";

/** Settings / form field row background. */
export const SURFACE_FIELD =
  "flex-row items-center justify-between px-3 py-3 rounded-xl bg-slate-800";

/** Compact stat row (system widget). */
export const SURFACE_STAT =
  "flex-row items-center justify-between px-2 py-1 rounded-lg bg-slate-800";

/** Lovelace-style tappable rows (widgets). */
export const ROW_INACTIVE =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";
export const ROW_ACTIVE_AMBER =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-amber-900 focus:bg-amber-800 active:bg-amber-700";
export const ROW_ACTIVE_BLUE =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700";
export const ROW_ACTIVE_EMERALD =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-emerald-900 focus:bg-emerald-800 active:bg-emerald-700";
export const ROW_ACTIVE_RED =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-red-900 focus:bg-red-800 active:bg-red-700";
export const ROW_LOCKED =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";
export const ROW_UNLOCKED =
  "flex-row items-center justify-between px-3 py-2 rounded-xl bg-amber-900 focus:bg-amber-800 active:bg-amber-700";

/** ListItem shells (gap-3, no justify-between). */
export const LIST_ROW_INACTIVE =
  "flex-row items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";
export const LIST_ROW_ACTIVE =
  "flex-row items-center gap-3 px-3 py-2 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-500";
export const LIST_ROW_INACTIVE_STATIC =
  "flex-row items-center gap-3 px-3 py-2 rounded-xl bg-slate-800";
export const LIST_ROW_ACTIVE_STATIC =
  "flex-row items-center gap-3 px-3 py-2 rounded-xl bg-slate-700";

/** Small chips beside rows. */
export const CHIP_INACTIVE = "px-2 py-1 rounded-lg bg-slate-700";
export const CHIP_ACTIVE_AMBER = "px-2 py-1 rounded-lg bg-amber-900";
export const CHIP_ACTIVE_BLUE = "px-2 py-1 rounded-lg bg-blue-900";
export const CHIP_ACTION_BLUE =
  "px-2 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700";

/** Sidebar-style menu rows. */
export const MENU_ROW_ACTIVE =
  "flex-row items-center px-4 py-3 mx-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700";
export const MENU_ROW_INACTIVE =
  "flex-row items-center px-4 py-3 mx-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";

/** Circular / square icon hit targets. */
export const ICON_BTN =
  "w-10 h-10 rounded-xl bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-800";
export const ICON_BTN_ROUND =
  "w-10 h-10 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-800";

/** Accordion / collapsible chrome. */
export const ACCORDION_SECTION = "flex-col rounded-xl bg-slate-800 overflow-hidden";
export const COLLAPSIBLE_SHELL = "flex-col gap-1 rounded-xl bg-slate-800 overflow-hidden";
export const ACCORDION_TRIGGER =
  "flex-row items-center justify-between px-3 py-2 focus:bg-slate-700 active:bg-slate-600";

export const CHECKBOX_ROW =
  "flex-row items-center gap-2 px-1 py-1 rounded-lg focus:bg-slate-800 active:bg-slate-700";

export const RADIO_ITEM_OFF =
  "flex-row items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";
export const RADIO_ITEM_ON =
  "flex-row items-center gap-2 px-3 py-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700";

export const SELECT_ROW =
  "flex-row items-center justify-between px-3 py-3 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600";

export const LOCATION_ROW =
  "px-3 py-2 rounded-xl bg-slate-700 flex-row items-center justify-between";

export const NOTES_ROW_ACTIVE = "flex-row items-center gap-2 px-2 py-1 rounded-xl bg-rose-900";
export const NOTES_ROW_INACTIVE = "flex-row items-center gap-2 px-2 py-1 rounded-xl bg-slate-800";

export const ENERGY_SOLAR = "flex-1 flex-col items-center p-2 rounded-xl bg-emerald-900";
export const ENERGY_GRID = "flex-1 flex-col items-center p-2 rounded-xl bg-blue-900";

export const CARD_BODY = "px-3 py-3 flex-1 flex-col";
export const CARD_BODY_COMPACT = "px-2 py-2 flex-1 flex-col justify-center";

export const SEPARATOR = "h-[1] bg-slate-700";

export const BUTTON_SHELL = {
  default: {
    sm: "px-3 py-2 rounded-xl bg-blue-500 focus:bg-blue-400 active:bg-blue-600",
    md: "px-4 py-2 rounded-xl bg-blue-500 focus:bg-blue-400 active:bg-blue-600",
    lg: "px-5 py-3 rounded-xl bg-blue-500 focus:bg-blue-400 active:bg-blue-600",
  },
  secondary: {
    sm: {
      off: "px-3 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600",
      on: "px-3 py-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700",
    },
    md: {
      off: "px-4 py-2 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600",
      on: "px-4 py-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700",
    },
    lg: {
      off: "px-5 py-3 rounded-xl bg-slate-800 focus:bg-slate-700 active:bg-slate-600",
      on: "px-5 py-3 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700",
    },
  },
  ghost: {
    sm: "px-3 py-2 rounded-xl bg-transparent focus:bg-slate-800 active:bg-slate-700",
    md: "px-4 py-2 rounded-xl bg-transparent focus:bg-slate-800 active:bg-slate-700",
    lg: "px-5 py-3 rounded-xl bg-transparent focus:bg-slate-800 active:bg-slate-700",
  },
  destructive: {
    sm: "px-3 py-2 rounded-xl bg-red-500 focus:bg-red-400 active:bg-red-600",
    md: "px-4 py-2 rounded-xl bg-red-500 focus:bg-red-400 active:bg-red-600",
    lg: "px-5 py-3 rounded-xl bg-red-500 focus:bg-red-400 active:bg-red-600",
  },
  outline: {
    sm: "px-3 py-2 rounded-xl bg-slate-800 border-slate-600 focus:bg-slate-700 active:bg-slate-600",
    md: "px-4 py-2 rounded-xl bg-slate-800 border-slate-600 focus:bg-slate-700 active:bg-slate-600",
    lg: "px-5 py-3 rounded-xl bg-slate-800 border-slate-600 focus:bg-slate-700 active:bg-slate-600",
  },
} as const;

export const BUTTON_LABEL = {
  default: {
    sm: "text-xs text-slate-50 font-bold",
    md: "text-sm text-slate-50 font-bold",
    lg: "text-sm text-slate-50 font-bold",
  },
  secondary: {
    sm: { off: "text-xs text-slate-300", on: "text-xs text-blue-300 font-bold" },
    md: { off: "text-sm text-slate-300", on: "text-sm text-blue-300 font-bold" },
    lg: { off: "text-sm text-slate-300", on: "text-sm text-blue-300 font-bold" },
  },
  ghost: {
    sm: "text-xs text-slate-300 font-bold",
    md: "text-sm text-slate-300 font-bold",
    lg: "text-sm text-slate-300 font-bold",
  },
  destructive: {
    sm: "text-xs text-slate-50 font-bold",
    md: "text-sm text-slate-50 font-bold",
    lg: "text-sm text-slate-50 font-bold",
  },
  outline: {
    sm: "text-xs text-slate-200 font-bold",
    md: "text-sm text-slate-200 font-bold",
    lg: "text-sm text-slate-200 font-bold",
  },
} as const;

export const BADGE_SHELL = {
  default: "px-2 py-1 rounded-xl bg-slate-700",
  success: "px-2 py-1 rounded-xl bg-emerald-900",
  warning: "px-2 py-1 rounded-xl bg-amber-900",
  danger: "px-2 py-1 rounded-xl bg-red-900",
  muted: "px-2 py-1 rounded-xl bg-slate-700",
} as const;

export const BADGE_LABEL = {
  default: "text-xs text-slate-400 font-bold",
  success: "text-xs text-emerald-400 font-bold",
  warning: "text-xs text-amber-400 font-bold",
  danger: "text-xs text-red-400 font-bold",
  muted: "text-xs text-slate-500 font-bold",
} as const;

export const TABS_ROOT = "flex-col gap-3 flex-1";
export const TABS_LIST = "flex-row gap-1 p-1 rounded-xl bg-slate-950";
export const TAB_TRIGGER_ACTIVE =
  "flex-1 px-2 py-2 rounded-lg bg-slate-800 shadow-md focus:bg-slate-700 active:bg-slate-600";
export const TAB_TRIGGER_INACTIVE =
  "flex-1 px-2 py-2 rounded-lg bg-transparent focus:bg-slate-800 active:bg-slate-700";
export const TAB_LABEL_ACTIVE = "text-xs text-slate-50 font-bold text-center";
export const TAB_LABEL_INACTIVE = "text-xs text-slate-400 text-center";
export const TABS_CONTENT = "flex-col gap-2 flex-1";

export const CARD_HEADER = "px-3 py-2 flex-row items-center justify-between";
export const CARD_WIDGET_TITLE = "text-sm text-slate-100 font-bold";
export const CARD_DESCRIPTION = "text-xs text-slate-500";
export const CARD_FOOTER = "px-3 py-2 flex-row items-center gap-2";

export const INPUT_SHELL =
  "flex-row items-center px-3 py-2 rounded-xl bg-slate-950 border-slate-600 focus:bg-slate-900 active:bg-slate-900";
export const INPUT_TEXT = "text-sm text-slate-100 flex-1";
export const INPUT_PLACEHOLDER = "text-sm text-slate-500 flex-1";
export const TEXTAREA_SHELL =
  "flex-col px-3 py-2 rounded-xl bg-slate-950 border-slate-600 min-h-[72]";

export const LABEL_TEXT = "text-sm text-slate-300 font-bold";

export const ALERT_SHELL = {
  default: "flex-col gap-1 px-3 py-2 rounded-xl bg-slate-800 border-slate-600",
  success: "flex-col gap-1 px-3 py-2 rounded-xl bg-emerald-950 border-emerald-700",
  warning: "flex-col gap-1 px-3 py-2 rounded-xl bg-amber-950 border-amber-700",
  destructive: "flex-col gap-1 px-3 py-2 rounded-xl bg-red-950 border-red-700",
} as const;

export const ALERT_TITLE = {
  default: "text-sm text-slate-100 font-bold",
  success: "text-sm text-emerald-300 font-bold",
  warning: "text-sm text-amber-300 font-bold",
  destructive: "text-sm text-red-300 font-bold",
} as const;

export const ALERT_DESC = "text-xs text-slate-400";

export const AVATAR_SHELL = "w-8 h-8 rounded-full bg-slate-700 items-center justify-center";
export const AVATAR_TEXT = "text-xs text-slate-200 font-bold";

export const CHECKBOX_OFF =
  "w-4 h-4 rounded-md bg-slate-800 border-slate-600 items-center justify-center";
export const CHECKBOX_ON =
  "w-4 h-4 rounded-md bg-blue-500 border-blue-400 items-center justify-center";

export const PROGRESS_TRACK = "h-2 rounded-xl bg-slate-700 flex-1 flex-row";
export const PROGRESS_FILL = "h-2 rounded-xl bg-blue-500";

export const SKELETON = "rounded-xl bg-slate-700";

export const SWITCH_ON =
  "w-11 h-6 rounded-xl bg-blue-500 px-1 items-center flex-row justify-end focus:bg-blue-400 active:bg-blue-600";
export const SWITCH_OFF =
  "w-11 h-6 rounded-xl bg-slate-600 px-1 items-center flex-row justify-start focus:bg-slate-500 active:bg-slate-700";
export const SWITCH_THUMB = "w-4 h-4 rounded-full bg-white";

export const TOGGLE_OFF =
  "px-3 py-2 rounded-xl bg-slate-800 border-slate-600 focus:bg-slate-700 active:bg-slate-600";
export const TOGGLE_ON =
  "px-3 py-2 rounded-xl bg-slate-700 border-slate-500 focus:bg-slate-600 active:bg-slate-500";

export const TABLE_HEADER_CELL = "text-xs text-slate-500 font-bold px-2 py-2";
export const TABLE_CELL = "text-sm text-slate-300 px-2 py-2";
export const TABLE_ROW = "flex-row items-center";

export const TOOLTIP_BOX = "px-2 py-1 rounded-lg bg-slate-950 border-slate-600";
export const TOOLTIP_TEXT = "text-xs text-slate-300";

export const SHEET_PANEL =
  "absolute top-0 bottom-0 bg-slate-900 shadow-lg flex-col border-slate-700";
export const DIALOG_ACTIONS = "flex-row gap-2 justify-end pt-2";

export const SCROLL_AREA = "flex-1 overflow-hidden flex-col";
export const EMPTY_SHELL = "flex-col items-center justify-center gap-2 py-6 px-4";

/**
 * Build-time class literals for HA dashboard surfaces.
 * Press feedback draws its own background — radius must match the card shell.
 */

export const HA_CARD_SHELL = "flex-1 flex-col rounded-xl bg-slate-800 overflow-hidden";

export const HA_CARD_PRESS_GAP1 =
  "flex-col flex-1 p-3 gap-1 rounded-xl focus:bg-slate-700 active:bg-slate-600";
export const HA_CARD_PRESS_GAP2 =
  "flex-col flex-1 p-3 gap-2 rounded-xl focus:bg-slate-700 active:bg-slate-600";
export const HA_CARD_PRESS_GAP3 =
  "flex-col flex-1 p-3 gap-3 rounded-xl focus:bg-slate-700 active:bg-slate-600";
export const HA_CARD_PRESS_GAP3_NO_PAD =
  "flex-col flex-1 gap-3 rounded-xl focus:bg-slate-700 active:bg-slate-600";
export const HA_CARD_PRESS_CENTER_GAP1 =
  "flex-col items-center justify-center flex-1 p-3 gap-1 rounded-xl focus:bg-slate-700 active:bg-slate-600";
export const HA_CARD_PRESS_CENTER_GAP2 =
  "flex-col items-center justify-center flex-1 gap-2 p-3 rounded-xl focus:bg-slate-700 active:bg-slate-600";
