import{c as J}from"./chunk-IZUYVIPG.js";var I=class I{constructor(t={}){let e=(s,r,n)=>s||(r?document.getElementById(r):document.getElementById(n));this.planetsTable=e(t.planetsTable,t.planetsTableId,"planetsTable"),this.housesTable=e(t.housesTable,t.housesTableId,"housesTable"),this.aspectsTable=e(t.aspectsTable,t.aspectsTableId,"aspectsTable"),this.aspectGridContainer=e(t.aspectGridContainer,t.aspectGridContainerId,"aspectGridContainer"),this.configsContainer=e(t.configsContainer,t.configsContainerId,"configurationsContainer"),this.stelliumsContainer=e(t.stelliumsContainer,t.stelliumsContainerId,null),this.balancesContainer=e(t.balancesContainer,t.balancesContainerId,"balancesContainer"),this.dignitiesContainer=e(t.dignitiesContainer,t.dignitiesContainerId,"dignitiesContainer"),this.aspectSortHeadersSelector=t.aspectSortHeadersSelector||"#aspects-list th.sortable[data-sort]",this.aspectTypeFilter="all",this.aspectPlanetFilter=null,this.aspectSortState={field:"planet",ascending:!0},this.aspectSortHeaders=[],this.hoveredAspectKey=null,this.showSpeed=!0,this.showStationary=!0,this.showApplyingSeparating=!1,this.showAspectText=!1,this.showSpeedColumn=t.showSpeedColumn!==!1,this.showHouseColumn=t.showHouseColumn!==!1,this.onPlanetsRendered=typeof t.onPlanetsRendered=="function"?t.onPlanetsRendered:null,this.fixedStarsData=null,this.showFixedStarBadges=!1,this.houseNumberStyle=Symbols?.readSavedHouseNumberStyle?.()||"arabic",this.visualPreferences=window.AstroPreferences?.getAccountVisualPreferences?.()||null,this.initAspectSortHeaders()}t(t,e){return window.FrontendI18n?.t?.(t,e)||t}planetName(t){let e=this.getCuspHouseNumber(t);if(e){let n=Symbols?.formatHouseLabel?.(e)||String(e);return this.t("page.chart.houseCusp",{house:n})}let s=`astro.planet.${t}`,r=this.t(s);return r===s?Symbols.getPlanetNameRu?.(t)||Symbols.planetNamesRu[t]||t:r}signName(t){let e=`astro.sign.${t}`,s=this.t(e);return s===e?Symbols.signNamesRu[t]||t:s}aspectName(t){let e=`astro.aspect.${t}`,s=this.t(e);return s===e?Symbols.aspectNamesRu[t]||t:s}getPlanetSymbol(t){return Symbols.getPlanetSymbol?.(t)||Symbols.planets?.[this.normalizeAspectBodyName(t)]||Symbols.planets?.[t]||""}getPlanetSymbolMarkup(t,e={}){let s=this.getCuspHouseNumber(t);if(s){let r=Symbols?.formatHouseLabel?.(s)||String(s),n=this.escapeHtml(e.title||this.planetName(t));return`<span class="aspect-cusp-symbol" title="${n}" aria-label="${n}">${this.escapeHtml(r)}</span>`}return Symbols.getPlanetSymbolMarkup?.(t,e)||`<span class="astro-symbol" aria-hidden="true">${this.escapeHtml(this.getPlanetSymbol(t))}</span>`}getCuspHouseNumber(t){let e=/^Cusp([1-9]|1[0-2])$/.exec(String(t||""));return e?Number(e[1]):null}getAspectSymbol(t){return Symbols.getAspectDisplay?.(t)||Symbols.aspects?.[t]||"•"}escapeHtml(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}retrogradeTitle(){let t="page.natalFull.legend.motion.retrograde",e=this.t(t);return e===t?"Retrograde":e}stationaryTitle(){let t="page.natalFull.legend.motion.stationary",e=this.t(t);return e===t?"Stationary":e}dignityTitle(t){if(!t||t==="neutral")return"";let e=`astro.dignity.${t}`,s=this.t(e);return s===e?t:s}dignityShortLabel(t){let e=String(this.dignityTitle(t)||"").trim();return e?Array.from(e)[0].toUpperCase():""}getApplyingSeparatingLabel(t){if(!t)return"";if(typeof t.applying=="boolean")return t.applying?this.t("page.chart.settings.aspectPhase.applying"):this.t("page.chart.settings.aspectPhase.separating");let e=String(t.applying_separating||t.phase||"").trim();if(!e)return"";let s=e.toLowerCase();return s.includes("applic")||s.includes("сход")?this.t("page.chart.settings.aspectPhase.applying"):s.includes("separ")||s.includes("расход")?this.t("page.chart.settings.aspectPhase.separating"):e}getApplyingSeparatingShortLabel(t){if(!t)return"";if(typeof t.applying=="boolean")return t.applying?"сход.":"расх.";let e=String(t.applying_separating||t.phase||"").trim();if(!e)return"";let s=e.toLowerCase();return s.includes("applic")||s.includes("сход")?"сход.":s.includes("separ")||s.includes("расход")?"расх.":e}retroIndicatorHtml(t,e=""){if(!t)return"";let s=e?` ${e}`:"",r=this.escapeHtml(this.retrogradeTitle());return`<span class="retro-indicator${s}" title="${r}" aria-label="${r}">R</span>`}stationaryIndicatorHtml(t,e=""){if(!t?.is_stationary)return"";let s=e?` ${e}`:"",r=this.escapeHtml(this.stationaryTitle());return`<span class="planet-status-badge planet-status-badge--stationary${s}" title="${r}" aria-label="${r}">S</span>`}dignityIndicatorHtml(t,e=""){let s=String(t?.dignity||"").trim();if(!s||s==="neutral")return"";let r=this.dignityTitle(s),n=this.dignityShortLabel(s);if(!r||!n)return"";let i=e?` ${e}`:"",c=this.escapeHtml(r);return`
            <span class="planet-status-badge planet-status-badge--dignity planet-status-badge--${this.escapeHtml(s)}${i}" title="${c}" aria-label="${c}">
                ${this.escapeHtml(n)}
            </span>
        `}solarBadgeTitle(t){let e=`astro.feature.short.${t}`,s=this.t(e);return s===e?t:s}sunRelationIndicatorHtml(t,e=""){let s=String(t?.sun_relation||"").trim(),n={cazimi:"Cz",combust:"Cb",under_rays:"Ur"}[s];if(!n)return"";let i=e?` ${e}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--sun-relation planet-status-badge--${this.escapeHtml(s)}${i}" title="${c}" aria-label="${c}">${n}</span>`}solarPhaseIndicatorHtml(t,e=""){let s=String(t?.solar_phase||"").trim(),n={oriental:"Or",occidental:"Oc"}[s];if(!n)return"";let i=e?` ${e}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--solar-phase planet-status-badge--${this.escapeHtml(s)}${i}" title="${c}" aria-label="${c}">${n}</span>`}outOfBoundsIndicatorHtml(t,e=""){if(!t?.out_of_bounds)return"";let s=e?` ${e}`:"",r="astro.feature.short.out_of_bounds",n=this.t(r),i=this.escapeHtml(n&&n!==r?n:"Out of bounds");return`<span class="planet-status-badge planet-status-badge--oob${s}" title="${i}" aria-label="${i}">OOB</span>`}buildRetrogradeLookup(t=[]){let e=new Map;return t.forEach(s=>{if(!s?.name)return;let r=this.normalizeAspectBodyName(s.name);e.set(r,!!s.retrograde)}),e}isBodyRetrograde(t,e=null){if(!t)return!1;let s=this.normalizeAspectBodyName(String(t));return(e||this.buildRetrogradeLookup(this.chartData?.planets||[])).get(s)===!0}buildPlanetHouseLookup(t=[]){let e=new Map;return t.forEach(s=>{!s?.name||s.house==null||s.house===""||e.set(this.normalizeAspectBodyName(s.name),s.house)}),e}buildHouseRulerGroups(t,e=new Map,s=null){if(Array.isArray(t?.ruler_groups)&&t.ruler_groups.length)return t.ruler_groups.map(u=>({included:u?.scope==="included",entries:(u?.entries||[]).filter(v=>{let y=this.normalizeAspectBodyName(v?.planet);return y&&(!(s instanceof Set)||s.has(y))}).map(v=>({planet:v.planet,house:v.house??e.get(this.normalizeAspectBodyName(v.planet))??null}))})).filter(u=>u.entries.length);let r=[],i=[t?.ruler_planet,...Array.isArray(t?.co_rulers)?t.co_rulers:[]],c=new Set;return i.forEach((u,v)=>{if(!u)return;let y=this.normalizeAspectBodyName(u);s instanceof Set&&!s.has(y)||c.has(y)||(c.add(y),r.push({planet:u,house:v===0&&t?.ruler_in_house!=null&&t?.ruler_in_house!==""?t.ruler_in_house:e.get(y)??null}))}),r.length?[{entries:r,included:!1}]:[]}renderHouseRulerGroup(t,e=null){return t?.entries?.length?`
            <div class="${t.included?"house-ruler-group house-ruler-group--included":"house-ruler-group"}">
                ${t.entries.map(r=>{let n=this.planetName(r.planet),i=r.house!=null&&r.house!==""?this.formatHouseNumber(r.house):"",c=[n];return i&&c.push(`${this.t("common.house")} ${i}`),`
                        <div class="house-ruler-row" title="${this.escapeHtml(c.join(" • "))}">
                            <span class="house-ruler-symbol-wrap">
                                ${this.getPlanetSymbolMarkup(r.planet,{size:18,title:n})}
                                ${this.retroIndicatorHtml(this.isBodyRetrograde(r.planet,e),"retro-indicator--micro house-ruler-retro")}
                            </span>
                            <span class="house-ruler-house">${this.escapeHtml(i||"—")}</span>
                        </div>
                    `}).join("")}
            </div>
        `:""}initAspectSortHeaders(){this.aspectSortHeaders=[...document.querySelectorAll(this.aspectSortHeadersSelector)],this.aspectSortHeaders.forEach(t=>{t.addEventListener("click",()=>{this.toggleAspectSort(t.dataset.sort)})}),this.updateAspectSortHeaders()}toggleAspectSort(t){t&&(this.aspectSortState.field===t?this.aspectSortState.ascending=!this.aspectSortState.ascending:(this.aspectSortState.field=t,this.aspectSortState.ascending=!0),this.updateAspectSortHeaders(),this.reRenderAspects())}updateAspectSortHeaders(){this.aspectSortHeaders.forEach(t=>{let e=this.aspectSortState.field===t.dataset.sort;t.classList.toggle("sort-active",e),t.classList.toggle("sort-desc",e&&!this.aspectSortState.ascending),t.setAttribute("aria-sort",e?this.aspectSortState.ascending?"ascending":"descending":"none")})}setAspectTypeFilter(t){let e=t==="major"||t==="minor"?t:"all";e!==this.aspectTypeFilter&&(this.aspectTypeFilter=e,this.reRenderAspects())}setAspectPlanetFilter(t){let e=t?this.normalizeAspectBodyName(String(t)):null;e!==this.aspectPlanetFilter&&(this.aspectPlanetFilter=e,this.reRenderAspects())}setDisplayPreferences(t={}){Object.prototype.hasOwnProperty.call(t,"showSpeed")&&(this.showSpeed=t.showSpeed!==!1),Object.prototype.hasOwnProperty.call(t,"showStationary")&&(this.showStationary=t.showStationary!==!1),Object.prototype.hasOwnProperty.call(t,"showApplyingSeparating")&&(this.showApplyingSeparating=t.showApplyingSeparating===!0),Object.prototype.hasOwnProperty.call(t,"showAspectText")&&(this.showAspectText=t.showAspectText===!0),this.updatePlanetsTableColumns(),this.chartData&&(this.renderPlanets(this.chartData.planets),this.renderAspects(this.chartData.aspects))}setHouseNumberStyle(t){let e=Symbols?.normalizeHouseNumberStyle?.(t)||"arabic";e!==this.houseNumberStyle&&(this.houseNumberStyle=e,this.chartData&&this.render(this.chartData))}updatePlanetsTableColumns(){let t=this.planetsTable?.closest("table");if(!t)return;t.classList.toggle("planets-table--speed-hidden",!this.showSpeed),t.classList.toggle("planets-table--speed-column-hidden",!this.showSpeedColumn),t.classList.toggle("planets-table--house-column-hidden",!this.showHouseColumn);let e=window.AstroPreferences?.getDegreeFormat?.()||"DEGREES_ONLY";t.classList.toggle("planets-table--seconds",e==="DEGREES_MINUTES_SECONDS")}setVisualPreferences(t={}){this.visualPreferences=window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(t||{}):t||null,this.chartData&&this.render(this.chartData)}setFixedStarsData(t,e={}){this.fixedStarsData=t||null,this.showFixedStarBadges=e.showBadges===!0&&!!t,this.chartData&&this.renderPlanets(this.chartData.planets)}reRenderAspects(){this.chartData&&this.renderAspects(this.chartData.aspects)}render(t){this.chartData=t,this.renderPlanets(t.planets),this.renderHouses(t.houses),this.renderAspects(t.aspects),this.renderAspectGrid(t.aspects,t.planets),this.renderDignities(t.planets),this.renderConfigurations(t.aspect_configurations,t.stelliums),this.renderBalances(t.balances,t.cosmogram_pattern)}static normalizeBodyName(t){return window.Symbols?.normalizeBodyName?.(t)||t}renderPlanets(t){if(!t||!this.planetsTable)return;this.updatePlanetsTableColumns();let e=[...t].sort((s,r)=>{let n=I.PLANET_ORDER.indexOf(I.normalizeBodyName(s.name)),i=I.PLANET_ORDER.indexOf(I.normalizeBodyName(r.name));return(n===-1?999:n)-(i===-1?999:i)});this.planetsTable.innerHTML=e.map(s=>{let r=this.formatAstroCoordinate(s),n=this.createPlanetIconSVG(s),i=this.renderPlanetSpeedChip(s),c=this.renderFixedStarSymbolBadge(s),u=[this.showStationary?this.stationaryIndicatorHtml(s,"planet-status-badge--small"):"",this.retroIndicatorHtml(s.retrograde,"retro-indicator--small")].filter(Boolean).join(""),v=[this.dignityIndicatorHtml(s,"planet-status-badge--small"),this.sunRelationIndicatorHtml(s,"planet-status-badge--small"),this.solarPhaseIndicatorHtml(s,"planet-status-badge--small"),this.outOfBoundsIndicatorHtml(s,"planet-status-badge--small")].filter(Boolean).join("");return`
                <tr id="row-${s.name}" data-planet="${s.name}">
                    <td class="symbol-cell">
                        <div class="planet-symbol-cell">
                            <span class="planet-icon-wrap">
                                ${n}
                                ${c}
                            </span>
                            ${u?`<span class="planet-motion-stack">${u}</span>`:""}
                            <span class="planet-special-status-column" aria-hidden="true">${v}</span>
                        </div>
                    </td>
                    <td class="mono">
                        <div class="planet-position-main">${r}</div>
                    </td>
                    ${this.showSpeedColumn?`<td class="planet-speed-cell mono">${this.showSpeed?i:""}</td>`:""}
                    ${this.showHouseColumn?`<td class="mono">${this.escapeHtml(this.formatHouseNumber(s.house))}</td>`:""}
                </tr>
            `}).join(""),this.onPlanetsRendered?.(this)}getFixedStarContactsForPlanet(t){if(!this.showFixedStarBadges||!t)return[];let e=this.normalizeAspectBodyName(t);return(this.fixedStarsData?.conjunctions||[]).filter(s=>this.normalizeAspectBodyName(s?.object)===e).sort((s,r)=>Number(s.orb||0)-Number(r.orb||0))}findFixedStarInfo(t){let e=t?.star;return e?t?.star_info||(this.fixedStarsData?.stars||[]).find(s=>s?.name===e)||null:t?.star_info||null}fixedStarTooltipHtml(t){let e=this.findFixedStarInfo(t)||{},s=e.degree_in_sign_formatted&&e.sign?`${e.degree_in_sign_formatted} ${this.signName(e.sign)}`:t?.star_position||"",r=e.designation||"",n=e.magnitude!==null&&e.magnitude!==void 0?`m ${e.magnitude}`:"",i=e.nature||t?.nature||"",c=t?.object?this.planetName(t.object):"",u=t?.object_degree_in_sign_formatted&&t?.object_sign?`${t.object_degree_in_sign_formatted} ${this.signName(t.object_sign)}`:t?.object_position||"",v=Number(t?.orb),y=Number.isFinite(v)?`${v.toFixed(2)}°`:"";return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(e.name||t?.star||"")}</div>
            ${s?`<div>${this.escapeHtml(s)}</div>`:""}
            ${r?`<div>${this.escapeHtml(r)}</div>`:""}
            ${n?`<div>${this.escapeHtml(n)}</div>`:""}
            ${i?`<div>${this.escapeHtml(i)}</div>`:""}
            ${c?`<div class="fixed-star-tooltip-contact">${this.escapeHtml(c)} ${this.escapeHtml(u)}${y?` · ${this.escapeHtml(y)}`:""}</div>`:""}
        `.trim()}renderFixedStarSymbolBadge(t){let e=this.getFixedStarContactsForPlanet(t?.name);if(!e.length)return"";let s=this.fixedStarSummaryTooltipHtml(e),r=this.t("page.chart.settings.fixedStars.title"),n=e.length>1?`${r} (${e.length})`:r;return`
            <span
                class="fixed-star-badge fixed-star-badge--icon"
                role="img"
                tabindex="0"
                aria-label="${this.escapeHtml(n)}"
                data-fixed-star-tooltip="${this.escapeHtml(s)}"
            >✶</span>
        `}fixedStarSummaryTooltipHtml(t){if(t.length===1)return this.fixedStarTooltipHtml(t[0]);let e=this.t("page.chart.settings.fixedStars.title"),s=t.map(r=>{let n=this.findFixedStarInfo(r)||{},i=n.name||r?.star||"",c=n.degree_in_sign_formatted&&n.sign?`${n.degree_in_sign_formatted} ${this.signName(n.sign)}`:r?.star_position||"",u=Number(r?.orb),v=Number.isFinite(u)?`${u.toFixed(2)}°`:"";return`
                <div class="fixed-star-tooltip-row">
                    <span class="fixed-star-tooltip-star">✶ ${this.escapeHtml(i)}</span>
                    ${c?`<span class="fixed-star-tooltip-pos">${this.escapeHtml(c)}</span>`:""}
                    ${v?`<span class="fixed-star-tooltip-orb">${this.escapeHtml(v)}</span>`:""}
                </div>
            `}).join("");return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(e)}</div>
            <div class="fixed-star-tooltip-list">${s}</div>
        `.trim()}renderPlanetSpeedChip(t){if(!t)return"";let e=this.resolveSpeedPercent(t);if(e!==null){if(!Number.isFinite(e))return"";let s="";return e<10?s=" planet-meta-chip--speed-slow":e>120&&(s=" planet-meta-chip--speed-fast"),`<span class="planet-meta-chip${s}">${Math.round(e)}%</span>`}if(t.speed!==void 0&&t.speed!==null){let s=Number(t.speed);if(!Number.isFinite(s))return"";if(s===0)return'<span class="planet-meta-chip planet-meta-chip--speed-slow">0%</span>';let r=this.formatCompactSpeed(s),n=this.formatSpeedValue(s),i=this.t("page.natalFull.units.degPerDay",{value:n});return`<span class="planet-meta-chip" title="${this.escapeHtml(i)}">${this.escapeHtml(r)}</span>`}return""}resolveSpeedPercent(t){let e=Number(t?.speed_percent);if(Number.isFinite(e))return e;let s={Proserpina:.001478},r=Number(t?.speed),n=s[t?.name];return!Number.isFinite(r)||!n?null:Math.round(Math.abs(r)/n*1e4)/100}formatSpeedValue(t){let e=Math.abs(Number(t));return!Number.isFinite(e)||e===0?"0.00":e>=1?e.toFixed(2):e>=.1?e.toFixed(3):e>=.01?e.toFixed(4):e.toFixed(5)}formatCompactSpeed(t){let e=Math.abs(Number(t));if(!Number.isFinite(e)||e===0)return"0°/д";if(e>=1)return`${e.toFixed(2)}°/д`;let s=e*60;return s>=1?`${s.toFixed(1)}′/д`:`${(s*60).toFixed(1)}″/д`}renderHouses(t){if(!t||!this.housesTable)return;let e=this.buildRetrogradeLookup(this.chartData?.planets||[]),s=this.buildPlanetHouseLookup(this.chartData?.planets||[]),r=new Set(s.keys());this.housesTable.innerHTML=t.map(n=>{let i=[1,4,7,10].includes(n.number),c=this.formatAstroCoordinate(n),u=n.included_sign||"",v=u&&Symbols.signs[u]||"",y=u?this.signName(u):"",A=u?`${this.t("page.natalFull.table.houses.included")}: ${y}`:"",D=this.buildHouseRulerGroups(n,s,r);return`
                <tr id="row-house-${n.number}" class="${i?"house-angular":""}">
                    <td class="mono">${this.escapeHtml(this.formatHouseNumber(n.number))}</td>
                    <td class="mono house-sign-cell">
                        <div class="house-sign-main">${c}</div>
                        ${u?`
                            <div class="house-sign-meta" title="${this.escapeHtml(A)}">
                                <span class="house-sign-badge">${this.escapeHtml(this.t("astro.feature.short.intercepted"))}</span>
                                <span class="astro-symbol">${v}</span>
                            </div>
                        `:""}
                    </td>
                    <td class="mono house-ruler-cell">
                        ${D.length?D.map(F=>this.renderHouseRulerGroup(F,e)).join(""):"—"}
                    </td>
                </tr>
            `}).join("")}formatAstroCoordinate(t){if(window.LocaleFormatters?.formatAstroCoordinate)return window.LocaleFormatters.formatAstroCoordinate(t,{signSymbol:Symbols?.signs?.[t?.sign],signClass:"astro-symbol"});let e=Number(t?.degree_in_sign);if(!Number.isFinite(e))return"";let s=Math.floor(e),r=Math.floor((e-s)*60),n=Symbols?.signs?.[t?.sign]||t?.sign||"",i=n?`<span class="astro-symbol">${n}</span>`:"";return[`${s}°`,i,`${String(r).padStart(2,"0")}'`].filter(Boolean).join(" ")}createPlanetIconSVG(t){let e=Symbols.signElements[t.sign],s=window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(t.name,e,this.visualPreferences):Symbols.elementColors[e]||"#374151";if(window.AstroGlyphs?.hasPlanetIcon?.(t.name))return`
                <span class="planet-icon-svg">
                    ${window.AstroGlyphs.createPlanetSymbolMarkup(t.name,{size:28,color:s,title:this.planetName(t.name)})}
                </span>
            `;let n=this.getPlanetSymbol(t.name)||t.name.charAt(0),c=22*(Symbols.planetGlyphScale?.[t.name]||1);return`
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${(14+c*.36).toFixed(2)}" text-anchor="middle" font-size="${c.toFixed(2)}" font-weight="600" fill="${s}" class="planet-symbol-text">${n}</text>
                </svg>
            </span>
        `}formatDegreeShort(t){let e=Math.floor(t),s=Math.floor((t-e)*60);return`${e}°${s.toString().padStart(2,"0")}'`}normalizeAspectBodyName(t){return I.ASPECT_NAME_ALIASES[t]||t}formatHouseNumber(t){return t==null||t===""?"":Symbols?.formatHouseLabel?.(t,{style:this.houseNumberStyle})||String(t)}getAspectRank(t){let e=this.normalizeAspectBodyName(t);return I.ASPECT_SORT_RANK[e]??999}normalizeAspectForDisplay(t){let e=Number.isInteger(t.left_rank)?t.left_rank:this.getAspectRank(t.planet_1),s=Number.isInteger(t.right_rank)?t.right_rank:this.getAspectRank(t.planet_2),r=t.left_planet||t.planet_1,n=t.right_planet||t.planet_2,i=e,c=s;return(!t.left_planet||!t.right_planet)&&(s<e||e===s&&String(t.planet_2)<String(t.planet_1))&&(r=t.planet_2,n=t.planet_1,i=s,c=e),{...t,left_planet:this.normalizeAspectBodyName(r),right_planet:this.normalizeAspectBodyName(n),left_rank:i,right_rank:c}}getAspectTypeRank(t){return I.ASPECT_TYPE_RANK[t]??999}buildAspectKey(t,e){let s=this.normalizeAspectBodyName(t),r=this.normalizeAspectBodyName(e),n=this.getAspectRank(s),i=this.getAspectRank(r);return n<i?`${s}-${r}`:i<n?`${r}-${s}`:s<=r?`${s}-${r}`:`${r}-${s}`}getAspectKey(t){if(!t)return null;let e=t.left_planet||t.planet_1,s=t.right_planet||t.planet_2;return!e||!s?null:this.buildAspectKey(e,s)}compareAspectsByPlanet(t,e){return t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.orb!==e.orb?t.orb-e.orb:t.right_rank!==e.right_rank?t.right_rank-e.right_rank:this.getAspectTypeRank(t.aspect_type)-this.getAspectTypeRank(e.aspect_type)}compareAspectsByType(t,e){let s=this.getAspectTypeRank(t.aspect_type)-this.getAspectTypeRank(e.aspect_type);return s!==0?s:t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.right_rank!==e.right_rank?t.right_rank-e.right_rank:t.orb-e.orb}compareAspectsByOrb(t,e){return t.is_major!==e.is_major?Number(e.is_major)-Number(t.is_major):t.orb!==e.orb?t.orb-e.orb:t.left_rank!==e.left_rank?t.left_rank-e.left_rank:t.right_rank-e.right_rank}renderAspectTypeCell(t){let s=`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(t.aspect_type,this.visualPreferences,t.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(t.aspect_type)}</span>`,r=this.showAspectText?` ${this.aspectName(t.aspect_type)}`:"";return`${s}${r}`}renderAspectTypeIcon(t){return`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(t.aspect_type,this.visualPreferences,t.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(t.aspect_type)}</span>`}renderAspectPairCell(t){if(!t)return"";let e=this.escapeHtml(this.planetName(t.left_planet)),s=this.escapeHtml(this.planetName(t.right_planet)),r=this.escapeHtml(this.aspectName(t.aspect_type));return`
            <span class="aspect-chip" aria-label="${e} ${r} ${s}">
                <span class="aspect-chip__body" title="${e}">${this.getPlanetSymbolMarkup(t.left_planet,{size:15,title:this.planetName(t.left_planet)})}</span>
                <span class="aspect-chip__type" title="${r}">${this.renderAspectTypeIcon(t)}</span>
                <span class="aspect-chip__body" title="${s}">${this.getPlanetSymbolMarkup(t.right_planet,{size:15,title:this.planetName(t.right_planet)})}</span>
            </span>
        `}renderAspects(t){if(!this.aspectsTable)return;if(!t||t.length===0){this.aspectsTable.innerHTML="";return}let e=t;this.aspectTypeFilter==="major"?e=e.filter(n=>n.is_major):this.aspectTypeFilter==="minor"&&(e=e.filter(n=>!n.is_major)),this.aspectPlanetFilter&&(e=e.filter(n=>{let i=this.normalizeAspectBodyName(n.planet_1),c=this.normalizeAspectBodyName(n.planet_2);return i===this.aspectPlanetFilter||c===this.aspectPlanetFilter}));let r=[...e.map(n=>this.normalizeAspectForDisplay(n))].sort((n,i)=>{let c=0;switch(this.aspectSortState.field){case"type":c=this.compareAspectsByType(n,i);break;case"orb":c=this.compareAspectsByOrb(n,i);break;case"planet":default:c=this.compareAspectsByPlanet(n,i);break}return this.aspectSortState.ascending?c:-c});if(r.length===0){this.aspectsTable.innerHTML='<tr><td colspan="3" class="text-muted">—</td></tr>';return}this.aspectsTable.innerHTML=r.map(n=>{let i=this.getAspectKey(n),c=this.showApplyingSeparating?this.getApplyingSeparatingShortLabel(n):"";return`
                <tr data-aspect="${i||""}" data-aspect-key="${i||""}" data-aspect-type="${this.escapeHtml(n.aspect_type||"")}">
                    <td>${this.renderAspectPairCell(n)}</td>
                    <td class="aspect-phase-cell">${c?this.escapeHtml(c):"—"}</td>
                    <td class="mono">${n.orb.toFixed(2)}°</td>
                </tr>
            `}).join("")}renderGridHeaderBody(t){let e=this.getPlanetSymbolMarkup(t.name,{size:15,title:this.planetName(t.name)}),s=this.retroIndicatorHtml(t.retrograde,"retro-indicator--micro");return`<span class="aspect-grid-body">${e}${s}</span>`}renderAspectGrid(t,e){if(!this.aspectGridContainer||!t||!e)return;let s=this.getAspectRank("PartOfFortune"),r=new Map;e.forEach(u=>{let v=this.normalizeAspectBodyName(u.name);this.getAspectRank(v)>s||r.has(v)||r.set(v,{...u,name:v})});let n=[...r.values()].sort((u,v)=>this.getAspectRank(u.name)-this.getAspectRank(v.name)),i={};t.forEach(u=>{let v=this.getAspectKey(u);v&&(i[v]=u)});let c='<table class="aspect-grid">';c+="<tr><th></th>",n.forEach(u=>{c+=`<th title="${this.planetName(u.name)}">${this.renderGridHeaderBody(u)}</th>`}),c+="</tr>",n.forEach((u,v)=>{c+=`<tr><th title="${this.planetName(u.name)}">${this.renderGridHeaderBody(u)}</th>`,n.forEach((y,A)=>{if(A>=v)c+="<td></td>";else{let D=this.buildAspectKey(u.name,y.name),F=i[D];if(F){let it=this.getAspectSymbol(F.aspect_type),Q=F.harmonic_type==="harmonious"?"grid-harmonious":F.harmonic_type==="tense"?"grid-tense":"grid-neutral";c+=`<td class="${Q}" data-aspect-key="${D}" data-aspect-type="${this.escapeHtml(F.aspect_type||"")}" title="${this.aspectName(F.aspect_type)} ${F.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(F.aspect_type,this.visualPreferences,F.harmonic_type):"#9ca3af"}">${it}</span></td>`}else c+="<td>–</td>"}}),c+="</tr>"}),c+="</table>",this.aspectGridContainer.innerHTML=c}clearHoveredAspect(){this.hoveredAspectKey=null,this.aspectsTable&&this.aspectsTable.querySelectorAll("tr.aspect-hover-row").forEach(t=>{t.classList.remove("aspect-hover-row")}),this.aspectGridContainer&&this.aspectGridContainer.querySelectorAll("td.grid-hover").forEach(t=>{t.classList.remove("grid-hover")})}setHoveredAspect(t,e={}){let s=e.surface==="grid"?"grid":"table";if(this.clearHoveredAspect(),!!t){if(this.hoveredAspectKey=t,s==="table"&&this.aspectsTable){let r=this.aspectsTable.querySelector(`tr[data-aspect-key="${t}"]`);r&&r.classList.add("aspect-hover-row");return}if(s==="grid"&&this.aspectGridContainer){let r=this.aspectGridContainer.querySelector(`td[data-aspect-key="${t}"]`);r&&r.classList.add("grid-hover")}}}renderDignities(t){if(!this.dignitiesContainer||!t)return;let e={domicile:{label:this.t("astro.dignity.domicile"),class:"dignity-domicile",icon:"🏠"},exaltation:{label:this.t("astro.dignity.exaltation"),class:"dignity-exaltation",icon:"⬆"},detriment:{label:this.t("astro.dignity.detriment"),class:"dignity-detriment",icon:"⬇"},fall:{label:this.t("astro.dignity.fall"),class:"dignity-fall",icon:"💫"},neutral:{label:"",class:"",icon:""}},s=t.filter(n=>n.dignity&&n.dignity!=="neutral");if(s.length===0){this.dignitiesContainer.innerHTML=`<p class="text-muted">${this.t("page.chart.empty.noDignities")}</p>`;return}let r='<div class="dignities-list">';s.forEach(n=>{let i=e[n.dignity]||e.neutral;r+=`
                <div class="dignity-item ${i.class}">
                    <span class="dignity-planet">${this.getPlanetSymbolMarkup(n.name,{size:16,title:this.planetName(n.name)})} ${this.planetName(n.name)}</span>
                    <span class="dignity-label">${i.icon} ${i.label}</span>
                </div>
            `}),r+="</div>",this.dignitiesContainer.innerHTML=r}renderConfigurations(t,e){if(!this.configsContainer&&!this.stelliumsContainer)return;let s=!!this.stelliumsContainer,r="",n="";if(t&&t.length>0){let i=[...t].sort((c,u)=>{let v=c.strength_score||0;return(u.strength_score||0)-v});r+=`<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t("page.chart.configurations.title")}</h3>`,r+=i.map(c=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((c.planets_involved||[]).join("|"))}"
                    data-config-aspect-keys="${this.escapeHtml((c.aspects||[]).map(u=>this.getAspectKey(u)).filter(Boolean).join("|"))}"
                    title="${this.escapeHtml(this.formatConfigType(c.type))}"
                >
                    <div class="config-card-head">
                        <h4>${this.escapeHtml(this.formatConfigType(c.type))}</h4>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${c.apex_planet?`
                            <span
                                class="config-apex-chip"
                                title="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(c.apex_planet)}))}"
                                aria-label="${this.escapeHtml(this.t("page.chart.configurations.apex",{planet:this.planetName(c.apex_planet)}))}"
                            >
                                <span class="planet-tag planet-tag--icon-only planet-tag--config-point">
                                    ${this.getPlanetSymbolMarkup(c.apex_planet,{size:16,title:this.planetName(c.apex_planet)})}
                                </span>
                            </span>
                        `:""}
                        ${c.planets_involved.filter(u=>u!==c.apex_planet).map(u=>{let v=this.buildConfigurationPointTooltip(u,c.aspects||[]),y=this.escapeHtml(this.planetName(u)),A=v?` data-config-point-tooltip="${this.escapeHtml(v)}" data-config-point-name="${y}"`:"";return`
                            <span class="planet-tag planet-tag--icon-only planet-tag--config-point"${v?"":` title="${y}"`} aria-label="${y}"${A}>
                                ${this.getPlanetSymbolMarkup(u,{size:16,title:this.planetName(u)})}
                            </span>
                        `}).join("")}
                    </div>
                </div>
            `).join("")}if(e&&e.length>0){let i=[...e].sort((u,v)=>(v.count||0)-(u.count||0));s||(r+=`<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t("page.chart.configurations.stelliums")}</h3>`);let c=i.map(u=>`
                <div
                    class="config-card config-card--compact"
                    data-config-planets="${this.escapeHtml((u.planets||[]).join("|"))}"
                    data-config-aspect-keys=""
                    data-compact-value="${Number(u.count||0)}"
                    title="${this.escapeHtml(u.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(u.house_number)}):this.signName(u.sign))}"
                >
                    <div class="config-card-head">
                        <h4>
                            ${u.type==="house"?this.t("page.chart.configurations.houseLabel",{house:this.formatHouseNumber(u.house_number)}):`<span class="astro-symbol config-stellium-sign" aria-hidden="true">${Symbols.signs[u.sign]||""}</span> ${this.signName(u.sign)}`}
                        </h4>
                        <span class="config-strength-badge" data-compact-value="${Number(u.count||0)}">${this.t("page.chart.configurations.countShort",{count:u.count})}</span>
                    </div>
                    <div class="config-planets config-planets--compact">
                        ${u.planets.map(v=>`
                            <span class="planet-tag planet-tag--icon-only" title="${this.escapeHtml(this.planetName(v))}" aria-label="${this.escapeHtml(this.planetName(v))}">
                                ${this.getPlanetSymbolMarkup(v,{size:16,title:this.planetName(v)})}
                            </span>
                        `).join("")}
                    </div>
                </div>
            `).join("");s?n+=c:r+=c}if(s){this.configsContainer&&(this.configsContainer.innerHTML=r||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.stelliumsContainer&&(this.stelliumsContainer.innerHTML=n||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noStelliums")||this.t("page.chart.empty.noConfigurations")}</p>`);return}r||(r=`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.configsContainer.innerHTML=r}buildConfigurationPointTooltip(t,e){if(!t||!Array.isArray(e)||!e.length)return"";let s=this.normalizeAspectBodyName(t),r=e.filter(n=>{let i=this.normalizeAspectBodyName(n?.planet_1),c=this.normalizeAspectBodyName(n?.planet_2);return i===s||c===s});return r.length?`
            <div class="config-point-tooltip-title">${this.escapeHtml(this.planetName(t))}</div>
            <div class="config-aspect-lines">
                ${r.map(n=>{let i=`${this.planetName(n.planet_1)} ${this.aspectName(n.aspect_type)} ${this.planetName(n.planet_2)}`,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(n.aspect_type,this.visualPreferences,n.harmonic_type):"#6b7280";return`
                    <div class="config-aspect-line" title="${this.escapeHtml(i)}">
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(n.planet_1,{size:14,title:this.planetName(n.planet_1)})}</span>
                        <span class="config-aspect-badge" style="--config-aspect-color:${this.escapeHtml(c)}" aria-label="${this.escapeHtml(this.aspectName(n.aspect_type))}">
                            <span class="astro-symbol config-aspect-glyph">${this.getAspectSymbol(n.aspect_type)}</span>
                        </span>
                        <span class="planet-tag planet-tag--icon-only" aria-hidden="true">${this.getPlanetSymbolMarkup(n.planet_2,{size:14,title:this.planetName(n.planet_2)})}</span>
                        <span class="config-aspect-orb">${Number(n.orb).toFixed(1)}°</span>
                    </div>
                `}).join("")}
            </div>
        `.trim():""}formatConfigType(t){let e=`astro.configuration.${t}`,s=this.t(e);return s===e?t.replace(/_/g," "):s}renderBalances(t,e){if(!this.balancesContainer)return;let s="";if(!t){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}let r=[{key:"by_sign",label:this.t("page.chart.balances.tabs.sign"),data:t.by_sign},{key:"by_house",label:this.t("page.chart.balances.tabs.house"),data:t.by_house}].filter(n=>this.hasBalanceData(n.data));if(!r.length){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}if(r.length===1){s+=this.renderBalanceSet(r[0].key,r[0].data),this.balancesContainer.innerHTML=s;return}s+=`
            <div class="balance-subtabs" role="tablist" aria-label="${this.t("page.chart.balances.tabs.title")}">
                ${r.map((n,i)=>`
                    <button
                        type="button"
                        class="balance-subtab-btn${i===0?" active":""}"
                        data-balance-tab="${n.key}"
                        aria-selected="${i===0?"true":"false"}"
                    >
                        ${n.label}
                    </button>
                `).join("")}
            </div>
            ${r.map((n,i)=>`
                <div class="balance-subtab-panel${i===0?" active":""}" data-balance-panel="${n.key}">
                    ${this.renderBalanceSet(n.key,n.data)}
                </div>
            `).join("")}
        `,this.balancesContainer.innerHTML=s,this.initBalanceTabs()}hasBalanceData(t){return!!(t&&Object.values(t).some(e=>e&&Object.keys(e).length))}initBalanceTabs(){let t=this.balancesContainer.querySelectorAll("[data-balance-tab]"),e=this.balancesContainer.querySelectorAll("[data-balance-panel]");!t.length||!e.length||t.forEach(s=>{s.addEventListener("click",()=>{let r=s.dataset.balanceTab;t.forEach(n=>{let i=n.dataset.balanceTab===r;n.classList.toggle("active",i),n.setAttribute("aria-selected",i?"true":"false")}),e.forEach(n=>{n.classList.toggle("active",n.dataset.balancePanel===r)})})})}renderBalanceSet(t,e){let s="",r="#9ca3af",n=i=>window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(i,this.visualPreferences):{Fire:"#ef4444",Earth:"#84cc16",Air:"#f59e0b",Water:"#3b82f6"}[i]||r;if(e.element_balance){let i=e.element_balance,c=i.fire+i.earth+i.air+i.water;s+=this.renderBalanceSection(this.t("page.chart.balances.elementsTitle"),[{label:this.t("astro.element.Fire"),value:i.fire,total:c,color:n("Fire")},{label:this.t("astro.element.Earth"),value:i.earth,total:c,color:n("Earth")},{label:this.t("astro.element.Air"),value:i.air,total:c,color:n("Air")},{label:this.t("astro.element.Water"),value:i.water,total:c,color:n("Water")}])}if(t==="by_sign"&&e.mode_balance){let i=e.mode_balance,c=i.cardinal+i.fixed+i.mutable;s+=this.renderBalanceSection(this.t("page.chart.balances.modesTitle"),[{label:this.t("astro.mode.short.Cardinal"),value:i.cardinal,total:c,color:r},{label:this.t("astro.mode.short.Fixed"),value:i.fixed,total:c,color:r},{label:this.t("astro.mode.short.Mutable"),value:i.mutable,total:c,color:r}])}if(t==="by_house"&&e.house_group_balance){let i=e.house_group_balance,c=i.angular+i.succedent+i.cadent;s+=this.renderBalanceSection(this.t("page.chart.balances.houseGroupsTitle"),[{label:this.t("page.chart.balances.angular"),value:i.angular,total:c,color:r},{label:this.t("page.chart.balances.succedent"),value:i.succedent,total:c,color:r},{label:this.t("page.chart.balances.cadent"),value:i.cadent,total:c,color:r}])}if(e.gender_balance){let i=e.gender_balance,c=i.masculine+i.feminine;s+=this.renderBalanceSection(this.t("page.chart.balances.polarityTitle"),[{label:this.t("astro.polarity.Masculine"),value:i.masculine,total:c,color:r},{label:this.t("astro.polarity.Feminine"),value:i.feminine,total:c,color:r}])}if(e.zones_balance){let i=e.zones_balance,c=i.brahma+i.vishnu+i.shiva;s+=this.renderBalanceSection(this.t("page.chart.balances.zonesTitle"),[{label:this.t("page.chart.balances.brahma"),value:i.brahma,total:c,color:r},{label:this.t("page.chart.balances.vishnu"),value:i.vishnu,total:c,color:r},{label:this.t("page.chart.balances.shiva"),value:i.shiva,total:c,color:r}])}if(e.quadrant_balance){let i=e.quadrant_balance,c=i.q1+i.q2+i.q3+i.q4;s+=this.renderBalanceSection(this.t("page.chart.balances.quadrantsTitle"),[{label:this.t("page.chart.balances.quadrant1"),value:i.q1,total:c,color:r},{label:this.t("page.chart.balances.quadrant2"),value:i.q2,total:c,color:r},{label:this.t("page.chart.balances.quadrant3"),value:i.q3,total:c,color:r},{label:this.t("page.chart.balances.quadrant4"),value:i.q4,total:c,color:r}])}if(e.hemisphere_balance){let i=e.hemisphere_balance,c=i.lower+i.upper,u=i.eastern+i.western;s+=this.renderBalanceSection(this.t("page.chart.balances.hemispheresTitle"),[{label:this.t("page.chart.balances.lower"),value:i.lower,total:c,color:r},{label:this.t("page.chart.balances.upper"),value:i.upper,total:c,color:r},{label:this.t("page.chart.balances.east"),value:i.eastern,total:u,color:r},{label:this.t("page.chart.balances.west"),value:i.western,total:u,color:r}])}return s}renderBalanceSection(t,e){return`
            <div class="balance-section">
                <div class="balance-title">${t}</div>
                ${e.map(s=>{let r=s.total>0?s.value/s.total*100:0,n=s.color?`background: ${s.color};`:"",i=s.color?`color: ${s.color};`:"";return`
                        <div class="balance-row">
                            <span class="balance-label" style="${i}">${s.label}</span>
                            <div class="balance-bar-container">
                                <div class="balance-bar" style="${n} width: ${r}%"></div>
                            </div>
                            <span class="balance-value" style="${i}">${s.value}</span>
                        </div>
                    `}).join("")}
            </div>
        `}formatPatternType(t){let e=`astro.pattern.${t}`,s=this.t(e);return s!==e?s:t}};J(I,"ASPECT_SORT_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","MC","IC","DSC","Vertex","AntiVertex"]),J(I,"ASPECT_NAME_ALIASES",{TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"}),J(I,"ASPECT_SORT_RANK",I.ASPECT_SORT_ORDER.reduce((t,e,s)=>(t[e]=s,t),{})),J(I,"ASPECT_TYPE_ORDER",["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"]),J(I,"ASPECT_TYPE_RANK",I.ASPECT_TYPE_ORDER.reduce((t,e,s)=>(t[e]=s,t),{})),J(I,"PLANET_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune"]);var gt=I;window.ChartDataRenderer=gt;(function(){"use strict";let t=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],e=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],s=e.slice(0,10),r="dispositorChainDisplayOptions",n={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},i={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},c=Object.fromEntries(t.map((a,l)=>[a,t[(l+6)%12]])),u={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},v={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function y(a,l){return window.FrontendI18n?.t?.(a,l)||a}function A(a){return String(a??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function D(a){return v[a]||a}function F(a){if(!a)return"—";let l=`astro.planet.${a}`,o=y(l);return o!==l?o:window.Symbols?.getPlanetNameRu?.(a)||window.Symbols?.planetNamesRu?.[a]||a}function it(a){if(!a)return"—";let l=`astro.sign.${a}`,o=y(l);return o!==l?o:window.Symbols?.signNamesRu?.[a]||a}function Q(a,l=16){return window.Symbols?.getPlanetSymbolMarkup?.(a,{size:l,title:F(a)})||`<span class="astro-symbol">${A(window.Symbols?.getPlanetSymbol?.(a)||"")}</span>`}function ft(a){return[window.Symbols?.signs?.[a]||"",it(a)].filter(Boolean).join(" ")}function ot(){let a={},l=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return t.forEach(o=>{let p=u[o]||{},h=l?.[o]||{},f=D(h.ruler||p.ruler||null),N=D(h.co_ruler||p.co_ruler||null),_=D(h.exaltation||p.exaltation||null);f&&N&&f===N&&(N=null),a[o]={ruler:f,co_ruler:N,exaltation:_}}),a}function at(a,l,o=ot()){let p=o?.[a]||{},h=o?.[c[a]]||{};return l==="exaltation"?p.exaltation||null:l==="detriment"?h.ruler||null:l==="fall"?h.exaltation||null:p.ruler||null}function bt(a,l,o,p=n){return a?p.classicalRulers&&l==="domicile"?i[a]||at(a,l,o):p.classicalRulers&&l==="detriment"&&i[c[a]]||at(a,l,o):null}function yt(a){return(Array.isArray(a?.planets)?a.planets:[]).filter(o=>o?.name&&o?.sign&&e.includes(D(o.name))).map(o=>({...o,name:D(o.name)})).sort((o,p)=>e.indexOf(o.name)-e.indexOf(p.name))}function $t(a,l){let o=ot(),p=yt(a),h=new Map(p.map(S=>[S.name,S])),f=[],N=new Map;p.forEach(S=>{let x=[],$=new Map,g=S,k=null,E=[];for(;g?.name&&!$.has(g.name);){$.set(g.name,x.length);let w=at(g.sign,l,o);if(x.push({planet:g.name,sign:g.sign,ruler:w,retrograde:!!g.retrograde}),!w){k="none";break}if(!h.has(w)){k=w;break}if(w===g.name){k=w;break}g=h.get(w)}if(!k&&g?.name&&$.has(g.name)){let w=$.get(g.name);E=x.slice(w).map(B=>B.planet),k=E.join("+")}N.set(k,(N.get(k)||0)+1),f.push({start:S.name,steps:x,finalKey:k,cycle:E})});let _=[...N.entries()].filter(([S])=>S&&S!=="none").sort((S,x)=>x[1]-S[1]||S[0].localeCompare(x[0])).slice(0,4);return{chains:f,mainRulers:_}}function lt(a){if(!a)return`<p class="dispositor-empty">${A(y("page.chart.rulers.empty.noJones"))}</p>`;let l=(()=>{let p=`astro.pattern.${a.pattern_type}`,h=y(p);return h===p?a.pattern_type||"—":h})(),o=[];return Number.isFinite(Number(a.empty_arc_degree))&&o.push(y("page.chart.balances.emptyArc",{value:Number(a.empty_arc_degree).toFixed(0)})),a.handle_planet&&o.push(y("page.chart.balances.handle",{planet:F(a.handle_planet)})),a.leading_planet&&o.push(y("page.chart.balances.leading",{planet:F(a.leading_planet)})),`
            <article class="dispositor-jones-card" title="${A([y("page.chart.rulers.jonesKicker"),l,...o].join(" · "))}">
                <h4>${A(l)}</h4>
                ${o.length?`<p>${A(o.join(" · "))}</p>`:""}
            </article>
        `}function Ct(a){return a.length?`
            <div class="dispositor-main-rulers">
                ${a.map(([l,o])=>{let p=l.split("+").filter(Boolean),h=p.map(F).join(" + ");return`
                        <span class="dispositor-main-chip" title="${A(h)}">
                            ${p.map(f=>Q(f,15)).join("")}
                            <b>${o}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${A(y("page.chart.rulers.empty.noMainRulers"))}</p>`}function ct(a,l="",o=""){let p=[F(a.planet),a.sign?ft(a.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${l}" style="${A(o)}" title="${A(p)}" aria-label="${A(p)}">
                ${Q(a.planet,15)}
            </span>
        `}function te(a){let l=[...a.steps].reverse().map((p,h)=>{let f=h===0&&a.finalKey!=="none";return ct(p,f?"dispositor-chain-node--main":"")}),o=a.steps[a.steps.length-1];return o?.ruler&&!a.steps.some(p=>p.planet===o.ruler)&&l.unshift(ct({planet:o.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${l.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function K(a){return[...new Set(a)].sort((l,o)=>{let p=e.indexOf(l),h=e.indexOf(o);return(p===-1?999:p)-(h===-1?999:h)})}function Mt(a){return K(a).join("+")}function Et(a){let l=a?.number??a?.house_number,o=Number(l);return Number.isInteger(o)?o:l}function Bt(a){let l=[...new Set(a)].map(o=>Number(o)).filter(o=>Number.isInteger(o)).sort((o,p)=>o-p);return l.length?window.Symbols?.formatHouseList?.(l,{style:"roman",separator:","})||l.map(o=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][o-1]||String(o)).join(","):""}function Lt(a,l,o,p=n){return l==="domicile"&&a?.ruler_planet&&!p.classicalRulers?D(a.ruler_planet):D(bt(a?.sign,l,o,p))}function St(a,l,o=n){let p=ot(),h=yt(a),f=new Map(h.map($=>[$.name,$])),N=Array.isArray(a?.houses)?a.houses:[],_=new Map,S=[];return N.forEach($=>{let g=Lt($,l,p,o),k=Et($);!g||!k||(_.has(g)||_.set(g,[]),_.get(g).push(k),S.push(g))}),h.forEach($=>{s.includes($.name)&&S.push($.name)}),{chains:K(S).map($=>{let g=[],k=new Map,E=f.get($)||{name:$,sign:null,retrograde:!1},w=null,B=[];for(;E?.name&&!k.has(E.name);){k.set(E.name,g.length);let L=E.sign?bt(E.sign,l,p,o):null;if(g.push({planet:E.name,sign:E.sign,ruler:L,retrograde:!!E.retrograde}),!L){w=E.name;break}if(!f.has(L)){w=L;break}if(L===E.name){w=L;break}E=f.get(L)}if(!w&&E?.name&&k.has(E.name)){let L=k.get(E.name);B=g.slice(L).map(q=>q.planet),w=Mt(B)}return{start:$,steps:g,finalKey:w,cycle:B}}),housesByRuler:_}}function _t(a,l,o,p=""){let h=o.showHouseRulers?Bt(l.get(a.planet)||[]):"",f=[F(a.planet),a.sign?ft(a.sign):"",h?`${y("common.house")} ${h}`:""].filter(Boolean).join(" · "),N=Number.isFinite(a.x)&&Number.isFinite(a.y)?` style="left:${a.x}px; top:${a.y}px;"`:"";return`
            <span
                class="dispositor-compact-node ${p}"
                ${N}
                title="${A(f)}"
                aria-label="${A(f)}"
            >
                <span class="dispositor-compact-symbol">${Q(a.planet,32)}</span>
                ${h?`<span class="dispositor-house-label">${A(h)}</span>`:""}
            </span>
        `}function wt(a,l,o,p,h=""){let f=l.get(a)||{planet:a,sign:null};return _t(f,o,p,`dispositor-compact-node--static ${h}`.trim())}function vt(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function At(a,l){let o=a&&a!=="none"?a.split("+").filter(Boolean):[];if(o.length<=2)return[];let p=new Set(o),h=(N=[])=>N.length===o.length&&N.every(_=>p.has(_)),f=l.find(N=>h(N.cycle||[]))?.cycle;return f?[...f]:[]}function Rt(a){let l=new Map;return a.forEach(o=>{o.steps.forEach(p=>{if(!p?.planet)return;let h=l.get(p.planet)||{planet:p.planet,sign:null};l.set(p.planet,{...h,sign:h.sign||p.sign||null,retrograde:h.retrograde||!!p.retrograde})})}),l}function jt(a,l,o,p){let h=At(a,l),f=new Set(h),N=Rt(l),_=[...h,h[0]].filter(Boolean),S=[],x=new Set;return l.forEach($=>{let g=$.steps.findIndex(w=>f.has(w.planet));if(g<=0)return;let k=$.steps.slice(0,g+1).map(w=>w.planet),E=k.join(">");x.has(E)||(x.add(E),S.push(k))}),`
            <section class="dispositor-compact-group" aria-label="${A(y("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${_.map(($,g)=>`
                            ${g>0?vt():""}
                            ${wt($,N,o,p,`dispositor-compact-node--main${g===_.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${S.length?`
                        <div class="dispositor-cycle-branches">
                            ${S.map($=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${$.map((g,k)=>`
                                        ${k>0?vt():""}
                                        ${wt(g,N,o,p,f.has(g)?"dispositor-compact-node--main":"")}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function Ft(a,l,o){let p=[],h=new Set;if(a.forEach(_=>{let S=_.steps.map(x=>x.planet).join(">");h.has(S)||(h.add(S),p.push(_))}),!p.length)return`<p class="dispositor-empty">${A(y("page.chart.rulers.empty.noChains"))}</p>`;let f=new Map;return p.forEach(_=>{let S=_.finalKey||"none";f.has(S)||f.set(S,[]),f.get(S).push(_)}),`
            <div class="dispositor-compact-diagram">
                ${[...f.entries()].sort((_,S)=>{let x=new Set(_[1].flatMap(g=>g.steps.map(k=>k.planet))).size,$=new Set(S[1].flatMap(g=>g.steps.map(k=>k.planet))).size;return x-$||String(_[0]).localeCompare(String(S[0]))}).map(([_,S],x)=>{if(At(_,S).length>2)return jt(_,S,l,o);let g=xt(_,S),k=`url(#dispositorCompactArrow${x})`,E=` marker-end="${k}"`,w=` marker-start="${k}" marker-end="${k}"`;return`
                        <section class="dispositor-compact-group" aria-label="${A(y("page.chart.rulers.modalTitle"))} ${x+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${g.width}px; --graph-height:${g.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${g.width} ${g.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${x}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${g.edges.map(B=>`
                                        <path d="${A(B.path)}"${E}></path>
                                    `).join("")}
                                    ${g.mutualEdges.map(B=>`
                                        <path class="dispositor-compact-mutual" d="${A(B.path)}"${w}></path>
                                    `).join("")}
                                </svg>
                                ${g.nodes.map(B=>_t(B,l,o,B.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function xt(a,l){let S=a&&a!=="none"?a.split("+").filter(Boolean):[],x=new Map,$=[],g=new Set,k=(d,b={})=>{if(!d)return null;let P=x.get(d)||{planet:d,sign:null,retrograde:!1};return x.set(d,{...P,sign:P.sign||b.sign||null,retrograde:P.retrograde||!!b.retrograde}),x.get(d)},E=(d,b)=>{let P=d?.planet,T=b?.planet;if(!P||!T||P===T)return;k(P,d),k(T,b);let C=`${P}->${T}`;g.has(C)||(g.add(C),$.push({child:P,parent:T}))};l.forEach(d=>{d.steps.forEach(b=>k(b.planet,b));for(let b=0;b<d.steps.length;b+=1){let P=d.steps[b],T=d.steps[b+1];T?E(P,T):P?.ruler&&!d.steps.some(C=>C.planet===P.ruler)&&E(P,{planet:P.ruler})}});let w=S.length?K(S):K([...x.keys()].filter(d=>!$.some(b=>b.child===d)));!w.length&&x.size&&w.push([...x.keys()][0]);let B=new Set(w),L=new Map,q=[],Z=[];$.forEach(d=>{if(B.has(d.child)&&B.has(d.parent)){let b=K([d.child,d.parent]).join("<->");q.some(P=>P.key===b)||q.push({...d,key:b});return}Z.push(d),L.has(d.parent)||L.set(d.parent,[]),L.get(d.parent).push(d.child)}),L.forEach((d,b)=>{L.set(b,K(d))});let U=!1,tt=(()=>{if(w.length<=2)return w;let d=(j=[])=>j.length===w.length&&j.every(z=>B.has(z)),b=l.find(j=>d(j.cycle||[]))?.cycle;if(b)return U=!0,[...b];let P=new Map(q.map(j=>[j.child,j.parent]));U=q.length>=w.length-1;let T=[],C=w[0];for(;C&&B.has(C)&&!T.includes(C);)T.push(C),C=P.get(C);return w.forEach(j=>{T.includes(j)||T.push(j)}),T})(),O=new Map,et=(d,b,P)=>{let T=8,C=(z,Y=0,V=new Set)=>{if(O.has(z))return O.get(z);if(V.has(z)){let W={x:P+b*Y*60,y:T};return T+=58,O.set(z,W),W}V.add(z);let Tt=(L.get(z)||[]).filter(W=>!B.has(W)),mt;if(!Tt.length)mt=T,T+=58;else{let W=Tt.map(st=>C(st,Y+1,new Set(V)));mt=(Math.min(...W.map(st=>st.y))+Math.max(...W.map(st=>st.y)))/2}V.delete(z);let Ht={x:P+b*Y*60,y:mt};return O.set(z,Ht),Ht};return{rootPosition:C(d,0),height:T}},rt=d=>{let b=[],P=[d],T=new Set;for(;P.length;){let C=P.pop();!C||T.has(C)||(T.add(C),b.push(C),(L.get(C)||[]).forEach(j=>{B.has(j)||P.push(j)}))}return b},m=(d,b)=>{rt(d).forEach(P=>{let T=O.get(P);T&&(T.y+=b)})};if(w.length===2){let d=w[0],b=w[1],P=et(d,-1,0),T=et(b,1,72),C=Math.max(P.rootPosition.y,T.rootPosition.y);m(d,C-P.rootPosition.y),m(b,C-T.rootPosition.y)}else{let d=8;tt.forEach((b,P)=>{et(b,-1,0);let C=rt(b).map(V=>O.get(V)).filter(Boolean);if(!C.length)return;let j=Math.min(...C.map(V=>V.y)),z=Math.max(...C.map(V=>V.y)),Y=d-j;Y&&m(b,Y),d=z+Y+(P===w.length-1?0:58)})}x.forEach((d,b)=>{O.has(b)||O.set(b,{x:0,y:8+O.size*58})});let M=Math.min(...[...O.values()].map(d=>d.x)),H=Math.min(...[...O.values()].map(d=>d.y));O.forEach(d=>{d.x=d.x-M+8,d.y=d.y-H+8});let R=[...x.values()].map(d=>({...d,isRoot:B.has(d.planet),...O.get(d.planet)||{x:8,y:8}})),G=new Map(R.map(d=>[d.planet,d])),X=d=>{let b=G.get(d.child),P=G.get(d.parent);if(!b||!P)return null;let T=1,C=b.x<P.x,j=C?b.x+42+T:b.x-T,z=C?P.x-T:P.x+42+T,Y=b.y+21,V=P.y+21;return{...d,path:`M${j},${Y} L${z},${V}`}},ut=d=>{let b=G.get(d.child),P=G.get(d.parent);if(!b||!P)return null;let T=Math.max(b.x,P.x)+42+8,C=T,j=b.y+21,z=P.y+21;if(z>=j)return{...d,path:`M${T},${j} L${C},${z}`};let Y=T+14;return{...d,path:`M${T},${j} L${Y},${j} L${Y},${z} L${C},${z}`}},ht=w.length>2&&U?tt.map((d,b)=>({child:d,parent:tt[(b+1)%tt.length]})).filter(d=>d.child&&d.parent&&d.child!==d.parent):[],Xt=[...Z.map(X).filter(Boolean),...ht.map(ut).filter(Boolean)],Wt=w.length>2&&U?[]:q.map(X).filter(Boolean),Jt=Math.max(220,Math.ceil(Math.max(...R.map(d=>d.x+42))+8)),Qt=Math.max(70,Math.ceil(Math.max(...R.map(d=>d.y+58))+8));return{width:Jt,height:Qt,nodes:R,edges:Xt,mutualEdges:Wt}}function zt(a){let l=[],o=new Set;a.forEach(h=>{let f=h.steps.map(N=>N.planet).join(">");o.has(f)||(o.add(f),l.push(h))});let p=new Map;return l.forEach(h=>{let f=h.finalKey||"none";p.has(f)||p.set(f,[]),p.get(f).push(h)}),l.length?`
            <div class="dispositor-diagram">
                ${[...p.entries()].map(([h,f])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Gt(h,f.length)}
                        </div>
                        ${It(h,f)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${A(y("page.chart.rulers.empty.noChains"))}</p>`}function It(a,l){let o=Ot(a,l);return o.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${o.width}px; --graph-height:${o.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${o.width} ${o.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${o.edges.map(p=>`
                        <path d="${A(p.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${o.nodes.map(p=>ct(p,p.isRoot?"dispositor-chain-node--main":"",`left:${p.x}px; top:${p.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${A(y("page.chart.rulers.empty.noChains"))}</p>`}function Ot(a,l){let N=new Set(a&&a!=="none"?a.split("+").filter(Boolean):[]),_=new Map,S=[],x=new Set,$=new Map,g=new Map,k=(m,M={})=>{if(!m)return null;let H=_.get(m)||{planet:m,sign:null,retrograde:!1};return _.set(m,{...H,sign:H.sign||M.sign||null,retrograde:H.retrograde||!!M.retrograde}),_.get(m)},E=(m,M)=>{let H=m?.planet,R=M?.planet;if(!H||!R||H===R||N.has(H)&&N.has(R))return;k(H,m),k(R,M);let G=`${H}->${R}`;x.has(G)||(x.add(G),S.push({child:H,parent:R}),g.set(H,R),$.has(R)||$.set(R,[]),$.get(R).push(H))};l.forEach(m=>{m.steps.forEach(H=>k(H.planet,H));for(let H=0;H<m.steps.length-1;H+=1)E(m.steps[H],m.steps[H+1]);let M=m.steps[m.steps.length-1];M?.ruler&&!m.steps.some(H=>H.planet===M.ruler)&&E(M,{planet:M.ruler})}),N.size||[..._.keys()].forEach(m=>{g.has(m)||N.add(m)}),!N.size&&_.size&&N.add([..._.keys()][0]),$.forEach((m,M)=>{$.set(M,K(m))});let w=new Map,B=(m,M=0)=>{w.has(m)&&w.get(m)<=M||(w.set(m,M),($.get(m)||[]).forEach(H=>B(H,M+1)))};K([...N]).forEach(m=>B(m,0)),_.forEach((m,M)=>{w.has(M)||w.set(M,0)});let L=24,q=new Map,Z=(m,M=new Set)=>{if(q.has(m))return q.get(m);if(M.has(m)){let G=L;return L+=76,q.set(m,G),G}M.add(m);let H=$.get(m)||[],R;if(!H.length)R=L,L+=76;else{let G=H.map(X=>Z(X,new Set(M)));R=(Math.min(...G)+Math.max(...G))/2}return M.delete(m),q.set(m,R),R};K([...N]).forEach(m=>Z(m)),_.forEach((m,M)=>Z(M));let U=[..._.values()].map(m=>({...m,isRoot:N.has(m.planet),x:24+(w.get(m.planet)||0)*128,y:q.get(m.planet)||24})),dt=new Map(U.map(m=>[m.planet,m])),tt=Math.max(0,...U.map(m=>w.get(m.planet)||0)),O=Math.max(180,L+24),et=Math.max(520,48+tt*128+44),rt=S.map(m=>{let M=dt.get(m.child),H=dt.get(m.parent);if(!M||!H)return null;let R=M.x,G=M.y+44/2,X=H.x+44,ut=H.y+44/2,ht=Math.max(X+18,R-42);return{...m,path:`M${R},${G} H${ht} V${ut} H${X}`}}).filter(Boolean);return{width:et,height:O,nodes:U,edges:rt}}function Gt(a,l){if(!a||a==="none")return`
                <span class="dispositor-diagram-group-title">${A(y("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${l}</span>
            `;let o=a.split("+").filter(Boolean),p=o.map(F).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${A(p)}">
                ${o.map(h=>Q(h,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${l}</span>
        `}function Dt(a){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${A(y("page.chart.rulers.modeLabel"))}">
                ${l.map(o=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${o===a?" active":""}"
                        data-dispositor-mode="${o}"
                        role="tab"
                        aria-selected="${o===a?"true":"false"}"
                    >${A(y(`astro.dignity.${o}`))}</button>
                `).join("")}
            </div>
        `}function Pt(a){return["domicile","exaltation","detriment","fall"].includes(a)?a:n.mode}function qt(a={}){let l={};try{l=JSON.parse(window.localStorage?.getItem(r)||"{}")||{}}catch{l={}}return{...n,mode:Pt(a.mode||l.mode||n.mode),showArrowDirection:(a.showArrowDirection??l.showArrowDirection??n.showArrowDirection)!==!1,showHouseRulers:(a.showHouseRulers??l.showHouseRulers??n.showHouseRulers)!==!1,classicalRulers:(a.classicalRulers??l.classicalRulers??n.classicalRulers)===!0}}function Yt(a){try{window.localStorage?.setItem(r,JSON.stringify(a))}catch{}}function Nt(a){let l=`page.chart.rulers.chainModes.${a}`,o=y(l);return o!==l?o:y(a==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${a}`)}function Vt(a){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${A(Nt(a.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${A(y("page.chart.rulers.options.chainType"))}">
                        ${l.map(o=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${A(o)}"
                                    data-dispositor-option="mode"
                                    ${o===a.mode?"checked":""}
                                >
                                <span>${A(Nt(o))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${a.showHouseRulers?"checked":""}>
                        <span>${A(y("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${a.classicalRulers?"checked":""}>
                        <span>${A(y("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function pt(a,l,o){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <h4>${A(y("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Vt(o)}
                </div>
                ${Ft(a,l,o)}
            </div>
        `}function Kt(a,l,o,p){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${A(y("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${A(y("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${A(y("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${lt(a?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${pt(l,o,p)}
                </div>
            </div>
        `}function Ut(a,l={},o="domicile"){nt();let{chains:p,mainRulers:h}=$t(a,o),f=document.createElement("div");f.className="dispositor-modal-overlay",f.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${A(y("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${A(y("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Dt(o)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${A(y("page.chart.rulers.mainKicker"))}</span>
                    ${Ct(h)}
                </div>
                ${zt(p)}
            </div>
        `,document.body.appendChild(f),document.body.classList.add("dispositor-modal-open"),f.addEventListener("click",N=>{let _=N.target;if(_===f||_ instanceof Element&&_.closest("[data-dispositor-close]")){nt();return}if(!(_ instanceof Element))return;let S=_.closest(".dispositor-mode-tab[data-dispositor-mode]");S&&Ut(a,l,S.dataset.dispositorMode||o)}),f.querySelector("[data-dispositor-close]")?.focus()}function nt(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function kt(a,l,o={}){let p=typeof a=="string"?document.getElementById(a):a;if(!p)return;let h=qt(o),{chains:f,housesByRuler:N}=St(l,h.mode,h);o.section==="jones"?p.innerHTML=`<div class="dispositor-panel">${lt(l?.cosmogram_pattern)}</div>`:o.section==="scheme"?p.innerHTML=`<div class="dispositor-panel">${pt(f,N,h)}</div>`:p.innerHTML=o.layout==="tabs"?Kt(l,f,N,h):`
                    <div class="dispositor-panel">
                        ${lt(l?.cosmogram_pattern)}
                        ${pt(f,N,h)}
                    </div>
                `,p.querySelectorAll("[data-dispositor-tab]").forEach(x=>{x.addEventListener("click",()=>{let $=x.dataset.dispositorTab;p.querySelectorAll("[data-dispositor-tab]").forEach(g=>{let k=g.dataset.dispositorTab===$;g.classList.toggle("active",k),g.setAttribute("aria-selected",k?"true":"false")}),p.querySelectorAll("[data-dispositor-panel]").forEach(g=>{g.classList.toggle("active",g.dataset.dispositorPanel===$)})})});let _=p.querySelector("[data-dispositor-options-toggle]"),S=p.querySelector("[data-dispositor-options-menu]");_?.addEventListener("click",x=>{x.stopPropagation();let $=S&&!S.classList.contains("hidden");S?.classList.toggle("hidden",$),_.setAttribute("aria-expanded",$?"false":"true")}),S?.addEventListener("click",x=>x.stopPropagation()),S?.querySelectorAll("[data-dispositor-option]").forEach(x=>{x.addEventListener("change",()=>{let $={...h};x.dataset.dispositorOption==="mode"?$.mode=Pt(x.value):$[x.dataset.dispositorOption]=x.checked,Yt($),kt(p,l,$)})})}window.DispositorChains={render:kt,buildChains:$t,buildHouseDispositorScheme:St,buildCompactLayout:xt,closeModal:nt},document.addEventListener("keydown",a=>{a.key==="Escape"&&(nt(),document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",a=>{a.target instanceof Element&&a.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))})})();
