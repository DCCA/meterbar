// Shared DOM rendering for the popup and the side panel. Pure helpers live in
// ../popup/render and ../shared/trendChart (unit-tested in the node env); this module is
// the chrome.*/DOM layer that turns stored card state into the glass dashboard markup.
import { readSeries } from '../storage/historyStore';
import { formatCountdown } from '../shared/time';
import { readingsAt, trendChartSvg, trendLegendHtml, type TrendSeries } from '../shared/trendChart';
import type { ExtensionMessage } from '../shared/messages';
import type { ProviderCardState, ProviderId, UsageSnapshot } from '../shared/types';
import {
  cardAllStale,
  confidenceNote,
  emptyHint,
  escapeHtml,
  shortWindowLabel,
  mostConstrainedWindow,
  paceFraction,
  providerHome,
  renderableSnapshots,
  resetLabel,
  riskLevel,
  safeProviderStatus,
  STATUS_TEXT,
  timeAgo
} from '../popup/render';

const DAY_MS = 24 * 60 * 60 * 1000;
const VIEW_KEY = 'meterbar:view';

export type DashboardView = 'home' | 'limits';

export const KNOWN: Array<{ provider: ProviderId; label: string }> = [
  { provider: 'claude', label: 'Claude' },
  { provider: 'chatgpt', label: 'ChatGPT' },
  { provider: 'codex', label: 'Codex' },
  { provider: 'gemini', label: 'Gemini' }
];

// Authored provider marks (one stroke weight, drawn, never emoji). Trademarks identify
// the services MeterBar reads; they imply no affiliation.
const MARK: Record<string, string> = {
  claude: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2"/></svg>',
  chatgpt: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 2v3.2M8 10.8V14M2.8 5l2.8 1.6M10.4 9.4l2.8 1.6M2.8 11l2.8-1.6M10.4 6.6l2.8-1.6"/></svg>',
  codex: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3"/><path d="M6 6l-2 2 2 2M10 6l2 2-2 2"/></svg>',
  gemini: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5C8 5.5 10.5 8 14.5 8 10.5 8 8 10.5 8 14.5 8 10.5 5.5 8 1.5 8 5.5 8 8 5.5 8 1.5z"/></svg>'
};

/** The last view the user chose, shared by the popup and side panel (same extension origin). */
export function loadView(): DashboardView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'limits' ? 'limits' : 'home';
  } catch {
    return 'home';
  }
}

export function saveView(view: DashboardView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Private windows may refuse storage; the view simply resets next time.
  }
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

function pctClass(snapshot: UsageSnapshot): string {
  return snapshot.stale ? 'stale' : riskLevel(snapshot.usedPercent);
}

/** One short word for non-exact readings; the full phrase lives in tooltips and alerts. */
function shortConfidence(snapshot: UsageSnapshot): string | undefined {
  const note = confidenceNote(snapshot);
  return note === undefined ? undefined : snapshot.confidence === 'estimated' ? 'estimated' : 'inferred';
}

/** Reset countdown, staleness, and uncertainty in one short line that fits a 376px column. */
function windowNote(snapshot: UsageSnapshot, now: Date): string {
  const parts = [resetLabel(snapshot.resetsAt, now)];
  if (snapshot.stale) parts.push(`stale ${timeAgo(snapshot.capturedAt, now).replace(/ ago$/, '')}`);
  const note = shortConfidence(snapshot);
  if (note) parts.push(note);
  return parts.join(' · ');
}

/** Tightest window on a card, preferring fresh readings; undefined without usage. */
function tightestWindow(card: ProviderCardState | undefined): UsageSnapshot | undefined {
  if (!card) return undefined;
  const rows = renderableSnapshots(card.snapshots);
  const fresh = rows.filter((s) => !s.stale);
  const pool = fresh.length > 0 ? fresh : rows;
  return pool.reduce<UsageSnapshot | undefined>((best, s) => (!best || s.usedPercent > best.usedPercent ? s : best), undefined);
}

// --- Hero -------------------------------------------------------------------------

