import type { Confidence, ProviderCardState, ProviderId, ProviderStatus, UsageWindow } from '../shared/types';
import { readAllHistory, type Point } from '../storage/historyStore';

export const COMPANION_HOST = 'com.meterbar.bridge';

const COMPANION_ORDER: ProviderId[] = ['claude', 'chatgpt', 'gemini'];
const COMPANION_PROVIDERS = new Set(COMPANION_ORDER);
const COMPANION_LABELS: Partial<Record<ProviderId, string>> = {
  claude: 'Claude',
  chatgpt: 'OpenAI',
  gemini: 'Gemini'
};

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

/** [unix ms, used percent] - the same shape as the extension's history points. */
export type CompanionHistoryPoint = [t: number, p: number];

export interface CompanionCard {
  provider: ProviderId;
  label: string;
  status?: ProviderStatus;
  lastUpdatedAt?: string;
  message?: string;
  snapshots: CompanionSnapshotRow[];
  /** Last 24h of the tightest window, at most HISTORY_MAX_POINTS, oldest first. */
  history?: CompanionHistoryPoint[];
}

export const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HISTORY_MAX_POINTS = 64;

/** Keep the last 24h and thin evenly to the cap, always keeping the newest point. */
export function sampleHistory(points: Point[], now: number): CompanionHistoryPoint[] {
  const recent = points.filter(([t, p]) => Number.isFinite(t) && Number.isFinite(p) && t >= now - HISTORY_WINDOW_MS && t <= now);
  if (recent.length <= HISTORY_MAX_POINTS) return recent.map(([t, p]) => [Math.round(t), clampPercent(p)]);
  const step = (recent.length - 1) / (HISTORY_MAX_POINTS - 1);
  return Array.from({ length: HISTORY_MAX_POINTS }, (_, i) => {
    const [t, p] = recent[Math.round(i * step)];
    return [Math.round(t), clampPercent(p)] as CompanionHistoryPoint;
  });
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** The window whose trend the companion draws: the card's highest fresh reading. */
function tightestWindow(card: ProviderCardState): UsageWindow | undefined {
  const usable = card.snapshots.filter((s) => s.confidence !== 'unavailable' && Number.isFinite(s.usedPercent));
  const fresh = usable.filter((s) => !s.stale);
  const pool = fresh.length > 0 ? fresh : usable;
  return pool.reduce<typeof pool[number] | undefined>((best, s) => (!best || s.usedPercent > best.usedPercent ? s : best), undefined)?.window;
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
export function toCompanionSnapshot(
  cards: ProviderCardState[],
  generatedAt = new Date().toISOString(),
  history: Record<string, Point[]> = {}
): CompanionSnapshot {
  const now = Date.parse(generatedAt);
  const byProvider = new Map(cards
    .filter((card) => COMPANION_PROVIDERS.has(card.provider))
    .map((card) => [card.provider, card]));

  return {
    type: 'meterbar:snapshot',
    schemaVersion: 1,
    generatedAt,
    cards: COMPANION_ORDER.map((provider) => {
      const card = byProvider.get(provider);
      if (!card) return {
        provider,
        label: COMPANION_LABELS[provider] ?? provider,
        snapshots: [],
        message: 'No usage reported'
      };
      const window = tightestWindow(card);
      const sampled = window ? sampleHistory(history[`history:${card.provider}:${window}`] ?? [], now) : [];
      return {
        provider: card.provider,
        label: safeText(card.label, 80),
        status: card.status,
        ...(sampled.length >= 2 ? { history: sampled } : {}),
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
      };
    })
  };
}

/** Ask the optional host to delete its local snapshot. */
export async function clearCompanion(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendNativeMessage(COMPANION_HOST, {
      type: 'meterbar:clear',
      schemaVersion: 1
    }) as { ok?: boolean } | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}

/** Best-effort local sync. MeterBar remains fully functional when the host is absent. */
export async function syncCompanion(cards: ProviderCardState[]): Promise<boolean> {
  // History is optional for the companion: a storage hiccup must not block the usage sync.
  const history = await readAllHistory().catch(() => ({}) as Record<string, Point[]>);
  try {
    const response = await chrome.runtime.sendNativeMessage(COMPANION_HOST, toCompanionSnapshot(cards, new Date().toISOString(), history)) as
      | { ok?: boolean }
      | undefined;
    return response?.ok === true;
  } catch {
    return false;
  }
}
