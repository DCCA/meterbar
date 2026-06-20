import type { Point } from '../storage/historyStore';

export function sparklinePath(points: Point[], width: number, height: number): string {
  if (points.length < 2) return '';
  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), spanX = maxX - minX || 1;
  return points
    .map(([t, p], i) => {
      const x = ((t - minX) / spanX) * width;
      const y = height - (Math.max(0, Math.min(100, p)) / 100) * height;
      return `${i === 0 ? 'M' : 'L'}${Math.round(x)},${Math.round(y)}`;
    })
    .join(' ');
}
