import { describe, expect, it } from 'vitest';
import { historyToCsv, historyToJson } from '../src/shared/exporters';

const t = Date.parse('2026-06-20T13:12:00.000Z');
const history = {
  'history:claude:five_hour': [[t, 62] as [number, number]],
  'history:chatgpt:rolling:10800': [[t, 12] as [number, number]]
};

describe('exporters', () => {
  it('emits a CSV header and a row per point', () => {
    const csv = historyToCsv(history);
    expect(csv.split('\n')[0]).toBe('provider,window,windowSeconds,capturedAt,usedPercent');
    expect(csv).toContain('claude,five_hour,,2026-06-20T13:12:00.000Z,62');
    expect(csv).toContain('chatgpt,rolling,10800,2026-06-20T13:12:00.000Z,12');
  });
  it('emits stable JSON', () => {
    expect(JSON.parse(historyToJson(history))).toEqual(history);
  });
});
