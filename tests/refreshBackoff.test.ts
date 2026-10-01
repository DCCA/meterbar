import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshProvider } from '../src/background/refresh';
import { DEFAULT_SETTINGS } from '../src/storage/usageStore';

const ALLOWED = { ...DEFAULT_SETTINGS, acknowledged: { claude: '2026-09-30T00:00:00.000Z', chatgpt: '2026-09-30T00:00:00.000Z' } };
const refreshClaude = () => refreshProvider('claude', 'manual', ALLOWED);
const refreshChatgpt = () => refreshProvider('chatgpt', 'manual', ALLOWED);

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

    expect(store['refreshState:claude']).toMatchObject({ backoffUntil: '2026-09-30T12:10:00.000Z' });
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

    expect(store['refreshState:chatgpt']).toMatchObject({ backoffUntil: '2026-09-30T12:30:00.000Z' });
    expect(store['latest:chatgpt']).toMatchObject({
      status: 'stale',
      message: expect.stringMatching(/^OpenAI asked MeterBar to wait - next try at /)
    });
  });

  it('does not back off on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await refreshClaude();
    expect(store['refreshState:claude']).not.toHaveProperty('backoffUntil');
  });
});

describe('refreshProvider gate', () => {
  it('makes zero requests for a provider the user has not acknowledged', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await refreshProvider('claude', 'manual', DEFAULT_SETTINGS);
    await refreshProvider('chatgpt', 'settings', DEFAULT_SETTINGS);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store).toEqual({});
  });

  it('records each attempt and throttles automatic triggers for 5 minutes', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshProvider('claude', 'surface-open', ALLOWED);
    expect(store['refreshState:claude']).toEqual({ lastAttemptAt: NOW.toISOString() });
    const calls = fetchMock.mock.calls.length;

    vi.setSystemTime(new Date(NOW.getTime() + 4 * 60_000));
    await refreshProvider('claude', 'provider-tab', ALLOWED);
    expect(fetchMock).toHaveBeenCalledTimes(calls);

    await refreshProvider('claude', 'manual', ALLOWED);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
  });
});
