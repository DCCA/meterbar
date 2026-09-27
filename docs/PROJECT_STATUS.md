# Project status

Session logbook, newest first. Each entry: where the project was, what the session
changed (with evidence), and what is still open.

## 2026-09-27 - Open-source readiness and provider terms-of-service risk

**Where we were:** private repo; PRs #41 (Omarchy bar fix) and #42 (2026-09-26 recap) open.
The user wanted the repo ready to make public, then asked whether our collection method is OK
with the providers.

**What we did:**
- Readiness audit: full git history (all branches) grepped for keys, tokens, JWTs, private keys,
  cookies: none. No captured account ids in fixtures/docs. `manifest.json` `key` is a public key.
- PR #43: CI workflow (`npm ci`, check, build; read-only token, SHA-pinned, fork-safe),
  `SECURITY.md`, README Contributing + corrected badge/Gemini wording, vitest bumped past
  GHSA-82fw-gwwq-j7x9 (`npm audit` 0), local path removed from this file, CI covered by
  `tests/workflowSecurity.test.ts` (mutation-checked). 151 tests; CI green on the PR.
- Terms check: Anthropic Consumer Terms s.3 bans "automated or non-human means ... bot, script";
  OpenAI bans "automatically or programmatically extract data"; Google only restricts
  robots.txt-violating automation. MeterBar's 10-min background alarm is the exposed part.
- PR #44: `docs/research/2026-09-27-usage-tracker-landscape.md` - survey of CodexBar, ccusage,
  Token Monitor, Claude-Code-Usage-Monitor, two Web Store Claude extensions. No sanctioned
  consumer-usage route exists; everyone uses undocumented endpoints plus disclaimers; no
  provider action against a usage reader found; CLI OAuth is the riskiest path.
- PR #45: spec `docs/superpowers/specs/2026-09-27-refresh-policy-and-provider-notice.md`,
  split into issues #46-#51.

**Decisions:** keep the browser-session collection method; change *when* it runs (on user
presence, background polling opt-in). Never add CLI OAuth, header probes, DOM scraping, or
chat-stream reading. Publish the repo now; Chrome Web Store is a separate decision (#51).

**Pending / next:**
- [ ] Merge #44, #45, #43 (the auto-mode guard blocked agent merges; user merges). This PR
      stacks on #42 - merging it lands both entries.
- [ ] Confirm the two spec calls on #45: existing installs migrate to background refresh
      off, and must acknowledge each provider before new readings.
- [ ] Make the repo public, then `gh api -X PUT repos/DCCA/meterbar/private-vulnerability-reporting`
      (404s while private).
- [ ] Delete `claude/great-albattani-82r7an` (merged; the guard blocked the agent). Decide on
      closed-unmerged `docs/session-status-2026-08-23` and `fix/openai-dynamic-usage-windows`.
- [ ] Build order: #47 (Retry-After backoff, no deps) -> #46 (render 2-3 UI options, user
      picks) -> #48 (presence triggers, opt-in alarm) -> #49 (acknowledgement gate) -> #50
      (PRD) -> #51 (Web Store call).
- [ ] Also open from parallel README-demo work: #53 (make `nativeMessaging` optional).
- [ ] Known: docs-update workflow fails for merged fork PRs (no secrets on fork events).
- [ ] Your commit email becomes public with the repo; use the GitHub noreply address from now on.

## 2026-09-26 - Omarchy bar widget legible on solid and transparent bars

**Where we were:** main at a418a8e, no open PRs. The user reported the Omarchy bar widget
broke in one of the bar's two modes (solid vs transparent over the wallpaper).

**What we did:**
- Root cause: the widget used `bar.foreground` (theme text) and a palette picked from the
  popup background. The shell gives widgets `barForeground`, which follows the wallpaper when
  the bar is transparent. Result: a pale number on the transparent bar, invisible tracks on
  the solid bar.
- Fix: the number and track use `barForeground`; the pill palette comes from its luminance
  (`barTone`); shared `luma()`; `riskColor` takes a palette and unknown color (PR #41,
  commits 828d5c0 + refactor).
- Regression test fails on main and passes on the branch; `npm run check` 150/150; build green.
  Live grim captures of both modes with a synthetic 95/75/40 snapshot, plus the dropdown
  panel. Two-axis `/code-review` findings applied.

