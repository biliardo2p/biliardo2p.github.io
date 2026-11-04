/* Tabellone Live · controllo-nomi.js — Controllo nomi: collegamento all'anagrafica dei nomi delle gare
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= controllo nomi: collega all'anagrafica i nomi scritti nelle gare =================
   Squadre: scrive i codici (matches/<i>/hc|ac). Tornei: sostituisce il testo con il nome dell'elenco (batterie o incontri). */
let CK = null, ckBusy = false, ckMsg = "", ckErr = false, ckOpen = {}, ckSel = {}, ckAutoOpen = false;
async function ckLoad(){
  ckBusy = true; if(mode==="anag" && anTab==="c") render();
  try{ CK = (await db.ref("gare").once("value")).val() || {}; }
  catch(e){ CK = null; ckMsg = "Non riesco a leggere le gare: controlla la connessione"; ckErr = true; }
  ckBusy = false; if(mode==="anag" && anTab==="c") render();
}
function scanNames(gare){
  const out = [];
  Object.entries(gare||{}).forEach(([gid, raw])=>{
    let st; try{ st = normalize(clone(raw)); }catch(e){ return; } if(!st) return;
    const y = stagione(st.data), glab = [fmtDate(st.data), st.title, st.subtitle].filter(Boolean).join(" · ");
    if(!isTorneo(st)){
      const asq = st.away.sq || findSq(st.away.name);
      st.matches.forEach((m,i)=>["h","a"].forEach(sd=>m[sd].forEach((t,j)=>{ t = String(t||"").trim(); if(!t) return;
        const c = (m[sd + "c"] || [])[j] || "";
        out.push({gid, glab, tor:false, i, sd, j, t, c:c && ANAG[c] ? c : "", sq:sd==="h" ? CLUBSQ : asq, tn:sd==="h" ? CLUB.name : st.away.name, y, mlab:`${i+1} · ${m.kind} ${m.spec || ""}`.trim()}); })));
    } else if(isTab(st)){
      st.tab.bat.forEach((bt,b)=>bt.p.forEach((t,k)=>String(t||"").split("/").forEach((n,q)=>{ n = n.trim(); if(!n || n==="?" || ASSENTE.test(n)) return;
        out.push({gid, glab, tor:true, b, k, q, t:n, c:"", sq:"", y, mlab:bt.nome}); })));
    } else {
      st.matches.forEach((m,i)=>["h","a"].forEach(sd=>m[sd].forEach((t,j)=>{ t = String(t||"").trim(); if(!t || t==="?") return;
        out.push({gid, glab, tor:true, i, sd, j, t, c:"", sq:"", y, mlab:m.turno || "incontro " + (i+1)}); })));
    }
  });
  out.forEach(o=>{ o.auto = o.c ? "" : resolveName(o.t, o.sq, o.y); });
  return out;
}
function lev(a, b){ const d = Array.from({length:b.length + 1}, (_,j)=>j);
  for(let i=1; i<=a.length; i++){ let p = d[0]; d[0] = i; for(let j=1; j<=b.length; j++){ const t = d[j]; d[j] = Math.min(d[j] + 1, d[j-1] + 1, p + (a[i-1]===b[j-1] ? 0 : 1)); p = t; } }
  return d[b.length]; }
