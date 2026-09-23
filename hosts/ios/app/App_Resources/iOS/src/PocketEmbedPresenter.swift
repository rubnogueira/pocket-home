import UIKit

/// Window-level glue for the Pocket Home shell (called from `src/ios-chrome.ts`).
@objc public class PocketEmbedPresenter: NSObject {
    /// App surface colour (Tailwind slate-900). The window background shows through the
    /// safe-area bands (status bar, home indicator) and behind a surface being swapped.
    @objc public static let chrome = UIColor(
        red: 15.0 / 255.0,
        green: 23.0 / 255.0,
        blue: 42.0 / 255.0,
        alpha: 1.0
    )

    @objc public static func applyWindowChrome() {
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                window.backgroundColor = chrome
                window.overrideUserInterfaceStyle = .dark
            }
        }
        if let container = NativeScriptViewFactory.app {
            container.view.backgroundColor = chrome
            container.overrideUserInterfaceStyle = .dark
        }
    }

    /// Frees a replaced Pocket surface immediately (guest realm, core, GPU state). Forwards to
    /// `-[PocketSurfaceView pocketHome_releaseResources]` (PocketSurfaceView+PocketHome.m), which
    /// JS cannot call directly: category methods are not in the NativeScript metadata.
    @objc public static func releaseSurface(_ view: UIView) {
        let selector = NSSelectorFromString("pocketHome_releaseResources")
        if view.responds(to: selector) {
            view.perform(selector)
        }
    }
}
