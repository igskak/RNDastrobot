import{a as at}from"./chunks/chunk-SLX3YHYO.js";import"./chunks/chunk-YBGVRB7X.js";import{b as R,d as et,e as tt,f as nt,g as ot}from"./chunks/chunk-A65AHLYU.js";var rt=R(et()),it=R(tt()),lt=R(nt());var ut=R(ot()),mt=R(at());(function(){"use strict";let U=["natal","biwheel","solar"],ee=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],J=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",Y="activePreferenceRecalcJobId",te="accountOrbViewMode",we=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),b=null,ne=null,h=null,oe=null,I=null,y="natal",T="default",q=null;function ae(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function f(e,n){return window.FrontendI18n?.t?.(e,n)||e}function _e(){let e=document.querySelector(".account-settings-back");if(!e)return;let n=window.AstroAPI?.getNavigationState?.()||{};e.href=n.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function P(e,n=""){let t=f(e);return t&&t!==e?t:n}function Ae(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Ee(e){let n=window.AstroPlan?.getSavedChartLimitState?.(e);return!n||n.max===null||n.max===void 0?f("page.plan.usage.savedChartsUnlimited",{current:n?.current||0}):f("page.plan.usage.savedChartsLimited",{current:n.current,max:n.max})}function Be(e){let n=document.getElementById("accountPlanCard");if(!n)return;let t=Ae(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage");o&&(o.textContent=f(`page.plan.names.${t}`)),a&&(a.textContent=f(`page.plan.descriptions.${t}`)),c&&(c.textContent=Ee(e)),n.dataset.planCode=t}function p(e){return P(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function se(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function L(e,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,n)||`<span class="astro-symbol" aria-hidden="true">${i(se(e))}</span>`}function ve(e){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,t=h?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=V().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(t);for(let s of c)if(t?.[s]?.ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.co_ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.exaltation===n)return o[s]||null;return null}function Pe(e,n={}){let t=x(n),o=ve(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,t):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,t):"#6b7280"}function O(e){return P(`astro.aspect.${e}`,e)}function G(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function $e(e,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,n):JSON.stringify(e??null)===JSON.stringify(n??null)}function xe(e){return e==null?e:JSON.parse(JSON.stringify(e))}function $(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function _(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function D(e={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,n):e}function x(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function ce(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Ce(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return h?.aspect_types||ee.map(e=>({aspect_type:e}))}function st(e){return C().find(n=>n?.aspect_type===e)||null}function k(){return(h?.bodies||[]).map(e=>e?.name).filter(Boolean)}function V(){return h?.signs||[]}function re(){return k().filter(e=>!we.has(e))}function M(e="natal"){let n=C(),t=k();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,t,e):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(t.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function v(){let e={version:2,pair_strategy:F,profiles:Object.fromEntries(J.map(n=>[n,{matrix:M(n)}]))};return _({orbs:e,balances:h?.default_balance_targets||{},dignities:h?.default_dignities||{version:1,signs:{}}})}function ie(){return x(h?.default_visual_palettes||{})}function le(){return{chart_defaults:{natal:$({}),biwheel:$({aspects:{scope:"major"}}),solar:$({})},chart_creation_defaults:{house_system:"P"},methodology:v(),visual:ie()}}function de(){return document.getElementById("accountTimezoneLabelFormatSelect")}function ue(){return document.getElementById("accountDateFormatSelect")}function me(){return document.getElementById("accountDegreeFormatSelect")}function ge(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function A(){return b||(b={methodology:v()}),b.methodology=_(b.methodology||v()),b.methodology}function Me(e){return A()?.orbs?.profiles?.[e]?.matrix||M(e)}function Ie(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||F:_(b?.methodology||v())?.orbs?.pair_strategy||F}function pe(e){return P(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Te(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Le(e){let n=i(pe(e)),t=i(Te(e));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${t}</span>`}function ct(e){return V().find(n=>n?.name===e)?.opposite||null}function W(){let e=A();return e.dignities=D(e.dignities||{},h?.default_dignities||{}),e.dignities}function Oe(e={}){let n=re(),t=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return V().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&t[s.ruler]&&(t[s.ruler].domicile_primary.push(a),c&&t[s.ruler].detriment_primary.push(c)),s.co_ruler&&t[s.co_ruler]&&(t[s.co_ruler].domicile_secondary.push(a),c&&t[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&t[s.exaltation]&&(t[s.exaltation].exaltation.push(a),c&&t[s.exaltation].fall.push(c))}),t}function z(e=[],{mode:n="derived",secondarySigns:t=[]}={}){let o=new Set(t||[]);return V().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),r=o.has(c),u=["account-settings-dignity-glyph",s?"is-active":"",r?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(pe(c)),d=i(`${l} · ${f(s?r?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${c}"
                    title="${d}"
                    aria-label="${d}"
                    ${n==="derived"?"disabled":""}
                >${Le(c)}</button>
            `}).join("")}function fe(){let e=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),n&&a&&o.id&&n.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=f(`page.accountSettings.orbs.hints.${y}`)),t&&t.classList.toggle("hidden",y!=="prognostic")}function ye(){let e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(t=>{let o=t.dataset.orbViewMode===T;t.classList.toggle("is-active",o),t.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",T==="compact"),n?.classList.toggle("is-compact",T==="compact")}function K(){let e=A(),n=M(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(t=>{let o=t.dataset.orbAspectType,a=t.dataset.orbBody;!o||!a||(n[o]||(n[o]={}),n[o][a]=Number.parseFloat(t.value)||0)}),e.orbs.profiles[y]={matrix:n}}function De(e,{rerender:n=!0}={}){J.includes(e)&&(b&&K(),y=e,fe(),n&&b&&Q(b.methodology))}function ke(e){["default","compact"].includes(e)&&(T=e,localStorage.setItem(te,e),ye())}function Ne(e={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=C().map(t=>{let o=t.aspect_type,a=i(G(o)),c=i(O(o)),s=U.map(r=>{let u=e?.[r]?.aspects?.enabled_types||[],g=new Set(Array.isArray(u)&&u.length?u:ee).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${r}"
                                data-aspect-type="${o}"
                                ${g}
                                aria-label="${i(`${P(`page.accountSettings.tables.columns.${r}`,r)}: ${c}`)}"
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
            `}).join(""))}function Re(e={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=Ce().map(t=>{let o=i(p(t)),a=L(t,{size:18,title:p(t)}),c=U.map(s=>{let r=ce(e?.[s]?.matrix?.rows||{}),u=r?.[t]?.display!==!1?"checked":"",l=r?.[t]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${t}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${i(`${P(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${i(`${P(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function Q(e={}){let n=document.getElementById("accountOrbsHeaderRow"),t=document.getElementById("accountOrbsMatrixBody");if(!n||!t)return;let o=k(),a=C(),s=_(e||v())?.orbs?.profiles?.[y]?.matrix||M(y);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let u=i(p(r)),l=L(r,{size:18,title:p(r)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${u}" aria-label="${u}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,t.innerHTML=a.map(r=>{let u=r.aspect_type,l=i(G(u)),g=i(O(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${g}" aria-label="${g}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(d=>{let m=s?.[u]?.[d],S=i(p(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(m))?Number(m):Number(r.base_orb||5)}"
                                    aria-label="${i(`${g} · ${S}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),fe(),ye()}function be(e={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let t=D(e?.dignities||{},h?.default_dignities||{}),o=Oe(t);n.innerHTML=re().map(a=>{let c=i(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${L(a,{size:18,title:p(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${z(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${z(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${z(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${z(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function Fe(e,n){let t=W(),o={...t.signs?.[e]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,t.signs[e]=o,A().dignities=D(t,h?.default_dignities||{})}function Ye(e,n){let t=W(),o={...t.signs?.[e]||{}};o.exaltation=o.exaltation===n?null:n,t.signs[e]=o,A().dignities=D(t,h?.default_dignities||{})}function qe(e={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),t=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!t)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},r=k().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=r.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(l))}" aria-label="${i(p(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:p(l)})}
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
        `).join(""),t.innerHTML=u.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(l))}" aria-label="${i(p(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:p(l)})}
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
        `).join("")}function Ve(e={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let t=x(e);n.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,t):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(O(a))}" aria-label="${i(O(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(G(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${i(c)}"
                            data-aspect-color="${a}"
                            aria-label="${i(O(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function ze(e={}){let n=document.getElementById("accountElementPaletteBody"),t=document.getElementById("accountBodyOverrideColorsBody");if(!n||!t)return;let o=x(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0),n.innerHTML=Object.keys(a).map(r=>`
            <tr>
                <th scope="row">${i(r)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[r])}" data-element-color="${r}" aria-label="${i(r)}"></td>
            </tr>
        `).join(""),t.innerHTML=k().map(r=>{let u=Pe(r,o),l=!!c?.[r],g=c?.[r]||u;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(r))}" aria-label="${i(p(r))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(se(r))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(g)}"
                                data-body-color-override="${r}"
                                data-body-color-active="${l?"true":"false"}"
                                data-body-color-default="${i(u)}"
                                aria-label="${i(p(r))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${l?"":" is-muted"}"
                                data-clear-body-color-override="${r}"
                                title="${i(f("common.reset"))}"
                                aria-label="${i(`${f("common.reset")}: ${p(r)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function j(e,{updateBaseline:n=!1}={}){let t={...le(),...e||{},chart_defaults:{natal:$(e?.chart_defaults?.natal||{}),biwheel:$(e?.chart_defaults?.biwheel||{}),solar:$(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:_(e?.methodology||v()),visual:x(e?.visual||ie())};b=t,n&&(ne=xe(t.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),J.includes(y)||(y="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let a=de();a&&(a.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let c=ue();if(c){let l=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(t.visual?.date_format)?t.visual.date_format:"DD_MM_YYYY";c.value=l}let s=me();if(s){let l=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(t.visual?.degree_format)?t.visual.degree_format:"DEGREES_ONLY";s.value=l}let r=document.getElementById("accountOrbPairStrategySelect");r&&(r.value=t.methodology?.orbs?.pair_strategy||F);let u=document.getElementById("accountStationaryThresholdPercent");u&&(u.value=String(t.methodology?.stationary?.threshold_percent??5)),U.forEach(l=>{let g=t.chart_defaults[l],d=ge(l);d.orientation&&(d.orientation.value=g.view_options?.orientation==="asc"?"asc":"aries"),d.aspectScope&&(d.aspectScope.value=g.aspects?.scope||(l==="biwheel"?"major":"all")),d.showApplyingSeparating&&(d.showApplyingSeparating.checked=g.aspects?.show_applying_separating===!0),d.showSpeed&&(d.showSpeed.checked=g.table_options?.show_speed!==!1),d.showStationary&&(d.showStationary.checked=g.table_options?.show_stationary!==!1),d.showAspectText&&(d.showAspectText.checked=g.table_options?.show_aspect_text===!0)}),Ne(t.chart_defaults),Re(t.chart_defaults),Q(t.methodology),be(t.methodology),qe(t.methodology),Ve(t.visual),ze(t.visual)}function je(e){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(t=>{t.checked&&t.dataset.aspectType&&n.push(t.dataset.aspectType)}),n.length?n:C().map(t=>t.aspect_type)}function He(e){let n=ce({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(t=>{let o=t.dataset.matrixBody,a=t.dataset.matrixField;!o||!a||(n[o]={...n[o]||{display:!0,aspecting:!0},[a]:t.checked})}),n}function X(e){let n=ge(e);return{matrix:{rows:He(e)},aspects:{scope:n.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:je(e),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function Ue(){K();let n=(_(b?.methodology||v())?.orbs||{})?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(t[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),_({orbs:{version:2,pair_strategy:Ie(),profiles:n},balances:{version:1,planet_weights:t,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:D(b?.methodology?.dignities||W(),h?.default_dignities||{})})}function Je(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let t={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(t[a]=c)}),x({aspect_colors:e,planet_colors:{element_palette:n,body_overrides:t},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0},timezone_label_format:de()?.value||"UTC",date_format:ue()?.value||"DD_MM_YYYY",degree_format:me()?.value||"DEGREES_ONLY"})}function Ge(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:Ue(),visual:Je()}}function E(e,n="info"){let t=document.getElementById("accountSettingsToast");!t||!e||(t.textContent=e,t.className=`toast ${n}`,requestAnimationFrame(()=>t.classList.add("visible")),clearTimeout(oe),oe=setTimeout(()=>{t.classList.remove("visible")},2800))}function he(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function We(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function H(e,{final:n=!1}={}){let t=document.getElementById("methodologyJobStatus");if(!t)return;if(!e){t.classList.add("hidden"),t.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),r=Number(e.failed_count||0),u={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:r?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:r?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},g=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];r&&g.push(`ошибок: ${r}`),!n&&s!=="completed"&&s!=="failed"&&g.push("можно остаться на странице и дождаться завершения"),t.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(u[s]||"Пересчет карт")}</span>
                <span>${i(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(g.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,t.classList.remove("hidden"),t.dataset.status=s}function Z(){I&&(clearTimeout(I),I=null)}async function Se(e){if(Z(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(Y,String(e));let n=async()=>{try{let t=await window.AstroAPI.getPreferenceRecalcJob(e);if(H(t,{final:t.status==="completed"||t.status==="failed"}),t.status==="completed"){sessionStorage.removeItem(Y),E(t.failed_count?`Пересчет завершен с ошибками: ${t.failed_count}.`:"Пересчет карт завершен.",t.failed_count?"info":"success"),await We(),Z();return}if(t.status==="failed"){sessionStorage.removeItem(Y),E(t.error||"Пересчет карт не выполнен.","error"),Z();return}I=setTimeout(n,2500)}catch(t){I=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",t)}};await n()}async function Ke(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let n=document.getElementById("accountSettingsSubtitle");n&&(n.textContent=e.email?f("page.accountSettings.subtitleWithEmail",{email:e.email}):f("page.accountSettings.subtitle")),Be(e);let[t,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);h=t||null,j(o,{updateBaseline:!0});let a=sessionStorage.getItem(Y);a?Se(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):H(null),ae()}async function Qe(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let n=Ge(),t=localStorage.getItem("currentUserId")||null,o=!$e(_(ne||{}),n.methodology),a=await window.AstroAPI.patchAccountPreferences(n);if(j(a,{updateBaseline:!0}),o&&window.AstroAPI?.createPreferenceRecalcJob){let c=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...t?{priority_user_id:t}:{}}});H(c),Se(c.job_id).catch(s=>{console.warn("Failed to poll methodology recalculation job:",s)}),E("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(he);return}E(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(he)}catch(n){E(n.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function Xe(){j(le()),H(null),E(f("page.accountSettings.toasts.restored"),"info")}function N({restoreFocus:e=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),t&&t.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&q instanceof HTMLElement&&q.focus(),q=null}function Ze(){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),t=document.getElementById("accountSettingsResetConfirmSubmit");!e||!n||(q=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{t?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{T=localStorage.getItem(te)==="compact"?"compact":"default",_e();let e=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),t=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),r=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),g=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{Qe()}),n?.addEventListener("click",()=>{Ze()}),r?.addEventListener("click",()=>{N()}),u?.addEventListener("click",()=>{N()}),l?.addEventListener("click",()=>{N()}),g?.addEventListener("click",()=>{N({restoreFocus:!1}),Xe()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{De(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{ke(d.dataset.orbViewMode||"default")})}),t?.addEventListener("click",()=>{K();let d=A();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(Me("natal")))},y="prognostic",Q(d),E(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let m=d.target;if(!(m instanceof HTMLInputElement)||!m.dataset.orbAspectType||!m.dataset.orbBody)return;let S=A(),B=(S.orbs.profiles[y]||{matrix:M(y)}).matrix||M(y);B[m.dataset.orbAspectType]||(B[m.dataset.orbAspectType]={}),B[m.dataset.orbAspectType][m.dataset.orbBody]=Number.parseFloat(m.value)||0,S.orbs.profiles[y]={matrix:B}}),a?.addEventListener("click",d=>{let m=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(m instanceof HTMLButtonElement))return;let S=m.dataset.dignityMode,w=m.dataset.dignitySign,B=m.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!S||!w||!B||S==="derived"||(S==="domicile"?Fe(w,B):S==="exaltation"&&Ye(w,B),be(b?.methodology||A()))}),c?.addEventListener("input",d=>{let m=d.target;if(!(m instanceof HTMLInputElement)||!m.dataset.bodyColorOverride)return;m.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${m.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let m=d.target.closest("[data-clear-body-color-override]");if(!(m instanceof HTMLElement))return;let S=m.dataset.clearBodyColorOverride;if(!S)return;let w=c.querySelector(`[data-body-color-override="${S}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",m.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ke(),document.addEventListener("frontend:locale-changed",()=>{b&&j(b)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||N())})}catch(d){E(d.message||f("page.accountSettings.toasts.loadFailed"),"error"),ae()}})})();
