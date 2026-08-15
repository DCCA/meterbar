export type ProviderId = 'claude' | 'chatgpt' | 'codex' | 'gemini' | 'unknown';
export type UsageWindow = 'five_hour' | 'seven_day' | 'daily' | 'monthly' | 'api_billing' | 'rolling' | 'custom';
export type Confidence = 'exact' | 'estimated' | 'inferred' | 'unavailable';
export type ProviderStatus = 'connected' | 'not_connected' | 'stale' | 'unsupported';

export interface UsageSnapshot {
  provider: ProviderId;
  accountIdHash?: string;
  workspaceLabel?: string;
  window: UsageWindow;
  /** Exact rolling-window duration when the provider reports one. */
  windowSeconds?: number;
  usedRatio: number;
  usedPercent: number;
  resetsAt?: string;
  capturedAt: string;
  source: string;
  confidence: Confidence;
  stale: boolean;
}

export interface ProviderCardState {
  provider: ProviderId;
  label: string;
  status: ProviderStatus;
  snapshots: UsageSnapshot[];
  lastUpdatedAt?: string;
  message?: string;
}
