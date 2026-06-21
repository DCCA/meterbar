import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  humanWindowLabel,
  riskLevel,
  riskClass,
  riskiestPercent,
  orderByRisk,
  providerHome,
  timeAgo,
  resetLabel,
  PROVIDER_HOMES
} from '../src/popup/render';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../src/shared/types';

function snap(partial: Partial<UsageSnapshot>): UsageSnapshot {
  return {
    provider: 'claude',
    window: 'five_hour',
    usedRatio: 0.5,
    usedPercent: 50,
    capturedAt: new Date('2026-06-20T12:00:00Z').toISOString(),
    source: 'test',
    confidence: 'exact',
    stale: false,
    ...partial
  };
}

function card(partial: Partial<ProviderCardState>): ProviderCardState {
  return { provider: 'claude', label: 'Claude', status: 'connected', snapshots: [], ...partial };
}

describe('escapeHtml', () => {
  it('neutralizes HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    expect(escapeHtml(`a & b 'c'`)).toBe('a &amp; b &#39;c&#39;');
  });

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('ChatGPT / Codex')).toBe('ChatGPT / Codex');
  });
});

describe('humanWindowLabel', () => {
  it('renders human-friendly window names', () => {
    expect(humanWindowLabel('five_hour')).toBe('5-hour limit');
    expect(humanWindowLabel('seven_day')).toBe('7-day limit');
    expect(humanWindowLabel('daily')).toBe('Daily');
    expect(humanWindowLabel('monthly')).toBe('Monthly');
  });
});

describe('riskLevel / riskClass', () => {
  it('maps percent to ok/warn/crit at the badge thresholds', () => {
    expect(riskLevel(69)).toBe('ok');
    expect(riskLevel(70)).toBe('warn');
    expect(riskLevel(89)).toBe('warn');
    expect(riskLevel(90)).toBe('crit');
  });

  it('riskClass returns empty for ok so the default fill color applies', () => {
    expect(riskClass(50)).toBe('');
    expect(riskClass(75)).toBe('warn');
    expect(riskClass(95)).toBe('crit');
  });
});

describe('riskiestPercent', () => {
  it('returns the highest snapshot percent, or -1 with no snapshots', () => {
    expect(riskiestPercent(card({ snapshots: [snap({ usedPercent: 30 }), snap({ usedPercent: 80 })] }))).toBe(80);
    expect(riskiestPercent(card({ snapshots: [] }))).toBe(-1);
  });
});

describe('orderByRisk', () => {
  it('puts providers with data first (riskiest first), connected-but-empty next, then the rest', () => {
    const claude = card({ provider: 'claude', snapshots: [snap({ usedPercent: 40 })] });
    const chatgpt = card({ provider: 'chatgpt', snapshots: [snap({ provider: 'chatgpt', usedPercent: 88 })] });
    const geminiConnected = card({ provider: 'gemini', status: 'connected', snapshots: [] });
    const known = [
      { provider: 'claude' as const, label: 'Claude' },
      { provider: 'chatgpt' as const, label: 'ChatGPT / Codex' },
      { provider: 'gemini' as const, label: 'Gemini' }
    ];
    const byId = new Map<ProviderId, ProviderCardState>([
      ['claude', claude],
      ['chatgpt', chatgpt],
      ['gemini', geminiConnected]
    ]);
    const ordered = orderByRisk(known, byId).map((e) => e.provider);
    // chatgpt (88%) before claude (40%); gemini (connected, no data) before any missing card
    expect(ordered).toEqual(['chatgpt', 'claude', 'gemini']);
  });

  it('keeps the known order stable when nothing has data', () => {
    const known = [
      { provider: 'claude' as const, label: 'Claude' },
      { provider: 'chatgpt' as const, label: 'ChatGPT / Codex' },
      { provider: 'gemini' as const, label: 'Gemini' }
    ];
    const ordered = orderByRisk(known, new Map<ProviderId, ProviderCardState>()).map((e) => e.provider);
    expect(ordered).toEqual(['claude', 'chatgpt', 'gemini']);
  });
});

describe('providerHome', () => {
  it('maps each first-party provider to a sign-in URL', () => {
    expect(providerHome('claude')).toBe(PROVIDER_HOMES.claude);
    expect(providerHome('chatgpt')).toMatch(/^https:\/\/chatgpt\.com/);
    expect(providerHome('gemini')).toMatch(/^https:\/\/gemini\.google\.com/);
    expect(providerHome('unknown')).toBeUndefined();
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-06-20T12:00:00Z');
  it('formats relative times', () => {
    expect(timeAgo(undefined, now)).toBe('never');
    expect(timeAgo(new Date('2026-06-20T11:59:40Z').toISOString(), now)).toBe('just now');
    expect(timeAgo(new Date('2026-06-20T11:45:00Z').toISOString(), now)).toBe('15m ago');
    expect(timeAgo(new Date('2026-06-20T09:30:00Z').toISOString(), now)).toBe('2h 30m ago');
  });
});

describe('resetLabel', () => {
  const now = new Date('2026-06-20T12:00:00Z');
  it('shows a countdown when a reset time is present', () => {
    expect(resetLabel(new Date('2026-06-20T14:14:00Z').toISOString(), now)).toBe('Resets in 2h 14m');
  });
  it('falls back honestly when reset time is unknown', () => {
    expect(resetLabel(undefined, now)).toBe('Reset time unknown');
  });
});
