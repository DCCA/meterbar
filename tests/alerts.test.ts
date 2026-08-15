import { describe, expect, it } from 'vitest';
import { getAlertKey, shouldAlert } from '../src/background/alerts';
import { alertCopy } from '../src/shared/summary';

describe('alerts', () => {
  it('builds stable alert keys per provider window threshold reset cycle', () => {
    expect(getAlertKey('claude', 'five_hour', 90, '2026-06-20T14:00:00Z')).toBe('claude:five_hour:90:2026-06-20T14:00:00Z');
  });

  it('alerts only once for a threshold key', () => {
    const seen = new Set<string>();
    expect(shouldAlert(seen, 'a')).toBe(true);
    expect(shouldAlert(seen, 'a')).toBe(false);
  });
});

describe('alertCopy', () => {
  const now = new Date('2026-06-20T12:00:00Z');

  it('names a server-reported OpenAI window without assuming a 5-hour limit', () => {
    const copy = alertCopy(
      {
        kind: 'threshold', label: 'ChatGPT / Codex', window: 'rolling', windowSeconds: 10800,
        usedPercent: 91, resetsAt: '2026-06-20T12:46:00Z'
      },
      now
    );
    expect(copy.title).toBe('ChatGPT / Codex: 3-hour window at 91% used');
    expect(copy.message).toBe('Resets in 46m.');
  });

  it('is honest when the reset time is unknown', () => {
    const copy = alertCopy({ kind: 'threshold', label: 'Claude', window: 'seven_day', usedPercent: 72 }, now);
    expect(copy.title).toBe('Claude: 7-day limit at 72% used');
    expect(copy.message).toBe('Reset time unknown.');
  });

  it('announces resets with the fresh usage level', () => {
    const copy = alertCopy({ kind: 'reset', label: 'Claude', window: 'five_hour', usedPercent: 3 }, now);
    expect(copy.title).toBe('Claude: 5-hour limit reset');
    expect(copy.message).toBe('Fresh window — back to 3% used.');
  });
});
