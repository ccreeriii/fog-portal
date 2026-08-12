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

async function getBase64(file, maxWidth = 600) {
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
}

function openImageViewer(src) {
    if (!src || src.length < 50) return;
    document.getElementById('enlargedImage').src = src;
    document.getElementById('imageViewerModal').classList.add('active');
}
function closeImageViewer() { document.getElementById('imageViewerModal').classList.remove('active'); }

function downloadCSV(rows, filename) {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// WINDOW ONLOAD LOGIC
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventIdParam = urlParams.get('event');

    if (eventIdParam) {
        launchPublicPrereg(eventIdParam);
        return;
    }

    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'block';

    const savedSession = localStorage.getItem('fog_user');
    if (savedSession) {
        const s = JSON.parse(savedSession);
        currentUser = s.username; userPermissions = s.permissions; currentMember = s.member;
        buildNav();
        if (currentMember) populateProfileTab(currentMember);
        else populateAdminProfile(currentUser);
        if (currentMember) switchTab('profileTab');
        else if (userPermissions.length === 1 && userPermissions.includes('access_checkin')) switchTab('checkinTab');
        else switchTab('profileTab');
        loadEvents(); loadDirectory();
    } else {
        switchTab('loginTab'); 
    }
};

function openSidebar() {
    document.getElementById('sidebarNav').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebarNav').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function buildNav() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');

    let sidebarHtml = `<h2>Main Menu</h2>`;
    let bottomHtml = ``;

    const isAdmin = userPermissions.length > 0;

    if (isAdmin) {
        hamburger.style.display = 'block';
        bottomNav.style.display = 'none';

        sidebarHtml += `<button class="nav-btn" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>`;
        if (userPermissions.includes('access_checkin')) sidebarHtml += `<button class="nav-btn" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
        if (userPermissions.includes('access_directory')) sidebarHtml += `<button class="nav-btn" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
        if (userPermissions.includes('access_events')) sidebarHtml += `<button class="nav-btn" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
        if (userPermissions.includes('access_attendance')) sidebarHtml += `<button class="nav-btn" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>`;
        if (userPermissions.includes('access_activity')) sidebarHtml += `<button class="nav-btn" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">🔍 Audit Logs</button>`;
        if (userPermissions.includes('access_permissions')) sidebarHtml += `<button class="nav-btn" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔐 Permissions</button>`;
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
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    document.querySelectorAll('.sidebar .nav-btn').forEach(el => el.classList.remove('active'));
    const sidebarTarget = document.querySelector(`.sidebar .nav-btn[data-target="${tabId}"]`);
    if(sidebarTarget) sidebarTarget.classList.add('active');

    document.querySelectorAll('.bottom-nav-btn').forEach(el => el.classList.remove('active'));
    const bottomTarget = document.querySelector(`.bottom-nav-btn[data-target="${tabId}"]`);
    if(bottomTarget) bottomTarget.classList.add('active');

    closeSidebar();

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');
    
    if (tabId !== 'checkinTab' && qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (tabId === 'checkinTab') { switchCheckinMode('scanner'); updateActiveEventBanner(); }
    if (tabId === 'directoryTab') loadDirectory();
    if (tabId === 'eventsTab') { loadEvents(); }
    if (tabId === 'attendanceTab') loadAttendanceLogs();
    if (tabId === 'activityLogsTab') loadActivityLogs();
    if (tabId === 'permissionsTab') loadUserPermissionsList();

    if (tabId === 'profileTab' && currentUser === 'celsocreeriii@gmail.com') {
        document.getElementById('adminBackupCard').style.display = 'block';
        loadBackups();
    } else {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'none';
    }
}

// ==========================================
// PHASE 2 - MOBILE DATA CARDS RENDERING
// ==========================================

async function loadBackups() {
    const res = await fetch('/api/backups');
    const backups = await res.json();
    const container = document.getElementById('backupListContainer');
    if(backups.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No automated backups found yet.</p>`;
        return;
    }
    
    let html = backups.map(b => `
        <div class="data-row">
            <div class="data-row-main">
                <div style="background: var(--bg-light); width: 45px; height: 45px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">💾</div>
                <div>
                    <strong style="color:var(--text-main); font-size:1.05rem;">${b.name}</strong><br>
                    <small style="color: var(--text-muted);">${b.time}</small>
                </div>
            </div>
            <div class="data-row-meta">
                <span class="badge badge-blue">${b.size}</span>
            </div>
            <div class="data-row-actions">
                <button type="button" class="btn btn-danger btn-sm" onclick="triggerRestore('${b.name}')">Restore</button>
            </div>
        </div>`).join('');
    container.innerHTML = html;
}

function triggerRestore(filename) {
    triggerActionConfirmation(`Are you sure you want to revert the system to '${filename}'? The CURRENT state will be auto-backed up first so you don't lose anything.`, async () => {
        const res = await fetch('/api/backups/restore', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, actor: currentUser })
        });
        if(res.ok) {
            alert('System restored successfully! The portal will now safely restart to apply changes.');
            window.location.reload();
        } else alert('Restore failed. Check server logs.');
    });
}

function switchCheckinMode(mode) {
    document.getElementById('checkinModeScanner').style.display = mode === 'scanner' ? 'block' : 'none';
    document.getElementById('checkinModeManual').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('checkinModeWalkin').style.display = mode === 'walkin' ? 'block' : 'none';
    document.getElementById('btnCheckinScanner').classList.toggle('active', mode === 'scanner');
    document.getElementById('btnCheckinManual').classList.toggle('active', mode === 'manual');
    document.getElementById('btnCheckinWalkin').classList.toggle('active', mode === 'walkin');

    if (mode === 'scanner') initScanner();
    else if (qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (mode === 'manual') filterManualCheckin();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
        currentUser = data.username; userPermissions = data.permissions || []; currentMember = data.member;
        localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
        buildNav();
        if (currentMember) { populateProfileTab(currentMember); switchTab('profileTab'); }
        else {
            populateAdminProfile(currentUser);
            if (userPermissions.length === 1 && userPermissions.includes('access_checkin')) switchTab('checkinTab');
            else switchTab('profileTab');
        }
        loadEvents(); loadDirectory();
    } else alert('Invalid credentials!');
}

