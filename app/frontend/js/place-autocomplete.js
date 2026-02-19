/**
 * Shared place autocomplete for location inputs.
 * Uses Nominatim API and provides a single consistent UX across pages.
 */
(function () {
    function shortName(displayName) {
        return String(displayName || '').split(',')[0]?.trim() || '';
    }

    function resolveLanguage(rawLocale) {
        const normalized = window.FrontendI18n?.normalizeLocale?.(rawLocale);
        if (normalized) return normalized;
        return window.FrontendI18n?.getLocale?.() || 'en';
    }

    async function searchPlaces(query, options = {}) {
        const limit = Number(options.limit) || 5;
        const language = resolveLanguage(options.language);
        const params = new URLSearchParams({
            format: 'json',
            q: query,
            limit: String(limit)
        });
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params.toString()}`,
            { headers: { 'Accept-Language': language } }
        );
        if (!response.ok) {
            throw new Error(`Place search failed: ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) return [];
        return data.map((p) => ({
            raw: p,
            displayName: p.display_name,
            shortName: shortName(p.display_name),
            lat: Number.parseFloat(p.lat),
            lon: Number.parseFloat(p.lon)
        }));
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
