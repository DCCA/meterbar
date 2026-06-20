# ChatGPT / Codex Live Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ChatGPT/Codex content-script stub with a live adapter that reads account-wide ChatGPT usage (5h + 7d) plus a single Codex bar from `chatgpt.com/backend-api/wham/usage`.

**Architecture:** All network I/O lives in the background worker (`refreshChatgpt`, mirroring `refreshClaude`); the adapter stays a pure, unit-tested boundary (`parseChatgptUsage`, `pickChatgptAccountId`, URL builders). Auth is a session-minted Bearer token used transiently and never stored.

**Tech Stack:** TypeScript, Vite, Vitest, Chrome MV3 (background service worker, `chrome.storage.local`).

## Global Constraints

- Privacy (PRD): store **only** usage metrics — percentages, reset timestamps, provider name. Never persist `email`, `account_id`, `user_id`, `plan_type`, the access token, or cookies.
- Confidence: `exact` for all ChatGPT/Codex snapshots (clean structured JSON, validated live) — consistent with Claude.
- `used_percent` from the endpoint is already 0–100; `usedRatio = used_percent / 100`.
- `reset_at` is Unix epoch **seconds**; convert to ISO 8601.
- Pure logic is unit-tested in the `node` env; `chrome.*` and `fetch` only in `src/background/` entry points, never in `src/providers/`.
- No new permissions: `https://chatgpt.com/*` is already in `host_permissions`.
- Git: work on branch `feat/chatgpt-codex-live-usage` (already created); never commit to `main`.
- Spec: `docs/superpowers/specs/2026-06-20-chatgpt-codex-usage-design.md`.

---

## File Structure

- `src/providers/chatgpt/chatgptAdapter.ts` — **rewrite**: pure parser for the `wham/usage` shape, the pure `pickChatgptAccountId` helper, URL builders, and the adapter descriptor (now `fetch` strategy). No `fetch`.
- `src/background/refresh.ts` — **modify**: add `refreshChatgpt` (3-step background fetch), reusing the existing `SESSION_FETCH` and `isAuthFailure` helpers.
- `src/background/index.ts` — **modify**: call `refreshChatgpt` from `refreshAll` when ChatGPT is enabled.
- `src/content/chatgpt.ts` — **delete**: obsolete content-script stub.
- `manifest.json` — **modify**: remove the ChatGPT `content_scripts` entry.
- `vite.config.ts` — **modify**: remove the `chatgpt` build input.
- `tests/chatgptAdapter.test.ts` — **rewrite**: tests for the new parser + account-id picker.

---

## Task 1: ChatGPT usage parser + adapter descriptor

**Files:**
- Modify: `src/providers/chatgpt/chatgptAdapter.ts` (full rewrite)
- Test: `tests/chatgptAdapter.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `UsageSnapshot`, `UsageWindow` from `src/shared/types.ts`; `ProviderAdapter` from `src/providers/providerAdapter.ts`.
- Produces:
  - `parseChatgptUsage(payload: ChatgptUsageResponse, now?: Date): UsageSnapshot[]`
  - `CHATGPT_ORIGIN: string`, `chatgptSessionUrl(): string`, `chatgptAccountsUrl(): string`, `chatgptUsageUrl(): string`
  - `chatgptAdapter: ProviderAdapter`
  - (`pickChatgptAccountId` is added in Task 2.)

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `tests/chatgptAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseChatgptUsage } from '../src/providers/chatgpt/chatgptAdapter';

const NOW = new Date('2026-06-20T16:16:00Z');

// Sanitized capture from a live logged-in chatgpt.com session (2026-06-20).
const CAPTURED = {
  rate_limit: {
    primary_window:   { used_percent: 27, limit_window_seconds: 18000,  reset_at: 1781989386 },
    secondary_window: { used_percent: 39, limit_window_seconds: 604800, reset_at: 1782342911 }
  },
  additional_rate_limits: [
    {
      limit_name: 'GPT-5.3-Codex-Spark',
      rate_limit: {
        primary_window:   { used_percent: 4,  reset_at: 1782001249 },
        secondary_window: { used_percent: 11, reset_at: 1782588049 }
      }
    }
  ]
};

