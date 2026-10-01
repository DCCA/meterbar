import type { FetchProviderId } from './types';

const MINUTE_MS = 60_000;
const DEFAULT_BACKOFF_MS = 30 * MINUTE_MS;
const MIN_BACKOFF_MS = MINUTE_MS;
const MAX_BACKOFF_MS = 24 * 60 * MINUTE_MS;

/**
 * When a provider that answered 429 may be asked again, as epoch ms. `Retry-After` is
 * delta-seconds or an HTTP-date; missing or unparseable means 30 minutes. Clamped to
 * [1 min, 24 h] so a hostile or broken header can neither hammer nor silence a provider.
 */
export function parseRetryAfter(header: string | null, now: Date): number {
  const value = header?.trim() ?? '';
  let delayMs = DEFAULT_BACKOFF_MS;
  if (/^\d+$/.test(value)) delayMs = Number(value) * 1000;
  else if (/^[a-z]{3}, /i.test(value) && !Number.isNaN(Date.parse(value))) delayMs = Date.parse(value) - now.getTime();
  return now.getTime() + Math.min(MAX_BACKOFF_MS, Math.max(MIN_BACKOFF_MS, delayMs));
}

/** Why a refresh was requested; decides whether the 5-minute throttle applies. */
export type RefreshReason = 'manual' | 'surface-open' | 'provider-tab' | 'settings' | 'alarm' | 'startup';
export type RefreshRequest = Partial<Record<FetchProviderId, RefreshReason>>;

export const MIN_INTERVAL_MS = 5 * MINUTE_MS;
const UNTHROTTLED = new Set<RefreshReason>(['manual', 'settings']);

export interface FetchGate {
  enabled: boolean;
  acknowledged: boolean;
  lastAttemptAt?: string;
  backoffUntil?: string;
}

/** Whether one provider may be read now. Nothing, not even a manual refresh, skips consent or backoff. */
export function shouldFetch(gate: FetchGate, reason: RefreshReason, now: number): boolean {
  if (!gate.enabled || !gate.acknowledged) return false;
  if (gate.backoffUntil && now < Date.parse(gate.backoffUntil)) return false;
  if (UNTHROTTLED.has(reason) || !gate.lastAttemptAt) return true;
  return now - Date.parse(gate.lastAttemptAt) >= MIN_INTERVAL_MS;
}

/** Combine two pending requests; per provider, an unthrottled reason wins. */
export function mergeRefreshRequests(a: RefreshRequest, b: RefreshRequest): RefreshRequest {
  const merged = { ...a };
  for (const [provider, reason] of Object.entries(b) as Array<[FetchProviderId, RefreshReason]>) {
    if (!merged[provider] || UNTHROTTLED.has(reason)) merged[provider] = reason;
  }
  return merged;
}

const PROVIDER_ORIGINS: Record<string, FetchProviderId> = {
  'https://claude.ai': 'claude',
  'https://chatgpt.com': 'chatgpt'
};

/** The fetch provider whose page a tab shows, by exact origin. */
export function providerForUrl(url: string | undefined): FetchProviderId | undefined {
  try {
    const origin = new URL(url ?? '').origin;
    return Object.hasOwn(PROVIDER_ORIGINS, origin) ? PROVIDER_ORIGINS[origin] : undefined;
  } catch {
    return undefined;
  }
}

type StorageChanges = Record<string, { oldValue?: unknown; newValue?: unknown }>;
const ENABLED_KEYS: Record<FetchProviderId, string> = { claude: 'claudeEnabled', chatgpt: 'chatgptEnabled' };

/** A settings write that just enabled or acknowledged a provider reads that provider right away. */
export function settingsRefreshRequest(changes: StorageChanges): RefreshRequest {
  const request: RefreshRequest = {};
  const ack = changes.acknowledged;
  const before = (ack?.oldValue ?? {}) as Record<string, unknown>;
  const after = (ack?.newValue ?? {}) as Record<string, unknown>;
  for (const provider of Object.keys(ENABLED_KEYS) as FetchProviderId[]) {
    const enabled = changes[ENABLED_KEYS[provider]]?.newValue === true;
    const acknowledged = !!ack && !!after[provider] && !before[provider];
    if (enabled || acknowledged) request[provider] = 'settings';
  }
  return request;
}
