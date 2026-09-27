# README demo video - design

Date: 2026-09-27
Status: approved in conversation, pending written-spec review

## Goal

A short, silent, looping demo at the top of `README.md` that tells a first-time GitHub visitor what MeterBar does within the first few seconds, looks like the product rather than a generic promo, and never shows the product doing something it does not do.

**Audience:** a developer deciding whether to install MeterBar, often skimming, sometimes on mobile, on GitHub light or dark theme, with autoplay muted.

**Success criteria**

- A visitor understands "one toolbar badge for Claude + OpenAI limits, Gemini status" from any single frame plus its caption.
- Every frame is something a real user could see, or is plainly marked as illustration (cursor, OS notification chrome, browser strip).
- Every usage number on screen carries its `inferred` qualifier in a legible size.
- Renders reproducibly from the repo with one command, in dark and light.

## Constraints

- **PRD truthfulness rules apply to marketing.** Gemini is status-only, readings are `inferred`, alerts are OS notifications, the popup does not live-update, the hero number and trend chart are static.
- **PRD privacy rules.** No real account data. The demo dataset contains no realistic emails, org names, or ids.
- **DESIGN.md is the visual contract.** Colors come from the generated palette (`src/ui/workbenchPalette.css` via `src/ui/tokens.css`), never copied hex. Monospace only. The Risk-Only Color Rule, the One Number Rule, the Percent Phrase Rule ("72% used"), and the No-Card Rule hold for everything the video adds.
- **No change to extension runtime code.** `dist/` is consumed, never modified. HyperFrames stays out of the root `package.json`.

## Tooling

- **HyperFrames** (`hyperframes`, Apache-2.0, Node >= 22): HTML compositions with `data-*` timing, rendered frame by frame in headless Chrome, encoded by FFmpeg. Version pinned in `demo/package.json`.
- **GSAP**, installed as a local npm dependency of `demo/` (no CDN fetch at render time). HyperFrames seeks registered GSAP timelines (`window.__timelines`) and top-document `document.getAnimations()`.
- **FFmpeg** (system, has `libwebp_anim` and `libx264`) for the README derivatives.
- **Telemetry:** HyperFrames sends anonymous usage counters by default. Every script that invokes it sets `HYPERFRAMES_NO_TELEMETRY=1`.

## Storyboard (18 s, loops)

Stage: 1200x750 CSS px design space. A persistent `Demo data · sped up` tag sits bottom-left (x 64) for the whole video. The only amber or rose on screen is on risk-carrying values.

| # | Time | Picture | Kicker / caption |
|---|---|---|---|
| 1 | 0.0-3.5 | Browser toolbar strip (hairline edge, empty omnibox pill, no URL text, no traffic lights). MeterBar icon shows the real three-slot bars and a `72` amber badge. Cursor arcs in (400 ms) and hovers the icon at 1.2 s; the tooltip appears at 1.6 s with the real `buildTooltip` text. | `01 · Toolbar` / "Every AI limit, in your toolbar." |
| 2a | 3.5-6.5 | Click (120 ms press to 0.9). Popup drops from the icon (opacity + 12 px y, 300 ms, product ease) into the **Mix 1 layout**: popup at 1.4x anchored under the icon on the right, running off the bottom edge; caption block on the left. Home view. | `02 · At a glance` / "Claude + Claude Code. ChatGPT + Codex. Gemini status." (three lines, 40 px), sub: "The tightest limit first, with its reset countdown." |
| 2b | 6.5-9.0 | Cursor clicks the view toggle; crossfade (200 ms) to the Limits view. Meters fill 0 to value (600 ms, product ease, 60 ms stagger); pace ticks visible. | `02 · Limits` / "Which limit bites first, and when." sub: "The tick marks even pacing to the reset." |
| 3 | 9.0-14.0 | Popup gone. Side panel docked at the right below the toolbar strip (squared top corners), a quiet empty page to its left. At 10.8 s the panel crossfades from the 72% state to the 91% state; the Claude 5-hour meter grows 72 to 91 and turns rose; the toolbar badge changes `72` amber to `91` rose. At 11.4 s an OS-style notification slides in top-right with the real `alertCopy` title and body. | `03 · Side panel` / "Stays docked. Alerts at 70% and 90% used." |
| 4 | 14.0-18.0 | Everything else fades; a single glass pane in the product's own format: uppercase `PRIVACY` section title, hairline-separated rows. At 17.4 s crossfade to the exact frame-0 state for a seamless loop. | Rows: "Reads usage only, from your logged-in session." / "Tokens are never stored." / "Talks only to claude.ai, chatgpt.com, gemini.google.com." / "No backend. No analytics. No chat content." Micro line: "Not affiliated with Anthropic, OpenAI, or Google." |

Every caption is on screen for at least 2.5 s. One thing moves at a time: no simultaneous zoom, pan, and slide.

