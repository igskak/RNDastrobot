(function (root) {
    'use strict';

    const state = {
        batch: null,
        items: [],
        selected: new Set(),
        people: [],
        step: 'file',
        running: false,
        pauseRequested: false,
    };

    const refs = {};

    function t(key, params) {
        return root.FrontendI18n?.t?.(key, params) || key;
    }

    function collectRefs() {
        refs.root = document.getElementById('chartImportRoot');
        if (!refs.root) return false;
        refs.file = document.getElementById('chartImportFile');
        refs.dropzone = document.getElementById('chartImportDropzone');
        refs.error = document.getElementById('chartImportError');
        refs.status = document.getElementById('chartImportStatus');
        refs.summary = document.getElementById('chartImportSummary');
        refs.rows = document.getElementById('chartImportRows');
        refs.reviewContinue = document.getElementById('chartImportReviewContinue');
        refs.profileFields = document.getElementById('chartImportProfileFields');
        refs.profileSelect = document.getElementById('chartImportProfileSelect');
        refs.newProfileField = document.getElementById('chartImportNewProfileField');
        refs.profileName = document.getElementById('chartImportProfileName');
        refs.tags = document.getElementById('chartImportTags');
        refs.houseSystem = document.getElementById('chartImportHouseSystem');
        refs.finalSummary = document.getElementById('chartImportFinalSummary');
        refs.start = document.getElementById('chartImportStart');
        refs.pause = document.getElementById('chartImportPause');
        refs.progress = document.getElementById('chartImportProgress');
        refs.progressText = document.getElementById('chartImportProgressText');
        refs.progressCount = document.getElementById('chartImportProgressCount');
        refs.progressBar = document.getElementById('chartImportProgressBar');
        refs.result = document.getElementById('chartImportResult');
        refs.resultCopy = document.getElementById('chartImportResultCopy');
        refs.again = document.getElementById('chartImportAgain');
        refs.recent = document.getElementById('chartImportRecent');
        refs.recentList = document.getElementById('chartImportRecentList');
        return true;
    }

    function setError(message) {
        refs.error.textContent = message || '';
        refs.error.classList.toggle('hidden', !message);
        if (message) refs.error.focus();
    }

    function setStatus(message) {
        refs.status.textContent = message || '';
    }

    function setStep(step) {
        state.step = step;
        refs.root.querySelectorAll('[data-import-step]').forEach((panel) => {
            panel.classList.toggle('hidden', panel.dataset.importStep !== step);
        });
        refs.root.querySelectorAll('[data-import-step-indicator]').forEach((item) => {
            const order = ['file', 'review', 'save'];
            const current = order.indexOf(step);
            const own = order.indexOf(item.dataset.importStepIndicator);
            item.classList.toggle('is-active', own === current);
            item.classList.toggle('is-complete', own < current);
        });
        refs.result.classList.add('hidden');
        setError('');
    }

    function issueLabel(issue) {
        const key = `page.accountSettings.import.issues.${issue.code}`;
        const translated = t(key);
        return translated === key ? t('page.accountSettings.import.issues.unknown') : translated;
    }

    function statusLabel(item) {
        const issue = (item.issues || []).find((entry) => entry.severity === 'error')
            || (item.issues || [])[0];
        if (issue) return issueLabel(issue);
        return t(`page.accountSettings.import.status.${item.status}`);
    }

    function isSelectable(item) {
        return !['error', 'already_imported', 'imported', 'skipped'].includes(item.status);
    }

    function defaultSelected(item) {
        return isSelectable(item) && item.status !== 'possible_duplicate';
    }

    function formatLocal(record) {
        const time = String(record.local_time || '').replace(/:00$/, '');
        return `${record.local_date || '—'} ${time || '—'}`;
    }

    function renderRows() {
        refs.rows.replaceChildren();
        const selectionFrozen = ['confirmed', 'processing', 'paused'].includes(state.batch?.status);
        state.items.forEach((item) => {
            const record = item.record || {};
            const row = document.createElement('tr');
            const selectCell = document.createElement('td');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = state.selected.has(item.id);
            checkbox.disabled = !isSelectable(item) || state.running || selectionFrozen;
            checkbox.setAttribute('aria-label', t('page.accountSettings.import.review.selectChart', { name: record.title || '' }));
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) state.selected.add(item.id);
                else state.selected.delete(item.id);
                updateReviewActions();
            });
            selectCell.appendChild(checkbox);

            const titleCell = document.createElement('td');
            titleCell.textContent = record.title || '—';
            const timeCell = document.createElement('td');
            timeCell.className = 'chart-import-time';
            const mainTime = document.createElement('div');
            mainTime.textContent = formatLocal(record);
            const offset = document.createElement('span');
            offset.className = 'chart-import-offset';
            offset.textContent = record.timezone || '—';
            const help = document.createElement('button');
            help.type = 'button';
            help.className = 'chart-import-tooltip';
            help.textContent = '?';
            help.setAttribute('aria-label', t('page.accountSettings.import.utc.title'));
            help.setAttribute('aria-expanded', 'false');
            const helpCopy = document.createElement('div');
            helpCopy.className = 'chart-import-tooltip-copy hidden';
            helpCopy.textContent = t('page.accountSettings.import.utc.copy');
            help.addEventListener('click', () => {
                const open = helpCopy.classList.toggle('hidden') === false;
                help.setAttribute('aria-expanded', String(open));
            });
            offset.appendChild(help);
            timeCell.append(mainTime, offset, helpCopy);

            const placeCell = document.createElement('td');
            placeCell.textContent = record.place || '—';
            const statusCell = document.createElement('td');
            statusCell.textContent = statusLabel(item);
            statusCell.dataset.importStatus = item.status;
            row.append(selectCell, titleCell, timeCell, placeCell, statusCell);
            refs.rows.appendChild(row);
        });
        updateReviewActions();
    }

    function updateReviewActions() {
        const count = state.selected.size;
        refs.reviewContinue.disabled = count === 0;
        refs.reviewContinue.textContent = t('page.accountSettings.import.review.continueCount', { count });
        refs.summary.textContent = t('page.accountSettings.import.review.summary', {
            total: state.batch?.total || state.items.length,
            ready: state.batch?.ready || 0,
            warnings: state.batch?.warnings || 0,
            errors: state.batch?.errors || 0,
        });
    }

    async function fetchAllItems(batch) {
        if ((batch.items || []).length >= batch.total) return batch.items || [];
        const all = [];
        for (let offset = 0; offset < batch.total; offset += 100) {
            const page = await root.AstroAPI.getChartImportItems(batch.id, offset, 100);
            all.push(...page.items);
        }
        return all;
    }

    async function loadBatch(batch, { preserveSelection = false } = {}) {
        state.batch = batch;
        state.items = await fetchAllItems(batch);
        const hasConfirmedSelection = ['confirmed', 'processing', 'paused', 'completed'].includes(batch.status);
        state.selected = new Set(state.items.filter((item) => {
            if (!isSelectable(item)) return false;
            if (preserveSelection) return state.selected.has(item.id) && item.selected;
            if (hasConfirmedSelection) return item.selected;
            return defaultSelected(item);
        }).map((item) => item.id));
        const config = batch.configuration || {};
        if (config.placement) {
            const radio = refs.root.querySelector(`input[name="chartImportPlacement"][value="${config.placement}"]`);
            if (radio) radio.checked = true;
        }
        if (config.person_id) refs.profileSelect.value = config.person_id;
        if (config.new_profile_name) refs.profileName.value = config.new_profile_name;
        if (Array.isArray(config.tags)) refs.tags.value = config.tags.join(', ');
        if (config.house_system) refs.houseSystem.value = config.house_system;
        const basename = String(batch.original_filename || '').replace(/\.[^.]+$/, '');
        if (!config.new_profile_name) refs.profileName.value = basename;
        renderRows();
        setStep(batch.status === 'confirmed' || batch.status === 'processing' || batch.status === 'paused' ? 'save' : 'review');
        updateDestinationSummary();
    }

    async function upload(file) {
        if (!file) return;
        setError('');
        setStatus(t('page.accountSettings.import.file.reading'));
        refs.file.disabled = true;
        try {
            await loadBatch(await root.AstroAPI.previewChartImport(file));
            setStatus('');
        } catch (error) {
            setStatus('');
            setError(error.message || t('page.accountSettings.import.errors.read'));
        } finally {
            refs.file.disabled = false;
            refs.file.value = '';
        }
    }

    function placement() {
        return refs.root.querySelector('input[name="chartImportPlacement"]:checked')?.value || 'library';
    }

    function updateProfileFields() {
        const profileMode = placement() === 'profile';
        refs.profileFields.classList.toggle('hidden', !profileMode);
        refs.newProfileField.classList.toggle('hidden', !profileMode || refs.profileSelect.value !== 'new');
        updateDestinationSummary();
    }

    function tags() {
        return [...new Set(refs.tags.value.split(',').map((value) => value.trim()).filter(Boolean))];
    }

    function updateDestinationSummary() {
        if (!state.batch) return;
        const count = state.selected.size;
        if (placement() === 'profile') {
            const selectedOption = refs.profileSelect.selectedOptions[0];
            const name = refs.profileSelect.value === 'new' ? refs.profileName.value.trim() : selectedOption?.textContent;
            refs.finalSummary.textContent = t('page.accountSettings.import.destination.profileSummary', { count, name: name || '—' });
        } else {
            refs.finalSummary.textContent = t('page.accountSettings.import.destination.librarySummary', {
                count,
                tags: tags().join(', ') || t('page.accountSettings.import.destination.noTags'),
            });
        }
        refs.start.textContent = t('page.accountSettings.import.actions.importCount', { count });
        refs.start.disabled = count === 0 || state.running;
    }

    function selectedItems() {
        return state.items.filter((item) => state.selected.has(item.id) && !['imported', 'skipped'].includes(item.status));
    }

    async function runImport() {
        if (!state.batch || state.running) return;
        const profileMode = placement() === 'profile';
        if (profileMode && refs.profileSelect.value === 'new' && !refs.profileName.value.trim()) {
            setError(t('page.accountSettings.import.errors.profileName'));
            refs.profileName.focus();
            return;
        }
        state.running = true;
        state.pauseRequested = false;
        refs.pause.disabled = false;
        setError('');
        refs.start.disabled = true;
        refs.pause.classList.remove('hidden');
        refs.progress.classList.remove('hidden');
        const items = selectedItems();
        refs.progressBar.max = items.length;
        refs.progressBar.value = 0;
        try {
            const personId = profileMode && refs.profileSelect.value !== 'new' ? refs.profileSelect.value : null;
            if (!['confirmed', 'processing', 'paused'].includes(state.batch.status)) {
                state.batch = await root.AstroAPI.confirmChartImport(state.batch.id, {
                    item_ids: items.map((item) => item.id),
                    placement: profileMode ? 'profile' : 'library',
                    person_id: personId,
                    new_profile_name: profileMode && !personId ? refs.profileName.value.trim() : null,
                    tags: tags(),
                    house_system: refs.houseSystem.value,
                    acknowledged_warning_item_ids: items.filter((item) => (item.issues || []).length).map((item) => item.id),
                });
            }
            let imported = 0;
            let failed = 0;
            for (const item of items) {
                if (state.pauseRequested) break;
                refs.progressText.textContent = t('page.accountSettings.import.progress.saving');
                refs.progressCount.textContent = t('page.accountSettings.import.progress.count', { current: imported + failed, total: items.length });
                const result = await root.AstroAPI.commitChartImportItem(state.batch.id, item.id);
                if (result.status === 'imported') imported += 1;
                else failed += 1;
                refs.progressBar.value = imported + failed;
            }
            if (imported > 0) {
                await root.AstroOnboarding?.recordImportedChart?.('chart_import');
            }
            if (state.pauseRequested) {
                await root.AstroAPI.pauseChartImport(state.batch.id);
                setStatus(t('page.accountSettings.import.progress.paused'));
                state.batch = await root.AstroAPI.getChartImport(state.batch.id);
                await loadBatch(state.batch, { preserveSelection: true });
                return;
            }
            if (failed > 0) {
                state.batch = await root.AstroAPI.getChartImport(state.batch.id);
                await loadBatch(state.batch);
                setError(t('page.accountSettings.import.result.copy', { imported, failed }));
                return;
            }
            refs.resultCopy.textContent = t('page.accountSettings.import.result.copy', { imported, failed });
            refs.root.querySelectorAll('[data-import-step]').forEach((panel) => panel.classList.add('hidden'));
            refs.result.classList.remove('hidden');
            refs.result.focus();
        } catch (error) {
            setError(error.message || t('page.accountSettings.import.errors.save'));
        } finally {
            state.running = false;
            refs.pause.classList.add('hidden');
            refs.start.disabled = false;
            updateDestinationSummary();
        }
    }

    function populatePeople() {
        refs.profileSelect.querySelectorAll('option:not([value="new"])').forEach((option) => option.remove());
        state.people.forEach((person) => {
            const option = document.createElement('option');
            option.value = person.person_id;
            option.textContent = person.display_name || [person.first_name, person.last_name].filter(Boolean).join(' ');
            refs.profileSelect.appendChild(option);
        });
    }

    function renderRecent(batches) {
        const active = batches.filter((batch) => !['completed', 'expired'].includes(batch.status));
        refs.recent.classList.toggle('hidden', active.length === 0);
        refs.recentList.replaceChildren();
        active.forEach((batch) => {
            const row = document.createElement('div');
            row.className = 'chart-import-recent-item';
            const label = document.createElement('span');
            label.textContent = `${batch.original_filename} · ${batch.imported}/${batch.selected || batch.total}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'ui-btn ui-btn--secondary ui-btn--sm';
            button.textContent = t('page.accountSettings.import.recent.continue');
            button.addEventListener('click', async () => {
                try {
                    await loadBatch(await root.AstroAPI.getChartImport(batch.id));
                } catch (error) {
                    setError(error.message);
                }
            });
            row.append(label, button);
            refs.recentList.appendChild(row);
        });
    }

    function bind() {
        refs.file.addEventListener('change', () => upload(refs.file.files?.[0]));
        ['dragenter', 'dragover'].forEach((name) => refs.dropzone.addEventListener(name, (event) => {
            event.preventDefault();
            refs.dropzone.classList.add('is-dragging');
        }));
        ['dragleave', 'drop'].forEach((name) => refs.dropzone.addEventListener(name, (event) => {
            event.preventDefault();
            refs.dropzone.classList.remove('is-dragging');
        }));
        refs.dropzone.addEventListener('drop', (event) => upload(event.dataTransfer?.files?.[0]));
        refs.reviewContinue.addEventListener('click', () => {
            setStep('save');
            updateDestinationSummary();
        });
        refs.root.querySelector('[data-import-back]')?.addEventListener('click', () => setStep('file'));
        refs.root.querySelector('[data-import-back-review]')?.addEventListener('click', () => setStep('review'));
        refs.root.querySelectorAll('input[name="chartImportPlacement"]').forEach((input) => input.addEventListener('change', updateProfileFields));
        [refs.profileSelect, refs.profileName, refs.tags].forEach((control) => {
            control.addEventListener('input', updateDestinationSummary);
            control.addEventListener('change', updateProfileFields);
        });
        refs.start.addEventListener('click', runImport);
        refs.pause.addEventListener('click', () => {
            state.pauseRequested = true;
            refs.pause.disabled = true;
        });
        refs.again.addEventListener('click', () => {
            Object.assign(state, { batch: null, items: [], selected: new Set(), running: false, pauseRequested: false });
            refs.progress.classList.add('hidden');
            refs.pause.disabled = false;
            setStep('file');
        });
        document.addEventListener('frontend:locale-changed', () => {
            if (state.step === 'review') renderRows();
            updateDestinationSummary();
        });
    }

    async function init() {
        if (!collectRefs()) return;
        bind();
        setStep('file');
        try {
            const astrologer = await root.AstroAPI?.requireAuth?.({ redirectTo: '/login.html' });
            const defaultHouseSystem = astrologer?.default_house_system;
            const supportsDefaultHouseSystem = Array.from(refs.houseSystem.options)
                .some((option) => option.value === defaultHouseSystem);
            if (supportsDefaultHouseSystem) {
                refs.houseSystem.value = defaultHouseSystem;
            }
            const [people, batches] = await Promise.all([
                root.AstroAPI.listPeople(),
                root.AstroAPI.listChartImports(),
            ]);
            state.people = people || [];
            populatePeople();
            renderRecent(batches || []);
            const batchId = new URLSearchParams(root.location.search).get('import');
            if (batchId) await loadBatch(await root.AstroAPI.getChartImport(batchId));
        } catch (error) {
            setError(error.message || t('page.accountSettings.import.errors.load'));
        }
    }

    root.ChartImport = { init, getState: () => ({ ...state, selected: [...state.selected] }) };
    document.addEventListener('DOMContentLoaded', init);
})(typeof window !== 'undefined' ? window : globalThis);
