import type { ProviderAdapter } from '../providerAdapter';
import type { UsageSnapshot, UsageWindow } from '../../shared/types';

interface GeminiUsageRaw { window?: string; remaining?: number; limit?: number; resets_at?: string; }

export function parseGeminiUsage(raw: GeminiUsageRaw, now: Date = new Date()): UsageSnapshot[] {
  if (typeof raw.remaining !== 'number' || typeof raw.limit !== 'number' || raw.limit <= 0) return [];
  const ratio = (raw.limit - raw.remaining) / raw.limit;
  return [{
    provider: 'gemini', window: (raw.window as UsageWindow) ?? 'daily',
    usedRatio: ratio, usedPercent: Math.round(ratio * 100),
    resetsAt: raw.resets_at, capturedAt: now.toISOString(),
    source: 'gemini-content', confidence: 'inferred', stale: false
  }];
}

export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini', label: 'Gemini',
  collection: { strategy: 'content', matches: ['https://gemini.google.com/*'] },
  parse: (raw) => parseGeminiUsage(raw as GeminiUsageRaw)
};
