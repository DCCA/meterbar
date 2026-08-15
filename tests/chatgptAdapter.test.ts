import { describe, expect, it } from 'vitest';
import { parseChatgptUsage, pickChatgptAccountId } from '../src/providers/chatgpt/chatgptAdapter';

const NOW = new Date('2026-06-20T16:16:00Z');

// Sanitized capture from a live logged-in chatgpt.com session (2026-06-20).
const CAPTURED = {
  rate_limit: {
    primary_window:   { used_percent: 27, limit_window_seconds: 18000,  reset_at: 1781989386 },
    secondary_window: { used_percent: 39, limit_window_seconds: 604800, reset_at: 1782342911 }
  },
  additional_rate_limits: [
    {
      limit_name: 'GPT-5.3-Codex-Spark',
      rate_limit: {
        primary_window:   { used_percent: 4,  limit_window_seconds: 18000, reset_at: 1782001249 },
        secondary_window: { used_percent: 11, limit_window_seconds: 604800, reset_at: 1782588049 }
      }
    }
  ]
};

describe('parseChatgptUsage', () => {
  it('derives main window types from the durations reported by OpenAI', () => {
    const snaps = parseChatgptUsage(CAPTURED, NOW);
    expect(snaps).toMatchObject([
      {
        provider: 'chatgpt', window: 'five_hour', windowSeconds: 18000,
        usedPercent: 27, usedRatio: 0.27, confidence: 'exact', stale: false
      },
      {
        provider: 'chatgpt', window: 'seven_day', windowSeconds: 604800,
        usedPercent: 39, confidence: 'exact'
      },
      {
        provider: 'chatgpt', window: 'custom', windowSeconds: 604800,
        workspaceLabel: 'Codex', usedPercent: 11
      }
    ]);
  });

  it('does not invent a 5-hour limit when OpenAI reports only a weekly primary window', () => {
    const snaps = parseChatgptUsage({
      rate_limit: {
        primary_window: { used_percent: 46, limit_window_seconds: 604800, reset_at: 1782342911 },
        secondary_window: null
      }
    }, NOW);

    expect(snaps).toMatchObject([
      { provider: 'chatgpt', window: 'seven_day', windowSeconds: 604800, usedPercent: 46 }
    ]);
    expect(snaps.some((snapshot) => snapshot.window === 'five_hour')).toBe(false);
  });

  it('keeps an unfamiliar server-reported duration as a rolling window', () => {
    const [snapshot] = parseChatgptUsage({
      rate_limit: {
        primary_window: { used_percent: 12, limit_window_seconds: 10800, reset_at: 1781989386 }
      }
    }, NOW);

    expect(snapshot).toMatchObject({ window: 'rolling', windowSeconds: 10800, usedPercent: 12 });
  });

  it('converts reset_at epoch seconds to an ISO timestamp', () => {
    const [primary] = parseChatgptUsage(CAPTURED, NOW);
    expect(primary.resetsAt).toBe(new Date(1781989386 * 1000).toISOString());
  });

  it('emits one Codex bar = the riskiest additional window across entries', () => {
    const codex = parseChatgptUsage(CAPTURED, NOW).find((s) => s.workspaceLabel === 'Codex');
    expect(codex).toMatchObject({ window: 'custom', windowSeconds: 604800, usedPercent: 11 });
    expect(codex?.resetsAt).toBe(new Date(1782588049 * 1000).toISOString());
  });

  it('omits the Codex bar when there are no additional rate limits', () => {
    const snaps = parseChatgptUsage({ rate_limit: CAPTURED.rate_limit, additional_rate_limits: [] }, NOW);
    expect(snaps.some((s) => s.workspaceLabel === 'Codex')).toBe(false);
    expect(snaps).toHaveLength(2);
  });

  it('skips windows missing a numeric used_percent', () => {
    expect(parseChatgptUsage({ rate_limit: { primary_window: {}, secondary_window: null } }, NOW)).toEqual([]);
  });
});

describe('pickChatgptAccountId', () => {
  it('returns the first account_id from the accounts map', () => {
    const body = { accounts: { default: { account: { account_id: 'acct-123' } } } };
    expect(pickChatgptAccountId(body)).toBe('acct-123');
  });

  it('returns null for a missing, empty, or malformed accounts map', () => {
    expect(pickChatgptAccountId(null)).toBeNull();
    expect(pickChatgptAccountId({})).toBeNull();
    expect(pickChatgptAccountId({ accounts: {} })).toBeNull();
    expect(pickChatgptAccountId({ accounts: { x: {} } })).toBeNull();
  });
});
