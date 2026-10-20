/* Clinicos prototype engine: icons, state, components, shells, router */
(function(){
'use strict';
const OS=window.OS={pages:{},titles:{},M:{},A:{},init:{}};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
OS.$=$;OS.$$=$$;
const B=document.body,ROOT=B.dataset.root||'',AREA=B.dataset.area,ROUTE=B.dataset.route;
OS.root=ROOT;OS.area=AREA;OS.route=ROUTE;
function useCleanUrls(){if(typeof location!=='undefined'&&location.protocol==='file:')return false;if(B&&B.dataset.live==='1')return true;if(!ROOT)return true;return false}
const U=OS.U=(r)=>{if(/^(https?:|#|mailto:|tel:)/.test(r))return r;let h='',q='';if(r.includes('#')){[r,h]=r.split('#');h='#'+h}if(r.includes('?')){[r,q]=r.split('?');q='?'+q}if(useCleanUrls()){if(!r)return '/'+q+h;let path=r.replace(/\/?$/,'/');if(!path.startsWith('/'))path='/'+path;return path+q+h}return ROOT+(r?r.replace(/\/?$/,'/')+'index.html':'index.html')+q+h};
/* state */
const mem={};
const S=OS.S={get(k,d){try{const v=localStorage.getItem('cl_'+k);return v===null?(k in mem?mem[k]:d):JSON.parse(v)}catch(e){return k in mem?mem[k]:d}},set(k,v){mem[k]=v;try{localStorage.setItem('cl_'+k,JSON.stringify(v))}catch(e){}}};
const qs=new URLSearchParams(location.search);
if(qs.get('role'))S.set('role',qs.get('role'));
OS.role=()=>S.get('role','owner');
document.documentElement.dataset.theme=S.get('theme','light');
const esc=OS.esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* icons */
const P={
home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
userplus:'<circle cx="10" cy="8" r="4"/><path d="M2.5 21c0-4 3.4-7 7.5-7"/><path d="M19 9v6M16 12h6"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
chat:'<path d="M21 12a8 8 0 01-11.5 7.2L4 20l1.1-4.4A8 8 0 1121 12z"/>',
phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
heart:'<path d="M12 20s-7.5-4.6-9-9.5A4.8 4.8 0 0112 6.4a4.8 4.8 0 019 4.1C19.5 15.4 12 20 12 20z"/>',
door:'<path d="M5 21V4a1 1 0 011-1h9a1 1 0 011 1v17M3 21h18"/><path d="M12 12h.01"/>',
sparkles:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
card:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
bell:'<path d="M6 17v-6a6 6 0 1112 0v6l2 2H4z"/><path d="M10 21a2 2 0 004 0"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="M5 12.5l4.5 4.5L19 7"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
chevR:'<path d="M9 6l6 6-6 6"/>',chevD:'<path d="M6 9l6 6 6-6"/>',chevL:'<path d="M15 6l-6 6 6 6"/>',
menu:'<path d="M4 7h16M4 12h16M4 17h10"/>',
logout:'<path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/>',
pin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
file:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
flask:'<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9V3"/><path d="M7.5 15h9"/>',
pill:'<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M9.5 9.5l5 5"/>',
video:'<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3"/>',
box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
lock:'<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 018 0v3"/>',
star:'<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8z"/>',
send:'<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
dots:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
dl:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
bolt:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
clip:'<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>',
tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
arrowUp:'<path d="M12 19V5M6 11l6-6 6 6"/>',arrowR:'<path d="M5 12h14M13 6l6 6-6 6"/>',
refresh:'<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>',
dollar:'<path d="M12 3v18M16.5 7.5C15.5 6 14 5.5 12 5.5 9.6 5.5 8 6.8 8 8.5c0 4 8.5 2 8.5 6.5 0 1.8-1.8 3-4.5 3-2.2 0-4-.8-5-2.5"/>',
layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
play:'<path d="M7 4l13 8-13 8z"/>',
thermo:'<path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 115 1c-.8.8-2 1.2-2 2.8M12 17h.01"/>',
sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
zap:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
server:'<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
megaphone:'<path d="M3 11v3a1 1 0 001 1h3l7 4V6L7 10H4a1 1 0 00-1 1zM18 9a4 4 0 010 6"/>',
mapPin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
wifi:'<path d="M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0M12 19.5h.01"/>',
logo:'<path d="M3 12h4l2.2-6 4 12 2.2-6H21"/>'
};
const ic=OS.ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||P.dots}</svg>`;
const LOGO=`<span class="logo"><svg viewBox="0 0 24 24"><path d="M3 12h4l2.2-6 4 12 2.2-6H21"/></svg></span>`;
OS.LOGO=LOGO;
/* toast / modal */
OS.toast=(m,i='check')=>{let w=$('.toasts');if(!w){w=document.createElement('div');w.className='toasts';B.appendChild(w)}const t=document.createElement('div');t.className='toast';t.innerHTML=ic(i)+esc(m);w.appendChild(t);setTimeout(()=>{t.style.transition='all .3s';t.style.opacity=0;t.style.transform='translateY(10px)';setTimeout(()=>t.remove(),300)},2600)};
OS.modal=(t,body,foot,wide)=>{OS.close();const m=document.createElement('div');m.className='mo';m.innerHTML=`<div class="md ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(t)}"><div class="mh"><h3>${t}</h3><button class="btn gh sm ic" data-close aria-label="Close">${ic('x')}</button></div><div class="mbd">${body}</div>${foot?`<div class="mf">${foot}</div>`:''}</div>`;m.addEventListener('click',e=>{if(e.target===m)OS.close()});B.appendChild(m);const f=$('input,select,textarea',m);f&&f.focus();return m};
OS.close=()=>{$$('.mo,.pal').forEach(x=>{if(x.id!=='dma-demo-dialog')x.remove()})};
/* components */
const AVC=['','c1','c2','c3','c4'];
OS.av=(n,c,sz='')=>{const w=n.split(/\s+/).filter(Boolean);const i=(w[0]?.[0]||'')+(w[1]?.[0]||'');const k=c??([...n].reduce((a,x)=>a+x.charCodeAt(0),0)%5);return `<span class="av ${AVC[k]} ${sz}">${i.toUpperCase()}</span>`};
const ST={PENDING:['Pending','warn','clock'],CONFIRMED:['Confirmed','info','check'],ARRIVED:['Arrived','ok','pin'],CALLED:['Called','vio','bell'],IN_PROGRESS:['In consultation','ok','pulse'],COMPLETED:['Completed','ok','check'],CANCELLED:['Cancelled','bad','x'],NO_SHOW:['No-show','bad','alert'],
PAID:['Paid','ok','check'],UNPAID:['Unpaid','warn','clock'],OVERDUE:['Overdue','bad','alert'],ACTIVE:['Active','ok','check'],TRIAL:['Trial','info','clock'],SUSPENDED:['Suspended','bad','alert'],PAST_DUE:['Past due','warn','alert'],OPEN:['Open','info','chat'],AI:['AI replied','vio','sparkles'],HUMAN:['Needs human','warn','user'],RESOLVED:['Resolved','ok','check'],CONNECTED:['Connected','ok','wifi'],DISCONNECTED:['Not connected','warn','wifi'],PUBLISHED:['Published','ok','check'],DRAFT:['Draft','warn','edit'],INVITED:['Invited','info','mail'],OWNER:['Owner','vio','key'],HOT:['Hot lead','bad','bolt'],NEW:['New','info','star'],UP:['Up','ok','check'],DOWN:['Down','bad','x'],LOW:['Low stock','warn','alert'],INSTOCK:['In stock','ok','check'],APPROVED:['Approved','ok','check'],REQUESTED:['Requested','warn','clock'],DONE:['Done','ok','check'],TODO:['To do','neu','clip'],READY:['Ready','ok','check'],ORDERED:['Ordered','info','flask'],SENT:['Sent','ok','send'],SCHEDULED:['Scheduled','info','clock'],FREE:['Free','ok','check'],OCCUPIED:['Occupied','vio','users'],CLEANING:['Cleaning','warn','refresh']};
OS.chip=(s,label)=>{const x=ST[s]||[label||s,'neu','info'];return `<span class="chip ${x[1]}">${ic(x[2])}${esc(label||x[0])}</span>`};
OS.kpi=(l,v,i,href,t='',sub='')=>`<a class="card kpi hv rv ${t}" ${href?`href="${U(href)}"`:''}><span class="ico">${ic(i)}</span><div><div class="v" ${/^\d+$/.test(String(v))?`data-count="${v}"`:''}>${v}</div><div class="l">${l}</div>${sub?`<div class="xs mut" style="margin-top:4px">${sub}</div>`:''}</div></a>`;
OS.card=(t,body,act='',cls='',sub='')=>`<section class="card ${cls}">${t?`<div class="ch"><div><h3>${t}</h3>${sub?`<div class="sub">${sub}</div>`:''}</div>${act}</div>`:''}${body}</section>`;
OS.empty=(t,p,act='',i='search')=>`<div class="empty"><span class="eic">${ic(i)}</span><b>${t}</b><p>${p}</p>${act}</div>`;
OS.head=(d,acts='')=>`<div class="ph"><div><h2 class="rv">${d[0]}</h2><p class="rv" style="--d:60ms">${d[1]}</p></div><div class="row wrap rv" style="--d:100ms">${acts}</div></div>`;
OS.tbl=(cols,rows,o={})=>`<div class="tw"><table class="t"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{const go=Array.isArray(r)?null:r.go;const cells=Array.isArray(r)?r:r.c;return `<tr ${go?`data-go="${go}"`:''}>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`}).join('')}</tbody></table></div>`;
OS.field=(l,inp)=>`<div class="field"><label>${l}</label>${inp}</div>`;
OS.inp=(ph='',v='',t='text',x='')=>`<input class="inp" type="${t}" placeholder="${ph}" value="${v}" ${x}>`;
OS.sel=(opts,v)=>`<select class="sel">${opts.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('')}</select>`;
OS.sw=(on,k='')=>`<span class="sw ${on?'on':''}" role="switch" tabindex="0" aria-checked="${!!on}" data-sw="${k}"></span>`;
OS.btn=(t,o={})=>`<${o.href?'a':'button'} class="btn ${o.c||'gh'}" ${o.href?`href="${U(o.href)}"`:''} ${o.act?`data-act="${o.act}"`:''} ${o.t?`data-toast="${esc(o.t)}"`:''} ${o.m?`data-open="${o.m}"`:''}>${o.i?ic(o.i):''}${t}</${o.href?'a':'button'}>`;
OS.tabs=(id,list,act=0)=>`<div class="pills" role="tablist">${list.map((t,i)=>`<button role="tab" class="${i===act?'on':''}" data-tab="${id}:${i}">${t[1]?ic(t[1]):''}${t[0]}</button>`).join('')}</div>`;
OS.panel=(id,i,html,act=0)=>`<div class="panel ${i===act?'on':''}" data-panel="${id}:${i}">${html}</div>`;
OS.wtabs=(list,cur)=>`<div class="pills rv">${list.map(t=>`<a href="${U(t[1])}" class="${t[1]===cur?'on':''}">${t[2]?ic(t[2]):''}${t[0]}</a>`).join('')}</div>`;
OS.prog=(p)=>`<div class="pbar"><i style="width:${p}%"></i></div>`;
OS.line=(v,w=520,h=190,col)=>{const mx=Math.max(...v)*1.15||1,st=(w-16)/(v.length-1);const pts=v.map((y,i)=>[8+i*st,h-14-(y/mx)*(h-34)]);let d='M'+pts[0].join(' ');for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],cx=(a[0]+b[0])/2;d+=` C${cx} ${a[1]} ${cx} ${b[1]} ${b[0]} ${b[1]}`}return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Trend chart"><defs><linearGradient id="lg${v.length}${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14967F" stop-opacity=".28"/><stop offset="1" stop-color="#14967F" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map(i=>`<line x1="0" x2="${w}" y1="${10+i*(h-34)/3}" y2="${10+i*(h-34)/3}" stroke="var(--line)" stroke-dasharray="4 5"/>`).join('')}<path d="${d} L${w} ${h} L0 ${h}Z" fill="url(#lg${v.length}${h})"/><path class="ln" d="${d}" ${col?`style="stroke:${col}"`:''}/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--card)" stroke="var(--teal)" stroke-width="2.4"/>`).join('')}</svg>`};
OS.bars=(v,l)=>{const mx=Math.max(...v)||1;return `<div class="bar">${v.map((y,i)=>`<div><b style="color:var(--ink2);font-size:11.5px">${y}</b><i style="height:${Math.max(6,y/mx*100)}%;--d:${i*70}ms"></i><span>${l[i]}</span></div>`).join('')}</div>`};
OS.donut=(parts,size=150)=>{const tot=parts.reduce((a,p)=>a+p[1],0),r=52,c=2*Math.PI*r;let off=0;const cols=['#14967F','#3DC3A8','#1A56A8','#8A5200','#5E35B1'];return `<div class="row" style="gap:22px;flex-wrap:wrap"><svg class="donut" width="${size}" height="${size}" viewBox="0 0 140 140" role="img" aria-label="Distribution"><g transform="rotate(-90 70 70)"><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bg2)" stroke-width="20"/>${parts.map((p,i)=>{const len=p[1]/tot*c;const e=`<circle cx="70" cy="70" r="${r}" fill="none" stroke="${cols[i%5]}" stroke-width="20" stroke-dasharray="${len-2} ${c}" stroke-dashoffset="${-off}"/>`;off+=len;return e}).join('')}</g></svg><div class="col" style="gap:8px">${parts.map((p,i)=>`<div class="row sm"><i class="dot" style="background:${cols[i%5]}"></i><span class="b">${p[0]}</span><span class="mut">${p[1]}</span></div>`).join('')}</div></div>`};
/* data (clearly sample) */
const D=OS.D={
patients:[['p-1042','Ayesha Raza','F',34,'+92 300 1234567','Dr. Hina Malik','Today 09:30'],['p-1043','Bilal Ahmed','M',47,'+92 321 5550142','Dr. Omar Siddiqui','Today 10:00'],['p-1044','Sana Iqbal','F',29,'+92 333 7788210','Dr. Hina Malik','Today 10:30'],['p-1045','Usman Tariq','M',52,'+92 345 6612099','Dr. Rabia Noor','Today 11:15'],['p-1046','Mariam Khan','F',8,'+92 301 4400781','Dr. Omar Siddiqui','Today 11:45'],['p-1047','Hamza Sheikh','M',38,'+92 312 9087765','Dr. Hina Malik','Today 14:00'],['p-1048','Zara Aslam','F',61,'+92 322 1100456','Dr. Rabia Noor','Today 14:30'],['p-1049','Faisal Mehmood','M',44,'+92 300 7765123','Dr. Omar Siddiqui','Tomorrow 09:00']],
appts:[['09:30','Ayesha Raza','Follow-up','Dr. Hina Malik','COMPLETED','Room 1'],['10:00','Bilal Ahmed','New consultation','Dr. Omar Siddiqui','IN_PROGRESS','Room 2'],['10:30','Sana Iqbal','Check-up','Dr. Hina Malik','CALLED','Room 1'],['11:15','Usman Tariq','Lab review','Dr. Rabia Noor','ARRIVED','—'],['11:45','Mariam Khan','Vaccination','Dr. Omar Siddiqui','ARRIVED','—'],['14:00','Hamza Sheikh','Consultation','Dr. Hina Malik','CONFIRMED','—'],['14:30','Zara Aslam','Follow-up','Dr. Rabia Noor','PENDING','—'],['15:15','Faisal Mehmood','Consultation','Dr. Omar Siddiqui','CANCELLED','—']],
staff:[['Sadia Karim','Receptionist','RECEPTIONIST','sadia@noorclinic.example','ACTIVE'],['Kamran Ali','Nurse','NURSE','kamran@noorclinic.example','ACTIVE'],['Nida Fatima','Manager','MANAGER','nida@noorclinic.example','ACTIVE'],['Talha Javed','Assistant','ASSISTANT','talha@noorclinic.example','INVITED']],
doctors:[['Dr. Hina Malik','General practice','Owner'],['Dr. Omar Siddiqui','Internal medicine','Practitioner'],['Dr. Rabia Noor','Dermatology','Practitioner']],
clinics:[['c-201','Noor Family Clinic','Dr. Hina Malik','Multan','Pro','ACTIVE',true,true],['c-202','Smile Craft Dental','Dr. Adeel Raza','Lahore','Starter','TRIAL',true,false],['c-203','Move Well Physio','Dr. Sobia Anwar','Karachi','Pro','ACTIVE',false,false],['c-204','Skin Studio Aesthetics','Dr. Fatima Zia','Islamabad','Enterprise','ACTIVE',true,true],['c-205','City Specialists','Dr. Imran Qureshi','Faisalabad','Starter','PAST_DUE',false,false]]
};
OS.CLINIC='Noor Family Clinic';
/* workspaces */
const WS=OS.WS={
sched:[['Calendar','dashboard/calendar','calendar'],['Appointments','dashboard/appointments','clip']],
comm:[['Inbox','dashboard/messages','chat'],['WhatsApp','dashboard/whatsapp','phone'],['Broadcasts','dashboard/broadcasts','megaphone']],
care:[['Consultations','dashboard/clinical','pulse'],['Vitals','dashboard/vitals','thermo'],['Prescriptions','dashboard/prescriptions','pill'],['Laboratory','dashboard/laboratory','flask'],['Documents','dashboard/documents','file']],
team:[['Team','dashboard/staff','users'],['Doctors','dashboard/doctors','heart']],
ops:[['Rooms','dashboard/rooms','door'],['Inventory','dashboard/inventory','box'],['Leave','dashboard/leave','calendar'],['Telemedicine','dashboard/telemedicine','video']],
ins:[['Analytics','dashboard/analytics','chart'],['Reports','dashboard/reports','file'],['Reviews','dashboard/reviews','star']],
setup:[['Settings','dashboard/settings','gear'],['Billing','dashboard/billing','card'],['Locations','dashboard/locations','pin']],
sa_c:[['Clinics','superadmin/clinics','building'],['Users','superadmin/users','users']],
sa_b:[['Billing','superadmin/subscriptions','card'],['Plans','superadmin/stripe','layers'],['Analytics','superadmin/revenue','chart']],
sa_w:[['WhatsApp','superadmin/whatsapp','phone'],['Announcements','superadmin/announcements','megaphone'],['Support','superadmin/support','help']],
sa_s:[['Settings','superadmin/settings','gear'],['Security','superadmin/security','shield'],['Health','superadmin/health','pulse'],['Audit','superadmin/audit','clip'],['Integrations','superadmin/integrations','link'],['API','superadmin/api','key']]
};
const wsOf=r=>Object.keys(WS).find(k=>WS[k].some(t=>t[1]===r));
OS.wsOf=wsOf;
/* nav */
const NAV={
owner:[['Clinic',[['Dashboard','dashboard','home'],['Patients','dashboard/patients','users']]],['Front desk',[['Schedule','dashboard/appointments','calendar'],['Waiting Room','dashboard/waiting','clock'],['Inbox','dashboard/messages','chat',3],['WhatsApp','dashboard/whatsapp','phone']]],['Care',[['Consultations','dashboard/clinical','pulse']]],['Practice',[['Team','dashboard/staff','users'],['Operations','dashboard/rooms','door']]],['Grow',[['AI Receptionist','dashboard/ai','sparkles'],['Analytics','dashboard/analytics','chart']]],['Setup',[['Settings','dashboard/settings','gear']]]],
RECEPTIONIST:[['Clinic',[['Home','dashboard','home'],['Appointments','dashboard/appointments','calendar'],['Calendar','dashboard/calendar','clip']]],['Front desk',[['Patients','dashboard/patients','users'],['Waiting','dashboard/waiting','clock'],['Payments','dashboard/payments','dollar'],['Inbox','dashboard/messages','chat',3]]]],
NURSE:[['Care',[['Home','dashboard','home'],['Patients','dashboard/patients','users'],['Waiting','dashboard/waiting','clock'],['Vitals','dashboard/vitals','thermo'],['Consultations','dashboard/clinical','pulse'],['Schedule','dashboard/appointments','calendar']]]],
MANAGER:[['Clinic',[['Home','dashboard','home'],['Appointments','dashboard/appointments','calendar'],['Patients','dashboard/patients','users'],['Doctors','dashboard/doctors','heart']]],['Practice',[['Team','dashboard/staff','users'],['Operations','dashboard/operations','door'],['Reports','dashboard/reports','file']]]],
ASSISTANT:[['Clinic',[['Home','dashboard','home'],['Appointments','dashboard/appointments','calendar'],['Patients','dashboard/patients','users'],['Tasks','dashboard/tasks','clip'],['Inbox','dashboard/messages','chat',3]]]]
};
NAV.owner[0][1][0][1]='dashboard';
const SA_NAV=[['Platform',[['Overview','superadmin','home'],['Clinics','superadmin/clinics','building'],['Users','superadmin/users','users']]],['Business',[['Billing','superadmin/subscriptions','card']]],['Operations',[['WhatsApp','superadmin/whatsapp','phone']]],['System',[['Settings','superadmin/settings','gear']]]];
const OWNER_ONLY=['whatsapp','broadcasts','ai','analytics','reviews','billing','settings','rooms','inventory','telemedicine','laboratory','prescriptions','locations'].map(x=>'dashboard/'+x);
const ALLOW={RECEPTIONIST:['dashboard','appointments','calendar','patients','patients/p-1042','waiting','payments','messages','notifications','documents'],NURSE:['dashboard','patients','patients/p-1042','waiting','vitals','clinical','appointments','notifications','documents','consult'],MANAGER:['dashboard','appointments','calendar','patients','patients/p-1042','doctors','staff','operations','leave','reports','notifications'],ASSISTANT:['dashboard','appointments','patients','patients/p-1042','tasks','messages','notifications']};
OS.ROLES={owner:'Owner',RECEPTIONIST:'Receptionist',NURSE:'Nurse',MANAGER:'Manager',ASSISTANT:'Assistant'};
const allowed=(r,role)=>{if(role==='owner')return true;if(OWNER_ONLY.includes(r))return false;return (ALLOW[role]||[]).includes(r.replace('dashboard/',''))||r==='dashboard'};
const flat=a=>a.flatMap(g=>g[1]);
OS.palette=()=>AREA==='admin'?[...flat(SA_NAV),...WS.sa_c,...WS.sa_b,...WS.sa_w,...WS.sa_s]:[...flat(NAV[OS.role()]||NAV.owner),...Object.values(WS).filter(w=>w[0][1].startsWith('dashboard')).flat(),['Notifications','dashboard/notifications','bell'],['Payments','dashboard/payments','dollar'],['Tasks','dashboard/tasks','clip']];
/* shell */
function navHtml(groups,cur){const w=wsOf(cur),all=groups.flatMap(g=>g[1]),exact=all.some(x=>x[1]===cur),firstWs=w&&all.find(x=>wsOf(x[1])===w);return groups.map(g=>`<div class="rg">${g[0]}</div>`+g[1].map(i=>{const on=i[1]===cur||(!exact&&firstWs===i)||(i[1].includes('/')&&cur.startsWith(i[1]+'/'));return `<a class="ri ${on?'on':''}" href="${U(i[1])}" ${on?'aria-current="page"':''}>${ic(i[2])}<span>${i[0]}</span>${i[3]?`<em class="bg">${i[3]}</em>`:''}</a>`}).join('')).join('')}
function tray(){return `<div class="tray"><button aria-label="Prototype tools" data-act="tray">${ic('sliders')}</button><div class="box"><h4>Prototype tools</h4><div class="field"><label>View as</label><select class="sel" data-act="role">${Object.entries(OS.ROLES).map(([k,v])=>`<option value="${k}" ${OS.role()===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="sm b">WhatsApp connected</span>${OS.sw(S.get('wa',true),'wa')}</div><div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="sm b">AI published</span>${OS.sw(S.get('ai',true),'ai')}</div><div class="field"><label>Plan</label><select class="sel" data-act="plan">${['Starter','Pro','Enterprise'].map(p=>`<option ${S.get('plan','Pro')===p?'selected':''}>${p}</option>`).join('')}</select></div><div class="xs mut">Sample data only. These switches change this prototype, not a live clinic.</div></div></div>`}
function foot(){return `<footer class="foot"><span>© Clinicos · Doctors My Agency · 2026</span><span class="row" style="gap:16px"><a href="${U('privacy')}">Privacy</a><a href="${U('terms')}">Terms</a><a href="${U('security')}">Security</a></span></footer>`}
function dockHtml(groups,cur){const it=flat(groups).slice(0,4);return `<nav class="dock" aria-label="Quick links">${it.map(i=>`<a href="${U(i[1])}" class="${i[1]===cur?'on':''}">${ic(i[2])}${i[0].split(' ')[0]}</a>`).join('')}<button data-act="menu">${ic('menu')}More</button></nav>`}
function clinicShell(title,body){
 const role=OS.role(),groups=NAV[role]||NAV.owner,wa=S.get('wa',true),isO=role==='owner';
 return `<div class="app"><aside class="rail" id="rail" aria-label="Main navigation"><div class="rb">${LOGO}<div><b>Clinicos</b><small>${OS.CLINIC}</small></div></div><nav class="rnav">${navHtml(groups,ROUTE)}</nav>${isO?`<div class="rf"><div class="plan"><small>Current plan</small><b>${S.get('plan','Pro')}</b><a class="btn" href="${U('dashboard/billing')}">Manage subscription</a></div></div>`:`<div class="rf"><div class="plan"><small>Signed in as</small><b>${OS.ROLES[role]}</b><a class="btn" href="${U('staff-login')}">Switch account</a></div></div>`}</aside><div class="scrim" data-act="scrim"></div>
 <div class="main"><header class="tb"><button class="tbtn hb" data-act="menu" aria-label="Open menu">${ic('menu')}</button><h1>${title}</h1><div class="sp"></div><div class="tbs">${isO?`<a class="tbtn wachip ${wa?'':'off'} hide-m" href="${U('dashboard/whatsapp')}">${ic('phone')}<span>WhatsApp ${wa?'connected':'not connected'}</span></a>`:''}<button class="tbtn srch" data-act="pal" aria-label="Search pages">${ic('search')}<span>Search pages</span><kbd>Ctrl K</kbd></button><a class="tbtn" href="${U('dashboard/notifications')}" aria-label="Updates">${ic('bell')}<em class="nb">4</em></a><button class="tbtn" data-act="theme" aria-label="Toggle theme">${ic(S.get('theme','light')==='dark'?'sun':'moon')}</button><a class="btn pri bk" href="${U('dashboard/appointments')}?action=book" style="height:40px">${ic('plus')}<span>Book</span></a><a class="uchip" href="${U('dashboard/settings')}?tab=profile" title="Profile">${OS.av(isO?'Hina Malik':'Sadia Karim',null)}<span>${isO?'Dr. Hina Malik':OS.ROLES[role]}</span></a><a class="tbtn hide-m" href="${U(isO?'doctor-login':'staff-login')}" aria-label="Logout">${ic('logout')}</a></div></header><main class="pg" id="pg">${body}</main>${foot()}</div>${dockHtml(groups,ROUTE)}${tray()}</div>`}
function adminShell(title,body){
 return `<div class="app"><aside class="rail" id="rail" aria-label="Main navigation"><div class="rb">${LOGO}<div><b>Control Center</b><small>Doctors My Agency</small></div></div><nav class="rnav">${navHtml(SA_NAV,ROUTE)}</nav><div class="rf"><div class="plan"><small>Platform process</small><b><i class="dot live"></i> API reachable</b><a class="btn" href="${U('superadmin/health')}">Open health</a></div></div></aside><div class="scrim" data-act="scrim"></div><div class="main"><header class="tb"><button class="tbtn hb" data-act="menu" aria-label="Open menu">${ic('menu')}</button><h1>${title}</h1><div class="sp"></div><div class="tbs"><button class="tbtn srch" data-act="pal">${ic('search')}<span>Search pages</span><kbd>Ctrl K</kbd></button><button class="tbtn" data-act="theme" aria-label="Toggle theme">${ic(S.get('theme','light')==='dark'?'sun':'moon')}</button><a class="tbtn" href="${U('admin-login')}" aria-label="Logout">${ic('logout')}</a></div></header><main class="pg" id="pg">${body}</main>${foot()}</div>${dockHtml(SA_NAV,ROUTE)}</div>`}
/* page registry */
OS.reg=(route,title,fn)=>{OS.pages[route]=fn;OS.titles[route]=title};
/* handlers */
const H={
tray(){$('.tray').classList.toggle('on')},
menu(){$('#rail')?.classList.toggle('open');$('.scrim')?.classList.toggle('on',$('#rail')?.classList.contains('open'))},
scrim(){$('#rail')?.classList.remove('open');$('.scrim')?.classList.remove('on')},
theme(){const t=S.get('theme','light')==='dark'?'light':'dark';S.set('theme',t);document.documentElement.dataset.theme=t;OS.toast(t==='dark'?'Dark theme on':'Light theme on','moon')},
role(el){S.set('role',el.value);location.href=U('dashboard')},
plan(el){S.set('plan',el.value);OS.toast('Plan set to '+el.value)},
pal(){openPal()}
};
OS.A=Object.assign(H,OS.A);
function openPal(){OS.close();const items=OS.palette();const p=document.createElement('div');p.className='pal';p.innerHTML=`<div class="bx"><input placeholder="Search pages" aria-label="Search pages"><div class="ls"></div></div>`;p.addEventListener('click',e=>{if(e.target===p)OS.close()});B.appendChild(p);const inp=$('input',p),ls=$('.ls',p);let sel=0,cur=items;const draw=()=>{ls.innerHTML=cur.length?cur.map((i,k)=>`<a class="${k===sel?'sel':''}" href="${U(i[1])}">${ic(i[2]||'chevR')}${i[0]}<span class="sp"></span><span class="xs mut">${i[1].replace(/^(dashboard|superadmin)\/?/,'')||'home'}</span></a>`).join(''):OS.empty('No pages match','Try another word.')};draw();inp.focus();inp.addEventListener('input',()=>{cur=items.filter(i=>i[0].toLowerCase().includes(inp.value.toLowerCase()));sel=0;draw()});inp.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){sel=Math.min(sel+1,cur.length-1);draw();e.preventDefault()}if(e.key==='ArrowUp'){sel=Math.max(sel-1,0);draw();e.preventDefault()}if(e.key==='Enter'&&cur[sel])location.href=U(cur[sel][1])})}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&(AREA==='clinic'||AREA==='admin')){e.preventDefault();openPal()}if(e.key==='Escape')OS.close()});
document.addEventListener('click',e=>{
 const t=e.target;
 const b=t.closest('.btn');if(b&&!b.querySelector('.rip')){const r=document.createElement('span');r.className='rip';const bb=b.getBoundingClientRect();const s=Math.max(bb.width,bb.height);r.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-bb.left-s/2}px;top:${e.clientY-bb.top-s/2}px`;b.appendChild(r);setTimeout(()=>r.remove(),600)}
 let el;
 if(el=t.closest('[data-close]')){if(el.dataset.toast)OS.toast(el.dataset.toast);OS.close();return}
 if(el=t.closest('[data-act]')){const f=OS.A[el.dataset.act];if(f&&el.tagName!=='SELECT'){f(el,e);}return}
 if(el=t.closest('[data-open]')){const f=OS.M[el.dataset.open];if(f)f(el);return}
 if(el=t.closest('[data-tab]')){const[g,i]=el.dataset.tab.split(':');$$(`[data-tab^="${g}:"]`).forEach(x=>x.classList.toggle('on',x===el));$$(`[data-panel^="${g}:"]`).forEach(x=>x.classList.toggle('on',x.dataset.panel===el.dataset.tab));return}
 if(el=t.closest('[data-sw]')){el.classList.toggle('on');el.setAttribute('aria-checked',el.classList.contains('on'));const k=el.dataset.sw;if(k==='wa'||k==='ai'){S.set(k,el.classList.contains('on'));OS.toast((k==='wa'?'WhatsApp ':'AI ')+(el.classList.contains('on')?'on':'off'));setTimeout(()=>location.reload(),500)}return}
 if(el=t.closest('[data-toast]')){OS.toast(el.dataset.toast);if(!el.dataset.keep&&el.closest('.mo')&&el.dataset.close!==undefined)OS.close();return}
 if(el=t.closest('tr[data-go],[data-go]')){if(!t.closest('a,button,input,select'))location.href=U(el.dataset.go);return}
});
document.addEventListener('change',e=>{const el=e.target.closest('select[data-act]');if(el&&OS.A[el.dataset.act])OS.A[el.dataset.act](el)});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.sw')){e.preventDefault();e.target.click()}});
/* post render */
OS.post=(root=document)=>{
 const io=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}}),{threshold:.08,rootMargin:'0px 0px -30px 0px'});
 $$('.rv',root).forEach((el,i)=>{if(!el.style.getPropertyValue('--d')&&el.closest('.grid,.bento,.pr,.steps3'))el.style.setProperty('--d',(Array.prototype.indexOf.call(el.parentNode.children,el)%6)*70+'ms');io.observe(el)});
 setTimeout(()=>$$('.rv:not(.in)',root).forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight)el.classList.add('in')}),60);
 $$('[data-count]',root).forEach(el=>{const to=+el.dataset.count,t0=performance.now();const step=n=>{const p=Math.min(1,(n-t0)/900);el.textContent=Math.round(to*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
 $$('.pbar i',root).forEach(i=>{const w=i.style.width;i.style.width='0';setTimeout(()=>i.style.width=w,80)});
};
/* boot */
OS.boot=()=>{
 const app=$('#app');if(!app)return;
 if(AREA==='clinic'||AREA==='admin'){
  const fn=OS.pages[ROUTE];const title=OS.titles[ROUTE]||'Clinicos';document.title=title+' · Clinicos';
  if(AREA==='clinic'&&!allowed(ROUTE,OS.role())){location.replace(U('dashboard')+'?gate=1');return}
  const body=fn?fn():OS.empty('Page not found','This route is not part of the prototype.');
  app.innerHTML=(AREA==='admin'?adminShell:clinicShell)(title,body);
  if(qs.get('gate'))OS.toast('That page is for the clinic owner','lock');
  OS.post(app);const f=OS.init[ROUTE];f&&f();
 }else{
  const fn=OS.pages[ROUTE];document.title=(OS.titles[ROUTE]||'Clinicos')+' · Clinicos';
  app.innerHTML=fn?fn():'';OS.post(app);const f=OS.init[ROUTE];f&&f();
 }
};
OS.clinicShell=clinicShell;OS.adminShell=adminShell;OS.allowedRoute=allowed;
window.addEventListener('DOMContentLoaded',()=>{if(document.body.dataset.live==='1')return;setTimeout(OS.boot,0);});
})();
