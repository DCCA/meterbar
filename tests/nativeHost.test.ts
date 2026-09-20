import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import extensionManifest from '../manifest.json';
import { toCompanionSnapshot } from '../src/background/nativeBridge';

function frame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function unframe(buffer: Buffer): unknown {
  const length = buffer.readUInt32LE(0);
  return JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
}

function requestWhileInputStaysOpen(value: unknown, statePath: string): Promise<{ status: number | null; stdout: Buffer }> {
  const child = spawn(process.execPath, ['companion/native-host.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, METERBAR_STATE_PATH: statePath },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
  child.stdin.write(frame(value));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`native host did not respond before EOF: ${Buffer.concat(stderr).toString('utf8')}`));
    }, 1_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout: Buffer.concat(stdout) });
    });
  });
}

describe('native messaging host', () => {
  it('allows only the stable MeterBar extension id', () => {
    const publicKey = Buffer.from((extensionManifest as { key: string }).key, 'base64');
    const digest = createHash('sha256').update(publicKey).digest().subarray(0, 16);
    const extensionId = Array.from(digest, (byte) =>
      String.fromCharCode(97 + (byte >> 4), 97 + (byte & 0x0f))
    ).join('');
    const hostManifest = readFileSync('companion/native-host-manifest.json.in', 'utf8');

    expect(extensionId).toBe('gfihfehckcbnmklfojnhnindphonbhhp');
    expect(hostManifest).toContain(`chrome-extension://${extensionId}/`);
    expect(hostManifest).not.toContain('chrome-extension://*/');
  });

  it('responds to one complete frame without waiting for stdin EOF', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meterbar-host-'));
    const statePath = join(dir, 'state.json');
    const result = await requestWhileInputStaysOpen({
      type: 'meterbar:snapshot',
      schemaVersion: 1,
      generatedAt: '2026-09-19T18:00:00.000Z',
      cards: []
    }, statePath);

    expect(result.status).toBe(0);
    expect(unframe(result.stdout)).toEqual({ ok: true });
  });

  it('atomically writes a private, validated companion snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meterbar-host-'));
    const statePath = join(dir, 'state.json');
    const payload = {
      type: 'meterbar:snapshot',
      schemaVersion: 1,
      generatedAt: '2026-09-19T18:00:00.000Z',
      secret: 'drop-me',
      cards: [{
        provider: 'claude',
        label: 'Claude',
        status: 'connected',
        history: [[1789000000000, 40.4], [1789003600000, 62]],
        snapshots: [{
          provider: 'claude',
          window: 'five_hour',
          usedPercent: 62,
          resetsAt: '2026-09-19T20:00:00.000Z',
          capturedAt: '2026-09-19T18:00:00.000Z',
          confidence: 'exact',
          stale: false,
          token: 'drop-me-too'
        }]
      }]
    };

    const result = spawnSync(process.execPath, ['companion/native-host.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, METERBAR_STATE_PATH: statePath },
      input: frame(payload)
    });

    expect(result.status).toBe(0);
    expect(unframe(result.stdout)).toEqual({ ok: true });
    expect(statSync(statePath).mode & 0o777).toBe(0o600);

    const written = readFileSync(statePath, 'utf8');
    expect(JSON.parse(written)).toEqual({
      schemaVersion: 1,
      generatedAt: '2026-09-19T18:00:00.000Z',
      cards: [{
        provider: 'claude',
        label: 'Claude',
        status: 'connected',
        history: [[1789000000000, 40], [1789003600000, 62]],
        snapshots: [{
          provider: 'claude',
          window: 'five_hour',
          usedPercent: 62,
          resetsAt: '2026-09-19T20:00:00.000Z',
          capturedAt: '2026-09-19T18:00:00.000Z',
          confidence: 'exact',
          stale: false
        }]
      }]
    });
    expect(written).not.toContain('secret');
    expect(written).not.toContain('token');
  });

  it('accepts fixed-slot placeholders from a partial extension snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meterbar-host-'));
    const statePath = join(dir, 'state.json');
    const payload = toCompanionSnapshot([{
      provider: 'claude',
      label: 'Claude',
      status: 'connected',
      snapshots: []
    }], '2026-09-19T18:00:00.000Z');

    const result = spawnSync(process.execPath, ['companion/native-host.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, METERBAR_STATE_PATH: statePath },
      input: frame(payload)
    });

    expect(result.status).toBe(0);
    expect(unframe(result.stdout)).toEqual({ ok: true });
    const written = JSON.parse(readFileSync(statePath, 'utf8')) as { cards: Array<{ provider: string; status?: string }> };
    expect(written.cards.map((card) => card.provider)).toEqual(['claude', 'chatgpt', 'codex', 'gemini']);
    expect(written.cards[1].status).toBeUndefined();
  });

  it('removes the companion snapshot when the extension clears local data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meterbar-host-'));
    const statePath = join(dir, 'state.json');
    writeFileSync(statePath, '{}');

    const result = spawnSync(process.execPath, ['companion/native-host.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, METERBAR_STATE_PATH: statePath },
      input: frame({ type: 'meterbar:clear', schemaVersion: 1 })
    });

    expect(result.status).toBe(0);
    expect(unframe(result.stdout)).toEqual({ ok: true });
    expect(existsSync(statePath)).toBe(false);
  });

  it('rejects invalid messages without writing state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meterbar-host-'));
    const statePath = join(dir, 'state.json');
    const result = spawnSync(process.execPath, ['companion/native-host.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, METERBAR_STATE_PATH: statePath },
      input: frame({ type: 'wrong', cards: [] })
    });

    expect(result.status).toBe(1);
    expect(unframe(result.stdout)).toEqual({ ok: false, error: 'Invalid MeterBar snapshot.' });
  });
});
