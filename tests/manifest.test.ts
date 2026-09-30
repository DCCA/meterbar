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

  it('asks for native messaging only when the user turns on the Omarchy companion', () => {
    expect(manifest.permissions).not.toContain('nativeMessaging');
    expect((manifest as { optional_permissions?: string[] }).optional_permissions).toEqual(['nativeMessaging']);
    expect((manifest as { key?: string }).key).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('does not request broad browsing or credential permissions', () => {
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(['tabs', 'cookies', 'webRequest']));
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  it('declares the Chrome version its APIs need (sidePanel: 114, setBadgeTextColor: 110)', () => {
    expect((manifest as { minimum_chrome_version?: string }).minimum_chrome_version).toBe('114');
  });
});
