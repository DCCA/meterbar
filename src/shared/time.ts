export function formatCountdown(resetsAtIso: string, now: Date = new Date()): string {
  const target = new Date(resetsAtIso).getTime();
  const diffMs = Math.max(0, target - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  return `${hours}h ${minutes}m`;
}

export const STALE_AFTER_MS = 10 * 60 * 1000;

export function isStale(capturedAtIso: string, now: Date = new Date(), maxAgeMs = STALE_AFTER_MS): boolean {
  return now.getTime() - new Date(capturedAtIso).getTime() > maxAgeMs;
}

/** When the freshest-to-expire reading turns stale, so surfaces can repaint then without a fetch. */
export function nextStaleAt(snapshots: Array<{ capturedAt: string; stale: boolean }>): number | undefined {
  const fresh = snapshots.filter((s) => !s.stale).map((s) => Date.parse(s.capturedAt));
  return fresh.length > 0 ? Math.min(...fresh) + STALE_AFTER_MS : undefined;
}
