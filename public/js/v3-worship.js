// ==============================================================================
// FIRE OF GOD (FOG) V3.0 - WORSHIP MEDIA HUB
// ==============================================================================

window.V3Worship = {
    _audioPlayer: null,
    _cachedSongs: [],

    init: function() {
        console.log('[V3 Engine] Initializing Worship Media Hub...');
        this.hookIntoLifecycle();
    },

    getSession: function() {
        try {
            const session = JSON.parse(localStorage.getItem('fog_user'));
            return session || { username: null, member: null };
        } catch(e) { return { username: null, member: null }; }
    },

    hookIntoLifecycle: function() {
        if (typeof window.buildNav === 'function') {
            const originalBuildNav = window.buildNav;
            window.buildNav = function() {
                originalBuildNav();
                V3Worship.injectNavButtons();
            };
        }

        if (typeof window.switchTab === 'function') {
            const origSwitchTab = window.switchTab;
            window.switchTab = function(tabId) {
                origSwitchTab(tabId);
                if (tabId === 'worshipTab') { V3Worship.loadModule(); }
            };
        }
    },

    injectNavButtons: function() {
        const sidebar = document.getElementById('sidebarNav');
        if (sidebar && !document.getElementById('navBtnWorship')) {
            const logoutBtn = sidebar.querySelector('.text-danger');
            let v3SidebarHtml = '';
            if (window.hasPerm && window.hasPerm('access_worship')) {
                v3SidebarHtml = ''; // Neutered: app.js natively handles this now.
            }
            if (logoutBtn && v3SidebarHtml) logoutBtn.insertAdjacentHTML('beforebegin', v3SidebarHtml);
        }
        // Bottom Nav Injection REMOVED.
    },

    switchWorshipSubTab: function(tab) {
        document.getElementById('subTabWorshipLibrary').style.display = tab === 'library' ? 'block' : 'none';
        document.getElementById('subTabWorshipSetlists').style.display = tab === 'setlists' ? 'block' : 'none';
        document.getElementById('btnSubWorshipLibrary').classList.toggle('active', tab === 'library');
        document.getElementById('btnSubWorshipSetlists').classList.toggle('active', tab === 'setlists');

        if (tab === 'library') this.loadSongs();
        if (tab === 'setlists') this.loadSetlists();
    },

    loadModule: async function() {
        await Promise.all([
            this.loadSongs(),
            this.loadSetlists()
        ]);
    },

    formatMediaUrl: function(url) {
        if (!url) return "";
        const gDriveRegex = /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([-\w]+)/;
        const gMatch = url.match(gDriveRegex);
        if (gMatch && gMatch[1]) {
            return `https://docs.google.com/uc?export=download&id=${gMatch[1]}`;
        }
        if (url.includes('dropbox.com')) {
            return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('&dl=0', '') + '?raw=1';
        }
        return url;
    },

    playSong: function(title, artist, rawUrl, ytUrl) {
        const playerDiv = document.getElementById('worshipAudioPlayer');
        const titleElem = document.getElementById('wpTitle');
        const artistElem = document.getElementById('wpArtist');
        const audioElem = document.getElementById('wpAudio');
        const ytContainer = document.getElementById('wpYoutubeContainer');

        titleElem.innerText = title;
        artistElem.innerText = artist || 'Unknown Artist';

        audioElem.pause();
        audioElem.src = "";
        ytContainer.innerHTML = "";

        if (ytUrl) {
            const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
            const match = ytUrl.match(ytRegex);

            if (match && match[1]) {
                const vidId = match[1];
                ytContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${vidId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
                ytContainer.style.display = 'block';
                audioElem.style.display = 'none';
            } else {
                alert("The provided YouTube URL appears to be invalid.");
                return;
            }
        } else if (rawUrl) {
            const streamUrl = this.formatMediaUrl(rawUrl);
            audioElem.src = streamUrl;
            audioElem.load();
            audioElem.style.display = 'block';
            ytContainer.style.display = 'none';

            const playPromise = audioElem.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn("Browser prevented autoplay:", e);
                });
            }
        } else {
            alert("No playable media (Audio or YouTube) was found for this song.");
            return;
        }

        playerDiv.style.display = 'flex';
    },

    closePlayer: function() {
        const playerDiv = document.getElementById('worshipAudioPlayer');
        const audioElem = document.getElementById('wpAudio');
        const ytContainer = document.getElementById('wpYoutubeContainer');

        audioElem.pause();
        audioElem.src = "";
        ytContainer.innerHTML = "";
        playerDiv.style.display = 'none';
    },

    loadSongs: async function() {
        try {
            const res = await fetch('/api/worship/songs');
            const songs = await res.json();
            this._cachedSongs = songs;

            const container = document.getElementById('worshipLibraryList');
            if (!container) return;

            if (songs.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No songs added to the library yet.</p>`;
                return;
            }

            container.innerHTML = songs.map(s => {
                const hasMedia = s.audio_url || s.youtube_url;
                return `
                <div class="song-card">
                    <div style="flex: 1; overflow: hidden;">
                        <strong style="color: var(--text-main); font-size: 1.05rem;">${s.title}</strong>
                        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0;">${s.artist || 'Unknown'} | Key: ${s.song_key || 'N/A'} | BPM: ${s.bpm || 'N/A'}</p>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        ${hasMedia ? `<button class="btn btn-sm" style="background:#10B981; color:#FFF;" onclick="V3Worship.playSong('${s.title.replace(/'/g, "\\'")}', '${(s.artist||'').replace(/'/g, "\\'")}', '${s.audio_url || ''}', '${s.youtube_url || ''}')">▶ Play</button>` : ''}
                        ${s.chord_chart_url ? `<a href="${this.formatMediaUrl(s.chord_chart_url)}" target="_blank" class="btn btn-outline btn-sm">📄 Chords</a>` : ''}
                        ${window.hasPerm && window.hasPerm('edit_entries') ? `<button class="btn btn-outline btn-sm" onclick="V3Worship.openEditSongModal(${s.id})">✏️ Edit</button>` : ''}
                        ${window.hasPerm && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V3Worship.deleteSong(${s.id})">🗑️</button>` : ''}
                    </div>
                </div>
                `;
            }).join('');

            const dropdown = document.getElementById('wsSetlistAddSongSelect');
            if (dropdown) {
                dropdown.innerHTML = `<option value="">-- Select a Song to Add --</option>` +
                    songs.map(s => `<option value="${s.id}">${s.title} (${s.song_key || 'N/A'})</option>`).join('');
            }
        } catch (e) { console.error('Failed to load songs', e); }
    },

    createSong: async function(e) {
        e.preventDefault();
        const payload = {
            title: document.getElementById('wsSongTitle').value,
            artist: document.getElementById('wsSongArtist').value,
            song_key: document.getElementById('wsSongKey').value,
            bpm: document.getElementById('wsSongBPM').value,
            audio_url: document.getElementById('wsSongAudio').value,
            youtube_url: document.getElementById('wsSongYoutube').value,
            chord_chart_url: document.getElementById('wsSongChords').value,
            actor: this.getSession().username
        };
        const res = await fetch('/api/worship/songs', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (res.ok) {
            document.getElementById('createSongForm').reset();
            this.loadSongs();
        }
    },

    openEditSongModal: function(id) {
        const s = this._cachedSongs.find(song => song.id === id);
        if (!s) return;
        document.getElementById('editSongId').value = s.id;
        document.getElementById('editSongTitle').value = s.title || '';
        document.getElementById('editSongArtist').value = s.artist || '';
        document.getElementById('editSongKey').value = s.song_key || '';
        document.getElementById('editSongBPM').value = s.bpm || '';
        document.getElementById('editSongAudio').value = s.audio_url || '';
        document.getElementById('editSongYoutube').value = s.youtube_url || '';
        document.getElementById('editSongChords').value = s.chord_chart_url || '';
        document.getElementById('editSongModal').classList.add('active');
    },

    closeEditSongModal: function() {
        document.getElementById('editSongModal').classList.remove('active');
    },

    saveEditSong: async function(e) {
        e.preventDefault();
        const id = document.getElementById('editSongId').value;
        const payload = {
            title: document.getElementById('editSongTitle').value,
            artist: document.getElementById('editSongArtist').value,
            song_key: document.getElementById('editSongKey').value,
            bpm: document.getElementById('editSongBPM').value,
            audio_url: document.getElementById('editSongAudio').value,
            youtube_url: document.getElementById('editSongYoutube').value,
            chord_chart_url: document.getElementById('editSongChords').value,
            actor: this.getSession().username
        };

        window.triggerActionConfirmation('Save changes to this song?', async () => {
            const res = await fetch(`/api/worship/songs/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) {
                V3Worship.closeEditSongModal();
                V3Worship.loadSongs();
            }
        });
    },

    deleteSong: async function(id) {
        window.triggerActionConfirmation('Permanently delete this song? It will be removed from all setlists.', async () => {
            const res = await fetch(`/api/worship/songs/${id}`, { method: 'DELETE' });
            if (res.ok) V3Worship.loadSongs();
        });
    },

    loadSetlists: async function() {
        try {
            const res = await fetch('/api/worship/setlists');
            const lists = await res.json();
            const container = document.getElementById('worshipSetlistsContainer');
            if (!container) return;

            if (lists.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No setlists created yet.</p>`;
                return;
            }

            container.innerHTML = lists.map(l => `
                <div class="card" style="margin-bottom: 15px; box-shadow: none; border-color: var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                        <div>
                            <h3 style="color: var(--primary); margin-bottom: 4px; border:none; padding:0;">📋 ${l.name}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin:0;">Scheduled for: ${l.scheduled_date || 'TBA'}</p>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn btn-outline btn-sm" onclick="V3Worship.openSetlistManager(${l.id}, '${l.name.replace(/'/g, "\\'")}')">Edit Songs</button>
                            ${window.hasPerm && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V3Worship.deleteSetlist(${l.id})">🗑️</button>` : ''}
                        </div>
                    </div>
                    <div id="setlist_songs_${l.id}" style="background: var(--bg-light); border-radius: 8px; padding: 10px;">Loading songs...</div>
                </div>
            `).join('');

            lists.forEach(l => this.loadSongsForSetlistUI(l.id));
        } catch (e) { console.error('Failed to load setlists', e); }
    },

    loadSongsForSetlistUI: async function(setlistId) {
        try {
            const res = await fetch(`/api/worship/setlists/${setlistId}/songs`);
            const songs = await res.json();
            const container = document.getElementById(`setlist_songs_${setlistId}`);
            if (!container) return;

            if (songs.length === 0) {
                container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">No songs added to this setlist yet.</span>`;
                return;
            }

            container.innerHTML = songs.map((s, index) => {
                const hasMedia = s.audio_url || s.youtube_url;
                return `
                <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size: 0.9rem; color: var(--text-main);">
                        <strong>${index + 1}. ${s.title}</strong> <span style="color:var(--text-muted); font-size: 0.8rem;">(Key: ${s.song_key || 'N/A'})</span>
                    </div>
                    <div style="display:flex; gap: 5px;">
                        ${hasMedia ? `<button class="btn btn-sm" style="background:transparent; border:none; color:#10B981; cursor:pointer;" onclick="V3Worship.playSong('${s.title.replace(/'/g, "\\'")}', '', '${s.audio_url || ''}', '${s.youtube_url || ''}')">▶</button>` : ''}
                        ${s.chord_chart_url ? `<a href="${this.formatMediaUrl(s.chord_chart_url)}" target="_blank" style="text-decoration:none; font-size: 0.8rem;">📄</a>` : ''}
                    </div>
                </div>
                `;
            }).join('');
        } catch (e) { console.error('Failed to load setlist songs', e); }
    },

    createSetlist: async function(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('wsSetlistName').value,
            scheduled_date: document.getElementById('wsSetlistDate').value,
            actor: this.getSession().username
        };
        const res = await fetch('/api/worship/setlists', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (res.ok) {
            document.getElementById('createSetlistForm').reset();
            this.loadSetlists();
        }
    },

    deleteSetlist: async function(id) {
        window.triggerActionConfirmation('Permanently delete this setlist?', async () => {
            const res = await fetch(`/api/worship/setlists/${id}`, { method: 'DELETE' });
            if (res.ok) V3Worship.loadSetlists();
        });
    },

    openSetlistManager: async function(setlistId, name) {
        document.getElementById('wsActiveSetlistId').value = setlistId;
        document.getElementById('wsSetlistModalName').innerText = `Editing: ${name}`;
        await this.loadSetlistManagerSongs(setlistId);
        document.getElementById('worshipSetlistModal').classList.add('active');
    },

    closeSetlistManager: function() {
        document.getElementById('worshipSetlistModal').classList.remove('active');
        this.loadSetlists();
    },

    loadSetlistManagerSongs: async function(setlistId) {
        const res = await fetch(`/api/worship/setlists/${setlistId}/songs`);
        const songs = await res.json();
        const container = document.getElementById('wsModalSongsList');

        if (songs.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No songs in this setlist.</p>`;
            return;
        }

        container.innerHTML = songs.map(s => `
            <div style="border-bottom: 1px solid var(--border-color); padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${s.title}</strong>
                    <br><small style="color: var(--text-muted);">Key: ${s.song_key || 'N/A'}</small>
                </div>
                <button class="btn btn-danger btn-sm" style="flex-shrink: 0;" onclick="V3Worship.removeSongFromSetlist(${setlistId}, ${s.mapping_id})">🗑️ Remove</button>
            </div>
        `).join('');
    },

    addSongToActiveSetlist: async function() {
        const setlistId = document.getElementById('wsActiveSetlistId').value;
        const songId = document.getElementById('wsSetlistAddSongSelect').value;
        if (!setlistId || !songId) return alert('Please select a song.');

        const res = await fetch(`/api/worship/setlists/${setlistId}/songs`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({song_id: songId})
        });
        if (res.ok) {
            document.getElementById('wsSetlistAddSongSelect').value = '';
            this.loadSetlistManagerSongs(setlistId);
        }
    },

    removeSongFromSetlist: async function(setlistId, mappingId) {
        const res = await fetch(`/api/worship/setlists/${setlistId}/songs/${mappingId}`, { method: 'DELETE' });
        if (res.ok) this.loadSetlistManagerSongs(setlistId);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    V3Worship.init();
});
