(function(){"use strict";let Z=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],O=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],he=O.slice(0,10),oe="dispositorChainDisplayOptions",B={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},re={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},ne=Object.fromEntries(Z.map((e,s)=>[e,Z[(s+6)%12]])),me={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},ge={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function b(e,s){return window.FrontendI18n?.t?.(e,s)||e}function g(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function T(e){return ge[e]||e}function j(e){if(!e)return"—";let s=`astro.planet.${e}`,t=b(s);return t!==s?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function fe(e){if(!e)return"—";let s=`astro.sign.${e}`,t=b(s);return t!==s?t:window.Symbols?.signNamesRu?.[e]||e}function J(e,s=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:s,title:j(e)})||`<span class="astro-symbol">${g(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function ae(e){return[window.Symbols?.signs?.[e]||"",fe(e)].filter(Boolean).join(" ")}function Q(){let e={},s=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return Z.forEach(t=>{let o=me[t]||{},a=s?.[t]||{},l=T(a.ruler||o.ruler||null),S=T(a.co_ruler||o.co_ruler||null),u=T(a.exaltation||o.exaltation||null);l&&S&&l===S&&(S=null),e[t]={ruler:l,co_ruler:S,exaltation:u}}),e}function U(e,s,t=Q()){let o=t?.[e]||{},a=t?.[ne[e]]||{};return s==="exaltation"?o.exaltation||null:s==="detriment"?a.ruler||null:s==="fall"?a.exaltation||null:o.ruler||null}function ie(e,s,t,o=B){return e?o.classicalRulers&&s==="domicile"?re[e]||U(e,s,t):o.classicalRulers&&s==="detriment"&&re[ne[e]]||U(e,s,t):null}function le(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&O.includes(T(t.name))).map(t=>({...t,name:T(t.name)})).sort((t,o)=>O.indexOf(t.name)-O.indexOf(o.name))}function ce(e,s){let t=Q(),o=le(e),a=new Map(o.map(c=>[c.name,c])),l=[],S=new Map;o.forEach(c=>{let h=[],i=new Map,m=c,w=null,x=[];for(;m?.name&&!i.has(m.name);){i.set(m.name,h.length);let d=U(m.sign,s,t);if(h.push({planet:m.name,sign:m.sign,ruler:d,retrograde:!!m.retrograde}),!d){w="none";break}if(!a.has(d)){w=d;break}if(d===m.name){w=d;break}m=a.get(d)}if(!w&&m?.name&&i.has(m.name)){let d=i.get(m.name);x=h.slice(d).map(_=>_.planet),w=x.join("+")}S.set(w,(S.get(w)||0)+1),l.push({start:c.name,steps:h,finalKey:w,cycle:x})});let u=[...S.entries()].filter(([c])=>c&&c!=="none").sort((c,h)=>h[1]-c[1]||c[0].localeCompare(h[0])).slice(0,4);return{chains:l,mainRulers:u}}function ye(e){if(!e)return`<p class="dispositor-empty">${g(b("page.chart.rulers.empty.noJones"))}</p>`;let s=(()=>{let o=`astro.pattern.${e.pattern_type}`,a=b(o);return a===o?e.pattern_type||"—":a})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push(b("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push(b("page.chart.balances.handle",{planet:j(e.handle_planet)})),e.leading_planet&&t.push(b("page.chart.balances.leading",{planet:j(e.leading_planet)})),`
            <article class="dispositor-jones-card">
                <span class="dispositor-card-kicker">${g(b("page.chart.rulers.jonesKicker"))}</span>
                <h4>${g(s)}</h4>
                ${t.length?`<p>${g(t.join(" · "))}</p>`:""}
            </article>
        `}function $e(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([s,t])=>{let o=s.split("+").filter(Boolean),a=o.map(j).join(" + ");return`
                        <span class="dispositor-main-chip" title="${g(a)}">
                            ${o.map(l=>J(l,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${g(b("page.chart.rulers.empty.noMainRulers"))}</p>`}function ee(e,s="",t=""){let o=[j(e.planet),e.sign?ae(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${s}" style="${g(t)}" title="${g(o)}" aria-label="${g(o)}">
                ${J(e.planet,15)}
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
            </span>
        `}function De(e){let s=[...e.steps].reverse().map((o,a)=>{let l=a===0&&e.finalKey!=="none";return ee(o,l?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(o=>o.planet===t.ruler)&&s.unshift(ee({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${s.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function G(e){return[...new Set(e)].sort((s,t)=>{let o=O.indexOf(s),a=O.indexOf(t);return(o===-1?999:o)-(a===-1?999:a)})}function we(e){return G(e).join("+")}function be(e){let s=e?.number??e?.house_number,t=Number(s);return Number.isInteger(t)?t:s}function Se(e){let s=[...new Set(e)].map(t=>Number(t)).filter(t=>Number.isInteger(t)).sort((t,o)=>t-o);return s.length?window.Symbols?.formatHouseList?.(s,{style:"roman",separator:","})||s.map(t=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][t-1]||String(t)).join(","):""}function xe(e,s,t,o=B){return s==="domicile"&&e?.ruler_planet&&!o.classicalRulers?T(e.ruler_planet):T(ie(e?.sign,s,t,o))}function Me(e,s,t=B){let o=Q(),a=le(e),l=new Map(a.map(i=>[i.name,i])),S=Array.isArray(e?.houses)?e.houses:[],u=new Map,c=[];return S.forEach(i=>{let m=xe(i,s,o,t),w=be(i);!m||!w||(u.has(m)||u.set(m,[]),u.get(m).push(w),c.push(m))}),a.forEach(i=>{he.includes(i.name)&&c.push(i.name)}),{chains:G(c).map(i=>{let m=[],w=new Map,x=l.get(i)||{name:i,sign:null,retrograde:!1},d=null,_=[];for(;x?.name&&!w.has(x.name);){w.set(x.name,m.length);let E=x.sign?ie(x.sign,s,o,t):null;if(m.push({planet:x.name,sign:x.sign,ruler:E,retrograde:!!x.retrograde}),!E){d=x.name;break}if(!l.has(E)){d=E;break}if(E===x.name){d=E;break}x=l.get(E)}if(!d&&x?.name&&w.has(x.name)){let E=w.get(x.name);_=m.slice(E).map(L=>L.planet),d=we(_)}return{start:i,steps:m,finalKey:d,cycle:_}}),housesByRuler:u}}function Ee(e,s,t,o=""){let a=t.showHouseRulers?Se(s.get(e.planet)||[]):"",l=[j(e.planet),e.sign?ae(e.sign):"",a?`${b("common.house")} ${a}`:""].filter(Boolean).join(" · ");return`
            <span
                class="dispositor-compact-node ${o}"
                style="left:${e.x}px; top:${e.y}px;"
                title="${g(l)}"
                aria-label="${g(l)}"
            >
                <span class="dispositor-compact-symbol">${J(e.planet,24)}</span>
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
                ${a?`<span class="dispositor-house-label">${g(a)}</span>`:""}
            </span>
        `}function ke(e,s,t){let o=[],a=new Set;if(e.forEach(u=>{let c=u.steps.map(h=>h.planet).join(">");a.has(c)||(a.add(c),o.push(u))}),!o.length)return`<p class="dispositor-empty">${g(b("page.chart.rulers.empty.noChains"))}</p>`;let l=new Map;return o.forEach(u=>{let c=u.finalKey||"none";l.has(c)||l.set(c,[]),l.get(c).push(u)}),`
            <div class="dispositor-compact-diagram">
                ${[...l.entries()].sort((u,c)=>{let h=new Set(u[1].flatMap(m=>m.steps.map(w=>w.planet))).size,i=new Set(c[1].flatMap(m=>m.steps.map(w=>w.planet))).size;return h-i||String(u[0]).localeCompare(String(c[0]))}).map(([u,c],h)=>{let i=ve(u,c),m=`url(#dispositorCompactArrow${h})`,w=t.showArrowDirection?` marker-end="${m}"`:"",x=t.showArrowDirection?` marker-start="${m}" marker-end="${m}"`:"";return`
                        <section class="dispositor-compact-group" aria-label="${g(b("page.chart.rulers.modalTitle"))} ${h+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${h}" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto-start-reverse" markerUnits="strokeWidth">
                                            <path d="M0,0 L5,2.5 L0,5 Z"></path>
                                        </marker>
                                    </defs>
                                    ${i.edges.map(d=>`
                                        <path d="${g(d.path)}"${w}></path>
                                    `).join("")}
                                    ${i.mutualEdges.map(d=>`
                                        <path class="dispositor-compact-mutual" d="${g(d.path)}"${x}></path>
                                    `).join("")}
                                </svg>
                                ${i.nodes.map(d=>Ee(d,s,t,d.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function ve(e,s){let c=e&&e!=="none"?e.split("+").filter(Boolean):[],h=new Map,i=[],m=new Set,w=(r,p={})=>{if(!r)return null;let y=h.get(r)||{planet:r,sign:null,retrograde:!1};return h.set(r,{...y,sign:y.sign||p.sign||null,retrograde:y.retrograde||!!p.retrograde}),h.get(r)},x=(r,p)=>{let y=r?.planet,M=p?.planet;if(!y||!M||y===M)return;w(y,r),w(M,p);let R=`${y}->${M}`;m.has(R)||(m.add(R),i.push({child:y,parent:M}))};s.forEach(r=>{r.steps.forEach(p=>w(p.planet,p));for(let p=0;p<r.steps.length;p+=1){let y=r.steps[p],M=r.steps[p+1];M?x(y,M):y?.ruler&&!r.steps.some(R=>R.planet===y.ruler)&&x(y,{planet:y.ruler})}});let d=c.length?G(c):G([...h.keys()].filter(r=>!i.some(p=>p.child===r)));!d.length&&h.size&&d.push([...h.keys()][0]);let _=new Set(d),E=new Map,L=[],z=[];i.forEach(r=>{if(_.has(r.child)&&_.has(r.parent)){let p=G([r.child,r.parent]).join("<->");L.some(y=>y.key===p)||L.push({...r,key:p});return}z.push(r),E.has(r.parent)||E.set(r.parent,[]),E.get(r.parent).push(r.child)}),E.forEach((r,p)=>{E.set(p,G(r))});let v=new Map,V=(r,p,y)=>{let M=8,R=(P,H=0,C=new Set)=>{if(v.has(P))return v.get(P);if(C.has(P)){let I={x:y+p*H*44,y:M};return M+=54,v.set(P,I),I}C.add(P);let Y=(E.get(P)||[]).filter(I=>!_.has(I)),D;if(!Y.length)D=M,M+=54;else{let I=Y.map(F=>R(F,H+1,new Set(C)));D=(Math.min(...I.map(F=>F.y))+Math.max(...I.map(F=>F.y)))/2}C.delete(P);let X={x:y+p*H*44,y:D};return v.set(P,X),X};return{rootPosition:R(r,0),height:M}};if(d.length===2){let r=d[0],p=d[1],y=V(r,-1,0),M=V(p,1,46),R=Math.max(y.rootPosition.y,M.rootPosition.y),N=(P,H)=>{let C=[P],Y=new Set;for(;C.length;){let D=C.pop();if(!D||Y.has(D))continue;Y.add(D);let X=v.get(D);X&&(X.y+=H),(E.get(D)||[]).forEach(I=>{_.has(I)||C.push(I)})}};N(r,R-y.rootPosition.y),N(p,R-M.rootPosition.y)}else d.forEach((r,p)=>{let y=V(r,-1,p*108),M=p===0?0:p*108-y.rootPosition.y;M&&v.forEach((R,N)=>{(N===r||(E.get(r)||[]).includes(N))&&(R.y+=M)})});h.forEach((r,p)=>{v.has(p)||v.set(p,{x:0,y:8+v.size*54})});let te=Math.min(...[...v.values()].map(r=>r.x)),se=Math.min(...[...v.values()].map(r=>r.y));v.forEach(r=>{r.x=r.x-te+8,r.y=r.y-se+8});let q=[...h.values()].map(r=>({...r,isRoot:_.has(r.planet),...v.get(r.planet)||{x:8,y:8}})),K=new Map(q.map(r=>[r.planet,r])),n=r=>{let p=K.get(r.child),y=K.get(r.parent);if(!p||!y)return null;let M=5,R=p.x<y.x,N=R?p.x+34+M:p.x-M,P=R?y.x-M:y.x+34+M,H=p.y+18,C=y.y+18,Y=N+(P-N)/2;return{...r,path:`M${N},${H} H${Y} V${C} H${P}`}},$=z.map(n).filter(Boolean),f=L.map(n).filter(Boolean),k=Math.max(220,Math.ceil(Math.max(...q.map(r=>r.x+34))+8)),A=Math.max(70,Math.ceil(Math.max(...q.map(r=>r.y+44))+8));return{width:k,height:A,nodes:q,edges:$,mutualEdges:f}}function Re(e){let s=[],t=new Set;e.forEach(a=>{let l=a.steps.map(S=>S.planet).join(">");t.has(l)||(t.add(l),s.push(a))});let o=new Map;return s.forEach(a=>{let l=a.finalKey||"none";o.has(l)||o.set(l,[]),o.get(l).push(a)}),s.length?`
            <div class="dispositor-diagram">
                ${[...o.entries()].map(([a,l])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Ae(a,l.length)}
                        </div>
                        ${_e(a,l)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${g(b("page.chart.rulers.empty.noChains"))}</p>`}function _e(e,s){let t=Pe(e,s);return t.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${t.width}px; --graph-height:${t.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${t.width} ${t.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${t.edges.map(o=>`
                        <path d="${g(o.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${t.nodes.map(o=>ee(o,o.isRoot?"dispositor-chain-node--main":"",`left:${o.x}px; top:${o.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${g(b("page.chart.rulers.empty.noChains"))}</p>`}function Pe(e,s){let S=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),u=new Map,c=[],h=new Set,i=new Map,m=new Map,w=(n,$={})=>{if(!n)return null;let f=u.get(n)||{planet:n,sign:null,retrograde:!1};return u.set(n,{...f,sign:f.sign||$.sign||null,retrograde:f.retrograde||!!$.retrograde}),u.get(n)},x=(n,$)=>{let f=n?.planet,k=$?.planet;if(!f||!k||f===k||S.has(f)&&S.has(k))return;w(f,n),w(k,$);let A=`${f}->${k}`;h.has(A)||(h.add(A),c.push({child:f,parent:k}),m.set(f,k),i.has(k)||i.set(k,[]),i.get(k).push(f))};s.forEach(n=>{n.steps.forEach(f=>w(f.planet,f));for(let f=0;f<n.steps.length-1;f+=1)x(n.steps[f],n.steps[f+1]);let $=n.steps[n.steps.length-1];$?.ruler&&!n.steps.some(f=>f.planet===$.ruler)&&x($,{planet:$.ruler})}),S.size||[...u.keys()].forEach(n=>{m.has(n)||S.add(n)}),!S.size&&u.size&&S.add([...u.keys()][0]),i.forEach((n,$)=>{i.set($,G(n))});let d=new Map,_=(n,$=0)=>{d.has(n)&&d.get(n)<=$||(d.set(n,$),(i.get(n)||[]).forEach(f=>_(f,$+1)))};G([...S]).forEach(n=>_(n,0)),u.forEach((n,$)=>{d.has($)||d.set($,0)});let E=24,L=new Map,z=(n,$=new Set)=>{if(L.has(n))return L.get(n);if($.has(n)){let A=E;return E+=76,L.set(n,A),A}$.add(n);let f=i.get(n)||[],k;if(!f.length)k=E,E+=76;else{let A=f.map(r=>z(r,new Set($)));k=(Math.min(...A)+Math.max(...A))/2}return $.delete(n),L.set(n,k),k};G([...S]).forEach(n=>z(n)),u.forEach((n,$)=>z($));let v=[...u.values()].map(n=>({...n,isRoot:S.has(n.planet),x:24+(d.get(n.planet)||0)*128,y:L.get(n.planet)||24})),V=new Map(v.map(n=>[n.planet,n])),te=Math.max(0,...v.map(n=>d.get(n.planet)||0)),se=Math.max(180,E+24),q=Math.max(520,48+te*128+44),K=c.map(n=>{let $=V.get(n.child),f=V.get(n.parent);if(!$||!f)return null;let k=$.x,A=$.y+44/2,r=f.x+44,p=f.y+44/2,y=Math.max(r+18,k-42);return{...n,path:`M${k},${A} H${y} V${p} H${r}`}}).filter(Boolean);return{width:q,height:se,nodes:v,edges:K}}function Ae(e,s){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${g(b("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${s}</span>
            `;let t=e.split("+").filter(Boolean),o=t.map(j).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${g(o)}">
                ${t.map(a=>J(a,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${s}</span>
        `}function Le(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${g(b("page.chart.rulers.modeLabel"))}">
                ${s.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${g(b(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function pe(e){return["domicile","exaltation","detriment","fall"].includes(e)?e:B.mode}function Ne(e={}){let s={};try{s=JSON.parse(window.localStorage?.getItem(oe)||"{}")||{}}catch{s={}}return{...B,mode:pe(e.mode||s.mode||B.mode),showArrowDirection:(e.showArrowDirection??s.showArrowDirection??B.showArrowDirection)!==!1,showHouseRulers:(e.showHouseRulers??s.showHouseRulers??B.showHouseRulers)!==!1,classicalRulers:(e.classicalRulers??s.classicalRulers??B.classicalRulers)===!0}}function Ce(e){try{window.localStorage?.setItem(oe,JSON.stringify(e))}catch{}}function ue(e){let s=`page.chart.rulers.chainModes.${e}`,t=b(s);return t!==s?t:b(e==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${e}`)}function Ie(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${g(ue(e.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${g(b("page.chart.rulers.options.chainType"))}">
                        ${s.map(t=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${g(t)}"
                                    data-dispositor-option="mode"
                                    ${t===e.mode?"checked":""}
                                >
                                <span>${g(ue(t))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <div class="dispositor-options-divider"></div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showArrowDirection" ${e.showArrowDirection?"checked":""}>
                        <span>${g(b("page.chart.rulers.options.arrowDirection"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${e.showHouseRulers?"checked":""}>
                        <span>${g(b("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${e.classicalRulers?"checked":""}>
                        <span>${g(b("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function Be(e,s={},t="domicile"){W();let{chains:o,mainRulers:a}=ce(e,t),l=document.createElement("div");l.className="dispositor-modal-overlay",l.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${g(b("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${g(b("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Le(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${g(b("page.chart.rulers.mainKicker"))}</span>
                    ${$e(a)}
                </div>
                ${Re(o)}
            </div>
        `,document.body.appendChild(l),document.body.classList.add("dispositor-modal-open"),l.addEventListener("click",S=>{let u=S.target;if(u===l||u instanceof Element&&u.closest("[data-dispositor-close]")){W();return}if(!(u instanceof Element))return;let c=u.closest(".dispositor-mode-tab[data-dispositor-mode]");c&&Be(e,s,c.dataset.dispositorMode||t)}),l.querySelector("[data-dispositor-close]")?.focus()}function W(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function de(e,s,t={}){let o=typeof e=="string"?document.getElementById(e):e;if(!o)return;let a=Ne(t),{chains:l,housesByRuler:S}=Me(s,a.mode,a);o.innerHTML=`
            <div class="dispositor-panel">
                ${ye(s?.cosmogram_pattern)}
                <div class="dispositor-section">
                    <div class="dispositor-section-head">
                        <div>
                            <span class="dispositor-card-kicker">${g(b("page.chart.rulers.mainKicker"))}</span>
                            <h4>${g(b("page.chart.rulers.modalTitle"))}</h4>
                        </div>
                        ${Ie(a)}
                    </div>
                    ${ke(l,S,a)}
                </div>
            </div>
        `;let u=o.querySelector("[data-dispositor-options-toggle]"),c=o.querySelector("[data-dispositor-options-menu]");u?.addEventListener("click",h=>{h.stopPropagation();let i=c&&!c.classList.contains("hidden");c?.classList.toggle("hidden",i),u.setAttribute("aria-expanded",i?"false":"true")}),c?.addEventListener("click",h=>h.stopPropagation()),c?.querySelectorAll("[data-dispositor-option]").forEach(h=>{h.addEventListener("change",()=>{let i={...a};h.dataset.dispositorOption==="mode"?i.mode=pe(h.value):i[h.dataset.dispositorOption]=h.checked,Ce(i),de(o,s,i)})})}window.DispositorChains={render:de,buildChains:ce,closeModal:W},document.addEventListener("keydown",e=>{e.key==="Escape"&&(W(),document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",e=>{e.target instanceof Element&&e.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))})})();
