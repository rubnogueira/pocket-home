/**
 * Mounts the Pocket Home guest and keeps it sized to the device.
 *
 * The PocketApple framework is Pocket Home's build (tools/ios-app/pocket-apple-framework.ts): the
 * surface resizes its live guest (`setLogicalWidth:logicalHeight:` -> pocket_apple_set_viewport)
 * and draws with OpenGL ES. So one surface lives for the app's lifetime, and a window size change
 * (rotation, Stage Manager, split view) is handled inside the layout pass that reports it:
 *
 *   root `layoutChanged` -> surface framed to the new safe-area panel -> surface resized to the
 *     panel's logical size -> the guest relayouts and the frame is presented before UIKit's
 *     rotation animation starts.
 *
 * No stretched old frame, no second guest booting, and the dashboard keeps its view and scroll
 * position (it is the same guest). Geometry is explicit (AbsoluteLayout + window.bounds /
 * safeAreaInsets), not NativeScript's padding/safe-area layout: after a rotation GridLayout
 * applied the root padding a second time (a 750x382 iPhone landscape panel came out 626x362).
 */
import { AbsoluteLayout, View, knownFolders, type Page } from "@nativescript/core";
import { PocketView } from "@nativescript/pocketjs";
import { applyWindowChrome, styleShellRoot, stylePocketSurface } from "./ios-chrome";
import {
  isMountablePanel,
  pickGuestVariant,
  sameSize,
  surfaceViewport,
  type GuestVariant,
  type Size,
} from "./ios-viewport";

/** assets/pocket/current.json (tools/ios-app/stage-guest.ts). */
export type StagedApp = {
  app: string;
  externalGuest?: boolean;
  variants?: GuestVariant[];
  /** Legacy single-guest staging (no variants): `<app>.pocketjs` at this rate. */
  tickHz?: number;
};
export type StagedPlan = { viewport: { logical: [number, number]; rasterDensity: number } };

interface PocketSurfaceNative {
  loadPak(pak: NSData): boolean;
  evalBundleLabel(bundle: NSString, label: string): boolean;
  start(): void;
  setLogicalWidthLogicalHeight(width: number, height: number): boolean;
}

/**
 * `PocketView` with the plugin's `_loadApp` boot sequence (loadPak -> evalBundle -> start ->
 * `loaded`), reading the pak for the picked density (paks are staged once per density).
 */
class PocketHomeSurface extends PocketView {
  declare _booted?: boolean;
  /** Extensionless pak path (`~/...`); defaults to `src`. */
  pakSrc = "";
  /**
   * Frame on the safe-area panel, in window DIPs, set by the shell. NativeScript's layout does
   * not size this view: a width/height changed from the root's layoutChanged handler (inside a
   * layout pass) is ignored, so its next pass put the pre-rotation frame back.
   */
  pinnedFrame: CGRect | null = null;

  layoutNativeView(left: number, top: number, right: number, bottom: number): void {
    const native = this.nativeViewProtected as UIView | null;
    if (native && this.pinnedFrame) {
      if (!CGRectEqualToRect(native.frame, this.pinnedFrame)) native.frame = this.pinnedFrame;
      return;
    }
    super.layoutNativeView(left, top, right, bottom);
  }

