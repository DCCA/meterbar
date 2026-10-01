import { afterEach, describe, expect, it, vi } from 'vitest';
import { KNOWN, renderCardsInto, type DashboardView } from '../src/ui/cardsView';
import type { ProviderCardState } from '../src/shared/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

const now = Date.now();
const iso = (offsetMs: number): string => new Date(now + offsetMs).toISOString();

async function render(cards: ProviderCardState[], view: DashboardView, history: Record<string, Array<[number, number]>> = {}): Promise<string> {
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn().mockResolvedValue({ cards }) },
    storage: { local: { get: vi.fn(async (key: string) => ({ [key]: history[key.replace('history:', '')] })) } }
  });
  vi.stubGlobal('document', { querySelector: () => null });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
  const container = { innerHTML: '', dataset: {} as Record<string, string>, querySelector: () => null } as unknown as HTMLElement;
  await renderCardsInto(container, view);
  return container.innerHTML;
}

const claude: ProviderCardState = {
  provider: 'claude',
  label: 'Claude',
  status: 'connected',
  lastUpdatedAt: iso(-60_000),
  snapshots: [
    {
      provider: 'claude',
      window: 'five_hour',
      usedRatio: 0.72,
      usedPercent: 72,
      resetsAt: iso(2 * 60 * 60 * 1000),
      capturedAt: iso(-60_000),
      source: 'claude-web-usage-endpoint',
      confidence: 'inferred',
      stale: false
    },
    {
      provider: 'claude',
      window: 'seven_day',
      usedRatio: 0.38,
      usedPercent: 38,
      resetsAt: iso(3 * 24 * 60 * 60 * 1000),
      capturedAt: iso(-60_000),
      source: 'claude-web-usage-endpoint',
      confidence: 'inferred',
      stale: false
    }
  ]
};

describe('provider slots', () => {
  it('keeps the user-confirmed Claude, OpenAI, Gemini order (ChatGPT and Codex are one subscription)', () => {
    expect(KNOWN).toEqual([
      { provider: 'claude', label: 'Claude' },
      { provider: 'chatgpt', label: 'OpenAI' },
      { provider: 'gemini', label: 'Gemini' }
    ]);
  });
});

describe('home view', () => {
  it('leads with the tightest limit, then the trend, then compact limits in fixed order', async () => {
    const series: Array<[number, number]> = [[now - 20 * 60 * 60 * 1000, 40], [now - 60_000, 72]];
    const html = await render([claude], 'home', { 'claude:five_hour': series });

    expect(html).toContain('<section class="hero level-warn"');
    expect(html).toContain('<strong class="hero-value">72<small>% used</small></strong>');
    expect(html).toContain('<b>Claude</b> 5-hour');
    expect(html).toContain('inferred');
    expect(html).toContain('<h2>Trend</h2>');
    expect(html).toContain('data-provider="claude"');
    expect(html).toContain('<div class="trend-legend">');
    expect(html).toContain('<h2>Limits</h2>');
    expect(html).toContain('72% used');
    expect(html).toContain('38% used');
    expect(html.indexOf('Claude</span>')).toBeLessThan(html.indexOf('OpenAI</span>'));
    expect(html.indexOf('OpenAI</span>')).toBeLessThan(html.indexOf('Gemini</span>'));
  });

  it('states honestly when the trend has too few readings', async () => {
    const html = await render([claude], 'home');
    expect(html).toContain('The trend appears after a few readings');
    expect(html).not.toContain('trend-chart');
  });

  it('shows an idle hero and the sign-in hint when nothing is connected', async () => {
    const html = await render([], 'home');
    expect(html).toContain('hero hero-idle');
    expect(html).toContain('<strong class="hero-value">--<small>% used</small></strong>');
    expect(html).toContain('never stores chat content');
  });
});

describe('limits view', () => {
  it('renders each provider section with meters, pace tick, reset copy, and uncertainty', async () => {
    const html = await render([claude], 'limits');
    expect(html).toContain('<section class="prov" data-provider="claude">');
    expect(html).toContain('2 windows');
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="72"');
    expect(html).toContain('class="tick"');
    expect(html).toContain('Resets in');
    expect(html).toContain('inferred');
    expect(html).toContain('<div class="wins">');
  });

  it('keeps Gemini status-only and offers sign-in for providers without data', async () => {
    const html = await render([
      { provider: 'gemini', label: 'Gemini', status: 'connected', lastUpdatedAt: iso(-120_000), snapshots: [] }
    ], 'limits');
    expect(html).toContain('prov prov-status');
    expect(html).toContain('Signed in');
    expect(html).toContain('data-provider="claude" data-status="unsupported"');
    expect(html).toContain('href="https://claude.ai"');
    expect(html).toContain('Open claude.ai');
  });

  it('labels a fully stale provider instead of rendering it as live', async () => {
    const stale = { ...claude, snapshots: claude.snapshots.map((s) => ({ ...s, stale: true })) };
    const html = await render([stale], 'limits');
    expect(html).toContain('prov prov-stale');
    expect(html).toContain('Data is stale');
    expect(html).toContain('class="meter stale"');
  });
});

describe('provider notice state', () => {
  const gated: ProviderCardState = {
    provider: 'claude', label: 'Claude', status: 'not_connected', snapshots: [],
    message: 'Needs your OK before MeterBar reads your usage.', needsAcknowledgement: true
  };

  it('asks for an OK in Settings instead of sending the user to sign in', async () => {
    const html = await render([gated], 'limits');
    expect(html).toContain('Needs your OK');
    expect(html).toContain('MeterBar reads nothing from claude.ai until you allow it in Settings.');
    expect(html).toContain('href="../options/options.html#providers"');
    expect(html).not.toContain('Open claude.ai');
    expect(await render([gated], 'home')).toContain('Needs your OK');
  });

  it('keeps last readings visible with the notice and link', async () => {
    const html = await render([{ ...claude, message: gated.message, needsAcknowledgement: true }], 'limits');
    expect(html).toContain('72% used');
    expect(html).toContain('Needs your OK before MeterBar reads your usage.');
    expect(html).toContain('Review in Settings');
  });
});

