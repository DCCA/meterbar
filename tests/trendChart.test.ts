import { describe, expect, it } from 'vitest';
import { drawableSeries, readingsAt, trendChartSvg, trendLegendHtml, type TrendSeries } from '../src/shared/trendChart';

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-09-20T12:00:00.000Z');
const from = now - 24 * HOUR;
const series: TrendSeries[] = [
  { provider: 'claude', label: 'Claude', points: [[from + HOUR, 40], [from + 12 * HOUR, 60], [now, 72]] },
  { provider: 'chatgpt', label: 'ChatGPT', points: [[from - HOUR, 10], [now, 91]] },
  { provider: 'codex', label: 'Codex', points: [[now, 44]] }
];

describe('trendChartSvg', () => {
  it('draws one fixed-hue line per series with enough points, direct-labeled at the end', () => {
    const svg = trendChartSvg(series, { width: 348, height: 104, from, to: now });
    expect(svg).toContain('data-provider="claude"');
    expect(svg).toContain('style="stroke:var(--series-claude)"');
    expect(svg).not.toContain('data-provider="chatgpt"'); // only one point inside the domain
    expect(svg).not.toContain('data-provider="codex"');
    expect(svg).toContain('<text class="trend-label"');
    expect(svg).toContain('>72</text>');
    expect(svg).toContain('trend-guide-70');
    expect(svg).toContain('trend-guide-90');
  });

  it('returns nothing when no series is drawable, so the caller can show an honest empty state', () => {
    expect(trendChartSvg([series[2]], { width: 348, height: 104, from, to: now })).toBe('');
    expect(trendLegendHtml([series[2]], from, now)).toBe('');
  });

  it('maps the newest point to the right edge and 100% to the top pad', () => {
    const svg = trendChartSvg([series[0]], { width: 348, height: 104, from, to: now });
    expect(svg).toContain('cx="324"'); // width - right pad
    expect(svg).toMatch(/M[0-9.]+ [0-9.]+ L/);
  });
});

describe('drawableSeries / readingsAt', () => {
  it('drops series with fewer than two in-domain points', () => {
    expect(drawableSeries(series, from, now).map((s) => s.provider)).toEqual(['claude']);
  });

  it('returns the latest reading at or before the hovered time', () => {
    expect(readingsAt(series, from + 13 * HOUR, from, now)).toEqual([{ provider: 'claude', label: 'Claude', percent: 60 }]);
    expect(readingsAt(series, from, from, now)).toEqual([]);
  });
});
