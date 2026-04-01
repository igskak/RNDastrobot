import{a as _e}from"./chunks/chunk-JPS7Q3VF.js";import"./chunks/chunk-2MGLT2CN.js";import{b as v,d as Se,e as we,f as Ae,g as Be}from"./chunks/chunk-IGMIONLW.js";var $e=v(Se()),Ee=v(we()),ve=v(Ae());var xe=v(Be()),Te=v(_e());(function(){"use strict";let C=["natal","biwheel","solar"],H=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ee={Sesquiquadrate:"⚼",Vigintile:"V",Semi_Nonagon:"SN",Decile:"D",Nonagon:"N",Binonagon:"BN",Sentagon:"SG",Tridecile:"TD",Septile:"7",Novile:"9"},N=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],P=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",x="activePreferenceRecalcJobId",u=null,A=null,J=null,B=null,g="natal";function z(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),300))}function p(e,t){return window.FrontendI18n?.t?.(e,t)||e}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function _(e,t=""){let o=p(e);return o&&o!==e?o:t}function m(e){return _(`astro.planet.${e}`,e)}function k(e){return window.Symbols?.planets?.[e]||String(e||"").slice(0,2)||"•"}function $(e){return _(`astro.aspect.${e}`,e)}function F(e){return window.Symbols?.aspects?.[e]||ee[e]||String(e||"").slice(0,2)||"•"}function te(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function S(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function f(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function T(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function W(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function oe(){return window.AstroPreferences?.MATRIX_BODIES||[]}function E(){return A?.aspect_types||H.map(e=>({aspect_type:e}))}function M(){return(A?.bodies||[]).map(e=>e?.name).filter(Boolean)}function w(){return Object.fromEntries(E().map(e=>[e.aspect_type,Object.fromEntries(M().map(t=>[t,Number(e.base_orb||5)]))]))}function h(){let e={version:2,pair_strategy:P,profiles:Object.fromEntries(N.map(t=>[t,{matrix:w()}]))};return f({orbs:e,balances:A?.default_balance_targets||{}})}function U(){return T(A?.default_visual_palettes||{})}function Y(){return{chart_defaults:{natal:S({}),biwheel:S({aspects:{scope:"major"}}),solar:S({})},chart_creation_defaults:{house_system:"P"},methodology:h(),visual:U()}}function G(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function O(){return u||(u={methodology:h()}),u.methodology=f(u.methodology||h()),u.methodology}function ae(e){return O()?.orbs?.profiles?.[e]?.matrix||w()}function ne(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||P:f(u?.methodology||h())?.orbs?.pair_strategy||P}function K(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),o=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(a=>{let s=a.dataset.orbProfileTab===g;a.classList.toggle("is-active",s),a.setAttribute("aria-selected",s?"true":"false"),t&&s&&a.id&&t.setAttribute("aria-labelledby",a.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${g}`)),o&&o.classList.toggle("hidden",g!=="prognostic")}function R(){let e=O(),t=w();document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(o=>{let a=o.dataset.orbAspectType,s=o.dataset.orbBody;!a||!s||(t[a]||(t[a]={}),t[a][s]=Number.parseFloat(o.value)||0)}),e.orbs.profiles[g]={matrix:t}}function se(e,{rerender:t=!0}={}){N.includes(e)&&(u&&R(),g=e,K(),t&&u&&q(u.methodology))}function ce(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=E().map(o=>{let a=o.aspect_type,s=r(F(a)),i=r($(a)),n=C.map(c=>{let d=e?.[c]?.aspects?.enabled_types||[],y=new Set(Array.isArray(d)&&d.length?d:H).has(a)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-aspect-type="${a}"
                                ${y}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${c}`,c)}: ${i}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${i}" aria-label="${i}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${s}</span></span>
                        </span>
                    </th>
                    ${n}
                </tr>
            `}).join(""))}function re(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=oe().map(o=>{let a=r(m(o)),s=r(window.Symbols?.planets?.[o]||""),i=C.map(n=>{let c=W(e?.[n]?.matrix?.rows||{}),d=c?.[o]?.display!==!1?"checked":"",l=c?.[o]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${n}"
                                data-matrix-body="${o}"
                                data-matrix-field="display"
                                ${d}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${n}`,n)}: ${a} ${p("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${n}"
                                data-matrix-body="${o}"
                                data-matrix-field="aspecting"
                                ${l}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${n}`,n)}: ${a} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${a}" aria-label="${a}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${s}</span></span>
                        </span>
                    </th>
                    ${i}
                </tr>
            `}).join(""))}function q(e={}){let t=document.getElementById("accountOrbsHeaderRow"),o=document.getElementById("accountOrbsMatrixBody");if(!t||!o)return;let a=M(),s=E(),n=f(e||h())?.orbs?.profiles?.[g]?.matrix||w();t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${a.map(c=>{let d=r(m(c)),l=r(window.Symbols?.planets?.[c]||c);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,o.innerHTML=s.map(c=>{let d=c.aspect_type,l=r(F(d)),y=r($(d));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${a.map(V=>{let Z=n?.[d]?.[V],he=r(m(V));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(Z))?Number(Z):Number(c.base_orb||5)}"
                                    aria-label="${r(`${y} · ${he}`)}"
                                    data-orb-aspect-type="${d}"
                                    data-orb-body="${V}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),K()}function ie(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),o=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!o)return;let a=e?.balances||{},s=a?.planet_weights||{},i=a?.special_point_weights||{},c=M().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),d=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=c.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(l))}" aria-label="${r(m(l))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(k(l))}</span>
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
                        value="${Number(s?.[l]??1).toFixed(1)}"
                        data-balance-planet="${l}"
                        aria-label="${r(m(l))}"
                    >
                </td>
            </tr>
        `).join(""),o.innerHTML=d.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(l))}" aria-label="${r(m(l))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(k(l))}</span>
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
        `).join("")}function le(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let o=e?.aspect_colors||{};t.innerHTML=E().map(a=>{let s=a.aspect_type,i=o?.[s]||"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r($(s))}" aria-label="${r($(s))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(F(s))}</span>
                            </span>
                        </span>
                    </th>
                    <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(i)}" data-aspect-color="${s}" aria-label="${r($(s))}"></td>
                </tr>
            `}).join("")}function de(e={}){let t=document.getElementById("accountElementPaletteBody"),o=document.getElementById("accountBodyOverrideColorsBody");if(!t||!o)return;let a=T(e),s=a?.planet_colors?.element_palette||{},i=a?.planet_colors?.body_overrides||{};t.innerHTML=Object.keys(s).map(n=>`
            <tr>
                <th scope="row">${r(n)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(s[n])}" data-element-color="${n}" aria-label="${r(n)}"></td>
            </tr>
        `).join(""),o.innerHTML=M().map(n=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(n))}" aria-label="${r(m(n))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(k(n))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(i?.[n]||"#c7b49a")}"
                            data-body-color-override="${n}"
                            data-body-color-active="${i?.[n]?"true":"false"}"
                            aria-label="${r(m(n))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${i?.[n]?"":" is-muted"}"
                            data-clear-body-color-override="${n}"
                            title="${r(p("common.reset"))}"
                            aria-label="${r(`${p("common.reset")}: ${m(n)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function I(e){let t={...Y(),...e||{},chart_defaults:{natal:S(e?.chart_defaults?.natal||{}),biwheel:S(e?.chart_defaults?.biwheel||{}),solar:S(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:f(e?.methodology||h()),visual:T(e?.visual||U())};u=t,window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),N.includes(g)||(g="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let a=document.getElementById("accountOrbPairStrategySelect");a&&(a.value=t.methodology?.orbs?.pair_strategy||P),C.forEach(s=>{let i=t.chart_defaults[s],n=G(s);n.orientation&&(n.orientation.value=i.view_options?.orientation==="asc"?"asc":"aries"),n.aspectScope&&(n.aspectScope.value=i.aspects?.scope||(s==="biwheel"?"major":"all")),n.showApplyingSeparating&&(n.showApplyingSeparating.checked=i.aspects?.show_applying_separating===!0),n.showSpeed&&(n.showSpeed.checked=i.table_options?.show_speed!==!1),n.showStationary&&(n.showStationary.checked=i.table_options?.show_stationary!==!1)}),ce(t.chart_defaults),re(t.chart_defaults),q(t.methodology),ie(t.methodology),le(t.visual),de(t.visual)}function ue(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(o=>{o.checked&&o.dataset.aspectType&&t.push(o.dataset.aspectType)}),t.length?t:E().map(o=>o.aspect_type)}function pe(e){let t=W({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(o=>{let a=o.dataset.matrixBody,s=o.dataset.matrixField;!a||!s||(t[a]={...t[a]||{display:!0,aspecting:!0},[s]:o.checked})}),t}function D(e){let t=G(e);return{matrix:{rows:pe(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:ue(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function me(){R();let t=(f(u?.methodology||h())?.orbs||{})?.profiles||{},o={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(o[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let a={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(a[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),f({orbs:{version:2,pair_strategy:ne(),profiles:t},balances:{version:1,planet_weights:o,special_point_weights:a}})}function ge(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(a=>{a.dataset.aspectColor&&a.value&&(e[a.dataset.aspectColor]=a.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(a=>{a.dataset.elementColor&&a.value&&(t[a.dataset.elementColor]=a.value)});let o={};return document.querySelectorAll("[data-body-color-override]").forEach(a=>{let s=a.dataset.bodyColorOverride,i=String(a.value||"").trim();s&&i&&a.dataset.bodyColorActive!=="false"&&(o[s]=i)}),T({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:o}})}function ye(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:D("natal"),biwheel:D("biwheel"),solar:D("solar")},methodology:me(),visual:ge()}}function b(e,t="info"){let o=document.getElementById("accountSettingsToast");!o||!e||(o.textContent=e,o.className=`toast ${t}`,requestAnimationFrame(()=>o.classList.add("visible")),clearTimeout(J),J=setTimeout(()=>{o.classList.remove("visible")},2800))}function L(e,{final:t=!1}={}){let o=document.getElementById("methodologyJobStatus");if(!o)return;if(!e){o.classList.add("hidden"),o.textContent="";return}let a=Number(e.progress_total||0),s=Number(e.progress_done||0),i=a>0?Math.min(100,Math.round(s/a*100)):0,c=`${String(e.status||"pending").toUpperCase()} · ${s}/${a||"0"} · ${i}%`,d=Number(e.failed_count||0),l=d?` · failures: ${d}`:"";o.textContent=t?`${c}${l}`:`${c}${l}`,o.classList.remove("hidden"),o.dataset.status=String(e.status||"pending")}function j(){B&&(clearTimeout(B),B=null)}async function Q(e){if(j(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(x,String(e));let t=async()=>{try{let o=await window.AstroAPI.getPreferenceRecalcJob(e);if(L(o,{final:o.status==="completed"||o.status==="failed"}),o.status==="completed"){sessionStorage.removeItem(x),b(`Methodology recalculation finished${o.failed_count?` with ${o.failed_count} failures`:""}.`,o.failed_count?"info":"success"),j();return}if(o.status==="failed"){sessionStorage.removeItem(x),b(o.error||"Methodology recalculation failed.","error"),j();return}B=setTimeout(t,2500)}catch(o){B=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",o)}};await t()}async function X(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?p("page.accountSettings.subtitleWithEmail",{email:e.email}):p("page.accountSettings.subtitle"));let[o,a]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);A=o||null,I(a);let s=sessionStorage.getItem(x);s?Q(s).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):L(null),z()}async function be(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=ye(),o=!te(f(u?.methodology||{}),t.methodology),a=await window.AstroAPI.patchAccountPreferences(t);if(I(a),o&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});L(s),Q(s.job_id).catch(i=>{console.warn("Failed to poll methodology recalculation job:",i)}),b("Preferences saved. Methodology recalculation started.","success");return}b(p("page.accountSettings.toasts.saved"),"success")}catch(t){b(t.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function fe(){I(Y()),L(null),b(p("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("reloadAccountSettingsBtn"),o=document.getElementById("restoreStandardDefaultsBtn"),a=document.getElementById("accountApplyNatalOrbsBtn"),s=document.getElementById("accountOrbsMatrixBody"),i=document.getElementById("accountBodyOverrideColorsBody");e?.addEventListener("click",()=>{be()}),t?.addEventListener("click",()=>{X().catch(n=>{b(n.message||p("page.accountSettings.toasts.reloadFailed"),"error")})}),o?.addEventListener("click",()=>{fe()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{n.addEventListener("click",()=>{se(n.dataset.orbProfileTab||"natal")})}),a?.addEventListener("click",()=>{R();let n=O();n.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(ae("natal")))},g="prognostic",q(n),b(p("page.accountSettings.toasts.orbsCopied"),"info")}),s?.addEventListener("input",n=>{let c=n.target;if(!(c instanceof HTMLInputElement)||!c.dataset.orbAspectType||!c.dataset.orbBody)return;let d=O(),y=(d.orbs.profiles[g]||{matrix:w()}).matrix||w();y[c.dataset.orbAspectType]||(y[c.dataset.orbAspectType]={}),y[c.dataset.orbAspectType][c.dataset.orbBody]=Number.parseFloat(c.value)||0,d.orbs.profiles[g]={matrix:y}}),i?.addEventListener("input",n=>{let c=n.target;if(!(c instanceof HTMLInputElement)||!c.dataset.bodyColorOverride)return;c.dataset.bodyColorActive="true",i.querySelector(`[data-clear-body-color-override="${c.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),i?.addEventListener("click",n=>{let c=n.target.closest("[data-clear-body-color-override]");if(!(c instanceof HTMLElement))return;let d=c.dataset.clearBodyColorOverride;if(!d)return;let l=i.querySelector(`[data-body-color-override="${d}"]`);l instanceof HTMLInputElement&&(l.dataset.bodyColorActive="false",c.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await X(),document.addEventListener("frontend:locale-changed",()=>{u&&I(u)})}catch(n){b(n.message||p("page.accountSettings.toasts.loadFailed"),"error"),z()}})})();
