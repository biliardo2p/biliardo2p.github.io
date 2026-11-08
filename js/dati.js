/* Tabellone Live · dati.js — Stato della pagina, accesso della regia, scrittura nel database, PUBBLICA, cronologia
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= stato della pagina ================= */
let PUB = null, prev = null, editor = false, flash = "", flashT = null, busy = false, armT = 0, armP = 0, armD = 0, online = true, user = null;
const hist = [];
const DKEY = () => "b2p_live_bozza_" + GARA;
function loadDraft(){ try{ const d = JSON.parse(localStorage.getItem(DKEY())||"null"); if(d && PUB && d.base===PUB.rev && d.state) return normalize(d.state); }catch(e){} return null; }
function saveDraft(){ try{ localStorage.setItem(DKEY(), JSON.stringify({base:PUB?PUB.rev:0, state:S})); }catch(e){} }
function snapshot(){ hist.push(JSON.stringify(S)); if(hist.length>200) hist.shift(); }
function undo(){ if(!hist.length) return; S = normalize(JSON.parse(hist.pop())); commit(); }
function commit(){ if(editor) saveDraft(); render(); }
const strip = o => { if(!o) return ""; const c = clone(o); delete c.rev; delete c.updatedAt; return JSON.stringify(c); };
const dirty = () => strip(S) !== strip(PUB);
function setFlash(t){ flash = t; renderBar(); clearTimeout(flashT); flashT = setTimeout(()=>{ flash=""; renderBar(); }, 7000); }

/* ================= Firebase ================= */
let db = null;
function initFirebase(){
  if(!window.firebase) return false;
  try{ firebase.initializeApp(FIREBASE); db = firebase.database(); return true; }catch(e){ return false; }
}
/* Accesso e scrittura tramite le API web di Firebase: funzionano anche con la pagina aperta dal disco (file://),
   dove la libreria di autenticazione di Firebase si rifiuta di partire. La lettura in tempo reale usa la libreria. */
