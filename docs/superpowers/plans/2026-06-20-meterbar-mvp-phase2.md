# MeterBar MVP + Phase 2 Implementation Plan

> **Execution model:** Work task-by-task. Each task is independently committable and gated by `npm test` + `npm run typecheck` + `npm run build`. Steps use checkbox (`- [ ]`) syntax for tracking. This plan was authored without the `superpowers` plugin installed; it follows the same task/TDD structure as `2026-06-20-meterbar-mvp.md` so either can drive execution.

**Goal:** Ship a privacy-first Chrome MV3 extension that shows **real** AI usage limits — a live Claude adapter (not a stub), plus Phase 2 ChatGPT/Codex and Gemini adapters, usage history with trend sparklines, and CSV/JSON export — all local-first.

**Relationship to the scaffold plan:** `2026-06-20-meterbar-mvp.md` (Tasks 1–8) is **Phase 0** of this plan: it creates the project, the canonical `UsageSnapshot` types, `time` helpers, the `badge` calculator, the `alerts` de-dup primitives, the mock-data popup, the privacy options page, the background skeleton, and the Claude **parser boundary**. This plan **keeps** all the pure/testable pieces and **replaces** the mock/boundary wiring with real collection. Run Phase 0 first; do not re-create those files here.

**Tech Stack:** Chrome Extension MV3, TypeScript, Vite, Vitest, vanilla HTML/CSS, `chrome.storage.local`, `chrome.alarms`, `chrome.notifications`, content scripts. No runtime dependencies, no backend.

---

## Architecture (what this plan adds)

### Collection: two strategies behind one pure parser

Every provider implements a `ProviderAdapter` whose **`parse(raw) → UsageSnapshot[]` is a pure function** tested against captured fixtures. How `raw` is obtained is declared as *data* via a collection strategy:

- **`fetch` strategy (preferred):** the **background service worker** periodically `fetch`es the provider's usage endpoint with `credentials: 'include'`. With `host_permissions` for the provider domain, the request carries the user's existing session and bypasses CORS. This works **even when no provider tab is open**, which is what keeps the badge fresh within the PRD's 10-minute target. Used for **Claude**.
- **`content` strategy (fallback):** a **content script** on the provider's domain reads usage the page already loaded (intercepted `fetch`/JSON or DOM) and relays it to the worker. Used when there is no clean background-fetchable endpoint. Used for **ChatGPT/Codex** and **Gemini** until/unless a clean endpoint is validated.

```
            fetch strategy                         content strategy
 ┌──────────────────────────┐          ┌──────────────────────────────────┐
 │ background SW (alarm)     │          │ provider tab → content script    │
 │  fetch(endpoint, creds)   │          │  collect raw (intercept/DOM)     │
 │        ↓ raw              │          │        ↓ runtime.sendMessage     │
 └──────────┼───────────────┘          └──────────────┼───────────────────┘
            └───────────────►  background SW  ◄────────┘
                                    │  adapter.parse(raw) → UsageSnapshot[]
                                    │  storeSnapshots: latest + history append
                                    │  aggregate → badge → evaluate alerts
                                    ▼
                         chrome.storage.local  ──►  popup reads `latest:*` (<300ms)
```

### Truthful uncertainty drives `confidence`

`parse()` sets `confidence` from the **source quality**, not optimism: a clean JSON usage endpoint → `exact`; a value scraped from rendered DOM or inferred from partial signals → `estimated`/`inferred`; nothing usable → the card reports `unavailable`/`not_connected`. Endpoints are undocumented, so each adapter task includes an explicit **manual validation step**; until validated, the adapter ships reporting `unsupported` rather than guessing. No aggressive endpoint probing — only what the logged-in UI already does (PRD §5, §14 Q5).

### Storage shape

`chrome.storage.local` keys:
- `latest:<provider>` → `ProviderCardState` (newest snapshots per provider) — the popup/badge read path, kept tiny for <300ms loads.
- `history:<provider>:<window>` → `Array<[t, p]>` compact `[epochMs, percent]` tuples, pruned/downsampled to stay under the PRD's <100KB/day budget.
- `settings` → per-provider enable flags + notifications toggle.
- `alertState` → `{ seen: string[]; lastReset: Record<string,string> }` for notification de-dup and reset detection.

### Resolved open questions (PRD §14), scoped to MVP + Phase 2

- **Q1 order after Claude:** build both; implement **ChatGPT/Codex before Gemini**. Swappable — they are independent tasks.
- **Q2 ChatGPT vs Codex:** treat as a **single `chatgpt` card** that may expose multiple windows (a Codex sub-window if surfaced). Keep `codex` in the enum for a future split.
- **Q3 self-hosted endpoint:** no — stays pure local extension (PRD §7).
- **Q5 endpoint discovery:** observe-and-validate only; codify after manual inspection.

---

## New / changed file map

- `src/storage/usageStore.ts` — **modify**: latest-card read/write, settings, alert state.
- `src/storage/historyStore.ts` — **new**: append + prune/downsample + read + clear time series.
- `src/shared/messages.ts` — **new**: typed content↔worker↔popup message protocol + guards.
- `src/shared/sparkline.ts` — **new**: pure points → SVG path.
- `src/shared/exporters.ts` — **new**: pure history → JSON / CSV.
- `src/providers/providerAdapter.ts` — **modify**: add `label`, `collection` strategy, pure `parse`.
- `src/background/aggregate.ts` — **new**: assemble card states from storage + settings + staleness.
- `src/background/refresh.ts` — **new**: fetch-strategy refresh + snapshot persistence orchestration.
- `src/background/index.ts` — **modify**: alarm loop, message router, badge + alert recompute (replaces mock wiring).
- `src/background/alerts.ts` — **modify**: `evaluateAlerts` (70/90 crossing + reset detected) on top of existing de-dup primitives.
- `src/providers/claude/claudeAdapter.ts` — **modify**: real `fetch` strategy + validated parser.
- `src/content/collector.ts` — **new**: shared content-script collection runtime.
- `src/providers/chatgpt/chatgptAdapter.ts` + `src/content/chatgpt.ts` — **new**.
- `src/providers/gemini/geminiAdapter.ts` + `src/content/gemini.ts` — **new**.
- `src/popup/popup.ts` / `popup.css` — **modify**: render from storage + sparklines + status/confidence.
- `src/options/options.ts` / `options.html` — **modify**: per-provider toggles + export buttons.
- `manifest.json` — **modify**: `content_scripts`, `host_permissions`, content-script bundles.
- `vite.config.ts` — **modify**: add content-script entry points.
- `tests/*.test.ts` — **new**: history, messages, aggregate, alerts-eval, each parser, sparkline, exporters.

