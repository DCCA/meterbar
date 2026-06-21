# Gemini Connected-Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the Gemini card as "Connected — Gemini shows your usage on its 'Limites de uso' page" when the user is signed into gemini.google.com, with no fabricated usage number.

**Architecture:** A content script on gemini.google.com detects a boolean sign-in signal (the WIZ token key in the page HTML) and sends a new `status:report` message; the background stores it via the existing `storeStatus`; the popup already renders a no-snapshot card's `message`. No background fetch, no usage snapshots, no badge involvement.

**Tech Stack:** TypeScript, Vite, Vitest, Chrome MV3 (content script + background service worker, `chrome.storage.local`).

## Global Constraints

- Truthful uncertainty (PRD): show **no usage percentage** for Gemini; the card states where Google surfaces it. Never display a guessed number or a wrong state.
- Privacy (PRD): store only the fixed provider/status/message strings. Never read, transmit, or persist the WIZ token value, identifiers, or usage data.
- Card copy (verbatim): `Connected — Gemini shows your usage on its 'Limites de uso' page`
- Sign-in signal: presence of the substring `"SNlM0e"` in `document.documentElement.innerHTML` (boolean only).
- No new permissions: `https://gemini.google.com/*` host + content-script match already present.
- Content scripts must stay self-contained — only **type-only** imports (erased at build); no runtime ES imports.
- Pure logic unit-tested in the `node` env; `chrome.*`/DOM only in entry points (content script, background), not unit-tested.
- Git: work on branch `feat/gemini-connected-status` (already created); never commit to `main`.
- Spec: `docs/superpowers/specs/2026-06-20-gemini-connected-status-design.md`.

---

## File Structure

- `src/shared/messages.ts` — **modify**: add the `status:report` message variant + `isStatusReport` guard.
- `src/providers/gemini/geminiAdapter.ts` — **rewrite**: drop the dead `parseGeminiUsage`/`GeminiUsageRaw`; keep the descriptor with `parse: () => []`.
- `src/background/index.ts` — **modify**: handle `status:report` → `storeStatus`.
- `src/content/gemini.ts` — **rewrite**: detect sign-in, send `status:report`.
- `tests/messages.test.ts` — **modify**: add `isStatusReport` tests.
- `tests/geminiAdapter.test.ts` — **delete**: the parser it covered is removed.

---

## Task 1: `status:report` message + guard

**Files:**
- Modify: `src/shared/messages.ts`
- Test: `tests/messages.test.ts`

**Interfaces:**
- Consumes: `ProviderId`, `ProviderCardState` (already imported in `messages.ts`).
- Produces:
  - Union member `{ type: 'status:report'; provider: ProviderId; status: ProviderCardState['status']; message: string }`
  - `isStatusReport(m: unknown): m is Extract<ExtensionMessage, { type: 'status:report' }>`

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `tests/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isStatusReport, isUsageReport, type ExtensionMessage } from '../src/shared/messages';

describe('messages', () => {
  it('recognizes a usage report from a content script', () => {
    const msg: ExtensionMessage = { type: 'usage:report', provider: 'gemini', raw: { x: 1 }, capturedAt: 't' };
    expect(isUsageReport(msg)).toBe(true);
  });
  it('rejects unrelated objects', () => {
    expect(isUsageReport({ type: 'state:get' } as ExtensionMessage)).toBe(false);
    expect(isUsageReport(null)).toBe(false);
  });

  it('recognizes a status report from a content script', () => {
    const msg: ExtensionMessage = { type: 'status:report', provider: 'gemini', status: 'connected', message: 'Connected' };
    expect(isStatusReport(msg)).toBe(true);
  });
  it('rejects non-status messages and malformed input for isStatusReport', () => {
    expect(isStatusReport({ type: 'usage:report', provider: 'gemini' })).toBe(false);
    expect(isStatusReport({ type: 'status:report' })).toBe(false); // missing provider
    expect(isStatusReport(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/messages.test.ts`
Expected: FAIL — `isStatusReport` is not exported and `status:report` is not in `ExtensionMessage`.

