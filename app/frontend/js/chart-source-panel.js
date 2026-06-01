/**
 * ChartSourcePanel — переиспользуемая модель «точка во времени + место + источник».
 *
 * Спайк Фазы 0 (план UNIFIED_WORKSPACE_PIVOT_PLAN.md). Это ЧИСТАЯ, DOM-agnostic,
 * сериализуемая модель состояния панели + шина событий. Рендер DOM и извлечение из
 * forecast-new.js — отдельная имплементация; здесь доказывается, что граница модуля
 * чистая и снимок панели маппится на backend-контракт Фазы 1 (NatalSourceMixin).
 *
 * Контракт (по Findings DX#4 / Design 4.4):
 *  - источник = { mode:'manual'|'saved', datetime, timezone, location{name,lat,lon,sourceId},
 *                 year, userId, ephemeralId, inputVariant }
 *  - МЕТОДИЧНЫЕ поля (directionType, layer и т.п.) сюда НЕ входят — это про кольцо/реестр.
 *  - inputVariant: 'datetime' (transit/progression/direction), 'year' (solar), 'none' (натал-only).
 *  - публичный интерфейс: on()/emit, getSource()/setSource(), update(), setMode(), selectSaved(),
 *    requestSave(). ephemeralId генерится панелью и стабилен в рамках сессии (фикс коллизии кэша,
 *    Findings Eng M2 / DX#2).
 */
