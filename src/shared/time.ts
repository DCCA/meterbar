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

export function isStale(capturedAtIso: string, now: Date = new Date(), maxAgeMs = 10 * 60 * 1000): boolean {
  return now.getTime() - new Date(capturedAtIso).getTime() > maxAgeMs;
}
