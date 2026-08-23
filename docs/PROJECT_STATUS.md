# Project status

Session logbook, newest first. Each entry: where the project was, what the session
changed (with evidence), and what is still open.

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
10 PRs behind — upstream had grown a docs auto-refresh workflow (#11–#20). UI had never
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
- [ ] **Docs bot is broken**: both "Update docs on merge" runs today failed —
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
