// hosts/web/gpu.js — WebGL2 backend for the PocketJS DrawList.
//
// The software rasterizer (ui_render_scaled) costs ~3 ns per device pixel: a 2x frame of a
// 900x700 window is ~7 ms, a 1440x900 one ~15 ms, so full-resolution frames could not fit a
// 120 Hz budget (8.3 ms) and the host dropped to 1x while anything moved. This backend draws
// the same DrawList on the GPU, so every frame is full resolution at the panel's refresh rate.
//
// Inputs come from the Pocket Home wasm (engine/web): gpu_draw (DrawList words),
// gpu_font_pack (glyph coverage, R8) and gpu_texture_pack (RGBA8). Blending is straight alpha
// in sRGB byte space, like the software rasterizer, so both backends match visually.
//
// Scale may be fractional (the exact devicePixelRatio): coordinates are logical px x scale and
// every quad edge is snapped to the device-pixel grid, so edges stay hard and glyph cells stay
// aligned to texels (glyph atlases are baked at ceil(dpr) and sampled linearly).
//
// Batching. A frame is a handful of draw calls, not one per texture or clip: in Safari every
// WebGL call is serialized to the GPU process, and a dashboard frame used to issue ~170 draws,
// 170 texture binds and 170 scissor changes — ~4.4 ms (up to 15 ms) of GPU-process time per
// frame for ~0.3 ms of our own JS, on top of what the page could measure. Now:
//   * small nearest-filtered images (icons) live in shared atlas pages;
//   * fonts, atlas pages and the remaining images are bound to up to 16 texture units, and each
//     vertex names its unit, so a batch only breaks when a 17th texture is needed;
//   * quads are clipped to the current scissor on the CPU (UVs and gradient colours follow), so
//     clips cost no GL state; only a triangle crossing a clip still takes a scissored draw;
//   * quads are indexed (4 vertices + a static index buffer).

const MAX_UNITS = 16;

const VERT = `#version 300 es
in vec2 aPos;
in vec2 aUv;
in vec4 aColor;
in float aMode;
uniform vec2 uView;
out vec2 vUv;
out vec4 vColor;
flat out int vMode;
flat out int vUnit;
void main() {
  gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0);
  vUv = aUv;
  vColor = aColor;
  int m = int(aMode + 0.5);
  vMode = m & 3;
  vUnit = m >> 2;
}`;

/** Fragment shader over `units` texture units (sampler arrays take constant indices only). */
function fragSource(units) {
  const pick = Array.from(
    { length: units },
    (_, k) => `  if (u == ${k}) return textureLod(uTex[${k}], uv, 0.0);`,
  ).join("\n");
  return `#version 300 es
precision highp float;
uniform sampler2D uTex[${units}];
in vec2 vUv;
in vec4 vColor;
flat in int vMode;
flat in int vUnit;
out vec4 outColor;
vec4 sampleUnit(int u, vec2 uv) {
${pick}
  return vec4(1.0);
}
void main() {
  vec4 c = vColor;
  if (vMode == 1) {
    c *= sampleUnit(vUnit, vUv);
  } else if (vMode == 2) {
    c.a *= sampleUnit(vUnit, vUv).r;
  }
  outColor = c;
}`;
}

// spec.ts DRAW_OP
const RECT = 1;
const GRAD_RECT = 2;
const GLYPH_RUN = 3;
const TEX_QUAD = 4;
const SCISSOR = 5;
const SCISSOR_POP = 6;
const TRI = 7;
const TEX_TRI = 8;
const TEXT_RUN = 9;
const SURFACE_QUAD = 10;
// Pocket Home core patch (engine/core spec.rs draw_op): sub-pixel translate scopes.
const OFFSET = 11;
const OFFSET_POP = 12;
// spec.ts GradDir { ToTop: 0, ToBottom: 1, ToLeft: 2, ToRight: 3 }
const TO_TOP = 0;
const TO_LEFT = 2;
const TO_RIGHT = 3;
const TEX_SLOT_MASK = 0xfffff; // spec TEX_SLOT_BITS = 20
const MAX_FONT_SLOTS = 24; // spec MAX_FONT_SLOTS

const MODE_SOLID = 0;
const MODE_IMAGE = 1;
const MODE_GLYPH = 2;
const FLOATS_PER_VERTEX = 6; // pos.xy, uv.xy, color (u32 bits), mode + 4 * unit

