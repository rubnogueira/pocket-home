//! pocket-home-wasm: the framework's browser wasm core, verbatim, plus GPU read-back exports.
//!
//! Every `ui_*` export (and the software rasterizer behind `ui_render*`) comes from the
//! installed `@pocketjs/framework` `engine/wasm/src/lib.rs`, included below. The `gpu_*`
//! exports expose what a GPU DrawList backend needs (the same inputs
//! `pocket-ui-wgpu` reads from `Ui`): the DrawList words, font atlases and textures.
//! hosts/web/gpu.js draws them with WebGL2, which keeps full-resolution frames inside a
//! 120 Hz budget where the per-pixel CPU rasterizer could not (~7 ms at 1800x1400).
//!
//! ABI: plain numbers + linear memory, like upstream. Pointers returned here stay valid
//! until the next `gpu_*` call of the same family or `ui_init`.

#![allow(static_mut_refs)]
#![allow(clippy::not_unsafe_ptr_arg_deref)]

include!(concat!(env!("OUT_DIR"), "/upstream_wasm.rs"));

use pocketjs_core::spec::psm;

/// Scratch for the most recent `gpu_*_meta` / `gpu_font_pack` call (see each export).
static mut GPU_INFO: [u32; 8] = [0; 8];
/// Pixel staging for `gpu_font_pack` / `gpu_texture_pack`.
static mut GPU_STAGING: Vec<u8> = Vec::new();
static mut GPU_DRAW_LEN: u32 = 0;
static mut GPU_DRAW_HASH: u64 = 0;
static mut GPU_DRAW_CHANGED: u32 = 1;

/// Metadata / scratch words from the last meta or pack call.
#[no_mangle]
pub extern "C" fn gpu_info() -> *const u32 {
    unsafe { GPU_INFO.as_ptr() }
}

// ---- DrawList ------------------------------------------------------------------------------

/// Build this frame's DrawList once and return its words (`gpu_draw_len` of them). Also
/// records whether it differs from the previous `gpu_draw` (`gpu_draw_changed`), so an idle
/// frame costs one draw walk and no GPU work.
#[no_mangle]
pub extern "C" fn gpu_draw() -> *const u32 {
    let words = &ui().draw().words;
    let hash = draw_hash(words);
    unsafe {
        GPU_DRAW_CHANGED = (hash != GPU_DRAW_HASH) as u32;
        GPU_DRAW_HASH = hash;
        GPU_DRAW_LEN = words.len() as u32;
    }
    words.as_ptr()
}

#[no_mangle]
pub extern "C" fn gpu_draw_len() -> u32 {
    unsafe { GPU_DRAW_LEN }
}

#[no_mangle]
pub extern "C" fn gpu_draw_changed() -> u32 {
    unsafe { GPU_DRAW_CHANGED }
}

/// Opt in to sub-pixel translates: fractional translates are emitted as OFFSET/OFFSET_POP
/// scopes (spec draw_op, patched core) that gpu.js applies at device-pixel precision, instead of
/// whole-px geometry only. The software rasterizer skips them, so it is safe to leave on.
#[no_mangle]
pub extern "C" fn gpu_set_subpixel(on: u32) {
    pocketjs_core::draw::set_subpixel_translate(on != 0);
}

/// Force the next `gpu_draw` to report a change (after the GL context lost its contents).
#[no_mangle]
pub extern "C" fn gpu_draw_invalidate() {
    unsafe {
        GPU_DRAW_HASH = 0;
    }
}

/// Fingerprint of every font atlas and texture slot (presence, handle, revision). gpu.js skips
/// its per-slot resource sync (hundreds of `gpu_*_meta` calls and typed-array views per frame)
/// while this is unchanged.
#[no_mangle]
pub extern "C" fn gpu_resources_version() -> u32 {
    let ui = ui();
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let mut mix = |v: u64| {
        h ^= v;
        h = h.wrapping_mul(0x0100_0000_01b3);
    };
    for slot in 0..=u8::MAX {
        if ui.font_atlas(slot).is_some() {
            mix(slot as u64 | (ui.font_atlas_revision(slot) as u64) << 8);
        }
    }
    let slots = ui.texture_slot_count();
    mix(slots as u64);
    for slot in 0..slots as u32 {
        match ui.texture_at_versioned(slot) {
            Some((handle, revision, _)) => {
                mix(handle as u32 as u64);
                mix(revision as u64);
            }
            None => mix(u64::MAX),
        }
    }
    (h ^ (h >> 32)) as u32
}

// ---- font atlases --------------------------------------------------------------------------

/// Low 32 bits of the slot's atlas revision + 1; 0 = no atlas in the slot.
#[no_mangle]
pub extern "C" fn gpu_font_revision(slot: u32) -> u32 {
    let ui = ui();
    if slot > u8::MAX as u32 || ui.font_atlas(slot as u8).is_none() {
        return 0;
    }
    (ui.font_atlas_revision(slot as u8) as u32).wrapping_add(1).max(1)
}