const AKEY = "b2p_live_sessione";
let session = null;
try{ session = JSON.parse(localStorage.getItem(AKEY)||"null"); }catch(e){}
function saveSession(){ try{ session ? localStorage.setItem(AKEY, JSON.stringify(session)) : localStorage.removeItem(AKEY); }catch(e){} }
async function signIn(email, pw){
  let r, j;
  try{
    r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FIREBASE.apiKey,
      {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email, password:pw, returnSecureToken:true})});
    j = await r.json();
  }catch(e){ throw {code:"rete"}; }
  if(!r.ok) throw {code:(j && j.error && j.error.message) || ("http " + r.status)};
  session = {email:j.email, idToken:j.idToken, refreshToken:j.refreshToken, exp:Date.now() + (+j.expiresIn - 120)*1000};
  saveSession();
}
function signOut(){ session = null; saveSession(); location.search = "?regia"; }
async function idToken(){
  if(!session) throw {code:"PERMISSION_DENIED"};
  if(Date.now() < session.exp) return session.idToken;
  let r, j;
  try{
    r = await fetch("https://securetoken.googleapis.com/v1/token?key=" + FIREBASE.apiKey,
      {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:"grant_type=refresh_token&refresh_token=" + encodeURIComponent(session.refreshToken)});
    j = await r.json();
  }catch(e){ throw {code:"rete"}; }
  if(!r.ok){ session = null; saveSession(); throw {code:"sessione scaduta: esci e rientra"}; }
  session.idToken = j.id_token; session.refreshToken = j.refresh_token; session.exp = Date.now() + (+j.expires_in - 120)*1000; saveSession();
  return session.idToken;
}
async function dbWrite(obj){
  const t = await idToken();
  let r;
  try{ r = await fetch(FIREBASE.databaseURL + "/.json?auth=" + encodeURIComponent(t), {method:"PATCH", body:JSON.stringify(obj)}); }
  catch(e){ throw {code:"rete"}; }
  if(r.status===401 || r.status===403) throw {code:"PERMISSION_DENIED"};
  if(!r.ok) throw {code:"http " + r.status};
}
function metaOf(st){
  if(isTorneo(st)){ const c = champion(st);
    return {titolo:st.title, sottotitolo:st.subtitle||"", data:st.data||"", ora:okOra(st.ora) ? st.ora : "", formula:st.formula, stato:st.stato, tipo:"torneo",
      fatti:isTab(st) ? [...buildTab(st).nodes.values()].filter(n=>n.w && n.w.how!=="abs").length : st.matches.filter(m=>winner(m)).length,
      totale:isTab(st) ? [...buildTab(st).nodes.values()].filter(n=>!(n.w && n.w.how==="abs")).length : st.matches.length, vincitore:c ? c.n : "", vis:visOf(st), prova:visOf(st)==="prova", aggiornato:st.updatedAt||0}; }
  const t = totals(st);
  return {titolo:st.title, sottotitolo:st.subtitle||"", data:st.data||"", ora:okOra(st.ora) ? st.ora : "", formula:st.formula, stato:st.stato,
    casa:st.home.name, ospite:st.away.name, punti:t, trasferta:!!st.trasferta, vis:visOf(st), prova:visOf(st)==="prova", aggiornato:st.updatedAt||0};
}
/* cronologia: a ogni PUBBLICA, in storia/<gara>/r<rev>, i punteggi degli incontri cambiati; azzerando tutto si cancella */
function storiaWrite(next){
  if(next.matches.every(m=>!hasPts(m))) return (PUB && PUB.matches.some(hasPts)) ? {["storia/"+GARA]: null} : {};
  const ch = {}, pk = new Map(PUB ? PUB.matches.map((m,i)=>[mkey(m,i), m]) : []);
  next.matches.forEach((m,i)=>{ const k = mkey(m,i), o = pk.get(k), multi = m.defs && m.defs.length>1;
    /* incontri a set: si registra ogni set cambiato (anche quello appena chiuso), chiave m<id>s<set> = [casa, ospite, set] */
    if(multi){ m.ss.forEach((x,j)=>{ const y = o && o.ss && o.ss[j]; if(y ? (y[0]!==x[0] || y[1]!==x[1]) : (x[0] || x[1])) ch[k+"s"+j] = [x[0], x[1], j]; }); return; }
    if(!o || o.s[0]!==m.s[0] || o.s[1]!==m.s[1]) ch[k] = [m.s[0], m.s[1]]; });
  return Object.keys(ch).length ? {["storia/"+GARA+"/r"+next.rev]: {t:next.updatedAt, m:ch}} : {};
}
async function publish(extra){
  if(!editor || busy) return;
  const a = document.activeElement; if(a && a.isContentEditable) a.blur();
  await new Promise(r=>setTimeout(r, 40));
  const next = Object.assign(clone(S), extra||{}, {rev:(PUB?PUB.rev||0:0)+1, updatedAt:Date.now()});
  if(next.stato==="programmata" && !(extra && extra.stato==="programmata")) next.stato = "live";
  busy = true; flash = "Pubblicazione in corso…"; renderBar();
  try{
    const w = {["gare/"+GARA]: next, ["indice/"+GARA]: metaOf(next)}, hw = storiaWrite(next);
    let noHist = false;
    try{ await dbWrite(Object.assign({}, w, hw)); }
    catch(e){ if(!Object.keys(hw).length || !/PERMISSION/i.test(String(e && e.code))) throw e; await dbWrite(w); noHist = true; }
    S = normalize(clone(next)); saveDraft(); busy = false; render();
    setFlash("Pubblicato alle " + fmtTime(next.updatedAt) + (noHist ? " · cronologia NON salvata: aggiornare le regole del database" : ""));
  }catch(e){
    busy = false;
    const c = String(e && (e.code||e.message));
    setFlash(/PERMISSION/i.test(c) ? "Pubblicazione rifiutata: utente non autorizzato o regole del database da controllare"
           : /sessione/.test(c) ? "Sessione scaduta: torna a Tutte le gare, esci e rientra"
           : "Pubblicazione non riuscita: controlla la connessione e premi di nuovo PUBBLICA");
  }
}
function discard(){ if(!PUB) return; snapshot(); S = normalize(clone(PUB)); commit(); }
function resetScores(){
  if(Date.now()-armT > 4000){ armT = Date.now(); renderBar(); setTimeout(renderBar, 4100); return; }
  armT = 0; snapshot();
  S.matches.forEach(m=>{ m.s=[0,0]; if(m.ph){ m.ph=m.ph.map(()=>0); m.pa=m.pa.map(()=>0); } if(m.opts){ m.opt=-1; m.spec=""; m.target=0; } if(m.ss){ m.ss = m.ss.map(()=>[0,0]); m.ch = m.ch.map(()=>-1); } });
  S.inCorso = []; if(S.tab) S.tab.res = {}; S = normalize(S); commit();
}

