import{a as V}from"./chunks/chunk-FAMQZNKA.js";import{b as p,d as q,e as C,f as D,g as O}from"./chunks/chunk-6FQMFDJB.js";var H=p(q()),R=p(C()),z=p(D());var W=p(O()),N=p(V());(function(){"use strict";let h=["natal","biwheel","solar"],y=["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"],S=null,b=null;function A(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function i(t,e){return window.FrontendI18n?.t?.(t,e)||t}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function m(t,e=""){let a=i(t);return a&&a!==t?a:e}function P(t){return m(`astro.planet.${t}`,t)}function l(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function B(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function k(){return window.AstroPreferences?.MATRIX_BODIES||[]}function _(){return{chart_defaults:{natal:l({}),biwheel:l({aspects:{scope:"major"}}),solar:l({})},chart_creation_defaults:{house_system:"P"}}}function E(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function I(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=y.map(a=>{let n=r(window.Symbols?.aspects?.[a]||""),o=r(i(`astro.aspect.${a}`)),s=h.map(c=>{let d=t?.[c]?.aspects?.enabled_types||[],w=new Set(Array.isArray(d)&&d.length?d:y).has(a)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-aspect-type="${a}"
                                ${w}
                                aria-label="${r(`${m(`page.accountSettings.tables.columns.${c}`,c)}: ${o}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only" title="${o}" aria-label="${o}" role="img">
                            <span class="account-settings-check-glyph" aria-hidden="true"><span class="astro-symbol">${n}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function T(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=k().map(a=>{let n=r(P(a)),o=r(window.Symbols?.planets?.[a]||""),s=h.map(c=>{let d=B(t?.[c]?.matrix?.rows||{}),x=d?.[a]?.display!==!1?"checked":"",w=d?.[a]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-matrix-body="${a}"
                                data-matrix-field="display"
                                ${x}
                                aria-label="${r(`${m(`page.accountSettings.tables.columns.${c}`,c)}: ${n} ${i("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-matrix-body="${a}"
                                data-matrix-field="aspecting"
                                ${w}
                                aria-label="${r(`${m(`page.accountSettings.tables.columns.${c}`,c)}: ${n} ${i("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only" title="${n}" aria-label="${n}" role="img">
                            <span class="account-settings-body-badge" aria-hidden="true"><span class="astro-symbol">${o}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function g(t){let e={..._(),...t||{},chart_defaults:{natal:l(t?.chart_defaults?.natal||{}),biwheel:l(t?.chart_defaults?.biwheel||{}),solar:l(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"}};S=e;let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=e.chart_creation_defaults.house_system||"P"),h.forEach(n=>{let o=e.chart_defaults[n],s=E(n);s.orientation&&(s.orientation.value=o.view_options?.orientation==="asc"?"asc":"aries"),s.aspectScope&&(s.aspectScope.value=o.aspects?.scope||(n==="biwheel"?"major":"all")),s.showApplyingSeparating&&(s.showApplyingSeparating.checked=o.aspects?.show_applying_separating===!0),s.showSpeed&&(s.showSpeed.checked=o.table_options?.show_speed!==!1),s.showStationary&&(s.showStationary.checked=o.table_options?.show_stationary!==!1)}),I(e.chart_defaults),T(e.chart_defaults)}function L(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(a=>{a.checked&&a.dataset.aspectType&&e.push(a.dataset.aspectType)}),e.length?e:[...y]}function M(t){let e=B({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(a=>{let n=a.dataset.matrixBody,o=a.dataset.matrixField;!n||!o||(e[n]={...e[n]||{display:!0,aspecting:!0},[o]:a.checked})}),e}function f(t){let e=E(t);return{matrix:{rows:M(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:L(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function v(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:f("natal"),biwheel:f("biwheel"),solar:f("solar")}}}function u(t,e="info"){let a=document.getElementById("accountSettingsToast");!a||!t||(a.textContent=t,a.className=`toast ${e}`,requestAnimationFrame(()=>a.classList.add("visible")),clearTimeout(b),b=setTimeout(()=>{a.classList.remove("visible")},2800))}async function $(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?i("page.accountSettings.subtitleWithEmail",{email:t.email}):i("page.accountSettings.subtitle"));let a=await window.AstroAPI.getAccountPreferences();g(a),A()}async function F(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=v(),a=await window.AstroAPI.patchAccountPreferences(e);g(a),u(i("page.accountSettings.toasts.saved"),"success")}catch(e){u(e.message||i("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function j(){g(_()),u(i("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("reloadAccountSettingsBtn"),a=document.getElementById("restoreStandardDefaultsBtn");t?.addEventListener("click",()=>{F()}),e?.addEventListener("click",()=>{$().catch(n=>{u(n.message||i("page.accountSettings.toasts.reloadFailed"),"error")})}),a?.addEventListener("click",()=>{j()});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await $(),document.addEventListener("frontend:locale-changed",()=>{S&&g(S)})}catch(n){u(n.message||i("page.accountSettings.toasts.loadFailed"),"error"),A()}})})();
