/* Tabellone Live · interazioni.js — Comandi: punteggi e tastierino, andamento, finestre dei tornei, nuova gara, logo
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= interazioni ================= */
const app = $("#app");
let wasFocused = null;
app.addEventListener("mousedown", ()=>{ wasFocused = document.activeElement; });
app.addEventListener("keydown", e=>{
  if(!e.target.isContentEditable) return;
  if(e.key==="Enter"){ e.preventDefault(); e.target.blur(); }
  if(e.key==="Escape"){ e.target.dataset.cancel = 1; e.target.blur(); }
});
app.addEventListener("focusout", e=>{
  const el = e.target; if(!editor || !el.isContentEditable) return;
  const txt = el.textContent.replace(/\s+/g," ").trim();
  if(el.dataset.cancel){ setTimeout(render); return; }
  if(el.dataset.bil!=null){ const m = S.matches[+el.dataset.bil], v = txt.slice(0, 6); if(m && (m.bil||"")!==v){ snapshot(); m.bil = v; } setTimeout(commit); }   /* numero del biliardo */
  else if(el.dataset.ed){ if(getP(el.dataset.ed)!==txt){ snapshot(); setP(el.dataset.ed, txt); } setTimeout(commit); }
  else if(el.dataset.ss){
    const [i,k,sd] = el.dataset.ss.split("."), v = entryValue(txt, scoreCur(el), el.dataset.mode || "add");
    setTimeout(()=>{ if(v!==null) setSetScore(+i, +k, sd, v); render(); });
  }
  else if(el.dataset.fr || el.dataset.sc){
    const op = el.dataset.mode || "add", fr = el.dataset.fr, [i,sd,j] = (fr || el.dataset.sc).split(".");
    const v = entryValue(txt, scoreCur(el), op);
    setTimeout(()=>{ if(v!==null){ fr ? setFrac(+i, sd, +j, v) : setScore(+i, sd, v); } render(); });
  }
});
/* punti: "10" si somma al totale (o lo toglie / lo imposta con i pulsanti); da tastiera anche +10, -10, =150 */
function scoreCur(el){
  if(el.dataset.fr){ const [i,sd,j] = el.dataset.fr.split("."); return S.matches[i][sd==="h"?"ph":"pa"][j]; }
  if(el.dataset.ss){ const [i,k,sd] = el.dataset.ss.split("."); return S.matches[i].ss[k][sd==="h"?0:1]; }
  const [i,sd] = el.dataset.sc.split("."), m = S.matches[i];
  return m.defs ? m.ss[editSet(m)][sd==="h"?0:1] : m.s[sd==="h"?0:1];
}
function entryValue(txt, cur, op){
  const mm = txt.replace(/\s/g,"").match(/^([+=\-−–])?(\d+)$/); if(!mm) return null;
  if(mm[1]) op = mm[1]==="+" ? "add" : mm[1]==="=" ? "set" : "sub";
  const n = +mm[2];
  return op==="set" ? n : op==="sub" ? Math.max(0, cur - n) : cur + n;
}
const kp = $("#kp");
function hideKp(){ kp.classList.remove("on"); }
function showKp(el){
  kp.classList.add("on");
  const rc = el.getBoundingClientRect(), h = kp.offsetHeight, w = kp.offsetWidth, vw = document.documentElement.clientWidth;
  const top = rc.top - h - 8 >= 0 ? rc.top - h - 8 : rc.bottom + 8;
  kp.style.top = (top + scrollY) + "px";
  kp.style.left = (Math.max(8, Math.min(rc.right - w, vw - w - 8)) + scrollX) + "px";
}
app.addEventListener("focusin", e=>{
  const el = e.target; if(!editor || !el.dataset || !(el.dataset.sc || el.dataset.fr || el.dataset.ss)) return;
  el.dataset.cur = scoreCur(el); delete el.dataset.mode; el.textContent = ""; showKp(el);
});
app.addEventListener("focusout", e=>{ if(e.target.dataset && (e.target.dataset.sc || e.target.dataset.fr || e.target.dataset.ss)) hideKp(); }, true);
["mousedown","pointerdown"].forEach(t=>kp.addEventListener(t, e=>e.preventDefault()));
kp.addEventListener("click", e=>{
  const b = e.target.closest("button"), el = document.activeElement;
  if(!b || !el || !el.dataset || !(el.dataset.sc || el.dataset.fr || el.dataset.ss)) return;
  el.dataset.mode = b.dataset.k; el.blur();
});
/* ---- andamento: grafico e parziali, letti da storia/<gara> (si aggiorna da solo mentre è aperto) ---- */
let trOff = null, trI = -1, trData = null;
function openTrend(i){
  trI = i; trData = null; $("#trm").hidden = false; drawTrend();
  if(!db){ trData = "err"; drawTrend(); return; }
  const ref = db.ref("storia/" + GARA), cb = snap=>{ trData = snap.val() || {}; drawTrend(); };
  ref.on("value", cb, ()=>{ trData = "err"; drawTrend(); });
  trOff = ()=>ref.off("value", cb);
}
function closeTrend(){ $("#trm").hidden = true; if(trOff) trOff(); trOff = null; trI = -1; }
/* parziali dei set, in testa al popup */
function setsTableHTML(m){
  const n = m.defs.length;
  return `<table class="st"><thead><tr><th>Set ${m.sw[0]}–${m.sw[1]}</th><th class="spc"></th>${SDS().map(sd=>`<th class="${sd}">${esc(sideName(m,sd))}</th>`).join("")}</tr></thead><tbody>` +
    m.defs.map((d,k)=>{
      const x = m.ss[k], w = setWin(m,k), skip = !(x[0]||x[1]) && m.play<0;
      const sp = d.opts && !d.target ? "a scelta all'acchito" : `${esc(d.spec)} <b>a ${d.target}</b>`;
      return `<tr class="${k===m.play ? "cur" : ""}"><td>${setLabel(k,n)}</td><td class="spc">${sp}</td>` +
        (skip ? `<td colspan="2" class="ng">non giocato</td>` : SDS().map(sd=>`<td class="${w===sd ? "w" : ""}">${x[sd==="h" ? 0 : 1]}</td>`).join("")) + `</tr>`;
    }).join("") + `</tbody></table>` + `<h4>Andamento</h4>`;
}
function drawTrend(){
  if(trI<0 || !S || !S.matches[trI]) return;
  const m = S.matches[trI], box = $("#trm .bx"), multi = !!(m.defs && m.defs.length>1);
  const head = multi ? `${trI+1} · ${esc(m.turno||"")}` : `${trI+1} · ${esc(isTorneo() ? (m.turno||"") : m.kind)} · ${esc(m.spec||"")}${m.target ? ` <b>a ${m.target}</b>` : ""}`;
  let html = `<button class="cls" data-cl aria-label="Chiudi">✕</button><h3>${head}</h3>` + (multi ? setsTableHTML(m) : "");
  if(trData===null){ box.innerHTML = html + `<p class="hint">Caricamento…</p>`; return; }
  if(trData==="err"){ box.innerHTML = html + `<p class="hint">Cronologia non disponibile.</p>`; return; }
  const ent = Object.values(trData).filter(e=>e && e.t && e.m).sort((a,b)=>a.t-b.t), key = mkey(m, trI), series = {};
  ent.forEach((e,ix)=>{
    const vals = [];
    if(e.m[key]){ const a = arr(e.m[key]); vals.push([+a[0]||0, +a[1]||0, +a[2]||0]); }
    for(let j=0; j<5; j++){ const v = e.m[key+"s"+j]; if(v){ const a = arr(v); vals.push([+a[0]||0, +a[1]||0, j]); } }
    vals.forEach(([h,a,k])=>{ const ps = series[k] || (series[k] = []);
      if(!ps.length) ps.push({t: ix>0 ? ent[ix-1].t : e.t, h:0, a:0});
      const last = ps[ps.length-1];
      if(ps.length>1 && last.t===e.t){ last.h = h; last.a = a; } else if(ps.length>1 || h || a) ps.push({t:e.t, h, a});
    });
  });
  /* gare pubblicate prima del 24/10: mancava il tiro che chiudeva un set; si ricostruisce dal punteggio finale del set */
  if(multi) Object.keys(series).map(Number).forEach(k=>{
    const ps = series[k], fin = m.ss[k], last = ps[ps.length-1];
    if(fin && (last.h!==fin[0] || last.a!==fin[1])){ const nx = series[k+1] && series[k+1].find(p=>p.t>last.t); ps.push({t: nx ? nx.t : last.t, h:fin[0], a:fin[1]}); }
  });
  const ks = Object.keys(series).map(Number).sort((a,b)=>a-b).filter(k=>series[k].length>1);
  if(!ks.length){ box.innerHTML = html + `<p class="hint">${multi ? "Il grafico" : "La cronologia"} si riempie a ogni pubblicazione dei punteggi: per ora non ci sono dati.</p>`; return; }
  html += `<div class="lg">${SDS().map(sd=>`<span class="${sd}">● ${esc(sideName(m,sd))}</span>`).join("")}</div>`;
  ks.forEach(k=>{
    const d = multi ? (m.defs[k] || {}) : m;
    if(multi) html += `<h4>${setLabel(k, m.defs.length)} · ${esc(d.spec||"")}${d.target ? ` <b>a ${d.target}</b>` : ""}</h4>`;
    html += chartHTML(series[k], d.target||0, m);
  });
  box.innerHTML = html + `<p class="hint">Un punto a ogni pubblicazione della regia.</p>`;
}
function chartHTML(pts, target, m){
  const W = 560, H = 230, L = 40, Rr = 12, T = 12, B = 26, t0 = pts[0].t, t1 = Math.max(pts.at(-1).t, t0 + 60000);
  const top = Math.max(target||0, ...pts.map(p=>Math.max(p.h,p.a))) || 1;
  const X = t => (L + (t-t0)/(t1-t0)*(W-L-Rr)).toFixed(1), Y = v => (T + (1 - v/top)*(H-T-B)).toFixed(1);
  const path = sd => pts.map((p,j)=>(j?"L":"M") + X(p.t) + " " + Y(p[sd])).join(" ");
  const dots = sd => pts.slice(1).map(p=>`<circle cx="${X(p.t)}" cy="${Y(p[sd])}" r="3.2"/>`).join("");
  const grid = [0, .5, 1].map(f=>`<line x1="${L}" x2="${W-Rr}" y1="${Y(top*f)}" y2="${Y(top*f)}" style="stroke:rgba(150,190,255,.12)"/>`).join("");
  const lab = (x, y, t, anc="start") => `<text x="${x}" y="${y}" text-anchor="${anc}" style="fill:var(--mute);font:600 13px var(--fc)">${t}</text>`;
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento del punteggio">${grid}
    ${target ? `<line x1="${L}" x2="${W-Rr}" y1="${Y(target)}" y2="${Y(target)}" style="stroke:var(--gold);stroke-dasharray:6 5;opacity:.8"/>` : ""}
    <path d="${path("h")}" style="fill:none;stroke:var(--home);stroke-width:2.6;stroke-linejoin:round"/>
    <path d="${path("a")}" style="fill:none;stroke:var(--away);stroke-width:2.6;stroke-linejoin:round"/>
    <g style="fill:var(--home)">${dots("h")}</g><g style="fill:var(--away)">${dots("a")}</g>
    ${lab(L-6, +Y(top)+4, Math.round(top), "end")}${lab(L-6, +Y(0)+4, 0, "end")}
    ${lab(L, H-6, fmtTime(t0))}${lab(W-Rr, H-6, fmtTime(t1), "end")}</svg>`;
  const dl = d => d ? `<span class="d">${d>0?"+":""}${d}</span>` : `<span class="d"></span>`;
  let rows = "";
  for(let j=pts.length-1; j>=1; j--){ const p = pts[j], q = pts[j-1];
    rows += `<tr><td>${fmtTime(p.t)}</td>${SDS().map(sd=>`<td>${p[sd]}${dl(p[sd]-q[sd])}</td>`).join("")}</tr>`; }
  return svg + `<table><thead><tr><th>Ora</th>${SDS().map(sd=>`<th class="${sd}">${esc(sideName(m,sd))}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
}
$("#trm").addEventListener("click", e=>{ if(e.target.id==="trm" || e.target.closest("[data-cl]")) closeTrend(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("#trm").hidden) closeTrend(); });
/* ---- torneo: finestra "Incontri del torneo" (testo: # turno, poi un incontro per riga) ---- */
let incArm = 0;
function serialInc(){
  let t = "", cur = null;
  S.matches.forEach(m=>{
    if(m.turno!==cur){ cur = m.turno; if(cur || t) t += (t ? "\n" : "") + "# " + cur + "\n"; }
    const nm = sd => namesOf(m, sd) || "?";
    t += nm("h") + " - " + nm("a") + (m.fr ? " | " + m.fr : m.formato ? " | " + m.formato : "") + "\n";
  });
  return t;
}
function openInc(){
  $("#ed-g").value = S.gioco; edForms = clone(S.formule); paintForms();
  $("#ed-x").value = serialInc(); $("#ed-m").textContent = ""; incArm = 0; paintIncBtn();
  $("#edm").hidden = false; setTimeout(()=>$("#ed-x").focus(), 50);
}
let edForms = [];
function paintForms(){ $("#ed-fs").innerHTML = edForms.map((f, i)=>fbHTML(f, i, true)).join(""); }
const readForms = strict => [...$("#ed-fs").querySelectorAll(".fb")].map(fb=>readFB(fb, strict));
function closeInc(){ $("#edm").hidden = true; incArm = 0; }
function paintIncBtn(){ const b = $('#edm [data-e="ok"]'); b.classList.toggle("arm", !!incArm); b.textContent = incArm ? "Conferma: applica" : "Applica"; }
function parseInc(txt, gioco, forms){
  const out = [], errs = []; let turno = "";
  const side = t=>{ t = (t||"").trim(); if(t==="?" || t==="-") t = "";
    const v = gioco==="Coppia" ? t.split("/").map(x=>x.trim()) : [t];
    return (gioco==="Coppia" ? [v[0]||"", v[1]||""] : v).map(x=>x==="?" ? "" : x); };
  txt.split(/\r?\n/).forEach((raw, n)=>{
    const l = raw.trim(); if(!l) return;
    if(l.startsWith("#")){ turno = l.replace(/^#+\s*/, ""); return; }
    const [body, ov] = l.split("|"); let o = null;
    if(ov!==undefined){ const f = ov.trim().replace(/\s+/g, " "), nf = findFormula({formule:forms}, f);
      if(nf) o = {fr:nf.nome};
      else { const pf = parseFormato(f);
        if(pf.err) errs.push(`Riga ${n+1}: "${f}" non è il nome di una formula (${forms.map(x=>x.nome).join(", ")}) e non si capisce come partita: ${pf.err}`);
        else o = {formato:f}; } }
    const parts = (" " + body.trim() + " ").split(/\s(?:-|–|vs\.?)\s/i);
    if(parts.length>2) errs.push(`Riga ${n+1}: più di due giocatori/coppie ("${l}"): separa i due avversari con un solo " - "`);
    out.push(Object.assign({turno, h:side(parts[0]), a:side(parts[1])}, o||{}));
  });
  return {out, errs};
}
function applyInc(){
  const g = $("#ed-g").value, rf = readForms(true), ferr = [];
  rf.forEach((x, i)=>x.errs.forEach(e=>ferr.push(`Formula "${x.f.nome || (i+1)}": ${e}`)));
  const forms = rf.map((x, i)=>normFormula(x.f, i));
  if(new Set(forms.map(f=>f.nome.toLowerCase())).size < forms.length) ferr.push("due formule hanno lo stesso nome");
  if(ferr.length){ $("#ed-m").textContent = ferr.slice(0,3).join(" · "); incArm = 0; paintIncBtn(); return; }
  const {out, errs} = parseInc($("#ed-x").value, g, forms);
  if(errs.length){ $("#ed-m").textContent = errs.slice(0,3).join(" · "); incArm = 0; paintIncBtn(); return; }
  const old = S.matches, used = new Set(), res = [];
  const key = m => [m.turno, ...m.h, ...m.a].map(x=>String(x||"").trim().toLowerCase()).join("|");
  const pos = (list, i) => list.slice(0, i).filter(x=>x.turno===list[i].turno).length;
  let next = S.nextId || 1;
  out.forEach((p, i)=>{
    let o = old.find(x=>!used.has(x.id) && key(x)===key(p));
    if(!o){ const k = pos(out, i); o = old.find((x, j)=>!used.has(x.id) && x.turno===p.turno && pos(old, j)===k); }
    if(o) used.add(o.id);
    res.push({id: o ? o.id : next++, turno:p.turno, kind:g, formato:p.formato||"", fr:p.fr||"", pts:1, h:p.h, a:p.a,
      ss: o ? o.ss.map(x=>x.slice()) : [], ch: o ? o.ch.slice() : []});
  });
  const lost = old.filter(x=>!used.has(x.id) && hasPts(x));
  if(lost.length && !incArm){
    incArm = Date.now(); paintIncBtn();
    $("#ed-m").textContent = `Attenzione: ${lost.length===1 ? "1 incontro con punteggio sparirebbe" : lost.length + " incontri con punteggio sparirebbero"} (${lost.map(x=>(namesOf(x,"h")||"?")+" - "+(namesOf(x,"a")||"?")).join(", ")}). Premi di nuovo per confermare.`;
    return;
  }
  snapshot();
  const actIds = (S.inCorso||[]).map(i=>old[i] && old[i].id);
  Object.assign(S, {gioco:g, formule:forms, formato:"", matches:res, nextId:next});
  S.inCorso = res.map((m, i)=>actIds.includes(m.id) ? i : -1).filter(i=>i>=0);
  S = normalize(S); closeInc(); commit(); setFlash("Incontri aggiornati: premi PUBBLICA per mostrarli al pubblico");
}
$("#edm").addEventListener("click", e=>{
  const b = e.target.closest("[data-e]"); if(e.target.id==="edm" || (b && b.dataset.e==="no")){ closeInc(); return; }
  if(b && b.dataset.e==="ok") applyInc();
  if(b && b.dataset.e==="addf"){ edForms = readForms(false).map(x=>x.f); edForms.push(normFormula({nome:"Finale", n:1, sets:[Object.assign({}, (edForms[0]||FB_NUOVA).sets[0])]}, edForms.length)); paintForms(); }
  if(b && b.dataset.e==="delf"){ edForms = readForms(false).map(x=>x.f); edForms.splice(+b.dataset.i, 1); paintForms(); }
});
$("#ed-x").addEventListener("input", ()=>{ if(incArm){ incArm = 0; paintIncBtn(); $("#ed-m").textContent = ""; } });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && !$("#edm").hidden) closeInc(); });
app.addEventListener("change", e=>{ const w = e.target.dataset && e.target.dataset.gw; if(!w || !editor || !S) return;
  const v = e.target.value;
  if(w==="data" && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ e.target.value = S.data || ""; return; }   /* la data non si può svuotare */
  if(w==="ora" && v && !okOra(v)) return;
  e.target.blur();   /* altrimenti, con la casella attiva, la pagina non si ridisegna */
  if((S[w]||"")!==v){ snapshot(); if(v) S[w] = v; else delete S[w]; commit(); }
});
app.addEventListener("change", e=>{ if(e.target.matches && e.target.matches("[data-pgsel]")){ tabPage = e.target.value; e.target.blur(); render(); } });
app.addEventListener("toggle", e=>{ if(e.target.classList && e.target.classList.contains("dn")) doneOpen = e.target.open; }, true);
/* ---- tabellone: finestra dell'incontro (vincitore, punteggio, segui in diretta) ---- */
let ndId = null, ndW = "", ndArm = 0;
function openNode(id){ ndId = id; ndW = (S.tab.res[id] || {}).w || ""; ndArm = 0; $("#ndm .bx").innerHTML = ""; paintNode(); $("#ndm").hidden = false; }
function closeNode(){ $("#ndm").hidden = true; ndId = null; }
function paintNode(){
  const TB = buildTab(S), nd = TB.nodes.get(ndId); if(!nd){ closeNode(); return; }
  const [h,a] = nd.sd, L = TB.live.get(ndId), rs = S.tab.res[ndId] || {}, lw = L && winner(L.m);
  const txtEl = $("#nd-t"), txt = txtEl ? txtEl.value : (rs.txt || "");
  const nm = x => x.tbd ? (x.lab || "da definire") : x.name;
  const off = x => x.tbd || x.abs ? " disabled" : "";
  $("#ndm .bx").innerHTML = `<h3>${esc(nd.turno)} · incontro ${nd.no}</h3>
    <div class="ndv"><span class="h">${esc(nm(h))}</span> – <span class="a">${esc(nm(a))}</span></div>
    ${L ? `<p class="hint">Seguito in diretta${lw ? ": il vincitore è deciso dai punteggi della scheda." : ": il vincitore passerà al turno dopo appena l'incontro finisce."}</p>` : ""}
    ${lw ? "" : `<div class="ndw"><span>Vincitore</span><button data-nw="h" class="${ndW==="h" ? "on" : ""}"${off(h)}>${esc(nm(h))}</button><button data-nw="a" class="${ndW==="a" ? "on" : ""}"${off(a)}>${esc(nm(a))}</button><button data-nw="" class="${!ndW ? "on" : ""}">Non ancora</button></div>
    <label>Punteggio (facoltativo)<input id="nd-t" value="${esc(txt)}" placeholder="es. 120–95 oppure 2–1" autocomplete="off"></label>`}
    <div class="ndl">${L ? `<button data-nd="go">Vai alla scheda</button><button data-nd="stop" class="${ndArm ? "arm" : ""}">${ndArm ? "Conferma: smetti di seguire" : "Smetti di seguire"}</button>`
      : `<label>Formula della partita<select id="nd-f">${S.formule.map((f,i)=>`<option value="${i}">${esc(f.nome)}</option>`).join("")}</select></label><button data-nd="follow">▶ Segui in diretta</button>`}</div>
    <p class="err" id="nd-m"></p>
    <div class="btns"><button class="ghost" data-nd="no">${lw ? "Chiudi" : "Annulla"}</button>${lw ? "" : `<button data-nd="ok">Salva</button>`}</div>`;
}
$("#ndm").addEventListener("click", e=>{
  if(e.target.id==="ndm"){ closeNode(); return; }
  const w = e.target.closest("[data-nw]"); if(w){ ndW = w.dataset.nw; paintNode(); return; }
  const b = e.target.closest("[data-nd]"); if(!b) return; const k = b.dataset.nd;
  const L = buildTab(S).live.get(ndId);
  if(k==="no"){ closeNode(); return; }
  if(k==="ok"){ const txt = ($("#nd-t") ? $("#nd-t").value : "").trim(); snapshot();
    if(!ndW && !txt) delete S.tab.res[ndId]; else S.tab.res[ndId] = {w:ndW, txt};
    S = normalize(S); closeNode(); commit(); return; }
  if(k==="follow"){ const fi = +($("#nd-f") || {}).value || 0; snapshot();
    if(S.tab.res[ndId]){ if(S.tab.res[ndId].txt) S.tab.res[ndId].w = ""; else delete S.tab.res[ndId]; }
    S.matches.push({id:S.nextId++, tid:ndId, fr:fi>0 ? S.formule[fi].nome : ""});
    S = normalize(S); const i = S.matches.length - 1; closeNode(); commit(); setTimeout(()=>goCard(i), 60); return; }
  if(k==="go" && L){ closeNode(); goCard(L.i); return; }
  if(k==="stop" && L){
    if(hasPts(L.m) && !ndArm){ ndArm = 1; paintNode(); $("#nd-m").textContent = "L'incontro ha già dei punti: premi di nuovo per toglierlo dalla diretta (i punti si perdono)."; return; }
    snapshot(); const rid = L.m.id, act = (S.inCorso||[]).map(i=>S.matches[i] && S.matches[i].id);
    S.matches = S.matches.filter(x=>x.id!==rid); S.inCorso = S.matches.map((x,i)=>act.includes(x.id) ? i : -1).filter(i=>i>=0);
    S = normalize(S); closeNode(); commit(); }
});
/* ---- tabellone: finestra "Batterie e finali" ---- */
let tbForms = [];
const serialBat = T => T.bat.map(b=>"# " + b.nome + "\n" + b.p.map(x=>x || "?").join("\n")).join("\n") + "\n";
const serialFin = F => (F.acqua.length ? "# Partite dell'acqua\n" + F.acqua.map(x=>x.join(" - ")).join("\n") + "\n" : "") + "# Tabellone finale\n" + F.main.map(x=>x.join(" - ")).join("\n") + "\n";
function parseBat(txt){
  const out = [], errs = []; let cur = null;
  txt.split(/\r?\n/).forEach((raw, n)=>{
    const l = raw.trim(); if(!l) return;
    if(l.startsWith("#")){ cur = {nome:l.replace(/^#+\s*/, "") || "Batteria " + (out.length+1), p:[]}; out.push(cur); return; }
    if(!cur){ cur = {nome:"Batteria 1", p:[]}; out.push(cur); }
    if(cur.p.length>=8){ errs.push(`${cur.nome}: più di 8 iscritti (riga ${n+1})`); return; }
    cur.p.push(l==="?" ? "" : ASSENTE.test(l) ? "assente" : l.replace(/\s+/g, " "));
  });
  out.forEach(b=>{ while(b.p.length<8) b.p.push(""); });
  if(!out.length) errs.push("Batterie: scrivi almeno una riga # Batteria 1");
  return {out, errs};
}
function parseFin(txt, nb){
  const F = {acqua:[], main:[]}, errs = []; let sec = "main";
  if(nb<2) return {F, errs};
  txt.split(/\r?\n/).forEach((raw, n)=>{
    const l = raw.trim(); if(!l) return;
    if(l.startsWith("#")){ sec = /acqua/i.test(l) ? "acqua" : "main"; return; }
    const p = l.split(/\s*(?:-|–|vs\.?)\s*/i).map(x=>x.trim().toUpperCase());
    if(p.length!==2 || !p.every(x=>/^[AB]\d+$/.test(x))){ errs.push(`Finali, riga ${n+1}: scrivi due riferimenti, es. B1 - B2 oppure A1 - B9`); return; }
    F[sec].push(p);
  });
  const used = {}; [...F.acqua.flat(), ...F.main.flat()].forEach(x=>used[x] = (used[x]||0) + 1);
  for(let b=1; b<=nb; b++) if(used["B"+b]!==1) errs.push(`B${b} ${used["B"+b] ? "compare più volte" : "manca"} nelle finali`);
  Object.keys(used).forEach(x=>{ const j = +x.slice(1);
    if(x[0]==="B" && j>nb) errs.push(`${x}: ci sono solo ${nb} batterie`);
    if(x[0]==="A"){ if(j<1 || j>F.acqua.length) errs.push(`${x}: non c'è la ${j}ª partita dell'acqua`);
      else if(F.acqua.flat().includes(x)) errs.push(`${x} non può stare nelle partite dell'acqua`); else if(used[x]>1) errs.push(`${x} compare più volte`); } });
  for(let j=1; j<=F.acqua.length; j++) if(!used["A"+j]) errs.push(`A${j} (vincitore della ${j}ª partita dell'acqua) manca nel tabellone finale`);
  const m = F.main.length;
  if(!m) errs.push("Finali: il tabellone finale è vuoto"); else if(m & (m-1)) errs.push(`Il tabellone finale ha ${m} incontri: devono essere 1, 2, 4, 8 o 16`);
  return {F, errs};
}
function openTbe(){
  $("#tb-g").value = S.gioco; tbForms = clone(S.formule); paintTbForms();
  $("#tb-x").value = serialBat(S.tab); $("#tb-y").value = S.tab.bat.length>1 ? serialFin(S.tab.fin) : "";
  $("#tb-m").textContent = ""; $("#tbm").hidden = false;
}
function paintTbForms(){ $("#tb-fs").innerHTML = tbForms.map((f,i)=>fbHTML(f, i, true)).join(""); }
const readTbForms = strict => [...$("#tb-fs").querySelectorAll(".fb")].map(fb=>readFB(fb, strict));
function applyTbe(){
  const g = $("#tb-g").value, rf = readTbForms(true), errs = [];
  rf.forEach((x,i)=>x.errs.forEach(er=>errs.push(`Formula "${x.f.nome || (i+1)}": ${er}`)));
  const forms = rf.map((x,i)=>normFormula(x.f, i));
  if(new Set(forms.map(f=>f.nome.toLowerCase())).size < forms.length) errs.push("due formule hanno lo stesso nome");
  const pb = parseBat($("#tb-x").value); errs.push(...pb.errs);
  const nb = pb.out.length; let pf = parseFin($("#tb-y").value, nb), note = "";
  if(pf.errs.length && nb!==S.tab.bat.length){ pf = {F:finDefault(nb), errs:[]}; note = " Le finali sono state rigenerate con l'ordine proposto: controllale col sorteggio."; }
  errs.push(...pf.errs);
  if(errs.length){ $("#tb-m").textContent = errs.slice(0,4).join(" · "); return; }
  snapshot();
  Object.assign(S, {gioco:g, formule:forms}); S.tab.bat = pb.out; S.tab.fin = pf.F;
  S.matches.forEach(m=>{ if(m.fr && !forms.some(f=>f.nome.toLowerCase()===m.fr.toLowerCase())) m.fr = ""; });
  S = normalize(S); $("#tbm").hidden = true; commit(); setFlash("Batterie e finali aggiornate: premi PUBBLICA." + note);
}
$("#tbm").addEventListener("click", e=>{
  if(e.target.id==="tbm"){ $("#tbm").hidden = true; return; }
  const b = e.target.closest("[data-t],[data-e]"); if(!b) return;
  const k = b.dataset.t || b.dataset.e;
  if(k==="no"){ $("#tbm").hidden = true; return; }
  if(k==="ok"){ applyTbe(); return; }
  if(k==="regen"){ $("#tb-y").value = serialFin(finDefault(parseBat($("#tb-x").value).out.length)); return; }
  if(k==="addf"){ tbForms = readTbForms(false).map(x=>x.f); tbForms.push(normFormula({nome:"Finale", n:1, sets:[Object.assign({}, (tbForms[0] || FB_NUOVA).sets[0])]}, tbForms.length)); paintTbForms(); return; }
  if(k==="delf"){ tbForms = readTbForms(false).map(x=>x.f); tbForms.splice(+b.dataset.i, 1); paintTbForms(); }
});
document.addEventListener("keydown", e=>{ if(e.key!=="Escape") return; if(!$("#ndm").hidden) closeNode(); if(!$("#tbm").hidden) $("#tbm").hidden = true; });
function toggleAct(i){ snapshot(); const a = new Set(S.inCorso||[]); a.has(i) ? a.delete(i) : a.add(i); S.inCorso = [...a].sort(); commit(); }
app.addEventListener("click", e=>{
  if(e.target.id==="logout"){ signOut(); return; }
  if(e.target.closest("[data-campo]")){ e.preventDefault(); if(editor && S && !isTorneo()){ snapshot(); S.trasferta = !S.trasferta; commit(); } return; }
  const dp = e.target.closest("[data-dup]"); if(dp){ e.preventDefault(); if(mode==="regiahome") dupGara(dp.dataset.dup); return; }
  const dl = e.target.closest("[data-del]"); if(dl){ e.preventDefault(); if(mode==="regiahome" && !dl.disabled) delGara(dl.dataset.del); return; }
  const tb = e.target.closest("[data-tr]"); if(tb){ openTrend(+tb.dataset.tr); return; }
  const pgb = e.target.closest("[data-pg]"); if(pgb && mode==="board"){ tabPage = pgb.dataset.pg; render(); return; }
  const pgs = e.target.closest("[data-pgs]"); if(pgs && mode==="board"){ const ks = buildTab(S).pages.map(p=>p.key), j = ks.indexOf(tabPage) + +pgs.dataset.pgs; if(j>=0 && j<ks.length){ tabPage = ks[j]; render(); } return; }
  const nde = e.target.closest("[data-node]");
  if(nde && mode==="board" && isTab()){ if(editor) openNode(nde.dataset.node); else { const L = buildTab(S).live.get(nde.dataset.node); if(L) goCard(L.i); } return; }
  if(!editor || mode!=="board") return;
  if(e.target.closest("[data-inc]")){ openInc(); return; }
  if(e.target.closest("[data-tbe]")){ openTbe(); return; }
  const bo = e.target.closest("[data-bo]");
  if(bo){ const [i,k] = bo.dataset.bo.split(".").map(Number), m = S.matches[i], d = m.defs[k]; snapshot();
    m.ch[k] = (m.ch[k] + 2) % (d.opts.length + 1) - 1; S = normalize(S); commit(); return; }
  const a = e.target.closest("[data-act]"), o = e.target.closest("[data-opt]"), el = e.target.closest("[contenteditable]");
  if(a){ toggleAct(+a.dataset.act); return; }
  if(o){ const m = S.matches[+o.dataset.opt]; snapshot(); m.opt = (m.opt+1) % m.opts.length; m.spec = m.opts[m.opt].spec; m.target = m.opts[m.opt].target; commit(); return; }
  if(e.target.closest("img[data-logo]")){ $("#logofile").click(); return; }
  if(el && wasFocused!==el){ const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
});
/* nuova gara: campi diversi per squadre e tornei */
app.addEventListener("change", e=>{
  if(e.target.id!=="ng-f") return;
  const F = FORMULE[e.target.value], tor = !!F.torneo, tab = !!F.tab, sg = !!F.singole;
  app.querySelectorAll("[data-fs]").forEach(g=>{ const on = g.dataset.fs==="to" ? tor : g.dataset.fs==="tb" ? tab : g.dataset.fs==="sg" ? sg : !tor; g.hidden = !on;
    g.querySelectorAll(":scope > input, :scope > select, :scope > label > input, :scope > .fb input, :scope > .fb select, :scope > .sgp input").forEach(x=>x.disabled = !on); });
  const tl = $("#ng-tl"), t = $("#ng-t"); if(tl) tl.textContent = sg ? "Evento" : "Nome del torneo"; if(t) t.placeholder = sg ? "es. Gran Premio di Modena" : "es. 1° Memorial Luca Tamburini";
  const fa = $("#ng-fa"); if(fa) fa.placeholder = sg ? "es. Quarti di finale (facoltativo)" : "es. Batteria 1 (facoltativo)";
  const vs = $("#ng-vis"); if(vs) vs.value = sg ? "link" : "pub";
  ngCoppia();
});
/* partite singole: il compagno compare solo per le coppie */
function ngCoppia(){ const cp = ($("#ng-gi") || {}).value==="Coppia", sg = !!(FORMULE[($("#ng-f") || {}).value] || {}).singole;
  app.querySelectorAll(".sgp .cp").forEach(x=>{ x.hidden = !cp; x.disabled = !(cp && sg); }); }
app.addEventListener("change", e=>{ if(e.target.id==="ng-gi") ngCoppia(); });
app.addEventListener("dblclick", e=>{ if(editor && e.target.closest("[data-logo]")){ getSelection().removeAllRanges(); $("#logofile").click(); } });
app.addEventListener("submit", async e=>{
  e.preventDefault();
  const ae = document.activeElement; if(ae && ae.blur) ae.blur();
  if(e.target.id==="login"){
    lastEmail = $("#em").value.trim();
    const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Accesso…";
    try{ flash = ""; await signIn(lastEmail, $("#pw").value); location.reload(); }
    catch(err){
      const c = String(err.code||"");
      flash = /INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(c) ? "Email o password non corrette"
            : /TOO_MANY/.test(c) ? "Troppi tentativi: aspetta qualche minuto e riprova"
            : /USER_DISABLED/.test(c) ? "Questo utente è disattivato in Firebase"
            : c==="rete" ? "Nessuna risposta da Firebase: controlla la connessione"
            : "Accesso non riuscito (" + c + ")";
      mode = "login"; render();
    }
  }
  if(e.target.id==="newgara"){
    const o = {formula:$("#ng-f").value, data:$("#ng-d").value, ora:okOra($("#ng-ora").value) ? $("#ng-ora").value : "", giornata:$("#ng-g").value.trim(), luogo:$("#ng-l").value.trim(), ospite:$("#ng-o").value.trim(), citta:$("#ng-c").value.trim(), trasferta:$("#ng-cp").value==="trasferta"};
    const tor = !!FORMULE[o.formula].torneo;
    if(tor){ const rd = readFB(e.target.querySelector(".fb"), true);
      if(rd.errs.length){ $("#ng-msg").textContent = "Partita: " + rd.errs.join(" · "); return; }
      $("#ng-msg").textContent = "";
      Object.assign(o, {titolo:$("#ng-t").value.trim(), fase:$("#ng-fa").value.trim(), gioco:$("#ng-gi").value, formule:[rd.f]});
      if(FORMULE[o.formula].tab) o.nbat = Math.max(1, Math.min(32, Math.round(+$("#ng-nb").value) || 4)); }
    const sg = !!FORMULE[o.formula].singole, val = x => ($(x) && !$(x).disabled ? $(x).value.trim() : "");
    const H = [val("#ng-h1"), val("#ng-h2")].slice(0, o.gioco==="Coppia" ? 2 : 1), A = [val("#ng-a1"), val("#ng-a2")].slice(0, o.gioco==="Coppia" ? 2 : 1);
    const id = sg ? ["partita", o.data, slug(o.titolo).slice(0, 20).replace(/-$/, ""), slug(H[0] && A[0] ? H[0] + " " + A[0] : o.fase).slice(0, 24).replace(/-$/, ""), Date.now().toString(36).slice(-4)].filter(Boolean).join("-")   /* max ~75 caratteri */
             : tor ? ["torneo", o.data, slug(o.titolo), slug(o.fase)].filter(Boolean).join("-") : [o.formula, o.data, slug(o.ospite)].filter(Boolean).join("-");
    if(INDEX && INDEX[id]){ location.search = "?regia&gara=" + id; return; }
    if(tor && dupSrc && dupSrc.formula===o.formula && dupSrc.formule) o.formule = [o.formule[0], ...dupSrc.formule.slice(1).filter(x=>x.nome.toLowerCase()!==o.formule[0].nome.toLowerCase())];
    const st = newState(o); st.vis = ($("#ng-vis") || {}).value || "pub"; if(st.vis==="pub") delete st.vis;
    if(sg && (H.some(Boolean) || A.some(Boolean))){ st.matches = [{id:1, turno:o.fase || "", h:H, a:A}]; st.nextId = 2; Object.assign(st, normalize(st)); }
    if(dupSrc && !tor && (FORMULE[dupSrc.formula] || {}).nome===FORMULE[o.formula].nome){   /* duplicata: stessi titolo e squadra di casa; logo ospite se è la stessa squadra */
      st.title = dupSrc.title || st.title; st.home = clone(dupSrc.home);
      if(dupSrc.away && dupSrc.away.name.trim().toLowerCase()===o.ospite.toLowerCase()){ st.away.badge = dupSrc.away.badge || st.away.badge; if(dupSrc.away.logo) st.away.logo = dupSrc.away.logo; }
    }
    const sqk = tor ? "" : findSq(o.ospite, campOf(o.formula));   /* squadra dell'anagrafica: codice, logo (della squadra o del suo circolo) e città del circolo */
    if(sqk){ st.away.sq = sqk; const lg = sqLogoSrc(sqk); if(lg) st.away.logo = lg; if(!st.away.city) st.away.city = sqCitta(sqk); }
    const hk = tor ? "" : ($("#ng-ns") || {}).value;   /* la nostra squadra: nome della squadra (può essere diverso da quello del circolo) */
    if(hk && SQUADRE && SQUADRE[hk]){ const nm = SQUADRE[hk].nome; st.home = {name:nm, short:low(nm)===low(CLUB.name) ? CLUB.short : nm, city:sqCitta(hk) || CLUB.city, sq:hk}; }
    try{ await dbWrite({["gare/"+id]: st, ["indice/"+id]: metaOf(st)}); location.search = "?regia&gara=" + id; }
    catch(err){ $("#ng-msg").textContent = err.code==="PERMISSION_DENIED" ? "Firebase rifiuta la scrittura: controlla le regole del database e l'utente di regia (UID)" : "Non riesco a creare la gara (" + (err.code||err.message) + ")"; }
  }
});
$("#logofile").addEventListener("change", ()=>{
  const inp = $("#logofile"), f = inp.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = () => { const im = new Image();
    im.onload = () => { const M = 160, k = Math.min(1, M/Math.max(im.width||M, im.height||M));
      const c = document.createElement("canvas"); c.width = Math.round((im.width||M)*k); c.height = Math.round((im.height||M)*k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      snapshot(); S.away.logo = c.toDataURL("image/png"); inp.value = ""; commit();
      if(S.away.sq) dbWrite({["squadre/" + S.away.sq + "/logo"]: S.away.logo}).catch(()=>{}); };   /* il logo resta anche per le gare future */
    im.src = rd.result; };
  rd.readAsDataURL(f);
});
