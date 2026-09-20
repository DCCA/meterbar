import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';

export type IconLevel = 'ok' | 'warn' | 'crit';

export interface IconBar {
  provider: ProviderId;
  level: IconLevel;
  fillRatio: number;
}

// Fixed left-to-right order on the icon, so a bar's position identifies its provider.
const ORDER: ProviderId[] = ['claude', 'chatgpt', 'gemini'];

function levelFor(percent: number): IconLevel {
  if (percent >= 90) return 'crit';
  if (percent >= 70) return 'warn';
  return 'ok';
}

function freshSnapshots(card: ProviderCardState): UsageSnapshot[] {
  return card.snapshots.filter((s) => !s.stale && s.confidence !== 'unavailable');
}

/**
 * Pure: bars in fixed provider order — position identifies the provider, so once ANY
 * provider has fresh data, all four known providers keep their slot (an empty track
 * when they have nothing fresh) instead of letting later bars shift left. Each filled bar
 * uses that provider's riskiest window. With no fresh data anywhere, no bars: the
 * static logo shows instead. No DOM / canvas / chrome.*.
 */
export function iconBars(cards: ProviderCardState[]): IconBar[] {
  const byProvider = new Map(cards.map((c) => [c.provider, c]));
  if (!cards.some((c) => freshSnapshots(c).length > 0)) return [];
  const bars: IconBar[] = [];
  for (const provider of ORDER) {
    const card = byProvider.get(provider);
    const fresh = card ? freshSnapshots(card) : [];
    const peak = fresh.reduce((max, s) => Math.max(max, s.usedPercent), 0);
    bars.push({ provider, level: levelFor(peak), fillRatio: Math.max(0, Math.min(1, peak / 100)) });
  }
  return bars;
}
