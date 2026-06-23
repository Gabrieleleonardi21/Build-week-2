// ============================================
// ITUNES SEARCH API — Zero configurazione
// Documentazione: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
// ============================================

const ITUNES_API = 'https://itunes.apple.com';

// Playlist virtuali: il contenuto viene cercato su iTunes al momento del click
const VIRTUAL_PLAYLISTS = [
    { id: 'vp_top_it',   title: 'Top Italia',   description: 'I brani più ascoltati in Italia',  term: 'pop italiana',       color1: '#ff6b35', color2: '#c9184a' },
    { id: 'vp_chill',    title: 'Chill Vibes',  description: 'Relax e buon umore',               term: 'chill lofi',         color1: '#00b4d8', color2: '#0077b6' },
    { id: 'vp_workout',  title: 'Workout Mix',  description: 'Energia pura per allenarti',        term: 'workout motivation', color1: '#f72585', color2: '#7209b7' },
    { id: 'vp_focus',    title: 'Focus Mode',   description: 'Concentrazione e produttività',     term: 'focus study',        color1: '#06ffa5', color2: '#0d3b66' },
    { id: 'vp_party',    title: 'Party Time',   description: 'Le hit per la tua festa',           term: 'party dance',        color1: '#ffba08', color2: '#dc2f02' },
    { id: 'vp_acoustic', title: 'Acustico',     description: 'Il meglio della musica acustica',  term: 'acoustic guitar',    color1: '#5a189a', color2: '#10002b' },
    { id: 'vp_indie',    title: 'Indie Vibes',  description: 'Indie e alternative del momento',  term: 'indie alternative',  color1: '#e63946', color2: '#1d3557' },
    { id: 'vp_rnb',      title: 'R&B Soul',     description: 'Soul, R&B e groove',               term: 'rnb soul',           color1: '#6a4c93', color2: '#1982c4' },
];

// Generi musicali con termine di ricerca iTunes
const GENRES = [
    { name: 'Pop',         term: 'pop',         color: 'linear-gradient(135deg, #ff6b35, #c9184a)' },
    { name: 'Rock',        term: 'rock',        color: 'linear-gradient(135deg, #d62828, #003049)' },
    { name: 'Hip Hop',     term: 'hip hop',     color: 'linear-gradient(135deg, #ffb703, #fb8500)' },
    { name: 'Elettronica', term: 'electronic',  color: 'linear-gradient(135deg, #00b4d8, #023e8a)' },
    { name: 'Jazz',        term: 'jazz',        color: 'linear-gradient(135deg, #7209b7, #3a0ca3)' },
    { name: 'Classica',    term: 'classical',   color: 'linear-gradient(135deg, #2d6a4f, #1b4332)' },
    { name: 'Indie',       term: 'indie',       color: 'linear-gradient(135deg, #f72585, #7209b7)' },
    { name: 'Latina',      term: 'latin',       color: 'linear-gradient(135deg, #ffba08, #d00000)' },
    { name: 'Reggae',      term: 'reggae',      color: 'linear-gradient(135deg, #2a9d8f, #264653)' },
    { name: 'R&B',         term: 'rnb soul',    color: 'linear-gradient(135deg, #6a4c93, #1982c4)' },
    { name: 'Country',     term: 'country',     color: 'linear-gradient(135deg, #bc6c25, #606c38)' },
    { name: 'Metal',       term: 'metal',       color: 'linear-gradient(135deg, #495057, #212529)' },
];

// ============================================
// CHIAMATE API — via JSONP (aggira CORS e ad-blocker)
// ============================================

// Inserisce un <script> con callback JSONP e restituisce una Promise con results[]
function _jsonp(url, params) {
    return new Promise((resolve, reject) => {
        // Nome callback univoco per evitare collisioni in caso di chiamate parallele
        const cbName = '__itcb' + Date.now() + Math.floor(Math.random() * 1e6);
        const script = document.createElement('script');

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout iTunes API'));
        }, 10000);

        function cleanup() {
            clearTimeout(timer);
            delete window[cbName];
            script.remove();
        }

        window[cbName] = (data) => {
            cleanup();
            resolve(data.results || []);
        };

        params.set('callback', cbName);
        script.src = `${url}?${params}`;
        script.onerror = () => {
            cleanup();
            reject(new Error('Rete non raggiungibile'));
        };
        document.head.append(script);
    });
}

// Cerca brani o album
async function itunesSearch(term, entity = 'song', limit = 20) {
    const params = new URLSearchParams({ term, media: 'music', entity, limit, country: 'it' });
    return _jsonp(`${ITUNES_API}/search`, params);
}

// Recupera un album con tutte le sue tracce
async function itunesGetAlbum(albumId) {
    const params = new URLSearchParams({ id: albumId, entity: 'song', country: 'it' });
    const results = await _jsonp(`${ITUNES_API}/lookup`, params);
    const album = results.find(r => r.wrapperType === 'collection') || results[0];
    const tracks = results.filter(r => r.wrapperType === 'track' && r.trackId);
    return { album, tracks };
}

// Cerca i brani di una playlist virtuale
async function itunesGetPlaylistTracks(playlistId) {
    const vp = VIRTUAL_PLAYLISTS.find(p => p.id === playlistId);
    if (!vp) return [];
    const items = await itunesSearch(vp.term, 'song', 25);
    return items.filter(i => i.wrapperType === 'track' && i.trackId);
}

async function itunesGetTopPodcasts(limit = 8) {
    const podcasts = await itunesSearch(
        'podcast',
        'podcast',
        limit
    );

    return podcasts.filter(
        p => p.wrapperType === 'track' || p.collectionId
    );
}

// ============================================
// NORMALIZZATORI (formato iTunes → formato app)
// ============================================

function normalizeTrack(item) {
    if (!item || !item.trackId) return null;
    const cover = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : createCover('?', '#555', '#333');
    return {
        id: String(item.trackId),
        title: item.trackName || '',
        artist: item.artistName || '',
        album: item.collectionName || '',
        albumId: String(item.collectionId || ''),
        duration: Math.round((item.trackTimeMillis || 0) / 1000),
        cover,
        previewUrl: item.previewUrl || null,
    };
}

function normalizeAlbum(item) {
    if (!item || !item.collectionId) return null;
    const cover = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : createCover('?', '#555', '#333');
    return {
        id: String(item.collectionId),
        title: item.collectionName || '',
        artist: item.artistName || '',
        cover,
        trackCount: item.trackCount || 0,
    };
}

function normalizePodcast(item) {
    if (!item) return null;

    const cover = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : createCover('🎙️', '#1db954', '#191414');

    return {
        id: String(item.collectionId || item.trackId),
        title: item.collectionName || item.trackName || '',
        author: item.artistName || '',
        cover,
        url: item.collectionViewUrl || item.trackViewUrl || '#'
    };
}
