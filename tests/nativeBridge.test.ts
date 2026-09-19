import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPANION_HOST, syncCompanion, toCompanionSnapshot } from '../src/background/nativeBridge';
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
    expect(toCompanionSnapshot(cards, capturedAt)).toEqual({
      type: 'meterbar:snapshot',
      schemaVersion: 1,
      generatedAt: capturedAt,
      cards: [
        {
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
        }
      ]
    });

    const serialized = JSON.stringify(toCompanionSnapshot(cards, capturedAt));
    expect(serialized).not.toContain('must-not-leave-the-extension');
    expect(serialized).not.toContain('private-endpoint-name');
    expect(serialized).not.toContain('usedRatio');
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

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].provider).toBe('chatgpt');
    expect(result.cards[0].snapshots[0].usedPercent).toBe(100);
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

  it('keeps the extension functional when the optional host is absent', async () => {
    vi.stubGlobal('chrome', {
      runtime: { sendNativeMessage: vi.fn().mockRejectedValue(new Error('host not found')) }
    });

    await expect(syncCompanion(cards)).resolves.toBe(false);
  });
});
