import NativeScriptEmbedder
import SwiftUI

/// Same boot sequence as `@nativescript/core`'s `NativeScriptMainWindow`, with one difference:
/// the NativeScript root ignores the safe area.
///
/// `NativeScriptMainWindow` hosts the root in a plain `WindowGroup`, so SwiftUI lays it out
/// inside the safe area (e.g. 834x1158 on an 11" iPad in portrait) and re-applies that frame
/// on every layout pass — including each rotation. Anything that resized the root to the full
/// window from JS was undone on the next pass, which is why the dashboard came out shrunk,
/// letterboxed or offset after rotating. Full-bleed here makes the key window the single
/// source of truth; the NativeScript shell then places the Pocket surface inside the safe area
/// itself (`hosts/ios/app/src/ios-pocket-host.ts`).
@main
struct NativeScriptApp: App {
    init() {
        if !hasMainInit {
            hasMainInit = true
            NativeScriptViewFactory.initShared()
            NativeScriptEmbedder.sharedInstance().setDelegate(NativeScriptViewFactory.shared)
            NativeScriptEmbedder.setup()
            // The container is what SwiftUI shows between the launch screen and the first
            // NativeScript layout; unpainted it is black (dark mode), which flashed at launch.
            if let container = NativeScriptViewFactory.app {
                container.view.backgroundColor = PocketEmbedPresenter.chrome
                container.overrideUserInterfaceStyle = .dark
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            NativeScriptAppView(found: { windowScene in
                NativeScriptEmbedder.sharedInstance().setWindowScene(windowScene)
                PocketEmbedPresenter.applyWindowChrome()
            })
            .ignoresSafeArea()
            // Same colour as LaunchScreen.storyboard and the app surface, so launch reads as one
            // continuous colour until the dashboard draws.
            .background(Color(uiColor: PocketEmbedPresenter.chrome).ignoresSafeArea())
            .onAppear {
                // A WindowGroup body can re-appear (scene reconnect); boot the runtime once.
                if !hasMainBoot {
                    hasMainBoot = true
                    // `boot()` never returns: `runMainApplication` spins a nested CFRunLoop for
                    // the app's lifetime. Started from a GCD main-queue block (as upstream's
                    // `NativeScriptMainWindow` does), that block never finishes, so the serial
                    // main queue is never drained again — every `DispatchQueue.main.async` /
                    // `dispatch_after` in the process (UIKit's and SwiftUI's own rotation and
                    // window-resize work included) is silently dropped, and the window kept its
                    // first rotated size. A run-loop block does not occupy the main queue, so the
                    // nested loop keeps servicing it.
                    RunLoop.main.perform(inModes: [.common]) {
                        NativeScriptEmbedder.boot()
                    }
                }
            }
        }
    }
}
