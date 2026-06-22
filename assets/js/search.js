// ============================================
// RICERCA — init pagina e rendering campo di ricerca + generi
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('display_name')) {
        location.href = 'login.html';
        return;
    }

    loadPersistedData();

    const content = document.getElementById('contentArea');

    initShell(container => renderSearch(container));

    const hash = window.location.hash.slice(1);
    if (hash) {
        navigateTo(decodeURIComponent(hash), false);
    } else {
        showLoading(content);
        await renderSearch(content);
    }
});

// Renderizza il campo di ricerca e la griglia dei generi
async function renderSearch(container) {
    const resultsDiv = make('div');
    resultsDiv.id = 'searchResults';

    const genreGrid = make('div', 'genre-grid');
    GENRES.forEach(g => {
        const card = make('div', 'genre-card', g.name);
        card.style.background = g.color;
        card.addEventListener('click', () => navigateTo('genre-' + encodeURIComponent(g.name)));
        genreGrid.append(card);
    });

    const searchInput = make('input', 'search-input');
    searchInput.type = 'text';
    searchInput.id = 'searchInput';
    searchInput.placeholder = 'Cosa vuoi ascoltare?';

    // Ripristina l'ultima query se si torna alla pagina dopo un like/play
    if (state.lastSearchQuery) searchInput.value = state.lastSearchQuery;

    container.replaceChildren(
        append(make('div', 'search-bar-container'), searchInput),
        resultsDiv,
        make('h2', 'section-title', 'Sfoglia tutto'),
        genreGrid,
    );

    let debounceTimer;
    searchInput.addEventListener('input', e => {
        clearTimeout(debounceTimer);
        state.lastSearchQuery = e.target.value;
        // Debounce 400ms per non sovraccaricare l'API
        debounceTimer = setTimeout(() => performSearch(e.target.value), 400);
    });
    searchInput.focus();

    // Se c'era una ricerca attiva (es. dopo refresh da like), la riesegue subito
    if (state.lastSearchQuery) {
        await performSearch(state.lastSearchQuery);
    }
}

async function performSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    if (!query.trim()) {
        results.replaceChildren();
        return;
    }

    const loading = make('div', 'text-secondary mt-3');
    append(loading, make('div', 'spinner-border spinner-border-sm text-success me-2'), 'Ricerca in corso...');
    results.replaceChildren(loading);

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
            const albumGrid = make('div', 'card-grid');
            uniqueAlbums.forEach(a => albumGrid.append(makeCard(a.cover, a.title, a.artist, 'album-' + a.id)));
            nodes.push(make('h2', 'section-title', 'Album'), albumGrid);
        }
        if (tracks.length > 0) {
            nodes.push(make('h2', 'section-title', 'Brani'), renderTrackList(tracks));
        }
        if (nodes.length === 0) {
            const empty = make('div', 'text-center text-secondary mt-5');
            const icon = make('i', 'bi bi-search');
            icon.style.fontSize = '48px';
            append(empty, icon, make('p', 'mt-3', `Nessun risultato per "${query}"`));
            nodes.push(empty);
        }
        results.replaceChildren(...nodes);
    } catch (_) {
        results.replaceChildren(make('p', 'text-secondary mt-3', 'Errore nella ricerca. Riprova.'));
    }
}
