/* Tabellone Live · regia-barra.js — Barra di regia: comandi, scorciatoie da tastiera
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* lo spazio in fondo alla pagina segue l'altezza reale della barra di regia (su telefono va a capo su più righe) */
try{ new ResizeObserver(()=>document.body.style.setProperty("--rbh", $("#rbar").offsetHeight+"px")).observe($("#rbar")); }catch(err){}
$("#rbar").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  const r = b.dataset.r;
  if(r==="pub") publish();
  else if(r==="disc") discard();
  else if(r==="more"){ barOpen = !barOpen; renderBar(); }
  else if(r==="inc") openInc();
  else if(r==="tbe") openTbe();
  else if(r==="reset") resetScores();
  else if(r==="prog"){
    if(Date.now()-armP > 4000){ armP = Date.now(); renderBar(); setTimeout(renderBar, 4100); }
    else { armP = 0; snapshot();
      S.matches.forEach(m=>{ m.s=[0,0]; if(m.ph){ m.ph=m.ph.map(()=>0); m.pa=m.pa.map(()=>0); } if(m.opts){ m.opt=-1; m.spec=""; m.target=0; } if(m.ss){ m.ss = m.ss.map(()=>[0,0]); m.ch = m.ch.map(()=>-1); } });
      S.inCorso = []; S.stato = "programmata"; if(S.tab) S.tab.res = {}; S = normalize(S); publish({stato:"programmata"}); }
  }
  else if(r==="end"){ snapshot(); S.stato = S.stato==="finita" ? "live" : "finita"; S.inCorso = S.stato==="finita" ? [] : S.inCorso; publish(); }
  else if(r==="copy"){ const t = $("#puburl").textContent;
    try{ navigator.clipboard.writeText(t).then(()=>setFlash("Link copiato"), ()=>selectUrl()); }catch(err){ selectUrl(); } }
  b.blur();
});
function selectUrl(){ const r = document.createRange(); r.selectNodeContents($("#puburl")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
document.addEventListener("keydown", e=>{
  if(!editor || mode!=="board") return;
  const ae = document.activeElement; if(ae && (ae.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(ae.tagName))) return;
  const k = e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey) && k==="z"){ undo(); e.preventDefault(); }
  else if(/^[1-9]$/.test(k) && +k<=S.matches.length){ toggleAct(+k-1); }
  else if(k==="0"){ snapshot(); S.inCorso = []; commit(); }
  else if(k==="p"){ publish(); }
});

