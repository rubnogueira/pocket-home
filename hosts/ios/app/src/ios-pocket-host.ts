import { GridLayout, GridUnitType, ItemSpec, isIOS, Page, type Frame } from "@nativescript/core";
import {
  PocketHostView,
  PocketView,
  type PocketView as PocketViewType,
} from "@nativescript/pocketjs";
import { applyPocketNativeChrome, stylePocketSurface, styleShellRoot } from "./ios-chrome";
import { teardownPocketGuestRuntime } from "./ios-pocket-guest-lifecycle";
import { stopPocketNativeSurface, pinPocketNativeToSuperview } from "./ios-pocket-native";
import {
  noteWindowBoundsSample,
  onOrientationEvent,
  resetWindowBoundsStability,
} from "./ios-orientation-settle";
import { publishShellSafeAreaInsets } from "./ios-safe-area";
import { syncEmbeddedRootLayout } from "./ios-embedded-layout";
import { logShellLayoutDiagnostics, syncNativeScriptShellToWindow } from "./ios-shell-layout";
import { rawPanelLogical, sameRuntimeSize } from "./ios-runtime-viewport";

type StagedApp = { app: string; externalGuest?: boolean; tickHz?: number };
type StagedPlan = { viewport: { logical: [number, number]; rasterDensity: number } };

export type PocketHost = {
  pocket: PocketViewType;
  scheduleLayoutRefresh: () => void;
};

function frameMatchesViewport(
  frameW: number,
  frameH: number,
  viewportW: number,
  viewportH: number,
): boolean {
  return Math.abs(frameW - viewportW) <= 2 && Math.abs(frameH - viewportH) <= 2;
}

