import { afterEach, describe, expect, it, vi } from 'vitest';
import { KNOWN, renderCardsInto } from '../src/ui/cardsView';
import type { ProviderCardState } from '../src/shared/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(cards: ProviderCardState[]): Promise<string> {
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: vi.fn().mockResolvedValue({ cards }) }
  });
  vi.stubGlobal('document', { querySelector: () => null });
  const container = { innerHTML: '' } as HTMLElement;
  await renderCardsInto(container);
  return container.innerHTML;
}

describe('Workbench provider slots', () => {
  it('keeps the user-confirmed Claude, ChatGPT, Codex, Gemini order', () => {
    expect(KNOWN).toEqual([
      { provider: 'claude', label: 'Claude' },
      { provider: 'chatgpt', label: 'ChatGPT' },
      { provider: 'codex', label: 'Codex' },
      { provider: 'gemini', label: 'Gemini' }
    ]);
  });

  it('integrates the tightest live reading and provider bank into one channel console', async () => {
    const html = await render([
      {
        provider: 'claude',
        label: 'Claude',
        status: 'connected',
        lastUpdatedAt: '2026-09-19T20:00:00.000Z',
        snapshots: [
          {
            provider: 'claude',
            window: 'five_hour',
            usedRatio: 0.62,
            usedPercent: 62,
            resetsAt: '2026-09-19T22:00:00.000Z',
            capturedAt: '2026-09-19T20:00:00.000Z',
            source: 'claude-web-usage-endpoint',
            confidence: 'inferred',
            stale: false
          }
        ]
      }
    ]);

    expect(html).toContain('<section class="channel-console">');
    expect(html).toContain('class="constraint-rail level-ok"');
    expect(html).toContain('<strong class="constraint-value">62<span>%</span></strong>');
    expect(html).toContain('<div class="instrument-bank">');
    expect(html.indexOf('<h2>Claude</h2>')).toBeLessThan(html.indexOf('<h2>ChatGPT</h2>'));
    expect(html.indexOf('<h2>ChatGPT</h2>')).toBeLessThan(html.indexOf('<h2>Codex</h2>'));
    expect(html.indexOf('<h2>Codex</h2>')).toBeLessThan(html.indexOf('<h2>Gemini</h2>'));
  });

  it('keeps the channel console truthful when connected providers expose no live window', async () => {
    const html = await render([
      {
        provider: 'gemini',
        label: 'Gemini',
        status: 'connected',
        lastUpdatedAt: '2026-09-19T20:00:00.000Z',
        message: 'Connected - usage numbers are not exposed.',
        snapshots: []
      }
    ]);

    expect(html).toContain('<section class="channel-console">');
    expect(html).toContain('class="constraint-rail constraint-idle"');
    expect(html).toContain('<strong class="constraint-value">--<span>%</span></strong>');
    expect(html).toContain('No live usage window reported.');
  });
});
