/**
 * Sections view layout — HA's default view type.
 *
 * Sections are arranged in ROWS. All sections in the same row share the same
 * height (flex-row + default align-items:stretch), matching HA's CSS grid.
 *
 * Within each section, cards are placed using CSS-grid-like auto-placement:
 *   - Fixed row height: CARD_ROW_H (66px, matching HA)
 *   - Cards span 1 or 2 rows depending on type/features
 *   - Full-width types (heading, markdown, sensor) span all columns
 *   - Auto-flow fills cells left-to-right, top-to-bottom, wrapping around
 *     multi-row cards — identical to CSS grid auto-placement.
 *
 * Heading cards are extracted from the grid and rendered as flex children
 * above the tile grid (auto-height, matching HA's visual appearance).
 */

import { computed, ref } from "vue";
import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { LovelaceViewConfig, LovelaceViewSection } from "../types/view.ts";
import type { LovelaceCardConfig, TileCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export const CARD_ROW_H = 56;
export const CARD_GAP = 8;

const FULL_WIDTH_TYPES = new Set(["heading", "markdown"]);
const MIN_CARD_W = 140;
const MIN_SECTION_COL_W = 280;
const DEFAULT_SECTION_CARDS = 4;
const MAX_SECTION_CARDS = 10;
const DEFAULT_VIEW_COLUMNS = 4;

// --- Grid auto-placement (mirrors CSS grid auto-flow) ---

interface GridPlacement {
  card: LovelaceCardConfig;
  cardIndex: number;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

function getCardColSpan(card: LovelaceCardConfig, gridCols: number): number {
  if (card.grid_options?.columns === "full") return gridCols;
  if (card.grid_options?.columns && typeof card.grid_options.columns === "number") {
    return Math.min(card.grid_options.columns as number, gridCols);
  }
  if (FULL_WIDTH_TYPES.has(card.type)) return gridCols;
  return 1;
}

function getCardRowSpan(card: LovelaceCardConfig): number {
  if (card.grid_options?.rows && card.grid_options.rows !== "auto") {
    return card.grid_options.rows as number;
  }
  if (card.type === "tile") {
    const features = (card as TileCardConfig).features ?? [];
    return features.length > 0 ? 2 : 1;
  }
  if (card.type === "sensor") return 2;
  if (card.type === "markdown") return 3;
  return 1;
}

function placeCardsInGrid(cards: LovelaceCardConfig[], gridCols: number): GridPlacement[] {
  const occupied = new Set();
  const placements: GridPlacement[] = [];

  for (let ci = 0; ci < cards.length; ci++) {
    const card = cards[ci];
    const colSpan = getCardColSpan(card, gridCols);
    const rowSpan = getCardRowSpan(card);

    let placed = false;
    for (let r = 0; !placed && r < 200; r++) {
      for (let c = 0; c <= gridCols - colSpan && !placed; c++) {
        let fits = true;
        for (let dr = 0; dr < rowSpan && fits; dr++) {
          for (let dc = 0; dc < colSpan && fits; dc++) {
            if (occupied.has(`${r + dr},${c + dc}`)) fits = false;
          }
        }
        if (fits) {
          for (let dr = 0; dr < rowSpan; dr++) {
            for (let dc = 0; dc < colSpan; dc++) {
              occupied.add(`${r + dr},${c + dc}`);
            }
          }
          placements.push({ card, cardIndex: ci, col: c, row: r, colSpan, rowSpan });
          placed = true;
        }
      }
    }
  }

  return placements;
}

/** Compute total grid height for a set of cards placed in `cols` columns. */
export function computeSectionGridHeight(cards: LovelaceCardConfig[], cols: number): number {
  const placements = placeCardsInGrid(cards, cols);
  if (placements.length === 0) return 0;
  const maxRowEnd = Math.max(...placements.map((p) => p.row + p.rowSpan));
  return maxRowEnd * CARD_ROW_H + Math.max(0, maxRowEnd - 1) * CARD_GAP;
}

// --- SectionsView ---

export interface SectionsViewProps {
  view: LovelaceViewConfig;
  entities: EntityState;
  source: DataSource;
  contentWidth: number;
  editMode: boolean;
  onSectionConfigChange: (sectionIndex: number, key: string, value: unknown) => void;
  onCardReorder: (sectionIndex: number, fromIdx: number, toIdx: number) => void;
}

export default function SectionsView(props: SectionsViewProps) {
  const layout = computed(() => {
    const cw = props.contentWidth;
    const edgePad = cw >= 1100 ? 80 : cw >= 700 ? 48 : cw >= 400 ? 24 : 12;
    const innerW = cw - edgePad * 2;
    const vertPad = cw >= 700 ? 16 : 10;
    const columnGap = cw >= 700 ? 24 : 16;
    const sectionGap = cw >= 700 ? 24 : 16;

    const viewMaxCols = props.view.max_columns ?? DEFAULT_VIEW_COLUMNS;
    const sectionCols = Math.max(
      1,
      Math.min(viewMaxCols, Math.floor((innerW + columnGap) / (MIN_SECTION_COL_W + columnGap))),
    );

    const sections = props.view.sections ?? [];
    const sectionRows: { section: LovelaceViewSection; globalIndex: number }[][] = [];
    for (let i = 0; i < sections.length; i += sectionCols) {
      const row: { section: LovelaceViewSection; globalIndex: number }[] = [];
      for (let c = 0; c < sectionCols && i + c < sections.length; c++) {
        row.push({ section: sections[i + c], globalIndex: i + c });
      }
      sectionRows.push(row);
    }

    const approxSectionW = Math.floor((innerW - (sectionCols - 1) * columnGap) / sectionCols);

    return {
      cw,
      edgePad,
      innerW,
      vertPad,
      columnGap,
      sectionGap,
      sectionCols,
      sectionRows,
      approxSectionW,
    };
  });

  return (
    <View
      class="flex-col"
      style={{
        width: layout.value.cw,
        paddingT: layout.value.vertPad,
        paddingB: layout.value.vertPad,
        gap: layout.value.sectionGap,
      }}
    >
      {layout.value.sectionRows.map((row, ri) => (
        <View
          key={`srow-${ri}`}
          class="flex-row"
          style={{
            gap: layout.value.columnGap,
            paddingL: layout.value.edgePad,
            paddingR: layout.value.edgePad,
          }}
        >
          {row.map((item) => (
            <View key={`s-${item.globalIndex}`} class="flex-1 flex-col overflow-hidden">
              <SectionBlock
                section={item.section}
                sectionIndex={item.globalIndex}
                entities={props.entities}
                source={props.source}
                approxWidth={layout.value.approxSectionW}
                editMode={props.editMode}
                onConfigChange={props.onSectionConfigChange}
                onCardReorder={props.onCardReorder}
              />
            </View>
          ))}
          {row.length < layout.value.sectionCols
            ? Array.from({ length: layout.value.sectionCols - row.length }, (_, i) => (
                <View key={`spacer-${i}`} class="flex-1" />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

// --- SectionBlock ---

interface SectionBlockProps {
  section: LovelaceViewSection;
  sectionIndex: number;
  entities: EntityState;
  source: DataSource;
  approxWidth: number;
  editMode: boolean;
  onConfigChange: (sectionIndex: number, key: string, value: unknown) => void;
  onCardReorder: (sectionIndex: number, fromIdx: number, toIdx: number) => void;
}

function SectionBlock(props: SectionBlockProps) {
  const showSettings = ref(false);
  const sectionMaxCards = computed(() => props.section.max_columns ?? DEFAULT_SECTION_CARDS);

  const actualCardCols = computed(() => {
    const w = props.approxWidth;
    const fitCols = Math.max(1, Math.floor((w + CARD_GAP) / (MIN_CARD_W + CARD_GAP)));
    return Math.min(sectionMaxCards.value, fitCols);
  });

  const allCards = computed(() => props.section.cards ?? []);

  const headingCards = computed(() => allCards.value.filter((c) => c.type === "heading"));
  const gridCards = computed(() => allCards.value.filter((c) => c.type !== "heading"));
  const gridOrigIndices = computed(() => {
    const indices: number[] = [];
    allCards.value.forEach((c, i) => {
      if (c.type !== "heading") indices.push(i);
    });
    return indices;
  });

  const gridLayout = computed(() => {
    const cards = gridCards.value;
    const cols = actualCardCols.value;
    const placements = placeCardsInGrid(cards, cols);
    const maxRowEnd =
      placements.length > 0 ? Math.max(...placements.map((p) => p.row + p.rowSpan)) : 0;
    const totalH =
      maxRowEnd > 0 ? maxRowEnd * CARD_ROW_H + Math.max(0, maxRowEnd - 1) * CARD_GAP : 0;
    const colW = Math.floor((props.approxWidth - (cols - 1) * CARD_GAP) / cols);
    return { placements, totalH, colW };
  });

  function toggleSettings() {
    showSettings.value = !showSettings.value;
  }

  function setMaxColumns(val: number) {
    const clamped = Math.max(1, Math.min(MAX_SECTION_CARDS, val));
    props.onConfigChange(props.sectionIndex, "max_columns", clamped);
  }

  function moveCard(fromIdx: number, direction: number) {
    const toIdx = fromIdx + direction;
    props.onCardReorder(props.sectionIndex, fromIdx, toIdx);
  }

  return (
    <View class="flex-col overflow-hidden" style={{ gap: CARD_GAP }}>
      {/* Section title (from section.title) */}
      {props.section.title || props.editMode ? (
        <View class="flex-row items-center py-1">
          <View class="flex-1">
            {props.section.title ? (
              <Text class="text-sm text-slate-300 font-bold" style={{ maxLines: 1 }}>
                {props.section.title}
              </Text>
            ) : props.editMode ? (
              <Text class="text-xs text-slate-500">Untitled section</Text>
            ) : null}
          </View>
          {props.editMode ? (
            <Focusable
              class="w-7 h-7 rounded-md bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
              onPress={toggleSettings}
            >
              <Text class="text-xs text-slate-300 font-bold">*</Text>
            </Focusable>
          ) : null}
        </View>
      ) : null}

      {/* Section settings (edit mode) */}
      {props.editMode && showSettings.value ? (
        <View class="flex-col gap-2 p-3 rounded-lg bg-slate-800">
          <Text class="text-xs text-slate-300 font-bold">Section settings</Text>
          <View class="flex-row items-center gap-2">
            <Text class="text-xs text-slate-400">Cards per row:</Text>
            <View class="flex-row items-center gap-1">
              <Focusable
                class="w-7 h-7 rounded-md bg-slate-600 items-center justify-center focus:bg-slate-500 active:bg-slate-400"
                onPress={() => setMaxColumns(sectionMaxCards.value - 1)}
              >
                <Text class="text-xs text-white font-bold">-</Text>
              </Focusable>
              <View class="w-8 items-center">
                <Text class="text-sm text-slate-100 font-bold">{sectionMaxCards.value}</Text>
              </View>
              <Focusable
                class="w-7 h-7 rounded-md bg-slate-600 items-center justify-center focus:bg-slate-500 active:bg-slate-400"
                onPress={() => setMaxColumns(sectionMaxCards.value + 1)}
              >
                <Text class="text-xs text-white font-bold">+</Text>
              </Focusable>
            </View>
          </View>
        </View>
      ) : null}

      {/* Heading cards (rendered above the grid, auto-height) */}
      {headingCards.value.map((card, i) => (
        <CardRenderer
          key={`h-${i}`}
          config={card}
          entities={props.entities}
          source={props.source}
        />
      ))}

      {/* Card grid — absolute-positioned cards matching HA's CSS grid */}
      {gridLayout.value.totalH > 0 ? (
        <View style={{ height: gridLayout.value.totalH }}>
          {gridLayout.value.placements.map((p, i) => {
            const x = p.col * (gridLayout.value.colW + CARD_GAP);
            const y = p.row * (CARD_ROW_H + CARD_GAP);
            const w = p.colSpan * gridLayout.value.colW + (p.colSpan - 1) * CARD_GAP;
            const h = p.rowSpan * CARD_ROW_H + (p.rowSpan - 1) * CARD_GAP;

            return (
              <View
                key={`g-${i}`}
                class="absolute overflow-hidden"
                style={{ insetL: x, insetT: y, width: w, height: h }}
              >
                {props.editMode ? (
                  <View class="flex-col flex-1">
                    <View
                      class="flex-row items-center justify-between px-1 bg-slate-700"
                      style={{ height: 18 }}
                    >
                      <Focusable
                        class="px-1 rounded-sm focus:bg-slate-500 active:bg-slate-400"
                        onPress={() => moveCard(gridOrigIndices.value[p.cardIndex], -1)}
                      >
                        <Text class="text-xs text-slate-200 font-bold">^</Text>
                      </Focusable>
                      <Text class="text-xs text-slate-500">
                        {gridOrigIndices.value[p.cardIndex] + 1}
                      </Text>
                      <Focusable
                        class="px-1 rounded-sm focus:bg-slate-500 active:bg-slate-400"
                        onPress={() => moveCard(gridOrigIndices.value[p.cardIndex], 1)}
                      >
                        <Text class="text-xs text-slate-200 font-bold">v</Text>
                      </Focusable>
                    </View>
                    <CardRenderer config={p.card} entities={props.entities} source={props.source} />
                  </View>
                ) : (
                  <CardRenderer config={p.card} entities={props.entities} source={props.source} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Add card button (edit mode) */}
      {props.editMode ? (
        <Focusable
          class="flex-row items-center justify-center py-2 rounded-lg bg-slate-800 border border-dashed border-slate-600 focus:bg-slate-700 active:bg-slate-600"
          onPress={() => {}}
        >
          <Text class="text-xs text-slate-400 font-bold">+ Add card</Text>
        </Focusable>
      ) : null}
    </View>
  );
}
