import{a as Et}from"./chunks/chunk-MTRUVDHY.js";import"./chunks/chunk-SYPQTWEU.js";import"./chunks/chunk-XCJV446S.js";import{a as _t}from"./chunks/chunk-6WUMBF2I.js";import{a as wt}from"./chunks/chunk-SYGUD2QR.js";import{a as ht,b as bt,c as St}from"./chunks/chunk-HX7TNMQQ.js";import{b as D}from"./chunks/chunk-IZUYVIPG.js";var Pt=D(ht()),xt=D(bt()),$t=D(St()),Tt=D(wt()),Ct=D(_t()),It=D(Et());(function(){"use strict";let Z=["natal","biwheel","solar"],De=["aspectColors","elementPalette","bodyOverrides","wheel"],Re=["Conjunction","Trine","Square","Opposition","Sextile"],Ne={Sun:"Fire",Moon:"Water",Mercury:"Air",Venus:"Earth",Mars:"Fire",Jupiter:"Fire"},le=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ee=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],J=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",W="activePreferenceRecalcJobId",de="accountOrbViewMode",Fe=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),y=null,ue=null,te=null,ge="chart",E=null,me=null,R=null,h="natal",N="default",G="aspectColors",K=null;function pe(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function p(e,t){return window.FrontendI18n?.t?.(e,t)||e}function Ve(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{},n="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(n=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{n=""}e.href=n||window.AstroAPI?.getAccountSettingsReturnUrl?.()||t.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function I(e,t=""){let n=p(e);return n&&n!==e?n:t}function qe(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Ye(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?p("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):p("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function fe(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function He(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?p("page.accountSettings.plan.billingCancelsAt",{date:fe(t.current_period_end)}):t.current_period_end?p("page.accountSettings.plan.billingRenewsAt",{date:fe(t.current_period_end)}):p(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:p("page.accountSettings.plan.billingFree")}function ze(e){let t=document.getElementById("accountPlanCard");if(!t)return;let n=window.AstroAPI?.isSoloPlan?.(e)===!0;if(t.classList.toggle("hidden",n),n)return;let o=qe(e),a=document.getElementById("accountPlanTitle"),c=document.getElementById("accountPlanCopy"),s=document.getElementById("accountPlanUsage"),d=document.getElementById("accountPlanBillingStatus"),r=document.getElementById("accountPlanPortalBtn");if(a&&(a.textContent=p(`page.plan.names.${o}`)),c&&(c.textContent=p(`page.plan.descriptions.${o}`)),s&&(s.textContent=Ye(e)),d&&(d.textContent=He(e)),r){let l=!!e?.billing?.subscription;r.classList.toggle("hidden",!l),r.onclick=async()=>{try{r.disabled=!0;let m=await window.AstroAPI.getBillingPortal();m?.portal_url&&(window.location.href=m.portal_url)}catch(m){B(m.message||p("page.plan.modal.errors.portalFailed"),"error")}finally{r.disabled=!1}}}t.dataset.planCode=o}function f(e){return I(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function je(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function L(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${i(je(e))}</span>`}function Ue(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=E?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=Q().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function ye(e,t={}){let n=$(t),o=Ue(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function F(e){return I(`astro.aspect.${e}`,e)}function ne(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function he(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function M(e){return e==null?e:JSON.parse(JSON.stringify(e))}function v(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function P(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function V(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function $(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function be(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function Je(){return window.AstroPreferences?.MATRIX_BODIES||[]}function O(){return E?.aspect_types||le.map(e=>({aspect_type:e}))}function At(e){return O().find(t=>t?.aspect_type===e)||null}function q(){return(E?.bodies||[]).map(e=>e?.name).filter(Boolean)}function Q(){return E?.signs||[]}function Se(){return q().filter(e=>!Fe.has(e))}function k(e="natal"){let t=O(),n=[...q(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"];return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function T(){let e={version:2,pair_strategy:J,profiles:Object.fromEntries(ee.map(t=>[t,{matrix:k(t)}]))};return P({orbs:e,balances:E?.default_balance_targets||{},dignities:E?.default_dignities||{version:1,signs:{}}})}function we(){return $(E?.default_visual_palettes||{})}function _e(){return{chart_defaults:{natal:v({}),biwheel:v({}),forecast_new:v({}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:T(),visual:we()}}function Ee(){return document.getElementById("accountTimezoneLabelFormatSelect")}function Ae(){return document.getElementById("accountDateFormatSelect")}function Be(){return document.getElementById("accountDegreeFormatSelect")}function ve(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function x(){return y||(y={methodology:T()}),y.methodology=P(y.methodology||T()),y.methodology}function We(e){return x()?.orbs?.profiles?.[e]?.matrix||k(e)}function Ge(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||J:P(y?.methodology||T())?.orbs?.pair_strategy||J}function Pe(e){return I(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function Ke(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Qe(e){let t=i(Pe(e)),n=i(Ke(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function Bt(e){return Q().find(t=>t?.name===e)?.opposite||null}function oe(){let e=x();return e.dignities=V(e.dignities||{},E?.default_dignities||{}),e.dignities}function Xe(e={}){let t=Se(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return Q().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function X(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return Q().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),d=o.has(c),r=["account-settings-dignity-glyph",s?"is-active":"",d?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(Pe(c)),b=i(`${l} · ${p(s?d?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${r}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${b}"
                    aria-label="${b}"
                    ${t==="derived"?"disabled":""}
                >${Qe(c)}</button>
            `}).join("")}function xe(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===h;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${h}`)),n&&n.classList.toggle("hidden",h==="natal")}function $e(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===N;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",N==="compact"),t?.classList.toggle("is-compact",N==="compact")}function Te(e){De.includes(e)&&(G=e,document.querySelectorAll("[data-visual-tab]").forEach(t=>{let n=t.dataset.visualTab===G;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.visualPanel!==G)}))}function Ce(e){return String(e||"").trim().replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}function Ie(e,t,n,o="#6b7280"){let a=String(n||o).trim();e.style.setProperty(t,/^#[0-9a-f]{6}$/i.test(a)?a:o)}function Y(e={}){let t=document.getElementById("accountVisualWheelPreview");if(!t)return;let n=$(e),o=n?.planet_colors?.element_palette||{},a=n?.planet_colors?.body_overrides||{};Re.forEach(c=>{let s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(c,n):n?.aspect_colors?.[c];Ie(t,`--preview-aspect-${Ce(c)}`,s)}),Object.entries(Ne).forEach(([c,s])=>{let d=a?.[c]||o?.[s]||ye(c,n);Ie(t,`--preview-body-${Ce(c)}`,d)}),t.style.setProperty("--preview-cusp",n?.wheel?.angular_cusps_black===!0?"#111827":"#8d6f54"),t.style.setProperty("--preview-line-width",n?.wheel?.highlight_exact_aspects===!1?"1.5px":"2.5px")}function ae(){let e=x(),t=k(h);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[h]={matrix:t}}function Ze(e,{rerender:t=!0}={}){ee.includes(e)&&(y&&ae(),h=e,xe(),t&&y&&se(y.methodology))}function et(e){["default","compact"].includes(e)&&(N=e,localStorage.setItem(de,e),$e())}function tt(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=O().map(n=>{let o=n.aspect_type,a=i(ne(o)),c=i(F(o)),s=Z.map(d=>{let r=e?.[d]?.aspects?.enabled_types||[],m=new Set(Array.isArray(r)&&r.length?r:le).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${d}"
                                data-aspect-type="${o}"
                                ${m}
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${d}`,d)}: ${c}`)}"
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
            `}).join(""))}function nt(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=Je().map(n=>{let o=i(f(n)),a=L(n,{size:18,title:f(n)}),c=Z.map(s=>{let d=be(e?.[s]?.matrix?.rows||{}),r=d?.[n]?.display!==!1?"checked":"",l=d?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${r}
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function se(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=[...q(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"],a=O(),s=P(e||T())?.orbs?.profiles?.[h]?.matrix||k(h);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(d=>{let r=d===(window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"),l=r?p("page.accountSettings.orbs.cuspsTitle"):f(d),m=i(l),b=r?`<span class="account-settings-orb-cusp-short">${i(p("page.accountSettings.orbs.cuspsShort"))}</span>`:L(d,{size:18,title:l});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                ${b}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(d=>{let r=d.aspect_type,l=i(ne(r)),m=i(F(r));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(b=>{let C=s?.[r]?.[b],u=i(f(b));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(C))?Number(C):Number(d.base_orb||5)}"
                                    aria-label="${i(`${m} · ${u}`)}"
                                    data-orb-aspect-type="${r}"
                                    data-orb-body="${b}"
                                    data-orb-profile="${h}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),xe(),$e()}function Le(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=V(e?.dignities||{},E?.default_dignities||{}),o=Xe(n);t.innerHTML=Se().map(a=>{let c=i(f(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${L(a,{size:18,title:f(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${X(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${X(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${X(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${X(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function ot(e,t){let n=oe(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,x().dignities=V(n,E?.default_dignities||{})}function at(e,t){let n=oe(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,x().dignities=V(n,E?.default_dignities||{})}function st(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},d=q().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),r=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=d.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(f(l))}" aria-label="${i(f(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:f(l)})}
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
                        aria-label="${i(f(l))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=r.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(f(l))}" aria-label="${i(f(l))}" role="img" tabindex="0">
                                ${L(l,{size:18,title:f(l)})}
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
                        aria-label="${i(f(l))}"
                    >
                </td>
            </tr>
        `).join("")}function ct(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=$(e);t.innerHTML=O().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(F(a))}" aria-label="${i(F(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(ne(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${i(c)}"
                            data-aspect-color="${a}"
                            aria-label="${i(F(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function rt(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!t||!n)return;let o=$(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0);let d=document.getElementById("accountExactAspectHighlightToggle");d&&(d.checked=o?.wheel?.highlight_exact_aspects!==!1),t.innerHTML=Object.keys(a).map(r=>`
            <tr>
                <th scope="row">${i(r)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[r])}" data-element-color="${r}" aria-label="${i(r)}"></td>
            </tr>
        `).join(""),n.innerHTML=q().map(r=>{let l=ye(r,o),m=!!c?.[r],b=c?.[r]||l;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(f(r))}" aria-label="${i(f(r))}" role="img" tabindex="0">
                                ${L(r,{size:18,title:f(r)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(b)}"
                                data-body-color-override="${r}"
                                data-body-color-active="${m?"true":"false"}"
                                data-body-color-default="${i(l)}"
                                aria-label="${i(f(r))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${m?"":" is-muted"}"
                                data-clear-body-color-override="${r}"
                                title="${i(p("common.reset"))}"
                                aria-label="${i(`${p("common.reset")}: ${f(r)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function H(e,{updateBaseline:t=!1}={}){let n={..._e(),...e||{},chart_defaults:{natal:v(e?.chart_defaults?.natal||{}),biwheel:v(e?.chart_defaults?.biwheel||{}),forecast_new:v(e?.chart_defaults?.forecast_new||{}),solar:v(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:P(e?.methodology||T()),visual:$(e?.visual||we())};y=n,t&&(ue=M(n.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(n.visual),ee.includes(h)||(h="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=n.chart_creation_defaults.house_system||"P");let a=n.chart_defaults.natal?.view_options||{},c=n.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let d=document.getElementById("accountHouseNumberStyleSelect");d&&(d.value=a.house_number_style==="roman"?"roman":"arabic");let r=document.getElementById("accountHouseLabelsOutsideToggle");r&&(r.checked=a.house_labels_outside===!0);let l=document.getElementById("accountShowAspectTextToggle");l&&(l.checked=c.show_aspect_text===!0);let m=document.getElementById("accountAngularCuspsBoldToggle");m&&(m.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let b=Ee();b&&(b.value=n.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let C=Ae();if(C){let S=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(n.visual?.date_format)?n.visual.date_format:"DD_MM_YYYY";C.value=S}let u=Be();if(u){let S=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(n.visual?.degree_format)?n.visual.degree_format:"DEGREES_ONLY";u.value=S}let g=document.getElementById("accountOrbPairStrategySelect");g&&(g.value=n.methodology?.orbs?.pair_strategy||J);let _=document.getElementById("accountStationaryThresholdPercent");_&&(_.value=String(n.methodology?.stationary?.threshold_percent??5)),Z.forEach(S=>{let w=n.chart_defaults[S],A=ve(S);A.orientation&&(A.orientation.value=w.view_options?.orientation==="asc"?"asc":"aries"),A.aspectScope&&(A.aspectScope.value=w.aspects?.scope||(S==="biwheel"?"major":"all")),A.showApplyingSeparating&&(A.showApplyingSeparating.checked=w.aspects?.show_applying_separating===!0),A.showSpeed&&(A.showSpeed.checked=w.table_options?.show_speed!==!1),A.showStationary&&(A.showStationary.checked=w.table_options?.show_stationary!==!1),A.showAspectText&&(A.showAspectText.checked=w.table_options?.show_aspect_text===!0)}),tt(n.chart_defaults),nt(n.chart_defaults),se(n.methodology),Le(n.methodology),st(n.methodology),ct(n.visual),rt(n.visual),Y(n.visual),t&&(te=M(ce())),re()}function it(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:O().map(n=>n.aspect_type)}function lt(e){let t=be({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function vt(e){let t=ve(e);return{matrix:{rows:lt(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:it(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function dt(){ae();let t=(P(y?.methodology||T())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),P({orbs:{version:2,pair_strategy:Ge(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:V(y?.methodology?.dignities||oe(),E?.default_dignities||{})})}function z(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),$({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:Ee()?.value||"UTC",date_format:Ae()?.value||"DD_MM_YYYY",degree_format:Be()?.value||"DEGREES_ONLY"})}function ut(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",n=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:t,house_labels_outside:n,bold_asc_dsc:a,bold_mc_ic:a}}}function ce(){let e=ut();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:M(e),biwheel:M(e),forecast_new:M(e),solar:M(e)},methodology:dt(),visual:z()}}function B(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(me),me=setTimeout(()=>{n.classList.remove("visible")},2800))}function Me(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}function Oe(e){ge=e,document.querySelectorAll("[data-settings-tab]").forEach(t=>{let n=t.dataset.settingsTab===e;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-settings-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.settingsPanel!==e)})}function re(){if(!te)return;let e=document.getElementById("accountSettingsSaveBar"),t=document.getElementById("accountSettingsSavedIndicator"),n;try{n=!he(te,ce())}catch{n=!0}e&&e.classList.toggle("hidden",!n),t&&(t.hidden=n)}async function gt(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function j(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),d=Number(e.failed_count||0),r={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:d?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:d?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},m=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];d&&m.push(`ошибок: ${d}`),!t&&s!=="completed"&&s!=="failed"&&m.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(r[s]||"Пересчет карт")}</span>
                <span>${i(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(m.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function ie(){R&&(clearTimeout(R),R=null)}async function ke(e){if(ie(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(W,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(j(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(W),B(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await gt(),ie();return}if(n.status==="failed"){sessionStorage.removeItem(W),B(n.error||"Пересчет карт не выполнен.","error"),ie();return}R=setTimeout(t,2500)}catch(n){R=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function mt(e){let t=Promise.resolve(window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"})),n=Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]),o=await t;if(!o){n.catch(()=>{});return}await Promise.resolve(e);let a=document.getElementById("onboardingResetSetting"),c=["trial","pro"].includes(String(o.plan_code||"").toLowerCase());a?.classList.toggle("onboarding-hidden",!c);let s=document.getElementById("accountSettingsSubtitle");s&&(s.textContent=o.email?p("page.accountSettings.subtitleWithEmail",{email:o.email}):p("page.accountSettings.subtitle")),ze(o);let[d,r]=await n;E=d||null,H(r,{updateBaseline:!0});let l=sessionStorage.getItem(W);l?ke(l).catch(m=>{console.warn("Failed to resume recalculation job polling:",m)}):j(null),pe()}async function pt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=ce(),n=localStorage.getItem("currentUserId")||null,o=!he(P(ue||{}),t.methodology),a=(y?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(H(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});j(s),ke(s.job_id).catch(d=>{console.warn("Failed to poll methodology recalculation job:",d)}),B("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Me);return}B(p("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Me)}catch(t){B(t.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ft(){H(_e()),j(null),B(p("page.accountSettings.toasts.restored"),"info")}function U({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&K instanceof HTMLElement&&K.focus(),K=null}function yt(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(K=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{N=localStorage.getItem(de)==="compact"?"compact":"default",Ve();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),d=document.getElementById("accountSettingsResetConfirmBackdrop"),r=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),m=document.getElementById("accountSettingsResetConfirmSubmit"),b=document.getElementById("onboardingResetBtn"),C=document.getElementById("accountSettingsDiscardBtn");document.querySelectorAll("[data-settings-tab]").forEach(u=>{u.addEventListener("click",()=>{Oe(u.dataset.settingsTab||"chart")})}),Oe(ge),document.addEventListener("input",re),document.addEventListener("change",re),e?.addEventListener("click",()=>{pt()}),C?.addEventListener("click",()=>{y&&H(y,{updateBaseline:!0}),j(null)}),t?.addEventListener("click",()=>{yt()}),d?.addEventListener("click",()=>{U()}),r?.addEventListener("click",()=>{U()}),l?.addEventListener("click",()=>{U()}),m?.addEventListener("click",()=>{U({restoreFocus:!1}),ft()}),b?.addEventListener("click",async()=>{b.disabled=!0;try{await window.AstroOnboarding?.reset?.(),window.AstroOnboarding?.trackLearning?.("onboarding_help_reopened",{milestone:"manual_reset",source:"account_settings"},{once:!1}),B(p("page.onboarding.settings.resetDone"),"success")}catch(u){B(u.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{b.disabled=!1}}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{Ze(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{et(u.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(u=>{u.addEventListener("click",()=>{Te(u.dataset.visualTab||"aspectColors")})}),Te(G),n?.addEventListener("click",()=>{if(h==="natal")return;ae();let u=x();u.orbs.profiles[h]={matrix:JSON.parse(JSON.stringify(We("natal")))},se(u),B(p("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let _=x(),w=(_.orbs.profiles[h]||{matrix:k(h)}).matrix||k(h);w[g.dataset.orbAspectType]||(w[g.dataset.orbAspectType]={}),w[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,_.orbs.profiles[h]={matrix:w}}),a?.addEventListener("click",u=>{let g=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let _=g.dataset.dignityMode,S=g.dataset.dignitySign,w=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!_||!S||!w||_==="derived"||(_==="domicile"?ot(S,w):_==="exaltation"&&at(S,w),Le(y?.methodology||x()))}),c?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted"),Y(z())}),c?.addEventListener("click",u=>{let g=u.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let _=g.dataset.clearBodyColorOverride;if(!_)return;let S=c.querySelector(`[data-body-color-override="${_}"]`);S instanceof HTMLInputElement&&(S.dataset.bodyColorActive="false",S.value=S.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"),Y(z()))}),document.addEventListener("input",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color]")&&Y(z())}),document.addEventListener("change",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color], #accountAngularCuspsBlackToggle, #accountExactAspectHighlightToggle")&&Y(z())});try{let u=Promise.resolve(window.FrontendI18n?.ready).catch(()=>{});await mt(u),document.addEventListener("frontend:locale-changed",()=>{y&&H(y)}),document.addEventListener("keydown",g=>{g.key==="Escape"&&(!s||s.classList.contains("hidden")||U())})}catch(u){B(u.message||p("page.accountSettings.toasts.loadFailed"),"error"),pe()}})})();
