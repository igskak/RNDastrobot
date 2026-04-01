import{a as O}from"./chunks/chunk-FAMQZNKA.js";import{b as d,d as F,e as q,f as C,g as D}from"./chunks/chunk-6FQMFDJB.js";var j=d(F()),R=d(q()),V=d(C());var z=d(D()),Q=d(O());(function(){"use strict";let E=["natal","biwheel","solar"],p=["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"],m=null,y=null;function w(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),300))}function c(e,t){return window.FrontendI18n?.t?.(e,t)||e}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function B(e,t=""){let a=c(e);return a&&a!==e?a:t}function _(e){return B(`astro.planet.${e}`,e)}function r(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function S(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function x(){return window.AstroPreferences?.MATRIX_BODIES||[]}function f(){return{chart_defaults:{natal:r({}),biwheel:r({aspects:{scope:"major"}}),solar:r({})},chart_creation_defaults:{house_system:"P"}}}function A(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),aspectTypes:document.getElementById("natalAspectTypes"),matrix:document.getElementById("natalMatrixEditor"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),aspectTypes:document.getElementById("biwheelAspectTypes"),matrix:document.getElementById("biwheelMatrixEditor"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),aspectTypes:document.getElementById("solarAspectTypes"),matrix:document.getElementById("solarMatrixEditorAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function I(e,t=[]){if(!e)return;let a=new Set(Array.isArray(t)&&t.length?t:p);e.innerHTML=p.map(n=>{let o=i(window.Symbols?.aspects?.[n]||""),s=i(c(`astro.aspect.${n}`)),h=a.has(n)?"checked":"";return`
                <label class="account-settings-check account-settings-check--aspect" title="${s}">
                    <input type="checkbox" data-aspect-type="${n}" ${h} aria-label="${s}">
                    <span class="account-settings-check-glyph" aria-hidden="true"><span class="astro-symbol">${o}</span></span>
                    <span class="account-settings-check-text">${s}</span>
                </label>
            `}).join("")}function P(e,t={}){if(!e)return;let a=S(t);e.innerHTML=`
            <table class="account-settings-matrix-table">
                <thead>
                    <tr>
                        <th>${i(c("page.accountSettings.matrix.columns.body"))}</th>
                        <th>${i(c("page.accountSettings.matrix.columns.display"))}</th>
                        <th>${i(c("page.accountSettings.matrix.columns.aspecting"))}</th>
                    </tr>
                </thead>
                <tbody>
                    ${x().map(n=>{let o=i(_(n)),s=i(window.Symbols?.planets?.[n]||""),h=a?.[n]?.display!==!1?"checked":"",M=a?.[n]?.aspecting!==!1?"checked":"";return`
                        <tr>
                            <td>
                                <span class="account-settings-body">
                                    <span class="account-settings-body-badge" title="${o}" aria-hidden="true">
                                        <span class="astro-symbol">${s}</span>
                                    </span>
                                    <span class="account-settings-body-name">${o}</span>
                                </span>
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    data-matrix-body="${n}"
                                    data-matrix-field="display"
                                    ${h}
                                    aria-label="${i(`${o}: ${c("page.accountSettings.matrix.columns.display")}`)}"
                                >
                            </td>
                            <td>
                                <input
                                    type="checkbox"
                                    data-matrix-body="${n}"
                                    data-matrix-field="aspecting"
                                    ${M}
                                    aria-label="${i(`${o}: ${c("page.accountSettings.matrix.columns.aspecting")}`)}"
                                >
                            </td>
                        </tr>
                    `}).join("")}
                </tbody>
            </table>
        `}function u(e){let t={...f(),...e||{},chart_defaults:{natal:r(e?.chart_defaults?.natal||{}),biwheel:r(e?.chart_defaults?.biwheel||{}),solar:r(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"}};m=t;let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=t.chart_creation_defaults.house_system||"P"),E.forEach(n=>{let o=t.chart_defaults[n],s=A(n);s.orientation&&(s.orientation.value=o.view_options?.orientation==="asc"?"asc":"aries"),s.aspectScope&&(s.aspectScope.value=o.aspects?.scope||(n==="biwheel"?"major":"all")),s.showApplyingSeparating&&(s.showApplyingSeparating.checked=o.aspects?.show_applying_separating===!0),s.showSpeed&&(s.showSpeed.checked=o.table_options?.show_speed!==!1),s.showStationary&&(s.showStationary.checked=o.table_options?.show_stationary!==!1),I(s.aspectTypes,o.aspects?.enabled_types||[]),P(s.matrix,o.matrix?.rows||{})})}function $(e){let t=[];return e?.querySelectorAll("input[data-aspect-type]").forEach(a=>{a.checked&&a.dataset.aspectType&&t.push(a.dataset.aspectType)}),t.length?t:[...p]}function k(e){let t=S({});return e?.querySelectorAll("input[data-matrix-body][data-matrix-field]").forEach(a=>{let n=a.dataset.matrixBody,o=a.dataset.matrixField;!n||!o||(t[n]={...t[n]||{display:!0,aspecting:!0},[o]:a.checked})}),t}function g(e){let t=A(e);return{matrix:{rows:k(t.matrix)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:$(t.aspectTypes),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function v(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:g("natal"),biwheel:g("biwheel"),solar:g("solar")}}}function l(e,t="info"){let a=document.getElementById("accountSettingsToast");!a||!e||(a.textContent=e,a.className=`toast ${t}`,requestAnimationFrame(()=>a.classList.add("visible")),clearTimeout(y),y=setTimeout(()=>{a.classList.remove("visible")},2800))}async function b(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?c("page.accountSettings.subtitleWithEmail",{email:e.email}):c("page.accountSettings.subtitle"));let a=await window.AstroAPI.getAccountPreferences();u(a),w()}async function T(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=v(),a=await window.AstroAPI.patchAccountPreferences(t);u(a),l(c("page.accountSettings.toasts.saved"),"success")}catch(t){l(t.message||c("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function L(){u(f()),l(c("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("reloadAccountSettingsBtn"),a=document.getElementById("restoreStandardDefaultsBtn");e?.addEventListener("click",()=>{T()}),t?.addEventListener("click",()=>{b().catch(n=>{l(n.message||c("page.accountSettings.toasts.reloadFailed"),"error")})}),a?.addEventListener("click",()=>{L()});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await b(),document.addEventListener("frontend:locale-changed",()=>{m&&u(m)})}catch(n){l(n.message||c("page.accountSettings.toasts.loadFailed"),"error"),w()}})})();
