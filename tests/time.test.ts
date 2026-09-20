import { describe, expect, it } from 'vitest';
import { formatCountdown, isStale } from '../src/shared/time';

describe('time helpers', () => {
  it('formats countdowns in hours and minutes', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const reset = new Date('2026-06-20T14:15:00Z');
    expect(formatCountdown(reset.toISOString(), now)).toBe('2h 15m');
    expect(formatCountdown(new Date(now.getTime() + 61 * 60 * 60 * 1000 + 59 * 60 * 1000).toISOString(), now)).toBe('2d 13h');
  });

  it('marks snapshots stale after the max age', () => {
    const now = new Date('2026-06-20T12:10:01Z');
    expect(isStale('2026-06-20T12:00:00Z', now, 10 * 60 * 1000)).toBe(true);
  });
});
