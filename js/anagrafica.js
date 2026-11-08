/* Tabellone Live · anagrafica.js — Anagrafica: giocatori, circoli, squadre, import/export
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= anagrafica: giocatori, circoli e squadre =================
   giocatori/<codice> = {cognome, nome, sopr?, tab?, foto?, anni:{<anno sportivo>: {csb:<codice circolo>, cat:"NP"|"N"|"M"|"1"|"2"|"3", squadre?:{<codice squadra>:true}}}}
     (NP = Nazionale Pro, N = Nazionale, M = Master). Nelle gare singole e a coppie il giocatore rappresenta il suo circolo;
     "squadre" = squadre dei campionati in cui gioca quell'anno (anche più d'una, per esempio Base ed Eccellenza; facoltativo).
   circoli/<codice> = {nome, citta, logo?}
   squadre/<codice> = {nome, csb:<codice circolo>, camp?:"base"|"eccellenza", logo?}: squadre dei campionati a squadre, ognuna rappresenta un circolo
     ma può schierare anche giocatori iscritti ad altri circoli (l'iscrizione sta sul giocatore: anni.squadre).
     Il nome può essere quello di uno sponsor (es. "Minerva 2000" per il circolo Time Out). Senza logo si usa quello del circolo.
   Prima dell'8/11/2026 c'erano solo le squadre (che erano i circoli) e anni.sq = codice squadra: la separazione si fa una volta
   con il pulsante della regia (anMigrate); finché non è fatta, le funzioni qui sotto leggono i dati vecchi allo stesso modo.
   anno sportivo = anno di inizio (2026 = 2026/27, da settembre ad agosto). Il codice del giocatore nasce alla prima registrazione e non cambia più. */
let ANAG = null, SQUADRE = null, CIRCOLI = null, anErr = "", anTab = "g", anStag = null, anFil = "", anQ = "", anImp = "", anEd = null, anWatch = false, anMigMsg = "", anMigBusy = false;
const CATS = ["NP","N","M","1","2","3"];
const CATN = {NP:"Nazionale Pro", N:"Nazionale", M:"Master"};
const catShort = c => CATN[c] || (c ? c + "ª" : "");   /* tendina della scheda */
const catLabel = c => CATN[c] ? "cat. " + CATN[c] : c ? c + "ª cat." : "";   /* elenchi e pagine: "cat. Master", "2ª cat." */
const stagione = d => { const x = String(d || today()), y = +x.slice(0,4), m = +x.slice(5,7); return m>=9 ? y : y-1; };
const stagLabel = y => `${y}/${String(+y+1).slice(2)}`;
const anniOf = p => Object.keys((p && p.anni) || {}).map(Number).sort((a,b)=>a-b);
function rowAt(p, y){ const ys = anniOf(p); if(!ys.length) return {}; const k = ys.filter(x=>x<=y).pop() ?? ys[0]; return p.anni[k] || {}; }
function tabName(p){ if(!p) return ""; if(p.tab) return p.tab; const n = String(p.nome||"").trim(); return String(p.cognome||"").trim() + (n ? " " + n.charAt(0).toUpperCase() + "." : ""); }
const low = t => String(t||"").trim().toLowerCase();
/* ---- circoli ---- */
const CLUBCSB = slug(CLUB.name);   /* il nostro circolo */
const CLUBSQ = CLUBCSB;            /* squadra di casa delle gare create prima che le squadre del circolo fossero più d'una */
const isClub = k => !!k && k===CLUBCSB;   /* k = codice di un circolo */
const csbOf = r => (r && (r.csb || (typeof r.sq==="string" ? r.sq : ""))) || "";   /* circolo di una riga anni (dati vecchi: anni.sq) */
/* squadre di prima della separazione: senza il campo csb (erano i circoli). Finché ce ne sono valgono anche come circoli */
const oldSq = () => Object.entries(SQUADRE||{}).filter(([k,s])=>s && !s.csb);
const needMig = () => oldSq().length>0;
const circoliAll = () => Object.assign(Object.fromEntries(oldSq()), CIRCOLI || {});
const csbObj = k => (k && ((CIRCOLI && CIRCOLI[k]) || (SQUADRE && SQUADRE[k] && !SQUADRE[k].csb && SQUADRE[k]))) || null;
const csbName = k => (csbObj(k) || {}).nome || (isClub(k) ? CLUB.name : k) || "";
const csbCitta = k => (csbObj(k) || {}).citta || (isClub(k) ? CLUB.city : "");
const csbSorted = () => Object.entries(circoliAll()).sort((a,b)=>isClub(b[0])-isClub(a[0]) || String(a[1].nome).localeCompare(String(b[1].nome)));
const findCsb = nome => { nome = low(nome); if(!nome) return ""; const x = Object.entries(circoliAll()).find(([k,c])=>low(c.nome)===nome); return x ? x[0] : ""; };
/* ---- squadre dei campionati ---- */
const CAMPN = {base:"Base", eccellenza:"Eccellenza"};
const campOf = f => /^base/.test(f||"") ? "base" : f==="eccellenza" ? "eccellenza" : "";   /* campionato di una formula di gara */
const sqCsb = k => { const s = SQUADRE && SQUADRE[k]; return (s && s.csb) || k || ""; };   /* circolo di una squadra (dati vecchi: stesso codice) */
const isClubSq = k => isClub(sqCsb(k));
const sqName = k => (SQUADRE && SQUADRE[k] && SQUADRE[k].nome) || k || "";
const sqLabel = k => { const s = (SQUADRE||{})[k] || {}; return (s.nome || k) + (s.camp ? " · " + CAMPN[s.camp] : ""); };
const sqCitta = k => csbCitta(sqCsb(k)) || ((SQUADRE||{})[k] || {}).citta || "";
const sqLogoSrc = k => { const s = (SQUADRE||{})[k]; return (s && s.logo) || (csbObj(sqCsb(k)) || {}).logo || ""; };
const sqsOf = r => Object.keys((r && r.squadre) || {}).filter(k=>r.squadre[k]);
const inTeam = (r, sq) => !!(sq && r && r.squadre && r.squadre[sq]);
const sqSorted = () => Object.entries(SQUADRE||{}).sort((a,b)=>isClubSq(b[0])-isClubSq(a[0]) || String(a[1].nome).localeCompare(String(b[1].nome)) || String(a[1].camp||"").localeCompare(String(b[1].camp||"")));
/* squadra dal nome: se due squadre hanno lo stesso nome (una per campionato) vale quella del campionato indicato */
const findSq = (nome, camp) => { nome = low(nome); if(!nome) return ""; const xs = Object.entries(SQUADRE||{}).filter(([k,s])=>low(s.nome)===nome); if(!xs.length) return "";
  return ((camp && xs.find(([k,s])=>s.camp===camp)) || xs.find(([k,s])=>!s.camp) || xs[0])[0]; };
