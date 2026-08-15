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
  it('summarizes fresh windows per provider and names the direction of the number', () => {
    expect(buildTooltip([card('Claude', [['five_hour', 62], ['seven_day', 41]])]))
      .toBe('MeterBar · % of limit used\nClaude: 5h 62% · 7d 41%');
  });

  it('falls back when there is no fresh data', () => {
    expect(buildTooltip([])).toBe('MeterBar · no usage data yet');
    expect(buildTooltip([card('Claude', [['five_hour', 62]], true)])).toBe('MeterBar · no usage data yet');
  });

  it('shortens known and server-reported window durations', () => {
    expect(windowShortLabel('seven_day')).toBe('7d');
    expect(windowShortLabel('rolling', 10800)).toBe('3h');
  });

  it('uses server-reported durations in OpenAI tooltip copy', () => {
    const openai: ProviderCardState = {
      provider: 'chatgpt', label: 'ChatGPT / Codex', status: 'connected',
      snapshots: [{
        provider: 'chatgpt', window: 'rolling', windowSeconds: 10800,
        usedRatio: 0.12, usedPercent: 12, capturedAt: '2026-06-20T12:00:00Z',
        source: 't', confidence: 'exact', stale: false
      }]
    };
    expect(buildTooltip([openai])).toContain('ChatGPT / Codex: 3h 12%');
  });
});
