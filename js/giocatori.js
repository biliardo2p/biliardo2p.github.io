/* Tabellone Live · giocatori.js — Pagine pubbliche dei giocatori e statistiche
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= pagine pubbliche dei giocatori (?giocatori, ?giocatore=<codice>) =================
   Le statistiche si calcolano ogni volta dalle gare salvate: correggere una gara aggiorna subito anche le statistiche. */
const PCODE = (P.get("giocatore")||"").replace(/[^a-z0-9-]/gi,"").toLowerCase();
let ALLG = null, allgErr = false, gSt = "", gsSt = null, gsQ = "";
function loadAllGare(){ db.ref("gare").once("value").then(s=>{ ALLG = s.val() || {}; render(); }, ()=>{ allgErr = true; render(); }); }
const plink = (k, txt) => k && !editor ? `<a class="pl" href="?giocatore=${esc(k)}">${txt}</a>` : txt;
/* tutte le partite di tutti i giocatori riconosciuti */
let mxCache = null, mxOf = null, mxAnag = null;
function allMatches(){
  if(mxCache && mxOf===ALLG && mxAnag===ANAG) return mxCache;
  const out = []; mxOf = ALLG; mxAnag = ANAG;
  Object.entries(ALLG||{}).forEach(([gid, raw])=>{
    if(!raw || visOf(raw)==="prova" || raw.nostat) return;   /* gare di prova e gare escluse: non contano */
    let st; try{ st = normalize(clone(raw)); }catch(e){ return; } if(!st) return;
    const y = stagione(st.data), tor = isTorneo(st), base = {gid, data:st.data||"", y, tit:st.title||"", sub:st.subtitle||"", stato:st.stato};
    const who = (t, sq, c) => { t = String(t||"").trim(); const k = c && ANAG[c] ? c : resolveName(t, sq, y); return {t: k ? tabName(ANAG[k]) : t, k}; };
    const sqOf = sd => tor ? "" : sd==="h" ? CLUBSQ : (st.away.sq || findSq(st.away.name));
    st.matches.forEach((m,i)=>{
      const w = winner(m); if(!w && !hasPts(m)) return;
      const multi = m.defs && m.defs.length>1;
      const spec = m.defs ? (multi ? [...new Set(m.defs.map(d=>d.spec || "a scelta"))].join(" / ") + ` (${m.defs.length} set)` : (m.defs[0].spec || "") + (m.defs[0].target ? " a " + m.defs[0].target : "")) : (m.spec || "") + (m.target ? " a " + m.target : "");
      const side = sd => m[sd].map((t,j)=>who(t, sqOf(sd), (m[sd + "c"]||[])[j])).filter(x=>x.t);
      const H = side("h"), A = side("a");
      ["h","a"].forEach(sd=>{ const me = sd==="h" ? H : A, op = sd==="h" ? A : H, ix = sd==="h" ? 0 : 1;
        me.forEach((x,j)=>{ if(!x.k) return;
          const e = Object.assign({}, base, {k:x.k, i, kind:tor ? st.gioco : m.kind, spec, lab:tor ? (m.turno || "") : `Incontro ${i+1}`,
            mate:me.filter((_,q)=>q!==j), opp:op, res:w ? (w===sd ? "V" : "P") : "",
            score: multi ? `set ${m.sw[ix]}–${m.sw[1-ix]}` : `${m.s[ix]}–${m.s[1-ix]}`,
            team:tor ? "" : (sd==="h" ? CLUB.short || CLUB.name : st.away.name), vs:tor ? "" : (sd==="h" ? st.away.name : CLUB.short || CLUB.name)});
          if(m.kind==="Staffetta" && !tor){ const pts = (sd==="h" ? m.ph : m.pa) || []; e.extra = `${j+1}ª frazione · ${+pts[j]||0} punti`; e.mate = []; }
          out.push(e); }); });
    });
    if(isTab(st)){   /* incontri del tabellone segnati a mano, senza diretta */
      const TB = buildTab(st), f0 = st.formule[0] || {sets:[]}, fs = f0.sets.slice(0, f0.n || 1);
      const fspec = fs.length>1 ? [...new Set(fs.map(x=>x.scelta ? "a scelta" : x.spec))].join(" / ") + ` (${fs.length} set)` : fs[0] && !fs[0].scelta ? `${fs[0].spec} a ${fs[0].target}` : "";
      TB.nodes.forEach((nd, id)=>{ if(!nd.w || nd.w.how!=="res" || TB.live.has(id)) return;
        const sides = nd.sd.map(x=>String(x.name||"").split("/").map(t=>who(t, "", "")).filter(z=>z.t)), rs = (st.tab.res||{})[id] || {};
        sides.forEach((me, s)=>me.forEach((x,j)=>{ if(!x.k) return; const sd = s ? "a" : "h";
          out.push(Object.assign({}, base, {k:x.k, kind:st.gioco, spec:fspec, lab:nd.turno || "", mate:me.filter((_,q)=>q!==j), opp:sides[1-s], res:nd.w.sd===sd ? "V" : "P", score:rs.txt || "", team:"", vs:""})); })); });
    }
  });
  out.sort((a,b)=>(b.data).localeCompare(a.data) || a.gid.localeCompare(b.gid) || (a.i||0) - (b.i||0));
  return mxCache = out;
}
function giocHTML(){
  const back = `<a class="back" href="?giocatori">← Tutti i giocatori</a>`;
  if(!ANAG) return `<main class="wrap">${back}<p class="empty">Caricamento…</p></main>`;
  const p = ANAG[PCODE];
  if(!p) return `<main class="wrap">${back}<p class="empty">Giocatore non trovato.</p></main>`;
  const y0 = stagione(), r = rowAt(p, y0), sq = (SQUADRE||{})[r.sq];
  document.title = tabName(p) + " · Biliardo Seconda Passione";
  let h = `<main class="wrap">${back}<section class="phead">${sqLogo(r.sq, sq)}<div><div class="comp">${esc(tabName(p))}${r.cat ? ` <span class="pc">(${esc(r.cat)})</span>` : ""}</div>
    <div class="sub">${esc([p.nome, p.cognome].filter(Boolean).join(" "))}${p.sopr ? ` · “${esc(p.sopr)}”` : ""}</div>
    <div class="pinfo">${esc(sqName(r.sq))} · ${esc(catLabel(r.cat) || "categoria non indicata")} · ${stagLabel(anniOf(p).includes(y0) ? y0 : anniOf(p).at(-1))}</div></div></section>`;
  if(allgErr) return h + `<p class="empty">Impossibile leggere le gare. Ricarica la pagina.</p></main>`;
  if(!ALLG) return h + `<p class="empty">Caricamento delle partite…</p></main>`;
  const all = allMatches().filter(e=>e.k===PCODE), ys = [...new Set(all.map(e=>e.y))].sort((a,b)=>b-a);
  if(gSt && !ys.includes(+gSt)) gSt = "";
  const L = gSt ? all.filter(e=>e.y===+gSt) : all, done = L.filter(e=>e.res), v = done.filter(e=>e.res==="V").length;
  if(ys.length>1) h += `<div class="pills">${["", ...ys].map(y=>`<button class="pill${String(y)===gSt ? " on" : ""}" data-gst="${y}">${y ? stagLabel(y) : "Tutte"}</button>`).join("")}</div>`;
  if(!all.length) return h + `<p class="empty">Nessuna partita registrata finora.</p><div class="foot">Biliardo Seconda Passione · Bologna</div></main>`;
  h += `<section class="pstat"><div><b>${done.length}</b><span>giocate</span></div><div><b>${v}</b><span>vinte</span></div><div><b>${done.length - v}</b><span>perse</span></div><div><b>${done.length ? Math.round(v/done.length*100) : 0}%</b><span>vittorie</span></div></section>`;
  const by = new Map(); done.forEach(e=>{ const key = e.kind + (e.spec ? " · " + e.spec : ""); const x = by.get(key) || {g:0, v:0}; x.g++; if(e.res==="V") x.v++; by.set(key, x); });
  if(by.size) h += `<section class="panel ptab"><h2>Per specialità</h2><table><thead><tr><th></th><th>Giocate</th><th>Vinte</th><th>%</th></tr></thead><tbody>` +
    [...by].sort((a,b)=>b[1].g - a[1].g).map(([k,x])=>`<tr><td>${esc(k)}</td><td>${x.g}</td><td>${x.v}</td><td>${Math.round(x.v/x.g*100)}%</td></tr>`).join("") + `</tbody></table></section>`;
  const nm = xs => xs.map(x=>plink(x.k, esc(x.t))).join(" / ");
  h += `<h2 class="lh">Partite</h2><div class="plist">` + L.map(e=>`<a class="pm ${e.res==="V" ? "rv" : e.res==="P" ? "rp" : "ro"}" href="?gara=${esc(e.gid)}">
      <div class="pmh"><span>${esc(fmtDate(e.data))}</span><span class="pr">${e.res==="V" ? "Vinta" : e.res==="P" ? "Persa" : "In corso"}</span></div>
      <div class="pmt">${esc(e.tit)}${e.sub ? ` · ${esc(e.sub)}` : ""}</div>
      <div class="pmk">${esc([e.lab, e.kind, e.spec].filter(Boolean).join(" · "))}${e.extra ? ` · ${esc(e.extra)}` : ""}</div>
      <div class="pmv">${e.mate.length ? `con ${e.mate.map(x=>esc(x.t)).join(" / ")} ` : ""}contro <b>${e.opp.length ? e.opp.map(x=>esc(x.t)).join(" / ") : "—"}</b>${e.vs ? ` <span>(${esc(e.vs)})</span>` : ""}${e.score ? `<em>${esc(e.score)}</em>` : ""}</div></a>`).join("") + `</div>`;
  return h + `<div class="foot">Biliardo Seconda Passione · Bologna</div></main>`;
}
function giocsHTML(){
  let h = `<main class="wrap"><a class="back" href="?">← Tutte le gare</a><div class="top"><div><div class="comp">Giocatori</div><div class="sub">Schede e statistiche</div></div></div>`;
  if(!ANAG || !SQUADRE) return h + `<p class="empty">Caricamento…</p></main>`;
  if(gsSt===null) gsSt = stagione();
  const ys = anYears(); if(!ys.includes(gsSt)) gsSt = ys[0];
  h += `<div class="anf"><select id="gs-st" aria-label="Anno sportivo">${ys.map(y=>`<option value="${y}"${y===gsSt ? " selected" : ""}>${stagLabel(y)}</option>`).join("")}</select><input id="gs-q" type="search" placeholder="Cerca…" value="${esc(gsQ)}" autocomplete="off"></div><div id="gs-list">${giocsList()}</div>`;
  return h + `<div class="foot">Biliardo Seconda Passione · Bologna</div></main>`;
}
function giocsList(){
  const q = gsQ.trim().toLowerCase();
  const rows = Object.entries(ANAG).map(([k,p])=>({k, p, r:(p.anni||{})[gsSt]})).filter(x=>x.r && (!q || [x.p.cognome, x.p.nome, x.p.sopr, tabName(x.p), sqName(x.r.sq)].join(" ").toLowerCase().includes(q)));
  if(!rows.length) return `<p class="empty">Nessun giocatore.</p>`;
  rows.sort((a,b)=>isClub(b.r.sq) - isClub(a.r.sq) || sqName(a.r.sq).localeCompare(sqName(b.r.sq)) || String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||"")));
  const g = new Map(); rows.forEach(x=>{ if(!g.has(x.r.sq)) g.set(x.r.sq, []); g.get(x.r.sq).push(x); });
  return [...g].map(([sq, xs])=>`<h3 class="ang">${esc(sqName(sq))} <span>${xs.length}</span></h3><div class="anl">` + xs.map(x=>
    `<a class="anr" href="?giocatore=${esc(x.k)}"><b>${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""}</b><span>${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))}${x.p.sopr ? ` · “${esc(x.p.sopr)}”` : ""} · ${esc(catLabel(x.r.cat) || "categoria non indicata")}</span></a>`).join("") + `</div>`).join("");
}
app.addEventListener("click", e=>{ if(mode!=="gioc") return; const b = e.target.closest("[data-gst]"); if(b){ gSt = b.dataset.gst; render(); } });
app.addEventListener("change", e=>{ if(mode==="giocs" && e.target.id==="gs-st"){ gsSt = +e.target.value; e.target.blur(); render(); } });
app.addEventListener("input", e=>{ if(mode==="giocs" && e.target.id==="gs-q"){ gsQ = e.target.value; $("#gs-list").innerHTML = giocsList(); } });

