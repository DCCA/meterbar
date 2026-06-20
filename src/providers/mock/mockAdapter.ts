import type { ProviderCardState } from '../../shared/types';

export function getMockCards(): ProviderCardState[] {
  return [
    {
      provider: 'claude',
      label: 'Claude',
      status: 'connected',
      lastUpdatedAt: new Date().toISOString(),
      snapshots: [
        {
          provider: 'claude',
          window: 'five_hour',
          usedRatio: 0.62,
          usedPercent: 62,
          resetsAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000).toISOString(),
          capturedAt: new Date().toISOString(),
          source: 'mock',
          confidence: 'exact',
          stale: false
        },
        {
          provider: 'claude',
          window: 'seven_day',
          usedRatio: 0.41,
          usedPercent: 41,
          capturedAt: new Date().toISOString(),
          source: 'mock',
          confidence: 'exact',
          stale: false
        }
      ]
    },
    { provider: 'chatgpt', label: 'ChatGPT / Codex', status: 'unsupported', snapshots: [], message: 'Adapter coming next.' },
    { provider: 'gemini', label: 'Gemini', status: 'unsupported', snapshots: [], message: 'Adapter coming next.' }
  ];
}
