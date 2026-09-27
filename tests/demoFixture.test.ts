import { describe, expect, it, vi } from 'vitest';
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

describe('derived product copy', () => {
  it('uses the product alert wording with its uncertainty qualifier', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const d = deriveDemo();
    expect(d.alert.title).toBe('Claude: 5-hour limit at 91% used (unofficial source)');
    expect(d.alert.message).toBe('Resets in 46m.');
  });

  it('builds the tooltip from fresh readings only, with no Gemini number', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const lines = deriveDemo().tooltip.split('\n');
    expect(lines[0]).toBe('MeterBar · % of limit used');
    expect(lines[1]).toMatch(/^Claude: 5h 72% \(unofficial source\)/);
    expect(lines[2]).toMatch(/^OpenAI: 7d 38%/);
    expect(lines.some((l) => l.startsWith('Gemini'))).toBe(false);
  });

  it('matches the badge and icon the background worker would draw', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const d = deriveDemo();
    expect(d.badge.glance.text).toBe('72');
    expect(d.badge.alert.text).toBe('91');
    expect(d.icon.alert.map((b) => [b.provider, b.level])).toEqual([['claude', 'crit'], ['chatgpt', 'ok'], ['gemini', 'ok']]);
    expect(d.icon.alert[2].fillRatio).toBe(0);
  });

  it('renders identical strings in any time zone', async () => {
    const original = process.env.TZ;
    const results: string[] = [];
    try {
      for (const tz of ['UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
        process.env.TZ = tz;
        vi.resetModules();
        const { deriveDemo } = await import('../demo/derive');
        results.push(JSON.stringify(deriveDemo()));
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(new Set(results).size).toBe(1);
  });
});
