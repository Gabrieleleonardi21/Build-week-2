// ============================================
// SPOTIFY WEB API - OAUTH PKCE + CHIAMATE API
// ============================================

// ➡️ CONFIGURA QUI: crea la tua app su https://developer.spotify.com/dashboard
// e aggiungi il tuo Redirect URI nelle impostazioni dell'app.
const SPOTIFY_CLIENT_ID = "YOUR_CLIENT_ID_HERE";

// URI di redirect: deve corrispondere ESATTAMENTE a quello registrato su Spotify.
// Es. con VS Code Live Server: 'http://127.0.0.1:5500/index.html'
const SPOTIFY_REDIRECT_URI = window.location.href.split("?")[0].split("#")[0];

const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// ============================================
// PKCE HELPERS
// ============================================

function generateCodeVerifier() {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ============================================
// AUTENTICAZIONE
// ============================================

async function loginWithSpotify() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("spotify_code_verifier", verifier);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href =
    "https://accounts.spotify.com/authorize?" + params.toString();
}

// Scambia il codice ricevuto nell'URL con un access token
async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  const verifier = localStorage.getItem("spotify_code_verifier");
  if (!verifier) return false;

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return false;

  const data = await res.json();
  saveTokens(data);
  localStorage.removeItem("spotify_code_verifier");

  // Rimuove il codice dall'URL senza ricaricare la pagina
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("spotify_refresh_token");
  if (!refreshToken) return false;

  const body = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return false;
  saveTokens(await res.json());
  return true;
}

function saveTokens(data) {
  localStorage.setItem("spotify_access_token", data.access_token);
  localStorage.setItem(
    "spotify_token_expiry",
    (Date.now() + data.expires_in * 1000).toString(),
  );
  if (data.refresh_token) {
    localStorage.setItem("spotify_refresh_token", data.refresh_token);
  }
}

async function getAccessToken() {
  const token = localStorage.getItem("spotify_access_token");
  const expiry = parseInt(localStorage.getItem("spotify_token_expiry") || "0");
  if (!token) return null;

  // Rinnova il token se scade entro 5 minuti
  if (Date.now() > expiry - 300000) {
    const ok = await refreshAccessToken();
    if (!ok) return null;
    return localStorage.getItem("spotify_access_token");
  }
  return token;
}

function isLoggedIn() {
  return !!localStorage.getItem("spotify_access_token");
}

function logoutSpotify() {
  [
    "spotify_access_token",
    "spotify_token_expiry",
    "spotify_refresh_token",
    "spotify_code_verifier",
  ].forEach((k) => localStorage.removeItem(k));
}

// ============================================
// FETCH HELPER
// ============================================

async function spotifyFetch(endpoint, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Non autenticato");

  const res = await fetch(SPOTIFY_API_BASE + endpoint, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Spotify API error " + res.status);
  }
  return res.json();
}

// ============================================
// CHIAMATE API
// ============================================

async function apiGetCurrentUser() {
  return spotifyFetch("/me");
}

async function apiGetFeaturedPlaylists() {
  const data = await spotifyFetch(
    "/browse/featured-playlists?limit=8&country=IT&locale=it_IT",
  );
  return data.playlists.items;
}

async function apiGetNewReleases() {
  const data = await spotifyFetch("/browse/new-releases?limit=8&country=IT");
  return data.albums.items;
}

async function apiGetCategories() {
  const data = await spotifyFetch(
    "/browse/categories?limit=20&country=IT&locale=it_IT",
  );
  return data.categories.items;
}

async function apiSearch(query) {
  const params = new URLSearchParams({
    q: query,
    type: "track,album",
    limit: 20,
    market: "IT",
  });
  return spotifyFetch("/search?" + params.toString());
}

async function apiGetAlbum(id) {
  return spotifyFetch("/albums/" + id + "?market=IT");
}

async function apiGetAlbumTracks(id, albumData) {
  const data = await spotifyFetch(
    "/albums/" + id + "/tracks?limit=50&market=IT",
  );
  // I track delle album non hanno l'oggetto album, lo aggiungiamo manualmente
  return data.items.map((t) => ({ ...t, album: albumData }));
}

async function apiGetPlaylist(id) {
  return spotifyFetch("/playlists/" + id + "?market=IT");
}

async function apiGetPlaylistTracks(id) {
  const fields = "items(track(id,name,artists,album,duration_ms,preview_url))";
  const data = await spotifyFetch(
    "/playlists/" + id + "/tracks?limit=50&market=IT&fields=" + fields,
  );
  return data.items.map((item) => item.track).filter(Boolean);
}

async function apiGetLikedTracks() {
  const data = await spotifyFetch("/me/tracks?limit=50&market=IT");
  return data.items.map((item) => item.track);
}

async function apiCheckLikedTracks(ids) {
  if (!ids.length) return [];
  return spotifyFetch("/me/tracks/contains?ids=" + ids.slice(0, 50).join(","));
}

async function apiAddLikedTrack(id) {
  return spotifyFetch("/me/tracks", {
    method: "PUT",
    body: JSON.stringify({ ids: [id] }),
  });
}

async function apiRemoveLikedTrack(id) {
  return spotifyFetch("/me/tracks", {
    method: "DELETE",
    body: JSON.stringify({ ids: [id] }),
  });
}

// ============================================
// NORMALIZZATORI (formato Spotify → formato app)
// ============================================

function normalizeTrack(track, albumOverride) {
  if (!track) return null;
  const album = albumOverride || track.album || {};
  const images = album.images || [];
  const cover = images[0]
    ? images[0].url
    : createCover("?", "#1db954", "#191414");
  return {
    id: track.id,
    title: track.name,
    artist: track.artists ? track.artists.map((a) => a.name).join(", ") : "",
    album: album.name || "",
    albumId: album.id || "",
    duration: Math.round((track.duration_ms || 0) / 1000),
    cover,
    previewUrl: track.preview_url || null,
  };
}

function normalizeAlbum(album) {
  if (!album) return null;
  return {
    id: album.id,
    title: album.name,
    artist: album.artists ? album.artists.map((a) => a.name).join(", ") : "",
    cover:
      album.images && album.images[0]
        ? album.images[0].url
        : createCover("?", "#1db954", "#191414"),
  };
}

function normalizePlaylist(playlist) {
  if (!playlist) return null;
  return {
    id: playlist.id,
    title: playlist.name,
    description: playlist.description || "",
    cover:
      playlist.images && playlist.images[0]
        ? playlist.images[0].url
        : createCover("?", "#1db954", "#191414"),
  };
}