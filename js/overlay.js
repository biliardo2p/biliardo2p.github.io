/* Tabellone Live · overlay.js — Vista per OBS: ?overlay&live (segue la gara in diretta) oppure ?overlay&gara=<id>.
   Sorgente Browser di OBS a 1280×720. Legge la gara pubblicata (gare/<id>) e i comandi di presentazione (onda/<id>):
   v = "tab" (tabellone) | "fascia" (incontro in primo piano) | "off" (nascosto); bga = opacità dello sfondo;
   primo = indice dell'incontro in primo piano (-1 = automatico); pag = pagina del tabellone dei tornei; ciclo = secondi di rotazione delle pagine.
   I comandi si danno dalla regia (pannello 📺 Onda) e valgono subito, senza PUBBLICA. Il sito pubblico non li usa.
   ?overlay&mini&live = mini-overlay per le dirette con telecamera: la fascia in basso, sfondo trasparente; sparisce quando la regia manda in onda il Tabellone;
   con più incontri in corso e incontro in primo piano "Automatico" mostra l'ultimo messo in corso (si cambia dalla regia: tasto F o menu);
   la rotazione automatica tra gli incontri in corso c'è solo aggiungendo &rot (ogni 12 secondi) o &rot=<secondi>;
   &alza solleva la fascia dal fondo (13% dell'altezza, oppure &alza=<percentuale>), per lasciare libero il logo di PRISM in basso a destra.
   ?overlay&riepilogo&live = riepilogo della gara a tutto schermo per le dirette con telecamera (secondo widget di PRISM, accanto al mini-overlay):
   compare solo quando la regia manda in onda il Tabellone (tasto V nel pannello 📺 Onda), altrimenti è vuoto e trasparente;
   si adatta a qualsiasi riquadro restando 16:9 e centrato. Mini-overlay e riepilogo senza comandi della regia: fascia sì, riepilogo no. */
const OVERLAY = P.has("overlay"), OVMINI = OVERLAY && P.has("mini"), OVRIEP = OVERLAY && !OVMINI && P.has("riepilogo"), OVROT = P.has("rot") ? Math.max(4, +P.get("rot") || 12) : 0;   /* rotazione della fascia: solo con &rot (dall'08/11/2026) */
let ovRotI = 0, ovRotT = 0, ovLastPrimo = -2;
let O = null, ovId = "", ovOff = null, ovPrev = null, ovCycT = 0, ovCycOff = 0, ovPage = "";
const ovO = () => Object.assign({v: OVMINI || OVRIEP ? "fascia" : "tab", bga:.55, primo:-1, pag:"", ciclo:0}, O || {});
/* cosa mostra questa pagina: "board" (tabellone/riepilogo), "fascia" o "off". Mini: fascia, nascosta col Tabellone. Riepilogo: solo col Tabellone. */
function ovView(o){ if(o.v==="off") return "off";
  if(OVMINI) return o.v==="tab" ? "off" : "fascia";
  if(OVRIEP) return o.v==="tab" ? "board" : "off";
  return o.v==="fascia" ? "fascia" : "board"; }
