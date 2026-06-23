import{a as I}from"./chunks/chunk-XUHCC6CH.js";import"./chunks/chunk-MZ7NETWD.js";import{b as y,d as _,e as E,f as b,g as L}from"./chunks/chunk-6NFCP3QL.js";var Q=y(_()),U=y(E()),Z=y(b());var K=y(L()),G=y(I());var u=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1",T=["client_question","life_context","astrological_focus","guidance_given","decision_or_plan","follow_up","sensitive"],c={sessionId:null,userId:null,cs:null,reportDirty:!1};function s(t,e){return window.FrontendI18n?.t?.(t,e)||t}function x(t={}){return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(t):t}function m(t,e={}){return fetch(t,{credentials:"include",...e,headers:x(e.headers||{})})}function n(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function $(t){if(!t)return"";let e=new Date(t);return Number.isNaN(e.getTime())?String(t):window.LocaleFormatters?.formatDateTime?window.LocaleFormatters.formatDateTime(e):e.toLocaleString()}function p(t,e){if(!e)return"";let o=`page.consultation.${t}.${e}`,a=s(o);return a===o?e:a}var h=null;function d(t,e=""){let o=document.getElementById("toast");o&&(o.textContent=t,o.className=`toast visible ${e}`,clearTimeout(h),h=setTimeout(()=>{o.className="toast"},2600))}function k(){let t=window.location.pathname.match(/\/consultation\/([^/?#]+)/);return t?decodeURIComponent(t[1]):null}document.addEventListener("DOMContentLoaded",B);async function B(){c.sessionId=k();let t=document.getElementById("backLink");if(t&&t.addEventListener("click",e=>{e.preventDefault(),S()}),window.addEventListener("beforeunload",e=>{c.reportDirty&&(e.preventDefault(),e.returnValue="")}),!c.sessionId){f(s("page.consultation.notFound"));return}await q(),document.getElementById("pageLoader")?.classList.add("hidden")}function S(){c.userId?window.location.href=`/client/${encodeURIComponent(c.userId)}`:window.history.back()}var H=["en","uk","ru"];async function q(){try{let t=await m(`${u}/call-sessions/${c.sessionId}`);if(t.status===404){f(s("page.consultation.notFound"));return}if(!t.ok)throw new Error(`HTTP ${t.status}`);c.cs=await t.json(),c.userId=c.cs.user_id;let e=c.cs.summary_json?.session?.language;if(e&&H.includes(e)&&window.FrontendI18n?.setLocale)try{await window.FrontendI18n.setLocale(e,{persist:!1,source:"consultation-language"})}catch{}C()}catch(t){f(t.message)}}function f(t){document.getElementById("pageLoader")?.classList.add("hidden"),document.getElementById("consultRoot").innerHTML=`<div class="consult-card"><p class="consult-empty">${n(t)}</p></div>`}function C(){let t=c.cs,e=t.summary_json,o=document.getElementById("consultRoot"),a=t.started_at?$(`${t.started_at}Z`):t.created_at?$(`${t.created_at}Z`):"",r="",i=(e?.session?.consultation_types||[]).map(w=>`<span class="consult-type-chip">${n(p("consultationType",w))}</span>`).join("");r+=`<div class="consult-head">
        <h1 class="consult-title">${n(s("page.consultation.title"))}</h1>
        <span class="consult-types">${i}</span>
    </div>
    <p class="consult-meta">${n(a)}${t.client_name?" · "+n(t.client_name):""}</p>`;let l="",v="";t.call_status==="summary_failed"?l+=`<div class="consult-card consult-card-status">
            <p class="consult-empty">${n(s("page.consultation.summaryFailed"))}</p>
            ${t.summary_error?`<p class="consult-empty">${n(t.summary_error)}</p>`:""}
        </div>`:e?(l+=P(e),l+=R(t,e),v+=A(e.key_points||[]),v+=F(e.open_questions_or_unclear_items||[])):l+=D(t),v+=`<div class="consult-card consult-card-memory">
        <div class="consult-card-title"><span>${n(s("page.consultation.memory.title"))}</span></div>
        <div id="memList" class="mem-list"><div class="consult-loading"><span class="consult-spinner"></span></div></div>
    </div>`,r+=`<div class="consult-detail-grid">
        <div class="consult-column consult-column-main">${l}</div>
        <div class="consult-column consult-column-side">${v}</div>
    </div>`,o.innerHTML=r,M(),g()}function D(t){let e=`<div class="consult-card consult-card-summary"><div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>`;return e+=t.summary_text?`<p class="consult-text">${n(t.summary_text)}</p>`:`<p class="consult-empty">${n(s("page.consultation.legacy"))}</p>`,e+="</div>",t.client_facing_summary&&(e+=`<div class="consult-card consult-card-report"><div class="consult-card-title"><span>${n(s("page.consultation.report.title"))}</span></div>
            <p class="consult-text">${n(t.client_facing_summary)}</p></div>`),e}function P(t){let e=t.session_summary||{};return`<div class="consult-card consult-card-summary">
        <div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>
        <p class="consult-text">${n(e.brief||"")}</p>
        ${e.detailed?`<details><summary class="consult-detail-toggle">${n(s("page.consultation.summary.showDetailed"))}</summary>
            <p class="consult-text consult-text-detail">${n(e.detailed)}</p></details>`:""}
    </div>`}function R(t,e){let o=t.client_report_edited!=null?t.client_report_edited:e.client_facing_report?.text||"",a=t.client_report_shared_at?`<span class="consult-shared-note">${n(s("page.consultation.report.sharedAt"))} ${n($(`${t.client_report_shared_at}Z`))}</span>`:"";return`<div class="consult-card consult-card-report">
        <div class="consult-card-title">
            <span>${n(s("page.consultation.report.title"))}</span>
            <span class="consult-review-badge">${n(s("page.consultation.report.reviewRequired"))}</span>
        </div>
        <textarea class="consult-report-area" id="reportArea">${n(o)}</textarea>
        <div class="consult-report-actions">
            <button class="btn-new" id="saveReportBtn" disabled>${n(s("page.consultation.report.save"))}</button>
            <button class="btn-new btn-ghost" id="copyReportBtn">${n(s("page.consultation.report.copy"))}</button>
            <span id="reportStatus"></span>
            ${a}
        </div>
    </div>`}function A(t){if(!t.length)return"";let e={};t.forEach(a=>{(e[a.category]=e[a.category]||[]).push(a)});let o="";return T.forEach(a=>{if(!e[a])return;let r=e[a].map(i=>`<li>${n(i.text)}<span class="consult-kp-by">${n(p("mentionedBy",i.mentioned_by))}</span></li>`).join("");o+=`<div class="consult-kp-group">
            <p class="consult-kp-cat ${a==="sensitive"?"is-sensitive":""}">${n(p("keyPointCategory",a))}</p>
            <ul class="consult-kp-list">${r}</ul>
        </div>`}),`<div class="consult-card consult-card-keypoints">
        <div class="consult-card-title"><span>${n(s("page.consultation.keyPoints.title"))}</span></div>
        ${o}
    </div>`}function F(t){if(!t.length)return`<div class="consult-card consult-card-questions">
            <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
            <p class="consult-empty">${n(s("page.consultation.openQuestions.none"))}</p>
        </div>`;let e=t.map(o=>`<li class="consult-oq-item">${n(o.text)}
            <div class="consult-oq-reason">${n(p("openQuestionReason",o.reason))} · ${n(p("mentionedBy",o.mentioned_by))}</div>
        </li>`).join("");return`<div class="consult-card consult-card-questions">
        <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
        <ul class="consult-oq-list">${e}</ul>
    </div>`}function M(){let t=document.getElementById("reportArea"),e=document.getElementById("saveReportBtn"),o=document.getElementById("copyReportBtn");t&&(t.addEventListener("input",()=>{c.reportDirty=!0,e.disabled=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-dirty">${n(s("page.consultation.report.unsaved"))}</span>`}),e.addEventListener("click",async()=>{e.disabled=!0;try{let a=await m(`${u}/call-sessions/${c.sessionId}/report`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t.value})});if(!a.ok)throw new Error(`HTTP ${a.status}`);c.reportDirty=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-saved">${n(s("page.consultation.report.saved"))}</span>`}catch{e.disabled=!1,d(s("page.consultation.report.saveFailed"),"error")}}),o.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(t.value),d(s("page.consultation.report.copied"),"success"),await m(`${u}/call-sessions/${c.sessionId}/report/shared`,{method:"POST"})}catch{d(s("page.consultation.report.copyFailed"),"error")}}))}async function g(){let t=document.getElementById("memList");if(!(!t||!c.userId))try{let e=await m(`${u}/clients/${c.userId}/memory`);if(!e.ok)throw new Error(`HTTP ${e.status}`);let o=await e.json();j(o.entries||[])}catch{t.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.loadError"))}</p>`}}function j(t){let e=document.getElementById("memList");if(!t.length){e.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.empty"))}</p>`;return}e.innerHTML=t.map(o=>{let a=o.source==="ai"?`<span class="mem-provenance is-ai">✦ ${n(s("page.consultation.memory.aiSuggested"))}</span>`:`<span class="mem-provenance">${n(s("page.consultation.memory.byAstrologer"))}</span>`;return`<div class="mem-item" data-id="${n(o.id)}">
            <div class="mem-item-head">
                <span class="mem-cat">${n(p("memoryCategory",o.category))}</span>
                ${a}
                <span class="mem-internal">${n(s("page.consultation.memory.internal"))}</span>
            </div>
            <p class="mem-text">${n(o.text)}</p>
            <div class="mem-actions">
                <button class="mem-edit-btn" data-act="edit">${n(s("common.edit"))}</button>
                <button class="mem-del-btn" data-act="del">${n(s("common.delete"))}</button>
            </div>
        </div>`}).join(""),e.querySelectorAll(".mem-item").forEach(o=>{let a=o.dataset.id;o.querySelector('[data-act="edit"]')?.addEventListener("click",()=>O(o,a)),o.querySelector('[data-act="del"]')?.addEventListener("click",()=>N(a))})}function O(t,e){let o=t.querySelector(".mem-text"),a=o.textContent,r=t.querySelector(".mem-actions");o.outerHTML=`<textarea class="mem-edit-area">${n(a)}</textarea>`,r.innerHTML=`
        <button class="mem-edit-btn" data-act="savee">${n(s("common.save"))}</button>
        <button class="mem-del-btn" data-act="cancel">${n(s("common.cancel"))}</button>`,r.querySelector('[data-act="savee"]').addEventListener("click",async()=>{let i=t.querySelector(".mem-edit-area").value.trim();if(i)try{if(!(await m(`${u}/memory/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:i})})).ok)throw new Error;g()}catch{d(s("common.error"),"error")}}),r.querySelector('[data-act="cancel"]').addEventListener("click",g)}async function N(t){if(confirm(s("page.consultation.memory.confirmDelete")))try{if(!(await m(`${u}/memory/${t}`,{method:"DELETE"})).ok)throw new Error;d(s("page.consultation.memory.deleted"),"success"),g()}catch{d(s("common.error"),"error")}}
