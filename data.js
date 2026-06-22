// ============================================
// UTILITY - usate da itunes-api.js e app.js
// ============================================


// Crea un elemento DOM con props e figli opzionali.
// Props: { class, text, style (stringa CSS o oggetto), onX (fn → addEventListener), attributi... }
function make(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (k === 'class')                                    el.className = v;
        else if (k === 'text')                                el.textContent = v;
        else if (k === 'style' && typeof v === 'object')      Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else                                                  el.setAttribute(k, v);
    }
    el.append(...[children].flat(2).filter(c => c != null && c !== false));
    return el;
}

// Genera copertine SVG come fallback quando Spotify non ha immagini
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
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}