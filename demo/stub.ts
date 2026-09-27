// Runs before the product bundle in the demo copies of popup.html and sidepanel.html.
// Freezes the clock and answers the chrome.* calls those pages make at load, from the
// demo fixture. Query params: state (glance|alert), view (home|limits), theme (dark|light).
import { demoCards, demoHistory, NOW, type DemoState } from './fixture';
import { DEFAULT_SETTINGS } from '../src/storage/usageStore';

const params = new URLSearchParams(location.search);
const state: DemoState = params.get('state') === 'alert' ? 'alert' : 'glance';
const view = params.get('view') === 'limits' ? 'limits' : 'home';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';

// Frozen clock: countdowns, "Updated 1m ago" and the chart range are identical every frame.
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(NOW);
    else super(...(args as [number]));
  }
  static now(): number {
    return NOW;
  }
}
globalThis.Date = FrozenDate as DateConstructor;

document.documentElement.dataset.theme = theme;

// Sibling iframes share one origin, so the saved view comes from the URL, not storage.
const realGetItem = Storage.prototype.getItem;
Storage.prototype.getItem = function (key: string) {
  return key === 'meterbar:view' ? view : realGetItem.call(this, key);
};
Storage.prototype.setItem = () => {};

const store: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...demoHistory(state) };
const cards = demoCards(state);

async function get(keys: unknown): Promise<Record<string, unknown>> {
  if (keys == null) return { ...store };
  if (typeof keys === 'string') return keys in store ? { [keys]: store[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]));
  return Object.fromEntries(Object.entries(keys as Record<string, unknown>).map(([k, d]) => [k, k in store ? store[k] : d]));
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    sendMessage: async (msg: { type?: string }) => (msg?.type === 'state:get' ? { type: 'state:result', cards } : undefined)
  },
  storage: { local: { get, set: async () => {} }, onChanged: { addListener() {} } },
  windows: { getCurrent: async () => ({ id: 1 }) },
  sidePanel: { open: async () => {} }
};

// Tell the composition when the product has painted with the bundled font.
function whenRendered(): void {
  const cardsEl = document.querySelector('#cards');
  if (!cardsEl || cardsEl.childElementCount === 0) {
    requestAnimationFrame(whenRendered);
    return;
  }
  void document.fonts.ready.then(() => parent.postMessage({ type: 'demo:ready' }, '*'));
}
addEventListener('DOMContentLoaded', whenRendered);
