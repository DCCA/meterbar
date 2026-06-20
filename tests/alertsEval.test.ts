import { describe, expect, it } from 'vitest';
import { evaluateAlerts } from '../src/background/alerts';
import type { UsageSnapshot } from '../src/shared/types';

const snap = (pct: number, resetsAt?: string): UsageSnapshot => ({
  provider: 'claude', window: 'five_hour', usedRatio: pct / 100, usedPercent: pct,
  resetsAt, capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'exact', stale: false
});

describe('evaluateAlerts', () => {
  it('fires 90 critical once, not again for the same reset cycle', () => {
    const first = evaluateAlerts([snap(92, 'R1')], { seen: [], lastReset: {} });
    expect(first.fired.map((f) => f.threshold)).toEqual([70, 90]);
    const second = evaluateAlerts([snap(95, 'R1')], first.state);
    expect(second.fired).toHaveLength(0);
  });

  it('emits a reset-detected alert when resetsAt changes', () => {
    const seeded = { seen: [], lastReset: { 'claude:five_hour': 'R1' } };
    const out = evaluateAlerts([snap(5, 'R2')], seeded);
    expect(out.fired.some((f) => f.kind === 'reset')).toBe(true);
  });
});
