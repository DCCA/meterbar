import { calculateBadgeState } from './badge';
import { clearMeterbarData } from './clearData';
import { iconBars } from './iconModel';
import { renderIcon } from './icon';
import { COMPANION_PERMISSION, syncCompanion } from './nativeBridge';
import { createCoalescedRefresh } from './refreshRunner';
import { createMutationGate } from './mutationGate';
import { aggregateCards, flattenSnapshots } from './aggregate';
import { refreshProvider, storeSnapshots, storeStatus } from './refresh';
import { evaluateAndNotify } from './alerts';
import { claudeAdapter } from '../providers/claude/claudeAdapter';
import { chatgptAdapter } from '../providers/chatgpt/chatgptAdapter';
import { geminiAdapter } from '../providers/gemini/geminiAdapter';
import { DEFAULT_SETTINGS, getAllCards, loadSettings } from '../storage/usageStore';
import {
  isDataClear,
  isStateGet,
  isStatusReport,
  isTrustedContentReportSender,
  isTrustedExtensionPageSender,
  isUsageRefresh,
  isUsageReport
} from '../shared/messages';
import { buildTooltip } from '../shared/summary';
import { nextStaleAt } from '../shared/time';
import {
  mergeRefreshRequests,
  providerForUrl,
  settingsRefreshRequest,
  type RefreshReason,
  type RefreshRequest
} from '../shared/refreshPolicy';
import type { FetchProviderId, ProviderId } from '../shared/types';

const ADAPTERS = [claudeAdapter, chatgptAdapter, geminiAdapter];
const reportMutations = createMutationGate();
const ADAPTERS_BY_ID: Partial<Record<ProviderId, (typeof ADAPTERS)[number]>> =
  Object.fromEntries(ADAPTERS.map((a) => [a.provider, a]));

async function recompute(): Promise<void> {
  const settings = await loadSettings();
  const cards = aggregateCards(await getAllCards(), settings);
  const badge = calculateBadgeState(flattenSnapshots(cards), settings.badgeTarget);
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await chrome.action.setBadgeTextColor({ color: badge.textColor });
  await renderIcon(iconBars(cards));
  await chrome.action.setTitle({ title: buildTooltip(cards) });
  await syncCompanion(cards);
  if (settings.notificationsEnabled) await evaluateAndNotify(cards);
  // Repaint (never fetch) when the next reading goes stale, so an idle badge clears on time.
  const staleAt = nextStaleAt(flattenSnapshots(cards));
  if (staleAt === undefined) await chrome.alarms.clear(STALE_ALARM);
  else await chrome.alarms.create(STALE_ALARM, { when: staleAt + 1000 });
}

let clearInProgress = false;
// Claude and OpenAI (ChatGPT/Codex) are fetch providers; Gemini reports via a content script.
// refreshProvider applies the per-provider gate (enabled, consent, backoff, min interval).
const refresh = createCoalescedRefresh<RefreshRequest>(async (request) => {
  if (clearInProgress) return;
  const settings = await loadSettings();
  await Promise.all((Object.entries(request) as Array<[FetchProviderId, RefreshReason]>)
    .map(([provider, reason]) => refreshProvider(provider, reason, settings)));
  await recompute();
}, mergeRefreshRequests);
const everyProvider = (reason: RefreshReason): RefreshRequest => ({ claude: reason, chatgpt: reason });

// The periodic alarm exists only while the user has opted in to background refresh.
const ALARM = 'meterbar-refresh';
const STALE_ALARM = 'meterbar-stale';
async function syncAlarm(on: boolean): Promise<void> {
  const existing = await chrome.alarms.get(ALARM);
  if (on && !existing) await chrome.alarms.create(ALARM, { periodInMinutes: 10 });
  if (!on && existing) await chrome.alarms.clear(ALARM);
}

// Browser start and install/update only; not every service-worker wake-up, which tab
// events cause constantly. Without background refresh, reads wait for the user.
function onStart(): void {
  void loadSettings().then((s) => {
    void syncAlarm(s.backgroundRefresh);
    void (s.backgroundRefresh ? refresh(everyProvider('startup')) : recompute());
  });
}
chrome.runtime.onInstalled.addListener(onStart);
chrome.runtime.onStartup.addListener(onStart);

// A claude.ai or chatgpt.com tab coming into view reads that provider only. The
// existing host permissions expose tab.url for those origins; no `tabs` permission.
function refreshForTab(url: string | undefined): void {
  const provider = providerForUrl(url);
  if (provider) void refresh({ [provider]: 'provider-tab' });
}
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((tab) => refreshForTab(tab.url), () => undefined);
});
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === 'complete') refreshForTab(tab.url);
});

// Settings pages only write storage; the worker reacts here, so no page can request a
// gate-bypassing 'settings' refresh by message.
const SETTINGS_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || clearInProgress) return;
  if ('backgroundRefresh' in changes) void syncAlarm(changes.backgroundRefresh.newValue === true);
  const request = settingsRefreshRequest(changes);
  if (Object.keys(request).length > 0) void refresh(request);
  else if (Object.keys(changes).some((key) => SETTINGS_KEYS.has(key))) void recompute();
});
// Publish the first companion snapshot as soon as the user grants the optional permission.
chrome.permissions.onAdded.addListener((p) => {
  if (p.permissions?.some((name) => COMPANION_PERMISSION.permissions?.includes(name))) void recompute();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === STALE_ALARM) void recompute();
  if (a.name !== ALARM) return;
  // Re-check the setting: an alarm that outlived it (clear, fast toggle) must never poll.
  void loadSettings().then((s) => (s.backgroundRefresh ? refresh(everyProvider('alarm')) : syncAlarm(false)));
});

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (isUsageReport(msg)) {
    if (!isTrustedContentReportSender(msg.provider, sender, chrome.runtime.id)) return false;
    const adapter = ADAPTERS_BY_ID[msg.provider];
    const operation = adapter ? reportMutations.run(async () => {
      await storeSnapshots(msg.provider, adapter.label, adapter.parse(msg.raw));
      await recompute();
    }) : null;
    if (operation) void operation.catch(() => undefined);
    return false;
  }
  if (isStatusReport(msg)) {
    if (!isTrustedContentReportSender(msg.provider, sender, chrome.runtime.id)) return false;
    const adapter = ADAPTERS_BY_ID[msg.provider];
    const operation = reportMutations.run(async () => {
      await storeStatus(msg.provider, adapter?.label ?? msg.provider, msg.status, msg.message);
      await recompute();
    });
    if (operation) void operation.catch(() => undefined);
    return false;
  }
  if (!isTrustedExtensionPageSender(sender, chrome.runtime.id)) return false;
  if (isUsageRefresh(msg)) {
    void refresh(everyProvider(msg.reason ?? 'manual')).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (isDataClear(msg)) {
    if (clearInProgress) {
      sendResponse({ ok: false, companionCleared: false });
      return false;
    }
    clearInProgress = true;
    const reportsIdle = reportMutations.pauseAndWait();
    const refreshIdle = refresh.whenIdle().catch(() => undefined);
    void Promise.all([refreshIdle, reportsIdle])
      .then(clearMeterbarData)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false, companionCleared: false }))
      .finally(() => {
        reportMutations.resume();
        clearInProgress = false;
      });
    return true;
  }
  if (isStateGet(msg)) {
    void loadSettings().then(async (s) => sendResponse({
      type: 'state:result',
      cards: aggregateCards(await getAllCards(), s)
    }));
    return true;
  }
  return false;
});

