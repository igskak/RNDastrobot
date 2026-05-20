(function(){"use strict";let Z=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],O=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],ge=O.slice(0,10),oe="dispositorChainDisplayOptions",B={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},re={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},ne=Object.fromEntries(Z.map((e,s)=>[e,Z[(s+6)%12]])),fe={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},ye={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function $(e,s){return window.FrontendI18n?.t?.(e,s)||e}function h(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function G(e){return ye[e]||e}function D(e){if(!e)return"—";let s=`astro.planet.${e}`,t=$(s);return t!==s?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function be(e){if(!e)return"—";let s=`astro.sign.${e}`,t=$(s);return t!==s?t:window.Symbols?.signNamesRu?.[e]||e}function J(e,s=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:s,title:D(e)})||`<span class="astro-symbol">${h(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function ae(e){return[window.Symbols?.signs?.[e]||"",be(e)].filter(Boolean).join(" ")}function Q(){let e={},s=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return Z.forEach(t=>{let o=fe[t]||{},a=s?.[t]||{},l=G(a.ruler||o.ruler||null),S=G(a.co_ruler||o.co_ruler||null),m=G(a.exaltation||o.exaltation||null);l&&S&&l===S&&(S=null),e[t]={ruler:l,co_ruler:S,exaltation:m}}),e}function U(e,s,t=Q()){let o=t?.[e]||{},a=t?.[ne[e]]||{};return s==="exaltation"?o.exaltation||null:s==="detriment"?a.ruler||null:s==="fall"?a.exaltation||null:o.ruler||null}function ie(e,s,t,o=B){return e?o.classicalRulers&&s==="domicile"?re[e]||U(e,s,t):o.classicalRulers&&s==="detriment"&&re[ne[e]]||U(e,s,t):null}function le(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&O.includes(G(t.name))).map(t=>({...t,name:G(t.name)})).sort((t,o)=>O.indexOf(t.name)-O.indexOf(o.name))}function ce(e,s){let t=Q(),o=le(e),a=new Map(o.map(p=>[p.name,p])),l=[],S=new Map;o.forEach(p=>{let d=[],i=new Map,c=p,f=null,x=[];for(;c?.name&&!i.has(c.name);){i.set(c.name,d.length);let g=U(c.sign,s,t);if(d.push({planet:c.name,sign:c.sign,ruler:g,retrograde:!!c.retrograde}),!g){f="none";break}if(!a.has(g)){f=g;break}if(g===c.name){f=g;break}c=a.get(g)}if(!f&&c?.name&&i.has(c.name)){let g=i.get(c.name);x=d.slice(g).map(_=>_.planet),f=x.join("+")}S.set(f,(S.get(f)||0)+1),l.push({start:p.name,steps:d,finalKey:f,cycle:x})});let m=[...S.entries()].filter(([p])=>p&&p!=="none").sort((p,d)=>d[1]-p[1]||p[0].localeCompare(d[0])).slice(0,4);return{chains:l,mainRulers:m}}function pe(e){if(!e)return`<p class="dispositor-empty">${h($("page.chart.rulers.empty.noJones"))}</p>`;let s=(()=>{let o=`astro.pattern.${e.pattern_type}`,a=$(o);return a===o?e.pattern_type||"—":a})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push($("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push($("page.chart.balances.handle",{planet:D(e.handle_planet)})),e.leading_planet&&t.push($("page.chart.balances.leading",{planet:D(e.leading_planet)})),`
            <article class="dispositor-jones-card">
                <span class="dispositor-card-kicker">${h($("page.chart.rulers.jonesKicker"))}</span>
                <h4>${h(s)}</h4>
                ${t.length?`<p>${h(t.join(" · "))}</p>`:""}
            </article>
        `}function $e(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([s,t])=>{let o=s.split("+").filter(Boolean),a=o.map(D).join(" + ");return`
                        <span class="dispositor-main-chip" title="${h(a)}">
                            ${o.map(l=>J(l,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${h($("page.chart.rulers.empty.noMainRulers"))}</p>`}function ee(e,s="",t=""){let o=[D(e.planet),e.sign?ae(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${s}" style="${h(t)}" title="${h(o)}" aria-label="${h(o)}">
                ${J(e.planet,15)}
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
            </span>
        `}function De(e){let s=[...e.steps].reverse().map((o,a)=>{let l=a===0&&e.finalKey!=="none";return ee(o,l?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(o=>o.planet===t.ruler)&&s.unshift(ee({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${s.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function T(e){return[...new Set(e)].sort((s,t)=>{let o=O.indexOf(s),a=O.indexOf(t);return(o===-1?999:o)-(a===-1?999:a)})}function we(e){return T(e).join("+")}function Se(e){let s=e?.number??e?.house_number,t=Number(s);return Number.isInteger(t)?t:s}function xe(e){let s=[...new Set(e)].map(t=>Number(t)).filter(t=>Number.isInteger(t)).sort((t,o)=>t-o);return s.length?window.Symbols?.formatHouseList?.(s,{style:"roman",separator:","})||s.map(t=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][t-1]||String(t)).join(","):""}function Me(e,s,t,o=B){return s==="domicile"&&e?.ruler_planet&&!o.classicalRulers?G(e.ruler_planet):G(ie(e?.sign,s,t,o))}function Ee(e,s,t=B){let o=Q(),a=le(e),l=new Map(a.map(i=>[i.name,i])),S=Array.isArray(e?.houses)?e.houses:[],m=new Map,p=[];return S.forEach(i=>{let c=Me(i,s,o,t),f=Se(i);!c||!f||(m.has(c)||m.set(c,[]),m.get(c).push(f),p.push(c))}),a.forEach(i=>{ge.includes(i.name)&&p.push(i.name)}),{chains:T(p).map(i=>{let c=[],f=new Map,x=l.get(i)||{name:i,sign:null,retrograde:!1},g=null,_=[];for(;x?.name&&!f.has(x.name);){f.set(x.name,c.length);let E=x.sign?ie(x.sign,s,o,t):null;if(c.push({planet:x.name,sign:x.sign,ruler:E,retrograde:!!x.retrograde}),!E){g=x.name;break}if(!l.has(E)){g=E;break}if(E===x.name){g=E;break}x=l.get(E)}if(!g&&x?.name&&f.has(x.name)){let E=f.get(x.name);_=c.slice(E).map(L=>L.planet),g=we(_)}return{start:i,steps:c,finalKey:g,cycle:_}}),housesByRuler:m}}function ve(e,s,t,o=""){let a=t.showHouseRulers?xe(s.get(e.planet)||[]):"",l=[D(e.planet),e.sign?ae(e.sign):"",a?`${$("common.house")} ${a}`:""].filter(Boolean).join(" · ");return`
            <span
                class="dispositor-compact-node ${o}"
                style="left:${e.x}px; top:${e.y}px;"
                title="${h(l)}"
                aria-label="${h(l)}"
            >
                <span class="dispositor-compact-symbol">${J(e.planet,24)}</span>
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
                ${a?`<span class="dispositor-house-label">${h(a)}</span>`:""}
            </span>
        `}function ke(e,s,t){let o=[],a=new Set;if(e.forEach(m=>{let p=m.steps.map(d=>d.planet).join(">");a.has(p)||(a.add(p),o.push(m))}),!o.length)return`<p class="dispositor-empty">${h($("page.chart.rulers.empty.noChains"))}</p>`;let l=new Map;return o.forEach(m=>{let p=m.finalKey||"none";l.has(p)||l.set(p,[]),l.get(p).push(m)}),`
            <div class="dispositor-compact-diagram">
                ${[...l.entries()].sort((m,p)=>{let d=new Set(m[1].flatMap(c=>c.steps.map(f=>f.planet))).size,i=new Set(p[1].flatMap(c=>c.steps.map(f=>f.planet))).size;return d-i||String(m[0]).localeCompare(String(p[0]))}).map(([m,p],d)=>{let i=Re(m,p),c=`url(#dispositorCompactArrow${d})`,f=t.showArrowDirection?` marker-end="${c}"`:"",x=t.showArrowDirection?` marker-start="${c}" marker-end="${c}"`:"";return`
                        <section class="dispositor-compact-group" aria-label="${h($("page.chart.rulers.modalTitle"))} ${d+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${d}" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto-start-reverse" markerUnits="strokeWidth">
                                            <path d="M0,0 L5,2.5 L0,5 Z"></path>
                                        </marker>
                                    </defs>
                                    ${i.edges.map(g=>`
                                        <path d="${h(g.path)}"${f}></path>
                                    `).join("")}
                                    ${i.mutualEdges.map(g=>`
                                        <path class="dispositor-compact-mutual" d="${h(g.path)}"${x}></path>
                                    `).join("")}
                                </svg>
                                ${i.nodes.map(g=>ve(g,s,t,g.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function Re(e,s){let p=e&&e!=="none"?e.split("+").filter(Boolean):[],d=new Map,i=[],c=new Set,f=(r,u={})=>{if(!r)return null;let b=d.get(r)||{planet:r,sign:null,retrograde:!1};return d.set(r,{...b,sign:b.sign||u.sign||null,retrograde:b.retrograde||!!u.retrograde}),d.get(r)},x=(r,u)=>{let b=r?.planet,M=u?.planet;if(!b||!M||b===M)return;f(b,r),f(M,u);let R=`${b}->${M}`;c.has(R)||(c.add(R),i.push({child:b,parent:M}))};s.forEach(r=>{r.steps.forEach(u=>f(u.planet,u));for(let u=0;u<r.steps.length;u+=1){let b=r.steps[u],M=r.steps[u+1];M?x(b,M):b?.ruler&&!r.steps.some(R=>R.planet===b.ruler)&&x(b,{planet:b.ruler})}});let g=p.length?T(p):T([...d.keys()].filter(r=>!i.some(u=>u.child===r)));!g.length&&d.size&&g.push([...d.keys()][0]);let _=new Set(g),E=new Map,L=[],q=[];i.forEach(r=>{if(_.has(r.child)&&_.has(r.parent)){let u=T([r.child,r.parent]).join("<->");L.some(b=>b.key===u)||L.push({...r,key:u});return}q.push(r),E.has(r.parent)||E.set(r.parent,[]),E.get(r.parent).push(r.child)}),E.forEach((r,u)=>{E.set(u,T(r))});let k=new Map,z=(r,u,b)=>{let M=8,R=(A,H=0,C=new Set)=>{if(k.has(A))return k.get(A);if(C.has(A)){let I={x:b+u*H*44,y:M};return M+=54,k.set(A,I),I}C.add(A);let Y=(E.get(A)||[]).filter(I=>!_.has(I)),j;if(!Y.length)j=M,M+=54;else{let I=Y.map(F=>R(F,H+1,new Set(C)));j=(Math.min(...I.map(F=>F.y))+Math.max(...I.map(F=>F.y)))/2}C.delete(A);let X={x:b+u*H*44,y:j};return k.set(A,X),X};return{rootPosition:R(r,0),height:M}};if(g.length===2){let r=g[0],u=g[1],b=z(r,-1,0),M=z(u,1,46),R=Math.max(b.rootPosition.y,M.rootPosition.y),N=(A,H)=>{let C=[A],Y=new Set;for(;C.length;){let j=C.pop();if(!j||Y.has(j))continue;Y.add(j);let X=k.get(j);X&&(X.y+=H),(E.get(j)||[]).forEach(I=>{_.has(I)||C.push(I)})}};N(r,R-b.rootPosition.y),N(u,R-M.rootPosition.y)}else g.forEach((r,u)=>{let b=z(r,-1,u*108),M=u===0?0:u*108-b.rootPosition.y;M&&k.forEach((R,N)=>{(N===r||(E.get(r)||[]).includes(N))&&(R.y+=M)})});d.forEach((r,u)=>{k.has(u)||k.set(u,{x:0,y:8+k.size*54})});let te=Math.min(...[...k.values()].map(r=>r.x)),se=Math.min(...[...k.values()].map(r=>r.y));k.forEach(r=>{r.x=r.x-te+8,r.y=r.y-se+8});let V=[...d.values()].map(r=>({...r,isRoot:_.has(r.planet),...k.get(r.planet)||{x:8,y:8}})),K=new Map(V.map(r=>[r.planet,r])),n=r=>{let u=K.get(r.child),b=K.get(r.parent);if(!u||!b)return null;let M=5,R=u.x<b.x,N=R?u.x+34+M:u.x-M,A=R?b.x-M:b.x+34+M,H=u.y+18,C=b.y+18,Y=N+(A-N)/2;return{...r,path:`M${N},${H} H${Y} V${C} H${A}`}},w=q.map(n).filter(Boolean),y=L.map(n).filter(Boolean),v=Math.max(220,Math.ceil(Math.max(...V.map(r=>r.x+34))+8)),P=Math.max(70,Math.ceil(Math.max(...V.map(r=>r.y+44))+8));return{width:v,height:P,nodes:V,edges:w,mutualEdges:y}}function _e(e){let s=[],t=new Set;e.forEach(a=>{let l=a.steps.map(S=>S.planet).join(">");t.has(l)||(t.add(l),s.push(a))});let o=new Map;return s.forEach(a=>{let l=a.finalKey||"none";o.has(l)||o.set(l,[]),o.get(l).push(a)}),s.length?`
            <div class="dispositor-diagram">
                ${[...o.entries()].map(([a,l])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Le(a,l.length)}
                        </div>
                        ${Ae(a,l)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${h($("page.chart.rulers.empty.noChains"))}</p>`}function Ae(e,s){let t=Pe(e,s);return t.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${t.width}px; --graph-height:${t.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${t.width} ${t.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${t.edges.map(o=>`
                        <path d="${h(o.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${t.nodes.map(o=>ee(o,o.isRoot?"dispositor-chain-node--main":"",`left:${o.x}px; top:${o.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${h($("page.chart.rulers.empty.noChains"))}</p>`}function Pe(e,s){let S=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),m=new Map,p=[],d=new Set,i=new Map,c=new Map,f=(n,w={})=>{if(!n)return null;let y=m.get(n)||{planet:n,sign:null,retrograde:!1};return m.set(n,{...y,sign:y.sign||w.sign||null,retrograde:y.retrograde||!!w.retrograde}),m.get(n)},x=(n,w)=>{let y=n?.planet,v=w?.planet;if(!y||!v||y===v||S.has(y)&&S.has(v))return;f(y,n),f(v,w);let P=`${y}->${v}`;d.has(P)||(d.add(P),p.push({child:y,parent:v}),c.set(y,v),i.has(v)||i.set(v,[]),i.get(v).push(y))};s.forEach(n=>{n.steps.forEach(y=>f(y.planet,y));for(let y=0;y<n.steps.length-1;y+=1)x(n.steps[y],n.steps[y+1]);let w=n.steps[n.steps.length-1];w?.ruler&&!n.steps.some(y=>y.planet===w.ruler)&&x(w,{planet:w.ruler})}),S.size||[...m.keys()].forEach(n=>{c.has(n)||S.add(n)}),!S.size&&m.size&&S.add([...m.keys()][0]),i.forEach((n,w)=>{i.set(w,T(n))});let g=new Map,_=(n,w=0)=>{g.has(n)&&g.get(n)<=w||(g.set(n,w),(i.get(n)||[]).forEach(y=>_(y,w+1)))};T([...S]).forEach(n=>_(n,0)),m.forEach((n,w)=>{g.has(w)||g.set(w,0)});let E=24,L=new Map,q=(n,w=new Set)=>{if(L.has(n))return L.get(n);if(w.has(n)){let P=E;return E+=76,L.set(n,P),P}w.add(n);let y=i.get(n)||[],v;if(!y.length)v=E,E+=76;else{let P=y.map(r=>q(r,new Set(w)));v=(Math.min(...P)+Math.max(...P))/2}return w.delete(n),L.set(n,v),v};T([...S]).forEach(n=>q(n)),m.forEach((n,w)=>q(w));let k=[...m.values()].map(n=>({...n,isRoot:S.has(n.planet),x:24+(g.get(n.planet)||0)*128,y:L.get(n.planet)||24})),z=new Map(k.map(n=>[n.planet,n])),te=Math.max(0,...k.map(n=>g.get(n.planet)||0)),se=Math.max(180,E+24),V=Math.max(520,48+te*128+44),K=p.map(n=>{let w=z.get(n.child),y=z.get(n.parent);if(!w||!y)return null;let v=w.x,P=w.y+44/2,r=y.x+44,u=y.y+44/2,b=Math.max(r+18,v-42);return{...n,path:`M${v},${P} H${b} V${u} H${r}`}}).filter(Boolean);return{width:V,height:se,nodes:k,edges:K}}function Le(e,s){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${h($("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${s}</span>
            `;let t=e.split("+").filter(Boolean),o=t.map(D).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${h(o)}">
                ${t.map(a=>J(a,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${s}</span>
        `}function Ne(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${h($("page.chart.rulers.modeLabel"))}">
                ${s.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${h($(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function de(e){return["domicile","exaltation","detriment","fall"].includes(e)?e:B.mode}function Ce(e={}){let s={};try{s=JSON.parse(window.localStorage?.getItem(oe)||"{}")||{}}catch{s={}}return{...B,mode:de(e.mode||s.mode||B.mode),showArrowDirection:(e.showArrowDirection??s.showArrowDirection??B.showArrowDirection)!==!1,showHouseRulers:(e.showHouseRulers??s.showHouseRulers??B.showHouseRulers)!==!1,classicalRulers:(e.classicalRulers??s.classicalRulers??B.classicalRulers)===!0}}function Ie(e){try{window.localStorage?.setItem(oe,JSON.stringify(e))}catch{}}function ue(e){let s=`page.chart.rulers.chainModes.${e}`,t=$(s);return t!==s?t:$(e==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${e}`)}function Be(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${h(ue(e.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${h($("page.chart.rulers.options.chainType"))}">
                        ${s.map(t=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${h(t)}"
                                    data-dispositor-option="mode"
                                    ${t===e.mode?"checked":""}
                                >
                                <span>${h(ue(t))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <div class="dispositor-options-divider"></div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showArrowDirection" ${e.showArrowDirection?"checked":""}>
                        <span>${h($("page.chart.rulers.options.arrowDirection"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${e.showHouseRulers?"checked":""}>
                        <span>${h($("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${e.classicalRulers?"checked":""}>
                        <span>${h($("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function he(e,s,t){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <span class="dispositor-card-kicker">${h($("page.chart.rulers.mainKicker"))}</span>
                        <h4>${h($("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Be(t)}
                </div>
                ${ke(e,s,t)}
            </div>
        `}function Te(e,s,t,o){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${h($("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${h($("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${h($("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${pe(e?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${he(s,t,o)}
                </div>
            </div>
        `}function je(e,s={},t="domicile"){W();let{chains:o,mainRulers:a}=ce(e,t),l=document.createElement("div");l.className="dispositor-modal-overlay",l.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${h($("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${h($("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Ne(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${h($("page.chart.rulers.mainKicker"))}</span>
                    ${$e(a)}
                </div>
                ${_e(o)}
            </div>
        `,document.body.appendChild(l),document.body.classList.add("dispositor-modal-open"),l.addEventListener("click",S=>{let m=S.target;if(m===l||m instanceof Element&&m.closest("[data-dispositor-close]")){W();return}if(!(m instanceof Element))return;let p=m.closest(".dispositor-mode-tab[data-dispositor-mode]");p&&je(e,s,p.dataset.dispositorMode||t)}),l.querySelector("[data-dispositor-close]")?.focus()}function W(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function me(e,s,t={}){let o=typeof e=="string"?document.getElementById(e):e;if(!o)return;let a=Ce(t),{chains:l,housesByRuler:S}=Ee(s,a.mode,a);o.innerHTML=t.layout==="tabs"?Te(s,l,S,a):`
                <div class="dispositor-panel">
                    ${pe(s?.cosmogram_pattern)}
                    ${he(l,S,a)}
                </div>
            `,o.querySelectorAll("[data-dispositor-tab]").forEach(d=>{d.addEventListener("click",()=>{let i=d.dataset.dispositorTab;o.querySelectorAll("[data-dispositor-tab]").forEach(c=>{let f=c.dataset.dispositorTab===i;c.classList.toggle("active",f),c.setAttribute("aria-selected",f?"true":"false")}),o.querySelectorAll("[data-dispositor-panel]").forEach(c=>{c.classList.toggle("active",c.dataset.dispositorPanel===i)})})});let m=o.querySelector("[data-dispositor-options-toggle]"),p=o.querySelector("[data-dispositor-options-menu]");m?.addEventListener("click",d=>{d.stopPropagation();let i=p&&!p.classList.contains("hidden");p?.classList.toggle("hidden",i),m.setAttribute("aria-expanded",i?"false":"true")}),p?.addEventListener("click",d=>d.stopPropagation()),p?.querySelectorAll("[data-dispositor-option]").forEach(d=>{d.addEventListener("change",()=>{let i={...a};d.dataset.dispositorOption==="mode"?i.mode=de(d.value):i[d.dataset.dispositorOption]=d.checked,Ie(i),me(o,s,i)})})}window.DispositorChains={render:me,buildChains:ce,closeModal:W},document.addEventListener("keydown",e=>{e.key==="Escape"&&(W(),document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",e=>{e.target instanceof Element&&e.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))})})();
