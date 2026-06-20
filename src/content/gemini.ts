import type { ExtensionMessage } from '../shared/messages';

// Self-contained (only type-only imports, erased at build) so the bundle loads as an MV3
// classic content script. Gemini exposes usage only behind a fragile batchexecute RPC, so
// instead of parsing a number we report an honest "connected" status when signed in.
const MESSAGE = "Connected — Gemini shows your usage on its 'Limites de uso' page";

// Signed-in app sessions embed the WIZ anti-XSRF token key ("SNlM0e") in the page HTML.
// Its presence is a boolean sign-in signal — we never read or store its value.
function isSignedIn(): boolean {
  return document.documentElement.innerHTML.includes('"SNlM0e"');
}

function report(): void {
  // Signed in → connected with the copy; signed out → reset the card to the default look.
  const msg: ExtensionMessage = isSignedIn()
    ? { type: 'status:report', provider: 'gemini', status: 'connected', message: MESSAGE }
    : { type: 'status:report', provider: 'gemini', status: 'unsupported' };
  try { chrome.runtime.sendMessage(msg); } catch { /* stay silent; never surface page errors */ }
}

report();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') report(); });
