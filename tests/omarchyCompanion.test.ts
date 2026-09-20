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

  it('normalizes partial or legacy snapshots to four fixed provider slots', () => {
    const main = readFileSync(`${pluginDir}/Main.qml`, 'utf8');
    expect(main).toContain('var slots = [');
    expect(main).toContain('{ provider: "codex", label: "Codex" }');
    expect(main).toContain('message: "No usage reported"');
  });

  it('surfaces truthful uncertainty for inferred provider readings', () => {
    const panel = readFileSync(`${pluginDir}/Panel.qml`, 'utf8');
    expect(panel).toContain('Unofficial source');
    expect(panel).toContain('function confidenceText');
    expect(panel).toContain('function peakTooltip');
    expect(panel).toContain('tooltipText: root.peakTooltip()');
  });

  it('reads only the sanitized local state file and contains no network collector', () => {
    const main = readFileSync(`${pluginDir}/Main.qml`, 'utf8');
    expect(main).toContain('/meterbar/state.json');
    expect(main).toContain('FileView');
    expect(main).not.toMatch(/\b(curl|wget|fetch)\b/);
    expect(main).not.toContain('cookie');
  });
});
