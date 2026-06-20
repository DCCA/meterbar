import type { ProviderId, UsageSnapshot } from '../shared/types';

export interface BadgeState {
  text: string;
  color: string;
  provider?: ProviderId;
  usedPercent?: number;
}

export function calculateBadgeState(snapshots: UsageSnapshot[]): BadgeState {
  const fresh = snapshots.filter((snapshot) => !snapshot.stale && snapshot.confidence !== 'unavailable');
  if (fresh.length === 0) {
    return { text: '?', color: '#6b7280' };
  }

  const riskiest = fresh.reduce((max, snapshot) =>
    snapshot.usedPercent > max.usedPercent ? snapshot : max
  );

  return {
    text: String(Math.round(riskiest.usedPercent)),
    color: colorForPercent(riskiest.usedPercent),
    provider: riskiest.provider,
    usedPercent: riskiest.usedPercent
  };
}

export function colorForPercent(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#22c55e';
}
