import type { Point } from '../storage/historyStore';

export function historyToJson(history: Record<string, Point[]>): string {
  return JSON.stringify(history, null, 2);
}

export function historyToCsv(history: Record<string, Point[]>): string {
  const rows = ['provider,window,capturedAt,usedPercent'];
  for (const [key, points] of Object.entries(history)) {
    const [, provider, window] = key.split(':');
    for (const [t, p] of points) rows.push(`${provider},${window},${new Date(t).toISOString()},${p}`);
  }
  return rows.join('\n');
}
