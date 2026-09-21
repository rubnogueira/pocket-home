/** Pocket Home shell chrome — matches app surface `#020617`. */
import { type Frame, type GridLayout, type Page } from "@nativescript/core";
import type { PocketView } from "@nativescript/pocketjs";
import { syncEmbeddedRootLayout } from "./ios-embedded-layout";
import { bindUiKitOrientationWatch } from "./ios-orientation-watch";
import { onOrientationEvent } from "./ios-orientation-settle";

export const POCKET_HOME_CHROME = "#020617";

const CHROME_RGB = { r: 2 / 255, g: 6 / 255, b: 23 / 255, a: 1 };

export function styleShellPage(page: Page): void {
  page.actionBarHidden = true;
  page.backgroundColor = POCKET_HOME_CHROME;
  page.iosIgnoreSafeArea = true;
  page.statusBarStyle = "light";
}

export function styleShellFrame(frame: Frame): void {
  frame.backgroundColor = POCKET_HOME_CHROME;
  frame.iosIgnoreSafeArea = true;
}

export function styleShellRoot(root: GridLayout): void {
  root.horizontalAlignment = "stretch";
  root.verticalAlignment = "stretch";
  root.backgroundColor = POCKET_HOME_CHROME;
  root.iosOverflowSafeArea = true;
}

export function stylePocketSurface(pocket: PocketView): void {
  pocket.backgroundColor = POCKET_HOME_CHROME;
  pocket.iosOverflowSafeArea = true;
}

export function applyPocketNativeChrome(pocket: PocketView): void {
  paintPocketNative(pocket);
}

function paintPocketNative(pocket: PocketView): void {
  const native = pocket.nativeViewProtected as {
    backgroundColor?: unknown;
    opaque?: boolean;
    autoresizingMask?: number;
    layer?: { contentsGravity?: string };
  } | null;
  if (!native) {
    return;
  }
  native.backgroundColor = UIColor.colorWithRedGreenBlueAlpha(
    CHROME_RGB.r,
    CHROME_RGB.g,
    CHROME_RGB.b,
    CHROME_RGB.a,
  );
  native.opaque = true;
  native.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
  if (native.layer) {
    native.layer.contentsGravity = "resize";
  }
}

export function bindOrientationRelayout(
  page: Page,
  host: { scheduleLayoutRefresh: () => void },
  frame?: { requestLayout: () => void },
): void {
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const onOrientationChange = () => {
    onOrientationEvent();
    syncEmbeddedRootLayout();
    frame?.requestLayout();
    page.requestLayout();
    if (settleTimer) {
      clearTimeout(settleTimer);
    }
    settleTimer = setTimeout(() => {
      settleTimer = null;
      syncEmbeddedRootLayout();
      frame?.requestLayout();
      page.requestLayout();
      host.scheduleLayoutRefresh();
    }, 380);
    host.scheduleLayoutRefresh();
  };

  bindUiKitOrientationWatch(onOrientationChange);
}
