// ============================================
// THEME SWITCHER — palette colori personalizzabile
//
// Questo file viene caricato in <head>, PRIMA che il <body> venga disegnato.
// La riga "applyTheme(getSavedThemeId())" in fondo al file viene quindi
// eseguita immediatamente al parsing dello script: il tema salvato viene
// applicato prima che la pagina sia visibile, così l'utente non vede mai
// un flash del tema verde di default prima di quello scelto (FOUC).
// ============================================

// Ogni tema ridefinisce le variabili CSS dichiarate in :root dentro style.css.
// "--spotify-green/-hover" = colore d'accento (bottoni, like, barra avanzamento).
// "--spotify-dark/-dark-gray/-gray/--sidebar-bg/--player-bg" = tonalità di sfondo.
const THEMES = [
  {
    id: "default",
    name: "Spotify Green",
    vars: {
      "--spotify-green": "#1db954",
      "--spotify-green-hover": "#1ed760",
      "--spotify-dark": "#121212",
      "--spotify-dark-gray": "#181818",
      "--spotify-gray": "#282828",
      "--sidebar-bg": "#000000",
      "--player-bg": "#181818",
      "--topbar-bg": "rgba(0, 0, 0, 0.5)",
    },
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    vars: {
      "--spotify-green": "#1db4e0",
      "--spotify-green-hover": "#33c4ee",
      "--spotify-dark": "#0d1620",
      "--spotify-dark-gray": "#13202c",
      "--spotify-gray": "#1c3142",
      "--sidebar-bg": "#081019",
      "--player-bg": "#13202c",
      "--topbar-bg": "rgba(8, 16, 25, 0.5)",
    },
  },
  {
    id: "purple",
    name: "Royal Purple",
    vars: {
      "--spotify-green": "#a259ff",
      "--spotify-green-hover": "#b87bff",
      "--spotify-dark": "#150f1f",
      "--spotify-dark-gray": "#1d1428",
      "--spotify-gray": "#2b1f3b",
      "--sidebar-bg": "#0d0815",
      "--player-bg": "#1d1428",
      "--topbar-bg": "rgba(13, 8, 21, 0.5)",
    },
  },
  {
    id: "sunset",
    name: "Sunset Orange",
    vars: {
      "--spotify-green": "#ff7a3d",
      "--spotify-green-hover": "#ff9460",
      "--spotify-dark": "#1f1410",
      "--spotify-dark-gray": "#271a14",
      "--spotify-gray": "#3a2a1f",
      "--sidebar-bg": "#140d0a",
      "--player-bg": "#271a14",
      "--topbar-bg": "rgba(20, 13, 10, 0.5)",
    },
  },
  {
    id: "ruby",
    name: "Ruby Red",
    vars: {
      "--spotify-green": "#e0314f",
      "--spotify-green-hover": "#ec5670",
      "--spotify-dark": "#1a0e10",
      "--spotify-dark-gray": "#251418",
      "--spotify-gray": "#371d22",
      "--sidebar-bg": "#11080a",
      "--player-bg": "#251418",
      "--topbar-bg": "rgba(17, 8, 10, 0.5)",
    },
  },
  {
    id: "mono",
    name: "Dario Mode",
    vars: {
      "--spotify-green": "#e5e5e5",
      "--spotify-green-hover": "#ffffff",
      "--spotify-dark": "#101010",
      "--spotify-dark-gray": "#181818",
      "--spotify-gray": "#2a2a2a",
      "--sidebar-bg": "#000000",
      "--player-bg": "#181818",
      "--topbar-bg": "rgba(0, 0, 0, 0.5)",
    },
  },
  {
    id: "nicky",
    name: "Nicole",
    vars: {
      "--spotify-green": "#ff00b7",
      "--spotify-green-hover": "#ff85f7",
      "--spotify-dark": "#a47d99",
      "--spotify-dark-gray": "#8e48c0",
      "--spotify-gray": "#2a2a2a",
      "--sidebar-bg": "#93508c",
      "--player-bg": "#8e48c0",
      "--topbar-bg": "rgba(147, 80, 140, 0.5)",
    },
  },
];

