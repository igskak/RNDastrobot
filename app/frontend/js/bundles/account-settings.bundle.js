import{a as bt}from"./chunks/chunk-MTRUVDHY.js";import"./chunks/chunk-SYPQTWEU.js";import"./chunks/chunk-XCJV446S.js";import{a as ht}from"./chunks/chunk-6WUMBF2I.js";import"./chunks/chunk-MZ7NETWD.js";import{a as yt}from"./chunks/chunk-SYGUD2QR.js";import{a as mt,b as pt,c as ft}from"./chunks/chunk-HX7TNMQQ.js";import{b as O}from"./chunks/chunk-IZUYVIPG.js";var At=O(mt()),Et=O(pt()),Bt=O(ft());var Pt=O(yt()),xt=O(ht()),$t=O(bt());(function(){"use strict";let Z=["natal","biwheel","solar"],Ie=["aspectColors","elementPalette","bodyOverrides","wheel"],Le=["Conjunction","Trine","Square","Opposition","Sextile"],Me={Sun:"Fire",Moon:"Water",Mercury:"Air",Venus:"Earth",Mars:"Fire",Jupiter:"Fire"},ce=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ee=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],j=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",U="activePreferenceRecalcJobId",re="accountOrbViewMode",Oe=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),b=null,ie=null,_=null,le=null,k=null,y="natal",D="default",J="aspectColors",W=null;function de(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function p(e,t){return window.FrontendI18n?.t?.(e,t)||e}function ke(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{},n="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(n=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{n=""}e.href=n||window.AstroAPI?.getAccountSettingsReturnUrl?.()||t.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function C(e,t=""){let n=p(e);return n&&n!==e?n:t}function De(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Re(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?p("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):p("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function ue(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function Ne(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?p("page.accountSettings.plan.billingCancelsAt",{date:ue(t.current_period_end)}):t.current_period_end?p("page.accountSettings.plan.billingRenewsAt",{date:ue(t.current_period_end)}):p(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:p("page.accountSettings.plan.billingFree")}function Fe(e){let t=document.getElementById("accountPlanCard");if(!t)return;let n=window.AstroAPI?.isSoloPlan?.(e)===!0;if(t.classList.toggle("hidden",n),n)return;let o=De(e),a=document.getElementById("accountPlanTitle"),c=document.getElementById("accountPlanCopy"),s=document.getElementById("accountPlanUsage"),d=document.getElementById("accountPlanBillingStatus"),r=document.getElementById("accountPlanPortalBtn");if(a&&(a.textContent=p(`page.plan.names.${o}`)),c&&(c.textContent=p(`page.plan.descriptions.${o}`)),s&&(s.textContent=Re(e)),d&&(d.textContent=Ne(e)),r){let l=!!e?.billing?.subscription;r.classList.toggle("hidden",!l),r.onclick=async()=>{try{r.disabled=!0;let m=await window.AstroAPI.getBillingPortal();m?.portal_url&&(window.location.href=m.portal_url)}catch(m){B(m.message||p("page.plan.modal.errors.portalFailed"),"error")}finally{r.disabled=!1}}}t.dataset.planCode=o}function f(e){return C(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function ge(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function R(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${i(ge(e))}</span>`}function Ve(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=_?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=G().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function me(e,t={}){let n=$(t),o=Ve(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function N(e){return C(`astro.aspect.${e}`,e)}function te(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function Ye(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function F(e){return e==null?e:JSON.parse(JSON.stringify(e))}function v(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function P(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function V(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function $(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function pe(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function He(){return window.AstroPreferences?.MATRIX_BODIES||[]}function I(){return _?.aspect_types||ce.map(e=>({aspect_type:e}))}function St(e){return I().find(t=>t?.aspect_type===e)||null}function Y(){return(_?.bodies||[]).map(e=>e?.name).filter(Boolean)}function G(){return _?.signs||[]}function fe(){return Y().filter(e=>!Oe.has(e))}function L(e="natal"){let t=I(),n=[...Y(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"];return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function T(){let e={version:2,pair_strategy:j,profiles:Object.fromEntries(ee.map(t=>[t,{matrix:L(t)}]))};return P({orbs:e,balances:_?.default_balance_targets||{},dignities:_?.default_dignities||{version:1,signs:{}}})}function ye(){return $(_?.default_visual_palettes||{})}function he(){return{chart_defaults:{natal:v({}),biwheel:v({}),forecast_new:v({}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:T(),visual:ye()}}function be(){return document.getElementById("accountTimezoneLabelFormatSelect")}function Se(){return document.getElementById("accountDateFormatSelect")}function we(){return document.getElementById("accountDegreeFormatSelect")}function _e(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function x(){return b||(b={methodology:T()}),b.methodology=P(b.methodology||T()),b.methodology}function qe(e){return x()?.orbs?.profiles?.[e]?.matrix||L(e)}function ze(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||j:P(b?.methodology||T())?.orbs?.pair_strategy||j}function Ae(e){return C(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function je(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ue(e){let t=i(Ae(e)),n=i(je(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function wt(e){return G().find(t=>t?.name===e)?.opposite||null}function ne(){let e=x();return e.dignities=V(e.dignities||{},_?.default_dignities||{}),e.dignities}function Je(e={}){let t=fe(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return G().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function K(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return G().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),d=o.has(c),r=["account-settings-dignity-glyph",s?"is-active":"",d?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),l=i(Ae(c)),h=i(`${l} · ${p(s?d?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${r}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${h}"
                    aria-label="${h}"
                    ${t==="derived"?"disabled":""}
                >${Ue(c)}</button>
            `}).join("")}function Ee(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=p(`page.accountSettings.orbs.hints.${y}`)),n&&n.classList.toggle("hidden",y==="natal")}function Be(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===D;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",D==="compact"),t?.classList.toggle("is-compact",D==="compact")}function ve(e){Ie.includes(e)&&(J=e,document.querySelectorAll("[data-visual-tab]").forEach(t=>{let n=t.dataset.visualTab===J;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.visualPanel!==J)}))}function Pe(e){return String(e||"").trim().replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}function xe(e,t,n,o="#6b7280"){let a=String(n||o).trim();e.style.setProperty(t,/^#[0-9a-f]{6}$/i.test(a)?a:o)}function H(e={}){let t=document.getElementById("accountVisualWheelPreview");if(!t)return;let n=$(e),o=n?.planet_colors?.element_palette||{},a=n?.planet_colors?.body_overrides||{};Le.forEach(c=>{let s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(c,n):n?.aspect_colors?.[c];xe(t,`--preview-aspect-${Pe(c)}`,s)}),Object.entries(Me).forEach(([c,s])=>{let d=a?.[c]||o?.[s]||me(c,n);xe(t,`--preview-body-${Pe(c)}`,d)}),t.style.setProperty("--preview-cusp",n?.wheel?.angular_cusps_black===!0?"#111827":"#8d6f54"),t.style.setProperty("--preview-line-width",n?.wheel?.highlight_exact_aspects===!1?"1.5px":"2.5px")}function oe(){let e=x(),t=L(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[y]={matrix:t}}function We(e,{rerender:t=!0}={}){ee.includes(e)&&(b&&oe(),y=e,Ee(),t&&b&&ae(b.methodology))}function Ge(e){["default","compact"].includes(e)&&(D=e,localStorage.setItem(re,e),Be())}function Ke(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=I().map(n=>{let o=n.aspect_type,a=i(te(o)),c=i(N(o)),s=Z.map(d=>{let r=e?.[d]?.aspects?.enabled_types||[],m=new Set(Array.isArray(r)&&r.length?r:ce).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${d}"
                                data-aspect-type="${o}"
                                ${m}
                                aria-label="${i(`${C(`page.accountSettings.tables.columns.${d}`,d)}: ${c}`)}"
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
            `}).join(""))}function Qe(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=He().map(n=>{let o=i(f(n)),a=R(n,{size:18,title:f(n)}),c=Z.map(s=>{let d=pe(e?.[s]?.matrix?.rows||{}),r=d?.[n]?.display!==!1?"checked":"",l=d?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${r}
                                aria-label="${i(`${C(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.display")}`)}"
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
                                aria-label="${i(`${C(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${p("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function ae(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=[...Y(),window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"],a=I(),s=P(e||T())?.orbs?.profiles?.[y]?.matrix||L(y);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(d=>{let r=d===(window.AstroPreferences?.CUSP_ORB_BODY||"Cusp"),l=r?p("page.accountSettings.orbs.cuspsTitle"):f(d),m=i(l),h=r?`<span class="account-settings-orb-cusp-short">${i(p("page.accountSettings.orbs.cuspsShort"))}</span>`:R(d,{size:18,title:l});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                ${h}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(d=>{let r=d.aspect_type,l=i(te(r)),m=i(N(r));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${m}" aria-label="${m}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${l}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(h=>{let u=s?.[r]?.[h],g=i(f(h));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(d.base_orb||5)}"
                                    aria-label="${i(`${m} · ${g}`)}"
                                    data-orb-aspect-type="${r}"
                                    data-orb-body="${h}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Ee(),Be()}function $e(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=V(e?.dignities||{},_?.default_dignities||{}),o=Je(n);t.innerHTML=fe().map(a=>{let c=i(f(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${R(a,{size:18,title:f(a)})}
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="domicile" data-dignity-planet="${a}">
                            ${K(s.domicile_primary,{mode:"domicile",secondarySigns:s.domicile_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${K(s.detriment_primary,{mode:"derived",secondarySigns:s.detriment_secondary})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack" data-dignity-cell="exaltation" data-dignity-planet="${a}">
                            ${K(s.exaltation,{mode:"exaltation"})}
                        </div>
                    </td>
                    <td>
                        <div class="account-settings-dignity-stack account-settings-dignity-stack--derived">
                            ${K(s.fall,{mode:"derived"})}
                        </div>
                    </td>
                </tr>
            `}).join("")}function Xe(e,t){let n=ne(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,x().dignities=V(n,_?.default_dignities||{})}function Ze(e,t){let n=ne(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,x().dignities=V(n,_?.default_dignities||{})}function et(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},d=Y().filter(l=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(l)),r=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=d.map(l=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(f(l))}" aria-label="${i(f(l))}" role="img" tabindex="0">
                                ${R(l,{size:18,title:f(l)})}
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
                                ${R(l,{size:18,title:f(l)})}
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
        `).join("")}function tt(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=$(e);t.innerHTML=I().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(N(a))}" aria-label="${i(N(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(te(a))}</span>
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
            `}).join("")}function nt(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!t||!n)return;let o=$(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0);let d=document.getElementById("accountExactAspectHighlightToggle");d&&(d.checked=o?.wheel?.highlight_exact_aspects!==!1),t.innerHTML=Object.keys(a).map(r=>`
            <tr>
                <th scope="row">${i(r)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[r])}" data-element-color="${r}" aria-label="${i(r)}"></td>
            </tr>
        `).join(""),n.innerHTML=Y().map(r=>{let l=me(r,o),m=!!c?.[r],h=c?.[r]||l;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(f(r))}" aria-label="${i(f(r))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(ge(r))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(h)}"
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
            `}).join("")}function Q(e,{updateBaseline:t=!1}={}){let n={...he(),...e||{},chart_defaults:{natal:v(e?.chart_defaults?.natal||{}),biwheel:v(e?.chart_defaults?.biwheel||{}),forecast_new:v(e?.chart_defaults?.forecast_new||{}),solar:v(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:P(e?.methodology||T()),visual:$(e?.visual||ye())};b=n,t&&(ie=F(n.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(n.visual),ee.includes(y)||(y="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=n.chart_creation_defaults.house_system||"P");let a=n.chart_defaults.natal?.view_options||{},c=n.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let d=document.getElementById("accountHouseNumberStyleSelect");d&&(d.value=a.house_number_style==="roman"?"roman":"arabic");let r=document.getElementById("accountHouseLabelsOutsideToggle");r&&(r.checked=a.house_labels_outside===!0);let l=document.getElementById("accountShowAspectTextToggle");l&&(l.checked=c.show_aspect_text===!0);let m=document.getElementById("accountAngularCuspsBoldToggle");m&&(m.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let h=be();h&&(h.value=n.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let u=Se();if(u){let S=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(n.visual?.date_format)?n.visual.date_format:"DD_MM_YYYY";u.value=S}let g=we();if(g){let S=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(n.visual?.degree_format)?n.visual.degree_format:"DEGREES_ONLY";g.value=S}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=n.methodology?.orbs?.pair_strategy||j);let A=document.getElementById("accountStationaryThresholdPercent");A&&(A.value=String(n.methodology?.stationary?.threshold_percent??5)),Z.forEach(S=>{let M=n.chart_defaults[S],E=_e(S);E.orientation&&(E.orientation.value=M.view_options?.orientation==="asc"?"asc":"aries"),E.aspectScope&&(E.aspectScope.value=M.aspects?.scope||(S==="biwheel"?"major":"all")),E.showApplyingSeparating&&(E.showApplyingSeparating.checked=M.aspects?.show_applying_separating===!0),E.showSpeed&&(E.showSpeed.checked=M.table_options?.show_speed!==!1),E.showStationary&&(E.showStationary.checked=M.table_options?.show_stationary!==!1),E.showAspectText&&(E.showAspectText.checked=M.table_options?.show_aspect_text===!0)}),Ke(n.chart_defaults),Qe(n.chart_defaults),ae(n.methodology),$e(n.methodology),et(n.methodology),tt(n.visual),nt(n.visual),H(n.visual)}function ot(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:I().map(n=>n.aspect_type)}function at(e){let t=pe({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function _t(e){let t=_e(e);return{matrix:{rows:at(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:ot(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function st(){oe();let t=(P(b?.methodology||T())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),P({orbs:{version:2,pair_strategy:ze(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:V(b?.methodology?.dignities||ne(),_?.default_dignities||{})})}function q(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),$({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:be()?.value||"UTC",date_format:Se()?.value||"DD_MM_YYYY",degree_format:we()?.value||"DEGREES_ONLY"})}function ct(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",n=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:t,house_labels_outside:n,bold_asc_dsc:a,bold_mc_ic:a}}}function rt(){let e=ct();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:F(e),biwheel:F(e),forecast_new:F(e),solar:F(e)},methodology:st(),visual:q()}}function B(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(le),le=setTimeout(()=>{n.classList.remove("visible")},2800))}function Te(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function it(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function X(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),d=Number(e.failed_count||0),r={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:d?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},l={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:d?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},m=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];d&&m.push(`ошибок: ${d}`),!t&&s!=="completed"&&s!=="failed"&&m.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(r[s]||"Пересчет карт")}</span>
                <span>${i(l[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(m.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function se(){k&&(clearTimeout(k),k=null)}async function Ce(e){if(se(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(U,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(X(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(U),B(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await it(),se();return}if(n.status==="failed"){sessionStorage.removeItem(U),B(n.error||"Пересчет карт не выполнен.","error"),se();return}k=setTimeout(t,2500)}catch(n){k=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function lt(e){let t=Promise.resolve(window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"})),n=Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]),o=await t;if(!o){n.catch(()=>{});return}await Promise.resolve(e);let a=document.getElementById("onboardingResetSetting"),c=["trial","pro"].includes(String(o.plan_code||"").toLowerCase());a?.classList.toggle("onboarding-hidden",!c);let s=document.getElementById("accountSettingsSubtitle");s&&(s.textContent=o.email?p("page.accountSettings.subtitleWithEmail",{email:o.email}):p("page.accountSettings.subtitle")),Fe(o);let[d,r]=await n;_=d||null,Q(r,{updateBaseline:!0});let l=sessionStorage.getItem(U);l?Ce(l).catch(m=>{console.warn("Failed to resume recalculation job polling:",m)}):X(null),de()}async function dt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=rt(),n=localStorage.getItem("currentUserId")||null,o=!Ye(P(ie||{}),t.methodology),a=(b?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(Q(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});X(s),Ce(s.job_id).catch(d=>{console.warn("Failed to poll methodology recalculation job:",d)}),B("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Te);return}B(p("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Te)}catch(t){B(t.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ut(){Q(he()),X(null),B(p("page.accountSettings.toasts.restored"),"info")}function z({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&W instanceof HTMLElement&&W.focus(),W=null}function gt(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(W=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{D=localStorage.getItem(re)==="compact"?"compact":"default",ke();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),d=document.getElementById("accountSettingsResetConfirmBackdrop"),r=document.getElementById("accountSettingsResetConfirmClose"),l=document.getElementById("accountSettingsResetConfirmCancel"),m=document.getElementById("accountSettingsResetConfirmSubmit"),h=document.getElementById("onboardingResetBtn");e?.addEventListener("click",()=>{dt()}),t?.addEventListener("click",()=>{gt()}),d?.addEventListener("click",()=>{z()}),r?.addEventListener("click",()=>{z()}),l?.addEventListener("click",()=>{z()}),m?.addEventListener("click",()=>{z({restoreFocus:!1}),ut()}),h?.addEventListener("click",async()=>{h.disabled=!0;try{await window.AstroOnboarding?.reset?.(),window.AstroOnboarding?.trackLearning?.("onboarding_help_reopened",{milestone:"manual_reset",source:"account_settings"},{once:!1}),B(p("page.onboarding.settings.resetDone"),"success")}catch(u){B(u.message||p("page.accountSettings.toasts.saveFailed"),"error")}finally{h.disabled=!1}}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{We(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{Ge(u.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(u=>{u.addEventListener("click",()=>{ve(u.dataset.visualTab||"aspectColors")})}),ve(J),n?.addEventListener("click",()=>{if(y==="natal")return;oe();let u=x();u.orbs.profiles[y]={matrix:JSON.parse(JSON.stringify(qe("natal")))},ae(u),B(p("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let w=x(),S=(w.orbs.profiles[y]||{matrix:L(y)}).matrix||L(y);S[g.dataset.orbAspectType]||(S[g.dataset.orbAspectType]={}),S[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,w.orbs.profiles[y]={matrix:S}}),a?.addEventListener("click",u=>{let g=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let w=g.dataset.dignityMode,A=g.dataset.dignitySign,S=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!w||!A||!S||w==="derived"||(w==="domicile"?Xe(A,S):w==="exaltation"&&Ze(A,S),$e(b?.methodology||x()))}),c?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted"),H(q())}),c?.addEventListener("click",u=>{let g=u.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let w=g.dataset.clearBodyColorOverride;if(!w)return;let A=c.querySelector(`[data-body-color-override="${w}"]`);A instanceof HTMLInputElement&&(A.dataset.bodyColorActive="false",A.value=A.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"),H(q()))}),document.addEventListener("input",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color]")&&H(q())}),document.addEventListener("change",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color], #accountAngularCuspsBlackToggle, #accountExactAspectHighlightToggle")&&H(q())});try{let u=Promise.resolve(window.FrontendI18n?.ready).catch(()=>{});await lt(u),document.addEventListener("frontend:locale-changed",()=>{b&&Q(b)}),document.addEventListener("keydown",g=>{g.key==="Escape"&&(!s||s.classList.contains("hidden")||z())})}catch(u){B(u.message||p("page.accountSettings.toasts.loadFailed"),"error"),de()}})})();
