(function(){"use strict";let Z=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],Y=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],ye=Y.slice(0,10),ne="dispositorChainDisplayOptions",j={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},ae={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},ie=Object.fromEntries(Z.map((e,s)=>[e,Z[(s+6)%12]])),be={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},$e={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function f(e,s){return window.FrontendI18n?.t?.(e,s)||e}function h(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function G(e){return $e[e]||e}function D(e){if(!e)return"—";let s=`astro.planet.${e}`,t=f(s);return t!==s?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function we(e){if(!e)return"—";let s=`astro.sign.${e}`,t=f(s);return t!==s?t:window.Symbols?.signNamesRu?.[e]||e}function J(e,s=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:s,title:D(e)})||`<span class="astro-symbol">${h(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function le(e){return[window.Symbols?.signs?.[e]||"",we(e)].filter(Boolean).join(" ")}function Q(){let e={},s=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return Z.forEach(t=>{let o=be[t]||{},a=s?.[t]||{},l=G(a.ruler||o.ruler||null),S=G(a.co_ruler||o.co_ruler||null),m=G(a.exaltation||o.exaltation||null);l&&S&&l===S&&(S=null),e[t]={ruler:l,co_ruler:S,exaltation:m}}),e}function U(e,s,t=Q()){let o=t?.[e]||{},a=t?.[ie[e]]||{};return s==="exaltation"?o.exaltation||null:s==="detriment"?a.ruler||null:s==="fall"?a.exaltation||null:o.ruler||null}function ce(e,s,t,o=j){return e?o.classicalRulers&&s==="domicile"?ae[e]||U(e,s,t):o.classicalRulers&&s==="detriment"&&ae[ie[e]]||U(e,s,t):null}function pe(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&Y.includes(G(t.name))).map(t=>({...t,name:G(t.name)})).sort((t,o)=>Y.indexOf(t.name)-Y.indexOf(o.name))}function de(e,s){let t=Q(),o=pe(e),a=new Map(o.map(p=>[p.name,p])),l=[],S=new Map;o.forEach(p=>{let d=[],i=new Map,c=p,y=null,x=[];for(;c?.name&&!i.has(c.name);){i.set(c.name,d.length);let g=U(c.sign,s,t);if(d.push({planet:c.name,sign:c.sign,ruler:g,retrograde:!!c.retrograde}),!g){y="none";break}if(!a.has(g)){y=g;break}if(g===c.name){y=g;break}c=a.get(g)}if(!y&&c?.name&&i.has(c.name)){let g=i.get(c.name);x=d.slice(g).map(_=>_.planet),y=x.join("+")}S.set(y,(S.get(y)||0)+1),l.push({start:p.name,steps:d,finalKey:y,cycle:x})});let m=[...S.entries()].filter(([p])=>p&&p!=="none").sort((p,d)=>d[1]-p[1]||p[0].localeCompare(d[0])).slice(0,4);return{chains:l,mainRulers:m}}function ee(e){if(!e)return`<p class="dispositor-empty">${h(f("page.chart.rulers.empty.noJones"))}</p>`;let s=(()=>{let o=`astro.pattern.${e.pattern_type}`,a=f(o);return a===o?e.pattern_type||"—":a})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push(f("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push(f("page.chart.balances.handle",{planet:D(e.handle_planet)})),e.leading_planet&&t.push(f("page.chart.balances.leading",{planet:D(e.leading_planet)})),`
            <article class="dispositor-jones-card" title="${h([f("page.chart.rulers.jonesKicker"),s,...t].join(" · "))}">
                <span class="dispositor-card-kicker">${h(f("page.chart.rulers.jonesKicker"))}</span>
                <h4>${h(s)}</h4>
                ${t.length?`<p>${h(t.join(" · "))}</p>`:""}
            </article>
        `}function Se(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([s,t])=>{let o=s.split("+").filter(Boolean),a=o.map(D).join(" + ");return`
                        <span class="dispositor-main-chip" title="${h(a)}">
                            ${o.map(l=>J(l,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${h(f("page.chart.rulers.empty.noMainRulers"))}</p>`}function te(e,s="",t=""){let o=[D(e.planet),e.sign?le(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${s}" style="${h(t)}" title="${h(o)}" aria-label="${h(o)}">
                ${J(e.planet,15)}
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
            </span>
        `}function De(e){let s=[...e.steps].reverse().map((o,a)=>{let l=a===0&&e.finalKey!=="none";return te(o,l?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(o=>o.planet===t.ruler)&&s.unshift(te({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${s.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function I(e){return[...new Set(e)].sort((s,t)=>{let o=Y.indexOf(s),a=Y.indexOf(t);return(o===-1?999:o)-(a===-1?999:a)})}function xe(e){return I(e).join("+")}function Me(e){let s=e?.number??e?.house_number,t=Number(s);return Number.isInteger(t)?t:s}function ve(e){let s=[...new Set(e)].map(t=>Number(t)).filter(t=>Number.isInteger(t)).sort((t,o)=>t-o);return s.length?window.Symbols?.formatHouseList?.(s,{style:"roman",separator:","})||s.map(t=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][t-1]||String(t)).join(","):""}function Ee(e,s,t,o=j){return s==="domicile"&&e?.ruler_planet&&!o.classicalRulers?G(e.ruler_planet):G(ce(e?.sign,s,t,o))}function ue(e,s,t=j){let o=Q(),a=pe(e),l=new Map(a.map(i=>[i.name,i])),S=Array.isArray(e?.houses)?e.houses:[],m=new Map,p=[];return S.forEach(i=>{let c=Ee(i,s,o,t),y=Me(i);!c||!y||(m.has(c)||m.set(c,[]),m.get(c).push(y),p.push(c))}),a.forEach(i=>{ye.includes(i.name)&&p.push(i.name)}),{chains:I(p).map(i=>{let c=[],y=new Map,x=l.get(i)||{name:i,sign:null,retrograde:!1},g=null,_=[];for(;x?.name&&!y.has(x.name);){y.set(x.name,c.length);let v=x.sign?ce(x.sign,s,o,t):null;if(c.push({planet:x.name,sign:x.sign,ruler:v,retrograde:!!x.retrograde}),!v){g=x.name;break}if(!l.has(v)){g=v;break}if(v===x.name){g=v;break}x=l.get(v)}if(!g&&x?.name&&y.has(x.name)){let v=y.get(x.name);_=c.slice(v).map(P=>P.planet),g=xe(_)}return{start:i,steps:c,finalKey:g,cycle:_}}),housesByRuler:m}}function ke(e,s,t,o=""){let a=t.showHouseRulers?ve(s.get(e.planet)||[]):"",l=[D(e.planet),e.sign?le(e.sign):"",a?`${f("common.house")} ${a}`:""].filter(Boolean).join(" · ");return`
            <span
                class="dispositor-compact-node ${o}"
                style="left:${e.x}px; top:${e.y}px;"
                title="${h(l)}"
                aria-label="${h(l)}"
            >
                <span class="dispositor-compact-symbol">${J(e.planet,32)}</span>
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
                ${a?`<span class="dispositor-house-label">${h(a)}</span>`:""}
            </span>
        `}function Re(e,s,t){let o=[],a=new Set;if(e.forEach(m=>{let p=m.steps.map(d=>d.planet).join(">");a.has(p)||(a.add(p),o.push(m))}),!o.length)return`<p class="dispositor-empty">${h(f("page.chart.rulers.empty.noChains"))}</p>`;let l=new Map;return o.forEach(m=>{let p=m.finalKey||"none";l.has(p)||l.set(p,[]),l.get(p).push(m)}),`
            <div class="dispositor-compact-diagram">
                ${[...l.entries()].sort((m,p)=>{let d=new Set(m[1].flatMap(c=>c.steps.map(y=>y.planet))).size,i=new Set(p[1].flatMap(c=>c.steps.map(y=>y.planet))).size;return d-i||String(m[0]).localeCompare(String(p[0]))}).map(([m,p],d)=>{let i=he(m,p),c=`url(#dispositorCompactArrow${d})`,y=t.showArrowDirection?` marker-end="${c}"`:"",x=t.showArrowDirection?` marker-start="${c}" marker-end="${c}"`:"";return`
                        <section class="dispositor-compact-group" aria-label="${h(f("page.chart.rulers.modalTitle"))} ${d+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${d}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${i.edges.map(g=>`
                                        <path d="${h(g.path)}"${y}></path>
                                    `).join("")}
                                    ${i.mutualEdges.map(g=>`
                                        <path class="dispositor-compact-mutual" d="${h(g.path)}"${x}></path>
                                    `).join("")}
                                </svg>
                                ${i.nodes.map(g=>ke(g,s,t,g.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function he(e,s){let p=e&&e!=="none"?e.split("+").filter(Boolean):[],d=new Map,i=[],c=new Set,y=(r,u={})=>{if(!r)return null;let $=d.get(r)||{planet:r,sign:null,retrograde:!1};return d.set(r,{...$,sign:$.sign||u.sign||null,retrograde:$.retrograde||!!u.retrograde}),d.get(r)},x=(r,u)=>{let $=r?.planet,M=u?.planet;if(!$||!M||$===M)return;y($,r),y(M,u);let R=`${$}->${M}`;c.has(R)||(c.add(R),i.push({child:$,parent:M}))};s.forEach(r=>{r.steps.forEach(u=>y(u.planet,u));for(let u=0;u<r.steps.length;u+=1){let $=r.steps[u],M=r.steps[u+1];M?x($,M):$?.ruler&&!r.steps.some(R=>R.planet===$.ruler)&&x($,{planet:$.ruler})}});let g=p.length?I(p):I([...d.keys()].filter(r=>!i.some(u=>u.child===r)));!g.length&&d.size&&g.push([...d.keys()][0]);let _=new Set(g),v=new Map,P=[],O=[];i.forEach(r=>{if(_.has(r.child)&&_.has(r.parent)){let u=I([r.child,r.parent]).join("<->");P.some($=>$.key===u)||P.push({...r,key:u});return}O.push(r),v.has(r.parent)||v.set(r.parent,[]),v.get(r.parent).push(r.child)}),v.forEach((r,u)=>{v.set(u,I(r))});let k=new Map,q=(r,u,$)=>{let M=8,R=(L,H=0,N=new Set)=>{if(k.has(L))return k.get(L);if(N.has(L)){let C={x:$+u*H*60,y:M};return M+=58,k.set(L,C),C}N.add(L);let V=(v.get(L)||[]).filter(C=>!_.has(C)),T;if(!V.length)T=M,M+=58;else{let C=V.map(F=>R(F,H+1,new Set(N)));T=(Math.min(...C.map(F=>F.y))+Math.max(...C.map(F=>F.y)))/2}N.delete(L);let X={x:$+u*H*60,y:T};return k.set(L,X),X};return{rootPosition:R(r,0),height:M}};if(g.length===2){let r=g[0],u=g[1],$=q(r,-1,0),M=q(u,1,72),R=Math.max($.rootPosition.y,M.rootPosition.y),B=(L,H)=>{let N=[L],V=new Set;for(;N.length;){let T=N.pop();if(!T||V.has(T))continue;V.add(T);let X=k.get(T);X&&(X.y+=H),(v.get(T)||[]).forEach(C=>{_.has(C)||N.push(C)})}};B(r,R-$.rootPosition.y),B(u,R-M.rootPosition.y)}else g.forEach((r,u)=>{let $=q(r,-1,u*116),M=u===0?0:u*116-$.rootPosition.y;M&&k.forEach((R,B)=>{(B===r||(v.get(r)||[]).includes(B))&&(R.y+=M)})});d.forEach((r,u)=>{k.has(u)||k.set(u,{x:0,y:8+k.size*58})});let oe=Math.min(...[...k.values()].map(r=>r.x)),re=Math.min(...[...k.values()].map(r=>r.y));k.forEach(r=>{r.x=r.x-oe+8,r.y=r.y-re+8});let z=[...d.values()].map(r=>({...r,isRoot:_.has(r.planet),...k.get(r.planet)||{x:8,y:8}})),W=new Map(z.map(r=>[r.planet,r])),n=r=>{let u=W.get(r.child),$=W.get(r.parent);if(!u||!$)return null;let M=1,R=u.x<$.x,B=R?u.x+42+M:u.x-M,L=R?$.x-M:$.x+42+M,H=u.y+21,N=$.y+21;return{...r,path:`M${B},${H} L${L},${N}`}},w=O.map(n).filter(Boolean),b=P.map(n).filter(Boolean),E=Math.max(220,Math.ceil(Math.max(...z.map(r=>r.x+42))+8)),A=Math.max(70,Math.ceil(Math.max(...z.map(r=>r.y+58))+8));return{width:E,height:A,nodes:z,edges:w,mutualEdges:b}}function _e(e){let s=[],t=new Set;e.forEach(a=>{let l=a.steps.map(S=>S.planet).join(">");t.has(l)||(t.add(l),s.push(a))});let o=new Map;return s.forEach(a=>{let l=a.finalKey||"none";o.has(l)||o.set(l,[]),o.get(l).push(a)}),s.length?`
            <div class="dispositor-diagram">
                ${[...o.entries()].map(([a,l])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Pe(a,l.length)}
                        </div>
                        ${Ae(a,l)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${h(f("page.chart.rulers.empty.noChains"))}</p>`}function Ae(e,s){let t=Le(e,s);return t.nodes.length?`
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
                ${t.nodes.map(o=>te(o,o.isRoot?"dispositor-chain-node--main":"",`left:${o.x}px; top:${o.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${h(f("page.chart.rulers.empty.noChains"))}</p>`}function Le(e,s){let S=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),m=new Map,p=[],d=new Set,i=new Map,c=new Map,y=(n,w={})=>{if(!n)return null;let b=m.get(n)||{planet:n,sign:null,retrograde:!1};return m.set(n,{...b,sign:b.sign||w.sign||null,retrograde:b.retrograde||!!w.retrograde}),m.get(n)},x=(n,w)=>{let b=n?.planet,E=w?.planet;if(!b||!E||b===E||S.has(b)&&S.has(E))return;y(b,n),y(E,w);let A=`${b}->${E}`;d.has(A)||(d.add(A),p.push({child:b,parent:E}),c.set(b,E),i.has(E)||i.set(E,[]),i.get(E).push(b))};s.forEach(n=>{n.steps.forEach(b=>y(b.planet,b));for(let b=0;b<n.steps.length-1;b+=1)x(n.steps[b],n.steps[b+1]);let w=n.steps[n.steps.length-1];w?.ruler&&!n.steps.some(b=>b.planet===w.ruler)&&x(w,{planet:w.ruler})}),S.size||[...m.keys()].forEach(n=>{c.has(n)||S.add(n)}),!S.size&&m.size&&S.add([...m.keys()][0]),i.forEach((n,w)=>{i.set(w,I(n))});let g=new Map,_=(n,w=0)=>{g.has(n)&&g.get(n)<=w||(g.set(n,w),(i.get(n)||[]).forEach(b=>_(b,w+1)))};I([...S]).forEach(n=>_(n,0)),m.forEach((n,w)=>{g.has(w)||g.set(w,0)});let v=24,P=new Map,O=(n,w=new Set)=>{if(P.has(n))return P.get(n);if(w.has(n)){let A=v;return v+=76,P.set(n,A),A}w.add(n);let b=i.get(n)||[],E;if(!b.length)E=v,v+=76;else{let A=b.map(r=>O(r,new Set(w)));E=(Math.min(...A)+Math.max(...A))/2}return w.delete(n),P.set(n,E),E};I([...S]).forEach(n=>O(n)),m.forEach((n,w)=>O(w));let k=[...m.values()].map(n=>({...n,isRoot:S.has(n.planet),x:24+(g.get(n.planet)||0)*128,y:P.get(n.planet)||24})),q=new Map(k.map(n=>[n.planet,n])),oe=Math.max(0,...k.map(n=>g.get(n.planet)||0)),re=Math.max(180,v+24),z=Math.max(520,48+oe*128+44),W=p.map(n=>{let w=q.get(n.child),b=q.get(n.parent);if(!w||!b)return null;let E=w.x,A=w.y+44/2,r=b.x+44,u=b.y+44/2,$=Math.max(r+18,E-42);return{...n,path:`M${E},${A} H${$} V${u} H${r}`}}).filter(Boolean);return{width:z,height:re,nodes:k,edges:W}}function Pe(e,s){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${h(f("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${s}</span>
            `;let t=e.split("+").filter(Boolean),o=t.map(D).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${h(o)}">
                ${t.map(a=>J(a,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${s}</span>
        `}function Ne(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${h(f("page.chart.rulers.modeLabel"))}">
                ${s.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${h(f(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function me(e){return["domicile","exaltation","detriment","fall"].includes(e)?e:j.mode}function Ce(e={}){let s={};try{s=JSON.parse(window.localStorage?.getItem(ne)||"{}")||{}}catch{s={}}return{...j,mode:me(e.mode||s.mode||j.mode),showArrowDirection:(e.showArrowDirection??s.showArrowDirection??j.showArrowDirection)!==!1,showHouseRulers:(e.showHouseRulers??s.showHouseRulers??j.showHouseRulers)!==!1,classicalRulers:(e.classicalRulers??s.classicalRulers??j.classicalRulers)===!0}}function je(e){try{window.localStorage?.setItem(ne,JSON.stringify(e))}catch{}}function ge(e){let s=`page.chart.rulers.chainModes.${e}`,t=f(s);return t!==s?t:f(e==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${e}`)}function Ie(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${h(ge(e.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${h(f("page.chart.rulers.options.chainType"))}">
                        ${s.map(t=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${h(t)}"
                                    data-dispositor-option="mode"
                                    ${t===e.mode?"checked":""}
                                >
                                <span>${h(ge(t))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <div class="dispositor-options-divider"></div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showArrowDirection" ${e.showArrowDirection?"checked":""}>
                        <span>${h(f("page.chart.rulers.options.arrowDirection"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${e.showHouseRulers?"checked":""}>
                        <span>${h(f("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${e.classicalRulers?"checked":""}>
                        <span>${h(f("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function se(e,s,t){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <span class="dispositor-card-kicker">${h(f("page.chart.rulers.mainKicker"))}</span>
                        <h4>${h(f("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${Ie(t)}
                </div>
                ${Re(e,s,t)}
            </div>
        `}function Te(e,s,t,o){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${h(f("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${h(f("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${h(f("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${ee(e?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${se(s,t,o)}
                </div>
            </div>
        `}function Be(e,s={},t="domicile"){K();let{chains:o,mainRulers:a}=de(e,t),l=document.createElement("div");l.className="dispositor-modal-overlay",l.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${h(f("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${h(f("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Ne(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${h(f("page.chart.rulers.mainKicker"))}</span>
                    ${Se(a)}
                </div>
                ${_e(o)}
            </div>
        `,document.body.appendChild(l),document.body.classList.add("dispositor-modal-open"),l.addEventListener("click",S=>{let m=S.target;if(m===l||m instanceof Element&&m.closest("[data-dispositor-close]")){K();return}if(!(m instanceof Element))return;let p=m.closest(".dispositor-mode-tab[data-dispositor-mode]");p&&Be(e,s,p.dataset.dispositorMode||t)}),l.querySelector("[data-dispositor-close]")?.focus()}function K(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function fe(e,s,t={}){let o=typeof e=="string"?document.getElementById(e):e;if(!o)return;let a=Ce(t),{chains:l,housesByRuler:S}=ue(s,a.mode,a);t.section==="jones"?o.innerHTML=`<div class="dispositor-panel">${ee(s?.cosmogram_pattern)}</div>`:t.section==="scheme"?o.innerHTML=`<div class="dispositor-panel">${se(l,S,a)}</div>`:o.innerHTML=t.layout==="tabs"?Te(s,l,S,a):`
                    <div class="dispositor-panel">
                        ${ee(s?.cosmogram_pattern)}
                        ${se(l,S,a)}
                    </div>
                `,o.querySelectorAll("[data-dispositor-tab]").forEach(d=>{d.addEventListener("click",()=>{let i=d.dataset.dispositorTab;o.querySelectorAll("[data-dispositor-tab]").forEach(c=>{let y=c.dataset.dispositorTab===i;c.classList.toggle("active",y),c.setAttribute("aria-selected",y?"true":"false")}),o.querySelectorAll("[data-dispositor-panel]").forEach(c=>{c.classList.toggle("active",c.dataset.dispositorPanel===i)})})});let m=o.querySelector("[data-dispositor-options-toggle]"),p=o.querySelector("[data-dispositor-options-menu]");m?.addEventListener("click",d=>{d.stopPropagation();let i=p&&!p.classList.contains("hidden");p?.classList.toggle("hidden",i),m.setAttribute("aria-expanded",i?"false":"true")}),p?.addEventListener("click",d=>d.stopPropagation()),p?.querySelectorAll("[data-dispositor-option]").forEach(d=>{d.addEventListener("change",()=>{let i={...a};d.dataset.dispositorOption==="mode"?i.mode=me(d.value):i[d.dataset.dispositorOption]=d.checked,je(i),fe(o,s,i)})})}window.DispositorChains={render:fe,buildChains:de,buildHouseDispositorScheme:ue,buildCompactLayout:he,closeModal:K},document.addEventListener("keydown",e=>{e.key==="Escape"&&(K(),document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",e=>{e.target instanceof Element&&e.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))})})();