(function () {
    'use strict';

    const SOURCE_MODES = ['manual', 'saved'];
    const INPUT_VARIANTS = ['datetime', 'year', 'none'];

    let _ephemeralСounterSeed = 0;

    function generateEphemeralId() {
        _ephemeralСounterSeed += 1;
        const t = (typeof Date !== 'undefined') ? Date.now() : 0;
        return `eph-${t}-${_ephemeralСounterSeed}`;
    }

    function normalizeLocation(loc) {
        loc = loc || {};
        const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
        return {
            name: typeof loc.name === 'string' ? loc.name : '',
            latitude: Number.isFinite(toNum(loc.latitude)) ? toNum(loc.latitude) : null,
            longitude: Number.isFinite(toNum(loc.longitude)) ? toNum(loc.longitude) : null,
            sourceId: loc.sourceId || null,
        };
    }

    function normalizeInputVariant(v) {
        return INPUT_VARIANTS.includes(v) ? v : 'datetime';
    }

    function normalizeMode(v) {
        return SOURCE_MODES.includes(v) ? v : 'manual';
    }

    function ChartSourcePanel(options) {
        options = options || {};
        this._listeners = {};
        this._state = {
            mode: normalizeMode(options.mode),
            inputVariant: normalizeInputVariant(options.inputVariant),
            datetime: options.datetime || '',          // ISO 'YYYY-MM-DDTHH:mm:ss'
            timezone: options.timezone || 'UTC',
            location: normalizeLocation(options.location),
            year: Number.isFinite(options.year) ? options.year : null,  // только inputVariant='year'
            userId: options.userId || null,             // выбран сохранённый клиент
            ephemeralId: options.ephemeralId || null,    // для ручного ввода
        };
        // Ручной режим без явного ephemeralId — генерим стабильный
        if (this._state.mode === 'manual' && !this._state.ephemeralId) {
            this._state.ephemeralId = generateEphemeralId();
        }
    }

    ChartSourcePanel.prototype.on = function (event, cb) {
        (this._listeners[event] = this._listeners[event] || []).push(cb);
        return this;
    };

    ChartSourcePanel.prototype.emit = function (event, payload) {
        (this._listeners[event] || []).forEach((cb) => {
            try { cb(payload); } catch (_) { /* listener errors не валят панель */ }
        });
    };

    /** Сериализуемый снимок — для рендера, URL/sessionStorage и buildSourcePayload. */
    ChartSourcePanel.prototype.getSource = function () {
        const s = this._state;
        return {
            mode: s.mode,
            inputVariant: s.inputVariant,
            datetime: s.datetime,
            timezone: s.timezone,
            location: { ...s.location },
            year: s.year,
            userId: s.userId,
            ephemeralId: s.ephemeralId,
        };
    };

    /** Гидратация из снимка (например, при восстановлении из сессии). Без emit. */
    ChartSourcePanel.prototype.setSource = function (snapshot) {
        snapshot = snapshot || {};
        this._state = {
            mode: normalizeMode(snapshot.mode),
            inputVariant: normalizeInputVariant(snapshot.inputVariant),
            datetime: snapshot.datetime || '',
            timezone: snapshot.timezone || 'UTC',
            location: normalizeLocation(snapshot.location),
            year: Number.isFinite(snapshot.year) ? snapshot.year : null,
            userId: snapshot.userId || null,
            ephemeralId: snapshot.ephemeralId || null,
        };
        if (this._state.mode === 'manual' && !this._state.ephemeralId) {
            this._state.ephemeralId = generateEphemeralId();
        }
        return this;
    };

    ChartSourcePanel.prototype.update = function (patch) {
        patch = patch || {};
        if ('location' in patch) patch.location = normalizeLocation(patch.location);
        Object.assign(this._state, patch);
        this.emit('change', this.getSource());
        return this;
    };

    ChartSourcePanel.prototype.setMode = function (mode) {
        this._state.mode = normalizeMode(mode);
        if (this._state.mode === 'manual' && !this._state.ephemeralId) {
            this._state.ephemeralId = generateEphemeralId();
        }
        this.emit('change', this.getSource());
        return this;
    };

    ChartSourcePanel.prototype.setInputVariant = function (variant) {
        this._state.inputVariant = normalizeInputVariant(variant);
        this.emit('change', this.getSource());
        return this;
    };

    /** Выбор сохранённого клиента из базы (quick-open). */
    ChartSourcePanel.prototype.selectSaved = function (userId, snapshot) {
        snapshot = snapshot || {};
        this._state.mode = 'saved';
        this._state.userId = userId;
        this._state.ephemeralId = null;
        if (snapshot.datetime) this._state.datetime = snapshot.datetime;
        if (snapshot.timezone) this._state.timezone = snapshot.timezone;
        if (snapshot.location) this._state.location = normalizeLocation(snapshot.location);
        this.emit('change', this.getSource());
        return this;
    };

    /** Кнопка «Сохранить как клиента/событие» (D3) — панель только сигналит. */
    ChartSourcePanel.prototype.requestSave = function () {
        this.emit('save-request', this.getSource());
        return this;
    };

    function _numOrNull(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Привязать панель к DOM-инпутам (Фаза 0: DOM-слой компонента). `elements` — любой
     * поднабор: { dateInput, timeInput, timezoneInput, locationInput, latitudeInput,
     * longitudeInput, yearInput }. Гидратирует состояние из DOM, навешивает слушатели
     * (input → update + emit 'change'). Фреймворк-free, работает в jsdom.
     */
    ChartSourcePanel.prototype.attachDom = function (elements) {
        this._dom = elements || {};
        this.hydrateFromDom();
        const onInput = () => this.update(this._readDom());
        Object.keys(this._dom).forEach((key) => {
            const el = this._dom[key];
            if (el && typeof el.addEventListener === 'function') {
                el.addEventListener('input', onInput);
                el.addEventListener('change', onInput);
            }
        });
        return this;
    };

    /** Собрать patch состояния из текущих значений DOM-инпутов. */
    ChartSourcePanel.prototype._readDom = function () {
        const d = this._dom || {};
        const patch = {};
        if (d.dateInput || d.timeInput) {
            const date = d.dateInput ? String(d.dateInput.value || '') : (this._state.datetime.split('T')[0] || '');
            const time = d.timeInput ? String(d.timeInput.value || '') : (this._state.datetime.split('T')[1] || '');
            patch.datetime = `${date}T${time || '00:00:00'}`;
        }
        if (d.timezoneInput) patch.timezone = String(d.timezoneInput.value || 'UTC');
        if (d.yearInput) patch.year = _numOrNull(d.yearInput.value);
        if (d.locationInput || d.latitudeInput || d.longitudeInput) {
            patch.location = {
                name: d.locationInput ? String(d.locationInput.value || '') : this._state.location.name,
                latitude: d.latitudeInput ? _numOrNull(d.latitudeInput.value) : this._state.location.latitude,
                longitude: d.longitudeInput ? _numOrNull(d.longitudeInput.value) : this._state.location.longitude,
                sourceId: this._state.location.sourceId,
            };
        }
        return patch;
    };

    /** Прочитать DOM в состояние без emit (начальная гидратация). */
    ChartSourcePanel.prototype.hydrateFromDom = function () {
        Object.assign(this._state, this._readDom());
        return this;
    };

    /** Записать состояние обратно в DOM-инпуты. */
    ChartSourcePanel.prototype.syncToDom = function () {
        const d = this._dom || {};
        const s = this._state;
        const [datePart, timePart] = String(s.datetime || '').split('T');
        if (d.dateInput) d.dateInput.value = datePart || '';
        if (d.timeInput) d.timeInput.value = (timePart || '').slice(0, 8);
        if (d.timezoneInput) d.timezoneInput.value = s.timezone || '';
        if (d.yearInput) d.yearInput.value = s.year != null ? String(s.year) : '';
        if (d.locationInput) d.locationInput.value = s.location.name || '';
        if (d.latitudeInput) d.latitudeInput.value = s.location.latitude != null ? String(s.location.latitude) : '';
        if (d.longitudeInput) d.longitudeInput.value = s.location.longitude != null ? String(s.location.longitude) : '';
        return this;
    };

    ChartSourcePanel.prototype.isEphemeral = function () {
        return this._state.mode === 'manual' && !this._state.userId;
    };

    /**
     * Маппинг снимка панели в backend-источник натала (union из Фазы 1: NatalSourceMixin).
     * Это «buildSourcePayload» из Findings DX#2 — единая точка, зеркалящая «ровно один из»
     * на бэкенде. Реестр методик добавляет к этому только методичные поля.
     */
    function buildSourcePayload(snapshot) {
        snapshot = snapshot || {};
        if (snapshot.mode === 'saved' && snapshot.userId) {
            return { user_id: snapshot.userId };
        }
        // manual → inline natal
        const dt = String(snapshot.datetime || '');
        const [datePart, timePartRaw] = dt.split('T');
        const timePart = (timePartRaw || '').slice(0, 8) || null;
        const loc = snapshot.location || {};
        const natal = {
            date: datePart || null,
            time: timePart,
            timezone: snapshot.timezone || 'UTC',
        };
        if (loc.name) natal.place = loc.name;
        if (loc.latitude !== null && loc.latitude !== undefined) natal.latitude = loc.latitude;
        if (loc.longitude !== null && loc.longitude !== undefined) natal.longitude = loc.longitude;
        return { natal };
    }

    const api = {
        ChartSourcePanel,
        buildSourcePayload,
        normalizeLocation,
        SOURCE_MODES,
        INPUT_VARIANTS,
    };

    if (typeof window !== 'undefined') window.ChartSourcePanel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
