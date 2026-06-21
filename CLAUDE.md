# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: MVP + Phase 2 implemented

The extension is built and loadable — `manifest.json`, `package.json`, the full `src/` tree, and 15 Vitest suites all exist. Claude and ChatGPT/Codex read live usage via background fetches; Gemini reports connected-status via a content script. The authoritative documents:

- `docs/PRD.md` — product requirements, the canonical data model, and the privacy/security rules. **Source of truth for *what* to build and what is out of scope.** If the PRD ever conflicts with anything else, the PRD's privacy/security rules win.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` — historical records of *how* each feature (MVP, ChatGPT/Codex live usage, Gemini connected-status) was built. Useful context, not an active checklist.

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

Development is **test-first**: write the Vitest spec, watch it fail, then implement. Pure logic (badge math, time helpers, alert de-dup, provider parsers, tooltip summary) is unit-tested in `node` environment; `chrome.*` APIs are only touched in the background/popup/options/side-panel entry points, not in testable logic.

## Architecture (the big picture)

Five runtime surfaces coordinate through `chrome.storage.local` — there is no shared in-memory state:

- **Background service worker** (`src/background/`) — `index.ts` owns the lifecycle: a `chrome.alarms` loop (`meterbar-refresh`, every 10 min) drives `refresh.ts`, then `recompute()` aggregates cards, sets the badge, sets the toolbar-icon hover tooltip (`buildTooltip`, `src/shared/summary.ts`), and fires notifications. It also routes `ExtensionMessage`s from the popup and content scripts.
- **Popup** (`src/popup/`) — sends `state:get`/`usage:refresh`, renders per-provider cards with trend sparklines, and offers a **Side panel** button. Vanilla HTML/CSS/TS, no framework. Card rendering is shared with the side panel via `src/ui/cardsView.ts`.
- **Side panel** (`src/sidepanel/`) — `chrome.sidePanel` docks a persistent, auto-updating view that reuses the popup's `cardsView` rendering. It opens from the popup button or Chrome's side-panel toolbar button and re-renders on `chrome.storage.onChanged` (local area) so it stays live while browsing.
- **Options page** (`src/options/`) — per-provider toggles, privacy explanation, CSV/JSON export, and "clear local data".
- **Content scripts** (`src/content/`) — `gemini.ts` runs on `gemini.google.com` and posts a `status:report` (see strategy split below).
- **Storage** (`src/storage/`) — `usageStore.ts` (latest card per provider + settings + alert de-dup state) and `historyStore.ts` (per-`provider:window` time series) over `chrome.storage.local`.

Key patterns:

1. **Two collection strategies, not one.** `ProviderAdapter.collection` (`src/providers/providerAdapter.ts`) is a discriminated union. `'fetch'` providers (Claude, ChatGPT/Codex) are read by the background worker with the logged-in session cookie; `'content'` providers (Gemini) run a content script that messages the worker. This split is the first thing to decide when adding a provider.

2. **Adapters are pure; all I/O lives in `refresh.ts`.** Adapters contribute only deterministic, no-I/O helpers — `parse(raw, now?)`, URL builders, and `pick*` selectors. **Every** `fetch`, credential handling, and HTTP→`ProviderStatus` mapping lives in `src/background/refresh.ts` (`refreshClaude`, `refreshChatgpt`). This is why logic is unit-tested in the `node` env without mocking `chrome.*`. Claude usage is read live from `claude.ai` (org discovery → per-org usage) and ChatGPT/Codex from `wham/usage` (Bearer token minted from the session cookie). Tokens, org UUIDs, and account ids are used only to build requests and are **never stored**.

3. **One canonical schema flows everywhere.** `UsageSnapshot` (`src/shared/types.ts`) is the contract: adapter → storage → badge → popup. Its enums (`ProviderId` incl. `codex`/`unknown`, `UsageWindow`, `Confidence`, `ProviderStatus` = `connected`/`not_connected`/`stale`/`unsupported`) must match the PRD §10 data model. The badge picks the single riskiest fresh snapshot (highest `usedPercent`, not stale, confidence ≠ `unavailable`); colors are green <70, amber ≥70, red ≥90, gray for unknown/stale (`src/background/badge.ts`).

4. **Message protocol.** `src/shared/messages.ts` defines the `ExtensionMessage` union wiring the surfaces: `usage:report` / `status:report` (content/refresh → bg), `usage:refresh` / `state:get` (popup → bg), `state:result` (bg → popup).

5. **History & alerts.** Each refresh appends a point per `provider:window` (full-res for 24h, older collapsed hourly, capped at 500 points — `historyStore.ts`), feeding popup sparklines (`src/shared/sparkline.ts`) and CSV/JSON export (`src/shared/exporters.ts`). Staleness threshold is 10 min (`isStale`, `src/shared/time.ts`). Alerts fire at 70/90%, de-duped by `provider:window:threshold:resetsAt` (`src/background/alerts.ts`).

`src/providers/mock/mockAdapter.ts` supplies deterministic fixture cards for building/testing the UI pipeline without a live endpoint.

## Non-negotiable constraints (from the PRD)

These are hard product invariants, not style preferences — every change must honor them:

- **Never collect chat content.** No prompts, completions, messages, uploaded files, screenshots, full browsing history, raw session cookies, or API keys. Store **only** usage metrics (percentages, reset timestamps, provider names, optional anonymized account id, settings).
- **Local-first, no backend.** No cloud sync, no remote analytics, no account system in the MVP. The only permitted network traffic is to the provider pages/endpoints required to read usage.
- **Least-privilege permissions.** API permissions are `storage`, `alarms`, `notifications`, `sidePanel`; host permissions cover only the read-usage origins (`claude.ai`, `chatgpt.com`, `chat.openai.com`, `gemini.google.com`). Add a host only when a provider needs it, and declare permissions plainly.
- **Truthful uncertainty.** If a value is estimated, inferred, stale, or from an undocumented endpoint, the UI must say so via the `confidence`/`stale` fields — never present a guess as exact. Gemini deliberately reports *connected-status only* (its adapter emits no usage snapshots) because usage sits behind a fragile `batchexecute` RPC — do not "fix" this by scraping an unverified number.
- **No routing/failover** in the Chrome MVP; that belongs to a future companion app.

## Git

`main` is the default branch — do not commit or push to it directly without explicit permission; branch first and open changes from a feature branch.
