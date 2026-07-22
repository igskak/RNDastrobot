import"./chunks/chunk-N2I5AW2C.js";import{a as T}from"./chunks/chunk-6WUMBF2I.js";import{a as I}from"./chunks/chunk-6SCZ5FYB.js";import{a as b,b as E,c as L}from"./chunks/chunk-HX7TNMQQ.js";import{b as y}from"./chunks/chunk-IZUYVIPG.js";var Z=y(b()),U=y(E()),J=y(L());var V=y(I()),G=y(T());var d=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1",k=["client_question","life_context","astrological_focus","guidance_given","decision_or_plan","follow_up","sensitive"],r={sessionId:null,personId:null,cs:null,reportDirty:!1};function s(t,e){return window.FrontendI18n?.t?.(t,e)||t}function x(t={}){return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(t):t}function u(t,e={}){return fetch(t,{credentials:"include",...e,headers:x(e.headers||{})})}function n(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function $(t){if(!t)return"";let e=new Date(t);return Number.isNaN(e.getTime())?String(t):window.LocaleFormatters?.formatDateTime?window.LocaleFormatters.formatDateTime(e):e.toLocaleString()}function m(t,e){if(!e)return"";let a=`page.consultation.${t}.${e}`,o=s(a);return o===a?e:o}var w=null;function l(t,e=""){let a=document.getElementById("toast");a&&(a.textContent=t,a.className=`toast visible ${e}`,clearTimeout(w),w=setTimeout(()=>{a.className="toast"},2600))}function B(){let t=window.location.pathname.match(/\/consultation\/([^/?#]+)/);return t?decodeURIComponent(t[1]):null}document.addEventListener("DOMContentLoaded",P);async function P(){r.sessionId=B();let t=document.getElementById("backLink");if(t&&t.addEventListener("click",e=>{e.preventDefault(),A()}),window.addEventListener("beforeunload",e=>{r.reportDirty&&(e.preventDefault(),e.returnValue="")}),!r.sessionId){h(s("page.consultation.notFound"));return}if(window.AstroAPI?.getAccountPreferences)try{window.accountPreferencesCache=await window.AstroAPI.getAccountPreferences(),window.AstroPreferences?.setAccountVisualPreferences?.(window.accountPreferencesCache?.visual||{})}catch(e){console.warn("Consultation account preferences fallback to defaults:",e)}await H(),document.getElementById("pageLoader")?.classList.add("hidden")}function A(){r.personId?window.location.href=`/client/${encodeURIComponent(r.personId)}`:window.history.back()}var S=["en","uk","ru"];async function H(){try{let t=await u(`${d}/call-sessions/${r.sessionId}`);if(t.status===404){h(s("page.consultation.notFound"));return}if(!t.ok)throw new Error(`HTTP ${t.status}`);r.cs=await t.json(),r.personId=r.cs.person_id;let e=r.cs.summary_json?.session?.language;if(e&&S.includes(e)&&window.FrontendI18n?.setLocale)try{await window.FrontendI18n.setLocale(e,{persist:!1,source:"consultation-language"})}catch{}C()}catch(t){h(t.message)}}function h(t){document.getElementById("pageLoader")?.classList.add("hidden"),document.getElementById("consultRoot").innerHTML=`<div class="ui-card"><p class="consult-empty">${n(t)}</p></div>`}function C(){let t=r.cs,e=t.summary_json,a=document.getElementById("consultRoot"),o=t.started_at?$(`${t.started_at}Z`):t.created_at?$(`${t.created_at}Z`):"",i="",c=(e?.session?.consultation_types||[]).map(_=>`<span class="consult-type-chip">${n(m("consultationType",_))}</span>`).join(""),f=`${o}${t.client_name?` · ${t.client_name}`:""}`;i+=`<div class="consult-head">
        <div class="consult-head-main">
            <h1 class="consult-title">${n(s("page.consultation.title"))}</h1>
            <span class="consult-meta">${n(f)}</span>
        </div>
        <span class="consult-types">${c}</span>
    </div>`;let p="",v="";t.call_status==="summary_failed"?p+=`<div class="ui-card consult-card-status">
            <p class="consult-empty">${n(s("page.consultation.summaryFailed"))}</p>
            ${t.summary_error?`<p class="consult-empty">${n(t.summary_error)}</p>`:""}
        </div>`:e?(p+=D(e),p+=M(t,e),v+=R(e.key_points||[]),v+=j(e.open_questions_or_unclear_items||[])):p+=q(t),v+=`<div class="ui-card consult-card-memory">
        <div class="consult-card-title"><span>${n(s("page.consultation.memory.title"))}</span></div>
        <div id="memList" class="mem-list"><div class="consult-loading"><span class="consult-spinner"></span></div></div>
    </div>`,i+=`<div class="consult-detail-grid">
        <div class="consult-column consult-column-main">${p}</div>
        <div class="consult-column consult-column-side">${v}</div>
    </div>`,a.innerHTML=i,F(),g()}function q(t){let e=`<div class="ui-card consult-card-summary"><div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>`;return e+=t.summary_text?`<p class="consult-text">${n(t.summary_text)}</p>`:`<p class="consult-empty">${n(s("page.consultation.legacy"))}</p>`,e+="</div>",t.client_facing_summary&&(e+=`<div class="ui-card consult-card-report"><div class="consult-card-title"><span>${n(s("page.consultation.report.title"))}</span></div>
            <p class="consult-text">${n(t.client_facing_summary)}</p></div>`),e}function D(t){let e=t.session_summary||{};return`<div class="ui-card consult-card-summary">
        <div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>
        <p class="consult-text">${n(e.brief||"")}</p>
        ${e.detailed?`<details><summary class="consult-detail-toggle">${n(s("page.consultation.summary.showDetailed"))}</summary>
            <p class="consult-text consult-text-detail">${n(e.detailed)}</p></details>`:""}
    </div>`}function M(t,e){let a=t.client_report_edited!=null?t.client_report_edited:e.client_facing_report?.text||"",o=t.client_report_shared_at?`<span class="consult-shared-note">${n(s("page.consultation.report.sharedAt"))} ${n($(`${t.client_report_shared_at}Z`))}</span>`:"";return`<div class="ui-card consult-card-report">
        <div class="consult-card-title">
            <span>${n(s("page.consultation.report.title"))}</span>
            <span class="consult-review-badge">${n(s("page.consultation.report.reviewRequired"))}</span>
        </div>
        <textarea class="consult-report-area" id="reportArea">${n(a)}</textarea>
        <div class="consult-report-actions">
            <button class="ui-btn ui-btn--primary ui-btn--sm" id="saveReportBtn" disabled>${n(s("page.consultation.report.save"))}</button>
            <button class="ui-btn ui-btn--secondary ui-btn--sm" id="copyReportBtn">${n(s("page.consultation.report.copy"))}</button>
            <span id="reportStatus"></span>
            ${o}
        </div>
    </div>`}function R(t){if(!t.length)return"";let e={};t.forEach(o=>{(e[o.category]=e[o.category]||[]).push(o)});let a="";return k.forEach(o=>{if(!e[o])return;let i=e[o].map(c=>`<li>${n(c.text)}<span class="consult-kp-by">${n(m("mentionedBy",c.mentioned_by))}</span></li>`).join("");a+=`<div class="consult-kp-group">
            <p class="consult-kp-cat ${o==="sensitive"?"is-sensitive":""}">${n(m("keyPointCategory",o))}</p>
            <ul class="consult-kp-list">${i}</ul>
        </div>`}),`<div class="ui-card consult-card-keypoints">
        <div class="consult-card-title"><span>${n(s("page.consultation.keyPoints.title"))}</span></div>
        ${a}
    </div>`}function j(t){if(!t.length)return`<div class="ui-card consult-card-questions">
            <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
            <div class="ui-empty-state"><div class="ui-empty-state__icon" aria-hidden="true">?</div><p class="ui-empty-state__text">${n(s("page.consultation.openQuestions.none"))}</p></div>
        </div>`;let e=t.map(a=>`<li class="consult-oq-item">${n(a.text)}
            <div class="consult-oq-reason">${n(m("openQuestionReason",a.reason))} · ${n(m("mentionedBy",a.mentioned_by))}</div>
        </li>`).join("");return`<div class="ui-card consult-card-questions">
        <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
        <ul class="consult-oq-list">${e}</ul>
    </div>`}function F(){let t=document.getElementById("reportArea"),e=document.getElementById("saveReportBtn"),a=document.getElementById("copyReportBtn");t&&(t.addEventListener("input",()=>{r.reportDirty=!0,e.disabled=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-dirty">${n(s("page.consultation.report.unsaved"))}</span>`}),e.addEventListener("click",async()=>{e.disabled=!0;try{let o=await u(`${d}/call-sessions/${r.sessionId}/report`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t.value})});if(!o.ok)throw new Error(`HTTP ${o.status}`);r.reportDirty=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-saved">${n(s("page.consultation.report.saved"))}</span>`}catch{e.disabled=!1,l(s("page.consultation.report.saveFailed"),"error")}}),a.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(t.value),l(s("page.consultation.report.copied"),"success"),await u(`${d}/call-sessions/${r.sessionId}/report/shared`,{method:"POST"})}catch{l(s("page.consultation.report.copyFailed"),"error")}}))}async function g(){let t=document.getElementById("memList");if(!(!t||!r.userId))try{let e=await u(`${d}/clients/${r.userId}/memory`);if(!e.ok)throw new Error(`HTTP ${e.status}`);let a=await e.json();O(a.entries||[])}catch{t.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.loadError"))}</p>`}}function O(t){let e=document.getElementById("memList");if(!t.length){e.innerHTML=`<div class="ui-empty-state"><div class="ui-empty-state__icon" aria-hidden="true">✎</div><p class="ui-empty-state__text">${n(s("page.consultation.memory.empty"))}</p></div>`;return}e.innerHTML=t.map(a=>{let o=a.source==="ai"?`<span class="mem-provenance is-ai">✦ ${n(s("page.consultation.memory.aiSuggested"))}</span>`:`<span class="mem-provenance">${n(s("page.consultation.memory.byAstrologer"))}</span>`;return`<div class="mem-item" data-id="${n(a.id)}">
            <div class="mem-item-head">
                <span class="mem-cat">${n(m("memoryCategory",a.category))}</span>
                ${o}
                <span class="mem-internal">${n(s("page.consultation.memory.internal"))}</span>
            </div>
            <p class="mem-text">${n(a.text)}</p>
            <div class="mem-actions">
                <button class="mem-edit-btn" data-act="edit">${n(s("common.edit"))}</button>
                <button class="compact-icon-btn compact-icon-btn--danger" data-act="del" aria-label="${n(s("common.delete"))}" title="${n(s("common.delete"))}">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 4.5h9M6 2.5h4l.5 2H5.5l.5-2ZM5 6.5v6m3-6v6m3-6v6M4.5 4.5l.6 9h5.8l.6-9" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>
        </div>`}).join(""),e.querySelectorAll(".mem-item").forEach(a=>{let o=a.dataset.id;a.querySelector('[data-act="edit"]')?.addEventListener("click",()=>N(a,o)),a.querySelector('[data-act="del"]')?.addEventListener("click",()=>Q(o))})}function N(t,e){let a=t.querySelector(".mem-text"),o=a.textContent,i=t.querySelector(".mem-actions");a.outerHTML=`<textarea class="mem-edit-area">${n(o)}</textarea>`,i.innerHTML=`
        <button class="mem-edit-btn" data-act="savee">${n(s("common.save"))}</button>
        <button class="mem-del-btn" data-act="cancel">${n(s("common.cancel"))}</button>`,i.querySelector('[data-act="savee"]').addEventListener("click",async()=>{let c=t.querySelector(".mem-edit-area").value.trim();if(c)try{if(!(await u(`${d}/memory/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:c})})).ok)throw new Error;g()}catch{l(s("common.error"),"error")}}),i.querySelector('[data-act="cancel"]').addEventListener("click",g)}async function Q(t){if(confirm(s("page.consultation.memory.confirmDelete")))try{if(!(await u(`${d}/memory/${t}`,{method:"DELETE"})).ok)throw new Error;l(s("page.consultation.memory.deleted"),"success"),g()}catch{l(s("common.error"),"error")}}
