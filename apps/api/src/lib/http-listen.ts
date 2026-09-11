/** Bun.serve idleTimeout is seconds; default 10 closes SSE before the heartbeat. */
export const BUN_IDLE_TIMEOUT_SECONDS = 255;

/** Keep this below BUN_IDLE_TIMEOUT_SECONDS so quiet live streams are not dropped. */
export const COLLECTION_LIVE_HEARTBEAT_MS = 25_000;

export function apiListenOptions(port: number, hostname?: string) {
  if (hostname === undefined) {
    return { port, idleTimeout: BUN_IDLE_TIMEOUT_SECONDS };
  }
  return { port, hostname, idleTimeout: BUN_IDLE_TIMEOUT_SECONDS };
}