---

### Task 1: Real storage layer — latest cards + pruned history

**Files:**
- Modify: `src/storage/usageStore.ts`
- Create: `src/storage/historyStore.ts`
- Create: `tests/historyStore.test.ts`

- [ ] **Step 1: Write history prune tests (pure logic first)**

Create `tests/historyStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { appendPoint, pruneSeries } from '../src/storage/historyStore';

const H = 60 * 60 * 1000;

describe('history series', () => {
  it('appends a compact [t, p] tuple', () => {
    expect(appendPoint([], Date.parse('2026-06-20T12:00:00Z'), 62)).toEqual([
      [Date.parse('2026-06-20T12:00:00Z'), 62]
    ]);
  });

  it('keeps recent points at full resolution and downsamples older ones hourly', () => {
    const now = Date.parse('2026-06-21T12:00:00Z');
    const series: Array<[number, number]> = [];
    // two points in the same old hour (26h ago) collapse to one; recent point stays
    series.push([now - 26 * H, 10], [now - 26 * H + 5 * 60000, 20], [now - 1 * H, 80]);
    const pruned = pruneSeries(series, now, { rawWindowMs: 24 * H, maxPoints: 500 });
    expect(pruned).toEqual([
      [now - 26 * H + 5 * 60000, 20], // last value wins within the old hour bucket
      [now - 1 * H, 80]
    ]);
  });

  it('caps total points', () => {
    const now = Date.now();
    const many: Array<[number, number]> = Array.from({ length: 600 }, (_, i) => [now - i * 60000, i % 100]);
    expect(pruneSeries(many, now, { rawWindowMs: 24 * H, maxPoints: 500 }).length).toBeLessThanOrEqual(500);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
npm test -- tests/historyStore.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement history store**

Create `src/storage/historyStore.ts`:

```ts
import type { ProviderId, UsageWindow } from '../shared/types';

export type Point = [t: number, p: number];
export interface PruneOptions {
  rawWindowMs: number; // keep points newer than this at full resolution
  maxPoints: number;   // hard cap on stored points per series
}

const DEFAULTS: PruneOptions = { rawWindowMs: 24 * 60 * 60 * 1000, maxPoints: 500 };

export function appendPoint(series: Point[], t: number, p: number): Point[] {
  return [...series, [t, Math.round(p)]];
}

/** Full-res inside rawWindow; older points collapsed to one (last) per hour; capped. */
export function pruneSeries(series: Point[], now: number, opts: PruneOptions = DEFAULTS): Point[] {
  const cutoff = now - opts.rawWindowMs;
  const recent = series.filter(([t]) => t >= cutoff);
  const older = series.filter(([t]) => t < cutoff);

  const hourly = new Map<number, Point>();
  for (const [t, p] of older) hourly.set(Math.floor(t / 3_600_000), [t, p]); // last write wins

  const merged = [...hourly.values(), ...recent].sort((a, b) => a[0] - b[0]);
  return merged.length > opts.maxPoints ? merged.slice(merged.length - opts.maxPoints) : merged;
}

function key(provider: ProviderId, window: UsageWindow): string {
  return `history:${provider}:${window}`;
}

export async function recordPoint(provider: ProviderId, window: UsageWindow, t: number, p: number): Promise<void> {
  const k = key(provider, window);
  const stored = (await chrome.storage.local.get(k))[k] as Point[] | undefined;
  await chrome.storage.local.set({ [k]: pruneSeries(appendPoint(stored ?? [], t, p), Date.now()) });
}

export async function readSeries(provider: ProviderId, window: UsageWindow): Promise<Point[]> {
  const k = key(provider, window);
  return ((await chrome.storage.local.get(k))[k] as Point[] | undefined) ?? [];
}

export async function readAllHistory(): Promise<Record<string, Point[]>> {
  const all = await chrome.storage.local.get(null);
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('history:'))) as Record<string, Point[]>;
}

export async function clearHistory(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const historyKeys = Object.keys(all).filter((k) => k.startsWith('history:'));
  await chrome.storage.local.remove(historyKeys);
}
```

Modify `src/storage/usageStore.ts` to own latest cards + settings + alert state:

```ts
import type { ProviderCardState, ProviderId } from '../shared/types';

export interface Settings {
  notificationsEnabled: boolean;
  claudeEnabled: boolean;
  chatgptEnabled: boolean;
  geminiEnabled: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true, claudeEnabled: true, chatgptEnabled: true, geminiEnabled: true
};

export interface AlertState { seen: string[]; lastReset: Record<string, string>; }

