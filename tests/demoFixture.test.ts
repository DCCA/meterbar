import { describe, expect, it } from 'vitest';
import { demoCards, demoHistory, NOW, type DemoState } from '../demo/fixture';
import { mostConstrainedWindow } from '../src/popup/render';

const STATES: DemoState[] = ['glance', 'alert'];
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe.each(STATES)('demo fixture (%s)', (state) => {
  const cards = demoCards(state);
  it('labels providers exactly as the product does', () => {
    expect(cards.map((c) => [c.provider, c.label])).toEqual([['claude', 'Claude'], ['chatgpt', 'OpenAI'], ['gemini', 'Gemini']]);
  });
  it('marks every reading inferred and fresh', () => {
    for (const s of cards.flatMap((c) => c.snapshots)) {
      expect(s.confidence).toBe('inferred');
      expect(s.stale).toBe(false);
      expect(NOW - Date.parse(s.capturedAt)).toBeLessThan(10 * 60 * 1000);
    }
  });
  it('keeps Gemini status-only', () => {
    const gemini = cards.find((c) => c.provider === 'gemini')!;
    expect(gemini.status).toBe('connected');
    expect(gemini.snapshots).toEqual([]);
  });
  it('puts Claude 5-hour in the hero', () => {
    const top = mostConstrainedWindow(cards)!;
    expect(top.snapshot.provider).toBe('claude');
    expect(top.snapshot.window).toBe('five_hour');
    expect(top.snapshot.usedPercent).toBe(state === 'glance' ? 72 : 91);
  });
  it('has a 24 h trend ending at each tightest value', () => {
    const h = demoHistory(state);
    expect(h['history:claude:five_hour'].at(-1)).toEqual([NOW, state === 'glance' ? 72 : 91]);
    expect(h['history:chatgpt:seven_day'].at(-1)).toEqual([NOW, 38]);
    expect(h['history:claude:five_hour'].filter(([t]) => t >= NOW - 86_400_000).length).toBeGreaterThan(2);
  });
  it('contains no account-like strings', () => {
    const text = JSON.stringify(cards);
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(UUID);
  });
});
