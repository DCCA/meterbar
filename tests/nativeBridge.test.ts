import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCompanion, COMPANION_HOST, HISTORY_MAX_POINTS, sampleHistory, syncCompanion, toCompanionSnapshot } from '../src/background/nativeBridge';
import type { ProviderCardState } from '../src/shared/types';

const capturedAt = '2026-09-19T18:00:00.000Z';
const cards: ProviderCardState[] = [
  {
    provider: 'claude',
    label: 'Claude',
    status: 'connected',
    lastUpdatedAt: capturedAt,
    snapshots: [
      {
        provider: 'claude',
        accountIdHash: 'must-not-leave-the-extension',
        workspaceLabel: '5-hour limit',
        window: 'five_hour',
        usedRatio: 0.62,
        usedPercent: 62,
        resetsAt: '2026-09-19T20:00:00.000Z',
        capturedAt,
        source: 'private-endpoint-name',
        confidence: 'exact',
        stale: false
      }
    ]
  }
];

describe('native companion bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exports only the sanitized usage contract needed by the Omarchy companion', () => {
    const snapshot = toCompanionSnapshot(cards, capturedAt);
    expect(snapshot).toMatchObject({
      type: 'meterbar:snapshot',
      schemaVersion: 1,
      generatedAt: capturedAt
    });
    expect(snapshot.cards[0]).toEqual({
      provider: 'claude',
      label: 'Claude',
      status: 'connected',
      lastUpdatedAt: capturedAt,
      snapshots: [
        {
          provider: 'claude',
          workspaceLabel: '5-hour limit',
          window: 'five_hour',
          usedPercent: 62,
          resetsAt: '2026-09-19T20:00:00.000Z',
          capturedAt,
          confidence: 'exact',
          stale: false
        }
      ]
    });
    expect(snapshot.cards.slice(1)).toEqual([
      { provider: 'chatgpt', label: 'ChatGPT', snapshots: [], message: 'No usage reported' },
      { provider: 'codex', label: 'Codex', snapshots: [], message: 'No usage reported' },
      { provider: 'gemini', label: 'Gemini', snapshots: [], message: 'No usage reported' }
    ]);

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('must-not-leave-the-extension');
    expect(serialized).not.toContain('private-endpoint-name');
    expect(serialized).not.toContain('usedRatio');
  });

  it('attaches a bounded 24-hour history of the tightest window, and nothing older', () => {
    const now = Date.parse(capturedAt);
    const hour = 60 * 60 * 1000;
    const history = {
      'history:claude:five_hour': [[now - 30 * hour, 5], [now - 2 * hour, 40], [now - hour, 55], [now, 62]] as Array<[number, number]>,
      'history:claude:seven_day': [[now - hour, 10], [now, 12]] as Array<[number, number]>
    };
    const snapshot = toCompanionSnapshot(cards, capturedAt, history);
    expect(snapshot.cards[0].history).toEqual([[now - 2 * hour, 40], [now - hour, 55], [now, 62]]);
    expect(snapshot.cards[1].history).toBeUndefined();
  });

  it('thins long histories to the cap while keeping the newest point', () => {
    const now = 1_800_000_000_000;
    const points = Array.from({ length: 300 }, (_, i) => [now - (299 - i) * 60_000, i % 100] as [number, number]);
    const sampled = sampleHistory(points, now);
    expect(sampled).toHaveLength(HISTORY_MAX_POINTS);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled[sampled.length - 1]).toEqual([now, 99]);
  });

  it('publishes companion cards in the fixed provider order', () => {
    const providers: ProviderCardState['provider'][] = ['gemini', 'codex', 'chatgpt', 'claude'];
    const shuffled = providers.map((provider) => ({
      provider,
      label: provider,
      status: 'connected' as const,
      snapshots: []
    }));

    expect(toCompanionSnapshot(shuffled, capturedAt).cards.map((card) => card.provider))
      .toEqual(['claude', 'chatgpt', 'codex', 'gemini']);
  });

  it('drops unknown providers and clamps malformed percentages', () => {
    const result = toCompanionSnapshot([
      { ...cards[0], provider: 'unknown' },
      {
        ...cards[0],
        provider: 'chatgpt',
        label: 'ChatGPT / Codex',
        snapshots: [{ ...cards[0].snapshots[0], provider: 'chatgpt', usedPercent: 140 }]
      }
    ], capturedAt);

    expect(result.cards).toHaveLength(4);
    const chatgpt = result.cards.find((card) => card.provider === 'chatgpt');
    expect(chatgpt?.snapshots[0].usedPercent).toBe(100);
    expect(result.cards.some((card) => card.provider === 'unknown')).toBe(false);
  });

  it('sends the sanitized contract to the single allowlisted host', async () => {
    const sendNativeMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('chrome', { runtime: { sendNativeMessage } });

    await expect(syncCompanion(cards)).resolves.toBe(true);
    expect(sendNativeMessage).toHaveBeenCalledWith(
      COMPANION_HOST,
      expect.objectContaining({ type: 'meterbar:snapshot', schemaVersion: 1 })
    );
    expect(JSON.stringify(sendNativeMessage.mock.calls[0][1])).not.toContain('must-not-leave-the-extension');
  });

  it('asks the host to remove its local snapshot when MeterBar data is cleared', async () => {
    const sendNativeMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('chrome', { runtime: { sendNativeMessage } });

    await expect(clearCompanion()).resolves.toBe(true);
    expect(sendNativeMessage).toHaveBeenCalledWith(COMPANION_HOST, {
      type: 'meterbar:clear',
      schemaVersion: 1
    });
  });

  it('keeps the extension functional when the optional host is absent', async () => {
    vi.stubGlobal('chrome', {
      runtime: { sendNativeMessage: vi.fn().mockRejectedValue(new Error('host not found')) }
    });

    await expect(syncCompanion(cards)).resolves.toBe(false);
  });
});
