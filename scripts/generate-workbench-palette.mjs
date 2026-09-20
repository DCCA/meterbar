// Generates the CSS and QML adapters for the shared glass palette.
// Run with --check to verify generated files without modifying them.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'src/ui/workbenchPalette.json');
const TARGETS = {
  css: resolve(ROOT, 'src/ui/workbenchPalette.css'),
  qml: resolve(ROOT, 'companion/omarchy/local.meterbar/WorkbenchPalette.qml')
};
const CHECK = process.argv.includes('--check');
const HEX_COLOR = /^#[0-9a-f]{6}$/;

const palette = JSON.parse(readFileSync(SOURCE, 'utf8'));
const iconEntries = Object.entries(palette.icon).map(([key, value]) => [`icon${capitalize(key)}`, value]);
const themes = { dark: Object.entries(palette.dark), light: Object.entries(palette.light) };

for (const [name, value] of [...themes.dark, ...themes.light, ...iconEntries]) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`Invalid palette color ${name}: ${String(value)}`);
  }
}
const darkKeys = themes.dark.map(([name]) => name).join(',');
const lightKeys = themes.light.map(([name]) => name).join(',');
if (darkKeys !== lightKeys) throw new Error('dark and light palettes must define the same tokens');

const cssVars = (entries, indent = '  ') => entries.map(([name, value]) => `${indent}--${kebabCase(name)}: ${value};`);
const qmlObject = (entries) => `({\n${entries.map(([name, value]) => `    ${name}: "${value}"`).join(',\n')}\n  })`;

const generated = {
  css: `${[
    '/* Generated from workbenchPalette.json by scripts/generate-workbench-palette.mjs. */',
    ':root {',
    ...cssVars([...themes.dark, ...iconEntries]),
    '}',
    ':root[data-theme="light"] {',
    ...cssVars(themes.light),
    '}',
    '@media (prefers-color-scheme: light) {',
    '  :root:not([data-theme="dark"]) {',
    ...cssVars(themes.light, '    '),
    '  }',
    '}',
    ''
  ].join('\n')}`,
  qml: `${[
    'import QtQml',
    '',
    '// Generated from src/ui/workbenchPalette.json by scripts/generate-workbench-palette.mjs.',
    'QtObject {',
    `  readonly property var dark: ${qmlObject(themes.dark)}`,
    `  readonly property var light: ${qmlObject(themes.light)}`,
    '}',
    ''
  ].join('\n')}`
};

if (CHECK) {
  const stale = Object.entries(TARGETS).filter(([kind, path]) => readExisting(path) !== generated[kind]);
  if (stale.length > 0) {
    const names = stale.map(([, path]) => path.slice(ROOT.length + 1)).join(', ');
    console.error(`Generated Workbench palette files are stale: ${names}`);
    process.exitCode = 1;
  } else {
    console.log('Workbench palette is up to date');
  }
} else {
  for (const [kind, path] of Object.entries(TARGETS)) {
    writeFileSync(path, generated[kind]);
    console.log(`wrote ${path.slice(ROOT.length + 1)}`);
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function readExisting(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
