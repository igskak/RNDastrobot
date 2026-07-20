import { build } from 'esbuild';
import { createHash } from 'node:crypto';
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
  'account-settings.html',
  'clients.html',
  'client-profile.html',
  'forecast-new.html',
  'forecast-tables.html',
  'forecast-timeline.html',
  'natal-full.html',
  'login.html',
  'calendar.html',
  'consultation-call.html',
  'consultation-join.html',
  'consultation.html',
];

const jsEntryPoints = {
  index: path.join(frontendRoot, 'entries', 'index.entry.js'),
  'account-settings': path.join(frontendRoot, 'entries', 'account-settings.entry.js'),
  clients: path.join(frontendRoot, 'entries', 'clients.entry.js'),
  'client-profile': path.join(frontendRoot, 'entries', 'client-profile.entry.js'),
  'forecast-new': path.join(frontendRoot, 'entries', 'forecast-new.entry.js'),
  'forecast-tables': path.join(frontendRoot, 'entries', 'forecast-tables.entry.js'),
  'forecast-timeline': path.join(frontendRoot, 'entries', 'forecast-timeline.entry.js'),
  'natal-full': path.join(frontendRoot, 'entries', 'natal-full.entry.js'),
  login: path.join(frontendRoot, 'entries', 'login.entry.js'),
  calendar: path.join(frontendRoot, 'entries', 'calendar.entry.js'),
  'consultation-call': path.join(frontendRoot, 'entries', 'consultation-call.entry.js'),
  'consultation-join': path.join(frontendRoot, 'entries', 'consultation-join.entry.js'),
  consultation: path.join(frontendRoot, 'entries', 'consultation.entry.js'),
};

const cssEntryPoints = {
  index: path.join(frontendRoot, 'entries-css', 'index.entry.css'),
  'account-settings': path.join(frontendRoot, 'entries-css', 'account-settings.entry.css'),
  clients: path.join(frontendRoot, 'entries-css', 'clients.entry.css'),
  'client-profile': path.join(frontendRoot, 'entries-css', 'client-profile.entry.css'),
  'forecast-new': path.join(frontendRoot, 'entries-css', 'forecast-new.entry.css'),
  'forecast-tables': path.join(frontendRoot, 'entries-css', 'forecast-tables.entry.css'),
  'forecast-timeline': path.join(frontendRoot, 'entries-css', 'forecast-timeline.entry.css'),
  'natal-full': path.join(frontendRoot, 'entries-css', 'natal-full.entry.css'),
  login: path.join(frontendRoot, 'entries-css', 'login.entry.css'),
  calendar: path.join(frontendRoot, 'entries-css', 'calendar.entry.css'),
  'consultation-call': path.join(frontendRoot, 'entries-css', 'consultation-call.entry.css'),
  'consultation-join': path.join(frontendRoot, 'entries-css', 'consultation-join.entry.css'),
  consultation: path.join(frontendRoot, 'entries-css', 'consultation.entry.css'),
  // C3 (Фаза 3): ленивый бандл виджета чата (не входит в критический CSS страниц).
  'chat-widget': path.join(frontendRoot, 'entries-css', 'chat-widget.entry.css'),
};

function pageEntryName(page) {
  return page.replace(/\.html$/, '');
}

