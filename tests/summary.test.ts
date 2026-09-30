import { describe, expect, it } from 'vitest';
import { alertCopy, buildTooltip, windowShortLabel } from '../src/shared/summary';
import type { Confidence, ProviderCardState } from '../src/shared/types';

function card(
  label: string,
  windows: Array<['five_hour' | 'seven_day', number]>,
  stale = false,
  confidence: Confidence = 'exact'
): ProviderCardState {
  return {
    provider: 'claude', label, status: 'connected',
    snapshots: windows.map(([window, usedPercent]) => ({
      provider: 'claude', window, usedRatio: usedPercent / 100, usedPercent,
      capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence, stale
    }))
  };
}

describe('buildTooltip', () => {
  it('summarizes fresh windows per provider and names the direction of the number', () => {
    expect(buildTooltip([card('Claude', [['five_hour', 62], ['seven_day', 41]])]))
      .toBe('MeterBar · % of limit used\nClaude: 5h 62% · 7d 41%');
  });

  it('labels readings from undocumented provider sources', () => {
    expect(buildTooltip([card('Claude', [['five_hour', 62]], false, 'inferred')]))
      .toBe('MeterBar · % of limit used\nClaude: 5h 62% (unofficial source)');
  });

  it('names a per-model cap by its limit name, as the cards do', () => {
    const openai: ProviderCardState = {
      provider: 'chatgpt', label: 'OpenAI', status: 'connected',
      snapshots: [{
        provider: 'chatgpt', window: 'custom', workspaceLabel: 'GPT-5.3-Codex-Spark', usedRatio: 0.22, usedPercent: 22,
        capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'exact', stale: false
      }]
    };
    expect(buildTooltip([openai])).toBe('MeterBar · % of limit used\nOpenAI: GPT-5.3-Codex-Spark 22%');
  });

  it('falls back when there is no fresh data', () => {
    expect(buildTooltip([])).toBe('MeterBar · no usage data yet');
    expect(buildTooltip([card('Claude', [['five_hour', 62]], true)])).toBe('MeterBar · no usage data yet');
  });

  it('shortens window labels', () => {
    expect(windowShortLabel('seven_day')).toBe('7d');
  });
});

describe('alertCopy', () => {
  it('names a per-model cap by its limit name instead of a generic window', () => {
    expect(alertCopy({ kind: 'threshold', label: 'OpenAI', window: 'custom', workspaceLabel: 'GPT-5.3-Codex-Spark', usedPercent: 91 }).title)
      .toBe('OpenAI: GPT-5.3-Codex-Spark at 91% used');
  });
});
