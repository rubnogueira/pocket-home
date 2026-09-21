import { computed, onMounted, onScopeDispose, ref } from "vue";
import { Text, View, Image, Focusable, type NodeMirror } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { createScroller, bindDpadScroll } from "@pocketjs/framework/kinetics";
import { createGesture } from "@pocketjs/framework/gesture";
import { onFrame } from "@pocketjs/framework/lifecycle";
import Sidebar from "./widgets/Sidebar.tsx";
import { computeGrid, getViewport } from "./theme/sizes.ts";
import { shellContentInsetBottom, shellContentInsetTop } from "./theme/shell-insets.ts";
import { CONFIG } from "./data/config.ts";
import { ICONS } from "./icons.ts";
import { Separator, Sheet, Toaster } from "./ui/index.ts";

// HA Lovelace imports
import { registerAll } from "./registry/register-all.ts";
import { MockDataSource } from "./store/mock-source.ts";
import { EmbeddedDataSource } from "./store/embedded-source.ts";
import { haHttpBaseFromWebSocketUrl, resolveHaWebSocketUrl } from "./store/resolve-ha-url.ts";
import { HAWebSocketSource } from "./store/ha-websocket.ts";
import { createEntityStore } from "./store/entity-store.ts";
import { createDashboardStore } from "./store/dashboard-store.ts";
import { provideMoreInfo } from "./store/more-info-context.ts";
import { entityName } from "./store/entity-store.ts";
import DashboardRenderer from "./renderer/DashboardRenderer.tsx";
import MoreInfoSheet from "./renderer/MoreInfoSheet.tsx";
import type { DataSource } from "./store/data-source.ts";

registerAll();

