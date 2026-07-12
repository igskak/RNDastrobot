(function () {
    'use strict';

    const STORAGE_NAMESPACE = 'saved_configurations';

    function t(key, fallback) {
        const value = window.FrontendI18n?.t?.(key);
        if (value && value !== key) return value;
        return fallback || key;
    }

    function genId() {
        return 'cfg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    }

    function clone(value) {
        if (value === null || value === undefined) return value;
        if (typeof structuredClone === 'function') {
            try { return structuredClone(value); } catch { /* fallthrough */ }
        }
        return JSON.parse(JSON.stringify(value));
    }

    async function readAllConfigs() {
        if (!window.AstroAPI?.getAccountPreferences) return {};
        try {
            const prefs = await window.AstroAPI.getAccountPreferences();
            const bucket = prefs?.chart_defaults?.[STORAGE_NAMESPACE];
            return (bucket && typeof bucket === 'object') ? bucket : {};
        } catch (err) {
            console.warn('ChartConfigPresets: failed to read preferences', err);
            return {};
        }
    }

    async function listConfigs(viewType) {
        const all = await readAllConfigs();
        const list = all[viewType];
        return Array.isArray(list) ? list : [];
    }

    async function patchAll(allConfigs) {
        if (!window.AstroAPI?.patchAccountPreferences) {
            throw new Error('Preferences API is unavailable');
        }
        await window.AstroAPI.patchAccountPreferences({
            chart_defaults: { [STORAGE_NAMESPACE]: allConfigs },
        });
    }

    async function saveConfig(viewType, name, settings) {
        const all = await readAllConfigs();
        const list = Array.isArray(all[viewType]) ? all[viewType].slice() : [];
        const entry = {
            id: genId(),
            name: String(name || '').trim() || t('page.chart.presets.untitled', 'Untitled'),
            settings: clone(settings) || {},
            created_at: new Date().toISOString(),
        };
        list.push(entry);
        all[viewType] = list;
        await patchAll(all);
        return entry;
    }

    async function deleteConfig(viewType, id) {
        const all = await readAllConfigs();
        const list = Array.isArray(all[viewType]) ? all[viewType] : [];
        all[viewType] = list.filter((entry) => entry?.id !== id);
        await patchAll(all);
    }

    function showToast(message, kind) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, kind || 'success');
            return;
        }
        if (kind === 'error') console.error(message);
    }

    function buildButtons() {
        const row = document.createElement('div');
        row.className = 'chart-presets-row';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'preset-btn chart-presets-save-btn';
        saveBtn.innerHTML = `
            <svg class="chart-presets-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                <path d="M2.5 2.5h7l2 2v7a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"/>
                <path d="M4.5 2.5v3h5v-3"/>
                <path d="M4.5 12.5v-4h5v4"/>
            </svg>
            <span class="chart-presets-save-label"></span>
        `;
        saveBtn.querySelector('.chart-presets-save-label').textContent =
            t('page.chart.presets.saveBtn', 'Save configuration');

        const pickerBtn = document.createElement('button');
        pickerBtn.type = 'button';
        pickerBtn.className = 'preset-btn chart-presets-picker-btn';
        pickerBtn.setAttribute('aria-haspopup', 'true');
        pickerBtn.setAttribute('aria-expanded', 'false');
        pickerBtn.setAttribute('aria-label', t('page.chart.presets.pickerLabel', 'Saved configurations'));
        pickerBtn.innerHTML = `
            <svg class="chart-presets-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                <ellipse cx="7" cy="3" rx="5" ry="1.6"/>
                <path d="M2 3v4c0 0.9 2.2 1.6 5 1.6s5-0.7 5-1.6V3"/>
                <path d="M2 7v4c0 0.9 2.2 1.6 5 1.6s5-0.7 5-1.6V7"/>
            </svg>
        `;

        row.appendChild(saveBtn);
        row.appendChild(pickerBtn);

        const popover = document.createElement('div');
        popover.className = 'chart-presets-popover hidden';
        popover.setAttribute('role', 'menu');
        row.appendChild(popover);

        return { row, saveBtn, pickerBtn, popover };
    }

    function renderPopover(popover, entries, { onApply, onDelete }) {
        popover.innerHTML = '';
        const header = document.createElement('div');
        header.className = 'chart-presets-popover-header';
        header.textContent = t('page.chart.presets.pickerHeader', 'Saved configurations');
        popover.appendChild(header);

        if (!entries.length) {
            const empty = document.createElement('div');
            empty.className = 'chart-presets-popover-empty';
            empty.textContent = t('page.chart.presets.emptyList', 'No saved configurations yet');
            popover.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'chart-presets-popover-list';
        entries.forEach((entry) => {
            const item = document.createElement('div');
            item.className = 'chart-presets-popover-item';

            const apply = document.createElement('button');
            apply.type = 'button';
            apply.className = 'chart-presets-popover-apply';
            apply.textContent = entry.name || t('page.chart.presets.untitled', 'Untitled');
            apply.addEventListener('click', () => onApply(entry));

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'chart-presets-popover-delete';
            del.setAttribute('aria-label', t('page.chart.presets.deleteAria', 'Delete configuration'));
            del.innerHTML = `
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                    <path d="M3.5 3.5l7 7m0-7l-7 7"/>
                </svg>
            `;
            del.addEventListener('click', (event) => {
                event.stopPropagation();
                onDelete(entry);
            });

            item.appendChild(apply);
            item.appendChild(del);
            list.appendChild(item);
        });
        popover.appendChild(list);
    }

    function attach({ container, viewType, getSettings, applySettings, onApplied }) {
        if (!container || !viewType || typeof getSettings !== 'function' || typeof applySettings !== 'function') {
            return () => {};
        }

        const { row, saveBtn, pickerBtn, popover } = buildButtons();
        const settingsHeader = container.querySelector(':scope > .forecast-new-settings-head');
        if (settingsHeader) settingsHeader.after(row);
        else container.prepend(row);

        let popoverOpen = false;
        const setPopoverOpen = (open) => {
            popoverOpen = open;
            popover.classList.toggle('hidden', !open);
            pickerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        const refreshPopover = async () => {
            const entries = await listConfigs(viewType);
            renderPopover(popover, entries, {
                onApply: async (entry) => {
                    setPopoverOpen(false);
                    try {
                        await applySettings(clone(entry.settings) || {});
                        showToast(t('page.chart.presets.applied', 'Configuration applied'), 'success');
                        onApplied?.(entry);
                    } catch (err) {
                        showToast(err?.message || t('page.chart.presets.applyFailed', 'Failed to apply configuration'), 'error');
                    }
                },
                onDelete: async (entry) => {
                    const confirmMsg = t('page.chart.presets.deleteConfirm', 'Delete this configuration?');
                    if (!window.confirm(confirmMsg)) return;
                    try {
                        await deleteConfig(viewType, entry.id);
                        await refreshPopover();
                    } catch (err) {
                        showToast(err?.message || t('page.chart.presets.deleteFailed', 'Failed to delete configuration'), 'error');
                    }
                },
            });
        };

        saveBtn.addEventListener('click', async () => {
            const name = window.prompt(
                t('page.chart.presets.promptName', 'Configuration name'),
                t('page.chart.presets.defaultName', 'My configuration')
            );
            if (name === null) return;
            const trimmed = String(name).trim();
            if (!trimmed) return;
            try {
                const settings = await Promise.resolve(getSettings());
                await saveConfig(viewType, trimmed, settings);
                showToast(t('page.chart.presets.savedToast', 'Configuration saved'), 'success');
                if (popoverOpen) await refreshPopover();
            } catch (err) {
                showToast(err?.message || t('page.chart.presets.saveFailed', 'Failed to save configuration'), 'error');
            }
        });

        pickerBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const next = !popoverOpen;
            if (next) await refreshPopover();
            setPopoverOpen(next);
        });

        const outsideHandler = (event) => {
            if (!popoverOpen) return;
            if (popover.contains(event.target) || pickerBtn.contains(event.target)) return;
            setPopoverOpen(false);
        };
        document.addEventListener('click', outsideHandler);

        return () => {
            document.removeEventListener('click', outsideHandler);
            row.remove();
        };
    }

    window.ChartConfigPresets = {
        attach,
        list: listConfigs,
        save: saveConfig,
        delete: deleteConfig,
    };
})();
