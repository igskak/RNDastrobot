(function(){"use strict";let T=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],v=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],F=Object.fromEntries(T.map((e,r)=>[e,T[(r+6)%12]])),I={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},V={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function m(e,r){return window.FrontendI18n?.t?.(e,r)||e}function c(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function E(e){return V[e]||e}function x(e){if(!e)return"—";let r=`astro.planet.${e}`,t=m(r);return t!==r?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function H(e){if(!e)return"—";let r=`astro.sign.${e}`,t=m(r);return t!==r?t:window.Symbols?.signNamesRu?.[e]||e}function B(e,r=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:r,title:x(e)})||`<span class="astro-symbol">${c(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function J(e){return[window.Symbols?.signs?.[e]||"",H(e)].filter(Boolean).join(" ")}function G(){let e={},r=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return T.forEach(t=>{let n=I[t]||{},l=r?.[t]||{},o=E(l.ruler||n.ruler||null),d=E(l.co_ruler||n.co_ruler||null),p=E(l.exaltation||n.exaltation||null);o&&d&&o===d&&(d=null),e[t]={ruler:o,co_ruler:d,exaltation:p}}),e}function U(e,r,t=G()){let n=t?.[e]||{},l=t?.[F[e]]||{};return r==="exaltation"?n.exaltation||null:r==="detriment"?l.ruler||null:r==="fall"?l.exaltation||null:n.ruler||null}function X(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&v.includes(E(t.name))).map(t=>({...t,name:E(t.name)})).sort((t,n)=>v.indexOf(t.name)-v.indexOf(n.name))}function C(e,r){let t=G(),n=X(e),l=new Map(n.map(h=>[h.name,h])),o=[],d=new Map;n.forEach(h=>{let M=[],$=new Map,g=h,b=null,w=[];for(;g?.name&&!$.has(g.name);){$.set(g.name,M.length);let f=U(g.sign,r,t);if(M.push({planet:g.name,sign:g.sign,ruler:f,retrograde:!!g.retrograde}),!f){b="none";break}if(!l.has(f)){b=f;break}if(f===g.name){b=f;break}g=l.get(f)}if(!b&&g?.name&&$.has(g.name)){let f=$.get(g.name);w=M.slice(f).map(S=>S.planet),b=w.join("+")}d.set(b,(d.get(b)||0)+1),o.push({start:h.name,steps:M,finalKey:b,cycle:w})});let p=[...d.entries()].filter(([h])=>h&&h!=="none").sort((h,M)=>M[1]-h[1]||h[0].localeCompare(M[0])).slice(0,4);return{chains:o,mainRulers:p}}function K(e){if(!e)return`<p class="dispositor-empty">${c(m("page.chart.rulers.empty.noJones"))}</p>`;let r=(()=>{let n=`astro.pattern.${e.pattern_type}`,l=m(n);return l===n?e.pattern_type||"—":l})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push(m("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push(m("page.chart.balances.handle",{planet:x(e.handle_planet)})),e.leading_planet&&t.push(m("page.chart.balances.leading",{planet:x(e.leading_planet)})),`
            <article class="dispositor-jones-card">
                <span class="dispositor-card-kicker">${c(m("page.chart.rulers.jonesKicker"))}</span>
                <h4>${c(r)}</h4>
                ${t.length?`<p>${c(t.join(" · "))}</p>`:""}
            </article>
        `}function A(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([r,t])=>{let n=r.split("+").filter(Boolean),l=n.map(x).join(" + ");return`
                        <span class="dispositor-main-chip" title="${c(l)}">
                            ${n.map(o=>B(o,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${c(m("page.chart.rulers.empty.noMainRulers"))}</p>`}function L(e,r="",t=""){let n=[x(e.planet),e.sign?J(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${r}" style="${c(t)}" title="${c(n)}" aria-label="${c(n)}">
                ${B(e.planet,15)}
                ${e.retrograde?'<span class="dispositor-node-retro">r</span>':""}
            </span>
        `}function le(e){let r=[...e.steps].reverse().map((n,l)=>{let o=l===0&&e.finalKey!=="none";return L(n,o?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(n=>n.planet===t.ruler)&&r.unshift(L({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${r.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function W(e){let r=[],t=new Set;e.forEach(l=>{let o=l.steps.map(d=>d.planet).join(">");t.has(o)||(t.add(o),r.push(l))});let n=new Map;return r.forEach(l=>{let o=l.finalKey||"none";n.has(o)||n.set(o,[]),n.get(o).push(l)}),r.length?`
            <div class="dispositor-diagram">
                ${[...n.entries()].map(([l,o])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${ee(l,o.length)}
                        </div>
                        ${Z(l,o)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${c(m("page.chart.rulers.empty.noChains"))}</p>`}function Z(e,r){let t=Q(e,r);return t.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${t.width}px; --graph-height:${t.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${t.width} ${t.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${t.edges.map(n=>`
                        <path d="${c(n.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${t.nodes.map(n=>L(n,n.isRoot?"dispositor-chain-node--main":"",`left:${n.x}px; top:${n.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${c(m("page.chart.rulers.empty.noChains"))}</p>`}function Q(e,r){let d=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),p=new Map,h=[],M=new Set,$=new Map,g=new Map,b=(s,i={})=>{if(!s)return null;let a=p.get(s)||{planet:s,sign:null,retrograde:!1};return p.set(s,{...a,sign:a.sign||i.sign||null,retrograde:a.retrograde||!!i.retrograde}),p.get(s)},w=(s,i)=>{let a=s?.planet,u=i?.planet;if(!a||!u||a===u||d.has(a)&&d.has(u))return;b(a,s),b(u,i);let y=`${a}->${u}`;M.has(y)||(M.add(y),h.push({child:a,parent:u}),g.set(a,u),$.has(u)||$.set(u,[]),$.get(u).push(a))};r.forEach(s=>{s.steps.forEach(a=>b(a.planet,a));for(let a=0;a<s.steps.length-1;a+=1)w(s.steps[a],s.steps[a+1]);let i=s.steps[s.steps.length-1];i?.ruler&&!s.steps.some(a=>a.planet===i.ruler)&&w(i,{planet:i.ruler})}),d.size||[...p.keys()].forEach(s=>{g.has(s)||d.add(s)}),!d.size&&p.size&&d.add([...p.keys()][0]);let f=s=>[...new Set(s)].sort((i,a)=>{let u=v.indexOf(i),y=v.indexOf(a);return(u===-1?999:u)-(y===-1?999:y)});$.forEach((s,i)=>{$.set(i,f(s))});let S=new Map,z=(s,i=0)=>{S.has(s)&&S.get(s)<=i||(S.set(s,i),($.get(s)||[]).forEach(a=>z(a,i+1)))};f([...d]).forEach(s=>z(s,0)),p.forEach((s,i)=>{S.has(i)||S.set(i,0)});let _=24,k=new Map,j=(s,i=new Set)=>{if(k.has(s))return k.get(s);if(i.has(s)){let y=_;return _+=76,k.set(s,y),y}i.add(s);let a=$.get(s)||[],u;if(!a.length)u=_,_+=76;else{let y=a.map(P=>j(P,new Set(i)));u=(Math.min(...y)+Math.max(...y))/2}return i.delete(s),k.set(s,u),u};f([...d]).forEach(s=>j(s)),p.forEach((s,i)=>j(i));let R=[...p.values()].map(s=>({...s,isRoot:d.has(s.planet),x:24+(S.get(s.planet)||0)*128,y:k.get(s.planet)||24})),D=new Map(R.map(s=>[s.planet,s])),te=Math.max(0,...R.map(s=>S.get(s.planet)||0)),se=Math.max(180,_+24),re=Math.max(520,48+te*128+44),ne=h.map(s=>{let i=D.get(s.child),a=D.get(s.parent);if(!i||!a)return null;let u=i.x,y=i.y+44/2,P=a.x+44,oe=a.y+44/2,ae=Math.max(P+18,u-42);return{...s,path:`M${u},${y} H${ae} V${oe} H${P}`}}).filter(Boolean);return{width:re,height:se,nodes:R,edges:ne}}function ee(e,r){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${c(m("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${r}</span>
            `;let t=e.split("+").filter(Boolean),n=t.map(x).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${c(n)}">
                ${t.map(l=>B(l,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${r}</span>
        `}function Y(e){let r=["domicile","exaltation","fall","detriment"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${c(m("page.chart.rulers.modeLabel"))}">
                ${r.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${c(m(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function q(e,r={},t="domicile"){N();let{chains:n,mainRulers:l}=C(e,t),o=document.createElement("div");o.className="dispositor-modal-overlay",o.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${c(m("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${c(m("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${Y(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${c(m("page.chart.rulers.mainKicker"))}</span>
                    ${A(l)}
                </div>
                ${W(n)}
            </div>
        `,document.body.appendChild(o),document.body.classList.add("dispositor-modal-open"),o.addEventListener("click",d=>{let p=d.target;if(p===o||p instanceof Element&&p.closest("[data-dispositor-close]")){N();return}if(!(p instanceof Element))return;let h=p.closest(".dispositor-mode-tab[data-dispositor-mode]");h&&q(e,r,h.dataset.dispositorMode||t)}),o.querySelector("[data-dispositor-close]")?.focus()}function N(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function O(e,r,t={}){let n=typeof e=="string"?document.getElementById(e):e;if(!n)return;let o=n.querySelector(".dispositor-mode-tab.active")?.dataset?.dispositorMode||t.mode||"domicile",{chains:d,mainRulers:p}=C(r,o);n.innerHTML=`
            <div class="dispositor-panel">
                ${K(r?.cosmogram_pattern)}
                <div class="dispositor-section">
                    <div class="dispositor-section-head">
                        <div>
                            <span class="dispositor-card-kicker">${c(m("page.chart.rulers.mainKicker"))}</span>
                            <h4>${c(m("page.chart.rulers.mainTitle"))}</h4>
                        </div>
                    </div>
                    ${Y(o)}
                    ${A(p)}
                    <button type="button" class="dispositor-open-modal-btn" data-dispositor-open-modal>
                        ${c(m("page.chart.rulers.openSchema"))}
                    </button>
                </div>
            </div>
        `,n.querySelectorAll(".dispositor-mode-tab[data-dispositor-mode]").forEach(h=>{h.addEventListener("click",()=>{O(n,r,{...t,mode:h.dataset.dispositorMode||o})})}),n.querySelector("[data-dispositor-open-modal]")?.addEventListener("click",()=>{q(r,t,n.querySelector(".dispositor-mode-tab.active")?.dataset?.dispositorMode||o)})}window.DispositorChains={render:O,buildChains:C,closeModal:N},document.addEventListener("keydown",e=>{e.key==="Escape"&&N()})})();
