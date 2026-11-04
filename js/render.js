/* Tabellone Live · render.js — Regia (accesso, nuova gara, duplica, elimina), disegno della pagina, barra di regia
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= regia: accesso e nuova gara ================= */
function loginHTML(msg){
  return `<main class="wrap narrow"><div class="comp">Regia tabellone</div>
    <form id="login" class="panel"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required value="${esc(lastEmail)}">
    <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required>
    <button type="submit">Entra</button>${msg?`<p class="err">${esc(msg)}</p>`:""}</form></main>`;
}
function regiaHomeHTML(idx){
  const opts = Object.entries(FORMULE).filter(([k,f])=>!f.vecchia).map(([k,f])=>`<option value="${k}">${esc(f.nome)}</option>`).join("");
  return `<main class="wrap"><div class="top"><div><div class="comp">Regia tabellone</div><div class="sub">${esc(session && session.email || "")}</div></div>
      <div class="rtop"><a class="ghost" href="manuale.html" target="_blank" rel="noopener">📖 Manuale</a><a class="ghost" href="?regia&amp;anagrafica">👥 Giocatori e squadre</a><button class="ghost" id="logout">Esci</button></div></div>
    <form id="newgara" class="panel grid">
      <h2>Nuova gara</h2>
      <label for="ng-f">Competizione</label><select id="ng-f">${opts}</select>
      <label for="ng-d">Data</label><input id="ng-d" type="date" value="${today()}" required>
      <div class="fs" data-fs="sq"><label for="ng-g">Giornata</label><input id="ng-g" value="Prima giornata">
        <label for="ng-cp">Campo</label><select id="ng-cp"><option value="casa">In casa (noi a sinistra)</option><option value="trasferta">In trasferta (avversari a sinistra)</option></select></div>
      <div class="fs" data-fs="to" hidden><label for="ng-t">Nome del torneo</label><input id="ng-t" required disabled placeholder="es. 1° Memorial Luca Tamburini">
        <label for="ng-fa">Fase / giornata</label><input id="ng-fa" disabled placeholder="es. Batteria 1 (facoltativo)">
        <label for="ng-gi">Gioco</label><select id="ng-gi" disabled><option value="Singolo">Singoli</option><option value="Coppia">Coppie</option></select>
        <label>Partita</label>${fbHTML(FB_NUOVA, 0, false).replace(/<(select|input)/g, "<$1 disabled")}
        <div class="fs" data-fs="tb" hidden><label for="ng-nb">Numero di batterie</label><input id="ng-nb" type="number" inputmode="numeric" min="1" max="32" value="4" disabled></div>
        <p class="hint">Vale per tutti gli incontri; per la finale o altri incontri si possono aggiungere altre formule nella finestra degli incontri.</p></div>
      <label for="ng-l">Luogo</label><input id="ng-l" placeholder="es. Modena">
      <div class="fs" data-fs="sq"><label for="ng-o">Squadra avversaria</label><input id="ng-o" required placeholder="es. Tempio B" list="sq-dl" autocomplete="off">
        <label for="ng-c">Città avversaria</label><input id="ng-c" placeholder="es. Modena · MO"></div>
      <button type="submit">Crea gara</button><p class="hint" id="ng-msg"></p>
    </form><datalist id="sq-dl">${SQUADRE ? sqDatalist() : ""}</datalist>
    <h2 class="lh">Gare</h2>${delMsg ? `<p class="${delErr ? "err" : "hint"}">${esc(delMsg)}</p>` : ""}${listHTML(idx, true)}</main>`;
}

