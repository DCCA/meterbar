import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function runScript(script: string): string {
  return execFileSync(process.execPath, [script, '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

describe('Workbench palette tooling', () => {
  it('keeps the generated CSS and QML adapters synchronized with the palette source', () => {
    expect(runScript('scripts/generate-workbench-palette.mjs')).toContain('Workbench palette is up to date');
  });

  it('keeps bundled toolbar icons synchronized with the palette source', () => {
    expect(runScript('scripts/generate-icons.mjs')).toContain('Workbench icons are up to date');
  });

  it('preserves established kebab-case CSS token names for numbered colors', () => {
    const css = readFileSync('src/ui/workbenchPalette.css', 'utf8');
    expect(css).toContain('--surface-2:');
    expect(css).toContain('--surface-3:');
    expect(css).toContain('--enamel-2:');
    expect(css).not.toMatch(/--(?:surface|enamel)\d/);
  });

  it('generates QML palette strings that convert safely at color consumers', () => {
    const qml = readFileSync('companion/omarchy/local.meterbar/WorkbenchPalette.qml', 'utf8');
    expect(qml).toContain('import QtQml');
    expect(qml).toContain('readonly property string bg:');
    expect(qml).not.toContain('property color');
  });

  it('uses the accessible muted token for provider header microcopy', () => {
    const css = readFileSync('src/popup/popup.css', 'utf8');
    expect(css).toContain('.provider-title small { color: var(--muted);');
  });

  it('keeps Workbench consumers free of duplicated color literals', () => {
    const paths = [
      'src/ui/tokens.css',
      'src/popup/popup.css',
      'src/options/options.css',
      'src/background/badge.ts',
      'src/background/icon.ts',
      'companion/omarchy/local.meterbar/Panel.qml'
    ];

    for (const path of paths) {
      const source = readFileSync(path, 'utf8');
      expect(source.match(/#[0-9a-f]{3,8}\b/gi), path).toEqual(null);
    }

    expect(readFileSync('src/ui/tokens.css', 'utf8')).toContain("@import './workbenchPalette.css';");
    expect(readFileSync('src/background/icon.ts', 'utf8')).toContain("workbenchPalette.json");
    expect(readFileSync('companion/omarchy/local.meterbar/Panel.qml', 'utf8')).toContain('WorkbenchPalette { id: palette }');
  });
});
