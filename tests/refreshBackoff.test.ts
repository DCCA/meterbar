import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshChatgpt, refreshClaude } from '../src/background/refresh';

// A stateful chrome.storage.local stub, so a backoff written by one refresh is seen by the next.
let store: Record<string, unknown>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string | null) => (key === null ? { ...store } : key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, items); })
      }
    }
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const NOW = new Date('2026-09-30T12:00:00.000Z');
const rateLimited = (headers: Record<string, string> = {}) => new Response('', { status: 429, headers });

describe('429 backoff', () => {
  it('persists Retry-After, shows the timed copy, and skips every request until it passes', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const fetchMock = vi.fn().mockResolvedValue(rateLimited({ 'retry-after': '600' }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshClaude();

    expect(store['refreshState:claude']).toEqual({ backoffUntil: '2026-09-30T12:10:00.000Z' });
    expect(store['latest:claude']).toMatchObject({
      status: 'stale',
      message: expect.stringMatching(/^Claude asked MeterBar to wait - next try at .+\.$/)
    });

    fetchMock.mockClear();
    vi.setSystemTime(new Date('2026-09-30T12:09:59.000Z'));
    await refreshClaude();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.setSystemTime(new Date('2026-09-30T12:10:00.000Z'));
    await refreshClaude();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('defaults to 30 minutes without Retry-After, from any request in the OpenAI chain', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(rateLimited()));

    await refreshChatgpt();

    expect(store['refreshState:chatgpt']).toEqual({ backoffUntil: '2026-09-30T12:30:00.000Z' });
    expect(store['latest:chatgpt']).toMatchObject({
      status: 'stale',
      message: expect.stringMatching(/^OpenAI asked MeterBar to wait - next try at /)
    });
  });

  it('does not back off on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await refreshClaude();
    expect(store['refreshState:claude']).toBeUndefined();
  });
});
