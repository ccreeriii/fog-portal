// ========== public/js/app.js ==========

let currentUser = null; let currentMember = null; let userPermissions = []; let eventsData = []; let youthData = []; let allUsersList = []; let cachedAttendanceLogs = []; let cachedActivityLogs = []; let ministriesData = []; let pendingAction = null; let eventViewMode = 'list'; let calCurrentDate = new Date(); let qrScanner = null; let currentAnalyticsData = null; let checkedInYouthIds = new Set(); let currentPreregEventId = null; let currentRosterFilter = 'all'; let currentPreRegYouthIds = new Set(); let currentMinistryId = null; let currentDirPage = 1; let dirPerPage = 10; let filteredDir = []; let currentAttPage = 1; let attPerPage = 10; let filteredAtt = []; let currentActPage = 1; let actPerPage = 10; let filteredAct = []; let modalRolesData = []; let modalRolesPage = 1; let modalAttData = []; let modalAttPage = 1;

const _originalFetch = window.fetch;
const OfflineManager = {
    init: function() { window.addEventListener('online', this.handleOnline.bind(this)); window.addEventListener('offline', this.handleOffline.bind(this)); this.updateUI(); this.overrideFetch(); setTimeout(() => { if (navigator.onLine) this.syncQueue(); }, 2000); },
    updateUI: function() { const banner = document.getElementById('offlineBanner'); if (!banner) return; if (navigator.onLine) { banner.style.display = 'none'; document.body.classList.remove('is-offline'); } else { banner.style.display = 'block'; document.body.classList.add('is-offline'); } },
    handleOnline: function() { this.updateUI(); this.syncQueue(); }, handleOffline: function() { this.updateUI(); },
    overrideFetch: function() {
        window.fetch = async function(resource, options) {
            if (!navigator.onLine && options && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
                const url = typeof resource === 'string' ? resource : resource.url;
                if (url.includes('/api/login') || url.includes('/api/logout') || url.includes('/api/backups')) return Promise.resolve(new Response(JSON.stringify({ success: false, error: 'Internet required.' }), { status: 400 }));
                const mockId = Date.now(); const queue = JSON.parse(localStorage.getItem('fog_offline_queue') || '[]'); queue.push({ url, method: options.method, headers: options.headers, body: options.body, mockId }); localStorage.setItem('fog_offline_queue', JSON.stringify(queue));
                let mockRes = { success: true, offline_queued: true, updated: 1, deleted: 1 };
                if (url.includes('/api/youth') && options.method.toUpperCase() === 'POST') mockRes = { id: mockId, qr_code: 'OFFLINE-' + mockId, success: true };
                if (url.includes('/api/checkin')) mockRes = { success: true, member_name: 'Queued', log_id: mockId };
                return Promise.resolve(new Response(JSON.stringify(mockRes), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }
            return _originalFetch.apply(this, arguments);
        };
    },
    syncQueue: async function() {
        const queue = JSON.parse(localStorage.getItem('fog_offline_queue') || '[]'); if (queue.length === 0) return;
        let failed = []; let idMap = {};
        for (let req of queue) {
            try {
                let bodyStr = req.body;
                if (bodyStr && typeof bodyStr === 'string') { try { let b = JSON.parse(bodyStr); if (b.youth_id && idMap[b.youth_id]) b.youth_id = idMap[b.youth_id]; if (b.event_id && idMap[b.event_id]) b.event_id = idMap[b.event_id]; bodyStr = JSON.stringify(b); } catch (err) {} }
                let url = req.url; for (let f in idMap) { if (url.includes(`/${f}`)) url = url.replace(`/${f}`, `/${idMap[f]}`); }
                const res = await _originalFetch(url, { method: req.method, headers: req.headers, body: bodyStr });
                if (!res.ok) throw new Error("Sync fail"); const data = await res.json(); if (req.mockId && data.id) idMap[req.mockId] = data.id;
            } catch (e) { failed.push(req); }
        }
        localStorage.setItem('fog_offline_queue', JSON.stringify(failed));
    }
};
OfflineManager.init();

window.getBase64 = async function(file, maxWidth = 600) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = (event) => { const img = new Image(); img.src = event.target.result; img.onload = () => { const canvas = document.createElement('canvas'); let width = img.width; let height = img.height; if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }; }; reader.onerror = error => reject(error); }); };
window.openImageViewer = function(src) { if (!src || src.length < 50) return; document.getElementById('enlargedImage').src = src; document.getElementById('imageViewerModal').classList.add('active'); };
window.closeImageViewer = function() { document.getElementById('imageViewerModal').classList.remove('active'); };
window.downloadCSV = function(rows, filename) { const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n"); const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); };

document.addEventListener('click', (e) => { if (!e.target.closest('#minSearchInput') && !e.target.closest('#minSearchDropdown')) { const d = document.getElementById('minSearchDropdown'); if(d) d.style.display = 'none'; } if (!e.target.closest('#evtRoleSearchInput') && !e.target.closest('#evtRoleSearchDropdown')) { const d = document.getElementById('evtRoleSearchDropdown'); if(d) d.style.display = 'none'; } });

function bindExecuteAction() {
    const execBtn = document.getElementById('executeConfirmBtn');
    if (execBtn) {
        execBtn.onclick = async (e) => {
            e.preventDefault(); if (execBtn.disabled) return; execBtn.disabled = true;
            const originalText = execBtn.innerText; execBtn.innerText = 'Processing...';
            if (pendingAction) { try { await pendingAction(); } catch (err) { alert("Network Error"); } }
            window.closeConfirmModal(); execBtn.disabled = false; execBtn.innerText = originalText;
        };
    }
}
bindExecuteAction();

window.hasPerm = function(perm) { if (currentUser === 'celsocreeriii@gmail.com') return true; if (!userPermissions || !Array.isArray(userPermissions)) return false; return userPermissions.includes(perm); };

// DYNAMIC SYNCED PRELOADER
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('event')) return window.launchPublicPrereg(urlParams.get('event'));

    document.getElementById('mainHeader').style.display = 'block';
    document.getElementById('mainContainer').style.display = 'block';

    // 1. Enforce a minimum 2.5s preloader
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 2500));
    let loadTasks = [];

    const savedSession = localStorage.getItem('fog_user');
    if (savedSession) {
        const s = JSON.parse(savedSession); currentUser = s.username; currentMember = s.member; userPermissions = Array.isArray(s.permissions) ? s.permissions : [];
        window.buildNav(); window.applyGranularPermissions();
        if (currentMember) window.populateProfileTab(currentMember); else window.populateAdminProfile(currentUser);
        if (currentMember) window.switchTab('profileTab'); else if (window.hasPerm('access_checkin') && !window.hasPerm('access_directory')) window.switchTab('checkinTab'); else window.switchTab('profileTab');
        
        // 2. Queue critical data fetches so the preloader syncs to them
        loadTasks.push(window.loadEvents()); 
        loadTasks.push(window.loadDirectory());
    } else {
        window.switchTab('loginTab');
    }

    // 3. Wait for BOTH the minimum timer AND the network requests to finish
    await Promise.all([minLoadTime, ...loadTasks]);

    // 4. Hide the loader smoothly
    const loader = document.getElementById('globalPreloader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
};

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
        if(event.target.id === 'eventAnalyticsModal') currentAnalyticsData = null;
        if(event.target.id === 'ministryDetailsModal') currentMinistryId = null;
        if(event.target.id === 'confirmModal') pendingAction = null;
    }
};

window.triggerActionConfirmation = function(summaryText, actionFn) { document.getElementById('confirmSummary').innerText = summaryText; pendingAction = actionFn; document.getElementById('confirmModal').classList.add('active'); };
window.closeConfirmModal = function() { document.getElementById('confirmModal').classList.remove('active'); pendingAction = null; };
window.openSidebar = function() { document.getElementById('sidebarNav').classList.add('active'); document.getElementById('sidebarOverlay').classList.add('active'); };
window.closeSidebar = function() { document.getElementById('sidebarNav').classList.remove('active'); document.getElementById('sidebarOverlay').classList.remove('active'); };

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

// ==========================================
// V12.4 DYNAMIC CENTERED NAVIGATION ENGINE
// ==========================================
window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');

    if(hamburger) hamburger.style.display = 'block';

    let sidebarHtml = '<h2>Main Menu</h2>';
    let bottomHtml = '';

    let currentTab = 'profileTab';
    document.querySelectorAll('.tab-content').forEach(el => {
        if (el.classList.contains('active')) currentTab = el.id;
    });

    if(bottomNav) {
        bottomNav.style.display = 'flex';
        bottomNav.style.overflowX = 'hidden';
        bottomNav.style.justifyContent = 'space-evenly';
        bottomNav.style.alignItems = 'center';
        bottomNav.style.flexWrap = 'nowrap';
        bottomNav.style.width = '100%';
        bottomNav.style.gap = '0px';
    }

    const addBottomBtn = (target, icon, text, onclickStr, isSub = false) => {
        let isActive = false;
        if (isSub) {
            const targetEl = document.getElementById(target);
            isActive = (currentTab === 'discipleshipTab') && targetEl && targetEl.classList.contains('active');
        } else {
            isActive = (currentTab === target);
        }
        return `<button class="bottom-nav-btn ${isActive ? 'active' : ''}" style="flex: 1; padding: 14px 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; color: ${isActive ? 'var(--primary)' : 'var(--text-muted)'};" onclick="${onclickStr}">
            <div class="icon" style="font-size: 1.8rem; margin-bottom: 5px;">${icon}</div>
            <span style="white-space:nowrap; font-size: 0.8rem; font-weight: 700;">${text}</span>
        </button>`;
    };

    if (currentTab === 'discipleshipTab') {
        bottomHtml += addBottomBtn('profileTab', '👤', 'Profile', "switchTab('profileTab')");
        bottomHtml += addBottomBtn('growthSubMilestones', '🗺️', 'Milestone', "switchGrowthSubTab('Milestones')", true);
        bottomHtml += addBottomBtn('growthSubJournal', '📓', 'Journal', "switchGrowthSubTab('Journal')", true);
        bottomHtml += addBottomBtn('growthSubPrayer', '🙏', 'Prayer', "switchGrowthSubTab('Prayer')", true);
        bottomHtml += addBottomBtn('growthSubGroups', '👥', 'Groups', "switchGrowthSubTab('Groups')", true);
    } else {
        bottomHtml += addBottomBtn('profileTab', '👤', 'Profile', "switchTab('profileTab')");
        bottomHtml += addBottomBtn('inboxTab', '🔔', 'Inbox', "switchTab('inboxTab')");
        bottomHtml += addBottomBtn('discipleshipTab', '🌱', 'Growth', "switchTab('discipleshipTab'); setTimeout(()=>window.switchGrowthSubTab('Home'),50);");
        bottomHtml += addBottomBtn('growthSubPrayer', '🙏', 'Prayer', "switchTab('discipleshipTab'); setTimeout(()=>window.switchGrowthSubTab('Prayer'),50);", false);
        bottomHtml += addBottomBtn('growthSubGroups', '👥', 'Groups', "switchTab('discipleshipTab'); setTimeout(()=>window.switchGrowthSubTab('Groups'),50);", false);
    }

    if(bottomNav) bottomNav.innerHTML = bottomHtml;

    // --- POPULATE SIDEBAR (ALL ITEMS INCLUDED HERE) ---
    sidebarHtml += `<button class="nav-btn ${currentTab === 'profileTab' ? 'active' : ''}" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'inboxTab' ? 'active' : ''}" data-target="inboxTab" onclick="switchTab('inboxTab')">🔔 My Inbox</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'arcadeTab' ? 'active' : ''}" data-target="arcadeTab" onclick="switchTab('arcadeTab')">🎯 FOG Arcade</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'discipleshipTab' ? 'active' : ''}" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">🌱 Personal Growth</button>`;
    sidebarHtml += `<button id="navBtnLeaderboards" class="nav-btn ${currentTab === 'leaderboardsHubTab' ? 'active' : ''}" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')">🏆 Leaderboards</button>`;

    if (window.hasPerm && window.hasPerm('access_checkin')) sidebarHtml += `<button class="nav-btn ${currentTab === 'checkinTab' ? 'active' : ''}" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
    if (window.hasPerm && window.hasPerm('access_directory')) sidebarHtml += `<button class="nav-btn ${currentTab === 'directoryTab' ? 'active' : ''}" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
    if (window.hasPerm && window.hasPerm('access_ministries')) sidebarHtml += `<button class="nav-btn ${currentTab === 'ministriesTab' ? 'active' : ''}" data-target="ministriesTab" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>`;
    if (window.hasPerm && window.hasPerm('access_events')) sidebarHtml += `<button class="nav-btn ${currentTab === 'eventsTab' ? 'active' : ''}" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
    if (window.hasPerm && window.hasPerm('access_discipleship')) sidebarHtml += `<button class="nav-btn ${currentTab === 'discipleshipAdminTab' ? 'active' : ''}" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')">⚙️ Discipleship Admin</button>`;
    if (window.hasPerm && window.hasPerm('access_worship')) sidebarHtml += `<button class="nav-btn ${currentTab === 'worshipTab' ? 'active' : ''}" data-target="worshipTab" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>`;
    if (window.hasPerm && window.hasPerm('access_communications')) sidebarHtml += `<button class="nav-btn ${currentTab === 'communicationsAdminTab' ? 'active' : ''}" data-target="communicationsAdminTab" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>`;
    if (window.hasPerm && window.hasPerm('access_ai')) sidebarHtml += `<button class="nav-btn ${currentTab === 'aiAssistantTab' ? 'active' : ''}" data-target="aiAssistantTab" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>`;
    if (window.hasPerm && window.hasPerm('access_attendance')) sidebarHtml += `<button class="nav-btn ${currentTab === 'attendanceTab' ? 'active' : ''}" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>`;
    if (window.hasPerm && window.hasPerm('access_activity')) sidebarHtml += `<button class="nav-btn ${currentTab === 'activityLogsTab' ? 'active' : ''}" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">🔍 Audit Logs</button>`;
    if (window.hasPerm && window.hasPerm('access_permissions')) sidebarHtml += `<button class="nav-btn ${currentTab === 'permissionsTab' ? 'active' : ''}" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔐 Permissions</button>`;

    sidebarHtml += `<button class="nav-btn text-danger" onclick="handleLogout()">🚪 Logout</button>`;

    if(sidebar) sidebar.innerHTML = sidebarHtml;
};


