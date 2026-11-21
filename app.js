const API="roblox-live.innocentnyx.workers.dev";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[<&>"]/g,c=>({"<":"&lt;","&":"&amp;",">":"&gt;",'"':"&quot;"}[c]));
const f=v=>v>=1e9?+(v/1e9).toFixed(1)+"B":v>=1e6?+(v/1e6).toFixed(1)+"M":v>=1e3?+(v/1e3).toFixed(1)+"K":String(v||0);
const days=d=>(Date.now()-new Date(d))/864e5;
const age=d=>{d=days(d);return d<60?Math.floor(d)+" days":d<730?Math.floor(d/30)+" months":(d/365).toFixed(1)+" years"};
const linked=g=>!!g.discord&&g.src!=="web";
const G=[["c","Active players"],["v","Visits"],["a","Old (days)"]];
const B={c:[0,1e5],v:[0,1e9],a:[0,3650]};
const num=id=>{const t=$(id).value.trim().toLowerCase().replace(/,/g,"");const m=t.match(/^([\d.]+)\s*([kmb]?)$/);return m?+m[1]*({"":1,k:1e3,m:1e6,b:1e9}[m[2]]):null};
const nice=v=>{if(v<100)return Math.round(v);const s=10**(Math.floor(Math.log10(v))-1);return Math.round(v/s)*s};
const val=(k,t)=>{const[lo,hi]=B[k];return nice((lo+1)*Math.pow((hi+1)/(lo+1),t/1000)-1)};
const inv=(k,v)=>{const[lo,hi]=B[k];return Math.min(1000,Math.max(0,1000*Math.log((v+1)/(lo+1))/Math.log((hi+1)/(lo+1))))};
let disc=null;
$("db").innerHTML=G.map(([k,t])=>`<div class="grp"><h3>${t}</h3>
<div class="sh"><span>Min</span><input class="vi" id="${k}1" aria-label="${t} min"></div><input type="range" class="rs" min="0" max="1000" value="0" id="${k}a" aria-label="${t} minimum">
<div class="sh"><span>Max</span><input class="vi" id="${k}2" aria-label="${t} max"></div><input type="range" class="rs" min="0" max="1000" value="1000" id="${k}b" aria-label="${t} maximum"></div>`).join("")
+`<div class="grp"><h3>Discord</h3><p>Leave both off to show every game.</p><div class="seg"><button id="dy" aria-pressed="false">Yes</button><button id="dn" aria-pressed="false">No</button></div></div>`;
function sync(k){const a=$(k+"a"),b=$(k+"b");a.style.setProperty("--p",a.value/10+"%");b.style.setProperty("--p",b.value/10+"%");
  $(k+"1").value=+a.value<=0?"Any":f(val(k,+a.value));$(k+"2").value=+b.value>=1000?"Any":f(val(k,+b.value))}
G.forEach(([k])=>{const a=$(k+"a"),b=$(k+"b");
  a.oninput=()=>{if(+a.value>+b.value)a.value=b.value;sync(k);count()};b.oninput=()=>{if(+b.value<+a.value)b.value=a.value;sync(k);count()};
  $(k+"1").onchange=()=>{const v=num(k+"1");a.value=v==null?0:Math.min(Math.round(inv(k,v)),+b.value);sync(k);count()};
  $(k+"2").onchange=()=>{const v=num(k+"2");b.value=v==null?1000:Math.max(Math.round(inv(k,v)),+a.value);sync(k);count()};sync(k)});
document.querySelectorAll(".vi").forEach(i=>i.onfocus=()=>i.select());
const setD=v=>{disc=disc===v?null:v;$("dy").setAttribute("aria-pressed",disc==="yes");$("dn").setAttribute("aria-pressed",disc==="no");count()};
$("dy").onclick=()=>setD("yes");$("dn").onclick=()=>setD("no");
const rr=k=>{const t1=+$(k+"a").value,t2=+$(k+"b").value;return[t1<=0?null:val(k,t1),t2>=1000?null:val(k,t2)]};
const rd=()=>({q:$("q").value.trim().toLowerCase(),c:rr("c"),v:rr("v"),a:rr("a"),d:disc});
const inr=(x,r)=>(r[0]==null||x>=r[0])&&(r[1]==null||x<=r[1]);
const STOP=new Set(["with","like","the","and","game","games","roblox","for","that","but","any"]);
const qm=(n,q)=>{if(!q)return true;n=n.toLowerCase();if(n.includes(q))return true;return q.split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)).some(w=>n.includes(w))};
const ok=(g,F)=>inr(g.ccu,F.c)&&inr(g.visits,F.v)&&inr(days(g.created),F.a)&&qm(g.name,F.q)&&(F.d==null||(F.d==="yes")===linked(g));
let all=[],F=rd(),View="home";
const rng=(r,u)=>r[0]!=null&&r[1]!=null?`${f(r[0])}–${f(r[1])}${u}`:r[0]!=null?`${f(r[0])}+${u}`:`Under ${f(r[1])}${u}`;
const nFil=()=>[F.c,F.v,F.a].filter(r=>r[0]!=null||r[1]!=null).length+(F.d?1:0);

