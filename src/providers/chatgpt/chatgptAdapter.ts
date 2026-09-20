import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface ChatgptWindow { used_percent?: number; reset_at?: number; limit_window_seconds?: number; }
interface ChatgptRateLimit { primary_window?: ChatgptWindow | null; secondary_window?: ChatgptWindow | null; }
interface ChatgptAdditionalLimit { limit_name?: string; rate_limit?: ChatgptRateLimit | null; }
interface ChatgptUsageResponse {
  rate_limit?: ChatgptRateLimit | null;
  additional_rate_limits?: ChatgptAdditionalLimit[] | null;
}

function epochToIso(seconds?: number): string | undefined {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : undefined;
}

// Window label comes from the payload's duration when present; `fallback` is the
// historical positional meaning (primary = 5h, secondary = 7d). OpenAI dropped the
// 5h window on 2026-07-12, so position alone is no longer reliable.
const WINDOW_BY_SECONDS: Record<number, UsageWindow> = { 18000: 'five_hour', 86400: 'daily', 604800: 'seven_day' };
function windowOf(w: ChatgptWindow, fallback: UsageWindow): UsageWindow {
  const secs = w.limit_window_seconds;
  if (typeof secs !== 'number') return fallback;
  return WINDOW_BY_SECONDS[secs] ?? 'custom';
}

function snapshot(window: UsageWindow, w: ChatgptWindow, capturedAt: string, workspaceLabel?: string): UsageSnapshot | null {
  if (typeof w.used_percent !== 'number') return null;
  return {
    provider: 'chatgpt',
    ...(workspaceLabel ? { workspaceLabel } : {}),
    window,
    usedRatio: w.used_percent / 100,
    usedPercent: Math.round(w.used_percent),
    resetsAt: epochToIso(w.reset_at),
    capturedAt,
    source: 'chatgpt-wham-usage',
    confidence: 'inferred',
    stale: false
  };
}

/**
 * Pure parser (no I/O). `used_percent` is already a 0-100 percent in the structured
 * response, but the endpoint is undocumented, so confidence remains `inferred`.
 * A sanitized live response captured on 2026-06-20 is checked in as parser evidence.
 *
 * ChatGPT and Codex are one subscription and one endpoint: `rate_limit` is the
 * account-wide pool (Codex / Work / agents) and `additional_rate_limits` holds
 * per-model caps that only exist while OpenAI publishes them. Everything lands on
 * the single OpenAI card; a cap becomes an extra window named after its limit.
 */
export function parseChatgptUsage(payload: ChatgptUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const out: UsageSnapshot[] = [];

  // Account-wide usage pool.
  const main = payload.rate_limit ?? {};
  const primary = main.primary_window
    ? snapshot(windowOf(main.primary_window, 'five_hour'), main.primary_window, capturedAt)
    : null;
  const secondary = main.secondary_window
    ? snapshot(windowOf(main.secondary_window, 'seven_day'), main.secondary_window, capturedAt)
    : null;
  if (primary) out.push(primary);
  if (secondary) out.push(secondary);

  // The riskiest per-model cap becomes one extra window under 'custom' so it never
  // collides with the pool's windows in the history store (keyed by provider:window).
  let riskiest: ChatgptWindow | null = null;
  let riskiestName = '';
  let riskiestPct = -1;
  for (const entry of payload.additional_rate_limits ?? []) {
    const rl = entry.rate_limit ?? {};
    for (const w of [rl.primary_window, rl.secondary_window]) {
      if (!w || typeof w.used_percent !== 'number') continue;
      if (w.used_percent > riskiestPct) { riskiestPct = w.used_percent; riskiest = w; riskiestName = entry.limit_name ?? ''; }
    }
  }
  if (riskiest) {
    const cap = snapshot('custom', riskiest, capturedAt, (riskiestName || 'Model cap').slice(0, 40));
    if (cap) out.push(cap);
  }

  return out;
}

// --- Pure endpoint helpers (background worker performs the actual fetches) ---
export const CHATGPT_ORIGIN = 'https://chatgpt.com';
export function chatgptSessionUrl(): string { return `${CHATGPT_ORIGIN}/api/auth/session`; }
export function chatgptAccountsUrl(): string { return `${CHATGPT_ORIGIN}/backend-api/accounts/check/v4-2023-04-27`; }
export function chatgptUsageUrl(): string { return `${CHATGPT_ORIGIN}/backend-api/wham/usage`; }

interface ChatgptAccountsCheck { accounts?: Record<string, { account?: { account_id?: string } }>; }

/**
 * Choose the account whose usage to read from the `/backend-api/accounts/check`
 * response. Prefer the response's explicit `default` entry, then fall back to the
 * first account with an id. The id is used only as a request header, never stored.
 */
export function pickChatgptAccountId(body: unknown): string | null {
  const accounts = (body as ChatgptAccountsCheck | null)?.accounts;
  if (!accounts || typeof accounts !== 'object') return null;
  const defaultId = accounts.default?.account?.account_id;
  if (typeof defaultId === 'string' && defaultId) return defaultId;
  for (const entry of Object.values(accounts)) {
    const id = entry?.account?.account_id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt',
  label: 'OpenAI',
  // `fetch` strategy via the background worker (Bearer token minted from the session
  // cookie); nothing is stored. `endpoint` documents the usage call.
  collection: { strategy: 'fetch', endpoint: chatgptUsageUrl(), init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseChatgptUsage(raw as ChatgptUsageResponse)
};