window.switchGrowthSubTab = function(tabName) {
    document.querySelectorAll('.growth-sub-tab').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const target = document.getElementById('growthSub' + tabName);
    if(target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    window.buildNav();
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar .nav-btn').forEach(el => el.classList.remove('active'));
    const sidebarTarget = document.querySelector(`.sidebar .nav-btn[data-target="${tabId}"]`);
    if(sidebarTarget) sidebarTarget.classList.add('active');

    window.closeSidebar();

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    if (tabId === 'discipleshipTab') {
        document.querySelectorAll('.growth-sub-tab').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        const homeTab = document.getElementById('growthSubHome');
        if(homeTab) {
            homeTab.classList.add('active');
            homeTab.style.display = 'block';
        }
    }

    window.buildNav();

    if (tabId !== 'checkinTab' && typeof qrScanner !== 'undefined' && qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (tabId === 'checkinTab' && typeof window.switchCheckinMode === 'function') { window.switchCheckinMode('scanner'); window.updateActiveEventBanner(); }
    if (tabId === 'directoryTab' && typeof window.loadDirectory === 'function') window.loadDirectory();
    if (tabId === 'eventsTab' && typeof window.loadEvents === 'function') window.loadEvents();
    if (tabId === 'ministriesTab' && typeof window.loadMinistries === 'function') window.loadMinistries();
    if (tabId === 'attendanceTab' && typeof window.loadAttendanceLogs === 'function') window.loadAttendanceLogs();
    if (tabId === 'activityLogsTab' && typeof window.loadActivityLogs === 'function') window.loadActivityLogs();
    if (tabId === 'permissionsTab' && typeof window.resetPermUserList === 'function') window.resetPermUserList();

    if (tabId === 'profileTab') {
        if (window.V6Gamification && typeof window.V6Gamification.loadMyPoints === 'function') { window.V6Gamification.loadMyPoints(); }
    }

    if (tabId === 'profileTab' && currentUser === 'celsocreeriii@gmail.com') {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'block';
        if (typeof window.loadBackups === 'function') window.loadBackups();
    } else {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'none';
    }
};

window.applyGranularPermissions = function() {
    const canAdd = window.hasPerm('add_entries');
    const b1 = document.getElementById('btnSubEventCreate'); if(b1) b1.style.display = canAdd ? 'inline-block' : 'none';
    const b2 = document.getElementById('btnSubMinistryCreate'); if(b2) b2.style.display = canAdd ? 'inline-block' : 'none';
    const b3 = document.getElementById('btnCheckinWalkin'); if(b3) b3.style.display = canAdd ? 'block' : 'none';
    const b4 = document.getElementById('addEntryAnalyticsBtn'); if(b4) b4.style.display = canAdd ? 'flex' : 'none';
    const b5 = document.getElementById('btnDirectoryAddMember'); if(b5) b5.style.display = canAdd ? 'inline-block' : 'none';
};

window.populateProfileTab = async function(member) {
    currentMember = member; document.getElementById('myMemberId').value = member.id;
    document.getElementById('myProfileName').innerText = member.name || 'Member'; document.getElementById('myProfileCode').innerText = `Unique Pass ID: ${member.qr_code || 'N/A'}`;
    const myBio = document.getElementById('myBioSummary');
    if (myBio) {
        myBio.innerHTML = '<strong>Email:</strong> ' + (member.email || 'N/A') + '<br><strong>Age:</strong> ' + (member.age || 'N/A') + '<br><strong>Birthday:</strong> ' + (member.birthday || 'N/A') + '<br><strong>Social:</strong> ' + (member.social_media || 'N/A') + '<br><strong>Guardian:</strong> ' + (member.parents_name || 'N/A');
    }
    document.getElementById('myEditName').value = member.name || ''; document.getElementById('myEditEmail').value = member.email || ''; document.getElementById('myEditAge').value = member.age || ''; document.getElementById('myEditBirthday').value = member.birthday || ''; document.getElementById('myEditSocial').value = member.social_media || ''; document.getElementById('myEditParents').value = member.parents_name || '';
    if (window.V6Gamification && typeof window.V6Gamification.loadMyPoints === 'function') window.V6Gamification.loadMyPoints();
    const avatar = document.getElementById('myProfileAvatar');
    if (member.profile_picture) avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    else avatar.innerHTML = (member.name || 'U').charAt(0).toUpperCase();
    document.getElementById('myQrContainer').innerHTML = '';
    if(member.qr_code) { QRCode.toDataURL(member.qr_code, { width: 220 }, function (err, url) { if(!err) { const img = document.createElement('img'); img.src = url; document.getElementById('myQrContainer').appendChild(img); const dlBtn = document.getElementById('myDownloadQrBtn'); if(dlBtn) dlBtn.href = url; } }); }
    window.switchMyProfileTab = function(tab) { document.getElementById('myProfileTabRoles').style.display = tab === 'roles' ? 'block' : 'none'; document.getElementById('myProfileTabSchedule').style.display = tab === 'schedule' ? 'block' : 'none'; document.getElementById('myProfileTabAttendance').style.display = tab === 'attendance' ? 'block' : 'none'; document.getElementById('btnMyProfileTabRoles').classList.toggle('active', tab === 'roles'); document.getElementById('btnMyProfileTabSchedule').classList.toggle('active', tab === 'schedule'); document.getElementById('btnMyProfileTabAttendance').classList.toggle('active', tab === 'attendance'); };
    window.loadMySchedule = async function(id) {
        try {
            const [evtRes, blockRes] = await Promise.all([ fetch(`/api/youth/${id}/event_roles`), fetch(`/api/youth/${id}/blockouts`) ]);
            const eventRoles = await evtRes.json(); const blockouts = await blockRes.json();
            const pending = eventRoles.filter(r => r.status === 'Pending'); const pendingContainer = document.getElementById('myPendingInvitesList');
            if (pending.length === 0) pendingContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0;">You have no pending invites at this time.</p>';
            else pendingContainer.innerHTML = pending.map(p => `<div style="background:var(--bg-light); border:1px solid #F59E0B; padding:15px; border-radius:8px; margin-bottom:10px;"><strong style="color:var(--text-main); font-size:1rem;">📅 ${p.event_name}</strong><br><small style="color:var(--text-muted);">${p.event_date}</small><div style="margin: 10px 0;"><span class="badge badge-orange">${p.role_name} ${p.sub_role ? '| '+p.sub_role : ''}</span></div><div style="display:flex; gap:10px;"><button class="btn btn-primary btn-sm" style="flex:1;" onclick="respondToInvite(${p.event_id}, ${p.mapping_id}, 'Accepted')">✅ Accept</button><button class="btn btn-outline btn-sm" style="flex:1; border-color:var(--danger); color:var(--danger);" onclick="respondToInvite(${p.event_id}, ${p.mapping_id}, 'Declined')">❌ Decline</button></div></div>`).join('');
            const blockContainer = document.getElementById('myBlockoutsList');
            if (blockouts.length === 0) blockContainer.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:0;">No blockout dates set.</p>';
            else blockContainer.innerHTML = blockouts.map(b => `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border-color);"><div><strong style="color:var(--danger);">${b.block_date}</strong><br><small style="color:var(--text-muted);">${b.reason}</small></div><button class="btn btn-outline btn-sm" onclick="deleteBlockoutDate(${b.id})">Remove</button></div>`).join('');
        } catch(e) {}
    };
    try {
        const [minRes, evtRes] = await Promise.all([ fetch(`/api/youth/${member.id}/ministries`), fetch(`/api/youth/${member.id}/event_roles`) ]);
        const ministries = await minRes.json(); const eventRoles = await evtRes.json();
        modalRolesData = []; ministries.forEach(m => modalRolesData.push({type: 'ministry', ...m})); eventRoles.forEach(er => modalRolesData.push({type: 'event', ...er}));
        modalRolesData.sort((a,b) => { if (a.type === 'ministry' && b.type === 'event') return -1; if (a.type === 'event' && b.type === 'ministry') return 1; const dateA = new Date(a.assigned_at || a.event_date || 0); const dateB = new Date(b.assigned_at || b.event_date || 0); return dateB - dateA; });
        modalRolesPage = 1; window.renderMyProfileRoles(); window.loadMySchedule(member.id);
    } catch(e) {}
    try {
        const safeFetch = window.fetch.bind(window); const res = await safeFetch(`/api/youth/${member.id}/history`);
        modalAttData = await res.json(); modalAttPage = 1; window.renderMyProfileAttendance();
    } catch(e) {}
    window.switchMyProfileTab('roles');
};

window.respondToInvite = async function(eventId, mappingId, status) { window.triggerActionConfirmation(`Mark invite as ${status}?`, async () => { try { const res = await fetch(`/api/events/${eventId}/roles/${mappingId}/status`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status, actor: currentUser }) }); if (res.ok) window.populateProfileTab(currentMember); } catch(e) { alert("Network error."); } }); };
window.submitBlockoutDate = async function(e) { e.preventDefault(); const date = document.getElementById('newBlockDate').value; const reason = document.getElementById('newBlockReason').value; try { const res = await fetch('/api/blockouts', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id, block_date: date, reason }) }); if (res.ok) { document.getElementById('addBlockoutForm').reset(); window.loadMySchedule(currentMember.id); } else { const data = await res.json(); alert(data.error || 'Failed to add blockout'); } } catch(e) {} };
window.deleteBlockoutDate = async function(id) { window.triggerActionConfirmation('Remove this blockout date?', async () => { try { const res = await fetch(`/api/blockouts/${id}`, { method: 'DELETE' }); if (res.ok) window.loadMySchedule(currentMember.id); } catch(e) {} }); };
window.populateAdminProfile = function(username) { document.getElementById('myProfileName').innerText = username + " (Administrator)"; document.getElementById('myProfileCode').innerText = "LEADER ACCOUNT"; const myBio = document.getElementById('myBioSummary');
    if (myBio) {
        myBio.innerHTML = '<strong>Email:</strong> ' + username + '<br><strong>Role:</strong> Leader / Administrator';
    }
    document.getElementById('myEditName').value = username; document.getElementById('myEditEmail').value = username; document.getElementById('myProfileAvatar').innerHTML = "A"; document.getElementById('myQrContainer').innerHTML = `<span class="badge badge-orange" style="font-size: 1.1rem; padding: 12px 20px;">AUTHORIZED LEADER</span>`; document.getElementById('myMinistriesHistory').innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">Admin System Account. No roles mapped.</p>`; document.getElementById('myAttendanceHistory').innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">Admin System Account. No check-ins mapped.</p>`; const badgeContainer = document.getElementById('myGamificationBadges'); if(badgeContainer) badgeContainer.style.display = 'none'; };
window.handleSelfProfileUpdate = async function(e) { e.preventDefault(); const id = document.getElementById('myMemberId').value; if (!id) return alert('Admin accounts are updated directly in Add Permissions.'); const fileInput = document.getElementById('myEditProfilePic'); let picBase64 = undefined; if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('myEditName').value, email: document.getElementById('myEditEmail').value, age: document.getElementById('myEditAge').value, birthday: document.getElementById('myEditBirthday').value, social_media: document.getElementById('myEditSocial').value, parents_name: document.getElementById('myEditParents').value, password: document.getElementById('myEditPassword').value, profile_picture: picBase64, actor: currentUser }; window.triggerActionConfirmation(`Save changes to your personal profile?`, async () => { const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (data.success) { alert('Profile updated successfully!'); currentMember = data.member; localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember })); window.populateProfileTab(data.member); } }); };

// CHECK-IN CAMERA & TABS INTEGRATION
window.initScanner = function() { if (qrScanner) return; qrScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }); qrScanner.render((decodedText) => { const eventId = document.getElementById('activeEventDropdown').value; if (!eventId) return alert('Please select an active event first!'); fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr_code: decodedText, event_id: eventId, is_walkin: 0, actor: currentUser }) }).then(r => r.json()).then(data => { if (data.success) { alert(`Success! Checked in ${data.member_name}`); window.updateActiveEventBanner(); } else alert(data.error || 'Check-in failed'); }); }, (err) => {}); };

window.switchCheckinMode = function(mode) {
    const btnScan = document.getElementById('btnCheckinScanner');
    const btnMan = document.getElementById('btnCheckinManual');
    const btnWalk = document.getElementById('btnCheckinWalkin');
    if(btnScan) btnScan.classList.toggle('active', mode === 'scanner');
    if(btnMan) btnMan.classList.toggle('active', mode === 'manual');
    if(btnWalk) btnWalk.classList.toggle('active', mode === 'walkin');

    const tabScan = document.getElementById('checkinModeScanner');
    const tabMan = document.getElementById('checkinModeManual');
    const tabWalk = document.getElementById('checkinModeWalkin');
    if(tabScan) tabScan.classList.toggle('active', mode === 'scanner');
    if(tabMan) tabMan.classList.toggle('active', mode === 'manual');
    if(tabWalk) tabWalk.classList.toggle('active', mode === 'walkin');

    if (mode === 'scanner') {
        if (typeof window.initScanner === 'function') window.initScanner();
    } else {
        if (typeof qrScanner !== 'undefined' && qrScanner) {
            qrScanner.clear().catch(e => console.log(e));
            qrScanner = null;
        }
        if (mode === 'manual' && typeof window.filterManualCheckin === 'function') {
            window.filterManualCheckin();
        }
    }
};

window.updateActiveEventBanner = async function() { const dropdown = document.getElementById('activeEventDropdown'); if(!dropdown) return; const eventId = dropdown.value; checkedInYouthIds.clear(); if(eventId) { document.getElementById('checkinCounters').style.display = 'grid'; try { const res = await fetch(`/api/events/${eventId}/analytics`); const data = await res.json(); if(data && data.roster && data.roster.length > 0) { data.roster.forEach(r => checkedInYouthIds.add(r.youth_id)); document.getElementById('liveTotal').innerText = data.totalTurnout || 0; document.getElementById('livePreRegTotal').innerText = data.totalPreRegistered || 0; document.getElementById('livePreReg').innerText = data.preReg || 0; document.getElementById('liveWalkin').innerText = data.walkins || 0; } else { document.getElementById('liveTotal').innerText = '0'; document.getElementById('livePreRegTotal').innerText = (data && data.totalPreRegistered) ? data.totalPreRegistered : '0'; document.getElementById('livePreReg').innerText = '0'; document.getElementById('liveWalkin').innerText = '0'; } } catch(e) {} } else { document.getElementById('checkinCounters').style.display = 'none'; } window.filterManualCheckin(); };
window.filterManualCheckin = async function() { const query = document.getElementById('manualSearchInput').value.toLowerCase().trim(); const container = document.getElementById('manualCheckinResults'); if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); } let matches = youthData; if (query) matches = youthData.filter(y => (y.name || '').toLowerCase().includes(query) || ((y.qr_code || '').toLowerCase().includes(query))); else matches = youthData.slice(0, 20); container.innerHTML = matches.map(y => { const safeName = y.name || 'Unknown'; const avatarHtml = y.profile_picture ? `<img src="${y.profile_picture}" class="avatar-circle" style="cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle">${safeName.charAt(0).toUpperCase()}</div>`; const isCheckedIn = checkedInYouthIds.has(y.id); const btnHtml = isCheckedIn ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="background: #94A3B8; color: #FFF; cursor: not-allowed;">Done</button>` : `<button type="button" class="btn btn-primary btn-sm" onclick="quickCheckin(${y.id}, '${safeName.replace(/'/g, "\\'")}')">Check In</button>`; return `<div class="search-item"><div style="display: flex; gap: 10px; align-items: center;">${avatarHtml}<div><strong>${safeName}</strong><br><small style="color: var(--text-muted);">Age: ${y.age || 'N/A'}</small></div></div><div style="display: flex; gap: 6px;">${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openFastEditProfileModal(${y.id})">Edit</button>` : ''}${btnHtml}</div></div>`; }).join(''); };

window.openFastEditProfileModal = function(id) { const m = youthData.find(y => y.id == id); if (!m) return; document.getElementById('fastEditMemberId').value = m.id; document.getElementById('fastEditName').value = m.name || ''; document.getElementById('fastEditEmail').value = m.email || ''; document.getElementById('fastEditAge').value = m.age || ''; document.getElementById('fastEditBirthday').value = m.birthday || ''; document.getElementById('fastEditSocial').value = m.social_media || ''; document.getElementById('fastEditParents').value = m.parents_name || ''; document.getElementById('fastEditProfilePic').value = ''; document.getElementById('fastEditProfileModal').classList.add('active'); };
window.closeFastEditProfileModal = function() { document.getElementById('fastEditProfileModal').classList.remove('active'); };
window.submitFastEditProfile = async function(doCheckIn) { const form = document.getElementById('fastEditProfileForm'); if(!form.checkValidity()) { form.reportValidity(); return; } const id = document.getElementById('fastEditMemberId').value; const fileInput = document.getElementById('fastEditProfilePic'); let picBase64 = undefined; if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('fastEditName').value, email: document.getElementById('fastEditEmail').value, age: document.getElementById('fastEditAge').value, birthday: document.getElementById('fastEditBirthday').value, social_media: document.getElementById('fastEditSocial').value, parents_name: document.getElementById('fastEditParents').value, profile_picture: picBase64, password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, actor: currentUser }; window.triggerActionConfirmation(`Confirm updating profile?`, async () => { const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); const data = await res.json(); if(data.success) { window.closeFastEditProfileModal(); youthData = []; await window.loadDirectory(); if(doCheckIn) window.quickCheckin(id, payload.name); else { alert("Profile updated successfully!"); window.updateActiveEventBanner(); if(currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id); } } }); };
window.quickCheckin = async function(youthId, memberName) { const eventId = document.getElementById('activeEventDropdown').value; if (!eventId) return alert('Please select an active event first!'); const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: 0, actor: currentUser }) }); const data = await res.json(); if (data.success) { alert(`Successfully checked in ${memberName || 'member'}!`); window.updateActiveEventBanner(); } else alert(data.error || 'Check-in failed'); };
window.handleWalkin = async function(e) { e.preventDefault(); const eventId = document.getElementById('activeEventDropdown').value; if (!eventId) return alert('Please select an active event first!'); const payload = { name: document.getElementById('walkinName').value, age: document.getElementById('walkinAge').value, birthday: document.getElementById('walkinBirthday').value, email: document.getElementById('walkinEmail').value, actor: currentUser || 'Walk-in Registration' }; const regRes = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const regData = await regRes.json(); if (regData.id) { const checkinRes = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: regData.id, event_id: eventId, is_walkin: 1, actor: currentUser }) }); const checkinData = await checkinRes.json(); if (checkinData.success) { alert(`Successfully registered and checked in walk-in: ${payload.name}`); e.target.reset(); youthData = []; window.updateActiveEventBanner(); } else alert(checkinData.error || 'Registration succeeded, but check-in failed.'); } else alert(regData.error || 'Failed to register walk-in.'); };

window.loadDirectory = async function() { 
    try {
        if (youthData.length === 0) { 
            const res = await fetch('/api/youth'); 
            youthData = await res.json(); 
        } 
        window.filterDirectory(); 
    } catch(e) {
        console.error("Failed to load directory data", e);
    }
};

window.filterDirectory = function() { const q = document.getElementById('directorySearchInput').value.toLowerCase().trim(); const sort = document.getElementById('sortDirectorySelect').value; const ageCat = document.getElementById('filterAgeCategory').value; let matches = youthData || []; if (q) { matches = matches.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q))); } let labelText = "Total Registered"; if (ageCat === 'minis') { matches = matches.filter(y => y.age && y.age <= 12); labelText = "Minis"; } else if (ageCat === 'youth') { matches = matches.filter(y => y.age && y.age >= 13 && y.age <= 21); labelText = "Youth"; } else if (ageCat === 'adult') { matches = matches.filter(y => y.age && y.age >= 22); labelText = "Adults"; } const exportBtnHTML = `<button type="button" class="btn btn-outline btn-sm" onclick="exportDirectoryCSV()" style="font-weight: 600; margin-left: 10px;">📤 Export CSV</button>`; const totalCountDiv = document.getElementById('directoryTotalCount'); totalCountDiv.className = ''; totalCountDiv.style.background = 'transparent'; totalCountDiv.style.color = 'var(--text-main)'; totalCountDiv.style.display = 'flex'; totalCountDiv.style.alignItems = 'center'; totalCountDiv.innerHTML = `<span class="badge badge-orange" style="font-size: 0.85rem; padding: 8px 12px;">${labelText}: ${matches.length}</span>${exportBtnHTML}`; if (sort === 'name_asc') matches.sort((a,b) => (a.name || '').localeCompare(b.name || '')); if (sort === 'name_desc') matches.sort((a,b) => (b.name || '').localeCompare(a.name || '')); if (sort === 'age_asc') matches.sort((a,b) => (a.age || 0) - (b.age || 0)); if (sort === 'age_desc') matches.sort((a,b) => (b.age || 0) - (a.age || 0)); filteredDir = matches; window.renderDirectoryList(); };
window.renderDirectoryList = function() { const total = filteredDir.length; let totalPages = 1; let pagedData = filteredDir; if (dirPerPage !== 'all') { totalPages = Math.ceil(total / dirPerPage) || 1; if (currentDirPage > totalPages) currentDirPage = totalPages; if (currentDirPage < 1) currentDirPage = 1; const start = (currentDirPage - 1) * dirPerPage; pagedData = filteredDir.slice(start, start + dirPerPage); } else { currentDirPage = 1; } let html = `<div>`; html += pagedData.map(y => { const safeName = y.name || 'Unknown'; const avatarHtml = y.profile_picture ? `<img src="${y.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem; cursor:pointer; flex-shrink: 0;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem; flex-shrink: 0;">${safeName.charAt(0).toUpperCase()}</div>`; return `<div class="directory-list-item"><div class="directory-list-info">${avatarHtml}<div class="directory-list-text"><strong class="directory-list-name">${safeName}</strong><span class="directory-list-meta">Age: ${y.age || 'N/A'} | BDay: ${y.birthday || 'N/A'}</span></div></div><div class="directory-list-actions"><button type="button" class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openViewProfileModal(${y.id})">View</button>${window.hasPerm('edit_entries') ? `<button type="button" class="icon-action-btn" onclick="openEditMemberModal(${y.id})" title="Edit">✏️</button>` : ''}${window.hasPerm('delete_entries') ? `<button type="button" class="icon-action-btn" style="color: var(--danger);" onclick="triggerDeleteMember(${y.id}, '${safeName.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>` : ''}</div></div>`; }).join(''); html += `</div>`; if (total > 0) { html += `<div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;"><div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;"><label style="margin: 0; font-size: 0.75rem;">Show:</label><select onchange="changeDirPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;"><option value="10" ${dirPerPage === 10 ? 'selected' : ''}>10</option><option value="25" ${dirPerPage === 25 ? 'selected' : ''}>25</option><option value="50" ${dirPerPage === 50 ? 'selected' : ''}>50</option><option value="all" ${dirPerPage === 'all' ? 'selected' : ''}>All</option></select></div><div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;"><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeDirPage(-1)" ${currentDirPage === 1 ? 'disabled' : ''}>◀ Prev</button><span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentDirPage} of ${totalPages}</span><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeDirPage(1)" ${currentDirPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button></div></div>`; } document.getElementById('directoryTableContainer').innerHTML = html; };
window.changeDirPage = function(delta) { currentDirPage += delta; window.renderDirectoryList(); }; window.changeDirPerPage = function(val) { dirPerPage = val === 'all' ? 'all' : parseInt(val); currentDirPage = 1; window.renderDirectoryList(); }; window.exportDirectoryCSV = function() { if(!filteredDir || filteredDir.length === 0) return alert('No directory entries to export based on current filter.'); const rows = [['Member ID', 'Name', 'Email', 'Age', 'Birthday', 'Mobile', 'Parents', 'Unique Pass ID']]; filteredDir.forEach(m => rows.push([m.id, `"${m.name || ''}"`, `"${m.email || ''}"`, m.age || '', `"${m.birthday || ''}"`, `"${m.mobile || ''}"`, `"${m.parents_name || ''}"`, `"${m.qr_code || ''}"`])); window.downloadCSV(rows, 'Community_Directory.csv'); };
window.openAddMemberModal = function() { document.getElementById('addMemberForm').reset(); document.getElementById('addMemberModal').classList.add('active'); }; window.closeAddMemberModal = function() { document.getElementById('addMemberModal').classList.remove('active'); };
window.submitNewMember = async function(e) { e.preventDefault(); const fileInput = document.getElementById('addMemberProfilePic'); let picBase64 = null; if (fileInput && fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('addMemberName').value, age: document.getElementById('addMemberAge').value, birthday: document.getElementById('addMemberBirthday').value, email: document.getElementById('addMemberEmail').value, mobile: document.getElementById('addMemberMobile').value, social_media: document.getElementById('addMemberSocial').value, parents_name: document.getElementById('addMemberParents').value, profile_picture: picBase64, actor: currentUser }; window.triggerActionConfirmation(`Register ${payload.name} into the directory?`, async () => { try { const res = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (data.id) { alert(`Successfully registered ${payload.name}!\nUnique Pass ID: ${data.qr_code}`); window.closeAddMemberModal(); youthData = []; window.loadDirectory(); } else { alert(data.error || 'Failed to create member.'); } } catch (err) { alert("Network error."); } }); };
window.openEditMemberModal = function(youthId) { const m = youthData.find(y => y.id == youthId); if (!m) return; document.getElementById('editMemberId').value = m.id; document.getElementById('editMemberName').value = m.name || ''; document.getElementById('editMemberEmail').value = m.email || ''; document.getElementById('editMemberAge').value = m.age || ''; document.getElementById('editMemberBirthday').value = m.birthday || ''; document.getElementById('editMemberSocial').value = m.social_media || ''; document.getElementById('editMemberParents').value = m.parents_name || ''; document.getElementById('editMemberProfilePic').value = ''; document.getElementById('editMemberModal').classList.add('active'); }; window.closeEditMemberModal = function() { document.getElementById('editMemberModal').classList.remove('active'); };
window.saveMemberEditWithConfirm = async function() { const form = document.getElementById('editMemberModal').querySelector('form'); if(!form.checkValidity()) { form.reportValidity(); return; } const id = document.getElementById('editMemberId').value; const fileInput = document.getElementById('editMemberProfilePic'); let picBase64 = undefined; if (fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('editMemberName').value, email: document.getElementById('editMemberEmail').value, age: document.getElementById('editMemberAge').value, birthday: document.getElementById('editMemberBirthday').value, social_media: document.getElementById('editMemberSocial').value, parents_name: document.getElementById('editMemberParents').value, password: `FOG-MEMBER-${String(id).padStart(3, '0')}`, profile_picture: picBase64, actor: currentUser }; window.triggerActionConfirmation(`Confirm updating member profile for '${payload.name}'?`, async () => { await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); window.closeEditMemberModal(); youthData = []; window.loadDirectory(); }); };
window.openViewProfileModal = async function(youthId) {
    const member = youthData.find(y => y.id == youthId);
    if (!member) return;
    const safeName = member.name || 'Unknown';
    document.getElementById('modalProfileName').innerText = safeName;
    
    // Strict Auth
    const isOwner = currentMember && currentMember.id == youthId;
    const isSuperAdmin = currentUser === 'celsocreeriii@gmail.com';
    const isAuthorized = isOwner || isSuperAdmin; 
    
    const passIdElem = document.getElementById('modalProfileCode');
    const qrSection = document.getElementById('modalQrSectionWrapper');
    const qrContainer = document.getElementById('modalQrContainer');
    const dlBtn = document.getElementById('modalDownloadQrBtn');

    if (isAuthorized) {
        if(passIdElem) {
            passIdElem.innerText = 'Unique Pass ID: ' + (member.qr_code || '');
            passIdElem.style.display = 'inline-block';
        }
        if(qrSection) qrSection.style.display = 'block';
        if(qrContainer) {
            qrContainer.innerHTML = '';
            if(member.qr_code) {
                QRCode.toDataURL(member.qr_code, { width: 180 }, function (err, url) {
                    if(!err) {
                        const img = document.createElement('img'); img.src = url;
                        qrContainer.appendChild(img);
                        if(dlBtn) dlBtn.href = url;
                    }
                });
            }
        }
    } else {
        if(passIdElem) passIdElem.style.display = 'none';
        if(qrSection) qrSection.style.display = 'none';
    }

    
    try {
        const xpRes = await fetch('/api/gamification/points/' + youthId);
        if(xpRes.ok) {
            const xpData = await xpRes.json();
            const total = xpData.points || 0;
            if(document.getElementById('modalProfileXP')) document.getElementById('modalProfileXP').innerText = '⭐ ' + total + ' Overall XP 🖱️';
            if(document.getElementById('modalArcadeXp')) document.getElementById('modalArcadeXp').innerText = xpData.arcade_xp || 0;
            if(document.getElementById('modalGrowthXp')) document.getElementById('modalGrowthXp').innerText = xpData.growth_xp || 0;
            if(document.getElementById('modalEventXp')) document.getElementById('modalEventXp').innerText = xpData.event_xp || 0;
        }
    } catch(e) {}

    document.getElementById('modalBioSummary').innerHTML = '<strong>Email:</strong> ' + (member.email || 'N/A') + '<br><strong>Age:</strong> ' + (member.age || 'N/A') + '<br><strong>Birthday:</strong> ' + (member.birthday || 'N/A') + '<br><strong>Social:</strong> ' + (member.social_media || 'N/A') + '<br><strong>Guardian:</strong> ' + (member.parents_name || 'N/A');
    
    const avatar = document.getElementById('viewModalProfileAvatar');
    if (member.profile_picture) {
        avatar.innerHTML = '<img src="' + member.profile_picture + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">';
    } else {
        avatar.innerHTML = safeName.charAt(0).toUpperCase();
    }

    try {
        const [minRes, evtRes] = await Promise.all([ fetch('/api/youth/' + youthId + '/ministries'), fetch('/api/youth/' + youthId + '/event_roles') ]);
        const ministries = await minRes.json();
        const eventRoles = await evtRes.json();
        modalRolesData = [];
        ministries.forEach(m => modalRolesData.push({type: 'ministry', ...m}));
        eventRoles.forEach(er => modalRolesData.push({type: 'event', ...er}));
        modalRolesData.sort((a,b) => {
            const dateA = new Date(a.assigned_at || a.event_date || 0);
            const dateB = new Date(b.assigned_at || b.event_date || 0);
            return dateB - dateA;
        });
        modalRolesPage = 1;
        window.renderModalRoles();
    } catch(e) {}

    try {
        const safeFetch = window.fetch.bind(window);
        const res = await safeFetch('/api/youth/' + youthId + '/history');
        modalAttData = await res.json();
        modalAttPage = 1;
        window.renderModalAttendance();
    } catch(e) {}

    window.switchProfileModalTab('roles');
    const modal = document.getElementById('viewProfileModal');
    if(modal) modal.classList.add('active');
};
window.closeViewProfileModal = function() { document.getElementById('viewProfileModal').classList.remove('active'); };

