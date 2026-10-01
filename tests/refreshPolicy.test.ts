import { describe, expect, it } from 'vitest';
import {
  mergeRefreshRequests,
  parseRetryAfter,
  providerForUrl,
  settingsRefreshRequest,
  shouldFetch,
  type RefreshReason
} from '../src/shared/refreshPolicy';

const REASONS: RefreshReason[] = ['manual', 'surface-open', 'provider-tab', 'settings', 'alarm', 'startup'];

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

describe('shouldFetch', () => {
  const open = { enabled: true, acknowledged: true };
  const t = NOW.getTime();
  const ago = (m: number) => new Date(t - m * MIN).toISOString();

  it('never fetches a disabled or unacknowledged provider, whatever the reason', () => {
    for (const reason of REASONS) {
      expect(shouldFetch({ enabled: false, acknowledged: true }, reason, t)).toBe(false);
      expect(shouldFetch({ enabled: true, acknowledged: false }, reason, t)).toBe(false);
    }
  });

  it('honors backoff for every reason, manual included', () => {
    const gate = { ...open, backoffUntil: new Date(t + MIN).toISOString() };
    for (const reason of REASONS) expect(shouldFetch(gate, reason, t)).toBe(false);
    expect(shouldFetch({ ...open, backoffUntil: new Date(t).toISOString() }, 'alarm', t)).toBe(true);
  });

  it('throttles automatic reasons to one attempt per 5 minutes; manual and settings bypass it', () => {
    const recent = { ...open, lastAttemptAt: ago(4) };
    for (const reason of ['surface-open', 'provider-tab', 'alarm', 'startup'] as const) {
      expect(shouldFetch(recent, reason, t)).toBe(false);
      expect(shouldFetch({ ...open, lastAttemptAt: ago(5) }, reason, t)).toBe(true);
    }
    expect(shouldFetch(recent, 'manual', t)).toBe(true);
    expect(shouldFetch(recent, 'settings', t)).toBe(true);
    expect(shouldFetch(open, 'startup', t)).toBe(true);
  });
});

describe('mergeRefreshRequests', () => {
  it('keeps every provider and lets an unthrottled reason win', () => {
    expect(mergeRefreshRequests({ claude: 'surface-open' }, { chatgpt: 'provider-tab' }))
      .toEqual({ claude: 'surface-open', chatgpt: 'provider-tab' });
    expect(mergeRefreshRequests({ claude: 'manual' }, { claude: 'alarm' })).toEqual({ claude: 'manual' });
    expect(mergeRefreshRequests({ claude: 'alarm' }, { claude: 'settings' })).toEqual({ claude: 'settings' });
  });
});

describe('providerForUrl', () => {
  it('maps only the two fetch-provider origins', () => {
    expect(providerForUrl('https://claude.ai/chat/abc')).toBe('claude');
    expect(providerForUrl('https://chatgpt.com/c/1')).toBe('chatgpt');
    for (const url of [undefined, '', 'not a url', 'https://gemini.google.com/', 'https://claude.ai.evil.com/', 'http://claude.ai/']) {
      expect(providerForUrl(url)).toBeUndefined();
    }
  });
});

describe('settingsRefreshRequest', () => {
  it('refreshes a provider that was just enabled or acknowledged, and nothing else', () => {
    expect(settingsRefreshRequest({ claudeEnabled: { oldValue: false, newValue: true } })).toEqual({ claude: 'settings' });
    expect(settingsRefreshRequest({ chatgptEnabled: { oldValue: true, newValue: false } })).toEqual({});
    expect(settingsRefreshRequest({ acknowledged: { oldValue: { claude: 'x' }, newValue: { claude: 'x', chatgpt: 'y' } } }))
      .toEqual({ chatgpt: 'settings' });
    expect(settingsRefreshRequest({ acknowledged: { oldValue: { claude: 'x' }, newValue: {} } })).toEqual({});
    expect(settingsRefreshRequest({ 'latest:claude': { newValue: {} } })).toEqual({});
  });
});
