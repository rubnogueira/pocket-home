// Sub-pixel translates in the Pocket Home browser wasm (engine/web + the patched core's
// draw_op OFFSET): a fractional translate paints its subtree at whole px, wrapped in an
// OFFSET scope carrying the fraction, only when the host opts in.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createWasmUi } from "../node_modules/@pocketjs/framework/hosts/web/wasm-ops.js";

const WASM = join(import.meta.dir, "../hosts/web/pocketjs.wasm");
// engine/core/src/spec.rs
const ROOT_ID = 1;
const NODE_VIEW = 0;
const PROP = { width: 1, height: 2, bgColor: 64, translateY: 129 };
const OP = { RECT: 1, OFFSET: 11, OFFSET_POP: 12 };

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
const bitsToF32 = (bits: number) => ((u32[0] = bits), f32[0]);

async function scene(translateY: number, subpixel: boolean) {
  const ui = await createWasmUi(readFileSync(WASM), { width: 100, height: 100 });
  const ex = ui.exports as unknown as {
    memory: WebAssembly.Memory;
    ui_tick(): void;
    gpu_set_subpixel(on: number): void;
    gpu_draw(): number;
    gpu_draw_len(): number;
  };
  ex.gpu_set_subpixel(subpixel ? 1 : 0);
  const content = ui.ops.createNode(NODE_VIEW);
  ui.ops.setProp(content, PROP.width, 100);
  ui.ops.setProp(content, PROP.height, 60);
  ui.ops.setProp(content, PROP.translateY, translateY);
  ui.ops.insertBefore(ROOT_ID, content, 0);
  const card = ui.ops.createNode(NODE_VIEW);
  ui.ops.setProp(card, PROP.width, 40);
  ui.ops.setProp(card, PROP.height, 20);
  ui.ops.setProp(card, PROP.bgColor, 0xff336699);
  ui.ops.insertBefore(content, card, 0);
  ex.ui_tick();
  const ptr = ex.gpu_draw();
  const words = Array.from(new Uint32Array(ex.memory.buffer, ptr, ex.gpu_draw_len()));
  ex.gpu_set_subpixel(0);
  return words;
}

function rectYs(words: number[]): number[] {
  const ys: number[] = [];
  for (let i = 0; i < words.length;) {
    const op = words[i];
    if (op === OP.RECT) {
      ys.push(words[i + 1] >> 16);
      i += 4;
    } else if (op === OP.OFFSET) i += 3;
    else i += 1;
  }
  return ys;
}

describe("sub-pixel translate (web GPU backend)", () => {
  test("opted in: whole-px geometry inside an OFFSET scope with the fraction", async () => {
    const words = await scene(10.3, true);
    const at = words.indexOf(OP.OFFSET);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(bitsToF32(words[at + 1])).toBeCloseTo(0, 5);
    expect(bitsToF32(words[at + 2])).toBeCloseTo(0.3, 5);
    expect(words.lastIndexOf(OP.OFFSET_POP)).toBeGreaterThan(at);
    expect(rectYs(words)).toEqual([10]);
  });

  test("a whole-px translate needs no scope", async () => {
    const words = await scene(12, true);
    expect(words.includes(OP.OFFSET)).toBe(false);
    expect(rectYs(words)).toEqual([12]);
  });

  test("not opted in: the DrawList is unchanged (rounded geometry, no new ops)", async () => {
    const words = await scene(10.7, false);
    expect(words.includes(OP.OFFSET)).toBe(false);
    expect(rectYs(words)).toEqual([11]);
  });
});
