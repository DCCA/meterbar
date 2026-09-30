export interface CoalescedRefresh<T> {
  (request: T): Promise<void>;
  whenIdle(): Promise<void>;
}

/**
 * Serialize refresh work and collapse any number of requests received while one is
 * active into one follow-up run, merging their payloads. This prevents an older
 * provider response from overwriting a newer manual refresh while still honoring
 * every request that arrived during the active run.
 */
export function createCoalescedRefresh<T = void>(
  work: (request: T) => Promise<void>,
  merge: (pending: T, next: T) => T = (_pending, next) => next
): CoalescedRefresh<T> {
  let active: Promise<void> | null = null;
  let pending: { request: T } | null = null;

  const refresh = function refresh(request: T): Promise<void> {
    if (active) {
      pending = { request: pending ? merge(pending.request, request) : request };
      return active;
    }

    active = (async () => {
      let next: { request: T } | null = { request };
      while (next) {
        pending = null;
        await work(next.request);
        next = pending;
      }
    })().finally(() => {
      active = null;
    });

    return active;
  } as CoalescedRefresh<T>;

  refresh.whenIdle = () => active ?? Promise.resolve();
  return refresh;
}
