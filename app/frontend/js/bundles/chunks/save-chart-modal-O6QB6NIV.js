(function(){"use strict";let D=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1";function r(e,n,s){let o=window.FrontendI18n?.t?.(e,n);return o&&o!==e?o:s||e}function I(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function N(){let e={"Content-Type":"application/json"};return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(e):e}async function y(e){let n=await fetch(`${D}${e}`,{credentials:"include",headers:window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders({}):{}});if(!n.ok)throw new Error(`HTTP ${n.status}`);return n.json()}let m=null,c=[],h=[],l=[],b=null,C=!1,E=!1,t={},S="scm-backdrop",T="scm-dialog";function a(e){return document.getElementById(e)}function k(){t.backdrop=a(S),t.dialog=a(T),t.form=a("scm-form"),t.closeBtn=a("scm-close"),t.cancelBtn=a("scm-cancel"),t.submitBtn=a("scm-submit"),t.submitText=a("scm-submit-text"),t.submitLoader=a("scm-submit-loader"),t.titleInput=a("scm-title-input"),t.dateInput=a("scm-date-input"),t.timeInput=a("scm-time-input"),t.error=a("scm-error"),t.tagsSection=a("scm-tags-section"),t.tagWrap=a("scm-tag-wrap"),t.tagInput=a("scm-tag-input"),t.tagSuggestions=a("scm-tag-suggestions"),t.personSection=a("scm-person-section"),t.personWrap=a("scm-person-wrap"),t.personInput=a("scm-person-input"),t.personDropdown=a("scm-person-dropdown"),t.personChips=a("scm-person-chips")}function A(){if(C)return;C=!0;let e=`
<div class="chart-dialog-backdrop hidden" id="${S}"></div>
<section class="chart-dialog hidden" id="${T}" role="dialog" aria-modal="true" aria-labelledby="scm-heading">
  <div class="chart-dialog-card chart-dialog-card--compact">
    <div class="chart-dialog-header">
      <h3 id="scm-heading" class="chart-dialog-title chart-dialog-title--compact"></h3>
      <button type="button" class="chart-dialog-close" id="scm-close" aria-label="Close">×</button>
    </div>

    <form id="scm-form" novalidate>
      <div class="chart-dialog-grid">

        <!-- Title -->
        <div class="form-group scm-title-group">
          <label class="form-label" for="scm-title-input" id="scm-title-label"></label>
          <input id="scm-title-input" type="text" autocomplete="off">
        </div>

        <!-- Date and time -->
        <div class="scm-moment-grid">
          <div class="form-group">
            <label class="form-label" for="scm-date-input" id="scm-date-label"></label>
            <input id="scm-date-input" type="date" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="scm-time-input" id="scm-time-label"></label>
            <input id="scm-time-input" type="time" step="60" required>
          </div>
        </div>

        <!-- Tags -->
        <div class="form-group" id="scm-tags-section" style="grid-column:1/-1">
          <label class="form-label" id="scm-tags-label"></label>
          <div class="scm-tag-input-wrap" id="scm-tag-wrap">
            <input id="scm-tag-input" type="text" autocomplete="off">
          </div>
          <div class="scm-tag-suggestions" id="scm-tag-suggestions"></div>
        </div>

        <!-- Person -->
        <div class="form-group" id="scm-person-section" style="grid-column:1/-1">
          <label class="form-label" id="scm-person-label"></label>
          <div class="scm-person-wrap scm-tag-input-wrap" id="scm-person-wrap">
            <input id="scm-person-input" type="text" autocomplete="off">
            <div class="place-suggestions" id="scm-person-dropdown"></div>
          </div>
          <div class="scm-person-chips" id="scm-person-chips"></div>
        </div>

      </div>

      <div class="error-message hidden" id="scm-error"></div>

      <div class="chart-dialog-actions">
        <button type="button" class="header-nav-btn" id="scm-cancel"></button>
        <button type="submit" class="submit-btn chart-dialog-submit" id="scm-submit">
          <span id="scm-submit-text"></span>
          <span class="btn-loader hidden" id="scm-submit-loader"></span>
        </button>
      </div>
    </form>
  </div>
</section>`,n=document.createElement("div");for(n.innerHTML=e.trim();n.firstChild;)document.body.appendChild(n.firstChild);k(),q()}function P(){let e=a("scm-heading");e&&(e.textContent=r("page.chart.actions.saveChart",null,"Сохранить карту"));let n=a("scm-title-label");n&&(n.textContent=r("page.chart.actions.saveSourceChartPromptTitle",null,"Название карты"));let s=a("scm-tags-label");s&&(s.textContent=r("page.chart.saveModal.tagsLabel",null,"Теги"));let o=a("scm-date-label");o&&(o.textContent=r("common.date",null,"Дата"));let i=a("scm-time-label");i&&(i.textContent=r("common.time",null,"Время"));let p=a("scm-person-label");p&&(p.textContent=r("page.chart.saveModal.personLabel",null,"Привязать к людям")),t.cancelBtn&&(t.cancelBtn.textContent=r("common.cancel",null,"Отмена")),t.submitText&&(t.submitText.textContent=r("page.chart.actions.saveSourceChart",null,"Сохранить")),t.submitLoader&&(t.submitLoader.textContent=r("common.loading",null,"Сохраняем…")),t.tagInput&&(t.tagInput.placeholder=r("page.chart.saveModal.tagsPlaceholder",null,"Новый тег…")),t.personInput&&(t.personInput.placeholder=r("page.chart.saveModal.personPlaceholder",null,"Искать человека…"))}function g(){!t.tagWrap||!t.tagInput||(t.tagWrap.querySelectorAll(".scm-tag-chip").forEach(e=>e.remove()),c.forEach((e,n)=>{let s=document.createElement("span");s.className="scm-tag-chip";let o=document.createElement("span");o.textContent=e;let i=document.createElement("button");i.type="button",i.className="scm-tag-chip-del",i.setAttribute("aria-label","Remove "+e),i.textContent="×",i.addEventListener("click",()=>{c.splice(n,1),g(),v()}),s.append(o,i),t.tagWrap.insertBefore(s,t.tagInput)}))}function f(e){let n=e.trim();n&&(c.some(s=>s.toLowerCase()===n.toLowerCase())||(c.push(n),g(),v()),t.tagInput&&(t.tagInput.value=""))}function v(){if(!t.tagSuggestions)return;let e=new Set(c.map(s=>s.toLowerCase())),n=h.filter(s=>!e.has(s.toLowerCase()));if(!n.length){t.tagSuggestions.innerHTML="",t.tagSuggestions.hidden=!0;return}t.tagSuggestions.hidden=!1,t.tagSuggestions.innerHTML=n.map(s=>`<button type="button" class="chart-picker-tag scm-tag-suggestion" data-tag="${I(s)}">${I(s)}</button>`).join("")}async function B(){try{let e=await y("/charts/tags");h=Array.isArray(e)?e:[]}catch{h=[]}v()}function M(e){if(t.personDropdown){if(t.personDropdown.innerHTML="",e=e.filter(n=>!l.some(s=>String(s.id)===String(n.person_id))),!e.length){t.personDropdown.classList.remove("active");return}e.forEach(n=>{let s=document.createElement("button");s.type="button",s.className="place-suggestion",s.textContent=n.display_name,s.addEventListener("mousedown",o=>{o.preventDefault(),_(n.person_id,n.display_name)}),t.personDropdown.appendChild(s)}),t.personDropdown.classList.add("active")}}async function H(e){if(!e.trim()){t.personDropdown?.classList.remove("active");return}try{let n=await y(`/persons?q=${encodeURIComponent(e.trim())}`);M(Array.isArray(n)?n.slice(0,8):[])}catch{}}function w(){t.personChips&&(t.personChips.innerHTML="",l.forEach((e,n)=>{let s=document.createElement("span");s.className="scm-tag-chip scm-person-chip";let o=document.createElement("span");o.textContent=n===0?`${e.name} · ${r("page.chart.saveModal.personPrimary",null,"основной")}`:e.name;let i=document.createElement("button");i.type="button",i.className="scm-tag-chip-del",i.setAttribute("aria-label","Remove "+e.name),i.textContent="×",i.addEventListener("click",()=>{l.splice(n,1),w()}),s.append(o,i),t.personChips.appendChild(s)}))}function _(e,n){l.some(s=>String(s.id)===String(e))||(l.push({id:e,name:n}),w()),t.personInput&&(t.personInput.value="",t.personInput.focus()),t.personDropdown&&t.personDropdown.classList.remove("active")}function q(){E||(E=!0,t.backdrop?.addEventListener("click",()=>u(null)),t.closeBtn?.addEventListener("click",()=>u(null)),t.cancelBtn?.addEventListener("click",()=>u(null)),document.addEventListener("keydown",e=>{e.key==="Escape"&&t.dialog&&!t.dialog.classList.contains("hidden")&&u(null)}),t.tagInput?.addEventListener("keydown",e=>{e.key==="Enter"||e.key===","||e.key===";"?(e.preventDefault(),f(t.tagInput.value)):e.key==="Backspace"&&!t.tagInput.value&&c.length&&(c.pop(),g(),v())}),t.tagInput?.addEventListener("blur",()=>{t.tagInput.value.trim()&&f(t.tagInput.value)}),t.tagWrap?.addEventListener("click",e=>{e.target===t.tagWrap&&t.tagInput?.focus()}),t.tagSuggestions?.addEventListener("click",e=>{let n=e.target.closest("[data-tag]");n&&f(n.dataset.tag)}),t.personInput?.addEventListener("input",()=>{clearTimeout(b);let e=t.personInput.value.trim();if(!e){t.personDropdown?.classList.remove("active");return}b=setTimeout(()=>H(e),280)}),t.personInput?.addEventListener("keydown",e=>{let n=t.personDropdown;if(!n||!n.classList.contains("active"))return;let s=[...n.querySelectorAll(".place-suggestion")],o=n.querySelector(".place-suggestion:focus"),i=o?s.indexOf(o):-1;e.key==="ArrowDown"?(e.preventDefault(),s[Math.min(i+1,s.length-1)]?.focus()):e.key==="ArrowUp"?(e.preventDefault(),i<=0?t.personInput.focus():s[i-1]?.focus()):e.key==="Escape"&&n.classList.remove("active")}),document.addEventListener("click",e=>{t.personWrap&&!t.personWrap.contains(e.target)&&t.personDropdown?.classList.remove("active")},{capture:!0}),t.form?.addEventListener("submit",async e=>{e.preventDefault();let n=String(t.titleInput?.value||"").trim();if(!n){x(r("page.chart.actions.saveSourceChartTitleRequired",null,"Укажите название карты.")),t.titleInput?.focus();return}if(!t.dateInput?.value||!t.timeInput?.value){x(r("page.chart.saveModal.momentRequired",null,"Укажите дату и время карты.")),(t.dateInput?.value?t.timeInput:t.dateInput)?.focus();return}let s=l.map(o=>o.id);u({title:n,date:t.dateInput.value,time:t.timeInput.value,tags:[...c],personId:s[0]||null,personIds:s})}))}function x(e){t.error&&(t.error.textContent=e,t.error.classList.remove("hidden"))}function $(){c=[],l=[],clearTimeout(b),t.tagInput&&(t.tagInput.value=""),t.personInput&&(t.personInput.value="",t.personInput.classList.remove("hidden")),t.personChips&&(t.personChips.innerHTML=""),t.personDropdown&&t.personDropdown.classList.remove("active"),t.error&&(t.error.textContent="",t.error.classList.add("hidden")),g()}function W(e){t.submitBtn&&(t.submitBtn.disabled=e,t.submitText?.classList.toggle("hidden",e),t.submitLoader?.classList.toggle("hidden",!e))}function u(e){t.dialog?.classList.add("hidden"),t.backdrop?.classList.add("hidden"),document.body.style.overflow="",m&&(m(e??null),m=null)}function R(e={}){let{defaultTitle:n="",defaultDate:s="",defaultTime:o="",showTags:i=!0,showPerson:p=!0,defaultPersons:L=[]}=e;return A(),P(),$(),W(!1),t.titleInput&&(t.titleInput.value=n),t.dateInput&&(t.dateInput.value=s),t.timeInput&&(t.timeInput.value=String(o||"").slice(0,5)),t.tagsSection&&t.tagsSection.classList.toggle("hidden",!i),t.personSection&&t.personSection.classList.toggle("hidden",!p),p&&Array.isArray(L)&&L.length&&(l=L.filter(d=>d&&d.id!=null).map(d=>({id:d.id,name:d.name||""})),w()),i&&B(),t.backdrop?.classList.remove("hidden"),t.dialog?.classList.remove("hidden"),document.body.style.overflow="hidden",setTimeout(()=>{t.titleInput?.focus(),t.titleInput?.select()},40),new Promise(d=>{m=d})}window.SaveChartModal={open:R}})();
