// ============================================
// UTILITY - usate da itunes-api.js e app.js
// ============================================

// Crea un elemento DOM con classe e testo opzionali (parametri posizionali).
// Niente oggetto-props, niente figli variadici: stile DOM vanilla.
// Attributi (src, alt, id, ...) ed eventi si impostano DOPO la creazione:
//   const img = make('img', 'album-cover'); img.src = url; img.alt = title;
//   btn.addEventListener('click', handler);
function make(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text; // textContent → sicuro contro XSS
  return el;
}

// Aggiunge figli (nodi DOM o stringhe) a un genitore, saltando null/undefined/false.
// Comodo per i casi condizionali. Restituisce il genitore per concatenare.
// NB: questo helper si limita ad aggiungere, non costruisce nulla.
function append(parent, ...children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    parent.append(child); // Node.append accetta nativamente anche le stringhe
  }
  return parent;
}

// Genera copertine SVG come fallback quando manca l'immagine reale
function createCover(text, color1, color2) {
  const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
            <defs>
                <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${color1}"/>
                    <stop offset="100%" stop-color="${color2}"/>
                </linearGradient>
            </defs>
            <rect width="300" height="300" fill="url(#g)"/>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
                  fill="white" font-family="Montserrat, sans-serif" font-weight="900"
                  font-size="40">${text}</text>
        </svg>
    `;
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
