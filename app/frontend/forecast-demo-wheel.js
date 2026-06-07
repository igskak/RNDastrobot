/* shared demo data + wheel renderer for the forecast mockups */
const VS="︎";
const SIGN_GLYPH=["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];
const SIGN_AB=["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
const PLANETS=[
  {g:"☉",n:"Sun",s:0,deg:"21°14'"},{g:"☽",n:"Moon",s:7,deg:"03°48'"},
  {g:"☿",n:"Mercury",s:10,deg:"28°02'"},{g:"♀",n:"Venus",s:0,deg:"06°31'"},
  {g:"♂",n:"Mars",s:9,deg:"14°55'"},{g:"♃",n:"Jupiter",s:4,deg:"09°17'"},
  {g:"♄",n:"Saturn",s:10,deg:"02°40'"},{g:"♅",n:"Uranus",s:9,deg:"11°09'"},
  {g:"♆",n:"Neptune",s:9,deg:"15°22'"},{g:"♇",n:"Pluto",s:7,deg:"20°41'"},
];
const natalLon=[351,213,328,6,284,129,302,281,285,230];
const transLon=[76,11,52,40,250,98,330,40,355,300];

function build(body,onD,onA){
  body.innerHTML=PLANETS.map((p,i)=>`
    <tr>
      <td><span class="glyph astro">${p.g+VS}</span></td>
      <td><div class="posrow"><span class="pname">${p.n}</span>
        <span class="pdeg"><span class="sg">${SIGN_GLYPH[p.s]+VS}</span>${p.deg}</span></div></td>
      <td class="mx-cell"><span class="mx ${onD.includes(i)?'on':''}"></span></td>
      <td class="mx-cell"><span class="mx ${onA.includes(i)?'on':''}"></span></td>
    </tr>`).join("");
}
build(document.getElementById("natalBody"),[0,1,2,3,4,5,6,7,8,9],[0,1,2,3,4,5,6]);
build(document.getElementById("transBody"),[0,1,2,3,4,5,6,7,8,9],[0,1,2,5]);

const NS="http://www.w3.org/2000/svg";
const wheel=document.getElementById("wheel"),cx=300,cy=300;
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
const pol=(r,d)=>{const a=(180-d)*Math.PI/180;return[cx+r*Math.cos(a),cy-r*Math.sin(a)];};
const R_OUT=288,R_SIGN=250,R_HOUSE=216,R_INNER=150,R_TRANS=270,R_NAT=186;
const css=getComputedStyle(document.documentElement);
const C_LINE=css.getPropertyValue('--wheel-line')||"rgba(120,110,170,.2)";
const C_SIGN=css.getPropertyValue('--violet-deep')||"#6d5ce0";
const C_NAT=css.getPropertyValue('--wheel-nat')||"#6d5ce0";
const C_TRANS=css.getPropertyValue('--wheel-trans')||"#e08bb0";
const C_HNUM=css.getPropertyValue('--ink-faint')||"#9a96b3";

const defs=el("defs",{});
defs.innerHTML=`<radialGradient id="ring" cx="50%" cy="42%" r="60%"><stop offset="55%" stop-color="rgba(157,139,255,0)"/><stop offset="100%" stop-color="rgba(157,139,255,.14)"/></radialGradient>
<linearGradient id="zod" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C_NAT}"/><stop offset="1" stop-color="${C_TRANS}"/></linearGradient>`;
wheel.appendChild(defs);
wheel.appendChild(el("circle",{cx,cy,r:R_OUT,fill:"url(#ring)"}));
[R_OUT,R_SIGN,R_HOUSE,R_INNER].forEach(r=>wheel.appendChild(el("circle",{cx,cy,r,fill:"none",stroke:C_LINE,"stroke-width":1})));
for(let i=0;i<12;i++){
  const a0=i*30;const[x1,y1]=pol(R_SIGN,a0);
  wheel.appendChild(el("line",{x1,y1,x2:pol(R_OUT,a0)[0],y2:pol(R_OUT,a0)[1],stroke:C_LINE,"stroke-width":1}));
  const[gx,gy]=pol((R_SIGN+R_OUT)/2,a0+15);
  const t=el("text",{x:gx,y:gy,"text-anchor":"middle","dominant-baseline":"central","font-size":20,fill:C_SIGN,"font-family":"STIX Two Text,serif",opacity:.85});
  t.textContent=SIGN_GLYPH[i]+VS;wheel.appendChild(t);
}
for(let i=0;i<12;i++){
  const a0=i*30+8;const[x1,y1]=pol(R_INNER,a0),[x2,y2]=pol(R_HOUSE,a0);
  wheel.appendChild(el("line",{x1,y1,x2,y2,stroke:C_LINE,"stroke-width":1,opacity:.6}));
  const[nx,ny]=pol(R_INNER+16,a0+15);
  const t=el("text",{x:nx,y:ny,"text-anchor":"middle","dominant-baseline":"central","font-size":11,fill:C_HNUM,"font-weight":600});
  t.textContent=i+1;wheel.appendChild(t);
}
[[0,5],[1,3],[2,4],[0,9],[6,2]].forEach(([i,j],k)=>{
  const[x1,y1]=pol(R_INNER,natalLon[i]),[x2,y2]=pol(R_INNER,natalLon[j]);
  wheel.appendChild(el("line",{x1,y1,x2,y2,stroke:"url(#zod)","stroke-width":1.4,opacity:.5,class:"draw",style:`animation-delay:${.4+k*.12}s`}));
});
function place(lons,radius,color,delayBase){
  lons.forEach((lon,idx)=>{
    const[x,y]=pol(radius,lon),[tx,ty]=pol(radius+13,lon),[ex,ey]=pol(R_SIGN-2,lon);
    wheel.appendChild(el("line",{x1:tx,y1:ty,x2:ex,y2:ey,stroke:color,"stroke-width":.8,opacity:.25}));
    const g=el("g",{class:"fade-pl",style:`animation-delay:${delayBase+idx*.05}s`});
    g.appendChild(el("circle",{cx:x,cy:y,r:13,fill:css.getPropertyValue('--wheel-disc')||"rgba(255,255,255,.92)",stroke:color,"stroke-width":1.5}));
    const t=el("text",{x,y,"text-anchor":"middle","dominant-baseline":"central","font-size":15,fill:color,"font-family":"STIX Two Text,serif"});
    t.textContent=PLANETS[idx].g+VS;g.appendChild(t);wheel.appendChild(g);
  });
}
place(natalLon,R_NAT,C_NAT,.6);
place(transLon,R_TRANS,C_TRANS,1.0);
