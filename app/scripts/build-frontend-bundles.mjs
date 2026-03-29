import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(appRoot, 'frontend');
const jsOutdir = path.join(frontendRoot, 'js', 'bundles');
const cssOutdir = path.join(frontendRoot, 'bundles');
const htmlPages = [
  'index.html',
  'clients.html',
  'chart.html',
  'forecast.html',
  'natal-full.html',
  'login.html',
  'calendar.html',
];

const jsEntryPoints = {
  index: path.join(frontendRoot, 'entries', 'index.entry.js'),
  clients: path.join(frontendRoot, 'entries', 'clients.entry.js'),
  chart: path.join(frontendRoot, 'entries', 'chart.entry.js'),
  forecast: path.join(frontendRoot, 'entries', 'forecast.entry.js'),
  'natal-full': path.join(frontendRoot, 'entries', 'natal-full.entry.js'),
  login: path.join(frontendRoot, 'entries', 'login.entry.js'),
  calendar: path.join(frontendRoot, 'entries', 'calendar.entry.js'),
};

const cssEntryPoints = {
  index: path.join(frontendRoot, 'entries-css', 'index.entry.css'),
  clients: path.join(frontendRoot, 'entries-css', 'clients.entry.css'),
  chart: path.join(frontendRoot, 'entries-css', 'chart.entry.css'),
  forecast: path.join(frontendRoot, 'entries-css', 'forecast.entry.css'),
  'natal-full': path.join(frontendRoot, 'entries-css', 'natal-full.entry.css'),
  login: path.join(frontendRoot, 'entries-css', 'login.entry.css'),
  calendar: path.join(frontendRoot, 'entries-css', 'calendar.entry.css'),
};

function createBuildId(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function rewriteHtmlBuildMarkers(source, buildId) {
  return source
    .replace(
      /window\.__APP_BUILD_ID__ = '[^']+';/g,
      `window.__APP_BUILD_ID__ = '${buildId}';`,
    )
    .replace(
      /((?:bundles\/[^"'?]+\.bundle\.css|js\/bundles\/[^"'?]+\.bundle\.js|css\/locale-switcher\.css|js\/locale-switcher\.js))\?v=[^"' ]+/g,
      `$1?v=${buildId}`,
    );
}

async function syncHtmlBuildMarkers(buildId) {
  const updatedPages = [];

  for (const page of htmlPages) {
    const htmlPath = path.join(frontendRoot, page);
    const current = await readFile(htmlPath, 'utf8');
    const next = rewriteHtmlBuildMarkers(current, buildId);

    if (next !== current) {
      await writeFile(htmlPath, next, 'utf8');
      updatedPages.push(page);
    }
  }

  return updatedPages;
}

const buildId = process.env.FRONTEND_BUILD_ID || createBuildId();

await rm(jsOutdir, { recursive: true, force: true });
await rm(cssOutdir, { recursive: true, force: true });
await mkdir(jsOutdir, { recursive: true });
await mkdir(cssOutdir, { recursive: true });

await build({
  entryPoints: jsEntryPoints,
  outdir: jsOutdir,
  bundle: true,
  splitting: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  sourcemap: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
  entryNames: '[name].bundle',
  chunkNames: 'chunks/[name]-[hash]',
});

await build({
  entryPoints: cssEntryPoints,
  outdir: cssOutdir,
  bundle: true,
  minify: true,
  external: ['../fonts/*', '/fonts/*'],
  sourcemap: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
  entryNames: '[name].bundle',
});

console.log(`Built frontend JS bundles into ${jsOutdir}`);
console.log(`Built frontend CSS bundles into ${cssOutdir}`);

const updatedPages = await syncHtmlBuildMarkers(buildId);
console.log(`Frontend build id: ${buildId}`);
if (updatedPages.length) {
  console.log(`Updated HTML asset markers: ${updatedPages.join(', ')}`);
} else {
  console.log('HTML asset markers were already up to date.');
}
