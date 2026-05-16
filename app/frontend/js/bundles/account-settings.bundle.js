import{a as Xt}from"./chunks/chunk-4MJT5I45.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as R,d as Yt,e as Gt,f as Kt,g as Qt}from"./chunks/chunk-NXF7GOZE.js";var ee=R(Yt()),ne=R(Gt()),oe=R(Kt());var se=R(Qt()),ie=R(Xt());(function(){"use strict";let U=["natal","biwheel","solar"],tt=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],W=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",q="activePreferenceRecalcJobId",et="accountOrbViewMode",ht=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),y=null,nt=null,b=null,ot=null,M=null,p="natal",C="default",V=null;function at(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),460))}function f(t,n){return window.FrontendI18n?.t?.(t,n)||t}function c(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $(t,n=""){let e=f(t);return e&&e!==t?e:n}function g(t){return $(`astro.planet.${t}`,window.Symbols?.getPlanetNameRu?.(t)||t)}function st(t){return window.Symbols?.getPlanetSymbol?.(t)||String(t||"").slice(0,2)||"•"}function L(t,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(t,n)||`<span class="astro-symbol" aria-hidden="true">${c(st(t))}</span>`}function St(t){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(t):t,e=b?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},s=z().map(a=>a?.name).filter(Boolean),i=s.length?s:Object.keys(e);for(let a of i)if(e?.[a]?.ruler===n)return o[a]||null;for(let a of i)if(e?.[a]?.co_ruler===n)return o[a]||null;for(let a of i)if(e?.[a]?.exaltation===n)return o[a]||null;return null}function wt(t,n={}){let e=x(n),o=St(t);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(t,o,e):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,e):"#6b7280"}function O(t){return $(`astro.aspect.${t}`,t)}function Y(t){return window.Symbols?.getAspectDisplay?.(t)||window.Symbols?.aspects?.[t]||String(t||"").slice(0,3)||"•"}function At(t,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,n):JSON.stringify(t??null)===JSON.stringify(n??null)}function _t(t){return t==null?t:JSON.parse(JSON.stringify(t))}function P(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function A(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function k(t={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(t,n):t}function x(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function it(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function Bt(){return window.AstroPreferences?.MATRIX_BODIES||[]}function T(){return b?.aspect_types||tt.map(t=>({aspect_type:t}))}function Zt(t){return T().find(n=>n?.aspect_type===t)||null}function D(){return(b?.bodies||[]).map(t=>t?.name).filter(Boolean)}function z(){return b?.signs||[]}function rt(){return D().filter(t=>!ht.has(t))}function I(t="natal"){let n=T(),e=D();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,e,t):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(e.map(s=>[s,t==="prognostic"?s==="Moon"?3:1:Number(o.base_orb||5)]))]))}function v(){let t={version:2,pair_strategy:F,profiles:Object.fromEntries(W.map(n=>[n,{matrix:I(n)}]))};return A({orbs:t,balances:b?.default_balance_targets||{},dignities:b?.default_dignities||{version:1,signs:{}}})}function ct(){return x(b?.default_visual_palettes||{})}function lt(){return{chart_defaults:{natal:P({}),biwheel:P({aspects:{scope:"major"}}),solar:P({})},chart_creation_defaults:{house_system:"P"},methodology:v(),visual:ct()}}function dt(){return document.getElementById("accountTimezoneLabelFormatSelect")}function ut(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function _(){return y||(y={methodology:v()}),y.methodology=A(y.methodology||v()),y.methodology}function Et(t){return _()?.orbs?.profiles?.[t]?.matrix||I(t)}function vt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||F:A(y?.methodology||v())?.orbs?.pair_strategy||F}function mt(t){return $(`astro.sign.${t}`,window.Symbols?.signNamesRu?.[t]||t)}function $t(t){return window.Symbols?.signs?.[t]||String(t||"").slice(0,2)||"•"}function Pt(t){let n=c(mt(t)),e=c($t(t));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${e}</span>`}function te(t){return z().find(n=>n?.name===t)?.opposite||null}function G(){let t=_();return t.dignities=k(t.dignities||{},b?.default_dignities||{}),t.dignities}function xt(t={}){let n=rt(),e=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return z().forEach(o=>{let s=o?.name,i=o?.opposite,a=t?.signs?.[s]||{};a.ruler&&e[a.ruler]&&(e[a.ruler].domicile_primary.push(s),i&&e[a.ruler].detriment_primary.push(i)),a.co_ruler&&e[a.co_ruler]&&(e[a.co_ruler].domicile_secondary.push(s),i&&e[a.co_ruler].detriment_secondary.push(i)),a.exaltation&&e[a.exaltation]&&(e[a.exaltation].exaltation.push(s),i&&e[a.exaltation].fall.push(i))}),e}function j(t=[],{mode:n="derived",secondarySigns:e=[]}={}){let o=new Set(e||[]);return z().map(s=>{let i=s?.name,a=t.includes(i)||o.has(i),l=o.has(i),d=["account-settings-dignity-glyph",a?"is-active":"",l?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),r=c(mt(i)),u=c(`${r} · ${f(a?l?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${d}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${i}"
                    title="${u}"
                    aria-label="${u}"
                    ${n==="derived"?"disabled":""}
                >${Pt(i)}</button>
            `}).join("")}function gt(){let t=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),e=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let s=o.dataset.orbProfileTab===p;o.classList.toggle("is-active",s),o.setAttribute("aria-selected",s?"true":"false"),n&&s&&o.id&&n.setAttribute("aria-labelledby",o.id)}),t&&(t.textContent=f(`page.accountSettings.orbs.hints.${p}`)),e&&e.classList.toggle("hidden",p!=="prognostic")}function pt(){let t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(e=>{let o=e.dataset.orbViewMode===C;e.classList.toggle("is-active",o),e.setAttribute("aria-selected",o?"true":"false")}),t?.classList.toggle("is-compact",C==="compact"),n?.classList.toggle("is-compact",C==="compact")}function K(){let t=_(),n=I(p);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(e=>{let o=e.dataset.orbAspectType,s=e.dataset.orbBody;!o||!s||(n[o]||(n[o]={}),n[o][s]=Number.parseFloat(e.value)||0)}),t.orbs.profiles[p]={matrix:n}}function Tt(t,{rerender:n=!0}={}){W.includes(t)&&(y&&K(),p=t,gt(),n&&y&&Q(y.methodology))}function It(t){["default","compact"].includes(t)&&(C=t,localStorage.setItem(et,t),pt())}function Mt(t={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=T().map(e=>{let o=e.aspect_type,s=c(Y(o)),i=c(O(o)),a=U.map(l=>{let d=t?.[l]?.aspects?.enabled_types||[],S=new Set(Array.isArray(d)&&d.length?d:tt).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${o}"
                                ${S}
                                aria-label="${c(`${$(`page.accountSettings.tables.columns.${l}`,l)}: ${i}`)}"
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
                    ${a}
                </tr>
            `}).join(""))}function Ct(t={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=Bt().map(e=>{let o=c(g(e)),s=L(e,{size:18,title:g(e)}),i=U.map(a=>{let l=it(t?.[a]?.matrix?.rows||{}),d=l?.[e]?.display!==!1?"checked":"",r=l?.[e]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${e}"
                                data-matrix-field="display"
                                ${d}
                                aria-label="${c(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${e}"
                                data-matrix-field="aspecting"
                                ${r}
                                aria-label="${c(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
                            >
                        </label>
                    </td>
                `}).join("");return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge" title="${o}" aria-label="${o}" role="img" tabindex="0">${s}</span>
                        </span>
                    </th>
                    ${i}
                </tr>
            `}).join(""))}function Q(t={}){let n=document.getElementById("accountOrbsHeaderRow"),e=document.getElementById("accountOrbsMatrixBody");if(!n||!e)return;let o=D(),s=T(),a=A(t||v())?.orbs?.profiles?.[p]?.matrix||I(p);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(l=>{let d=c(g(l)),r=L(l,{size:18,title:g(l)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${d}" aria-label="${d}" role="img" tabindex="0">
                                ${r}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,e.innerHTML=s.map(l=>{let d=l.aspect_type,r=c(Y(d)),S=c(O(d));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${S}" aria-label="${S}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(u=>{let m=a?.[d]?.[u],h=c(g(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(m))?Number(m):Number(l.base_orb||5)}"
                                    aria-label="${c(`${S} · ${h}`)}"
                                    data-orb-aspect-type="${d}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${p}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),gt(),pt()}function yt(t={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let e=k(t?.dignities||{},b?.default_dignities||{}),o=xt(e);n.innerHTML=rt().map(s=>{let i=c(g(s)),a=o[s]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i}" aria-label="${i}" role="img" tabindex="0">
                                ${L(s,{size:18,title:g(s)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${s}">
                            ${j(a.domicile_primary,{mode:"domicile",secondarySigns:a.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${j(a.detriment_primary,{mode:"derived",secondarySigns:a.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${s}">
                            ${j(a.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${j(a.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function Lt(t,n){let e=G(),o={...e.signs?.[t]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,e.signs[t]=o,_().dignities=k(e,b?.default_dignities||{})}function Ot(t,n){let e=G(),o={...e.signs?.[t]||{}};o.exaltation=o.exaltation===n?null:n,e.signs[t]=o,_().dignities=k(e,b?.default_dignities||{})}function kt(t={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),e=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!e)return;let o=t?.balances||{},s=o?.planet_weights||{},i=o?.special_point_weights||{},l=D().filter(r=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(r)),d=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=l.map(r=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(r))}" aria-label="${c(g(r))}" role="img" tabindex="0">
                                ${L(r,{size:18,title:g(r)})}
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
                        value="${Number(s?.[r]??1).toFixed(1)}"
                        data-balance-planet="${r}"
                        aria-label="${c(g(r))}"
                    >
                </td>
            </tr>
        `).join(""),e.innerHTML=d.map(r=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(r))}" aria-label="${c(g(r))}" role="img" tabindex="0">
                                ${L(r,{size:18,title:g(r)})}
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
                        value="${Number(i?.[r]??0).toFixed(1)}"
                        data-balance-special-point="${r}"
                        aria-label="${c(g(r))}"
                    >
                </td>
            </tr>
        `).join("")}function Dt(t={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let e=x(t);n.innerHTML=T().map(o=>{let s=o.aspect_type,i=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(s,e):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${c(O(s))}" aria-label="${c(O(s))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${c(Y(s))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${c(i)}"
                            data-aspect-color="${s}"
                            aria-label="${c(O(s))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Nt(t={}){let n=document.getElementById("accountElementPaletteBody"),e=document.getElementById("accountBodyOverrideColorsBody");if(!n||!e)return;let o=x(t),s=o?.planet_colors?.element_palette||{},i=o?.planet_colors?.body_overrides||{};n.innerHTML=Object.keys(s).map(a=>`
            <tr>
                <th scope="row">${c(a)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${c(s[a])}" data-element-color="${a}" aria-label="${c(a)}"></td>
            </tr>
        `).join(""),e.innerHTML=D().map(a=>{let l=wt(a,o),d=!!i?.[a],r=i?.[a]||l;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(a))}" aria-label="${c(g(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${c(st(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${c(r)}"
                                data-body-color-override="${a}"
                                data-body-color-active="${d?"true":"false"}"
                                data-body-color-default="${c(l)}"
                                aria-label="${c(g(a))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${d?"":" is-muted"}"
                                data-clear-body-color-override="${a}"
                                title="${c(f("common.reset"))}"
                                aria-label="${c(`${f("common.reset")}: ${g(a)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function H(t,{updateBaseline:n=!1}={}){let e={...lt(),...t||{},chart_defaults:{natal:P(t?.chart_defaults?.natal||{}),biwheel:P(t?.chart_defaults?.biwheel||{}),solar:P(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:A(t?.methodology||v()),visual:x(t?.visual||ct())};y=e,n&&(nt=_t(e.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),W.includes(p)||(p="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=e.chart_creation_defaults.house_system||"P");let s=dt();s&&(s.value=e.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let i=document.getElementById("accountOrbPairStrategySelect");i&&(i.value=e.methodology?.orbs?.pair_strategy||F);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(e.methodology?.stationary?.threshold_percent??5)),U.forEach(l=>{let d=e.chart_defaults[l],r=ut(l);r.orientation&&(r.orientation.value=d.view_options?.orientation==="asc"?"asc":"aries"),r.aspectScope&&(r.aspectScope.value=d.aspects?.scope||(l==="biwheel"?"major":"all")),r.showApplyingSeparating&&(r.showApplyingSeparating.checked=d.aspects?.show_applying_separating===!0),r.showSpeed&&(r.showSpeed.checked=d.table_options?.show_speed!==!1),r.showStationary&&(r.showStationary.checked=d.table_options?.show_stationary!==!1),r.showAspectText&&(r.showAspectText.checked=d.table_options?.show_aspect_text===!0)}),Mt(e.chart_defaults),Ct(e.chart_defaults),Q(e.methodology),yt(e.methodology),kt(e.methodology),Dt(e.visual),Nt(e.visual)}function Rt(t){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(e=>{e.checked&&e.dataset.aspectType&&n.push(e.dataset.aspectType)}),n.length?n:T().map(e=>e.aspect_type)}function Ft(t){let n=it({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(e=>{let o=e.dataset.matrixBody,s=e.dataset.matrixField;!o||!s||(n[o]={...n[o]||{display:!0,aspecting:!0},[s]:e.checked})}),n}function X(t){let n=ut(t);return{matrix:{rows:Ft(t)},aspects:{scope:n.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:Rt(t),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function qt(){K();let n=(A(y?.methodology||v())?.orbs||{})?.profiles||{},e={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(e[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(o[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),A({orbs:{version:2,pair_strategy:vt(),profiles:n},balances:{version:1,planet_weights:e,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:k(y?.methodology?.dignities||G(),b?.default_dignities||{})})}function Vt(){let t={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(t[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let e={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let s=o.dataset.bodyColorOverride,i=String(o.value||"").trim();s&&i&&o.dataset.bodyColorActive!=="false"&&(e[s]=i)}),x({aspect_colors:t,planet_colors:{element_palette:n,body_overrides:e},timezone_label_format:dt()?.value||"UTC"})}function zt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:qt(),visual:Vt()}}function B(t,n="info"){let e=document.getElementById("accountSettingsToast");!e||!t||(e.textContent=t,e.className=`toast ${n}`,requestAnimationFrame(()=>e.classList.add("visible")),clearTimeout(ot),ot=setTimeout(()=>{e.classList.remove("visible")},2800))}function ft(){let t=document.querySelector(".account-settings-header");if(t instanceof HTMLElement){t.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function jt(){let t=localStorage.getItem("currentUserId");if(!(!t||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(t);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function J(t,{final:n=!1}={}){let e=document.getElementById("methodologyJobStatus");if(!e)return;if(!t){e.classList.add("hidden"),e.replaceChildren();return}let o=Number(t.progress_total||0),s=Number(t.progress_done||0),i=o>0?Math.min(100,Math.round(s/o*100)):0,a=String(t.status||"pending"),l=Number(t.failed_count||0),d={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:l?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},r={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:l?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},S=[o>0?`${s}/${o} карт`:"Подготовка списка карт",`${i}%`];l&&S.push(`ошибок: ${l}`),!n&&a!=="completed"&&a!=="failed"&&S.push("можно остаться на странице и дождаться завершения"),e.innerHTML=`
            <div class="account-settings-status-title">
                <span>${c(d[a]||"Пересчет карт")}</span>
                <span>${c(r[a]||String(a).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${c(S.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${i}%"></div>
            </div>
        `,e.classList.remove("hidden"),e.dataset.status=a}function Z(){M&&(clearTimeout(M),M=null)}async function bt(t){if(Z(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(q,String(t));let n=async()=>{try{let e=await window.AstroAPI.getPreferenceRecalcJob(t);if(J(e,{final:e.status==="completed"||e.status==="failed"}),e.status==="completed"){sessionStorage.removeItem(q),B(e.failed_count?`Пересчет завершен с ошибками: ${e.failed_count}.`:"Пересчет карт завершен.",e.failed_count?"info":"success"),await jt(),Z();return}if(e.status==="failed"){sessionStorage.removeItem(q),B(e.error||"Пересчет карт не выполнен.","error"),Z();return}M=setTimeout(n,2500)}catch(e){M=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",e)}};await n()}async function Ht(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let n=document.getElementById("accountSettingsSubtitle");n&&(n.textContent=t.email?f("page.accountSettings.subtitleWithEmail",{email:t.email}):f("page.accountSettings.subtitle"));let[e,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);b=e||null,H(o,{updateBaseline:!0});let s=sessionStorage.getItem(q);s?bt(s).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):J(null),at()}async function Jt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let n=zt(),e=localStorage.getItem("currentUserId")||null,o=!At(A(nt||{}),n.methodology),s=await window.AstroAPI.patchAccountPreferences(n);if(H(s,{updateBaseline:!0}),o&&window.AstroAPI?.createPreferenceRecalcJob){let i=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...e?{priority_user_id:e}:{}}});J(i),bt(i.job_id).catch(a=>{console.warn("Failed to poll methodology recalculation job:",a)}),B("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(ft);return}B(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(ft)}catch(n){B(n.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function Ut(){H(lt()),J(null),B(f("page.accountSettings.toasts.restored"),"info")}function N({restoreFocus:t=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),e=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),e&&e.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),t&&V instanceof HTMLElement&&V.focus(),V=null}function Wt(){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),e=document.getElementById("accountSettingsResetConfirmSubmit");!t||!n||(V=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),t.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{e?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{C=localStorage.getItem(et)==="compact"?"compact":"default";let t=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),e=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),s=document.getElementById("accountDignitiesMatrixBody"),i=document.getElementById("accountBodyOverrideColorsBody"),a=document.getElementById("accountSettingsResetConfirmDialog"),l=document.getElementById("accountSettingsResetConfirmBackdrop"),d=document.getElementById("accountSettingsResetConfirmClose"),r=document.getElementById("accountSettingsResetConfirmCancel"),S=document.getElementById("accountSettingsResetConfirmSubmit");t?.addEventListener("click",()=>{Jt()}),n?.addEventListener("click",()=>{Wt()}),l?.addEventListener("click",()=>{N()}),d?.addEventListener("click",()=>{N()}),r?.addEventListener("click",()=>{N()}),S?.addEventListener("click",()=>{N({restoreFocus:!1}),Ut()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{Tt(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{It(u.dataset.orbViewMode||"default")})}),e?.addEventListener("click",()=>{K();let u=_();u.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(Et("natal")))},p="prognostic",Q(u),B(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let m=u.target;if(!(m instanceof HTMLInputElement)||!m.dataset.orbAspectType||!m.dataset.orbBody)return;let h=_(),E=(h.orbs.profiles[p]||{matrix:I(p)}).matrix||I(p);E[m.dataset.orbAspectType]||(E[m.dataset.orbAspectType]={}),E[m.dataset.orbAspectType][m.dataset.orbBody]=Number.parseFloat(m.value)||0,h.orbs.profiles[p]={matrix:E}}),s?.addEventListener("click",u=>{let m=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(m instanceof HTMLButtonElement))return;let h=m.dataset.dignityMode,w=m.dataset.dignitySign,E=m.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!w||!E||h==="derived"||(h==="domicile"?Lt(w,E):h==="exaltation"&&Ot(w,E),yt(y?.methodology||_()))}),i?.addEventListener("input",u=>{let m=u.target;if(!(m instanceof HTMLInputElement)||!m.dataset.bodyColorOverride)return;m.dataset.bodyColorActive="true",i.querySelector(`[data-clear-body-color-override="${m.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),i?.addEventListener("click",u=>{let m=u.target.closest("[data-clear-body-color-override]");if(!(m instanceof HTMLElement))return;let h=m.dataset.clearBodyColorOverride;if(!h)return;let w=i.querySelector(`[data-body-color-override="${h}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",m.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ht(),document.addEventListener("frontend:locale-changed",()=>{y&&H(y)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!a||a.classList.contains("hidden")||N())})}catch(u){B(u.message||f("page.accountSettings.toasts.loadFailed"),"error"),at()}})})();
