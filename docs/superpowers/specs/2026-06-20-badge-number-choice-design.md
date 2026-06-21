# Choose the icon number — design

**Date:** 2026-06-20
**Status:** Approved
**Branch:** `feat/badge-number-choice`

## Problem

The toolbar badge number always shows the **riskiest** provider's used percent
(`calculateBadgeState` picks the highest fresh `usedPercent`). A user who mainly cares
about one provider/window can't make the number track it — it silently follows whichever
provider happens to be worst.

## Goal

Let the user pin the badge **number** to a specific provider + window, while keeping
"Riskiest (auto)" as the default. The multi-provider **bars** are unaffected.

Non-goals: changing the bars (they keep showing every connected provider); per-window
control over the bars; Gemini as a target (status-only, no percent).

## Decisions (from brainstorming)

1. **What's chosen:** provider **and** window (or "Riskiest (auto)").
2. **Scope:** only the number + its color pin; the bars keep showing all providers.
3. **Fallback:** if the pinned target has no *fresh* data, show a gray `?` — never a
   misleading substitute number. (Truthful-uncertainty rule.)

## Behavior

- Default `badgeTarget = 'riskiest'` → identical to today.
- A pinned target is a `provider:window` pair. The badge number = that snapshot's
  `usedPercent`, color from `colorForPercent`, **only if** the snapshot is fresh
  (`!stale` and `confidence !== 'unavailable'`).
- No matching fresh snapshot → `{ text: '?', color: '#6b7280' }` (the existing empty state).
- Bars (`iconBars`) and notifications are unchanged.

## UI — options page

A single `<select id="badge-target">` (not dependent dropdowns — only ~6 valid pairs, and a
flat list makes invalid provider/window combinations impossible):

```
Icon number
  Riskiest (auto)        <- default
  Claude · 5-hour
  Claude · 7-day
  ChatGPT · 5-hour
  ChatGPT · 7-day
  ChatGPT · Codex
```

Gemini is omitted (no numeric usage). Changing the select saves the setting and sends
`usage:refresh` so the icon updates immediately.

## Architecture

Pure-logic / I-O boundary split, consistent with the rest of the codebase.

### `src/shared/badgeTarget.ts` — pure, single source of truth

```ts
export type BadgeTargetId = 'riskiest' | `${ProviderId}:${UsageWindow}`;

export interface BadgeTarget { id: BadgeTargetId; label: string; provider?: ProviderId; window?: UsageWindow; }

export const BADGE_TARGETS: BadgeTarget[];          // the selectable list, in display order
export function parseBadgeTarget(id: string): BadgeTarget;  // unknown ids fall back to 'riskiest'
```

- One list drives both the options `<select>` and the background lookup, so they cannot drift.
- `BADGE_TARGETS` order: `riskiest`, `claude:five_hour`, `claude:seven_day`,
  `chatgpt:five_hour`, `chatgpt:seven_day`, `chatgpt:custom` (labeled "ChatGPT · Codex").
- `parseBadgeTarget` returns the `riskiest` entry for any unknown id (defensive against
  stale stored values).

### `src/background/badge.ts`

```ts
export function calculateBadgeState(snapshots: UsageSnapshot[], targetId?: BadgeTargetId): BadgeState;
```

- `targetId` defaults to `'riskiest'` → current behavior (existing tests stay green).
- Pinned: filter to fresh snapshots, find one matching `provider` + `window`; if found use
  it, else return the gray `?` state.
- `colorForPercent` unchanged.

### `src/storage/usageStore.ts`

- Add `badgeTarget: BadgeTargetId` to `Settings`; `DEFAULT_SETTINGS.badgeTarget = 'riskiest'`.

### `src/background/index.ts`

- `recompute()` passes `settings.badgeTarget` to `calculateBadgeState`. `iconBars(cards)`
  call is unchanged.

### `src/options/options.html` + `options.ts`

- New "Icon number" panel with the select, populated from `BADGE_TARGETS`.
- Load sets the current value; `change` saves via `saveSettings` and sends `usage:refresh`.

## Testing (TDD)

- **`badge.ts`**
  - default / explicit `'riskiest'` → unchanged riskiest pick.
  - pinned `claude:five_hour` → that snapshot's percent + color.
  - pinned target with no fresh snapshot → `?` gray.
  - pinned target whose only snapshot is stale → `?` gray.
  - pinned `chatgpt:custom` resolves the Codex snapshot.
- **`badgeTarget.ts`**
  - `BADGE_TARGETS` includes the expected ids in order; `riskiest` first.
  - `parseBadgeTarget` parses a valid id; returns `riskiest` for an unknown id.
- No test for the options DOM wiring (chrome/DOM boundary), consistent with the repo.
- Regression gate: `npm test`, `npm run typecheck`, `npm run build` all green.

## Risks / notes

- Stored `badgeTarget` from a future/removed option is handled by `parseBadgeTarget`'s
  fallback to `riskiest`.
- No new permissions; storage already holds settings.
