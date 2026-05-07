import{a as Le}from"./chunks/chunk-5AMIQYHF.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as L,d as xe,e as Te,f as Me,g as Ie}from"./chunks/chunk-E24Q6PJF.js";var Ce=L(xe()),ke=L(Te()),Re=L(Me());var Fe=L(Ie()),De=L(Le());(function(){"use strict";let H=["natal","biwheel","solar"],G=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],j=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],O=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",C="activePreferenceRecalcJobId",K="accountOrbViewMode",y=null,_=null,Q=null,v=null,g="natal",$="default",k=null;function X(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function f(e,t){return window.FrontendI18n?.t?.(e,t)||e}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function P(e,t=""){let o=f(e);return o&&o!==e?o:t}function m(e){return P(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function Z(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function R(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${r(Z(e))}</span>`}function x(e){return P(`astro.aspect.${e}`,e)}function z(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function ie(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function A(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function h(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function T(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function ee(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function le(){return window.AstroPreferences?.MATRIX_BODIES||[]}function B(){return _?.aspect_types||G.map(e=>({aspect_type:e}))}function Oe(e){return B().find(t=>t?.aspect_type===e)||null}function N(){return(_?.bodies||[]).map(e=>e?.name).filter(Boolean)}function E(e="natal"){let t=B(),o=N();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,o,e):Object.fromEntries(t.map(n=>[n.aspect_type,Object.fromEntries(o.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(n.base_orb||5)]))]))}function w(){let e={version:2,pair_strategy:O,profiles:Object.fromEntries(j.map(t=>[t,{matrix:E(t)}]))};return h({orbs:e,balances:_?.default_balance_targets||{}})}function te(){return T(_?.default_visual_palettes||{})}function oe(){return{chart_defaults:{natal:A({}),biwheel:A({aspects:{scope:"major"}}),solar:A({})},chart_creation_defaults:{house_system:"P"},methodology:w(),visual:te()}}function ne(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function F(){return y||(y={methodology:w()}),y.methodology=h(y.methodology||w()),y.methodology}function de(e){return F()?.orbs?.profiles?.[e]?.matrix||E(e)}function ue(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||O:h(y?.methodology||w())?.orbs?.pair_strategy||O}function ae(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{let a=n.dataset.orbProfileTab===g;n.classList.toggle("is-active",a),n.setAttribute("aria-selected",a?"true":"false"),t&&a&&n.id&&t.setAttribute("aria-labelledby",n.id)}),e&&(e.textContent=f(`page.accountSettings.orbs.hints.${g}`)),o&&o.classList.toggle("hidden",g!=="prognostic")}function se(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(o=>{let n=o.dataset.orbViewMode===$;o.classList.toggle("is-active",n),o.setAttribute("aria-selected",n?"true":"false")}),e?.classList.toggle("is-compact",$==="compact"),t?.classList.toggle("is-compact",$==="compact")}function J(){let e=F(),t=E(g);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let n=o.dataset.orbAspectType,a=o.dataset.orbBody;!n||!a||(t[n]||(t[n]={}),t[n][a]=Number.parseFloat(o.value)||0)}),e.orbs.profiles[g]={matrix:t}}function pe(e,{rerender:t=!0}={}){j.includes(e)&&(y&&J(),g=e,ae(),t&&y&&W(y.methodology))}function me(e){["default","compact"].includes(e)&&($=e,localStorage.setItem(K,e),se())}function ge(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=B().map(o=>{let n=o.aspect_type,a=r(z(n)),i=r(x(n)),s=H.map(c=>{let p=e?.[c]?.aspects?.enabled_types||[],d=new Set(Array.isArray(p)&&p.length?p:G).has(n)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-aspect-type="${n}"
                                ${d}
                                aria-label="${r(`${P(`page.accountSettings.tables.columns.${c}`,c)}: ${i}`)}"
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
                    ${s}
                </tr>
            `}).join(""))}function ye(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=le().map(o=>{let n=r(m(o)),a=R(o,{size:18,title:m(o)}),i=H.map(s=>{let c=ee(e?.[s]?.matrix?.rows||{}),p=c?.[o]?.display!==!1?"checked":"",l=c?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${p}
                                aria-label="${r(`${P(`page.accountSettings.tables.columns.${s}`,s)}: ${n} ${f("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${r(`${P(`page.accountSettings.tables.columns.${s}`,s)}: ${n} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
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
                    ${i}
                </tr>
            `}).join(""))}function W(e={}){let t=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!t||!o)return;let n=N(),a=B(),s=h(e||w())?.orbs?.profiles?.[g]?.matrix||E(g);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${n.map(c=>{let p=r(m(c)),l=R(c,{size:18,title:m(c)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${p}" aria-label="${p}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=a.map(c=>{let p=c.aspect_type,l=r(z(p)),d=r(x(p));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${n.map(u=>{let b=s?.[p]?.[u],I=r(m(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(b))?Number(b):Number(c.base_orb||5)}"
                                    aria-label="${r(`${d} · ${I}`)}"
                                    data-orb-aspect-type="${p}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),ae(),se()}function fe(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!o)return;let n=e?.balances||{},a=n?.planet_weights||{},i=n?.special_point_weights||{},c=N().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),p=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=c.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(l))}" aria-label="${r(m(l))}" role="img" tabindex="0">
                                ${R(l,{size:18,title:m(l)})}
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
                                ${R(l,{size:18,title:m(l)})}
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
                        value="${Number(i?.[l]??0).toFixed(1)}"
                        data-balance-special-point="${l}"
                        aria-label="${r(m(l))}"
                    >
                </td>
            </tr>
        `).join("")}function be(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let o=T(e);t.innerHTML=B().map(n=>{let a=n.aspect_type,i=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,o):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(x(a))}" aria-label="${r(x(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(z(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(i)}"
                            data-aspect-color="${a}"
                            aria-label="${r(x(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function he(e={}){let t=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!t||!o)return;let n=T(e),a=n?.planet_colors?.element_palette||{},i=n?.planet_colors?.body_overrides||{};t.innerHTML=Object.keys(a).map(s=>`
            <tr>
                <th scope="row">${r(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[s])}" data-element-color="${s}" aria-label="${r(s)}"></td>
            </tr>
        `).join(""),o.innerHTML=N().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(s))}" aria-label="${r(m(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(Z(s))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(i?.[s]||"#c7b49a")}"
                            data-body-color-override="${s}"
                            data-body-color-active="${i?.[s]?"true":"false"}"
                            aria-label="${r(m(s))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${i?.[s]?"":" is-muted"}"
                            data-clear-body-color-override="${s}"
                            title="${r(f("common.reset"))}"
                            aria-label="${r(`${f("common.reset")}: ${m(s)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function D(e){let t={...oe(),...e||{},chart_defaults:{natal:A(e?.chart_defaults?.natal||{}),biwheel:A(e?.chart_defaults?.biwheel||{}),solar:A(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:h(e?.methodology||w()),visual:T(e?.visual||te())};y=t,window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),j.includes(g)||(g="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let n=document.getElementById("accountOrbPairStrategySelect");n&&(n.value=t.methodology?.orbs?.pair_strategy||O);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(t.methodology?.stationary?.threshold_percent??5)),H.forEach(i=>{let s=t.chart_defaults[i],c=ne(i);c.orientation&&(c.orientation.value=s.view_options?.orientation==="asc"?"asc":"aries"),c.aspectScope&&(c.aspectScope.value=s.aspects?.scope||(i==="biwheel"?"major":"all")),c.showApplyingSeparating&&(c.showApplyingSeparating.checked=s.aspects?.show_applying_separating===!0),c.showSpeed&&(c.showSpeed.checked=s.table_options?.show_speed!==!1),c.showStationary&&(c.showStationary.checked=s.table_options?.show_stationary!==!1),c.showAspectText&&(c.showAspectText.checked=s.table_options?.show_aspect_text===!0)}),ge(t.chart_defaults),ye(t.chart_defaults),W(t.methodology),fe(t.methodology),be(t.visual),he(t.visual)}function Se(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&t.push(o.dataset.aspectType)}),t.length?t:B().map(o=>o.aspect_type)}function we(e){let t=ee({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let n=o.dataset.matrixBody,a=o.dataset.matrixField;!n||!a||(t[n]={...t[n]||{display:!0,aspecting:!0},[a]:o.checked})}),t}function U(e){let t=ne(e);return{matrix:{rows:we(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:Se(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function Ae(){J();let t=(h(y?.methodology||w())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(o[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let n={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(n[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),h({orbs:{version:2,pair_strategy:ue(),profiles:t},balances:{version:1,planet_weights:o,special_point_weights:n},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")}})}function Be(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(n=>{n.dataset.aspectColor&&n.value&&(e[n.dataset.aspectColor]=n.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(n=>{n.dataset.elementColor&&n.value&&(t[n.dataset.elementColor]=n.value)});let o={};return document.querySelectorAll("[data-body-color-override]").forEach(n=>{let a=n.dataset.bodyColorOverride,i=String(n.value||"").trim();a&&i&&n.dataset.bodyColorActive!=="false"&&(o[a]=i)}),T({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:o}})}function Ee(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:U("natal"),biwheel:U("biwheel"),solar:U("solar")},methodology:Ae(),visual:Be()}}function S(e,t="info"){let o=document.getElementById("accountSettingsToast");!o||!e||(o.textContent=e,o.className=`toast ${t}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(Q),Q=setTimeout(()=>{o.classList.remove("visible")},2800))}function ce(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function q(e,{final:t=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!e){o.classList.add("hidden"),o.textContent="";return}let n=Number(e.progress_total||0),a=Number(e.progress_done||0),i=n>0?Math.min(100,Math.round(a/n*100)):0,c=`${String(e.status||"pending").toUpperCase()} · ${a}/${n||"0"} · ${i}%`,p=Number(e.failed_count||0),l=p?` · failures: ${p}`:"";o.textContent=t?`${c}${l}`:`${c}${l}`,o.classList.remove("hidden"),o.dataset.status=String(e.status||"pending")}function Y(){v&&(clearTimeout(v),v=null)}async function re(e){if(Y(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(C,String(e));let t=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(e);if(q(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(C),S(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),Y();return}if(o.status==="failed"){sessionStorage.removeItem(C),S(o.error||"Methodology recalculation failed.","error"),Y();return}v=setTimeout(t,2500)}catch(o){v=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await t()}async function _e(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?f("page.accountSettings.subtitleWithEmail",{email:e.email}):f("page.accountSettings.subtitle"));let[o,n]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);_=o||null,D(n);let a=sessionStorage.getItem(C);a?re(a).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):q(null),X()}async function ve(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=Ee(),o=!ie(h(y?.methodology||{}),t.methodology),n=await window.AstroAPI.patchAccountPreferences(t);if(D(n),o&&window.AstroAPI?.createPreferenceRecalcJob){let a=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});q(a),re(a.job_id).catch(i=>{console.warn("Failed to poll methodology recalculation job:",i)}),S("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(ce);return}S(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(ce)}catch(t){S(t.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function $e(){D(oe()),q(null),S(f("page.accountSettings.toasts.restored"),"info")}function M({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),o=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),o&&o.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&k instanceof HTMLElement&&k.focus(),k=null}function Pe(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),o=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(k=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{o?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{$=localStorage.getItem(K)==="compact"?"compact":"default";let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),n=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountBodyOverrideColorsBody"),i=document.getElementById("accountSettingsResetConfirmDialog"),s=document.getElementById("accountSettingsResetConfirmBackdrop"),c=document.getElementById("accountSettingsResetConfirmClose"),p=document.getElementById("accountSettingsResetConfirmCancel"),l=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{ve()}),t?.addEventListener("click",()=>{Pe()}),s?.addEventListener("click",()=>{M()}),c?.addEventListener("click",()=>{M()}),p?.addEventListener("click",()=>{M()}),l?.addEventListener("click",()=>{M({restoreFocus:!1}),$e()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{pe(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{me(d.dataset.orbViewMode||"default")})}),o?.addEventListener("click",()=>{J();let d=F();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(de("natal")))},g="prognostic",W(d),S(f("page.accountSettings.toasts.orbsCopied"),"info")}),n?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.orbAspectType||!u.dataset.orbBody)return;let b=F(),V=(b.orbs.profiles[g]||{matrix:E(g)}).matrix||E(g);V[u.dataset.orbAspectType]||(V[u.dataset.orbAspectType]={}),V[u.dataset.orbAspectType][u.dataset.orbBody]=Number.parseFloat(u.value)||0,b.orbs.profiles[g]={matrix:V}}),a?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.bodyColorOverride)return;u.dataset.bodyColorActive="true",a.querySelector(`[data-clear-body-color-override="${u.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),a?.addEventListener("click",d=>{let u=d.target.closest("[data-clear-body-color-override]");if(!(u instanceof HTMLElement))return;let b=u.dataset.clearBodyColorOverride;if(!b)return;let I=a.querySelector(`[data-body-color-override="${b}"]`);I instanceof HTMLInputElement&&(I.dataset.bodyColorActive="false",u.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await _e(),document.addEventListener("frontend:locale-changed",()=>{y&&D(y)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!i||i.classList.contains("hidden")||M())})}catch(d){S(d.message||f("page.accountSettings.toasts.loadFailed"),"error"),X()}})})();
