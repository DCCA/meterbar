import { readSeries } from '../storage/historyStore';
import { sparklinePath } from '../shared/sparkline';
import type { ExtensionMessage } from '../shared/messages';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import {
  confidenceNote,
  emptyHint,
  escapeHtml,
  humanWindowLabel,
  orderByRisk,
  providerHome,
  resetLabel,
  riskClass,
  riskiestPercent,
  riskLevel,
  STATUS_TEXT,
  timeAgo
} from './render';

const KNOWN: Array<{ provider: ProviderId; label: string }> = [
  { provider: 'claude', label: 'Claude' },
  { provider: 'chatgpt', label: 'ChatGPT / Codex' },
  { provider: 'gemini', label: 'Gemini' }
];

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
  const path = sparklinePath(series, 320, 28);
  const spark = path
    ? `<svg class="spark" viewBox="0 0 320 28" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" /></svg>`
    : '';
  const label = escapeHtml(snapshot.workspaceLabel ?? humanWindowLabel(snapshot.window));
  const pct = snapshot.usedPercent;
  const note = confidenceNote(snapshot);
  const meta = [resetLabel(snapshot.resetsAt), note ? escapeHtml(note) : undefined].filter(Boolean).join(' · ');

  return `
    <div class="row level-${riskLevel(pct)}">
      <div class="row-head">
        <span class="window">${label}</span>
        <strong class="pct">${pct}<span class="unit">%</span></strong>
      </div>
      <div class="bar" role="progressbar" aria-label="${label}" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="fill ${riskClass(pct)}" style="width:${Math.min(100, pct)}%"></div>
      </div>
      <div class="spark-wrap level-${riskLevel(pct)}">${spark}</div>
      <div class="meta">${meta}</div>
    </div>
  `;
}

function emptyCardHtml(provider: ProviderId, label: string, card: ProviderCardState | undefined): string {
  const status = card?.status ?? 'unsupported';
  const home = providerHome(provider);
  const cta = home
    ? `<a class="cta" href="${home}" target="_blank" rel="noopener">Open ${escapeHtml(label.split(' / ')[0])} &rarr;</a>`
    : '';
  return `
    <article class="card card-empty" data-status="${status}">
      <div class="card-head">
        <span class="dot dot-idle" aria-hidden="true"></span>
        <h2>${escapeHtml(label)}</h2>
        <span class="status-pill">${escapeHtml(STATUS_TEXT[status])}</span>
      </div>
      <p class="hint">${escapeHtml(emptyHint(card))}</p>
      ${cta}
    </article>
  `;
}

async function cardHtml(provider: ProviderId, label: string, card: ProviderCardState | undefined): Promise<string> {
  if (!card || card.snapshots.length === 0) return emptyCardHtml(provider, label, card);

  const peak = riskiestPercent(card);
  const level = riskLevel(peak);
  const rows = (await Promise.all(card.snapshots.map(rowHtml))).join('');
  return `
    <article class="card card-live level-${level}">
      <div class="card-head">
        <span class="dot dot-${level}" aria-hidden="true"></span>
        <h2>${escapeHtml(label)}</h2>
        <span class="updated">${escapeHtml(timeAgo(card.lastUpdatedAt))}</span>
      </div>
      ${rows}
    </article>
  `;
}

function heroEmptyHtml(): string {
  return `
    <div class="hero-empty">
      <div class="gauge" aria-hidden="true"><span></span></div>
      <h2>No providers connected yet</h2>
      <p>Sign in to Claude, ChatGPT, or Gemini in your browser and MeterBar reads your usage automatically — locally, never leaving your device.</p>
    </div>
  `;
}

async function render(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#cards');
  if (!container) return;
  const cards = await getCards();
  const byId = new Map(cards.map((c) => [c.provider, c]));
  const anyLive = cards.some((c) => c.snapshots.length > 0 || c.status === 'connected');
  const ordered = orderByRisk(KNOWN, byId);

  const cardsHtml = (
    await Promise.all(ordered.map(({ provider, label, card }) => cardHtml(provider, label, card)))
  ).join('');
  container.innerHTML = (anyLive ? '' : heroEmptyHtml()) + cardsHtml;
}

function setRefreshing(on: boolean): void {
  const btn = document.querySelector<HTMLButtonElement>('#refresh');
  if (!btn) return;
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
  btn.classList.toggle('is-busy', on);
}

document.querySelector('#refresh')?.addEventListener('click', () => {
  setRefreshing(true);
  void chrome.runtime
    .sendMessage({ type: 'usage:refresh' } as ExtensionMessage)
    .then(render)
    .finally(() => setRefreshing(false));
});

void render();
