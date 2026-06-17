import{a as lt}from"./chunks/chunk-RCMFJB7N.js";import"./chunks/chunk-YBGVRB7X.js";import{b as q,d as st,e as ct,f as rt,g as it}from"./chunks/chunk-PL4KSZZB.js";var mt=q(st()),pt=q(ct()),ft=q(rt());var bt=q(it()),ht=q(lt());(function(){"use strict";let K=["natal","biwheel","solar"],oe=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],Q=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],H=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",z="activePreferenceRecalcJobId",ae="accountOrbViewMode",Ee=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),b=null,se=null,S=null,ce=null,O=null,f="natal",k="default",j=null;function re(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function m(e,t){return window.FrontendI18n?.t?.(e,t)||e}function ve(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{};e.href=t.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function T(e,t=""){let n=m(e);return n&&n!==e?n:t}function Pe(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function xe(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?m("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):m("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function ie(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function $e(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?m("page.accountSettings.plan.billingCancelsAt",{date:ie(t.current_period_end)}):t.current_period_end?m("page.accountSettings.plan.billingRenewsAt",{date:ie(t.current_period_end)}):m(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:m("page.accountSettings.plan.billingFree")}function Te(e){let t=document.getElementById("accountPlanCard");if(!t)return;let n=Pe(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage"),s=document.getElementById("accountPlanBillingStatus"),r=document.getElementById("accountPlanPortalBtn");if(o&&(o.textContent=m(`page.plan.names.${n}`)),a&&(a.textContent=m(`page.plan.descriptions.${n}`)),c&&(c.textContent=xe(e)),s&&(s.textContent=$e(e)),r){let u=!!e?.billing?.subscription;r.classList.toggle("hidden",!u),r.onclick=async()=>{try{r.disabled=!0;let l=await window.AstroAPI.getBillingPortal();l?.portal_url&&(window.location.href=l.portal_url)}catch(l){A(l.message||m("page.plan.modal.errors.portalFailed"),"error")}finally{r.disabled=!1}}}t.dataset.planCode=n}function p(e){return T(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function le(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function D(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${i(le(e))}</span>`}function Ie(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=S?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=U().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function Ce(e,t={}){let n=I(t),o=Ie(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function N(e){return T(`astro.aspect.${e}`,e)}function X(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Me(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function F(e){return e==null?e:JSON.parse(JSON.stringify(e))}function E(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function v(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function R(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function I(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function de(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Le(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return S?.aspect_types||oe.map(e=>({aspect_type:e}))}function dt(e){return C().find(t=>t?.aspect_type===e)||null}function V(){return(S?.bodies||[]).map(e=>e?.name).filter(Boolean)}function U(){return S?.signs||[]}function ue(){return V().filter(e=>!Ee.has(e))}function M(e="natal"){let t=C(),n=V();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function x(){let e={version:2,pair_strategy:H,profiles:Object.fromEntries(Q.map(t=>[t,{matrix:M(t)}]))};return v({orbs:e,balances:S?.default_balance_targets||{},dignities:S?.default_dignities||{version:1,signs:{}}})}function ge(){return I(S?.default_visual_palettes||{})}function me(){return{chart_defaults:{natal:E({}),biwheel:E({}),forecast_new:E({}),solar:E({})},chart_creation_defaults:{house_system:"P"},methodology:x(),visual:ge()}}function pe(){return document.getElementById("accountTimezoneLabelFormatSelect")}function fe(){return document.getElementById("accountDateFormatSelect")}function ye(){return document.getElementById("accountDegreeFormatSelect")}function be(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function P(){return b||(b={methodology:x()}),b.methodology=v(b.methodology||x()),b.methodology}function Oe(e){return P()?.orbs?.profiles?.[e]?.matrix||M(e)}function ke(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||H:v(b?.methodology||x())?.orbs?.pair_strategy||H}function he(e){return T(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function De(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ne(e){let t=i(he(e)),n=i(De(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function ut(e){return U().find(t=>t?.name===e)?.opposite||null}function Z(){let e=P();return e.dignities=R(e.dignities||{},S?.default_dignities||{}),e.dignities}function Fe(e={}){let t=ue(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return U().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function J(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return U().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),r=o.has(c),u=["account-settings-dignity-glyph",s?"is-active":"",r?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(he(c)),d=i(`${l} · ${m(s?r?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${d}"
                    aria-label="${d}"
                    ${t==="derived"?"disabled":""}
                >${Ne(c)}</button>
            `}).join("")}function Se(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===f;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=m(`page.accountSettings.orbs.hints.${f}`)),n&&n.classList.toggle("hidden",f==="natal")}function we(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===k;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",k==="compact"),t?.classList.toggle("is-compact",k==="compact")}function ee(){let e=P(),t=M(f);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[f]={matrix:t}}function Re(e,{rerender:t=!0}={}){Q.includes(e)&&(b&&ee(),f=e,Se(),t&&b&&te(b.methodology))}function Ve(e){["default","compact"].includes(e)&&(k=e,localStorage.setItem(ae,e),we())}function Ye(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=C().map(n=>{let o=n.aspect_type,a=i(X(o)),c=i(N(o)),s=K.map(r=>{let u=e?.[r]?.aspects?.enabled_types||[],y=new Set(Array.isArray(u)&&u.length?u:oe).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${r}"
                                data-aspect-type="${o}"
                                ${y}
                                aria-label="${i(`${T(`page.accountSettings.tables.columns.${r}`,r)}: ${c}`)}"
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
            `}).join(""))}function qe(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=Le().map(n=>{let o=i(p(n)),a=D(n,{size:18,title:p(n)}),c=K.map(s=>{let r=de(e?.[s]?.matrix?.rows||{}),u=r?.[n]?.display!==!1?"checked":"",l=r?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${i(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="aspecting"
                                ${l}
                                aria-label="${i(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function te(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=V(),a=C(),s=v(e||x())?.orbs?.profiles?.[f]?.matrix||M(f);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let u=i(p(r)),l=D(r,{size:18,title:p(r)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${u}" aria-label="${u}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(r=>{let u=r.aspect_type,l=i(X(u)),y=i(N(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(d=>{let g=s?.[u]?.[d],h=i(p(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(g))?Number(g):Number(r.base_orb||5)}"
                                    aria-label="${i(`${y} · ${h}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${f}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Se(),we()}function _e(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=R(e?.dignities||{},S?.default_dignities||{}),o=Fe(n);t.innerHTML=ue().map(a=>{let c=i(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
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
            `}).join("")}function He(e,t){let n=Z(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,P().dignities=R(n,S?.default_dignities||{})}function ze(e,t){let n=Z(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,P().dignities=R(n,S?.default_dignities||{})}function je(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},r=V().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=r.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(l))}" aria-label="${i(p(l))}" role="img" tabindex="0">
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
                        aria-label="${i(p(l))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=u.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(l))}" aria-label="${i(p(l))}" role="img" tabindex="0">
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
                        aria-label="${i(p(l))}"
                    >
                </td>
            </tr>
        `).join("")}function Ue(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=I(e);t.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(N(a))}" aria-label="${i(N(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(X(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${i(c)}"
                            data-aspect-color="${a}"
                            aria-label="${i(N(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Je(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!t||!n)return;let o=I(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0),t.innerHTML=Object.keys(a).map(r=>`
            <tr>
                <th scope="row">${i(r)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[r])}" data-element-color="${r}" aria-label="${i(r)}"></td>
            </tr>
        `).join(""),n.innerHTML=V().map(r=>{let u=Ce(r,o),l=!!c?.[r],y=c?.[r]||u;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(r))}" aria-label="${i(p(r))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(le(r))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(y)}"
                                data-body-color-override="${r}"
                                data-body-color-active="${l?"true":"false"}"
                                data-body-color-default="${i(u)}"
                                aria-label="${i(p(r))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${l?"":" is-muted"}"
                                data-clear-body-color-override="${r}"
                                title="${i(m("common.reset"))}"
                                aria-label="${i(`${m("common.reset")}: ${p(r)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function G(e,{updateBaseline:t=!1}={}){let n={...me(),...e||{},chart_defaults:{natal:E(e?.chart_defaults?.natal||{}),biwheel:E(e?.chart_defaults?.biwheel||{}),forecast_new:E(e?.chart_defaults?.forecast_new||{}),solar:E(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:v(e?.methodology||x()),visual:I(e?.visual||ge())};b=n,t&&(se=F(n.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(n.visual),Q.includes(f)||(f="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=n.chart_creation_defaults.house_system||"P");let a=n.chart_defaults.natal?.view_options||{},c=n.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let r=document.getElementById("accountHouseNumberStyleSelect");r&&(r.value=a.house_number_style==="roman"?"roman":"arabic");let u=document.getElementById("accountHouseLabelsOutsideToggle");u&&(u.checked=a.house_labels_outside===!0);let l=document.getElementById("accountShowAspectTextToggle");l&&(l.checked=c.show_aspect_text===!0);let y=document.getElementById("accountAngularCuspsBoldToggle");y&&(y.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let d=pe();d&&(d.value=n.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let g=fe();if(g){let $=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(n.visual?.date_format)?n.visual.date_format:"DD_MM_YYYY";g.value=$}let h=ye();if(h){let $=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(n.visual?.degree_format)?n.visual.degree_format:"DEGREES_ONLY";h.value=$}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=n.methodology?.orbs?.pair_strategy||H);let B=document.getElementById("accountStationaryThresholdPercent");B&&(B.value=String(n.methodology?.stationary?.threshold_percent??5)),K.forEach($=>{let L=n.chart_defaults[$],_=be($);_.orientation&&(_.orientation.value=L.view_options?.orientation==="asc"?"asc":"aries"),_.aspectScope&&(_.aspectScope.value=L.aspects?.scope||($==="biwheel"?"major":"all")),_.showApplyingSeparating&&(_.showApplyingSeparating.checked=L.aspects?.show_applying_separating===!0),_.showSpeed&&(_.showSpeed.checked=L.table_options?.show_speed!==!1),_.showStationary&&(_.showStationary.checked=L.table_options?.show_stationary!==!1),_.showAspectText&&(_.showAspectText.checked=L.table_options?.show_aspect_text===!0)}),Ye(n.chart_defaults),qe(n.chart_defaults),te(n.methodology),_e(n.methodology),je(n.methodology),Ue(n.visual),Je(n.visual)}function Ge(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:C().map(n=>n.aspect_type)}function We(e){let t=de({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function gt(e){let t=be(e);return{matrix:{rows:We(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:Ge(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function Ke(){ee();let t=(v(b?.methodology||x())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),v({orbs:{version:2,pair_strategy:ke(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:R(b?.methodology?.dignities||Z(),S?.default_dignities||{})})}function Qe(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),I({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0},timezone_label_format:pe()?.value||"UTC",date_format:fe()?.value||"DD_MM_YYYY",degree_format:ye()?.value||"DEGREES_ONLY"})}function Xe(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",n=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:t,house_labels_outside:n,bold_asc_dsc:a,bold_mc_ic:a}}}function Ze(){let e=Xe();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:F(e),biwheel:F(e),forecast_new:F(e),solar:F(e)},methodology:Ke(),visual:Qe()}}function A(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(ce),ce=setTimeout(()=>{n.classList.remove("visible")},2800))}function Be(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function et(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function W(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),r=Number(e.failed_count||0),u={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:r?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:r?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},y=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];r&&y.push(`ошибок: ${r}`),!t&&s!=="completed"&&s!=="failed"&&y.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(u[s]||"Пересчет карт")}</span>
                <span>${i(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(y.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function ne(){O&&(clearTimeout(O),O=null)}async function Ae(e){if(ne(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(z,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(W(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(z),A(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await et(),ne();return}if(n.status==="failed"){sessionStorage.removeItem(z),A(n.error||"Пересчет карт не выполнен.","error"),ne();return}O=setTimeout(t,2500)}catch(n){O=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function tt(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?m("page.accountSettings.subtitleWithEmail",{email:e.email}):m("page.accountSettings.subtitle")),Te(e);let[n,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);S=n||null,G(o,{updateBaseline:!0});let a=sessionStorage.getItem(z);a?Ae(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):W(null),re()}async function nt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=Ze(),n=localStorage.getItem("currentUserId")||null,o=!Me(v(se||{}),t.methodology),a=(b?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(G(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});W(s),Ae(s.job_id).catch(r=>{console.warn("Failed to poll methodology recalculation job:",r)}),A("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Be);return}A(m("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Be)}catch(t){A(t.message||m("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ot(){G(me()),W(null),A(m("page.accountSettings.toasts.restored"),"info")}function Y({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&j instanceof HTMLElement&&j.focus(),j=null}function at(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(j=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{k=localStorage.getItem(ae)==="compact"?"compact":"default",ve();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),r=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),y=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{nt()}),t?.addEventListener("click",()=>{at()}),r?.addEventListener("click",()=>{Y()}),u?.addEventListener("click",()=>{Y()}),l?.addEventListener("click",()=>{Y()}),y?.addEventListener("click",()=>{Y({restoreFocus:!1}),ot()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{Re(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{Ve(d.dataset.orbViewMode||"default")})}),n?.addEventListener("click",()=>{if(f==="natal")return;ee();let d=P();d.orbs.profiles[f]={matrix:JSON.parse(JSON.stringify(Oe("natal")))},te(d),A(m("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let g=d.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let h=P(),B=(h.orbs.profiles[f]||{matrix:M(f)}).matrix||M(f);B[g.dataset.orbAspectType]||(B[g.dataset.orbAspectType]={}),B[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,h.orbs.profiles[f]={matrix:B}}),a?.addEventListener("click",d=>{let g=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let h=g.dataset.dignityMode,w=g.dataset.dignitySign,B=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!w||!B||h==="derived"||(h==="domicile"?He(w,B):h==="exaltation"&&ze(w,B),_e(b?.methodology||P()))}),c?.addEventListener("input",d=>{let g=d.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let g=d.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let h=g.dataset.clearBodyColorOverride;if(!h)return;let w=c.querySelector(`[data-body-color-override="${h}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await tt(),document.addEventListener("frontend:locale-changed",()=>{b&&G(b)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||Y())})}catch(d){A(d.message||m("page.accountSettings.toasts.loadFailed"),"error"),re()}})})();
