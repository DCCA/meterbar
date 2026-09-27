import { describe, expect, it, vi } from 'vitest';
import { demoCards, demoHistory, demoNow, type DemoState } from '../demo/fixture';
import { evaluateAlerts } from '../src/background/alerts';
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
      expect(demoNow(state) - Date.parse(s.capturedAt)).toBeLessThan(10 * 60 * 1000);
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
    expect(top.snapshot.usedPercent).toBe(state === 'glance' ? 84 : 91);
  });
  it('has a 24 h trend ending at each tightest value', () => {
    const h = demoHistory(state);
    const now = demoNow(state);
    expect(h['history:claude:five_hour'].at(-1)).toEqual([now, state === 'glance' ? 84 : 91]);
    expect(h['history:chatgpt:seven_day'].at(-1)).toEqual([now, 38]);
    expect(h['history:claude:five_hour'].filter(([t]) => t >= now - 86_400_000).length).toBeGreaterThan(2);
  });

  it('drops the 5-hour trend to 0 at every reset, like a real 5-hour window', () => {
    const series = demoHistory(state)['history:claude:five_hour'];
    const resetsAt = Date.parse(cards[0].snapshots.find((s) => s.window === 'five_hour')!.resetsAt!);
    const boundaries = [1, 2, 3, 4].map((k) => resetsAt - k * 5 * 3_600_000);
    for (const b of boundaries) {
      const i = series.findIndex(([t]) => t >= b);
      expect(series[i][1]).toBeLessThanOrEqual(5); // first 10-minute reading after the reset
      expect(series[i - 1][1]).toBeGreaterThan(series[i][1]);
    }
  });
  it('contains no account-like strings', () => {
    const text = JSON.stringify(cards);
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(UUID);
  });
});

describe('glance to alert', () => {
  it('is one ordinary refresh apart with every reset time unchanged', () => {
    expect(demoNow('alert') - demoNow('glance')).toBe(10 * 60 * 1000);
    const resets = (state: DemoState) => demoCards(state).flatMap((c) => c.snapshots.map((s) => s.resetsAt));
    expect(resets('alert')).toEqual(resets('glance'));
  });

  it('makes the product fire exactly one alert: Claude 5-hour at 90%', () => {
    const snaps = (state: DemoState) => demoCards(state).flatMap((c) => c.snapshots);
    const first = evaluateAlerts(snaps('glance'), { seen: [], lastReset: {} });
    const second = evaluateAlerts(snaps('alert'), first.state);
    expect(second.fired.map((f) => [f.kind, f.provider, f.window, f.threshold])).toEqual([['threshold', 'claude', 'five_hour', 90]]);
  });
});

describe('derived product copy', () => {
  it('uses the product alert wording with its uncertainty qualifier', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const d = deriveDemo();
    expect(d.alert.title).toBe('Claude: 5-hour limit at 91% used (unofficial source)');
    expect(d.alert.message).toBe('Resets in 2h 4m.');
  });

  it('builds the tooltip from fresh readings only, with no Gemini number', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const lines = deriveDemo().tooltip.split('\n');
    expect(lines[0]).toBe('MeterBar · % of limit used');
    expect(lines[1]).toMatch(/^Claude: 5h 84% \(unofficial source\)/);
    expect(lines[2]).toBe('OpenAI: 7d 38% (unofficial source) · GPT-5.3-Codex-Spark 22% (unofficial source)');
    expect(lines.some((l) => l.startsWith('Gemini'))).toBe(false);
  });

  it('matches the badge and icon the background worker would draw', async () => {
    const { deriveDemo } = await import('../demo/derive');
    const d = deriveDemo();
    expect(d.badge.glance.text).toBe('84');
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
