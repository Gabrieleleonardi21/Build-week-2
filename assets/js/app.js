// ============================================
// SPOTIFY CLONE — SHELL CONDIVISA (MPA)
// Caricata su home.html, search.html, liked.html
// ============================================

// STATO APPLICAZIONE
const state = {
  displayName: null,
  profilePhoto: null,
  bio: null,
  location: null,
  joinDate: null,
  currentTrack: null,
  currentPlaylist: [],
  currentIndex: 0,
  isPlaying: false,
  isShuffle: false,
  isRepeat: false,
  volume: 0.7,
  likedTracks: new Map(), // Map<id, TrackObject> — persistito in localStorage
  userPlaylists: [], // [{ id, name, tracks: [] }] — persistito in localStorage
  recentTracks: [], //Salva i recenti in localStorage e li mostra in Home
  currentPage: null, // sub-pagina attiva (album-123, genre-Pop, profile, ecc.) — null = pagina default
  lastSearchQuery: "", // ultima query di ricerca, ripristinata al refresh della pagina search
};

// Elemento audio HTML5 per le anteprime 30s
const audio = document.getElementById("audioPlayer");

// Registro globale dei track renderizzati — usato da toggleLike e playTrackInList
const _trackRegistry = new Map();

// Picture-in-Picture: finestra remota e cache dei suoi riferimenti DOM (null = PiP chiusa)
let pipWindow = null;
let pipEls = null;

// Timer per distinguere click singolo (apri modale) da doppio click (riproduci)
let _trackDetailTimer = null;

//


// Cache per le risposte API — evita chiamate duplicate e fa da fallback
// quando l'API iTunes è irraggiungibile o limita le richieste (HTTP 403).
// Livelli: 1) memoria  2) localStorage entro la TTL  3) chiamata API
// In caso di errore di rete usa il dato salvato in localStorage, anche se scaduto.
const _cache = {};
const _CACHE_PREFIX = "apicache_";
const _CACHE_TTL = 1000 * 60 * 60 * 24; // 24h: il catalogo musicale cambia di rado

function _readCache(key) {
  try {
    const raw = localStorage.getItem(_CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw); // { t: timestamp, v: valore }
  } catch (_) {
    return null;
  }
}

function _writeCache(key, value) {
  try {
    localStorage.setItem(
      _CACHE_PREFIX + key,
      JSON.stringify({ t: Date.now(), v: value }),
    );
  } catch (_) {
    // quota piena o storage non disponibile: resta comunque la cache in memoria
  }
}

async function cached(key, fn) {
  // 1) cache in memoria (sessione corrente)
  if (_cache[key]) return _cache[key];

  // 2) cache su localStorage ancora valida: evita del tutto la chiamata API
  const stored = _readCache(key);
  if (stored && Date.now() - stored.t < _CACHE_TTL) {
    _cache[key] = stored.v;
    return stored.v;
  }

  // 3) chiamata API; se fallisce, ripiega sul dato salvato (anche scaduto)
  try {
    const value = await fn();
    _cache[key] = value;
    _writeCache(key, value);
    return value;
  } catch (e) {
    if (stored) {
      _cache[key] = stored.v;
      return stored.v;
    }
    throw e; // nessun fallback disponibile
  }
}

// Mappa delle pagine principali con i file HTML corrispondenti
const _MAIN_PAGES = {
  home: "home.html",
  search: "search.html",
  liked: "liked.html",
  library: "home.html", // libreria assorbita dalla home nella MPA
};

// ============================================
// PERSISTENZA localStorage
// ============================================

function loadPersistedData() {
  const liked = JSON.parse(localStorage.getItem("liked_tracks") || "[]");
  state.likedTracks = new Map(liked);
  state.userPlaylists = JSON.parse(
    localStorage.getItem("user_playlists") || "[]",
  );
  state.recentTracks = JSON.parse(
    localStorage.getItem("recent_tracks") || "[]"
  );
  state.profilePhoto = localStorage.getItem("profile_photo") || null;
  state.displayName = localStorage.getItem("display_name");
  state.bio = localStorage.getItem("profile_bio") || null;
  state.location = localStorage.getItem("profile_location") || null;
  if (!localStorage.getItem("profile_join_date")) {
    localStorage.setItem("profile_join_date", new Date().toISOString());
  }
  state.joinDate = localStorage.getItem("profile_join_date");
}

function saveLikedTracks() {
  localStorage.setItem(
    "liked_tracks",
    JSON.stringify([...state.likedTracks.entries()]),
  );
}

function saveUserPlaylists() {
  localStorage.setItem("user_playlists", JSON.stringify(state.userPlaylists));
}

function saveRecentTracks() {
  localStorage.setItem(
    "recent_tracks",
    JSON.stringify(state.recentTracks)
  );
}

function addRecentTrack(track) {
  if (!track) return;
  state.recentTracks = state.recentTracks.filter(
    t => t.id !== track.id
  );
  state.recentTracks.unshift(track);
  if (state.recentTracks.length > 10) {
    state.recentTracks = state.recentTracks.slice(0, 10);
  }
  saveRecentTracks();
}

// ============================================
// INIT SHELL
// pageRenderer(container) — il renderer della pagina specifica (home/search/liked)
// ============================================
function initShell(pageRenderer) {
  window._pageRenderer = pageRenderer;
  updateUserMenu();
  setupPlayer();
  setupPip();
  setupNavigation();
  setupThemeSwitcher(); // bottone tavolozza + modale (assets/js/theme.js)
  renderUserPlaylists();
  restorePlayerState();
}

// Ripristina l'UI del player dall'ultima sessione senza riavviare l'audio
function restorePlayerState() {
  const saved = localStorage.getItem("current_track");
  if (!saved) return;
  try {
    const track = JSON.parse(saved);
    state.currentTrack = track;
    document.getElementById("playerTitle").textContent = track.title;
    document.getElementById("playerArtist").textContent = track.artist;
    const cover = document.getElementById("playerCover");
    cover.src = track.cover;
    cover.style.display = "block";
    document.getElementById("totalTime").textContent = formatDuration(
      track.duration,
    );
    updateLikeBtn();
  } catch (_) { }
}

// ============================================
// NAVIGAZIONE MPA
// ============================================

function navigateTo(page, pushHistory = true) {
  // Pagine principali: naviga tramite href, il browser ricarica la pagina corretta
  if (_MAIN_PAGES[page]) {
    location.href = _MAIN_PAGES[page];
    return;
  }

  // Sub-pagine (album, genre, playlist, profile): renderizzate nel contenuto attuale
  if (pushHistory)
    history.pushState({ page }, "", "#" + encodeURIComponent(page));
  showPage(page);
  updateActiveNav(page);
}

// Aggiorna l'evidenziazione nella sidebar — solo per le pagine principali
function updateActiveNav(page) {
  if (!_MAIN_PAGES[page]) return;
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === page);
  });
}

