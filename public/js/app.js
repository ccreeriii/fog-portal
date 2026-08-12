let currentUser = null;
let currentMember = null;
let userPermissions = [];
let eventsData = [];
let youthData = [];
let allUsersList = [];
let cachedAttendanceLogs = [];
let cachedActivityLogs = [];
let pendingAction = null;
let eventViewMode = 'list';
let calCurrentDate = new Date();
let qrScanner = null;
let currentAnalyticsData = null;
let checkedInYouthIds = new Set();
let currentPreregEventId = null;
let currentRosterFilter = 'all';
let currentPreRegYouthIds = new Set();

window.getBase64 = async function(file, maxWidth = 600) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
        reader.onerror = error => reject(error);
    });
};

window.openImageViewer = function(src) {
    if (!src || src.length < 50) return;
    document.getElementById('enlargedImage').src = src;
    document.getElementById('imageViewerModal').classList.add('active');
};
window.closeImageViewer = function() { document.getElementById('imageViewerModal').classList.remove('active'); };

window.downloadCSV = function(rows, filename) {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ARMORED: Global Permission Helper that bypasses bad caching
window.hasPerm = function(perm) {
    if (currentUser === 'celsocreeriii@gmail.com') return true;
    if (!userPermissions || !Array.isArray(userPermissions)) return false;
    
    // Legacy mapping: If they had old access, grant them CRUD so they aren't locked out
    if (['add_entries', 'edit_entries', 'delete_entries'].includes(perm)) {
        if (userPermissions.includes('access_directory') || userPermissions.includes('access_events')) return true;
    }
    return userPermissions.includes(perm);
};

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdParam = urlParams.get('event');

    if (eventIdParam) {
        window.launchPublicPrereg(eventIdParam);
        return;
    }

    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'block';

    const savedSession = localStorage.getItem('fog_user');
    if (savedSession) {
        const s = JSON.parse(savedSession);
        currentUser = s.username; 
        currentMember = s.member;
        userPermissions = Array.isArray(s.permissions) ? s.permissions : [];
        
        window.buildNav();
        window.applyGranularPermissions();
        
        if (currentMember) window.populateProfileTab(currentMember);
        else window.populateAdminProfile(currentUser);
        
        if (currentMember) window.switchTab('profileTab');
        else if (window.hasPerm('access_checkin') && !window.hasPerm('access_directory')) window.switchTab('checkinTab');
        else window.switchTab('profileTab');
        
        window.loadEvents(); 
        window.loadDirectory();
    } else {
        window.switchTab('loginTab'); 
    }
};

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
        if(event.target.id === 'eventAnalyticsModal') currentAnalyticsData = null;
        if(event.target.id === 'confirmModal') pendingAction = null;
    }
};

// ARMORED: Secure binding for the Execute Action button to prevent silent fails
function bindExecuteAction() {
    const execBtn = document.getElementById('executeConfirmBtn');
    if (execBtn) {
        execBtn.onclick = async (e) => {
            e.preventDefault();
            if (pendingAction) {
                try {
                    await pendingAction();
                } catch (err) {
                    console.error("Action Execution Error:", err);
                    alert("A network error occurred while saving. Please check your connection.");
                }
            }
            window.closeConfirmModal();
        };
    }
}
bindExecuteAction();

window.triggerActionConfirmation = function(summaryText, actionFn) {
    document.getElementById('confirmSummary').innerText = summaryText;
    pendingAction = actionFn;
    document.getElementById('confirmModal').classList.add('active');
};
window.closeConfirmModal = function() { 
    document.getElementById('confirmModal').classList.remove('active'); 
    pendingAction = null; 
};

window.openSidebar = function() {
    document.getElementById('sidebarNav').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
};
window.closeSidebar = function() {
    document.getElementById('sidebarNav').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
};

window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');

    const isAdmin = currentUser === 'celsocreeriii@gmail.com' || (userPermissions && userPermissions.length > 0);

    let sidebarHtml = `<h2>Main Menu</h2>`;
    let bottomHtml = ``;

    if (isAdmin) {
        hamburger.style.display = 'block';
        bottomNav.style.display = 'none';

        sidebarHtml += `<button class="nav-btn" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>`;
        if (window.hasPerm('access_checkin')) sidebarHtml += `<button class="nav-btn" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
        if (window.hasPerm('access_directory')) sidebarHtml += `<button class="nav-btn" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
        if (window.hasPerm('access_events')) sidebarHtml += `<button class="nav-btn" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
        if (window.hasPerm('access_attendance')) sidebarHtml += `<button class="nav-btn" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>`;
        if (window.hasPerm('access_activity')) sidebarHtml += `<button class="nav-btn" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">🔍 Audit Logs</button>`;
        if (window.hasPerm('access_permissions')) sidebarHtml += `<button class="nav-btn" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔐 Permissions</button>`;
        sidebarHtml += `<button class="nav-btn text-danger" onclick="handleLogout()">🚪 Logout (${currentUser})</button>`;

        sidebar.innerHTML = sidebarHtml;
        bottomNav.innerHTML = '';
    } else {
        hamburger.style.display = 'none';
        bottomNav.style.display = 'flex';

        bottomHtml += `<button class="bottom-nav-btn active" data-target="profileTab" onclick="switchTab('profileTab')"><div class="icon">👤</div>Profile</button>`;
        bottomHtml += `<button class="bottom-nav-btn" onclick="handleLogout()"><div class="icon">🚪</div>Logout</button>`;

        sidebar.innerHTML = '';
        bottomNav.innerHTML = bottomHtml;
    }
};

window.applyGranularPermissions = function() {
    const canAdd = window.hasPerm('add_entries');
    
    const btnSubEventCreate = document.getElementById('btnSubEventCreate');
    if(btnSubEventCreate) btnSubEventCreate.style.display = canAdd ? 'inline-block' : 'none';

    const btnCheckinWalkin = document.getElementById('btnCheckinWalkin');
    if(btnCheckinWalkin) btnCheckinWalkin.style.display = canAdd ? 'inline-block' : 'none';

    const addEntryAnalyticsBtn = document.getElementById('addEntryAnalyticsBtn');
    if(addEntryAnalyticsBtn) addEntryAnalyticsBtn.style.display = canAdd ? 'flex' : 'none';
};

window.resetPermUserList = function() {
    const searchInput = document.getElementById('permUserSearchInput');
    const container = document.getElementById('permUserListContainer');
    if(searchInput) searchInput.value = '';
    if(container) container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">Please type at least 3 characters to search the directory and assign permissions.</div>`;
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    document.querySelectorAll('.sidebar .nav-btn').forEach(el => el.classList.remove('active'));
    const sidebarTarget = document.querySelector(`.sidebar .nav-btn[data-target="${tabId}"]`);
    if(sidebarTarget) sidebarTarget.classList.add('active');

    document.querySelectorAll('.bottom-nav-btn').forEach(el => el.classList.remove('active'));
    const bottomTarget = document.querySelector(`.bottom-nav-btn[data-target="${tabId}"]`);
    if(bottomTarget) bottomTarget.classList.add('active');

    window.closeSidebar();

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    if (tabId !== 'checkinTab' && qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (tabId === 'checkinTab') { window.switchCheckinMode('scanner'); window.updateActiveEventBanner(); }
    if (tabId === 'directoryTab') window.loadDirectory();
    if (tabId === 'eventsTab') { window.loadEvents(); }
    if (tabId === 'attendanceTab') window.loadAttendanceLogs();
    if (tabId === 'activityLogsTab') window.loadActivityLogs();
    if (tabId === 'permissionsTab') window.resetPermUserList();

    if (tabId === 'profileTab' && currentUser === 'celsocreeriii@gmail.com') {
        document.getElementById('adminBackupCard').style.display = 'block';
        window.loadBackups();
    } else {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'none';
    }
};

window.switchEventSubTab = function(tab) {
    document.getElementById('subTabEventList').classList.toggle('active', tab === 'list');
    document.getElementById('subTabEventCreate').classList.toggle('active', tab === 'create');
    document.getElementById('btnSubEventList').classList.toggle('active', tab === 'list');
    document.getElementById('btnSubEventCreate').classList.toggle('active', tab === 'create');
    if (tab === 'list') window.loadEvents();
};

window.loadBackups = async function() {
    const res = await fetch('/api/backups');
    const backups = await res.json();
    const container = document.getElementById('backupListContainer');
    if(backups.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No automated backups found yet.</p>`;
        return;
    }
    
    let html = `<table class="responsive-table">
        <thead>
            <tr><th>Backup File</th><th class="hide-mobile">Date / Time</th><th>Size</th><th>Action</th></tr>
        </thead>
        <tbody>`;
    html += backups.map(b => `
        <tr>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="background: var(--bg-light); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">💾</div>
                    <div>
                        <strong style="color:var(--text-main); font-size:1.05rem;">${b.name}</strong>
                        <div class="mobile-meta">${b.time}</div>
                    </div>
                </div>
            </td>
            <td class="hide-mobile" style="color: var(--text-muted);">${b.time}</td>
            <td><span class="badge badge-blue">${b.size}</span></td>
            <td class="actions-cell">
                <button type="button" class="btn btn-danger btn-sm" onclick="triggerRestore('${b.name}')">Restore</button>
            </td>
        </tr>`).join('');
    html += `</tbody></table>`;
    container.innerHTML = html;
};

window.triggerRestore = function(filename) {
    window.triggerActionConfirmation(`Are you sure you want to revert the system to '${filename}'? The CURRENT state will be auto-backed up first so you don't lose anything.`, async () => {
        const res = await fetch('/api/backups/restore', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, actor: currentUser })
        });
        if(res.ok) {
            alert('System restored successfully! The portal will now safely restart to apply changes.');
            window.location.reload();
        } else alert('Restore failed. Check server logs.');
    });
};

