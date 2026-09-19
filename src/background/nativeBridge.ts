import type { Confidence, ProviderCardState, ProviderId, ProviderStatus, UsageWindow } from '../shared/types';

export const COMPANION_HOST = 'com.meterbar.bridge';

const COMPANION_PROVIDERS = new Set<ProviderId>(['claude', 'chatgpt', 'codex', 'gemini']);

export interface CompanionSnapshotRow {
  provider: ProviderId;
  workspaceLabel?: string;
  window: UsageWindow;
  usedPercent: number;
  resetsAt?: string;
  capturedAt: string;
  confidence: Confidence;
  stale: boolean;
}

export interface CompanionCard {
  provider: ProviderId;
  label: string;
  status: ProviderStatus;
  lastUpdatedAt?: string;
  message?: string;
  snapshots: CompanionSnapshotRow[];
}

export interface CompanionSnapshot {
  type: 'meterbar:snapshot';
  schemaVersion: 1;
  generatedAt: string;
  cards: CompanionCard[];
}

function safeText(value: string, maxLength = 240): string {
  return value.slice(0, maxLength);
}

/**
 * Reduce extension state to the local companion contract. Authentication material,
 * endpoint names, account identifiers, and browser-only implementation details never
 * cross the native-messaging boundary.
 */
export function toCompanionSnapshot(cards: ProviderCardState[], generatedAt = new Date().toISOString()): CompanionSnapshot {
  return {
    type: 'meterbar:snapshot',
    schemaVersion: 1,
    generatedAt,
    cards: cards
      .filter((card) => COMPANION_PROVIDERS.has(card.provider))
      .map((card) => ({
        provider: card.provider,
        label: safeText(card.label, 80),
        status: card.status,
        ...(card.lastUpdatedAt ? { lastUpdatedAt: card.lastUpdatedAt } : {}),
        ...(card.message ? { message: safeText(card.message) } : {}),
        snapshots: card.snapshots.flatMap((snapshot) => {
          if (!Number.isFinite(snapshot.usedPercent)) return [];
          return [{
            provider: card.provider,
            ...(snapshot.workspaceLabel ? { workspaceLabel: safeText(snapshot.workspaceLabel, 80) } : {}),
            window: snapshot.window,
            usedPercent: Math.max(0, Math.min(100, Math.round(snapshot.usedPercent))),
            ...(snapshot.resetsAt ? { resetsAt: snapshot.resetsAt } : {}),
            capturedAt: snapshot.capturedAt,
            confidence: snapshot.confidence,
            stale: snapshot.stale
          }];
        })
      }))
  };
}

/** Best-effort local sync. MeterBar remains fully functional when the host is absent. */
export async function syncCompanion(cards: ProviderCardState[]): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendNativeMessage(COMPANION_HOST, toCompanionSnapshot(cards)) as
      | { ok?: boolean }
      | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}
