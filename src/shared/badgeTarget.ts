import type { ProviderId, UsageWindow } from './types';

// Which value the toolbar number shows. 'riskiest' = highest fresh percentage;
// targets can pin either one provider's riskiest window or a fixed provider/window pair.
export type BadgeTargetId = 'riskiest' | 'chatgpt:riskiest' | `${ProviderId}:${UsageWindow}`;

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
  { id: 'chatgpt:riskiest', label: 'OpenAI · Riskiest', provider: 'chatgpt' }
];

const RISKIEST = BADGE_TARGETS[0];
const OPENAI_RISKIEST = BADGE_TARGETS[3];
const LEGACY_OPENAI_TARGETS = new Set(['chatgpt:five_hour', 'chatgpt:seven_day', 'chatgpt:custom']);

/** Resolve a stored id, migrating fixed OpenAI windows to the provider-level target. */
export function parseBadgeTarget(id: string): BadgeTarget {
  if (LEGACY_OPENAI_TARGETS.has(id)) return OPENAI_RISKIEST;
  return BADGE_TARGETS.find((t) => t.id === id) ?? RISKIEST;
}
