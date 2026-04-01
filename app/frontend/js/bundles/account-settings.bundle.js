import{a as _t}from"./chunks/chunk-MWX6NVFW.js";import"./chunks/chunk-2MGLT2CN.js";import{b as E,d as St,e as wt,f as At,g as Bt}from"./chunks/chunk-IGMIONLW.js";var $t=E(St()),vt=E(wt()),Et=E(At());var xt=E(Bt()),Tt=E(_t());(function(){"use strict";let C=["natal","biwheel","solar"],V=["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"],tt={Sesquiquadrate:"⚼",Vigintile:"V",Semi_Nonagon:"SN",Decile:"D",Nonagon:"N",Binonagon:"BN",Sentagon:"SG",Tridecile:"TD",Septile:"7",Novile:"9"},N=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],P=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",x="activePreferenceRecalcJobId",u=null,A=null,J=null,B=null,g="natal";function z(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function p(t,e){return window.FrontendI18n?.t?.(t,e)||t}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function _(t,e=""){let a=p(t);return a&&a!==t?a:e}function m(t){return _(`astro.planet.${t}`,t)}function k(t){return window.Symbols?.planets?.[t]||String(t||"").slice(0,2)||"•"}function $(t){return _(`astro.aspect.${t}`,t)}function F(t){return window.Symbols?.aspects?.[t]||tt[t]||String(t||"").slice(0,2)||"•"}function et(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function S(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function f(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function T(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function W(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function at(){return window.AstroPreferences?.MATRIX_BODIES||[]}function v(){return A?.aspect_types||V.map(t=>({aspect_type:t}))}function M(){return(A?.bodies||[]).map(t=>t?.name).filter(Boolean)}function w(){return Object.fromEntries(v().map(t=>[t.aspect_type,Object.fromEntries(M().map(e=>[e,Number(t.base_orb||5)]))]))}function h(){let t={version:2,pair_strategy:P,profiles:Object.fromEntries(N.map(e=>[e,{matrix:w()}]))};return f({orbs:t,balances:A?.default_balance_targets||{}})}function U(){return T(A?.default_visual_palettes||{})}function Y(){return{chart_defaults:{natal:S({}),biwheel:S({aspects:{scope:"major"}}),solar:S({})},chart_creation_defaults:{house_system:"P"},methodology:h(),visual:U()}}function G(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function O(){return u||(u={methodology:h()}),u.methodology=f(u.methodology||h()),u.methodology}function ot(t){return O()?.orbs?.profiles?.[t]?.matrix||w()}function nt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||P:f(u?.methodology||h())?.orbs?.pair_strategy||P}function K(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),a=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let s=o.dataset.orbProfileTab===g;o.classList.toggle("is-active",s),o.setAttribute("aria-selected",s?"true":"false"),e&&s&&o.id&&e.setAttribute("aria-labelledby",o.id)}),t&&(t.textContent=p(`page.accountSettings.orbs.hints.${g}`)),a&&a.classList.toggle("hidden",g!=="prognostic")}function R(){let t=O(),e=w();document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(a=>{let o=a.dataset.orbAspectType,s=a.dataset.orbBody;!o||!s||(e[o]||(e[o]={}),e[o][s]=Number.parseFloat(a.value)||0)}),t.orbs.profiles[g]={matrix:e}}function st(t,{rerender:e=!0}={}){N.includes(t)&&(u&&R(),g=t,K(),e&&u&&q(u.methodology))}function ct(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=v().map(a=>{let o=a.aspect_type,s=r(F(o)),l=r($(o)),n=C.map(c=>{let d=t?.[c]?.aspects?.enabled_types||[],y=new Set(Array.isArray(d)&&d.length?d:V).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-aspect-type="${o}"
                                ${y}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${c}`,c)}: ${l}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${l}" aria-label="${l}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${s}</span></span>
                        </span>
                    </th>
                    ${n}
                </tr>
            `}).join(""))}function rt(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=at().map(a=>{let o=r(m(a)),s=r(window.Symbols?.planets?.[a]||""),l=C.map(n=>{let c=W(t?.[n]?.matrix?.rows||{}),d=c?.[a]?.display!==!1?"checked":"",i=c?.[a]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${n}"
                                data-matrix-body="${a}"
                                data-matrix-field="display"
                                ${d}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${n}`,n)}: ${o} ${p("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${n}"
                                data-matrix-body="${a}"
                                data-matrix-field="aspecting"
                                ${i}
                                aria-label="${r(`${_(`page.accountSettings.tables.columns.${n}`,n)}: ${o} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${o}" aria-label="${o}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${s}</span></span>
                        </span>
                    </th>
                    ${l}
                </tr>
            `}).join(""))}function q(t={}){let e=document.getElementById("accountOrbsHeaderRow"),a=document.getElementById("accountOrbsMatrixBody");if(!e||!a)return;let o=M(),s=v(),n=f(t||h())?.orbs?.profiles?.[g]?.matrix||w();e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(c=>{let d=r(m(c)),i=r(window.Symbols?.planets?.[c]||c);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,a.innerHTML=s.map(c=>{let d=c.aspect_type,i=r(F(d)),y=r($(d));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(H=>{let Z=n?.[d]?.[H],ht=r(m(H));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(Z))?Number(Z):Number(c.base_orb||5)}"
                                    aria-label="${r(`${y} · ${ht}`)}"
                                    data-orb-aspect-type="${d}"
                                    data-orb-body="${H}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),K()}function lt(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),a=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!a)return;let o=t?.balances||{},s=o?.planet_weights||{},l=o?.special_point_weights||{},c=M().filter(i=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(i)),d=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=c.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(i))}" aria-label="${r(m(i))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(k(i))}</span>
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
                        value="${Number(s?.[i]??1).toFixed(1)}"
                        data-balance-planet="${i}"
                        aria-label="${r(m(i))}"
                    >
                </td>
            </tr>
        `).join(""),a.innerHTML=d.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(m(i))}" aria-label="${r(m(i))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${r(k(i))}</span>
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
                        value="${Number(l?.[i]??0).toFixed(1)}"
                        data-balance-special-point="${i}"
                        aria-label="${r(m(i))}"
                    >
                </td>
            </tr>
        `).join("")}function it(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let a=t?.aspect_colors||{};e.innerHTML=v().map(o=>{let s=o.aspect_type,l=a?.[s]||"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r($(s))}" aria-label="${r($(s))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(F(s))}</span>
                            </span>
                        </span>
                    </th>
                    <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(l)}" data-aspect-color="${s}" aria-label="${r($(s))}"></td>
                </tr>
            `}).join("")}function dt(t={}){let e=document.getElementById("accountElementPaletteBody"),a=document.getElementById("accountBodyOverrideColorsBody");if(!e||!a)return;let o=T(t),s=o?.planet_colors?.element_palette||{},l=o?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(s).map(n=>`
            <tr>
                <th scope="row">${r(n)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(s[n])}" data-element-color="${n}" aria-label="${r(n)}"></td>
            </tr>
        `).join(""),a.innerHTML=M().map(n=>`
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
                            value="${r(l?.[n]||"#c7b49a")}"
                            data-body-color-override="${n}"
                            data-body-color-active="${l?.[n]?"true":"false"}"
                            aria-label="${r(m(n))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${l?.[n]?"":" is-muted"}"
                            data-clear-body-color-override="${n}"
                            title="${r(p("common.reset"))}"
                            aria-label="${r(`${p("common.reset")}: ${m(n)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function I(t){let e={...Y(),...t||{},chart_defaults:{natal:S(t?.chart_defaults?.natal||{}),biwheel:S(t?.chart_defaults?.biwheel||{}),solar:S(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:f(t?.methodology||h()),visual:T(t?.visual||U())};u=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),N.includes(g)||(g="natal");let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=e.chart_creation_defaults.house_system||"P");let o=document.getElementById("accountOrbPairStrategySelect");o&&(o.value=e.methodology?.orbs?.pair_strategy||P),C.forEach(s=>{let l=e.chart_defaults[s],n=G(s);n.orientation&&(n.orientation.value=l.view_options?.orientation==="asc"?"asc":"aries"),n.aspectScope&&(n.aspectScope.value=l.aspects?.scope||(s==="biwheel"?"major":"all")),n.showApplyingSeparating&&(n.showApplyingSeparating.checked=l.aspects?.show_applying_separating===!0),n.showSpeed&&(n.showSpeed.checked=l.table_options?.show_speed!==!1),n.showStationary&&(n.showStationary.checked=l.table_options?.show_stationary!==!1)}),ct(e.chart_defaults),rt(e.chart_defaults),q(e.methodology),lt(e.methodology),it(e.visual),dt(e.visual)}function ut(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(a=>{a.checked&&a.dataset.aspectType&&e.push(a.dataset.aspectType)}),e.length?e:v().map(a=>a.aspect_type)}function pt(t){let e=W({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(a=>{let o=a.dataset.matrixBody,s=a.dataset.matrixField;!o||!s||(e[o]={...e[o]||{display:!0,aspecting:!0},[s]:a.checked})}),e}function j(t){let e=G(t);return{matrix:{rows:pt(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:ut(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function mt(){R();let e=(f(u?.methodology||h())?.orbs||{})?.profiles||{},a={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(a[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(o[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),f({orbs:{version:2,pair_strategy:nt(),profiles:e},balances:{version:1,planet_weights:a,special_point_weights:o}})}function gt(){let t={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(t[o.dataset.aspectColor]=o.value)});let e={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(e[o.dataset.elementColor]=o.value)});let a={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let s=o.dataset.bodyColorOverride,l=String(o.value||"").trim();s&&l&&o.dataset.bodyColorActive!=="false"&&(a[s]=l)}),T({aspect_colors:t,planet_colors:{element_palette:e,body_overrides:a}})}function yt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:j("natal"),biwheel:j("biwheel"),solar:j("solar")},methodology:mt(),visual:gt()}}function b(t,e="info"){let a=document.getElementById("accountSettingsToast");!a||!t||(a.textContent=t,a.className=`toast ${e}`,requestAnimationFrame(()=>a.classList.add("visible")),clearTimeout(J),J=setTimeout(()=>{a.classList.remove("visible")},2800))}function L(t,{final:e=!1}={}){let a=document.getElementById("methodologyJobStatus");if(!a)return;if(!t){a.classList.add("hidden"),a.textContent="";return}let o=Number(t.progress_total||0),s=Number(t.progress_done||0),l=o>0?Math.min(100,Math.round(s/o*100)):0,c=`${String(t.status||"pending").toUpperCase()} · ${s}/${o||"0"} · ${l}%`,d=Number(t.failed_count||0),i=d?` · failures: ${d}`:"";a.textContent=e?`${c}${i}`:`${c}${i}`,a.classList.remove("hidden"),a.dataset.status=String(t.status||"pending")}function D(){B&&(clearTimeout(B),B=null)}async function Q(t){if(D(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(x,String(t));let e=async()=>{try{let a=await window.AstroAPI.getPreferenceRecalcJob(t);if(L(a,{final:a.status==="completed"||a.status==="failed"}),a.status==="completed"){sessionStorage.removeItem(x),b(`Methodology recalculation finished${a.failed_count?` with ${a.failed_count} failures`:""}.`,a.failed_count?"info":"success"),D();return}if(a.status==="failed"){sessionStorage.removeItem(x),b(a.error||"Methodology recalculation failed.","error"),D();return}B=setTimeout(e,2500)}catch(a){B=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",a)}};await e()}async function X(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?p("page.accountSettings.subtitleWithEmail",{email:t.email}):p("page.accountSettings.subtitle"));let[a,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);A=a||null,I(o);let s=sessionStorage.getItem(x);s?Q(s).catch(l=>{console.warn("Failed to resume recalculation job polling:",l)}):L(null),z()}async function bt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=yt(),a=!et(f(u?.methodology||{}),e.methodology),o=await window.AstroAPI.patchAccountPreferences(e);if(I(o),a&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});L(s),Q(s.job_id).catch(l=>{console.warn("Failed to poll methodology recalculation job:",l)}),b("Preferences saved. Methodology recalculation started.","success");return}b(p("page.accountSettings.toasts.saved"),"success")}catch(e){b(e.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function ft(){I(Y()),L(null),b(p("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("reloadAccountSettingsBtn"),a=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),s=document.getElementById("accountOrbsMatrixBody"),l=document.getElementById("accountBodyOverrideColorsBody");t?.addEventListener("click",()=>{bt()}),e?.addEventListener("click",()=>{X().catch(n=>{b(n.message||p("page.accountSettings.toasts.reloadFailed"),"error")})}),a?.addEventListener("click",()=>{ft()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(n=>{n.addEventListener("click",()=>{st(n.dataset.orbProfileTab||"natal")})}),o?.addEventListener("click",()=>{R();let n=O();n.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(ot("natal")))},g="prognostic",q(n),b(p("page.accountSettings.toasts.orbsCopied"),"info")}),s?.addEventListener("input",n=>{let c=n.target;if(!(c instanceof HTMLInputElement)||!c.dataset.orbAspectType||!c.dataset.orbBody)return;let d=O(),y=(d.orbs.profiles[g]||{matrix:w()}).matrix||w();y[c.dataset.orbAspectType]||(y[c.dataset.orbAspectType]={}),y[c.dataset.orbAspectType][c.dataset.orbBody]=Number.parseFloat(c.value)||0,d.orbs.profiles[g]={matrix:y}}),l?.addEventListener("input",n=>{let c=n.target;if(!(c instanceof HTMLInputElement)||!c.dataset.bodyColorOverride)return;c.dataset.bodyColorActive="true",l.querySelector(`[data-clear-body-color-override="${c.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),l?.addEventListener("click",n=>{let c=n.target.closest("[data-clear-body-color-override]");if(!(c instanceof HTMLElement))return;let d=c.dataset.clearBodyColorOverride;if(!d)return;let i=l.querySelector(`[data-body-color-override="${d}"]`);i instanceof HTMLInputElement&&(i.dataset.bodyColorActive="false",c.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await X(),document.addEventListener("frontend:locale-changed",()=>{u&&I(u)})}catch(n){b(n.message||p("page.accountSettings.toasts.loadFailed"),"error"),z()}})})();