const _THEME_STORAGE_KEY = "color_theme";
const _DEFAULT_THEME_ID = "default";

// Legge l'id del tema salvato in precedenza. Se l'utente non ha mai scelto
// un tema (prima visita, o localStorage svuotato) ricade sul tema di default.
function getSavedThemeId() {
  return localStorage.getItem(_THEME_STORAGE_KEY) || _DEFAULT_THEME_ID;
}

// Applica un tema impostando le sue variabili come STILE INLINE su <html>.
// Lo stile inline ha sempre priorità sulle regole scritte in style.css
// (indipendentemente dall'ordine di caricamento), quindi sovrascrive i
// valori di default dichiarati in :root senza dover toccare il CSS.
function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const rootStyle = document.documentElement.style;

  Object.entries(theme.vars).forEach(([varName, value]) => {
    rootStyle.setProperty(varName, value);
  });

  // Salva la scelta: al prossimo caricamento di QUALSIASI pagina, la riga
  // qui sotto (applyTheme(getSavedThemeId())) la ritroverà e la riapplicherà.
  localStorage.setItem(_THEME_STORAGE_KEY, theme.id);
  return theme;
}

// Eseguito subito, al momento in cui il browser interpreta questo script
// (siamo ancora dentro <head>, il <body> non è stato disegnato).
applyTheme(getSavedThemeId());

// ============================================
// UI: bottone "tavolozza" + modale di scelta tema
//
// A differenza di applyTheme() (che deve girare subito in <head>), questa
// parte ha bisogno che il <body> esista già (bottone #themeBtn, modale
// #themeModal). Per questo NON viene eseguita qui, ma esposta come funzione
// e richiamata da initShell() in app.js, quando il DOM è pronto.
// ============================================
function setupThemeSwitcher() {
  const themeBtn = document.getElementById("themeBtn");
  const grid = document.getElementById("themeSwatchGrid");
  // Pagine senza switcher (es. login.html, che carica theme.js solo per
  // applicare i colori salvati ma non ha il bottone/modale): esce silenziosamente.
  if (!themeBtn || !grid) return;

  renderThemeSwatches(grid);

  themeBtn.addEventListener("click", () => {
    new bootstrap.Modal(document.getElementById("themeModal")).show();
  });
}

// Costruisce dentro `grid` un pallino cliccabile per ogni tema disponibile
// e marca con la classe "active" quello attualmente in uso.
function renderThemeSwatches(grid) {
  const activeId = getSavedThemeId();

  const swatches = THEMES.map((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-swatch" + (theme.id === activeId ? " active" : "");
    btn.dataset.themeId = theme.id;

    // Pallino diviso a metà tra colore d'accento e sfondo: dà un'idea
    // immediata di come cambierà l'interfaccia scegliendo questo tema.
    const colorDot = document.createElement("span");
    colorDot.className = "theme-swatch-color";
    colorDot.style.background =
      "linear-gradient(135deg, " +
      theme.vars["--spotify-green"] +
      " 50%, " +
      theme.vars["--spotify-dark-gray"] +
      " 50%)";

    const check = document.createElement("i");
    check.className = "bi bi-check-circle-fill theme-swatch-check";
    colorDot.append(check);

    const label = document.createElement("span");
    label.className = "theme-swatch-label";
    label.textContent = theme.name;

    btn.append(colorDot, label);

    btn.addEventListener("click", () => {
      applyTheme(theme.id);
      // Sposta la classe "active" sul pallino appena cliccato senza
      // dover ridisegnare tutta la griglia
      grid
        .querySelectorAll(".theme-swatch.active")
        .forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
    });

    return btn;
  });

  grid.replaceChildren(...swatches);
}
