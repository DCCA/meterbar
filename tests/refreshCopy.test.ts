import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardForSnapshots, fetchFailureMessage, refreshChatgpt } from '../src/background/refresh';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

describe('cardForSnapshots', () => {
  it('keeps a successful OpenAI read connected when the plan has no fixed window', () => {
    expect(cardForSnapshots('chatgpt', 'ChatGPT / Codex', [], {
      emptyStatus: 'connected',
      emptyMessage: 'OpenAI did not report a fixed usage window for this plan.'
    })).toMatchObject({
      provider: 'chatgpt',
      status: 'connected',
      message: 'OpenAI did not report a fixed usage window for this plan.',
      snapshots: []
    });
  });
});

describe('refreshChatgpt', () => {
  it('stores connected empty state after a successful response with no fixed limits', async () => {
    const set = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn(async () => ({})), set } }
    });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accounts: { default: { account: { account_id: 'acct-123' } } }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rate_limit: null }), { status: 200 }))
    );

    await refreshChatgpt();

    expect(set).toHaveBeenCalledWith({
      'latest:chatgpt': expect.objectContaining({
        status: 'connected',
        message: 'OpenAI did not report a fixed usage window for this plan.',
        snapshots: []
      })
    });
  });
});
