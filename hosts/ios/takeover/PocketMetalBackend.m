// Metal backend for PocketRenderer (arm64 only): the modern app on current iOS, where OpenGL ES
// is deprecated, the Simulator, where OpenGL ES is not accelerated (39 draws of a 3x iPhone frame
// took ~65 ms there, Metal a fraction of a millisecond), and the 64-bit jailbreak tiers. Same
// vertex format, blending and `colour x texel` shading as PocketGLBackend.m.

#import "PocketRenderBackend.h"

#if defined(__arm64__)

#import <Metal/Metal.h>
#import <QuartzCore/CAMetalLayer.h>

#define POCKET_FRAMES_IN_FLIGHT 3

@interface PocketMetalView : UIView
@end

@implementation PocketMetalView

+ (Class)layerClass {
  return [CAMetalLayer class];
}

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    CAMetalLayer *layer = (CAMetalLayer *)self.layer;
    layer.opaque = YES;
    layer.pixelFormat = MTLPixelFormatBGRA8Unorm;
    layer.framebufferOnly = YES;
    // Never scale a frame to other bounds (the rotation animation interpolates them).
    layer.contentsGravity = kCAGravityCenter;
    self.userInteractionEnabled = NO;
    self.contentScaleFactor = [UIScreen mainScreen].scale;
  }
  return self;
}

@end

@interface PocketMetalBackend : NSObject <PocketRenderBackend>
@end

@implementation PocketMetalBackend {
  PocketMetalView *_view;
  id<MTLDevice> _device;
  id<MTLCommandQueue> _queue;
  id<MTLRenderPipelineState> _pipeline;
  id<MTLSamplerState> _linearSampler, _nearestSampler;
  id<MTLBuffer> _indices;
  id<MTLBuffer> _vertexRing[POCKET_FRAMES_IN_FLIGHT];
  NSUInteger _ringIndex;
  dispatch_semaphore_t _inFlight;
  NSMutableDictionary<NSNumber *, id<MTLTexture>> *_textures;
  NSMutableSet<NSNumber *> *_linearTextures;
  uint32_t _nextTexture;
  CGSize _drawableSize;
  id<MTLCommandBuffer> _commands;
  id<CAMetalDrawable> _drawable;
}

- (nullable instancetype)initWithFrame:(CGRect)frame {
  self = [super init];
  if (!self) return nil;
  _device = MTLCreateSystemDefaultDevice();
  if (_device == nil) return nil;
  _queue = [_device newCommandQueue];
  // Shaders: PocketRenderer.metal, precompiled next to this code (the app bundle on the
  // takeover tiers, PocketApple.framework in the modern app).
  NSError *error = nil;
  NSURL *url = [[NSBundle bundleForClass:[PocketMetalBackend class]] URLForResource:@"PocketRenderer"
                                                                      withExtension:@"metallib"];
  id<MTLLibrary> library = url != nil ? [_device newLibraryWithURL:url error:&error] : nil;
  if (library == nil) {
    NSLog(@"PocketMetalBackend: no shader library (%@): %@", url, error);
    return nil;
  }
  MTLVertexDescriptor *vertex = [MTLVertexDescriptor vertexDescriptor];
  vertex.attributes[0].format = MTLVertexFormatFloat2;
  vertex.attributes[0].offset = offsetof(PGVertex, x);
  vertex.attributes[1].format = MTLVertexFormatFloat2;
  vertex.attributes[1].offset = offsetof(PGVertex, u);
  vertex.attributes[2].format = MTLVertexFormatUChar4Normalized;
  vertex.attributes[2].offset = offsetof(PGVertex, color);
  vertex.layouts[0].stride = sizeof(PGVertex);
  MTLRenderPipelineDescriptor *pipeline = [MTLRenderPipelineDescriptor new];
  pipeline.vertexFunction = [library newFunctionWithName:@"pocket_vertex"];
  pipeline.fragmentFunction = [library newFunctionWithName:@"pocket_fragment"];
  pipeline.vertexDescriptor = vertex;
  MTLRenderPipelineColorAttachmentDescriptor *color = pipeline.colorAttachments[0];
  color.pixelFormat = MTLPixelFormatBGRA8Unorm;
  color.blendingEnabled = YES;
  color.sourceRGBBlendFactor = MTLBlendFactorSourceAlpha;
  color.destinationRGBBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
  color.sourceAlphaBlendFactor = MTLBlendFactorOne;
  color.destinationAlphaBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
  _pipeline = [_device newRenderPipelineStateWithDescriptor:pipeline error:&error];
  if (_pipeline == nil) {
    NSLog(@"PocketMetalBackend: pipeline: %@", error);
    return nil;
  }
  MTLSamplerDescriptor *sampler = [MTLSamplerDescriptor new];
  sampler.sAddressMode = sampler.tAddressMode = MTLSamplerAddressModeClampToEdge;
  sampler.minFilter = sampler.magFilter = MTLSamplerMinMagFilterLinear;
  _linearSampler = [_device newSamplerStateWithDescriptor:sampler];
  sampler.minFilter = sampler.magFilter = MTLSamplerMinMagFilterNearest;
  _nearestSampler = [_device newSamplerStateWithDescriptor:sampler];

  // Static u16 indices [0 1 2 0 2 3] per quad; each batch binds its vertices at its first quad.
  NSUInteger indexBytes = POCKET_MAX_BATCH_QUADS * 6 * sizeof(uint16_t);
  _indices = [_device newBufferWithLength:indexBytes options:MTLResourceStorageModeShared];
  uint16_t *indices = _indices.contents;
  for (uint32_t q = 0; q < POCKET_MAX_BATCH_QUADS; q++) {
    uint16_t v = (uint16_t)(q * 4);
    uint16_t *o = indices + q * 6;
    o[0] = v;
    o[1] = v + 1;
    o[2] = v + 2;
    o[3] = v;
    o[4] = v + 2;
    o[5] = v + 3;
  }
  _inFlight = dispatch_semaphore_create(POCKET_FRAMES_IN_FLIGHT);
  _textures = [NSMutableDictionary dictionary];
  _linearTextures = [NSMutableSet set];

  _view = [[PocketMetalView alloc] initWithFrame:frame];
  ((CAMetalLayer *)_view.layer).device = _device;
  return self;
}

