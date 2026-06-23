// ============================================
// HOME — init pagina e rendering contenuto principale
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Controllo autenticazione: se non loggato torna al login
    if (!localStorage.getItem('display_name')) {
        location.href = 'login.html';
        return;
    }

    loadPersistedData();

    const content = document.getElementById('contentArea');

    // Registra il renderer della home: usato da refreshCurrentPage e popstate
    initShell(container => renderHome(container));

    // Se c'è una sub-pagina nell'hash (es. home.html#album-123), naviga lì
    const hash = window.location.hash.slice(1);
    if (hash) {
        navigateTo(decodeURIComponent(hash), false);
    } else {
        // renderCurrentMainPage gestisce spinner + errori (no caricamento infinito)
        await renderCurrentMainPage();
    }
});

// Renderizza la schermata principale con saluto, playlist e album in evidenza
async function renderHome(container) {
    const hour = new Date().getHours();
    let greeting = 'Buonasera';
    if (hour < 12) greeting = 'Buongiorno';
    else if (hour < 18) greeting = 'Buon pomeriggio';

    // Fetch parallelo: album popolari + cover di tutte le playlist virtuali
    const [rawAlbums, vpCovers] = await Promise.all([
        cached('top_albums', () => itunesSearch('top hits', 'album', 8)),
        Promise.all(VIRTUAL_PLAYLISTS.map(p => getVirtualPlaylistCover(p))),
    ]);

    const albums = rawAlbums.map(normalizeAlbum).filter(Boolean);
    const uniqueAlbums = [...new Map(albums.map(a => [a.id, a])).values()];

    // Mappa id playlist → url cover per accesso rapido
    const coverMap = Object.fromEntries(VIRTUAL_PLAYLISTS.map((p, i) => [p.id, vpCovers[i]]));

    // Quick-grid con le prime 6 playlist virtuali
    const quickGrid = make('div', 'quick-grid');
    VIRTUAL_PLAYLISTS.slice(0, 6).forEach(p => {
        const card = make('div', 'quick-card');
        card.addEventListener('click', () => navigateTo('playlist-' + p.id));

        const img = make('img');
        img.src = coverMap[p.id];
        img.alt = p.title;

        const overlay = make('div', 'play-overlay-quick');
        overlay.addEventListener('click', e => {
            e.stopPropagation();
            playPlaylistById(p.id);
        });
        overlay.append(make('i', 'bi bi-play-fill'));

        append(card, img, make('div', 'quick-card-title', p.title), overlay);
        quickGrid.append(card);
    });

    // Card-grid con tutte le playlist in evidenza
    const playlistGrid = make('div', 'card-grid');
    VIRTUAL_PLAYLISTS.forEach(p => {
        playlistGrid.append(makeCard(coverMap[p.id], p.title, p.description, 'playlist-' + p.id));
    });

    const nodes = [
        make('h1', 'greeting-title', `${greeting}, ${state.displayName}`),
        quickGrid,
        make('h2', 'section-title', 'Playlist in evidenza'),
        playlistGrid,
    ];

    // Playlist utente (sostituite la sezione "libreria" rimossa dalla MPA)
    if (state.userPlaylists.length > 0) {
        const userGrid = make('div', 'card-grid');
        state.userPlaylists.forEach(p => {
            const cover = "assets/img/ppp.jpg";
            userGrid.append(makeCard(cover, p.name, `${p.tracks.length} brani`, 'userplaylist-' + p.id));
        });
        // Inserisce le playlist utente prima delle playlist in evidenza
        nodes.splice(1, 0, make('h2', 'section-title', 'Le tue playlist'), userGrid);
    }

    if (uniqueAlbums.length > 0) {
        const albumGrid = make('div', 'card-grid');
        uniqueAlbums.forEach(a => albumGrid.append(makeCard(a.cover, a.title, a.artist, 'album-' + a.id)));
        nodes.push(make('h2', 'section-title', 'Album popolari'), albumGrid);
    }

    container.replaceChildren(...nodes);
}
