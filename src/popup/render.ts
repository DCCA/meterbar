import { formatCountdown } from '../shared/time';
import { windowLongLabel } from '../shared/summary';
import type { ProviderCardState, ProviderId, UsageSnapshot, UsageWindow } from '../shared/types';

// --- Pure rendering helpers (no DOM, no chrome.*; unit-tested in the node env) ---

/** Escape text before interpolating into innerHTML. Adapter/provider strings are data, not markup. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function humanWindowLabel(window: UsageWindow, windowSeconds?: number): string {
  return windowLongLabel(window, windowSeconds);
}

// Wall-clock length of each rolling window; windows without a fixed length get no pace tick.
const WINDOW_MS: Partial<Record<UsageWindow, number>> = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000
};

/**
 * How far through the current window we are (0..1), derived from the reset time.
 * This is what makes 91%-with-46m-left and 91%-with-4h-left look different: the bar
 * gets a tick at the even-pace position. Undefined when it cannot be computed honestly.
 */
export function paceFraction(
  window: UsageWindow,
  resetsAt: string | undefined,
  now: Date = new Date(),
  windowSeconds?: number
): number | undefined {
  if (!resetsAt) return undefined;
  const total = windowSeconds && Number.isFinite(windowSeconds) && windowSeconds > 0
    ? windowSeconds * 1000
    : WINDOW_MS[window];
  if (!total) return undefined;
  const remaining = Date.parse(resetsAt) - now.getTime();
  if (!Number.isFinite(remaining) || remaining < 0 || remaining > total) return undefined;
  return (total - remaining) / total;
}

/** Snapshots worth rendering as numbers — mirrors the badge/icon filter for 'unavailable'. */
export function renderableSnapshots(snapshots: UsageSnapshot[]): UsageSnapshot[] {
  return snapshots.filter((s) => s.confidence !== 'unavailable');
}

/** Fresh, healthy rows collapse to a single line; risk and staleness earn the full row. */
export function isCompactRow(snapshot: UsageSnapshot): boolean {
  return !snapshot.stale && riskLevel(snapshot.usedPercent) === 'ok';
}

/** True when a card has data but every reading is out of date. */
export function cardAllStale(card: ProviderCardState): boolean {
  return card.snapshots.length > 0 && card.snapshots.every((s) => s.stale);
}

export type RiskLevel = 'ok' | 'warn' | 'crit';

/** Same thresholds as the toolbar badge: amber >= 70, red >= 90. */
export function riskLevel(percent: number): RiskLevel {
  if (percent >= 90) return 'crit';
  if (percent >= 70) return 'warn';
  return 'ok';
}

/** CSS modifier for a bar fill ('' leaves the default green so the stylesheet stays simple). */
export function riskClass(percent: number): string {
  const level = riskLevel(percent);
  return level === 'ok' ? '' : level;
}

/** Highest used percent across a card's windows, or -1 when the card has no data. */
export function riskiestPercent(card: ProviderCardState): number {
  return card.snapshots.reduce((max, s) => Math.max(max, s.usedPercent), -1);
}

/**
 * Needle rotation for the live gauge mark: -120deg at 0% used, +120deg at 100%, clamped.
 * Same sweep as the first-run hero gauge, so the logo and the hero read as one instrument.
 */
export function needleAngle(percent: number): number {
  return -120 + (Math.max(0, Math.min(100, percent)) / 100) * 240;
}

export const PROVIDER_HOMES: Partial<Record<ProviderId, string>> = {
  claude: 'https://claude.ai',
  chatgpt: 'https://chatgpt.com',
  gemini: 'https://gemini.google.com/app'
};

/** Sign-in URL for a first-party provider, or undefined when we have no actionable home. */
export function providerHome(provider: ProviderId): string | undefined {
  return PROVIDER_HOMES[provider];
}

export function timeAgo(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function resetLabel(resetsAt: string | undefined, now: Date = new Date()): string {
  return resetsAt ? `Resets in ${formatCountdown(resetsAt, now)}` : 'Reset time unknown';
}

export const STATUS_TEXT: Record<ProviderCardState['status'], string> = {
  connected: 'Connected',
  not_connected: 'Not connected',
  stale: 'Data is stale',
  unsupported: 'Not connected yet'
};

/** A short, honest hint for cards without usage data, used as the empty-state body. */
export function emptyHint(card: ProviderCardState | undefined): string {
  if (card?.message) return card.message;
  switch (card?.status) {
    case 'not_connected':
      return 'Open the provider and sign in to read your usage.';
    case 'stale':
      return 'Last reading is out of date — reopen the provider.';
    default:
      return 'Open the provider and sign in to start tracking.';
  }
}

// Confidence is only worth surfacing when it is NOT exact (truthful uncertainty, no noise).
// 'unavailable' snapshots never reach the numeric render (renderableSnapshots drops them).
export function confidenceNote(snapshot: UsageSnapshot): string | undefined {
  if (snapshot.confidence === 'estimated') return 'estimated';
  if (snapshot.confidence === 'inferred') return 'approximate';
  return undefined;
}
