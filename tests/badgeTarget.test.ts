import { describe, expect, it } from 'vitest';
import { BADGE_TARGETS, parseBadgeTarget } from '../src/shared/badgeTarget';

describe('BADGE_TARGETS', () => {
  it('lists Riskiest first, then the provider+window pairs in order', () => {
    expect(BADGE_TARGETS.map((t) => t.id)).toEqual([
      'riskiest',
      'claude:five_hour',
      'claude:seven_day',
      'chatgpt:riskiest'
    ]);
  });

  it('offers one provider-level OpenAI target instead of fixed window assumptions', () => {
    const riskiest = BADGE_TARGETS.find((t) => t.id === 'riskiest')!;
    expect(riskiest.provider).toBeUndefined();
    expect(riskiest.window).toBeUndefined();

    const openai = BADGE_TARGETS.find((t) => t.id === 'chatgpt:riskiest')!;
    expect(openai.label).toBe('OpenAI · Riskiest');
    expect(openai.provider).toBe('chatgpt');
    expect(openai.window).toBeUndefined();
  });

  it('does not offer Gemini (status-only, no number)', () => {
    expect(BADGE_TARGETS.some((t) => t.provider === 'gemini')).toBe(false);
  });
});

describe('parseBadgeTarget', () => {
  it('parses a known id into its target', () => {
    expect(parseBadgeTarget('claude:five_hour')).toMatchObject({
      id: 'claude:five_hour',
      provider: 'claude',
      window: 'five_hour'
    });
  });

  it('migrates removed fixed OpenAI targets to the provider-level target', () => {
    expect(parseBadgeTarget('chatgpt:five_hour').id).toBe('chatgpt:riskiest');
    expect(parseBadgeTarget('chatgpt:seven_day').id).toBe('chatgpt:riskiest');
    expect(parseBadgeTarget('chatgpt:custom').id).toBe('chatgpt:riskiest');
  });

  it('falls back to riskiest for an unknown or removed id', () => {
    expect(parseBadgeTarget('nope:whatever').id).toBe('riskiest');
    expect(parseBadgeTarget('').id).toBe('riskiest');
  });
});