window.loadMinistries = async function() { try { const res = await fetch('/api/ministries'); ministriesData = await res.json(); const container = document.getElementById('ministryListContainer'); if (ministriesData.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">No ministries created yet.</p>`; return; } container.innerHTML = ministriesData.map(m => { const logoHtml = m.logo ? `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : `<div style="background: var(--bg-light); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 1.5rem;">🏛️</div>`; return `<div class="ministry-card" onclick="openMinistryDetailsModal(${m.id})"><div style="display: flex; gap: 15px; margin-bottom: 15px;"><div style="width: 50px; height: 50px; flex-shrink: 0; border: 1px solid var(--border-color); border-radius: 8px;">${logoHtml}</div><div><h3 style="color: var(--primary); font-size: 1.2rem; margin-bottom: 2px;">${m.name}</h3><p style="color: var(--text-muted); font-size: 0.85rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${m.description || 'No description provided'}</p></div></div><div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px;"><span class="badge badge-blue">👥 ${m.member_count || 0} Members</span><span style="font-size: 0.8rem; color: var(--primary); font-weight: bold;">View Team →</span></div></div>`; }).join(''); } catch(e) {} };
window.handleCreateMinistry = async function(e) { e.preventDefault(); const fileInput = document.getElementById('minCreateLogo'); let logoBase64 = null; if (fileInput && fileInput.files.length > 0) logoBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('minCreateName').value, description: document.getElementById('minCreateDesc').value, logo: logoBase64, actor: currentUser }; window.triggerActionConfirmation(`Create new ministry '${payload.name}'?`, async () => { try { const res = await fetch('/api/ministries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (res.ok) { document.getElementById('minCreateName').value = ''; document.getElementById('minCreateDesc').value = ''; if(fileInput) fileInput.value = ''; alert('Ministry created successfully!'); window.switchMinistrySubTab('list'); } } catch(err) { alert("Network Error"); } }); };
window.openEditMinistryModal = function() { if (!currentMinistryId) return; const m = ministriesData.find(x => x.id === currentMinistryId); if (!m) return; document.getElementById('editMinName').value = m.name || ''; document.getElementById('editMinDesc').value = m.description || ''; document.getElementById('editMinLogo').value = ''; document.getElementById('editMinistryModal').classList.add('active'); }; window.closeEditMinistryModal = function() { document.getElementById('editMinistryModal').classList.remove('active'); };
window.saveMinistryEdit = async function() { if (!currentMinistryId) return; const fileInput = document.getElementById('editMinLogo'); let logoBase64 = undefined; if (fileInput && fileInput.files.length > 0) logoBase64 = await window.getBase64(fileInput.files[0], 400); const payload = { name: document.getElementById('editMinName').value, description: document.getElementById('editMinDesc').value, restricted_notes: document.getElementById('ministryDetailNotes').value, actor: currentUser }; if (logoBase64 !== undefined) payload.logo = logoBase64; window.triggerActionConfirmation('Save changes to this ministry?', async () => { try { const res = await fetch(`/api/ministries/${currentMinistryId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if(res.ok) { window.closeEditMinistryModal(); alert('Ministry updated successfully!'); await window.loadMinistries(); const m = ministriesData.find(x => x.id === currentMinistryId); document.getElementById('ministryDetailTitle').innerText = m.name; document.getElementById('ministryDetailDesc').innerText = m.description; const logoCont = document.getElementById('ministryDetailLogoContainer'); if (m.logo) { logoCont.innerHTML = `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover;">`; logoCont.style.display = 'block'; } } } catch(err) {} }); };
window.openMinistryDetailsModal = async function(id) { currentMinistryId = id; const m = ministriesData.find(x => x.id === id); if (!m) return; document.getElementById('ministryDetailTitle').innerText = m.name; document.getElementById('ministryDetailDesc').innerText = m.description || ''; const logoCont = document.getElementById('ministryDetailLogoContainer'); if (m.logo) { logoCont.innerHTML = `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`; logoCont.style.display = 'block'; } else { logoCont.style.display = 'none'; } const btnEditMin = document.getElementById('btnEditMinistryConfig'); if (btnEditMin) btnEditMin.style.display = window.hasPerm('edit_entries') ? 'inline-block' : 'none'; const notesSection = document.getElementById('ministryRestrictedSection'); if (window.hasPerm('edit_entries')) { notesSection.style.display = 'block'; document.getElementById('ministryDetailNotes').value = m.restricted_notes || ''; } else { notesSection.style.display = 'none'; } const assignControls = document.getElementById('ministryAssignControls'); assignControls.style.display = window.hasPerm('add_entries') ? 'block' : 'none'; document.getElementById('minSearchInput').value = ''; document.getElementById('minSelectedUserId').value = ''; document.getElementById('minSubRoleInput').value = ''; await window.loadMinistryRoster(id); document.getElementById('ministryDetailsModal').classList.add('active'); }; window.closeMinistryDetailsModal = function() { document.getElementById('ministryDetailsModal').classList.remove('active'); currentMinistryId = null; };
window.saveMinistryNotes = async function() { if (!currentMinistryId) return; const m = ministriesData.find(x => x.id === currentMinistryId); const notes = document.getElementById('ministryDetailNotes').value; const payload = { name: m.name, description: m.description, restricted_notes: notes, actor: currentUser }; window.triggerActionConfirmation('Save restricted notes for this ministry?', async () => { const res = await fetch(`/api/ministries/${currentMinistryId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if (res.ok) { m.restricted_notes = notes; alert('Notes saved successfully!'); } }); };
window.loadMinistryRoster = async function(id) { try { const res = await fetch(`/api/ministries/${id}/members`); const roster = await res.json(); const container = document.getElementById('ministryRosterContainer'); if (roster.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:15px;">No members assigned to this ministry yet.</p>`; return; } const hierarchy = ["Ministry Head", "Assistant Ministry Head", "Youth Ministry Head", "Core Member", "Member", "Integration Period"]; roster.sort((a, b) => { let idxA = hierarchy.indexOf(a.role); let idxB = hierarchy.indexOf(b.role); if (idxA === -1) idxA = 99; if (idxB === -1) idxB = 99; return idxA - idxB; }); container.innerHTML = roster.map(r => { const safeName = r.name || 'Unknown'; const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`; const editBtn = window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 4px 8px; margin-right: 5px;" onclick="openEditMinistryRoleModal(${r.mapping_id}, '${r.role}', '${(r.sub_role||'').replace(/'/g, "\\'")}')">✏️ Edit</button>` : ''; const delBtn = window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="removeMinistryRole(${r.mapping_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>` : ''; const combinedRole = `${r.role}${r.sub_role ? ' | ' + r.sub_role : ''}`; return `<div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; gap: 10px; align-items: center;">${avatarHtml}<div><strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong><span style="font-size:11px; color:var(--primary); background: rgba(255,107,0,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${combinedRole}</span></div></div><div style="text-align: right;">${editBtn}${delBtn}</div></div>`; }).join(''); } catch(e) {} };
window.filterMinistrySearch = async function() { const q = document.getElementById('minSearchInput').value.toLowerCase().trim(); const dropdown = document.getElementById('minSearchDropdown'); if (q.length < 2) { dropdown.style.display = 'none'; return; } if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); } const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q))); if (matches.length > 0) { dropdown.innerHTML = matches.map(y => `<div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="selectMinistryUser(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name || 'Unknown'}</strong></div>`).join(''); dropdown.style.display = 'block'; } else { dropdown.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No matches</div>`; dropdown.style.display = 'block'; } };
window.selectMinistryUser = function(id, name) { document.getElementById('minSelectedUserId').value = id; document.getElementById('minSearchInput').value = name; document.getElementById('minSearchDropdown').style.display = 'none'; };
window.assignMinistryRole = async function() { const youthId = document.getElementById('minSelectedUserId').value; const role = document.getElementById('minRoleSelect').value; const subRole = document.getElementById('minSubRoleInput').value.trim(); if (!youthId || !currentMinistryId) return alert('Please search and select a member first.'); try { const payload = { youth_id: youthId, role: role, sub_role: subRole, actor: currentUser }; const res = await fetch(`/api/ministries/${currentMinistryId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (data.success) { document.getElementById('minSearchInput').value = ''; document.getElementById('minSelectedUserId').value = ''; document.getElementById('minSubRoleInput').value = ''; window.loadMinistryRoster(currentMinistryId); window.loadMinistries(); } else alert(data.error || 'Failed to assign role.'); } catch(e) {} };
window.openEditMinistryRoleModal = function(mappingId, role, subRole) { document.getElementById('editMinRoleMappingId').value = mappingId; document.getElementById('editMinRoleSelect').value = role; document.getElementById('editMinSubRoleInput').value = subRole; document.getElementById('editMinistryRoleModal').classList.add('active'); }; window.closeEditMinistryRoleModal = function() { document.getElementById('editMinistryRoleModal').classList.remove('active'); };
window.saveMinistryRoleEdit = async function() { const mappingId = document.getElementById('editMinRoleMappingId').value; const payload = { role: document.getElementById('editMinRoleSelect').value, sub_role: document.getElementById('editMinSubRoleInput').value, actor: currentUser }; try { const res = await fetch(`/api/ministries/${currentMinistryId}/members/${mappingId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }); if(res.ok) { window.closeEditMinistryRoleModal(); window.loadMinistryRoster(currentMinistryId); window.loadMinistries(); } } catch(e) {} };
window.removeMinistryRole = function(mappingId, name) { window.triggerActionConfirmation(`Remove ${name} from this ministry?`, async () => { try { const res = await fetch(`/api/ministries/${currentMinistryId}/members/${mappingId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); if (res.ok) { window.loadMinistryRoster(currentMinistryId); window.loadMinistries(); } } catch(err) {} }); };
window.openPreregSettings = function(eventId) {
    console.log("Triggered openPreregSettings for event:", eventId);
    const e = eventsData.find(ev => ev.id == eventId);
    if (!e) return alert('Event data not found!');
    
    const idElem = document.getElementById('preregSetEventId');
    if(idElem) idElem.value = e.id;
    
    const titleElem = document.getElementById('preregSetTitle');
    if(titleElem) titleElem.value = e.prereg_title || e.name || '';
    
    const infoElem = document.getElementById('preregSetInfo');
    if(infoElem) infoElem.value = e.prereg_info || '';
    
    const banElem = document.getElementById('preregSetBanner');
    if(banElem) banElem.value = '';
    
    const botElem = document.getElementById('preregSetBottomBanner');
    if(botElem) botElem.value = '';
    
    const modal = document.getElementById('preregSettingsModal');
    if(modal) {
        modal.classList.add('active');
    } else {
        alert('Settings Modal missing from DOM!');
    }
};
window.closePreregSettingsModal = function() { document.getElementById('preregSettingsModal').classList.remove('active'); };
window.savePreregSettings = async function(e) { e.preventDefault(); const id = document.getElementById('preregSetEventId').value; const title = document.getElementById('preregSetTitle').value; const info = document.getElementById('preregSetInfo').value; const fileInput = document.getElementById('preregSetBanner'); const fileInputBottom = document.getElementById('preregSetBottomBanner'); let bannerBase64 = null; if (fileInput.files.length > 0) bannerBase64 = await window.getBase64(fileInput.files[0], 1200); let bottomBannerBase64 = null; if (fileInputBottom.files.length > 0) bottomBannerBase64 = await window.getBase64(fileInputBottom.files[0], 1200); window.triggerActionConfirmation('Save Pre-Registration Page Settings?', async () => { const res = await fetch(`/api/events/${id}/prereg-settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banner: bannerBase64, bottom_banner: bottomBannerBase64, title, info, actor: currentUser }) }); if(res.ok) { alert('Settings saved successfully!'); window.closePreregSettingsModal(); window.loadEvents(); } }); };
window.openPublicPreregFromSettings = async function() { const id = document.getElementById('preregSetEventId').value; window.closePreregSettingsModal(); window.launchPublicPrereg(id); };
window.launchPublicPrereg = async function(eventId) { currentPreregEventId = eventId; document.getElementById('mainContainer').style.display = 'block'; const urlParams = new URLSearchParams(window.location.search); if (urlParams.get('event') !== String(eventId)) window.history.pushState(null, '', '?event=' + eventId); try { const prRes = await fetch(`/api/events/${eventId}/preregs`); const prData = await prRes.json(); currentPreRegYouthIds = new Set(prData); } catch(e) { currentPreRegYouthIds = new Set(); } if(eventsData.length === 0) { const res = await fetch('/api/events'); eventsData = await res.json(); } const e = eventsData.find(ev => ev.id == eventId); if (e) { document.getElementById('preregPublicTitle').innerText = e.prereg_title || e.name; document.getElementById('preregPublicInfo').innerText = e.prereg_info || `Date: ${e.event_date} | Venue: ${e.venue || 'TBA'}`; const banner = document.getElementById('preregPublicBanner'); if (e.prereg_banner) { banner.src = e.prereg_banner; banner.style.display = 'block'; } else if (e.poster) { banner.src = e.poster; banner.style.display = 'block'; } else { banner.style.display = 'none'; } const bottomBanner = document.getElementById('preregPublicBottomBanner'); if (e.prereg_bottom_banner) { bottomBanner.src = e.prereg_bottom_banner; bottomBanner.style.display = 'block'; } else { bottomBanner.style.display = 'none'; } } if(youthData.length === 0) { const yRes = await fetch('/api/youth'); youthData = await yRes.json(); } window.switchTab('preregPublicTab'); window.showPreregStep(1); };
window.closePublicPrereg = function() { currentPreregEventId = null; document.getElementById('mainHeader').style.display = 'block'; window.history.pushState(null, '', window.location.pathname); window.location.reload(); };
window.showPreregStep = function(step) { document.getElementById('preregStep1').style.display = step === 1 ? 'block' : 'none'; document.getElementById('preregStep2').style.display = step === 2 ? 'block' : 'none'; document.getElementById('preregStep3').style.display = step === 3 ? 'block' : 'none'; document.getElementById('preregStepSuccess').style.display = step === 4 ? 'block' : 'none'; if(step === 2) { document.getElementById('preregSearchInput').value = ''; document.getElementById('preregSearchResults').innerHTML = ''; document.getElementById('preregSearchResults').style.display = 'none'; } if(step === 3) { document.getElementById('preregNewName').value = ''; document.getElementById('preregNewAge').value = ''; document.getElementById('preregNewEmail').value = ''; document.getElementById('preregNewMobile').value = ''; } };
window.filterPreregSearch = function() { const q = document.getElementById('preregSearchInput').value.toLowerCase().trim(); const container = document.getElementById('preregSearchResults'); if (q.length < 2) { container.style.display = 'none'; return; } let matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q)); if (matches.length > 0) { container.innerHTML = matches.map(y => { const isRegistered = currentPreRegYouthIds.has(y.id); const btnHtml = isRegistered ? `<button type="button" class="btn btn-secondary btn-sm" disabled style="border: none; font-size: 0.75rem;">Already registered</button>` : `<button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem;" onclick="executePreregister(${y.id}, '${y.qr_code}')">Register</button>`; return `<div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 10px;"><div style="flex: 1; word-break: break-word; color: var(--text-main); font-weight:600;">${y.name || 'Unknown'}</div><div>${btnHtml}</div></div>`}).join(''); container.style.display = 'block'; } else { container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No matches found.</div>`; container.style.display = 'block'; } };
window.executePreregister = async function(youthId, qrCode) { if(!currentPreregEventId) return; try { const res = await fetch('/api/preregister', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_id: currentPreregEventId, youth_id: youthId }) }); if(res.ok) { currentPreRegYouthIds.add(youthId); document.getElementById('preregSuccessQrContainer').innerHTML = ''; if(qrCode) { QRCode.toDataURL(qrCode, { width: 200 }, function (err, url) { if (!err) { const img = document.createElement('img'); img.src = url; document.getElementById('preregSuccessQrContainer').appendChild(img); document.getElementById('preregSuccessQrDownload').href = url; } }); } window.showPreregStep(4); } } catch(e) {} };
window.submitNewPrereg = async function(e) { e.preventDefault(); if(!currentPreregEventId) return; const payload = { name: document.getElementById('preregNewName').value, age: document.getElementById('preregNewAge').value, mobile: document.getElementById('preregNewMobile').value, email: document.getElementById('preregNewEmail').value, actor: 'Public Pre-Registration' }; try { const regRes = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const regData = await regRes.json(); if (regData.id) window.executePreregister(regData.id, regData.qr_code); } catch(err) {} };
window.dataURItoFile = function(dataURI, fileName) { const arr = dataURI.split(','); const mime = arr[0].match(/:(.*?);/)[1]; const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n); while(n--) { u8arr[n] = bstr.charCodeAt(n); } return new File([u8arr], fileName, { type: mime }); };
window.sharePreRegLink = async function() { const shareTitle = document.getElementById('preregPublicTitle').innerText || 'Community Event'; const shareText = `Join me at ${shareTitle}, click the link to pre-register.`; const shareUrl = window.location.href; const shareData = { title: shareTitle, text: shareText, url: shareUrl }; let targetBase64Image = null; if (currentPreregEventId && eventsData && eventsData.length > 0) { const e = eventsData.find(ev => ev.id == currentPreregEventId); if (e && e.poster && e.poster.startsWith('data:image')) targetBase64Image = e.poster; } if (!targetBase64Image) { const bannerImg = document.getElementById('preregPublicBanner'); if (bannerImg && bannerImg.src && bannerImg.src.startsWith('data:image')) targetBase64Image = bannerImg.src; } if (targetBase64Image) { try { const posterFile = window.dataURItoFile(targetBase64Image, 'event-poster.jpg'); if (navigator.canShare && navigator.canShare({ files: [posterFile] })) shareData.files = [posterFile]; } catch (err) {} } if (navigator.share) { try { await navigator.share(shareData); } catch (error) {} } else { navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => alert(`Link copied to clipboard!\n\n${shareText}`)); } };
window.openEditEventModal = function(eventId) { try { const e = eventsData.find(ev => ev.id == eventId); if (!e) return; const elId = document.getElementById('editEvtId'); if(elId) elId.value = e.id; const elName = document.getElementById('editEvtName'); if(elName) elName.value = e.name || ''; const elDate = document.getElementById('editEvtDate'); if(elDate) elDate.value = e.event_date || ''; const elTime = document.getElementById('editEvtTime'); if(elTime) elTime.value = e.time_start || ''; const elVen = document.getElementById('editEvtVenue'); if(elVen) elVen.value = e.venue || ''; const elPts = document.getElementById('editEvtPoints'); if(elPts) elPts.value = e.event_points !== undefined ? e.event_points : 10; const elPh = document.getElementById('editEvtPhotosUrl'); if(elPh) elPh.value = e.photos_url || ''; const elMat = document.getElementById('editEvtMaterialsUrl'); if(elMat) elMat.value = e.materials_url || ''; const elPos = document.getElementById('editEvtPoster'); if(elPos) elPos.value = ''; window.closeAnalyticsModal(); const modal = document.getElementById('editEventModal'); if (modal) modal.classList.add('active'); } catch (err) {} }; window.closeEditEventModal = function() { const modal = document.getElementById('editEventModal'); if (modal) modal.classList.remove('active'); };
window.submitEditEvent = async function() { const form = document.getElementById('editEventForm'); if(!form.checkValidity()) { form.reportValidity(); return; } const id = document.getElementById('editEvtId').value; const fileInput = document.getElementById('editEvtPoster'); window.triggerActionConfirmation(`Confirm saving changes to event?`, async () => { let posterBase64 = null; if (fileInput && fileInput.files.length > 0) posterBase64 = await window.getBase64(fileInput.files[0], 1200); const payload = { name: document.getElementById('editEvtName').value, event_date: document.getElementById('editEvtDate').value, time_start: document.getElementById('editEvtTime').value, venue: document.getElementById('editEvtVenue').value, event_points: parseInt(document.getElementById('editEvtPoints').value) || 10, poster: posterBase64, photos_url: document.getElementById('editEvtPhotosUrl').value, materials_url: document.getElementById('editEvtMaterialsUrl').value, actor: currentUser }; try { const res = await fetch(`/api/events/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }); if(res.ok) { window.closeEditEventModal(); window.loadEvents(); } } catch(e) {} }); };
window.setEventViewMode = function(mode) { eventViewMode = mode; const btnList = document.getElementById('viewBtnList'); if (btnList) btnList.classList.toggle('active', mode === 'list'); const btnGrid = document.getElementById('viewBtnGrid'); if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid'); const btnCal = document.getElementById('viewBtnCal'); if (btnCal) btnCal.classList.toggle('active', mode === 'calendar'); const calControls = document.getElementById('calendarControls'); if (calControls) calControls.style.display = mode === 'calendar' ? 'flex' : 'none'; const container = document.getElementById('eventsListContainer'); if (!container) return; if (eventsData.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No events published yet.</p>'; return; } if (eventViewMode === 'list') { container.className = 'events-list-view'; container.innerHTML = eventsData.map(e => { const safeName = e.name || 'Event'; let linkBadges = ''; if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`; if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`; return `<div style="border-bottom: 1px solid var(--border-color); padding: 15px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;"><div><strong style="cursor: pointer; color: var(--primary); font-size: 1.1rem;" onclick="openAnalyticsModal(${e.id})">${safeName}</strong><br><small style="color: var(--text-muted); font-size: 0.85rem;">${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''} | ${e.venue || 'No Location'} | 🎫 +${e.event_points || 10} XP</small>${linkBadges ? `<div style="margin-top: 8px;">${linkBadges}</div>` : ''}</div><div style="display: flex; gap: 6px;"><button type="button" class="btn btn-primary btn-sm" onclick="openAnalyticsModal(${e.id})">Details</button>${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>` : ''}${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>` : ''}${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${safeName.replace(/'/g, "\\'")}')">Del</button>` : ''}</div></div>`}).join(''); } else if (eventViewMode === 'grid') { container.className = 'events-grid-view'; container.innerHTML = eventsData.map(e => { const safeName = e.name || 'Event'; let linkBadges = ''; if (e.photos_url) linkBadges += `<a href="${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>`; if (e.materials_url) linkBadges += `<a href="${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>`; return `<div class="event-card">${e.poster ? `<img src="${e.poster}" class="event-card-img" style="cursor:pointer;" onclick="openAnalyticsModal(${e.id})" alt="Poster">` : `<div class="event-card-img" style="background: var(--bg-light); border-bottom: 1px solid var(--border-color); cursor:pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem;" onclick="openAnalyticsModal(${e.id})">Blank Thumbnail</div>`}<div style="padding: 15px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;"><div><h3 style="font-size: 1.1rem; margin-bottom: 6px; color: var(--text-main); cursor: pointer;" onclick="openAnalyticsModal(${e.id})">${safeName}</h3><p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">📅 ${e.event_date} ${e.time_start ? '@ ' + e.time_start : ''}<br>📍 ${e.venue || 'No Location'}<br>🎫 +${e.event_points || 10} XP</p>${linkBadges ? `<div style="margin-bottom: 12px;">${linkBadges}</div>` : ''}</div><div style="display: flex; gap: 6px; margin-top: 10px;"><button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="openAnalyticsModal(${e.id})">Details</button>${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openPreregSettings(${e.id})">Form</button>` : ''}${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(${e.id})">Edit</button>` : ''}${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(${e.id}, '${safeName.replace(/'/g, "\\'")}')">Del</button>` : ''}</div></div></div>`}).join(''); } else if (eventViewMode === 'calendar') window.renderCalendarView(container); };
window.loadEvents = async function() { 
    try { 
        const res = await fetch('/api/events'); 
        eventsData = await res.json(); 
        const dropdown = document.getElementById('activeEventDropdown'); 
        if (dropdown) { 
            dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join(''); 
            if (eventsData.length > 0) window.updateActiveEventBanner(); 
            else { const counters = document.getElementById('checkinCounters'); if (counters) counters.style.display = 'none'; } 
        } 
        window.setEventViewMode(eventViewMode); 
    } catch(e) {
        console.error("Failed to load events data", e);
    } 
};
window.handleCreateEvent = function(e) { e.preventDefault(); const fileInput = document.getElementById('evtPoster'); window.triggerActionConfirmation(`Publish new event?`, async () => { let posterBase64 = null; if (fileInput.files.length > 0) posterBase64 = await window.getBase64(fileInput.files[0], 1200); const payload = { name: document.getElementById('evtName').value, event_date: document.getElementById('evtDate').value, time_start: document.getElementById('evtTime').value, venue: document.getElementById('evtVenue').value, event_points: parseInt(document.getElementById('evtPoints').value) || 10, poster: posterBase64, photos_url: document.getElementById('evtPhotosUrl').value, materials_url: document.getElementById('evtMaterialsUrl').value, actor: currentUser }; try { const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (res.ok) { document.getElementById('createEventForm').reset(); window.switchEventSubTab('list'); } } catch(e) {} }); };
window.renderCalendarView = function(container) { const year = calCurrentDate.getFullYear(); const month = calCurrentDate.getMonth(); const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]; document.getElementById('calendarMonthTitle').innerText = `${monthNames[month]} ${year}`; const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); let html = `<div class="calendar-grid">`; const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; days.forEach(d => html += `<div class="calendar-day-header">${d}</div>`); for (let i = 0; i < firstDay; i++) html += `<div class="calendar-day-cell other-month"></div>`; for (let day = 1; day <= daysInMonth; day++) { const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const dayEvents = eventsData.filter(e => e.event_date === dateStr); html += `<div class="calendar-day-cell"><strong style="color:var(--text-main);">${day}</strong>`; dayEvents.forEach(e => html += `<div class="calendar-event-tag" onclick="openAnalyticsModal(${e.id})" title="View Analytics for ${(e.name || '').replace(/"/g, '&quot;')}">${e.name || 'Event'}</div>`); html += `</div>`; } html += `</div>`; container.className = ''; container.innerHTML = html; };
window.changeCalendarMonth = function(delta) { calCurrentDate.setMonth(calCurrentDate.getMonth() + delta); window.loadEvents(); };
window.loadAttendanceLogs = async function() { const res = await fetch('/api/attendance/logs'); cachedAttendanceLogs = await res.json(); window.filterAttendanceLogs(); };
window.filterAttendanceLogs = function() { const q = document.getElementById('attendanceSearchInput').value.toLowerCase().trim(); let matches = cachedAttendanceLogs; if(q) matches = matches.filter(l => (l.member_name || '').toLowerCase().includes(q) || (l.event_name || '').toLowerCase().includes(q)); filteredAtt = matches; window.renderAttendanceTable(); };
window.renderAttendanceTable = function() { const total = filteredAtt.length; let totalPages = 1; let pagedData = filteredAtt; if (attPerPage !== 'all') { totalPages = Math.ceil(total / attPerPage) || 1; if (currentAttPage > totalPages) currentAttPage = totalPages; if (currentAttPage < 1) currentAttPage = 1; const start = (currentAttPage - 1) * attPerPage; pagedData = filteredAtt.slice(start, start + attPerPage); } else { currentAttPage = 1; } let html = `<table class="responsive-table"><thead><tr><th>Member</th><th class="hide-mobile">Event</th><th class="hide-mobile">Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>`; html += pagedData.map(l => `<tr><td><div style="display: flex; gap: 12px; align-items: center;"><div style="background: rgba(16,185,129,0.1); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">✅</div><div><strong style="color:var(--text-main); font-size:1.05rem;">${l.member_name || 'Unknown'}</strong><div class="mobile-meta">${l.event_name || ''} | ${l.checked_in_at || ''}</div></div></div></td><td class="hide-mobile" style="color:var(--text-muted);">${l.event_name || ''}</td><td class="hide-mobile" style="color:var(--text-muted);">${l.checked_in_at || ''}</td><td><span class="badge ${l.is_walkin ? 'badge-orange' : 'badge-green'}">${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span></td><td class="actions-cell">${window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" onclick="openEditAttendanceModal(${l.id}, '${l.checked_in_at}', ${l.is_walkin})">Edit</button>` : ''}${window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteAttendance(${l.id}, '${(l.member_name || '').replace(/'/g, "\\'")}')">Del</button>` : ''}</td></tr>`).join(''); html += `</tbody></table>`; if (total > 0) { html += `<div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;"><div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;"><label style="margin: 0; font-size: 0.75rem;">Show:</label><select onchange="changeAttPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;"><option value="10" ${attPerPage === 10 ? 'selected' : ''}>10</option><option value="25" ${attPerPage === 25 ? 'selected' : ''}>25</option><option value="50" ${attPerPage === 50 ? 'selected' : ''}>50</option><option value="all" ${attPerPage === 'all' ? 'selected' : ''}>All</option></select></div><div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;"><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeAttPage(-1)" ${currentAttPage === 1 ? 'disabled' : ''}>◀ Prev</button><span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentAttPage} of ${totalPages}</span><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeAttPage(1)" ${currentAttPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button></div></div>`; } document.getElementById('attendanceLogsContainer').innerHTML = html; };
window.changeAttPage = function(delta) { currentAttPage += delta; window.renderAttendanceTable(); }; window.changeAttPerPage = function(val) { attPerPage = val === 'all' ? 'all' : parseInt(val); currentAttPage = 1; window.renderAttendanceTable(); };
window.exportAttendanceLogsCSV = function() { if(!cachedAttendanceLogs || cachedAttendanceLogs.length === 0) return alert('No attendance logs to export.'); const rows = [['Log ID', 'Member Name', 'Event', 'Checked In At', 'Status']]; cachedAttendanceLogs.forEach(l => rows.push([l.id, `"${l.member_name || ''}"`, `"${l.event_name || ''}"`, `"${l.checked_in_at || ''}"`, `"${l.is_walkin ? 'Walk-in' : 'Pre-Reg'}"`])); window.downloadCSV(rows, 'All_Attendance_Logs.csv'); };
window.loadActivityLogs = async function() { const res = await fetch('/api/activity-logs'); cachedActivityLogs = await res.json(); window.filterActivityLogs(); };
window.filterActivityLogs = function() { const q = document.getElementById('activitySearchInput').value.toLowerCase().trim(); let matches = cachedActivityLogs; if(q) matches = matches.filter(l => (l.username || '').toLowerCase().includes(q) || (l.action || '').toLowerCase().includes(q) || (l.details || '').toLowerCase().includes(q)); filteredAct = matches; window.renderActivityTable(); };
window.renderActivityTable = function() { const total = filteredAct.length; let totalPages = 1; let pagedData = filteredAct; if (actPerPage !== 'all') { totalPages = Math.ceil(total / actPerPage) || 1; if (currentActPage > totalPages) currentActPage = totalPages; if (currentActPage < 1) currentActPage = 1; const start = (currentActPage - 1) * actPerPage; pagedData = filteredAct.slice(start, start + actPerPage); } else { currentActPage = 1; } let html = `<table class="responsive-table"><thead><tr><th>User</th><th class="hide-mobile">Action</th><th>Details</th><th class="hide-mobile">Timestamp</th></tr></thead><tbody>`; html += pagedData.map(l => `<tr><td><div style="display: flex; gap: 12px; align-items: center;"><div style="background: rgba(59,130,246,0.1); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📝</div><div><strong style="color:var(--text-main); font-size:1.05rem;">${l.username || 'System'}</strong><div class="mobile-meta"><span class="badge badge-orange">${l.action || ''}</span> | ${l.created_at || ''}</div></div></div></td><td class="hide-mobile"><span class="badge badge-orange">${l.action || ''}</span></td><td style="color:var(--text-main);">${l.details || ''}</td><td class="hide-mobile" style="color:var(--text-muted);"><small>${l.created_at || ''}</small></td></tr>`).join(''); html += `</tbody></table>`; if (total > 0) { html += `<div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;"><div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;"><label style="margin: 0; font-size: 0.75rem;">Show:</label><select onchange="changeActPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;"><option value="10" ${actPerPage === 10 ? 'selected' : ''}>10</option><option value="25" ${actPerPage === 25 ? 'selected' : ''}>25</option><option value="50" ${actPerPage === 50 ? 'selected' : ''}>50</option><option value="all" ${actPerPage === 'all' ? 'selected' : ''}>All</option></select></div><div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;"><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeActPage(-1)" ${currentActPage === 1 ? 'disabled' : ''}>◀ Prev</button><span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentActPage} of ${totalPages}</span><button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeActPage(1)" ${currentActPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button></div></div>`; } document.getElementById('activityLogsContainer').innerHTML = html; };
window.changeActPage = function(delta) { currentActPage += delta; window.renderActivityTable(); }; window.changeActPerPage = function(val) { actPerPage = val === 'all' ? 'all' : parseInt(val); currentActPage = 1; window.renderActivityTable(); };
window.exportActivityLogsCSV = function() { if(!cachedActivityLogs || cachedActivityLogs.length === 0) return alert('No activity logs to export.'); const rows = [['Log ID', 'Timestamp', 'User', 'Action', 'Details']]; cachedActivityLogs.forEach(l => rows.push([l.id, `"${l.created_at || ''}"`, `"${l.username || ''}"`, `"${l.action || ''}"`, `"${l.details || ''}"`])); window.downloadCSV(rows, 'All_Activity_Logs.csv'); };

window.openEditAttendanceModal = function(id, time, isWalkin) { document.getElementById('editAttId').value = id; document.getElementById('editAttTime').value = time; document.getElementById('editAttWalkin').value = isWalkin ? "1" : "0"; document.getElementById('editAttendanceModal').classList.add('active'); }; window.closeEditAttendanceModal = function() { document.getElementById('editAttendanceModal').classList.remove('active'); };
window.saveAttendanceEditWithConfirm = function() { const id = document.getElementById('editAttId').value; const checked_in_at = document.getElementById('editAttTime').value; const is_walkin = parseInt(document.getElementById('editAttWalkin').value); window.triggerActionConfirmation(`Update Attendance Log ID #${id}?`, async () => { await fetch(`/api/attendance/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checked_in_at, is_walkin, actor: currentUser }) }); window.closeEditAttendanceModal(); window.loadAttendanceLogs(); if (currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id); }); };
window.triggerDeleteMember = function(id, name) { window.triggerActionConfirmation(`Permanently DELETE member profile for '${name}'?`, async () => { await fetch(`/api/youth/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); youthData = []; window.loadDirectory(); window.filterManualCheckin(); }); };
window.triggerDeleteEvent = function(id, name) { window.triggerActionConfirmation(`Permanently DELETE event '${name}' and associated logs?`, async () => { await fetch(`/api/events/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); window.loadEvents(); }); };
window.triggerDeleteAttendance = function(id, memberName) { window.triggerActionConfirmation(`DELETE attendance record for '${memberName}'?`, async () => { await fetch(`/api/attendance/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); window.loadAttendanceLogs(); window.updateActiveEventBanner(); if (currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id); }); };

window.openAnalyticsModal = async function(eventId) { try { const res = await fetch(`/api/events/${eventId}/analytics`); if (!res.ok) throw new Error("Server returned " + res.status); const data = await res.json(); if (!data || data.error) return alert(data?.error || 'Failed to load event analytics'); currentAnalyticsData = data; const posterContainer = document.getElementById('analyticsModalPoster'); if (posterContainer) { if (data.event.poster) posterContainer.innerHTML = `<img src="${data.event.poster}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`; else posterContainer.innerHTML = `<span style="font-size: 0.75rem; color: #aaa; text-align: center; font-weight: 600;">No<br>Poster</span>`; } if(document.getElementById('analyticsEventTitle')) document.getElementById('analyticsEventTitle').innerText = data.event.name || 'Event'; if(document.getElementById('analyticsEventMeta')) document.getElementById('analyticsEventMeta').innerText = `📅 Date: ${data.event.event_date || ''} | 📍 Venue: ${data.event.venue || 'N/A'} | 🎫 +${data.event.event_points || 10} XP`; let linksHtml = ''; if(data.event.photos_url) linksHtml += `<a href="${data.event.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration: none;">📷 Photos</a>`; if(data.event.materials_url) linksHtml += `<a href="${data.event.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration: none;">📁 Materials</a>`; if(document.getElementById('analyticsEventLinks')) document.getElementById('analyticsEventLinks').innerHTML = linksHtml; if(document.getElementById('statTotalTurnout')) document.getElementById('statTotalTurnout').innerText = data.totalTurnout || 0; if(document.getElementById('statTotalPreReg')) document.getElementById('statTotalPreReg').innerText = data.totalPreRegistered || 0; if(document.getElementById('statWalkins')) document.getElementById('statWalkins').innerText = data.walkins || 0; if(document.getElementById('statTurnoutPercent')) document.getElementById('statTurnoutPercent').innerText = `${data.turnoutPercentage || '0.0'}%`; const editBtn = document.getElementById('analyticsEditEventBtn'); if(editBtn) { editBtn.onclick = () => window.openEditEventModal(eventId); editBtn.style.display = window.hasPerm('edit_entries') ? 'block' : 'none'; } if(document.getElementById('attSearchNative')) document.getElementById('attSearchNative').value = ''; if(document.getElementById('attAgeNative')) document.getElementById('attAgeNative').value = 'all'; currentRosterFilter = 'all'; if(document.getElementById('cardTurnout')) document.getElementById('cardTurnout').style.opacity = '1'; if(document.getElementById('cardPreReg')) document.getElementById('cardPreReg').style.opacity = '0.5'; if(document.getElementById('cardWalkin')) document.getElementById('cardWalkin').style.opacity = '0.5'; window.switchAnalyticsSubTab('overview'); const eventRoleAssignControls = document.getElementById('eventRoleAssignControls'); if(eventRoleAssignControls) eventRoleAssignControls.style.display = window.hasPerm('add_entries') ? 'block' : 'none'; document.getElementById('evtRoleSearchInput').value = ''; document.getElementById('evtRoleNameInput').value = ''; document.getElementById('evtRoleSubRoleInput').value = ''; document.getElementById('evtRoleSelectedUserId').value = ''; const eventRolesNotesSection = document.getElementById('eventRolesRestrictedSection'); if (eventRolesNotesSection) { if (window.hasPerm('edit_entries')) { eventRolesNotesSection.style.display = 'block'; document.getElementById('eventRolesDetailNotes').value = data.event.roles_restricted_notes || ''; } else { eventRolesNotesSection.style.display = 'none'; } } window.filterAnalyticsRoster(); window.loadEventRoles(eventId); const modal = document.getElementById('eventAnalyticsModal'); if(modal) modal.classList.add('active'); } catch (error) {} };
window.closeAnalyticsModal = function() { if(document.getElementById('eventAnalyticsModal')) document.getElementById('eventAnalyticsModal').classList.remove('active'); currentAnalyticsData = null; };
window.saveEventRolesNotes = async function() { if (!currentAnalyticsData || !currentAnalyticsData.event) return; const eventId = currentAnalyticsData.event.id; const notes = document.getElementById('eventRolesDetailNotes').value; window.triggerActionConfirmation('Save restricted roles & logistics notes for this event?', async () => { try { const res = await fetch(`/api/events/${eventId}/roles-notes`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ roles_restricted_notes: notes, actor: currentUser }) }); if (res.ok) { currentAnalyticsData.event.roles_restricted_notes = notes; alert('Event notes saved successfully!'); window.loadEvents(); } } catch(e) {} }); };
window.setAnalyticsCardFilter = function(type) { currentRosterFilter = type; if(document.getElementById('cardTurnout')) document.getElementById('cardTurnout').style.opacity = type === 'all' ? '1' : '0.5'; if(document.getElementById('cardPreReg')) document.getElementById('cardPreReg').style.opacity = type === 'prereg' ? '1' : '0.5'; if(document.getElementById('cardWalkin')) document.getElementById('cardWalkin').style.opacity = type === 'walkin' ? '1' : '0.5'; window.filterAnalyticsRoster(); };
window.filterAnalyticsRoster = function() { const qInput = document.getElementById('attSearchNative'); const ageFilterInput = document.getElementById('attAgeNative'); if(!qInput || !ageFilterInput || !currentAnalyticsData) return; const q = qInput.value.toLowerCase(); const ageFilter = ageFilterInput.value; let sourceList = []; if (currentRosterFilter === 'prereg') sourceList = currentAnalyticsData.preRegList || []; else if (currentRosterFilter === 'walkin') sourceList = (currentAnalyticsData.roster || []).filter(r => r.is_walkin === 1); else sourceList = currentAnalyticsData.roster || []; const filtered = sourceList.filter(r => { const nameMatch = (r.name || '').toLowerCase().includes(q) || ((r.qr_code || '').toLowerCase().includes(q)); let ageMatch = true; const age = parseInt(r.age); if (ageFilter !== 'all' && !isNaN(age)) { if (ageFilter === 'mini' && age > 12) ageMatch = false; if (ageFilter === 'youth' && (age < 13 || age > 21)) ageMatch = false; if (ageFilter === 'adult' && age < 22) ageMatch = false; } else if (ageFilter !== 'all' && isNaN(age)) ageMatch = false; return nameMatch && ageMatch; }); if(document.getElementById('attRosterCount')) document.getElementById('attRosterCount').innerText = `Total: ${filtered.length}`; window.renderAnalyticsRoster(filtered); };
window.renderAnalyticsRoster = function(list) { const rosterContainer = document.getElementById('analyticsRosterContainer'); if (!rosterContainer) return; if (list.length === 0) { rosterContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); margin:15px 0; font-size: 0.9rem;">No attendees found.</p>`; return; } rosterContainer.innerHTML = list.map(r => { const safeName = r.name || 'Unknown'; const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`; let statusBadge = '', actionButtons = '', timeText = ''; if (currentRosterFilter === 'prereg') { const arrived = (currentAnalyticsData.roster || []).find(a => a.youth_id === r.youth_id); if (arrived) { statusBadge = `<span style="font-size:11px; color:var(--success); background: rgba(16,185,129,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Arrived</span>`; timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(arrived.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`; } else { statusBadge = `<span style="font-size:11px; color:#F59E0B; background: rgba(245,158,11,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">Expected</span>`; timeText = `<span style="color: #F59E0B; font-size: 0.8rem; font-weight: 600;">Not Arrived</span>`; if (window.hasPerm('delete_entries')) { actionButtons = `<div style="display: flex; gap: 5px; margin-top: 6px; justify-content: flex-end;"><button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="triggerDeletePreReg(${currentAnalyticsData.event.id}, ${r.youth_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button></div>`; } } } else { statusBadge = `<span style="font-size:11px; color:var(--text-muted); background: var(--bg-light); border: 1px solid var(--border-color); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${r.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span>`; timeText = `<span style="color: var(--success); font-size: 0.8rem; font-weight: 600;">${new Date(r.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`; if (window.hasPerm('delete_entries')) { actionButtons = `<div style="display: flex; gap: 5px; margin-top: 6px; justify-content: flex-end;"><button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="triggerDeleteAttendance(${r.log_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button></div>`; } } return `<div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; gap: 10px; align-items: center;">${avatarHtml}<div><strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong>${statusBadge}<br><small style="color: var(--text-muted);">${r.age ? 'Age: '+r.age : ''}</small></div></div><div style="text-align: right;">${timeText}${actionButtons}</div></div>`; }).join(''); };

window.loadEventRoles = async function(eventId) { try { const res = await fetch(`/api/events/${eventId}/roles`); const roles = await res.json(); const container = document.getElementById('eventRolesContainer'); if (roles.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:15px;">No specific roles assigned for this event.</p>`; return; } container.innerHTML = roles.map(r => { const safeName = r.name || 'Unknown'; const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`; const editBtn = window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 4px 8px; margin-right: 5px;" onclick="openEditEventRoleModal(${r.mapping_id}, '${(r.role_name||'').replace(/'/g, "\\'")}', '${(r.sub_role||'').replace(/'/g, "\\'")}')">✏️ Edit</button>` : ''; const delBtn = window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="removeEventRole(${r.mapping_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>` : ''; const combinedRole = `${r.role_name}${r.sub_role ? ' | ' + r.sub_role : ''}`; let statusBadge = ''; if(r.status === 'Accepted') statusBadge = ` <span style="font-size:10px; font-weight:bold; color:var(--success); margin-left:5px;">✅ Accepted</span>`; else if(r.status === 'Declined') statusBadge = ` <span style="font-size:10px; font-weight:bold; color:var(--danger); margin-left:5px;">❌ Declined</span>`; else statusBadge = ` <span style="font-size:10px; font-weight:bold; color:#F59E0B; margin-left:5px;">⏳ Pending</span>`; return `<div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;"><div style="display: flex; gap: 10px; align-items: center;">${avatarHtml}<div><strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong><span style="font-size:11px; color:#8B5CF6; background: rgba(139,92,246,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${combinedRole}</span>${statusBadge}</div></div><div style="text-align: right;">${editBtn}${delBtn}</div></div>`; }).join(''); } catch(e) {} };
window.filterEventRoleSearch = async function() { const q = document.getElementById('evtRoleSearchInput').value.toLowerCase().trim(); const dropdown = document.getElementById('evtRoleSearchDropdown'); if (q.length < 2) { dropdown.style.display = 'none'; return; } if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); } const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q))); if (matches.length > 0) { dropdown.innerHTML = matches.map(y => `<div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="selectEventRoleUser(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name || 'Unknown'}</strong></div>`).join(''); dropdown.style.display = 'block'; } else { dropdown.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No matches</div>`; dropdown.style.display = 'block'; } };
window.selectEventRoleUser = function(id, name) { document.getElementById('evtRoleSelectedUserId').value = id; document.getElementById('evtRoleSearchInput').value = name; document.getElementById('evtRoleSearchDropdown').style.display = 'none'; };
window.assignEventRole = async function() { const youthId = document.getElementById('evtRoleSelectedUserId').value; const roleName = document.getElementById('evtRoleNameInput').value.trim(); const subRole = document.getElementById('evtRoleSubRoleInput').value.trim(); if (!youthId || !currentAnalyticsData || !currentAnalyticsData.event) return alert('Please search and select a member.'); if (!roleName) return alert('Please enter a primary role name (e.g., Coordinator, Food).'); const eventId = currentAnalyticsData.event.id; try { const payload = { youth_id: youthId, role_name: roleName, sub_role: subRole, actor: currentUser }; const res = await fetch(`/api/events/${eventId}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (data.success) { document.getElementById('evtRoleSearchInput').value = ''; document.getElementById('evtRoleSelectedUserId').value = ''; document.getElementById('evtRoleNameInput').value = ''; document.getElementById('evtRoleSubRoleInput').value = ''; window.loadEventRoles(eventId); } else alert(data.error || 'Failed to assign role.'); } catch(e) {} };
window.openEditEventRoleModal = function(mappingId, roleName, subRole) { document.getElementById('editEvtRoleMappingId').value = mappingId; document.getElementById('editEvtRoleNameInput').value = roleName; document.getElementById('editEvtSubRoleInput').value = subRole; document.getElementById('editEventRoleModal').classList.add('active'); }; window.closeEditEventRoleModal = function() { document.getElementById('editEventRoleModal').classList.remove('active'); };
window.saveEventRoleEdit = async function() { const mappingId = document.getElementById('editEvtRoleMappingId').value; const eventId = currentAnalyticsData.event.id; const payload = { role_name: document.getElementById('editEvtRoleNameInput').value, sub_role: document.getElementById('editEvtSubRoleInput').value, actor: currentUser }; try { const res = await fetch(`/api/events/${eventId}/roles/${mappingId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }); if(res.ok) { window.closeEditEventRoleModal(); window.loadEventRoles(eventId); } } catch(e) {} };
window.removeEventRole = function(mappingId, name) { window.triggerActionConfirmation(`Remove ${name}'s role from this event?`, async () => { try { const eventId = currentAnalyticsData.event.id; const res = await fetch(`/api/events/${eventId}/roles/${mappingId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); if (res.ok) window.loadEventRoles(eventId); } catch(err) {} }); };
window.openAddAttendeeModal = function() { if(!currentAnalyticsData) return; if(document.getElementById('addAttendeeSearch')) document.getElementById('addAttendeeSearch').value = ''; if(document.getElementById('addAttendeeResults')) document.getElementById('addAttendeeResults').innerHTML = ''; const modal = document.getElementById('addAttendeeModal'); if(modal) modal.classList.add('active'); if(youthData.length === 0) window.loadDirectory(); }; window.closeAddAttendeeModal = function() { if(document.getElementById('addAttendeeModal')) document.getElementById('addAttendeeModal').classList.remove('active'); };
window.filterAddAttendeeSearch = function() { const searchInput = document.getElementById('addAttendeeSearch'); const container = document.getElementById('addAttendeeResults'); if (!searchInput || !container) return; const q = searchInput.value.toLowerCase().trim(); if (q.length < 2) { container.innerHTML = ''; return; } const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q)); const existingIds = currentAnalyticsData.roster.map(r => r.youth_id); container.innerHTML = matches.map(y => { const safeName = y.name || 'Unknown'; const isExisting = existingIds.includes(y.id); const buttons = isExisting ? `<span style="font-size: 0.8rem; color: var(--success); font-weight: bold;">Already In List</span>` : `<button type="button" class="btn btn-primary btn-sm" onclick="submitAddAttendee(${y.id}, 0, '${safeName.replace(/'/g, "\\'")}')">Add Pre-Reg</button><button type="button" class="btn btn-outline btn-sm" onclick="submitAddAttendee(${y.id}, 1, '${safeName.replace(/'/g, "\\'")}')">Add Walk-in</button>`; return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);"><div><strong style="color:var(--text-main);">${safeName}</strong></div><div style="display: flex; gap: 5px;">${buttons}</div></div>`; }).join(''); };
window.submitAddAttendee = async function(youthId, isWalkin, name) { const eventId = currentAnalyticsData.event.id; try { const res = await fetch('/api/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, event_id: eventId, is_walkin: isWalkin, actor: currentUser }) }); const data = await res.json(); if (data.success) { alert(`Added ${name} to the event!`); window.closeAddAttendeeModal(); window.openAnalyticsModal(eventId); } else alert(data.error || 'Failed to add attendee.'); } catch(e) {} };
window.triggerDeletePreReg = function(eventId, youthId, memberName) { window.triggerActionConfirmation(`Remove pre-registration for '${memberName}'?`, async () => { try { const res = await fetch(`/api/events/${eventId}/preregs/${youthId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) }); const data = await res.json(); if (data.success) { if (currentAnalyticsData) window.openAnalyticsModal(eventId); } } catch(e) {} }); };
window.exportAnalyticsCSV = function() { if (!currentAnalyticsData) return; let sourceList = []; let isExpectedView = (currentRosterFilter === 'prereg'); if (isExpectedView) sourceList = currentAnalyticsData.preRegList || []; else if (currentRosterFilter === 'walkin') sourceList = (currentAnalyticsData.roster || []).filter(r => r.is_walkin === 1); else sourceList = currentAnalyticsData.roster || []; const rows = [['Member Name', 'Unique Pass ID / Email', 'Status / Timestamp']]; sourceList.forEach(r => { const identifier = r.email ? r.email : r.qr_code; let status = ''; if (isExpectedView) { const arrived = (currentAnalyticsData.roster || []).find(a => a.youth_id === r.youth_id); status = arrived ? `Arrived at ${arrived.checked_in_at}` : 'Expected (Not Arrived)'; } else { status = r.is_walkin ? `Walk-in (${r.checked_in_at})` : `Pre-Reg (${r.checked_in_at})`; } rows.push([`"${r.name || 'Unknown'}"`, `"${identifier}"`, `"${status}"`]); }); window.downloadCSV(rows, `Roster_${(currentAnalyticsData.event.name || 'Event').replace(/\s+/g, '_')}.csv`); };

window.filterPermUserList = async function() { const qElem = document.getElementById('permUserSearchInput'); const container = document.getElementById('permUserListContainer'); if(!qElem || !container) return; const q = qElem.value.toLowerCase().trim(); if (q.length < 3) { container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">Please type at least 3 characters to search the directory and assign permissions.</div>`; return; } if (!youthData || youthData.length === 0) { try { const res = await fetch('/api/youth'); youthData = await res.json(); } catch (e) { return; } } const matches = (youthData || []).filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q))); if (matches.length === 0) { container.innerHTML = `<div style="padding: 15px; color: var(--text-muted); text-align: center;">No accounts found matching '${q}'</div>`; return; } container.innerHTML = matches.map(u => `<div class="search-item"><div><strong style="color:var(--text-main); font-size:1.05rem;">${u.name || 'Unknown'}</strong></div><button type="button" class="btn btn-primary btn-sm" onclick="openAssignPermissionModal(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}')">Select</button></div>`).join(''); };
window.loadUserPermissionsList = async function() { if (!youthData || youthData.length === 0) { try { const res = await fetch('/api/youth'); youthData = await res.json(); } catch (e) {} } window.filterPermUserList(); };
window.openAssignPermissionModal = async function(id, displayName) { try { const res = await fetch('/api/users/list'); const dbUsers = await res.json(); const targetUser = dbUsers.find(u => u.youth_id === id); let perms = []; if (targetUser && targetUser.permissions) { try { perms = JSON.parse(targetUser.permissions); } catch(e) { perms = []; } } const idElem = document.getElementById('modalPermUserId'); if(idElem) idElem.value = id; const bannerElem = document.getElementById('permModalUserBanner'); if(bannerElem) bannerElem.innerText = `Assign Permissions for: ${displayName}`; document.querySelectorAll('.permCheckModal').forEach(chk => { chk.checked = perms.includes(chk.value); }); const modal = document.getElementById('assignPermissionModal'); if(modal) modal.classList.add('active'); } catch(e) {} };
window.closeAssignPermissionModal = function() { const modal = document.getElementById('assignPermissionModal'); if(modal) modal.classList.remove('active'); };
window.handleSavePermissionsFromModal = function() { const idElem = document.getElementById('modalPermUserId'); if(!idElem) return; const userId = idElem.value; const selectedPerms = []; document.querySelectorAll('.permCheckModal:checked').forEach(chk => { selectedPerms.push(chk.value); }); window.triggerActionConfirmation(`Confirm updating permission set?`, async () => { try { const res = await fetch(`/api/youth/${userId}/permissions`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permissions: selectedPerms, actor: currentUser }) }); if(!res.ok) throw new Error("HTTP error " + res.status); const data = await res.json(); if (data.success) { alert('Permissions updated successfully!'); window.closeAssignPermissionModal(); window.resetPermUserList(); youthData = []; await window.loadDirectory(); } } catch(e) {} }); };

document.addEventListener('DOMContentLoaded', () => { setInterval(() => { const dropdown = document.querySelector('select[name="event_id"]') || document.querySelector('#checkinEventSelect'); if (dropdown && !dropdown.dataset.leewayApplied) { dropdown.dataset.leewayApplied = "true"; const targetDate = new Date(); targetDate.setHours(targetDate.getHours() - 5); const cutoffStr = targetDate.toISOString().split('T')[0]; Array.from(dropdown.options).forEach(opt => { const match = opt.innerText.match(/(\d{4}-\d{2}-\d{2})/); if (match && match[1] < cutoffStr) opt.remove(); }); } }, 1000); });

// --- PROFILE RENDER LOGIC ---
document.addEventListener('click', (e) => {
    if (e.target.closest('#overallXpBadgeToggle')) {
        const tooltip = document.getElementById('xpTooltip');
        if (tooltip) {
            tooltip.style.display = tooltip.style.display === 'none' ? 'flex' : 'none';
        }
    }
});

window.renderModalRoles = function() {
    const container = document.getElementById('myMinistriesHistory');
    if(!container) return;
    if(typeof modalRolesData === 'undefined' || modalRolesData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No ministry or event roles assigned yet.</p>';
        return;
    }
    let html = '';
    modalRolesData.forEach(r => {
        let badge = r.type === 'ministry' ? '<span class="badge badge-blue">🏛️ Ministry</span>' : '<span class="badge badge-orange">📅 Event</span>';
        let title = r.type === 'ministry' ? r.ministry_name : r.event_name;
        let roleStr = r.role || r.role_name;
        let subStr = r.sub_role ? ' | ' + r.sub_role : '';
        let dateStr = r.type === 'event' && r.event_date ? ' <small style="color:var(--text-muted);">(' + r.event_date + ')</small>' : '';
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); background: #FFF; border-radius: 8px; margin-bottom: 8px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
                '<strong style="color: var(--primary); font-size: 1.05rem;">' + (title || 'Unknown') + dateStr + '</strong>' +
                badge +
            '</div>' +
            '<div style="color:var(--text-main); font-size:0.95rem;"><strong>Role:</strong> ' + roleStr + subStr + '</div>' +
        '</div>';
    });
    container.innerHTML = html;
};

window.renderModalAttendance = function() {
    const container = document.getElementById('myAttendanceHistory');
    if(!container) return;
    if(typeof modalAttData === 'undefined' || modalAttData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No attendance logs found.</p>';
        return;
    }
    let html = '';
    modalAttData.forEach(a => {
        let status = a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>';
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;">' +
            '<div>' +
                '<strong style="color: var(--primary); font-size: 1.05rem;">' + (a.event_name || 'Event') + '</strong><br>' +
                '<small style="color:var(--text-muted);">' + (a.checked_in_at || '') + '</small>' +
            '</div>' +
            status +
        '</div>';
    });
    container.innerHTML = html;
};


window.switchEventSubTab = function(tab) {
    document.getElementById('subTabEventList').classList.toggle('active', tab === 'list');
    document.getElementById('subTabEventCreate').classList.toggle('active', tab === 'create');
    document.getElementById('btnSubEventList').classList.toggle('active', tab === 'list');
    document.getElementById('btnSubEventCreate').classList.toggle('active', tab === 'create');
    if (tab === 'list') window.loadEvents();
};

window.switchMinistrySubTab = function(tab) {
    document.getElementById('subTabMinistryList').classList.toggle('active', tab === 'list');
    document.getElementById('subTabMinistryCreate').classList.toggle('active', tab === 'create');
    document.getElementById('btnSubMinistryList').classList.toggle('active', tab === 'list');
    document.getElementById('btnSubMinistryCreate').classList.toggle('active', tab === 'create');
    if (tab === 'list') window.loadMinistries();
};

window.switchAnalyticsSubTab = function(tab) {
    const o = document.getElementById('analyticsTabOverview'); if(o) o.style.display = (tab === 'overview') ? 'block' : 'none';
    const r = document.getElementById('analyticsTabRoles'); if(r) r.style.display = (tab === 'roles') ? 'block' : 'none';
    const bo = document.getElementById('btnAnalyticsTabOverview'); if(bo) bo.classList.toggle('active', tab === 'overview');
    const br = document.getElementById('btnAnalyticsTabRoles'); if(br) br.classList.toggle('active', tab === 'roles');
};

window.switchProfileModalTab = function(tab) {
    const mtr = document.getElementById('modalTabRoles'); if(mtr) mtr.style.display = (tab === 'roles') ? 'block' : 'none';
    const mta = document.getElementById('modalTabAttendance'); if(mta) mta.style.display = (tab === 'attendance') ? 'block' : 'none';
    const bmr = document.getElementById('btnModalTabRoles'); if(bmr) bmr.classList.toggle('active', tab === 'roles');
    const bma = document.getElementById('btnModalTabAttendance'); if(bma) bma.classList.toggle('active', tab === 'attendance');
};

// Safe Modal State Poller (Zero Infinite Loop Risk)
setInterval(() => {
    const hasActiveModal = document.querySelector('.modal.active') !== null;
    const bodyHasClass = document.body.classList.contains('modal-open');
    
    if (hasActiveModal && !bodyHasClass) {
        document.body.classList.add('modal-open');
    } else if (!hasActiveModal && bodyHasClass) {
        document.body.classList.remove('modal-open');
    }
}, 250);

// FOG Arcade Hardened Routing
document.addEventListener('click', (e) => {
    if (e.target.closest('#btnArcadeGames')) {
        const gList = document.getElementById('arcadeGamesList');
        const lView = document.getElementById('arcadeLeaderboardView');
        const aGame = document.getElementById('arcadeActiveGameArea');
        if (gList) gList.style.display = 'block';
        if (lView) lView.style.display = 'none';
        if (aGame) aGame.style.display = 'none';
    } else if (e.target.closest('#btnArcadeLeaderboard')) {
        const gList = document.getElementById('arcadeGamesList');
        const lView = document.getElementById('arcadeLeaderboardView');
        const aGame = document.getElementById('arcadeActiveGameArea');
        if (gList) gList.style.display = 'none';
        if (lView) lView.style.display = 'block';
        if (aGame) aGame.style.display = 'none';
    }
});

// --- V8 OVERRIDE: FIX MODAL TAB RENDERING ---
window.renderModalRoles = function() {
    const container = document.getElementById('modalMinistriesHistory'); // Corrected ID
    if(!container) return;
    if(typeof modalRolesData === 'undefined' || modalRolesData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No ministry or event roles assigned yet.</p>';
        return;
    }
    let html = '';
    modalRolesData.forEach(r => {
        let badge = r.type === 'ministry' ? '<span class="badge badge-blue">🏛️ Ministry</span>' : '<span class="badge badge-orange">📅 Event</span>';
        let title = r.type === 'ministry' ? r.ministry_name : r.event_name;
        let roleStr = r.role || r.role_name;
        let subStr = r.sub_role ? ' | ' + r.sub_role : '';
        let dateStr = r.type === 'event' && r.event_date ? ' <small style="color:var(--text-muted);">(' + r.event_date + ')</small>' : '';
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); background: #FFF; border-radius: 8px; margin-bottom: 8px;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
                '<strong style="color: var(--primary); font-size: 1.05rem;">' + (title || 'Unknown') + dateStr + '</strong>' +
                badge +
            '</div>' +
            '<div style="color:var(--text-main); font-size:0.95rem;"><strong>Role:</strong> ' + roleStr + subStr + '</div>' +
        '</div>';
    });
    container.innerHTML = html;
};

window.renderModalAttendance = function() {
    const container = document.getElementById('modalAttendanceHistory'); // Corrected ID
    if(!container) return;
    if(typeof modalAttData === 'undefined' || modalAttData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No participation logs found.</p>';
        return;
    }
    let html = '';
    modalAttData.forEach(a => {
        let status = a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>';
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;">' +
            '<div>' +
                '<strong style="color: var(--primary); font-size: 1.05rem;">' + (a.event_name || 'Event') + '</strong><br>' +
                '<small style="color:var(--text-muted);">' + (a.checked_in_at || '') + '</small>' +
            '</div>' +
            status +
        '</div>';
    });
    container.innerHTML = html;
};

// --- V9: MY PROFILE RENDERERS ---
window.renderMyProfileRoles = function() { 
    const container = document.getElementById('myMinistriesHistory'); 
    if(!container) return; 
    if(typeof modalRolesData === 'undefined' || modalRolesData.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No ministry or event roles assigned yet.</p>'; return; } 
    let html = ''; 
    modalRolesData.forEach(r => { 
        let badge = r.type === 'ministry' ? '<span class="badge badge-blue">🏛️ Ministry</span>' : '<span class="badge badge-orange">📅 Event</span>'; 
        let title = r.type === 'ministry' ? r.ministry_name : r.event_name; 
        let roleStr = r.role || r.role_name; let subStr = r.sub_role ? ' | ' + r.sub_role : ''; 
        let dateStr = r.type === 'event' && r.event_date ? ' <small style="color:var(--text-muted);">(' + r.event_date + ')</small>' : ''; 
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); background: #FFF; border-radius: 8px; margin-bottom: 8px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong style="color: var(--primary); font-size: 1.05rem;">' + (title || 'Unknown') + dateStr + '</strong>' + badge + '</div><div style="color:var(--text-main); font-size:0.95rem;"><strong>Role:</strong> ' + roleStr + subStr + '</div></div>'; 
    }); container.innerHTML = html; 
}; 
window.renderMyProfileAttendance = function() { 
    const container = document.getElementById('myAttendanceHistory'); 
    if(!container) return; 
    if(typeof modalAttData === 'undefined' || modalAttData.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:20px;">No participation logs found.</p>'; return; } 
    let html = ''; 
    modalAttData.forEach(a => { 
        let status = a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>'; 
        html += '<div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;"><div><strong style="color: var(--primary); font-size: 1.05rem;">' + (a.event_name || 'Event') + '</strong><br><small style="color:var(--text-muted);">' + (a.checked_in_at || '') + '</small></div>' + status + '</div>'; 
    }); container.innerHTML = html; 
};

// Tooltip Click Listener for View Profile Modal
document.addEventListener('click', (e) => {
    if (e.target.closest('#modalProfileXP')) {
        const tooltip = document.getElementById('modalXpTooltip');
        if (tooltip) tooltip.style.display = tooltip.style.display === 'none' ? 'flex' : 'none';
    } else if (!e.target.closest('#modalXpTooltip') && !e.target.closest('#modalProfileXP')) {
        const tooltip = document.getElementById('modalXpTooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
});

// --- V13 CAMPFIRE CHAT ENGINE ---
let activeGroupPoller = null;
let currentChatGroupId = null;
let lastChatMsgId = 0;

window.openGroupSpace = function(groupId, groupName) {
    currentChatGroupId = groupId;
    lastChatMsgId = 0;
    document.getElementById('groupSpaceTitle').innerText = '🔥 ' + groupName;
    document.getElementById('groupChatMessages').innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">Fetching messages...</p>';
    document.getElementById('groupSpaceModal').classList.add('active');
    
    fetchAndRenderGroupChat(true); // Fetch initial load
    
    // Start Smart Delta Poller (Every 3.5 seconds)
    activeGroupPoller = setInterval(() => fetchAndRenderGroupChat(false), 3500);
};

window.closeGroupSpace = function() {
    document.getElementById('groupSpaceModal').classList.remove('active');
    clearInterval(activeGroupPoller);
    activeGroupPoller = null;
    currentChatGroupId = null;
};

window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                let reactHtml = '';
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    ['❤️','🙏','👍','😂'].forEach(emoji => {
                        if(r[emoji]) reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px; display:inline-block; margin-top:4px;">${emoji} ${r[emoji]}</span>`;
                    });
                } catch(e) {}

                const reactPickerHtml = `
                <div style="margin-top:4px;">
                    <button style="background:#FFF0E6; border:1px solid rgba(255,107,0,0.2); border-radius:12px; padding:2px 8px; cursor:pointer; font-size:0.75rem; color:var(--primary);" onclick="window.toggleReactMenu(${m.id})">😀 React</button>
                    <div id="react-menu-${m.id}" style="display:none; background:#FFF; border:1px solid var(--border-color); border-radius:16px; padding:6px 12px; margin-top:4px; box-shadow:0 2px 8px rgba(0,0,0,0.1); gap:12px; align-items:center; flex-wrap:wrap;">
                        <button style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:2px;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                        <button style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:2px;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                        <button style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:2px;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                        <button style="background:none;border:none;font-size:1.3rem;cursor:pointer;padding:2px;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                    </div>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
                        <div style="max-width: 80%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-top:2px;">
                                <div style="display:flex; align-items:center; gap:6px;">${reactHtml} <span style="font-size:0.65rem; color:var(--text-muted);">${timeStr}</span></div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:10px;">
                        ${avatar}
                        <div style="max-width: 80%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-start; margin-top:2px; margin-left:4px;">
                                <div style="display:flex; align-items:center; gap:6px;"><span style="font-size:0.65rem; color:var(--text-muted);">${timeStr}</span> ${reactHtml}</div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        } else if (isInitialLoad && messages.length === 0) {
            document.getElementById('groupChatMessages').innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">It is quiet here... start the conversation! 🔥</p>';
        }
    } catch(e) {}
};

window.sendGroupMessage = async function(e) {
    e.preventDefault();
    const input = document.getElementById('groupChatInput');
    const msg = input.value.trim();
    if (!msg || !currentChatGroupId || !currentMember) return;
    
    input.value = ''; // Clear input instantly for snappy feel
    
    try {
        await fetch(`/api/small-groups/${currentChatGroupId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youth_id: currentMember.id, message: msg })
        });
        // The Poller will automatically fetch and display this in the next ~3 seconds
        fetchAndRenderGroupChat(false); // Force an instant fetch to show it immediately
    } catch (e) {
        alert('You appear to be offline. Message queued!');
    }
};

// --- V14 GOOGLE MEET VIDEO VAULT ENGINE ---
window.openGroupVault = function(groupId, groupName) {
    document.getElementById('vaultGroupId').value = groupId;
    document.getElementById('groupVaultTitle').innerText = '🎥 ' + groupName + ' Vault';
    document.getElementById('groupVaultModal').classList.add('active');
    
    // Only users with 'edit_entries' permission can schedule new meets
    document.getElementById('vaultLeaderControls').style.display = window.hasPerm('edit_entries') ? 'block' : 'none';
    
    window.loadGroupVault(groupId);
};

window.closeGroupVault = function() {
    document.getElementById('groupVaultModal').classList.remove('active');
};

window.loadGroupVault = async function(groupId) {
    try {
        const res = await fetch(`/api/small-groups/${groupId}/sessions`);
        const sessions = await res.json();
        const container = document.getElementById('vaultListContainer');
        const now = new Date();
        
        if(sessions.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No sessions scheduled yet.</p>';
            return;
        }

        container.innerHTML = sessions.map(s => {
            const sched = new Date(s.scheduled_at);
            const isFuture = sched > now;
            let actionHtml = '';
            
            if (isFuture) {
                // Future Event: Show Join Meet Button
                actionHtml = `<a href="${s.meet_link}" target="_blank" class="btn btn-primary btn-sm" style="width: 100%; background: #2563EB; font-weight:bold;">🌐 Join Google Meet</a>`;
            } else {
                // Past Event: Show Recording or Leader Upload Input
                if (s.recording_url) {
                    // We parse G-Drive links automatically to make them watchable
                    const watchUrl = window.V3Worship ? window.V3Worship.formatMediaUrl(s.recording_url) : s.recording_url;
                    actionHtml = `<a href="${watchUrl}" target="_blank" class="btn btn-outline btn-sm" style="width: 100%; color: #059669; border-color: #059669; background: #D1FAE5; font-weight:bold;">▶️ Watch Recording</a>`;
                } else if (window.hasPerm('edit_entries')) {
                    actionHtml = `
                    <div style="display:flex; gap: 5px; margin-top: 5px;">
                        <input type="url" id="rec_link_${s.id}" class="form-control" placeholder="Paste G-Drive Video Link..." style="padding: 6px; min-height: 35px; font-size: 0.8rem; flex: 1;">
                        <button class="btn btn-primary btn-sm" style="background:#059669;" onclick="saveRecordingUrl(${s.id}, ${groupId})">Save</button>
                    </div>`;
                } else {
                    actionHtml = `<span style="font-size: 0.8rem; color: var(--text-muted); display:block; text-align:center; padding: 5px; background: var(--bg-light); border-radius: 6px;">Processing Recording...</span>`;
                }
            }
            
            const delBtn = window.hasPerm('delete_entries') ? `<button style="background:none; border:none; color:var(--danger); font-size:1.2rem; cursor:pointer;" onclick="deleteGroupSession(${s.id}, ${groupId})">&times;</button>` : '';

            const dateStr = sched.toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});

            return `
            <div style="background: #FFF; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items:flex-start; margin-bottom: 5px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${s.title}</strong>
                    ${delBtn}
                </div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 12px;">📅 ${dateStr}</div>
                ${actionHtml}
            </div>
            `;
        }).join('');
    } catch(e) { console.error(e); }
};

window.scheduleGroupSession = async function(e) {
    e.preventDefault();
    const groupId = document.getElementById('vaultGroupId').value;
    const payload = {
        title: document.getElementById('vaultSessionTitle').value,
        scheduled_at: document.getElementById('vaultSessionDate').value,
        meet_link: document.getElementById('vaultSessionMeet').value
    };
    try {
        const res = await fetch(`/api/small-groups/${groupId}/sessions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (res.ok) {
            e.target.reset();
            window.loadGroupVault(groupId);
        }
    } catch(err) {}
};

window.saveRecordingUrl = async function(sessionId, groupId) {
    const url = document.getElementById('rec_link_' + sessionId).value;
    if (!url) return;
    try {
        const res = await fetch(`/api/small-groups/sessions/${sessionId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ recording_url: url }) });
        if (res.ok) window.loadGroupVault(groupId);
    } catch(err) {}
};

