/*
 * Pocket Home — jailbroken iOS device host (pocket-apple / UIKit).
 * Logical size and host ABI come from the build (pocket.json + tier).
 */

#import <UIKit/UIKit.h>

#include <unistd.h>

#import "PocketSurfaceView.h"

#ifndef POCKETJS_BUILD_ID
#define POCKETJS_BUILD_ID "development"
#endif

#ifndef POCKETJS_APP_OUTPUT
#define POCKETJS_APP_OUTPUT "pocket-home-main"
#endif

#ifndef POCKETJS_LOGICAL_WIDTH
#define POCKETJS_LOGICAL_WIDTH 1024
#endif

#ifndef POCKETJS_LOGICAL_HEIGHT
#define POCKETJS_LOGICAL_HEIGHT 768
#endif

#ifndef POCKETJS_RASTER_DENSITY
#define POCKETJS_RASTER_DENSITY 1
#endif

#ifndef POCKETJS_HOST_ID
#define POCKETJS_HOST_ID "ios-native"
#endif

#ifndef POCKETJS_HOST_ABI
#define POCKETJS_HOST_ABI 11
#endif

#ifndef POCKETJS_TIER_ID
#define POCKETJS_TIER_ID "unknown"
#endif

static NSString *const PocketStatusPath =
    @"/private/var/tmp/pocketjs-ios-native.status.json";
static NSString *const PocketFramePath =
    @"/private/var/tmp/pocketjs-ios-native.frame.png";
static const CGFloat PocketMinimumVisibleBrightness = 0.05;
static const CGFloat PocketRecoveredBrightness = 0.60;

@interface PocketViewController : UIViewController
// The surface to keep sized to this view (rotation / split view relayout the app live).
@property(nonatomic, weak) PocketSurfaceView *surface;
@end

@implementation PocketViewController
- (void)viewDidLayoutSubviews {
  [super viewDidLayoutSubviews];
  // Logical px = the view's points: the app lays out for the orientation it is shown in
  // instead of letterboxing the build's design canvas.
  CGSize size = self.view.bounds.size;
  if (self.surface != nil && size.width >= 1 && size.height >= 1) {
    [self.surface setLogicalWidth:(uint32_t)floor(size.width)
                    logicalHeight:(uint32_t)floor(size.height)];
  }
}
- (BOOL)prefersStatusBarHidden {
  return YES;
}
- (UIInterfaceOrientationMask)supportedInterfaceOrientations {
  return UIInterfaceOrientationMaskAll;
}
// iOS 5 asks this instead (and defaults to portrait only on iPhone).
- (BOOL)shouldAutorotateToInterfaceOrientation:(UIInterfaceOrientation)orientation {
  (void)orientation;
  return YES;
}
- (void)viewDidAppear:(BOOL)animated {
  [super viewDidAppear:animated];
  // Diagnostics: while /private/var/tmp/pocket-rotate exists, rotate between landscape and
  // portrait every 5 s (rotation measurements without turning the device).
  if ([[NSFileManager defaultManager] fileExistsAtPath:@"/private/var/tmp/pocket-rotate"]) {
    [NSTimer scheduledTimerWithTimeInterval:5.0
                                     target:self
                                   selector:@selector(rotateForDiagnostics)
                                   userInfo:nil
                                    repeats:YES];
  }
}
- (void)rotateForDiagnostics {
  BOOL portrait = self.view.bounds.size.height > self.view.bounds.size.width;
  UIInterfaceOrientation next =
      portrait ? UIInterfaceOrientationLandscapeLeft : UIInterfaceOrientationPortrait;
  [[UIDevice currentDevice] setValue:@(next) forKey:@"orientation"];
  [UIViewController attemptRotationToDeviceOrientation];
}
@end

