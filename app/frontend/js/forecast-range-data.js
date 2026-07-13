/**
 * forecast-range-data.js — shared prognostic range-data layer for the
 * standalone forecast Tables and Timeline pages.
 *
 * Provides:
 *   • range/period data fetching (transits period, combined progressions/directions,
 *     ingress period summary) with in-memory caching;
 *   • formatting helpers reused by both pages (method labels, planet/ingress cells,
 *     motion lookups, aspect harmony, date helpers).
 *
 * It is self-contained — callers pass context (user id, timezone, natal data) via
 * `configure()` rather than relying on any page-global state. Exposes
 * `window.ForecastRangeData`.
 */
(function () {
    'use strict';

    const API_BASE = window.AstroAPI?.API_BASE_URL || '/api/v1';
    const DEFAULT_DIRECTION_TYPE = 'zodiacal';
    const INGRESS_SUMMARY_CACHE_VERSION = 'v5';
    const PLANET_PRIORITY = ['Pluto', 'Neptune', 'Uranus', 'Chiron', 'Saturn', 'Jupiter', 'TrueNorthNode', 'TrueSouthNode', 'BlackMoon', 'Proserpina', 'Mars', 'Venus', 'Mercury', 'Sun', 'Moon'];
    const FORECAST_MATRIX_NAME_ALIASES = {
        TrueNorthNode: 'TrueNode',
        TrueSouthNode: 'SouthNode',
        Fortune: 'PartOfFortune',
    };

    // Resolve at call time — module init order across split bundles is not
    // guaranteed, so capturing window.Symbols at load can yield undefined.
    const S = () => window.Symbols;

    // ─── Context ─────────────────────────────────────────────
    const ctx = {
        userId: null,
        timezone: 'UTC',
        natalData: null,
        latitude: null,
        longitude: null,
        locationName: '',
    };

    function configure({ userId, timezone, natalData, latitude, longitude, locationName } = {}) {
        if (userId !== undefined) ctx.userId = userId;
        if (timezone !== undefined) ctx.timezone = timezone || 'UTC';
        if (natalData !== undefined) ctx.natalData = natalData;
        const birth = natalData?.birth_data || {};
        if (latitude !== undefined || birth.latitude !== undefined) {
            const value = latitude !== undefined ? latitude : birth.latitude;
            ctx.latitude = value !== null && value !== '' && Number.isFinite(Number(value))
                ? Number(value)
                : null;
        }
        if (longitude !== undefined || birth.longitude !== undefined) {
            const value = longitude !== undefined ? longitude : birth.longitude;
            ctx.longitude = value !== null && value !== '' && Number.isFinite(Number(value))
                ? Number(value)
                : null;
        }
        if (locationName !== undefined || birth.place || birth.birth_place) {
            ctx.locationName = locationName !== undefined ? locationName : (birth.place || birth.birth_place || '');
        }
    }

    function getTimezone() {
        return ctx.timezone || 'UTC';
    }

    // ─── i18n / escaping ─────────────────────────────────────
    function t(key, params) {
        return window.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getPlanetName(name) {
        const key = `astro.planet.${name}`;
        const translated = t(key);
        return translated === key ? (S()?.getPlanetNameRu?.(name) || S()?.planetNamesRu?.[name] || name) : translated;
    }

    function getSignName(name) {
        const key = `astro.sign.${name}`;
        const translated = t(key);
        return translated === key ? (S()?.signNamesRu?.[name] || name) : translated;
    }

    // ─── Network ─────────────────────────────────────────────
    function apiHeaders(headers = {}) {
        return window.AstroAPI?.withLocaleHeaders ? window.AstroAPI.withLocaleHeaders(headers) : headers;
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

    async function apiGet(path, params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
        });
        const response = await fetch(`${API_BASE}${path}?${query.toString()}`, {
            credentials: 'include',
            headers: apiHeaders(),
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

    // ─── Motion helpers ──────────────────────────────────────
    function normalizeForecastBodyName(value) {
        return FORECAST_MATRIX_NAME_ALIASES[String(value || '')] || value;
    }

    function getRetrogradeLabel() {
        const key = 'page.natalFull.legend.motion.retrograde';
        const translated = t(key);
        return translated === key ? 'Retrograde' : translated;
    }

    function getStationaryLabel() {
        const key = 'page.natalFull.legend.motion.stationary';
        const translated = t(key);
        return translated === key ? 'Stationary' : translated;
    }

    function retroIndicatorHtml(isRetrograde, variantClass = 'retro-indicator--micro') {
        if (!isRetrograde) return '';
        const suffix = variantClass ? ` ${variantClass}` : '';
        const label = escapeHtml(getRetrogradeLabel());
        return `<span class="retro-indicator${suffix}" title="${label}" aria-label="${label}">R</span>`;
    }

    function stationaryIndicatorHtml(isStationary, variantClass = 'planet-status-badge--small') {
        if (!isStationary) return '';
        const suffix = variantClass ? ` ${variantClass}` : '';
        const label = escapeHtml(getStationaryLabel());
        return `<span class="planet-status-badge planet-status-badge--stationary${suffix}" title="${label}" aria-label="${label}">S</span>`;
    }

    function normalizeMotionOptions(options = {}) {
        if (typeof options === 'boolean') {
            return { isRetrograde: options };
        }
        return {
            isRetrograde: options?.isRetrograde === true || options?.retrograde === true,
            isStationary: options?.isStationary === true,
        };
    }

    function formatPlanetCellHtml(bodyName, options = {}) {
        if (!bodyName || bodyName === '—') return '—';
        const { isRetrograde, isStationary } = normalizeMotionOptions(options);
        const label = escapeHtml(getPlanetName(bodyName));
        const symbolHtml = S()?.getPlanetSymbolMarkup?.(bodyName, { size: 17, title: getPlanetName(bodyName) }) || '';
        return `<span class="forecast-body-chip" title="${label}" aria-label="${label}" role="img">${symbolHtml}${retroIndicatorHtml(isRetrograde)}${stationaryIndicatorHtml(isStationary)}</span>`;
    }

    function buildPlanetMotionLookup(planets = []) {
        const map = new Map();
        (planets || []).forEach((planet) => {
            if (!planet?.name) return;
            map.set(normalizeForecastBodyName(planet.name), {
                retrograde: Boolean(planet.retrograde),
                isStationary: Boolean(planet.is_stationary),
                stationaryType: planet.stationary_type || null,
            });
        });
        return map;
    }

    function resolvePlanetMotion(lookup, bodyName) {
        if (!lookup || !bodyName) {
            return { retrograde: null, isStationary: null, stationaryType: null };
        }
        const data = lookup.get(normalizeForecastBodyName(bodyName));
        return data || { retrograde: null, isStationary: null, stationaryType: null };
    }

    function formatHouseLabel(house) {
        if (house === null || house === undefined || house === '') return '';
        return S()?.formatHouseLabel?.(house) || String(house);
    }

    function formatSignLabel(sign) {
        if (!sign) return t('common.notAvailable');
        const sym = S()?.signs?.[sign] || '';
        const ru = getSignName(sign);
        return `${sym ? sym + ' ' : ''}${ru}`;
    }

    function getAspectHarmony(aspectType) {
        const harmonious = ['Trine', 'Sextile'];
        const tense = ['Square', 'Opposition'];
        const neutral = ['Conjunction'];
        if (harmonious.includes(aspectType)) return 'harmonious';
        if (tense.includes(aspectType)) return 'tense';
        if (neutral.includes(aspectType)) return 'neutral';
        return 'minor';
    }

    function getMethodLabel(method) {
        const map = {
            transit: t('common.method.transit'),
            transits: t('common.method.transit'),
            progressions: t('common.method.progression'),
            directions: t('common.method.direction'),
            directions_solar_arc: t('common.method.directionSolarArc'),
            directions_zodiacal: t('common.method.directionZodiacal'),
            directions_symbolic: t('common.method.directionSymbolic'),
            directions_equatorial: t('common.method.directionNaibod'),
        };
        return map[method] || method;
    }

    function normalizeDirectionType(directionType) {
        const value = String(directionType || '').trim();
        if (value === 'symbolic') return 'zodiacal';
        return ['solar_arc', 'zodiacal', 'equatorial'].includes(value) ? value : DEFAULT_DIRECTION_TYPE;
    }

    // ─── Date helpers ────────────────────────────────────────
    function formatInputDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseInputDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(`${dateStr}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function composeShortDate(dd, mm, yyyy) {
        const yy = String(yyyy).slice(-2);
        const fmt = String(
            globalThis?.AstroPreferences?.getDateFormat?.() || 'DD_MM_YYYY'
        ).trim().toUpperCase();
        if (fmt === 'MM_DD_YYYY') return `${mm}/${dd}/${yy}`;
        if (fmt === 'YYYY_MM_DD') return `${yy}-${mm}-${dd}`;
        // DD_MM_YYYY and LOCALE both fall back to the compact day-first form.
        return `${dd}.${mm}.${yy}`;
    }

    function formatDateShort6(value) {
        const raw = String(value || '').trim();
        if (!raw || raw === '—') return '—';
        const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (direct) return composeShortDate(direct[3], direct[2], direct[1]);
        const dt = new Date(raw);
        if (Number.isNaN(dt.getTime())) return raw;
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        return composeShortDate(dd, mm, String(dt.getFullYear()));
    }

    /**
     * Resolve a [startDate, endDate] window from #startDate / #endDate inputs,
     * falling back to a single target date when the range is incomplete.
     */
    function resolvePrognosticPeriod(targetDate) {
        const startRaw = document.getElementById('startDate')?.value;
        const endRaw = document.getElementById('endDate')?.value;
        const start = parseInputDate(startRaw);
        const end = parseInputDate(endRaw);
        if (start && end) {
            if (end >= start) {
                return { startDate: formatInputDate(start), endDate: formatInputDate(end) };
            }
            return { startDate: formatInputDate(end), endDate: formatInputDate(start) };
        }
        return { startDate: targetDate, endDate: targetDate };
    }

    // ─── Caches ──────────────────────────────────────────────
    const transitPeriodCache = {};
    const combinedCache = {};
    const ingressSummaryCache = {};
    const eclipsePeriodCache = {};
    let ingressSummaryData = null;

    function getTransitPeriodKey(startDate, endDate) {
        return `${startDate}|${endDate}`;
    }

    function getCombinedPointKey(targetDate, directionType) {
        return `combined|${targetDate}|${directionType || DEFAULT_DIRECTION_TYPE}`;
    }

    function getIngressSummaryKey(startDate, endDate, directionType) {
        return `ingress_summary|${INGRESS_SUMMARY_CACHE_VERSION}|${startDate}|${endDate}|${directionType || DEFAULT_DIRECTION_TYPE}`;
    }

    function getEclipsePeriodKey(startDate, endDate) {
        return [startDate, endDate, getTimezone(), ctx.latitude, ctx.longitude].join('|');
    }

    // ─── Range / point data fetching ─────────────────────────
    async function ensureTransitPeriod(startDate, endDate) {
        if (!startDate || !endDate) throw new Error(t('page.forecast.errors.datesRequired'));
        const key = getTransitPeriodKey(startDate, endDate);
        if (transitPeriodCache[key]) return transitPeriodCache[key];
        const data = await apiPost('/transits/period', {
            user_id: ctx.userId,
            start_date: startDate,
            end_date: endDate,
            timezone: getTimezone(),
            step_hours: 6,
        });
        transitPeriodCache[key] = data;
        return data;
    }

    async function fetchTransitPoint(targetDate) {
        const data = await apiPost('/transits/calculate', {
            user_id: ctx.userId,
            date: targetDate,
            time: '12:00:00',
            timezone: getTimezone(),
        });
        data._method = 'transits';
        return data;
    }

    async function fetchProgressionPoint(targetDate) {
        const data = await apiPost('/progressions/calculate', {
            user_id: ctx.userId,
            target_date: targetDate,
        });
        data._method = 'progressions';
        return data;
    }

    async function fetchDirectionPoint(targetDate, directionType) {
        const dirType = normalizeDirectionType(directionType);
        const data = await apiPost('/directions/calculate', {
            user_id: ctx.userId,
            target_date: targetDate,
            direction_type: dirType,
        });
        data._method = 'directions';
        return data;
    }

    async function ensureCombined(targetDate, { directionType = DEFAULT_DIRECTION_TYPE } = {}) {
        if (!targetDate) throw new Error(t('page.forecast.errors.dateRequired'));
        const normalizedDirectionType = normalizeDirectionType(directionType);
        const key = getCombinedPointKey(targetDate, normalizedDirectionType);
        if (combinedCache[key]) return combinedCache[key];

        const [transitData, progressionData, directionData] = await Promise.all([
            fetchTransitPoint(targetDate),
            fetchProgressionPoint(targetDate),
            fetchDirectionPoint(targetDate, normalizedDirectionType),
        ]);
        const combined = {
            _method: 'combined',
            _combined: true,
            _targetDate: targetDate,
            _directionType: normalizedDirectionType,
            _layers: {
                transit: transitData || null,
                progression: progressionData || null,
                direction: directionData || null,
            },
        };
        combinedCache[key] = combined;
        return combined;
    }

    async function ensureIngressSummary(startDate, endDate, directionType) {
        if (!startDate || !endDate) {
            ingressSummaryData = null;
            return null;
        }
        const normalizedDirectionType = normalizeDirectionType(directionType);
        const key = getIngressSummaryKey(startDate, endDate, normalizedDirectionType);
        if (ingressSummaryCache[key]) {
            ingressSummaryData = ingressSummaryCache[key];
            return ingressSummaryData;
        }
        const data = await apiPost('/ingresses/period-summary', {
            user_id: ctx.userId,
            start_date: startDate,
            end_date: endDate,
            timezone: getTimezone(),
            direction_type: normalizedDirectionType,
        });
        ingressSummaryCache[key] = data;
        ingressSummaryData = data;
        return data;
    }

    async function ensureEclipsePeriod(startDate, endDate) {
        if (!startDate || !endDate) throw new Error(t('page.forecast.errors.datesRequired'));
        const key = getEclipsePeriodKey(startDate, endDate);
        if (eclipsePeriodCache[key]) return eclipsePeriodCache[key];
        const data = await apiGet('/lunar/eclipses', {
            start_date: startDate,
            end_date: endDate,
            timezone: getTimezone(),
            latitude: ctx.latitude,
            longitude: ctx.longitude,
            location_name: ctx.locationName,
        });
        eclipsePeriodCache[key] = data;
        return data;
    }

    function getIngressSummary() {
        return ingressSummaryData;
    }

    // ─── Ingress summary helpers ─────────────────────────────
    function normalizeIngressSummaryMethodKey(method) {
        const raw = String(method || '');
        if (raw.startsWith('directions')) return 'directions';
        if (raw.startsWith('progressions')) return 'progressions';
        return raw;
    }

    function getIngressSummaryRow(method, objectKey) {
        const rows = ingressSummaryData?.rows;
        if (!Array.isArray(rows) || !rows.length || !objectKey) return null;
        const normalizedMethod = normalizeIngressSummaryMethodKey(method);
        return rows.find((row) => (
            normalizeIngressSummaryMethodKey(row?.method) === normalizedMethod
            && String(row?.object_key || row?.object || '') === String(objectKey)
        )) || null;
    }

    function collectLayerPlanets(layer) {
        if (!layer) return [];
        if (Array.isArray(layer.transit_planets)) return layer.transit_planets;
        if (Array.isArray(layer.progressed_planets)) return layer.progressed_planets;
        if (Array.isArray(layer.directed_planets)) {
            return [
                ...layer.directed_planets,
                ...(Array.isArray(layer.directed_angles) ? layer.directed_angles : []),
                ...(Array.isArray(layer.directed_special_points) ? layer.directed_special_points : []),
            ];
        }
        return [];
    }

    /**
     * Build the secondary "ingress" table rows from the period ingress summary.
     * Motion lookups are derived from the supplied combined data layers.
     */
    function buildIngressRowsFromSummary(combinedData) {
        const rows = ingressSummaryData?.rows;
        if (!Array.isArray(rows) || !rows.length) return [];
        const layers = combinedData?._layers || {};
        const motionMapByMethod = {
            transits: buildPlanetMotionLookup(collectLayerPlanets(layers.transit)),
            progressions: buildPlanetMotionLookup(collectLayerPlanets(layers.progression)),
            directions: buildPlanetMotionLookup(collectLayerPlanets(layers.direction)),
        };
        return rows.flatMap((row) => {
            const methodKey = row.method || '';
            const methodClass = row.method_class || (methodKey === 'progressions' ? 'progression' : 'direction');
            const hoverDetails = Array.isArray(row.hover_details) ? row.hover_details : [];
            let object = row.object || '—';
            let objectHtml = escapeHtml(object);
            if (row.object_key && !String(row.object_key).startsWith('Cusp')) {
                object = getPlanetName(row.object_key);
                const normalizedMethod = normalizeIngressSummaryMethodKey(methodKey);
                objectHtml = formatPlanetCellHtml(
                    row.object_key,
                    resolvePlanetMotion(motionMapByMethod[normalizedMethod], row.object_key),
                );
            } else if (row.object_key?.startsWith('Cusp')) {
                const houseNumber = String(row.object_key).replace('Cusp', '');
                object = t('page.forecast.table.ingress.cuspLabel', { house: formatHouseLabel(houseNumber) });
                objectHtml = escapeHtml(object);
            }
            const makeRow = (details, ingressType, transition) => ({
                date: details[0]?.times?.exact || '—',
                method: getMethodLabel(methodKey),
                methodClass,
                object,
                objectHtml,
                ingressType,
                transition,
                hoverDetails: details,
                hoverLines: details.map((item) => item?.text).filter(Boolean),
            });

            if (row.object_key && String(row.object_key).startsWith('Cusp')) {
                const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
                if (!signDetails.length) return [];
                const first = signDetails[0];
                const last = signDetails[signDetails.length - 1];
                return [makeRow(
                    signDetails,
                    t('page.forecast.table.ingress.cusp'),
                    `${formatSignLabel(first?.from)} → ${formatSignLabel(last?.to)}`,
                )];
            }

            const signDetails = hoverDetails.filter((item) => item?.ingress_type === 'sign');
            const houseDetails = hoverDetails.filter((item) => item?.ingress_type === 'house');
            const result = [];
            if (signDetails.length) {
                const first = signDetails[0];
                const last = signDetails[signDetails.length - 1];
                result.push(makeRow(
                    signDetails,
                    t('page.forecast.table.ingress.sign'),
                    `${formatSignLabel(first?.from)} → ${formatSignLabel(last?.to)}`,
                ));
            }
            if (houseDetails.length) {
                const first = houseDetails[0];
                const last = houseDetails[houseDetails.length - 1];
                result.push(makeRow(
                    houseDetails,
                    t('page.forecast.table.ingress.house'),
                    `${t('page.forecast.table.houseLabel', { house: formatHouseLabel(first?.from ?? t('common.notAvailable')) })} → ${t('page.forecast.table.houseLabel', { house: formatHouseLabel(last?.to ?? t('common.notAvailable')) })}`,
                ));
            }
            return result;
        });
    }

    // ─── Ingress hover tooltip markup ────────────────────────
    function formatIngressHoverValue(value, ingressType) {
        if (value === null || value === undefined || value === '') return '—';
        if (ingressType === 'house' && Number.isFinite(Number(value))) {
            return `H${value}`;
        }
        if (ingressType === 'sign' && typeof value === 'string') {
            const symbol = S()?.signs?.[value] || '';
            const name = getSignName(value);
            return `${symbol ? `${symbol} ` : ''}${name}`.trim();
        }
        return String(value);
    }

    function formatLegacyIngressHoverLine(line) {
        const safe = escapeHtml(String(line || ''));
        return safe.replace(/(\d{4}-\d{2}-\d{2})/g, (_, match) => formatDateShort6(match));
    }

    function buildIngressHoverHtml(row) {
        const details = Array.isArray(row.hoverDetails) ? row.hoverDetails : [];
        if (details.length) {
            const blocks = details.map((detail) => {
                const ingressType = detail?.ingress_type || 'none';
                if (ingressType === 'none') {
                    const fromLabel = formatIngressHoverValue(detail?.from, ingressType);
                    const toLabel = formatIngressHoverValue(detail?.to, ingressType);
                    const periodStart = formatDateShort6(detail?.times?.before);
                    const periodEnd = formatDateShort6(detail?.times?.exact);
                    return `<div class="bw-hover-item">
                        <div class="bw-hover-head">${escapeHtml(t('page.forecast.table.noEvents') || 'No intermediate transitions')}.</div>
                        <div class="bw-hover-times">${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</div>
                        <div class="bw-hover-times">${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</div>
                    </div>`;
                }
                const label = ingressType === 'house'
                    ? t('page.forecast.table.ingress.house')
                    : ingressType === 'sign'
                        ? t('page.forecast.table.ingress.sign')
                        : t('page.forecast.table.columns.transition');
                const fromLabel = formatIngressHoverValue(detail?.from, ingressType);
                const toLabel = formatIngressHoverValue(detail?.to, ingressType);
                const before = formatDateShort6(detail?.times?.before);
                const exact = formatDateShort6(detail?.times?.exact);
                const after = formatDateShort6(detail?.times?.after);
                return `<div class="bw-hover-item">
                    <div class="bw-hover-head">${escapeHtml(label)}: ${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)}</div>
                    <div class="bw-hover-times">-1° ${escapeHtml(before)} · 0° ${escapeHtml(exact)} · +1° ${escapeHtml(after)}</div>
                </div>`;
            }).join('');
            return `<div class="bw-hover-wrap">${blocks}</div>`;
        }

        const lines = Array.isArray(row.hoverLines) ? row.hoverLines.filter(Boolean) : [];
        if (!lines.length) return '';
        return `<div class="bw-hover-wrap">${lines.map((line) => `<div class="bw-hover-item"><div class="bw-hover-head">${formatLegacyIngressHoverLine(line)}</div></div>`).join('')}</div>`;
    }

    window.ForecastRangeData = {
        configure,
        // data fetching
        ensureTransitPeriod,
        ensureCombined,
        ensureIngressSummary,
        ensureEclipsePeriod,
        getIngressSummary,
        resolvePrognosticPeriod,
        // ingress summary helpers
        getIngressSummaryRow,
        buildIngressRowsFromSummary,
        buildIngressHoverHtml,
        // formatting helpers
        t,
        escapeHtml,
        getPlanetName,
        getSignName,
        getMethodLabel,
        formatPlanetCellHtml,
        buildPlanetMotionLookup,
        resolvePlanetMotion,
        normalizeDirectionType,
        formatSignLabel,
        formatHouseLabel,
        getAspectHarmony,
        formatDateShort6,
        // date helpers
        parseInputDate,
        formatInputDate,
        // constants
        PLANET_PRIORITY,
        DEFAULT_DIRECTION_TYPE,
    };
})();
