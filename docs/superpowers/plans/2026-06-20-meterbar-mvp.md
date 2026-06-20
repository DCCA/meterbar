# MeterBar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first Chrome MV3 extension that shows a MeterBar toolbar badge, popup provider cards, and a Claude-first usage adapter architecture.

**Architecture:** Implement a Chrome Extension Manifest V3 app with a background service worker, provider adapters, popup UI, options page, local storage repository, and notification threshold engine. Start with mocked/local fixture data and a Claude adapter boundary so real endpoint integration can be added safely after inspecting live claude.ai behavior.

**Tech Stack:** Chrome Extension MV3, TypeScript, Vite, Vitest, vanilla HTML/CSS for popup/options, `chrome.storage.local`, Chrome Notifications API.

---

## File structure

- `manifest.json` — Chrome extension manifest with minimal permissions.
- `package.json` — Node scripts for build/test/lint.
- `tsconfig.json` — TypeScript config.
- `vite.config.ts` — build config for extension assets.
- `src/shared/types.ts` — canonical provider/window/snapshot types.
- `src/shared/time.ts` — reset countdown/time helpers.
- `src/storage/usageStore.ts` — local persistence wrapper around `chrome.storage.local`.
- `src/providers/providerAdapter.ts` — provider adapter interface.
- `src/providers/claude/claudeAdapter.ts` — Claude adapter skeleton and parser boundary.
- `src/providers/mock/mockAdapter.ts` — local mock provider for deterministic development.
- `src/background/index.ts` — refresh loop, badge update, notifications.
- `src/background/badge.ts` — badge risk calculation and display.
- `src/background/alerts.ts` — threshold notification de-duplication.
- `src/popup/popup.html` — popup shell.
- `src/popup/popup.ts` — popup render logic.
- `src/popup/popup.css` — popup styling.
- `src/options/options.html` — settings page shell.
- `src/options/options.ts` — settings behavior.
- `src/options/options.css` — settings styling.
- `tests/*.test.ts` — unit tests for data model, badge, alerts, storage abstraction, and provider parsing.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `manifest.json`
- Create: `.gitignore`

- [ ] **Step 1: Create Node/TypeScript project files**

Create `package.json`:

```json
{
  "name": "meterbar",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Privacy-first Chrome extension that shows AI subscription usage limits in one real-time bar.",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
```

Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "MeterBar",
  "version": "0.1.0",
  "description": "One bar for all your AI limits.",
  "permissions": ["storage", "alarms", "notifications"],
  "host_permissions": ["https://claude.ai/*"],
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "action": {
    "default_title": "MeterBar",
    "default_popup": "src/popup/popup.html"
  },
  "options_page": "src/options/options.html"
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.DS_Store
.env
.env.*
coverage/
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 3: Run initial checks**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck passes, Vitest reports no tests or passes existing tests, and `dist/` builds.

- [ ] **Step 4: Commit scaffold**

```bash
git add .
git commit -m "chore: scaffold meterbar extension"
```

---

### Task 2: Canonical usage model and helpers

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/time.ts`
- Create: `tests/time.test.ts`

- [ ] **Step 1: Write time helper tests**

Create `tests/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatCountdown, isStale } from '../src/shared/time';

