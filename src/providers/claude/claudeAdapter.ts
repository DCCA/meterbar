import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot } from '../../shared/types';

interface ClaudeUsageWindow {
  // The live claude.ai endpoint reports utilization as a percent (0-100), not a 0-1 ratio.
  utilization?: number;
  resets_at?: string | null;
}

interface ClaudeUsageResponse {
  five_hour?: ClaudeUsageWindow | null;
  seven_day?: ClaudeUsageWindow | null;
  // Other windows the live endpoint returns but we don't surface as separate cards yet.
  seven_day_sonnet?: ClaudeUsageWindow | null;
  seven_day_opus?: ClaudeUsageWindow | null;
}

/**
 * Pure parser (no I/O). Confidence is `exact` because the live claude.ai usage
 * endpoint returns a clean JSON document of percentages + reset timestamps, manually
 * validated against a real logged-in response on 2026-06-20 - that captured response
 * is checked in as the fixture in tests/claudeAdapter.test.ts (the plan's required
 * validation evidence before shipping `exact`).
 */
export function parseClaudeUsageResponse(payload: ClaudeUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const windows: Array<[UsageSnapshot['window'], ClaudeUsageWindow | null | undefined]> = [
    ['five_hour', payload.five_hour],
    ['seven_day', payload.seven_day]
  ];

  return windows.flatMap(([window, value]) => {
    if (!value || typeof value.utilization !== 'number') return [];
    const usedPercent = Math.round(value.utilization);
    return [{
      provider: 'claude',
      window,
      usedRatio: value.utilization / 100,
      usedPercent,
      resetsAt: value.resets_at ?? undefined,
      capturedAt,
      source: 'claude-usage-response',
      confidence: 'exact',
      stale: false
    }];
  });
}

// --- Pure endpoint/selection helpers ---
// claude.ai serves subscription usage per-organization, authenticated by the logged-in
// session cookie. The background worker performs the fetches (I/O lives there); these
// helpers stay pure and testable. The org UUID is used only to build the request URL
// and is never stored (PRD: store only usage metrics, never raw account identifiers).

export const CLAUDE_ORIGIN = 'https://claude.ai';

interface ClaudeOrganization {
  uuid?: string;
  capabilities?: string[];
}

export function claudeOrgsUrl(): string {
  return `${CLAUDE_ORIGIN}/api/organizations`;
}

export function claudeUsageUrl(orgUuid: string): string {
  return `${CLAUDE_ORIGIN}/api/organizations/${orgUuid}/usage`;
}

/**
 * Choose which organization's usage to read from the org list the logged-in UI already
 * fetches. Prefer a chat-capable organization, then any organization that is not API-only.
 * This avoids selecting a developer API organization on multi-workspace accounts.
 */
export function pickClaudeOrgUuid(body: unknown): string | null {
  const orgs: ClaudeOrganization[] = (Array.isArray(body) ? body : [])
    .filter((org): org is ClaudeOrganization & { uuid: string } => typeof org?.uuid === 'string' && org.uuid.length > 0);
  const capabilities = (org: ClaudeOrganization): Set<string> =>
    new Set((org.capabilities ?? []).map((capability) => capability.toLowerCase()));
  const chatOrg = orgs.find((org) => capabilities(org).has('chat'));
  const nonApiOnlyOrg = orgs.find((org) => {
    const values = capabilities(org);
    return !(values.size === 1 && values.has('api'));
  });
  return chatOrg?.uuid ?? nonApiOnlyOrg?.uuid ?? orgs[0]?.uuid ?? null;
}

export const claudeAdapter: ProviderAdapter = {
  provider: 'claude',
  label: 'Claude',
  // `fetch` strategy: the background worker reads usage with the logged-in session
  // cookie (credentials: 'include'); no token or key is stored. `endpoint` is the
  // org-discovery entrypoint - the per-org usage URL is resolved at refresh time.
  collection: { strategy: 'fetch', endpoint: claudeOrgsUrl(), init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseClaudeUsageResponse(raw as ClaudeUsageResponse)
};
