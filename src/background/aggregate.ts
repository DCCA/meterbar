import type { FetchProviderId, ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { isStale } from '../shared/time';
import type { Settings } from '../storage/usageStore';
import { safeProviderStatus } from '../shared/messages';

const ENABLED: Record<ProviderId, 'claudeEnabled' | 'chatgptEnabled' | 'geminiEnabled' | null> = {
  claude: 'claudeEnabled', chatgpt: 'chatgptEnabled', gemini: 'geminiEnabled', unknown: null
};

const FETCH_LABELS: Record<FetchProviderId, string> = { claude: 'Claude', chatgpt: 'OpenAI' };
export const NEEDS_OK = 'Needs your OK before MeterBar reads your usage.';

export function aggregateCards(cards: ProviderCardState[], settings: Settings, now: Date = new Date()): ProviderCardState[] {
  return withConsentState(freshnessState(cards, settings, now), settings);
}

/**
 * Flag every enabled fetch provider the user has not acknowledged, adding a card when
 * none is stored yet. Last readings stay visible and age normally.
 */
function withConsentState(cards: ProviderCardState[], settings: Settings): ProviderCardState[] {
  const result = [...cards];
  for (const provider of Object.keys(FETCH_LABELS) as FetchProviderId[]) {
    const key = ENABLED[provider];
    if ((key && !settings[key]) || settings.acknowledged?.[provider]) continue;
    const i = result.findIndex((c) => c.provider === provider);
    const base: ProviderCardState = i >= 0
      ? result[i]
      : { provider, label: FETCH_LABELS[provider], status: 'not_connected', snapshots: [] };
    const gated: ProviderCardState = {
      ...base,
      ...(base.snapshots.length === 0 ? { status: 'not_connected' as const } : {}),
      message: NEEDS_OK,
      needsAcknowledgement: true
    };
    if (i >= 0) result[i] = gated;
    else result.push(gated);
  }
  return result;
}

function freshnessState(cards: ProviderCardState[], settings: Settings, now: Date): ProviderCardState[] {
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
