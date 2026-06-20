import { calculateBadgeState } from './badge';
import { aggregateCards, flattenSnapshots } from './aggregate';
import { refreshClaude, storeSnapshots } from './refresh';
import { evaluateAndNotify } from './alerts';
import { claudeAdapter } from '../providers/claude/claudeAdapter';
import { chatgptAdapter } from '../providers/chatgpt/chatgptAdapter';
import { geminiAdapter } from '../providers/gemini/geminiAdapter';
import { getAllCards, loadSettings, type Settings } from '../storage/usageStore';
import { isUsageReport, type ExtensionMessage } from '../shared/messages';
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
  const badge = calculateBadgeState(flattenSnapshots(cards));
  await chrome.action.setBadgeText({ text: badge.text });
  await chrome.action.setBadgeBackgroundColor({ color: badge.color });
  if (settings.notificationsEnabled) await evaluateAndNotify(cards);
}

async function refreshAll(): Promise<void> {
  const settings = await loadSettings();
  // Claude is the only background-fetch provider; ChatGPT/Gemini report via content scripts.
  if (isEnabled('claude', settings)) await refreshClaude();
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
