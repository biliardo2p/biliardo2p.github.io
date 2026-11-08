/* Tabellone Live · vista-gara.js — Pagina della gara: punteggio, incontri, set, tornei e tabellone
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= vista tabellone ================= */
const getP = path => path.split(".").reduce((o,k)=>o?.[k], S);
function setP(path, v){ const ks = path.split("."); let o = S; for(let j=0;j<ks.length-1;j++) o = o[ks[j]]; o[ks.at(-1)] = v; }
const ed = (path, cls, tag="span") => editor
  ? `<${tag} class="${cls}" contenteditable="plaintext-only" spellcheck="false" data-ed="${path}">${esc(getP(path))}</${tag}>`
  : `<${tag} class="${cls}">${esc(getP(path))}</${tag}>`;
const sc = (i, sd) => { const v = S.matches[i].s[sd==="h"?0:1];
  return editor ? `<div class="sc" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric" data-sc="${i}.${sd}">${v}</div>` : `<div class="sc" data-sc="${i}.${sd}">${v}</div>`; };
const isAct = i => (S.inCorso||[]).includes(i);
const teamShort = sd => { const o = sd==="h" ? S.home : S.away; return o.short || o.name; };
function awayBadge(){
  if(S.away.logo) return `<img src="${esc(S.away.logo)}" alt="Logo ${esc(S.away.name)}" data-logo="a">`;
  return editor ? `<div class="badge" contenteditable="plaintext-only" spellcheck="false" data-ed="away.badge" data-logo="a" title="Doppio clic: carica un logo">${esc(S.away.badge)}</div>`
                : `<div class="badge" aria-hidden="true">${esc(S.away.badge)}</div>`;
}
function relayList(m, i, sd){
  const idx = relayIdx(m), done = !!winner(m), a = sd==="h" ? m.ph : m.pa;
  return `<div class="rl names">` + m[sd].map((_,j)=>{
    const cls = (j<idx || done&&j<=idx) ? "done" : (!done && j===idx ? "cur" : "");
    const show = j<=idx || a[j]>0;
    const fp = editor ? `<span class="fp" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric" data-fr="${i}.${sd}.${j}">${show?a[j]:""}</span>` : `<span class="fp">${show?a[j]:""}</span>`;
    return `<div class="r ${cls}"><span class="k">${j+1}</span>${nameCell(m, i, sd, j, "nm")}${fp}</div>`;
  }).join("") + `</div>`;
}
function sideHTML(m, i, sd){
  const k = sd==="h"?0:1, w = winner(m), pc = m.target ? Math.min(100, m.s[k]/m.target*100) : 0;
  const names = m.kind==="Staffetta" ? relayList(m,i,sd) : `<div class="names">${m[sd].map((_,j)=>nameCell(m, i, sd, j, "p")).join("")}</div>`;
  return `<div class="side ${sd} ${SDS()[0]===sd ? "L" : "R"} ${w===sd?"won":w?"lost":""}">${names}<div class="bar"><i style="width:${pc}%"></i></div>${sc(i,sd)}</div>`;
}
function setsHTML(m, i){
  const n = m.defs.length;
  return `<div class="sets" style="grid-template-columns:repeat(${Math.min(n,3)},minmax(0,1fr))">` + m.defs.map((d,k)=>{
    const x = m.ss[k], w = setWin(m,k), skip = !(x[0]||x[1]) && m.play<0;
    const pick = d.opts && editor ? ` data-bo="${i}.${k}" title="Clic: specialità scelta all'acchito"` : "";
    const spec = d.opts && !d.target ? `<span class="o${pick?" pick":""}"${pick} title="${esc(d.opts.map(o=>o.spec+" a "+o.target).join(" / "))}">a scelta</span>`
                                     : `<span class="o${pick?" pick":""}"${pick}>${esc(d.spec)} <i>a ${d.target}</i></span>`;
    const val = sd => { const v = x[sd==="h"?0:1];
      return editor ? `<b class="${sd}" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric" data-ss="${i}.${k}.${sd}">${v}</b>` : `<b class="${sd}">${v}</b>`; };
    return `<div class="set ${w ? "w"+w : ""} ${k===m.play ? "cur" : ""} ${skip ? "skip" : ""}"><em>${setLabel(k,n)}</em>${spec}<span class="r">${skip && !editor ? `<span class="ng">non giocato</span>` : val(SDS()[0]) + "<u>–</u>" + val(SDS()[1])}</span></div>`;
  }).join("") + `</div>`;
}
function specHTML(m, i){
  if(m.defs){
    const n = m.defs.length, d = m.defs[m.sk], lab = n>1 ? `<span class="sl">${setLabel(m.sk,n)}</span>` : "";
    const pick = editor && d.opts ? ` data-bo="${i}.${m.sk}" title="Clic: specialità scelta all'acchito"` : "";
    if(d.opts && !d.target) return `${lab}<span class="sp${pick?" pick":""}"${pick}>Specialità all'acchito</span>`;
    return `${lab}<span class="sp${pick?" pick":""}"${pick}>${esc(d.spec)}<b>a ${d.target}</b></span>`;
  }
  const click = editor && m.opts ? ` data-opt="${i}" title="Clic: cambia specialità"` : "";
  if(m.opts && m.opt<0) return `<span class="sp${click?" pick":""}"${click}>Specialità all'acchito</span>`;
  return `<span class="sp${click?" pick":""}"${click}>${esc(m.spec)}<b>a ${m.target}</b></span>`;
}
const TREND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>`;
function matchHTML(m, i){
  const w = winner(m), act = isAct(i), p = m.pts||1;
  const no = editor ? `<button class="no" data-act="${i}" title="Segna/togli in corso (tasto ${i+1})">${i+1}</button>` : `<span class="no">${i+1}</span>`;
  const chip = w ? (isTorneo() ? `<span class="chip win">Vince ${esc(sideName(m,w))}</span>` : `<span class="chip win">+${p} ${esc(teamShort(w))}</span>`)
             : act ? (editor ? `<span class="chip run">In corso · Bil. <span class="bil" contenteditable="plaintext-only" spellcheck="false" inputmode="numeric" data-bil="${i}" title="Numero del biliardo (facoltativo)">${esc(m.bil||"")}</span></span>`
                           : `<span class="chip run">In corso${m.bil ? ` · Biliardo ${esc(m.bil)}` : ""}</span>`)
             : !hasPts(m) ? `<span class="chip wait">Da giocare</span>` : "";
  let extra = m.defs && m.defs.length>1 && editor ? setsHTML(m, i) : "";
  const setc = m.defs && m.defs.length>1 ? `<span class="setc">Set <b>${m.sw[0]}–${m.sw[1]}</b></span>` : "";
  if(m.kind==="Staffetta"){
    const idx = relayIdx(m), n = m.h.length, done = !!w;
    extra = `<div class="rinfo">${m.h.map((_,f)=>`<span class="${f<idx||done?"d":""} ${!done&&f===idx?"c":""}">${f+1}ª</span>`).join("")}
      ${done ? "Staffetta conclusa" : idx<n-1 ? `Cambio a <b>${(idx+1)*m.step}</b>` : "Ultima frazione"} · vale <b>${p} ${p>1?"punti":"punto"}</b></div>`;
  }
  return `<article class="m ${act?"active":""} ${w ? "won-"+w : ""}${SDS()[0]==="a" ? " sw" : ""}" data-row="${i}">
    <div class="mh">${no}${isTorneo() ? "" : `<span>${esc(m.kind)}</span>`}${specHTML(m,i)}${setc}${chip}${hasPts(m) || (m.defs && m.defs.length>1) ? `<button class="trend" data-tr="${i}" title="${m.defs && m.defs.length>1 ? "Parziali dei set e andamento" : "Andamento del punteggio"}" aria-label="${m.defs && m.defs.length>1 ? "Parziali dei set e andamento" : "Andamento del punteggio"}">${TREND_ICON}</button>` : ""}</div>
    <div class="duel">${SDS().map(sd=>sideHTML(m,i,sd)).join("")}</div>${extra}</article>`;
}
function updText(){
  const p = PUB;
  if(!online) return `<span class="warn">Connessione persa: riconnessione in corso…</span>`;
  if(!p || !p.updatedAt) return "In attesa del primo aggiornamento";
  const d = new Date(p.updatedAt).toLocaleDateString("it-IT",{day:"numeric",month:"numeric",timeZone:"Europe/Rome"});
  const td = new Date().toLocaleDateString("it-IT",{day:"numeric",month:"numeric",timeZone:"Europe/Rome"});
  const when = `<b>${fmtTime(p.updatedAt)}</b>${d!==td?` del ${d}`:""}`;
  return p.stato==="finita" ? `Risultato finale · ultimo aggiornamento alle ${when}` : `Aggiornato alle ${when} · la pagina si aggiorna automaticamente`;
}
function torneoHTML(){
  const c = champion(), n = S.matches.length, fatti = S.matches.filter(m=>winner(m)).length;
  let html = c ? `<section class="champ"><span class="k">🏆 ${esc(c.label)}</span><span class="n">${esc(c.n)}</span></section>` : "";
  html += `<div class="upd">${updText()}</div>`;
  if(!n) html += `<p class="empty">Gli incontri non sono ancora stati inseriti.</p>`;
  let cur = null;
  S.matches.forEach((m,i)=>{ if(m.turno!==cur){ cur = m.turno; if(cur) html += `<h2 class="turno">${esc(cur)}</h2>`; } html += matchHTML(m,i); });
  if(editor) html += `<button class="incbtn" data-inc>✎ ${n ? "Modifica gli incontri" : "Inserisci gli incontri"}</button>`;
  return html;
}
/* ---- torneo con batterie e finali: pagina ---- */
let tabPage = null, doneOpen = false;
function nodeHTML(TB, id){
  const nd = TB.nodes.get(id), [h,a] = nd.sd, w = nd.w, L = TB.live.get(id), rs = S.tab.res[id];
  let info = "";
  if(L){ const m = L.m, lw = winner(m), multi = m.defs && m.defs.length>1;
    info = `<span class="blv${lw ? "" : " on"}">${lw ? "" : "● "}${multi ? "set " + m.sw[0] + "–" + m.sw[1] : m.s[0] + "–" + m.s[1]}${!lw && m.bil ? " · B" + esc(m.bil) : ""}</span>`; }
  else if(rs && rs.txt) info = `<span class="btx">${esc(rs.txt)}</span>`;
  const row = (x, sd) => `<div class="bp ${w ? (w.sd===sd ? "w" : "l") : ""}${x.abs ? " abs" : ""}">${x.tbd ? `<i>${esc(x.lab || "da definire")}</i>` : x.abs ? esc(x.name) : namesCat(x.name)}</div>`;
  return `<div class="bn${L ? " lv" : ""}${w ? " done" : ""}" data-node="${id}"><div class="bnh"><span class="bno">${nd.no}</span>${info}</div>${row(h,"h")}${row(a,"a")}</div>`;
}
function tabPagesHTML(TB){
  if(!TB.pages.length) return "";
  const liveOn = pg => [...pg.acqua, ...pg.rounds.flatMap(x=>x.ids)].some(id=>{ const L = TB.live.get(id); return L && !winner(L.m); });
  if(!TB.pages.some(p=>p.key===tabPage)){
    const lp = TB.pages.find(liveOn), open = TB.pages.find(p=>p.key!=="fin" && !(TB.nodes.get(p.last) || {}).w);
    tabPage = (lp || (TB.pages.length>1 && !open ? TB.pages.find(p=>p.key==="fin") : open) || TB.pages[0]).key;
  }
  const pg = TB.pages.find(p=>p.key===tabPage);
  let html = TB.pages.length<2 ? "" : TB.pages.length<=6
    ? `<div class="pills">${TB.pages.map(p=>`<button class="pill${p.key===tabPage ? " on" : ""}${liveOn(p) ? " lv" : ""}" data-pg="${p.key}">${esc(p.title)}</button>`).join("")}</div>`
    : `<div class="pgnav"><button class="pill" data-pgs="-1" aria-label="Pagina precedente">‹</button><select data-pgsel aria-label="Pagina del tabellone">${TB.pages.map(p=>`<option value="${p.key}"${p.key===tabPage ? " selected" : ""}>${esc(p.title)}${liveOn(p) ? " ●" : ""}</option>`).join("")}</select><button class="pill" data-pgs="1" aria-label="Pagina successiva">›</button></div>`;
  if(pg.full!==pg.title) html += `<div class="bsub">${esc(pg.full)}</div>`;
  if(pg.acqua.length) html += `<div class="bsub">Partite dell'acqua</div><div class="bacq">${pg.acqua.map(id=>nodeHTML(TB, id)).join("")}</div>`;
  const pairs = ids => ids.length===1 ? `<div class="bpair one">${nodeHTML(TB, ids[0])}</div>`
    : ids.reduce((o, id, k)=>k%2 ? o : o + `<div class="bpair">${nodeHTML(TB, id)}${nodeHTML(TB, ids[k+1])}</div>`, "");
  const lw = (TB.nodes.get(pg.last) || {}).w;
  const endLab = pg.key==="fin" ? (S.gioco==="Coppia" ? "Vincitori" : "Vincitore") : "Alle finali";
  html += `<div class="bkwrap"><div class="bk" style="grid-template-columns:repeat(${pg.rounds.length+1},minmax(150px,1fr))">` +
    pg.rounds.map(x=>`<div class="bcol"><div class="bh">${esc(x.label)}</div><div class="bbody">${pairs(x.ids)}</div></div>`).join("") +
    `<div class="bcol"><div class="bh">${endLab}</div><div class="bbody"><div class="bpair one"><div class="bwin${lw && !lw.abs ? "" : " vuoto"}">${lw && !lw.abs ? esc(lw.name) : "—"}</div></div></div></div></div></div>`;
  return html;
}
function tabBoardHTML(){
  const TB = buildTab(S);
  let html = TB.champ ? `<section class="champ"><span class="k">🏆 ${S.gioco==="Coppia" ? "Vincitori" : "Vincitore"}</span><span class="n">${esc(fullNames(TB.champ))}</span></section>` : "";
  html += `<div class="upd">${updText()}</div>`;
  const card = i => `<div class="mlab">${esc(S.matches[i].turno)}</div>` + matchHTML(S.matches[i], i);
  const ids = S.matches.map((_,i)=>i), open = ids.filter(i=>!winner(S.matches[i])), done = ids.filter(i=>winner(S.matches[i]));
  if(open.length) html += `<h2 class="turno">In diretta</h2>` + open.map(card).join("");
  if(done.length) html += `<details class="dn"${doneOpen ? " open" : ""}><summary>Incontri seguiti e conclusi (${done.length})</summary>${done.map(card).join("")}</details>`;
  html += `<h2 class="turno">Tabellone</h2>` + tabPagesHTML(TB);
  if(editor) html += `<p class="hint" style="text-align:center">Tocca un incontro del tabellone per segnare il vincitore o seguirlo in diretta.</p><button class="incbtn" data-tbe>✎ Batterie e finali</button>`;
  return html;
}
function goCard(i){
  let el = app.querySelector(`[data-row="${i}"]`);
  if(el && el.closest("details") && !el.closest("details").open){ doneOpen = true; render(); el = app.querySelector(`[data-row="${i}"]`); }
  if(!el) return; el.scrollIntoView({behavior:"smooth", block:"center"}); el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"), 1600);
}
/* data e ora di inizio sotto il titolo; in regia si correggono qui (valgono dopo PUBBLICA) */
function whenHTML(){
  if(editor) return `<div class="when ed"><label>Data <input type="date" data-gw="data" value="${esc(S.data||"")}" required></label><label>Ora di inizio <input type="time" step="300" data-gw="ora" value="${esc(okOra(S.ora) ? S.ora : "")}"></label></div>`;
  if(!S.data) return "";
  const t = [fmtDateLong(S.data), fmtOra(S.ora)].filter(Boolean).join(" · ");
  return `<div class="when${S.stato==="programmata" ? " prog" : ""}">${S.stato==="programmata" ? (okOra(S.ora) ? "Inizio: " : "In programma ") : ""}${esc(S.stato==="programmata" ? t : t.charAt(0).toUpperCase() + t.slice(1))}</div>`;
}
function boardHTML(){
  const t = totals();
  const badge = S.stato==="finita" ? `<span class="live fin">FINALE</span>` : S.stato==="programmata" ? `<span class="live prog">PROSSIMA</span>` : `<span class="live"><i></i>LIVE</span>`;
  return `<main class="wrap">
    ${REGIA ? "" : `<a class="back" href="${esc(pageURL("") || "?")}">← Tutte le gare</a>`}
    <div class="top"><div>${ed("title","comp","div")}${ed("subtitle","sub","div")}${whenHTML()}</div><div class="badges">${badge}<span id="viewers" class="viewers">${viewersHTML()}</span></div></div>
    ${isTorneo() ? (isTab() ? tabBoardHTML() : torneoHTML()) : (()=>{ const tm = {h:`<div class="team h"><img src="${LOGO_HOME}" alt="Logo ${esc(S.home.name)}">${ed("home.name","tn","div")}${ed("home.city","tc","div")}</div>`,
        a:`<div class="team a">${awayBadge()}${ed("away.name","tn","div")}${ed("away.city","tc","div")}</div>`}, tt = {h:`<span class="h">${t[0]}</span>`, a:`<span class="a">${t[1]}</span>`}, [x,y] = SDS();
      return `<section class="score${x==="a" ? " sw" : ""}" aria-label="Punteggio squadre">${tm[x]}<div class="tot" aria-label="Punti squadra">${tt[x]}<span class="x">–</span>${tt[y]}</div>${tm[y]}</section>` +
        (editor ? `<div class="campo"><button class="ghost" data-campo title="Inverte i lati: a sinistra va sempre la squadra che gioca in casa">${S.trasferta ? "In trasferta" : "In casa"} · ⇄ cambia</button></div>` : ""); })() + `
    `}${isTorneo() ? "" : `
    <div class="upd">${updText()}</div>
    ${S.matches.map(matchHTML).join("")}`}
    <div class="foot">Biliardo Seconda Passione · Bologna</div>
  </main>`;
}