window.deleteGroupSession = async function(sessionId, groupId) {
    window.triggerActionConfirmation('Delete this session permanently?', async () => {
        try {
            const res = await fetch(`/api/small-groups/sessions/${sessionId}`, { method: 'DELETE' });
            if (res.ok) window.loadGroupVault(groupId);
        } catch(err) {}
    });
};

// --- V15 CONNECT GROUP DASHBOARD ---
let currentDashboardGroupId = null;
let currentDashboardGroupName = '';

window.openGroupDashboard = async function(groupId, groupName, groupLogo, leaderName, leaderId) {
    currentDashboardGroupId = groupId;
    currentDashboardGroupName = groupName;
    
    document.getElementById('dashGroupName').innerText = groupName;
    document.getElementById('dashGroupMeta').innerText = 'Leader: ' + (leaderName || 'TBA');
    
    const logoHtml = groupLogo && groupLogo !== 'null' ? `<img src="${groupLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : '👥';
    document.getElementById('dashGroupLogo').innerHTML = logoHtml;
    
    document.getElementById('groupDashboardModal').classList.add('active');
    window.switchDashTab('overview');
    
    // Fetch Recent Chat
    try {
        const chatRes = await fetch(`/api/small-groups/${groupId}/recent-chat`);
        const chatData = await chatRes.json();
        const chatElem = document.getElementById('dashRecentChat');
        if (chatData && chatData.message) {
            chatElem.innerHTML = `<strong>${chatData.name}:</strong> "${chatData.message}"`;
        } else {
            chatElem.innerHTML = "No recent messages.";
        }
    } catch(e) {}
    
    // Fetch Roster with Online Status
    try {
        const rosRes = await fetch(`/api/small-groups/${groupId}/roster-status`);
        const roster = await rosRes.json();
        const container = document.getElementById('dashMembersList');
        
        const now = new Date().getTime();
        
        const isLeader = window.hasPerm('edit_entries') || (currentMember && currentMember.id == leaderId);
        const lControls = document.getElementById('dashLeaderControls');
        if (lControls) lControls.style.display = isLeader ? 'block' : 'none';

        container.innerHTML = roster.map(m => {
            const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<div style="width:40px; height:40px; border-radius:50%; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-weight:bold;">${m.name.charAt(0)}</div>`;
            let isOnline = false;
            if (m.last_active) {
                if ((now - new Date(m.last_active).getTime()) < (24 * 60 * 60 * 1000)) isOnline = true;
            }
            const dot = isOnline ? `<span style="color: #10B981; font-size: 0.8rem;">🟢</span>` : `<span style="color: #CBD5E1; font-size: 0.8rem;">⚪</span>`;
            
            let statusBtn = '';
            if (m.status === 'Pending') {
                if (isLeader) {
                    statusBtn = `<div style="display:flex; gap:5px;"><button class="btn btn-primary btn-sm" style="padding:2px 8px; font-size:0.75rem;" onclick="updateGroupMemberStatus(${m.id}, 'Approved')">Approve</button><button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); padding:2px 8px; font-size:0.75rem;" onclick="updateGroupMemberStatus(${m.id}, 'Denied')">Deny</button></div>`;
                } else {
                    statusBtn = `<span class="badge badge-orange">Pending</span>`;
                }
            } else {
                const removeBtn = isLeader ? `<button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger); padding:2px 8px; font-size:0.7rem; margin-left: 10px;" onclick="removeGroupMember(${m.id}, '${m.name.replace(/'/g, "\\'")}')">Remove</button>` : '';
                statusBtn = `<div style="display:flex; align-items:center;">${dot} ${removeBtn}</div>`;
            }

            return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px; border-bottom: 1px solid var(--border-color); background: #FFF; border-radius: 8px; margin-bottom: 8px;">
                <div style="display:flex; align-items:center; gap: 10px;">
                    ${avatar}
                    <strong style="color:var(--text-main); font-size:1.05rem;">${m.name}</strong>
                </div>
                ${statusBtn}
            </div>`;
        }).join('');
    } catch(e) {}
};

window.closeGroupDashboard = function() {
    document.getElementById('groupDashboardModal').classList.remove('active');
};

window.switchDashTab = function(tab) {
    document.getElementById('dashTabOverview').style.display = tab === 'overview' ? 'block' : 'none';
    document.getElementById('dashTabMembers').style.display = tab === 'members' ? 'block' : 'none';
    document.getElementById('dashTabPrayers').style.display = tab === 'prayers' ? 'block' : 'none';
    if (tab === 'prayers' && currentDashboardGroupId) window.loadGroupPrayers(currentDashboardGroupId);
    
    document.getElementById('btnDashOverview').classList.toggle('active', tab === 'overview');
    document.getElementById('btnDashMembers').classList.toggle('active', tab === 'members');
    document.getElementById('btnDashPrayers').classList.toggle('active', tab === 'prayers');
};

window.launchDashCampfire = function() {
    if(currentDashboardGroupId) openGroupSpace(currentDashboardGroupId, currentDashboardGroupName);
};
window.launchDashVault = function() {
    if(currentDashboardGroupId) openGroupVault(currentDashboardGroupId, currentDashboardGroupName);
};

// --- V16 PRIVATE GROUP PRAYER ENGINE ---
window.openGroupPrayerModal = function() {
    document.getElementById('groupPrayerModal').classList.add('active');
};
window.closeGroupPrayerModal = function() {
    document.getElementById('groupPrayerModal').classList.remove('active');
};

window.submitGroupPrayer = async function(e) {
    e.preventDefault();
    if(!currentDashboardGroupId || !currentMember) return alert("Missing group context.");
    const payload = {
        youth_id: currentMember.id,
        title: document.getElementById('gpTitle').value,
        request: document.getElementById('gpRequest').value,
        is_anonymous: document.getElementById('gpAnonymous').checked
    };
    try {
        const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/prayers`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(res.ok && data.success) {
            e.target.reset();
            window.closeGroupPrayerModal();
            window.loadGroupPrayers(currentDashboardGroupId);
            if(window.V6Gamification) window.V6Gamification.loadMyPoints();
            alert("Prayer successfully shared with the group!");
        } else {
            alert(data.error || "Failed to post prayer.");
        }
    } catch(err) {
        alert("Network error processing your prayer.");
    }
};

