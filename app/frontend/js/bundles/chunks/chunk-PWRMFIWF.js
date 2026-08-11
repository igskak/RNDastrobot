import{c as J}from"./chunk-IZUYVIPG.js";var I=class I{constructor(e={}){let t=(s,o,a)=>s||(o?document.getElementById(o):document.getElementById(a));this.planetsTable=t(e.planetsTable,e.planetsTableId,"planetsTable"),this.housesTable=t(e.housesTable,e.housesTableId,"housesTable"),this.aspectsTable=t(e.aspectsTable,e.aspectsTableId,"aspectsTable"),this.aspectGridContainer=t(e.aspectGridContainer,e.aspectGridContainerId,"aspectGridContainer"),this.configsContainer=t(e.configsContainer,e.configsContainerId,"configurationsContainer"),this.balancesContainer=t(e.balancesContainer,e.balancesContainerId,"balancesContainer"),this.dignitiesContainer=t(e.dignitiesContainer,e.dignitiesContainerId,"dignitiesContainer"),this.aspectSortHeadersSelector=e.aspectSortHeadersSelector||"#aspects-list th.sortable[data-sort]",this.aspectTypeFilter="all",this.aspectPlanetFilter=null,this.aspectSortState={field:"planet",ascending:!0},this.aspectSortHeaders=[],this.hoveredAspectKey=null,this.showSpeed=!0,this.showStationary=!0,this.showApplyingSeparating=!1,this.showAspectText=!1,this.showSpeedColumn=e.showSpeedColumn!==!1,this.showHouseColumn=e.showHouseColumn!==!1,this.onPlanetsRendered=typeof e.onPlanetsRendered=="function"?e.onPlanetsRendered:null,this.fixedStarsData=null,this.showFixedStarBadges=!1,this.houseNumberStyle=Symbols?.readSavedHouseNumberStyle?.()||"arabic",this.visualPreferences=window.AstroPreferences?.getAccountVisualPreferences?.()||null,this.initAspectSortHeaders()}t(e,t){return window.FrontendI18n?.t?.(e,t)||e}planetName(e){let t=this.getCuspHouseNumber(e);if(t){let a=Symbols?.formatHouseLabel?.(t)||String(t);return this.t("page.chart.houseCusp",{house:a})}let s=`astro.planet.${e}`,o=this.t(s);return o===s?Symbols.getPlanetNameRu?.(e)||Symbols.planetNamesRu[e]||e:o}signName(e){let t=`astro.sign.${e}`,s=this.t(t);return s===t?Symbols.signNamesRu[e]||e:s}aspectName(e){let t=`astro.aspect.${e}`,s=this.t(t);return s===t?Symbols.aspectNamesRu[e]||e:s}getPlanetSymbol(e){return Symbols.getPlanetSymbol?.(e)||Symbols.planets?.[this.normalizeAspectBodyName(e)]||Symbols.planets?.[e]||""}getPlanetSymbolMarkup(e,t={}){let s=this.getCuspHouseNumber(e);if(s){let o=Symbols?.formatHouseLabel?.(s)||String(s),a=this.escapeHtml(t.title||this.planetName(e));return`<span class="aspect-cusp-symbol" title="${a}" aria-label="${a}">${this.escapeHtml(o)}</span>`}return Symbols.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${this.escapeHtml(this.getPlanetSymbol(e))}</span>`}getCuspHouseNumber(e){let t=/^Cusp([1-9]|1[0-2])$/.exec(String(e||""));return t?Number(t[1]):null}getAspectSymbol(e){return Symbols.getAspectDisplay?.(e)||Symbols.aspects?.[e]||"•"}escapeHtml(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}retrogradeTitle(){let e="page.natalFull.legend.motion.retrograde",t=this.t(e);return t===e?"Retrograde":t}stationaryTitle(){let e="page.natalFull.legend.motion.stationary",t=this.t(e);return t===e?"Stationary":t}dignityTitle(e){if(!e||e==="neutral")return"";let t=`astro.dignity.${e}`,s=this.t(t);return s===t?e:s}dignityShortLabel(e){let t=String(this.dignityTitle(e)||"").trim();return t?Array.from(t)[0].toUpperCase():""}getApplyingSeparatingLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?this.t("page.chart.settings.aspectPhase.applying"):this.t("page.chart.settings.aspectPhase.separating");let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?this.t("page.chart.settings.aspectPhase.applying"):s.includes("separ")||s.includes("расход")?this.t("page.chart.settings.aspectPhase.separating"):t}getApplyingSeparatingShortLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?"сход.":"расх.";let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?"сход.":s.includes("separ")||s.includes("расход")?"расх.":t}retroIndicatorHtml(e,t=""){if(!e)return"";let s=t?` ${t}`:"",o=this.escapeHtml(this.retrogradeTitle());return`<span class="retro-indicator${s}" title="${o}" aria-label="${o}">R</span>`}stationaryIndicatorHtml(e,t=""){if(!e?.is_stationary)return"";let s=t?` ${t}`:"",o=this.escapeHtml(this.stationaryTitle());return`<span class="planet-status-badge planet-status-badge--stationary${s}" title="${o}" aria-label="${o}">S</span>`}dignityIndicatorHtml(e,t=""){let s=String(e?.dignity||"").trim();if(!s||s==="neutral")return"";let o=this.dignityTitle(s),a=this.dignityShortLabel(s);if(!o||!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(o);return`
            <span class="planet-status-badge planet-status-badge--dignity planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">
                ${this.escapeHtml(a)}
            </span>
        `}solarBadgeTitle(e){let t=`astro.feature.short.${e}`,s=this.t(t);return s===t?e:s}sunRelationIndicatorHtml(e,t=""){let s=String(e?.sun_relation||"").trim(),a={cazimi:"Cz",combust:"Cb",under_rays:"Ur"}[s];if(!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--sun-relation planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}solarPhaseIndicatorHtml(e,t=""){let s=String(e?.solar_phase||"").trim(),a={oriental:"Or",occidental:"Oc"}[s];if(!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--solar-phase planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}outOfBoundsIndicatorHtml(e,t=""){if(!e?.out_of_bounds)return"";let s=t?` ${t}`:"",o="astro.feature.short.out_of_bounds",a=this.t(o),r=this.escapeHtml(a&&a!==o?a:"Out of bounds");return`<span class="planet-status-badge planet-status-badge--oob${s}" title="${r}" aria-label="${r}">OOB</span>`}buildRetrogradeLookup(e=[]){let t=new Map;return e.forEach(s=>{if(!s?.name)return;let o=this.normalizeAspectBodyName(s.name);t.set(o,!!s.retrograde)}),t}isBodyRetrograde(e,t=null){if(!e)return!1;let s=this.normalizeAspectBodyName(String(e));return(t||this.buildRetrogradeLookup(this.chartData?.planets||[])).get(s)===!0}buildPlanetHouseLookup(e=[]){let t=new Map;return e.forEach(s=>{!s?.name||s.house==null||s.house===""||t.set(this.normalizeAspectBodyName(s.name),s.house)}),t}buildHouseRulerGroups(e,t=new Map,s=null){if(Array.isArray(e?.ruler_groups)&&e.ruler_groups.length)return e.ruler_groups.map(y=>({included:y?.scope==="included",entries:(y?.entries||[]).filter(T=>{let $=this.normalizeAspectBodyName(T?.planet);return $&&(!(s instanceof Set)||s.has($))}).map(T=>({planet:T.planet,house:T.house??t.get(this.normalizeAspectBodyName(T.planet))??null}))})).filter(y=>y.entries.length);let o=[],r=[e?.ruler_planet,...Array.isArray(e?.co_rulers)?e.co_rulers:[]],c=new Set;return r.forEach((y,T)=>{if(!y)return;let $=this.normalizeAspectBodyName(y);s instanceof Set&&!s.has($)||c.has($)||(c.add($),o.push({planet:y,house:T===0&&e?.ruler_in_house!=null&&e?.ruler_in_house!==""?e.ruler_in_house:t.get($)??null}))}),o.length?[{entries:o,included:!1}]:[]}renderHouseRulerGroup(e,t=null){return e?.entries?.length?`
            <div class="${e.included?"house-ruler-group house-ruler-group--included":"house-ruler-group"}">
                ${e.entries.map(o=>{let a=this.planetName(o.planet),r=o.house!=null&&o.house!==""?this.formatHouseNumber(o.house):"",c=[a];return r&&c.push(`${this.t("common.house")} ${r}`),`
                        <div class="house-ruler-row" title="${this.escapeHtml(c.join(" • "))}">
                            <span class="house-ruler-symbol-wrap">
                                ${this.getPlanetSymbolMarkup(o.planet,{size:18,title:a})}
                                ${this.retroIndicatorHtml(this.isBodyRetrograde(o.planet,t),"retro-indicator--micro house-ruler-retro")}
                            </span>
                            <span class="house-ruler-house">${this.escapeHtml(r||"—")}</span>
                        </div>
                    `}).join("")}
            </div>
        `:""}initAspectSortHeaders(){this.aspectSortHeaders=[...document.querySelectorAll(this.aspectSortHeadersSelector)],this.aspectSortHeaders.forEach(e=>{e.addEventListener("click",()=>{this.toggleAspectSort(e.dataset.sort)})}),this.updateAspectSortHeaders()}toggleAspectSort(e){e&&(this.aspectSortState.field===e?this.aspectSortState.ascending=!this.aspectSortState.ascending:(this.aspectSortState.field=e,this.aspectSortState.ascending=!0),this.updateAspectSortHeaders(),this.reRenderAspects())}updateAspectSortHeaders(){this.aspectSortHeaders.forEach(e=>{let t=this.aspectSortState.field===e.dataset.sort;e.classList.toggle("sort-active",t),e.classList.toggle("sort-desc",t&&!this.aspectSortState.ascending),e.setAttribute("aria-sort",t?this.aspectSortState.ascending?"ascending":"descending":"none")})}setAspectTypeFilter(e){let t=e==="major"||e==="minor"?e:"all";t!==this.aspectTypeFilter&&(this.aspectTypeFilter=t,this.reRenderAspects())}setAspectPlanetFilter(e){let t=e?this.normalizeAspectBodyName(String(e)):null;t!==this.aspectPlanetFilter&&(this.aspectPlanetFilter=t,this.reRenderAspects())}setDisplayPreferences(e={}){Object.prototype.hasOwnProperty.call(e,"showSpeed")&&(this.showSpeed=e.showSpeed!==!1),Object.prototype.hasOwnProperty.call(e,"showStationary")&&(this.showStationary=e.showStationary!==!1),Object.prototype.hasOwnProperty.call(e,"showApplyingSeparating")&&(this.showApplyingSeparating=e.showApplyingSeparating===!0),Object.prototype.hasOwnProperty.call(e,"showAspectText")&&(this.showAspectText=e.showAspectText===!0),this.updatePlanetsTableColumns(),this.chartData&&(this.renderPlanets(this.chartData.planets),this.renderAspects(this.chartData.aspects))}setHouseNumberStyle(e){let t=Symbols?.normalizeHouseNumberStyle?.(e)||"arabic";t!==this.houseNumberStyle&&(this.houseNumberStyle=t,this.chartData&&this.render(this.chartData))}updatePlanetsTableColumns(){let e=this.planetsTable?.closest("table");if(!e)return;e.classList.toggle("planets-table--speed-hidden",!this.showSpeed),e.classList.toggle("planets-table--speed-column-hidden",!this.showSpeedColumn),e.classList.toggle("planets-table--house-column-hidden",!this.showHouseColumn);let t=window.AstroPreferences?.getDegreeFormat?.()||"DEGREES_ONLY";e.classList.toggle("planets-table--seconds",t==="DEGREES_MINUTES_SECONDS")}setVisualPreferences(e={}){this.visualPreferences=window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e||{}):e||null,this.chartData&&this.render(this.chartData)}setFixedStarsData(e,t={}){this.fixedStarsData=e||null,this.showFixedStarBadges=t.showBadges===!0&&!!e,this.chartData&&this.renderPlanets(this.chartData.planets)}reRenderAspects(){this.chartData&&this.renderAspects(this.chartData.aspects)}render(e){this.chartData=e,this.renderPlanets(e.planets),this.renderHouses(e.houses),this.renderAspects(e.aspects),this.renderAspectGrid(e.aspects,e.planets),this.renderDignities(e.planets),this.renderConfigurations(e.aspect_configurations,e.stelliums),this.renderBalances(e.balances,e.cosmogram_pattern)}static normalizeBodyName(e){return window.Symbols?.normalizeBodyName?.(e)||e}renderPlanets(e){if(!e||!this.planetsTable)return;this.updatePlanetsTableColumns();let t=[...e].sort((s,o)=>{let a=I.PLANET_ORDER.indexOf(I.normalizeBodyName(s.name)),r=I.PLANET_ORDER.indexOf(I.normalizeBodyName(o.name));return(a===-1?999:a)-(r===-1?999:r)});this.planetsTable.innerHTML=t.map(s=>{let o=this.formatAstroCoordinate(s),a=this.createPlanetIconSVG(s),r=this.renderPlanetSpeedChip(s),c=this.renderFixedStarSymbolBadge(s),y=[this.showStationary?this.stationaryIndicatorHtml(s,"planet-status-badge--small"):"",this.retroIndicatorHtml(s.retrograde,"retro-indicator--small")].filter(Boolean).join(""),T=[this.dignityIndicatorHtml(s,"planet-status-badge--small"),this.sunRelationIndicatorHtml(s,"planet-status-badge--small"),this.solarPhaseIndicatorHtml(s,"planet-status-badge--small"),this.outOfBoundsIndicatorHtml(s,"planet-status-badge--small")].filter(Boolean).join("");return`
                <tr id="row-${s.name}" data-planet="${s.name}">
                    <td class="symbol-cell">
                        <div class="planet-symbol-cell">
                            <span class="planet-icon-wrap">
                                ${a}
                                ${c}
                            </span>
                            ${y?`<span class="planet-motion-stack">${y}</span>`:""}
                            <span class="planet-special-status-column" aria-hidden="true">${T}</span>
                        </div>
                    </td>
                    <td class="mono">
                        <div class="planet-position-main">${o}</div>
                    </td>
                    ${this.showSpeedColumn?`<td class="planet-speed-cell mono">${this.showSpeed?r:""}</td>`:""}
                    ${this.showHouseColumn?`<td class="mono">${this.escapeHtml(this.formatHouseNumber(s.house))}</td>`:""}
                </tr>
            `}).join(""),this.onPlanetsRendered?.(this)}getFixedStarContactsForPlanet(e){if(!this.showFixedStarBadges||!e)return[];let t=this.normalizeAspectBodyName(e);return(this.fixedStarsData?.conjunctions||[]).filter(s=>this.normalizeAspectBodyName(s?.object)===t).sort((s,o)=>Number(s.orb||0)-Number(o.orb||0))}findFixedStarInfo(e){let t=e?.star;return t?e?.star_info||(this.fixedStarsData?.stars||[]).find(s=>s?.name===t)||null:e?.star_info||null}fixedStarTooltipHtml(e){let t=this.findFixedStarInfo(e)||{},s=t.degree_in_sign_formatted&&t.sign?`${t.degree_in_sign_formatted} ${this.signName(t.sign)}`:e?.star_position||"",o=t.designation||"",a=t.magnitude!==null&&t.magnitude!==void 0?`m ${t.magnitude}`:"",r=t.nature||e?.nature||"",c=e?.object?this.planetName(e.object):"",y=e?.object_degree_in_sign_formatted&&e?.object_sign?`${e.object_degree_in_sign_formatted} ${this.signName(e.object_sign)}`:e?.object_position||"",T=Number(e?.orb),$=Number.isFinite(T)?`${T.toFixed(2)}°`:"";return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t.name||e?.star||"")}</div>
            ${s?`<div>${this.escapeHtml(s)}</div>`:""}
            ${o?`<div>${this.escapeHtml(o)}</div>`:""}
            ${a?`<div>${this.escapeHtml(a)}</div>`:""}
            ${r?`<div>${this.escapeHtml(r)}</div>`:""}
            ${c?`<div class="fixed-star-tooltip-contact">${this.escapeHtml(c)} ${this.escapeHtml(y)}${$?` · ${this.escapeHtml($)}`:""}</div>`:""}
        `.trim()}renderFixedStarSymbolBadge(e){let t=this.getFixedStarContactsForPlanet(e?.name);if(!t.length)return"";let s=this.fixedStarSummaryTooltipHtml(t),o=this.t("page.chart.settings.fixedStars.title"),a=t.length>1?`${o} (${t.length})`:o;return`
            <span
                class="fixed-star-badge fixed-star-badge--icon"
                role="img"
                tabindex="0"
                aria-label="${this.escapeHtml(a)}"
                data-fixed-star-tooltip="${this.escapeHtml(s)}"
            >✶</span>
        `}fixedStarSummaryTooltipHtml(e){if(e.length===1)return this.fixedStarTooltipHtml(e[0]);let t=this.t("page.chart.settings.fixedStars.title"),s=e.map(o=>{let a=this.findFixedStarInfo(o)||{},r=a.name||o?.star||"",c=a.degree_in_sign_formatted&&a.sign?`${a.degree_in_sign_formatted} ${this.signName(a.sign)}`:o?.star_position||"",y=Number(o?.orb),T=Number.isFinite(y)?`${y.toFixed(2)}°`:"";return`
                <div class="fixed-star-tooltip-row">
                    <span class="fixed-star-tooltip-star">✶ ${this.escapeHtml(r)}</span>
                    ${c?`<span class="fixed-star-tooltip-pos">${this.escapeHtml(c)}</span>`:""}
                    ${T?`<span class="fixed-star-tooltip-orb">${this.escapeHtml(T)}</span>`:""}
                </div>
            `}).join("");return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t)}</div>
            <div class="fixed-star-tooltip-list">${s}</div>
        `.trim()}renderPlanetSpeedChip(e){if(!e)return"";let t=this.resolveSpeedPercent(e);if(t!==null){if(!Number.isFinite(t))return"";let s="";return t<10?s=" planet-meta-chip--speed-slow":t>120&&(s=" planet-meta-chip--speed-fast"),`<span class="planet-meta-chip${s}">${Math.round(t)}%</span>`}if(e.speed!==void 0&&e.speed!==null){let s=Number(e.speed);if(!Number.isFinite(s))return"";if(s===0)return'<span class="planet-meta-chip planet-meta-chip--speed-slow">0%</span>';let o=this.formatCompactSpeed(s),a=this.formatSpeedValue(s),r=this.t("page.natalFull.units.degPerDay",{value:a});return`<span class="planet-meta-chip" title="${this.escapeHtml(r)}">${this.escapeHtml(o)}</span>`}return""}resolveSpeedPercent(e){let t=Number(e?.speed_percent);if(Number.isFinite(t))return t;let s={Proserpina:.001478},o=Number(e?.speed),a=s[e?.name];return!Number.isFinite(o)||!a?null:Math.round(Math.abs(o)/a*1e4)/100}formatSpeedValue(e){let t=Math.abs(Number(e));return!Number.isFinite(t)||t===0?"0.00":t>=1?t.toFixed(2):t>=.1?t.toFixed(3):t>=.01?t.toFixed(4):t.toFixed(5)}formatCompactSpeed(e){let t=Math.abs(Number(e));if(!Number.isFinite(t)||t===0)return"0°/д";if(t>=1)return`${t.toFixed(2)}°/д`;let s=t*60;return s>=1?`${s.toFixed(1)}′/д`:`${(s*60).toFixed(1)}″/д`}renderHouses(e){if(!e||!this.housesTable)return;let t=this.buildRetrogradeLookup(this.chartData?.planets||[]),s=this.buildPlanetHouseLookup(this.chartData?.planets||[]),o=new Set(s.keys());this.housesTable.innerHTML=e.map(a=>{let r=[1,4,7,10].includes(a.number),c=this.formatAstroCoordinate(a),y=a.included_sign||"",T=y&&Symbols.signs[y]||"",$=y?this.signName(y):"",x=y?`${this.t("page.natalFull.table.houses.included")}: ${$}`:"",D=this.buildHouseRulerGroups(a,s,o);return`
                <tr id="row-house-${a.number}" class="${r?"house-angular":""}">
                    <td class="mono">${this.escapeHtml(this.formatHouseNumber(a.number))}</td>
                    <td class="mono house-sign-cell">
                        <div class="house-sign-main">${c}</div>
                        ${y?`
                            <div class="house-sign-meta" title="${this.escapeHtml(x)}">
                                <span class="house-sign-badge">${this.escapeHtml(this.t("astro.feature.short.intercepted"))}</span>
                                <span class="astro-symbol">${T}</span>
                            </div>
                        `:""}
                    </td>
                    <td class="mono house-ruler-cell">
                        ${D.length?D.map(F=>this.renderHouseRulerGroup(F,t)).join(""):"—"}
                    </td>
                </tr>
            `}).join("")}formatAstroCoordinate(e){if(window.LocaleFormatters?.formatAstroCoordinate)return window.LocaleFormatters.formatAstroCoordinate(e,{signSymbol:Symbols?.signs?.[e?.sign],signClass:"astro-symbol"});let t=Number(e?.degree_in_sign);if(!Number.isFinite(t))return"";let s=Math.floor(t),o=Math.floor((t-s)*60),a=Symbols?.signs?.[e?.sign]||e?.sign||"",r=a?`<span class="astro-symbol">${a}</span>`:"";return[`${s}°`,r,`${String(o).padStart(2,"0")}'`].filter(Boolean).join(" ")}createPlanetIconSVG(e){let t=Symbols.signElements[e.sign],s=window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e.name,t,this.visualPreferences):Symbols.elementColors[t]||"#374151";if(window.AstroGlyphs?.hasPlanetIcon?.(e.name))return`
                <span class="planet-icon-svg">
                    ${window.AstroGlyphs.createPlanetSymbolMarkup(e.name,{size:28,color:s,title:this.planetName(e.name)})}
                </span>
            `;let a=this.getPlanetSymbol(e.name)||e.name.charAt(0),c=22*(Symbols.planetGlyphScale?.[e.name]||1);return`
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${(14+c*.36).toFixed(2)}" text-anchor="middle" font-size="${c.toFixed(2)}" font-weight="600" fill="${s}" class="planet-symbol-text">${a}</text>
                </svg>
            </span>
        `}formatDegreeShort(e){let t=Math.floor(e),s=Math.floor((e-t)*60);return`${t}°${s.toString().padStart(2,"0")}'`}normalizeAspectBodyName(e){return I.ASPECT_NAME_ALIASES[e]||e}formatHouseNumber(e){return e==null||e===""?"":Symbols?.formatHouseLabel?.(e,{style:this.houseNumberStyle})||String(e)}getAspectRank(e){let t=this.normalizeAspectBodyName(e);return I.ASPECT_SORT_RANK[t]??999}normalizeAspectForDisplay(e){let t=Number.isInteger(e.left_rank)?e.left_rank:this.getAspectRank(e.planet_1),s=Number.isInteger(e.right_rank)?e.right_rank:this.getAspectRank(e.planet_2),o=e.left_planet||e.planet_1,a=e.right_planet||e.planet_2,r=t,c=s;return(!e.left_planet||!e.right_planet)&&(s<t||t===s&&String(e.planet_2)<String(e.planet_1))&&(o=e.planet_2,a=e.planet_1,r=s,c=t),{...e,left_planet:this.normalizeAspectBodyName(o),right_planet:this.normalizeAspectBodyName(a),left_rank:r,right_rank:c}}getAspectTypeRank(e){return I.ASPECT_TYPE_RANK[e]??999}buildAspectKey(e,t){let s=this.normalizeAspectBodyName(e),o=this.normalizeAspectBodyName(t),a=this.getAspectRank(s),r=this.getAspectRank(o);return a<r?`${s}-${o}`:r<a?`${o}-${s}`:s<=o?`${s}-${o}`:`${o}-${s}`}getAspectKey(e){if(!e)return null;let t=e.left_planet||e.planet_1,s=e.right_planet||e.planet_2;return!t||!s?null:this.buildAspectKey(t,s)}compareAspectsByPlanet(e,t){return e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.orb!==t.orb?e.orb-t.orb:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type)}compareAspectsByType(e,t){let s=this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type);return s!==0?s:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:e.orb-t.orb}compareAspectsByOrb(e,t){return e.is_major!==t.is_major?Number(t.is_major)-Number(e.is_major):e.orb!==t.orb?e.orb-t.orb:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank-t.right_rank}renderAspectTypeCell(e){let s=`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`,o=this.showAspectText?` ${this.aspectName(e.aspect_type)}`:"";return`${s}${o}`}renderAspectTypeIcon(e){return`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`}renderAspectPairCell(e){if(!e)return"";let t=this.escapeHtml(this.planetName(e.left_planet)),s=this.escapeHtml(this.planetName(e.right_planet)),o=this.escapeHtml(this.aspectName(e.aspect_type));return`
            <span class="aspect-chip" aria-label="${t} ${o} ${s}">
                <span class="aspect-chip__body" title="${t}">${this.getPlanetSymbolMarkup(e.left_planet,{size:15,title:this.planetName(e.left_planet)})}</span>
                <span class="aspect-chip__type" title="${o}">${this.renderAspectTypeIcon(e)}</span>
                <span class="aspect-chip__body" title="${s}">${this.getPlanetSymbolMarkup(e.right_planet,{size:15,title:this.planetName(e.right_planet)})}</span>
            </span>
        `}renderAspects(e){if(!this.aspectsTable)return;if(!e||e.length===0){this.aspectsTable.innerHTML="";return}let t=e;this.aspectTypeFilter==="major"?t=t.filter(a=>a.is_major):this.aspectTypeFilter==="minor"&&(t=t.filter(a=>!a.is_major)),this.aspectPlanetFilter&&(t=t.filter(a=>{let r=this.normalizeAspectBodyName(a.planet_1),c=this.normalizeAspectBodyName(a.planet_2);return r===this.aspectPlanetFilter||c===this.aspectPlanetFilter}));let o=[...t.map(a=>this.normalizeAspectForDisplay(a))].sort((a,r)=>{let c=0;switch(this.aspectSortState.field){case"type":c=this.compareAspectsByType(a,r);break;case"orb":c=this.compareAspectsByOrb(a,r);break;case"planet":default:c=this.compareAspectsByPlanet(a,r);break}return this.aspectSortState.ascending?c:-c});if(o.length===0){this.aspectsTable.innerHTML='<tr><td colspan="3" class="text-muted">—</td></tr>';return}this.aspectsTable.innerHTML=o.map(a=>{let r=this.getAspectKey(a),c=this.showApplyingSeparating?this.getApplyingSeparatingShortLabel(a):"";return`
                <tr data-aspect="${r||""}" data-aspect-key="${r||""}" data-aspect-type="${this.escapeHtml(a.aspect_type||"")}">
                    <td>${this.renderAspectPairCell(a)}</td>
                    <td class="aspect-phase-cell">${c?this.escapeHtml(c):"—"}</td>
                    <td class="mono">${a.orb.toFixed(2)}°</td>
                </tr>
            `}).join("")}renderGridHeaderBody(e){let t=this.getPlanetSymbolMarkup(e.name,{size:15,title:this.planetName(e.name)}),s=this.retroIndicatorHtml(e.retrograde,"retro-indicator--micro");return`<span class="aspect-grid-body">${t}${s}</span>`}renderAspectGrid(e,t){if(!this.aspectGridContainer||!e||!t)return;let s=this.getAspectRank("PartOfFortune"),o=new Map;t.forEach(y=>{let T=this.normalizeAspectBodyName(y.name);this.getAspectRank(T)>s||o.has(T)||o.set(T,{...y,name:T})});let a=[...o.values()].sort((y,T)=>this.getAspectRank(y.name)-this.getAspectRank(T.name)),r={};e.forEach(y=>{let T=this.getAspectKey(y);T&&(r[T]=y)});let c='<table class="aspect-grid">';c+="<tr><th></th>",a.forEach(y=>{c+=`<th title="${this.planetName(y.name)}">${this.renderGridHeaderBody(y)}</th>`}),c+="</tr>",a.forEach((y,T)=>{c+=`<tr><th title="${this.planetName(y.name)}">${this.renderGridHeaderBody(y)}</th>`,a.forEach(($,x)=>{if(x>=T)c+="<td></td>";else{let D=this.buildAspectKey(y.name,$.name),F=r[D];if(F){let oe=this.getAspectSymbol(F.aspect_type),Q=F.harmonic_type==="harmonious"?"grid-harmonious":F.harmonic_type==="tense"?"grid-tense":"grid-neutral";c+=`<td class="${Q}" data-aspect-key="${D}" data-aspect-type="${this.escapeHtml(F.aspect_type||"")}" title="${this.aspectName(F.aspect_type)} ${F.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(F.aspect_type,this.visualPreferences,F.harmonic_type):"#9ca3af"}">${oe}</span></td>`}else c+="<td>–</td>"}}),c+="</tr>"}),c+="</table>",this.aspectGridContainer.innerHTML=c}clearHoveredAspect(){this.hoveredAspectKey=null,this.aspectsTable&&this.aspectsTable.querySelectorAll("tr.aspect-hover-row").forEach(e=>{e.classList.remove("aspect-hover-row")}),this.aspectGridContainer&&this.aspectGridContainer.querySelectorAll("td.grid-hover").forEach(e=>{e.classList.remove("grid-hover")})}setHoveredAspect(e,t={}){let s=t.surface==="grid"?"grid":"table";if(this.clearHoveredAspect(),!!e){if(this.hoveredAspectKey=e,s==="table"&&this.aspectsTable){let o=this.aspectsTable.querySelector(`tr[data-aspect-key="${e}"]`);o&&o.classList.add("aspect-hover-row");return}if(s==="grid"&&this.aspectGridContainer){let o=this.aspectGridContainer.querySelector(`td[data-aspect-key="${e}"]`);o&&o.classList.add("grid-hover")}}}renderDignities(e){if(!this.dignitiesContainer||!e)return;let t={domicile:{label:this.t("astro.dignity.domicile"),class:"dignity-domicile",icon:"🏠"},exaltation:{label:this.t("astro.dignity.exaltation"),class:"dignity-exaltation",icon:"⬆"},detriment:{label:this.t("astro.dignity.detriment"),class:"dignity-detriment",icon:"⬇"},fall:{label:this.t("astro.dignity.fall"),class:"dignity-fall",icon:"💫"},neutral:{label:"",class:"",icon:""}},s=e.filter(a=>a.dignity&&a.dignity!=="neutral");if(s.length===0){this.dignitiesContainer.innerHTML=`<p class="text-muted">${this.t("page.chart.empty.noDignities")}</p>`;return}let o='<div class="dignities-list">';s.forEach(a=>{let r=t[a.dignity]||t.neutral;o+=`
                <div class="dignity-item ${r.class}">
                    <span class="dignity-planet">${this.getPlanetSymbolMarkup(a.name,{size:16,title:this.planetName(a.name)})} ${this.planetName(a.name)}</span>
                    <span class="dignity-label">${r.icon} ${r.label}</span>
                </div>
            `}),o+="</div>",this.dignitiesContainer.innerHTML=o}renderConfigurations(e,t){if(!this.configsContainer)return;let s="";if(e&&e.length>0){let o=[...e].sort((a,r)=>{let c=a.strength_score||0;return(r.strength_score||0)-c});s+=`<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t("page.chart.configurations.title")}</h3>`,s+=o.map(a=>`
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
                        ${a.planets_involved.filter(r=>r!==a.apex_planet).map(r=>{let c=this.buildConfigurationPointTooltip(r,a.aspects||[]),y=this.escapeHtml(this.planetName(r)),T=c?` data-config-point-tooltip="${this.escapeHtml(c)}" data-config-point-name="${y}"`:"";return`
                            <span class="planet-tag planet-tag--icon-only planet-tag--config-point"${c?"":` title="${y}"`} aria-label="${y}"${T}>
                                ${this.getPlanetSymbolMarkup(r,{size:16,title:this.planetName(r)})}
                            </span>
                        `}).join("")}
                    </div>
                </div>
            `).join("")}if(t&&t.length>0){let o=[...t].sort((a,r)=>(r.count||0)-(a.count||0));s+=`<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t("page.chart.configurations.stelliums")}</h3>`,s+=o.map(a=>`
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
            `).join("")}s||(s=`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.configsContainer.innerHTML=s}buildConfigurationPointTooltip(e,t){if(!e||!Array.isArray(t)||!t.length)return"";let s=this.normalizeAspectBodyName(e),o=t.filter(a=>{let r=this.normalizeAspectBodyName(a?.planet_1),c=this.normalizeAspectBodyName(a?.planet_2);return r===s||c===s});return o.length?`
            <div class="config-point-tooltip-title">${this.escapeHtml(this.planetName(e))}</div>
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
        `.trim():""}formatConfigType(e){let t=`astro.configuration.${e}`,s=this.t(t);return s===t?e.replace(/_/g," "):s}renderBalances(e,t){if(!this.balancesContainer)return;let s="";if(!e){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}let o=[{key:"by_sign",label:this.t("page.chart.balances.tabs.sign"),data:e.by_sign},{key:"by_house",label:this.t("page.chart.balances.tabs.house"),data:e.by_house}].filter(a=>this.hasBalanceData(a.data));if(!o.length){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}if(o.length===1){s+=this.renderBalanceSet(o[0].key,o[0].data),this.balancesContainer.innerHTML=s;return}s+=`
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
        `,this.balancesContainer.innerHTML=s,this.initBalanceTabs()}hasBalanceData(e){return!!(e&&Object.values(e).some(t=>t&&Object.keys(t).length))}initBalanceTabs(){let e=this.balancesContainer.querySelectorAll("[data-balance-tab]"),t=this.balancesContainer.querySelectorAll("[data-balance-panel]");!e.length||!t.length||e.forEach(s=>{s.addEventListener("click",()=>{let o=s.dataset.balanceTab;e.forEach(a=>{let r=a.dataset.balanceTab===o;a.classList.toggle("active",r),a.setAttribute("aria-selected",r?"true":"false")}),t.forEach(a=>{a.classList.toggle("active",a.dataset.balancePanel===o)})})})}renderBalanceSet(e,t){let s="",o="#9ca3af",a=r=>window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(r,this.visualPreferences):{Fire:"#ef4444",Earth:"#84cc16",Air:"#f59e0b",Water:"#3b82f6"}[r]||o;if(t.element_balance){let r=t.element_balance,c=r.fire+r.earth+r.air+r.water;s+=this.renderBalanceSection(this.t("page.chart.balances.elementsTitle"),[{label:this.t("astro.element.Fire"),value:r.fire,total:c,color:a("Fire")},{label:this.t("astro.element.Earth"),value:r.earth,total:c,color:a("Earth")},{label:this.t("astro.element.Air"),value:r.air,total:c,color:a("Air")},{label:this.t("astro.element.Water"),value:r.water,total:c,color:a("Water")}])}if(e==="by_sign"&&t.mode_balance){let r=t.mode_balance,c=r.cardinal+r.fixed+r.mutable;s+=this.renderBalanceSection(this.t("page.chart.balances.modesTitle"),[{label:this.t("astro.mode.short.Cardinal"),value:r.cardinal,total:c,color:o},{label:this.t("astro.mode.short.Fixed"),value:r.fixed,total:c,color:o},{label:this.t("astro.mode.short.Mutable"),value:r.mutable,total:c,color:o}])}if(e==="by_house"&&t.house_group_balance){let r=t.house_group_balance,c=r.angular+r.succedent+r.cadent;s+=this.renderBalanceSection(this.t("page.chart.balances.houseGroupsTitle"),[{label:this.t("page.chart.balances.angular"),value:r.angular,total:c,color:o},{label:this.t("page.chart.balances.succedent"),value:r.succedent,total:c,color:o},{label:this.t("page.chart.balances.cadent"),value:r.cadent,total:c,color:o}])}if(t.gender_balance){let r=t.gender_balance,c=r.masculine+r.feminine;s+=this.renderBalanceSection(this.t("page.chart.balances.polarityTitle"),[{label:this.t("astro.polarity.Masculine"),value:r.masculine,total:c,color:o},{label:this.t("astro.polarity.Feminine"),value:r.feminine,total:c,color:o}])}if(t.zones_balance){let r=t.zones_balance,c=r.brahma+r.vishnu+r.shiva;s+=this.renderBalanceSection(this.t("page.chart.balances.zonesTitle"),[{label:this.t("page.chart.balances.brahma"),value:r.brahma,total:c,color:o},{label:this.t("page.chart.balances.vishnu"),value:r.vishnu,total:c,color:o},{label:this.t("page.chart.balances.shiva"),value:r.shiva,total:c,color:o}])}if(t.quadrant_balance){let r=t.quadrant_balance,c=r.q1+r.q2+r.q3+r.q4;s+=this.renderBalanceSection(this.t("page.chart.balances.quadrantsTitle"),[{label:this.t("page.chart.balances.quadrant1"),value:r.q1,total:c,color:o},{label:this.t("page.chart.balances.quadrant2"),value:r.q2,total:c,color:o},{label:this.t("page.chart.balances.quadrant3"),value:r.q3,total:c,color:o},{label:this.t("page.chart.balances.quadrant4"),value:r.q4,total:c,color:o}])}if(t.hemisphere_balance){let r=t.hemisphere_balance,c=r.lower+r.upper,y=r.eastern+r.western;s+=this.renderBalanceSection(this.t("page.chart.balances.hemispheresTitle"),[{label:this.t("page.chart.balances.lower"),value:r.lower,total:c,color:o},{label:this.t("page.chart.balances.upper"),value:r.upper,total:c,color:o},{label:this.t("page.chart.balances.east"),value:r.eastern,total:y,color:o},{label:this.t("page.chart.balances.west"),value:r.western,total:y,color:o}])}return s}renderBalanceSection(e,t){return`
            <div class="balance-section">
                <div class="balance-title">${e}</div>
                ${t.map(s=>{let o=s.total>0?s.value/s.total*100:0,a=s.color?`background: ${s.color};`:"",r=s.color?`color: ${s.color};`:"";return`
                        <div class="balance-row">
                            <span class="balance-label" style="${r}">${s.label}</span>
                            <div class="balance-bar-container">
                                <div class="balance-bar" style="${a} width: ${o}%"></div>
                            </div>
                            <span class="balance-value" style="${r}">${s.value}</span>
                        </div>
                    `}).join("")}
            </div>
        `}formatPatternType(e){let t=`astro.pattern.${e}`,s=this.t(t);return s!==t?s:e}};J(I,"ASPECT_SORT_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","MC","IC","DSC","Vertex","AntiVertex"]),J(I,"ASPECT_NAME_ALIASES",{TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"}),J(I,"ASPECT_SORT_RANK",I.ASPECT_SORT_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),J(I,"ASPECT_TYPE_ORDER",["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"]),J(I,"ASPECT_TYPE_RANK",I.ASPECT_TYPE_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),J(I,"PLANET_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune"]);var ge=I;window.ChartDataRenderer=ge;(function(){"use strict";let e=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],t=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],s=t.slice(0,10),o="dispositorChainDisplayOptions",a={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},r={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},c=Object.fromEntries(e.map((n,l)=>[n,e[(l+6)%12]])),y={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},T={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function $(n,l){return window.FrontendI18n?.t?.(n,l)||n}function x(n){return String(n??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function D(n){return T[n]||n}function F(n){if(!n)return"—";let l=`astro.planet.${n}`,i=$(l);return i!==l?i:window.Symbols?.getPlanetNameRu?.(n)||window.Symbols?.planetNamesRu?.[n]||n}function oe(n){if(!n)return"—";let l=`astro.sign.${n}`,i=$(l);return i!==l?i:window.Symbols?.signNamesRu?.[n]||n}function Q(n,l=16){return window.Symbols?.getPlanetSymbolMarkup?.(n,{size:l,title:F(n)})||`<span class="astro-symbol">${x(window.Symbols?.getPlanetSymbol?.(n)||"")}</span>`}function fe(n){return[window.Symbols?.signs?.[n]||"",oe(n)].filter(Boolean).join(" ")}function ie(){let n={},l=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return e.forEach(i=>{let p=y[i]||{},u=l?.[i]||{},g=D(u.ruler||p.ruler||null),P=D(u.co_ruler||p.co_ruler||null),_=D(u.exaltation||p.exaltation||null);g&&P&&g===P&&(P=null),n[i]={ruler:g,co_ruler:P,exaltation:_}}),n}function ae(n,l,i=ie()){let p=i?.[n]||{},u=i?.[c[n]]||{};return l==="exaltation"?p.exaltation||null:l==="detriment"?u.ruler||null:l==="fall"?u.exaltation||null:p.ruler||null}function be(n,l,i,p=a){return n?p.classicalRulers&&l==="domicile"?r[n]||ae(n,l,i):p.classicalRulers&&l==="detriment"&&r[c[n]]||ae(n,l,i):null}function ye(n){return(Array.isArray(n?.planets)?n.planets:[]).filter(i=>i?.name&&i?.sign&&t.includes(D(i.name))).map(i=>({...i,name:D(i.name)})).sort((i,p)=>t.indexOf(i.name)-t.indexOf(p.name))}function $e(n,l){let i=ie(),p=ye(n),u=new Map(p.map(S=>[S.name,S])),g=[],P=new Map;p.forEach(S=>{let v=[],b=new Map,m=S,N=null,E=[];for(;m?.name&&!b.has(m.name);){b.set(m.name,v.length);let w=ae(m.sign,l,i);if(v.push({planet:m.name,sign:m.sign,ruler:w,retrograde:!!m.retrograde}),!w){N="none";break}if(!u.has(w)){N=w;break}if(w===m.name){N=w;break}m=u.get(w)}if(!N&&m?.name&&b.has(m.name)){let w=b.get(m.name);E=v.slice(w).map(B=>B.planet),N=E.join("+")}P.set(N,(P.get(N)||0)+1),g.push({start:S.name,steps:v,finalKey:N,cycle:E})});let _=[...P.entries()].filter(([S])=>S&&S!=="none").sort((S,v)=>v[1]-S[1]||S[0].localeCompare(v[0])).slice(0,4);return{chains:g,mainRulers:_}}function le(n){if(!n)return`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noJones"))}</p>`;let l=(()=>{let p=`astro.pattern.${n.pattern_type}`,u=$(p);return u===p?n.pattern_type||"—":u})(),i=[];return Number.isFinite(Number(n.empty_arc_degree))&&i.push($("page.chart.balances.emptyArc",{value:Number(n.empty_arc_degree).toFixed(0)})),n.handle_planet&&i.push($("page.chart.balances.handle",{planet:F(n.handle_planet)})),n.leading_planet&&i.push($("page.chart.balances.leading",{planet:F(n.leading_planet)})),`
            <article class="dispositor-jones-card" title="${x([$("page.chart.rulers.jonesKicker"),l,...i].join(" · "))}">
                <h4>${x(l)}</h4>
                ${i.length?`<p>${x(i.join(" · "))}</p>`:""}
            </article>
        `}function Me(n){return n.length?`
            <div class="dispositor-main-rulers">
                ${n.map(([l,i])=>{let p=l.split("+").filter(Boolean),u=p.map(F).join(" + ");return`
                        <span class="dispositor-main-chip" title="${x(u)}">
                            ${p.map(g=>Q(g,15)).join("")}
                            <b>${i}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noMainRulers"))}</p>`}function ce(n,l="",i=""){let p=[F(n.planet),n.sign?fe(n.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${l}" style="${x(i)}" title="${x(p)}" aria-label="${x(p)}">
                ${Q(n.planet,15)}
            </span>
        `}function et(n){let l=[...n.steps].reverse().map((p,u)=>{let g=u===0&&n.finalKey!=="none";return ce(p,g?"dispositor-chain-node--main":"")}),i=n.steps[n.steps.length-1];return i?.ruler&&!n.steps.some(p=>p.planet===i.ruler)&&l.unshift(ce({planet:i.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${l.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function K(n){return[...new Set(n)].sort((l,i)=>{let p=t.indexOf(l),u=t.indexOf(i);return(p===-1?999:p)-(u===-1?999:u)})}function Ce(n){return K(n).join("+")}function Ee(n){let l=n?.number??n?.house_number,i=Number(l);return Number.isInteger(i)?i:l}function Be(n){let l=[...new Set(n)].map(i=>Number(i)).filter(i=>Number.isInteger(i)).sort((i,p)=>i-p);return l.length?window.Symbols?.formatHouseList?.(l,{style:"roman",separator:","})||l.map(i=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][i-1]||String(i)).join(","):""}function Le(n,l,i,p=a){return l==="domicile"&&n?.ruler_planet&&!p.classicalRulers?D(n.ruler_planet):D(be(n?.sign,l,i,p))}function Se(n,l,i=a){let p=ie(),u=ye(n),g=new Map(u.map(b=>[b.name,b])),P=Array.isArray(n?.houses)?n.houses:[],_=new Map,S=[];return P.forEach(b=>{let m=Le(b,l,p,i),N=Ee(b);!m||!N||(_.has(m)||_.set(m,[]),_.get(m).push(N),S.push(m))}),u.forEach(b=>{s.includes(b.name)&&S.push(b.name)}),{chains:K(S).map(b=>{let m=[],N=new Map,E=g.get(b)||{name:b,sign:null,retrograde:!1},w=null,B=[];for(;E?.name&&!N.has(E.name);){N.set(E.name,m.length);let L=E.sign?be(E.sign,l,p,i):null;if(m.push({planet:E.name,sign:E.sign,ruler:L,retrograde:!!E.retrograde}),!L){w=E.name;break}if(!g.has(L)){w=L;break}if(L===E.name){w=L;break}E=g.get(L)}if(!w&&E?.name&&N.has(E.name)){let L=N.get(E.name);B=m.slice(L).map(q=>q.planet),w=Ce(B)}return{start:b,steps:m,finalKey:w,cycle:B}}),housesByRuler:_}}function _e(n,l,i,p=""){let u=i.showHouseRulers?Be(l.get(n.planet)||[]):"",g=[F(n.planet),n.sign?fe(n.sign):"",u?`${$("common.house")} ${u}`:""].filter(Boolean).join(" · "),P=Number.isFinite(n.x)&&Number.isFinite(n.y)?` style="left:${n.x}px; top:${n.y}px;"`:"";return`
            <span
                class="dispositor-compact-node ${p}"
                ${P}
                title="${x(g)}"
                aria-label="${x(g)}"
            >
                <span class="dispositor-compact-symbol">${Q(n.planet,32)}</span>
                ${u?`<span class="dispositor-house-label">${x(u)}</span>`:""}
            </span>
        `}function we(n,l,i,p,u=""){let g=l.get(n)||{planet:n,sign:null};return _e(g,i,p,`dispositor-compact-node--static ${u}`.trim())}function ve(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function Ae(n,l){let i=n&&n!=="none"?n.split("+").filter(Boolean):[];if(i.length<=2)return[];let p=new Set(i),u=(P=[])=>P.length===i.length&&P.every(_=>p.has(_)),g=l.find(P=>u(P.cycle||[]))?.cycle;return g?[...g]:[]}function Re(n){let l=new Map;return n.forEach(i=>{i.steps.forEach(p=>{if(!p?.planet)return;let u=l.get(p.planet)||{planet:p.planet,sign:null};l.set(p.planet,{...u,sign:u.sign||p.sign||null,retrograde:u.retrograde||!!p.retrograde})})}),l}function je(n,l,i,p){let u=Ae(n,l),g=new Set(u),P=Re(l),_=[...u,u[0]].filter(Boolean),S=[],v=new Set;return l.forEach(b=>{let m=b.steps.findIndex(w=>g.has(w.planet));if(m<=0)return;let N=b.steps.slice(0,m+1).map(w=>w.planet),E=N.join(">");v.has(E)||(v.add(E),S.push(N))}),`
            <section class="dispositor-compact-group" aria-label="${x($("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${_.map((b,m)=>`
                            ${m>0?ve():""}
                            ${we(b,P,i,p,`dispositor-compact-node--main${m===_.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${S.length?`
                        <div class="dispositor-cycle-branches">
                            ${S.map(b=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${b.map((m,N)=>`
                                        ${N>0?ve():""}
                                        ${we(m,P,i,p,g.has(m)?"dispositor-compact-node--main":"")}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function Fe(n,l,i){let p=[],u=new Set;if(n.forEach(_=>{let S=_.steps.map(v=>v.planet).join(">");u.has(S)||(u.add(S),p.push(_))}),!p.length)return`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`;let g=new Map;return p.forEach(_=>{let S=_.finalKey||"none";g.has(S)||g.set(S,[]),g.get(S).push(_)}),`
            <div class="dispositor-compact-diagram">
                ${[...g.entries()].sort((_,S)=>{let v=new Set(_[1].flatMap(m=>m.steps.map(N=>N.planet))).size,b=new Set(S[1].flatMap(m=>m.steps.map(N=>N.planet))).size;return v-b||String(_[0]).localeCompare(String(S[0]))}).map(([_,S],v)=>{if(Ae(_,S).length>2)return je(_,S,l,i);let m=xe(_,S),N=`url(#dispositorCompactArrow${v})`,E=` marker-end="${N}"`,w=` marker-start="${N}" marker-end="${N}"`;return`
                        <section class="dispositor-compact-group" aria-label="${x($("page.chart.rulers.modalTitle"))} ${v+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${m.width}px; --graph-height:${m.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${m.width} ${m.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${v}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${m.edges.map(B=>`
                                        <path d="${x(B.path)}"${E}></path>
                                    `).join("")}
                                    ${m.mutualEdges.map(B=>`
                                        <path class="dispositor-compact-mutual" d="${x(B.path)}"${w}></path>
                                    `).join("")}
                                </svg>
                                ${m.nodes.map(B=>_e(B,l,i,B.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function xe(n,l){let S=n&&n!=="none"?n.split("+").filter(Boolean):[],v=new Map,b=[],m=new Set,N=(d,f={})=>{if(!d)return null;let A=v.get(d)||{planet:d,sign:null,retrograde:!1};return v.set(d,{...A,sign:A.sign||f.sign||null,retrograde:A.retrograde||!!f.retrograde}),v.get(d)},E=(d,f)=>{let A=d?.planet,k=f?.planet;if(!A||!k||A===k)return;N(A,d),N(k,f);let M=`${A}->${k}`;m.has(M)||(m.add(M),b.push({child:A,parent:k}))};l.forEach(d=>{d.steps.forEach(f=>N(f.planet,f));for(let f=0;f<d.steps.length;f+=1){let A=d.steps[f],k=d.steps[f+1];k?E(A,k):A?.ruler&&!d.steps.some(M=>M.planet===A.ruler)&&E(A,{planet:A.ruler})}});let w=S.length?K(S):K([...v.keys()].filter(d=>!b.some(f=>f.child===d)));!w.length&&v.size&&w.push([...v.keys()][0]);let B=new Set(w),L=new Map,q=[],Z=[];b.forEach(d=>{if(B.has(d.child)&&B.has(d.parent)){let f=K([d.child,d.parent]).join("<->");q.some(A=>A.key===f)||q.push({...d,key:f});return}Z.push(d),L.has(d.parent)||L.set(d.parent,[]),L.get(d.parent).push(d.child)}),L.forEach((d,f)=>{L.set(f,K(d))});let U=!1,ee=(()=>{if(w.length<=2)return w;let d=(j=[])=>j.length===w.length&&j.every(z=>B.has(z)),f=l.find(j=>d(j.cycle||[]))?.cycle;if(f)return U=!0,[...f];let A=new Map(q.map(j=>[j.child,j.parent]));U=q.length>=w.length-1;let k=[],M=w[0];for(;M&&B.has(M)&&!k.includes(M);)k.push(M),M=A.get(M);return w.forEach(j=>{k.includes(j)||k.push(j)}),k})(),O=new Map,te=(d,f,A)=>{let k=8,M=(z,Y=0,V=new Set)=>{if(O.has(z))return O.get(z);if(V.has(z)){let W={x:A+f*Y*60,y:k};return k+=58,O.set(z,W),W}V.add(z);let Te=(L.get(z)||[]).filter(W=>!B.has(W)),me;if(!Te.length)me=k,k+=58;else{let W=Te.map(se=>M(se,Y+1,new Set(V)));me=(Math.min(...W.map(se=>se.y))+Math.max(...W.map(se=>se.y)))/2}V.delete(z);let He={x:A+f*Y*60,y:me};return O.set(z,He),He};return{rootPosition:M(d,0),height:k}},re=d=>{let f=[],A=[d],k=new Set;for(;A.length;){let M=A.pop();!M||k.has(M)||(k.add(M),f.push(M),(L.get(M)||[]).forEach(j=>{B.has(j)||A.push(j)}))}return f},h=(d,f)=>{re(d).forEach(A=>{let k=O.get(A);k&&(k.y+=f)})};if(w.length===2){let d=w[0],f=w[1],A=te(d,-1,0),k=te(f,1,72),M=Math.max(A.rootPosition.y,k.rootPosition.y);h(d,M-A.rootPosition.y),h(f,M-k.rootPosition.y)}else{let d=8;ee.forEach((f,A)=>{te(f,-1,0);let M=re(f).map(V=>O.get(V)).filter(Boolean);if(!M.length)return;let j=Math.min(...M.map(V=>V.y)),z=Math.max(...M.map(V=>V.y)),Y=d-j;Y&&h(f,Y),d=z+Y+(A===w.length-1?0:58)})}v.forEach((d,f)=>{O.has(f)||O.set(f,{x:0,y:8+O.size*58})});let C=Math.min(...[...O.values()].map(d=>d.x)),H=Math.min(...[...O.values()].map(d=>d.y));O.forEach(d=>{d.x=d.x-C+8,d.y=d.y-H+8});let R=[...v.values()].map(d=>({...d,isRoot:B.has(d.planet),...O.get(d.planet)||{x:8,y:8}})),G=new Map(R.map(d=>[d.planet,d])),X=d=>{let f=G.get(d.child),A=G.get(d.parent);if(!f||!A)return null;let k=1,M=f.x<A.x,j=M?f.x+42+k:f.x-k,z=M?A.x-k:A.x+42+k,Y=f.y+21,V=A.y+21;return{...d,path:`M${j},${Y} L${z},${V}`}},ue=d=>{let f=G.get(d.child),A=G.get(d.parent);if(!f||!A)return null;let k=Math.max(f.x,A.x)+42+8,M=k,j=f.y+21,z=A.y+21;if(z>=j)return{...d,path:`M${k},${j} L${M},${z}`};let Y=k+14;return{...d,path:`M${k},${j} L${Y},${j} L${Y},${z} L${M},${z}`}},he=w.length>2&&U?ee.map((d,f)=>({child:d,parent:ee[(f+1)%ee.length]})).filter(d=>d.child&&d.parent&&d.child!==d.parent):[],Xe=[...Z.map(X).filter(Boolean),...he.map(ue).filter(Boolean)],We=w.length>2&&U?[]:q.map(X).filter(Boolean),Je=Math.max(220,Math.ceil(Math.max(...R.map(d=>d.x+42))+8)),Qe=Math.max(70,Math.ceil(Math.max(...R.map(d=>d.y+58))+8));return{width:Je,height:Qe,nodes:R,edges:Xe,mutualEdges:We}}function ze(n){let l=[],i=new Set;n.forEach(u=>{let g=u.steps.map(P=>P.planet).join(">");i.has(g)||(i.add(g),l.push(u))});let p=new Map;return l.forEach(u=>{let g=u.finalKey||"none";p.has(g)||p.set(g,[]),p.get(g).push(u)}),l.length?`
            <div class="dispositor-diagram">
                ${[...p.entries()].map(([u,g])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Ge(u,g.length)}
                        </div>
                        ${Ie(u,g)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`}function Ie(n,l){let i=Oe(n,l);return i.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${i.edges.map(p=>`
                        <path d="${x(p.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${i.nodes.map(p=>ce(p,p.isRoot?"dispositor-chain-node--main":"",`left:${p.x}px; top:${p.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`}function Oe(n,l){let P=new Set(n&&n!=="none"?n.split("+").filter(Boolean):[]),_=new Map,S=[],v=new Set,b=new Map,m=new Map,N=(h,C={})=>{if(!h)return null;let H=_.get(h)||{planet:h,sign:null,retrograde:!1};return _.set(h,{...H,sign:H.sign||C.sign||null,retrograde:H.retrograde||!!C.retrograde}),_.get(h)},E=(h,C)=>{let H=h?.planet,R=C?.planet;if(!H||!R||H===R||P.has(H)&&P.has(R))return;N(H,h),N(R,C);let G=`${H}->${R}`;v.has(G)||(v.add(G),S.push({child:H,parent:R}),m.set(H,R),b.has(R)||b.set(R,[]),b.get(R).push(H))};l.forEach(h=>{h.steps.forEach(H=>N(H.planet,H));for(let H=0;H<h.steps.length-1;H+=1)E(h.steps[H],h.steps[H+1]);let C=h.steps[h.steps.length-1];C?.ruler&&!h.steps.some(H=>H.planet===C.ruler)&&E(C,{planet:C.ruler})}),P.size||[..._.keys()].forEach(h=>{m.has(h)||P.add(h)}),!P.size&&_.size&&P.add([..._.keys()][0]),b.forEach((h,C)=>{b.set(C,K(h))});let w=new Map,B=(h,C=0)=>{w.has(h)&&w.get(h)<=C||(w.set(h,C),(b.get(h)||[]).forEach(H=>B(H,C+1)))};K([...P]).forEach(h=>B(h,0)),_.forEach((h,C)=>{w.has(C)||w.set(C,0)});let L=24,q=new Map,Z=(h,C=new Set)=>{if(q.has(h))return q.get(h);if(C.has(h)){let G=L;return L+=76,q.set(h,G),G}C.add(h);let H=b.get(h)||[],R;if(!H.length)R=L,L+=76;else{let G=H.map(X=>Z(X,new Set(C)));R=(Math.min(...G)+Math.max(...G))/2}return C.delete(h),q.set(h,R),R};K([...P]).forEach(h=>Z(h)),_.forEach((h,C)=>Z(C));let U=[..._.values()].map(h=>({...h,isRoot:P.has(h.planet),x:24+(w.get(h.planet)||0)*128,y:q.get(h.planet)||24})),de=new Map(U.map(h=>[h.planet,h])),ee=Math.max(0,...U.map(h=>w.get(h.planet)||0)),O=Math.max(180,L+24),te=Math.max(520,48+ee*128+44),re=S.map(h=>{let C=de.get(h.child),H=de.get(h.parent);if(!C||!H)return null;let R=C.x,G=C.y+44/2,X=H.x+44,ue=H.y+44/2,he=Math.max(X+18,R-42);return{...h,path:`M${R},${G} H${he} V${ue} H${X}`}}).filter(Boolean);return{width:te,height:O,nodes:U,edges:re}}function Ge(n,l){if(!n||n==="none")return`
                <span class="dispositor-diagram-group-title">${x($("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${l}</span>
            `;let i=n.split("+").filter(Boolean),p=i.map(F).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${x(p)}">
                ${i.map(u=>Q(u,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${l}</span>
        `}function De(n){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${x($("page.chart.rulers.modeLabel"))}">
                ${l.map(i=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${i===n?" active":""}"
                        data-dispositor-mode="${i}"
                        role="tab"
                        aria-selected="${i===n?"true":"false"}"
                    >${x($(`astro.dignity.${i}`))}</button>
                `).join("")}
            </div>
        `}function Pe(n){return["domicile","exaltation","detriment","fall"].includes(n)?n:a.mode}function qe(n={}){let l={};try{l=JSON.parse(window.localStorage?.getItem(o)||"{}")||{}}catch{l={}}return{...a,mode:Pe(n.mode||l.mode||a.mode),showArrowDirection:(n.showArrowDirection??l.showArrowDirection??a.showArrowDirection)!==!1,showHouseRulers:(n.showHouseRulers??l.showHouseRulers??a.showHouseRulers)!==!1,classicalRulers:(n.classicalRulers??l.classicalRulers??a.classicalRulers)===!0}}function Ye(n){try{window.localStorage?.setItem(o,JSON.stringify(n))}catch{}}function Ne(n){let l=`page.chart.rulers.chainModes.${n}`,i=$(l);return i!==l?i:$(n==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${n}`)}function Ve(n){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${x(Ne(n.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${x($("page.chart.rulers.options.chainType"))}">
                        ${l.map(i=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${x(i)}"
                                    data-dispositor-option="mode"
                                    ${i===n.mode?"checked":""}
                                >
                                <span>${x(Ne(i))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${n.showHouseRulers?"checked":""}>
                        <span>${x($("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${n.classicalRulers?"checked":""}>
                        <span>${x($("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function pe(n,l,i){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <h4>${x($("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Ve(i)}
                </div>
                ${Fe(n,l,i)}
            </div>
        `}function Ke(n,l,i,p){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${x($("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${x($("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${x($("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${le(n?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${pe(l,i,p)}
                </div>
            </div>
        `}function Ue(n,l={},i="domicile"){ne();let{chains:p,mainRulers:u}=$e(n,i),g=document.createElement("div");g.className="dispositor-modal-overlay",g.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${x($("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${x($("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${De(i)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${x($("page.chart.rulers.mainKicker"))}</span>
                    ${Me(u)}
                </div>
                ${ze(p)}
            </div>
        `,document.body.appendChild(g),document.body.classList.add("dispositor-modal-open"),g.addEventListener("click",P=>{let _=P.target;if(_===g||_ instanceof Element&&_.closest("[data-dispositor-close]")){ne();return}if(!(_ instanceof Element))return;let S=_.closest(".dispositor-mode-tab[data-dispositor-mode]");S&&Ue(n,l,S.dataset.dispositorMode||i)}),g.querySelector("[data-dispositor-close]")?.focus()}function ne(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function ke(n,l,i={}){let p=typeof n=="string"?document.getElementById(n):n;if(!p)return;let u=qe(i),{chains:g,housesByRuler:P}=Se(l,u.mode,u);i.section==="jones"?p.innerHTML=`<div class="dispositor-panel">${le(l?.cosmogram_pattern)}</div>`:i.section==="scheme"?p.innerHTML=`<div class="dispositor-panel">${pe(g,P,u)}</div>`:p.innerHTML=i.layout==="tabs"?Ke(l,g,P,u):`
                    <div class="dispositor-panel">
                        ${le(l?.cosmogram_pattern)}
                        ${pe(g,P,u)}
                    </div>
                `,p.querySelectorAll("[data-dispositor-tab]").forEach(v=>{v.addEventListener("click",()=>{let b=v.dataset.dispositorTab;p.querySelectorAll("[data-dispositor-tab]").forEach(m=>{let N=m.dataset.dispositorTab===b;m.classList.toggle("active",N),m.setAttribute("aria-selected",N?"true":"false")}),p.querySelectorAll("[data-dispositor-panel]").forEach(m=>{m.classList.toggle("active",m.dataset.dispositorPanel===b)})})});let _=p.querySelector("[data-dispositor-options-toggle]"),S=p.querySelector("[data-dispositor-options-menu]");_?.addEventListener("click",v=>{v.stopPropagation();let b=S&&!S.classList.contains("hidden");S?.classList.toggle("hidden",b),_.setAttribute("aria-expanded",b?"false":"true")}),S?.addEventListener("click",v=>v.stopPropagation()),S?.querySelectorAll("[data-dispositor-option]").forEach(v=>{v.addEventListener("change",()=>{let b={...u};v.dataset.dispositorOption==="mode"?b.mode=Pe(v.value):b[v.dataset.dispositorOption]=v.checked,Ye(b),ke(p,l,b)})})}window.DispositorChains={render:ke,buildChains:$e,buildHouseDispositorScheme:Se,buildCompactLayout:xe,closeModal:ne},document.addEventListener("keydown",n=>{n.key==="Escape"&&(ne(),document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",n=>{n.target instanceof Element&&n.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))})})();