function setupNavigation() {
  // Imposta l'active link in base al file corrente (ridondante ma robusto pre-JS)
  const file = window.location.pathname.split("/").pop() || "home.html";
  const PAGE_FOR_FILE = {
    "home.html": "home",
    "search.html": "search",
    "liked.html": "liked",
  };
  const activePage = PAGE_FOR_FILE[file] || "home";
  document.querySelectorAll(".nav-link[data-page]").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activePage);

    // Se il link punta al file su cui siamo già, ri-renderizza in-place invece
    // di ricaricare la pagina: evita reload inutili e di ri-chiamare l'API.
    const target = _MAIN_PAGES[link.dataset.page];
    if (target === file) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        history.replaceState(null, "", target); // rimuove eventuale #sub-pagina
        updateActiveNav(link.dataset.page);
        renderCurrentMainPage();
      });
    }
  });

  // Gli altri link principali usano href nativi — nessun listener JS
  document
    .getElementById("backBtn")
    .addEventListener("click", () => window.history.back());
  document
    .getElementById("forwardBtn")
    .addEventListener("click", () => window.history.forward());
  document
    .getElementById("logoBtn")
    .addEventListener("click", () => (location.href = "home.html"));

  // Menu hamburger mobile (≤480px): apre/chiude la sidebar e cambia icona
  const sidebar = document.querySelector(".sidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      sidebarToggle.setAttribute("aria-expanded", String(isOpen));
      const icon = sidebarToggle.querySelector("i");
      icon.className = "bi bi-list";
      if (isOpen) icon.className = "bi bi-x-lg";
    });

    // Chiude il menu dopo aver scelto una voce (delega: copre anche le playlist dinamiche)
    sidebar.addEventListener("click", (e) => {
      if (!e.target.closest(".nav-link, .user-playlist-item")) return;
      sidebar.classList.remove("open");
      sidebarToggle.setAttribute("aria-expanded", "false");
      sidebarToggle.querySelector("i").className = "bi bi-list";
    });
  }
  document
    .querySelector(".user-btn")
    .addEventListener("click", () => navigateTo("profile"));

  document
    .getElementById("createPlaylistBtn")
    .addEventListener("click", (e) => {
      e.preventDefault();
      new bootstrap.Modal(document.getElementById("playlistModal")).show();
    });

  document
    .getElementById("confirmPlaylistBtn")
    .addEventListener("click", createPlaylist);
  document
    .getElementById("addCreatePlaylistBtn")
    .addEventListener("click", createPlaylistAndAdd);
  document.getElementById("confirmModalOkBtn").addEventListener("click", () => {
    bootstrap.Modal.getInstance(document.getElementById("confirmModal")).hide();
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
  });
  document
    .getElementById("saveProfileBtn")
    .addEventListener("click", saveProfile);
  document
    .getElementById("profilePhotoInput")
    .addEventListener("change", previewProfilePhoto);

  // Gestisce back/forward del browser per le sub-pagine navigate via pushState
  window.addEventListener("popstate", async (e) => {
    if (e.state && e.state.page) {
      state.currentPage = e.state.page;
      await showPage(e.state.page);
    } else {
      // Nessuno stato: torna alla pagina default del file corrente
      await renderCurrentMainPage();
    }
  });
}

// ============================================
// MOSTRA PAGINE (async)
// ============================================
async function showPage(page) {
  const content = document.getElementById("contentArea");

  // Pagine principali: usa il renderer registrato se siamo nel file giusto, altrimenti redirect
  if (_MAIN_PAGES[page]) {
    const file = window.location.pathname.split("/").pop() || "home.html";
    if (_MAIN_PAGES[page] !== file) {
      location.href = _MAIN_PAGES[page];
      return;
    }
    await renderCurrentMainPage();
    return;
  }

  // Sub-pagine: renderizzate dinamicamente nella pagina corrente
  state.currentPage = page;
  showLoading(content);

  try {
    if (page === "profile") renderProfile(content);
    else if (page.startsWith("album-"))
      await renderAlbum(content, page.slice(6));
    else if (page.startsWith("playlist-"))
      await renderPlaylist(content, page.slice(9));
    else if (page.startsWith("userplaylist-"))
      renderUserPlaylist(content, page.slice(13));
    else if (page === "recent-tracks")
      renderRecentTracks(content);
    else if (page.startsWith("genre-"))
      await renderGenre(content, page.slice(6));
    else if (page.startsWith("artist-"))
      await renderArtist(content, page.slice(7));
  } catch (e) {
    showRenderError(content, e);
  }

  content.parentElement.scrollTop = 0;
}

function showLoading(container) {
  const box = make("div", "text-center mt-5 text-secondary");
  const spinner = make("div", "spinner-border text-success");
  spinner.setAttribute("role", "status");
  append(box, spinner, make("p", "mt-3", "Caricamento..."));
  container.replaceChildren(box);
}

// Box di errore con bottone "Riprova" — riusato da pagine principali e sub-pagine.
// Evita che un fallimento dell'API lasci lo spinner di caricamento all'infinito.
function showRenderError(content, e) {
  const box = make("div", "text-center mt-5 text-secondary");
  const icon = make("i", "bi bi-exclamation-circle");
  icon.style.fontSize = "48px";
  const retry = make("button", "btn btn-spotify mt-3", "Riprova");
  retry.addEventListener("click", () => refreshCurrentPage());
  append(
    box,
    icon,
    make(
      "p",
      "mt-3",
      "Errore nel caricamento. Controlla la connessione e riprova.",
    ),
    retry,
  );
  content.replaceChildren(box);
  console.error(e);
}

// Renderizza la pagina principale (home/search/liked) con spinner e gestione errori
async function renderCurrentMainPage() {
  const content = document.getElementById("contentArea");
  if (!window._pageRenderer) return;
  state.currentPage = null;
  showLoading(content);
  try {
    await window._pageRenderer(content);
  } catch (e) {
    showRenderError(content, e);
  }
  content.parentElement.scrollTop = 0;
}

// Ri-renderizza la vista attuale: aggiorna indicatori di riproduzione e stato like
async function refreshCurrentPage() {
  const content = document.getElementById("contentArea");
  if (state.currentPage) {
    await showPage(state.currentPage);
  } else if (window._pageRenderer) {
    try {
      await window._pageRenderer(content);
    } catch (e) {
      showRenderError(content, e);
    }
  }
}

// ============================================
// COVER PLAYLIST VIRTUALI
// Prende il primo risultato iTunes per il termine della playlist e usa il suo artwork
// ============================================
async function getVirtualPlaylistCover(p) {
  if (p.id === "vp_top_it") return "assets/img/santino.png";
  return cached("cover_" + p.id, async () => {
    const results = await itunesSearch(p.term, "song", 1);
    const item = results[0];
    if (!item || !item.artworkUrl100) {
      return createCover(
        p.title.substring(0, 2).toUpperCase(),
        p.color1,
        p.color2,
      );
    }
    return item.artworkUrl100.replace("100x100bb", "600x600bb");
  });
}

// ============================================
// GENRE — condiviso tra home.js e search.js
// ============================================
async function renderGenre(container, genreName) {
  const genre = GENRES.find((g) => g.name === decodeURIComponent(genreName));
  const term = genre ? genre.term : decodeURIComponent(genreName);
  const name = genre ? genre.name : decodeURIComponent(genreName);

  const items = await cached("genre_" + term, () =>
    itunesSearch(term, "song", 30),
  );
  const tracks = items.map(normalizeTrack).filter(Boolean);

  container.replaceChildren(
    make("h1", "greeting-title", name),
    renderTrackList(tracks),
  );
}

// ============================================
// ALBUM / PLAYLIST
// ============================================
async function renderAlbum(container, albumId) {
  const { album, tracks: rawTracks } = await cached("album_" + albumId, () =>
    itunesGetAlbum(albumId),
  );
  if (!album) {
    container.replaceChildren(
      make("p", "text-secondary mt-4", "Album non trovato."),
    );
    return;
  }

  const norm = normalizeAlbum(album);
  const tracks = rawTracks.map(normalizeTrack).filter(Boolean);
  tracks.forEach((t) => _trackRegistry.set(t.id, t));

  const meta = make("div", "playlist-meta");
  append(meta, make("strong", "", norm.artist), ` • ${tracks.length} brani`);

  const playBtn = make("button", "btn-play-large");
  playBtn.addEventListener("click", () => playTracksList(tracks));
  playBtn.append(make("i", "bi bi-play-fill"));

  const moreBtn = make("button", "btn-icon");
  moreBtn.style.fontSize = "32px";
  moreBtn.append(make("i", "bi bi-three-dots"));

  container.replaceChildren(
    makePlaylistHeader(norm.cover, "Album", norm.title, meta),
    append(make("div", "playlist-actions-row"), playBtn, moreBtn),
    renderTrackList(tracks, true),
  );
}

