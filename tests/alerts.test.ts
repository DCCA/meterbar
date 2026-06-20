import { describe, expect, it } from 'vitest';
import { getAlertKey, shouldAlert } from '../src/background/alerts';

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
