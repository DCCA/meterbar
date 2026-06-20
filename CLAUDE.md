# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status: pre-implementation

This repo currently contains **only documentation** — there is no source code, `package.json`, or `manifest.json` yet. The two authoritative documents are:

- `docs/PRD.md` — product requirements, the canonical data model, and the privacy/security rules. **Source of truth for *what* to build and what is out of scope.**
- `docs/superpowers/plans/2026-06-20-meterbar-mvp.md` — a task-by-task MVP implementation plan with full file contents. **Source of truth for *how* the MVP is scaffolded.** Tasks use `- [ ]` checkboxes; work through them in order.

When implementing, follow the plan's task sequence and the PRD's constraints. If the two ever conflict, the PRD's privacy/security rules win.

## What MeterBar is

A privacy-first Chrome **Manifest V3** extension that surfaces AI subscription usage limits (Claude first; ChatGPT/Codex and Gemini later) in a single toolbar badge + popup. Local-first, no backend.

## Planned toolchain & commands

These do not exist until Task 1 of the plan is run, but they define the intended workflow (TypeScript + Vite + Vitest):

```bash
npm install
npm run build       # vite build → dist/ (the unpacked extension)
npm test            # vitest run (all tests)
npm test -- tests/badge.test.ts   # run a single test file
npm run test:watch  # vitest watch mode
npm run typecheck   # tsc --noEmit
```

Load in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `dist/`.

Development is **test-first**: write the Vitest spec, watch it fail, then implement. Pure logic (badge math, time helpers, alert de-dup, provider parsers) is unit-tested in `node` environment; `chrome.*` APIs are only touched in the background/popup/options entry points, not in testable logic.

## Architecture (the big picture)

Four runtime surfaces coordinate through `chrome.storage.local` — there is no shared in-memory state:

- **Background service worker** (`src/background/`) — a `chrome.alarms` refresh loop drives adapters, computes the badge, and fires threshold notifications.
- **Popup** (`src/popup/`) — reads stored state and renders provider cards. Vanilla HTML/CSS/TS, no framework.
- **Options page** (`src/options/`) — toggles, privacy explanation, and "clear local data".
- **Storage** (`src/storage/`) — thin wrapper over `chrome.storage.local`.

Two patterns hold the system together:

1. **Provider adapters, not a monolith.** Each provider implements a common `ProviderAdapter` interface (`src/providers/providerAdapter.ts`) and normalizes its native response into the canonical `UsageSnapshot` schema. A `mockAdapter` provides deterministic fixture data so the whole UI/badge/alert pipeline can be built and tested before any live endpoint is touched. The Claude adapter starts as a **pure parser boundary** (`parseClaudeUsageResponse`) tested against fixture-shaped data; live `claude.ai` calls are deliberately deferred until that behavior is validated.

2. **One canonical schema flows everywhere.** `UsageSnapshot` (defined in `src/shared/types.ts`) is the contract: adapter → storage → badge calculation → popup render. Its enums (`ProviderId`, `UsageWindow`, `Confidence`, `ProviderStatus`) must match the PRD §10 data model. The badge picks the single riskiest fresh snapshot (highest `usedPercent`, not stale, confidence ≠ `unavailable`); color thresholds are green <70, amber ≥70, red ≥90, gray for unknown/stale.

## Non-negotiable constraints (from the PRD)

These are hard product invariants, not style preferences — every change must honor them:

- **Never collect chat content.** No prompts, completions, messages, uploaded files, screenshots, full browsing history, raw session cookies, or API keys. Store **only** usage metrics (percentages, reset timestamps, provider names, optional anonymized account id, settings).
- **Local-first, no backend.** No cloud sync, no remote analytics, no account system in the MVP. The only permitted network traffic is to the provider pages/endpoints required to read usage.
- **Least-privilege permissions.** Host permissions limited to what's needed (`https://claude.ai/*` for the MVP). Declare permissions plainly.
- **Truthful uncertainty.** If a value is estimated, inferred, stale, or from an undocumented endpoint, the UI must say so via the `confidence`/`stale` fields — never present a guess as exact.
- **No routing/failover** in the Chrome MVP; that belongs to a future companion app.

## Git

Develop on branch `claude/great-albattani-82r7an`. Do not push to `main` without explicit permission.