**Decisions:** one luminance rule on `barForeground` covers both modes (solid mode's
`barForeground` is the theme text), so no transparency branch. The dropdown panel keeps the
popup-derived `tone`.

**Pending / next:**
- [ ] Review and merge PR #41 (open, not merged). The fixed `Panel.qml` is already installed
      locally in `~/.config/omarchy/plugins/local.meterbar/`.
- [ ] Existing gap: `active: root.alarming` has no visible effect (BarIconButton colors only
      the hidden glyph), so >=90% shows no alarm on the bar.
- [ ] Existing gap: the widget's horizontal row overflows on vertical bars.
- [ ] Not verified: a light Omarchy theme with a solid bar (same code path as transparent).

## 2026-09-20 (later) - One OpenAI card for ChatGPT and Codex

**Where we were:** the glass dashboard had shipped with four slots; the user noted ChatGPT and
Codex are the same subscription and asked whether the split made sense.

**What we did:** investigated (`wham/usage` is one pool plus optional per-model caps; the live
Codex card was empty while the "ChatGPT" card showed the Codex pool) and, on the user's call,
merged them into one **OpenAI** card: three fixed slots everywhere, per-model cap as a named extra
window, `codex` removed from `ProviderId`, stale stored Codex cards dropped, PRD 5/6.4 updated.
Record: `docs/superpowers/specs/2026-09-20-openai-single-card.md`.

**Evidence:** `npm run check` 29 files / 149 tests; build; assets regenerated (three-bar icons);
`omarchy plugin validate`; popup, options, and Omarchy recaptured with three slots.

## 2026-09-20 - Glass dashboard (Token Monitor grammar), 24h trend, Omarchy parity

**Where we were:** PR #33 (Workbench redesign) was open and unmerged. The user judged the
Workbench and Channel Rail craft poor, rejected three rendered directions (transparent
hardware, frosted pane, neumorphic instrument), and pinned
[Javis603/token-monitor](https://github.com/Javis603/token-monitor) as the reference.

**What we did:**
- Read Token Monitor's renderer stylesheet and replicated its structure and material, not
  only its colors: glass tint over an ambient field, 11px monospace, hairline sections, hero
  number, 6px sunken meters, 7px controls, footer view switcher. Rendered three variants
  (provider hue / risk hue / light) and two trend layouts; the user picked risk hue with
  "% used" (PRD semantics) and the Home view with an inline 24-hour trend (no daily bars).
- Rebuilt the popup, side panel, and options page on `src/ui/cardsView.ts` +
  `src/popup/popup.css`. Home = hero + trend + compact limits; Limits = full provider
  sections. View persists in `localStorage` (`meterbar:view`). Badge-target control moved
  into the popup/side panel header via the shared `src/ui/badgeTargetControl.ts`.
- New pure module `src/shared/trendChart.ts` (SVG lines, 70/90 guides, direct labels,
  legend, hover readings) fed by the existing history store. Series hues validated with the
  dataviz palette checker on both surfaces.
- Palette source now carries dark + light; the generator emits `:root`, `[data-theme]`, and
  `prefers-color-scheme` blocks plus QML `dark`/`light` objects. Toolbar icons regenerated.
- Companion snapshot gains an optional bounded `history` (24h, <= 64 points, tightest
  window); the native host validates it. `Panel.qml` rewritten: bar widget = four mini
  meters + tightest percent; panel = hero, Canvas trend, compact limits, palette chosen by
  the theme's popup luminance.
- Countdowns are day-aware (`2d 13h`); dashboard uses short window labels.

**Evidence:** `npm run check` 30 files / 154 tests; `npm run build`; `npm run assets:check`;
`git diff --check`; `omarchy plugin validate` OK; headless captures of popup (home/limits,
dark/light, empty/stale), side panel (680 and 360 wide), options (dark/light); Omarchy
panel and bar widget captured after `omarchy restart shell` with a synthetic state file
(removed afterwards). Impeccable detector ran degraded (no HTML parser modules). Impeccable
finish review: first pass `fix` with 8 material findings (bar widget legibility, light-theme
contrast, note truncation, chart artifacts, hero orphan, side panel void, missing Omarchy
marks, flat glass); all fixed, second verdict pass `ship` on every scored item.

**Decisions:** Token Monitor grammar is the committed world; risk colors and "% used" stay
(PRD); no token/cost figures (MeterBar never sees tokens); no daily consumption bars; the
Omarchy glass follows the theme's popup alpha (no Hyprland layerrule edits from the product).

**Pending / next:**
- [ ] Ship this branch as a PR that supersedes #33 (finish review passed; DESIGN.md written by
      the impeccable documenter).
