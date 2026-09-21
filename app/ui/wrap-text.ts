/**
 * Greedy word wrap via measureText (same model as apps/im/wrap.ts).
 * The core breaks lines only on explicit '\n'.
 */

import { getOps } from "@pocketjs/framework";

/** text-xs — fontSlotFor(12, false) */
export const HA_FONT_SLOT_XS = 0;
/** text-sm — fontSlotFor(14, false) */
export const HA_FONT_SLOT_SM = 1;

const widthCache: Map<string, number> = new Map();

function textWidth(text: string, slot: number): number {
  if (text === "") return 0;
  const key = `${slot}|${text}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    w = getOps().measureText(text, slot);
    widthCache.set(key, w);
  }
  return w;
}

function breakToken(token: string, slot: number, maxW: number): string[] {
  const chunks: string[] = [];
  let chunk = "";
  let chunkW = 0;
  for (const ch of token) {
    const w = textWidth(ch, slot);
    if (chunk !== "" && chunkW + w > maxW) {
      chunks.push(chunk);
      chunk = "";
      chunkW = 0;
    }
    chunk += ch;
    chunkW += w;
  }
  if (chunk !== "") chunks.push(chunk);
  return chunks;
}

/** Wrap under maxW px; preserves explicit newlines. Returns one string with '\n' breaks. */
export function wrapTextToLines(text: string, slot: number, maxW: number): string {
  if (maxW <= 0 || text === "") return text;

  const spaceW = textWidth(" ", slot);
  const lines: string[] = [];

  for (const para of text.split("\n")) {
    const words: string[] = [];
    for (const token of para.split(" ")) {
      if (token === "") continue;
      if (textWidth(token, slot) > maxW) words.push(...breakToken(token, slot, maxW));
      else words.push(token);
    }
    let line = "";
    let lineW = 0;
    for (const word of words) {
      const w = textWidth(word, slot);
      if (line === "") {
        line = word;
        lineW = w;
      } else if (lineW + spaceW + w <= maxW) {
        line = `${line} ${word}`;
        lineW += spaceW + w;
      } else {
        lines.push(line);
        line = word;
        lineW = w;
      }
    }
    lines.push(line);
  }

  return lines.join("\n");
}

/** Rough max text width for a full-width HA card body (section + card padding). */
export function haCardBodyTextMaxWidth(viewportW: number): number {
  return Math.max(80, viewportW - 48);
}
