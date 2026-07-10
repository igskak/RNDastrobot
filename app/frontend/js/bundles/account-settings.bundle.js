import"./chunks/chunk-SYPQTWEU.js";import"./chunks/chunk-XCJV446S.js";import{a as ht}from"./chunks/chunk-D4GN5UHL.js";import"./chunks/chunk-MZ7NETWD.js";import{a as yt}from"./chunks/chunk-E5CP73IV.js";import{b as z,d as mt,e as pt,f as ft}from"./chunks/chunk-BI736Q2H.js";var _t=z(mt()),Et=z(pt()),At=z(ft());var vt=z(yt()),Pt=z(ht());(function(){"use strict";let Z=["natal","biwheel","solar"],Ce=["aspectColors","elementPalette","bodyOverrides","wheel"],Le=["Conjunction","Trine","Square","Opposition","Sextile"],Me={Sun:"Fire",Moon:"Water",Mercury:"Air",Venus:"Earth",Mars:"Fire",Jupiter:"Fire"},ce=window.AstroPreferences?.DEFAULT_ENABLED_ASPECT_TYPES||["Conjunction","Opposition","Trine","Square","Sextile","Vigintile","Semi_Nonagon","Semisextile","Decile","Nonagon","Semisquare","Quintile","Binonagon","Sentagon","Tridecile","Sesquiquadrate","Biquintile","Quincunx"],ee=window.AstroPreferences?.ORB_PROFILE_IDS||["natal","prognostic","synastry"],j=window.AstroPreferences?.DEFAULT_ORB_PAIR_STRATEGY||"larger",U="activePreferenceRecalcJobId",re="accountOrbViewMode",Oe=new Set(["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"]),h=null,ie=null,S=null,le=null,O=null,y="natal",k="default",J="aspectColors",W=null;function de(){if(window.AstroAPI?.hidePageLoader){window.AstroAPI.hidePageLoader();return}let e=document.getElementById("pageLoader");e&&(e.classList.add("fade-out"),setTimeout(()=>e.remove(),460))}function m(e,t){return window.FrontendI18n?.t?.(e,t)||e}function ke(){let e=document.querySelector(".account-settings-back");if(!e)return;let t=window.AstroAPI?.getNavigationState?.()||{},n="";try{let o=document.referrer?new URL(document.referrer):null;o&&o.origin===window.location.origin&&!o.pathname.endsWith("/account-settings.html")&&(n=`${o.pathname}${o.search||""}${o.hash||""}`)}catch{n=""}e.href=n||window.AstroAPI?.getAccountSettingsReturnUrl?.()||t.sourceUrl||"/"}function r(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function I(e,t=""){let n=m(e);return n&&n!==e?n:t}function De(e){return window.AstroPlan?.getPlanCode?.(e)||String(e?.plan_code||"pro").trim().toLowerCase()||"pro"}function Ne(e){let t=window.AstroPlan?.getSavedChartLimitState?.(e);return!t||t.max===null||t.max===void 0?m("page.plan.usage.savedChartsUnlimited",{current:t?.current||0}):m("page.plan.usage.savedChartsLimited",{current:t.current,max:t.max})}function ue(e){if(!e)return"";if(window.LocaleFormatters?.formatDate)return window.LocaleFormatters.formatDate(e);let t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleDateString()}function Re(e){let t=e?.billing?.subscription;return t?t.cancel_at_period_end&&t.current_period_end?m("page.accountSettings.plan.billingCancelsAt",{date:ue(t.current_period_end)}):t.current_period_end?m("page.accountSettings.plan.billingRenewsAt",{date:ue(t.current_period_end)}):m(`page.accountSettings.plan.billingStatus.${t.status}`)||t.status:m("page.accountSettings.plan.billingFree")}function Fe(e){let t=document.getElementById("accountPlanCard");if(!t)return;let n=De(e),o=document.getElementById("accountPlanTitle"),a=document.getElementById("accountPlanCopy"),c=document.getElementById("accountPlanUsage"),s=document.getElementById("accountPlanBillingStatus"),i=document.getElementById("accountPlanPortalBtn");if(o&&(o.textContent=m(`page.plan.names.${n}`)),a&&(a.textContent=m(`page.plan.descriptions.${n}`)),c&&(c.textContent=Ne(e)),s&&(s.textContent=Re(e)),i){let l=!!e?.billing?.subscription;i.classList.toggle("hidden",!l),i.onclick=async()=>{try{i.disabled=!0;let d=await window.AstroAPI.getBillingPortal();d?.portal_url&&(window.location.href=d.portal_url)}catch(d){A(d.message||m("page.plan.modal.errors.portalFailed"),"error")}finally{i.disabled=!1}}}t.dataset.planCode=n}function p(e){return I(`astro.planet.${e}`,window.Symbols?.getPlanetNameRu?.(e)||e)}function ge(e){return window.Symbols?.getPlanetSymbol?.(e)||String(e||"").slice(0,2)||"•"}function D(e,t={}){return window.Symbols?.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${r(ge(e))}</span>`}function Ve(e){let t=window.AstroPreferences?.normalizeMatrixBodyName?window.AstroPreferences.normalizeMatrixBodyName(e):e,n=S?.default_dignities?.signs||{},o=window.Symbols?.signElements||{},a=G().map(s=>s?.name).filter(Boolean),c=a.length?a:Object.keys(n);for(let s of c)if(n?.[s]?.ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.co_ruler===t)return o[s]||null;for(let s of c)if(n?.[s]?.exaltation===t)return o[s]||null;return null}function me(e,t={}){let n=x(t),o=Ve(e);return window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e,o,n):window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(o,n):"#6b7280"}function N(e){return I(`astro.aspect.${e}`,e)}function te(e){return window.Symbols?.getAspectDisplay?.(e)||window.Symbols?.aspects?.[e]||String(e||"").slice(0,3)||"•"}function He(e,t){return window.AstroPreferences?.deepEqual?window.AstroPreferences.deepEqual(e,t):JSON.stringify(e??null)===JSON.stringify(t??null)}function R(e){return e==null?e:JSON.parse(JSON.stringify(e))}function B(e={}){return window.AstroPreferences?.normalizeViewSettings?window.AstroPreferences.normalizeViewSettings(e):e}function v(e={}){return window.AstroPreferences?.normalizeMethodologySettings?window.AstroPreferences.normalizeMethodologySettings(e):e}function F(e={},t={}){return window.AstroPreferences?.normalizeDignitySettings?window.AstroPreferences.normalizeDignitySettings(e,t):e}function x(e={}){return window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e):e||{}}function pe(e={}){return window.AstroPreferences?.ensureMatrixRows?window.AstroPreferences.ensureMatrixRows(e||{}):e||{}}function qe(){return window.AstroPreferences?.MATRIX_BODIES||[]}function C(){return S?.aspect_types||ce.map(e=>({aspect_type:e}))}function bt(e){return C().find(t=>t?.aspect_type===e)||null}function V(){return(S?.bodies||[]).map(e=>e?.name).filter(Boolean)}function G(){return S?.signs||[]}function fe(){return V().filter(e=>!Oe.has(e))}function L(e="natal"){let t=C(),n=V();return window.AstroPreferences?.buildDefaultOrbProfileMatrix?window.AstroPreferences.buildDefaultOrbProfileMatrix(t,n,e):Object.fromEntries(t.map(o=>[o.aspect_type,Object.fromEntries(n.map(a=>[a,e==="prognostic"?a==="Moon"?3:1:Number(o.base_orb||5)]))]))}function $(){let e={version:2,pair_strategy:j,profiles:Object.fromEntries(ee.map(t=>[t,{matrix:L(t)}]))};return v({orbs:e,balances:S?.default_balance_targets||{},dignities:S?.default_dignities||{version:1,signs:{}}})}function ye(){return x(S?.default_visual_palettes||{})}function he(){return{chart_defaults:{natal:B({}),biwheel:B({}),forecast_new:B({}),solar:B({})},chart_creation_defaults:{house_system:"P"},methodology:$(),visual:ye()}}function be(){return document.getElementById("accountTimezoneLabelFormatSelect")}function Se(){return document.getElementById("accountDateFormatSelect")}function we(){return document.getElementById("accountDegreeFormatSelect")}function _e(e){return e==="natal"?{orientation:document.getElementById("natalOrientationSelect"),aspectScope:document.getElementById("natalAspectScopeSelect"),showApplyingSeparating:document.getElementById("natalShowApplyingSeparating"),showSpeed:document.getElementById("natalShowSpeed"),showStationary:document.getElementById("natalShowStationary"),showAspectText:document.getElementById("natalShowAspectText")}:e==="biwheel"?{orientation:document.getElementById("biwheelOrientationSelectAccount"),aspectScope:document.getElementById("biwheelAspectScopeSelectAccount"),showApplyingSeparating:null,showSpeed:null,showStationary:null,showAspectText:document.getElementById("biwheelShowAspectTextAccount")}:{orientation:document.getElementById("solarOrientationSelectAccount"),aspectScope:document.getElementById("solarAspectScopeSelectAccount"),showApplyingSeparating:document.getElementById("solarShowApplyingSeparatingAccount"),showSpeed:document.getElementById("solarShowSpeedAccount"),showStationary:document.getElementById("solarShowStationaryAccount"),showAspectText:document.getElementById("solarShowAspectTextAccount")}}function P(){return h||(h={methodology:$()}),h.methodology=v(h.methodology||$()),h.methodology}function Ye(e){return P()?.orbs?.profiles?.[e]?.matrix||L(e)}function ze(){let e=document.getElementById("accountOrbPairStrategySelect");return e?window.AstroPreferences?.normalizeOrbPairStrategy?.(e.value)||j:v(h?.methodology||$())?.orbs?.pair_strategy||j}function Ee(e){return I(`astro.sign.${e}`,window.Symbols?.signNamesRu?.[e]||e)}function je(e){return window.Symbols?.signs?.[e]||String(e||"").slice(0,2)||"•"}function Ue(e){let t=r(Ee(e)),n=r(je(e));return`<span class="astro-symbol" aria-hidden="true" title="${t}">${n}</span>`}function St(e){return G().find(t=>t?.name===e)?.opposite||null}function ne(){let e=P();return e.dignities=F(e.dignities||{},S?.default_dignities||{}),e.dignities}function Je(e={}){let t=fe(),n=Object.fromEntries(t.map(o=>[o,{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]}]));return G().forEach(o=>{let a=o?.name,c=o?.opposite,s=e?.signs?.[a]||{};s.ruler&&n[s.ruler]&&(n[s.ruler].domicile_primary.push(a),c&&n[s.ruler].detriment_primary.push(c)),s.co_ruler&&n[s.co_ruler]&&(n[s.co_ruler].domicile_secondary.push(a),c&&n[s.co_ruler].detriment_secondary.push(c)),s.exaltation&&n[s.exaltation]&&(n[s.exaltation].exaltation.push(a),c&&n[s.exaltation].fall.push(c))}),n}function K(e=[],{mode:t="derived",secondarySigns:n=[]}={}){let o=new Set(n||[]);return G().map(a=>{let c=a?.name,s=e.includes(c)||o.has(c),i=o.has(c),l=["account-settings-dignity-glyph",s?"is-active":"",i?"is-secondary":"",t==="derived"?"is-derived":""].filter(Boolean).join(" "),d=r(Ee(c)),u=r(`${d} · ${m(s?i?"page.accountSettings.dignities.states.secondary":"page.accountSettings.dignities.states.primary":"page.accountSettings.dignities.states.empty")}`);return`
                <button
                    type="button"
                    class="${l}"
                    data-dignity-mode="${t}"
                    data-dignity-sign="${c}"
                    title="${u}"
                    aria-label="${u}"
                    ${t==="derived"?"disabled":""}
                >${Ue(c)}</button>
            `}).join("")}function Ae(){let e=document.getElementById("accountOrbProfileHint"),t=document.getElementById("accountOrbMatrixPanel"),n=document.getElementById("accountApplyNatalOrbsBtn");document.querySelectorAll("[data-orb-profile-tab]").forEach(o=>{let a=o.dataset.orbProfileTab===y;o.classList.toggle("is-active",a),o.setAttribute("aria-selected",a?"true":"false"),t&&a&&o.id&&t.setAttribute("aria-labelledby",o.id)}),e&&(e.textContent=m(`page.accountSettings.orbs.hints.${y}`)),n&&n.classList.toggle("hidden",y==="natal")}function Be(){let e=document.getElementById("accountOrbMatrixPanel"),t=document.getElementById("accountOrbsTable");document.querySelectorAll("[data-orb-view-mode]").forEach(n=>{let o=n.dataset.orbViewMode===k;n.classList.toggle("is-active",o),n.setAttribute("aria-selected",o?"true":"false")}),e?.classList.toggle("is-compact",k==="compact"),t?.classList.toggle("is-compact",k==="compact")}function ve(e){Ce.includes(e)&&(J=e,document.querySelectorAll("[data-visual-tab]").forEach(t=>{let n=t.dataset.visualTab===J;t.classList.toggle("is-active",n),t.setAttribute("aria-selected",n?"true":"false")}),document.querySelectorAll("[data-visual-panel]").forEach(t=>{t.classList.toggle("hidden",t.dataset.visualPanel!==J)}))}function Pe(e){return String(e||"").trim().replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}function xe(e,t,n,o="#6b7280"){let a=String(n||o).trim();e.style.setProperty(t,/^#[0-9a-f]{6}$/i.test(a)?a:o)}function H(e={}){let t=document.getElementById("accountVisualWheelPreview");if(!t)return;let n=x(e),o=n?.planet_colors?.element_palette||{},a=n?.planet_colors?.body_overrides||{};Le.forEach(c=>{let s=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(c,n):n?.aspect_colors?.[c];xe(t,`--preview-aspect-${Pe(c)}`,s)}),Object.entries(Me).forEach(([c,s])=>{let i=a?.[c]||o?.[s]||me(c,n);xe(t,`--preview-body-${Pe(c)}`,i)}),t.style.setProperty("--preview-cusp",n?.wheel?.angular_cusps_black===!0?"#111827":"#8d6f54"),t.style.setProperty("--preview-line-width",n?.wheel?.highlight_exact_aspects===!1?"1.5px":"2.5px")}function oe(){let e=P(),t=L(y);document.querySelectorAll("#accountOrbsMatrixBody input[data-orb-aspect-type][data-orb-body]").forEach(n=>{let o=n.dataset.orbAspectType,a=n.dataset.orbBody;!o||!a||(t[o]||(t[o]={}),t[o][a]=Number.parseFloat(n.value)||0)}),e.orbs.profiles[y]={matrix:t}}function We(e,{rerender:t=!0}={}){ee.includes(e)&&(h&&oe(),y=e,Ae(),t&&h&&ae(h.methodology))}function Ge(e){["default","compact"].includes(e)&&(k=e,localStorage.setItem(re,e),Be())}function Ke(e={}){let t=document.getElementById("accountAspectTypesMatrixBody");t&&(t.innerHTML=C().map(n=>{let o=n.aspect_type,a=r(te(o)),c=r(N(o)),s=Z.map(i=>{let l=e?.[i]?.aspects?.enabled_types||[],f=new Set(Array.isArray(l)&&l.length?l:ce).has(o)?"checked":"";return`
                    <td>
                        <label class="account-settings-aspect-cell">
                            <input
                                type="checkbox"
                                data-view-id="${i}"
                                data-aspect-type="${o}"
                                ${f}
                                aria-label="${r(`${I(`page.accountSettings.tables.columns.${i}`,i)}: ${c}`)}"
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
            `}).join(""))}function Qe(e={}){let t=document.getElementById("accountBodiesMatrixBody");t&&(t.innerHTML=qe().map(n=>{let o=r(p(n)),a=D(n,{size:18,title:p(n)}),c=Z.map(s=>{let i=pe(e?.[s]?.matrix?.rows||{}),l=i?.[n]?.display!==!1?"checked":"",d=i?.[n]?.aspecting!==!1?"checked":"";return`
                    <td>
                        <label class="account-settings-matrix-toggle">
                            <input
                                type="checkbox"
                                data-view-id="${s}"
                                data-matrix-body="${n}"
                                data-matrix-field="display"
                                ${l}
                                aria-label="${r(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.display")}`)}"
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
                                ${d}
                                aria-label="${r(`${I(`page.accountSettings.tables.columns.${s}`,s)}: ${o} ${m("page.accountSettings.matrix.columns.aspecting")}`)}"
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
            `}).join(""))}function ae(e={}){let t=document.getElementById("accountOrbsHeaderRow"),n=document.getElementById("accountOrbsMatrixBody");if(!t||!n)return;let o=V(),a=C(),s=v(e||$())?.orbs?.profiles?.[y]?.matrix||L(y);t.innerHTML=`
            <th class="account-settings-orb-corner"></th>
            ${o.map(i=>{let l=r(p(i)),d=D(i,{size:18,title:p(i)});return`
                    <th>
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${l}" aria-label="${l}" role="img" tabindex="0">
                                ${d}
                            </span>
                        </span>
                    </th>
                `}).join("")}
        `,n.innerHTML=a.map(i=>{let l=i.aspect_type,d=r(te(l)),f=r(N(l));return`
                <tr>
                    <th scope="row">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${f}" aria-label="${f}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${d}</span>
                            </span>
                        </span>
                    </th>
                    ${o.map(u=>{let g=s?.[l]?.[u],b=r(p(u));return`
                            <td>
                                <input
                                    class="account-settings-number-input account-settings-orb-input"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.1"
                                    value="${Number.isFinite(Number(g))?Number(g):Number(i.base_orb||5)}"
                                    aria-label="${r(`${f} · ${b}`)}"
                                    data-orb-aspect-type="${l}"
                                    data-orb-body="${u}"
                                    data-orb-profile="${y}"
                                >
                            </td>
                        `}).join("")}
                </tr>
            `}).join(""),Ae(),Be()}function $e(e={}){let t=document.getElementById("accountDignitiesMatrixBody");if(!t)return;let n=F(e?.dignities||{},S?.default_dignities||{}),o=Je(n);t.innerHTML=fe().map(a=>{let c=r(p(a)),s=o[a]||{domicile_primary:[],domicile_secondary:[],detriment_primary:[],detriment_secondary:[],exaltation:[],fall:[]};return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${c}" aria-label="${c}" role="img" tabindex="0">
                                ${D(a,{size:18,title:p(a)})}
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
            `}).join("")}function Xe(e,t){let n=ne(),o={...n.signs?.[e]||{}};o.ruler===t?o.co_ruler?(o.ruler=o.co_ruler,o.co_ruler=null):o.ruler=null:o.co_ruler===t?o.co_ruler=null:o.ruler?o.co_ruler=t:o.ruler=t,n.signs[e]=o,P().dignities=F(n,S?.default_dignities||{})}function Ze(e,t){let n=ne(),o={...n.signs?.[e]||{}};o.exaltation=o.exaltation===t?null:t,n.signs[e]=o,P().dignities=F(n,S?.default_dignities||{})}function et(e={}){let t=document.getElementById("accountBalancePlanetWeightsBody"),n=document.getElementById("accountBalanceSpecialWeightsBody");if(!t||!n)return;let o=e?.balances||{},a=o?.planet_weights||{},c=o?.special_point_weights||{},i=V().filter(d=>!["TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","DSC","MC","IC","Vertex","AntiVertex"].includes(d)),l=["TrueNorthNode","TrueSouthNode","BlackMoon"];t.innerHTML=i.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(d))}" aria-label="${r(p(d))}" role="img" tabindex="0">
                                ${D(d,{size:18,title:p(d)})}
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
                        aria-label="${r(p(d))}"
                    >
                </td>
            </tr>
        `).join(""),n.innerHTML=l.map(d=>`
            <tr>
                <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(d))}" aria-label="${r(p(d))}" role="img" tabindex="0">
                                ${D(d,{size:18,title:p(d)})}
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
                        aria-label="${r(p(d))}"
                    >
                </td>
            </tr>
        `).join("")}function tt(e={}){let t=document.getElementById("accountAspectColorsBody");if(!t)return;let n=x(e);t.innerHTML=C().map(o=>{let a=o.aspect_type,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a,n):"#9ca3af";return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-aspect-meta account-settings-aspect-meta--icon-only">
                            <span class="account-settings-check-glyph account-settings-orb-glyph" title="${r(N(a))}" aria-label="${r(N(a))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(te(a))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <input
                            type="color"
                            class="account-settings-color-input account-settings-swatch-input"
                            value="${r(c)}"
                            data-aspect-color="${a}"
                            aria-label="${r(N(a))}"
                        >
                    </td>
                </tr>
            `}).join("")}function nt(e={}){let t=document.getElementById("accountElementPaletteBody"),n=document.getElementById("accountBodyOverrideColorsBody");if(!t||!n)return;let o=x(e),a=o?.planet_colors?.element_palette||{},c=o?.planet_colors?.body_overrides||{},s=document.getElementById("accountAngularCuspsBlackToggle");s&&(s.checked=o?.wheel?.angular_cusps_black===!0);let i=document.getElementById("accountExactAspectHighlightToggle");i&&(i.checked=o?.wheel?.highlight_exact_aspects!==!1),t.innerHTML=Object.keys(a).map(l=>`
            <tr>
                <th scope="row">${r(l)}</th>
                <td><input type="color" class="account-settings-color-input account-settings-swatch-input" value="${r(a[l])}" data-element-color="${l}" aria-label="${r(l)}"></td>
            </tr>
        `).join(""),n.innerHTML=V().map(l=>{let d=me(l,o),f=!!c?.[l],u=c?.[l]||d;return`
                <tr>
                    <th scope="row" class="account-settings-icon-cell">
                        <span class="account-settings-body account-settings-body--icon-only">
                            <span class="account-settings-body-badge account-settings-orb-glyph" title="${r(p(l))}" aria-label="${r(p(l))}" role="img" tabindex="0">
                                <span class="astro-symbol" aria-hidden="true">${r(ge(l))}</span>
                            </span>
                        </span>
                    </th>
                    <td>
                        <div class="account-settings-color-stack">
                            <input
                                type="color"
                                class="account-settings-color-input account-settings-swatch-input"
                                value="${r(u)}"
                                data-body-color-override="${l}"
                                data-body-color-active="${f?"true":"false"}"
                                data-body-color-default="${r(d)}"
                                aria-label="${r(p(l))}"
                            >
                            <button
                                type="button"
                                class="account-settings-reset-chip${f?"":" is-muted"}"
                                data-clear-body-color-override="${l}"
                                title="${r(m("common.reset"))}"
                                aria-label="${r(`${m("common.reset")}: ${p(l)}`)}"
                            >↺</button>
                        </div>
                    </td>
                </tr>
            `}).join("")}function Q(e,{updateBaseline:t=!1}={}){let n={...he(),...e||{},chart_defaults:{natal:B(e?.chart_defaults?.natal||{}),biwheel:B(e?.chart_defaults?.biwheel||{}),forecast_new:B(e?.chart_defaults?.forecast_new||{}),solar:B(e?.chart_defaults?.solar||{})},chart_creation_defaults:{house_system:e?.chart_creation_defaults?.house_system||"P"},methodology:v(e?.methodology||$()),visual:x(e?.visual||ye())};h=n,t&&(ie=R(n.methodology)),window.AstroPreferences?.setAccountVisualPreferences?.(n.visual),ee.includes(y)||(y="natal");let o=document.getElementById("accountHouseSystemSelect");o&&(o.value=n.chart_creation_defaults.house_system||"P");let a=n.chart_defaults.natal?.view_options||{},c=n.chart_defaults.natal?.table_options||{},s=document.getElementById("accountOrientationSelect");s&&(s.value=a.orientation==="asc"?"asc":"aries");let i=document.getElementById("accountHouseNumberStyleSelect");i&&(i.value=a.house_number_style==="roman"?"roman":"arabic");let l=document.getElementById("accountHouseLabelsOutsideToggle");l&&(l.checked=a.house_labels_outside===!0);let d=document.getElementById("accountShowAspectTextToggle");d&&(d.checked=c.show_aspect_text===!0);let f=document.getElementById("accountAngularCuspsBoldToggle");f&&(f.checked=a.bold_asc_dsc!==!1&&a.bold_mc_ic!==!1);let u=be();u&&(u.value=n.visual?.timezone_label_format==="GMT"?"GMT":"UTC");let g=Se();if(g){let T=["DD_MM_YYYY","MM_DD_YYYY","YYYY_MM_DD","LOCALE"].includes(n.visual?.date_format)?n.visual.date_format:"DD_MM_YYYY";g.value=T}let b=we();if(b){let T=["DEGREES_ONLY","DEGREES_MINUTES","DEGREES_MINUTES_SECONDS"].includes(n.visual?.degree_format)?n.visual.degree_format:"DEGREES_ONLY";b.value=T}let w=document.getElementById("accountOrbPairStrategySelect");w&&(w.value=n.methodology?.orbs?.pair_strategy||j);let E=document.getElementById("accountStationaryThresholdPercent");E&&(E.value=String(n.methodology?.stationary?.threshold_percent??5)),Z.forEach(T=>{let M=n.chart_defaults[T],_=_e(T);_.orientation&&(_.orientation.value=M.view_options?.orientation==="asc"?"asc":"aries"),_.aspectScope&&(_.aspectScope.value=M.aspects?.scope||(T==="biwheel"?"major":"all")),_.showApplyingSeparating&&(_.showApplyingSeparating.checked=M.aspects?.show_applying_separating===!0),_.showSpeed&&(_.showSpeed.checked=M.table_options?.show_speed!==!1),_.showStationary&&(_.showStationary.checked=M.table_options?.show_stationary!==!1),_.showAspectText&&(_.showAspectText.checked=M.table_options?.show_aspect_text===!0)}),Ke(n.chart_defaults),Qe(n.chart_defaults),ae(n.methodology),$e(n.methodology),et(n.methodology),tt(n.visual),nt(n.visual),H(n.visual)}function ot(e){let t=[];return document.querySelectorAll(`#accountAspectTypesMatrixBody input[data-view-id="${e}"][data-aspect-type]`).forEach(n=>{n.checked&&n.dataset.aspectType&&t.push(n.dataset.aspectType)}),t.length?t:C().map(n=>n.aspect_type)}function at(e){let t=pe({});return document.querySelectorAll(`#accountBodiesMatrixBody input[data-view-id="${e}"][data-matrix-body][data-matrix-field]`).forEach(n=>{let o=n.dataset.matrixBody,a=n.dataset.matrixField;!o||!a||(t[o]={...t[o]||{display:!0,aspecting:!0},[a]:n.checked})}),t}function wt(e){let t=_e(e);return{matrix:{rows:at(e)},aspects:{scope:t.aspectScope?.value||(e==="biwheel"?"major":"all"),enabled_types:ot(e),show_applying_separating:t.showApplyingSeparating?.checked===!0},table_options:{show_speed:t.showSpeed?t.showSpeed.checked!==!1:!0,show_stationary:t.showStationary?t.showStationary.checked!==!1:!0,show_aspect_text:t.showAspectText?.checked===!0},view_options:{orientation:t.orientation?.value==="asc"?"asc":"aries"}}}function st(){oe();let t=(v(h?.methodology||$())?.orbs||{})?.profiles||{},n={};document.querySelectorAll("[data-balance-planet]").forEach(a=>{a.dataset.balancePlanet&&(n[a.dataset.balancePlanet]=Number.parseFloat(a.value)||0)});let o={};return document.querySelectorAll("[data-balance-special-point]").forEach(a=>{a.dataset.balanceSpecialPoint&&(o[a.dataset.balanceSpecialPoint]=Number.parseFloat(a.value)||0)}),v({orbs:{version:2,pair_strategy:ze(),profiles:t},balances:{version:1,planet_weights:n,special_point_weights:o},stationary:{threshold_percent:Number.parseFloat(document.getElementById("accountStationaryThresholdPercent")?.value||"5")},dignities:F(h?.methodology?.dignities||ne(),S?.default_dignities||{})})}function q(){let e={};document.querySelectorAll("[data-aspect-color]").forEach(o=>{o.dataset.aspectColor&&o.value&&(e[o.dataset.aspectColor]=o.value)});let t={};document.querySelectorAll("[data-element-color]").forEach(o=>{o.dataset.elementColor&&o.value&&(t[o.dataset.elementColor]=o.value)});let n={};return document.querySelectorAll("[data-body-color-override]").forEach(o=>{let a=o.dataset.bodyColorOverride,c=String(o.value||"").trim();a&&c&&o.dataset.bodyColorActive!=="false"&&(n[a]=c)}),x({aspect_colors:e,planet_colors:{element_palette:t,body_overrides:n},wheel:{angular_cusps_black:document.getElementById("accountAngularCuspsBlackToggle")?.checked===!0,highlight_exact_aspects:document.getElementById("accountExactAspectHighlightToggle")?.checked!==!1},timezone_label_format:be()?.value||"UTC",date_format:Se()?.value||"DD_MM_YYYY",degree_format:we()?.value||"DEGREES_ONLY"})}function ct(){let e=document.getElementById("accountOrientationSelect")?.value==="asc"?"asc":"aries",t=document.getElementById("accountHouseNumberStyleSelect")?.value==="roman"?"roman":"arabic",n=document.getElementById("accountHouseLabelsOutsideToggle")?.checked===!0,o=document.getElementById("accountShowAspectTextToggle")?.checked===!0,a=document.getElementById("accountAngularCuspsBoldToggle")?.checked!==!1;return{table_options:{show_aspect_text:o},view_options:{orientation:e,house_number_style:t,house_labels_outside:n,bold_asc_dsc:a,bold_mc_ic:a}}}function rt(){let e=ct();return{chart_creation_defaults:{house_system:document.getElementById("accountHouseSystemSelect")?.value||"P"},chart_defaults:{natal:R(e),biwheel:R(e),forecast_new:R(e),solar:R(e)},methodology:st(),visual:q()}}function A(e,t="info"){let n=document.getElementById("accountSettingsToast");!n||!e||(n.textContent=e,n.className=`toast ${t}`,requestAnimationFrame(()=>n.classList.add("visible")),clearTimeout(le),le=setTimeout(()=>{n.classList.remove("visible")},2800))}function Te(){let e=document.querySelector(".account-settings-header");if(e instanceof HTMLElement){e.scrollIntoView({behavior:"smooth",block:"start"});return}window.scrollTo({top:0,behavior:"smooth"})}async function it(){let e=localStorage.getItem("currentUserId");if(!(!e||!window.AstroAPI?.getNatalChart))try{let t=await window.AstroAPI.getNatalChart(e);window.AstroAPI?.saveChartToSession?.(t)}catch(t){console.warn("Failed to refresh current chart after methodology recalculation:",t)}}function X(e,{final:t=!1}={}){let n=document.getElementById("methodologyJobStatus");if(!n)return;if(!e){n.classList.add("hidden"),n.replaceChildren();return}let o=Number(e.progress_total||0),a=Number(e.progress_done||0),c=o>0?Math.min(100,Math.round(a/o*100)):0,s=String(e.status||"pending"),i=Number(e.failed_count||0),l={pending:"Карты ожидают пересчета",running:"Карты пересчитываются с учетом новых настроек",completed:i?"Пересчет завершен с ошибками":"Пересчет карт завершен",failed:"Пересчет карт не выполнен"},d={pending:"ОЖИДАНИЕ",running:"В ПРОЦЕССЕ",completed:i?"С ОШИБКАМИ":"ГОТОВО",failed:"ОШИБКА"},f=[o>0?`${a}/${o} карт`:"Подготовка списка карт",`${c}%`];i&&f.push(`ошибок: ${i}`),!t&&s!=="completed"&&s!=="failed"&&f.push("можно остаться на странице и дождаться завершения"),n.innerHTML=`
            <div class="account-settings-status-title">
                <span>${r(l[s]||"Пересчет карт")}</span>
                <span>${r(d[s]||String(s).toUpperCase())}</span>
            </div>
            <div class="account-settings-status-meta">${r(f.join(" · "))}</div>
            <div class="account-settings-status-progress" aria-hidden="true">
                <div class="account-settings-status-progress-bar" style="--progress: ${c}%"></div>
            </div>
        `,n.classList.remove("hidden"),n.dataset.status=s}function se(){O&&(clearTimeout(O),O=null)}async function Ie(e){if(se(),!e||!window.AstroAPI?.getPreferenceRecalcJob)return;sessionStorage.setItem(U,String(e));let t=async()=>{try{let n=await window.AstroAPI.getPreferenceRecalcJob(e);if(X(n,{final:n.status==="completed"||n.status==="failed"}),n.status==="completed"){sessionStorage.removeItem(U),A(n.failed_count?`Пересчет завершен с ошибками: ${n.failed_count}.`:"Пересчет карт завершен.",n.failed_count?"info":"success"),await it(),se();return}if(n.status==="failed"){sessionStorage.removeItem(U),A(n.error||"Пересчет карт не выполнен.","error"),se();return}O=setTimeout(t,2500)}catch(n){O=setTimeout(t,4e3),console.warn("Failed to poll preference recalculation job:",n)}};await t()}async function lt(){let e=await window.AstroAPI?.requireAuth?.({redirectTo:"/login.html"});if(!e)return;let t=document.getElementById("accountSettingsSubtitle");t&&(t.textContent=e.email?m("page.accountSettings.subtitleWithEmail",{email:e.email}):m("page.accountSettings.subtitle")),Fe(e);let[n,o]=await Promise.all([window.AstroAPI.getPreferencesMetadata?.(),window.AstroAPI.getAccountPreferences()]);S=n||null,Q(o,{updateBaseline:!0});let a=sessionStorage.getItem(U);a?Ie(a).catch(c=>{console.warn("Failed to resume recalculation job polling:",c)}):X(null),de()}async function dt(){let e=document.getElementById("saveAccountSettingsBtn");e&&(e.disabled=!0);try{let t=rt(),n=localStorage.getItem("currentUserId")||null,o=!He(v(ie||{}),t.methodology),a=(h?.chart_creation_defaults?.house_system||"P")!==(t.chart_creation_defaults?.house_system||"P"),c=await window.AstroAPI.patchAccountPreferences(t);if(Q(c,{updateBaseline:!0}),(o||a)&&window.AstroAPI?.createPreferenceRecalcJob){let s=await window.AstroAPI.createPreferenceRecalcJob({job_type:"methodology_recalc",payload:{source:"account-settings",...n?{priority_user_id:n}:{}}});X(s),Ie(s.job_id).catch(i=>{console.warn("Failed to poll methodology recalculation job:",i)}),A("Настройки сохранены. Карты пересчитываются с учетом новых настроек.","success"),requestAnimationFrame(Te);return}A(m("page.accountSettings.toasts.saved"),"success"),requestAnimationFrame(Te)}catch(t){A(t.message||m("page.accountSettings.toasts.saveFailed"),"error")}finally{e&&(e.disabled=!1)}}function ut(){Q(he()),X(null),A(m("page.accountSettings.toasts.restored"),"info")}function Y({restoreFocus:e=!0}={}){let t=document.getElementById("accountSettingsResetConfirmDialog"),n=document.getElementById("accountSettingsResetConfirmBackdrop");t&&t.classList.add("hidden"),n&&n.classList.add("hidden"),document.body.classList.remove("account-settings-modal-open"),e&&W instanceof HTMLElement&&W.focus(),W=null}function gt(){let e=document.getElementById("accountSettingsResetConfirmDialog"),t=document.getElementById("accountSettingsResetConfirmBackdrop"),n=document.getElementById("accountSettingsResetConfirmSubmit");!e||!t||(W=document.activeElement instanceof HTMLElement?document.activeElement:null,t.classList.remove("hidden"),e.classList.remove("hidden"),document.body.classList.add("account-settings-modal-open"),requestAnimationFrame(()=>{n?.focus()}))}document.addEventListener("DOMContentLoaded",async()=>{k=localStorage.getItem(re)==="compact"?"compact":"default",ke();let e=document.getElementById("saveAccountSettingsBtn"),t=document.getElementById("restoreStandardDefaultsBtn"),n=document.getElementById("accountApplyNatalOrbsBtn"),o=document.getElementById("accountOrbsMatrixBody"),a=document.getElementById("accountDignitiesMatrixBody"),c=document.getElementById("accountBodyOverrideColorsBody"),s=document.getElementById("accountSettingsResetConfirmDialog"),i=document.getElementById("accountSettingsResetConfirmBackdrop"),l=document.getElementById("accountSettingsResetConfirmClose"),d=document.getElementById("accountSettingsResetConfirmCancel"),f=document.getElementById("accountSettingsResetConfirmSubmit");e?.addEventListener("click",()=>{dt()}),t?.addEventListener("click",()=>{gt()}),i?.addEventListener("click",()=>{Y()}),l?.addEventListener("click",()=>{Y()}),d?.addEventListener("click",()=>{Y()}),f?.addEventListener("click",()=>{Y({restoreFocus:!1}),ut()}),document.querySelectorAll("[data-orb-profile-tab]").forEach(u=>{u.addEventListener("click",()=>{We(u.dataset.orbProfileTab||"natal")})}),document.querySelectorAll("[data-orb-view-mode]").forEach(u=>{u.addEventListener("click",()=>{Ge(u.dataset.orbViewMode||"default")})}),document.querySelectorAll("[data-visual-tab]").forEach(u=>{u.addEventListener("click",()=>{ve(u.dataset.visualTab||"aspectColors")})}),ve(J),n?.addEventListener("click",()=>{if(y==="natal")return;oe();let u=P();u.orbs.profiles[y]={matrix:JSON.parse(JSON.stringify(Ye("natal")))},ae(u),A(m("page.accountSettings.toasts.orbsCopied"),"info")}),o?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.orbAspectType||!g.dataset.orbBody)return;let b=P(),E=(b.orbs.profiles[y]||{matrix:L(y)}).matrix||L(y);E[g.dataset.orbAspectType]||(E[g.dataset.orbAspectType]={}),E[g.dataset.orbAspectType][g.dataset.orbBody]=Number.parseFloat(g.value)||0,b.orbs.profiles[y]={matrix:E}}),a?.addEventListener("click",u=>{let g=u.target.closest("[data-dignity-mode][data-dignity-sign]");if(!(g instanceof HTMLButtonElement))return;let b=g.dataset.dignityMode,w=g.dataset.dignitySign,E=g.closest("[data-dignity-planet]")?.dataset?.dignityPlanet;!b||!w||!E||b==="derived"||(b==="domicile"?Xe(w,E):b==="exaltation"&&Ze(w,E),$e(h?.methodology||P()))}),c?.addEventListener("input",u=>{let g=u.target;if(!(g instanceof HTMLInputElement)||!g.dataset.bodyColorOverride)return;g.dataset.bodyColorActive="true",c.querySelector(`[data-clear-body-color-override="${g.dataset.bodyColorOverride}"]`)?.classList.remove("is-muted"),H(q())}),c?.addEventListener("click",u=>{let g=u.target.closest("[data-clear-body-color-override]");if(!(g instanceof HTMLElement))return;let b=g.dataset.clearBodyColorOverride;if(!b)return;let w=c.querySelector(`[data-body-color-override="${b}"]`);w instanceof HTMLInputElement&&(w.dataset.bodyColorActive="false",w.value=w.dataset.bodyColorDefault||"#6b7280",g.classList.add("is-muted"),H(q()))}),document.addEventListener("input",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color]")&&H(q())}),document.addEventListener("change",u=>{let g=u.target;g instanceof HTMLInputElement&&g.matches("[data-aspect-color], [data-element-color], #accountAngularCuspsBlackToggle, #accountExactAspectHighlightToggle")&&H(q())});try{await window.FrontendI18n?.ready?.catch?.(()=>{}),await lt(),document.addEventListener("frontend:locale-changed",()=>{h&&Q(h)}),document.addEventListener("keydown",u=>{u.key==="Escape"&&(!s||s.classList.contains("hidden")||Y())})}catch(u){A(u.message||m("page.accountSettings.toasts.loadFailed"),"error"),de()}})})();
