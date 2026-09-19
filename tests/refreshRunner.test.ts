import { describe, expect, it, vi } from 'vitest';
import { createCoalescedRefresh } from '../src/background/refreshRunner';

describe('createCoalescedRefresh', () => {
  it('never overlaps provider refreshes and coalesces concurrent requests into one follow-up', async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const work = vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
    });
    const refresh = createCoalescedRefresh(work);

    const first = refresh();
    const second = refresh();
    const third = refresh();
    expect(work).toHaveBeenCalledTimes(1);

    releases.shift()?.();
    await vi.waitFor(() => expect(work).toHaveBeenCalledTimes(2));
    releases.shift()?.();
    await Promise.all([first, second, third]);

    expect(work).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it('starts a new run normally after the prior run settles', async () => {
    const work = vi.fn(async () => undefined);
    const refresh = createCoalescedRefresh(work);

    await refresh();
    await refresh();

    expect(work).toHaveBeenCalledTimes(2);
  });
});
