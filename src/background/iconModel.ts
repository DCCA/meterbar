import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';

export type IconLevel = 'ok' | 'warn' | 'crit';

export interface IconBar {
  provider: ProviderId;
  level: IconLevel;
  fillRatio: number;
}

// Fixed left-to-right order on the icon, so a bar's position identifies its provider.
const ORDER: ProviderId[] = ['claude', 'chatgpt', 'codex', 'gemini'];

function levelFor(percent: number): IconLevel {
  if (percent >= 90) return 'crit';
  if (percent >= 70) return 'warn';
  return 'ok';
}

function freshSnapshots(card: ProviderCardState): UsageSnapshot[] {
  return card.snapshots.filter((s) => !s.stale && s.confidence !== 'unavailable');
}

/**
 * Pure: one bar per provider that has fresh usage data, in fixed provider order. Each bar
 * uses that provider's riskiest window (highest usedPercent). No DOM / canvas / chrome.*.
 */
export function iconBars(cards: ProviderCardState[]): IconBar[] {
  const byProvider = new Map(cards.map((c) => [c.provider, c]));
  const bars: IconBar[] = [];
  for (const provider of ORDER) {
    const card = byProvider.get(provider);
    if (!card) continue;
    const fresh = freshSnapshots(card);
    if (fresh.length === 0) continue;
    const peak = fresh.reduce((max, s) => Math.max(max, s.usedPercent), 0);
    bars.push({ provider, level: levelFor(peak), fillRatio: Math.max(0, Math.min(1, peak / 100)) });
  }
  return bars;
}
