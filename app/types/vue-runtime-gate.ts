/**
 * Typechecked on every `bun run check` — catches missing `vue` re-exports before IDE-only regressions.
 */
import { computed, onMounted, onScopeDispose, ref } from "vue";

export type VueRuntimeExports =
  | typeof ref
  | typeof computed
  | typeof onMounted
  | typeof onScopeDispose;
