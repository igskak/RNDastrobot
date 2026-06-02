/**
 * Workspace — единый рабочий стол астролога (Фаза 3/4 плана, MVP-скелет).
 *
 * Два вида одного движка (D6): «одно колесо» = 1 кольцо, «мульти» = база +
 * производное кольцо по методике. Источник базовой карты — ChartSourcePanel
 * (из базы клиентов или ручной ввод, ephemeral по D3). Запросы слоёв собирает
 * MethodologyRegistry ({user_id} XOR {natal} через buildSourcePayload — тот же
 * union, что NatalSourceMixin на бэке).
 */
(function () {
    'use strict';

    const API_BASE = '/api/v1';

    const state = {
        view: 'single',                 // single | multi
        baseMode: 'saved',              // saved | manual
        method: 'transit',
        wheel: null,
        basePanel: null,
        targetPanel: null,
        clients: [],
    };

    const refs = {};

    function $(id) { return document.getElementById(id); }

    function setStatus(message, isError = false) {
        refs.status.textContent = message || '';
        refs.status.classList.toggle('ws-status--error', isError);
    }

    async function api(path, options = {}) {
        const response = await fetch(`${API_BASE}${path}`, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!response.ok) {
            let detail = `HTTP ${response.status}`;
            try {
                const data = await response.json();
                if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
            } catch (_) { /* ignore */ }
            throw new Error(detail);
        }
        return response.json();
    }

    // ---------- Источники ----------

    async function loadClients() {
        try {
            const users = await api('/users');
            state.clients = Array.isArray(users) ? users : [];
            refs.clientSelect.innerHTML = '<option value="">— выберите клиента —</option>'
                + state.clients.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id.slice(0, 8);
                    return `<option value="${u.user_id}">${name} · ${u.birth_date || ''}</option>`;
                }).join('');
        } catch (error) {
            setStatus(`Не удалось загрузить клиентов: ${error.message}`, true);
        }
    }

    function baseSourceSnapshot() {
        if (state.baseMode === 'saved') {
            return { mode: 'saved', userId: refs.clientSelect.value || null };
        }
        return state.basePanel.getSource();
    }

    async function fetchBaseNatal(snapshot) {
        if (snapshot.mode === 'saved') {
            if (!snapshot.userId) throw new Error('Выберите клиента из базы');
            return api(`/natal/${snapshot.userId}`);
        }
        const payload = window.ChartSourcePanel.buildSourcePayload(snapshot);
        if (!payload.natal?.date) throw new Error('Укажите дату рождения');
        return api('/natal/calculate?save_to_db=false', {
            method: 'POST',
            body: JSON.stringify(payload.natal),
        });
    }

    // ---------- Рендер ----------

    function ensureWheel() {
        if (!state.wheel) state.wheel = new window.PrognosticRingsWheel(refs.wheelSvg);
        return state.wheel;
    }

    function renderViewModel(viewModel, { singleChart }) {
        const wheel = ensureWheel();
        wheel.setOptions({
            minimumRingCount: singleChart ? 1 : 2,
            alignSingleRingOuter: false,
            showAngleMarkers: singleChart,    // D6: одиночный вид = вид одной карты
            visualPreferences: window.AstroPreferences?.getAccountVisualPreferences?.() || null,
        });
        wheel.render(viewModel);
        refs.emptyState.classList.add('hidden');
        refs.wheelSvg.classList.remove('hidden');
    }

    async function build() {
        setStatus('Считаю…');
        refs.buildBtn.disabled = true;
        try {
            const baseSnapshot = baseSourceSnapshot();
            const natalData = await fetchBaseNatal(baseSnapshot);

            if (state.view === 'single') {
                const viewModel = window.PrognosticLayerNormalizer.buildViewModel(natalData, {}, { activeMethods: [] });
                renderViewModel(viewModel, { singleChart: true });
                setStatus(baseSnapshot.mode === 'manual' ? 'Готово: натал · временная карта' : 'Готово: натал');
                return;
            }

            // multi: база + производное кольцо по методике
            const entry = window.MethodologyRegistry.getEntry(state.method);
            const targetSnapshot = state.targetPanel.getSource();
            if (entry.targetInputVariant === 'year' && !targetSnapshot.year) {
                throw new Error('Укажите год соляра');
            }
            const request = window.MethodologyRegistry.buildLayerRequest(
                state.method,
                baseSnapshot,
                targetSnapshot,
                { directionType: refs.directionType.value },
            );
            const layerRaw = await api(request.endpoint, {
                method: 'POST',
                body: JSON.stringify(request.body),
            });
            const viewModel = window.PrognosticLayerNormalizer.buildViewModel(
                natalData,
                { [request.ringMethod]: layerRaw },
                { activeMethods: [request.ringMethod] },
            );
            renderViewModel(viewModel, { singleChart: false });
            setStatus(`Готово: натал + ${labelForMethod(state.method)}`);
        } catch (error) {
            setStatus(error.message, true);
        } finally {
            refs.buildBtn.disabled = false;
        }
    }

    function labelForMethod(method) {
        return {
            transit: 'транзиты',
            progression: 'прогрессии',
            direction: 'дирекции',
            solar_return: 'соляр',
        }[method] || method;
    }

    // ---------- UI-связка ----------

    function syncViewUi() {
        refs.ringCard.classList.toggle('hidden', state.view !== 'multi');
    }

    function syncBaseModeUi() {
        refs.baseSavedBlock.classList.toggle('hidden', state.baseMode !== 'saved');
        refs.baseManualBlock.classList.toggle('hidden', state.baseMode !== 'manual');
    }

    function syncMethodUi() {
        const entry = window.MethodologyRegistry.getEntry(state.method);
        refs.directionTypeField.classList.toggle('hidden', state.method !== 'direction');
        refs.targetDatetimeBlock.classList.toggle('hidden', entry.targetInputVariant !== 'datetime');
        refs.targetYearBlock.classList.toggle('hidden', entry.targetInputVariant !== 'year');
        state.targetPanel.setInputVariant(entry.targetInputVariant);
    }

    function bindPlaceAutocomplete(input, suggestions, panel) {
        if (!window.PlaceAutocomplete?.attach || !input) return;
        window.PlaceAutocomplete.attach(input, suggestions, {
            onSelect(place) {
                panel.update({
                    location: {
                        name: place.name || input.value,
                        latitude: place.latitude ?? place.lat ?? null,
                        longitude: place.longitude ?? place.lon ?? null,
                        sourceId: place.source_id || place.sourceId || null,
                    },
                });
                panel.syncToDom();
                if (place.timezone) {
                    panel.update({ timezone: place.timezone });
                    panel.syncToDom();
                }
            },
        });
    }

    function init() {
        Object.assign(refs, {
            clientSelect: $('wsClientSelect'),
            baseSavedBlock: $('wsBaseSavedBlock'),
            baseManualBlock: $('wsBaseManualBlock'),
            ringCard: $('wsRingCard'),
            methodSelect: $('wsMethodSelect'),
            directionType: $('wsDirectionType'),
            directionTypeField: $('wsDirectionTypeField'),
            targetDatetimeBlock: $('wsTargetDatetimeBlock'),
            targetYearBlock: $('wsTargetYearBlock'),
            buildBtn: $('wsBuildBtn'),
            status: $('wsStatus'),
            wheelSvg: $('workspaceWheel'),
            emptyState: $('wsEmptyState'),
        });

        // Таймзоны
        window.Timezones?.populate?.($('wsBaseTimezone'));
        window.Timezones?.populate?.($('wsTargetTimezone'));

        // Панель базовой карты (ручной ввод)
        state.basePanel = new window.ChartSourcePanel.ChartSourcePanel({ mode: 'manual' }).attachDom({
            dateInput: $('wsBaseDate'),
            timeInput: $('wsBaseTime'),
            timezoneInput: $('wsBaseTimezone'),
            locationInput: $('wsBasePlace'),
            latitudeInput: $('wsBaseLat'),
            longitudeInput: $('wsBaseLon'),
        });

        // Панель кольца сравнения (по умолчанию: сейчас)
        const now = new Date();
        const today = window.ForecastSourceUtils.todayIsoDate(now);
        $('wsTargetDate').value = today;
        $('wsTargetYear').value = String(now.getFullYear());
        state.targetPanel = new window.ChartSourcePanel.ChartSourcePanel({ mode: 'manual' }).attachDom({
            dateInput: $('wsTargetDate'),
            timeInput: $('wsTargetTime'),
            timezoneInput: $('wsTargetTimezone'),
            locationInput: $('wsTargetPlace'),
            latitudeInput: $('wsTargetLat'),
            longitudeInput: $('wsTargetLon'),
            yearInput: $('wsTargetYear'),
        });

        bindPlaceAutocomplete($('wsBasePlace'), $('wsBasePlaceSuggestions'), state.basePanel);
        bindPlaceAutocomplete($('wsTargetPlace'), $('wsTargetPlaceSuggestions'), state.targetPanel);

        // Переключатели
        document.querySelectorAll('input[name="wsView"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                state.view = input.value === 'multi' ? 'multi' : 'single';
                syncViewUi();
            });
        });
        document.querySelectorAll('input[name="wsBaseMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                state.baseMode = input.value === 'manual' ? 'manual' : 'saved';
                syncBaseModeUi();
            });
        });
        refs.methodSelect.addEventListener('change', () => {
            state.method = refs.methodSelect.value;
            syncMethodUi();
        });
        refs.buildBtn.addEventListener('click', build);

        syncViewUi();
        syncBaseModeUi();
        syncMethodUi();
        loadClients();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
