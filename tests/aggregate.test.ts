import { describe, expect, it } from 'vitest';
import { aggregateCards } from '../src/background/aggregate';
import type { ProviderCardState } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/storage/usageStore';

function card(provider: ProviderCardState['provider'], pct: number, capturedAt: string): ProviderCardState {
  return {
    provider, label: provider, status: 'connected', lastUpdatedAt: capturedAt,
    snapshots: [{ provider, window: 'five_hour', usedRatio: pct / 100, usedPercent: pct, capturedAt, source: 't', confidence: 'exact', stale: false }]
  };
}

describe('aggregateCards', () => {
  it('marks snapshots stale past max age and downgrades status', () => {
    const now = new Date('2026-06-20T12:30:00Z');
    const [c] = aggregateCards([card('claude', 50, '2026-06-20T12:00:00Z')], DEFAULT_SETTINGS, now);
    expect(c.snapshots[0].stale).toBe(true);
    expect(c.status).toBe('stale');
  });

  it('drops providers disabled in settings', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const cards = aggregateCards([card('gemini', 20, '2026-06-20T12:00:00Z')], { ...DEFAULT_SETTINGS, geminiEnabled: false }, now);
    expect(cards).toHaveLength(0);
  });
});
