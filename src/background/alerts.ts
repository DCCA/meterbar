import type { ProviderCardState, ProviderId, UsageSnapshot, UsageWindow } from '../shared/types';
import type { AlertState } from '../storage/usageStore';
import { loadAlertState, saveAlertState } from '../storage/usageStore';
import { alertCopy } from '../shared/summary';

/**
 * A per-model cap (window 'custom') is a different series per limit name: the riskiest cap
 * can switch models between refreshes. The name is appended only when present, so keys for
 * ordinary windows (and alert state already stored) are unchanged.
 */
function seriesKey(provider: ProviderId, window: UsageWindow, workspaceLabel?: string): string {
  return workspaceLabel ? `${provider}:${window}:${workspaceLabel}` : `${provider}:${window}`;
}

export function getAlertKey(provider: ProviderId, window: UsageWindow, threshold: number, resetsAt = 'unknown', workspaceLabel?: string): string {
  const key = `${provider}:${window}:${threshold}:${resetsAt}`;
  return workspaceLabel ? `${key}:${workspaceLabel}` : key;
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
  workspaceLabel?: string;
  threshold?: number;
  usedPercent: number;
  resetsAt?: string;
  confidence: UsageSnapshot['confidence'];
}
const THRESHOLDS = [70, 90];

export function evaluateAlerts(snapshots: UsageSnapshot[], state: AlertState): { fired: FiredAlert[]; state: AlertState } {
  const seen = new Set(state.seen);
  const lastReset = { ...state.lastReset };
  const fired: FiredAlert[] = [];

  for (const s of snapshots) {
    const resetKey = seriesKey(s.provider, s.window, s.workspaceLabel);
    if (s.resetsAt && lastReset[resetKey] && lastReset[resetKey] !== s.resetsAt) {
      fired.push({
        kind: 'reset', provider: s.provider, window: s.window, workspaceLabel: s.workspaceLabel, usedPercent: s.usedPercent,
        resetsAt: s.resetsAt, confidence: s.confidence
      });
    }
    if (s.resetsAt) lastReset[resetKey] = s.resetsAt;

    for (const threshold of THRESHOLDS) {
      if (s.usedPercent >= threshold) {
        const key = getAlertKey(s.provider, s.window, threshold, s.resetsAt ?? 'unknown', s.workspaceLabel);
        if (shouldAlert(seen, key)) {
          fired.push({
            kind: 'threshold', provider: s.provider, window: s.window, workspaceLabel: s.workspaceLabel, threshold,
            usedPercent: s.usedPercent, resetsAt: s.resetsAt, confidence: s.confidence
          });
        }
      }
    }
  }
  return { fired, state: { seen: [...seen], lastReset } };
}

export async function evaluateAndNotify(cards: ProviderCardState[]): Promise<void> {
  const labelByProvider = new Map(cards.map((c) => [c.provider, c.label]));
  const snapshots = cards.flatMap((c) => c.snapshots).filter((s) => !s.stale && s.confidence !== 'unavailable');
  const { fired, state } = evaluateAlerts(snapshots, await loadAlertState());
  await saveAlertState(state);
  for (const f of fired) {
    const { title, message } = alertCopy({
      kind: f.kind,
      label: labelByProvider.get(f.provider) ?? f.provider,
      window: f.window,
      workspaceLabel: f.workspaceLabel,
      usedPercent: f.usedPercent,
      resetsAt: f.resetsAt,
      confidence: f.confidence
    });
    chrome.notifications.create(`${f.provider}:${f.window}:${f.kind}:${f.threshold ?? 'r'}`,
      { type: 'basic', iconUrl: chrome.runtime.getURL('assets/icon128.png'), title, message });
  }
}
