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
    window,
    ...(workspaceLabel ? { workspaceLabel } : {}),
    usedRatio: w.used_percent / 100,
    usedPercent: Math.round(w.used_percent),
    resetsAt: epochToIso(w.reset_at),
    capturedAt,
    source: 'chatgpt-wham-usage',
    confidence: 'exact',
    stale: false
  };
}

/**
 * Pure parser (no I/O). `used_percent` is already a 0-100 percent. Confidence is
 * `exact`: clean structured JSON from a usage endpoint, validated against a real
 * logged-in response on 2026-06-20 (the captured fixture in the test file).
 */
export function parseChatgptUsage(payload: ChatgptUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const out: UsageSnapshot[] = [];

  // Account-wide usage pool (Codex / Work / agents; chat conversations excluded).
  const main = payload.rate_limit ?? {};
  const primary = main.primary_window ? snapshot(windowOf(main.primary_window, 'five_hour'), main.primary_window, capturedAt) : null;
  const secondary = main.secondary_window ? snapshot(windowOf(main.secondary_window, 'seven_day'), main.secondary_window, capturedAt) : null;
  if (primary) out.push(primary);
  if (secondary) out.push(secondary);

  // One Codex bar under a distinct 'custom' window so it doesn't collide with the
  // chat windows in the history store (keyed by provider:window) or the popup.
  let riskiest: ChatgptWindow | null = null;
  let riskiestPct = -1;
  for (const entry of payload.additional_rate_limits ?? []) {
    const rl = entry.rate_limit ?? {};
    for (const w of [rl.primary_window, rl.secondary_window]) {
      if (!w || typeof w.used_percent !== 'number') continue;
      if (w.used_percent > riskiestPct) { riskiestPct = w.used_percent; riskiest = w; }
    }
  }
  if (riskiest) {
    const codex = snapshot('custom', riskiest, capturedAt, 'Codex');
    if (codex) out.push(codex);
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
 * response (the first account with an id). Pure: the response is fetched by the
 * background worker. The id is used only to build the request header, never stored.
 */
export function pickChatgptAccountId(body: unknown): string | null {
  const accounts = (body as ChatgptAccountsCheck | null)?.accounts;
  if (!accounts || typeof accounts !== 'object') return null;
  for (const entry of Object.values(accounts)) {
    const id = entry?.account?.account_id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt',
  label: 'ChatGPT / Codex',
  // `fetch` strategy via the background worker (Bearer token minted from the session
  // cookie); nothing is stored. `endpoint` documents the usage call.
  collection: { strategy: 'fetch', endpoint: chatgptUsageUrl(), init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseChatgptUsage(raw as ChatgptUsageResponse)
};
