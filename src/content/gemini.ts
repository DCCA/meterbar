import type { ExtensionMessage } from '../shared/messages';

// Gemini exposes usage only behind a fragile batchexecute RPC. Instead of parsing a
// number, report an honest connected status when the signed-in bootstrap marker exists.
const MESSAGE = "Connected - Gemini doesn't expose usage numbers, so MeterBar shows status only.";
const AUTH_MARKER = '"SNlM0e"';

/** Inspect only script payloads, never the rendered page or conversation DOM. */
export function hasGeminiAuthMarker(scripts: ArrayLike<{ textContent: string | null }>): boolean {
  for (let index = 0; index < scripts.length; index += 1) {
    if (scripts[index]?.textContent?.includes(AUTH_MARKER)) return true;
  }
  return false;
}

function isSignedIn(): boolean {
  return hasGeminiAuthMarker(document.scripts);
}

function report(): void {
  const msg: ExtensionMessage = isSignedIn()
    ? { type: 'status:report', provider: 'gemini', status: 'connected', message: MESSAGE }
    : { type: 'status:report', provider: 'gemini', status: 'unsupported' };
  try { chrome.runtime.sendMessage(msg); } catch { /* stay silent; never surface page errors */ }
}

// The guard keeps the pure marker helper importable in node-based unit tests.
if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
  report();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') report();
  });
}
