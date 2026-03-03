/**
 * Shared place autocomplete for location inputs.
 * Uses Open-Meteo Geocoding API with deduplication and population ranking.
 */
(function () {
    function resolveLanguage(rawLocale) {
        const normalized = window.FrontendI18n?.normalizeLocale?.(rawLocale);
        const locale = normalized || window.FrontendI18n?.getLocale?.() || 'en';
        return String(locale).split('-')[0].toLowerCase();
    }

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function roundCoord(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num.toFixed(2) : '';
    }

    function isLikelyCity(featureCode) {
        const code = String(featureCode || '').toUpperCase();
        if (!code) return true;
        return code.startsWith('PPL') || code === 'PPLC';
    }

    function buildDisplayName(item) {
        const parts = [];
        const seen = new Set();
        [item.name, item.admin1, item.country].forEach((part) => {
            const trimmed = String(part || '').trim();
            if (!trimmed) return;
            const key = trimmed.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            parts.push(trimmed);
        });
        return parts.join(', ');
    }

    function dedupeAndRank(items) {
        const byKey = new Map();
        items.forEach((item) => {
            const key = [
                normalizeText(item.name),
                normalizeText(item.country),
                roundCoord(item.lat),
                roundCoord(item.lon)
            ].join('|');

            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, item);
                return;
            }

            const existingPop = Number(existing.population) || 0;
            const currentPop = Number(item.population) || 0;
            const currentHasAdmin = Boolean(item.admin1);
            const existingHasAdmin = Boolean(existing.admin1);

            if (currentPop > existingPop || (currentPop === existingPop && currentHasAdmin && !existingHasAdmin)) {
                byKey.set(key, item);
            }
        });

        return Array.from(byKey.values()).sort((a, b) => {
            const popA = Number(a.population) || 0;
            const popB = Number(b.population) || 0;
            if (popA !== popB) return popB - popA;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
    }

    async function searchPlaces(query, options = {}) {
        const limit = Number(options.limit) || 5;
        const language = resolveLanguage(options.language);
        const params = new URLSearchParams({
            name: query,
            count: String(Math.max(limit * 3, 15)),
            language,
            format: 'json'
        });

        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Place search failed: ${response.status}`);
        }

        const data = await response.json();
        const rawItems = Array.isArray(data?.results) ? data.results : [];

        const mapped = rawItems
            .map((p) => ({
                raw: p,
                name: p.name,
                admin1: p.admin1,
                country: p.country,
                population: Number(p.population) || 0,
                featureCode: p.feature_code,
                lat: Number.parseFloat(p.latitude),
                lon: Number.parseFloat(p.longitude)
            }))
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.name)
            .filter((p) => isLikelyCity(p.featureCode))
            .map((p) => ({
                ...p,
                shortName: p.name,
                displayName: buildDisplayName(p)
            }));

        return dedupeAndRank(mapped).slice(0, limit);
    }

    function attach(config) {
        const input = config.input;
        const suggestions = config.suggestions;
        if (!input || !suggestions) return null;

        const minChars = Number(config.minChars) || 2;
        const debounceMs = Number(config.debounceMs) || 350;
        const limit = Number(config.limit) || 5;
        const getLanguage = typeof config.getLanguage === 'function'
            ? config.getLanguage
            : () => resolveLanguage(config.language);

        const getLabel = typeof config.getLabel === 'function'
            ? config.getLabel
            : ((item) => item.shortName || item.displayName);

        let debounceTimer = null;
        let inFlightSeq = 0;

        function closeSuggestions() {
            suggestions.classList.remove('active');
        }

        function render(items) {
            suggestions.innerHTML = '';
            if (!items.length) {
                closeSuggestions();
                return;
            }

            items.forEach((item) => {
                const row = document.createElement('div');
                row.className = 'place-suggestion';
                row.textContent = item.displayName;
                row.addEventListener('click', () => {
                    input.value = getLabel(item);
                    closeSuggestions();
                    if (typeof config.onSelect === 'function') {
                        config.onSelect(item);
                    }
                });
                suggestions.appendChild(row);
            });
            suggestions.classList.add('active');
        }

        async function lookup(query) {
            const seq = ++inFlightSeq;
            try {
                const items = await searchPlaces(query, { limit, language: getLanguage() });
                if (seq !== inFlightSeq) return;
                render(items);
            } catch (err) {
                console.error('Place autocomplete error:', err);
                if (seq === inFlightSeq) closeSuggestions();
            }
        }

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (typeof config.onInput === 'function') {
                config.onInput(query);
            }
            clearTimeout(debounceTimer);
            if (query.length < minChars) {
                closeSuggestions();
                return;
            }
            debounceTimer = setTimeout(() => lookup(query), debounceMs);
        });

        input.addEventListener('focus', () => {
            if (suggestions.children.length > 0) {
                suggestions.classList.add('active');
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(closeSuggestions, 180);
        });

        return { closeSuggestions };
    }

    window.PlaceAutocomplete = {
        attach,
        searchPlaces
    };
})();
