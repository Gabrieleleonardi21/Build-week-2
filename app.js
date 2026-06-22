// ============================================
// SPOTIFY CLONE - LOGICA APPLICAZIONE
// ============================================

// STATO APPLICAZIONE
const state = {
    displayName: null,
    profilePhoto: null,
    currentTrack: null,
    currentPlaylist: [],
    currentIndex: 0,
    isPlaying: false,
    isShuffle: false,
    isRepeat: false,
    volume: 0.7,
    likedTracks: new Map(),   // Map<id, TrackObject> — persistito in localStorage
    userPlaylists: [],         // [{ id, name, tracks: [] }] — persistito in localStorage
    history: ['home'],
    historyIndex: 0,
};

// Elemento audio HTML5 per le anteprime 30s
const audio = document.getElementById('audioPlayer');

// Registro globale dei track renderizzati — usato da toggleLike e playTrackInList
const _trackRegistry = new Map();

// Cache per le risposte API — evita chiamate duplicate
const _cache = {};
async function cached(key, fn) {
    if (_cache[key]) return _cache[key];
    _cache[key] = await fn();
    return _cache[key];
}

// ============================================
// AVVIO — auto-login se già loggato
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    const saved = localStorage.getItem('display_name');
    if (saved) {
        state.displayName = saved;
        loadPersistedData();
        document.getElementById('loginScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');
        initApp();
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const errorEl = document.getElementById('loginEmailError');

    // Valida: campo vuoto o, se contiene @, verifica formato email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = user.includes('@');
    if (!user || (isEmail && !emailRegex.test(user))) {
        errorEl.classList.remove('d-none');
        return;
    }
    errorEl.classList.add('d-none');

    // Mostra spinner sul bottone durante l'accesso
    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.replaceChildren(
        make('span', { class: 'spinner-border spinner-border-sm me-2', role: 'status' }),
        'Accesso in corso...'
    );

    // Simulazione chiamata asincrona (sostituibile con fetch a un backend reale)
    await new Promise(resolve => setTimeout(resolve, 800));

    state.displayName = isEmail ? user.split('@')[0] : user;
    localStorage.setItem('display_name', state.displayName);
    loadPersistedData();
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('mainApp').classList.remove('d-none');
    btn.disabled = false;
    btn.textContent = 'ACCEDI';
    initApp();
}

// ============================================
// PERSISTENZA localStorage
// ============================================

function loadPersistedData() {
    // Liked tracks: array di [id, TrackObject]
    const liked = JSON.parse(localStorage.getItem('liked_tracks') || '[]');
    state.likedTracks = new Map(liked);

    // User playlists: array di { id, name, tracks }
    state.userPlaylists = JSON.parse(localStorage.getItem('user_playlists') || '[]');

    // Foto profilo
    state.profilePhoto = localStorage.getItem('profile_photo') || null;
}

function saveLikedTracks() {
    localStorage.setItem('liked_tracks', JSON.stringify([...state.likedTracks.entries()]));
}

function saveUserPlaylists() {
    localStorage.setItem('user_playlists', JSON.stringify(state.userPlaylists));
}

// ============================================
// INIT APP
// ============================================
function initApp() {
    updateUserMenu();
    setupPlayer();
    setupNavigation();
    renderUserPlaylists();
    showPage('home');
}

// ============================================
// NAVIGAZIONE
// ============================================
function setupNavigation() {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.page);
        });
    });

    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('forwardBtn').addEventListener('click', goForward);
    document.getElementById('logoBtn').addEventListener('click', () => navigateTo('home'));
    document.querySelector('.user-btn').addEventListener('click', () => navigateTo('profile'));

    document.getElementById('createPlaylistBtn').addEventListener('click', (e) => {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('playlistModal')).show();
    });

    document.getElementById('confirmPlaylistBtn').addEventListener('click', createPlaylist);
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
    document.getElementById('profilePhotoInput').addEventListener('change', previewProfilePhoto);
}

function navigateTo(page, pushHistory = true) {
    if (pushHistory) {
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push(page);
        state.historyIndex = state.history.length - 1;
    }
    showPage(page);
    updateActiveNav(page);
}

function updateActiveNav(page) {
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
}

