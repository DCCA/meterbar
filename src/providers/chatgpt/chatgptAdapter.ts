import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface ChatgptUsageRaw { window?: string; used?: number; limit?: number; resets_at?: string; }

export function parseChatgptUsage(raw: ChatgptUsageRaw, now: Date = new Date()): UsageSnapshot[] {
  if (typeof raw.used !== 'number' || typeof raw.limit !== 'number' || raw.limit <= 0) return [];
  const ratio = raw.used / raw.limit;
  return [{
    provider: 'chatgpt',
    window: (raw.window as UsageWindow) ?? 'daily',
    usedRatio: ratio, usedPercent: Math.round(ratio * 100),
    resetsAt: raw.resets_at, capturedAt: now.toISOString(),
    source: 'chatgpt-content', confidence: 'estimated', stale: false
  }];
}

export const chatgptAdapter: ProviderAdapter = {
  provider: 'chatgpt', label: 'ChatGPT / Codex',
  collection: { strategy: 'content', matches: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] },
  parse: (raw) => parseChatgptUsage(raw as ChatgptUsageRaw)
};
