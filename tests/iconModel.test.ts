import { describe, expect, it } from 'vitest';
import { iconBars } from '../src/background/iconModel';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../src/shared/types';

function snap(partial: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    provider: 'claude',
    window: 'five_hour',
    usedRatio: 0.5,
    usedPercent: 50,
    capturedAt: new Date('2026-06-20T12:00:00Z').toISOString(),
    source: 'test',
    confidence: 'exact',
    stale: false,
    ...partial
  };
}

function card(provider: ProviderId, snapshots: UsageSnapshot[], rest: Partial<ProviderCardState> = {}): ProviderCardState {
  return { provider, label: provider, status: 'connected', snapshots, ...rest };
}

describe('iconBars', () => {
  it('returns no bars when no provider has data', () => {
    expect(iconBars([])).toEqual([]);
    expect(iconBars([card('claude', []), card('gemini', [], { status: 'not_connected' })])).toEqual([]);
  });

  it('holds all three fixed slots when only one provider has data', () => {
    const bars = iconBars([card('claude', [snap({ usedPercent: 40 })])]);
    expect(bars).toEqual([
      { provider: 'claude', level: 'ok', fillRatio: 0.4 },
      { provider: 'chatgpt', level: 'ok', fillRatio: 0 },
      { provider: 'gemini', level: 'ok', fillRatio: 0 }
    ]);
  });

  it('emits every fixed slot in provider order', () => {
    // Pass live cards out of order; the three output slots remain stable.
    const bars = iconBars([
      card('chatgpt', [snap({ provider: 'chatgpt', usedPercent: 88 })]),
      card('claude', [snap({ usedPercent: 30 })])
    ]);
    expect(bars.map((b) => b.provider)).toEqual(['claude', 'chatgpt', 'gemini']);
  });

  it("uses a provider's riskiest window for its bar", () => {
    const bars = iconBars([
      card('claude', [snap({ window: 'seven_day', usedPercent: 35 }), snap({ window: 'five_hour', usedPercent: 82 })])
    ]);
    expect(bars[0]).toEqual({ provider: 'claude', level: 'warn', fillRatio: 0.82 });
  });

  it('maps levels at the badge thresholds (70 warn, 90 crit)', () => {
    const level = (pct: number) => iconBars([card('claude', [snap({ usedPercent: pct })])])[0].level;
    expect(level(69)).toBe('ok');
    expect(level(70)).toBe('warn');
    expect(level(89)).toBe('warn');
    expect(level(90)).toBe('crit');
  });

  it('excludes stale and unavailable snapshots, omitting a provider left with no data', () => {
    const bars = iconBars([
      card('claude', [snap({ usedPercent: 95, stale: true })]),
      card('chatgpt', [snap({ provider: 'chatgpt', usedPercent: 50, confidence: 'unavailable' })])
    ]);
    expect(bars).toEqual([]);
  });

  it('keeps missing and connected-without-data providers as empty tracks', () => {
    const bars = iconBars([
      card('claude', [snap({ usedPercent: 40 })]),
      card('gemini', [], { status: 'connected' })
    ]);
    expect(bars).toEqual([
      { provider: 'claude', level: 'ok', fillRatio: 0.4 },
      { provider: 'chatgpt', level: 'ok', fillRatio: 0 },
      { provider: 'gemini', level: 'ok', fillRatio: 0 }
    ]);
  });

  it('clamps fillRatio into [0, 1]', () => {
    const bars = iconBars([card('claude', [snap({ usedPercent: 130 })])]);
    expect(bars[0].fillRatio).toBe(1);
  });
});