window.loadGroupPrayers = async function(groupId) {
    try {
        const res = await fetch(`/api/small-groups/${groupId}/prayers`);
        const prayers = await res.json();
        const container = document.getElementById('dashPrayersList');
        if(prayers.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No private prayers shared in this group yet.</p>';
            return;
        }
        
        container.innerHTML = prayers.map(p => {
            const author = p.is_anonymous ? 'Anonymous' : p.author_name;
            const isMe = currentMember && currentMember.id === p.youth_id;
            const answeredBadge = p.is_answered ? `<span class="badge badge-green">🎉 Answered!</span>` : `<span class="badge badge-orange">🙏 Praying</span>`;
            
            let actionHtml = '';
            if (!p.is_answered) {
                actionHtml += `<button class="btn btn-outline btn-sm" style="border-color: #8B5CF6; color: #8B5CF6; font-weight:bold;" onclick="intercedeGroupPrayer(${p.id}, ${p.youth_id})">🙏 I prayed</button>`;
                if (isMe || window.hasPerm('edit_entries')) {
                    actionHtml += `<button class="btn btn-outline btn-sm" style="margin-left: 10px; border-color: #10B981; color: #10B981; font-weight:bold;" onclick="markGroupPrayerAnswered(${p.id}, '${p.title.replace(/'/g, "\\'")}')">✅ Mark Answered</button>`;
                }
            }
            
            return `
            <div style="background: #FFF; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; align-items:flex-start; margin-bottom: 8px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${p.title}</strong>
                    ${answeredBadge}
                </div>
                <div style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 10px;">By: ${author} • ${p.created_at}</div>
                <p style="font-size: 0.95rem; color: var(--text-main); margin-bottom: 15px; white-space: pre-wrap;">${p.request}</p>
                <div>${actionHtml}</div>
            </div>`;
        }).join('');
    } catch(err) {}
};