- (UIView *)view {
  return _view;
}

- (NSString *)name {
  return @"metal";
}

// ---- textures ------------------------------------------------------------------------------

- (uint32_t)createTextureWidth:(int)width
                        height:(int)height
                        linear:(BOOL)linear
                        pixels:(const void *)pixels {
  MTLTextureDescriptor *descriptor =
      [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm
                                                         width:(NSUInteger)width
                                                        height:(NSUInteger)height
                                                     mipmapped:NO];
  descriptor.usage = MTLTextureUsageShaderRead;
  descriptor.storageMode = MTLStorageModeShared;
  id<MTLTexture> texture = [_device newTextureWithDescriptor:descriptor];
  if (texture == nil) return 0;
  if (pixels != NULL) {
    [texture replaceRegion:MTLRegionMake2D(0, 0, (NSUInteger)width, (NSUInteger)height)
               mipmapLevel:0
                 withBytes:pixels
               bytesPerRow:(NSUInteger)width * 4];
  }
  uint32_t id_ = ++_nextTexture;
  _textures[@(id_)] = texture;
  if (linear) [_linearTextures addObject:@(id_)];
  return id_;
}

- (void)updateTexture:(uint32_t)texture
                    x:(int)x
                    y:(int)y
                width:(int)width
               height:(int)height
               pixels:(const void *)pixels {
  // Regions are written once (new atlas regions, replaced slots), never while a queued frame
  // samples them.
  [_textures[@(texture)] replaceRegion:MTLRegionMake2D((NSUInteger)x, (NSUInteger)y,
                                                       (NSUInteger)width, (NSUInteger)height)
                           mipmapLevel:0
                             withBytes:pixels
                           bytesPerRow:(NSUInteger)width * 4];
}

- (void)deleteTexture:(uint32_t)texture {
  // Queued command buffers keep the texture alive until they complete.
  [_textures removeObjectForKey:@(texture)];
  [_linearTextures removeObject:@(texture)];
}

// ---- frame ---------------------------------------------------------------------------------

- (BOOL)prepareDrawableWidth:(int *)width height:(int *)height resized:(BOOL *)resized {
  CGSize bounds = _view.bounds.size;
  *resized = NO;
  if (bounds.width < 1 || bounds.height < 1) return NO;
  CGFloat scale = _view.contentScaleFactor;
  CGSize size = CGSizeMake(round(bounds.width * scale), round(bounds.height * scale));
  if (!CGSizeEqualToSize(size, _drawableSize)) {
    ((CAMetalLayer *)_view.layer).drawableSize = size;
    _drawableSize = size;
    *resized = YES;
  }
  *width = (int)size.width;
  *height = (int)size.height;
  return YES;
}

- (id<MTLBuffer>)vertexBufferFor:(const PGVertex *)vertices quads:(uint32_t)quads {
  NSUInteger bytes = MAX((NSUInteger)quads * 4 * sizeof(PGVertex), 4096u);
  id<MTLBuffer> buffer = _vertexRing[_ringIndex];
  if (buffer == nil || buffer.length < bytes) {
    buffer = [_device newBufferWithLength:bytes * 3 / 2 options:MTLResourceStorageModeShared];
    _vertexRing[_ringIndex] = buffer;
  }
  _ringIndex = (_ringIndex + 1) % POCKET_FRAMES_IN_FLIGHT;
  if (quads > 0) memcpy(buffer.contents, vertices, (size_t)quads * 4 * sizeof(PGVertex));
  return buffer;
}

