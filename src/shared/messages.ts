import type { ProviderCardState, ProviderId } from './types';

export type ExtensionMessage =
  | { type: 'usage:report'; provider: ProviderId; raw: unknown; capturedAt: string } // content → bg
  | { type: 'status:report'; provider: ProviderId; status: ProviderCardState['status']; message?: string } // content → bg
  | { type: 'usage:refresh' }                                                         // popup → bg
  | { type: 'state:get' }                                                             // popup → bg
  | { type: 'state:result'; cards: ProviderCardState[] };                             // bg → popup

export function isUsageReport(m: unknown): m is Extract<ExtensionMessage, { type: 'usage:report' }> {
  return !!m && typeof m === 'object' && (m as { type?: unknown }).type === 'usage:report'
    && typeof (m as { provider?: unknown }).provider === 'string';
}

export function isStatusReport(m: unknown): m is Extract<ExtensionMessage, { type: 'status:report' }> {
  return !!m && typeof m === 'object' && (m as { type?: unknown }).type === 'status:report'
    && typeof (m as { provider?: unknown }).provider === 'string';
}
