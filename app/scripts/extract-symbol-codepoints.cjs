'use strict';

/**
 * Единый источник правды по кодпоинтам, которые ДОЛЖНЫ быть покрыты
 * сабсетами символьных шрифтов (Astronomicon / Noto Sans Symbols / Symbols 2).
 *
 * Используется и сабсеттером (app/scripts/subset-symbol-fonts.mjs), и
 * guard-тестом (app/tests/symbol-font-coverage.test.cjs), чтобы добавление
 * нового глифа в symbols.js без пересборки сабсета ловилось тестом.
 *
 * Мы НЕ исполняем symbols.js (он завязан на window/document), а парсим текстом
 * только глиф-карты (планеты, знаки, мажорные аспекты, конфигурации) — из них
 * берём все не-ASCII символы. Кириллические имена лежат в других const и сюда
 * не попадают, что и требуется: они рендерятся UI-шрифтом, не символьным.
 */

const fs = require('node:fs');
const path = require('node:path');

const SYMBOLS_JS = path.join(__dirname, '..', 'frontend', 'js', 'symbols.js');

// Имена const-блоков в symbols.js, значения которых рендерятся символьным шрифтом.
const GLYPH_MAP_NAMES = [
  'PLANET_SYMBOLS',
  'SIGN_SYMBOLS',
  'MAJOR_ASPECT_SYMBOLS',
  'CONFIG_ICONS',
];

// Фиксированные диапазоны из плана (перестраховка для глифов, что могут
// появиться в данных, но не перечислены явно в symbols.js).
const FIXED_RANGES = [
  [0x2600, 0x26ff], // Miscellaneous Symbols (планеты, узлы, мажорные аспекты)
  [0x2648, 0x2653], // Zodiac signs (входит в предыдущий, оставлено для ясности)
  [0x2b00, 0x2b5f], // Miscellaneous Symbols and Arrows
  [0x25a0, 0x25ff], // Geometric Shapes (△ □ ◇ ▭ ●)
];

function extractBlock(source, constName) {
  const marker = `const ${constName}`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Не найден блок ${constName} в symbols.js`);
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) throw new Error(`Не найдена { для ${constName}`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`Не закрыт блок ${constName}`);
}

function collectRequiredCodepoints() {
  const source = fs.readFileSync(SYMBOLS_JS, 'utf8');
  const codepoints = new Set();

  for (const name of GLYPH_MAP_NAMES) {
    const block = extractBlock(source, name);
    for (const ch of block) {
      const cp = ch.codePointAt(0);
      // Только не-ASCII глифы (ASCII-плейсхолдеры типа 'Vx','MC',']·[' рендерятся UI-шрифтом).
      if (cp > 0x7f) codepoints.add(cp);
    }
  }

  return codepoints;
}

function expandFixedRanges() {
  const codepoints = new Set();
  for (const [lo, hi] of FIXED_RANGES) {
    for (let cp = lo; cp <= hi; cp += 1) codepoints.add(cp);
  }
  return codepoints;
}

/**
 * Кодпоинты, которые guard-тест обязан найти покрытыми (из symbols.js).
 * Фиксированные диапазоны в guard НЕ включаем — их покрытие определяется
 * реальным содержимым шрифтов; включаем только то, что мы реально используем.
 */
function requiredCodepoints() {
  return [...collectRequiredCodepoints()].sort((a, b) => a - b);
}

/**
 * Полный набор кодпоинтов для передачи в pyftsubset (реальные глифы + диапазоны).
 * pyftsubset игнорирует отсутствующие в шрифте кодпоинты, так что один набор
 * можно скармливать всем трём шрифтам.
 */
function subsetCodepoints() {
  const merged = new Set([...collectRequiredCodepoints(), ...expandFixedRanges()]);
  return [...merged].sort((a, b) => a - b);
}

module.exports = { requiredCodepoints, subsetCodepoints, GLYPH_MAP_NAMES, FIXED_RANGES };

if (require.main === module) {
  const mode = process.argv[2] || 'required';
  const cps = mode === 'subset' ? subsetCodepoints() : requiredCodepoints();
  process.stdout.write(JSON.stringify(cps.map((cp) => cp.toString(16).toUpperCase())));
}
