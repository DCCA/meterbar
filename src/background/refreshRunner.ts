/**
 * Serialize refresh work and collapse any number of requests received while one is
 * active into one follow-up run. This prevents an older provider response from
 * overwriting a newer manual refresh while still honoring a request that arrived
 * during the active run.
 */
export function createCoalescedRefresh(work: () => Promise<void>): () => Promise<void> {
  let active: Promise<void> | null = null;
  let followUpRequested = false;

  return function refresh(): Promise<void> {
    if (active) {
      followUpRequested = true;
      return active;
    }

    active = (async () => {
      do {
        followUpRequested = false;
        await work();
      } while (followUpRequested);
    })().finally(() => {
      active = null;
    });

    return active;
  };
}