## Visual design

Chosen layout: **Mix 1** (reference render: A's toolbar and caption column, B's large popup).

- **Background:** the product's ambient field (bg-deep plus the three radial gradients from `popup.css`, scaled to the stage), static for the whole video.
- **Captions:** plain text on the field, no boxes. Kicker: 14 px, 500, uppercase, 0.08em tracking, `--muted`. Headline: 40 px, 800, line-height 1.08, -0.02em, `--text`. Sub: 17 px, `--muted`. Caption column at x 64, width 548.
- **Toolbar strip:** 56 px, `surface-strong` at 70% over the field, 1 px `--hairline` bottom edge, omnibox pill in `--control` with a `--hairline-soft` ring, neutral extension dots.
- **Badge:** product badge colors from `calculateBadgeState` / `colorForPercent`, 5 px radius.
- **Tooltip and OS notification:** `surface-strong` at 92% (DESIGN.md's only opaque-on-pane material), `--hairline` ring, 7 px radius, monospace. The notification shows a small `MeterBar` app line above the `alertCopy` title and body.
- **Privacy pane:** `--glass` with the product's pane lift, ring, and highlight; section title in the Title role; rows in Body at stage scale.
- **Cursor:** an authored SVG arrow (in `demo/`), eased arcs by animating x and y with different eases, 120 ms press.
- **Motion:** product ease `cubic-bezier(0.22, 1, 0.36, 1)`; durations 120-600 ms; crossfades 200 ms.
- **Font:** JetBrains Mono woff2 (OFL) bundled in `demo/fonts/`, loaded by `@font-face` in the composition and in every embedded product page, so renders do not depend on the host's fonts.
- **Light theme:** the same composition with `data-theme="light"` on the stage and on every embedded page; the generated light tokens do the rest.

## Architecture

```
demo/
  package.json      hyperframes + gsap pinned; scripts: prepare, render
  index.html        root composition (data-width 2400, data-height 1500); a 1200x750 stage scaled 2x;
                    one paused GSAP timeline registered on window.__timelines.root; theme variable
  stub.js           runs before the product bundle in each embedded page
  fixture.js        demo datasets (ESM, plain JS)
  derive.ts         bundled by esbuild at prepare time; imports buildTooltip, alertCopy, iconBars,
                    calculateBadgeState from src/ and writes .build/derived.json
  prepare.mjs       builds the embeddable pages and derived.json
  render.sh         end-to-end render and export
  cursor.svg, fonts/
  .build/           generated, gitignored
```

**Embedded product pages.** `prepare.mjs` copies `../dist` to `demo/.build/ext/`, and for `popup.html` and `sidepanel.html` writes demo copies that:

1. rewrite root-absolute `/assets/` to `./assets/` (HyperFrames serves the project directory, not `dist/`),
2. inject the `@font-face` and a `prefers-reduced-motion`-equivalent rule so the product's own CSS animations stay off (the composition's GSAP timeline owns all motion),
3. load `stub.js` before the product module script.

The composition embeds them as same-origin iframes and reads query parameters: `state` (`glance` or `alert`), `view` (`home` or `limits`), `theme` (`dark` or `light`).

**`stub.js` contract** (derived from what the popup, side panel, `cardsView`, and `badgeTargetControl` call at load):

- Freezes `Date` and `Date.now()` at the fixture's `NOW` before any product code runs.
- `chrome.runtime.sendMessage({type:'state:get'})` resolves `{type:'state:result', cards}` with already-aggregated cards (the UI trusts `snapshot.stale`).
- `chrome.storage.local.get` supports `null`, a key string, a key array, and an object of defaults (`loadSettings` uses the defaults form).
- History keys `history:<provider>:<window>` return `[t, p][]` for each card's tightest window, with at least two points in the last 24 h.
- `chrome.storage.onChanged.addListener` is a no-op (the popup registers one through `badgeTargetControl`).
- `chrome.windows.getCurrent` and `chrome.sidePanel.open` resolve; nothing in the video clicks them for real.
- `localStorage.getItem('meterbar:view')` returns the `view` parameter, so sibling iframes on the same origin do not race.
- Sets `data-theme` on `<html>` from the `theme` parameter.

**Motion into iframes.** Because the pages are same-origin, the root timeline targets elements inside them, for example `.meter b` widths for the fill and the 72-to-91 grow. The timeline is built only after every iframe reports its first render.

**Derived text.** Tooltip text, alert title and body, icon bars, and badge text and color come from `derived.json`, produced by the real `src/` functions. The video never hand-types product copy.

## Demo dataset (`fixture.js`)

`NOW` = 2026-09-24 14:30 local. Every snapshot uses `confidence: 'inferred'`, `stale: false`, `source: 'demo'`, and `capturedAt` one minute before `NOW`.

