import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Omarchy companion installer', () => {
  it('installs the native host and user-owned plugin without privileged paths', () => {
    const home = mkdtempSync(join(tmpdir(), 'meterbar-install-'));
    const result = spawnSync('bash', ['scripts/install-omarchy-companion.sh'], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, METERBAR_SKIP_ENABLE: '1' },
      encoding: 'utf8'
    });

    expect(result.status, result.stderr).toBe(0);
    const hostPath = join(home, '.local/lib/meterbar/native-host.mjs');
    const pluginManifest = join(home, '.config/omarchy/plugins/local.meterbar/manifest.json');
    const browserManifest = join(home, '.config/chromium/NativeMessagingHosts/com.meterbar.bridge.json');

    expect(statSync(hostPath).mode & 0o777).toBe(0o700);
    expect(JSON.parse(readFileSync(pluginManifest, 'utf8')).id).toBe('local.meterbar');
    expect(JSON.parse(readFileSync(browserManifest, 'utf8'))).toEqual({
      name: 'com.meterbar.bridge',
      description: 'Writes sanitized MeterBar usage snapshots for the local Omarchy companion.',
      path: hostPath,
      type: 'stdio',
      allowed_origins: ['chrome-extension://gfihfehckcbnmklfojnhnindphonbhhp/']
    });
  });
});
