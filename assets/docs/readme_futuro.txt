============================================================
SPOTIFY CLONE — README
============================================================

Un clone fedele dell'interfaccia di Spotify, costruito
con HTML, CSS e JavaScript puro. Nessun framework,
nessuna dipendenza da installare, nessuna registrazione
richiesta. I dati musicali reali (brani, album, copertine,
anteprime audio) provengono dalla iTunes Search API di Apple.

------------------------------------------------------------
DEMO RAPIDA
------------------------------------------------------------
1. Apri index.html in un browser moderno
2. Inserisci qualsiasi nome utente e clicca ACCEDI
3. Esplora, cerca, ascolta le anteprime da 30 secondi

------------------------------------------------------------
TECNOLOGIE
------------------------------------------------------------
- HTML5 / CSS3 / JavaScript ES2020 (vanilla, no framework)
- Bootstrap 5.3 (layout e componenti UI)
- Bootstrap Icons 1.11 (icone)
- Google Fonts — Montserrat
- iTunes Search API (dati musicali, zero API key)
- Web Audio API — elemento <audio> nativo per le anteprime
- localStorage (persistenza like, playlist, profilo)

------------------------------------------------------------
STRUTTURA FILE
------------------------------------------------------------
  index.html        Struttura HTML dell'app
  style.css         Tema scuro, layout, componenti
  app.js            Logica dell'applicazione
  itunes-api.js     Wrapper iTunes Search API + normalizzatori
  data.js           Utility: make(), createCover(), formatDuration()

------------------------------------------------------------
COME FUNZIONA
------------------------------------------------------------
L'app usa un'architettura SPA (Single Page Application)
senza router esterno. La funzione showPage() gestisce la
navigazione sostituendo il contenuto del div #contentArea
tramite replaceChildren() — mai innerHTML con dati dinamici.

Tutti gli elementi DOM vengono costruiti con la funzione
make(tag, props, ...children) definita in data.js. Accetta
classi, testo, stili e handler come props, e appende i figli
automaticamente. I testi dinamici passano sempre per
textContent (XSS-safe by default); gli event listener
vengono registrati con addEventListener, senza onclick inline.

Le chiamate API sono asincrone (async/await) con una cache
in memoria (_cache) per non ripetere la stessa richiesta.
I dati vengono normalizzati da formato iTunes al formato
interno dell'app tramite normalizeTrack() e normalizeAlbum().

Il player usa l'elemento <audio> HTML5: riproduce i
preview_url di 30 secondi forniti da iTunes gratuitamente.

------------------------------------------------------------
ARCHITETTURA INTERNA
------------------------------------------------------------
make(tag, props, ...children)
  Utility centrale in data.js. Riduce la ripetizione nella
  costruzione del DOM. Props speciali: class → className,
  text → textContent, style oggetto → Object.assign(el.style),
  onX funzione → addEventListener.

renderTrackList(tracks) / makeTrackRow(track, index, ids)
  renderTrackList registra i track nel _trackRegistry globale
  e delega ogni riga a makeTrackRow. Il doppio click chiude
  su ids (array di id) via closure — nessun JSON serializzato
  negli attributi HTML.

makePlaylistHeader(coverSrc, type, title, ...metaNodes)
  Helper condiviso da renderAlbum, renderPlaylist,
  renderUserPlaylist e renderLikedTracks per evitare
  la ripetizione dell'intestazione con copertina.

makeCard(cover, title, description, page)
  Card cliccabile per album e playlist. Ritorna un DOM element
  (non una stringa HTML), con play overlay integrato.

_trackRegistry = Map<id, TrackObject>
  Popolato da renderTrackList a ogni render. Permette a
  toggleLike e playTrackInList di recuperare l'oggetto
  track completo a partire dall'id.

------------------------------------------------------------
MIGLIORAMENTI FUTURI
------------------------------------------------------------

[ ] AUTENTICAZIONE REALE
    Integrare Spotify Web API con OAuth PKCE per:
    - Riproduzione completa dei brani (Spotify Premium)
    - Sincronizzazione like con la libreria Spotify
    - Accesso alle playlist personali dell'utente
    - Top chart personalizzati

[ ] AGGIUNTA BRANI ALLE PLAYLIST
    Bottone "Aggiungi a playlist" nel menu contestuale
    di ogni brano (tasto destro o icona tre puntini)

[ ] PAGINA ARTISTA
    - Discografia completa
    - Brani più popolari
    - Artisti simili

[ ] PLAYER MIGLIORATO
    - Visualizzazione testi (Lyrics) tramite API esterna
    - Coda di riproduzione visibile e modificabile
    - Mini-player in mobile con swipe per cambiare brano
    - Crossfade tra brani

[ ] RICERCA AVANZATA
    - Filtri per genere, anno, durata
    - Ricerca per artista con pagina dedicata
    - Suggerimenti di ricerca in tempo reale

[ ] OFFLINE / PWA
    - Service Worker per funzionamento offline
    - Installabile come app sul desktop e mobile
    - Cache delle copertine già visualizzate

[ ] TEMI
    - Tema chiaro
    - Cambio colore accento (non solo verde Spotify)

[ ] BACKEND OPZIONALE
    - Server Node.js/Python per aggirare i limiti CORS
    - Database per salvare like e playlist nel cloud
    - Sistema di account multi-utente reale

[ ] ACCESSIBILITÀ
    - Navigazione completa da tastiera
    - Attributi ARIA sugli elementi interattivi
    - Supporto screen reader

[ ] TEST
    - Unit test per le funzioni di normalizzazione dati
    - Test di integrazione per le chiamate API
    - Test E2E con Playwright o Cypress

------------------------------------------------------------
NOTE TECNICHE
------------------------------------------------------------
- Le anteprime di 30s sono fornite gratuitamente da iTunes
  e non richiedono autenticazione. Non tutti i brani hanno
  un preview_url: in quel caso compare l'icona 🔇.

- La cache in memoria viene azzerata ad ogni ricarica
  della pagina. Per una cache persistente si potrebbe
  usare sessionStorage o un Service Worker.

- L'app funziona aprendo index.html direttamente dal
  filesystem (file://) oppure tramite un server locale
  (es. VS Code Live Server, python -m http.server).

- Il rendering non usa mai innerHTML con dati dinamici.
  Tutti i contenuti passano per textContent o setAttribute,
  rendendo l'app immune agli attacchi XSS.

------------------------------------------------------------
CREDITI
------------------------------------------------------------
- Dati musicali: iTunes Search API (Apple Inc.)
- UI ispirata a: Spotify Web Player
- Icone: Bootstrap Icons
- Font: Montserrat (Google Fonts)

