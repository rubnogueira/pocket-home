// Pocket Home glue for `PocketSurfaceView` in the modern app.
//
// The PocketApple.xcframework this app links is Pocket Home's build (tools/ios-app/
// pocket-apple-framework.ts): engine/ios-takeover + hosts/ios/takeover/PocketSurfaceView, the same
// host view as the jailbreak tiers — OpenGL ES rendering, live resize (rotation relayouts the live
// guest, presented inside the layout pass), 11-bit touch. What stays here is shell-specific:
//
//  * Chrome — the surface's background is the app colour, so nothing black shows around it.
//  * Perf — `[pocket-perf]` lines (the view's frame timings) every 120 frames.
//  * Teardown — `pocketHome_releaseResources` for PocketEmbedPresenter.releaseSurface.
//  * Self-test — `POCKET_HOME_SELFTEST` (set via `SIMCTL_CHILD_POCKET_HOME_SELFTEST`) drives
//    synthetic touches and scene rotations, for Simulator runs without a GUI session.

#import <QuartzCore/QuartzCore.h>
#import <UIKit/UIKit.h>

#import <objc/runtime.h>

#import <PocketApple/PocketSurfaceView.h>

// Matches the app surface (Tailwind slate-900) so the safe-area bands, the window behind a
// rotating surface, and the surface's own background all read as one colour.
static UIColor *PocketHomeChromeColor(void) {
  return [UIColor colorWithRed:15.0 / 255.0 green:23.0 / 255.0 blue:42.0 / 255.0 alpha:1.0];
}

static __weak PocketSurfaceView *gActiveSurface;

@implementation PocketSurfaceView (PocketHome)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [PocketSurfaceView class];
    Method original = class_getInstanceMethod(cls, @selector(didMoveToWindow));
    Method replacement = class_getInstanceMethod(cls, @selector(pocketHome_didMoveToWindow));
    if (class_addMethod(cls, @selector(didMoveToWindow), method_getImplementation(replacement),
                        method_getTypeEncoding(replacement))) {
      class_replaceMethod(cls, @selector(pocketHome_didMoveToWindow),
                          method_getImplementation(original), method_getTypeEncoding(original));
    } else {
      method_exchangeImplementations(original, replacement);
    }
  });
}

- (void)pocketHome_didMoveToWindow {
  [self pocketHome_didMoveToWindow];
  self.backgroundColor = PocketHomeChromeColor();
  self.opaque = YES;
  self.logTimings = YES;
  if (self.window != nil) {
    gActiveSurface = self;
    // Self-test timings are relative to the first surface reaching a window (the UI is up).
    static dispatch_once_t selfTestOnce;
    dispatch_once(&selfTestOnce, ^{
      [PocketSurfaceView pocketHome_scheduleSelfTest];
    });
  }
}

/// Called from JS through PocketEmbedPresenter.releaseSurface.
- (void)pocketHome_releaseResources {
  [self releaseResources];
}

// ---- self-test (Simulator automation; inert unless POCKET_HOME_SELFTEST is set) ----------------

