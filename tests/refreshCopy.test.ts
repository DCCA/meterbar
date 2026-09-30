import { describe, expect, it } from 'vitest';
import { fetchFailureMessage, rateLimitMessage } from '../src/background/refresh';

describe('fetchFailureMessage', () => {
  it('never surfaces a raw HTTP code as the whole message', () => {
    for (const status of [400, 429, 500, 503]) {
      expect(fetchFailureMessage('Claude', status)).not.toMatch(/^HTTP/);
    }
  });

  it('distinguishes provider failure from an unreadable response', () => {
    expect(fetchFailureMessage('Claude', 503)).toBe("Claude didn't respond - keeping your last reading.");
    expect(fetchFailureMessage('ChatGPT / Codex', 418)).toBe(
      "Couldn't read ChatGPT / Codex usage - keeping your last reading."
    );
  });

  it('names the time a rate-limited provider will be tried again', () => {
    const retryAt = new Date(2026, 8, 30, 14, 32).getTime();
    const time = new Date(retryAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    expect(rateLimitMessage('OpenAI', retryAt)).toBe(`OpenAI asked MeterBar to wait - next try at ${time}.`);
    expect(time).toMatch(/32/);
  });

  it('covers network-level failure with no status at all', () => {
    expect(fetchFailureMessage('Claude')).toBe("Couldn't reach Claude - keeping your last reading.");
  });
});
