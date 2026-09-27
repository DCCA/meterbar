import { buildTooltip } from '../shared/summary';
import { calculateBadgeState } from './badge';
import { renderIcon } from './icon';
import { clearCompanion } from './nativeBridge';

export interface ClearDataResult {
  companionCleared: boolean;
}

/** Clear every local store and immediately reset the always-visible toolbar surfaces. */
export async function clearMeterbarData(): Promise<ClearDataResult> {
  await chrome.storage.local.clear();
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
