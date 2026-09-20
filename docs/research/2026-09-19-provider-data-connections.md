# Provider data connection audit

Date: 2026-09-19

Reference: [Javis603/token-monitor](https://github.com/Javis603/token-monitor)

## Conclusion

MeterBar and Token Monitor overlap on structured, undocumented provider usage endpoints, but they operate in different environments. MeterBar reads the browser's active provider sessions. Token Monitor is a desktop collector that can also read CLI credential files, invoke local processes, and use app-server RPCs.

The safest direction for MeterBar is to retain browser-session collection for Claude and ChatGPT/Codex, harden account selection and network behavior, and keep Gemini status-only. Importing Token Monitor's desktop credential or Antigravity collectors would broaden secret access without producing a more trustworthy consumer Gemini reading.

## Claude

### Confirmed behavior

MeterBar uses the same Claude Web data path supported by Token Monitor:

1. `GET https://claude.ai/api/organizations`
2. `GET https://claude.ai/api/organizations/{uuid}/usage`

MeterBar sends the browser session cookie through `credentials: include`, does not read the raw cookie, and stores only parsed usage snapshots. See `src/background/refresh.ts` and `src/providers/claude/claudeAdapter.ts`.

Token Monitor additionally supports Claude Code OAuth through:

- `https://api.anthropic.com/api/oauth/usage`
- `https://api.anthropic.com/api/oauth/profile`
- `https://console.anthropic.com/v1/oauth/token`

It obtains those credentials from CLI configuration, environment variables, Windows Credential Manager, or macOS Keychain. See [Token Monitor Claude limits](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/claude/limits.js).

Anthropic documents Claude CLI authentication as local, workspace-bound authentication: [Claude CLI authentication](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/authentication).

### Decision

Keep Claude Web session acquisition in the extension. Do not add Claude Code credential access to the browser extension or to the current display-only native companion.

Organization selection now prefers a chat-capable organization, then a non-API-only organization, before falling back to the first valid organization. This matches the reference's safer behavior for multi-organization accounts.

## ChatGPT and Codex

### Confirmed behavior

MeterBar performs this browser-session flow:

1. `GET https://chatgpt.com/api/auth/session` to obtain a short-lived access token.
2. `GET https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27` to resolve the default account.
3. `GET https://chatgpt.com/backend-api/wham/usage` with the Bearer token and `ChatGPT-Account-Id` header.

The token and account ID are request-only values and are not persisted. See `src/background/refresh.ts` and `src/providers/chatgpt/chatgptAdapter.ts`.

Token Monitor uses the same `/wham/usage` family, but reads Codex CLI OAuth credentials from `~/.codex/auth.json` or `$CODEX_HOME/auth.json`. It can also use the Codex app-server as a fallback. See [Token Monitor Codex limits](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/codex/limits.js) and [Token Monitor Codex auth](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/codex/auth.js).

OpenAI documents Codex CLI as a local terminal workflow with ChatGPT sign-in: [Codex CLI and Sign in with ChatGPT](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt).

### Decision

Keep the session-to-Bearer flow. Do not read Codex CLI credentials or spawn the app-server from MeterBar.

Account selection now explicitly prefers the `default` account returned by the accounts endpoint instead of relying on object iteration order. Parsing continues to use `limit_window_seconds`, so it does not assume that the primary window is always five hours.

## Gemini

### Confirmed behavior

MeterBar checks only a non-content sign-in marker on `gemini.google.com` and reports connected or not connected. It does not publish a usage percentage.

Token Monitor's Google integration is for Antigravity, not the consumer Gemini Apps subscription. It uses a local language-server RPC, optional Google OAuth, Cloud Code endpoints, and Antigravity local data. See:

- [Token Monitor Antigravity limits](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/antigravity/limits.js)
- [Token Monitor Antigravity OAuth](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/antigravity/oauth.js)
- [Token Monitor Antigravity probe](https://github.com/Javis603/token-monitor/blob/main/src/shared/providers/antigravity/probe.js)

Google states that Gemini Apps limits depend on model, prompt complexity, file size, conversation length, and capacity, and may change: [Gemini Apps limits](https://support.google.com/gemini/answer/16275805?hl=en).

### Decision

Keep Gemini status-only. Antigravity quota data must not be labeled as consumer Gemini usage. Do not scrape conversations, call the fragile consumer `batchexecute` RPC, or infer a percentage from plan limits.

## Reliability hardening completed in this branch

- Added a 15-second `AbortController` timeout to every provider session request.
- Serialized refresh cycles and coalesced concurrent requests into one follow-up run, preventing older responses from overwriting newer manual refreshes.
- Retained last-good snapshots after transient failures but marked them stale immediately.
- Cleared old snapshots after an authentication failure so signed-out data cannot appear live.
- Improved Claude organization selection for multi-organization accounts.
- Made ChatGPT account selection prefer the explicit default account.
- Added focused tests for timeout signals, stale preservation, sign-out clearing, refresh coalescing, and provider selection.

## Remaining risks and follow-up

- Claude Web and ChatGPT `/backend-api` endpoints are undocumented and can drift.
- No live authenticated provider request was made during this audit. The existing sanitized fixtures remain the parser evidence.
- Consider one bounded retry for network errors and selected 502/503/504 responses. Do not immediately retry 429 responses without honoring `Retry-After`.
- Keep endpoint-shape fixtures current when providers change their payloads.
- The optional Omarchy companion remains display-only. Any future local CLI credential collector requires a separate privacy and permission design review.
