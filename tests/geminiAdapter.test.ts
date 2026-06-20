import { describe, expect, it } from 'vitest';
import { parseGeminiUsage } from '../src/providers/gemini/geminiAdapter';

describe('parseGeminiUsage', () => {
  it('maps remaining/limit to a percent-used snapshot', () => {
    const out = parseGeminiUsage({ window: 'daily', remaining: 20, limit: 100 }, new Date('2026-06-20T12:00:00Z'));
    expect(out).toMatchObject([{ provider: 'gemini', window: 'daily', usedPercent: 80, confidence: 'inferred' }]);
  });
});