async function handleLogout() {
    if (currentUser) await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser }) });
    localStorage.removeItem('fog_user'); currentUser = null; currentMember = null; userPermissions = [];
    document.getElementById('hamburgerBtn').style.display = 'none';
    document.getElementById('sidebarNav').innerHTML = '';
    document.getElementById('bottomNav').style.display = 'none';
    switchTab('loginTab'); 
}

function populateProfileTab(member) {
    document.getElementById('myMemberId').value = member.id;
    document.getElementById('myProfileName').innerText = member.name;
    document.getElementById('myProfileCode').innerText = `Unique Pass ID: ${member.qr_code}`;
    document.getElementById('myEditName').value = member.name || '';
    document.getElementById('myEditEmail').value = member.email || '';
    document.getElementById('myEditAge').value = member.age || '';
    document.getElementById('myEditBirthday').value = member.birthday || '';
    document.getElementById('myEditSocial').value = member.social_media || '';
    document.getElementById('myEditParents').value = member.parents_name || '';

    const avatar = document.getElementById('myProfileAvatar');
    if (member.profile_picture) {
        avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    } else avatar.innerHTML = member.name.charAt(0).toUpperCase();

    document.getElementById('myQrContainer').innerHTML = '';
    QRCode.toDataURL(member.qr_code, { width: 220 }, function (err, url) {
        const img = document.createElement('img'); img.src = url;
        document.getElementById('myQrContainer').appendChild(img);
        document.getElementById('myDownloadQrBtn').href = url;
    });
}

function populateAdminProfile(username) {
    document.getElementById('myProfileName').innerText = username + " (Administrator)";
    document.getElementById('myProfileCode').innerText = "LEADER ACCOUNT";
    document.getElementById('myEditName').value = username;
    document.getElementById('myEditEmail').value = username;
    document.getElementById('myProfileAvatar').innerHTML = "A";
    document.getElementById('myQrContainer').innerHTML = `<span class="badge badge-orange" style="font-size: 1.1rem; padding: 12px 20px;">AUTHORIZED LEADER</span>`;
}

async function handleSelfProfileUpdate(e) {
    e.preventDefault();
    const id = document.getElementById('myMemberId').value;
    if (!id) return alert('Admin accounts are updated directly in Add Permissions.');

    const fileInput = document.getElementById('myEditProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('myEditName').value, email: document.getElementById('myEditEmail').value,
        age: document.getElementById('myEditAge').value, birthday: document.getElementById('myEditBirthday').value,
        social_media: document.getElementById('myEditSocial').value, parents_name: document.getElementById('myEditParents').value,
        password: document.getElementById('myEditPassword').value, profile_picture: picBase64, actor: currentUser
    };

    triggerActionConfirmation(`Save changes to your personal profile?`, async () => {
        const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            alert('Profile updated successfully!');
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            populateProfileTab(data.member);
        }
    });
}

async function handlePublicRegistration(e) {
    e.preventDefault();
    const fileInput = document.getElementById('regProfilePic');
    let picBase64 = null;
    if (fileInput.files.length > 0) picBase64 = await getBase64(fileInput.files[0], 400);

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
}

function initScanner() {
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
                updateActiveEventBanner();
            } else alert(data.error || 'Check-in failed');
        });
    }, (err) => {});
}

async function updateActiveEventBanner() {
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
    filterManualCheckin();
}

async function filterManualCheckin() {
    const query = document.getElementById('manualSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('manualCheckinResults');

    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }

    let matches = youthData;
    if (query) matches = youthData.filter(y => y.name.toLowerCase().includes(query) || (y.qr_code && y.qr_code.toLowerCase().includes(query)));
    else matches = youthData.slice(0, 20);

    container.innerHTML = matches.map(y => {
        const avatarHtml = y.profile_picture
            ? `<img src="${y.profile_picture}" class="avatar-circle" style="cursor:pointer;" onclick="openImageViewer(this.src)">`
            : `<div class="avatar-circle">${y.name.charAt(0).toUpperCase()}</div>`;

        const isCheckedIn = checkedInYouthIds.has(y.id);
        const btnHtml = isCheckedIn
            ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="background: #94A3B8; color: #FFF; cursor: not-allowed;">Done</button>`
            : `<button type="button" class="btn btn-primary btn-sm" onclick="quickCheckin(${y.id}, '${y.name.replace(/'/g, "\\'")}')">Check In</button>`;

        return `
        <div class="search-item">
            <div style="display: flex; gap: 10px; align-items: center;">
                ${avatarHtml}
                <div><strong>${y.name}</strong><br><small style="color: var(--text-muted);">${y.qr_code} | Age: ${y.age || 'N/A'}</small></div>
            </div>
            <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-outline btn-sm" onclick="openFastEditProfileModal(${y.id})">Edit</button>
                ${btnHtml}
            </div>
        </div>`;
    }).join('');
}

function openFastEditProfileModal(id) {
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
}
function closeFastEditProfileModal() { document.getElementById('fastEditProfileModal').classList.remove('active'); }

async function submitFastEditProfile(doCheckIn) {
    const form = document.getElementById('fastEditProfileForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('fastEditMemberId').value;
    const fileInput = document.getElementById('fastEditProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('fastEditName').value, email: document.getElementById('fastEditEmail').value,
        age: document.getElementById('fastEditAge').value, birthday: document.getElementById('fastEditBirthday').value,
        social_media: document.getElementById('fastEditSocial').value, parents_name: document.getElementById('fastEditParents').value,
        profile_picture: picBase64, password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, actor: currentUser
    };

    triggerActionConfirmation(`Confirm updating profile for ${payload.name}?`, async () => {
        const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) {
            closeFastEditProfileModal(); youthData = []; await loadDirectory();
            if(doCheckIn) quickCheckin(id, payload.name);
            else { alert("Profile updated successfully!"); updateActiveEventBanner(); }
        }
    });
}

