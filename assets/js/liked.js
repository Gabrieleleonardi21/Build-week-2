// ============================================
// BRANI PREFERITI — init pagina e rendering lista liked tracks
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('display_name')) {
        location.href = 'login.html';
        return;
    }

    loadPersistedData();

    const content = document.getElementById('contentArea');

    initShell(container => renderLikedTracks(container));
    renderLikedTracks(content);
});

// Renderizza la lista dei brani salvati con intestazione e tracklist
function renderLikedTracks(container) {
    const likedList = Array.from(state.likedTracks.values());
    likedList.forEach(t => _trackRegistry.set(t.id, t));

    const meta = make('div', 'playlist-meta');
    append(meta, make('strong', '', state.displayName), ` • ${likedList.length} brani`);

    const nodes = [makePlaylistHeader(null, 'Playlist', 'Brani che ti piacciono', meta)];

    if (likedList.length > 0) {
        const playBtn = make('button', 'btn-play-large');
        playBtn.addEventListener('click', () => playTracksList(likedList));
        playBtn.append(make('i', 'bi bi-play-fill'));

        nodes.push(
            append(make('div', 'playlist-actions-row'), playBtn),
            renderTrackList(likedList),
        );
    } else {
        const empty = make('div', 'text-center mt-5 text-secondary');
        const icon = make('i', 'bi bi-heart');
        icon.style.fontSize = '48px';
        append(empty, icon, make('p', 'mt-3', 'Non hai ancora salvato brani. Clicca sul cuore ♥ per aggiungerli.'));
        nodes.push(empty);
    }

    container.replaceChildren(...nodes);
}