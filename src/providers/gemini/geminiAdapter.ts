import type { ProviderAdapter } from '../providerAdapter';

// Gemini surfaces usage only behind a fragile, undocumented `batchexecute` RPC, so we
// deliberately do not parse a usage number. The content script reports connected status
// instead (see src/content/gemini.ts); this adapter emits no usage snapshots.
export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini',
  label: 'Gemini',
  collection: { strategy: 'content', matches: ['https://gemini.google.com/*'] },
  parse: () => []
};
