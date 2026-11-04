/* Tabellone Live · util.js — Funzioni di servizio, parametri dell'indirizzo, normalizzazione delle gare
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= utilità ================= */
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const P = new URLSearchParams(location.search);
const GARA = (P.get("gara")||"").replace(/[^a-z0-9-]/gi,"").toLowerCase();
const REGIA = P.has("regia") || location.hash==="#regia";
const pageURL = q => (PUBLIC_URL || (/^https?:/.test(location.protocol) ? location.origin + location.pathname : "")) + q;
const slug = t => String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30);
const fmtTime = ts => new Date(ts).toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Rome"});
const fmtDate = d => { try{ return new Date(d+"T12:00:00").toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"}); }catch(e){ return d; } };
const today = () => new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Rome"});
const arr = v => Array.isArray(v) ? v : (v && typeof v==="object" ? Object.keys(v).sort((a,b)=>a-b).map(k=>v[k]) : []);

/* Firebase toglie le liste vuote e trasforma gli array: si ricompone lo stato */
function normalize(st){
  if(!st || typeof st!=="object") return null;
  const f = FORMULE[st.formula] || FORMULE.base;
  st.home = Object.assign({name:"",city:""}, st.home); st.away = Object.assign({name:"",city:"",badge:""}, st.away);
  st.inCorso = arr(st.inCorso).map(Number);
  if(f.torneo){
    st.gioco = st.gioco==="Coppia" ? "Coppia" : "Singolo";
    if(!st.formato && st.spec && st.target) st.formato = st.spec + " a " + st.target;   /* tornei creati prima dei set */
    st.formule = arr(st.formule).filter(Boolean).map(normFormula);
    if(!st.formule.length){ const p = parseFormato(st.formato);   /* tornei creati con la formula scritta a testo */
      st.formule = [normFormula(p.sets ? {nome:"Normale", n:p.sets.length, sets:p.sets.map(d=>d.opts ? {scelta:true} : d)} : FB_NUOVA, 0)]; }
    st.formato = ""; delete st.spec; delete st.target;
    const n = st.gioco==="Coppia" ? 2 : 1; let mx = 0;
    st.matches = arr(st.matches).filter(Boolean).map((m,i)=>{
      const id = Number.isInteger(m.id) ? m.id : i+1; mx = Math.max(mx, id);
      let fm = m.formato || "";
      if(!fm && !m.fr && !m.ss && m.spec && m.target) fm = m.spec + " a " + m.target;
      const fr = m.fr && findFormula(st, m.fr) ? findFormula(st, m.fr).nome : "";
      if(fr) fm = "";
      const defs = defsFor(st, {fr, formato:fm});
      const ssIn = arr(m.ss).map(arr); if(!m.ss && m.s) ssIn[0] = arr(m.s);
      const chIn = arr(m.ch);
      const x = {id, tid:m.tid||"", turno:m.turno||"", bil:String(m.bil||""), kind:st.gioco, formato:fm, fr, pts:1,
        h:Array.from({length:n},(_,j)=>arr(m.h)[j]||""), a:Array.from({length:n},(_,j)=>arr(m.a)[j]||""),
        ss:defs.map((_,k)=>[+(ssIn[k]||[])[0]||0, +(ssIn[k]||[])[1]||0]), ch:defs.map((_,k)=>Number.isInteger(chIn[k]) ? chIn[k] : -1)};
      x.defs = defs.map((d,k)=>d.opts ? Object.assign({opts:d.opts}, d.opts[x.ch[k]] || {spec:"", target:0}) : d);
      deriveSets(x); return x;
    });
    st.nextId = Math.max(+st.nextId||1, mx+1);
    st.inCorso = st.inCorso.filter(i=>i<st.matches.length);
    if(f.tab){   /* tabellone: nomi e turno degli incontri seguiti vengono dal tabellone */
      normTab(st); const TB = buildTab(st);
      st.matches.forEach(m=>{ const nd = m.tid && TB.nodes.get(m.tid); if(!nd) return; m.turno = nd.turno;
        const sp = t => st.gioco==="Coppia" ? (v=>[v[0]||"", v[1]||""])(String(t).split("/").map(x=>x.trim())) : [String(t)];
        m.h = sp(nd.sd[0].tbd ? "" : nd.sd[0].name); m.a = sp(nd.sd[1].tbd ? "" : nd.sd[1].name); });
    }
    return st;
  }
  const ms = arr(st.matches);
  st.matches = f.matches.map((d,i)=>{
    const m = Object.assign(clone(d), ms[i]||{});
    m.h = d.h.map((_,j)=>arr(m.h)[j]||""); m.a = d.a.map((_,j)=>arr(m.a)[j]||"");
    m.hc = d.h.map((_,j)=>arr(m.hc)[j]||""); m.ac = d.a.map((_,j)=>arr(m.ac)[j]||"");
    const s = arr(m.s); m.s = [+s[0]||0, +s[1]||0];
    m.kind = d.kind; m.pts = d.pts; if(d.step) m.step = d.step;
    if(d.opts){ m.opts = d.opts; m.opt = (typeof m.opt==="number") ? m.opt : -1; const o = m.opts[m.opt]; m.spec = o ? o.spec : ""; m.target = o ? o.target : 0; }
    else { m.spec = d.spec; m.target = d.target; }
    if(m.kind==="Staffetta"){ m.ph = d.h.map((_,j)=>+arr(m.ph)[j]||0); m.pa = d.h.map((_,j)=>+arr(m.pa)[j]||0); m.s = [m.ph.reduce((a,b)=>a+b,0), m.pa.reduce((a,b)=>a+b,0)]; }
    return m;
  });
  return st;
}
function newState(o){
  const f = FORMULE[o.formula];
  if(f.torneo) return normalize(Object.assign({v:1, formula:o.formula, rev:0, updatedAt:0, stato:"programmata", data:o.data,
    title:o.titolo, subtitle:[o.fase, o.luogo].filter(Boolean).join(" · "), gioco:o.gioco, formule:o.formule, formato:"",
    home:clone(CLUB), away:{name:"",city:"",badge:""}, inCorso:[], matches:[], nextId:1},
    f.tab ? {tab:{bat:Array.from({length:o.nbat||1}, (_,i)=>({nome:"Batteria " + (i+1), p:Array(8).fill("")})), fin:finDefault(o.nbat||1), res:{}}} : {}));
  const away = {name:o.ospite, city:o.citta, badge:(o.ospite||"?").trim().charAt(0).toUpperCase()};
  return normalize({v:1, formula:o.formula, rev:0, updatedAt:0, stato:"programmata", data:o.data,
    title:f.nome, subtitle:[o.giornata, o.luogo].filter(Boolean).join(" · "), trasferta:!!o.trasferta,
    home:clone(CLUB), away, inCorso:[], matches:clone(f.matches)});
}

