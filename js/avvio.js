/* Tabellone Live · avvio.js — Avvio: spettatori, lettura della gara, scelta della pagina da mostrare
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= avvio ================= */
/* spettatori: ogni pagina pubblica aperta lascia un segnalino anonimo, che Firebase cancella quando si chiude */
let viewers = 0, visits = 0;
function viewersHTML(){ return (S && S.stato==="live" && viewers>0) ? `👁 ${viewers} in diretta` : ""; }
function paintViewers(){ const el = document.getElementById("viewers"); if(el) el.innerHTML = viewersHTML(); if(editor) renderBar(); }
/* &diag nell'indirizzo: riquadro con lo stato del contatore spettatori (per controllarlo dal telefono, senza console) */
function diag(t){ if(!P.has("diag")) return; let d = document.getElementById("diag");
  if(!d){ d = document.createElement("div"); d.id = "diag"; d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#111c;color:#fff;font:13px/1.4 monospace;padding:8px 10px;border:1px solid #f6c853;border-radius:8px;white-space:pre-wrap;max-height:40vh;overflow:auto";
    document.body.appendChild(d); d.textContent = "gara: " + GARA + " (" + GARA.length + " caratteri)\nversione: " + ((document.querySelector('script[src*="avvio.js"]')||{}).src||"").split("v=")[1]; }
  d.textContent += "\n" + new Date().toLocaleTimeString() + " " + t; }
function trackPresence(){
  const list = db.ref("presenza/" + GARA);
  if(!REGIA){
    const me = list.push();
    db.ref(".info/connected").on("value", s=>{
      diag("collegato: " + (s.val() ? "sì" : "no"));
      if(s.val()) me.onDisconnect().remove().then(()=>{ diag("onDisconnect ok"); return me.set(firebase.database.ServerValue.TIMESTAMP); }).then(()=>diag("segnalino scritto ✓ (" + me.key + ")"))
        .catch(e=>{ diag("ERRORE: " + ((e && (e.code || e.message)) || e)); console.warn("Spettatori: segnalino non scritto", GARA.length, e && e.code); });
    });
    let seen = false; try{ seen = sessionStorage.getItem("b2p_visto_" + GARA)==="1"; }catch(e){}
    if(!seen){ db.ref("visite/" + GARA).transaction(v=>(v||0)+1).catch(e=>console.warn("Visite: contatore non aggiornato", e && e.code)); try{ sessionStorage.setItem("b2p_visto_" + GARA, "1"); }catch(e){} }
  }
  list.on("value", s=>{ viewers = s.numChildren(); diag("spettatori letti: " + viewers); paintViewers(); }, e=>diag("ERRORE lettura: " + (e && (e.code || e.message))));
  if(REGIA) db.ref("visite/" + GARA).on("value", s=>{ visits = +s.val()||0; paintViewers(); }, ()=>{});
}
function watchGara(){
  if(REGIA) setTimeout(ondaWatch);
  trackPresence(); watchAnag();
  db.ref("gare/"+GARA).on("value", snap=>{
    const v = normalize(snap.val());
    if(!v){ if(!editor){ mode = "missing"; render(); } return; }
    const wasDirty = editor && PUB && dirty();
    PUB = v;
    if(!editor){ S = clone(v); }
    else if(!S){ S = loadDraft() || clone(v); }
    else if(!wasDirty){ S = clone(v); }
    mode = "board"; render();
  }, ()=>{ mode = "error"; render(); });
}
function startRegia(){
  if(!session){ editor = false; mode = "login"; render(); return; }
  if(P.has("anagrafica")){ document.title = "Giocatori e squadre · Regia"; mode = "anag"; render(); watchAnag(); return; }
  if(GARA){ editor = true; mode = "loading"; render(); watchGara(); }
  else { mode = "regiahome"; render(); watchIndex(); watchAnag(); }
}
/* ?live = link fisso: apre la gara LIVE; se sono più d'una le elenca; se nessuna, la prossima in programma o l'ultima conclusa */
function openLive(){
  db.ref("indice").once("value").then(snap=>{
    const all = Object.entries(snap.val()||{}).map(([id,m])=>Object.assign({id}, m)).filter(g=>visOf(g)!=="prova");
    const go = g => location.replace("?gara=" + encodeURIComponent(g.id));
    const live = all.filter(g=>g.stato==="live");
    if(live.length===1) return go(live[0]);
    if(live.length>1){ INDEX = Object.fromEntries(live.map(g=>[g.id, g])); mode = "list"; render(); return; }
    const next = all.filter(g=>g.stato==="programmata" && (g.data||"")>=today()).sort((a,b)=>(a.data||"").localeCompare(b.data||""))[0];
    if(next) return go(next);
    const last = all.filter(g=>g.stato==="finita").sort((a,b)=>(b.data||"").localeCompare(a.data||"") || (b.aggiornato||0)-(a.aggiornato||0))[0];
    if(last) return go(last);
    mode = "list"; render(); watchIndex();
  }, ()=>{ mode = "error"; render(); });
}
function watchIndex(){ db.ref("indice").on("value", snap=>{ INDEX = snap.val() || {}; render(); }, ()=>{ mode = "error"; render(); }); }

/* partenza (in una funzione: le uscite anticipate usano return) */
(() => {
if(!initFirebase()){ mode = "error"; render(); return; }
db.ref(".info/connected").on("value", s=>{ const was = online; online = !!s.val(); if(was!==online && mode==="board") render(); });
if(OVERLAY){ ovStart(); return; }
if(REGIA){
  document.title = "Regia · Tabellone Live";
  startRegia();
} else if(GARA){ watchGara(); }
else if(P.has("live")){ openLive(); }
else if(PCODE){ mode = "gioc"; render(); watchAnag(); loadAllGare(); }
else if(P.has("giocatori")){ document.title = "Giocatori · Biliardo Seconda Passione"; mode = "giocs"; render(); watchAnag(); }
else { mode = "list"; render(); watchIndex(); }
})();

/* regia: schermo sempre acceso (08/11/2026). Con la regia aperta il telefono non si spegne da solo, anche se nelle impostazioni
   lo spegnimento automatico arriva al massimo a 30 minuti (es. Realme). Screen Wake Lock: Chrome/Edge su Android e computer,
   Safari da iOS 16.4; il blocco cade quando la pagina va in secondo piano e viene ripreso al ritorno. Senza supporto: niente. */
if(P.has("regia") && "wakeLock" in navigator){
  let wl = null;
  const keep = async () => { if(document.visibilityState!=="visible" || wl) return;
    try{ wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", ()=>{ wl = null; }); }catch(e){ wl = null; } };
  document.addEventListener("visibilitychange", keep);
  ["click","touchend","keydown"].forEach(ev=>document.addEventListener(ev, keep, {passive:true}));
  keep();
}