const clubTeams = () => sqSorted().filter(([k])=>isClubSq(k));
/* ---- loghi ---- */
const logoImg = (src, nome) => src ? `<img src="${esc(src)}" alt="">` : `<i class="sb">${esc(String(nome||"?").charAt(0).toUpperCase())}</i>`;
const csbLogo = k => isClub(k) ? `<img src="${LOGO_HOME}" alt="">` : logoImg((csbObj(k) || {}).logo, csbName(k));
const sqLogo = k => isClubSq(k) ? `<img src="${LOGO_HOME}" alt="">` : logoImg(sqLogoSrc(k), sqName(k));
function parseCat(t){ t = String(t||"").trim().toUpperCase().replace(/^CAT(EGORIA)?\.?\s*/, "");
  if(/^(NP|PRO|NAZ\w*\.?\s*PRO)/.test(t)) return "NP"; if(/^(N|NAZ)/.test(t)) return "N"; if(/^M/.test(t)) return "M"; const n = t.match(/^[1-3]/); return n ? n[0] : ""; }
function parseAnno(t){ const m = String(t||"").match(/(20\d\d)/); return m ? +m[1] : null; }
const wErr = err => err && err.code==="PERMISSION_DENIED" ? "Firebase rifiuta la scrittura: controlla che le regole del database abbiano i nodi giocatori, circoli, squadre e foto (vedi LEGGIMI)" : "Salvataggio non riuscito (" + ((err && (err.code||err.message)) || "?") + ")";
const newKey = (base, used) => { const b = slug(base) || "x"; let k = b, n = 2; while(used(k)) k = b + "-" + n++; return k; };
function watchAnag(){
  if(anWatch) return; anWatch = true;
  /* se la lettura viene rifiutata (regole non ancora pubblicate) si riprova da soli ogni 5 secondi */
  const okG = {g:false, s:false, c:false};
  const watch = (path, key, set) => db.ref(path).on("value", s=>{ set(s.val() || {}); okG[key] = true; if(okG.g && okG.s && okG.c) anErr = ""; anRepaint(); }, ()=>{
    okG[key] = false; anErr = "Non riesco a leggere l'anagrafica: controlla che nelle regole del database ci siano i nodi giocatori, circoli e squadre. Riprovo da solo…";
    ANAG = ANAG || {}; SQUADRE = SQUADRE || {}; CIRCOLI = CIRCOLI || {}; anRepaint(); setTimeout(()=>watch(path, key, set), 5000); });
  watch("giocatori", "g", v=>ANAG = v);
  watch("squadre", "s", v=>SQUADRE = v);
  watch("circoli", "c", v=>CIRCOLI = v);
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
  else if(mode==="regiahome"){ const d = $("#sq-dl"); if(d) d.innerHTML = sqDatalist(); ngTeamsRefresh(); }
  else if(mode==="board" && S) render();
  else if(mode==="gioc") render();
  else if(mode==="giocs"){ if(document.activeElement && document.activeElement.id==="gs-q"){ const l = $("#gs-list"); if(l) l.innerHTML = giocsList(); } else render(); }
}
/* nuova gara: squadre avversarie (prima quelle del campionato scelto) e la nostra squadra */
const sqDatalist = camp => { camp = camp ?? campOf(($("#ng-f") || {}).value);
  const seen = new Set(); return sqSorted().filter(([k])=>!isClubSq(k)).sort((a,b)=>(b[1].camp===camp) - (a[1].camp===camp))
    .filter(([k,s])=>{ const n = low(s.nome); if(seen.has(n)) return false; seen.add(n); return true; }).map(([k,s])=>`<option value="${esc(s.nome)}"></option>`).join(""); };
