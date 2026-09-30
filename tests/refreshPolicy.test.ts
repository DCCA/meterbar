import { describe, expect, it } from 'vitest';
import { parseRetryAfter } from '../src/shared/refreshPolicy';

const NOW = new Date('2026-09-30T12:00:00.000Z');
const MIN = 60_000;

describe('parseRetryAfter', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfter('600', NOW)).toBe(NOW.getTime() + 10 * MIN);
  });

  it('reads an HTTP-date', () => {
    expect(parseRetryAfter('Wed, 30 Sep 2026 13:00:00 GMT', NOW)).toBe(NOW.getTime() + 60 * MIN);
  });

  it('falls back to 30 minutes when missing or unparseable', () => {
    for (const header of [null, '', 'soon', '-5', '1.5']) {
      expect(parseRetryAfter(header, NOW)).toBe(NOW.getTime() + 30 * MIN);
    }
  });

  it('clamps to [1 min, 24 h]', () => {
    expect(parseRetryAfter('0', NOW)).toBe(NOW.getTime() + MIN);
    expect(parseRetryAfter('Wed, 30 Sep 2026 11:00:00 GMT', NOW)).toBe(NOW.getTime() + MIN);
    expect(parseRetryAfter(String(7 * 24 * 3600), NOW)).toBe(NOW.getTime() + 24 * 60 * MIN);
  });
});