describe('time helpers', () => {
  it('formats countdowns in hours and minutes', () => {
    const now = new Date('2026-06-20T12:00:00Z');
    const reset = new Date('2026-06-20T14:15:00Z');
    expect(formatCountdown(reset.toISOString(), now)).toBe('2h 15m');
  });

  it('marks snapshots stale after the max age', () => {
    const now = new Date('2026-06-20T12:10:01Z');
    expect(isStale('2026-06-20T12:00:00Z', now, 10 * 60 * 1000)).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- tests/time.test.ts
```

Expected: FAIL because `src/shared/time.ts` does not exist.

- [ ] **Step 3: Create shared types and helpers**

Create `src/shared/types.ts`:

```ts
export type ProviderId = 'claude' | 'chatgpt' | 'codex' | 'gemini' | 'unknown';
export type UsageWindow = 'five_hour' | 'seven_day' | 'daily' | 'monthly' | 'api_billing' | 'custom';
export type Confidence = 'exact' | 'estimated' | 'inferred' | 'unavailable';
export type ProviderStatus = 'connected' | 'not_connected' | 'stale' | 'unsupported';

export interface UsageSnapshot {
  provider: ProviderId;
  accountIdHash?: string;
  workspaceLabel?: string;
  window: UsageWindow;
  usedRatio: number;
  usedPercent: number;
  resetsAt?: string;
  capturedAt: string;
  source: string;
  confidence: Confidence;
  stale: boolean;
}

export interface ProviderCardState {
  provider: ProviderId;
  label: string;
  status: ProviderStatus;
  snapshots: UsageSnapshot[];
  lastUpdatedAt?: string;
  message?: string;
}
```

Create `src/shared/time.ts`:

```ts
export function formatCountdown(resetsAtIso: string, now: Date = new Date()): string {
  const target = new Date(resetsAtIso).getTime();
  const diffMs = Math.max(0, target - now.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function isStale(capturedAtIso: string, now: Date = new Date(), maxAgeMs = 10 * 60 * 1000): boolean {
  return now.getTime() - new Date(capturedAtIso).getTime() > maxAgeMs;
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- tests/time.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/shared tests/time.test.ts
git commit -m "feat: define usage snapshot model"
```

---

### Task 3: Badge risk calculation

**Files:**
- Create: `src/background/badge.ts`
- Create: `tests/badge.test.ts`

- [ ] **Step 1: Write badge tests**

Create `tests/badge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateBadgeState } from '../src/background/badge';
import type { UsageSnapshot } from '../src/shared/types';

function snapshot(provider: UsageSnapshot['provider'], usedPercent: number): UsageSnapshot {
  return {
    provider,
    window: 'five_hour',
    usedRatio: usedPercent / 100,
    usedPercent,
    capturedAt: '2026-06-20T12:00:00Z',
    source: 'test',
    confidence: 'exact',
    stale: false
  };
}

describe('calculateBadgeState', () => {
  it('selects highest non-stale usage percentage', () => {
    expect(calculateBadgeState([snapshot('claude', 42), snapshot('gemini', 81)])).toEqual({
      text: '81',
      color: '#f59e0b',
      provider: 'gemini',
      usedPercent: 81
    });
  });

  it('returns unknown when no fresh snapshots exist', () => {
    expect(calculateBadgeState([])).toEqual({
      text: '?',
      color: '#6b7280'
    });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```bash
npm test -- tests/badge.test.ts
```

Expected: FAIL because badge module does not exist.

- [ ] **Step 3: Implement badge state**

Create `src/background/badge.ts`:

```ts
import type { ProviderId, UsageSnapshot } from '../shared/types';

export interface BadgeState {
  text: string;
  color: string;
  provider?: ProviderId;
  usedPercent?: number;
}

export function calculateBadgeState(snapshots: UsageSnapshot[]): BadgeState {
  const fresh = snapshots.filter((snapshot) => !snapshot.stale && snapshot.confidence !== 'unavailable');
  if (fresh.length === 0) {
    return { text: '?', color: '#6b7280' };
  }

  const riskiest = fresh.reduce((max, snapshot) =>
    snapshot.usedPercent > max.usedPercent ? snapshot : max
  );

  return {
    text: String(Math.round(riskiest.usedPercent)),
    color: colorForPercent(riskiest.usedPercent),
    provider: riskiest.provider,
    usedPercent: riskiest.usedPercent
  };
}

export function colorForPercent(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#22c55e';
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- tests/badge.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/background/badge.ts tests/badge.test.ts
git commit -m "feat: calculate meterbar badge risk"
```

---

### Task 4: Popup UI with local mock data

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.ts`
- Create: `src/providers/mock/mockAdapter.ts`

- [ ] **Step 1: Create mock adapter**

Create `src/providers/mock/mockAdapter.ts`:

```ts
import type { ProviderCardState } from '../../shared/types';

export function getMockCards(): ProviderCardState[] {
  return [
    {
      provider: 'claude',
      label: 'Claude',
      status: 'connected',
      lastUpdatedAt: new Date().toISOString(),
      snapshots: [
        {
          provider: 'claude',
          window: 'five_hour',
          usedRatio: 0.62,
          usedPercent: 62,
          resetsAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString(),
          capturedAt: new Date().toISOString(),
          source: 'mock',
          confidence: 'exact',
          stale: false
        },
        {
          provider: 'claude',
          window: 'seven_day',
          usedRatio: 0.41,
          usedPercent: 41,
          capturedAt: new Date().toISOString(),
          source: 'mock',
          confidence: 'exact',
          stale: false
        }
      ]
    },
    { provider: 'chatgpt', label: 'ChatGPT / Codex', status: 'unsupported', snapshots: [], message: 'Adapter coming next.' },
    { provider: 'gemini', label: 'Gemini', status: 'unsupported', snapshots: [], message: 'Adapter coming next.' }
  ];
}
```

- [ ] **Step 2: Create popup shell and renderer**

Create `src/popup/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MeterBar</title>
    <link rel="stylesheet" href="./popup.css" />
  </head>
  <body>
    <main class="popup">
      <header>
        <h1>MeterBar</h1>
        <p>One bar for all your AI limits.</p>
      </header>
      <section id="cards" class="cards"></section>
      <footer>
        <button id="refresh">Refresh</button>
        <a href="../options/options.html" target="_blank">Settings</a>
      </footer>
    </main>
    <script type="module" src="./popup.ts"></script>
  </body>
</html>
```

Create `src/popup/popup.css`:

```css
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #0f172a;
  color: #e5e7eb;
  width: 360px;
}

.popup { padding: 16px; }
h1 { margin: 0; font-size: 20px; }
p { margin: 4px 0 0; color: #94a3b8; }
.cards { display: grid; gap: 12px; margin-top: 16px; }
.card { border: 1px solid #334155; border-radius: 14px; padding: 12px; background: #111827; }
.card h2 { margin: 0 0 8px; font-size: 15px; }
.row { display: grid; grid-template-columns: 72px 1fr 44px; gap: 8px; align-items: center; margin: 8px 0; }
.bar { height: 8px; border-radius: 999px; background: #334155; overflow: hidden; }
.fill { height: 100%; background: #22c55e; }
.fill.warn { background: #f59e0b; }
.fill.crit { background: #ef4444; }
.meta { color: #94a3b8; font-size: 12px; }
footer { display: flex; justify-content: space-between; margin-top: 14px; }
button, a { color: #e5e7eb; background: #1f2937; border: 1px solid #475569; border-radius: 8px; padding: 6px 10px; text-decoration: none; }
```

Create `src/popup/popup.ts`:

```ts
import { getMockCards } from '../providers/mock/mockAdapter';
import { formatCountdown } from '../shared/time';
import type { UsageSnapshot } from '../shared/types';

function classForSnapshot(snapshot: UsageSnapshot): string {
  if (snapshot.usedPercent >= 90) return 'crit';
  if (snapshot.usedPercent >= 70) return 'warn';
  return '';
}

function labelForWindow(window: UsageSnapshot['window']): string {
  return window.replace('_', ' ');
}

function render(): void {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (!container) return;

  container.innerHTML = getMockCards().map((card) => {
    const rows = card.snapshots.map((snapshot) => `
      <div class="row">
        <span>${labelForWindow(snapshot.window)}</span>
        <div class="bar"><div class="fill ${classForSnapshot(snapshot)}" style="width:${snapshot.usedPercent}%"></div></div>
        <strong>${snapshot.usedPercent}%</strong>
      </div>
      <div class="meta">${snapshot.resetsAt ? `resets in ${formatCountdown(snapshot.resetsAt)}` : 'reset unknown'} · ${snapshot.confidence}</div>
    `).join('');

    return `
      <article class="card">
        <h2>${card.label}</h2>
        ${rows || `<p class="meta">${card.message ?? card.status}</p>`}
      </article>
    `;
  }).join('');
}

document.querySelector('#refresh')?.addEventListener('click', render);
render();
```

- [ ] **Step 3: Build popup**

Run:

```bash
npm run build
```

Expected: `dist/` includes popup assets.

- [ ] **Step 4: Commit popup**

```bash
git add src/popup src/providers/mock
 git commit -m "feat: add meterbar popup mock UI"
```

---

### Task 5: Options page and privacy controls

**Files:**
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.ts`

- [ ] **Step 1: Create options page**

Create `src/options/options.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MeterBar Settings</title>
    <link rel="stylesheet" href="./options.css" />
  </head>
  <body>
    <main>
      <h1>MeterBar Settings</h1>
      <label><input id="notifications" type="checkbox" checked /> Enable local notifications</label>
      <label><input id="claude" type="checkbox" checked /> Enable Claude adapter</label>
      <section>
        <h2>Privacy</h2>
        <p>MeterBar stores usage percentages, reset timestamps, provider names, and local settings. It does not store prompts, responses, uploaded files, or chat content.</p>
        <button id="clear">Clear local MeterBar data</button>
        <p id="status" role="status"></p>
      </section>
    </main>
    <script type="module" src="./options.ts"></script>
  </body>
</html>
```

Create `src/options/options.css`:

```css
body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
main { max-width: 720px; margin: 40px auto; padding: 24px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; }
label { display: block; margin: 12px 0; }
button { padding: 8px 12px; border-radius: 8px; border: 1px solid #94a3b8; background: #0f172a; color: white; }
#status { color: #047857; }
```

Create `src/options/options.ts`:

```ts
const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  claudeEnabled: true
};

type Settings = typeof DEFAULT_SETTINGS;

async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return stored as Settings;
}

async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}

async function render(): Promise<void> {
  const settings = await loadSettings();
  const notifications = document.querySelector<HTMLInputElement>('#notifications');
  const claude = document.querySelector<HTMLInputElement>('#claude');
  if (notifications) notifications.checked = settings.notificationsEnabled;
  if (claude) claude.checked = settings.claudeEnabled;
}

async function wire(): Promise<void> {
  document.querySelector<HTMLInputElement>('#notifications')?.addEventListener('change', async (event) => {
    const current = await loadSettings();
    await saveSettings({ ...current, notificationsEnabled: (event.target as HTMLInputElement).checked });
  });

  document.querySelector<HTMLInputElement>('#claude')?.addEventListener('change', async (event) => {
    const current = await loadSettings();
    await saveSettings({ ...current, claudeEnabled: (event.target as HTMLInputElement).checked });
  });

  document.querySelector<HTMLButtonElement>('#clear')?.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    const status = document.querySelector('#status');
    if (status) status.textContent = 'Local MeterBar data cleared.';
    await render();
  });
}

render();
wire();
```

- [ ] **Step 2: Build and commit**

Run:

```bash
npm run build
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/options
 git commit -m "feat: add privacy-first options page"
```

---

### Task 6: Background service worker wiring

**Files:**
- Create: `src/background/index.ts`
- Create: `src/background/alerts.ts`
- Create: `tests/alerts.test.ts`

- [ ] **Step 1: Write alert de-duplication tests**

Create `tests/alerts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getAlertKey, shouldAlert } from '../src/background/alerts';

describe('alerts', () => {
  it('builds stable alert keys per provider window threshold reset cycle', () => {
    expect(getAlertKey('claude', 'five_hour', 90, '2026-06-20T14:00:00Z')).toBe('claude:five_hour:90:2026-06-20T14:00:00Z');
  });

  it('alerts only once for a threshold key', () => {
    const seen = new Set<string>();
    expect(shouldAlert(seen, 'a')).toBe(true);
    expect(shouldAlert(seen, 'a')).toBe(false);
  });
});
```

- [ ] **Step 2: Implement alerts and background**

Create `src/background/alerts.ts`:

```ts
import type { ProviderId, UsageWindow } from '../shared/types';

export function getAlertKey(provider: ProviderId, window: UsageWindow, threshold: number, resetsAt = 'unknown'): string {
  return `${provider}:${window}:${threshold}:${resetsAt}`;
}

export function shouldAlert(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
```

Create `src/background/index.ts`:

```ts
import { calculateBadgeState } from './badge';
import { getMockCards } from '../providers/mock/mockAdapter';

async function updateBadge(): Promise<void> {
  const snapshots = getMockCards().flatMap((card) => card.snapshots);
  const badge = calculateBadgeState(snapshots);
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('meterbar-refresh', { periodInMinutes: 10 });
  updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'meterbar-refresh') updateBadge();
});

updateBadge();
```

- [ ] **Step 3: Run checks and commit**

Run:

```bash
npm test -- tests/alerts.test.ts tests/badge.test.ts
npm run typecheck
npm run build
```

Expected: PASS.

Commit:

```bash
git add src/background tests/alerts.test.ts
 git commit -m "feat: wire background badge refresh"
```

---

### Task 7: Claude adapter boundary

**Files:**
- Create: `src/providers/providerAdapter.ts`
- Create: `src/providers/claude/claudeAdapter.ts`
- Create: `tests/claudeAdapter.test.ts`

- [ ] **Step 1: Write parser tests with fixture-shaped data**

Create `tests/claudeAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseClaudeUsageResponse } from '../src/providers/claude/claudeAdapter';

describe('parseClaudeUsageResponse', () => {
  it('normalizes Claude usage windows', () => {
    const snapshots = parseClaudeUsageResponse({
      five_hour: { utilization: 0.42, resets_at: '2026-06-20T14:00:00Z' },
      seven_day: { utilization: 0.61, resets_at: '2026-06-25T03:00:00Z' }
    }, new Date('2026-06-20T12:00:00Z'));

    expect(snapshots).toMatchObject([
      { provider: 'claude', window: 'five_hour', usedPercent: 42, confidence: 'exact' },
      { provider: 'claude', window: 'seven_day', usedPercent: 61, confidence: 'exact' }
    ]);
  });
});
```

- [ ] **Step 2: Implement adapter interface and parser**

Create `src/providers/providerAdapter.ts`:

```ts
import type { ProviderCardState, ProviderId } from '../shared/types';

export interface ProviderAdapter {
  provider: ProviderId;
  refresh(): Promise<ProviderCardState>;
}
```

Create `src/providers/claude/claudeAdapter.ts`:

```ts
import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot } from '../../shared/types';

interface ClaudeUsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface ClaudeUsageResponse {
  five_hour?: ClaudeUsageWindow;
  seven_day?: ClaudeUsageWindow;
}

export function parseClaudeUsageResponse(payload: ClaudeUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const windows: Array<[UsageSnapshot['window'], ClaudeUsageWindow | undefined]> = [
    ['five_hour', payload.five_hour],
    ['seven_day', payload.seven_day]
  ];

  return windows.flatMap(([window, value]) => {
    if (!value || typeof value.utilization !== 'number') return [];
    const usedPercent = Math.round(value.utilization * 100);
    return [{
      provider: 'claude',
      window,
      usedRatio: value.utilization,
      usedPercent,
      resetsAt: value.resets_at,
      capturedAt,
      source: 'claude-usage-response',
      confidence: 'exact',
      stale: false
    }];
  });
}

export const claudeAdapter: ProviderAdapter = {
  provider: 'claude',
  async refresh() {
    return {
      provider: 'claude',
      label: 'Claude',
      status: 'unsupported',
      snapshots: [],
      message: 'Live Claude refresh will be enabled after validating claude.ai endpoint behavior.'
    };
  }
};
```

- [ ] **Step 3: Run tests and commit**

Run:

```bash
npm test -- tests/claudeAdapter.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```bash
git add src/providers tests/claudeAdapter.test.ts
 git commit -m "feat: add claude usage adapter boundary"
```

---

### Task 8: Final verification and load test in Chrome

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add local install instructions**

Update `README.md` with:

```md
## Local development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Then open Chrome:

1. Go to `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the `dist/` folder.
5. Pin MeterBar to the toolbar.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all pass.

- [ ] **Step 3: Manually verify extension loads**

In Chrome, load `dist/` and verify:

- MeterBar icon appears.
- Badge displays `62` in green from mock data.
- Popup opens.
- Claude card shows two usage bars.
- Settings page opens.
- Clear local data button works.

- [ ] **Step 4: Commit and push MVP skeleton**

```bash
git add README.md
 git commit -m "docs: add local extension install steps"
git push -u origin main
```

---

## Self-review

- Spec coverage: Covers local-first extension, badge, popup, privacy settings, data model, alert foundations, and Claude adapter boundary.
- Placeholder scan: No implementation step uses TBD/TODO/fill-later language; future live endpoint validation is intentionally deferred as a non-MVP implementation boundary.
- Type consistency: Provider/window/confidence types match the PRD canonical schema.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-20-meterbar-mvp.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