describe('parseChatgptUsage', () => {
  it('maps the main rate_limit to five_hour + seven_day ChatGPT windows', () => {
    const snaps = parseChatgptUsage(CAPTURED, NOW);
    expect(snaps).toMatchObject([
      { provider: 'chatgpt', window: 'five_hour', usedPercent: 27, usedRatio: 0.27, confidence: 'exact', stale: false },
      { provider: 'chatgpt', window: 'seven_day', usedPercent: 39, confidence: 'exact' },
      { provider: 'chatgpt', workspaceLabel: 'Codex', usedPercent: 11 }
    ]);
  });

  it('converts reset_at epoch seconds to an ISO timestamp', () => {
    const [primary] = parseChatgptUsage(CAPTURED, NOW);
    expect(primary.resetsAt).toBe(new Date(1781989386 * 1000).toISOString());
  });

  it('emits one Codex bar = the riskiest additional window across entries', () => {
    const codex = parseChatgptUsage(CAPTURED, NOW).find((s) => s.workspaceLabel === 'Codex');
    expect(codex).toMatchObject({ window: 'seven_day', usedPercent: 11 });
    expect(codex?.resetsAt).toBe(new Date(1782588049 * 1000).toISOString());
  });

  it('omits the Codex bar when there are no additional rate limits', () => {
    const snaps = parseChatgptUsage({ rate_limit: CAPTURED.rate_limit, additional_rate_limits: [] }, NOW);
    expect(snaps.some((s) => s.workspaceLabel === 'Codex')).toBe(false);
    expect(snaps).toHaveLength(2);
  });

  it('skips windows missing a numeric used_percent', () => {
    expect(parseChatgptUsage({ rate_limit: { primary_window: {}, secondary_window: null } }, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/chatgptAdapter.test.ts`
Expected: FAIL — the new shape (`rate_limit`, `workspaceLabel: 'Codex'`, epoch `reset_at`) doesn't match the current `parseChatgptUsage` (which reads `used`/`limit`).

- [ ] **Step 3: Rewrite the adapter** — replace the entire contents of `src/providers/chatgpt/chatgptAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface ChatgptWindow { used_percent?: number; reset_at?: number; }
interface ChatgptRateLimit { primary_window?: ChatgptWindow | null; secondary_window?: ChatgptWindow | null; }
interface ChatgptAdditionalLimit { limit_name?: string; rate_limit?: ChatgptRateLimit | null; }
interface ChatgptUsageResponse {
  rate_limit?: ChatgptRateLimit | null;
  additional_rate_limits?: ChatgptAdditionalLimit[] | null;
}

function epochToIso(seconds?: number): string | undefined {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : undefined;
}

function snapshot(window: UsageWindow, w: ChatgptWindow, capturedAt: string, workspaceLabel?: string): UsageSnapshot | null {
  if (typeof w.used_percent !== 'number') return null;
  return {
    provider: 'chatgpt',
    window,
    ...(workspaceLabel ? { workspaceLabel } : {}),
    usedRatio: w.used_percent / 100,
    usedPercent: Math.round(w.used_percent),
    resetsAt: epochToIso(w.reset_at),
    capturedAt,
    source: 'chatgpt-wham-usage',
    confidence: 'exact',
    stale: false
  };
}

/**
 * Pure parser (no I/O). `used_percent` is already a 0-100 percent. Confidence is
 * `exact`: clean structured JSON from a usage endpoint, validated against a real
 * logged-in response on 2026-06-20 (the captured fixture in the test file).
 */
export function parseChatgptUsage(payload: ChatgptUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const out: UsageSnapshot[] = [];

  // Account-wide ChatGPT usage: primary = 5h window, secondary = 7d window.
  const main = payload.rate_limit ?? {};
  const primary = main.primary_window ? snapshot('five_hour', main.primary_window, capturedAt) : null;
  const secondary = main.secondary_window ? snapshot('seven_day', main.secondary_window, capturedAt) : null;
  if (primary) out.push(primary);
  if (secondary) out.push(secondary);

  // One Codex bar = the single riskiest window across every additional rate limit.
  let riskiest: { window: UsageWindow; w: ChatgptWindow } | null = null;
  let riskiestPct = -1;
  for (const entry of payload.additional_rate_limits ?? []) {
    const rl = entry.rate_limit ?? {};
    const candidates: Array<[UsageWindow, ChatgptWindow | null | undefined]> = [
      ['five_hour', rl.primary_window],
      ['seven_day', rl.secondary_window]
    ];
    for (const [window, w] of candidates) {
      if (!w || typeof w.used_percent !== 'number') continue;
      if (w.used_percent > riskiestPct) { riskiestPct = w.used_percent; riskiest = { window, w }; }
    }
  }
  if (riskiest) {
    const codex = snapshot(riskiest.window, riskiest.w, capturedAt, 'Codex');
    if (codex) out.push(codex);
  }

  return out;
}

// --- Pure endpoint helpers (background worker performs the actual fetches) ---
export const CHATGPT_ORIGIN = 'https://chatgpt.com';
export function chatgptSessionUrl(): string { return `${CHATGPT_ORIGIN}/api/auth/session`; }
export function chatgptAccountsUrl(): string { return `${CHATGPT_ORIGIN}/backend-api/accounts/check/v4-2023-04-27`; }
export function chatgptUsageUrl(): string { return `${CHATGPT_ORIGIN}/backend-api/wham/usage`; }

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt',
  label: 'ChatGPT / Codex',
  // `fetch` strategy via the background worker (Bearer token minted from the session
  // cookie); nothing is stored. `endpoint` documents the usage call.
  collection: { strategy: 'fetch', endpoint: chatgptUsageUrl(), init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseChatgptUsage(raw as ChatgptUsageResponse)
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/chatgptAdapter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/providers/chatgpt/chatgptAdapter.ts tests/chatgptAdapter.test.ts
git commit -m "feat(chatgpt): parse live wham/usage shape into snapshots"
```

---

## Task 2: Account-id picker (pure)

**Files:**
- Modify: `src/providers/chatgpt/chatgptAdapter.ts` (add `pickChatgptAccountId`)
- Test: `tests/chatgptAdapter.test.ts` (add a `describe` block)

**Interfaces:**
- Produces: `pickChatgptAccountId(body: unknown): string | null`

- [ ] **Step 1: Write the failing tests** — append to `tests/chatgptAdapter.test.ts`, and add `pickChatgptAccountId` to the existing import from `../src/providers/chatgpt/chatgptAdapter`:

```ts
describe('pickChatgptAccountId', () => {
  it('returns the first account_id from the accounts map', () => {
    const body = { accounts: { default: { account: { account_id: 'acct-123' } } } };
    expect(pickChatgptAccountId(body)).toBe('acct-123');
  });

  it('returns null for a missing, empty, or malformed accounts map', () => {
    expect(pickChatgptAccountId(null)).toBeNull();
    expect(pickChatgptAccountId({})).toBeNull();
    expect(pickChatgptAccountId({ accounts: {} })).toBeNull();
    expect(pickChatgptAccountId({ accounts: { x: {} } })).toBeNull();
  });
});
```

The import line at the top of the file becomes:

```ts
import { parseChatgptUsage, pickChatgptAccountId } from '../src/providers/chatgpt/chatgptAdapter';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/chatgptAdapter.test.ts`
Expected: FAIL — `pickChatgptAccountId` is not exported.

- [ ] **Step 3: Implement the helper** — add to `src/providers/chatgpt/chatgptAdapter.ts`, just above the `chatgptAdapter` export:

```ts
interface ChatgptAccountsCheck { accounts?: Record<string, { account?: { account_id?: string } }>; }

/**
 * Choose the account whose usage to read from the `/backend-api/accounts/check`
 * response (the first account with an id). Pure: the response is fetched by the
 * background worker. The id is used only to build the request header, never stored.
 */
export function pickChatgptAccountId(body: unknown): string | null {
  const accounts = (body as ChatgptAccountsCheck | null)?.accounts;
  if (!accounts || typeof accounts !== 'object') return null;
  for (const entry of Object.values(accounts)) {
    const id = entry?.account?.account_id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/chatgptAdapter.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/providers/chatgpt/chatgptAdapter.ts tests/chatgptAdapter.test.ts
git commit -m "feat(chatgpt): pure account-id selection from accounts/check"
```

---

## Task 3: Background `refreshChatgpt` + wiring

**Files:**
- Modify: `src/background/refresh.ts` (add `refreshChatgpt`)
- Modify: `src/background/index.ts` (call it from `refreshAll`)

**Interfaces:**
- Consumes: `chatgptAdapter`, `chatgptSessionUrl`, `chatgptAccountsUrl`, `chatgptUsageUrl`, `pickChatgptAccountId` (Tasks 1–2); existing `SESSION_FETCH`, `isAuthFailure`, `storeSnapshots`, `storeStatus` in `refresh.ts`.
- Produces: `refreshChatgpt(): Promise<void>`

This task has no unit test — it is `fetch` I/O in the background entry point (per the architecture rule, not unit-tested). It is verified by typecheck + build here and by the live load-and-verify in Task 5.

- [ ] **Step 1: Add the import** to the top of `src/background/refresh.ts`, after the existing `claudeAdapter` import line:

```ts
import { chatgptAdapter, chatgptSessionUrl, chatgptAccountsUrl, chatgptUsageUrl, pickChatgptAccountId } from '../providers/chatgpt/chatgptAdapter';
```

- [ ] **Step 2: Add `refreshChatgpt`** at the end of `src/background/refresh.ts`:

```ts
/**
 * Background refresh for ChatGPT/Codex. Mints a Bearer access token from the session
 * cookie (`/api/auth/session`), resolves the account id, then reads `wham/usage`. The
 * token and account id are used only for the requests and never stored. All network
 * I/O and HTTP->status mapping live here; the adapter contributes only pure helpers.
 */
export async function refreshChatgpt(): Promise<void> {
  const { provider, label } = chatgptAdapter;
  try {
    const sessionRes = await fetch(chatgptSessionUrl(), SESSION_FETCH);
    if (isAuthFailure(sessionRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!sessionRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${sessionRes.status}`);
    const token = ((await sessionRes.json()) as { accessToken?: string })?.accessToken;
    if (!token) return storeStatus(provider, label, 'not_connected', 'Not logged in.');

    const authInit: RequestInit = { credentials: 'include', headers: { accept: 'application/json', authorization: `Bearer ${token}` } };
    const acctRes = await fetch(chatgptAccountsUrl(), authInit);
    const accountId = acctRes.ok ? pickChatgptAccountId(await acctRes.json()) : null;

    const usageHeaders: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${token}` };
    if (accountId) usageHeaders['ChatGPT-Account-Id'] = accountId;
    const usageRes = await fetch(chatgptUsageUrl(), { credentials: 'include', headers: usageHeaders });
    if (isAuthFailure(usageRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!usageRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${usageRes.status}`);

    await storeSnapshots(provider, label, chatgptAdapter.parse(await usageRes.json()));
  } catch {
    await storeStatus(provider, label, 'stale', 'Fetch failed.');
  }
}
```

- [ ] **Step 3: Wire it into `refreshAll`** in `src/background/index.ts`. Change the import on line 3 from:

```ts
import { refreshClaude, storeSnapshots } from './refresh';
```

to:

```ts
import { refreshClaude, refreshChatgpt, storeSnapshots } from './refresh';
```

Then update `refreshAll` — replace:

```ts
async function refreshAll(): Promise<void> {
  const settings = await loadSettings();
  // Claude is the only background-fetch provider; ChatGPT/Gemini report via content scripts.
  if (isEnabled('claude', settings)) await refreshClaude();
  await recompute();
}
```

with:

```ts
async function refreshAll(): Promise<void> {
  const settings = await loadSettings();
  // Claude and ChatGPT/Codex are background-fetch providers; Gemini reports via a content script.
  await Promise.all([
    isEnabled('claude', settings) ? refreshClaude() : Promise.resolve(),
    isEnabled('chatgpt', settings) ? refreshChatgpt() : Promise.resolve()
  ]);
  await recompute();
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: succeeds; `dist/assets/background.js` produced.

- [ ] **Step 6: Commit**

```bash
git add src/background/refresh.ts src/background/index.ts
git commit -m "feat(chatgpt): background refresh via session-minted bearer token"
```

---

## Task 4: Remove the obsolete content-script stub

**Files:**
- Delete: `src/content/chatgpt.ts`
- Modify: `manifest.json` (remove ChatGPT `content_scripts` entry)
- Modify: `vite.config.ts` (remove `chatgpt` input)

**Interfaces:** none (cleanup).

- [ ] **Step 1: Delete the stub**

```bash
git rm src/content/chatgpt.ts
```

- [ ] **Step 2: Remove the ChatGPT content script from `manifest.json`** — replace the `content_scripts` array (lines 22–33) with the Gemini-only version:

```json
  "content_scripts": [
    {
      "matches": ["https://gemini.google.com/*"],
      "js": ["assets/gemini.js"],
      "run_at": "document_idle"
    }
  ],
```

- [ ] **Step 3: Remove the `chatgpt` build input from `vite.config.ts`** — delete this line from the `input` object (line 24):

```ts
        chatgpt: resolve(__dirname, 'src/content/chatgpt.ts'),
```

The `input` object should then contain only `background`, `popup`, `options`, and `gemini`.

- [ ] **Step 4: Build and verify the stub is gone**

Run: `npm run build`
Expected: succeeds. Then:

Run: `ls dist/assets/chatgpt.js 2>&1; grep -c chatgpt.js dist/manifest.json`
Expected: `chatgpt.js` does not exist (No such file) and the grep prints `0`.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm run typecheck && npm test`
Expected: typecheck exit 0; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(chatgpt): drop obsolete content-script stub (now background-fetch)"
```

---

## Task 5: Load-and-verify in Chrome (manual)

**Files:** none (verification).

This is the empirical check the spec flagged: confirm `/api/auth/session` + `wham/usage` succeed from the **service-worker** context, not just the page console.

- [ ] **Step 1: Reload the extension**

In `chrome://extensions`, reload the MeterBar card (or Load unpacked → `dist/`).

- [ ] **Step 2: Trigger a refresh**

Open the popup and click **Refresh** (or open the service-worker console and wait for the alarm).

- [ ] **Step 3: Verify**

Expected: the **ChatGPT / Codex** card shows `five hour ~27%`, `seven day ~39%` (your live values), and a **Codex** bar; all marked `exact`; the badge reflects the riskiest fresh window. The card must NOT say "not connected".

- [ ] **Step 4: If it shows "Not logged in" while logged into chatgpt.com**

The service worker can't mint the token. Open the service-worker console (the "service worker" link on the extension card) to see which fetch failed, and fall back to the content-script approach: re-add a `src/content/chatgpt.ts` that performs the same three same-origin fetches and relays the parsed `wham/usage` body via `chrome.runtime.sendMessage({ type: 'usage:report', provider: 'chatgpt', raw, capturedAt })`, plus restore the manifest/vite entries. The pure `parseChatgptUsage` is reused unchanged.

- [ ] **Step 5: Push the branch and open a PR**

```bash
git push -u origin feat/chatgpt-codex-live-usage
gh pr create --base main --title "feat(chatgpt): live ChatGPT/Codex usage from wham/usage" --body "Implements docs/superpowers/specs/2026-06-20-chatgpt-codex-usage-design.md. Reads account-wide ChatGPT usage (5h/7d) + one Codex bar from chatgpt.com/backend-api/wham/usage via a session-minted bearer token. Stores no credentials. 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-Review

**Spec coverage:**
- Endpoint + 3-step auth flow → Task 3. ✓
- Parse primary→5h, secondary→7d, one Codex bar (riskiest), epoch→ISO, `exact` → Task 1. ✓
- Account-id resolution (pure, may be skippable) → Task 2 + Task 3 (sent only when resolved). ✓
- Privacy (no email/account_id/user_id/plan_type/token stored) → parser ignores them; `refreshChatgpt` never calls `storeStatus`/`storeSnapshots` with identifiers. ✓
- Remove content-script stub → Task 4. ✓
- Pure boundary / I/O in background → Tasks 1–2 pure + tested; Task 3 I/O only. ✓
- No new permissions → confirmed (host already present); no manifest permission change. ✓
- Validation risk + content-script fallback → Task 5 Step 4. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `parseChatgptUsage`, `pickChatgptAccountId`, `chatgptSessionUrl`/`chatgptAccountsUrl`/`chatgptUsageUrl`, `chatgptAdapter` names are identical across Tasks 1–3 and the imports in `refresh.ts`. `refreshChatgpt` reuses the existing `SESSION_FETCH`/`isAuthFailure`/`storeStatus`/`storeSnapshots` from `refresh.ts` (added in PR #2). ✓