async function renderArtist(container, artistId) {
  const { artist, albums } = await cached("artist_" + artistId, () =>
    itunesGetArtist(artistId),
  );
  if (!artist) {
    container.replaceChildren(
      make("p", "text-secondary mt-4", "Artista non trovato."),
    );
    return;
  }

  const meta = make("div", "playlist-meta");
  append(meta, make("span", "", artist.primaryGenreName || ""));

  const albumGrid = make("div", "card-grid");
  albums.map(normalizeAlbum).filter(Boolean).forEach((a) =>
    albumGrid.append(makeCard(a.cover, a.title, a.artist, "album-" + a.id)),
  );

  const nodes = [
    makePlaylistHeader(null, "Artista", artist.artistName, meta),
  ];
  if (albumGrid.childElementCount > 0) {
    nodes.push(make("h2", "section-title", "Album"), albumGrid);
  }
  container.replaceChildren(...nodes);
}

async function renderPlaylist(container, playlistId) {
  const vp = VIRTUAL_PLAYLISTS.find((p) => p.id === playlistId);
  if (!vp) {
    container.replaceChildren(
      make("p", "text-secondary mt-4", "Playlist non trovata."),
    );
    return;
  }

  const [cover, rawTracks] = await Promise.all([
    getVirtualPlaylistCover(vp),
    cached("vptracks_" + playlistId, () => itunesGetPlaylistTracks(playlistId)),
  ]);
  const tracks = rawTracks.map(normalizeTrack).filter(Boolean);
  tracks.forEach((t) => _trackRegistry.set(t.id, t));

  const playBtn = make("button", "btn-play-large");
  playBtn.addEventListener("click", () => playTracksList(tracks));
  playBtn.append(make("i", "bi bi-play-fill"));

  container.replaceChildren(
    makePlaylistHeader(
      cover,
      "Playlist",
      vp.title,
      make("div", "playlist-meta", vp.description),
      make("div", "playlist-meta mt-2", `${tracks.length} brani`),
    ),
    append(make("div", "playlist-actions-row"), playBtn),
    renderTrackList(tracks),
  );
}

function renderUserPlaylist(container, playlistId) {
  const playlist = state.userPlaylists.find((p) => p.id === playlistId);
  if (!playlist) return;

  const cover = "assets/img/ppp.jpg";
  playlist.tracks.forEach((t) => _trackRegistry.set(t.id, t));

  // Le righe in una playlist utente mostrano anche il bottone "rimuovi"
  let tracksEl;
  if (playlist.tracks.length > 0) {
    tracksEl = renderTrackList(playlist.tracks, true, {
      removeFromPlaylistId: playlistId,
    });
  } else {
    tracksEl = make("p", "text-secondary mt-4", "Questa playlist è vuota.");
  }

  const meta = make("div", "playlist-meta");
  append(
    meta,
    make("strong", "", state.displayName),
    ` • ${playlist.tracks.length} brani`,
  );

  const playBtn = make("button", "btn-play-large");
  playBtn.addEventListener("click", () => playTracksList(playlist.tracks));
  playBtn.append(make("i", "bi bi-play-fill"));

  // Bottone elimina playlist
  const deleteBtn = make("button", "btn-icon");
  deleteBtn.style.fontSize = "32px";
  deleteBtn.title = "Elimina playlist";
  deleteBtn.addEventListener("click", () => deletePlaylist(playlistId));
  deleteBtn.append(make("i", "bi bi-trash"));
  const renameBtn = make("button", "btn-icon");
  renameBtn.style.fontSize = "32px";
  renameBtn.title = "Rinomina playlist";
  
  renameBtn.addEventListener("click", () => {
    document.getElementById("renamePlaylistInput").value = playlist.name;
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("renamePlaylistModal"));
    const confirmBtn = document.getElementById("confirmRenameBtn");
    const handler = () => {
      const newName = document.getElementById("renamePlaylistInput").value.trim();
      if (newName) {
        playlist.name = newName;
        saveUserPlaylists();
        renderUserPlaylists();
        refreshCurrentPage();
      }
      modal.hide();
      confirmBtn.removeEventListener("click", handler);
    };
    confirmBtn.addEventListener("click", handler);
    modal.show();
  });
  


  renameBtn.append(make("i", "bi bi-pencil"));

  container.replaceChildren(
    makePlaylistHeader(cover, "Playlist", playlist.name, meta),
    append(make("div", "playlist-actions-row"), playBtn, renameBtn, deleteBtn),
    tracksEl,
  );
}

function renderRecentTracks(container) {
  const tracks = state.recentTracks;
  tracks.forEach(t =>
    _trackRegistry.set(t.id, t)
  );
  const playBtn = make("button", "btn-play-large");playBtn.append(
    make("i", "bi bi-play-fill")
  );
  playBtn.addEventListener(
    "click",
    () => playTracksList(tracks)
  );
  const meta = make(
    "div",
    "playlist-meta",
    `${tracks.length} brani`
  );
  container.replaceChildren(
    makePlaylistHeader(
      null,
      "Playlist",
      "Ascoltati di recente",
      meta
    ),
    append(
      make("div", "playlist-actions-row"),
      playBtn
    ),
    tracks.length
      ? renderTrackList(tracks)
      : make(
          "p",
          "text-secondary mt-4",
          "Non hai ancora ascoltato alcun brano."
        )
  );
}

// ============================================
// PROFILO UTENTE
// ============================================
function renderProfile(container) {
  const initial = state.displayName.charAt(0).toUpperCase();
  const likedCount = state.likedTracks.size;

  let avatarEl;
  if (state.profilePhoto) {
    avatarEl = make("div", "playlist-cover-large");
    avatarEl.style.borderRadius = "50%";
    avatarEl.style.backgroundImage = `url('${state.profilePhoto}')`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.style.backgroundPosition = "center";
  } else {
    avatarEl = make("div", "playlist-cover-large");
    avatarEl.style.cssText =
      "border-radius:50%; background:linear-gradient(135deg,#1db954,#191414); display:flex; align-items:center; justify-content:center;";
    const span = make("span", "", initial);
    span.style.cssText = "font-size:90px; font-weight:900; color:white;";
    avatarEl.append(span);
  }

  const metaText = `${state.userPlaylists.length} playlist • ${likedCount} brani salvati`;
  const headerInfo = make("div", "playlist-header-info");

  const metaNodes = [
    make("div", "playlist-type", "Profilo"),
    make("div", "playlist-name-large", state.displayName),
  ];

  if (state.bio) {
    const bioEl = make("div", "playlist-meta profile-bio", state.bio);
    metaNodes.push(bioEl);
  }

  const detailsRow = make("div", "playlist-meta profile-details-row");
  if (state.location) {
    const locEl = make("span", "profile-detail-item");
    append(locEl, make("i", "bi bi-geo-alt-fill"), ` ${state.location}`);
    detailsRow.append(locEl);
  }
  if (state.joinDate) {
    const date = new Date(state.joinDate);
    const formatted = date.toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    });
    const joinEl = make("span", "profile-detail-item");
    append(joinEl, make("i", "bi bi-calendar3"), ` Iscritto da ${formatted}`);
    detailsRow.append(joinEl);
  }
  if (detailsRow.childElementCount > 0) metaNodes.push(detailsRow);

  metaNodes.push(make("div", "playlist-meta mt-1", metaText));

  append(headerInfo, ...metaNodes);
  const header = append(make("div", "playlist-header"), avatarEl, headerInfo);

  const editBtn = make("button", "btn btn-spotify");
  editBtn.addEventListener("click", openProfileModal);
  append(editBtn, make("i", "bi bi-pencil-fill"), " Modifica profilo");

  const logoutBtn = make("button", "btn-icon");
  logoutBtn.style.fontSize = "32px";
  logoutBtn.addEventListener("click", logout);
  logoutBtn.append(make("i", "bi bi-box-arrow-right"));

  const actionsRow = append(
    make("div", "playlist-actions-row"),
    editBtn,
    logoutBtn,
  );
  const nodes = [header, actionsRow];

  if (state.userPlaylists.length > 0) {
    const grid = make("div", "card-grid");
    state.userPlaylists.forEach((p) => {
      // Stessa cover fissa usata da renderUserPlaylist() per la pagina della singola playlist
      grid.append(
        makeCard(
          "assets/img/ppp.jpg",
          p.name,
          `${p.tracks.length} brani`,
          "userplaylist-" + p.id,
        ),
      );
    });
    nodes.push(make("h2", "section-title", "Le tue playlist"), grid);
  }

  container.replaceChildren(...nodes);
}

