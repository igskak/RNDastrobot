/* The subscriber's private report page. The signed link in ?t= is the only credential. */
(function () {
    'use strict';

    var API = '/api/v1/kundli';
    var ui = JSON.parse(document.getElementById('kundli-i18n').textContent);
    var token = new URLSearchParams(window.location.search).get('t');
    var container = document.getElementById('report');
    var manage = document.getElementById('manage');
    var manageButton = document.getElementById('manage-btn');
    var eraseButton = document.getElementById('erase-btn');
    var message = document.getElementById('manage-message');

    function el(tag, props, children) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (key) {
            if (key === 'text') node.textContent = props[key];
            else if (key === 'class') node.className = props[key];
            else node.setAttribute(key, props[key]);
        });
        [].concat(children || []).forEach(function (child) { if (child) node.appendChild(child); });
        return node;
    }

    function post(path) {
        return fetch(API + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token }),
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                if (!response.ok) { var error = new Error('http'); error.status = response.status; throw error; }
                return data;
            });
        });
    }

    function say(text) { message.textContent = text; message.hidden = !text; }
    function show(text) { container.textContent = ''; container.appendChild(el('p', { text: text })); }

    function renderReport(report) {
        var nodes = [el('h2', { text: report.title })];
        if (report.greeting) nodes.push(el('p', { class: 'greeting', text: report.greeting }));
        nodes.push(el('p', { class: 'headline', text: report.headline }));
        report.sections.forEach(function (section) {
            nodes.push(el('h3', { text: section.title }));
            section.paragraphs.forEach(function (paragraph) { nodes.push(el('p', { text: paragraph })); });
            if (section.items.length) {
                nodes.push(el('ul', { class: 'items' }, section.items.map(function (item) {
                    return el('li', {}, [el('strong', { text: item.label }), el('span', { text: ' ' + item.text })]);
                })));
            }
        });
        nodes.push(el('p', { class: 'disclaimer', text: report.disclaimer }));
        return el('article', { class: 'card report-block' }, nodes);
    }

    if (!token) { show(ui.reportInvalid); return; }

    post('/report').then(function (bundle) {
        container.textContent = '';
        ['week', 'dasha', 'sade_sati'].forEach(function (key) { container.appendChild(renderReport(bundle[key])); });
        manage.hidden = false;
    }).catch(function (error) {
        if (error.status === 404) { show(ui.reportInvalid); return; }
        if (error.status === 403) { show(ui.reportNoAccess); manage.hidden = false; return; }
        show(ui.reportError);
    });

    manageButton.addEventListener('click', function () {
        say('');
        manageButton.disabled = true;
        manageButton.textContent = manageButton.getAttribute('data-busy');
        post('/portal').then(function (data) {
            if (data.url && /^https:\/\//.test(data.url)) window.location.href = data.url;
            else throw new Error('no url');
        }).catch(function () {
            say(ui.errorGeneric);
            manageButton.disabled = false;
            manageButton.textContent = manageButton.getAttribute('data-label');
        });
    });

    eraseButton.addEventListener('click', function () {
        say('');
        if (!window.confirm(ui.eraseConfirm)) return;
        eraseButton.disabled = true;
        post('/erase').then(function () {
            container.textContent = '';
            manage.hidden = true;
            show(ui.erased);
        }).catch(function () {
            say(ui.eraseError);
            eraseButton.disabled = false;
        });
    });
})();