function goBack() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        showPage(state.history[state.historyIndex]);
    }
}

function goForward() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        showPage(state.history[state.historyIndex]);
    }
}

// ============================================
// MOSTRA PAGINE (async)
// ============================================
async function showPage(page) {
    const content = document.getElementById('contentArea');
    showLoading(content);

    try {
        if (page === 'home')                       await renderHome(content);
        else if (page === 'search')                await renderSearch(content);
        else if (page === 'library')               await renderLibrary(content);
        else if (page === 'liked')                 renderLikedTracks(content);
        else if (page === 'profile')               renderProfile(content);
        else if (page.startsWith('album-'))        await renderAlbum(content, page.slice(6));
        else if (page.startsWith('playlist-'))     await renderPlaylist(content, page.slice(9));
        else if (page.startsWith('userplaylist-')) renderUserPlaylist(content, page.slice(13));
        else if (page.startsWith('genre-'))        await renderGenre(content, page.slice(6));
    } catch (e) {
        content.replaceChildren(
            make('div', { class: 'text-center mt-5 text-secondary' },
                make('i', { class: 'bi bi-exclamation-circle', style: 'font-size:48px;' }),
                make('p', { class: 'mt-3', text: 'Errore nel caricamento. Controlla la connessione e riprova.' }),
                make('small', { class: 'text-danger', text: e.message || String(e) })
            )
        );
        console.error(e);
    }

    content.parentElement.scrollTop = 0;
}

function showLoading(container) {
    container.replaceChildren(
        make('div', { class: 'text-center mt-5 text-secondary' },
            make('div', { class: 'spinner-border text-success', role: 'status' }),
            make('p', { class: 'mt-3', text: 'Caricamento...' })
        )
    );
}

function refreshCurrentPage() {
    showPage(state.history[state.historyIndex]);
}

// ============================================
// COVER PLAYLIST VIRTUALI
// Prende il primo risultato iTunes per il termine della playlist e usa il suo artwork
// ============================================
async function getVirtualPlaylistCover(p) {
    return cached('cover_' + p.id, async () => {
        const results = await itunesSearch(p.term, 'song', 1);
        const item = results[0];
        if (!item || !item.artworkUrl100) {
            return createCover(p.title.substring(0, 2).toUpperCase(), p.color1, p.color2);
        }
        return item.artworkUrl100.replace('100x100bb', '600x600bb');
    });
}

// ============================================
// HOME
// ============================================
async function renderHome(container) {
    const hour = new Date().getHours();
    let greeting = 'Buonasera';
    if (hour < 12) greeting = 'Buongiorno';
    else if (hour < 18) greeting = 'Buon pomeriggio';

    // Fetch in parallelo: album popolari + cover di tutte le virtual playlist
    const [rawAlbums, vpCovers] = await Promise.all([
        cached('top_albums', () => itunesSearch('top hits', 'album', 8)),
        Promise.all(VIRTUAL_PLAYLISTS.map(p => getVirtualPlaylistCover(p)))
    ]);

    const albums = rawAlbums.map(normalizeAlbum).filter(Boolean);
    const uniqueAlbums = [...new Map(albums.map(a => [a.id, a])).values()];

    // Mappa id → cover per accesso rapido
    const coverMap = Object.fromEntries(VIRTUAL_PLAYLISTS.map((p, i) => [p.id, vpCovers[i]]));

    // Quick-grid con le prime 6 playlist virtuali
    const quickGrid = make('div', { class: 'quick-grid' });
    VIRTUAL_PLAYLISTS.slice(0, 6).forEach(p => {
        quickGrid.append(
            make('div', { class: 'quick-card', onclick: () => navigateTo('playlist-' + p.id) },
                make('img', { src: coverMap[p.id], alt: p.title }),
                make('div', { class: 'quick-card-title', text: p.title }),
                make('div', { class: 'play-overlay-quick',
                    onclick: (e) => { e.stopPropagation(); playPlaylistById(p.id); } },
                    make('i', { class: 'bi bi-play-fill' })
                )
            )
        );
    });

    // Card-grid playlist in evidenza
    const playlistGrid = make('div', { class: 'card-grid' });
    VIRTUAL_PLAYLISTS.forEach(p => {
        playlistGrid.append(makeCard(coverMap[p.id], p.title, p.description, 'playlist-' + p.id));
    });

    const nodes = [
        make('h1', { class: 'greeting-title', text: `${greeting}, ${state.displayName}` }),
        quickGrid,
        make('h2', { class: 'section-title', text: 'Playlist in evidenza' }),
        playlistGrid,
    ];

    if (uniqueAlbums.length > 0) {
        const albumGrid = make('div', { class: 'card-grid' });
        uniqueAlbums.forEach(a => albumGrid.append(makeCard(a.cover, a.title, a.artist, 'album-' + a.id)));
        nodes.push(make('h2', { class: 'section-title', text: 'Album popolari' }), albumGrid);
    }

    container.replaceChildren(...nodes);
}

