import { Focusable, Text, View } from "@pocketjs/framework/components";
import { getViewport } from "../theme/sizes.ts";
import { sheetPanelWidth } from "./sheet-layout.ts";
import { createScroller, paintOffset } from "./scroller.ts";
import { useContentInsetBottom } from "../theme/content-insets.ts";
import { createGesture } from "@pocketjs/framework/gesture";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { ref, computed } from "vue";
import type { NodeMirror } from "@pocketjs/framework/components";

export interface SheetProps {
  open: boolean;
  side?: "left" | "right";
  width?: number;
  title?: string;
  /** Render-prop: called to produce content inside the scrollable panel. */
  content?: () => unknown;
  onClose: () => void;
}

const HEADER_H = 42;

export function Sheet(props: SheetProps) {
  if (!props.open) return null;
  const preferredW = props.width ?? 280;
  const side = props.side ?? "right";
  const vp = ref({ ...getViewport() });
  const panelW = computed(() => sheetPanelWidth(vp.value.w, preferredW));

  let contentNode: NodeMirror | undefined;
  const contentH = ref(1200);
  const insetBottom = useContentInsetBottom();

  const scroller = createScroller({
    max: () =>
      Math.max(0, contentH.value + insetBottom.value - Math.max(1, vp.value.h - HEADER_H - 2)),
    extent: () => Math.max(1, vp.value.h - HEADER_H - 2),
  });

  createGesture({
    region: { node: () => contentNode ?? null },
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

  onFrame(() => {
    const v = getViewport();
    if (v.w !== vp.value.w || v.h !== vp.value.h) vp.value = { w: v.w, h: v.h };
    scroller.step();
  });

  const scrollY = computed(() => paintOffset(scroller));
  const panelX = computed(() => (side === "right" ? vp.value.w - panelW.value : 0));
  const backdropW = computed(() => Math.max(0, vp.value.w - panelW.value));

  return (
    <View class="absolute" style={{ insetL: 0, insetT: 0, width: vp.value.w, height: vp.value.h }}>
      {/* Backdrop — covers non-panel area */}
      <Focusable
        class="absolute bg-slate-950"
        style={
          side === "right"
            ? { insetL: 0, insetT: 0, width: backdropW.value, height: vp.value.h, opacity: 0.4 }
            : {
                insetL: panelW.value,
                insetT: 0,
                width: backdropW.value,
                height: vp.value.h,
                opacity: 0.4,
              }
        }
        onPress={props.onClose}
      />
      {/* Panel — flex-col like Sidebar so children stack and flex-1 fills */}
      <View
        class="absolute bg-slate-900 flex-col"
        style={{ insetL: panelX.value, insetT: 0, width: panelW.value, height: vp.value.h }}
      >
        {/* Header */}
        <View class="flex-row items-center justify-between px-4" style={{ height: HEADER_H }}>
          {props.title ? (
            <Text class="text-sm text-slate-50 font-bold flex-1 w-full">{props.title}</Text>
          ) : (
            <View class="flex-1" />
          )}
          <Focusable
            class="w-8 h-8 rounded-lg bg-slate-800 items-center justify-center focus:bg-slate-700 active:bg-slate-600"
            onPress={props.onClose}
          >
            <Text class="text-sm text-slate-300 font-bold">X</Text>
          </Focusable>
        </View>

        {/* Separator */}
        <View class="h-[1] bg-slate-700 mx-3" />

        {/* Scrollable content area — flex-1 fills remaining panel height */}
        <View
          nodeRef={(node: NodeMirror | null) => {
            contentNode = node ?? undefined;
          }}
          class="flex-1 overflow-hidden"
        >
          <View
            class="absolute flex-col px-4 py-2 gap-2 w-full"
            style={{ insetT: 0, insetL: 0, width: panelW.value, translateY: -scrollY.value }}
          >
            {props.content?.() as any}
          </View>
        </View>

        {/* Left edge border */}
        <View
          class="absolute bg-slate-700"
          style={{ insetL: 0, insetT: 0, width: 1, height: vp.value.h }}
        />
      </View>
    </View>
  );
}
