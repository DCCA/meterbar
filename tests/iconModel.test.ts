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

  it('emits one bar for a single provider with data', () => {
    const bars = iconBars([card('claude', [snap({ usedPercent: 40 })])]);
    expect(bars).toEqual([{ provider: 'claude', level: 'ok', fillRatio: 0.4 }]);
  });

  it('emits one bar per provider with data, in fixed provider order', () => {
    // pass them out of order; output must be claude before chatgpt
    const bars = iconBars([
      card('chatgpt', [snap({ provider: 'chatgpt', usedPercent: 88 })]),
      card('claude', [snap({ usedPercent: 30 })])
    ]);
    expect(bars.map((b) => b.provider)).toEqual(['claude', 'chatgpt']);
  });

  it("uses a provider's riskiest window for its bar", () => {
    const bars = iconBars([
      card('claude', [snap({ window: 'seven_day', usedPercent: 35 }), snap({ window: 'five_hour', usedPercent: 82 })])
    ]);
    expect(bars).toEqual([{ provider: 'claude', level: 'warn', fillRatio: 0.82 }]);
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

  it('clamps fillRatio into [0, 1]', () => {
    const bars = iconBars([card('claude', [snap({ usedPercent: 130 })])]);
    expect(bars[0].fillRatio).toBe(1);
  });
});
