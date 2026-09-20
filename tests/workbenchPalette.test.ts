import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function runScript(script: string): string {
  return execFileSync(process.execPath, [script, '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
}

describe('Glass palette tooling', () => {
  it('keeps the generated CSS and QML adapters synchronized with the palette source', () => {
    expect(runScript('scripts/generate-workbench-palette.mjs')).toContain('Workbench palette is up to date');
  });

  it('keeps bundled toolbar icons synchronized with the palette source', () => {
    expect(runScript('scripts/generate-icons.mjs')).toContain('Workbench icons are up to date');
  });

  it('emits a dark default plus a light theme that follows the system and an explicit override', () => {
    const css = readFileSync('src/ui/workbenchPalette.css', 'utf8');
    expect(css).toMatch(/^:root \{\n  --bg-deep: #0e111a;/m);
    expect(css).toContain(':root[data-theme="light"] {');
    expect(css).toContain('@media (prefers-color-scheme: light) {\n  :root:not([data-theme="dark"]) {');
    expect(css).toContain('--series-claude:');
    expect(css).toContain('--icon-casing:');
  });

  it('generates QML palette objects with string colors that convert safely at consumers', () => {
    const qml = readFileSync('companion/omarchy/local.meterbar/WorkbenchPalette.qml', 'utf8');
    expect(qml).toContain('import QtQml');
    expect(qml).toContain('readonly property var dark: ({');
    expect(qml).toContain('readonly property var light: ({');
    expect(qml).toMatch(/surface: "#[0-9a-f]{6}"/);
    expect(qml).not.toContain('property color');
  });

  it('defines the same tokens for both themes', () => {
    const palette = JSON.parse(readFileSync('src/ui/workbenchPalette.json', 'utf8')) as { dark: object; light: object };
    expect(Object.keys(palette.light)).toEqual(Object.keys(palette.dark));
  });

  it('keeps consumers free of duplicated color literals', () => {
    const paths = [
      'src/ui/tokens.css',
      'src/popup/popup.css',
      'src/sidepanel/sidepanel.css',
      'src/options/options.css',
      'src/background/badge.ts',
      'src/background/icon.ts',
      'src/shared/trendChart.ts',
      'companion/omarchy/local.meterbar/Panel.qml'
    ];

    for (const path of paths) {
      const source = readFileSync(path, 'utf8');
      expect(source.match(/#[0-9a-f]{3,8}\b/gi), path).toEqual(null);
    }

    expect(readFileSync('src/ui/tokens.css', 'utf8')).toContain("@import './workbenchPalette.css';");
    expect(readFileSync('src/background/icon.ts', 'utf8')).toContain('workbenchPalette.json');
    expect(readFileSync('companion/omarchy/local.meterbar/Panel.qml', 'utf8')).toContain('WorkbenchPalette { id: palette }');
  });
});
