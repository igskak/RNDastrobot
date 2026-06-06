(function(){"use strict";let E=window.location.hostname==="localhost"?"http://localhost:8000/api/v1":"/api/v1";function r(t,n,s){let o=window.FrontendI18n?.t?.(t,n);return o&&o!==t?o:s||t}function b(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function q(){let t={"Content-Type":"application/json"};return window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders(t):t}async function w(t){let n=await fetch(`${E}${t}`,{credentials:"include",headers:window.AstroAPI?.withLocaleHeaders?window.AstroAPI.withLocaleHeaders({}):{}});if(!n.ok)throw new Error(`HTTP ${n.status}`);return n.json()}let d=null,c=[],f=[],p=null,v="",h=null,L=!1,I=!1,e={},y="scm-backdrop",C="scm-dialog";function a(t){return document.getElementById(t)}function S(){e.backdrop=a(y),e.dialog=a(C),e.form=a("scm-form"),e.closeBtn=a("scm-close"),e.cancelBtn=a("scm-cancel"),e.submitBtn=a("scm-submit"),e.submitText=a("scm-submit-text"),e.submitLoader=a("scm-submit-loader"),e.titleInput=a("scm-title-input"),e.error=a("scm-error"),e.tagsSection=a("scm-tags-section"),e.tagWrap=a("scm-tag-wrap"),e.tagInput=a("scm-tag-input"),e.tagSuggestions=a("scm-tag-suggestions"),e.personSection=a("scm-person-section"),e.personWrap=a("scm-person-wrap"),e.personInput=a("scm-person-input"),e.personDropdown=a("scm-person-dropdown"),e.personBadge=a("scm-person-badge"),e.personBadgeName=a("scm-person-badge-name"),e.personClear=a("scm-person-clear")}function D(){if(L)return;L=!0;let t=`
<div class="chart-dialog-backdrop hidden" id="${y}"></div>
<section class="chart-dialog hidden" id="${C}" role="dialog" aria-modal="true" aria-labelledby="scm-heading">
  <div class="chart-dialog-card chart-dialog-card--compact">
    <div class="chart-dialog-header">
      <h3 id="scm-heading" class="chart-dialog-title chart-dialog-title--compact"></h3>
      <button type="button" class="chart-dialog-close" id="scm-close" aria-label="Close">×</button>
    </div>

    <form id="scm-form" novalidate>
      <div class="chart-dialog-grid">

        <!-- Title -->
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label" for="scm-title-input" id="scm-title-label"></label>
          <input id="scm-title-input" type="text" autocomplete="off">
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
          <div class="scm-person-wrap" id="scm-person-wrap">
            <div class="scm-person-badge hidden" id="scm-person-badge">
              <span id="scm-person-badge-name"></span>
              <button type="button" id="scm-person-clear" aria-label="Clear">×</button>
            </div>
            <input id="scm-person-input" type="text" autocomplete="off">
            <div class="place-suggestions" id="scm-person-dropdown"></div>
          </div>
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
</section>`,n=document.createElement("div");for(n.innerHTML=t.trim();n.firstChild;)document.body.appendChild(n.firstChild);S(),_()}function T(){let t=a("scm-heading");t&&(t.textContent=r("page.chart.actions.saveChart",null,"Сохранить карту"));let n=a("scm-title-label");n&&(n.textContent=r("page.chart.actions.saveSourceChartPromptTitle",null,"Название карты"));let s=a("scm-tags-label");s&&(s.textContent=r("page.chart.saveModal.tagsLabel",null,"Теги"));let o=a("scm-person-label");o&&(o.textContent=r("page.chart.saveModal.personLabel",null,"Привязать к человеку")),e.cancelBtn&&(e.cancelBtn.textContent=r("common.cancel",null,"Отмена")),e.submitText&&(e.submitText.textContent=r("page.chart.actions.saveSourceChart",null,"Сохранить")),e.submitLoader&&(e.submitLoader.textContent=r("common.loading",null,"Сохраняем…")),e.tagInput&&(e.tagInput.placeholder=r("page.chart.saveModal.tagsPlaceholder",null,"Новый тег…")),e.personInput&&(e.personInput.placeholder=r("page.chart.saveModal.personPlaceholder",null,"Искать человека…"))}function u(){!e.tagWrap||!e.tagInput||(e.tagWrap.querySelectorAll(".scm-tag-chip").forEach(t=>t.remove()),c.forEach((t,n)=>{let s=document.createElement("span");s.className="scm-tag-chip";let o=document.createElement("span");o.textContent=t;let i=document.createElement("button");i.type="button",i.className="scm-tag-chip-del",i.setAttribute("aria-label","Remove "+t),i.textContent="×",i.addEventListener("click",()=>{c.splice(n,1),u(),g()}),s.append(o,i),e.tagWrap.insertBefore(s,e.tagInput)}))}function m(t){let n=t.trim();n&&(c.some(s=>s.toLowerCase()===n.toLowerCase())||(c.push(n),u(),g()),e.tagInput&&(e.tagInput.value=""))}function g(){if(!e.tagSuggestions)return;let t=new Set(c.map(s=>s.toLowerCase())),n=f.filter(s=>!t.has(s.toLowerCase()));if(!n.length){e.tagSuggestions.innerHTML="",e.tagSuggestions.hidden=!0;return}e.tagSuggestions.hidden=!1,e.tagSuggestions.innerHTML=n.map(s=>`<button type="button" class="chart-picker-tag scm-tag-suggestion" data-tag="${b(s)}">${b(s)}</button>`).join("")}async function k(){try{let t=await w("/charts?_limit=200"),n=new Set;(Array.isArray(t)?t:[]).forEach(s=>{(s.tags||[]).forEach(o=>{o&&n.add(o)})}),f=Array.from(n).sort((s,o)=>s.localeCompare(o))}catch{f=[]}g()}function x(t){if(e.personDropdown){if(e.personDropdown.innerHTML="",!t.length){e.personDropdown.classList.remove("active");return}t.forEach(n=>{let s=document.createElement("button");s.type="button",s.className="place-suggestion",s.textContent=n.display_name,s.addEventListener("mousedown",o=>{o.preventDefault(),A(n.person_id,n.display_name)}),e.personDropdown.appendChild(s)}),e.personDropdown.classList.add("active")}}async function B(t){if(!t.trim()){e.personDropdown?.classList.remove("active");return}try{let n=await w(`/persons?q=${encodeURIComponent(t.trim())}`);x(Array.isArray(n)?n.slice(0,8):[])}catch{}}function A(t,n){p=t,v=n,e.personBadge&&e.personBadge.classList.remove("hidden"),e.personBadgeName&&(e.personBadgeName.textContent=n),e.personInput&&e.personInput.classList.add("hidden"),e.personDropdown&&e.personDropdown.classList.remove("active")}function P(){p=null,v="",e.personBadge&&e.personBadge.classList.add("hidden"),e.personInput&&(e.personInput.classList.remove("hidden"),e.personInput.value="",e.personInput.focus()),e.personDropdown&&e.personDropdown.classList.remove("active")}function _(){I||(I=!0,e.backdrop?.addEventListener("click",()=>l(null)),e.closeBtn?.addEventListener("click",()=>l(null)),e.cancelBtn?.addEventListener("click",()=>l(null)),document.addEventListener("keydown",t=>{t.key==="Escape"&&e.dialog&&!e.dialog.classList.contains("hidden")&&l(null)}),e.tagInput?.addEventListener("keydown",t=>{t.key==="Enter"||t.key===","||t.key===";"?(t.preventDefault(),m(e.tagInput.value)):t.key==="Backspace"&&!e.tagInput.value&&c.length&&(c.pop(),u(),g())}),e.tagInput?.addEventListener("blur",()=>{e.tagInput.value.trim()&&m(e.tagInput.value)}),e.tagWrap?.addEventListener("click",t=>{t.target===e.tagWrap&&e.tagInput?.focus()}),e.tagSuggestions?.addEventListener("click",t=>{let n=t.target.closest("[data-tag]");n&&m(n.dataset.tag)}),e.personInput?.addEventListener("input",()=>{clearTimeout(h);let t=e.personInput.value.trim();if(!t){e.personDropdown?.classList.remove("active");return}h=setTimeout(()=>B(t),280)}),e.personInput?.addEventListener("keydown",t=>{let n=e.personDropdown;if(!n||!n.classList.contains("active"))return;let s=[...n.querySelectorAll(".place-suggestion")],o=n.querySelector(".place-suggestion:focus"),i=o?s.indexOf(o):-1;t.key==="ArrowDown"?(t.preventDefault(),s[Math.min(i+1,s.length-1)]?.focus()):t.key==="ArrowUp"?(t.preventDefault(),i<=0?e.personInput.focus():s[i-1]?.focus()):t.key==="Escape"&&n.classList.remove("active")}),document.addEventListener("click",t=>{e.personWrap&&!e.personWrap.contains(t.target)&&e.personDropdown?.classList.remove("active")},{capture:!0}),e.personClear?.addEventListener("click",P),e.form?.addEventListener("submit",async t=>{t.preventDefault();let n=String(e.titleInput?.value||"").trim();if(!n){M(r("page.chart.actions.saveSourceChartTitleRequired",null,"Укажите название карты.")),e.titleInput?.focus();return}l({title:n,tags:[...c],personId:p||null})}))}function M(t){e.error&&(e.error.textContent=t,e.error.classList.remove("hidden"))}function H(){c=[],p=null,v="",clearTimeout(h),e.tagInput&&(e.tagInput.value=""),e.personInput&&(e.personInput.value="",e.personInput.classList.remove("hidden")),e.personBadge&&e.personBadge.classList.add("hidden"),e.personDropdown&&e.personDropdown.classList.remove("active"),e.error&&(e.error.textContent="",e.error.classList.add("hidden")),u()}function W(t){e.submitBtn&&(e.submitBtn.disabled=t,e.submitText?.classList.toggle("hidden",t),e.submitLoader?.classList.toggle("hidden",!t))}function l(t){e.dialog?.classList.add("hidden"),e.backdrop?.classList.add("hidden"),document.body.style.overflow="",d&&(d(t??null),d=null)}function $(t={}){let{defaultTitle:n="",showTags:s=!0,showPerson:o=!0}=t;return D(),T(),H(),W(!1),e.titleInput&&(e.titleInput.value=n),e.tagsSection&&e.tagsSection.classList.toggle("hidden",!s),e.personSection&&e.personSection.classList.toggle("hidden",!o),s&&k(),e.backdrop?.classList.remove("hidden"),e.dialog?.classList.remove("hidden"),document.body.style.overflow="hidden",setTimeout(()=>{e.titleInput?.focus(),e.titleInput?.select()},40),new Promise(i=>{d=i})}window.SaveChartModal={open:$}})();