async function quickCheckin(youthId, memberName) {
    const eventId = document.getElementById('activeEventDropdown').value;
    if (!eventId) return alert('Please select an active event first!');
    const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: 0, actor: currentUser }) });
    const data = await res.json();
    if (data.success) { alert(`Successfully checked in ${memberName || 'member'}!`); updateActiveEventBanner(); }
    else alert(data.error || 'Check-in failed');
}

async function handleWalkin(e) {
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
        if (checkinData.success) { alert(`Successfully registered and checked in walk-in: ${payload.name}`); e.target.reset(); youthData = []; updateActiveEventBanner(); }
        else alert(checkinData.error || 'Registration succeeded, but check-in failed.');
    } else alert(regData.error || 'Failed to register walk-in.');
}

async function loadDirectory() {
    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }
    filterDirectory();
}

// ------------------------------------------
// PHASE 2 - MOBILE CARDS: DIRECTORY LIST
// ------------------------------------------
function filterDirectory() {
    const q = document.getElementById('directorySearchInput').value.toLowerCase().trim();
    const sort = document.getElementById('sortDirectorySelect').value;
    const ageCat = document.getElementById('filterAgeCategory').value;

    let matches = youthData.filter(y => y.age !== null && y.age !== '' && !isNaN(y.age));
    if (q) matches = matches.filter(y => y.name.toLowerCase().includes(q) || (y.qr_code && y.qr_code.toLowerCase().includes(q)));

    let labelText = "Total Registered";
    if (ageCat === 'minis') { matches = matches.filter(y => y.age <= 12); labelText = "Minis"; }
    if (ageCat === 'youth') { matches = matches.filter(y => y.age >= 13 && y.age <= 21); labelText = "Youth"; }
    if (ageCat === 'adult') { matches = matches.filter(y => y.age >= 22); labelText = "Adults"; }

    document.getElementById('directoryTotalCount').innerText = `${labelText}: ${matches.length}`;
    if (sort === 'name_asc') matches.sort((a,b) => a.name.localeCompare(b.name));
    if (sort === 'name_desc') matches.sort((a,b) => b.name.localeCompare(a.name));
    if (sort === 'age_asc') matches.sort((a,b) => (a.age || 0) - (b.age || 0));
    if (sort === 'age_desc') matches.sort((a,b) => (b.age || 0) - (a.age || 0));

    let html = matches.map(y => {
        const avatarHtml = y.profile_picture ? `<img src="${y.profile_picture}" class="avatar-circle" style="width: 45px; height: 45px; font-size: 1.2rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 45px; height: 45px; font-size: 1.2rem;">${y.name.charAt(0).toUpperCase()}</div>`;
        return `
        <div class="data-row">
            <div class="data-row-main">
                ${avatarHtml}
                <div>
                    <strong style="color:var(--text-main); font-size:1.05rem;">${y.name}</strong><br>
                    <small style="color: var(--text-muted);">${y.qr_code}</small>
                </div>
            </div>
            <div class="data-row-meta">
                <span><strong>Age:</strong> ${y.age || 'N/A'}</span>
                <span><strong>B-Day:</strong> ${y.birthday || 'N/A'}</span>
            </div>
            <div class="data-row-actions">
                <button type="button" class="btn btn-primary btn-sm" onclick="openViewProfileModal(${y.id})">View</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="openEditMemberModal(${y.id})">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteMember(${y.id}, '${y.name.replace(/'/g, "\\'")}')">Del</button>
            </div>
        </div>`}).join('');
    
    document.getElementById('directoryTableContainer').innerHTML = html;
}

function openEditMemberModal(youthId) {
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
}
function closeEditMemberModal() { document.getElementById('editMemberModal').classList.remove('active'); }

async function saveMemberEditWithConfirm() {
    const form = document.getElementById('editMemberModal').querySelector('form');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('editMemberId').value;
    const fileInput = document.getElementById('editMemberProfilePic');
    let picBase64 = undefined;
    if (fileInput.files.length > 0) picBase64 = await getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('editMemberName').value, email: document.getElementById('editMemberEmail').value,
        age: document.getElementById('editMemberAge').value, birthday: document.getElementById('editMemberBirthday').value,
        social_media: document.getElementById('editMemberSocial').value, parents_name: document.getElementById('editMemberParents').value,
        password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, profile_picture: picBase64, actor: currentUser
    };

    triggerActionConfirmation(`Confirm updating member profile for '${payload.name}'?`, async () => {
        await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeEditMemberModal(); youthData = []; loadDirectory();
    });
}

async function openViewProfileModal(youthId) {
    const member = youthData.find(y => y.id == youthId);
    if (!member) return;
    document.getElementById('modalProfileName').innerText = member.name;
    document.getElementById('modalProfileCode').innerText = `Unique Pass ID: ${member.qr_code}`;
    document.getElementById('modalBioSummary').innerHTML = `
        <strong>Email Address:</strong> ${member.email || 'N/A'}<br>
        <strong>Age / Birthday:</strong> ${member.age || 'N/A'} (${member.birthday || 'N/A'})<br>
        <strong>Social Media:</strong> ${member.social_media || 'N/A'}<br>
        <strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}
    `;

    const avatar = document.getElementById('viewModalProfileAvatar');
    if (member.profile_picture) avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    else avatar.innerHTML = member.name.charAt(0).toUpperCase();

    document.getElementById('modalQrContainer').innerHTML = '';
    QRCode.toDataURL(member.qr_code, { width: 180 }, function (err, url) {
        const img = document.createElement('img'); img.src = url;
        document.getElementById('modalQrContainer').appendChild(img);
        document.getElementById('modalDownloadQrBtn').href = url;
    });

    try {
        const res = await fetch(`/api/youth/${youthId}/history`);
        const history = await res.json();
        const historyContainer = document.getElementById('modalAttendanceHistory');
        if (!history || history.length === 0) historyContainer.innerHTML = `<p style="color: var(--text-muted);">No attendance history recorded yet.</p>`;
        else historyContainer.innerHTML = history.map(h => `<div style="border-bottom: 1px solid var(--border-color); padding: 8px 0;"><strong>${h.event_name}</strong> (${h.event_date}) - <small style="color:var(--text-muted);">${h.checked_in_at}</small></div>`).join('');
    } catch(e) { console.error(e); }
    document.getElementById('viewProfileModal').classList.add('active');
}
function closeViewProfileModal() { document.getElementById('viewProfileModal').classList.remove('active'); }

