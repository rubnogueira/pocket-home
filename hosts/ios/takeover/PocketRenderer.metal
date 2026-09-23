// PocketRenderer's Metal shaders (PocketMetalBackend.m), precompiled into PocketRenderer.metallib
// by tools/ios-native.ts (arm64 tiers) and tools/ios-app/pocket-apple-framework.ts (modern app):
// compiling the source at runtime took ~2.5 s on a cold Simulator launch. Same shading as
// PocketGLBackend.m: vertex colour x texel, positions in drawable px.
#include <metal_stdlib>
using namespace metal;

struct VIn {
  float2 pos [[attribute(0)]];
  float2 uv [[attribute(1)]];
  float4 color [[attribute(2)]];
};

struct VOut {
  float4 position [[position]];
  float2 uv;
  float4 color;
};

vertex VOut pocket_vertex(VIn in [[stage_in]], constant float2 &scale [[buffer(1)]]) {
  VOut out;
  out.position = float4(in.pos.x * scale.x - 1.0, 1.0 - in.pos.y * scale.y, 0.0, 1.0);
  out.uv = in.uv;
  out.color = in.color;
  return out;
}

fragment float4 pocket_fragment(VOut in [[stage_in]], texture2d<float> tex [[texture(0)]],
                                sampler smp [[sampler(0)]]) {
  return in.color * tex.sample(smp, in.uv);
}
