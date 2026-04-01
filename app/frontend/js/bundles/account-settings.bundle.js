import{a as he}from"./chunks/chunk-DSL2JQTL.js";import"./chunks/chunk-I2UJFIF5.js";import{b as E,d as me,e as ge,f as ye,g as fe}from"./chunks/chunk-IGMIONLW.js";var be=E(me()),we=E(ge()),Se=E(ye());var Be=E(fe()),_e=E(he());(function(){"use strict";let O=["natal","biwheel","solar"],R=["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"],L=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],P="activePreferenceRecalcJobId",u=null,A=null,q=null,B=null,m="natal";function V(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),300))}function p(e,t){return window.FrontendI18n?.t?.(e,t)||e}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function f(e,t=""){let o=p(e);return o&&o!==e?o:t}function h(e){return f(`astro.planet.${e}`,e)}function K(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function b(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function y(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function x(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function D(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function X(){return window.AstroPreferences?.MATRIX_BODIES||[]}function _(){return A?.aspect_types||R.map(e=>({aspect_type:e}))}function v(){return(A?.bodies||[]).map(e=>e?.name).filter(Boolean)}function w(){return Object.fromEntries(_().map(e=>[e.aspect_type,Object.fromEntries(v().map(t=>[t,Number(e.base_orb||5)]))]))}function S(){let e={version:2,profiles:Object.fromEntries(L.map(t=>[t,{matrix:w()}]))};return y({orbs:e,balances:A?.default_balance_targets||{}})}function H(){return x(A?.default_visual_palettes||{})}function J(){return{chart_defaults:{natal:b({}),biwheel:b({aspects:{scope:"major"}}),solar:b({})},chart_creation_defaults:{house_system:"P"},methodology:S(),visual:H()}}function W(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function M(){return u||(u={methodology:S()}),u.methodology=y(u.methodology||S()),u.methodology}function G(e){return M()?.orbs?.profiles?.[e]?.matrix||w()}function z(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(a=>{let n=a.dataset.orbProfileTab===m;a.classList.toggle("is-active",n),a.setAttribute("aria-selected",n?"true":"false"),t&&n&&a.id&&t.setAttribute("aria-labelledby",a.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${m}`)),o&&o.classList.toggle("hidden",m!=="prognostic")}function C(){let e=M(),t=w();document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let a=o.dataset.orbAspectType,n=o.dataset.orbBody;!a||!n||(t[a]||(t[a]={}),t[a][n]=Number.parseFloat(o.value)||0)}),e.orbs.profiles[m]={matrix:t}}function Z(e,{rerender:t=!0}={}){L.includes(e)&&(u&&C(),m=e,z(),t&&u&&N(u.methodology))}function ee(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=_().map(o=>{let a=o.aspect_type,n=i(window.Symbols?.aspects?.[a]||""),s=i(p(`astro.aspect.${a}`)),c=O.map(l=>{let d=e?.[l]?.aspects?.enabled_types||[],$=new Set(Array.isArray(d)&&d.length?d:R).has(a)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${a}"
                                ${$}
                                aria-label="${i(`${f(`page.accountSettings.tables.columns.${l}`,l)}: ${s}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${s}" aria-label="${s}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${n}</span></span>
                        </span>
                    </th>
                    ${c}
                </tr>
            `}).join(""))}function te(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=X().map(o=>{let a=i(h(o)),n=i(window.Symbols?.planets?.[o]||""),s=O.map(c=>{let l=D(e?.[c]?.matrix?.rows||{}),d=l?.[o]?.display!==!1?"checked":"",r=l?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${d}
                                aria-label="${i(`${f(`page.accountSettings.tables.columns.${c}`,c)}: ${a} ${p("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-matrix-body="${o}"
                                data-matrix-field="aspecting"
                                ${r}
                                aria-label="${i(`${f(`page.accountSettings.tables.columns.${c}`,c)}: ${a} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${a}" aria-label="${a}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${n}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function N(e={}){let t=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!t||!o)return;let a=v(),n=_(),c=y(e||S())?.orbs?.profiles?.[m]?.matrix||w();t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${a.map(l=>{let d=i(h(l)),r=i(window.Symbols?.planets?.[l]||l);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=n.map(l=>{let d=l.aspect_type,r=i(window.Symbols?.aspects?.[d]||""),$=i(f(`astro.aspect.${d}`,d));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${$}" aria-label="${$}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r}</span>
                            </span>
                        </span>
                    </th>
                    ${a.map(j=>{let Y=c?.[d]?.[j],pe=i(h(j));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(Y))?Number(Y):Number(l.base_orb||5)}"
                                    aria-label="${i(`${$} · ${pe}`)}"
                                    data-orb-aspect-type="${d}"
                                    data-orb-body="${j}"
                                    data-orb-profile="${m}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),z()}function oe(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!o)return;let a=e?.balances||{},n=a?.planet_weights||{},s=a?.special_point_weights||{},l=v().filter(r=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(r)),d=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=l.map(r=>`
            <tr>
                <th scope="row">${i(h(r))}</th>
                <td><input class="account-settings-number-input" type="number" min="0" max="5" step="0.1" value="${Number(n?.[r]??1).toFixed(1)}" data-balance-planet="${r}"></td>
            </tr>
        `).join(""),o.innerHTML=d.map(r=>`
            <tr>
                <th scope="row">${i(h(r))}</th>
                <td><input class="account-settings-number-input" type="number" min="0" max="5" step="0.1" value="${Number(s?.[r]??0).toFixed(1)}" data-balance-special-point="${r}"></td>
            </tr>
        `).join("")}function ae(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let o=e?.aspect_colors||{};t.innerHTML=_().map(a=>{let n=a.aspect_type,s=o?.[n]||"#9ca3af";return`
                <tr>
                    <th scope="row">${i(f(`astro.aspect.${n}`,n))}</th>
                    <td><input type="color" class="account-settings-color-input" value="${i(s)}" data-aspect-color="${n}"></td>
                </tr>
            `}).join("")}function ne(e={}){let t=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!t||!o)return;let a=x(e),n=a?.planet_colors?.element_palette||{},s=a?.planet_colors?.body_overrides||{};t.innerHTML=Object.keys(n).map(c=>`
            <tr>
                <th scope="row">${i(c)}</th>
                <td><input type="color" class="account-settings-color-input" value="${i(n[c])}" data-element-color="${c}"></td>
            </tr>
        `).join(""),o.innerHTML=v().map(c=>`
            <tr>
                <th scope="row">${i(h(c))}</th>
                <td><input type="text" class="account-settings-hex-input" value="${i(s?.[c]||"")}" placeholder="#hex or empty" data-body-color-override="${c}"></td>
            </tr>
        `).join("")}function T(e){let t={...J(),...e||{},chart_defaults:{natal:b(e?.chart_defaults?.natal||{}),biwheel:b(e?.chart_defaults?.biwheel||{}),solar:b(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:y(e?.methodology||S()),visual:x(e?.visual||H())};u=t,window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),L.includes(m)||(m="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P"),O.forEach(a=>{let n=t.chart_defaults[a],s=W(a);s.orientation&&(s.orientation.value=n.view_options?.orientation==="asc"?"asc":"aries"),s.aspectScope&&(s.aspectScope.value=n.aspects?.scope||(a==="biwheel"?"major":"all")),s.showApplyingSeparating&&(s.showApplyingSeparating.checked=n.aspects?.show_applying_separating===!0),s.showSpeed&&(s.showSpeed.checked=n.table_options?.show_speed!==!1),s.showStationary&&(s.showStationary.checked=n.table_options?.show_stationary!==!1)}),ee(t.chart_defaults),te(t.chart_defaults),N(t.methodology),oe(t.methodology),ae(t.visual),ne(t.visual)}function se(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&t.push(o.dataset.aspectType)}),t.length?t:_().map(o=>o.aspect_type)}function ce(e){let t=D({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let a=o.dataset.matrixBody,n=o.dataset.matrixField;!a||!n||(t[a]={...t[a]||{display:!0,aspecting:!0},[n]:o.checked})}),t}function k(e){let t=W(e);return{matrix:{rows:ce(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:se(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function re(){C();let e=y(u?.methodology||S())?.orbs?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(t[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),y({orbs:{version:2,profiles:e},balances:{version:1,planet_weights:t,special_point_weights:o}})}function le(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(a=>{a.dataset.aspectColor&&a.value&&(e[a.dataset.aspectColor]=a.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(a=>{a.dataset.elementColor&&a.value&&(t[a.dataset.elementColor]=a.value)});let o={};return document.querySelectorAll("[data-body-color-override]").forEach(a=>{let n=a.dataset.bodyColorOverride,s=String(a.value||"").trim();n&&s&&(o[n]=s)}),x({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:o}})}function ie(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:k("natal"),biwheel:k("biwheel"),solar:k("solar")},methodology:re(),visual:le()}}function g(e,t="info"){let o=document.getElementById("accountSettingsToast");!o||!e||(o.textContent=e,o.className=`toast ${t}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(q),q=setTimeout(()=>{o.classList.remove("visible")},2800))}function I(e,{final:t=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!e){o.classList.add("hidden"),o.textContent="";return}let a=Number(e.progress_total||0),n=Number(e.progress_done||0),s=a>0?Math.min(100,Math.round(n/a*100)):0,l=`${String(e.status||"pending").toUpperCase()} · ${n}/${a||"0"} · ${s}%`,d=Number(e.failed_count||0),r=d?` · failures: ${d}`:"";o.textContent=t?`${l}${r}`:`${l}${r}`,o.classList.remove("hidden"),o.dataset.status=String(e.status||"pending")}function F(){B&&(clearTimeout(B),B=null)}async function U(e){if(F(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(P,String(e));let t=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(e);if(I(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(P),g(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),F();return}if(o.status==="failed"){sessionStorage.removeItem(P),g(o.error||"Methodology recalculation failed.","error"),F();return}B=setTimeout(t,2500)}catch(o){B=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await t()}async function Q(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?p("page.accountSettings.subtitleWithEmail",{email:e.email}):p("page.accountSettings.subtitle"));let[o,a]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);A=o||null,T(a);let n=sessionStorage.getItem(P);n?U(n).catch(s=>{console.warn("Failed to resume recalculation job polling:",s)}):I(null),V()}async function de(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=ie(),o=!K(y(u?.methodology||{}),t.methodology),a=await window.AstroAPI.patchAccountPreferences(t);if(T(a),o&&window.AstroAPI?.createPreferenceRecalcJob){let n=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});I(n),U(n.job_id).catch(s=>{console.warn("Failed to poll methodology recalculation job:",s)}),g("Preferences saved. Methodology recalculation started.","success");return}g(p("page.accountSettings.toasts.saved"),"success")}catch(t){g(t.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ue(){T(J()),I(null),g(p("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("reloadAccountSettingsBtn"),o=document.getElementById("restoreStandardDefaultsBtn"),a=document.getElementById("accountApplyNatalOrbsBtn"),n=document.getElementById("accountOrbsMatrixBody");e?.addEventListener("click",()=>{de()}),t?.addEventListener("click",()=>{Q().catch(s=>{g(s.message||p("page.accountSettings.toasts.reloadFailed"),"error")})}),o?.addEventListener("click",()=>{ue()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(s=>{s.addEventListener("click",()=>{Z(s.dataset.orbProfileTab||"natal")})}),a?.addEventListener("click",()=>{C();let s=M();s.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(G("natal")))},m="prognostic",N(s),g(p("page.accountSettings.toasts.orbsCopied"),"info")}),n?.addEventListener("input",s=>{let c=s.target;if(!(c instanceof HTMLInputElement)||!c.dataset.orbAspectType||!c.dataset.orbBody)return;let l=M(),r=(l.orbs.profiles[m]||{matrix:w()}).matrix||w();r[c.dataset.orbAspectType]||(r[c.dataset.orbAspectType]={}),r[c.dataset.orbAspectType][c.dataset.orbBody]=Number.parseFloat(c.value)||0,l.orbs.profiles[m]={matrix:r}});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Q(),document.addEventListener("frontend:locale-changed",()=>{u&&T(u)})}catch(s){g(s.message||p("page.accountSettings.toasts.loadFailed"),"error"),V()}})})();
