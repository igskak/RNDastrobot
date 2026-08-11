import{a as Pt}from"./chunks/chunk-MTRUVDHY.js";import"./chunks/chunk-KKNUCR44.js";import"./chunks/chunk-75N2LNQG.js";import{a as vt}from"./chunks/chunk-6WUMBF2I.js";import{a as Bt}from"./chunks/chunk-6SCZ5FYB.js";import{a as _t,b as At,c as Et}from"./chunks/chunk-HX7TNMQQ.js";import{a as wt,b as V}from"./chunks/chunk-IZUYVIPG.js";var Fe=wt(($t,ge)=>{(function(L,N){let I=N();L.AccountSettingsModel=I,typeof ge<"u"&&ge.exports&&(ge.exports=I)})(typeof window<"u"?window:globalThis,function(){"use strict";let L=["natal","biwheel","forecast_new","solar"];function N(S){return!!S&&typeof S=="object"&&!Array.isArray(S)}function I(S){return S==null?S:JSON.parse(JSON.stringify(S))}function M(S,O){let E=N(S)?I(S):{};return Object.entries(O||{}).forEach(([b,P])=>{E[b]=N(P)?M(E[b],P):I(P)}),E}function H(S={},O=E=>E||{}){let E=S?.forecast_new,b=N(E)&&Object.keys(E).length>0;return{single:O(S?.natal||{}),double:O(b?E:S?.biwheel||{})}}function Y(S={},O={},E={},b={}){return Object.fromEntries(L.map(P=>{let G=P==="natal"||P==="solar"?E:b;return[P,M(M(S?.[P]||{},O),G)]}))}return{TECHNICAL_VIEW_IDS:L,deepMerge:M,buildUiChartDefaults:H,buildTechnicalChartDefaults:Y}})});var Tt=V(_t()),Lt=V(At()),It=V(Et()),Mt=V(Bt()),Ot=V(vt()),Dt=V(Fe()),kt=V(Pt());(function(){"use strict";let L=["single","double"],N=["aspects","elements","planets","houses"],I=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],M=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],H=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",Y="activePreferenceRecalcJobId",S="accountOrbViewMode",O=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),E=new Set(["ASC","DSC","MC","IC","Vertex","AntiVertex"]),b=null,P=null,G=null,se="chart",B=null,we=null,K=null,A="natal",Q="default",ce="aspects",re=null;function _e(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function f(e,t){return window.FrontendI18n?.t?.(e,t)||e}function qe(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{},n="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(n=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{n=""}e.href=n||window.AstroAPI?.getAccountSettingsReturnUrl?.()||t.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function F(e,t=""){let n=f(e);return n&&n!==e?n:t}function Ve(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function He(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?f("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):f("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function Ae(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function Ye(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?f("page.accountSettings.plan.billingCancelsAt",{date:Ae(t.current_period_end)}):t.current_period_end?f("page.accountSettings.plan.billingRenewsAt",{date:Ae(t.current_period_end)}):f(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:f("page.accountSettings.plan.billingFree")}function je(e){let t=document.getElementById("accountPlanCard"),n=window.AstroAPI?.isSoloPlan?.(e)===!0,o=document.querySelector('[data-settings-tab="billing"]'),a=document.querySelector('[data-settings-panel="billing"]');if(o&&(o.hidden=n),n&&se==="billing"?ne("chart"):a&&ne(se),!t||(t.classList.toggle("hidden",n),n))return;let c=Ve(e),s=document.getElementById("accountPlanTitle"),l=document.getElementById("accountPlanCopy"),u=document.getElementById("accountPlanUsage"),r=document.getElementById("accountPlanBillingStatus"),m=document.getElementById("accountPlanPortalBtn");if(s&&(s.textContent=f(`page.plan.names.${c}`)),l&&(l.textContent=f(`page.plan.descriptions.${c}`)),u&&(u.textContent=He(e)),r&&(r.textContent=Ye(e)),m){let y=!!e?.billing?.subscription;m.classList.toggle("hidden",!y),m.onclick=async()=>{try{m.disabled=!0;let h=await window.AstroAPI.getBillingPortal();h?.portal_url&&(window.location.href=h.portal_url)}catch(h){C(h.message||f("page.plan.modal.errors.portalFailed"),"error")}finally{m.disabled=!1}}}t.dataset.planCode=c}function w(e){return F(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function Ue(e){return F(`astro.element.${e}`,e)}function ze(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function j(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,{opticalCenter:!0,...t})||`<span class="astro-symbol" aria-hidden="true">${i(ze(e))}</span>`}function Je(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=B?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=le().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function We(e,t={}){let n=U(t),o=Je(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function X(e){return F(`astro.aspect.${e}`,e)}function me(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Ee(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function ie(e){return e==null?e:JSON.parse(JSON.stringify(e))}function x(e,t){if(window.AccountSettingsModel?.deepMerge)return window.AccountSettingsModel.deepMerge(e,t);let n=e&&typeof e=="object"&&!Array.isArray(e)?ie(e):{};return Object.entries(t||{}).forEach(([o,a])=>{if(a&&typeof a=="object"&&!Array.isArray(a)){n[o]=x(n[o],a);return}n[o]=ie(a)}),n}function $(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function D(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function Z(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function U(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function Be(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Ge(){return window.AstroPreferences?.MATRIX_BODIES||[]}function z(){return B?.aspect_types||I.map(e=>({aspect_type:e}))}function Ct(e){return z().find(t=>t?.aspect_type===e)||null}function ee(){return(B?.bodies||[]).map(e=>e?.name).filter(Boolean)}function le(){return B?.signs||[]}function ve(){return ee().filter(e=>!O.has(e))}function J(e="natal"){let t=z(),n=[...ee(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"];return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function q(){let e={version:2,pair_strategy:H,profiles:Object.fromEntries(M.map(t=>[t,{matrix:J(t)}]))};return D({orbs:e,balances:B?.default_balance_targets||{},dignities:B?.default_dignities||{version:1,signs:{}}})}function Pe(){return U(B?.default_visual_palettes||{})}function pe(){return{chart_defaults:{natal:$({}),biwheel:$({}),forecast_new:$({}),solar:$({})},chart_creation_defaults:{house_system:"P"},methodology:q(),visual:Pe()}}function Ce(){return document.getElementById("accountTimezoneLabelFormatSelect")}function xe(){return document.getElementById("accountDateFormatSelect")}function $e(){return document.getElementById("accountDegreeFormatSelect")}function Te(e){return e==="single"?{showApplyingSeparating:document.getElementById("singleShowApplyingSeparating"),showSpeed:document.getElementById("singleShowSpeed"),showStationary:document.getElementById("singleShowStationary"),showAspectText:document.getElementById("singleShowAspectText")}:{showApplyingSeparating:document.getElementById("doubleShowApplyingSeparating"),showSpeed:document.getElementById("doubleShowSpeed"),showStationary:document.getElementById("doubleShowStationary"),showAspectText:document.getElementById("doubleShowAspectText")}}function k(){return b||(b={methodology:q()}),b.methodology=D(b.methodology||q()),b.methodology}function Ke(e){return k()?.orbs?.profiles?.[e]?.matrix||J(e)}function Qe(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||H:D(b?.methodology||q())?.orbs?.pair_strategy||H}function Le(e){return F(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Xe(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ze(e){let t=i(Le(e)),n=i(Xe(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function xt(e){return le().find(t=>t?.name===e)?.opposite||null}function fe(){let e=k();return e.dignities=Z(e.dignities||{},B?.default_dignities||{}),e.dignities}function et(e={}){let t=ve(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return le().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function de(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return le().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),l=o.has(c),u=["account-settings-dignity-glyph",s?"is-active":"",l?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),r=i(Le(c)),y=i(`${r} · ${f(s?l?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${y}"
                    aria-label="${y}"
                    ${t==="derived"?"disabled":""}
                >${Ze(c)}</button>
            `}).join("")}function Ie(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===A;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=f(`page.accountSettings.orbs.hints.${A}`)),n&&n.classList.toggle("hidden",A==="natal")}function Me(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===Q;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",Q==="compact"),t?.classList.toggle("is-compact",Q==="compact")}function Oe(e){N.includes(e)&&(ce=e,document.querySelectorAll("[data-visual-tab]").forEach(t=>{let n=t.dataset.visualTab===ce;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.visualPanel!==ce)}))}function ye(){let e=k(),t=J(A);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[A]={matrix:t}}function tt(e,{rerender:t=!0}={}){M.includes(e)&&(b&&ye(),A=e,Ie(),t&&b&&he(b.methodology))}function nt(e){["default","compact"].includes(e)&&(Q=e,localStorage.setItem(S,e),Me())}function ot(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=z().map(n=>{let o=n.aspect_type,a=i(me(o)),c=i(X(o)),s=L.map(l=>{let u=e?.[l]?.aspects?.enabled_types||[],m=new Set(Array.isArray(u)&&u.length?u:I).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${o}"
                                ${m}
                                aria-label="${i(`${F(`page.accountSettings.tables.columns.${l}`,l)}: ${c}`)}"
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
            `}).join(""))}function at(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=Ge().map(n=>{let o=i(w(n)),a=j(n,{size:18,title:w(n)}),c=L.map(s=>{let l=Be(e?.[s]?.matrix?.rows||{}),u=l?.[n]?.display!==!1?"checked":"",r=l?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${i(`${F(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${r}
                                aria-label="${i(`${F(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function he(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=[...ee(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"],a=z(),s=D(e||q())?.orbs?.profiles?.[A]?.matrix||J(A);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(l=>{let u=l===(window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"),r=u?f("page.accountSettings.orbs.cuspsTitle"):w(l),m=i(r),y=u?`<span class="account-settings-orb-cusp-short">${i(f("page.accountSettings.orbs.cuspsShort"))}</span>`:j(l,{size:18,title:r});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                ${y}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(l=>{let u=l.aspect_type,r=i(me(u)),m=i(X(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(y=>{let h=s?.[u]?.[y],d=i(w(y));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(h))?Number(h):Number(l.base_orb||5)}"
                                    aria-label="${i(`${m} · ${d}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${y}"
                                    data-orb-profile="${A}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Ie(),Me()}function De(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=Z(e?.dignities||{},B?.default_dignities||{}),o=et(n);t.innerHTML=ve().map(a=>{let c=i(w(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${j(a,{size:18,title:w(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${de(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${de(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${de(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${de(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function st(e,t){let n=fe(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,k().dignities=Z(n,B?.default_dignities||{})}function ct(e,t){let n=fe(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,k().dignities=Z(n,B?.default_dignities||{})}function rt(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},l=ee().filter(r=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(r)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=l.map(r=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(w(r))}" aria-label="${i(w(r))}" role="img" tabindex="0">
                                ${j(r,{size:18,title:w(r)})}
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
                        value="${Number(a?.[r]??1).toFixed(1)}"
                        data-balance-planet="${r}"
                        aria-label="${i(w(r))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=u.map(r=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(w(r))}" aria-label="${i(w(r))}" role="img" tabindex="0">
                                ${j(r,{size:18,title:w(r)})}
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
                        value="${Number(c?.[r]??0).toFixed(1)}"
                        data-balance-special-point="${r}"
                        aria-label="${i(w(r))}"
                    >
                </td>
            </tr>
        `).join("")}function it(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=U(e);t.innerHTML=z().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(X(a))}" aria-label="${i(X(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(me(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${i(c)}"
                            data-aspect-color="${a}"
                            aria-label="${i(X(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function lt(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountPlanetOverrideColorsBody"),o=document.getElementById("accountHouseOverrideColorsBody");if(!t||!n||!o)return;let a=U(e),c=a?.planet_colors?.element_palette||{},s=a?.planet_colors?.body_overrides||{},l=document.getElementById("accountAngularCuspsBlackToggle");l&&(l.checked=a?.wheel?.angular_cusps_black===!0);let u=document.getElementById("accountExactAspectHighlightToggle");u&&(u.checked=a?.wheel?.highlight_exact_aspects!==!1),t.innerHTML=Object.keys(c).map(y=>{let h=Ue(y);return`
            <tr>
                <th scope="row">${i(h)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(c[y])}" data-element-color="${y}" aria-label="${i(h)}"></td>
            </tr>
        `}).join("");let r=y=>y.map(h=>{let d=We(h,a),g=!!s?.[h],p=s?.[h]||d;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(w(h))}" aria-label="${i(w(h))}" role="img" tabindex="0">
                                ${j(h,{size:18,title:w(h)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(p)}"
                                data-body-color-override="${h}"
                                data-body-color-active="${g?"true":"false"}"
                                data-body-color-default="${i(d)}"
                                aria-label="${i(w(h))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${g?"":" is-muted"}"
                                data-clear-body-color-override="${h}"
                                title="${i(f("common.reset"))}"
                                aria-label="${i(`${f("common.reset")}: ${w(h)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join(""),m=ee();n.innerHTML=r(m.filter(y=>!E.has(y))),o.innerHTML=r(m.filter(y=>E.has(y)))}function te(e,{updateBaseline:t=!1}={}){let n=e?.chart_defaults||{},o={...pe(),...e||{},chart_defaults:{natal:$(e?.chart_defaults?.natal||{}),biwheel:$(e?.chart_defaults?.biwheel||{}),forecast_new:$(e?.chart_defaults?.forecast_new||{}),solar:$(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:D(e?.methodology||q()),visual:U(e?.visual||Pe())};b=o,t&&(P=ie(o.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(o.visual),M.includes(A)||(A="natal");let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=o.chart_creation_defaults.house_system||"P");let c=o.chart_defaults.natal?.view_options||{},s=o.chart_defaults.natal?.aspects||{},l=window.AccountSettingsModel?.buildUiChartDefaults?window.AccountSettingsModel.buildUiChartDefaults(n,$):{single:o.chart_defaults.natal,double:o.chart_defaults.forecast_new},u=document.getElementById("accountOrientationSelect");u&&(u.value=c.orientation==="asc"?"asc":"aries");let r=document.getElementById("accountAspectScopeSelect");r&&(r.value=["major","minor"].includes(s.scope)?s.scope:"all");let m=document.getElementById("accountHouseNumberStyleSelect");m&&(m.value=c.house_number_style==="roman"?"roman":"arabic");let y=document.getElementById("accountHouseLabelsOutsideToggle");y&&(y.checked=c.house_labels_outside===!0);let h=document.getElementById("accountAngularCuspsBoldToggle");h&&(h.checked=c.bold_asc_dsc!==!1&&c.bold_mc_ic!==!1);let d=Ce();d&&(d.value=o.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let g=xe();if(g){let T=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(o.visual?.date_format)?o.visual.date_format:"DD_MM_YYYY";g.value=T}let p=$e();if(p){let T=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(o.visual?.degree_format)?o.visual.degree_format:"DEGREES_ONLY";p.value=T}let v=document.getElementById("accountOrbPairStrategySelect");v&&(v.value=o.methodology?.orbs?.pair_strategy||H);let _=document.getElementById("accountStationaryThresholdPercent");_&&(_.value=String(o.methodology?.stationary?.threshold_percent??5)),L.forEach(T=>{let W=l[T],R=Te(T);R.showApplyingSeparating&&(R.showApplyingSeparating.checked=W.aspects?.show_applying_separating===!0),R.showSpeed&&(R.showSpeed.checked=W.table_options?.show_speed!==!1),R.showStationary&&(R.showStationary.checked=W.table_options?.show_stationary!==!1),R.showAspectText&&(R.showAspectText.checked=W.table_options?.show_aspect_text===!0)}),ot(l),at(l),he(o.methodology),De(o.methodology),rt(o.methodology),it(o.visual),lt(o.visual),t&&(G=ie(be())),ue()}function dt(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:z().map(n=>n.aspect_type)}function ut(e){let t=Be({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function ke(e){let t=Te(e);return{matrix:{rows:ut(e)},aspects:{enabled_types:dt(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0}}}function gt(){ye();let t=(D(b?.methodology||q())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),D({orbs:{version:2,pair_strategy:Qe(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:Z(b?.methodology?.dignities||fe(),B?.default_dignities||{})})}function mt(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),U({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:Ce()?.value||"UTC",date_format:xe()?.value||"DD_MM_YYYY",degree_format:$e()?.value||"DEGREES_ONLY"})}function pt(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountAspectScopeSelect")?.value,n=["major","minor"].includes(t)?t:"all",o=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",a=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,c=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{aspects:{scope:n},view_options:{orientation:e,house_number_style:o,house_labels_outside:a,bold_asc_dsc:c,bold_mc_ic:c}}}function be(){let e=pt(),t=ke("single"),n=ke("double"),o=b?.chart_defaults||pe().chart_defaults,a=window.AccountSettingsModel?.buildTechnicalChartDefaults?window.AccountSettingsModel.buildTechnicalChartDefaults(o,e,t,n):{natal:x(x(o.natal,e),t),solar:x(x(o.solar,e),t),biwheel:x(x(o.biwheel,e),n),forecast_new:x(x(o.forecast_new,e),n)};return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:a,methodology:gt(),visual:mt()}}function C(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(we),we=setTimeout(()=>{n.classList.remove("visible")},2800))}function Re(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function ne(e){let t=document.querySelector(`[data-settings-tab="${e}"]`);(!t||t.hidden)&&(e="chart"),se=e,document.querySelectorAll("[data-settings-tab]").forEach(n=>{let o=n.dataset.settingsTab===e;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false"),n.tabIndex=o?0:-1}),document.querySelectorAll("[data-settings-panel]").forEach(n=>{let o=n.dataset.settingsPanel===e;n.classList.toggle("hidden",!o),n.hidden=!o,n.setAttribute("aria-hidden",o?"false":"true")})}function ue(){if(!G)return;let e=document.getElementById("accountSettingsSaveBar"),t=document.getElementById("accountSettingsSavedIndicator"),n;try{n=!Ee(G,be())}catch{n=!0}e&&e.classList.toggle("hidden",!n),t&&(t.hidden=n)}async function ft(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function oe(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),l=Number(e.failed_count||0),u={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:l?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},r={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:l?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},m=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];l&&m.push(`ошибок: ${l}`),!t&&s!=="completed"&&s!=="failed"&&m.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(u[s]||"Пересчет карт")}</span>
                <span>${i(r[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(m.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function Se(){K&&(clearTimeout(K),K=null)}async function Ne(e){if(Se(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(Y,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(oe(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(Y),C(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await ft(),Se();return}if(n.status==="failed"){sessionStorage.removeItem(Y),C(n.error||"Пересчет карт не выполнен.","error"),Se();return}K=setTimeout(t,2500)}catch(n){K=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function yt(e){let t=Promise.resolve(window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"})),n=Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]),o=await t;if(!o){n.catch(()=>{});return}await Promise.resolve(e);let a=document.getElementById("onboardingResetSetting"),c=["trial","pro"].includes(String(o.plan_code||"").toLowerCase());a?.classList.toggle("onboarding-hidden",!c);let s=document.getElementById("accountSettingsSubtitle");s&&(s.textContent=o.email?f("page.accountSettings.subtitleWithEmail",{email:o.email}):f("page.accountSettings.subtitle")),je(o);let[l,u]=await n;B=l||null,te(u,{updateBaseline:!0});let r=sessionStorage.getItem(Y);r?Ne(r).catch(m=>{console.warn("Failed to resume recalculation job polling:",m)}):oe(null),_e()}async function ht(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=be(),n=localStorage.getItem("currentUserId")||null,o=!Ee(D(P||{}),t.methodology),a=(b?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(te(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});oe(s),Ne(s.job_id).catch(l=>{console.warn("Failed to poll methodology recalculation job:",l)}),C("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Re);return}C(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Re)}catch(t){C(t.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function bt(){te(pe()),oe(null),C(f("page.accountSettings.toasts.restored"),"info")}function ae({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&re instanceof HTMLElement&&re.focus(),re=null}function St(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(re=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{Q=localStorage.getItem(S)==="compact"?"compact":"default",qe();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=Array.from(document.querySelectorAll("#accountPlanetOverrideColorsBody, #accountHouseOverrideColorsBody")),s=document.getElementById("accountSettingsResetConfirmDialog"),l=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),r=document.getElementById("accountSettingsResetConfirmCancel"),m=document.getElementById("accountSettingsResetConfirmSubmit"),y=document.getElementById("onboardingResetBtn"),h=document.getElementById("accountSettingsDiscardBtn");document.querySelectorAll("[data-settings-tab]").forEach(d=>{d.addEventListener("click",()=>{ne(d.dataset.settingsTab||"chart")}),d.addEventListener("keydown",g=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(g.key))return;let p=Array.from(document.querySelectorAll("[data-settings-tab]")).filter(W=>!W.hidden);if(!p.length)return;g.preventDefault();let v=p.indexOf(d),_=g.key==="Home"?0:g.key==="End"?p.length-1:(v+(g.key==="ArrowRight"?1:-1)+p.length)%p.length,T=p[_];ne(T.dataset.settingsTab||"chart"),T.focus()})}),ne(se),document.addEventListener("input",ue),document.addEventListener("change",ue),e?.addEventListener("click",()=>{ht()}),h?.addEventListener("click",()=>{b&&te(b,{updateBaseline:!0}),oe(null)}),t?.addEventListener("click",()=>{St()}),l?.addEventListener("click",()=>{ae()}),u?.addEventListener("click",()=>{ae()}),r?.addEventListener("click",()=>{ae()}),m?.addEventListener("click",()=>{ae({restoreFocus:!1}),bt()}),y?.addEventListener("click",async()=>{y.disabled=!0;try{await window.AstroOnboarding?.reset?.(),window.AstroOnboarding?.trackLearning?.("onboarding_help_reopened",{milestone:"manual_reset",source:"account_settings"},{once:!1}),C(f("page.onboarding.settings.resetDone"),"success")}catch(d){C(d.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{y.disabled=!1}}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{tt(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{nt(d.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(d=>{d.addEventListener("click",()=>{Oe(d.dataset.visualTab||"aspects")})}),Oe(ce),n?.addEventListener("click",()=>{if(A==="natal")return;ye();let d=k();d.orbs.profiles[A]={matrix:JSON.parse(JSON.stringify(Ke("natal")))},he(d),C(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let g=d.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let p=k(),_=(p.orbs.profiles[A]||{matrix:J(A)}).matrix||J(A);_[g.dataset.orbAspectType]||(_[g.dataset.orbAspectType]={}),_[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,p.orbs.profiles[A]={matrix:_}}),a?.addEventListener("click",d=>{let g=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let p=g.dataset.dignityMode,v=g.dataset.dignitySign,_=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!p||!v||!_||p==="derived"||(p==="domicile"?st(v,_):p==="exaltation"&&ct(v,_),De(b?.methodology||k()))}),c.forEach(d=>{d.addEventListener("input",g=>{let p=g.target;if(!(p instanceof HTMLInputElement)||!p.dataset.bodyColorOverride)return;p.dataset.bodyColorActive="true",d.querySelector(`[data-clear-body-color-override="${p.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),d.addEventListener("click",g=>{let p=g.target.closest("[data-clear-body-color-override]");if(!(p instanceof HTMLElement))return;let v=p.dataset.clearBodyColorOverride;if(!v)return;let _=d.querySelector(`[data-body-color-override="${v}"]`);_ instanceof HTMLInputElement&&(_.dataset.bodyColorActive="false",_.value=_.dataset.bodyColorDefault||"#6b7280",p.classList.add("is-muted"),ue())})});try{let d=Promise.resolve(window.FrontendI18n?.ready).catch(()=>{});await yt(d),document.addEventListener("frontend:locale-changed",()=>{b&&te(b)}),document.addEventListener("keydown",g=>{g.key==="Escape"&&(!s||s.classList.contains("hidden")||ae())})}catch(d){C(d.message||f("page.accountSettings.toasts.loadFailed"),"error"),_e()}})})();
