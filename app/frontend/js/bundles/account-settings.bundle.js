import{a as bt}from"./chunks/chunk-2N23K522.js";import"./chunks/chunk-SYPQTWEU.js";import"./chunks/chunk-XCJV446S.js";import{a as ht}from"./chunks/chunk-D4GN5UHL.js";import"./chunks/chunk-MZ7NETWD.js";import{a as yt}from"./chunks/chunk-E5CP73IV.js";import{b as O,d as mt,e as pt,f as ft}from"./chunks/chunk-BI736Q2H.js";var Et=O(mt()),At=O(pt()),Bt=O(ft());var Pt=O(yt()),xt=O(ht()),$t=O(bt());(function(){"use strict";let Z=["natal","biwheel","solar"],Ce=["aspectColors","elementPalette","bodyOverrides","wheel"],Le=["Conjunction","Trine","Square","Opposition","Sextile"],Me={Sun:"Fire",Moon:"Water",Mercury:"Air",Venus:"Earth",Mars:"Fire",Jupiter:"Fire"},ce=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ee=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],j=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",U="activePreferenceRecalcJobId",re="accountOrbViewMode",Oe=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),h=null,ie=null,_=null,le=null,k=null,y="natal",D="default",J="aspectColors",W=null;function de(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function m(e,n){return window.FrontendI18n?.t?.(e,n)||e}function ke(){let e=document.querySelector(".account-settings-back");if(!e)return;let n=window.AstroAPI?.getNavigationState?.()||{},t="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(t=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{t=""}e.href=t||window.AstroAPI?.getAccountSettingsReturnUrl?.()||n.sourceUrl||"/"}function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function I(e,n=""){let t=m(e);return t&&t!==e?t:n}function De(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Ne(e){let n=window.AstroPlan?.getSavedChartLimitState?.(e);return!n||n.max===null||n.max===void 0?m("page.plan.usage.savedChartsUnlimited",{current:n?.current||0}):m("page.plan.usage.savedChartsLimited",{current:n.current,max:n.max})}function ue(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let n=new Date(e);return Number.isNaN(n.getTime())?String(e):n.toLocaleDateString()}function Re(e){let n=e?.billing?.subscription;return n?n.cancel_at_period_end&&n.current_period_end?m("page.accountSettings.plan.billingCancelsAt",{date:ue(n.current_period_end)}):n.current_period_end?m("page.accountSettings.plan.billingRenewsAt",{date:ue(n.current_period_end)}):m(`page.accountSettings.plan.billingStatus.${n.status}`)||n.status:m("page.accountSettings.plan.billingFree")}function Fe(e){let n=document.getElementById("accountPlanCard");if(!n)return;let t=De(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage"),s=document.getElementById("accountPlanBillingStatus"),r=document.getElementById("accountPlanPortalBtn");if(o&&(o.textContent=m(`page.plan.names.${t}`)),a&&(a.textContent=m(`page.plan.descriptions.${t}`)),c&&(c.textContent=Ne(e)),s&&(s.textContent=Re(e)),r){let l=!!e?.billing?.subscription;r.classList.toggle("hidden",!l),r.onclick=async()=>{try{r.disabled=!0;let d=await window.AstroAPI.getBillingPortal();d?.portal_url&&(window.location.href=d.portal_url)}catch(d){B(d.message||m("page.plan.modal.errors.portalFailed"),"error")}finally{r.disabled=!1}}}n.dataset.planCode=t}function p(e){return I(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function ge(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function N(e,n={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,n)||`<span class="astro-symbol" aria-hidden="true">${i(ge(e))}</span>`}function Ve(e){let n=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,t=_?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=G().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(t);for(let s of c)if(t?.[s]?.ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.co_ruler===n)return o[s]||null;for(let s of c)if(t?.[s]?.exaltation===n)return o[s]||null;return null}function me(e,n={}){let t=$(n),o=Ve(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,t):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,t):"#6b7280"}function R(e){return I(`astro.aspect.${e}`,e)}function te(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function He(e,n){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,n):JSON.stringify(e??null)===JSON.stringify(n??null)}function F(e){return e==null?e:JSON.parse(JSON.stringify(e))}function v(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function P(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function V(e={},n={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,n):e}function $(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function pe(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function qe(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return _?.aspect_types||ce.map(e=>({aspect_type:e}))}function St(e){return C().find(n=>n?.aspect_type===e)||null}function H(){return(_?.bodies||[]).map(e=>e?.name).filter(Boolean)}function G(){return _?.signs||[]}function fe(){return H().filter(e=>!Oe.has(e))}function L(e="natal"){let n=C(),t=H();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(n,t,e):Object.fromEntries(n.map(o=>[o.aspect_type,Object.fromEntries(t.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function T(){let e={version:2,pair_strategy:j,profiles:Object.fromEntries(ee.map(n=>[n,{matrix:L(n)}]))};return P({orbs:e,balances:_?.default_balance_targets||{},dignities:_?.default_dignities||{version:1,signs:{}}})}function ye(){return $(_?.default_visual_palettes||{})}function he(){return{chart_defaults:{natal:v({}),biwheel:v({}),forecast_new:v({}),solar:v({})},chart_creation_defaults:{house_system:"P"},methodology:T(),visual:ye()}}function be(){return document.getElementById("accountTimezoneLabelFormatSelect")}function Se(){return document.getElementById("accountDateFormatSelect")}function we(){return document.getElementById("accountDegreeFormatSelect")}function _e(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function x(){return h||(h={methodology:T()}),h.methodology=P(h.methodology||T()),h.methodology}function Ye(e){return x()?.orbs?.profiles?.[e]?.matrix||L(e)}function ze(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||j:P(h?.methodology||T())?.orbs?.pair_strategy||j}function Ee(e){return I(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function je(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ue(e){let n=i(Ee(e)),t=i(je(e));return`<span class="astro-symbol" aria-hidden="true" title="${n}">${t}</span>`}function wt(e){return G().find(n=>n?.name===e)?.opposite||null}function ne(){let e=x();return e.dignities=V(e.dignities||{},_?.default_dignities||{}),e.dignities}function Je(e={}){let n=fe(),t=Object.fromEntries(n.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return G().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&t[s.ruler]&&(t[s.ruler].domicile_primary.push(a),c&&t[s.ruler].detriment_primary.push(c)),s.co_ruler&&t[s.co_ruler]&&(t[s.co_ruler].domicile_secondary.push(a),c&&t[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&t[s.exaltation]&&(t[s.exaltation].exaltation.push(a),c&&t[s.exaltation].fall.push(c))}),t}function K(e=[],{mode:n="derived",secondarySigns:t=[]}={}){let o=new Set(t||[]);return G().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),r=o.has(c),l=["account-settings-dignity-glyph",s?"is-active":"",r?"is-secondary":"",n==="derived"?"is-derived":""].filter(Boolean).join(" "),d=i(Ee(c)),S=i(`${d} · ${m(s?r?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${l}"
                    data-dignity-mode="${n}"
                    data-dignity-sign="${c}"
                    title="${S}"
                    aria-label="${S}"
                    ${n==="derived"?"disabled":""}
                >${Ue(c)}</button>
            `}).join("")}function Ae(){let e=document.getElementById("accountOrbProfileHint"),n=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),n&&a&&o.id&&n.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=m(`page.accountSettings.orbs.hints.${y}`)),t&&t.classList.toggle("hidden",y==="natal")}function Be(){let e=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(t=>{let o=t.dataset.orbViewMode===D;t.classList.toggle("is-active",o),t.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",D==="compact"),n?.classList.toggle("is-compact",D==="compact")}function ve(e){Ce.includes(e)&&(J=e,document.querySelectorAll("[data-visual-tab]").forEach(n=>{let t=n.dataset.visualTab===J;n.classList.toggle("is-active",t),n.setAttribute("aria-selected",t?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(n=>{n.classList.toggle("hidden",n.dataset.visualPanel!==J)}))}function Pe(e){return String(e||"").trim().replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}function xe(e,n,t,o="#6b7280"){let a=String(t||o).trim();e.style.setProperty(n,/^#[0-9a-f]{6}$/i.test(a)?a:o)}function q(e={}){let n=document.getElementById("accountVisualWheelPreview");if(!n)return;let t=$(e),o=t?.planet_colors?.element_palette||{},a=t?.planet_colors?.body_overrides||{};Le.forEach(c=>{let s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(c,t):t?.aspect_colors?.[c];xe(n,`--preview-aspect-${Pe(c)}`,s)}),Object.entries(Me).forEach(([c,s])=>{let r=a?.[c]||o?.[s]||me(c,t);xe(n,`--preview-body-${Pe(c)}`,r)}),n.style.setProperty("--preview-cusp",t?.wheel?.angular_cusps_black===!0?"#111827":"#8d6f54"),n.style.setProperty("--preview-line-width",t?.wheel?.highlight_exact_aspects===!1?"1.5px":"2.5px")}function oe(){let e=x(),n=L(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(t=>{let o=t.dataset.orbAspectType,a=t.dataset.orbBody;!o||!a||(n[o]||(n[o]={}),n[o][a]=Number.parseFloat(t.value)||0)}),e.orbs.profiles[y]={matrix:n}}function We(e,{rerender:n=!0}={}){ee.includes(e)&&(h&&oe(),y=e,Ae(),n&&h&&ae(h.methodology))}function Ge(e){["default","compact"].includes(e)&&(D=e,localStorage.setItem(re,e),Be())}function Ke(e={}){let n=document.getElementById("accountAspectTypesMatrixBody");n&&(n.innerHTML=C().map(t=>{let o=t.aspect_type,a=i(te(o)),c=i(R(o)),s=Z.map(r=>{let l=e?.[r]?.aspects?.enabled_types||[],f=new Set(Array.isArray(l)&&l.length?l:ce).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${r}"
                                data-aspect-type="${o}"
                                ${f}
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${r}`,r)}: ${c}`)}"
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
            `}).join(""))}function Qe(e={}){let n=document.getElementById("accountBodiesMatrixBody");n&&(n.innerHTML=qe().map(t=>{let o=i(p(t)),a=N(t,{size:18,title:p(t)}),c=Z.map(s=>{let r=pe(e?.[s]?.matrix?.rows||{}),l=r?.[t]?.display!==!1?"checked":"",d=r?.[t]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${t}"
                                data-matrix-field="display"
                                ${l}
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${d}
                                aria-label="${i(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function ae(e={}){let n=document.getElementById("accountOrbsHeaderRow"),t=document.getElementById("accountOrbsMatrixBody");if(!n||!t)return;let o=H(),a=C(),s=P(e||T())?.orbs?.profiles?.[y]?.matrix||L(y);n.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(r=>{let l=i(p(r)),d=N(r,{size:18,title:p(r)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${l}" aria-label="${l}" role="img" tabindex="0">
                                ${d}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,t.innerHTML=a.map(r=>{let l=r.aspect_type,d=i(te(l)),f=i(R(l));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${f}" aria-label="${f}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${d}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(S=>{let u=s?.[l]?.[S],g=i(p(S));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(u))?Number(u):Number(r.base_orb||5)}"
                                    aria-label="${i(`${f} · ${g}`)}"
                                    data-orb-aspect-type="${l}"
                                    data-orb-body="${S}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Ae(),Be()}function $e(e={}){let n=document.getElementById("accountDignitiesMatrixBody");if(!n)return;let t=V(e?.dignities||{},_?.default_dignities||{}),o=Je(t);n.innerHTML=fe().map(a=>{let c=i(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${N(a,{size:18,title:p(a)})}
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
            `}).join("")}function Xe(e,n){let t=ne(),o={...t.signs?.[e]||{}};o.ruler===n?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===n?o.co_ruler=null:o.ruler?o.co_ruler=n:o.ruler=n,t.signs[e]=o,x().dignities=V(t,_?.default_dignities||{})}function Ze(e,n){let t=ne(),o={...t.signs?.[e]||{}};o.exaltation=o.exaltation===n?null:n,t.signs[e]=o,x().dignities=V(t,_?.default_dignities||{})}function et(e={}){let n=document.getElementById("accountBalancePlanetWeightsBody"),t=document.getElementById("accountBalanceSpecialWeightsBody");if(!n||!t)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},r=H().filter(d=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(d)),l=["TrueNorthNode","TrueSouthNode","BlackMoon"];n.innerHTML=r.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(d))}" aria-label="${i(p(d))}" role="img" tabindex="0">
                                ${N(d,{size:18,title:p(d)})}
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
                        value="${Number(a?.[d]??1).toFixed(1)}"
                        data-balance-planet="${d}"
                        aria-label="${i(p(d))}"
                    >
                </td>
            </tr>
        `).join(""),t.innerHTML=l.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(d))}" aria-label="${i(p(d))}" role="img" tabindex="0">
                                ${N(d,{size:18,title:p(d)})}
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
                        value="${Number(c?.[d]??0).toFixed(1)}"
                        data-balance-special-point="${d}"
                        aria-label="${i(p(d))}"
                    >
                </td>
            </tr>
        `).join("")}function tt(e={}){let n=document.getElementById("accountAspectColorsBody");if(!n)return;let t=$(e);n.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,t):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${i(R(a))}" aria-label="${i(R(a))}" role="img" tabindex="0">
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
                            aria-label="${i(R(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function nt(e={}){let n=document.getElementById("accountElementPaletteBody"),t=document.getElementById("accountBodyOverrideColorsBody");if(!n||!t)return;let o=$(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0);let r=document.getElementById("accountExactAspectHighlightToggle");r&&(r.checked=o?.wheel?.highlight_exact_aspects!==!1),n.innerHTML=Object.keys(a).map(l=>`
            <tr>
                <th scope="row">${i(l)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${i(a[l])}" data-element-color="${l}" aria-label="${i(l)}"></td>
            </tr>
        `).join(""),t.innerHTML=H().map(l=>{let d=me(l,o),f=!!c?.[l],S=c?.[l]||d;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${i(p(l))}" aria-label="${i(p(l))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${i(ge(l))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${i(S)}"
                                data-body-color-override="${l}"
                                data-body-color-active="${f?"true":"false"}"
                                data-body-color-default="${i(d)}"
                                aria-label="${i(p(l))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${f?"":" is-muted"}"
                                data-clear-body-color-override="${l}"
                                title="${i(m("common.reset"))}"
                                aria-label="${i(`${m("common.reset")}: ${p(l)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function Q(e,{updateBaseline:n=!1}={}){let t={...he(),...e||{},chart_defaults:{natal:v(e?.chart_defaults?.natal||{}),biwheel:v(e?.chart_defaults?.biwheel||{}),forecast_new:v(e?.chart_defaults?.forecast_new||{}),solar:v(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:P(e?.methodology||T()),visual:$(e?.visual||ye())};h=t,n&&(ie=F(t.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(t.visual),ee.includes(y)||(y="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=t.chart_creation_defaults.house_system||"P");let a=t.chart_defaults.natal?.view_options||{},c=t.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let r=document.getElementById("accountHouseNumberStyleSelect");r&&(r.value=a.house_number_style==="roman"?"roman":"arabic");let l=document.getElementById("accountHouseLabelsOutsideToggle");l&&(l.checked=a.house_labels_outside===!0);let d=document.getElementById("accountShowAspectTextToggle");d&&(d.checked=c.show_aspect_text===!0);let f=document.getElementById("accountAngularCuspsBoldToggle");f&&(f.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let S=be();S&&(S.value=t.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let u=Se();if(u){let b=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(t.visual?.date_format)?t.visual.date_format:"DD_MM_YYYY";u.value=b}let g=we();if(g){let b=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(t.visual?.degree_format)?t.visual.degree_format:"DEGREES_ONLY";g.value=b}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=t.methodology?.orbs?.pair_strategy||j);let E=document.getElementById("accountStationaryThresholdPercent");E&&(E.value=String(t.methodology?.stationary?.threshold_percent??5)),Z.forEach(b=>{let M=t.chart_defaults[b],A=_e(b);A.orientation&&(A.orientation.value=M.view_options?.orientation==="asc"?"asc":"aries"),A.aspectScope&&(A.aspectScope.value=M.aspects?.scope||(b==="biwheel"?"major":"all")),A.showApplyingSeparating&&(A.showApplyingSeparating.checked=M.aspects?.show_applying_separating===!0),A.showSpeed&&(A.showSpeed.checked=M.table_options?.show_speed!==!1),A.showStationary&&(A.showStationary.checked=M.table_options?.show_stationary!==!1),A.showAspectText&&(A.showAspectText.checked=M.table_options?.show_aspect_text===!0)}),Ke(t.chart_defaults),Qe(t.chart_defaults),ae(t.methodology),$e(t.methodology),et(t.methodology),tt(t.visual),nt(t.visual),q(t.visual)}function ot(e){let n=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(t=>{t.checked&&t.dataset.aspectType&&n.push(t.dataset.aspectType)}),n.length?n:C().map(t=>t.aspect_type)}function at(e){let n=pe({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(t=>{let o=t.dataset.matrixBody,a=t.dataset.matrixField;!o||!a||(n[o]={...n[o]||{display:!0,aspecting:!0},[a]:t.checked})}),n}function _t(e){let n=_e(e);return{matrix:{rows:at(e)},aspects:{scope:n.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:ot(e),show_applying_separating:n.showApplyingSeparating?.checked===!0},table_options:{show_speed:n.showSpeed?n.showSpeed.checked!==!1:!0,show_stationary:n.showStationary?n.showStationary.checked!==!1:!0,show_aspect_text:n.showAspectText?.checked===!0},view_options:{orientation:n.orientation?.value==="asc"?"asc":"aries"}}}function st(){oe();let n=(P(h?.methodology||T())?.orbs||{})?.profiles||{},t={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(t[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),P({orbs:{version:2,pair_strategy:ze(),profiles:n},balances:{version:1,planet_weights:t,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:V(h?.methodology?.dignities||ne(),_?.default_dignities||{})})}function Y(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let n={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(n[o.dataset.elementColor]=o.value)});let t={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(t[a]=c)}),$({aspect_colors:e,planet_colors:{element_palette:n,body_overrides:t},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:be()?.value||"UTC",date_format:Se()?.value||"DD_MM_YYYY",degree_format:we()?.value||"DEGREES_ONLY"})}function ct(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",n=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",t=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:n,house_labels_outside:t,bold_asc_dsc:a,bold_mc_ic:a}}}function rt(){let e=ct();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:F(e),biwheel:F(e),forecast_new:F(e),solar:F(e)},methodology:st(),visual:Y()}}function B(e,n="info"){let t=document.getElementById("accountSettingsToast");!t||!e||(t.textContent=e,t.className=`toast ${n}`,requestAnimationFrame(()=>t.classList.add("visible")),clearTimeout(le),le=setTimeout(()=>{t.classList.remove("visible")},2800))}function Te(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function it(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let n=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(n)}catch(n){console.warn("Failed to refresh current chart after methodology recalculation:",n)}}function X(e,{final:n=!1}={}){let t=document.getElementById("methodologyJobStatus");if(!t)return;if(!e){t.classList.add("hidden"),t.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),r=Number(e.failed_count||0),l={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:r?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},d={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:r?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},f=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];r&&f.push(`ошибок: ${r}`),!n&&s!=="completed"&&s!=="failed"&&f.push("можно остаться на странице и дождаться завершения"),t.innerHTML=`
            <div class="account-settings-status-title">
                <span>${i(l[s]||"Пересчет карт")}</span>
                <span>${i(d[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${i(f.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,t.classList.remove("hidden"),t.dataset.status=s}function se(){k&&(clearTimeout(k),k=null)}async function Ie(e){if(se(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(U,String(e));let n=async()=>{try{let t=await window.AstroAPI.getPreferenceRecalcJob(e);if(X(t,{final:t.status==="completed"||t.status==="failed"}),t.status==="completed"){sessionStorage.removeItem(U),B(t.failed_count?`Пересчет завершен с ошибками: ${t.failed_count}.`:"Пересчет карт завершен.",t.failed_count?"info":"success"),await it(),se();return}if(t.status==="failed"){sessionStorage.removeItem(U),B(t.error||"Пересчет карт не выполнен.","error"),se();return}k=setTimeout(n,2500)}catch(t){k=setTimeout(n,4e3),console.warn("Failed to poll preference recalculation job:",t)}};await n()}async function lt(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let n=document.getElementById("onboardingResetSetting"),t=["trial","pro"].includes(String(e.plan_code||"").toLowerCase());n?.classList.toggle("onboarding-hidden",!t);let o=document.getElementById("accountSettingsSubtitle");o&&(o.textContent=e.email?m("page.accountSettings.subtitleWithEmail",{email:e.email}):m("page.accountSettings.subtitle")),Fe(e);let[a,c]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);_=a||null,Q(c,{updateBaseline:!0});let s=sessionStorage.getItem(U);s?Ie(s).catch(r=>{console.warn("Failed to resume recalculation job polling:",r)}):X(null),de()}async function dt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let n=rt(),t=localStorage.getItem("currentUserId")||null,o=!He(P(ie||{}),n.methodology),a=(h?.chart_creation_defaults?.house_system||"P")!==(n.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(n);if(Q(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...t?{priority_user_id:t}:{}}});X(s),Ie(s.job_id).catch(r=>{console.warn("Failed to poll methodology recalculation job:",r)}),B("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Te);return}B(m("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Te)}catch(n){B(n.message||m("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ut(){Q(he()),X(null),B(m("page.accountSettings.toasts.restored"),"info")}function z({restoreFocus:e=!0}={}){let n=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop");n&&n.classList.add("hidden"),t&&t.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&W instanceof HTMLElement&&W.focus(),W=null}function gt(){let e=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop"),t=document.getElementById("accountSettingsResetConfirmSubmit");!e||!n||(W=document.activeElement instanceof HTMLElement?document.activeElement:null,n.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{t?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{D=localStorage.getItem(re)==="compact"?"compact":"default",ke();let e=document.getElementById("saveAccountSettingsBtn"),n=document.getElementById("restoreStandardDefaultsBtn"),t=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),r=document.getElementById("accountSettingsResetConfirmBackdrop"),l=document.getElementById("accountSettingsResetConfirmClose"),d=document.getElementById("accountSettingsResetConfirmCancel"),f=document.getElementById("accountSettingsResetConfirmSubmit"),S=document.getElementById("onboardingResetBtn");e?.addEventListener("click",()=>{dt()}),n?.addEventListener("click",()=>{gt()}),r?.addEventListener("click",()=>{z()}),l?.addEventListener("click",()=>{z()}),d?.addEventListener("click",()=>{z()}),f?.addEventListener("click",()=>{z({restoreFocus:!1}),ut()}),S?.addEventListener("click",async()=>{S.disabled=!0;try{await window.AstroOnboarding?.reset?.(),window.AstroOnboarding?.trackLearning?.("onboarding_help_reopened",{milestone:"manual_reset",source:"account_settings"},{once:!1}),B(m("page.onboarding.settings.resetDone"),"success")}catch(u){B(u.message||m("page.accountSettings.toasts.saveFailed"),"error")}finally{S.disabled=!1}}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{We(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{Ge(u.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(u=>{u.addEventListener("click",()=>{ve(u.dataset.visualTab||"aspectColors")})}),ve(J),t?.addEventListener("click",()=>{if(y==="natal")return;oe();let u=x();u.orbs.profiles[y]={matrix:JSON.parse(JSON.stringify(Ye("natal")))},ae(u),B(m("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let w=x(),b=(w.orbs.profiles[y]||{matrix:L(y)}).matrix||L(y);b[g.dataset.orbAspectType]||(b[g.dataset.orbAspectType]={}),b[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,w.orbs.profiles[y]={matrix:b}}),a?.addEventListener("click",u=>{let g=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let w=g.dataset.dignityMode,E=g.dataset.dignitySign,b=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!w||!E||!b||w==="derived"||(w==="domicile"?Xe(E,b):w==="exaltation"&&Ze(E,b),$e(h?.methodology||x()))}),c?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted"),q(Y())}),c?.addEventListener("click",u=>{let g=u.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let w=g.dataset.clearBodyColorOverride;if(!w)return;let E=c.querySelector(`[data-body-color-override="${w}"]`);E instanceof HTMLInputElement&&(E.dataset.bodyColorActive="false",E.value=E.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"),q(Y()))}),document.addEventListener("input",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color]")&&q(Y())}),document.addEventListener("change",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color], #accountAngularCuspsBlackToggle, #accountExactAspectHighlightToggle")&&q(Y())});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await lt(),document.addEventListener("frontend:locale-changed",()=>{h&&Q(h)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!s||s.classList.contains("hidden")||z())})}catch(u){B(u.message||m("page.accountSettings.toasts.loadFailed"),"error"),de()}})})();
