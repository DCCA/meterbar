import { describe, expect, it } from 'vitest';
import { calculateBadgeState } from '../src/background/badge';
import type { UsageSnapshot } from '../src/shared/types';

function snapshot(provider: UsageSnapshot['provider'], usedPercent: number): UsageSnapshot {
  return {
    provider,
    window: 'five_hour',
    usedRatio: usedPercent / 100,
    usedPercent,
    capturedAt: '2026-06-20T12:00:00Z',
    source: 'test',
    confidence: 'exact',
    stale: false
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
});
