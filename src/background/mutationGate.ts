export interface MutationGate {
  run(work: () => Promise<void>): Promise<void> | null;
  pauseAndWait(): Promise<void>;
  resume(): void;
}

/** Track asynchronous mutations so destructive operations can pause writers and drain them. */
export function createMutationGate(): MutationGate {
  const inFlight = new Set<Promise<void>>();
  let paused = false;

  return {
    run(work) {
      if (paused) return null;
      const operation = Promise.resolve().then(work);
      inFlight.add(operation);
      const remove = () => { inFlight.delete(operation); };
      void operation.then(remove, remove);
      return operation;
    },

    async pauseAndWait() {
      paused = true;
      await Promise.allSettled([...inFlight]);
    },

    resume() {
      paused = false;
    }
  };
}
