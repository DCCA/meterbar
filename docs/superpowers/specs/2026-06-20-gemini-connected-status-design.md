# Gemini "connected" status — design

**Date:** 2026-06-20
**Status:** approved design, pending implementation plan

## Goal

Promote the Gemini provider from a no-op stub to an **honest connected-status** card.
When the user is signed into gemini.google.com, the Gemini card shows
*"Connected — Gemini shows your usage on its 'Limites de uso' page"* instead of
"not connected yet". It deliberately shows **no usage percentage**.

## Why no number

Research (official docs + the Quotio reference app) and a live capture confirmed:
Gemini *does* surface usage (current + weekly %) — but only via Google's
**`batchexecute` RPC** (`rpcids=CNgdBe`, an undocumented positional-array payload
requiring the page's `at`/`bl`/`f.sid` tokens). Parsing it would be fragile
(rpcid/array shape can change without notice) and tab-dependent. Per the PRD's
truthful-uncertainty rule, we choose not to show a number we can't read robustly,
and instead point the user to where Google shows it.

## Architecture

Content-script only — no background fetch, no usage snapshots, no badge involvement.

1. **`src/content/gemini.ts`** — on load and on `visibilitychange`, check a
   **signed-in signal**: the presence of the WIZ session-token key (`SNlM0e`) in the
   page HTML (`document.documentElement.innerHTML`). This is a boolean presence
   check, NOT usage parsing. If signed in, send a `status:report` message; if the
   signal is absent (logged out / landing page), send nothing (card stays default).
2. **`src/shared/messages.ts`** — add a `status:report` message variant and an
   `isStatusReport` type guard.
3. **`src/background/index.ts`** — handle `status:report` by calling the existing
   `storeStatus(provider, label, status, message)` then `recompute()`.
4. **`src/providers/gemini/geminiAdapter.ts`** — remove the dead `parseGeminiUsage`
   and `GeminiUsageRaw` (they expected a `remaining`/`limit` shape that doesn't
   exist). The adapter keeps its descriptor (`provider`, `label: 'Gemini'`,
   `collection: { strategy: 'content', matches: [...] }`) with `parse: () => []`.

No popup change is required: `aggregateCards` preserves a no-snapshot card's stored
status (`snapshots.length === 0 ? c.status : ...`), and `popup.ts`'s `cardHtml`
already renders `card.message` for a card with no snapshots.

## Message contract

```ts
{ type: 'status:report'; provider: ProviderId; status: ProviderCardState['status']; message: string }  // content → bg
```

`isStatusReport(m)` returns true when `m.type === 'status:report'` and `m.provider`
is a string. The Gemini content script sends:
`{ type: 'status:report', provider: 'gemini', status: 'connected',
   message: "Connected — Gemini shows your usage on its 'Limites de uso' page" }`.

## Data flow

```
gemini.google.com tab (signed in)
  └─ content script detects WIZ token → status:report ─▶ background
       └─ storeStatus('gemini', 'Gemini', 'connected', message) ─▶ chrome.storage.local
            └─ popup state:get → aggregateCards (status preserved) → card shows the message
```

## Privacy (PRD)

- No usage metrics, no identifiers, no tokens stored. The WIZ-token check reads only a
  boolean (present/absent) from the page and is never persisted or transmitted; only the
  fixed provider/status/message strings reach storage.
- No new permissions: `https://gemini.google.com/*` host + content-script match already
  present.

## Error handling / degradation

- Not signed in / signal absent → no report → card stays "not connected yet" (safe).
- If Google removes the `SNlM0e` marker, the worst case is the card never flips to
  connected — it never shows a wrong state.

## Testing (TDD, node env)

- `isStatusReport` guard: true for a well-formed `status:report`; false for
  `usage:report`, missing `provider`, non-objects, null. (Add to `tests/messages.test.ts`.)
- Remove `tests/geminiAdapter.test.ts` (the parser it tested is deleted).
- The content-script signed-in detection and the background message handler are
  entry-point I/O (DOM / `chrome.*`) and are not unit-tested, consistent with the
  existing architecture; verified via build + manual load.

## Out of scope

- Parsing the `batchexecute` usage RPC (the fragile path we deliberately declined).
- Any usage percentage / bar / badge contribution for Gemini.
- Localizing the card copy (English, matching the rest of the UI).
