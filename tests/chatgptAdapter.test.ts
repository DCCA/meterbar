import { describe, expect, it } from 'vitest';
import { parseChatgptUsage } from '../src/providers/chatgpt/chatgptAdapter';

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
  it('maps the main rate_limit to five_hour + seven_day ChatGPT windows', () => {
    const snaps = parseChatgptUsage(CAPTURED, NOW);
    expect(snaps).toMatchObject([
      { provider: 'chatgpt', window: 'five_hour', usedPercent: 27, usedRatio: 0.27, confidence: 'exact', stale: false },
      { provider: 'chatgpt', window: 'seven_day', usedPercent: 39, confidence: 'exact' },
      { provider: 'chatgpt', workspaceLabel: 'Codex', usedPercent: 11 }
    ]);
  });

  it('converts reset_at epoch seconds to an ISO timestamp', () => {
    const [primary] = parseChatgptUsage(CAPTURED, NOW);
    expect(primary.resetsAt).toBe(new Date(1781989386 * 1000).toISOString());
  });

  it('emits one Codex bar = the riskiest additional window across entries', () => {
    const codex = parseChatgptUsage(CAPTURED, NOW).find((s) => s.workspaceLabel === 'Codex');
    expect(codex).toMatchObject({ window: 'seven_day', usedPercent: 11 });
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
