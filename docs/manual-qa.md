# Manual QA checklist

Things that **can't** be covered by `npm test` — the live provider data path and the
rendered UI in a real Chrome profile. Run this before shipping a release or after any
change to `src/popup/`, `src/options/`, `src/background/refresh.ts`, or a provider adapter.

The pure logic (badge math, ordering, parsing, time/alert helpers, render helpers) is
unit-tested; this list deliberately focuses on what only a browser can prove.

## Setup

```bash
git checkout main && git pull
npm install
npm run build        # → dist/
```

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select `dist/`.
3. Pin MeterBar to the toolbar.
4. After any code change: `npm run build`, then click **↻ reload** on the extension card.

> WSL note: load `dist/` via its `\\wsl$\...` path, or copy it to the Windows filesystem first.

---

## 1. First-run / empty state

Use a Chrome profile **not** signed into any provider (or clear data first — see §6).

- [ ] Popup shows the Workbench master readout in its empty state plus the local-only privacy signal.
- [ ] Each provider renders an empty channel row with truthful status copy (e.g. "Not connected yet").
- [ ] Each first-party card shows an **Open <provider> →** CTA.
- [ ] Clicking a CTA opens the provider site in a new tab (`claude.ai`, `chatgpt.com`, `gemini.google.com`).
- [ ] Toolbar badge shows `?` in gray (no fresh data).

## 2. Live usage (the core path)

Sign into `claude.ai` and/or `chatgpt.com` in the same profile, open the popup, click **Refresh**.

- [ ] Cards populate with real percentages and window labels ("5-hour limit", "7-day limit").
- [ ] Providers stay in their fixed channel order so position identifies the provider; the master readout identifies the most constrained window.
- [ ] Toolbar **badge** shows the selected fresh % and the right color
      (green <70, amber ≥70, red ≥90).
- [ ] Per-window risk colors are correct on bar, number, and status dot — and a window's
      number reflects **its own** risk, not the card's peak (e.g. a 78% window stays amber
      even on a card whose other window is 94% red).
- [ ] `Resets in …` countdown is present and plausible per window; reads
      "Reset time unknown" only when the provider gave no reset time.
- [ ] Sparkline appears once ≥2 data points exist (refresh a few times / wait for the
      10-min alarm); it is tinted to the window's risk level.
- [ ] Confidence note (e.g. "estimated") shows **only** when confidence ≠ exact.
- [ ] "<time> ago" updated stamp is sensible after a refresh.

## 3. Not-connected / stale handling

- [ ] Sign **out** of a provider, Refresh → its card returns to the not-connected state
      with the CTA (no stale numbers presented as live).
- [ ] Leave the popup/data untouched > 10 min → card flips to "Data is stale" and the
      badge stops counting that provider as fresh.

## 4. Gemini (status-only by design)

- [ ] Visit `gemini.google.com` signed in → Gemini card shows **connected** status copy,
      and **no** invented usage number.
- [ ] Open a conversation containing unique text and confirm only the fixed connected
      status reaches MeterBar; no prompt/response text appears in extension storage.
- [ ] Signed out → card resets to the default not-connected look.

## 5. Notifications

- [ ] With notifications enabled, drive a window to ≥70% then ≥90% (real usage, or
      temporarily lower `THRESHOLDS` in `src/background/alerts.ts` for a test build) →
      exactly one OS notification fires per threshold crossing (no duplicate spam on
      repeated refreshes).
- [ ] Disabling notifications in Options suppresses them.

## 6. Options page

Right-click the icon → **Options** (or the popup's Settings link).

- [ ] The calibration-bench layout matches the popup's graphite casing, warm enamel strips, and fixed channel language.
- [ ] Toggle switches animate on/off.
- [ ] Toggling a provider off removes it from the popup after refresh; on restores it.
- [ ] **Export JSON** and **Export CSV** download files containing only percentages +
      timestamps (open them and confirm — no prompts/messages/content).
- [ ] **Clear local MeterBar data** shows a confirm dialog; cancelling does nothing.
- [ ] Confirming clears data, shows the green status line, and it auto-clears after ~4s.
- [ ] After clearing, the popup falls back to the first-run hero (§1).

## 7. Accessibility & polish

- [ ] Tab through the popup and options — focus rings are visible on buttons, links,
      toggles, and CTAs.
- [ ] Each usage bar exposes `role="progressbar"` with `aria-valuenow` (inspect, or a
      screen reader announces the percentage).
- [ ] **Refresh** shows the spinner + disables while in flight, then re-enables.
- [ ] With OS "reduce motion" on, fills/spinner/pulse don't animate.

## 8. Privacy / security spot-check

These guard the PRD's non-negotiables — verify on every release.

- [ ] DevTools → Network (popup + a provider tab): the only requests are to the provider
      usage endpoints. **No** request to any MeterBar/third-party backend and authenticated
      requests use `cache: no-store`.
- [ ] `chrome://extensions` lists host access only for `claude.ai`, `chatgpt.com`, and
      `gemini.google.com`; there is no broad or unused `chat.openai.com` access.
- [ ] `chrome://extensions` → MeterBar → **Inspect service worker** → Application →
      Storage: stored keys are `latest:*`, `history:*`, `alertState`, and settings —
      containing only metrics/timestamps. No tokens, cookies, account ids, or chat content.
- [ ] A provider-supplied string with HTML (e.g. a workspace label containing `<`) renders
      as text, not markup (escaping holds).

## 9. Omarchy companion

Run `./scripts/install-omarchy-companion.sh`, reload the unpacked extension, and refresh usage once.

- [ ] The three-channel MeterBar indicator appears in the right side of the Omarchy bar.
- [ ] Left-click opens the Workbench panel and right-click opens the extension in Chromium.
- [ ] The panel shows the same fixed provider order, percentages, reset timing, and connected-only Gemini state as the extension.
- [ ] Stop refreshing for longer than 10 minutes: last-known readings remain visible but are labeled stale and stop contributing to the master reading.
- [ ] `~/.local/state/meterbar/state.json` has mode `0600` and contains only provider/status/window/percentage/timestamp/confidence/stale fields. Confirm there are no cookies, tokens, account hashes, endpoint details, prompts, responses, or chat content.
- [ ] Removing the native host or state file leaves the extension functional and gives the panel a truthful waiting state.

## 10. Regression gate

- [ ] `npm test` → all green.
- [ ] `npm run typecheck` → clean.
- [ ] `npm run build` → `dist/` builds without errors.
