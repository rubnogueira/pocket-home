// OpenGL ES 2 backend for PocketRenderer: every tier, from the iOS 5 takeover build (PowerVR
// SGX: iPhone 3GS, iPad 1/2) up. One program, `colour x texel` from one texture per batch.

#import "PocketRenderBackend.h"

#import <OpenGLES/EAGL.h>
#import <OpenGLES/EAGLDrawable.h>
#import <OpenGLES/ES2/gl.h>
#import <QuartzCore/QuartzCore.h>

#include <stddef.h>
#include <stdlib.h>

static const char *kVertexShader =
    "attribute vec2 aPos;\n"
    "attribute vec2 aUv;\n"
    "attribute vec4 aColor;\n"
    "uniform vec2 uScale;\n"
    "varying highp vec2 vUv;\n"
    "varying lowp vec4 vColor;\n"
    "void main() {\n"
    "  gl_Position = vec4(aPos.x * uScale.x - 1.0, 1.0 - aPos.y * uScale.y, 0.0, 1.0);\n"
    "  vUv = aUv;\n"
    "  vColor = aColor;\n"
    "}\n";

static const char *kFragmentShader =
    "uniform lowp sampler2D uTex;\n"
    "varying highp vec2 vUv;\n"
    "varying lowp vec4 vColor;\n"
    "void main() {\n"
    "  gl_FragColor = vColor * texture2D(uTex, vUv);\n"
    "}\n";

@interface PocketGLView : UIView
@end

@implementation PocketGLView

+ (Class)layerClass {
  return [CAEAGLLayer class];
}

- (instancetype)initWithFrame:(CGRect)frame {
  self = [super initWithFrame:frame];
  if (self) {
    CAEAGLLayer *layer = (CAEAGLLayer *)self.layer;
    layer.opaque = YES;
    // Never scale a frame to other bounds (the rotation animation interpolates them): it stays
    // at its size, centred, and the next frame matches the new bounds.
    layer.contentsGravity = kCAGravityCenter;
    layer.drawableProperties = @{
      kEAGLDrawablePropertyRetainedBacking : @NO,
      kEAGLDrawablePropertyColorFormat : kEAGLColorFormatRGBA8,
    };
    self.userInteractionEnabled = NO;
    self.contentScaleFactor = [UIScreen mainScreen].scale;
  }
  return self;
}

@end

@interface PocketGLBackend : NSObject <PocketRenderBackend>
@end

@implementation PocketGLBackend {
  PocketGLView *_view;
  EAGLContext *_context;
  GLuint _framebuffer, _renderbuffer, _program, _vbo, _ibo, _bound;
  GLint _uScale;
  GLint _bufferW, _bufferH;
  CGSize _bufferBounds;  // view size the renderbuffer was allocated for
}

- (nullable instancetype)initWithFrame:(CGRect)frame {
  self = [super init];
  if (!self) return nil;
  _context = [[EAGLContext alloc] initWithAPI:kEAGLRenderingAPIOpenGLES2];
  if (_context == nil || ![EAGLContext setCurrentContext:_context]) return nil;
  if (![self setupProgram]) return nil;
  _view = [[PocketGLView alloc] initWithFrame:frame];
  glGenFramebuffers(1, &_framebuffer);
  glGenRenderbuffers(1, &_renderbuffer);
  glBindFramebuffer(GL_FRAMEBUFFER, _framebuffer);
  glBindRenderbuffer(GL_RENDERBUFFER, _renderbuffer);
  glFramebufferRenderbuffer(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_RENDERBUFFER, _renderbuffer);
  glGenBuffers(1, &_vbo);
  glGenBuffers(1, &_ibo);
  // Static u16 indices [0 1 2 0 2 3] per quad for a full batch; every draw starts at index 0 and
  // points the attributes at its batch's first vertex.
  uint16_t *indices = malloc(POCKET_MAX_BATCH_QUADS * 6 * sizeof(uint16_t));
  if (indices == NULL) return nil;
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
  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _ibo);
  glBufferData(GL_ELEMENT_ARRAY_BUFFER, POCKET_MAX_BATCH_QUADS * 6 * sizeof(uint16_t), indices,
               GL_STATIC_DRAW);
  free(indices);
  return self;
}

