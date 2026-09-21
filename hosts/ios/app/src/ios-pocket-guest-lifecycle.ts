/** Tear down the previous guest eval before remounting (rotation / viewport change). */
export function teardownPocketGuestRuntime(): void {
  const dispose = (globalThis as { __pocketGuestDispose?: () => void }).__pocketGuestDispose;
  if (typeof dispose === "function") {
    try {
      dispose();
    } catch (error) {
      console.warn("[pocket-home] guest dispose:", error);
    }
  }
  delete (globalThis as { __pocketGuestDispose?: () => void }).__pocketGuestDispose;
  delete (globalThis as { frame?: unknown }).frame;
  delete (globalThis as { ui?: unknown }).ui;
  delete (globalThis as { __pocketResizeViewport?: unknown }).__pocketResizeViewport;
}
