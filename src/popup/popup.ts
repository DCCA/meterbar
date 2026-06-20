import { formatCountdown } from '../shared/time';
import { readSeries } from '../storage/historyStore';
import { sparklinePath } from '../shared/sparkline';
import type { ExtensionMessage } from '../shared/messages';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';

const KNOWN: Array<{ provider: ProviderId; label: string }> = [
  { provider: 'claude', label: 'Claude' },
  { provider: 'chatgpt', label: 'ChatGPT / Codex' },
  { provider: 'gemini', label: 'Gemini' }
];

const STATUS_TEXT: Record<ProviderCardState['status'], string> = {
  connected: 'connected',
  not_connected: 'not connected — open the provider and sign in',
  stale: 'data is stale',
  unsupported: 'not connected yet'
};

function classForSnapshot(snapshot: UsageSnapshot): string {
  if (snapshot.usedPercent >= 90) return 'crit';
  if (snapshot.usedPercent >= 70) return 'warn';
  return '';
}

function labelForWindow(window: UsageSnapshot['window']): string {
  return window.replace('_', ' ');
}

function timeAgo(iso?: string): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

async function getCards(): Promise<ProviderCardState[]> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'state:get' } as ExtensionMessage)) as
      | { cards: ProviderCardState[] }
      | undefined;
    return res?.cards ?? [];
  } catch {
    return [];
  }
}

async function rowHtml(snapshot: UsageSnapshot): Promise<string> {
  const series = await readSeries(snapshot.provider, snapshot.window);
  const path = sparklinePath(series, 320, 24);
  const spark = path
    ? `<svg class="spark" viewBox="0 0 320 24" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#64748b" stroke-width="1.5" /></svg>`
    : '';
  const reset = snapshot.resetsAt ? `resets in ${formatCountdown(snapshot.resetsAt)}` : 'reset unknown';
  return `
    <div class="row">
      <span>${snapshot.workspaceLabel ?? labelForWindow(snapshot.window)}</span>
      <div class="bar"><div class="fill ${classForSnapshot(snapshot)}" style="width:${snapshot.usedPercent}%"></div></div>
      <strong>${snapshot.usedPercent}%</strong>
    </div>
    ${spark}
    <div class="meta">${reset} · ${snapshot.confidence}</div>
  `;
}

async function cardHtml(card: ProviderCardState | undefined, label: string): Promise<string> {
  if (!card || card.snapshots.length === 0) {
    const status = card ? STATUS_TEXT[card.status] : 'not connected yet';
    return `<article class="card"><h2>${label}</h2><p class="meta">${card?.message ?? status}</p></article>`;
  }
  const rows = (await Promise.all(card.snapshots.map(rowHtml))).join('');
  return `
    <article class="card">
      <h2>${label}</h2>
      ${rows}
      <div class="meta">last updated ${timeAgo(card.lastUpdatedAt)} · ${STATUS_TEXT[card.status]}</div>
    </article>
  `;
}

async function render(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (!container) return;
  const cards = await getCards();
  const byId = new Map(cards.map((c) => [c.provider, c]));
  container.innerHTML = (
    await Promise.all(KNOWN.map(({ provider, label }) => cardHtml(byId.get(provider), label)))
  ).join('');
}

document.querySelector('#refresh')?.addEventListener('click', () => {
  void chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage).then(render);
});
void render();
