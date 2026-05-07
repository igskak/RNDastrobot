import{a as He}from"./chunks/chunk-BNZBI5WZ.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as O,d as Le,e as Oe,f as ke,g as Re}from"./chunks/chunk-E24Q6PJF.js";var Ne=O(Le()),qe=O(Oe()),Fe=O(ke());var Ve=O(Re()),je=O(He());(function(){"use strict";let z=["natal","biwheel","solar"],Q=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],J=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],k=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",R="activePreferenceRecalcJobId",X="accountOrbViewMode",f=null,T=null,Z=null,M=null,g="natal",I="default",H=null;function ee(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function y(e,t){return window.FrontendI18n?.t?.(e,t)||e}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function B(e,t=""){let o=y(e);return o&&o!==e?o:t}function m(e){return B(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function te(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function N(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${r(te(e))}</span>`}function C(e){return B(`astro.aspect.${e}`,e)}function W(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function q(e){return B({harmonious:"page.chart.legend.harmonious",tense:"page.chart.legend.tense",neutral:"page.chart.legend.neutral"}[e],e)}function de(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function v(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function S(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function _(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function oe(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function ue(){return window.AstroPreferences?.MATRIX_BODIES||[]}function $(){return T?.aspect_types||Q.map(e=>({aspect_type:e}))}function pe(e){return $().find(t=>t?.aspect_type===e)||null}function me(e){return pe(e)?.character||window.AstroPreferences?.getAspectHarmonyType?.(e)||"neutral"}function F(){return(T?.bodies||[]).map(e=>e?.name).filter(Boolean)}function P(e="natal"){let t=$(),o=F();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,o,e):Object.fromEntries(t.map(n=>[n.aspect_type,Object.fromEntries(o.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(n.base_orb||5)]))]))}function A(){let e={version:2,pair_strategy:k,profiles:Object.fromEntries(J.map(t=>[t,{matrix:P(t)}]))};return S({orbs:e,balances:T?.default_balance_targets||{}})}function ae(){return _(T?.default_visual_palettes||{})}function ne(){return{chart_defaults:{natal:v({}),biwheel:v({aspects:{scope:"major"}}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:A(),visual:ae()}}function se(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function D(){return f||(f={methodology:A()}),f.methodology=S(f.methodology||A()),f.methodology}function ge(e){return D()?.orbs?.profiles?.[e]?.matrix||P(e)}function ye(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||k:S(f?.methodology||A())?.orbs?.pair_strategy||k}function ce(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{let a=n.dataset.orbProfileTab===g;n.classList.toggle("is-active",a),n.setAttribute("aria-selected",a?"true":"false"),t&&a&&n.id&&t.setAttribute("aria-labelledby",n.id)}),e&&(e.textContent=y(`page.accountSettings.orbs.hints.${g}`)),o&&o.classList.toggle("hidden",g!=="prognostic")}function re(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(o=>{let n=o.dataset.orbViewMode===I;o.classList.toggle("is-active",n),o.setAttribute("aria-selected",n?"true":"false")}),e?.classList.toggle("is-compact",I==="compact"),t?.classList.toggle("is-compact",I==="compact")}function U(){let e=D(),t=P(g);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let n=o.dataset.orbAspectType,a=o.dataset.orbBody;!n||!a||(t[n]||(t[n]={}),t[n][a]=Number.parseFloat(o.value)||0)}),e.orbs.profiles[g]={matrix:t}}function fe(e,{rerender:t=!0}={}){J.includes(e)&&(f&&U(),g=e,ce(),t&&f&&Y(f.methodology))}function he(e){["default","compact"].includes(e)&&(I=e,localStorage.setItem(X,e),re())}function be(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=$().map(o=>{let n=o.aspect_type,a=r(W(n)),c=r(C(n)),s=z.map(l=>{let p=e?.[l]?.aspects?.enabled_types||[],E=new Set(Array.isArray(p)&&p.length?p:Q).has(n)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${n}"
                                ${E}
                                aria-label="${r(`${B(`page.accountSettings.tables.columns.${l}`,l)}: ${c}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${a}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function Se(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=ue().map(o=>{let n=r(m(o)),a=N(o,{size:18,title:m(o)}),c=z.map(s=>{let l=oe(e?.[s]?.matrix?.rows||{}),p=l?.[o]?.display!==!1?"checked":"",i=l?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${p}
                                aria-label="${r(`${B(`page.accountSettings.tables.columns.${s}`,s)}: ${n} ${y("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${o}"
                                data-matrix-field="aspecting"
                                ${i}
                                aria-label="${r(`${B(`page.accountSettings.tables.columns.${s}`,s)}: ${n} ${y("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${n}" aria-label="${n}" role="img" tabindex="0">${a}</span>
                        </span>
                    </th>
                    ${c}
                </tr>
            `}).join(""))}function Y(e={}){let t=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!t||!o)return;let n=F(),a=$(),s=S(e||A())?.orbs?.profiles?.[g]?.matrix||P(g);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${n.map(l=>{let p=r(m(l)),i=N(l,{size:18,title:m(l)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${p}" aria-label="${p}" role="img" tabindex="0">
                                ${i}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=a.map(l=>{let p=l.aspect_type,i=r(W(p)),E=r(C(p));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${E}" aria-label="${E}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                    ${n.map(d=>{let u=s?.[p]?.[d],h=r(m(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(l.base_orb||5)}"
                                    aria-label="${r(`${E} · ${h}`)}"
                                    data-orb-aspect-type="${p}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),ce(),re()}function we(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!o)return;let n=e?.balances||{},a=n?.planet_weights||{},c=n?.special_point_weights||{},l=F().filter(i=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(i)),p=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=l.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(i))}" aria-label="${r(m(i))}" role="img" tabindex="0">
                                ${N(i,{size:18,title:m(i)})}
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
                        value="${Number(a?.[i]??1).toFixed(1)}"
                        data-balance-planet="${i}"
                        aria-label="${r(m(i))}"
                    >
                </td>
            </tr>
        `).join(""),o.innerHTML=p.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(i))}" aria-label="${r(m(i))}" role="img" tabindex="0">
                                ${N(i,{size:18,title:m(i)})}
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
                        value="${Number(c?.[i]??0).toFixed(1)}"
                        data-balance-special-point="${i}"
                        aria-label="${r(m(i))}"
                    >
                </td>
            </tr>
        `).join("")}function Ae(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let o=_(e);t.innerHTML=$().map(n=>{let a=n.aspect_type,c=n.character||me(a),s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,o,c):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(C(a))}" aria-label="${r(C(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(W(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(s)}"
                            data-aspect-color="${a}"
                            data-aspect-character="${r(c)}"
                            aria-label="${r(C(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Ee(e={}){let t=document.getElementById("accountAspectHarmonyColorsBody");if(!t)return;let n=_(e)?.aspect_harmony_colors||{},a=["harmonious","tense","neutral"];t.innerHTML=a.map(c=>`
            <tr>
                <th scope="row">${r(q(c))}</th>
                <td>
                    <input
                        type="color"
                        class="account-settings-color-input account-settings-swatch-input"
                        value="${r(n[c]||"#9ca3af")}"
                        data-aspect-harmony-color="${c}"
                        aria-label="${r(q(c))}"
                    >
                </td>
                <td>
                    <button
                        type="button"
                        class="account-settings-reset-chip"
                        data-apply-aspect-harmony-color="${c}"
                        title="${r(y("page.accountSettings.visual.actions.applyMatching"))}"
                        aria-label="${r(`${y("page.accountSettings.visual.actions.applyMatching")}: ${q(c)}`)}"
                    >⇢</button>
                </td>
            </tr>
        `).join("")}function Be(e={}){let t=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!t||!o)return;let n=_(e),a=n?.planet_colors?.element_palette||{},c=n?.planet_colors?.body_overrides||{};t.innerHTML=Object.keys(a).map(s=>`
            <tr>
                <th scope="row">${r(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[s])}" data-element-color="${s}" aria-label="${r(s)}"></td>
            </tr>
        `).join(""),o.innerHTML=F().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(s))}" aria-label="${r(m(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(te(s))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(c?.[s]||"#c7b49a")}"
                            data-body-color-override="${s}"
                            data-body-color-active="${c?.[s]?"true":"false"}"
                            aria-label="${r(m(s))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${c?.[s]?"":" is-muted"}"
                            data-clear-body-color-override="${s}"
                            title="${r(y("common.reset"))}"
                            aria-label="${r(`${y("common.reset")}: ${m(s)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function V(e){let t={...ne(),...e||{},chart_defaults:{natal:v(e?.chart_defaults?.natal||{}),biwheel:v(e?.chart_defaults?.biwheel||{}),solar:v(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:S(e?.methodology||A()),visual:_(e?.visual||ae())};f=t,window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),J.includes(g)||(g="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let n=document.getElementById("accountOrbPairStrategySelect");n&&(n.value=t.methodology?.orbs?.pair_strategy||k);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(t.methodology?.stationary?.threshold_percent??5)),z.forEach(c=>{let s=t.chart_defaults[c],l=se(c);l.orientation&&(l.orientation.value=s.view_options?.orientation==="asc"?"asc":"aries"),l.aspectScope&&(l.aspectScope.value=s.aspects?.scope||(c==="biwheel"?"major":"all")),l.showApplyingSeparating&&(l.showApplyingSeparating.checked=s.aspects?.show_applying_separating===!0),l.showSpeed&&(l.showSpeed.checked=s.table_options?.show_speed!==!1),l.showStationary&&(l.showStationary.checked=s.table_options?.show_stationary!==!1),l.showAspectText&&(l.showAspectText.checked=s.table_options?.show_aspect_text===!0)}),be(t.chart_defaults),Se(t.chart_defaults),Y(t.methodology),we(t.methodology),Ee(t.visual),Ae(t.visual),Be(t.visual)}function ve(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&t.push(o.dataset.aspectType)}),t.length?t:$().map(o=>o.aspect_type)}function _e(e){let t=oe({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let n=o.dataset.matrixBody,a=o.dataset.matrixField;!n||!a||(t[n]={...t[n]||{display:!0,aspecting:!0},[a]:o.checked})}),t}function G(e){let t=se(e);return{matrix:{rows:_e(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:ve(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function $e(){U();let t=(S(f?.methodology||A())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(o[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let n={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(n[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),S({orbs:{version:2,pair_strategy:ye(),profiles:t},balances:{version:1,planet_weights:o,special_point_weights:n},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")}})}function Pe(){let e={};document.querySelectorAll("[data-aspect-harmony-color]").forEach(a=>{a.dataset.aspectHarmonyColor&&a.value&&(e[a.dataset.aspectHarmonyColor]=a.value)});let t={};document.querySelectorAll("[data-aspect-color]").forEach(a=>{a.dataset.aspectColor&&a.value&&(t[a.dataset.aspectColor]=a.value)});let o={};document.querySelectorAll("[data-element-color]").forEach(a=>{a.dataset.elementColor&&a.value&&(o[a.dataset.elementColor]=a.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(a=>{let c=a.dataset.bodyColorOverride,s=String(a.value||"").trim();c&&s&&a.dataset.bodyColorActive!=="false"&&(n[c]=s)}),_({aspect_harmony_colors:e,aspect_colors:t,planet_colors:{element_palette:o,body_overrides:n}})}function xe(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:G("natal"),biwheel:G("biwheel"),solar:G("solar")},methodology:$e(),visual:Pe()}}function b(e,t="info"){let o=document.getElementById("accountSettingsToast");!o||!e||(o.textContent=e,o.className=`toast ${t}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(Z),Z=setTimeout(()=>{o.classList.remove("visible")},2800))}function le(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function j(e,{final:t=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!e){o.classList.add("hidden"),o.textContent="";return}let n=Number(e.progress_total||0),a=Number(e.progress_done||0),c=n>0?Math.min(100,Math.round(a/n*100)):0,l=`${String(e.status||"pending").toUpperCase()} · ${a}/${n||"0"} · ${c}%`,p=Number(e.failed_count||0),i=p?` · failures: ${p}`:"";o.textContent=t?`${l}${i}`:`${l}${i}`,o.classList.remove("hidden"),o.dataset.status=String(e.status||"pending")}function K(){M&&(clearTimeout(M),M=null)}async function ie(e){if(K(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(R,String(e));let t=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(e);if(j(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(R),b(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),K();return}if(o.status==="failed"){sessionStorage.removeItem(R),b(o.error||"Methodology recalculation failed.","error"),K();return}M=setTimeout(t,2500)}catch(o){M=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await t()}async function Te(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?y("page.accountSettings.subtitleWithEmail",{email:e.email}):y("page.accountSettings.subtitle"));let[o,n]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);T=o||null,V(n);let a=sessionStorage.getItem(R);a?ie(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):j(null),ee()}async function Me(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=xe(),o=!de(S(f?.methodology||{}),t.methodology),n=await window.AstroAPI.patchAccountPreferences(t);if(V(n),o&&window.AstroAPI?.createPreferenceRecalcJob){let a=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});j(a),ie(a.job_id).catch(c=>{console.warn("Failed to poll methodology recalculation job:",c)}),b("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(le);return}b(y("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(le)}catch(t){b(t.message||y("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function Ie(){V(ne()),j(null),b(y("page.accountSettings.toasts.restored"),"info")}function L({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),o=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),o&&o.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&H instanceof HTMLElement&&H.focus(),H=null}function Ce(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),o=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(H=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{o?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{I=localStorage.getItem(X)==="compact"?"compact":"default";let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),n=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountAspectHarmonyColorsBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),l=document.getElementById("accountSettingsResetConfirmBackdrop"),p=document.getElementById("accountSettingsResetConfirmClose"),i=document.getElementById("accountSettingsResetConfirmCancel"),E=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{Me()}),t?.addEventListener("click",()=>{Ce()}),l?.addEventListener("click",()=>{L()}),p?.addEventListener("click",()=>{L()}),i?.addEventListener("click",()=>{L()}),E?.addEventListener("click",()=>{L({restoreFocus:!1}),Ie()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{fe(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{he(d.dataset.orbViewMode||"default")})}),o?.addEventListener("click",()=>{U();let d=D();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(ge("natal")))},g="prognostic",Y(d),b(y("page.accountSettings.toasts.orbsCopied"),"info")}),n?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.orbAspectType||!u.dataset.orbBody)return;let h=D(),w=(h.orbs.profiles[g]||{matrix:P(g)}).matrix||P(g);w[u.dataset.orbAspectType]||(w[u.dataset.orbAspectType]={}),w[u.dataset.orbAspectType][u.dataset.orbBody]=Number.parseFloat(u.value)||0,h.orbs.profiles[g]={matrix:w}}),a?.addEventListener("click",d=>{let u=d.target.closest("[data-apply-aspect-harmony-color]");if(!(u instanceof HTMLElement))return;let h=u.dataset.applyAspectHarmonyColor;if(!h)return;let x=a.querySelector(`[data-aspect-harmony-color="${h}"]`);x instanceof HTMLInputElement&&(document.querySelectorAll("[data-aspect-color]").forEach(w=>{w instanceof HTMLInputElement&&w.dataset.aspectCharacter===h&&(w.value=x.value)}),b(y("page.accountSettings.toasts.aspectHarmonyApplied",{type:q(h)}),"info"))}),c?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.bodyColorOverride)return;u.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${u.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let u=d.target.closest("[data-clear-body-color-override]");if(!(u instanceof HTMLElement))return;let h=u.dataset.clearBodyColorOverride;if(!h)return;let x=c.querySelector(`[data-body-color-override="${h}"]`);x instanceof HTMLInputElement&&(x.dataset.bodyColorActive="false",u.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Te(),document.addEventListener("frontend:locale-changed",()=>{f&&V(f)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||L())})}catch(d){b(d.message||y("page.accountSettings.toasts.loadFailed"),"error"),ee()}})})();
