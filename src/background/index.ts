import { calculateBadgeState } from './badge';
import { clearMeterbarData } from './clearData';
import { iconBars } from './iconModel';
import { renderIcon } from './icon';
import { COMPANION_PERMISSION, syncCompanion } from './nativeBridge';
import { createCoalescedRefresh } from './refreshRunner';
import { createMutationGate } from './mutationGate';
import { aggregateCards, flattenSnapshots } from './aggregate';
import { refreshClaude, refreshChatgpt, storeSnapshots, storeStatus } from './refresh';
import { evaluateAndNotify } from './alerts';
import { claudeAdapter } from '../providers/claude/claudeAdapter';
import { chatgptAdapter } from '../providers/chatgpt/chatgptAdapter';
import { geminiAdapter } from '../providers/gemini/geminiAdapter';
import { getAllCards, loadSettings, type Settings } from '../storage/usageStore';
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
import type { ProviderId } from '../shared/types';

const ADAPTERS = [claudeAdapter, chatgptAdapter, geminiAdapter];
const reportMutations = createMutationGate();
const ADAPTERS_BY_ID: Partial<Record<ProviderId, (typeof ADAPTERS)[number]>> =
  Object.fromEntries(ADAPTERS.map((a) => [a.provider, a]));

function isEnabled(provider: ProviderId, settings: Settings): boolean {
  if (provider === 'claude') return settings.claudeEnabled;
  if (provider === 'chatgpt') return settings.chatgptEnabled;
  if (provider === 'gemini') return settings.geminiEnabled;
  return true;
}

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
}

let clearInProgress = false;
const refreshAll = createCoalescedRefresh(async () => {
  if (clearInProgress) return;
  const settings = await loadSettings();
  // Claude and OpenAI (ChatGPT/Codex) are background-fetch providers; Gemini reports via a content script.
  await Promise.all([
    isEnabled('claude', settings) ? refreshClaude() : Promise.resolve(),
    isEnabled('chatgpt', settings) ? refreshChatgpt() : Promise.resolve()
  ]);
  await recompute();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('meterbar-refresh', { periodInMinutes: 10 });
  void refreshAll();
});
// Publish the first companion snapshot as soon as the user grants the optional permission.
chrome.permissions.onAdded.addListener((p) => {
  if (p.permissions?.some((name) => COMPANION_PERMISSION.permissions?.includes(name))) void recompute();
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'meterbar-refresh') void refreshAll(); });

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
    void refreshAll().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (isDataClear(msg)) {
    if (clearInProgress) {
      sendResponse({ ok: false, companionCleared: false });
      return false;
    }
    clearInProgress = true;
    const reportsIdle = reportMutations.pauseAndWait();
    const refreshIdle = refreshAll.whenIdle().catch(() => undefined);
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

void refreshAll();
