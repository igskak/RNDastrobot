import"./chunks/chunk-MZ7NETWD.js";import{b as v,d as w,e as _,f as E,g as L}from"./chunks/chunk-IBQ2JG5P.js";var O=v(w()),N=v(_()),Q=v(E());var Z=v(L());var u=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1",b=["client_question","life_context","astrological_focus","guidance_given","decision_or_plan","follow_up","sensitive"],c={sessionId:null,userId:null,cs:null,reportDirty:!1};function s(t,e){return window.FrontendI18n?.t?.(t,e)||t}function I(t={}){return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(t):t}function p(t,e={}){return fetch(t,{credentials:"include",...e,headers:I(e.headers||{})})}function n(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function m(t,e){if(!e)return"";let o=`page.consultation.${t}.${e}`,a=s(o);return a===o?e:a}var f=null;function d(t,e=""){let o=document.getElementById("toast");o&&(o.textContent=t,o.className=`toast visible ${e}`,clearTimeout(f),f=setTimeout(()=>{o.className="toast"},2600))}function T(){let t=window.location.pathname.match(/\/consultation\/([^/?#]+)/);return t?decodeURIComponent(t[1]):null}document.addEventListener("DOMContentLoaded",x);async function x(){c.sessionId=T();let t=document.getElementById("backLink");if(t&&t.addEventListener("click",e=>{e.preventDefault(),k()}),window.addEventListener("beforeunload",e=>{c.reportDirty&&(e.preventDefault(),e.returnValue="")}),!c.sessionId){$(s("page.consultation.notFound"));return}await B(),document.getElementById("pageLoader")?.classList.add("hidden")}function k(){c.userId?window.location.href=`/client/${encodeURIComponent(c.userId)}`:window.history.back()}var S=["en","uk","ru"];async function B(){try{let t=await p(`${u}/call-sessions/${c.sessionId}`);if(t.status===404){$(s("page.consultation.notFound"));return}if(!t.ok)throw new Error(`HTTP ${t.status}`);c.cs=await t.json(),c.userId=c.cs.user_id;let e=c.cs.summary_json?.session?.language;if(e&&S.includes(e)&&window.FrontendI18n?.setLocale)try{await window.FrontendI18n.setLocale(e,{persist:!1,source:"consultation-language"})}catch{}H()}catch(t){$(t.message)}}function $(t){document.getElementById("pageLoader")?.classList.add("hidden"),document.getElementById("consultRoot").innerHTML=`<div class="consult-card"><p class="consult-empty">${n(t)}</p></div>`}function H(){let t=c.cs,e=t.summary_json,o=document.getElementById("consultRoot"),a=t.started_at?new Date(`${t.started_at}Z`).toLocaleString():t.created_at?new Date(`${t.created_at}Z`).toLocaleString():"",r="",i=(e?.session?.consultation_types||[]).map(h=>`<span class="consult-type-chip">${n(m("consultationType",h))}</span>`).join("");r+=`<div class="consult-head">
        <h1 class="consult-title">${n(s("page.consultation.title"))}</h1>
        <span class="consult-types">${i}</span>
    </div>
    <p class="consult-meta">${n(a)}${t.client_name?" · "+n(t.client_name):""}</p>`;let l="",y="";t.call_status==="summary_failed"?l+=`<div class="consult-card consult-card-status">
            <p class="consult-empty">${n(s("page.consultation.summaryFailed"))}</p>
            ${t.summary_error?`<p class="consult-empty">${n(t.summary_error)}</p>`:""}
        </div>`:e?(l+=P(e),l+=R(t,e),y+=A(e.key_points||[]),y+=C(e.open_questions_or_unclear_items||[])):l+=q(t),y+=`<div class="consult-card consult-card-memory">
        <div class="consult-card-title"><span>${n(s("page.consultation.memory.title"))}</span></div>
        <div id="memList" class="mem-list"><div class="consult-loading"><span class="consult-spinner"></span></div></div>
    </div>`,r+=`<div class="consult-detail-grid">
        <div class="consult-column consult-column-main">${l}</div>
        <div class="consult-column consult-column-side">${y}</div>
    </div>`,o.innerHTML=r,D(),g()}function q(t){let e=`<div class="consult-card consult-card-summary"><div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>`;return e+=t.summary_text?`<p class="consult-text">${n(t.summary_text)}</p>`:`<p class="consult-empty">${n(s("page.consultation.legacy"))}</p>`,e+="</div>",t.client_facing_summary&&(e+=`<div class="consult-card consult-card-report"><div class="consult-card-title"><span>${n(s("page.consultation.report.title"))}</span></div>
            <p class="consult-text">${n(t.client_facing_summary)}</p></div>`),e}function P(t){let e=t.session_summary||{};return`<div class="consult-card consult-card-summary">
        <div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>
        <p class="consult-text">${n(e.brief||"")}</p>
        ${e.detailed?`<details><summary class="consult-detail-toggle">${n(s("page.consultation.summary.showDetailed"))}</summary>
            <p class="consult-text consult-text-detail">${n(e.detailed)}</p></details>`:""}
    </div>`}function R(t,e){let o=t.client_report_edited!=null?t.client_report_edited:e.client_facing_report?.text||"",a=t.client_report_shared_at?`<span class="consult-shared-note">${n(s("page.consultation.report.sharedAt"))} ${n(new Date(`${t.client_report_shared_at}Z`).toLocaleString())}</span>`:"";return`<div class="consult-card consult-card-report">
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
    </div>`}function A(t){if(!t.length)return"";let e={};t.forEach(a=>{(e[a.category]=e[a.category]||[]).push(a)});let o="";return b.forEach(a=>{if(!e[a])return;let r=e[a].map(i=>`<li>${n(i.text)}<span class="consult-kp-by">${n(m("mentionedBy",i.mentioned_by))}</span></li>`).join("");o+=`<div class="consult-kp-group">
            <p class="consult-kp-cat ${a==="sensitive"?"is-sensitive":""}">${n(m("keyPointCategory",a))}</p>
            <ul class="consult-kp-list">${r}</ul>
        </div>`}),`<div class="consult-card consult-card-keypoints">
        <div class="consult-card-title"><span>${n(s("page.consultation.keyPoints.title"))}</span></div>
        ${o}
    </div>`}function C(t){if(!t.length)return`<div class="consult-card consult-card-questions">
            <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
            <p class="consult-empty">${n(s("page.consultation.openQuestions.none"))}</p>
        </div>`;let e=t.map(o=>`<li class="consult-oq-item">${n(o.text)}
            <div class="consult-oq-reason">${n(m("openQuestionReason",o.reason))} · ${n(m("mentionedBy",o.mentioned_by))}</div>
        </li>`).join("");return`<div class="consult-card consult-card-questions">
        <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
        <ul class="consult-oq-list">${e}</ul>
    </div>`}function D(){let t=document.getElementById("reportArea"),e=document.getElementById("saveReportBtn"),o=document.getElementById("copyReportBtn");t&&(t.addEventListener("input",()=>{c.reportDirty=!0,e.disabled=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-dirty">${n(s("page.consultation.report.unsaved"))}</span>`}),e.addEventListener("click",async()=>{e.disabled=!0;try{let a=await p(`${u}/call-sessions/${c.sessionId}/report`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t.value})});if(!a.ok)throw new Error(`HTTP ${a.status}`);c.reportDirty=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-saved">${n(s("page.consultation.report.saved"))}</span>`}catch{e.disabled=!1,d(s("page.consultation.report.saveFailed"),"error")}}),o.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(t.value),d(s("page.consultation.report.copied"),"success"),await p(`${u}/call-sessions/${c.sessionId}/report/shared`,{method:"POST"})}catch{d(s("page.consultation.report.copyFailed"),"error")}}))}async function g(){let t=document.getElementById("memList");if(!(!t||!c.userId))try{let e=await p(`${u}/clients/${c.userId}/memory`);if(!e.ok)throw new Error(`HTTP ${e.status}`);let o=await e.json();M(o.entries||[])}catch{t.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.loadError"))}</p>`}}function M(t){let e=document.getElementById("memList");if(!t.length){e.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.empty"))}</p>`;return}e.innerHTML=t.map(o=>{let a=o.source==="ai"?`<span class="mem-provenance is-ai">✦ ${n(s("page.consultation.memory.aiSuggested"))}</span>`:`<span class="mem-provenance">${n(s("page.consultation.memory.byAstrologer"))}</span>`;return`<div class="mem-item" data-id="${n(o.id)}">
            <div class="mem-item-head">
                <span class="mem-cat">${n(m("memoryCategory",o.category))}</span>
                ${a}
                <span class="mem-internal">${n(s("page.consultation.memory.internal"))}</span>
            </div>
            <p class="mem-text">${n(o.text)}</p>
            <div class="mem-actions">
                <button class="mem-edit-btn" data-act="edit">${n(s("common.edit"))}</button>
                <button class="mem-del-btn" data-act="del">${n(s("common.delete"))}</button>
            </div>
        </div>`}).join(""),e.querySelectorAll(".mem-item").forEach(o=>{let a=o.dataset.id;o.querySelector('[data-act="edit"]')?.addEventListener("click",()=>j(o,a)),o.querySelector('[data-act="del"]')?.addEventListener("click",()=>F(a))})}function j(t,e){let o=t.querySelector(".mem-text"),a=o.textContent,r=t.querySelector(".mem-actions");o.outerHTML=`<textarea class="mem-edit-area">${n(a)}</textarea>`,r.innerHTML=`
        <button class="mem-edit-btn" data-act="savee">${n(s("common.save"))}</button>
        <button class="mem-del-btn" data-act="cancel">${n(s("common.cancel"))}</button>`,r.querySelector('[data-act="savee"]').addEventListener("click",async()=>{let i=t.querySelector(".mem-edit-area").value.trim();if(i)try{if(!(await p(`${u}/memory/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:i})})).ok)throw new Error;g()}catch{d(s("common.error"),"error")}}),r.querySelector('[data-act="cancel"]').addEventListener("click",g)}async function F(t){if(confirm(s("page.consultation.memory.confirmDelete")))try{if(!(await p(`${u}/memory/${t}`,{method:"DELETE"})).ok)throw new Error;d(s("page.consultation.memory.deleted"),"success"),g()}catch{d(s("common.error"),"error")}}
