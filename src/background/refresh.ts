import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { getCard, putCard } from '../storage/usageStore';
import { recordPoint } from '../storage/historyStore';
import { claudeAdapter, claudeOrgsUrl, claudeUsageUrl, pickClaudeOrgUuid } from '../providers/claude/claudeAdapter';

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

const SESSION_FETCH: RequestInit = { credentials: 'include', headers: { accept: 'application/json' } };

/** An unauthenticated/redirected response means the user isn't logged in to claude.ai. */
function isAuthFailure(res: Response): boolean {
  return res.status === 401 || res.status === 403 || res.redirected;
}

/**
 * Background refresh for Claude: discover the account's org from the same endpoint the
 * logged-in UI uses, then read that org's usage — both with the session cookie, nothing
 * stored. All network I/O and HTTP→status mapping live here; the adapter contributes
 * only the pure `pickClaudeOrgUuid`, URL builders, and `parse`.
 */
export async function refreshClaude(): Promise<void> {
  const { provider, label } = claudeAdapter;
  try {
    const orgsRes = await fetch(claudeOrgsUrl(), SESSION_FETCH);
    if (isAuthFailure(orgsRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!orgsRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${orgsRes.status}`);

    const uuid = pickClaudeOrgUuid(await orgsRes.json());
    if (!uuid) return storeStatus(provider, label, 'not_connected', 'No Claude organization found.');

    const usageRes = await fetch(claudeUsageUrl(uuid), SESSION_FETCH);
    if (isAuthFailure(usageRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!usageRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${usageRes.status}`);

    await storeSnapshots(provider, label, claudeAdapter.parse(await usageRes.json()));
  } catch {
    await storeStatus(provider, label, 'stale', 'Fetch failed.');
  }
}
