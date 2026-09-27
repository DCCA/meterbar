# Usage-tracker landscape and Terms of Service handling

Date: 2026-09-27

Question: how do comparable open-source AI usage-limit trackers collect usage data, how do they handle Terms of Service (ToS) risk, and should MeterBar change its collection method before the repository goes public?

This is engineering research, not legal advice. Every repository link below is pinned to the commit that was read on 2026-09-27.

## Conclusion

No provider documents or sanctions a third-party way to read **consumer subscription** usage limits (Claude Pro/Max, ChatGPT Plus/Pro, Gemini Apps). The only documented surfaces are inside the providers' own clients: Claude Code's status line `rate_limits` JSON and `/usage` screen, and the Codex CLI `/status` view plus its app-server `account/rateLimits/read` method. The documented usage APIs (Anthropic Usage & Cost Admin API, OpenAI Usage API) cover API-billed organizations only and cannot see a personal subscription.

Every surveyed tool that shows live subscription percentages therefore uses an undocumented endpoint, through one of three credentials:

1. **Browser session** (claude.ai cookie, chatgpt.com session) - lugia19's Claude Usage Tracker extension, mrpesho's Claude Usage Monitor extension, CodexBar's Web mode, hamed-elfayome's Claude Usage Tracker. These call the same `claude.ai/api/organizations/{uuid}/usage` endpoint MeterBar calls.
2. **CLI OAuth credentials** (`~/.claude/.credentials.json`, macOS Keychain, `~/.codex/auth.json`) - CodexBar (default), Token Monitor, Claude-Code-Usage-Monitor (opt-in), Claude Usage Tracker.
3. **Local logs only** (no network, no credentials) - ccusage and the default mode of Claude-Code-Usage-Monitor. These estimate token spend; they cannot see the provider's authoritative percentage.

