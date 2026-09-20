import type { Point } from '../storage/historyStore';
import type { ProviderId } from './types';

// Pure SVG markup for the 24-hour trend (no DOM, no chrome.*). One line per provider in
// a fixed hue so identity never depends on the number of series shown.

export interface TrendSeries {
  provider: ProviderId;
  label: string;
  points: Point[];
}

export interface TrendOptions {
  width: number;
  height: number;
  from: number;
  to: number;
}

export const SERIES_COLOR: Partial<Record<ProviderId, string>> = {
  claude: 'var(--series-claude)',
  chatgpt: 'var(--series-openai)'
};

const PAD = { left: 26, right: 24, top: 6, bottom: 12 };
const GUIDES = [70, 90] as const;

function visiblePoints(points: Point[], from: number, to: number): Point[] {
  return points.filter(([t, p]) => t >= from && t <= to && Number.isFinite(p));
}

/** Series that can draw a line (two or more points inside the domain). */
export function drawableSeries(series: TrendSeries[], from: number, to: number): TrendSeries[] {
  return series
    .map((s) => ({ ...s, points: visiblePoints(s.points, from, to) }))
    .filter((s) => s.points.length >= 2);
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** SVG markup for the chart body. Returns '' when nothing is drawable. */
export function trendChartSvg(series: TrendSeries[], opts: TrendOptions): string {
  const drawable = drawableSeries(series, opts.from, opts.to);
  if (drawable.length === 0) return '';
  const left = PAD.left;
  const right = opts.width - PAD.right;
  const top = PAD.top;
  const bottom = opts.height - PAD.bottom;
  const span = opts.to - opts.from || 1;
  const x = (t: number): number => left + ((t - opts.from) / span) * (right - left);
  const y = (p: number): number => bottom - (Math.max(0, Math.min(100, p)) / 100) * (bottom - top);

  const grid = [0, 50, 100]
    .map((p) => `<line class="trend-grid" x1="${left}" x2="${right}" y1="${fmt(y(p))}" y2="${fmt(y(p))}" />` +
      `<text class="trend-axis" x="${left - 6}" y="${fmt(y(p) + 3)}" text-anchor="end">${p}</text>`)
    .join('');
  const guides = GUIDES
    .map((p) => `<line class="trend-guide trend-guide-${p}" x1="${left}" x2="${right}" y1="${fmt(y(p))}" y2="${fmt(y(p))}" />`)
    .join('');
  const lines = drawable
    .map((s) => {
      const color = SERIES_COLOR[s.provider] ?? 'currentColor';
      const d = s.points.map(([t, p], i) => `${i === 0 ? 'M' : 'L'}${fmt(x(t))} ${fmt(y(p))}`).join(' ');
      const [lastT, lastP] = s.points[s.points.length - 1];
      return `<path class="trend-line" data-provider="${s.provider}" d="${d}" style="stroke:${color}" />` +
        `<circle class="trend-end" cx="${fmt(x(lastT))}" cy="${fmt(y(lastP))}" r="3.5" style="fill:${color}" />` +
        `<text class="trend-label" x="${fmt(x(lastT) + 7)}" y="${fmt(y(lastP) + 3)}">${Math.round(lastP)}</text>`;
    })
    .join('');
  const axis =
    `<text class="trend-axis" x="${left}" y="${opts.height - 2}">-24h</text>` +
    `<text class="trend-axis" x="${fmt((left + right) / 2)}" y="${opts.height - 2}" text-anchor="middle">-12h</text>` +
    `<text class="trend-axis" x="${right}" y="${opts.height - 2}" text-anchor="end">now</text>`;
  return `<svg class="trend-chart" viewBox="0 0 ${opts.width} ${opts.height}" role="img" aria-label="24-hour usage trend" data-from="${opts.from}" data-to="${opts.to}" data-left="${left}" data-right="${right}">${grid}${guides}${lines}${axis}</svg>`;
}

/** Legend markup for the drawable series (identity is never color alone). */
export function trendLegendHtml(series: TrendSeries[], from: number, to: number): string {
  const items = drawableSeries(series, from, to)
    .map((s) => `<span class="legend-item"><i style="background:${SERIES_COLOR[s.provider] ?? 'currentColor'}"></i>${s.label}</span>`)
    .join('');
  return items ? `<div class="trend-legend">${items}</div>` : '';
}

export interface TrendReading {
  provider: ProviderId;
  label: string;
  percent: number;
}

/** Latest reading at or before `t` for each drawable series (hover tooltip source). */
export function readingsAt(series: TrendSeries[], t: number, from: number, to: number): TrendReading[] {
  return drawableSeries(series, from, to).flatMap((s) => {
    let percent: number | undefined;
    for (const [pt, p] of s.points) {
      if (pt <= t) percent = p;
      else break;
    }
    return percent === undefined ? [] : [{ provider: s.provider, label: s.label, percent: Math.round(percent) }];
  });
}
