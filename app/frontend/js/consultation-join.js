/**
 * Client join page — consultation-join.html
 * Unauthenticated. Token extracted from /call/{token} URL path.
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
        rawToken: null,
        sessionId: null,
        room: null,
        micEnabled: true,
        camEnabled: true,
        screenSharing: false,
        screenTrack: null,
        localStream: null,
        callStartTime: null,
        callTimerHandle: null,
        recordingActive: false,
    };

    // -------------------------------------------------------------------------
    // DOM refs
    // -------------------------------------------------------------------------
    const $ = id => document.getElementById(id);
    const refs = {
        pageLoader:       $('pageLoader'),
        joinErrorScreen:  $('joinErrorScreen'),
        joinErrorTitle:   $('joinErrorTitle'),
        joinErrorMsg:     $('joinErrorMsg'),
        joinLobby:        $('joinLobby'),
        lobbyAstrologerName: $('lobbyAstrologerName'),
        joinPreviewVideo: $('joinPreviewVideo'),
        joinNoCamera:     $('joinNoCamera'),
        lobbyBtnMic:      $('lobbyBtnMic'),
        lobbyBtnCam:      $('lobbyBtnCam'),
        btnJoinCall:      $('btnJoinCall'),
        callShell:        $('callShell'),
        callAstrologerName: $('callAstrologerName'),
        callStatusBadge:  $('callStatusBadge'),
        callRecIndicator: $('callRecIndicator'),
        callDurationTimer:$('callDurationTimer'),
        remoteVideo:      $('remoteVideo'),
        remoteName:       $('remoteName'),
        localVideo:       $('localVideo'),
        callVideoScreen:  $('callVideoScreen'),
        screenVideo:      $('screenVideo'),
        btnToggleMic:     $('btnToggleMic'),
        btnToggleCam:     $('btnToggleCam'),
        btnShareScreen:   $('btnShareScreen'),
        btnLeaveCall:     $('btnLeaveCall'),
        consentModal:     $('consentModal'),
        btnConsentDecline:$('btnConsentDecline'),
        btnConsentAccept: $('btnConsentAccept'),
        callEndedScreen:  $('callEndedScreen'),
    };

    // -------------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------------
    async function init() {
        // Extract token from path: /call/{token}
        const pathParts = window.location.pathname.split('/');
        state.rawToken = pathParts[pathParts.length - 1] || null;

        if (!state.rawToken || state.rawToken === 'call') {
            showError('Invalid link', 'This consultation link is not valid.');
            return;
        }

        try {
            await loadSessionAndShowLobby();
        } catch (err) {
            showError('Link unavailable', err.message || 'This consultation link is no longer valid.');
        }
    }

    async function loadSessionAndShowLobby() {
        const res = await fetch(`${API_BASE}/call-sessions/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: state.rawToken }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data.detail || 'This call link is invalid or has expired.';
            throw new Error(msg);
        }

        const data = await res.json();
        state.sessionId      = data.session_id;
        state.livekitUrl     = data.livekit_url;
        state.livekitToken   = data.token;
        state.roomName       = data.room_name;
        state.astrologerName = data.astrologer_name || 'Your astrologer';
        state.recordingActive = data.recording_active;

        refs.lobbyAstrologerName.textContent = state.astrologerName;
        refs.callAstrologerName.textContent  = state.astrologerName;
        refs.remoteName.textContent          = state.astrologerName;

        hide(refs.pageLoader);
        await startLobbyPreview();
        show(refs.joinLobby);

        refs.btnJoinCall.addEventListener('click', joinCall);
        refs.lobbyBtnMic.addEventListener('click', toggleLobbyMic);
        refs.lobbyBtnCam.addEventListener('click', toggleLobbyCam);
    }

    // -------------------------------------------------------------------------
    // Lobby camera preview
    // -------------------------------------------------------------------------
    async function startLobbyPreview() {
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: true,
            });
            refs.joinPreviewVideo.srcObject = state.localStream;
            refs.joinNoCamera.hidden = true;
        } catch (_) {
            refs.joinPreviewVideo.hidden = true;
            refs.joinNoCamera.hidden = false;
            state.camEnabled = false;
        }
    }

    function toggleLobbyMic() {
        state.micEnabled = !state.micEnabled;
        if (state.localStream) {
            state.localStream.getAudioTracks().forEach(t => { t.enabled = state.micEnabled; });
        }
        refs.lobbyBtnMic.classList.toggle('join-device-btn--off', !state.micEnabled);
    }

    function toggleLobbyCam() {
        state.camEnabled = !state.camEnabled;
        if (state.localStream) {
            state.localStream.getVideoTracks().forEach(t => { t.enabled = state.camEnabled; });
        }
        refs.joinPreviewVideo.hidden = !state.camEnabled;
        refs.joinNoCamera.hidden = state.camEnabled;
        refs.lobbyBtnCam.classList.toggle('join-device-btn--off', !state.camEnabled);
    }

    // -------------------------------------------------------------------------
    // Join the call
    // -------------------------------------------------------------------------
    async function joinCall() {
        refs.btnJoinCall.disabled = true;
        refs.btnJoinCall.textContent = 'Connecting…';

        // Stop lobby preview — LiveKit will manage tracks
        if (state.localStream) {
            state.localStream.getTracks().forEach(t => t.stop());
            state.localStream = null;
        }

        hide(refs.joinLobby);
        show(refs.callShell);

        const room = new LivekitClient.Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: LivekitClient.VideoPresets.h720,
                facingMode: 'user',
            },
        });
        state.room = room;

        room.on(LivekitClient.RoomEvent.TrackSubscribed,       onTrackSubscribed);
        room.on(LivekitClient.RoomEvent.TrackUnsubscribed,     onTrackUnsubscribed);
        room.on(LivekitClient.RoomEvent.ParticipantConnected,  onParticipantConnected);
        room.on(LivekitClient.RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        room.on(LivekitClient.RoomEvent.Disconnected,          onRoomDisconnected);
        room.on(LivekitClient.RoomEvent.DataReceived,          onDataReceived);

        await room.connect(state.livekitUrl, state.livekitToken);

        if (state.camEnabled) {
            await room.localParticipant.enableCameraAndMicrophone();
        } else {
            await room.localParticipant.setMicrophoneEnabled(state.micEnabled);
        }

        attachLocalVideo();

        state.callStartTime = Date.now();
        state.callTimerHandle = setInterval(updateCallTimer, 1000);
        setStatus('Connected');

        // Show recording indicator if already recording
        if (state.recordingActive) {
            refs.callRecIndicator.hidden = false;
        }

        bindCallControls();
    }

    // -------------------------------------------------------------------------
    // Call controls
    // -------------------------------------------------------------------------
    function bindCallControls() {
        refs.btnToggleMic.addEventListener('click', toggleMic);
        refs.btnToggleCam.addEventListener('click', toggleCam);
        refs.btnShareScreen.addEventListener('click', toggleScreenShare);
        refs.btnLeaveCall.addEventListener('click', leaveCall);
        refs.btnConsentDecline.addEventListener('click', declineConsent);
        refs.btnConsentAccept.addEventListener('click', acceptConsent);
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
        if (state.screenSharing) {
            await stopScreenShare();
        } else {
            await startScreenShare();
        }
    }

    async function startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = new LivekitClient.LocalVideoTrack(stream.getVideoTracks()[0]);
            await state.room.localParticipant.publishTrack(track, {
                source: LivekitClient.Track.Source.ScreenShare,
            });
            state.screenTrack = track;
            state.screenSharing = true;
            refs.callVideoScreen.hidden = false;
            refs.screenVideo.srcObject = stream;
            refs.btnShareScreen.classList.add('call-ctrl-btn--active');
            stream.getVideoTracks()[0].addEventListener('ended', stopScreenShare);
        } catch (err) {
            if (err.name !== 'NotAllowedError') console.error(err);
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

    async function leaveCall() {
        if (state.screenSharing) await stopScreenShare();
        if (state.room) {
            await state.room.disconnect();
            state.room = null;
        }
        clearInterval(state.callTimerHandle);
        hide(refs.callShell);
        show(refs.callEndedScreen);
    }

    // -------------------------------------------------------------------------
    // Consent
    // -------------------------------------------------------------------------
    function declineConsent() {
        hide(refs.consentModal);
        // Optionally send decline signal back
        if (state.room) {
            const msg = JSON.stringify({ type: 'consent_declined' });
            state.room.localParticipant.publishData(
                new TextEncoder().encode(msg),
                { reliable: true },
            );
        }
    }

    async function acceptConsent() {
        hide(refs.consentModal);
        try {
            await fetch(`${API_BASE}/call-sessions/join/${state.rawToken}/consent`, { method: 'POST' });
        } catch (_) { /* ignore */ }
        // Signal astrologer
        if (state.room) {
            const msg = JSON.stringify({ type: 'consent_given' });
            state.room.localParticipant.publishData(
                new TextEncoder().encode(msg),
                { reliable: true },
            );
        }
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
            track.attach();
        }
    }

    function onTrackUnsubscribed(track) {
        track.detach();
        if (track.source === LivekitClient.Track.Source.ScreenShare) {
            refs.callVideoScreen.hidden = true;
        }
    }

    function onParticipantConnected(participant) {
        setStatus('Connected');
        refs.remoteName.textContent = participant.name || state.astrologerName || 'Astrologer';
    }

    function onParticipantDisconnected() {
        setStatus('Astrologer disconnected');
    }

    function onRoomDisconnected() {
        hide(refs.callShell);
        show(refs.callEndedScreen);
    }

    function onDataReceived(data) {
        try {
            const msg = JSON.parse(new TextDecoder().decode(data));
            if (msg.type === 'consent_request') {
                show(refs.consentModal);
            } else if (msg.type === 'recording_started') {
                state.recordingActive = true;
                refs.callRecIndicator.hidden = false;
            } else if (msg.type === 'recording_stopped') {
                state.recordingActive = false;
                refs.callRecIndicator.hidden = true;
            }
        } catch (_) { /* ignore */ }
    }

    function attachLocalVideo() {
        const pub = state.room?.localParticipant?.getTrackPublication(LivekitClient.Track.Source.Camera);
        if (pub?.videoTrack) pub.videoTrack.attach(refs.localVideo);
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------
    function updateCallTimer() {
        if (!state.callStartTime) return;
        const s = Math.floor((Date.now() - state.callStartTime) / 1000);
        const m = Math.floor(s / 60);
        refs.callDurationTimer.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
    }

    function setStatus(text) { refs.callStatusBadge.textContent = text; }
    function show(el) { if (el) el.hidden = false; }
    function hide(el) { if (el) el.hidden = true; }

    function showError(title, msg) {
        hide(refs.pageLoader);
        if (refs.joinErrorTitle) refs.joinErrorTitle.textContent = title;
        if (refs.joinErrorMsg)   refs.joinErrorMsg.textContent   = msg;
        show(refs.joinErrorScreen);
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
