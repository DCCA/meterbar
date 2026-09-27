// Demo dataset for the README video. Every reading is 'inferred' (as live Claude and
// OpenAI readings are), Gemini is status-only, and nothing resembles a real account.
// tests/demoFixture.test.ts pins these truthfulness rules.
import type { ProviderCardState, UsageSnapshot, UsageWindow } from '../src/shared/types';

export type DemoState = 'glance' | 'alert';
export type HistoryPoint = [t: number, p: number];

const M = 60_000;
const H = 60 * M;
const D = 24 * H;

/** Frozen "now" for every surface. Local time on purpose: all on-screen times are relative. */
export const NOW = new Date(2026, 8, 24, 14, 30).getTime();

const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

function snap(
  provider: UsageSnapshot['provider'],
  window: UsageWindow,
  usedPercent: number,
  resetsInMs: number,
  extra: Partial<UsageSnapshot> = {}
): UsageSnapshot {
  return {
    provider,
    window,
    usedRatio: usedPercent / 100,
    usedPercent,
    resetsAt: iso(resetsInMs),
    capturedAt: iso(-1 * M),
    source: 'demo',
    confidence: 'inferred',
    stale: false,
    ...extra
  };
}

/** The Claude 5-hour reading is the only thing that changes between beats. */
const CLAUDE_5H: Record<DemoState, { pct: number; resetsIn: number }> = {
  glance: { pct: 72, resetsIn: 2 * H + 14 * M },
  alert: { pct: 91, resetsIn: 46 * M }
};

export function demoCards(state: DemoState): ProviderCardState[] {
  const c = CLAUDE_5H[state];
  const updated = iso(-1 * M);
  return [
    {
      provider: 'claude', label: 'Claude', status: 'connected', lastUpdatedAt: updated,
      snapshots: [snap('claude', 'five_hour', c.pct, c.resetsIn), snap('claude', 'seven_day', 41, 3 * D + 6 * H)]
    },
    {
      provider: 'chatgpt', label: 'OpenAI', status: 'connected', lastUpdatedAt: updated,
      snapshots: [
        snap('chatgpt', 'seven_day', 38, 4 * D + 2 * H),
        snap('chatgpt', 'custom', 22, 3 * D, { workspaceLabel: 'Codex' })
      ]
    },
    { provider: 'gemini', label: 'Gemini', status: 'connected', lastUpdatedAt: updated, snapshots: [] }
  ];
}

/** 24 h of 10-minute points (the refresh cadence), ending exactly at NOW on `end`. */
function series(end: number, shape: (f: number) => number): HistoryPoint[] {
  const steps = 144;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps;
    return [NOW - (steps - i) * 10 * M, i === steps ? end : Math.round(end * shape(f))];
  });
}

/** A working day: a morning bump that resets, then a steady afternoon climb. */
const workday = (f: number) => (f < 0.45 ? 0.35 * Math.sin(f * 7) ** 2 : Math.min(1, ((f - 0.45) / 0.55) * 1.05));

export function demoHistory(state: DemoState): Record<string, HistoryPoint[]> {
  return {
    'history:claude:five_hour': series(CLAUDE_5H[state].pct, workday),
    'history:chatgpt:seven_day': series(38, (f) => 0.62 + 0.38 * f)
  };
}
