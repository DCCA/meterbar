import type { ProviderCardState, UsageWindow } from './types';
import { formatCountdown } from './time';

const SHORT: Partial<Record<UsageWindow, string>> = {
  five_hour: '5h',
  seven_day: '7d',
  daily: 'daily',
  monthly: 'monthly',
  api_billing: 'api',
  rolling: 'usage',
  custom: 'usage'
};

const LONG: Record<UsageWindow, string> = {
  five_hour: '5-hour limit',
  seven_day: '7-day limit',
  daily: 'Daily',
  monthly: 'Monthly',
  api_billing: 'API billing',
  rolling: 'Rolling window',
  custom: 'Usage'
};

function durationLabel(seconds: number, long: boolean): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const units = [
    { seconds: 24 * 60 * 60, short: 'd', long: 'day' },
    { seconds: 60 * 60, short: 'h', long: 'hour' },
    { seconds: 60, short: 'm', long: 'minute' }
  ];
  for (const unit of units) {
    if (seconds % unit.seconds !== 0) continue;
    const amount = seconds / unit.seconds;
    return long
      ? `${amount}-${unit.long} window`
      : `${amount}${unit.short}`;
  }
  return long ? `${Math.round(seconds)}-second window` : `${Math.round(seconds)}s`;
}

export function windowShortLabel(window: UsageWindow, windowSeconds?: number): string {
  return ((window === 'rolling' || window === 'custom') && windowSeconds ? durationLabel(windowSeconds, false) : undefined)
    ?? SHORT[window]
    ?? window;
}

export function windowLongLabel(window: UsageWindow, windowSeconds?: number): string {
  return ((window === 'rolling' || window === 'custom') && windowSeconds ? durationLabel(windowSeconds, true) : undefined)
    ?? LONG[window]
    ?? 'Usage';
}

export interface AlertCopyInput {
  kind: 'threshold' | 'reset';
  label: string;
  window: UsageWindow;
  windowSeconds?: number;
  usedPercent: number;
  resetsAt?: string;
}

/** Human notification copy: provider label + plain window name, never raw enums. */
export function alertCopy(alert: AlertCopyInput, now: Date = new Date()): { title: string; message: string } {
  const window = windowLongLabel(alert.window, alert.windowSeconds);
  if (alert.kind === 'reset') {
    return { title: `${alert.label}: ${window} reset`, message: `Fresh window — back to ${alert.usedPercent}% used.` };
  }
  return {
    title: `${alert.label}: ${window} at ${alert.usedPercent}% used`,
    message: alert.resetsAt ? `Resets in ${formatCountdown(alert.resetsAt, now)}.` : 'Reset time unknown.'
  };
}

/** Build a multi-line hover tooltip for the toolbar icon from fresh card data. */
export function buildTooltip(cards: ProviderCardState[]): string {
  const lines: string[] = [];
  for (const card of cards) {
    const fresh = card.snapshots.filter((s) => !s.stale && s.confidence !== 'unavailable');
    if (fresh.length === 0) continue;
    lines.push(`${card.label}: ${fresh.map((s) => `${windowShortLabel(s.window, s.windowSeconds)} ${s.usedPercent}%`).join(' · ')}`);
  }
  return lines.length ? `MeterBar · % of limit used\n${lines.join('\n')}` : 'MeterBar · no usage data yet';
}
