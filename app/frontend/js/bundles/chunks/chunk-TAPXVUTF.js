(function(){"use strict";let K=["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"],D=["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Chiron","Proserpina"],ve=D.slice(0,10),ae="dispositorChainDisplayOptions",j={mode:"domicile",showArrowDirection:!0,showHouseRulers:!0,classicalRulers:!1},ie={Aries:"Mars",Taurus:"Venus",Gemini:"Mercury",Cancer:"Moon",Leo:"Sun",Virgo:"Mercury",Libra:"Venus",Scorpio:"Mars",Sagittarius:"Jupiter",Capricorn:"Saturn",Aquarius:"Saturn",Pisces:"Jupiter"},le=Object.fromEntries(K.map((e,s)=>[e,K[(s+6)%12]])),Ee={Aries:{ruler:"Mars",co_ruler:null,exaltation:"Sun"},Taurus:{ruler:"Venus",co_ruler:null,exaltation:"Moon"},Gemini:{ruler:"Mercury",co_ruler:null,exaltation:null},Cancer:{ruler:"Moon",co_ruler:null,exaltation:"Jupiter"},Leo:{ruler:"Sun",co_ruler:null,exaltation:null},Virgo:{ruler:"Mercury",co_ruler:"Proserpina",exaltation:"Mercury"},Libra:{ruler:"Venus",co_ruler:"Chiron",exaltation:"Saturn"},Scorpio:{ruler:"Pluto",co_ruler:"Mars",exaltation:null},Sagittarius:{ruler:"Jupiter",co_ruler:"Neptune",exaltation:null},Capricorn:{ruler:"Saturn",co_ruler:"Uranus",exaltation:"Mars"},Aquarius:{ruler:"Uranus",co_ruler:"Saturn",exaltation:null},Pisces:{ruler:"Neptune",co_ruler:"Jupiter",exaltation:"Venus"}},ke={TrueNorthNode:"TrueNode",TrueSouthNode:"SouthNode",Fortune:"PartOfFortune"};function w(e,s){return window.FrontendI18n?.t?.(e,s)||e}function f(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function G(e){return ke[e]||e}function O(e){if(!e)return"—";let s=`astro.planet.${e}`,t=w(s);return t!==s?t:window.Symbols?.getPlanetNameRu?.(e)||window.Symbols?.planetNamesRu?.[e]||e}function Pe(e){if(!e)return"—";let s=`astro.sign.${e}`,t=w(s);return t!==s?t:window.Symbols?.signNamesRu?.[e]||e}function F(e,s=16){return window.Symbols?.getPlanetSymbolMarkup?.(e,{size:s,title:O(e)})||`<span class="astro-symbol">${f(window.Symbols?.getPlanetSymbol?.(e)||"")}</span>`}function ce(e){return[window.Symbols?.signs?.[e]||"",Pe(e)].filter(Boolean).join(" ")}function Z(){let e={},s=window.accountPreferencesCache?.methodology?.dignities?.signs||window.accountPreferencesCache?.methodology?.default_dignities?.signs||{};return K.forEach(t=>{let o=Ee[t]||{},r=s?.[t]||{},l=G(r.ruler||o.ruler||null),y=G(r.co_ruler||o.co_ruler||null),u=G(r.exaltation||o.exaltation||null);l&&y&&l===y&&(y=null),e[t]={ruler:l,co_ruler:y,exaltation:u}}),e}function J(e,s,t=Z()){let o=t?.[e]||{},r=t?.[le[e]]||{};return s==="exaltation"?o.exaltation||null:s==="detriment"?r.ruler||null:s==="fall"?r.exaltation||null:o.ruler||null}function pe(e,s,t,o=j){return e?o.classicalRulers&&s==="domicile"?ie[e]||J(e,s,t):o.classicalRulers&&s==="detriment"&&ie[le[e]]||J(e,s,t):null}function de(e){return(Array.isArray(e?.planets)?e.planets:[]).filter(t=>t?.name&&t?.sign&&D.includes(G(t.name))).map(t=>({...t,name:G(t.name)})).sort((t,o)=>D.indexOf(t.name)-D.indexOf(o.name))}function ue(e,s){let t=Z(),o=de(e),r=new Map(o.map(d=>[d.name,d])),l=[],y=new Map;o.forEach(d=>{let m=[],p=new Map,i=d,$=null,v=[];for(;i?.name&&!p.has(i.name);){p.set(i.name,m.length);let h=J(i.sign,s,t);if(m.push({planet:i.name,sign:i.sign,ruler:h,retrograde:!!i.retrograde}),!h){$="none";break}if(!r.has(h)){$=h;break}if(h===i.name){$=h;break}i=r.get(h)}if(!$&&i?.name&&p.has(i.name)){let h=p.get(i.name);v=m.slice(h).map(E=>E.planet),$=v.join("+")}y.set($,(y.get($)||0)+1),l.push({start:d.name,steps:m,finalKey:$,cycle:v})});let u=[...y.entries()].filter(([d])=>d&&d!=="none").sort((d,m)=>m[1]-d[1]||d[0].localeCompare(m[0])).slice(0,4);return{chains:l,mainRulers:u}}function Q(e){if(!e)return`<p class="dispositor-empty">${f(w("page.chart.rulers.empty.noJones"))}</p>`;let s=(()=>{let o=`astro.pattern.${e.pattern_type}`,r=w(o);return r===o?e.pattern_type||"—":r})(),t=[];return Number.isFinite(Number(e.empty_arc_degree))&&t.push(w("page.chart.balances.emptyArc",{value:Number(e.empty_arc_degree).toFixed(0)})),e.handle_planet&&t.push(w("page.chart.balances.handle",{planet:O(e.handle_planet)})),e.leading_planet&&t.push(w("page.chart.balances.leading",{planet:O(e.leading_planet)})),`
            <article class="dispositor-jones-card" title="${f([w("page.chart.rulers.jonesKicker"),s,...t].join(" · "))}">
                <span class="dispositor-card-kicker">${f(w("page.chart.rulers.jonesKicker"))}</span>
                <h4>${f(s)}</h4>
                ${t.length?`<p>${f(t.join(" · "))}</p>`:""}
            </article>
        `}function Re(e){return e.length?`
            <div class="dispositor-main-rulers">
                ${e.map(([s,t])=>{let o=s.split("+").filter(Boolean),r=o.map(O).join(" + ");return`
                        <span class="dispositor-main-chip" title="${f(r)}">
                            ${o.map(l=>F(l,15)).join("")}
                            <b>${t}</b>
                        </span>
                    `}).join("")}
            </div>
        `:`<p class="dispositor-empty">${f(w("page.chart.rulers.empty.noMainRulers"))}</p>`}function ee(e,s="",t=""){let o=[O(e.planet),e.sign?ce(e.sign):""].filter(Boolean).join(" · ");return`
            <span class="dispositor-chain-node ${s}" style="${f(t)}" title="${f(o)}" aria-label="${f(o)}">
                ${F(e.planet,15)}
            </span>
        `}function Ke(e){let s=[...e.steps].reverse().map((o,r)=>{let l=r===0&&e.finalKey!=="none";return ee(o,l?"dispositor-chain-node--main":"")}),t=e.steps[e.steps.length-1];return t?.ruler&&!e.steps.some(o=>o.planet===t.ruler)&&s.unshift(ee({planet:t.ruler},"dispositor-chain-node--external dispositor-chain-node--main")),`
            <div class="dispositor-chain-row">
                <div class="dispositor-chain-path">${s.join('<span class="dispositor-chain-arrow">←</span>')}</div>
            </div>
        `}function I(e){return[...new Set(e)].sort((s,t)=>{let o=D.indexOf(s),r=D.indexOf(t);return(o===-1?999:o)-(r===-1?999:r)})}function Le(e){return I(e).join("+")}function _e(e){let s=e?.number??e?.house_number,t=Number(s);return Number.isInteger(t)?t:s}function Ce(e){let s=[...new Set(e)].map(t=>Number(t)).filter(t=>Number.isInteger(t)).sort((t,o)=>t-o);return s.length?window.Symbols?.formatHouseList?.(s,{style:"roman",separator:","})||s.map(t=>["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][t-1]||String(t)).join(","):""}function Ae(e,s,t,o=j){return s==="domicile"&&e?.ruler_planet&&!o.classicalRulers?G(e.ruler_planet):G(pe(e?.sign,s,t,o))}function he(e,s,t=j){let o=Z(),r=de(e),l=new Map(r.map(p=>[p.name,p])),y=Array.isArray(e?.houses)?e.houses:[],u=new Map,d=[];return y.forEach(p=>{let i=Ae(p,s,o,t),$=_e(p);!i||!$||(u.has(i)||u.set(i,[]),u.get(i).push($),d.push(i))}),r.forEach(p=>{ve.includes(p.name)&&d.push(p.name)}),{chains:I(d).map(p=>{let i=[],$=new Map,v=l.get(p)||{name:p,sign:null,retrograde:!1},h=null,E=[];for(;v?.name&&!$.has(v.name);){$.set(v.name,i.length);let k=v.sign?pe(v.sign,s,o,t):null;if(i.push({planet:v.name,sign:v.sign,ruler:k,retrograde:!!v.retrograde}),!k){h=v.name;break}if(!l.has(k)){h=k;break}if(k===v.name){h=k;break}v=l.get(k)}if(!h&&v?.name&&$.has(v.name)){let k=$.get(v.name);E=i.slice(k).map(A=>A.planet),h=Le(E)}return{start:p,steps:i,finalKey:h,cycle:E}}),housesByRuler:u}}function me(e,s,t,o=""){let r=t.showHouseRulers?Ce(s.get(e.planet)||[]):"",l=[O(e.planet),e.sign?ce(e.sign):"",r?`${w("common.house")} ${r}`:""].filter(Boolean).join(" · "),y=Number.isFinite(e.x)&&Number.isFinite(e.y)?` style="left:${e.x}px; top:${e.y}px;"`:"";return`
            <span
                class="dispositor-compact-node ${o}"
                ${y}
                title="${f(l)}"
                aria-label="${f(l)}"
            >
                <span class="dispositor-compact-symbol">${F(e.planet,32)}</span>
                ${r?`<span class="dispositor-house-label">${f(r)}</span>`:""}
            </span>
        `}function ge(e,s,t,o,r=""){let l=s.get(e)||{planet:e,sign:null};return me(l,t,o,`dispositor-compact-node--static ${r}`.trim())}function fe(){return`
            <svg class="dispositor-cycle-arrow" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
                <path d="M1,7 H26 M21,2 L26,7 L21,12"></path>
            </svg>
        `}function ye(e,s){let t=e&&e!=="none"?e.split("+").filter(Boolean):[];if(t.length<=2)return[];let o=new Set(t),r=(y=[])=>y.length===t.length&&y.every(u=>o.has(u)),l=s.find(y=>r(y.cycle||[]))?.cycle;return l?[...l]:[]}function Be(e){let s=new Map;return e.forEach(t=>{t.steps.forEach(o=>{if(!o?.planet)return;let r=s.get(o.planet)||{planet:o.planet,sign:null};s.set(o.planet,{...r,sign:r.sign||o.sign||null,retrograde:r.retrograde||!!o.retrograde})})}),s}function Ne(e,s,t,o){let r=ye(e,s),l=new Set(r),y=Be(s),u=[...r,r[0]].filter(Boolean),d=[],m=new Set;return s.forEach(p=>{let i=p.steps.findIndex(h=>l.has(h.planet));if(i<=0)return;let $=p.steps.slice(0,i+1).map(h=>h.planet),v=$.join(">");m.has(v)||(m.add(v),d.push($))}),`
            <section class="dispositor-compact-group" aria-label="${f(w("page.chart.rulers.modalTitle"))}">
                <div class="dispositor-cycle-table">
                    <div class="dispositor-cycle-row">
                        ${u.map((p,i)=>`
                            ${i>0?fe():""}
                            ${ge(p,y,t,o,`dispositor-compact-node--main${i===u.length-1?" dispositor-compact-node--repeat":""}`)}
                        `).join("")}
                    </div>
                    ${d.length?`
                        <div class="dispositor-cycle-branches">
                            ${d.map(p=>`
                                <div class="dispositor-cycle-branch-row">
                                    ${p.map((i,$)=>`
                                        ${$>0?fe():""}
                                        ${ge(i,y,t,o,l.has(i)?"dispositor-compact-node--main":"")}
                                    `).join("")}
                                </div>
                            `).join("")}
                        </div>
                    `:""}
                </div>
            </section>
        `}function je(e,s,t){let o=[],r=new Set;if(e.forEach(u=>{let d=u.steps.map(m=>m.planet).join(">");r.has(d)||(r.add(d),o.push(u))}),!o.length)return`<p class="dispositor-empty">${f(w("page.chart.rulers.empty.noChains"))}</p>`;let l=new Map;return o.forEach(u=>{let d=u.finalKey||"none";l.has(d)||l.set(d,[]),l.get(d).push(u)}),`
            <div class="dispositor-compact-diagram">
                ${[...l.entries()].sort((u,d)=>{let m=new Set(u[1].flatMap(i=>i.steps.map($=>$.planet))).size,p=new Set(d[1].flatMap(i=>i.steps.map($=>$.planet))).size;return m-p||String(u[0]).localeCompare(String(d[0]))}).map(([u,d],m)=>{if(ye(u,d).length>2)return Ne(u,d,s,t);let i=$e(u,d),$=`url(#dispositorCompactArrow${m})`,v=` marker-end="${$}"`,h=` marker-start="${$}" marker-end="${$}"`;return`
                        <section class="dispositor-compact-group" aria-label="${f(w("page.chart.rulers.modalTitle"))} ${m+1}">
                            <div class="dispositor-compact-graph" style="--graph-width:${i.width}px; --graph-height:${i.height}px;">
                                <svg class="dispositor-compact-lines" viewBox="0 0 ${i.width} ${i.height}" aria-hidden="true">
                                    <defs>
                                        <marker id="dispositorCompactArrow${m}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                                            <path d="M1,1 L10,6 L1,11"></path>
                                        </marker>
                                    </defs>
                                    ${i.edges.map(E=>`
                                        <path d="${f(E.path)}"${v}></path>
                                    `).join("")}
                                    ${i.mutualEdges.map(E=>`
                                        <path class="dispositor-compact-mutual" d="${f(E.path)}"${h}></path>
                                    `).join("")}
                                </svg>
                                ${i.nodes.map(E=>me(E,s,t,E.isRoot?"dispositor-compact-node--main":"")).join("")}
                            </div>
                        </section>
                    `}).join("")}
            </div>
        `}function $e(e,s){let d=e&&e!=="none"?e.split("+").filter(Boolean):[],m=new Map,p=[],i=new Set,$=(n,c={})=>{if(!n)return null;let g=m.get(n)||{planet:n,sign:null,retrograde:!1};return m.set(n,{...g,sign:g.sign||c.sign||null,retrograde:g.retrograde||!!c.retrograde}),m.get(n)},v=(n,c)=>{let g=n?.planet,b=c?.planet;if(!g||!b||g===b)return;$(g,n),$(b,c);let x=`${g}->${b}`;i.has(x)||(i.add(x),p.push({child:g,parent:b}))};s.forEach(n=>{n.steps.forEach(c=>$(c.planet,c));for(let c=0;c<n.steps.length;c+=1){let g=n.steps[c],b=n.steps[c+1];b?v(g,b):g?.ruler&&!n.steps.some(x=>x.planet===g.ruler)&&v(g,{planet:g.ruler})}});let h=d.length?I(d):I([...m.keys()].filter(n=>!p.some(c=>c.child===n)));!h.length&&m.size&&h.push([...m.keys()][0]);let E=new Set(h),k=new Map,A=[],q=[];p.forEach(n=>{if(E.has(n.child)&&E.has(n.parent)){let c=I([n.child,n.parent]).join("<->");A.some(g=>g.key===c)||A.push({...n,key:c});return}q.push(n),k.has(n.parent)||k.set(n.parent,[]),k.get(n.parent).push(n.child)}),k.forEach((n,c)=>{k.set(c,I(n))});let T=!1,z=(()=>{if(h.length<=2)return h;let n=(R=[])=>R.length===h.length&&R.every(L=>E.has(L)),c=s.find(R=>n(R.cycle||[]))?.cycle;if(c)return T=!0,[...c];let g=new Map(A.map(R=>[R.child,R.parent]));T=A.length>=h.length-1;let b=[],x=h[0];for(;x&&E.has(x)&&!b.includes(x);)b.push(x),x=g.get(x);return h.forEach(R=>{b.includes(R)||b.push(R)}),b})(),_=new Map,V=(n,c,g)=>{let b=8,x=(L,B=0,N=new Set)=>{if(_.has(L))return _.get(L);if(N.has(L)){let Y={x:g+c*B*60,y:b};return b+=58,_.set(L,Y),Y}N.add(L);let xe=(k.get(L)||[]).filter(Y=>!E.has(Y)),re;if(!xe.length)re=b,b+=58;else{let Y=xe.map(X=>x(X,B+1,new Set(N)));re=(Math.min(...Y.map(X=>X.y))+Math.max(...Y.map(X=>X.y)))/2}N.delete(L);let Me={x:g+c*B*60,y:re};return _.set(L,Me),Me};return{rootPosition:x(n,0),height:b}},W=n=>{let c=[],g=[n],b=new Set;for(;g.length;){let x=g.pop();!x||b.has(x)||(b.add(x),c.push(x),(k.get(x)||[]).forEach(R=>{E.has(R)||g.push(R)}))}return c},a=(n,c)=>{W(n).forEach(g=>{let b=_.get(g);b&&(b.y+=c)})};if(h.length===2){let n=h[0],c=h[1],g=V(n,-1,0),b=V(c,1,72),x=Math.max(g.rootPosition.y,b.rootPosition.y);a(n,x-g.rootPosition.y),a(c,x-b.rootPosition.y)}else{let n=8;z.forEach((c,g)=>{V(c,-1,0);let x=W(c).map(N=>_.get(N)).filter(Boolean);if(!x.length)return;let R=Math.min(...x.map(N=>N.y)),L=Math.max(...x.map(N=>N.y)),B=n-R;B&&a(c,B),n=L+B+(g===h.length-1?0:58)})}m.forEach((n,c)=>{_.has(c)||_.set(c,{x:0,y:8+_.size*58})});let M=Math.min(...[..._.values()].map(n=>n.x)),S=Math.min(...[..._.values()].map(n=>n.y));_.forEach(n=>{n.x=n.x-M+8,n.y=n.y-S+8});let P=[...m.values()].map(n=>({...n,isRoot:E.has(n.planet),..._.get(n.planet)||{x:8,y:8}})),C=new Map(P.map(n=>[n.planet,n])),H=n=>{let c=C.get(n.child),g=C.get(n.parent);if(!c||!g)return null;let b=1,x=c.x<g.x,R=x?c.x+42+b:c.x-b,L=x?g.x-b:g.x+42+b,B=c.y+21,N=g.y+21;return{...n,path:`M${R},${B} L${L},${N}`}},oe=n=>{let c=C.get(n.child),g=C.get(n.parent);if(!c||!g)return null;let b=Math.max(c.x,g.x)+42+8,x=b,R=c.y+21,L=g.y+21;if(L>=R)return{...n,path:`M${b},${R} L${x},${L}`};let B=b+14;return{...n,path:`M${b},${R} L${B},${R} L${B},${L} L${x},${L}`}},ne=h.length>2&&T?z.map((n,c)=>({child:n,parent:z[(c+1)%z.length]})).filter(n=>n.child&&n.parent&&n.child!==n.parent):[],Xe=[...q.map(H).filter(Boolean),...ne.map(oe).filter(Boolean)],Fe=h.length>2&&T?[]:A.map(H).filter(Boolean),Je=Math.max(220,Math.ceil(Math.max(...P.map(n=>n.x+42))+8)),Ue=Math.max(70,Math.ceil(Math.max(...P.map(n=>n.y+58))+8));return{width:Je,height:Ue,nodes:P,edges:Xe,mutualEdges:Fe}}function Ie(e){let s=[],t=new Set;e.forEach(r=>{let l=r.steps.map(y=>y.planet).join(">");t.has(l)||(t.add(l),s.push(r))});let o=new Map;return s.forEach(r=>{let l=r.finalKey||"none";o.has(l)||o.set(l,[]),o.get(l).push(r)}),s.length?`
            <div class="dispositor-diagram">
                ${[...o.entries()].map(([r,l])=>`
                    <section class="dispositor-diagram-group">
                        <div class="dispositor-diagram-group-head">
                            ${Oe(r,l.length)}
                        </div>
                        ${Te(r,l)}
                    </section>
                `).join("")}
            </div>
        `:`<p class="dispositor-empty">${f(w("page.chart.rulers.empty.noChains"))}</p>`}function Te(e,s){let t=Ge(e,s);return t.nodes.length?`
            <div class="dispositor-graph" style="--graph-width:${t.width}px; --graph-height:${t.height}px;">
                <svg class="dispositor-graph-lines" viewBox="0 0 ${t.width} ${t.height}" aria-hidden="true">
                    <defs>
                        <marker id="dispositorArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z"></path>
                        </marker>
                    </defs>
                    ${t.edges.map(o=>`
                        <path d="${f(o.path)}" marker-end="url(#dispositorArrow)"></path>
                    `).join("")}
                </svg>
                ${t.nodes.map(o=>ee(o,o.isRoot?"dispositor-chain-node--main":"",`left:${o.x}px; top:${o.y}px;`)).join("")}
            </div>
        `:`<p class="dispositor-empty">${f(w("page.chart.rulers.empty.noChains"))}</p>`}function Ge(e,s){let y=new Set(e&&e!=="none"?e.split("+").filter(Boolean):[]),u=new Map,d=[],m=new Set,p=new Map,i=new Map,$=(a,M={})=>{if(!a)return null;let S=u.get(a)||{planet:a,sign:null,retrograde:!1};return u.set(a,{...S,sign:S.sign||M.sign||null,retrograde:S.retrograde||!!M.retrograde}),u.get(a)},v=(a,M)=>{let S=a?.planet,P=M?.planet;if(!S||!P||S===P||y.has(S)&&y.has(P))return;$(S,a),$(P,M);let C=`${S}->${P}`;m.has(C)||(m.add(C),d.push({child:S,parent:P}),i.set(S,P),p.has(P)||p.set(P,[]),p.get(P).push(S))};s.forEach(a=>{a.steps.forEach(S=>$(S.planet,S));for(let S=0;S<a.steps.length-1;S+=1)v(a.steps[S],a.steps[S+1]);let M=a.steps[a.steps.length-1];M?.ruler&&!a.steps.some(S=>S.planet===M.ruler)&&v(M,{planet:M.ruler})}),y.size||[...u.keys()].forEach(a=>{i.has(a)||y.add(a)}),!y.size&&u.size&&y.add([...u.keys()][0]),p.forEach((a,M)=>{p.set(M,I(a))});let h=new Map,E=(a,M=0)=>{h.has(a)&&h.get(a)<=M||(h.set(a,M),(p.get(a)||[]).forEach(S=>E(S,M+1)))};I([...y]).forEach(a=>E(a,0)),u.forEach((a,M)=>{h.has(M)||h.set(M,0)});let k=24,A=new Map,q=(a,M=new Set)=>{if(A.has(a))return A.get(a);if(M.has(a)){let C=k;return k+=76,A.set(a,C),C}M.add(a);let S=p.get(a)||[],P;if(!S.length)P=k,k+=76;else{let C=S.map(H=>q(H,new Set(M)));P=(Math.min(...C)+Math.max(...C))/2}return M.delete(a),A.set(a,P),P};I([...y]).forEach(a=>q(a)),u.forEach((a,M)=>q(M));let T=[...u.values()].map(a=>({...a,isRoot:y.has(a.planet),x:24+(h.get(a.planet)||0)*128,y:A.get(a.planet)||24})),se=new Map(T.map(a=>[a.planet,a])),z=Math.max(0,...T.map(a=>h.get(a.planet)||0)),_=Math.max(180,k+24),V=Math.max(520,48+z*128+44),W=d.map(a=>{let M=se.get(a.child),S=se.get(a.parent);if(!M||!S)return null;let P=M.x,C=M.y+44/2,H=S.x+44,oe=S.y+44/2,ne=Math.max(H+18,P-42);return{...a,path:`M${P},${C} H${ne} V${oe} H${H}`}}).filter(Boolean);return{width:V,height:_,nodes:T,edges:W}}function Oe(e,s){if(!e||e==="none")return`
                <span class="dispositor-diagram-group-title">${f(w("page.chart.rulers.empty.noMainRulers"))}</span>
                <span class="dispositor-diagram-count">${s}</span>
            `;let t=e.split("+").filter(Boolean),o=t.map(O).join(" + ");return`
            <span class="dispositor-diagram-group-title" title="${f(o)}">
                ${t.map(r=>F(r,17)).join('<span class="dispositor-cycle-mark">↔</span>')}
            </span>
            <span class="dispositor-diagram-count">${s}</span>
        `}function He(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-mode-tabs" role="tablist" aria-label="${f(w("page.chart.rulers.modeLabel"))}">
                ${s.map(t=>`
                    <button
                        type="button"
                        class="dispositor-mode-tab${t===e?" active":""}"
                        data-dispositor-mode="${t}"
                        role="tab"
                        aria-selected="${t===e?"true":"false"}"
                    >${f(w(`astro.dignity.${t}`))}</button>
                `).join("")}
            </div>
        `}function be(e){return["domicile","exaltation","detriment","fall"].includes(e)?e:j.mode}function Ye(e={}){let s={};try{s=JSON.parse(window.localStorage?.getItem(ae)||"{}")||{}}catch{s={}}return{...j,mode:be(e.mode||s.mode||j.mode),showArrowDirection:(e.showArrowDirection??s.showArrowDirection??j.showArrowDirection)!==!1,showHouseRulers:(e.showHouseRulers??s.showHouseRulers??j.showHouseRulers)!==!1,classicalRulers:(e.classicalRulers??s.classicalRulers??j.classicalRulers)===!0}}function De(e){try{window.localStorage?.setItem(ae,JSON.stringify(e))}catch{}}function we(e){let s=`page.chart.rulers.chainModes.${e}`,t=w(s);return t!==s?t:w(e==="domicile"?"page.chart.rulers.chainModes.domicile":`astro.dignity.${e}`)}function qe(e){let s=["domicile","exaltation","detriment","fall"];return`
            <div class="dispositor-options">
                <button
                    type="button"
                    class="dispositor-options-toggle"
                    data-dispositor-options-toggle
                    aria-haspopup="menu"
                    aria-expanded="false"
                >
                    <span>${f(we(e.mode))}</span>
                    <span class="dispositor-options-chevron" aria-hidden="true">⌄</span>
                </button>
                <div class="dispositor-options-menu hidden" data-dispositor-options-menu role="menu">
                    <div class="dispositor-options-group" role="radiogroup" aria-label="${f(w("page.chart.rulers.options.chainType"))}">
                        ${s.map(t=>`
                            <label class="dispositor-option-row">
                                <input
                                    type="radio"
                                    name="dispositor-chain-mode"
                                    value="${f(t)}"
                                    data-dispositor-option="mode"
                                    ${t===e.mode?"checked":""}
                                >
                                <span>${f(we(t))}</span>
                            </label>
                        `).join("")}
                    </div>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="showHouseRulers" ${e.showHouseRulers?"checked":""}>
                        <span>${f(w("page.chart.rulers.options.houseRulers"))}</span>
                    </label>
                    <label class="dispositor-option-row">
                        <input type="checkbox" data-dispositor-option="classicalRulers" ${e.classicalRulers?"checked":""}>
                        <span>${f(w("page.chart.rulers.options.classicalRulers"))}</span>
                    </label>
                </div>
            </div>
        `}function te(e,s,t){return`
            <div class="dispositor-section">
                <div class="dispositor-section-head">
                    <div>
                        <span class="dispositor-card-kicker">${f(w("page.chart.rulers.mainKicker"))}</span>
                        <h4>${f(w("page.chart.rulers.modalTitle"))}</h4>
                    </div>
                    ${qe(t)}
                </div>
                ${je(e,s,t)}
            </div>
        `}function ze(e,s,t,o){return`
            <div class="dispositor-panel dispositor-panel--tabs">
                <div class="dispositor-tabs" role="tablist" aria-label="${f(w("page.chart.rulers.tabs.label"))}">
                    <button type="button" class="dispositor-tab active" data-dispositor-tab="jones" role="tab" aria-selected="true">
                        ${f(w("page.chart.rulers.tabs.jones"))}
                    </button>
                    <button type="button" class="dispositor-tab" data-dispositor-tab="scheme" role="tab" aria-selected="false">
                        ${f(w("page.chart.rulers.tabs.scheme"))}
                    </button>
                </div>
                <div class="dispositor-tab-panel active" data-dispositor-panel="jones" role="tabpanel">
                    ${Q(e?.cosmogram_pattern)}
                </div>
                <div class="dispositor-tab-panel" data-dispositor-panel="scheme" role="tabpanel">
                    ${te(s,t,o)}
                </div>
            </div>
        `}function Ve(e,s={},t="domicile"){U();let{chains:o,mainRulers:r}=ue(e,t),l=document.createElement("div");l.className="dispositor-modal-overlay",l.innerHTML=`
            <div class="dispositor-modal" role="dialog" aria-modal="true" aria-labelledby="dispositorModalTitle">
                <div class="dispositor-modal-head">
                    <h3 id="dispositorModalTitle">${f(w("page.chart.rulers.modalTitle"))}</h3>
                    <button type="button" class="dispositor-modal-close" data-dispositor-close aria-label="${f(w("page.chart.rulers.modalClose"))}">×</button>
                </div>
                ${He(t)}
                <div class="dispositor-modal-summary">
                    <span class="dispositor-card-kicker">${f(w("page.chart.rulers.mainKicker"))}</span>
                    ${Re(r)}
                </div>
                ${Ie(o)}
            </div>
        `,document.body.appendChild(l),document.body.classList.add("dispositor-modal-open"),l.addEventListener("click",y=>{let u=y.target;if(u===l||u instanceof Element&&u.closest("[data-dispositor-close]")){U();return}if(!(u instanceof Element))return;let d=u.closest(".dispositor-mode-tab[data-dispositor-mode]");d&&Ve(e,s,d.dataset.dispositorMode||t)}),l.querySelector("[data-dispositor-close]")?.focus()}function U(){document.querySelector(".dispositor-modal-overlay")?.remove(),document.body.classList.remove("dispositor-modal-open")}function Se(e,s,t={}){let o=typeof e=="string"?document.getElementById(e):e;if(!o)return;let r=Ye(t),{chains:l,housesByRuler:y}=he(s,r.mode,r);t.section==="jones"?o.innerHTML=`<div class="dispositor-panel">${Q(s?.cosmogram_pattern)}</div>`:t.section==="scheme"?o.innerHTML=`<div class="dispositor-panel">${te(l,y,r)}</div>`:o.innerHTML=t.layout==="tabs"?ze(s,l,y,r):`
                    <div class="dispositor-panel">
                        ${Q(s?.cosmogram_pattern)}
                        ${te(l,y,r)}
                    </div>
                `,o.querySelectorAll("[data-dispositor-tab]").forEach(m=>{m.addEventListener("click",()=>{let p=m.dataset.dispositorTab;o.querySelectorAll("[data-dispositor-tab]").forEach(i=>{let $=i.dataset.dispositorTab===p;i.classList.toggle("active",$),i.setAttribute("aria-selected",$?"true":"false")}),o.querySelectorAll("[data-dispositor-panel]").forEach(i=>{i.classList.toggle("active",i.dataset.dispositorPanel===p)})})});let u=o.querySelector("[data-dispositor-options-toggle]"),d=o.querySelector("[data-dispositor-options-menu]");u?.addEventListener("click",m=>{m.stopPropagation();let p=d&&!d.classList.contains("hidden");d?.classList.toggle("hidden",p),u.setAttribute("aria-expanded",p?"false":"true")}),d?.addEventListener("click",m=>m.stopPropagation()),d?.querySelectorAll("[data-dispositor-option]").forEach(m=>{m.addEventListener("change",()=>{let p={...r};m.dataset.dispositorOption==="mode"?p.mode=be(m.value):p[m.dataset.dispositorOption]=m.checked,De(p),Se(o,s,p)})})}window.DispositorChains={render:Se,buildChains:ue,buildHouseDispositorScheme:he,buildCompactLayout:$e,closeModal:U},document.addEventListener("keydown",e=>{e.key==="Escape"&&(U(),document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))}),document.addEventListener("click",e=>{e.target instanceof Element&&e.target.closest(".dispositor-options")||(document.querySelectorAll(".dispositor-options-menu").forEach(s=>s.classList.add("hidden")),document.querySelectorAll('[data-dispositor-options-toggle][aria-expanded="true"]').forEach(s=>{s.setAttribute("aria-expanded","false")}))})})();
