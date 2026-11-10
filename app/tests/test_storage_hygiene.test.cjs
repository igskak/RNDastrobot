const test = require('node:test');
const assert = require('node:assert/strict');

const StorageHygiene = require('../frontend/js/storage-hygiene.js');

const PREFIX = 'forecastNewLayerCache:v2:user:';
const HOUR = 60 * 60 * 1000;

// localStorage stand-in with a quota counted the way browsers count it: the
// characters of every key and value.
function createStorage(quotaChars = Infinity) {
    const items = new Map();
    const used = () => Array.from(items).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    return {
        get length() { return items.size; },
        key(index) { return Array.from(items.keys())[index] ?? null; },
        getItem(key) { return items.has(key) ? items.get(key) : null; },
        setItem(key, value) {
            const next = String(value);
            const previous = items.has(key) ? key.length + items.get(key).length : 0;
            if (used() - previous + key.length + next.length > quotaChars) {
                const error = new Error('quota');
                error.name = 'QuotaExceededError';
                throw error;
            }
            items.set(key, next);
        },
        removeItem(key) { items.delete(key); },
        keys() { return Array.from(items.keys()); },
    };
}

function entry(savedAt, size = 10) {
    return JSON.stringify({ savedAt, data: { blob: 'x'.repeat(size) } });
}

test('prune drops expired and unreadable entries and leaves other keys alone', () => {
    const now = 100 * HOUR;
    const storage = createStorage();
    storage.setItem(`${PREFIX}fresh`, entry(now - HOUR));
    storage.setItem(`${PREFIX}expired`, entry(now - 7 * HOUR));
    storage.setItem(`${PREFIX}broken`, 'not json');
    // An older cache version is swept too.
    storage.setItem('forecastNewLayerCache:v1:legacy', entry(now - 30 * 24 * HOUR));
    storage.setItem('sb-ref-auth-token', '{"access_token":"t"}');
    storage.setItem('astrobot_locale', 'ru');

    const cache = StorageHygiene.createLayerCache({ storage, now: () => now });

    assert.equal(cache.initialPrune.removed, 3);
    assert.deepEqual(storage.keys().sort(), ['astrobot_locale', `${PREFIX}fresh`, 'sb-ref-auth-token']);
    assert.deepEqual(cache.read(`${PREFIX}fresh`), { blob: 'x'.repeat(10) });
});

test('writes stay within the budget by evicting the oldest entries', () => {
    let now = 0;
    const storage = createStorage();
    const cache = StorageHygiene.createLayerCache({ storage, now: () => now, maxChars: 2500 });

    for (let i = 0; i < 10; i += 1) {
        now += 1000;
        assert.equal(cache.write(`${PREFIX}${i}`, { blob: 'x'.repeat(500) }), true);
    }

    assert.ok(cache.totalChars <= 2500);
    const kept = storage.keys().sort();
    assert.ok(kept.length >= 3 && kept.length < 10);
    // The newest entries survive.
    assert.ok(kept.includes(`${PREFIX}9`));
    assert.ok(!kept.includes(`${PREFIX}0`));
});

test('a quota error gives the cache space back and retries once', () => {
    const now = 10 * HOUR;
    const storage = createStorage(4000);
    storage.setItem('someone-else', 'y'.repeat(1500));
    const cache = StorageHygiene.createLayerCache({ storage, now: () => now, maxChars: 1e6 });

    assert.equal(cache.write(`${PREFIX}a`, { blob: 'x'.repeat(1000) }), true);
    assert.equal(cache.write(`${PREFIX}b`, { blob: 'x'.repeat(1000) }), true);
    // Does not fit next to a and b: they are dropped, c is written.
    assert.equal(cache.write(`${PREFIX}c`, { blob: 'x'.repeat(1000) }), true);

    assert.deepEqual(storage.keys().sort(), [`${PREFIX}c`, 'someone-else']);
    assert.equal(storage.getItem('someone-else').length, 1500);
});

test('an entry larger than the budget is not persisted', () => {
    const storage = createStorage();
    const cache = StorageHygiene.createLayerCache({ storage, now: () => 0, maxChars: 100 });

    assert.equal(cache.write(`${PREFIX}big`, { blob: 'x'.repeat(500) }), false);
    assert.equal(storage.length, 0);
});

test('reading an expired entry removes it', () => {
    let now = 0;
    const storage = createStorage();
    const cache = StorageHygiene.createLayerCache({ storage, now: () => now });
    cache.write(`${PREFIX}a`, { ok: true });

    now += 7 * HOUR;

    assert.equal(cache.read(`${PREFIX}a`), null);
    assert.equal(storage.length, 0);
    assert.equal(cache.size, 0);
});

test('prepareAuthStorage frees a full quota taken by the layer cache', () => {
    // The 2026-11-10 case: fresh cache entries fill the quota and supabase-js
    // cannot store a session.
    const now = 50 * HOUR;
    const storage = createStorage(30000);
    for (let i = 0; i < 20; i += 1) {
        try {
            storage.setItem(`${PREFIX}${i}`, entry(now - 60000 + i, 1400));
        } catch {
            break;
        }
    }
    storage.setItem('astrobot_locale', 'ru');

    const result = StorageHygiene.prepareAuthStorage({ storage, now: () => now, probeChars: 8000 });

    assert.equal(result.available, true);
    assert.equal(result.writable, true);
    assert.ok(result.freedEntries > 0);
    assert.equal(storage.getItem('astrobot_locale'), 'ru');
    assert.equal(storage.getItem('steliara.storageProbe'), null);
});

test('prepareAuthStorage reports storage it cannot free', () => {
    const storage = createStorage(1050);
    storage.setItem('someone-else', 'y'.repeat(990));

    const result = StorageHygiene.prepareAuthStorage({ storage, now: () => 0, probeChars: 100 });

    assert.deepEqual(result, { available: true, writable: false, freedEntries: 0 });
    assert.equal(storage.getItem('someone-else').length, 990);
});
