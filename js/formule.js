/* Tabellone Live · formule.js — Incontri dei campionati a squadre (Base, Eccellenza) e tipi di torneo
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* Formule di gara: per una nuova competizione a squadre basta aggiungerne una qui.
   pts = punti squadra per l'incontro vinto; step = cambio in staffetta; opts = specialità scelta all'acchito */
const FORMULE = {
  /* base = ordine della 1ª giornata (22/10/2026): resta solo per le gare già create, non si sceglie più */
  base: {nome:"Campionato Regionale a Squadre di Base", vecchia:true, matches:[
    {kind:"Singolo",  spec:"Italiana",   target:100, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"Filotto 60", target:600, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"Goriziana",  target:400, h:[""], a:[""], pts:1},
    {kind:"Coppia",   spec:"Italiana",   target:120, h:["",""], a:["",""], pts:1},
    {kind:"Coppia",   spec:"Filotto 60", target:800, h:["",""], a:["",""], pts:1},
    {kind:"Staffetta",spec:"Italiana",   target:180, step:60, h:["","",""], a:["","",""], pts:2}
  ]},
  /* dalla 2ª giornata: si gioca due incontri alla volta, gli ultimi due sono Coppia Italiana e Staffetta */
  base2: {nome:"Campionato Regionale a Squadre di Base", matches:[
    {kind:"Singolo",  spec:"Italiana",   target:100, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"Filotto 60", target:600, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"Goriziana",  target:400, h:[""], a:[""], pts:1},
    {kind:"Coppia",   spec:"Filotto 60", target:800, h:["",""], a:["",""], pts:1},
    {kind:"Coppia",   spec:"Italiana",   target:120, h:["",""], a:["",""], pts:1},
    {kind:"Staffetta",spec:"Italiana",   target:180, step:60, h:["","",""], a:["","",""], pts:2}
  ]},
  /* torneo: gli incontri non sono fissi, li scrive la regia (finestra "Incontri del torneo") */
  /* tabellone: batterie da 8 (3 turni) + finali (con eventuali partite dell'acqua); gli incontri si seguono in diretta a scelta */
  tabellone: {nome:"Torneo con batterie e finali", torneo:true, tab:true, matches:[]},
  torneo: {nome:"Torneo a incontri liberi (senza tabellone)", torneo:true, matches:[]},
  /* partite singole: uno o pochi incontri di un torneo (anche di altri), senza tabellone; di solito visibili solo con il link */
  singole: {nome:"Partite singole", torneo:true, singole:true, matches:[]},
  eccellenza: {nome:"Campionato Regionale a Squadre di Eccellenza", matches:[
    {kind:"Singolo",  spec:"Filotto 60", target:600, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"5 Birilli",  target:120, h:[""], a:[""], pts:1},
    {kind:"Singolo",  spec:"Goriziana",  target:500, h:[""], a:[""], pts:1},
    {kind:"Coppia",   spec:"", target:0, opt:-1, opts:[{spec:"5 Birilli",target:130},{spec:"Goriziana",target:500},{spec:"Filotto 60",target:800}], h:["",""], a:["",""], pts:1},
    {kind:"Staffetta",spec:"5 Birilli",  target:250, step:50, h:["","","","",""], a:["","","","",""], pts:1}
  ]}
};

