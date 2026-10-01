import { buildTooltip } from '../shared/summary';
import { calculateBadgeState } from './badge';
import { renderIcon } from './icon';
import { clearCompanion } from './nativeBridge';
import type { RefreshState } from '../storage/usageStore';

export interface ClearDataResult {
  companionCleared: boolean;
}

/**
 * Clear every local store and timer and immediately reset the always-visible toolbar
 * surfaces. An unexpired 429 wait survives: it is the provider's instruction, not user
 * data, and dropping it would let a re-allowed provider be asked again too early.
 */
export async function clearMeterbarData(): Promise<ClearDataResult> {
  const now = Date.now();
  const waits = Object.fromEntries(Object.entries(await chrome.storage.local.get(null)).flatMap(([key, value]) => {
    const until = key.startsWith('refreshState:') ? (value as RefreshState | undefined)?.backoffUntil : undefined;
    return until && Date.parse(until) > now ? [[key, { backoffUntil: until }]] : [];
  }));
  await chrome.storage.local.clear();
  if (Object.keys(waits).length > 0) await chrome.storage.local.set(waits);
  await chrome.alarms.clearAll();
  const companionCleared = await clearCompanion();
  const badge = calculateBadgeState([]);
  await Promise.all([
    chrome.action.setBadgeText({ text: badge.text }),
    chrome.action.setBadgeBackgroundColor({ color: badge.color }),
    chrome.action.setBadgeTextColor({ color: badge.textColor }),
    renderIcon([]),
    chrome.action.setTitle({ title: buildTooltip([]) })
  ]);
  return { companionCleared };
}
