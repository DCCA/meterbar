import type { ProviderId } from '../shared/types';
import type { ExtensionMessage } from '../shared/messages';

// Self-contained collector. Inlined (rather than imported) so the built bundle
// has no ES-module imports and loads as an MV3 classic content script.
function startCollector(config: { provider: ProviderId; intervalMs?: number; collect: () => Promise<unknown | null> }): void {
  const tick = async () => {
    try {
      const raw = await config.collect();
      if (raw == null) return;
      const msg: ExtensionMessage = { type: 'usage:report', provider: config.provider, raw, capturedAt: new Date().toISOString() };
      chrome.runtime.sendMessage(msg);
    } catch { /* stay silent; never surface page errors */ }
  };
  void tick();
  setInterval(() => void tick(), config.intervalMs ?? 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void tick(); });
}

// `collect` returns the raw shape parseChatgptUsage expects, or null when usage
// is not surfaced. Fill in from validated live inspection (plan Task 8, Step 1).
startCollector({
  provider: 'chatgpt',
  collect: async () => null
});