// ============================================
// RICERCA
// ============================================
async function renderSearch(container) {
    const resultsDiv = make('div', { id: 'searchResults' });

    const genreGrid = make('div', { class: 'genre-grid' });
    GENRES.forEach(g => {
        const card = make('div', { class: 'genre-card', text: g.name,
            onclick: () => navigateTo('genre-' + encodeURIComponent(g.name)) });
        card.style.background = g.color;
        genreGrid.append(card);
    });

    container.replaceChildren(
        make('div', { class: 'search-bar-container' },
            make('input', { type: 'text', class: 'search-input', id: 'searchInput',
                placeholder: 'Cosa vuoi ascoltare?' })
        ),
        resultsDiv,
        make('h2', { class: 'section-title', text: 'Sfoglia tutto' }),
        genreGrid
    );

    const input = document.getElementById('searchInput');
    let debounceTimer;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        // Debounce 400ms per non sovraccaricare l'API
        debounceTimer = setTimeout(() => performSearch(e.target.value), 400);
    });
    input.focus();
}

async function performSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    if (!query.trim()) { results.replaceChildren(); return; }

    results.replaceChildren(
        make('div', { class: 'text-secondary mt-3' },
            make('div', { class: 'spinner-border spinner-border-sm text-success me-2' }),
            'Ricerca in corso...'
        )
    );

    try {
        const [songItems, albumItems] = await Promise.all([
            itunesSearch(query, 'song', 20),
            itunesSearch(query, 'album', 8),
        ]);

        const tracks = songItems.map(normalizeTrack).filter(Boolean);
        const albums = albumItems.map(normalizeAlbum).filter(Boolean);
        const uniqueAlbums = [...new Map(albums.map(a => [a.id, a])).values()];

        const nodes = [];
        if (uniqueAlbums.length > 0) {
            const albumGrid = make('div', { class: 'card-grid' });
            uniqueAlbums.forEach(a => albumGrid.append(makeCard(a.cover, a.title, a.artist, 'album-' + a.id)));
            nodes.push(make('h2', { class: 'section-title', text: 'Album' }), albumGrid);
        }
        if (tracks.length > 0) {
            nodes.push(make('h2', { class: 'section-title', text: 'Brani' }), renderTrackList(tracks));
        }
        if (nodes.length === 0) {
            nodes.push(
                make('div', { class: 'text-center text-secondary mt-5' },
                    make('i', { class: 'bi bi-search', style: 'font-size:48px;' }),
                    make('p', { class: 'mt-3', text: `Nessun risultato per "${query}"` })
                )
            );
        }
        results.replaceChildren(...nodes);
    } catch (_) {
        results.replaceChildren(
            make('p', { class: 'text-secondary mt-3', text: 'Errore nella ricerca. Riprova.' })
        );
    }
}

async function renderGenre(container, genreName) {
    const genre = GENRES.find(g => g.name === decodeURIComponent(genreName));
    const term = genre ? genre.term : decodeURIComponent(genreName);
    const name = genre ? genre.name : decodeURIComponent(genreName);

    const items = await cached('genre_' + term, () => itunesSearch(term, 'song', 30));
    const tracks = items.map(normalizeTrack).filter(Boolean);

    container.replaceChildren(
        make('h1', { class: 'greeting-title', text: name }),
        renderTrackList(tracks)
    );
}

