/**
 * Workspace — редирект на forecast-new.html (Path B завершено).
 *
 * forecast-new.html тепер містить повний cold-start шлях (вибір клієнта або
 * ручний ввід). Скелет /workspace більше не потрібен як окрема сторінка —
 * всі сценарії покриті forecast-new.
 *
 * Якщо в сесії є карта — передаємо на forecast-new з тими ж query-params.
 * Якщо немає — forecast-new покаже cold-start overlay.
 */
(function () {
    'use strict';

    const API_BASE = '/api/v1';

    const state = {
        view: 'single',                 // single | multi
        baseMode: 'saved',              // saved | manual
        partnerMode: 'saved',           // источник партнёра для синастрии
        methods: ['transit'],           // выбранные методики (3+ колец: база + N)
        wheel: null,
        basePanel: null,
        targetPanel: null,
        partnerPanel: null,
        clients: [],
    };

    const DATETIME_METHODS = ['transit', 'progression', 'direction'];

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
            const options = '<option value="">— выберите клиента —</option>'
                + state.clients.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id.slice(0, 8);
                    return `<option value="${u.user_id}">${name} · ${u.birth_date || ''}</option>`;
                }).join('');
            refs.clientSelect.innerHTML = options;
            if (refs.partnerSelect) refs.partnerSelect.innerHTML = options;
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

    function partnerSourceSnapshot() {
        if (state.partnerMode === 'saved') {
            const userId = refs.partnerSelect.value || null;
            if (!userId) throw new Error('Выберите партнёра из базы (или введите вручную)');
            return { mode: 'saved', userId };
        }
        const snapshot = state.partnerPanel.getSource();
        if (!snapshot.datetime || !snapshot.datetime.split('T')[0]) {
            throw new Error('Укажите дату рождения партнёра');
        }
        return snapshot;
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

            // multi: база + N производных колец (3+ колец как на прогностике)
            if (!state.methods.length) throw new Error('Выберите хотя бы одну методику');
            const targetSnapshot = state.targetPanel.getSource();
            if (state.methods.includes('solar_return') && !targetSnapshot.year) {
                throw new Error('Укажите год соляра');
            }

            const requests = state.methods.map((method) => ({
                method,
                request: window.MethodologyRegistry.buildLayerRequest(
                    method,
                    baseSnapshot,
                    method === 'synastry' ? partnerSourceSnapshot() : targetSnapshot,
                    { directionType: refs.directionType.value },
                ),
            }));
            const settled = await Promise.allSettled(requests.map(({ request }) =>
                api(request.endpoint, { method: 'POST', body: JSON.stringify(request.body) })));

            const layers = {};
            const okMethods = [];
            const failed = [];
            settled.forEach((result, index) => {
                const { method, request } = requests[index];
                if (result.status === 'fulfilled') {
                    // Синастрия отдаёт обе карты — кольцу нужны партнёрская + интер-аспекты
                    layers[request.ringMethod] = method === 'synastry'
                        ? { partner_chart: result.value.partner_chart, inter_aspects: result.value.inter_aspects }
                        : result.value;
                    okMethods.push(request.ringMethod);
                } else {
                    failed.push(`${labelForMethod(method)}: ${result.reason?.message || result.reason}`);
                }
            });
            if (!okMethods.length) throw new Error(failed.join(' · ') || 'Не удалось посчитать слои');

            const viewModel = window.PrognosticLayerNormalizer.buildViewModel(
                natalData,
                layers,
                { activeMethods: okMethods },
            );
            renderViewModel(viewModel, { singleChart: false });
            const okLabel = okMethods.map(labelForMethod).join(' + ');
            setStatus(failed.length
                ? `Готово: натал + ${okLabel} · ошибки: ${failed.join(' · ')}`
                : `Готово: натал + ${okLabel}`, failed.length > 0);
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
            synastry: 'синастрия',
            synastry_partner: 'синастрия',
        }[method] || method;
    }

    /** Фаза 5 (D3): осознанное сохранение ручной (ephemeral) карты в базу клиентов. */
    async function saveManualChart() {
        const name = ($('wsSaveName')?.value || '').trim();
        if (!name) { setStatus('Укажите имя для сохранения', true); return; }
        const snapshot = state.basePanel.getSource();
        const payload = window.ChartSourcePanel.buildSourcePayload(snapshot);
        if (!payload.natal?.date) { setStatus('Укажите дату рождения', true); return; }
        refs.saveBtn.disabled = true;
        setStatus('Сохраняю…');
        try {
            const saved = await api('/natal/calculate?save_to_db=true', {
                method: 'POST',
                body: JSON.stringify({ ...payload.natal, first_name: name }),
            });
            await loadClients();
            if (saved?.user_id) {
                refs.clientSelect.value = saved.user_id;
                const savedRadio = document.querySelector('input[name="wsBaseMode"][value="saved"]');
                if (savedRadio) { savedRadio.checked = true; savedRadio.dispatchEvent(new Event('change', { bubbles: true })); }
            }
            setStatus(`Сохранено: ${name}`);
        } catch (error) {
            setStatus(`Не удалось сохранить: ${error.message}`, true);
        } finally {
            refs.saveBtn.disabled = false;
        }
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
        const hasDatetime = state.methods.some((m) => DATETIME_METHODS.includes(m));
        const hasSolar = state.methods.includes('solar_return');
        const hasSynastry = state.methods.includes('synastry');
        refs.directionTypeField.classList.toggle('hidden', !state.methods.includes('direction'));
        refs.targetDatetimeBlock.classList.toggle('hidden', !hasDatetime);
        refs.targetYearBlock.classList.toggle('hidden', !hasSolar);
        refs.partnerBlock.classList.toggle('hidden', !hasSynastry);
    }

    function syncPartnerModeUi() {
        refs.partnerSavedBlock.classList.toggle('hidden', state.partnerMode !== 'saved');
        refs.partnerManualBlock.classList.toggle('hidden', state.partnerMode !== 'manual');
    }

    function readCheckedMethods() {
        return Array.from(document.querySelectorAll('#wsMethodChecks input[data-ws-method]'))
            .filter((input) => input.checked)
            .map((input) => input.getAttribute('data-ws-method'));
    }

    function bindPlaceAutocomplete(input, suggestions, panel) {
        if (!window.PlaceAutocomplete?.attach || !input || !suggestions) return;
        // attach(config) — один объект (см. place-autocomplete.js / form.js)
        window.PlaceAutocomplete.attach({
            input,
            suggestions,
            onSelect(place) {
                const latitude = place.lat ?? place.latitude ?? null;
                const longitude = place.lon ?? place.longitude ?? null;
                const timezone = place.timezone
                    || window.Timezones?.guess?.(place.displayName || place.shortName || input.value)
                    || null;
                panel.update({
                    location: {
                        name: place.shortName || place.displayName || input.value,
                        latitude,
                        longitude,
                        sourceId: place.sourceId || place.source_id || null,
                    },
                    ...(timezone ? { timezone } : {}),
                });
                panel.syncToDom();
            },
        });
    }

    function init() {
        Object.assign(refs, {
            clientSelect: $('wsClientSelect'),
            baseSavedBlock: $('wsBaseSavedBlock'),
            baseManualBlock: $('wsBaseManualBlock'),
            ringCard: $('wsRingCard'),
            saveBtn: $('wsSaveBtn'),
            partnerBlock: $('wsPartnerBlock'),
            partnerSelect: $('wsPartnerSelect'),
            partnerSavedBlock: $('wsPartnerSavedBlock'),
            partnerManualBlock: $('wsPartnerManualBlock'),
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

        // Панель партнёра (синастрия, ручной ввод)
        window.Timezones?.populate?.($('wsPartnerTimezone'));
        state.partnerPanel = new window.ChartSourcePanel.ChartSourcePanel({ mode: 'manual' }).attachDom({
            dateInput: $('wsPartnerDate'),
            timeInput: $('wsPartnerTime'),
            timezoneInput: $('wsPartnerTimezone'),
            locationInput: $('wsPartnerPlace'),
            latitudeInput: $('wsPartnerLat'),
            longitudeInput: $('wsPartnerLon'),
        });

        bindPlaceAutocomplete($('wsBasePlace'), $('wsBasePlaceSuggestions'), state.basePanel);
        bindPlaceAutocomplete($('wsTargetPlace'), $('wsTargetPlaceSuggestions'), state.targetPanel);
        bindPlaceAutocomplete($('wsPartnerPlace'), $('wsPartnerPlaceSuggestions'), state.partnerPanel);

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
        document.querySelectorAll('input[name="wsPartnerMode"]').forEach((input) => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                state.partnerMode = input.value === 'manual' ? 'manual' : 'saved';
                syncPartnerModeUi();
            });
        });
        document.querySelectorAll('#wsMethodChecks input[data-ws-method]').forEach((input) => {
            input.addEventListener('change', () => {
                state.methods = readCheckedMethods();
                syncMethodUi();
            });
        });
        refs.buildBtn.addEventListener('click', build);
        refs.saveBtn?.addEventListener('click', saveManualChart);

        state.methods = readCheckedMethods();
        syncViewUi();
        syncBaseModeUi();
        syncPartnerModeUi();
        syncMethodUi();
        loadClients();
    }

    function redirectToForecastNew() {
        // Preserve any query params (e.g. deep-link date/layer params)
        const search = window.location.search || '';
        window.location.replace('/forecast-new.html' + search);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', redirectToForecastNew);
    } else {
        redirectToForecastNew();
    }
})();