// The bundled guest for this screen: tools/ios-native.ts bakes one per density a tier's devices
// have (`<app>@<d>x.js/.pak`; glyphs and icons are baked per density). Take the smallest density
// covering the screen scale (1x iPad 2, 2x iPhone 4 / iPad 3, 3x iPhone Plus), else the largest.
static uint32_t PocketGuestDensity(NSString *directory, NSString *appOutput) {
  uint32_t scale = (uint32_t)ceil([UIScreen mainScreen].scale);
  uint32_t best = 0;
  for (uint32_t density = 1; density <= 4; density++) {
    NSString *pak = [NSString stringWithFormat:@"%@@%ux.pak", appOutput, density];
    if (![[NSFileManager defaultManager]
            fileExistsAtPath:[directory stringByAppendingPathComponent:pak]]) {
      continue;
    }
    best = density;
    if (density >= scale) break;
  }
  return best > 0 ? best : POCKETJS_RASTER_DENSITY;
}

@interface PocketAppDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic, strong) UIWindow *window;
@property(nonatomic, strong) PocketSurfaceView *surface;
@property(nonatomic) uint64_t guestFrames;
@property(nonatomic) uint64_t completedTouchSequences;
@property(nonatomic) BOOL touchWasPresent;
@property(nonatomic, copy) NSString *state;
@property(nonatomic, copy) NSString *lastError;
@property(nonatomic) uint32_t guestDensity;
@end

@implementation PocketAppDelegate

- (NSTimeInterval)now {
  return [[NSDate date] timeIntervalSince1970];
}

- (void)keepDisplayVisible:(UIApplication *)application {
  application.idleTimerDisabled = YES;
  UIScreen *screen = [UIScreen mainScreen];
  if (screen.brightness < PocketMinimumVisibleBrightness) {
    screen.brightness = PocketRecoveredBrightness;
  }
}

- (void)writeStatus {
  CGSize points = [UIScreen mainScreen].bounds.size;
  NSDictionary *status = @{
    @"schema" : @1,
    @"tier" : [NSString stringWithUTF8String:POCKETJS_TIER_ID],
    @"build_id" : [NSString stringWithUTF8String:POCKETJS_BUILD_ID],
    @"bundle_id" : @"dev.pocket-home.dashboard",
    @"state" : self.state ?: @"unknown",
    @"pid" : @((int)getpid()),
    @"written_at" : @([self now]),
    @"guest_frames" : @(self.guestFrames),
    @"completed_touch_sequences" : @(self.completedTouchSequences),
    @"logical" : @[
      @(POCKETJS_LOGICAL_WIDTH), @(POCKETJS_LOGICAL_HEIGHT)
    ],
    @"raster_density" : @(self.guestDensity),
    @"screen_points" : @[ @(points.width), @(points.height) ],
    @"screen_scale" : @([UIScreen mainScreen].scale),
    @"screen_brightness" : @([UIScreen mainScreen].brightness),
    @"idle_timer_disabled" :
        @([UIApplication sharedApplication].idleTimerDisabled),
    @"error" : self.lastError ?: @"",
    @"logical_now" : @[
      @(self.surface.logicalWidth), @(self.surface.logicalHeight)
    ],
    @"timings" : self.surface.frameTimings ?: @{},
  };
  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:status
                                                 options:0
                                                   error:&error];
  if (data != nil && error == nil) {
    [data writeToFile:PocketStatusPath
              options:NSDataWritingAtomic
                error:nil];
  }
}