- (void)drawVertices:(const PGVertex *)vertices
               quads:(uint32_t)quads
             batches:(const PGBatch *)batches
               count:(uint32_t)count
            viewport:(CGRect)viewport {
  _commands = nil;
  _drawable = nil;
  // Up to three frames queued; the ring buffer this one fills is free once we pass.
  dispatch_semaphore_wait(_inFlight, DISPATCH_TIME_FOREVER);
  id<CAMetalDrawable> drawable = [(CAMetalLayer *)_view.layer nextDrawable];
  if (drawable == nil) {
    dispatch_semaphore_signal(_inFlight);
    return;
  }
  id<MTLBuffer> buffer = [self vertexBufferFor:vertices quads:quads];
  id<MTLCommandBuffer> commands = [_queue commandBuffer];
  dispatch_semaphore_t inFlight = _inFlight;
  [commands addCompletedHandler:^(id<MTLCommandBuffer> done) {
    dispatch_semaphore_signal(inFlight);
  }];

  MTLRenderPassDescriptor *pass = [MTLRenderPassDescriptor renderPassDescriptor];
  pass.colorAttachments[0].texture = drawable.texture;
  pass.colorAttachments[0].loadAction = MTLLoadActionClear;
  pass.colorAttachments[0].clearColor = MTLClearColorMake(0, 0, 0, 1);
  pass.colorAttachments[0].storeAction = MTLStoreActionStore;
  id<MTLRenderCommandEncoder> encoder = [commands renderCommandEncoderWithDescriptor:pass];
  if (quads > 0) {
    NSUInteger targetW = drawable.texture.width, targetH = drawable.texture.height;
    [encoder setRenderPipelineState:_pipeline];
    [encoder setViewport:(MTLViewport){viewport.origin.x, viewport.origin.y, viewport.size.width,
                                       viewport.size.height, 0, 1}];
    // float2 in the shader: two packed floats.
    float scale[2] = {2.0f / (float)viewport.size.width, 2.0f / (float)viewport.size.height};
    [encoder setVertexBytes:scale length:sizeof(scale) atIndex:1];
    MTLScissorRect full = {0, 0, targetW, targetH};
    BOOL scissorOn = NO;
    uint32_t boundTexture = 0;
    for (uint32_t b = 0; b < count; b++) {
      const PGBatch *batch = &batches[b];
      if (batch->scissored) {
        // In the drawable, clamped to it (Metal rejects scissors outside the target).
        NSInteger x0 = MAX(0, (NSInteger)viewport.origin.x + batch->sx);
        NSInteger y0 = MAX(0, (NSInteger)viewport.origin.y + batch->sy);
        NSInteger x1 = MIN((NSInteger)targetW, (NSInteger)viewport.origin.x + batch->sx + batch->sw);
        NSInteger y1 = MIN((NSInteger)targetH, (NSInteger)viewport.origin.y + batch->sy + batch->sh);
        if (x1 <= x0 || y1 <= y0) continue;
        [encoder setScissorRect:(MTLScissorRect){(NSUInteger)x0, (NSUInteger)y0,
                                                 (NSUInteger)(x1 - x0), (NSUInteger)(y1 - y0)}];
        scissorOn = YES;
      } else if (scissorOn) {
        [encoder setScissorRect:full];
        scissorOn = NO;
      }
      if (batch->tex != boundTexture) {
        id<MTLTexture> texture = _textures[@(batch->tex)];
        if (texture == nil) continue;
        [encoder setFragmentTexture:texture atIndex:0];
        [encoder setFragmentSamplerState:[_linearTextures containsObject:@(batch->tex)]
                                             ? _linearSampler
                                             : _nearestSampler
                                 atIndex:0];
        boundTexture = batch->tex;
      }
      [encoder setVertexBuffer:buffer
                        offset:(NSUInteger)batch->start * 4 * sizeof(PGVertex)
                       atIndex:0];
      [encoder drawIndexedPrimitives:MTLPrimitiveTypeTriangle
                          indexCount:(NSUInteger)batch->count * 6
                           indexType:MTLIndexTypeUInt16
                         indexBuffer:_indices
                   indexBufferOffset:0];
    }
  }
  [encoder endEncoding];
  _commands = commands;
  _drawable = drawable;
}

- (void)present {
  if (_commands == nil) return;
  [_commands presentDrawable:_drawable];
  [_commands commit];
  _commands = nil;
  _drawable = nil;
}

@end

id<PocketRenderBackend> PocketMetalBackendCreate(CGRect frame) {
  return [[PocketMetalBackend alloc] initWithFrame:frame];
}

#else

// 32-bit builds (the armv7 tiers): no Metal on those devices.
id<PocketRenderBackend> PocketMetalBackendCreate(CGRect frame) {
  (void)frame;
  return nil;
}

#endif
