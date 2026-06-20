# Multi-provider toolbar icon — design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Branch:** `feat/multi-provider-badge`

## Problem

The toolbar shows a single number — the riskiest provider's used percent. When a user
has more than one provider connected (e.g. Claude **and** ChatGPT), only the worst one is
visible; the other is invisible until they open the popup.

Chrome's `chrome.action` **badge** is a hard constraint: it holds ~4 characters of text
over a *single* background color. Two independently-colored numbers cannot live in the
badge. The toolbar **icon**, however, is our own image and can be redrawn at runtime.

## Goal

Show every connected-with-data provider *at a glance* on the toolbar, while keeping the
precise worst-case number readable.

Non-goals: exact per-provider numbers on the toolbar (that's the popup's job); animation;
configurability of bar order/visibility; showing Gemini (status-only, has no percent).

## Solution

On each refresh, redraw the toolbar icon as one vertical **bar per connected provider that
has fresh usage data**, and keep the existing badge number as the single worst percent.

- **Bar fill height** ∝ that provider's *riskiest window* used percent (0–100%).
- **Bar color** = risk level at the shared thresholds: green `<70`, amber `>=70`, red `>=90`.
- **Bar order** = fixed provider order (Claude, then ChatGPT/Codex). Position identifies the
  provider; the popup carries the labels. A bar's position is stable regardless of risk.
- **Track**: each bar is drawn over a faint unfilled track so low usage is still visible.
- **Badge text**: unchanged — the single worst percent, colored by the worst risk level.
  Bars convey "how many providers and how is each doing"; the number conveys "exactly how
  bad is the worst."

### States

| Connected providers with data | Icon | Badge |
| --- | --- | --- |
| 0 | Static default MeterBar icon (`setIcon` back to the bundled asset) | `?` (gray) |
| 1 | One bar | worst % |
| 2 | Two bars | worst % |

Gemini, being status-only, never contributes a bar. If it ever gains a usage number, it
appears as a third bar with no code change (the model is data-driven).

## Architecture

Mirrors the repo's pure-logic / I/O-boundary split (adapters vs `refresh.ts`).

### `src/background/iconModel.ts` — pure, unit-tested

```ts
export interface IconBar { provider: ProviderId; level: 'ok' | 'warn' | 'crit'; fillRatio: number; }
export function iconBars(cards: ProviderCardState[]): IconBar[];
```

- Input: the aggregated `ProviderCardState[]` already computed in `recompute()`.
- For each provider in a fixed order, if it has at least one fresh, non-`unavailable`
  snapshot, emit one `IconBar` using that provider's **riskiest** window: `level` from the
  badge thresholds, `fillRatio = max(usedPercent)/100` clamped to `[0,1]`.
- Providers without fresh usage data are omitted. Result preserves the fixed order.
- No DOM, no canvas, no `chrome.*`. Deterministic.

The risk thresholds reuse the existing `colorForPercent` semantics from `badge.ts`; the
level→hex mapping for drawing lives next to the canvas code (see below) so `iconModel`
stays presentation-agnostic.

### `src/background/icon.ts` — I/O, not unit-tested

```ts
export async function renderIcon(bars: IconBar[]): Promise<void>;
```

- If `bars` is empty: `chrome.action.setIcon({ path: { 16: 'assets/icon16.png', 48:
  'assets/icon48.png', 128: 'assets/icon128.png' } })` — the bundled static icon, so a
  logged-out user sees the normal logo.
- Otherwise draw on `new OffscreenCanvas(size, size)` at 16px and 32px:
  - light track rects for each bar slot, then filled rects from the bottom up to
    `fillRatio`, colored by `level` (green/amber/red hexes shared with the popup palette).
  - `ctx.getImageData(...)` → `chrome.action.setIcon({ imageData: { 16, 32 } })`.
- Bar geometry (count, width, gap, padding) derived from `bars.length` and canvas size.
- This is the only module that touches canvas/`chrome.action.setIcon` — the I/O boundary,
  same status as `refresh.ts`.

### `src/background/index.ts` — wiring

In `recompute()`, after computing `cards` and the badge, also:

```ts
await renderIcon(iconBars(cards));
```

`badge.ts` is unchanged. The badge number/color continue to come from
`calculateBadgeState`.

## Testing

- **TDD `iconModel`** (node env), covering:
  - 0 providers → `[]`
  - 1 provider with data → 1 bar, correct level + fillRatio
  - 2 providers → 2 bars in fixed order
  - a provider's bar uses its **riskiest** window (not the first)
  - stale / `unavailable` snapshots excluded; provider with only stale data omitted
  - level boundaries at 70 and 90; fillRatio clamped to `[0,1]`
- **No unit test** for `icon.ts` (canvas/`chrome` boundary) — consistent with `refresh.ts`.
- **Visual check**: render the bar drawing headless (reuse the Chromium screenshot harness
  from the popup work) to confirm 1-bar and 2-bar icons read clearly at 16px and 32px.
- **Regression gate**: `npm test`, `npm run typecheck`, `npm run build` all green.

## Risks / notes

- `OffscreenCanvas` is available in MV3 service workers; no extra permission needed.
- 16px is tiny — two bars must stay legible. If 16px reads poorly in the visual check,
  fall back to drawing only at 32px and letting Chrome downscale (decided during the
  visual check, not a behavior change).
- No new manifest permissions; `setIcon` is part of the existing `action`.