// ============================================
// LIBRERIA
// ============================================
async function renderLibrary(container) {
    const nodes = [make('h1', { class: 'greeting-title', text: 'La tua libreria' })];

    if (state.userPlaylists.length > 0) {
        const grid = make('div', { class: 'card-grid' });
        state.userPlaylists.forEach(p => {
            const cover = createCover(p.name.substring(0, 2).toUpperCase(), '#1db954', '#191414');
            grid.append(makeCard(cover, p.name, `${p.tracks.length} brani`, 'userplaylist-' + p.id));
        });
        nodes.push(make('h2', { class: 'section-title', text: 'Le tue playlist' }), grid);
    }

    const featuredPlaylists = VIRTUAL_PLAYLISTS.slice(0, 4);
    const featuredCovers = await Promise.all(featuredPlaylists.map(p => getVirtualPlaylistCover(p)));

    const featuredGrid = make('div', { class: 'card-grid' });
    featuredPlaylists.forEach((p, i) => {
        featuredGrid.append(makeCard(featuredCovers[i], p.title, p.description, 'playlist-' + p.id));
    });
    nodes.push(make('h2', { class: 'section-title', text: 'Playlist in evidenza' }), featuredGrid);

    container.replaceChildren(...nodes);
}

// ============================================
// ALBUM / PLAYLIST
// ============================================
async function renderAlbum(container, albumId) {
    const { album, tracks: rawTracks } = await cached('album_' + albumId, () => itunesGetAlbum(albumId));
    if (!album) {
        container.replaceChildren(make('p', { class: 'text-secondary mt-4', text: 'Album non trovato.' }));
        return;
    }

    const norm = normalizeAlbum(album);
    const tracks = rawTracks.map(normalizeTrack).filter(Boolean);
    tracks.forEach(t => _trackRegistry.set(t.id, t));

    container.replaceChildren(
        makePlaylistHeader(norm.cover, 'Album', norm.title,
            make('div', { class: 'playlist-meta' },
                make('strong', { text: norm.artist }),
                ` • ${tracks.length} brani`
            )
        ),
        make('div', { class: 'playlist-actions-row' },
            make('button', { class: 'btn-play-large', onclick: () => playTracksList(tracks) },
                make('i', { class: 'bi bi-play-fill' })
            ),
            make('button', { class: 'btn-icon', style: 'font-size:32px;' },
                make('i', { class: 'bi bi-three-dots' })
            )
        ),
        renderTrackList(tracks, true)
    );
}

async function renderPlaylist(container, playlistId) {
    const vp = VIRTUAL_PLAYLISTS.find(p => p.id === playlistId);
    if (!vp) {
        container.replaceChildren(make('p', { class: 'text-secondary mt-4', text: 'Playlist non trovata.' }));
        return;
    }

    const [cover, rawTracks] = await Promise.all([
        getVirtualPlaylistCover(vp),
        cached('vptracks_' + playlistId, () => itunesGetPlaylistTracks(playlistId))
    ]);
    const tracks = rawTracks.map(normalizeTrack).filter(Boolean);
    tracks.forEach(t => _trackRegistry.set(t.id, t));

    container.replaceChildren(
        makePlaylistHeader(cover, 'Playlist', vp.title,
            make('div', { class: 'playlist-meta', text: vp.description }),
            make('div', { class: 'playlist-meta mt-2', text: `${tracks.length} brani` })
        ),
        make('div', { class: 'playlist-actions-row' },
            make('button', { class: 'btn-play-large', onclick: () => playTracksList(tracks) },
                make('i', { class: 'bi bi-play-fill' })
            )
        ),
        renderTrackList(tracks)
    );
}

function renderUserPlaylist(container, playlistId) {
    const playlist = state.userPlaylists.find(p => p.id === playlistId);
    if (!playlist) return;

    const cover = createCover(playlist.name.substring(0, 2).toUpperCase(), '#1db954', '#191414');
    playlist.tracks.forEach(t => _trackRegistry.set(t.id, t));

    const tracksEl = playlist.tracks.length > 0
        ? renderTrackList(playlist.tracks)
        : make('p', { class: 'text-secondary mt-4', text: 'Questa playlist è vuota.' });

    container.replaceChildren(
        makePlaylistHeader(cover, 'Playlist', playlist.name,
            make('div', { class: 'playlist-meta' },
                make('strong', { text: state.displayName }),
                ` • ${playlist.tracks.length} brani`
            )
        ),
        make('div', { class: 'playlist-actions-row' },
            make('button', { class: 'btn-play-large', onclick: () => playTracksList(playlist.tracks) },
                make('i', { class: 'bi bi-play-fill' })
            )
        ),
        tracksEl
    );
}