/// Pack the slot's glyph coverage into one R8 grid texture (same layout as pocket-ui-wgpu:
/// 16 columns, 64 for large atlases). Returns the pixels (tex_w*tex_h bytes) or null, and
/// fills gpu_info with [tex_w, tex_h, cov_w, cov_h, cell_w, cell_h, cols, glyph_count].
#[no_mangle]
pub extern "C" fn gpu_font_pack(slot: u32) -> *const u8 {
    let ui = ui();
    if slot > u8::MAX as u32 {
        return core::ptr::null();
    }
    let Some(atlas) = ui.font_atlas(slot as u8) else {
        return core::ptr::null();
    };
    let (cov_w, cov_h) = (atlas.coverage_width(), atlas.coverage_height());
    let count = atlas.glyph_count as u32;
    let cols = (if count > 512 { 64 } else { 16 }).min(count.max(1));
    let rows = count.div_ceil(cols).max(1);
    let (tex_w, tex_h) = (cols * cov_w, rows * cov_h);
    unsafe {
        GPU_STAGING.clear();
        GPU_STAGING.resize((tex_w * tex_h) as usize, 0);
        let bpr = atlas.bytes_per_row();
        for gid in 0..atlas.glyph_count {
            let gx = (gid as u32 % cols) * cov_w;
            let gy = (gid as u32 / cols) * cov_h;
            let rows_bytes = atlas.glyph_rows(gid);
            for y in 0..cov_h {
                let src = &rows_bytes[y as usize * bpr..][..cov_w as usize];
                let dst = ((gy + y) * tex_w + gx) as usize;
                GPU_STAGING[dst..dst + cov_w as usize].copy_from_slice(src);
            }
        }
        GPU_INFO = [tex_w, tex_h, cov_w, cov_h, atlas.cell_w, atlas.cell_h, cols, count];
        GPU_STAGING.as_ptr()
    }
}

// ---- textures ------------------------------------------------------------------------------

#[no_mangle]
pub extern "C" fn gpu_texture_slot_count() -> u32 {
    ui().texture_slot_count() as u32
}

/// Cheap per-frame probe: 1 when the slot holds a texture, filling gpu_info with
/// [handle, revision_lo, revision_hi, w, h, linear]; 0 for a free slot.
#[no_mangle]
pub extern "C" fn gpu_texture_meta(slot: u32) -> u32 {
    let Some((handle, revision, view)) = ui().texture_at_versioned(slot) else {
        return 0;
    };
    unsafe {
        GPU_INFO = [
            handle as u32,
            revision as u32,
            (revision >> 32) as u32,
            view.w,
            view.h,
            view.linear as u32,
            0,
            0,
        ];
    }
    1
}

/// The slot's pixels expanded to tightly packed RGBA8 (w*h*4 bytes), or null.
#[no_mangle]
pub extern "C" fn gpu_texture_pack(slot: u32) -> *const u8 {
    let Some((_, _, view)) = ui().texture_at_versioned(slot) else {
        return core::ptr::null();
    };
    let count = (view.w * view.h) as usize;
    let px = view.pixels;
    unsafe {
        GPU_STAGING.clear();
        GPU_STAGING.reserve(count * 4);
        match view.psm {
            psm::PSM_8888 if px.len() >= count * 4 => GPU_STAGING.extend_from_slice(&px[..count * 4]),
            psm::PSM_5650 if px.len() >= count * 2 => {
                for c in px[..count * 2].chunks_exact(2) {
                    let v = u16::from_le_bytes([c[0], c[1]]) as u32;
                    let (r, g, b) = (v & 0x1f, (v >> 5) & 0x3f, (v >> 11) & 0x1f);
                    GPU_STAGING.extend_from_slice(&[
                        ((r << 3) | (r >> 2)) as u8,
                        ((g << 2) | (g >> 4)) as u8,
                        ((b << 3) | (b >> 2)) as u8,
                        255,
                    ]);
                }
            }
            psm::PSM_4444 if px.len() >= count * 2 => {
                for c in px[..count * 2].chunks_exact(2) {
                    let v = u16::from_le_bytes([c[0], c[1]]) as u32;
                    GPU_STAGING.extend_from_slice(&[
                        ((v & 0xf) * 17) as u8,
                        (((v >> 4) & 0xf) * 17) as u8,
                        (((v >> 8) & 0xf) * 17) as u8,
                        (((v >> 12) & 0xf) * 17) as u8,
                    ]);
                }
            }
            psm::PSM_T8 => {
                let Some(palette) = view.palette else {
                    return core::ptr::null();
                };
                if palette.len() < 1024 || px.len() < count {
                    return core::ptr::null();
                }
                for &i in &px[..count] {
                    let p = i as usize * 4;
                    GPU_STAGING.extend_from_slice(&palette[p..p + 4]);
                }
            }
            _ => return core::ptr::null(),
        }
        GPU_STAGING.as_ptr()
    }
}
