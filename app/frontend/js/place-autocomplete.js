/**
 * Shared place autocomplete for location inputs.
 * Uses internal API (/api/v1/places/autocomplete) with unified backend geocoding.
 */
(function () {
    function resolveLanguage(rawLocale) {
        const normalized = window.FrontendI18n?.normalizeLocale?.(rawLocale);
        const locale = normalized || window.FrontendI18n?.getLocale?.() || 'en';
        return String(locale).split('-')[0].toLowerCase();
    }

    async function searchPlaces(query, options = {}) {
        const limit = Number(options.limit) || 5;
        const language = resolveLanguage(options.language);

        const apiBase = window.AstroAPI?.API_BASE_URL || '/api/v1';
        const params = new URLSearchParams({
            q: query,
            limit: String(Math.max(1, Math.min(limit, 10))),
            language,
        });

        const headers = window.AstroAPI?.withLocaleHeaders
            ? window.AstroAPI.withLocaleHeaders({})
            : { 'Accept-Language': language };

        const response = await fetch(`${apiBase}/places/autocomplete?${params.toString()}`, {
            headers,
            signal: options.signal,
        });
        if (!response.ok) {
            throw new Error(`Place search failed: ${response.status}`);
        }

        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        return results
            .map((item) => ({
                raw: item,
                displayName: item.display_name,
                shortName: item.short_name,
                lat: Number.parseFloat(item.lat),
                lon: Number.parseFloat(item.lon),
                sourceId: item.source_id,
            }))
            .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon) && item.displayName);
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
        let activeController = null;

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
            const supportsAbort = typeof AbortController === 'function';
            if (supportsAbort && activeController) {
                activeController.abort();
            }
            activeController = supportsAbort ? new AbortController() : null;
            try {
                const items = await searchPlaces(query, {
                    limit,
                    language: getLanguage(),
                    signal: activeController?.signal,
                });
                if (seq !== inFlightSeq) return;
                render(items);
            } catch (err) {
                if (err && err.name === 'AbortError') {
                    return;
                }
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
