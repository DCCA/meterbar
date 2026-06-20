import type { ProviderId, UsageWindow } from './types';

// Which value the toolbar number shows. 'riskiest' = auto (highest fresh percent);
// otherwise a pinned `${provider}:${window}` pair.
export type BadgeTargetId = 'riskiest' | `${ProviderId}:${UsageWindow}`;

export interface BadgeTarget {
  id: BadgeTargetId;
  label: string;
  provider?: ProviderId;
  window?: UsageWindow;
}

// Single source of truth for the options select AND the background lookup, so they
// cannot drift. Gemini is omitted — it is status-only and has no numeric usage.
export const BADGE_TARGETS: BadgeTarget[] = [
  { id: 'riskiest', label: 'Riskiest (auto)' },
  { id: 'claude:five_hour', label: 'Claude · 5-hour', provider: 'claude', window: 'five_hour' },
  { id: 'claude:seven_day', label: 'Claude · 7-day', provider: 'claude', window: 'seven_day' },
  { id: 'chatgpt:five_hour', label: 'ChatGPT · 5-hour', provider: 'chatgpt', window: 'five_hour' },
  { id: 'chatgpt:seven_day', label: 'ChatGPT · 7-day', provider: 'chatgpt', window: 'seven_day' },
  { id: 'chatgpt:custom', label: 'ChatGPT · Codex', provider: 'chatgpt', window: 'custom' }
];

const RISKIEST = BADGE_TARGETS[0];

/** Resolve a stored id to a target; unknown/removed ids fall back to 'riskiest'. */
export function parseBadgeTarget(id: string): BadgeTarget {
  return BADGE_TARGETS.find((t) => t.id === id) ?? RISKIEST;
}
