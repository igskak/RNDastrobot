(function () {
    'use strict';

    const API_BASE = window.AstroAPI?.API_BASE_URL || '/api/v1';
    const SOLAR_SESSION_KEY = 'solarReturnData';
    const SOLAR_LOCATION_KEY = 'solarLocation';
    const LEGACY_SOLAR_LOCATION_KEY = 'forecastSolarLocation';
    const SOLAR_STATE_KEY_PREFIX = 'solarViewState:';
    const DEFAULT_ASPECT_TYPES = window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES
        || ['Conjunction', 'Opposition', 'Trine', 'Square', 'Sextile'];
    const HOUSE_SYSTEM_CODES = {
        P: 'P',
        K: 'K',
        O: 'O',
        R: 'R',
        C: 'C',
        E: 'E',
        W: 'W',
        X: 'X',
        H: 'H',
        T: 'T',
        B: 'B',
        M: 'M',
        PLACIDUS: 'P',
        KOCH: 'K',
        PORPHYRY: 'O',
        REGIOMONTANUS: 'R',
        CAMPANUS: 'C',
        EQUAL: 'E',
        WHOLE_SIGN: 'W',
        WHOLESIGN: 'W',
    };
    const DEFAULT_ASPECT_PHASE_FILTER = ['applying', 'separating'];
    const MATRIX_BODIES = window.AstroPreferences?.MATRIX_BODIES || [
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
        'Uranus', 'Neptune', 'Pluto', 'Chiron', 'Proserpina',
        'TrueNode', 'SouthNode', 'BlackMoon', 'WhiteMoon', 'PartOfFortune'
    ];
    const VIEWBOX_SIZE = 600;
    const ZOOM_MIN = 1;
    const ZOOM_MAX = 2.8;
    const ZOOM_STEP = 0.12;

    const state = {
        natalData: null,
        natalWheelData: null,
        solarData: null,
        natalRenderer: null,
        renderer: null,
        wheel: null,
        accountPreferences: null,
        resolvedPreferences: null,
        settings: {
            houseSystem: 'P',
            orientation: 'aries',
            aspectScope: 'major',
            enabledAspectTypes: [...DEFAULT_ASPECT_TYPES],
            matrixRows: window.AstroPreferences?.ensureMatrixRows?.({}) || {},
            pointScale: 1,
            showApplyingSeparating: false,
            aspectPhaseFilter: [...DEFAULT_ASPECT_PHASE_FILTER],
            showSpeed: true,
            showStationary: true,
            showAspectText: false,
            showWheelStationary: false,
            showWheelDegree: false,
            houseNumberStyle: 'arabic',
            houseLabelsOutside: false,
            angleAscDscBold: true,
            angleMcIcBold: true,
        },
        displayMode: 'both',
        zoom: 1,
        panX: 0,
        panY: 0,
        panning: false,
        panStartX: 0,
        panStartY: 0,
        pinchDistance: 0,
        pinchStartZoom: 1,
    };

    const refs = {};

    function t(key, params, fallback = '') {
        const value = window.FrontendI18n?.t?.(key, params);
        return value && value !== key ? value : (fallback || key);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function waitForI18n() {
        if (window.FrontendI18n?.ready) {
            await Promise.resolve(window.FrontendI18n.ready).catch(() => {});
        }
    }

    function normalizeHouseSystemCode(value) {
        const raw = String(value || 'P').trim().toUpperCase().replace(/[\s-]+/g, '_');
        return HOUSE_SYSTEM_CODES[raw] || 'P';
    }

    function normalizeAspectPhaseFilter(value) {
        if (window.AstroAspectPhase?.normalizeAspectPhaseFilter) {
            return window.AstroAspectPhase.normalizeAspectPhaseFilter(value);
        }
        if (Array.isArray(value)) {
            const normalized = value
                .map((entry) => String(entry || '').trim().toLowerCase())
                .filter((entry) => DEFAULT_ASPECT_PHASE_FILTER.includes(entry));
            return [...new Set(normalized)];
        }
        const raw = String(value || '').trim().toLowerCase();
        if (!raw || raw === 'all') return [...DEFAULT_ASPECT_PHASE_FILTER];
        if (raw.includes(',')) return normalizeAspectPhaseFilter(raw.split(','));
        return DEFAULT_ASPECT_PHASE_FILTER.includes(raw) ? [raw] : [...DEFAULT_ASPECT_PHASE_FILTER];
    }

    function aspectMatchesPhaseFilter(aspect) {
        if (window.AstroAspectPhase?.aspectMatchesPhaseFilter) {
            return window.AstroAspectPhase.aspectMatchesPhaseFilter(aspect, state.settings.aspectPhaseFilter);
        }
        return true;
    }

    function collectRefs() {
        [
            'pageLoader', 'solarError', 'solarErrorMsg', 'solarLayout', 'solarSummaryBar',
            'solarBackBtn', 'solarTitle', 'solarSubtitle', 'solarStatusLabel',
            'solarNatalPanelMeta', 'solarPanelMeta',
            'solarYear', 'solarName', 'solarLocationName', 'solarPlaceSuggestions',
            'solarLocationLat', 'solarLocationLon', 'solarLocationSourceId',
            'solarLocationTimezone', 'solarCoordsDisplay', 'solarCalculateBtn',
            'summaryAsc', 'summaryMc', 'summarySun', 'summaryMoon',
            'summaryPattern', 'summaryDominants',
            'solarWheelWrapper', 'solarWheel',
            'solarZoomIn', 'solarZoomOut', 'solarZoomReset',
            'solarSettingsToggle', 'solarSettingsPanel',
            'solarOrientationSelect', 'solarHouseSystemSelect', 'solarAspectScopeSelect',
            'solarPointScaleRange', 'solarPointScaleValue',
            'solarAspectTypeToggles', 'solarMatrixEditor',
            'solarAspectPhaseApplyingToggle', 'solarAspectPhaseSeparatingToggle',
            'solarHouseNumberStyleSelect', 'solarHouseLabelsOutsideToggle',
            'solarShowWheelStationaryToggle', 'solarShowWheelDegreeToggle',
            'solarShowApplyingSeparatingToggle', 'solarShowSpeedToggle',
            'solarShowStationaryToggle', 'solarShowAspectTextToggle',
            'solarAngleAscDscBoldToggle', 'solarAngleMcIcBoldToggle',
            'solarSaveChartBtn',
            'solarActionsToggle', 'solarActionsMenu', 'solarMomentToggle', 'solarSavedChartsBtn', 'solarMomentCard',
            'solarConfigurationsContainer', 'solarBalancesContainer',
            'solarRulersContainer',
            'solarNatalPlanetsTable', 'solarNatalHousesTable', 'solarNatalAspectsTable',
            'solarNatalAspectGridContainer', 'solarNatalConfigurationsContainer',
            'solarNatalBalancesContainer', 'solarNatalRulersContainer',
            'solarToast',
        ].forEach((id) => {
            refs[id] = document.getElementById(id);
        });
    }

    function showError(message) {
        refs.solarErrorMsg.textContent = message || t('common.error', null, 'Error');
        refs.solarError.classList.remove('hidden');
        refs.solarLayout.classList.add('hidden');
        refs.solarSummaryBar?.classList.add('hidden');
        hideLoader();
    }

    function showToast(message, type = 'info') {
        if (!refs.solarToast || !message) return;
        refs.solarToast.textContent = message;
        refs.solarToast.className = `toast ${type}`;
        requestAnimationFrame(() => refs.solarToast.classList.add('visible'));
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => refs.solarToast.classList.remove('visible'), 2600);
    }

    function hideLoader() {
        refs.pageLoader?.classList.add('fade-out');
        setTimeout(() => refs.pageLoader?.remove(), 320);
    }

    function apiHeaders(headers = {}) {
        return window.AstroAPI?.withLocaleHeaders
            ? window.AstroAPI.withLocaleHeaders(headers)
            : headers;
    }

    async function apiPost(path, payload) {
        const response = await fetch(`${API_BASE}${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: apiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const data = await response.json();
                message = data?.detail || data?.message || message;
            } catch {
                message = await response.text().catch(() => message);
            }
            throw new Error(message);
        }
        return response.json();
    }

    async function loadNatalData() {
        let natalData = window.AstroAPI?.getChartFromSession?.();
        const userId = natalData?.user_id || localStorage.getItem('currentUserId');
        if ((!natalData || !natalData.planets) && userId && window.AstroAPI?.getNatalChart) {
            natalData = await window.AstroAPI.getNatalChart(userId);
            window.AstroAPI.saveChartToSession(natalData);
        }
        if (!natalData?.user_id) {
            throw new Error(t('page.clients.errors.chartNotFound', null, 'Chart not found'));
        }
        state.natalData = natalData;
        state.natalWheelData = prepareNatalPanelData(natalData);
        localStorage.setItem('currentUserId', natalData.user_id);
        return natalData;
    }

    function getStateStorageKey() {
        const id = state.natalData?.user_id || 'anonymous';
        return `${SOLAR_STATE_KEY_PREFIX}${id}`;
    }

    function readStoredSolarData() {
        const raw = sessionStorage.getItem(SOLAR_SESSION_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    function saveSolarData(data) {
        try {
            sessionStorage.setItem(SOLAR_SESSION_KEY, JSON.stringify(data));
        } catch {
            // Session storage is a convenience cache only.
        }
    }

    function readViewState() {
        try {
            const raw = localStorage.getItem(getStateStorageKey());
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function persistViewState() {
        try {
            localStorage.setItem(getStateStorageKey(), JSON.stringify({
                settings: state.settings,
                displayMode: state.displayMode,
                year: refs.solarYear?.value || '',
                name: refs.solarName?.value || '',
            }));
        } catch {
            // Local view state is optional.
        }
    }

    function updateHeader() {
        const birth = state.natalData?.birth_data || {};
        const name = [birth.first_name, birth.last_name].filter(Boolean).join(' ').trim();
        refs.solarTitle.textContent = name || t('page.forecast.tabs.solar', null, 'Solar');
        refs.solarSubtitle.textContent = [birth.date, birth.time, birth.place].filter(Boolean).join(' · ');
        const navState = window.AstroAPI?.getNavigationState?.() || {};
        refs.solarBackBtn.href = navState.sourceUrl || '/chart.html';
        window.AstroAPI?.patchNavigationState?.({
            currentView: 'solar',
            sourceUrl: '/solar.html',
            clientUserId: String(state.natalData?.user_id || ''),
            partnerUserId: navState.partnerUserId || null,
        });
        updateNatalPanelMeta();
    }

    function formatDateTime(value) {
        if (!value) return '';
        return window.LocaleFormatters?.formatDateTime?.(value) || String(value).replace('T', ' ');
    }

    function formatTimezone(value) {
        return window.Timezones?.formatOffsetLabel?.(value) || String(value || '');
    }

    function updateNatalPanelMeta() {
        const birth = state.natalData?.birth_data || {};
        if (!refs.solarNatalPanelMeta) return;
        refs.solarNatalPanelMeta.textContent = [birth.date || birth.birth_date, birth.time || birth.birth_time, birth.place || birth.birth_place]
            .filter(Boolean)
            .join(' · ');
    }

    function restoreLocation() {
        const stored = readLocationStorage(SOLAR_LOCATION_KEY) || readLocationStorage(LEGACY_SOLAR_LOCATION_KEY);
        if (stored?.lat != null && stored?.lon != null) {
            fillLocation(stored);
            return;
        }
        fillLocationFromNatal();
    }

    function readLocationStorage(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function fillLocation(data = {}) {
        refs.solarLocationName.value = data.name || '';
        refs.solarLocationLat.value = Number.isFinite(Number(data.lat)) ? String(Number(data.lat)) : '';
        refs.solarLocationLon.value = Number.isFinite(Number(data.lon)) ? String(Number(data.lon)) : '';
        refs.solarLocationSourceId.value = data.sourceId || data.source_id || '';
        refs.solarLocationTimezone.value = data.timezone || '';
        updateCoordsDisplay();
    }

    function fillLocationFromNatal() {
        const birth = state.natalData?.birth_data || {};
        fillLocation({
            name: birth.place || '',
            lat: birth.latitude,
            lon: birth.longitude,
            timezone: birth.timezone || '',
        });
    }

    function persistLocation() {
        const lat = Number.parseFloat(refs.solarLocationLat.value);
        const lon = Number.parseFloat(refs.solarLocationLon.value);
        const payload = {
            name: refs.solarLocationName.value.trim(),
            lat: Number.isFinite(lat) ? lat : null,
            lon: Number.isFinite(lon) ? lon : null,
            sourceId: refs.solarLocationSourceId.value.trim(),
            timezone: refs.solarLocationTimezone.value.trim(),
        };
        localStorage.setItem(SOLAR_LOCATION_KEY, JSON.stringify(payload));
    }

    function updateCoordsDisplay() {
        const lat = Number.parseFloat(refs.solarLocationLat.value);
        const lon = Number.parseFloat(refs.solarLocationLon.value);
        refs.solarCoordsDisplay.textContent = Number.isFinite(lat) && Number.isFinite(lon)
            ? `(${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`
            : '';
    }

    function initPlaceAutocomplete() {
        if (!window.PlaceAutocomplete || !refs.solarLocationName || !refs.solarPlaceSuggestions) return;
        window.PlaceAutocomplete.attach({
            input: refs.solarLocationName,
            suggestions: refs.solarPlaceSuggestions,
            minChars: 2,
            debounceMs: 350,
            limit: 5,
            getLabel: (item) => item.shortName || item.displayName,
            onInput: () => {
                refs.solarLocationLat.value = '';
                refs.solarLocationLon.value = '';
                refs.solarLocationSourceId.value = '';
                refs.solarLocationTimezone.value = '';
                updateCoordsDisplay();
                persistLocation();
            },
            onSelect: async (item) => {
                refs.solarLocationName.value = item.shortName || item.displayName || '';
                refs.solarLocationLat.value = item.lat;
                refs.solarLocationLon.value = item.lon;
                refs.solarLocationSourceId.value = item.sourceId || '';
                refs.solarLocationTimezone.value = '';
                updateCoordsDisplay();
                if (item.sourceId && window.AstroAPI?.resolvePlaceTimezone) {
                    const timezone = await window.AstroAPI.resolvePlaceTimezone(item.sourceId).catch(() => null);
                    refs.solarLocationTimezone.value = timezone || '';
                }
                persistLocation();
            },
        });
    }

    function populateTimezoneOptions() {
        if (!refs.solarLocationTimezone) return;
        const selected = refs.solarLocationTimezone.value || '';
        window.Timezones?.populate?.(refs.solarLocationTimezone);
        if (selected) refs.solarLocationTimezone.value = selected;
    }

    function parseNatalBirthday() {
        const birth = state.natalData?.birth_data || {};
        const value = birth.date || birth.birth_date || '';
        const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        return {
            month: Number(match[2]),
            day: Number(match[3]),
        };
    }

    function birthdayDateForYear(year, birthday) {
        if (!birthday) return null;
        const date = new Date(year, birthday.month - 1, birthday.day);
        if (date.getMonth() === birthday.month - 1) return date;
        return new Date(year, 1, 28);
    }

    function defaultYear() {
        const now = new Date();
        const birthday = parseNatalBirthday();
        if (!birthday) return now.getFullYear();
        const currentYearBirthday = birthdayDateForYear(now.getFullYear(), birthday);
        const previousYear = currentYearBirthday && currentYearBirthday > now
            ? now.getFullYear() - 1
            : now.getFullYear();
        const futureYear = currentYearBirthday && currentYearBirthday > now
            ? now.getFullYear()
            : now.getFullYear() + 1;
        const previous = birthdayDateForYear(previousYear, birthday);
        const future = birthdayDateForYear(futureYear, birthday);
        const previousDiff = previous ? Math.abs(now.getTime() - previous.getTime()) : Number.POSITIVE_INFINITY;
        const futureDiff = future ? Math.abs(future.getTime() - now.getTime()) : Number.POSITIVE_INFINITY;
        return futureDiff < previousDiff ? futureYear : previousYear;
    }

    function applyInitialForm() {
        const storedView = readViewState();
        const solarData = readStoredSolarData();
        const solarInfo = solarData?.solar_info || {};
        refs.solarYear.value = String(solarInfo.year || storedView.year || localStorage.getItem('forecastSolarYear') || defaultYear());
        refs.solarName.value = solarData?.name || storedView.name || '';

        if (solarInfo.location) {
            fillLocation({
                name: solarInfo.location.name || '',
                lat: solarInfo.location.latitude,
                lon: solarInfo.location.longitude,
                timezone: solarInfo.timezone || '',
            });
        } else {
            restoreLocation();
        }

        if (storedView.settings) {
            state.settings = normalizeSettings({
                ...state.settings,
                ...storedView.settings,
            });
        }
        state.displayMode = normalizeDisplayMode(storedView.displayMode || state.displayMode);
        syncDisplayModeControls();
        syncSettingsControls();
        if (solarData?.planets) {
            renderSolar(solarData, { hydratePreferences: true });
        } else {
            calculateSolar({ saveToDb: false, showSuccess: false }).catch((error) => {
                console.warn('Initial solar calculation failed:', error);
                setEmptyState();
            });
        }
    }

    function normalizeDisplayMode(value) {
        return ['both', 'natal', 'solar'].includes(value) ? value : 'both';
    }

    function syncDisplayModeControls() {
        document.querySelectorAll('input[name="solarDisplayMode"]').forEach((input) => {
            input.checked = input.value === state.displayMode;
        });
    }

    function normalizeSettings(settings = {}) {
        const aspectScope = ['all', 'major', 'minor'].includes(settings.aspectScope) ? settings.aspectScope : 'major';
        return {
            houseSystem: normalizeHouseSystemCode(settings.houseSystem),
            orientation: settings.orientation === 'asc' ? 'asc' : 'aries',
            aspectScope,
            enabledAspectTypes: window.AstroPreferences?.healEnabledAspectTypesForScope
                ? window.AstroPreferences.healEnabledAspectTypesForScope(
                    settings.enabledAspectTypes || DEFAULT_ASPECT_TYPES,
                    aspectScope,
                    DEFAULT_ASPECT_TYPES,
                )
                : (settings.enabledAspectTypes || DEFAULT_ASPECT_TYPES),
            matrixRows: window.AstroPreferences?.ensureMatrixRows?.(settings.matrixRows || {}) || (settings.matrixRows || {}),
            pointScale: Math.max(0.8, Math.min(1.7, Number(settings.pointScale) || 1)),
            showApplyingSeparating: settings.showApplyingSeparating === true,
            aspectPhaseFilter: normalizeAspectPhaseFilter(settings.aspectPhaseFilter),
            showSpeed: settings.showSpeed !== false,
            showStationary: settings.showStationary !== false,
            showAspectText: settings.showAspectText === true,
            showWheelStationary: settings.showWheelStationary === true,
            showWheelDegree: settings.showWheelDegree === true,
            houseNumberStyle: settings.houseNumberStyle === 'roman' ? 'roman' : 'arabic',
            houseLabelsOutside: settings.houseLabelsOutside === true,
            angleAscDscBold: settings.angleAscDscBold !== false,
            angleMcIcBold: settings.angleMcIcBold !== false,
        };
    }

    function viewSettingsToPageSettings(view = {}) {
        return normalizeSettings({
            houseSystem: view?.chart_meta?.house_system || view?.view_options?.house_system || view?.house_system || 'P',
            orientation: view?.view_options?.orientation,
            aspectScope: view?.aspects?.scope,
            enabledAspectTypes: view?.aspects?.enabled_types,
            matrixRows: view?.matrix?.rows,
            pointScale: view?.view_options?.point_scale || 1,
            showApplyingSeparating: view?.aspects?.show_applying_separating,
            aspectPhaseFilter: view?.aspects?.phase_filter || view?.aspects?.aspect_phase_filter,
            showSpeed: view?.table_options?.show_speed,
            showStationary: view?.table_options?.show_stationary,
            showAspectText: view?.table_options?.show_aspect_text,
            showWheelStationary: view?.view_options?.show_planet_stationary,
            showWheelDegree: view?.view_options?.show_planet_degree,
            houseNumberStyle: view?.view_options?.house_number_style,
            houseLabelsOutside: view?.view_options?.house_labels_outside,
            angleAscDscBold: view?.view_options?.bold_asc_dsc,
            angleMcIcBold: view?.view_options?.bold_mc_ic,
        });
    }

    function buildViewSettings() {
        return {
            view_options: {
                house_system: state.settings.houseSystem,
                orientation: state.settings.orientation,
                point_scale: state.settings.pointScale,
                house_number_style: state.settings.houseNumberStyle,
                house_labels_outside: state.settings.houseLabelsOutside === true,
                show_planet_stationary: state.settings.showWheelStationary === true,
                show_planet_degree: state.settings.showWheelDegree === true,
                bold_asc_dsc: state.settings.angleAscDscBold !== false,
                bold_mc_ic: state.settings.angleMcIcBold !== false,
            },
            aspects: {
                scope: state.settings.aspectScope,
                enabled_types: state.settings.enabledAspectTypes,
                show_applying_separating: state.settings.showApplyingSeparating === true,
                phase_filter: [...normalizeAspectPhaseFilter(state.settings.aspectPhaseFilter)],
            },
            matrix: {
                rows: state.settings.matrixRows,
            },
            table_options: {
                show_speed: state.settings.showSpeed !== false,
                show_stationary: state.settings.showStationary !== false,
                show_aspect_text: state.settings.showAspectText === true,
            },
        };
    }

    async function hydratePreferences() {
        if (!state.solarData?.solar_id || !window.AstroAPI?.getResolvedPreferences) return;
        const payload = await window.AstroAPI.getResolvedPreferences({
            chart_kind: 'solar',
            chart_id: state.solarData.solar_id,
            view_type: 'solar',
        }).catch(() => null);
        if (!payload) return;
        state.resolvedPreferences = payload;
        state.settings = viewSettingsToPageSettings(payload.resolved || {});
        syncSettingsControls();
    }

    function syncSettingsControls() {
        if (refs.solarOrientationSelect) refs.solarOrientationSelect.value = state.settings.orientation;
        if (refs.solarHouseSystemSelect) refs.solarHouseSystemSelect.value = state.settings.houseSystem;
        refs.solarAspectScopeSelect.value = state.settings.aspectScope;
        refs.solarPointScaleRange.value = String(Math.round(state.settings.pointScale * 100));
        refs.solarPointScaleValue.textContent = `${Math.round(state.settings.pointScale * 100)}%`;
        const aspectPhaseFilter = normalizeAspectPhaseFilter(state.settings.aspectPhaseFilter);
        refs.solarAspectPhaseApplyingToggle.checked = aspectPhaseFilter.includes('applying');
        refs.solarAspectPhaseSeparatingToggle.checked = aspectPhaseFilter.includes('separating');
        if (refs.solarHouseNumberStyleSelect) refs.solarHouseNumberStyleSelect.value = state.settings.houseNumberStyle;
        if (refs.solarHouseLabelsOutsideToggle) refs.solarHouseLabelsOutsideToggle.checked = state.settings.houseLabelsOutside === true;
        refs.solarShowWheelStationaryToggle.checked = state.settings.showWheelStationary === true;
        refs.solarShowWheelDegreeToggle.checked = state.settings.showWheelDegree === true;
        refs.solarShowApplyingSeparatingToggle.checked = state.settings.showApplyingSeparating === true;
        refs.solarShowSpeedToggle.checked = state.settings.showSpeed !== false;
        refs.solarShowStationaryToggle.checked = state.settings.showStationary !== false;
        if (refs.solarShowAspectTextToggle) refs.solarShowAspectTextToggle.checked = state.settings.showAspectText === true;
        if (refs.solarAngleAscDscBoldToggle) refs.solarAngleAscDscBoldToggle.checked = state.settings.angleAscDscBold !== false;
        if (refs.solarAngleMcIcBoldToggle) refs.solarAngleMcIcBoldToggle.checked = state.settings.angleMcIcBold !== false;
        renderAspectTypeToggles();
        renderMatrixEditor();
    }

    function renderAspectTypeToggles() {
        if (!refs.solarAspectTypeToggles) return;
        const active = new Set(state.settings.enabledAspectTypes || []);
        refs.solarAspectTypeToggles.innerHTML = DEFAULT_ASPECT_TYPES.map((type) => {
            const label = window.Symbols?.getAspectDisplay?.(type) || type;
            const title = t(`astro.aspect.${type}`, null, type);
            return `
                <label class="settings-check-option settings-check-option--pill settings-check-option--icon-only" title="${escapeHtml(title)}">
                    <input type="checkbox" data-solar-aspect-type="${escapeHtml(type)}" ${active.has(type) ? 'checked' : ''} aria-label="${escapeHtml(title)}">
                    <span class="settings-check-option-glyph" aria-hidden="true"><span class="astro-symbol">${escapeHtml(label)}</span></span>
                </label>
            `;
        }).join('');
    }

    function matrixBodyLabel(body) {
        return window.Symbols?.getPlanetSymbolMarkup?.(body, { className: 'solar-matrix-symbol' })
            || escapeHtml(window.Symbols?.getPlanetSymbol?.(body) || body);
    }

    function renderMatrixEditor() {
        if (!refs.solarMatrixEditor) return;
        const rows = window.AstroPreferences?.ensureMatrixRows?.(state.settings.matrixRows || {}) || {};
        refs.solarMatrixEditor.innerHTML = `
            <table class="natal-matrix-table solar-matrix-table">
                <thead>
                    <tr>
                        <th>Body</th>
                        <th>${escapeHtml(t('page.accountSettings.matrix.columns.display', null, 'Display'))}</th>
                        <th>${escapeHtml(t('page.accountSettings.matrix.columns.aspecting', null, 'Aspecting'))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${MATRIX_BODIES.map((body) => {
                        const normalized = window.AstroPreferences?.normalizeMatrixBodyName?.(body) || body;
                        const row = rows[normalized] || { display: true, aspecting: true };
                        const label = escapeHtml(body);
                        return `
                            <tr data-solar-matrix-body="${escapeHtml(normalized)}">
                                <td><span class="natal-matrix-body natal-matrix-body--icon-only" title="${label}" aria-label="${label}">${matrixBodyLabel(body)}</span></td>
                                <td><label class="natal-matrix-check"><input type="checkbox" data-solar-matrix-field="display" ${row.display !== false ? 'checked' : ''}></label></td>
                                <td><label class="natal-matrix-check"><input type="checkbox" data-solar-matrix-field="aspecting" ${row.aspecting !== false ? 'checked' : ''}></label></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function readSettingsControls() {
        const previousHouseSystem = state.settings.houseSystem;
        const rows = window.AstroPreferences?.ensureMatrixRows?.(state.settings.matrixRows || {}) || {};
        refs.solarMatrixEditor?.querySelectorAll('[data-solar-matrix-body]').forEach((rowEl) => {
            const body = rowEl.dataset.solarMatrixBody;
            rows[body] = {
                display: rowEl.querySelector('[data-solar-matrix-field="display"]')?.checked !== false,
                aspecting: rowEl.querySelector('[data-solar-matrix-field="aspecting"]')?.checked !== false,
            };
        });
        const enabledAspectTypes = [...refs.solarAspectTypeToggles.querySelectorAll('[data-solar-aspect-type]')]
            .filter((input) => input.checked)
            .map((input) => input.dataset.solarAspectType);

        state.settings = normalizeSettings({
            ...state.settings,
            houseSystem: state.settings.houseSystem,
            orientation: state.settings.orientation,
            aspectScope: refs.solarAspectScopeSelect.value,
            pointScale: Number(refs.solarPointScaleRange.value) / 100,
            matrixRows: rows,
            enabledAspectTypes,
            showApplyingSeparating: refs.solarShowApplyingSeparatingToggle.checked,
            aspectPhaseFilter: [
                refs.solarAspectPhaseApplyingToggle.checked ? 'applying' : null,
                refs.solarAspectPhaseSeparatingToggle.checked ? 'separating' : null,
            ],
            showSpeed: refs.solarShowSpeedToggle.checked,
            showStationary: refs.solarShowStationaryToggle.checked,
            showAspectText: state.settings.showAspectText === true,
            showWheelStationary: refs.solarShowWheelStationaryToggle.checked,
            showWheelDegree: refs.solarShowWheelDegreeToggle.checked,
            houseNumberStyle: state.settings.houseNumberStyle,
            houseLabelsOutside: state.settings.houseLabelsOutside === true,
            angleAscDscBold: state.settings.angleAscDscBold !== false,
            angleMcIcBold: state.settings.angleMcIcBold !== false,
        });
        state.natalWheelData = prepareNatalPanelData(state.natalData);
        syncSettingsControls();
        persistViewState();
        if (state.solarData && previousHouseSystem !== state.settings.houseSystem) {
            calculateSolar({ saveToDb: Boolean(state.solarData.solar_id), showSuccess: false })
                .catch((error) => showToast(error.message, 'error'));
        } else if (state.solarData) {
            renderSolar(state.solarData, { hydratePreferences: false });
        }
        schedulePersistSolarAccountDefaults();
    }

    let solarAccountPersistTimer = null;
    function schedulePersistSolarAccountDefaults() {
        clearTimeout(solarAccountPersistTimer);
        solarAccountPersistTimer = setTimeout(() => {
            solarAccountPersistTimer = null;
            persistSolarAccountDefaults().catch((err) => {
                console.warn('Failed to persist solar account defaults:', err);
            });
        }, 400);
    }

    async function persistSolarAccountDefaults() {
        if (!window.AstroAPI?.patchAccountPreferences) return;
        const resolved = buildViewSettings();
        await window.AstroAPI.patchAccountPreferences({
            chart_defaults: { solar: resolved },
        });
        if (state.solarData?.solar_id && window.AstroAPI?.deleteChartViewOverride) {
            await window.AstroAPI.deleteChartViewOverride({
                chart_kind: 'solar',
                chart_id: state.solarData.solar_id,
                view_type: 'solar',
            }).catch(() => null);
        }
        if (state.resolvedPreferences) {
            state.resolvedPreferences = {
                ...state.resolvedPreferences,
                account_defaults: resolved,
                overrides: {},
                resolved,
            };
        }
    }

    function getMatrixRow(body) {
        const normalized = window.AstroPreferences?.normalizeMatrixBodyName?.(body) || body;
        return state.settings.matrixRows?.[normalized] || { display: true, aspecting: true };
    }

    function filterChartData(data) {
        const enabled = new Set(state.settings.enabledAspectTypes || []);
        const hasExplicitAspectTypes = Array.isArray(state.settings.enabledAspectTypes);
        const planets = (data.planets || []).filter((planet) => getMatrixRow(planet.name).display !== false);
        const visible = new Set(planets.map((planet) => window.AstroPreferences?.normalizeMatrixBodyName?.(planet.name) || planet.name));
        const aspects = (data.aspects || []).filter((aspect) => {
            if (state.settings.aspectScope === 'major' && aspect.is_major === false) return false;
            if (state.settings.aspectScope === 'minor' && aspect.is_major !== false) return false;
            if (hasExplicitAspectTypes && !enabled.has(aspect.aspect_type)) return false;
            const first = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_1) || aspect.planet_1;
            const second = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_2) || aspect.planet_2;
            if (!visible.has(first) || !visible.has(second)) return false;
            return getMatrixRow(first).aspecting !== false && getMatrixRow(second).aspecting !== false;
        }).filter(aspectMatchesPhaseFilter);
        return {
            ...data,
            planets,
            aspects,
        };
    }

    function aspectAllowedBySettings(aspect, primaryBody, secondaryBody = null) {
        const enabled = new Set(state.settings.enabledAspectTypes || []);
        const hasExplicitAspectTypes = Array.isArray(state.settings.enabledAspectTypes);
        if (state.settings.aspectScope === 'major' && aspect.is_major === false) return false;
        if (state.settings.aspectScope === 'minor' && aspect.is_major !== false) return false;
        if (hasExplicitAspectTypes && !enabled.has(aspect.aspect_type)) return false;
        if (primaryBody && getMatrixRow(primaryBody).aspecting === false) return false;
        if (secondaryBody && getMatrixRow(secondaryBody).aspecting === false) return false;
        return aspectMatchesPhaseFilter(aspect);
    }

    function filterSolarPanelData(data = {}) {
        const planets = (data.planets || []).filter((planet) => getMatrixRow(planet.name).display !== false);
        const visibleSolar = new Set(planets.map((planet) => window.AstroPreferences?.normalizeMatrixBodyName?.(planet.name) || planet.name));
        const aspects = (data.aspects || []).filter((aspect) => {
            const first = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_1 || aspect.left_planet) || aspect.planet_1 || aspect.left_planet;
            const second = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_2 || aspect.right_planet) || aspect.planet_2 || aspect.right_planet;
            return visibleSolar.has(first) && visibleSolar.has(second) && aspectAllowedBySettings(aspect, first, second);
        });
        return {
            ...data,
            planets,
            aspects,
        };
    }

    function filterSolarViewModel(viewModel) {
        if (!viewModel) return viewModel;
        const natalLayer = viewModel.natalLayer
            ? {
                ...viewModel.natalLayer,
                bodies: (viewModel.natalLayer.bodies || []).filter((body) => getMatrixRow(body.name).display !== false),
            }
            : null;
        const hasNatalLayer = Boolean(viewModel.natalLayer);
        const activePrognosticLayers = (viewModel.activePrognosticLayers || []).map((layer) => {
            const bodies = (layer.bodies || []).filter((body) => getMatrixRow(body.name).display !== false);
            const visibleSolar = new Set(bodies.map((body) => window.AstroPreferences?.normalizeMatrixBodyName?.(body.name) || body.name));
            const aspects = (layer.aspects || []).filter((aspect) => {
                const solarBody = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_1 || aspect.left_planet) || aspect.planet_1 || aspect.left_planet;
                const natalBody = window.AstroPreferences?.normalizeMatrixBodyName?.(aspect.planet_2 || aspect.right_planet) || aspect.planet_2 || aspect.right_planet;
                if (!visibleSolar.has(solarBody)) return false;
                if (!hasNatalLayer && !visibleSolar.has(natalBody)) return false;
                return aspectAllowedBySettings(aspect, solarBody, natalBody);
            });
            return { ...layer, bodies, aspects };
        });
        return { ...viewModel, natalLayer, activePrognosticLayers };
    }

    function prepareNatalPanelData(natalData) {
        if (!natalData) return natalData;
        const houseSystem = state.settings.houseSystem || natalData?.birth_data?.house_system || 'P';
        return window.NatalWheelData?.prepareNatalWheelData
            ? window.NatalWheelData.prepareNatalWheelData(natalData, { houseSystem })
            : natalData;
    }

    function renderNatalPanel() {
        if (!state.natalRenderer || !state.natalData) return;
        const natalPanelData = state.natalWheelData || prepareNatalPanelData(state.natalData);
        const sourceData = window.AstroAspectPhase?.enrichChartDataWithAspectPhases
            ? window.AstroAspectPhase.enrichChartDataWithAspectPhases(natalPanelData)
            : natalPanelData;
        const filtered = filterChartData(sourceData);
        state.natalRenderer.setAspectTypeFilter?.(state.settings.aspectScope);
        state.natalRenderer.setHouseNumberStyle?.(state.settings.houseNumberStyle);
        state.natalRenderer.setDisplayPreferences?.({
            showSpeed: state.settings.showSpeed,
            showStationary: state.settings.showStationary,
            showApplyingSeparating: state.settings.showApplyingSeparating,
            showAspectText: state.settings.showAspectText,
        });
        state.natalRenderer.render({
            ...filtered,
            houses: natalPanelData.houses || [],
            aspect_configurations: natalPanelData.aspect_configurations || [],
            stelliums: natalPanelData.stelliums || [],
            balances: natalPanelData.balances || null,
            cosmogram_pattern: natalPanelData.cosmogram_pattern || null,
        });
        window.DispositorChains?.render?.('solarNatalRulersContainer', natalPanelData, {
            selectId: 'solarNatalRulersModeSelect',
            layout: 'tabs',
        });
    }

    function setEmptyState() {
        refs.solarLayout.classList.remove('hidden');
        refs.solarSummaryBar?.classList.remove('hidden');
        refs.solarStatusLabel.textContent = t('page.forecast.solar.empty', null, '');
        clearSummary();
        renderNatalPanel();
        state.renderer?.render({
            planets: [], houses: [], aspects: [], aspect_configurations: [],
            stelliums: [], balances: null, cosmogram_pattern: null,
        });
        refs.solarRulersContainer.innerHTML = '';
        hideLoader();
    }

    function clearSummary() {
        ['summaryAsc', 'summaryMc', 'summarySun', 'summaryMoon', 'summaryPattern', 'summaryDominants'].forEach((id) => {
            if (refs[id]) refs[id].textContent = '—';
        });
    }

    async function calculateSolar(options = {}) {
        const { saveToDb = true, showSuccess = true } = options;
        const year = Number.parseInt(refs.solarYear.value, 10);
        const lat = Number.parseFloat(refs.solarLocationLat.value);
        const lon = Number.parseFloat(refs.solarLocationLon.value);
        if (!Number.isInteger(year) || year < 1900 || year > 2100) {
            throw new Error(t('page.forecast.errors.yearRange', null, 'Year must be between 1900 and 2100'));
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            throw new Error(t('page.forecast.errors.selectLocationFromList', null, 'Select a location from the list'));
        }
        const payload = {
            user_id: state.natalData.user_id,
            year,
            house_system: state.settings.houseSystem || 'P',
            save_to_db: saveToDb === true,
            location_latitude: lat,
            location_longitude: lon,
            location_name: refs.solarLocationName.value.trim(),
            location_source_id: refs.solarLocationSourceId.value.trim() || null,
            location_timezone: refs.solarLocationTimezone.value.trim() || null,
        };
        const name = refs.solarName.value.trim();
        if (name) payload.name = name;
        refs.solarCalculateBtn.disabled = true;
        refs.solarStatusLabel.textContent = t('page.forecast.solar.loading', null, 'Loading');
        try {
            const data = await apiPost('/solar/calculate', payload);
            persistLocation();
            localStorage.setItem('forecastSolarYear', String(year));
            await renderSolar(data, { hydratePreferences: true });
            if (showSuccess) showToast(t('page.clientProfile.solar.renamed', null, 'Saved'), 'success');
        } finally {
            refs.solarCalculateBtn.disabled = false;
        }
    }

    async function renderSolar(data, { hydratePreferences = false } = {}) {
        state.solarData = data;
        saveSolarData(data);
        if (hydratePreferences) await hydratePreferencesForRender();
        state.settings = normalizeSettings({
            ...state.settings,
            houseSystem: data?.solar_info?.house_system || state.settings.houseSystem,
        });
        state.natalWheelData = prepareNatalPanelData(state.natalData);
        syncSettingsControls();
        refs.solarLayout.classList.remove('hidden');
        refs.solarSummaryBar?.classList.remove('hidden');
        refs.solarStatusLabel.textContent = buildSolarStatus(data);
        refs.solarPanelMeta.textContent = buildSolarStatus(data);
        updateNatalPanelMeta();
        updateInfoFromSolar(data);
        updateSummary(data);
        renderWheel(data);
        renderPanels(data);
        hideLoader();
    }

    async function hydratePreferencesForRender() {
        await hydratePreferences();
    }

    function buildSolarStatus(data) {
        const info = data?.solar_info || {};
        return [info.year, formatDateTime(info.solar_datetime_local), formatTimezone(info.timezone)]
            .filter(Boolean)
            .join(' · ');
    }

    function updateInfoFromSolar(data) {
        const info = data?.solar_info || {};
        if (info.year) refs.solarYear.value = String(info.year);
        if (data?.name) refs.solarName.value = data.name;
        if (info.location) {
            fillLocation({
                name: info.location.name || '',
                lat: info.location.latitude,
                lon: info.location.longitude,
                timezone: info.timezone || '',
            });
        }
    }

    function coordinate(item) {
        return window.LocaleFormatters?.formatAstroCoordinate?.(item, {
            signSymbol: window.Symbols?.signs?.[item?.sign] || item?.sign,
            signClass: 'astro-symbol',
            emptyValue: '—',
        }) || '—';
    }

    function astroName(type, name) {
        const key = `astro.${type}.${name}`;
        const translated = window.FrontendI18n?.t?.(key);
        if (translated && translated !== key) return translated;
        if (type === 'planet') return window.Symbols?.getPlanetNameRu?.(name) || window.Symbols?.planetNamesRu?.[name] || name;
        if (type === 'sign') return window.Symbols?.signNamesRu?.[name] || name;
        return name || '—';
    }

    function patternName(pattern) {
        if (!pattern?.pattern_type) return '—';
        const key = `astro.pattern.${pattern.pattern_type}`;
        const translated = window.FrontendI18n?.t?.(key);
        return translated && translated !== key ? translated : pattern.pattern_type;
    }

    function maxBalance(balance = {}) {
        let best = null;
        Object.entries(balance || {}).forEach(([key, value]) => {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return;
            if (!best || numeric > best.value) best = { key, value: numeric };
        });
        return best;
    }

    function updateSummary(data) {
        if (!refs.summaryAsc) return;
        const planets = data.planets || [];
        refs.summaryAsc.innerHTML = data.angles?.ASC ? coordinate(data.angles.ASC) : '—';
        refs.summaryMc.innerHTML = data.angles?.MC ? coordinate(data.angles.MC) : '—';
        refs.summarySun.innerHTML = coordinate(planets.find((planet) => planet.name === 'Sun'));
        refs.summaryMoon.innerHTML = coordinate(planets.find((planet) => planet.name === 'Moon'));
        refs.summaryPattern.textContent = patternName(data.cosmogram_pattern);

        const parts = [];
        const bySign = data.balances?.by_sign || {};
        const element = maxBalance(bySign.element_balance);
        const mode = maxBalance(bySign.mode_balance);
        if (element) parts.push(`${element.key} ${Math.round(element.value)}`);
        if (mode) parts.push(`${mode.key} ${Math.round(mode.value)}`);
        refs.summaryDominants.textContent = parts.join(' · ') || '—';
    }

    function renderWheel(data) {
        if (!state.wheel) {
            state.wheel = new window.PrognosticRingsWheel(refs.solarWheel);
        }
        const sourceData = window.AstroAspectPhase?.enrichChartDataWithAspectPhases
            ? window.AstroAspectPhase.enrichChartDataWithAspectPhases(data)
            : data;
        const includeNatal = state.displayMode !== 'solar';
        const includeSolar = state.displayMode !== 'natal';
        const rawViewModel = window.PrognosticLayerNormalizer.buildViewModel(
            state.natalWheelData || prepareNatalPanelData(state.natalData),
            includeSolar ? { solar_return: sourceData } : {},
            { activeMethods: includeSolar ? ['solar_return'] : [] },
        );
        if (!includeNatal && includeSolar && rawViewModel.activePrognosticLayers?.[0]) {
            rawViewModel.activePrognosticLayers[0] = {
                ...rawViewModel.activePrognosticLayers[0],
                aspects: (sourceData.aspects || []).map((aspect) => ({
                    ...aspect,
                    left_planet: aspect.left_planet || aspect.planet_1,
                    right_planet: aspect.right_planet || aspect.planet_2,
                    method: 'solar_return',
                })),
            };
        }
        const viewModel = filterSolarViewModel({
            ...rawViewModel,
            natalLayer: includeNatal ? rawViewModel.natalLayer : null,
        });
        state.wheel.setOptions({
            orientation: state.settings.orientation,
            natalMatrixRows: state.settings.matrixRows,
            prognosticMatrixRows: state.settings.matrixRows,
            matrixRows: state.settings.matrixRows,
            planetScale: state.settings.pointScale,
            pointScale: state.settings.pointScale,
            aspectScope: state.settings.aspectScope,
            enabledAspectTypes: state.settings.enabledAspectTypes,
            houseNumberStyle: state.settings.houseNumberStyle,
            houseLabelsOutside: state.settings.houseLabelsOutside,
            showPlanetStationary: state.settings.showWheelStationary,
            showPlanetDegree: state.settings.showWheelDegree,
            showAspectText: state.settings.showAspectText === true,
            angleAscDscBold: state.settings.angleAscDscBold,
            angleMcIcBold: state.settings.angleMcIcBold,
            minimumRingCount: 2,
            alignSingleRingOuter: includeNatal !== includeSolar,
            visualPreferences: state.accountPreferences?.visual || null,
        });
        state.wheel.render(viewModel);
        resetView();
    }

    function renderPanels(data) {
        renderNatalPanel();
        const sourceData = window.AstroAspectPhase?.enrichChartDataWithAspectPhases
            ? window.AstroAspectPhase.enrichChartDataWithAspectPhases(data)
            : data;
        const filtered = filterSolarPanelData(sourceData);
        state.renderer.setAspectTypeFilter?.(state.settings.aspectScope);
        state.renderer.setHouseNumberStyle?.(state.settings.houseNumberStyle);
        state.renderer.setDisplayPreferences?.({
            showSpeed: state.settings.showSpeed,
            showStationary: state.settings.showStationary,
            showApplyingSeparating: state.settings.showApplyingSeparating,
            showAspectText: state.settings.showAspectText,
        });
        state.renderer.render({
            ...filtered,
            houses: data.houses || [],
            aspect_configurations: data.aspect_configurations || [],
            stelliums: data.stelliums || [],
            balances: data.balances || null,
            cosmogram_pattern: data.cosmogram_pattern || null,
        });
        window.DispositorChains?.render?.('solarRulersContainer', data, {
            selectId: 'solarRulersModeSelect',
            layout: 'tabs',
        });
    }

    function initRenderer() {
        state.natalRenderer = new window.ChartDataRenderer({
            planetsTableId: 'solarNatalPlanetsTable',
            housesTableId: 'solarNatalHousesTable',
            aspectsTableId: 'solarNatalAspectsTable',
            aspectGridContainerId: 'solarNatalAspectGridContainer',
            configsContainerId: 'solarNatalConfigurationsContainer',
            balancesContainerId: 'solarNatalBalancesContainer',
            aspectSortHeadersSelector: '#solarNatalAspectsView th.sortable[data-sort]',
        });
        state.renderer = new window.ChartDataRenderer({
            planetsTableId: 'solarPlanetsTable',
            housesTableId: 'solarHousesTable',
            aspectsTableId: 'solarAspectsTable',
            aspectGridContainerId: 'solarAspectGridContainer',
            configsContainerId: 'solarConfigurationsContainer',
            balancesContainerId: 'solarBalancesContainer',
            aspectSortHeadersSelector: '#solarAspectsView th.sortable[data-sort]',
        });
    }

    function initPanelTabs() {
        document.querySelectorAll('[data-panel-target]').forEach((button) => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.panelTarget;
                const scope = button.closest('.side-panel') || document;
                scope.querySelectorAll('[data-panel-target]').forEach((item) => {
                    item.classList.toggle('active', item === button);
                });
                scope.querySelectorAll('.panel-tab-content').forEach((pane) => {
                    pane.classList.toggle('active', pane.id === targetId);
                });
            });
        });
    }

    function applyViewBox() {
        const width = VIEWBOX_SIZE / state.zoom;
        const height = VIEWBOX_SIZE / state.zoom;
        const cx = VIEWBOX_SIZE / 2 + state.panX;
        const cy = VIEWBOX_SIZE / 2 + state.panY;
        refs.solarWheel.setAttribute('viewBox', `${cx - width / 2} ${cy - height / 2} ${width} ${height}`);
    }

    function resetView() {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        refs.solarWheel.setAttribute('viewBox', `0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`);
    }

    function initZoomPan() {
        const blocked = (target) => target instanceof Element && target.closest('button, input, select, textarea, .settings-panel');
        refs.solarZoomIn.addEventListener('click', () => {
            state.zoom = Math.min(ZOOM_MAX, state.zoom + ZOOM_STEP * 2);
            applyViewBox();
        });
        refs.solarZoomOut.addEventListener('click', () => {
            state.zoom = Math.max(ZOOM_MIN, state.zoom - ZOOM_STEP * 2);
            applyViewBox();
        });
        refs.solarZoomReset.addEventListener('click', resetView);
        refs.solarWheelWrapper.addEventListener('wheel', (event) => {
            if (blocked(event.target)) return;
            event.preventDefault();
            state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
            applyViewBox();
        }, { passive: false });
        refs.solarWheelWrapper.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || blocked(event.target)) return;
            state.panning = true;
            state.panStartX = event.clientX;
            state.panStartY = event.clientY;
        });
        window.addEventListener('mousemove', (event) => {
            if (!state.panning) return;
            const scale = VIEWBOX_SIZE / (state.zoom * (refs.solarWheelWrapper.clientWidth || VIEWBOX_SIZE));
            state.panX -= (event.clientX - state.panStartX) * scale;
            state.panY -= (event.clientY - state.panStartY) * scale;
            state.panStartX = event.clientX;
            state.panStartY = event.clientY;
            applyViewBox();
        });
        window.addEventListener('mouseup', () => { state.panning = false; });
    }

    async function saveSolarChart() {
        const year = Number.parseInt(refs.solarYear.value, 10);
        const defaultName = refs.solarName.value.trim() || `Соляр ${Number.isInteger(year) ? year : ''}`.trim();
        const name = window.prompt(t('page.clientProfile.savedCharts.namePrompt', null, 'Название карты'), defaultName);
        if (name === null) return;
        refs.solarName.value = name.trim();
        await calculateSolar({ saveToDb: true, showSuccess: false });
        showToast(t('page.clientProfile.savedCharts.renamed', null, 'Карта сохранена'), 'success');
    }

    function bindEvents() {
        initSolarActionsMenu();

        refs.solarCalculateBtn.addEventListener('click', () => {
            calculateSolar({ saveToDb: false }).catch((error) => {
                console.error('Solar calculation failed:', error);
                showToast(t('common.errorWithMessage', { message: error.message }, error.message), 'error');
                refs.solarStatusLabel.textContent = t('common.error', null, 'Error');
            });
        });
        refs.solarMomentToggle?.addEventListener('click', () => {
            const isOpen = refs.solarMomentCard?.classList.contains('hidden');
            refs.solarMomentCard?.classList.toggle('hidden', !isOpen);
            refs.solarMomentToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
        refs.solarSavedChartsBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            window.AstroQuickOpen?.openSavedCharts?.({
                userId: state.natalData?.user_id,
                sourceView: 'solar',
                sourceUrl: `/solar.html${window.location.search || ''}`,
            });
        });
        refs.solarSaveChartBtn?.addEventListener('click', () => {
            saveSolarChart().catch((error) => showToast(error.message, 'error'));
        });
        document.querySelectorAll('input[name="solarDisplayMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                state.displayMode = normalizeDisplayMode(input.value);
                persistViewState();
                if (state.solarData) renderWheel(state.solarData);
            });
        });
        ['solarYear', 'solarName', 'solarLocationTimezone', 'solarLocationName', 'solarLocationLat', 'solarLocationLon'].forEach((id) => {
            refs[id]?.addEventListener('change', () => {
                updateCoordsDisplay();
                persistLocation();
                persistViewState();
            });
            refs[id]?.addEventListener('input', () => {
                updateCoordsDisplay();
                if (id === 'solarLocationName') {
                    refs.solarLocationSourceId.value = '';
                }
            });
        });
        refs.solarSettingsToggle.addEventListener('click', () => {
            refs.solarSettingsPanel.classList.toggle('hidden');
        });
        if (refs.solarSettingsPanel && window.ChartConfigPresets) {
            window.ChartConfigPresets.attach({
                container: refs.solarSettingsPanel,
                viewType: 'solar',
                getSettings: () => buildViewSettings(),
                applySettings: async (resolvedView) => {
                    state.settings = viewSettingsToPageSettings(resolvedView || {});
                    syncSettingsControls();
                    persistViewState();
                    if (state.solarData) {
                        renderSolar(state.solarData, { hydratePreferences: false });
                    }
                    await persistSolarAccountDefaults().catch((err) => {
                        console.warn('Failed to persist solar preset:', err);
                    });
                },
            });
        }
        [
            refs.solarOrientationSelect,
            refs.solarHouseSystemSelect,
            refs.solarAspectScopeSelect,
            refs.solarPointScaleRange,
            refs.solarAspectPhaseApplyingToggle,
            refs.solarAspectPhaseSeparatingToggle,
            refs.solarHouseNumberStyleSelect,
            refs.solarHouseLabelsOutsideToggle,
            refs.solarShowWheelStationaryToggle,
            refs.solarShowWheelDegreeToggle,
            refs.solarShowApplyingSeparatingToggle,
            refs.solarShowSpeedToggle,
            refs.solarShowStationaryToggle,
            refs.solarShowAspectTextToggle,
            refs.solarAngleAscDscBoldToggle,
            refs.solarAngleMcIcBoldToggle,
        ].forEach((control) => {
            control?.addEventListener('input', readSettingsControls);
            control?.addEventListener('change', readSettingsControls);
        });
        refs.solarAspectTypeToggles.addEventListener('change', readSettingsControls);
        refs.solarMatrixEditor.addEventListener('change', readSettingsControls);
        document.addEventListener('frontend:locale-changed', () => {
            window.FrontendI18nUi?.applyI18n?.(document);
            if (state.solarData) renderSolar(state.solarData, { hydratePreferences: false });
        });
    }

    function initSolarActionsMenu() {
        const toggle = refs.solarActionsToggle;
        const menu = refs.solarActionsMenu;
        if (!toggle || !menu) return;

        const setOpen = (isOpen) => {
            menu.classList.toggle('hidden', !isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        };

        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            setOpen(menu.classList.contains('hidden'));
        });
        menu.addEventListener('click', () => setOpen(false));
        menu.addEventListener('click', (event) => event.stopPropagation());
        document.addEventListener('click', () => setOpen(false));
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') setOpen(false);
        });
    }

    async function loadAccountPreferences() {
        if (!window.AstroAPI?.getAccountPreferences) return;
        state.accountPreferences = await window.AstroAPI.getAccountPreferences().catch(() => null);
        if (state.accountPreferences?.visual) {
            window.AstroPreferences?.setAccountVisualPreferences?.(state.accountPreferences.visual);
        }
        if (state.accountPreferences?.chart_defaults?.solar) {
            state.settings = viewSettingsToPageSettings(state.accountPreferences.chart_defaults.solar);
        }
    }

    async function init() {
        collectRefs();
        await waitForI18n();
        if (!await window.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' })) return;
        try {
            await loadAccountPreferences();
            await loadNatalData();
            updateHeader();
            initRenderer();
            initPanelTabs();
            populateTimezoneOptions();
            initPlaceAutocomplete();
            initZoomPan();
            bindEvents();
            applyInitialForm();
        } catch (error) {
            console.error('Solar page failed:', error);
            showError(error.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