function logout() {
  // Chiude solo la sessione: il profilo (nome, foto, bio, località, join date)
  // resta in localStorage e verrà ripristinato al login successivo.
  localStorage.removeItem("session_active");
  localStorage.removeItem("current_track");
  audio.pause();
  audio.src = "";
  location.href = "login.html";
}

// ============================================
// MENU UTENTE / AVATAR
// ============================================
function updateUserMenu() {
  document.getElementById("userName").textContent = state.displayName;
  const userBtn = document.querySelector(".user-btn");
  const iconOrImg = userBtn.querySelector("i:first-child, .user-avatar-img");
  if (state.profilePhoto) {
    if (iconOrImg && iconOrImg.tagName === "IMG") {
      iconOrImg.src = state.profilePhoto;
    } else {
      const img = document.createElement("img");
      img.className = "user-avatar-img";
      img.src = state.profilePhoto;
      img.alt = state.displayName;
      if (iconOrImg) iconOrImg.replaceWith(img);
    }
  } else if (iconOrImg && iconOrImg.tagName === "IMG") {
    const icon = document.createElement("i");
    icon.className = "bi bi-person-circle";
    iconOrImg.replaceWith(icon);
  }
}

// ============================================
// MODIFICA PROFILO
// ============================================
let tempProfilePhoto = null;

function openProfileModal() {
  tempProfilePhoto = state.profilePhoto;
  document.getElementById("editDisplayName").value = state.displayName;
  document.getElementById("editBio").value = state.bio || "";
  document.getElementById("editLocation").value = state.location || "";
  updatePhotoPreview(state.profilePhoto);
  new bootstrap.Modal(document.getElementById("profileModal")).show();
}

function updatePhotoPreview(photo) {
  const preview = document.getElementById("profilePhotoEdit");
  const placeholder = document.getElementById("profilePhotoPlaceholder");
  if (photo) {
    preview.style.backgroundImage = `url('${photo}')`;
    placeholder.style.display = "none";
  } else {
    preview.style.backgroundImage = "";
    placeholder.style.display = "block";
  }
}

// Ridimensiona e comprime l'immagine prima di salvarla: una foto a piena
// risoluzione come data URL satura la quota di localStorage (~5 MB). Riducendo
// il lato max a `maxSize` px ed esportando in JPEG si ottengono pochi KB.
function resizeImage(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Mantiene le proporzioni rientrando in maxSize x maxSize
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = make("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function previewProfilePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  tempProfilePhoto = await resizeImage(file, 256);
  updatePhotoPreview(tempProfilePhoto);
}

function saveProfile() {
  const name = document.getElementById("editDisplayName").value.trim();
  if (name) {
    state.displayName = name;
    localStorage.setItem("display_name", name);
  }
  const bio = document.getElementById("editBio").value.trim();
  state.bio = bio || null;
  if (bio) localStorage.setItem("profile_bio", bio);
  else localStorage.removeItem("profile_bio");

  const location = document.getElementById("editLocation").value.trim();
  state.location = location || null;
  if (location) localStorage.setItem("profile_location", location);
  else localStorage.removeItem("profile_location");

  state.profilePhoto = tempProfilePhoto;
  // Se la quota è piena setItem lancia QuotaExceededError: lo intercettiamo
  // per non interrompere il salvataggio in silenzio e avvisare l'utente.
  try {
    if (tempProfilePhoto)
      localStorage.setItem("profile_photo", tempProfilePhoto);
    else localStorage.removeItem("profile_photo");
  } catch (_) {
    alert(
      "Spazio di archiviazione insufficiente: la foto non è stata salvata.",
    );
  }
  updateUserMenu();
  bootstrap.Modal.getInstance(document.getElementById("profileModal")).hide();
  refreshCurrentPage();
}

// ============================================
// HELPER: intestazione playlist/album/profilo
// coverSrc = null → riquadro gradiente con cuore (liked tracks)
// I nodi meta vengono passati come argomenti variadici e aggiunti dopo il titolo
// ============================================
function makePlaylistHeader(coverSrc, type, title, ...metaNodes) {
  let coverEl;
  if (coverSrc) {
    coverEl = make("img", "playlist-cover-large");
    coverEl.src = coverSrc;
    coverEl.alt = title;
  } else {
    coverEl = make("div", "playlist-cover-large");
    coverEl.style.cssText =
      "background:linear-gradient(135deg,#450af5,#c4efd9); display:flex; align-items:center; justify-content:center;";
    const icon = make("i", "bi bi-heart-fill");
    icon.style.cssText = "font-size:80px; color:white;";
    coverEl.append(icon);
  }

  const info = make("div", "playlist-header-info");
  append(
    info,
    make("div", "playlist-type", type),
    make("div", "playlist-name-large", title),
    ...metaNodes,
  );

  return append(make("div", "playlist-header"), coverEl, info);
}

// ============================================
// CARD HELPER
// ============================================
function makeCard(cover, title, description, page) {
  const card = make("div", "album-card");
  card.addEventListener("click", () => navigateTo(page));

  const img = make("img", "album-cover");
  img.src = cover;
  img.alt = title;

  const overlay = make("div", "play-overlay");
  overlay.addEventListener("click", (e) => {
    e.stopPropagation();
    quickPlay(page);
  });
  overlay.append(make("i", "bi bi-play-fill"));

  append(
    card,
    img,
    make("div", "album-title", title),
    make("div", "album-description", description),
    overlay,
  );
  return card;
}

async function quickPlay(page) {
  if (page.startsWith("album-")) {
    const id = page.slice(6);
    const { tracks } = await cached("album_" + id, () => itunesGetAlbum(id));
    playTracksList(tracks.map(normalizeTrack).filter(Boolean));
  } else if (page.startsWith("playlist-")) {
    await playPlaylistById(page.slice(9));
  }
}

async function playPlaylistById(playlistId) {
  const raw = await cached("vptracks_" + playlistId, () =>
    itunesGetPlaylistTracks(playlistId),
  );
  playTracksList(raw.map(normalizeTrack).filter(Boolean));
}

// ============================================
// RENDER TRACKLIST
// ============================================

// Costruisce una singola riga della tracklist come elemento DOM.
// options.removeFromPlaylistId — se presente, mostra il bottone "rimuovi da playlist"
function makeTrackRow(track, index, ids, showAlbumCol, options = {}) {
  const isPlaying = state.currentTrack && state.currentTrack.id === track.id;
  const isLiked = state.likedTracks.has(track.id);

  // Numero di traccia o icona volume se in riproduzione
  const numDiv = make("div", "track-number");
  if (isPlaying && state.isPlaying) {
    numDiv.append(make("i", "bi bi-volume-up-fill"));
  } else {
    numDiv.textContent = String(index + 1);
  }

  const nameDiv = make("div", "track-name", track.title);
  if (!track.previewUrl) {
    const mute = make("span", "", "🔇");
    mute.title = "Anteprima non disponibile";
    mute.style.cssText = "font-size:11px;color:#555;margin-left:4px;";
    nameDiv.append(mute);
  }

  const likeIcon = make("i", `bi bi-heart${isLiked ? "-fill" : ""}`);
  if (isLiked) likeIcon.style.color = "var(--spotify-green)";
  const likeBtn = make("button", "btn-icon");
  likeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleLike(track.id);
  });
  likeBtn.append(likeIcon);

  // Bottone "Aggiungi a una playlist" — presente su ogni riga
  const addBtn = make("button", "btn-icon");
  addBtn.title = "Aggiungi a una playlist";
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openAddToPlaylistModal(track.id);
  });
  addBtn.append(make("i", "bi bi-plus-circle"));

  // Cella azioni: aggiungi + like (+ rimuovi quando siamo in una playlist utente)
  const actions = make("div", "track-actions");
  append(actions, addBtn, likeBtn);
  if (options.removeFromPlaylistId) {
    const removeBtn = make("button", "btn-icon");
    removeBtn.title = "Rimuovi da questa playlist";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTrackFromPlaylist(options.removeFromPlaylistId, track.id);
    });
    removeBtn.append(make("i", "bi bi-x-circle"));
    actions.append(removeBtn);
  }

  // Bottone "tre puntini": su mobile sostituisce le icone inline (vedi CSS)
  const moreBtn = make("button", "btn-icon track-more-btn");
  moreBtn.title = "Altre opzioni";
  moreBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openTrackActionsModal(track.id, options);
  });
  moreBtn.append(make("i", "bi bi-three-dots"));
  actions.append(moreBtn);

  const cover = make("img");
  cover.src = track.cover;
  cover.alt = track.title;

  const artistEl = make("div", "track-artist-small", track.artist);
  if (track.artistId) {
    artistEl.classList.add("track-artist-link");
    artistEl.addEventListener("click", (e) => {
      e.stopPropagation();
      navigateTo("artist-" + track.artistId);
    });
  }
  const infoText = make("div", "track-info-text");
  append(infoText, nameDiv, artistEl);

  const info = make("div", "track-info");
  append(info, cover, infoText);

  const row = make("div", `track-row${isPlaying ? " playing" : ""}`);
  append(
    row,
    numDiv,
    info,
    make("div", "track-album", showAlbumCol ? track.album : track.artist),
    actions,
    make("div", "track-duration", formatDuration(track.duration)),
  );

  // Click singolo (≥480px): apre il modale dettaglio brano dopo 220ms
  // Il timer viene cancellato se arriva un doppio click, evitando che si sovrappongano
  row.addEventListener("click", () => {
    if (window.innerWidth < 480) return;
    clearTimeout(_trackDetailTimer);
    _trackDetailTimer = setTimeout(
      () => openTrackDetailModal(track.id, ids, options),
      220,
    );
  });

  // Doppio click: riproduce direttamente (cancella il timer del click singolo)
  row.addEventListener("dblclick", () => {
    clearTimeout(_trackDetailTimer);
    playTrackInList(track.id, ids);
  });
  return row;
}

