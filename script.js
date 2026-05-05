const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const SCOPES = ['user-top-read'];

const elements = {
    clientIdInput: document.getElementById('client-id'),
    saveClientIdButton: document.getElementById('save-client-id'),
    loginButton: document.getElementById('login-button'),
    logoutButton: document.getElementById('logout-button'),
    statusMessage: document.getElementById('status-message'),
    profileSummary: document.getElementById('profile-summary'),
    topTracks: document.getElementById('top-tracks'),
    topArtists: document.getElementById('top-artists'),
    compatibilityScore: document.getElementById('compatibility-score'),
    compatibilityText: document.getElementById('compatibility-text'),
    favoriteBooks: document.getElementById('favorite-books'),
    favoriteMovies: document.getElementById('favorite-movies'),
    favoritePodcasts: document.getElementById('favorite-podcasts'),
    friendCircle: document.getElementById('friend-circle'),
    savePreferencesButton: document.getElementById('save-preferences'),
    manualSummary: document.getElementById('manual-summary')
};

window.addEventListener('DOMContentLoaded', async () => {
    loadSavedClientId();
    loadManualPreferences();
    bindEvents();

    const code = new URLSearchParams(window.location.search).get('code');

    if (code) {
        await exchangeCodeForToken(code);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = sessionStorage.getItem('spotify_access_token');

    if (token) {
        await loadSpotifyDashboard(token);
    }
});

function bindEvents() {
    elements.saveClientIdButton.addEventListener('click', saveClientId);
    elements.loginButton.addEventListener('click', startSpotifyLogin);
    elements.logoutButton.addEventListener('click', logout);
    elements.savePreferencesButton.addEventListener('click', saveManualPreferences);
}

function loadSavedClientId() {
    const savedClientId = localStorage.getItem('spotify_client_id') || '';
    elements.clientIdInput.value = savedClientId;
}

function saveClientId() {
    const clientId = elements.clientIdInput.value.trim();

    if (!clientId) {
        setStatus('Please enter your Spotify Client ID first', true);
        return;
    }

    localStorage.setItem('spotify_client_id', clientId);
    setStatus('Client ID saved - you can connect Spotify now!!');
}

async function startSpotifyLogin() {
    const clientId = elements.clientIdInput.value.trim() || localStorage.getItem('spotify_client_id');

    if (!clientId) {
        setStatus('Please paste and save your Spotify Client ID first!', true);
        return;
    }

    localStorage.setItem('spotify_client_id', clientId);

    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);

    sessionStorage.setItem('spotify_code_verifier', verifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: SCOPES.join(' '),
        code_challenge_method: 'S256',
        code_challenge: challenge,
        redirect_uri: window.location.origin + window.location.pathname
    });

    window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
    const clientId = localStorage.getItem('spotify_client_id');
    const verifier = sessionStorage.getItem('spotify_code_verifier');

    if (!clientId || !verifier) {
        setStatus('Missing Spotify login details, please connect again!', true);
        return;
    }

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: window.location.origin + window.location.pathname,
            code_verifier: verifier
        })
    });

    if (!response.ok) {
        setStatus('Spotify authorization failed, check your Client ID and redirect URI pls', true);
        return;
    }

    const tokenData = await response.json();
    sessionStorage.setItem('spotify_access_token', tokenData.access_token);
    sessionStorage.removeItem('spotify_code_verifier');
}

async function loadSpotifyDashboard(token) {
    try {
        setStatus('Loading your Spotify taste profile...');

        const [profile, tracks, artists] = await Promise.all([
            spotifyFetch('/me', token),
            spotifyFetch('/me/top/tracks?limit=8&time_range=medium_term', token),
            spotifyFetch('/me/top/artists?limit=8&time_range=medium_term', token)
        ]);

        renderProfile(profile, tracks, artists);
        renderTracks(tracks.items || []);
        renderArtists(artists.items || []);
        updateCompatibilityScore(tracks.items || [], artists.items || []);

        elements.loginButton.classList.add('hidden');
        elements.logoutButton.classList.remove('hidden');
        setStatus('Spotify connected successfully.', false);
    } catch (error) {
        console.error(error);
        setStatus('Could not load Spotify data :( - please log in again', true);
    }
}

async function spotifyFetch(endpoint, token) {
    const response = await fetch(`${SPOTIFY_API_URL}${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify request failed: ${endpoint}`);
    }

    return response.json();
}

function renderProfile(profile, tracks, artists) {
    const topTrack = tracks.items?.[0]?.name || 'Not available';
    const topArtist = artists.items?.[0]?.name || 'Not available';

    elements.profileSummary.classList.remove('empty-state');
    elements.profileSummary.innerHTML = `
        <div class="avatar">${escapeHtml((profile.display_name || 'U').charAt(0))}</div>
        <div>
            <h3>${escapeHtml(profile.display_name || 'Spotify User')}</h3>
            <p>Top track: ${escapeHtml(topTrack)}</p>
            <p>Top artist: ${escapeHtml(topArtist)}</p>
        </div>
    `;
}

