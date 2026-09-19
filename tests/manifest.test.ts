import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

describe('manifest security', () => {
  it('keeps host access limited to origins used at runtime', () => {
    expect(manifest.host_permissions).toEqual([
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*'
    ]);
  });

  it('requests native messaging only for the local Omarchy companion bridge', () => {
    expect(manifest.permissions).toContain('nativeMessaging');
    expect((manifest as { key?: string }).key).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('does not request broad browsing or credential permissions', () => {
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['tabs', 'cookies', 'webRequest']));
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });
});
