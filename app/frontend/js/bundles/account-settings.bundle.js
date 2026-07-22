import{a as vt}from"./chunks/chunk-MTRUVDHY.js";import"./chunks/chunk-SYPQTWEU.js";import"./chunks/chunk-XCJV446S.js";import{a as Bt}from"./chunks/chunk-6WUMBF2I.js";import{a as Et}from"./chunks/chunk-6SCZ5FYB.js";import{a as wt,b as _t,c as At}from"./chunks/chunk-HX7TNMQQ.js";import{a as St,b as F}from"./chunks/chunk-IZUYVIPG.js";var Fe=St(($t,de)=>{(function(T,N){let L=N();T.AccountSettingsModel=L,typeof de<"u"&&de.exports&&(de.exports=L)})(typeof window<"u"?window:globalThis,function(){"use strict";let T=["natal","biwheel","forecast_new","solar"];function N(S){return!!S&&typeof S=="object"&&!Array.isArray(S)}function L(S){return S==null?S:JSON.parse(JSON.stringify(S))}function I(S,M){let E=N(S)?L(S):{};return Object.entries(M||{}).forEach(([f,v])=>{E[f]=N(v)?I(E[f],v):L(v)}),E}function q(S={},M=E=>E||{}){let E=S?.forecast_new,f=N(E)&&Object.keys(E).length>0;return{single:M(S?.natal||{}),double:M(f?E:S?.biwheel||{})}}function V(S={},M={},E={},f={}){return Object.fromEntries(T.map(v=>{let W=v==="natal"||v==="solar"?E:f;return[v,I(I(S?.[v]||{},M),W)]}))}return{TECHNICAL_VIEW_IDS:T,deepMerge:I,buildUiChartDefaults:q,buildTechnicalChartDefaults:V}})});var xt=F(wt()),Tt=F(_t()),Lt=F(At()),It=F(Et()),Mt=F(Bt()),Ot=F(Fe()),Dt=F(vt());(function(){"use strict";let T=["single","double"],N=["aspects","elements","planets","houses"],L=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],I=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],q=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",V="activePreferenceRecalcJobId",S="accountOrbViewMode",M=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),E=new Set(["ASC","DSC","MC","IC","Vertex","AntiVertex"]),f=null,v=null,W=null,ue="chart",B=null,we=null,G=null,_="natal",K="default",oe="aspects",ae=null;function _e(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function p(e,t){return window.FrontendI18n?.t?.(e,t)||e}function qe(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{},n="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(n=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{n=""}e.href=n||window.AstroAPI?.getAccountSettingsReturnUrl?.()||t.sourceUrl||"/"}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function H(e,t=""){let n=p(e);return n&&n!==e?n:t}function Ve(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function He(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?p("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):p("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function Ae(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function Ye(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?p("page.accountSettings.plan.billingCancelsAt",{date:Ae(t.current_period_end)}):t.current_period_end?p("page.accountSettings.plan.billingRenewsAt",{date:Ae(t.current_period_end)}):p(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:p("page.accountSettings.plan.billingFree")}function je(e){let t=document.getElementById("accountPlanCard"),n=window.AstroAPI?.isSoloPlan?.(e)===!0,o=document.querySelector('[data-settings-tab="billing"]'),a=document.querySelector('[data-settings-panel="billing"]');if(o&&(o.hidden=n),a&&(a.hidden=n),n&&ue==="billing"&&he("chart"),!t||(t.classList.toggle("hidden",n),n))return;let c=Ve(e),s=document.getElementById("accountPlanTitle"),l=document.getElementById("accountPlanCopy"),u=document.getElementById("accountPlanUsage"),i=document.getElementById("accountPlanBillingStatus"),g=document.getElementById("accountPlanPortalBtn");if(s&&(s.textContent=p(`page.plan.names.${c}`)),l&&(l.textContent=p(`page.plan.descriptions.${c}`)),u&&(u.textContent=He(e)),i&&(i.textContent=Ye(e)),g){let m=!!e?.billing?.subscription;g.classList.toggle("hidden",!m),g.onclick=async()=>{try{g.disabled=!0;let b=await window.AstroAPI.getBillingPortal();b?.portal_url&&(window.location.href=b.portal_url)}catch(b){P(b.message||p("page.plan.modal.errors.portalFailed"),"error")}finally{g.disabled=!1}}}t.dataset.planCode=c}function w(e){return H(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function Ue(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function Y(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${r(Ue(e))}</span>`}function ze(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=B?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=ce().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function Je(e,t={}){let n=j(t),o=ze(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function Q(e){return H(`astro.aspect.${e}`,e)}function ge(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Ee(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function se(e){return e==null?e:JSON.parse(JSON.stringify(e))}function $(e,t){if(window.AccountSettingsModel?.deepMerge)return window.AccountSettingsModel.deepMerge(e,t);let n=e&&typeof e=="object"&&!Array.isArray(e)?se(e):{};return Object.entries(t||{}).forEach(([o,a])=>{if(a&&typeof a=="object"&&!Array.isArray(a)){n[o]=$(n[o],a);return}n[o]=se(a)}),n}function x(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function O(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function X(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function j(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function Be(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function We(){return window.AstroPreferences?.MATRIX_BODIES||[]}function U(){return B?.aspect_types||L.map(e=>({aspect_type:e}))}function Pt(e){return U().find(t=>t?.aspect_type===e)||null}function Z(){return(B?.bodies||[]).map(e=>e?.name).filter(Boolean)}function ce(){return B?.signs||[]}function ve(){return Z().filter(e=>!M.has(e))}function z(e="natal"){let t=U(),n=[...Z(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"];return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function R(){let e={version:2,pair_strategy:q,profiles:Object.fromEntries(I.map(t=>[t,{matrix:z(t)}]))};return O({orbs:e,balances:B?.default_balance_targets||{},dignities:B?.default_dignities||{version:1,signs:{}}})}function Pe(){return j(B?.default_visual_palettes||{})}function me(){return{chart_defaults:{natal:x({}),biwheel:x({}),forecast_new:x({}),solar:x({})},chart_creation_defaults:{house_system:"P"},methodology:R(),visual:Pe()}}function Ce(){return document.getElementById("accountTimezoneLabelFormatSelect")}function $e(){return document.getElementById("accountDateFormatSelect")}function xe(){return document.getElementById("accountDegreeFormatSelect")}function Te(e){return e==="single"?{showApplyingSeparating:document.getElementById("singleShowApplyingSeparating"),showSpeed:document.getElementById("singleShowSpeed"),showStationary:document.getElementById("singleShowStationary"),showAspectText:document.getElementById("singleShowAspectText")}:{showApplyingSeparating:document.getElementById("doubleShowApplyingSeparating"),showSpeed:document.getElementById("doubleShowSpeed"),showStationary:document.getElementById("doubleShowStationary"),showAspectText:document.getElementById("doubleShowAspectText")}}function D(){return f||(f={methodology:R()}),f.methodology=O(f.methodology||R()),f.methodology}function Ge(e){return D()?.orbs?.profiles?.[e]?.matrix||z(e)}function Ke(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||q:O(f?.methodology||R())?.orbs?.pair_strategy||q}function Le(e){return H(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Qe(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Xe(e){let t=r(Le(e)),n=r(Qe(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function Ct(e){return ce().find(t=>t?.name===e)?.opposite||null}function pe(){let e=D();return e.dignities=X(e.dignities||{},B?.default_dignities||{}),e.dignities}function Ze(e={}){let t=ve(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return ce().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function ie(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return ce().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),l=o.has(c),u=["account-settings-dignity-glyph",s?"is-active":"",l?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),i=r(Le(c)),m=r(`${i} · ${p(s?l?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${m}"
                    aria-label="${m}"
                    ${t==="derived"?"disabled":""}
                >${Xe(c)}</button>
            `}).join("")}function Ie(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===_;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${_}`)),n&&n.classList.toggle("hidden",_==="natal")}function Me(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===K;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",K==="compact"),t?.classList.toggle("is-compact",K==="compact")}function Oe(e){N.includes(e)&&(oe=e,document.querySelectorAll("[data-visual-tab]").forEach(t=>{let n=t.dataset.visualTab===oe;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.visualPanel!==oe)}))}function fe(){let e=D(),t=z(_);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[_]={matrix:t}}function et(e,{rerender:t=!0}={}){I.includes(e)&&(f&&fe(),_=e,Ie(),t&&f&&ye(f.methodology))}function tt(e){["default","compact"].includes(e)&&(K=e,localStorage.setItem(S,e),Me())}function nt(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=U().map(n=>{let o=n.aspect_type,a=r(ge(o)),c=r(Q(o)),s=T.map(l=>{let u=e?.[l]?.aspects?.enabled_types||[],g=new Set(Array.isArray(u)&&u.length?u:L).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${o}"
                                ${g}
                                aria-label="${r(`${H(`page.accountSettings.tables.columns.${l}`,l)}: ${c}`)}"
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
            `}).join(""))}function ot(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=We().map(n=>{let o=r(w(n)),a=Y(n,{size:18,title:w(n)}),c=T.map(s=>{let l=Be(e?.[s]?.matrix?.rows||{}),u=l?.[n]?.display!==!1?"checked":"",i=l?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${r(`${H(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${i}
                                aria-label="${r(`${H(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function ye(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=[...Z(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"],a=U(),s=O(e||R())?.orbs?.profiles?.[_]?.matrix||z(_);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(l=>{let u=l===(window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"),i=u?p("page.accountSettings.orbs.cuspsTitle"):w(l),g=r(i),m=u?`<span class="account-settings-orb-cusp-short">${r(p("page.accountSettings.orbs.cuspsShort"))}</span>`:Y(l,{size:18,title:i});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${g}" aria-label="${g}" role="img" tabindex="0">
                                ${m}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(l=>{let u=l.aspect_type,i=r(ge(u)),g=r(Q(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${g}" aria-label="${g}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(m=>{let b=s?.[u]?.[m],d=r(w(m));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(b))?Number(b):Number(l.base_orb||5)}"
                                    aria-label="${r(`${g} · ${d}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${m}"
                                    data-orb-profile="${_}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Ie(),Me()}function De(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=X(e?.dignities||{},B?.default_dignities||{}),o=Ze(n);t.innerHTML=ve().map(a=>{let c=r(w(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${Y(a,{size:18,title:w(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${ie(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${ie(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${ie(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${ie(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function at(e,t){let n=pe(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,D().dignities=X(n,B?.default_dignities||{})}function st(e,t){let n=pe(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,D().dignities=X(n,B?.default_dignities||{})}function ct(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},l=Z().filter(i=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(i)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=l.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(w(i))}" aria-label="${r(w(i))}" role="img" tabindex="0">
                                ${Y(i,{size:18,title:w(i)})}
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
                        aria-label="${r(w(i))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=u.map(i=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(w(i))}" aria-label="${r(w(i))}" role="img" tabindex="0">
                                ${Y(i,{size:18,title:w(i)})}
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
                        aria-label="${r(w(i))}"
                    >
                </td>
            </tr>
        `).join("")}function it(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=j(e);t.innerHTML=U().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(Q(a))}" aria-label="${r(Q(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(ge(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(c)}"
                            data-aspect-color="${a}"
                            aria-label="${r(Q(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function rt(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountPlanetOverrideColorsBody"),o=document.getElementById("accountHouseOverrideColorsBody");if(!t||!n||!o)return;let a=j(e),c=a?.planet_colors?.element_palette||{},s=a?.planet_colors?.body_overrides||{},l=document.getElementById("accountAngularCuspsBlackToggle");l&&(l.checked=a?.wheel?.angular_cusps_black===!0);let u=document.getElementById("accountExactAspectHighlightToggle");u&&(u.checked=a?.wheel?.highlight_exact_aspects!==!1),t.innerHTML=Object.keys(c).map(m=>`
            <tr>
                <th scope="row">${r(m)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(c[m])}" data-element-color="${m}" aria-label="${r(m)}"></td>
            </tr>
        `).join("");let i=m=>m.map(b=>{let d=Je(b,a),y=!!s?.[b],h=s?.[b]||d;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(w(b))}" aria-label="${r(w(b))}" role="img" tabindex="0">
                                ${Y(b,{size:18,title:w(b)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${r(h)}"
                                data-body-color-override="${b}"
                                data-body-color-active="${y?"true":"false"}"
                                data-body-color-default="${r(d)}"
                                aria-label="${r(w(b))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${y?"":" is-muted"}"
                                data-clear-body-color-override="${b}"
                                title="${r(p("common.reset"))}"
                                aria-label="${r(`${p("common.reset")}: ${w(b)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join(""),g=Z();n.innerHTML=i(g.filter(m=>!E.has(m))),o.innerHTML=i(g.filter(m=>E.has(m)))}function ee(e,{updateBaseline:t=!1}={}){let n=e?.chart_defaults||{},o={...me(),...e||{},chart_defaults:{natal:x(e?.chart_defaults?.natal||{}),biwheel:x(e?.chart_defaults?.biwheel||{}),forecast_new:x(e?.chart_defaults?.forecast_new||{}),solar:x(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:O(e?.methodology||R()),visual:j(e?.visual||Pe())};f=o,t&&(v=se(o.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(o.visual),I.includes(_)||(_="natal");let a=document.getElementById("accountHouseSystemSelect");a&&(a.value=o.chart_creation_defaults.house_system||"P");let c=o.chart_defaults.natal?.view_options||{},s=o.chart_defaults.natal?.aspects||{},l=window.AccountSettingsModel?.buildUiChartDefaults?window.AccountSettingsModel.buildUiChartDefaults(n,x):{single:o.chart_defaults.natal,double:o.chart_defaults.forecast_new},u=document.getElementById("accountOrientationSelect");u&&(u.value=c.orientation==="asc"?"asc":"aries");let i=document.getElementById("accountAspectScopeSelect");i&&(i.value=["major","minor"].includes(s.scope)?s.scope:"all");let g=document.getElementById("accountHouseNumberStyleSelect");g&&(g.value=c.house_number_style==="roman"?"roman":"arabic");let m=document.getElementById("accountHouseLabelsOutsideToggle");m&&(m.checked=c.house_labels_outside===!0);let b=document.getElementById("accountAngularCuspsBoldToggle");b&&(b.checked=c.bold_asc_dsc!==!1&&c.bold_mc_ic!==!1);let d=Ce();d&&(d.value=o.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let y=$e();if(y){let J=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(o.visual?.date_format)?o.visual.date_format:"DD_MM_YYYY";y.value=J}let h=xe();if(h){let J=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(o.visual?.degree_format)?o.visual.degree_format:"DEGREES_ONLY";h.value=J}let C=document.getElementById("accountOrbPairStrategySelect");C&&(C.value=o.methodology?.orbs?.pair_strategy||q);let A=document.getElementById("accountStationaryThresholdPercent");A&&(A.value=String(o.methodology?.stationary?.threshold_percent??5)),T.forEach(J=>{let le=l[J],k=Te(J);k.showApplyingSeparating&&(k.showApplyingSeparating.checked=le.aspects?.show_applying_separating===!0),k.showSpeed&&(k.showSpeed.checked=le.table_options?.show_speed!==!1),k.showStationary&&(k.showStationary.checked=le.table_options?.show_stationary!==!1),k.showAspectText&&(k.showAspectText.checked=le.table_options?.show_aspect_text===!0)}),nt(l),ot(l),ye(o.methodology),De(o.methodology),ct(o.methodology),it(o.visual),rt(o.visual),t&&(W=se(be())),re()}function lt(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:U().map(n=>n.aspect_type)}function dt(e){let t=Be({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function ke(e){let t=Te(e);return{matrix:{rows:dt(e)},aspects:{enabled_types:lt(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0}}}function ut(){fe();let t=(O(f?.methodology||R())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),O({orbs:{version:2,pair_strategy:Ke(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:X(f?.methodology?.dignities||pe(),B?.default_dignities||{})})}function gt(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),j({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:Ce()?.value||"UTC",date_format:$e()?.value||"DD_MM_YYYY",degree_format:xe()?.value||"DEGREES_ONLY"})}function mt(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountAspectScopeSelect")?.value,n=["major","minor"].includes(t)?t:"all",o=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",a=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,c=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{aspects:{scope:n},view_options:{orientation:e,house_number_style:o,house_labels_outside:a,bold_asc_dsc:c,bold_mc_ic:c}}}function be(){let e=mt(),t=ke("single"),n=ke("double"),o=f?.chart_defaults||me().chart_defaults,a=window.AccountSettingsModel?.buildTechnicalChartDefaults?window.AccountSettingsModel.buildTechnicalChartDefaults(o,e,t,n):{natal:$($(o.natal,e),t),solar:$($(o.solar,e),t),biwheel:$($(o.biwheel,e),n),forecast_new:$($(o.forecast_new,e),n)};return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:a,methodology:ut(),visual:gt()}}function P(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(we),we=setTimeout(()=>{n.classList.remove("visible")},2800))}function Ne(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function he(e){let t=document.querySelector(`[data-settings-tab="${e}"]`);(!t||t.hidden)&&(e="chart"),ue=e,document.querySelectorAll("[data-settings-tab]").forEach(n=>{let o=n.dataset.settingsTab===e;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),document.querySelectorAll("[data-settings-panel]").forEach(n=>{n.classList.toggle("hidden",n.dataset.settingsPanel!==e)})}function re(){if(!W)return;let e=document.getElementById("accountSettingsSaveBar"),t=document.getElementById("accountSettingsSavedIndicator"),n;try{n=!Ee(W,be())}catch{n=!0}e&&e.classList.toggle("hidden",!n),t&&(t.hidden=n)}async function pt(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function te(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),l=Number(e.failed_count||0),u={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:l?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},i={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:l?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},g=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];l&&g.push(`ошибок: ${l}`),!t&&s!=="completed"&&s!=="failed"&&g.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${r(u[s]||"Пересчет карт")}</span>
                <span>${r(i[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${r(g.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function Se(){G&&(clearTimeout(G),G=null)}async function Re(e){if(Se(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(V,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(te(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(V),P(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await pt(),Se();return}if(n.status==="failed"){sessionStorage.removeItem(V),P(n.error||"Пересчет карт не выполнен.","error"),Se();return}G=setTimeout(t,2500)}catch(n){G=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function ft(e){let t=Promise.resolve(window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"})),n=Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]),o=await t;if(!o){n.catch(()=>{});return}await Promise.resolve(e);let a=document.getElementById("onboardingResetSetting"),c=["trial","pro"].includes(String(o.plan_code||"").toLowerCase());a?.classList.toggle("onboarding-hidden",!c);let s=document.getElementById("accountSettingsSubtitle");s&&(s.textContent=o.email?p("page.accountSettings.subtitleWithEmail",{email:o.email}):p("page.accountSettings.subtitle")),je(o);let[l,u]=await n;B=l||null,ee(u,{updateBaseline:!0});let i=sessionStorage.getItem(V);i?Re(i).catch(g=>{console.warn("Failed to resume recalculation job polling:",g)}):te(null),_e()}async function yt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=be(),n=localStorage.getItem("currentUserId")||null,o=!Ee(O(v||{}),t.methodology),a=(f?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(ee(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});te(s),Re(s.job_id).catch(l=>{console.warn("Failed to poll methodology recalculation job:",l)}),P("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Ne);return}P(p("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Ne)}catch(t){P(t.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function bt(){ee(me()),te(null),P(p("page.accountSettings.toasts.restored"),"info")}function ne({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&ae instanceof HTMLElement&&ae.focus(),ae=null}function ht(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(ae=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{K=localStorage.getItem(S)==="compact"?"compact":"default",qe();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=Array.from(document.querySelectorAll("#accountPlanetOverrideColorsBody, #accountHouseOverrideColorsBody")),s=document.getElementById("accountSettingsResetConfirmDialog"),l=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),i=document.getElementById("accountSettingsResetConfirmCancel"),g=document.getElementById("accountSettingsResetConfirmSubmit"),m=document.getElementById("onboardingResetBtn"),b=document.getElementById("accountSettingsDiscardBtn");document.querySelectorAll("[data-settings-tab]").forEach(d=>{d.addEventListener("click",()=>{he(d.dataset.settingsTab||"chart")})}),he(ue),document.addEventListener("input",re),document.addEventListener("change",re),e?.addEventListener("click",()=>{yt()}),b?.addEventListener("click",()=>{f&&ee(f,{updateBaseline:!0}),te(null)}),t?.addEventListener("click",()=>{ht()}),l?.addEventListener("click",()=>{ne()}),u?.addEventListener("click",()=>{ne()}),i?.addEventListener("click",()=>{ne()}),g?.addEventListener("click",()=>{ne({restoreFocus:!1}),bt()}),m?.addEventListener("click",async()=>{m.disabled=!0;try{await window.AstroOnboarding?.reset?.(),window.AstroOnboarding?.trackLearning?.("onboarding_help_reopened",{milestone:"manual_reset",source:"account_settings"},{once:!1}),P(p("page.onboarding.settings.resetDone"),"success")}catch(d){P(d.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{m.disabled=!1}}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{et(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{tt(d.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(d=>{d.addEventListener("click",()=>{Oe(d.dataset.visualTab||"aspects")})}),Oe(oe),n?.addEventListener("click",()=>{if(_==="natal")return;fe();let d=D();d.orbs.profiles[_]={matrix:JSON.parse(JSON.stringify(Ge("natal")))},ye(d),P(p("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let y=d.target;if(!(y instanceof HTMLInputElement)||!y.dataset.orbAspectType||!y.dataset.orbBody)return;let h=D(),A=(h.orbs.profiles[_]||{matrix:z(_)}).matrix||z(_);A[y.dataset.orbAspectType]||(A[y.dataset.orbAspectType]={}),A[y.dataset.orbAspectType][y.dataset.orbBody]=Number.parseFloat(y.value)||0,h.orbs.profiles[_]={matrix:A}}),a?.addEventListener("click",d=>{let y=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(y instanceof HTMLButtonElement))return;let h=y.dataset.dignityMode,C=y.dataset.dignitySign,A=y.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!C||!A||h==="derived"||(h==="domicile"?at(C,A):h==="exaltation"&&st(C,A),De(f?.methodology||D()))}),c.forEach(d=>{d.addEventListener("input",y=>{let h=y.target;if(!(h instanceof HTMLInputElement)||!h.dataset.bodyColorOverride)return;h.dataset.bodyColorActive="true",d.querySelector(`[data-clear-body-color-override="${h.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),d.addEventListener("click",y=>{let h=y.target.closest("[data-clear-body-color-override]");if(!(h instanceof HTMLElement))return;let C=h.dataset.clearBodyColorOverride;if(!C)return;let A=d.querySelector(`[data-body-color-override="${C}"]`);A instanceof HTMLInputElement&&(A.dataset.bodyColorActive="false",A.value=A.dataset.bodyColorDefault||"#6b7280",h.classList.add("is-muted"),re())})});try{let d=Promise.resolve(window.FrontendI18n?.ready).catch(()=>{});await ft(d),document.addEventListener("frontend:locale-changed",()=>{f&&ee(f)}),document.addEventListener("keydown",y=>{y.key==="Escape"&&(!s||s.classList.contains("hidden")||ne())})}catch(d){P(d.message||p("page.accountSettings.toasts.loadFailed"),"error"),_e()}})})();
