import { describe, expect, it } from 'vitest';
import {
  cardAllStale,
  confidenceNote,
  escapeHtml,
  humanWindowLabel,
  isCompactRow,
  needleAngle,
  paceFraction,
  renderableSnapshots,
  riskLevel,
  riskClass,
  riskiestPercent,
  providerHome,
  timeAgo,
  resetLabel,
  safeProviderStatus,
  PROVIDER_HOMES
} from '../src/popup/render';
import type { ProviderCardState, UsageSnapshot } from '../src/shared/types';

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

describe('safeProviderStatus', () => {
  it('falls back for corrupted or untrusted stored status values', () => {
    expect(safeProviderStatus('connected')).toBe('connected');
    expect(safeProviderStatus('admin')).toBe('unsupported');
    expect(safeProviderStatus(undefined)).toBe('unsupported');
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

describe('needleAngle', () => {
  it('sweeps -120deg (0%) to +120deg (100%), clamped', () => {
    expect(needleAngle(0)).toBe(-120);
    expect(needleAngle(50)).toBe(0);
    expect(needleAngle(100)).toBe(120);
    expect(needleAngle(-5)).toBe(-120);
    expect(needleAngle(130)).toBe(120);
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

describe('paceFraction', () => {
  const now = new Date('2026-06-20T12:00:00Z');
  it('returns elapsed fraction of the window implied by the reset time', () => {
    // 5h window resetting in 1h15m -> 3h45m elapsed of 5h = 0.75
    expect(paceFraction('five_hour', new Date('2026-06-20T13:15:00Z').toISOString(), now)).toBeCloseTo(0.75);
    // 7d window resetting in 7d -> just started
    expect(paceFraction('seven_day', new Date('2026-06-27T12:00:00Z').toISOString(), now)).toBeCloseTo(0);
  });
  it('is undefined without a reset time or for windows of unknown length', () => {
    expect(paceFraction('five_hour', undefined, now)).toBeUndefined();
    expect(paceFraction('custom', new Date('2026-06-20T13:00:00Z').toISOString(), now)).toBeUndefined();
    expect(paceFraction('api_billing', new Date('2026-06-20T13:00:00Z').toISOString(), now)).toBeUndefined();
  });
  it('is undefined when the reset time is implausible for the window', () => {
    // already past
    expect(paceFraction('five_hour', new Date('2026-06-20T11:00:00Z').toISOString(), now)).toBeUndefined();
    // further out than the window is long
    expect(paceFraction('five_hour', new Date('2026-06-21T12:00:00Z').toISOString(), now)).toBeUndefined();
    expect(paceFraction('five_hour', 'not-a-date', now)).toBeUndefined();
  });
});

describe('renderableSnapshots', () => {
  it('drops unavailable-confidence snapshots, matching the badge filter', () => {
    const keep = snap({ usedPercent: 40 });
    const drop = snap({ usedPercent: 80, confidence: 'unavailable' });
    expect(renderableSnapshots([keep, drop])).toEqual([keep]);
  });
});

describe('isCompactRow', () => {
  it('compacts only fresh ok-level rows', () => {
    expect(isCompactRow(snap({ usedPercent: 42 }))).toBe(true);
    expect(isCompactRow(snap({ usedPercent: 42, confidence: 'estimated' }))).toBe(true);
    expect(isCompactRow(snap({ usedPercent: 70 }))).toBe(false);
    expect(isCompactRow(snap({ usedPercent: 42, stale: true }))).toBe(false);
  });
});

describe('cardAllStale', () => {
  it('is true only when every snapshot on a card with data is stale', () => {
    expect(cardAllStale(card({ snapshots: [snap({ stale: true }), snap({ stale: true })] }))).toBe(true);
    expect(cardAllStale(card({ snapshots: [snap({ stale: true }), snap({})] }))).toBe(false);
    expect(cardAllStale(card({ snapshots: [] }))).toBe(false);
  });
});

describe('confidenceNote', () => {
  it('stays silent for exact and filtered-out unavailable, humanizes the rest', () => {
    expect(confidenceNote(snap({}))).toBeUndefined();
    expect(confidenceNote(snap({ confidence: 'unavailable' }))).toBeUndefined();
    expect(confidenceNote(snap({ confidence: 'estimated' }))).toBe('estimated');
    expect(confidenceNote(snap({ confidence: 'inferred' }))).toBe('approximate');
  });
});