window.intercedeGroupPrayer = async function(prayerId, authorId) {
    if(!currentMember) return;
    try {
        const res = await fetch(`/api/small-groups/prayers/${prayerId}/intercede`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ youth_id: currentMember.id, author_id: authorId, group_name: currentDashboardGroupName })
        });
        if(res.ok) {
            alert('Prayer logged! The author has been notified.');
        } else {
            alert('You already prayed for this request today!');
        }
    } catch(err) {}
};

window.markGroupPrayerAnswered = async function(prayerId, title) {
    window.triggerActionConfirmation('Mark this prayer as answered? The whole group will be notified of the Praise Report!', async () => {
        try {
            const res = await fetch(`/api/small-groups/prayers/${prayerId}/answered`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ group_id: currentDashboardGroupId, group_name: currentDashboardGroupName, title: title })
            });
            if(res.ok) window.loadGroupPrayers(currentDashboardGroupId);
        } catch(err) {}
    });
};


window.removeGroupMember = async function(youthId, name) {
    if(!currentDashboardGroupId) return;
    window.triggerActionConfirmation(`Are you sure you want to remove ${name} from the group?`, async () => {
        try {
            // We reuse the 'Denied' status route because it cleanly deletes the mapping from the database
            const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/members/${youthId}/status`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status: 'Denied' })
            });
            if(res.ok) {
                // Refresh the dashboard automatically
                window.openGroupDashboard(currentDashboardGroupId, currentDashboardGroupName, '', '', 0); 
            }
        } catch(e) {}
    });
};
window.updateGroupMemberStatus = async function(youthId, status) {
    if(!currentDashboardGroupId) return;
    window.triggerActionConfirmation(`Are you sure you want to ${status} this request?`, async () => {
        try {
            const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/members/${youthId}/status`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status })
            });
            if(res.ok) {
                // re-open dashboard to refresh the list cleanly
                window.openGroupDashboard(currentDashboardGroupId, currentDashboardGroupName, '', '', 0);
            }
        } catch(e) {}
    });
};

