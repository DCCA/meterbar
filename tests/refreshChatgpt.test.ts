import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshChatgpt } from '../src/background/refresh';

// refresh.ts is the one module that owns network I/O, so this is the only place the
// no-store guarantee can be asserted. chrome.* is stubbed for the storage write only.
afterEach(() => vi.unstubAllGlobals());

describe('refreshChatgpt', () => {
  it('sends every credentialed request with cache: no-store', async () => {
    const set = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      storage: { local: { get: vi.fn(async () => ({})), set } }
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accounts: { default: { account: { account_id: 'acct-123' } } }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rate_limit: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshChatgpt();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) expect(init).toMatchObject({ cache: 'no-store' });
  });
});
