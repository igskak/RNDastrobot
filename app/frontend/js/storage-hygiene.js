// Keeps the site's localStorage from filling up.
//
// localStorage has one quota per site (about 5 MB in Chrome) shared by every page.
// forecast-new caches each calculated layer there, one entry per layer and date, and
// a single entry weighs 50-300 KB. Those entries used to stay forever, because
// their TTL was only checked when the same key was read again. A full quota then
// broke Google sign-in: supabase-js tests localStorage on start and, when a write
// fails, silently keeps its PKCE verifier and session in memory, which a redirect
// to Google wipes.
//
// The layer cache below lives inside a character budget, evicts its oldest entries
// first and gives way on a quota error. prepareAuthStorage() frees the cache before
// the login page starts Supabase.
(function(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) root.StorageHygiene = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
    'use strict';

    // Matches every version of the forecast-new layer cache, old ones included.
    const LAYER_CACHE_PREFIX = 'forecastNewLayerCache:';
    const LAYER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
    // Characters, not bytes: browsers count UTF-16 code units. 1.5M characters is
    // about 3 MB, so the cache never takes more than about half of the quota.
    const LAYER_CACHE_MAX_CHARS = 1500000;
    // Room the login page needs: a Supabase session with its user record and the
    // PKCE verifier take a few KB.
    const AUTH_STORAGE_PROBE_CHARS = 16 * 1024;
    const AUTH_STORAGE_PROBE_KEY = 'steliara.storageProbe';
    const SAVED_AT_PATTERN = /^\{"savedAt":(\d+)/;

    function resolveStorage(storage) {
        if (storage) return storage;
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch {
            return null;
        }
    }

    function listKeys(storage) {
        const keys = [];
        try {
            for (let index = 0; index < storage.length; index += 1) {
                const key = storage.key(index);
                if (key !== null) keys.push(key);
            }
        } catch {
            return [];
        }
        return keys;
    }

    function safeRemove(storage, key) {
        try {
            storage.removeItem(key);
        } catch {
            // Nothing to do: the entry stays until the next pass.
        }
    }

    // Entries are written as {"savedAt":<ms>,"data":...}; reading the timestamp off
    // the start of the string avoids parsing hundreds of KB of JSON per entry.
    function readSavedAt(raw) {
        const match = SAVED_AT_PATTERN.exec(String(raw || '').slice(0, 40));
        return match ? Number(match[1]) : null;
    }

    function clearLayerCache(storage, { prefix = LAYER_CACHE_PREFIX } = {}) {
        const target = resolveStorage(storage);
        if (!target) return 0;
        const keys = listKeys(target).filter((key) => key.startsWith(prefix));
        keys.forEach((key) => safeRemove(target, key));
        return keys.length;
    }

    function createLayerCache(options = {}) {
        const storage = resolveStorage(options.storage);
        const prefix = options.prefix || LAYER_CACHE_PREFIX;
        const ttlMs = options.ttlMs || LAYER_CACHE_TTL_MS;
        const maxChars = options.maxChars || LAYER_CACHE_MAX_CHARS;
        const now = typeof options.now === 'function' ? options.now : () => Date.now();
        // key -> { savedAt, chars }, built once from storage and kept in step with
        // every write, so enforcing the budget never rereads the stored values.
        const index = new Map();
        let totalChars = 0;

        function forget(key) {
            const entry = index.get(key);
            if (!entry) return;
            totalChars -= entry.chars;
            index.delete(key);
        }

        function remove(key) {
            if (!storage) return;
            safeRemove(storage, key);
            forget(key);
        }

        function evictOldestUntil(limit) {
            const oldestFirst = Array.from(index.entries()).sort((a, b) => a[1].savedAt - b[1].savedAt);
            for (const [key] of oldestFirst) {
                if (totalChars <= limit) break;
                remove(key);
            }
        }

        // Drops expired and unreadable entries, then the oldest ones over budget.
        function prune() {
            if (!storage) return { removed: 0, keptChars: 0 };
            index.clear();
            totalChars = 0;
            let removed = 0;
            const cutoff = now() - ttlMs;
            for (const key of listKeys(storage)) {
                if (!key.startsWith(prefix)) continue;
                let raw = null;
                try {
                    raw = storage.getItem(key);
                } catch {
                    raw = null;
                }
                const savedAt = readSavedAt(raw);
                if (raw === null || savedAt === null || savedAt < cutoff) {
                    safeRemove(storage, key);
                    removed += 1;
                    continue;
                }
                const chars = key.length + raw.length;
                index.set(key, { savedAt, chars });
                totalChars += chars;
            }
            const before = index.size;
            evictOldestUntil(maxChars);
            removed += before - index.size;
            return { removed, keptChars: totalChars };
        }

        function read(key) {
            if (!storage) return null;
            let raw = null;
            try {
                raw = storage.getItem(key);
            } catch {
                return null;
            }
            if (!raw) {
                forget(key);
                return null;
            }
            try {
                const payload = JSON.parse(raw);
                if (!payload || now() - Number(payload.savedAt || 0) > ttlMs) {
                    remove(key);
                    return null;
                }
                return payload.data || null;
            } catch {
                remove(key);
                return null;
            }
        }

        function write(key, data) {
            if (!storage) return false;
            let raw;
            try {
                raw = JSON.stringify({ savedAt: now(), data });
            } catch {
                return false;
            }
            const chars = key.length + raw.length;
            // An entry larger than the whole budget stays in memory only.
            if (chars > maxChars) {
                remove(key);
                return false;
            }
            forget(key);
            evictOldestUntil(maxChars - chars);
            try {
                storage.setItem(key, raw);
            } catch {
                // The quota is shared with the rest of the site; give the space back
                // rather than squeeze others out, then try once with an empty cache.
                clearLayerCache(storage, { prefix });
                index.clear();
                totalChars = 0;
                try {
                    storage.setItem(key, raw);
                } catch {
                    return false;
                }
            }
            index.set(key, { savedAt: now(), chars });
            totalChars += chars;
            return true;
        }

        const initialPrune = prune();

        return {
            read,
            write,
            remove,
            prune,
            initialPrune,
            get totalChars() {
                return totalChars;
            },
            get size() {
                return index.size;
            },
        };
    }

    function canWrite(storage, chars) {
        try {
            storage.setItem(AUTH_STORAGE_PROBE_KEY, 'x'.repeat(chars));
            storage.removeItem(AUTH_STORAGE_PROBE_KEY);
            return true;
        } catch {
            safeRemove(storage, AUTH_STORAGE_PROBE_KEY);
            return false;
        }
    }

    // Run before supabase-js starts: makes sure a session fits into localStorage.
    // Returns what happened so a failed sign-in can report it.
    function prepareAuthStorage(options = {}) {
        const storage = resolveStorage(options.storage);
        if (!storage) return { available: false, writable: false, freedEntries: 0 };
        const probeChars = options.probeChars || AUTH_STORAGE_PROBE_CHARS;
        // Expired and over-budget cache entries go first, whatever the quota says.
        const pruned = createLayerCache({ storage, now: options.now }).initialPrune.removed;
        if (canWrite(storage, probeChars)) {
            return { available: true, writable: true, freedEntries: pruned };
        }
        const cleared = clearLayerCache(storage);
        return {
            available: true,
            writable: canWrite(storage, probeChars),
            freedEntries: pruned + cleared,
        };
    }

    return {
        LAYER_CACHE_PREFIX,
        LAYER_CACHE_TTL_MS,
        LAYER_CACHE_MAX_CHARS,
        createLayerCache,
        clearLayerCache,
        prepareAuthStorage,
    };
});
