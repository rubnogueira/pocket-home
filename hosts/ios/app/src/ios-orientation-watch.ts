import { Application } from "@nativescript/core";

/** Extra rotation signals — orientationChanged alone can fire before bounds settle on iPad. */
export function bindUiKitOrientationWatch(onBoundsChange: () => void): void {
  Application.on(Application.orientationChangedEvent, onBoundsChange);

  const center = NSNotificationCenter.defaultCenter;
  const queue = NSOperationQueue.mainQueue;
  const names = [
    UIDeviceOrientationDidChangeNotification,
    UIApplicationDidChangeStatusBarOrientationNotification,
  ];
  for (const name of names) {
    center.addObserverForNameObjectQueueUsingBlock(name, null, queue, () => {
      onBoundsChange();
    });
  }
}