export function mountPocketGuest(
  page: Page,
  frame: Frame,
  staged: StagedApp,
  plan: StagedPlan,
): PocketHost {
  let pocket: PocketHostView | PocketView | null = null;
  let remountTimer: ReturnType<typeof setTimeout> | null = null;
  let bootTimers: ReturnType<typeof setTimeout>[] = [];
  let lastRuntime = { width: 0, height: 0 };
  let guestSrcSet = false;
  let mountGeneration = 0;
  let remounting = false;
  let contentRoot: GridLayout | null = null;
  let bootedGeneration = -1;
  let loadedGeneration = -1;
  let lastRemountAt = 0;

  const clearBootTimers = () => {
    for (const t of bootTimers) {
      clearTimeout(t);
    }
    bootTimers = [];
  };

  const scheduleBoot = (fn: () => void, ms: number) => {
    bootTimers.push(setTimeout(fn, ms));
  };

  const syncShell = () => {
    syncNativeScriptShellToWindow(page, frame);
    syncEmbeddedRootLayout();
  };

  const setPageContent = (): void => {
    if (!pocket) {
      (page as unknown as { content: GridLayout | null }).content = null;
      return;
    }
    if (!contentRoot) {
      contentRoot = new GridLayout();
      styleShellRoot(contentRoot);
      contentRoot.addRow(new ItemSpec(1, GridUnitType.STAR));
      contentRoot.addColumn(new ItemSpec(1, GridUnitType.STAR));
    }
    contentRoot.removeChildren();
    contentRoot.addChild(pocket);
    GridLayout.setRow(pocket, 0);
    GridLayout.setColumn(pocket, 0);
    page.content = contentRoot;
  };

  const detach = () => {
    clearBootTimers();
    guestSrcSet = false;
    bootedGeneration = -1;
    loadedGeneration = -1;
    if (!pocket) {
      return;
    }
    const current = pocket;
    pocket = null;
    (page as unknown as { content: GridLayout | null }).content = null;
    stopPocketNativeSurface(current);
    teardownPocketGuestRuntime();
    try {
      current.off("loaded");
      current.off("error");
    } catch {
      // PocketView may not implement off() in all versions.
    }
  };

  const bootWhenLaidOut = (attempt = 0, generation = mountGeneration): void => {
    if (!pocket || generation !== mountGeneration || guestSrcSet) {
      return;
    }
    syncShell();
    page.requestLayout();
    setPageContent();
    pocket.requestLayout();

    const native = pocket.nativeViewProtected;
    if (!native && attempt < 120) {
      scheduleBoot(() => bootWhenLaidOut(attempt + 1, generation), 50);
      return;
    }
    if (!native) {
      return;
    }
    native.layoutIfNeeded();
    pinPocketNativeToSuperview(pocket);

    const frameW = Math.floor(native.frame.size.width);
    const frameH = Math.floor(native.frame.size.height);
    if ((frameW <= 0 || frameH <= 0) && attempt < 120) {
      scheduleBoot(() => bootWhenLaidOut(attempt + 1, generation), 50);
      return;
    }

    if (!noteWindowBoundsSample() && attempt < 80) {
      scheduleBoot(() => bootWhenLaidOut(attempt + 1, generation), 50);
      return;
    }

    const target = rawPanelLogical();
    if (pocket.viewportWidth !== target.width || pocket.viewportHeight !== target.height) {
      performRemount(target);
      return;
    }

    if (!frameMatchesViewport(frameW, frameH, target.width, target.height) && attempt < 120) {
      syncShell();
      scheduleBoot(() => bootWhenLaidOut(attempt + 1, generation), 50);
      return;
    }

    if (bootedGeneration === generation) {
      return;
    }
    bootedGeneration = generation;
    guestSrcSet = true;
    pocket.src = `~/assets/pocket/${staged.app}`;
  };

  const performRemount = (runtime: { width: number; height: number }) => {
    if (sameRuntimeSize(runtime, lastRuntime)) {
      return;
    }
    const now = Date.now();
    if (now - lastRemountAt < 1500) {
      scheduleLayoutRefresh();
      return;
    }
    if (remounting) {
      scheduleLayoutRefresh();
      return;
    }
    remounting = true;
    lastRemountAt = now;
    try {
      console.log(
        `[pocket-home] remount ${lastRuntime.width}x${lastRuntime.height} -> ${runtime.width}x${runtime.height}`,
      );
      attach(true, runtime);
    } finally {
      remounting = false;
    }
  };

  const attach = (remount: boolean, preset?: { width: number; height: number }) => {
    clearBootTimers();
    mountGeneration += 1;
    const generation = mountGeneration;
    if (remount) {
      detach();
      resetWindowBoundsStability();
    }
    publishShellSafeAreaInsets();
    syncShell();

    const runtime = preset ?? rawPanelLogical();
    lastRuntime = { ...runtime };
    console.log(`[pocket-home] mount surface logical ${runtime.width}x${runtime.height}`);

    pocket = staged.externalGuest ? new PocketHostView() : new PocketView();
    pocket.density = plan.viewport.rasterDensity;
    pocket.tickRate = staged.tickHz ?? 60;
    pocket.viewportWidth = runtime.width;
    pocket.viewportHeight = runtime.height;
    stylePocketSurface(pocket);
    pocket.horizontalAlignment = "stretch";
    pocket.verticalAlignment = "stretch";

    const active = pocket;
    pocket.on("loaded", () => {
      if (pocket !== active || generation !== mountGeneration) {
        return;
      }
      if (loadedGeneration === generation) {
        return;
      }
      const native = pocket!.nativeViewProtected;
      if (!native) {
        return;
      }
      syncShell();
      native.layoutIfNeeded();
      pinPocketNativeToSuperview(pocket!);
      applyPocketNativeChrome(pocket!);

      const frameW = Math.round(native.frame.size.width);
      const frameH = Math.round(native.frame.size.height);
      const vw = pocket!.viewportWidth;
      const vh = pocket!.viewportHeight;

      if (!frameMatchesViewport(frameW, frameH, vw, vh)) {
        console.log(
          `[pocket-home] mismatch after load viewport ${vw}x${vh} frame ${frameW}x${frameH}`,
        );
        loadedGeneration = generation;
        scheduleLayoutRefresh();
        return;
      }

      loadedGeneration = generation;
      logShellLayoutDiagnostics(page, native);
      console.log(`[pocket-home] guest loaded viewport ${vw}x${vh} frame ${frameW}x${frameH}`);
      publishShellSafeAreaInsets();
      syncShell();
      page.requestLayout();
      pocket!.requestLayout();
    });
    pocket.on("error", (event) => {
      console.error("[pocket-home] error:", (event as { message?: string }).message);
    });

    scheduleBoot(() => bootWhenLaidOut(0, generation), 0);
  };

  const runLayoutRefresh = () => {
    publishShellSafeAreaInsets();
    syncShell();
    page.requestLayout();
    pocket?.requestLayout();

    if (!noteWindowBoundsSample()) {
      scheduleLayoutRefresh();
      return;
    }

    const runtime = rawPanelLogical();
    if (!sameRuntimeSize(runtime, lastRuntime)) {
      performRemount(runtime);
      return;
    }

    if (pocket && guestSrcSet) {
      pinPocketNativeToSuperview(pocket);
    } else if (pocket) {
      bootWhenLaidOut(0, mountGeneration);
    }
  };

  const scheduleLayoutRefresh = () => {
    if (remountTimer) {
      clearTimeout(remountTimer);
    }
    remountTimer = setTimeout(
      () => {
        remountTimer = null;
        runLayoutRefresh();
      },
      isIOS ? 300 : 80,
    );
  };

  attach(false);

  return {
    get pocket() {
      if (!pocket) {
        throw new Error("pocket-home: pocket not mounted");
      }
      return pocket;
    },
    scheduleLayoutRefresh: () => {
      onOrientationEvent();
      scheduleLayoutRefresh();
    },
  };
}
