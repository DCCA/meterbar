import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshChatgpt, refreshClaude } from '../src/background/refresh';

// The README and the demo video say tokens and account ids are used only to build requests
// to the provider's own origin and are never stored. refresh.ts is the only module that sees
// them and chrome.storage.local.set is the only way anything persists, so assert both here.
afterEach(() => vi.unstubAllGlobals());

function stubStorage() {
  const set = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', { storage: { local: { get: vi.fn(async () => ({})), set } } });
  return set;
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const headerOf = (init: RequestInit | undefined, name: string) =>
  Object.entries((init?.headers ?? {}) as Record<string, string>).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];

describe('credentials stay in requests to the provider and out of storage', () => {
  it('OpenAI: the access token and account id are used only on chatgpt.com, never stored', async () => {
    const set = stubStorage();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ accessToken: 'tok-SECRET-abc', user: { email: 'someone@example.com' } }))
      .mockResolvedValueOnce(json({ accounts: { default: { account: { account_id: 'acct-SECRET-123' } } } }))
      .mockResolvedValueOnce(json({ rate_limit: { primary_window: { used_percent: 30, limit_window_seconds: 604800 } } }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshChatgpt();

    const calls = fetchMock.mock.calls as Array<[string, RequestInit | undefined]>;
    expect(calls.every(([url]) => String(url).startsWith('https://chatgpt.com/'))).toBe(true);
    // The secrets really flowed into the requests, so "not stored" below is not vacuous.
    expect(headerOf(calls[2][1], 'authorization')).toBe('Bearer tok-SECRET-abc');
    expect(headerOf(calls[2][1], 'ChatGPT-Account-Id')).toBe('acct-SECRET-123');

    const stored = JSON.stringify(set.mock.calls);
    expect(stored).toContain('"usedPercent":30');
    expect(stored).not.toContain('tok-SECRET-abc');
    expect(stored).not.toContain('acct-SECRET-123');
    expect(stored).not.toContain('someone@example.com');
  });

  it('Claude: the organization id is used only on claude.ai, never stored', async () => {
    const set = stubStorage();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json([{ uuid: 'org-SECRET-0001', name: 'Private Org', capabilities: ['chat'] }]))
      .mockResolvedValueOnce(json({ five_hour: { utilization: 62, resets_at: '2026-06-20T18:30:00Z' } }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshClaude();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.startsWith('https://claude.ai/'))).toBe(true);
    expect(urls[1]).toContain('org-SECRET-0001');

    const stored = JSON.stringify(set.mock.calls);
    expect(stored).toContain('"usedPercent":62');
    expect(stored).not.toContain('org-SECRET-0001');
    expect(stored).not.toContain('Private Org');
  });
});
