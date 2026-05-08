import{a as Wt}from"./chunks/chunk-Y2OAENFL.js";import"./chunks/chunk-NLSSWA2H.js";import"./chunks/chunk-YBGVRB7X.js";import{b as N,d as jt,e as Ht,f as zt,g as Jt}from"./chunks/chunk-E24Q6PJF.js";var Gt=N(jt()),Kt=N(Ht()),Qt=N(zt());var Zt=N(Jt()),te=N(Wt());(function(){"use strict";let J=["natal","biwheel","solar"],tt=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],W=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",q="activePreferenceRecalcJobId",et="accountOrbViewMode",ft=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),g=null,h=null,nt=null,T=null,y="natal",I="default",V=null;function ot(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let t=document.getElementById("pageLoader");t&&(t.classList.add("fade-out"),setTimeout(()=>t.remove(),460))}function f(t,e){return window.FrontendI18n?.t?.(t,e)||t}function i(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $(t,e=""){let n=f(t);return n&&n!==t?n:e}function p(t){return $(`astro.planet.${t}`,window.Symbols?.getPlanetNameRu?.(t)||t)}function at(t){return window.Symbols?.getPlanetSymbol?.(t)||String(t||"").slice(0,2)||"•"}function L(t,e={}){return window.Symbols?.getPlanetSymbolMarkup?.(t,e)||`<span class="astro-symbol" aria-hidden="true">${i(at(t))}</span>`}function O(t){return $(`astro.aspect.${t}`,t)}function U(t){return window.Symbols?.getAspectDisplay?.(t)||window.Symbols?.aspects?.[t]||String(t||"").slice(0,3)||"•"}function bt(t,e){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(t,e):JSON.stringify(t??null)===JSON.stringify(e??null)}function x(t={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(t):t}function S(t={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(t):t}function C(t={},e={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(t,e):t}function k(t={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t):t||{}}function st(t={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(t||{}):t||{}}function ht(){return window.AstroPreferences?.MATRIX_BODIES||[]}function P(){return h?.aspect_types||tt.map(t=>({aspect_type:t}))}function Ut(t){return P().find(e=>e?.aspect_type===t)||null}function D(){return(h?.bodies||[]).map(t=>t?.name).filter(Boolean)}function Y(){return h?.signs||[]}function ct(){return D().filter(t=>!ft.has(t))}function M(t="natal"){let e=P(),n=D();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(e,n,t):Object.fromEntries(e.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,t==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function E(){let t={version:2,pair_strategy:F,profiles:Object.fromEntries(W.map(e=>[e,{matrix:M(e)}]))};return S({orbs:t,balances:h?.default_balance_targets||{},dignities:h?.default_dignities||{version:1,signs:{}}})}function it(){return k(h?.default_visual_palettes||{})}function rt(){return{chart_defaults:{natal:x({}),biwheel:x({aspects:{scope:"major"}}),solar:x({})},chart_creation_defaults:{house_system:"P"},methodology:E(),visual:it()}}function lt(t){return t==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:t==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function w(){return g||(g={methodology:E()}),g.methodology=S(g.methodology||E()),g.methodology}function St(t){return w()?.orbs?.profiles?.[t]?.matrix||M(t)}function wt(){let t=document.getElementById("accountOrbPairStrategySelect");return t?window.AstroPreferences?.normalizeOrbPairStrategy?.(t.value)||F:S(g?.methodology||E())?.orbs?.pair_strategy||F}function dt(t){return $(`astro.sign.${t}`,window.Symbols?.signNamesRu?.[t]||t)}function At(t){return window.Symbols?.signs?.[t]||String(t||"").slice(0,2)||"•"}function _t(t){let e=i(dt(t)),n=i(At(t));return`<span class="astro-symbol" aria-hidden="true" title="${e}">${n}</span>`}function Yt(t){return Y().find(e=>e?.name===t)?.opposite||null}function G(){let t=w();return t.dignities=C(t.dignities||{},h?.default_dignities||{}),t.dignities}function Bt(t={}){let e=ct(),n=Object.fromEntries(e.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return Y().forEach(o=>{let a=o?.name,c=o?.opposite,s=t?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function j(t=[],{mode:e="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return Y().map(a=>{let c=a?.name,s=t.includes(c)||o.has(c),r=o.has(c),m=["account-settings-dignity-glyph",s?"is-active":"",r?"is-secondary":"",e==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(dt(c)),d=i(`${l} · ${f(s?r?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${m}"
                    data-dignity-mode="${e}"
                    data-dignity-sign="${c}"
                    title="${d}"
                    aria-label="${d}"
                    ${e==="derived"?"disabled":""}
                >${_t(c)}</button>
            `}).join("")}function ut(){let t=document.getElementById("accountOrbProfileHint"),e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),e&&a&&o.id&&e.setAttribute("aria-labelledby",o.id)}),t&&(t.textContent=f(`page.accountSettings.orbs.hints.${y}`)),n&&n.classList.toggle("hidden",y!=="prognostic")}function mt(){let t=document.getElementById("accountOrbMatrixPanel"),e=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===I;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),t?.classList.toggle("is-compact",I==="compact"),e?.classList.toggle("is-compact",I==="compact")}function K(){let t=w(),e=M(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(e[o]||(e[o]={}),e[o][a]=Number.parseFloat(n.value)||0)}),t.orbs.profiles[y]={matrix:e}}function Et(t,{rerender:e=!0}={}){W.includes(t)&&(g&&K(),y=t,ut(),e&&g&&Q(g.methodology))}function vt(t){["default","compact"].includes(t)&&(I=t,localStorage.setItem(et,t),mt())}function $t(t={}){let e=document.getElementById("accountAspectTypesMatrixBody");e&&(e.innerHTML=P().map(n=>{let o=n.aspect_type,a=i(U(o)),c=i(O(o)),s=J.map(r=>{let m=t?.[r]?.aspects?.enabled_types||[],_=new Set(Array.isArray(m)&&m.length?m:tt).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${r}"
                                data-aspect-type="${o}"
                                ${_}
                                aria-label="${i(`${$(`page.accountSettings.tables.columns.${r}`,r)}: ${c}`)}"
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
            `}).join(""))}function xt(t={}){let e=document.getElementById("accountBodiesMatrixBody");e&&(e.innerHTML=ht().map(n=>{let o=i(p(n)),a=L(n,{size:18,title:p(n)}),c=J.map(s=>{let r=st(t?.[s]?.matrix?.rows||{}),m=r?.[n]?.display!==!1?"checked":"",l=r?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${m}
                                aria-label="${i(`${$(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${i(`${$(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${f("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function Q(t={}){let e=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!e||!n)return;let o=D(),a=P(),s=S(t||E())?.orbs?.profiles?.[y]?.matrix||M(y);e.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let m=i(p(r)),l=L(r,{size:18,title:p(r)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                ${l}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(r=>{let m=r.aspect_type,l=i(U(m)),_=i(O(m));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${_}" aria-label="${_}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(d=>{let u=s?.[m]?.[d],b=i(p(d));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(r.base_orb||5)}"
                                    aria-label="${i(`${_} · ${b}`)}"
                                    data-orb-aspect-type="${m}"
                                    data-orb-body="${d}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),ut(),mt()}function pt(t={}){let e=document.getElementById("accountDignitiesMatrixBody");if(!e)return;let n=C(t?.dignities||{},h?.default_dignities||{}),o=Bt(n);e.innerHTML=ct().map(a=>{let c=i(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
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
                            ${j(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${j(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${j(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${j(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function Pt(t,e){let n=G(),o={...n.signs?.[t]||{}};o.ruler===e?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===e?o.co_ruler=null:o.ruler?o.co_ruler=e:o.ruler=e,n.signs[t]=o,w().dignities=C(n,h?.default_dignities||{})}function Mt(t,e){let n=G(),o={...n.signs?.[t]||{}};o.exaltation=o.exaltation===e?null:e,n.signs[t]=o,w().dignities=C(n,h?.default_dignities||{})}function Tt(t={}){let e=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!e||!n)return;let o=t?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},r=D().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),m=["TrueNorthNode","TrueSouthNode","BlackMoon"];e.innerHTML=r.map(l=>`
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
        `).join(""),n.innerHTML=m.map(l=>`
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
        `).join("")}function It(t={}){let e=document.getElementById("accountAspectColorsBody");if(!e)return;let n=k(t);e.innerHTML=P().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(O(a))}" aria-label="${i(O(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(U(a))}</span>
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
            `}).join("")}function Lt(t={}){let e=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!e||!n)return;let o=k(t),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{};e.innerHTML=Object.keys(a).map(s=>`
            <tr>
                <th scope="row">${i(s)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[s])}" data-element-color="${s}" aria-label="${i(s)}"></td>
            </tr>
        `).join(""),n.innerHTML=D().map(s=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                    <span class="account-settings-body account-settings-body--icon-only">
                        <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(s))}" aria-label="${i(p(s))}" role="img" tabindex="0">
                            <span class="astro-symbol" aria-hidden="true">${i(at(s))}</span>
                        </span>
                    </span>
                </th>
                <td>
                    <div class="account-settings-color-stack">
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${i(c?.[s]||"#c7b49a")}"
                            data-body-color-override="${s}"
                            data-body-color-active="${c?.[s]?"true":"false"}"
                            aria-label="${i(p(s))}"
                        >
                        <button
                            type="button"
                            class="account-settings-reset-chip${c?.[s]?"":" is-muted"}"
                            data-clear-body-color-override="${s}"
                            title="${i(f("common.reset"))}"
                            aria-label="${i(`${f("common.reset")}: ${p(s)}`)}"
                        >↺</button>
                    </div>
                </td>
            </tr>
        `).join("")}function H(t){let e={...rt(),...t||{},chart_defaults:{natal:x(t?.chart_defaults?.natal||{}),biwheel:x(t?.chart_defaults?.biwheel||{}),solar:x(t?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:t?.chart_creation_defaults?.house_system||"P"},methodology:S(t?.methodology||E()),visual:k(t?.visual||it())};g=e,window.AstroPreferences?.setAccountVisualPreferences?.(e.visual),W.includes(y)||(y="natal");let n=document.getElementById("accountHouseSystemSelect");n&&(n.value=e.chart_creation_defaults.house_system||"P");let o=document.getElementById("accountOrbPairStrategySelect");o&&(o.value=e.methodology?.orbs?.pair_strategy||F);let a=document.getElementById("accountStationaryThresholdPercent");a&&(a.value=String(e.methodology?.stationary?.threshold_percent??5)),J.forEach(c=>{let s=e.chart_defaults[c],r=lt(c);r.orientation&&(r.orientation.value=s.view_options?.orientation==="asc"?"asc":"aries"),r.aspectScope&&(r.aspectScope.value=s.aspects?.scope||(c==="biwheel"?"major":"all")),r.showApplyingSeparating&&(r.showApplyingSeparating.checked=s.aspects?.show_applying_separating===!0),r.showSpeed&&(r.showSpeed.checked=s.table_options?.show_speed!==!1),r.showStationary&&(r.showStationary.checked=s.table_options?.show_stationary!==!1),r.showAspectText&&(r.showAspectText.checked=s.table_options?.show_aspect_text===!0)}),$t(e.chart_defaults),xt(e.chart_defaults),Q(e.methodology),pt(e.methodology),Tt(e.methodology),It(e.visual),Lt(e.visual)}function Ot(t){let e=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${t}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&e.push(n.dataset.aspectType)}),e.length?e:P().map(n=>n.aspect_type)}function Ct(t){let e=st({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${t}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(e[o]={...e[o]||{display:!0,aspecting:!0},[a]:n.checked})}),e}function X(t){let e=lt(t);return{matrix:{rows:Ct(t)},aspects:{scope:e.aspectScope?.value||(t==="biwheel"?"major":"all"),enabled_types:Ot(t),show_applying_separating:e.showApplyingSeparating?.checked===!0},table_options:{show_speed:e.showSpeed?e.showSpeed.checked!==!1:!0,show_stationary:e.showStationary?e.showStationary.checked!==!1:!0,show_aspect_text:e.showAspectText?.checked===!0},view_options:{orientation:e.orientation?.value==="asc"?"asc":"aries"}}}function kt(){K();let e=(S(g?.methodology||E())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),S({orbs:{version:2,pair_strategy:wt(),profiles:e},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:C(g?.methodology?.dignities||G(),h?.default_dignities||{})})}function Dt(){let t={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(t[o.dataset.aspectColor]=o.value)});let e={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(e[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),k({aspect_colors:t,planet_colors:{element_palette:e,body_overrides:n}})}function Rt(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:kt(),visual:Dt()}}function A(t,e="info"){let n=document.getElementById("accountSettingsToast");!n||!t||(n.textContent=t,n.className=`toast ${e}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(nt),nt=setTimeout(()=>{n.classList.remove("visible")},2800))}function gt(){let t=document.querySelector(".account-settings-header");if(t instanceof HTMLElement){t.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function z(t,{final:e=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!t){n.classList.add("hidden"),n.textContent="";return}let o=Number(t.progress_total||0),a=Number(t.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,r=`${String(t.status||"pending").toUpperCase()} · ${a}/${o||"0"} · ${c}%`,m=Number(t.failed_count||0),l=m?` · failures: ${m}`:"";n.textContent=e?`${r}${l}`:`${r}${l}`,n.classList.remove("hidden"),n.dataset.status=String(t.status||"pending")}function Z(){T&&(clearTimeout(T),T=null)}async function yt(t){if(Z(),!t||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(q,String(t));let e=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(t);if(z(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(q),A(`Methodology recalculation finished${n.failed_count?` with ${n.failed_count} failures`:""}.`,n.failed_count?"info":"success"),Z();return}if(n.status==="failed"){sessionStorage.removeItem(q),A(n.error||"Methodology recalculation failed.","error"),Z();return}T=setTimeout(e,2500)}catch(n){T=setTimeout(e,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await e()}async function Nt(){let t=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!t)return;let e=document.getElementById("accountSettingsSubtitle");e&&(e.textContent=t.email?f("page.accountSettings.subtitleWithEmail",{email:t.email}):f("page.accountSettings.subtitle"));let[n,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);h=n||null,H(o);let a=sessionStorage.getItem(q);a?yt(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):z(null),ot()}async function Ft(){let t=document.getElementById("saveAccountSettingsBtn");t&&(t.disabled=!0);try{let e=Rt(),n=!bt(S(g?.methodology||{}),e.methodology),o=await window.AstroAPI.patchAccountPreferences(e);if(H(o),n&&window.AstroAPI?.createPreferenceRecalcJob){let a=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings"}});z(a),yt(a.job_id).catch(c=>{console.warn("Failed to poll methodology recalculation job:",c)}),A("Preferences saved. Methodology recalculation started.","success"),requestAnimationFrame(gt);return}A(f("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(gt)}catch(e){A(e.message||f("page.accountSettings.toasts.saveFailed"),"error")}finally{t&&(t.disabled=!1)}}function qt(){H(rt()),z(null),A(f("page.accountSettings.toasts.restored"),"info")}function R({restoreFocus:t=!0}={}){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");e&&e.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),t&&V instanceof HTMLElement&&V.focus(),V=null}function Vt(){let t=document.getElementById("accountSettingsResetConfirmDialog"),e=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!t||!e||(V=document.activeElement instanceof HTMLElement?document.activeElement:null,e.classList.remove("hidden"),t.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{I=localStorage.getItem(et)==="compact"?"compact":"default";let t=document.getElementById("saveAccountSettingsBtn"),e=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),r=document.getElementById("accountSettingsResetConfirmBackdrop"),m=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),_=document.getElementById("accountSettingsResetConfirmSubmit");t?.addEventListener("click",()=>{Ft()}),e?.addEventListener("click",()=>{Vt()}),r?.addEventListener("click",()=>{R()}),m?.addEventListener("click",()=>{R()}),l?.addEventListener("click",()=>{R()}),_?.addEventListener("click",()=>{R({restoreFocus:!1}),qt()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(d=>{d.addEventListener("click",()=>{Et(d.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(d=>{d.addEventListener("click",()=>{vt(d.dataset.orbViewMode||"default")})}),n?.addEventListener("click",()=>{K();let d=w();d.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(St("natal")))},y="prognostic",Q(d),A(f("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.orbAspectType||!u.dataset.orbBody)return;let b=w(),B=(b.orbs.profiles[y]||{matrix:M(y)}).matrix||M(y);B[u.dataset.orbAspectType]||(B[u.dataset.orbAspectType]={}),B[u.dataset.orbAspectType][u.dataset.orbBody]=Number.parseFloat(u.value)||0,b.orbs.profiles[y]={matrix:B}}),a?.addEventListener("click",d=>{let u=d.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(u instanceof HTMLButtonElement))return;let b=u.dataset.dignityMode,v=u.dataset.dignitySign,B=u.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!b||!v||!B||b==="derived"||(b==="domicile"?Pt(v,B):b==="exaltation"&&Mt(v,B),pt(g?.methodology||w()))}),c?.addEventListener("input",d=>{let u=d.target;if(!(u instanceof HTMLInputElement)||!u.dataset.bodyColorOverride)return;u.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${u.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),c?.addEventListener("click",d=>{let u=d.target.closest("[data-clear-body-color-override]");if(!(u instanceof HTMLElement))return;let b=u.dataset.clearBodyColorOverride;if(!b)return;let v=c.querySelector(`[data-body-color-override="${b}"]`);v instanceof HTMLInputElement&&(v.dataset.bodyColorActive="false",u.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Nt(),document.addEventListener("frontend:locale-changed",()=>{g&&H(g)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&(!s||s.classList.contains("hidden")||R())})}catch(d){A(d.message||f("page.accountSettings.toasts.loadFailed"),"error"),ot()}})})();
