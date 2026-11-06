/* Tabellone Live · anagrafica.js — Anagrafica: giocatori, squadre, import/export
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= anagrafica: giocatori e squadre (giocatori/<codice>, squadre/<codice>) =================
   giocatori/<codice> = {cognome, nome, sopr?, tab?, anni:{<anno sportivo>: {sq:<codice squadra>, cat:"NP"|"N"|"M"|"1"|"2"|"3"}}}  (NP = Nazionale Pro, N = Nazionale, M = Master)
   anno sportivo = anno di inizio (2026 = 2026/27, da settembre ad agosto). Il codice nasce alla prima registrazione e non cambia più. */
let ANAG = null, SQUADRE = null, anErr = "", anTab = "g", anStag = null, anSq = "", anQ = "", anImp = "", anEd = null, anWatch = false;
const CATS = ["NP","N","M","1","2","3"];
const CATN = {NP:"Nazionale Pro", N:"Nazionale", M:"Master"};
const catShort = c => CATN[c] || (c ? c + "ª" : "");   /* tendina della scheda */
const catLabel = c => CATN[c] ? "cat. " + CATN[c] : c ? c + "ª cat." : "";   /* elenchi e pagine: "cat. Master", "2ª cat." */
const stagione = d => { const x = String(d || today()), y = +x.slice(0,4), m = +x.slice(5,7); return m>=9 ? y : y-1; };
const stagLabel = y => `${y}/${String(+y+1).slice(2)}`;
const anniOf = p => Object.keys((p && p.anni) || {}).map(Number).sort((a,b)=>a-b);
function rowAt(p, y){ const ys = anniOf(p); if(!ys.length) return {}; const k = ys.filter(x=>x<=y).pop() ?? ys[0]; return p.anni[k] || {}; }
function tabName(p){ if(!p) return ""; if(p.tab) return p.tab; const n = String(p.nome||"").trim(); return String(p.cognome||"").trim() + (n ? " " + n.charAt(0).toUpperCase() + "." : ""); }
const CLUBSQ = slug(CLUB.name);
const isClub = k => k===CLUBSQ;
const sqName = k => (SQUADRE && SQUADRE[k] && SQUADRE[k].nome) || k || "";
const sqSorted = () => Object.entries(SQUADRE||{}).sort((a,b)=>isClub(b[0])-isClub(a[0]) || String(a[1].nome).localeCompare(String(b[1].nome)));
const findSq = nome => { nome = String(nome||"").trim().toLowerCase(); if(!nome) return ""; const x = Object.entries(SQUADRE||{}).find(([k,s])=>String(s.nome||"").trim().toLowerCase()===nome); return x ? x[0] : ""; };
const sqLogo = (k, s) => isClub(k) ? `<img src="${LOGO_HOME}" alt="">` : s && s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<i class="sb">${esc(String((s && s.nome) || "?").charAt(0).toUpperCase())}</i>`;
function parseCat(t){ t = String(t||"").trim().toUpperCase().replace(/^CAT(EGORIA)?\.?\s*/, "");
  if(/^(NP|PRO|NAZ\w*\.?\s*PRO)/.test(t)) return "NP"; if(/^(N|NAZ)/.test(t)) return "N"; if(/^M/.test(t)) return "M"; const n = t.match(/^[1-3]/); return n ? n[0] : ""; }
function parseAnno(t){ const m = String(t||"").match(/(20\d\d)/); return m ? +m[1] : null; }
const wErr = err => err && err.code==="PERMISSION_DENIED" ? "Firebase rifiuta la scrittura: controlla che le regole del database abbiano i nodi giocatori, squadre e foto (vedi LEGGIMI)" : "Salvataggio non riuscito (" + ((err && (err.code||err.message)) || "?") + ")";
function watchAnag(){
  if(anWatch) return; anWatch = true;
  /* se la lettura viene rifiutata (regole non ancora pubblicate) si riprova da soli ogni 5 secondi */
  const okG = {g:false, s:false};
  const watch = (path, key, set) => db.ref(path).on("value", s=>{ set(s.val() || {}); okG[key] = true; if(okG.g && okG.s) anErr = ""; anRepaint(); }, ()=>{
    okG[key] = false; anErr = "Non riesco a leggere l'anagrafica: controlla che nelle regole del database ci siano i nodi giocatori e squadre. Riprovo da solo…";
    ANAG = ANAG || {}; SQUADRE = SQUADRE || {}; anRepaint(); setTimeout(()=>watch(path, key, set), 5000); });
  watch("giocatori", "g", v=>ANAG = v);
  watch("squadre", "s", v=>SQUADRE = v);
}
/* foto dei giocatori: foto/<codice> = immagine già ridotta (data URL), giocatori/<codice>/foto = versione (data e ora del caricamento).
   Le foto stanno in un nodo a parte e si scaricano una alla volta, solo quando servono: l'elenco dei giocatori resta leggero. */
const FOTO = {};
const fotoKey = (k, p) => k + "@" + ((p && p.foto) || "");
function fotoGet(k, p, cb){
  if(!p || !p.foto) return ""; const fk = fotoKey(k, p);
  if(FOTO[fk]===undefined){ FOTO[fk] = null; db.ref("foto/" + k).once("value").then(s=>{ FOTO[fk] = s.val() || ""; cb && cb(); }, ()=>{ FOTO[fk] = ""; cb && cb(); }); }
  return FOTO[fk];   /* null = in arrivo, "" = assente */
}
function fotoResize(f, done){
  const rd = new FileReader();
  rd.onload = () => { const im = new Image();
    im.onload = () => { const M = 400, w0 = im.naturalWidth || M, h0 = im.naturalHeight || M, k = Math.min(1, M/Math.max(w0, h0));
      const W = Math.round(w0*k), H = Math.round(h0*k);
      let src = im, sw = w0, sh = h0;
      while(sw > W*2){ const t = document.createElement("canvas"); t.width = Math.round(sw/2); t.height = Math.round(sh/2);   /* riduzione a passi: più nitida */
        t.getContext("2d").drawImage(src, 0, 0, t.width, t.height); src = t; sw = t.width; sh = t.height; }
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, W, H);
      let u = c.toDataURL("image/webp", .82); if(!u.startsWith("data:image/webp")) u = c.toDataURL("image/jpeg", .85);   /* Safari vecchi: niente webp */
      done(u); };
    im.onerror = () => done("");
    im.src = rd.result; };
  rd.readAsDataURL(f);
}
function anRepaint(){
  if(mode==="anag"){ const ae = document.activeElement;
    if(ae && ae.id==="an-q"){ const l = $("#an-list"); if(l) l.innerHTML = anListHTML(); }
    else if(ae && ae.id==="an-imp"){ const p = $("#an-prev"); if(p) p.innerHTML = impPrevHTML(); }
    else render(); }
  else if(mode==="regiahome"){ const d = $("#sq-dl"); if(d) d.innerHTML = sqDatalist(); }
  else if(mode==="board" && S) render();
  else if(mode==="gioc") render();
  else if(mode==="giocs"){ if(document.activeElement && document.activeElement.id==="gs-q"){ const l = $("#gs-list"); if(l) l.innerHTML = giocsList(); } else render(); }
}
const sqDatalist = () => sqSorted().filter(([k])=>!isClub(k)).map(([k,s])=>`<option value="${esc(s.nome)}"></option>`).join("");
function anYears(){ const s = new Set([stagione()]); Object.values(ANAG||{}).forEach(p=>anniOf(p).forEach(y=>s.add(y))); return [...s].sort((a,b)=>b-a); }
function anagHTML(){
  if(anStag===null) anStag = stagione();
  let h = `<main class="wrap"><div class="top"><div><div class="comp">Giocatori e squadre</div><div class="sub">Anagrafica · anno sportivo ${stagLabel(stagione())}</div></div><a class="ghost" href="?regia">← Regia</a></div>`;
  if(anErr) h += `<p class="err">${esc(anErr)}</p>`;
  h += `<div class="pills">${[["g","Giocatori"],["s","Squadre"],["i","Importa / esporta"],["c","Controllo nomi"]].map(([k,t])=>`<button class="pill${anTab===k ? " on" : ""}" data-antab="${k}">${t}</button>`).join("")}</div>`;
  if(ANAG===null || SQUADRE===null) return h + `<p class="empty">Caricamento…</p></main>`;
  if(anTab==="c" && !CK && !ckBusy) setTimeout(ckLoad);
  return h + (anTab==="g" ? anGiocHTML() : anTab==="s" ? anSqHTML() : anTab==="c" ? ckHTML() : anImpHTML()) + `</main>`;
}
function anGiocHTML(){
  return `<div class="anf"><select id="an-st" aria-label="Anno sportivo">${anYears().map(y=>`<option value="${y}"${y===anStag ? " selected" : ""}>${stagLabel(y)}</option>`).join("")}</select>
    <select id="an-sq" aria-label="Squadra"><option value="">Tutte le squadre</option>${sqSorted().map(([k,s])=>`<option value="${esc(k)}"${k===anSq ? " selected" : ""}>${esc(s.nome)}</option>`).join("")}</select>
    <input id="an-q" type="search" placeholder="Cerca…" value="${esc(anQ)}" autocomplete="off"><button class="ghost" data-annew>+ Nuovo giocatore</button></div>
    <div id="an-list">${anListHTML()}</div>`;
}
function anListHTML(){
  const q = anQ.trim().toLowerCase();
  const rows = Object.entries(ANAG).map(([k,p])=>({k, p, r:(p.anni||{})[anStag]}))
    .filter(x=>x.r && (!anSq || x.r.sq===anSq) && (!q || [x.p.cognome, x.p.nome, x.p.sopr, tabName(x.p)].join(" ").toLowerCase().includes(q)));
  if(!rows.length) return `<p class="empty">${Object.keys(ANAG).length ? "Nessun giocatore con una riga per il " + stagLabel(anStag) + (q || anSq ? " con questi filtri" : "") + "." : "L'elenco è vuoto: aggiungi un giocatore o importa una tabella."}</p>`;
  rows.sort((a,b)=>isClub(b.r.sq)-isClub(a.r.sq) || sqName(a.r.sq).localeCompare(sqName(b.r.sq)) || String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||"")));
  const g = new Map(); rows.forEach(x=>{ if(!g.has(x.r.sq)) g.set(x.r.sq, []); g.get(x.r.sq).push(x); });
  return [...g].map(([sq, xs])=>`<h3 class="ang">${esc(sqName(sq))} <span>${xs.length}</span></h3><div class="anl">` + xs.map(x=>
    `<button class="anr" data-anp="${esc(x.k)}"><b>${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""}${x.p.foto ? ` <i class="hf" title="Ha la foto">📷</i>` : ""}</b><span>${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))}${x.p.sopr ? ` · “${esc(x.p.sopr)}”` : ""} · ${esc(catLabel(x.r.cat) || "categoria da indicare")}</span></button>`).join("") + `</div>`).join("");
}
function anSqHTML(){
  const cnt = {}; Object.values(ANAG).forEach(p=>{ const r = (p.anni||{})[anStag]; if(r) cnt[r.sq] = (cnt[r.sq]||0) + 1; });
  const sqs = sqSorted();
  return `<div class="anf"><button class="ghost" data-snew>+ Nuova squadra</button></div>` + (sqs.length ? `<div class="anl">` + sqs.map(([k,s])=>
    `<button class="anr sq" data-ans="${esc(k)}">${sqLogo(k, s)}<span class="t"><b>${esc(s.nome)}</b><span>${esc(s.citta||"città da indicare")}${cnt[k] ? ` · ${cnt[k]} ${cnt[k]===1 ? "giocatore" : "giocatori"} nel ${stagLabel(anStag)}` : ""}</span></span></button>`).join("") + `</div>`
    : `<p class="empty">Nessuna squadra: si creano anche da sole importando i giocatori.</p>`);
}
function anImpHTML(){
  return `<section class="panel"><h2>Importa da tabella</h2>
    <p class="hint">Copia le righe da Excel, con la riga di intestazione, e incollale qui. Colonne: Nome, Cognome, Squadra, Città, Categoria (NP = Nazionale Pro, N = Nazionale, M = Master, 1, 2, 3), Anno (anno sportivo: 2026 = 2026/27).
    Le squadre che mancano vengono create; per un giocatore già presente si aggiorna solo l'anno indicato.</p>
    <textarea id="an-imp" spellcheck="false" placeholder="Nome&#9;Cognome&#9;Squadra&#9;Città&#9;Categoria&#9;Anno">${esc(anImp)}</textarea><div id="an-prev">${impPrevHTML()}</div></section>
    <section class="panel"><h2>Esporta</h2><p class="hint">Tutti i giocatori, una riga per anno sportivo, nello stesso formato: si incolla in Excel.</p>
    <textarea id="an-exp" readonly spellcheck="false">${esc(exportTSV())}</textarea><button class="ghost" data-acp>Copia</button></section>`;
}
function exportTSV(){
  const L = ["Nome\tCognome\tSquadra\tCittà\tCategoria\tAnno"];
  Object.values(ANAG).sort((a,b)=>String(a.cognome).localeCompare(String(b.cognome)) || String(a.nome||"").localeCompare(String(b.nome||"")))
    .forEach(p=>anniOf(p).forEach(y=>{ const r = p.anni[y], s = (SQUADRE||{})[r.sq] || {}; L.push([p.nome||"", p.cognome||"", s.nome||r.sq, s.citta||"", r.cat||"", y].join("\t")); }));
  return L.join("\n");
}
function parseImp(t){
  const lines = String(t||"").split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return {rows:[], errs:[]};
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",", split = l => l.split(sep).map(x=>x.trim());
  const H = ["nome","cognome","squadra","citta","categoria","anno"], h0 = split(lines[0]).map(x=>slug(x).replace(/-/g,""));
  let cols = H.map((_,i)=>i), start = 0;
  if(h0.includes("cognome")){ cols = H.map(h=>h0.indexOf(h)); start = 1; }
  const rows = [], errs = [];
  lines.slice(start).forEach((l, j)=>{
    const c = split(l), g = i => cols[i]>=0 ? (c[cols[i]] || "") : "", n = j + start + 1;
    const r = {nome:g(0), cognome:g(1), squadra:g(2), citta:g(3), cat:parseCat(g(4)), anno:parseAnno(g(5)), riga:n};
    if(!r.cognome) errs.push(`riga ${n}: manca il cognome`);
    else if(!r.squadra) errs.push(`riga ${n}: manca la squadra`);
    else if(!r.anno) errs.push(`riga ${n}: anno "${g(5)}" non valido`);
    else if(g(4) && !r.cat) errs.push(`riga ${n}: categoria "${g(4)}" non riconosciuta (NP, N, M, 1, 2, 3)`);
    else rows.push(r);
  });
  return {rows, errs};
}
function planImp(rows){
  const W = {}, sqNew = {}, planned = {}, used = new Set(), out = [];
  rows.forEach(r=>{
    let sk = findSq(r.squadra) || Object.keys(sqNew).find(k=>sqNew[k].nome.toLowerCase()===r.squadra.toLowerCase());
    if(!sk){ const b = slug(r.squadra) || "squadra"; sk = b; let n = 2; while((SQUADRE||{})[sk] || sqNew[sk]) sk = b + "-" + n++; sqNew[sk] = {nome:r.squadra, citta:r.citta}; }
    else if(SQUADRE[sk] && !SQUADRE[sk].citta && r.citta) W["squadre/" + sk + "/citta"] = r.citta;
    const id = [r.cognome.toLowerCase(), r.nome.toLowerCase(), r.nome ? "" : sk].join("|");
    let pk = planned[id] || Object.keys(ANAG).find(k=>{ const p = ANAG[k];
      return String(p.cognome||"").toLowerCase()===r.cognome.toLowerCase() && String(p.nome||"").toLowerCase()===r.nome.toLowerCase() && (r.nome || anniOf(p).some(y=>p.anni[y].sq===sk)); });
    let st;
    if(!pk){ const b = slug(r.cognome) + "-" + (r.nome ? slug(r.nome) : sk); pk = b; let n = 2; while(ANAG[pk] || used.has(pk)) pk = b + "-" + n++;
      used.add(pk); planned[id] = pk; W["giocatori/" + pk + "/cognome"] = r.cognome; W["giocatori/" + pk + "/nome"] = r.nome; st = "nuovo"; }
    else { planned[id] = pk; const old = ANAG[pk] && (ANAG[pk].anni||{})[r.anno];
      st = !ANAG[pk] ? "nuovo" : !old ? "aggiunge " + stagLabel(r.anno) : old.sq===sk && (old.cat||"")===r.cat ? "già presente" : "aggiorna " + stagLabel(r.anno); }
    W["giocatori/" + pk + "/anni/" + r.anno] = {sq:sk, cat:r.cat};
    out.push({r, st});
  });
  Object.entries(sqNew).forEach(([k,s])=>W["squadre/" + k] = s);
  return {W, out, sqNew};
}
function impPrevHTML(){
  if(!anImp.trim()) return "";
  const {rows, errs} = parseImp(anImp), {out, sqNew} = planImp(rows), ch = out.filter(x=>x.st!=="già presente").length, ns = Object.keys(sqNew).length;
  return (errs.length ? `<p class="err">Righe scartate:<br>${errs.map(esc).join("<br>")}</p>` : "") +
    (ns ? `<p class="hint">Squadre nuove: ${Object.values(sqNew).map(s=>esc(s.nome)).join(", ")}</p>` : "") +
    (out.length ? `<div class="antw"><table class="ant"><thead><tr><th>Giocatore</th><th>Squadra</th><th>Cat.</th><th>Anno</th><th></th></tr></thead><tbody>` +
      out.map(x=>`<tr><td>${esc(tabName({cognome:x.r.cognome, nome:x.r.nome}))}</td><td>${esc(x.r.squadra)}</td><td>${esc(x.r.cat || "—")}</td><td>${stagLabel(x.r.anno)}</td><td class="${x.st==="già presente" ? "d" : "n"}">${esc(x.st)}</td></tr>`).join("") + `</tbody></table></div>` : "") +
    `<button data-aimp${ch || ns ? "" : " disabled"}>${ch ? `Importa ${ch} ${ch===1 ? "riga" : "righe"}` : ns ? "Crea le squadre" : "Niente da importare"}</button><p class="hint" id="an-im"></p>`;
}
async function doImport(){
  const {rows} = parseImp(anImp), {W, out} = planImp(rows), ch = out.filter(x=>x.st!=="già presente").length;
  if(!Object.keys(W).length) return;
  const b = $("[data-aimp]"); if(b){ b.disabled = true; b.textContent = "Importazione…"; }
  try{ await dbWrite(W); anImp = ""; render(); const m = $("#an-im") || null; setTimeout(()=>{ const p = $("#an-prev"); if(p) p.innerHTML = `<p class="hint">Fatto: ${ch} ${ch===1 ? "riga importata" : "righe importate"}.</p>`; }, 0); }
  catch(err){ const m = $("#an-im"); if(m) m.textContent = wErr(err); if(b){ b.disabled = false; b.textContent = "Riprova"; } }
}
/* ---- scheda giocatore / squadra (finestra #anm) ---- */
const yearOpts = sel => { const s = new Set([stagione() + 1, sel]); for(let y = stagione(); y>=2015; y--) s.add(y); return [...s].filter(Boolean).sort((a,b)=>b-a).map(y=>`<option value="${y}"${y===sel ? " selected" : ""}>${stagLabel(y)}</option>`).join(""); };
/* NEWSQ = voce "+ Nuova squadra…": la squadra si crea insieme al giocatore, al Salva */
const NEWSQ = "__nuova__";
const sqOpts = sel => sqSorted().map(([k,s])=>`<option value="${esc(k)}"${k===sel ? " selected" : ""}>${esc(s.nome)}</option>`).join("") + (sel && sel!==NEWSQ && !(SQUADRE||{})[sel] ? `<option value="${esc(sel)}" selected>${esc(sel)}</option>` : "")
  + `<option value="${NEWSQ}"${sel===NEWSQ ? " selected" : ""}>+ Nuova squadra…</option>`;
const yrow = (y, r) => `<div class="row yr"><label>Anno sportivo<select data-yy>${yearOpts(y)}</select></label><label class="ys">Squadra<select data-ys>${sqOpts(r.sq)}</select></label>
  <label>Categoria<select data-yc><option value="">—</option>${CATS.map(c=>`<option value="${c}"${c===r.cat ? " selected" : ""}>${catShort(c)}</option>`).join("")}</select></label><button class="yx" data-yx title="Togli questo anno" aria-label="Togli questo anno">✕</button>
  <div class="nsq"${r.sq===NEWSQ ? "" : " hidden"}><label>Nome della nuova squadra<input data-nsn value="${esc(r.nsn||"")}" autocomplete="off"></label><label>Città<input data-nsc value="${esc(r.nsc||"")}" placeholder="es. Ferrara (FE)" autocomplete="off"></label></div></div>`;
const anMsg = t => { const m = $("#an-m"); if(m) m.textContent = t; };
const delLabel = () => anEd.del && Date.now() - anEd.del < 4000 ? "Conferma: elimina" : "Elimina";
function openPlayer(k, pre){
  const SQ = SQUADRE || {}, y = pre ? pre.y : (anStag ?? stagione());
  const sq0 = pre && pre.sq && SQ[pre.sq] ? pre.sq : anSq && SQ[anSq] ? anSq : SQ[CLUBSQ] ? CLUBSQ : sqSorted().length ? sqSorted()[0][0] : NEWSQ;
  const p = k ? clone(ANAG[k]) : {cognome:pre ? pre.cognome : "", nome:pre ? pre.nome : "", anni:{[y]: {sq:sq0, cat:""}}};
  anEd = {kind:"p", k, p, del:0, link:pre && pre.link, ck:pre && pre.ck}; paintPlayer(); $("#anm").hidden = false;
  if(!k) setTimeout(()=>{ const x = pre && pre.cognome ? $("#an-n") : $("#an-c"); if(x) x.focus(); }, 30);
}
function paintPlayer(){
  const p = anEd.p, ys = anniOf(p).sort((a,b)=>b-a);
  $("#anm .bx").innerHTML = `<h3>${anEd.k ? esc(tabName(p) || "Giocatore") : "Nuovo giocatore"}</h3>
    <div class="row"><label>Cognome<input id="an-c" value="${esc(p.cognome||"")}" autocomplete="off"></label><label>Nome<input id="an-n" value="${esc(p.nome||"")}" autocomplete="off"></label></div>
    <div class="row"><label>Soprannome<input id="an-s" value="${esc(p.sopr||"")}" placeholder="facoltativo" autocomplete="off"></label><label>Nome sul tabellone<input id="an-t" value="${esc(p.tab||"")}" placeholder="${esc(tabName(Object.assign({}, p, {tab:""})) || "automatico")}" autocomplete="off"></label></div>
    <div class="ftr"><div id="an-fimg">${fotoBox()}</div><div class="fb2"><button class="addf" data-afo>${fotoCur() || fotoCur()===null ? "Cambia foto" : "Carica foto"}</button>${fotoCur() || fotoCur()===null ? `<button class="addf" data-afx>Togli foto</button>` : ""}
      <p class="hint">Facoltativa: si vede nella pagina pubblica del giocatore. Viene rimpicciolita da sola (400 pixel); va bene anche quadrata, come gli avatar del circolo.</p></div></div>
    <h4>Squadra e categoria per anno sportivo</h4><div id="an-y">${ys.map(y=>yrow(y, p.anni[y])).join("")}</div>
    <button class="addf" data-ay>+ Aggiungi anno</button>
    <p class="hint">Sul tabellone: cognome e iniziale del nome, poi la categoria dell'anno della gara, per esempio “${esc(tabName(Object.assign({}, p, {tab:""})) || "Galli E.")} (${esc(rowAt(p, stagione()).cat || "2")})”. Scrivi il nome sul tabellone solo per distinguere due omonimi.</p>
    <p class="err" id="an-m"></p>
    <div class="btns">${anEd.k ? `<button class="ghost" data-adel>${delLabel()}</button>` : ""}<span class="sp1"></span><button class="ghost" data-ano>Annulla</button><button data-aok>Salva</button></div>`;
}
/* foto nella scheda: anEd.foto undefined = invariata, data URL = nuova, "" = da togliere */
const fotoCur = () => anEd.foto!==undefined ? anEd.foto : anEd.k ? fotoGet(anEd.k, ANAG[anEd.k], ()=>{ const b = $("#an-fimg"); if(b && anEd && anEd.kind==="p") b.innerHTML = fotoBox(); }) : "";
function fotoBox(){ const u = fotoCur(); return u ? `<img src="${esc(u)}" alt="Foto">` : u===null ? `<span class="fph">…</span>` : `<span class="fph">${esc(String((anEd.p.cognome||"?")).charAt(0).toUpperCase())}</span>`; }
function readPlayer(){
  const p = anEd.p, v = id => $(id).value.trim();
  p.cognome = v("#an-c"); p.nome = v("#an-n"); p.sopr = v("#an-s"); p.tab = v("#an-t");
  const anni = {}, dup = [];
  $("#anm").querySelectorAll(".yr").forEach(r=>{ const y = +r.querySelector("[data-yy]").value; if(anni[y]) dup.push(stagLabel(y));
    anni[y] = {sq:r.querySelector("[data-ys]").value, cat:r.querySelector("[data-yc]").value};
    if(anni[y].sq===NEWSQ){ anni[y].nsn = r.querySelector("[data-nsn]").value.trim(); anni[y].nsc = r.querySelector("[data-nsc]").value.trim(); } });
  p.anni = anni; return dup;
}
async function savePlayer(){
  const dup = readPlayer(), p = anEd.p;
  if(!p.cognome) return anMsg("Scrivi almeno il cognome");
  if(dup.length) return anMsg("Anno sportivo ripetuto: " + dup.join(", "));
  if(!anniOf(p).length) return anMsg("Aggiungi almeno un anno sportivo con la squadra");
  /* squadre nuove scritte nella scheda: se il nome esiste già si usa quella, altrimenti si crea (una sola volta anche se ripetuta in più anni) */
  const NS = {}, SQ = SQUADRE || {};
  for(const y of anniOf(p)){ const r = p.anni[y]; if(r.sq!==NEWSQ) continue;
    if(!r.nsn){ anMsg(`Scrivi il nome della nuova squadra (${stagLabel(y)})`); const i = $("#anm [data-nsn]"); if(i) i.focus(); return; }
    const ex = findSq(r.nsn), key = ex || Object.keys(NS).find(kk=>NS[kk].nome.toLowerCase()===r.nsn.toLowerCase());
    if(key){ r.sq = key; continue; }
    const b = slug(r.nsn) || "squadra"; let kk = b, n = 2; while(SQ[kk] || NS[kk]) kk = b + "-" + n++;
    NS[kk] = {nome:r.nsn, citta:r.nsc || ""}; r.sq = kk; }
  for(const y of anniOf(p)){ delete p.anni[y].nsn; delete p.anni[y].nsc; }
  let k = anEd.k;
  if(!k){ const b = slug(p.cognome) + "-" + (p.nome ? slug(p.nome) : rowAt(p, stagione()).sq); k = b; let n = 2; while(ANAG[k]) k = b + "-" + n++; }
  const tn = tabName(p).toLowerCase(), ys = anniOf(p);
  const twin = Object.entries(ANAG).find(([kk,q])=>kk!==k && tabName(q).toLowerCase()===tn && anniOf(q).some(y=>ys.includes(y)));
  if(twin && anEd.twin!==tn){ anEd.twin = tn; return anMsg(`Anche ${[twin[1].nome, twin[1].cognome].filter(Boolean).join(" ")} compare come “${tabName(p)}”: scrivi un nome sul tabellone diverso, oppure premi di nuovo Salva per lasciarlo così.`); }
  const val = {cognome:p.cognome, nome:p.nome, anni:p.anni}; if(p.sopr) val.sopr = p.sopr; if(p.tab) val.tab = p.tab;
  const fo = anEd.foto, W = {["giocatori/" + k]: val};
  for(const kk in NS) W["squadre/" + kk] = NS[kk];
  if(fo){ val.foto = Date.now(); W["foto/" + k] = fo; FOTO[fotoKey(k, val)] = fo; }
  else if(fo===""){ if(anEd.k) W["foto/" + k] = null; }
  else if(p.foto) val.foto = p.foto;
  const link = anEd.link, ckg = anEd.ck && CK && ckGroups(scanNames(CK)).find(x=>x.id===anEd.ck);   /* il gruppo si legge prima che il nuovo giocatore lo "riconosca" */
  try{ await dbWrite(W); closeAn(); } catch(err){ anMsg(wErr(err)); return; }
  if(ckg){ const g = ckg; ANAG = Object.assign({}, ANAG, {[k]: val});   /* creato dal controllo nomi: collega subito il gruppo */
    if(g) ckApply(g.occ.map(o=>({o, k})), `Creato ${tabName(val)} e collegato in ${g.occ.length} ${g.occ.length===1 ? "casella" : "caselle"}.`); }
  if(link && S && mode==="board"){ const [i, sd, j] = link.split("."), m = S.matches[+i];   /* aggiunto dalla gara: la casella si collega al nuovo giocatore */
    if(m){ ANAG = Object.assign({}, ANAG, {[k]: val}); snapshot(); m[sd][+j] = tabName(val);
      if(!isTorneo()){ if(!Array.isArray(m[sd + "c"])) m[sd + "c"] = m[sd].map(()=>""); m[sd + "c"][+j] = k; } commit(); } }
}
function openSquad(k){
  const s = k ? clone(SQUADRE[k]) : {nome:"", citta:""};
  anEd = {kind:"s", k, s, del:0}; paintSquad(); $("#anm").hidden = false; if(!k) setTimeout(()=>{ const x = $("#as-n"); if(x) x.focus(); }, 30);
}
function paintSquad(){
  const s = anEd.s, club = isClub(anEd.k);
  $("#anm .bx").innerHTML = `<h3>${anEd.k ? esc(s.nome) : "Nuova squadra"}</h3>
    <div class="row"><label>Nome<input id="as-n" value="${esc(s.nome||"")}" autocomplete="off"></label><label>Città<input id="as-c" value="${esc(s.citta||"")}" placeholder="es. Ferrara (FE)" autocomplete="off"></label></div>
    ${club ? `<p class="hint">Il logo del circolo è già nella pagina.</p>` : `<div class="lgr">${sqLogo("", s)}<button class="addf" data-alg>${s.logo ? "Cambia logo" : "Carica logo"}</button>${s.logo ? `<button class="addf" data-alx>Togli logo</button>` : ""}</div>
      <p class="hint">Il logo e la città vengono messi da soli nelle nuove gare contro questa squadra.</p>`}
    <p class="err" id="an-m"></p>
    <div class="btns">${anEd.k && !club ? `<button class="ghost" data-adel>${delLabel()}</button>` : ""}<span class="sp1"></span><button class="ghost" data-ano>Annulla</button><button data-aok>Salva</button></div>`;
}
const readSquad = () => { anEd.s.nome = $("#as-n").value.trim(); anEd.s.citta = $("#as-c").value.trim(); };
async function saveSquad(){
  readSquad(); const s = anEd.s;
  if(!s.nome) return anMsg("Scrivi il nome della squadra");
  const same = findSq(s.nome); if(same && same!==anEd.k) return anMsg("Esiste già una squadra con questo nome");
  let k = anEd.k; if(!k){ const b = slug(s.nome) || "squadra"; k = b; let n = 2; while(SQUADRE[k]) k = b + "-" + n++; }
  const val = {nome:s.nome, citta:s.citta}; if(s.logo) val.logo = s.logo;
  try{ await dbWrite({["squadre/" + k]: val}); closeAn(); } catch(err){ anMsg(wErr(err)); }
}
async function anDelete(){
  if(!(anEd.del && Date.now() - anEd.del < 4000)){ if(anEd.kind==="p") readPlayer(); else readSquad(); anEd.del = Date.now();
    const b = $("[data-adel]"); if(b){ b.textContent = delLabel(); b.classList.add("arm"); } setTimeout(()=>{ const b2 = $("[data-adel]"); if(b2 && anEd && !(Date.now() - anEd.del < 4000)){ b2.textContent = delLabel(); b2.classList.remove("arm"); } }, 4100); return; }
  if(anEd.kind==="s"){ const n = Object.values(ANAG).filter(p=>anniOf(p).some(y=>p.anni[y].sq===anEd.k)).length;
    if(n) return anMsg(`Non si può eliminare: ${n} ${n===1 ? "giocatore ha" : "giocatori hanno"} questa squadra in almeno un anno.`); }
  const W = anEd.kind==="p" ? {["giocatori/" + anEd.k]: null, ["foto/" + anEd.k]: null} : {["squadre/" + anEd.k]: null};
  try{ await dbWrite(W); closeAn(); } catch(err){ anMsg(wErr(err)); }
}
function closeAn(){ $("#anm").hidden = true; anEd = null; }
$("#anm").addEventListener("click", e=>{
  if(!anEd) return; const t = e.target;
  if(t.closest("[data-ano]")){ closeAn(); return; }
  if(t.closest("[data-aok]")){ anEd.kind==="p" ? savePlayer() : saveSquad(); return; }
  if(t.closest("[data-adel]")){ anDelete(); return; }
  if(t.closest("[data-ay]")){ readPlayer(); const p = anEd.p, ys = anniOf(p), y = ys.length ? Math.max(...ys) + 1 : stagione(); p.anni[y] = Object.assign({}, ys.length ? p.anni[Math.max(...ys)] : {sq:CLUBSQ, cat:""}); paintPlayer(); return; }
  const yx = t.closest("[data-yx]"); if(yx){ yx.closest(".yr").remove(); return; }
  if(t.closest("[data-afo]")){ $("#anfoto").click(); return; }
  if(t.closest("[data-afx]")){ readPlayer(); anEd.foto = ""; paintPlayer(); return; }
  if(t.closest("[data-alg]")){ readSquad(); $("#anlogo").click(); return; }
  if(t.closest("[data-alx]")){ readSquad(); delete anEd.s.logo; paintSquad(); return; }
});
$("#anm").addEventListener("change", e=>{
  const s = e.target.closest("[data-ys]"); if(!s || !anEd) return;
  const box = s.closest(".yr").querySelector(".nsq"), on = s.value===NEWSQ; box.hidden = !on;
  if(on){ const i = box.querySelector("[data-nsn]"); if(i) i.focus(); }
});
$("#anm").addEventListener("keydown", e=>{ if(e.key==="Escape") closeAn(); if(e.key==="Enter" && e.target.tagName==="INPUT"){ e.preventDefault(); anEd && (anEd.kind==="p" ? savePlayer() : saveSquad()); } });
$("#anlogo").addEventListener("change", ()=>{
  const inp = $("#anlogo"), f = inp.files[0]; if(!f || !anEd || anEd.kind!=="s") return;
  const rd = new FileReader();
  rd.onload = () => { const im = new Image();
    im.onload = () => { const M = 160, k = Math.min(1, M/Math.max(im.width||M, im.height||M));
      const c = document.createElement("canvas"); c.width = Math.round((im.width||M)*k); c.height = Math.round((im.height||M)*k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); anEd.s.logo = c.toDataURL("image/png"); inp.value = ""; paintSquad(); };
    im.src = rd.result; };
  rd.readAsDataURL(f);
});
$("#anfoto").addEventListener("change", ()=>{
  const inp = $("#anfoto"), f = inp.files[0]; inp.value = ""; if(!f || !anEd || anEd.kind!=="p") return;
  anMsg("Preparo la foto…");
  fotoResize(f, u=>{ if(!anEd || anEd.kind!=="p") return; if(!u){ anMsg("Non riesco a leggere questa immagine: prova con un JPG o un PNG."); return; }
    readPlayer(); anEd.foto = u; paintPlayer(); });
});
/* eventi della pagina anagrafica */
app.addEventListener("click", e=>{
  if(mode!=="anag") return; const t = e.target;
  const at = t.closest("[data-antab]"); if(at){ anTab = at.dataset.antab; render(); return; }
  if(t.closest("[data-annew]")){ openPlayer(null); return; }
  const ap = t.closest("[data-anp]"); if(ap){ openPlayer(ap.dataset.anp); return; }
  if(t.closest("[data-snew]")){ openSquad(null); return; }
  const as = t.closest("[data-ans]"); if(as){ openSquad(as.dataset.ans); return; }
  if(t.closest("[data-aimp]")){ doImport(); return; }
  const cp = t.closest("[data-acp]"); if(cp){ const x = $("#an-exp"); x.select(); try{ navigator.clipboard.writeText(x.value).then(()=>{ cp.textContent = "Copiato ✓"; }, ()=>{ document.execCommand("copy"); cp.textContent = "Copiato ✓"; }); }catch(err){ document.execCommand("copy"); cp.textContent = "Copiato ✓"; } return; }
});
app.addEventListener("change", e=>{
  if(mode!=="anag") return;
  if(e.target.id==="an-st"){ anStag = +e.target.value; e.target.blur(); render(); }
  if(e.target.id==="an-sq"){ anSq = e.target.value; e.target.blur(); render(); }
});
app.addEventListener("input", e=>{
  if(mode==="anag" && e.target.id==="an-q"){ anQ = e.target.value; $("#an-list").innerHTML = anListHTML(); }
  if(mode==="anag" && e.target.id==="an-imp"){ anImp = e.target.value; $("#an-prev").innerHTML = impPrevHTML(); }
  if(mode==="regiahome" && e.target.id==="ng-o"){ const k = findSq(e.target.value), c = $("#ng-c");
    if(k && c && (!c.value || c.dataset.auto==="1")){ c.value = SQUADRE[k].citta || ""; c.dataset.auto = "1"; } }
  if(e.target.id==="ng-c") e.target.dataset.auto = "";
});

