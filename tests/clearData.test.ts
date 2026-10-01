import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearMeterbarData } from '../src/background/clearData';

const STATIC_ICON = {
  16: 'assets/icon16.png',
  48: 'assets/icon48.png',
  128: 'assets/icon128.png'
};

// The companion permission is optional; these tests run with it granted.
const GRANTED = { contains: vi.fn(async () => true) };

describe('clearMeterbarData', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('clears browser and companion data and resets every toolbar surface', async () => {
    const clear = vi.fn().mockResolvedValue(undefined);
    const sendNativeMessage = vi.fn().mockResolvedValue({ ok: true });
    const setBadgeText = vi.fn().mockResolvedValue(undefined);
    const setBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
    const setBadgeTextColor = vi.fn().mockResolvedValue(undefined);
    const setIcon = vi.fn().mockResolvedValue(undefined);
    const setTitle = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: { local: { clear, get: vi.fn(async () => ({})), set: vi.fn() } },
      alarms: { clearAll: vi.fn().mockResolvedValue(true) },
      runtime: { sendNativeMessage }, permissions: GRANTED,
      action: { setBadgeText, setBadgeBackgroundColor, setBadgeTextColor, setIcon, setTitle }
    });

    await expect(clearMeterbarData()).resolves.toEqual({ companionCleared: true });
    expect(clear).toHaveBeenCalledOnce();
    expect(sendNativeMessage).toHaveBeenCalledWith('com.meterbar.bridge', {
      type: 'meterbar:clear',
      schemaVersion: 1
    });
    expect(setBadgeText).toHaveBeenCalledWith({ text: '?' });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#a3adbb' });
    expect(setBadgeTextColor).toHaveBeenCalledWith({ color: '#1b1f24' });
    expect(setIcon).toHaveBeenCalledWith({ path: STATIC_ICON });
    expect(setTitle).toHaveBeenCalledWith({ title: 'MeterBar · no usage data yet' });
  });

  it('stops every timer and keeps only unexpired rate-limit waits', async () => {
    const future = new Date(Date.now() + 60 * 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    const set = vi.fn();
    const clearAll = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', {
      storage: { local: {
        clear: vi.fn(),
        set,
        get: vi.fn(async () => ({
          'refreshState:chatgpt': { backoffUntil: future, lastAttemptAt: past },
          'refreshState:claude': { backoffUntil: past, lastAttemptAt: past },
          acknowledged: { chatgpt: past }
        }))
      } },
      alarms: { clearAll },
      runtime: {}, permissions: { contains: vi.fn(async () => false) },
      action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setBadgeTextColor: vi.fn(), setIcon: vi.fn(), setTitle: vi.fn() }
    });

    await clearMeterbarData();

    // A provider's Retry-After is not user data: clearing must not let MeterBar ask again early.
    expect(set).toHaveBeenCalledWith({ 'refreshState:chatgpt': { backoffUntil: future } });
    expect(set).toHaveBeenCalledTimes(1);
    expect(clearAll).toHaveBeenCalledOnce();
  });
});