- (void)dealloc {
  [self makeCurrent];
  glDeleteBuffers(1, &_vbo);
  glDeleteBuffers(1, &_ibo);
  glDeleteRenderbuffers(1, &_renderbuffer);
  glDeleteFramebuffers(1, &_framebuffer);
  glDeleteProgram(_program);
  [EAGLContext setCurrentContext:nil];
}

- (UIView *)view {
  return _view;
}

- (NSString *)name {
  return @"gles2";
}

- (void)makeCurrent {
  if ([EAGLContext currentContext] != _context) [EAGLContext setCurrentContext:_context];
}

static GLuint compileShader(GLenum type, const char *source) {
  GLuint shader = glCreateShader(type);
  glShaderSource(shader, 1, &source, NULL);
  glCompileShader(shader);
  GLint ok = 0;
  glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[512] = {0};
    glGetShaderInfoLog(shader, sizeof(log) - 1, NULL, log);
    NSLog(@"PocketGLBackend: shader: %s", log);
    glDeleteShader(shader);
    return 0;
  }
  return shader;
}

- (BOOL)setupProgram {
  GLuint vs = compileShader(GL_VERTEX_SHADER, kVertexShader);
  GLuint fs = compileShader(GL_FRAGMENT_SHADER, kFragmentShader);
  if (vs == 0 || fs == 0) return NO;
  _program = glCreateProgram();
  glAttachShader(_program, vs);
  glAttachShader(_program, fs);
  glBindAttribLocation(_program, 0, "aPos");
  glBindAttribLocation(_program, 1, "aUv");
  glBindAttribLocation(_program, 2, "aColor");
  glLinkProgram(_program);
  glDeleteShader(vs);
  glDeleteShader(fs);
  GLint ok = 0;
  glGetProgramiv(_program, GL_LINK_STATUS, &ok);
  if (!ok) {
    NSLog(@"PocketGLBackend: link failed");
    return NO;
  }
  glUseProgram(_program);
  _uScale = glGetUniformLocation(_program, "uScale");
  glUniform1i(glGetUniformLocation(_program, "uTex"), 0);
  for (GLuint k = 0; k < 3; k++) glEnableVertexAttribArray(k);
  return YES;
}

// ---- textures ------------------------------------------------------------------------------

- (uint32_t)createTextureWidth:(int)width
                        height:(int)height
                        linear:(BOOL)linear
                        pixels:(const void *)pixels {
  [self makeCurrent];
  GLuint tex = 0;
  glGenTextures(1, &tex);
  glBindTexture(GL_TEXTURE_2D, tex);
  _bound = tex;
  glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
  glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
  GLint f = linear ? GL_LINEAR : GL_NEAREST;
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, f);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, f);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
  glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
  return tex;
}

- (void)updateTexture:(uint32_t)texture
                    x:(int)x
                    y:(int)y
                width:(int)width
               height:(int)height
               pixels:(const void *)pixels {
  [self makeCurrent];
  glBindTexture(GL_TEXTURE_2D, texture);
  _bound = texture;
  glPixelStorei(GL_UNPACK_ALIGNMENT, 4);
  glTexSubImage2D(GL_TEXTURE_2D, 0, x, y, width, height, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
}

- (void)deleteTexture:(uint32_t)texture {
  [self makeCurrent];
  GLuint tex = texture;
  glDeleteTextures(1, &tex);
  if (_bound == texture) _bound = 0;
}

// ---- frame ---------------------------------------------------------------------------------

- (BOOL)prepareDrawableWidth:(int *)width height:(int *)height resized:(BOOL *)resized {
  [self makeCurrent];
  CGSize bounds = _view.bounds.size;
  *resized = NO;
  if (bounds.width < 1 || bounds.height < 1) return NO;
  if (_bufferW == 0 || !CGSizeEqualToSize(bounds, _bufferBounds)) {
    glBindRenderbuffer(GL_RENDERBUFFER, _renderbuffer);
    if (![_context renderbufferStorage:GL_RENDERBUFFER fromDrawable:(CAEAGLLayer *)_view.layer]) {
      return NO;
    }
    glGetRenderbufferParameteriv(GL_RENDERBUFFER, GL_RENDERBUFFER_WIDTH, &_bufferW);
    glGetRenderbufferParameteriv(GL_RENDERBUFFER, GL_RENDERBUFFER_HEIGHT, &_bufferH);
    _bufferBounds = bounds;
    *resized = YES;
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) return NO;
  }
  *width = _bufferW;
  *height = _bufferH;
  return YES;
}