window.switchCheckinMode = function(mode) {
    document.getElementById('checkinModeScanner').style.display = mode === 'scanner' ? 'block' : 'none';
    document.getElementById('checkinModeManual').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('checkinModeWalkin').style.display = mode === 'walkin' ? 'block' : 'none';
    document.getElementById('btnCheckinScanner').classList.toggle('active', mode === 'scanner');
    document.getElementById('btnCheckinManual').classList.toggle('active', mode === 'manual');
    document.getElementById('btnCheckinWalkin').classList.toggle('active', mode === 'walkin');

    if (mode === 'scanner') window.initScanner();
    else if (qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (mode === 'manual') window.filterManualCheckin();
};

window.handleLogin = async function(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
        currentUser = data.username; 
        userPermissions = Array.isArray(data.permissions) ? data.permissions : []; 
        currentMember = data.member;
        localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
        window.buildNav();
        window.applyGranularPermissions();
        if (currentMember) { window.populateProfileTab(currentMember); window.switchTab('profileTab'); }
        else {
            window.populateAdminProfile(currentUser);
            if (window.hasPerm('access_checkin')) window.switchTab('checkinTab');
            else window.switchTab('profileTab');
        }
        window.loadEvents(); window.loadDirectory();
    } else alert('Invalid credentials!');
};

window.handleLogout = async function() {
    if (currentUser) await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser }) });
    localStorage.removeItem('fog_user'); currentUser = null; currentMember = null; userPermissions = [];
    document.getElementById('hamburgerBtn').style.display = 'none';
    document.getElementById('sidebarNav').innerHTML = '';
    document.getElementById('bottomNav').style.display = 'none';
    window.switchTab('loginTab'); 
};

window.populateProfileTab = function(member) {
    document.getElementById('myMemberId').value = member.id;
    document.getElementById('myProfileName').innerText = member.name || 'Member';
    document.getElementById('myProfileCode').innerText = `Unique Pass ID: ${member.qr_code || 'N/A'}`;
    document.getElementById('myEditName').value = member.name || '';
    document.getElementById('myEditEmail').value = member.email || '';
    document.getElementById('myEditAge').value = member.age || '';
    document.getElementById('myEditBirthday').value = member.birthday || '';
    document.getElementById('myEditSocial').value = member.social_media || '';
    document.getElementById('myEditParents').value = member.parents_name || '';

    const avatar = document.getElementById('myProfileAvatar');
    if (member.profile_picture) {
        avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    } else avatar.innerHTML = (member.name || 'U').charAt(0).toUpperCase();

    document.getElementById('myQrContainer').innerHTML = '';
    if(member.qr_code) {
        QRCode.toDataURL(member.qr_code, { width: 220 }, function (err, url) {
            if(!err) {
                const img = document.createElement('img'); img.src = url;
                document.getElementById('myQrContainer').appendChild(img);
                document.getElementById('myDownloadQrBtn').href = url;
            }
        });
    }
};

window.populateAdminProfile = function(username) {
    document.getElementById('myProfileName').innerText = username + " (Administrator)";
    document.getElementById('myProfileCode').innerText = "LEADER ACCOUNT";
    document.getElementById('myEditName').value = username;
    document.getElementById('myEditEmail').value = username;
    document.getElementById('myProfileAvatar').innerHTML = "A";
    document.getElementById('myQrContainer').innerHTML = `<span class="badge badge-orange" style="font-size: 1.1rem; padding: 12px 20px;">AUTHORIZED LEADER</span>`;
};

window.handleSelfProfileUpdate = async function(e) {
    e.preventDefault();
    const id = document.getElementById('myMemberId').value;
    if (!id) return alert('Admin accounts are updated directly in Add Permissions.');

    const fileInput = document.getElementById('myEditProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('myEditName').value, email: document.getElementById('myEditEmail').value,
        age: document.getElementById('myEditAge').value, birthday: document.getElementById('myEditBirthday').value,
        social_media: document.getElementById('myEditSocial').value, parents_name: document.getElementById('myEditParents').value,
        password: document.getElementById('myEditPassword').value, profile_picture: picBase64, actor: currentUser
    };

    window.triggerActionConfirmation(`Save changes to your personal profile?`, async () => {
        const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            alert('Profile updated successfully!');
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            window.populateProfileTab(data.member);
        }
    });
};

window.handlePublicRegistration = async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('regProfilePic');
    let picBase64 = null;
    if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('regName').value, age: document.getElementById('regAge').value,
        birthday: document.getElementById('regBirthday').value, email: document.getElementById('regEmail').value,
        social_media: document.getElementById('regSocial').value, parents_name: document.getElementById('regParents').value,
        profile_picture: picBase64, actor: currentUser || 'Public Registration'
    };

    const res = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();

    if (data.qr_code) {
        document.getElementById('passMemberName').innerText = payload.name;
        document.getElementById('passMemberCode').innerText = `Pass ID & Login: ${data.qr_code}`;
        document.getElementById('qrCanvasContainer').innerHTML = '';
        QRCode.toDataURL(data.qr_code, { width: 220 }, function (err, url) {
            const img = document.createElement('img'); img.src = url;
            document.getElementById('qrCanvasContainer').appendChild(img);
            document.getElementById('downloadQrBtn').href = url;
        });
        document.getElementById('qrPassCard').style.display = 'block';
        document.getElementById('regForm').reset();
        youthData = [];
    }
};

window.initScanner = function() {
    if (qrScanner) return;
    qrScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } });
    qrScanner.render((decodedText) => {
        const eventId = document.getElementById('activeEventDropdown').value;
        if (!eventId) return alert('Please select an active event first!');
        fetch('/api/checkin', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_code: decodedText, event_id: eventId, is_walkin: 0, actor: currentUser })
        }).then(r => r.json()).then(data => {
            if (data.success) {
                alert(`Success! Checked in ${data.member_name}`);
                window.updateActiveEventBanner();
            } else alert(data.error || 'Check-in failed');
        });
    }, (err) => {});
};

window.updateActiveEventBanner = async function() {
    const dropdown = document.getElementById('activeEventDropdown');
    if(!dropdown) return;
    const eventId = dropdown.value;
    checkedInYouthIds.clear();

    if(eventId) {
        document.getElementById('checkinCounters').style.display = 'grid';
        try {
            const res = await fetch(`/api/events/${eventId}/analytics`);
            const data = await res.json();
            if(data && data.roster && data.roster.length > 0) {
                data.roster.forEach(r => checkedInYouthIds.add(r.youth_id));
                document.getElementById('liveTotal').innerText = data.totalTurnout || 0;
                document.getElementById('livePreRegTotal').innerText = data.totalPreRegistered || 0;
                document.getElementById('livePreReg').innerText = data.preReg || 0;
                document.getElementById('liveWalkin').innerText = data.walkins || 0;
            } else {
                document.getElementById('liveTotal').innerText = '0';
                document.getElementById('livePreRegTotal').innerText = (data && data.totalPreRegistered) ? data.totalPreRegistered : '0';
                document.getElementById('livePreReg').innerText = '0';
                document.getElementById('liveWalkin').innerText = '0';
            }
        } catch(e) { console.error("Failed to load active banner stats", e); }
    } else {
        document.getElementById('checkinCounters').style.display = 'none';
    }
    window.filterManualCheckin();
};

