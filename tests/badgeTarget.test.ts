import { describe, expect, it } from 'vitest';
import { BADGE_TARGETS, parseBadgeTarget } from '../src/shared/badgeTarget';

describe('BADGE_TARGETS', () => {
  it('lists Riskiest first, then the provider+window pairs in order', () => {
    expect(BADGE_TARGETS.map((t) => t.id)).toEqual([
      'riskiest',
      'claude:five_hour',
      'claude:seven_day',
      'chatgpt:five_hour',
      'chatgpt:seven_day',
      'chatgpt:custom'
    ]);
  });

  it('labels the Codex (custom) target clearly and omits provider/window for riskiest', () => {
    const riskiest = BADGE_TARGETS.find((t) => t.id === 'riskiest')!;
    expect(riskiest.provider).toBeUndefined();
    expect(riskiest.window).toBeUndefined();

    const codex = BADGE_TARGETS.find((t) => t.id === 'chatgpt:custom')!;
    expect(codex.label).toBe('ChatGPT · Codex');
    expect(codex.provider).toBe('chatgpt');
    expect(codex.window).toBe('custom');
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

  it('falls back to riskiest for an unknown or removed id', () => {
    expect(parseBadgeTarget('nope:whatever').id).toBe('riskiest');
    expect(parseBadgeTarget('').id).toBe('riskiest');
  });
});
