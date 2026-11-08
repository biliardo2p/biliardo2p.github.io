/* Tabellone Live · vista-elenco.js — Elenco delle gare
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= vista elenco gare ================= */
/* pulsante "Partite in corso" nella home pubblica: gare in diretta, anche quelle solo con il link (mai le prove); porta al link fisso ?live */
function liveBtnHTML(idx){
  const L = Object.values(idx||{}).filter(g=>g && g.stato==="live" && visOf(g)!=="prova");
  if(!L.length) return "";
  const t = L.length===1 ? [L[0].titolo, L[0].sottotitolo].filter(Boolean).join(" · ") : L.map(g=>g.titolo).filter(Boolean).join(" · ");
  return `<a class="golive" href="?live"><span class="live"><i></i>LIVE</span><span class="gl-t"><b>${L.length===1 ? "Partita in corso" : L.length + " partite in corso"}</b><span>${esc(t)}</span></span><span class="gl-go">Guarda la diretta ›</span></a>`;
}
function listHTML(idx, forRegia){
  const items = Object.entries(idx||{}).map(([id,m])=>Object.assign({id}, m)).filter(g=>forRegia || visOf(g)==="pub")   /* gare "solo con il link" e di prova: solo in regia */
    .sort((a,b)=> (b.data||"").localeCompare(a.data||"") || (b.aggiornato||0)-(a.aggiornato||0));
  const card = g => {
    const st = (visOf(g)==="prova" ? `<span class="chip prova">PROVA</span>` : visOf(g)==="link" ? `<span class="chip prova lnk">SOLO LINK</span>` : "") + (g.stato==="live" ? `<span class="chip run">LIVE</span>` : g.stato==="finita" ? `<span class="chip wait">Finale</span>` : `<span class="chip wait">In programma</span>`);
    const p = arr(g.punti);
    const href = forRegia ? `?regia&gara=${g.id}` : `?gara=${g.id}`;
    return (forRegia ? `<div class="gwrap">` : "") + `<a class="gcard" href="${href}"><div class="gtop"><span>${esc([fmtDate(g.data), g.stato==="programmata" ? fmtOra(g.ora) : ""].filter(Boolean).join(" · "))}</span>${st}</div>
      <div class="gtit">${esc(g.titolo)}</div><div class="gsub">${esc(g.sottotitolo)}</div>
      ${g.tipo==="torneo" ? `<div class="gvs t">${g.vincitore ? `🏆 <b>${esc(g.vincitore)}</b>` : `${+g.fatti||0} incontri conclusi su ${+g.totale||0}`}</div>`
        : g.trasferta ? `<div class="gvs"><span class="a">${esc(g.ospite)}</span><b>${+p[1]||0} – ${+p[0]||0}</b><span class="h">${esc(g.casa)}</span></div>`
        : `<div class="gvs"><span class="h">${esc(g.casa)}</span><b>${+p[0]||0} – ${+p[1]||0}</b><span class="a">${esc(g.ospite)}</span></div>`}</a>` + (forRegia ? delBtnHTML(g) + `</div>` : "");
  };
  return items.length ? `<div class="glist">${items.map(card).join("")}</div>` : `<p class="empty">Nessuna gara ancora pubblicata. Le dirette compariranno qui.</p>`;
}

