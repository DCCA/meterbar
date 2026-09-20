#!/usr/bin/env node
import { mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const MAX_MESSAGE_BYTES = 1024 * 1024;
const PROVIDERS = new Set(['claude', 'chatgpt', 'codex', 'gemini']);
const STATUSES = new Set(['connected', 'not_connected', 'stale', 'unsupported']);
const WINDOWS = new Set(['five_hour', 'seven_day', 'daily', 'monthly', 'api_billing', 'custom']);
const CONFIDENCE = new Set(['exact', 'estimated', 'inferred', 'unavailable']);

function statePath() {
  if (process.env.METERBAR_STATE_PATH) return process.env.METERBAR_STATE_PATH;
  const stateHome = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  return join(stateHome, 'meterbar', 'state.json');
}

function text(value, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error('invalid text');
  return value;
}

function optionalText(value, maxLength) {
  return value === undefined ? undefined : text(value, maxLength);
}

function iso(value) {
  const result = text(value, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error('invalid timestamp');
  return result;
}

function optionalIso(value) {
  return value === undefined ? undefined : iso(value);
}

function validateRow(value, provider) {
  if (!value || typeof value !== 'object') throw new Error('invalid row');
  if (!WINDOWS.has(value.window) || !CONFIDENCE.has(value.confidence)) throw new Error('invalid row enum');
  if (!Number.isFinite(value.usedPercent) || value.usedPercent < 0 || value.usedPercent > 100) throw new Error('invalid percent');
  if (typeof value.stale !== 'boolean') throw new Error('invalid stale flag');
  const workspaceLabel = optionalText(value.workspaceLabel, 80);
  const resetsAt = optionalIso(value.resetsAt);
  return {
    provider,
    ...(workspaceLabel !== undefined ? { workspaceLabel } : {}),
    window: value.window,
    usedPercent: Math.round(value.usedPercent),
    ...(resetsAt !== undefined ? { resetsAt } : {}),
    capturedAt: iso(value.capturedAt),
    confidence: value.confidence,
    stale: value.stale
  };
}

function validateHistory(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 64) throw new Error('invalid history');
  return value.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) throw new Error('invalid history point');
    const [t, p] = point;
    if (!Number.isFinite(t) || t < 0 || !Number.isFinite(p) || p < 0 || p > 100) throw new Error('invalid history point');
    return [Math.round(t), Math.round(p)];
  });
}

function validateCard(value) {
  if (!value || typeof value !== 'object' || !PROVIDERS.has(value.provider)) throw new Error('invalid provider');
  if (!Array.isArray(value.snapshots) || value.snapshots.length > 32) throw new Error('invalid card');
  const history = validateHistory(value.history);
  const status = STATUSES.has(value.status) ? value.status : undefined;
  if (status === undefined && (value.status !== undefined || value.snapshots.length > 0)) throw new Error('invalid card');
  const lastUpdatedAt = optionalIso(value.lastUpdatedAt);
  const message = optionalText(value.message, 240);
  return {
    provider: value.provider,
    label: text(value.label, 80),
    ...(status !== undefined ? { status } : {}),
    ...(lastUpdatedAt !== undefined ? { lastUpdatedAt } : {}),
    ...(message !== undefined ? { message } : {}),
    ...(history !== undefined ? { history } : {}),
    snapshots: value.snapshots.map((row) => validateRow(row, value.provider))
  };
}

function validateMessage(value) {
  if (!value || typeof value !== 'object' || value.type !== 'meterbar:snapshot' || value.schemaVersion !== 1) {
    throw new Error('invalid envelope');
  }
  if (!Array.isArray(value.cards) || value.cards.length > 8) throw new Error('invalid cards');
  return {
    schemaVersion: 1,
    generatedAt: iso(value.generatedAt),
    cards: value.cards.map(validateCard)
  };
}

async function readMessage() {
  return new Promise((resolve, reject) => {
    let framed = Buffer.alloc(0);
    let length;

    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      framed = Buffer.concat([framed, chunk]);
      if (length === undefined && framed.length >= 4) {
        length = framed.readUInt32LE(0);
        if (length < 2 || length > MAX_MESSAGE_BYTES) {
          fail(new Error('invalid frame'));
          return;
        }
      }
      if (length !== undefined && framed.length >= length + 4) {
        cleanup();
        try {
          resolve(JSON.parse(framed.subarray(4, length + 4).toString('utf8')));
        } catch (error) {
          reject(error);
        }
      }
    };
    const onEnd = () => fail(new Error(framed.length < 4 ? 'missing frame' : 'incomplete frame'));
    const onError = (error) => fail(error);

    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.once('error', onError);
  });
}

function isClearMessage(value) {
  return Boolean(value && typeof value === 'object' && value.type === 'meterbar:clear' && value.schemaVersion === 1);
}

async function writeSnapshot(snapshot) {
  const target = statePath();
  const directory = dirname(target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.tmp`;
  const handle = await open(temporary, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, target);
}

function respond(value, exitCode) {
  const body = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]), () => process.exit(exitCode));
}

try {
  const message = await readMessage();
  if (isClearMessage(message)) {
    await rm(statePath(), { force: true });
  } else {
    await writeSnapshot(validateMessage(message));
  }
  respond({ ok: true }, 0);
} catch {
  respond({ ok: false, error: 'Invalid MeterBar snapshot.' }, 1);
}
