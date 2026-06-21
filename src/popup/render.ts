import { formatCountdown } from '../shared/time';
import type { ProviderCardState, ProviderId, UsageSnapshot, UsageWindow } from '../shared/types';

// --- Pure rendering helpers (no DOM, no chrome.*; unit-tested in the node env) ---

/** Escape text before interpolating into innerHTML. Adapter/provider strings are data, not markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const WINDOW_LABELS: Record<UsageWindow, string> = {
  five_hour: '5-hour limit',
  seven_day: '7-day limit',
  daily: 'Daily',
  monthly: 'Monthly',
  api_billing: 'API billing',
  custom: 'Usage'
};

export function humanWindowLabel(window: UsageWindow): string {
  return WINDOW_LABELS[window] ?? 'Usage';
}

export type RiskLevel = 'ok' | 'warn' | 'crit';

/** Same thresholds as the toolbar badge: amber >= 70, red >= 90. */
export function riskLevel(percent: number): RiskLevel {
  if (percent >= 90) return 'crit';
  if (percent >= 70) return 'warn';
  return 'ok';
}

/** CSS modifier for a bar fill ('' leaves the default green so the stylesheet stays simple). */
export function riskClass(percent: number): string {
  const level = riskLevel(percent);
  return level === 'ok' ? '' : level;
}

/** Highest used percent across a card's windows, or -1 when the card has no data. */
export function riskiestPercent(card: ProviderCardState): number {
  return card.snapshots.reduce((max, s) => Math.max(max, s.usedPercent), -1);
}

export interface OrderedProvider {
  provider: ProviderId;
  label: string;
  card?: ProviderCardState;
}

/**
 * Order providers so the most relevant card leads, mirroring the badge's "riskiest wins":
 * cards with usage data first (highest percent first), then connected-but-empty cards,
 * then everything else in its declared order. Stable when nothing has data.
 */
export function orderByRisk(
  known: Array<{ provider: ProviderId; label: string }>,
  byId: Map<ProviderId, ProviderCardState>
): OrderedProvider[] {
  return known
    .map((k, index) => ({ ...k, card: byId.get(k.provider), index }))
    .map((entry) => {
      const risk = entry.card ? riskiestPercent(entry.card) : -1;
      const connected = entry.card?.status === 'connected';
      // rank: 0 = has data, 1 = connected no data, 2 = the rest
      const rank = risk >= 0 ? 0 : connected ? 1 : 2;
      return { ...entry, risk, rank };
    })
    .sort((a, b) => a.rank - b.rank || b.risk - a.risk || a.index - b.index)
    .map(({ provider, label, card }) => ({ provider, label, card }));
}

export const PROVIDER_HOMES: Partial<Record<ProviderId, string>> = {
  claude: 'https://claude.ai',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com/app'
};

/** Sign-in URL for a first-party provider, or undefined when we have no actionable home. */
export function providerHome(provider: ProviderId): string | undefined {
  return PROVIDER_HOMES[provider];
}

export function timeAgo(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function resetLabel(resetsAt: string | undefined, now: Date = new Date()): string {
  return resetsAt ? `Resets in ${formatCountdown(resetsAt, now)}` : 'Reset time unknown';
}

export const STATUS_TEXT: Record<ProviderCardState['status'], string> = {
  connected: 'Connected',
  not_connected: 'Not connected',
  stale: 'Data is stale',
  unsupported: 'Not connected yet'
};

/** A short, honest hint for cards without usage data, used as the empty-state body. */
export function emptyHint(card: ProviderCardState | undefined): string {
  if (card?.message) return card.message;
  switch (card?.status) {
    case 'not_connected':
      return 'Open the provider and sign in to read your usage.';
    case 'stale':
      return 'Last reading is out of date — reopen the provider.';
    default:
      return 'Open the provider and sign in to start tracking.';
  }
}

// Confidence is only worth surfacing when it is NOT exact (truthful uncertainty, no noise).
export function confidenceNote(snapshot: UsageSnapshot): string | undefined {
  return snapshot.confidence === 'exact' ? undefined : snapshot.confidence;
}