// Run-loop timers in common modes, like the display link: they keep firing while UIKit tracks
// a gesture or runs a rotation transition.
static void PHAfter(double seconds, dispatch_block_t block) {
  NSTimer *timer = [NSTimer timerWithTimeInterval:MAX(seconds, 0.0)
                                          repeats:NO
                                            block:^(NSTimer *t) {
                                              block();
                                            }];
  [[NSRunLoop mainRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
}

/// Normalised (0..1) point inside the active surface, in its view coordinates.
static CGPoint PHSurfacePoint(PocketSurfaceView *view, double nx, double ny) {
  CGSize size = view.bounds.size;
  return CGPointMake(nx * size.width, ny * size.height);
}

static PocketSurfaceView *PHSelfTestSurface(void) {
  PocketSurfaceView *view = gActiveSurface;
  if (view == nil) NSLog(@"[pocket-selftest] no active surface");
  return view;
}

static void PHSelfTestTap(double nx, double ny) {
  PocketSurfaceView *view = PHSelfTestSurface();
  if (view == nil) return;
  CGPoint p = PHSurfacePoint(view, nx, ny);
  NSLog(@"[pocket-selftest] tap %.2f,%.2f -> view %.0f,%.0f (surface %.0fx%.0f logical %ux%u)", nx,
        ny, p.x, p.y, view.bounds.size.width, view.bounds.size.height, view.logicalWidth,
        view.logicalHeight);
  [view injectTouchAtPoint:p phase:0];
  PHAfter(0.08, ^{
    [view injectTouchAtPoint:p phase:2];
  });
}

/// Vertical drag over ~0.5 s (30 moves at 60 Hz), then release with momentum.
static void PHSelfTestDrag(double nx, double fromY, double toY) {
  PocketSurfaceView *view = PHSelfTestSurface();
  if (view == nil) return;
  NSLog(@"[pocket-selftest] drag x=%.2f y %.2f -> %.2f", nx, fromY, toY);
  const int steps = 30;
  [view injectTouchAtPoint:PHSurfacePoint(view, nx, fromY) phase:0];
  for (int i = 1; i <= steps; i++) {
    double y = fromY + (toY - fromY) * i / steps;
    PHAfter(i / 60.0, ^{
      [view injectTouchAtPoint:PHSurfacePoint(view, nx, y) phase:i == steps ? 2 : 1];
    });
  }
}

static void PHSelfTestRotate(UIInterfaceOrientationMask mask, UIDeviceOrientation device,
                             NSString *label) {
  PocketSurfaceView *view = gActiveSurface;
  UIWindowScene *scene = view.window.windowScene;
  if (scene == nil) {
    for (UIScene *candidate in UIApplication.sharedApplication.connectedScenes) {
      if ([candidate isKindOfClass:[UIWindowScene class]]) scene = (UIWindowScene *)candidate;
    }
  }
  NSLog(@"[pocket-selftest] rotate %@", label);
  // A headless Simulator has no Device > Rotate; mirror what a physical turn does: the device
  // orientation changes, then the scene asks its root controller for a new interface orientation.
  [[UIDevice currentDevice] setValue:@(device) forKey:@"orientation"];
  if (@available(iOS 16.0, *)) {
    UIViewController *root = scene.keyWindow.rootViewController;
    [root setNeedsUpdateOfSupportedInterfaceOrientations];
    UIWindowSceneGeometryPreferencesIOS *prefs =
        [[UIWindowSceneGeometryPreferencesIOS alloc] initWithInterfaceOrientations:mask];
    [scene requestGeometryUpdateWithPreferences:prefs
                                   errorHandler:^(NSError *error) {
                                     NSLog(@"[pocket-selftest] rotate %@ failed: %@", label, error);
                                   }];
  }
  PHAfter(1.0, ^{
    // The window must track the scene (it froze at its first rotated size while the runtime
    // starved the main queue — see NativeScriptApp.swift).
    CGSize window = scene.keyWindow.bounds.size;
    CGSize sceneSize = scene.coordinateSpace.bounds.size;
    PocketSurfaceView *surface = gActiveSurface;
    NSLog(@"[pocket-selftest] after rotate %@: interface=%ld window=%.0fx%.0f scene=%.0fx%.0f "
          @"surface=%.0fx%.0f logical=%ux%u%@",
          label, (long)scene.interfaceOrientation, window.width, window.height, sceneSize.width,
          sceneSize.height, surface.bounds.size.width, surface.bounds.size.height,
          surface.logicalWidth, surface.logicalHeight,
          CGSizeEqualToSize(window, sceneSize) ? @"" : @" MISMATCH");
    NSDictionary *timings = surface.frameTimings;
    NSLog(@"[pocket-selftest] resize trace %@", timings[@"resize_trace"]);
  });
}

/// Script grammar: steps separated by ';', each `<delay-seconds>:<action>[:args]`, where action is
/// tap:nx,ny | drag:nx,fromY,toY | rotate:portrait|landscape|landscapeLeft|upsideDown | mark:text.
+ (void)pocketHome_scheduleSelfTest {
  NSString *script = NSProcessInfo.processInfo.environment[@"POCKET_HOME_SELFTEST"];
  if (script.length == 0) {
    return;
  }
  NSLog(@"[pocket-selftest] script %@", script);
  double at = 0;
  for (NSString *raw in [script componentsSeparatedByString:@";"]) {
    NSArray<NSString *> *parts = [raw componentsSeparatedByString:@":"];
    if (parts.count < 2) continue;
    at += parts[0].doubleValue;
    NSString *action = parts[1];
    NSArray<NSString *> *args =
        parts.count > 2 ? [parts[2] componentsSeparatedByString:@","] : @[];
    NSLog(@"[pocket-selftest] +%.2fs %@", at, raw);
    PHAfter(at, ^{
      NSLog(@"[pocket-selftest] run %@", raw);
      if ([action isEqualToString:@"tap"] && args.count == 2) {
        PHSelfTestTap(args[0].doubleValue, args[1].doubleValue);
      } else if ([action isEqualToString:@"drag"] && args.count == 3) {
        PHSelfTestDrag(args[0].doubleValue, args[1].doubleValue, args[2].doubleValue);
      } else if ([action isEqualToString:@"rotate"] && args.count == 1) {
        NSString *o = args[0];
        // Interface landscape-right corresponds to device landscape-left (home button right).
        UIInterfaceOrientationMask mask = UIInterfaceOrientationMaskPortrait;
        UIDeviceOrientation device = UIDeviceOrientationPortrait;
        if ([o isEqualToString:@"landscape"]) {
          mask = UIInterfaceOrientationMaskLandscapeRight;
          device = UIDeviceOrientationLandscapeLeft;
        } else if ([o isEqualToString:@"landscapeLeft"]) {
          mask = UIInterfaceOrientationMaskLandscapeLeft;
          device = UIDeviceOrientationLandscapeRight;
        } else if ([o isEqualToString:@"upsideDown"]) {
          mask = UIInterfaceOrientationMaskPortraitUpsideDown;
          device = UIDeviceOrientationPortraitUpsideDown;
        }
        PHSelfTestRotate(mask, device, o);
      } else if ([action isEqualToString:@"mark"]) {
        NSLog(@"[pocket-selftest] mark %@", args.firstObject ?: @"");
      }
    });
  }
}

@end