/* giocatori proposti per un gruppo: prima quelli con il nome uguale o simile, poi la squadra, poi tutti */
function ckCands(g){
  const key = nkey(g.t), first = key.split("-")[0], y = g.y;
  const all = Object.entries(ANAG).map(([k,p])=>{ const cg = nkey(p.cognome), r = rowAt(p, y);
    const keys = [tabName(p), p.cognome, p.nome && p.cognome + " " + p.nome, p.sopr].filter(Boolean).map(nkey);
    const sc = keys.includes(key) ? 0 : cg===first ? 1 : Math.min(...keys.map(x=>lev(x, key)), lev(cg, first))<=2 ? 2 : g.sq && r.sq===g.sq ? 3 : 4;
    return {k, p, r, sc}; });
  return all.sort((a,b)=>a.sc - b.sc || String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||"")));
}
function ckGroups(occ){
  const G = new Map();
  occ.filter(o=>!o.c && !o.auto).forEach(o=>{ const id = nkey(o.t) + "|" + (o.tor ? "T" : o.sq || "?" + slug(o.tn));
    if(!G.has(id)) G.set(id, {id, t:o.t, tor:o.tor, sq:o.sq, tn:o.tn, y:o.y, occ:[]}); G.get(id).occ.push(o); });
  return [...G.values()].sort((a,b)=>a.tor - b.tor || String(a.t).localeCompare(String(b.t)));
}
function ckHTML(){
  let h = `<section class="panel"><h2>Controllo nomi</h2>
    <p class="hint">Collega all'elenco giocatori i nomi scritti nelle gare. Nei campionati a squadre si salva il codice del giocatore (il testo resta);
    nei tornei il nome viene riscritto come nell'elenco. Punteggi e risultati non si toccano. Prima di cominciare conviene scaricare una copia di sicurezza.</p>
    <div class="anf"><button class="ghost" data-ckbk>⬇ Copia di sicurezza</button><button class="ghost" data-ckre${ckBusy ? " disabled" : ""}>${ckBusy ? "Lettura delle gare…" : "↻ Rileggi le gare"}</button></div>
    ${ckMsg ? `<p class="${ckErr ? "err" : "hint ok"}">${esc(ckMsg)}</p>` : ""}</section>`;
  if(!CK) return h + (ckBusy ? `<p class="empty">Lettura delle gare…</p>` : "");
  const occ = scanNames(CK), sq = occ.filter(o=>!o.tor), ok = sq.filter(o=>o.c).length, au = occ.filter(o=>!o.tor && o.auto), tok = occ.filter(o=>o.tor && o.auto).length, G = ckGroups(occ);
  h += `<div class="ckst"><span><b>${ok}</b> collegati</span><span><b>${au.length}</b> riconosciuti, da confermare</span><span><b>${tok}</b> nei tornei, riconosciuti</span><span class="${G.length ? "w" : ""}"><b>${G.length}</b> da sistemare</span></div>`;
  if(au.length){
    const by = new Map(); au.forEach(o=>{ const id = o.t + "→" + o.auto; if(!by.has(id)) by.set(id, {t:o.t, k:o.auto, n:0}); by.get(id).n++; });
    h += `<section class="panel"><h2>Riconosciuti automaticamente</h2><p class="hint">Nomi delle gare a squadre che corrispondono a un solo giocatore dell'elenco: confermando, il collegamento diventa definitivo.</p>
      <details${ckAutoOpen ? " open" : ""} data-ckao><summary>${by.size} ${by.size===1 ? "nome" : "nomi"} in ${au.length} ${au.length===1 ? "casella" : "caselle"}</summary><div class="ckl">` +
      [...by.values()].map(x=>`<div>“${esc(x.t)}” → <b>${esc(tabName(ANAG[x.k]))}</b> <span>${esc([ANAG[x.k].nome, ANAG[x.k].cognome].filter(Boolean).join(" "))} · ${x.n}×</span></div>`).join("") +
      `</div></details><button data-ckall>Conferma tutti (${au.length})</button></section>`;
  }
  if(!G.length) return h + `<p class="empty">${occ.length ? "Tutti i nomi delle gare sono collegati all'elenco. 👍" : "Nelle gare non ci sono ancora nomi di giocatori."}</p>`;
  h += `<h3 class="ang">Da sistemare <span>${G.length}</span></h3><div class="ckg">` + G.map(g=>{
    const cs = ckCands(g), sel = ckSel[g.id] ?? (cs[0] && cs[0].sc<=2 && !(cs[1] && cs[1].sc===cs[0].sc) ? cs[0].k : "");
    const opt = (x) => `<option value="${esc(x.k)}"${x.k===sel ? " selected" : ""}>${esc(tabName(x.p))}${x.r.cat ? " (" + esc(x.r.cat) + ")" : ""} · ${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))} · ${esc(sqName(x.r.sq))}</option>`;
    const near = cs.filter(x=>x.sc<=2), team = cs.filter(x=>x.sc===3), rest = cs.filter(x=>x.sc===4);
    const gl = [...new Set(g.occ.map(o=>o.gid))].length;
    return `<div class="ckc"><div class="ckh"><b>${esc(g.t)}</b><span>${g.tor ? "torneo" : esc(g.sq ? sqName(g.sq) : (g.tn || "avversario") + " (squadra non in elenco)")} · ${g.occ.length} ${g.occ.length===1 ? "volta" : "volte"} in ${gl} ${gl===1 ? "gara" : "gare"}${near.length>1 && near[0].sc===0 ? " · <em>nome ambiguo</em>" : ""}</span></div>
      <details${ckOpen[g.id] ? " open" : ""} data-cko="${esc(g.id)}"><summary>Dove compare</summary><div class="ckl">${g.occ.map(o=>`<div>${esc(o.glab)} <span>· ${esc(o.mlab)}</span></div>`).join("")}</div></details>
      <div class="ckr"><select data-cks="${esc(g.id)}"><option value="">— scegli il giocatore —</option>
        ${near.length ? `<optgroup label="Nome uguale o simile">${near.map(opt).join("")}</optgroup>` : ""}${team.length ? `<optgroup label="${esc(sqName(g.sq))}">${team.map(opt).join("")}</optgroup>` : ""}${rest.length ? `<optgroup label="Altri giocatori">${rest.map(opt).join("")}</optgroup>` : ""}</select>
      <button data-ckl="${esc(g.id)}"${sel ? "" : " disabled"}>Collega</button><button class="ghost" data-ckn="${esc(g.id)}">+ Nuovo giocatore</button></div></div>`;
  }).join("") + `</div>`;
  return h;
}
/* scritture: si riscrivono interi gli array toccati, per non lasciare buchi */
function ckWrites(list){   /* list: [{o, k}] */
  const W = {}, raw = CK, cache = {};
  const get = (gid, path, mk) => { const id = gid + "/" + path; if(!(id in cache)) cache[id] = mk(); return cache[id]; };
  list.forEach(({o, k})=>{
    const st = normalize(clone(raw[o.gid])), p = ANAG[k];
    if(!o.tor){ const a = get(o.gid, `matches/${o.i}/${o.sd}c`, ()=>st.matches[o.i][o.sd].map((_,j)=>(st.matches[o.i][o.sd + "c"] || [])[j] || "")); a[o.j] = k; }
    else if(o.b!=null){ const a = get(o.gid, `tab/bat/${o.b}/p`, ()=>st.tab.bat[o.b].p.slice());
      const parts = a[o.k].split("/").map(x=>x.trim()); parts[o.q] = tabName(p); a[o.k] = parts.join(" / "); }
    else { const a = get(o.gid, `matches/${o.i}/${o.sd}`, ()=>st.matches[o.i][o.sd].slice()); a[o.j] = tabName(p); }
  });
  Object.entries(cache).forEach(([id, v])=>{ W["gare/" + id] = v; });
  return W;
}
async function ckApply(list, msg){
  if(!list.length) return;
  try{ await dbWrite(ckWrites(list)); ckMsg = msg; ckErr = false; }
  catch(err){ ckMsg = wErr(err); ckErr = true; }
  await ckLoad();
}
function ckBackup(){
  const data = {creato:new Date().toISOString(), gare:CK, giocatori:ANAG, squadre:SQUADRE};
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type:"application/json"}));
  a.download = "biliardo2p-copia-" + today() + ".json"; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  ckMsg = "Copia di sicurezza scaricata: conservala finché non hai finito i collegamenti."; ckErr = false; render();
}
app.addEventListener("click", e=>{
  if(mode!=="anag" || anTab!=="c") return; const t = e.target;
  if(t.closest("[data-ckre]")){ ckMsg = ""; ckLoad(); return; }
  if(t.closest("[data-ckbk]")){ if(CK) ckBackup(); return; }
  if(t.closest("[data-ckall]")){ const au = scanNames(CK).filter(o=>!o.tor && o.auto); t.closest("button").disabled = true;
    ckApply(au.map(o=>({o, k:o.auto})), `Confermati ${au.length} collegamenti.`); return; }
  const l = t.closest("[data-ckl]"); if(l){ const g = ckGroups(scanNames(CK)).find(x=>x.id===l.dataset.ckl), k = $(`[data-cks="${CSS.escape(l.dataset.ckl)}"]`).value;
    if(!g || !k) return; l.disabled = true; delete ckSel[g.id];
    ckApply(g.occ.map(o=>({o, k})), `“${g.t}” collegato a ${tabName(ANAG[k])} in ${g.occ.length} ${g.occ.length===1 ? "casella" : "caselle"}.`); return; }
  const n = t.closest("[data-ckn]"); if(n){ const g = ckGroups(scanNames(CK)).find(x=>x.id===n.dataset.ckn); if(!g) return;
    const parts = g.t.split(" "), cog = parts.shift(), rest = parts.join(" ").trim();
    openPlayer(null, {cognome:cog, nome:/^[^\s.]\.?$/.test(rest) ? "" : rest, sq:g.sq || (g.tor ? CLUBSQ : (sqSorted().find(([k])=>!isClub(k)) || [CLUBSQ])[0]), y:g.y, ck:g.id}); }
});
app.addEventListener("change", e=>{ if(mode==="anag" && e.target.dataset && e.target.dataset.cks!=null){ ckSel[e.target.dataset.cks] = e.target.value;
  const b = $(`[data-ckl="${CSS.escape(e.target.dataset.cks)}"]`); if(b) b.disabled = !e.target.value; } });
app.addEventListener("toggle", e=>{ const d = e.target; if(!d.dataset) return; if(d.dataset.cko!=null) ckOpen[d.dataset.cko] = d.open; if(d.dataset.ckao!=null) ckAutoOpen = d.open; }, true);