function openPreregSettings(eventId) {
    const e = eventsData.find(ev => ev.id == eventId);
    if (!e) return;
    document.getElementById('preregSetEventId').value = e.id;
    document.getElementById('preregSetTitle').value = e.prereg_title || e.name || '';
    document.getElementById('preregSetInfo').value = e.prereg_info || '';
    document.getElementById('preregSetBanner').value = '';
    document.getElementById('preregSetBottomBanner').value = '';
    document.getElementById('preregSettingsModal').classList.add('active');
}
function closePreregSettingsModal() { document.getElementById('preregSettingsModal').classList.remove('active'); }

async function savePreregSettings(e) {
    e.preventDefault();
    const id = document.getElementById('preregSetEventId').value;
    const title = document.getElementById('preregSetTitle').value;
    const info = document.getElementById('preregSetInfo').value;
    const fileInput = document.getElementById('preregSetBanner');
    const fileInputBottom = document.getElementById('preregSetBottomBanner');

    let bannerBase64 = null;
    if (fileInput.files.length > 0) bannerBase64 = await getBase64(fileInput.files[0], 1200);

    let bottomBannerBase64 = null;
    if (fileInputBottom.files.length > 0) bottomBannerBase64 = await getBase64(fileInputBottom.files[0], 1200);

    triggerActionConfirmation('Save Pre-Registration Page Settings?', async () => {
        const res = await fetch(`/api/events/${id}/prereg-settings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ banner: bannerBase64, bottom_banner: bottomBannerBase64, title, info, actor: currentUser })
        });
        if(res.ok) { alert('Settings saved successfully!'); closePreregSettingsModal(); loadEvents(); }
    });
}

async function openPublicPreregFromSettings() {
    const id = document.getElementById('preregSetEventId').value;
    closePreregSettingsModal(); launchPublicPrereg(id);
}

async function launchPublicPrereg(eventId) {
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
    switchTab('preregPublicTab'); showPreregStep(1);
}

function closePublicPrereg() {
    currentPreregEventId = null;
    document.getElementById('mainHeader').style.display = 'block';
    window.history.pushState(null, '', window.location.pathname);
    window.location.reload();
}

function showPreregStep(step) {
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
}

function filterPreregSearch() {
    const q = document.getElementById('preregSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('preregSearchResults');
    if (q.length < 2) { container.style.display = 'none'; return; }

    let matches = youthData.filter(y => y.name.toLowerCase().includes(q));
    if (matches.length > 0) {
        container.innerHTML = matches.map(y => {
            const isRegistered = currentPreRegYouthIds.has(y.id);
            const btnHtml = isRegistered ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="border: none; font-size: 0.75rem;">Already registered</button>` : `<button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="executePreregister(${y.id}, '${y.qr_code}')">Register</button>`;
            return `
            <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <div style="flex: 1; word-break: break-word; color: var(--text-main); font-weight:600;">${y.name}</div>
                <div>${btnHtml}</div>
            </div>`}).join('');
        container.style.display = 'block';
    } else {
        container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No matches found.</div>`;
        container.style.display = 'block';
    }
}

async function executePreregister(youthId, qrCode) {
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
            showPreregStep(4);
        } else alert("An error occurred during pre-registration.");
    } catch(e) { alert("Connection error during pre-registration."); }
}

async function submitNewPrereg(e) {
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
        if (regData.id) executePreregister(regData.id, regData.qr_code);
        else alert(regData.error || 'Failed to create registration.');
    } catch(err) { alert("Network error."); }
}

function dataURItoFile(dataURI, fileName) {
    const arr = dataURI.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) { u8arr[n] = bstr.charCodeAt(n); }
    return new File([u8arr], fileName, { type: mime });
}

async function sharePreRegLink() {
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
            const posterFile = dataURItoFile(targetBase64Image, 'event-poster.jpg');
            if (navigator.canShare && navigator.canShare({ files: [posterFile] })) shareData.files = [posterFile];
        } catch (err) { console.error('Image attachment failed:', err); }
    }

    if (navigator.share) {
        try { await navigator.share(shareData); } catch (error) { console.log('Error sharing', error); }
    } else {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => alert(`Link copied to clipboard!\n\n${shareText}`));
    }
}

function openEditEventModal(eventId) {
    const e = eventsData.find(ev => ev.id == eventId);
    if (!e) return;
    document.getElementById('editEvtId').value = e.id;
    document.getElementById('editEvtName').value = e.name || '';
    document.getElementById('editEvtDate').value = e.event_date || '';
    document.getElementById('editEvtTime').value = e.time_start || '';
    document.getElementById('editEvtVenue').value = e.venue || '';
    document.getElementById('editEvtPhotosUrl').value = e.photos_url || '';
    document.getElementById('editEvtMaterialsUrl').value = e.materials_url || '';
    document.getElementById('editEvtPoster').value = '';
    closeAnalyticsModal();
    document.getElementById('editEventModal').classList.add('active');
}
function closeEditEventModal() { document.getElementById('editEventModal').classList.remove('active'); }

async function submitEditEvent() {
    const form = document.getElementById('editEventForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }
    const id = document.getElementById('editEvtId').value;
    const fileInput = document.getElementById('editEvtPoster');

    triggerActionConfirmation(`Confirm saving changes to event?`, async () => {
        let posterBase64 = null;
        if (fileInput.files.length > 0) posterBase64 = await getBase64(fileInput.files[0], 1200);
        const payload = {
            name: document.getElementById('editEvtName').value, event_date: document.getElementById('editEvtDate').value,
            time_start: document.getElementById('editEvtTime').value, venue: document.getElementById('editEvtVenue').value,
            poster: posterBase64, photos_url: document.getElementById('editEvtPhotosUrl').value,
            materials_url: document.getElementById('editEvtMaterialsUrl').value, actor: currentUser
        };
        try {
            const res = await fetch(`/api/events/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) { closeEditEventModal(); alert("Event updated successfully!"); loadEvents(); }
        } catch(e) { alert("Error connecting to server."); }
    });
}

