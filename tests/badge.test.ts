import { describe, expect, it } from 'vitest';
import { calculateBadgeState } from '../src/background/badge';
import type { UsageSnapshot, UsageWindow } from '../src/shared/types';

function snapshot(
  provider: UsageSnapshot['provider'],
  usedPercent: number,
  window: UsageWindow = 'five_hour',
  rest: Partial<UsageSnapshot> = {}
): UsageSnapshot {
  return {
    provider,
    window,
    usedRatio: usedPercent / 100,
    usedPercent,
    capturedAt: '2026-06-20T12:00:00Z',
    source: 'test',
    confidence: 'exact',
    stale: false,
    ...rest
  };
}

describe('calculateBadgeState', () => {
  it('selects highest non-stale usage percentage', () => {
    expect(calculateBadgeState([snapshot('claude', 42), snapshot('gemini', 81)])).toEqual({
      text: '81',
      color: '#f59e0b',
      provider: 'gemini',
      usedPercent: 81
    });
  });

  it('returns unknown when no fresh snapshots exist', () => {
    expect(calculateBadgeState([])).toEqual({
      text: '?',
      color: '#6b7280'
    });
  });

  it("with an explicit 'riskiest' target keeps the riskiest pick", () => {
    expect(calculateBadgeState([snapshot('claude', 42), snapshot('gemini', 81)], 'riskiest')).toMatchObject({
      text: '81',
      provider: 'gemini'
    });
  });

  it('pins the number to a provider: its riskiest fresh window, even when another provider is riskier', () => {
    const snapshots = [
      snapshot('chatgpt', 95, 'seven_day'),
      snapshot('claude', 60, 'five_hour'),
      snapshot('claude', 30, 'seven_day')
    ];
    expect(calculateBadgeState(snapshots, 'claude')).toEqual({
      text: '60',
      color: '#22c55e',
      provider: 'claude',
      usedPercent: 60
    });
  });

  it('accepts a legacy provider:window id and treats it as the provider', () => {
    const snapshots = [snapshot('chatgpt', 40, 'seven_day'), snapshot('chatgpt', 88, 'custom')];
    expect(calculateBadgeState(snapshots, 'chatgpt:five_hour' as never)).toMatchObject({ text: '88', color: '#f59e0b' });
  });

  it('shows ? when the pinned provider has no snapshot', () => {
    expect(calculateBadgeState([snapshot('chatgpt', 95)], 'claude')).toEqual({
      text: '?',
      color: '#6b7280'
    });
  });

  it('shows ? when the pinned provider exists only as a stale snapshot', () => {
    const stale = snapshot('claude', 80, 'five_hour', { stale: true });
    expect(calculateBadgeState([stale], 'claude')).toEqual({ text: '?', color: '#6b7280' });
  });
});
