import type { ProviderId, UsageWindow } from '../shared/types';

export type Point = [t: number, p: number];
export interface PruneOptions {
  rawWindowMs: number; // keep points newer than this at full resolution
  maxPoints: number;   // hard cap on stored points per series
}

const DEFAULTS: PruneOptions = { rawWindowMs: 24 * 60 * 60 * 1000, maxPoints: 500 };

export function appendPoint(series: Point[], t: number, p: number): Point[] {
  return [...series, [t, Math.round(p)]];
}

/** Full-res inside rawWindow; older points collapsed to one (last) per hour; capped. */
export function pruneSeries(series: Point[], now: number, opts: PruneOptions = DEFAULTS): Point[] {
  const cutoff = now - opts.rawWindowMs;
  const recent = series.filter(([t]) => t >= cutoff);
  const older = series.filter(([t]) => t < cutoff);

  const hourly = new Map<number, Point>();
  for (const [t, p] of older) hourly.set(Math.floor(t / 3_600_000), [t, p]); // last write wins

  const merged = [...hourly.values(), ...recent].sort((a, b) => a[0] - b[0]);
  return merged.length > opts.maxPoints ? merged.slice(merged.length - opts.maxPoints) : merged;
}

export function historyKey(provider: ProviderId, window: UsageWindow, windowSeconds?: number): string {
  const duration = window === 'rolling' && windowSeconds && Number.isFinite(windowSeconds) && windowSeconds > 0
    ? `:${Math.round(windowSeconds)}`
    : '';
  return `history:${provider}:${window}${duration}`;
}

export async function recordPoint(
  provider: ProviderId,
  window: UsageWindow,
  t: number,
  p: number,
  windowSeconds?: number
): Promise<void> {
  const k = historyKey(provider, window, windowSeconds);
  const stored = (await chrome.storage.local.get(k))[k] as Point[] | undefined;
  await chrome.storage.local.set({ [k]: pruneSeries(appendPoint(stored ?? [], t, p), Date.now()) });
}

export async function readSeries(
  provider: ProviderId,
  window: UsageWindow,
  windowSeconds?: number
): Promise<Point[]> {
  const k = historyKey(provider, window, windowSeconds);
  return ((await chrome.storage.local.get(k))[k] as Point[] | undefined) ?? [];
}

export async function readAllHistory(): Promise<Record<string, Point[]>> {
  const all = await chrome.storage.local.get(null);
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('history:'))) as Record<string, Point[]>;
}

export async function clearHistory(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const historyKeys = Object.keys(all).filter((k) => k.startsWith('history:'));
  await chrome.storage.local.remove(historyKeys);
}