Handling of ToS risk across the field is disclaimers, not avoidance. No project has received a takedown, endpoint-specific block, or confirmed ban for reading usage. The one public suspension report (CodexBar #2366) involved CLI OAuth and CLI-probe paths, was framed by the reporter as correlation only, and was closed by the maintainer, who cited a large user base with no other reports. The only provider-side interference observed repeatedly is Cloudflare challenges on `claude.ai` from datacenter/VPN IPs, which hits every browser-session tool equally.

Anthropic's actual enforcement in 2026 targeted **subscription OAuth used for inference by third-party harnesses** (OpenClaw, OpenCode and similar), and its Claude Code legal page now states that OAuth is for "Claude Code and other native Anthropic applications" and that developers "may not collect, store, or intermediate Claude.ai credentials or session tokens". That makes CLI-OAuth readers the most exposed category. MeterBar's browser-session design is the lower-risk choice: the browser attaches the cookie itself and MeterBar never reads, stores, or forwards it.

MeterBar should **keep its collection method** and should **not** add CLI OAuth, response-header probing, or DOM scraping. The main lever it controls is the **trigger model**: an unattended 10-minute background poll is the part that most clearly reads as "automated or non-human" access. The recommendation is to make background polling an explicit opt-in (default off), refresh on user action and on provider-tab presence, honor `429`/`Retry-After`, and keep the README disclaimer. Chrome Web Store publication is possible (two comparable extensions are listed there) but moves ToS responsibility onto the publisher; a public GitHub repo with unpacked install is the lower-exposure first step.

## Provider terms and documented surfaces

### Anthropic

- Consumer Terms (effective 2025-10-08), section 3, forbid access "through automated or non-human means, whether through a bot, script, or otherwise" except via an Anthropic API key "or where we otherwise explicitly permit it", and forbid crawling, scraping, or harvesting data. [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)
- Claude Code legal and compliance page: "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications." Developers "should use API key authentication", and "developers may not collect, store, or intermediate Claude.ai credentials or session tokens". "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice." [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- Documented subscription usage surface: the status line receives `rate_limits.five_hour.used_percentage`, `rate_limits.seven_day.used_percentage`, and matching `resets_at` fields, present "only for claude.ai Pro and Max subscribers ... and only after the first API response in the session". [Status line docs](https://code.claude.com/docs/en/statusline)
- `/usage` in Claude Code shows plan usage bars. Anthropic's docs acknowledge the backing request is rate limited: "When the request for your plan limits fails, most often because the usage endpoint is rate limited, `/usage` shows the last usage bars it loaded ... within the past 60 minutes". The endpoint URL is not documented. [Manage costs](https://code.claude.com/docs/en/costs)
- `api.anthropic.com/api/oauth/usage` is used by third parties (see CodexBar and Claude-Code-Usage-Monitor below) but is not in Anthropic's public docs. Users report persistent 429s from it: [anthropics/claude-code#30930](https://github.com/anthropics/claude-code/issues/30930). Feature requests for a subscription usage API were auto-closed without an Anthropic response: [#69356](https://github.com/anthropics/claude-code/issues/69356), [#81768](https://github.com/anthropics/claude-code/issues/81768).
- The Usage & Cost Admin API (`/v1/organizations/usage_report/messages`, `/v1/organizations/cost_report`) requires an Admin API key, "is unavailable for individual accounts", and reports Console API usage, not subscription limits. Recommended polling is once per minute. [Usage and Cost API](https://platform.claude.com/docs/en/build-with-claude/usage-cost-api)
- 2026 enforcement against third-party use of subscription OAuth for inference (January server-side blocks, April 4 cutoff starting with OpenClaw) is reported in secondary press, for example [VentureBeat](https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and). The primary announcement (an X post) was **not verified** here. None of the reports mention usage-only readers.

### OpenAI

- Terms of Use forbid "automatically or programmatically extract data or Output" (clause already verified by the maintainer; the page returned HTTP 403 to automated fetches during this research). [Terms of Use](https://openai.com/policies/row-terms-of-use/)
- OpenAI's own Codex client, which is open source (Apache-2.0), reads subscription limits from `GET {base}/wham/usage` ([`rate_limit_resets.rs` L124-L128](https://github.com/openai/codex/blob/41f9084b30812db321a0b592def4f500d1e79cf4/codex-rs/backend-client/src/client/rate_limit_resets.rs#L124-L128)) and from `x-codex-primary-used-percent` / `x-codex-secondary-used-percent` response headers on normal turns ([`rate_limits.rs` L57-L80](https://github.com/openai/codex/blob/41f9084b30812db321a0b592def4f500d1e79cf4/codex-rs/codex-api/src/rate_limits.rs#L57-L80)). The app-server protocol publishes `account/rateLimits/read` and an `account/rateLimits/updated` notification ([`common.rs` L1309](https://github.com/openai/codex/blob/41f9084b30812db321a0b592def4f500d1e79cf4/codex-rs/app-server-protocol/src/protocol/common.rs#L1309), [L1984](https://github.com/openai/codex/blob/41f9084b30812db321a0b592def4f500d1e79cf4/codex-rs/app-server-protocol/src/protocol/common.rs#L1984)). This is the closest thing to a sanctioned programmatic interface, but it lives inside the Codex app-server, not on the web, and its use by third-party UIs is not explicitly addressed by OpenAI.
- The OpenAI Usage API (`/v1/organization/usage/completions` etc.) needs an Admin API key created by an organization owner and covers API platform usage only. [Usage API reference](https://platform.openai.com/docs/api-reference/usage/completions), [Admin APIs guide](https://developers.openai.com/api/docs/guides/admin-apis)

### Google

- No consumer Gemini Apps usage endpoint exists. MeterBar's status-only Gemini design is unchanged by this survey; CodexBar and Token Monitor read **Gemini CLI / Antigravity** quotas through Google OAuth, which is a different product (see the [2026-09-19 audit](2026-09-19-provider-data-connections.md)).

### Chrome Web Store

- The Developer Agreement section 4.6: "You agree that you are solely responsible for ... any breach of your obligations under this Agreement, any applicable third party contract or terms of service". [CWS Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms)

## Projects surveyed

Stars and activity from the GitHub API on 2026-09-27.

### CodexBar (steipete/CodexBar)

~22.0k stars, pushed 2026-09-27. macOS menu bar app (plus CLI and Linux build) covering 50+ providers. Pinned at [`1fc12cd`](https://github.com/steipete/CodexBar/tree/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80).

- **Claude data sources** ([`docs/claude.md`](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/claude.md)): app default order is OAuth API -> CLI PTY -> Web API. OAuth calls `GET https://api.anthropic.com/api/oauth/usage` with `anthropic-beta: oauth-2025-04-20`, reading tokens from CodexBar's Keychain cache, `~/.claude/.credentials.json`, or the `Claude Code-credentials` Keychain item ([L121-L145](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/claude.md#L121-L145)). Web mode decrypts browser cookie stores (Safari, Chrome, Firefox) to get `sessionKey`, caches it in the Keychain, and calls `claude.ai/api/organizations`, `/usage`, `/overage_spend_limit`, `/prepaid/credits`, and `/api/account` ([L189-L226](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/claude.md#L189-L226)). An Admin API key path uses the documented cost/usage report endpoints.
- **Codex**: reads `~/.codex/auth.json` and calls `chatgpt.com/backend-api/wham/usage` with the Bearer token ([`docs/codex.md` L30-L35](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/codex.md#L30-L35)); optional "web extras" load `chatgpt.com` in a hidden WebView and scrape the analytics page ([L118-L123](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/codex.md#L118-L123)).
- **Trigger**: background timer. Choices Manual, 1/2/5/15/30 min, or Adaptive (2-30 min based on menu-open recency, Low Power Mode, optional agent activity). Adaptive is the fresh-install default; older installs fall back to 5 min ([`docs/refresh-loop.md` L9-L52](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/docs/refresh-loop.md#L9-L52)).
- **Credentials touched**: browser cookie databases (needs browser Safe Storage Keychain item, optionally Full Disk Access for Safari), Claude Code Keychain item, `~/.codex/auth.json`, API keys in `~/.codexbar/config.json` ([README L206-L220](https://github.com/steipete/CodexBar/blob/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80/README.md#L206-L220)).
- **ToS stance**: no ToS disclaimer for Claude/OpenAI in the README; the README calls the app "privacy-first" because it reuses existing sessions and stores no passwords.
- **Provider action**:
  - [#2366](https://github.com/steipete/CodexBar/issues/2366): a user's Claude account was suspended about half a day after running CodexBar (Auto source, 5-minute refresh), explicitly reported as "a temporal correlation report, not a claim of proven causation". An automated triage bot recommended gating OAuth behind informed consent. The owner closed it: "this is the only suspension report we have received. If CodexBar's polling pattern were the trigger, we would expect to see this at scale."
  - [#2251](https://github.com/steipete/CodexBar/issues/2251): the Claude CLI probe created a new empty account-side session per probe (fixed in PR #2263), a real provider-visible side effect of automated probing.
  - [#1679](https://github.com/steipete/CodexBar/issues/1679), [#575](https://github.com/steipete/CodexBar/issues/575): `oauth/usage` 429 rate limiting; CodexBar added a 5-minute cooldown gate.
  - [#3367](https://github.com/steipete/CodexBar/issues/3367): Cloudflare `403 cf-mitigated: challenge` on `claude.ai/api/organizations` from a datacenter VPN, while `api.anthropic.com/api/oauth/usage` still returned 200.
  - [#2733](https://github.com/steipete/CodexBar/issues/2733): owner approved an opt-in source reading Claude Code's status line `rate_limits` JSON ("data Claude Code actively publishes for consumers to render - reading it doesn't cross the credential-ownership boundary"); it was merged in #2769 and then reverted in #3006 the same day because the feed lacks account identity and only updates while a Claude Code session is active.

### lugia19 Claude Usage Tracker (lugia19/Claude-Usage-Extension)

~440 stars, pushed 2026-09-27. MV3 browser extension for Chrome, Firefox, and an Electron wrapper; listed on the [Chrome Web Store](https://chromewebstore.google.com/detail/claude-usage-tracker/knemcdpkggnbhpoaaagmjiigenifejfo) and [AMO](https://addons.mozilla.org/firefox/addon/claude-usage-tracker). This is MeterBar's closest analog. Pinned at [`a12e409`](https://github.com/lugia19/Claude-Usage-Extension/tree/a12e4090698a50819a6074fd222b451f6eca3090).

- **Data source**: browser session. Calls `claude.ai/api/organizations/{org}/usage` ([`bg-components/claude-api.js` L281-L283](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/bg-components/claude-api.js#L281-L283)), and a MAIN-world script reads the `message_limit` event out of the completion SSE stream ([`injections/usage-sse-watcher.js` L1-L80](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/injections/usage-sse-watcher.js#L1-L80)). It also reads conversation content to estimate token length and cost.
- **Trigger**: event-driven (message send, conversation load) plus a 3-minute `checkResetNotifications` alarm that only refreshes orgs for **open claude.ai tabs** ([`background.js` L164-L181](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/background.js#L164-L181), [L1280-L1284](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/background.js#L1280-L1284), [L298-L320](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/background.js#L298-L320)). With no claude.ai tab open it makes no usage requests.
- **Credentials**: never reads the cookie for Chrome; requests go out with the tab's session. Permissions include `cookies`, `webRequest`, `tabs`, and hosts `api.anthropic.com`, `github.com`, `raw.githubusercontent.com` ([`manifest_chrome.json` L71-L85](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/manifest_chrome.json#L71-L85)). An optional user Anthropic API key is used for token counting.
- **ToS stance**: none stated. Privacy policy still says it syncs org ID and usage via Firebase ([`PRIVACY.md`](https://github.com/lugia19/Claude-Usage-Extension/blob/a12e4090698a50819a6074fd222b451f6eca3090/PRIVACY.md)); whether Firebase is still used in current code is **unverified** (no Firebase reference found in the non-vendored JS).
- **Provider action**: none found. Issue searches for ban, suspended, blocked, 403, Cloudflare returned only breakage from UI or API shape changes (for example [#72](https://github.com/lugia19/Claude-Usage-Extension/issues/72), [#83](https://github.com/lugia19/Claude-Usage-Extension/issues/83)).

### mrpesho Claude Usage Monitor (mrpesho/claude-usage-monitor)

2 stars, pushed 2026-09-07, but listed on the [Chrome Web Store](https://chromewebstore.google.com/detail/claude-usage-monitor/ieengjioikahclfklclkjgfobgmnndee) and AMO. Architecturally almost identical to MeterBar's Claude path. Pinned at [`c3957b4`](https://github.com/mrpesho/claude-usage-monitor/blob/c3957b41bf33e5198401ace94959d67844f71236/README.md).

- **Data source**: `/api/bootstrap` for org ID, then `/api/organizations/{orgId}/usage` with the browser session (README L76-L79).
- **Trigger**: background auto-refresh, configurable 2-30 min, with exponential backoff on 429 (README L33).
- **ToS stance**: the most explicit in the survey: "Unofficial & Experimental", "not affiliated with, endorsed by, or supported by Anthropic", "Use at your own risk", and a link to Anthropic's Consumer Terms (README L3, L11, L104-L108). It also claims "Anthropic has clarified that they cannot officially endorse the use of internal API endpoints in third-party applications" (L17); no source is given and this is **unverified**.
- **Provider action**: none found (repository has no issues).

### Claude Usage Tracker (hamed-elfayome/Claude-Usage-Tracker)

~3.6k stars, pushed 2026-08-31. Native macOS menu bar app, now also Codex. Pinned at [`588775e`](https://github.com/hamed-elfayome/Claude-Usage-Tracker/tree/588775e4540757443691fa1bcb33457315e05f86).

- **Data sources**: (a) claude.ai `sessionKey` cookie, pasted manually or captured by an embedded browser sign-in, then `claude.ai/api/organizations/{id}/usage`; (b) Claude Code CLI OAuth. For (b) the code comments say the `api.anthropic.com/api/oauth/usage` path "is disabled" and instead it sends a real `POST /v1/messages` ("cheapest model, 1 token", prompt "hi") and parses `anthropic-ratelimit-unified-5h-utilization` / `-7d-utilization` response headers ([`ClaudeAPIService.swift` L544-L566](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/588775e4540757443691fa1bcb33457315e05f86/Claude%20Usage/Shared/Services/ClaudeAPIService.swift#L544-L566), [L967-L995](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/588775e4540757443691fa1bcb33457315e05f86/Claude%20Usage/Shared/Services/ClaudeAPIService.swift#L967-L995)). That probe consumes subscription quota and is third-party inference over subscription OAuth, which is the pattern Anthropic's legal page restricts.
- **Trigger**: background polling, per-profile interval 5-300 s, default 30 s ([`Profile.swift` L100](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/588775e4540757443691fa1bcb33457315e05f86/Claude%20Usage/Shared/Models/Profile.swift#L100)).
- **Credentials**: session keys, API keys, and CLI OAuth tokens in the macOS Keychain after a plaintext-storage advisory ([GHSA-mfxh-xpwm-23c7 / #267](https://github.com/hamed-elfayome/Claude-Usage-Tracker/issues/267)); it also writes refreshed CLI tokens back ([README L342](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/588775e4540757443691fa1bcb33457315e05f86/README.md#L342)). Sends a version-only analytics heartbeat ([README L46](https://github.com/hamed-elfayome/Claude-Usage-Tracker/blob/588775e4540757443691fa1bcb33457315e05f86/README.md#L46)).
- **ToS stance**: none found in the README.
- **Provider action**: none found. Cloudflare challenge breakage is recurring ([#277](https://github.com/hamed-elfayome/Claude-Usage-Tracker/issues/277), [#319](https://github.com/hamed-elfayome/Claude-Usage-Tracker/issues/319)).

### Token Monitor (Javis603/token-monitor)

~2.4k stars, pushed 2026-09-27. Electron desktop collector. Covered in depth in the [2026-09-19 audit](2026-09-19-provider-data-connections.md). Pinned at [`95c819e`](https://github.com/Javis603/token-monitor/tree/95c819eaa87065e4467f4e8296bf82b4790e41df).

- **Data sources**: local logs for dozens of CLIs, plus Claude via `oauth/usage` (CLI credentials from config, env, Keychain, or Windows Credential Manager) or claude.ai web, and Codex via `~/.codex/auth.json` -> `wham/usage` or the Codex app-server.
- **Trigger**: background, default 5 min, fixed or adaptive ([`src/shared/limits/core.js` L6](https://github.com/Javis603/token-monitor/blob/95c819eaa87065e4467f4e8296bf82b4790e41df/src/shared/limits/core.js#L6)).
- **ToS stance**: privacy statement only ([README L300-L302](https://github.com/Javis603/token-monitor/blob/95c819eaa87065e4467f4e8296bf82b4790e41df/README.md#L300-L302)); no ToS disclaimer.
- **Provider action**: none found.

### Claude-Code-Usage-Monitor (Maciek-roboblog/Claude-Code-Usage-Monitor)

~8.7k stars, pushed 2026-07-05. Python terminal monitor. Pinned at [`c59a83b`](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/tree/c59a83bf943f329f0e61f1a29c760353ee1860a5).

- **Data sources**, ranked by an explicit provenance model (`official`, `local_estimate`, `experimental`, `unknown`) ([README L9-L56](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/blob/c59a83bf943f329f0e61f1a29c760353ee1860a5/README.md#L9-L56)):
  1. Claude Code status line `rate_limits` captured via `--statusline` hook, labeled **official**.
  2. Local `~/.claude/projects/*.jsonl` logs, labeled local estimate ([`reader.py` L37](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/blob/c59a83bf943f329f0e61f1a29c760353ee1860a5/src/claude_monitor/data/reader.py#L37)).
  3. `api.anthropic.com/api/oauth/usage`, **opt-in only** behind `--api`, labeled experimental: "This endpoint is undocumented, so callers must opt in ... never outranks fresh official statusline limits" ([`api_usage.py` L1-L28](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/blob/c59a83bf943f329f0e61f1a29c760353ee1860a5/src/claude_monitor/output/api_usage.py#L1-L28), [README L194](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/blob/c59a83bf943f329f0e61f1a29c760353ee1860a5/README.md#L194)).
- **Trigger**: local file re-read every 10 s by default; no network in the default mode.
- **Provider action**: none found.
- This is the clearest precedent for MeterBar's truthful-confidence rule: undocumented network data is opt-in and ranked below the documented feed.

### ccusage (ccusage/ccusage, formerly ryoppippi/ccusage)

~18.8k stars, pushed 2026-09-27. CLI. Pinned at [`db400ad`](https://github.com/ccusage/ccusage/tree/db400ad4c8fab7a43a7d2cb8e18665e21ca24639). `ryoppippi/ccusage` now resolves to this organization repo.

- **Data source**: "Analyze coding (agent) CLI token usage and costs from local data" ([README L24](https://github.com/ccusage/ccusage/blob/db400ad4c8fab7a43a7d2cb8e18665e21ca24639/README.md#L24)); for Claude, `~/.config/claude/projects/` and `~/.claude/projects/` ([`docs/guide/claude/index.md` L25-L30](https://github.com/ccusage/ccusage/blob/db400ad4c8fab7a43a7d2cb8e18665e21ca24639/docs/guide/claude/index.md#L25-L30)). The only network access is fetching model pricing, disabled with `--offline`. No provider credentials and no provider usage endpoints (no `oauth/usage`, `api/organizations`, or `wham` references in the tree; `chatgpt.com` appears only in documentation links).
- **Trigger**: on demand; `statusline` subcommand runs when Claude Code invokes it.
- **Limitation**: reports estimated tokens and API-equivalent cost, not the plan's authoritative percentage used.
- **Provider action**: none; no ToS exposure beyond reading the user's own files.

### Other projects found (not deep-dived)

GitHub search "claude usage" and "codex usage limits" (sorted by stars) surfaced mostly menu bar and widget apps using the same two paths: `phuryn/claude-usage` (~2.2k stars, local logs dashboard), `Blimp-Labs/claude-usage-bar` (477), `f-is-h/Usage4Claude` (399, Claude/Codex menu bar), `Artzainnn/ClaudeUsageBar` (335), `SlavomirDurej/claude-usage-widget` (325), plus many small Chrome extensions such as `cfranci/claude-usage-extension`. Their data sources were not individually verified.

## Comparison

| Project | Form | Subscription % source | Credentials touched | Trigger | ToS disclaimer | Provider action found |
|---|---|---|---|---|---|---|
| **MeterBar** (today) | MV3 extension | claude.ai `/usage`, chatgpt.com `wham/usage` via browser session | Browser attaches cookie; ChatGPT access token held in memory per request | Background alarm, 10 min | Yes (README) | n/a |
| CodexBar | macOS app | `oauth/usage` (default), claude.ai web, CLI PTY; Codex `wham/usage` via `auth.json` | Browser cookie DBs, Keychain, `~/.claude`, `~/.codex/auth.json` | Background, Adaptive 2-30 min | No | 1 suspension report (unproven), 429s, Cloudflare |
| lugia19 Claude Usage Tracker | MV3 extension (CWS, AMO) | claude.ai `/usage` + completion SSE | Browser session; optional API key | Events + 3 min only while claude.ai tab open | No | None |
| mrpesho Claude Usage Monitor | MV3 extension (CWS, AMO) | claude.ai `/usage` | Browser session | Background, 2-30 min, 429 backoff | Yes, explicit | None |
| Claude Usage Tracker (hamed) | macOS app | claude.ai `/usage` via pasted `sessionKey`; OAuth header probe (sends 1-token message) | `sessionKey`, CLI OAuth tokens (Keychain), writes tokens back | Background, default 30 s | No | None; Cloudflare breakage |
| Token Monitor | Electron app | `oauth/usage`, claude.ai web, `wham/usage` via `auth.json`, app-server | CLI creds, Keychain, Credential Manager | Background, default 5 min | No | None |
| Claude-Code-Usage-Monitor | Python TUI | Status line `rate_limits` (official); `oauth/usage` opt-in | Reads `~/.claude/.credentials.json` only with `--api` | Local 10 s re-read; network opt-in | Labels undocumented data "experimental" | None |
| ccusage | CLI | None (local token estimates only) | None | On demand | n/a | None |
| Claude Code `/usage`, status line | First party | Undocumented internal endpoint; `rate_limits` is documented | Own OAuth | On demand; status line per response | n/a | n/a |
| Codex `/status`, app-server | First party (open source) | `wham/usage`, `x-codex-*` headers, `account/rateLimits/read` | Own OAuth | On demand and per turn | n/a | n/a |

## Options for MeterBar

| Option | ToS position | Fit with MeterBar constraints | Verdict |
|---|---|---|---|
| Keep browser-session reads, background 10-min poll (today) | Undocumented endpoint, unattended "automated" access; same as mrpesho, CodexBar Web | Fits all constraints | Acceptable but the most "bot-like" part |
| Browser-session reads, **on demand + tab-presence**, background polling opt-in | Still undocumented, but each request follows a user action or an active provider session; closest to lugia19 | Fits all constraints; badge can go stale when idle, which `stale` already reports truthfully | **Recommended** |
| CLI OAuth credentials (`oauth/usage`, `auth.json`) | Anthropic's legal page reserves OAuth for native apps and bars intermediating tokens; the only suspension report involves this path | Broadens secret access; not reachable from an MV3 extension without the native host | Reject |
| Response-header probe (`anthropic-ratelimit-unified-*`) | Requires sending a model request with subscription credentials from a third-party app; consumes quota | Would need to send a prompt; violates spirit of "no chat" and least privilege | Reject |
| DOM scraping of settings/usage pages | Explicitly "scrape" under both Anthropic and OpenAI terms; brittle | Requires broad content scripts | Reject |
| Passive observation of the user's own claude.ai traffic (SSE `message_limit`, as lugia19 does) | No extra requests at all | Needs MAIN-world injection into chat traffic, which is adjacent to chat content; conflicts with the "never collect chat content" posture | Not recommended |
| Local CLI logs (ccusage style) | No provider access | Extension cannot read the filesystem; would live in the native companion; yields estimates, not plan % | Out of scope for the extension |
| Official feeds via companion: Claude Code status line `rate_limits`, Codex app-server `account/rateLimits/read` | Documented or first-party-published data | Needs a companion collector, which the 2026-09-19 audit deferred; only updates while those CLIs run; no identity (CodexBar reverted for this reason) | Possible later, opt-in, separate design review |
| Admin/Usage APIs (Anthropic, OpenAI) | Fully sanctioned | Cannot see consumer subscriptions | Not applicable |

## Recommendation

1. **Keep the collection method.** Browser-session reads of `claude.ai/api/organizations/{uuid}/usage` and `chatgpt.com/backend-api/wham/usage` are what every comparable browser tool uses, expose the fewest secrets (MeterBar never reads or stores the Claude cookie), and are the same endpoints the providers' own clients call. No surveyed project has faced provider action for this path.
2. **Change the trigger model (main change).** Make unattended background polling an explicit opt-in setting, default off. By default, refresh when the user opens the popup or side panel, clicks Refresh, and (optionally) when a provider tab is open, as lugia19 does. Keep the alarm only for users who opt in, keep 10 minutes as the floor, and back off on `429` honoring `Retry-After` (already listed as follow-up in the 2026-09-19 audit). This addresses the "automated or non-human means" clause as far as a third-party reader can, at the cost of a staler badge when idle, which the existing `stale` state reports truthfully.
3. **Do not add** CLI OAuth credential reads, the `v1/messages` header probe, DOM scraping, or chat-stream interception. Each is either explicitly restricted by Anthropic's current legal page, consumes quota, or crosses the no-chat-content rule.
4. **Minimize ChatGPT token handling.** MeterBar mints a short-lived access token from `/api/auth/session` and holds it only for the request. Keep it in memory only, never log it, and document this in PRIVACY/README. This is the one place MeterBar handles a bearer token, so it should stay visibly minimal.
5. **Disclosure.** Keep the existing README disclaimer. Add a one-time, per-provider notice in Options when a provider is enabled ("reads your usage from an undocumented endpoint; may conflict with the provider's terms; you can disable it"), mirroring mrpesho's wording and the consent gating recommended in CodexBar #2366. Consider making each provider off until the user enables it.
6. **Distribution.** Making the repository public is low risk: comparable open-source repos with the same calls are public and active. For the Chrome Web Store, precedent exists (lugia19 and mrpesho are listed), but the CWS agreement places ToS breach responsibility on the publisher. Publish on GitHub with unpacked install first, and decide on CWS separately after the trigger-model change lands.
7. **Later, optional:** if the Omarchy companion ever gains a collector, the documented Claude Code status line `rate_limits` feed is the only Anthropic-documented subscription usage source; it would warrant a higher confidence label than `inferred`, but it lacks identity and only updates during active Claude Code sessions. Treat it as a separate product decision.

What remains uncertain: whether Anthropic or OpenAI treat low-frequency, read-only usage reads as prohibited automation is not stated anywhere. The absence of enforcement reports is weak evidence, not permission.

## Sources

Provider and platform documents:

- Anthropic Consumer Terms: https://www.anthropic.com/legal/consumer-terms
- Claude Code legal and compliance: https://code.claude.com/docs/en/legal-and-compliance
- Claude Code status line: https://code.claude.com/docs/en/statusline
- Claude Code manage costs (`/usage`): https://code.claude.com/docs/en/costs
- Anthropic Usage and Cost API: https://platform.claude.com/docs/en/build-with-claude/usage-cost-api
- OpenAI Terms of Use: https://openai.com/policies/row-terms-of-use/
- OpenAI Usage API reference: https://platform.openai.com/docs/api-reference/usage/completions
- OpenAI Admin APIs guide: https://developers.openai.com/api/docs/guides/admin-apis
- Chrome Web Store Developer Agreement: https://developer.chrome.com/docs/webstore/program-policies/terms
- openai/codex at `41f9084`: https://github.com/openai/codex/tree/41f9084b30812db321a0b592def4f500d1e79cf4
- Secondary: VentureBeat on Anthropic's April 2026 cutoff for third-party harnesses: https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and

Surveyed repositories (pinned):

- CodexBar: https://github.com/steipete/CodexBar/tree/1fc12cdf73b53d20d56c6c8df6bf010d3df84a80
- lugia19 Claude Usage Tracker: https://github.com/lugia19/Claude-Usage-Extension/tree/a12e4090698a50819a6074fd222b451f6eca3090
- mrpesho Claude Usage Monitor: https://github.com/mrpesho/claude-usage-monitor/tree/c3957b41bf33e5198401ace94959d67844f71236
- Claude Usage Tracker (hamed-elfayome): https://github.com/hamed-elfayome/Claude-Usage-Tracker/tree/588775e4540757443691fa1bcb33457315e05f86
- Token Monitor: https://github.com/Javis603/token-monitor/tree/95c819eaa87065e4467f4e8296bf82b4790e41df
- Claude-Code-Usage-Monitor: https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor/tree/c59a83bf943f329f0e61f1a29c760353ee1860a5
- ccusage: https://github.com/ccusage/ccusage/tree/db400ad4c8fab7a43a7d2cb8e18665e21ca24639

Issue threads:

- CodexBar #2366 (suspension report): https://github.com/steipete/CodexBar/issues/2366
- CodexBar #2251 (CLI probe session pollution): https://github.com/steipete/CodexBar/issues/2251
- CodexBar #1679 and #575 (`oauth/usage` 429): https://github.com/steipete/CodexBar/issues/1679, https://github.com/steipete/CodexBar/issues/575
- CodexBar #3367 (Cloudflare challenge): https://github.com/steipete/CodexBar/issues/3367
- CodexBar #2733 (status line feed ruling, merged then reverted): https://github.com/steipete/CodexBar/issues/2733
- anthropics/claude-code #30930 (`oauth/usage` 429): https://github.com/anthropics/claude-code/issues/30930
- anthropics/claude-code #69356 and #81768 (subscription usage API requests): https://github.com/anthropics/claude-code/issues/69356, https://github.com/anthropics/claude-code/issues/81768
- Claude Usage Tracker #267 (credential storage advisory): https://github.com/hamed-elfayome/Claude-Usage-Tracker/issues/267