function setMenu(on){$("menu").hidden=!on;$("mb").setAttribute("aria-expanded",on);$("mi").innerHTML=on?'<path d="M6 6l12 12M18 6L6 18"/>':'<path d="M4 7h16M4 12h16M4 17h16"/>'}
function route(){View=location.hash==="#top"?"top":"home";setMenu(false);
  document.querySelector(".hero").hidden=View!=="home";
  $("rs").textContent=View==="top"?"The 50 most played Roblox games right now.":"Live player counts, updated every few minutes.";
  $("more").hidden=View!=="home";window.scrollTo(0,0);render()}
function render(){
  let r=all.filter(g=>ok(g,F)).sort((x,y)=>y.ccu-x.ccu);const total=r.length;
  const sf=F.q||nFil();
  $("rt").innerHTML=(View==="top"?"Top 50 games":sf?"Search results":"Popular Roblox games right now")+`<small>${total}</small>`;
  r=r.slice(0,View==="top"?50:sf?100:20);
  $("list").innerHTML=r.length?r.map((g,i)=>`<article class="c"><span class="rk">#${i+1}</span>${g.thumb?`<img class="th" src="${esc(g.thumb)}" alt="" loading="lazy">`:`<div class="th">${esc((g.name.trim()[0]||"?").toUpperCase())}</div>`}
<div class="ci"><div class="nm">${esc(g.name)}</div><div class="pl"><i></i>${g.ccu.toLocaleString()} playing</div></div><button class="sd" data-id="${g.id}">See details</button></article>`).join(""):'<div class="empty">No games match. Try removing a filter.</div>';
  const a=[];if(F.q)a.push(["q",`“${esc(F.q)}”`]);
  [["c","Active "],["v","Visits "],["a","Old "]].forEach(([k,t])=>{const x=F[k];if(x[0]!=null||x[1]!=null)a.push([k,t+rng(x,k==="a"?" days":"")])});
  if(F.d)a.push(["d","Discord: "+(F.d==="yes"?"Yes":"No")]);
  $("act").innerHTML=a.map(([k,t])=>`<span class="ac">${t}<button data-k="${k}" aria-label="Remove filter"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span>`).join("");
  const n=nFil();$("fbc").hidden=!n;$("fbc").textContent=n;count();
}
const count=()=>{const D=rd();$("show").textContent="Show "+all.filter(g=>ok(g,{...D,q:""})).length+" games"};
function clearGroup(k){if(k==="q")$("q").value="";else if(k==="d"){disc=null;$("dy").setAttribute("aria-pressed",false);$("dn").setAttribute("aria-pressed",false)}else{$(k+"a").value=0;$(k+"b").value=1000;sync(k)}}
const DL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 01.078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.079.009c.12.1.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>';
function openD(id){
  const g=all.find(x=>x.id==id);if(!g)return;
  const t=(g.likes||0)+(g.dislikes||0),p=t?Math.round(g.likes*100/t):null;
  const code=(g.discord||"").replace("https://","");
  $("sh").innerHTML=`<button class="x" id="mx" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
<div class="hd">${g.thumb?`<img src="${esc(g.thumb)}" alt="">`:esc((g.name.trim()[0]||"?").toUpperCase())}</div>
<div class="bd"><h3>${esc(g.name)}</h3><a class="play" href="https://www.roblox.com/games/${g.placeId}" target="_blank" rel="noopener">Play on Roblox ↗</a>
<div class="st"><div><span>Active</span><b class="lv">${(g.ccu||0).toLocaleString()}</b></div><div><span>Visits</span><b>${f(g.visits)}</b></div><div><span>Favorites</span><b>${f(g.favorites)}</b></div><div><span>Old</span><b>${age(g.created)}</b></div></div>
<div class="vote"><div><span style="font-size:.68rem;color:var(--mute);text-transform:uppercase;letter-spacing:.07em">Rating</span></div><div class="vb"><i style="width:${p??0}%"></i></div><div><span>👍 ${f(g.likes)}</span><span>${p==null?"No votes yet":p+"% liked"}</span><span>👎 ${f(g.dislikes)}</span></div></div>
<h4>Description</h4><div class="desc">${esc(g.description||"No description.")}</div>
<h4>Discord</h4>${linked(g)?`<div class="dsc">${DL}<div><b>DISCORD</b><span>${esc(g.server||"Discord server")}</span><small>${esc(code)}${g.members?" · "+f(g.members)+" members":""}</small></div><a class="join" href="${esc(g.discord)}" target="_blank" rel="noopener">Join</a></div>`
:`<div class="dsc">${DL}<div class="nl"><b>DISCORD</b><span>Not linked</span></div></div>`}</div>`;
  $("md").hidden=false;document.body.classList.add("mo");$("mx").focus();
}
const closeD=()=>{$("md").hidden=true;document.body.classList.remove("mo")};
const openF=on=>{document.body.classList.toggle("fo",on);setMenu(false);if(on)$("cx").focus()};
$("list").onclick=e=>{const b=e.target.closest(".sd");if(b)openD(b.dataset.id)};
$("md").onclick=e=>{if(e.target.closest("#mx")||e.target===$("md"))closeD()};
$("mf").onclick=()=>openF(true);$("cx").onclick=()=>openF(false);
$("ov").onclick=()=>{openF(false);closeD()};
document.onkeydown=e=>{if(e.key==="Escape"){openF(false);closeD();setMenu(false)}};
$("show").onclick=()=>{openF(false);F=rd();render()};
$("clr").onclick=()=>{["c","v","a","d"].forEach(clearGroup);count()};
function go(){F=rd();if(View!=="home"){location.hash="";return}render();$("res").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"auto":"smooth"})}
$("find").onclick=go;$("q").onkeydown=e=>{if(e.key==="Enter")go()};
$("act").onclick=e=>{const b=e.target.closest("button");if(b){clearGroup(b.dataset.k);F=rd();render()}};
$("mb").onclick=()=>setMenu($("menu").hidden);
$("menu").onclick=e=>{if(e.target.closest("a"))setMenu(false)};
addEventListener("hashchange",route);
document.addEventListener("click",e=>{const b=e.target.closest("[data-copy]");if(!b)return;const t=b.dataset.copy;
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{}).finally(()=>{b.textContent="Copied ✓";setTimeout(()=>b.textContent=t,1500)})});
const NAMES=["Cozy farming sim like Stardew","Horror co-op like Phasmophobia","Fun Survival Game","Steal a Brainrot","Steal an Egg","Brookhaven RP","Grow a Garden","Adopt Me!","Blox Fruits","Murder Mystery 2","Pet Simulator 99","Tower of Hell","Doors","Fisch","Dead Rails","Rivals","Blade Ball","Jailbreak","Arsenal","Piggy","Sol's RNG","King Legacy","99 Nights in the Forest"];
let ni=0,ci=0,del=false;
function typer(){const q=$("q");if(document.activeElement===q||q.value){setTimeout(typer,600);return}
  const w=NAMES[ni];let wait=del?35:80;
  if(!del){ci++;if(ci>=w.length){del=true;wait=1500}}else{ci--;if(ci<=0){del=false;ni=(ni+1)%NAMES.length;wait=350}}
  q.placeholder=w.slice(0,ci)+"▏";setTimeout(typer,wait)}
