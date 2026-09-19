import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshChatgpt } from '../src/background/refresh';
import type { ProviderCardState } from '../src/shared/types';

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
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ cache: 'no-store' });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('clears old usage when the browser session is signed out', async () => {
    const previous: ProviderCardState = {
      provider: 'chatgpt',
      label: 'ChatGPT / Codex',
      status: 'connected',
      lastUpdatedAt: '2026-09-19T18:00:00.000Z',
      snapshots: [{
        provider: 'chatgpt', window: 'seven_day', usedRatio: 0.5, usedPercent: 50,
        capturedAt: '2026-09-19T18:00:00.000Z', source: 'test', confidence: 'exact', stale: false
      }]
    };
    const set = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      storage: { local: {
        get: vi.fn(async (key: string) => ({ [key]: previous })),
        set
      } }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await refreshChatgpt();

    expect(set).toHaveBeenCalledWith({
      'latest:chatgpt': expect.objectContaining({ status: 'not_connected', snapshots: [] })
    });
  });

  it('keeps a failed refresh last-good reading but marks it stale immediately', async () => {
    const previous: ProviderCardState = {
      provider: 'chatgpt',
      label: 'ChatGPT / Codex',
      status: 'connected',
      lastUpdatedAt: '2026-09-19T18:00:00.000Z',
      snapshots: [{
        provider: 'chatgpt', window: 'seven_day', usedRatio: 0.5, usedPercent: 50,
        capturedAt: '2026-09-19T18:00:00.000Z', source: 'test', confidence: 'exact', stale: false
      }]
    };
    const set = vi.fn(async () => undefined);
    vi.stubGlobal('chrome', {
      storage: { local: {
        get: vi.fn(async (key: string) => ({ [key]: previous })),
        set
      } }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await refreshChatgpt();

    expect(set).toHaveBeenCalledWith({
      'latest:chatgpt': expect.objectContaining({
        status: 'stale',
        snapshots: [expect.objectContaining({ usedPercent: 50, stale: true })]
      })
    });
  });
});
