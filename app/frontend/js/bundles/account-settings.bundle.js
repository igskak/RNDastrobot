import{a as At}from"./chunks/chunk-DSL2JQTL.js";import"./chunks/chunk-2MGLT2CN.js";import{b as E,d as ft,e as ht,f as St,g as wt}from"./chunks/chunk-IGMIONLW.js";var $t=E(ft()),Bt=E(ht()),_t=E(St());var Et=E(wt()),Pt=E(At());(function(){"use strict";let O=["natal","biwheel","solar"],H=["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"],Z={Sesquiquadrate:"⚼",Vigintile:"V",Semi_Nonagon:"SN",Decile:"D",Nonagon:"N",Binonagon:"BN",Sentagon:"SG",Tridecile:"TD",Septile:"7",Novile:"9"},C=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],P="activePreferenceRecalcJobId",p=null,A=null,V=null,$=null,g="natal";function J(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),300))}function u(t,e){return window.FrontendI18n?.t?.(t,e)||t}function l(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function B(t,e=""){let a=u(t);return a&&a!==t?a:e}function m(t){return B(`astro.planet.${t}`,t)}function N(t){return window.Symbols?.planets?.[t]||String(t||"").slice(0,2)||"•"}function _(t){return B(`astro.aspect.${t}`,t)}function k(t){return window.Symbols?.aspects?.[t]||Z[t]||String(t||"").slice(0,2)||"•"}function tt(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function h(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function f(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function x(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function W(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function et(){return window.AstroPreferences?.MATRIX_BODIES||[]}function v(){return A?.aspect_types||H.map(t=>({aspect_type:t}))}function M(){return(A?.bodies||[]).map(t=>t?.name).filter(Boolean)}function S(){return Object.fromEntries(v().map(t=>[t.aspect_type,Object.fromEntries(M().map(e=>[e,Number(t.base_orb||5)]))]))}function w(){let t={version:2,profiles:Object.fromEntries(C.map(e=>[e,{matrix:S()}]))};return f({orbs:t,balances:A?.default_balance_targets||{}})}function z(){return x(A?.default_visual_palettes||{})}function U(){return{chart_defaults:{natal:h({}),biwheel:h({aspects:{scope:"major"}}),solar:h({})},chart_creation_defaults:{house_system:"P"},methodology:w(),visual:z()}}function Y(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount")}}function T(){return p||(p={methodology:w()}),p.methodology=f(p.methodology||w()),p.methodology}function at(t){return T()?.orbs?.profiles?.[t]?.matrix||S()}function K(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),a=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let n=o.dataset.orbProfileTab===g;o.classList.toggle("is-active",n),o.setAttribute("aria-selected",n?"true":"false"),e&&n&&o.id&&e.setAttribute("aria-labelledby",o.id)}),t&&(t.textContent=u(`page.accountSettings.orbs.hints.${g}`)),a&&a.classList.toggle("hidden",g!=="prognostic")}function F(){let t=T(),e=S();document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(a=>{let o=a.dataset.orbAspectType,n=a.dataset.orbBody;!o||!n||(e[o]||(e[o]={}),e[o][n]=Number.parseFloat(a.value)||0)}),t.orbs.profiles[g]={matrix:e}}function ot(t,{rerender:e=!0}={}){C.includes(t)&&(p&&F(),g=t,K(),e&&p&&q(p.methodology))}function nt(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=v().map(a=>{let o=a.aspect_type,n=l(k(o)),c=l(_(o)),s=O.map(r=>{let d=t?.[r]?.aspects?.enabled_types||[],y=new Set(Array.isArray(d)&&d.length?d:H).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${r}"
                                data-aspect-type="${o}"
                                ${y}
                                aria-label="${l(`${B(`page.accountSettings.tables.columns.${r}`,r)}: ${c}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${n}</span></span>
                        </span>
                    </th>
                    ${s}
                </tr>
            `}).join(""))}function st(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=et().map(a=>{let o=l(m(a)),n=l(window.Symbols?.planets?.[a]||""),c=O.map(s=>{let r=W(t?.[s]?.matrix?.rows||{}),d=r?.[a]?.display!==!1?"checked":"",i=r?.[a]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${a}"
                                data-matrix-field="display"
                                ${d}
                                aria-label="${l(`${B(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${u("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${a}"
                                data-matrix-field="aspecting"
                                ${i}
                                aria-label="${l(`${B(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${u("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${o}" aria-label="${o}" role="img" tabindex="0"><span class="astro-symbol" aria-hidden="true">${n}</span></span>
                        </span>
                    </th>
                    ${c}
                </tr>
            `}).join(""))}function q(t={}){let e=document.getElementById("accountOrbsHeaderRow"),a=document.getElementById("accountOrbsMatrixBody");if(!e||!a)return;let o=M(),n=v(),s=f(t||w())?.orbs?.profiles?.[g]?.matrix||S();e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let d=l(m(r)),i=l(window.Symbols?.planets?.[r]||r);return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,a.innerHTML=n.map(r=>{let d=r.aspect_type,i=l(k(d)),y=l(_(d));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(D=>{let X=s?.[d]?.[D],bt=l(m(D));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(X))?Number(X):Number(r.base_orb||5)}"
                                    aria-label="${l(`${y} · ${bt}`)}"
                                    data-orb-aspect-type="${d}"
                                    data-orb-body="${D}"
                                    data-orb-profile="${g}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),K()}function ct(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),a=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!a)return;let o=t?.balances||{},n=o?.planet_weights||{},c=o?.special_point_weights||{},r=M().filter(i=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(i)),d=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=r.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${l(m(i))}" aria-label="${l(m(i))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${l(N(i))}</span>
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
                        value="${Number(n?.[i]??1).toFixed(1)}"
                        data-balance-planet="${i}"
                        aria-label="${l(m(i))}"
                    >
                </td>
            </tr>
        `).join(""),a.innerHTML=d.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${l(m(i))}" aria-label="${l(m(i))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${l(N(i))}</span>
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
                        aria-label="${l(m(i))}"
                    >
                </td>
            </tr>
        `).join("")}function rt(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let a=t?.aspect_colors||{};e.innerHTML=v().map(o=>{let n=o.aspect_type,c=a?.[n]||"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${l(_(n))}" aria-label="${l(_(n))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l(k(n))}</span>
                            </span>
                        </span>
                    </th>
                    <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${l(c)}" data-aspect-color="${n}" aria-label="${l(_(n))}"></td>
                </tr>
            `}).join("")}function lt(t={}){let e=document.getElementById("accountElementPaletteBody"),a=document.getElementById("accountBodyOverrideColorsBody");if(!e||!a)return;let o=x(t),n=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(n).map(s=>`
            <tr>
                <th scope="row">${l(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${l(n[s])}" data-element-color="${s}" aria-label="${l(s)}"></td>
            </tr>
        `).join(""),a.innerHTML=M().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${l(m(s))}" aria-label="${l(m(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${l(N(s))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${l(c?.[s]||"#c7b49a")}"
                            data-body-color-override="${s}"
                            data-body-color-active="${c?.[s]?"true":"false"}"
                            aria-label="${l(m(s))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${c?.[s]?"":" is-muted"}"
                            data-clear-body-color-override="${s}"
                            title="${l(u("common.reset"))}"
                            aria-label="${l(`${u("common.reset")}: ${m(s)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function I(t){let e={...U(),...t||{},chart_defaults:{natal:h(t?.chart_defaults?.natal||{}),biwheel:h(t?.chart_defaults?.biwheel||{}),solar:h(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:f(t?.methodology||w()),visual:x(t?.visual||z())};p=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),C.includes(g)||(g="natal");let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=e.chart_creation_defaults.house_system||"P"),O.forEach(o=>{let n=e.chart_defaults[o],c=Y(o);c.orientation&&(c.orientation.value=n.view_options?.orientation==="asc"?"asc":"aries"),c.aspectScope&&(c.aspectScope.value=n.aspects?.scope||(o==="biwheel"?"major":"all")),c.showApplyingSeparating&&(c.showApplyingSeparating.checked=n.aspects?.show_applying_separating===!0),c.showSpeed&&(c.showSpeed.checked=n.table_options?.show_speed!==!1),c.showStationary&&(c.showStationary.checked=n.table_options?.show_stationary!==!1)}),nt(e.chart_defaults),st(e.chart_defaults),q(e.methodology),ct(e.methodology),rt(e.visual),lt(e.visual)}function it(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(a=>{a.checked&&a.dataset.aspectType&&e.push(a.dataset.aspectType)}),e.length?e:v().map(a=>a.aspect_type)}function dt(t){let e=W({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(a=>{let o=a.dataset.matrixBody,n=a.dataset.matrixField;!o||!n||(e[o]={...e[o]||{display:!0,aspecting:!0},[n]:a.checked})}),e}function j(t){let e=Y(t);return{matrix:{rows:dt(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:it(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function ut(){F();let t=f(p?.methodology||w())?.orbs?.profiles||{},e={};document.querySelectorAll("[data-balance-planet]").forEach(o=>{o.dataset.balancePlanet&&(e[o.dataset.balancePlanet]=Number.parseFloat(o.value)||0)});let a={};return document.querySelectorAll("[data-balance-special-point]").forEach(o=>{o.dataset.balanceSpecialPoint&&(a[o.dataset.balanceSpecialPoint]=Number.parseFloat(o.value)||0)}),f({orbs:{version:2,profiles:t},balances:{version:1,planet_weights:e,special_point_weights:a}})}function pt(){let t={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(t[o.dataset.aspectColor]=o.value)});let e={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(e[o.dataset.elementColor]=o.value)});let a={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let n=o.dataset.bodyColorOverride,c=String(o.value||"").trim();n&&c&&o.dataset.bodyColorActive!=="false"&&(a[n]=c)}),x({aspect_colors:t,planet_colors:{element_palette:e,body_overrides:a}})}function mt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:j("natal"),biwheel:j("biwheel"),solar:j("solar")},methodology:ut(),visual:pt()}}function b(t,e="info"){let a=document.getElementById("accountSettingsToast");!a||!t||(a.textContent=t,a.className=`toast ${e}`,requestAnimationFrame(()=>a.classList.add("visible")),clearTimeout(V),V=setTimeout(()=>{a.classList.remove("visible")},2800))}function L(t,{final:e=!1}={}){let a=document.getElementById("methodologyJobStatus");if(!a)return;if(!t){a.classList.add("hidden"),a.textContent="";return}let o=Number(t.progress_total||0),n=Number(t.progress_done||0),c=o>0?Math.min(100,Math.round(n/o*100)):0,r=`${String(t.status||"pending").toUpperCase()} · ${n}/${o||"0"} · ${c}%`,d=Number(t.failed_count||0),i=d?` · failures: ${d}`:"";a.textContent=e?`${r}${i}`:`${r}${i}`,a.classList.remove("hidden"),a.dataset.status=String(t.status||"pending")}function R(){$&&(clearTimeout($),$=null)}async function Q(t){if(R(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(P,String(t));let e=async()=>{try{let a=await window.AstroAPI.getPreferenceRecalcJob(t);if(L(a,{final:a.status==="completed"||a.status==="failed"}),a.status==="completed"){sessionStorage.removeItem(P),b(`Methodology recalculation finished${a.failed_count?` with ${a.failed_count} failures`:""}.`,a.failed_count?"info":"success"),R();return}if(a.status==="failed"){sessionStorage.removeItem(P),b(a.error||"Methodology recalculation failed.","error"),R();return}$=setTimeout(e,2500)}catch(a){$=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",a)}};await e()}async function G(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?u("page.accountSettings.subtitleWithEmail",{email:t.email}):u("page.accountSettings.subtitle"));let[a,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);A=a||null,I(o);let n=sessionStorage.getItem(P);n?Q(n).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):L(null),J()}async function gt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=mt(),a=!tt(f(p?.methodology||{}),e.methodology),o=await window.AstroAPI.patchAccountPreferences(e);if(I(o),a&&window.AstroAPI?.createPreferenceRecalcJob){let n=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});L(n),Q(n.job_id).catch(c=>{console.warn("Failed to poll methodology recalculation job:",c)}),b("Preferences saved. Methodology recalculation started.","success");return}b(u("page.accountSettings.toasts.saved"),"success")}catch(e){b(e.message||u("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function yt(){I(U()),L(null),b(u("page.accountSettings.toasts.restored"),"info")}document.addEventListener("DOMContentLoaded",async()=>{let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("reloadAccountSettingsBtn"),a=document.getElementById("restoreStandardDefaultsBtn"),o=document.getElementById("accountApplyNatalOrbsBtn"),n=document.getElementById("accountOrbsMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody");t?.addEventListener("click",()=>{gt()}),e?.addEventListener("click",()=>{G().catch(s=>{b(s.message||u("page.accountSettings.toasts.reloadFailed"),"error")})}),a?.addEventListener("click",()=>{yt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(s=>{s.addEventListener("click",()=>{ot(s.dataset.orbProfileTab||"natal")})}),o?.addEventListener("click",()=>{F();let s=T();s.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(at("natal")))},g="prognostic",q(s),b(u("page.accountSettings.toasts.orbsCopied"),"info")}),n?.addEventListener("input",s=>{let r=s.target;if(!(r instanceof HTMLInputElement)||!r.dataset.orbAspectType||!r.dataset.orbBody)return;let d=T(),y=(d.orbs.profiles[g]||{matrix:S()}).matrix||S();y[r.dataset.orbAspectType]||(y[r.dataset.orbAspectType]={}),y[r.dataset.orbAspectType][r.dataset.orbBody]=Number.parseFloat(r.value)||0,d.orbs.profiles[g]={matrix:y}}),c?.addEventListener("input",s=>{let r=s.target;if(!(r instanceof HTMLInputElement)||!r.dataset.bodyColorOverride)return;r.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${r.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",s=>{let r=s.target.closest("[data-clear-body-color-override]");if(!(r instanceof HTMLElement))return;let d=r.dataset.clearBodyColorOverride;if(!d)return;let i=c.querySelector(`[data-body-color-override="${d}"]`);i instanceof HTMLInputElement&&(i.dataset.bodyColorActive="false",r.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await G(),document.addEventListener("frontend:locale-changed",()=>{p&&I(p)})}catch(s){b(s.message||u("page.accountSettings.toasts.loadFailed"),"error"),J()}})})();