function renderTrackList(trackList, showAlbumCol = true, options = {}) {
  // Registra tutti i track per lookup futuro (like, play)
  trackList.forEach((t) => _trackRegistry.set(t.id, t));
  const ids = trackList.map((t) => t.id);

  const header = make("div", "tracklist-header");
  const clock = make("div");
  clock.append(make("i", "bi bi-clock"));
  append(
    header,
    make("div", "", "#"),
    make("div", "", "Titolo"),
    make("div", "", showAlbumCol ? "Album" : "Artista"),
    make("div"),
    clock,
  );

  const list = make("div", "tracklist");
  list.append(header);
  trackList.forEach((track, index) =>
    list.append(makeTrackRow(track, index, ids, showAlbumCol, options)),
  );
  return list;
}

// ============================================
// PLAYER — HTML5 Audio API
// ============================================
function setupPlayer() {
  document.getElementById("playBtn").addEventListener("click", togglePlay);
  document.getElementById("prevBtn").addEventListener("click", prevTrack);
  document.getElementById("nextBtn").addEventListener("click", nextTrack);
  document
    .getElementById("shuffleBtn")
    .addEventListener("click", toggleShuffle);
  document.getElementById("repeatBtn").addEventListener("click", toggleRepeat);
  document.getElementById("likeBtn").addEventListener("click", () => {
    if (state.currentTrack) toggleLike(state.currentTrack.id);
  });

  // Seek sulla progress bar
  document
    .getElementById("progressContainer")
    .addEventListener("click", (e) => {
      if (!state.currentTrack || !audio.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      audio.currentTime =
        ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

  // Controllo volume (cliccabile e draggabile)
  const volumeContainer = document.getElementById("volumeContainer");

  const setVolumeFromEvent = (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    state.volume = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    audio.volume = state.volume;
    document.getElementById("volumeFill").style.width =
      state.volume * 100 + "%";
    updateVolumeIcon();
    refreshPipUI();
  };

  const volumeHover = document.getElementById("volumeHover");
  volumeContainer.addEventListener("mousemove", (e) => {
    if (volumeContainer.classList.contains("dragging")) return;
    const rect = volumeContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    volumeHover.style.width = pct * 100 + "%";
  });

  volumeContainer.addEventListener("mouseleave", () => {
    volumeHover.style.width = "0%";
  });

  volumeContainer.addEventListener("mousedown", (e) => {
    setVolumeFromEvent(e);
    volumeContainer.classList.add("dragging");

    const onMouseMove = (moveEvent) => setVolumeFromEvent(moveEvent);
    const onMouseUp = () => {
      volumeContainer.classList.remove("dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  document.getElementById("volumeBtn").addEventListener("click", () => {
    state.volume = state.volume > 0 ? 0 : 0.7;
    audio.volume = state.volume;
    document.getElementById("volumeFill").style.width =
      state.volume * 100 + "%";
    updateVolumeIcon();
    refreshPipUI();
  });

  // Aggiorna la barra di avanzamento in tempo reale
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    document.getElementById("progressFill").style.width =
      (audio.currentTime / audio.duration) * 100 + "%";
    document.getElementById("currentTime").textContent = formatDuration(
      Math.floor(audio.currentTime),
    );
    if (pipWindow && pipEls) {
      pipEls.progressFill.style.width =
        (audio.currentTime / audio.duration) * 100 + "%";
      pipEls.currentTime.textContent = formatDuration(
        Math.floor(audio.currentTime),
      );
    }
  });

  audio.addEventListener("ended", () => {
    if (state.isRepeat) {
      audio.currentTime = 0;
      audio.play();
    } else nextTrack();
  });

  audio.volume = state.volume;
}

// ============================================
// PICTURE-IN-PICTURE — mini-player flottante
// Visibile anche cambiando scheda del browser (Document PiP API, solo Chrome/Edge 116+)
// ============================================

function isPipSupported() {
  return "documentPictureInPicture" in window;
}

function setupPip() {
  if (!isPipSupported()) return; // Firefox/Safari: nessun PiP, nessun errore
  document.addEventListener("visibilitychange", handlePipVisibilityChange);
}

async function handlePipVisibilityChange() {
  if (document.hidden) {
    if (state.isPlaying && state.currentTrack && !pipWindow) {
      await openPipWindow();
    }
  } else if (pipWindow) {
    pipWindow.close();
  }
}

async function openPipWindow() {
  try {
    pipWindow = await documentPictureInPicture.requestWindow({
      width: 360,
      height: 300,
    });
  } catch (_) {
    pipWindow = null;
    return;
  }

  pipWindow.document.documentElement.classList.add("pip-mode");
  // Clona tutti i <link rel="stylesheet"> della pagina principale (Bootstrap, Bootstrap Icons,
  // Google Fonts, style.css) cosi' pulsanti e icone nella PiP risultano identici a quelli del player
  document.querySelectorAll('link[rel="stylesheet"]').forEach((original) => {
    const clone = pipWindow.document.createElement("link");
    clone.rel = "stylesheet";
    clone.href = original.href;
    pipWindow.document.head.append(clone);
  });

  // Il documento della PiP è separato da quello principale: le variabili del
  // tema, applicate da applyTheme() come stile inline su <html>, vanno copiate
  // a mano, altrimenti la PiP mostra sempre i colori di default di style.css
  pipWindow.document.documentElement.style.cssText =
    document.documentElement.style.cssText;

  buildPipDocument(pipWindow.document.body);
  refreshPipUI();

  pipWindow.addEventListener("pagehide", () => {
    pipWindow = null;
    pipEls = null;
  });
}

function buildPipDocument(container) {
  const cover = make("img", "pip-cover");

  const title = make("div", "track-title");
  const artist = make("div", "track-artist");
  const trackInfo = append(make("div", "pip-track-info"), title, artist);

  const likeBtn = make("button", "btn-icon");
  const likeIcon = make("i", "bi bi-heart");
  likeBtn.append(likeIcon);
  likeBtn.addEventListener("click", () => {
    if (state.currentTrack) toggleLike(state.currentTrack.id);
  });

  const prevBtn = make("button", "btn-icon");
  prevBtn.append(make("i", "bi bi-skip-start-fill"));
  prevBtn.addEventListener("click", prevTrack);

  const playBtn = make("button", "btn-play");
  playBtn.append(make("i", "bi bi-play-fill"));
  playBtn.addEventListener("click", togglePlay);

  const nextBtn = make("button", "btn-icon");
  nextBtn.append(make("i", "bi bi-skip-end-fill"));
  nextBtn.addEventListener("click", nextTrack);

  const controls = append(
    make("div", "pip-controls"),
    prevBtn,
    playBtn,
    nextBtn,
  );

  const currentTime = make("span", "time-text", "0:00");
  const progressContainer = make("div", "progress-bar-container");
  const progressFill = make("div", "progress-bar-fill");
  progressContainer.append(progressFill);
  const totalTime = make("span", "time-text", "0:00");
  const progress = append(
    make("div", "pip-progress"),
    currentTime,
    progressContainer,
    totalTime,
  );

  const volumeContainer = make("div", "volume-bar-container");
  const volumeHover = make("div", "volume-bar-hover");
  const volumeFill = make("div", "volume-bar-fill");
  const volumeThumb = make("div", "volume-bar-thumb");
  volumeFill.append(volumeThumb);
  volumeContainer.append(volumeHover, volumeFill);
  const bottomRow = append(
    make("div", "pip-bottom-row"),
    likeBtn,
    volumeContainer,
  );

  container.replaceChildren(
    append(
      make("div", "pip-player"),
      cover,
      trackInfo,
      controls,
      progress,
      bottomRow,
    ),
  );

  pipEls = {
    cover,
    title,
    artist,
    likeBtn,
    likeIcon,
    playBtn,
    currentTime,
    progressContainer,
    progressFill,
    totalTime,
    volumeContainer,
    volumeHover,
    volumeFill,
  };

  // Seek: stesso pattern click-to-seek della progress bar principale
  progressContainer.addEventListener("click", (e) => {
    if (!state.currentTrack || !audio.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  });

  // Volume: stesso pattern drag/hover dello slider principale, ma sul document della PiP
  const setVolumeFromEvent = (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    state.volume = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    audio.volume = state.volume;
    volumeFill.style.width = state.volume * 100 + "%";
    updateVolumeIcon();
    syncMainVolumeUI();
  };

  volumeContainer.addEventListener("mousemove", (e) => {
    if (volumeContainer.classList.contains("dragging")) return;
    const rect = volumeContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    volumeHover.style.width = pct * 100 + "%";
  });

  volumeContainer.addEventListener("mouseleave", () => {
    volumeHover.style.width = "0%";
  });

  volumeContainer.addEventListener("mousedown", (e) => {
    setVolumeFromEvent(e);
    volumeContainer.classList.add("dragging");

    const onMouseMove = (moveEvent) => setVolumeFromEvent(moveEvent);
    const onMouseUp = () => {
      volumeContainer.classList.remove("dragging");
      pipWindow.document.removeEventListener("mousemove", onMouseMove);
      pipWindow.document.removeEventListener("mouseup", onMouseUp);
    };

    pipWindow.document.addEventListener("mousemove", onMouseMove);
    pipWindow.document.addEventListener("mouseup", onMouseUp);
  });
}

// Sincronizza la UI del player principale dopo un cambio di volume avvenuto dentro la PiP
function syncMainVolumeUI() {
  const fill = document.getElementById("volumeFill");
  if (fill) fill.style.width = state.volume * 100 + "%";
  updateVolumeIcon();
}

// Sincronizza la finestra PiP con lo stato corrente (cover, titolo, play/pause, like, volume)
function refreshPipUI() {
  if (!pipWindow || !pipEls) return;
  const t = state.currentTrack;
  if (t) {
    pipEls.cover.src = t.cover;
    pipEls.title.textContent = t.title;
    pipEls.artist.textContent = t.artist;
    pipEls.totalTime.textContent = formatDuration(t.duration);
  }
  pipEls.playBtn.querySelector("i").className = state.isPlaying
    ? "bi bi-pause-fill"
    : "bi bi-play-fill";
  const liked = t && state.likedTracks.has(t.id);
  pipEls.likeIcon.className = liked ? "bi bi-heart-fill" : "bi bi-heart";
  pipEls.likeIcon.style.color = liked ? "var(--spotify-green)" : "";
  pipEls.volumeFill.style.width = state.volume * 100 + "%";
}

function playTrack(track) {
  if (!track) return;
  state.currentTrack = track;
  addRecentTrack(track);
  state.isPlaying = false;

  document.getElementById("playerTitle").textContent = track.title;
  document.getElementById("playerArtist").textContent = track.artist;
  const cover = document.getElementById("playerCover");
  cover.src = track.cover;
  cover.style.display = "block";
  document.getElementById("totalTime").textContent = formatDuration(
    track.duration,
  );
  document.getElementById("progressFill").style.width = "0%";
  document.getElementById("currentTime").textContent = "0:00";

  // Salva il brano corrente per ripristinare l'UI player al cambio di pagina
  localStorage.setItem("current_track", JSON.stringify(track));

  if (track.previewUrl) {
    audio.src = track.previewUrl;
    audio
      .play()
      .then(() => {
        state.isPlaying = true;
        updatePlayButton();
        refreshCurrentPage();
      })
      .catch(() => { });
  } else {
    // Nessuna anteprima: mostra info ma non riproduce
    audio.src = "";
    updatePlayButton();
    refreshCurrentPage();
  }

  updateLikeBtn();
  refreshPipUI();
}

function playTracksList(trackList) {
  if (!trackList || trackList.length === 0) return;
  const filtered = trackList.filter(Boolean);
  state.currentPlaylist = filtered;
  state.currentIndex = 0;
  playTrack(filtered[0]);
}

function playTrackInList(trackId, ids) {
  const playlist = ids.map((id) => _trackRegistry.get(id)).filter(Boolean);
  const idx = playlist.findIndex((t) => t.id === trackId);
  state.currentPlaylist = playlist;
  state.currentIndex = idx >= 0 ? idx : 0;
  playTrack(playlist[state.currentIndex] || playlist[0]);
}

function togglePlay() {
  if (!state.currentTrack) return;
  if (state.isPlaying) {
    audio.pause();
    state.isPlaying = false;
  } else if (state.currentTrack.previewUrl) {
    if (!audio.src) audio.src = state.currentTrack.previewUrl;
    audio
      .play()
      .then(() => {
        state.isPlaying = true;
        updatePlayButton();
        refreshCurrentPage();
      })
      .catch(() => { });
    return;
  }
  updatePlayButton();
  refreshCurrentPage();
}

function updatePlayButton() {
  document.querySelector("#playBtn i").className = state.isPlaying
    ? "bi bi-pause-fill"
    : "bi bi-play-fill";
  refreshPipUI();
}

function prevTrack() {
  if (state.currentPlaylist.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  state.currentIndex =
    (state.currentIndex - 1 + state.currentPlaylist.length) %
    state.currentPlaylist.length;
  playTrack(state.currentPlaylist[state.currentIndex]);
}

function nextTrack() {
  if (state.currentPlaylist.length === 0) return;
  state.currentIndex = state.isShuffle
    ? Math.floor(Math.random() * state.currentPlaylist.length)
    : (state.currentIndex + 1) % state.currentPlaylist.length;
  playTrack(state.currentPlaylist[state.currentIndex]);
}

function toggleShuffle() {
  state.isShuffle = !state.isShuffle;
  document
    .getElementById("shuffleBtn")
    .classList.toggle("active", state.isShuffle);
}

function toggleRepeat() {
  state.isRepeat = !state.isRepeat;
  document
    .getElementById("repeatBtn")
    .classList.toggle("active", state.isRepeat);
}

function updateVolumeIcon() {
  const icon = document.querySelector("#volumeBtn i");
  if (state.volume === 0) icon.className = "bi bi-volume-mute-fill";
  else if (state.volume < 0.5) icon.className = "bi bi-volume-down-fill";
  else icon.className = "bi bi-volume-up-fill";
}

// ============================================
// LIKE — salvati in localStorage
// ============================================

function toggleLike(trackId) {
  if (state.likedTracks.has(trackId)) {
    state.likedTracks.delete(trackId);
  } else {
    // Cerca il track nel registry o nel player corrente
    const track =
      _trackRegistry.get(trackId) ||
      (state.currentTrack?.id === trackId ? state.currentTrack : null);
    if (track) state.likedTracks.set(trackId, track);
  }
  saveLikedTracks();
  updateLikeBtn();
  refreshCurrentPage();
}

function updateLikeBtn() {
  if (!state.currentTrack) return;
  const liked = state.likedTracks.has(state.currentTrack.id);
  const icon = document.querySelector("#likeBtn i");
  icon.className = liked ? "bi bi-heart-fill" : "bi bi-heart";
  icon.style.color = liked ? "var(--spotify-green)" : "";
  refreshPipUI();
}

// ============================================
// PLAYLIST UTENTE — salvate in localStorage
// ============================================
function createPlaylist() {
  const name = document.getElementById("newPlaylistName").value.trim();
  if (!name) return;
  state.userPlaylists.push({ id: "up" + Date.now(), name, tracks: [] });
  document.getElementById("newPlaylistName").value = "";
  bootstrap.Modal.getInstance(document.getElementById("playlistModal")).hide();
  saveUserPlaylists();
  renderUserPlaylists();
}

function openRenamePlaylist(id, currentName) {
  _renamePlaylistId = id;
  document.getElementById("newPlaylistName").value = currentName;
  document.querySelector("#playlistModal .modal-title").textContent = "Rinomina playlist";
  document.getElementById("confirmPlaylistBtn").textContent = "Rinomina";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("playlistModal")).show();
}

function renderUserPlaylists() {
  const container = document.getElementById("userPlaylists");
  container.replaceChildren(
    ...state.userPlaylists.map((p) => {
      const a = document.createElement("a");
      a.className = "user-playlist-item";
      a.textContent = p.name;
      a.addEventListener("click", () => navigateTo("userplaylist-" + p.id));
      return a;
    }),
  );
}

// ============================================
// AGGIUNGI / RIMUOVI BRANI E ELIMINA PLAYLIST
// ============================================

// Track in attesa di essere aggiunto (impostato dal modale "aggiungi a playlist")
let _pendingAddTrackId = null;

// Aggiunge un brano a una playlist. Restituisce true se aggiunto, false se già presente/non trovato
function addTrackToPlaylist(playlistId, trackId) {
  const playlist = state.userPlaylists.find((p) => p.id === playlistId);
  if (!playlist) return false;
  if (playlist.tracks.some((t) => t.id === trackId)) return false; // già presente

  let track = _trackRegistry.get(trackId);
  if (!track && state.currentTrack && state.currentTrack.id === trackId) {
    track = state.currentTrack;
  }
  if (!track) return false;

  playlist.tracks.push(track);
  saveUserPlaylists();
  refreshCurrentPage();
  return true;
}

function removeTrackFromPlaylist(playlistId, trackId) {
  const playlist = state.userPlaylists.find((p) => p.id === playlistId);
  if (!playlist) return;
  playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId);
  saveUserPlaylists();
  refreshCurrentPage();
}

function deletePlaylist(playlistId) {
  const playlist = state.userPlaylists.find((p) => p.id === playlistId);
  if (!playlist) return;
  showConfirm(
    `Eliminare la playlist "${playlist.name}"?`,
    () => {
      state.userPlaylists = state.userPlaylists.filter(
        (p) => p.id !== playlistId,
      );
      saveUserPlaylists();
      renderUserPlaylists();
      navigateTo("profile"); // la pagina della playlist non esiste più
    },
    "Elimina",
  );
}

// Apre il modale per scegliere a quale playlist aggiungere il brano
function openAddToPlaylistModal(trackId) {
  _pendingAddTrackId = trackId;
  renderAddPlaylistList();
  document.getElementById("addNewPlaylistName").value = "";
  new bootstrap.Modal(document.getElementById("addPlaylistModal")).show();
}

// Popola la lista di playlist dentro il modale "aggiungi a playlist"
function renderAddPlaylistList() {
  const list = document.getElementById("addPlaylistList");
  if (state.userPlaylists.length === 0) {
    list.replaceChildren(
      make(
        "p",
        "text-secondary m-0",
        "Non hai ancora playlist: creane una qui sotto.",
      ),
    );
    return;
  }

  const items = state.userPlaylists.map((p) => {
    const already = p.tracks.some((t) => t.id === _pendingAddTrackId);
    const btn = make("button", "add-playlist-item");
    btn.append(make("span", "", p.name));
    if (already) {
      btn.disabled = true;
      btn.append(make("i", "bi bi-check-lg")); // brano già presente
    } else {
      btn.addEventListener("click", () => {
        addTrackToPlaylist(p.id, _pendingAddTrackId);
        bootstrap.Modal.getInstance(
          document.getElementById("addPlaylistModal"),
        ).hide();
        showToast("Aggiunto a " + p.name);
      });
    }
    return btn;
  });
  list.replaceChildren(...items);
}

// Crea una nuova playlist e ci aggiunge subito il brano in attesa
function createPlaylistAndAdd() {
  const input = document.getElementById("addNewPlaylistName");
  const name = input.value.trim();
  if (!name) return;
  const newPlaylist = { id: "up" + Date.now(), name, tracks: [] };
  state.userPlaylists.push(newPlaylist);
  addTrackToPlaylist(newPlaylist.id, _pendingAddTrackId); // salva + refresh
  renderUserPlaylists();
  input.value = "";
  bootstrap.Modal.getInstance(
    document.getElementById("addPlaylistModal"),
  ).hide();
  showToast("Creata e aggiunta a " + name);
}

// Messaggio temporaneo di conferma in basso allo schermo
function showToast(message) {
  const existing = document.querySelector(".toast-msg");
  if (existing) existing.remove();
  const toast = make("div", "toast-msg", message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Callback da eseguire alla conferma del modale generico
let _confirmCallback = null;

// Modale di conferma riutilizzabile (sostituisce confirm() nativo)
function showConfirm(message, onConfirm, okLabel = "Conferma") {
  document.getElementById("confirmModalBody").textContent = message;
  document.getElementById("confirmModalOkBtn").textContent = okLabel;
  _confirmCallback = onConfirm;
  new bootstrap.Modal(document.getElementById("confirmModal")).show();
}

// ============================================
// MODAL DETTAGLIO BRANO (click su riga ≥480px)
// ============================================
function openTrackDetailModal(trackId, ids, options = {}) {
  const track = _trackRegistry.get(trackId);
  if (!track) return;

  document.getElementById("trackDetailCover").src = track.cover;
  document.getElementById("trackDetailCover").alt = track.title;
  document.getElementById("trackDetailTitle").textContent = track.title;
  document.getElementById("trackDetailArtist").textContent = track.artist;
  document.getElementById("trackDetailAlbum").textContent = track.album;
  document.getElementById("trackDetailDuration").textContent = formatDuration(
    track.duration,
  );

  const modalEl = document.getElementById("trackDetailModal");

  document.getElementById("trackDetailPlayBtn").onclick = () => {
    bootstrap.Modal.getInstance(modalEl).hide();
    playTrackInList(trackId, ids);
  };

  _updateTrackDetailLike(trackId);
  document.getElementById("trackDetailLikeBtn").onclick = () => {
    toggleLike(trackId);
    _updateTrackDetailLike(trackId);
  };

  document.getElementById("trackDetailAddBtn").onclick = () => {
    modalEl.addEventListener(
      "hidden.bs.modal",
      () => openAddToPlaylistModal(trackId),
      { once: true },
    );
    bootstrap.Modal.getInstance(modalEl).hide();
  };

  document.getElementById("trackDetailShareBtn").onclick = () => {
    modalEl.addEventListener("hidden.bs.modal", () => shareTrack(trackId), {
      once: true,
    });
    bootstrap.Modal.getInstance(modalEl).hide();
  };

  new bootstrap.Modal(modalEl).show();
}

function _updateTrackDetailLike(trackId) {
  const liked = state.likedTracks.has(trackId);
  const icon = document.querySelector("#trackDetailLikeBtn i");
  icon.className = liked ? "bi bi-heart-fill" : "bi bi-heart";
  icon.style.color = liked ? "var(--spotify-green)" : "";
}

// ============================================
// MENU AZIONI BRANO (mobile, bottone "tre puntini")
// ============================================
function openTrackActionsModal(trackId, options = {}) {
  const track = _trackRegistry.get(trackId);
  const title = document.getElementById("trackActionsTitle");
  title.textContent = "Opzioni brano";
  if (track) title.textContent = track.title;

  const modalEl = document.getElementById("trackActionsModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const items = [];

  // Aggiungi a una playlist — apre il modale dedicato dopo la chiusura di questo
  const addItem = make("button", "add-playlist-item");
  addItem.append(make("span", "", "Aggiungi a una playlist"));
  addItem.append(make("i", "bi bi-plus-circle"));
  addItem.addEventListener("click", () => {
    modalEl.addEventListener(
      "hidden.bs.modal",
      () => openAddToPlaylistModal(trackId),
      { once: true },
    );
    modal.hide();
  });
  items.push(addItem);

  // Like / unlike
  const liked = state.likedTracks.has(trackId);
  let likeLabel = "Aggiungi ai preferiti";
  let likeIcon = "bi bi-heart";
  if (liked) {
    likeLabel = "Togli dai preferiti";
    likeIcon = "bi bi-heart-fill";
  }
  const likeItem = make("button", "add-playlist-item");
  likeItem.append(make("span", "", likeLabel));
  likeItem.append(make("i", likeIcon));
  likeItem.addEventListener("click", () => {
    toggleLike(trackId);
    modal.hide();
  });
  items.push(likeItem);

  // Rimuovi dalla playlist (solo dentro una playlist utente)
  if (options.removeFromPlaylistId) {
    const removeItem = make("button", "add-playlist-item");
    removeItem.append(make("span", "", "Rimuovi da questa playlist"));
    removeItem.append(make("i", "bi bi-x-circle"));
    removeItem.addEventListener("click", () => {
      removeTrackFromPlaylist(options.removeFromPlaylistId, trackId);
      modal.hide();
    });
    items.push(removeItem);
  }

  const shareItem = make("button", "add-playlist-item");
  shareItem.append(make("span", "", "Condividi"));
  shareItem.append(make("i", "bi bi-share"));
  shareItem.addEventListener("click", () => {
    modalEl.addEventListener("hidden.bs.modal", () => shareTrack(trackId), {
      once: true,
    });
    modal.hide();
  });
  items.push(shareItem);

  document.getElementById("trackActionsList").replaceChildren(...items);
  modal.show();
}

// ============================================
// CONFETTI ROSA — appaiono dopo il login
// ============================================

const _confettiCanvas = document.getElementById("glitterCanvas");
const _confettiCtx = _confettiCanvas ? _confettiCanvas.getContext("2d") : null;
let _confettiParticles = [];
let _confettiRunning = false;

const _CONFETTI_COLORS = [
  "#FF69B4",
  "#FF69B4",
  "#FF69B4",
  "#FFB6C1",
  "#FFB6C1",
  "#FFB6C1",
  "#FF1493",
  "#FF1493",
  "#FFC0CB",
  "#FFC0CB",
  "#FF85C2",
  "#ffffff",
  "#ffffff",
  "#FFE4F0",
];

function _rnd(min, max) {
  return Math.random() * (max - min) + min;
}

function _resizeConfetti() {
  if (!_confettiCanvas) return;
  _confettiCanvas.width = window.innerWidth;
  _confettiCanvas.height = window.innerHeight;
}

function _createConfettiParticle() {
  return {
    x: _rnd(0, window.innerWidth),
    y: _rnd(-20, -5),
    size: _rnd(4, 9),
    speedY: _rnd(1.5, 3.5),
    speedX: _rnd(-1.5, 1.5),
    rotation: _rnd(0, 360),
    rotationSpeed: _rnd(-5, 5),
    color:
      _CONFETTI_COLORS[Math.floor(Math.random() * _CONFETTI_COLORS.length)],
    opacity: _rnd(0.7, 1),
    shape: Math.random() < 0.6 ? "rect" : "circle",
  };
}

function _confettiLoop() {
  if (!_confettiCtx) return;
  _confettiCtx.clearRect(0, 0, _confettiCanvas.width, _confettiCanvas.height);

  if (_confettiRunning && Math.random() < 0.8) {
    _confettiParticles.push(_createConfettiParticle());
  }

  for (let i = _confettiParticles.length - 1; i >= 0; i--) {
    const p = _confettiParticles[i];

    _confettiCtx.save();
    _confettiCtx.globalAlpha = Math.max(0, p.opacity);
    _confettiCtx.translate(p.x, p.y);
    _confettiCtx.rotate((p.rotation * Math.PI) / 180);
    _confettiCtx.fillStyle = p.color;

    if (p.shape === "rect") {
      _confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 2);
    } else {
      _confettiCtx.beginPath();
      _confettiCtx.ellipse(0, 0, p.size / 2, p.size / 3, 0, 0, Math.PI * 2);
      _confettiCtx.fill();
    }

    _confettiCtx.restore();

    p.y += p.speedY;
    p.x += p.speedX;
    p.rotation += p.rotationSpeed;
    p.opacity -= 0.004;

    if (p.y > window.innerHeight + 15 || p.opacity <= 0) {
      _confettiParticles.splice(i, 1);
    }
  }

  requestAnimationFrame(_confettiLoop);
}

function _startConfetti() {
  _confettiRunning = true;
  setTimeout(() => {
    _confettiRunning = false;
  }, 5000);
}

_resizeConfetti();
window.addEventListener("resize", _resizeConfetti);
_confettiLoop();

if (sessionStorage.getItem("just_logged_in")) {
  sessionStorage.removeItem("just_logged_in");
  _startConfetti();
}

// ============================================
// CONDIVISIONE BRANO
// ============================================

function shareTrack(trackId) {
  const track =
    _trackRegistry.get(trackId) ||
    (state.currentTrack?.id === trackId ? state.currentTrack : null);
  if (!track) return;

  const url =
    track.trackViewUrl ||
    `https://music.apple.com/search?term=${encodeURIComponent(track.title + " " + track.artist)}`;
  const text = `${track.title} – ${track.artist}`;

  _openShareModal(track, url, text);
}

function _openShareModal(track, url, text) {
  document.getElementById("shareModalTitle").textContent = track.title;
  document.getElementById("shareModalArtist").textContent = track.artist;

  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);

  document.getElementById("shareWhatsApp").href =
    `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`;
  document.getElementById("shareTelegram").href =
    `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  document.getElementById("shareTwitter").href =
    `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  document.getElementById("shareCopyBtn").onclick = () => {
    navigator.clipboard.writeText(url).then(() => {
      bootstrap.Modal.getInstance(document.getElementById("shareModal")).hide();
      showToast("Link copiato!");
    });
  };

  new bootstrap.Modal(document.getElementById("shareModal")).show();
}
