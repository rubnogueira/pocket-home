// GPU backends for PocketRenderer (PocketRenderer.m builds the batches; a backend owns the
// textures, uploads the vertices and draws). OpenGL ES 2 (PocketGLBackend.m) runs on every tier;
// Metal (PocketMetalBackend.m) on arm64 — the modern app, the Simulator (whose OpenGL ES is not
// accelerated: ~65 ms per 3x iPhone frame) and the 64-bit jailbreak tiers.

#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef struct {
  float x, y, u, v;
  uint32_t color;  // ABGR = R,G,B,A bytes (normalized)
} PGVertex;

typedef struct {
  uint32_t start, count;  // quads
  uint32_t tex;           // backend texture id (0 = not chosen yet)
  float white;            // uv of tex's white block, < 0 = none
  BOOL scissored;
  int sx, sy, sw, sh;     // top-left origin, px inside the viewport
} PGBatch;

// Every batch is `vertex colour x texel` with straight-alpha blending (src alpha, 1 - src alpha)
// in sRGB byte space, indexed [0 1 2 0 2 3] per quad; each batch's quads start at vertex 0 of
// its own range (u16 indices), at most 16384 quads per batch.
#define POCKET_MAX_BATCH_QUADS 16384

@protocol PocketRenderBackend <NSObject>

// The layer-backed view frames are presented in (the host adds and sizes it).
@property(nonatomic, readonly) UIView *view;
@property(nonatomic, readonly) NSString *name;

// A w x h RGBA8 texture, filled from `pixels` (w*h*4 bytes); 0 on failure.
- (uint32_t)createTextureWidth:(int)width
                        height:(int)height
                        linear:(BOOL)linear
                        pixels:(const void *)pixels;
- (void)updateTexture:(uint32_t)texture
                    x:(int)x
                    y:(int)y
                width:(int)width
               height:(int)height
               pixels:(const void *)pixels;
- (void)deleteTexture:(uint32_t)texture;

// Size the drawable to the view (px). NO when there is nothing to draw into; *resized = YES when
// the size changed since the last call (the previous frame is gone).
- (BOOL)prepareDrawableWidth:(int *)width height:(int *)height resized:(BOOL *)resized;

// Encode one frame: clear, then the batches inside `viewport` (px, top-left origin).
- (void)drawVertices:(const PGVertex *)vertices
               quads:(uint32_t)quads
             batches:(const PGBatch *)batches
               count:(uint32_t)count
            viewport:(CGRect)viewport;

// Show the frame drawVertices encoded.
- (void)present;

@end

// nil when the API is unavailable (no OpenGL ES 2 context / no Metal device or a 32-bit build).
id<PocketRenderBackend> _Nullable PocketGLBackendCreate(CGRect frame);
id<PocketRenderBackend> _Nullable PocketMetalBackendCreate(CGRect frame);

NS_ASSUME_NONNULL_END