function renderLikedTracks(container) {
    const likedList = Array.from(state.likedTracks.values());
    likedList.forEach(t => _trackRegistry.set(t.id, t));

    const nodes = [
        makePlaylistHeader(null, 'Playlist', 'Brani che ti piacciono',
            make('div', { class: 'playlist-meta' },
                make('strong', { text: state.displayName }),
                ` • ${likedList.length} brani`
            )
        ),
    ];

    if (likedList.length > 0) {
        nodes.push(
            make('div', { class: 'playlist-actions-row' },
                make('button', { class: 'btn-play-large', onclick: () => playTracksList(likedList) },
                    make('i', { class: 'bi bi-play-fill' })
                )
            ),
            renderTrackList(likedList)
        );
    } else {
        nodes.push(
            make('div', { class: 'text-center mt-5 text-secondary' },
                make('i', { class: 'bi bi-heart', style: 'font-size:48px;' }),
                make('p', { class: 'mt-3', text: 'Non hai ancora salvato brani. Clicca sul cuore ♥ per aggiungerli.' })
            )
        );
    }

    container.replaceChildren(...nodes);
}

// ============================================
// PROFILO UTENTE
// ============================================
function renderProfile(container) {
    const initial = state.displayName.charAt(0).toUpperCase();
    const likedCount = state.likedTracks.size;

    const avatarEl = state.profilePhoto
        ? make('div', { class: 'playlist-cover-large',
              style: { borderRadius: '50%', backgroundImage: `url('${state.profilePhoto}')`,
                       backgroundSize: 'cover', backgroundPosition: 'center' } })
        : make('div', { class: 'playlist-cover-large',
              style: 'border-radius:50%; background:linear-gradient(135deg,#1db954,#191414); display:flex; align-items:center; justify-content:center;' },
              make('span', { style: 'font-size:90px; font-weight:900; color:white;', text: initial })
          );

    const metaText = `${state.userPlaylists.length} playlist • ${likedCount} brani salvati`;

    const header = make('div', { class: 'playlist-header' },
        avatarEl,
        make('div', { class: 'playlist-header-info' },
            make('div', { class: 'playlist-type', text: 'Profilo' }),
            make('div', { class: 'playlist-name-large', text: state.displayName }),
            make('div', { class: 'playlist-meta', text: metaText })
        )
    );

    const actionsRow = make('div', { class: 'playlist-actions-row' },
        make('button', { class: 'btn btn-spotify', onclick: openProfileModal },
            make('i', { class: 'bi bi-pencil-fill' }),
            ' Modifica profilo'
        ),
        make('button', { class: 'btn-icon', style: 'font-size:32px;', onclick: logout },
            make('i', { class: 'bi bi-box-arrow-right' })
        )
    );

    const nodes = [header, actionsRow];

    if (state.userPlaylists.length > 0) {
        const grid = make('div', { class: 'card-grid' });
        state.userPlaylists.forEach(p => {
            const cover = createCover(p.name.substring(0, 2).toUpperCase(), '#1db954', '#191414');
            grid.append(makeCard(cover, p.name, `${p.tracks.length} brani`, 'userplaylist-' + p.id));
        });
        nodes.push(make('h2', { class: 'section-title', text: 'Le tue playlist' }), grid);
    }

    container.replaceChildren(...nodes);
}

function logout() {
    localStorage.removeItem('display_name');
    localStorage.removeItem('profile_photo');
    state.displayName = null;
    state.profilePhoto = null;
    state.isPlaying = false;
    audio.pause();
    audio.src = '';
    document.getElementById('mainApp').classList.add('d-none');
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('loginForm').reset();
}