- [ ] **Step 3: Implement** — edit `src/shared/messages.ts`. Add the new union member to `ExtensionMessage` (after the `usage:report` line) and append the guard. Result:

```ts
import type { ProviderCardState, ProviderId } from './types';

export type ExtensionMessage =
  | { type: 'usage:report'; provider: ProviderId; raw: unknown; capturedAt: string } // content → bg
  | { type: 'status:report'; provider: ProviderId; status: ProviderCardState['status']; message: string } // content → bg
  | { type: 'usage:refresh' }                                                         // popup → bg
  | { type: 'state:get' }                                                             // popup → bg
  | { type: 'state:result'; cards: ProviderCardState[] };                             // bg → popup

export function isUsageReport(m: unknown): m is Extract<ExtensionMessage, { type: 'usage:report' }> {
  return !!m && typeof m === 'object' && (m as { type?: unknown }).type === 'usage:report'
    && typeof (m as { provider?: unknown }).provider === 'string';
}

export function isStatusReport(m: unknown): m is Extract<ExtensionMessage, { type: 'status:report' }> {
  return !!m && typeof m === 'object' && (m as { type?: unknown }).type === 'status:report'
    && typeof (m as { provider?: unknown }).provider === 'string';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/messages.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/shared/messages.ts tests/messages.test.ts
git commit -m "feat(messages): add status:report message + isStatusReport guard"
```

---

## Task 2: Simplify the Gemini adapter

**Files:**
- Modify: `src/providers/gemini/geminiAdapter.ts` (rewrite)
- Delete: `tests/geminiAdapter.test.ts`

**Interfaces:**
- Produces: `geminiAdapter: ProviderAdapter` (unchanged identity: `provider: 'gemini'`, `label: 'Gemini'`, `collection: { strategy: 'content', matches: ['https://gemini.google.com/*'] }`, `parse: () => []`). Removes the exported `parseGeminiUsage`.

- [ ] **Step 1: Delete the obsolete parser test**

```bash
git rm tests/geminiAdapter.test.ts
```

- [ ] **Step 2: Rewrite the adapter** — replace the entire contents of `src/providers/gemini/geminiAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';

// Gemini surfaces usage only behind a fragile, undocumented `batchexecute` RPC, so we
// deliberately do not parse a usage number. The content script reports connected status
// instead (see src/content/gemini.ts); this adapter emits no usage snapshots.
export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini',
  label: 'Gemini',
  collection: { strategy: 'content', matches: ['https://gemini.google.com/*'] },
  parse: () => []
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0 (nothing imports the removed `parseGeminiUsage`).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all pass (37 tests — the 1 removed Gemini test is gone, Task 1 added 2 net to messages).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(gemini): drop dead usage parser (no number is shown)"
```

---

## Task 3: Background handler + content-script sign-in report

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/content/gemini.ts` (rewrite)

**Interfaces:**
- Consumes: `isStatusReport` (Task 1); `storeStatus` from `src/background/refresh.ts` (signature `storeStatus(provider: ProviderId, label: string, status: ProviderCardState['status'], message?: string): Promise<void>`); `geminiAdapter` (Task 2); existing `ADAPTERS_BY_ID`, `recompute` in `index.ts`.
- Produces: no exported symbols (entry-point wiring).

This task is entry-point I/O (`chrome.*` / DOM) and has no unit test; verified by typecheck + build, and by the manual load in Task 4.

- [ ] **Step 1: Wire the background handler** in `src/background/index.ts`.

Change the refresh import (currently `import { refreshClaude, refreshChatgpt, storeSnapshots } from './refresh';`) to add `storeStatus`:

```ts
import { refreshClaude, refreshChatgpt, storeSnapshots, storeStatus } from './refresh';
```

Change the messages import (currently `import { isUsageReport, type ExtensionMessage } from '../shared/messages';`) to add `isStatusReport`:

```ts
import { isUsageReport, isStatusReport, type ExtensionMessage } from '../shared/messages';
```

In the `chrome.runtime.onMessage.addListener` callback, add this branch immediately after the existing `if (isUsageReport(msg)) { ... }` block:

```ts
  if (isStatusReport(msg)) {
    const adapter = ADAPTERS_BY_ID[msg.provider];
    void storeStatus(msg.provider, adapter?.label ?? msg.provider, msg.status, msg.message).then(recompute);
    return false;
  }
