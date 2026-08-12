import{c as Z}from"./chunk-IZUYVIPG.js";var G=class G{constructor(t={}){let e=(s,o,a)=>s||(o?document.getElementById(o):document.getElementById(a));this.planetsTable=e(t.planetsTable,t.planetsTableId,"planetsTable"),this.housesTable=e(t.housesTable,t.housesTableId,"housesTable"),this.aspectsTable=e(t.aspectsTable,t.aspectsTableId,"aspectsTable"),this.aspectGridContainer=e(t.aspectGridContainer,t.aspectGridContainerId,"aspectGridContainer"),this.configsContainer=e(t.configsContainer,t.configsContainerId,"configurationsContainer"),this.balancesContainer=e(t.balancesContainer,t.balancesContainerId,"balancesContainer"),this.dignitiesContainer=e(t.dignitiesContainer,t.dignitiesContainerId,"dignitiesContainer"),this.aspectSortHeadersSelector=t.aspectSortHeadersSelector||"#aspects-list th.sortable[data-sort]",this.aspectTypeFilter="all",this.aspectPlanetFilter=null,this.aspectSortState={field:"planet",ascending:!0},this.aspectSortHeaders=[],this.hoveredAspectKey=null,this.showSpeed=!0,this.showStationary=!0,this.showApplyingSeparating=!1,this.showAspectText=!1,this.showSpeedColumn=t.showSpeedColumn!==!1,this.showHouseColumn=t.showHouseColumn!==!1,this.onPlanetsRendered=typeof t.onPlanetsRendered=="function"?t.onPlanetsRendered:null,this.fixedStarsData=null,this.showFixedStarBadges=!1,this.houseNumberStyle=Symbols?.readSavedHouseNumberStyle?.()||"arabic",this.visualPreferences=window.AstroPreferences?.getAccountVisualPreferences?.()||null,this.initAspectSortHeaders()}t(t,e){return window.FrontendI18n?.t?.(t,e)||t}planetName(t){let e=this.getCuspHouseNumber(t);if(e){let a=Symbols?.formatHouseLabel?.(e)||String(e);return this.t("page.chart.houseCusp",{house:a})}let s=`astro.planet.${t}`,o=this.t(s);return o===s?Symbols.getPlanetNameRu?.(t)||Symbols.planetNamesRu[t]||t:o}signName(t){let e=`astro.sign.${t}`,s=this.t(e);return s===e?Symbols.signNamesRu[t]||t:s}aspectName(t){let e=`astro.aspect.${t}`,s=this.t(e);return s===e?Symbols.aspectNamesRu[t]||t:s}getPlanetSymbol(t){return Symbols.getPlanetSymbol?.(t)||Symbols.planets?.[this.normalizeAspectBodyName(t)]||Symbols.planets?.[t]||""}getPlanetSymbolMarkup(t,e={}){let s=this.getCuspHouseNumber(t);if(s){let o=Symbols?.formatHouseLabel?.(s)||String(s),a=this.escapeHtml(e.title||this.planetName(t));return`<span class="aspect-cusp-symbol" title="${a}" aria-label="${a}">${this.escapeHtml(o)}</span>`}return Symbols.getPlanetSymbolMarkup?.(t,e)||`<span class="astro-symbol" aria-hidden="true">${this.escapeHtml(this.getPlanetSymbol(t))}</span>`}getCuspHouseNumber(t){let e=/^Cusp([1-9]|1[0-2])$/.exec(String(t||""));return e?Number(e[1]):null}getAspectSymbol(t){return Symbols.getAspectDisplay?.(t)||Symbols.aspects?.[t]||"•"}escapeHtml(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}retrogradeTitle(){let t="page.natalFull.legend.motion.retrograde",e=this.t(t);return e===t?"Retrograde":e}stationaryTitle(){let t="page.natalFull.legend.motion.stationary",e=this.t(t);return e===t?"Stationary":e}dignityTitle(t){if(!t||t==="neutral")return"";let e=`astro.dignity.${t}`,s=this.t(e);return s===e?t:s}dignityShortLabel(t){let e=String(this.dignityTitle(t)||"").trim();return e?Array.from(e)[0].toUpperCase():""}getApplyingSeparatingLabel(t){if(!t)return"";if(typeof t.applying=="boolean")return t.applying?this.t("page.chart.settings.aspectPhase.applying"):this.t("page.chart.settings.aspectPhase.separating");let e=String(t.applying_separating||t.phase||"").trim();if(!e)return"";let s=e.toLowerCase();return s.includes("applic")||s.includes("сход")?this.t("page.chart.settings.aspectPhase.applying"):s.includes("separ")||s.includes("расход")?this.t("page.chart.settings.aspectPhase.separating"):e}getApplyingSeparatingShortLabel(t){if(!t)return"";if(typeof t.applying=="boolean")return t.applying?"сход.":"расх.";let e=String(t.applying_separating||t.phase||"").trim();if(!e)return"";let s=e.toLowerCase();return s.includes("applic")||s.includes("сход")?"сход.":s.includes("separ")||s.includes("расход")?"расх.":e}retroIndicatorHtml(t,e=""){if(!t)return"";let s=e?` ${e}`:"",o=this.escapeHtml(this.retrogradeTitle());return`<span class="retro-indicator${s}" title="${o}" aria-label="${o}">R</span>`}stationaryIndicatorHtml(t,e=""){if(!t?.is_stationary)return"";let s=e?` ${e}`:"",o=this.escapeHtml(this.stationaryTitle());return`<span class="planet-status-badge planet-status-badge--stationary${s}" title="${o}" aria-label="${o}">S</span>`}dignityIndicatorHtml(t,e=""){let s=String(t?.dignity||"").trim();if(!s||s==="neutral")return"";let o=this.dignityTitle(s),a=this.dignityShortLabel(s);if(!o||!a)return"";let r=e?` ${e}`:"",c=this.escapeHtml(o);return`
            <span class="planet-status-badge planet-status-badge--dignity planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">
                ${this.escapeHtml(a)}
            </span>
        `}solarBadgeTitle(t){let e=`astro.feature.short.${t}`,s=this.t(e);return s===e?t:s}sunRelationIndicatorHtml(t,e=""){let s=String(t?.sun_relation||"").trim(),a={cazimi:"Cz",combust:"Cb",under_rays:"Ur"}[s];if(!a)return"";let r=e?` ${e}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--sun-relation planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}solarPhaseIndicatorHtml(t,e=""){let s=String(t?.solar_phase||"").trim(),a={oriental:"Or",occidental:"Oc"}[s];if(!a)return"";let r=e?` ${e}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--solar-phase planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}outOfBoundsIndicatorHtml(t,e=""){if(!t?.out_of_bounds)return"";let s=e?` ${e}`:"",o="astro.feature.short.out_of_bounds",a=this.t(o),r=this.escapeHtml(a&&a!==o?a:"Out of bounds");return`<span class="planet-status-badge planet-status-badge--oob${s}" title="${r}" aria-label="${r}">OOB</span>`}buildRetrogradeLookup(t=[]){let e=new Map;return t.forEach(s=>{if(!s?.name)return;let o=this.normalizeAspectBodyName(s.name);e.set(o,!!s.retrograde)}),e}isBodyRetrograde(t,e=null){if(!t)return!1;let s=this.normalizeAspectBodyName(String(t));return(e||this.buildRetrogradeLookup(this.chartData?.planets||[])).get(s)===!0}buildPlanetHouseLookup(t=[]){let e=new Map;return t.forEach(s=>{!s?.name||s.house==null||s.house===""||e.set(this.normalizeAspectBodyName(s.name),s.house)}),e}buildHouseRulerGroups(t,e=new Map,s=null){if(Array.isArray(t?.ruler_groups)&&t.ruler_groups.length)return t.ruler_groups.map($=>({included:$?.scope==="included",entries:($?.entries||[]).filter(k=>{let I=this.normalizeAspectBodyName(k?.planet);return I&&(!(s instanceof Set)||s.has(I))}).map(k=>({planet:k.planet,house:k.house??e.get(this.normalizeAspectBodyName(k.planet))??null}))})).filter($=>$.entries.length);let o=[],r=[t?.ruler_planet,...Array.isArray(t?.co_rulers)?t.co_rulers:[]],c=new Set;return r.forEach(($,k)=>{if(!$)return;let I=this.normalizeAspectBodyName($);s instanceof Set&&!s.has(I)||c.has(I)||(c.add(I),o.push({planet:$,house:k===0&&t?.ruler_in_house!=null&&t?.ruler_in_house!==""?t.ruler_in_house:e.get(I)??null}))}),o.length?[{entries:o,included:!1}]:[]}renderHouseRulerGroup(t,e=null){return t?.entries?.length?`
            <div class="${t.included?"house-ruler-group house-ruler-group--included":"house-ruler-group"}">
                ${t.entries.map(o=>{let a=this.planetName(o.planet),r=o.house!=null&&o.house!==""?this.formatHouseNumber(o.house):"",c=[a];return r&&c.push(`${this.t("common.house")} ${r}`),`
                        <div class="house-ruler-row" title="${this.escapeHtml(c.join(" • "))}">
                            <span class="house-ruler-symbol-wrap">
                                ${this.getPlanetSymbolMarkup(o.planet,{size:18,title:a})}
                                ${this.retroIndicatorHtml(this.isBodyRetrograde(o.planet,e),"retro-indicator--micro house-ruler-retro")}
                            </span>
                            <span class="house-ruler-house">${this.escapeHtml(r||"—")}</span>
                        </div>
                    `}).join("")}
            </div>
        `:""}initAspectSortHeaders(){this.aspectSortHeaders=[...document.querySelectorAll(this.aspectSortHeadersSelector)],this.aspectSortHeaders.forEach(t=>{t.addEventListener("click",()=>{this.toggleAspectSort(t.dataset.sort)})}),this.updateAspectSortHeaders()}toggleAspectSort(t){t&&(this.aspectSortState.field===t?this.aspectSortState.ascending=!this.aspectSortState.ascending:(this.aspectSortState.field=t,this.aspectSortState.ascending=!0),this.updateAspectSortHeaders(),this.reRenderAspects())}updateAspectSortHeaders(){this.aspectSortHeaders.forEach(t=>{let e=this.aspectSortState.field===t.dataset.sort;t.classList.toggle("sort-active",e),t.classList.toggle("sort-desc",e&&!this.aspectSortState.ascending),t.setAttribute("aria-sort",e?this.aspectSortState.ascending?"ascending":"descending":"none")})}setAspectTypeFilter(t){let e=t==="major"||t==="minor"?t:"all";e!==this.aspectTypeFilter&&(this.aspectTypeFilter=e,this.reRenderAspects())}setAspectPlanetFilter(t){let e=t?this.normalizeAspectBodyName(String(t)):null;e!==this.aspectPlanetFilter&&(this.aspectPlanetFilter=e,this.reRenderAspects())}setDisplayPreferences(t={}){Object.prototype.hasOwnProperty.call(t,"showSpeed")&&(this.showSpeed=t.showSpeed!==!1),Object.prototype.hasOwnProperty.call(t,"showStationary")&&(this.showStationary=t.showStationary!==!1),Object.prototype.hasOwnProperty.call(t,"showApplyingSeparating")&&(this.showApplyingSeparating=t.showApplyingSeparating===!0),Object.prototype.hasOwnProperty.call(t,"showAspectText")&&(this.showAspectText=t.showAspectText===!0),this.updatePlanetsTableColumns(),this.chartData&&(this.renderPlanets(this.chartData.planets),this.renderAspects(this.chartData.aspects))}setHouseNumberStyle(t){let e=Symbols?.normalizeHouseNumberStyle?.(t)||"arabic";e!==this.houseNumberStyle&&(this.houseNumberStyle=e,this.chartData&&this.render(this.chartData))}updatePlanetsTableColumns(){let t=this.planetsTable?.closest("table");if(!t)return;t.classList.toggle("planets-table--speed-hidden",!this.showSpeed),t.classList.toggle("planets-table--speed-column-hidden",!this.showSpeedColumn),t.classList.toggle("planets-table--house-column-hidden",!this.showHouseColumn);let e=window.AstroPreferences?.getDegreeFormat?.()||"DEGREES_ONLY";t.classList.toggle("planets-table--seconds",e==="DEGREES_MINUTES_SECONDS")}setVisualPreferences(t={}){this.visualPreferences=window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t||{}):t||null,this.chartData&&this.render(this.chartData)}setFixedStarsData(t,e={}){this.fixedStarsData=t||null,this.showFixedStarBadges=e.showBadges===!0&&!!t,this.chartData&&this.renderPlanets(this.chartData.planets)}reRenderAspects(){this.chartData&&this.renderAspects(this.chartData.aspects)}render(t){this.chartData=t,this.renderPlanets(t.planets),this.renderHouses(t.houses),this.renderAspects(t.aspects),this.renderAspectGrid(t.aspects,t.planets),this.renderDignities(t.planets),this.renderConfigurations(t.aspect_configurations,t.stelliums),this.renderBalances(t.balances,t.cosmogram_pattern)}static normalizeBodyName(t){return window.Symbols?.normalizeBodyName?.(t)||t}renderPlanets(t){if(!t||!this.planetsTable)return;this.updatePlanetsTableColumns();let e=[...t].sort((s,o)=>{let a=G.PLANET_ORDER.indexOf(G.normalizeBodyName(s.name)),r=G.PLANET_ORDER.indexOf(G.normalizeBodyName(o.name));return(a===-1?999:a)-(r===-1?999:r)});this.planetsTable.innerHTML=e.map(s=>{let o=this.formatAstroCoordinate(s),a=this.createPlanetIconSVG(s),r=this.renderPlanetSpeedChip(s),c=this.renderFixedStarSymbolBadge(s),$=[this.showStationary?this.stationaryIndicatorHtml(s,"planet-status-badge--small"):"",this.retroIndicatorHtml(s.retrograde,"retro-indicator--small")].filter(Boolean).join(""),k=[this.dignityIndicatorHtml(s,"planet-status-badge--small"),this.sunRelationIndicatorHtml(s,"planet-status-badge--small"),this.solarPhaseIndicatorHtml(s,"planet-status-badge--small"),this.outOfBoundsIndicatorHtml(s,"planet-status-badge--small")].filter(Boolean).join("");return`
                <tr id="row-${s.name}" data-planet="${s.name}">
                    <td class="symbol-cell">
                        <div class="planet-symbol-cell">
                            <span class="planet-icon-wrap">
                                ${a}
                                ${c}
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
            `}).join(""),this.onPlanetsRendered?.(this)}getFixedStarContactsForPlanet(t){if(!this.showFixedStarBadges||!t)return[];let e=this.normalizeAspectBodyName(t);return(this.fixedStarsData?.conjunctions||[]).filter(s=>this.normalizeAspectBodyName(s?.object)===e).sort((s,o)=>Number(s.orb||0)-Number(o.orb||0))}findFixedStarInfo(t){let e=t?.star;return e?t?.star_info||(this.fixedStarsData?.stars||[]).find(s=>s?.name===e)||null:t?.star_info||null}fixedStarTooltipHtml(t){let e=this.findFixedStarInfo(t)||{},s=e.degree_in_sign_formatted&&e.sign?`${e.degree_in_sign_formatted} ${this.signName(e.sign)}`:t?.star_position||"",o=e.designation||"",a=e.magnitude!==null&&e.magnitude!==void 0?`m ${e.magnitude}`:"",r=e.nature||t?.nature||"",c=t?.object?this.planetName(t.object):"",$=t?.object_degree_in_sign_formatted&&t?.object_sign?`${t.object_degree_in_sign_formatted} ${this.signName(t.object_sign)}`:t?.object_position||"",k=Number(t?.orb),I=Number.isFinite(k)?`${k.toFixed(2)}°`:"";return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(e.name||t?.star||"")}</div>
            ${s?`<div>${this.escapeHtml(s)}</div>`:""}
            ${o?`<div>${this.escapeHtml(o)}</div>`:""}
            ${a?`<div>${this.escapeHtml(a)}</div>`:""}
            ${r?`<div>${this.escapeHtml(r)}</div>`:""}
            ${c?`<div class="fixed-star-tooltip-contact">${this.escapeHtml(c)} ${this.escapeHtml($)}${I?` · ${this.escapeHtml(I)}`:""}</div>`:""}
        `.trim()}renderFixedStarSymbolBadge(t){let e=this.getFixedStarContactsForPlanet(t?.name);if(!e.length)return"";let s=this.fixedStarSummaryTooltipHtml(e),o=this.t("page.chart.settings.fixedStars.title"),a=e.length>1?`${o} (${e.length})`:o;return`
            <span
                class="fixed-star-badge fixed-star-badge--icon"
                role="img"
                tabindex="0"
                aria-label="${this.escapeHtml(a)}"
                data-fixed-star-tooltip="${this.escapeHtml(s)}"
            >✶</span>
        `}fixedStarSummaryTooltipHtml(t){if(t.length===1)return this.fixedStarTooltipHtml(t[0]);let e=this.t("page.chart.settings.fixedStars.title"),s=t.map(o=>{let a=this.findFixedStarInfo(o)||{},r=a.name||o?.star||"",c=a.degree_in_sign_formatted&&a.sign?`${a.degree_in_sign_formatted} ${this.signName(a.sign)}`:o?.star_position||"",$=Number(o?.orb),k=Number.isFinite($)?`${$.toFixed(2)}°`:"";return`
                <div class="fixed-star-tooltip-row">
                    <span class="fixed-star-tooltip-star">✶ ${this.escapeHtml(r)}</span>
                    ${c?`<span class="fixed-star-tooltip-pos">${this.escapeHtml(c)}</span>`:""}
                    ${k?`<span class="fixed-star-tooltip-orb">${this.escapeHtml(k)}</span>`:""}
                </div>
            `}).join("");return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(e)}</div>
            <div class="fixed-star-tooltip-list">${s}</div>
        `.trim()}renderPlanetSpeedChip(t){if(!t)return"";let e=this.resolveSpeedPercent(t);if(e!==null){if(!Number.isFinite(e))return"";let s="";return e<10?s=" planet-meta-chip--speed-slow":e>120&&(s=" planet-meta-chip--speed-fast"),`<span class="planet-meta-chip${s}">${Math.round(e)}%</span>`}if(t.speed!==void 0&&t.speed!==null){let s=Number(t.speed);if(!Number.isFinite(s))return"";if(s===0)return'<span class="planet-meta-chip planet-meta-chip--speed-slow">0%</span>';let o=this.formatCompactSpeed(s),a=this.formatSpeedValue(s),r=this.t("page.natalFull.units.degPerDay",{value:a});return`<span class="planet-meta-chip" title="${this.escapeHtml(r)}">${this.escapeHtml(o)}</span>`}return""}resolveSpeedPercent(t){let e=Number(t?.speed_percent);if(Number.isFinite(e))return e;let s={Proserpina:.001478},o=Number(t?.speed),a=s[t?.name];return!Number.isFinite(o)||!a?null:Math.round(Math.abs(o)/a*1e4)/100}formatSpeedValue(t){let e=Math.abs(Number(t));return!Number.isFinite(e)||e===0?"0.00":e>=1?e.toFixed(2):e>=.1?e.toFixed(3):e>=.01?e.toFixed(4):e.toFixed(5)}formatCompactSpeed(t){let e=Math.abs(Number(t));if(!Number.isFinite(e)||e===0)return"0°/д";if(e>=1)return`${e.toFixed(2)}°/д`;let s=e*60;return s>=1?`${s.toFixed(1)}′/д`:`${(s*60).toFixed(1)}″/д`}renderHouses(t){if(!t||!this.housesTable)return;let e=this.buildRetrogradeLookup(this.chartData?.planets||[]),s=this.buildPlanetHouseLookup(this.chartData?.planets||[]),o=new Set(s.keys());this.housesTable.innerHTML=t.map(a=>{let r=[1,4,7,10].includes(a.number),c=this.formatAstroCoordinate(a),$=a.included_sign||"",k=$&&Symbols.signs[$]||"",I=$?this.signName($):"",N=$?`${this.t("page.natalFull.table.houses.included")}: ${I}`:"",w=this.buildHouseRulerGroups(a,s,o);return`
                <tr id="row-house-${a.number}" class="${r?"house-angular":""}">
                    <td class="mono">${this.escapeHtml(this.formatHouseNumber(a.number))}</td>
                    <td class="mono house-sign-cell">
                        <div class="house-sign-main">${c}</div>
                        ${$?`
                            <div class="house-sign-meta" title="${this.escapeHtml(N)}">
                                <span class="house-sign-badge">${this.escapeHtml(this.t("astro.feature.short.intercepted"))}</span>
                                <span class="astro-symbol">${k}</span>
                            </div>
                        `:""}
                    </td>
                    <td class="mono house-ruler-cell">
                        ${w.length?w.map(F=>this.renderHouseRulerGroup(F,e)).join(""):"—"}
                    </td>
                </tr>
            `}).join("")}formatAstroCoordinate(t){if(window.LocaleFormatters?.formatAstroCoordinate)return window.LocaleFormatters.formatAstroCoordinate(t,{signSymbol:Symbols?.signs?.[t?.sign],signClass:"astro-symbol"});let e=Number(t?.degree_in_sign);if(!Number.isFinite(e))return"";let s=Math.floor(e),o=Math.floor((e-s)*60),a=Symbols?.signs?.[t?.sign]||t?.sign||"",r=a?`<span class="astro-symbol">${a}</span>`:"";return[`${s}°`,r,`${String(o).padStart(2,"0")}'`].filter(Boolean).join(" ")}createPlanetIconSVG(t){let e=Symbols.signElements[t.sign],s=window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(t.name,e,this.visualPreferences):Symbols.elementColors[e]||"#374151";if(window.AstroGlyphs?.hasPlanetIcon?.(t.name))return`
                <span class="planet-icon-svg">
                    ${window.AstroGlyphs.createPlanetSymbolMarkup(t.name,{size:28,color:s,title:this.planetName(t.name)})}
                </span>
            `;let a=this.getPlanetSymbol(t.name)||t.name.charAt(0),c=22*(Symbols.planetGlyphScale?.[t.name]||1);return`
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${(14+c*.36).toFixed(2)}" text-anchor="middle" font-size="${c.toFixed(2)}" font-weight="600" fill="${s}" class="planet-symbol-text">${a}</text>
                </svg>
            </span>
        `}formatDegreeShort(t){let e=Math.floor(t),s=Math.floor((t-e)*60);return`${e}°${s.toString().padStart(2,"0")}'`}normalizeAspectBodyName(t){return G.ASPECT_NAME_ALIASES[t]||t}formatHouseNumber(t){return t==null||t===""?"":Symbols?.formatHouseLabel?.(t,{style:this.houseNumberStyle})||String(t)}getAspectRank(t){let e=this.normalizeAspectBodyName(t);return G.ASPECT_SORT_RANK[e]??999}normalizeAspectForDisplay(t){let e=Number.isInteger(t.left_rank)?t.left_rank:this.getAspectRank(t.planet_1),s=Number.isInteger(t.right_rank)?t.right_rank:this.getAspectRank(t.planet_2),o=t.left_planet||t.planet_1,a=t.right_planet||t.planet_2,r=e,c=s;return(!t.left_planet||!t.right_planet)&&(s<e||e===s&&String(t.planet_2)<String(t.planet_1))&&(o=t.planet_2,a=t.planet_1,r=s,c=e),{...t,left_planet:this.normalizeAspectBodyName(o),right_planet:this.normalizeAspectBodyName(a),left_rank:r,right_rank:c}}getAspectTypeRank(t){return G.ASPECT_TYPE_RANK[t]??999}buildAspectKey(t,e){let s=this.normalizeAspectBodyName(t),o=this.normalizeAspectBodyName(e),a=this.getAspectRank(s),r=this.getAspectRank(o);return a<r?`${s}-${o}`:r<a?`${o}-${s}`:s<=o?`${s}-${o}`:`${o}-${s}`}getAspectKey(t){if(!t)return null;let e=t.left_planet||t.planet_1,s=t.right_planet||t.planet_2;return!e||!s?null:this.buildAspectKey(e,s)}compareAspectsByPlanet(t,e){return t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.orb!==e.orb?t.orb-e.orb:t.right_rank!==e.right_rank?t.right_rank-e.right_rank:this.getAspectTypeRank(t.aspect_type)-this.getAspectTypeRank(e.aspect_type)}compareAspectsByType(t,e){let s=this.getAspectTypeRank(t.aspect_type)-this.getAspectTypeRank(e.aspect_type);return s!==0?s:t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.right_rank!==e.right_rank?t.right_rank-e.right_rank:t.orb-e.orb}compareAspectsByOrb(t,e){return t.is_major!==e.is_major?Number(e.is_major)-Number(t.is_major):t.orb!==e.orb?t.orb-e.orb:t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.right_rank-e.right_rank}renderAspectTypeCell(t){let s=`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(t.aspect_type,this.visualPreferences,t.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(t.aspect_type)}</span>`,o=this.showAspectText?` ${this.aspectName(t.aspect_type)}`:"";return`${s}${o}`}renderAspectTypeIcon(t){return`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(t.aspect_type,this.visualPreferences,t.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(t.aspect_type)}</span>`}renderAspectPairCell(t){if(!t)return"";let e=this.escapeHtml(this.planetName(t.left_planet)),s=this.escapeHtml(this.planetName(t.right_planet)),o=this.escapeHtml(this.aspectName(t.aspect_type));return`
            <span class="aspect-chip" aria-label="${e} ${o} ${s}">
                <span class="aspect-chip__body" title="${e}">${this.getPlanetSymbolMarkup(t.left_planet,{size:15,title:this.planetName(t.left_planet)})}</span>
                <span class="aspect-chip__type" title="${o}">${this.renderAspectTypeIcon(t)}</span>
                <span class="aspect-chip__body" title="${s}">${this.getPlanetSymbolMarkup(t.right_planet,{size:15,title:this.planetName(t.right_planet)})}</span>
            </span>
        `}renderAspects(t){if(!this.aspectsTable)return;if(!t||t.length===0){this.aspectsTable.innerHTML="";return}let e=t;this.aspectTypeFilter==="major"?e=e.filter(a=>a.is_major):this.aspectTypeFilter==="minor"&&(e=e.filter(a=>!a.is_major)),this.aspectPlanetFilter&&(e=e.filter(a=>{let r=this.normalizeAspectBodyName(a.planet_1),c=this.normalizeAspectBodyName(a.planet_2);return r===this.aspectPlanetFilter||c===this.aspectPlanetFilter}));let o=[...e.map(a=>this.normalizeAspectForDisplay(a))].sort((a,r)=>{let c=0;switch(this.aspectSortState.field){case"type":c=this.compareAspectsByType(a,r);break;case"orb":c=this.compareAspectsByOrb(a,r);break;case"planet":default:c=this.compareAspectsByPlanet(a,r);break}return this.aspectSortState.ascending?c:-c});if(o.length===0){this.aspectsTable.innerHTML='<tr><td colspan="3" class="text-muted">—</td></tr>';return}this.aspectsTable.innerHTML=o.map(a=>{let r=this.getAspectKey(a),c=this.showApplyingSeparating?this.getApplyingSeparatingShortLabel(a):"";return`
                <tr data-aspect="${r||""}" data-aspect-key="${r||""}" data-aspect-type="${this.escapeHtml(a.aspect_type||"")}">
                    <td>${this.renderAspectPairCell(a)}</td>
                    <td class="aspect-phase-cell">${c?this.escapeHtml(c):"—"}</td>
                    <td class="mono">${a.orb.toFixed(2)}°</td>
                </tr>
            `}).join("")}renderGridHeaderBody(t){let e=this.getPlanetSymbolMarkup(t.name,{size:15,title:this.planetName(t.name)}),s=this.retroIndicatorHtml(t.retrograde,"retro-indicator--micro");return`<span class="aspect-grid-body">${e}${s}</span>`}renderAspectGrid(t,e){if(!this.aspectGridContainer||!t||!e)return;let s=this.getAspectRank("PartOfFortune"),o=new Map;e.forEach($=>{let k=this.normalizeAspectBodyName($.name);this.getAspectRank(k)>s||o.has(k)||o.set(k,{...$,name:k})});let a=[...o.values()].sort(($,k)=>this.getAspectRank($.name)-this.getAspectRank(k.name)),r={};t.forEach($=>{let k=this.getAspectKey($);k&&(r[k]=$)});let c='<table class="aspect-grid">';c+="<tr><th></th>",a.forEach($=>{c+=`<th title="${this.planetName($.name)}">${this.renderGridHeaderBody($)}</th>`}),c+="</tr>",a.forEach(($,k)=>{c+=`<tr><th title="${this.planetName($.name)}">${this.renderGridHeaderBody($)}</th>`,a.forEach((I,N)=>{if(N>=k)c+="<td></td>";else{let w=this.buildAspectKey($.name,I.name),F=r[w];if(F){let K=this.getAspectSymbol(F.aspect_type),it=F.harmonic_type==="harmonious"?"grid-harmonious":F.harmonic_type==="tense"?"grid-tense":"grid-neutral";c+=`<td class="${it}" data-aspect-key="${w}" data-aspect-type="${this.escapeHtml(F.aspect_type||"")}" title="${this.aspectName(F.aspect_type)} ${F.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(F.aspect_type,this.visualPreferences,F.harmonic_type):"#9ca3af"}">${K}</span></td>`}else c+="<td>–</td>"}}),c+="</tr>"}),c+="</table>",this.aspectGridContainer.innerHTML=c}clearHoveredAspect(){this.hoveredAspectKey=null,this.aspectsTable&&this.aspectsTable.querySelectorAll("tr.aspect-hover-row").forEach(t=>{t.classList.remove("aspect-hover-row")}),this.aspectGridContainer&&this.aspectGridContainer.querySelectorAll("td.grid-hover").forEach(t=>{t.classList.remove("grid-hover")})}setHoveredAspect(t,e={}){let s=e.surface==="grid"?"grid":"table";if(this.clearHoveredAspect(),!!t){if(this.hoveredAspectKey=t,s==="table"&&this.aspectsTable){let o=this.aspectsTable.querySelector(`tr[data-aspect-key="${t}"]`);o&&o.classList.add("aspect-hover-row");return}if(s==="grid"&&this.aspectGridContainer){let o=this.aspectGridContainer.querySelector(`td[data-aspect-key="${t}"]`);o&&o.classList.add("grid-hover")}}}renderDignities(t){if(!this.dignitiesContainer||!t)return;let e={domicile:{label:this.t("astro.dignity.domicile"),class:"dignity-domicile",icon:"🏠"},exaltation:{label:this.t("astro.dignity.exaltation"),class:"dignity-exaltation",icon:"⬆"},detriment:{label:this.t("astro.dignity.detriment"),class:"dignity-detriment",icon:"⬇"},fall:{label:this.t("astro.dignity.fall"),class:"dignity-fall",icon:"💫"},neutral:{label:"",class:"",icon:""}},s=t.filter(a=>a.dignity&&a.dignity!=="neutral");if(s.length===0){this.dignitiesContainer.innerHTML=`<p class="text-muted">${this.t("page.chart.empty.noDignities")}</p>`;return}let o='<div class="dignities-list">';s.forEach(a=>{let r=e[a.dignity]||e.neutral;o+=`
                <div class="dignity-item ${r.class}">
                    <span class="dignity-planet">${this.getPlanetSymbolMarkup(a.name,{size:16,title:this.planetName(a.name)})} ${this.planetName(a.name)}</span>
                    <span class="dignity-label">${r.icon} ${r.label}</span>
                </div>
            `}),o+="</div>",this.dignitiesContainer.innerHTML=o}renderConfigurations(t,e){if(!this.configsContainer)return;let s="";if(t&&t.length>0){let o=[...t].sort((a,r)=>{let c=a.strength_score||0;return(r.strength_score||0)-c});s+=`<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t("page.chart.configurations.title")}</h3>`,s+=o.map(a=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((a.planets_involved||[]).join("|"))}"
                    data-config-aspect-keys="${this.escapeHtml((a.aspects||[]).map(r=>this.getAspectKey(r)).filter(Boolean).join("|"))}"
                    title="${this.escapeHtml(this.formatConfigType(a.type))}"
                >
                    <div class="config-card-head">
                        <h4>${this.escapeHtml(this.formatConfigType(a.type))}</h4>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${a.apex_planet?`
                            <span
                                class="config-apex-chip"
                                title="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(a.apex_planet)}))}"
                                aria-label="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(a.apex_planet)}))}"
                            >
                                <span class="planet-tag planet-tag--icon-only planet-tag--config-point">
                                    ${this.getPlanetSymbolMarkup(a.apex_planet,{size:16,title:this.planetName(a.apex_planet)})}
                                </span>
                            </span>
                        `:""}
                        ${a.planets_involved.filter(r=>r!==a.apex_planet).map(r=>{let c=this.buildConfigurationPointTooltip(r,a.aspects||[]),$=this.escapeHtml(this.planetName(r)),k=c?` data-config-point-tooltip="${this.escapeHtml(c)}" data-config-point-name="${$}"`:"";return`
                            <span class="planet-tag planet-tag--icon-only planet-tag--config-point"${c?"":` title="${$}"`} aria-label="${$}"${k}>
                                ${this.getPlanetSymbolMarkup(r,{size:16,title:this.planetName(r)})}
                            </span>
                        `}).join("")}
                    </div>
                </div>
            `).join("")}if(e&&e.length>0){let o=[...e].sort((a,r)=>(r.count||0)-(a.count||0));s+=`<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t("page.chart.configurations.stelliums")}</h3>`,s+=o.map(a=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((a.planets||[]).join("|"))}"
                    data-config-aspect-keys=""
                    data-compact-value="${Number(a.count||0)}"
                    title="${this.escapeHtml(a.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(a.house_number)}):this.signName(a.sign))}"
                >
                    <div class="config-card-head">
                        <h4>
                            ${a.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(a.house_number)}):`<span class="astro-symbol config-stellium-sign" aria-hidden="true">${Symbols.signs[a.sign]||""}</span> ${this.signName(a.sign)}`}
                        </h4>
                        <span class="config-strength-badge" data-compact-value="${Number(a.count||0)}">${this.t("page.chart.configurations.countShort",{count:a.count})}</span>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${a.planets.map(r=>`
                            <span class="planet-tag planet-tag--icon-only" title="${this.escapeHtml(this.planetName(r))}" aria-label="${this.escapeHtml(this.planetName(r))}">
                                ${this.getPlanetSymbolMarkup(r,{size:16,title:this.planetName(r)})}
                            </span>
                        `).join("")}
                    </div>
                </div>
            `).join("")}s||(s=`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.configsContainer.innerHTML=s}buildConfigurationPointTooltip(t,e){if(!t||!Array.isArray(e)||!e.length)return"";let s=this.normalizeAspectBodyName(t),o=e.filter(a=>{let r=this.normalizeAspectBodyName(a?.planet_1),c=this.normalizeAspectBodyName(a?.planet_2);return r===s||c===s});return o.length?`
            <div class="config-point-tooltip-title">${this.escapeHtml(this.planetName(t))}</div>
            <div class="config-aspect-lines">
                ${o.map(a=>{let r=`${this.planetName(a.planet_1)} ${this.aspectName(a.aspect_type)} ${this.planetName(a.planet_2)}`,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a.aspect_type,this.visualPreferences,a.harmonic_type):"#6b7280";return`
                    <div class="config-aspect-line" title="${this.escapeHtml(r)}">
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(a.planet_1,{size:14,title:this.planetName(a.planet_1)})}</span>
                        <span class="config-aspect-badge" style="--config-aspect-color:${this.escapeHtml(c)}" aria-label="${this.escapeHtml(this.aspectName(a.aspect_type))}">
                            <span class="astro-symbol config-aspect-glyph">${this.getAspectSymbol(a.aspect_type)}</span>
                        </span>
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(a.planet_2,{size:14,title:this.planetName(a.planet_2)})}</span>
                        <span class="config-aspect-orb">${Number(a.orb).toFixed(1)}°</span>
                    </div>
                `}).join("")}
            </div>
        `.trim():""}formatConfigType(t){let e=`astro.configuration.${t}`,s=this.t(e);return s===e?t.replace(/_/g," "):s}renderBalances(t,e){if(!this.balancesContainer)return;let s="";if(!t){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}let o=[{key:"by_sign",label:this.t("page.chart.balances.tabs.sign"),data:t.by_sign},{key:"by_house",label:this.t("page.chart.balances.tabs.house"),data:t.by_house}].filter(a=>this.hasBalanceData(a.data));if(!o.length){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}if(o.length===1){s+=this.renderBalanceSet(o[0].key,o[0].data),this.balancesContainer.innerHTML=s;return}s+=`
            <div class="balance-subtabs" role="tablist" aria-label="${this.t("page.chart.balances.tabs.title")}">
                ${o.map((a,r)=>`
                    <button
                        type="button"
                        class="balance-subtab-btn${r===0?" active":""}"
                        data-balance-tab="${a.key}"
                        aria-selected="${r===0?"true":"false"}"
                    >
                        ${a.label}
                    </button>
                `).join("")}
            </div>
            ${o.map((a,r)=>`
                <div class="balance-subtab-panel${r===0?" active":""}" data-balance-panel="${a.key}">
                    ${this.renderBalanceSet(a.key,a.data)}
                </div>
            `).join("")}
        `,this.balancesContainer.innerHTML=s,this.initBalanceTabs()}hasBalanceData(t){return!!(t&&Object.values(t).some(e=>e&&Object.keys(e).length))}initBalanceTabs(){let t=this.balancesContainer.querySelectorAll("[data-balance-tab]"),e=this.balancesContainer.querySelectorAll("[data-balance-panel]");!t.length||!e.length||t.forEach(s=>{s.addEventListener("click",()=>{let o=s.dataset.balanceTab;t.forEach(a=>{let r=a.dataset.balanceTab===o;a.classList.toggle("active",r),a.setAttribute("aria-selected",r?"true":"false")}),e.forEach(a=>{a.classList.toggle("active",a.dataset.balancePanel===o)})})})}renderBalanceSet(t,e){let s="",o="#9ca3af",a=r=>window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(r,this.visualPreferences):{Fire:"#ef4444",Earth:"#84cc16",Air:"#f59e0b",Water:"#3b82f6"}[r]||o;if(e.element_balance){let r=e.element_balance,c=r.fire+r.earth+r.air+r.water;s+=this.renderBalanceSection(this.t("page.chart.balances.elementsTitle"),[{label:this.t("astro.element.Fire"),value:r.fire,total:c,color:a("Fire")},{label:this.t("astro.element.Earth"),value:r.earth,total:c,color:a("Earth")},{label:this.t("astro.element.Air"),value:r.air,total:c,color:a("Air")},{label:this.t("astro.element.Water"),value:r.water,total:c,color:a("Water")}])}if(t==="by_sign"&&e.mode_balance){let r=e.mode_balance,c=r.cardinal+r.fixed+r.mutable;s+=this.renderBalanceSection(this.t("page.chart.balances.modesTitle"),[{label:this.t("astro.mode.short.Cardinal"),value:r.cardinal,total:c,color:o},{label:this.t("astro.mode.short.Fixed"),value:r.fixed,total:c,color:o},{label:this.t("astro.mode.short.Mutable"),value:r.mutable,total:c,color:o}])}if(t==="by_house"&&e.house_group_balance){let r=e.house_group_balance,c=r.angular+r.succedent+r.cadent;s+=this.renderBalanceSection(this.t("page.chart.balances.houseGroupsTitle"),[{label:this.t("page.chart.balances.angular"),value:r.angular,total:c,color:o},{label:this.t("page.chart.balances.succedent"),value:r.succedent,total:c,color:o},{label:this.t("page.chart.balances.cadent"),value:r.cadent,total:c,color:o}])}if(e.gender_balance){let r=e.gender_balance,c=r.masculine+r.feminine;s+=this.renderBalanceSection(this.t("page.chart.balances.polarityTitle"),[{label:this.t("astro.polarity.Masculine"),value:r.masculine,total:c,color:o},{label:this.t("astro.polarity.Feminine"),value:r.feminine,total:c,color:o}])}if(e.zones_balance){let r=e.zones_balance,c=r.brahma+r.vishnu+r.shiva;s+=this.renderBalanceSection(this.t("page.chart.balances.zonesTitle"),[{label:this.t("page.chart.balances.brahma"),value:r.brahma,total:c,color:o},{label:this.t("page.chart.balances.vishnu"),value:r.vishnu,total:c,color:o},{label:this.t("page.chart.balances.shiva"),value:r.shiva,total:c,color:o}])}if(e.quadrant_balance){let r=e.quadrant_balance,c=r.q1+r.q2+r.q3+r.q4;s+=this.renderBalanceSection(this.t("page.chart.balances.quadrantsTitle"),[{label:this.t("page.chart.balances.quadrant1"),value:r.q1,total:c,color:o},{label:this.t("page.chart.balances.quadrant2"),value:r.q2,total:c,color:o},{label:this.t("page.chart.balances.quadrant3"),value:r.q3,total:c,color:o},{label:this.t("page.chart.balances.quadrant4"),value:r.q4,total:c,color:o}])}if(e.hemisphere_balance){let r=e.hemisphere_balance,c=r.lower+r.upper,$=r.eastern+r.western;s+=this.renderBalanceSection(this.t("page.chart.balances.hemispheresTitle"),[{label:this.t("page.chart.balances.lower"),value:r.lower,total:c,color:o},{label:this.t("page.chart.balances.upper"),value:r.upper,total:c,color:o},{label:this.t("page.chart.balances.east"),value:r.eastern,total:$,color:o},{label:this.t("page.chart.balances.west"),value:r.western,total:$,color:o}])}return s}renderBalanceSection(t,e){return`
            <div class="balance-section">
                <div class="balance-title">${t}</div>
                ${e.map(s=>{let o=s.total>0?s.value/s.total*100:0,a=s.color?`background: ${s.color};`:"",r=s.color?`color: ${s.color};`:"";return`
                        <div class="balance-row">
                            <span class="balance-label" style="${r}">${s.label}</span>
                            <div class="balance-bar-container">
                                <div class="balance-bar" style="${a} width: ${o}%"></div>
                            </div>
                            <span class="balance-value" style="${r}">${s.value}</span>
                        </div>
                    `}).join("")}
            </div>
        `}formatPatternType(t){let e=`astro.pattern.${t}`,s=this.t(e);return s!==e?s:t}};Z(G,"ASPECT_SORT_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","MC","IC","DSC","Vertex","AntiVertex"]),Z(G,"ASPECT_NAME_ALIASES",{TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"}),Z(G,"ASPECT_SORT_RANK",G.ASPECT_SORT_ORDER.reduce((t,e,s)=>(t[e]=s,t),{})),Z(G,"ASPECT_TYPE_ORDER",["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"]),Z(G,"ASPECT_TYPE_RANK",G.ASPECT_TYPE_ORDER.reduce((t,e,s)=>(t[e]=s,t),{})),Z(G,"PLANET_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune"]);var ft=G;window.ChartDataRenderer=ft;(function(){"use strict";let t=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],e=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],s=e.slice(0,10),o="dispositorChainDisplayOptions",a={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},r={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},c={Aries:"Sun",Taurus:"Moon",Gemini:null,Cancer:"Jupiter",Leo:null,Virgo:"Mercury",Libra:"Saturn",Scorpio:null,Sagittarius:null,Capricorn:"Mars",Aquarius:null,Pisces:"Venus"},$=Object.fromEntries(t.map((n,l)=>[n,t[(l+6)%12]])),k={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},I={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function N(n,l){return window.FrontendI18n?.t?.(n,l)||n}function w(n){return String(n??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function F(n){return I[n]||n}function K(n){if(!n)return"—";let l=`astro.planet.${n}`,i=N(l);return i!==l?i:window.Symbols?.getPlanetNameRu?.(n)||window.Symbols?.planetNamesRu?.[n]||n}function it(n){if(!n)return"—";let l=`astro.sign.${n}`,i=N(l);return i!==l?i:window.Symbols?.signNamesRu?.[n]||n}function at(n,l=16){return window.Symbols?.getPlanetSymbolMarkup?.(n,{size:l,title:K(n)})||`<span class="astro-symbol">${w(window.Symbols?.getPlanetSymbol?.(n)||"")}</span>`}function bt(n){return[window.Symbols?.signs?.[n]||"",it(n)].filter(Boolean).join(" ")}function lt(){let n={},l=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return t.forEach(i=>{let p=k[i]||{},u=l?.[i]||{},b=F(u.ruler||p.ruler||null),P=F(u.co_ruler||p.co_ruler||null),S=F(u.exaltation||p.exaltation||null);b&&P&&b===P&&(P=null),n[i]={ruler:b,co_ruler:P,exaltation:S}}),n}function nt(n,l,i=lt()){let p=i?.[n]||{},u=i?.[$[n]]||{};return l==="exaltation"?p.exaltation||null:l==="detriment"?u.ruler||null:l==="fall"?u.exaltation||null:p.ruler||null}function yt(n,l,i,p=a){return n?p.classicalRulers&&l==="domicile"?r[n]||nt(n,l,i):p.classicalRulers&&l==="detriment"?r[$[n]]||nt(n,l,i):p.classicalRulers&&l==="exaltation"?c[n]||null:p.classicalRulers&&l==="fall"?c[$[n]]||null:nt(n,l,i):null}function $t(n){return(Array.isArray(n?.planets)?n.planets:[]).filter(i=>i?.name&&i?.sign&&e.includes(F(i.name))).map(i=>({...i,name:F(i.name)})).sort((i,p)=>e.indexOf(i.name)-e.indexOf(p.name))}function St(n,l){let i=lt(),p=$t(n),u=new Map(p.map(_=>[_.name,_])),b=[],P=new Map;p.forEach(_=>{let A=[],M=new Map,h=_,y=null,B=[];for(;h?.name&&!M.has(h.name);){M.set(h.name,A.length);let f=nt(h.sign,l,i);if(A.push({planet:h.name,sign:h.sign,ruler:f,retrograde:!!h.retrograde}),!f){y="none";break}if(!u.has(f)){y=f;break}if(f===h.name){y=f;break}h=u.get(f)}if(!y&&h?.name&&M.has(h.name)){let f=M.get(h.name);B=A.slice(f).map(T=>T.planet),y=B.join("+")}P.set(y,(P.get(y)||0)+1),b.push({start:_.name,steps:A,finalKey:y,cycle:B})});let S=[...P.entries()].filter(([_])=>_&&_!=="none").sort((_,A)=>A[1]-_[1]||_[0].localeCompare(A[0])).slice(0,4);return{chains:b,mainRulers:S}}function ct(n){if(!n)return`<p class="dispositor-empty">${w(N("page.chart.rulers.empty.noJones"))}</p>`;let l=(()=>{let p=`astro.pattern.${n.pattern_type}`,u=N(p);return u===p?n.pattern_type||"—":u})(),i=[];return Number.isFinite(Number(n.empty_arc_degree))&&i.push(N("page.chart.balances.emptyArc",{value:Number(n.empty_arc_degree).toFixed(0)})),n.handle_planet&&i.push(N("page.chart.balances.handle",{planet:K(n.handle_planet)})),n.leading_planet&&i.push(N("page.chart.balances.leading",{planet:K(n.leading_planet)})),`
            <article class="dispositor-jones-card" title="${w([N("page.chart.rulers.jonesKicker"),l,...i].join(" · "))}">
                <h4>${w(l)}</h4>
                ${i.length?`<p>${w(i.join(" · "))}</p>`:""}
            </article>
        `}function Mt(n){return n.length?`
            <div class="dispositor-main-rulers">
                ${n.map(([l,i])=>{let p=l.split("+").filter(Boolean),u=p.map(K).join(" + ");return`
                        <span class="dispositor-main-chip" title="${w(u)}">
                            ${p.map(b=>at(b,15)).join("")}
                            <b>${i}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(N("page.chart.rulers.empty.noMainRulers"))}</p>`}function pt(n,l="",i=""){let p=[K(n.planet),n.sign?bt(n.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${l}" style="${w(i)}" title="${w(p)}" aria-label="${w(p)}">
                ${at(n.planet,15)}
            </span>
        `}function ee(n){let l=[...n.steps].reverse().map((p,u)=>{let b=u===0&&n.finalKey!=="none";return pt(p,b?"dispositor-chain-node--main":"")}),i=n.steps[n.steps.length-1];return i?.ruler&&!n.steps.some(p=>p.planet===i.ruler)&&l.unshift(pt({planet:i.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${l.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function X(n){return[...new Set(n)].sort((l,i)=>{let p=e.indexOf(l),u=e.indexOf(i);return(p===-1?999:p)-(u===-1?999:u)})}function Et(n){return X(n).join("+")}function Bt(n){let l=n?.number??n?.house_number,i=Number(l);return Number.isInteger(i)?i:l}function Lt(n){let l=[...new Set(n)].map(i=>Number(i)).filter(i=>Number.isInteger(i)).sort((i,p)=>i-p);return l.length?window.Symbols?.formatHouseList?.(l,{style:"roman",separator:","})||l.map(i=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][i-1]||String(i)).join(","):""}function Rt(n,l,i,p=a){return l==="domicile"&&n?.ruler_planet&&!p.classicalRulers?F(n.ruler_planet):F(yt(n?.sign,l,i,p))}function _t(n,l,i=a){let p=lt(),u=$t(n),b=new Map(u.map(h=>[h.name,h])),P=Array.isArray(n?.houses)?n.houses:[],S=new Map,_=[];return P.forEach(h=>{let y=Rt(h,"domicile",p,i),B=Bt(h);!y||!B||(S.has(y)||S.set(y,[]),S.get(y).push(B),_.push(y))}),u.forEach(h=>{s.includes(h.name)&&_.push(h.name)}),{chains:X(_).map(h=>{let y=[],B=new Map,f=b.get(h)||{name:h,sign:null,retrograde:!1},T=null,O=[];for(;f?.name&&!B.has(f.name);){B.set(f.name,y.length);let j=f.sign?yt(f.sign,l,p,i):null;if(y.push({planet:f.name,sign:f.sign,ruler:j,retrograde:!!f.retrograde}),!j){T=f.name;break}if(!b.has(j)){T=j;break}if(j===f.name){T=j;break}f=b.get(j)}if(!T&&f?.name&&B.has(f.name)){let j=B.get(f.name);O=y.slice(j).map(U=>U.planet),T=Et(O)}return{start:h,steps:y,finalKey:T,cycle:O}}).filter(h=>!(h.steps.length===1&&!h.steps[0]?.ruler)),housesByRuler:S}}function At(n,l,i,p=""){let u=i.showHouseRulers?Lt(l.get(n.planet)||[]):"",b=[K(n.planet),n.sign?bt(n.sign):"",u?`${N("common.house")} ${u}`:"",n.terminal?N("page.chart.rulers.chainEnd"):""].filter(Boolean).join(" · "),P=Number.isFinite(n.x)&&Number.isFinite(n.y)?` style="left:${n.x}px; top:${n.y}px;"`:"",S=n.terminal?" dispositor-compact-node--terminal":"";return`
            <span
                class="dispositor-compact-node ${p}${S}"
                ${P}
                title="${w(b)}"
                aria-label="${w(b)}"
            >
                <span class="dispositor-compact-symbol">${at(n.planet,32)}</span>
                ${u?`<span class="dispositor-house-label">${w(u)}</span>`:""}
            </span>
        `}function wt(n,l,i,p,u=""){let b=l.get(n)||{planet:n,sign:null};return At(b,i,p,`dispositor-compact-node--static ${u}`.trim())}function vt(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function xt(n,l){let i=n&&n!=="none"?n.split("+").filter(Boolean):[];if(i.length<=2)return[];let p=new Set(i),u=(P=[])=>P.length===i.length&&P.every(S=>p.has(S)),b=l.find(P=>u(P.cycle||[]))?.cycle;return b?[...b]:[]}function jt(n){let l=new Map;return n.forEach(i=>{i.steps.forEach(p=>{if(!p?.planet)return;let u=l.get(p.planet)||{planet:p.planet,sign:null};l.set(p.planet,{...u,sign:u.sign||p.sign||null,retrograde:u.retrograde||!!p.retrograde,terminal:!!(u.terminal||!p.ruler)})})}),l}function Ft(n,l,i,p){let u=xt(n,l),b=new Set(u),P=jt(l),S=[...u,u[0]].filter(Boolean),_=[],A=new Set(u);return[...l].sort((h,y)=>y.steps.length-h.steps.length||String(h.start).localeCompare(String(y.start))).forEach(h=>{let y=[],B=null;for(let T of h.steps)if(y.push(T.planet),A.has(T.planet)){B=T.planet;break}let f=y.filter(T=>!A.has(T));f.length&&(f.forEach(T=>A.add(T)),_.push({planets:y,anchor:B}))}),`
            <section class="dispositor-compact-group" aria-label="${w(N("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${S.map((h,y)=>`
                            ${y>0?vt():""}
                            ${wt(h,P,i,p,`dispositor-compact-node--main${y===S.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${_.length?`
                        <div class="dispositor-cycle-branches">
                            ${_.map(h=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${h.planets.map((y,B)=>`
                                        ${B>0?vt():""}
                                        ${wt(y,P,i,p,[b.has(y)?"dispositor-compact-node--main":"",y===h.anchor&&B===h.planets.length-1?"dispositor-compact-node--repeat":""].filter(Boolean).join(" "))}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function zt(n,l,i){let p=[],u=new Set;if(n.forEach(S=>{let _=S.steps.map(A=>A.planet).join(">");u.has(_)||(u.add(_),p.push(S))}),!p.length)return`<p class="dispositor-empty">${w(N("page.chart.rulers.empty.noChains"))}</p>`;let b=new Map;return p.forEach(S=>{let _=S.finalKey||"none";b.has(_)||b.set(_,[]),b.get(_).push(S)}),`
            <div class="dispositor-compact-diagram">
                ${[...b.entries()].sort((S,_)=>{let A=new Set(S[1].flatMap(h=>h.steps.map(y=>y.planet))).size,M=new Set(_[1].flatMap(h=>h.steps.map(y=>y.planet))).size;return A-M||String(S[0]).localeCompare(String(_[0]))}).map(([S,_],A)=>{if(xt(S,_).length>2)return Ft(S,_,l,i);let h=Pt(S,_),y=`url(#dispositorCompactArrow${A})`,B=` marker-end="${y}"`,f=` marker-start="${y}" marker-end="${y}"`;return`
                        <section class="dispositor-compact-group" aria-label="${w(N("page.chart.rulers.modalTitle"))} ${A+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${h.width}px; --graph-height:${h.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${h.width} ${h.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${A}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${h.edges.map(T=>`
                                        <path d="${w(T.path)}"${B}></path>
                                    `).join("")}
                                    ${h.mutualEdges.map(T=>`
                                        <path class="dispositor-compact-mutual" d="${w(T.path)}"${f}></path>
                                    `).join("")}
                                </svg>
                                ${h.nodes.map(T=>At(T,l,i,T.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function Pt(n,l){let _=n&&n!=="none"?n.split("+").filter(Boolean):[],A=new Map,M=[],h=new Set,y=(d,g={})=>{if(!d)return null;let v=A.get(d)||{planet:d,sign:null,retrograde:!1},x=Object.prototype.hasOwnProperty.call(g,"ruler")&&!g.ruler;return A.set(d,{...v,sign:v.sign||g.sign||null,retrograde:v.retrograde||!!g.retrograde,terminal:!!(v.terminal||x)}),A.get(d)},B=(d,g)=>{let v=d?.planet,x=g?.planet;if(!v||!x||v===x)return;y(v,d),y(x,g);let C=`${v}->${x}`;h.has(C)||(h.add(C),M.push({child:v,parent:x}))};l.forEach(d=>{d.steps.forEach(g=>y(g.planet,g));for(let g=0;g<d.steps.length;g+=1){let v=d.steps[g],x=d.steps[g+1];x?B(v,x):v?.ruler&&!d.steps.some(C=>C.planet===v.ruler)&&B(v,{planet:v.ruler})}});let f=_.length?X(_):X([...A.keys()].filter(d=>!M.some(g=>g.child===d)));!f.length&&A.size&&f.push([...A.keys()][0]);let T=new Set(f),O=new Map,j=[],U=[];M.forEach(d=>{if(T.has(d.child)&&T.has(d.parent)){let g=X([d.child,d.parent]).join("<->");j.some(v=>v.key===g)||j.push({...d,key:g});return}U.push(d),O.has(d.parent)||O.set(d.parent,[]),O.get(d.parent).push(d.child)}),O.forEach((d,g)=>{O.set(g,X(d))});let J=!1,tt=(()=>{if(f.length<=2)return f;let d=(R=[])=>R.length===f.length&&R.every(z=>T.has(z)),g=l.find(R=>d(R.cycle||[]))?.cycle;if(g)return J=!0,[...g];let v=new Map(j.map(R=>[R.child,R.parent]));J=j.length>=f.length-1;let x=[],C=f[0];for(;C&&T.has(C)&&!x.includes(C);)x.push(C),C=v.get(C);return f.forEach(R=>{x.includes(R)||x.push(R)}),x})(),D=new Map,et=(d,g,v)=>{let x=8,C=(z,Y=0,V=new Set)=>{if(D.has(z))return D.get(z);if(V.has(z)){let Q={x:v+g*Y*60,y:x};return x+=58,D.set(z,Q),Q}V.add(z);let Ht=(O.get(z)||[]).filter(Q=>!T.has(Q)),gt;if(!Ht.length)gt=x,x+=58;else{let Q=Ht.map(st=>C(st,Y+1,new Set(V)));gt=(Math.min(...Q.map(st=>st.y))+Math.max(...Q.map(st=>st.y)))/2}V.delete(z);let Ct={x:v+g*Y*60,y:gt};return D.set(z,Ct),Ct};return{rootPosition:C(d,0),height:x}},ot=d=>{let g=[],v=[d],x=new Set;for(;v.length;){let C=v.pop();!C||x.has(C)||(x.add(C),g.push(C),(O.get(C)||[]).forEach(R=>{T.has(R)||v.push(R)}))}return g},m=(d,g)=>{ot(d).forEach(v=>{let x=D.get(v);x&&(x.y+=g)})};if(f.length===2){let d=f[0],g=f[1],v=et(d,-1,0),x=et(g,1,72),C=Math.max(v.rootPosition.y,x.rootPosition.y);m(d,C-v.rootPosition.y),m(g,C-x.rootPosition.y)}else{let d=8;tt.forEach((g,v)=>{et(g,-1,0);let C=ot(g).map(V=>D.get(V)).filter(Boolean);if(!C.length)return;let R=Math.min(...C.map(V=>V.y)),z=Math.max(...C.map(V=>V.y)),Y=d-R;Y&&m(g,Y),d=z+Y+(v===f.length-1?0:58)})}A.forEach((d,g)=>{D.has(g)||D.set(g,{x:0,y:8+D.size*58})});let E=Math.min(...[...D.values()].map(d=>d.x)),H=Math.min(...[...D.values()].map(d=>d.y));D.forEach(d=>{d.x=d.x-E+8,d.y=d.y-H+8});let L=[...A.values()].map(d=>({...d,isRoot:T.has(d.planet),...D.get(d.planet)||{x:8,y:8}})),q=new Map(L.map(d=>[d.planet,d])),W=d=>{let g=q.get(d.child),v=q.get(d.parent);if(!g||!v)return null;let x=1,C=g.x<v.x,R=C?g.x+42+x:g.x-x,z=C?v.x-x:v.x+42+x,Y=g.y+21,V=v.y+21;return{...d,path:`M${R},${Y} L${z},${V}`}},ht=d=>{let g=q.get(d.child),v=q.get(d.parent);if(!g||!v)return null;let x=Math.max(g.x,v.x)+42+8,C=x,R=g.y+21,z=v.y+21;if(z>=R)return{...d,path:`M${x},${R} L${C},${z}`};let Y=x+14;return{...d,path:`M${x},${R} L${Y},${R} L${Y},${z} L${C},${z}`}},mt=f.length>2&&J?tt.map((d,g)=>({child:d,parent:tt[(g+1)%tt.length]})).filter(d=>d.child&&d.parent&&d.child!==d.parent):[],Jt=[...U.map(W).filter(Boolean),...mt.map(ht).filter(Boolean)],Wt=f.length>2&&J?[]:j.map(W).filter(Boolean),Qt=Math.max(220,Math.ceil(Math.max(...L.map(d=>d.x+42))+8)),Zt=Math.max(70,Math.ceil(Math.max(...L.map(d=>d.y+58))+8));return{width:Qt,height:Zt,nodes:L,edges:Jt,mutualEdges:Wt}}function It(n){let l=[],i=new Set;n.forEach(u=>{let b=u.steps.map(P=>P.planet).join(">");i.has(b)||(i.add(b),l.push(u))});let p=new Map;return l.forEach(u=>{let b=u.finalKey||"none";p.has(b)||p.set(b,[]),p.get(b).push(u)}),l.length?`
            <div class="dispositor-diagram">
                ${[...p.entries()].map(([u,b])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Dt(u,b.length)}
                        </div>
                        ${Ot(u,b)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(N("page.chart.rulers.empty.noChains"))}</p>`}function Ot(n,l){let i=Gt(n,l);return i.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${i.edges.map(p=>`
                        <path d="${w(p.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${i.nodes.map(p=>pt(p,p.isRoot?"dispositor-chain-node--main":"",`left:${p.x}px; top:${p.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(N("page.chart.rulers.empty.noChains"))}</p>`}function Gt(n,l){let P=new Set(n&&n!=="none"?n.split("+").filter(Boolean):[]),S=new Map,_=[],A=new Set,M=new Map,h=new Map,y=(m,E={})=>{if(!m)return null;let H=S.get(m)||{planet:m,sign:null,retrograde:!1};return S.set(m,{...H,sign:H.sign||E.sign||null,retrograde:H.retrograde||!!E.retrograde}),S.get(m)},B=(m,E)=>{let H=m?.planet,L=E?.planet;if(!H||!L||H===L||P.has(H)&&P.has(L))return;y(H,m),y(L,E);let q=`${H}->${L}`;A.has(q)||(A.add(q),_.push({child:H,parent:L}),h.set(H,L),M.has(L)||M.set(L,[]),M.get(L).push(H))};l.forEach(m=>{m.steps.forEach(H=>y(H.planet,H));for(let H=0;H<m.steps.length-1;H+=1)B(m.steps[H],m.steps[H+1]);let E=m.steps[m.steps.length-1];E?.ruler&&!m.steps.some(H=>H.planet===E.ruler)&&B(E,{planet:E.ruler})}),P.size||[...S.keys()].forEach(m=>{h.has(m)||P.add(m)}),!P.size&&S.size&&P.add([...S.keys()][0]),M.forEach((m,E)=>{M.set(E,X(m))});let f=new Map,T=(m,E=0)=>{f.has(m)&&f.get(m)<=E||(f.set(m,E),(M.get(m)||[]).forEach(H=>T(H,E+1)))};X([...P]).forEach(m=>T(m,0)),S.forEach((m,E)=>{f.has(E)||f.set(E,0)});let O=24,j=new Map,U=(m,E=new Set)=>{if(j.has(m))return j.get(m);if(E.has(m)){let q=O;return O+=76,j.set(m,q),q}E.add(m);let H=M.get(m)||[],L;if(!H.length)L=O,O+=76;else{let q=H.map(W=>U(W,new Set(E)));L=(Math.min(...q)+Math.max(...q))/2}return E.delete(m),j.set(m,L),L};X([...P]).forEach(m=>U(m)),S.forEach((m,E)=>U(E));let J=[...S.values()].map(m=>({...m,isRoot:P.has(m.planet),x:24+(f.get(m.planet)||0)*128,y:j.get(m.planet)||24})),ut=new Map(J.map(m=>[m.planet,m])),tt=Math.max(0,...J.map(m=>f.get(m.planet)||0)),D=Math.max(180,O+24),et=Math.max(520,48+tt*128+44),ot=_.map(m=>{let E=ut.get(m.child),H=ut.get(m.parent);if(!E||!H)return null;let L=E.x,q=E.y+44/2,W=H.x+44,ht=H.y+44/2,mt=Math.max(W+18,L-42);return{...m,path:`M${L},${q} H${mt} V${ht} H${W}`}}).filter(Boolean);return{width:et,height:D,nodes:J,edges:ot}}function Dt(n,l){if(!n||n==="none")return`
                <span class="dispositor-diagram-group-title">${w(N("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${l}</span>
            `;let i=n.split("+").filter(Boolean),p=i.map(K).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${w(p)}">
                ${i.map(u=>at(u,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${l}</span>
        `}function qt(n){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${w(N("page.chart.rulers.modeLabel"))}">
                ${l.map(i=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${i===n?" active":""}"
                        data-dispositor-mode="${i}"
                        role="tab"
                        aria-selected="${i===n?"true":"false"}"
                    >${w(N(`astro.dignity.${i}`))}</button>
                `).join("")}
            </div>
        `}function Nt(n){return["domicile","exaltation","detriment","fall"].includes(n)?n:a.mode}function Yt(n={}){let l={};try{l=JSON.parse(window.localStorage?.getItem(o)||"{}")||{}}catch{l={}}return{...a,mode:Nt(n.mode||l.mode||a.mode),showArrowDirection:(n.showArrowDirection??l.showArrowDirection??a.showArrowDirection)!==!1,showHouseRulers:(n.showHouseRulers??l.showHouseRulers??a.showHouseRulers)!==!1,classicalRulers:(n.classicalRulers??l.classicalRulers??a.classicalRulers)===!0}}function Vt(n){try{window.localStorage?.setItem(o,JSON.stringify(n))}catch{}}function kt(n){let l=`page.chart.rulers.chainModes.${n}`,i=N(l);return i!==l?i:N(n==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${n}`)}function Kt(n){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${w(kt(n.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${w(N("page.chart.rulers.options.chainType"))}">
                        ${l.map(i=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${w(i)}"
                                    data-dispositor-option="mode"
                                    ${i===n.mode?"checked":""}
                                >
                                <span>${w(kt(i))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${n.showHouseRulers?"checked":""}>
                        <span>${w(N("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${n.classicalRulers?"checked":""}>
                        <span>${w(N("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function dt(n,l,i){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <h4>${w(N("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Kt(i)}
                </div>
                ${zt(n,l,i)}
            </div>
        `}function Xt(n,l,i,p){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${w(N("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${w(N("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${w(N("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${ct(n?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${dt(l,i,p)}
                </div>
            </div>
        `}function Ut(n,l={},i="domicile"){rt();let{chains:p,mainRulers:u}=St(n,i),b=document.createElement("div");b.className="dispositor-modal-overlay",b.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${w(N("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${w(N("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${qt(i)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${w(N("page.chart.rulers.mainKicker"))}</span>
                    ${Mt(u)}
                </div>
                ${It(p)}
            </div>
        `,document.body.appendChild(b),document.body.classList.add("dispositor-modal-open"),b.addEventListener("click",P=>{let S=P.target;if(S===b||S instanceof Element&&S.closest("[data-dispositor-close]")){rt();return}if(!(S instanceof Element))return;let _=S.closest(".dispositor-mode-tab[data-dispositor-mode]");_&&Ut(n,l,_.dataset.dispositorMode||i)}),b.querySelector("[data-dispositor-close]")?.focus()}function rt(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function Tt(n,l,i={}){let p=typeof n=="string"?document.getElementById(n):n;if(!p)return;let u=Yt(i),{chains:b,housesByRuler:P}=_t(l,u.mode,u);i.section==="jones"?p.innerHTML=`<div class="dispositor-panel">${ct(l?.cosmogram_pattern)}</div>`:i.section==="scheme"?p.innerHTML=`<div class="dispositor-panel">${dt(b,P,u)}</div>`:p.innerHTML=i.layout==="tabs"?Xt(l,b,P,u):`
                    <div class="dispositor-panel">
                        ${ct(l?.cosmogram_pattern)}
                        ${dt(b,P,u)}
                    </div>
                `,p.querySelectorAll("[data-dispositor-tab]").forEach(A=>{A.addEventListener("click",()=>{let M=A.dataset.dispositorTab;p.querySelectorAll("[data-dispositor-tab]").forEach(h=>{let y=h.dataset.dispositorTab===M;h.classList.toggle("active",y),h.setAttribute("aria-selected",y?"true":"false")}),p.querySelectorAll("[data-dispositor-panel]").forEach(h=>{h.classList.toggle("active",h.dataset.dispositorPanel===M)})})});let S=p.querySelector("[data-dispositor-options-toggle]"),_=p.querySelector("[data-dispositor-options-menu]");S?.addEventListener("click",A=>{A.stopPropagation();let M=_&&!_.classList.contains("hidden");_?.classList.toggle("hidden",M),S.setAttribute("aria-expanded",M?"false":"true")}),_?.addEventListener("click",A=>A.stopPropagation()),_?.querySelectorAll("[data-dispositor-option]").forEach(A=>{A.addEventListener("change",()=>{let M={...u};A.dataset.dispositorOption==="mode"?M.mode=Nt(A.value):M[A.dataset.dispositorOption]=A.checked,Vt(M),Tt(p,l,M)})})}window.DispositorChains={render:Tt,buildChains:St,buildHouseDispositorScheme:_t,buildCompactLayout:Pt,closeModal:rt},document.addEventListener("keydown",n=>{n.key==="Escape"&&(rt(),document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",n=>{n.target instanceof Element&&n.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))})})();
