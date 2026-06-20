import { describe, expect, it } from 'vitest';
import { isUsageReport, type ExtensionMessage } from '../src/shared/messages';

describe('messages', () => {
  it('recognizes a usage report from a content script', () => {
    const msg: ExtensionMessage = { type: 'usage:report', provider: 'gemini', raw: { x: 1 }, capturedAt: 't' };
    expect(isUsageReport(msg)).toBe(true);
  });
  it('rejects unrelated objects', () => {
    expect(isUsageReport({ type: 'state:get' } as ExtensionMessage)).toBe(false);
    expect(isUsageReport(null)).toBe(false);
  });
});