window.filterManualCheckin = async function() {
    const query = document.getElementById('manualSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('manualCheckinResults');

    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }

    let matches = youthData;
    if (query) {
        matches = youthData.filter(y => (y.name || '').toLowerCase().includes(query) || ((y.qr_code || '').toLowerCase().includes(query)));
    } else {
        matches = youthData.slice(0, 20);
    }

    container.innerHTML = matches.map(y => {
        const safeName = y.name || 'Unknown';
        const avatarHtml = y.profile_picture
            ? `<img src="${y.profile_picture}" class="avatar-circle" style="cursor:pointer;" onclick="openImageViewer(this.src)">`
            : `<div class="avatar-circle">${safeName.charAt(0).toUpperCase()}</div>`;

        const isCheckedIn = checkedInYouthIds.has(y.id);
        const btnHtml = isCheckedIn
            ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="background: #94A3B8; color: #FFF; cursor: not-allowed;">Done</button>`
            : `<button type="button" class="btn btn-primary btn-sm" onclick="quickCheckin(${y.id}, '${safeName.replace(/'/g, "\\'")}')">Check In</button>`;

        return `
        <div class="search-item">
            <div style="display: flex; gap: 10px; align-items: center;">
                ${avatarHtml}
                <div><strong>${safeName}</strong><br><small style="color: var(--text-muted);">${y.qr_code || ''} | Age: ${y.age || 'N/A'}</small></div>
            </div>
            <div style="display: flex; gap: 6px;">
                ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openFastEditProfileModal(${y.id})">Edit</button>` : ''}
                ${btnHtml}
            </div>
        </div>`;
    }).join('');
};

window.openFastEditProfileModal = function(id) {
    const m = youthData.find(y => y.id == id);
    if (!m) return;
    document.getElementById('fastEditMemberId').value = m.id;
    document.getElementById('fastEditName').value = m.name || '';
    document.getElementById('fastEditEmail').value = m.email || '';
    document.getElementById('fastEditAge').value = m.age || '';
    document.getElementById('fastEditBirthday').value = m.birthday || '';
    document.getElementById('fastEditSocial').value = m.social_media || '';
    document.getElementById('fastEditParents').value = m.parents_name || '';
    document.getElementById('fastEditProfilePic').value = '';
    document.getElementById('fastEditProfileModal').classList.add('active');
};
window.closeFastEditProfileModal = function() { document.getElementById('fastEditProfileModal').classList.remove('active'); };

window.submitFastEditProfile = async function(doCheckIn) {
    const form = document.getElementById('fastEditProfileForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('fastEditMemberId').value;
    const fileInput = document.getElementById('fastEditProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('fastEditName').value, email: document.getElementById('fastEditEmail').value,
        age: document.getElementById('fastEditAge').value, birthday: document.getElementById('fastEditBirthday').value,
        social_media: document.getElementById('fastEditSocial').value, parents_name: document.getElementById('fastEditParents').value,
        profile_picture: picBase64, password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, actor: currentUser
    };

    window.triggerActionConfirmation(`Confirm updating profile for ${payload.name}?`, async () => {
        const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) {
            window.closeFastEditProfileModal(); youthData = []; await window.loadDirectory();
            if(doCheckIn) window.quickCheckin(id, payload.name);
            else { 
                alert("Profile updated successfully!"); 
                window.updateActiveEventBanner();
                if(currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id);
            }
        }
    });
};

window.quickCheckin = async function(youthId, memberName) {
    const eventId = document.getElementById('activeEventDropdown').value;
    if (!eventId) return alert('Please select an active event first!');
    const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: 0, actor: currentUser }) });
    const data = await res.json();
    if (data.success) { alert(`Successfully checked in ${memberName || 'member'}!`); window.updateActiveEventBanner(); }
    else alert(data.error || 'Check-in failed');
};

window.handleWalkin = async function(e) {
    e.preventDefault();
    const eventId = document.getElementById('activeEventDropdown').value;
    if (!eventId) return alert('Please select an active event first!');
    const payload = {
        name: document.getElementById('walkinName').value, age: document.getElementById('walkinAge').value,
        birthday: document.getElementById('walkinBirthday').value, email: document.getElementById('walkinEmail').value,
        actor: currentUser || 'Walk-in Registration'
    };
    const regRes = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const regData = await regRes.json();

    if (regData.id) {
        const checkinRes = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: regData.id, event_id: eventId, is_walkin: 1, actor: currentUser }) });
        const checkinData = await checkinRes.json();
        if (checkinData.success) { alert(`Successfully registered and checked in walk-in: ${payload.name}`); e.target.reset(); youthData = []; window.updateActiveEventBanner(); }
        else alert(checkinData.error || 'Registration succeeded, but check-in failed.');
    } else alert(regData.error || 'Failed to register walk-in.');
};

window.loadDirectory = async function() {
    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }
    window.filterDirectory();
};

window.filterDirectory = function() {
    const q = document.getElementById('directorySearchInput').value.toLowerCase().trim();
    const sort = document.getElementById('sortDirectorySelect').value;
    const ageCat = document.getElementById('filterAgeCategory').value;

    let matches = youthData || [];
    if (q) {
        matches = matches.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q)));
    }

    let labelText = "Total Registered";
    if (ageCat === 'minis') { matches = matches.filter(y => y.age && y.age <= 12); labelText = "Minis"; }
    else if (ageCat === 'youth') { matches = matches.filter(y => y.age && y.age >= 13 && y.age <= 21); labelText = "Youth"; }
    else if (ageCat === 'adult') { matches = matches.filter(y => y.age && y.age >= 22); labelText = "Adults"; }

    document.getElementById('directoryTotalCount').innerText = `${labelText}: ${matches.length}`;
    
    if (sort === 'name_asc') matches.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    if (sort === 'name_desc') matches.sort((a,b) => (b.name || '').localeCompare(a.name || ''));
    if (sort === 'age_asc') matches.sort((a,b) => (a.age || 0) - (b.age || 0));
    if (sort === 'age_desc') matches.sort((a,b) => (b.age || 0) - (a.age || 0));

    let html = `<table class="responsive-table">
        <thead>
            <tr><th>Member</th><th class="hide-mobile">Age</th><th class="hide-mobile">Birthday</th><th>Actions</th></tr>
        </thead>
        <tbody>`;
        
    html += matches.map(y => {
        const safeName = y.name || 'Unknown';
        const avatarHtml = y.profile_picture ? `<img src="${y.profile_picture}" class="avatar-circle" style="width: 45px; height: 45px; font-size: 1.2rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 45px; height: 45px; font-size: 1.2rem;">${safeName.charAt(0).toUpperCase()}</div>`;
        return `
        <tr>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    ${avatarHtml}
                    <div>
                        <strong style="color:var(--text-main); font-size:1.05rem;">${safeName}</strong>
                        <div class="desktop-meta"><small style="color: var(--text-muted);">${y.qr_code || ''}</small></div>
                        <div class="mobile-meta">${y.qr_code || ''} | Age: ${y.age || 'N/A'} | B-Day: ${y.birthday || 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td class="hide-mobile" style="color:var(--text-muted);">${y.age || 'N/A'}</td>
            <td class="hide-mobile" style="color:var(--text-muted);">${y.birthday || 'N/A'}</td>
            <td class="actions-cell">
                <button type="button" class="btn btn-primary btn-sm" onclick="openViewProfileModal(${y.id})">View</button>
                ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditMemberModal(${y.id})">Edit</button>` : ''}
                ${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteMember(${y.id}, '${safeName.replace(/'/g, "\\'")}')">Del</button>` : ''}
            </td>
        </tr>`}).join('');
        
    html += `</tbody></table>`;
    document.getElementById('directoryTableContainer').innerHTML = html;
};

window.openEditMemberModal = function(youthId) {
    const m = youthData.find(y => y.id == youthId);
    if (!m) return;
    document.getElementById('editMemberId').value = m.id;
    document.getElementById('editMemberName').value = m.name || '';
    document.getElementById('editMemberEmail').value = m.email || '';
    document.getElementById('editMemberAge').value = m.age || '';
    document.getElementById('editMemberBirthday').value = m.birthday || '';
    document.getElementById('editMemberSocial').value = m.social_media || '';
    document.getElementById('editMemberParents').value = m.parents_name || '';
    document.getElementById('editMemberProfilePic').value = '';
    document.getElementById('editMemberModal').classList.add('active');
};
window.closeEditMemberModal = function() { document.getElementById('editMemberModal').classList.remove('active'); };

window.saveMemberEditWithConfirm = async function() {
    const form = document.getElementById('editMemberModal').querySelector('form');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('editMemberId').value;
    const fileInput = document.getElementById('editMemberProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('editMemberName').value, email: document.getElementById('editMemberEmail').value,
        age: document.getElementById('editMemberAge').value, birthday: document.getElementById('editMemberBirthday').value,
        social_media: document.getElementById('editMemberSocial').value, parents_name: document.getElementById('editMemberParents').value,
        password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, profile_picture: picBase64, actor: currentUser
    };

    window.triggerActionConfirmation(`Confirm updating member profile for '${payload.name}'?`, async () => {
        await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        window.closeEditMemberModal(); youthData = []; window.loadDirectory();
    });
};

window.openViewProfileModal = async function(youthId) {
    const member = youthData.find(y => y.id == youthId);
    if (!member) return;
    const safeName = member.name || 'Unknown';
    document.getElementById('modalProfileName').innerText = safeName;
    document.getElementById('modalProfileCode').innerText = `Unique Pass ID: ${member.qr_code || ''}`;
    document.getElementById('modalBioSummary').innerHTML = `
        <strong>Email Address:</strong> ${member.email || 'N/A'}<br>
        <strong>Age / Birthday:</strong> ${member.age || 'N/A'} (${member.birthday || 'N/A'})<br>
        <strong>Social Media:</strong> ${member.social_media || 'N/A'}<br>
        <strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}
    `;

    const avatar = document.getElementById('viewModalProfileAvatar');
    if (member.profile_picture) avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    else avatar.innerHTML = safeName.charAt(0).toUpperCase();

    document.getElementById('modalQrContainer').innerHTML = '';
    if(member.qr_code) {
        QRCode.toDataURL(member.qr_code, { width: 180 }, function (err, url) {
            if(!err) {
                const img = document.createElement('img'); img.src = url;
                document.getElementById('modalQrContainer').appendChild(img);
                document.getElementById('modalDownloadQrBtn').href = url;
            }
        });
    }

    try {
        const res = await fetch(`/api/youth/${youthId}/history`);
        const history = await res.json();
        const historyContainer = document.getElementById('modalAttendanceHistory');
        if (!history || history.length === 0) historyContainer.innerHTML = `<p style="color: var(--text-muted);">No attendance history recorded yet.</p>`;
        else historyContainer.innerHTML = history.map(h => `<div style="border-bottom: 1px solid var(--border-color); padding: 8px 0;"><strong>${h.event_name}</strong> (${h.event_date}) - <small style="color:var(--text-muted);">${h.checked_in_at}</small></div>`).join('');
    } catch(e) { console.error(e); }
    document.getElementById('viewProfileModal').classList.add('active');
};
window.closeViewProfileModal = function() { document.getElementById('viewProfileModal').classList.remove('active'); };

window.openPreregSettings = function(eventId) {
    const e = eventsData.find(ev => ev.id == eventId);
    if (!e) return;
    document.getElementById('preregSetEventId').value = e.id;
    document.getElementById('preregSetTitle').value = e.prereg_title || e.name || '';
    document.getElementById('preregSetInfo').value = e.prereg_info || '';
    document.getElementById('preregSetBanner').value = '';
    document.getElementById('preregSetBottomBanner').value = '';
    document.getElementById('preregSettingsModal').classList.add('active');
};
window.closePreregSettingsModal = function() { document.getElementById('preregSettingsModal').classList.remove('active'); };

window.savePreregSettings = async function(e) {
    e.preventDefault();
    const id = document.getElementById('preregSetEventId').value;
    const title = document.getElementById('preregSetTitle').value;
    const info = document.getElementById('preregSetInfo').value;
    const fileInput = document.getElementById('preregSetBanner');
    const fileInputBottom = document.getElementById('preregSetBottomBanner');

    let bannerBase64 = null;
    if (fileInput.files.length > 0) bannerBase64 = await window.getBase64(fileInput.files[0], 1200);

    let bottomBannerBase64 = null;
    if (fileInputBottom.files.length > 0) bottomBannerBase64 = await window.getBase64(fileInputBottom.files[0], 1200);

    window.triggerActionConfirmation('Save Pre-Registration Page Settings?', async () => {
        const res = await fetch(`/api/events/${id}/prereg-settings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banner: bannerBase64, bottom_banner: bottomBannerBase64, title, info, actor: currentUser })
        });
        if(res.ok) { alert('Settings saved successfully!'); window.closePreregSettingsModal(); window.loadEvents(); }
    });
};