window.filterDashInvite = async function() {
    const q = document.getElementById('dashInviteSearch').value.toLowerCase().trim();
    const dropdown = document.getElementById('dashInviteDropdown');
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    if (typeof youthData === 'undefined' || youthData.length === 0) {
        const res = await fetch('/api/youth'); youthData = await res.json();
    }
    const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(y => `<div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="selectDashInvite(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name}</strong></div>`).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div style="padding:10px; color:var(--text-muted);">No matches</div>';
        dropdown.style.display = 'block';
    }
};

window.selectDashInvite = function(id, name) {
    document.getElementById('dashInviteYouthId').value = id;
    document.getElementById('dashInviteSearch').value = name;
    document.getElementById('dashInviteDropdown').style.display = 'none';
};

window.submitDashInvite = async function() {
    const youthId = document.getElementById('dashInviteYouthId').value;
    if(!youthId || !currentDashboardGroupId) return alert('Search and select a member to invite.');
    try {
        const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/invite`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: youthId })
        });
        const data = await res.json();
        if(data.success) {
            document.getElementById('dashInviteSearch').value = '';
            document.getElementById('dashInviteYouthId').value = '';
            alert('Member successfully added to the group!');
            window.openGroupDashboard(currentDashboardGroupId, currentDashboardGroupName, '', '', 0);
        } else { alert(data.error); }
    } catch(e) {}
};


// --- V14 FULL RECOVERY LOGIC (Tabs, Chat 2.0, Deep Dives, Memories) ---
window.switchDashTab = function(tab) {
    const ids = ['Overview', 'Members', 'Prayers', 'DeepDive', 'Memories'];
    ids.forEach(id => {
        const div = document.getElementById('dashTab' + id); if(div) div.style.display = 'none';
        const btn = document.getElementById('btnDash' + id); if(btn) btn.classList.remove('active');
    });
    
    let activeId = 'Overview';
    if (tab === 'members') activeId = 'Members';
    if (tab === 'prayers') activeId = 'Prayers';
    if (tab === 'deepdive') activeId = 'DeepDive';
    if (tab === 'memories') activeId = 'Memories';

    const actDiv = document.getElementById('dashTab' + activeId); if(actDiv) actDiv.style.display = 'block';
    const actBtn = document.getElementById('btnDash' + activeId); if(actBtn) actBtn.classList.add('active');

    if (tab === 'prayers' && currentDashboardGroupId) window.loadGroupPrayers(currentDashboardGroupId);
    if (tab === 'deepdive' && currentDashboardGroupId) window.loadGroupThreads(currentDashboardGroupId);
    if (tab === 'memories' && currentDashboardGroupId) window.loadGroupMemories(currentDashboardGroupId);
};

window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                let reactHtml = '';
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    if (r['❤️']) reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px;">❤️ ${r['❤️']}</span>`;
                    if (r['🙏']) reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px;">🙏 ${r['🙏']}</span>`;
                    if (r['👍']) reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px;">👍 ${r['👍']}</span>`;
                    if (r['😂']) reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px;">😂 ${r['😂']}</span>`;
                } catch(e) {}

                const reactBtn = `<div style="display:inline-flex; gap:6px; background:#FFF0E6; padding:4px 8px; border-radius:12px; margin-left:5px;">
                    <button style="background:none;border:none;font-size:0.95rem;cursor:pointer;padding:0;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                    <button style="background:none;border:none;font-size:0.95rem;cursor:pointer;padding:0;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                    <button style="background:none;border:none;font-size:0.95rem;cursor:pointer;padding:0;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                    <button style="background:none;border:none;font-size:0.95rem;cursor:pointer;padding:0;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:5px;">
                        <div style="max-width: 80%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; justify-content:flex-end; gap:5px; margin-top:4px; align-items:center;">${reactHtml} ${reactBtn} <span style="font-size:0.65rem; color:var(--text-muted);">${timeStr}</span></div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:5px;">
                        ${avatar}
                        <div style="max-width: 80%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; gap:5px; margin-top:4px; align-items:center;"><span style="font-size:0.65rem; color:var(--text-muted); margin-left:4px;">${timeStr}</span> ${reactBtn} ${reactHtml}</div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        } else if (isInitialLoad && messages.length === 0) {
            document.getElementById('groupChatMessages').innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">It is quiet here... start the conversation! 🔥</p>';
        }
    } catch(e) {}
};

window.reactToMessage = async function(chatId, emoji) {
    try {
        await fetch(`/api/small-groups/chat/${chatId}/react`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ emoji }) });
        const container = document.getElementById('groupChatMessages');
        container.innerHTML = '';
        lastChatMsgId = 0;
        fetchAndRenderGroupChat(true); 
    } catch(e) {}
};

window.loadGroupThreads = async function(groupId) {
    const createSection = document.getElementById('dashCreateThreadSection');
    if (createSection) createSection.style.display = 'block';

    try {
        const res = await fetch(`/api/small-groups/${groupId}/threads`);
        const threads = await res.json();
        const container = document.getElementById('dashThreadsList');
        if (threads.length === 0) return container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No deep dives or discussions posted yet.</p>';

        container.innerHTML = threads.map(t => {
            const avatarHtml = t.profile_picture ? `<img src="${t.profile_picture}" style="width:35px;height:35px;border-radius:50%;object-fit:cover;">` : `<div style="width:35px;height:35px;border-radius:50%;background:var(--bg-light);display:flex;align-items:center;justify-content:center;font-weight:bold;">${t.author_name.charAt(0)}</div>`;
            const snippet = t.content.length > 100 ? t.content.substring(0, 100) + '...' : t.content;
            return `
            <div style="background: #FFF; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 15px; cursor: pointer;" onclick="openThreadView(${t.id}, '${t.title.replace(/'/g, "\\'")}', '${encodeURIComponent(t.content)}', '${t.author_name.replace(/'/g, "\\'")}', '${t.created_at}', '${t.profile_picture || ''}')">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                    ${avatarHtml}
                    <div style="flex:1;">
                        <h4 style="margin:0 0 4px 0; color:var(--primary); font-size:1.1rem;">${t.title}</h4>
                        <p style="margin:0 0 8px 0; font-size:0.9rem; color:var(--text-muted);">${snippet}</p>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <small style="color:var(--text-muted); font-size:0.75rem;">Posted by ${t.author_name}</small>
                            <span class="badge badge-orange">${t.reply_count} Replies</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(err) {}
};

window.submitGroupThread = async function(e) {
    e.preventDefault();
    if(!currentDashboardGroupId) return alert("No active group.");
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
    const payload = { youth_id: youthId, title: document.getElementById('threadTitle').value, content: document.getElementById('threadContent').value };
    try {
        const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/threads`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        if (res.ok) {
            e.target.reset();
            window.loadGroupThreads(currentDashboardGroupId);
            alert("✅ Discussion posted successfully!");
        } else { alert("Failed to post discussion."); }
    } catch(err) { alert("Network error."); }
};

window.openThreadView = function(threadId, title, contentEncoded, author, date, pic) {
    document.getElementById('replyThreadId').value = threadId;
    document.getElementById('viewThreadTitle').innerText = title;
    document.getElementById('viewThreadContent').innerText = decodeURIComponent(contentEncoded);
    document.getElementById('viewThreadAuthor').innerText = author;
    document.getElementById('viewThreadDate').innerText = date;
    const avatar = document.getElementById('viewThreadAvatar');
    if(pic && pic !== 'null') avatar.innerHTML = `<img src="${pic}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    else avatar.innerHTML = author.charAt(0);
    document.getElementById('groupThreadModal').classList.add('active');
    window.loadThreadReplies(threadId);
};

window.closeThreadView = function() {
    document.getElementById('groupThreadModal').classList.remove('active');
    if(currentDashboardGroupId) window.loadGroupThreads(currentDashboardGroupId);
};

window.loadThreadReplies = async function(threadId) {
    try {
        const res = await fetch(`/api/small-groups/threads/${threadId}/replies`);
        const replies = await res.json();
        const container = document.getElementById('threadRepliesList');
        if (replies.length === 0) return container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Be the first to reply!</span>';
        container.innerHTML = replies.map(r => {
            const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div style="width:28px;height:28px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;">${r.author_name.charAt(0)}</div>`;
            const timeStr = new Date(r.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'});
            return `
            <div style="background:#FFF; padding:12px; border-radius:8px; border:1px solid var(--bg-light);">
                <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:6px;">
                    ${avatarHtml}
                    <div>
                        <strong style="color:var(--text-main); font-size:0.85rem;">${r.author_name}</strong>
                        <span style="color:var(--text-muted); font-size:0.7rem; margin-left:6px;">${timeStr}</span>
                    </div>
                </div>
                <p style="margin:0 0 0 38px; font-size:0.95rem; color:var(--text-main); white-space:pre-wrap;">${r.reply_text}</p>
            </div>`;
        }).join('');
    } catch(err) {}
};

window.submitThreadReply = async function(e) {
    e.preventDefault();
    const threadId = document.getElementById('replyThreadId').value;
    const text = document.getElementById('replyThreadInput').value;
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
    const authorName = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.name : "Admin";
    if(!threadId || !text.trim()) return;
    try {
        const res = await fetch(`/api/small-groups/threads/${threadId}/replies`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ youth_id: youthId, reply_text: text, author_name: authorName })
        });
        if(res.ok) {
            document.getElementById('replyThreadInput').value = '';
            window.loadThreadReplies(threadId);
        }
    } catch(err) {}
};

window.loadGroupMemories = async function(groupId) {
    try {
        const res = await fetch(`/api/small-groups/${groupId}/memories`);
        const memories = await res.json();
        const container = document.getElementById('dashMemoriesGrid');
        if(memories.length === 0) return container.innerHTML = '<p style="grid-column: span 2; text-align:center; color:var(--text-muted);">No memories shared yet. Be the first!</p>';
        container.innerHTML = memories.map(m => `
        <div style="background: #FFF; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.05); position: relative;">
            <img src="${m.image_data}" style="width: 100%; height: 160px; object-fit: cover; cursor: pointer;" onclick="openImageViewer(this.src)">
            <div style="padding: 10px;">
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.caption}</p>
                <small style="color: var(--text-muted); font-size: 0.7rem;">${m.author_name}</small>
            </div>
        </div>`).join('');
    } catch(e) {}
};

window.submitGroupMemory = function(e) {
    e.preventDefault();
    if(!currentDashboardGroupId) return;
    const fileInput = document.getElementById('memoryImageInput');
    const caption = document.getElementById('memoryCaptionInput').value;
    if(fileInput.files.length === 0) return;
    
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            let width = img.width;
            let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const base64Compressed = canvas.toDataURL('image/jpeg', 0.6);
            
            try {
                const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/memories`, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ youth_id: youthId, image_data: base64Compressed, caption: caption })
                });
                if (res.ok) {
                    e.target.reset();
                    window.loadGroupMemories(currentDashboardGroupId);
                }
            } catch(err) {}
        };
    };
};


