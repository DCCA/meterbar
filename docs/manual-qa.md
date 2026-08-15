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

- [ ] Popup shows the **gauge hero**: "No providers connected yet" + the privacy line.
- [ ] Each provider renders an empty card with status pill (e.g. "Not connected yet").
- [ ] Each first-party card shows an **Open <provider> →** CTA.
- [ ] Clicking a CTA opens the provider site in a new tab (`claude.ai`, `chatgpt.com`, `gemini.google.com`).
- [ ] Toolbar badge shows `?` in gray (no fresh data).

## 2. Live usage (the core path)

Sign into `claude.ai` and/or `chatgpt.com` in the same profile, open the popup, click **Refresh**.

- [ ] Cards populate with real percentages and truthful window labels. Claude may show "5-hour limit" / "7-day limit"; OpenAI uses the duration returned by its usage response and never invents a 5-hour window.
- [ ] Providers stay in the fixed order **Claude, ChatGPT/Codex, Gemini**. Risk changes color, pulse, and badge number, never position.
- [ ] Toolbar **badge** shows the single highest fresh % and the right color
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

- [ ] Dark theme matches the popup; toggle switches animate on/off.
- [ ] Toggling a provider off removes it from the popup after refresh; on restores it.
- [ ] The badge-number selector offers **OpenAI · Riskiest**, not fixed OpenAI window choices.
- [ ] **Export JSON** and **Export CSV** download files containing only percentages +
      window durations + timestamps (open them and confirm - no prompts/messages/content).
- [ ] **Clear local MeterBar data** shows a confirm dialog; cancelling does nothing.
- [ ] Confirming clears data, shows the green status line, and it auto-clears after ~4s.
- [ ] After clearing, the popup falls back to the first-run hero (§1).

## 7. Accessibility & polish

- [ ] Tab through the popup and options — focus rings are visible on buttons, links,
      toggles, and CTAs.
- [ ] Each usage bar exposes `role="meter"` with `aria-valuenow` (inspect, or a
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

## 9. Regression gate

- [ ] `npm test` → all green.
- [ ] `npm run typecheck` → clean.
- [ ] `npm run build` → `dist/` builds without errors.
