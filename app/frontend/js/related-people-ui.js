(function (root) {
    'use strict';

    const API_BASE = root.AstroAPI?.API_BASE_URL
        || (root.location?.hostname === 'localhost' ? 'http://localhost:8000/api/v1' : '/api/v1');

    function t(key, params) {
        return root.FrontendI18n?.t?.(key, params) || key;
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value ?? '');
        return div.innerHTML;
    }

    function withLocaleHeaders(headers = {}) {
        return root.AstroAPI?.withLocaleHeaders ? root.AstroAPI.withLocaleHeaders(headers) : headers;
    }

    function apiFetch(url, init = {}) {
        return fetch(url, {
            credentials: 'include',
            ...init,
            headers: withLocaleHeaders(init.headers || {}),
        });
    }

    function formatDate(isoDate) {
        if (root.LocaleFormatters?.formatDate) {
            return root.LocaleFormatters.formatDate(isoDate);
        }
        if (!isoDate) return '';
        const parts = String(isoDate).split('T')[0].split('-');
        if (parts.length !== 3) return String(isoDate);
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    function formatRelatedPersonName(person) {
        return [person?.first_name, person?.last_name].filter(Boolean).join(' ') || t('common.notAvailable');
    }

    function formatRelatedPersonMeta(person) {
        const details = [];
        if (person?.birth_date) details.push(formatDate(person.birth_date));
        if (person?.birth_time) details.push(String(person.birth_time).slice(0, 5));
        if (person?.birth_place) details.push(person.birth_place);
        return details.join(' · ') || t('common.notAvailable');
    }

    async function fetchCandidateUsers() {
        const response = await apiFetch(`${API_BASE}/users`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(t('page.clientProfile.related.loadCandidatesFailed'));
        }
        const payload = await response.json();
        return Array.isArray(payload) ? payload : [];
    }

    function buildRelatedPickerCandidates(users, { currentUserId, relatedPeople = [] } = {}) {
        const existingIds = new Set((relatedPeople || []).map((person) => String(person.user_id || '')));
        return (Array.isArray(users) ? users : [])
            .filter((user) => {
                const candidateId = String(user.user_id || '');
                return candidateId && candidateId !== String(currentUserId || '') && !existingIds.has(candidateId);
            })
            .sort((left, right) => {
                const leftName = formatRelatedPersonName(left);
                const rightName = formatRelatedPersonName(right);
                return leftName.localeCompare(rightName, root.FrontendI18n?.getLocale?.() || 'en', {
                    sensitivity: 'base',
                    numeric: true,
                });
            });
    }

    function openSynastry(clientUserId, partnerUserId) {
        if (!clientUserId || !partnerUserId) return;
        const sourcePath = root.location.pathname || '/';
        const sourceView = sourcePath.startsWith('/client/')
            ? 'client-profile'
            : sourcePath.endsWith('/forecast-new.html')
                ? 'forecast-new'
                : sourcePath.endsWith('/natal-full.html')
                    ? 'natal-full'
                    : 'clients';

        root.AstroAPI?.openForecastForSynastry?.(clientUserId, partnerUserId, {
            sourceView,
            sourceUrl: `${sourcePath}${root.location.search || ''}`,
        });
    }

    function createRelatedPeoplePicker(options = {}) {
        const refs = options.refs || {};
        const state = {
            bound: false,
            users: [],
            filteredUsers: [],
            selectedUserId: null,
        };

        function updateVisibility(isOpen) {
            refs.backdrop?.classList.toggle('hidden', !isOpen);
            refs.dialog?.classList.toggle('hidden', !isOpen);
            options.onVisibilityChange?.(isOpen);
        }

        function setSubmitting(isSubmitting) {
            if (!refs.submit) return;
            refs.submit.disabled = isSubmitting;
            refs.submit.querySelector('.btn-text')?.classList.toggle('hidden', isSubmitting);
            refs.submit.querySelector('.btn-loader')?.classList.toggle('hidden', !isSubmitting);
        }

        function renderList() {
            if (!refs.list || !refs.empty) return;

            if (!state.filteredUsers.length) {
                refs.list.innerHTML = '';
                refs.empty.classList.remove('hidden');
                return;
            }

            refs.empty.classList.add('hidden');
            refs.list.innerHTML = state.filteredUsers.map((user) => {
                const candidateId = String(user.user_id || '');
                const selected = candidateId === String(state.selectedUserId);
                return `
                    <button
                        type="button"
                        class="related-picker-option${selected ? ' selected' : ''}"
                        data-user-id="${escapeHtml(candidateId)}"
                        aria-pressed="${selected ? 'true' : 'false'}"
                    >
                        <span class="related-picker-name">${escapeHtml(formatRelatedPersonName(user))}</span>
                        <span class="related-picker-meta">${escapeHtml(formatRelatedPersonMeta(user))}</span>
                    </button>
                `;
            }).join('');
        }

        function filterUsers(searchTerm) {
            const needle = String(searchTerm || '').trim().toLowerCase();
            state.filteredUsers = !needle
                ? [...state.users]
                : state.users.filter((user) => {
                    const haystack = [
                        user.first_name,
                        user.last_name,
                        user.birth_place,
                        user.birth_date,
                        user.birth_time,
                    ].filter(Boolean).join(' ').toLowerCase();
                    return haystack.includes(needle);
                });

            if (!state.filteredUsers.some((user) => String(user.user_id) === String(state.selectedUserId))) {
                state.selectedUserId = state.filteredUsers[0]?.user_id
                    ? String(state.filteredUsers[0].user_id)
                    : null;
            }

            renderList();
        }

        async function open() {
            try {
                setSubmitting(false);
                refs.error?.classList.add('hidden');
                if (refs.error) refs.error.textContent = '';
                if (refs.search) refs.search.value = '';
                if (refs.relationLabel) refs.relationLabel.value = '';
                state.selectedUserId = null;

                const users = await (options.loadUsers || fetchCandidateUsers)();
                state.users = buildRelatedPickerCandidates(users, {
                    currentUserId: options.getCurrentUserId?.(),
                    relatedPeople: options.getExistingRelatedPeople?.() || [],
                });
                filterUsers('');
                updateVisibility(true);
                refs.search?.focus();
            } catch (error) {
                options.onOpenError?.(error);
            }
        }

        function close(reason = 'close') {
            updateVisibility(false);
            refs.error?.classList.add('hidden');
            if (refs.error) refs.error.textContent = '';
            state.selectedUserId = null;
            options.onClose?.(reason);
        }

        async function handleSubmit() {
            if (!state.selectedUserId) {
                if (refs.error) {
                    refs.error.textContent = t('page.clientProfile.related.selectCandidate');
                    refs.error.classList.remove('hidden');
                }
                return;
            }

            refs.error?.classList.add('hidden');
            if (refs.error) refs.error.textContent = '';
            setSubmitting(true);

            try {
                const payload = await root.AstroAPI.linkRelatedPerson(options.getCurrentUserId?.(), {
                    related_user_id: state.selectedUserId,
                    relation_label: refs.relationLabel?.value?.trim() || '',
                });
                close('linked');
                await options.onLinked?.(
                    payload,
                    state.users.find((user) => String(user.user_id) === String(state.selectedUserId)) || null,
                );
            } catch (error) {
                if (refs.error) {
                    refs.error.textContent = error.message || t('page.clientProfile.related.linkFailed');
                    refs.error.classList.remove('hidden');
                }
            } finally {
                setSubmitting(false);
            }
        }

        function init() {
            if (state.bound || !refs.dialog) return;
            state.bound = true;

            refs.close?.addEventListener('click', () => close('cancel'));
            refs.cancel?.addEventListener('click', () => close('cancel'));
            refs.backdrop?.addEventListener('click', () => close('cancel'));
            refs.search?.addEventListener('input', () => filterUsers(refs.search.value || ''));
            refs.list?.addEventListener('click', (event) => {
                const option = event.target.closest('.related-picker-option[data-user-id]');
                if (!option) return;
                state.selectedUserId = option.dataset.userId;
                renderList();
            });
            refs.submit?.addEventListener('click', handleSubmit);

            document.addEventListener('keydown', (event) => {
                if (event.key !== 'Escape' || refs.dialog.classList.contains('hidden')) return;
                close('cancel');
            });
        }

        return {
            init,
            open,
            close,
            refreshLocale() {
                renderList();
            },
        };
    }

    root.RelatedPeopleUI = {
        buildRelatedPickerCandidates,
        createRelatedPeoplePicker,
        formatRelatedPersonMeta,
        formatRelatedPersonName,
        openSynastry,
    };
})(typeof window !== 'undefined' ? window : globalThis);