/* ================= render ================= */
let mode = "loading", INDEX = null, lastEmail = "";
/* ---- regia: elimina una gara dall'elenco (primo clic arma, secondo entro 4 s conferma) ---- */
let delArm = {id:"", t:0}, delBusy = "", delMsg = "", delErr = false;
function delBtnHTML(g){
  const armed = delArm.id===g.id && Date.now()-delArm.t<4000, busy = delBusy===g.id;
  return `<div class="gact"><button class="gdup" data-dup="${esc(g.id)}" title="Nuova gara con gli stessi dati (giornata successiva)">⧉ Duplica</button><button class="gdel${armed ? " arm" : ""}" data-del="${esc(g.id)}"${busy ? " disabled" : ""} title="Elimina definitivamente la gara">${busy ? "Eliminazione…" : armed ? (g.stato==="live" ? "Conferma: elimina (è LIVE)" : "Conferma: elimina") : "🗑 Elimina"}</button></div>`;
}
/* ---- regia: duplica una gara (riempie il modulo Nuova gara; punteggi e nomi dei giocatori non si copiano) ---- */
let dupSrc = null;
const ORDINALI = ["Prima","Seconda","Terza","Quarta","Quinta","Sesta","Settima","Ottava","Nona","Decima","Undicesima","Dodicesima","Tredicesima","Quattordicesima","Quindicesima","Sedicesima","Diciassettesima","Diciottesima","Diciannovesima","Ventesima"];
function nextGiornata(t){
  t = String(t||"").trim();
  const w = ORDINALI.findIndex(o=>new RegExp("^" + o + "\\b", "i").test(t));
  if(w>=0 && w<ORDINALI.length-1) return t.replace(new RegExp("^" + ORDINALI[w], "i"), ORDINALI[w+1]);
  return t.replace(/(\d+)(?=\s*[ªa°]?\s*giornata\b)|(giornata\s+)(\d+)/i, (m, a, b, c)=>a ? String(+a+1) : b + (+c+1));
}
async function dupGara(id){
  let src = null;
  try{ if(db) src = normalize((await db.ref("gare/" + id).once("value")).val()); }catch(e){}
  if(!src){ delErr = true; delMsg = "Non riesco a leggere la gara da duplicare: controlla la connessione"; render(); return; }
  delMsg = ""; dupSrc = src; render();
  const f = $("#newgara"); if(!f) return;
  let fk = src.formula;
  if(!FORMULE[fk] || FORMULE[fk].vecchia){ const nome = (FORMULE[fk] || {}).nome; fk = (Object.entries(FORMULE).find(([k,x])=>!x.vecchia && x.nome===nome) || Object.entries(FORMULE).find(([k,x])=>!x.vecchia))[0]; }
  const sel = $("#ng-f"); sel.value = fk; sel.dispatchEvent(new Event("change", {bubbles:true}));
  const parts = String(src.subtitle||"").split(" · "), tor = !!FORMULE[fk].torneo;
  if(tor){
    $("#ng-t").value = src.title || ""; $("#ng-fa").value = nextGiornata(parts.length>1 ? parts.slice(0,-1).join(" · ") : ""); $("#ng-gi").value = src.gioco || "Singolo";
    $("#ng-l").value = parts.length>1 ? parts.at(-1) : (parts[0] || "");
    const fb = f.querySelector(".fb"); if(fb && src.formule && src.formule[0]) fb.outerHTML = fbHTML(src.formule[0], 0, false);
    if($("#ng-nb") && src.tab) $("#ng-nb").value = src.tab.bat.length;
  } else {
    $("#ng-g").value = nextGiornata(parts[0] || ""); $("#ng-l").value = parts.slice(1).join(" · ");
    $("#ng-o").value = src.away.name || ""; $("#ng-c").value = src.away.city || ""; $("#ng-cp").value = src.trasferta ? "trasferta" : "casa";
  }
  $("#ng-d").value = today();
  $("#ng-msg").textContent = `Dati copiati da "${[src.title, src.subtitle].filter(Boolean).join(" · ")}": controlla ${tor ? "fase, data e luogo" : "giornata, data, campo (casa/trasferta), luogo e avversario"}, poi premi Crea gara.`;
  f.classList.add("dupl"); f.scrollIntoView({behavior:"smooth", block:"start"});
  setTimeout(()=>{ const x = tor ? $("#ng-fa") : $("#ng-g"); if(x){ x.focus(); x.select && x.select(); } }, 350);
}
async function delGara(id){
  if(!(delArm.id===id && Date.now()-delArm.t<4000)){ delArm = {id, t:Date.now()}; delMsg = ""; render(); setTimeout(render, 4100); return; }
  const tit = INDEX && INDEX[id] ? [INDEX[id].titolo, INDEX[id].sottotitolo].filter(Boolean).join(" · ") : id;
  delArm = {id:"", t:0}; delBusy = id; render();
  const base = {["gare/"+id]: null, ["indice/"+id]: null};
  try{
    try{ await dbWrite(Object.assign({["storia/"+id]: null}, base)); }
    catch(e){ if(!/PERMISSION/i.test(String(e && e.code))) throw e; await dbWrite(base); }   /* regole senza "storia" */
    try{ await dbWrite({["visite/"+id]: null}); }catch(e){}                                  /* contatore: facoltativo */
    try{ localStorage.removeItem("b2p_live_bozza_" + id); }catch(e){}
    delErr = false; delMsg = "Gara eliminata: " + tit;
  }catch(e){
    delErr = true; delMsg = /PERMISSION/i.test(String(e && e.code)) ? "Eliminazione rifiutata: utente non autorizzato o regole del database da controllare"
                                                                  : "Eliminazione non riuscita: controlla la connessione e riprova";
  }
  delBusy = ""; render();
}
let shown = "";
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
function scoreFx(el, from, to, sd){
  const d = to - from, side = el.closest(".side");
  if(RM || !side || !d){ el.classList.add("bump"); return; }
  const f = document.createElement("span");
  /* l'etichetta sta esattamente al posto del numero (centrata sulle sue cifre), che intanto resta nascosto */
  el.textContent = from;
  const rg = document.createRange(); rg.selectNodeContents(el);
  const tr = rg.getBoundingClientRect(), sr = side.getBoundingClientRect();
  f.className = "fly " + sd + (d<0 ? " neg" : ""); f.textContent = (d>0 ? "+" : "−") + Math.abs(d);
  f.style.left = (tr.left + tr.width/2 - sr.left) + "px"; f.style.top = (tr.top + tr.height/2 - sr.top) + "px";
  side.appendChild(f); el.classList.add("hold");
  setTimeout(()=>{
    f.remove(); el.classList.remove("hold"); if(!el.isConnected || document.activeElement===el) return;
    const t0 = performance.now(), D = 700;
    const step = now=>{
      if(!el.isConnected || document.activeElement===el) return;
      const p = Math.min(1, (now-t0)/D);
      el.textContent = Math.round(from + d*(1 - Math.pow(1-p, 3)));
      if(p<1) requestAnimationFrame(step); else { el.textContent = to; el.classList.add("bump"); }
    };
    requestAnimationFrame(step);
  }, 1850);
}
function render(){
  const app = $("#app");
  if(mode===shown && app.contains(document.activeElement) && (document.activeElement.isContentEditable || /INPUT|SELECT/.test(document.activeElement.tagName))) return;
  shown = mode;
  document.body.classList.toggle("ed", editor);
  if(mode==="board" && S){
    const bkw = app.querySelector(".bkwrap"), bsl = bkw ? bkw.scrollLeft : 0;
    app.innerHTML = boardHTML();
    if(bsl && app.querySelector(".bkwrap")) app.querySelector(".bkwrap").scrollLeft = bsl;
    if(prev){ const pm = new Map(prev.matches.map((m,i)=>[mkey(m,i), m]));
      S.matches.forEach((m,i)=>{ const q = pm.get(mkey(m,i)); if(q && q.sk===m.sk) ["h","a"].forEach((sd,k)=>{
        if(q.s[k]!==m.s[k]) app.querySelectorAll(`[data-sc="${i}.${sd}"]`).forEach(e=>scoreFx(e, q.s[k], m.s[k], sd)); }); }); }
    if(prev && prev.matches.length===S.matches.length){ const a = totals(prev), b = totals(S);
      [".tot .h",".tot .a"].forEach((q,k)=>{ if(a[k]===b[k]) return; const e = app.querySelector(q); if(!e) return;
        if(RM){ e.classList.add("bump"); return; }
        e.textContent = a[k]; setTimeout(()=>{ if(e.isConnected){ e.textContent = b[k]; e.classList.add("bump"); } }, 2600); }); }
    prev = clone(S);
  }
  else if(mode==="list") app.innerHTML = `<main class="wrap"><div class="top"><div><div class="comp">Biliardo Seconda Passione</div><div class="sub">Risultati in diretta</div></div><a class="lk" href="?giocatori">👥 Giocatori</a></div>${listHTML(INDEX,false)}<div class="foot">Biliardo Seconda Passione · Bologna · <a href="manuale.html">Manuale</a></div></main>`;
  else if(mode==="gioc") app.innerHTML = giocHTML();
  else if(mode==="giocs") app.innerHTML = giocsHTML();
  else if(mode==="login") app.innerHTML = loginHTML(flash);
  else if(mode==="regiahome") app.innerHTML = regiaHomeHTML(INDEX);
  else if(mode==="anag") app.innerHTML = anagHTML();
  else if(mode==="missing") app.innerHTML = `<main class="wrap"><p class="empty">Questa gara non esiste o non è ancora stata pubblicata.</p><a class="back" href="${esc(pageURL("")||"?")}">← Tutte le gare</a></main>`;
  else if(mode==="error") app.innerHTML = `<main class="wrap"><p class="empty">Impossibile collegarsi al servizio dei risultati. Controlla la connessione e ricarica la pagina.</p></main>`;
  else app.innerHTML = `<main class="wrap"><p class="empty">Caricamento…</p></main>`;
  renderBar();
}
let barOpen = false;
function renderBar(){
  const b = $("#rbar");
  if(!editor || mode!=="board"){ b.innerHTML = ""; return; }
  const d = dirty(), pub = pageURL("?gara="+GARA);
  b.className = (d ? "dirty" : "") + (barOpen ? " open" : "");
  b.innerHTML = `<span class="tag">REGIA</span>
    <span class="st">${flash ? esc(flash) : d ? "● Modifiche NON ancora pubblicate" : "✓ Il pubblico vede tutto aggiornato"}</span>
    <span class="vw" title="Pagine pubbliche aperte adesso · aperture totali della pagina di questa gara">👁 ${viewers} in diretta<span class="vis"> · ${visits} aperture</span></span>
    <button class="pub" data-r="pub" ${busy?"disabled":""}>PUBBLICA <small>(P)</small></button>
    <button data-r="disc" ${d&&!busy?"":"disabled"}>Scarta</button>
    <button class="more" data-r="more" title="Altri comandi" aria-label="Altri comandi" aria-expanded="${barOpen}">${barOpen ? "✕" : "⋯"}</button>
    ${isTab() ? `<button class="x" data-r="tbe">Batterie e finali…</button>` : isTorneo() ? `<button class="x" data-r="inc">Incontri…</button>` : ""}
    <button class="x" data-r="end">${S.stato==="finita"?"Riapri gara":"Termina gara"}</button>
    ${S.stato==="live" ? `<button data-r="prog" class="x ${Date.now()-armP<4000?"arm":""}" title="Torna a In programma: azzera punteggi e cronologia">${Date.now()-armP<4000?"Conferma: in programma":"Rimetti in programma"}</button>` : ""}
    <button data-r="reset" class="x ${Date.now()-armT<4000?"arm":""}">${Date.now()-armT<4000?"Conferma: azzera":"Azzera punteggi"}</button>
    <a class="rlink" href="?regia">Tutte le gare</a> <a class="rlink" href="manuale.html" target="_blank" rel="noopener">Manuale</a>
    <span class="tip">Link per il pubblico: <span class="url" id="puburl">${esc(pub || "?gara="+GARA)}</span> <button data-r="copy">Copia</button> · link fisso per tutte le dirette: <span class="url">${esc(pageURL("?live") || "?live")}</span><br>
    Clic su un punteggio: scrivi i punti del tiro e Invio (si sommano); − Togli / = Totale per togliere o correggere (da tastiera anche -2, =150). 📈 nell'incontro: andamento. Numero dell'incontro o tasti 1–${S.matches.length}: in corso. ${isTorneo() ? "Incontri…: turni e giocatori del torneo." : "Doppio clic sul logo ospite per caricarne uno."} Ctrl+Z annulla.</span>`;
}

