import{a as Ge}from"./chunks/chunk-AYI7RBIO.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as N,d as Je,e as Ue,f as We,g as Ye}from"./chunks/chunk-E24Q6PJF.js";var Xe=N(Je()),Ze=N(Ue()),et=N(We());var nt=N(Ye()),ot=N(Ge());(function(){"use strict";let U=["natal","biwheel","solar"],ee=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],W=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",q="activePreferenceRecalcJobId",te="accountOrbViewMode",be=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),p=null,b=null,ne=null,I=null,y="natal",C="default",V=null;function oe(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function f(e,t){return window.FrontendI18n?.t?.(e,t)||e}function c(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $(e,t=""){let n=f(e);return n&&n!==e?n:t}function g(e){return $(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function ae(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function L(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${c(ae(e))}</span>`}function he(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=b?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},s=z().map(a=>a?.name).filter(Boolean),i=s.length?s:Object.keys(n);for(let a of i)if(n?.[a]?.ruler===t)return o[a]||null;for(let a of i)if(n?.[a]?.co_ruler===t)return o[a]||null;for(let a of i)if(n?.[a]?.exaltation===t)return o[a]||null;return null}function Se(e,t={}){let n=P(t),o=he(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function O(e){return $(`astro.aspect.${e}`,e)}function Y(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function we(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function x(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function w(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function k(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function P(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function se(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Ae(){return window.AstroPreferences?.MATRIX_BODIES||[]}function T(){return b?.aspect_types||ee.map(e=>({aspect_type:e}))}function Ke(e){return T().find(t=>t?.aspect_type===e)||null}function D(){return(b?.bodies||[]).map(e=>e?.name).filter(Boolean)}function z(){return b?.signs||[]}function ie(){return D().filter(e=>!be.has(e))}function M(e="natal"){let t=T(),n=D();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(s=>[s,e==="prognostic"?s==="Moon"?3:1:Number(o.base_orb||5)]))]))}function v(){let e={version:2,pair_strategy:F,profiles:Object.fromEntries(W.map(t=>[t,{matrix:M(t)}]))};return w({orbs:e,balances:b?.default_balance_targets||{},dignities:b?.default_dignities||{version:1,signs:{}}})}function ce(){return P(b?.default_visual_palettes||{})}function re(){return{chart_defaults:{natal:x({}),biwheel:x({aspects:{scope:"major"}}),solar:x({})},chart_creation_defaults:{house_system:"P"},methodology:v(),visual:ce()}}function le(){return document.getElementById("accountTimezoneLabelFormatSelect")}function de(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function A(){return p||(p={methodology:v()}),p.methodology=w(p.methodology||v()),p.methodology}function _e(e){return A()?.orbs?.profiles?.[e]?.matrix||M(e)}function Be(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||F:w(p?.methodology||v())?.orbs?.pair_strategy||F}function ue(e){return $(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Ee(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function ve(e){let t=c(ue(e)),n=c(Ee(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function Qe(e){return z().find(t=>t?.name===e)?.opposite||null}function G(){let e=A();return e.dignities=k(e.dignities||{},b?.default_dignities||{}),e.dignities}function $e(e={}){let t=ie(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return z().forEach(o=>{let s=o?.name,i=o?.opposite,a=e?.signs?.[s]||{};a.ruler&&n[a.ruler]&&(n[a.ruler].domicile_primary.push(s),i&&n[a.ruler].detriment_primary.push(i)),a.co_ruler&&n[a.co_ruler]&&(n[a.co_ruler].domicile_secondary.push(s),i&&n[a.co_ruler].detriment_secondary.push(i)),a.exaltation&&n[a.exaltation]&&(n[a.exaltation].exaltation.push(s),i&&n[a.exaltation].fall.push(i))}),n}function j(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return z().map(s=>{let i=s?.name,a=e.includes(i)||o.has(i),l=o.has(i),r=["account-settings-dignity-glyph",a?"is-active":"",l?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),d=c(ue(i)),u=c(`${d} · ${f(a?l?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${r}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${i}"
                    title="${u}"
                    aria-label="${u}"
                    ${t==="derived"?"disabled":""}
                >${ve(i)}</button>
            `}).join("")}function me(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let s=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",s),o.setAttribute("aria-selected",s?"true":"false"),t&&s&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=f(`page.accountSettings.orbs.hints.${y}`)),n&&n.classList.toggle("hidden",y!=="prognostic")}function ge(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===C;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",C==="compact"),t?.classList.toggle("is-compact",C==="compact")}function K(){let e=A(),t=M(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,s=n.dataset.orbBody;!o||!s||(t[o]||(t[o]={}),t[o][s]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[y]={matrix:t}}function xe(e,{rerender:t=!0}={}){W.includes(e)&&(p&&K(),y=e,me(),t&&p&&Q(p.methodology))}function Pe(e){["default","compact"].includes(e)&&(C=e,localStorage.setItem(te,e),ge())}function Te(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=T().map(n=>{let o=n.aspect_type,s=c(Y(o)),i=c(O(o)),a=U.map(l=>{let r=e?.[l]?.aspects?.enabled_types||[],B=new Set(Array.isArray(r)&&r.length?r:ee).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${l}"
                                data-aspect-type="${o}"
                                ${B}
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
            `}).join(""))}function Me(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=Ae().map(n=>{let o=c(g(n)),s=L(n,{size:18,title:g(n)}),i=U.map(a=>{let l=se(e?.[a]?.matrix?.rows||{}),r=l?.[n]?.display!==!1?"checked":"",d=l?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${r}
                                aria-label="${c(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${n}"
                                data-matrix-field="aspecting"
                                ${d}
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
            `}).join(""))}function Q(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=D(),s=T(),a=w(e||v())?.orbs?.profiles?.[y]?.matrix||M(y);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(l=>{let r=c(g(l)),d=L(l,{size:18,title:g(l)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r}" aria-label="${r}" role="img" tabindex="0">
                                ${d}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=s.map(l=>{let r=l.aspect_type,d=c(Y(r)),B=c(O(r));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${B}" aria-label="${B}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${d}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(u=>{let m=a?.[r]?.[u],h=c(g(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(m))?Number(m):Number(l.base_orb||5)}"
                                    aria-label="${c(`${B} · ${h}`)}"
                                    data-orb-aspect-type="${r}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),me(),ge()}function pe(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=k(e?.dignities||{},b?.default_dignities||{}),o=$e(n);t.innerHTML=ie().map(s=>{let i=c(g(s)),a=o[s]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
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
            `}).join("")}function Ie(e,t){let n=G(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,A().dignities=k(n,b?.default_dignities||{})}function Ce(e,t){let n=G(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,A().dignities=k(n,b?.default_dignities||{})}function Le(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},s=o?.planet_weights||{},i=o?.special_point_weights||{},l=D().filter(d=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(d)),r=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=l.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(d))}" aria-label="${c(g(d))}" role="img" tabindex="0">
                                ${L(d,{size:18,title:g(d)})}
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
                        value="${Number(s?.[d]??1).toFixed(1)}"
                        data-balance-planet="${d}"
                        aria-label="${c(g(d))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=r.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(d))}" aria-label="${c(g(d))}" role="img" tabindex="0">
                                ${L(d,{size:18,title:g(d)})}
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
                        value="${Number(i?.[d]??0).toFixed(1)}"
                        data-balance-special-point="${d}"
                        aria-label="${c(g(d))}"
                    >
                </td>
            </tr>
        `).join("")}function Oe(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=P(e);t.innerHTML=T().map(o=>{let s=o.aspect_type,i=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(s,n):"#9ca3af";return`
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
            `}).join("")}function ke(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!t||!n)return;let o=P(e),s=o?.planet_colors?.element_palette||{},i=o?.planet_colors?.body_overrides||{};t.innerHTML=Object.keys(s).map(a=>`
            <tr>
                <th scope="row">${c(a)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${c(s[a])}" data-element-color="${a}" aria-label="${c(a)}"></td>
            </tr>
        `).join(""),n.innerHTML=D().map(a=>{let l=Se(a,o),r=!!i?.[a],d=i?.[a]||l;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c(g(a))}" aria-label="${c(g(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${c(ae(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${c(d)}"
                                data-body-color-override="${a}"
                                data-body-color-active="${r?"true":"false"}"
                                data-body-color-default="${c(l)}"
                                aria-label="${c(g(a))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${r?"":" is-muted"}"
                                data-clear-body-color-override="${a}"
                                title="${c(f("common.reset"))}"
                                aria-label="${c(`${f("common.reset")}: ${g(a)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function H(e){let t={...re(),...e||{},chart_defaults:{natal:x(e?.chart_defaults?.natal||{}),biwheel:x(e?.chart_defaults?.biwheel||{}),solar:x(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:w(e?.methodology||v()),visual:P(e?.visual||ce())};p=t,window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),W.includes(y)||(y="natal");let n=document.getElementById("accountHouseSystemSelect");n&&(n.value=t.chart_creation_defaults.house_system||"P");let o=le();o&&(o.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let s=document.getElementById("accountOrbPairStrategySelect");s&&(s.value=t.methodology?.orbs?.pair_strategy||F);let i=document.getElementById("accountStationaryThresholdPercent");i&&(i.value=String(t.methodology?.stationary?.threshold_percent??5)),U.forEach(a=>{let l=t.chart_defaults[a],r=de(a);r.orientation&&(r.orientation.value=l.view_options?.orientation==="asc"?"asc":"aries"),r.aspectScope&&(r.aspectScope.value=l.aspects?.scope||(a==="biwheel"?"major":"all")),r.showApplyingSeparating&&(r.showApplyingSeparating.checked=l.aspects?.show_applying_separating===!0),r.showSpeed&&(r.showSpeed.checked=l.table_options?.show_speed!==!1),r.showStationary&&(r.showStationary.checked=l.table_options?.show_stationary!==!1),r.showAspectText&&(r.showAspectText.checked=l.table_options?.show_aspect_text===!0)}),Te(t.chart_defaults),Me(t.chart_defaults),Q(t.methodology),pe(t.methodology),Le(t.methodology),Oe(t.visual),ke(t.visual)}function De(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:T().map(n=>n.aspect_type)}function Re(e){let t=se({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,s=n.dataset.matrixField;!o||!s||(t[o]={...t[o]||{display:!0,aspecting:!0},[s]:n.checked})}),t}function X(e){let t=de(e);return{matrix:{rows:Re(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:De(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function Ne(){K();let t=(w(p?.methodology||v())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(n[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(o[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),w({orbs:{version:2,pair_strategy:Be(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:k(p?.methodology?.dignities||G(),b?.default_dignities||{})})}function Fe(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let s=o.dataset.bodyColorOverride,i=String(o.value||"").trim();s&&i&&o.dataset.bodyColorActive!=="false"&&(n[s]=i)}),P({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},timezone_label_format:le()?.value||"UTC"})}function qe(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:Ne(),visual:Fe()}}function _(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(ne),ne=setTimeout(()=>{n.classList.remove("visible")},2800))}function ye(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function J(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.textContent="";return}let o=Number(e.progress_total||0),s=Number(e.progress_done||0),i=o>0?Math.min(100,Math.round(s/o*100)):0,l=`${String(e.status||"pending").toUpperCase()} · ${s}/${o||"0"} · ${i}%`,r=Number(e.failed_count||0),d=r?` · failures: ${r}`:"";n.textContent=t?`${l}${d}`:`${l}${d}`,n.classList.remove("hidden"),n.dataset.status=String(e.status||"pending")}function Z(){I&&(clearTimeout(I),I=null)}async function fe(e){if(Z(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(q,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(J(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(q),_(`Methodology recalculation finished${n.failed_count?` with ${n.failed_count} failures`:""}.`,n.failed_count?"info":"success"),Z();return}if(n.status==="failed"){sessionStorage.removeItem(q),_(n.error||"Methodology recalculation failed.","error"),Z();return}I=setTimeout(t,2500)}catch(n){I=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function Ve(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?f("page.accountSettings.subtitleWithEmail",{email:e.email}):f("page.accountSettings.subtitle"));let[n,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);b=n||null,H(o);let s=sessionStorage.getItem(q);s?fe(s).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):J(null),oe()}async function ze(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=qe(),n=localStorage.getItem("currentUserId")||null,o=!we(w(p?.methodology||{}),t.methodology),s=await window.AstroAPI.patchAccountPreferences(t);if(H(s),o&&window.AstroAPI?.createPreferenceRecalcJob){let i=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});J(i),fe(i.job_id).catch(a=>{console.warn("Failed to poll methodology recalculation job:",a)}),_("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(ye);return}_(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(ye)}catch(t){_(t.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function je(){H(re()),J(null),_(f("page.accountSettings.toasts.restored"),"info")}function R({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&V instanceof HTMLElement&&V.focus(),V=null}function He(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(V=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{C=localStorage.getItem(te)==="compact"?"compact":"default";let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),s=document.getElementById("accountDignitiesMatrixBody"),i=document.getElementById("accountBodyOverrideColorsBody"),a=document.getElementById("accountSettingsResetConfirmDialog"),l=document.getElementById("accountSettingsResetConfirmBackdrop"),r=document.getElementById("accountSettingsResetConfirmClose"),d=document.getElementById("accountSettingsResetConfirmCancel"),B=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{ze()}),t?.addEventListener("click",()=>{He()}),l?.addEventListener("click",()=>{R()}),r?.addEventListener("click",()=>{R()}),d?.addEventListener("click",()=>{R()}),B?.addEventListener("click",()=>{R({restoreFocus:!1}),je()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{xe(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{Pe(u.dataset.orbViewMode||"default")})}),n?.addEventListener("click",()=>{K();let u=A();u.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(_e("natal")))},y="prognostic",Q(u),_(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let m=u.target;if(!(m instanceof HTMLInputElement)||!m.dataset.orbAspectType||!m.dataset.orbBody)return;let h=A(),E=(h.orbs.profiles[y]||{matrix:M(y)}).matrix||M(y);E[m.dataset.orbAspectType]||(E[m.dataset.orbAspectType]={}),E[m.dataset.orbAspectType][m.dataset.orbBody]=Number.parseFloat(m.value)||0,h.orbs.profiles[y]={matrix:E}}),s?.addEventListener("click",u=>{let m=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(m instanceof HTMLButtonElement))return;let h=m.dataset.dignityMode,S=m.dataset.dignitySign,E=m.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!S||!E||h==="derived"||(h==="domicile"?Ie(S,E):h==="exaltation"&&Ce(S,E),pe(p?.methodology||A()))}),i?.addEventListener("input",u=>{let m=u.target;if(!(m instanceof HTMLInputElement)||!m.dataset.bodyColorOverride)return;m.dataset.bodyColorActive="true",i.querySelector(`[data-clear-body-color-override="${m.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),i?.addEventListener("click",u=>{let m=u.target.closest("[data-clear-body-color-override]");if(!(m instanceof HTMLElement))return;let h=m.dataset.clearBodyColorOverride;if(!h)return;let S=i.querySelector(`[data-body-color-override="${h}"]`);S instanceof HTMLInputElement&&(S.dataset.bodyColorActive="false",S.value=S.dataset.bodyColorDefault||"#6b7280",m.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ve(),document.addEventListener("frontend:locale-changed",()=>{p&&H(p)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!a||a.classList.contains("hidden")||R())})}catch(u){_(u.message||f("page.accountSettings.toasts.loadFailed"),"error"),oe()}})})();