// Atlas pages for small nearest-filtered images. Linear-filtered sprites (the baked corner
// discs) keep their own textures: bilinear taps at a region's edge would read the neighbour.
const ATLAS_SIZE = 2048;
const ATLAS_PAD = 2; // extruded border around every region
const ATLAS_MAX_IMAGE = 256;
const ATLAS_MAX_PAGES = 4;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("pocket gpu: shader: " + gl.getShaderInfoLog(shader));
  }
  return shader;
}

/** Channel-wise lerp of two ABGR u32 colours. */
function lerpColor(a, b, t) {
  if (a === b || t <= 0) return a;
  if (t >= 1) return b;
  let out = 0;
  for (let shift = 0; shift < 32; shift += 8) {
    const ca = (a >>> shift) & 0xff;
    const cb = (b >>> shift) & 0xff;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out >>> 0;
}

/**
 * WebGL2 DrawList renderer, or null when WebGL2 or the wasm GPU exports are unavailable
 * (the host then keeps the software rasterizer).
 */
export function createGpuRenderer(canvas, wasm) {
  const ex = wasm && wasm.exports;
  if (!ex || typeof ex.gpu_draw !== "function") return null;
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    desynchronized: true,
  });
  if (!gl) return null;
  const units = Math.max(1, Math.min(MAX_UNITS, gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)));
  // Clear to the page's background (the canvas CSS background, i.e. the app colour) rather
  // than black: letterbox gaps and any frame before the app's first draw match the page.
  const clearRgb = (getComputedStyle(canvas).backgroundColor.match(/[\d.]+/g) || [0, 0, 0])
    .slice(0, 3)
    .map((c) => Number(c) / 255);

  let program, vao, vbo, ibo, uView, white;
  let indexQuads = 0; // quads the index buffer covers
  // per slot: { tex, texW, texH, covW, covH, cellW, cellH, cols, count, rev }
  let fonts = new Array(MAX_FONT_SLOTS).fill(null);
  // per slot: { handle, revLo, revHi, linear, w, h, tex, page, mapU, mapV, scaleU, scaleV }
  let images = [];
  let pages = []; // atlas pages: { tex, shelves: [{ y, h, x }], nextY }
  let lost = false;

  let cpu = new ArrayBuffer(64 * 1024);
  let f32 = new Float32Array(cpu);
  let u32 = new Uint32Array(cpu);
  let quadCount = 0;
  // Draw calls: { start, count (quads), units: [GL textures by unit], scissor: [x, y, w, h] | null }
  const cmds = [];
  // Textures uploaded since the last frame. WebKit (ANGLE on Metal) creates the GPU copy of a
  // texture the first time a draw samples it, not at texImage2D: every icon first revealed by a
  // scroll stalled that frame (the first fling after load dropped frames of 65-190 ms). Each new
  // texture is sampled once by an invisible (alpha 0) one-pixel quad in the frame after upload.
  const warm = new Set();
  const bound = new Array(MAX_UNITS).fill(null); // texture per unit (GL state cache)

  /** Bind for upload / parameters on unit 0, keeping the draw-time binding cache honest. */
  function bindForUpload(tex) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    bound[0] = null;
  }

  function setup() {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSource(units)));
    gl.bindAttribLocation(program, 0, "aPos");
    gl.bindAttribLocation(program, 1, "aUv");
    gl.bindAttribLocation(program, 2, "aColor");
    gl.bindAttribLocation(program, 3, "aMode");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("pocket gpu: link: " + gl.getProgramInfoLog(program));
    }
    uView = gl.getUniformLocation(program, "uView");
    gl.useProgram(program);
    gl.uniform1iv(
      gl.getUniformLocation(program, "uTex"),
      Int32Array.from({ length: units }, (_, k) => k),
    );
    vao = gl.createVertexArray();
    vbo = gl.createBuffer();
    ibo = gl.createBuffer();
    indexQuads = 0;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    // ABGR u32 = R,G,B,A bytes in little-endian memory.
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 20);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bindVertexArray(null);

    white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, white);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    setFilter(false);
    // Every unit starts with a complete texture.
    for (let k = 0; k < units; k++) {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, white);
    }
    gl.activeTexture(gl.TEXTURE0);
    bound.fill(null);
    syncedVersion = undefined;
    fonts = new Array(MAX_FONT_SLOTS).fill(null);
    images = [];
    pages = [];
    warm.clear();
  }

  function setFilter(linear) {
    const f = linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    setup();
    lost = false;
    ex.gpu_draw_invalidate();
  });

  // ---- resource sync (mirrors pocket-ui-wgpu sync_textures) --------------------------------

  let infoView = null;
  /** gpu_info words (one view, rebuilt only when linear memory grows). */
  function info() {
    if (!infoView || infoView.buffer !== ex.memory.buffer) {
      infoView = new Uint32Array(ex.memory.buffer, ex.gpu_info(), 8);
    }
    return infoView;
  }
  // gpu_resources_version at the last sync (fonts + texture slots): unchanged = nothing to do.
  let syncedVersion;

  function syncFonts() {
    for (let slot = 0; slot < MAX_FONT_SLOTS; slot++) {
      const rev = ex.gpu_font_revision(slot);
      const cached = fonts[slot];
      if (rev === 0) {
        if (cached) gl.deleteTexture(cached.tex);
        fonts[slot] = null;
        continue;
      }
      if (cached && cached.rev === rev) continue;
      const ptr = ex.gpu_font_pack(slot);
      if (!ptr) continue;
      const m = info();
      const [texW, texH, covW, covH, cellW, cellH, cols, count] = [
        m[0],
        m[1],
        m[2],
        m[3],
        m[4],
        m[5],
        m[6],
        m[7],
      ];
      const tex = cached ? cached.tex : gl.createTexture();
      bindForUpload(tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        texW,
        texH,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        new Uint8Array(ex.memory.buffer, ptr, texW * texH),
      );
      setFilter(true);
      fonts[slot] = { tex, texW, texH, covW, covH, cellW, cellH, cols, count, rev };
      warm.add(tex);
    }
  }

  /** Region of w x h (plus padding) in an atlas page, or null when the atlas is full. */
  function atlasAlloc(w, h) {
    const pw = w + 2 * ATLAS_PAD;
    const ph = h + 2 * ATLAS_PAD;
    for (const page of pages) {
      for (const shelf of page.shelves) {
        if (ph <= shelf.h && shelf.x + pw <= ATLAS_SIZE) {
          const region = { page, x: shelf.x, y: shelf.y };
          shelf.x += pw;
          return region;
        }
      }
      if (page.nextY + ph <= ATLAS_SIZE) {
        page.shelves.push({ y: page.nextY, h: ph, x: pw });
        const region = { page, x: 0, y: page.nextY };
        page.nextY += ph;
        return region;
      }
    }
    if (pages.length >= ATLAS_MAX_PAGES) return null;
    const tex = gl.createTexture();
    bindForUpload(tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, ATLAS_SIZE, ATLAS_SIZE);
    setFilter(false);
    const page = { tex, shelves: [{ y: 0, h: ph, x: pw }], nextY: ph };
    pages.push(page);
    return { page, x: 0, y: 0 };
  }

  let padScratch = new Uint8Array(0);
  /** RGBA w x h pixels with every edge extruded by ATLAS_PAD (so no tap reads a neighbour). */
  function padded(src, w, h) {
    const pw = w + 2 * ATLAS_PAD;
    const ph = h + 2 * ATLAS_PAD;
    if (padScratch.length < pw * ph * 4) padScratch = new Uint8Array(pw * ph * 4);
    const out = padScratch;
    for (let y = 0; y < ph; y++) {
      const sy = Math.min(h - 1, Math.max(0, y - ATLAS_PAD));
      const row = src.subarray(sy * w * 4, (sy + 1) * w * 4);
      const base = y * pw * 4;
      out.set(row, base + ATLAS_PAD * 4);
      for (let x = 0; x < ATLAS_PAD; x++) {
        out.copyWithin(base + x * 4, base + ATLAS_PAD * 4, base + ATLAS_PAD * 4 + 4);
        const r = base + (ATLAS_PAD + w + x) * 4;
        out.copyWithin(r, base + (ATLAS_PAD + w - 1) * 4, base + (ATLAS_PAD + w) * 4);
      }
    }
    return out.subarray(0, pw * ph * 4);
  }

  function freeImage(image) {
    // Atlas regions are not reclaimed (images are uploaded once per app load); own textures are.
    if (image && image.page === null) gl.deleteTexture(image.tex);
  }

  function syncImages() {
    const slots = ex.gpu_texture_slot_count();
    for (let slot = 0; slot < slots; slot++) {
      const cached = images[slot];
      if (!ex.gpu_texture_meta(slot)) {
        freeImage(cached);
        images[slot] = null;
        continue;
      }
      const m = info();
      const handle = m[0];
      const revLo = m[1];
      const revHi = m[2];
      if (
        cached &&
        cached.handle === (handle | 0) &&
        cached.revLo === revLo &&
        cached.revHi === revHi
      ) {
        continue;
      }
      const w = m[3];
      const h = m[4];
      const linear = m[5];
      const ptr = ex.gpu_texture_pack(slot);
      if (!ptr) {
        freeImage(cached);
        images[slot] = null;
        continue;
      }
      const pixels = new Uint8Array(ex.memory.buffer, ptr, w * h * 4);
      const reuse =
        cached && cached.w === w && cached.h === h && cached.linear === linear ? cached : null;
      if (!reuse) freeImage(cached);
      let region = reuse && reuse.page ? reuse.region : null;
      if (!reuse && !linear && w <= ATLAS_MAX_IMAGE && h <= ATLAS_MAX_IMAGE) {
        region = atlasAlloc(w, h);
      }
      let image;
      if (region) {
        bindForUpload(region.page.tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          region.x,
          region.y,
          w + 2 * ATLAS_PAD,
          h + 2 * ATLAS_PAD,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          padded(pixels, w, h),
        );
        image = {
          tex: region.page.tex,
          page: region.page,
          region,
          // uv in [0, 1] of the image -> atlas uv
          mapU: (region.x + ATLAS_PAD) / ATLAS_SIZE,
          mapV: (region.y + ATLAS_PAD) / ATLAS_SIZE,
          scaleU: w / ATLAS_SIZE,
          scaleV: h / ATLAS_SIZE,
        };
      } else {
        const tex = reuse ? reuse.tex : gl.createTexture();
        bindForUpload(tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        setFilter(linear !== 0);
        image = { tex, page: null, region: null, mapU: 0, mapV: 0, scaleU: 1, scaleV: 1 };
      }
      Object.assign(image, { handle: handle | 0, revLo, revHi, linear, w, h });
      images[slot] = image;
      warm.add(image.tex);
    }
    for (let slot = slots; slot < images.length; slot++) freeImage(images[slot]);
    images.length = slots;
  }

  // ---- batching ------------------------------------------------------------------------------

  function reserveQuads(n) {
    const need = (quadCount + n) * 4 * FLOATS_PER_VERTEX;
    if (need <= f32.length) return;
    let size = cpu.byteLength;
    while (size < need * 4) size *= 2;
    const next = new ArrayBuffer(size);
    new Uint32Array(next).set(u32.subarray(0, quadCount * 4 * FLOATS_PER_VERTEX));
    cpu = next;
    f32 = new Float32Array(cpu);
    u32 = new Uint32Array(cpu);
  }

  function vertex(o, x, y, u, v, color, mode) {
    f32[o] = x;
    f32[o + 1] = y;
    f32[o + 2] = u;
    f32[o + 3] = v;
    u32[o + 4] = color;
    f32[o + 5] = mode;
  }

  /** Four vertices TL, TR, BR, BL (a triangle repeats its last vertex: a degenerate half). */
  function emit(
    x0,
    y0,
    u0,
    v0,
    c0,
    x1,
    y1,
    u1,
    v1,
    c1,
    x2,
    y2,
    u2,
    v2,
    c2,
    x3,
    y3,
    u3,
    v3,
    c3,
    mode,
  ) {
    reserveQuads(1);
    const o = quadCount * 4 * FLOATS_PER_VERTEX;
    vertex(o, x0, y0, u0, v0, c0, mode);
    vertex(o + FLOATS_PER_VERTEX, x1, y1, u1, v1, c1, mode);
    vertex(o + 2 * FLOATS_PER_VERTEX, x2, y2, u2, v2, c2, mode);
    vertex(o + 3 * FLOATS_PER_VERTEX, x3, y3, u3, v3, c3, mode);
    quadCount++;
  }

  const sx = (w) => (w << 16) >> 16; // low i16
  const sy = (w) => w >> 16; // high i16
  const uw = (w) => w & 0xffff;
  const uh = (w) => w >>> 16;

  function build(words, targetW, targetH, s) {
    quadCount = 0;
    cmds.length = 0;
    // OFFSET scopes (sub-pixel translates, e.g. a scroll offset mid-fling) shift their contents
    // by the accumulated fraction, snapped to whole device pixels so edges stay hard and glyph
    // cells stay texel-aligned: motion has device-pixel precision instead of logical-px steps.
    let offX = 0; // accumulated logical offset
    let offY = 0;
    let ox = 0; // ... in whole device px
    let oy = 0;
    const offsets = [];
    const snapX = (v) => Math.round(v * s) + ox;
    const snapY = (v) => Math.round(v * s) + oy;

    // Current clip in device px (the core's SCISSOR, applied on the CPU).
    let cx0 = 0;
    let cy0 = 0;
    let cx1 = targetW;
    let cy1 = targetH;
    const clipStack = [];

    // Current batch: its textures by unit. A batch ends when a texture finds no free unit (or a
    // triangle needs a GL scissor); the next one keeps the same bindings where it can.
    let batchUnits = [];
    let batchStart = 0;
    let batchScissor = null;
    const flushBatch = () => {
      if (quadCount > batchStart) {
        cmds.push({
          start: batchStart,
          count: quadCount - batchStart,
          units: batchUnits.slice(),
          scissor: batchScissor,
        });
      }
      batchStart = quadCount;
    };
    /** Unit index of `tex` in the current batch (call BEFORE emitting the quads that use it). */
    const unit = (tex) => {
      const at = batchUnits.indexOf(tex);
      if (at >= 0) return at;
      if (batchUnits.length >= units) {
        flushBatch();
        batchUnits = [];
      }
      batchUnits.push(tex);
      return batchUnits.length - 1;
    };
    const splitForScissor = (scissor) => {
      flushBatch();
      batchScissor = scissor;
    };

    // UV transform for quad(): uv = offset + given * scale. Glyphs pass whole texel coordinates
    // and images [0, 1] of the image, so the hot path passes integers (V8 boxes doubles and
    // large ints passed as arguments: ~1 MB/s of garbage while scrolling).
    let uvOU = 0;
    let uvOV = 0;
    let uvSU = 1;
    let uvSV = 1;
    const setUv = (ou, ov, su, sv) => {
      uvOU = ou;
      uvOV = ov;
      uvSU = su;
      uvSV = sv;
    };

    /**
     * Axis-aligned quad in device px, clipped to the current clip: UVs and corner colours
     * (TL, TR, BR, BL; ABGR as int32) are interpolated to the clipped edges.
     */
    const quad = (x0, y0, x1, y1, u0, v0, u1, v1, c0, c1, c2, c3, mode) => {
      if (x1 <= cx0 || x0 >= cx1 || y1 <= cy0 || y0 >= cy1 || x1 <= x0 || y1 <= y0) return;
      if (x0 < cx0 || y0 < cy0 || x1 > cx1 || y1 > cy1) {
        const w = x1 - x0;
        const h = y1 - y0;
        const tx0 = x0 < cx0 ? (cx0 - x0) / w : 0;
        const tx1 = x1 > cx1 ? (cx1 - x0) / w : 1;
        const ty0 = y0 < cy0 ? (cy0 - y0) / h : 0;
        const ty1 = y1 > cy1 ? (cy1 - y0) / h : 1;
        const du = u1 - u0;
        const dv = v1 - v0;
        if (!(c0 === c1 && c1 === c2 && c2 === c3)) {
          // Bilinear corner colours (TL c0, TR c1, BR c2, BL c3) at the clipped corners.
          const at = (tx, ty) => lerpColor(lerpColor(c0, c1, tx), lerpColor(c3, c2, tx), ty);
          const n0 = at(tx0, ty0);
          const n1 = at(tx1, ty0);
          const n2 = at(tx1, ty1);
          const n3 = at(tx0, ty1);
          c0 = n0 | 0;
          c1 = n1 | 0;
          c2 = n2 | 0;
          c3 = n3 | 0;
        }
        u1 = u0 + du * tx1;
        u0 = u0 + du * tx0;
        v1 = v0 + dv * ty1;
        v0 = v0 + dv * ty0;
        x0 = Math.max(x0, cx0);
        y0 = Math.max(y0, cy0);
        x1 = Math.min(x1, cx1);
        y1 = Math.min(y1, cy1);
      }
      reserveQuads(1);
      const o = quadCount * 4 * FLOATS_PER_VERTEX;
      const tu0 = uvOU + u0 * uvSU;
      const tv0 = uvOV + v0 * uvSV;
      const tu1 = uvOU + u1 * uvSU;
      const tv1 = uvOV + v1 * uvSV;
      f32[o] = x0;
      f32[o + 1] = y0;
      f32[o + 2] = tu0;
      f32[o + 3] = tv0;
      u32[o + 4] = c0;
      f32[o + 5] = mode;
      f32[o + 6] = x1;
      f32[o + 7] = y0;
      f32[o + 8] = tu1;
      f32[o + 9] = tv0;
      u32[o + 10] = c1;
      f32[o + 11] = mode;
      f32[o + 12] = x1;
      f32[o + 13] = y1;
      f32[o + 14] = tu1;
      f32[o + 15] = tv1;
      u32[o + 16] = c2;
      f32[o + 17] = mode;
      f32[o + 18] = x0;
      f32[o + 19] = y1;
      f32[o + 20] = tu0;
      f32[o + 21] = tv1;
      u32[o + 22] = c3;
      f32[o + 23] = mode;
      quadCount++;
    };

    /** Triangle: batched when inside the clip, else drawn with a GL scissor of its own. */
    const tri = (x0, y0, u0, v0, c0, x1, y1, u1, v1, c1, x2, y2, u2, v2, c2, mode) => {
      const minX = Math.min(x0, x1, x2);
      const maxX = Math.max(x0, x1, x2);
      const minY = Math.min(y0, y1, y2);
      const maxY = Math.max(y0, y1, y2);
      if (maxX <= cx0 || minX >= cx1 || maxY <= cy0 || minY >= cy1) return;
      const inside = minX >= cx0 && maxX <= cx1 && minY >= cy0 && maxY <= cy1;
      if (!inside) splitForScissor([cx0, cy0, cx1 - cx0, cy1 - cy0]);
      emit(x0, y0, u0, v0, c0, x1, y1, u1, v1, c1, x2, y2, u2, v2, c2, x2, y2, u2, v2, c2, mode);
      if (!inside) splitForScissor(null);
    };

    /** Image by core handle, or null for a stale handle (draws nothing, like the core). */
    const imageFor = (handle) => {
      const image = images[handle & TEX_SLOT_MASK];
      return image && image.handle === handle ? image : null;
    };
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

    const n = words.length;
    let i = 0;
    while (i < n) {
      const op = words[i];
      if (op === RECT) {
        if (i + 4 > n) break;
        const c = words[i + 3] | 0;
        const w = uw(words[i + 2]);
        const h = uh(words[i + 2]);
        if (w > 0 && h > 0 && c >>> 24 !== 0) {
          const x = sx(words[i + 1]);
          const y = sy(words[i + 1]);
          setUv(0, 0, 1, 1);
          quad(snapX(x), snapY(y), snapX(x + w), snapY(y + h), 0, 0, 1, 1, c, c, c, c, MODE_SOLID);
        }
        i += 4;
      } else if (op === GRAD_RECT) {
        if (i + 6 > n) break;
        const x = sx(words[i + 1]);
        const y = sy(words[i + 1]);
        const w = uw(words[i + 2]);
        const h = uh(words[i + 2]);
        const from = words[i + 3] | 0;
        const to = words[i + 4] | 0;
        const dir = words[i + 5];
        if (w > 0 && h > 0) {
          let c; // TL, TR, BR, BL
          if (dir === TO_TOP) c = [to, to, from, from];
          else if (dir === TO_LEFT) c = [to, from, from, to];
          else if (dir === TO_RIGHT) c = [from, to, to, from];
          else c = [from, from, to, to];
          setUv(0, 0, 1, 1);
          quad(
            snapX(x),
            snapY(y),
            snapX(x + w),
            snapY(y + h),
            0,
            0,
            1,
            1,
            c[0],
            c[1],
            c[2],
            c[3],
            MODE_SOLID,
          );
        }
        i += 6;
      } else if (op === GLYPH_RUN) {
        if (i + 3 > n) break;
        const slot = words[i + 1] & 0xff;
        const count = words[i + 1] >>> 16;
        const color = words[i + 2] | 0;
        if (i + 3 + 2 * count > n) break;
        const font = fonts[slot];
        if (font && count > 0) {
          const mode = MODE_GLYPH + 4 * unit(font.tex);
          setUv(0, 0, 1 / font.texW, 1 / font.texH); // texel coordinates
          // Draw the logical cell at scale; snap the origin so texels land on pixels.
          const dw = Math.round(font.cellW * s);
          const dh = Math.round(font.cellH * s);
          for (let k = 0; k < count; k++) {
            const xy = words[i + 3 + 2 * k];
            const gid = words[i + 4 + 2 * k] & 0xffff;
            if (gid >= font.count) continue;
            const gx = snapX(sx(xy));
            const gy = snapY(sy(xy));
            const col = gid % font.cols;
            const row = (gid / font.cols) | 0;
            const u0 = col * font.covW;
            const v0 = row * font.covH;
            quad(
              gx,
              gy,
              gx + dw,
              gy + dh,
              u0,
              v0,
              u0 + font.covW,
              v0 + font.covH,
              color,
              color,
              color,
              color,
              mode,
            );
          }
        }
        i += 3 + 2 * count;
      } else if (op === TEX_QUAD) {
        if (i + 9 > n) break;
        const image = imageFor(words[i + 1] | 0);
        const w = uw(words[i + 3]);
        const h = uh(words[i + 3]);
        if (image && w > 0 && h > 0) {
          const x = sx(words[i + 2]);
          const y = sy(words[i + 2]);
          const m = words[i + 8] | 0;
          const mode = MODE_IMAGE + 4 * unit(image.tex);
          setUv(image.mapU, image.mapV, image.scaleU, image.scaleV);
          quad(
            snapX(x),
            snapY(y),
            snapX(x + w),
            snapY(y + h),
            clamp01(bitsToF32(words[i + 4])),
            clamp01(bitsToF32(words[i + 5])),
            clamp01(bitsToF32(words[i + 6])),
            clamp01(bitsToF32(words[i + 7])),
            m,
            m,
            m,
            m,
            mode,
          );
        }
        i += 9;
      } else if (op === SCISSOR) {
        if (i + 3 > n) break;
        const x = sx(words[i + 1]);
        const y = sy(words[i + 1]);
        const w = uw(words[i + 2]);
        const h = uh(words[i + 2]);
        clipStack.push(cx0, cy0, cx1, cy1);
        // The core intersects every scissor with its enclosing ones, but inside an OFFSET scope
        // the rect is shifted and an edge inherited from an outer (unshifted) clip would move
        // with it: intersect with the enclosing clip again so nothing leaks past it.
        const nx0 = Math.max(snapX(x), cx0);
        const ny0 = Math.max(snapY(y), cy0);
        cx1 = Math.max(nx0, Math.min(snapX(x + w), cx1));
        cy1 = Math.max(ny0, Math.min(snapY(y + h), cy1));
        cx0 = nx0;
        cy0 = ny0;
        i += 3;
      } else if (op === SCISSOR_POP) {
        if (clipStack.length >= 4) {
          cy1 = clipStack.pop();
          cx1 = clipStack.pop();
          cy0 = clipStack.pop();
          cx0 = clipStack.pop();
        } else {
          cx0 = 0;
          cy0 = 0;
          cx1 = targetW;
          cy1 = targetH;
        }
        i += 1;
      } else if (op === TEX_TRI) {
        if (i + 12 > n) break;
        const image = imageFor(words[i + 1] | 0);
        if (image) {
          const m = words[i + 11];
          const px = (k) => sx(words[i + 2 + k * 3]) * s + ox;
          const py = (k) => sy(words[i + 2 + k * 3]) * s + oy;
          const pu = (k) => image.mapU + clamp01(bitsToF32(words[i + 3 + k * 3])) * image.scaleU;
          const pv = (k) => image.mapV + clamp01(bitsToF32(words[i + 4 + k * 3])) * image.scaleV;
          tri(
            px(0),
            py(0),
            pu(0),
            pv(0),
            m,
            px(1),
            py(1),
            pu(1),
            pv(1),
            m,
            px(2),
            py(2),
            pu(2),
            pv(2),
            m,
            MODE_IMAGE + 4 * unit(image.tex),
          );
        }
        i += 12;
      } else if (op === TRI) {
        if (i + 7 > n) break;
        const px = (k) => sx(words[i + 1 + k]) * s + ox;
        const py = (k) => sy(words[i + 1 + k]) * s + oy;
        tri(
          px(0),
          py(0),
          0,
          0,
          words[i + 4],
          px(1),
          py(1),
          0,
          0,
          words[i + 5],
          px(2),
          py(2),
          0,
          0,
          words[i + 6],
          MODE_SOLID,
        );
        i += 7;
      } else if (op === TEXT_RUN) {
        // Native-text op; only emitted when a host installs a native measurer (never here).
        if (i + 8 > n) break;
        i += 8 + Math.ceil(words[i + 7] / 4);
      } else if (op === OFFSET) {
        if (i + 3 > n) break;
        offsets.push(offX, offY);
        offX += bitsToF32(words[i + 1]);
        offY += bitsToF32(words[i + 2]);
        ox = Math.round(offX * s);
        oy = Math.round(offY * s);
        i += 3;
      } else if (op === OFFSET_POP) {
        if (offsets.length >= 2) {
          offY = offsets.pop();
          offX = offsets.pop();
          ox = Math.round(offX * s);
          oy = Math.round(offY * s);
        }
        i += 1;
      } else if (op === SURFACE_QUAD) {
        i += 9; // compositor surfaces are a Pocket System feature this host does not use
      } else {
        break; // closed op set: anything else is corrupt
      }
    }

    // Warm new textures (see `warm`): an invisible one-pixel quad sampling each.
    cx0 = 0;
    cy0 = 0;
    cx1 = targetW;
    cy1 = targetH;
    setUv(0, 0, 1, 1);
    for (const tex of warm) {
      if (!gl.isTexture(tex)) continue;
      quad(0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, MODE_IMAGE + 4 * unit(tex));
    }
    warm.clear();
    flushBatch();
  }

  const f32Scratch = new Float32Array(1);
  const u32Scratch = new Uint32Array(f32Scratch.buffer);
  function bitsToF32(bits) {
    u32Scratch[0] = bits;
    return f32Scratch[0];
  }

  // ---- present --------------------------------------------------------------------------

  /** Static index buffer [0 1 2 0 2 3] per quad, grown to cover `quads`. */
  function ensureIndices(quads) {
    if (quads <= indexQuads) return;
    let size = Math.max(1024, indexQuads);
    while (size < quads) size *= 2;
    const idx = new Uint32Array(size * 6);
    for (let q = 0, v = 0, o = 0; q < size; q++, v += 4, o += 6) {
      idx[o] = v;
      idx[o + 1] = v + 1;
      idx[o + 2] = v + 2;
      idx[o + 3] = v;
      idx[o + 4] = v + 2;
      idx[o + 5] = v + 3;
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    indexQuads = size;
  }

  setup();

  // Last render() phases in ms (hosts/web/perf.js): core DrawList, resource sync, batching, GL;
  // and the frame's GL volume (draw calls, texture binds, vertices, DrawList words).
  const timings = { draw: 0, sync: 0, build: 0, gl: 0, draws: 0, binds: 0, verts: 0, words: 0 };
  const gpuSync = new URLSearchParams(location.search).get("gpusync") === "1";
  const syncPixel = new Uint8Array(4);
  if (gpuSync) timings.gpuSync = 0;

  return {
    timings,
    /** True when the WebGL context is currently lost (the host falls back to skipping). */
    get lost() {
      return lost;
    },
    /**
     * Draw the current DrawList into the canvas (which must already be sized to
     * logical x scale). Returns true when a frame was drawn; false when the DrawList was
     * unchanged and `force` is false (the previous frame stays on screen).
     */
    render(scale, force) {
      timings.draw = timings.sync = timings.build = timings.gl = 0;
      timings.draws = timings.binds = timings.verts = timings.words = 0;
      if (gpuSync) timings.gpuSync = 0;
      if (lost) return false;
      const t0 = performance.now();
      const ptr = ex.gpu_draw();
      const t1 = performance.now();
      timings.draw = t1 - t0;
      if (!ex.gpu_draw_changed() && !force) return false;
      const version = ex.gpu_resources_version ? ex.gpu_resources_version() : NaN;
      if (version !== syncedVersion) {
        syncFonts();
        syncImages();
        syncedVersion = version;
      }
      const t2 = performance.now();
      timings.sync = t2 - t1;
      // Read the words after the syncs: pack calls may grow (and detach) linear memory.
      const words = new Uint32Array(ex.memory.buffer, ptr, ex.gpu_draw_len());
      const W = canvas.width;
      const H = canvas.height;
      build(words, W, H, scale);
      const t3 = performance.now();
      timings.build = t3 - t2;

      gl.viewport(0, 0, W, H);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(clearRgb[0], clearRgb[1], clearRgb[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      timings.words = words.length;
      if (quadCount === 0) return true;
      gl.useProgram(program);
      gl.uniform2f(uView, W, H);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        f32.subarray(0, quadCount * 4 * FLOATS_PER_VERTEX),
        gl.STREAM_DRAW,
      );
      ensureIndices(quadCount);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      let scissorOn = false;
      for (const cmd of cmds) {
        for (let k = 0; k < cmd.units.length; k++) {
          const tex = cmd.units[k];
          if (bound[k] !== tex) {
            gl.activeTexture(gl.TEXTURE0 + k);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            bound[k] = tex;
            timings.binds++;
          }
        }
        if (cmd.scissor) {
          const [x, y, w, h] = cmd.scissor;
          if (w <= 0 || h <= 0) continue;
          if (!scissorOn) gl.enable(gl.SCISSOR_TEST);
          scissorOn = true;
          gl.scissor(x, H - (y + h), w, h);
        } else if (scissorOn) {
          gl.disable(gl.SCISSOR_TEST);
          scissorOn = false;
        }
        gl.drawElements(gl.TRIANGLES, cmd.count * 6, gl.UNSIGNED_INT, cmd.start * 6 * 4);
        timings.draws++;
      }
      timings.verts = quadCount * 4;
      if (gpuSync) {
        // Diagnostics (?perf=1&gpusync=1): wait for this frame's commands to execute. WebKit
        // runs WebGL in a GPU process that the page's timers never see; a one-pixel read-back
        // is a round trip through it (gl.finish() is not: WebKit treats it as a flush).
        const tf = performance.now();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPixel);
        timings.gpuSync = performance.now() - tf;
      }
      gl.bindVertexArray(null);
      timings.gl = performance.now() - t3;
      return true;
    },
  };
}