// ============================================
// MENU UTENTE / AVATAR
// ============================================
function updateUserMenu() {
    document.getElementById('userName').textContent = state.displayName;
    const userBtn = document.querySelector('.user-btn');
    const iconOrImg = userBtn.querySelector('i:first-child, .user-avatar-img');
    if (state.profilePhoto) {
        if (iconOrImg && iconOrImg.tagName === 'IMG') {
            iconOrImg.src = state.profilePhoto;
        } else {
            const img = document.createElement('img');
            img.className = 'user-avatar-img';
            img.src = state.profilePhoto;
            img.alt = state.displayName;
            if (iconOrImg) iconOrImg.replaceWith(img);
        }
    } else if (iconOrImg && iconOrImg.tagName === 'IMG') {
        const icon = document.createElement('i');
        icon.className = 'bi bi-person-circle';
        iconOrImg.replaceWith(icon);
    }
}

// ============================================
// MODIFICA PROFILO
// ============================================
let tempProfilePhoto = null;

function openProfileModal() {
    tempProfilePhoto = state.profilePhoto;
    document.getElementById('editDisplayName').value = state.displayName;
    updatePhotoPreview(state.profilePhoto);
    new bootstrap.Modal(document.getElementById('profileModal')).show();
}

function updatePhotoPreview(photo) {
    const preview = document.getElementById('profilePhotoEdit');
    const placeholder = document.getElementById('profilePhotoPlaceholder');
    if (photo) {
        preview.style.backgroundImage = `url('${photo}')`;
        placeholder.style.display = 'none';
    } else {
        preview.style.backgroundImage = '';
        placeholder.style.display = 'block';
    }
}

function previewProfilePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { tempProfilePhoto = ev.target.result; updatePhotoPreview(tempProfilePhoto); };
    reader.readAsDataURL(file);
}

function saveProfile() {
    const name = document.getElementById('editDisplayName').value.trim();
    if (name) {
        state.displayName = name;
        localStorage.setItem('display_name', name);
    }
    state.profilePhoto = tempProfilePhoto;
    if (tempProfilePhoto) localStorage.setItem('profile_photo', tempProfilePhoto);
    else localStorage.removeItem('profile_photo');
    updateUserMenu();
    bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
    refreshCurrentPage();
}

// ============================================
// HELPER: intestazione playlist/album/profilo
// coverSrc = null → riquadro gradiente con cuore (liked tracks)
// ============================================
function makePlaylistHeader(coverSrc, type, title, ...metaNodes) {
    const coverEl = coverSrc
        ? make('img', { src: coverSrc, alt: title, class: 'playlist-cover-large' })
        : make('div', { class: 'playlist-cover-large',
              style: 'background:linear-gradient(135deg,#450af5,#c4efd9); display:flex; align-items:center; justify-content:center;' },
              make('i', { class: 'bi bi-heart-fill', style: 'font-size:80px; color:white;' })
          );

    return make('div', { class: 'playlist-header' },
        coverEl,
        make('div', { class: 'playlist-header-info' },
            make('div', { class: 'playlist-type', text: type }),
            make('div', { class: 'playlist-name-large', text: title }),
            ...metaNodes
        )
    );
}

// ============================================
// CARD HELPER
// ============================================
function makeCard(cover, title, description, page) {
    return make('div', { class: 'album-card', onclick: () => navigateTo(page) },
        make('img', { src: cover, alt: title, class: 'album-cover' }),
        make('div', { class: 'album-title', text: title }),
        make('div', { class: 'album-description', text: description }),
        make('div', { class: 'play-overlay',
            onclick: (e) => { e.stopPropagation(); quickPlay(page); } },
            make('i', { class: 'bi bi-play-fill' })
        )
    );
}

async function quickPlay(page) {
    if (page.startsWith('album-')) {
        const id = page.slice(6);
        const { tracks } = await cached('album_' + id, () => itunesGetAlbum(id));
        playTracksList(tracks.map(normalizeTrack).filter(Boolean));
    } else if (page.startsWith('playlist-')) {
        await playPlaylistById(page.slice(9));
    }
}

async function playPlaylistById(playlistId) {
    const raw = await cached('vptracks_' + playlistId, () => itunesGetPlaylistTracks(playlistId));
    playTracksList(raw.map(normalizeTrack).filter(Boolean));
}