function setAnalyticsCardFilter(type) {
    currentRosterFilter = type;
    document.getElementById('cardTurnout').style.opacity = type === 'all' ? '1' : '0.5';
    document.getElementById('cardPreReg').style.opacity = type === 'prereg' ? '1' : '0.5';
    document.getElementById('cardWalkin').style.opacity = type === 'walkin' ? '1' : '0.5';
    filterAnalyticsRoster();
}

function openAddAttendeeModal() {
    if(!currentAnalyticsData) return;
    document.getElementById('addAttendeeSearch').value = '';
    document.getElementById('addAttendeeResults').innerHTML = '';
    document.getElementById('addAttendeeModal').classList.add('active');
    if(youthData.length === 0) loadDirectory();
}
function closeAddAttendeeModal() { document.getElementById('addAttendeeModal').classList.remove('active'); }

function filterAddAttendeeSearch() {
    const q = document.getElementById('addAttendeeSearch').value.toLowerCase().trim();
    const container = document.getElementById('addAttendeeResults');
    if (q.length < 2) { container.innerHTML = ''; return; }

    const matches = youthData.filter(y => y.name.toLowerCase().includes(q));
    const existingIds = currentAnalyticsData.roster.map(r => r.youth_id);

    container.innerHTML = matches.map(y => {
        const isExisting = existingIds.includes(y.id);
        const buttons = isExisting
            ? `<span style="font-size: 0.8rem; color: var(--success); font-weight: bold;">Already In Roster</span>`
            : `<button class="btn btn-primary btn-sm" onclick="submitAddAttendee(${y.id}, 0, '${y.name.replace(/'/g, "\\'")}')">Add Pre-Reg</button>
               <button class="btn btn-outline btn-sm" onclick="submitAddAttendee(${y.id}, 1, '${y.name.replace(/'/g, "\\'")}')">Add Walk-in</button>`;
        return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
            <div><strong style="color:var(--text-main);">${y.name}</strong><br><small style="color: var(--text-muted);">${y.qr_code}</small></div>
            <div style="display: flex; gap: 5px;">${buttons}</div>
        </div>`;
    }).join('');
}

async function submitAddAttendee(youthId, isWalkin, name) {
    const eventId = currentAnalyticsData.event.id;
    try {
        const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: isWalkin, actor: currentUser }) });
        const data = await res.json();
        if (data.success) { alert(`Added ${name} to the event!`); closeAddAttendeeModal(); openAnalyticsModal(eventId); }
        else alert(data.error || 'Failed to add attendee.');
    } catch(e) { alert('Connection error.'); }
}

async function openAnalyticsModal(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/analytics`);
        if (!res.ok) throw new Error("Server returned " + res.status);
        const data = await res.json();
        if (!data || data.error) return alert('Failed to load event analytics');

        currentAnalyticsData = data;
        const posterContainer = document.getElementById('analyticsModalPoster');
        if (data.event.poster) posterContainer.innerHTML = `<img src="${data.event.poster}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
        else posterContainer.innerHTML = `<span style="font-size: 0.75rem; color: #aaa; text-align: center; font-weight: 600;">No<br>Poster</span>`;

        document.getElementById('analyticsEventTitle').innerText = data.event.name;
        document.getElementById('analyticsEventMeta').innerText = `📅 Date: ${data.event.event_date} | 📍 Venue: ${data.event.venue || 'N/A'}`;

        let linksHtml = '';
        if(data.event.photos_url) linksHtml += `<a href="${data.event.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration: none;">📷 Photos</a>`;
        if(data.event.materials_url) linksHtml += `<a href="${data.event.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration: none;">📁 Materials</a>`;
        document.getElementById('analyticsEventLinks').innerHTML = linksHtml;

        document.getElementById('statTotalTurnout').innerText = data.totalTurnout;
        document.getElementById('statTotalPreReg').innerText = data.totalPreRegistered;
        document.getElementById('statWalkins').innerText = data.walkins;
        document.getElementById('statTurnoutPercent').innerText = `${data.turnoutPercentage}%`;
        document.getElementById('analyticsEditEventBtn').onclick = () => openEditEventModal(eventId);
        document.getElementById('attSearchNative').value = '';
        document.getElementById('attAgeNative').value = 'all';
        currentRosterFilter = 'all';
        document.getElementById('cardTurnout').style.opacity = '1';
        document.getElementById('cardPreReg').style.opacity = '0.5';
        document.getElementById('cardWalkin').style.opacity = '0.5';
        filterAnalyticsRoster();
        document.getElementById('eventAnalyticsModal').classList.add('active');
    } catch (error) { alert("Could not connect to the server to load analytics."); }
}

function filterAnalyticsRoster() {
    const q = document.getElementById('attSearchNative').value.toLowerCase();
    const ageFilter = document.getElementById('attAgeNative').value;
    if(!currentAnalyticsData) return;

    let sourceList = [];
    if (currentRosterFilter === 'prereg') sourceList = currentAnalyticsData.preRegList || [];
    else if (currentRosterFilter === 'walkin') sourceList = (currentAnalyticsData.roster || []).filter(r => r.is_walkin === 1);
    else sourceList = currentAnalyticsData.roster || [];

    const filtered = sourceList.filter(r => {
        const nameMatch = r.name.toLowerCase().includes(q) || (r.qr_code && r.qr_code.toLowerCase().includes(q));
        let ageMatch = true;
        const age = parseInt(r.age);
        if (ageFilter !== 'all' && !isNaN(age)) {
            if (ageFilter === 'mini' && (age < 7 || age > 12)) ageMatch = false;
            if (ageFilter === 'youth' && (age < 13 || age > 21)) ageMatch = false;
            if (ageFilter === 'adult' && age < 22) ageMatch = false;
        } else if (ageFilter !== 'all' && isNaN(age)) ageMatch = false;
        return nameMatch && ageMatch;
    });

    document.getElementById('attRosterCount').innerText = `Total: ${filtered.length}`;
    renderAnalyticsRoster(filtered);
}

function renderAnalyticsRoster(list) {
    const rosterContainer = document.getElementById('analyticsRosterContainer');
    if (list.length === 0) { rosterContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin:15px 0; font-size: 0.9rem;">No attendees found.</p>`; return; }

    rosterContainer.innerHTML = list.map(r => {
        const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${r.name.charAt(0).toUpperCase()}</div>`;
        let statusBadge = '', actionButtons = '', timeText = '';

        if (currentRosterFilter === 'prereg') {
            const arrived = (currentAnalyticsData.roster || []).find(a => a.youth_id === r.youth_id);
            if (arrived) {
                statusBadge = `<span style="font-size:11px; color:var(--success); background: rgba(16,185,129,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Arrived</span>`;
                timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(arrived.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
            } else {
                statusBadge = `<span style="font-size:11px; color:#F59E0B; background: rgba(245,158,11,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Expected</span>`;
                timeText = `<span style="color: #F59E0B; font-size: 0.8rem; font-weight: 600;">Not Arrived</span>`;
            }
        } else {
            statusBadge = `<span style="font-size:11px; color:var(--text-muted); background: var(--bg-light); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${r.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span>`;
            timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(r.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
            if (userPermissions.includes('edit_attendance')) {
                actionButtons = `<div style="display: flex; gap: 5px; margin-top: 6px; justify-content: flex-end;">
                    <button class="btn btn-outline btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="openEditAttendanceModal(${r.log_id}, '${r.checked_in_at}', ${r.is_walkin})">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="triggerDeleteAttendance(${r.log_id}, '${r.name.replace(/'/g, "\\'")}')">🗑️</button>
                </div>`;
            }
        }
        return `
        <div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 10px; align-items: center;">
                ${avatarHtml}
                <div>
                    <strong style="color: var(--text-main); font-size: 0.95rem;">${r.name}</strong>${statusBadge}<br>
                    <small style="color: var(--text-muted);">${r.qr_code} ${r.age ? '| Age: '+r.age : ''}</small>
                </div>
            </div>
            <div style="text-align: right;">${timeText}${actionButtons}</div>
        </div>`;
    }).join('');
}
function closeAnalyticsModal() { document.getElementById('eventAnalyticsModal').classList.remove('active'); currentAnalyticsData = null; }

