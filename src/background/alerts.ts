import type { ProviderCardState, ProviderId, UsageSnapshot, UsageWindow } from '../shared/types';
import type { AlertState } from '../storage/usageStore';
import { loadAlertState, saveAlertState } from '../storage/usageStore';

export function getAlertKey(provider: ProviderId, window: UsageWindow, threshold: number, resetsAt = 'unknown'): string {
  return `${provider}:${window}:${threshold}:${resetsAt}`;
}

export function shouldAlert(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

export interface FiredAlert {
  kind: 'threshold' | 'reset';
  provider: UsageSnapshot['provider'];
  window: UsageSnapshot['window'];
  threshold?: number;
  usedPercent: number;
}
const THRESHOLDS = [70, 90];

export function evaluateAlerts(snapshots: UsageSnapshot[], state: AlertState): { fired: FiredAlert[]; state: AlertState } {
  const seen = new Set(state.seen);
  const lastReset = { ...state.lastReset };
  const fired: FiredAlert[] = [];

  for (const s of snapshots) {
    const resetKey = `${s.provider}:${s.window}`;
    if (s.resetsAt && lastReset[resetKey] && lastReset[resetKey] !== s.resetsAt) {
      fired.push({ kind: 'reset', provider: s.provider, window: s.window, usedPercent: s.usedPercent });
    }
    if (s.resetsAt) lastReset[resetKey] = s.resetsAt;

    for (const threshold of THRESHOLDS) {
      if (s.usedPercent >= threshold) {
        const key = getAlertKey(s.provider, s.window, threshold, s.resetsAt ?? 'unknown');
        if (shouldAlert(seen, key)) fired.push({ kind: 'threshold', provider: s.provider, window: s.window, threshold, usedPercent: s.usedPercent });
      }
    }
  }
  return { fired, state: { seen: [...seen], lastReset } };
}

export async function evaluateAndNotify(cards: ProviderCardState[]): Promise<void> {
  const snapshots = cards.flatMap((c) => c.snapshots).filter((s) => !s.stale && s.confidence !== 'unavailable');
  const { fired, state } = evaluateAlerts(snapshots, await loadAlertState());
  await saveAlertState(state);
  for (const f of fired) {
    const title = f.kind === 'reset' ? `${f.provider} usage reset` : `${f.provider} at ${f.threshold}%`;
    const message = f.kind === 'reset'
      ? `${f.window.replace('_', ' ')} window replenished.`
      : `${f.window.replace('_', ' ')} is at ${f.usedPercent}%.`;
    chrome.notifications.create(`${f.provider}:${f.window}:${f.kind}:${f.threshold ?? 'r'}`,
      { type: 'basic', iconUrl: 'assets/icon128.png', title, message });
  }
}
