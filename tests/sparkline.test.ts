import { describe, expect, it } from 'vitest';
import { sparklinePath } from '../src/shared/sparkline';

describe('sparklinePath', () => {
  it('returns empty for <2 points', () => {
    expect(sparklinePath([[0, 50]], 100, 20)).toBe('');
  });
  it('maps first/last points to the box corners on the x-axis', () => {
    const d = sparklinePath([[0, 0], [10, 100]], 100, 20);
    expect(d.startsWith('M0,')).toBe(true);
    expect(d).toContain('L100,'); // last x at full width
  });
});
