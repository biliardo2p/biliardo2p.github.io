/* Tabellone Live · nomi.js — Nomi nelle gare: riconoscimento, categoria, suggerimenti
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= nomi dei giocatori nelle gare: riconoscimento, categoria, suggerimenti =================
   Campionati a squadre: accanto ai nomi m.h / m.a ci sono i codici m.hc / m.ac (vuoto = scritto a mano, non collegato).
   Il codice segue sempre il nome: se si riscrive la casella, il codice si ricalcola dal testo. Con il codice si mostra il nome attuale dell'elenco.
   Tornei: i nomi vengono dai testi degli incontri e delle batterie e si riconoscono al volo. */
let anIdx = null, anIdxOf = null;
const nkey = t => slug(String(t||"").replace(/\(\s*[m123]\s*\)\s*$/i, ""));
function anIndex(){
  if(anIdx && anIdxOf===ANAG) return anIdx;
  anIdx = new Map(); anIdxOf = ANAG;
  Object.entries(ANAG||{}).forEach(([k,p])=>{
    new Set([tabName(p), p.cognome, p.nome && p.cognome + " " + p.nome, p.nome && p.nome + " " + p.cognome, p.sopr].filter(Boolean).map(nkey))
      .forEach(x=>{ if(!x) return; if(!anIdx.has(x)) anIdx.set(x, []); anIdx.get(x).push(k); });
  });
  return anIdx;
}
function resolveName(t, sq, y){
  if(!ANAG || !String(t||"").trim()) return "";
  const ks = anIndex().get(nkey(t)); if(!ks || !ks.length) return ""; if(ks.length===1) return ks[0];
  if(sq){ const f = ks.filter(k=>rowAt(ANAG[k], y).sq===sq); if(f.length===1) return f[0]; }
  return "";
}
const sideSq = sd => !S || isTorneo() ? "" : sd==="h" ? CLUBSQ : (S.away.sq || findSq(S.away.name));
const gYear = () => stagione(S && S.data);
function pInfo(m, sd, j){
  const t = m[sd][j] || "", c = (m[sd + "c"] || [])[j] || "", y = gYear();
  if(!ANAG) return {t, k:"", cat:""};
  const k = c && ANAG[c] ? c : resolveName(t, sideSq(sd), y), p = k && ANAG[k];
  return {t: p ? tabName(p) : t, k, cat: p ? rowAt(p, y).cat || "" : ""};
}
const catTag = c => c ? `<i class="ct">(${esc(c)})</i>` : "";
function nameCell(m, i, sd, j, cls){
  const x = pInfo(m, sd, j);
  if(!editor || m.tid) return `<span class="${cls}">${plink(x.k, esc(x.t))}${x.cat ? " " + catTag(x.cat) : ""}</span>`;
  const nl = x.t && !x.k && ANAG ? " nl" : "";
  return `<span class="pw"><span class="${cls}${nl}" contenteditable="plaintext-only" spellcheck="false" data-nm="${i}.${sd}.${j}" data-orig="${esc(x.t)}"${nl ? ` title="Nome non presente nell'elenco giocatori"` : ""}>${esc(x.t)}</span>${catTag(x.cat)}</span>`;
}
/* tornei: testo "Galli / Tamburini" -> ogni nome con la sua categoria */
function namesCat(t){
  if(!ANAG) return esc(t); const y = gYear();
  return String(t).split(" / ").map(n=>{ const k = resolveName(n, "", y), c = k ? rowAt(ANAG[k], y).cat : ""; return plink(k, esc(n)) + (c ? " " + catTag(c) : ""); }).join(" / ");
}
app.addEventListener("focusout", e=>{
  const el = e.target; if(!editor || mode!=="board" || !el.dataset || !el.dataset.nm) return;
  hideSug();
  if(el.dataset.cancel) return;
  const txt = el.textContent.replace(/\s+/g, " ").trim(), [i, sd, j] = el.dataset.nm.split("."), m = S.matches[+i];
  if(!m || txt===el.dataset.orig) return;
  snapshot(); m[sd][+j] = txt;
  if(!isTorneo()){ if(!Array.isArray(m[sd + "c"])) m[sd + "c"] = m[sd].map(()=>"");
    m[sd + "c"][+j] = el.dataset.pick && el.dataset.pickt===txt ? el.dataset.pick : resolveName(txt, sideSq(sd), gYear()); }
  setTimeout(commit);
});
/* ---- tendina dei suggerimenti ---- */
let sugFor = null, sugI = -1, sugL = [];
function sugCands(el){
  const sd = el.dataset.nm.split(".")[1], y = gYear(), sq = sideSq(sd), q = nkey(el.textContent).split("-").filter(Boolean);
  const L = Object.entries(ANAG||{}).map(([k,p])=>({k, p, r:rowAt(p, y), now:!!(p.anni||{})[y]})).filter(x=>{
    if(!q.length) return x.now && (sq ? x.r.sq===sq : isClub(x.r.sq));
    const hay = [x.p.cognome, x.p.nome, x.p.sopr, tabName(x.p)].map(nkey).join("-").split("-");
    return q.every(w=>hay.some(h=>h.startsWith(w)));
  });
  L.sort((a,b)=>(sq ? (b.r.sq===sq) - (a.r.sq===sq) : 0) || isClub(b.r.sq) - isClub(a.r.sq) || b.now - a.now
    || String(a.p.cognome).localeCompare(String(b.p.cognome)) || String(a.p.nome||"").localeCompare(String(b.p.nome||"")));
  return L.slice(0, 40);
}
function showSug(el){
  const box = $("#sug");
  if(!ANAG || !el || !el.isConnected){ hideSug(); return; }
  const txt = el.textContent.replace(/\s+/g, " ").trim(), sd = el.dataset.nm.split(".")[1];
  sugL = sugCands(el); sugFor = el;
  const add = txt && !resolveName(txt, sideSq(sd), gYear()) && SQUADRE && Object.keys(SQUADRE).length;
  const n = sugL.length + (add ? 1 : 0);
  if(!n){ box.hidden = true; return; }
  if(sugI>=n) sugI = -1;
  const y = gYear();
  box.innerHTML = sugL.map((x,k)=>`<button type="button" class="sg${k===sugI ? " on" : ""}" data-sg="${k}"><b>${esc(tabName(x.p))}${x.r.cat ? ` (${esc(x.r.cat)})` : ""}</b><span>${esc([x.p.nome, x.p.cognome].filter(Boolean).join(" "))} · ${esc(sqName(x.r.sq))}${x.now ? "" : " (" + stagLabel(anniOf(x.p).at(-1)) + ")"}</span></button>`).join("")
    + (add ? `<button type="button" class="sg add${sugI===sugL.length ? " on" : ""}" data-sg="add">+ Aggiungi “${esc(txt)}” all'elenco giocatori</button>` : "");
  box.hidden = false;
  const r = el.getBoundingClientRect(), vh = window.visualViewport ? visualViewport.height : innerHeight, w = Math.min(340, innerWidth - 16);
  box.style.width = w + "px"; box.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
  const below = vh - r.bottom - 8, above = r.top - 8, h = Math.min(box.scrollHeight, 300);
  if(below>=Math.min(h, 180) || below>=above){ box.style.top = (r.bottom + 4) + "px"; box.style.bottom = ""; box.style.maxHeight = Math.max(120, Math.min(300, below)) + "px"; }
  else { box.style.top = ""; box.style.bottom = (innerHeight - r.top + 4) + "px"; box.style.maxHeight = Math.min(300, above) + "px"; }
  const on = box.querySelector(".sg.on"); if(on) on.scrollIntoView({block:"nearest"});
}
function hideSug(){ const b = $("#sug"); if(b) b.hidden = true; sugFor = null; }
function pickSug(k){
  const el = sugFor; if(!el) return;
  if(k==="add"){ const txt = el.textContent.replace(/\s+/g, " ").trim(), nm = el.dataset.nm, sd = nm.split(".")[1];
    hideSug(); el.blur();
    const parts = txt.split(" "), cog = parts.shift(), rest = parts.join(" ").trim();
    openPlayer(null, {cognome:cog, nome:/^[^\s.]\.?$/.test(rest) ? "" : rest, sq:sideSq(sd) || CLUBSQ, y:gYear(), link:nm}); return; }
  const x = sugL[+k]; if(!x) return;
  el.textContent = tabName(x.p); el.dataset.pick = x.k; el.dataset.pickt = tabName(x.p); hideSug(); el.blur();
}
app.addEventListener("focusin", e=>{ if(editor && mode==="board" && e.target.dataset && e.target.dataset.nm){ sugI = -1; showSug(e.target); } });
app.addEventListener("input", e=>{ if(e.target.dataset && e.target.dataset.nm && document.activeElement===e.target){ sugI = -1; showSug(e.target); } });
document.addEventListener("keydown", e=>{
  if(!sugFor || $("#sug").hidden || e.target!==sugFor) return;
  const n = $("#sug").querySelectorAll(".sg").length;
  if(e.key==="ArrowDown" || e.key==="ArrowUp"){ e.preventDefault(); e.stopPropagation(); sugI = e.key==="ArrowDown" ? (sugI + 1) % n : (sugI <= 0 ? n - 1 : sugI - 1); showSug(sugFor); }
  else if(e.key==="Enter" || e.key==="Tab"){ const on = $("#sug .sg.on"); if(on){ e.preventDefault(); e.stopPropagation(); pickSug(on.dataset.sg); } }
  else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); hideSug(); }
}, true);
$("#sug").addEventListener("pointerdown", e=>{ const b = e.target.closest("[data-sg]"); e.preventDefault(); if(b) pickSug(b.dataset.sg); });
addEventListener("scroll", ()=>{ if(sugFor) showSug(sugFor); }, {passive:true});
addEventListener("resize", ()=>{ if(sugFor) showSug(sugFor); });