async function hashExistingFiles(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    try {
      hash.update(await readFile(file));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return hash.digest('hex').slice(0, 12);
}

async function buildVersionForPage(page, source) {
  const entryName = pageEntryName(page);
  const files = [
    path.join(jsOutdir, `${entryName}.bundle.js`),
    path.join(cssOutdir, `${entryName}.bundle.css`),
  ];
  if (source.includes('css/locale-switcher.css')) {
    files.push(path.join(frontendRoot, 'css', 'locale-switcher.css'));
  }
  if (source.includes('js/locale-switcher.js')) {
    files.push(path.join(frontendRoot, 'js', 'locale-switcher.js'));
  }
  if (source.includes('js/analytics.js')) {
    files.push(path.join(frontendRoot, 'js', 'analytics.js'));
  }
  return hashExistingFiles(files);
}

// C4: транзитивное замыкание чанков, которые статически импортирует entry-бандл.
// Браузеру эти чанки нужны в любом случае; modulepreload лишь сообщает о них раньше,
// убирая водопад HTML→entry→chunks. Пути в metafile — относительно корня проекта
// (app/frontend/js/bundles/...), приводим их к URL /js/bundles/... .
function collectEntryChunks(metafile, entryName) {
  const outputs = metafile?.outputs || {};
  const entryOutputPath = Object.keys(outputs).find((outPath) => {
    const info = outputs[outPath];
    return info?.entryPoint && outPath.endsWith(`js/bundles/${entryName}.bundle.js`);
  });
  if (!entryOutputPath) return [];

  const chunkUrls = new Set();
  const visited = new Set();
  const visit = (outPath) => {
    if (visited.has(outPath)) return;
    visited.add(outPath);
    const info = outputs[outPath];
    if (!info) return;
    for (const imported of info.imports || []) {
      if (imported.kind !== 'import-statement') continue;
      const importPath = imported.path;
      const chunkMatch = importPath.match(/js\/bundles\/(chunks\/[^"']+\.js)$/);
      if (chunkMatch) chunkUrls.add(`/js/bundles/${chunkMatch[1]}`);
      visit(importPath);
    }
  };
  visit(entryOutputPath);
  // Детерминированный порядок → стабильный вывод между сборками (check:frontend-build).
  return [...chunkUrls].sort();
}

function injectModulePreload(source, page, chunkUrls) {
  const entryName = pageEntryName(page);
  const startMarker = `<!-- modulepreload:${entryName}:start -->`;
  const endMarker = `<!-- modulepreload:${entryName}:end -->`;
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return source;

  const indentMatch = source.slice(0, startIndex).match(/([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : '';
  const links = chunkUrls
    .map((url) => `\n${indent}<link rel="modulepreload" href="${url}">`)
    .join('');
  const before = source.slice(0, startIndex + startMarker.length);
  const after = source.slice(endIndex);
  return `${before}${links}\n${indent}${after}`;
}

function rewriteHtmlBuildMarkers(source, buildId, page) {
  const entryName = pageEntryName(page);
  const escapedEntryName = entryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const assetPattern = new RegExp(
    `((?:/)?(?:bundles/${escapedEntryName}\\.bundle\\.css|js/bundles/${escapedEntryName}\\.bundle\\.js|css/locale-switcher\\.css|js/locale-switcher\\.js|js/analytics\\.js|css/app-nav\\.css|js/app-nav\\.js))\\?v=[^"' ]+`,
    'g',
  );

  return source
    .replace(
      /window\.__APP_BUILD_ID__ = '[^']+';/g,
      `window.__APP_BUILD_ID__ = '${buildId}';`,
    )
    .replace(assetPattern, `$1?v=${buildId}`);
}

async function syncHtmlBuildMarkers(metafile) {
  const updatedPages = [];

  for (const page of htmlPages) {
    const htmlPath = path.join(frontendRoot, page);
    const current = await readFile(htmlPath, 'utf8');
    const pageBuildId = process.env.FRONTEND_BUILD_ID || await buildVersionForPage(page, current);
    let next = rewriteHtmlBuildMarkers(current, pageBuildId, page);
    // C4: modulepreload инжектится только на страницы с маркер-блоком (no-op иначе).
    const chunkUrls = collectEntryChunks(metafile, pageEntryName(page));
    next = injectModulePreload(next, page, chunkUrls);

    if (next !== current) {
      await writeFile(htmlPath, next, 'utf8');
      updatedPages.push(page);
    }
  }

  return updatedPages;
}

await rm(jsOutdir, { recursive: true, force: true });
await rm(cssOutdir, { recursive: true, force: true });
await mkdir(jsOutdir, { recursive: true });
await mkdir(cssOutdir, { recursive: true });

const jsBuildResult = await build({
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
  metafile: true,
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

const updatedPages = await syncHtmlBuildMarkers(jsBuildResult.metafile);
console.log(`Frontend build id: ${process.env.FRONTEND_BUILD_ID || 'content-hash'}`);
if (updatedPages.length) {
  console.log(`Updated HTML asset markers: ${updatedPages.join(', ')}`);
} else {
  console.log('HTML asset markers were already up to date.');
}
