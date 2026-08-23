import { describe, expect, it } from 'vitest';
import { fetchFailureMessage } from '../src/background/refresh';

describe('fetchFailureMessage', () => {
  it('never surfaces a raw HTTP code as the whole message', () => {
    for (const status of [400, 429, 500, 503]) {
      expect(fetchFailureMessage('Claude', status)).not.toMatch(/^HTTP/);
    }
  });

  it('distinguishes rate limiting from provider failure', () => {
    expect(fetchFailureMessage('Claude', 429)).toBe('Claude is rate-limiting MeterBar — retrying automatically.');
    expect(fetchFailureMessage('Claude', 503)).toBe("Claude didn't respond — keeping your last reading.");
    expect(fetchFailureMessage('ChatGPT / Codex', 418)).toBe(
      "Couldn't read ChatGPT / Codex usage — keeping your last reading."
    );
  });

  it('covers network-level failure with no status at all', () => {
    expect(fetchFailureMessage('Claude')).toBe("Couldn't reach Claude — keeping your last reading.");
  });
});