- (void)drawVertices:(const PGVertex *)vertices
               quads:(uint32_t)quads
             batches:(const PGBatch *)batches
               count:(uint32_t)count
            viewport:(CGRect)viewport {
  [self makeCurrent];
  GLint vx = (GLint)viewport.origin.x, vy = (GLint)viewport.origin.y;
  GLint vw = (GLint)viewport.size.width, vh = (GLint)viewport.size.height;
  glBindFramebuffer(GL_FRAMEBUFFER, _framebuffer);
  glDisable(GL_SCISSOR_TEST);
  glViewport(vx, _bufferH - vy - vh, vw, vh);
  glClearColor(0, 0, 0, 1);
  glClear(GL_COLOR_BUFFER_BIT);
  if (quads == 0) return;

  glUseProgram(_program);
  glUniform2f(_uScale, 2.0f / vw, 2.0f / vh);
  glBindBuffer(GL_ARRAY_BUFFER, _vbo);
  glBufferData(GL_ARRAY_BUFFER, (GLsizeiptr)quads * 4 * sizeof(PGVertex), vertices,
               GL_STREAM_DRAW);
  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, _ibo);
  glEnable(GL_BLEND);
  glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
  glActiveTexture(GL_TEXTURE0);
  BOOL scissorOn = NO;
  for (uint32_t b = 0; b < count; b++) {
    const PGBatch *batch = &batches[b];
    if (batch->tex != _bound) {
      glBindTexture(GL_TEXTURE_2D, batch->tex);
      _bound = batch->tex;
    }
    if (batch->scissored) {
      if (batch->sw <= 0 || batch->sh <= 0) continue;
      if (!scissorOn) glEnable(GL_SCISSOR_TEST);
      scissorOn = YES;
      glScissor(vx + batch->sx, _bufferH - (vy + batch->sy + batch->sh), batch->sw, batch->sh);
    } else if (scissorOn) {
      glDisable(GL_SCISSOR_TEST);
      scissorOn = NO;
    }
    // u16 indices start at 0 for every batch: point the attributes at its first vertex.
    const char *base = (const char *)((size_t)batch->start * 4 * sizeof(PGVertex));
    GLsizei stride = sizeof(PGVertex);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, stride, base + offsetof(PGVertex, x));
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, base + offsetof(PGVertex, u));
    glVertexAttribPointer(2, 4, GL_UNSIGNED_BYTE, GL_TRUE, stride,
                          base + offsetof(PGVertex, color));
    glDrawElements(GL_TRIANGLES, (GLsizei)batch->count * 6, GL_UNSIGNED_SHORT, 0);
  }
  if (scissorOn) glDisable(GL_SCISSOR_TEST);
}

- (void)present {
  [self makeCurrent];
  glBindRenderbuffer(GL_RENDERBUFFER, _renderbuffer);
  [_context presentRenderbuffer:GL_RENDERBUFFER];
}

@end

id<PocketRenderBackend> PocketGLBackendCreate(CGRect frame) {
  return [[PocketGLBackend alloc] initWithFrame:frame];
}
