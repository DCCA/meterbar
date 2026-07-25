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

  describe('with a fixed time domain', () => {
    it('maps x by wall-clock position in the domain, not by series extent', () => {
      // domain 0..100; points at t=50 and t=100 land at half and full width
      const d = sparklinePath([[50, 0], [100, 100]], 200, 20, { from: 0, to: 100 });
      expect(d.startsWith('M100,')).toBe(true);
      expect(d).toContain('L200,');
    });
    it('drops points outside the domain', () => {
      const d = sparklinePath([[-10, 50], [0, 0], [100, 100], [110, 50]], 200, 20, { from: 0, to: 100 });
      expect(d).toBe('M0,20 L200,0');
    });
    it('returns empty when fewer than 2 points fall inside the domain', () => {
      expect(sparklinePath([[-10, 50], [50, 50]], 200, 20, { from: 0, to: 100 })).toBe('');
    });
  });
});
