// Generates the CSS and QML adapters for the shared Workbench palette.
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
const entries = [...Object.entries(palette.colors), ...Object.entries(palette.icon).map(([key, value]) => [`icon${capitalize(key)}`, value])];

for (const [name, value] of entries) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new Error(`Invalid Workbench color ${name}: ${String(value)}`);
  }
}

const generated = {
  css: `${[
    '/* Generated from workbenchPalette.json by scripts/generate-workbench-palette.mjs. */',
    ':root {',
    ...entries.map(([name, value]) => `  --${kebabCase(name)}: ${value};`),
    '}',
    ''
  ].join('\n')}`,
  qml: `${[
    'import QtQml',
    '',
    '// Generated from src/ui/workbenchPalette.json by scripts/generate-workbench-palette.mjs.',
    'QtObject {',
    ...entries.map(([name, value]) => `  readonly property string ${name}: "${value}"`),
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
  return value
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .replace(/([a-z])(\d+)/g, '$1-$2');
}

function readExisting(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
