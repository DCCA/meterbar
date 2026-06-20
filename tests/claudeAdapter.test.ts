import { describe, expect, it } from 'vitest';
import { parseClaudeUsageResponse } from '../src/providers/claude/claudeAdapter';

describe('parseClaudeUsageResponse', () => {
  it('normalizes Claude usage windows', () => {
    const snapshots = parseClaudeUsageResponse({
      five_hour: { utilization: 0.42, resets_at: '2026-06-20T14:00:00Z' },
      seven_day: { utilization: 0.61, resets_at: '2026-06-25T03:00:00Z' }
    }, new Date('2026-06-20T12:00:00Z'));

    expect(snapshots).toMatchObject([
      { provider: 'claude', window: 'five_hour', usedPercent: 42, confidence: 'exact' },
      { provider: 'claude', window: 'seven_day', usedPercent: 61, confidence: 'exact' }
    ]);
  });

  it('carries reset timestamps and stays not-stale at parse time', () => {
    const [first] = parseClaudeUsageResponse({
      five_hour: { utilization: 0.62, resets_at: '2026-06-20T18:30:00Z' }
    }, new Date('2026-06-20T16:16:00Z'));
    expect(first).toMatchObject({ usedPercent: 62, resetsAt: '2026-06-20T18:30:00Z', stale: false });
  });

  it('skips windows missing a numeric utilization', () => {
    expect(parseClaudeUsageResponse({ five_hour: {} })).toEqual([]);
  });
});
