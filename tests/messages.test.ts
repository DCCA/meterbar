import { describe, expect, it } from 'vitest';
import {
  isDataClear,
  isStateGet,
  isStatusReport,
  isTrustedContentReportSender,
  isTrustedExtensionPageSender,
  isUsageRefresh,
  isUsageReport,
  type ExtensionMessage
} from '../src/shared/messages';

const EXTENSION_ID = 'meterbar-test-id';

describe('messages', () => {
  it('recognizes a complete usage report from a known provider', () => {
    const msg: ExtensionMessage = { type: 'usage:report', provider: 'gemini', raw: { x: 1 }, capturedAt: 't' };
    expect(isUsageReport(msg)).toBe(true);
  });

  it('rejects malformed usage reports and unknown providers', () => {
    expect(isUsageReport({ type: 'state:get' } as ExtensionMessage)).toBe(false);
    expect(isUsageReport({ type: 'usage:report', provider: 'evil', raw: {}, capturedAt: 't' })).toBe(false);
    expect(isUsageReport({ type: 'usage:report', provider: 'gemini', raw: {} })).toBe(false);
    expect(isUsageReport(null)).toBe(false);
  });

  it('recognizes a bounded status report from a known provider', () => {
    const msg: ExtensionMessage = { type: 'status:report', provider: 'gemini', status: 'connected', message: 'Connected' };
    expect(isStatusReport(msg)).toBe(true);
  });

  it('rejects invalid status, provider, and unbounded message values', () => {
    expect(isStatusReport({ type: 'usage:report', provider: 'gemini' })).toBe(false);
    expect(isStatusReport({ type: 'status:report' })).toBe(false);
    expect(isStatusReport({ type: 'status:report', provider: 'evil', status: 'connected' })).toBe(false);
    expect(isStatusReport({ type: 'status:report', provider: 'gemini', status: 'admin' })).toBe(false);
    expect(isStatusReport({ type: 'status:report', provider: 'gemini', status: 'connected', message: 'x'.repeat(501) })).toBe(false);
    expect(isStatusReport(null)).toBe(false);
  });

  it('recognizes only exact internal request messages', () => {
    expect(isUsageRefresh({ type: 'usage:refresh' })).toBe(true);
    expect(isUsageRefresh({ type: 'usage:refresh', extra: true })).toBe(false);
    expect(isStateGet({ type: 'state:get' })).toBe(true);
    expect(isStateGet(null)).toBe(false);
    expect(isDataClear({ type: 'data:clear' })).toBe(true);
    expect(isDataClear({ type: 'data:clear', extra: true })).toBe(false);
  });
});

describe('message sender authorization', () => {
  it('allows Gemini reports only from this extension content script on the exact origin', () => {
    expect(isTrustedContentReportSender('gemini', {
      id: EXTENSION_ID,
      url: 'https://gemini.google.com/app'
    }, EXTENSION_ID)).toBe(true);

    expect(isTrustedContentReportSender('gemini', {
      id: EXTENSION_ID,
      url: 'https://gemini.google.com.evil.example/app'
    }, EXTENSION_ID)).toBe(false);
    expect(isTrustedContentReportSender('gemini', {
      id: 'another-extension',
      url: 'https://gemini.google.com/app'
    }, EXTENSION_ID)).toBe(false);
    expect(isTrustedContentReportSender('chatgpt', {
      id: EXTENSION_ID,
      url: 'https://chatgpt.com/'
    }, EXTENSION_ID)).toBe(false);
  });

  it('allows privileged requests only from this extension page', () => {
    expect(isTrustedExtensionPageSender({
      id: EXTENSION_ID,
      url: `chrome-extension://${EXTENSION_ID}/src/popup/popup.html`
    }, EXTENSION_ID)).toBe(true);
    expect(isTrustedExtensionPageSender({
      id: EXTENSION_ID,
      url: 'https://gemini.google.com/app'
    }, EXTENSION_ID)).toBe(false);
  });
});