function heroHtml(cards: ProviderCardState[], now: Date): string {
  const summary = mostConstrainedWindow(cards);
  if (!summary) {
    const anyKnown = cards.some((c) => c.snapshots.length > 0 || c.status === 'connected');
    return `
    <section class="hero hero-idle" aria-label="No live usage limit">
      <span class="hero-k">Tightest limit</span>
      <strong class="hero-value">--<small>% used</small></strong>
      <p class="hero-s">${anyKnown
        ? 'No live limit yet - waiting for a fresh provider reading.'
        : 'Sign in to Claude, ChatGPT, or Gemini. MeterBar reads usage locally and never stores chat content.'}</p>
    </section>`;
  }
  const { snapshot, providerLabel } = summary;
  const pct = Math.max(0, Math.min(100, snapshot.usedPercent));
  const level = riskLevel(pct);
  const label = snapshot.workspaceLabel ?? shortWindowLabel(snapshot.window);
  const meta = [resetLabel(snapshot.resetsAt, now), shortConfidence(snapshot)].filter(Boolean).join(' · ');
  return `
    <section class="hero level-${level}" aria-label="Tightest limit: ${escapeHtml(providerLabel)} ${escapeHtml(label)}, ${pct}% used">
      <span class="hero-k">Tightest limit</span>
      <strong class="hero-value">${pct}<small>% used</small></strong>
      <p class="hero-s"><b>${escapeHtml(providerLabel)}</b> ${escapeHtml(label)} · ${escapeHtml(meta)}</p>
    </section>`;
}

// --- Home view: trend + compact limits --------------------------------------------

async function trendSeries(cards: ProviderCardState[]): Promise<TrendSeries[]> {
  const byId = new Map(cards.map((c) => [c.provider, c]));
  const series = await Promise.all(KNOWN.map(async ({ provider, label }) => {
    const snapshot = tightestWindow(byId.get(provider));
    if (!snapshot) return undefined;
    return { provider, label, points: await readSeries(provider, snapshot.window) } satisfies TrendSeries;
  }));
  return series.filter((s): s is TrendSeries => s !== undefined);
}

/** Chart box in CSS px: the SVG viewBox matches the container so text never scales. */
function chartSize(container: HTMLElement): { width: number; height: number } {
  const width = Math.max(300, Math.min(660, container.clientWidth || 348));
  return { width, height: width > 420 ? 180 : 104 };
}

function trendHtml(series: TrendSeries[], now: Date, size: { width: number; height: number }): string {
  const from = now.getTime() - DAY_MS;
  const to = now.getTime();
  const svg = trendChartSvg(series, { ...size, from, to });
  const body = svg
    ? `<div class="trend-plot">${svg}<div class="trend-tip" hidden></div></div>${trendLegendHtml(series, from, to)}`
    : '<p class="sec-empty">The trend appears after a few readings - MeterBar records one every 10 minutes.</p>';
  return `
    <section class="sec sec-trend">
      <div class="sec-head"><h2>Trend</h2><span>24 h · % of limit used</span></div>
      ${body}
    </section>`;
}

function compactRowsHtml(cards: ProviderCardState[], now: Date): string {
  const byId = new Map(cards.map((c) => [c.provider, c]));
  const rows = KNOWN.map(({ provider, label }) => {
    const card = byId.get(provider);
    const renderable = card ? renderableSnapshots(card.snapshots) : [];
    const name = `<span class="lim-name">${MARK[provider]}${escapeHtml(label)}</span>`;
    if (renderable.length === 0) {
      const status = safeProviderStatus(card?.status);
      const text = provider === 'gemini' && status === 'connected' ? 'Signed in' : STATUS_TEXT[status];
      const cls = status === 'connected' ? 'ok' : 'idle';
      return `<div class="lim-row lim-status">${name}<span class="lim-win"><span>${provider === 'gemini' ? 'Status only' : 'No usage'}</span><b class="${cls}">${escapeHtml(text)}</b></span></div>`;
    }
    const wins = renderable.map((s) => {
      const label = escapeHtml(s.workspaceLabel ?? shortWindowLabel(s.window));
      return `<span class="lim-win"><span>${label}</span><b class="${pctClass(s)}">${s.usedPercent}% used</b></span>`;
    }).join('');
    return `<div class="lim-row">${name}<div class="lim-wins">${wins}</div><div class="lim-notes">${escapeHtml(compactNote(renderable, now))}</div></div>`;
  }).join('');
  return `<div class="lim">${rows}</div>`;
}

