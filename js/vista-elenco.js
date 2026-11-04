/* Tabellone Live · vista-elenco.js — Elenco delle gare
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= vista elenco gare ================= */
function listHTML(idx, forRegia){
  const items = Object.entries(idx||{}).map(([id,m])=>Object.assign({id}, m))
    .sort((a,b)=> (b.data||"").localeCompare(a.data||"") || (b.aggiornato||0)-(a.aggiornato||0));
  const card = g => {
    const st = g.stato==="live" ? `<span class="chip run">LIVE</span>` : g.stato==="finita" ? `<span class="chip wait">Finale</span>` : `<span class="chip wait">In programma</span>`;
    const p = arr(g.punti);
    const href = forRegia ? `?regia&gara=${g.id}` : `?gara=${g.id}`;
    return (forRegia ? `<div class="gwrap">` : "") + `<a class="gcard" href="${href}"><div class="gtop"><span>${esc(fmtDate(g.data))}</span>${st}</div>
      <div class="gtit">${esc(g.titolo)}</div><div class="gsub">${esc(g.sottotitolo)}</div>
      ${g.tipo==="torneo" ? `<div class="gvs t">${g.vincitore ? `🏆 <b>${esc(g.vincitore)}</b>` : `${+g.fatti||0} incontri conclusi su ${+g.totale||0}`}</div>`
        : g.trasferta ? `<div class="gvs"><span class="a">${esc(g.ospite)}</span><b>${+p[1]||0} – ${+p[0]||0}</b><span class="h">${esc(g.casa)}</span></div>`
        : `<div class="gvs"><span class="h">${esc(g.casa)}</span><b>${+p[0]||0} – ${+p[1]||0}</b><span class="a">${esc(g.ospite)}</span></div>`}</a>` + (forRegia ? delBtnHTML(g) + `</div>` : "");
  };
  return items.length ? `<div class="glist">${items.map(card).join("")}</div>` : `<p class="empty">Nessuna gara ancora pubblicata. Le dirette compariranno qui.</p>`;
}

