import{c as Q}from"./chunk-IZUYVIPG.js";var O=class O{constructor(e={}){let t=(s,i,a)=>s||(i?document.getElementById(i):document.getElementById(a));this.planetsTable=t(e.planetsTable,e.planetsTableId,"planetsTable"),this.housesTable=t(e.housesTable,e.housesTableId,"housesTable"),this.aspectsTable=t(e.aspectsTable,e.aspectsTableId,"aspectsTable"),this.aspectGridContainer=t(e.aspectGridContainer,e.aspectGridContainerId,"aspectGridContainer"),this.configsContainer=t(e.configsContainer,e.configsContainerId,"configurationsContainer"),this.balancesContainer=t(e.balancesContainer,e.balancesContainerId,"balancesContainer"),this.dignitiesContainer=t(e.dignitiesContainer,e.dignitiesContainerId,"dignitiesContainer"),this.aspectSortHeadersSelector=e.aspectSortHeadersSelector||"#aspects-list th.sortable[data-sort]",this.aspectTypeFilter="all",this.aspectPlanetFilter=null,this.aspectSortState={field:"planet",ascending:!0},this.aspectSortHeaders=[],this.hoveredAspectKey=null,this.showSpeed=!0,this.showStationary=!0,this.showApplyingSeparating=!1,this.showAspectText=!1,this.showSpeedColumn=e.showSpeedColumn!==!1,this.showHouseColumn=e.showHouseColumn!==!1,this.onPlanetsRendered=typeof e.onPlanetsRendered=="function"?e.onPlanetsRendered:null,this.fixedStarsData=null,this.showFixedStarBadges=!1,this.houseNumberStyle=Symbols?.readSavedHouseNumberStyle?.()||"arabic",this.visualPreferences=window.AstroPreferences?.getAccountVisualPreferences?.()||null,this.initAspectSortHeaders()}t(e,t){return window.FrontendI18n?.t?.(e,t)||e}planetName(e){let t=this.getCuspHouseNumber(e);if(t){let a=Symbols?.formatHouseLabel?.(t)||String(t);return this.t("page.chart.houseCusp",{house:a})}let s=`astro.planet.${e}`,i=this.t(s);return i===s?Symbols.getPlanetNameRu?.(e)||Symbols.planetNamesRu[e]||e:i}signName(e){let t=`astro.sign.${e}`,s=this.t(t);return s===t?Symbols.signNamesRu[e]||e:s}aspectName(e){let t=`astro.aspect.${e}`,s=this.t(t);return s===t?Symbols.aspectNamesRu[e]||e:s}getPlanetSymbol(e){return Symbols.getPlanetSymbol?.(e)||Symbols.planets?.[this.normalizeAspectBodyName(e)]||Symbols.planets?.[e]||""}getPlanetSymbolMarkup(e,t={}){let s=this.getCuspHouseNumber(e);if(s){let i=Symbols?.formatHouseLabel?.(s)||String(s),a=this.escapeHtml(t.title||this.planetName(e));return`<span class="aspect-cusp-symbol" title="${a}" aria-label="${a}">${this.escapeHtml(i)}</span>`}return Symbols.getPlanetSymbolMarkup?.(e,t)||`<span class="astro-symbol" aria-hidden="true">${this.escapeHtml(this.getPlanetSymbol(e))}</span>`}getCuspHouseNumber(e){let t=/^Cusp([1-9]|1[0-2])$/.exec(String(e||""));return t?Number(t[1]):null}getAspectSymbol(e){return Symbols.getAspectDisplay?.(e)||Symbols.aspects?.[e]||"•"}escapeHtml(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}retrogradeTitle(){let e="page.natalFull.legend.motion.retrograde",t=this.t(e);return t===e?"Retrograde":t}stationaryTitle(){let e="page.natalFull.legend.motion.stationary",t=this.t(e);return t===e?"Stationary":t}dignityTitle(e){if(!e||e==="neutral")return"";let t=`astro.dignity.${e}`,s=this.t(t);return s===t?e:s}dignityShortLabel(e){let t=String(this.dignityTitle(e)||"").trim();return t?Array.from(t)[0].toUpperCase():""}getApplyingSeparatingLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?this.t("page.chart.settings.aspectPhase.applying"):this.t("page.chart.settings.aspectPhase.separating");let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?this.t("page.chart.settings.aspectPhase.applying"):s.includes("separ")||s.includes("расход")?this.t("page.chart.settings.aspectPhase.separating"):t}getApplyingSeparatingShortLabel(e){if(!e)return"";if(typeof e.applying=="boolean")return e.applying?"сход.":"расх.";let t=String(e.applying_separating||e.phase||"").trim();if(!t)return"";let s=t.toLowerCase();return s.includes("applic")||s.includes("сход")?"сход.":s.includes("separ")||s.includes("расход")?"расх.":t}retroIndicatorHtml(e,t=""){if(!e)return"";let s=t?` ${t}`:"",i=this.escapeHtml(this.retrogradeTitle());return`<span class="retro-indicator${s}" title="${i}" aria-label="${i}">R</span>`}stationaryIndicatorHtml(e,t=""){if(!e?.is_stationary)return"";let s=t?` ${t}`:"",i=this.escapeHtml(this.stationaryTitle());return`<span class="planet-status-badge planet-status-badge--stationary${s}" title="${i}" aria-label="${i}">S</span>`}dignityIndicatorHtml(e,t=""){let s=String(e?.dignity||"").trim();if(!s||s==="neutral")return"";let i=this.dignityTitle(s),a=this.dignityShortLabel(s);if(!i||!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(i);return`
            <span class="planet-status-badge planet-status-badge--dignity planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">
                ${this.escapeHtml(a)}
            </span>
        `}solarBadgeTitle(e){let t=`astro.feature.short.${e}`,s=this.t(t);return s===t?e:s}sunRelationIndicatorHtml(e,t=""){let s=String(e?.sun_relation||"").trim(),a={cazimi:"Cz",combust:"Cb",under_rays:"Ur"}[s];if(!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--sun-relation planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}solarPhaseIndicatorHtml(e,t=""){let s=String(e?.solar_phase||"").trim(),a={oriental:"Or",occidental:"Oc"}[s];if(!a)return"";let r=t?` ${t}`:"",c=this.escapeHtml(this.solarBadgeTitle(s));return`<span class="planet-status-badge planet-status-badge--solar-phase planet-status-badge--${this.escapeHtml(s)}${r}" title="${c}" aria-label="${c}">${a}</span>`}outOfBoundsIndicatorHtml(e,t=""){if(!e?.out_of_bounds)return"";let s=t?` ${t}`:"",i="astro.feature.short.out_of_bounds",a=this.t(i),r=this.escapeHtml(a&&a!==i?a:"Out of bounds");return`<span class="planet-status-badge planet-status-badge--oob${s}" title="${r}" aria-label="${r}">OOB</span>`}buildRetrogradeLookup(e=[]){let t=new Map;return e.forEach(s=>{if(!s?.name)return;let i=this.normalizeAspectBodyName(s.name);t.set(i,!!s.retrograde)}),t}isBodyRetrograde(e,t=null){if(!e)return!1;let s=this.normalizeAspectBodyName(String(e));return(t||this.buildRetrogradeLookup(this.chartData?.planets||[])).get(s)===!0}buildPlanetHouseLookup(e=[]){let t=new Map;return e.forEach(s=>{!s?.name||s.house==null||s.house===""||t.set(this.normalizeAspectBodyName(s.name),s.house)}),t}buildHouseRulerGroups(e,t=new Map,s=null){if(Array.isArray(e?.ruler_groups)&&e.ruler_groups.length)return e.ruler_groups.map(y=>({included:y?.scope==="included",entries:(y?.entries||[]).filter(T=>{let $=this.normalizeAspectBodyName(T?.planet);return $&&(!(s instanceof Set)||s.has($))}).map(T=>({planet:T.planet,house:T.house??t.get(this.normalizeAspectBodyName(T.planet))??null}))})).filter(y=>y.entries.length);let i=[],r=[e?.ruler_planet,...Array.isArray(e?.co_rulers)?e.co_rulers:[]],c=new Set;return r.forEach((y,T)=>{if(!y)return;let $=this.normalizeAspectBodyName(y);s instanceof Set&&!s.has($)||c.has($)||(c.add($),i.push({planet:y,house:T===0&&e?.ruler_in_house!=null&&e?.ruler_in_house!==""?e.ruler_in_house:t.get($)??null}))}),i.length?[{entries:i,included:!1}]:[]}renderHouseRulerGroup(e,t=null){return e?.entries?.length?`
            <div class="${e.included?"house-ruler-group house-ruler-group--included":"house-ruler-group"}">
                ${e.entries.map(i=>{let a=this.planetName(i.planet),r=i.house!=null&&i.house!==""?this.formatHouseNumber(i.house):"",c=[a];return r&&c.push(`${this.t("common.house")} ${r}`),`
                        <div class="house-ruler-row" title="${this.escapeHtml(c.join(" • "))}">
                            <span class="house-ruler-symbol-wrap">
                                ${this.getPlanetSymbolMarkup(i.planet,{size:18,title:a})}
                                ${this.retroIndicatorHtml(this.isBodyRetrograde(i.planet,t),"retro-indicator--micro house-ruler-retro")}
                            </span>
                            <span class="house-ruler-house">${this.escapeHtml(r||"—")}</span>
                        </div>
                    `}).join("")}
            </div>
        `:""}initAspectSortHeaders(){this.aspectSortHeaders=[...document.querySelectorAll(this.aspectSortHeadersSelector)],this.aspectSortHeaders.forEach(e=>{e.addEventListener("click",()=>{this.toggleAspectSort(e.dataset.sort)})}),this.updateAspectSortHeaders()}toggleAspectSort(e){e&&(this.aspectSortState.field===e?this.aspectSortState.ascending=!this.aspectSortState.ascending:(this.aspectSortState.field=e,this.aspectSortState.ascending=!0),this.updateAspectSortHeaders(),this.reRenderAspects())}updateAspectSortHeaders(){this.aspectSortHeaders.forEach(e=>{let t=this.aspectSortState.field===e.dataset.sort;e.classList.toggle("sort-active",t),e.classList.toggle("sort-desc",t&&!this.aspectSortState.ascending),e.setAttribute("aria-sort",t?this.aspectSortState.ascending?"ascending":"descending":"none")})}setAspectTypeFilter(e){let t=e==="major"||e==="minor"?e:"all";t!==this.aspectTypeFilter&&(this.aspectTypeFilter=t,this.reRenderAspects())}setAspectPlanetFilter(e){let t=e?this.normalizeAspectBodyName(String(e)):null;t!==this.aspectPlanetFilter&&(this.aspectPlanetFilter=t,this.reRenderAspects())}setDisplayPreferences(e={}){Object.prototype.hasOwnProperty.call(e,"showSpeed")&&(this.showSpeed=e.showSpeed!==!1),Object.prototype.hasOwnProperty.call(e,"showStationary")&&(this.showStationary=e.showStationary!==!1),Object.prototype.hasOwnProperty.call(e,"showApplyingSeparating")&&(this.showApplyingSeparating=e.showApplyingSeparating===!0),Object.prototype.hasOwnProperty.call(e,"showAspectText")&&(this.showAspectText=e.showAspectText===!0),this.updatePlanetsTableColumns(),this.chartData&&(this.renderPlanets(this.chartData.planets),this.renderAspects(this.chartData.aspects))}setHouseNumberStyle(e){let t=Symbols?.normalizeHouseNumberStyle?.(e)||"arabic";t!==this.houseNumberStyle&&(this.houseNumberStyle=t,this.chartData&&this.render(this.chartData))}updatePlanetsTableColumns(){let e=this.planetsTable?.closest("table");if(!e)return;e.classList.toggle("planets-table--speed-hidden",!this.showSpeed),e.classList.toggle("planets-table--speed-column-hidden",!this.showSpeedColumn),e.classList.toggle("planets-table--house-column-hidden",!this.showHouseColumn);let t=window.AstroPreferences?.getDegreeFormat?.()||"DEGREES_ONLY";e.classList.toggle("planets-table--seconds",t==="DEGREES_MINUTES_SECONDS")}setVisualPreferences(e={}){this.visualPreferences=window.AstroPreferences?.resolveVisualPreferences?window.AstroPreferences.resolveVisualPreferences(e||{}):e||null,this.chartData&&this.render(this.chartData)}setFixedStarsData(e,t={}){this.fixedStarsData=e||null,this.showFixedStarBadges=t.showBadges===!0&&!!e,this.chartData&&this.renderPlanets(this.chartData.planets)}reRenderAspects(){this.chartData&&this.renderAspects(this.chartData.aspects)}render(e){this.chartData=e,this.renderPlanets(e.planets),this.renderHouses(e.houses),this.renderAspects(e.aspects),this.renderAspectGrid(e.aspects,e.planets),this.renderDignities(e.planets),this.renderConfigurations(e.aspect_configurations,e.stelliums),this.renderBalances(e.balances,e.cosmogram_pattern)}static normalizeBodyName(e){return window.Symbols?.normalizeBodyName?.(e)||e}renderPlanets(e){if(!e||!this.planetsTable)return;this.updatePlanetsTableColumns();let t=[...e].sort((s,i)=>{let a=O.PLANET_ORDER.indexOf(O.normalizeBodyName(s.name)),r=O.PLANET_ORDER.indexOf(O.normalizeBodyName(i.name));return(a===-1?999:a)-(r===-1?999:r)});this.planetsTable.innerHTML=t.map(s=>{let i=this.formatAstroCoordinate(s),a=this.createPlanetIconSVG(s),r=this.renderPlanetSpeedChip(s),c=this.renderFixedStarSymbolBadge(s),y=[this.showStationary?this.stationaryIndicatorHtml(s,"planet-status-badge--small"):"",this.retroIndicatorHtml(s.retrograde,"retro-indicator--small")].filter(Boolean).join(""),T=[this.dignityIndicatorHtml(s,"planet-status-badge--small"),this.sunRelationIndicatorHtml(s,"planet-status-badge--small"),this.solarPhaseIndicatorHtml(s,"planet-status-badge--small"),this.outOfBoundsIndicatorHtml(s,"planet-status-badge--small")].filter(Boolean).join("");return`
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
                        <div class="planet-position-main">${i}</div>
                    </td>
                    ${this.showSpeedColumn?`<td class="planet-speed-cell mono">${this.showSpeed?r:""}</td>`:""}
                    ${this.showHouseColumn?`<td class="mono">${this.escapeHtml(this.formatHouseNumber(s.house))}</td>`:""}
                </tr>
            `}).join(""),this.onPlanetsRendered?.(this)}getFixedStarContactsForPlanet(e){if(!this.showFixedStarBadges||!e)return[];let t=this.normalizeAspectBodyName(e);return(this.fixedStarsData?.conjunctions||[]).filter(s=>this.normalizeAspectBodyName(s?.object)===t).sort((s,i)=>Number(s.orb||0)-Number(i.orb||0))}findFixedStarInfo(e){let t=e?.star;return t?e?.star_info||(this.fixedStarsData?.stars||[]).find(s=>s?.name===t)||null:e?.star_info||null}fixedStarTooltipHtml(e){let t=this.findFixedStarInfo(e)||{},s=t.degree_in_sign_formatted&&t.sign?`${t.degree_in_sign_formatted} ${this.signName(t.sign)}`:e?.star_position||"",i=t.designation||"",a=t.magnitude!==null&&t.magnitude!==void 0?`m ${t.magnitude}`:"",r=t.nature||e?.nature||"",c=e?.object?this.planetName(e.object):"",y=e?.object_degree_in_sign_formatted&&e?.object_sign?`${e.object_degree_in_sign_formatted} ${this.signName(e.object_sign)}`:e?.object_position||"",T=Number(e?.orb),$=Number.isFinite(T)?`${T.toFixed(2)}°`:"";return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t.name||e?.star||"")}</div>
            ${s?`<div>${this.escapeHtml(s)}</div>`:""}
            ${i?`<div>${this.escapeHtml(i)}</div>`:""}
            ${a?`<div>${this.escapeHtml(a)}</div>`:""}
            ${r?`<div>${this.escapeHtml(r)}</div>`:""}
            ${c?`<div class="fixed-star-tooltip-contact">${this.escapeHtml(c)} ${this.escapeHtml(y)}${$?` · ${this.escapeHtml($)}`:""}</div>`:""}
        `.trim()}renderFixedStarSymbolBadge(e){let t=this.getFixedStarContactsForPlanet(e?.name);if(!t.length)return"";let s=this.fixedStarSummaryTooltipHtml(t),i=this.t("page.chart.settings.fixedStars.title"),a=t.length>1?`${i} (${t.length})`:i;return`
            <span
                class="fixed-star-badge fixed-star-badge--icon"
                role="img"
                tabindex="0"
                aria-label="${this.escapeHtml(a)}"
                data-fixed-star-tooltip="${this.escapeHtml(s)}"
            >✶</span>
        `}fixedStarSummaryTooltipHtml(e){if(e.length===1)return this.fixedStarTooltipHtml(e[0]);let t=this.t("page.chart.settings.fixedStars.title"),s=e.map(i=>{let a=this.findFixedStarInfo(i)||{},r=a.name||i?.star||"",c=a.degree_in_sign_formatted&&a.sign?`${a.degree_in_sign_formatted} ${this.signName(a.sign)}`:i?.star_position||"",y=Number(i?.orb),T=Number.isFinite(y)?`${y.toFixed(2)}°`:"";return`
                <div class="fixed-star-tooltip-row">
                    <span class="fixed-star-tooltip-star">✶ ${this.escapeHtml(r)}</span>
                    ${c?`<span class="fixed-star-tooltip-pos">${this.escapeHtml(c)}</span>`:""}
                    ${T?`<span class="fixed-star-tooltip-orb">${this.escapeHtml(T)}</span>`:""}
                </div>
            `}).join("");return`
            <div class="fixed-star-tooltip-title">${this.escapeHtml(t)}</div>
            <div class="fixed-star-tooltip-list">${s}</div>
        `.trim()}renderPlanetSpeedChip(e){if(!e)return"";let t=this.resolveSpeedPercent(e);if(t!==null){if(!Number.isFinite(t))return"";let s="";return t<10?s=" planet-meta-chip--speed-slow":t>120&&(s=" planet-meta-chip--speed-fast"),`<span class="planet-meta-chip${s}">${Math.round(t)}%</span>`}if(e.speed!==void 0&&e.speed!==null){let s=Number(e.speed);if(!Number.isFinite(s))return"";if(s===0)return'<span class="planet-meta-chip planet-meta-chip--speed-slow">0%</span>';let i=this.formatCompactSpeed(s),a=this.formatSpeedValue(s),r=this.t("page.natalFull.units.degPerDay",{value:a});return`<span class="planet-meta-chip" title="${this.escapeHtml(r)}">${this.escapeHtml(i)}</span>`}return""}resolveSpeedPercent(e){let t=Number(e?.speed_percent);if(Number.isFinite(t))return t;let s={Proserpina:.001478},i=Number(e?.speed),a=s[e?.name];return!Number.isFinite(i)||!a?null:Math.round(Math.abs(i)/a*1e4)/100}formatSpeedValue(e){let t=Math.abs(Number(e));return!Number.isFinite(t)||t===0?"0.00":t>=1?t.toFixed(2):t>=.1?t.toFixed(3):t>=.01?t.toFixed(4):t.toFixed(5)}formatCompactSpeed(e){let t=Math.abs(Number(e));if(!Number.isFinite(t)||t===0)return"0°/д";if(t>=1)return`${t.toFixed(2)}°/д`;let s=t*60;return s>=1?`${s.toFixed(1)}′/д`:`${(s*60).toFixed(1)}″/д`}renderHouses(e){if(!e||!this.housesTable)return;let t=this.buildRetrogradeLookup(this.chartData?.planets||[]),s=this.buildPlanetHouseLookup(this.chartData?.planets||[]),i=new Set(s.keys());this.housesTable.innerHTML=e.map(a=>{let r=[1,4,7,10].includes(a.number),c=this.formatAstroCoordinate(a),y=a.included_sign||"",T=y&&Symbols.signs[y]||"",$=y?this.signName(y):"",x=y?`${this.t("page.natalFull.table.houses.included")}: ${$}`:"",q=this.buildHouseRulerGroups(a,s,i);return`
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
                        ${q.length?q.map(F=>this.renderHouseRulerGroup(F,t)).join(""):"—"}
                    </td>
                </tr>
            `}).join("")}formatAstroCoordinate(e){if(window.LocaleFormatters?.formatAstroCoordinate)return window.LocaleFormatters.formatAstroCoordinate(e,{signSymbol:Symbols?.signs?.[e?.sign],signClass:"astro-symbol"});let t=Number(e?.degree_in_sign);if(!Number.isFinite(t))return"";let s=Math.floor(t),i=Math.floor((t-s)*60),a=Symbols?.signs?.[e?.sign]||e?.sign||"",r=a?`<span class="astro-symbol">${a}</span>`:"";return[`${s}°`,r,`${String(i).padStart(2,"0")}'`].filter(Boolean).join(" ")}createPlanetIconSVG(e){let t=Symbols.signElements[e.sign],s=window.AstroPreferences?.getPlanetColor?window.AstroPreferences.getPlanetColor(e.name,t,this.visualPreferences):Symbols.elementColors[t]||"#374151";if(window.AstroGlyphs?.hasPlanetIcon?.(e.name))return`
                <span class="planet-icon-svg">
                    ${window.AstroGlyphs.createPlanetSymbolMarkup(e.name,{size:28,color:s,title:this.planetName(e.name)})}
                </span>
            `;let a=this.getPlanetSymbol(e.name)||e.name.charAt(0),c=22*(Symbols.planetGlyphScale?.[e.name]||1);return`
            <span class="planet-icon-svg">
                <svg width="28" height="28" viewBox="0 0 28 28">
                    <text x="14" y="${(14+c*.36).toFixed(2)}" text-anchor="middle" font-size="${c.toFixed(2)}" font-weight="600" fill="${s}" class="planet-symbol-text">${a}</text>
                </svg>
            </span>
        `}formatDegreeShort(e){let t=Math.floor(e),s=Math.floor((e-t)*60);return`${t}°${s.toString().padStart(2,"0")}'`}normalizeAspectBodyName(e){return O.ASPECT_NAME_ALIASES[e]||e}formatHouseNumber(e){return e==null||e===""?"":Symbols?.formatHouseLabel?.(e,{style:this.houseNumberStyle})||String(e)}getAspectRank(e){let t=this.normalizeAspectBodyName(e);return O.ASPECT_SORT_RANK[t]??999}normalizeAspectForDisplay(e){let t=Number.isInteger(e.left_rank)?e.left_rank:this.getAspectRank(e.planet_1),s=Number.isInteger(e.right_rank)?e.right_rank:this.getAspectRank(e.planet_2),i=e.left_planet||e.planet_1,a=e.right_planet||e.planet_2,r=t,c=s;return(!e.left_planet||!e.right_planet)&&(s<t||t===s&&String(e.planet_2)<String(e.planet_1))&&(i=e.planet_2,a=e.planet_1,r=s,c=t),{...e,left_planet:this.normalizeAspectBodyName(i),right_planet:this.normalizeAspectBodyName(a),left_rank:r,right_rank:c}}getAspectTypeRank(e){return O.ASPECT_TYPE_RANK[e]??999}buildAspectKey(e,t){let s=this.normalizeAspectBodyName(e),i=this.normalizeAspectBodyName(t),a=this.getAspectRank(s),r=this.getAspectRank(i);return a<r?`${s}-${i}`:r<a?`${i}-${s}`:s<=i?`${s}-${i}`:`${i}-${s}`}getAspectKey(e){if(!e)return null;let t=e.left_planet||e.planet_1,s=e.right_planet||e.planet_2;return!t||!s?null:this.buildAspectKey(t,s)}compareAspectsByPlanet(e,t){return e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.orb!==t.orb?e.orb-t.orb:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type)}compareAspectsByType(e,t){let s=this.getAspectTypeRank(e.aspect_type)-this.getAspectTypeRank(t.aspect_type);return s!==0?s:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank!==t.right_rank?e.right_rank-t.right_rank:e.orb-t.orb}compareAspectsByOrb(e,t){return e.is_major!==t.is_major?Number(t.is_major)-Number(e.is_major):e.orb!==t.orb?e.orb-t.orb:e.left_rank!==t.left_rank?e.left_rank-t.left_rank:e.right_rank-t.right_rank}renderAspectTypeCell(e){let s=`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`,i=this.showAspectText?` ${this.aspectName(e.aspect_type)}`:"";return`${s}${i}`}renderAspectTypeIcon(e){return`<span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(e.aspect_type,this.visualPreferences,e.harmonic_type):"#9ca3af"}">${this.getAspectSymbol(e.aspect_type)}</span>`}renderAspectPairCell(e){if(!e)return"";let t=this.escapeHtml(this.planetName(e.left_planet)),s=this.escapeHtml(this.planetName(e.right_planet)),i=this.escapeHtml(this.aspectName(e.aspect_type));return`
            <span class="aspect-chip" aria-label="${t} ${i} ${s}">
                <span class="aspect-chip__body" title="${t}">${this.getPlanetSymbolMarkup(e.left_planet,{size:15,title:this.planetName(e.left_planet)})}</span>
                <span class="aspect-chip__type" title="${i}">${this.renderAspectTypeIcon(e)}</span>
                <span class="aspect-chip__body" title="${s}">${this.getPlanetSymbolMarkup(e.right_planet,{size:15,title:this.planetName(e.right_planet)})}</span>
            </span>
        `}renderAspects(e){if(!this.aspectsTable)return;if(!e||e.length===0){this.aspectsTable.innerHTML="";return}let t=e;this.aspectTypeFilter==="major"?t=t.filter(a=>a.is_major):this.aspectTypeFilter==="minor"&&(t=t.filter(a=>!a.is_major)),this.aspectPlanetFilter&&(t=t.filter(a=>{let r=this.normalizeAspectBodyName(a.planet_1),c=this.normalizeAspectBodyName(a.planet_2);return r===this.aspectPlanetFilter||c===this.aspectPlanetFilter}));let i=[...t.map(a=>this.normalizeAspectForDisplay(a))].sort((a,r)=>{let c=0;switch(this.aspectSortState.field){case"type":c=this.compareAspectsByType(a,r);break;case"orb":c=this.compareAspectsByOrb(a,r);break;case"planet":default:c=this.compareAspectsByPlanet(a,r);break}return this.aspectSortState.ascending?c:-c});if(i.length===0){this.aspectsTable.innerHTML='<tr><td colspan="3" class="text-muted">—</td></tr>';return}this.aspectsTable.innerHTML=i.map(a=>{let r=this.getAspectKey(a),c=this.showApplyingSeparating?this.getApplyingSeparatingShortLabel(a):"";return`
                <tr data-aspect="${r||""}" data-aspect-key="${r||""}" data-aspect-type="${this.escapeHtml(a.aspect_type||"")}">
                    <td>${this.renderAspectPairCell(a)}</td>
                    <td class="aspect-phase-cell">${c?this.escapeHtml(c):"—"}</td>
                    <td class="mono">${a.orb.toFixed(2)}°</td>
                </tr>
            `}).join("")}renderGridHeaderBody(e){let t=this.getPlanetSymbolMarkup(e.name,{size:15,title:this.planetName(e.name)}),s=this.retroIndicatorHtml(e.retrograde,"retro-indicator--micro");return`<span class="aspect-grid-body">${t}${s}</span>`}renderAspectGrid(e,t){if(!this.aspectGridContainer||!e||!t)return;let s=this.getAspectRank("PartOfFortune"),i=new Map;t.forEach(y=>{let T=this.normalizeAspectBodyName(y.name);this.getAspectRank(T)>s||i.has(T)||i.set(T,{...y,name:T})});let a=[...i.values()].sort((y,T)=>this.getAspectRank(y.name)-this.getAspectRank(T.name)),r={};e.forEach(y=>{let T=this.getAspectKey(y);T&&(r[T]=y)});let c='<table class="aspect-grid">';c+="<tr><th></th>",a.forEach(y=>{c+=`<th title="${this.planetName(y.name)}">${this.renderGridHeaderBody(y)}</th>`}),c+="</tr>",a.forEach((y,T)=>{c+=`<tr><th title="${this.planetName(y.name)}">${this.renderGridHeaderBody(y)}</th>`,a.forEach(($,x)=>{if(x>=T)c+="<td></td>";else{let q=this.buildAspectKey(y.name,$.name),F=r[q];if(F){let ie=this.getAspectSymbol(F.aspect_type),Z=F.harmonic_type==="harmonious"?"grid-harmonious":F.harmonic_type==="tense"?"grid-tense":"grid-neutral";c+=`<td class="${Z}" data-aspect-key="${q}" data-aspect-type="${this.escapeHtml(F.aspect_type||"")}" title="${this.aspectName(F.aspect_type)} ${F.orb.toFixed(1)}°"><span class="astro-symbol" style="color:${window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(F.aspect_type,this.visualPreferences,F.harmonic_type):"#9ca3af"}">${ie}</span></td>`}else c+="<td>–</td>"}}),c+="</tr>"}),c+="</table>",this.aspectGridContainer.innerHTML=c}clearHoveredAspect(){this.hoveredAspectKey=null,this.aspectsTable&&this.aspectsTable.querySelectorAll("tr.aspect-hover-row").forEach(e=>{e.classList.remove("aspect-hover-row")}),this.aspectGridContainer&&this.aspectGridContainer.querySelectorAll("td.grid-hover").forEach(e=>{e.classList.remove("grid-hover")})}setHoveredAspect(e,t={}){let s=t.surface==="grid"?"grid":"table";if(this.clearHoveredAspect(),!!e){if(this.hoveredAspectKey=e,s==="table"&&this.aspectsTable){let i=this.aspectsTable.querySelector(`tr[data-aspect-key="${e}"]`);i&&i.classList.add("aspect-hover-row");return}if(s==="grid"&&this.aspectGridContainer){let i=this.aspectGridContainer.querySelector(`td[data-aspect-key="${e}"]`);i&&i.classList.add("grid-hover")}}}renderDignities(e){if(!this.dignitiesContainer||!e)return;let t={domicile:{label:this.t("astro.dignity.domicile"),class:"dignity-domicile",icon:"🏠"},exaltation:{label:this.t("astro.dignity.exaltation"),class:"dignity-exaltation",icon:"⬆"},detriment:{label:this.t("astro.dignity.detriment"),class:"dignity-detriment",icon:"⬇"},fall:{label:this.t("astro.dignity.fall"),class:"dignity-fall",icon:"💫"},neutral:{label:"",class:"",icon:""}},s=e.filter(a=>a.dignity&&a.dignity!=="neutral");if(s.length===0){this.dignitiesContainer.innerHTML=`<p class="text-muted">${this.t("page.chart.empty.noDignities")}</p>`;return}let i='<div class="dignities-list">';s.forEach(a=>{let r=t[a.dignity]||t.neutral;i+=`
                <div class="dignity-item ${r.class}">
                    <span class="dignity-planet">${this.getPlanetSymbolMarkup(a.name,{size:16,title:this.planetName(a.name)})} ${this.planetName(a.name)}</span>
                    <span class="dignity-label">${r.icon} ${r.label}</span>
                </div>
            `}),i+="</div>",this.dignitiesContainer.innerHTML=i}renderConfigurations(e,t){if(!this.configsContainer)return;let s="";if(e&&e.length>0){let i=[...e].sort((a,r)=>{let c=a.strength_score||0;return(r.strength_score||0)-c});s+=`<h3 style="margin-bottom: 12px; font-size: 15px;">${this.t("page.chart.configurations.title")}</h3>`,s+=i.map(a=>`
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
            `).join("")}if(t&&t.length>0){let i=[...t].sort((a,r)=>(r.count||0)-(a.count||0));s+=`<h3 style="margin: 20px 0 12px; font-size: 15px;">${this.t("page.chart.configurations.stelliums")}</h3>`,s+=i.map(a=>`
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
            `).join("")}s||(s=`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noConfigurations")}</p>`),this.configsContainer.innerHTML=s}buildConfigurationPointTooltip(e,t){if(!e||!Array.isArray(t)||!t.length)return"";let s=this.normalizeAspectBodyName(e),i=t.filter(a=>{let r=this.normalizeAspectBodyName(a?.planet_1),c=this.normalizeAspectBodyName(a?.planet_2);return r===s||c===s});return i.length?`
            <div class="config-point-tooltip-title">${this.escapeHtml(this.planetName(e))}</div>
            <div class="config-aspect-lines">
                ${i.map(a=>{let r=`${this.planetName(a.planet_1)} ${this.aspectName(a.aspect_type)} ${this.planetName(a.planet_2)}`,c=window.AstroPreferences?.getAspectColor?window.AstroPreferences.getAspectColor(a.aspect_type,this.visualPreferences,a.harmonic_type):"#6b7280";return`
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
        `.trim():""}formatConfigType(e){let t=`astro.configuration.${e}`,s=this.t(t);return s===t?e.replace(/_/g," "):s}renderBalances(e,t){if(!this.balancesContainer)return;let s="";if(!e){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}let i=[{key:"by_sign",label:this.t("page.chart.balances.tabs.sign"),data:e.by_sign},{key:"by_house",label:this.t("page.chart.balances.tabs.house"),data:e.by_house}].filter(a=>this.hasBalanceData(a.data));if(!i.length){this.balancesContainer.innerHTML=s||`<p style="color: #6e6e73; text-align: center; padding: 40px;">${this.t("page.chart.empty.noBalances")}</p>`;return}if(i.length===1){s+=this.renderBalanceSet(i[0].key,i[0].data),this.balancesContainer.innerHTML=s;return}s+=`
            <div class="balance-subtabs" role="tablist" aria-label="${this.t("page.chart.balances.tabs.title")}">
                ${i.map((a,r)=>`
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
            ${i.map((a,r)=>`
                <div class="balance-subtab-panel${r===0?" active":""}" data-balance-panel="${a.key}">
                    ${this.renderBalanceSet(a.key,a.data)}
                </div>
            `).join("")}
        `,this.balancesContainer.innerHTML=s,this.initBalanceTabs()}hasBalanceData(e){return!!(e&&Object.values(e).some(t=>t&&Object.keys(t).length))}initBalanceTabs(){let e=this.balancesContainer.querySelectorAll("[data-balance-tab]"),t=this.balancesContainer.querySelectorAll("[data-balance-panel]");!e.length||!t.length||e.forEach(s=>{s.addEventListener("click",()=>{let i=s.dataset.balanceTab;e.forEach(a=>{let r=a.dataset.balanceTab===i;a.classList.toggle("active",r),a.setAttribute("aria-selected",r?"true":"false")}),t.forEach(a=>{a.classList.toggle("active",a.dataset.balancePanel===i)})})})}renderBalanceSet(e,t){let s="",i="#9ca3af",a=r=>window.AstroPreferences?.getElementColor?window.AstroPreferences.getElementColor(r,this.visualPreferences):{Fire:"#ef4444",Earth:"#84cc16",Air:"#f59e0b",Water:"#3b82f6"}[r]||i;if(t.element_balance){let r=t.element_balance,c=r.fire+r.earth+r.air+r.water;s+=this.renderBalanceSection(this.t("page.chart.balances.elementsTitle"),[{label:this.t("astro.element.Fire"),value:r.fire,total:c,color:a("Fire")},{label:this.t("astro.element.Earth"),value:r.earth,total:c,color:a("Earth")},{label:this.t("astro.element.Air"),value:r.air,total:c,color:a("Air")},{label:this.t("astro.element.Water"),value:r.water,total:c,color:a("Water")}])}if(e==="by_sign"&&t.mode_balance){let r=t.mode_balance,c=r.cardinal+r.fixed+r.mutable;s+=this.renderBalanceSection(this.t("page.chart.balances.modesTitle"),[{label:this.t("astro.mode.short.Cardinal"),value:r.cardinal,total:c,color:i},{label:this.t("astro.mode.short.Fixed"),value:r.fixed,total:c,color:i},{label:this.t("astro.mode.short.Mutable"),value:r.mutable,total:c,color:i}])}if(e==="by_house"&&t.house_group_balance){let r=t.house_group_balance,c=r.angular+r.succedent+r.cadent;s+=this.renderBalanceSection(this.t("page.chart.balances.houseGroupsTitle"),[{label:this.t("page.chart.balances.angular"),value:r.angular,total:c,color:i},{label:this.t("page.chart.balances.succedent"),value:r.succedent,total:c,color:i},{label:this.t("page.chart.balances.cadent"),value:r.cadent,total:c,color:i}])}if(t.gender_balance){let r=t.gender_balance,c=r.masculine+r.feminine;s+=this.renderBalanceSection(this.t("page.chart.balances.polarityTitle"),[{label:this.t("astro.polarity.Masculine"),value:r.masculine,total:c,color:i},{label:this.t("astro.polarity.Feminine"),value:r.feminine,total:c,color:i}])}if(t.zones_balance){let r=t.zones_balance,c=r.brahma+r.vishnu+r.shiva;s+=this.renderBalanceSection(this.t("page.chart.balances.zonesTitle"),[{label:this.t("page.chart.balances.brahma"),value:r.brahma,total:c,color:i},{label:this.t("page.chart.balances.vishnu"),value:r.vishnu,total:c,color:i},{label:this.t("page.chart.balances.shiva"),value:r.shiva,total:c,color:i}])}if(t.quadrant_balance){let r=t.quadrant_balance,c=r.q1+r.q2+r.q3+r.q4;s+=this.renderBalanceSection(this.t("page.chart.balances.quadrantsTitle"),[{label:this.t("page.chart.balances.quadrant1"),value:r.q1,total:c,color:i},{label:this.t("page.chart.balances.quadrant2"),value:r.q2,total:c,color:i},{label:this.t("page.chart.balances.quadrant3"),value:r.q3,total:c,color:i},{label:this.t("page.chart.balances.quadrant4"),value:r.q4,total:c,color:i}])}if(t.hemisphere_balance){let r=t.hemisphere_balance,c=r.lower+r.upper,y=r.eastern+r.western;s+=this.renderBalanceSection(this.t("page.chart.balances.hemispheresTitle"),[{label:this.t("page.chart.balances.lower"),value:r.lower,total:c,color:i},{label:this.t("page.chart.balances.upper"),value:r.upper,total:c,color:i},{label:this.t("page.chart.balances.east"),value:r.eastern,total:y,color:i},{label:this.t("page.chart.balances.west"),value:r.western,total:y,color:i}])}return s}renderBalanceSection(e,t){return`
            <div class="balance-section">
                <div class="balance-title">${e}</div>
                ${t.map(s=>{let i=s.total>0?s.value/s.total*100:0,a=s.color?`background: ${s.color};`:"",r=s.color?`color: ${s.color};`:"";return`
                        <div class="balance-row">
                            <span class="balance-label" style="${r}">${s.label}</span>
                            <div class="balance-bar-container">
                                <div class="balance-bar" style="${a} width: ${i}%"></div>
                            </div>
                            <span class="balance-value" style="${r}">${s.value}</span>
                        </div>
                    `}).join("")}
            </div>
        `}formatPatternType(e){let t=`astro.pattern.${e}`,s=this.t(t);return s!==t?s:e}};Q(O,"ASPECT_SORT_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune","ASC","MC","IC","DSC","Vertex","AntiVertex"]),Q(O,"ASPECT_NAME_ALIASES",{TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"}),Q(O,"ASPECT_SORT_RANK",O.ASPECT_SORT_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),Q(O,"ASPECT_TYPE_ORDER",["Conjunction","Opposition","Trine","Square","Sextile","Quincunx","Semisquare","Semisextile","Quintile","Biquintile"]),Q(O,"ASPECT_TYPE_RANK",O.ASPECT_TYPE_ORDER.reduce((e,t,s)=>(e[t]=s,e),{})),Q(O,"PLANET_ORDER",["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina","TrueNode","SouthNode","BlackMoon","WhiteMoon","PartOfFortune"]);var ge=O;window.ChartDataRenderer=ge;(function(){"use strict";let e=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],t=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],s=t.slice(0,10),i="dispositorChainDisplayOptions",a={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},r={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},c=Object.fromEntries(e.map((n,l)=>[n,e[(l+6)%12]])),y={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},T={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function $(n,l){return window.FrontendI18n?.t?.(n,l)||n}function x(n){return String(n??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function q(n){return T[n]||n}function F(n){if(!n)return"—";let l=`astro.planet.${n}`,o=$(l);return o!==l?o:window.Symbols?.getPlanetNameRu?.(n)||window.Symbols?.planetNamesRu?.[n]||n}function ie(n){if(!n)return"—";let l=`astro.sign.${n}`,o=$(l);return o!==l?o:window.Symbols?.signNamesRu?.[n]||n}function Z(n,l=16){return window.Symbols?.getPlanetSymbolMarkup?.(n,{size:l,title:F(n)})||`<span class="astro-symbol">${x(window.Symbols?.getPlanetSymbol?.(n)||"")}</span>`}function fe(n){return[window.Symbols?.signs?.[n]||"",ie(n)].filter(Boolean).join(" ")}function oe(){let n={},l=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return e.forEach(o=>{let p=y[o]||{},u=l?.[o]||{},b=q(u.ruler||p.ruler||null),N=q(u.co_ruler||p.co_ruler||null),S=q(u.exaltation||p.exaltation||null);b&&N&&b===N&&(N=null),n[o]={ruler:b,co_ruler:N,exaltation:S}}),n}function ae(n,l,o=oe()){let p=o?.[n]||{},u=o?.[c[n]]||{};return l==="exaltation"?p.exaltation||null:l==="detriment"?u.ruler||null:l==="fall"?u.exaltation||null:p.ruler||null}function be(n,l,o,p=a){return n?p.classicalRulers&&l==="domicile"?r[n]||ae(n,l,o):p.classicalRulers&&l==="detriment"&&r[c[n]]||ae(n,l,o):null}function ye(n){return(Array.isArray(n?.planets)?n.planets:[]).filter(o=>o?.name&&o?.sign&&t.includes(q(o.name))).map(o=>({...o,name:q(o.name)})).sort((o,p)=>t.indexOf(o.name)-t.indexOf(p.name))}function $e(n,l){let o=oe(),p=ye(n),u=new Map(p.map(_=>[_.name,_])),b=[],N=new Map;p.forEach(_=>{let w=[],k=new Map,h=_,A=null,R=[];for(;h?.name&&!k.has(h.name);){k.set(h.name,w.length);let f=ae(h.sign,l,o);if(w.push({planet:h.name,sign:h.sign,ruler:f,retrograde:!!h.retrograde}),!f){A="none";break}if(!u.has(f)){A=f;break}if(f===h.name){A=f;break}h=u.get(f)}if(!A&&h?.name&&k.has(h.name)){let f=k.get(h.name);R=w.slice(f).map(E=>E.planet),A=R.join("+")}N.set(A,(N.get(A)||0)+1),b.push({start:_.name,steps:w,finalKey:A,cycle:R})});let S=[...N.entries()].filter(([_])=>_&&_!=="none").sort((_,w)=>w[1]-_[1]||_[0].localeCompare(w[0])).slice(0,4);return{chains:b,mainRulers:S}}function le(n){if(!n)return`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noJones"))}</p>`;let l=(()=>{let p=`astro.pattern.${n.pattern_type}`,u=$(p);return u===p?n.pattern_type||"—":u})(),o=[];return Number.isFinite(Number(n.empty_arc_degree))&&o.push($("page.chart.balances.emptyArc",{value:Number(n.empty_arc_degree).toFixed(0)})),n.handle_planet&&o.push($("page.chart.balances.handle",{planet:F(n.handle_planet)})),n.leading_planet&&o.push($("page.chart.balances.leading",{planet:F(n.leading_planet)})),`
            <article class="dispositor-jones-card" title="${x([$("page.chart.rulers.jonesKicker"),l,...o].join(" · "))}">
                <h4>${x(l)}</h4>
                ${o.length?`<p>${x(o.join(" · "))}</p>`:""}
            </article>
        `}function Me(n){return n.length?`
            <div class="dispositor-main-rulers">
                ${n.map(([l,o])=>{let p=l.split("+").filter(Boolean),u=p.map(F).join(" + ");return`
                        <span class="dispositor-main-chip" title="${x(u)}">
                            ${p.map(b=>Z(b,15)).join("")}
                            <b>${o}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noMainRulers"))}</p>`}function ce(n,l="",o=""){let p=[F(n.planet),n.sign?fe(n.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${l}" style="${x(o)}" title="${x(p)}" aria-label="${x(p)}">
                ${Z(n.planet,15)}
            </span>
        `}function et(n){let l=[...n.steps].reverse().map((p,u)=>{let b=u===0&&n.finalKey!=="none";return ce(p,b?"dispositor-chain-node--main":"")}),o=n.steps[n.steps.length-1];return o?.ruler&&!n.steps.some(p=>p.planet===o.ruler)&&l.unshift(ce({planet:o.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${l.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function K(n){return[...new Set(n)].sort((l,o)=>{let p=t.indexOf(l),u=t.indexOf(o);return(p===-1?999:p)-(u===-1?999:u)})}function Ce(n){return K(n).join("+")}function Ee(n){let l=n?.number??n?.house_number,o=Number(l);return Number.isInteger(o)?o:l}function Be(n){let l=[...new Set(n)].map(o=>Number(o)).filter(o=>Number.isInteger(o)).sort((o,p)=>o-p);return l.length?window.Symbols?.formatHouseList?.(l,{style:"roman",separator:","})||l.map(o=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][o-1]||String(o)).join(","):""}function Le(n,l,o,p=a){return l==="domicile"&&n?.ruler_planet&&!p.classicalRulers?q(n.ruler_planet):q(be(n?.sign,l,o,p))}function Se(n,l,o=a){let p=oe(),u=ye(n),b=new Map(u.map(h=>[h.name,h])),N=Array.isArray(n?.houses)?n.houses:[],S=new Map,_=[];return N.forEach(h=>{let A=Le(h,"domicile",p,o),R=Ee(h);!A||!R||(S.has(A)||S.set(A,[]),S.get(A).push(R),_.push(A))}),u.forEach(h=>{s.includes(h.name)&&_.push(h.name)}),{chains:K(_).map(h=>{let A=[],R=new Map,f=b.get(h)||{name:h,sign:null,retrograde:!1},E=null,I=[];for(;f?.name&&!R.has(f.name);){R.set(f.name,A.length);let j=f.sign?be(f.sign,l,p,o):null;if(A.push({planet:f.name,sign:f.sign,ruler:j,retrograde:!!f.retrograde}),!j){E=f.name;break}if(!b.has(j)){E=j;break}if(j===f.name){E=j;break}f=b.get(j)}if(!E&&f?.name&&R.has(f.name)){let j=R.get(f.name);I=A.slice(j).map(U=>U.planet),E=Ce(I)}return{start:h,steps:A,finalKey:E,cycle:I}}).filter(h=>!(h.steps.length===1&&!h.steps[0]?.ruler)),housesByRuler:S}}function _e(n,l,o,p=""){let u=o.showHouseRulers?Be(l.get(n.planet)||[]):"",b=[F(n.planet),n.sign?fe(n.sign):"",u?`${$("common.house")} ${u}`:"",n.terminal?$("page.chart.rulers.chainEnd"):""].filter(Boolean).join(" · "),N=Number.isFinite(n.x)&&Number.isFinite(n.y)?` style="left:${n.x}px; top:${n.y}px;"`:"",S=n.terminal?" dispositor-compact-node--terminal":"";return`
            <span
                class="dispositor-compact-node ${p}${S}"
                ${N}
                title="${x(b)}"
                aria-label="${x(b)}"
            >
                <span class="dispositor-compact-symbol">${Z(n.planet,32)}</span>
                ${u?`<span class="dispositor-house-label">${x(u)}</span>`:""}
            </span>
        `}function we(n,l,o,p,u=""){let b=l.get(n)||{planet:n,sign:null};return _e(b,o,p,`dispositor-compact-node--static ${u}`.trim())}function ve(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function Ae(n,l){let o=n&&n!=="none"?n.split("+").filter(Boolean):[];if(o.length<=2)return[];let p=new Set(o),u=(N=[])=>N.length===o.length&&N.every(S=>p.has(S)),b=l.find(N=>u(N.cycle||[]))?.cycle;return b?[...b]:[]}function Re(n){let l=new Map;return n.forEach(o=>{o.steps.forEach(p=>{if(!p?.planet)return;let u=l.get(p.planet)||{planet:p.planet,sign:null};l.set(p.planet,{...u,sign:u.sign||p.sign||null,retrograde:u.retrograde||!!p.retrograde,terminal:!!(u.terminal||!p.ruler)})})}),l}function je(n,l,o,p){let u=Ae(n,l),b=new Set(u),N=Re(l),S=[...u,u[0]].filter(Boolean),_=[],w=new Set;return l.forEach(k=>{let h=k.steps.findIndex(f=>b.has(f.planet));if(h<=0)return;let A=k.steps.slice(0,h+1).map(f=>f.planet),R=A.join(">");w.has(R)||(w.add(R),_.push(A))}),`
            <section class="dispositor-compact-group" aria-label="${x($("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${S.map((k,h)=>`
                            ${h>0?ve():""}
                            ${we(k,N,o,p,`dispositor-compact-node--main${h===S.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${_.length?`
                        <div class="dispositor-cycle-branches">
                            ${_.map(k=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${k.map((h,A)=>`
                                        ${A>0?ve():""}
                                        ${we(h,N,o,p,b.has(h)?"dispositor-compact-node--main":"")}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function Fe(n,l,o){let p=[],u=new Set;if(n.forEach(S=>{let _=S.steps.map(w=>w.planet).join(">");u.has(_)||(u.add(_),p.push(S))}),!p.length)return`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`;let b=new Map;return p.forEach(S=>{let _=S.finalKey||"none";b.has(_)||b.set(_,[]),b.get(_).push(S)}),`
            <div class="dispositor-compact-diagram">
                ${[...b.entries()].sort((S,_)=>{let w=new Set(S[1].flatMap(h=>h.steps.map(A=>A.planet))).size,k=new Set(_[1].flatMap(h=>h.steps.map(A=>A.planet))).size;return w-k||String(S[0]).localeCompare(String(_[0]))}).map(([S,_],w)=>{if(Ae(S,_).length>2)return je(S,_,l,o);let h=xe(S,_),A=`url(#dispositorCompactArrow${w})`,R=` marker-end="${A}"`,f=` marker-start="${A}" marker-end="${A}"`;return`
                        <section class="dispositor-compact-group" aria-label="${x($("page.chart.rulers.modalTitle"))} ${w+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${h.width}px; --graph-height:${h.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${h.width} ${h.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${w}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${h.edges.map(E=>`
                                        <path d="${x(E.path)}"${R}></path>
                                    `).join("")}
                                    ${h.mutualEdges.map(E=>`
                                        <path class="dispositor-compact-mutual" d="${x(E.path)}"${f}></path>
                                    `).join("")}
                                </svg>
                                ${h.nodes.map(E=>_e(E,l,o,E.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function xe(n,l){let _=n&&n!=="none"?n.split("+").filter(Boolean):[],w=new Map,k=[],h=new Set,A=(d,g={})=>{if(!d)return null;let v=w.get(d)||{planet:d,sign:null,retrograde:!1},P=Object.prototype.hasOwnProperty.call(g,"ruler")&&!g.ruler;return w.set(d,{...v,sign:v.sign||g.sign||null,retrograde:v.retrograde||!!g.retrograde,terminal:!!(v.terminal||P)}),w.get(d)},R=(d,g)=>{let v=d?.planet,P=g?.planet;if(!v||!P||v===P)return;A(v,d),A(P,g);let M=`${v}->${P}`;h.has(M)||(h.add(M),k.push({child:v,parent:P}))};l.forEach(d=>{d.steps.forEach(g=>A(g.planet,g));for(let g=0;g<d.steps.length;g+=1){let v=d.steps[g],P=d.steps[g+1];P?R(v,P):v?.ruler&&!d.steps.some(M=>M.planet===v.ruler)&&R(v,{planet:v.ruler})}});let f=_.length?K(_):K([...w.keys()].filter(d=>!k.some(g=>g.child===d)));!f.length&&w.size&&f.push([...w.keys()][0]);let E=new Set(f),I=new Map,j=[],U=[];k.forEach(d=>{if(E.has(d.child)&&E.has(d.parent)){let g=K([d.child,d.parent]).join("<->");j.some(v=>v.key===g)||j.push({...d,key:g});return}U.push(d),I.has(d.parent)||I.set(d.parent,[]),I.get(d.parent).push(d.child)}),I.forEach((d,g)=>{I.set(g,K(d))});let X=!1,ee=(()=>{if(f.length<=2)return f;let d=(L=[])=>L.length===f.length&&L.every(z=>E.has(z)),g=l.find(L=>d(L.cycle||[]))?.cycle;if(g)return X=!0,[...g];let v=new Map(j.map(L=>[L.child,L.parent]));X=j.length>=f.length-1;let P=[],M=f[0];for(;M&&E.has(M)&&!P.includes(M);)P.push(M),M=v.get(M);return f.forEach(L=>{P.includes(L)||P.push(L)}),P})(),G=new Map,te=(d,g,v)=>{let P=8,M=(z,Y=0,V=new Set)=>{if(G.has(z))return G.get(z);if(V.has(z)){let J={x:v+g*Y*60,y:P};return P+=58,G.set(z,J),J}V.add(z);let Te=(I.get(z)||[]).filter(J=>!E.has(J)),me;if(!Te.length)me=P,P+=58;else{let J=Te.map(se=>M(se,Y+1,new Set(V)));me=(Math.min(...J.map(se=>se.y))+Math.max(...J.map(se=>se.y)))/2}V.delete(z);let He={x:v+g*Y*60,y:me};return G.set(z,He),He};return{rootPosition:M(d,0),height:P}},re=d=>{let g=[],v=[d],P=new Set;for(;v.length;){let M=v.pop();!M||P.has(M)||(P.add(M),g.push(M),(I.get(M)||[]).forEach(L=>{E.has(L)||v.push(L)}))}return g},m=(d,g)=>{re(d).forEach(v=>{let P=G.get(v);P&&(P.y+=g)})};if(f.length===2){let d=f[0],g=f[1],v=te(d,-1,0),P=te(g,1,72),M=Math.max(v.rootPosition.y,P.rootPosition.y);m(d,M-v.rootPosition.y),m(g,M-P.rootPosition.y)}else{let d=8;ee.forEach((g,v)=>{te(g,-1,0);let M=re(g).map(V=>G.get(V)).filter(Boolean);if(!M.length)return;let L=Math.min(...M.map(V=>V.y)),z=Math.max(...M.map(V=>V.y)),Y=d-L;Y&&m(g,Y),d=z+Y+(v===f.length-1?0:58)})}w.forEach((d,g)=>{G.has(g)||G.set(g,{x:0,y:8+G.size*58})});let C=Math.min(...[...G.values()].map(d=>d.x)),H=Math.min(...[...G.values()].map(d=>d.y));G.forEach(d=>{d.x=d.x-C+8,d.y=d.y-H+8});let B=[...w.values()].map(d=>({...d,isRoot:E.has(d.planet),...G.get(d.planet)||{x:8,y:8}})),D=new Map(B.map(d=>[d.planet,d])),W=d=>{let g=D.get(d.child),v=D.get(d.parent);if(!g||!v)return null;let P=1,M=g.x<v.x,L=M?g.x+42+P:g.x-P,z=M?v.x-P:v.x+42+P,Y=g.y+21,V=v.y+21;return{...d,path:`M${L},${Y} L${z},${V}`}},ue=d=>{let g=D.get(d.child),v=D.get(d.parent);if(!g||!v)return null;let P=Math.max(g.x,v.x)+42+8,M=P,L=g.y+21,z=v.y+21;if(z>=L)return{...d,path:`M${P},${L} L${M},${z}`};let Y=P+14;return{...d,path:`M${P},${L} L${Y},${L} L${Y},${z} L${M},${z}`}},he=f.length>2&&X?ee.map((d,g)=>({child:d,parent:ee[(g+1)%ee.length]})).filter(d=>d.child&&d.parent&&d.child!==d.parent):[],Xe=[...U.map(W).filter(Boolean),...he.map(ue).filter(Boolean)],We=f.length>2&&X?[]:j.map(W).filter(Boolean),Je=Math.max(220,Math.ceil(Math.max(...B.map(d=>d.x+42))+8)),Qe=Math.max(70,Math.ceil(Math.max(...B.map(d=>d.y+58))+8));return{width:Je,height:Qe,nodes:B,edges:Xe,mutualEdges:We}}function ze(n){let l=[],o=new Set;n.forEach(u=>{let b=u.steps.map(N=>N.planet).join(">");o.has(b)||(o.add(b),l.push(u))});let p=new Map;return l.forEach(u=>{let b=u.finalKey||"none";p.has(b)||p.set(b,[]),p.get(b).push(u)}),l.length?`
            <div class="dispositor-diagram">
                ${[...p.entries()].map(([u,b])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Ge(u,b.length)}
                        </div>
                        ${Ie(u,b)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`}function Ie(n,l){let o=Oe(n,l);return o.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${o.width}px; --graph-height:${o.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${o.width} ${o.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${o.edges.map(p=>`
                        <path d="${x(p.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${o.nodes.map(p=>ce(p,p.isRoot?"dispositor-chain-node--main":"",`left:${p.x}px; top:${p.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${x($("page.chart.rulers.empty.noChains"))}</p>`}function Oe(n,l){let N=new Set(n&&n!=="none"?n.split("+").filter(Boolean):[]),S=new Map,_=[],w=new Set,k=new Map,h=new Map,A=(m,C={})=>{if(!m)return null;let H=S.get(m)||{planet:m,sign:null,retrograde:!1};return S.set(m,{...H,sign:H.sign||C.sign||null,retrograde:H.retrograde||!!C.retrograde}),S.get(m)},R=(m,C)=>{let H=m?.planet,B=C?.planet;if(!H||!B||H===B||N.has(H)&&N.has(B))return;A(H,m),A(B,C);let D=`${H}->${B}`;w.has(D)||(w.add(D),_.push({child:H,parent:B}),h.set(H,B),k.has(B)||k.set(B,[]),k.get(B).push(H))};l.forEach(m=>{m.steps.forEach(H=>A(H.planet,H));for(let H=0;H<m.steps.length-1;H+=1)R(m.steps[H],m.steps[H+1]);let C=m.steps[m.steps.length-1];C?.ruler&&!m.steps.some(H=>H.planet===C.ruler)&&R(C,{planet:C.ruler})}),N.size||[...S.keys()].forEach(m=>{h.has(m)||N.add(m)}),!N.size&&S.size&&N.add([...S.keys()][0]),k.forEach((m,C)=>{k.set(C,K(m))});let f=new Map,E=(m,C=0)=>{f.has(m)&&f.get(m)<=C||(f.set(m,C),(k.get(m)||[]).forEach(H=>E(H,C+1)))};K([...N]).forEach(m=>E(m,0)),S.forEach((m,C)=>{f.has(C)||f.set(C,0)});let I=24,j=new Map,U=(m,C=new Set)=>{if(j.has(m))return j.get(m);if(C.has(m)){let D=I;return I+=76,j.set(m,D),D}C.add(m);let H=k.get(m)||[],B;if(!H.length)B=I,I+=76;else{let D=H.map(W=>U(W,new Set(C)));B=(Math.min(...D)+Math.max(...D))/2}return C.delete(m),j.set(m,B),B};K([...N]).forEach(m=>U(m)),S.forEach((m,C)=>U(C));let X=[...S.values()].map(m=>({...m,isRoot:N.has(m.planet),x:24+(f.get(m.planet)||0)*128,y:j.get(m.planet)||24})),de=new Map(X.map(m=>[m.planet,m])),ee=Math.max(0,...X.map(m=>f.get(m.planet)||0)),G=Math.max(180,I+24),te=Math.max(520,48+ee*128+44),re=_.map(m=>{let C=de.get(m.child),H=de.get(m.parent);if(!C||!H)return null;let B=C.x,D=C.y+44/2,W=H.x+44,ue=H.y+44/2,he=Math.max(W+18,B-42);return{...m,path:`M${B},${D} H${he} V${ue} H${W}`}}).filter(Boolean);return{width:te,height:G,nodes:X,edges:re}}function Ge(n,l){if(!n||n==="none")return`
                <span class="dispositor-diagram-group-title">${x($("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${l}</span>
            `;let o=n.split("+").filter(Boolean),p=o.map(F).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${x(p)}">
                ${o.map(u=>Z(u,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${l}</span>
        `}function De(n){let l=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${x($("page.chart.rulers.modeLabel"))}">
                ${l.map(o=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${o===n?" active":""}"
                        data-dispositor-mode="${o}"
                        role="tab"
                        aria-selected="${o===n?"true":"false"}"
                    >${x($(`astro.dignity.${o}`))}</button>
                `).join("")}
            </div>
        `}function Pe(n){return["domicile","exaltation","detriment","fall"].includes(n)?n:a.mode}function qe(n={}){let l={};try{l=JSON.parse(window.localStorage?.getItem(i)||"{}")||{}}catch{l={}}return{...a,mode:Pe(n.mode||l.mode||a.mode),showArrowDirection:(n.showArrowDirection??l.showArrowDirection??a.showArrowDirection)!==!1,showHouseRulers:(n.showHouseRulers??l.showHouseRulers??a.showHouseRulers)!==!1,classicalRulers:(n.classicalRulers??l.classicalRulers??a.classicalRulers)===!0}}function Ye(n){try{window.localStorage?.setItem(i,JSON.stringify(n))}catch{}}function Ne(n){let l=`page.chart.rulers.chainModes.${n}`,o=$(l);return o!==l?o:$(n==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${n}`)}function Ve(n){let l=["domicile","exaltation","detriment","fall"];return`
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
                        ${l.map(o=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${x(o)}"
                                    data-dispositor-option="mode"
                                    ${o===n.mode?"checked":""}
                                >
                                <span>${x(Ne(o))}</span>
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
        `}function pe(n,l,o){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <h4>${x($("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Ve(o)}
                </div>
                ${Fe(n,l,o)}
            </div>
        `}function Ke(n,l,o,p){return`
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
                    ${pe(l,o,p)}
                </div>
            </div>
        `}function Ue(n,l={},o="domicile"){ne();let{chains:p,mainRulers:u}=$e(n,o),b=document.createElement("div");b.className="dispositor-modal-overlay",b.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${x($("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${x($("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${De(o)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${x($("page.chart.rulers.mainKicker"))}</span>
                    ${Me(u)}
                </div>
                ${ze(p)}
            </div>
        `,document.body.appendChild(b),document.body.classList.add("dispositor-modal-open"),b.addEventListener("click",N=>{let S=N.target;if(S===b||S instanceof Element&&S.closest("[data-dispositor-close]")){ne();return}if(!(S instanceof Element))return;let _=S.closest(".dispositor-mode-tab[data-dispositor-mode]");_&&Ue(n,l,_.dataset.dispositorMode||o)}),b.querySelector("[data-dispositor-close]")?.focus()}function ne(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function ke(n,l,o={}){let p=typeof n=="string"?document.getElementById(n):n;if(!p)return;let u=qe(o),{chains:b,housesByRuler:N}=Se(l,u.mode,u);o.section==="jones"?p.innerHTML=`<div class="dispositor-panel">${le(l?.cosmogram_pattern)}</div>`:o.section==="scheme"?p.innerHTML=`<div class="dispositor-panel">${pe(b,N,u)}</div>`:p.innerHTML=o.layout==="tabs"?Ke(l,b,N,u):`
                    <div class="dispositor-panel">
                        ${le(l?.cosmogram_pattern)}
                        ${pe(b,N,u)}
                    </div>
                `,p.querySelectorAll("[data-dispositor-tab]").forEach(w=>{w.addEventListener("click",()=>{let k=w.dataset.dispositorTab;p.querySelectorAll("[data-dispositor-tab]").forEach(h=>{let A=h.dataset.dispositorTab===k;h.classList.toggle("active",A),h.setAttribute("aria-selected",A?"true":"false")}),p.querySelectorAll("[data-dispositor-panel]").forEach(h=>{h.classList.toggle("active",h.dataset.dispositorPanel===k)})})});let S=p.querySelector("[data-dispositor-options-toggle]"),_=p.querySelector("[data-dispositor-options-menu]");S?.addEventListener("click",w=>{w.stopPropagation();let k=_&&!_.classList.contains("hidden");_?.classList.toggle("hidden",k),S.setAttribute("aria-expanded",k?"false":"true")}),_?.addEventListener("click",w=>w.stopPropagation()),_?.querySelectorAll("[data-dispositor-option]").forEach(w=>{w.addEventListener("change",()=>{let k={...u};w.dataset.dispositorOption==="mode"?k.mode=Pe(w.value):k[w.dataset.dispositorOption]=w.checked,Ye(k),ke(p,l,k)})})}window.DispositorChains={render:ke,buildChains:$e,buildHouseDispositorScheme:Se,buildCompactLayout:xe,closeModal:ne},document.addEventListener("keydown",n=>{n.key==="Escape"&&(ne(),document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",n=>{n.target instanceof Element&&n.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(l=>l.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(l=>{l.setAttribute("aria-expanded","false")}))})})();
