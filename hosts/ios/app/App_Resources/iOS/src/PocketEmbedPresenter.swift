import UIKit

@objc public class PocketEmbedPresenter: NSObject {
    private static let chrome = UIColor(
        red: 2.0 / 255.0,
        green: 6.0 / 255.0,
        blue: 23.0 / 255.0,
        alpha: 1.0
    )

    @objc public static func windowSafeAreaInsets() -> NSDictionary {
        guard let window = NativeScriptViewFactory.getKeyWindow() else {
            return ["top": 0, "bottom": 0, "left": 0, "right": 0]
        }
        let insets = window.safeAreaInsets
        return [
            "top": Double(insets.top),
            "bottom": Double(insets.bottom),
            "left": Double(insets.left),
            "right": Double(insets.right),
        ]
    }

    /// Embeds the NativeScript root VC the same way `NativeScriptMainWindow` does.
    @objc public static func presentRoot(_ viewController: UIViewController) {
        NativeScriptViewFactory.initShared()
        guard let app = NativeScriptViewFactory.app else {
            return
        }
        viewController.view.frame = app.view.bounds
        viewController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        app.addChild(viewController)
        app.view.addSubview(viewController.view)
        viewController.didMove(toParent: app)
        applyChrome(to: viewController)
        applyChromeToHost()
    }

    @objc public static func syncEmbeddedRootLayout() {
        guard let container = NativeScriptViewFactory.app else {
            return
        }
        let bounds = layoutBounds(for: container)
        guard bounds.width > 0, bounds.height > 0 else {
            DispatchQueue.main.async { syncEmbeddedRootLayout() }
            return
        }
        configureFullBleed(container)
        container.view.frame = bounds
        container.view.bounds = CGRect(origin: .zero, size: bounds.size)
        for child in container.children {
            configureFullBleed(child)
            child.view.frame = bounds
            child.view.bounds = CGRect(origin: .zero, size: bounds.size)
            child.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            child.view.transform = .identity
            child.view.setNeedsLayout()
            child.view.layoutIfNeeded()
        }
        container.view.setNeedsLayout()
        container.view.layoutIfNeeded()
    }

    @objc public static func applyChromeToHost() {
        guard let container = NativeScriptViewFactory.app else {
            return
        }
        configureFullBleed(container)
        container.view.backgroundColor = chrome
        if #available(iOS 13.0, *) {
            container.overrideUserInterfaceStyle = .dark
        }
        if let window = NativeScriptViewFactory.getKeyWindow() {
            window.backgroundColor = chrome
        }
        syncEmbeddedRootLayout()
    }

    private static func layoutBounds(for container: UIViewController) -> CGRect {
        if let window = NativeScriptViewFactory.getKeyWindow() {
            return window.bounds
        }
        return container.view.bounds
    }

    private static func configureFullBleed(_ controller: UIViewController) {
        controller.edgesForExtendedLayout = .all
        controller.extendedLayoutIncludesOpaqueBars = true
        if #available(iOS 11.0, *) {
            controller.view.insetsLayoutMarginsFromSafeArea = false
            controller.additionalSafeAreaInsets = .zero
        }
        controller.view.backgroundColor = chrome
    }

    private static func applyChrome(to viewController: UIViewController) {
        configureFullBleed(viewController)
        viewController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        if #available(iOS 13.0, *) {
            viewController.overrideUserInterfaceStyle = .dark
        }
    }
}