window.openPublicPreregFromSettings = async function() {
    const id = document.getElementById('preregSetEventId').value;
    window.closePreregSettingsModal(); window.launchPublicPrereg(id);
};

window.launchPublicPrereg = async function(eventId) {
    currentPreregEventId = eventId;
    document.getElementById('mainContainer').style.display = 'block';
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('event') !== String(eventId)) window.history.pushState(null, '', '?event=' + eventId);

    try {
        const prRes = await fetch(`/api/events/${eventId}/preregs`);
        const prData = await prRes.json();
        currentPreRegYouthIds = new Set(prData);
    } catch(e) { currentPreRegYouthIds = new Set(); }

    if(eventsData.length === 0) { const res = await fetch('/api/events'); eventsData = await res.json(); }
    const e = eventsData.find(ev => ev.id == eventId);

    if (e) {
        document.getElementById('preregPublicTitle').innerText = e.prereg_title || e.name;
        document.getElementById('preregPublicInfo').innerText = e.prereg_info || `Date: ${e.event_date} | Venue: ${e.venue || 'TBA'}`;

        const banner = document.getElementById('preregPublicBanner');
        if (e.prereg_banner) { banner.src = e.prereg_banner; banner.style.display = 'block'; }
        else if (e.poster) { banner.src = e.poster; banner.style.display = 'block'; }
        else { banner.style.display = 'none'; }

        const bottomBanner = document.getElementById('preregPublicBottomBanner');
        if (e.prereg_bottom_banner) { bottomBanner.src = e.prereg_bottom_banner; bottomBanner.style.display = 'block'; }
        else { bottomBanner.style.display = 'none'; }
    }

    if(youthData.length === 0) { const yRes = await fetch('/api/youth'); youthData = await yRes.json(); }
    window.switchTab('preregPublicTab'); window.showPreregStep(1);
};

window.closePublicPrereg = function() {
    currentPreregEventId = null;
    document.getElementById('mainHeader').style.display = 'block';
    window.history.pushState(null, '', window.location.pathname);
    window.location.reload();
};

window.showPreregStep = function(step) {
    document.getElementById('preregStep1').style.display = step === 1 ? 'block' : 'none';
    document.getElementById('preregStep2').style.display = step === 2 ? 'block' : 'none';
    document.getElementById('preregStep3').style.display = step === 3 ? 'block' : 'none';
    document.getElementById('preregStepSuccess').style.display = step === 4 ? 'block' : 'none';
    if(step === 2) {
        document.getElementById('preregSearchInput').value = '';
        document.getElementById('preregSearchResults').innerHTML = '';
        document.getElementById('preregSearchResults').style.display = 'none';
    }
    if(step === 3) {
        document.getElementById('preregNewName').value = ''; document.getElementById('preregNewAge').value = '';
        document.getElementById('preregNewEmail').value = ''; document.getElementById('preregNewMobile').value = '';
    }
};

