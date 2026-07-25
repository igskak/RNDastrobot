/**
 * Astrologer video call page — consultation-call.html
 * Requires: livekit-client UMD loaded in <head>
 */
(function () {
    'use strict';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000/api/v1'
        : '/api/v1';

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------
    const state = {
        sessionId: null,
        personId: null,
        chartId: null,
        joinUrl: null,
        room: null,
        micEnabled: true,
        camEnabled: true,
        screenSharing: false,
        screenTrack: null,
        recording: false,
        recStartTime: null,
        recTimerHandle: null,
        callStartTime: null,
        callTimerHandle: null,
        consentGiven: false,          // astrologer consented
        clientConsented: false,       // client consented
        consentPollHandle: null,
    };

    // -------------------------------------------------------------------------
    // DOM refs
    // -------------------------------------------------------------------------
    const $ = id => document.getElementById(id);
    const refs = {
        pageLoader:       $('pageLoader'),
        callErrorOverlay: $('callErrorOverlay'),
        callErrorMsg:     $('callErrorMsg'),
        callShell:        $('callShell'),
        callClientName:   $('callClientName'),
        callStatusBadge:  $('callStatusBadge'),
        callRecIndicator: $('callRecIndicator'),
        callRecTimer:     $('callRecTimer'),
        callDurationTimer:$('callDurationTimer'),
        remoteVideo:      $('remoteVideo'),
        remoteName:       $('remoteName'),
        remoteAudioOff:   $('remoteAudioOff'),
        localVideo:       $('localVideo'),
        localName:        $('localName'),
        callVideoScreen:  $('callVideoScreen'),
        screenVideo:      $('screenVideo'),
        btnToggleMic:     $('btnToggleMic'),
        btnToggleCam:     $('btnToggleCam'),
        btnShareScreen:   $('btnShareScreen'),
        btnPiP:           $('btnPiP'),
        btnRecord:        $('btnRecord'),
        btnStopRecord:    $('btnStopRecord'),
        btnEndCall:       $('btnEndCall'),
        btnCopyLink:      $('btnCopyLink'),
        btnCopyLinkLabel: $('btnCopyLinkLabel'),
        consentModal:     $('consentModal'),
        consentWaitNote:  $('consentWaitNote'),
        btnConsentCancel: $('btnConsentCancel'),
        btnConsentAgree:  $('btnConsentAgree'),
        callEndedPanel:   $('callEndedPanel'),
        callEndedDuration:$('callEndedDuration'),
        callEndedNote:    $('callEndedNote'),
        callEndedClientLink: $('callEndedClientLink'),
    };

    // -------------------------------------------------------------------------
    // i18n helper
    // -------------------------------------------------------------------------
    function t(key, params) {
        return (window.FrontendI18n && window.FrontendI18n.t)
            ? window.FrontendI18n.t(key, params)
            : key;
    }

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    async function init() {
        // Make sure the active locale catalog is loaded before we render any
        // dynamic strings, otherwise t() would briefly emit raw keys.
        if (window.FrontendI18n && window.FrontendI18n.ready) {
            try { await window.FrontendI18n.ready; } catch (_) { /* best-effort */ }
        }

        const params = new URLSearchParams(window.location.search);
        state.sessionId = params.get('session_id');
        state.personId  = params.get('person_id');
        state.chartId   = params.get('chart_id') || params.get('user_id');
        state.joinUrl   = params.get('join_url');

        if (!state.sessionId) {
            showError(t('page.call.error.noSession'), t('page.call.error.title'));
            return;
        }

        try {
            await connectToRoom();
        } catch (err) {
            showError(
                err.message || t('page.call.error.connectFailed'),
                err.callErrorTitle || t('page.call.error.connectionTitle'),
            );
        }
    }

    async function connectToRoom() {
        // Fetch LiveKit token from backend
        const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/token`, { method: 'POST' });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const error = new Error(data.detail || t('page.call.error.tokenFailed'));
            error.callErrorTitle = res.status === 404
                ? t('page.call.error.title')
                : t('page.call.error.connectionTitle');
            throw error;
        }
        const data = await res.json();

        hide(refs.pageLoader);
        show(refs.callShell);

        state.callStartTime = Date.now();
        state.callTimerHandle = setInterval(updateCallTimer, 1000);

        // Fetch session details for client name
        fetchSessionDetails();

        // Connect via LiveKit
        const room = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: LivekitClient.VideoPresets.h720,
                facingMode: 'user',
            },
        });
        state.room = room;

        room.on(LivekitClient.RoomEvent.TrackSubscribed, onTrackSubscribed);
        room.on(LivekitClient.RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
        room.on(LivekitClient.RoomEvent.ParticipantConnected, onParticipantConnected);
        room.on(LivekitClient.RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        room.on(LivekitClient.RoomEvent.Disconnected, onRoomDisconnected);
        room.on(LivekitClient.RoomEvent.DataReceived, onDataReceived);

        await room.connect(data.livekit_url, data.token);

        // Publish local tracks
        await room.localParticipant.enableCameraAndMicrophone();
        attachLocalVideo();

        setStatus(t('page.call.status.inCall'));
        bindControls();
    }

    async function fetchSessionDetails() {
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}`);
            if (!res.ok) return;
            const cs = await res.json();
            state.personId = cs.person_id || state.personId;
            state.chartId = cs.chart_id || cs.user_id || state.chartId;

            // Set client name in header
            if (cs.client_name) {
                refs.callClientName.textContent = cs.client_name;
            }
            if (refs.callEndedClientLink && state.personId) {
                refs.callEndedClientLink.href = `/client/${encodeURIComponent(state.personId)}`;
            }

            // Reflect existing consent states
            state.consentGiven   = !!cs.astrologer_consent_at;
            state.clientConsented = !!cs.client_consent_at;
            if (cs.recording_started_at) {
                state.recording = true;
                updateRecordingUI(true);
            }
        } catch (_) { /* non-critical */ }
    }

    // -------------------------------------------------------------------------
    // Controls
    // -------------------------------------------------------------------------
    function bindControls() {
        refs.btnToggleMic.addEventListener('click', toggleMic);
        refs.btnToggleCam.addEventListener('click', toggleCam);
        refs.btnShareScreen.addEventListener('click', toggleScreenShare);
        refs.btnRecord.addEventListener('click', openConsentModal);
        refs.btnStopRecord.addEventListener('click', stopRecording);
        refs.btnEndCall.addEventListener('click', endCall);
        refs.btnConsentCancel.addEventListener('click', closeConsentModal);
        refs.btnConsentAgree.addEventListener('click', submitAstrologerConsent);

        // Picture-in-picture button — only when the browser supports it
        if (refs.btnPiP && window.CallPiP && window.CallPiP.isSupported()) {
            show(refs.btnPiP);
            refs.btnPiP.addEventListener('click', togglePiP);
            // Mimic Google Meet: when the astrologer switches to another window
            // (e.g. to present), pop the client into a floating mini-window.
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        // Copy invite link button
        if (state.joinUrl && refs.btnCopyLink) {
            show(refs.btnCopyLink);
            refs.btnCopyLink.addEventListener('click', copyInviteLink);
        }
    }

    // -------------------------------------------------------------------------
    // Picture-in-Picture
    // -------------------------------------------------------------------------
    function pipOptions() {
        return {
            remoteVideo: refs.remoteVideo,
            localVideo: refs.localVideo,
            getLabel: () => refs.remoteName.textContent,
            onClose: () => refs.btnPiP.classList.remove('call-ctrl-btn--active'),
        };
    }

    async function togglePiP() {
        try {
            await window.CallPiP.toggle(pipOptions());
        } catch (err) {
            console.error('Picture-in-picture error:', err);
        }
        refs.btnPiP.classList.toggle('call-ctrl-btn--active', window.CallPiP.isActive());
    }

    function onVisibilityChange() {
        if (document.visibilityState !== 'hidden') return;
        if (!state.room || !window.CallPiP || window.CallPiP.isActive()) return;
        // Best-effort: browsers may block auto-PiP without a user gesture, in
        // which case the manual button stays the reliable path.
        window.CallPiP.open(pipOptions())
            .then(() => refs.btnPiP.classList.toggle('call-ctrl-btn--active', window.CallPiP.isActive()))
            .catch(() => { /* requires user gesture — ignore */ });
    }

    async function toggleMic() {
        if (!state.room) return;
        state.micEnabled = !state.micEnabled;
        await state.room.localParticipant.setMicrophoneEnabled(state.micEnabled);
        refs.btnToggleMic.querySelector('.icon-mic-on').hidden = !state.micEnabled;
        refs.btnToggleMic.querySelector('.icon-mic-off').hidden = state.micEnabled;
        refs.btnToggleMic.classList.toggle('call-ctrl-btn--off', !state.micEnabled);
    }

    async function toggleCam() {
        if (!state.room) return;
        state.camEnabled = !state.camEnabled;
        await state.room.localParticipant.setCameraEnabled(state.camEnabled);
        refs.btnToggleCam.querySelector('.icon-cam-on').hidden = !state.camEnabled;
        refs.btnToggleCam.querySelector('.icon-cam-off').hidden = state.camEnabled;
        refs.btnToggleCam.classList.toggle('call-ctrl-btn--off', !state.camEnabled);
        if (state.camEnabled) attachLocalVideo();
    }

    async function toggleScreenShare() {
        if (!state.room) return;
        if (state.screenSharing) {
            await stopScreenShare();
        } else {
            await startScreenShare();
        }
    }

    async function startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = new LivekitClient.LocalVideoTrack(screenStream.getVideoTracks()[0]);
            await state.room.localParticipant.publishTrack(screenTrack, {
                source: LivekitClient.Track.Source.ScreenShare,
            });
            state.screenTrack = screenTrack;
            state.screenSharing = true;
            refs.callVideoScreen.hidden = false;
            refs.screenVideo.srcObject = screenStream;
            refs.btnShareScreen.classList.add('call-ctrl-btn--active');

            screenStream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);

            // Sharing the screen is exactly when seeing the client matters most —
            // float them into a picture-in-picture window (best-effort).
            if (window.CallPiP && window.CallPiP.isSupported() && !window.CallPiP.isActive()) {
                window.CallPiP.open(pipOptions())
                    .then(() => refs.btnPiP.classList.toggle('call-ctrl-btn--active', window.CallPiP.isActive()))
                    .catch(() => { /* requires user gesture — ignore */ });
            }
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                console.error('Screen share error:', err);
            }
        }
    }

    async function stopScreenShare() {
        if (state.screenTrack) {
            await state.room.localParticipant.unpublishTrack(state.screenTrack);
            state.screenTrack.stop();
            state.screenTrack = null;
        }
        state.screenSharing = false;
        refs.callVideoScreen.hidden = true;
        refs.screenVideo.srcObject = null;
        refs.btnShareScreen.classList.remove('call-ctrl-btn--active');
    }

    // -------------------------------------------------------------------------
    // Recording + consent
    // -------------------------------------------------------------------------
    function openConsentModal() {
        refs.consentWaitNote.hidden = true;
        show(refs.consentModal);
    }

    function closeConsentModal() {
        hide(refs.consentModal);
        if (state.consentPollHandle) {
            clearInterval(state.consentPollHandle);
            state.consentPollHandle = null;
        }
    }

    async function submitAstrologerConsent() {
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/consent`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to submit consent');
            const data = await res.json();
            state.consentGiven = true;

            if (data.both_consented) {
                closeConsentModal();
                await startRecording();
            } else {
                // Show waiting note and send consent request to client via data channel
                refs.consentWaitNote.hidden = false;
                refs.btnConsentAgree.disabled = true;
                sendConsentRequest();
                // Poll for client consent every 3s
                state.consentPollHandle = setInterval(pollClientConsent, 3000);
            }
        } catch (err) {
            console.error(err);
        }
    }

    function sendConsentRequest() {
        if (!state.room) return;
        const msg = JSON.stringify({ type: 'consent_request' });
        state.room.localParticipant.publishData(
            new TextEncoder().encode(msg),
            { reliable: true },
        );
    }

    async function pollClientConsent() {
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}`);
            if (!res.ok) return;
            const cs = await res.json();
            if (cs.client_consent_at) {
                clearInterval(state.consentPollHandle);
                state.consentPollHandle = null;
                closeConsentModal();
                await startRecording();
            }
        } catch (_) { /* ignore */ }
    }

    async function startRecording() {
        try {
            const res = await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/start-recording`, { method: 'POST' });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.detail || 'Failed to start recording');
            }
            state.recording = true;
            state.recStartTime = Date.now();
            updateRecordingUI(true);
            state.recTimerHandle = setInterval(updateRecTimer, 1000);
        } catch (err) {
            console.error('Start recording error:', err);
        }
    }

    async function stopRecording() {
        try {
            await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/stop-recording`, { method: 'POST' });
        } catch (_) { /* ignore */ }
        state.recording = false;
        if (state.recTimerHandle) { clearInterval(state.recTimerHandle); state.recTimerHandle = null; }
        updateRecordingUI(false);
    }

    function updateRecordingUI(active) {
        refs.callRecIndicator.hidden = !active;
        refs.btnRecord.hidden = active;
        refs.btnStopRecord.hidden = !active;
        // Notify client via data channel
        if (state.room) {
            const msg = JSON.stringify({ type: active ? 'recording_started' : 'recording_stopped' });
            state.room.localParticipant.publishData(
                new TextEncoder().encode(msg),
                LivekitClient.DataPacket_Kind.RELIABLE,
            );
        }
    }

    // -------------------------------------------------------------------------
    // End call
    // -------------------------------------------------------------------------
    async function endCall() {
        if (!confirm(t('page.call.endConfirm'))) return;

        if (window.CallPiP && window.CallPiP.isActive()) await window.CallPiP.close();
        if (state.recording) await stopRecording();
        if (state.screenSharing) await stopScreenShare();

        try {
            await apiFetch(`${API_BASE}/call-sessions/${state.sessionId}/end`, { method: 'POST' });
        } catch (_) { /* ignore */ }

        if (state.room) {
            await state.room.disconnect();
            state.room = null;
        }

        clearInterval(state.callTimerHandle);
        hide(refs.callShell);

        // Show ended panel
        const elapsed = state.callStartTime ? Math.floor((Date.now() - state.callStartTime) / 1000) : 0;
        if (typeof window.AstroAnalytics?.track === 'function') {
            window.AstroAnalytics.track('consultation_completed', { duration_seconds: elapsed });
        }
        refs.callEndedDuration.textContent = t('page.call.ended.duration', { duration: formatSeconds(elapsed) });
        show(refs.callEndedPanel);
    }

    // -------------------------------------------------------------------------
    // LiveKit event handlers
    // -------------------------------------------------------------------------
    function onTrackSubscribed(track, publication, participant) {
        if (track.kind === LivekitClient.Track.Kind.Video) {
            if (track.source === LivekitClient.Track.Source.ScreenShare) {
                track.attach(refs.screenVideo);
                refs.callVideoScreen.hidden = false;
            } else {
                track.attach(refs.remoteVideo);
            }
        } else if (track.kind === LivekitClient.Track.Kind.Audio) {
            track.attach(); // audio auto-plays
        }
        if (window.CallPiP) window.CallPiP.sync();
    }

    function onTrackUnsubscribed(track) {
        track.detach();
        if (track.source === LivekitClient.Track.Source.ScreenShare) {
            refs.callVideoScreen.hidden = true;
        }
        if (window.CallPiP) window.CallPiP.sync();
    }

    function onParticipantConnected(participant) {
        const name = participant.name || participant.identity || t('page.call.tile.guest');
        refs.remoteName.textContent = name;
        setStatus(t('page.call.status.inCall'));
        if (window.CallPiP) window.CallPiP.sync();
    }

    function onParticipantDisconnected() {
        setStatus(t('page.call.status.otherLeft'));
    }

    function onRoomDisconnected() {
        setStatus(t('page.call.status.ended'));
    }

    function onDataReceived(data) {
        try {
            const msg = JSON.parse(new TextDecoder().decode(data));
            if (msg.type === 'consent_given') {
                state.clientConsented = true;
                if (state.consentGiven && state.consentPollHandle) {
                    clearInterval(state.consentPollHandle);
                    state.consentPollHandle = null;
                    closeConsentModal();
                    startRecording();
                }
            }
        } catch (_) { /* ignore non-JSON data */ }
    }

    async function copyInviteLink() {
        try {
            await navigator.clipboard.writeText(state.joinUrl);
            refs.btnCopyLinkLabel.textContent = t('page.call.copied');
            setTimeout(() => { refs.btnCopyLinkLabel.textContent = t('page.call.copyLink'); }, 2000);
        } catch (_) {
            // Fallback: select a temp input
            const inp = document.createElement('input');
            inp.value = state.joinUrl;
            document.body.appendChild(inp);
            inp.select();
            document.execCommand('copy');
            document.body.removeChild(inp);
            refs.btnCopyLinkLabel.textContent = t('page.call.copied');
            setTimeout(() => { refs.btnCopyLinkLabel.textContent = t('page.call.copyLink'); }, 2000);
        }
    }

    function attachLocalVideo() {
        const pub = state.room?.localParticipant?.getTrackPublication(LivekitClient.Track.Source.Camera);
        if (pub?.videoTrack) {
            pub.videoTrack.attach(refs.localVideo);
        }
    }

    // -------------------------------------------------------------------------
    // Timers
    // -------------------------------------------------------------------------
    function updateCallTimer() {
        if (!state.callStartTime) return;
        const s = Math.floor((Date.now() - state.callStartTime) / 1000);
        refs.callDurationTimer.textContent = formatSeconds(s);
    }

    function updateRecTimer() {
        if (!state.recStartTime) return;
        const s = Math.floor((Date.now() - state.recStartTime) / 1000);
        refs.callRecTimer.textContent = formatSeconds(s);
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------
    function formatSeconds(s) {
        const m = Math.floor(s / 60);
        const sec = String(s % 60).padStart(2, '0');
        return `${m}:${sec}`;
    }

    function setStatus(text) {
        refs.callStatusBadge.textContent = text;
    }

    function show(el) { if (el) el.hidden = false; }
    function hide(el) {
        if (!el) return;

        if (el.classList.contains('page-loader')) {
            el.classList.add('fade-out');
            setTimeout(() => { el.hidden = true; }, 460);
            return;
        }

        el.hidden = true;
    }

    function showError(msg, title = t('page.call.error.connectionTitle')) {
        hide(refs.pageLoader);
        refs.callErrorOverlay.querySelector('.call-error-title').textContent = title;
        refs.callErrorMsg.textContent = msg;
        show(refs.callErrorOverlay);
    }

    function apiFetch(url, init = {}) {
        return fetch(url, { credentials: 'include', ...init });
    }

    // -------------------------------------------------------------------------
    // Boot
    // -------------------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