// ============================================
// RENDER TRACKLIST
// ============================================

// Costruisce una singola riga della tracklist come elemento DOM
function makeTrackRow(track, index, ids, showAlbumCol) {
    const isPlaying = state.currentTrack && state.currentTrack.id === track.id;
    const isLiked = state.likedTracks.has(track.id);

    // Numero di traccia o icona volume se in riproduzione
    const numDiv = make('div', { class: 'track-number' });
    if (isPlaying && state.isPlaying) {
        numDiv.append(make('i', { class: 'bi bi-volume-up-fill' }));
    } else {
        numDiv.textContent = String(index + 1);
    }

    // Titolo con icona muto opzionale
    const nameDiv = make('div', { class: 'track-name', text: track.title });
    if (!track.previewUrl) {
        nameDiv.append(make('span', {
            title: 'Anteprima non disponibile',
            style: 'font-size:11px;color:#555;margin-left:4px;',
            text: '🔇',
        }));
    }

    // Bottone like
    const likeIcon = make('i', { class: `bi bi-heart${isLiked ? '-fill' : ''}` });
    if (isLiked) likeIcon.style.color = 'var(--spotify-green)';
    const likeBtn = make('button', { class: 'btn-icon',
        onclick: (e) => { e.stopPropagation(); toggleLike(track.id); } },
        likeIcon
    );

    const row = make('div', { class: `track-row${isPlaying ? ' playing' : ''}` },
        numDiv,
        make('div', { class: 'track-info' },
            make('img', { src: track.cover, alt: track.title }),
            make('div', { class: 'track-info-text' },
                nameDiv,
                make('div', { class: 'track-artist-small', text: track.artist })
            )
        ),
        make('div', { class: 'track-album', text: showAlbumCol ? track.album : track.artist }),
        make('div', {}, likeBtn),
        make('div', { class: 'track-duration', text: formatDuration(track.duration) })
    );

    // Double-click usa closure su ids — no JSON inline, no onclick string
    row.addEventListener('dblclick', () => playTrackInList(track.id, ids));
    return row;
}

function renderTrackList(trackList, showAlbumCol = true) {
    // Registra tutti i track per lookup futuro (like, play)
    trackList.forEach(t => _trackRegistry.set(t.id, t));
    const ids = trackList.map(t => t.id);

    return make('div', { class: 'tracklist' },
        make('div', { class: 'tracklist-header' },
            make('div', { text: '#' }),
            make('div', { text: 'Titolo' }),
            make('div', { text: showAlbumCol ? 'Album' : 'Artista' }),
            make('div'),
            make('div', {}, make('i', { class: 'bi bi-clock' }))
        ),
        ...trackList.map((track, index) => makeTrackRow(track, index, ids, showAlbumCol))
    );
}

// ============================================
// PLAYER — HTML5 Audio API
// ============================================
function setupPlayer() {
    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('prevBtn').addEventListener('click', prevTrack);
    document.getElementById('nextBtn').addEventListener('click', nextTrack);
    document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);
    document.getElementById('likeBtn').addEventListener('click', () => {
        if (state.currentTrack) toggleLike(state.currentTrack.id);
    });

    // Seek sulla progress bar
    document.getElementById('progressContainer').addEventListener('click', (e) => {
        if (!state.currentTrack || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });

    // Controllo volume
    document.getElementById('volumeContainer').addEventListener('click', (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        state.volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.volume = state.volume;
        document.getElementById('volumeFill').style.width = (state.volume * 100) + '%';
        updateVolumeIcon();
    });

    document.getElementById('volumeBtn').addEventListener('click', () => {
        state.volume = state.volume > 0 ? 0 : 0.7;
        audio.volume = state.volume;
        document.getElementById('volumeFill').style.width = (state.volume * 100) + '%';
        updateVolumeIcon();
    });

    // Aggiorna la barra di avanzamento in tempo reale
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        document.getElementById('progressFill').style.width = (audio.currentTime / audio.duration * 100) + '%';
        document.getElementById('currentTime').textContent = formatDuration(Math.floor(audio.currentTime));
    });

    audio.addEventListener('ended', () => {
        if (state.isRepeat) { audio.currentTime = 0; audio.play(); }
        else nextTrack();
    });

    audio.volume = state.volume;
}

