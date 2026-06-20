import type { ProviderId, UsageWindow } from '../shared/types';

export function getAlertKey(provider: ProviderId, window: UsageWindow, threshold: number, resetsAt = 'unknown'): string {
  return `${provider}:${window}:${threshold}:${resetsAt}`;
}

export function shouldAlert(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