window.autoResizeBox = function(el) { if(!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; };
window.openLiturgicalReadings = function() { const iframe = document.getElementById('readingsIframe'); if (iframe && !iframe.src) iframe.src = 'https://universalis.com/mass.htm'; const modal = document.getElementById('liturgicalReadingsModal'); if (modal) modal.classList.add('active'); };
window.closeLiturgicalReadings = function() { const modal = document.getElementById('liturgicalReadingsModal'); if (modal) modal.classList.remove('active'); };
window.toggleReactMenu = function(id) { const menu = document.getElementById('react-menu-' + id); if(menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; };
window.reactToMessage = async function(chatId, emoji) {
    await fetch(`/api/small-groups/chat/${chatId}/react`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ emoji }) });
    const container = document.getElementById('groupChatMessages'); if(container) container.innerHTML = '';
    lastChatMsgId = 0; if(typeof fetchAndRenderGroupChat === 'function') fetchAndRenderGroupChat(true); 
};
window.switchDashTab = function(tab) {
    const ids = ['Overview', 'Members', 'Prayers', 'DeepDive', 'Memories'];
    ids.forEach(id => { const d = document.getElementById('dashTab' + id); if(d) d.style.display = 'none'; const b = document.getElementById('btnDash' + id); if(b) b.classList.remove('active'); });
    let aId = 'Overview'; if (tab === 'members') aId = 'Members'; if (tab === 'prayers') aId = 'Prayers'; if (tab === 'deepdive') aId = 'DeepDive'; if (tab === 'memories') aId = 'Memories';
    const aD = document.getElementById('dashTab' + aId); if(aD) aD.style.display = 'block'; const aB = document.getElementById('btnDash' + aId); if(aB) aB.classList.add('active');
    if (tab === 'prayers' && currentDashboardGroupId) window.loadGroupPrayers(currentDashboardGroupId);
    if (tab === 'deepdive' && currentDashboardGroupId) window.loadGroupThreads(currentDashboardGroupId);
    if (tab === 'memories' && currentDashboardGroupId) window.loadGroupMemories(currentDashboardGroupId);
};
window.loadGroupThreads = async function(groupId) {
    const createSection = document.getElementById('dashCreateThreadSection'); if (createSection) createSection.style.display = 'block';
    try {
        const res = await fetch(`/api/small-groups/${groupId}/threads`); const threads = await res.json();
        const container = document.getElementById('dashThreadsList');
        if (threads.length === 0) return container.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:20px;">No deep dives or discussions posted yet.</p>';
        container.innerHTML = threads.map(t => {
            const avatarHtml = t.profile_picture ? `<img src="${t.profile_picture}" style="width:35px;height:35px;border-radius:50%;object-fit:cover;">` : `<div style="width:35px;height:35px;border-radius:50%;background:var(--bg-light);display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--text-main);">${t.author_name.charAt(0)}</div>`;
            return `<div style="background: #FFF; padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 15px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.03);" onclick="openThreadView(${t.id}, '${t.title.replace(/'/g, "\\'")}', '${encodeURIComponent(t.content)}', '${t.author_name.replace(/'/g, "\\'")}', '${t.created_at}', '${t.profile_picture || ''}')">
                <div style="display:flex; gap:12px; align-items:flex-start;">${avatarHtml}<div style="flex:1;"><h4 style="margin:0 0 4px 0; color:var(--primary); font-size:1.1rem;">${t.title}</h4><div style="display:flex; justify-content:space-between; align-items:center;"><small style="color:var(--text-muted); font-size:0.75rem;">Posted by ${t.author_name}</small><span class="badge badge-orange">${t.reply_count} Replies</span></div></div></div></div>`;
        }).join('');
    } catch(err) {}
};
window.submitGroupThread = async function(e) {
    e.preventDefault(); if(!currentDashboardGroupId) return alert("No active group.");
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
    try {
        const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/threads`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ youth_id: youthId, title: document.getElementById('threadTitle').value, content: document.getElementById('threadContent').value }) });
        if (res.ok) { e.target.reset(); window.loadGroupThreads(currentDashboardGroupId); alert("✅ Discussion posted successfully!"); }
    } catch(err) { alert("Network error."); }
};
window.openThreadView = function(id, title, content, author, date, pic) {
    document.getElementById('replyThreadId').value = id; document.getElementById('viewThreadTitle').innerText = title; document.getElementById('viewThreadContent').innerText = decodeURIComponent(content);
    document.getElementById('groupThreadModal').classList.add('active'); window.loadThreadReplies(id);
};
window.closeThreadView = function() { document.getElementById('groupThreadModal').classList.remove('active'); if(currentDashboardGroupId) window.loadGroupThreads(currentDashboardGroupId); };
window.loadThreadReplies = async function(threadId) {
    try {
        const res = await fetch(`/api/small-groups/threads/${threadId}/replies`); const replies = await res.json();
        const container = document.getElementById('threadRepliesList');
        if (replies.length === 0) return container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Be the first to reply!</span>';
        container.innerHTML = replies.map(r => `<div style="background:#FFF; padding:12px; border-radius:8px; border:1px solid var(--bg-light);"><strong style="color:var(--text-main); font-size:0.85rem;">${r.author_name}</strong><p style="margin:5px 0 0 0; font-size:0.95rem; color:var(--text-main); white-space:pre-wrap;">${r.reply_text}</p></div>`).join('');
    } catch(err) {}
};
window.submitThreadReply = async function(e) {
    e.preventDefault(); const threadId = document.getElementById('replyThreadId').value; const text = document.getElementById('replyThreadInput').value;
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0; const authorName = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.name : "Admin";
    if(!threadId || !text.trim()) return;
    try { const res = await fetch(`/api/small-groups/threads/${threadId}/replies`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ youth_id: youthId, reply_text: text, author_name: authorName }) });
        if(res.ok) { document.getElementById('replyThreadInput').value = ''; window.loadThreadReplies(threadId); }
    } catch(err) {}
};
window.loadGroupMemories = async function(groupId) {
    try {
        const res = await fetch(`/api/small-groups/${groupId}/memories`); const memories = await res.json();
        const container = document.getElementById('dashMemoriesGrid');
        if(memories.length === 0) return container.innerHTML = '<p style="grid-column: span 2; text-align:center; color:var(--text-muted);">No memories shared yet. Be the first!</p>';
        container.innerHTML = memories.map(m => `<div style="background: #FFF; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.05); position: relative;"><img src="${m.image_data}" style="width: 100%; height: 160px; object-fit: cover; cursor: pointer;" onclick="openImageViewer(this.src)"><div style="padding: 10px;"><p style="margin: 0; font-size: 0.85rem; color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.caption}</p><small style="color: var(--text-muted); font-size: 0.7rem;">${m.author_name}</small></div></div>`).join('');
    } catch(e) {}
};
window.submitGroupMemory = function(e) {
    e.preventDefault(); if(!currentDashboardGroupId) return;
    const youthId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
    const fileInput = document.getElementById('memoryImageInput'); const caption = document.getElementById('memoryCaptionInput').value;
    if(fileInput.files.length === 0) return;
    const file = fileInput.files[0]; const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = event => {
        const img = new Image(); img.src = event.target.result;
        img.onload = async () => {
            const canvas = document.createElement('canvas'); const MAX_WIDTH = 600; let width = img.width; let height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            const base64Compressed = canvas.toDataURL('image/jpeg', 0.6);
            try { const res = await fetch(`/api/small-groups/${currentDashboardGroupId}/memories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: youthId, image_data: base64Compressed, caption: caption }) });
                if (res.ok) { e.target.reset(); window.loadGroupMemories(currentDashboardGroupId); }
            } catch(err) {}
        };
    };
};


// =======================================================
// V16 ULTIMATE FIX: AUTO-RESIZE & FB CHAT REACTIONS
// =======================================================

// 1. Dynamic Textarea Expander
window.autoResizeBox = function(el) {
    if (!el) return;
    el.style.height = 'auto'; // Reset height briefly to recalculate
    el.style.height = (el.scrollHeight) + 'px'; // Set to exact content height
};

// 2. Reaction Menu Toggler (Closes other open menus automatically)
window.toggleReactMenu = function(id) {
    document.querySelectorAll('[id^="react-menu-"]').forEach(menu => {
        if (menu.id !== 'react-menu-' + id) menu.style.display = 'none';
    });
    const menu = document.getElementById('react-menu-' + id);
    if (menu) {
        menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
    }
};

// 3. Submit Reaction & Live Reload
window.reactToMessage = async function(chatId, emoji) {
    try {
        await fetch(`/api/small-groups/chat/${chatId}/react`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ emoji }) 
        });
        
        // Hide the menu after clicking
        const menu = document.getElementById('react-menu-' + chatId);
        if (menu) menu.style.display = 'none';
        
        // Wipe container and trigger a fresh load to update counters instantly
        const container = document.getElementById('groupChatMessages');
        if (container) container.innerHTML = '';
        lastChatMsgId = 0;
        
        if (typeof fetchAndRenderGroupChat === 'function') {
            fetchAndRenderGroupChat(true);
        }
    } catch(e) {
        console.error('Failed to react:', e);
    }
};

// 4. Overwrite Chat Renderer for Inline Facebook-Style Reactions
window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Parse Links & YouTube
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                // Render Live Reaction Counters
                let reactHtml = '';
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    ['❤️','🙏','👍','😂'].forEach(emoji => {
                        if(r[emoji]) {
                            reactHtml += `<span style="font-size:0.75rem; background:#FFF; border:1px solid rgba(255,107,0,0.3); color:var(--primary); padding:2px 6px; border-radius:10px; margin-right:4px; display:inline-block; margin-top:4px; font-weight:bold;">${emoji} ${r[emoji]}</span>`;
                        }
                    });
                } catch(e) {}

                // FB-Style Inline Picker UI
                const reactPickerHtml = `
                <div style="margin-top:6px; position:relative; width: 100%;">
                    <button style="background:#FFF0E6; border:1px solid rgba(255,107,0,0.2); border-radius:12px; padding:4px 10px; cursor:pointer; font-size:0.8rem; color:var(--primary); font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.05);" onclick="window.toggleReactMenu(${m.id})">😀 React</button>
                    
                    <div id="react-menu-${m.id}" style="display:none; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; margin-top:6px; box-shadow:0 4px 12px rgba(0,0,0,0.15); gap:12px; align-items:center; flex-wrap:wrap; width: max-content;">
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                    </div>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
                        <div style="max-width: 85%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-top:2px;">
                                <div style="display:flex; align-items:center; gap:6px;">${reactHtml} <span style="font-size:0.65rem; color:var(--text-muted);">${timeStr}</span></div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:12px;">
                        ${avatar}
                        <div style="max-width: 85%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-start; margin-top:2px; margin-left:4px;">
                                <div style="display:flex; align-items:center; gap:6px;"><span style="font-size:0.65rem; color:var(--text-muted);">${timeStr}</span> ${reactHtml}</div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {}
};


// =======================================================
// V17: FACEBOOK-STYLE DYNAMIC REACTIONS & COUNTERS
// =======================================================
window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Parse Links & YouTube
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                // Calculate Total Reactions and Determine the "Top" Emoji
                let mainIcon = '👍';
                let mainText = 'React';
                let totalReactions = 0;
                
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    let maxCount = 0;
                    ['❤️','🙏','👍','😂'].forEach(emoji => {
                        if(r[emoji]) {
                            totalReactions += r[emoji];
                            if(r[emoji] > maxCount) {
                                maxCount = r[emoji];
                                mainIcon = emoji; // Updates the button icon to the most clicked reaction
                            }
                        }
                    });
                } catch(e) {}

                // If there are any reactions, replace the word "React" with the actual counter number
                if (totalReactions > 0) {
                    mainText = totalReactions; 
                }

                // FB-Style Inline Picker UI
                const reactPickerHtml = `
                <div style="margin-top:6px; position:relative; width: 100%;">
                    <button style="background:#FFF0E6; border:1px solid rgba(255,107,0,0.2); border-radius:12px; padding:4px 10px; cursor:pointer; color:var(--primary); font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; gap:6px;" onclick="window.toggleReactMenu(${m.id})">
                        <span style="font-size: 0.95rem;">${mainIcon}</span> <span style="font-size: 0.8rem;">${mainText}</span>
                    </button>
                    
                    <div id="react-menu-${m.id}" style="display:none; position:absolute; bottom: 110%; left: 0; z-index: 100; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); gap:12px; align-items:center; flex-wrap:nowrap; width: max-content;">
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                    </div>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                        <div style="max-width: 85%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-top:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:15px;">
                        ${avatar}
                        <div style="max-width: 85%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-start; margin-top:4px; margin-left:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactPickerHtml}
                            </div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {}
};


// =======================================================
// V18: TRUE FACEBOOK-STYLE REACTIONS & COUNTERS
// =======================================================
window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // Parse Links & YouTube
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                // Generate Individual Emoji Counters
                let reactionBadgesHtml = '';
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    ['❤️','🙏','👍','😂'].forEach(emoji => {
                        if(r[emoji] && r[emoji] > 0) {
                            reactionBadgesHtml += `<span style="background:#FFF; border:1px solid rgba(255,107,0,0.3); border-radius:12px; padding:2px 8px; font-size:0.8rem; color:var(--primary); font-weight:bold; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:inline-flex; align-items:center; gap:4px; margin-left:4px;">${emoji} ${r[emoji]}</span>`;
                        }
                    });
                } catch(e) {}

                // FB-Style Inline Picker UI (Static Button + Dynamic Badges)
                const reactContainerHtml = `
                <div style="margin-top:6px; position:relative; width: 100%; display: flex; align-items: center; flex-wrap: wrap;">
                    <button style="background:#FFF0E6; border:1px solid rgba(255,107,0,0.2); border-radius:12px; padding:4px 10px; cursor:pointer; color:var(--primary); font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; gap:6px;" onclick="window.toggleReactMenu(${m.id})">
                        <span style="font-size: 0.95rem;">👍</span> <span style="font-size: 0.8rem;">React</span>
                    </button>
                    
                    ${reactionBadgesHtml}
                    
                    <div id="react-menu-${m.id}" style="display:none; position:absolute; bottom: 110%; left: 0; z-index: 100; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); gap:12px; align-items:center; flex-wrap:nowrap; width: max-content;">
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                    </div>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                        <div style="max-width: 85%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-top:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactContainerHtml}
                            </div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:15px;">
                        ${avatar}
                        <div style="max-width: 85%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-start; margin-top:4px; margin-left:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactContainerHtml}
                            </div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {}
};


window.fetchAndRenderGroupChat = async function(isInitialLoad) {
    if(!currentChatGroupId) return;
    try {
        const res = await fetch(`/api/small-groups/${currentChatGroupId}/chat?last_id=${lastChatMsgId}`);
        const messages = await res.json();
        
        if (messages.length > 0) {
            const container = document.getElementById('groupChatMessages');
            if (isInitialLoad) container.innerHTML = ''; 
            
            messages.forEach(m => {
                lastChatMsgId = Math.max(lastChatMsgId, m.id);
                const isMe = currentMember && currentMember.name === m.name;
                const avatar = m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:bold;color:var(--text-main);flex-shrink:0;">${m.name.charAt(0)}</div>`;
                let timeStr = new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                let msgContent = m.message;
                const ytMatch = msgContent.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
                if (ytMatch && ytMatch[1]) {
                    msgContent = msgContent.replace(ytMatch[0], `<br><iframe style="width:100%; border-radius:8px; margin-top:5px; height: 180px;" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`);
                } else {
                    msgContent = msgContent.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline; font-weight:bold;">$1</a>');
                }

                // Generate Individual Emoji Counters (Facebook Style)
                let reactionBadgesHtml = '';
                try {
                    const r = JSON.parse(m.reactions || '{}');
                    ['❤️','🙏','👍','😂'].forEach(emoji => {
                        if(r[emoji] && r[emoji] > 0) {
                            reactionBadgesHtml += `<span style="background:#FFF; border:1px solid rgba(255,107,0,0.3); border-radius:12px; padding:2px 8px; font-size:0.8rem; color:var(--primary); font-weight:bold; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:inline-flex; align-items:center; gap:4px; margin-left:4px;">${emoji} ${r[emoji]}</span>`;
                        }
                    });
                } catch(e) {}

                // FB-Style Inline Picker UI (Static Button + Dynamic Badges)
                const reactContainerHtml = `
                <div style="margin-top:6px; position:relative; width: 100%; display: flex; align-items: center; flex-wrap: wrap;">
                    <button style="background:#FFF0E6; border:1px solid rgba(255,107,0,0.2); border-radius:12px; padding:4px 10px; cursor:pointer; color:var(--primary); font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; gap:6px;" onclick="window.toggleReactMenu(${m.id})">
                        <span style="font-size: 0.95rem;">👍</span> <span style="font-size: 0.8rem;">React</span>
                    </button>
                    
                    ${reactionBadgesHtml}
                    
                    <div id="react-menu-${m.id}" style="display:none; position:absolute; bottom: 110%; left: 0; z-index: 100; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); gap:12px; align-items:center; flex-wrap:nowrap; width: max-content;">
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '❤️')">❤️</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '🙏')">🙏</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '👍')">👍</button>
                        <button style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:2px; transition:transform 0.2s;" onclick="reactToMessage(${m.id}, '😂')">😂</button>
                    </div>
                </div>`;

                let msgHtml = '';
                if (isMe) {
                    msgHtml = `<div style="display:flex; justify-content:flex-end; margin-bottom:15px;">
                        <div style="max-width: 85%; text-align: right;">
                            <div style="background: var(--primary); color: #FFF; padding: 10px 14px; border-radius: 18px 18px 4px 18px; font-size: 0.95rem; display: inline-block; text-align: left; box-shadow: 0 4px 6px rgba(255,107,0,0.2);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-end; margin-top:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactContainerHtml}
                            </div>
                        </div>
                    </div>`;
                } else {
                    msgHtml = `<div style="display:flex; gap:8px; margin-bottom:15px;">
                        ${avatar}
                        <div style="max-width: 85%;">
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; margin-left: 4px;">${m.name}</div>
                            <div style="background: #FFF; border: 1px solid var(--border-color); color: var(--text-main); padding: 10px 14px; border-radius: 18px 18px 18px 4px; font-size: 0.95rem; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">${msgContent}</div>
                            <div style="display:flex; flex-direction:column; align-items:flex-start; margin-top:4px; margin-left:4px;">
                                <div style="font-size:0.65rem; color:var(--text-muted); margin-bottom:2px;">${timeStr}</div>
                                ${reactContainerHtml}
                            </div>
                        </div>
                    </div>`;
                }
                container.insertAdjacentHTML('beforeend', msgHtml);
            });
            container.scrollTop = container.scrollHeight;
        }
    } catch(e) {}
};