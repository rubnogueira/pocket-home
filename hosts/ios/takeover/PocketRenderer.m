#import "PocketRenderer.h"
#import "PocketRenderBackend.h"

#include <math.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// spec DRAW_OP (see hosts/web/gpu.js)
enum {
  OP_RECT = 1,
  OP_GRAD_RECT = 2,
  OP_GLYPH_RUN = 3,
  OP_TEX_QUAD = 4,
  OP_SCISSOR = 5,
  OP_SCISSOR_POP = 6,
  OP_TRI = 7,
  OP_TEX_TRI = 8,
  OP_TEXT_RUN = 9,
  OP_SURFACE_QUAD = 10,
  OP_OFFSET = 11, // Pocket Home core patch: sub-pixel translate scopes
  OP_OFFSET_POP = 12,
};
enum { GRAD_TO_TOP = 0, GRAD_TO_LEFT = 2, GRAD_TO_RIGHT = 3 };
#define TEX_SLOT_MASK 0xfffffu // spec TEX_SLOT_BITS = 20
#define MAX_FONT_SLOTS 24      // spec MAX_FONT_SLOTS
#define MAX_TEX_SLOTS 4096     // images beyond this many slots are not drawn

// Backend-independent half of the GPU renderer: DrawList -> atlas pages, clipped quads and
// batches; PocketGLBackend.m / PocketMetalBackend.m own the textures and draw.
//
// One texture fetch per fragment. PowerVR SGX is fill-rate bound here: a full-screen 1024x768
// scroll frame covers the screen 2-3 times, and each extra texture read per fragment cost ~10%
// of the frame rate on an iPad 2 (three samplers ran at ~53 fps, where draw calls were
// irrelevant: 118 per frame cost no more CPU than 1). So every quad is `colour x texel` from a
// single RGBA atlas page:
//   * linear pages (filtered) hold the glyph atlases, stored as (255, 255, 255, coverage) so a
//     glyph is its colour with alpha x coverage, plus the linear-filtered images (rounded-corner
//     sprites);
//   * nearest pages hold the other small images (icons);
//   * every page starts with a white block that solid quads sample, so rects join any batch.
// Regions are padded by extruding their edges (glyphs: transparent white), so a filtered tap at a
// region's border reads what CLAMP_TO_EDGE would. A batch breaks when the page changes (icon to
// text), a triangle crosses its clip (GL scissor) or it reaches 16384 quads (u16 indices).
#define LINEAR_PAGE_SIZE 2048  // 16 MB
#define NEAREST_PAGE_SIZE 1024 // 4 MB
#define PAGE_PAD 1
#define WHITE_BLOCK 4 // texels 0..3 of rows 0..3 are white; shelves start below
#define MAX_PAGES 3   // per filter
#define PAGE_MAX_IMAGE_SIDE 256 // larger images keep their own texture
#define MAX_BATCH_QUADS POCKET_MAX_BATCH_QUADS

typedef struct {
  uint32_t tex;
  int size;
  int shelfY[64], shelfH[64], shelfX[64];
  int shelves;
  int nextY;
} PGPage;

typedef struct {
  uint32_t rev; // 0 = empty
  uint32_t tex; // page or own texture
  float white;  // uv of the white block in tex; < 0 for an own texture (none)
  float mapU, mapV; // texel origin of the atlas in tex
  float invW, invH; // 1 / tex size
  uint32_t covW, covH, cellW, cellH, cols, count;
} PGFont;

typedef struct {
  BOOL used;
  int32_t handle;
  uint32_t revLo, revHi, w, h, linear;
  uint32_t tex;
  float white;                      // as PGFont
  float mapU, mapV, scaleU, scaleV; // uv in [0,1] of the image -> uv in tex
} PGImage;

