/** Pocket Home shell chrome — matches the app surface (Tailwind slate-900, `#0f172a`). */
import type { AbsoluteLayout, Frame, Page, View } from "@nativescript/core";

export const POCKET_HOME_CHROME = "#0f172a";

declare const PocketEmbedPresenter:
  | { applyWindowChrome(): void; releaseSurface(view: UIView): void }
  | undefined;

export function styleShellFrame(frame: Frame): void {
  frame.backgroundColor = POCKET_HOME_CHROME;
  frame.iosIgnoreSafeArea = true;
}

export function styleShellPage(page: Page): void {
  page.actionBarHidden = true;
  page.backgroundColor = POCKET_HOME_CHROME;
  // Lay out full-bleed; the shell places the surface inside the window's safe area itself
  // (ios-pocket-host.ts) so it never sits under the status bar or home indicator.
  page.iosIgnoreSafeArea = true;
  page.statusBarStyle = "light";
}

export function styleShellRoot(layout: AbsoluteLayout): void {
  layout.horizontalAlignment = "stretch";
  layout.verticalAlignment = "stretch";
  layout.backgroundColor = POCKET_HOME_CHROME;
  layout.iosIgnoreSafeArea = true;
}

export function stylePocketSurface(surface: View): void {
  surface.horizontalAlignment = "stretch";
  surface.verticalAlignment = "stretch";
  surface.backgroundColor = POCKET_HOME_CHROME;
  surface.iosIgnoreSafeArea = true;
}

/** Window background shows through the safe-area bands and behind a surface being swapped. */
export function applyWindowChrome(): void {
  if (typeof PocketEmbedPresenter !== "undefined" && PocketEmbedPresenter) {
    PocketEmbedPresenter.applyWindowChrome();
  }
}

/**
 * Frees a replaced surface's guest realm, core and GPU state right away (~50 MB on iPad) instead of
 * whenever — if ever — the bridge-crossing retain cycle through its callbacks is collected.
 */
export function releaseSurfaceResources(native: UIView | null | undefined): void {
  if (native && typeof PocketEmbedPresenter !== "undefined" && PocketEmbedPresenter) {
    PocketEmbedPresenter.releaseSurface(native);
  }
}