export async function putCard(card: ProviderCardState): Promise<void> {
  await chrome.storage.local.set({ [`latest:${card.provider}`]: card });
}
export async function getCard(provider: ProviderId): Promise<ProviderCardState | undefined> {
  const k = `latest:${provider}`;
  return (await chrome.storage.local.get(k))[k] as ProviderCardState | undefined;
}
export async function getAllCards(): Promise<ProviderCardState[]> {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all).filter(([k]) => k.startsWith('latest:')).map(([, v]) => v as ProviderCardState);
}
export async function loadSettings(): Promise<Settings> {
  return (await chrome.storage.local.get(DEFAULT_SETTINGS)) as Settings;
}
export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set(s);
}
export async function loadAlertState(): Promise<AlertState> {
  return ((await chrome.storage.local.get({ alertState: { seen: [], lastReset: {} } })).alertState) as AlertState;
}
export async function saveAlertState(a: AlertState): Promise<void> {
  await chrome.storage.local.set({ alertState: a });
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- tests/historyStore.test.ts
npm run typecheck
git add src/storage tests/historyStore.test.ts
git commit -m "feat: add latest-card and pruned-history storage"
```

---

### Task 2: Typed message protocol

**Files:**
- Create: `src/shared/messages.ts`
- Create: `tests/messages.test.ts`

- [ ] **Step 1: Tests**

Create `tests/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isUsageReport, type ExtensionMessage } from '../src/shared/messages';

