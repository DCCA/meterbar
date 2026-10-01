import type { FetchProviderId, ProviderCardState, ProviderId } from '../shared/types';
import { parseBadgeTarget, type BadgeTargetId } from '../shared/badgeTarget';

export interface Settings {
  notificationsEnabled: boolean;
  claudeEnabled: boolean;
  chatgptEnabled: boolean;
  geminiEnabled: boolean;
  badgeTarget: BadgeTargetId;
  /** Off by default: without it MeterBar reads only while a provider tab or MeterBar surface is open. */
  backgroundRefresh: boolean;
  /** ISO time the user OK'd each fetch provider's notice; no requests before it. */
  acknowledged: Partial<Record<FetchProviderId, string>>;
}
export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true, claudeEnabled: true, chatgptEnabled: true, geminiEnabled: true,
  badgeTarget: 'riskiest', backgroundRefresh: false, acknowledged: {}
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
  const raw = (await chrome.storage.local.get(DEFAULT_SETTINGS)) as Settings;
  // Legacy `provider:window` ids map to their provider, so the type holds at runtime.
  return { ...raw, badgeTarget: parseBadgeTarget(raw.badgeTarget).id };
}
export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set(s);
}
/** Per-provider refresh bookkeeping; persisted because the service worker is ephemeral. */
export interface RefreshState { backoffUntil?: string; lastAttemptAt?: string; }

export async function loadRefreshState(provider: ProviderId): Promise<RefreshState> {
  const k = `refreshState:${provider}`;
  return ((await chrome.storage.local.get(k))[k] ?? {}) as RefreshState;
}
export async function updateRefreshState(provider: ProviderId, patch: RefreshState): Promise<void> {
  await chrome.storage.local.set({ [`refreshState:${provider}`]: { ...(await loadRefreshState(provider)), ...patch } });
}
export async function loadAlertState(): Promise<AlertState> {
  return ((await chrome.storage.local.get({ alertState: { seen: [], lastReset: {} } })).alertState) as AlertState;
}
export async function saveAlertState(a: AlertState): Promise<void> {
  await chrome.storage.local.set({ alertState: a });
}