- (void)captureFrame {
  if (self.window == nil || self.window.bounds.size.width <= 0) {
    return;
  }
  UIGraphicsBeginImageContextWithOptions(self.window.bounds.size, YES,
                                         [UIScreen mainScreen].scale);
  // respondsToSelector, not @available (no compiler-rt Thumb helpers: tools/ios-native.ts NO_THUMB).
  if ([self.window respondsToSelector:@selector(drawViewHierarchyInRect:afterScreenUpdates:)]) {
    [self.window drawViewHierarchyInRect:self.window.bounds
                      afterScreenUpdates:NO];
  } else {
    // iOS 6 (armv7-ios6 tier): no view-hierarchy snapshot API; render the layer tree.
    [self.window.layer renderInContext:UIGraphicsGetCurrentContext()];
  }
  UIImage *image = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  NSData *png = image != nil ? UIImagePNGRepresentation(image) : nil;
  [png writeToFile:PocketFramePath options:NSDataWritingAtomic error:nil];
}

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  (void)launchOptions;
  [self keepDisplayVisible:application];
  self.state = @"booting";
  self.lastError = @"";
  [[NSFileManager defaultManager] removeItemAtPath:PocketFramePath error:nil];
  [self writeStatus];

  self.window =
      [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  PocketViewController *controller =
      [[PocketViewController alloc] init];
  controller.view.backgroundColor = [UIColor blackColor];

  NSString *directory = [NSBundle mainBundle].resourcePath;
  NSString *appOutput =
      [NSString stringWithUTF8String:POCKETJS_APP_OUTPUT];
  self.guestDensity = PocketGuestDensity(directory, appOutput);
  // The guest mounts at the build's design canvas; the controller's first layout pass resizes it
  // to the screen in points (PocketViewController.viewDidLayoutSubviews), before it is visible.
  self.surface = [PocketSurfaceView
      surfaceWithLogicalWidth:POCKETJS_LOGICAL_WIDTH
                logicalHeight:POCKETJS_LOGICAL_HEIGHT
                      density:self.guestDensity
                       hostId:[NSString stringWithUTF8String:POCKETJS_HOST_ID]
                      hostAbi:POCKETJS_HOST_ABI];
  self.surface.frame = controller.view.bounds;
  self.surface.autoresizingMask =
      UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [controller.view addSubview:self.surface];
  controller.surface = self.surface;
  self.window.rootViewController = controller;
  [self.window makeKeyAndVisible];

  __weak PocketAppDelegate *weakSelf = self;
  self.surface.onError = ^(NSString *message) {
    PocketAppDelegate *strongSelf = weakSelf;
    strongSelf.state = @"error";
    strongSelf.lastError =
        message ?: @"unknown PocketSurfaceView error";
    [strongSelf writeStatus];
  };
  self.surface.onFrame =
      ^(uint64_t frameNumber, NSUInteger touchCount) {
        PocketAppDelegate *strongSelf = weakSelf;
        strongSelf.guestFrames = frameNumber;
        if (touchCount > 0) {
          strongSelf.touchWasPresent = YES;
        } else if (strongSelf.touchWasPresent) {
          strongSelf.touchWasPresent = NO;
          strongSelf.completedTouchSequences += 1;
        }
        if (![strongSelf.state isEqualToString:@"running"]) {
          strongSelf.state = @"running";
        }
        if (frameNumber == 30) {
          [strongSelf captureFrame];
        }
        if (frameNumber == 1 || frameNumber % 60 == 0 ||
            touchCount > 0) {
          [strongSelf writeStatus];
        }
      };

  self.state = @"surface_created";
  [self writeStatus];
  self.state = @"loading_guest";
  [self writeStatus];
  NSString *guest = [NSString stringWithFormat:@"%@@%ux", appOutput, self.guestDensity];
  if (![self.surface loadAppNamed:guest fromDirectory:directory]) {
    self.state = @"error";
    self.lastError =
        self.surface.lastError ?: @"failed to load PocketJS guest";
    [self writeStatus];
    return YES;
  }

  self.state = @"guest_loaded";
  [self writeStatus];
  return YES;
}

- (void)applicationDidBecomeActive:(UIApplication *)application {
  [self keepDisplayVisible:application];
  self.state = @"frame_timer_started";
  [self writeStatus];
  [self.surface startWithFixedFrameTimer];
}

- (void)applicationDidEnterBackground:(UIApplication *)application {
  application.idleTimerDisabled = NO;
  self.state = @"background";
  [self writeStatus];
}

- (void)applicationWillEnterForeground:(UIApplication *)application {
  (void)application;
  self.state = @"foreground";
  [self writeStatus];
}

- (void)applicationWillTerminate:(UIApplication *)application {
  (void)application;
  self.state = @"terminated";
  [self writeStatus];
}

@end

int main(int argc, char *argv[]) {
  @autoreleasepool {
    return UIApplicationMain(argc, argv, nil,
                             NSStringFromClass([PocketAppDelegate class]));
  }
}
