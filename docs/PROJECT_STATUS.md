# Project status

Session logbook, newest first. Each entry: where the project was, what the session
changed (with evidence), and what is still open.

## 2026-08-15 - Security hardening for PR #25

**Where we were:** The OpenAI window update worked in live testing, then a focused
security review found low-severity trust-boundary and privacy hardening gaps. Runtime
reports had incomplete schema/sender checks, authenticated fetches used default cache
behavior, the Gemini status script serialized the full page DOM, and one unused legacy
OpenAI host permission remained. The development dependency tree also had known audit
findings.

**What we did:**
- Validate runtime message schemas and authorize content reports by exact provider origin;
  privileged refresh/state requests now accept extension-page senders only.
- Add `cache: 'no-store'` to every credentialed provider request so the short-lived OpenAI
  access token and usage responses are not retained in the HTTP cache.
- Narrow Gemini sign-in detection to inline script payloads instead of reading rendered
  conversation DOM, while sending only the same fixed status message.
- Remove the unused `https://chat.openai.com/*` permission and defensively normalize
  corrupted stored status values before rendering.
- Upgrade Vite and Vitest to secure supported releases and refresh the lockfile.
- Harden the privileged docs workflow: pin every third-party action by commit SHA, remove
  unused OIDC permission and merged PR titles from model input, and require human review
  instead of auto-merging LLM-authored documentation.

**Evidence:** `npm run check` passes 20 suites / 105 tests; `npm run build` succeeds on
Vite 7.3.6; `npm audit` reports 0 vulnerabilities. The built Gemini content script has no
module import and contains no full-page `innerHTML` read. Live Gemini connected/signed-out
behavior was confirmed after reloading the hardened extension.

**Pending / next:** None.

## 2026-08-15 - OpenAI usage windows now follow the provider response

**Where we were:** `parseChatgptUsage()` ignored `limit_window_seconds` and assumed
`primary_window` always meant 5 hours and `secondary_window` always meant 7 days. The
same fixed OpenAI choices appeared in the badge selector. A successful OpenAI response
with no fixed windows was incorrectly stored as `not_connected`.

**What we did:**
- Added optional `windowSeconds` metadata to the canonical snapshot and derive OpenAI
  window types, labels, pace marks, tooltip copy, rolling history, CSV exports, and alerts
  from the duration returned by `wham/usage`.
- Replaced fixed OpenAI badge choices with one provider-level **OpenAI · Riskiest**
  target. Stored legacy OpenAI targets migrate at read time.
- Keep a successful OpenAI read connected when that plan reports no fixed window, with
  explicit empty-state copy instead of a fake 5-hour bar or a signed-out state.
- Corrected stale manual-QA instructions for fixed provider order and `role="meter"`.
- Added a narrow-screen options layout after browser QA found the new selector cramped.

**Evidence:** `npm run check` passes 94 tests; `npm run build` succeeds; desktop and
390px browser screenshots show the migrated **OpenAI · Riskiest** selector and the
responsive options layout. [OpenAI's current Codex pricing page](https://developers.openai.com/codex/pricing/)
still documents a shared five-hour window for Plus, while flexible Enterprise/Edu plans
can have no fixed rate limits. The implementation therefore follows the endpoint instead of removing 5-hour
support globally.

**Pending / next:**
- [ ] Run the live-provider manual QA path with an OpenAI account that reports no fixed
      window. The parser and empty-state behavior are unit-tested, but this checkout has
      no authenticated provider fixture for an end-to-end request.

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
