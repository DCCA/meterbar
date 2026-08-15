import type { ProviderId, UsageSnapshot } from '../shared/types';
import { parseBadgeTarget, type BadgeTargetId } from '../shared/badgeTarget';

export interface BadgeState {
  text: string;
  color: string;
  provider?: ProviderId;
  usedPercent?: number;
}

const UNKNOWN: BadgeState = { text: '?', color: '#6b7280' };

export function calculateBadgeState(snapshots: UsageSnapshot[], targetId: BadgeTargetId = 'riskiest'): BadgeState {
  const fresh = snapshots.filter((snapshot) => !snapshot.stale && snapshot.confidence !== 'unavailable');
  if (fresh.length === 0) return UNKNOWN;

  const target = parseBadgeTarget(targetId);
  const candidates = target.provider
    ? fresh.filter((snapshot) =>
        snapshot.provider === target.provider && (!target.window || snapshot.window === target.window))
    : fresh;
  const chosen = candidates.reduce<UsageSnapshot | undefined>(
    (max, snapshot) => !max || snapshot.usedPercent > max.usedPercent ? snapshot : max,
    undefined
  );

  if (!chosen) return UNKNOWN;

  return {
    text: String(Math.round(chosen.usedPercent)),
    color: colorForPercent(chosen.usedPercent),
    provider: chosen.provider,
    usedPercent: chosen.usedPercent
  };
}

export function colorForPercent(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#22c55e';
}
