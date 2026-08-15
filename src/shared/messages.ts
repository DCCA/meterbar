import type { ProviderCardState, ProviderId } from './types';

export type ExtensionMessage =
  | { type: 'usage:report'; provider: ProviderId; raw: unknown; capturedAt: string } // content -> bg
  | { type: 'status:report'; provider: ProviderId; status: ProviderCardState['status']; message?: string } // content -> bg
  | { type: 'usage:refresh' }                                                         // extension page -> bg
  | { type: 'state:get' }                                                             // extension page -> bg
  | { type: 'state:result'; cards: ProviderCardState[] };                             // bg -> extension page

interface SenderLike {
  id?: string;
  url?: string;
  tab?: { url?: string };
}

const REPORT_PROVIDERS = new Set<ProviderId>(['claude', 'chatgpt', 'codex', 'gemini']);
const PROVIDER_STATUSES = new Set<ProviderCardState['status']>([
  'connected', 'not_connected', 'stale', 'unsupported'
]);
const CONTENT_ORIGINS: Partial<Record<ProviderId, string>> = {
  gemini: 'https://gemini.google.com'
};
const MAX_STATUS_MESSAGE_LENGTH = 500;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function knownProvider(value: unknown): value is ProviderId {
  return typeof value === 'string' && REPORT_PROVIDERS.has(value as ProviderId);
}

function exactTypeMessage(value: unknown, type: 'usage:refresh' | 'state:get'): boolean {
  const message = record(value);
  return !!message && message.type === type && Object.keys(message).length === 1;
}

export function isUsageReport(value: unknown): value is Extract<ExtensionMessage, { type: 'usage:report' }> {
  const message = record(value);
  return !!message
    && message.type === 'usage:report'
    && knownProvider(message.provider)
    && Object.hasOwn(message, 'raw')
    && typeof message.capturedAt === 'string'
    && message.capturedAt.length > 0
    && message.capturedAt.length <= 64;
}

export function isStatusReport(value: unknown): value is Extract<ExtensionMessage, { type: 'status:report' }> {
  const message = record(value);
  return !!message
    && message.type === 'status:report'
    && knownProvider(message.provider)
    && typeof message.status === 'string'
    && PROVIDER_STATUSES.has(message.status as ProviderCardState['status'])
    && (message.message === undefined
      || (typeof message.message === 'string' && message.message.length <= MAX_STATUS_MESSAGE_LENGTH));
}

export function isUsageRefresh(value: unknown): value is Extract<ExtensionMessage, { type: 'usage:refresh' }> {
  return exactTypeMessage(value, 'usage:refresh');
}

export function isStateGet(value: unknown): value is Extract<ExtensionMessage, { type: 'state:get' }> {
  return exactTypeMessage(value, 'state:get');
}

export function isTrustedContentReportSender(
  provider: ProviderId,
  sender: SenderLike,
  extensionId: string
): boolean {
  if (sender.id !== extensionId) return false;
  const expectedOrigin = CONTENT_ORIGINS[provider];
  const senderUrl = sender.url ?? sender.tab?.url;
  if (!expectedOrigin || !senderUrl) return false;
  try {
    return new URL(senderUrl).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export function isTrustedExtensionPageSender(sender: SenderLike, extensionId: string): boolean {
  if (sender.id !== extensionId || !sender.url) return false;
  try {
    const url = new URL(sender.url);
    return url.protocol === 'chrome-extension:' && url.host === extensionId;
  } catch {
    return false;
  }
}
