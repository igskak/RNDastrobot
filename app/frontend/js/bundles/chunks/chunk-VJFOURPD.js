(function(){"use strict";let U=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],z=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],re=z.slice(0,10),ae=Object.fromEntries(U.map((e,s)=>[e,U[(s+6)%12]])),ie={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},le={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function M(e,s){return window.FrontendI18n?.t?.(e,s)||e}function w(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function T(e){return le[e]||e}function A(e){if(!e)return"—";let s=`astro.planet.${e}`,t=M(s);return t!==s?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function ce(e){if(!e)return"—";let s=`astro.sign.${e}`,t=M(s);return t!==s?t:window.Symbols?.signNamesRu?.[e]||e}function W(e,s=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:s,title:A(e)})||`<span class="astro-symbol">${w(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function se(e){return[window.Symbols?.signs?.[e]||"",ce(e)].filter(Boolean).join(" ")}function K(){let e={},s=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return U.forEach(t=>{let o=ie[t]||{},a=s?.[t]||{},d=T(a.ruler||o.ruler||null),l=T(a.co_ruler||o.co_ruler||null),u=T(a.exaltation||o.exaltation||null);d&&l&&d===l&&(l=null),e[t]={ruler:d,co_ruler:l,exaltation:u}}),e}function Z(e,s,t=K()){let o=t?.[e]||{},a=t?.[ae[e]]||{};return s==="exaltation"?o.exaltation||null:s==="detriment"?a.ruler||null:s==="fall"?a.exaltation||null:o.ruler||null}function ne(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&z.includes(T(t.name))).map(t=>({...t,name:T(t.name)})).sort((t,o)=>z.indexOf(t.name)-z.indexOf(o.name))}function oe(e,s){let t=K(),o=ne(e),a=new Map(o.map(f=>[f.name,f])),d=[],l=new Map;o.forEach(f=>{let i=[],p=new Map,$=f,y=null,v=[];for(;$?.name&&!p.has($.name);){p.set($.name,i.length);let b=Z($.sign,s,t);if(i.push({planet:$.name,sign:$.sign,ruler:b,retrograde:!!$.retrograde}),!b){y="none";break}if(!a.has(b)){y=b;break}if(b===$.name){y=b;break}$=a.get(b)}if(!y&&$?.name&&p.has($.name)){let b=p.get($.name);v=i.slice(b).map(S=>S.planet),y=v.join("+")}l.set(y,(l.get(y)||0)+1),d.push({start:f.name,steps:i,finalKey:y,cycle:v})});let u=[...l.entries()].filter(([f])=>f&&f!=="none").sort((f,i)=>i[1]-f[1]||f[0].localeCompare(i[0])).slice(0,4);return{chains:d,mainRulers:u}}function pe(e){if(!e)return`<p class="dispositor-empty">${w(M("page.chart.rulers.empty.noJones"))}</p>`;let s=(()=>{let o=`astro.pattern.${e.pattern_type}`,a=M(o);return a===o?e.pattern_type||"—":a})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push(M("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push(M("page.chart.balances.handle",{planet:A(e.handle_planet)})),e.leading_planet&&t.push(M("page.chart.balances.leading",{planet:A(e.leading_planet)})),`
            <article class="dispositor-jones-card">
                <span class="dispositor-card-kicker">${w(M("page.chart.rulers.jonesKicker"))}</span>
                <h4>${w(s)}</h4>
                ${t.length?`<p>${w(t.join(" · "))}</p>`:""}
            </article>
        `}function ue(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([s,t])=>{let o=s.split("+").filter(Boolean),a=o.map(A).join(" + ");return`
                        <span class="dispositor-main-chip" title="${w(a)}">
                            ${o.map(d=>W(d,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(M("page.chart.rulers.empty.noMainRulers"))}</p>`}function Q(e,s="",t=""){let o=[A(e.planet),e.sign?se(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${s}" style="${w(t)}" title="${w(o)}" aria-label="${w(o)}">
                ${W(e.planet,15)}
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
            </span>
        `}function Pe(e){let s=[...e.steps].reverse().map((o,a)=>{let d=a===0&&e.finalKey!=="none";return Q(o,d?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(o=>o.planet===t.ruler)&&s.unshift(Q({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${s.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function I(e){return[...new Set(e)].sort((s,t)=>{let o=z.indexOf(s),a=z.indexOf(t);return(o===-1?999:o)-(a===-1?999:a)})}function de(e){return I(e).join("+")}function he(e){let s=e?.number??e?.house_number,t=Number(s);return Number.isInteger(t)?t:s}function me(e){let s=[...new Set(e)].map(t=>Number(t)).filter(t=>Number.isInteger(t)).sort((t,o)=>t-o);return s.length?window.Symbols?.formatHouseList?.(s,{style:"roman",separator:","})||s.map(t=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][t-1]||String(t)).join(","):""}function ge(e,s,t){return s==="domicile"&&e?.ruler_planet?T(e.ruler_planet):T(Z(e?.sign,s,t))}function fe(e,s){let t=K(),o=ne(e),a=new Map(o.map(i=>[i.name,i])),d=Array.isArray(e?.houses)?e.houses:[],l=new Map,u=[];return d.forEach(i=>{let p=ge(i,s,t),$=he(i);!p||!$||(l.has(p)||l.set(p,[]),l.get(p).push($),u.push(p))}),o.forEach(i=>{re.includes(i.name)&&u.push(i.name)}),{chains:I(u).map(i=>{let p=[],$=new Map,y=a.get(i)||{name:i,sign:null,retrograde:!1},v=null,b=[];for(;y?.name&&!$.has(y.name);){$.set(y.name,p.length);let S=y.sign?Z(y.sign,s,t):null;if(p.push({planet:y.name,sign:y.sign,ruler:S,retrograde:!!y.retrograde}),!S){v=y.name;break}if(!a.has(S)){v=S;break}if(S===y.name){v=S;break}y=a.get(S)}if(!v&&y?.name&&$.has(y.name)){let S=$.get(y.name);b=p.slice(S).map(_=>_.planet),v=de(b)}return{start:i,steps:p,finalKey:v,cycle:b}}),housesByRuler:l}}function ye(e,s,t=""){let o=me(s.get(e.planet)||[]),a=[A(e.planet),e.sign?se(e.sign):"",o?`${M("common.house")} ${o}`:""].filter(Boolean).join(" · ");return`
            <span
                class="dispositor-compact-node ${t}"
                style="left:${e.x}px; top:${e.y}px;"
                title="${w(a)}"
                aria-label="${w(a)}"
            >
                <span class="dispositor-compact-symbol">${W(e.planet,24)}</span>
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
                ${o?`<span class="dispositor-house-label">${w(o)}</span>`:""}
            </span>
        `}function $e(e,s){let t=[],o=new Set;if(e.forEach(l=>{let u=l.steps.map(f=>f.planet).join(">");o.has(u)||(o.add(u),t.push(l))}),!t.length)return`<p class="dispositor-empty">${w(M("page.chart.rulers.empty.noChains"))}</p>`;let a=new Map;return t.forEach(l=>{let u=l.finalKey||"none";a.has(u)||a.set(u,[]),a.get(u).push(l)}),`
            <div class="dispositor-compact-diagram">
                ${[...a.entries()].sort((l,u)=>{let f=new Set(l[1].flatMap(p=>p.steps.map($=>$.planet))).size,i=new Set(u[1].flatMap(p=>p.steps.map($=>$.planet))).size;return f-i||String(l[0]).localeCompare(String(u[0]))}).map(([l,u],f)=>{let i=we(l,u);return`
                        <section class="dispositor-compact-group" aria-label="${w(M("page.chart.rulers.modalTitle"))} ${f+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${f}" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto-start-reverse" markerUnits="strokeWidth">
                                            <path d="M0,0 L5,2.5 L0,5 Z"></path>
                                        </marker>
                                    </defs>
                                    ${i.edges.map(p=>`
                                        <path d="${w(p.path)}" marker-end="url(#dispositorCompactArrow${f})"></path>
                                    `).join("")}
                                    ${i.mutualEdges.map(p=>`
                                        <path class="dispositor-compact-mutual" d="${w(p.path)}" marker-start="url(#dispositorCompactArrow${f})" marker-end="url(#dispositorCompactArrow${f})"></path>
                                    `).join("")}
                                </svg>
                                ${i.nodes.map(p=>ye(p,s,p.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function we(e,s){let f=e&&e!=="none"?e.split("+").filter(Boolean):[],i=new Map,p=[],$=new Set,y=(n,c={})=>{if(!n)return null;let m=i.get(n)||{planet:n,sign:null,retrograde:!1};return i.set(n,{...m,sign:m.sign||c.sign||null,retrograde:m.retrograde||!!c.retrograde}),i.get(n)},v=(n,c)=>{let m=n?.planet,x=c?.planet;if(!m||!x||m===x)return;y(m,n),y(x,c);let P=`${m}->${x}`;$.has(P)||($.add(P),p.push({child:m,parent:x}))};s.forEach(n=>{n.steps.forEach(c=>y(c.planet,c));for(let c=0;c<n.steps.length;c+=1){let m=n.steps[c],x=n.steps[c+1];x?v(m,x):m?.ruler&&!n.steps.some(P=>P.planet===m.ruler)&&v(m,{planet:m.ruler})}});let b=f.length?I(f):I([...i.keys()].filter(n=>!p.some(c=>c.child===n)));!b.length&&i.size&&b.push([...i.keys()][0]);let S=new Set(b),_=new Map,R=[],O=[];p.forEach(n=>{if(S.has(n.child)&&S.has(n.parent)){let c=I([n.child,n.parent]).join("<->");R.some(m=>m.key===c)||R.push({...n,key:c});return}O.push(n),_.has(n.parent)||_.set(n.parent,[]),_.get(n.parent).push(n.child)}),_.forEach((n,c)=>{_.set(c,I(n))});let k=new Map,V=(n,c,m)=>{let x=8,P=(N,Y=0,G=new Set)=>{if(k.has(N))return k.get(N);if(G.has(N)){let j={x:m+c*Y*44,y:x};return x+=54,k.set(N,j),j}G.add(N);let H=(_.get(N)||[]).filter(j=>!S.has(j)),L;if(!H.length)L=x,x+=54;else{let j=H.map(F=>P(F,Y+1,new Set(G)));L=(Math.min(...j.map(F=>F.y))+Math.max(...j.map(F=>F.y)))/2}G.delete(N);let D={x:m+c*Y*44,y:L};return k.set(N,D),D};return{rootPosition:P(n,0),height:x}};if(b.length===2){let n=b[0],c=b[1],m=V(n,-1,0),x=V(c,1,46),P=Math.max(m.rootPosition.y,x.rootPosition.y),C=(N,Y)=>{let G=[N],H=new Set;for(;G.length;){let L=G.pop();if(!L||H.has(L))continue;H.add(L);let D=k.get(L);D&&(D.y+=Y),(_.get(L)||[]).forEach(j=>{S.has(j)||G.push(j)})}};C(n,P-m.rootPosition.y),C(c,P-x.rootPosition.y)}else b.forEach((n,c)=>{let m=V(n,-1,c*108),x=c===0?0:c*108-m.rootPosition.y;x&&k.forEach((P,C)=>{(C===n||(_.get(n)||[]).includes(C))&&(P.y+=x)})});i.forEach((n,c)=>{k.has(c)||k.set(c,{x:0,y:8+k.size*54})});let ee=Math.min(...[...k.values()].map(n=>n.x)),te=Math.min(...[...k.values()].map(n=>n.y));k.forEach(n=>{n.x=n.x-ee+8,n.y=n.y-te+8});let X=[...i.values()].map(n=>({...n,isRoot:S.has(n.planet),...k.get(n.planet)||{x:8,y:8}})),J=new Map(X.map(n=>[n.planet,n])),r=n=>{let c=J.get(n.child),m=J.get(n.parent);if(!c||!m)return null;let x=5,P=c.x<m.x,C=P?c.x+34+x:c.x-x,N=P?m.x-x:m.x+34+x,Y=c.y+18,G=m.y+18,H=C+(N-C)/2;return{...n,path:`M${C},${Y} H${H} V${G} H${N}`}},g=O.map(r).filter(Boolean),h=R.map(r).filter(Boolean),E=Math.max(220,Math.ceil(Math.max(...X.map(n=>n.x+34))+8)),B=Math.max(70,Math.ceil(Math.max(...X.map(n=>n.y+44))+8));return{width:E,height:B,nodes:X,edges:g,mutualEdges:h}}function be(e){let s=[],t=new Set;e.forEach(a=>{let d=a.steps.map(l=>l.planet).join(">");t.has(d)||(t.add(d),s.push(a))});let o=new Map;return s.forEach(a=>{let d=a.finalKey||"none";o.has(d)||o.set(d,[]),o.get(d).push(a)}),s.length?`
            <div class="dispositor-diagram">
                ${[...o.entries()].map(([a,d])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Se(a,d.length)}
                        </div>
                        ${xe(a,d)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(M("page.chart.rulers.empty.noChains"))}</p>`}function xe(e,s){let t=Me(e,s);return t.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${t.width}px; --graph-height:${t.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${t.width} ${t.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${t.edges.map(o=>`
                        <path d="${w(o.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${t.nodes.map(o=>Q(o,o.isRoot?"dispositor-chain-node--main":"",`left:${o.x}px; top:${o.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${w(M("page.chart.rulers.empty.noChains"))}</p>`}function Me(e,s){let l=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),u=new Map,f=[],i=new Set,p=new Map,$=new Map,y=(r,g={})=>{if(!r)return null;let h=u.get(r)||{planet:r,sign:null,retrograde:!1};return u.set(r,{...h,sign:h.sign||g.sign||null,retrograde:h.retrograde||!!g.retrograde}),u.get(r)},v=(r,g)=>{let h=r?.planet,E=g?.planet;if(!h||!E||h===E||l.has(h)&&l.has(E))return;y(h,r),y(E,g);let B=`${h}->${E}`;i.has(B)||(i.add(B),f.push({child:h,parent:E}),$.set(h,E),p.has(E)||p.set(E,[]),p.get(E).push(h))};s.forEach(r=>{r.steps.forEach(h=>y(h.planet,h));for(let h=0;h<r.steps.length-1;h+=1)v(r.steps[h],r.steps[h+1]);let g=r.steps[r.steps.length-1];g?.ruler&&!r.steps.some(h=>h.planet===g.ruler)&&v(g,{planet:g.ruler})}),l.size||[...u.keys()].forEach(r=>{$.has(r)||l.add(r)}),!l.size&&u.size&&l.add([...u.keys()][0]),p.forEach((r,g)=>{p.set(g,I(r))});let b=new Map,S=(r,g=0)=>{b.has(r)&&b.get(r)<=g||(b.set(r,g),(p.get(r)||[]).forEach(h=>S(h,g+1)))};I([...l]).forEach(r=>S(r,0)),u.forEach((r,g)=>{b.has(g)||b.set(g,0)});let _=24,R=new Map,O=(r,g=new Set)=>{if(R.has(r))return R.get(r);if(g.has(r)){let B=_;return _+=76,R.set(r,B),B}g.add(r);let h=p.get(r)||[],E;if(!h.length)E=_,_+=76;else{let B=h.map(n=>O(n,new Set(g)));E=(Math.min(...B)+Math.max(...B))/2}return g.delete(r),R.set(r,E),E};I([...l]).forEach(r=>O(r)),u.forEach((r,g)=>O(g));let k=[...u.values()].map(r=>({...r,isRoot:l.has(r.planet),x:24+(b.get(r.planet)||0)*128,y:R.get(r.planet)||24})),V=new Map(k.map(r=>[r.planet,r])),ee=Math.max(0,...k.map(r=>b.get(r.planet)||0)),te=Math.max(180,_+24),X=Math.max(520,48+ee*128+44),J=f.map(r=>{let g=V.get(r.child),h=V.get(r.parent);if(!g||!h)return null;let E=g.x,B=g.y+44/2,n=h.x+44,c=h.y+44/2,m=Math.max(n+18,E-42);return{...r,path:`M${E},${B} H${m} V${c} H${n}`}}).filter(Boolean);return{width:X,height:te,nodes:k,edges:J}}function Se(e,s){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${w(M("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${s}</span>
            `;let t=e.split("+").filter(Boolean),o=t.map(A).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${w(o)}">
                ${t.map(a=>W(a,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${s}</span>
        `}function Ee(e){let s=["domicile","exaltation","fall","detriment"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${w(M("page.chart.rulers.modeLabel"))}">
                ${s.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${w(M(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function ke(e,s={},t="domicile"){q();let{chains:o,mainRulers:a}=oe(e,t),d=document.createElement("div");d.className="dispositor-modal-overlay",d.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${w(M("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${w(M("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Ee(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${w(M("page.chart.rulers.mainKicker"))}</span>
                    ${ue(a)}
                </div>
                ${be(o)}
            </div>
        `,document.body.appendChild(d),document.body.classList.add("dispositor-modal-open"),d.addEventListener("click",l=>{let u=l.target;if(u===d||u instanceof Element&&u.closest("[data-dispositor-close]")){q();return}if(!(u instanceof Element))return;let f=u.closest(".dispositor-mode-tab[data-dispositor-mode]");f&&ke(e,s,f.dataset.dispositorMode||t)}),d.querySelector("[data-dispositor-close]")?.focus()}function q(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function ve(e,s,t={}){let o=typeof e=="string"?document.getElementById(e):e;if(!o)return;let a=t.mode||"domicile",{chains:d,housesByRuler:l}=fe(s,a);o.innerHTML=`
            <div class="dispositor-panel">
                ${pe(s?.cosmogram_pattern)}
                <div class="dispositor-section">
                    <div class="dispositor-section-head">
                        <div>
                            <span class="dispositor-card-kicker">${w(M("page.chart.rulers.mainKicker"))}</span>
                            <h4>${w(M("page.chart.rulers.modalTitle"))}</h4>
                        </div>
                    </div>
                    ${$e(d,l)}
                </div>
            </div>
        `}window.DispositorChains={render:ve,buildChains:oe,closeModal:q},document.addEventListener("keydown",e=>{e.key==="Escape"&&q()})})();