function exportAnalyticsCSV() {
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
        rows.push([`"${r.name}"`, `"${identifier}"`, `"${status}"`]);
    });
    downloadCSV(rows, `Roster_${currentAnalyticsData.event.name.replace(/\s+/g, '_')}.csv`);
}

async function loadUserPermissionsList() {
    const res = await fetch('/api/users/list');
    allUsersList = await res.json();
    filterPermUserList();
}

function filterPermUserList() {
    const q = document.getElementById('permUserSearchInput').value.toLowerCase().trim();
    const container = document.getElementById('permUserListContainer');
    let matches = allUsersList;
    if (q) matches = allUsersList.filter(u => u.display_name.toLowerCase().includes(q));

    if (matches.length === 0) { container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No accounts found matching '${q}'</div>`; return; }

    container.innerHTML = matches.map(u => `
        <div class="search-item">
            <div><strong style="color:var(--text-main); font-size:1.05rem;">${u.display_name}</strong></div>
            <button type="button" class="btn btn-primary btn-sm" onclick="openAssignPermissionModal(${u.id}, '${u.display_name.replace(/'/g, "\\'")}', '${JSON.stringify(u.permissions).replace(/'/g, "\\'")}')">Edit Permissions</button>
        </div>
    `).join('');
}

function openAssignPermissionModal(id, displayName, permsJson) {
    const perms = JSON.parse(permsJson || '[]');
    document.getElementById('modalPermUserId').value = id;
    document.getElementById('permModalUserBanner').innerText = `Assign Permissions for: ${displayName}`;
    document.querySelectorAll('.permCheckModal').forEach(chk => { chk.checked = perms.includes(chk.value); });
    document.getElementById('assignPermissionModal').classList.add('active');
}
function closeAssignPermissionModal() { document.getElementById('assignPermissionModal').classList.remove('active'); }

function handleSavePermissionsFromModal() {
    const userId = document.getElementById('modalPermUserId').value;
    const selectedPerms = [];
    document.querySelectorAll('.permCheckModal:checked').forEach(chk => { selectedPerms.push(chk.value); });

    triggerActionConfirmation(`Confirm updating permission set?`, async () => {
        const res = await fetch(`/api/users/${userId}/permissions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: selectedPerms, actor: currentUser }) });
        const data = await res.json();
        if (data.success) { alert('Permissions updated successfully!'); closeAssignPermissionModal(); loadUserPermissionsList(); }
    });
}

function handleCreateUserAccount(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;

    triggerActionConfirmation(`Create new leader account '${username}'?`, async () => {
        const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser, username, password, permissions: ['access_checkin', 'access_directory'] }) });
        const data = await res.json();
        if (data.success) {
            alert(`User account created! Click 'Edit Permissions' to customize access.`);
            document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = '';
            loadUserPermissionsList();
        } else alert(data.error || 'Failed to create user');
    });
}

