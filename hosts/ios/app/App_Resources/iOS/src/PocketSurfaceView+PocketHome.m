// Pocket Home: full-bleed compositing when panel matches logical viewport.

#import <UIKit/UIKit.h>
#import <objc/runtime.h>

#import <PocketApple/PocketSurfaceView.h>
#import <PocketApple/pocket_apple.h>

static UIColor *PocketHomeChromeColor(void) {
  return [UIColor colorWithRed:2.0 / 255.0
                         green:6.0 / 255.0
                          blue:23.0 / 255.0
                         alpha:1.0];
}

static void PocketHomeSwizzleInstanceMethod(Class cls, SEL originalSel, SEL swizzledSel) {
  Method originalMethod = class_getInstanceMethod(cls, originalSel);
  Method swizzledMethod = class_getInstanceMethod(cls, swizzledSel);
  if (!originalMethod || !swizzledMethod) {
    return;
  }
  if (class_addMethod(cls, originalSel, method_getImplementation(swizzledMethod),
                      method_getTypeEncoding(swizzledMethod))) {
    class_replaceMethod(cls, swizzledSel, method_getImplementation(originalMethod),
                        method_getTypeEncoding(originalMethod));
  } else {
    method_exchangeImplementations(originalMethod, swizzledMethod);
  }
}

static void PocketHomeApplySurfaceChrome(PocketSurfaceView *view) {
  view.backgroundColor = PocketHomeChromeColor();
  view.opaque = YES;
  view.layer.contentsGravity = kCAGravityResize;
  view.layer.contentsRect = CGRectMake(0, 0, 1, 1);
}

static BOOL PocketHomePanelMatchesLogical(PocketSurfaceView *view) {
  CGSize bounds = view.bounds.size;
  if (bounds.width <= 0 || bounds.height <= 0) {
    return NO;
  }
  uint32_t lw = view.logicalWidth;
  uint32_t lh = view.logicalHeight;
  if (lw == 0 || lh == 0) {
    return NO;
  }
  return fabs(bounds.width - (CGFloat)lw) < 2.0 && fabs(bounds.height - (CGFloat)lh) < 2.0;
}

@interface PocketSurfaceView (PocketHomePresent)
- (void)presentFrame:(const PocketAppleFrame *)frame;
- (CGRect)fittedContentRect;
@end

@implementation PocketSurfaceView (PocketHome)

+ (void)load {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    Class cls = [PocketSurfaceView class];
    PocketHomeSwizzleInstanceMethod(cls, @selector(didMoveToWindow),
                                    @selector(pocketHome_didMoveToWindow));
    PocketHomeSwizzleInstanceMethod(cls, @selector(layoutSubviews),
                                    @selector(pocketHome_layoutSubviews));
    PocketHomeSwizzleInstanceMethod(cls, @selector(presentFrame:),
                                    @selector(pocketHome_presentFrame:));
    PocketHomeSwizzleInstanceMethod(cls, @selector(fittedContentRect),
                                    @selector(pocketHome_fittedContentRect));
  });
}

- (void)pocketHome_presentFrame:(const PocketAppleFrame *)frame {
  if (frame->region_count == 0 && self.layer.contents != nil) {
    PocketHomeApplySurfaceChrome((PocketSurfaceView *)self);
    return;
  }
  [self pocketHome_presentFrame:frame];
  PocketHomeApplySurfaceChrome((PocketSurfaceView *)self);
}

- (CGRect)pocketHome_fittedContentRect {
  PocketSurfaceView *view = (PocketSurfaceView *)self;
  CGSize bounds = view.bounds.size;
  if (bounds.width <= 0 || bounds.height <= 0) {
    return [self pocketHome_fittedContentRect];
  }
  // Full-bleed touch mapping whenever the panel has real size (Pocket Home shell
  // always remounts the sidecar to match key-window bounds).
  return CGRectMake(0, 0, bounds.width, bounds.height);
}

- (void)pocketHome_didMoveToWindow {
  [self pocketHome_didMoveToWindow];
  PocketHomeApplySurfaceChrome((PocketSurfaceView *)self);
}

- (void)pocketHome_layoutSubviews {
  [self pocketHome_layoutSubviews];
  PocketSurfaceView *view = (PocketSurfaceView *)self;
  view.transform = CGAffineTransformIdentity;
  PocketHomeApplySurfaceChrome(view);
}

@end