- **`glance`**
  - Claude (`Claude`, connected): `five_hour` 72% used, resets in 2h 14m; `seven_day` 41%, resets in 3d 6h.
  - OpenAI (`OpenAI`, connected): `seven_day` 38%, resets in 4d 2h; `custom` 22% with `workspaceLabel: 'Codex'` (the name the repo's own tests use), resets in 3d.
  - Gemini (`Gemini`, connected): no snapshots.
  - History: Claude `five_hour` shaped like a working day ending at 72; OpenAI `seven_day` drifting up to 38.
- **`alert`**: same as `glance` except Claude `five_hour` 91% used, resets in 46m, with history extended to 91.

Settings: `DEFAULT_SETTINGS` (badge target `riskiest`, notifications on).

## Outputs and README

`render.sh` runs: root `npm run build`, then `demo` prepare, then `hyperframes render` at 24 fps, quality high, once per theme (`HYPERFRAMES_NO_TELEMETRY=1`), then FFmpeg:

- `docs/media/meterbar-demo-dark.webp` and `-light.webp`: animated, lossy q 78, looping, scaled to 1600x1000, under 5 MB each.
- `docs/media/meterbar-demo-poster-dark.png` and `-light.png`: the frame at 6.0 s (beat 2a), 1600x1000.
- `docs/media/meterbar-demo.mp4`: dark, H.264, 1920x1200, `yuv420p`, `+faststart`.

README hero, directly under the title:

```html
<picture>
  <source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: light)" srcset="docs/media/meterbar-demo-poster-light.png">
  <source media="(prefers-reduced-motion: reduce)" srcset="docs/media/meterbar-demo-poster-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/media/meterbar-demo-light.webp">
  <img src="docs/media/meterbar-demo-dark.webp" width="800" alt="MeterBar: toolbar badge, popup with Claude and OpenAI limits and Gemini status, side panel alert at 91% used, privacy summary">
</picture>
```

GitHub documents `prefers-color-scheme` sources in `<picture>`. Whether it keeps `prefers-reduced-motion` sources is unverified; if the PR preview shows them stripped or ignored, keep only the two theme sources.

Followed by one line: demo data, sped up; a link to the MP4; and a link to the "Permissions and privacy" table. The same PR corrects that table's Gemini row, which currently says "Read Gemini usage surfaced to the page", to say that Gemini reports connected status only.

## Verification

- **`tests/demoFixture.test.ts`** (runs in `npm test`): feeds both datasets through the real helpers and asserts:
  - every snapshot is `inferred`;
  - Gemini has zero snapshots;
  - `mostConstrainedWindow` picks Claude `five_hour` at 72 (`glance`) and 91 (`alert`);
  - labels are exactly `Claude` / `OpenAI` / `Gemini`;
  - no string matches an email or UUID pattern.
- **Visual check:** stills at 1.8, 5.0, 8.0, 12.0, and 15.5 s in dark and light, reviewed for legibility (the `inferred` word readable at 800 px wide), cropping, and token use.
- **Loop check:** the last frame and frame 0 match.
- **Size check:** each WebP is under 5 MB.
- **README check:** it renders on GitHub in both themes (PR preview).

## Risks and the first task

**Iframe readiness at capture time** is the one unproven assumption. The first implementation task is a spike: a two-second composition with one popup iframe and one GSAP meter tween, rendered twice, with frames compared. If frames differ or the iframe is blank, fall back to static snapshots: capture each page state with `chromium --headless --dump-dom` from the stubbed pages and inline the markup in the composition, rewriting `body` and `:root` selectors onto a wrapper.

## Out of scope

- A narrated walkthrough, Chrome Web Store assets, and the options page.
- The Omarchy companion.
- CI rendering.
- **Making `nativeMessaging` an optional permission.** Tracked as a separate issue, since it is a product change.

## Amendments during implementation

- **Beat 3 crossfades instead of growing a meter.** The side panel's Home view shows the hero number and the trend, not meters, and the product re-renders on a storage change rather than animating it. The video crossfades the panel from its 72% state to its 91% state, which is what a user sees.
- **`drawBars` is exported from `src/background/icon.ts`.** This is a one-word change with no runtime effect, so the video paints the toolbar icon with the product's own drawing code.
- **No `derived.json`.** `derive.ts` exports a pure `deriveDemo()`, which the composition bundle calls directly and the tests call in node.
- **The popup frame resizes from 494 to 479 px** when it switches to Limits, as Chrome resizes a popup window to its content (Home is 497.5 px tall, Limits 478.5 px).
- **The toolbar badge text uses `--icon-track`.** Chrome draws the badge outside any theme, like the product's icon.
- **HyperFrames' checker loads the stage bundle before `<body>` exists**, so `stage.ts` initializes on `DOMContentLoaded` in that case. That is still before `load`, and the timeline registers before any seek.
