import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(appRoot, 'frontend');
const jsOutdir = path.join(frontendRoot, 'js', 'bundles');
const cssOutdir = path.join(frontendRoot, 'bundles');

const jsEntryPoints = {
  index: path.join(frontendRoot, 'entries', 'index.entry.js'),
  clients: path.join(frontendRoot, 'entries', 'clients.entry.js'),
  chart: path.join(frontendRoot, 'entries', 'chart.entry.js'),
  forecast: path.join(frontendRoot, 'entries', 'forecast.entry.js'),
  'natal-full': path.join(frontendRoot, 'entries', 'natal-full.entry.js'),
  interpretations: path.join(frontendRoot, 'entries', 'interpretations.entry.js'),
};

const cssEntryPoints = {
  index: path.join(frontendRoot, 'entries-css', 'index.entry.css'),
  clients: path.join(frontendRoot, 'entries-css', 'clients.entry.css'),
  chart: path.join(frontendRoot, 'entries-css', 'chart.entry.css'),
  forecast: path.join(frontendRoot, 'entries-css', 'forecast.entry.css'),
  'natal-full': path.join(frontendRoot, 'entries-css', 'natal-full.entry.css'),
  interpretations: path.join(frontendRoot, 'entries-css', 'interpretations.entry.css'),
};

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
