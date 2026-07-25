import type { Point } from '../storage/historyStore';

export interface SparkDomain {
  from: number;
  to: number;
}

/**
 * Polyline path for a usage series. With a domain, x maps wall-clock time onto the box
 * (identical shapes mean identical periods across rows); points outside are dropped.
 * Without one, x normalizes to the series' own extent (legacy behavior).
 */
export function sparklinePath(points: Point[], width: number, height: number, domain?: SparkDomain): string {
  const visible = domain ? points.filter(([t]) => t >= domain.from && t <= domain.to) : points;
  if (visible.length < 2) return '';
  const xs = visible.map((p) => p[0]);
  const minX = domain ? domain.from : Math.min(...xs);
  const maxX = domain ? domain.to : Math.max(...xs);
  const spanX = maxX - minX || 1;
  return visible
    .map(([t, p], i) => {
      const x = ((t - minX) / spanX) * width;
      const y = height - (Math.max(0, Math.min(100, p)) / 100) * height;
      return `${i === 0 ? 'M' : 'L'}${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');
}