function setEventViewMode(mode) {
    eventViewMode = mode;
    document.getElementById('viewBtnList').classList.toggle('active', mode === 'list');
    document.getElementById('viewBtnGrid').classList.toggle('active', mode === 'grid');
    document.getElementById('viewBtnCal').classList.toggle('active', mode === 'calendar');
    document.getElementById('calendarControls').style.display = mode === 'calendar' ? 'flex' : 'none';

    if(eventsData.length === 0) loadEvents();
    else {
        const container = document.getElementById('eventsListContainer');
        if (eventViewMode === 'list') {
            container.className = 'events-list-view';
            container.innerHTML = eventsData.map(e => {
                let linkBadges = '';
                if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`;
                if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`;
                return `
                <div style="border-bottom: 1px solid var(--border-color); padding: 15px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="cursor: pointer; color: var(--primary); font-size: 1.1rem;" onclick="openAnalyticsModal(${e.id})">${e.name}</strong><br>
                        <small style="color: var(--text-muted); font-size: 0.85rem;">${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''} | ${e.venue || 'No Location'}</small>
                        ${linkBadges ? `<div style="margin-top: 8px;">${linkBadges}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" class="btn btn-primary btn-sm" onclick="openAnalyticsModal(${e.id})">Details</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>
                        <button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${e.name.replace(/'/g, "\\'")}')">Del</button>
                    </div>
                </div>`}).join('');
        } else if (eventViewMode === 'grid') {
            container.className = 'events-grid-view';
            container.innerHTML = eventsData.map(e => {
                let linkBadges = '';
                if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`;
                if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`;
                return `
                <div class="event-card">
                    ${e.poster ? `<img src="${e.poster}" class="event-card-img" style="cursor:pointer;" onclick="openAnalyticsModal(${e.id})" alt="Poster">` : `<div class="event-card-img" style="background: var(--bg-light); border-bottom: 1px solid var(--border-color); cursor:pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem;" onclick="openAnalyticsModal(${e.id})">Blank Thumbnail</div>`}
                    <div style="padding: 15px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <h3 style="font-size: 1.1rem; margin-bottom: 6px; color: var(--text-main); cursor: pointer;" onclick="openAnalyticsModal(${e.id})">${e.name}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">📅 ${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''}<br>📍 ${e.venue || 'No Location'}</p>
                            ${linkBadges ? `<div style="margin-bottom: 12px;">${linkBadges}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 10px;">
                            <button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="openAnalyticsModal(${e.id})">Details</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>
                            <button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${e.name.replace(/'/g, "\\'")}')">Del</button>
                        </div>
                    </div>
                </div>`}).join('');
        } else if (eventViewMode === 'calendar') renderCalendarView(container);
    }
}

async function loadEvents() {
    try {
        const res = await fetch('/api/events');
        eventsData = await res.json();
        const dropdown = document.getElementById('activeEventDropdown');
        if (dropdown) {
            dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name} (${e.event_date})</option>`).join('');
            if (eventsData.length > 0) updateActiveEventBanner();
        }
        setEventViewMode(eventViewMode);
    } catch(e) { console.error("Failed loading events."); }
}

function renderCalendarView(container) {
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
        dayEvents.forEach(e => html += `<div class="calendar-event-tag" onclick="openAnalyticsModal(${e.id})" title="View Analytics for ${e.name.replace(/"/g, '&quot;')}">${e.name}</div>`);
        html += `</div>`;
    }
    html += `</div>`;
    container.className = ''; container.innerHTML = html;
}

function changeCalendarMonth(delta) { calCurrentDate.setMonth(calCurrentDate.getMonth() + delta); loadEvents(); }

// ------------------------------------------
// PHASE 2 - MOBILE CARDS: ATTENDANCE LOGS
// ------------------------------------------

async function loadAttendanceLogs() {
    const res = await fetch('/api/attendance/logs');
    cachedAttendanceLogs = await res.json();
    filterAttendanceLogs();
}

function filterAttendanceLogs() {
    const q = document.getElementById('attendanceSearchInput').value.toLowerCase().trim();
    let matches = cachedAttendanceLogs;
    if(q) matches = matches.filter(l => l.member_name.toLowerCase().includes(q) || l.event_name.toLowerCase().includes(q));

    let html = matches.map(l => `
        <div class="data-row">
            <div class="data-row-main">
                <div style="background: rgba(16,185,129,0.1); width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">✅</div>
                <div>
                    <strong style="color:var(--text-main); font-size:1.05rem;">${l.member_name}</strong><br>
                    <small style="color: var(--text-muted);">${l.event_name}</small>
                </div>
            </div>
            <div class="data-row-meta">
                <span><strong>Time:</strong> ${l.checked_in_at}</span>
                <span class="badge ${l.is_walkin ? 'badge-orange' : 'badge-green'}" style="width: fit-content;">${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span>
            </div>
            <div class="data-row-actions">
                ${userPermissions.includes('edit_attendance') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditAttendanceModal(${l.id}, '${l.checked_in_at}', ${l.is_walkin})">Edit</button>` : ''}
                <button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteAttendance(${l.id}, '${l.member_name.replace(/'/g, "\\'")}')">Del</button>
            </div>
        </div>`).join('');
    
    document.getElementById('attendanceLogsContainer').innerHTML = html;
}

function exportAttendanceLogsCSV() {
    if(!cachedAttendanceLogs || cachedAttendanceLogs.length === 0) return alert('No attendance logs to export.');
    const rows = [['Log ID', 'Member Name', 'Event', 'Checked In At', 'Status']];
    cachedAttendanceLogs.forEach(l => rows.push([l.id, `"${l.member_name}"`, `"${l.event_name}"`, `"${l.checked_in_at}"`, `"${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}"`]));
    downloadCSV(rows, 'All_Attendance_Logs.csv');
}

// ------------------------------------------
// PHASE 2 - MOBILE CARDS: ACTIVITY LOGS
// ------------------------------------------

async function loadActivityLogs() {
    const res = await fetch('/api/activity-logs');
    cachedActivityLogs = await res.json();
    filterActivityLogs();
}

function filterActivityLogs() {
    const q = document.getElementById('activitySearchInput').value.toLowerCase().trim();
    let matches = cachedActivityLogs;
    if(q) matches = matches.filter(l => l.username.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q));

    let html = matches.map(l => `
        <div class="data-row">
            <div class="data-row-main">
                <div style="background: rgba(59,130,246,0.1); width: 45px; height: 45px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📝</div>
                <div>
                    <strong style="color:var(--text-main); font-size:1.05rem;">${l.username}</strong><br>
                    <span class="badge badge-orange" style="margin-top: 4px;">${l.action}</span>
                </div>
            </div>
            <div class="data-row-meta" style="flex: 2; min-width: 200px;">
                <span style="color:var(--text-main);">${l.details}</span>
                <span>${l.created_at}</span>
            </div>
        </div>`).join('');
        
    document.getElementById('activityLogsContainer').innerHTML = html;
}

function exportActivityLogsCSV() {
    if(!cachedActivityLogs || cachedActivityLogs.length === 0) return alert('No activity logs to export.');
    const rows = [['Log ID', 'Timestamp', 'User', 'Action', 'Details']];
    cachedActivityLogs.forEach(l => rows.push([l.id, `"${l.created_at}"`, `"${l.username}"`, `"${l.action}"`, `"${l.details}"`]));
    downloadCSV(rows, 'All_Activity_Logs.csv');
}

function handleCreateEvent(e) {
    e.preventDefault();
    const fileInput = document.getElementById('evtPoster');
    triggerActionConfirmation(`Publish new event?`, async () => {
        let posterBase64 = null;
        if (fileInput.files.length > 0) posterBase64 = await getBase64(fileInput.files[0], 1200);
        const payload = {
            name: document.getElementById('evtName').value, event_date: document.getElementById('evtDate').value,
            time_start: document.getElementById('evtTime').value, venue: document.getElementById('evtVenue').value,
            poster: posterBase64, photos_url: document.getElementById('evtPhotosUrl').value,
            materials_url: document.getElementById('evtMaterialsUrl').value, actor: currentUser
        };
        try {
            const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('createEventForm').reset(); alert('Event published successfully!'); switchEventSubTab('list'); }
        } catch(e) { alert("Failed to connect to the server."); }
    });
}

function triggerActionConfirmation(summaryText, actionFn) {
    document.getElementById('confirmSummary').innerText = summaryText;
    pendingAction = actionFn;
    document.getElementById('confirmModal').classList.add('active');
}
function closeConfirmModal() { document.getElementById('confirmModal').classList.remove('active'); pendingAction = null; }
document.getElementById('executeConfirmBtn').onclick = async () => { if (pendingAction) await pendingAction(); closeConfirmModal(); };

function openEditAttendanceModal(id, time, isWalkin) {
    document.getElementById('editAttId').value = id; document.getElementById('editAttTime').value = time;
    document.getElementById('editAttWalkin').value = isWalkin ? "1" : "0"; document.getElementById('editAttendanceModal').classList.add('active');
}
function closeEditAttendanceModal() { document.getElementById('editAttendanceModal').classList.remove('active'); }

function saveAttendanceEditWithConfirm() {
    const id = document.getElementById('editAttId').value;
    const checked_in_at = document.getElementById('editAttTime').value;
    const is_walkin = parseInt(document.getElementById('editAttWalkin').value);
    triggerActionConfirmation(`Update Attendance Log ID #${id}?`, async () => {
        await fetch(`/api/attendance/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checked_in_at, is_walkin, actor: currentUser }) });
        closeEditAttendanceModal(); loadAttendanceLogs();
        if (currentAnalyticsData) openAnalyticsModal(currentAnalyticsData.event.id);
    });
}

function triggerDeleteMember(id, name) {
    triggerActionConfirmation(`Permanently DELETE member profile for '${name}'?`, async () => {
        await fetch(`/api/youth/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        youthData = []; loadDirectory(); filterManualCheckin();
    });
}

