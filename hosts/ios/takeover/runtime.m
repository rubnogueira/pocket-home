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
@end

@implementation PocketViewController
- (BOOL)prefersStatusBarHidden {
  return YES;
}
- (UIInterfaceOrientationMask)supportedInterfaceOrientations {
  return UIInterfaceOrientationMaskAll;
}
@end

@interface PocketAppDelegate : UIResponder <UIApplicationDelegate>
@property(nonatomic, strong) UIWindow *window;
@property(nonatomic, strong) PocketSurfaceView *surface;
@property(nonatomic) uint64_t guestFrames;
@property(nonatomic) uint64_t completedTouchSequences;
@property(nonatomic) BOOL touchWasPresent;
@property(nonatomic, copy) NSString *state;
@property(nonatomic, copy) NSString *lastError;
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
    @"raster_density" : @(POCKETJS_RASTER_DENSITY),
    @"screen_points" : @[ @(points.width), @(points.height) ],
    @"screen_scale" : @([UIScreen mainScreen].scale),
    @"screen_brightness" : @([UIScreen mainScreen].brightness),
    @"idle_timer_disabled" :
        @([UIApplication sharedApplication].idleTimerDisabled),
    @"error" : self.lastError ?: @"",
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
  [self.window drawViewHierarchyInRect:self.window.bounds
                    afterScreenUpdates:NO];
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

  self.surface = [PocketSurfaceView
      surfaceWithLogicalWidth:POCKETJS_LOGICAL_WIDTH
                logicalHeight:POCKETJS_LOGICAL_HEIGHT
                      density:POCKETJS_RASTER_DENSITY
                       hostId:[NSString stringWithUTF8String:POCKETJS_HOST_ID]
                      hostAbi:POCKETJS_HOST_ABI];
  self.surface.frame = controller.view.bounds;
  self.surface.autoresizingMask =
      UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [controller.view addSubview:self.surface];
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
  NSString *directory = [NSBundle mainBundle].resourcePath;
  NSString *appOutput =
      [NSString stringWithUTF8String:POCKETJS_APP_OUTPUT];
  self.state = @"loading_guest";
  [self writeStatus];
  if (![self.surface loadAppNamed:appOutput fromDirectory:directory]) {
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
