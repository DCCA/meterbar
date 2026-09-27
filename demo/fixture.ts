// Demo dataset for the README video. Every reading is 'inferred' (as live Claude and
// OpenAI readings are), Gemini is status-only, and nothing resembles a real account.
// The 'alert' state is the very next 10-minute refresh after 'glance': every reset time is
// the same absolute instant, so the product would fire exactly one alert (Claude 5-hour
// at 90%) between them. tests/demoFixture.test.ts pins these rules.
import type { ProviderCardState, UsageSnapshot, UsageWindow } from '../src/shared/types';
import { historyKey, type Point } from '../src/storage/historyStore';

export type DemoState = 'glance' | 'alert';

const M = 60_000;
const H = 60 * M;
const D = 24 * H;
const REFRESH = 10 * M;
const FIVE_HOURS = 5 * H;

/** "Now" for the glance state. Local time on purpose: every on-screen time is relative. */
export const NOW = new Date(2026, 8, 24, 14, 30).getTime();

/** Each state is one refresh apart, the product's alarm cadence. */
export function demoNow(state: DemoState): number {
  return state === 'glance' ? NOW : NOW + REFRESH;
}

// Absolute reset instants, shared by both states.
const RESETS = {
  claude5h: NOW + 2 * H + 14 * M,
  claude7d: NOW + 3 * D + 6 * H,
  openai7d: NOW + 4 * D + 2 * H,
  openaiCap: NOW + 3 * D
};

// 84 -> 91 in one refresh: a heavy Claude Code burst, not an impossible jump.
const USED: Record<DemoState, { claude5h: number; claude7d: number }> = {
  glance: { claude5h: 84, claude7d: 43 },
  alert: { claude5h: 91, claude7d: 44 }
};

function snap(
  state: DemoState,
  provider: UsageSnapshot['provider'],
  window: UsageWindow,
  usedPercent: number,
  resetsAt: number,
  extra: Partial<UsageSnapshot> = {}
): UsageSnapshot {
  return {
    provider,
    window,
    usedRatio: usedPercent / 100,
    usedPercent,
    resetsAt: new Date(resetsAt).toISOString(),
    capturedAt: new Date(demoNow(state)).toISOString(), // read at the refresh itself
    source: 'demo',
    confidence: 'inferred',
    stale: false,
    ...extra
  };
}

export function demoCards(state: DemoState): ProviderCardState[] {
  const used = USED[state];
  const updated = new Date(demoNow(state)).toISOString();
  return [
    {
      provider: 'claude', label: 'Claude', status: 'connected', lastUpdatedAt: updated,
      snapshots: [
        snap(state, 'claude', 'five_hour', used.claude5h, RESETS.claude5h),
        snap(state, 'claude', 'seven_day', used.claude7d, RESETS.claude7d)
      ]
    },
    {
      provider: 'chatgpt', label: 'OpenAI', status: 'connected', lastUpdatedAt: updated,
      snapshots: [
        snap(state, 'chatgpt', 'seven_day', 38, RESETS.openai7d),
        // Per-model cap name as the wham/usage parser receives it (tests/chatgptAdapter.test.ts).
        snap(state, 'chatgpt', 'custom', 22, RESETS.openaiCap, { workspaceLabel: 'GPT-5.3-Codex-Spark' })
      ]
    },
    { provider: 'gemini', label: 'Gemini', status: 'connected', lastUpdatedAt: updated, snapshots: [] }
  ];
}

/** Peak of each earlier 5-hour window, oldest first: a night, a morning, a heavy afternoon. */
const EARLIER_PEAKS = [30, 18, 64, 8, 55];

/** Claude 5-hour usage at time t: a sawtooth that drops to 0 at every reset. */
function claude5hAt(t: number, state: DemoState): number {
  const now = demoNow(state);
  if (t === now) return USED[state].claude5h;
  const windowsBack = Math.ceil((RESETS.claude5h - FIVE_HOURS - t) / FIVE_HOURS);
  const windowStart = RESETS.claude5h - FIVE_HOURS * (windowsBack + 1);
  const progress = (t - windowStart) / FIVE_HOURS;
  if (windowsBack <= 0) {
    // Current window: from 0 at its start to the glance reading at NOW.
    return Math.round(USED.glance.claude5h * Math.min(1, (t - windowStart) / (NOW - windowStart)) ** 1.15);
  }
  const peak = EARLIER_PEAKS[EARLIER_PEAKS.length - windowsBack] ?? 0;
  return Math.round(peak * progress ** 0.9);
}

/** 24 h of 10-minute points (the refresh cadence), ending at the state's now. */
export function demoHistory(state: DemoState): Record<string, Point[]> {
  const now = demoNow(state);
  const times = Array.from({ length: 145 }, (_, i) => now - (144 - i) * REFRESH);
  return {
    [historyKey('claude', 'five_hour')]: times.map((t) => [t, claude5hAt(t, state)]),
    [historyKey('chatgpt', 'seven_day')]: times.map((t, i) => [t, i === 144 ? 38 : Math.round(30 + (8 * i) / 144)])
  };
}
