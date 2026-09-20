import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { isStale } from '../shared/time';
import type { Settings } from '../storage/usageStore';
import { safeProviderStatus } from '../shared/messages';

const ENABLED: Record<ProviderId, keyof Settings | null> = {
  claude: 'claudeEnabled', chatgpt: 'chatgptEnabled', gemini: 'geminiEnabled', unknown: null
};

export function aggregateCards(cards: ProviderCardState[], settings: Settings, now: Date = new Date()): ProviderCardState[] {
  return cards
    // Cards stored by older builds under retired provider ids (e.g. a separate Codex card) are dropped.
    .filter((c) => c.provider in ENABLED)
    .filter((c) => { const key = ENABLED[c.provider]; return key ? settings[key] : true; })
    .map((c) => {
      const explicitlyStale = c.status === 'stale';
      const snapshots = c.snapshots.map((s) => ({
        ...s,
        stale: explicitlyStale || s.stale || isStale(s.capturedAt, now)
      }));
      const anyStale = snapshots.some((s) => s.stale);
      const status: ProviderCardState['status'] =
        c.status === 'not_connected' || c.status === 'unsupported'
          ? c.status
          : snapshots.length === 0
            ? safeProviderStatus(c.status)
            : anyStale
              ? 'stale'
              : 'connected';
      return { ...c, snapshots, status };
    });
}

export function flattenSnapshots(cards: ProviderCardState[]): UsageSnapshot[] {
  return cards.flatMap((c) => c.snapshots);
}
