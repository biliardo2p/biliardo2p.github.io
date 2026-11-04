/* Tabellone Live · config.js — Collegamento a Firebase, indirizzo pubblico, logo e dati del circolo
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli:
   così la regia funziona anche aperta dal disco). L'ordine conta. */
/* ================= configurazione ================= */
const FIREBASE = {
  apiKey: "AIzaSyCLGJwf7iRE2L0JnMGgPZLTQY7T2MKewkA",
  authDomain: "biliardo-2p.firebaseapp.com",
  databaseURL: "https://biliardo-2p-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "biliardo-2p",
  storageBucket: "biliardo-2p.firebasestorage.app",
  messagingSenderId: "719151443303",
  appId: "1:719151443303:web:2dbf85a1a4ac862c7653c2"
};
/* indirizzo pubblico della pagina (serve solo quando la regia è aperta come file dal disco) */
const PUBLIC_URL = "https://biliardo2p.github.io/";
const LOGO_HOME = "img/logo.png";
const CLUB = {name:"Biliardo Seconda Passione", short:"Seconda Passione", city:"Bologna · BO"};

