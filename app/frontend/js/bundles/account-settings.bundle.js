import{a as Mt}from"./chunks/chunk-2YZIQGJC.js";import"./chunks/chunk-2MGLT2CN.js";import"./chunks/chunk-Z53PUKAW.js";import{b as M,d as xt,e as Lt,f as Tt,g as It}from"./chunks/chunk-SJPKDO3M.js";var Ot=M(xt()),kt=M(Lt()),Nt=M(Tt());var Ht=M(It()),Ft=M(Mt());(function(){"use strict";let V=["natal","biwheel","solar"],K=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ct={Sesquiquadrate:"⚼",Vigintile:"V",Semi_Nonagon:"SN",Decile:"D",Nonagon:"N",Binonagon:"BN",Sentagon:"SG",Tridecile:"TD",Septile:"7",Novile:"9"},j=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],O=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",k="activePreferenceRecalcJobId",y=null,x=null,Q=null,L=null,m="natal",N=null;function X(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function g(t,e){return window.FrontendI18n?.t?.(t,e)||t}function c(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function E(t,e=""){let o=g(t);return o&&o!==t?o:e}function f(t){return E(`astro.planet.${t}`,t)}function J(t){return window.Symbols?.planets?.[t]||String(t||"").slice(0,2)||"•"}function T(t){return E(`astro.aspect.${t}`,t)}function z(t){return window.Symbols?.aspects?.[t]||ct[t]||String(t||"").slice(0,2)||"•"}function R(t){return E({harmonious:"page.chart.legend.harmonious",tense:"page.chart.legend.tense",neutral:"page.chart.legend.neutral"}[t],t)}function rt(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function v(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function S(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function $(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function Z(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function it(){return window.AstroPreferences?.MATRIX_BODIES||[]}function _(){return x?.aspect_types||K.map(t=>({aspect_type:t}))}function lt(t){return _().find(e=>e?.aspect_type===t)||null}function dt(t){return lt(t)?.character||window.AstroPreferences?.getAspectHarmonyType?.(t)||"neutral"}function H(){return(x?.bodies||[]).map(t=>t?.name).filter(Boolean)}function P(t="natal"){let e=_(),o=H();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(e,o,t):Object.fromEntries(e.map(a=>[a.aspect_type,Object.fromEntries(o.map(n=>[n,t==="prognostic"?n==="Moon"?3:1:Number(a.base_orb||5)]))]))}function A(){let t={version:2,pair_strategy:O,profiles:Object.fromEntries(j.map(e=>[e,{matrix:P(e)}]))};return S({orbs:t,balances:x?.default_balance_targets||{}})}function tt(){return $(x?.default_visual_palettes||{})}function et(){return{chart_defaults:{natal:v({}),biwheel:v({aspects:{scope:"major"}}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:A(),visual:tt()}}function ot(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function F(){return y||(y={methodology:A()}),y.methodology=S(y.methodology||A()),y.methodology}function ut(t){return F()?.orbs?.profiles?.[t]?.matrix||P(t)}function pt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||O:S(y?.methodology||A())?.orbs?.pair_strategy||O}function nt(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(a=>{let n=a.dataset.orbProfileTab===m;a.classList.toggle("is-active",n),a.setAttribute("aria-selected",n?"true":"false"),e&&n&&a.id&&e.setAttribute("aria-labelledby",a.id)}),t&&(t.textContent=g(`page.accountSettings.orbs.hints.${m}`)),o&&o.classList.toggle("hidden",m!=="prognostic")}function W(){let t=F(),e=P(m);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let a=o.dataset.orbAspectType,n=o.dataset.orbBody;!a||!n||(e[a]||(e[a]={}),e[a][n]=Number.parseFloat(o.value)||0)}),t.orbs.profiles[m]={matrix:e}}function mt(t,{rerender:e=!0}={}){j.includes(t)&&(y&&W(),m=t,nt(),e&&y&&U(y.methodology))}function gt(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=_().map(o=>{let a=o.aspect_type,n=c(z(a)),r=c(T(a)),s=V.map(i=>{let p=t?.[i]?.aspects?.enabled_types||[],B=new Set(Array.isArray(p)&&p.length?p:K).has(a)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${i}"
                                data-aspect-type="${a}"
                                ${B}
                                aria-label="${c(`${E(`page.accountSettings.tables.columns.${i}`,i)}: ${r}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${r}" aria-label="${r}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${n}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function yt(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=it().map(o=>{let a=c(f(o)),n=c(window.Symbols?.planets?.[o]||""),r=V.map(s=>{let i=Z(t?.[s]?.matrix?.rows||{}),p=i?.[o]?.display!==!1?"checked":"",l=i?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${p}
                                aria-label="${c(`${E(`page.accountSettings.tables.columns.${s}`,s)}: ${a} ${g("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${c(`${E(`page.accountSettings.tables.columns.${s}`,s)}: ${a} ${g("page.accountSettings.matrix.columns.aspecting")}`)}"
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
                    ${r}
                </tr>
            `}).join(""))}function U(t={}){let e=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!e||!o)return;let a=H(),n=_(),s=S(t||A())?.orbs?.profiles?.[m]?.matrix||P(m);e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${a.map(i=>{let p=c(f(i)),l=c(window.Symbols?.planets?.[i]||i);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${p}" aria-label="${p}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=n.map(i=>{let p=i.aspect_type,l=c(z(p)),B=c(T(p));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${B}" aria-label="${B}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${a.map(u=>{let d=s?.[p]?.[u],b=c(f(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(d))?Number(d):Number(i.base_orb||5)}"
                                    aria-label="${c(`${B} · ${b}`)}"
                                    data-orb-aspect-type="${p}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${m}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),nt()}function ft(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!o)return;let a=t?.balances||{},n=a?.planet_weights||{},r=a?.special_point_weights||{},i=H().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),p=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=i.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(f(l))}" aria-label="${c(f(l))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${c(J(l))}</span>
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
                        value="${Number(n?.[l]??1).toFixed(1)}"
                        data-balance-planet="${l}"
                        aria-label="${c(f(l))}"
                    >
                </td>
            </tr>
        `).join(""),o.innerHTML=p.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(f(l))}" aria-label="${c(f(l))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${c(J(l))}</span>
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
                        value="${Number(r?.[l]??0).toFixed(1)}"
                        data-balance-special-point="${l}"
                        aria-label="${c(f(l))}"
                    >
                </td>
            </tr>
        `).join("")}function bt(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let o=$(t);e.innerHTML=_().map(a=>{let n=a.aspect_type,r=a.character||dt(n),s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(n,o,r):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${c(T(n))}" aria-label="${c(T(n))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${c(z(n))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${c(s)}"
                            data-aspect-color="${n}"
                            data-aspect-character="${c(r)}"
                            aria-label="${c(T(n))}"
                        >
                    </td>
                </tr>
            `}).join("")}function ht(t={}){let e=document.getElementById("accountAspectHarmonyColorsBody");if(!e)return;let a=$(t)?.aspect_harmony_colors||{},n=["harmonious","tense","neutral"];e.innerHTML=n.map(r=>`
            <tr>
                <th scope="row">${c(R(r))}</th>
                <td>
                    <input
                        type="color"
                        class="account-settings-color-input account-settings-swatch-input"
                        value="${c(a[r]||"#9ca3af")}"
                        data-aspect-harmony-color="${r}"
                        aria-label="${c(R(r))}"
                    >
                </td>
                <td>
                    <button
                        type="button"
                        class="account-settings-reset-chip"
                        data-apply-aspect-harmony-color="${r}"
                        title="${c(g("page.accountSettings.visual.actions.applyMatching"))}"
                        aria-label="${c(`${g("page.accountSettings.visual.actions.applyMatching")}: ${R(r)}`)}"
                    >⇢</button>
                </td>
            </tr>
        `).join("")}function St(t={}){let e=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!e||!o)return;let a=$(t),n=a?.planet_colors?.element_palette||{},r=a?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(n).map(s=>`
            <tr>
                <th scope="row">${c(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${c(n[s])}" data-element-color="${s}" aria-label="${c(s)}"></td>
            </tr>
        `).join(""),o.innerHTML=H().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(f(s))}" aria-label="${c(f(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${c(J(s))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${c(r?.[s]||"#c7b49a")}"
                            data-body-color-override="${s}"
                            data-body-color-active="${r?.[s]?"true":"false"}"
                            aria-label="${c(f(s))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${r?.[s]?"":" is-muted"}"
                            data-clear-body-color-override="${s}"
                            title="${c(g("common.reset"))}"
                            aria-label="${c(`${g("common.reset")}: ${f(s)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function q(t){let e={...et(),...t||{},chart_defaults:{natal:v(t?.chart_defaults?.natal||{}),biwheel:v(t?.chart_defaults?.biwheel||{}),solar:v(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:S(t?.methodology||A()),visual:$(t?.visual||tt())};y=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),j.includes(m)||(m="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=e.chart_creation_defaults.house_system||"P");let a=document.getElementById("accountOrbPairStrategySelect");a&&(a.value=e.methodology?.orbs?.pair_strategy||O);let n=document.getElementById("accountStationaryThresholdPercent");n&&(n.value=String(e.methodology?.stationary?.threshold_percent??5)),V.forEach(r=>{let s=e.chart_defaults[r],i=ot(r);i.orientation&&(i.orientation.value=s.view_options?.orientation==="asc"?"asc":"aries"),i.aspectScope&&(i.aspectScope.value=s.aspects?.scope||(r==="biwheel"?"major":"all")),i.showApplyingSeparating&&(i.showApplyingSeparating.checked=s.aspects?.show_applying_separating===!0),i.showSpeed&&(i.showSpeed.checked=s.table_options?.show_speed!==!1),i.showStationary&&(i.showStationary.checked=s.table_options?.show_stationary!==!1)}),gt(e.chart_defaults),yt(e.chart_defaults),U(e.methodology),ft(e.methodology),ht(e.visual),bt(e.visual),St(e.visual)}function wt(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&e.push(o.dataset.aspectType)}),e.length?e:_().map(o=>o.aspect_type)}function At(t){let e=Z({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let a=o.dataset.matrixBody,n=o.dataset.matrixField;!a||!n||(e[a]={...e[a]||{display:!0,aspecting:!0},[n]:o.checked})}),e}function Y(t){let e=ot(t);return{matrix:{rows:At(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:wt(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function Bt(){W();let e=(S(y?.methodology||A())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(n=>{n.dataset.balancePlanet&&(o[n.dataset.balancePlanet]=Number.parseFloat(n.value)||0)});let a={};return document.querySelectorAll("[data-balance-special-point]").forEach(n=>{n.dataset.balanceSpecialPoint&&(a[n.dataset.balanceSpecialPoint]=Number.parseFloat(n.value)||0)}),S({orbs:{version:2,pair_strategy:pt(),profiles:e},balances:{version:1,planet_weights:o,special_point_weights:a},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")}})}function Et(){let t={};document.querySelectorAll("[data-aspect-harmony-color]").forEach(n=>{n.dataset.aspectHarmonyColor&&n.value&&(t[n.dataset.aspectHarmonyColor]=n.value)});let e={};document.querySelectorAll("[data-aspect-color]").forEach(n=>{n.dataset.aspectColor&&n.value&&(e[n.dataset.aspectColor]=n.value)});let o={};document.querySelectorAll("[data-element-color]").forEach(n=>{n.dataset.elementColor&&n.value&&(o[n.dataset.elementColor]=n.value)});let a={};return document.querySelectorAll("[data-body-color-override]").forEach(n=>{let r=n.dataset.bodyColorOverride,s=String(n.value||"").trim();r&&s&&n.dataset.bodyColorActive!=="false"&&(a[r]=s)}),$({aspect_harmony_colors:t,aspect_colors:e,planet_colors:{element_palette:o,body_overrides:a}})}function vt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:Y("natal"),biwheel:Y("biwheel"),solar:Y("solar")},methodology:Bt(),visual:Et()}}function h(t,e="info"){let o=document.getElementById("accountSettingsToast");!o||!t||(o.textContent=t,o.className=`toast ${e}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(Q),Q=setTimeout(()=>{o.classList.remove("visible")},2800))}function at(){let t=document.querySelector(".account-settings-header");if(t instanceof HTMLElement){t.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function D(t,{final:e=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!t){o.classList.add("hidden"),o.textContent="";return}let a=Number(t.progress_total||0),n=Number(t.progress_done||0),r=a>0?Math.min(100,Math.round(n/a*100)):0,i=`${String(t.status||"pending").toUpperCase()} · ${n}/${a||"0"} · ${r}%`,p=Number(t.failed_count||0),l=p?` · failures: ${p}`:"";o.textContent=e?`${i}${l}`:`${i}${l}`,o.classList.remove("hidden"),o.dataset.status=String(t.status||"pending")}function G(){L&&(clearTimeout(L),L=null)}async function st(t){if(G(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(k,String(t));let e=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(t);if(D(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(k),h(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),G();return}if(o.status==="failed"){sessionStorage.removeItem(k),h(o.error||"Methodology recalculation failed.","error"),G();return}L=setTimeout(e,2500)}catch(o){L=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await e()}async function $t(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?g("page.accountSettings.subtitleWithEmail",{email:t.email}):g("page.accountSettings.subtitle"));let[o,a]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);x=o||null,q(a);let n=sessionStorage.getItem(k);n?st(n).catch(r=>{console.warn("Failed to resume recalculation job polling:",r)}):D(null),X()}async function _t(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=vt(),o=!rt(S(y?.methodology||{}),e.methodology),a=await window.AstroAPI.patchAccountPreferences(e);if(q(a),o&&window.AstroAPI?.createPreferenceRecalcJob){let n=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});D(n),st(n.job_id).catch(r=>{console.warn("Failed to poll methodology recalculation job:",r)}),h("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(at);return}h(g("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(at)}catch(e){h(e.message||g("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function Pt(){q(et()),D(null),h(g("page.accountSettings.toasts.restored"),"info")}function I({restoreFocus:t=!0}={}){let e=document.getElementById("accountSettingsResetConfirmDialog"),o=document.getElementById("accountSettingsResetConfirmBackdrop");e&&e.classList.add("hidden"),o&&o.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),t&&N instanceof HTMLElement&&N.focus(),N=null}function Ct(){let t=document.getElementById("accountSettingsResetConfirmDialog"),e=document.getElementById("accountSettingsResetConfirmBackdrop"),o=document.getElementById("accountSettingsResetConfirmSubmit");!t||!e||(N=document.activeElement instanceof HTMLElement?document.activeElement:null,e.classList.remove("hidden"),t.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{o?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),a=document.getElementById("accountOrbsMatrixBody"),n=document.getElementById("accountAspectHarmonyColorsBody"),r=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),i=document.getElementById("accountSettingsResetConfirmBackdrop"),p=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),B=document.getElementById("accountSettingsResetConfirmSubmit");t?.addEventListener("click",()=>{_t()}),e?.addEventListener("click",()=>{Ct()}),i?.addEventListener("click",()=>{I()}),p?.addEventListener("click",()=>{I()}),l?.addEventListener("click",()=>{I()}),B?.addEventListener("click",()=>{I({restoreFocus:!1}),Pt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{mt(u.dataset.orbProfileTab||"natal")})}),o?.addEventListener("click",()=>{W();let u=F();u.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(ut("natal")))},m="prognostic",U(u),h(g("page.accountSettings.toasts.orbsCopied"),"info")}),a?.addEventListener("input",u=>{let d=u.target;if(!(d instanceof HTMLInputElement)||!d.dataset.orbAspectType||!d.dataset.orbBody)return;let b=F(),w=(b.orbs.profiles[m]||{matrix:P(m)}).matrix||P(m);w[d.dataset.orbAspectType]||(w[d.dataset.orbAspectType]={}),w[d.dataset.orbAspectType][d.dataset.orbBody]=Number.parseFloat(d.value)||0,b.orbs.profiles[m]={matrix:w}}),n?.addEventListener("click",u=>{let d=u.target.closest("[data-apply-aspect-harmony-color]");if(!(d instanceof HTMLElement))return;let b=d.dataset.applyAspectHarmonyColor;if(!b)return;let C=n.querySelector(`[data-aspect-harmony-color="${b}"]`);C instanceof HTMLInputElement&&(document.querySelectorAll("[data-aspect-color]").forEach(w=>{w instanceof HTMLInputElement&&w.dataset.aspectCharacter===b&&(w.value=C.value)}),h(g("page.accountSettings.toasts.aspectHarmonyApplied",{type:R(b)}),"info"))}),r?.addEventListener("input",u=>{let d=u.target;if(!(d instanceof HTMLInputElement)||!d.dataset.bodyColorOverride)return;d.dataset.bodyColorActive="true",r.querySelector(`[data-clear-body-color-override="${d.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),r?.addEventListener("click",u=>{let d=u.target.closest("[data-clear-body-color-override]");if(!(d instanceof HTMLElement))return;let b=d.dataset.clearBodyColorOverride;if(!b)return;let C=r.querySelector(`[data-body-color-override="${b}"]`);C instanceof HTMLInputElement&&(C.dataset.bodyColorActive="false",d.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await $t(),document.addEventListener("frontend:locale-changed",()=>{y&&q(y)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!s||s.classList.contains("hidden")||I())})}catch(u){h(u.message||g("page.accountSettings.toasts.loadFailed"),"error"),X()}})})();
