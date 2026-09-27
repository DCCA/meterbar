import { describe, expect, it } from 'vitest';
import { evaluateAlerts, getAlertKey, shouldAlert } from '../src/background/alerts';
import { alertCopy } from '../src/shared/summary';

describe('alerts', () => {
  it('builds stable alert keys per provider window threshold reset cycle', () => {
    expect(getAlertKey('claude', 'five_hour', 90, '2026-06-20T14:00:00Z')).toBe('claude:five_hour:90:2026-06-20T14:00:00Z');
  });

  it('alerts only once for a threshold key', () => {
    const seen = new Set<string>();
    expect(shouldAlert(seen, 'a')).toBe(true);
    expect(shouldAlert(seen, 'a')).toBe(false);
  });
});

describe('alertCopy', () => {
  const now = new Date('2026-06-20T12:00:00Z');

  it('names the provider and window in plain language, with the reset countdown', () => {
    const copy = alertCopy(
      { kind: 'threshold', label: 'ChatGPT / Codex', window: 'five_hour', usedPercent: 91, resetsAt: '2026-06-20T12:46:00Z' },
      now
    );
    expect(copy.title).toBe('ChatGPT / Codex: 5-hour limit at 91% used');
    expect(copy.message).toBe('Resets in 46m.');
  });

  it('labels inferred readings as an unofficial source', () => {
    const copy = alertCopy({
      kind: 'threshold',
      label: 'Claude',
      window: 'five_hour',
      usedPercent: 91,
      confidence: 'inferred'
    }, now);
    expect(copy.title).toBe('Claude: 5-hour limit at 91% used (unofficial source)');
  });

  it('is honest when the reset time is unknown', () => {
    const copy = alertCopy({ kind: 'threshold', label: 'Claude', window: 'seven_day', usedPercent: 72 }, now);
    expect(copy.title).toBe('Claude: 7-day limit at 72% used');
    expect(copy.message).toBe('Reset time unknown.');
  });

  it('announces resets with the fresh usage level', () => {
    const copy = alertCopy({ kind: 'reset', label: 'Claude', window: 'five_hour', usedPercent: 3 }, now);
    expect(copy.title).toBe('Claude: 5-hour limit reset');
    expect(copy.message).toBe('Fresh window - back to 3% used.');
  });
});

describe('evaluateAlerts', () => {
  it('carries a per-model cap name through to the fired alert', () => {
    const { fired } = evaluateAlerts([{
      provider: 'chatgpt', window: 'custom', workspaceLabel: 'GPT-5.3-Codex-Spark', usedRatio: 0.91, usedPercent: 91,
      resetsAt: '2026-06-21T00:00:00Z', capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'inferred', stale: false
    }], { seen: [], lastReset: {} });
    expect(fired.map((f) => f.workspaceLabel)).toEqual(['GPT-5.3-Codex-Spark', 'GPT-5.3-Codex-Spark']);
  });
});

describe('per-model caps', () => {
  const cap = (workspaceLabel: string, usedPercent: number, resetsAt: string) => ({
    provider: 'chatgpt' as const, window: 'custom' as const, workspaceLabel, usedRatio: usedPercent / 100, usedPercent,
    resetsAt, capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'inferred' as const, stale: false
  });

  it('treats a switch to another model cap as a new series, not a reset', () => {
    const first = evaluateAlerts([cap('Model A', 50, '2026-06-21T00:00:00Z')], { seen: [], lastReset: {} });
    const second = evaluateAlerts([cap('Model B', 95, '2026-06-22T00:00:00Z')], first.state);
    expect(second.fired.map((f) => [f.kind, f.workspaceLabel, f.threshold])).toEqual([
      ['threshold', 'Model B', 70],
      ['threshold', 'Model B', 90]
    ]);
  });

  it('alerts for a newly riskiest cap even when it shares the old cap reset time', () => {
    const resetsAt = '2026-06-21T00:00:00Z';
    const first = evaluateAlerts([cap('Model A', 95, resetsAt)], { seen: [], lastReset: {} });
    const second = evaluateAlerts([cap('Model B', 92, resetsAt)], first.state);
    expect(second.fired.map((f) => [f.workspaceLabel, f.threshold])).toEqual([['Model B', 70], ['Model B', 90]]);
  });

  it('keeps the existing key format for windows without a limit name', () => {
    expect(getAlertKey('claude', 'five_hour', 90, '2026-06-20T14:00:00Z')).toBe('claude:five_hour:90:2026-06-20T14:00:00Z');
  });
});
