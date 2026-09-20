import { describe, expect, it } from 'vitest';
import { BADGE_TARGETS, parseBadgeTarget } from '../src/shared/badgeTarget';

describe('BADGE_TARGETS', () => {
  it('offers Auto first, then one entry per provider with a number', () => {
    expect(BADGE_TARGETS.map((t) => t.id)).toEqual(['riskiest', 'claude', 'chatgpt']);
    expect(BADGE_TARGETS[0].providers).toBeUndefined();
    expect(BADGE_TARGETS[2]).toMatchObject({ label: 'OpenAI', providers: ['chatgpt'] });
  });

  it('does not offer Gemini (status-only, no number)', () => {
    expect(BADGE_TARGETS.some((t) => t.providers?.includes('gemini'))).toBe(false);
  });
});

describe('parseBadgeTarget', () => {
  it('parses a provider id into its target', () => {
    expect(parseBadgeTarget('claude')).toMatchObject({ id: 'claude', providers: ['claude'] });
  });

  it('migrates legacy provider:window ids to the provider', () => {
    for (const legacy of ['chatgpt:five_hour', 'chatgpt:seven_day', 'chatgpt:custom']) {
      expect(parseBadgeTarget(legacy).id).toBe('chatgpt');
    }
    expect(parseBadgeTarget('claude:seven_day').id).toBe('claude');
    expect(parseBadgeTarget('codex:custom').id).toBe('chatgpt');
  });

  it('falls back to riskiest for an unknown id', () => {
    expect(parseBadgeTarget('nope:whatever').id).toBe('riskiest');
    expect(parseBadgeTarget('gemini').id).toBe('riskiest');
  });
});
