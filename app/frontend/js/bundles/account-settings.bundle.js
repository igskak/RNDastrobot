import{a as Pt}from"./chunks/chunk-HR5WRAQJ.js";import"./chunks/chunk-2MGLT2CN.js";import{b as x,d as $t,e as _t,f as vt,g as Et}from"./chunks/chunk-IGMIONLW.js";var xt=x($t()),Tt=x(_t()),Mt=x(vt());var Lt=x(Et()),Ct=x(Pt());(function(){"use strict";let k=["natal","biwheel","solar"],J=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],et={Sesquiquadrate:"⚼",Vigintile:"V",Semi_Nonagon:"SN",Decile:"D",Nonagon:"N",Binonagon:"BN",Sentagon:"SG",Tridecile:"TD",Septile:"7",Novile:"9"},H=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],T=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",M="activePreferenceRecalcJobId",p=null,v=null,z=null,E=null,g="natal";function W(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function u(t,e){return window.FrontendI18n?.t?.(t,e)||t}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function w(t,e=""){let o=u(t);return o&&o!==t?o:e}function m(t){return w(`astro.planet.${t}`,t)}function F(t){return window.Symbols?.planets?.[t]||String(t||"").slice(0,2)||"•"}function P(t){return w(`astro.aspect.${t}`,t)}function q(t){return window.Symbols?.aspects?.[t]||et[t]||String(t||"").slice(0,2)||"•"}function I(t){return w({harmonious:"page.chart.legend.harmonious",tense:"page.chart.legend.tense",neutral:"page.chart.legend.neutral"}[t],t)}function ot(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function A(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function h(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function B(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function U(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function at(){return window.AstroPreferences?.MATRIX_BODIES||[]}function $(){return v?.aspect_types||J.map(t=>({aspect_type:t}))}function nt(t){return $().find(e=>e?.aspect_type===t)||null}function st(t){return nt(t)?.character||window.AstroPreferences?.getAspectHarmonyType?.(t)||"neutral"}function L(){return(v?.bodies||[]).map(t=>t?.name).filter(Boolean)}function _(){return Object.fromEntries($().map(t=>[t.aspect_type,Object.fromEntries(L().map(e=>[e,Number(t.base_orb||5)]))]))}function S(){let t={version:2,pair_strategy:T,profiles:Object.fromEntries(H.map(e=>[e,{matrix:_()}]))};return h({orbs:t,balances:v?.default_balance_targets||{}})}function Y(){return B(v?.default_visual_palettes||{})}function G(){return{chart_defaults:{natal:A({}),biwheel:A({aspects:{scope:"major"}}),solar:A({})},chart_creation_defaults:{house_system:"P"},methodology:S(),visual:Y()}}function K(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function C(){return p||(p={methodology:S()}),p.methodology=h(p.methodology||S()),p.methodology}function ct(t){return C()?.orbs?.profiles?.[t]?.matrix||_()}function rt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||T:h(p?.methodology||S())?.orbs?.pair_strategy||T}function Q(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{let a=n.dataset.orbProfileTab===g;n.classList.toggle("is-active",a),n.setAttribute("aria-selected",a?"true":"false"),e&&a&&n.id&&e.setAttribute("aria-labelledby",n.id)}),t&&(t.textContent=u(`page.accountSettings.orbs.hints.${g}`)),o&&o.classList.toggle("hidden",g!=="prognostic")}function R(){let t=C(),e=_();document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let n=o.dataset.orbAspectType,a=o.dataset.orbBody;!n||!a||(e[n]||(e[n]={}),e[n][a]=Number.parseFloat(o.value)||0)}),t.orbs.profiles[g]={matrix:e}}function lt(t,{rerender:e=!0}={}){H.includes(t)&&(p&&R(),g=t,Q(),e&&p&&D(p.methodology))}function it(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=$().map(o=>{let n=o.aspect_type,a=r(q(n)),i=r(P(n)),c=k.map(s=>{let l=t?.[s]?.aspects?.enabled_types||[],y=new Set(Array.isArray(l)&&l.length?l:J).has(n)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-aspect-type="${n}"
                                ${y}
                                aria-label="${r(`${w(`page.accountSettings.tables.columns.${s}`,s)}: ${i}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${i}" aria-label="${i}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${a}</span></span>
                        </span>
                    </th>
                    ${c}
                </tr>
            `}).join(""))}function dt(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=at().map(o=>{let n=r(m(o)),a=r(window.Symbols?.planets?.[o]||""),i=k.map(c=>{let s=U(t?.[c]?.matrix?.rows||{}),l=s?.[o]?.display!==!1?"checked":"",d=s?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${l}
                                aria-label="${r(`${w(`page.accountSettings.tables.columns.${c}`,c)}: ${n} ${u("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${d}
                                aria-label="${r(`${w(`page.accountSettings.tables.columns.${c}`,c)}: ${n} ${u("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${n}" aria-label="${n}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${a}</span></span>
                        </span>
                    </th>
                    ${i}
                </tr>
            `}).join(""))}function D(t={}){let e=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!e||!o)return;let n=L(),a=$(),c=h(t||S())?.orbs?.profiles?.[g]?.matrix||_();e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${n.map(s=>{let l=r(m(s)),d=r(window.Symbols?.planets?.[s]||s);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${l}" aria-label="${l}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${d}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=a.map(s=>{let l=s.aspect_type,d=r(q(l)),y=r(P(l));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${d}</span>
                            </span>
                        </span>
                    </th>
                    ${n.map(f=>{let tt=c?.[l]?.[f],Bt=r(m(f));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(tt))?Number(tt):Number(s.base_orb||5)}"
                                    aria-label="${r(`${y} · ${Bt}`)}"
                                    data-orb-aspect-type="${l}"
                                    data-orb-body="${f}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Q()}function ut(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!o)return;let n=t?.balances||{},a=n?.planet_weights||{},i=n?.special_point_weights||{},s=L().filter(d=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(d)),l=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=s.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(d))}" aria-label="${r(m(d))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(F(d))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <input
                        class="account-settings-number-input account-settings-compact-input"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value="${Number(a?.[d]??1).toFixed(1)}"
                        data-balance-planet="${d}"
                        aria-label="${r(m(d))}"
                    >
                </td>
            </tr>
        `).join(""),o.innerHTML=l.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(d))}" aria-label="${r(m(d))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(F(d))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <input
                        class="account-settings-number-input account-settings-compact-input"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        value="${Number(i?.[d]??0).toFixed(1)}"
                        data-balance-special-point="${d}"
                        aria-label="${r(m(d))}"
                    >
                </td>
            </tr>
        `).join("")}function pt(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let o=B(t);e.innerHTML=$().map(n=>{let a=n.aspect_type,i=n.character||st(a),c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,o,i):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(P(a))}" aria-label="${r(P(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(q(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(c)}"
                            data-aspect-color="${a}"
                            data-aspect-character="${r(i)}"
                            aria-label="${r(P(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function mt(t={}){let e=document.getElementById("accountAspectHarmonyColorsBody");if(!e)return;let n=B(t)?.aspect_harmony_colors||{},a=["harmonious","tense","neutral"];e.innerHTML=a.map(i=>`
            <tr>
                <th scope="row">${r(I(i))}</th>
                <td>
                    <input
                        type="color"
                        class="account-settings-color-input account-settings-swatch-input"
                        value="${r(n[i]||"#9ca3af")}"
                        data-aspect-harmony-color="${i}"
                        aria-label="${r(I(i))}"
                    >
                </td>
                <td>
                    <button
                        type="button"
                        class="account-settings-reset-chip"
                        data-apply-aspect-harmony-color="${i}"
                        title="${r(u("page.accountSettings.visual.actions.applyMatching"))}"
                        aria-label="${r(`${u("page.accountSettings.visual.actions.applyMatching")}: ${I(i)}`)}"
                    >⇢</button>
                </td>
            </tr>
        `).join("")}function gt(t={}){let e=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!e||!o)return;let n=B(t),a=n?.planet_colors?.element_palette||{},i=n?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(a).map(c=>`
            <tr>
                <th scope="row">${r(c)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[c])}" data-element-color="${c}" aria-label="${r(c)}"></td>
            </tr>
        `).join(""),o.innerHTML=L().map(c=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(c))}" aria-label="${r(m(c))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(F(c))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(i?.[c]||"#c7b49a")}"
                            data-body-color-override="${c}"
                            data-body-color-active="${i?.[c]?"true":"false"}"
                            aria-label="${r(m(c))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${i?.[c]?"":" is-muted"}"
                            data-clear-body-color-override="${c}"
                            title="${r(u("common.reset"))}"
                            aria-label="${r(`${u("common.reset")}: ${m(c)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function O(t){let e={...G(),...t||{},chart_defaults:{natal:A(t?.chart_defaults?.natal||{}),biwheel:A(t?.chart_defaults?.biwheel||{}),solar:A(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:h(t?.methodology||S()),visual:B(t?.visual||Y())};p=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),H.includes(g)||(g="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=e.chart_creation_defaults.house_system||"P");let n=document.getElementById("accountOrbPairStrategySelect");n&&(n.value=e.methodology?.orbs?.pair_strategy||T);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(e.methodology?.stationary?.threshold_percent??5)),k.forEach(i=>{let c=e.chart_defaults[i],s=K(i);s.orientation&&(s.orientation.value=c.view_options?.orientation==="asc"?"asc":"aries"),s.aspectScope&&(s.aspectScope.value=c.aspects?.scope||(i==="biwheel"?"major":"all")),s.showApplyingSeparating&&(s.showApplyingSeparating.checked=c.aspects?.show_applying_separating===!0),s.showSpeed&&(s.showSpeed.checked=c.table_options?.show_speed!==!1),s.showStationary&&(s.showStationary.checked=c.table_options?.show_stationary!==!1)}),it(e.chart_defaults),dt(e.chart_defaults),D(e.methodology),ut(e.methodology),mt(e.visual),pt(e.visual),gt(e.visual)}function yt(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&e.push(o.dataset.aspectType)}),e.length?e:$().map(o=>o.aspect_type)}function ft(t){let e=U({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let n=o.dataset.matrixBody,a=o.dataset.matrixField;!n||!a||(e[n]={...e[n]||{display:!0,aspecting:!0},[a]:o.checked})}),e}function V(t){let e=K(t);return{matrix:{rows:ft(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:yt(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function bt(){R();let e=(h(p?.methodology||S())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(o[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let n={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(n[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),h({orbs:{version:2,pair_strategy:rt(),profiles:e},balances:{version:1,planet_weights:o,special_point_weights:n},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")}})}function ht(){let t={};document.querySelectorAll("[data-aspect-harmony-color]").forEach(a=>{a.dataset.aspectHarmonyColor&&a.value&&(t[a.dataset.aspectHarmonyColor]=a.value)});let e={};document.querySelectorAll("[data-aspect-color]").forEach(a=>{a.dataset.aspectColor&&a.value&&(e[a.dataset.aspectColor]=a.value)});let o={};document.querySelectorAll("[data-element-color]").forEach(a=>{a.dataset.elementColor&&a.value&&(o[a.dataset.elementColor]=a.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(a=>{let i=a.dataset.bodyColorOverride,c=String(a.value||"").trim();i&&c&&a.dataset.bodyColorActive!=="false"&&(n[i]=c)}),B({aspect_harmony_colors:t,aspect_colors:e,planet_colors:{element_palette:o,body_overrides:n}})}function St(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:V("natal"),biwheel:V("biwheel"),solar:V("solar")},methodology:bt(),visual:ht()}}function b(t,e="info"){let o=document.getElementById("accountSettingsToast");!o||!t||(o.textContent=t,o.className=`toast ${e}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(z),z=setTimeout(()=>{o.classList.remove("visible")},2800))}function N(t,{final:e=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!t){o.classList.add("hidden"),o.textContent="";return}let n=Number(t.progress_total||0),a=Number(t.progress_done||0),i=n>0?Math.min(100,Math.round(a/n*100)):0,s=`${String(t.status||"pending").toUpperCase()} · ${a}/${n||"0"} · ${i}%`,l=Number(t.failed_count||0),d=l?` · failures: ${l}`:"";o.textContent=e?`${s}${d}`:`${s}${d}`,o.classList.remove("hidden"),o.dataset.status=String(t.status||"pending")}function j(){E&&(clearTimeout(E),E=null)}async function X(t){if(j(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(M,String(t));let e=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(t);if(N(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(M),b(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),j();return}if(o.status==="failed"){sessionStorage.removeItem(M),b(o.error||"Methodology recalculation failed.","error"),j();return}E=setTimeout(e,2500)}catch(o){E=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await e()}async function Z(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?u("page.accountSettings.subtitleWithEmail",{email:t.email}):u("page.accountSettings.subtitle"));let[o,n]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);v=o||null,O(n);let a=sessionStorage.getItem(M);a?X(a).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):N(null),W()}async function wt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=St(),o=!ot(h(p?.methodology||{}),e.methodology),n=await window.AstroAPI.patchAccountPreferences(e);if(O(n),o&&window.AstroAPI?.createPreferenceRecalcJob){let a=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});N(a),X(a.job_id).catch(i=>{console.warn("Failed to poll methodology recalculation job:",i)}),b("Preferences saved. Methodology recalculation started.","success");return}b(u("page.accountSettings.toasts.saved"),"success")}catch(e){b(e.message||u("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function At(){O(G()),N(null),b(u("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("reloadAccountSettingsBtn"),o=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),a=document.getElementById("accountOrbsMatrixBody"),i=document.getElementById("accountAspectHarmonyColorsBody"),c=document.getElementById("accountBodyOverrideColorsBody");t?.addEventListener("click",()=>{wt()}),e?.addEventListener("click",()=>{Z().catch(s=>{b(s.message||u("page.accountSettings.toasts.reloadFailed"),"error")})}),o?.addEventListener("click",()=>{At()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(s=>{s.addEventListener("click",()=>{lt(s.dataset.orbProfileTab||"natal")})}),n?.addEventListener("click",()=>{R();let s=C();s.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(ct("natal")))},g="prognostic",D(s),b(u("page.accountSettings.toasts.orbsCopied"),"info")}),a?.addEventListener("input",s=>{let l=s.target;if(!(l instanceof HTMLInputElement)||!l.dataset.orbAspectType||!l.dataset.orbBody)return;let d=C(),f=(d.orbs.profiles[g]||{matrix:_()}).matrix||_();f[l.dataset.orbAspectType]||(f[l.dataset.orbAspectType]={}),f[l.dataset.orbAspectType][l.dataset.orbBody]=Number.parseFloat(l.value)||0,d.orbs.profiles[g]={matrix:f}}),i?.addEventListener("click",s=>{let l=s.target.closest("[data-apply-aspect-harmony-color]");if(!(l instanceof HTMLElement))return;let d=l.dataset.applyAspectHarmonyColor;if(!d)return;let y=i.querySelector(`[data-aspect-harmony-color="${d}"]`);y instanceof HTMLInputElement&&(document.querySelectorAll("[data-aspect-color]").forEach(f=>{f instanceof HTMLInputElement&&f.dataset.aspectCharacter===d&&(f.value=y.value)}),b(u("page.accountSettings.toasts.aspectHarmonyApplied",{type:I(d)}),"info"))}),c?.addEventListener("input",s=>{let l=s.target;if(!(l instanceof HTMLInputElement)||!l.dataset.bodyColorOverride)return;l.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${l.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",s=>{let l=s.target.closest("[data-clear-body-color-override]");if(!(l instanceof HTMLElement))return;let d=l.dataset.clearBodyColorOverride;if(!d)return;let y=c.querySelector(`[data-body-color-override="${d}"]`);y instanceof HTMLInputElement&&(y.dataset.bodyColorActive="false",l.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Z(),document.addEventListener("frontend:locale-changed",()=>{p&&O(p)})}catch(s){b(s.message||u("page.accountSettings.toasts.loadFailed"),"error"),W()}})})();
