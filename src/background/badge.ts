import type { ProviderId, UsageSnapshot } from '../shared/types';
import { parseBadgeTarget, type BadgeTargetId } from '../shared/badgeTarget';
import palette from '../ui/workbenchPalette.json';

export interface BadgeState {
  text: string;
  color: string;
  /** Set explicitly so Chrome never picks a low-contrast default on amber. */
  textColor: string;
  provider?: ProviderId;
  usedPercent?: number;
}

const TEXT_COLOR = palette.icon.track;
const UNKNOWN: BadgeState = { text: '?', color: palette.dark.muted, textColor: TEXT_COLOR };

export function calculateBadgeState(snapshots: UsageSnapshot[], targetId: BadgeTargetId = 'riskiest'): BadgeState {
  const fresh = snapshots.filter((snapshot) => !snapshot.stale && snapshot.confidence !== 'unavailable');
  if (fresh.length === 0) return UNKNOWN;

  const target = parseBadgeTarget(targetId);
  const pool = target.providers
    ? fresh.filter((snapshot) => target.providers?.includes(snapshot.provider))
    : fresh;
  if (pool.length === 0) return UNKNOWN;
  const chosen = pool.reduce((max, snapshot) => (snapshot.usedPercent > max.usedPercent ? snapshot : max));

  return {
    text: String(Math.round(chosen.usedPercent)),
    color: colorForPercent(chosen.usedPercent),
    textColor: TEXT_COLOR,
    provider: chosen.provider,
    usedPercent: chosen.usedPercent
  };
}

export function colorForPercent(percent: number): string {
  if (percent >= 90) return palette.dark.crit;
  if (percent >= 70) return palette.dark.warn;
  return palette.dark.ok;
}
