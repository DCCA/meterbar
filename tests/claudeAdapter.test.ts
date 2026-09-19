import { describe, expect, it } from 'vitest';
import {
  claudeUsageUrl,
  parseClaudeUsageResponse,
  pickClaudeOrgUuid
} from '../src/providers/claude/claudeAdapter';

const NOW = new Date('2026-06-20T16:16:00Z');

describe('parseClaudeUsageResponse', () => {
  // The live claude.ai endpoint returns `utilization` as a percent (0-100), not a 0-1 ratio.
  it('normalizes five_hour and seven_day windows from percent utilization', () => {
    const snapshots = parseClaudeUsageResponse({
      five_hour: { utilization: 15, resets_at: '2026-06-20T22:29:59.870472+00:00' },
      seven_day: { utilization: 8, resets_at: '2026-06-26T15:59:59.870493+00:00' },
      seven_day_sonnet: { utilization: 0, resets_at: '2026-06-26T15:59:59.870502+00:00' }
    }, NOW);

    expect(snapshots).toMatchObject([
      { provider: 'claude', window: 'five_hour', usedPercent: 15, usedRatio: 0.15, confidence: 'exact', stale: false },
      { provider: 'claude', window: 'seven_day', usedPercent: 8, usedRatio: 0.08, confidence: 'exact', stale: false }
    ]);
  });

  it('carries reset timestamps verbatim and stays not-stale at parse time', () => {
    const [first] = parseClaudeUsageResponse({
      five_hour: { utilization: 62, resets_at: '2026-06-20T18:30:00Z' }
    }, NOW);
    expect(first).toMatchObject({ usedPercent: 62, resetsAt: '2026-06-20T18:30:00Z', stale: false });
  });

  it('skips null windows and windows missing a numeric utilization', () => {
    expect(parseClaudeUsageResponse({ five_hour: null, seven_day: {} })).toEqual([]);
  });

  it('treats a null resets_at as absent', () => {
    const [first] = parseClaudeUsageResponse({ five_hour: { utilization: 5, resets_at: null } }, NOW);
    expect(first.resetsAt).toBeUndefined();
  });

  // Validation evidence for confidence: 'exact' - a real, sanitized response captured from
  // a logged-in claude.ai session on 2026-06-20. The parser must surface the two windows we
  // support and ignore the surrounding billing/limits/spend fields without error.
  it('parses the captured live response, ignoring non-window fields', () => {
    const captured = {
      five_hour: { utilization: 15, resets_at: '2026-06-20T22:29:59.870472+00:00', limit_dollars: null, used_dollars: null },
      seven_day: { utilization: 8, resets_at: '2026-06-26T15:59:59.870493+00:00', limit_dollars: null, used_dollars: null },
      seven_day_oauth_apps: null,
      seven_day_opus: null,
      seven_day_sonnet: { utilization: 0, resets_at: '2026-06-26T15:59:59.870502+00:00' },
      extra_usage: { is_enabled: false, monthly_limit: 0, used_credits: 0, utilization: null },
      limits: [{ kind: 'session', group: 'session', percent: 15, severity: 'normal', is_active: true }],
      spend: { used: { amount_minor: 0 }, limit: { amount_minor: 0 }, percent: 0, enabled: false }
    };
    const snapshots = parseClaudeUsageResponse(captured, NOW);
    expect(snapshots.map((s) => [s.window, s.usedPercent, s.confidence])).toEqual([
      ['five_hour', 15, 'exact'],
      ['seven_day', 8, 'exact']
    ]);
  });
});

describe('pickClaudeOrgUuid', () => {
  it('prefers the chat-capable organization over API-only or plan-only organizations', () => {
    const body = [
      { uuid: 'api-org', capabilities: ['api'] },
      { uuid: 'plan-org', capabilities: ['claude_max'] },
      { uuid: 'chat-org', capabilities: ['chat'] }
    ];
    expect(pickClaudeOrgUuid(body)).toBe('chat-org');
  });

  it('falls back to a non-API-only organization, then the first valid organization', () => {
    expect(pickClaudeOrgUuid([
      { uuid: 'api-org', capabilities: ['api'] },
      { uuid: 'workspace-org', capabilities: ['raven'] }
    ])).toBe('workspace-org');
    expect(pickClaudeOrgUuid([
      { uuid: 'first-api', capabilities: ['api'] },
      { uuid: 'second-api', capabilities: ['api'] }
    ])).toBe('first-api');
  });

  it('returns null for an empty list, a non-array body, or an org without a uuid', () => {
    expect(pickClaudeOrgUuid([])).toBeNull();
    expect(pickClaudeOrgUuid(null)).toBeNull();
    expect(pickClaudeOrgUuid({ error: 'nope' })).toBeNull();
    expect(pickClaudeOrgUuid([{ capabilities: ['claude_max'] }])).toBeNull();
  });
});

describe('claudeUsageUrl', () => {
  it('builds the org-scoped usage URL', () => {
    expect(claudeUsageUrl('abc-123')).toBe('https://claude.ai/api/organizations/abc-123/usage');
  });
});
