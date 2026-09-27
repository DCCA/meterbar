// Builds everything the composition loads into demo/.build/ (gitignored):
//   ext/            a copy of ../dist plus demo copies of popup.html and sidepanel.html
//                   that load the stub, the bundled font, and the motion-off rule
//   ui/             the product's token CSS (the composition's only color source)
//   vendor/         GSAP, served locally so a render never touches the network
//   derived.json    tooltip, alert, icon and badge values from the real src/ functions
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(root, 'dist');
const out = join(here, '.build');

if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/ is missing. Run `npm run build` in the repo root first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'ui'), { recursive: true });
cpSync(dist, join(out, 'ext'), { recursive: true });
cpSync(join(here, 'fonts'), join(out, 'ext', 'fonts'), { recursive: true });
cpSync(join(here, 'fonts'), join(out, 'fonts'), { recursive: true });
cpSync(join(here, 'page.css'), join(out, 'ext', 'demo-page.css'));
for (const f of ['tokens.css', 'workbenchPalette.css']) cpSync(join(root, 'src', 'ui', f), join(out, 'ui', f));
mkdirSync(join(out, 'vendor'), { recursive: true });
cpSync(join(here, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), join(out, 'vendor', 'gsap.min.js'));

for (const page of ['popup', 'sidepanel']) {
  const html = readFileSync(join(dist, 'src', page, `${page}.html`), 'utf8');
  const moduleTag = html.indexOf('<script type="module"');
  if (moduleTag < 0) throw new Error(`${page}.html: product module script not found`);
  const inject = '<link rel="stylesheet" href="./demo-page.css">\n    <script src="./stub.js"></script>\n    ';
  const demo = (html.slice(0, moduleTag) + inject + html.slice(moduleTag)).replaceAll('"/assets/', '"./assets/');
  writeFileSync(join(out, 'ext', `${page}.html`), demo);
}

await build({
  entryPoints: [join(here, 'stub.ts')],
  outfile: join(out, 'ext', 'stub.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  logLevel: 'warning'
});

console.log('demo/.build ready');