function ovStart(){
  mode = "overlay"; document.body.classList.add("ovm"); document.title = "Overlay · Tabellone Live";
  document.querySelectorAll('link[rel="stylesheet"]').forEach(l=>{ const h = l.getAttribute("href") || ""; if(/^css\//.test(h) && !/overlay\.css/.test(h)) l.disabled = true; });
  watchAnag();
  if(GARA) ovFollow(GARA); else ovAuto();
  addEventListener("resize", ovScale); setInterval(ovTick, 1000);
  render();
}
/* ?overlay&live: la gara LIVE (la più aggiornata se sono più d'una); se nessuna, la prossima in programma o l'ultima conclusa. Le gare di prova solo con &prova */
function ovAuto(){
  db.ref("indice").on("value", snap=>{
    const all = Object.entries(snap.val() || {}).map(([id,m])=>Object.assign({id}, m)).filter(g=>P.has("prova") ? visOf(g)==="prova" : visOf(g)!=="prova");
    const live = all.filter(g=>g.stato==="live").sort((a,b)=>(b.aggiornato||0) - (a.aggiornato||0));
    const next = all.filter(g=>g.stato==="programmata" && (g.data||"")>=today()).sort((a,b)=>startKey(a).localeCompare(startKey(b)));
    const last = all.filter(g=>g.stato==="finita").sort((a,b)=>(b.data||"").localeCompare(a.data||"") || (b.aggiornato||0) - (a.aggiornato||0));
    const g = live[0] || next[0] || last[0];
    if(g && g.id!==ovId) ovFollow(g.id);
  }, ()=>{});
}
function ovFollow(id){
  if(ovOff) ovOff();
  ovId = id; S = null; O = null; ovPrev = null; ovPage = "";
  const r1 = db.ref("gare/" + id), f1 = s=>{ S = normalize(s.val()); render(); };
  const r2 = db.ref("onda/" + id), f2 = s=>{ const was = ovO().pag; O = s.val() || null; if(ovO().pag!==was) ovCycOff = 0; render(); };
  r1.on("value", f1, ()=>{}); r2.on("value", f2, ()=>{});
  ovOff = () => { try{ r1.off("value", f1); r2.off("value", f2); }catch(e){} };
}
function ovTick(){
  if(mode==="overlay" && S && ovRotList().length>1 && ++ovRotT >= OVROT){ ovRotT = 0; ovRotI++; render(); }
  const o = ovO(); if(mode!=="overlay" || !S || !isTab() || o.v!=="tab" || !(o.ciclo>0) || o.pag){ ovCycT = 0; return; }
  if(++ovCycT >= o.ciclo){ ovCycT = 0; ovCycOff++; render(); }
}
function ovScale(){ const el = document.getElementById("ov"); if(!el) return;
  if(OVMINI){   /* mini-overlay: riempie qualsiasi riquadro (es. widget di PRISM non 16:9): fascia a tutta larghezza, attaccata in basso */
    const W = innerWidth || 1280, H = innerHeight || 720; let k = W/1280;
    if(H/k < 112) k = H/112;   /* riquadro basso (solo una striscia): comanda l'altezza */
    el.style.width = W/k + "px"; el.style.height = H/k + "px"; el.classList.toggle("strip", H/k < 200);
    if(P.has("alza")){ const a = Math.min(60, Math.max(0, +P.get("alza") || 13)); el.querySelectorAll(".lt").forEach(x=>x.style.bottom = a + "%"); }   /* &alza[=%]: fascia sollevata (es. sopra il logo di PRISM) */
    el.style.transform = Math.abs(k-1)<.001 ? "" : `scale(${k})`; return; }
  if(OVRIEP){   /* riepilogo: 16:9 centrato in qualsiasi riquadro */
    const W = innerWidth || 1280, H = innerHeight || 720, k = Math.min(W/1280, H/720) || 1;
    el.style.transform = `translate(${((W - 1280*k)/2).toFixed(1)}px,${((H - 720*k)/2).toFixed(1)}px) scale(${k})`; return; }
  const k = Math.min(innerWidth/1280, innerHeight/720) || 1; el.style.transform = Math.abs(k-1)<.001 ? "" : `scale(${k})`; }

/* ---- pezzi comuni ---- */
const ovCat = c => c ? `<i class="ct">(${esc(c)})</i>` : "";
function ovName(m, sd, j){ const x = pInfo(m, sd, j); return x.t ? esc(x.t) + ovCat(x.cat) : ""; }
function ovNamesTxt(t){ /* tornei: "Galli / Tamburini" con categoria */
  const y = gYear();
  return String(t||"").split("/").map(n=>n.trim()).filter(Boolean).map(n=>{ const k = resolveName(n, "", y), c = k ? rowAt(ANAG[k], y).cat : "";
    return esc(k ? tabName(ANAG[k]) : n) + ovCat(c); }).join(`<i class="dot">·</i>`);
}
/* logo del circolo già ridotto per l'overlay: nella WebView del telefono (disegno software) il logo grande (186 px)
   ridotto a 28 px veniva seghettato. logo-56 per il chip (28 px), logo-96 per l'intestazione (46 px). Dal 11/11/2026. */
const LOGO_56 = "img/logo-56.png", LOGO_96 = "img/logo-96.png";
function ovHdr(logo){
  const lv = S.stato==="live" ? `<span class="live"><i></i>LIVE</span>` : S.stato==="finita" ? `<span class="live fin">FINALE</span>` : "";
  return `<div class="hdr">${logo ? `<img class="lg" src="${LOGO_96}" alt="">` : ""}<div class="t1">${esc(S.title)}</div>${S.subtitle ? `<i class="sep"></i><div class="t2">${esc(S.subtitle)}</div>` : ""}${lv}</div>`;
}
const ovBil = m => m.bil ? ` · BILIARDO ${esc(m.bil)}` : "";
function ovSpec(m){
  if(m.defs){ const d = m.defs[m.sk] || {};
    if(d.opts && !d.target) return `<div class="s pend">Specialità all'acchito</div>`;
    return `<div class="s">${esc(d.spec || "")}<small>a ${d.target}</small></div>`; }
  if(m.opts && m.opt<0) return `<div class="s pend">Specialità all'acchito</div>`;
  return `<div class="s">${esc(m.spec)}<small>a ${m.target}</small></div>`;
}
function ovBars(m, x, y){
  const t = m.defs ? (m.defs[m.sk] || {}).target : m.target, pc = k => t ? Math.min(100, m.s[k]/t*100) : 0, ix = sd => sd==="h" ? 0 : 1;
  return `<div class="bars"><div><i class="${x}" style="width:${pc(ix(x))}%"></i></div><div><i class="${y}" style="width:${pc(ix(y))}%"></i></div></div>`;
}
/* incontro in primo piano: scelto dalla regia, altrimenti l'ultimo segnato "in corso" (tornei: il primo seguito in diretta non concluso) */
/* incontri da alternare nella fascia: quelli in corso, se la regia non ne ha scelto uno */
function ovRotList(){ const o = ovO(); if(!OVROT || (o.primo>=0 && S.matches[o.primo])) return [];
  if(ovView(o)!=="fascia") return [];
  return (S.inCorso||[]).filter(i=>S.matches[i]).slice().sort((a,b)=>a-b); }
function ovPrimo(){
  const o = ovO(); if(o.primo>=0 && S.matches[o.primo]) return o.primo;
  const ic = (S.inCorso||[]).filter(i=>S.matches[i]); if(ic.length>1){ const L = ovRotList(); if(L.length>1) return L[ovRotI % L.length]; }
  if(ic.length) return ic[ic.length-1];
  if(isTorneo()){ const i = S.matches.findIndex(m=>!winner(m) && hasPts(m)); if(i>=0) return i; const j = S.matches.findIndex(m=>!winner(m)); if(j>=0) return j; }
  return -1;
}

/* ---- campionati a squadre: tabellone ---- */
function ovRow(m, i, two){
  const [x, y] = SDS(), ix = sd => sd==="h" ? 0 : 1, w = winner(m), act = isAct(i), p = m.pts || 1;
  const win = w ? " win-" + (w===x ? "L" : "R") : "";
  const ic = act ? `<span class="ic">IN CORSO${ovBil(m)}</span>` : "";
  const pt = w && !isTorneo() ? `<span class="pt ${w===x ? "L" : "R"}">+${p} ${p>1 ? "PUNTI" : "PUNTO"}</span>` : "";
  const sc = sd => `<div class="sc ${sd} ${sd===x ? "L" : "R"}${w===sd ? " w" : ""}" data-sc="${i}.${sd}">${m.s[ix(sd)]}</div>`;
  const setc = m.defs && m.defs.length>1 ? `<div class="setc">${setLabel(m.sk, m.defs.length)} · SET <b>${m.sw[ix(x)]}–${m.sw[ix(y)]}</b></div>` : "";
  const label = isTorneo() ? (m.turno || "") : m.kind;
  const cls = `row${m.kind==="Staffetta" ? " relay" : ""}${act ? " active" : ""}${x==="a" ? " sw" : ""}${win}`;
  if(m.kind!=="Staffetta"){
    const pl = sd => `<div class="pl ${sd} ${sd===x ? "L" : "R"}${two ? " two" : ""}">${m[sd].map((_,j)=>{ const t = ovName(m, sd, j); return `<div class="p${t ? "" : " e"}">${t}</div>`; }).join("")}</div>`;
    return `<div class="${cls}">${ic}${pt}${pl(x)}${sc(x)}
      <div class="mid"><div class="k"><em>${i+1}</em>${esc(label)}</div>${ovSpec(m)}${setc}${ovBars(m, x, y)}</div>
      ${sc(y)}${pl(y)}</div>`;
  }
  const idx = relayIdx(m), done = !!w, n = m.h.length;
  const list = sd => `<div class="rl ${sd} ${sd===x ? "L" : "R"}">` + m[sd].map((_,j)=>{
    const st = (j<idx || done && j<=idx) ? "done" : !done && j===idx ? "cur" : "";
    const pv = (sd==="h" ? m.ph : m.pa)[j], show = j<=idx || pv>0, t = ovName(m, sd, j);
    const no = `<span class="no">${j+1}</span>`, nm = `<span class="nm${t ? "" : " e"}">${t}</span>`, fp = `<span class="fp">${show ? pv : ""}</span>`;
    return `<div class="r ${st}">${sd===x ? fp + nm + no : no + nm + fp}</div>`; }).join("") + `</div>`;
  return `<div class="${cls}">${ic}${pt}${list(x)}${sc(x)}
    <div class="mid"><div class="k"><em>${i+1}</em>Staffetta ${n}×${m.step}${p>1 ? ` · ${p} punti` : ""}</div>${ovSpec(m)}${ovBars(m, x, y)}
      <div class="fr">${m.h.map((_,f)=>`<span class="${f<idx || done ? "d" : ""} ${!done && f===idx ? "c" : ""}">${f+1}ª</span>`).join("")}</div>
      <div class="nx">${done ? "Staffetta conclusa" : idx<n-1 ? `Cambio a <b>${(idx+1)*m.step}</b>` : "Ultima frazione"}</div></div>
    ${sc(y)}${list(y)}</div>`;
}
function ovSquadreHTML(){
  const t = totals(), [x, y] = SDS(), ix = sd => sd==="h" ? 0 : 1;
  const team = sd => { const o = sd==="h" ? S.home : S.away;
    const img = sd==="h" ? `<img src="${LOGO_HOME}" alt="">` : S.away.logo ? `<img src="${esc(S.away.logo)}" alt="">` : `<div class="badge">${esc(S.away.badge || "")}</div>`;
    return `<div class="team ${sd} ${sd===x ? "L" : "R"}">${img}<div class="tn"><div class="n">${esc(o.name)}</div><div class="c">${esc(o.city)}</div></div></div>`; };
  return ovHdr(false) + `<div class="sq"><div class="teams${x==="a" ? " sw" : ""}">${team(x)}<div class="total"><b class="${x}" data-tot="${x}">${t[ix(x)]}</b><span>PUNTI</span><b class="${y}" data-tot="${y}">${t[ix(y)]}</b></div>${team(y)}</div>
    <div class="rows">${S.matches.map((m,i)=>ovRow(m, i, m.h.length>1)).join("")}</div></div>`;
}
function ovFm(){ const f = S.formule[0]; if(!f) return ""; const fd = formulaDefs(f), d = fd[0] || {};
  return `${esc(d.spec || "a scelta")}${d.target ? ` a <b>${d.target}</b>` : ""} · ${f.n===1 ? "set secco" : f.n===3 ? "2 su 3" : "3 su 5"}`; }
/* ---- torneo a incontri liberi: un turno alla volta ---- */
function ovTorneoHTML(){
  const turni = [...new Set(S.matches.map(m=>m.turno || ""))];
  const pi = ovPrimo(), cur = pi>=0 ? (S.matches[pi].turno || "") : (turni.find(tu=>S.matches.some(m=>(m.turno||"")===tu && !winner(m))) ?? turni[turni.length-1] ?? "");
  const ids = S.matches.map((m,i)=>i).filter(i=>(S.matches[i].turno || "")===cur).slice(0, 6);
  const fm = ovFm();
  const dots = turni.map(tu=>`<i class="${tu===cur ? "on" : ""}"></i>`).join("");
  if(!S.matches.length) return ovHdr(true) + `<div class="wait">Incontri non ancora inseriti</div>`;
  return ovHdr(true) + `<div class="nav"><span class="pg">${esc(cur)}</span><span class="dots">${turni.length>1 ? dots : ""}</span><span class="fm">${fm}</span></div>
    <div class="sq tor"><div class="rows">${ids.map(i=>ovRow(S.matches[i], i, S.gioco==="Coppia")).join("")}</div></div>`;
}
/* ---- torneo con batterie e finali: una pagina del tabellone ---- */
const OX0 = 26, OX1 = 1254, OGT = 118, OGB = 612;
function ovTabHTML(){
  const TB = buildTab(S), o = ovO(), pages = TB.pages;
  if(!pages.length) return ovHdr(true);
  const liveOn = pg => [...pg.acqua, ...pg.rounds.flatMap(r=>r.ids)].some(id=>{ const L = TB.live.get(id); return L && !winner(L.m); });
  let pg = pages.find(p=>p.key===o.pag);
  if(!pg && o.ciclo>0) pg = pages[ovCycOff % pages.length];
  if(!pg){ pg = pages.find(liveOn) || pages.find(p=>p.key!=="fin" && !(TB.nodes.get(p.last) || {}).w) || pages.find(p=>p.key==="fin") || pages[0]; }
  ovPage = pg.key;
  const fm = ovFm();
  const dots = pages.map(p=>`<i class="${p.key===pg.key ? "on" : ""}${p.key==="fin" ? " f" : ""}"></i>`).join("");
  const g = ovTree(TB, pg);
  return ovHdr(true) + `<div class="nav"><span class="pg">${esc(pg.full)}</span><span class="dots">${pages.length>1 ? dots : ""}</span><span class="fm">${fm}</span></div>
    <div class="g"><svg width="1280" height="720">${g.paths}</svg>${g.labels}${g.cards}</div>`;
}
function ovCard(TB, id, x, y, w, h, extra){
  const nd = TB.nodes.get(id), L = TB.live.get(id), rs = (S.tab.res || {})[id] || {}, wn = nd.w;
  const lw = L ? winner(L.m) : null, play = L && !lw;
  const ix = k => k ? 1 : 0, multi = L && L.m.defs && L.m.defs.length>1;
  const side = (x2, k) => { const sd = k ? "a" : "h";
    let cls = "sd", nm;
    if(x2.tbd){ cls += " tbd"; nm = `<span class="n">${esc(x2.lab || "da definire")}</span>`; }
    else if(x2.abs){ cls += " abs"; nm = `<span class="n">${esc(x2.name)}</span>`; }
    else { nm = `<span class="n">${ovNamesTxt(x2.name)}</span>`; const k0 = resolveName(String(x2.name).split("/")[0], "", gYear()); if(k0 && isClub(csbOf(rowAt(ANAG[k0], gYear())))) cls += " home"; }
    if(wn) cls += wn.sd===sd ? " w" : " l";
    const sc = L && (hasPts(L.m) || lw) ? (multi ? L.m.sw[ix(k)] : L.m.s[ix(k)]) : "";
    return `<div class="${cls}"><div class="nm">${nm}</div><div class="cs" data-cs="${id}.${k}">${sc}</div></div>`; };
  const tag = play ? `<span class="tag">${w<200 ? "IN CORSO" : "IN CORSO"}${L.m.bil ? (w<200 ? ` · B${esc(L.m.bil)}` : ` · BILIARDO ${esc(L.m.bil)}`) : ""}</span>` : "";
  const tx = !L && rs.txt ? `<span class="tx">${esc(rs.txt)}</span>` : "";
  const cls = `card ${extra || ""}${play ? " inplay" : ""}`;
  return `<div class="${cls}" style="left:${Math.round(x)}px;top:${Math.round(y - h/2)}px;width:${Math.round(w)}px;height:${Math.round(h)}px">${tag}${tx}${side(nd.sd[0], 0)}${side(nd.sd[1], 1)}</div>`;
}
const ovElbow = (x1, y1, x2, y2, won) => { const mx = (x1+x2)/2; return `<path class="${won ? "w" : ""}" d="M${Math.round(x1)} ${Math.round(y1)}H${Math.round(mx)}V${Math.round(y2)}H${Math.round(x2)}"/>`; };
function ovTree(TB, pg){
  const R = pg.rounds, nA = pg.acqua.length, cols = R.length + (nA ? 1 : 0), qw = 240;
  const gap = cols<=3 ? 60 : 42, w = Math.min(340, (OX1 - OX0 - qw - cols*gap) / cols);
  const n0 = R[0].ids.length, pitch = (OGB - OGT) / n0, two = S.gioco==="Coppia";
  const h = two ? Math.min(100, pitch - 16) : Math.min(78, pitch - 14), extra = (two ? "two" : "") + (w>=280 && pitch>=100 ? " big" : "");
  let cards = "", paths = "", labels = "", x = OX0;
  if(nA){   /* partite dell'acqua: accanto all'incontro che alimentano */
    const ha = Math.min(two ? 84 : 64, pitch*.46);
    labels += `<div class="cl" style="left:${x}px;width:${Math.round(w)}px;top:${OGT - 26}px">Acqua</div>`;
    pg.acqua.forEach(aid=>{
      let k = -1, s = 0; R[0].ids.forEach((id,j)=>TB.nodes.get(id).src.forEach((sr,q)=>{ if(sr.n===aid){ k = j; s = q; } }));
      const yy = k>=0 ? OGT + (k + .5)*pitch + (s ? 1 : -1)*pitch*.25 : OGT + pitch/2;
      cards += ovCard(TB, aid, x, yy, w, ha, (two ? "two" : "") + " acq");
      if(k>=0) paths += ovElbow(x + w, yy, x + w + gap, OGT + (k + .5)*pitch + (s ? 1 : -1)*h/4, !!TB.nodes.get(aid).w);
    });
    x += w + gap;
  }
  let ys = Array.from({length:n0}, (_,j)=>OGT + (j + .5)*pitch);
  R.forEach((rd, c)=>{
    labels += `<div class="cl" style="left:${Math.round(x)}px;width:${Math.round(w)}px;top:${OGT - 26}px">${esc(rd.label)}</div>`;
    rd.ids.forEach((id, j)=>{ cards += ovCard(TB, id, x, ys[j], w, h, extra); });
    if(c < R.length - 1){ const nys = [];
      for(let j=0; j<rd.ids.length; j+=2){ const py = (ys[j] + ys[j+1]) / 2; nys.push(py);
        paths += ovElbow(x + w, ys[j], x + w + gap, py, !!TB.nodes.get(rd.ids[j]).w) + ovElbow(x + w, ys[j+1], x + w + gap, py, !!TB.nodes.get(rd.ids[j+1]).w); }
      ys = nys; }
    x += w + gap;
  });
  /* colonna finale: chi passa alle finali, oppure il vincitore */
  const lw = (TB.nodes.get(pg.last) || {}).w, ok = lw && !lw.abs, qx = OX1 - qw, qh = two ? 84 : 58;
  const fin = pg.key==="fin" || TB.pages.length===1, lab = fin ? (two ? "Vincitori" : "Vincitore") : "Alle finali";
  labels += `<div class="cl fin" style="left:${qx}px;width:${qw}px;top:${OGT - 26}px">${lab}</div>`;
  paths += ovElbow(x - gap, ys[0], qx, ys[0], ok);
  cards += `<div class="card q${ok ? " ok" : ""}${two ? " two" : ""}" style="left:${qx}px;top:${Math.round(ys[0] - qh/2)}px;width:${qw}px;height:${qh}px"><div class="sd${ok ? " w" : " tbd"}"><div class="nm"><span class="n">${ok ? ovNamesTxt(lw.name) : "—"}</span></div></div></div>`;
  return {cards, paths, labels};
}
/* ---- fascia dell'incontro in primo piano ---- */
function ovFasciaHTML(){
  const lv = OVMINI && S.stato==="live" ? `<span class="live"><i></i>LIVE</span>` : "";
  const chip = `<div class="chip"><img src="${LOGO_56}" alt="">${esc(S.title)}${S.subtitle ? `<span class="t2">${esc(S.subtitle)}</span>` : ""}${lv}</div>`;
  const i = ovPrimo(), m = S.matches[i]; if(!m) return chip + (OVMINI && !isTorneo() ? ovTeamBand() : "");
  const L = ovRotList(), dots = L.length>1 ? `<div class="rot">${L.map(j=>`<i class="${j===i ? "on" : ""}"></i>`).join("")}</div>` : "";
  const [x, y] = SDS(), ix = sd => sd==="h" ? 0 : 1, w = winner(m), tor = isTorneo(), yy = gYear();
  const club = (sd) => tor ? "" : esc((sd==="h" ? S.home : S.away).short || (sd==="h" ? S.home : S.away).name);   /* squadra solo nei campionati a squadre */
  const names = sd => { const ns = m[sd].map((_,j)=>ovName(m, sd, j)).filter(Boolean); return ns.length ? ns.map(n=>`<span>${n}</span>`).join("") : "—"; };   /* coppie: un nome per riga */
  const side = sd => `<div class="side ${sd} ${sd===x ? "L" : "R"}">${tor ? "" : `<div class="tm">${club(sd)}</div>`}<div class="p${m[sd].length>1 && m.kind!=="Staffetta" ? " two" : ""}">${m.kind==="Staffetta" ? ovName(m, sd, Math.min(relayIdx(m), m[sd].length-1)) || "—" : names(sd)}</div></div>`;
  const sc = sd => `<div class="lsc ${sd}${w===sd ? " w" : ""}" data-sc="${i}.${sd}">${m.s[ix(sd)]}</div>`;
  const t = totals();
  const k = tor ? [m.turno || "", m.bil ? "Biliardo " + esc(m.bil) : ""].filter(Boolean).join(" · ") : [`Incontro ${i+1}`, m.kind + (m.kind==="Staffetta" ? ` · ${relayIdx(m)+1}ª frazione` : ""), m.bil ? "Biliardo " + esc(m.bil) : ""].filter(Boolean).join(" · ");
  const extra = tor ? (m.defs && m.defs.length>1 ? `<div class="tot">${setLabel(m.sk, m.defs.length)} · SET <b>${m.sw[ix(x)]}</b>–<b>${m.sw[ix(y)]}</b></div>` : "")
                    : `<div class="tot">PUNTI SQUADRA <b class="${x}">${t[ix(x)]}</b>–<b class="${y}">${t[ix(y)]}</b></div>`;
  const fresh = i!==ovLastPrimo && ovLastPrimo!==-2; ovLastPrimo = i;
  return chip + `<div class="lt${x==="a" ? " sw" : ""}${fresh ? " in" : ""}${dots ? " rotn" : ""}">${dots}${side(x)}${sc(x)}<div class="mid"><div class="k">${k}</div>${ovSpec(m)}${ovBars(m, x, y)}${extra}</div>${sc(y)}${side(y)}</div>`;
}
/* mini-overlay, campionati a squadre, nessun incontro in corso: squadre e punti */
function ovTeamBand(){
  const t = totals(), [x, y] = SDS(), ix = sd => sd==="h" ? 0 : 1, done = S.matches.filter(m=>winner(m)).length, n = S.matches.length;
  const side = sd => { const o = sd==="h" ? S.home : S.away; return `<div class="side ${sd} ${sd===x ? "L" : "R"}"><div class="tm">${esc(o.city || "")}</div><div class="p">${esc(o.short || o.name)}</div></div>`; };
  const nx = S.matches.findIndex(m=>!winner(m));
  const k = S.stato==="finita" ? "Risultato finale" : done ? `${done} incontr${done>1 ? "i" : "o"} su ${n}` : "Si comincia";
  const sub = S.stato!=="finita" && nx>=0 ? `<div class="tot">PROSSIMO · ${nx+1} ${esc(S.matches[nx].kind)}</div>` : "";
  ovLastPrimo = -1;
  return `<div class="lt team${x==="a" ? " sw" : ""}">${side(x)}<div class="lsc ${x}" data-tot="${x}">${t[ix(x)]}</div><div class="mid"><div class="k">${k}</div><div class="s">Punti squadra</div>${sub}</div><div class="lsc ${y}" data-tot="${y}">${t[ix(y)]}</div>${side(y)}</div>`;
}
/* ---- disegno ---- */
function ovRender(){
  const app = $("#app"), o = ovO();
  if(!S){ app.innerHTML = `<div id="ov" class="off"></div>`; ovScale(); return; }
  const v = ovView(o);
  const body = v==="off" ? "" : v==="fascia" ? ovFasciaHTML() : isTorneo() ? (isTab() ? ovTabHTML() : ovTorneoHTML()) : ovSquadreHTML();
  app.innerHTML = `<div id="ov" class="${v}${OVMINI ? " mini" : ""}" style="--bga:${o.bga ?? .55}">${body}</div>`;
  const el = $("#ov");
  el.querySelectorAll(".tn .n,.pl .p,.rl .nm,.hdr .t1,.hdr .t2,.card .n,.lt .p,.lt .tm,.lt .mid .k,.nav .pg").forEach(e=>{   /* nomi lunghi: si stringe il carattere */
    e.style.fontSize = ""; let fs = parseFloat(getComputedStyle(e).fontSize), min = fs*.6;
    while(e.scrollWidth > e.clientWidth + 1 && fs > min){ fs -= 1; e.style.fontSize = fs + "px"; } });
  if(ovPrev && ovPrev.id===ovId) S.matches.forEach((m,i)=>{ const q = ovPrev.st.matches[i]; if(!q) return;
    ["h","a"].forEach((sd,k)=>{ if(q.s[k]!==m.s[k]) el.querySelectorAll(`[data-sc="${i}.${sd}"]`).forEach(e=>e.classList.add("bump")); }); });
  ovPrev = {id:ovId, st:clone(S)};
  ovScale();
}
try{ document.fonts.ready.then(()=>{ if(mode==="overlay") render(); }); }catch(e){}

/* ================= regia: pannello 📺 Onda (comandi immediati per l'overlay, nodo onda/<gara>) ================= */
let ondaOpen = false, ondaOn = false, ondaLastV = "tab", ondaErr = "";
function ondaWatch(){ if(ondaOn || !db || !GARA) return; ondaOn = true;
  db.ref("onda/" + GARA).on("value", s=>{ O = s.val() || null; if(ovO().v!=="off") ondaLastV = ovO().v; ondaPaint(); }, ()=>{ ondaErr = "Non riesco a leggere i comandi dell'overlay: aggiungi il nodo onda alle regole del database."; ondaPaint(); }); }
async function ondaSet(patch){
  const n = Object.assign(ovO(), patch); if(n.v!=="off") ondaLastV = n.v; O = n; ondaPaint();
  try{ await dbWrite({["onda/" + GARA]: n}); ondaErr = ""; }
  catch(err){ ondaErr = err && err.code==="PERMISSION_DENIED" ? "Comando non inviato: Firebase lo rifiuta. Aggiungi il nodo onda alle regole del database (vedi manuale, Dirette video)." : "Comando non inviato: controlla la connessione."; }
  ondaPaint(); setFlash(ondaErr || ({tab:"In onda: tabellone", fascia:"In onda: fascia dell'incontro", off:"Overlay nascosto"})[n.v] || "Comando inviato");
}
const ondaMatches = () => S.matches.map((m,i)=>({i, m})).filter(x=>!isTorneo() || !winner(x.m) || isAct(x.i));
function ondaPaint(){
  const p = document.getElementById("ondap"); if(!p || !ondaOpen || !S){ if(p) p.hidden = true; return; }
  const o = ovO(), pub = (PUBLIC_URL || pageURL("")).replace(/\/$/, "/");
  const lab = (m,i) => `${i+1} · ${isTorneo() ? (m.turno||"") : m.kind} · ${(namesOf(m, "h") || "—")} – ${(namesOf(m, "a") || "—")}${isAct(i) ? " (in corso)" : ""}`;
  const pages = isTab() ? buildTab(S).pages : [];
  p.hidden = false;
  p.innerHTML = `<div class="oh"><b>📺 Onda</b><span>comandi immediati per l'overlay di OBS</span><button class="ox" data-o="x" aria-label="Chiudi">✕</button></div>
    <div class="og"><span>In onda</span><div class="seg">${[["tab","Tabellone"],["fascia","Fascia incontro"],["off","Nascosto"]].map(([k,t])=>`<button data-o="v:${k}" class="${o.v===k ? "on" : ""}">${t}</button>`).join("")}</div></div>
    <div class="og"><span>Incontro in primo piano</span><select data-o="primo"><option value="-1">Automatico (l'ultimo messo in corso)</option>${ondaMatches().map(x=>`<option value="${x.i}"${o.primo===x.i ? " selected" : ""}>${esc(lab(x.m, x.i))}</option>`).join("")}</select></div>
    ${pages.length>1 ? `<div class="og"><span>Pagina del tabellone</span><div class="two"><select data-o="pag"><option value="">Automatica</option>${pages.map(pg=>`<option value="${pg.key}"${o.pag===pg.key ? " selected" : ""}>${esc(pg.title)}</option>`).join("")}</select>
      <select data-o="ciclo" title="Rotazione automatica delle pagine (con pagina Automatica)">${[[0,"Ferma"],[10,"Ruota ogni 10 s"],[15,"Ruota ogni 15 s"],[20,"Ruota ogni 20 s"],[30,"Ruota ogni 30 s"]].map(([v,t])=>`<option value="${v}"${(+o.ciclo||0)===v ? " selected" : ""}>${t}</option>`).join("")}</select></div></div>` : ""}
    <div class="og"><span>Sfondo del tabellone</span><div class="two"><input type="range" min="0" max="1" step="0.05" value="${o.bga ?? .55}" data-o="bga"><b>${Math.round((o.bga ?? .55)*100)}%</b></div></div>
    ${camHTML()}
    <div class="og lk"><span>Sorgente Browser in OBS (1280×720)</span>
      <div class="two"><code>${esc(pub)}?overlay&amp;live</code><button data-o="copy:live">Copia</button></div>
      <div class="two"><code>${esc(pub)}?overlay&amp;gara=${esc(GARA)}</code><button data-o="copy:gara">Copia</button></div>
      <div class="two"><code>${esc(pub)}?overlay&amp;mini&amp;live</code><button data-o="copy:mini">Copia</button></div>
      <div class="two"><code>${esc(pub)}?overlay&amp;riepilogo&amp;live</code><button data-o="copy:riep">Copia</button></div>
      <small>Gli ultimi due sono per le dirette con telecamera (due widget di PRISM): la fascia con l'incontro in primo piano (tasto F per cambiarlo), e il riepilogo a tutto schermo che compare al posto della fascia quando è in onda il Tabellone (tasto V).</small></div>
    ${ondaErr ? `<p class="err">${esc(ondaErr)}</p>` : ""}
    <p class="hint">Tasti: <kbd>N</kbd> nascondi/mostra · <kbd>V</kbd> tabellone/fascia · <kbd>F</kbd> incontro in primo piano · <kbd>[</kbd> <kbd>]</kbd> sfondo. Risultati e nomi vanno in onda con PUBBLICA; questi comandi subito.</p>`;
}
function ondaToggle(){
  ondaOpen = !ondaOpen; ondaWatch(); camWatch(); if(ondaOpen) telStart(); else telStop();
  let p = document.getElementById("ondap");
  if(!p){ p = document.createElement("div"); p.id = "ondap"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Comandi dell'overlay"); document.body.appendChild(p);
    p.addEventListener("click", e=>{ const b = e.target.closest("[data-o]"); if(!b || b.tagName==="SELECT" || b.tagName==="INPUT") return; const [k, v] = b.dataset.o.split(":");
      if(k==="x"){ ondaToggle(); renderBar(); }
      else if(k==="v") ondaSet({v});
      else if(k==="cam") camClick(v);
      else if(k==="copy"){ const t = (PUBLIC_URL || pageURL("")) + (v==="live" ? "?overlay&live" : v==="mini" ? "?overlay&mini&live" : v==="riep" ? "?overlay&riepilogo&live" : "?overlay&gara=" + GARA);
        try{ navigator.clipboard.writeText(t).then(()=>setFlash("Indirizzo per OBS copiato"), ()=>setFlash(t)); }catch(err){ setFlash(t); } } });
    p.addEventListener("change", e=>{ const k = e.target.dataset.o; if(!k) return;
      if(k==="primo") ondaSet({primo:+e.target.value}); else if(k==="pag") ondaSet({pag:e.target.value}); else if(k==="ciclo") ondaSet({ciclo:+e.target.value}); else if(k==="bga") ondaSet({bga:+e.target.value});
      else if(k==="camz" || k==="camf" || k==="camr"){ camDrag = false; camSet(({camz:"zoom", camf:"fuoco", camr:"rot"})[k], +e.target.value); } });
    p.addEventListener("input", e=>{ const k = e.target.dataset.o;
      if(k==="bga"){ const b = e.target.parentNode.querySelector("b"); if(b) b.textContent = Math.round(e.target.value*100) + "%"; }
      else if(k==="camz" || k==="camf" || k==="camr") camInput(({camz:"zoom", camf:"fuoco", camr:"rot"})[k], e.target); });
  }
  ondaPaint();
}
/* ================= regia: telefono con l'app B2P Camera (nodo camera, uno solo per tutte le gare) =================
   Comandi: l'app ascolta il nodo camera e applica solo la voce k (con t nuovo): all'avvio non riprende comandi vecchi.
   camera = {mic, cam, ov, af: true/false, zoom, fuoco: 0-100, rot: gradi -10..10, q: "540"/"720"/"1080", gira e bolla: contatori, k, t, guarda}.
   Ritorno (dal 09/11/2026, app 0.6 con account in ⚙): il telefono scrive telefono/stato (ogni 3 s) e telefono/foto
   (anteprima JPEG ogni 2 s, solo finché la regia "guarda": camera/guarda cambia ogni 15 s col pannello aperto).
   telefono si legge solo da utenti autenticati: fetch REST con idToken ogni 2 s. Con lo stato fresco (cambiato
   negli ultimi 12 s) i pulsanti mostrano lo stato vero del telefono, altrimenti gli ultimi comandi inviati. */
let C = null, camOn = false, camErr = "", camLast = 0, camDrag = false;   /* camDrag: cursore in movimento, niente ridisegno del pannello */
let TEL = null, telVisto = 0, telT = 0, telTimer = 0, telGuarda = 0, telFirma = "";
const CAM0 = {mic:true, cam:true, ov:false, af:true, zoom:0, fuoco:0, rot:0, gira:0, bolla:0};
const camO = () => Object.assign({}, CAM0, C || {});
const telFresco = () => TEL && TEL.stato && Date.now() - telVisto < 12000;
/* stato mostrato: quello vero del telefono se fresco, altrimenti gli ultimi comandi */
const camV = () => { const c = camO(); if(!telFresco()) return c; const st = TEL.stato;
  ["mic","cam","ov","af","zoom","fuoco","rot"].forEach(k=>{ if(st[k]!==undefined) c[k] = st[k]; }); return c; };
function camWatch(){ if(camOn || !db) return; camOn = true;
  db.ref("camera").on("value", s=>{ C = s.val() || null; if(!camDrag) ondaPaint(); }, ()=>{ camErr = "Non riesco a leggere il nodo camera: aggiungilo alle regole del database."; ondaPaint(); }); }
async function camSet(k, val, paint = true){
  const n = Object.assign(camO(), {[k]: val, k, t: Date.now()}); C = n;
  try{ await dbWrite({camera: n}); camErr = ""; }
  catch(err){ camErr = err && err.code==="PERMISSION_DENIED" ? "Comando non inviato: Firebase lo rifiuta. Aggiungi il nodo camera alle regole del database (vedi manuale, Dirette video)." : "Comando non inviato: controlla la connessione."; }
  if(paint) ondaPaint(); if(camErr) setFlash(camErr);
}
function camClick(v){ const c = camV();
  if(v==="mic" || v==="cam" || v==="ov" || v==="af") camSet(v, !c[v]);
  else if(v==="gira" || v==="bolla") camSet(v, (+camO()[v] || 0) + 1);
  else if(v==="dritto") camSet("rot", 0);
  else if(/^q\d+$/.test(v)) camSet("q", v.slice(1)); }
/* cursori: mentre si trascina, un comando ogni 300 ms (il valore finale lo manda "change") */
const camFmt = (k, v) => k==="rot" ? (v>0 ? "+" : "") + (+v).toFixed(1).replace(".", ",") + "°" : v + "%";
function camInput(k, el){ const b = el.parentNode.querySelector("b"); if(b) b.textContent = camFmt(k, el.value);
  camDrag = true; const now = Date.now();
  if(now - camLast > 300){ camLast = now; camSet(k, +el.value, false); } }
/* pannello aperto: "guardo" ogni 15 s (il telefono manda l'anteprima) e lettura del telefono ogni 2 s */
function telStart(){ if(telTimer) return; telTick(); telTimer = setInterval(telTick, 2000); }
function telStop(){ clearInterval(telTimer); telTimer = 0; }
async function telTick(){
  if(!ondaOpen){ telStop(); return; }
  const now = Date.now();
  if(now - telGuarda > 15000){ telGuarda = now; try{ await dbWrite({"camera/guarda": now}); }catch(e){} }
  let j = null;
  try{ const r = await fetch(FIREBASE.databaseURL + "/telefono.json?auth=" + encodeURIComponent(await idToken())); if(r.ok) j = await r.json(); }catch(e){ return; }
  TEL = j; const t = j && j.stato && +j.stato.t || 0; if(t && t!==telT){ telT = t; telVisto = Date.now(); }
  const img = document.getElementById("camfoto"); if(img && j && j.foto && img.getAttribute("src")!==j.foto) img.setAttribute("src", j.foto);
  const st = document.getElementById("camst"); if(st) st.innerHTML = telStatoHTML();
  const c = camV(), firma = [c.mic,c.cam,c.ov,c.af,c.zoom,c.fuoco,c.rot,telFresco(),!!(j && j.foto),j && j.stato && j.stato.q,j && j.stato && j.stato.live].join();
  if(firma!==telFirma && !camDrag){ telFirma = firma; ondaPaint(); }
}
function telStatoHTML(){
  if(!TEL || !TEL.stato) return "Telefono: nessuna notizia (serve l'app 0.6 con l'account in ⚙ → Regia).";
  const s = TEL.stato, fresco = telFresco();
  return `${fresco ? "" : "⚠ non risponde da un po' · "}${s.live ? `<b class="rec">● IN DIRETTA</b> ${String(s.mbit ?? "").replace(".", ",")} Mbit/s` : "fuori onda"} · ${esc(s.q || "")} · 🔋 ${+s.batt || 0}%`;
}
/* qualità del telefono (540/720/1080): l'app si riavvia per cambiarla, quindi solo fuori diretta (dall'11/11/2026) */
function camQualHTML(){
  const st = telFresco() ? TEL.stato : null, live = !!(st && st.live);
  const cur = st && st.q ? String(st.q).replace("p", "") : String(camO().q || "720");
  const b = q => `<button data-o="cam:q${q}" class="${cur===q ? "on" : ""}"${live ? " disabled" : ""}>${q}p</button>`;
  return `<div class="two"><small>Qualità</small><div class="seg">${b("540")}${b("720")}${b("1080")}</div></div>
      ${live ? `<small>La qualità si cambia fuori diretta: l'app si riavvia (2–3 s).</small>` : ""}`;
}
function camHTML(){ const c = camV(), sw = (k, on, t1, t0) => `<button data-o="cam:${k}" class="${on ? "on" : ""}">${on ? t1 : t0}</button>`;
  const rot = +c.rot || 0, foto = TEL && TEL.foto;
  return `<div class="og cam"><span>📱 Telefono con B2P Camera</span>
      <div class="foto">${foto ? `<img id="camfoto" src="${foto}" alt="Anteprima del telefono">` : `<img id="camfoto" alt="" hidden><p>Anteprima: compare qui quando il telefono ha l'account in ⚙ → Regia (circa una foto ogni 2 secondi, con l'overlay).</p>`}</div>
      <small id="camst">${telStatoHTML()}</small>
      <div class="seg">${sw("mic", c.mic, "🎤 Microfono ON", "🎤 Microfono OFF")}${sw("cam", c.cam, "🎥 Immagine ON", "🎥 Nero")}${sw("ov", c.ov, "🏷 Overlay ON", "🏷 Overlay OFF")}</div>
      <div class="two"><small>Zoom</small><input type="range" min="0" max="100" step="1" value="${+c.zoom || 0}" data-o="camz"><b>${+c.zoom || 0}%</b></div>
      <div class="two"><button data-o="cam:af" class="${c.af ? "" : "on"}">${c.af ? "Fuoco AUTO" : "Fuoco MAN"}</button><input type="range" min="0" max="100" step="1" value="${+c.fuoco || 0}" data-o="camf"${c.af ? " disabled" : ""}><b>${+c.fuoco || 0}%</b></div>
      <div class="two"><button data-o="cam:bolla" title="Il telefono legge il suo sensore e si raddrizza da solo">📐 In bolla</button><input type="range" min="-10" max="10" step="0.5" value="${rot}" data-o="camr" title="Raddrizza a mano: gradi"><b>${camFmt("rot", rot)}</b></div>
      ${camQualHTML()}
      <div class="two"><button data-o="cam:gira">🔄 Cambia fotocamera</button><button data-o="cam:dritto" title="Toglie la correzione della bolla">Bolla a 0°</button></div>
      ${camErr ? `<p class="err">${esc(camErr)}</p>` : ""}
      <small>Fuoco: 0 = lontano, 100 = vicino. I comandi arrivano in 1–2 s. ${telFresco() ? "I pulsanti mostrano lo stato del telefono." : "Senza notizie dal telefono i pulsanti mostrano gli ultimi comandi inviati."}</small></div>`;
}
document.addEventListener("keydown", e=>{
  if(!editor || mode!=="board" || e.ctrlKey || e.metaKey || e.altKey) return;
  const ae = document.activeElement; if(ae && (ae.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(ae.tagName))) return;
  const k = e.key.toLowerCase(), o = ovO(); if(!/^[nvf\[\]]$/.test(k)) return;
  ondaWatch();
  if(k==="n") ondaSet({v: o.v==="off" ? (ondaLastV || "tab") : "off"});
  else if(k==="v") ondaSet({v: o.v==="fascia" ? "tab" : "fascia"});
  else if(k==="f"){ const L = (S.inCorso||[]).length ? S.inCorso : ondaMatches().map(x=>x.i); if(!L.length) return;
    const cur = L.indexOf(o.primo); ondaSet({primo: L[(cur + 1) % L.length]}); }
  else if(k==="[") ondaSet({bga: Math.min(1, Math.round(((o.bga ?? .55) + .1)*20)/20)});
  else if(k==="]") ondaSet({bga: Math.max(0, Math.round(((o.bga ?? .55) - .1)*20)/20)});
});