function renderTracks(tracks) {
    elements.topTracks.classList.remove('empty-state');
    elements.topTracks.innerHTML = tracks.map((track, index) => {
        const imageUrl = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || '';
        const artistNames = track.artists.map(artist => artist.name).join(', ');
        const spotifyUrl = track.external_urls?.spotify || '#';

        return `
            <a class="media-item" href="${spotifyUrl}" target="_blank" rel="noopener noreferrer">
                <span class="rank">${index + 1}</span>
                ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(track.name)} album cover">` : ''}
                <span>
                    <strong>${escapeHtml(track.name)}</strong>
                    <small>${escapeHtml(artistNames)}</small>
                </span>
            </a>
        `;
    }).join('');
}

function renderArtists(artists) {
    elements.topArtists.classList.remove('empty-state');

    if (!artists || artists.length === 0) {
        elements.topArtists.innerHTML = '<p>No artists loaded yet.</p>';
        return;
    }

    elements.topArtists.innerHTML = artists.map(artist => {
        const imageUrl = artist.images?.[1]?.url || artist.images?.[0]?.url || '';
        const genres = artist.genres?.slice(0, 2).join(', ') || 'Genre unavailable';
        const spotifyUrl = artist.external_urls?.spotify || '#';

        return `
            <a class="artist-card" href="${spotifyUrl}" target="_blank" rel="noopener noreferrer">
                ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(artist.name)}">` : '<div class="artist-placeholder">♪</div>'}
                <strong>${escapeHtml(artist.name)}</strong>
                <small>${escapeHtml(genres)}</small>
            </a>
        `;
    }).join('');
}

function saveManualPreferences() {
    const preferences = {
        books: elements.favoriteBooks.value.trim(),
        movies: elements.favoriteMovies.value.trim(),
        podcasts: elements.favoritePodcasts.value.trim(),
        friends: elements.friendCircle.value.trim()
    };

    localStorage.setItem('manual_preferences', JSON.stringify(preferences));
    renderManualPreferences(preferences);
    updateCompatibilityScore([], []);

    elements.favoriteBooks.value = '';
    elements.favoriteMovies.value = '';
    elements.favoritePodcasts.value = '';
    elements.friendCircle.value = '';

    setStatus('Manual preferences saved locally.');
}

function loadManualPreferences() {
    const savedPreferences = JSON.parse(localStorage.getItem('manual_preferences') || '{}');

    elements.favoriteBooks.value = savedPreferences.books || '';
    elements.favoriteMovies.value = savedPreferences.movies || '';
    elements.favoritePodcasts.value = savedPreferences.podcasts || '';
    elements.friendCircle.value = savedPreferences.friends || '';

    renderManualPreferences(savedPreferences);
}

function renderManualPreferences(preferences) {
    const values = [preferences.books, preferences.movies, preferences.podcasts, preferences.friends].filter(Boolean);

    if (values.length === 0) {
        elements.manualSummary.innerHTML = '<p>No manual preferences saved yet.</p>';
        return;
    }

    elements.manualSummary.innerHTML = `
        <p><strong>Books:</strong> ${escapeHtml(preferences.books || 'None added')}</p>
        <p><strong>Movies:</strong> ${escapeHtml(preferences.movies || 'None added')}</p>
        <p><strong>Podcasts:</strong> ${escapeHtml(preferences.podcasts || 'None added')}</p>
        <p><strong>Circle:</strong> ${escapeHtml(preferences.friends || 'None added')}</p>
    `;
}

function updateCompatibilityScore(tracks, artists) {
    const preferences = JSON.parse(localStorage.getItem('manual_preferences') || '{}');
    const manualCount = Object.values(preferences).join(',').split(',').map(item => item.trim()).filter(Boolean).length;
    const spotifyCount = tracks.length + artists.length;
    const score = Math.min(100, 45 + spotifyCount * 2 + manualCount * 3);

    if (spotifyCount === 0 && manualCount === 0) {
        elements.compatibilityScore.textContent = '--';
        elements.compatibilityText.textContent = 'Connect Spotify and add preferences to preview compatibility.';
        return;
    }

    elements.compatibilityScore.textContent = score;
    elements.compatibilityText.textContent = 'Prototype score based on Spotify taste depth plus manually entered books, movies, podcasts, and friend circle data.';
}

function logout() {
    sessionStorage.removeItem('spotify_access_token');
    sessionStorage.removeItem('spotify_code_verifier');
    elements.loginButton.classList.remove('hidden');
    elements.logoutButton.classList.add('hidden');
    elements.profileSummary.className = 'profile-summary empty-state';
    elements.profileSummary.textContent = 'No Spotify profile loaded yet.';
    elements.topTracks.className = 'media-list empty-state';
    elements.topTracks.textContent = 'No tracks loaded.';
    elements.topArtists.className = 'artist-grid empty-state';
    elements.topArtists.textContent = 'No artists loaded.';
    elements.compatibilityScore.textContent = '--';
    elements.compatibilityText.textContent = 'Add your manual preferences after connecting Spotify to preview a compatibility score pls!';
    setStatus('Logged out of Spotify.');
}

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));

    return Array.from(values).map(value => possible[value % possible.length]).join('');
}

async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function setStatus(message, isError = false) {
    elements.statusMessage.textContent = message;

    if (isError) {
        elements.statusMessage.classList.add('error');
    } else {
        elements.statusMessage.classList.remove('error');
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[character]));
}
