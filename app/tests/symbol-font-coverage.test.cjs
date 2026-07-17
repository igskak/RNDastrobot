'use strict';

/**
 * Guard: сабсеты символьных шрифтов (Фаза 3) не должны терять глифы, которые
 * реально используются в symbols.js и раньше рендерились нашими шрифтами.
 *
 * Не требует fonttools — читает закоммиченный манифест покрытия, который
 * генерирует app/scripts/subset-symbol-fonts.py. Если в symbols.js добавили
 * глиф, а сабсет не пересобрали, тест упадёт: requiredCodepoints() возьмёт
 * новый кодпоинт, а его не будет в manifest.covered.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { requiredCodepoints } = require('../scripts/extract-symbol-codepoints.cjs');

const FONTS_DIR = path.join(__dirname, '..', 'frontend', 'fonts');
const MANIFEST_PATH = path.join(FONTS_DIR, 'symbol-subset-coverage.json');

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

test('манифест покрытия сабсетов существует и валиден', () => {
  const manifest = loadManifest();
  assert.ok(Array.isArray(manifest.covered) && manifest.covered.length > 0);
  assert.ok(Array.isArray(manifest.servedLocally));
  assert.ok(Array.isArray(manifest.systemFallback));
});

test('каждый локально отдаваемый глиф из symbols.js покрыт сабсетом', () => {
  const manifest = loadManifest();
  const covered = new Set(manifest.covered);
  const fallback = new Set(manifest.systemFallback);
  const required = requiredCodepoints().map((cp) => cp.toString(16).toUpperCase().padStart(4, '0'));

  const missing = required.filter((cp) => !covered.has(cp) && !fallback.has(cp));
  assert.deepStrictEqual(
    missing,
    [],
    `Кодпоинты используются в symbols.js, но не покрыты сабсетом и не в systemFallback: ${missing.join(', ')}. ` +
      'Перезапусти: .venv/bin/python app/scripts/subset-symbol-fonts.py',
  );
});

test('заявленные servedLocally реально присутствуют в covered', () => {
  const manifest = loadManifest();
  const covered = new Set(manifest.covered);
  const broken = manifest.servedLocally.filter((cp) => !covered.has(cp));
  assert.deepStrictEqual(broken, [], `servedLocally не найдены в covered: ${broken.join(', ')}`);
});

test('woff2-сабсеты существуют и меньше исходных ttf', () => {
  const manifest = loadManifest();
  for (const font of manifest.fonts) {
    const subsetPath = path.join(FONTS_DIR, font.subset);
    assert.ok(fs.existsSync(subsetPath), `нет файла ${font.subset}`);
    const bytes = fs.statSync(subsetPath).size;
    assert.ok(bytes < font.sourceBytes, `${font.subset} не меньше исходника`);
    assert.ok(bytes < 200 * 1024, `${font.subset} неожиданно большой: ${bytes} байт`);
  }
});
