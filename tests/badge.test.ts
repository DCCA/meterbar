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

  it('pins the number to a chosen provider + window even when it is not the riskiest', () => {
    const snapshots = [
      snapshot('chatgpt', 95, 'five_hour'),
      snapshot('claude', 60, 'five_hour'),
      snapshot('claude', 30, 'seven_day')
    ];
    expect(calculateBadgeState(snapshots, 'claude:five_hour')).toEqual({
      text: '60',
      color: '#22c55e',
      provider: 'claude',
      usedPercent: 60
    });
  });

  it('pins OpenAI to its riskiest server-reported window without assuming a duration', () => {
    const snapshots = [
      snapshot('chatgpt', 40, 'seven_day'),
      snapshot('chatgpt', 88, 'rolling', { windowSeconds: 10800 }),
      snapshot('claude', 95, 'five_hour')
    ];
    expect(calculateBadgeState(snapshots, 'chatgpt:riskiest')).toMatchObject({
      text: '88', color: '#f59e0b', provider: 'chatgpt'
    });
  });

  it('shows ? when the pinned target has no snapshot', () => {
    expect(calculateBadgeState([snapshot('chatgpt', 95)], 'claude:five_hour')).toEqual({
      text: '?',
      color: '#6b7280'
    });
  });

  it('shows ? when the pinned target exists only as a stale snapshot', () => {
    const stale = snapshot('claude', 80, 'five_hour', { stale: true });
    expect(calculateBadgeState([stale], 'claude:five_hour')).toEqual({ text: '?', color: '#6b7280' });
  });
});
