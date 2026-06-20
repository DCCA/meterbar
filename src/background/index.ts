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
