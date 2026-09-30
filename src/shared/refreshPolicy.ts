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
