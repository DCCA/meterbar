// Shared DOM rendering for the popup and the side panel. Pure helpers live in
// ../popup/render (unit-tested in the node env); this module is the chrome.*/DOM
// layer that turns stored card state into markup.
import { readSeries } from '../storage/historyStore';
import { sparklinePath } from '../shared/sparkline';
import type { ExtensionMessage } from '../shared/messages';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import {
  cardAllStale,
  confidenceNote,
  emptyHint,
  escapeHtml,
  humanWindowLabel,
  isCompactRow,
  needleAngle,
  paceFraction,
  providerHome,
  renderableSnapshots,
  resetLabel,
  riskClass,
  riskiestPercent,
  riskLevel,
  safeProviderStatus,
  STATUS_TEXT,
  timeAgo
} from '../popup/render';

const DAY_MS = 24 * 60 * 60 * 1000;

export const KNOWN: Array<{ provider: ProviderId; label: string }> = [
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

/** The bar is a meter (consumption of a fixed limit), announced with its direction. */
function barHtml(snapshot: UsageSnapshot, cardLabel: string, rowLabel: string): string {
  const pct = snapshot.usedPercent;
  const pace = paceFraction(snapshot.window, snapshot.resetsAt);
  const tick =
    pace === undefined
      ? ''
      : `<span class="tick" style="left:${(pace * 100).toFixed(1)}%" aria-hidden="true"></span>`;
  const paceTitle =
    pace === undefined ? '' : ` title="Even pacing would be at ${Math.round(pace * 100)}% by now"`;
  return `
      <div class="bar" role="meter" aria-label="${escapeHtml(cardLabel)} — ${rowLabel}"${paceTitle}
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"
        aria-valuetext="${pct}% of the ${rowLabel} used">
        <div class="fill ${snapshot.stale ? 'stale' : riskClass(pct)}" style="width:${Math.min(100, pct)}%"></div>
        ${tick}
      </div>`;
}

async function rowHtml(snapshot: UsageSnapshot, cardLabel: string): Promise<string> {
  const pct = snapshot.usedPercent;
  const label = escapeHtml(snapshot.workspaceLabel ?? humanWindowLabel(snapshot.window));
  const note = confidenceNote(snapshot);

  if (isCompactRow(snapshot)) {
    // Healthy and fresh: one label line + slim bar. Reset time and confidence stay inline.
    const reset = resetLabel(snapshot.resetsAt);
    const inline = [reset.charAt(0).toLowerCase() + reset.slice(1), note].filter(Boolean).join(' · ');
    return `
    <div class="row compact level-ok">
      <div class="row-head">
        <span class="window">${label}<span class="win-meta"> · ${escapeHtml(inline)}</span></span>
        <strong class="pct">${pct}<span class="unit">% used</span></strong>
      </div>
      ${barHtml(snapshot, cardLabel, label)}
    </div>
  `;
  }

  const level = snapshot.stale ? 'stale' : riskLevel(pct);
  const series = await readSeries(snapshot.provider, snapshot.window);
  // Fixed 24h domain: identical shapes mean identical periods across every row.
  const now = Date.now();
  const path = sparklinePath(series, 320, 28, { from: now - DAY_MS, to: now });
  const spark = path
    ? `<svg class="spark" viewBox="0 0 320 28" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" /></svg>`
    : '';
  const staleNote = snapshot.stale ? `stale — last read ${timeAgo(snapshot.capturedAt)}` : undefined;
  const meta = [resetLabel(snapshot.resetsAt), staleNote, note ? escapeHtml(note) : undefined, spark ? 'last 24h' : undefined]
    .filter(Boolean)
    .join(' · ');

  return `
    <div class="row level-${level}">
      <div class="row-head">
        <span class="window">${label}</span>
        <strong class="pct">${pct}<span class="unit">% used</span></strong>
      </div>
      ${barHtml(snapshot, cardLabel, label)}
      ${spark ? `<div class="spark-wrap level-${level}">${spark}</div>` : ''}
      <div class="meta">${meta}</div>
    </div>
  `;
}

function emptyCardHtml(
  provider: ProviderId,
  label: string,
  card: ProviderCardState | undefined,
  showHint: boolean
): string {
  const status = safeProviderStatus(card?.status);
  const home = providerHome(provider);
  const cta = home
    ? `<a class="cta" href="${home}" target="_blank" rel="noopener">Open ${escapeHtml(label.split(' / ')[0])} &rarr;</a>`
    : '';
  const hint = showHint ? `<p class="hint">${escapeHtml(emptyHint(card))}</p>` : '';
  return `
    <article class="card card-empty" data-status="${escapeHtml(status)}">
      <div class="card-head">
        <span class="dot dot-idle" aria-hidden="true"></span>
        <h2>${escapeHtml(label)}</h2>
        <span class="status-pill">${escapeHtml(STATUS_TEXT[status])}</span>
      </div>
      ${hint}
      ${cta}
    </article>
  `;
}

async function cardHtml(
  provider: ProviderId,
  label: string,
  card: ProviderCardState | undefined,
  showHint: boolean
): Promise<string> {
  const renderable = card ? renderableSnapshots(card.snapshots) : [];
  if (!card || renderable.length === 0) return emptyCardHtml(provider, label, card, showHint);

  const allStale = cardAllStale({ ...card, snapshots: renderable });
  const peak = riskiestPercent({ ...card, snapshots: renderable });
  const level = allStale ? 'stale' : riskLevel(peak);
  const rows = (await Promise.all(renderable.map((s) => rowHtml(s, label)))).join('');
  const headRight = allStale
    ? `<span class="status-pill pill-stale">${STATUS_TEXT.stale}</span>`
    : `<span class="updated">${escapeHtml(timeAgo(card.lastUpdatedAt))}</span>`;
  const notice = allStale
    ? `<p class="notice">${escapeHtml(card.message ?? 'Last reading is out of date — MeterBar retries every 10 minutes.')}</p>`
    : '';
  return `
    <article class="card card-live level-${level}${allStale ? ' card-stale' : ''}">
      <div class="card-head">
        <span class="dot dot-${allStale ? 'idle' : level}" aria-hidden="true"></span>
        <h2>${escapeHtml(label)}</h2>
        ${headRight}
      </div>
      ${notice}
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
      <p class="hero-tip">Tip: pin the toolbar icon — it grows one risk-colored bar per provider, in a fixed left-to-right order.</p>
    </div>
  `;
}

/** Point the header's mini gauge needle at the riskiest fresh percent. */
function updateGaugeMark(cards: ProviderCardState[]): void {
  const needle = document.querySelector<HTMLElement>('.gauge-mark .needle');
  if (!needle) return;
  const fresh = cards.flatMap((c) => c.snapshots).filter((s) => !s.stale && s.confidence !== 'unavailable');
  const peak = fresh.reduce((max, s) => Math.max(max, s.usedPercent), 0);
  needle.style.transform = `translate(-50%, -100%) rotate(${needleAngle(peak)}deg)`;
}

/** Render the provider cards into a container (shared by the popup and the side panel). */
export async function renderCardsInto(container: HTMLElement): Promise<void> {
  const cards = await getCards();
  const byId = new Map(cards.map((c) => [c.provider, c]));
  const anyLive = cards.some((c) => c.snapshots.length > 0 || c.status === 'connected');

  // Fixed provider order — position means provider, matching the toolbar icon.
  // When the hero gives the sign-in instruction, the cards don't repeat it.
  const cardsHtml = (
    await Promise.all(KNOWN.map(({ provider, label }) => cardHtml(provider, label, byId.get(provider), anyLive)))
  ).join('');
  container.innerHTML = (anyLive ? '' : heroEmptyHtml()) + cardsHtml;
  updateGaugeMark(cards);
}

/** Ask the worker to refresh fetch-strategy providers now. */
export function requestRefresh(): Promise<unknown> {
  return chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
}

/** Wire a Refresh button with busy feedback — shared so the side panel behaves like the popup. */
export function wireRefresh(button: HTMLButtonElement, rerender: () => Promise<void>): void {
  button.addEventListener('click', () => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-busy');
    void requestRefresh()
      .then(rerender)
      .finally(() => {
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
        button.classList.remove('is-busy');
      });
  });
}
