# Refresh policy, rate-limit backoff, and provider notice (2026-09-27)

## Finding

MeterBar reads Claude and OpenAI usage from undocumented endpoints using the browser's logged-in
session. Anthropic's Consumer Terms (s.3) forbid access "through automated or non-human means,
whether through a bot, script, or otherwise", and OpenAI's Terms forbid "automatically or
programmatically extract[ing] data". The 2026-09-27 landscape survey
(`docs/research/2026-09-27-usage-tracker-landscape.md`) found no sanctioned consumer-usage route
anywhere, no provider action against a usage *reader*, and that the browser-session path is the
lower-risk choice. The part of MeterBar that reads most like "a bot or script" is not *how* it
reads but *when*: an unattended `chrome.alarms` loop every 10 minutes, whether or not the user is
doing anything.

Current triggers (`src/background/index.ts`):

- `meterbar-refresh` alarm, every 10 min, created on `onInstalled`.
- Service-worker start (`void refreshAll()` at module load).
- Popup / side panel **Refresh** button (`usage:refresh`).
- Any provider toggle change in Options.

Opening the popup or side panel does **not** fetch; it renders stored state via `state:get`.
A 429 is mapped to `stale` with the copy "retrying automatically", but nothing honors
`Retry-After`: the next alarm or click simply fetches again.

## Goals

1. Fetch only when the user is plausibly present, unless they opt in to background refresh.
2. Never re-request a provider that asked us to back off before it said we may.
3. Tell the user, once per provider and before the first fetch, what MeterBar reads and the terms
   risk, and require an explicit OK.
4. Record the collection-method boundaries in the PRD so future work cannot drift into riskier
   methods.

Non-goals: new providers, new endpoints, new permissions, Chrome Web Store listing (separate
decision), changing the collection method itself.

## Design

### 1. Refresh triggers

A refresh request carries a **reason**. The worker decides per provider whether to fetch.

| Reason | Source | Throttled by min interval | Honors backoff |
|---|---|---|---|
| `manual` | Refresh button in popup / side panel | No | Yes |
| `surface-open` | Popup or side panel opened | Yes | Yes |
| `provider-tab` | A `claude.ai` / `chatgpt.com` tab becomes active or finishes loading | Yes, and only that provider | Yes |
| `settings` | Provider toggle or acknowledgement in Options | No, only that provider | Yes |
| `alarm` | `meterbar-refresh`, only when `backgroundRefresh` is on | Yes | Yes |
| `startup` | Worker start | Yes | Yes |

- **Min interval:** 5 minutes per provider, measured from the last *attempt* (success or
  failure), persisted in `chrome.storage.local` (`refreshState:<provider>.lastAttemptAt`) because
  the service worker is ephemeral.
- **Provider tab trigger:** `chrome.tabs.onActivated` + `chrome.tabs.onUpdated`
  (`status === 'complete'`). The existing `host_permissions` for `claude.ai` and `chatgpt.com` are
  enough to read `tab.url` for those origins, so **no `tabs` permission is added**. No content
  script is added for Claude or OpenAI.
- **Background refresh setting:** new `Settings.backgroundRefresh: boolean`, default `false`.
  The alarm exists only while it is `true`: created/cleared on `onInstalled`, `onStartup`, and on
  the settings change. Existing installs migrate to `false` (safer default; the Options copy
  explains how to turn it back on).
- **Message change:** `usage:refresh` gains an optional `reason: 'manual' | 'surface-open'`
  (validated; unknown -> rejected). Missing `reason` is treated as `manual` for compatibility.
  Popup and side panel send `surface-open` on load.
- **Staleness is unchanged:** `isStale` stays at 10 minutes and the badge still shows only fresh
  readings. With background refresh off, the badge number disappears after 10 idle minutes; that
  is the truthful state, and it comes back as soon as the user opens a provider tab or MeterBar.

### 2. Rate-limit backoff

- On `429` from any request in a provider's chain, parse `Retry-After` (delta-seconds or
  HTTP-date). Missing or unparseable -> 30 minutes. Clamp to [1 min, 24 h].
- Persist `refreshState:<provider>.backoffUntil`. Every trigger, including `manual`, skips the
  provider until then.
- The card stays `stale` with copy naming the time: "OpenAI asked MeterBar to wait - next try at
  14:32." The current "retrying automatically" copy is removed.
- `5xx` and network errors keep today's behavior (no extra backoff beyond the min interval).
- Pure helpers (`parseRetryAfter(header, now)`, `shouldFetch(state, reason, now)`) live in a new
  node-tested module; `refresh.ts` stays the only place that does I/O.

### 3. Provider notice (acknowledgement gate)

- New `Settings.acknowledged: Partial<Record<'claude' | 'chatgpt', string>>` (ISO time of the OK).
- A fetch provider is **not fetched** until acknowledged. Its card shows status `not_connected`
  with the message "Needs your OK before MeterBar reads your usage" and an action that opens the
  notice.
- Notice copy (per provider, final wording in the design ticket):
  > MeterBar reads your {Provider} usage from an undocumented endpoint on {origin}, using your
  > existing login. It reads only percentages and reset times - never chats, cookies, or tokens.
  > {Provider} has not approved this, and automated access may conflict with its terms. Any
  > account risk is yours.
- Acknowledging triggers a `settings` refresh for that provider. Disabling a provider does not
  clear its acknowledgement. **Clear local data** clears it.
- Existing installs: not acknowledged after the update (the notice is the point). Their last
  readings stay visible and go stale normally.
- Gemini is status-only and reads nothing from an endpoint, so it has no gate.

### 4. PRD amendments

- Section 11 "Architecture constraints": add that MeterBar reads usage only through the browser's
  own session to the provider's page origin, and never uses CLI/desktop OAuth credentials,
  synthetic inference requests to read rate-limit headers, page/DOM scraping, or chat-stream
  interception.
- Section 6.8 Settings: add background refresh (off by default) and per-provider acknowledgement.
- Section 13 metric "Fresh usage displayed within 10 minutes of a relevant provider update" becomes
  "... while the user has a provider tab or a MeterBar surface open, or has turned on background
  refresh."

## UI (pending design choice)

Per the maintainer's workflow, the Settings layout for the background-refresh toggle, and the
presentation of the notice (inline in Options vs a card action in popup/side panel vs a first-run
page), are decided from 2-3 rendered options **before** any UI code. This spec fixes behavior
only.

## Testing

- Node-env unit tests: `parseRetryAfter` (seconds, HTTP-date, garbage, clamp), `shouldFetch`
  (every reason x throttle x backoff x acknowledged x enabled), `usage:refresh` reason validation,
  settings migration defaults.
- `refresh.ts` tests: 429 with and without `Retry-After` stores `backoffUntil` and the timed copy;
  unacknowledged provider makes zero fetches.
- Manual QA (`docs/manual-qa.md`): with background refresh off, no network requests to provider
  origins for 30 min with Chrome idle; opening a claude.ai tab fetches Claude only; notice blocks
  the first fetch.