window.filterPreregSearch = function() {
    const q = document.getElementById('preregSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('preregSearchResults');
    if (q.length < 2) { container.style.display = 'none'; return; }

    let matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
    if (matches.length > 0) {
        container.innerHTML = matches.map(y => {
            const isRegistered = currentPreRegYouthIds.has(y.id);
            const btnHtml = isRegistered ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="border: none; font-size: 0.75rem;">Already registered</button>` : `<button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="executePreregister(${y.id}, '${y.qr_code}')">Register</button>`;
            return `
            <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div style="flex: 1; word-break: break-word; color: var(--text-main); font-weight:600;">${y.name || 'Unknown'}</div>
                <div>${btnHtml}</div>
            </div>`}).join('');
        container.style.display = 'block';
    } else {
        container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No matches found.</div>`;
        container.style.display = 'block';
    }
};

window.executePreregister = async function(youthId, qrCode) {
    if(!currentPreregEventId) return;
    try {
        const res = await fetch('/api/preregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: currentPreregEventId, youth_id: youthId }) });
        if(res.ok) {
            currentPreRegYouthIds.add(youthId);
            document.getElementById('preregSuccessQrContainer').innerHTML = '';
            if(qrCode) {
                QRCode.toDataURL(qrCode, { width: 200 }, function (err, url) {
                    if (!err) {
                        const img = document.createElement('img'); img.src = url;
                        document.getElementById('preregSuccessQrContainer').appendChild(img);
                        document.getElementById('preregSuccessQrDownload').href = url;
                    }
                });
            }
            window.showPreregStep(4);
        } else alert("An error occurred during pre-registration.");
    } catch(e) { alert("Connection error during pre-registration."); }
};

window.submitNewPrereg = async function(e) {
    e.preventDefault();
    if(!currentPreregEventId) return;
    const payload = {
        name: document.getElementById('preregNewName').value, age: document.getElementById('preregNewAge').value,
        mobile: document.getElementById('preregNewMobile').value, email: document.getElementById('preregNewEmail').value,
        actor: 'Public Pre-Registration'
    };
    try {
        const regRes = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const regData = await regRes.json();
        if (regData.id) window.executePreregister(regData.id, regData.qr_code);
        else alert(regData.error || 'Failed to create registration.');
    } catch(err) { alert("Network error."); }
};

window.dataURItoFile = function(dataURI, fileName) {
    const arr = dataURI.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], fileName, { type: mime });
};

window.sharePreRegLink = async function() {
    const shareTitle = document.getElementById('preregPublicTitle').innerText || 'Community Event';
    const shareText = `Join me at ${shareTitle}, click the link to pre-register.`;
    const shareUrl = window.location.href;
    const shareData = { title: shareTitle, text: shareText, url: shareUrl };

    let targetBase64Image = null;
    if (currentPreregEventId && eventsData && eventsData.length > 0) {
        const e = eventsData.find(ev => ev.id == currentPreregEventId);
        if (e && e.poster && e.poster.startsWith('data:image')) targetBase64Image = e.poster;
    }
    if (!targetBase64Image) {
        const bannerImg = document.getElementById('preregPublicBanner');
        if (bannerImg && bannerImg.src && bannerImg.src.startsWith('data:image')) targetBase64Image = bannerImg.src;
    }
    if (targetBase64Image) {
        try {
            const posterFile = window.dataURItoFile(targetBase64Image, 'event-poster.jpg');
            if (navigator.canShare && navigator.canShare({ files: [posterFile] })) shareData.files = [posterFile];
        } catch (err) { console.error('Image attachment failed:', err); }
    }

    if (navigator.share) {
        try { await navigator.share(shareData); } catch (error) { console.log('Error sharing', error); }
    } else {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => alert(`Link copied to clipboard!\n\n${shareText}`));
    }
};

// ARMORED: Safe Edit Event modal execution guaranteed globally
window.openEditEventModal = function(eventId) {
    try {
        const e = eventsData.find(ev => ev.id == eventId);
        if (!e) return alert("Event data could not be found locally. Please refresh.");
        
        const elId = document.getElementById('editEvtId'); if(elId) elId.value = e.id;
        const elName = document.getElementById('editEvtName'); if(elName) elName.value = e.name || '';
        const elDate = document.getElementById('editEvtDate'); if(elDate) elDate.value = e.event_date || '';
        const elTime = document.getElementById('editEvtTime'); if(elTime) elTime.value = e.time_start || '';
        const elVen = document.getElementById('editEvtVenue'); if(elVen) elVen.value = e.venue || '';
        const elPh = document.getElementById('editEvtPhotosUrl'); if(elPh) elPh.value = e.photos_url || '';
        const elMat = document.getElementById('editEvtMaterialsUrl'); if(elMat) elMat.value = e.materials_url || '';
        const elPos = document.getElementById('editEvtPoster'); if(elPos) elPos.value = '';
        
        window.closeAnalyticsModal(); 
        
        const modal = document.getElementById('editEventModal');
        if (modal) modal.classList.add('active');
        
    } catch (err) {
        console.error("Edit Event Error:", err);
        alert("An error occurred opening the Event Editor.");
    }
};
window.closeEditEventModal = function() { 
    const modal = document.getElementById('editEventModal');
    if (modal) modal.classList.remove('active'); 
};

window.submitEditEvent = async function() {
    const form = document.getElementById('editEventForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }
    const id = document.getElementById('editEvtId').value;
    const fileInput = document.getElementById('editEvtPoster');

    window.triggerActionConfirmation(`Confirm saving changes to event?`, async () => {
        let posterBase64 = null;
        if (fileInput && fileInput.files.length > 0) posterBase64 = await window.getBase64(fileInput.files[0], 1200);
        const payload = {
            name: document.getElementById('editEvtName').value, event_date: document.getElementById('editEvtDate').value,
            time_start: document.getElementById('editEvtTime').value, venue: document.getElementById('editEvtVenue').value,
            poster: posterBase64, photos_url: document.getElementById('editEvtPhotosUrl').value,
            materials_url: document.getElementById('editEvtMaterialsUrl').value, actor: currentUser
        };
        try {
            const res = await fetch(`/api/events/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) { window.closeEditEventModal(); alert("Event updated successfully!"); window.loadEvents(); }
        } catch(e) { alert("Error connecting to server."); }
    });
};

window.filterPermUserList = async function() {
    const qElem = document.getElementById('permUserSearchInput');
    const container = document.getElementById('permUserListContainer');
    if(!qElem || !container) return;
    
    const q = qElem.value.toLowerCase().trim();
    
    if (q.length < 3) { 
        container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">Please type at least 3 characters to search the directory and assign permissions.</div>`; 
        return; 
    }

    if (!youthData || youthData.length === 0) {
        try {
            const res = await fetch('/api/youth');
            youthData = await res.json();
        } catch (e) {
            container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">Error fetching directory data.</div>`;
            return;
        }
    }

    const matches = (youthData || []).filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q)));

    if (matches.length === 0) { 
        container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No accounts found matching '${q}'</div>`; 
        return; 
    }

    container.innerHTML = matches.map(u => `
        <div class="search-item">
            <div><strong style="color:var(--text-main); font-size:1.05rem;">${u.name || 'Unknown'}</strong><br><small style="color: var(--text-muted);">${u.qr_code || ''}</small></div>
            <button type="button" class="btn btn-primary btn-sm" onclick="openAssignPermissionModal(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}')">Select</button>
        </div>
    `).join('');
};

window.loadUserPermissionsList = async function() {
    if (!youthData || youthData.length === 0) {
        try {
            const res = await fetch('/api/youth');
            youthData = await res.json();
        } catch (e) { console.error("Failed to load youth data for permissions"); }
    }
    window.filterPermUserList(); 
};

window.openAssignPermissionModal = async function(id, displayName) {
    try {
        const res = await fetch('/api/youth');
        const dbYouth = await res.json();
        const targetYouth = dbYouth.find(y => y.id === id);
        const perms = JSON.parse(targetYouth.permissions || '[]');

        const idElem = document.getElementById('modalPermUserId');
        if(idElem) idElem.value = id;
        
        const bannerElem = document.getElementById('permModalUserBanner');
        if(bannerElem) bannerElem.innerText = `Assign Permissions for: ${displayName}`;
        
        document.querySelectorAll('.permCheckModal').forEach(chk => { chk.checked = perms.includes(chk.value); });
        
        const modal = document.getElementById('assignPermissionModal');
        if(modal) modal.classList.add('active');
    } catch(e) {
        console.error(e);
        alert("Failed to load user permissions from server.");
    }
};

window.closeAssignPermissionModal = function() { 
    const modal = document.getElementById('assignPermissionModal');
    if(modal) modal.classList.remove('active'); 
};

window.handleSavePermissionsFromModal = function() {
    const idElem = document.getElementById('modalPermUserId');
    if(!idElem) return;
    const userId = idElem.value;
    
    const selectedPerms = [];
    document.querySelectorAll('.permCheckModal:checked').forEach(chk => { selectedPerms.push(chk.value); });

    window.triggerActionConfirmation(`Confirm updating permission set?`, async () => {
        try {
            const res = await fetch(`/api/youth/${userId}/permissions`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ permissions: selectedPerms, actor: currentUser }) 
            });
            
            if(!res.ok) throw new Error("HTTP error " + res.status);
            
            const data = await res.json();
            if (data.success) { 
                alert('Permissions updated successfully!'); 
                window.closeAssignPermissionModal(); 
                window.resetPermUserList(); 
                youthData = []; await window.loadDirectory(); 
            } else {
                alert('Failed to update permissions. Details: ' + JSON.stringify(data));
            }
        } catch(e) {
            console.error("Save Permissions Error:", e);
            alert("Network error updating permissions. Check server logs.");
        }
    });
};

window.handleCreateUserAccount = function(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;

    window.triggerActionConfirmation(`Create new leader account '${username}'?`, async () => {
        const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser, username, password, permissions: ['access_checkin', 'access_directory'] }) });
        const data = await res.json();
        if (data.success) {
            alert(`User account created! Click 'Edit Permissions' to customize access.`);
            document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = '';
            window.loadUserPermissionsList();
        } else alert(data.error || 'Failed to create user');
    });
};

window.setEventViewMode = function(mode) {
    eventViewMode = mode;
    document.getElementById('viewBtnList').classList.toggle('active', mode === 'list');
    document.getElementById('viewBtnGrid').classList.toggle('active', mode === 'grid');
    document.getElementById('viewBtnCal').classList.toggle('active', mode === 'calendar');
    document.getElementById('calendarControls').style.display = mode === 'calendar' ? 'flex' : 'none';

    if(eventsData.length === 0) {
        window.loadEvents();
    } else {
        const container = document.getElementById('eventsListContainer');
        if (eventViewMode === 'list') {
            container.className = 'events-list-view';
            container.innerHTML = eventsData.map(e => {
                const safeName = e.name || 'Event';
                let linkBadges = '';
                if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`;
                if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`;
                return `
                <div style="border-bottom: 1px solid var(--border-color); padding: 15px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="cursor: pointer; color: var(--primary); font-size: 1.1rem;" onclick="openAnalyticsModal(${e.id})">${safeName}</strong><br>
                        <small style="color: var(--text-muted); font-size: 0.85rem;">${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''} | ${e.venue || 'No Location'}</small>
                        ${linkBadges ? `<div style="margin-top: 8px;">${linkBadges}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="openAnalyticsModal(${e.id})">Details</button>
                        ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>` : ''}
                        ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>` : ''}
                        ${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${safeName.replace(/'/g, "\\'")}')">Del</button>` : ''}
                    </div>
                </div>`}).join('');
        } else if (eventViewMode === 'grid') {
            container.className = 'events-grid-view';
            container.innerHTML = eventsData.map(e => {
                const safeName = e.name || 'Event';
                let linkBadges = '';
                if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`;
                if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`;
                return `
                <div class="event-card">
                    ${e.poster ? `<img src="${e.poster}" class="event-card-img" style="cursor:pointer;" onclick="openAnalyticsModal(${e.id})" alt="Poster">` : `<div class="event-card-img" style="background: var(--bg-light); border-bottom: 1px solid var(--border-color); cursor:pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem;" onclick="openAnalyticsModal(${e.id})">Blank Thumbnail</div>`}
                    <div style="padding: 15px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="font-size: 1.1rem; margin-bottom: 6px; color: var(--text-main); cursor: pointer;" onclick="openAnalyticsModal(${e.id})">${safeName}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">📅 ${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''}<br>📍 ${e.venue || 'No Location'}</p>
                            ${linkBadges ? `<div style="margin-bottom: 12px;">${linkBadges}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 10px;">
                            <button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="openAnalyticsModal(${e.id})">Details</button>
                            ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>` : ''}
                            ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>` : ''}
                            ${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${safeName.replace(/'/g, "\\'")}')">Del</button>` : ''}
                        </div>
                    </div>
                </div>`}).join('');
        } else if (eventViewMode === 'calendar') window.renderCalendarView(container);
    }
};

window.loadEvents = async function() {
    try {
        const res = await fetch('/api/events');
        eventsData = await res.json();
        const dropdown = document.getElementById('activeEventDropdown');
        if (dropdown) {
            dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
            if (eventsData.length > 0) window.updateActiveEventBanner();
        }
        window.setEventViewMode(eventViewMode);
    } catch(e) { console.error("Failed loading events.", e); }
};

window.renderCalendarView = function(container) {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('calendarMonthTitle').innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<div class="calendar-grid">`;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach(d => html += `<div class="calendar-day-header">${d}</div>`);
    for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day-cell other-month"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = eventsData.filter(e => e.event_date === dateStr);
        html += `<div class="calendar-day-cell"><strong style="color:var(--text-main);">${day}</strong>`;
        dayEvents.forEach(e => html += `<div class="calendar-event-tag" onclick="openAnalyticsModal(${e.id})" title="View Analytics for ${(e.name || '').replace(/"/g, '&quot;')}">${e.name || 'Event'}</div>`);
        html += `</div>`;
    }
    html += `</div>`;
    container.className = ''; container.innerHTML = html;
};

