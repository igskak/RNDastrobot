import{a as Yt}from"./chunks/chunk-Y2OAENFL.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as N,d as Ht,e as Jt,f as Wt,g as Ut}from"./chunks/chunk-E24Q6PJF.js";var Qt=N(Ht()),Xt=N(Jt()),Zt=N(Wt());var ee=N(Ut()),ne=N(Yt());(function(){"use strict";let W=["natal","biwheel","solar"],tt=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],U=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",q="activePreferenceRecalcJobId",et="accountOrbViewMode",ft=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),p=null,b=null,nt=null,I=null,y="natal",C="default",V=null;function ot(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),460))}function f(t,e){return window.FrontendI18n?.t?.(t,e)||t}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $(t,e=""){let n=f(t);return n&&n!==t?n:e}function g(t){return $(`astro.planet.${t}`,window.Symbols?.getPlanetNameRu?.(t)||t)}function at(t){return window.Symbols?.getPlanetSymbol?.(t)||String(t||"").slice(0,2)||"•"}function L(t,e={}){return window.Symbols?.getPlanetSymbolMarkup?.(t,e)||`<span class="astro-symbol" aria-hidden="true">${r(at(t))}</span>`}function bt(t){let e=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(t):t,n=b?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},s=j().map(a=>a?.name).filter(Boolean),i=s.length?s:Object.keys(n);for(let a of i)if(n?.[a]?.ruler===e)return o[a]||null;for(let a of i)if(n?.[a]?.co_ruler===e)return o[a]||null;for(let a of i)if(n?.[a]?.exaltation===e)return o[a]||null;return null}function ht(t,e={}){let n=P(e),o=bt(t);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(t,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function O(t){return $(`astro.aspect.${t}`,t)}function Y(t){return window.Symbols?.getAspectDisplay?.(t)||window.Symbols?.aspects?.[t]||String(t||"").slice(0,3)||"•"}function St(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function x(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function w(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function k(t={},e={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(t,e):t}function P(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function st(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function wt(){return window.AstroPreferences?.MATRIX_BODIES||[]}function M(){return b?.aspect_types||tt.map(t=>({aspect_type:t}))}function Gt(t){return M().find(e=>e?.aspect_type===t)||null}function D(){return(b?.bodies||[]).map(t=>t?.name).filter(Boolean)}function j(){return b?.signs||[]}function it(){return D().filter(t=>!ft.has(t))}function T(t="natal"){let e=M(),n=D();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(e,n,t):Object.fromEntries(e.map(o=>[o.aspect_type,Object.fromEntries(n.map(s=>[s,t==="prognostic"?s==="Moon"?3:1:Number(o.base_orb||5)]))]))}function v(){let t={version:2,pair_strategy:F,profiles:Object.fromEntries(U.map(e=>[e,{matrix:T(e)}]))};return w({orbs:t,balances:b?.default_balance_targets||{},dignities:b?.default_dignities||{version:1,signs:{}}})}function ct(){return P(b?.default_visual_palettes||{})}function rt(){return{chart_defaults:{natal:x({}),biwheel:x({aspects:{scope:"major"}}),solar:x({})},chart_creation_defaults:{house_system:"P"},methodology:v(),visual:ct()}}function lt(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function A(){return p||(p={methodology:v()}),p.methodology=w(p.methodology||v()),p.methodology}function At(t){return A()?.orbs?.profiles?.[t]?.matrix||T(t)}function _t(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||F:w(p?.methodology||v())?.orbs?.pair_strategy||F}function dt(t){return $(`astro.sign.${t}`,window.Symbols?.signNamesRu?.[t]||t)}function Bt(t){return window.Symbols?.signs?.[t]||String(t||"").slice(0,2)||"•"}function Et(t){let e=r(dt(t)),n=r(Bt(t));return`<span class="astro-symbol" aria-hidden="true" title="${e}">${n}</span>`}function Kt(t){return j().find(e=>e?.name===t)?.opposite||null}function G(){let t=A();return t.dignities=k(t.dignities||{},b?.default_dignities||{}),t.dignities}function vt(t={}){let e=it(),n=Object.fromEntries(e.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return j().forEach(o=>{let s=o?.name,i=o?.opposite,a=t?.signs?.[s]||{};a.ruler&&n[a.ruler]&&(n[a.ruler].domicile_primary.push(s),i&&n[a.ruler].detriment_primary.push(i)),a.co_ruler&&n[a.co_ruler]&&(n[a.co_ruler].domicile_secondary.push(s),i&&n[a.co_ruler].detriment_secondary.push(i)),a.exaltation&&n[a.exaltation]&&(n[a.exaltation].exaltation.push(s),i&&n[a.exaltation].fall.push(i))}),n}function z(t=[],{mode:e="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return j().map(s=>{let i=s?.name,a=t.includes(i)||o.has(i),c=o.has(i),u=["account-settings-dignity-glyph",a?"is-active":"",c?"is-secondary":"",e==="derived"?"is-derived":""].filter(Boolean).join(" "),l=r(dt(i)),d=r(`${l} · ${f(a?c?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${e}"
                    data-dignity-sign="${i}"
                    title="${d}"
                    aria-label="${d}"
                    ${e==="derived"?"disabled":""}
                >${Et(i)}</button>
            `}).join("")}function ut(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let s=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",s),o.setAttribute("aria-selected",s?"true":"false"),e&&s&&o.id&&e.setAttribute("aria-labelledby",o.id)}),t&&(t.textContent=f(`page.accountSettings.orbs.hints.${y}`)),n&&n.classList.toggle("hidden",y!=="prognostic")}function mt(){let t=document.getElementById("accountOrbMatrixPanel"),e=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===C;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),t?.classList.toggle("is-compact",C==="compact"),e?.classList.toggle("is-compact",C==="compact")}function K(){let t=A(),e=T(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,s=n.dataset.orbBody;!o||!s||(e[o]||(e[o]={}),e[o][s]=Number.parseFloat(n.value)||0)}),t.orbs.profiles[y]={matrix:e}}function $t(t,{rerender:e=!0}={}){U.includes(t)&&(p&&K(),y=t,ut(),e&&p&&Q(p.methodology))}function xt(t){["default","compact"].includes(t)&&(C=t,localStorage.setItem(et,t),mt())}function Pt(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=M().map(n=>{let o=n.aspect_type,s=r(Y(o)),i=r(O(o)),a=W.map(c=>{let u=t?.[c]?.aspects?.enabled_types||[],B=new Set(Array.isArray(u)&&u.length?u:tt).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${c}"
                                data-aspect-type="${o}"
                                ${B}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${c}`,c)}: ${i}`)}"
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
            `}).join(""))}function Mt(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=wt().map(n=>{let o=r(g(n)),s=L(n,{size:18,title:g(n)}),i=W.map(a=>{let c=st(t?.[a]?.matrix?.rows||{}),u=c?.[n]?.display!==!1?"checked":"",l=c?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${l}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function Q(t={}){let e=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!e||!n)return;let o=D(),s=M(),a=w(t||v())?.orbs?.profiles?.[y]?.matrix||T(y);e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(c=>{let u=r(g(c)),l=L(c,{size:18,title:g(c)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${u}" aria-label="${u}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=s.map(c=>{let u=c.aspect_type,l=r(Y(u)),B=r(O(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${B}" aria-label="${B}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(d=>{let m=a?.[u]?.[d],h=r(g(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(m))?Number(m):Number(c.base_orb||5)}"
                                    aria-label="${r(`${B} · ${h}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),ut(),mt()}function gt(t={}){let e=document.getElementById("accountDignitiesMatrixBody");if(!e)return;let n=k(t?.dignities||{},b?.default_dignities||{}),o=vt(n);e.innerHTML=it().map(s=>{let i=r(g(s)),a=o[s]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
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
                            ${z(a.domicile_primary,{mode:"domicile",secondarySigns:a.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${z(a.detriment_primary,{mode:"derived",secondarySigns:a.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${s}">
                            ${z(a.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${z(a.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function Tt(t,e){let n=G(),o={...n.signs?.[t]||{}};o.ruler===e?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===e?o.co_ruler=null:o.ruler?o.co_ruler=e:o.ruler=e,n.signs[t]=o,A().dignities=k(n,b?.default_dignities||{})}function It(t,e){let n=G(),o={...n.signs?.[t]||{}};o.exaltation=o.exaltation===e?null:e,n.signs[t]=o,A().dignities=k(n,b?.default_dignities||{})}function Ct(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!n)return;let o=t?.balances||{},s=o?.planet_weights||{},i=o?.special_point_weights||{},c=D().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=c.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(l))}" aria-label="${r(g(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:g(l)})}
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
                        value="${Number(s?.[l]??1).toFixed(1)}"
                        data-balance-planet="${l}"
                        aria-label="${r(g(l))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=u.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(l))}" aria-label="${r(g(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:g(l)})}
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
                        value="${Number(i?.[l]??0).toFixed(1)}"
                        data-balance-special-point="${l}"
                        aria-label="${r(g(l))}"
                    >
                </td>
            </tr>
        `).join("")}function Lt(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let n=P(t);e.innerHTML=M().map(o=>{let s=o.aspect_type,i=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(s,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(O(s))}" aria-label="${r(O(s))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(Y(s))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(i)}"
                            data-aspect-color="${s}"
                            aria-label="${r(O(s))}"
                        >
                    </td>
                </tr>
            `}).join("")}function Ot(t={}){let e=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!e||!n)return;let o=P(t),s=o?.planet_colors?.element_palette||{},i=o?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(s).map(a=>`
            <tr>
                <th scope="row">${r(a)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(s[a])}" data-element-color="${a}" aria-label="${r(a)}"></td>
            </tr>
        `).join(""),n.innerHTML=D().map(a=>{let c=ht(a,o),u=!!i?.[a],l=i?.[a]||c;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(a))}" aria-label="${r(g(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(at(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${r(l)}"
                                data-body-color-override="${a}"
                                data-body-color-active="${u?"true":"false"}"
                                data-body-color-default="${r(c)}"
                                aria-label="${r(g(a))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${u?"":" is-muted"}"
                                data-clear-body-color-override="${a}"
                                title="${r(f("common.reset"))}"
                                aria-label="${r(`${f("common.reset")}: ${g(a)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function H(t){let e={...rt(),...t||{},chart_defaults:{natal:x(t?.chart_defaults?.natal||{}),biwheel:x(t?.chart_defaults?.biwheel||{}),solar:x(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:w(t?.methodology||v()),visual:P(t?.visual||ct())};p=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),U.includes(y)||(y="natal");let n=document.getElementById("accountHouseSystemSelect");n&&(n.value=e.chart_creation_defaults.house_system||"P");let o=document.getElementById("accountOrbPairStrategySelect");o&&(o.value=e.methodology?.orbs?.pair_strategy||F);let s=document.getElementById("accountStationaryThresholdPercent");s&&(s.value=String(e.methodology?.stationary?.threshold_percent??5)),W.forEach(i=>{let a=e.chart_defaults[i],c=lt(i);c.orientation&&(c.orientation.value=a.view_options?.orientation==="asc"?"asc":"aries"),c.aspectScope&&(c.aspectScope.value=a.aspects?.scope||(i==="biwheel"?"major":"all")),c.showApplyingSeparating&&(c.showApplyingSeparating.checked=a.aspects?.show_applying_separating===!0),c.showSpeed&&(c.showSpeed.checked=a.table_options?.show_speed!==!1),c.showStationary&&(c.showStationary.checked=a.table_options?.show_stationary!==!1),c.showAspectText&&(c.showAspectText.checked=a.table_options?.show_aspect_text===!0)}),Pt(e.chart_defaults),Mt(e.chart_defaults),Q(e.methodology),gt(e.methodology),Ct(e.methodology),Lt(e.visual),Ot(e.visual)}function kt(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&e.push(n.dataset.aspectType)}),e.length?e:M().map(n=>n.aspect_type)}function Dt(t){let e=st({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,s=n.dataset.matrixField;!o||!s||(e[o]={...e[o]||{display:!0,aspecting:!0},[s]:n.checked})}),e}function X(t){let e=lt(t);return{matrix:{rows:Dt(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:kt(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0,show_aspect_text:e.showAspectText?.checked===!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function Rt(){K();let e=(w(p?.methodology||v())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(n[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(o[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),w({orbs:{version:2,pair_strategy:_t(),profiles:e},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:k(p?.methodology?.dignities||G(),b?.default_dignities||{})})}function Nt(){let t={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(t[o.dataset.aspectColor]=o.value)});let e={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(e[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let s=o.dataset.bodyColorOverride,i=String(o.value||"").trim();s&&i&&o.dataset.bodyColorActive!=="false"&&(n[s]=i)}),P({aspect_colors:t,planet_colors:{element_palette:e,body_overrides:n}})}function Ft(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:Rt(),visual:Nt()}}function _(t,e="info"){let n=document.getElementById("accountSettingsToast");!n||!t||(n.textContent=t,n.className=`toast ${e}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(nt),nt=setTimeout(()=>{n.classList.remove("visible")},2800))}function pt(){let t=document.querySelector(".account-settings-header");if(t instanceof HTMLElement){t.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function J(t,{final:e=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!t){n.classList.add("hidden"),n.textContent="";return}let o=Number(t.progress_total||0),s=Number(t.progress_done||0),i=o>0?Math.min(100,Math.round(s/o*100)):0,c=`${String(t.status||"pending").toUpperCase()} · ${s}/${o||"0"} · ${i}%`,u=Number(t.failed_count||0),l=u?` · failures: ${u}`:"";n.textContent=e?`${c}${l}`:`${c}${l}`,n.classList.remove("hidden"),n.dataset.status=String(t.status||"pending")}function Z(){I&&(clearTimeout(I),I=null)}async function yt(t){if(Z(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(q,String(t));let e=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(t);if(J(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(q),_(`Methodology recalculation finished${n.failed_count?` with ${n.failed_count} failures`:""}.`,n.failed_count?"info":"success"),Z();return}if(n.status==="failed"){sessionStorage.removeItem(q),_(n.error||"Methodology recalculation failed.","error"),Z();return}I=setTimeout(e,2500)}catch(n){I=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await e()}async function qt(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?f("page.accountSettings.subtitleWithEmail",{email:t.email}):f("page.accountSettings.subtitle"));let[n,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);b=n||null,H(o);let s=sessionStorage.getItem(q);s?yt(s).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):J(null),ot()}async function Vt(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=Ft(),n=!St(w(p?.methodology||{}),e.methodology),o=await window.AstroAPI.patchAccountPreferences(e);if(H(o),n&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});J(s),yt(s.job_id).catch(i=>{console.warn("Failed to poll methodology recalculation job:",i)}),_("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(pt);return}_(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(pt)}catch(e){_(e.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function jt(){H(rt()),J(null),_(f("page.accountSettings.toasts.restored"),"info")}function R({restoreFocus:t=!0}={}){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");e&&e.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),t&&V instanceof HTMLElement&&V.focus(),V=null}function zt(){let t=document.getElementById("accountSettingsResetConfirmDialog"),e=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!t||!e||(V=document.activeElement instanceof HTMLElement?document.activeElement:null,e.classList.remove("hidden"),t.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{C=localStorage.getItem(et)==="compact"?"compact":"default";let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),s=document.getElementById("accountDignitiesMatrixBody"),i=document.getElementById("accountBodyOverrideColorsBody"),a=document.getElementById("accountSettingsResetConfirmDialog"),c=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),B=document.getElementById("accountSettingsResetConfirmSubmit");t?.addEventListener("click",()=>{Vt()}),e?.addEventListener("click",()=>{zt()}),c?.addEventListener("click",()=>{R()}),u?.addEventListener("click",()=>{R()}),l?.addEventListener("click",()=>{R()}),B?.addEventListener("click",()=>{R({restoreFocus:!1}),jt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{$t(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{xt(d.dataset.orbViewMode||"default")})}),n?.addEventListener("click",()=>{K();let d=A();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(At("natal")))},y="prognostic",Q(d),_(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let m=d.target;if(!(m instanceof HTMLInputElement)||!m.dataset.orbAspectType||!m.dataset.orbBody)return;let h=A(),E=(h.orbs.profiles[y]||{matrix:T(y)}).matrix||T(y);E[m.dataset.orbAspectType]||(E[m.dataset.orbAspectType]={}),E[m.dataset.orbAspectType][m.dataset.orbBody]=Number.parseFloat(m.value)||0,h.orbs.profiles[y]={matrix:E}}),s?.addEventListener("click",d=>{let m=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(m instanceof HTMLButtonElement))return;let h=m.dataset.dignityMode,S=m.dataset.dignitySign,E=m.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!h||!S||!E||h==="derived"||(h==="domicile"?Tt(S,E):h==="exaltation"&&It(S,E),gt(p?.methodology||A()))}),i?.addEventListener("input",d=>{let m=d.target;if(!(m instanceof HTMLInputElement)||!m.dataset.bodyColorOverride)return;m.dataset.bodyColorActive="true",i.querySelector(`[data-clear-body-color-override="${m.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),i?.addEventListener("click",d=>{let m=d.target.closest("[data-clear-body-color-override]");if(!(m instanceof HTMLElement))return;let h=m.dataset.clearBodyColorOverride;if(!h)return;let S=i.querySelector(`[data-body-color-override="${h}"]`);S instanceof HTMLInputElement&&(S.dataset.bodyColorActive="false",S.value=S.dataset.bodyColorDefault||"#6b7280",m.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await qt(),document.addEventListener("frontend:locale-changed",()=>{p&&H(p)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!a||a.classList.contains("hidden")||R())})}catch(d){_(d.message||f("page.accountSettings.toasts.loadFailed"),"error"),ot()}})})();
