import"./chunks/chunk-XCJV446S.js";import{a as lt}from"./chunks/chunk-D4GN5UHL.js";import"./chunks/chunk-MZ7NETWD.js";import{a as it}from"./chunks/chunk-CAGW7OFE.js";import{b as Y,d as st,e as ct,f as rt}from"./chunks/chunk-BI736Q2H.js";var mt=Y(st()),pt=Y(ct()),ft=Y(rt());var ht=Y(it()),bt=Y(lt());(function(){"use strict";let K=["natal","biwheel","solar"],oe=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],Q=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],q=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",z="activePreferenceRecalcJobId",ae="accountOrbViewMode",Ee=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),h=null,se=null,S=null,ce=null,O=null,y="natal",k="default",j=null;function re(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function m(e,n){return window.FrontendI18n?.t?.(e,n)||e}function ve(){let e=document.querySelector(".account-settings-back");if(!e)return;let n=window.AstroAPI?.getNavigationState?.()||{},t="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(t=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{t=""}e.href=t||window.AstroAPI?.getAccountSettingsReturnUrl?.()||n.sourceUrl||"/"}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function T(e,n=""){let t=m(e);return t&&t!==e?t:n}function Pe(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function xe(e){let n=window.AstroPlan?.getSavedChartLimitState?.(e);return!n||n.max===null||n.max===void 0?m("page.plan.usage.savedChartsUnlimited",{current:n?.current||0}):m("page.plan.usage.savedChartsLimited",{current:n.current,max:n.max})}function ie(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let n=new Date(e);return Number.isNaN(n.getTime())?String(e):n.toLocaleDateString()}function $e(e){let n=e?.billing?.subscription;return n?n.cancel_at_period_end&&n.current_period_end?m("page.accountSettings.plan.billingCancelsAt",{date:ie(n.current_period_end)}):n.current_period_end?m("page.accountSettings.plan.billingRenewsAt",{date:ie(n.current_period_end)}):m(`page.accountSettings.plan.billingStatus.${n.status}`)||n.status:m("page.accountSettings.plan.billingFree")}function Te(e){let n=document.getElementById("accountPlanCard");if(!n)return;let t=Pe(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage"),s=document.getElementById("accountPlanBillingStatus"),d=document.getElementById("accountPlanPortalBtn");if(o&&(o.textContent=m(`page.plan.names.${t}`)),a&&(a.textContent=m(`page.plan.descriptions.${t}`)),c&&(c.textContent=xe(e)),s&&(s.textContent=$e(e)),d){let i=!!e?.billing?.subscription;d.classList.toggle("hidden",!i),d.onclick=async()=>{try{d.disabled=!0;let l=await window.AstroAPI.getBillingPortal();l?.portal_url&&(window.location.href=l.portal_url)}catch(l){B(l.message||m("page.plan.modal.errors.portalFailed"),"error")}finally{d.disabled=!1}}}n.dataset.planCode=t}function p(e){return T(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function le(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function D(e,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,n)||`<span class="astro-symbol" aria-hidden="true">${r(le(e))}</span>`}function Ie(e){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,t=S?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=U().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(t);for(let s of c)if(t?.[s]?.ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.co_ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.exaltation===n)return o[s]||null;return null}function Ce(e,n={}){let t=I(n),o=Ie(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,t):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,t):"#6b7280"}function N(e){return T(`astro.aspect.${e}`,e)}function X(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Me(e,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,n):JSON.stringify(e??null)===JSON.stringify(n??null)}function R(e){return e==null?e:JSON.parse(JSON.stringify(e))}function E(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function v(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function F(e={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,n):e}function I(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function de(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Le(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return S?.aspect_types||oe.map(e=>({aspect_type:e}))}function dt(e){return C().find(n=>n?.aspect_type===e)||null}function H(){return(S?.bodies||[]).map(e=>e?.name).filter(Boolean)}function U(){return S?.signs||[]}function ue(){return H().filter(e=>!Ee.has(e))}function M(e="natal"){let n=C(),t=H();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,t,e):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(t.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function x(){let e={version:2,pair_strategy:q,profiles:Object.fromEntries(Q.map(n=>[n,{matrix:M(n)}]))};return v({orbs:e,balances:S?.default_balance_targets||{},dignities:S?.default_dignities||{version:1,signs:{}}})}function ge(){return I(S?.default_visual_palettes||{})}function me(){return{chart_defaults:{natal:E({}),biwheel:E({}),forecast_new:E({}),solar:E({})},chart_creation_defaults:{house_system:"P"},methodology:x(),visual:ge()}}function pe(){return document.getElementById("accountTimezoneLabelFormatSelect")}function fe(){return document.getElementById("accountDateFormatSelect")}function ye(){return document.getElementById("accountDegreeFormatSelect")}function he(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function P(){return h||(h={methodology:x()}),h.methodology=v(h.methodology||x()),h.methodology}function Oe(e){return P()?.orbs?.profiles?.[e]?.matrix||M(e)}function ke(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||q:v(h?.methodology||x())?.orbs?.pair_strategy||q}function be(e){return T(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function De(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ne(e){let n=r(be(e)),t=r(De(e));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${t}</span>`}function ut(e){return U().find(n=>n?.name===e)?.opposite||null}function Z(){let e=P();return e.dignities=F(e.dignities||{},S?.default_dignities||{}),e.dignities}function Re(e={}){let n=ue(),t=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return U().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&t[s.ruler]&&(t[s.ruler].domicile_primary.push(a),c&&t[s.ruler].detriment_primary.push(c)),s.co_ruler&&t[s.co_ruler]&&(t[s.co_ruler].domicile_secondary.push(a),c&&t[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&t[s.exaltation]&&(t[s.exaltation].exaltation.push(a),c&&t[s.exaltation].fall.push(c))}),t}function J(e=[],{mode:n="derived",secondarySigns:t=[]}={}){let o=new Set(t||[]);return U().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),d=o.has(c),i=["account-settings-dignity-glyph",s?"is-active":"",d?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),l=r(be(c)),u=r(`${l} · ${m(s?d?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${i}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${c}"
                    title="${u}"
                    aria-label="${u}"
                    ${n==="derived"?"disabled":""}
                >${Ne(c)}</button>
            `}).join("")}function Se(){let e=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),n&&a&&o.id&&n.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=m(`page.accountSettings.orbs.hints.${y}`)),t&&t.classList.toggle("hidden",y==="natal")}function we(){let e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(t=>{let o=t.dataset.orbViewMode===k;t.classList.toggle("is-active",o),t.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",k==="compact"),n?.classList.toggle("is-compact",k==="compact")}function ee(){let e=P(),n=M(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(t=>{let o=t.dataset.orbAspectType,a=t.dataset.orbBody;!o||!a||(n[o]||(n[o]={}),n[o][a]=Number.parseFloat(t.value)||0)}),e.orbs.profiles[y]={matrix:n}}function Fe(e,{rerender:n=!0}={}){Q.includes(e)&&(h&&ee(),y=e,Se(),n&&h&&te(h.methodology))}function He(e){["default","compact"].includes(e)&&(k=e,localStorage.setItem(ae,e),we())}function Ve(e={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=C().map(t=>{let o=t.aspect_type,a=r(X(o)),c=r(N(o)),s=K.map(d=>{let i=e?.[d]?.aspects?.enabled_types||[],f=new Set(Array.isArray(i)&&i.length?i:oe).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${d}"
                                data-aspect-type="${o}"
                                ${f}
                                aria-label="${r(`${T(`page.accountSettings.tables.columns.${d}`,d)}: ${c}`)}"
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
            `}).join(""))}function Ye(e={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=Le().map(t=>{let o=r(p(t)),a=D(t,{size:18,title:p(t)}),c=K.map(s=>{let d=de(e?.[s]?.matrix?.rows||{}),i=d?.[t]?.display!==!1?"checked":"",l=d?.[t]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${t}"
                                data-matrix-field="display"
                                ${i}
                                aria-label="${r(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${t}"
                                data-matrix-field="aspecting"
                                ${l}
                                aria-label="${r(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${o}" aria-label="${o}" role="img" tabindex="0">${a}</span>
                        </span>
                    </th>
                    ${c}
                </tr>
            `}).join(""))}function te(e={}){let n=document.getElementById("accountOrbsHeaderRow"),t=document.getElementById("accountOrbsMatrixBody");if(!n||!t)return;let o=H(),a=C(),s=v(e||x())?.orbs?.profiles?.[y]?.matrix||M(y);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(d=>{let i=r(p(d)),l=D(d,{size:18,title:p(d)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i}" aria-label="${i}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,t.innerHTML=a.map(d=>{let i=d.aspect_type,l=r(X(i)),f=r(N(i));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${f}" aria-label="${f}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(u=>{let g=s?.[i]?.[u],b=r(p(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(g))?Number(g):Number(d.base_orb||5)}"
                                    aria-label="${r(`${f} · ${b}`)}"
                                    data-orb-aspect-type="${i}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Se(),we()}function _e(e={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let t=F(e?.dignities||{},S?.default_dignities||{}),o=Re(t);n.innerHTML=ue().map(a=>{let c=r(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${D(a,{size:18,title:p(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${J(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${J(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${J(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${J(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function qe(e,n){let t=Z(),o={...t.signs?.[e]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,t.signs[e]=o,P().dignities=F(t,S?.default_dignities||{})}function ze(e,n){let t=Z(),o={...t.signs?.[e]||{}};o.exaltation=o.exaltation===n?null:n,t.signs[e]=o,P().dignities=F(t,S?.default_dignities||{})}function je(e={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),t=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!t)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},d=H().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),i=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=d.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(l))}" aria-label="${r(p(l))}" role="img" tabindex="0">
                                ${D(l,{size:18,title:p(l)})}
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
                        aria-label="${r(p(l))}"
                    >
                </td>
            </tr>
        `).join(""),t.innerHTML=i.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(l))}" aria-label="${r(p(l))}" role="img" tabindex="0">
                                ${D(l,{size:18,title:p(l)})}
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
                        aria-label="${r(p(l))}"
                    >
                </td>
            </tr>
        `).join("")}function Ue(e={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let t=I(e);n.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,t):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(N(a))}" aria-label="${r(N(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(X(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(c)}"
                            data-aspect-color="${a}"
                            aria-label="${r(N(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Je(e={}){let n=document.getElementById("accountElementPaletteBody"),t=document.getElementById("accountBodyOverrideColorsBody");if(!n||!t)return;let o=I(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0);let d=document.getElementById("accountExactAspectHighlightToggle");d&&(d.checked=o?.wheel?.highlight_exact_aspects!==!1),n.innerHTML=Object.keys(a).map(i=>`
            <tr>
                <th scope="row">${r(i)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[i])}" data-element-color="${i}" aria-label="${r(i)}"></td>
            </tr>
        `).join(""),t.innerHTML=H().map(i=>{let l=Ce(i,o),f=!!c?.[i],u=c?.[i]||l;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(i))}" aria-label="${r(p(i))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(le(i))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${r(u)}"
                                data-body-color-override="${i}"
                                data-body-color-active="${f?"true":"false"}"
                                data-body-color-default="${r(l)}"
                                aria-label="${r(p(i))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${f?"":" is-muted"}"
                                data-clear-body-color-override="${i}"
                                title="${r(m("common.reset"))}"
                                aria-label="${r(`${m("common.reset")}: ${p(i)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function G(e,{updateBaseline:n=!1}={}){let t={...me(),...e||{},chart_defaults:{natal:E(e?.chart_defaults?.natal||{}),biwheel:E(e?.chart_defaults?.biwheel||{}),forecast_new:E(e?.chart_defaults?.forecast_new||{}),solar:E(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:v(e?.methodology||x()),visual:I(e?.visual||ge())};h=t,n&&(se=R(t.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),Q.includes(y)||(y="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let a=t.chart_defaults.natal?.view_options||{},c=t.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let d=document.getElementById("accountHouseNumberStyleSelect");d&&(d.value=a.house_number_style==="roman"?"roman":"arabic");let i=document.getElementById("accountHouseLabelsOutsideToggle");i&&(i.checked=a.house_labels_outside===!0);let l=document.getElementById("accountShowAspectTextToggle");l&&(l.checked=c.show_aspect_text===!0);let f=document.getElementById("accountAngularCuspsBoldToggle");f&&(f.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let u=pe();u&&(u.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let g=fe();if(g){let $=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(t.visual?.date_format)?t.visual.date_format:"DD_MM_YYYY";g.value=$}let b=ye();if(b){let $=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(t.visual?.degree_format)?t.visual.degree_format:"DEGREES_ONLY";b.value=$}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=t.methodology?.orbs?.pair_strategy||q);let A=document.getElementById("accountStationaryThresholdPercent");A&&(A.value=String(t.methodology?.stationary?.threshold_percent??5)),K.forEach($=>{let L=t.chart_defaults[$],_=he($);_.orientation&&(_.orientation.value=L.view_options?.orientation==="asc"?"asc":"aries"),_.aspectScope&&(_.aspectScope.value=L.aspects?.scope||($==="biwheel"?"major":"all")),_.showApplyingSeparating&&(_.showApplyingSeparating.checked=L.aspects?.show_applying_separating===!0),_.showSpeed&&(_.showSpeed.checked=L.table_options?.show_speed!==!1),_.showStationary&&(_.showStationary.checked=L.table_options?.show_stationary!==!1),_.showAspectText&&(_.showAspectText.checked=L.table_options?.show_aspect_text===!0)}),Ve(t.chart_defaults),Ye(t.chart_defaults),te(t.methodology),_e(t.methodology),je(t.methodology),Ue(t.visual),Je(t.visual)}function Ge(e){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(t=>{t.checked&&t.dataset.aspectType&&n.push(t.dataset.aspectType)}),n.length?n:C().map(t=>t.aspect_type)}function We(e){let n=de({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(t=>{let o=t.dataset.matrixBody,a=t.dataset.matrixField;!o||!a||(n[o]={...n[o]||{display:!0,aspecting:!0},[a]:t.checked})}),n}function gt(e){let n=he(e);return{matrix:{rows:We(e)},aspects:{scope:n.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:Ge(e),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function Ke(){ee();let n=(v(h?.methodology||x())?.orbs||{})?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(t[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),v({orbs:{version:2,pair_strategy:ke(),profiles:n},balances:{version:1,planet_weights:t,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:F(h?.methodology?.dignities||Z(),S?.default_dignities||{})})}function Qe(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let t={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(t[a]=c)}),I({aspect_colors:e,planet_colors:{element_palette:n,body_overrides:t},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:pe()?.value||"UTC",date_format:fe()?.value||"DD_MM_YYYY",degree_format:ye()?.value||"DEGREES_ONLY"})}function Xe(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",n=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",t=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:n,house_labels_outside:t,bold_asc_dsc:a,bold_mc_ic:a}}}function Ze(){let e=Xe();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:R(e),biwheel:R(e),forecast_new:R(e),solar:R(e)},methodology:Ke(),visual:Qe()}}function B(e,n="info"){let t=document.getElementById("accountSettingsToast");!t||!e||(t.textContent=e,t.className=`toast ${n}`,requestAnimationFrame(()=>t.classList.add("visible")),clearTimeout(ce),ce=setTimeout(()=>{t.classList.remove("visible")},2800))}function Ae(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function et(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function W(e,{final:n=!1}={}){let t=document.getElementById("methodologyJobStatus");if(!t)return;if(!e){t.classList.add("hidden"),t.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),d=Number(e.failed_count||0),i={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:d?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:d?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},f=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];d&&f.push(`ошибок: ${d}`),!n&&s!=="completed"&&s!=="failed"&&f.push("можно остаться на странице и дождаться завершения"),t.innerHTML=`
            <div class="account-settings-status-title">
                <span>${r(i[s]||"Пересчет карт")}</span>
                <span>${r(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${r(f.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,t.classList.remove("hidden"),t.dataset.status=s}function ne(){O&&(clearTimeout(O),O=null)}async function Be(e){if(ne(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(z,String(e));let n=async()=>{try{let t=await window.AstroAPI.getPreferenceRecalcJob(e);if(W(t,{final:t.status==="completed"||t.status==="failed"}),t.status==="completed"){sessionStorage.removeItem(z),B(t.failed_count?`Пересчет завершен с ошибками: ${t.failed_count}.`:"Пересчет карт завершен.",t.failed_count?"info":"success"),await et(),ne();return}if(t.status==="failed"){sessionStorage.removeItem(z),B(t.error||"Пересчет карт не выполнен.","error"),ne();return}O=setTimeout(n,2500)}catch(t){O=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",t)}};await n()}async function tt(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let n=document.getElementById("accountSettingsSubtitle");n&&(n.textContent=e.email?m("page.accountSettings.subtitleWithEmail",{email:e.email}):m("page.accountSettings.subtitle")),Te(e);let[t,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);S=t||null,G(o,{updateBaseline:!0});let a=sessionStorage.getItem(z);a?Be(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):W(null),re()}async function nt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let n=Ze(),t=localStorage.getItem("currentUserId")||null,o=!Me(v(se||{}),n.methodology),a=(h?.chart_creation_defaults?.house_system||"P")!==(n.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(n);if(G(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...t?{priority_user_id:t}:{}}});W(s),Be(s.job_id).catch(d=>{console.warn("Failed to poll methodology recalculation job:",d)}),B("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Ae);return}B(m("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Ae)}catch(n){B(n.message||m("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ot(){G(me()),W(null),B(m("page.accountSettings.toasts.restored"),"info")}function V({restoreFocus:e=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),t&&t.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&j instanceof HTMLElement&&j.focus(),j=null}function at(){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),t=document.getElementById("accountSettingsResetConfirmSubmit");!e||!n||(j=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{t?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{k=localStorage.getItem(ae)==="compact"?"compact":"default",ve();let e=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),t=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),d=document.getElementById("accountSettingsResetConfirmBackdrop"),i=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),f=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{nt()}),n?.addEventListener("click",()=>{at()}),d?.addEventListener("click",()=>{V()}),i?.addEventListener("click",()=>{V()}),l?.addEventListener("click",()=>{V()}),f?.addEventListener("click",()=>{V({restoreFocus:!1}),ot()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{Fe(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{He(u.dataset.orbViewMode||"default")})}),t?.addEventListener("click",()=>{if(y==="natal")return;ee();let u=P();u.orbs.profiles[y]={matrix:JSON.parse(JSON.stringify(Oe("natal")))},te(u),B(m("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let b=P(),A=(b.orbs.profiles[y]||{matrix:M(y)}).matrix||M(y);A[g.dataset.orbAspectType]||(A[g.dataset.orbAspectType]={}),A[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,b.orbs.profiles[y]={matrix:A}}),a?.addEventListener("click",u=>{let g=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let b=g.dataset.dignityMode,w=g.dataset.dignitySign,A=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!b||!w||!A||b==="derived"||(b==="domicile"?qe(w,A):b==="exaltation"&&ze(w,A),_e(h?.methodology||P()))}),c?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",u=>{let g=u.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let b=g.dataset.clearBodyColorOverride;if(!b)return;let w=c.querySelector(`[data-body-color-override="${b}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await tt(),document.addEventListener("frontend:locale-changed",()=>{h&&G(h)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!s||s.classList.contains("hidden")||V())})}catch(u){B(u.message||m("page.accountSettings.toasts.loadFailed"),"error"),re()}})})();
