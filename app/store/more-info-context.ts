/**
 * Module-level context for the "more-info" dialog.
 * Call provideMoreInfo() in the root component (app.tsx) and
 * useMoreInfo() in any descendant that needs to open the dialog.
 *
 * Uses a module-level handler instead of Vue provide/inject so it works
 * reliably across PocketJS functional components.
 */

export type ShowMoreInfo = (entityId: string) => void;

let _handler: ShowMoreInfo = () => {};

/**
 * Register the handler that opens the more-info sheet.
 * Called once from app.tsx during setup.
 */
export function provideMoreInfo(fn: ShowMoreInfo): void {
  _handler = fn;
  (globalThis as any).__showMoreInfo = fn;
}

/**
 * Returns the showMoreInfo function.
 * Called from any component that needs to open the dialog.
 */
export function useMoreInfo(): ShowMoreInfo {
  return (entityId: string) => _handler(entityId);
}