window.changeCalendarMonth = function(delta) { calCurrentDate.setMonth(calCurrentDate.getMonth() + delta); window.loadEvents(); };

window.loadAttendanceLogs = async function() {
    const res = await fetch('/api/attendance/logs');
    cachedAttendanceLogs = await res.json();
    window.filterAttendanceLogs();
};

window.filterAttendanceLogs = function() {
    const q = document.getElementById('attendanceSearchInput').value.toLowerCase().trim();
    let matches = cachedAttendanceLogs;
    if(q) matches = matches.filter(l => (l.member_name || '').toLowerCase().includes(q) || (l.event_name || '').toLowerCase().includes(q));

    let html = `<table class="responsive-table">
        <thead>
            <tr><th>Member</th><th class="hide-mobile">Event</th><th class="hide-mobile">Time</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>`;
        
    html += matches.map(l => `
        <tr>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="background: rgba(16,185,129,0.1); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">✅</div>
                    <div>
                        <strong style="color:var(--text-main); font-size:1.05rem;">${l.member_name || 'Unknown'}</strong>
                        <div class="mobile-meta">${l.event_name || ''} | ${l.checked_in_at || ''}</div>
                    </div>
                </div>
            </td>
            <td class="hide-mobile" style="color:var(--text-muted);">${l.event_name || ''}</td>
            <td class="hide-mobile" style="color:var(--text-muted);">${l.checked_in_at || ''}</td>
            <td><span class="badge ${l.is_walkin ? 'badge-orange' : 'badge-green'}">${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span></td>
            <td class="actions-cell">
                ${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditAttendanceModal(${l.id}, '${l.checked_in_at}', ${l.is_walkin})">Edit</button>` : ''}
                ${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteAttendance(${l.id}, '${(l.member_name || '').replace(/'/g, "\\'")}')">Del</button>` : ''}
            </td>
        </tr>`).join('');
        
    html += `</tbody></table>`;
    document.getElementById('attendanceLogsContainer').innerHTML = html;
};

window.exportAttendanceLogsCSV = function() {
    if(!cachedAttendanceLogs || cachedAttendanceLogs.length === 0) return alert('No attendance logs to export.');
    const rows = [['Log ID', 'Member Name', 'Event', 'Checked In At', 'Status']];
    cachedAttendanceLogs.forEach(l => rows.push([l.id, `"${l.member_name || ''}"`, `"${l.event_name || ''}"`, `"${l.checked_in_at || ''}"`, `"${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}"`]));
    window.downloadCSV(rows, 'All_Attendance_Logs.csv');
};

window.loadActivityLogs = async function() {
    const res = await fetch('/api/activity-logs');
    cachedActivityLogs = await res.json();
    window.filterActivityLogs();
};

window.filterActivityLogs = function() {
    const q = document.getElementById('activitySearchInput').value.toLowerCase().trim();
    let matches = cachedActivityLogs;
    if(q) matches = matches.filter(l => (l.username || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q) || (l.details || '').toLowerCase().includes(q));

    let html = `<table class="responsive-table">
        <thead>
            <tr><th>User</th><th class="hide-mobile">Action</th><th>Details</th><th class="hide-mobile">Timestamp</th></tr>
        </thead>
        <tbody>`;
        
    html += matches.map(l => `
        <tr>
            <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <div style="background: rgba(59,130,246,0.1); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📝</div>
                    <div>
                        <strong style="color:var(--text-main); font-size:1.05rem;">${l.username || 'System'}</strong>
                        <div class="mobile-meta"><span class="badge badge-orange">${l.action || ''}</span> | ${l.created_at || ''}</div>
                    </div>
                </div>
            </td>
            <td class="hide-mobile"><span class="badge badge-orange">${l.action || ''}</span></td>
            <td style="color:var(--text-main);">${l.details || ''}</td>
            <td class="hide-mobile" style="color:var(--text-muted);"><small>${l.created_at || ''}</small></td>
        </tr>`).join('');
        
    html += `</tbody></table>`;
    document.getElementById('activityLogsContainer').innerHTML = html;
};

window.exportActivityLogsCSV = function() {
    if(!cachedActivityLogs || cachedActivityLogs.length === 0) return alert('No activity logs to export.');
    const rows = [['Log ID', 'Timestamp', 'User', 'Action', 'Details']];
    cachedActivityLogs.forEach(l => rows.push([l.id, `"${l.created_at || ''}"`, `"${l.username || ''}"`, `"${l.action || ''}"`, `"${l.details || ''}"`]));
    window.downloadCSV(rows, 'All_Activity_Logs.csv');
};

window.handleCreateEvent = function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('evtPoster');
    window.triggerActionConfirmation(`Publish new event?`, async () => {
        let posterBase64 = null;
        if (fileInput.files.length > 0) posterBase64 = await window.getBase64(fileInput.files[0], 1200);
        const payload = {
            name: document.getElementById('evtName').value, event_date: document.getElementById('evtDate').value,
            time_start: document.getElementById('evtTime').value, venue: document.getElementById('evtVenue').value,
            poster: posterBase64, photos_url: document.getElementById('evtPhotosUrl').value,
            materials_url: document.getElementById('evtMaterialsUrl').value, actor: currentUser
        };
        try {
            const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('createEventForm').reset(); alert('Event published successfully!'); window.switchEventSubTab('list'); }
        } catch(e) { alert("Failed to connect to the server."); }
    });
};

window.openEditAttendanceModal = function(id, time, isWalkin) {
    document.getElementById('editAttId').value = id; document.getElementById('editAttTime').value = time;
    document.getElementById('editAttWalkin').value = isWalkin ? "1" : "0"; document.getElementById('editAttendanceModal').classList.add('active');
};
window.closeEditAttendanceModal = function() { document.getElementById('editAttendanceModal').classList.remove('active'); };

window.saveAttendanceEditWithConfirm = function() {
    const id = document.getElementById('editAttId').value;
    const checked_in_at = document.getElementById('editAttTime').value;
    const is_walkin = parseInt(document.getElementById('editAttWalkin').value);
    window.triggerActionConfirmation(`Update Attendance Log ID #${id}?`, async () => {
        await fetch(`/api/attendance/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checked_in_at, is_walkin, actor: currentUser }) });
        window.closeEditAttendanceModal(); window.loadAttendanceLogs();
        if (currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id);
    });
};

window.triggerDeleteMember = function(id, name) {
    window.triggerActionConfirmation(`Permanently DELETE member profile for '${name}'?`, async () => {
        await fetch(`/api/youth/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        youthData = []; window.loadDirectory(); window.filterManualCheckin();
    });
};

