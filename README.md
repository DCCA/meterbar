# MeterBar

A privacy-first Chrome extension that shows AI subscription usage limits in one real-time bar.

## Product thesis

AI power users increasingly juggle Claude, ChatGPT/Codex, Gemini, and other AI subscriptions without a single place to see remaining limits. MeterBar starts as a Chrome extension that surfaces usage caps before they interrupt work, then can evolve into a local companion for CLI/coding-agent quota awareness.

## Status

MVP + Phase 2 in progress. The extension builds and loads: a toolbar badge shows the highest-risk usage, a popup renders per-provider cards with trend sparklines, and settings allow per-provider toggles and CSV/JSON export. Claude reads usage via a background fetch of the logged-in `claude.ai` session; ChatGPT/Codex and Gemini collect via content scripts. The exact provider endpoints/DOM hooks are validated by live inspection — until validated, a provider reports "not connected" rather than showing unverified numbers.

### Viewing your usage without clicking

- **Badge** — the pinned toolbar icon always shows your single riskiest percentage, color-coded.
- **Hover tooltip** — hover the icon for a full per-provider, per-window summary, no click needed.
- **Side panel** — open it once (the **Side panel** button in the popup, or Chrome's side-panel toolbar button) and it stays docked and glanceable while you browse, refreshing itself as new usage arrives.

## Local development

```bash
npm install
npm test            # vitest run (all suites)
npm run typecheck   # tsc --noEmit
npm run build       # vite build → dist/ (the unpacked extension)
```

Run a single test file:

```bash
npm test -- tests/badge.test.ts
```

### Load in Chrome

1. `npm run build`
2. Go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the `dist/` folder.
5. Pin MeterBar to the toolbar.

## Permissions and privacy

MeterBar is local-first: there is no backend, no cloud sync, and no analytics. It stores **only** usage metrics (percentages, reset timestamps, provider names, and your settings) in `chrome.storage.local`. It never reads or stores prompts, responses, uploaded files, or chat content.

| Permission | Why |
|---|---|
| `storage` | Save usage snapshots, history, and settings locally. |
| `alarms` | Refresh usage on a periodic schedule. |
| `notifications` | Warn at 70% / 90% and when a window resets. |
| `host_permissions: https://claude.ai/*` | Read your Claude usage from your logged-in session. |
| `host_permissions: https://chatgpt.com/*`, `https://chat.openai.com/*` | Read ChatGPT/Codex usage surfaced to the page. |
| `host_permissions: https://gemini.google.com/*` | Read Gemini usage surfaced to the page. |

Use **Settings → Clear local MeterBar data** to erase everything at any time.

## Disclaimer

MeterBar is an independent, community project. It is **not affiliated with, endorsed by,
or sponsored by Anthropic, OpenAI, or Google**. "Claude", "ChatGPT", "Codex", "Gemini",
and related marks belong to their respective owners and are used here only to identify the
services MeterBar reads.

MeterBar reads **your own** subscription usage from **your own** logged-in browser session.
To do so it relies on **undocumented provider endpoints** that may change or disappear
without notice, and accessing them may be inconsistent with a provider's Terms of Service.
You are responsible for your use of MeterBar with any third-party service.

The software is provided **"AS IS", without warranty of any kind** (see [LICENSE](LICENSE)).
Use it at your own risk.

## License

Licensed under the [Apache License 2.0](LICENSE).

## Docs

- [Product Requirements Document](docs/PRD.md)
- [MVP Implementation Plan](docs/superpowers/plans/2026-06-20-meterbar-mvp.md)
- [MVP + Phase 2 Implementation Plan](docs/superpowers/plans/2026-06-20-meterbar-mvp-phase2.md)