  _loadApp(src: string): void {
    const native = this.nativeViewProtected as PocketSurfaceNative | null;
    if (!native || this._booted) return;
    this._booted = true;
    const resolve = (path: string) => path.replace(/^~\//, `${knownFolders.currentApp().path}/`);
    const base = resolve(src);
    const pakBase = resolve(this.pakSrc || src);
    const pak = NSData.dataWithContentsOfFile(`${pakBase}.pak`);
    const bundle = NSString.stringWithContentsOfFileEncodingError(
      `${base}.pocketjs`,
      NSUTF8StringEncoding,
    );
    if (!pak || !bundle) {
      this.notify({
        eventName: "error",
        object: this,
        message: `pocket app assets not found: ${base}.pocketjs / ${pakBase}.pak`,
      } as never);
      return;
    }
    // Failures surface through the native onError callback (the plugin's `error` event).
    if (!native.loadPak(pak)) return;
    if (!native.evalBundleLabel(bundle, base.split("/").pop() || "app")) return;
    native.start();
    this.notify({ eventName: "loaded", object: this });
  }
}

function nativeWindow(view: View): UIWindow | null {
  const native = view.nativeViewProtected as UIView | null;
  return native?.window ?? null;
}

/** Device capabilities that pick the guest variant; POCKET_HOME_DENSITY / POCKET_HOME_HZ pin them. */
function deviceProfile(window: UIWindow | null): { screenScale: number; maxFps: number } {
  const screen = window?.windowScene?.screen ?? UIScreen.mainScreen;
  const env = NSProcessInfo.processInfo.environment;
  const pinned = (key: string) => {
    const value = Number(env.objectForKey(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return {
    screenScale: pinned("POCKET_HOME_DENSITY") ?? screen.scale,
    maxFps: pinned("POCKET_HOME_HZ") ?? screen.maximumFramesPerSecond,
  };
}

function floorSize(size: { width: number; height: number }): Size {
  return { width: Math.floor(size.width), height: Math.floor(size.height) };
}

/** Safe-area panel in window DIPs, plus the window size (for the UI scale). */
interface PanelGeometry {
  readonly origin: { x: number; y: number };
  readonly panel: Size;
  readonly window: Size;
}

function panelGeometry(window: UIWindow | null): PanelGeometry | null {
  if (!window) return null;
  const windowSize = floorSize(window.bounds.size);
  const sa = window.safeAreaInsets;
  const left = Math.round(sa.left);
  const top = Math.round(sa.top);
  const panel = {
    width: windowSize.width - left - Math.round(sa.right),
    height: windowSize.height - top - Math.round(sa.bottom),
  };
  return isMountablePanel(panel)
    ? { origin: { x: left, y: top }, panel, window: windowSize }
    : null;
}

export function mountPocketGuest(page: Page, staged: StagedApp, plan: StagedPlan | null): void {
  const variants: GuestVariant[] = staged.variants?.length
    ? staged.variants
    : [
        {
          density: plan?.viewport.rasterDensity ?? 2,
          tickHz: staged.tickHz ?? 60,
          bundle: staged.app,
          pak: staged.app,
        },
      ];
  if (staged.externalGuest) {
    console.warn("[pocket-home] externalGuest staging is not supported; using PocketView");
  }

  // Full-window root; the surface is placed on the safe-area panel explicitly.
  const root = new AbsoluteLayout();
  styleShellRoot(root);
  page.content = root;

  let surface: PocketHomeSurface | null = null;
  let logical: Size | null = null;

  const mount = (g: PanelGeometry) => {
    const size = surfaceViewport(g.panel, g.window).logical;
    const device = deviceProfile(nativeWindow(root));
    // Drawn on the GPU, so no raster budget: the density of the screen (text 1:1 on device
    // pixels) at the display's full rate (120 Hz on ProMotion).
    const variant = pickGuestVariant(variants, {
      pixelsPerLogical: device.screenScale * surfaceViewport(g.panel, g.window).scale,
      maxFps: device.maxFps,
    })!;
    const view = new PocketHomeSurface();
    // Density and tick rate must match the guest build (glyph atlases / baked frame counts).
    view.density = variant.density;
    view.tickRate = variant.tickHz;
    view.pakSrc = `~/assets/pocket/${variant.pak}`;
    view.viewportWidth = size.width;
    view.viewportHeight = size.height;
    stylePocketSurface(view);
    view.on("error", (event) => {
      console.error("[pocket-home] surface error:", (event as { message?: string }).message);
    });
    console.log(
      `[pocket-home] mount surface logical ${size.width}x${size.height} ` +
        `panel ${g.panel.width}x${g.panel.height}@${g.origin.x},${g.origin.y} ` +
        `guest ${variant.density}x@${variant.tickHz}Hz (screen ${device.screenScale}x, ${device.maxFps} fps)`,
    );
    surface = view;
    logical = size;
    place(g);
    root.addChild(view);
    view.src = `~/assets/pocket/${variant.bundle}`;
  };

  /** Frames the surface on the panel and resizes the live guest to it (synchronously). */
  const place = (g: PanelGeometry) => {
    if (!surface) return;
    AbsoluteLayout.setLeft(surface, g.origin.x);
    AbsoluteLayout.setTop(surface, g.origin.y);
    surface.width = g.panel.width;
    surface.height = g.panel.height;
    surface.pinnedFrame = CGRectMake(g.origin.x, g.origin.y, g.panel.width, g.panel.height);
    const native = surface.nativeViewProtected as (PocketSurfaceNative & UIView) | null;
    // Framed now, in this layout pass: the view presents at its new size right away.
    if (native && !CGRectEqualToRect(native.frame, surface.pinnedFrame)) {
      native.frame = surface.pinnedFrame;
      native.layoutIfNeeded();
    }
    const size = surfaceViewport(g.panel, g.window).logical;
    if (sameSize(size, logical)) return;
    if (native && !native.setLogicalWidthLogicalHeight(size.width, size.height)) return;
    // Before the native view exists the new size simply becomes the mount size.
    surface.viewportWidth = size.width;
    surface.viewportHeight = size.height;
    logical = size;
    console.log(`[pocket-home] surface resized ${size.width}x${size.height}`);
  };

  // The root spans the window, so it re-lays out on every bounds change (rotation, Stage
  // Manager, split view).
  let mountQueued = false;
  root.on(View.layoutChangedEvent, () => {
    applyWindowChrome();
    const g = panelGeometry(nativeWindow(root));
    if (surface) {
      if (g) place(g);
      return;
    }
    // The first mount waits for this layout pass to end: a child added during it is never laid
    // out (the surface stayed 0x0).
    if (!g || mountQueued) return;
    mountQueued = true;
    setTimeout(() => {
      const current = panelGeometry(nativeWindow(root));
      if (current) mount(current);
      else mountQueued = false;
    }, 0);
  });
}
