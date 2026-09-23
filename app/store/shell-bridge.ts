/**
 * Guest side of the iOS shell protocol (hosts/ios/app/src/ios-pocket-host.ts).
 *
 * pocket-apple cannot resize a live surface, so the iOS shell boots a fresh guest for every new
 * device size (rotation, Stage Manager). To keep the user where they were, the guest publishes
 * a small UI state over the service channel and the shell replays it into the replacement:
 *
 *   guest -> shell  svcSend  {"t":"pocket-home/state","state":ShellState}
 *   shell -> guest  post     {"t":"pocket-home/restore","state":ShellState}
 *
 * Hosts without the svc ops (web) make every call here a no-op.
 */
import { getOps } from "@pocketjs/framework";

export interface ShellState {
  /** Lovelace view path (stable across dashboards reloading), falling back to index. */
  readonly viewPath?: string;
  readonly viewIndex?: number;
  /** Scroll position as a fraction of the scroll range (layouts differ between sizes). */
  readonly scrollFraction?: number;
}

const GUEST_STATE = "pocket-home/state";
const SHELL_RESTORE = "pocket-home/restore";
const NAMESPACE = "pocket-home";

interface SvcOps {
  svcOpen?(name: string): boolean;
  svcPoll?(): string | null | undefined;
  svcSend?(line: string): void;
}

let channel: boolean | undefined;

function ops(): SvcOps | null {
  if (channel === undefined) {
    const o = getOps() as SvcOps;
    channel = typeof o.svcSend === "function" && typeof o.svcPoll === "function";
    if (channel) o.svcOpen?.(NAMESPACE);
  }
  return channel ? (getOps() as SvcOps) : null;
}

let lastSent = "";

/** Publish the UI state; unchanged states are not re-sent. */
export function publishShellState(state: ShellState): void {
  const o = ops();
  if (!o) return;
  const line = JSON.stringify({ t: GUEST_STATE, state });
  if (line === lastSent) return;
  lastSent = line;
  o.svcSend!(line);
}

/** Drain shell messages; returns the newest restore request, if any. */
export function pollShellRestore(): ShellState | null {
  const o = ops();
  if (!o) return null;
  const batch = o.svcPoll!();
  if (!batch) return null;
  let restore: ShellState | null = null;
  for (const line of batch.split("\n")) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line) as { t?: string; state?: ShellState };
      if (message.t === SHELL_RESTORE && message.state && typeof message.state === "object") {
        restore = message.state;
      }
    } catch {
      // A malformed line must not break the frame.
    }
  }
  return restore;
}