function ngTeamOpts(formula, sel){
  const L = clubTeams(), camp = campOf(formula);
  if(!L.length) return `<option value="">${esc(CLUB.name)}</option>`;
  const def = sel && L.some(([k])=>k===sel) ? sel : ((L.find(([k,s])=>s.camp===camp) || L.find(([k,s])=>!s.camp) || L[0])[0]);
  return L.map(([k,s])=>`<option value="${esc(k)}"${k===def ? " selected" : ""}>${esc(sqLabel(k))}</option>`).join("");
}
function ngTeamsRefresh(keep){
  const s = $("#ng-ns"), f = $("#ng-f"); if(!s || !f || document.activeElement===s) return;
  const cur = keep ? s.value : (s.dataset.manual==="1" ? s.value : "");
  s.innerHTML = ngTeamOpts(f.value, cur);
  const w = $("#ng-nsw"); if(w) w.hidden = clubTeams().length<2;
  const d = $("#sq-dl"); if(d) d.innerHTML = sqDatalist(campOf(f.value));
}
function anYears(){ const s = new Set([stagione()]); Object.values(ANAG||{}).forEach(p=>anniOf(p).forEach(y=>s.add(y))); return [...s].sort((a,b)=>b-a); }
function anagHTML(){
  if(anStag===null) anStag = stagione();
  let h = `<main class="wrap"><div class="top"><div><div class="comp">Giocatori, circoli e squadre</div><div class="sub">Anagrafica · anno sportivo ${stagLabel(stagione())}</div></div><a class="ghost" href="?regia">← Regia</a></div>`;
  if(anErr) h += `<p class="err">${esc(anErr)}</p>`;
  if(ANAG===null || SQUADRE===null || CIRCOLI===null) return h + `<p class="empty">Caricamento…</p></main>`;
  if(needMig()) return h + anMigHTML() + `</main>`;
  h += `<div class="pills">${[["g","Giocatori"],["o","Circoli"],["s","Squadre"],["i","Importa / esporta"],["c","Controllo nomi"]].map(([k,t])=>`<button class="pill${anTab===k ? " on" : ""}" data-antab="${k}">${t}</button>`).join("")}</div>`;
  if(anMigMsg) h += `<p class="hint ok">${esc(anMigMsg)}</p>`;
  if(anTab==="c" && !CK && !ckBusy) setTimeout(ckLoad);
  return h + (anTab==="g" ? anGiocHTML() : anTab==="o" ? anCsbHTML() : anTab==="s" ? anSqHTML() : anTab==="c" ? ckHTML() : anImpHTML()) + `</main>`;
}
/* ---- separazione di circoli e squadre (una volta sola) ---- */
function anMigHTML(){
  const ns = oldSq().length, np = Object.values(ANAG).filter(p=>anniOf(p).some(y=>typeof p.anni[y].sq==="string")).length;
  return `<section class="panel"><h2>Circoli e squadre: un passo da fare una volta sola</h2>
    <p class="hint">Da oggi l'anagrafica distingue il <b>circolo</b> di un giocatore (che rappresenta nelle gare singole e a coppie) dalle <b>squadre</b>
    dei campionati a squadre (che possono essere più d'una per circolo e avere il nome di uno sponsor, come “Minerva 2000” per il Time Out).</p>
    <p class="hint">Premendo il pulsante, ognuna delle ${ns} squadre di oggi diventa anche un circolo con lo stesso nome, città e logo, e resta come squadra di quel circolo;
    per ${np} ${np===1 ? "giocatore" : "giocatori"} la squadra di ogni anno diventa il circolo. Le gare non si toccano. Dopo potrai rinominare le squadre,
    aggiungere la seconda squadra del circolo, togliere quelle che non giocano i campionati e indicare chi gioca in ogni squadra.</p>
    <p class="hint">Prima conviene scaricare una copia di sicurezza. Le regole del database devono già avere il nodo <code>circoli</code> (vedi LEGGIMI).</p>
    <div class="anf"><button class="ghost" data-ckbk>⬇ Copia di sicurezza</button><button data-amig${anMigBusy ? " disabled" : ""}>${anMigBusy ? "Separazione in corso…" : "Separa circoli e squadre"}</button></div>
    ${anMigMsg ? `<p class="err">${esc(anMigMsg)}</p>` : ""}</section>`;
}
function migWrites(){
  const W = {};
  oldSq().forEach(([k,s])=>{ const c = {nome:s.nome || k, citta:s.citta || ""}; if(s.logo) c.logo = s.logo;
    if(!(CIRCOLI||{})[k]) W["circoli/" + k] = c; W["squadre/" + k] = {nome:s.nome || k, csb:k}; });   /* il logo passa al circolo: la squadra lo eredita */
  Object.entries(ANAG||{}).forEach(([pk,p])=>anniOf(p).forEach(y=>{ const r = p.anni[y]; if(typeof r.sq!=="string") return;
    W[`giocatori/${pk}/anni/${y}/csb`] = r.sq; W[`giocatori/${pk}/anni/${y}/sq`] = null; }));
  return W;
}
async function anMigrate(){
  if(anMigBusy || !needMig()) return; anMigBusy = true; anMigMsg = ""; render();
  try{ await dbWrite(migWrites()); anMigMsg = "Fatto: circoli e squadre separati. Ora controlla le squadre (scheda Squadre) e il campionato di ognuna."; anTab = "s"; }
  catch(err){ anMigMsg = wErr(err); }
  anMigBusy = false; render();
}
/* ---- elenchi ---- */
const stagSel = () => `<select id="an-st" aria-label="Anno sportivo">${anYears().map(y=>`<option value="${y}"${y===anStag ? " selected" : ""}>${stagLabel(y)}</option>`).join("")}</select>`;
function anGiocHTML(){
  return `<div class="anf">${stagSel()}
    <select id="an-fil" aria-label="Circolo o squadra"><option value="">Tutti i circoli</option><optgroup label="Circoli">${csbSorted().map(([k,c])=>`<option value="c:${esc(k)}"${"c:" + k===anFil ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}</optgroup>
      ${sqSorted().length ? `<optgroup label="Squadre">${sqSorted().map(([k])=>`<option value="s:${esc(k)}"${"s:" + k===anFil ? " selected" : ""}>${esc(sqLabel(k))}</option>`).join("")}</optgroup>` : ""}</select>
    <input id="an-q" type="search" placeholder="Cerca…" value="${esc(anQ)}" autocomplete="off"><button class="ghost" data-annew>+ Nuovo giocatore</button></div>
    <div id="an-list">${anListHTML()}</div>`;
}
const filOk = r => !anFil || (anFil.startsWith("c:") ? csbOf(r)===anFil.slice(2) : inTeam(r, anFil.slice(2)));
const sortByCsb = (a,b) => isClub(csbOf(b.r))-isClub(csbOf(a.r)) || csbName(csbOf(a.r)).localeCompare(csbName(csbOf(b.r))) || String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||""));
const sqsTxt = r => sqsOf(r).map(sqName).join(", ");
function anListHTML(){
  const q = anQ.trim().toLowerCase();
  const rows = Object.entries(ANAG).map(([k,p])=>({k, p, r:(p.anni||{})[anStag]}))
    .filter(x=>x.r && filOk(x.r) && (!q || [x.p.cognome, x.p.nome, x.p.sopr, tabName(x.p)].join(" ").toLowerCase().includes(q)));
  if(!rows.length) return `<p class="empty">${Object.keys(ANAG).length ? "Nessun giocatore con una riga per il " + stagLabel(anStag) + (q || anFil ? " con questi filtri" : "") + "." : "L'elenco è vuoto: aggiungi un giocatore o importa una tabella."}</p>`;
  rows.sort(sortByCsb);
  const g = new Map(); rows.forEach(x=>{ const c = csbOf(x.r); if(!g.has(c)) g.set(c, []); g.get(c).push(x); });
  return [...g].map(([c, xs])=>`<h3 class="ang">${esc(csbName(c))} <span>${xs.length}</span></h3><div class="anl">` + xs.map(x=>
    `<button class="anr" data-anp="${esc(x.k)}"><b>${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""}${x.p.foto ? ` <i class="hf" title="Ha la foto">📷</i>` : ""}</b><span>${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))}${x.p.sopr ? ` · “${esc(x.p.sopr)}”` : ""} · ${esc(catLabel(x.r.cat) || "categoria da indicare")}${sqsOf(x.r).length ? ` · <i class="tsq">${esc(sqsTxt(x.r))}</i>` : ""}</span></button>`).join("") + `</div>`).join("");
}
function anCsbHTML(){
  const cnt = {}; Object.values(ANAG).forEach(p=>{ const r = (p.anni||{})[anStag]; if(r){ const c = csbOf(r); cnt[c] = (cnt[c]||0) + 1; } });
  const teams = {}; sqSorted().forEach(([k])=>{ const c = sqCsb(k); (teams[c] = teams[c] || []).push(sqName(k)); });
  const L = csbSorted();
  return `<div class="anf">${stagSel()}<button class="ghost" data-cnew>+ Nuovo circolo</button></div>
    <p class="hint">Il circolo è quello che il giocatore rappresenta nelle gare singole e a coppie. Le squadre dei campionati si gestiscono nella scheda Squadre.</p>` + (L.length ? `<div class="anl">` + L.map(([k,c])=>
    `<button class="anr sq" data-anc="${esc(k)}">${csbLogo(k)}<span class="t"><b>${esc(c.nome)}</b><span>${esc(c.citta||"città da indicare")}${cnt[k] ? ` · ${cnt[k]} ${cnt[k]===1 ? "giocatore" : "giocatori"} nel ${stagLabel(anStag)}` : ""}${teams[k] ? ` · ${teams[k].length===1 ? "squadra" : "squadre"}: ${esc(teams[k].join(", "))}` : ""}</span></span></button>`).join("") + `</div>`
    : `<p class="empty">Nessun circolo: si creano anche da soli importando i giocatori.</p>`);
}
function anSqHTML(){
  const cnt = {}; Object.values(ANAG).forEach(p=>{ const r = (p.anni||{})[anStag]; sqsOf(r).forEach(k=>cnt[k] = (cnt[k]||0) + 1); });
  const sqs = sqSorted();
  return `<div class="anf">${stagSel()}<button class="ghost" data-snew>+ Nuova squadra</button></div>
    <p class="hint">Le squadre dei campionati a squadre (Base, Eccellenza). Ogni squadra rappresenta un circolo e può avere un nome diverso, per esempio quello dello sponsor.</p>` + (sqs.length ? `<div class="anl">` + sqs.map(([k,s])=>
    `<button class="anr sq" data-ans="${esc(k)}">${sqLogo(k)}<span class="t"><b>${esc(s.nome)}</b><span>${esc(csbName(sqCsb(k)))}${s.camp ? " · " + CAMPN[s.camp] : " · campionato da indicare"} · ${cnt[k] ? `${cnt[k]} ${cnt[k]===1 ? "giocatore" : "giocatori"} nel ${stagLabel(anStag)}` : "nessun giocatore indicato nel " + stagLabel(anStag)}</span></span></button>`).join("") + `</div>`
    : `<p class="empty">Nessuna squadra.</p>`);
}
/* ---- importa / esporta ---- */
function anImpHTML(){
  return `<section class="panel"><h2>Importa da tabella</h2>
    <p class="hint">Copia le righe da Excel, con la riga di intestazione, e incollale qui. Colonne: Nome, Cognome, Circolo, Città (del circolo), Categoria (NP = Nazionale Pro, N = Nazionale, M = Master, 1, 2, 3), Anno (anno sportivo: 2026 = 2026/27)
    e, facoltativa, Squadre (le squadre dei campionati in cui gioca, separate da virgola).
    I circoli e le squadre che mancano vengono creati; per un giocatore già presente si aggiorna solo l'anno indicato (con la colonna Squadre vuota le sue squadre restano come sono).
    Le tabelle vecchie con la colonna Squadra al posto di Circolo vanno ancora bene: la squadra vale come circolo.</p>
    <textarea id="an-imp" spellcheck="false" placeholder="Nome&#9;Cognome&#9;Circolo&#9;Città&#9;Categoria&#9;Anno&#9;Squadre">${esc(anImp)}</textarea><div id="an-prev">${impPrevHTML()}</div></section>
    <section class="panel"><h2>Esporta</h2><p class="hint">Tutti i giocatori, una riga per anno sportivo, nello stesso formato: si incolla in Excel.</p>
    <textarea id="an-exp" readonly spellcheck="false">${esc(exportTSV())}</textarea><button class="ghost" data-acp>Copia</button></section>`;
}
function exportTSV(){
  const L = ["Nome\tCognome\tCircolo\tCittà\tCategoria\tAnno\tSquadre"];
  Object.values(ANAG).sort((a,b)=>String(a.cognome).localeCompare(String(b.cognome)) || String(a.nome||"").localeCompare(String(b.nome||"")))
    .forEach(p=>anniOf(p).forEach(y=>{ const r = p.anni[y], c = csbOf(r); L.push([p.nome||"", p.cognome||"", csbName(c), csbCitta(c), r.cat||"", y, sqsTxt(r)].join("\t")); }));
  return L.join("\n");
}
function parseImp(t){
  const lines = String(t||"").split(/\r?\n/).filter(l=>l.trim()); if(!lines.length) return {rows:[], errs:[], conSq:false};
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",", split = l => l.split(sep).map(x=>x.trim());
  const h0 = split(lines[0]).map(x=>slug(x).replace(/-/g,""));
  let cols = [0,1,2,3,4,5,6], start = 0;
  if(h0.includes("cognome")){ start = 1;
    const ix = n => h0.indexOf(n), cc = ix("circolo")>=0 ? ix("circolo") : ix("csb")>=0 ? ix("csb") : ix("squadra");   /* tabelle vecchie: Squadra = circolo */
    const sc = ix("circolo")>=0 || ix("csb")>=0 ? (ix("squadre")>=0 ? ix("squadre") : ix("squadra")) : ix("squadre");
    cols = [ix("nome"), ix("cognome"), cc, ix("citta"), ix("categoria"), ix("anno"), sc]; }
  const rows = [], errs = [];
  lines.slice(start).forEach((l, j)=>{
    const c = split(l), g = i => cols[i]>=0 ? (c[cols[i]] || "") : "", n = j + start + 1;
    const r = {nome:g(0), cognome:g(1), circolo:g(2), citta:g(3), cat:parseCat(g(4)), anno:parseAnno(g(5)), squadre:g(6).split(/\s*[,\/]\s*/).filter(Boolean), riga:n};
    if(!r.cognome) errs.push(`riga ${n}: manca il cognome`);
    else if(!r.circolo) errs.push(`riga ${n}: manca il circolo`);
    else if(!r.anno) errs.push(`riga ${n}: anno "${g(5)}" non valido`);
    else if(g(4) && !r.cat) errs.push(`riga ${n}: categoria "${g(4)}" non riconosciuta (NP, N, M, 1, 2, 3)`);
    else rows.push(r);
  });
  return {rows, errs};
}
function planImp(rows){
  const W = {}, csNew = {}, sqNew = {}, planned = {}, used = new Set(), out = [];
  const CS = circoliAll(), SQ = SQUADRE || {};
  rows.forEach(r=>{
    let ck = findCsb(r.circolo) || Object.keys(csNew).find(k=>low(csNew[k].nome)===low(r.circolo));
    if(!ck){ ck = newKey(r.circolo, k=>CS[k] || csNew[k]); csNew[ck] = {nome:r.circolo, citta:r.citta}; }
    else if(CS[ck] && !CS[ck].citta && r.citta && !csNew[ck]) W["circoli/" + ck + "/citta"] = r.citta;
    const sks = r.squadre.map(n=>{ let sk = Object.keys(SQ).find(k=>low(SQ[k].nome)===low(n) && sqCsb(k)===ck) || findSq(n) || Object.keys(sqNew).find(k=>low(sqNew[k].nome)===low(n));
      if(!sk){ sk = newKey(n, k=>SQ[k] || sqNew[k]); sqNew[sk] = {nome:n, csb:ck}; } return sk; });
    const id = [low(r.cognome), low(r.nome), r.nome ? "" : ck].join("|");
    let pk = planned[id] || Object.keys(ANAG).find(k=>{ const p = ANAG[k];
      return low(p.cognome)===low(r.cognome) && low(p.nome)===low(r.nome) && (r.nome || anniOf(p).some(y=>csbOf(p.anni[y])===ck)); });
    let st;
    if(!pk){ pk = newKey(r.cognome + "-" + (r.nome || ck), k=>ANAG[k] || used.has(k));
      used.add(pk); planned[id] = pk; W["giocatori/" + pk + "/cognome"] = r.cognome; W["giocatori/" + pk + "/nome"] = r.nome; st = "nuovo"; }
    else { planned[id] = pk; const old = ANAG[pk] && (ANAG[pk].anni||{})[r.anno];
      const sameSq = !sks.length || (old && sqsOf(old).sort().join()===[...new Set(sks)].sort().join());
      st = !ANAG[pk] ? "nuovo" : !old ? "aggiunge " + stagLabel(r.anno) : csbOf(old)===ck && (old.cat||"")===r.cat && sameSq && typeof old.sq!=="string" ? "già presente" : "aggiorna " + stagLabel(r.anno); }
    const base = "giocatori/" + pk + "/anni/" + r.anno;
    if(st!=="già presente"){ W[base + "/csb"] = ck; W[base + "/cat"] = r.cat; W[base + "/sq"] = null;
      if(sks.length) W[base + "/squadre"] = Object.fromEntries(sks.map(k=>[k, true])); }
    out.push({r, st, ck, sks});
  });
  Object.entries(csNew).forEach(([k,c])=>W["circoli/" + k] = c);
  Object.entries(sqNew).forEach(([k,s])=>W["squadre/" + k] = s);
  return {W, out, csNew, sqNew};
}
function impPrevHTML(){
  if(!anImp.trim()) return "";
  const {rows, errs} = parseImp(anImp), {out, csNew, sqNew} = planImp(rows), ch = out.filter(x=>x.st!=="già presente").length, nc = Object.keys(csNew).length, ns = Object.keys(sqNew).length;
  return (errs.length ? `<p class="err">Righe scartate:<br>${errs.map(esc).join("<br>")}</p>` : "") +
    (nc ? `<p class="hint">Circoli nuovi: ${Object.values(csNew).map(s=>esc(s.nome)).join(", ")}</p>` : "") +
    (ns ? `<p class="hint">Squadre nuove: ${Object.values(sqNew).map(s=>esc(s.nome)).join(", ")}</p>` : "") +
    (out.length ? `<div class="antw"><table class="ant"><thead><tr><th>Giocatore</th><th>Circolo</th><th>Cat.</th><th>Anno</th><th>Squadre</th><th></th></tr></thead><tbody>` +
      out.map(x=>`<tr><td>${esc(tabName({cognome:x.r.cognome, nome:x.r.nome}))}</td><td>${esc(x.r.circolo)}</td><td>${esc(x.r.cat || "—")}</td><td>${stagLabel(x.r.anno)}</td><td>${esc(x.r.squadre.join(", ") || "—")}</td><td class="${x.st==="già presente" ? "d" : "n"}">${esc(x.st)}</td></tr>`).join("") + `</tbody></table></div>` : "") +
    `<button data-aimp${ch || nc || ns ? "" : " disabled"}>${ch ? `Importa ${ch} ${ch===1 ? "riga" : "righe"}` : nc || ns ? "Crea circoli e squadre" : "Niente da importare"}</button><p class="hint" id="an-im"></p>`;
}
async function doImport(){
  const {rows} = parseImp(anImp), {W, out} = planImp(rows), ch = out.filter(x=>x.st!=="già presente").length;
  if(!Object.keys(W).length) return;
  const b = $("[data-aimp]"); if(b){ b.disabled = true; b.textContent = "Importazione…"; }
  try{ await dbWrite(W); anImp = ""; render(); setTimeout(()=>{ const p = $("#an-prev"); if(p) p.innerHTML = `<p class="hint">Fatto: ${ch} ${ch===1 ? "riga importata" : "righe importate"}.</p>`; }, 0); }
  catch(err){ const m = $("#an-im"); if(m) m.textContent = wErr(err); if(b){ b.disabled = false; b.textContent = "Riprova"; } }
}
/* ---- scheda giocatore / circolo / squadra (finestra #anm) ---- */
const yearOpts = sel => { const s = new Set([stagione() + 1, sel]); for(let y = stagione(); y>=2015; y--) s.add(y); return [...s].filter(Boolean).sort((a,b)=>b-a).map(y=>`<option value="${y}"${y===sel ? " selected" : ""}>${stagLabel(y)}</option>`).join(""); };
/* NEWCSB = voce "+ Nuovo circolo…": il circolo si crea insieme al giocatore, al Salva */
const NEWCSB = "__nuovo__";
const csbOpts = sel => csbSorted().map(([k,c])=>`<option value="${esc(k)}"${k===sel ? " selected" : ""}>${esc(c.nome)}</option>`).join("") + (sel && sel!==NEWCSB && !circoliAll()[sel] ? `<option value="${esc(sel)}" selected>${esc(sel)}</option>` : "")
  + `<option value="${NEWCSB}"${sel===NEWCSB ? " selected" : ""}>+ Nuovo circolo…</option>`;
/* squadre da spuntare nella riga di un anno: quelle del circolo, quelle già scelte e, dalla tendina, una squadra di un altro circolo
   (una squadra può schierare anche giocatori iscritti ad altri circoli, es. Carmelo Albano nell'Eccellenza di Seconda Passione) */
const sqChip = (k, on) => `<label class="chk"><input type="checkbox" data-ysq="${esc(k)}"${on ? " checked" : ""}>${esc(sqLabel(k))}${sqCsb(k)!==anEd.curCsb && low(csbName(sqCsb(k)))!==low(sqName(k)) ? ` <i class="oc">${esc(csbName(sqCsb(k)))}</i>` : ""}</label>`;
function teamChecks(csb, map){
  anEd.curCsb = csb;
  const L = sqSorted().filter(([k])=>sqCsb(k)===csb).map(([k])=>k), extra = Object.keys(map||{}).filter(k=>map[k] && sqCsb(k)!==csb), shown = new Set([...L, ...extra]);
  const others = sqSorted().filter(([k])=>!shown.has(k));
  if(!shown.size && !others.length) return "";
  return `<span class="ysl">Squadre</span>` + [...shown].map(k=>sqChip(k, map && map[k])).join("") + (others.length ? `<select data-ysx aria-label="Squadra di un altro circolo"><option value="">+ squadra di un altro circolo…</option>${sqOptGroups(others)}</select>` : "");
}
function sqOptGroups(list){
  const G = new Map(); list.forEach(([k])=>{ const c = sqCsb(k); if(!G.has(c)) G.set(c, []); G.get(c).push(k); });
  return [...G].map(([c, ks])=>`<optgroup label="${esc(csbName(c))}">${ks.map(k=>`<option value="${esc(k)}">${esc(sqLabel(k))}</option>`).join("")}</optgroup>`).join("");
}
const yrow = (y, r) => { const c = r.csb ?? csbOf(r); return `<div class="row yr"><label>Anno sportivo<select data-yy>${yearOpts(y)}</select></label><label class="ys">Circolo<select data-ycs>${csbOpts(c)}</select></label>
  <label>Categoria<select data-yc><option value="">—</option>${CATS.map(x=>`<option value="${x}"${x===r.cat ? " selected" : ""}>${catShort(x)}</option>`).join("")}</select></label><button class="yx" data-yx title="Togli questo anno" aria-label="Togli questo anno">✕</button>
  <div class="nsq"${c===NEWCSB ? "" : " hidden"}><label>Nome del nuovo circolo<input data-ncn value="${esc(r.ncn||"")}" autocomplete="off"></label><label>Città<input data-ncc value="${esc(r.ncc||"")}" placeholder="es. Ferrara (FE)" autocomplete="off"></label></div>
  <div class="ysq">${teamChecks(c, r.squadre)}</div></div>`; };
const anMsg = t => { const m = $("#an-m"); if(m) m.textContent = t; };
const delLabel = () => anEd.del && Date.now() - anEd.del < 4000 ? "Conferma: elimina" : "Elimina";
/* pre (giocatore nuovo da una gara o dal controllo nomi): {cognome, nome, sq: squadra del lato, csb, y, link | ck} */
function openPlayer(k, pre){
  const CS = circoliAll(), y = pre ? pre.y : (anStag ?? stagione());
  const fc = anFil.startsWith("c:") ? anFil.slice(2) : anFil.startsWith("s:") ? sqCsb(anFil.slice(2)) : "";
  const want = pre ? (pre.csb || (pre.sq ? sqCsb(pre.sq) : "")) : fc;
  const c0 = want && CS[want] ? want : CS[CLUBCSB] ? CLUBCSB : csbSorted().length ? csbSorted()[0][0] : NEWCSB;
  const sq0 = pre && pre.sq && (SQUADRE||{})[pre.sq] ? pre.sq : anFil.startsWith("s:") && !pre ? anFil.slice(2) : "";
  const p = k ? clone(ANAG[k]) : {cognome:pre ? pre.cognome : "", nome:pre ? pre.nome : "", anni:{[y]: Object.assign({csb:c0, cat:""}, sq0 ? {squadre:{[sq0]: true}} : {})}};
  if(k) anniOf(p).forEach(yy=>{ const r = p.anni[yy]; r.csb = csbOf(r); delete r.sq; });
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
    <h4>Circolo, categoria e squadre per anno sportivo</h4><div id="an-y">${ys.map(y=>yrow(y, p.anni[y])).join("")}</div>
    <button class="addf" data-ay>+ Aggiungi anno</button>
    <p class="hint">Il circolo è quello che il giocatore rappresenta nelle gare singole e a coppie; le squadre (facoltative) sono quelle dei campionati a squadre in cui gioca quell'anno, anche di un altro circolo.
    Sul tabellone: cognome e iniziale del nome, poi la categoria dell'anno della gara, per esempio “${esc(tabName(Object.assign({}, p, {tab:""})) || "Galli E.")} (${esc(rowAt(p, stagione()).cat || "2")})”. Scrivi il nome sul tabellone solo per distinguere due omonimi.</p>
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
    const sq = {}; r.querySelectorAll("[data-ysq]").forEach(x=>{ if(x.checked) sq[x.dataset.ysq] = true; });
    anni[y] = {csb:r.querySelector("[data-ycs]").value, cat:r.querySelector("[data-yc]").value}; if(Object.keys(sq).length) anni[y].squadre = sq;
    if(anni[y].csb===NEWCSB){ anni[y].ncn = r.querySelector("[data-ncn]").value.trim(); anni[y].ncc = r.querySelector("[data-ncc]").value.trim(); } });
  p.anni = anni; return dup;
}
async function savePlayer(){
  const dup = readPlayer(), p = anEd.p;
  if(!p.cognome) return anMsg("Scrivi almeno il cognome");
  if(dup.length) return anMsg("Anno sportivo ripetuto: " + dup.join(", "));
  if(!anniOf(p).length) return anMsg("Aggiungi almeno un anno sportivo con il circolo");
  /* circoli nuovi scritti nella scheda: se il nome esiste già si usa quello, altrimenti si crea (una sola volta anche se ripetuto in più anni) */
  const NC = {}, CS = circoliAll();
  for(const y of anniOf(p)){ const r = p.anni[y]; if(r.csb!==NEWCSB) continue;
    if(!r.ncn){ anMsg(`Scrivi il nome del nuovo circolo (${stagLabel(y)})`); const i = $("#anm [data-ncn]"); if(i) i.focus(); return; }
    const key = findCsb(r.ncn) || Object.keys(NC).find(kk=>low(NC[kk].nome)===low(r.ncn));
    if(key){ r.csb = key; continue; }
    const kk = newKey(r.ncn, x=>CS[x] || NC[x]); NC[kk] = {nome:r.ncn, citta:r.ncc || ""}; r.csb = kk; }
  for(const y of anniOf(p)){ delete p.anni[y].ncn; delete p.anni[y].ncc; }
  let k = anEd.k;
  if(!k) k = newKey(p.cognome + "-" + (p.nome || rowAt(p, stagione()).csb), x=>ANAG[x]);
  const tn = tabName(p).toLowerCase(), ys = anniOf(p);
  const twin = Object.entries(ANAG).find(([kk,q])=>kk!==k && tabName(q).toLowerCase()===tn && anniOf(q).some(y=>ys.includes(y)));
  if(twin && anEd.twin!==tn){ anEd.twin = tn; return anMsg(`Anche ${[twin[1].nome, twin[1].cognome].filter(Boolean).join(" ")} compare come “${tabName(p)}”: scrivi un nome sul tabellone diverso, oppure premi di nuovo Salva per lasciarlo così.`); }
  const val = {cognome:p.cognome, nome:p.nome, anni:p.anni}; if(p.sopr) val.sopr = p.sopr; if(p.tab) val.tab = p.tab;
  const fo = anEd.foto, W = {["giocatori/" + k]: val};
  for(const kk in NC) W["circoli/" + kk] = NC[kk];
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
/* -- circolo -- */
function openCsb(k){
  const c = k ? clone(CIRCOLI[k]) : {nome:"", citta:""};
  anEd = {kind:"c", k, c, del:0}; paintCsb(); $("#anm").hidden = false; if(!k) setTimeout(()=>{ const x = $("#ac-n"); if(x) x.focus(); }, 30);
}
function paintCsb(){
  const c = anEd.c, club = isClub(anEd.k);
  $("#anm .bx").innerHTML = `<h3>${anEd.k ? esc(c.nome) : "Nuovo circolo"}</h3>
    <div class="row"><label>Nome<input id="ac-n" value="${esc(c.nome||"")}" autocomplete="off"></label><label>Città<input id="ac-c" value="${esc(c.citta||"")}" placeholder="es. Ferrara (FE)" autocomplete="off"></label></div>
    ${club ? `<p class="hint">Il logo del circolo è già nella pagina.</p>` : `<div class="lgr">${logoImg(c.logo, c.nome)}<button class="addf" data-alg>${c.logo ? "Cambia logo" : "Carica logo"}</button>${c.logo ? `<button class="addf" data-alx>Togli logo</button>` : ""}</div>
      <p class="hint">Il logo vale anche per le squadre del circolo che non ne hanno uno proprio; la città compare nelle gare contro quelle squadre.</p>`}
    <p class="err" id="an-m"></p>
    <div class="btns">${anEd.k && !club ? `<button class="ghost" data-adel>${delLabel()}</button>` : ""}<span class="sp1"></span><button class="ghost" data-ano>Annulla</button><button data-aok>Salva</button></div>`;
}
const readCsb = () => { anEd.c.nome = $("#ac-n").value.trim(); anEd.c.citta = $("#ac-c").value.trim(); };
async function saveCsb(){
  readCsb(); const c = anEd.c;
  if(!c.nome) return anMsg("Scrivi il nome del circolo");
  const same = findCsb(c.nome); if(same && same!==anEd.k) return anMsg("Esiste già un circolo con questo nome");
  const k = anEd.k || newKey(c.nome, x=>CIRCOLI[x]);
  const val = {nome:c.nome, citta:c.citta}; if(c.logo) val.logo = c.logo;
  try{ await dbWrite({["circoli/" + k]: val}); closeAn(); } catch(err){ anMsg(wErr(err)); }
}
/* -- squadra: nome, circolo, campionato, logo e giocatori dell'anno scelto -- */
function openSquad(k){
  const s = k ? clone(SQUADRE[k]) : {nome:"", csb:anFil.startsWith("c:") ? anFil.slice(2) : (circoliAll()[CLUBCSB] ? CLUBCSB : (csbSorted()[0] || [""])[0]), camp:""};
  s.csb = s.csb || k || ""; delete s.citta;
  const rosa = new Set(k ? Object.keys(ANAG).filter(pk=>inTeam((ANAG[pk].anni||{})[anStag], k)) : []);
  anEd = {kind:"s", k, s, rosa, rosa0:new Set(rosa), del:0}; paintSquad(); $("#anm").hidden = false; if(!k) setTimeout(()=>{ const x = $("#as-n"); if(x) x.focus(); }, 30);
}
/* giocatori della squadra: si propongono quelli del circolo; dalla tendina si aggiungono giocatori di altri circoli */
function rosaHTML(){
  const s = anEd.s, all = Object.entries(ANAG).map(([k,p])=>({k, p, r:(p.anni||{})[anStag]})).filter(x=>x.r);
  const byName = (a,b) => String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||""));
  const L = all.filter(x=>csbOf(x.r)===s.csb || anEd.rosa.has(x.k) || anEd.rosa0.has(x.k)).sort((a,b)=>(csbOf(a.r)!==s.csb) - (csbOf(b.r)!==s.csb) || byName(a,b));
  const rest = all.filter(x=>!L.includes(x)).sort((a,b)=>csbName(csbOf(a.r)).localeCompare(csbName(csbOf(b.r))) || byName(a,b));
  const G = new Map(); rest.forEach(x=>{ const c = csbOf(x.r); if(!G.has(c)) G.set(c, []); G.get(c).push(x); });
  const add = rest.length ? `<select data-rosx aria-label="Giocatore di un altro circolo"><option value="">+ giocatore di un altro circolo…</option>${[...G].map(([c, xs])=>`<optgroup label="${esc(csbName(c))}">${xs.map(x=>`<option value="${esc(x.k)}">${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""} · ${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))}</option>`).join("")}</optgroup>`).join("")}</select>` : "";
  return (L.length ? `<div class="rosa">${L.map(x=>`<label class="chk"><input type="checkbox" data-ros="${esc(x.k)}"${anEd.rosa.has(x.k) ? " checked" : ""}>${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""}${csbOf(x.r)!==s.csb ? ` <i class="oc">${esc(csbName(csbOf(x.r)))}</i>` : ""}</label>`).join("")}</div>`
    : `<p class="hint">Nessun giocatore di ${esc(csbName(s.csb))} nel ${stagLabel(anStag)}.</p>`) + add;
}
function paintSquad(){
  const s = anEd.s, club = isClub(s.csb);
  $("#anm .bx").innerHTML = `<h3>${anEd.k ? esc(s.nome) : "Nuova squadra"}</h3>
    <div class="row"><label>Nome<input id="as-n" value="${esc(s.nome||"")}" placeholder="es. Minerva 2000" autocomplete="off"></label>
      <label>Campionato<select id="as-cp"><option value="">—</option>${Object.entries(CAMPN).map(([k,t])=>`<option value="${k}"${s.camp===k ? " selected" : ""}>${t}</option>`).join("")}</select></label></div>
    <div class="row"><label>Circolo che rappresenta<select id="as-cs">${csbSorted().map(([k,c])=>`<option value="${esc(k)}"${k===s.csb ? " selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label></div>
    ${club ? `<p class="hint">Il logo del circolo è già nella pagina.</p>` : `<div class="lgr">${logoImg(s.logo || (csbObj(s.csb) || {}).logo, s.nome)}<button class="addf" data-alg>${s.logo ? "Cambia logo" : "Carica logo"}</button>${s.logo ? `<button class="addf" data-alx>Togli logo</button>` : ""}</div>
      <p class="hint">Facoltativo: senza un logo proprio si usa quello del circolo. Logo e città vengono messi da soli nelle nuove gare contro questa squadra.</p>`}
    <h4>Giocatori della squadra nel ${stagLabel(anStag)}</h4>${rosaHTML()}
    <p class="hint">Servono per i suggerimenti dei nomi nelle gare. Un giocatore può stare in più squadre (per esempio Base ed Eccellenza) e anche in una squadra di un circolo diverso dal suo: aggiungilo dalla tendina.
    Mancano i giocatori senza una riga per il ${stagLabel(anStag)}: aggiungila dalla scheda Giocatori.</p>
    <p class="err" id="an-m"></p>
    <div class="btns">${anEd.k ? `<button class="ghost" data-adel>${delLabel()}</button>` : ""}<span class="sp1"></span><button class="ghost" data-ano>Annulla</button><button data-aok>Salva</button></div>`;
}
const readSquad = () => { const s = anEd.s; s.nome = $("#as-n").value.trim(); s.camp = $("#as-cp").value; s.csb = $("#as-cs").value;
  $("#anm").querySelectorAll("[data-ros]").forEach(x=>{ x.checked ? anEd.rosa.add(x.dataset.ros) : anEd.rosa.delete(x.dataset.ros); }); };
async function saveSquad(){
  readSquad(); const s = anEd.s;
  if(!s.nome) return anMsg("Scrivi il nome della squadra");
  if(!s.csb) return anMsg("Scegli il circolo (se non c'è, crealo prima nella scheda Circoli)");
  const same = Object.entries(SQUADRE).find(([k,x])=>k!==anEd.k && low(x.nome)===low(s.nome) && (x.camp||"")===(s.camp||""));
  if(same) return anMsg("Esiste già una squadra con questo nome" + (s.camp ? " nel campionato " + CAMPN[s.camp] : ""));
  const k = anEd.k || newKey(s.nome, x=>SQUADRE[x]);
  const val = {nome:s.nome, csb:s.csb}; if(s.camp) val.camp = s.camp; if(s.logo) val.logo = s.logo;
  const W = {["squadre/" + k]: val};
  new Set([...anEd.rosa, ...anEd.rosa0]).forEach(pk=>{ const on = anEd.rosa.has(pk); if(on===anEd.rosa0.has(pk) || !ANAG[pk] || !(ANAG[pk].anni||{})[anStag]) return;
    W[`giocatori/${pk}/anni/${anStag}/squadre/${k}`] = on ? true : null; });
  try{ await dbWrite(W); closeAn(); } catch(err){ anMsg(wErr(err)); }
}
async function anDelete(){
  if(!(anEd.del && Date.now() - anEd.del < 4000)){ if(anEd.kind==="p") readPlayer(); else if(anEd.kind==="c") readCsb(); else readSquad(); anEd.del = Date.now();
    const b = $("[data-adel]"); if(b){ b.textContent = delLabel(); b.classList.add("arm"); } setTimeout(()=>{ const b2 = $("[data-adel]"); if(b2 && anEd && !(Date.now() - anEd.del < 4000)){ b2.textContent = delLabel(); b2.classList.remove("arm"); } }, 4100); return; }
  let W;
  if(anEd.kind==="p") W = {["giocatori/" + anEd.k]: null, ["foto/" + anEd.k]: null};
  else if(anEd.kind==="c"){ const n = Object.values(ANAG).filter(p=>anniOf(p).some(y=>csbOf(p.anni[y])===anEd.k)).length, t = sqSorted().filter(([k])=>sqCsb(k)===anEd.k).length;
    if(n) return anMsg(`Non si può eliminare: ${n} ${n===1 ? "giocatore ha" : "giocatori hanno"} questo circolo in almeno un anno.`);
    if(t) return anMsg(`Non si può eliminare: ${t===1 ? "c'è una squadra" : "ci sono " + t + " squadre"} di questo circolo.`);
    W = {["circoli/" + anEd.k]: null}; }
  else { W = {["squadre/" + anEd.k]: null};   /* si tolgono anche le iscrizioni dei giocatori a questa squadra, in tutti gli anni */
    Object.entries(ANAG).forEach(([pk,p])=>anniOf(p).forEach(y=>{ if(inTeam(p.anni[y], anEd.k)) W[`giocatori/${pk}/anni/${y}/squadre/${anEd.k}`] = null; })); }
  try{ await dbWrite(W); closeAn(); } catch(err){ anMsg(wErr(err)); }
}
function closeAn(){ $("#anm").hidden = true; anEd = null; }
const anSave = () => anEd.kind==="p" ? savePlayer() : anEd.kind==="c" ? saveCsb() : saveSquad();
const anLogoObj = () => anEd.kind==="c" ? anEd.c : anEd.s;
const anLogoPaint = () => { if(anEd.kind==="c") paintCsb(); else paintSquad(); };
$("#anm").addEventListener("click", e=>{
  if(!anEd) return; const t = e.target;
  if(t.closest("[data-ano]")){ closeAn(); return; }
  if(t.closest("[data-aok]")){ anSave(); return; }
  if(t.closest("[data-adel]")){ anDelete(); return; }
  if(t.closest("[data-ay]")){ readPlayer(); const p = anEd.p, ys = anniOf(p), y = ys.length ? Math.max(...ys) + 1 : stagione(); p.anni[y] = clone(ys.length ? p.anni[Math.max(...ys)] : {csb:CLUBCSB, cat:""}); paintPlayer(); return; }
  const yx = t.closest("[data-yx]"); if(yx){ yx.closest(".yr").remove(); return; }
  if(t.closest("[data-afo]")){ $("#anfoto").click(); return; }
  if(t.closest("[data-afx]")){ readPlayer(); anEd.foto = ""; paintPlayer(); return; }
  if(t.closest("[data-alg]")){ anEd.kind==="c" ? readCsb() : readSquad(); $("#anlogo").click(); return; }
  if(t.closest("[data-alx]")){ anEd.kind==="c" ? readCsb() : readSquad(); delete anLogoObj().logo; anLogoPaint(); return; }
});
$("#anm").addEventListener("change", e=>{
  if(!anEd) return;
  const s = e.target.closest("[data-ycs]");
  if(s){ const row = s.closest(".yr"), box = row.querySelector(".nsq"), on = s.value===NEWCSB; box.hidden = !on;
    const keep = {}; row.querySelectorAll("[data-ysq]").forEach(x=>{ if(x.checked) keep[x.dataset.ysq] = true; });   /* le squadre già spuntate restano */
    row.querySelector(".ysq").innerHTML = on ? "" : teamChecks(s.value, keep);
    if(on){ const i = box.querySelector("[data-ncn]"); if(i) i.focus(); } return; }
  if(e.target.id==="as-cs" && anEd.kind==="s"){ readSquad(); paintSquad(); }
  if(e.target.matches("[data-rosx]") && e.target.value){ readSquad(); anEd.rosa.add(e.target.value); paintSquad(); }
  const x = e.target.closest("[data-ysx]");
  if(x && x.value){ const csb = x.closest(".yr").querySelector("[data-ycs]").value; anEd.curCsb = csb; x.insertAdjacentHTML("beforebegin", sqChip(x.value, true)); x.querySelector(`option[value="${CSS.escape(x.value)}"]`).remove(); x.value = "";
    if(!x.querySelectorAll("option[value]:not([value=''])").length) x.remove(); }
});
$("#anm").addEventListener("keydown", e=>{ if(e.key==="Escape") closeAn(); if(e.key==="Enter" && e.target.tagName==="INPUT" && e.target.type!=="checkbox"){ e.preventDefault(); anEd && anSave(); } });
$("#anlogo").addEventListener("change", ()=>{
  const inp = $("#anlogo"), f = inp.files[0]; if(!f || !anEd || anEd.kind==="p") return;
  const rd = new FileReader();
  rd.onload = () => { const im = new Image();
    im.onload = () => { const M = 160, k = Math.min(1, M/Math.max(im.width||M, im.height||M));
      const c = document.createElement("canvas"); c.width = Math.round((im.width||M)*k); c.height = Math.round((im.height||M)*k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); anLogoObj().logo = c.toDataURL("image/png"); inp.value = ""; anLogoPaint(); };
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
  const at = t.closest("[data-antab]"); if(at){ anTab = at.dataset.antab; anMigMsg = ""; render(); return; }
  if(t.closest("[data-amig]")){ anMigrate(); return; }
  if(t.closest("[data-ckbk]") && needMig()){ ckBackup(); return; }
  if(t.closest("[data-annew]")){ openPlayer(null); return; }
  const ap = t.closest("[data-anp]"); if(ap){ openPlayer(ap.dataset.anp); return; }
  if(t.closest("[data-cnew]")){ openCsb(null); return; }
  const ac = t.closest("[data-anc]"); if(ac){ openCsb(ac.dataset.anc); return; }
  if(t.closest("[data-snew]")){ openSquad(null); return; }
  const as = t.closest("[data-ans]"); if(as){ openSquad(as.dataset.ans); return; }
  if(t.closest("[data-aimp]")){ doImport(); return; }
  const cp = t.closest("[data-acp]"); if(cp){ const x = $("#an-exp"); x.select(); try{ navigator.clipboard.writeText(x.value).then(()=>{ cp.textContent = "Copiato ✓"; }, ()=>{ document.execCommand("copy"); cp.textContent = "Copiato ✓"; }); }catch(err){ document.execCommand("copy"); cp.textContent = "Copiato ✓"; } return; }
});
app.addEventListener("change", e=>{
  if(mode!=="anag") return;
  if(e.target.id==="an-st"){ anStag = +e.target.value; e.target.blur(); render(); }
  if(e.target.id==="an-fil"){ anFil = e.target.value; e.target.blur(); render(); }
});
app.addEventListener("input", e=>{
  if(mode==="anag" && e.target.id==="an-q"){ anQ = e.target.value; $("#an-list").innerHTML = anListHTML(); }
  if(mode==="anag" && e.target.id==="an-imp"){ anImp = e.target.value; $("#an-prev").innerHTML = impPrevHTML(); }
  if(mode==="regiahome" && e.target.id==="ng-o"){ const k = findSq(e.target.value, campOf(($("#ng-f") || {}).value)), c = $("#ng-c");
    if(k && c && (!c.value || c.dataset.auto==="1")){ c.value = sqCitta(k); c.dataset.auto = "1"; } }
  if(e.target.id==="ng-c") e.target.dataset.auto = "";
});
app.addEventListener("change", e=>{
  if(mode!=="regiahome") return;
  if(e.target.id==="ng-ns") e.target.dataset.manual = "1";
  if(e.target.id==="ng-f") ngTeamsRefresh();
});

