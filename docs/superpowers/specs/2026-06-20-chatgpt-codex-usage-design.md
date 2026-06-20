# ChatGPT / Codex live usage — design

**Date:** 2026-06-20
**Status:** approved design, pending implementation plan
**Related:** mirrors the Claude live-usage adapter (`feat/claude-live-usage-endpoint`, merged as PR #2)

## Goal

Promote the ChatGPT/Codex provider from a content-script stub (`collect: () => null`) to a
real adapter that surfaces live usage in the badge + popup. Both the account-wide ChatGPT
usage **and** Codex usage come from one clean endpoint, so both ship at full confidence.

## Source

A single endpoint returns everything:

```
GET https://chatgpt.com/backend-api/wham/usage
```

Validated against a live logged-in session (2026-06-20). Shape (trimmed/sanitized):

```jsonc
{
  "plan_type": "prolite",
  "rate_limit": {                          // account-wide ChatGPT usage
    "primary_window":   { "used_percent": 27, "limit_window_seconds": 18000,  "reset_at": 1781989386 },  // 5h
    "secondary_window": { "used_percent": 39, "limit_window_seconds": 604800, "reset_at": 1782342911 }   // 7d
  },
  "additional_rate_limits": [              // Codex per-model caps
    { "limit_name": "GPT-5.3-Codex-Spark",
      "rate_limit": { "primary_window": { "used_percent": 0, ... }, "secondary_window": { "used_percent": 0, ... } } }
  ],
  "email": "...", "account_id": "...", "user_id": "...", "credits": { ... }   // ← read NONE of these
}
```

`used_percent` is already 0–100 (no scaling bug, unlike the Claude `utilization` field).
`reset_at` is Unix epoch **seconds**.

## Auth flow (background, mirrors `refreshClaude`)

`wham/usage` returns 401 on cookies alone — it needs a Bearer access token (the web app
mints one from its session). The background worker reproduces that, tab-independently:

1. `GET /api/auth/session` (cookie-authed) → `accessToken`.
2. `GET /backend-api/accounts/check/v4-2023-04-27` (`Authorization: Bearer`) → resolve the
   default `account_id`.
3. `GET /backend-api/wham/usage` (`Authorization: Bearer` + `ChatGPT-Account-Id`) → parse.

The access token and account-id are used **only to make the request** and are never written
to storage. (Step 2 may be skippable if `wham/usage` accepts Bearer without the account-id
header — the plan will confirm and drop it if so.)

## Parsing (pure, tested)

`parseChatgptUsage(payload, now) → UsageSnapshot[]`, provider `chatgpt`, confidence `exact`,
`stale: false`:

- `rate_limit.primary_window`  → `{ window: 'five_hour', usedPercent, resetsAt }`
- `rate_limit.secondary_window` → `{ window: 'seven_day', usedPercent, resetsAt }`
- `additional_rate_limits` → **one** Codex snapshot: the single riskiest window (max
  `used_percent`) across all entries/windows, carrying its own window + reset and
  `workspaceLabel: 'Codex'`. Omitted entirely when `additional_rate_limits` is empty/null.

`reset_at` (epoch seconds) → ISO 8601 for `resetsAt`. All snapshots stay under provider
`chatgpt` (one "ChatGPT / Codex" card with up to three bars). `used_percent` passes straight
through (already a percent); ratio = `used_percent / 100`.

Confidence is `exact`: clean, structured JSON percentages from a usage endpoint, manually
validated against the live response — the same standard applied to Claude. The captured
response is checked in as the parser fixture (the plan's required validation evidence).

## Architecture & boundaries

- **All network I/O in the background worker** (`refreshChatgpt`, alongside `refreshClaude`
  in `src/background/refresh.ts`). The adapter (`src/providers/chatgpt/chatgptAdapter.ts`)
  stays a **pure boundary**: `parseChatgptUsage`, plus pure helpers `pickChatgptAccountId`
  and the URL/selection logic — all unit-testable, no `fetch`.
- HTTP→status mapping consistent with Claude: 401/403/redirect → `not_connected`
  ("Not logged in."); other non-2xx → `stale`; network error → `stale`.
- **Remove the obsolete content-script stub** for ChatGPT (`src/content/chatgpt.ts`, its
  `manifest.json` `content_scripts` entry, and its `vite.config.ts` build entry). Gemini
  keeps its `content` strategy untouched.

## Privacy (PRD invariants)

- Store **only** usage metrics: percentages, reset timestamps, provider name. Never persist
  `email`, `account_id`, `user_id`, `plan_type`, the access token, or cookies.
- `credentials: 'include'` rides the existing session; no secret is read or stored.
- No new permissions: `https://chatgpt.com/*` (covers `/api/auth/session` and
  `/backend-api/*`) is already in `host_permissions`.

## Testing (TDD, node env, no `chrome.*`)

- Parser against the captured live fixture: 5h/7d ChatGPT windows + one Codex bar.
- `reset_at` epoch→ISO conversion.
- Riskiest-Codex-window selection across multiple `additional_rate_limits` entries.
- Empty/null `additional_rate_limits` → no Codex snapshot.
- `pickChatgptAccountId` over the `accounts/check` shape (default account, fallback, null).

## Out of scope

- ChatGPT chat usage via DOM scraping — unnecessary, the endpoint covers it.
- Multi-account selection beyond the default/first account.
- Gemini (separate effort).

## Validation risk

The one empirical unknown (as with Claude) is whether `/api/auth/session` + `wham/usage`
succeed from the **background service worker** context, not just the page console. The plan
includes a load-and-verify step; if the SW can't mint the token, fall back to a content
script on `chatgpt.com` (same-origin), reusing the existing `usage:report` pipeline.
