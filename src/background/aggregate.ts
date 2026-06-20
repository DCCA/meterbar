import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { isStale } from '../shared/time';
import type { Settings } from '../storage/usageStore';

const ENABLED: Record<ProviderId, keyof Settings | null> = {
  claude: 'claudeEnabled', chatgpt: 'chatgptEnabled', gemini: 'geminiEnabled', codex: 'chatgptEnabled', unknown: null
};

export function aggregateCards(cards: ProviderCardState[], settings: Settings, now: Date = new Date()): ProviderCardState[] {
  return cards
    .filter((c) => { const key = ENABLED[c.provider]; return key ? settings[key] : true; })
    .map((c) => {
      const snapshots = c.snapshots.map((s) => ({ ...s, stale: isStale(s.capturedAt, now) }));
      const anyStale = snapshots.some((s) => s.stale);
      const status: ProviderCardState['status'] = snapshots.length === 0 ? c.status : anyStale ? 'stale' : 'connected';
      return { ...c, snapshots, status };
    });
}

export function flattenSnapshots(cards: ProviderCardState[]): UsageSnapshot[] {
  return cards.flatMap((c) => c.snapshots);
}