/** One line for a provider's windows: countdowns in window order, then staleness and uncertainty once. */
function compactNote(rows: UsageSnapshot[], now: Date): string {
  const countdowns = rows.map((s) => (s.resetsAt ? formatCountdown(s.resetsAt, now) : 'unknown'));
  const parts = [`Resets ${countdowns.join(' · ')}`];
  const stalest = rows.filter((s) => s.stale).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))[0];
  if (stalest) parts.push(`stale ${timeAgo(stalest.capturedAt, now).replace(/ ago$/, '')}`);
  const note = rows.map(shortConfidence).find(Boolean);
  if (note) parts.push(note);
  return parts.join(' · ');
}

function updatedText(cards: ProviderCardState[], now: Date): string {
  const latest = cards.map((c) => c.lastUpdatedAt).filter((v): v is string => !!v).sort().pop();
  return latest ? `Updated ${timeAgo(latest, now)}` : 'No readings yet';
}

// --- Limits view: full provider sections ------------------------------------------

function meterHtml(snapshot: UsageSnapshot, cardLabel: string, rowLabel: string, now: Date): string {
  const pct = snapshot.usedPercent;
  const pace = paceFraction(snapshot.window, snapshot.resetsAt, now);
  const tick = pace === undefined ? '' : `<span class="tick" style="left:${(pace * 100).toFixed(1)}%" aria-hidden="true"></span>`;
  const paceTitle = pace === undefined ? '' : ` title="Even pacing would be at ${Math.round(pace * 100)}% by now"`;
  return `
      <div class="meter ${pctClass(snapshot)}" role="meter" aria-label="${escapeHtml(cardLabel)} - ${rowLabel}"${paceTitle}
        aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${pct}% of the ${rowLabel} used">
        <b style="width:${Math.min(100, pct)}%"></b>${tick}
      </div>`;
}

function windowHtml(snapshot: UsageSnapshot, cardLabel: string, now: Date): string {
  const label = escapeHtml(snapshot.workspaceLabel ?? shortWindowLabel(snapshot.window));
  return `
    <div class="win ${pctClass(snapshot)}">
      <div class="win-t"><span>${label}</span><b>${snapshot.usedPercent}% used</b></div>
      ${meterHtml(snapshot, cardLabel, label, now)}
      <div class="win-r">${escapeHtml(windowNote(snapshot, now))}</div>
    </div>`;
}

function providerHtml(provider: ProviderId, label: string, card: ProviderCardState | undefined, now: Date): string {
  const renderable = card ? renderableSnapshots(card.snapshots) : [];
  const head = (right: string): string =>
    `<div class="prov-head"><span class="prov-name">${MARK[provider]}<h2>${escapeHtml(label)}</h2></span><span class="prov-right">${right}</span></div>`;

  if (renderable.length === 0) {
    const status = safeProviderStatus(card?.status);
    if (provider === 'gemini' && status === 'connected') {
      return `
    <section class="prov prov-status" data-provider="gemini">
      ${head('Status only')}
      <div class="prov-upd">Updated ${escapeHtml(timeAgo(card?.lastUpdatedAt, now))}</div>
      <div class="win-t"><span>gemini.google.com session</span><b class="ok">Signed in</b></div>
    </section>`;
    }
    const home = providerHome(provider);
    const cta = home ? `<a class="cta" href="${home}" target="_blank" rel="noopener">Open ${escapeHtml(label)}</a>` : '';
    return `
    <section class="prov prov-empty" data-provider="${provider}" data-status="${escapeHtml(status)}">
      ${head(escapeHtml(STATUS_TEXT[status]))}
      <p class="prov-hint">${escapeHtml(emptyHint(card))}</p>
      ${cta}
    </section>`;
  }

  const allStale = cardAllStale({ ...card!, snapshots: renderable });
  const notice = allStale
    ? `<p class="prov-notice">${escapeHtml(card?.message ?? 'Last reading is out of date - MeterBar retries every 10 minutes.')}</p>`
    : '';
  const right = allStale ? STATUS_TEXT.stale : `${renderable.length} ${renderable.length === 1 ? 'window' : 'windows'}`;
  return `
    <section class="prov${allStale ? ' prov-stale' : ''}" data-provider="${provider}">
      ${head(right)}
      <div class="prov-upd">Updated ${escapeHtml(timeAgo(card?.lastUpdatedAt, now))}</div>
      ${notice}
      <div class="wins${renderable.length === 1 ? ' one' : ''}">${renderable.map((s) => windowHtml(s, label, now)).join('')}</div>
    </section>`;
}

// --- Assembly ---------------------------------------------------------------------

