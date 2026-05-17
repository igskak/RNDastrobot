import{a as tt}from"./chunks/chunk-GLKIR6GI.js";import"./chunks/chunk-YBGVRB7X.js";import{b as R,d as Qe,e as Xe,f as Ze,g as et}from"./chunks/chunk-AKKGPULT.js";var at=R(Qe()),st=R(Xe()),it=R(Ze());var ct=R(et()),lt=R(tt());(function(){"use strict";let J=["natal","biwheel","solar"],ee=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],U=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic"],F=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",Y="activePreferenceRecalcJobId",te="accountOrbViewMode",we=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),y=null,ne=null,h=null,oe=null,I=null,f="natal",C="default",q=null;function ae(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function b(e,n){return window.FrontendI18n?.t?.(e,n)||e}function _e(){let e=document.querySelector(".account-settings-back");if(!e)return;let n=window.AstroAPI?.getNavigationState?.()||{};e.href=n.sourceUrl||"/"}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $(e,n=""){let t=b(e);return t&&t!==e?t:n}function g(e){return $(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function se(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function L(e,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,n)||`<span class="astro-symbol" aria-hidden="true">${r(se(e))}</span>`}function Ae(e){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,t=h?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},s=V().map(a=>a?.name).filter(Boolean),i=s.length?s:Object.keys(t);for(let a of i)if(t?.[a]?.ruler===n)return o[a]||null;for(let a of i)if(t?.[a]?.co_ruler===n)return o[a]||null;for(let a of i)if(t?.[a]?.exaltation===n)return o[a]||null;return null}function Ee(e,n={}){let t=x(n),o=Ae(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,t):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,t):"#6b7280"}function O(e){return $(`astro.aspect.${e}`,e)}function G(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Be(e,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,n):JSON.stringify(e??null)===JSON.stringify(n??null)}function ve(e){return e==null?e:JSON.parse(JSON.stringify(e))}function P(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function _(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function D(e={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,n):e}function x(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function ie(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function $e(){return window.AstroPreferences?.MATRIX_BODIES||[]}function M(){return h?.aspect_types||ee.map(e=>({aspect_type:e}))}function nt(e){return M().find(n=>n?.aspect_type===e)||null}function k(){return(h?.bodies||[]).map(e=>e?.name).filter(Boolean)}function V(){return h?.signs||[]}function re(){return k().filter(e=>!we.has(e))}function T(e="natal"){let n=M(),t=k();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,t,e):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(t.map(s=>[s,e==="prognostic"?s==="Moon"?3:1:Number(o.base_orb||5)]))]))}function v(){let e={version:2,pair_strategy:F,profiles:Object.fromEntries(U.map(n=>[n,{matrix:T(n)}]))};return _({orbs:e,balances:h?.default_balance_targets||{},dignities:h?.default_dignities||{version:1,signs:{}}})}function ce(){return x(h?.default_visual_palettes||{})}function le(){return{chart_defaults:{natal:P({}),biwheel:P({aspects:{scope:"major"}}),solar:P({})},chart_creation_defaults:{house_system:"P"},methodology:v(),visual:ce()}}function de(){return document.getElementById("accountTimezoneLabelFormatSelect")}function ue(){return document.getElementById("accountDateFormatSelect")}function me(){return document.getElementById("accountDegreeFormatSelect")}function ge(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function A(){return y||(y={methodology:v()}),y.methodology=_(y.methodology||v()),y.methodology}function Pe(e){return A()?.orbs?.profiles?.[e]?.matrix||T(e)}function xe(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||F:_(y?.methodology||v())?.orbs?.pair_strategy||F}function pe(e){return $(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Me(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Te(e){let n=r(pe(e)),t=r(Me(e));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${t}</span>`}function ot(e){return V().find(n=>n?.name===e)?.opposite||null}function W(){let e=A();return e.dignities=D(e.dignities||{},h?.default_dignities||{}),e.dignities}function Ie(e={}){let n=re(),t=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return V().forEach(o=>{let s=o?.name,i=o?.opposite,a=e?.signs?.[s]||{};a.ruler&&t[a.ruler]&&(t[a.ruler].domicile_primary.push(s),i&&t[a.ruler].detriment_primary.push(i)),a.co_ruler&&t[a.co_ruler]&&(t[a.co_ruler].domicile_secondary.push(s),i&&t[a.co_ruler].detriment_secondary.push(i)),a.exaltation&&t[a.exaltation]&&(t[a.exaltation].exaltation.push(s),i&&t[a.exaltation].fall.push(i))}),t}function z(e=[],{mode:n="derived",secondarySigns:t=[]}={}){let o=new Set(t||[]);return V().map(s=>{let i=s?.name,a=e.includes(i)||o.has(i),d=o.has(i),u=["account-settings-dignity-glyph",a?"is-active":"",d?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),c=r(pe(i)),l=r(`${c} · ${b(a?d?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${u}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${i}"
                    title="${l}"
                    aria-label="${l}"
                    ${n==="derived"?"disabled":""}
                >${Te(i)}</button>
            `}).join("")}function fe(){let e=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let s=o.dataset.orbProfileTab===f;o.classList.toggle("is-active",s),o.setAttribute("aria-selected",s?"true":"false"),n&&s&&o.id&&n.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=b(`page.accountSettings.orbs.hints.${f}`)),t&&t.classList.toggle("hidden",f!=="prognostic")}function ye(){let e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(t=>{let o=t.dataset.orbViewMode===C;t.classList.toggle("is-active",o),t.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",C==="compact"),n?.classList.toggle("is-compact",C==="compact")}function K(){let e=A(),n=T(f);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(t=>{let o=t.dataset.orbAspectType,s=t.dataset.orbBody;!o||!s||(n[o]||(n[o]={}),n[o][s]=Number.parseFloat(t.value)||0)}),e.orbs.profiles[f]={matrix:n}}function Ce(e,{rerender:n=!0}={}){U.includes(e)&&(y&&K(),f=e,fe(),n&&y&&Q(y.methodology))}function Le(e){["default","compact"].includes(e)&&(C=e,localStorage.setItem(te,e),ye())}function Oe(e={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=M().map(t=>{let o=t.aspect_type,s=r(G(o)),i=r(O(o)),a=J.map(d=>{let u=e?.[d]?.aspects?.enabled_types||[],p=new Set(Array.isArray(u)&&u.length?u:ee).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${d}"
                                data-aspect-type="${o}"
                                ${p}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${d}`,d)}: ${i}`)}"
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
            `}).join(""))}function De(e={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=$e().map(t=>{let o=r(g(t)),s=L(t,{size:18,title:g(t)}),i=J.map(a=>{let d=ie(e?.[a]?.matrix?.rows||{}),u=d?.[t]?.display!==!1?"checked":"",c=d?.[t]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${t}"
                                data-matrix-field="display"
                                ${u}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${b("page.accountSettings.matrix.columns.display")}`)}"
                            >
                        </label>
                    </td>
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${a}"
                                data-matrix-body="${t}"
                                data-matrix-field="aspecting"
                                ${c}
                                aria-label="${r(`${$(`page.accountSettings.tables.columns.${a}`,a)}: ${o} ${b("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function Q(e={}){let n=document.getElementById("accountOrbsHeaderRow"),t=document.getElementById("accountOrbsMatrixBody");if(!n||!t)return;let o=k(),s=M(),a=_(e||v())?.orbs?.profiles?.[f]?.matrix||T(f);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(d=>{let u=r(g(d)),c=L(d,{size:18,title:g(d)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${u}" aria-label="${u}" role="img" tabindex="0">
                                ${c}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,t.innerHTML=s.map(d=>{let u=d.aspect_type,c=r(G(u)),p=r(O(u));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${p}" aria-label="${p}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${c}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(l=>{let m=a?.[u]?.[l],S=r(g(l));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(m))?Number(m):Number(d.base_orb||5)}"
                                    aria-label="${r(`${p} · ${S}`)}"
                                    data-orb-aspect-type="${u}"
                                    data-orb-body="${l}"
                                    data-orb-profile="${f}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),fe(),ye()}function be(e={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let t=D(e?.dignities||{},h?.default_dignities||{}),o=Ie(t);n.innerHTML=re().map(s=>{let i=r(g(s)),a=o[s]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
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
            `}).join("")}function ke(e,n){let t=W(),o={...t.signs?.[e]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,t.signs[e]=o,A().dignities=D(t,h?.default_dignities||{})}function Ne(e,n){let t=W(),o={...t.signs?.[e]||{}};o.exaltation=o.exaltation===n?null:n,t.signs[e]=o,A().dignities=D(t,h?.default_dignities||{})}function Re(e={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),t=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!t)return;let o=e?.balances||{},s=o?.planet_weights||{},i=o?.special_point_weights||{},d=k().filter(c=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(c)),u=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=d.map(c=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(c))}" aria-label="${r(g(c))}" role="img" tabindex="0">
                                ${L(c,{size:18,title:g(c)})}
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
                        value="${Number(s?.[c]??1).toFixed(1)}"
                        data-balance-planet="${c}"
                        aria-label="${r(g(c))}"
                    >
                </td>
            </tr>
        `).join(""),t.innerHTML=u.map(c=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(c))}" aria-label="${r(g(c))}" role="img" tabindex="0">
                                ${L(c,{size:18,title:g(c)})}
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
                        value="${Number(i?.[c]??0).toFixed(1)}"
                        data-balance-special-point="${c}"
                        aria-label="${r(g(c))}"
                    >
                </td>
            </tr>
        `).join("")}function Fe(e={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let t=x(e);n.innerHTML=M().map(o=>{let s=o.aspect_type,i=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(s,t):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(O(s))}" aria-label="${r(O(s))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(G(s))}</span>
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
            `}).join("")}function Ye(e={}){let n=document.getElementById("accountElementPaletteBody"),t=document.getElementById("accountBodyOverrideColorsBody");if(!n||!t)return;let o=x(e),s=o?.planet_colors?.element_palette||{},i=o?.planet_colors?.body_overrides||{};n.innerHTML=Object.keys(s).map(a=>`
            <tr>
                <th scope="row">${r(a)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(s[a])}" data-element-color="${a}" aria-label="${r(a)}"></td>
            </tr>
        `).join(""),t.innerHTML=k().map(a=>{let d=Ee(a,o),u=!!i?.[a],c=i?.[a]||d;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(g(a))}" aria-label="${r(g(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(se(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${r(c)}"
                                data-body-color-override="${a}"
                                data-body-color-active="${u?"true":"false"}"
                                data-body-color-default="${r(d)}"
                                aria-label="${r(g(a))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${u?"":" is-muted"}"
                                data-clear-body-color-override="${a}"
                                title="${r(b("common.reset"))}"
                                aria-label="${r(`${b("common.reset")}: ${g(a)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function j(e,{updateBaseline:n=!1}={}){let t={...le(),...e||{},chart_defaults:{natal:P(e?.chart_defaults?.natal||{}),biwheel:P(e?.chart_defaults?.biwheel||{}),solar:P(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:_(e?.methodology||v()),visual:x(e?.visual||ce())};y=t,n&&(ne=ve(t.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),U.includes(f)||(f="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let s=de();s&&(s.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let i=ue();if(i){let c=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(t.visual?.date_format)?t.visual.date_format:"DD_MM_YYYY";i.value=c}let a=me();if(a){let c=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(t.visual?.degree_format)?t.visual.degree_format:"DEGREES_ONLY";a.value=c}let d=document.getElementById("accountOrbPairStrategySelect");d&&(d.value=t.methodology?.orbs?.pair_strategy||F);let u=document.getElementById("accountStationaryThresholdPercent");u&&(u.value=String(t.methodology?.stationary?.threshold_percent??5)),J.forEach(c=>{let p=t.chart_defaults[c],l=ge(c);l.orientation&&(l.orientation.value=p.view_options?.orientation==="asc"?"asc":"aries"),l.aspectScope&&(l.aspectScope.value=p.aspects?.scope||(c==="biwheel"?"major":"all")),l.showApplyingSeparating&&(l.showApplyingSeparating.checked=p.aspects?.show_applying_separating===!0),l.showSpeed&&(l.showSpeed.checked=p.table_options?.show_speed!==!1),l.showStationary&&(l.showStationary.checked=p.table_options?.show_stationary!==!1),l.showAspectText&&(l.showAspectText.checked=p.table_options?.show_aspect_text===!0)}),Oe(t.chart_defaults),De(t.chart_defaults),Q(t.methodology),be(t.methodology),Re(t.methodology),Fe(t.visual),Ye(t.visual)}function qe(e){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(t=>{t.checked&&t.dataset.aspectType&&n.push(t.dataset.aspectType)}),n.length?n:M().map(t=>t.aspect_type)}function Ve(e){let n=ie({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(t=>{let o=t.dataset.matrixBody,s=t.dataset.matrixField;!o||!s||(n[o]={...n[o]||{display:!0,aspecting:!0},[s]:t.checked})}),n}function X(e){let n=ge(e);return{matrix:{rows:Ve(e)},aspects:{scope:n.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:qe(e),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function ze(){K();let n=(_(y?.methodology||v())?.orbs||{})?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(s=>{s.dataset.balancePlanet&&(t[s.dataset.balancePlanet]=Number.parseFloat(s.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(s=>{s.dataset.balanceSpecialPoint&&(o[s.dataset.balanceSpecialPoint]=Number.parseFloat(s.value)||0)}),_({orbs:{version:2,pair_strategy:xe(),profiles:n},balances:{version:1,planet_weights:t,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:D(y?.methodology?.dignities||W(),h?.default_dignities||{})})}function je(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let t={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let s=o.dataset.bodyColorOverride,i=String(o.value||"").trim();s&&i&&o.dataset.bodyColorActive!=="false"&&(t[s]=i)}),x({aspect_colors:e,planet_colors:{element_palette:n,body_overrides:t},timezone_label_format:de()?.value||"UTC",date_format:ue()?.value||"DD_MM_YYYY",degree_format:me()?.value||"DEGREES_ONLY"})}function He(){return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:X("natal"),biwheel:X("biwheel"),solar:X("solar")},methodology:ze(),visual:je()}}function E(e,n="info"){let t=document.getElementById("accountSettingsToast");!t||!e||(t.textContent=e,t.className=`toast ${n}`,requestAnimationFrame(()=>t.classList.add("visible")),clearTimeout(oe),oe=setTimeout(()=>{t.classList.remove("visible")},2800))}function he(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function Je(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function H(e,{final:n=!1}={}){let t=document.getElementById("methodologyJobStatus");if(!t)return;if(!e){t.classList.add("hidden"),t.replaceChildren();return}let o=Number(e.progress_total||0),s=Number(e.progress_done||0),i=o>0?Math.min(100,Math.round(s/o*100)):0,a=String(e.status||"pending"),d=Number(e.failed_count||0),u={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:d?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},c={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:d?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},p=[o>0?`${s}/${o} карт`:"Подготовка списка карт",`${i}%`];d&&p.push(`ошибок: ${d}`),!n&&a!=="completed"&&a!=="failed"&&p.push("можно остаться на странице и дождаться завершения"),t.innerHTML=`
            <div class="account-settings-status-title">
                <span>${r(u[a]||"Пересчет карт")}</span>
                <span>${r(c[a]||String(a).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${r(p.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${i}%"></div>
            </div>
        `,t.classList.remove("hidden"),t.dataset.status=a}function Z(){I&&(clearTimeout(I),I=null)}async function Se(e){if(Z(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(Y,String(e));let n=async()=>{try{let t=await window.AstroAPI.getPreferenceRecalcJob(e);if(H(t,{final:t.status==="completed"||t.status==="failed"}),t.status==="completed"){sessionStorage.removeItem(Y),E(t.failed_count?`Пересчет завершен с ошибками: ${t.failed_count}.`:"Пересчет карт завершен.",t.failed_count?"info":"success"),await Je(),Z();return}if(t.status==="failed"){sessionStorage.removeItem(Y),E(t.error||"Пересчет карт не выполнен.","error"),Z();return}I=setTimeout(n,2500)}catch(t){I=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",t)}};await n()}async function Ue(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let n=document.getElementById("accountSettingsSubtitle");n&&(n.textContent=e.email?b("page.accountSettings.subtitleWithEmail",{email:e.email}):b("page.accountSettings.subtitle"));let[t,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);h=t||null,j(o,{updateBaseline:!0});let s=sessionStorage.getItem(Y);s?Se(s).catch(i=>{console.warn("Failed to resume recalculation job polling:",i)}):H(null),ae()}async function Ge(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let n=He(),t=localStorage.getItem("currentUserId")||null,o=!Be(_(ne||{}),n.methodology),s=await window.AstroAPI.patchAccountPreferences(n);if(j(s,{updateBaseline:!0}),o&&window.AstroAPI?.createPreferenceRecalcJob){let i=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...t?{priority_user_id:t}:{}}});H(i),Se(i.job_id).catch(a=>{console.warn("Failed to poll methodology recalculation job:",a)}),E("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(he);return}E(b("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(he)}catch(n){E(n.message||b("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function We(){j(le()),H(null),E(b("page.accountSettings.toasts.restored"),"info")}function N({restoreFocus:e=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),t&&t.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&q instanceof HTMLElement&&q.focus(),q=null}function Ke(){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),t=document.getElementById("accountSettingsResetConfirmSubmit");!e||!n||(q=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{t?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{C=localStorage.getItem(te)==="compact"?"compact":"default",_e();let e=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),t=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),s=document.getElementById("accountDignitiesMatrixBody"),i=document.getElementById("accountBodyOverrideColorsBody"),a=document.getElementById("accountSettingsResetConfirmDialog"),d=document.getElementById("accountSettingsResetConfirmBackdrop"),u=document.getElementById("accountSettingsResetConfirmClose"),c=document.getElementById("accountSettingsResetConfirmCancel"),p=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{Ge()}),n?.addEventListener("click",()=>{Ke()}),d?.addEventListener("click",()=>{N()}),u?.addEventListener("click",()=>{N()}),c?.addEventListener("click",()=>{N()}),p?.addEventListener("click",()=>{N({restoreFocus:!1}),We()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(l=>{l.addEventListener("click",()=>{Ce(l.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(l=>{l.addEventListener("click",()=>{Le(l.dataset.orbViewMode||"default")})}),t?.addEventListener("click",()=>{K();let l=A();l.orbs.profiles.prognostic={matrix:JSON.parse(JSON.stringify(Pe("natal")))},f="prognostic",Q(l),E(b("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",l=>{let m=l.target;if(!(m instanceof HTMLInputElement)||!m.dataset.orbAspectType||!m.dataset.orbBody)return;let S=A(),B=(S.orbs.profiles[f]||{matrix:T(f)}).matrix||T(f);B[m.dataset.orbAspectType]||(B[m.dataset.orbAspectType]={}),B[m.dataset.orbAspectType][m.dataset.orbBody]=Number.parseFloat(m.value)||0,S.orbs.profiles[f]={matrix:B}}),s?.addEventListener("click",l=>{let m=l.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(m instanceof HTMLButtonElement))return;let S=m.dataset.dignityMode,w=m.dataset.dignitySign,B=m.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!S||!w||!B||S==="derived"||(S==="domicile"?ke(w,B):S==="exaltation"&&Ne(w,B),be(y?.methodology||A()))}),i?.addEventListener("input",l=>{let m=l.target;if(!(m instanceof HTMLInputElement)||!m.dataset.bodyColorOverride)return;m.dataset.bodyColorActive="true",i.querySelector(`[data-clear-body-color-override="${m.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted")}),i?.addEventListener("click",l=>{let m=l.target.closest("[data-clear-body-color-override]");if(!(m instanceof HTMLElement))return;let S=m.dataset.clearBodyColorOverride;if(!S)return;let w=i.querySelector(`[data-body-color-override="${S}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",m.classList.add("is-muted"))});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await Ue(),document.addEventListener("frontend:locale-changed",()=>{y&&j(y)}),document.addEventListener("keydown",l=>{l.key==="Escape"&&(!a||a.classList.contains("hidden")||N())})}catch(l){E(l.message||b("page.accountSettings.toasts.loadFailed"),"error"),ae()}})})();