describe('messages', () => {
  it('recognizes a usage report from a content script', () => {
    const msg: ExtensionMessage = { type: 'usage:report', provider: 'gemini', raw: { x: 1 }, capturedAt: 't' };
    expect(isUsageReport(msg)).toBe(true);
  });
  it('rejects unrelated objects', () => {
    expect(isUsageReport({ type: 'state:get' } as ExtensionMessage)).toBe(false);
    expect(isUsageReport(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement (after a failing run)**

Create `src/shared/messages.ts`:

```ts
import type { ProviderCardState, ProviderId } from './types';

export type ExtensionMessage =
  | { type: 'usage:report'; provider: ProviderId; raw: unknown; capturedAt: string } // content → bg
  | { type: 'usage:refresh' }                                                         // popup → bg
  | { type: 'state:get' }                                                             // popup → bg
  | { type: 'state:result'; cards: ProviderCardState[] };                             // bg → popup

export function isUsageReport(m: unknown): m is Extract<ExtensionMessage, { type: 'usage:report' }> {
  return !!m && typeof m === 'object' && (m as { type?: unknown }).type === 'usage:report'
    && typeof (m as { provider?: unknown }).provider === 'string';
}
```

- [ ] **Step 3: Pass + commit**

```bash
npm test -- tests/messages.test.ts && npm run typecheck
git add src/shared/messages.ts tests/messages.test.ts
git commit -m "feat: add typed extension message protocol"
```

---

### Task 3: Adapter interface + card aggregation

**Files:**
- Modify: `src/providers/providerAdapter.ts`
- Create: `src/background/aggregate.ts`
- Create: `tests/aggregate.test.ts`

- [ ] **Step 1: Redefine the adapter contract**

Replace `src/providers/providerAdapter.ts`:

```ts
import type { ProviderId, UsageSnapshot } from '../shared/types';

export type CollectionStrategy =
  | { strategy: 'fetch'; endpoint: string; init?: RequestInit }
  | { strategy: 'content'; matches: string[] };

export interface ProviderAdapter {
  provider: ProviderId;
  label: string;
  collection: CollectionStrategy;
  /** Pure + deterministic: same raw + now → same snapshots. No I/O. */
  parse(raw: unknown, now?: Date): UsageSnapshot[];
}
```

- [ ] **Step 2: Aggregation tests**

Create `tests/aggregate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aggregateCards } from '../src/background/aggregate';
import type { ProviderCardState } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/storage/usageStore';

function card(provider: ProviderCardState['provider'], pct: number, capturedAt: string): ProviderCardState {
  return {
    provider, label: provider, status: 'connected', lastUpdatedAt: capturedAt,
    snapshots: [{ provider, window: 'five_hour', usedRatio: pct / 100, usedPercent: pct, capturedAt, source: 't', confidence: 'exact', stale: false }]
  };
}

describe('aggregateCards', () => {
  it('marks snapshots stale past max age and downgrades status', () => {
    const now = new Date('2026-06-20T12:30:00Z');
    const [c] = aggregateCards([card('claude', 50, '2026-06-20T12:00:00Z')], DEFAULT_SETTINGS, now);
    expect(c.snapshots[0].stale).toBe(true);
    expect(c.status).toBe('stale');
  });

  it('drops providers disabled in settings', () => {
    const now = new Date('2026-06-20T12:00:10Z');
    const cards = aggregateCards([card('gemini', 20, '2026-06-20T12:00:00Z')], { ...DEFAULT_SETTINGS, geminiEnabled: false }, now);
    expect(cards).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Implement aggregate**

Create `src/background/aggregate.ts`:

```ts
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { isStale } from '../shared/time';
import type { Settings } from '../storage/usageStore';

const ENABLED: Record<ProviderId, keyof Settings | null> = {
  claude: 'claudeEnabled', chatgpt: 'chatgptEnabled', gemini: 'geminiEnabled', codex: 'chatgptEnabled', unknown: null
};

export function aggregateCards(cards: ProviderCardState[], settings: Settings, now: Date = new Date()): ProviderCardState[] {
  return cards
    .filter((c) => { const key = ENABLED[c.provider]; return key ? settings[key] : true; })
    .map((c) => {
      const snapshots = c.snapshots.map((s) => ({ ...s, stale: isStale(s.capturedAt, now) }));
      const anyStale = snapshots.some((s) => s.stale);
      const status: ProviderCardState['status'] = snapshots.length === 0 ? c.status : anyStale ? 'stale' : 'connected';
      return { ...c, snapshots, status };
    });
}

export function flattenSnapshots(cards: ProviderCardState[]): UsageSnapshot[] {
  return cards.flatMap((c) => c.snapshots);
}
```

- [ ] **Step 4: Pass + commit**

```bash
npm test -- tests/aggregate.test.ts && npm run typecheck
git add src/providers/providerAdapter.ts src/background/aggregate.ts tests/aggregate.test.ts
git commit -m "feat: provider collection strategy + card aggregation"
```

---

### Task 4: Background refresh engine + badge wiring

**Files:**
- Create: `src/background/refresh.ts`
- Modify: `src/background/index.ts`

> `index.ts` currently (Phase 0) pushes mock data to the badge. This task replaces that with the real persist→aggregate→badge pipeline. Pure selection logic still lives in `badge.ts` (Phase 0) and stays unit-tested there.

- [ ] **Step 1: Snapshot persistence + fetch refresh**

Create `src/background/refresh.ts`:

```ts
import type { ProviderAdapter } from '../providers/providerAdapter';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { getCard, putCard } from '../storage/usageStore';
import { recordPoint } from '../storage/historyStore';

/** Persist parsed snapshots as the provider's latest card and append history. */
export async function storeSnapshots(provider: ProviderId, label: string, snapshots: UsageSnapshot[]): Promise<void> {
  const now = new Date().toISOString();
  const card: ProviderCardState = {
    provider, label,
    status: snapshots.length ? 'connected' : 'not_connected',
    lastUpdatedAt: now, snapshots
  };
  await putCard(card);
  for (const s of snapshots) await recordPoint(provider, s.window, Date.parse(s.capturedAt), s.usedPercent);
}

export async function storeStatus(provider: ProviderId, label: string, status: ProviderCardState['status'], message?: string): Promise<void> {
  const prev = await getCard(provider);
  await putCard({ provider, label, status, message, snapshots: prev?.snapshots ?? [], lastUpdatedAt: prev?.lastUpdatedAt });
}

/** Background fetch for `fetch`-strategy adapters; uses the logged-in session via host_permissions. */
export async function refreshFetchAdapter(adapter: ProviderAdapter): Promise<void> {
  if (adapter.collection.strategy !== 'fetch') return;
  try {
    const res = await fetch(adapter.collection.endpoint, { credentials: 'include', ...adapter.collection.init });
    if (res.status === 401 || res.status === 403 || res.redirected) {
      return storeStatus(adapter.provider, adapter.label, 'not_connected', 'Not logged in.');
    }
    if (!res.ok) return storeStatus(adapter.provider, adapter.label, 'stale', `HTTP ${res.status}`);
    const snapshots = adapter.parse(await res.json());
    await storeSnapshots(adapter.provider, adapter.label, snapshots);
  } catch {
    await storeStatus(adapter.provider, adapter.label, 'stale', 'Fetch failed.');
  }
}
```

- [ ] **Step 2: Rewrite the service-worker entry**

Replace `src/background/index.ts`:

```ts
import { calculateBadgeState } from './badge';
import { aggregateCards, flattenSnapshots } from './aggregate';
import { refreshFetchAdapter, storeSnapshots } from './refresh';
import { evaluateAndNotify } from './alerts';
import { claudeAdapter } from '../providers/claude/claudeAdapter';
import { chatgptAdapter } from '../providers/chatgpt/chatgptAdapter';
import { geminiAdapter } from '../providers/gemini/geminiAdapter';
import { getAllCards, loadSettings } from '../storage/usageStore';
import { isUsageReport, type ExtensionMessage } from '../shared/messages';

const ADAPTERS = [claudeAdapter, chatgptAdapter, geminiAdapter];
const FETCH_ADAPTERS = ADAPTERS.filter((a) => a.collection.strategy === 'fetch');
const ADAPTERS_BY_ID = Object.fromEntries(ADAPTERS.map((a) => [a.provider, a]));

async function recompute(): Promise<void> {
  const settings = await loadSettings();
  const cards = aggregateCards(await getAllCards(), settings);
  const badge = calculateBadgeState(flattenSnapshots(cards));
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  if (settings.notificationsEnabled) await evaluateAndNotify(cards);
}

async function refreshAll(): Promise<void> {
  const settings = await loadSettings();
  await Promise.all(FETCH_ADAPTERS
    .filter((a) => settings[`${a.provider}Enabled` as keyof typeof settings])
    .map(refreshFetchAdapter));
  await recompute();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('meterbar-refresh', { periodInMinutes: 10 });
  void refreshAll();
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'meterbar-refresh') void refreshAll(); });

chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  if (isUsageReport(msg)) {
    const adapter = ADAPTERS_BY_ID[msg.provider];
    if (adapter) void storeSnapshots(msg.provider, adapter.label, adapter.parse(msg.raw)).then(recompute);
    return false;
  }
  if (msg.type === 'usage:refresh') { void refreshAll().then(() => sendResponse({ ok: true })); return true; }
  if (msg.type === 'state:get') {
    void loadSettings().then(async (s) => sendResponse({ type: 'state:result', cards: aggregateCards(await getAllCards(), s) }));
    return true;
  }
  return false;
});

void refreshAll();
```

- [ ] **Step 3: Verify build (adapters land in Tasks 5–9; stub imports as needed to keep typecheck green, or sequence this task after them)**

> Implementation note: `index.ts` imports the three adapters. Either implement Tasks 6–9 first, or temporarily comment the chatgpt/gemini imports. Keep the repo compiling at every commit.

```bash
npm run typecheck && npm run build
git add src/background
git commit -m "feat: real background refresh + badge pipeline"
```

---

### Task 5: Alerts → notifications + reset detection

**Files:**
- Modify: `src/background/alerts.ts`
- Create: `tests/alertsEval.test.ts`

> Keeps the Phase 0 `getAlertKey`/`shouldAlert` primitives; adds threshold-crossing + reset detection as pure logic, then a thin notification firer.

- [ ] **Step 1: Tests for evaluation logic**

Create `tests/alertsEval.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateAlerts } from '../src/background/alerts';
import type { UsageSnapshot } from '../src/shared/types';

const snap = (pct: number, resetsAt?: string): UsageSnapshot => ({
  provider: 'claude', window: 'five_hour', usedRatio: pct / 100, usedPercent: pct,
  resetsAt, capturedAt: '2026-06-20T12:00:00Z', source: 't', confidence: 'exact', stale: false
});

describe('evaluateAlerts', () => {
  it('fires 90 critical once, not again for the same reset cycle', () => {
    const first = evaluateAlerts([snap(92, 'R1')], { seen: [], lastReset: {} });
    expect(first.fired.map((f) => f.threshold)).toEqual([70, 90]);
    const second = evaluateAlerts([snap(95, 'R1')], first.state);
    expect(second.fired).toHaveLength(0);
  });

  it('emits a reset-detected alert when resetsAt changes', () => {
    const seeded = { seen: [], lastReset: { 'claude:five_hour': 'R1' } };
    const out = evaluateAlerts([snap(5, 'R2')], seeded);
    expect(out.fired.some((f) => f.kind === 'reset')).toBe(true);
  });
});
```

- [ ] **Step 2: Extend alerts.ts**

Append to `src/background/alerts.ts` (keep existing `getAlertKey`/`shouldAlert`):

```ts
import type { ProviderCardState, UsageSnapshot } from '../shared/types';
import type { AlertState } from '../storage/usageStore';
import { loadAlertState, saveAlertState } from '../storage/usageStore';

export interface FiredAlert {
  kind: 'threshold' | 'reset';
  provider: UsageSnapshot['provider'];
  window: UsageSnapshot['window'];
  threshold?: number;
  usedPercent: number;
}
const THRESHOLDS = [70, 90];

export function evaluateAlerts(snapshots: UsageSnapshot[], state: AlertState): { fired: FiredAlert[]; state: AlertState } {
  const seen = new Set(state.seen);
  const lastReset = { ...state.lastReset };
  const fired: FiredAlert[] = [];

  for (const s of snapshots) {
    const resetKey = `${s.provider}:${s.window}`;
    if (s.resetsAt && lastReset[resetKey] && lastReset[resetKey] !== s.resetsAt) {
      fired.push({ kind: 'reset', provider: s.provider, window: s.window, usedPercent: s.usedPercent });
    }
    if (s.resetsAt) lastReset[resetKey] = s.resetsAt;

    for (const threshold of THRESHOLDS) {
      if (s.usedPercent >= threshold) {
        const key = getAlertKey(s.provider, s.window, threshold, s.resetsAt ?? 'unknown');
        if (shouldAlert(seen, key)) fired.push({ kind: 'threshold', provider: s.provider, window: s.window, threshold, usedPercent: s.usedPercent });
      }
    }
  }
  return { fired, state: { seen: [...seen], lastReset } };
}

export async function evaluateAndNotify(cards: ProviderCardState[]): Promise<void> {
  const snapshots = cards.flatMap((c) => c.snapshots).filter((s) => !s.stale && s.confidence !== 'unavailable');
  const { fired, state } = evaluateAlerts(snapshots, await loadAlertState());
  await saveAlertState(state);
  for (const f of fired) {
    const title = f.kind === 'reset' ? `${f.provider} usage reset` : `${f.provider} at ${f.threshold}%`;
    const message = f.kind === 'reset'
      ? `${f.window.replace('_', ' ')} window replenished.`
      : `${f.window.replace('_', ' ')} is at ${f.usedPercent}%.`;
    chrome.notifications.create(`${f.provider}:${f.window}:${f.kind}:${f.threshold ?? 'r'}`,
      { type: 'basic', iconUrl: 'assets/icon128.png', title, message });
  }
}
```

- [ ] **Step 3: Pass + commit**

```bash
npm test -- tests/alertsEval.test.ts tests/alerts.test.ts && npm run typecheck
git add src/background/alerts.ts tests/alertsEval.test.ts
git commit -m "feat: threshold + reset notifications with de-dup"
```

---

### Task 6: Live Claude adapter (fetch strategy)

**Files:**
- Modify: `src/providers/claude/claudeAdapter.ts`
- Modify: `manifest.json`
- Create: `tests/claudeAdapter.live.test.ts`

> Phase 0 left `parseClaudeUsageResponse` as a fixture-tested boundary returning `unsupported`. This task makes the adapter a real `fetch` adapter and hardens the parser against the validated shape.

- [ ] **Step 1: Validate the real endpoint (manual, required before shipping `exact`)**

In a logged-in `claude.ai` tab, open DevTools → Network, trigger the usage UI, and capture the request that returns 5-hour / 7-day utilization + reset timestamps. Record: URL, method, required headers/cookies, and one sanitized JSON response (**utilization numbers only — never message content**). Save the response shape as the fixture used by tests. If no clean JSON endpoint exists, fall back to the `content` strategy (Task 7 pattern) instead.

- [ ] **Step 2: Parser tests against the captured fixture shape**

Create `tests/claudeAdapter.live.test.ts` (adjust field names to the validated payload):

```ts
import { describe, expect, it } from 'vitest';
import { parseClaudeUsageResponse } from '../src/providers/claude/claudeAdapter';

describe('parseClaudeUsageResponse (validated shape)', () => {
  it('normalizes both windows and carries reset timestamps', () => {
    const out = parseClaudeUsageResponse({
      five_hour: { utilization: 0.62, resets_at: '2026-06-20T18:30:00Z' },
      seven_day: { utilization: 0.41, resets_at: '2026-06-25T03:00:00Z' }
    }, new Date('2026-06-20T16:16:00Z'));
    expect(out).toMatchObject([
      { provider: 'claude', window: 'five_hour', usedPercent: 62, resetsAt: '2026-06-20T18:30:00Z', confidence: 'exact', stale: false },
      { provider: 'claude', window: 'seven_day', usedPercent: 41, confidence: 'exact' }
    ]);
  });

  it('skips windows missing a numeric utilization', () => {
    expect(parseClaudeUsageResponse({ five_hour: {} })).toEqual([]);
  });
});
```

- [ ] **Step 3: Real adapter**

Replace the adapter export (keep/extend `parseClaudeUsageResponse`) in `src/providers/claude/claudeAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';

// CLAUDE_USAGE_ENDPOINT: set to the URL validated in Step 1.
const CLAUDE_USAGE_ENDPOINT = 'https://claude.ai/api/usage';

export const claudeAdapter: ProviderAdapter = {
  provider: 'claude',
  label: 'Claude',
  collection: { strategy: 'fetch', endpoint: CLAUDE_USAGE_ENDPOINT, init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseClaudeUsageResponse(raw as never)
};
```

Confirm `manifest.json` keeps `"host_permissions": ["https://claude.ai/*"]` (from Phase 0) so the worker fetch is credentialed.

- [ ] **Step 4: Pass + commit**

```bash
npm test -- tests/claudeAdapter.live.test.ts tests/claudeAdapter.test.ts && npm run typecheck && npm run build
git add src/providers/claude tests/claudeAdapter.live.test.ts manifest.json
git commit -m "feat: live Claude usage adapter via background fetch"
```

---

### Task 7: Content-script collector framework

**Files:**
- Create: `src/content/collector.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Shared collector**

Create `src/content/collector.ts`:

```ts
import type { ProviderId } from '../shared/types';
import type { ExtensionMessage } from '../shared/messages';

export interface CollectorConfig {
  provider: ProviderId;
  intervalMs?: number;
  /** Read raw usage the page already has (intercepted JSON or DOM). Return null if unavailable. */
  collect: () => Promise<unknown | null>;
}

export function startCollector(config: CollectorConfig): void {
  const tick = async () => {
    try {
      const raw = await config.collect();
      if (raw == null) return;
      const msg: ExtensionMessage = { type: 'usage:report', provider: config.provider, raw, capturedAt: new Date().toISOString() };
      chrome.runtime.sendMessage(msg);
    } catch { /* stay silent; never surface page errors */ }
  };
  void tick();
  setInterval(() => void tick(), config.intervalMs ?? 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void tick(); });
}
```

- [ ] **Step 2: Add content entries to the Vite build**

Add to `vite.config.ts` `rollupOptions.input`:

```ts
chatgpt: resolve(__dirname, 'src/content/chatgpt.ts'),
gemini: resolve(__dirname, 'src/content/gemini.ts')
```

- [ ] **Step 3: Commit**

```bash
npm run typecheck
git add src/content/collector.ts vite.config.ts
git commit -m "feat: shared content-script usage collector"
```

---

### Task 8: ChatGPT / Codex adapter (content strategy)

**Files:**
- Create: `src/providers/chatgpt/chatgptAdapter.ts`
- Create: `src/content/chatgpt.ts`
- Create: `tests/chatgptAdapter.test.ts`
- Modify: `manifest.json`

- [ ] **Step 1: Validate (manual)** — In a logged-in ChatGPT tab, find where plan/usage limits surface (model-cap banner, settings, or an internal `/backend-api/...` response). Capture a sanitized usage shape. Confidence is `estimated` if scraped from DOM, `exact` only if from a clean JSON field.

- [ ] **Step 2: Parser test (shape from Step 1)**

Create `tests/chatgptAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseChatgptUsage } from '../src/providers/chatgpt/chatgptAdapter';

describe('parseChatgptUsage', () => {
  it('maps a captured usage shape to a snapshot', () => {
    const out = parseChatgptUsage({ window: 'daily', used: 30, limit: 40, resets_at: '2026-06-21T00:00:00Z' }, new Date('2026-06-20T12:00:00Z'));
    expect(out).toMatchObject([{ provider: 'chatgpt', window: 'daily', usedPercent: 75, confidence: 'estimated' }]);
  });
  it('returns nothing when limit is unknown', () => {
    expect(parseChatgptUsage({ used: 5 }, new Date())).toEqual([]);
  });
});
```

- [ ] **Step 3: Implement adapter + content script**

Create `src/providers/chatgpt/chatgptAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface ChatgptUsageRaw { window?: string; used?: number; limit?: number; resets_at?: string; }

export function parseChatgptUsage(raw: ChatgptUsageRaw, now: Date = new Date()): UsageSnapshot[] {
  if (typeof raw.used !== 'number' || typeof raw.limit !== 'number' || raw.limit <= 0) return [];
  const ratio = raw.used / raw.limit;
  return [{
    provider: 'chatgpt',
    window: (raw.window as UsageWindow) ?? 'daily',
    usedRatio: ratio, usedPercent: Math.round(ratio * 100),
    resetsAt: raw.resets_at, capturedAt: now.toISOString(),
    source: 'chatgpt-content', confidence: 'estimated', stale: false
  }];
}

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt', label: 'ChatGPT / Codex',
  collection: { strategy: 'content', matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] },
  parse: (raw) => parseChatgptUsage(raw as ChatgptUsageRaw)
};
```

Create `src/content/chatgpt.ts`:

```ts
import { startCollector } from './collector';

// Replace `collect` with the validated extraction from Task 8 Step 1.
startCollector({
  provider: 'chatgpt',
  collect: async () => {
    // Example: read a usage value the page rendered. Return the raw shape parseChatgptUsage expects, or null.
    return null;
  }
});
```

- [ ] **Step 4: Manifest content script + host permission**

Add to `manifest.json`:

```json
"host_permissions": ["https://claude.ai/*", "https://chatgpt.com/*", "https://chat.openai.com/*", "https://gemini.google.com/*"],
"content_scripts": [
  { "matches": ["https://chatgpt.com/*", "https://chat.openai.com/*"], "js": ["assets/chatgpt.js"], "run_at": "document_idle" },
  { "matches": ["https://gemini.google.com/*"], "js": ["assets/gemini.js"], "run_at": "document_idle" }
]
```

- [ ] **Step 5: Pass + commit**

```bash
npm test -- tests/chatgptAdapter.test.ts && npm run typecheck && npm run build
git add src/providers/chatgpt src/content/chatgpt.ts tests/chatgptAdapter.test.ts manifest.json
git commit -m "feat: ChatGPT/Codex usage adapter (content strategy)"
```

---

### Task 9: Gemini adapter (content strategy)

**Files:**
- Create: `src/providers/gemini/geminiAdapter.ts`
- Create: `src/content/gemini.ts`
- Create: `tests/geminiAdapter.test.ts`

> Same pattern as Task 8. Validate where Gemini surfaces usage/limits (often DOM-rendered → `confidence: 'inferred'`). Parser is pure and fixture-tested; `collect()` is filled from the manual capture; manifest entries were added in Task 8 Step 4.

- [ ] **Step 1: Parser test**

Create `tests/geminiAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseGeminiUsage } from '../src/providers/gemini/geminiAdapter';

describe('parseGeminiUsage', () => {
  it('maps remaining/limit to a percent-used snapshot', () => {
    const out = parseGeminiUsage({ window: 'daily', remaining: 20, limit: 100 }, new Date('2026-06-20T12:00:00Z'));
    expect(out).toMatchObject([{ provider: 'gemini', window: 'daily', usedPercent: 80, confidence: 'inferred' }]);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/providers/gemini/geminiAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface GeminiUsageRaw { window?: string; remaining?: number; limit?: number; resets_at?: string; }

export function parseGeminiUsage(raw: GeminiUsageRaw, now: Date = new Date()): UsageSnapshot[] {
  if (typeof raw.remaining !== 'number' || typeof raw.limit !== 'number' || raw.limit <= 0) return [];
  const ratio = (raw.limit - raw.remaining) / raw.limit;
  return [{
    provider: 'gemini', window: (raw.window as UsageWindow) ?? 'daily',
    usedRatio: ratio, usedPercent: Math.round(ratio * 100),
    resetsAt: raw.resets_at, capturedAt: now.toISOString(),
    source: 'gemini-content', confidence: 'inferred', stale: false
  }];
}

export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini', label: 'Gemini',
  collection: { strategy: 'content', matches: ['https://gemini.google.com/*'] },
  parse: (raw) => parseGeminiUsage(raw as GeminiUsageRaw)
};
```

Create `src/content/gemini.ts`:

```ts
import { startCollector } from './collector';
startCollector({ provider: 'gemini', collect: async () => null /* fill from Step 0 capture */ });
```

- [ ] **Step 3: Pass + commit**

```bash
npm test -- tests/geminiAdapter.test.ts && npm run typecheck && npm run build
git add src/providers/gemini src/content/gemini.ts tests/geminiAdapter.test.ts
git commit -m "feat: Gemini usage adapter (content strategy)"
```

---

### Task 10: History trend sparklines in the popup

**Files:**
- Create: `src/shared/sparkline.ts`
- Create: `tests/sparkline.test.ts`
- Modify: `src/popup/popup.ts`, `src/popup/popup.css`

- [ ] **Step 1: Sparkline tests (pure)**

Create `tests/sparkline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sparklinePath } from '../src/shared/sparkline';

describe('sparklinePath', () => {
  it('returns empty for <2 points', () => {
    expect(sparklinePath([[0, 50]], 100, 20)).toBe('');
  });
  it('maps first/last points to the box corners on the x-axis', () => {
    const d = sparklinePath([[0, 0], [10, 100]], 100, 20);
    expect(d.startsWith('M0,')).toBe(true);
    expect(d).toContain('L100,'); // last x at full width
  });
});
```

- [ ] **Step 2: Implement**

Create `src/shared/sparkline.ts`:

```ts
import type { Point } from '../storage/historyStore';

export function sparklinePath(points: Point[], width: number, height: number): string {
  if (points.length < 2) return '';
  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), spanX = maxX - minX || 1;
  return points
    .map(([t, p], i) => {
      const x = ((t - minX) / spanX) * width;
      const y = height - (Math.max(0, Math.min(100, p)) / 100) * height;
      return `${i === 0 ? 'M' : 'L'}${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');
}
```

- [ ] **Step 3: Render real state + sparklines in the popup**

Rewire `src/popup/popup.ts` to (1) request state from the worker via `chrome.runtime.sendMessage({ type: 'state:get' })` instead of `getMockCards()`, (2) render status/confidence/last-updated per the PRD card spec, and (3) draw an inline `<svg><path d="...">` per window using `readSeries` + `sparklinePath`. Add `.spark { width:100%; height:24px }` styling. Keep `getMockCards` only for tests/storybook.

- [ ] **Step 4: Pass + commit**

```bash
npm test -- tests/sparkline.test.ts && npm run typecheck && npm run build
git add src/shared/sparkline.ts tests/sparkline.test.ts src/popup
git commit -m "feat: usage history sparklines in popup"
```

---

### Task 11: CSV / JSON export

**Files:**
- Create: `src/shared/exporters.ts`
- Create: `tests/exporters.test.ts`
- Modify: `src/options/options.html`, `src/options/options.ts`

- [ ] **Step 1: Exporter tests (pure)**

Create `tests/exporters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { historyToCsv, historyToJson } from '../src/shared/exporters';

const history = { 'history:claude:five_hour': [[1718884320000, 62] as [number, number]] };

describe('exporters', () => {
  it('emits a CSV header and a row per point', () => {
    const csv = historyToCsv(history);
    expect(csv.split('\n')[0]).toBe('provider,window,capturedAt,usedPercent');
    expect(csv).toContain('claude,five_hour,2026-06-20T13:12:00.000Z,62');
  });
  it('emits stable JSON', () => {
    expect(JSON.parse(historyToJson(history))).toEqual(history);
  });
});
```

- [ ] **Step 2: Implement**

Create `src/shared/exporters.ts`:

```ts
import type { Point } from '../storage/historyStore';

export function historyToJson(history: Record<string, Point[]>): string {
  return JSON.stringify(history, null, 2);
}

export function historyToCsv(history: Record<string, Point[]>): string {
  const rows = ['provider,window,capturedAt,usedPercent'];
  for (const [key, points] of Object.entries(history)) {
    const [, provider, window] = key.split(':');
    for (const [t, p] of points) rows.push(`${provider},${window},${new Date(t).toISOString()},${p}`);
  }
  return rows.join('\n');
}
```

- [ ] **Step 3: Wire download buttons**

In `options.html` add `Export JSON` / `Export CSV` buttons. In `options.ts`, on click read `readAllHistory()`, build a `Blob`, and trigger download via `URL.createObjectURL` + a temporary `<a download>`. Filenames like `meterbar-history-<date>.csv`.

- [ ] **Step 4: Pass + commit**

```bash
npm test -- tests/exporters.test.ts && npm run typecheck && npm run build
git add src/shared/exporters.ts tests/exporters.test.ts src/options
git commit -m "feat: CSV/JSON usage history export"
```

---

### Task 12: Settings expansion + wiring

**Files:**
- Modify: `src/options/options.html`, `src/options/options.ts`

- [ ] **Step 1:** Add per-provider toggles (`claudeEnabled`, `chatgptEnabled`, `geminiEnabled`) and keep the notifications toggle, backed by `loadSettings`/`saveSettings` from `usageStore`. The clear-data button calls `chrome.storage.local.clear()` (already clears history + latest + alert state). Disabling a provider already removes it from `aggregateCards`, so the badge and notifications respect it on the next `recompute`.

- [ ] **Step 2:** After saving settings, ping the worker (`chrome.runtime.sendMessage({ type: 'usage:refresh' })`) so the badge updates immediately.

- [ ] **Step 3: Commit**

```bash
npm run typecheck && npm run build
git add src/options
git commit -m "feat: per-provider settings wired to badge + alerts"
```

---

### Task 13: Manifest finalization, permissions copy, full verification

**Files:**
- Modify: `manifest.json`, `README.md`

- [ ] **Step 1:** Confirm `manifest.json` declares only the needed permissions: `["storage", "alarms", "notifications"]`, the four provider `host_permissions`, both `content_scripts`, and an `icons`/notification icon asset (`assets/icon128.png`). No `tabs`, `cookies`, `webRequest`, or `<all_urls>` — least privilege (PRD §11).

- [ ] **Step 2:** Update `README.md` permissions section to plainly state what each host permission is for and reaffirm: usage metrics only, no chat content, no backend.

- [ ] **Step 3: Full verification**

```bash
npm test          # all suites green
npm run typecheck
npm run build
```

- [ ] **Step 4: Manual load test in Chrome**

`chrome://extensions` → Developer mode → Load unpacked → `dist/`. Verify:
- Logged into claude.ai: badge shows a real percentage in the risk color within one refresh; popup Claude card shows 5h/7d windows, reset countdown, last-updated, and `exact` confidence; a sparkline appears after ≥2 captures.
- ChatGPT/Gemini cards show `not connected`/`unsupported` until their tabs are open and `collect()` is validated; then `estimated`/`inferred` confidence.
- Crossing 70%/90% fires a single notification each; clearing data resets everything; export downloads a CSV and JSON.

- [ ] **Step 5: Commit + push**

```bash
git add manifest.json README.md
git commit -m "chore: finalize permissions and verification docs"
git push -u origin <feature-branch>
```

---

## Self-review

- **Spec coverage:** Badge (Phase 0 `badge.ts`), popup cards with status/confidence/reset/last-updated (Task 10), **live** Claude adapter (Task 6), local storage of the PRD's snapshot fields + history (Task 1), 70/90/reset alerts with de-dup (Task 5), settings incl. clear-data (Task 12). Phase 2: ChatGPT/Codex (Task 8), Gemini (Task 9), history + trend chart (Tasks 1, 10), CSV/JSON export (Task 11).
- **Privacy invariants:** Only utilization/percent/reset/timestamp/source/confidence are ever read or stored; parsers take numeric usage fields only; no message/prompt/file access; no backend or analytics; host permissions limited to the four provider origins; notification/badge run locally. Matches PRD §11.
- **Truthful uncertainty:** `confidence` is sourced from data quality (`exact` for validated JSON, `estimated`/`inferred` for DOM/partial), `isStale` downgrades cards to `stale`, and adapters report `unsupported`/`not_connected` rather than guessing before validation.
- **Testability:** Every non-trivial unit is a pure function with a fixture test (prune, messages guard, aggregate, alerts eval, four parsers, sparkline, exporters). Only thin I/O wrappers and entry points touch `chrome.*`.
- **Budgets:** Popup reads `latest:*` only (<300ms); history is pruned/downsampled and point-capped (<100KB/day); refresh alarm at 10 min meets the "fresh within 10 minutes" target.
- **Sequencing risk:** `background/index.ts` (Task 4) imports the three adapters; either implement Tasks 6/8/9 first or stub the imports so every commit compiles. Flagged inline.

## Open items requiring live inspection (not blockers to start)

1. Exact Claude usage endpoint URL + payload field names (Task 6 Step 1) — the only thing between the parser and real `exact` data.
2. Whether ChatGPT exposes usage via a `/backend-api` JSON response (→ promote to `fetch` strategy + `exact`) or only DOM (→ keep `content` + `estimated`).
3. Gemini usage surface + reset semantics (likely DOM-inferred).
4. Confirm `chrome.storage.local` stays within budget across all enabled providers over a week; tighten `maxPoints` if needed.

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-06-20-meterbar-mvp-phase2.md`. Run **Phase 0** (the scaffold plan, Tasks 1–8) first, then execute Tasks 1–13 here in order, committing per task with green `npm test` + `npm run typecheck` + `npm run build`. Tasks 6, 8, and 9 each begin with a short manual endpoint-validation step; until those are done, the corresponding adapter ships reporting `unsupported` rather than presenting unverified numbers.
