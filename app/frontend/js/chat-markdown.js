/**
 * The small markdown subset the assistant is told to write (see the OUTPUT
 * rules in astro_assistant_service.py): paragraphs, **bold**, *italic*,
 * `code`, "- " bullets and "1. " / "1) " numbered lists.
 *
 * Built with createElement + textContent only. Assistant text carries chart
 * labels and names from the database, so it must never reach innerHTML.
 * Exposes `window.ChatMarkdown` in browser and `module.exports` in Node.
 */
(function() {
    'use strict';

    const BULLET = /^\s*[-*•]\s+(.*)$/;
    const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
    const HEADING = /^\s*#{1,6}\s+(.*)$/;
    // Bold first so "**x**" is not read as two empty italics. Single-asterisk
    // italics need a non-space on both inner edges, so "3 * 4" stays literal.
    // Underscores are left alone: timezone names like America/Los_Angeles.
    const INLINE = /\*\*([^*\n]+?)\*\*|`([^`\n]+)`|\*(?=\S)([^*\n]*?\S)\*/g;

    function appendInline(parent, text, doc) {
        let last = 0;
        INLINE.lastIndex = 0;
        let match;
        while ((match = INLINE.exec(text)) !== null) {
            if (match.index > last) {
                parent.appendChild(doc.createTextNode(text.slice(last, match.index)));
            }
            let el;
            if (match[1] !== undefined) {
                el = doc.createElement('strong');
                el.textContent = match[1];
            } else if (match[2] !== undefined) {
                el = doc.createElement('code');
                el.textContent = match[2];
            } else {
                el = doc.createElement('em');
                el.textContent = match[3];
            }
            parent.appendChild(el);
            last = INLINE.lastIndex;
        }
        if (last < text.length) parent.appendChild(doc.createTextNode(text.slice(last)));
    }

    function appendLines(parent, lines, doc) {
        lines.forEach((line, i) => {
            if (i > 0) parent.appendChild(doc.createElement('br'));
            appendInline(parent, line, doc);
        });
    }

    function lineKind(line) {
        if (NUMBERED.test(line)) return 'ol';
        if (BULLET.test(line)) return 'ul';
        return 'p';
    }

    function renderBlock(container, lines, doc) {
        let i = 0;
        while (i < lines.length) {
            const heading = lines[i].match(HEADING);
            if (heading) {
                const p = doc.createElement('p');
                p.className = 'chat-md-heading';
                const strong = doc.createElement('strong');
                appendInline(strong, heading[1], doc);
                p.appendChild(strong);
                container.appendChild(p);
                i++;
                continue;
            }
            const kind = lineKind(lines[i]);
            const run = [];
            while (i < lines.length && !HEADING.test(lines[i]) && lineKind(lines[i]) === kind) {
                run.push(lines[i]);
                i++;
            }
            if (kind === 'p') {
                const p = doc.createElement('p');
                appendLines(p, run, doc);
                container.appendChild(p);
                continue;
            }
            const list = doc.createElement(kind);
            if (kind === 'ol') {
                const first = Number(run[0].match(NUMBERED)[1]);
                if (first !== 1) list.setAttribute('start', String(first));
            }
            for (const line of run) {
                const item = doc.createElement('li');
                const m = line.match(kind === 'ol' ? NUMBERED : BULLET);
                appendInline(item, m[kind === 'ol' ? 2 : 1], doc);
                list.appendChild(item);
            }
            container.appendChild(list);
        }
    }

    /** Render `text` into `container` (appends; does not clear). */
    function render(container, text, doc) {
        const d = doc || container.ownerDocument;
        const blocks = String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/);
        for (const block of blocks) {
            const lines = block.split('\n').filter((line) => line.trim() !== '');
            if (lines.length) renderBlock(container, lines, d);
        }
        return container;
    }

    /** The same text with the markers dropped, for one-line status surfaces. */
    function toPlainText(text) {
        return String(text ?? '')
            .replace(/\r\n?/g, '\n')
            .split('\n')
            .map((line) => line.replace(HEADING, '$1'))
            .join('\n')
            .replace(INLINE, (_, bold, code, em) => bold ?? code ?? em);
    }

    const api = { render, toPlainText };

    if (typeof window !== 'undefined') {
        window.ChatMarkdown = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
