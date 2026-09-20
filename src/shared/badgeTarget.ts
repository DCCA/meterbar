import type { ProviderId } from './types';

// Which value the toolbar number shows. 'riskiest' = auto (highest fresh percent across
// providers); a provider id = that provider's riskiest fresh window. Windows are not
// pinnable: providers change them (OpenAI dropped its 5h window on 2026-07-12).
export type BadgeTargetId = 'riskiest' | 'claude' | 'chatgpt';

export interface BadgeTarget {
  id: BadgeTargetId;
  label: string;
  providers?: ProviderId[];
}

// Single source of truth for the options control AND the background lookup, so they
// cannot drift. Gemini is omitted - it is status-only and has no numeric usage.
export const BADGE_TARGETS: BadgeTarget[] = [
  { id: 'riskiest', label: 'Auto' },
  { id: 'claude', label: 'Claude', providers: ['claude'] },
  { id: 'chatgpt', label: 'OpenAI', providers: ['chatgpt'] }
];

const RISKIEST = BADGE_TARGETS[0];

/**
 * Resolve a stored id to a target. Legacy `provider:window` ids (pre-2026-08) and the
 * retired separate `codex` id migrate to OpenAI; unknown ids fall back to 'riskiest'.
 */
export function parseBadgeTarget(id: string): BadgeTarget {
  const storedProvider = id.split(':')[0];
  const key = storedProvider === 'codex' ? 'chatgpt' : storedProvider;
  return BADGE_TARGETS.find((target) => target.id === key) ?? RISKIEST;
}
