import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings } from '../src/storage/usageStore';

function stubStorage(badgeTarget: string) {
  const set = vi.fn(async () => undefined);
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async () => ({ ...DEFAULT_SETTINGS, badgeTarget })),
        set
      }
    }
  });
  return set;
}

afterEach(() => vi.unstubAllGlobals());

describe('loadSettings', () => {
  it('persists legacy fixed OpenAI targets as the provider-level target', async () => {
    const set = stubStorage('chatgpt:five_hour');
    const settings = await loadSettings();

    expect(settings.badgeTarget).toBe('chatgpt:riskiest');
    expect(set).toHaveBeenCalledWith({ badgeTarget: 'chatgpt:riskiest' });
  });

  it('does not rewrite an already canonical target', async () => {
    const set = stubStorage('chatgpt:riskiest');
    expect((await loadSettings()).badgeTarget).toBe('chatgpt:riskiest');
    expect(set).not.toHaveBeenCalled();
  });
});
