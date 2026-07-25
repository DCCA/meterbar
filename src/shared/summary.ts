import type { ProviderCardState, UsageWindow } from './types';
import { formatCountdown } from './time';

const SHORT: Partial<Record<UsageWindow, string>> = {
  five_hour: '5h',
  seven_day: '7d',
  daily: 'daily',
  monthly: 'monthly',
  api_billing: 'api',
  custom: 'usage'
};

const LONG: Record<UsageWindow, string> = {
  five_hour: '5-hour limit',
  seven_day: '7-day limit',
  daily: 'Daily',
  monthly: 'Monthly',
  api_billing: 'API billing',
  custom: 'Usage'
};

export function windowShortLabel(window: UsageWindow): string {
  return SHORT[window] ?? window;
}

export function windowLongLabel(window: UsageWindow): string {
  return LONG[window] ?? 'Usage';
}

export interface AlertCopyInput {
  kind: 'threshold' | 'reset';
  label: string;
  window: UsageWindow;
  usedPercent: number;
  resetsAt?: string;
}

/** Human notification copy: provider label + plain window name, never raw enums. */
export function alertCopy(alert: AlertCopyInput, now: Date = new Date()): { title: string; message: string } {
  const window = windowLongLabel(alert.window);
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
    lines.push(`${card.label}: ${fresh.map((s) => `${windowShortLabel(s.window)} ${s.usedPercent}%`).join(' · ')}`);
  }
  return lines.length ? `MeterBar · % of limit used\n${lines.join('\n')}` : 'MeterBar · no usage data yet';
}