static inline int32_t lowI16(uint32_t w) { return (int16_t)(w & 0xffff); }
static inline int32_t highI16(uint32_t w) { return (int16_t)(w >> 16); }
static inline float bitsToF32(uint32_t bits) {
  float f;
  memcpy(&f, &bits, 4);
  return f;
}
static inline float clamp01(float v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

static uint32_t lerpColor(uint32_t a, uint32_t b, float t) {
  if (a == b || t <= 0) return a;
  if (t >= 1) return b;
  uint32_t out = 0;
  for (int shift = 0; shift < 32; shift += 8) {
    float ca = (a >> shift) & 0xff, cb = (b >> shift) & 0xff;
    out |= (uint32_t)lroundf(ca + (cb - ca) * t) << shift;
  }
  return out;
}

static inline void setVertex(PGVertex *v, float x, float y, float u, float t, uint32_t color) {
  v->x = x;
  v->y = y;
  v->u = u;
  v->v = t;
  v->color = color;
}

@implementation PocketRenderer {
  id<PocketRenderBackend> _backend;

  PGPage _linearPages[MAX_PAGES], _nearestPages[MAX_PAGES];
  int _linearPageCount, _nearestPageCount;
  PGFont _fonts[MAX_FONT_SLOTS];
  PGImage *_images;
  uint32_t _imageSlots;
  uint32_t _syncedVersion;
  BOOL _synced;
  uint8_t *_scratch;
  size_t _scratchSize;

  PGVertex *_verts;
  uint32_t _vertCapacityQuads, _quadCount;
  PGBatch *_batches;
  uint32_t _batchCount, _batchCapacity;

  // buildWords state
  float _cx0, _cy0, _cx1, _cy1;
  float _uvOU, _uvOV, _uvSU, _uvSV;
  PGBatch _open;
}

+ (nullable instancetype)rendererWithFrame:(CGRect)frame preferGL:(BOOL)preferGL {
  id<PocketRenderBackend> backend = preferGL ? nil : PocketMetalBackendCreate(frame);
  if (backend == nil) backend = PocketGLBackendCreate(frame);
  return backend != nil ? [[self alloc] initWithBackend:backend] : nil;
}

- (nullable instancetype)initWithBackend:(id<PocketRenderBackend>)backend {
  self = [super init];
  if (!self) return nil;
  _backend = backend;
  // Linear page 0 exists from the start: the white block of any frame's first solid quads.
  if (![self newPageIn:_linearPages count:&_linearPageCount size:LINEAR_PAGE_SIZE linear:YES]) {
    return nil;
  }
  pocket_apple_gpu_invalidate();
  return self;
}

- (void)dealloc {
  free(_images);
  free(_scratch);
  free(_verts);
  free(_batches);
}

- (UIView *)view {
  return _backend.view;
}

- (NSString *)backendName {
  return _backend.name;
}

- (uint8_t *)scratch:(size_t)size {
  if (size > _scratchSize) {
    free(_scratch);
    _scratch = malloc(size);
    _scratchSize = _scratch != NULL ? size : 0;
  }
  return _scratch;
}

// ---- atlas pages ---------------------------------------------------------------------------

/// A cleared page with its white block, appended to `pages`; NO when there is no room.
- (BOOL)newPageIn:(PGPage *)pages count:(int *)count size:(int)size linear:(BOOL)linear {
  if (*count >= MAX_PAGES) return NO;
  uint8_t *zero = calloc((size_t)size * size, 4);
  if (zero == NULL) return NO;
  for (int y = 0; y < WHITE_BLOCK; y++) memset(zero + (size_t)y * size * 4, 255, WHITE_BLOCK * 4);
  PGPage *page = &pages[*count];
  memset(page, 0, sizeof(*page));
  page->size = size;
  page->nextY = WHITE_BLOCK;
  page->tex = [_backend createTextureWidth:size height:size linear:linear pixels:zero];
  free(zero);
  if (page->tex == 0) return NO;
  *count += 1;
  return YES;
}

/// Shelf-pack a w x h region (plus padding) into `pages`, adding a page when needed. NO when
/// every page is full.
- (BOOL)allocIn:(PGPage *)pages
          count:(int *)count
           size:(int)size
         linear:(BOOL)linear
              w:(int)w
              h:(int)h
           page:(PGPage **)outPage
              x:(int *)outX
              y:(int *)outY {
  int pw = w + 2 * PAGE_PAD, ph = h + 2 * PAGE_PAD;
  if (pw > size || ph > size - WHITE_BLOCK) return NO;
  for (int p = 0; p < MAX_PAGES; p++) {
    if (p == *count && ![self newPageIn:pages count:count size:size linear:linear]) return NO;
    PGPage *page = &pages[p];
    for (int s = 0; s < page->shelves; s++) {
      if (ph <= page->shelfH[s] && page->shelfX[s] + pw <= size) {
        *outPage = page;
        *outX = page->shelfX[s];
        *outY = page->shelfY[s];
        page->shelfX[s] += pw;
        return YES;
      }
    }
    if (page->shelves < 64 && page->nextY + ph <= size) {
      int s = page->shelves++;
      page->shelfY[s] = page->nextY;
      page->shelfH[s] = ph;
      page->shelfX[s] = pw;
      page->nextY += ph;
      *outPage = page;
      *outX = 0;
      *outY = page->shelfY[s];
      return YES;
    }
  }
  return NO;
}

static inline float whiteUv(const PGPage *page) { return (WHITE_BLOCK / 2.0f) / page->size; }

// ---- resource sync -------------------------------------------------------------------------

/// Glyph coverage as (255, 255, 255, coverage) texels with a transparent-white border of
/// PAGE_PAD, ready for one upload.
- (const uint8_t *)glyphTexels:(const uint8_t *)coverage w:(uint32_t)w h:(uint32_t)h {
  uint32_t pw = w + 2 * PAGE_PAD, ph = h + 2 * PAGE_PAD;
  uint8_t *out = [self scratch:(size_t)pw * ph * 4];
  if (out == NULL) return NULL;
  uint32_t *texels = (uint32_t *)out;
  for (size_t k = 0; k < (size_t)pw * ph; k++) texels[k] = 0x00ffffffu;
  for (uint32_t y = 0; y < h; y++) {
    const uint8_t *src = coverage + (size_t)y * w;
    uint32_t *dst = texels + (size_t)(y + PAGE_PAD) * pw + PAGE_PAD;
    for (uint32_t x = 0; x < w; x++) dst[x] = 0x00ffffffu | ((uint32_t)src[x] << 24);
  }
  return out;
}

/// Forget every region of the linear pages (fonts and linear images re-upload on this sync).
- (void)resetLinearPages {
  for (int p = 0; p < _linearPageCount; p++) {
    _linearPages[p].shelves = 0;
    _linearPages[p].nextY = WHITE_BLOCK;
  }
  for (int slot = 0; slot < MAX_FONT_SLOTS; slot++) {
    if (_fonts[slot].rev != 0 && _fonts[slot].white < 0) [_backend deleteTexture:_fonts[slot].tex];
    _fonts[slot].rev = 0;
  }
  for (uint32_t slot = 0; slot < _imageSlots; slot++) {
    if (_images[slot].used && _images[slot].linear && _images[slot].white >= 0) {
      _images[slot].used = NO;
    }
  }
}

- (void)syncFonts:(PocketApple *)handle {
  for (int attempt = 0; attempt < 2; attempt++) {
    BOOL full = NO;
    for (uint32_t slot = 0; slot < MAX_FONT_SLOTS && !full; slot++) {
      PGFont *font = &_fonts[slot];
      uint32_t rev = pocket_apple_gpu_font_revision(handle, slot);
      if (rev == font->rev) continue;
      if (font->rev != 0 && font->white < 0) [_backend deleteTexture:font->tex];
      font->rev = 0;
      if (rev == 0) continue;
      const uint8_t *coverage = pocket_apple_gpu_font_pack(handle, slot);
      if (coverage == NULL) continue;
      const uint32_t *m = pocket_apple_gpu_info();
      uint32_t texW = m[0], texH = m[1];
      PGPage *page = NULL;
      int x = 0, y = 0;
      BOOL inPage = [self allocIn:_linearPages
                            count:&_linearPageCount
                             size:LINEAR_PAGE_SIZE
                           linear:YES // glyphs sample linearly, like gpu.js
                                w:(int)texW
                                h:(int)texH
                             page:&page
                                x:&x
                                y:&y];
      BOOL fits = texW + 2 * PAGE_PAD <= LINEAR_PAGE_SIZE &&
                  texH + 2 * PAGE_PAD <= LINEAR_PAGE_SIZE - WHITE_BLOCK;
      if (!inPage && fits && attempt == 0) {
        full = YES; // atlases grow as glyphs are added: repack everything into fresh pages
        continue;
      }
      const uint8_t *texels = [self glyphTexels:coverage w:texW h:texH];
      if (texels == NULL) continue;
      int pw = (int)(texW + 2 * PAGE_PAD), ph = (int)(texH + 2 * PAGE_PAD);
      uint32_t tex;
      if (inPage) {
        tex = page->tex;
        [_backend updateTexture:tex x:x y:y width:pw height:ph pixels:texels];
      } else {
        tex = [_backend createTextureWidth:pw height:ph linear:YES pixels:texels];
        if (tex == 0) continue;
        x = y = 0;
      }
      *font = (PGFont){
          .rev = rev,
          .tex = tex,
          .white = inPage ? whiteUv(page) : -1,
          .mapU = x + PAGE_PAD,
          .mapV = y + PAGE_PAD,
          .invW = 1.0f / (inPage ? page->size : pw),
          .invH = 1.0f / (inPage ? page->size : ph),
          .covW = m[2],
          .covH = m[3],
          .cellW = m[4],
          .cellH = m[5],
          .cols = m[6],
          .count = m[7],
      };
    }
    if (!full) return;
    [self resetLinearPages];
  }
}

/// RGBA w x h pixels with every edge extruded by PAGE_PAD.
- (const uint8_t *)padded:(const uint8_t *)src w:(uint32_t)w h:(uint32_t)h {
  uint32_t pw = w + 2 * PAGE_PAD, ph = h + 2 * PAGE_PAD;
  uint8_t *out = [self scratch:(size_t)pw * ph * 4];
  if (out == NULL) return NULL;
  for (uint32_t y = 0; y < ph; y++) {
    int sy = (int)y - PAGE_PAD;
    sy = sy < 0 ? 0 : (sy >= (int)h ? (int)h - 1 : sy);
    const uint8_t *row = src + (size_t)sy * w * 4;
    uint8_t *base = out + (size_t)y * pw * 4;
    memcpy(base + PAGE_PAD * 4, row, (size_t)w * 4);
    for (int x = 0; x < PAGE_PAD; x++) {
      memcpy(base + x * 4, row, 4);
      memcpy(base + (PAGE_PAD + w + x) * 4, row + (w - 1) * 4, 4);
    }
  }
  return out;
}

- (void)freeImage:(PGImage *)image {
  // Page regions are not reclaimed (images upload once per app load); own textures are.
  if (image->used && image->white < 0) [_backend deleteTexture:image->tex];
  image->used = NO;
}

- (void)syncImages:(PocketApple *)handle {
  uint32_t slots = MIN(pocket_apple_gpu_texture_slot_count(handle), MAX_TEX_SLOTS);
  if (slots > _imageSlots) {
    PGImage *grown = realloc(_images, slots * sizeof(PGImage));
    if (grown == NULL) return;
    _images = grown;
    memset(_images + _imageSlots, 0, (slots - _imageSlots) * sizeof(PGImage));
  } else {
    for (uint32_t slot = slots; slot < _imageSlots; slot++) [self freeImage:&_images[slot]];
  }
  _imageSlots = slots;
  for (uint32_t slot = 0; slot < slots; slot++) {
    PGImage *cached = &_images[slot];
    if (!pocket_apple_gpu_texture_meta(handle, slot)) {
      [self freeImage:cached];
      continue;
    }
    const uint32_t *m = pocket_apple_gpu_info();
    int32_t imageHandle = (int32_t)m[0];
    uint32_t revLo = m[1], revHi = m[2], w = m[3], h = m[4], linear = m[5];
    if (cached->used && cached->handle == imageHandle && cached->revLo == revLo &&
        cached->revHi == revHi) {
      continue;
    }
    [self freeImage:cached]; // a changed page image takes a new region (not reclaimed)
    const uint8_t *pixels = pocket_apple_gpu_texture_pack(handle, slot);
    if (pixels == NULL || w == 0 || h == 0) continue;
    PGImage image = {.used = YES,
                     .handle = imageHandle,
                     .revLo = revLo,
                     .revHi = revHi,
                     .w = w,
                     .h = h,
                     .linear = linear};
    PGPage *page = NULL;
    int x = 0, y = 0;
    BOOL inPage = w <= PAGE_MAX_IMAGE_SIDE && h <= PAGE_MAX_IMAGE_SIDE &&
                  [self allocIn:linear ? _linearPages : _nearestPages
                          count:linear ? &_linearPageCount : &_nearestPageCount
                           size:linear ? LINEAR_PAGE_SIZE : NEAREST_PAGE_SIZE
                         linear:linear != 0
                              w:(int)w
                              h:(int)h
                           page:&page
                              x:&x
                              y:&y];
    if (inPage) {
      const uint8_t *pad = [self padded:pixels w:w h:h];
      if (pad == NULL) continue;
      [_backend updateTexture:page->tex
                            x:x
                            y:y
                        width:(int)(w + 2 * PAGE_PAD)
                       height:(int)(h + 2 * PAGE_PAD)
                       pixels:pad];
      float size = page->size;
      image.tex = page->tex;
      image.white = whiteUv(page);
      image.mapU = (x + PAGE_PAD) / size;
      image.mapV = (y + PAGE_PAD) / size;
      image.scaleU = w / size;
      image.scaleV = h / size;
    } else {
      image.tex = [_backend createTextureWidth:(int)w
                                        height:(int)h
                                        linear:linear != 0
                                        pixels:pixels];
      if (image.tex == 0) continue;
      image.white = -1;
      image.mapU = image.mapV = 0;
      image.scaleU = image.scaleV = 1;
    }
    *cached = image;
  }
}

// ---- batching ------------------------------------------------------------------------------

- (void)flushBatch {
  if (_quadCount > _open.start) {
    if (_batchCount == _batchCapacity) {
      uint32_t capacity = _batchCapacity ? _batchCapacity * 2 : 64;
      PGBatch *grown = realloc(_batches, capacity * sizeof(PGBatch));
      if (grown == NULL) return;
      _batches = grown;
      _batchCapacity = capacity;
    }
    _open.count = _quadCount - _open.start;
    _batches[_batchCount++] = _open;
  }
  _open.start = _quadCount;
}

/// Make the open batch sample `tex` (a batch on another texture ends first). Call before
/// emitting the quads that use it.
- (void)needTexture:(uint32_t)tex white:(float)white {
  if (_open.tex == tex) return;
  if (_open.tex != 0) [self flushBatch];
  _open.tex = tex;
  _open.white = white;
}

/// Solid quads sample the open batch's white block; they only move to a new batch when its
/// texture has none (an own texture).
- (void)needSolid {
  if (_open.tex == 0 || _open.white < 0) {
    [self needTexture:_linearPages[0].tex white:whiteUv(&_linearPages[0])];
  }
  _uvOU = _uvOV = _open.white;
  _uvSU = _uvSV = 0;
}

- (PGVertex *)reserveQuad {
  if (_quadCount - _open.start >= MAX_BATCH_QUADS) [self flushBatch];
  if (_quadCount == _vertCapacityQuads) {
    uint32_t next = _vertCapacityQuads ? _vertCapacityQuads * 2 : 1024;
    PGVertex *grown = realloc(_verts, (size_t)next * 4 * sizeof(PGVertex));
    if (grown == NULL) return NULL;
    _verts = grown;
    _vertCapacityQuads = next;
  }
  return _verts + (size_t)_quadCount++ * 4;
}

/// Axis-aligned quad in device px, clipped to the current clip on the CPU (UVs and corner
/// colours TL, TR, BR, BL follow the clipped edges). UVs go through the _uv* transform.
- (void)quadX0:(float)x0 y0:(float)y0 x1:(float)x1 y1:(float)y1
            u0:(float)u0 v0:(float)v0 u1:(float)u1 v1:(float)v1
            c0:(uint32_t)c0 c1:(uint32_t)c1 c2:(uint32_t)c2 c3:(uint32_t)c3 {
  if (x1 <= _cx0 || x0 >= _cx1 || y1 <= _cy0 || y0 >= _cy1 || x1 <= x0 || y1 <= y0) return;
  if (x0 < _cx0 || y0 < _cy0 || x1 > _cx1 || y1 > _cy1) {
    float w = x1 - x0, h = y1 - y0;
    float tx0 = x0 < _cx0 ? (_cx0 - x0) / w : 0;
    float tx1 = x1 > _cx1 ? (_cx1 - x0) / w : 1;
    float ty0 = y0 < _cy0 ? (_cy0 - y0) / h : 0;
    float ty1 = y1 > _cy1 ? (_cy1 - y0) / h : 1;
    float du = u1 - u0, dv = v1 - v0;
    if (!(c0 == c1 && c1 == c2 && c2 == c3)) {
      uint32_t n0 = lerpColor(lerpColor(c0, c1, tx0), lerpColor(c3, c2, tx0), ty0);
      uint32_t n1 = lerpColor(lerpColor(c0, c1, tx1), lerpColor(c3, c2, tx1), ty0);
      uint32_t n2 = lerpColor(lerpColor(c0, c1, tx1), lerpColor(c3, c2, tx1), ty1);
      uint32_t n3 = lerpColor(lerpColor(c0, c1, tx0), lerpColor(c3, c2, tx0), ty1);
      c0 = n0;
      c1 = n1;
      c2 = n2;
      c3 = n3;
    }
    u1 = u0 + du * tx1;
    u0 = u0 + du * tx0;
    v1 = v0 + dv * ty1;
    v0 = v0 + dv * ty0;
    x0 = MAX(x0, _cx0);
    y0 = MAX(y0, _cy0);
    x1 = MIN(x1, _cx1);
    y1 = MIN(y1, _cy1);
  }
  PGVertex *v = [self reserveQuad];
  if (v == NULL) return;
  float tu0 = _uvOU + u0 * _uvSU, tv0 = _uvOV + v0 * _uvSV;
  float tu1 = _uvOU + u1 * _uvSU, tv1 = _uvOV + v1 * _uvSV;
  setVertex(&v[0], x0, y0, tu0, tv0, c0);
  setVertex(&v[1], x1, y0, tu1, tv0, c1);
  setVertex(&v[2], x1, y1, tu1, tv1, c2);
  setVertex(&v[3], x0, y1, tu0, tv1, c3);
}

/// Triangle (x, y, u, v per vertex; final uvs): batched when inside the clip, else in a
/// scissored batch of its own.
- (void)tri:(const float *)p colors:(const uint32_t *)c {
  float minX = MIN(p[0], MIN(p[4], p[8])), maxX = MAX(p[0], MAX(p[4], p[8]));
  float minY = MIN(p[1], MIN(p[5], p[9])), maxY = MAX(p[1], MAX(p[5], p[9]));
  if (maxX <= _cx0 || minX >= _cx1 || maxY <= _cy0 || minY >= _cy1) return;
  BOOL inside = minX >= _cx0 && maxX <= _cx1 && minY >= _cy0 && maxY <= _cy1;
  if (!inside) {
    [self flushBatch];
    _open.scissored = YES;
    _open.sx = (int)_cx0;
    _open.sy = (int)_cy0;
    _open.sw = (int)(_cx1 - _cx0);
    _open.sh = (int)(_cy1 - _cy0);
  }
  PGVertex *v = [self reserveQuad];
  if (v != NULL) {
    setVertex(&v[0], p[0], p[1], p[2], p[3], c[0]);
    setVertex(&v[1], p[4], p[5], p[6], p[7], c[1]);
    setVertex(&v[2], p[8], p[9], p[10], p[11], c[2]);
    setVertex(&v[3], p[8], p[9], p[10], p[11], c[2]); // degenerate half
  }
  if (!inside) {
    [self flushBatch];
    _open.scissored = NO;
  }
}

- (const PGImage *)imageFor:(uint32_t)handle {
  uint32_t slot = handle & TEX_SLOT_MASK;
  if (slot >= _imageSlots) return NULL;
  const PGImage *image = &_images[slot];
  return image->used && image->handle == (int32_t)handle ? image : NULL;
}

- (void)buildWords:(const uint32_t *)words
             count:(uint32_t)n
             width:(float)targetW
            height:(float)targetH
             scale:(float)s {
  _quadCount = 0;
  _batchCount = 0;
  memset(&_open, 0, sizeof(_open));
  _open.white = -1;
  // OFFSET scopes shift their contents by the accumulated fraction, snapped to device px.
  float offX = 0, offY = 0, ox = 0, oy = 0;
  float offsets[64];
  int offsetDepth = 0;
#define SNAPX(v) (roundf((float)(v) * s) + ox)
#define SNAPY(v) (roundf((float)(v) * s) + oy)
  _cx0 = 0;
  _cy0 = 0;
  _cx1 = targetW;
  _cy1 = targetH;
  float clips[256];
  int clipDepth = 0;

  uint32_t i = 0;
  while (i < n) {
    uint32_t op = words[i];
    if (op == OP_RECT) {
      if (i + 4 > n) break;
      uint32_t c = words[i + 3];
      uint32_t w = words[i + 2] & 0xffff, h = words[i + 2] >> 16;
      if (w > 0 && h > 0 && (c >> 24) != 0) {
        int32_t x = lowI16(words[i + 1]), y = highI16(words[i + 1]);
        [self needSolid];
        [self quadX0:SNAPX(x) y0:SNAPY(y) x1:SNAPX(x + (int32_t)w) y1:SNAPY(y + (int32_t)h)
                  u0:0 v0:0 u1:1 v1:1 c0:c c1:c c2:c c3:c];
      }
      i += 4;
    } else if (op == OP_GRAD_RECT) {
      if (i + 6 > n) break;
      int32_t x = lowI16(words[i + 1]), y = highI16(words[i + 1]);
      uint32_t w = words[i + 2] & 0xffff, h = words[i + 2] >> 16;
      uint32_t from = words[i + 3], to = words[i + 4], dir = words[i + 5];
      if (w > 0 && h > 0) {
        uint32_t c[4]; // TL, TR, BR, BL
        if (dir == GRAD_TO_TOP) {
          c[0] = to; c[1] = to; c[2] = from; c[3] = from;
        } else if (dir == GRAD_TO_LEFT) {
          c[0] = to; c[1] = from; c[2] = from; c[3] = to;
        } else if (dir == GRAD_TO_RIGHT) {
          c[0] = from; c[1] = to; c[2] = to; c[3] = from;
        } else {
          c[0] = from; c[1] = from; c[2] = to; c[3] = to;
        }
        [self needSolid];
        [self quadX0:SNAPX(x) y0:SNAPY(y) x1:SNAPX(x + (int32_t)w) y1:SNAPY(y + (int32_t)h)
                  u0:0 v0:0 u1:1 v1:1 c0:c[0] c1:c[1] c2:c[2] c3:c[3]];
      }
      i += 6;
    } else if (op == OP_GLYPH_RUN) {
      if (i + 3 > n) break;
      uint32_t slot = words[i + 1] & 0xff, count = words[i + 1] >> 16;
      uint32_t color = words[i + 2];
      if (i + 3 + 2 * count > n) break;
      const PGFont *font = slot < MAX_FONT_SLOTS && _fonts[slot].rev != 0 ? &_fonts[slot] : NULL;
      if (font != NULL && count > 0) {
        [self needTexture:font->tex white:font->white];
        _uvOU = font->mapU * font->invW; // uvs below in texels of the font's atlas
        _uvOV = font->mapV * font->invH;
        _uvSU = font->invW;
        _uvSV = font->invH;
        // The logical cell at scale, origin snapped so texels land on pixels.
        float dw = roundf(font->cellW * s), dh = roundf(font->cellH * s);
        for (uint32_t k = 0; k < count; k++) {
          uint32_t xy = words[i + 3 + 2 * k];
          uint32_t gid = words[i + 4 + 2 * k] & 0xffff;
          if (gid >= font->count) continue;
          float gx = SNAPX(lowI16(xy)), gy = SNAPY(highI16(xy));
          float u0 = (float)((gid % font->cols) * font->covW);
          float v0 = (float)((gid / font->cols) * font->covH);
          [self quadX0:gx y0:gy x1:gx + dw y1:gy + dh
                    u0:u0 v0:v0 u1:u0 + font->covW v1:v0 + font->covH
                    c0:color c1:color c2:color c3:color];
        }
      }
      i += 3 + 2 * count;
    } else if (op == OP_TEX_QUAD) {
      if (i + 9 > n) break;
      const PGImage *image = [self imageFor:words[i + 1]];
      uint32_t w = words[i + 3] & 0xffff, h = words[i + 3] >> 16;
      if (image != NULL && w > 0 && h > 0) {
        int32_t x = lowI16(words[i + 2]), y = highI16(words[i + 2]);
        uint32_t m = words[i + 8];
        [self needTexture:image->tex white:image->white];
        _uvOU = image->mapU;
        _uvOV = image->mapV;
        _uvSU = image->scaleU;
        _uvSV = image->scaleV;
        [self quadX0:SNAPX(x) y0:SNAPY(y) x1:SNAPX(x + (int32_t)w) y1:SNAPY(y + (int32_t)h)
                  u0:clamp01(bitsToF32(words[i + 4])) v0:clamp01(bitsToF32(words[i + 5]))
                  u1:clamp01(bitsToF32(words[i + 6])) v1:clamp01(bitsToF32(words[i + 7]))
                  c0:m c1:m c2:m c3:m];
      }
      i += 9;
    } else if (op == OP_SCISSOR) {
      if (i + 3 > n) break;
      int32_t x = lowI16(words[i + 1]), y = highI16(words[i + 1]);
      uint32_t w = words[i + 2] & 0xffff, h = words[i + 2] >> 16;
      if (clipDepth + 4 <= 256) {
        clips[clipDepth++] = _cx0;
        clips[clipDepth++] = _cy0;
        clips[clipDepth++] = _cx1;
        clips[clipDepth++] = _cy1;
      }
      // Intersect with the enclosing clip again: inside an OFFSET scope the rect is shifted.
      float nx0 = MAX(SNAPX(x), _cx0), ny0 = MAX(SNAPY(y), _cy0);
      _cx1 = MAX(nx0, MIN(SNAPX(x + (int32_t)w), _cx1));
      _cy1 = MAX(ny0, MIN(SNAPY(y + (int32_t)h), _cy1));
      _cx0 = nx0;
      _cy0 = ny0;
      i += 3;
    } else if (op == OP_SCISSOR_POP) {
      if (clipDepth >= 4) {
        _cy1 = clips[--clipDepth];
        _cx1 = clips[--clipDepth];
        _cy0 = clips[--clipDepth];
        _cx0 = clips[--clipDepth];
      } else {
        _cx0 = _cy0 = 0;
        _cx1 = targetW;
        _cy1 = targetH;
      }
      i += 1;
    } else if (op == OP_TEX_TRI) {
      if (i + 12 > n) break;
      const PGImage *image = [self imageFor:words[i + 1]];
      if (image != NULL) {
        uint32_t m = words[i + 11];
        uint32_t c[3] = {m, m, m};
        float p[12];
        for (int k = 0; k < 3; k++) {
          p[k * 4] = lowI16(words[i + 2 + k * 3]) * s + ox;
          p[k * 4 + 1] = highI16(words[i + 2 + k * 3]) * s + oy;
          p[k * 4 + 2] = image->mapU + clamp01(bitsToF32(words[i + 3 + k * 3])) * image->scaleU;
          p[k * 4 + 3] = image->mapV + clamp01(bitsToF32(words[i + 4 + k * 3])) * image->scaleV;
        }
        [self needTexture:image->tex white:image->white];
        [self tri:p colors:c];
      }
      i += 12;
    } else if (op == OP_TRI) {
      if (i + 7 > n) break;
      [self needSolid];
      float p[12];
      for (int k = 0; k < 3; k++) {
        p[k * 4] = lowI16(words[i + 1 + k]) * s + ox;
        p[k * 4 + 1] = highI16(words[i + 1 + k]) * s + oy;
        p[k * 4 + 2] = p[k * 4 + 3] = _open.white;
      }
      [self tri:p colors:&words[i + 4]];
      i += 7;
    } else if (op == OP_TEXT_RUN) {
      if (i + 8 > n) break; // native-text op: never emitted here (no native measurer)
      i += 8 + (words[i + 7] + 3) / 4;
    } else if (op == OP_OFFSET) {
      if (i + 3 > n) break;
      if (offsetDepth + 2 <= 64) {
        offsets[offsetDepth++] = offX;
        offsets[offsetDepth++] = offY;
      }
      offX += bitsToF32(words[i + 1]);
      offY += bitsToF32(words[i + 2]);
      ox = roundf(offX * s);
      oy = roundf(offY * s);
      i += 3;
    } else if (op == OP_OFFSET_POP) {
      if (offsetDepth >= 2) {
        offY = offsets[--offsetDepth];
        offX = offsets[--offsetDepth];
        ox = roundf(offX * s);
        oy = roundf(offY * s);
      }
      i += 1;
    } else if (op == OP_SURFACE_QUAD) {
      i += 9; // compositor surfaces: a Pocket System feature this host does not use
    } else {
      break; // closed op set: anything else is corrupt
    }
  }
#undef SNAPX
#undef SNAPY
  [self flushBatch];
}

// ---- frame ---------------------------------------------------------------------------------

- (BOOL)prepareFrame:(PocketApple *)handle
        logicalWidth:(uint32_t)logicalWidth
       logicalHeight:(uint32_t)logicalHeight {
  int bufferW = 0, bufferH = 0;
  BOOL resized = NO;
  if (logicalWidth == 0 || logicalHeight == 0 ||
      ![_backend prepareDrawableWidth:&bufferW height:&bufferH resized:&resized]) {
    return NO;
  }
  // A new drawable holds no frame: draw even an unchanged DrawList.
  if (resized) pocket_apple_gpu_invalidate();
  uint32_t length = 0, changed = 0;
  const uint32_t *words = pocket_apple_gpu_draw(handle, &length, &changed);
  if (words == NULL || !changed) return NO;
  CFTimeInterval t0 = CACurrentMediaTime();
  uint32_t version = pocket_apple_gpu_resources_version(handle);
  _syncs = 0;
  if (!_synced || version != _syncedVersion) {
    [self syncFonts:handle];
    [self syncImages:handle];
    _syncedVersion = version;
    _synced = YES;
    _syncs = 1;
  }
  CFTimeInterval t1 = CACurrentMediaTime();
  // The pack calls above only touch staging buffers, never the DrawList: `words` stays valid.

  // Fit the logical canvas into the drawable (they match except mid-rotation).
  float s = MIN((float)bufferW / logicalWidth, (float)bufferH / logicalHeight);
  int vw = (int)lroundf(logicalWidth * s), vh = (int)lroundf(logicalHeight * s);
  int vx = (bufferW - vw) / 2, vy = (bufferH - vh) / 2;  // top-left origin
  [self buildWords:words count:length width:vw height:vh scale:s];
  CFTimeInterval t2 = CACurrentMediaTime();
  _syncMs = (t1 - t0) * 1000.0;
  _buildMs = (t2 - t1) * 1000.0;
  _words = length;
  _quads = _quadCount;
  _draws = _batchCount;
  [_backend drawVertices:_verts
                   quads:_quadCount
                 batches:_batches
                   count:_batchCount
                viewport:CGRectMake(vx, vy, vw, vh)];
  return YES;
}

- (void)present {
  [_backend present];
}

@end
