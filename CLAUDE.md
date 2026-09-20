# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: MVP + Phase 2 implemented

The extension is built and loadable - `manifest.json`, `package.json`, the full `src/` tree, and per-module Vitest suites in `tests/` all exist. Claude and ChatGPT/Codex read live usage via background fetches; Gemini reports connected-status via a content script. The always-visible surfaces (multi-bar toolbar icon, choosable badge number, hover tooltip, side panel) are shipped. The authoritative documents:

- `docs/PRD.md` - product requirements, the canonical data model, and the privacy/security rules. **Source of truth for *what* to build and what is out of scope.** If the PRD ever conflicts with anything else, the PRD's privacy/security rules win.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` - historical records of *how* each feature (MVP, ChatGPT/Codex live usage, Gemini connected-status) was built. Useful context, not an active checklist.

## What MeterBar is

A privacy-first Chrome **Manifest V3** extension that surfaces AI subscription usage limits (Claude, ChatGPT/Codex, Gemini) in a single toolbar badge + popup. Local-first, no backend.

## Toolchain & commands

TypeScript + Vite + Vitest:

```bash
npm install
npm run build       # vite build → dist/ (the unpacked extension)
npm test            # vitest run (all tests)
npm test -- tests/badge.test.ts   # run a single test file
npm run test:watch  # vitest watch mode
npm run typecheck   # tsc --noEmit
npm run check       # typecheck + test (convenience)
```

Load in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `dist/`.

Build plumbing: every entry surface (page or content script) is a named rollup input in `vite.config.ts`, which pins deterministic `assets/[name].js` output names that `manifest.json` references; a build plugin copies the manifest into `dist/`. Adding a surface means touching both files.

Development is **test-first**: write the Vitest spec, watch it fail, then implement. Pure logic (badge math, time helpers, alert de-dup, provider parsers, tooltip summary) is unit-tested in `node` environment; `chrome.*` APIs are only touched in the background/popup/options/side-panel entry points, not in testable logic.

## Architecture (the big picture)

Five runtime surfaces coordinate through `chrome.storage.local` - there is no shared in-memory state:

- **Background service worker** (`src/background/`) - `index.ts` owns the lifecycle: a `chrome.alarms` loop (`meterbar-refresh`, every 10 min) drives `refresh.ts`, then `recompute()` aggregates cards and updates every always-visible surface in one pass: badge text/color, the multi-bar icon, the hover tooltip, and notifications. It also routes `ExtensionMessage`s from the popup, side panel, and content scripts.
- **Popup** (`src/popup/`) - sends `state:get`/`usage:refresh`, renders per-provider cards with trend sparklines, and offers a **Side panel** button. Vanilla HTML/CSS/TS, no framework. Card rendering is shared with the side panel via `src/ui/cardsView.ts` (the DOM layer); pure presentational helpers stay in `src/popup/render.ts` (node-env tested).
- **Side panel** (`src/sidepanel/`) - `chrome.sidePanel` docks a persistent, auto-updating view that reuses the popup's `cardsView` rendering. It opens from the popup button or Chrome's side-panel toolbar button and re-renders on `chrome.storage.onChanged` (local area) so it stays live while browsing.
- **Options page** (`src/options/`) - per-provider toggles, badge-number picker, privacy explanation, CSV/JSON export, and "clear local data".
- **Content scripts** (`src/content/`) - `gemini.ts` runs on `gemini.google.com` and posts a `status:report` (see strategy split below).
- **Storage** (`src/storage/`) - `usageStore.ts` (latest card per provider + settings + alert de-dup state) and `historyStore.ts` (per-`provider:window` time series) over `chrome.storage.local`. Stored snapshots are never mutated after write: `aggregate.ts` derives `stale` and card status from `capturedAt` at read time.

Key patterns:

1. **Two collection strategies, not one.** `ProviderAdapter.collection` (`src/providers/providerAdapter.ts`) is a discriminated union. `'fetch'` providers (Claude, ChatGPT/Codex) are read by the background worker with the logged-in session cookie; `'content'` providers (Gemini) run a content script that messages the worker. This split is the first thing to decide when adding a provider.

2. **Adapters are pure; all I/O lives in `refresh.ts`.** Adapters contribute only deterministic, no-I/O helpers - `parse(raw, now?)`, URL builders, and `pick*` selectors. **Every** `fetch`, credential handling, and HTTP→`ProviderStatus` mapping lives in `src/background/refresh.ts` (`refreshClaude`, `refreshChatgpt`). This is why logic is unit-tested in the `node` env without mocking `chrome.*`. Claude usage is read live from `claude.ai` (org discovery → per-org usage) and ChatGPT/Codex from `wham/usage` (Bearer token minted from the session cookie). Tokens, org UUIDs, and account ids are used only to build requests and are **never stored**.