function playTrack(track) {
    if (!track) return;
    state.currentTrack = track;
    state.isPlaying = false;

    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.artist;
    const cover = document.getElementById('playerCover');
    cover.src = track.cover;
    cover.style.display = 'block';
    document.getElementById('totalTime').textContent = formatDuration(track.duration);
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('currentTime').textContent = '0:00';

    if (track.previewUrl) {
        audio.src = track.previewUrl;
        audio.play().then(() => {
            state.isPlaying = true;
            updatePlayButton();
            refreshCurrentPage();
        }).catch(() => {});
    } else {
        // Nessuna anteprima: mostra info ma non riproduce
        audio.src = '';
        updatePlayButton();
        refreshCurrentPage();
    }

    updateLikeBtn();
}

function playTracksList(trackList) {
    if (!trackList || trackList.length === 0) return;
    const filtered = trackList.filter(Boolean);
    state.currentPlaylist = filtered;
    state.currentIndex = 0;
    playTrack(filtered[0]);
}

function playTrackInList(trackId, ids) {
    const playlist = ids.map(id => _trackRegistry.get(id)).filter(Boolean);
    const idx = playlist.findIndex(t => t.id === trackId);
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
        audio.play().then(() => { state.isPlaying = true; updatePlayButton(); refreshCurrentPage(); }).catch(() => {});
        return;
    }
    updatePlayButton();
    refreshCurrentPage();
}

function updatePlayButton() {
    document.querySelector('#playBtn i').className = state.isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
}

function prevTrack() {
    if (state.currentPlaylist.length === 0) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    state.currentIndex = (state.currentIndex - 1 + state.currentPlaylist.length) % state.currentPlaylist.length;
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
    document.getElementById('shuffleBtn').classList.toggle('active', state.isShuffle);
}

function toggleRepeat() {
    state.isRepeat = !state.isRepeat;
    document.getElementById('repeatBtn').classList.toggle('active', state.isRepeat);
}

function updateVolumeIcon() {
    const icon = document.querySelector('#volumeBtn i');
    if (state.volume === 0)       icon.className = 'bi bi-volume-mute-fill';
    else if (state.volume < 0.5)  icon.className = 'bi bi-volume-down-fill';
    else                          icon.className = 'bi bi-volume-up-fill';
}

// ============================================
// LIKE — salvati in localStorage
// ============================================
function toggleLike(trackId) {
    if (state.likedTracks.has(trackId)) {
        state.likedTracks.delete(trackId);
    } else {
        // Cerca il track nel registry o nel player corrente
        const track = _trackRegistry.get(trackId)
            || (state.currentTrack?.id === trackId ? state.currentTrack : null);
        if (track) state.likedTracks.set(trackId, track);
    }
    saveLikedTracks();
    updateLikeBtn();
    refreshCurrentPage();
}

function updateLikeBtn() {
    if (!state.currentTrack) return;
    const liked = state.likedTracks.has(state.currentTrack.id);
    const icon = document.querySelector('#likeBtn i');
    icon.className = liked ? 'bi bi-heart-fill' : 'bi bi-heart';
    icon.style.color = liked ? 'var(--spotify-green)' : '';
}

// ============================================
// PLAYLIST UTENTE — salvate in localStorage
// ============================================
function createPlaylist() {
    const name = document.getElementById('newPlaylistName').value.trim();
    if (!name) return;
    state.userPlaylists.push({ id: 'up' + Date.now(), name, tracks: [] });
    document.getElementById('newPlaylistName').value = '';
    bootstrap.Modal.getInstance(document.getElementById('playlistModal')).hide();
    saveUserPlaylists();
    renderUserPlaylists();
}

function renderUserPlaylists() {
    const container = document.getElementById('userPlaylists');
    container.replaceChildren(
        ...state.userPlaylists.map(p => {
            const a = document.createElement('a');
            a.className = 'user-playlist-item';
            a.textContent = p.name;
            a.onclick = () => navigateTo('userplaylist-' + p.id);
            return a;
        })
    );
}