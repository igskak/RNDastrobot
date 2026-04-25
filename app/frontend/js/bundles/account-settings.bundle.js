import{a as Ht}from"./chunks/chunk-3E2ICH4O.js";import"./chunks/chunk-V5BZBJZO.js";import"./chunks/chunk-Z53PUKAW.js";import{b as O,d as Tt,e as Ot,f as kt,g as Rt}from"./chunks/chunk-LKIIZ4YQ.js";var Nt=O(Tt()),qt=O(Ot()),Ft=O(kt());var Vt=O(Rt()),jt=O(Ht());(function(){"use strict";let z=["natal","biwheel","solar"],Q=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],J=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],k=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",R="activePreferenceRecalcJobId",X="accountOrbViewMode",f=null,C=null,Z=null,x=null,g="natal",L="default",H=null;function tt(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function y(t,e){return window.FrontendI18n?.t?.(t,e)||t}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function B(t,e=""){let o=y(t);return o&&o!==t?o:e}function m(t){return B(`astro.planet.${t}`,window.Symbols?.getPlanetNameRu?.(t)||t)}function et(t){return window.Symbols?.getPlanetSymbol?.(t)||String(t||"").slice(0,2)||"•"}function N(t,e={}){return window.Symbols?.getPlanetSymbolMarkup?.(t,e)||`<span class="astro-symbol" aria-hidden="true">${r(et(t))}</span>`}function I(t){return B(`astro.aspect.${t}`,t)}function W(t){return window.Symbols?.getAspectDisplay?.(t)||window.Symbols?.aspects?.[t]||String(t||"").slice(0,3)||"•"}function q(t){return B({harmonious:"page.chart.legend.harmonious",tense:"page.chart.legend.tense",neutral:"page.chart.legend.neutral"}[t],t)}function dt(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function v(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function S(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function $(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function ot(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function ut(){return window.AstroPreferences?.MATRIX_BODIES||[]}function _(){return C?.aspect_types||Q.map(t=>({aspect_type:t}))}function pt(t){return _().find(e=>e?.aspect_type===t)||null}function mt(t){return pt(t)?.character||window.AstroPreferences?.getAspectHarmonyType?.(t)||"neutral"}function F(){return(C?.bodies||[]).map(t=>t?.name).filter(Boolean)}function P(t="natal"){let e=_(),o=F();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(e,o,t):Object.fromEntries(e.map(n=>[n.aspect_type,Object.fromEntries(o.map(a=>[a,t==="prognostic"?a==="Moon"?3:1:Number(n.base_orb||5)]))]))}function A(){let t={version:2,pair_strategy:k,profiles:Object.fromEntries(J.map(e=>[e,{matrix:P(e)}]))};return S({orbs:t,balances:C?.default_balance_targets||{}})}function at(){return $(C?.default_visual_palettes||{})}function nt(){return{chart_defaults:{natal:v({}),biwheel:v({aspects:{scope:"major"}}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:A(),visual:at()}}function st(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function D(){return f||(f={methodology:A()}),f.methodology=S(f.methodology||A()),f.methodology}function gt(t){return D()?.orbs?.profiles?.[t]?.matrix||P(t)}function yt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||k:S(f?.methodology||A())?.orbs?.pair_strategy||k}function ct(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{let a=n.dataset.orbProfileTab===g;n.classList.toggle("is-active",a),n.setAttribute("aria-selected",a?"true":"false"),e&&a&&n.id&&e.setAttribute("aria-labelledby",n.id)}),t&&(t.textContent=y(`page.accountSettings.orbs.hints.${g}`)),o&&o.classList.toggle("hidden",g!=="prognostic")}function rt(){let t=document.getElementById("accountOrbMatrixPanel"),e=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(o=>{let n=o.dataset.orbViewMode===L;o.classList.toggle("is-active",n),o.setAttribute("aria-selected",n?"true":"false")}),t?.classList.toggle("is-compact",L==="compact"),e?.classList.toggle("is-compact",L==="compact")}function U(){let t=D(),e=P(g);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let n=o.dataset.orbAspectType,a=o.dataset.orbBody;!n||!a||(e[n]||(e[n]={}),e[n][a]=Number.parseFloat(o.value)||0)}),t.orbs.profiles[g]={matrix:e}}function ft(t,{rerender:e=!0}={}){J.includes(t)&&(f&&U(),g=t,ct(),e&&f&&Y(f.methodology))}function bt(t){["default","compact"].includes(t)&&(L=t,localStorage.setItem(X,t),rt())}function ht(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=_().map(o=>{let n=o.aspect_type,a=r(W(n)),c=r(I(n)),s=z.map(i=>{let p=t?.[i]?.aspects?.enabled_types||[],E=new Set(Array.isArray(p)&&p.length?p:Q).has(n)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${i}"
                                data-aspect-type="${n}"
                                ${E}
                                aria-label="${r(`${B(`page.accountSettings.tables.columns.${i}`,i)}: ${c}`)}"
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
            `}).join(""))}function St(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=ut().map(o=>{let n=r(m(o)),a=N(o,{size:18,title:m(o)}),c=z.map(s=>{let i=ot(t?.[s]?.matrix?.rows||{}),p=i?.[o]?.display!==!1?"checked":"",l=i?.[o]?.aspecting!==!1?"checked":"";return`
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
                                ${l}
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
            `}).join(""))}function Y(t={}){let e=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!e||!o)return;let n=F(),a=_(),s=S(t||A())?.orbs?.profiles?.[g]?.matrix||P(g);e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${n.map(i=>{let p=r(m(i)),l=N(i,{size:18,title:m(i)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${p}" aria-label="${p}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=a.map(i=>{let p=i.aspect_type,l=r(W(p)),E=r(I(p));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${E}" aria-label="${E}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${n.map(d=>{let u=s?.[p]?.[d],b=r(m(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(i.base_orb||5)}"
                                    aria-label="${r(`${E} · ${b}`)}"
                                    data-orb-aspect-type="${p}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),ct(),rt()}function wt(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!o)return;let n=t?.balances||{},a=n?.planet_weights||{},c=n?.special_point_weights||{},i=F().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),p=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=i.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(l))}" aria-label="${r(m(l))}" role="img" tabindex="0">
                                ${N(l,{size:18,title:m(l)})}
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
                        value="${Number(a?.[l]??1).toFixed(1)}"
                        data-balance-planet="${l}"
                        aria-label="${r(m(l))}"
                    >
                </td>
            </tr>
        `).join(""),o.innerHTML=p.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(l))}" aria-label="${r(m(l))}" role="img" tabindex="0">
                                ${N(l,{size:18,title:m(l)})}
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
                        value="${Number(c?.[l]??0).toFixed(1)}"
                        data-balance-special-point="${l}"
                        aria-label="${r(m(l))}"
                    >
                </td>
            </tr>
        `).join("")}function At(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let o=$(t);e.innerHTML=_().map(n=>{let a=n.aspect_type,c=n.character||mt(a),s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,o,c):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(I(a))}" aria-label="${r(I(a))}" role="img" tabindex="0">
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
                            aria-label="${r(I(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Et(t={}){let e=document.getElementById("accountAspectHarmonyColorsBody");if(!e)return;let n=$(t)?.aspect_harmony_colors||{},a=["harmonious","tense","neutral"];e.innerHTML=a.map(c=>`
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
        `).join("")}function Bt(t={}){let e=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!e||!o)return;let n=$(t),a=n?.planet_colors?.element_palette||{},c=n?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(a).map(s=>`
            <tr>
                <th scope="row">${r(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[s])}" data-element-color="${s}" aria-label="${r(s)}"></td>
            </tr>
        `).join(""),o.innerHTML=F().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(s))}" aria-label="${r(m(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(et(s))}</span>
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
        `).join("")}function V(t){let e={...nt(),...t||{},chart_defaults:{natal:v(t?.chart_defaults?.natal||{}),biwheel:v(t?.chart_defaults?.biwheel||{}),solar:v(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:S(t?.methodology||A()),visual:$(t?.visual||at())};f=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),J.includes(g)||(g="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=e.chart_creation_defaults.house_system||"P");let n=document.getElementById("accountOrbPairStrategySelect");n&&(n.value=e.methodology?.orbs?.pair_strategy||k);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(e.methodology?.stationary?.threshold_percent??5)),z.forEach(c=>{let s=e.chart_defaults[c],i=st(c);i.orientation&&(i.orientation.value=s.view_options?.orientation==="asc"?"asc":"aries"),i.aspectScope&&(i.aspectScope.value=s.aspects?.scope||(c==="biwheel"?"major":"all")),i.showApplyingSeparating&&(i.showApplyingSeparating.checked=s.aspects?.show_applying_separating===!0),i.showSpeed&&(i.showSpeed.checked=s.table_options?.show_speed!==!1),i.showStationary&&(i.showStationary.checked=s.table_options?.show_stationary!==!1)}),ht(e.chart_defaults),St(e.chart_defaults),Y(e.methodology),wt(e.methodology),Et(e.visual),At(e.visual),Bt(e.visual)}function vt(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&e.push(o.dataset.aspectType)}),e.length?e:_().map(o=>o.aspect_type)}function $t(t){let e=ot({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let n=o.dataset.matrixBody,a=o.dataset.matrixField;!n||!a||(e[n]={...e[n]||{display:!0,aspecting:!0},[a]:o.checked})}),e}function G(t){let e=st(t);return{matrix:{rows:$t(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:vt(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function _t(){U();let e=(S(f?.methodology||A())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(o[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let n={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(n[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),S({orbs:{version:2,pair_strategy:yt(),profiles:e},balances:{version:1,planet_weights:o,special_point_weights:n},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")}})}function Pt(){let t={};document.querySelectorAll("[data-aspect-harmony-color]").forEach(a=>{a.dataset.aspectHarmonyColor&&a.value&&(t[a.dataset.aspectHarmonyColor]=a.value)});let e={};document.querySelectorAll("[data-aspect-color]").forEach(a=>{a.dataset.aspectColor&&a.value&&(e[a.dataset.aspectColor]=a.value)});let o={};document.querySelectorAll("[data-element-color]").forEach(a=>{a.dataset.elementColor&&a.value&&(o[a.dataset.elementColor]=a.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(a=>{let c=a.dataset.bodyColorOverride,s=String(a.value||"").trim();c&&s&&a.dataset.bodyColorActive!=="false"&&(n[c]=s)}),$({aspect_harmony_colors:t,aspect_colors:e,planet_colors:{element_palette:o,body_overrides:n}})}function Mt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:G("natal"),biwheel:G("biwheel"),solar:G("solar")},methodology:_t(),visual:Pt()}}function h(t,e="info"){let o=document.getElementById("accountSettingsToast");!o||!t||(o.textContent=t,o.className=`toast ${e}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(Z),Z=setTimeout(()=>{o.classList.remove("visible")},2800))}function it(){let t=document.querySelector(".account-settings-header");if(t instanceof HTMLElement){t.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function j(t,{final:e=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!t){o.classList.add("hidden"),o.textContent="";return}let n=Number(t.progress_total||0),a=Number(t.progress_done||0),c=n>0?Math.min(100,Math.round(a/n*100)):0,i=`${String(t.status||"pending").toUpperCase()} · ${a}/${n||"0"} · ${c}%`,p=Number(t.failed_count||0),l=p?` · failures: ${p}`:"";o.textContent=e?`${i}${l}`:`${i}${l}`,o.classList.remove("hidden"),o.dataset.status=String(t.status||"pending")}function K(){x&&(clearTimeout(x),x=null)}async function lt(t){if(K(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(R,String(t));let e=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(t);if(j(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(R),h(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),K();return}if(o.status==="failed"){sessionStorage.removeItem(R),h(o.error||"Methodology recalculation failed.","error"),K();return}x=setTimeout(e,2500)}catch(o){x=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await e()}async function Ct(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?y("page.accountSettings.subtitleWithEmail",{email:t.email}):y("page.accountSettings.subtitle"));let[o,n]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);C=o||null,V(n);let a=sessionStorage.getItem(R);a?lt(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):j(null),tt()}async function xt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=Mt(),o=!dt(S(f?.methodology||{}),e.methodology),n=await window.AstroAPI.patchAccountPreferences(e);if(V(n),o&&window.AstroAPI?.createPreferenceRecalcJob){let a=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});j(a),lt(a.job_id).catch(c=>{console.warn("Failed to poll methodology recalculation job:",c)}),h("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(it);return}h(y("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(it)}catch(e){h(e.message||y("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function Lt(){V(nt()),j(null),h(y("page.accountSettings.toasts.restored"),"info")}function T({restoreFocus:t=!0}={}){let e=document.getElementById("accountSettingsResetConfirmDialog"),o=document.getElementById("accountSettingsResetConfirmBackdrop");e&&e.classList.add("hidden"),o&&o.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),t&&H instanceof HTMLElement&&H.focus(),H=null}function It(){let t=document.getElementById("accountSettingsResetConfirmDialog"),e=document.getElementById("accountSettingsResetConfirmBackdrop"),o=document.getElementById("accountSettingsResetConfirmSubmit");!t||!e||(H=document.activeElement instanceof HTMLElement?document.activeElement:null,e.classList.remove("hidden"),t.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{o?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{L=localStorage.getItem(X)==="compact"?"compact":"default";let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),n=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountAspectHarmonyColorsBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),i=document.getElementById("accountSettingsResetConfirmBackdrop"),p=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),E=document.getElementById("accountSettingsResetConfirmSubmit");t?.addEventListener("click",()=>{xt()}),e?.addEventListener("click",()=>{It()}),i?.addEventListener("click",()=>{T()}),p?.addEventListener("click",()=>{T()}),l?.addEventListener("click",()=>{T()}),E?.addEventListener("click",()=>{T({restoreFocus:!1}),Lt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{ft(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{bt(d.dataset.orbViewMode||"default")})}),o?.addEventListener("click",()=>{U();let d=D();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(gt("natal")))},g="prognostic",Y(d),h(y("page.accountSettings.toasts.orbsCopied"),"info")}),n?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.orbAspectType||!u.dataset.orbBody)return;let b=D(),w=(b.orbs.profiles[g]||{matrix:P(g)}).matrix||P(g);w[u.dataset.orbAspectType]||(w[u.dataset.orbAspectType]={}),w[u.dataset.orbAspectType][u.dataset.orbBody]=Number.parseFloat(u.value)||0,b.orbs.profiles[g]={matrix:w}}),a?.addEventListener("click",d=>{let u=d.target.closest("[data-apply-aspect-harmony-color]");if(!(u instanceof HTMLElement))return;let b=u.dataset.applyAspectHarmonyColor;if(!b)return;let M=a.querySelector(`[data-aspect-harmony-color="${b}"]`);M instanceof HTMLInputElement&&(document.querySelectorAll("[data-aspect-color]").forEach(w=>{w instanceof HTMLInputElement&&w.dataset.aspectCharacter===b&&(w.value=M.value)}),h(y("page.accountSettings.toasts.aspectHarmonyApplied",{type:q(b)}),"info"))}),c?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.bodyColorOverride)return;u.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${u.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let u=d.target.closest("[data-clear-body-color-override]");if(!(u instanceof HTMLElement))return;let b=u.dataset.clearBodyColorOverride;if(!b)return;let M=c.querySelector(`[data-body-color-override="${b}"]`);M instanceof HTMLInputElement&&(M.dataset.bodyColorActive="false",u.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ct(),document.addEventListener("frontend:locale-changed",()=>{f&&V(f)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||T())})}catch(d){h(d.message||y("page.accountSettings.toasts.loadFailed"),"error"),tt()}})})();
