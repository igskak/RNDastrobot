import{c as Z}from"./chunk-IZUYVIPG.js";var O=class O{constructor(e={}){let t=(s,o,n)=>s||(o?document.getElementById(o):document.getElementById(n));this.planetsTable=t(e.planetsTable,e.planetsTableId,"planetsTable"),this.housesTable=t(e.housesTable,e.housesTableId,"housesTable"),this.aspectsTable=t(e.aspectsTable,e.aspectsTableId,"aspectsTable"),this.aspectGridContainer=t(e.aspectGridContainer,e.aspectGridContainerId,"aspectGridContainer"),this.configsContainer=t(e.configsContainer,e.configsContainerId,"configurationsContainer"),this.balancesContainer=t(e.balancesContainer,e.balancesContainerId,"balancesContainer"),this.dignitiesContainer=t(e.dignitiesContainer,e.dignitiesContainerId,"dignitiesContainer"),this.aspectSortHeadersSelector=e.aspectSortHeadersSelector||"#aspects-list th.sortable[data-sort]",this.aspectTypeFilter="all",this.aspectPlanetFilter=null,this.aspectSortState={field:"planet",ascending:!0},this.aspectSortHeaders=[],this.hoveredAspectKey=null,this.showSpeed=!0,this.showStationary=!0,this.showApplyingSeparating=!1,this.showAspectText=!1,this.showSpeedColumn=e.showSpeedColumn!==!1,this.showHouseColumn=e.showHouseColumn!==!1,this.onPlanetsRendered=typeof e.onPlanetsRendered=="function"?e.onPlanetsRendered:null,this.fixedStarsData=null,this.showFixedStarBadges=!1,this.houseNumberStyle=Symbols?.readSavedHouseNumberStyle?.()||"arabic",this.visualPreferences=window.AstroPreferences?.getAccountVisualPreferences?.()||null,this.initAspectSortHeaders()}t(e,t){return window.FrontendI18n?.t?.(e,t)||e}planetName(e){let t=this.getCuspHouseNumber(e);if(t){let n=Symbols?.formatHouseLabel?.(t)||String(t);return this.t("page.chart.houseCusp",{house:n})}let s=`astro.planet.${e}`,o=this.t(s);return o===s?Symbols.getPlanetNameRu?.(e)||Symbols.planetNamesRu[e]||e:o}signName(e){let t=`astro.sign.${e}`,s=this.t(t);return s===t?Symbols.signNamesRu[e]||e:s}aspectName(e){let t=`astro.aspect.${e}`,s=this.t(t);return s===t?Symbols.aspectNamesRu[e]||e:s}getPlanetSymbol(e){return Symbols.getPlanetSymbol?.(e)||Symbols.planets?.[this.normalizeAspectBodyName(e)]||Symbols.planets?.[e]||""}getPlanetSymbolMarkup(e,t={}){let s=this.getCuspHouseNumber(e);if(s){let o=Symbols?.formatHouseLabel?.(s)||String(s),n=this.escapeHtml(t.title||this.planetName(e));return`<span class="aspect-cusp-symbol" title="${n}" aria-label="${n}">${this.escapeHtml(o)}</span>`}return Symbols.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${this.escapeHtml(this.getPlanetSymbol(e))}</span>`}getCuspHouseNumber(e){let t=/^Cusp([1-9]|1[0-2])$/.exec(String(e||""));return t?Number(t[1]):null}getAspectSymbol(e){return Symbols.getAspectDisplay?.(e)||Symbols.aspects?.[e]||"•"}escapeHtml(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}retrogradeTitle(){let e="page.natalFull.legend.motion.retrograde",t=this.t(e);return t===e?"Retrograde":t}stationaryTitle(){let e="page.natalFull.legend.motion.stationary",t=this.t(e);return t===e?"Stationary":t}dignityTitle(e){if(!e||e==="neutral")return"";let t=`astro.dignity.${e}`,s=this.t(t);return s===t?e:s}dignityShortLabel(e){let t=String(this.dignityTitle(e)||"").trim();return t?Array.from(t)[0].toUpperCase():""}getApplyingSeparatingLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?this.t("page.chart.settings.aspectPhase.applying"):this.t("page.chart.settings.aspectPhase.separating");let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?this.t("page.chart.settings.aspectPhase.applying"):s.includes("separ")||s.includes("расход")?this.t("page.chart.settings.aspectPhase.separating"):t}getApplyingSeparatingShortLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?"сход.":"расх.";let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?"сход.":s.includes("separ")||s.includes("расход")?"расх.":t}retroIndicatorHtml(e,t=""){if(!e)return"";let s=t?` ${t}`:"",o=this.escapeHtml(this.retrogradeTitle());return`<span class="retro-indicator${s}" title="${o}" aria-label="${o}">R</span>`}stationaryIndicatorHtml(e,t=""){if(!e?.is_stationary)return"";let s=t?` ${t}`:"",o=this.escapeHtml(this.stationaryTitle());return`<span class="planet-status-badge planet-status-badge--stationary${s}" title="${o}" aria-label="${o}">S</span>`}dignityIndicatorHtml(e,t=""){let s=String(e?.dignity||"").trim();if(!s||s==="neutral")return"";let o=this.dignityTitle(s),n=this.dignityShortLabel(s);if(!o||!n)return"";let r=t?` ${t}`:"",p=this.escapeHtml(o);return`
            <span class="planet-status-badge planet-status-badge--dignity planet-status-badge--${this.escapeHtml(s)}${r}" title="${p}" aria-label="${p}">
                ${this.escapeHtml(n)}
            </span>
        `}solarBadgeTitle(e){let t=`astro.feature.short.${e}`,s=this.t(t);return s===t?e:s}sunRelationIndicatorHtml(e,t=""){let s=String(e?.sun_relation||"").trim(),n={cazimi:"Cz",combust:"Cb",under_rays:"Ur"}[s];if(!n)return"";let r=t?` ${t}`:"",p=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--sun-relation planet-status-badge--${this.escapeHtml(s)}${r}" title="${p}" aria-label="${p}">${n}</span>`}solarPhaseIndicatorHtml(e,t=""){let s=String(e?.solar_phase||"").trim(),n={oriental:"Or",occidental:"Oc"}[s];if(!n)return"";let r=t?` ${t}`:"",p=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--solar-phase planet-status-badge--${this.escapeHtml(s)}${r}" title="${p}" aria-label="${p}">${n}</span>`}outOfBoundsIndicatorHtml(e,t=""){if(!e?.out_of_bounds)return"";let s=t?` ${t}`:"",o="astro.feature.short.out_of_bounds",n=this.t(o),r=this.escapeHtml(n&&n!==o?n:"Out of bounds");return`<span class="planet-status-badge planet-status-badge--oob${s}" title="${r}" aria-label="${r}">OOB</span>`}buildRetrogradeLookup(e=[]){let t=new Map;return e.forEach(s=>{if(!s?.name)return;let o=this.normalizeAspectBodyName(s.name);t.set(o,!!s.retrograde)}),t}isBodyRetrograde(e,t=null){if(!e)return!1;let s=this.normalizeAspectBodyName(String(e));return(t||this.buildRetrogradeLookup(this.chartData?.planets||[])).get(s)===!0}buildPlanetHouseLookup(e=[]){let t=new Map;return e.forEach(s=>{!s?.name||s.house==null||s.house===""||t.set(this.normalizeAspectBodyName(s.name),s.house)}),t}buildHouseRulerGroups(e,t=new Map,s=null){if(Array.isArray(e?.ruler_groups)&&e.ruler_groups.length)return e.ruler_groups.map($=>({included:$?.scope==="included",entries:($?.entries||[]).filter(k=>{let I=this.normalizeAspectBodyName(k?.planet);return I&&(!(s instanceof Set)||s.has(I))}).map(k=>({planet:k.planet,house:k.house??t.get(this.normalizeAspectBodyName(k.planet))??null}))})).filter($=>$.entries.length);let o=[],r=[e?.ruler_planet,...Array.isArray(e?.co_rulers)?e.co_rulers:[]],p=new Set;return r.forEach(($,k)=>{if(!$)return;let I=this.normalizeAspectBodyName($);s instanceof Set&&!s.has(I)||p.has(I)||(p.add(I),o.push({planet:$,house:k===0&&e?.ruler_in_house!=null&&e?.ruler_in_house!==""?e.ruler_in_house:t.get(I)??null}))}),o.length?[{entries:o,included:!1}]:[]}renderHouseRulerGroup(e,t=null){return e?.entries?.length?`
            <div class="${e.included?"house-ruler-group house-ruler-group--included":"house-ruler-group"}">
                ${e.entries.map(o=>{let n=this.planetName(o.planet),r=o.house!=null&&o.house!==""?this.formatHouseNumber(o.house):"",p=[n];return r&&p.push(`${this.t("common.house")} ${r}`),`
                        <div class="house-ruler-row" title="${this.escapeHtml(p.join(" • "))}">
                            <span class="house-ruler-symbol-wrap">
                                ${this.getPlanetSymbolMarkup(o.planet,{size:18,title:n})}
                                ${this.retroIndicatorHtml(this.isBodyRetrograde(o.planet,t),"retro-indicator--micro house-ruler-retro")}
                            </span>
                            <span class="house-ruler-house">${this.escapeHtml(r||"—")}</span>
                        </div>
                    `}).join("")}
            </div>
        `:""}initAspectSortHeaders(){this.aspectSortHeaders=[...document.querySelectorAll(this.aspectSortHeadersSelector)],this.aspectSortHeaders.forEach(e=>{e.addEventListener("click",()=>{this.toggleAspectSort(e.dataset.sort)})}),this.updateAspectSortHeaders()}toggleAspectSort(e){e&&(this.aspectSortState.field===e?this.aspectSortState.ascending=!this.aspectSortState.ascending:(this.aspectSortState.field=e,this.aspectSortState.ascending=!0),this.updateAspectSortHeaders(),this.reRenderAspects())}updateAspectSortHeaders(){this.aspectSortHeaders.forEach(e=>{let t=this.aspectSortState.field===e.dataset.sort;e.classList.toggle("sort-active",t),e.classList.toggle("sort-desc",t&&!this.aspectSortState.ascending),e.setAttribute("aria-sort",t?this.aspectSortState.ascending?"ascending":"descending":"none")})}setAspectTypeFilter(e){let t=e==="major"||e==="minor"?e:"all";t!==this.aspectTypeFilter&&(this.aspectTypeFilter=t,this.reRenderAspects())}setAspectPlanetFilter(e){let t=e?this.normalizeAspectBodyName(String(e)):null;t!==this.aspectPlanetFilter&&(this.aspectPlanetFilter=t,this.reRenderAspects())}setDisplayPreferences(e={}){Object.prototype.hasOwnProperty.call(e,"showSpeed")&&(this.showSpeed=e.showSpeed!==!1),Object.prototype.hasOwnProperty.call(e,"showStationary")&&(this.showStationary=e.showStationary!==!1),Object.prototype.hasOwnProperty.call(e,"showApplyingSeparating")&&(this.showApplyingSeparating=e.showApplyingSeparating===!0),Object.prototype.hasOwnProperty.call(e,"showAspectText")&&(this.showAspectText=e.showAspectText===!0),this.updatePlanetsTableColumns(),this.chartData&&(this.renderPlanets(this.chartData.planets),this.renderAspects(this.chartData.aspects))}setHouseNumberStyle(e){let t=Symbols?.normalizeHouseNumberStyle?.(e)||"arabic";t!==this.houseNumberStyle&&(this.houseNumberStyle=t,this.chartData&&this.render(this.chartData))}updatePlanetsTableColumns(){let e=this.planetsTable?.closest("table");if(!e)return;e.classList.toggle("planets-table--speed-hidden",!this.showSpeed),e.classList.toggle("planets-table--speed-column-hidden",!this.showSpeedColumn),e.classList.toggle("planets-table--house-column-hidden",!this.showHouseColumn);let t=window.AstroPreferences?.getDegreeFormat?.()||"DEGREES_ONLY";e.classList.toggle("planets-table--seconds",t==="DEGREES_MINUTES_SECONDS")}setVisualPreferences(e={}){this.visualPreferences=window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e||{}):e||null,this.chartData&&this.render(this.chartData)}setFixedStarsData(e,t={}){this.fixedStarsData=e||null,this.showFixedStarBadges=t.showBadges===!0&&!!e,this.chartData&&this.renderPlanets(this.chartData.planets)}reRenderAspects(){this.chartData&&this.renderAspects(this.chartData.aspects)}render(e){this.chartData=e,this.renderPlanets(e.planets),this.renderHouses(e.houses),this.renderAspects(e.aspects),this.renderAspectGrid(e.aspects,e.planets),this.renderDignities(e.planets),this.renderConfigurations(e.aspect_configurations,e.stelliums),this.renderBalances(e.balances,e.cosmogram_pattern)}static normalizeBodyName(e){return window.Symbols?.normalizeBodyName?.(e)||e}renderPlanets(e){if(!e||!this.planetsTable)return;this.updatePlanetsTableColumns();let t=[...e].sort((s,o)=>{let n=O.PLANET_ORDER.indexOf(O.normalizeBodyName(s.name)),r=O.PLANET_ORDER.indexOf(O.normalizeBodyName(o.name));return(n===-1?999:n)-(r===-1?999:r)});this.planetsTable.innerHTML=t.map(s=>{let o=this.formatAstroCoordinate(s),n=this.createPlanetIconSVG(s),r=this.renderPlanetSpeedChip(s),p=this.renderFixedStarSymbolBadge(s),$=[this.showStationary?this.stationaryIndicatorHtml(s,"planet-status-badge--small"):"",this.retroIndicatorHtml(s.retrograde,"retro-indicator--small")].filter(Boolean).join(""),k=[this.dignityIndicatorHtml(s,"planet-status-badge--small"),this.sunRelationIndicatorHtml(s,"planet-status-badge--small"),this.solarPhaseIndicatorHtml(s,"planet-status-badge--small"),this.outOfBoundsIndicatorHtml(s,"planet-status-badge--small")].filter(Boolean).join("");return`
                <tr id="row-${s.name}" data-planet="${s.name}">
                    <td class="symbol-cell">
                        <div class="planet-symbol-cell">
                            <span class="planet-icon-wrap">
                                ${n}
                                ${p}
                            </span>
                            ${$?`<span class="planet-motion-stack">${$}</span>`:""}
                            <span class="planet-special-status-column" aria-hidden="true">${k}</span>
                        </div>
                    </td>
                    <td class="mono">
                        <div class="planet-position-main">${o}</div>
                    </td>
                    ${this.showSpeedColumn?`<td class="planet-speed-cell mono">${this.showSpeed?r:""}</td>`:""}
                    ${this.showHouseColumn?`<td class="mono">${this.escapeHtml(this.formatHouseNumber(s.house))}</td>`:""}
                </tr>
            `}).join(""),this.onPlanetsRendered?.(this)}getFixedStarContactsForPlanet(e){if(!this.showFixedStarBadges||!e)return[];let t=this.normalizeAspectBodyName(e);return(this.fixedStarsData?.conjunctions||[]).filter(s=>this.normalizeAspectBodyName(s?.object)===t).sort((s,o)=>Number(s.orb||0)-Number(o.orb||0))}findFixedStarInfo(e){let t=e?.star;return t?e?.star_info||(this.fixedStarsData?.stars||[]).find(s=>s?.name===t)||null:e?.star_info||null}fixedStarTooltipHtml(e){let t=this.findFixedStarInfo(e)||{},s=t.degree_in_sign_formatted&&t.sign?`${t.degree_in_sign_formatted} ${this.signName(t.sign)}`:e?.star_position||"",o=t.designation||"",n=t.magnitude!==null&&t.magnitude!==void 0?`m ${t.magnitude}`:"",r=t.nature||e?.nature||"",p=e?.object?this.planetName(e.object):"",$=e?.object_degree_in_sign_formatted&&e?.object_sign?`${e.object_degree_in_sign_formatted} ${this.signName(e.object_sign)}`:e?.object_position||"",k=Number(e?.orb),I=Number.isFinite(k)?`${k.toFixed(2)}°`:"";return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t.name||e?.star||"")}</div>
            ${s?`<div>${this.escapeHtml(s)}</div>`:""}
            ${o?`<div>${this.escapeHtml(o)}</div>`:""}
            ${n?`<div>${this.escapeHtml(n)}</div>`:""}
            ${r?`<div>${this.escapeHtml(r)}</div>`:""}
            ${p?`<div class="fixed-star-tooltip-contact">${this.escapeHtml(p)} ${this.escapeHtml($)}${I?` · ${this.escapeHtml(I)}`:""}</div>`:""}
        `.trim()}renderFixedStarSymbolBadge(e){let t=this.getFixedStarContactsForPlanet(e?.name);if(!t.length)return"";let s=this.fixedStarSummaryTooltipHtml(t),o=this.t("page.chart.settings.fixedStars.title"),n=t.length>1?`${o} (${t.length})`:o;return`
            <span
                class="fixed-star-badge fixed-star-badge--icon"
                role="img"
                tabindex="0"
                aria-label="${this.escapeHtml(n)}"
                data-fixed-star-tooltip="${this.escapeHtml(s)}"
            >✶</span>
        `}fixedStarSummaryTooltipHtml(e){if(e.length===1)return this.fixedStarTooltipHtml(e[0]);let t=this.t("page.chart.settings.fixedStars.title"),s=e.map(o=>{let n=this.findFixedStarInfo(o)||{},r=n.name||o?.star||"",p=n.degree_in_sign_formatted&&n.sign?`${n.degree_in_sign_formatted} ${this.signName(n.sign)}`:o?.star_position||"",$=Number(o?.orb),k=Number.isFinite($)?`${$.toFixed(2)}°`:"";return`
                <div class="fixed-star-tooltip-row">
                    <span class="fixed-star-tooltip-star">✶ ${this.escapeHtml(r)}</span>
                    ${p?`<span class="fixed-star-tooltip-pos">${this.escapeHtml(p)}</span>`:""}
                    ${k?`<span class="fixed-star-tooltip-orb">${this.escapeHtml(k)}</span>`:""}
                </div>
            `}).join("");return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t)}</div>
            <div class="fixed-star-tooltip-list">${s}</div>
        `.trim()}renderPlanetSpeedChip(e){if(!e)return"";let t=this.resolveSpeedPercent(e);if(t!==null){if(!Number.isFinite(t))return"";let s="";return t<10?s=" planet-meta-chip--speed-slow":t>120&&(s=" planet-meta-chip--speed-fast"),`<span class="planet-meta-chip${s}">${Math.round(t)}%</span>`}if(e.speed!==void 0&&e.speed!==null){let s=Number(e.speed);if(!Number.isFinite(s))return"";if(s===0)return'<span class="planet-meta-chip planet-meta-chip--speed-slow">0%</span>';let o=this.formatCompactSpeed(s),n=this.formatSpeedValue(s),r=this.t("page.natalFull.units.degPerDay",{value:n});return`<span class="planet-meta-chip" title="${this.escapeHtml(r)}">${this.escapeHtml(o)}</span>`}return""}resolveSpeedPercent(e){let t=Number(e?.speed_percent);if(Number.isFinite(t))return t;let s={Proserpina:.001478},o=Number(e?.speed),n=s[e?.name];return!Number.isFinite(o)||!n?null:Math.round(Math.abs(o)/n*1e4)/100}formatSpeedValue(e){let t=Math.abs(Number(e));return!Number.isFinite(t)||t===0?"0.00":t>=1?t.toFixed(2):t>=.1?t.toFixed(3):t>=.01?t.toFixed(4):t.toFixed(5)}formatCompactSpeed(e){let t=Math.abs(Number(e));if(!Number.isFinite(t)||t===0)return"0°/д";if(t>=1)return`${t.toFixed(2)}°/д`;let s=t*60;return s>=1?`${s.toFixed(1)}′/д`:`${(s*60).toFixed(1)}″/д`}renderHouses(e){if(!e||!this.housesTable)return;let t=this.buildRetrogradeLookup(this.chartData?.planets||[]),s=this.buildPlanetHouseLookup(this.chartData?.planets||[]),o=new Set(s.keys());this.housesTable.innerHTML=e.map(n=>{let r=[1,4,7,10].includes(n.number),p=this.formatAstroCoordinate(n),$=n.included_sign||"",k=$&&Symbols.signs[$]||"",I=$?this.signName($):"",te=$?`${this.t("page.natalFull.table.houses.included")}: ${I}`:"",N=this.buildHouseRulerGroups(n,s,o);return`
                <tr id="row-house-${n.number}" class="${r?"house-angular":""}">
                    <td class="mono">${this.escapeHtml(this.formatHouseNumber(n.number))}</td>
                    <td class="mono house-sign-cell">
                        <div class="house-sign-main">${p}</div>
                        ${$?`
                            <div class="house-sign-meta" title="${this.escapeHtml(te)}">
                                <span class="house-sign-badge">${this.escapeHtml(this.t("astro.feature.short.intercepted"))}</span>
                                <span class="astro-symbol">${k}</span>
                            </div>
                        `:""}
                    </td>
                    <td class="mono house-ruler-cell">
                        ${N.length?N.map(S=>this.renderHouseRulerGroup(S,t)).join(""):"—"}
                    </td>
                </tr>
            `}).join("")}formatAstroCoordinate(e){if(window.LocaleFormatters?.formatAstroCoordinate)return window.LocaleFormatters.formatAstroCoordinate(e,{signSymbol:Symbols?.signs?.[e?.sign],signClass:"astro-symbol"});let t=Number(e?.degree_in_sign);if(!Number.isFinite(t))return"";let s=Math.floor(t),o=Math.floor((t-s)*60),n=Symbols?.signs?.[e?.sign]||e?.sign||"",r=n?`<span class="astro-symbol">${n}</span>`:"";return[`${s}°`,r,`${String(o).padStart(2,"0")}'`].filter(Boolean).join(" ")}createPlanetIconSVG(e){let t=Symbols.signElements[e.sign],s=window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e.name,t,this.visualPreferences):Symbols.elementColors[t]||"#374151";if(window.AstroGlyphs?.hasPlanetIcon?.(e.name))return`
                <span class="planet-icon-svg">
                    ${window.AstroGlyphs.createPlanetSymbolMarkup(e.name,{size:28,color:s,title:this.planetName(e.name)})}
                </span>
            `;let n=this.getPlanetSymbol(e.name)||e.name.charAt(0),p=22*(Symbols.planetGlyphScale?.[e.name]||1);return`
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${(14+p*.36).toFixed(2)}" text-anchor="middle" font-size="${p.toFixed(2)}" font-weight="600" fill="${s}" class="planet-symbol-text">${n}</text>
                </svg>
            </span>
        `}formatDegreeShort(e){let t=Math.floor(e),s=Math.floor((e-t)*60);return`${t}°${s.toString().padStart(2,"0")}'`}normalizeAspectBodyName(e){return O.ASPECT_NAME_ALIASES[e]||e}formatHouseNumber(e){return e==null||e===""?"":Symbols?.formatHouseLabel?.(e,{style:this.houseNumberStyle})||String(e)}getAspectRank(e){let t=this.normalizeAspectBodyName(e);return O.ASPECT_SORT_RANK[t]??999}normalizeAspectForDisplay(e){let t=Number.isInteger(e.left_rank)?e.left_rank:this.getAspectRank(e.planet_1),s=Number.isInteger(e.right_rank)?e.right_rank:this.getAspectRank(e.planet_2),o=e.left_planet||e.planet_1,n=e.right_planet||e.planet_2,r=t,p=s;return(!e.left_planet||!e.right_planet)&&(s<t||t===s&&String(e.planet_2)<String(e.planet_1))&&(o=e.planet_2,n=e.planet_1,r=s,p=t),{...e,left_planet:this.normalizeAspectBodyName(o),right_planet:this.normalizeAspectBodyName(n),left_rank:r,right_rank:p}}getAspectTypeRank(e){return O.ASPECT_TYPE_RANK[e]??999}buildAspectKey(e,t){let s=this.normalizeAspectBodyName(e),o=this.normalizeAspectBodyName(t),n=this.getAspectRank(s),r=this.getAspectRank(o);return n<r?`${s}-${o}`:r<n?`${o}-${s}`:s<=o?`${s}-${o}`:`${o}-${s}`}getAspectKey(e){if(!e)return null;let t=e.left_planet||e.planet_1,s=e.right_planet||e.planet_2;return!t||!s?null:this.buildAspectKey(t,s)}compareAspectsByPlanet(e,t){return e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.orb!==t.orb?e.orb-t.orb:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type)}compareAspectsByType(e,t){let s=this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type);return s!==0?s:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:e.orb-t.orb}compareAspectsByOrb(e,t){return e.is_major!==t.is_major?Number(t.is_major)-Number(e.is_major):e.orb!==t.orb?e.orb-t.orb:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank-t.right_rank}renderAspectTypeCell(e){let s=`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`,o=this.showAspectText?` ${this.aspectName(e.aspect_type)}`:"";return`${s}${o}`}renderAspectTypeIcon(e){return`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`}renderAspectPairCell(e){if(!e)return"";let t=this.escapeHtml(this.planetName(e.left_planet)),s=this.escapeHtml(this.planetName(e.right_planet)),o=this.escapeHtml(this.aspectName(e.aspect_type));return`
            <span class="aspect-chip" aria-label="${t} ${o} ${s}">
                <span class="aspect-chip__body" title="${t}">${this.getPlanetSymbolMarkup(e.left_planet,{size:15,title:this.planetName(e.left_planet)})}</span>
                <span class="aspect-chip__type" title="${o}">${this.renderAspectTypeIcon(e)}</span>
                <span class="aspect-chip__body" title="${s}">${this.getPlanetSymbolMarkup(e.right_planet,{size:15,title:this.planetName(e.right_planet)})}</span>
            </span>
        `}renderAspects(e){if(!this.aspectsTable)return;if(!e||e.length===0){this.aspectsTable.innerHTML="";return}let t=e;this.aspectTypeFilter==="major"?t=t.filter(n=>n.is_major):this.aspectTypeFilter==="minor"&&(t=t.filter(n=>!n.is_major)),this.aspectPlanetFilter&&(t=t.filter(n=>{let r=this.normalizeAspectBodyName(n.planet_1),p=this.normalizeAspectBodyName(n.planet_2);return r===this.aspectPlanetFilter||p===this.aspectPlanetFilter}));let o=[...t.map(n=>this.normalizeAspectForDisplay(n))].sort((n,r)=>{let p=0;switch(this.aspectSortState.field){case"type":p=this.compareAspectsByType(n,r);break;case"orb":p=this.compareAspectsByOrb(n,r);break;case"planet":default:p=this.compareAspectsByPlanet(n,r);break}return this.aspectSortState.ascending?p:-p});if(o.length===0){this.aspectsTable.innerHTML='<tr><td colspan="3" class="text-muted">—</td></tr>';return}this.aspectsTable.innerHTML=o.map(n=>{let r=this.getAspectKey(n),p=this.showApplyingSeparating?this.getApplyingSeparatingShortLabel(n):"";return`
                <tr data-aspect="${r||""}" data-aspect-key="${r||""}" data-aspect-type="${this.escapeHtml(n.aspect_type||"")}">
                    <td>${this.renderAspectPairCell(n)}</td>
                    <td class="aspect-phase-cell">${p?this.escapeHtml(p):"—"}</td>
                    <td class="mono">${n.orb.toFixed(2)}°</td>
                </tr>
            `}).join("")}renderGridHeaderBody(e){let t=this.getPlanetSymbolMarkup(e.name,{size:15,title:this.planetName(e.name)}),s=this.retroIndicatorHtml(e.retrograde,"retro-indicator--micro");return`<span class="aspect-grid-body">${t}${s}</span>`}renderAspectGrid(e,t){if(!this.aspectGridContainer||!e||!t)return;let s=this.getAspectRank("PartOfFortune"),o=new Map;t.forEach($=>{let k=this.normalizeAspectBodyName($.name);this.getAspectRank(k)>s||o.has(k)||o.set(k,{...$,name:k})});let n=[...o.values()].sort(($,k)=>this.getAspectRank($.name)-this.getAspectRank(k.name)),r={};e.forEach($=>{let k=this.getAspectKey($);k&&(r[k]=$)});let p='<table class="aspect-grid">';p+="<tr><th></th>",n.forEach($=>{p+=`<th title="${this.planetName($.name)}">${this.renderGridHeaderBody($)}</th>`}),p+="</tr>",n.forEach(($,k)=>{p+=`<tr><th title="${this.planetName($.name)}">${this.renderGridHeaderBody($)}</th>`,n.forEach((I,te)=>{if(te>=k)p+="<td></td>";else{let N=this.buildAspectKey($.name,I.name),S=r[N];if(S){let V=this.getAspectSymbol(S.aspect_type),K=S.harmonic_type==="harmonious"?"grid-harmonious":S.harmonic_type==="tense"?"grid-tense":"grid-neutral";p+=`<td class="${K}" data-aspect-key="${N}" data-aspect-type="${this.escapeHtml(S.aspect_type||"")}" title="${this.aspectName(S.aspect_type)} ${S.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(S.aspect_type,this.visualPreferences,S.harmonic_type):"#9ca3af"}">${V}</span></td>`}else p+="<td>–</td>"}}),p+="</tr>"}),p+="</table>",this.aspectGridContainer.innerHTML=p}clearHoveredAspect(){this.hoveredAspectKey=null,this.aspectsTable&&this.aspectsTable.querySelectorAll("tr.aspect-hover-row").forEach(e=>{e.classList.remove("aspect-hover-row")}),this.aspectGridContainer&&this.aspectGridContainer.querySelectorAll("td.grid-hover").forEach(e=>{e.classList.remove("grid-hover")})}setHoveredAspect(e,t={}){let s=t.surface==="grid"?"grid":"table";if(this.clearHoveredAspect(),!!e){if(this.hoveredAspectKey=e,s==="table"&&this.aspectsTable){let o=this.aspectsTable.querySelector(`tr[data-aspect-key="${e}"]`);o&&o.classList.add("aspect-hover-row");return}if(s==="grid"&&this.aspectGridContainer){let o=this.aspectGridContainer.querySelector(`td[data-aspect-key="${e}"]`);o&&o.classList.add("grid-hover")}}}renderDignities(e){if(!this.dignitiesContainer||!e)return;let t={domicile:{label:this.t("astro.dignity.domicile"),class:"dignity-domicile",icon:"🏠"},exaltation:{label:this.t("astro.dignity.exaltation"),class:"dignity-exaltation",icon:"⬆"},detriment:{label:this.t("astro.dignity.detriment"),class:"dignity-detriment",icon:"⬇"},fall:{label:this.t("astro.dignity.fall"),class:"dignity-fall",icon:"💫"},neutral:{label:"",class:"",icon:""}},s=e.filter(n=>n.dignity&&n.dignity!=="neutral");if(s.length===0){this.dignitiesContainer.innerHTML=`<p class="text-muted">${this.t("page.chart.empty.noDignities")}</p>`;return}let o='<div class="dignities-list">';s.forEach(n=>{let r=t[n.dignity]||t.neutral;o+=`
                <div class="dignity-item ${r.class}">
                    <span class="dignity-planet">${this.getPlanetSymbolMarkup(n.name,{size:16,title:this.planetName(n.name)})} ${this.planetName(n.name)}</span>
                    <span class="dignity-label">${r.icon} ${r.label}</span>
                </div>
            `}),o+="</div>",this.dignitiesContainer.innerHTML=o}renderConfigurations(e,t){if(!this.configsContainer)return;let s="";if(e&&e.length>0){let o=[...e].sort((n,r)=>{let p=n.strength_score||0;return(r.strength_score||0)-p});s+=`<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t("page.chart.configurations.title")}</h3>`,s+=o.map(n=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((n.planets_involved||[]).join("|"))}"
                    data-config-aspect-keys="${this.escapeHtml((n.aspects||[]).map(r=>this.getAspectKey(r)).filter(Boolean).join("|"))}"
                    title="${this.escapeHtml(this.formatConfigType(n.type))}"
                >
                    <div class="config-card-head">
                        <h4>${this.escapeHtml(this.formatConfigType(n.type))}</h4>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${n.apex_planet?`
                            <span
                                class="config-apex-chip"
                                title="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(n.apex_planet)}))}"
                                aria-label="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(n.apex_planet)}))}"
                            >
                                <span class="planet-tag planet-tag--icon-only planet-tag--config-point">
                                    ${this.getPlanetSymbolMarkup(n.apex_planet,{size:16,title:this.planetName(n.apex_planet)})}
                                </span>
                            </span>
                        `:""}
                        ${n.planets_involved.filter(r=>r!==n.apex_planet).map(r=>{let p=this.buildConfigurationPointTooltip(r,n.aspects||[]),$=this.escapeHtml(this.planetName(r)),k=p?` data-config-point-tooltip="${this.escapeHtml(p)}" data-config-point-name="${$}"`:"";return`
                            <span class="planet-tag planet-tag--icon-only planet-tag--config-point"${p?"":` title="${$}"`} aria-label="${$}"${k}>
                                ${this.getPlanetSymbolMarkup(r,{size:16,title:this.planetName(r)})}
                            </span>
                        `}).join("")}
                    </div>
                </div>
            `).join("")}if(t&&t.length>0){let o=[...t].sort((n,r)=>(r.count||0)-(n.count||0));s+=`<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t("page.chart.configurations.stelliums")}</h3>`,s+=o.map(n=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((n.planets||[]).join("|"))}"
                    data-config-aspect-keys=""
                    data-compact-value="${Number(n.count||0)}"
                    title="${this.escapeHtml(n.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(n.house_number)}):this.signName(n.sign))}"
                >
                    <div class="config-card-head">
                        <h4>
                            ${n.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(n.house_number)}):`<span class="astro-symbol config-stellium-sign" aria-hidden="true">${Symbols.signs[n.sign]||""}</span> ${this.signName(n.sign)}`}
                        </h4>
                        <span class="config-strength-badge" data-compact-value="${Number(n.count||0)}">${this.t("page.chart.configurations.countShort",{count:n.count})}</span>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${n.planets.map(r=>`
                            <span class="planet-tag planet-tag--icon-only" title="${this.escapeHtml(this.planetName(r))}" aria-label="${this.escapeHtml(this.planetName(r))}">
                                ${this.getPlanetSymbolMarkup(r,{size:16,title:this.planetName(r)})}
                            </span>
                        `).join("")}
                    </div>
                </div>
            `).join("")}s||(s=`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.configsContainer.innerHTML=s}buildConfigurationPointTooltip(e,t){if(!e||!Array.isArray(t)||!t.length)return"";let s=this.normalizeAspectBodyName(e),o=t.filter(n=>{let r=this.normalizeAspectBodyName(n?.planet_1),p=this.normalizeAspectBodyName(n?.planet_2);return r===s||p===s});return o.length?`
            <div class="config-point-tooltip-title">${this.escapeHtml(this.planetName(e))}</div>
            <div class="config-aspect-lines">
                ${o.map(n=>{let r=`${this.planetName(n.planet_1)} ${this.aspectName(n.aspect_type)} ${this.planetName(n.planet_2)}`,p=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(n.aspect_type,this.visualPreferences,n.harmonic_type):"#6b7280";return`
                    <div class="config-aspect-line" title="${this.escapeHtml(r)}">
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(n.planet_1,{size:14,title:this.planetName(n.planet_1)})}</span>
                        <span class="config-aspect-badge" style="--config-aspect-color:${this.escapeHtml(p)}" aria-label="${this.escapeHtml(this.aspectName(n.aspect_type))}">
                            <span class="astro-symbol config-aspect-glyph">${this.getAspectSymbol(n.aspect_type)}</span>
                        </span>
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(n.planet_2,{size:14,title:this.planetName(n.planet_2)})}</span>
                        <span class="config-aspect-orb">${Number(n.orb).toFixed(1)}°</span>
                    </div>
                `}).join("")}
            </div>
        `.trim():""}formatConfigType(e){let t=`astro.configuration.${e}`,s=this.t(t);return s===t?e.replace(/_/g," "):s}renderBalances(e,t){if(!this.balancesContainer)return;let s="";if(!e){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}let o=[{key:"by_sign",label:this.t("page.chart.balances.tabs.sign"),data:e.by_sign},{key:"by_house",label:this.t("page.chart.balances.tabs.house"),data:e.by_house}].filter(n=>this.hasBalanceData(n.data));if(!o.length){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}if(o.length===1){s+=this.renderBalanceSet(o[0].key,o[0].data),this.balancesContainer.innerHTML=s;return}s+=`
            <div class="balance-subtabs" role="tablist" aria-label="${this.t("page.chart.balances.tabs.title")}">
                ${o.map((n,r)=>`
                    <button
                        type="button"
                        class="balance-subtab-btn${r===0?" active":""}"
                        data-balance-tab="${n.key}"
                        aria-selected="${r===0?"true":"false"}"
                    >
                        ${n.label}
                    </button>
                `).join("")}
            </div>
            ${o.map((n,r)=>`
                <div class="balance-subtab-panel${r===0?" active":""}" data-balance-panel="${n.key}">
                    ${this.renderBalanceSet(n.key,n.data)}
                </div>
            `).join("")}
        `,this.balancesContainer.innerHTML=s,this.initBalanceTabs()}hasBalanceData(e){return!!(e&&Object.values(e).some(t=>t&&Object.keys(t).length))}initBalanceTabs(){let e=this.balancesContainer.querySelectorAll("[data-balance-tab]"),t=this.balancesContainer.querySelectorAll("[data-balance-panel]");!e.length||!t.length||e.forEach(s=>{s.addEventListener("click",()=>{let o=s.dataset.balanceTab;e.forEach(n=>{let r=n.dataset.balanceTab===o;n.classList.toggle("active",r),n.setAttribute("aria-selected",r?"true":"false")}),t.forEach(n=>{n.classList.toggle("active",n.dataset.balancePanel===o)})})})}renderBalanceSet(e,t){let s="",o="#9ca3af",n=r=>window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(r,this.visualPreferences):{Fire:"#ef4444",Earth:"#84cc16",Air:"#f59e0b",Water:"#3b82f6"}[r]||o;if(t.element_balance){let r=t.element_balance,p=r.fire+r.earth+r.air+r.water;s+=this.renderBalanceSection(this.t("page.chart.balances.elementsTitle"),[{label:this.t("astro.element.Fire"),value:r.fire,total:p,color:n("Fire")},{label:this.t("astro.element.Earth"),value:r.earth,total:p,color:n("Earth")},{label:this.t("astro.element.Air"),value:r.air,total:p,color:n("Air")},{label:this.t("astro.element.Water"),value:r.water,total:p,color:n("Water")}])}if(e==="by_sign"&&t.mode_balance){let r=t.mode_balance,p=r.cardinal+r.fixed+r.mutable;s+=this.renderBalanceSection(this.t("page.chart.balances.modesTitle"),[{label:this.t("astro.mode.short.Cardinal"),value:r.cardinal,total:p,color:o},{label:this.t("astro.mode.short.Fixed"),value:r.fixed,total:p,color:o},{label:this.t("astro.mode.short.Mutable"),value:r.mutable,total:p,color:o}])}if(e==="by_house"&&t.house_group_balance){let r=t.house_group_balance,p=r.angular+r.succedent+r.cadent;s+=this.renderBalanceSection(this.t("page.chart.balances.houseGroupsTitle"),[{label:this.t("page.chart.balances.angular"),value:r.angular,total:p,color:o},{label:this.t("page.chart.balances.succedent"),value:r.succedent,total:p,color:o},{label:this.t("page.chart.balances.cadent"),value:r.cadent,total:p,color:o}])}if(t.gender_balance){let r=t.gender_balance,p=r.masculine+r.feminine;s+=this.renderBalanceSection(this.t("page.chart.balances.polarityTitle"),[{label:this.t("astro.polarity.Masculine"),value:r.masculine,total:p,color:o},{label:this.t("astro.polarity.Feminine"),value:r.feminine,total:p,color:o}])}if(t.zones_balance){let r=t.zones_balance,p=r.brahma+r.vishnu+r.shiva;s+=this.renderBalanceSection(this.t("page.chart.balances.zonesTitle"),[{label:this.t("page.chart.balances.brahma"),value:r.brahma,total:p,color:o},{label:this.t("page.chart.balances.vishnu"),value:r.vishnu,total:p,color:o},{label:this.t("page.chart.balances.shiva"),value:r.shiva,total:p,color:o}])}if(t.quadrant_balance){let r=t.quadrant_balance,p=r.q1+r.q2+r.q3+r.q4;s+=this.renderBalanceSection(this.t("page.chart.balances.quadrantsTitle"),[{label:this.t("page.chart.balances.quadrant1"),value:r.q1,total:p,color:o},{label:this.t("page.chart.balances.quadrant2"),value:r.q2,total:p,color:o},{label:this.t("page.chart.balances.quadrant3"),value:r.q3,total:p,color:o},{label:this.t("page.chart.balances.quadrant4"),value:r.q4,total:p,color:o}])}if(t.hemisphere_balance){let r=t.hemisphere_balance,p=r.lower+r.upper,$=r.eastern+r.western;s+=this.renderBalanceSection(this.t("page.chart.balances.hemispheresTitle"),[{label:this.t("page.chart.balances.lower"),value:r.lower,total:p,color:o},{label:this.t("page.chart.balances.upper"),value:r.upper,total:p,color:o},{label:this.t("page.chart.balances.east"),value:r.eastern,total:$,color:o},{label:this.t("page.chart.balances.west"),value:r.western,total:$,color:o}])}return s}renderBalanceSection(e,t){return`
            <div class="balance-section">
                <div class="balance-title">${e}</div>
                ${t.map(s=>{let o=s.total>0?s.value/s.total*100:0,n=s.color?`background: ${s.color};`:"",r=s.color?`color: ${s.color};`:"";return`
                        <div class="balance-row">
                            <span class="balance-label" style="${r}">${s.label}</span>
                            <div class="balance-bar-container">
                                <div class="balance-bar" style="${n} width: ${o}%"></div>
                            </div>
                            <span class="balance-value" style="${r}">${s.value}</span>
                        </div>
                    `}).join("")}
            </div>
        `}formatPatternType(e){let t=`astro.pattern.${e}`,s=this.t(t);return s!==t?s:e}};Z(O,"ASPECT_SORT_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","MC","IC","DSC","Vertex","AntiVertex"]),Z(O,"ASPECT_NAME_ALIASES",{TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"}),Z(O,"ASPECT_SORT_RANK",O.ASPECT_SORT_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),Z(O,"ASPECT_TYPE_ORDER",["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"]),Z(O,"ASPECT_TYPE_RANK",O.ASPECT_TYPE_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),Z(O,"PLANET_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune"]);var fe=O;window.ChartDataRenderer=fe;(function(){"use strict";let e=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],t=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],s=t.slice(0,10),o="dispositorChainDisplayOptions",n=2,r={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!0},p={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},$={Aries:"Sun",Taurus:"Moon",Gemini:null,Cancer:"Jupiter",Leo:null,Virgo:"Mercury",Libra:"Saturn",Scorpio:null,Sagittarius:null,Capricorn:"Mars",Aquarius:null,Pisces:"Venus"},k=Object.fromEntries(e.map((a,l)=>[a,e[(l+6)%12]])),I={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},te={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function N(a,l){return window.FrontendI18n?.t?.(a,l)||a}function S(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function V(a){return te[a]||a}function K(a){if(!a)return"—";let l=`astro.planet.${a}`,i=N(l);return i!==l?i:window.Symbols?.getPlanetNameRu?.(a)||window.Symbols?.planetNamesRu?.[a]||a}function Ee(a){if(!a)return"—";let l=`astro.sign.${a}`,i=N(l);return i!==l?i:window.Symbols?.signNamesRu?.[a]||a}function ne(a,l=16){return window.Symbols?.getPlanetSymbolMarkup?.(a,{size:l,title:K(a)})||`<span class="astro-symbol">${S(window.Symbols?.getPlanetSymbol?.(a)||"")}</span>`}function be(a){return[window.Symbols?.signs?.[a]||"",Ee(a)].filter(Boolean).join(" ")}function le(){let a={},l=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return e.forEach(i=>{let c=I[i]||{},u=l?.[i]||{},b=V(u.ruler||c.ruler||null),P=V(u.co_ruler||c.co_ruler||null),_=V(u.exaltation||c.exaltation||null);b&&P&&b===P&&(P=null),a[i]={ruler:b,co_ruler:P,exaltation:_}}),a}function re(a,l,i=le()){let c=i?.[a]||{},u=i?.[k[a]]||{};return l==="exaltation"?c.exaltation||null:l==="detriment"?u.ruler||null:l==="fall"?u.exaltation||null:c.ruler||null}function ye(a,l,i,c=r){return a?c.classicalRulers&&l==="domicile"?p[a]||re(a,l,i):c.classicalRulers&&l==="detriment"?p[k[a]]||re(a,l,i):c.classicalRulers&&l==="exaltation"?$[a]||null:c.classicalRulers&&l==="fall"?$[k[a]]||null:re(a,l,i):null}function $e(a){return(Array.isArray(a?.planets)?a.planets:[]).filter(i=>i?.name&&i?.sign&&t.includes(V(i.name))).map(i=>({...i,name:V(i.name)})).sort((i,c)=>t.indexOf(i.name)-t.indexOf(c.name))}function Se(a,l){let i=le(),c=$e(a),u=new Map(c.map(A=>[A.name,A])),b=[],P=new Map;c.forEach(A=>{let w=[],M=new Map,h=A,y=null,B=[];for(;h?.name&&!M.has(h.name);){M.set(h.name,w.length);let f=re(h.sign,l,i);if(w.push({planet:h.name,sign:h.sign,ruler:f,retrograde:!!h.retrograde}),!f){y="none";break}if(!u.has(f)){y=f;break}if(f===h.name){y=f;break}h=u.get(f)}if(!y&&h?.name&&M.has(h.name)){let f=M.get(h.name);B=w.slice(f).map(T=>T.planet),y=B.join("+")}P.set(y,(P.get(y)||0)+1),b.push({start:A.name,steps:w,finalKey:y,cycle:B})});let _=[...P.entries()].filter(([A])=>A&&A!=="none").sort((A,w)=>w[1]-A[1]||A[0].localeCompare(w[0])).slice(0,4);return{chains:b,mainRulers:_}}function ce(a){if(!a)return`<p class="dispositor-empty">${S(N("page.chart.rulers.empty.noJones"))}</p>`;let l=(()=>{let c=`astro.pattern.${a.pattern_type}`,u=N(c);return u===c?a.pattern_type||"—":u})(),i=[];return Number.isFinite(Number(a.empty_arc_degree))&&i.push(N("page.chart.balances.emptyArc",{value:Number(a.empty_arc_degree).toFixed(0)})),a.handle_planet&&i.push(N("page.chart.balances.handle",{planet:K(a.handle_planet)})),a.leading_planet&&i.push(N("page.chart.balances.leading",{planet:K(a.leading_planet)})),`
            <article class="dispositor-jones-card" title="${S([N("page.chart.rulers.jonesKicker"),l,...i].join(" · "))}">
                <h4>${S(l)}</h4>
                ${i.length?`<p>${S(i.join(" · "))}</p>`:""}
            </article>
        `}function Be(a){return a.length?`
            <div class="dispositor-main-rulers">
                ${a.map(([l,i])=>{let c=l.split("+").filter(Boolean),u=c.map(K).join(" + ");return`
                        <span class="dispositor-main-chip" title="${S(u)}">
                            ${c.map(b=>ne(b,15)).join("")}
                            <b>${i}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${S(N("page.chart.rulers.empty.noMainRulers"))}</p>`}function pe(a,l="",i=""){let c=[K(a.planet),a.sign?be(a.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${l}" style="${S(i)}" title="${S(c)}" aria-label="${S(c)}">
                ${ne(a.planet,15)}
            </span>
        `}function st(a){let l=[...a.steps].reverse().map((c,u)=>{let b=u===0&&a.finalKey!=="none";return pe(c,b?"dispositor-chain-node--main":"")}),i=a.steps[a.steps.length-1];return i?.ruler&&!a.steps.some(c=>c.planet===i.ruler)&&l.unshift(pe({planet:i.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${l.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function X(a){return[...new Set(a)].sort((l,i)=>{let c=t.indexOf(l),u=t.indexOf(i);return(c===-1?999:c)-(u===-1?999:u)})}function Le(a){return X(a).join("+")}function Re(a){let l=a?.number??a?.house_number,i=Number(l);return Number.isInteger(i)?i:l}function je(a){let l=[...new Set(a)].map(i=>Number(i)).filter(i=>Number.isInteger(i)).sort((i,c)=>i-c);return l.length?window.Symbols?.formatHouseList?.(l,{style:"roman",separator:","})||l.map(i=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][i-1]||String(i)).join(","):""}function Fe(a,l,i,c=r){return l==="domicile"&&a?.ruler_planet&&!c.classicalRulers?V(a.ruler_planet):V(ye(a?.sign,l,i,c))}function _e(a,l,i=r){let c=le(),u=$e(a),b=new Map(u.map(h=>[h.name,h])),P=Array.isArray(a?.houses)?a.houses:[],_=new Map,A=[];return P.forEach(h=>{let y=Fe(h,"domicile",c,i),B=Re(h);!y||!B||(_.has(y)||_.set(y,[]),_.get(y).push(B),A.push(y))}),u.forEach(h=>{s.includes(h.name)&&A.push(h.name)}),{chains:X(A).map(h=>{let y=[],B=new Map,f=b.get(h)||{name:h,sign:null,retrograde:!1},T=null,z=[];for(;f?.name&&!B.has(f.name);){B.set(f.name,y.length);let j=f.sign?ye(f.sign,l,c,i):null;if(y.push({planet:f.name,sign:f.sign,ruler:j,retrograde:!!f.retrograde}),!j){T=f.name;break}if(!b.has(j)){T=j;break}if(j===f.name){T=j;break}f=b.get(j)}if(!T&&f?.name&&B.has(f.name)){let j=B.get(f.name);z=y.slice(j).map(U=>U.planet),T=Le(z)}return{start:h,steps:y,finalKey:T,cycle:z}}).filter(h=>!(h.steps.length===1&&!h.steps[0]?.ruler)),housesByRuler:_}}function Ae(a,l,i,c=""){let u=i.showHouseRulers?je(l.get(a.planet)||[]):"",b=[K(a.planet),a.sign?be(a.sign):"",u?`${N("common.house")} ${u}`:"",a.terminal?N("page.chart.rulers.chainEnd"):""].filter(Boolean).join(" · "),P=Number.isFinite(a.x)&&Number.isFinite(a.y)?` style="left:${a.x}px; top:${a.y}px;"`:"",_=a.terminal?" dispositor-compact-node--terminal":"";return`
            <span
                class="dispositor-compact-node ${c}${_}"
                ${P}
                title="${S(b)}"
                aria-label="${S(b)}"
            >
                <span class="dispositor-compact-symbol">${ne(a.planet,32)}</span>
                ${u?`<span class="dispositor-house-label">${S(u)}</span>`:""}
            </span>
        `}function we(a,l,i,c,u=""){let b=l.get(a)||{planet:a,sign:null};return Ae(b,i,c,`dispositor-compact-node--static ${u}`.trim())}function ve(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function xe(a,l){let i=a&&a!=="none"?a.split("+").filter(Boolean):[];if(i.length<=2)return[];let c=new Set(i),u=(P=[])=>P.length===i.length&&P.every(_=>c.has(_)),b=l.find(P=>u(P.cycle||[]))?.cycle;return b?[...b]:[]}function Ie(a){let l=new Map;return a.forEach(i=>{i.steps.forEach(c=>{if(!c?.planet)return;let u=l.get(c.planet)||{planet:c.planet,sign:null};l.set(c.planet,{...u,sign:u.sign||c.sign||null,retrograde:u.retrograde||!!c.retrograde,terminal:!!(u.terminal||!c.ruler)})})}),l}function ze(a,l,i,c){let u=xe(a,l),b=new Set(u),P=Ie(l),_=[...u,u[0]].filter(Boolean),A=[],w=new Set(u);return[...l].sort((h,y)=>y.steps.length-h.steps.length||String(h.start).localeCompare(String(y.start))).forEach(h=>{let y=[],B=null;for(let T of h.steps)if(y.push(T.planet),w.has(T.planet)){B=T.planet;break}let f=y.filter(T=>!w.has(T));f.length&&(f.forEach(T=>w.add(T)),A.push({planets:y,anchor:B}))}),`
            <section class="dispositor-compact-group" aria-label="${S(N("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${_.map((h,y)=>`
                            ${y>0?ve():""}
                            ${we(h,P,i,c,`dispositor-compact-node--main${y===_.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${A.length?`
                        <div class="dispositor-cycle-branches">
                            ${A.map(h=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${h.planets.map((y,B)=>`
                                        ${B>0?ve():""}
                                        ${we(y,P,i,c,[b.has(y)?"dispositor-compact-node--main":"",y===h.anchor&&B===h.planets.length-1?"dispositor-compact-node--repeat":""].filter(Boolean).join(" "))}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function Oe(a,l,i){let c=[],u=new Set;if(a.forEach(_=>{let A=_.steps.map(w=>w.planet).join(">");u.has(A)||(u.add(A),c.push(_))}),!c.length)return`<p class="dispositor-empty">${S(N("page.chart.rulers.empty.noChains"))}</p>`;let b=new Map;return c.forEach(_=>{let A=_.finalKey||"none";b.has(A)||b.set(A,[]),b.get(A).push(_)}),`
            <div class="dispositor-compact-diagram">
                ${[...b.entries()].sort((_,A)=>{let w=new Set(_[1].flatMap(h=>h.steps.map(y=>y.planet))).size,M=new Set(A[1].flatMap(h=>h.steps.map(y=>y.planet))).size;return w-M||String(_[0]).localeCompare(String(A[0]))}).map(([_,A],w)=>{if(xe(_,A).length>2)return ze(_,A,l,i);let h=Pe(_,A),y=`url(#dispositorCompactArrow${w})`,B=` marker-end="${y}"`,f=` marker-start="${y}" marker-end="${y}"`;return`
                        <section class="dispositor-compact-group" aria-label="${S(N("page.chart.rulers.modalTitle"))} ${w+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${h.width}px; --graph-height:${h.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${h.width} ${h.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${w}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${h.edges.map(T=>`
                                        <path d="${S(T.path)}"${B}></path>
                                    `).join("")}
                                    ${h.mutualEdges.map(T=>`
                                        <path class="dispositor-compact-mutual" d="${S(T.path)}"${f}></path>
                                    `).join("")}
                                </svg>
                                ${h.nodes.map(T=>Ae(T,l,i,T.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function Pe(a,l){let A=a&&a!=="none"?a.split("+").filter(Boolean):[],w=new Map,M=[],h=new Set,y=(d,g={})=>{if(!d)return null;let v=w.get(d)||{planet:d,sign:null,retrograde:!1},x=Object.prototype.hasOwnProperty.call(g,"ruler")&&!g.ruler;return w.set(d,{...v,sign:v.sign||g.sign||null,retrograde:v.retrograde||!!g.retrograde,terminal:!!(v.terminal||x)}),w.get(d)},B=(d,g)=>{let v=d?.planet,x=g?.planet;if(!v||!x||v===x)return;y(v,d),y(x,g);let H=`${v}->${x}`;h.has(H)||(h.add(H),M.push({child:v,parent:x}))};l.forEach(d=>{d.steps.forEach(g=>y(g.planet,g));for(let g=0;g<d.steps.length;g+=1){let v=d.steps[g],x=d.steps[g+1];x?B(v,x):v?.ruler&&!d.steps.some(H=>H.planet===v.ruler)&&B(v,{planet:v.ruler})}});let f=A.length?X(A):X([...w.keys()].filter(d=>!M.some(g=>g.child===d)));!f.length&&w.size&&f.push([...w.keys()][0]);let T=new Set(f),z=new Map,j=[],U=[];M.forEach(d=>{if(T.has(d.child)&&T.has(d.parent)){let g=X([d.child,d.parent]).join("<->");j.some(v=>v.key===g)||j.push({...d,key:g});return}U.push(d),z.has(d.parent)||z.set(d.parent,[]),z.get(d.parent).push(d.child)}),z.forEach((d,g)=>{z.set(g,X(d))});let J=!1,ee=(()=>{if(f.length<=2)return f;let d=(R=[])=>R.length===f.length&&R.every(F=>T.has(F)),g=l.find(R=>d(R.cycle||[]))?.cycle;if(g)return J=!0,[...g];let v=new Map(j.map(R=>[R.child,R.parent]));J=j.length>=f.length-1;let x=[],H=f[0];for(;H&&T.has(H)&&!x.includes(H);)x.push(H),H=v.get(H);return f.forEach(R=>{x.includes(R)||x.push(R)}),x})(),G=new Map,se=(d,g,v)=>{let x=8,H=(F,q=0,Y=new Set)=>{if(G.has(F))return G.get(F);if(Y.has(F)){let Q={x:v+g*q*60,y:x};return x+=58,G.set(F,Q),Q}Y.add(F);let He=(z.get(F)||[]).filter(Q=>!T.has(Q)),ge;if(!He.length)ge=x,x+=58;else{let Q=He.map(ae=>H(ae,q+1,new Set(Y)));ge=(Math.min(...Q.map(ae=>ae.y))+Math.max(...Q.map(ae=>ae.y)))/2}Y.delete(F);let Me={x:v+g*q*60,y:ge};return G.set(F,Me),Me};return{rootPosition:H(d,0),height:x}},ie=d=>{let g=[],v=[d],x=new Set;for(;v.length;){let H=v.pop();!H||x.has(H)||(x.add(H),g.push(H),(z.get(H)||[]).forEach(R=>{T.has(R)||v.push(R)}))}return g},m=(d,g)=>{ie(d).forEach(v=>{let x=G.get(v);x&&(x.y+=g)})};if(f.length===2){let d=f[0],g=f[1],v=se(d,-1,0),x=se(g,1,72),H=Math.max(v.rootPosition.y,x.rootPosition.y);m(d,H-v.rootPosition.y),m(g,H-x.rootPosition.y)}else{let d=8;ee.forEach((g,v)=>{se(g,-1,0);let H=ie(g).map(Y=>G.get(Y)).filter(Boolean);if(!H.length)return;let R=Math.min(...H.map(Y=>Y.y)),F=Math.max(...H.map(Y=>Y.y)),q=d-R;q&&m(g,q),d=F+q+(v===f.length-1?0:58)})}w.forEach((d,g)=>{G.has(g)||G.set(g,{x:0,y:8+G.size*58})});let E=Math.min(...[...G.values()].map(d=>d.x)),C=Math.min(...[...G.values()].map(d=>d.y));G.forEach(d=>{d.x=d.x-E+8,d.y=d.y-C+8});let L=[...w.values()].map(d=>({...d,isRoot:T.has(d.planet),...G.get(d.planet)||{x:8,y:8}})),D=new Map(L.map(d=>[d.planet,d])),W=d=>{let g=D.get(d.child),v=D.get(d.parent);if(!g||!v)return null;let x=1,H=g.x<v.x,R=H?g.x+42+x:g.x-x,F=H?v.x-x:v.x+42+x,q=g.y+21,Y=v.y+21;return{...d,path:`M${R},${q} L${F},${Y}`}},he=d=>{let g=D.get(d.child),v=D.get(d.parent);if(!g||!v)return null;let x=Math.max(g.x,v.x)+42+8,H=x,R=g.y+21,F=v.y+21;if(F>=R)return{...d,path:`M${x},${R} L${H},${F}`};let q=x+14;return{...d,path:`M${x},${R} L${q},${R} L${q},${F} L${H},${F}`}},me=f.length>2&&J?ee.map((d,g)=>({child:d,parent:ee[(g+1)%ee.length]})).filter(d=>d.child&&d.parent&&d.child!==d.parent):[],We=[...U.map(W).filter(Boolean),...me.map(he).filter(Boolean)],Qe=f.length>2&&J?[]:j.map(W).filter(Boolean),Ze=Math.max(220,Math.ceil(Math.max(...L.map(d=>d.x+42))+8)),et=Math.max(70,Math.ceil(Math.max(...L.map(d=>d.y+58))+8));return{width:Ze,height:et,nodes:L,edges:We,mutualEdges:Qe}}function Ge(a){let l=[],i=new Set;a.forEach(u=>{let b=u.steps.map(P=>P.planet).join(">");i.has(b)||(i.add(b),l.push(u))});let c=new Map;return l.forEach(u=>{let b=u.finalKey||"none";c.has(b)||c.set(b,[]),c.get(b).push(u)}),l.length?`
            <div class="dispositor-diagram">
                ${[...c.entries()].map(([u,b])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Ye(u,b.length)}
                        </div>
                        ${De(u,b)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${S(N("page.chart.rulers.empty.noChains"))}</p>`}function De(a,l){let i=qe(a,l);return i.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${i.edges.map(c=>`
                        <path d="${S(c.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${i.nodes.map(c=>pe(c,c.isRoot?"dispositor-chain-node--main":"",`left:${c.x}px; top:${c.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${S(N("page.chart.rulers.empty.noChains"))}</p>`}function qe(a,l){let P=new Set(a&&a!=="none"?a.split("+").filter(Boolean):[]),_=new Map,A=[],w=new Set,M=new Map,h=new Map,y=(m,E={})=>{if(!m)return null;let C=_.get(m)||{planet:m,sign:null,retrograde:!1};return _.set(m,{...C,sign:C.sign||E.sign||null,retrograde:C.retrograde||!!E.retrograde}),_.get(m)},B=(m,E)=>{let C=m?.planet,L=E?.planet;if(!C||!L||C===L||P.has(C)&&P.has(L))return;y(C,m),y(L,E);let D=`${C}->${L}`;w.has(D)||(w.add(D),A.push({child:C,parent:L}),h.set(C,L),M.has(L)||M.set(L,[]),M.get(L).push(C))};l.forEach(m=>{m.steps.forEach(C=>y(C.planet,C));for(let C=0;C<m.steps.length-1;C+=1)B(m.steps[C],m.steps[C+1]);let E=m.steps[m.steps.length-1];E?.ruler&&!m.steps.some(C=>C.planet===E.ruler)&&B(E,{planet:E.ruler})}),P.size||[..._.keys()].forEach(m=>{h.has(m)||P.add(m)}),!P.size&&_.size&&P.add([..._.keys()][0]),M.forEach((m,E)=>{M.set(E,X(m))});let f=new Map,T=(m,E=0)=>{f.has(m)&&f.get(m)<=E||(f.set(m,E),(M.get(m)||[]).forEach(C=>T(C,E+1)))};X([...P]).forEach(m=>T(m,0)),_.forEach((m,E)=>{f.has(E)||f.set(E,0)});let z=24,j=new Map,U=(m,E=new Set)=>{if(j.has(m))return j.get(m);if(E.has(m)){let D=z;return z+=76,j.set(m,D),D}E.add(m);let C=M.get(m)||[],L;if(!C.length)L=z,z+=76;else{let D=C.map(W=>U(W,new Set(E)));L=(Math.min(...D)+Math.max(...D))/2}return E.delete(m),j.set(m,L),L};X([...P]).forEach(m=>U(m)),_.forEach((m,E)=>U(E));let J=[..._.values()].map(m=>({...m,isRoot:P.has(m.planet),x:24+(f.get(m.planet)||0)*128,y:j.get(m.planet)||24})),ue=new Map(J.map(m=>[m.planet,m])),ee=Math.max(0,...J.map(m=>f.get(m.planet)||0)),G=Math.max(180,z+24),se=Math.max(520,48+ee*128+44),ie=A.map(m=>{let E=ue.get(m.child),C=ue.get(m.parent);if(!E||!C)return null;let L=E.x,D=E.y+44/2,W=C.x+44,he=C.y+44/2,me=Math.max(W+18,L-42);return{...m,path:`M${L},${D} H${me} V${he} H${W}`}}).filter(Boolean);return{width:se,height:G,nodes:J,edges:ie}}function Ye(a,l){if(!a||a==="none")return`
                <span class="dispositor-diagram-group-title">${S(N("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${l}</span>
            `;let i=a.split("+").filter(Boolean),c=i.map(K).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${S(c)}">
                ${i.map(u=>ne(u,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${l}</span>
        `}function Ve(a){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${S(N("page.chart.rulers.modeLabel"))}">
                ${l.map(i=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${i===a?" active":""}"
                        data-dispositor-mode="${i}"
                        role="tab"
                        aria-selected="${i===a?"true":"false"}"
                    >${S(N(`astro.dignity.${i}`))}</button>
                `).join("")}
            </div>
        `}function Ne(a){return["domicile","exaltation","detriment","fall"].includes(a)?a:r.mode}function ke(a={}){let l={};try{l=JSON.parse(window.localStorage?.getItem(o)||"{}")||{}}catch{l={}}let c=Number(l.version)>=n?l.classicalRulers:void 0;return{...r,mode:Ne(a.mode||l.mode||r.mode),showArrowDirection:(a.showArrowDirection??l.showArrowDirection??r.showArrowDirection)!==!1,showHouseRulers:(a.showHouseRulers??l.showHouseRulers??r.showHouseRulers)!==!1,classicalRulers:(a.classicalRulers??c??r.classicalRulers)===!0}}function Ke(a){try{window.localStorage?.setItem(o,JSON.stringify({...a,version:n}))}catch{}}function Te(a){let l=`page.chart.rulers.chainModes.${a}`,i=N(l);return i!==l?i:N(a==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${a}`)}function Xe(a){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${S(Te(a.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${S(N("page.chart.rulers.options.chainType"))}">
                        ${l.map(i=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${S(i)}"
                                    data-dispositor-option="mode"
                                    ${i===a.mode?"checked":""}
                                >
                                <span>${S(Te(i))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${a.showHouseRulers?"checked":""}>
                        <span>${S(N("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${a.classicalRulers?"checked":""}>
                        <span>${S(N("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function de(a,l,i){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <h4>${S(N("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Xe(i)}
                </div>
                ${Oe(a,l,i)}
            </div>
        `}function Ue(a,l,i,c){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${S(N("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${S(N("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${S(N("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${ce(a?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${de(l,i,c)}
                </div>
            </div>
        `}function Je(a,l={},i="domicile"){oe();let{chains:c,mainRulers:u}=Se(a,i),b=document.createElement("div");b.className="dispositor-modal-overlay",b.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${S(N("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${S(N("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Ve(i)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${S(N("page.chart.rulers.mainKicker"))}</span>
                    ${Be(u)}
                </div>
                ${Ge(c)}
            </div>
        `,document.body.appendChild(b),document.body.classList.add("dispositor-modal-open"),b.addEventListener("click",P=>{let _=P.target;if(_===b||_ instanceof Element&&_.closest("[data-dispositor-close]")){oe();return}if(!(_ instanceof Element))return;let A=_.closest(".dispositor-mode-tab[data-dispositor-mode]");A&&Je(a,l,A.dataset.dispositorMode||i)}),b.querySelector("[data-dispositor-close]")?.focus()}function oe(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function Ce(a,l,i={}){let c=typeof a=="string"?document.getElementById(a):a;if(!c)return;let u=ke(i),{chains:b,housesByRuler:P}=_e(l,u.mode,u);i.section==="jones"?c.innerHTML=`<div class="dispositor-panel">${ce(l?.cosmogram_pattern)}</div>`:i.section==="scheme"?c.innerHTML=`<div class="dispositor-panel">${de(b,P,u)}</div>`:c.innerHTML=i.layout==="tabs"?Ue(l,b,P,u):`
                    <div class="dispositor-panel">
                        ${ce(l?.cosmogram_pattern)}
                        ${de(b,P,u)}
                    </div>
                `,c.querySelectorAll("[data-dispositor-tab]").forEach(w=>{w.addEventListener("click",()=>{let M=w.dataset.dispositorTab;c.querySelectorAll("[data-dispositor-tab]").forEach(h=>{let y=h.dataset.dispositorTab===M;h.classList.toggle("active",y),h.setAttribute("aria-selected",y?"true":"false")}),c.querySelectorAll("[data-dispositor-panel]").forEach(h=>{h.classList.toggle("active",h.dataset.dispositorPanel===M)})})});let _=c.querySelector("[data-dispositor-options-toggle]"),A=c.querySelector("[data-dispositor-options-menu]");_?.addEventListener("click",w=>{w.stopPropagation();let M=A&&!A.classList.contains("hidden");A?.classList.toggle("hidden",M),_.setAttribute("aria-expanded",M?"false":"true")}),A?.addEventListener("click",w=>w.stopPropagation()),A?.querySelectorAll("[data-dispositor-option]").forEach(w=>{w.addEventListener("change",()=>{let M={...u};w.dataset.dispositorOption==="mode"?M.mode=Ne(w.value):M[w.dataset.dispositorOption]=w.checked,Ke(M),Ce(c,l,M)})})}window.DispositorChains={render:Ce,buildChains:Se,buildHouseDispositorScheme:_e,buildCompactLayout:Pe,readDisplayOptions:ke,closeModal:oe},document.addEventListener("keydown",a=>{a.key==="Escape"&&(oe(),document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",a=>{a.target instanceof Element&&a.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))})})();
