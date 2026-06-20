import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot } from '../../shared/types';

interface ClaudeUsageWindow {
  utilization?: number;
  resets_at?: string;
}

interface ClaudeUsageResponse {
  five_hour?: ClaudeUsageWindow;
  seven_day?: ClaudeUsageWindow;
}

export function parseClaudeUsageResponse(payload: ClaudeUsageResponse, now: Date = new Date()): UsageSnapshot[] {
  const capturedAt = now.toISOString();
  const windows: Array<[UsageSnapshot['window'], ClaudeUsageWindow | undefined]> = [
    ['five_hour', payload.five_hour],
    ['seven_day', payload.seven_day]
  ];

  return windows.flatMap(([window, value]) => {
    if (!value || typeof value.utilization !== 'number') return [];
    const usedPercent = Math.round(value.utilization * 100);
    return [{
      provider: 'claude',
      window,
      usedRatio: value.utilization,
      usedPercent,
      resetsAt: value.resets_at,
      capturedAt,
      source: 'claude-usage-response',
      confidence: 'exact',
      stale: false
    }];
  });
}

// CLAUDE_USAGE_ENDPOINT: set to the URL validated by live network inspection (see plan Task 6).
const CLAUDE_USAGE_ENDPOINT = 'https://claude.ai/api/usage';

export const claudeAdapter: ProviderAdapter = {
  provider: 'claude',
  label: 'Claude',
  collection: { strategy: 'fetch', endpoint: CLAUDE_USAGE_ENDPOINT, init: { headers: { accept: 'application/json' } } },
  parse: (raw) => parseClaudeUsageResponse(raw as ClaudeUsageResponse)
};