3. **One canonical schema flows everywhere.** `UsageSnapshot` (`src/shared/types.ts`) is the contract: adapter → storage → badge/icon → popup/side panel. Its enums (`ProviderId` incl. `codex`/`unknown`, `UsageWindow`, `Confidence`, `ProviderStatus` = `connected`/`not_connected`/`stale`/`unsupported`) must match the PRD §10 data model. Risk colors are green <70, amber ≥70, red ≥90, gray for unknown/stale, everywhere.

4. **The toolbar is three independent layers**, all recomputed together in `recompute()`, each only considering fresh snapshots (not stale, confidence ≠ `unavailable`):
   - **Badge number** (`src/background/badge.ts`) - shows `settings.badgeTarget`: `'riskiest'` (default: highest fresh `usedPercent` across providers) or a user-pinned `provider:window`. `BADGE_TARGETS` in `src/shared/badgeTarget.ts` is the single source of truth for both the options `<select>` and the background lookup - new pinnable windows are added there and nowhere else (Gemini is omitted: status-only, no number).
   - **Icon** (`src/background/iconModel.ts` + `icon.ts`) - repainted each recompute as one vertical risk-colored bar per provider with fresh data, in fixed left-to-right order so position identifies the provider. `iconModel.ts` is the pure model (node-tested); `icon.ts` is the only module touching `OffscreenCanvas`/`chrome.action.setIcon` and restores the static logo when no provider has data.
   - **Hover tooltip** - `buildTooltip` (`src/shared/summary.ts`) renders a per-provider, per-window text summary via `chrome.action.setTitle`.

5. **Message protocol.** `src/shared/messages.ts` defines the `ExtensionMessage` union wiring the surfaces: `usage:report` / `status:report` (content/refresh → bg), `usage:refresh` / `state:get` (popup/side panel → bg), `state:result` (bg → popup/side panel).

6. **History & alerts.** Each refresh appends a point per `provider:window` (full-res for 24h, older collapsed hourly, capped at 500 points - `historyStore.ts`), feeding popup sparklines (`src/shared/sparkline.ts`) and CSV/JSON export (`src/shared/exporters.ts`). Staleness threshold is 10 min (`isStale`, `src/shared/time.ts`). Alerts fire at 70/90%, de-duped by `provider:window:threshold:resetsAt` (`src/background/alerts.ts`).

`src/providers/mock/mockAdapter.ts` supplies deterministic fixture cards for building/testing the UI pipeline without a live endpoint.

## Non-negotiable constraints (from the PRD)

These are hard product invariants, not style preferences - every change must honor them:

- **Never collect chat content.** No prompts, completions, messages, uploaded files, screenshots, full browsing history, raw session cookies, or API keys. Store **only** usage metrics (percentages, reset timestamps, provider names, optional anonymized account id, settings).
- **Local-first, personal-only, no backend.** No cloud sync, remote analytics, account system, or team dashboard. The only permitted network traffic is to provider pages/endpoints required to read usage.
- **Least-privilege permissions.** API permissions are `storage`, `alarms`, `notifications`, and `sidePanel`, plus `nativeMessaging` only for the optional experimental Omarchy display bridge. Host permissions cover only the read-usage origins (`claude.ai`, `chatgpt.com`, `gemini.google.com`). Add a host only when a provider needs it, and declare permissions plainly.
- **Truthful uncertainty.** If a value is estimated, inferred, stale, or from an undocumented endpoint, the UI must say so via the `confidence`/`stale` fields - never present a guess as exact. Gemini deliberately reports *connected-status only* (its adapter emits no usage snapshots) because usage sits behind a fragile `batchexecute` RPC - do not "fix" this by scraping an unverified number.
- **No routing/failover** in the Chrome product. Any future personal companion capability requires a separate product decision.

## Git

`main` is the default branch - do not commit or push to it directly without explicit permission; branch first and open changes from a feature branch.

Docs are living: `.github/workflows/docs-update.yml` reviews every merged code PR (changes under `src/`, `manifest.json`, `package.json`) and opens a docs-sync PR updating README.md and this file, which a human reviews and merges. It never touches `docs/PRD.md` or `docs/superpowers/**`. Expect README/CLAUDE.md to move after code merges, and rebase docs edits onto `origin/main` before opening a PR.
