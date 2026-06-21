import type { ProviderCardState, UsageWindow } from './types';

const SHORT: Partial<Record<UsageWindow, string>> = {
  five_hour: '5h',
  seven_day: '7d',
  daily: 'daily',
  monthly: 'monthly',
  api_billing: 'api',
  custom: 'usage'
};

export function windowShortLabel(window: UsageWindow): string {
  return SHORT[window] ?? window;
}

/** Build a multi-line hover tooltip for the toolbar icon from fresh card data. */
export function buildTooltip(cards: ProviderCardState[]): string {
  const lines: string[] = [];
  for (const card of cards) {
    const fresh = card.snapshots.filter((s) => !s.stale && s.confidence !== 'unavailable');
    if (fresh.length === 0) continue;
    lines.push(`${card.label}: ${fresh.map((s) => `${windowShortLabel(s.window)} ${s.usedPercent}%`).join(' · ')}`);
  }
  return lines.length ? `MeterBar\n${lines.join('\n')}` : 'MeterBar · no usage data yet';
}