window.triggerDeleteEvent = function(id, name) {
    window.triggerActionConfirmation(`Permanently DELETE event '${name}' and associated logs?`, async () => {
        await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        window.loadEvents();
    });
};

window.triggerDeleteAttendance = function(id, memberName) {
    window.triggerActionConfirmation(`DELETE attendance record for '${memberName}'?`, async () => {
        await fetch(`/api/attendance/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        window.loadAttendanceLogs(); window.updateActiveEventBanner();
        if (currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id);
    });
};

// ARMORED: Safe fetching for Async Analytics Modal
window.openAnalyticsModal = async function(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/analytics`);
        if (!res.ok) throw new Error("Server returned " + res.status);
        const data = await res.json();
        if (!data || data.error) return alert(data?.error || 'Failed to load event analytics');

        currentAnalyticsData = data;
        
        const posterContainer = document.getElementById('analyticsModalPoster');
        if (posterContainer) {
            if (data.event.poster) posterContainer.innerHTML = `<img src="${data.event.poster}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
            else posterContainer.innerHTML = `<span style="font-size: 0.75rem; color: #aaa; text-align: center; font-weight: 600;">No<br>Poster</span>`;
        }

        if(document.getElementById('analyticsEventTitle')) document.getElementById('analyticsEventTitle').innerText = data.event.name || 'Event';
        if(document.getElementById('analyticsEventMeta')) document.getElementById('analyticsEventMeta').innerText = `📅 Date: ${data.event.event_date || ''} | 📍 Venue: ${data.event.venue || 'N/A'}`;

        let linksHtml = '';
        if(data.event.photos_url) linksHtml += `<a href="${data.event.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration: none;">📷 Photos</a>`;
        if(data.event.materials_url) linksHtml += `<a href="${data.event.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration: none;">📁 Materials</a>`;
        if(document.getElementById('analyticsEventLinks')) document.getElementById('analyticsEventLinks').innerHTML = linksHtml;

        if(document.getElementById('statTotalTurnout')) document.getElementById('statTotalTurnout').innerText = data.totalTurnout || 0;
        if(document.getElementById('statTotalPreReg')) document.getElementById('statTotalPreReg').innerText = data.totalPreRegistered || 0;
        if(document.getElementById('statWalkins')) document.getElementById('statWalkins').innerText = data.walkins || 0;
        if(document.getElementById('statTurnoutPercent')) document.getElementById('statTurnoutPercent').innerText = `${data.turnoutPercentage || '0.0'}%`;
        
        const editBtn = document.getElementById('analyticsEditEventBtn');
        if(editBtn) {
            editBtn.onclick = () => window.openEditEventModal(eventId);
            editBtn.style.display = window.hasPerm('edit_entries') ? 'block' : 'none';
        }

        if(document.getElementById('attSearchNative')) document.getElementById('attSearchNative').value = '';
        if(document.getElementById('attAgeNative')) document.getElementById('attAgeNative').value = 'all';
        currentRosterFilter = 'all';
        
        if(document.getElementById('cardTurnout')) document.getElementById('cardTurnout').style.opacity = '1';
        if(document.getElementById('cardPreReg')) document.getElementById('cardPreReg').style.opacity = '0.5';
        if(document.getElementById('cardWalkin')) document.getElementById('cardWalkin').style.opacity = '0.5';
        
        window.filterAnalyticsRoster();
        
        const modal = document.getElementById('eventAnalyticsModal');
        if(modal) modal.classList.add('active');
        
    } catch (error) { 
        console.error("Analytics Modal Error:", error);
        alert("Could not connect to the server to load analytics."); 
    }
};

window.closeAnalyticsModal = function() { 
    if(document.getElementById('eventAnalyticsModal')) document.getElementById('eventAnalyticsModal').classList.remove('active'); 
    currentAnalyticsData = null; 
};

window.setAnalyticsCardFilter = function(type) {
    currentRosterFilter = type;
    if(document.getElementById('cardTurnout')) document.getElementById('cardTurnout').style.opacity = type === 'all' ? '1' : '0.5';
    if(document.getElementById('cardPreReg')) document.getElementById('cardPreReg').style.opacity = type === 'prereg' ? '1' : '0.5';
    if(document.getElementById('cardWalkin')) document.getElementById('cardWalkin').style.opacity = type === 'walkin' ? '1' : '0.5';
    window.filterAnalyticsRoster();
};

window.filterAnalyticsRoster = function() {
    const qInput = document.getElementById('attSearchNative');
    const ageFilterInput = document.getElementById('attAgeNative');
    if(!qInput || !ageFilterInput || !currentAnalyticsData) return;
    
    const q = qInput.value.toLowerCase();
    const ageFilter = ageFilterInput.value;

    let sourceList = [];
    if (currentRosterFilter === 'prereg') sourceList = currentAnalyticsData.preRegList || [];
    else if (currentRosterFilter === 'walkin') sourceList = (currentAnalyticsData.roster || []).filter(r => r.is_walkin === 1);
    else sourceList = currentAnalyticsData.roster || [];

    const filtered = sourceList.filter(r => {
        const nameMatch = (r.name || '').toLowerCase().includes(q) || ((r.qr_code || '').toLowerCase().includes(q));
        let ageMatch = true;
        const age = parseInt(r.age);
        if (ageFilter !== 'all' && !isNaN(age)) {
            if (ageFilter === 'mini' && (age < 7 || age > 12)) ageMatch = false;
            if (ageFilter === 'youth' && (age < 13 || age > 21)) ageMatch = false;
            if (ageFilter === 'adult' && age < 22) ageMatch = false;
        } else if (ageFilter !== 'all' && isNaN(age)) ageMatch = false;
        return nameMatch && ageMatch;
    });

    if(document.getElementById('attRosterCount')) document.getElementById('attRosterCount').innerText = `Total: ${filtered.length}`;
    window.renderAnalyticsRoster(filtered);
};

window.renderAnalyticsRoster = function(list) {
    const rosterContainer = document.getElementById('analyticsRosterContainer');
    if (!rosterContainer) return;
    
    if (list.length === 0) { rosterContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin:15px 0; font-size: 0.9rem;">No attendees found.</p>`; return; }

    rosterContainer.innerHTML = list.map(r => {
        const safeName = r.name || 'Unknown';
        const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`;
        let statusBadge = '', actionButtons = '', timeText = '';

        if (currentRosterFilter === 'prereg') {
            const arrived = (currentAnalyticsData.roster || []).find(a => a.youth_id === r.youth_id);
            if (arrived) {
                statusBadge = `<span style="font-size:11px; color:var(--success); background: rgba(16,185,129,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Arrived</span>`;
                timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(arrived.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
            } else {
                statusBadge = `<span style="font-size:11px; color:#F59E0B; background: rgba(245,158,11,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Expected</span>`;
                timeText = `<span style="color: #F59E0B; font-size: 0.8rem; font-weight: 600;">Not Arrived</span>`;
                
                if (window.hasPerm('delete_entries')) {
                    actionButtons = `<div style="display: flex; gap: 5px; margin-top: 6px; justify-content: flex-end;">
                        <button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="triggerDeletePreReg(${currentAnalyticsData.event.id}, ${r.youth_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>
                    </div>`;
                }
            }
        } else {
            statusBadge = `<span style="font-size:11px; color:var(--text-muted); background: var(--bg-light); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${r.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span>`;
            timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(r.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
            
            if (window.hasPerm('delete_entries')) {
                actionButtons = `<div style="display: flex; gap: 5px; margin-top: 6px; justify-content: flex-end;">
                    <button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="triggerDeleteAttendance(${r.log_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>
                </div>`;
            }
        }
        return `
        <div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px; align-items: center;">
                ${avatarHtml}
                <div>
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong>${statusBadge}<br>
                    <small style="color: var(--text-muted);">${r.qr_code || ''} ${r.age ? '| Age: '+r.age : ''}</small>
                </div>
            </div>
            <div style="text-align: right;">${timeText}${actionButtons}</div>
        </div>`;
    }).join('');
};

window.openAddAttendeeModal = function() {
    if(!currentAnalyticsData) return;
    if(document.getElementById('addAttendeeSearch')) document.getElementById('addAttendeeSearch').value = '';
    if(document.getElementById('addAttendeeResults')) document.getElementById('addAttendeeResults').innerHTML = '';
    
    const modal = document.getElementById('addAttendeeModal');
    if(modal) modal.classList.add('active');
    
    if(youthData.length === 0) window.loadDirectory();
};
window.closeAddAttendeeModal = function() { 
    if(document.getElementById('addAttendeeModal')) document.getElementById('addAttendeeModal').classList.remove('active'); 
};

window.filterAddAttendeeSearch = function() {
    const searchInput = document.getElementById('addAttendeeSearch');
    const container = document.getElementById('addAttendeeResults');
    if (!searchInput || !container) return;
    
    const q = searchInput.value.toLowerCase().trim();
    if (q.length < 2) { container.innerHTML = ''; return; }

    const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
    const existingIds = currentAnalyticsData.roster.map(r => r.youth_id);

    container.innerHTML = matches.map(y => {
        const safeName = y.name || 'Unknown';
        const isExisting = existingIds.includes(y.id);
        const buttons = isExisting
            ? `<span style="font-size: 0.8rem; color: var(--success); font-weight: bold;">Already In Roster</span>`
            : `<button type="button" class="btn btn-primary btn-sm" onclick="submitAddAttendee(${y.id}, 0, '${safeName.replace(/'/g, "\\'")}')">Add Pre-Reg</button>
               <button type="button" class="btn btn-outline btn-sm" onclick="submitAddAttendee(${y.id}, 1, '${safeName.replace(/'/g, "\\'")}')">Add Walk-in</button>`;
        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
            <div><strong style="color:var(--text-main);">${safeName}</strong><br><small style="color: var(--text-muted);">${y.qr_code || ''}</small></div>
            <div style="display: flex; gap: 5px;">${buttons}</div>
        </div>`;
    }).join('');
};

window.submitAddAttendee = async function(youthId, isWalkin, name) {
    const eventId = currentAnalyticsData.event.id;
    try {
        const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: isWalkin, actor: currentUser }) });
        const data = await res.json();
        if (data.success) { alert(`Added ${name} to the event!`); window.closeAddAttendeeModal(); window.openAnalyticsModal(eventId); }
        else alert(data.error || 'Failed to add attendee.');
    } catch(e) { alert('Connection error.'); }
};

window.triggerDeletePreReg = function(eventId, youthId, memberName) {
    window.triggerActionConfirmation(`Remove pre-registration for '${memberName}'?`, async () => {
        try {
            const res = await fetch(`/api/events/${eventId}/preregs/${youthId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
            const data = await res.json();
            if (data.success) {
                if (currentAnalyticsData) window.openAnalyticsModal(eventId);
            } else {
                alert(data.error || 'Failed to remove entry');
            }
        } catch(e) { alert('Network error. Failed to remove.'); }
    });
};

window.exportAnalyticsCSV = function() {
    if (!currentAnalyticsData) return alert('No data available to export.');
    let sourceList = [];
    let isExpectedView = (currentRosterFilter === 'prereg');

    if (isExpectedView) sourceList = currentAnalyticsData.preRegList || [];
    else if (currentRosterFilter === 'walkin') sourceList = (currentAnalyticsData.roster || []).filter(r => r.is_walkin === 1);
    else sourceList = currentAnalyticsData.roster || [];

    const rows = [['Member Name', 'Unique Pass ID / Email', 'Status / Timestamp']];
    sourceList.forEach(r => {
        const identifier = r.email ? r.email : r.qr_code;
        let status = '';
        if (isExpectedView) {
            const arrived = (currentAnalyticsData.roster || []).find(a => a.youth_id === r.youth_id);
            status = arrived ? `Arrived at ${arrived.checked_in_at}` : 'Expected (Not Arrived)';
        } else { status = r.is_walkin ? `Walk-in (${r.checked_in_at})` : `Pre-Reg (${r.checked_in_at})`; }
        rows.push([`"${r.name || 'Unknown'}"`, `"${identifier}"`, `"${status}"`]);
    });
    window.downloadCSV(rows, `Roster_${(currentAnalyticsData.event.name || 'Event').replace(/\s+/g, '_')}.csv`);
};

// ---------------- BACKGROUND AUTOMATION LOOPS ----------------

document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        const headers = document.querySelectorAll('h2');
        let dirHeader = Array.from(headers).find(h => h.innerText.includes('Community Directory') || h.innerText.includes('Members'));
        if (dirHeader && !document.getElementById('csvBtn')) {
            const btn = document.createElement('button');
            btn.id = 'csvBtn';
            btn.innerHTML = '📊 Export CSV';
            btn.style.cssText = 'background: var(--success); color: white; border: none; padding: 6px 12px; border-radius: 6px; margin-left: 15px; cursor: pointer; font-weight: bold; font-size: 0.85rem; vertical-align: middle;';
            btn.onclick = () => window.location.href = '/api/directory/export';
            dirHeader.style.display = 'inline-block';
            dirHeader.parentNode.insertBefore(btn, dirHeader.nextSibling);
        }
    }, 1000);
});

