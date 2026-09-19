import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pluginDir = 'companion/omarchy/local.meterbar';

describe('Omarchy companion plugin', () => {
  it('declares one installable local bar widget and panel', () => {
    const manifest = JSON.parse(readFileSync(`${pluginDir}/manifest.json`, 'utf8')) as {
      id: string;
      kinds: string[];
      entryPoints: { barWidget: string };
      barWidget: { allowMultiple: boolean };
    };

    expect(manifest.id).toBe('local.meterbar');
    expect(manifest.kinds).toEqual(['bar-widget']);
    expect(manifest.entryPoints.barWidget).toBe('Panel.qml');
    expect(manifest.barWidget.allowMultiple).toBe(false);
    expect(existsSync(`${pluginDir}/Main.qml`)).toBe(true);
    expect(existsSync(`${pluginDir}/Panel.qml`)).toBe(true);
  });

  it('reads only the sanitized local state file and contains no network collector', () => {
    const main = readFileSync(`${pluginDir}/Main.qml`, 'utf8');
    expect(main).toContain('/meterbar/state.json');
    expect(main).toContain('FileView');
    expect(main).not.toMatch(/\b(curl|wget|fetch)\b/);
    expect(main).not.toContain('cookie');
  });
});