function triggerDeleteEvent(id, name) {
    triggerActionConfirmation(`Permanently DELETE event '${name}' and associated logs?`, async () => {
        await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        loadEvents();
    });
}

function triggerDeleteAttendance(id, memberName) {
    triggerActionConfirmation(`DELETE attendance record for '${memberName}'?`, async () => {
        await fetch(`/api/attendance/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
        loadAttendanceLogs(); updateActiveEventBanner();
        if (currentAnalyticsData) openAnalyticsModal(currentAnalyticsData.event.id);
    });
}

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

// PHASE 2 - UPDATED PAGINATION ENGINE FOR DATA CARDS
document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        const dataContainer = document.getElementById('directoryTableContainer');

        if (dataContainer && dataContainer.children.length > 0 && !document.getElementById('dirPagerControls')) {
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
                const rows = Array.from(dataContainer.children).filter(el => el.classList.contains('data-row'));
                if(rows.length === 0) return;
                
                const totalPages = Math.ceil(rows.length / perPage) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                if (currentPage < 1) currentPage = 1;
                document.getElementById('dirPageInd').innerText = 'Page ' + currentPage + ' of ' + totalPages;
                document.getElementById('dirPrev').disabled = (currentPage === 1);
                document.getElementById('dirNext').disabled = (currentPage === totalPages);

                rows.forEach((row, index) => {
                    if (perPage >= 999999) row.style.display = 'flex';
                    else {
                        const start = (currentPage - 1) * perPage;
                        const end = start + perPage;
                        row.style.display = (index >= start && index < end) ? 'flex' : 'none';
                    }
                });
            };

            document.getElementById('dirPerPage').onchange = (e) => { perPage = parseInt(e.target.value); currentPage = 1; updateTable(); };
            document.getElementById('dirPrev').onclick = () => { if (currentPage > 1) { currentPage--; updateTable(); } };
            document.getElementById('dirNext').onclick = () => { 
                const rows = Array.from(dataContainer.children).filter(el => el.classList.contains('data-row'));
                if (currentPage < Math.ceil(rows.length / perPage)) { currentPage++; updateTable(); } 
            };
            updateTable();
            new MutationObserver(() => updateTable()).observe(dataContainer, { childList: true });
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
