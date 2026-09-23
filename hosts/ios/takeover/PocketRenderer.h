// PocketRenderer — GPU backend for the PocketJS DrawList (takeover tiers and the modern app), a
// port of hosts/web/gpu.js. The CPU rasterizer costs ~10 ms per full-screen frame on an A5
// (1024x768 at 1x), so a scroll, which repaints everything, ran at ~20-40 fps; the GPU draws the
// same DrawList in a few hundred microseconds of CPU. Inputs are engine/ios-takeover's
// pocket_apple_gpu_* exports; drawing goes through Metal (arm64) or OpenGL ES 2 (every tier),
// see PocketRenderBackend.h. Main thread only.

#import <QuartzCore/QuartzCore.h>
#import <UIKit/UIKit.h>

#include "pocket_apple.h"

NS_ASSUME_NONNULL_BEGIN

@interface PocketRenderer : NSObject

// Metal when available (arm64) unless `preferGL`, else OpenGL ES 2; nil when neither is (the host
// keeps the software rasterizer).
+ (nullable instancetype)rendererWithFrame:(CGRect)frame preferGL:(BOOL)preferGL;

// The layer-backed view frames are presented in; the host adds it and keeps it sized.
@property(nonatomic, readonly) UIView *view;
// "metal" or "gles2".
@property(nonatomic, readonly) NSString *backendName;

// Build and encode this frame for the handle's logical size. NO when the DrawList is unchanged
// since the last presented frame (the screen is current: skip -present).
- (BOOL)prepareFrame:(PocketApple *)handle
        logicalWidth:(uint32_t)logicalWidth
       logicalHeight:(uint32_t)logicalHeight;

// Show the frame -prepareFrame built.
- (void)present;

// Last prepared frame: draw calls, quads, DrawList words ...
@property(nonatomic, readonly) uint32_t draws;
@property(nonatomic, readonly) uint32_t quads;
@property(nonatomic, readonly) uint32_t words;
// ... and its CPU phases (ms): resource sync (0 when nothing changed), batch build; `syncs` = 1
// when resources were re-synced.
@property(nonatomic, readonly) double syncMs;
@property(nonatomic, readonly) double buildMs;
@property(nonatomic, readonly) uint32_t syncs;

@end

NS_ASSUME_NONNULL_END
