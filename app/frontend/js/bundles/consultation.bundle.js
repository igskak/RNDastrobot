import"./chunks/chunk-VMAAJXPI.js";import{b as m,d as f,e as h,f as w,g as _}from"./chunks/chunk-RBV6IDHI.js";var j=m(f()),F=m(h()),O=m(w());var Q=m(_());var d=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1",E=["client_question","life_context","astrological_focus","guidance_given","decision_or_plan","follow_up","sensitive"],c={sessionId:null,userId:null,cs:null,reportDirty:!1};function s(t,e){return window.FrontendI18n?.t?.(t,e)||t}function L(t={}){return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(t):t}function u(t,e={}){return fetch(t,{credentials:"include",...e,headers:L(e.headers||{})})}function n(t){return String(t??"").replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}function p(t,e){if(!e)return"";let a=`page.consultation.${t}.${e}`,o=s(a);return o===a?e:o}var $=null;function l(t,e=""){let a=document.getElementById("toast");a&&(a.textContent=t,a.className=`toast visible ${e}`,clearTimeout($),$=setTimeout(()=>{a.className="toast"},2600))}function b(){let t=window.location.pathname.match(/\/consultation\/([^/?#]+)/);return t?decodeURIComponent(t[1]):null}document.addEventListener("DOMContentLoaded",I);async function I(){c.sessionId=b();let t=document.getElementById("backLink");if(t&&t.addEventListener("click",e=>{e.preventDefault(),T()}),window.addEventListener("beforeunload",e=>{c.reportDirty&&(e.preventDefault(),e.returnValue="")}),!c.sessionId){g(s("page.consultation.notFound"));return}await k(),document.getElementById("pageLoader")?.classList.add("hidden")}function T(){c.userId?window.location.href=`/client/${encodeURIComponent(c.userId)}`:window.history.back()}var x=["en","uk","ru"];async function k(){try{let t=await u(`${d}/call-sessions/${c.sessionId}`);if(t.status===404){g(s("page.consultation.notFound"));return}if(!t.ok)throw new Error(`HTTP ${t.status}`);c.cs=await t.json(),c.userId=c.cs.user_id;let e=c.cs.summary_json?.session?.language;if(e&&x.includes(e)&&window.FrontendI18n?.setLocale)try{await window.FrontendI18n.setLocale(e,{persist:!1,source:"consultation-language"})}catch{}S()}catch(t){g(t.message)}}function g(t){document.getElementById("pageLoader")?.classList.add("hidden"),document.getElementById("consultRoot").innerHTML=`<div class="consult-card"><p class="consult-empty">${n(t)}</p></div>`}function S(){let t=c.cs,e=t.summary_json,a=document.getElementById("consultRoot"),o=t.started_at?new Date(`${t.started_at}Z`).toLocaleString():t.created_at?new Date(`${t.created_at}Z`).toLocaleString():"",r="",i=(e?.session?.consultation_types||[]).map(v=>`<span class="consult-type-chip">${n(p("consultationType",v))}</span>`).join("");r+=`<div class="consult-head">
        <h1 class="consult-title">${n(s("page.consultation.title"))}</h1>
        <span class="consult-types">${i}</span>
    </div>
    <p class="consult-meta">${n(o)}${t.client_name?" · "+n(t.client_name):""}</p>`,t.call_status==="summary_failed"?r+=`<div class="consult-card">
            <p class="consult-empty">${n(s("page.consultation.summaryFailed"))}</p>
            ${t.summary_error?`<p class="consult-empty">${n(t.summary_error)}</p>`:""}
        </div>`:e?(r+=H(e),r+=P(t,e),r+=R(e.key_points||[]),r+=q(e.open_questions_or_unclear_items||[])):r+=B(t),r+=`<div class="consult-card">
        <div class="consult-card-title"><span>${n(s("page.consultation.memory.title"))}</span></div>
        <div id="memList" class="mem-list"><div class="consult-loading"><span class="consult-spinner"></span></div></div>
    </div>`,a.innerHTML=r,A(),y()}function B(t){let e=`<div class="consult-card"><div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>`;return e+=t.summary_text?`<p class="consult-text">${n(t.summary_text)}</p>`:`<p class="consult-empty">${n(s("page.consultation.legacy"))}</p>`,e+="</div>",t.client_facing_summary&&(e+=`<div class="consult-card"><div class="consult-card-title"><span>${n(s("page.consultation.report.title"))}</span></div>
            <p class="consult-text">${n(t.client_facing_summary)}</p></div>`),e}function H(t){let e=t.session_summary||{};return`<div class="consult-card">
        <div class="consult-card-title"><span>${n(s("page.consultation.summary.title"))}</span></div>
        <p class="consult-text">${n(e.brief||"")}</p>
        ${e.detailed?`<details><summary class="consult-detail-toggle">${n(s("page.consultation.summary.showDetailed"))}</summary>
            <p class="consult-text" style="margin-top:10px">${n(e.detailed)}</p></details>`:""}
    </div>`}function P(t,e){let a=t.client_report_edited!=null?t.client_report_edited:e.client_facing_report?.text||"",o=t.client_report_shared_at?`<span class="consult-shared-note">${n(s("page.consultation.report.sharedAt"))} ${n(new Date(`${t.client_report_shared_at}Z`).toLocaleString())}</span>`:"";return`<div class="consult-card">
        <div class="consult-card-title">
            <span>${n(s("page.consultation.report.title"))}</span>
            <span class="consult-review-badge">${n(s("page.consultation.report.reviewRequired"))}</span>
        </div>
        <textarea class="consult-report-area" id="reportArea">${n(a)}</textarea>
        <div class="consult-report-actions">
            <button class="btn-new" id="saveReportBtn" disabled>${n(s("page.consultation.report.save"))}</button>
            <button class="btn-new btn-ghost" id="copyReportBtn">${n(s("page.consultation.report.copy"))}</button>
            <span id="reportStatus"></span>
            ${o}
        </div>
    </div>`}function R(t){if(!t.length)return"";let e={};t.forEach(o=>{(e[o.category]=e[o.category]||[]).push(o)});let a="";return E.forEach(o=>{if(!e[o])return;let r=e[o].map(i=>`<li>${n(i.text)}<span class="consult-kp-by">${n(p("mentionedBy",i.mentioned_by))}</span></li>`).join("");a+=`<div class="consult-kp-group">
            <p class="consult-kp-cat ${o==="sensitive"?"is-sensitive":""}">${n(p("keyPointCategory",o))}</p>
            <ul class="consult-kp-list">${r}</ul>
        </div>`}),`<div class="consult-card">
        <div class="consult-card-title"><span>${n(s("page.consultation.keyPoints.title"))}</span></div>
        ${a}
    </div>`}function q(t){if(!t.length)return`<div class="consult-card">
            <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
            <p class="consult-empty">${n(s("page.consultation.openQuestions.none"))}</p>
        </div>`;let e=t.map(a=>`<li class="consult-oq-item">${n(a.text)}
            <div class="consult-oq-reason">${n(p("openQuestionReason",a.reason))} · ${n(p("mentionedBy",a.mentioned_by))}</div>
        </li>`).join("");return`<div class="consult-card">
        <div class="consult-card-title"><span>${n(s("page.consultation.openQuestions.title"))}</span></div>
        <ul class="consult-oq-list">${e}</ul>
    </div>`}function A(){let t=document.getElementById("reportArea"),e=document.getElementById("saveReportBtn"),a=document.getElementById("copyReportBtn");t&&(t.addEventListener("input",()=>{c.reportDirty=!0,e.disabled=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-dirty">${n(s("page.consultation.report.unsaved"))}</span>`}),e.addEventListener("click",async()=>{e.disabled=!0;try{let o=await u(`${d}/call-sessions/${c.sessionId}/report`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t.value})});if(!o.ok)throw new Error(`HTTP ${o.status}`);c.reportDirty=!1,document.getElementById("reportStatus").innerHTML=`<span class="consult-saved">${n(s("page.consultation.report.saved"))}</span>`}catch{e.disabled=!1,l(s("page.consultation.report.saveFailed"),"error")}}),a.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(t.value),l(s("page.consultation.report.copied"),"success"),await u(`${d}/call-sessions/${c.sessionId}/report/shared`,{method:"POST"})}catch{l(s("page.consultation.report.copyFailed"),"error")}}))}async function y(){let t=document.getElementById("memList");if(!(!t||!c.userId))try{let e=await u(`${d}/clients/${c.userId}/memory`);if(!e.ok)throw new Error(`HTTP ${e.status}`);let a=await e.json();C(a.entries||[])}catch{t.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.loadError"))}</p>`}}function C(t){let e=document.getElementById("memList");if(!t.length){e.innerHTML=`<p class="consult-empty">${n(s("page.consultation.memory.empty"))}</p>`;return}e.innerHTML=t.map(a=>{let o=a.source==="ai"?`<span class="mem-provenance is-ai">✦ ${n(s("page.consultation.memory.aiSuggested"))}</span>`:`<span class="mem-provenance">${n(s("page.consultation.memory.byAstrologer"))}</span>`;return`<div class="mem-item" data-id="${n(a.id)}">
            <div class="mem-item-head">
                <span class="mem-cat">${n(p("memoryCategory",a.category))}</span>
                ${o}
                <span class="mem-internal">${n(s("page.consultation.memory.internal"))}</span>
            </div>
            <p class="mem-text">${n(a.text)}</p>
            <div class="mem-actions">
                <button class="mem-edit-btn" data-act="edit">${n(s("common.edit"))}</button>
                <button class="mem-del-btn" data-act="del">${n(s("common.delete"))}</button>
            </div>
        </div>`}).join(""),e.querySelectorAll(".mem-item").forEach(a=>{let o=a.dataset.id;a.querySelector('[data-act="edit"]')?.addEventListener("click",()=>D(a,o)),a.querySelector('[data-act="del"]')?.addEventListener("click",()=>M(o))})}function D(t,e){let a=t.querySelector(".mem-text"),o=a.textContent,r=t.querySelector(".mem-actions");a.outerHTML=`<textarea class="mem-edit-area">${n(o)}</textarea>`,r.innerHTML=`
        <button class="mem-edit-btn" data-act="savee">${n(s("common.save"))}</button>
        <button class="mem-del-btn" data-act="cancel">${n(s("common.cancel"))}</button>`,r.querySelector('[data-act="savee"]').addEventListener("click",async()=>{let i=t.querySelector(".mem-edit-area").value.trim();if(i)try{if(!(await u(`${d}/memory/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:i})})).ok)throw new Error;y()}catch{l(s("common.error"),"error")}}),r.querySelector('[data-act="cancel"]').addEventListener("click",y)}async function M(t){if(confirm(s("page.consultation.memory.confirmDelete")))try{if(!(await u(`${d}/memory/${t}`,{method:"DELETE"})).ok)throw new Error;l(s("page.consultation.memory.deleted"),"success"),y()}catch{l(s("common.error"),"error")}}
