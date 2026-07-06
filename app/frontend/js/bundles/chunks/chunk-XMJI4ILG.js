(function(f){"use strict";let l=typeof document<"u"?document:null,b=typeof window<"u"&&"documentPictureInPicture"in window,g=!!l&&l.pictureInPictureEnabled===!0&&typeof HTMLVideoElement<"u"&&typeof HTMLVideoElement.prototype.requestPictureInPicture=="function",r=null,c=null,n=null,a=null,d=null,i=null,v=`
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
    `;function w(){return b||g}function s(){return!!r||!!(l&&l.pictureInPictureElement)}function x(e){let t=e.remoteVideo&&e.remoteVideo.srcObject;if(t)return{stream:t,isRemote:!0};let o=e.localVideo&&e.localVideo.srcObject;return o?{stream:o,isRemote:!1}:{stream:null,isRemote:!0}}async function V(e){let t=await window.documentPictureInPicture.requestWindow({width:320,height:200});r=t;let o=t.document.createElement("style");o.textContent=v,t.document.head.appendChild(o);let u=t.document.createElement("div");u.className="pip-wrap",c=t.document.createElement("video"),c.autoplay=!0,c.playsInline=!0,c.className="pip-remote",u.appendChild(c),n=t.document.createElement("video"),n.autoplay=!0,n.playsInline=!0,n.muted=!0,n.className="pip-local",u.appendChild(n),a=t.document.createElement("div"),a.className="pip-label",u.appendChild(a),t.document.body.appendChild(u),P(),u.addEventListener("click",()=>{try{f.focus()}catch{}}),t.addEventListener("pagehide",m)}async function E(e){let{stream:t}=x(e),o=e.remoteVideo&&e.remoteVideo.srcObject?e.remoteVideo:e.localVideo;if(!o||!t)throw new Error("No video stream available for picture-in-picture");d=o,o.addEventListener("leavepictureinpicture",m,{once:!0}),await o.requestPictureInPicture()}async function h(e){if(!(s()||!w())){i=e||{};try{b?await V(i):await E(i)}catch(t){throw p(),t}}}async function y(){if(r)try{r.close()}catch{}if(l&&l.pictureInPictureElement)try{await l.exitPictureInPicture()}catch{}p()}async function C(e){s()?await y():await h(e)}function P(){if(i&&r){if(c){let e=i.remoteVideo&&i.remoteVideo.srcObject,t=i.localVideo&&i.localVideo.srcObject;c.srcObject=e||t||null}if(n){let e=i.localVideo&&i.localVideo.srcObject,t=!!(i.remoteVideo&&i.remoteVideo.srcObject);n.srcObject=t&&e||null,n.style.display=t&&e?"":"none"}a&&typeof i.getLabel=="function"&&(a.textContent=i.getLabel()||"")}}function p(){let e=i&&i.onClose;if(d&&(d.removeEventListener("leavepictureinpicture",m),d=null),r=null,c=null,n=null,a=null,i=null,typeof e=="function")try{e()}catch{}}function m(){p()}f.CallPiP={isSupported:w,isActive:s,open:h,close:y,toggle:C,sync:P}})(typeof window<"u"?window:globalThis);
