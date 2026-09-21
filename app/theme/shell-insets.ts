/** Published by the NativeScript iOS shell (`__POCKET_SHELL_INSETS`). */
export function shellContentInsetTop(): number {
  const top = (globalThis as { __POCKET_SHELL_INSETS?: { top?: number } }).__POCKET_SHELL_INSETS
    ?.top;
  return typeof top === "number" && top > 0 ? Math.round(top) : 0;
}

export function shellContentInsetBottom(): number {
  const bottom = (globalThis as { __POCKET_SHELL_INSETS?: { bottom?: number } })
    .__POCKET_SHELL_INSETS?.bottom;
  return typeof bottom === "number" && bottom > 0 ? Math.round(bottom) : 0;
}
