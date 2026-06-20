import type { ProviderAdapter } from '../providers/providerAdapter';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { getCard, putCard } from '../storage/usageStore';
import { recordPoint } from '../storage/historyStore';

/** Persist parsed snapshots as the provider's latest card and append history. */
export async function storeSnapshots(provider: ProviderId, label: string, snapshots: UsageSnapshot[]): Promise<void> {
  const now = new Date().toISOString();
  const card: ProviderCardState = {
    provider, label,
    status: snapshots.length ? 'connected' : 'not_connected',
    lastUpdatedAt: now, snapshots
  };
  await putCard(card);
  for (const s of snapshots) await recordPoint(provider, s.window, Date.parse(s.capturedAt), s.usedPercent);
}

export async function storeStatus(provider: ProviderId, label: string, status: ProviderCardState['status'], message?: string): Promise<void> {
  const prev = await getCard(provider);
  await putCard({ provider, label, status, message, snapshots: prev?.snapshots ?? [], lastUpdatedAt: prev?.lastUpdatedAt });
}

/** Background fetch for `fetch`-strategy adapters; uses the logged-in session via host_permissions. */
export async function refreshFetchAdapter(adapter: ProviderAdapter): Promise<void> {
  if (adapter.collection.strategy !== 'fetch') return;
  try {
    const res = await fetch(adapter.collection.endpoint, { credentials: 'include', ...adapter.collection.init });
    if (res.status === 401 || res.status === 403 || res.redirected) {
      return storeStatus(adapter.provider, adapter.label, 'not_connected', 'Not logged in.');
    }
    if (!res.ok) return storeStatus(adapter.provider, adapter.label, 'stale', `HTTP ${res.status}`);
    const snapshots = adapter.parse(await res.json());
    await storeSnapshots(adapter.provider, adapter.label, snapshots);
  } catch {
    await storeStatus(adapter.provider, adapter.label, 'stale', 'Fetch failed.');
  }
}