- [x] Extension reloaded; the companion received a real snapshot with history.
- [x] Detector run non-degraded (scratchpad copy with parser modules): 0 findings after raising
      the Settings type scale (12px body, 13px titles, 22px wordmark) and recording the
      intentional 14/16/48px steps and 1px swatch radius in DESIGN.md.

## 2026-09-19 - Workbench redesign, Omarchy companion, provider audit

**Where we were:** The extension worked but its visual system was generic and browser-only.
The user selected the Workbench Meter direction inspired by Token Monitor and explicitly
requested a useful local Omarchy surface.

**What we did:**
- Rebuilt popup, side panel, Settings, and toolbar visuals as the warm graphite Workbench
  instrument system with fixed provider order and truthful stale/empty states.
- Added an optional Omarchy bar widget and panel. The Chrome extension remains the
  authenticated collector; a strict Native Messaging host writes only sanitized usage
  fields to a private local state file. The Omarchy plugin performs no provider requests.
- Installed and exercised the companion locally across fresh, stale, and missing-state
  cases. Main implementation checkpoint: `7d8afb7`.
- Audited provider acquisition against
  [Javis603/token-monitor](https://github.com/Javis603/token-monitor) and first-party
  documentation. Full findings: `docs/research/2026-09-19-provider-data-connections.md`.
- Kept Claude and ChatGPT/Codex browser-session collection and Gemini status-only.
  Hardened Claude organization selection, ChatGPT default-account selection, 15-second
  request timeouts, serialized refreshes, immediate stale marking, and signed-out data
  clearing.
- Removed em dash characters flagged by standards review.

**Evidence:** `npm run check` passed 25 test files / 117 tests; `npm run build` passed;
`omarchy plugin validate companion/omarchy/local.meterbar` passed; `git diff --check`
passed.

**Decisions:** Token Monitor's Claude Code OAuth, Codex local credentials/app-server, and
Antigravity collector are desktop/CLI integrations, not safer drop-in replacements for a
browser extension. The optional companion remains display-only. Antigravity quota is not
consumer Gemini Apps usage.

**Pending / next:**
- [ ] Centralize the Workbench palette. The review found duplicated and already-diverging
      values across CSS, canvas icon code, static icon generation, and QML.
- [ ] Resolve the review's scope wording by documenting the Omarchy companion as an
      explicit optional post-MVP surface without weakening the PRD's browser MVP rules.
- [ ] Run a fresh two-axis branch review after the provider hardening and palette fix.
- [ ] Re-run visual verification if palette values change.
- [ ] Commit the follow-up, push `feat/workbench-ui-redesign`, and open the PR.

## 2026-08-23 - Codex weekly window, PR #25 split, badge picker redesign

**Where we were:** Extension installed on this machine (Chromium, unpacked `dist/`).
OpenAI had dropped the Codex/Work 5-hour window on 2026-07-12 (only the weekly pool
remains), but the adapter still labeled windows by position. PR #25 (2026-08-15) had the
same fix bundled with security hardening, a badge-target redesign, and workflow changes,
and sat unmerged.

**What we did:**
- Labeled OpenAI windows by `limit_window_seconds` instead of position; disabled Vite
  `modulePreload` (Chrome flagged the preload tags in extension pages) (#26).
- Split #25 and closed it: security + dependency hardening (#27), docs-workflow SHA pins
  and human-reviewed docs PRs (#28), badge picker (#29).
- Badge picker rebuilt as design option B: targets are Auto / Claude / OpenAI (provider's
  riskiest fresh window), legacy `provider:window` ids migrate in `loadSettings`, options
  page shows a segmented radiogroup with live risk-colored previews and arrow-key
  navigation (#29). Verified via a `chrome.*` shim + agent-browser.
- Two-axis review of #27/#28/#29 before merge; fixes landed in-branch: status normalized
  in `aggregateCards`, codex status-report no longer dropped, pin test covers `- uses:`,
  `claude-code-action` pinned to exact `v1.0.193`, no `--faint` on text.
- Docs workflow broke after #28 (`id-token: write` was not unused) and then hit the
  20-turn cap; restored OIDC (#30) and raised `--max-turns` to 60 (#31). Dispatch run
  32657848040 green.
- User reloaded the extension and confirmed the Gemini card still reports correctly.

**Decisions:** windows are not pinnable anymore - providers change them, so pinning a
provider is the only stable choice. The separate Codex pin is gone on purpose (OpenAI =
riskiest of its windows, Codex included). Docs PRs are human-reviewed, not auto-merged.

**Pending / next:**
- [ ] Capture a real post-July `wham/usage` payload and replace the 2026-06-20 fixture in
      `tests/chatgptAdapter.test.ts` (the weekly-only case is hand-built).
- [ ] Badge pin `ChatGPT · 5-hour` label rows are gone; if OpenAI reinstates 5h windows
      nothing breaks, the OpenAI target just shows the riskiest.
- [ ] `tests/workflowSecurity.test.ts` only guards `docs-update.yml`; extend if a second
      workflow appears.

## 2026-07-25 - Docs sync, design critique, and two UI overhaul PRs

**Where we were:** MVP + Phase 2 shipped (last activity 2026-06-21); local checkout was
10 PRs behind - upstream had grown a docs auto-refresh workflow (#11-#20). UI had never
had a structured design review.

**What we did:**
- Synced CLAUDE.md/README with the shipped toolbar surfaces and fixed the README's wrong
  collection-strategy claim; documented the docs-update workflow itself (#21).
- Ran a dual-agent Impeccable design critique of popup / side panel / options: **20/40**,
  1 P0, 3 P1s. Snapshot: `.impeccable/critique/2026-07-25T17-38-34Z__src-popup-popup-html.md`.
- Fixed the critique set (#22): stale/unavailable data no longer renders as live (P0);
  human error copy end-to-end; "% used" + `role=meter` + pace tick on every bar; compact
  rows + sticky footer (popup ~930px → 689px); shared `src/ui/tokens.css` with
  `color-scheme: dark`; contrast lifted to AA. 82 tests green.
- Resolved the two deferred product forks (user-confirmed) and shipped (#23): **fixed
  provider order everywhere** (orderByRisk deleted; icon holds per-provider slots),
  **sparklines draw a fixed 24h span** (labeled); options icon legend + first-run pin
  tip; header mark is now a live mini-gauge pointing at the riskiest percent. 85 tests.
- Added `PRODUCT.md` (impeccable init, distilled from docs/PRD.md; inferred facts labeled).
- Detector overlay after fixes: popup-empty 0 findings; other surfaces down to the
  accepted identity set (dot glows, system font stack, compact type scale).

**Decisions:** position means provider (risk lives in color/pulse/badge number, never
reordering); sparklines = one fixed 24h period; dark navy + dot glows + system font
stack are committed identity, not defects. Recorded as durable constraints in PRODUCT.md.

**Pending / next:**
- [ ] **Docs bot is broken**: both "Update docs on merge" runs today failed -
      `OPENROUTER_API_KEY` secret is not set (repo Settings → Secrets → Actions). Until
      it's added, README/CLAUDE.md won't auto-sync; after adding, re-run via
      workflow_dispatch or sync docs manually (they're incomplete, not wrong: no mention
      yet of fixed order, pace tick, PRODUCT.md).
- [ ] Portfolio bookkeeping: meterbar is missing from the project index at
      `/home/dcca/projects/CLAUDE.md` and (unverified) the keikaku registry.
- [ ] Repo nesting quirk: the repo lives at `meterbar/meterbar/` inside a wrapper dir;
      sessions started in the wrapper don't load the project CLAUDE.md. Flatten or
      always start inside the inner dir.
- [ ] Optional next design passes: `$impeccable polish`; export date/provider filters;
      time-to-reset badge target. Re-run `$impeccable critique` to measure the score
      change from 20/40.
