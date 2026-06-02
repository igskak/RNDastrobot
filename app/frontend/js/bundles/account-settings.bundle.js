import{a as rt}from"./chunks/chunk-IH3JQRZD.js";import"./chunks/chunk-YBGVRB7X.js";import{a as at,b as ct}from"./chunks/chunk-P4QAIVJG.js";import{c as q,e as ot,f as st}from"./chunks/chunk-4Y3PZ2DR.js";var ut=q(ot()),mt=q(at()),gt=q(st());var ft=q(ct()),yt=q(rt());(function(){"use strict";let K=["natal","biwheel","solar"],oe=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],Q=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],H=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",z="activePreferenceRecalcJobId",ae="accountOrbViewMode",Ae=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),b=null,se=null,S=null,ce=null,O=null,f="natal",k="default",j=null;function re(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function p(e,n){return window.FrontendI18n?.t?.(e,n)||e}function Be(){let e=document.querySelector(".account-settings-back");if(!e)return;let n=window.AstroAPI?.getNavigationState?.()||{};e.href=n.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function T(e,n=""){let t=p(e);return t&&t!==e?t:n}function ve(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Pe(e){let n=window.AstroPlan?.getSavedChartLimitState?.(e);return!n||n.max===null||n.max===void 0?p("page.plan.usage.savedChartsUnlimited",{current:n?.current||0}):p("page.plan.usage.savedChartsLimited",{current:n.current,max:n.max})}function xe(e){let n=document.getElementById("accountPlanCard");if(!n)return;let t=ve(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage");o&&(o.textContent=p(`page.plan.names.${t}`)),a&&(a.textContent=p(`page.plan.descriptions.${t}`)),c&&(c.textContent=Pe(e)),n.dataset.planCode=t}function g(e){return T(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function ie(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function D(e,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,n)||`<span class="astro-symbol" aria-hidden="true">${i(ie(e))}</span>`}function $e(e){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,t=S?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=U().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(t);for(let s of c)if(t?.[s]?.ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.co_ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.exaltation===n)return o[s]||null;return null}function Te(e,n={}){let t=I(n),o=$e(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,t):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,t):"#6b7280"}function N(e){return T(`astro.aspect.${e}`,e)}function X(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Ie(e,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,n):JSON.stringify(e??null)===JSON.stringify(n??null)}function R(e){return e==null?e:JSON.parse(JSON.stringify(e))}function A(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function B(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function F(e={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,n):e}function I(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function le(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Ce(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return S?.aspect_types||oe.map(e=>({aspect_type:e}))}function it(e){return C().find(n=>n?.aspect_type===e)||null}function V(){return(S?.bodies||[]).map(e=>e?.name).filter(Boolean)}function U(){return S?.signs||[]}function de(){return V().filter(e=>!Ae.has(e))}function M(e="natal"){let n=C(),t=V();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,t,e):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(t.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function x(){let e={version:2,pair_strategy:H,profiles:Object.fromEntries(Q.map(n=>[n,{matrix:M(n)}]))};return B({orbs:e,balances:S?.default_balance_targets||{},dignities:S?.default_dignities||{version:1,signs:{}}})}function ue(){return I(S?.default_visual_palettes||{})}function me(){return{chart_defaults:{natal:A({}),biwheel:A({}),forecast_new:A({}),solar:A({})},chart_creation_defaults:{house_system:"P"},methodology:x(),visual:ue()}}function ge(){return document.getElementById("accountTimezoneLabelFormatSelect")}function pe(){return document.getElementById("accountDateFormatSelect")}function fe(){return document.getElementById("accountDegreeFormatSelect")}function ye(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function v(){return b||(b={methodology:x()}),b.methodology=B(b.methodology||x()),b.methodology}function Me(e){return v()?.orbs?.profiles?.[e]?.matrix||M(e)}function Le(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||H:B(b?.methodology||x())?.orbs?.pair_strategy||H}function be(e){return T(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Oe(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function ke(e){let n=i(be(e)),t=i(Oe(e));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${t}</span>`}function lt(e){return U().find(n=>n?.name===e)?.opposite||null}function Z(){let e=v();return e.dignities=F(e.dignities||{},S?.default_dignities||{}),e.dignities}function De(e={}){let n=de(),t=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return U().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&t[s.ruler]&&(t[s.ruler].domicile_primary.push(a),c&&t[s.ruler].detriment_primary.push(c)),s.co_ruler&&t[s.co_ruler]&&(t[s.co_ruler].domicile_secondary.push(a),c&&t[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&t[s.exaltation]&&(t[s.exaltation].exaltation.push(a),c&&t[s.exaltation].fall.push(c))}),t}function J(e=[],{mode:n="derived",secondarySigns:t=[]}={}){let o=new Set(t||[]);return U().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),r=o.has(c),m=["account-settings-dignity-glyph",s?"is-active":"",r?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(be(c)),d=i(`${l} · ${p(s?r?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${m}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${c}"
                    title="${d}"
                    aria-label="${d}"
                    ${n==="derived"?"disabled":""}
                >${ke(c)}</button>
            `}).join("")}function he(){let e=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===f;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),n&&a&&o.id&&n.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${f}`)),t&&t.classList.toggle("hidden",f==="natal")}function Se(){let e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(t=>{let o=t.dataset.orbViewMode===k;t.classList.toggle("is-active",o),t.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",k==="compact"),n?.classList.toggle("is-compact",k==="compact")}function ee(){let e=v(),n=M(f);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(t=>{let o=t.dataset.orbAspectType,a=t.dataset.orbBody;!o||!a||(n[o]||(n[o]={}),n[o][a]=Number.parseFloat(t.value)||0)}),e.orbs.profiles[f]={matrix:n}}function Ne(e,{rerender:n=!0}={}){Q.includes(e)&&(b&&ee(),f=e,he(),n&&b&&te(b.methodology))}function Re(e){["default","compact"].includes(e)&&(k=e,localStorage.setItem(ae,e),Se())}function Fe(e={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=C().map(t=>{let o=t.aspect_type,a=i(X(o)),c=i(N(o)),s=K.map(r=>{let m=e?.[r]?.aspects?.enabled_types||[],y=new Set(Array.isArray(m)&&m.length?m:oe).has(o)?"checked":"";return`
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
            `}).join(""))}function Ve(e={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=Ce().map(t=>{let o=i(g(t)),a=D(t,{size:18,title:g(t)}),c=K.map(s=>{let r=le(e?.[s]?.matrix?.rows||{}),m=r?.[t]?.display!==!1?"checked":"",l=r?.[t]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${t}"
                                data-matrix-field="display"
                                ${m}
                                aria-label="${i(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${i(`${T(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function te(e={}){let n=document.getElementById("accountOrbsHeaderRow"),t=document.getElementById("accountOrbsMatrixBody");if(!n||!t)return;let o=V(),a=C(),s=B(e||x())?.orbs?.profiles?.[f]?.matrix||M(f);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let m=i(g(r)),l=D(r,{size:18,title:g(r)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,t.innerHTML=a.map(r=>{let m=r.aspect_type,l=i(X(m)),y=i(N(m));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${y}" aria-label="${y}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(d=>{let u=s?.[m]?.[d],h=i(g(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(r.base_orb||5)}"
                                    aria-label="${i(`${y} · ${h}`)}"
                                    data-orb-aspect-type="${m}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${f}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),he(),Se()}function we(e={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let t=F(e?.dignities||{},S?.default_dignities||{}),o=De(t);n.innerHTML=de().map(a=>{let c=i(g(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${D(a,{size:18,title:g(a)})}
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
            `}).join("")}function Ye(e,n){let t=Z(),o={...t.signs?.[e]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,t.signs[e]=o,v().dignities=F(t,S?.default_dignities||{})}function qe(e,n){let t=Z(),o={...t.signs?.[e]||{}};o.exaltation=o.exaltation===n?null:n,t.signs[e]=o,v().dignities=F(t,S?.default_dignities||{})}function He(e={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),t=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!t)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},r=V().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),m=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=r.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(g(l))}" aria-label="${i(g(l))}" role="img" tabindex="0">
                                ${D(l,{size:18,title:g(l)})}
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
                        aria-label="${i(g(l))}"
                    >
                </td>
            </tr>
        `).join(""),t.innerHTML=m.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(g(l))}" aria-label="${i(g(l))}" role="img" tabindex="0">
                                ${D(l,{size:18,title:g(l)})}
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
                        aria-label="${i(g(l))}"
                    >
                </td>
            </tr>
        `).join("")}function ze(e={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let t=I(e);n.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,t):"#9ca3af";return`
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
            `}).join("")}function je(e={}){let n=document.getElementById("accountElementPaletteBody"),t=document.getElementById("accountBodyOverrideColorsBody");if(!n||!t)return;let o=I(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0),n.innerHTML=Object.keys(a).map(r=>`
            <tr>
                <th scope="row">${i(r)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[r])}" data-element-color="${r}" aria-label="${i(r)}"></td>
            </tr>
        `).join(""),t.innerHTML=V().map(r=>{let m=Te(r,o),l=!!c?.[r],y=c?.[r]||m;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(g(r))}" aria-label="${i(g(r))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(ie(r))}</span>
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
                                data-body-color-default="${i(m)}"
                                aria-label="${i(g(r))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${l?"":" is-muted"}"
                                data-clear-body-color-override="${r}"
                                title="${i(p("common.reset"))}"
                                aria-label="${i(`${p("common.reset")}: ${g(r)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function G(e,{updateBaseline:n=!1}={}){let t={...me(),...e||{},chart_defaults:{natal:A(e?.chart_defaults?.natal||{}),biwheel:A(e?.chart_defaults?.biwheel||{}),forecast_new:A(e?.chart_defaults?.forecast_new||{}),solar:A(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:B(e?.methodology||x()),visual:I(e?.visual||ue())};b=t,n&&(se=R(t.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),Q.includes(f)||(f="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let a=t.chart_defaults.natal?.view_options||{},c=t.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let r=document.getElementById("accountHouseNumberStyleSelect");r&&(r.value=a.house_number_style==="roman"?"roman":"arabic");let m=document.getElementById("accountHouseLabelsOutsideToggle");m&&(m.checked=a.house_labels_outside===!0);let l=document.getElementById("accountShowAspectTextToggle");l&&(l.checked=c.show_aspect_text===!0);let y=document.getElementById("accountAngularCuspsBoldToggle");y&&(y.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let d=ge();d&&(d.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let u=pe();if(u){let $=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(t.visual?.date_format)?t.visual.date_format:"DD_MM_YYYY";u.value=$}let h=fe();if(h){let $=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(t.visual?.degree_format)?t.visual.degree_format:"DEGREES_ONLY";h.value=$}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=t.methodology?.orbs?.pair_strategy||H);let E=document.getElementById("accountStationaryThresholdPercent");E&&(E.value=String(t.methodology?.stationary?.threshold_percent??5)),K.forEach($=>{let L=t.chart_defaults[$],_=ye($);_.orientation&&(_.orientation.value=L.view_options?.orientation==="asc"?"asc":"aries"),_.aspectScope&&(_.aspectScope.value=L.aspects?.scope||($==="biwheel"?"major":"all")),_.showApplyingSeparating&&(_.showApplyingSeparating.checked=L.aspects?.show_applying_separating===!0),_.showSpeed&&(_.showSpeed.checked=L.table_options?.show_speed!==!1),_.showStationary&&(_.showStationary.checked=L.table_options?.show_stationary!==!1),_.showAspectText&&(_.showAspectText.checked=L.table_options?.show_aspect_text===!0)}),Fe(t.chart_defaults),Ve(t.chart_defaults),te(t.methodology),we(t.methodology),He(t.methodology),ze(t.visual),je(t.visual)}function Ue(e){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(t=>{t.checked&&t.dataset.aspectType&&n.push(t.dataset.aspectType)}),n.length?n:C().map(t=>t.aspect_type)}function Je(e){let n=le({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(t=>{let o=t.dataset.matrixBody,a=t.dataset.matrixField;!o||!a||(n[o]={...n[o]||{display:!0,aspecting:!0},[a]:t.checked})}),n}function dt(e){let n=ye(e);return{matrix:{rows:Je(e)},aspects:{scope:n.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:Ue(e),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function Ge(){ee();let n=(B(b?.methodology||x())?.orbs||{})?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(t[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),B({orbs:{version:2,pair_strategy:Le(),profiles:n},balances:{version:1,planet_weights:t,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:F(b?.methodology?.dignities||Z(),S?.default_dignities||{})})}function We(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let t={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(t[a]=c)}),I({aspect_colors:e,planet_colors:{element_palette:n,body_overrides:t},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0},timezone_label_format:ge()?.value||"UTC",date_format:pe()?.value||"DD_MM_YYYY",degree_format:fe()?.value||"DEGREES_ONLY"})}function Ke(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",n=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",t=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:n,house_labels_outside:t,bold_asc_dsc:a,bold_mc_ic:a}}}function Qe(){let e=Ke();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:R(e),biwheel:R(e),forecast_new:R(e),solar:R(e)},methodology:Ge(),visual:We()}}function P(e,n="info"){let t=document.getElementById("accountSettingsToast");!t||!e||(t.textContent=e,t.className=`toast ${n}`,requestAnimationFrame(()=>t.classList.add("visible")),clearTimeout(ce),ce=setTimeout(()=>{t.classList.remove("visible")},2800))}function _e(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function Xe(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function W(e,{final:n=!1}={}){let t=document.getElementById("methodologyJobStatus");if(!t)return;if(!e){t.classList.add("hidden"),t.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),r=Number(e.failed_count||0),m={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:r?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:r?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},y=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];r&&y.push(`ошибок: ${r}`),!n&&s!=="completed"&&s!=="failed"&&y.push("можно остаться на странице и дождаться завершения"),t.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(m[s]||"Пересчет карт")}</span>
                <span>${i(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(y.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,t.classList.remove("hidden"),t.dataset.status=s}function ne(){O&&(clearTimeout(O),O=null)}async function Ee(e){if(ne(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(z,String(e));let n=async()=>{try{let t=await window.AstroAPI.getPreferenceRecalcJob(e);if(W(t,{final:t.status==="completed"||t.status==="failed"}),t.status==="completed"){sessionStorage.removeItem(z),P(t.failed_count?`Пересчет завершен с ошибками: ${t.failed_count}.`:"Пересчет карт завершен.",t.failed_count?"info":"success"),await Xe(),ne();return}if(t.status==="failed"){sessionStorage.removeItem(z),P(t.error||"Пересчет карт не выполнен.","error"),ne();return}O=setTimeout(n,2500)}catch(t){O=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",t)}};await n()}async function Ze(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let n=document.getElementById("accountSettingsSubtitle");n&&(n.textContent=e.email?p("page.accountSettings.subtitleWithEmail",{email:e.email}):p("page.accountSettings.subtitle")),xe(e);let[t,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);S=t||null,G(o,{updateBaseline:!0});let a=sessionStorage.getItem(z);a?Ee(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):W(null),re()}async function et(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let n=Qe(),t=localStorage.getItem("currentUserId")||null,o=!Ie(B(se||{}),n.methodology),a=(b?.chart_creation_defaults?.house_system||"P")!==(n.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(n);if(G(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...t?{priority_user_id:t}:{}}});W(s),Ee(s.job_id).catch(r=>{console.warn("Failed to poll methodology recalculation job:",r)}),P("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(_e);return}P(p("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(_e)}catch(n){P(n.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function tt(){G(me()),W(null),P(p("page.accountSettings.toasts.restored"),"info")}function Y({restoreFocus:e=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),t&&t.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&j instanceof HTMLElement&&j.focus(),j=null}function nt(){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),t=document.getElementById("accountSettingsResetConfirmSubmit");!e||!n||(j=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{t?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{k=localStorage.getItem(ae)==="compact"?"compact":"default",Be();let e=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),t=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),r=document.getElementById("accountSettingsResetConfirmBackdrop"),m=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),y=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{et()}),n?.addEventListener("click",()=>{nt()}),r?.addEventListener("click",()=>{Y()}),m?.addEventListener("click",()=>{Y()}),l?.addEventListener("click",()=>{Y()}),y?.addEventListener("click",()=>{Y({restoreFocus:!1}),tt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{Ne(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{Re(d.dataset.orbViewMode||"default")})}),t?.addEventListener("click",()=>{if(f==="natal")return;ee();let d=v();d.orbs.profiles[f]={matrix:JSON.parse(JSON.stringify(Me("natal")))},te(d),P(p("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.orbAspectType||!u.dataset.orbBody)return;let h=v(),E=(h.orbs.profiles[f]||{matrix:M(f)}).matrix||M(f);E[u.dataset.orbAspectType]||(E[u.dataset.orbAspectType]={}),E[u.dataset.orbAspectType][u.dataset.orbBody]=Number.parseFloat(u.value)||0,h.orbs.profiles[f]={matrix:E}}),a?.addEventListener("click",d=>{let u=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(u instanceof HTMLButtonElement))return;let h=u.dataset.dignityMode,w=u.dataset.dignitySign,E=u.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!w||!E||h==="derived"||(h==="domicile"?Ye(w,E):h==="exaltation"&&qe(w,E),we(b?.methodology||v()))}),c?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.bodyColorOverride)return;u.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${u.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let u=d.target.closest("[data-clear-body-color-override]");if(!(u instanceof HTMLElement))return;let h=u.dataset.clearBodyColorOverride;if(!h)return;let w=c.querySelector(`[data-body-color-override="${h}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",u.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ze(),document.addEventListener("frontend:locale-changed",()=>{b&&G(b)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||Y())})}catch(d){P(d.message||p("page.accountSettings.toasts.loadFailed"),"error"),re()}})})();
