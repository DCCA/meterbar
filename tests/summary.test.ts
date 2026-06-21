import { describe, expect, it } from 'vitest';
import { buildTooltip, windowShortLabel } from '../src/shared/summary';
import type { ProviderCardState } from '../src/shared/types';

function card(label: string, windows: Array<['five_hour' | 'seven_day', number]>, stale = false): ProviderCardState {
  return {
    provider: 'claude', label, status: 'connected',
    snapshots: windows.map(([window, usedPercent]) => ({
      provider: 'claude', window, usedRatio: usedPercent / 100, usedPercent,
      capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'exact', stale
    }))
  };
}

describe('buildTooltip', () => {
  it('summarizes fresh windows per provider on separate lines', () => {
    expect(buildTooltip([card('Claude', [['five_hour', 62], ['seven_day', 41]])]))
      .toBe('MeterBar\nClaude: 5h 62% · 7d 41%');
  });

  it('falls back when there is no fresh data', () => {
    expect(buildTooltip([])).toBe('MeterBar · no usage data yet');
    expect(buildTooltip([card('Claude', [['five_hour', 62]], true)])).toBe('MeterBar · no usage data yet');
  });

  it('shortens window labels', () => {
    expect(windowShortLabel('seven_day')).toBe('7d');
  });
});
