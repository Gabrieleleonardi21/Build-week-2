# 🎶 Spotify Clone

Un'esperienza Spotify ricreata da zero: tema scuro, player funzionante e ricerca musicale in tempo reale, il tutto con puro HTML, CSS e JavaScript. Nessun framework da installare, nessuna registrazione richiesta — i brani, gli album e le anteprime audio arrivano direttamente dalla iTunes Search API di Apple.

---

## 💻 Demo rapida

1. Apri `login.html` in un browser moderno (o usa un server locale — vedi sotto)
2. Inserisci qualsiasi nome utente e clicca **ACCEDI**
3. Esplora, cerca, ascolta le anteprime da 30 secondi

> **Nota:** aprire i file HTML con doppio clic potrebbe bloccare l'audio in alcuni browser.
> Per evitarlo, usa l'estensione **Live Server** di VS Code: apri la cartella del progetto in VS Code e clicca **Go Live** in basso a destra.

---

## 📋 Funzionalità

### Autenticazione

- Login con qualsiasi nome utente (nessuna registrazione)
- Auto-login al riavvio tramite `localStorage`
- Modifica nome utente e foto profilo (upload da file locale)
- Logout dal profilo

### Home

- Saluto dinamico (Buongiorno / Buon pomeriggio / Buonasera)
- Quick-grid con 6 playlist in evidenza
- Sezione "Playlist in evidenza" con 8 playlist virtuali
- Sezione "Album popolari" caricata da iTunes in tempo reale
- Pulsante play rapido su ogni card (hover)

### Ricerca

- Barra di ricerca con debounce 400 ms
- Risultati in tempo reale: brani + album da iTunes API
- Griglia di 12 generi musicali (Pop, Rock, Hip Hop, Jazz…)
- Click su un genere → lista brani reali da iTunes

### Player musicale

- Anteprima audio reale da 30 secondi
- Play / Pausa, brano precedente / successivo
- Seek sulla barra di avanzamento
- Shuffle e Repeat
- Controllo volume con mute
- Icona 🔇 sui brani senza anteprima disponibile

### Brani che ti piacciono

- Like/Unlike su qualsiasi brano (dalla tracklist o dal player)
- Persistenti tra sessioni via `localStorage`
- Pagina dedicata con lista completa

### Libreria & Playlist utente

- Crea playlist con nome personalizzato
- Playlist salvate in `localStorage`
- Sidebar con accesso diretto a ogni playlist

---

## 🧾 Struttura del progetto

```
├── login.html           Schermata di accesso
├── home.html            Home page
├── search.html          Ricerca e generi
├── liked.html           Brani che ti piacciono
└── assets/
    ├── css/
    │   └── style.css    Tema scuro, layout, componenti
    └── js/
        ├── data.js          Utility: make(), createCover(), formatDuration()
        ├── itunes-api.js    Wrapper iTunes Search API + normalizzatori
        ├── app.js           Logica condivisa (player, like, playlist)
        ├── home.js          Rendering Home
        ├── search.js        Rendering Ricerca
        ├── liked.js         Rendering Brani salvati
        └── login.js         Gestione login
```

---

## 📱 Tecnologie

| Tecnologia                       | Utilizzo                                  |
| -------------------------------- | ----------------------------------------- |
| HTML5 / CSS3 / JavaScript ES2020 | Base del progetto (vanilla, no framework) |
| Bootstrap 5.3                    | Layout e componenti UI                    |
| Bootstrap Icons 1.11             | Icone                                     |
| Google Fonts — Montserrat        | Tipografia                                |
| iTunes Search API                | Dati musicali (gratuita, zero API key)    |
| Web Audio API (`<audio>`)        | Riproduzione anteprime                    |
| `localStorage`                   | Persistenza like, playlist, profilo       |

---

## Architettura

Il progetto è una **multi-page application** con un file HTML per ogni schermata. La logica condivisa (player, like, playlist utente) vive in `app.js`; ogni pagina ha il proprio file JS dedicato.

### Helper DOM — `make(tag, className, text)` e `append(parent, ...children)`

Due utility in `data.js` che sostituiscono `innerHTML`. `make()` crea un elemento con classe e testo opzionali — il testo passa sempre per `textContent` (XSS-safe). Attributi ed eventi si impostano dopo la creazione. `append()` aggiunge figli a un genitore saltando automaticamente i valori `null`/`false`, utile per i nodi condizionali.

### Cache API — `_cache`

Oggetto `chiave → Promise` in memoria che evita di ripetere la stessa chiamata iTunes nella stessa sessione.

### Track Registry — `_trackRegistry`

`Map<id, TrackObject>` popolata ad ogni render della tracklist. Permette a `toggleLike` e `playTrackInList` di recuperare l'oggetto brano completo a partire dall'id, senza serializzare dati negli attributi HTML.

---

## 🧰 Limiti tecnici

- **Anteprime da 30 s**: iTunes fornisce solo preview; le tracce senza preview mostrano 🔇
- **Nessun backend**: utenti, password e playlist esistono solo nel `localStorage` del browser
- **Cache in memoria**: si azzera ad ogni ricarica della pagina
- **CORS audio**: alcune CDN Apple potrebbero avere restrizioni in certi browser

---

## 🪛 Miglioramenti futuri

- [ ] Integrazione Spotify Web API con OAuth PKCE (riproduzione completa)
- [ ] "Aggiungi a playlist" dal menu contestuale di ogni brano
- [ ] Pagina artista con discografia e artisti simili
- [ ] Coda di riproduzione visibile e modificabile
- [ ] PWA con Service Worker per uso offline
- [ ] Tema chiaro e cambio colore accento
- [ ] Navigazione completa da tastiera (accessibilità ARIA)
- [ ] Test unitari e E2E (Playwright / Cypress)

---

## 📌 Crediti

- Dati musicali: [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) (Apple Inc.)
- UI ispirata a: Spotify Web Player
- Icone: Bootstrap Icons
- Font: Montserrat (Google Fonts)
