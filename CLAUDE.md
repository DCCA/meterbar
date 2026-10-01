# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: MVP + Phase 2 implemented, glass dashboard shipped

The extension is built and loadable - `manifest.json`, `package.json`, the full `src/` tree, and per-module Vitest suites in `tests/` all exist. Claude and OpenAI (ChatGPT and Codex, one card) read live usage via background fetches; Gemini reports connected-status via a content script. All numeric readings carry `confidence: 'inferred'` because the endpoints are undocumented. The glass dashboard (hero readout, 24-hour multi-provider trend chart, two switchable views) and the always-visible surfaces (three-slot toolbar icon with casing, choosable badge number, hover tooltip, side panel) are shipped. An optional experimental Omarchy companion publishes a sanitized snapshot to a native-messaging host. The authoritative documents:

- `docs/PRD.md` - product requirements, the canonical data model, and the privacy/security rules. **Source of truth for *what* to build and what is out of scope.** If the PRD ever conflicts with anything else, the PRD's privacy/security rules win.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` - historical records of *how* each feature (MVP, ChatGPT/Codex live usage, Gemini connected-status) was built. Useful context, not an active checklist.

## What MeterBar is

A privacy-first Chrome **Manifest V3** extension that surfaces AI subscription usage limits (Claude, OpenAI, Gemini) in a single toolbar badge + popup. Local-first, no backend. Requires Chrome 114+ (`minimum_chrome_version` in `manifest.json`, needed for `sidePanel` and `setBadgeTextColor`).

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
npm run assets:generate  # regenerate palette CSS/QML and icon PNGs
```

Load in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `dist/`.

README demo video: `demo/` is a separate HyperFrames project (own `package.json`, not part of the extension build or root `npm run check`, except `tests/demoFixture.test.ts`, which pins the demo dataset's truthfulness rules). It renders the real built popup and side panel with a stubbed `chrome.*` and a frozen clock. Regenerate the committed media with `cd demo && npm install && npm run render` (needs FFmpeg and `img2webp` from libwebp 1.6+; see `demo/README.md`). `docs/media/meterbar-demo-*` is generated output: never hand-edit it, and re-render when a UI change makes the video stale. If you move the beat-4 fades in `demo/stage.ts`, move `KEYFRAMES_AT_MS` in `demo/render.sh` with them.

Build plumbing: every entry surface (page or content script) is a named rollup input in `vite.config.ts`, which pins deterministic `assets/[name].js` output names that `manifest.json` references; a build plugin copies the manifest into `dist/`. Adding a surface means touching both files. A `prebuild` step (`npm run assets:check`) verifies that generated assets (palette CSS/QML, icon PNGs) are in sync with `src/ui/workbenchPalette.json`; the build fails on drift.

Development is **test-first**: write the Vitest spec, watch it fail, then implement. Pure logic (badge math, time helpers, alert de-dup, provider parsers, tooltip summary, trend chart SVG) is unit-tested in `node` environment; `chrome.*` APIs are only touched in the background/popup/options/side-panel entry points, not in testable logic.

## Architecture (the big picture)

Six runtime surfaces plus a native companion bridge coordinate through `chrome.storage.local` - there is no shared in-memory state:

- **Background service worker** (`src/background/`) - `index.ts` owns the lifecycle: a `chrome.alarms` loop (`meterbar-refresh`, every 10 min) drives `refresh.ts` via a coalesced refresh runner (`refreshRunner.ts`), then `recompute()` aggregates cards and updates every always-visible surface in one pass: badge text/background/text color, the multi-bar icon, the hover tooltip, the native companion bridge, and notifications. A `mutationGate.ts` serializes content-script writes so `data:clear` can pause and drain them. It also routes `ExtensionMessage`s from the popup, side panel, and content scripts.
- **Popup** (`src/popup/`) - sends `state:get`/`usage:refresh`, renders the glass dashboard (hero readout, 24-hour trend chart, per-provider detail cards in two switchable views), and offers a **Side panel** button. Vanilla HTML/CSS/TS, no framework. Card rendering is shared with the side panel via `src/ui/cardsView.ts` (the DOM layer); the trend chart is pure SVG from `src/shared/trendChart.ts` (node-env tested); pure presentational helpers stay in `src/popup/render.ts` (node-env tested).
- **Side panel** (`src/sidepanel/`) - `chrome.sidePanel` docks a persistent, auto-updating view that reuses the popup's `cardsView` rendering. It opens from the popup button or Chrome's side-panel toolbar button and re-renders on `chrome.storage.onChanged` (local area) so it stays live while browsing.
- **Options page** (`src/options/`) - per-provider toggles, badge-number picker (shared segmented control via `src/ui/badgeTargetControl.ts`), privacy explanation, CSV/JSON export, and "Clear local data".
- **Content scripts** (`src/content/`) - `gemini.ts` runs on `gemini.google.com` and posts a `status:report` (see strategy split below).
- **Storage** (`src/storage/`) - `usageStore.ts` (latest card per provider + settings + alert de-dup state + per-provider backoff state) and `historyStore.ts` (per-`provider:window` time series) over `chrome.storage.local`. Stored snapshots are never mutated after write: `aggregate.ts` derives `stale` and card status from `capturedAt` at read time.
- **Native companion bridge** (`src/background/nativeBridge.ts`) - on each recompute, `syncCompanion()` sends a sanitized, schema-versioned snapshot to the optional native-messaging host (`com.meterbar.bridge`). The host writes an atomic `0600` JSON file that the Omarchy QML panel reads. Authentication material, endpoint names, and account identifiers never cross the boundary. `clearCompanion()` asks the host to delete its file. Both operations are best-effort: a missing host never degrades the extension.

Key patterns:

1. **Two collection strategies, not one.** `ProviderAdapter.collection` (`src/providers/providerAdapter.ts`) is a discriminated union. `'fetch'` providers (Claude, OpenAI) are read by the background worker with the logged-in session cookie; `'content'` providers (Gemini) run a content script that messages the worker. This split is the first thing to decide when adding a provider. ChatGPT and Codex share a single endpoint (`wham/usage`) and are surfaced as one **OpenAI** card (provider id `chatgpt`): pool windows appear as-is and the riskiest per-model cap becomes an extra `custom` window on the same card.

2. **Adapters are pure; all I/O lives in `refresh.ts`.** Adapters contribute only deterministic, no-I/O helpers - `parse(raw, now?)`, URL builders, and `pick*` selectors. **Every** `fetch`, credential handling, and HTTP→`ProviderStatus` mapping lives in `src/background/refresh.ts` (`refreshClaude`, `refreshChatgpt`). This is why logic is unit-tested in the `node` env without mocking `chrome.*`. Claude usage is read live from `claude.ai` (org discovery → per-org usage) and ChatGPT/Codex from `wham/usage` (Bearer token minted from the session cookie). Tokens, org UUIDs, and account ids are used only to build requests and are **never stored**. Every provider request uses a 15-second `AbortController` timeout via `sessionFetch()`. A 429 response persists a per-provider backoff (parsed from the `Retry-After` header by `src/shared/refreshPolicy.ts`, defaulting to 30 min, clamped to [1 min, 24 h]); the provider is skipped on every trigger—manual included—until the backoff expires. Backoff is persisted because the service worker is ephemeral.

3. **One canonical schema flows everywhere.** `UsageSnapshot` (`src/shared/types.ts`) is the contract: adapter → storage → badge/icon → popup/side panel. Its enums (`ProviderId` = `claude`/`chatgpt`/`gemini`/`unknown`, `UsageWindow`, `Confidence`, `ProviderStatus` = `connected`/`not_connected`/`stale`/`unsupported`) must match the PRD §10 data model. All numeric readings from Claude and ChatGPT/Codex carry `confidence: 'inferred'` (the endpoints are undocumented). Risk colors come from the single-source palette (`src/ui/workbenchPalette.json`): green <70, amber ≥70, red ≥90, gray for unknown/stale, everywhere.

4. **The toolbar is three independent layers**, all recomputed together in `recompute()`, each only considering fresh snapshots (not stale, confidence ≠ `unavailable`):
   - **Badge number** (`src/background/badge.ts`) - shows `settings.badgeTarget`: `'riskiest'` (default: highest fresh `usedPercent` across providers) or a user-pinned group. `BADGE_TARGETS` in `src/shared/badgeTarget.ts` is the single source of truth for both the options segmented control and the background lookup - each target maps to a `providers` array. Gemini is omitted: status-only, no number. The segmented control is shared by popup and options via `src/ui/badgeTargetControl.ts`. Badge text color is set explicitly (via `chrome.action.setBadgeTextColor`, Chrome 110+; the manifest's 114 floor comes from `sidePanel`) for AA contrast on every risk color, instead of letting Chrome pick a default that may be low-contrast on amber.
   - **Icon** (`src/background/iconModel.ts` + `icon.ts`) - repainted each recompute as one vertical risk-colored bar per provider in a fixed three-slot casing (Claude, OpenAI, Gemini), so position identifies the provider even when a slot has no data. `iconModel.ts` is the pure model (node-tested); `icon.ts` is the only module touching `OffscreenCanvas`/`chrome.action.setIcon` and restores the static logo when no provider has data.
   - **Hover tooltip** - `buildTooltip` (`src/shared/summary.ts`) renders a per-provider, per-window text summary with confidence qualifiers via `chrome.action.setTitle`.

5. **Message protocol.** `src/shared/messages.ts` defines the `ExtensionMessage` union wiring the surfaces: `usage:report` / `status:report` (content/refresh → bg), `usage:refresh` / `data:clear` / `state:get` (popup/side panel → bg), `state:result` (bg → popup/side panel). `data:clear` pauses mutations and refresh via `mutationGate` + `refreshRunner`, clears storage and the companion snapshot, then resets all toolbar surfaces.

6. **History & alerts.** Each refresh appends a point per `provider:window` (full-res for 24h, older collapsed hourly, capped at 500 points - `historyStore.ts`), feeding the 24-hour trend chart (`src/shared/trendChart.ts`) and CSV/JSON export (`src/shared/exporters.ts`). Staleness threshold is 10 min (`isStale`, `src/shared/time.ts`). Alerts fire at 70/90%, de-duped by `provider:window:threshold:resetsAt[:workspaceLabel]` (the `workspaceLabel` suffix distinguishes per-model caps so a switch to a different model cap starts a new series rather than a false reset), and include the snapshot's `confidence` qualifier. Tooltips and alert copy use the `workspaceLabel` (limit name, e.g. a model cap) in place of the generic window name when present (`src/shared/summary.ts`, `src/background/alerts.ts`).

7. **Workbench palette.** `src/ui/workbenchPalette.json` is the single source of truth for all color tokens (dark, light, and icon contexts). `scripts/generate-workbench-palette.mjs` produces `src/ui/workbenchPalette.css` and `companion/omarchy/local.meterbar/WorkbenchPalette.qml`; `scripts/generate-icons.mjs` produces the icon PNGs. The `prebuild` hook (`npm run assets:check`) fails if any generated file is out of sync, so the palette cannot drift.

`src/providers/mock/mockAdapter.ts` supplies deterministic fixture cards for building/testing the UI pipeline without a live endpoint.

## Non-negotiable constraints (from the PRD)

These are hard product invariants, not style preferences - every change must honor them:

- **Never collect chat content.** No prompts, completions, messages, uploaded files, screenshots, full browsing history, raw session cookies, or API keys. Store **only** usage metrics (percentages, reset timestamps, provider names, provider limit names such as a model cap, optional anonymized account id, connection status, alert history, per-provider refresh backoff state, settings).
- **Local-first, personal-only, no backend.** No cloud sync, remote analytics, account system, or team dashboard. The only permitted network traffic is to provider pages/endpoints required to read usage.
- **Least-privilege permissions.** API permissions are `storage`, `alarms`, `notifications`, and `sidePanel`, plus `nativeMessaging` only for the optional experimental Omarchy display bridge. Host permissions cover only the read-usage origins (`claude.ai`, `chatgpt.com`, `gemini.google.com`). Add a host only when a provider needs it, and declare permissions plainly.
- **Truthful uncertainty.** If a value is estimated, inferred, stale, or from an undocumented endpoint, the UI must say so via the `confidence`/`stale` fields - never present a guess as exact. Claude and ChatGPT/Codex readings carry `confidence: 'inferred'` (undocumented endpoints). Gemini deliberately reports *connected-status only* (its adapter emits no usage snapshots) because usage sits behind a fragile `batchexecute` RPC - do not "fix" this by scraping an unverified number.
- **No routing/failover** in the Chrome product. Any future personal companion capability requires a separate product decision.

## Git

`main` is the default branch - do not commit or push to it directly without explicit permission; branch first and open changes from a feature branch.

Docs are living: `.github/workflows/docs-update.yml` reviews every merged code PR (changes under `src/`, `manifest.json`, `package.json`) and opens a docs-sync PR updating README.md and this file, which a human reviews and merges. It never touches `docs/PRD.md` or `docs/superpowers/**`. Expect README/CLAUDE.md to move after code merges, and rebase docs edits onto `origin/main` before opening a PR.