// RESPONSIVE TABLE PAGINATION ENGINE
document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        const dataContainer = document.getElementById('directoryTableContainer') || document.getElementById('attendanceLogsContainer') || document.getElementById('activityLogsContainer');
        const tbody = dataContainer ? dataContainer.querySelector('tbody') : null;

        if (tbody && tbody.children.length > 0 && !document.getElementById('dirPagerControls')) {
            const pager = document.createElement('div');
            pager.id = 'dirPagerControls';
            pager.style.cssText = 'display: flex; gap: 15px; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.85rem; flex-wrap: wrap;';
            pager.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label>Entries per page:</label>
                    <select id="dirPerPage" style="padding: 5px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.85rem;">
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="999999">All</option>
                    </select>
                </div>
                <div style="margin-left: auto; display: flex; gap: 10px; align-items: center;">
                    <button id="dirPrev" class="btn btn-outline btn-sm">◀ Prev</button>
                    <span id="dirPageInd" style="color: var(--text-main);">Page 1</span>
                    <button id="dirNext" class="btn btn-outline btn-sm">Next ▶</button>
                </div>
            `;
            dataContainer.parentNode.insertBefore(pager, dataContainer);

            let currentPage = 1;
            let perPage = 10;

            const updateTable = () => {
                const rows = Array.from(tbody.children);
                if(rows.length === 0) return;
                
                const totalPages = Math.ceil(rows.length / perPage) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                document.getElementById('dirPageInd').innerText = 'Page ' + currentPage + ' of ' + totalPages;
                document.getElementById('dirPrev').disabled = (currentPage === 1);
                document.getElementById('dirNext').disabled = (currentPage === totalPages);

                rows.forEach((row, index) => {
                    if (perPage >= 999999) row.style.display = '';
                    else {
                        const start = (currentPage - 1) * perPage;
                        const end = start + perPage;
                        row.style.display = (index >= start && index < end) ? '' : 'none';
                    }
                });
            };

            document.getElementById('dirPerPage').onchange = (e) => { perPage = parseInt(e.target.value); currentPage = 1; updateTable(); };
            document.getElementById('dirPrev').onclick = () => { if (currentPage > 1) { currentPage--; updateTable(); } };
            document.getElementById('dirNext').onclick = () => { 
                const rows = Array.from(tbody.children);
                if (currentPage < Math.ceil(rows.length / perPage)) { currentPage++; updateTable(); } 
            };
            updateTable();
            new MutationObserver(() => updateTable()).observe(tbody, { childList: true });
        }
    }, 1000);
});

document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        const dropdown = document.querySelector('select[name="event_id"]') || document.querySelector('#checkinEventSelect');
        if (dropdown && !dropdown.dataset.leewayApplied) {
            dropdown.dataset.leewayApplied = "true";
            const targetDate = new Date();
            targetDate.setHours(targetDate.getHours() - 5);
            const cutoffStr = targetDate.toISOString().split('T')[0];
            Array.from(dropdown.options).forEach(opt => {
                const match = opt.innerText.match(/(\d{4}-\d{2}-\d{2})/);
                if (match && match[1] < cutoffStr) opt.remove();
            });
        }
    }, 1000);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) { registration.unregister(); }
    });
}
