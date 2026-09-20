import { describe, expect, it, vi } from 'vitest';
import { createMutationGate } from '../src/background/mutationGate';

describe('createMutationGate', () => {
  it('pauses new work and waits for every active mutation', async () => {
    let release: (() => void) | undefined;
    const gate = createMutationGate();
    const active = gate.run(() => new Promise<void>((resolve) => { release = resolve; }));
    expect(active).not.toBeNull();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));

    const idle = gate.pauseAndWait();
    const rejected = vi.fn(async () => undefined);
    expect(gate.run(rejected)).toBeNull();
    expect(rejected).not.toHaveBeenCalled();

    release?.();
    await Promise.all([active, idle]);
    gate.resume();
    await expect(gate.run(rejected)).resolves.toBeUndefined();
    expect(rejected).toHaveBeenCalledOnce();
  });

  it('waits for rejected mutations without breaking the barrier', async () => {
    const gate = createMutationGate();
    const failed = gate.run(async () => { throw new Error('storage failed'); });
    await expect(failed).rejects.toThrow('storage failed');
    await expect(gate.pauseAndWait()).resolves.toBeUndefined();
  });
});
