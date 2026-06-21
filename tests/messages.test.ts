import { describe, expect, it } from 'vitest';
import { isStatusReport, isUsageReport, type ExtensionMessage } from '../src/shared/messages';

describe('messages', () => {
  it('recognizes a usage report from a content script', () => {
    const msg: ExtensionMessage = { type: 'usage:report', provider: 'gemini', raw: { x: 1 }, capturedAt: 't' };
    expect(isUsageReport(msg)).toBe(true);
  });
  it('rejects unrelated objects', () => {
    expect(isUsageReport({ type: 'state:get' } as ExtensionMessage)).toBe(false);
    expect(isUsageReport(null)).toBe(false);
  });

  it('recognizes a status report from a content script', () => {
    const msg: ExtensionMessage = { type: 'status:report', provider: 'gemini', status: 'connected', message: 'Connected' };
    expect(isStatusReport(msg)).toBe(true);
  });
  it('rejects non-status messages and malformed input for isStatusReport', () => {
    expect(isStatusReport({ type: 'usage:report', provider: 'gemini' })).toBe(false);
    expect(isStatusReport({ type: 'status:report' })).toBe(false); // missing provider
    expect(isStatusReport(null)).toBe(false);
  });
});
