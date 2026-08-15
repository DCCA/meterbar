import { describe, expect, it } from 'vitest';
import { appendPoint, historyKey, pruneSeries } from '../src/storage/historyStore';

const H = 60 * 60 * 1000;

describe('history series', () => {
  it('separates new rolling durations without changing legacy custom keys', () => {
    expect(historyKey('chatgpt', 'rolling', 10800)).toBe('history:chatgpt:rolling:10800');
    expect(historyKey('chatgpt', 'rolling', 7200)).toBe('history:chatgpt:rolling:7200');
    expect(historyKey('chatgpt', 'custom', 10800)).toBe('history:chatgpt:custom');
  });

  it('appends a compact [t, p] tuple', () => {
    expect(appendPoint([], Date.parse('2026-06-20T12:00:00Z'), 62)).toEqual([
      [Date.parse('2026-06-20T12:00:00Z'), 62]
    ]);
  });

  it('keeps recent points at full resolution and downsamples older ones hourly', () => {
    const now = Date.parse('2026-06-21T12:00:00Z');
    const series: Array<[number, number]> = [];
    // two points in the same old hour (26h ago) collapse to one; recent point stays
    series.push([now - 26 * H, 10], [now - 26 * H + 5 * 60000, 20], [now - 1 * H, 80]);
    const pruned = pruneSeries(series, now, { rawWindowMs: 24 * H, maxPoints: 500 });
    expect(pruned).toEqual([
      [now - 26 * H + 5 * 60000, 20], // last value wins within the old hour bucket
      [now - 1 * H, 80]
    ]);
  });

  it('caps total points', () => {
    const now = Date.now();
    const many: Array<[number, number]> = Array.from({ length: 600 }, (_, i) => [now - i * 60000, i % 100]);
    expect(pruneSeries(many, now, { rawWindowMs: 24 * H, maxPoints: 500 }).length).toBeLessThanOrEqual(500);
  });
});
