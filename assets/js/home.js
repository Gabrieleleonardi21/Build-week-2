// ============================================
// HOME — init pagina e rendering contenuto principale
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Controllo autenticazione: senza sessione attiva torna al login
    if (!localStorage.getItem('session_active')) {
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

    // Fetch parallelo: album popolari + cover di tutte le playlist virtuali + podcast più ascoltati
    const [rawAlbums, vpCovers, rawPodcasts] = await Promise.all([
        cached('top_albums', () => itunesSearch('top hits', 'album', 8)),
        Promise.all(VIRTUAL_PLAYLISTS.map(p => getVirtualPlaylistCover(p))),
        cached('top_podcasts', () => itunesGetTopPodcasts(8))
    ]);

    const albums = rawAlbums.map(normalizeAlbum).filter(Boolean);
    const uniqueAlbums = [...new Map(albums.map(a => [a.id, a])).values()];

    const podcasts = rawPodcasts
        .map(normalizePodcast)
        .filter(Boolean);

    // Mappa id playlist → url cover per accesso rapido
    const coverMap = Object.fromEntries(VIRTUAL_PLAYLISTS.map((p, i) => [p.id, vpCovers[i]]));

    // Card-grid con tutte le playlist in evidenza
    const playlistGrid = make('div', 'card-grid');
    VIRTUAL_PLAYLISTS.forEach(p => {
        playlistGrid.append(makeCard(coverMap[p.id], p.title, p.description, 'playlist-' + p.id));
    });

    const podcastGrid = make('div', 'card-grid'); podcasts.forEach(podcast => {
        const card = make('div', 'album-card');
        card.addEventListener('click', () => {
            // noopener: impedisce alla pagina esterna di accedere a window.opener (tabnabbing)
            window.open(podcast.url, '_blank', 'noopener');
        });
        const img = make('img', 'album-cover');
        img.src = podcast.cover;
        img.alt = podcast.title;
        append(
            card,
            img,
            make('div', 'album-title', podcast.title),
            make('div', 'album-description', podcast.author)
        );

        podcastGrid.append(card);
    });

    const nodes = [
        make('h1', 'greeting-title', `${greeting}, ${state.displayName}`),
        make('h2', 'section-title', 'Playlist in evidenza'),
        playlistGrid,
        make('h2', 'section-title', '🎙️ Podcast più ascoltati'),
        podcastGrid,
    ];

    /* ******** Aggiunta sezione Brani Preferiti come card ******** */
    const likedTracks = Array.from(state.likedTracks.values()).slice(0, 6);
    if (likedTracks.length > 0) {
        const likedGrid = make('div', 'card-grid');
        likedTracks.forEach(track => {
            likedGrid.append(makeCard(track.cover, track.title, track.artist, 'track-' + track.id));
        });
        nodes.splice(1, 0, make('h2', 'section-title', 'I tuoi brani preferiti'), likedGrid);
    }

    // Playlist utente (sostituite la sezione "libreria" rimossa dalla MPA)
    if (
        state.userPlaylists.length > 0 ||
        state.recentTracks.length > 0
    ) {
        const userGrid = make('div', 'card-grid');
        if (state.recentTracks.length > 0) {
            userGrid.append(
                makeCard(
                    'assets/img/ppp.jpg',
                    'Ascoltati di recente',
                    `${state.recentTracks.length} brani`,
                    'recent-tracks'
                )
            );
        }
        state.userPlaylists.forEach(p => {
            const cover = "assets/img/ppp.jpg";
            userGrid.append(
                makeCard(
                    cover,
                    p.name,
                    `${p.tracks.length} brani`,
                    'userplaylist-' + p.id
                )
            );
        });
        nodes.splice(1,0,make('h2', 'section-title', 'Le tue playlist'),
            userGrid
        );
    }

    if (uniqueAlbums.length > 0) {
        const albumGrid = make('div', 'card-grid');
        uniqueAlbums.forEach(a => albumGrid.append(makeCard(a.cover, a.title, a.artist, 'album-' + a.id)));
        nodes.push(make('h2', 'section-title', 'Album popolari'), albumGrid);
    }

    container.replaceChildren(...nodes);
}
