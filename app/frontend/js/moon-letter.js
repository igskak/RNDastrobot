/* The moon letter page, reached through the signed link in every email (or a fresh one from
   "send me my link"). Shows the current lunation in the subscriber's house with a field under
   each question; answers are saved to the subscriber's journal on the server as they type, so
   they are there on any device. Also: the personal-month interest button, which records
   interest and charges nothing, and unsubscribe / delete. */
(function () {
    'use strict';

    var API = '/api/v1/moon';
    var SAVE_DELAY = 800;
    var ui = JSON.parse(document.getElementById('moon-i18n').textContent);
    var params = new URLSearchParams(window.location.search);
    var token = params.get('t') || '';
    var confirming = params.get('confirm') === '1';

    var letter = document.getElementById('letter');
    var status = document.getElementById('letter-status');
    var history = document.getElementById('history');
    var historyList = document.getElementById('history-list');
    var offer = document.getElementById('journal-offer');
    var offerButton = document.getElementById('offer-btn');
    var offerThanks = document.getElementById('offer-thanks');
    var manage = document.getElementById('manage');
    var manageMessage = document.getElementById('manage-message');
    var journal = [];

    function t(key, vars) {
        var text = Object.prototype.hasOwnProperty.call(ui, key) ? ui[key] : key;
        Object.keys(vars || {}).forEach(function (name) { text = text.split('{' + name + '}').join(String(vars[name])); });
        return text;
    }

    function el(tag, props, children) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            if (key === 'text') node.textContent = props[key];
            else if (key === 'class') node.className = props[key];
            else node.setAttribute(key, props[key]);
        });
        [].concat(children || []).forEach(function (child) {
            if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return node;
    }

    function post(path, payload) {
        return fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok) { var error = new Error('http'); error.status = response.status; throw error; }
                return data;
            });
        });
    }

    function showMessage(node, text) {
        node.textContent = text || '';
        node.hidden = !text;
    }

    /* ---- the journal: what the server returned, kept in step with each save ---- */
    function remember(lun, index, question, answer) {
        var group = journal.filter(function (g) { return g.utc === lun.utc; })[0];
        if (!group) {
            group = { utc: lun.utc, kind: lun.kind, label: lun.kind_label + ' · ' + lun.date_label, entries: [] };
            journal.unshift(group);
        }
        group.entries = group.entries.filter(function (e) { return e.index !== index; });
        if (answer.trim()) group.entries.push({ index: index, question: question, answer: answer });
        group.entries.sort(function (a, b) { return a.index - b.index; });
        journal = journal.filter(function (g) { return g.entries.length; });
    }

    function renderHistory() {
        historyList.textContent = '';
        if (!journal.length) {
            historyList.appendChild(el('p', { class: 'hint', text: t('historyEmpty') }));
            return;
        }
        journal.forEach(function (group) {
            var nodes = [el('h3', { text: group.label })];
            group.entries.forEach(function (entry) {
                if (entry.question) nodes.push(el('p', { class: 'hint', text: entry.question }));
                nodes.push(el('p', { text: entry.answer }));
            });
            historyList.appendChild(el('div', { class: 'entry' }, nodes));
        });
    }

    function answerOf(lun, index) {
        var group = journal.filter(function (g) { return g.utc === lun.utc; })[0];
        var entry = group && group.entries.filter(function (e) { return e.index === index; })[0];
        return entry ? entry.answer : '';
    }

    /* ---- the letter ---- */
    function answerField(lun, prompt, index, writable) {
        var id = 'answer-' + index;
        var area = el('textarea', { id: id, placeholder: t('writePlaceholder'), rows: '4' });
        area.value = answerOf(lun, index);
        area.disabled = !writable;
        var saved = el('p', { class: 'saved', 'aria-live': 'polite' });
        var pending = null;
        var sequence = 0;
        area.addEventListener('input', function () {
            clearTimeout(pending);
            saved.textContent = '';
            pending = setTimeout(function () {
                var mine = ++sequence;
                var answer = area.value;
                saved.textContent = t('saving');
                post('/journal/save', { token: token, lunation_utc: lun.utc, kind: lun.kind, index: index, question: prompt, answer: answer })
                    .then(function () {
                        if (mine !== sequence) return;
                        saved.textContent = t('saved');
                        remember(lun, index, prompt, answer);
                        renderHistory();
                    })
                    .catch(function () { if (mine === sequence) saved.textContent = t('saveError'); });
            }, SAVE_DELAY);
        });
        return el('li', { class: 'answer' }, [el('label', { for: id, text: prompt }), area, saved]);
    }

    function renderLetter(data) {
        var lun = data.current;
        var next = data.next;
        var writable = data.status !== 'pending';
        journal = data.journal || [];
        letter.textContent = '';
        letter.appendChild(el('article', { class: 'card lunation' }, [
            el('h2', { text: t('currentTitle') }),
            el('h3', {}, [el('span', { class: 'phase phase-' + (lun.kind === 'new_moon' ? 'new' : 'full'), 'aria-hidden': 'true' }), lun.headline]),
            el('p', { class: 'when', text: lun.date_label }),
            el('p', { text: lun.theme }),
            el('ol', { class: 'prompts' }, lun.prompts.map(function (prompt, i) { return answerField(lun, prompt, i, writable); })),
            el('p', { class: 'affirmation' }, [el('strong', { text: t('affirmationTitle') }), lun.affirmation]),
            el('p', { class: 'note', text: lun.frame_note }),
            el('p', { text: t('nextLine', { kind: next.kind_label, date: next.date_label, sign_in: next.sign_in, house: next.house }) }),
        ]));
        history.hidden = false;
        renderHistory();
        manage.hidden = false;
        if (data.status === 'confirmed') {
            offer.hidden = false;
            if (data.interested) { offerButton.hidden = true; offerThanks.hidden = false; }
        }
        if (window.location.hash === '#manage') manage.scrollIntoView();
    }

    function statusText(data) {
        if (data.status === 'pending') return t('pending');
        if (data.status === 'unsubscribed') return t('unsubscribedNote');
        return confirming ? t('confirmed') : '';
    }

    function invalid() {
        letter.textContent = '';
        letter.appendChild(el('p', { class: 'error', text: t('invalidLink') }));
    }

    if (!token) {
        invalid();
        return;
    }

    post('/letter', { token: token, confirm: confirming }).then(function (data) {
        showMessage(status, statusText(data));
        renderLetter(data);
    }).catch(function (error) {
        if (error && (error.status === 404 || error.status === 422)) invalid();
        else {
            letter.textContent = '';
            letter.appendChild(el('p', { class: 'error', text: error && error.status ? t('errorGeneric') : t('errorNetwork') }));
        }
    });

    /* ---- the personal-month interest button and self service ---- */
    offerButton.addEventListener('click', function () {
        offerButton.disabled = true;
        post('/interest', { token: token }).then(function () {
            offerButton.hidden = true;
            offerThanks.hidden = false;
        }).catch(function () {
            offerButton.disabled = false;
        });
    });

    document.getElementById('unsubscribe-btn').addEventListener('click', function () {
        post('/unsubscribe', { token: token })
            .then(function () { showMessage(manageMessage, t('unsubscribed')); offer.hidden = true; })
            .catch(function () { showMessage(manageMessage, t('manageError')); });
    });

    document.getElementById('erase-btn').addEventListener('click', function () {
        if (!window.confirm(t('eraseConfirm'))) return;
        post('/erase', { token: token })
            .then(function () {
                letter.textContent = '';
                history.hidden = true;
                offer.hidden = true;
                manage.hidden = true;
                showMessage(status, t('erased'));
            })
            .catch(function () { showMessage(manageMessage, t('manageError')); });
    });
})();