$("q").onfocus=()=>{$("q").placeholder="Search a game name"};
if(matchMedia("(prefers-reduced-motion:reduce)").matches)$("q").placeholder=NAMES[0];else typer();
async function live(){
  if(!API.startsWith("http")||!all.length)return;
  try{for(let i=0;i<all.length;i+=100){const part=all.slice(i,i+100);
    const r=await fetch(API+"?ids="+part.map(g=>g.id).join(","));
    ((await r.json()).data||[]).forEach(x=>{const g=part.find(p=>p.id===x.id);if(g){g.ccu=x.playing;g.visits=x.visits;if(x.favoritedCount!=null)g.favorites=x.favoritedCount}})}
    render()}catch(e){}}
setInterval(live,10000);
function setBounds(){if(!all.length)return;
  const R=fn=>{const v=all.map(fn);let lo=Math.floor(Math.min(...v)),hi=Math.ceil(Math.max(...v));if(hi<=lo)hi=lo+1;return[lo,hi]};
  B.c=R(g=>g.ccu);B.v=R(g=>g.visits);B.a=R(g=>days(g.created));G.forEach(([k])=>sync(k))}
// show saved games instantly, then refresh from the server
try{const c=localStorage.getItem("rgf");if(c){all=JSON.parse(c);setBounds();F=rd();route()}}catch(e){}
fetch("games.json",{cache:"no-cache"}).then(r=>r.json()).then(d=>{all=d;try{localStorage.setItem("rgf",JSON.stringify(d))}catch(e){}setBounds();F=rd();route();live()})
 .catch(()=>{if(!all.length)$("list").innerHTML='<div class="empty">games.json not found yet. Run the GitHub Action first.</div>'});
