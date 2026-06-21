import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import { getCard, putCard } from '../storage/usageStore';
import { recordPoint } from '../storage/historyStore';
import { claudeAdapter, claudeOrgsUrl, claudeUsageUrl, pickClaudeOrgUuid } from '../providers/claude/claudeAdapter';
import { chatgptAdapter, chatgptSessionUrl, chatgptAccountsUrl, chatgptUsageUrl, pickChatgptAccountId } from '../providers/chatgpt/chatgptAdapter';

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

/**
 * Background refresh for ChatGPT/Codex. Mints a Bearer access token from the session
 * cookie (`/api/auth/session`), resolves the account id, then reads `wham/usage`. The
 * token and account id are used only for the requests and never stored. All network
 * I/O and HTTP->status mapping live here; the adapter contributes only pure helpers.
 */
export async function refreshChatgpt(): Promise<void> {
  const { provider, label } = chatgptAdapter;
  try {
    const sessionRes = await fetch(chatgptSessionUrl(), SESSION_FETCH);
    if (isAuthFailure(sessionRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!sessionRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${sessionRes.status}`);
    const token = ((await sessionRes.json()) as { accessToken?: string })?.accessToken;
    if (!token) return storeStatus(provider, label, 'not_connected', 'Not logged in.');

    const authInit: RequestInit = { credentials: 'include', headers: { accept: 'application/json', authorization: `Bearer ${token}` } };
    const acctRes = await fetch(chatgptAccountsUrl(), authInit);
    const accountId = acctRes.ok ? pickChatgptAccountId(await acctRes.json()) : null;

    const usageHeaders: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${token}` };
    if (accountId) usageHeaders['ChatGPT-Account-Id'] = accountId;
    const usageRes = await fetch(chatgptUsageUrl(), { credentials: 'include', headers: usageHeaders });
    if (isAuthFailure(usageRes)) return storeStatus(provider, label, 'not_connected', 'Not logged in.');
    if (!usageRes.ok) return storeStatus(provider, label, 'stale', `HTTP ${usageRes.status}`);

    await storeSnapshots(provider, label, chatgptAdapter.parse(await usageRes.json()));
  } catch {
    await storeStatus(provider, label, 'stale', 'Fetch failed.');
  }
}
