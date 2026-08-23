import { calculateBadgeState } from './badge';
import { iconBars } from './iconModel';
import { renderIcon } from './icon';
import { aggregateCards, flattenSnapshots } from './aggregate';
import { refreshClaude, refreshChatgpt, storeSnapshots, storeStatus } from './refresh';
import { evaluateAndNotify } from './alerts';
import { claudeAdapter } from '../providers/claude/claudeAdapter';
import { chatgptAdapter } from '../providers/chatgpt/chatgptAdapter';
import { geminiAdapter } from '../providers/gemini/geminiAdapter';
import { getAllCards, loadSettings, type Settings } from '../storage/usageStore';
import {
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
const ADAPTERS_BY_ID: Partial<Record<ProviderId, (typeof ADAPTERS)[number]>> =
  Object.fromEntries(ADAPTERS.map((a) => [a.provider, a]));

function isEnabled(provider: ProviderId, settings: Settings): boolean {
  if (provider === 'claude') return settings.claudeEnabled;
  if (provider === 'chatgpt' || provider === 'codex') return settings.chatgptEnabled;
  if (provider === 'gemini') return settings.geminiEnabled;
  return true;
}

async function recompute(): Promise<void> {
  const settings = await loadSettings();
  const cards = aggregateCards(await getAllCards(), settings);
  const badge = calculateBadgeState(flattenSnapshots(cards), settings.badgeTarget);
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  await renderIcon(iconBars(cards));
  await chrome.action.setTitle({ title: buildTooltip(cards) });
  if (settings.notificationsEnabled) await evaluateAndNotify(cards);
}

async function refreshAll(): Promise<void> {
  const settings = await loadSettings();
  // Claude and ChatGPT/Codex are background-fetch providers; Gemini reports via a content script.
  await Promise.all([
    isEnabled('claude', settings) ? refreshClaude() : Promise.resolve(),
    isEnabled('chatgpt', settings) ? refreshChatgpt() : Promise.resolve()
  ]);
  await recompute();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('meterbar-refresh', { periodInMinutes: 10 });
  void refreshAll();
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'meterbar-refresh') void refreshAll(); });

chrome.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
  if (isUsageReport(msg)) {
    if (!isTrustedContentReportSender(msg.provider, sender, chrome.runtime.id)) return false;
    const adapter = ADAPTERS_BY_ID[msg.provider];
    if (adapter) void storeSnapshots(msg.provider, adapter.label, adapter.parse(msg.raw)).then(recompute);
    return false;
  }
  if (isStatusReport(msg)) {
    if (!isTrustedContentReportSender(msg.provider, sender, chrome.runtime.id)) return false;
    const adapter = ADAPTERS_BY_ID[msg.provider];
    void storeStatus(msg.provider, adapter?.label ?? msg.provider, msg.status, msg.message).then(recompute);
    return false;
  }
  if (!isTrustedExtensionPageSender(sender, chrome.runtime.id)) return false;
  if (isUsageRefresh(msg)) {
    void refreshAll().then(() => sendResponse({ ok: true }));
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
