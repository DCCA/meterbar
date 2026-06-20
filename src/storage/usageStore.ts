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