const HEADER_H = 56;
const SETTINGS_CONTENT_H = 420;

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export default function App() {
  const vp = ref({ ...getViewport() });
  const sidebarOpen = ref(false);
  const connected = ref(false);
  const editMode = ref(false);

  // HA stores
  const entityStore = createEntityStore();
  const dashStore = createDashboardStore();
  let dataSource: DataSource | undefined;

  // More-info sheet state
  const moreInfoEntityId = ref<string | null>(null);

  provideMoreInfo((entityId: string) => {
    moreInfoEntityId.value = entityId;
  });

  // More-info entity (computed so it tracks entity-store updates reactively)
  const moreInfoEntity = computed(() => {
    const eid = moreInfoEntityId.value;
    if (!eid || !connected.value) return null;
    return entityStore.entities[eid] ?? null;
  });

  function closeMoreInfo() {
    moreInfoEntityId.value = null;
  }

  // WebSocket mock (dev) or configured HA URL; otherwise embedded seed (no failed WS in console).
  async function initDataSource(): Promise<void> {
    const wsUrl = resolveHaWebSocketUrl();
    const haToken = CONFIG.homeAssistant.accessToken.trim();
    if (wsUrl && haToken) {
      try {
        const src = new HAWebSocketSource(haHttpBaseFromWebSocketUrl(wsUrl), haToken);
        await src.connect();
        dataSource = src;
      } catch {
        // fall through
      }
    } else if (wsUrl) {
      try {
        const src = new MockDataSource(wsUrl);
        await src.connect();
        dataSource = src;
      } catch {
        // fall through to embedded
      }
    }
    if (!dataSource) {
      const src = new EmbeddedDataSource();
      await src.connect();
      dataSource = src;
    }
    await entityStore.init(dataSource!);
    await dashStore.init(dataSource!);
    connected.value = true;
    (globalThis as any).__dataSource = dataSource;
  }
  onMounted(() => {
    initDataSource();
  });

  onScopeDispose(() => {
    entityStore.dispose();
    if (dataSource) dataSource.disconnect();
  });

  // Clock
  const now = new Date();
  const headerTime = ref(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
  let cancelClock: (() => void) | undefined;
  function tick(): void {
    const d = new Date();
    headerTime.value = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function scheduleClock(): void {
    cancelClock = after(30, () => {
      tick();
      scheduleClock();
    });
  }
  onMounted(() => {
    scheduleClock();
  });
  onScopeDispose(() => {
    if (cancelClock) cancelClock();
  });

  // Full viewport width — edge padding is handled inside SectionsView.
  const insetTop = computed(() => shellContentInsetTop());
  const insetBottom = computed(() => shellContentInsetBottom());
  const headerBlockH = computed(() => HEADER_H + insetTop.value);
  const contentW = computed(() => vp.value.w);
  const viewportH = computed(() =>
    Math.max(1, vp.value.h - headerBlockH.value - insetBottom.value),
  );
  const grid = computed(() => computeGrid(contentW.value, viewportH.value));

  const currentViewLabel = computed(() => {
    if (!connected.value || !dashStore.config) return "Demo";
    const view = dashStore.currentView;
    return view?.title ?? "Demo";
  });

  const isSettings = computed(() => {
    if (!connected.value) return false;
    const view = dashStore.currentView;
    return view?.path === "settings";
  });

  // Content height estimation for scroller — mirrors SectionsView grid placement.
  const HEADING_H_EST = 30;
  const GRID_ROW_H = 56;
  const GRID_GAP = 8;
  const FULL_ROW_TYPES = new Set(["heading", "markdown"]);

  function gridPlacementH(cards: Record<string, unknown>[], cols: number): number {
    const occupied = new Set();
    let maxRowEnd = 0;
    for (const card of cards) {
      const type = card.type as string;
      const colSpan = FULL_ROW_TYPES.has(type) ? cols : 1;
      const features = (card.features as unknown[] | undefined) ?? [];
      let rowSpan = 1;
      if (type === "tile" && features.length > 0) rowSpan = 2;
      if (type === "sensor") rowSpan = 2;
      if (type === "markdown") rowSpan = 3;
      let placed = false;
      for (let r = 0; !placed && r < 100; r++) {
        for (let c = 0; c <= cols - colSpan && !placed; c++) {
          let fits = true;
          for (let dr = 0; dr < rowSpan && fits; dr++)
            for (let dc = 0; dc < colSpan && fits; dc++)
              if (occupied.has(`${r + dr},${c + dc}`)) fits = false;
          if (fits) {
            for (let dr = 0; dr < rowSpan; dr++)
              for (let dc = 0; dc < colSpan; dc++) occupied.add(`${r + dr},${c + dc}`);
            maxRowEnd = Math.max(maxRowEnd, r + rowSpan);
            placed = true;
          }
        }
      }
    }
    if (maxRowEnd <= 0) return 0;
    return maxRowEnd * GRID_ROW_H + Math.max(0, maxRowEnd - 1) * GRID_GAP;
  }

  const totalContentH = computed(() => {
    if (!connected.value || !dashStore.config) return viewportH.value;
    if (isSettings.value) return Math.max(viewportH.value, SETTINGS_CONTENT_H);

    const view = dashStore.currentView;
    if (!view) return viewportH.value;

    const cw = contentW.value;
    const viewType = view.type ?? "sections";

    if (viewType === "sections" && view.sections?.length) {
      const edgePad = cw >= 1100 ? 80 : cw >= 700 ? 48 : cw >= 400 ? 24 : 12;
      const innerW = cw - edgePad * 2;
      const sGap = cw >= 700 ? 24 : 16;
      const colGap = cw >= 700 ? 24 : 16;
      const maxCols = view.max_columns ?? 4;
      const minColW = 280;
      const sectionCols = Math.max(
        1,
        Math.min(maxCols, Math.floor((innerW + colGap) / (minColW + colGap))),
      );
      const approxW = Math.floor((innerW - (sectionCols - 1) * colGap) / sectionCols);
      const sectionMaxCards = 4;
      const minCardW = 140;
      const cardCols = Math.max(
        1,
        Math.min(sectionMaxCards, Math.floor((approxW + GRID_GAP) / (minCardW + GRID_GAP))),
      );

      function sectionH(sec: Record<string, unknown>): number {
        const cards = (sec.cards ?? []) as Record<string, unknown>[];
        let headingH = 0;
        const gridCards: Record<string, unknown>[] = [];
        for (const c of cards) {
          if ((c.type as string) === "heading") headingH += HEADING_H_EST;
          else gridCards.push(c);
        }
        const gridH = gridPlacementH(gridCards, cardCols);
        const parts = (headingH > 0 ? 1 : 0) + (gridH > 0 ? 1 : 0);
        return headingH + gridH + Math.max(0, parts - 1) * GRID_GAP;
      }

      // Row-based layout: group sections into rows, compute per-row max height.
      const sections = view.sections;
      const sectionRows: (typeof sections)[] = [];
      for (let i = 0; i < sections.length; i += sectionCols) {
        sectionRows.push(sections.slice(i, i + sectionCols));
      }

      let totalSectionsH = 0;
      for (let r = 0; r < sectionRows.length; r++) {
        let maxRowH = 0;
        for (const sec of sectionRows[r]) {
          maxRowH = Math.max(maxRowH, sectionH(sec as Record<string, unknown>));
        }
        totalSectionsH += maxRowH;
        if (r > 0) totalSectionsH += sGap;
      }

      const badges = (view.badges?.length ?? 0) > 0 ? 30 : 0;
      const viewPad = cw >= 700 ? 16 : 10;
      return Math.max(viewportH.value, viewPad * 2 + totalSectionsH + badges + 40);
    }

    if (view.cards?.length) {
      const cards = view.cards;
      const nCols = Math.max(1, Math.min(grid.value.cols, 4));
      const colCounts = Array.from({ length: nCols }, () => 0);
      cards.forEach((_: unknown, i: number) => {
        colCounts[i % nCols]++;
      });
      const tallest = Math.max(...colCounts);
      return Math.max(viewportH.value, 16 + tallest * 80 + Math.max(0, tallest - 1) * 6 + 40);
    }

    return viewportH.value;
  });

  // Scrollable widget area
  let viewportNode: NodeMirror | undefined;

  const scroller = createScroller({
    max: () => Math.max(0, totalContentH.value - viewportH.value),
  });

  createGesture({
    region: { node: () => viewportNode ?? null },
    axis: "y",
    onDown: () => {
      if (scroller.state() !== "idle") scroller.stop();
    },
    onPanStart: () => {
      scroller.beginDrag();
    },
    onPanMove: (c) => {
      scroller.drag(-c.fdy);
    },
    onPanEnd: (c) => {
      scroller.endDrag(-c.vy);
    },
    onCancel: () => {
      if (scroller.state() === "tracking") scroller.endDrag(0);
    },
  });

  bindDpadScroll(scroller, {
    active: () => !sidebarOpen.value,
  });

  onFrame(() => {
    const v = getViewport();
    if (v.w !== vp.value.w || v.h !== vp.value.h) {
      vp.value = { w: v.w, h: v.h };
      scroller.scrollTo(0, { immediate: true });
    }
    // Shell may update safe-area insets after rotation without remounting.
    if (
      insetTop.value !== shellContentInsetTop() ||
      insetBottom.value !== shellContentInsetBottom()
    ) {
      scroller.scrollTo(0, { immediate: true });
    }

    const wheelDy: number = (globalThis as any).__wheelDeltaY?.() ?? 0;
    if (wheelDy !== 0 && !sidebarOpen.value) {
      // Match gesture pan sign (-c.fdy); DOM wheel deltaY is opposite.
      scroller.scrollBy(-wheelDy, { immediate: true });
    }

    scroller.step();
  });

  const scrollY = computed(() => scroller.offset());

  // Navigation
  function onSelectCategory(id: string): void {
    sidebarOpen.value = false;
    editMode.value = false;
    scroller.scrollTo(0, { immediate: true });

    if (!connected.value || !dashStore.config) return;

    const views = dashStore.config.views;
    const idx = views.findIndex((v) => v.path === id);
    if (idx >= 0) {
      dashStore.setView(idx);
    }
  }

  function onViewChange(index: number): void {
    dashStore.setView(index);
    scroller.scrollTo(0, { immediate: true });
  }

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function closeSidebar(): void {
    sidebarOpen.value = false;
  }

  function toggleEditMode(): void {
    editMode.value = !editMode.value;
  }

  // Section config changes (from edit mode)
  function onSectionConfigChange(sectionIndex: number, key: string, value: unknown): void {
    if (!dashStore.config) return;
    const view = dashStore.currentView;
    if (!view?.sections) return;
    const section = view.sections[sectionIndex];
    if (!section) return;
    (section as Record<string, unknown>)[key] = value;
  }

  // Card reorder within a section
  function onCardReorder(sectionIndex: number, fromIdx: number, toIdx: number): void {
    if (!dashStore.config) return;
    const view = dashStore.currentView;
    if (!view?.sections) return;
    const cards = view.sections[sectionIndex]?.cards;
    if (!cards || fromIdx < 0 || fromIdx >= cards.length || toIdx < 0 || toIdx >= cards.length)
      return;
    const [moved] = cards.splice(fromIdx, 1);
    cards.splice(toIdx, 0, moved);
  }

  return (
    <View debugName="DashboardRoot" class="w-full h-full bg-slate-900 relative">
      {/* Main content column — edge-to-edge, no outer margins */}
      <View class="w-full h-full flex-col">
        {/* Header bar — draws under transparent status bar; insetTop keeps controls below it */}
        <View class="flex-col w-full bg-slate-900" style={{ paddingTop: insetTop.value }}>
          <View class="flex-row items-center justify-between px-4" style={{ height: HEADER_H }}>
            <View class="flex-row items-center gap-3">
              <Focusable
                class="w-9 h-9 rounded-lg bg-slate-800 items-center justify-center focus:bg-slate-700 active:bg-slate-600"
                onPress={toggleSidebar}
              >
                <Image src={ICONS.menu!} style={{ width: 18, height: 18 }} />
              </Focusable>
              <Text class="text-lg text-slate-50 font-bold">{currentViewLabel.value}</Text>
            </View>

            <View class="flex-row items-center gap-3">
              <Image src={ICONS.sun} style={{ width: 18, height: 18 }} />
              <Text class="text-xs text-slate-400">{CONFIG.location.city}</Text>
              <Text class="text-sm text-slate-300 font-bold">{headerTime.value}</Text>
              {/* Edit button — HA pencil icon */}
              <Focusable
                class={
                  editMode.value
                    ? "w-9 h-9 rounded-lg bg-blue-600 items-center justify-center focus:bg-blue-500 active:bg-blue-400"
                    : "w-9 h-9 rounded-lg bg-slate-800 items-center justify-center focus:bg-slate-700 active:bg-slate-600"
                }
                onPress={toggleEditMode}
              >
                {editMode.value ? (
                  <Text class="text-xs text-slate-100 font-bold">OK</Text>
                ) : (
                  <Image src={ICONS.pencil!} style={{ width: 18, height: 18 }} />
                )}
              </Focusable>
            </View>
          </View>
        </View>

        {/* Edit mode bar */}
        {editMode.value ? (
          <View class="flex-row items-center justify-between px-4 py-2 bg-blue-900">
            <Text class="text-xs text-blue-200 font-bold">
              Edit mode — drag to reorder, tap gear for section settings
            </Text>
            <Focusable
              class="px-3 py-1 rounded-lg bg-blue-600 focus:bg-blue-500 active:bg-blue-400"
              onPress={toggleEditMode}
            >
              <Text class="text-xs text-white font-bold">Done</Text>
            </Focusable>
          </View>
        ) : null}

        <Separator />

        {/* Scrollable content area */}
        <View
          nodeRef={(node: NodeMirror | null) => {
            viewportNode = node ?? undefined;
          }}
          class="flex-1 overflow-hidden"
        >
          <View
            class="absolute flex-col"
            style={{
              insetT: 0,
              insetL: 0,
              insetR: 0,
              height: totalContentH.value,
              translateY: -scrollY.value,
            }}
          >
            {connected.value && dataSource ? (
              <DashboardRenderer
                config={dashStore.config}
                viewIndex={dashStore.viewIndex}
                entities={entityStore.entities}
                entityVersion={entityStore.version.value}
                source={dataSource}
                contentWidth={contentW.value}
                cols={grid.value.cols}
                editMode={editMode.value}
                onViewChange={onViewChange}
                onSectionConfigChange={onSectionConfigChange}
                onCardReorder={onCardReorder}
              />
            ) : (
              <View class="flex-1 flex-col items-center justify-center p-6 gap-3">
                <Text class="text-sm text-slate-400">Connecting to server...</Text>
                <Text class="text-xs text-slate-600">Start the server: cd server && bun dev</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Backdrop */}
      {sidebarOpen.value ? (
        <Focusable
          class="absolute bg-slate-950"
          style={{ insetL: 0, insetT: 0, width: vp.value.w, height: vp.value.h, opacity: 0.4 }}
          onPress={closeSidebar}
        />
      ) : null}

      {/* Sidebar overlay */}
      <Sidebar
        activeCategory={dashStore.currentView?.path ?? "home"}
        open={sidebarOpen.value}
        onSelect={onSelectCategory}
        onToggle={toggleSidebar}
      />

      {/* More-info entity sheet */}
      {moreInfoEntity.value != null && dataSource ? (
        <Sheet
          open={true}
          onClose={closeMoreInfo}
          title={entityName(moreInfoEntity.value)}
          width={340}
          content={() => (
            <MoreInfoSheet
              entityId={moreInfoEntityId.value!}
              entities={entityStore.entities}
              source={dataSource!}
              onClose={closeMoreInfo}
            />
          )}
        />
      ) : null}

      <Toaster />
    </View>
  );
}
