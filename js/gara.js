/* Tabellone Live · gara.js — Logica di gara: tornei con batterie e finali, formule a set, vincitori, totali
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= logica di gara ================= */
let S = null;
const isTorneo = (st=S) => !!(st && (FORMULE[st.formula]||{}).torneo);
/* campionato a squadre in trasferta: a sinistra la squadra di casa (l'avversaria). I dati restano uguali: h = noi, a = avversari */
const SDS = (st=S) => st && st.trasferta && !isTorneo(st) ? ["a","h"] : ["h","a"];
/* chiave stabile di un incontro (cronologia, animazioni): nei tornei l'id, nelle gare a squadre la posizione */
const mkey = (m, i) => "m" + (m && m.id!=null ? m.id : i);
const namesOf = (m, sd) => m[sd].filter(Boolean).join(" / ");
const sideName = (m, sd) => isTorneo() ? (namesOf(m, sd) || "—") : teamShort(sd);
/* ================= torneo con batterie e finali ================= */
const isTab = (st=S) => !!(st && (FORMULE[st.formula]||{}).tab);
const ASSENTE = /^(assente|ass\.?|-|—)$/i;
const BAT_TURNI = ["Quarti di finale", "Semifinale", "Finale"];
const FIN_TURNI = {2:"Finale", 4:"Semifinali", 8:"Quarti di finale", 16:"Ottavi di finale", 32:"Sedicesimi di finale"};
/* ordine proposto per le finali: con N batterie (non potenza di 2) i primi 2·(N−S) vincitori giocano l'acqua */
function finDefault(nb){
  if(nb<2) return {acqua:[], main:[]};
  let S2 = 1; while(S2*2<=nb) S2 *= 2;
  const a = nb - S2, acqua = [], byes = [], qa = [];
  for(let j=0; j<a; j++){ acqua.push(["B"+(2*j+1), "B"+(2*j+2)]); qa.push("A"+(j+1)); }
  for(let b=2*a+1; b<=nb; b++) byes.push("B"+b);
  const slots = []; while(qa.length || byes.length){ if(qa.length) slots.push(qa.shift()); if(byes.length) slots.push(byes.shift()); }
  const main = []; for(let i=0; i<slots.length; i+=2) main.push([slots[i], slots[i+1]]);
  return {acqua, main};
}
function normTab(st){
  const T = st.tab || {}, F = T.fin || {};
  st.tab = {bat:arr(T.bat).filter(Boolean).map((b,i)=>({nome:String(b.nome||"Batteria " + (i+1)), p:Array.from({length:8}, (_,j)=>String(arr(b.p)[j]||""))})),
    fin:{acqua:arr(F.acqua).map(x=>arr(x).map(String)), main:arr(F.main).map(x=>arr(x).map(String))}, res:{}};
  if(!st.tab.bat.length) st.tab.bat = [{nome:"Batteria 1", p:Array(8).fill("")}];
  if(st.tab.bat.length>1 && !st.tab.fin.main.length) st.tab.fin = finDefault(st.tab.bat.length);
  Object.entries(T.res||{}).forEach(([k,v])=>{ if(v && (v.w==="h" || v.w==="a" || v.txt)) st.tab.res[k] = {w:v.w==="h"||v.w==="a" ? v.w : "", txt:String(v.txt||"")}; });
}
/* nodi del tabellone (id senza punti, per Firebase): b<batteria>_<turno>_<k>, a_<k> (acqua), f_<turno>_<k> (finali) */
function buildTab(st){
  const T = st.tab, nodes = new Map(), pages = [], live = new Map();
  st.matches.forEach((m,i)=>{ if(m.tid) live.set(m.tid, {m, i}); });
  const add = (id, turno, src) => nodes.set(id, {id, turno, src, no:0});
  T.bat.forEach((b,bi)=>{
    const pg = {key:"b"+bi, title:b.nome.split("·")[0].trim() || b.nome, full:b.nome, rounds:[], acqua:[], last:`b${bi}_2_0`};
    for(let rr=0; rr<3; rr++){ const ids = [];
      for(let k=0; k<(4>>rr); k++){ const id = `b${bi}_${rr}_${k}`; ids.push(id);
        add(id, b.nome + " · " + BAT_TURNI[rr], rr===0 ? [{p:b.p[2*k]}, {p:b.p[2*k+1]}] : [{n:`b${bi}_${rr-1}_${2*k}`}, {n:`b${bi}_${rr-1}_${2*k+1}`}]); }
      pg.rounds.push({label:BAT_TURNI[rr], ids}); }
    pages.push(pg);
  });
  const nb = T.bat.length;
  if(nb>1 && T.fin.main.length){
    const ref = x => { const mm = /^([AB])(\d+)$/i.exec(String(x||"").trim()); if(!mm) return {p:""};
      const j = +mm[2]; return mm[1].toUpperCase()==="B" ? {n:`b${j-1}_2_0`, lab:"Vinc. " + (T.bat[j-1] ? (T.bat[j-1].nome.split("·")[0].trim() || T.bat[j-1].nome) : "batteria " + j)} : {n:`a_${j-1}`, lab:"Vinc. acqua " + j}; };
    const pg = {key:"fin", title:"Finali", full:"Finali", rounds:[], acqua:[]};
    T.fin.acqua.forEach((x,j)=>{ const id = `a_${j}`; add(id, "Finali · Partite dell'acqua", [ref(x[0]), ref(x[1])]); pg.acqua.push(id); });
    let prev = null, size = T.fin.main.length*2, rr = 0;
    while(size>=2){ const ids = [], lab = FIN_TURNI[size] || "Turno " + (rr+1);
      for(let k=0; k<size/2; k++){ const id = `f_${rr}_${k}`; ids.push(id);
        add(id, "Finali · " + lab, rr===0 ? [ref(T.fin.main[k][0]), ref(T.fin.main[k][1])] : [{n:prev[2*k]}, {n:prev[2*k+1]}]); }
      pg.rounds.push({label:lab, ids}); prev = ids; size /= 2; rr++; }
    pg.last = prev[0]; pages.push(pg);
  }
  pages.forEach(pg=>{ let no = 1; pg.acqua.forEach(id=>nodes.get(id).no = no++); pg.rounds.forEach(x=>x.ids.forEach(id=>nodes.get(id).no = no++)); });
  const memo = new Map();
  const side = sr => { if(sr.p!==undefined){ const t = String(sr.p||"").trim(); return {name:t, abs:ASSENTE.test(t), tbd:!t || t==="?"}; }
    const w = win(sr.n); return w ? {name:w.name, abs:w.abs, tbd:false} : {name:"", tbd:true, lab:sr.lab || ("Vinc. incontro " + (nodes.get(sr.n) ? nodes.get(sr.n).no : "?"))}; };
  const sides = id => { const nd = nodes.get(id); if(!nd.sd) nd.sd = nd.src.map(side); return nd.sd; };
  function win(id){
    if(memo.has(id)) return memo.get(id); memo.set(id, null);
    const nd = nodes.get(id); if(!nd) return null;
    const [h,a] = sides(id), L = live.get(id), rs = T.res[id]; let w = null, how = "";
    if(L && winner(L.m)){ w = winner(L.m); how = "live"; }
    else if(rs && (rs.w==="h" || rs.w==="a")){ w = rs.w; how = "res"; }
    else if(h.abs && !a.tbd){ w = "a"; how = "abs"; } else if(a.abs && !h.tbd){ w = "h"; how = "abs"; }
    const o = w ? {sd:w, name:(w==="h" ? h : a).name, abs:(w==="h" ? h : a).abs, how} : null;
    memo.set(id, o); nd.w = o; return o;
  }
  nodes.forEach((nd,id)=>{ sides(id); win(id); });
  const lastId = nb===1 ? "b0_2_0" : (pages.find(p=>p.key==="fin") || {}).last;
  const lw = lastId && nodes.get(lastId) && nodes.get(lastId).w;
  return {nodes, pages, live, champ: lw && !lw.abs ? lw.name : ""};
}
/* vincitore: l'ultimo incontro di un turno "Finale" (anche "Batteria · Finale": allora è il vincitore della batteria) */
function champion(st=S){
  if(isTab(st)){ const c = buildTab(st).champ; return c ? {n:c, coppia:st.gioco==="Coppia", label:st.gioco==="Coppia" ? "Vincitori" : "Vincitore"} : null; }
  const fin = st.matches.filter(m=>/(^|[\s·\-–])finale$/i.test((m.turno||"").trim())).pop(); if(!fin) return null;
  const w = winner(fin); if(!w) return null;
  const pre = (fin.turno||"").trim().replace(/[\s·\-–]*finale$/i, "").trim(), cp = fin.kind==="Coppia";
  return {n: namesOf(fin, w), coppia: cp, label: (pre ? pre + " · " : "") + (cp ? "Vincitori" : "Vincitore")};
}
/* ---- torneo: formula della partita ("Italiana a 100", "2 su 3 Italiana a 100", "A a x + B a y + bella a scelta") ---- */
/* formule del torneo, compilate col modulo: {nome, n: 1|3|5, sets:[{spec, target} | {scelta:true}]} */
/* [nome in grafica, voce del menu]; i nomi lunghi usati fino al 24/10 si convertono da soli */
const SPECIALITA = [["5 Birilli", "5 Birilli (Italiana)"], ["Goriziana", "Goriziana semplici-doppi"], ["Filotto 60", 'Goriziana "Filotto 60"']];
const SPEC_BREVE = Object.fromEntries(SPECIALITA.map(([v, l])=>[l, v]));
const FB_NUOVA = {nome:"Normale", n:1, sets:[{spec:"", target:0}]};
function formulaDefs(f){
  const fixed = [];
  f.sets.slice(0, f.n).forEach(x=>{ if(!x.scelta && x.spec && x.target && !fixed.some(y=>y.spec===x.spec && y.target===x.target)) fixed.push({spec:x.spec, target:+x.target}); });
  return f.sets.slice(0, f.n).map(x=>x.scelta ? (fixed.length===1 ? Object.assign({}, fixed[0]) : {opts:fixed.map(y=>Object.assign({}, y))}) : {spec:x.spec||"?", target:+x.target||0});
}
const findFormula = (st, nome) => (st.formule||[]).find(f=>f.nome.trim().toLowerCase()===String(nome||"").trim().toLowerCase());
function defsFor(st, m){
  if(m.fr){ const f = findFormula(st, m.fr); if(f) return formulaDefs(f); }
  if(m.formato){ const p = parseFormato(m.formato); if(p.sets) return p.sets; }
  if(st.formule && st.formule.length) return formulaDefs(st.formule[0]);
  return [{spec:"?", target:0}];
}
function normFormula(f, i){
  const n = [1,3,5].includes(+f.n) ? +f.n : 1, sets = arr(f.sets).map(x=>x && x.scelta ? {scelta:true} : {spec:(s=>SPEC_BREVE[s]||s)(String((x||{}).spec||"")), target:+(x||{}).target||0});
  while(sets.length<n) sets.push(Object.assign({}, sets.filter(x=>!x.scelta).pop() || {spec:"", target:0}));
  return {nome:String(f.nome||"").trim() || (i ? "Formula " + (i+1) : "Normale"), n, sets:sets.slice(0, n)};
}
/* modulo HTML di una formula (nuova gara e finestra degli incontri) */
function fbHTML(f, idx, named){
  const n = f.n || 1, opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(t)}</option>`;
  let rows = "";
  for(let k=0; k<n; k++){
    let x = f.sets[k] || Object.assign({}, f.sets.filter(y=>!y.scelta).pop() || {spec:"", target:0});
    const last = n>1 && k===n-1; if(x.scelta && !last) x = {spec:"", target:0};
    const inList = SPECIALITA.some(([v])=>v===x.spec), altro = !x.scelta && (!!x.altro || (!!x.spec && !inList)), sc = !!x.scelta;
    const r0 = f.sets[0] || {}, copy = k>0 && !sc && x.spec===r0.spec && +x.target===+r0.target && !!x.altro===!!r0.altro;
    rows += `<div class="fbr${sc ? " fsc" : ""}" data-k="${k}"${copy ? ` data-copy="1"` : ""}><span class="fbl">${n>1 ? (k+1) + "° set" : "Set"}</span>
      <select data-f="spec" aria-label="Specialità del ${k+1}° set">${opt("", "— specialità —", !x.spec && !sc)}${SPECIALITA.map(([v, l])=>opt(v, l, x.spec===v)).join("")}${opt("__altro", "Altro…", altro)}${last ? opt("__scelta", "A scelta all'acchito", sc) : ""}</select>
      <input data-f="pt" type="number" inputmode="numeric" min="1" placeholder="punti" aria-label="Punti del ${k+1}° set" value="${sc || !x.target ? "" : x.target}"${sc ? " hidden" : ""}>
      <input data-f="altro" placeholder="Nome della specialità" value="${altro ? esc(x.spec) : ""}"${altro ? "" : " hidden"}></div>`;
  }
  return `<div class="fb" data-fb="${idx}" data-named="${named ? 1 : 0}"><div class="fbh">
      ${named ? `<input class="fbn" data-f="nome" value="${esc(f.nome)}" placeholder="Nome della formula" aria-label="Nome della formula">` : ""}
      <select data-f="n" aria-label="Numero di set">${opt(1, "Set secco", n===1)}${opt(3, "2 su 3", n===3)}${opt(5, "3 su 5", n===5)}</select>
      ${named && idx>0 ? `<button type="button" class="del" data-e="delf" data-i="${idx}">Togli</button>` : ""}</div>${rows}</div>`;
}
function readFB(fb, strict){
  const q = sel => fb.querySelector(sel), n = +q('[data-f="n"]').value || 1, errs = [];
  const nome = q('[data-f="nome"]') ? q('[data-f="nome"]').value.trim() : "Normale";
  const sets = [...fb.querySelectorAll(".fbr")].map((r, k)=>{
    const sel = r.querySelector('[data-f="spec"]').value, pt = +r.querySelector('[data-f="pt"]').value || 0;
    if(sel==="__scelta") return {scelta:true};
    const spec = sel==="__altro" ? r.querySelector('[data-f="altro"]').value.trim() : sel;
    if(strict && !spec) errs.push(`${n>1 ? (k+1) + "° set" : "set"}: ${sel==="__altro" ? "scrivi il nome della specialità" : "scegli la specialità"}`);
    if(strict && !pt) errs.push(`${n>1 ? (k+1) + "° set" : "set"}: indica i punti`);
    return sel==="__altro" ? {spec, target:pt, altro:true} : {spec, target:pt};
  });
  if(strict && fb.dataset.named==="1" && !nome) errs.push("dai un nome alla formula");
  return {f:{nome, n, sets}, errs};
}
/* cambiando numero di set o specialità il modulo si ridisegna (i valori scritti restano) */
/* le righe ancora uguali al 1° set lo seguono (2 su 3 nella stessa specialità: basta compilare la prima riga) */
function followFirst(fb){
  const r0 = fb.querySelector('.fbr[data-k="0"]'); if(!r0) return;
  fb.querySelectorAll('.fbr[data-copy="1"]').forEach(r=>["spec","pt","altro"].forEach(k=>{
    const a = r0.querySelector(`[data-f="${k}"]`), b = r.querySelector(`[data-f="${k}"]`); if(a && b) b.value = a.value; }));
}
document.addEventListener("input", e=>{
  const fb = e.target.closest && e.target.closest(".fb"); if(!fb || !/^(pt|altro)$/.test(e.target.dataset.f||"")) return;
  if(e.target.closest('.fbr[data-k="0"]')) followFirst(fb);
});
document.addEventListener("change", e=>{
  const fb = e.target.closest && e.target.closest(".fb"); if(!fb || !/^(n|spec)$/.test(e.target.dataset.f||"")) return;
  if(e.target.closest('.fbr[data-k="0"]')) followFirst(fb);
  const {f} = readFB(fb, false); fb.outerHTML = fbHTML(f, +fb.dataset.fb, fb.dataset.named==="1");
  const nf = document.querySelector(`.fb[data-fb="${fb.dataset.fb}"][data-named="${fb.dataset.named}"]`);
  const alt = nf && nf.querySelector('.fbr:not([hidden]) [data-f="altro"]:not([hidden])'); if(alt && !alt.value) alt.focus();
});
function parseSet(t){ const mm = String(t).trim().match(/^(.+?)\s+(?:ai?\s+)?(\d+)(?:\s*punti)?$/i); return mm ? {spec:mm[1].trim(), target:+mm[2]} : null; }
function parseFormato(str){
  let t = String(str||"").trim().replace(/\s+/g, " "); if(!t) return {err:"manca la formula della partita (es. Italiana a 100)"};
  t = t.replace(/^al meglio de(?:i|lle)\s+(?:3|tre)\s*(?:set|partite)?\s*:?\s*/i, "2 su 3 ").replace(/^al meglio de(?:i|lle)\s+(?:5|cinque)\s*(?:set|partite)?\s*:?\s*/i, "3 su 5 ")
       .replace(/^(\d)\s*\/\s*(\d)\s+/, "$1 su $2 ").replace(/^due su tre\s+/i, "2 su 3 ").replace(/^tre su cinque\s+/i, "3 su 5 ");
  const bo = t.match(/^(\d+)\s*su\s*(\d+)\s*:?\s*(.+)$/i); let parts;
  if(bo){ const n = +bo[2]; if(n%2===0 || +bo[1]!==(n+1)/2) return {err:`"${bo[1]} su ${bo[2]}" non torna: si scrive 2 su 3 oppure 3 su 5`}; parts = Array(n).fill(bo[3]); }
  else parts = t.split("+").map(x=>x.trim()).filter(Boolean);
  if(parts.length%2===0) return {err:"il numero di set dev'essere dispari (1, 3 o 5)"};
  const clean = p => p.replace(/^(bella|spareggio|set\s*\d*|\d+°?\s*set)\s*:?\s*/i, "").trim();
  const fixed = [];
  parts.forEach(p=>{ const c = clean(p); if(!/\/|scelta/i.test(c)){ const x = parseSet(c); if(x && !fixed.some(f=>f.spec===x.spec && f.target===x.target)) fixed.push(x); } });
  const sets = [];
  for(const p of parts){
    const c = clean(p);
    if(/\//.test(c)){ const o = c.replace(/^a\s+scelta\s*:?\s*/i, "").split("/").map(parseSet); if(o.some(x=>!x)) return {err:`specialità non chiara: "${p}"`}; sets.push({opts:o}); }
    else if(!c || /^(a\s+)?scelta$/i.test(c)){
      if(fixed.length===1) sets.push(Object.assign({}, fixed[0]));
      else if(fixed.length>1) sets.push({opts:fixed.map(x=>Object.assign({}, x))});
      else return {err:`"${p}": indica tra quali specialità (es. bella: 5 Birilli a 120 / Filotto 60 a 600)`};
    }
    else { const x = parseSet(c); if(!x) return {err:`specialità non chiara: "${p}" (es. Italiana a 100)`}; sets.push(x); }
  }
  return {sets};
}
const setLabel = (k, n) => (k+1) + "° set";   /* in grafica sempre "3° set", mai "Bella" (la parola resta valida solo nella formula) */
const hasPts = m => m.ss ? m.ss.some(x=>x[0]||x[1]) : !!(m.s[0]||m.s[1]);
function setWin(m, k){ const d = m.defs[k], x = m.ss[k]; if(!d || !d.target) return null;
  if(x[0]>=d.target && x[0]>x[1]) return "h"; if(x[1]>=d.target && x[1]>x[0]) return "a"; return null; }
/* set da giocare (play, -1 se l'incontro è deciso), set mostrato (sk: quello in gioco, o l'ultimo giocato a incontro concluso), punteggio grande (s) */
function deriveSets(m){
  const n = m.defs.length, need = (n+1)/2; let wh = 0, wa = 0, play = -1;
  for(let k=0; k<n; k++){ if(wh>=need || wa>=need) break; const w = setWin(m,k); if(w==="h") wh++; else if(w==="a") wa++; else { play = k; break; } }
  m.sw = [wh, wa]; m.mw = wh>=need ? "h" : wa>=need ? "a" : null; m.play = m.mw ? -1 : play;
  let last = 0; m.ss.forEach((x,k)=>{ if(x[0]||x[1]) last = k; });
  m.sk = m.play<0 ? last : m.play;
  const d = m.defs[m.sk]; m.spec = d.spec||""; m.target = d.target||0; m.s = m.ss[m.sk].slice();
}
const editSet = m => m.play>=0 ? m.play : m.sk;
function winner(m){
  if(m.defs) return m.mw;
  if(!m.target) return null;
  if(m.s[0]>=m.target && m.s[0]>m.s[1]) return "h";
  if(m.s[1]>=m.target && m.s[1]>m.s[0]) return "a";
  return null;
}
function totals(st){ const t=[0,0]; (st||S).matches.forEach(m=>{ const w=winner(m), p=m.pts||1; if(w==="h") t[0]+=p; if(w==="a") t[1]+=p; }); return t; }
const relayIdx = m => Math.min(m.h.length-1, Math.floor(Math.max(m.s[0],m.s[1]) / m.step));
function setScore(i, side, val){
  const m = S.matches[i], k = side==="h"?0:1; val = Math.max(0, Math.round(+val||0));
  if(m.defs){ const e = editSet(m); if(m.ss[e][k]===val) return; snapshot(); m.ss[e][k] = val; deriveSets(m); commit(); return; }
  if(m.s[k]===val) return;
  snapshot();
  if(m.kind==="Staffetta"){
    const a = side==="h" ? m.ph : m.pa; let d = val - m.s[k];
    if(d > 0) a[relayIdx(m)] += d;
    else for(let f=a.length-1; f>=0 && d<0; f--){ const t = Math.min(a[f], -d); a[f] -= t; d += t; }
    m.s[k] = a.reduce((x,y)=>x+y,0);
  } else m.s[k] = val;
  commit();
}
function setSetScore(i, k, side, val){
  const m = S.matches[i], j = side==="h"?0:1; val = Math.max(0, Math.round(+val||0));
  if(m.ss[k][j]===val) return; snapshot(); m.ss[k][j] = val; deriveSets(m); commit();
}
function setFrac(i, side, j, val){
  const m = S.matches[i], a = side==="h" ? m.ph : m.pa; val = Math.max(0, Math.round(+val||0));
  if(a[j]===val) return;
  snapshot(); a[j] = val; m.s[side==="h"?0:1] = a.reduce((x,y)=>x+y,0); commit();
}

