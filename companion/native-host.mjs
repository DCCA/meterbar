#!/usr/bin/env node
import { mkdir, open, rename } from 'node:fs/promises';
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

function validateCard(value) {
  if (!value || typeof value !== 'object' || !PROVIDERS.has(value.provider)) throw new Error('invalid provider');
  if (!STATUSES.has(value.status) || !Array.isArray(value.snapshots) || value.snapshots.length > 32) throw new Error('invalid card');
  const lastUpdatedAt = optionalIso(value.lastUpdatedAt);
  const message = optionalText(value.message, 240);
  return {
    provider: value.provider,
    label: text(value.label, 80),
    status: value.status,
    ...(lastUpdatedAt !== undefined ? { lastUpdatedAt } : {}),
    ...(message !== undefined ? { message } : {}),
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
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const framed = Buffer.concat(chunks);
  if (framed.length < 4) throw new Error('missing frame');
  const length = framed.readUInt32LE(0);
  if (length < 2 || length > MAX_MESSAGE_BYTES || framed.length !== length + 4) throw new Error('invalid frame');
  return JSON.parse(framed.subarray(4).toString('utf8'));
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
  const snapshot = validateMessage(await readMessage());
  await writeSnapshot(snapshot);
  respond({ ok: true }, 0);
} catch {
  respond({ ok: false, error: 'Invalid MeterBar snapshot.' }, 1);
}
