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
        primary_window:   { used_percent: 4,  reset_at: 1782001249 },
        secondary_window: { used_percent: 11, reset_at: 1782588049 }
      }
    }
  ]
};

describe('parseChatgptUsage', () => {
  it('maps the whole response onto one OpenAI card: pool windows plus a named model cap', () => {
    const snaps = parseChatgptUsage(CAPTURED, NOW);
    expect(snaps).toMatchObject([
      { provider: 'chatgpt', window: 'five_hour', usedPercent: 27, usedRatio: 0.27, confidence: 'inferred', stale: false },
      { provider: 'chatgpt', window: 'seven_day', usedPercent: 39, confidence: 'inferred' },
      { provider: 'chatgpt', window: 'custom', workspaceLabel: 'GPT-5.3-Codex-Spark', usedPercent: 11 }
    ]);
    expect(snaps.every((s) => s.provider === 'chatgpt')).toBe(true);
  });

  it('converts reset_at epoch seconds to an ISO timestamp', () => {
    const [primary] = parseChatgptUsage(CAPTURED, NOW);
    expect(primary.resetsAt).toBe(new Date(1781989386 * 1000).toISOString());
  });

  it('emits one model-cap window = the riskiest additional window across entries', () => {
    const cap = parseChatgptUsage(CAPTURED, NOW).find((s) => s.window === 'custom');
    expect(cap).toMatchObject({ provider: 'chatgpt', workspaceLabel: 'GPT-5.3-Codex-Spark', usedPercent: 11 });
    expect(cap?.resetsAt).toBe(new Date(1782588049 * 1000).toISOString());
  });

  it('omits the model-cap window when there are no additional rate limits', () => {
    const snaps = parseChatgptUsage({ rate_limit: CAPTURED.rate_limit, additional_rate_limits: [] }, NOW);
    expect(snaps.some((s) => s.window === 'custom')).toBe(false);
    expect(snaps).toHaveLength(2);
  });

  // Since 2026-07-12 OpenAI dropped the 5h window: one weekly pool (Codex/Work/agents).
  it('labels windows by limit_window_seconds, not by position', () => {
    const weeklyOnly = { rate_limit: { primary_window: { used_percent: 60, limit_window_seconds: 604800, reset_at: 1787816100 }, secondary_window: null } };
    expect(parseChatgptUsage(weeklyOnly, NOW)).toMatchObject([{ window: 'seven_day', usedPercent: 60 }]);
    const odd = { rate_limit: { primary_window: { used_percent: 5, limit_window_seconds: 86400 } } };
    expect(parseChatgptUsage(odd, NOW)).toMatchObject([{ window: 'daily' }]);
  });

  it('skips windows missing a numeric used_percent', () => {
    expect(parseChatgptUsage({ rate_limit: { primary_window: {}, secondary_window: null } }, NOW)).toEqual([]);
  });
});

describe('pickChatgptAccountId', () => {
  it('prefers the account explicitly named default regardless of object order', () => {
    const body = { accounts: {
      workspace: { account: { account_id: 'acct-workspace' } },
      default: { account: { account_id: 'acct-default' } }
    } };
    expect(pickChatgptAccountId(body)).toBe('acct-default');
  });

  it('falls back to the first valid account when no default entry exists', () => {
    const body = { accounts: {
      malformed: {},
      workspace: { account: { account_id: 'acct-workspace' } }
    } };
    expect(pickChatgptAccountId(body)).toBe('acct-workspace');
  });

  it('returns null for a missing, empty, or malformed accounts map', () => {
    expect(pickChatgptAccountId(null)).toBeNull();
    expect(pickChatgptAccountId({})).toBeNull();
    expect(pickChatgptAccountId({ accounts: {} })).toBeNull();
    expect(pickChatgptAccountId({ accounts: { x: {} } })).toBeNull();
  });
});