```

- [ ] **Step 2: Rewrite the content script** — replace the entire contents of `src/content/gemini.ts`:

```ts
import type { ExtensionMessage } from '../shared/messages';

// Self-contained (only type-only imports, erased at build) so the bundle loads as an MV3
// classic content script. Gemini exposes usage only behind a fragile batchexecute RPC, so
// instead of parsing a number we report an honest "connected" status when signed in.
const MESSAGE = "Connected — Gemini shows your usage on its 'Limites de uso' page";

// Signed-in app sessions embed the WIZ anti-XSRF token key ("SNlM0e") in the page HTML.
// Its presence is a boolean sign-in signal — we never read or store its value.
function isSignedIn(): boolean {
  return document.documentElement.innerHTML.includes('"SNlM0e"');
}

function report(): void {
  if (!isSignedIn()) return;
  const msg: ExtensionMessage = { type: 'status:report', provider: 'gemini', status: 'connected', message: MESSAGE };
  try { chrome.runtime.sendMessage(msg); } catch { /* stay silent; never surface page errors */ }
}

report();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') report(); });
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Build and verify the content script is still emitted**

Run: `npm run build`
Expected: succeeds. Then:

Run: `ls dist/assets/gemini.js && grep -c gemini.js dist/manifest.json`
Expected: `gemini.js` exists and the grep prints `1` (Gemini's content-script entry is retained).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass (37).

- [ ] **Step 6: Commit**

```bash
git add src/background/index.ts src/content/gemini.ts
git commit -m "feat(gemini): report connected status from the content script"
```

---

## Task 4: Load-and-verify in Chrome (manual)

**Files:** none (verification).

- [ ] **Step 1: Reload the extension**

In `chrome://extensions`, reload the MeterBar card (or Load unpacked → `dist/`).

- [ ] **Step 2: Trigger the content script**

Open (or reload) a **gemini.google.com** tab while signed in. (Reloading the extension does not re-inject into already-open tabs, so the Gemini tab must be loaded after the extension reload.)

- [ ] **Step 3: Verify**

Open the MeterBar popup. Expected: the **Gemini** card shows
`Connected — Gemini shows your usage on its 'Limites de uso' page`
instead of "not connected yet". No percentage bar appears (by design), and the badge is unaffected.

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin feat/gemini-connected-status
gh pr create --base main --title "feat(gemini): honest connected-status card" --body "Implements docs/superpowers/specs/2026-06-20-gemini-connected-status-design.md. Shows Gemini as connected (pointing to its Limites de uso page) when signed in, with no fabricated number — the only usage source is a fragile batchexecute RPC we deliberately don't parse. Content-script sign-in detection → new status:report message → storeStatus. No usage snapshots, no badge change, no stored identifiers. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review

**Spec coverage:**
- Connected card with the exact copy, no number → Task 3 (content script) + Task 1 (message) + relies on existing `storeStatus`/popup. ✓
- Sign-in detection via `"SNlM0e"` presence → Task 3. ✓
- `status:report` message + guard → Task 1. ✓
- Background handler → `storeStatus` → Task 3. ✓
- Drop dead `parseGeminiUsage` → Task 2. ✓
- No popup change (verified: `aggregateCards` preserves status, `cardHtml` renders `message`) → no task needed. ✓
- Privacy (only fixed strings stored; WIZ value never read) → Task 3 checks a boolean substring; the handler stores only provider/label/status/message. ✓
- No new permissions; content-script entry retained → Task 3 Step 4 asserts `gemini.js` + manifest entry remain. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `isStatusReport`, the `status:report` union shape (`provider`/`status`/`message`), `storeStatus(provider, label, status, message)`, `geminiAdapter`, `ADAPTERS_BY_ID`, and the `MESSAGE` copy are identical across Tasks 1–3. The content script uses only the type-only `ExtensionMessage` import (erased at build), satisfying the classic-content-script constraint. ✓
