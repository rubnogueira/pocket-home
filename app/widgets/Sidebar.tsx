import { Text, View, Image, Focusable, type NodeMirror } from "@pocketjs/framework/components";
import { createScroller, bindDpadScroll } from "@pocketjs/framework/kinetics";
import { createGesture } from "@pocketjs/framework/gesture";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { ref, computed } from "vue";
import { DEFAULT_CATEGORIES, CONFIG } from "../data/config.ts";
import { getViewport } from "../theme/sizes.ts";
import { ICONS } from "../icons.ts";

export interface SidebarProps {
  activeCategory: string;
  open: boolean;
  onSelect: (id: string) => void;
  onToggle: () => void;
}

// A subtle colored tint behind each category icon. Solid shades — the Tailwind
// compiler drops `/opacity` modifiers, so a `/20` tint renders as nothing.
const ICON_BG: Record<string, string> = {
  home: "w-8 h-8 rounded-lg bg-blue-900 items-center justify-center",
  map: "w-8 h-8 rounded-lg bg-emerald-900 items-center justify-center",
  energy: "w-8 h-8 rounded-lg bg-amber-900 items-center justify-center",
  settings: "w-8 h-8 rounded-lg bg-slate-600 items-center justify-center",
};

const HEADER_H = 56;
const FOOTER_H = 72;
const ROW_H = 48;
const ROW_GAP = 6;
const LIST_PAD = 8;

export default function Sidebar(props: SidebarProps) {
  // Reactive viewport, so the drawer reflows with a live host resize.
  const vp = ref({ ...getViewport() });
  const isSmall = computed(() => vp.value.w < 500);
  const sidebarW = computed(() => (isSmall.value ? Math.min(vp.value.w * 0.8, 280) : 260));

  const count = DEFAULT_CATEGORIES.length;
  const listContentH = count * ROW_H + (count - 1) * ROW_GAP + LIST_PAD * 2;
  const listViewH = computed(() => Math.max(0, vp.value.h - HEADER_H - FOOTER_H - 2));

  // Kinetic scroll for the category list (overflows on short screens).
  let listNode: NodeMirror | undefined;
  const scroller = createScroller({
    max: () => Math.max(0, listContentH - listViewH.value),
  });

  createGesture({
    region: { node: () => (props.open ? (listNode ?? null) : null) },
    axis: "y",
    onDown: () => {
      if (scroller.state() !== "idle") scroller.stop();
    },
    onPanStart: () => scroller.beginDrag(),
    onPanMove: (c) => scroller.drag(-c.fdy),
    onPanEnd: (c) => scroller.endDrag(-c.vy),
    onCancel: () => {
      if (scroller.state() === "tracking") scroller.endDrag(0);
    },
  });

  bindDpadScroll(scroller, { active: () => props.open });

  onFrame(() => {
    const v = getViewport();
    if (v.w !== vp.value.w || v.h !== vp.value.h) vp.value = { w: v.w, h: v.h };
    scroller.step();
  });

  const scrollY = computed(() => scroller.offset());

  return (
    <View
      class="absolute bg-slate-800 flex-col"
      style={{
        insetL: props.open ? 0 : -sidebarW.value,
        insetT: 0,
        width: sidebarW.value,
        height: vp.value.h,
      }}
    >
      {/* Header — title left, close button right */}
      <View class="px-4 flex-row items-center" style={{ height: HEADER_H }}>
        <View class="flex-col flex-1">
          <Text class="text-sm text-slate-50 font-bold">{CONFIG.dashboard.title}</Text>
          <Text class="text-xs text-slate-500">{CONFIG.location.city}</Text>
        </View>
        <Focusable
          class="w-9 h-9 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={props.onToggle}
        >
          <Image src={ICONS.close!} style={{ width: 18, height: 18 }} />
        </Focusable>
      </View>

      <View class="h-[1] bg-slate-700 mx-3" />

      {/* Scrollable category list */}
      <View
        nodeRef={(node: NodeMirror | null) => {
          listNode = node ?? undefined;
        }}
        class="flex-1 overflow-hidden"
      >
        <View
          class="absolute flex-col"
          style={{ insetT: LIST_PAD, insetL: 0, insetR: 0, translateY: -scrollY.value }}
        >
          {DEFAULT_CATEGORIES.map((cat) => {
            const isActive = props.activeCategory === cat.id;
            const iconSrc = ICONS[cat.id as keyof typeof ICONS];
            const bgClass =
              ICON_BG[cat.id] ?? "w-8 h-8 rounded-lg bg-slate-600 items-center justify-center";
            return (
              <Focusable
                key={cat.id}
                class={
                  isActive
                    ? "flex-row items-center gap-3 px-3 mx-2 mb-1 rounded-xl bg-blue-600 focus:bg-blue-500 active:bg-blue-500"
                    : "flex-row items-center gap-3 px-3 mx-2 mb-1 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-600"
                }
                style={{ height: ROW_H }}
                onPress={() => props.onSelect(cat.id)}
              >
                <View class={bgClass}>
                  {iconSrc ? (
                    <Image src={iconSrc} style={{ width: 18, height: 18 }} />
                  ) : (
                    <Text class="text-xs text-white font-bold">?</Text>
                  )}
                </View>
                <Text
                  class={isActive ? "text-sm text-slate-50 font-bold" : "text-sm text-slate-300"}
                >
                  {cat.label}
                </Text>
              </Focusable>
            );
          })}
        </View>
      </View>

      {/* User profile footer */}
      <View class="h-[1] bg-slate-700 mx-3" />
      <Focusable
        class="px-3 flex-row items-center gap-3 mx-2 my-2 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-600"
        style={{ height: 44 }}
        onPress={() => {}}
      >
        <View class="w-8 h-8 rounded-full bg-blue-600 items-center justify-center">
          <Text class="text-xs text-white font-bold">R</Text>
        </View>
        <View class="flex-col flex-1">
          <Text class="text-sm text-slate-200 font-bold">Ruben N.</Text>
          <Text class="text-xs text-slate-500">Profile</Text>
        </View>
      </Focusable>

      {/* Right edge border */}
      <View
        class="absolute bg-slate-700"
        style={{ insetR: 0, insetT: 0, width: 1, height: vp.value.h }}
      />
    </View>
  );
}

export const SIDEBAR_W = 260;
