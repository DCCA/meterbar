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

  it('marks retained last-good data stale immediately after a failed refresh', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const failed = { ...card('claude', 50, '2026-06-20T12:00:00Z'), status: 'stale' as const };
    const [result] = aggregateCards([failed], DEFAULT_SETTINGS, now);

    expect(result.status).toBe('stale');
    expect(result.snapshots[0].stale).toBe(true);
  });

  it('gates an enabled, unacknowledged fetch provider even before it has a card', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const cards = aggregateCards([], { ...DEFAULT_SETTINGS, acknowledged: { chatgpt: '2026-06-20T11:00:00Z' } }, now);
    expect(cards).toEqual([expect.objectContaining({
      provider: 'claude', label: 'Claude', status: 'not_connected', snapshots: [], needsAcknowledgement: true
    })]);
  });

  it('keeps last readings of an unacknowledged provider visible, flagged, and aging normally', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const [c] = aggregateCards([card('claude', 50, '2026-06-20T12:00:00Z')], { ...DEFAULT_SETTINGS, chatgptEnabled: false }, now);
    expect(c).toMatchObject({ status: 'connected', needsAcknowledgement: true, snapshots: [expect.objectContaining({ usedPercent: 50 })] });
  });

  it('does not gate acknowledged, disabled, or status-only providers', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const settings = { ...DEFAULT_SETTINGS, chatgptEnabled: false, acknowledged: { claude: '2026-06-20T11:00:00Z' } };
    expect(aggregateCards([], settings, now)).toEqual([]);
  });

  it('drops providers disabled in settings', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const cards = aggregateCards([card('gemini', 20, '2026-06-20T12:00:00Z')], { ...DEFAULT_SETTINGS, geminiEnabled: false, claudeEnabled: false, chatgptEnabled: false }, now);
    expect(cards).toHaveLength(0);
  });
});
