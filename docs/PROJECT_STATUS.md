# Project status

Session logbook, newest first. Each entry: where the project was, what the session
changed (with evidence), and what is still open.

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
