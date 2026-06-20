import { describe, expect, it } from 'vitest';
import { parseChatgptUsage } from '../src/providers/chatgpt/chatgptAdapter';

describe('parseChatgptUsage', () => {
  it('maps a captured usage shape to a snapshot', () => {
    const out = parseChatgptUsage({ window: 'daily', used: 30, limit: 40, resets_at: '2026-06-21T00:00:00Z' }, new Date('2026-06-20T12:00:00Z'));
    expect(out).toMatchObject([{ provider: 'chatgpt', window: 'daily', usedPercent: 75, confidence: 'estimated' }]);
  });
  it('returns nothing when limit is unknown', () => {
    expect(parseChatgptUsage({ used: 5 }, new Date())).toEqual([]);
  });
});