/** Tint the header mark with the tightest limit's risk (or idle). */
function updateMark(cards: ProviderCardState[]): void {
  const dot = document.querySelector<HTMLElement>('.mark i');
  if (!dot) return;
  const summary = mostConstrainedWindow(cards);
  dot.dataset.level = summary ? riskLevel(summary.snapshot.usedPercent) : 'idle';
}

function wireTrendHover(container: HTMLElement, series: TrendSeries[], now: Date): void {
  const plot = container.querySelector<HTMLElement>('.trend-plot');
  const svg = plot?.querySelector<SVGSVGElement>('svg.trend-chart');
  const tip = plot?.querySelector<HTMLElement>('.trend-tip');
  if (!plot || !svg || !tip) return;
  const from = now.getTime() - DAY_MS;
  const to = now.getTime();
  const left = Number(svg.dataset.left);
  const right = Number(svg.dataset.right);
  const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  cursor.setAttribute('class', 'trend-cursor');
  cursor.setAttribute('x1', String(left));
  cursor.setAttribute('x2', String(left));
  cursor.setAttribute('y1', '0');
  cursor.setAttribute('y2', '100%');
  svg.append(cursor);

  plot.addEventListener('mousemove', (event) => {
    const box = svg.getBoundingClientRect();
    const vx = ((event.clientX - box.left) / box.width) * svg.viewBox.baseVal.width;
    const x = Math.max(left, Math.min(right, vx));
    const t = from + ((x - left) / (right - left)) * (to - from);
    const readings = readingsAt(series, t, from, to);
    if (readings.length === 0) { tip.hidden = true; cursor.classList.remove('on'); return; }
    cursor.setAttribute('x1', String(x));
    cursor.setAttribute('x2', String(x));
    cursor.classList.add('on');
    const ago = Math.round((to - t) / (60 * 60 * 1000));
    tip.innerHTML = `<span class="trend-tip-t">${ago === 0 ? 'now' : `-${ago}h`}</span>` +
      readings.map((r) => `<span><i data-provider="${r.provider}"></i>${escapeHtml(r.label)} <b>${r.percent}%</b></span>`).join('');
    tip.hidden = false;
    const px = (x / svg.viewBox.baseVal.width) * box.width;
    tip.style.left = `${px}px`;
    tip.classList.toggle('flip', px > box.width * 0.6);
  });
  plot.addEventListener('mouseleave', () => { tip.hidden = true; cursor.classList.remove('on'); });
}

/** Render the dashboard into a container shared by popup and side panel. */
export async function renderCardsInto(container: HTMLElement, view: DashboardView = loadView()): Promise<void> {
  const now = new Date();
  const cards = await getCards();
  const byId = new Map(cards.map((c) => [c.provider, c]));
  let series: TrendSeries[] = [];
  let body: string;

  if (view === 'home') {
    series = await trendSeries(cards);
    body = trendHtml(series, now, chartSize(container)) + `
    <section class="sec sec-limits">
      <div class="sec-head"><h2>Limits</h2><span>${escapeHtml(updatedText(cards, now))}</span></div>
      ${compactRowsHtml(cards, now)}
    </section>`;
  } else {
    body = `<div class="providers">${KNOWN.map(({ provider, label }) => providerHtml(provider, label, byId.get(provider), now)).join('')}</div>`;
  }

  container.innerHTML = heroHtml(cards, now) + body;
  container.dataset.view = view;
  updateMark(cards);
  if (view === 'home') wireTrendHover(container, series, now);
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
        button.removeAttribute('aria-busy');
        button.classList.remove('is-busy');
      });
  });
}

/** Wire the footer view switcher: both halves toggle between Home and Limits. */
export function wireViewSwitcher(root: HTMLElement, rerender: (view: DashboardView) => Promise<void>): void {
  const label = root.querySelector<HTMLElement>('.vs-current');
  const apply = (view: DashboardView): void => {
    if (label) label.textContent = view === 'home' ? 'Home' : 'Limits';
    root.querySelectorAll('button').forEach((b) => b.setAttribute('title', `Switch to ${view === 'home' ? 'Limits' : 'Home'}`));
  };
  apply(loadView());
  root.addEventListener('click', () => {
    const next: DashboardView = loadView() === 'home' ? 'limits' : 'home';
    saveView(next);
    apply(next);
    void rerender(next);
  });
}
