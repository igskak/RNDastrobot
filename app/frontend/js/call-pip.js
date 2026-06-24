/**
 * Picture-in-Picture helper for the consultation video call (Google-Meet style).
 *
 * Lets the astrologer pop the other person's video into a small floating window
 * that stays on top of every other app/tab, so they can share their screen or
 * switch to another window and keep seeing & talking to the client.
 *
 * Two strategies, picked by capability:
 *   1. Document Picture-in-Picture (Chromium 116+) — a real always-on-top window
 *      holding a mini call layout (remote video + self-view + label).
 *   2. Element Picture-in-Picture (Safari, older Chromium) — native single-video
 *      PiP on the remote <video>.
 *
 * Exposes window.CallPiP.
 */
(function (root) {
    'use strict';

    const doc = typeof document !== 'undefined' ? document : null;

    const docPiPSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
    const elementPiPSupported = !!doc
        && doc.pictureInPictureEnabled === true
        && typeof HTMLVideoElement !== 'undefined'
        && typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function';

    // Active session state ----------------------------------------------------
    let pipWindow = null;       // Document PiP window
    let pipRemote = null;       // <video> inside the PiP window (remote feed)
    let pipLocal = null;        // <video> inside the PiP window (self-view)
    let pipLabel = null;        // label element inside the PiP window
    let elementPiPVideo = null; // <video> currently in element-level PiP
    let activeOptions = null;   // the options passed to open()

    const PIP_CSS = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0d1117;
            font-family: 'DM Sans', system-ui, sans-serif;
            overflow: hidden;
            height: 100vh;
        }
        .pip-wrap { position: relative; width: 100vw; height: 100vh; background: #000; }
        .pip-remote {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
            object-fit: contain; background: #000;
        }
        .pip-local {
            position: absolute; bottom: 8px; right: 8px;
            width: 30%; max-width: 120px; aspect-ratio: 4 / 3;
            object-fit: cover; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 4px 14px rgba(0,0,0,0.5);
            background: #1a1f28;
        }
        .pip-label {
            position: absolute; bottom: 8px; left: 10px;
            font-size: 12px; color: rgba(255,255,255,0.85);
            background: rgba(0,0,0,0.45);
            padding: 3px 9px; border-radius: 12px;
            backdrop-filter: blur(4px);
            max-width: 60%; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis;
        }
    `;

    function isSupported() {
        return docPiPSupported || elementPiPSupported;
    }

    function isActive() {
        return !!pipWindow || !!(doc && doc.pictureInPictureElement);
    }

    function pickStream(options) {
        const remote = options.remoteVideo && options.remoteVideo.srcObject;
        if (remote) return { stream: remote, isRemote: true };
        const local = options.localVideo && options.localVideo.srcObject;
        if (local) return { stream: local, isRemote: false };
        return { stream: null, isRemote: true };
    }

    // -------------------------------------------------------------------------
    // Document Picture-in-Picture (rich)
    // -------------------------------------------------------------------------
    async function openDocumentPiP(options) {
        const win = await window.documentPictureInPicture.requestWindow({
            width: 320,
            height: 200,
        });
        pipWindow = win;

        const style = win.document.createElement('style');
        style.textContent = PIP_CSS;
        win.document.head.appendChild(style);

        const wrap = win.document.createElement('div');
        wrap.className = 'pip-wrap';

        pipRemote = win.document.createElement('video');
        pipRemote.autoplay = true;
        pipRemote.playsInline = true;
        pipRemote.className = 'pip-remote';
        wrap.appendChild(pipRemote);

        pipLocal = win.document.createElement('video');
        pipLocal.autoplay = true;
        pipLocal.playsInline = true;
        pipLocal.muted = true;
        pipLocal.className = 'pip-local';
        wrap.appendChild(pipLocal);

        pipLabel = win.document.createElement('div');
        pipLabel.className = 'pip-label';
        wrap.appendChild(pipLabel);

        win.document.body.appendChild(wrap);

        sync();

        // Returning focus to the main tab when the mini window is clicked.
        wrap.addEventListener('click', () => {
            try { root.focus(); } catch (_) { /* ignore */ }
        });

        win.addEventListener('pagehide', handleExternalClose);
    }

    // -------------------------------------------------------------------------
    // Element Picture-in-Picture (fallback, single video)
    // -------------------------------------------------------------------------
    async function openElementPiP(options) {
        const { stream } = pickStream(options);
        const video = (options.remoteVideo && options.remoteVideo.srcObject)
            ? options.remoteVideo
            : options.localVideo;
        if (!video || !stream) {
            throw new Error('No video stream available for picture-in-picture');
        }
        elementPiPVideo = video;
        video.addEventListener('leavepictureinpicture', handleExternalClose, { once: true });
        await video.requestPictureInPicture();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    async function open(options) {
        if (isActive() || !isSupported()) return;
        activeOptions = options || {};
        try {
            if (docPiPSupported) {
                await openDocumentPiP(activeOptions);
            } else {
                await openElementPiP(activeOptions);
            }
        } catch (err) {
            cleanup();
            throw err;
        }
    }

    async function close() {
        if (pipWindow) {
            try { pipWindow.close(); } catch (_) { /* ignore */ }
        }
        if (doc && doc.pictureInPictureElement) {
            try { await doc.exitPictureInPicture(); } catch (_) { /* ignore */ }
        }
        cleanup();
    }

    async function toggle(options) {
        if (isActive()) {
            await close();
        } else {
            await open(options);
        }
    }

    /**
     * Re-point the PiP video feeds and label at the current page state.
     * Call this when tracks change (subscribed/unsubscribed) while PiP is open.
     */
    function sync() {
        if (!activeOptions) return;
        if (pipWindow) {
            if (pipRemote) {
                const remote = activeOptions.remoteVideo && activeOptions.remoteVideo.srcObject;
                const local = activeOptions.localVideo && activeOptions.localVideo.srcObject;
                pipRemote.srcObject = remote || local || null;
            }
            if (pipLocal) {
                const local = activeOptions.localVideo && activeOptions.localVideo.srcObject;
                // Only show the self-view when a separate remote feed exists.
                const hasRemote = !!(activeOptions.remoteVideo && activeOptions.remoteVideo.srcObject);
                pipLocal.srcObject = hasRemote ? (local || null) : null;
                pipLocal.style.display = (hasRemote && local) ? '' : 'none';
            }
            if (pipLabel && typeof activeOptions.getLabel === 'function') {
                pipLabel.textContent = activeOptions.getLabel() || '';
            }
        }
    }

    function cleanup() {
        const onClose = activeOptions && activeOptions.onClose;
        if (elementPiPVideo) {
            elementPiPVideo.removeEventListener('leavepictureinpicture', handleExternalClose);
            elementPiPVideo = null;
        }
        pipWindow = null;
        pipRemote = null;
        pipLocal = null;
        pipLabel = null;
        activeOptions = null;
        if (typeof onClose === 'function') {
            try { onClose(); } catch (_) { /* ignore */ }
        }
    }

    function handleExternalClose() {
        cleanup();
    }

    root.CallPiP = {
        isSupported,
        isActive,
        open,
        close,
        toggle,
        sync,
    };
})(typeof window !== 'undefined' ? window : globalThis);
