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
  constraintMeta,
  emptyHint,
  escapeHtml,
  humanWindowLabel,
  isCompactRow,
  mostConstrainedWindow,
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
  { provider: 'chatgpt', label: 'ChatGPT' },
  { provider: 'codex', label: 'Codex' },
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
      <div class="bar" role="meter" aria-label="${escapeHtml(cardLabel)} - ${rowLabel}"${paceTitle}
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
    const reset = resetLabel(snapshot.resetsAt);
    const inline = [reset, note].filter(Boolean).join(' · ');
    return `
    <div class="row compact level-ok">
      <div class="row-main">
        <div class="row-label">
          <span class="window">${label}</span>
          <span class="win-meta">${escapeHtml(inline)}</span>
        </div>
        ${barHtml(snapshot, cardLabel, label)}
        <strong class="pct">${pct}<span class="unit">%</span></strong>
      </div>
    </div>
  `;
  }

  const level = snapshot.stale ? 'stale' : riskLevel(pct);
  const series = await readSeries(snapshot.provider, snapshot.window);
  const now = Date.now();
  const path = sparklinePath(series, 320, 32, { from: now - DAY_MS, to: now });
  const spark = path
    ? `<svg class="spark" viewBox="0 0 320 32" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" /></svg>`
    : '';
  const staleNote = snapshot.stale ? `Stale - last read ${timeAgo(snapshot.capturedAt)}` : undefined;
  const meta = [resetLabel(snapshot.resetsAt), staleNote, note ? escapeHtml(note) : undefined, spark ? '24-hour trace' : undefined]
    .filter(Boolean)
    .join(' · ');

  return `
    <div class="row expanded level-${level}">
      <div class="row-main">
        <div class="row-label">
          <span class="window">${label}</span>
          <span class="win-meta">${meta}</span>
        </div>
        ${barHtml(snapshot, cardLabel, label)}
        <strong class="pct">${pct}<span class="unit">%</span></strong>
      </div>
      ${spark ? `<div class="spark-wrap level-${level}">${spark}</div>` : ''}
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
    ? `<a class="cta" href="${home}" target="_blank" rel="noopener">Open ${escapeHtml(label.split(' / ')[0])}</a>`
    : '';
  const hint = showHint ? `<p class="hint">${escapeHtml(emptyHint(card))}</p>` : '';
  return `
    <article class="card card-empty" data-status="${escapeHtml(status)}">
      <div class="card-head">
        <span class="dot dot-idle" aria-hidden="true"></span>
        <span class="provider-title"><h2>${escapeHtml(label)}</h2><small>Channel idle</small></span>
        <span class="status-pill">${escapeHtml(STATUS_TEXT[status])}</span>
      </div>
      <div class="empty-channel">
        ${hint}
        ${cta}
      </div>
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
  const rows = (await Promise.all(renderable.map((snapshot) => rowHtml(snapshot, label)))).join('');
  const headRight = allStale
    ? `<span class="status-pill pill-stale">${STATUS_TEXT.stale}</span>`
    : `<span class="updated">Updated ${escapeHtml(timeAgo(card.lastUpdatedAt))}</span>`;
  const notice = allStale
    ? `<p class="notice">${escapeHtml(card.message ?? 'Last reading is out of date - MeterBar retries every 10 minutes.')}</p>`
    : '';
  const windowCount = `${renderable.length} ${renderable.length === 1 ? 'window' : 'windows'}`;
  return `
    <article class="card card-live level-${level}${allStale ? ' card-stale' : ''}">
      <div class="card-head">
        <span class="dot dot-${allStale ? 'idle' : level}" aria-hidden="true"></span>
        <span class="provider-title"><h2>${escapeHtml(label)}</h2><small>${windowCount}</small></span>
        ${headRight}
      </div>
      ${notice}
      <div class="channel-rows">${rows}</div>
    </article>
  `;
}

function constraintRailHtml(cards: ProviderCardState[]): string {
  const summary = mostConstrainedWindow(cards);
  if (!summary) {
    return `
      <aside class="constraint-rail constraint-idle" aria-label="No live usage windows">
        <span class="instrument-label">Tightest limit</span>
        <strong class="constraint-value">--<span>%</span></strong>
        <span class="constraint-provider">No live limit</span>
        <p class="constraint-copy">No live usage window reported.</p>
        <div class="constraint-scale" aria-hidden="true"><span></span></div>
      </aside>
    `;
  }

  const { snapshot, providerLabel } = summary;
  const pct = Math.max(0, Math.min(100, snapshot.usedPercent));
  const meta = constraintMeta(providerLabel, snapshot);
  const detail = [resetLabel(snapshot.resetsAt), confidenceNote(snapshot)].filter(Boolean).join(' · ');
  const level = riskLevel(pct);
  return `
    <aside class="constraint-rail level-${level}" style="--marker-position:${100 - pct}%"
      aria-label="Most constrained window: ${escapeHtml(meta)}, ${pct}% used">
      <span class="instrument-label">Tightest limit</span>
      <strong class="constraint-value">${pct}<span>%</span></strong>
      <span class="constraint-provider">${escapeHtml(providerLabel)} · ${escapeHtml(humanWindowLabel(snapshot.window))}</span>
      <p class="constraint-copy">${escapeHtml(detail)}</p>
      <div class="constraint-scale" aria-hidden="true"><span></span></div>
    </aside>
  `;
}

function heroEmptyHtml(): string {
  return `
    <section class="hero-empty">
      <div class="empty-meter" aria-hidden="true"><i></i><i></i><i></i></div>
      <div>
        <h2>No live channels yet</h2>
        <p>Sign in to Claude, ChatGPT, or Gemini. MeterBar reads usage locally and never stores chat content.</p>
      </div>
    </section>
  `;
}

/** Point the header instrument needle at the riskiest fresh percent. */
function updateGaugeMark(cards: ProviderCardState[]): void {
  const needle = document.querySelector<HTMLElement>('.gauge-mark .needle');
  if (!needle) return;
  const fresh = cards.flatMap((card) => card.snapshots).filter((snapshot) => !snapshot.stale && snapshot.confidence !== 'unavailable');
  const peak = fresh.reduce((max, snapshot) => Math.max(max, snapshot.usedPercent), 0);
  needle.style.transform = `translate(-50%, -100%) rotate(${needleAngle(peak)}deg)`;
}

/** Render the provider channels into a container shared by popup and side panel. */
export async function renderCardsInto(container: HTMLElement): Promise<void> {
  const cards = await getCards();
  const byId = new Map(cards.map((card) => [card.provider, card]));
  const anyLive = cards.some((card) => card.snapshots.length > 0 || card.status === 'connected');

  const cardsHtml = (
    await Promise.all(KNOWN.map(({ provider, label }) => cardHtml(provider, label, byId.get(provider), anyLive)))
  ).join('');
  const bank = `<div class="instrument-bank">${cardsHtml}</div>`;
  container.innerHTML = anyLive
    ? `<section class="channel-console">${constraintRailHtml(cards)}${bank}</section>`
    : `${heroEmptyHtml()}${bank}`;
  updateGaugeMark(cards);
}

/** Ask the worker to refresh fetch-strategy providers now. */
export function requestRefresh(): Promise<unknown> {
  return chrome.runtime.sendMessage({ type: 'usage:refresh' } as ExtensionMessage);
}

/** Wire a Refresh button with busy feedback - shared so the side panel behaves like the popup. */
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
