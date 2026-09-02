
// --- RESTORED LOGOUT FUNCTION ---
window.logout = async function() {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        if (typeof currentUser !== 'undefined' && currentUser) {
            await fetch('/api/logout', { 
                method: 'POST', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({username: currentUser}) 
            });
        }
        localStorage.removeItem('fog_user');
        window.location.reload();
    } catch(e) {
        localStorage.removeItem('fog_user');
        window.location.reload();
    }
};

let currentUser = null;
let currentMember = null;
let userPermissions = [];
let eventsData = [];
let youthData = [];
let allUsersList = [];
let cachedAttendanceLogs = [];
let cachedActivityLogs = [];
let ministriesData = [];
let pendingAction = null;
let eventViewMode = 'list';
let calCurrentDate = new Date();
let qrScanner = null;
let currentAnalyticsData = null;
let checkedInYouthIds = new Set();
let currentPreregEventId = null;
let currentRosterFilter = 'all';
let currentPreRegYouthIds = new Set();
let currentMinistryId = null;

let currentDirPage = 1; let dirPerPage = 10; let filteredDir = [];
let currentAttPage = 1; let attPerPage = 10; let filteredAtt = [];
let currentActPage = 1; let actPerPage = 10; let filteredAct = [];

let modalRolesData = []; let modalRolesPage = 1;
let modalAttData = []; let modalAttPage = 1;

const _originalFetch = window.fetch;
const OfflineManager = {
    init: function() {
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        this.updateUI();
        this.overrideFetch();
        setTimeout(() => { if (navigator.onLine) this.syncQueue(); }, 2000);
    },
    updateUI: function() {
        const banner = document.getElementById('offlineBanner');
        if (!banner) return;
        if (navigator.onLine) {
            banner.style.display = 'none';
            document.body.classList.remove('is-offline');
        } else {
            banner.style.display = 'block';
            document.body.classList.add('is-offline');
        }
    },
    handleOnline: function() {
        this.updateUI();
        this.syncQueue();
    },
    handleOffline: function() {
        this.updateUI();
    },
    overrideFetch: function() {
        window.fetch = async function(resource, options) {
            if (!navigator.onLine && options && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase())) {
                const url = typeof resource === 'string' ? resource : resource.url;

                if (url.includes('/api/login') || url.includes('/api/logout') || url.includes('/api/backups')) {
                    return Promise.resolve(new Response(JSON.stringify({ success: false, error: 'This action requires an active internet connection.' }), { status: 400 }));
                }

                const mockId = Date.now();
                const queue = JSON.parse(localStorage.getItem('fog_offline_queue') || '[]');
                queue.push({
                    url: url,
                    method: options.method,
                    headers: options.headers,
                    body: options.body,
                    mockId: mockId
                });
                localStorage.setItem('fog_offline_queue', JSON.stringify(queue));

                let mockRes = { success: true, offline_queued: true, updated: 1, deleted: 1 };
                if (url.includes('/api/youth') && options.method.toUpperCase() === 'POST') mockRes = { id: mockId, qr_code: 'OFFLINE-' + mockId, success: true };
                if (url.includes('/api/checkin')) mockRes = { success: true, member_name: 'Offline Attendee (Queued)', log_id: mockId };
                if (url.includes('/api/events') && options.method.toUpperCase() === 'POST') mockRes = { id: mockId };
                if (url.includes('/api/ministries') && options.method.toUpperCase() === 'POST') mockRes = { success: true, id: mockId };

                return Promise.resolve(new Response(JSON.stringify(mockRes), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            return _originalFetch.apply(this, arguments);
        };
    },
    syncQueue: async function() {
        const queue = JSON.parse(localStorage.getItem('fog_offline_queue') || '[]');
        if (queue.length === 0) return;

        console.log(`[Offline Sync Engine] Processing ${queue.length} pending actions...`);
        let failed = [];
        let idMap = {};

        for (let req of queue) {
            try {
                let bodyStr = req.body;
                if (bodyStr && typeof bodyStr === 'string') {
                    try {
                        let bodyObj = JSON.parse(bodyStr);
                        if (bodyObj.youth_id && idMap[bodyObj.youth_id]) bodyObj.youth_id = idMap[bodyObj.youth_id];
                        if (bodyObj.event_id && idMap[bodyObj.event_id]) bodyObj.event_id = idMap[bodyObj.event_id];
                        bodyStr = JSON.stringify(bodyObj);
                    } catch (err) {}
                }

                let targetUrl = req.url;
                for (let fakeId in idMap) {
                    if (targetUrl.includes(`/${fakeId}`)) targetUrl = targetUrl.replace(`/${fakeId}`, `/${idMap[fakeId]}`);
                }

                const res = await _originalFetch(targetUrl, {
                    method: req.method,
                    headers: req.headers,
                    body: bodyStr
                });

                if (!res.ok) throw new Error(`Network response was not ok for ${targetUrl}`);
                const data = await res.json();

                if (req.mockId && data.id) {
                    idMap[req.mockId] = data.id;
                }
            } catch (e) {
                console.error('[Offline Sync Engine] Failed item:', req.url, e);
                failed.push(req);
            }
        }

        localStorage.setItem('fog_offline_queue', JSON.stringify(failed));
        if (failed.length === 0) {
            console.log('[Offline Sync Engine] All offline actions synchronized successfully!');
            if(document.getElementById('eventsTab') && document.getElementById('eventsTab').classList.contains('active')) window.loadEvents();
            if(document.getElementById('directoryTab') && document.getElementById('directoryTab').classList.contains('active')) window.loadDirectory();
            if(document.getElementById('checkinTab') && document.getElementById('checkinTab').classList.contains('active')) window.updateActiveEventBanner();
            if(document.getElementById('ministriesTab') && document.getElementById('ministriesTab').classList.contains('active')) window.loadMinistries();
            if(window.loadPendingApplications) window.loadPendingApplications();
        }
    }
};

OfflineManager.init();

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

document.addEventListener('click', (e) => {
    if (!e.target.closest('#minSearchInput') && !e.target.closest('#minSearchDropdown')) {
        const drop = document.getElementById('minSearchDropdown');
        if(drop) drop.style.display = 'none';
    }
    if (!e.target.closest('#evtRoleSearchInput') && !e.target.closest('#evtRoleSearchDropdown')) {
        const drop2 = document.getElementById('evtRoleSearchDropdown');
        if(drop2) drop2.style.display = 'none';
    }
});

function bindExecuteAction() {
    const execBtn = document.getElementById('executeConfirmBtn');
    if (execBtn) {
        execBtn.onclick = async (e) => {
            e.preventDefault();
            if (execBtn.disabled) return;
            execBtn.disabled = true;
            const originalText = execBtn.innerText;
            execBtn.innerText = 'Processing...';

            if (pendingAction) {
                try {
                    await pendingAction();
                } catch (err) {
                    console.error("Action Execution Error:", err);
                    alert("A network error occurred while saving. Please check your connection.");
                }
            }
            window.closeConfirmModal();
            execBtn.disabled = false;
            execBtn.innerText = originalText;
        };
    }
}
bindExecuteAction();

// STRICT GLOBAL PERMISSION EVALUATOR
window.hasPerm = function(perm) {
    if (currentUser === 'celsocreeriii@gmail.com') return true;
    if (!userPermissions || !Array.isArray(userPermissions)) return false;
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
        if(event.target.id === 'ministryDetailsModal') currentMinistryId = null;
        if(event.target.id === 'confirmModal') pendingAction = null;
    }
};

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

// ==========================================
// FIXED SIDEBAR NAVIGATION MENU (CLEANED)
// ==========================================
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
        sidebarHtml += `<button class="nav-btn" data-target="inboxTab" onclick="switchTab('inboxTab')">🔔 My Inbox</button>`; // Fixed: Inbox for Admins
        
        if (window.hasPerm('access_checkin')) sidebarHtml += `<button class="nav-btn" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
        if (window.hasPerm('access_directory')) sidebarHtml += `<button class="nav-btn" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
        if (window.hasPerm('access_ministries')) sidebarHtml += `<button class="nav-btn" data-target="ministriesTab" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>`;
        if (window.hasPerm('access_events')) sidebarHtml += `<button class="nav-btn" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
        
        // Discipleship & New Features (Consolidated & Cleaned)
        sidebarHtml += `<button class="nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">📖 Personal Growth</button>`;
        if (window.hasPerm('access_discipleship')) sidebarHtml += `<button class="nav-btn" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')">🌱 Discipleship Admin</button>`;
        if (window.hasPerm('access_worship')) sidebarHtml += `<button class="nav-btn" data-target="worshipTab" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>`;
        if (window.hasPerm('access_communications')) sidebarHtml += `<button class="nav-btn" data-target="communicationsAdminTab" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>`;
        if (window.hasPerm('access_ai')) sidebarHtml += `<button class="nav-btn" data-target="aiAssistantTab" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>`;

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
        bottomHtml += `<button class="bottom-nav-btn" data-target="inboxTab" onclick="switchTab('inboxTab')"><div class="icon">🔔</div>Inbox</button>`;
        bottomHtml += `<button class="bottom-nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')"><div class="icon">📖</div>Grow</button>`;
        bottomHtml += `<button class="bottom-nav-btn" onclick="handleLogout()"><div class="icon">🚪</div>Logout</button>`;

        sidebar.innerHTML = '';
        bottomNav.innerHTML = bottomHtml;
    }
};

window.applyGranularPermissions = function() {
    const canAdd = window.hasPerm('add_entries') || currentUser === 'celsocreeriii@gmail.com';
    
    // Safely enforce display with !important to bypass CSS conflicts
    const setDisp = (id) => { 
        const el = document.getElementById(id); 
        if (el) el.style.setProperty('display', canAdd ? 'inline-flex' : 'none', 'important'); 
    };
    
    setDisp('btnSubEventCreate');
    setDisp('btnSubMinistryCreate');
    setDisp('btnCheckinWalkin');
    setDisp('addEntryAnalyticsBtn');
    setDisp('btnDirectoryAddMember');
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
    if (tabId === 'eventsTab') window.loadEvents();
    if (tabId === 'ministriesTab') window.loadMinistries();
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

window.switchMinistrySubTab = function(tab) {
    document.getElementById('subTabMinistryList').classList.toggle('active', tab === 'list');
    document.getElementById('subTabMinistryCreate').classList.toggle('active', tab === 'create');
    document.getElementById('btnSubMinistryList').classList.toggle('active', tab === 'list');
    document.getElementById('btnSubMinistryCreate').classList.toggle('active', tab === 'create');
    if (tab === 'list') window.loadMinistries();
};

window.switchAnalyticsSubTab = function(tab) {
    document.getElementById('analyticsTabOverview').classList.toggle('active', tab === 'overview');
    document.getElementById('analyticsTabRoles').classList.toggle('active', tab === 'roles');
    document.getElementById('btnAnalyticsTabOverview').classList.toggle('active', tab === 'overview');
    document.getElementById('btnAnalyticsTabRoles').classList.toggle('active', tab === 'roles');
};

// ==============================================================================
// MODAL PROFILE TABS & PAGINATION LOGIC
// ==============================================================================
window.switchProfileModalTab = function(tab) {
    document.getElementById('profileTabRoles').style.display = tab === 'roles' ? 'block' : 'none';
    document.getElementById('profileTabAttendance').style.display = tab === 'attendance' ? 'block' : 'none';
    document.getElementById('btnProfileTabRoles').classList.toggle('active', tab === 'roles');
    document.getElementById('btnProfileTabAttendance').classList.toggle('active', tab === 'attendance');
};

window.renderModalRoles = function() {
    const container = document.getElementById('modalMinistriesHistory');
    const paginator = document.getElementById('modalRolesPagination');
    const perPage = 10;
    const totalPages = Math.ceil(modalRolesData.length / perPage) || 1;
    const start = (modalRolesPage - 1) * perPage;
    const paged = modalRolesData.slice(start, start + perPage);

    if (modalRolesData.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No roles assigned yet.</p>`;
        paginator.style.display = 'none';
        return;
    }

    let html = '';
    paged.forEach(item => {
        if (item.type === 'ministry') {
            const combinedRole = `${item.role}${item.sub_role ? ' | ' + item.sub_role : ''}`;
            html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <strong style="color:var(--text-main); font-size: 0.95rem;">🏛️ ${item.ministry_name}</strong>
                <span style="font-size:11px; color:var(--primary); background: rgba(255,107,0,0.1); padding: 3px 8px; border-radius: 6px; text-align:right;">${combinedRole}</span>
            </div>`;
        } else {
            const combinedRole = `${item.role_name}${item.sub_role ? ' | ' + item.sub_role : ''}`;
            html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <div><strong style="color:var(--text-main); font-size: 0.95rem;">📅 ${item.event_name}</strong><br><small style="color:var(--text-muted);">${item.event_date}</small></div>
                <div style="text-align: right;"><span style="font-size:11px; color:#8B5CF6; background: rgba(139,92,246,0.1); padding: 3px 8px; border-radius: 6px;">${combinedRole}</span></div>
            </div>`;
        }
    });
    container.innerHTML = html;

    if (modalRolesData.length > 10) {
        paginator.style.display = 'flex';
        paginator.style.justifyContent = 'center';
        paginator.style.gap = '10px';
        paginator.style.alignItems = 'center';
        paginator.innerHTML = `
            <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalRolesPage--; renderModalRoles()" ${modalRolesPage === 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="font-size: 0.85rem; color: var(--text-main); white-space: nowrap;">${modalRolesPage} of ${totalPages}</span>
            <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalRolesPage++; renderModalRoles()" ${modalRolesPage === totalPages ? 'disabled' : ''}>Next ▶</button>
        `;
    } else {
        paginator.style.display = 'none';
    }
};

window.renderModalAttendance = function() {
    const container = document.getElementById('modalAttendanceHistory');
    const paginator = document.getElementById('modalAttendancePagination');
    const perPage = 10;
    const totalPages = Math.ceil(modalAttData.length / perPage) || 1;
    const start = (modalAttPage - 1) * perPage;
    const paged = modalAttData.slice(start, start + perPage);

    if (modalAttData.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No attendance history recorded yet.</p>`;
        paginator.style.display = 'none';
        return;
    }

    container.innerHTML = paged.map(h => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 10px 5px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="color: var(--text-main);">${h.event_name}</strong><br>
                <small style="color: var(--text-muted);">📅 ${h.event_date}</small>
            </div>
            <div style="text-align: right;">
                <span class="badge ${h.is_walkin ? 'badge-orange' : 'badge-blue'}" style="font-size: 0.7rem;">${h.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span><br>
                <small style="color: var(--success); font-weight: bold;">${new Date(h.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
            </div>
        </div>`).join('');

    if (modalAttData.length > 10) {
        paginator.style.display = 'flex';
        paginator.style.justifyContent = 'center';
        paginator.style.gap = '10px';
        paginator.style.alignItems = 'center';
        paginator.innerHTML = `
            <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalAttPage--; renderModalAttendance()" ${modalAttPage === 1 ? 'disabled' : ''}>◀ Prev</button>
            <span style="font-size: 0.85rem; color: var(--text-main); white-space: nowrap;">${modalAttPage} of ${totalPages}</span>
            <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalAttPage++; renderModalAttendance()" ${modalAttPage === totalPages ? 'disabled' : ''}>Next ▶</button>
        `;
    } else {
        paginator.style.display = 'none';
    }
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

window.loadMinistriesAndEventRolesForProfile = async function(youthId, containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;

    try {
        const [minRes, evtRes] = await Promise.all([
            fetch(`/api/youth/${youthId}/ministries`),
            fetch(`/api/youth/${youthId}/event_roles`)
        ]);
        const ministries = await minRes.json();
        const eventRoles = await evtRes.json();

        let html = '';
        if(ministries.length > 0) {
            html += `<div style="margin-bottom: 10px;">`;
            ministries.forEach(m => {
                const combinedRole = `${m.role}${m.sub_role ? ' | ' + m.sub_role : ''}`;
                html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color:var(--text-main); font-size: 0.95rem;">🏛️ ${m.ministry_name}</strong>
                    <span style="font-size:11px; color:var(--primary); background: rgba(255,107,0,0.1); padding: 3px 8px; border-radius: 6px; text-align:right;">${combinedRole}</span>
                </div>`;
            });
            html += `</div>`;
        }

        if(eventRoles.length > 0) {
            html += `<div style="margin-top: 10px;">`;
            eventRoles.forEach(er => {
                const combinedRole = `${er.role_name}${er.sub_role ? ' | ' + er.sub_role : ''}`;
                html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div><strong style="color:var(--text-main); font-size: 0.95rem;">📅 ${er.event_name}</strong><br><small style="color:var(--text-muted);">${er.event_date}</small></div>
                    <div style="text-align: right;"><span style="font-size:11px; color:#8B5CF6; background: rgba(139,92,246,0.1); padding: 3px 8px; border-radius: 6px;">${combinedRole}</span></div>
                </div>`;
            });
            html += `</div>`;
        }

        if(html === '') {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No ministry or event roles assigned yet.</p>`;
        } else {
            container.innerHTML = html;
        }
    } catch(e) { console.error('Failed to load profile roles', e); }
};

window.populateProfileTab = async function(member) {
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
    } else {
        avatar.innerHTML = (member.name || 'U').charAt(0).toUpperCase();
    }

    document.getElementById('myQrContainer').innerHTML = '';
    if(member.qr_code) {
        QRCode.toDataURL(member.qr_code, { width: 220 }, function (err, url) {
            if(!err) {
                const img = document.createElement('img'); img.src = url;
                document.getElementById('myQrContainer').appendChild(img);
                const dlBtn = document.getElementById('myDownloadQrBtn');
                if(dlBtn) dlBtn.href = url;
            }
        });
    }

    window.switchMyProfileTab = function(tab) {
        document.getElementById('myProfileTabRoles').style.display = tab === 'roles' ? 'block' : 'none';
        document.getElementById('myProfileTabAttendance').style.display = tab === 'attendance' ? 'block' : 'none';
        document.getElementById('btnMyProfileTabRoles').classList.toggle('active', tab === 'roles');
        document.getElementById('btnMyProfileTabAttendance').classList.toggle('active', tab === 'attendance');
    };

    window.renderMyProfileRoles = function() {
        const container = document.getElementById('myMinistriesHistory');
        const paginator = document.getElementById('myRolesPagination');
        const perPage = 10;
        const totalPages = Math.ceil(modalRolesData.length / perPage) || 1;
        const start = (modalRolesPage - 1) * perPage;
        const paged = modalRolesData.slice(start, start + perPage);

        if (modalRolesData.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No roles assigned yet.</p>`;
            paginator.style.display = 'none';
            return;
        }

        let html = '';
        paged.forEach(item => {
            if (item.type === 'ministry') {
                const combinedRole = `${item.role}${item.sub_role ? ' | ' + item.sub_role : ''}`;
                html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color:var(--text-main); font-size: 0.95rem;">🏛️ ${item.ministry_name}</strong>
                    <span style="font-size:11px; color:var(--primary); background: rgba(255,107,0,0.1); padding: 3px 8px; border-radius: 6px; text-align:right;">${combinedRole}</span>
                </div>`;
            } else {
                const combinedRole = `${item.role_name}${item.sub_role ? ' | ' + item.sub_role : ''}`;
                html += `<div style="padding: 8px 5px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div><strong style="color:var(--text-main); font-size: 0.95rem;">📅 ${item.event_name}</strong><br><small style="color:var(--text-muted);">${item.event_date}</small></div>
                    <div style="text-align: right;"><span style="font-size:11px; color:#8B5CF6; background: rgba(139,92,246,0.1); padding: 3px 8px; border-radius: 6px;">${combinedRole}</span></div>
                </div>`;
            }
        });
        container.innerHTML = html;

        if (modalRolesData.length > 10) {
            paginator.style.display = 'flex';
            paginator.style.justifyContent = 'center';
            paginator.style.gap = '10px';
            paginator.style.alignItems = 'center';
            paginator.innerHTML = `
                <button type="button" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalRolesPage--; renderMyProfileRoles()" ${modalRolesPage === 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="font-size: 0.85rem; color: var(--text-main); white-space: nowrap;">${modalRolesPage} of ${totalPages}</span>
                <button type="button" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalRolesPage++; renderMyProfileRoles()" ${modalRolesPage === totalPages ? 'disabled' : ''}>Next ▶</button>
            `;
        } else {
            paginator.style.display = 'none';
        }
    };

    window.renderMyProfileAttendance = function() {
        const container = document.getElementById('myAttendanceHistory');
        const paginator = document.getElementById('myAttendancePagination');
        const perPage = 10;
        const totalPages = Math.ceil(modalAttData.length / perPage) || 1;
        const start = (modalAttPage - 1) * perPage;
        const paged = modalAttData.slice(start, start + perPage);

        if (modalAttData.length === 0) {
            container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">No attendance history recorded yet.</p>`;
            paginator.style.display = 'none';
            return;
        }

        container.innerHTML = paged.map(h => `
            <div style="border-bottom: 1px solid var(--border-color); padding: 10px 5px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--text-main);">${h.event_name}</strong><br>
                    <small style="color: var(--text-muted);">📅 ${h.event_date}</small>
                </div>
                <div style="text-align: right;">
                    <span class="badge ${h.is_walkin ? 'badge-orange' : 'badge-blue'}" style="font-size: 0.7rem;">${h.is_walkin ? 'Walk-in' : 'Pre-Reg'}</span><br>
                    <small style="color: var(--success); font-weight: bold;">${new Date(h.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
            </div>`).join('');

        if (modalAttData.length > 10) {
            paginator.style.display = 'flex';
            paginator.style.justifyContent = 'center';
            paginator.style.gap = '10px';
            paginator.style.alignItems = 'center';
            paginator.innerHTML = `
                <button type="button" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalAttPage--; renderMyProfileAttendance()" ${modalAttPage === 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="font-size: 0.85rem; color: var(--text-main); white-space: nowrap;">${modalAttPage} of ${totalPages}</span>
                <button type="button" class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="modalAttPage++; renderMyProfileAttendance()" ${modalAttPage === totalPages ? 'disabled' : ''}>Next ▶</button>
            `;
        } else {
            paginator.style.display = 'none';
        }
    };

    try {
        const [minRes, evtRes] = await Promise.all([
            fetch(`/api/youth/${member.id}/ministries`),
            fetch(`/api/youth/${member.id}/event_roles`)
        ]);
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
        window.renderMyProfileRoles();
    } catch(e) { console.error('Failed to load profile roles:', e); }

    try {
        const safeFetch = window.fetch.bind(window);
        const res = await safeFetch(`/api/youth/${member.id}/history`);
        modalAttData = await res.json();
        modalAttPage = 1;
        window.renderMyProfileAttendance();
    } catch(e) { console.error('Failed to load personal history:', e); }

    window.switchMyProfileTab('roles');
};

window.populateAdminProfile = function(username) {
    document.getElementById('myProfileName').innerText = username + " (Administrator)";
    document.getElementById('myProfileCode').innerText = "LEADER ACCOUNT";
    document.getElementById('myEditName').value = username;
    document.getElementById('myEditEmail').value = username;
    document.getElementById('myProfileAvatar').innerHTML = "A";
    document.getElementById('myQrContainer').innerHTML = `<span class="badge badge-orange" style="font-size: 1.1rem; padding: 12px 20px;">AUTHORIZED LEADER</span>`;
    document.getElementById('myMinistriesHistory').innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">Admin System Account. No roles mapped.</p>`;
    document.getElementById('myAttendanceHistory').innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 10px;">Admin System Account. No check-ins mapped.</p>`;
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
                <div><strong>${safeName}</strong><br><small style="color: var(--text-muted);">Age: ${y.age || 'N/A'}</small></div>
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

    const exportBtnHTML = `<button type="button" class="btn btn-outline btn-sm" onclick="exportDirectoryCSV()" style="font-weight: 600; margin-left: 10px;">📤 Export CSV</button>`;

    const totalCountDiv = document.getElementById('directoryTotalCount');
    totalCountDiv.className = '';
    totalCountDiv.style.background = 'transparent';
    totalCountDiv.style.color = 'var(--text-main)';
    totalCountDiv.style.display = 'flex';
    totalCountDiv.style.alignItems = 'center';

    totalCountDiv.innerHTML = `
        <span class="badge badge-orange" style="font-size: 0.85rem; padding: 8px 12px;">${labelText}: ${matches.length}</span>
        ${exportBtnHTML}
    `;

    if (sort === 'name_asc') matches.sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    if (sort === 'name_desc') matches.sort((a,b) => (b.name || '').localeCompare(a.name || ''));
    if (sort === 'age_asc') matches.sort((a,b) => (a.age || 0) - (b.age || 0));
    if (sort === 'age_desc') matches.sort((a,b) => (b.age || 0) - (a.age || 0));

    filteredDir = matches;
    window.renderDirectoryList();
};

window.renderDirectoryList = function() {
    const total = filteredDir.length;
    let totalPages = 1;
    let pagedData = filteredDir;

    if (dirPerPage !== 'all') {
        totalPages = Math.ceil(total / dirPerPage) || 1;
        if (currentDirPage > totalPages) currentDirPage = totalPages;
        if (currentDirPage < 1) currentDirPage = 1;
        const start = (currentDirPage - 1) * dirPerPage;
        pagedData = filteredDir.slice(start, start + dirPerPage);
    } else {
        currentDirPage = 1;
    }

    let html = `<div>`;
    html += pagedData.map(y => {
        const safeName = y.name || 'Unknown';
        const avatarHtml = y.profile_picture ? `<img src="${y.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem; cursor:pointer; flex-shrink: 0;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem; flex-shrink: 0;">${safeName.charAt(0).toUpperCase()}</div>`;

        return `
        <div class="directory-list-item">
            <div class="directory-list-info">
                ${avatarHtml}
                <div class="directory-list-text">
                    <strong class="directory-list-name">${safeName}</strong>
                    <span class="directory-list-meta">Age: ${y.age || 'N/A'} | BDay: ${y.birthday || 'N/A'}</span>
                </div>
            </div>

            <div class="directory-list-actions">
                <button type="button" class="btn btn-primary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="openViewProfileModal(${y.id})">View</button>
                ${window.hasPerm('edit_entries') ? `<button type="button" class="icon-action-btn" onclick="openEditMemberModal(${y.id})" title="Edit">✏️</button>` : ''}
                ${window.hasPerm('delete_entries') ? `<button type="button" class="icon-action-btn" style="color: var(--danger);" onclick="triggerDeleteMember(${y.id}, '${safeName.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>` : ''}
            </div>
        </div>`;
    }).join('');
    html += `</div>`;

    if (total > 0) {
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                <label style="margin: 0; font-size: 0.75rem;">Show:</label>
                <select onchange="changeDirPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;">
                    <option value="10" ${dirPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${dirPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${dirPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="all" ${dirPerPage === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;">
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeDirPage(-1)" ${currentDirPage === 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentDirPage} of ${totalPages}</span>
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeDirPage(1)" ${currentDirPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button>
            </div>
        </div>`;
    }
    document.getElementById('directoryTableContainer').innerHTML = html;
};

window.changeDirPage = function(delta) { currentDirPage += delta; window.renderDirectoryList(); };
window.changeDirPerPage = function(val) { dirPerPage = val === 'all' ? 'all' : parseInt(val); currentDirPage = 1; window.renderDirectoryList(); };

window.exportDirectoryCSV = function() {
    if(!filteredDir || filteredDir.length === 0) return alert('No directory entries to export based on current filter.');
    const rows = [['Member ID', 'Name', 'Email', 'Age', 'Birthday', 'Mobile', 'Parents', 'Unique Pass ID']];
    filteredDir.forEach(m => rows.push([m.id, `"${m.name || ''}"`, `"${m.email || ''}"`, m.age || '', `"${m.birthday || ''}"`, `"${m.mobile || ''}"`, `"${m.parents_name || ''}"`, `"${m.qr_code || ''}"`]));
    window.downloadCSV(rows, 'Community_Directory.csv');
};

window.openAddMemberModal = function() {
    document.getElementById('addMemberForm').reset();
    document.getElementById('addMemberModal').classList.add('active');
};

window.closeAddMemberModal = function() {
    document.getElementById('addMemberModal').classList.remove('active');
};

window.submitNewMember = async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('addMemberProfilePic');
    let picBase64 = null;
    if (fileInput && fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('addMemberName').value, age: document.getElementById('addMemberAge').value,
        birthday: document.getElementById('addMemberBirthday').value, email: document.getElementById('addMemberEmail').value,
        mobile: document.getElementById('addMemberMobile').value, social_media: document.getElementById('addMemberSocial').value,
        parents_name: document.getElementById('addMemberParents').value, profile_picture: picBase64, actor: currentUser
    };

    window.triggerActionConfirmation(`Register ${payload.name} into the directory?`, async () => {
        try {
            const res = await fetch('/api/youth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.id) {
                alert(`Successfully registered ${payload.name}!\nUnique Pass ID: ${data.qr_code}`);
                window.closeAddMemberModal();
                youthData = []; window.loadDirectory();
            } else {
                alert(data.error || 'Failed to create member.');
            }
        } catch (err) { alert("Network error."); }
    });
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

    const isOwner = currentMember && currentMember.id == youthId;
    const isSuperAdmin = currentUser === 'celsocreeriii@gmail.com';
    const passIdElem = document.getElementById('modalProfileCode');
    const rightPanel = document.querySelector('#viewProfileModal .profile-header-right');

    if (isOwner || isSuperAdmin) {
        passIdElem.innerText = `Unique Pass ID: ${member.qr_code || ''}`;
        passIdElem.style.display = 'inline-block';
        if (rightPanel) rightPanel.style.display = 'flex';

        document.getElementById('modalQrContainer').innerHTML = '';
        if(member.qr_code) {
            QRCode.toDataURL(member.qr_code, { width: 180 }, function (err, url) {
                if(!err) {
                    const img = document.createElement('img'); img.src = url;
                    document.getElementById('modalQrContainer').appendChild(img);
                    const dlBtn = document.getElementById('modalDownloadQrBtn');
                    if(dlBtn) dlBtn.href = url;
                }
            });
        }
    } else {
        passIdElem.style.display = 'none';
        if (rightPanel) rightPanel.style.display = 'none';
    }

    document.getElementById('modalBioSummary').innerHTML = `
        <strong>Email Address:</strong> ${member.email || 'N/A'}<br>
        <strong>Age / Birthday:</strong> ${member.age || 'N/A'} (${member.birthday || 'N/A'})<br>
        <strong>Social Media:</strong> ${member.social_media || 'N/A'}<br>
        <strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}
    `;

    const avatar = document.getElementById('viewModalProfileAvatar');
    if (member.profile_picture) {
        avatar.innerHTML = `<img src="${member.profile_picture}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
    } else {
        avatar.innerHTML = safeName.charAt(0).toUpperCase();
    }

    try {
        const [minRes, evtRes] = await Promise.all([
            fetch(`/api/youth/${youthId}/ministries`),
            fetch(`/api/youth/${youthId}/event_roles`)
        ]);
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
    } catch(e) { console.error('Failed to load modal roles:', e); }

    try {
        const safeFetch = window.fetch.bind(window);
        const res = await safeFetch(`/api/youth/${youthId}/history`);
        modalAttData = await res.json();
        modalAttPage = 1;
        window.renderModalAttendance();
    } catch(e) { console.error('Failed to load modal history:', e); }

    window.switchProfileModalTab('roles');
    const modal = document.getElementById('viewProfileModal');
    if(modal) modal.classList.add('active');
};

window.closeViewProfileModal = function() {
    document.getElementById('viewProfileModal').classList.remove('active');
};

window.loadMinistries = async function() {
    try {
        const res = await fetch('/api/ministries');
        ministriesData = await res.json();
        const container = document.getElementById('ministryListContainer');
        if (ministriesData.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 20px;">No ministries created yet.</p>`;
            return;
        }
        container.innerHTML = ministriesData.map(m => {
            const logoHtml = m.logo ? `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` : `<div style="background: var(--bg-light); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 1.5rem;">🏛️</div>`;
            return `
            <div class="ministry-card" onclick="openMinistryDetailsModal(${m.id})">
                <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 50px; height: 50px; flex-shrink: 0; border: 1px solid var(--border-color); border-radius: 8px;">${logoHtml}</div>
                    <div>
                        <h3 style="color: var(--primary); font-size: 1.2rem; margin-bottom: 2px;">${m.name}</h3>
                        <p style="color: var(--text-muted); font-size: 0.85rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${m.description || 'No description provided'}</p>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 10px;">
                    <span class="badge badge-blue">👥 ${m.member_count || 0} Members</span>
                    <span style="font-size: 0.8rem; color: var(--primary); font-weight: bold;">View Team →</span>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error("Failed to load ministries", e); }
};

window.handleCreateMinistry = async function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('minCreateLogo');
    let logoBase64 = null;
    if (fileInput && fileInput.files.length > 0) logoBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('minCreateName').value,
        description: document.getElementById('minCreateDesc').value,
        logo: logoBase64,
        actor: currentUser
    };
    window.triggerActionConfirmation(`Create new ministry '${payload.name}'?`, async () => {
        try {
            const res = await fetch('/api/ministries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('minCreateName').value = '';
                document.getElementById('minCreateDesc').value = '';
                if(fileInput) fileInput.value = '';
                alert('Ministry created successfully!');
                window.switchMinistrySubTab('list');
            }
        } catch(err) { alert("Network Error"); }
    });
};

window.openEditMinistryModal = function() {
    if (!currentMinistryId) return;
    const m = ministriesData.find(x => x.id === currentMinistryId);
    if (!m) return;
    document.getElementById('editMinName').value = m.name || '';
    document.getElementById('editMinDesc').value = m.description || '';
    document.getElementById('editMinLogo').value = '';
    document.getElementById('editMinistryModal').classList.add('active');
};
window.closeEditMinistryModal = function() { document.getElementById('editMinistryModal').classList.remove('active'); };

window.saveMinistryEdit = async function() {
    if (!currentMinistryId) return;
    const fileInput = document.getElementById('editMinLogo');
    let logoBase64 = undefined;
    if (fileInput && fileInput.files.length > 0) logoBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('editMinName').value,
        description: document.getElementById('editMinDesc').value,
        restricted_notes: document.getElementById('ministryDetailNotes').value,
        actor: currentUser
    };
    if (logoBase64 !== undefined) payload.logo = logoBase64;

    window.triggerActionConfirmation('Save changes to this ministry?', async () => {
        try {
            const res = await fetch(`/api/ministries/${currentMinistryId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) {
                window.closeEditMinistryModal();
                alert('Ministry updated successfully!');
                await window.loadMinistries();
                const m = ministriesData.find(x => x.id === currentMinistryId);
                document.getElementById('ministryDetailTitle').innerText = m.name;
                document.getElementById('ministryDetailDesc').innerText = m.description;
                const logoCont = document.getElementById('ministryDetailLogoContainer');
                if (m.logo) {
                    logoCont.innerHTML = `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    logoCont.style.display = 'block';
                }
            }
        } catch(err) { alert("Network Error"); }
    });
};

window.openMinistryDetailsModal = async function(id) {
    currentMinistryId = id;
    const m = ministriesData.find(x => x.id === id);
    if (!m) return;

    document.getElementById('ministryDetailTitle').innerText = m.name;
    document.getElementById('ministryDetailDesc').innerText = m.description || '';

    const logoCont = document.getElementById('ministryDetailLogoContainer');
    if (m.logo) {
        logoCont.innerHTML = `<img src="${m.logo}" style="width: 100%; height: 100%; object-fit: cover; cursor:pointer;" onclick="openImageViewer(this.src)">`;
        logoCont.style.display = 'block';
    } else {
        logoCont.style.display = 'none';
    }

    const btnEditMin = document.getElementById('btnEditMinistryConfig');
    if (btnEditMin) btnEditMin.style.display = window.hasPerm('edit_entries') ? 'inline-block' : 'none';

    const notesSection = document.getElementById('ministryRestrictedSection');
    if (window.hasPerm('edit_entries')) {
        notesSection.style.display = 'block';
        document.getElementById('ministryDetailNotes').value = m.restricted_notes || '';
    } else {
        notesSection.style.display = 'none';
    }

    const assignControls = document.getElementById('ministryAssignControls');
    assignControls.style.display = window.hasPerm('add_entries') ? 'block' : 'none';
    document.getElementById('minSearchInput').value = '';
    document.getElementById('minSelectedUserId').value = '';
    document.getElementById('minSubRoleInput').value = '';

    await window.loadMinistryRoster(id);
    document.getElementById('ministryDetailsModal').classList.add('active');
};

window.closeMinistryDetailsModal = function() {
    document.getElementById('ministryDetailsModal').classList.remove('active');
    currentMinistryId = null;
};

window.saveMinistryNotes = async function() {
    if (!currentMinistryId) return;
    const m = ministriesData.find(x => x.id === currentMinistryId);
    const notes = document.getElementById('ministryDetailNotes').value;
    const payload = { name: m.name, description: m.description, restricted_notes: notes, actor: currentUser };

    window.triggerActionConfirmation('Save restricted notes for this ministry?', async () => {
        const res = await fetch(`/api/ministries/${currentMinistryId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if (res.ok) {
            m.restricted_notes = notes;
            alert('Notes saved successfully!');
        }
    });
};

window.loadMinistryRoster = async function(id) {
    try {
        const res = await fetch(`/api/ministries/${id}/members`);
        const roster = await res.json();
        const container = document.getElementById('ministryRosterContainer');
        if (roster.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:15px;">No members assigned to this ministry yet.</p>`;
            return;
        }

        const hierarchy = ["Ministry Head", "Assistant Ministry Head", "Youth Ministry Head", "Core Member", "Member", "Integration Period"];
        roster.sort((a, b) => {
            let idxA = hierarchy.indexOf(a.role);
            let idxB = hierarchy.indexOf(b.role);
            if (idxA === -1) idxA = 99;
            if (idxB === -1) idxB = 99;
            return idxA - idxB;
        });

        container.innerHTML = roster.map(r => {
            const safeName = r.name || 'Unknown';
            const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`;
            const editBtn = window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 4px 8px; margin-right: 5px;" onclick="openEditMinistryRoleModal(${r.mapping_id}, '${r.role}', '${(r.sub_role||'').replace(/'/g, "\\'")}')">✏️ Edit</button>` : '';
            const delBtn = window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="removeMinistryRole(${r.mapping_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>` : '';
            const combinedRole = `${r.role}${r.sub_role ? ' | ' + r.sub_role : ''}`;

            return `
            <div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${avatarHtml}
                    <div>
                        <strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong>
                        <span style="font-size:11px; color:var(--primary); background: rgba(255,107,0,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${combinedRole}</span>
                    </div>
                </div>
                <div style="text-align: right;">${editBtn}${delBtn}</div>
            </div>`;
        }).join('');
    } catch(e) { console.error("Roster load error", e); }
};

window.filterMinistrySearch = async function() {
    const q = document.getElementById('minSearchInput').value.toLowerCase().trim();
    const dropdown = document.getElementById('minSearchDropdown');
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }

    const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q)));
    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(y => `
            <div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="selectMinistryUser(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')">
                <strong style="color:var(--text-main);">${y.name || 'Unknown'}</strong>
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No matches</div>`;
        dropdown.style.display = 'block';
    }
};

window.selectMinistryUser = function(id, name) {
    document.getElementById('minSelectedUserId').value = id;
    document.getElementById('minSearchInput').value = name;
    document.getElementById('minSearchDropdown').style.display = 'none';
};

window.assignMinistryRole = async function() {
    const youthId = document.getElementById('minSelectedUserId').value;
    const role = document.getElementById('minRoleSelect').value;
    const subRole = document.getElementById('minSubRoleInput').value.trim();
    if (!youthId || !currentMinistryId) return alert('Please search and select a member first.');

    try {
        const payload = { youth_id: youthId, role: role, sub_role: subRole, actor: currentUser };
        const res = await fetch(`/api/ministries/${currentMinistryId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('minSearchInput').value = '';
            document.getElementById('minSelectedUserId').value = '';
            document.getElementById('minSubRoleInput').value = '';
            window.loadMinistryRoster(currentMinistryId);
            window.loadMinistries();
        } else alert(data.error || 'Failed to assign role. (They may already be in this ministry)');
    } catch(e) { alert('Connection error.'); }
};

window.openEditMinistryRoleModal = function(mappingId, role, subRole) {
    document.getElementById('editMinRoleMappingId').value = mappingId;
    document.getElementById('editMinRoleSelect').value = role;
    document.getElementById('editMinSubRoleInput').value = subRole;
    document.getElementById('editMinistryRoleModal').classList.add('active');
};
window.closeEditMinistryRoleModal = function() { document.getElementById('editMinistryRoleModal').classList.remove('active'); };

window.saveMinistryRoleEdit = async function() {
    const mappingId = document.getElementById('editMinRoleMappingId').value;
    const payload = {
        role: document.getElementById('editMinRoleSelect').value,
        sub_role: document.getElementById('editMinSubRoleInput').value,
        actor: currentUser
    };
    try {
        const res = await fetch(`/api/ministries/${currentMinistryId}/members/${mappingId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            window.closeEditMinistryRoleModal();
            window.loadMinistryRoster(currentMinistryId);
            window.loadMinistries();
        }
    } catch(e) { alert("Error saving role changes."); }
};

window.removeMinistryRole = function(mappingId, name) {
    window.triggerActionConfirmation(`Remove ${name} from this ministry?`, async () => {
        try {
            const res = await fetch(`/api/ministries/${currentMinistryId}/members/${mappingId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
            if (res.ok) {
                window.loadMinistryRoster(currentMinistryId);
                window.loadMinistries();
            }
        } catch(err) { alert("Network Error"); }
    });
};

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
        document.getElementById('preregNewName').value = '';
        document.getElementById('preregNewAge').value = '';
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

window.setEventViewMode = function(mode) {
    eventViewMode = mode;
    const btnList = document.getElementById('viewBtnList');
    if (btnList) btnList.classList.toggle('active', mode === 'list');
    const btnGrid = document.getElementById('viewBtnGrid');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    const btnCal = document.getElementById('viewBtnCal');
    if (btnCal) btnCal.classList.toggle('active', mode === 'calendar');

    const calControls = document.getElementById('calendarControls');
    if (calControls) calControls.style.display = mode === 'calendar' ? 'flex' : 'none';

    const container = document.getElementById('eventsListContainer');
    if (!container) return;

    if (eventsData.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No events published yet.</p>';
        return;
    }

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
};

window.loadEvents = async function() {
    try {
        const res = await fetch('/api/events');
        eventsData = await res.json();
        const dropdown = document.getElementById('activeEventDropdown');
        if (dropdown) {
            dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
            if (eventsData.length > 0) {
                window.updateActiveEventBanner();
            } else {
                const counters = document.getElementById('checkinCounters');
                if (counters) counters.style.display = 'none';
            }
        }
        window.setEventViewMode(eventViewMode);
    } catch(e) { console.error("Failed loading events.", e); }
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

    filteredAtt = matches;
    window.renderAttendanceTable();
};

window.renderAttendanceTable = function() {
    const total = filteredAtt.length;
    let totalPages = 1;
    let pagedData = filteredAtt;

    if (attPerPage !== 'all') {
        totalPages = Math.ceil(total / attPerPage) || 1;
        if (currentAttPage > totalPages) currentAttPage = totalPages;
        if (currentAttPage < 1) currentAttPage = 1;
        const start = (currentAttPage - 1) * attPerPage;
        pagedData = filteredAtt.slice(start, start + attPerPage);
    } else {
        currentAttPage = 1;
    }

    let html = `<table class="responsive-table">
        <thead>
            <tr><th>Member</th><th class="hide-mobile">Event</th><th class="hide-mobile">Time</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>`;
    html += pagedData.map(l => `
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

    if (total > 0) {
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                <label style="margin: 0; font-size: 0.75rem;">Show:</label>
                <select onchange="changeAttPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;">
                    <option value="10" ${attPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${attPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${attPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="all" ${attPerPage === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;">
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeAttPage(-1)" ${currentAttPage === 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentAttPage} of ${totalPages}</span>
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeAttPage(1)" ${currentAttPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button>
            </div>
        </div>`;
    }
    document.getElementById('attendanceLogsContainer').innerHTML = html;
};

window.changeAttPage = function(delta) { currentAttPage += delta; window.renderAttendanceTable(); };
window.changeAttPerPage = function(val) { attPerPage = val === 'all' ? 'all' : parseInt(val); currentAttPage = 1; window.renderAttendanceTable(); };

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

    filteredAct = matches;
    window.renderActivityTable();
};

window.renderActivityTable = function() {
    const total = filteredAct.length;
    let totalPages = 1;
    let pagedData = filteredAct;

    if (actPerPage !== 'all') {
        totalPages = Math.ceil(total / actPerPage) || 1;
        if (currentActPage > totalPages) currentActPage = totalPages;
        if (currentActPage < 1) currentActPage = 1;
        const start = (currentActPage - 1) * actPerPage;
        pagedData = filteredAct.slice(start, start + actPerPage);
    } else {
        currentActPage = 1;
    }

    let html = `<table class="responsive-table">
        <thead>
            <tr><th>User</th><th class="hide-mobile">Action</th><th>Details</th><th class="hide-mobile">Timestamp</th></tr>
        </thead>
        <tbody>`;
    html += pagedData.map(l => `
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

    if (total > 0) {
        html += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; background: var(--bg-light); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.75rem; flex-wrap: nowrap; overflow-x: auto; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                <label style="margin: 0; font-size: 0.75rem;">Show:</label>
                <select onchange="changeActPerPage(this.value)" style="padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; font-size: 0.75rem;">
                    <option value="10" ${actPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="25" ${actPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${actPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="all" ${actPerPage === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div style="display: flex; gap: 5px; align-items: center; flex-shrink: 0; margin-left: auto;">
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeActPage(-1)" ${currentActPage === 1 ? 'disabled' : ''}>◀ Prev</button>
                <span style="color: var(--text-main); white-space: nowrap; font-size: 0.8rem; padding: 0 4px;">${currentActPage} of ${totalPages}</span>
                <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.75rem;" onclick="changeActPage(1)" ${currentActPage === totalPages || totalPages === 0 ? 'disabled' : ''}>Next ▶</button>
            </div>
        </div>`;
    }
    document.getElementById('activityLogsContainer').innerHTML = html;
};

window.changeActPage = function(delta) { currentActPage += delta; window.renderActivityTable(); };
window.changeActPerPage = function(val) { actPerPage = val === 'all' ? 'all' : parseInt(val); currentActPage = 1; window.renderActivityTable(); };

window.exportActivityLogsCSV = function() {
    if(!cachedActivityLogs || cachedActivityLogs.length === 0) return alert('No activity logs to export.');
    const rows = [['Log ID', 'Timestamp', 'User', 'Action', 'Details']];
    cachedActivityLogs.forEach(l => rows.push([l.id, `"${l.created_at || ''}"`, `"${l.username || ''}"`, `"${l.action || ''}"`, `"${l.details || ''}"`]));
    window.downloadCSV(rows, 'All_Activity_Logs.csv');
};

window.openEditAttendanceModal = function(id, time, isWalkin) {
    document.getElementById('editAttId').value = id;
    document.getElementById('editAttTime').value = time;
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

        window.switchAnalyticsSubTab('overview');

        const eventRoleAssignControls = document.getElementById('eventRoleAssignControls');
        if(eventRoleAssignControls) eventRoleAssignControls.style.display = window.hasPerm('add_entries') ? 'block' : 'none';
        document.getElementById('evtRoleSearchInput').value = '';
        document.getElementById('evtRoleNameInput').value = '';
        document.getElementById('evtRoleSubRoleInput').value = '';
        document.getElementById('evtRoleSelectedUserId').value = '';

        const eventRolesNotesSection = document.getElementById('eventRolesRestrictedSection');
        if (eventRolesNotesSection) {
            if (window.hasPerm('edit_entries')) {
                eventRolesNotesSection.style.display = 'block';
                document.getElementById('eventRolesDetailNotes').value = data.event.roles_restricted_notes || '';
            } else {
                eventRolesNotesSection.style.display = 'none';
            }
        }

        window.filterAnalyticsRoster();
        window.loadEventRoles(eventId);

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

window.saveEventRolesNotes = async function() {
    if (!currentAnalyticsData || !currentAnalyticsData.event) return;
    const eventId = currentAnalyticsData.event.id;
    const notes = document.getElementById('eventRolesDetailNotes').value;
    window.triggerActionConfirmation('Save restricted roles & logistics notes for this event?', async () => {
        try {
            const res = await fetch(`/api/events/${eventId}/roles-notes`, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ roles_restricted_notes: notes, actor: currentUser })
            });
            if (res.ok) {
                currentAnalyticsData.event.roles_restricted_notes = notes;
                alert('Event notes saved successfully!');
                window.loadEvents();
            } else {
                alert('Failed to save notes.');
            }
        } catch(e) { alert("Network Error"); }
    });
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
            if (ageFilter === 'mini' && age > 12) ageMatch = false;
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
                    <small style="color: var(--text-muted);">${r.age ? 'Age: '+r.age : ''}</small>
                </div>
            </div>
            <div style="text-align: right;">${timeText}${actionButtons}</div>
        </div>`;
    }).join('');
};

window.loadEventRoles = async function(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/roles`);
        const roles = await res.json();
        const container = document.getElementById('eventRolesContainer');
        if (roles.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:15px;">No specific roles assigned for this event.</p>`;
            return;
        }
        container.innerHTML = roles.map(r => {
            const safeName = r.name || 'Unknown';
            const avatarHtml = r.profile_picture ? `<img src="${r.profile_picture}" class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem; cursor:pointer;" onclick="openImageViewer(this.src)">` : `<div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${safeName.charAt(0).toUpperCase()}</div>`;
            const editBtn = window.hasPerm('edit_entries') ? `<button type="button" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 4px 8px; margin-right: 5px;" onclick="openEditEventRoleModal(${r.mapping_id}, '${(r.role_name||'').replace(/'/g, "\\'")}', '${(r.sub_role||'').replace(/'/g, "\\'")}')">✏️ Edit</button>` : '';
            const delBtn = window.hasPerm('delete_entries') ? `<button type="button" class="btn btn-danger btn-sm" style="font-size: 10px; padding: 4px 8px;" onclick="removeEventRole(${r.mapping_id}, '${safeName.replace(/'/g, "\\'")}')">🗑️ Remove</button>` : '';
            const combinedRole = `${r.role_name}${r.sub_role ? ' | ' + r.sub_role : ''}`;

            return `
            <div style="padding: 12px 10px; border-bottom: 1px solid var(--bg-light); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${avatarHtml}
                    <div>
                        <strong style="color: var(--text-main); font-size: 0.95rem;">${safeName}</strong>
                        <span style="font-size:11px; color:#8B5CF6; background: rgba(139,92,246,0.1); padding: 3px 8px; border-radius: 6px; margin-left: 8px;">${combinedRole}</span>
                    </div>
                </div>
                <div style="text-align: right;">${editBtn}${delBtn}</div>
            </div>`;
        }).join('');
    } catch(e) { console.error("Event role load error", e); }
};

window.filterEventRoleSearch = async function() {
    const q = document.getElementById('evtRoleSearchInput').value.toLowerCase().trim();
    const dropdown = document.getElementById('evtRoleSearchDropdown');
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    if (youthData.length === 0) { const res = await fetch('/api/youth'); youthData = await res.json(); }

    const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q) || ((y.qr_code || '').toLowerCase().includes(q)));
    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(y => `
            <div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="selectEventRoleUser(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')">
                <strong style="color:var(--text-main);">${y.name || 'Unknown'}</strong>
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No matches</div>`;
        dropdown.style.display = 'block';
    }
};

window.selectEventRoleUser = function(id, name) {
    document.getElementById('evtRoleSelectedUserId').value = id;
    document.getElementById('evtRoleSearchInput').value = name;
    document.getElementById('evtRoleSearchDropdown').style.display = 'none';
};

window.assignEventRole = async function() {
    const youthId = document.getElementById('evtRoleSelectedUserId').value;
    const roleName = document.getElementById('evtRoleNameInput').value.trim();
    const subRole = document.getElementById('evtRoleSubRoleInput').value.trim();
    if (!youthId || !currentAnalyticsData || !currentAnalyticsData.event) return alert('Please search and select a member.');
    if (!roleName) return alert('Please enter a primary role name (e.g., Coordinator, Food).');

    const eventId = currentAnalyticsData.event.id;
    try {
        const payload = { youth_id: youthId, role_name: roleName, sub_role: subRole, actor: currentUser };
        const res = await fetch(`/api/events/${eventId}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('evtRoleSearchInput').value = '';
            document.getElementById('evtRoleSelectedUserId').value = '';
            document.getElementById('evtRoleNameInput').value = '';
            document.getElementById('evtRoleSubRoleInput').value = '';
            window.loadEventRoles(eventId);
        } else alert(data.error || 'Failed to assign role.');
    } catch(e) { alert('Connection error.'); }
};

window.openEditEventRoleModal = function(mappingId, roleName, subRole) {
    document.getElementById('editEvtRoleMappingId').value = mappingId;
    document.getElementById('editEvtRoleNameInput').value = roleName;
    document.getElementById('editEvtSubRoleInput').value = subRole;
    document.getElementById('editEventRoleModal').classList.add('active');
};
window.closeEditEventRoleModal = function() { document.getElementById('editEventRoleModal').classList.remove('active'); };

window.saveEventRoleEdit = async function() {
    const mappingId = document.getElementById('editEvtRoleMappingId').value;
    const eventId = currentAnalyticsData.event.id;
    const payload = {
        role_name: document.getElementById('editEvtRoleNameInput').value,
        sub_role: document.getElementById('editEvtSubRoleInput').value,
        actor: currentUser
    };
    try {
        const res = await fetch(`/api/events/${eventId}/roles/${mappingId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) {
            window.closeEditEventRoleModal();
            window.loadEventRoles(eventId);
        }
    } catch(e) { alert("Error saving role"); }
};

window.removeEventRole = function(mappingId, name) {
    window.triggerActionConfirmation(`Remove ${name}'s role from this event?`, async () => {
        try {
            const eventId = currentAnalyticsData.event.id;
            const res = await fetch(`/api/events/${eventId}/roles/${mappingId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor: currentUser }) });
            if (res.ok) window.loadEventRoles(eventId);
        } catch(err) { alert("Network Error"); }
    });
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
            <div><strong style="color:var(--text-main);">${safeName}</strong></div>
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
            <div><strong style="color:var(--text-main); font-size:1.05rem;">${u.name || 'Unknown'}</strong></div>
            <button type="button" class="btn btn-primary btn-sm" onclick="openAssignPermissionModal(${u.id}, '${(u.name || '').replace(/'/g, "\\'")}')">Click here to register</button>
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
        // Query the active users list to find their specific permissions rather than the youth list
        const res = await fetch('/api/users/list');
        const dbUsers = await res.json();
        const targetUser = dbUsers.find(u => u.youth_id === id);

        let perms = [];
        if (targetUser && targetUser.permissions) {
            try {
                perms = JSON.parse(targetUser.permissions);
            } catch(e) { perms = []; }
        }

        const idElem = document.getElementById('modalPermUserId');
        if(idElem) idElem.value = id;

        const bannerElem = document.getElementById('permModalUserBanner');
        if(bannerElem) bannerElem.innerText = `Assign Permissions for: ${displayName}`;

        document.querySelectorAll('.permCheckModal').forEach(chk => {
            chk.checked = perms.includes(chk.value);
        });

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


window.loadSecretPrayerPal = async function() {
    if (!currentMember || !currentMember.id) return;
    try {
        const res = await fetch('/api/prayer-pals/current/' + currentMember.id);
        const data = await res.json();
        const palNameElem = document.getElementById('pulsePrayerPalName');
        if (palNameElem) {
            palNameElem.innerText = data && data.pal_name ? data.pal_name : "Not assigned yet.";
        }
    } catch(e) {}
};

// ==========================================
// V3 DYNAMIC KOINONIA NAVIGATION PATCH
// ==========================================

// Override standard login routing to go to Home instead of Profile
const _origHandleLogin = window.handleLogin;
window.handleLogin = async function(e) {
    e.preventDefault();
    document.getElementById('globalPreloader').style.display = 'flex';
    document.getElementById('globalPreloader').style.opacity = '1';
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.username; currentMember = data.member; userPermissions = data.permissions || [];
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            window.buildNav();
            if(window.applyGranularPermissions) window.applyGranularPermissions();
            if(window.loadDailyManna) window.loadDailyManna();
            if(window.loadSecretPrayerPal) window.loadSecretPrayerPal();
            switchTab('pulseDashboardTab');
            if(window.renderHomeJourney) window.renderHomeJourney();
        } else { alert(data.message); }
    } catch (err) { alert('Network Error'); }
    finally { 
        document.getElementById('globalPreloader').style.opacity = '0';
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500); 
    }
};

window.checkLoginState = function() {
    const saved = localStorage.getItem('fog_user');
    if (saved) {
        const userObj = JSON.parse(saved);
        currentUser = userObj.username; currentMember = userObj.member; userPermissions = userObj.permissions || [];
        window.buildNav();
        if(window.applyGranularPermissions) window.applyGranularPermissions();
        if(window.loadDailyManna) window.loadDailyManna();
        if(window.loadSecretPrayerPal) window.loadSecretPrayerPal();
        switchTab('pulseDashboardTab');
            if(window.renderHomeJourney) window.renderHomeJourney();
    } else {
        switchTab('loginTab');
        const loader = document.getElementById('globalPreloader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 500); }
    }
};

window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    const isAdmin = window.hasPerm && (window.hasPerm('edit_entries') || currentUser === 'celsocreeriii@gmail.com');
    let bHtml = '';

    if (context === 'arcadeTab') {
        bHtml = `
            <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
            <button class="bottom-nav-btn" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
            <button class="bottom-nav-btn active" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
            <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab')"><span>🌱</span>Grow</button>
            <button class="bottom-nav-btn" onclick="switchTab('leaderboardsHubTab')"><span>🏆</span>Ranks</button>
            <button class="bottom-nav-btn text-danger" onclick="logout()"><span>🚪</span>Logout</button>
        `;
    } else if (context === 'discipleshipTab') {
        bHtml = `
            <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
            <button class="bottom-nav-btn active" onclick="switchTab('discipleshipTab')"><span>🌱</span>Growth</button>
            <button class="bottom-nav-btn" onclick="switchTab('leaderboardsHubTab')"><span>🏆</span>Ranks</button>
            <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
            <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
            <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        `;
    } else {
        // Default View (Home, Profile, etc)
        bHtml = `
            <button class="bottom-nav-btn ${context === 'pulseDashboardTab' ? 'active' : ''}" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
            <button class="bottom-nav-btn ${context === 'profileTab' ? 'active' : ''}" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
            <button class="bottom-nav-btn ${context === 'arcadeTab' ? 'active' : ''}" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
            <button class="bottom-nav-btn ${context === 'discipleshipTab' ? 'active' : ''}" onclick="switchTab('discipleshipTab')"><span>🌱</span>Grow</button>
        `;
        if (isAdmin) {
            bHtml += `<button class="bottom-nav-btn" onclick="openSidebar()"><span>☰</span>Menu</button>`;
        } else {
            bHtml += `<button class="bottom-nav-btn text-danger" onclick="logout()"><span>🚪</span>Logout</button>`;
        }
    }
    bottomNav.innerHTML = bHtml;
};

window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    if (!sidebar) return;
    const isAdmin = window.hasPerm && (window.hasPerm('edit_entries') || currentUser === 'celsocreeriii@gmail.com');

    // Force bottom nav to show for everyone (including Admins)
    const bottomNav = document.getElementById('bottomNav');
    if(bottomNav) bottomNav.style.display = 'flex';

    let sidebarHtml = `
        <div class="sidebar-header">
            <img src="/img/logo.png" alt="Logo" class="fog-header-logo" onerror="this.style.display='none'">
            <h2>FOG V3</h2>
        </div>
        <button class="nav-btn" onclick="switchTab('pulseDashboardTab')">🏠 Home</button>
        <button class="nav-btn" onclick="switchTab('profileTab')">👤 My Profile</button>
        <button class="nav-btn" onclick="switchTab('inboxTab')">🔔 Inbox</button>
        <button class="nav-btn" onclick="switchTab('arcadeTab')">🎯 FOG Arcade</button>
        <button class="nav-btn" onclick="switchTab('discipleshipTab')">🌱 Spiritual Growth</button>
    `;

    if (isAdmin) {
        document.getElementById('hamburgerBtn').style.display = 'block';
        sidebarHtml += `
            <hr style="border-color: #334155; margin: 15px 0;">
            <p style="color: #94A3B8; font-size: 0.75rem; margin-left: 15px; text-transform: uppercase;">Leadership Tools</p>
            <button class="nav-btn" onclick="switchTab('checkinTab')">📸 Event Check-In</button>
            <button class="nav-btn" onclick="switchTab('eventsTab')">📅 Events Admin</button>
            <button class="nav-btn" onclick="switchTab('directoryTab')">👥 Directory</button>
            <button class="nav-btn" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>
            <button class="nav-btn" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>
            <button class="nav-btn" onclick="switchTab('discipleshipAdminTab')">⚙️ Discipleship Admin</button>
            <button class="nav-btn" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>
            <button class="nav-btn" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>
            <button class="nav-btn" onclick="switchTab('permissionsTab')">🔑 Permissions</button>
            <button class="nav-btn" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>
            <button class="nav-btn" onclick="switchTab('activityLogsTab')">📝 Audit Logs</button>
        `;
    } else {
        document.getElementById('hamburgerBtn').style.display = 'none';
    }

    sidebarHtml += `<button class="nav-btn text-danger" onclick="logout()" style="margin-top: auto;">🚪 Logout</button>`;
    sidebar.innerHTML = sidebarHtml;

    // Trigger bottom nav render based on the currently active tab
    const activeTab = document.querySelector('.tab-content.active');
    window.renderBottomNav(activeTab ? activeTab.id : 'pulseDashboardTab');
};

const _originalSwitchTabNav = window.switchTab;
window.switchTab = function(tabId) {
    if (_originalSwitchTabNav) _originalSwitchTabNav(tabId);
    if (window.renderBottomNav) window.renderBottomNav(tabId);
};




// ==========================================
// V14: ABSOLUTE TRUTH MASTER OVERRIDE
// ==========================================

// --- 1. COMMITMENT PLEDGE (I'M READY) ---
window.openCommitmentModal = function() {
    const modal = document.getElementById('commitmentModal');
    if (modal) {
        modal.style.display = 'flex'; // Force bypass CSS
        modal.classList.add('active');
    } else { alert("Error: Commitment modal not found in HTML."); }
};

window.closeCommitmentModal = function() {
    const modal = document.getElementById('commitmentModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

window.submitCommitmentPledge = async function(e) {
    e.preventDefault();
    if (!currentMember) return;
    const msgEl = document.getElementById('commitmentIntentMsg');
    const intentMsg = msgEl ? msgEl.value.trim() : 'I am ready to commit.';

    document.getElementById('globalPreloader').style.display = 'flex';
    document.getElementById('globalPreloader').style.opacity = '1';

    try {
        const res = await fetch(`/api/youth/${currentMember.id}/commit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actor: currentMember.name, intent_message: intentMsg })
        });
        const data = await res.json();

        if (data.success) {
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions || [], member: currentMember }));
            window.closeCommitmentModal();
            if(window.renderHomeJourney) window.renderHomeJourney();
            alert('Welcome to the family! You have successfully committed to Fire of God Ministries.');
        } else { alert('Error: ' + data.error); }
    } catch(err) { alert('Network error while processing your pledge.'); } 
    finally {
        document.getElementById('globalPreloader').style.opacity = '0';
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
    }
};

// --- 2. DYNAMIC HOME JOURNEY ---
window.renderHomeJourney = async function() {
    const container = document.getElementById('dynamicJourneyContainer');
    if (!container || !currentMember) return;
    let html = '';
    if (currentMember.account_tier === 'New Member' || currentMember.account_tier === 'Seeker') {
        html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Step In</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take the next step to officially become a member of our spiritual family.</p></div><button class="btn btn-primary btn-sm" style="background: var(--primary); color: white; border: none;" onclick="openCommitmentModal()">I'm Ready</button>`;
    } else {
        try {
            const res = await fetch('/api/youth/' + currentMember.id + '/ministries');
            const ministries = await res.json();
            const isApplicant = ministries.some(m => m.role === 'Applicant');
            const isActiveMember = ministries.some(m => m.role !== 'Applicant');
            if (isActiveMember) {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Serve & Grow</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Continue your formation</p></div><button class="btn btn-outline btn-sm" style="color: #F59E0B; border-color: #F59E0B;" onclick="openMinistryIntentModal()">Expand Service</button>`;
            } else if (isApplicant) {
                html = `<div><strong style="color: #F59E0B; font-size: 0.95rem;">🙏 Discerning Together</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">We are so excited you want to serve! Our team is currently praying and preparing a space for you.</p></div><button class="btn btn-secondary btn-sm" disabled>Preparing Space</button>`;
            } else {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Discover Your Gifts</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take some time to explore where you might love to serve and share those gifts with the community.</p></div><button class="btn btn-primary btn-sm" style="background: #F59E0B; border: none; color: white;" onclick="openMinistryIntentModal()">Explore Serving</button>`;
            }
        } catch(e) {}
    }
    container.innerHTML = html;
};

// --- 3. PROFILE POPULATOR & QR CODE GENERATOR ---
window.populateProfileTab = async function(member) {
    if (!member) return;
    
    if (!document.getElementById('myEditGender') && document.getElementById('myEditName')) {
        document.getElementById('myEditName').parentElement.insertAdjacentHTML('afterend', `
        <div class="form-group"><label>Gender</label><select id="myEditGender" class="form-control"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>`);
    }

    const bio = document.getElementById('myBioSummary');
    if (bio) {
        bio.innerHTML = `
            <strong>Email:</strong> ${member.email || 'N/A'}<br>
            <strong>Age:</strong> ${member.age || 'N/A'}<br>
            <strong>Gender:</strong> ${member.gender || 'N/A'}<br>
            <strong>Birthday:</strong> ${member.birthday || 'N/A'}<br>
            <strong>Mobile:</strong> ${member.mobile || 'N/A'}<br>
            <strong>Social Media:</strong> ${member.social_media || 'N/A'}<br>
            <strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}
        `;
    }

    ['myMemberId','myEditName','myEditEmail','myEditAge','myEditBirthday','myEditSocial','myEditParents','myEditGender'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let key = id.replace('myEdit', '').toLowerCase();
            if(id === 'myEditParents') key = 'parents_name';
            if(id === 'myEditSocial') key = 'social_media';
            if(id === 'myMemberId') key = 'id';
            el.value = member[key] || '';
        }
    });
    
    if(document.getElementById('myProfileName')) document.getElementById('myProfileName').innerText = member.name || 'Community Member';
    
    // 🔥 THE QR CODE IMAGE GENERATOR
    const codeEl = document.getElementById('myProfileCode');
    if (codeEl) {
        codeEl.className = ""; // Remove orange badge class
        codeEl.style.textAlign = 'center';
        if (member.qr_code) {
            codeEl.innerHTML = `<br><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(member.qr_code)}" alt="QR" style="border-radius:8px; padding:5px; background:white; margin-top:5px; border:2px solid var(--primary);"><br><span style="font-weight:bold; font-size:1.05rem; margin-top:5px; display:inline-block; color:var(--text-main);">${member.qr_code}</span>`;
        } else {
            codeEl.innerText = 'No QR Assigned';
        }
    }
    
    const av = document.getElementById('myProfileAvatar');
    if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';
    
    if (window.loadMyV3Roles) window.loadMyV3Roles(member.id, 'myMinistriesHistory');
    if (window.loadMyV3Attendance) window.loadMyV3Attendance(member.id, 'myAttendanceHistory');
    if (window.renderHomeJourney) window.renderHomeJourney(); 
};

// --- 4. FRESH CACHE SYNC ON PROFILE TAB CLICK ---
if (!window.switchTab.isV14Patched) {
    const origSwitchTab = window.switchTab;
    window.switchTab = async function(tabId) {
        if(origSwitchTab) origSwitchTab(tabId);
        
        if (tabId === 'profileTab' && typeof currentMember !== 'undefined' && currentMember) {
            try {
                const res = await fetch('/api/youth');
                const users = await res.json();
                const fresh = users.find(u => u.id == currentMember.id);
                if (fresh && window.populateProfileTab) window.populateProfileTab(fresh);
            } catch(e) {}
        }
    };
    window.switchTab.isV14Patched = true;
}

// --- 5. ROLES & HIERARCHY ---
window.switchMyProfileTab = function(tabId) {
    document.querySelectorAll('#btnMyProfileTabRoles, #btnMyProfileTabSchedule, #btnMyProfileTabAttendance').forEach(b => b.classList.remove('active'));
    ['Roles', 'Schedule', 'Attendance'].forEach(t => {
        const el = document.getElementById('myProfileTab' + t);
        if(el) el.style.display = 'none';
    });
    
    if (tabId === 'roles') {
        document.getElementById('btnMyProfileTabRoles').classList.add('active');
        document.getElementById('myProfileTabRoles').style.display = 'block';
        if (window.loadMyV3Roles) window.loadMyV3Roles();
    } else if (tabId === 'attendance') {
        document.getElementById('btnMyProfileTabAttendance').classList.add('active');
        document.getElementById('myProfileTabAttendance').style.display = 'block';
        if (window.loadMyV3Attendance) window.loadMyV3Attendance();
    } else if (tabId === 'schedule') {
        document.getElementById('btnMyProfileTabSchedule').classList.add('active');
        document.getElementById('myProfileTabSchedule').style.display = 'block';
    }
};

window.loadMyV3Roles = async function(targetMemberId, containerId) {
    const id = targetMemberId || (typeof currentMember !== 'undefined' && currentMember ? currentMember.id : null);
    const cId = containerId || 'myMinistriesHistory';
    const container = document.getElementById(cId);
    if (!container || !id) return;
    
    container.innerHTML = '<div style="text-align:center; padding:10px; color:var(--text-muted);">Loading roles...</div>';
    try {
        const [minRes, evtRes] = await Promise.all([ fetch('/api/youth/' + id + '/ministries'), fetch('/api/youth/' + id + '/event_roles') ]);
        const ministries = await minRes.json(); const events = await evtRes.json();
        
        let allRoles = [];
        if(ministries && ministries.length) ministries.forEach(m => allRoles.push({...m, type: 'ministry'}));
        if(events && events.length) events.forEach(e => allRoles.push({...e, type: 'event'}));
        if (allRoles.length === 0) return container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">No roles assigned yet.</div>'; 
        
        // 🔥 HIERARCHY: Ministry First, Event Second, Then Date
        allRoles.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'ministry' ? -1 : 1;
            return new Date(b.assigned_at) - new Date(a.assigned_at);
        });
        
        container.innerHTML = allRoles.map(r => {
            const isPriority = r.is_priority === 1;
            const priorityBadge = isPriority ? '<span style="background:#FEF3C7; color:#D97706; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:8px;">⭐ Priority</span>' : '';
            const badge = r.type === 'ministry' ? '<span class="badge badge-blue">🏛️ Ministry</span>' : '<span class="badge badge-orange">📅 Event</span>';
            const title = r.type === 'ministry' ? r.ministry_name : r.event_name;
            const actionBtn = (r.type === 'ministry' && r.role !== 'Applicant' && !isPriority && currentMember && id == currentMember.id && cId === 'myMinistriesHistory') 
                ? `<button class="btn btn-outline btn-sm" style="margin-top:10px; font-size:0.75rem;" onclick="setCorePriority(${r.mapping_id})">Make Core Priority</button>` : '';
            
            return `<div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${isPriority ? '#F59E0B' : 'var(--border-color)'};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;"><strong style="color: var(--primary); font-size: 1.05rem;">${title || 'Unknown'} ${priorityBadge}</strong>${badge}</div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;"><strong>Role:</strong> ${r.role || r.role_name} ${r.sub_role ? ' | '+r.sub_role : ''}</div>${actionBtn}
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = '<div style="color:var(--danger); text-align:center;">Failed to load roles.</div>'; }
};

window.loadMyV3Attendance = async function() {
    let container = document.getElementById('myAttendanceHistory');
    if (!container) {
        const parent = document.getElementById('myProfileTabAttendance');
        if (parent) { parent.innerHTML = '<div class="card" style="margin-bottom: 0;"><div id="myAttendanceHistory" style="padding: 5px;"></div></div>'; container = document.getElementById('myAttendanceHistory'); }
    }
    if (!container || !currentMember) return;
    try {
        const res = await fetch('/api/youth/' + currentMember.id + '/history');
        const logs = await res.json();
        if (!logs || logs.length === 0) return container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No participation logs found.</div>';
        container.innerHTML = logs.map(a => `<div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;"><div><strong style="color: var(--primary); font-size: 1.05rem;">${a.event_name || 'Event'}</strong><br><small style="color:var(--text-muted);">${a.checked_in_at || ''}</small></div>${a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>'}</div>`).join('');
    } catch(e) {}
};

// --- 6. DIRECTORY "VIEW PROFILE" MODAL (Forced Open) ---
window.viewProfile = async function(id) {
    try {
        document.getElementById('globalPreloader').style.display = 'flex';
        document.getElementById('globalPreloader').style.opacity = '1';

        const res = await fetch('/api/youth');
        const users = await res.json();
        const member = users.find(u => u.id == id);
        if (!member) {
            document.getElementById('globalPreloader').style.opacity = '0';
            setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
            return alert('Member not found.');
        }
        
        const safeText = (val) => val || 'N/A';
        if(document.getElementById('viewProfileName')) document.getElementById('viewProfileName').innerText = member.name || 'Unknown';
        if(document.getElementById('viewProfileAge')) document.getElementById('viewProfileAge').innerText = safeText(member.age);
        if(document.getElementById('viewProfileEmail')) document.getElementById('viewProfileEmail').innerText = safeText(member.email);
        if(document.getElementById('viewProfileMobile')) document.getElementById('viewProfileMobile').innerText = safeText(member.mobile);
        if(document.getElementById('viewProfileSocial')) document.getElementById('viewProfileSocial').innerText = safeText(member.social_media);
        if(document.getElementById('viewProfileBirthday')) document.getElementById('viewProfileBirthday').innerText = safeText(member.birthday);
        if(document.getElementById('viewProfileParents')) document.getElementById('viewProfileParents').innerText = safeText(member.parents_name);
        
        const av = document.getElementById('viewProfileAvatar');
        if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

        const modal = document.getElementById('viewProfileModal');
        if(modal) {
            modal.style.display = 'flex'; // Force bypass CSS conflicts
            modal.classList.add('active');
        }
    } catch(e) {
        alert("Network error.");
    } finally {
        document.getElementById('globalPreloader').style.opacity = '0';
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
    }
};

window.closeViewProfileModal = function() {
    const modal = document.getElementById('viewProfileModal');
    if(modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

// --- 7. MODERATION DASHBOARD OBSERVER ---
window.loadPendingApplications = async function() {
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();
        
        let board = document.getElementById('pendingApplicationsBoard');
        if (!apps || apps.length === 0) { if (board) board.style.display = 'none'; return; }

        if (!board) {
            const minTab = document.getElementById('ministriesTab');
            if (minTab) {
                const h2 = minTab.querySelector('h2');
                const ui = `<div id="pendingApplicationsBoard" style="margin-bottom: 25px; background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02);"><h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Expressions</h3><div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px;"></div></div>`;
                if (h2) h2.insertAdjacentHTML('afterend', ui); else minTab.insertAdjacentHTML('afterbegin', ui);
                board = document.getElementById('pendingApplicationsBoard');
            }
        }
        if (!board) return;
        board.style.display = 'block';

        const list = document.getElementById('pendingApplicationsList');
        if (!list) return;
        list.innerHTML = apps.map(app => `<div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;"><div style="flex: 1; min-width: 200px;"><strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong><span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span><p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p></div><div style="display: flex; gap: 8px;"><button class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button><button class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button></div></div></div>`).join('');
    } catch(e) {}
};

const secureMinistriesTab = () => {
    const minTab = document.getElementById('ministriesTab');
    if (!minTab) return;
    const observer = new MutationObserver(() => {
        if (!document.getElementById('pendingApplicationsBoard') && window.loadPendingApplications) window.loadPendingApplications();
    });
    observer.observe(minTab, { childList: true, subtree: true });
};
document.addEventListener('DOMContentLoaded', secureMinistriesTab);

window.logout = async function() {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        if (typeof currentUser !== 'undefined' && currentUser) { await fetch('/api/logout', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: currentUser}) }); }
        localStorage.removeItem('fog_user'); window.location.reload();
    } catch(e) { localStorage.removeItem('fog_user'); window.location.reload(); }
};


// ==========================================
// V15: ABSOLUTE PERFECTION OVERRIDE
// ==========================================

// 1. REPAIR QR PLACEMENT
window.populateProfileTab = async function(member) {
    if (!member) return;
    
    if (!document.getElementById('myEditGender') && document.getElementById('myEditName')) {
        document.getElementById('myEditName').parentElement.insertAdjacentHTML('afterend', `
        <div class="form-group"><label>Gender</label><select id="myEditGender" class="form-control"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>`);
    }

    const bio = document.getElementById('myBioSummary');
    if (bio) {
        bio.innerHTML = `<strong>Email:</strong> ${member.email || 'N/A'}<br><strong>Age:</strong> ${member.age || 'N/A'}<br><strong>Gender:</strong> ${member.gender || 'N/A'}<br><strong>Birthday:</strong> ${member.birthday || 'N/A'}<br><strong>Mobile:</strong> ${member.mobile || 'N/A'}<br><strong>Social Media:</strong> ${member.social_media || 'N/A'}<br><strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}`;
    }

    ['myMemberId','myEditName','myEditEmail','myEditAge','myEditBirthday','myEditSocial','myEditParents','myEditGender'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let key = id.replace('myEdit', '').toLowerCase();
            if(id === 'myEditParents') key = 'parents_name';
            if(id === 'myEditSocial') key = 'social_media';
            if(id === 'myMemberId') key = 'id';
            el.value = member[key] || '';
        }
    });
    
    if(document.getElementById('myProfileName')) document.getElementById('myProfileName').innerText = member.name || 'Community Member';
    
    // 🔥 TARGET EXACT HTML QR PLACEHOLDER
    const qrContainer = document.getElementById('myQrContainer');
    const dlBtn = document.getElementById('myDownloadQrBtn');
    if (qrContainer && dlBtn) {
        if (member.qr_code) {
            const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(member.qr_code);
            qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:100%; height:auto; border-radius:8px;">`;
            dlBtn.href = qrUrl;
            dlBtn.style.display = 'inline-block';
        } else {
            qrContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No QR Assigned</span>';
            dlBtn.style.display = 'none';
        }
    }
    
    const av = document.getElementById('myProfileAvatar');
    if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';
    
    if (window.loadMyV3Roles) window.loadMyV3Roles(member.id, 'myMinistriesHistory');
    if (window.loadMyV3Attendance) window.loadMyV3Attendance();
    if (window.renderHomeJourney) window.renderHomeJourney(); 
};

// 2. REPAIR DIRECTORY MODAL
window.viewProfile = async function(id) {
    try {
        document.getElementById('globalPreloader').style.display = 'flex';
        document.getElementById('globalPreloader').style.opacity = '1';

        const res = await fetch('/api/youth');
        const users = await res.json();
        // Loose equality to catch string-to-int mismatches
        const member = users.find(u => String(u.id) === String(id));
        if (!member) {
            document.getElementById('globalPreloader').style.opacity = '0';
            setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
            return alert('Member not found.');
        }
        
        const safeText = (val) => val || 'N/A';
        
        // Populate all possible fields securely
        ['viewProfileName','viewProfileAge','viewProfileEmail','viewProfileMobile','viewProfileSocial','viewProfileBirthday','viewProfileParents'].forEach(fieldId => {
             let key = fieldId.replace('viewProfile', '').toLowerCase();
             if(key === 'parents') key = 'parents_name';
             if(key === 'social') key = 'social_media';
             if(document.getElementById(fieldId)) document.getElementById(fieldId).innerText = safeText(member[key]);
        });
        
        // Target specific Version 1 Avatar ID
        const av1 = document.getElementById('viewModalProfileAvatar');
        const avHtml = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';
        if (av1) av1.innerHTML = avHtml;

        // Target specific Version 1 QR Pass modal section
        const mQrContainer = document.getElementById('modalQrContainer');
        const mDlBtn = document.getElementById('modalDownloadQrBtn');
        const mQrWrap = document.getElementById('modalQrSectionWrapper');
        if (mQrContainer && mDlBtn && mQrWrap) {
             if (member.qr_code) {
                 const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(member.qr_code);
                 mQrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:150px; height:150px; border-radius:8px;">`;
                 mDlBtn.href = qrUrl;
                 mQrWrap.style.display = 'block';
             } else {
                 mQrWrap.style.display = 'none';
             }
        }

        const modal = document.getElementById('viewProfileModal');
        if(modal) {
            modal.style.display = 'block';
            modal.classList.add('active');
        }
    } catch(e) {
        alert("Network error.");
    } finally {
        document.getElementById('globalPreloader').style.opacity = '0';
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
    }
};

window.closeViewProfileModal = function() {
    const modal = document.getElementById('viewProfileModal');
    if(modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

// 3. REPAIR MODERATION DASHBOARD (Targeting hardcoded HTML)
window.loadPendingApplications = async function() {
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();
        
        let board = document.getElementById('pendingApplicationsBoard');
        if (!board) return; // Failsafe

        if (!apps || apps.length === 0) { 
            board.style.display = 'none'; 
            return; 
        }

        board.style.display = 'block';
        const list = document.getElementById('pendingApplicationsList');
        if (!list) return;
        
        list.innerHTML = apps.map(app => `<div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;"><div style="flex: 1; min-width: 200px;"><strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong><span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span><p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p></div><div style="display: flex; gap: 8px;"><button class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button><button class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button></div></div></div>`).join('');
    } catch(e) {}
};

window.openCommitmentModal = function() {
    const modal = document.getElementById('commitmentModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
    } else {
        alert('Commitment Modal HTML not found!');
    }
};

// === V16: DIRECTORY, MODAL FREEZE, & BOARD FIX ===

// 1. DIRECTORY "VIEW" BUTTON FIX (Matches the exact HTML onclick)
window.openViewProfileModal = async function(id) {
    try {
        document.getElementById('globalPreloader').style.display = 'flex';
        document.getElementById('globalPreloader').style.opacity = '1';

        const res = await fetch('/api/youth');
        const users = await res.json();
        const member = users.find(u => String(u.id) === String(id));
        
        if (!member) {
            document.getElementById('globalPreloader').style.opacity = '0';
            setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
            return alert('Member not found.');
        }
        
        const safeText = (val) => val || 'N/A';
        ['viewProfileName','viewProfileAge','viewProfileEmail','viewProfileMobile','viewProfileSocial','viewProfileBirthday','viewProfileParents'].forEach(fieldId => {
             let key = fieldId.replace('viewProfile', '').toLowerCase();
             if(key === 'parents') key = 'parents_name';
             if(key === 'social') key = 'social_media';
             if(document.getElementById(fieldId)) document.getElementById(fieldId).innerText = safeText(member[key]);
        });
        
        const av1 = document.getElementById('viewModalProfileAvatar');
        if (av1) av1.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

        const mQrContainer = document.getElementById('modalQrContainer');
        const mDlBtn = document.getElementById('modalDownloadQrBtn');
        const mQrWrap = document.getElementById('modalQrSectionWrapper');
        if (mQrContainer && mDlBtn && mQrWrap) {
             if (member.qr_code) {
                 const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(member.qr_code);
                 mQrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:150px; height:150px; border-radius:8px;">`;
                 mDlBtn.href = qrUrl;
                 mQrWrap.style.display = 'block';
             } else {
                 mQrWrap.style.display = 'none';
             }
        }

        const modal = document.getElementById('viewProfileModal');
        if(modal) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // LOCK BACKGROUND SCROLL
        }
    } catch(e) {
        alert("Network error.");
    } finally {
        document.getElementById('globalPreloader').style.opacity = '0';
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500);
    }
};

window.closeViewProfileModal = function() {
    const modal = document.getElementById('viewProfileModal');
    if(modal) {
        modal.style.display = '';
        modal.classList.remove('active');
        document.body.style.overflow = ''; // UNFREEZE BACKGROUND SCROLL
    }
};

// 2. MODAL FREEZE FIX ("I'M READY" MODAL)
window.openCommitmentModal = function() {
    const modal = document.getElementById('commitmentModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // LOCK BACKGROUND SCROLL
    }
};

window.closeCommitmentModal = function() {
    const modal = document.getElementById('commitmentModal');
    if (modal) {
        modal.style.display = '';
        modal.classList.remove('active');
        document.body.style.overflow = ''; // UNFREEZE BACKGROUND SCROLL
    }
};

// 3. MODERATION DASHBOARD FIX (Intercept native loadMinistries)
if (!window.loadMinistries.isV16Patched) {
    const origLoadMinistries = window.loadMinistries;
    window.loadMinistries = async function(...args) {
        if(origLoadMinistries) await origLoadMinistries.apply(this, args);
        if(window.loadPendingApplications) window.loadPendingApplications(); // RUN AFTER WIPE
    };
    window.loadMinistries.isV16Patched = true;
}

window.loadPendingApplications = async function() {
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();
        
        // Delete old board to prevent duplicate injection
        const oldBoard = document.getElementById('pendingApplicationsBoard');
        if (oldBoard) oldBoard.remove();

        if (!apps || apps.length === 0) return;

        const minTab = document.getElementById('ministriesTab');
        if (!minTab) return;

        let appsHtml = '';
        apps.forEach(app => {
            appsHtml += `
            <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                    <div style="flex: 1; min-width: 200px;">
                        <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                        <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                        <button class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplication(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                    </div>
                </div>
            </div>`;
        });

        const ui = `
        <div id="pendingApplicationsBoard" style="margin-bottom: 25px; background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Expressions</h3>
            <div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px;">
                ${appsHtml}
            </div>
        </div>`;
        
        const h2 = minTab.querySelector('h2');
        if (h2) h2.insertAdjacentHTML('afterend', ui);
        else minTab.insertAdjacentHTML('afterbegin', ui);
        
    } catch(e) {}
};

// ==========================================
// V24: UNIFIED DIRECTORY PROFILE & FREEZE FIX (CLEAN)
// ==========================================
window.openViewProfileModal = async function(id) {
    try {
        document.getElementById('globalPreloader').style.display = 'flex';
        document.getElementById('globalPreloader').style.opacity = '1';

        // Fetch User and their specific history
        const [usersRes, minRes, evtRes, histRes] = await Promise.all([
            fetch('/api/youth'),
            fetch('/api/youth/' + id + '/ministries'),
            fetch('/api/youth/' + id + '/event_roles'),
            fetch('/api/youth/' + id + '/history')
        ]);

        const users = await usersRes.json();
        const member = users.find(u => String(u.id) === String(id));
        if (!member) throw new Error('Member not found.');

        const ministries = await minRes.json();
        const events = await evtRes.json();
        const history = await histRes.json();

        // Merge Roles
        let allRoles = [];
        if(ministries && ministries.length) ministries.forEach(m => allRoles.push({...m, type: 'ministry'}));
        if(events && events.length) events.forEach(e => allRoles.push({...e, type: 'event'}));
        allRoles.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));

        const safeText = (val) => val || 'N/A';
        const avatarHtml = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

        // Completely replace the modal's innerHTML to ensure a pristine layout matching "My Profile"
        let modalHtml = `
        <div class="modal-content" style="max-width: 600px; padding: 0; background: #F8FAFC; overflow-y: auto; max-height: 90vh;">
            <span class="close-modal" onclick="closeViewProfileModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer; z-index: 10;">&times;</span>

            <div class="card profile-header-card" style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 20px; padding: 35px 25px 25px 25px; margin: 0; border-radius: 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; width: 100%; text-align: center;">
                    <div class="avatar-circle" style="width: 130px; height: 130px; font-size: 3.5rem; margin: 0 auto;">${avatarHtml}</div>
                    <h2 style="color: var(--primary); font-size: 1.8rem; margin: 0; border: none; padding: 0;">${member.name || 'Unknown'}</h2>
                </div>
            </div>

            <div style="padding: 20px;">
                <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 20px;">
                    <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 10px; border-bottom: 2px solid var(--bg-light); padding-bottom: 5px;">Personal Details</h3>
                    <div style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; text-align: left;">
                        <strong>Email:</strong> ${safeText(member.email)}<br>
                        <strong>Age:</strong> ${safeText(member.age)}<br>
                        <strong>Gender:</strong> ${safeText(member.gender)}<br>
                        <strong>Birthday:</strong> ${safeText(member.birthday)}<br>
                        <strong>Mobile:</strong> ${safeText(member.mobile)}<br>
                        <strong>Social Media:</strong> ${safeText(member.social_media)}<br>
                        <strong>Parents/Guardian:</strong> ${safeText(member.parents_name)}
                    </div>
                </div>

                <div class="sub-nav" style="margin-bottom: 15px; justify-content: center; background: #FFF; padding: 5px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <button class="sub-nav-btn active" style="flex:1;" onclick="switchModalViewTab(this, 'viewRoles')">🎭 Roles</button>
                    <button class="sub-nav-btn" style="flex:1;" onclick="switchModalViewTab(this, 'viewAttendance')">📋 Participation</button>
                </div>

                <div id="viewRoles" class="view-modal-tab" style="display: block;">
                    <div class="card" style="margin-bottom: 0;">
                        <div style="padding: 5px; text-align: left;">
                            ${allRoles.length === 0 ? '<div style="color:var(--text-muted); text-align:center;">No roles assigned yet.</div>' : allRoles.map(r => `
                            <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <strong style="color: var(--primary); font-size: 1.05rem;">${r.type === 'ministry' ? '🏛️ ' + r.ministry_name : '📅 ' + r.event_name}</strong>
                                </div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
                                    <strong>Role:</strong> ${r.role || r.role_name} ${r.sub_role ? ' | ' + r.sub_role : ''}<br>
                                    <strong>Assigned:</strong> ${(r.assigned_at || '').split(' ')[0]}
                                </div>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>

                <div id="viewAttendance" class="view-modal-tab" style="display: none;">
                    <div class="card" style="margin-bottom: 0;">
                        <div style="padding: 5px; text-align: left;">
                            ${history.length === 0 ? '<div style="color:var(--text-muted); text-align:center;">No participation logs found.</div>' : history.map(a => `
                            <div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;">
                                <div><strong style="color: var(--primary); font-size: 1.05rem;">${a.event_name || 'Event'}</strong><br><small style="color:var(--text-muted);">${a.checked_in_at || ''}</small></div>
                                ${a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>'}
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        let modal = document.getElementById('viewProfileModal');
        if (modal) {
            modal.innerHTML = modalHtml;
            modal.style.display = 'flex';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Lock background scroll
        }
    } catch(e) { 
        console.error(e);
        alert("Error loading member profile."); 
    } finally { 
        document.getElementById('globalPreloader').style.opacity = '0'; 
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500); 
    }
};

window.switchModalViewTab = function(btnEl, tabId) {
    const parent = btnEl.closest('.sub-nav');
    if (parent) { parent.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active')); }
    btnEl.classList.add('active');
    document.querySelectorAll('.view-modal-tab').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
};

// CRITICAL FIX: Unlock screen when closed
window.closeViewProfileModal = function() {
    const modal = document.getElementById('viewProfileModal');
    if(modal) { 
        modal.style.display = 'none'; 
        modal.classList.remove('active'); 
    }
    document.body.style.overflow = ''; // Restores background scrolling
};

// FAILSAFE: If they click the dark background to close
if (!window.isModalFailsafePatched) {
    window.addEventListener('click', function(event) {
        if (event.target && event.target.classList && event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            event.target.classList.remove('active');
            document.body.style.overflow = ''; // Restores background scrolling
        }
    });
    window.isModalFailsafePatched = true;
}

// ==========================================
// V25: SURGICAL FIXES (GENDER, HOME BUTTONS, XP, 3-WAY MINISTRIES)
// ==========================================

// --- FIX 1: GENDER NOT SAVING ---
window.handleSelfProfileUpdate = async function(e) {
    e.preventDefault();
    const id = document.getElementById('myMemberId').value;
    if (!id) return alert('Admin accounts are updated directly in Add Permissions.');

    const fileInput = document.getElementById('myEditProfilePic');
    let picBase64 = undefined;
    if (fileInput && fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const genderVal = document.getElementById('myEditGender') ? document.getElementById('myEditGender').value : '';

    const payload = {
        name: document.getElementById('myEditName').value, email: document.getElementById('myEditEmail').value,
        age: document.getElementById('myEditAge').value, birthday: document.getElementById('myEditBirthday').value,
        social_media: document.getElementById('myEditSocial').value, parents_name: document.getElementById('myEditParents').value,
        password: document.getElementById('myEditPassword').value, profile_picture: picBase64, actor: currentUser,
        gender: genderVal
    };
    window.triggerActionConfirmation('Save changes to your personal profile?', async () => {
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

// --- FIX 2: HOME DASHBOARD BUTTONS ("I'm Ready", "Discern", "Expand Service") ---
if (!document.getElementById('commitmentModal')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="commitmentModal" class="modal">
        <div class="modal-content" style="max-width: 450px; text-align: center; padding: 30px 20px;">
            <span class="close-modal" onclick="closeCommitmentModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;">&times;</span>
            <div style="font-size: 3rem; margin-bottom: 10px;">🛡️</div>
            <h2 style="color: var(--primary); margin-bottom: 5px; border: none;">Koinonia Commitment</h2>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Take the pledge to join our core community.</p>
            <form onsubmit="submitCommitment(event)" style="text-align: left;">
                <div class="form-group">
                    <label style="font-weight: bold; color: var(--text-main);">Your Pledge/Intent</label>
                    <textarea id="commitmentIntentMsg" class="form-control" rows="3" placeholder="I commit to..." required></textarea>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 10px; border-radius: 12px;">Submit Pledge</button>
            </form>
        </div>
    </div>`);
}

window.openCommitmentModal = function() {
    const m = document.getElementById('commitmentModal');
    if(m) { m.style.display = 'flex'; m.classList.add('active'); document.body.style.overflow = 'hidden'; }
};
window.closeCommitmentModal = function() {
    const m = document.getElementById('commitmentModal');
    if(m) { m.style.display = 'none'; m.classList.remove('active'); document.body.style.overflow = ''; }
};

window.submitCommitment = async function(e) {
    e.preventDefault();
    const msg = document.getElementById('commitmentIntentMsg').value;
    if (!msg) return;
    try {
        const res = await fetch('/api/youth/' + currentMember.id + '/commit', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentMember.name, intent_message: msg })
        });
        const data = await res.json();
        if (data.success) {
            alert("Welcome to the core community!");
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            closeCommitmentModal();
            if(window.renderHomeJourney) window.renderHomeJourney();
        }
    } catch(err) { alert('Network Error'); }
};

window.openMinistryIntentModal = async function() {
    const modal = document.getElementById('ministryIntentModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        try {
            const res = await fetch('/api/ministries');
            const ministries = await res.json();
            document.getElementById('ministrySelect').innerHTML = '<option value="">Select a Ministry...</option>' + ministries.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        } catch(e) {}
    }
};
window.closeMinistryIntentModal = function() {
    const modal = document.getElementById('ministryIntentModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); document.body.style.overflow = 'auto'; }
};

// --- FIX 3: DIRECTORY VIEW PROFILE XP DISPLAY ---
const origOpenViewProfileModal = window.openViewProfileModal;
window.openViewProfileModal = async function(id) {
    await origOpenViewProfileModal(id);
    
    // Inject XP specifically under the generated name header inside the modal
    setTimeout(async () => {
        try {
            const usersRes = await fetch('/api/youth');
            const users = await usersRes.json();
            const member = users.find(u => String(u.id) === String(id));
            if (!member) return;

            const modalNameHeader = document.querySelector('#viewProfileModal h2');
            if (modalNameHeader && !document.getElementById('injectedModalXP')) {
                modalNameHeader.insertAdjacentHTML('afterend', `
                <div id="injectedModalXP" style="display:flex; justify-content:center; gap:10px; margin-top:10px;">
                    <span class="badge badge-orange" style="font-size: 0.9rem;">⭐ ${member.points || 0} XP</span>
                </div>`);
            }
        } catch(e) {}
    }, 100);
};

// --- FIX 4: MINISTRIES 3-WAY SPLIT TABS ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const minTab = document.getElementById('ministriesTab');
        if (!minTab) return;

        // 1. Rebuild Sub-Nav with exactly 3 tabs
        const subNav = minTab.querySelector('.sub-nav');
        if (subNav) {
            subNav.innerHTML = `
                <button id="btnSubMinistryList" class="sub-nav-btn active" onclick="switchMinistrySubTab('list')">🏛️ Directory</button>
                <button id="btnSubMinistryModeration" class="sub-nav-btn" onclick="switchMinistrySubTab('moderation')">📋 Moderation</button>
                <button id="btnSubMinistryCreate" class="sub-nav-btn" onclick="switchMinistrySubTab('create')" style="display: ${window.hasPerm('add_entries') ? 'inline-block' : 'none'};">➕ Create</button>
            `;
        }

        // 2. Ensure Moderation Content Exists safely
        let modTab = document.getElementById('subTabMinistryModeration');
        if (!modTab) {
            const listTab = document.getElementById('subTabMinistryList');
            if (listTab) {
                listTab.insertAdjacentHTML('afterend', `
                <div id="subTabMinistryModeration" class="ministry-sub-tab" style="display:none; animation: fadeIn 0.3s ease-out;">
                    <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
                        <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Application</h3>
                        <div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px;"></div>
                    </div>
                </div>`);
            }
        }
    }, 500);
});

// 3. Perfect the Logic Controller for the 3 tabs
window.switchMinistrySubTab = function(tab) {
    const tabs = ['list', 'moderation', 'create'];
    
    tabs.forEach(t => {
        // Capitalize first letter for element IDs
        const capitalTab = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById('subTabMinistry' + capitalTab);
        const btn = document.getElementById('btnSubMinistry' + capitalTab);
        
        if (el) el.style.display = (tab === t) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', tab === t);
    });

    if (tab === 'list') window.loadMinistries();
    if (tab === 'moderation' && window.loadPendingApplications) window.loadPendingApplications();
};

window.loadPendingApplications = async function() {
    const list = document.getElementById('pendingApplicationsList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Loading pending applications...</div>';
    
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div style="text-align:center; color:var(--danger);">Network error.</div>'; }
};

window.processApplicationModal = async function(ministryId, mappingId, decision) {
    if (!confirm('Are you sure you want to ' + decision + ' this application?')) return;
    try {
        if (decision === 'Denied') {
            await fetch(`/api/ministries/${ministryId}/members/${mappingId}`, { method: 'DELETE' });
        } else {
            await fetch(`/api/ministries/${ministryId}/members/${mappingId}`, {
                method: 'PUT', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ role: decision, sub_role: '' })
            });
        }
        window.loadPendingApplications(); 
        if (window.loadMinistries) window.loadMinistries(); 
    } catch(e) { alert("Network Error"); }
};

// Suppress any rogue buttons from old logic loops
setInterval(() => {
    document.querySelectorAll('#btnModerateMinistries').forEach(b => b.remove());
}, 1000);

// ==========================================
// V26: SURGICAL FIXES (COMMITMENT MODAL, FORM RELOADS, WORKFLOW)
// ==========================================

// --- FIX 1 & 2: REBUILD COMMITMENT MODAL WITH EXACT WORDINGS & STOP RELOADS ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const commitModal = document.getElementById('commitmentModal');
        if (commitModal) {
            commitModal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; text-align: center; padding: 30px 20px;">
                <span class="close-modal" onclick="closeCommitmentModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;">&times;</span>
                <div style="font-size: 3rem; margin-bottom: 10px;">🕊️</div>
                <h2 style="color: var(--primary); margin-bottom: 5px; border: none;">Choose to Belong</h2>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">You are about to officially embrace Fire of God Ministries as your spiritual family.</p>
                
                <div style="background: #FFFBEB; padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 20px; text-align: left;">
                    <p style="font-size: 0.9rem; color: #D97706; margin: 0; font-style: italic;">
                        "I choose to grow with Fire of God Ministries and journey with this community in faith, fellowship, formation, and mission."
                    </p>
                </div>

                <form onsubmit="event.preventDefault(); submitCommitment(event);" style="text-align: left;">
                    <div class="form-group">
                        <label style="font-weight: bold; color: var(--text-main);">How is God leading you to make this community your home?</label>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: -5px; margin-bottom: 8px;">We'd love to hear a brief reflection on your heart to journey with us.</p>
                        <textarea id="commitmentIntentMsg" class="form-control" rows="4" placeholder="Share your heart..." required></textarea>
                    </div>
                    <button type="button" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 10px; border-radius: 12px; background: #F59E0B; border: none;" onclick="submitCommitment(event)">Commit to the Community</button>
                </form>
            </div>`;
        }

        const intentModal = document.getElementById('ministryIntentModal');
        if (intentModal) {
            intentModal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; text-align: center; padding: 30px 20px;">
                <span class="close-modal" onclick="closeMinistryIntentModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;">&times;</span>
                <div style="font-size: 3rem; margin-bottom: 10px;">🔥</div>
                <h2 style="color: var(--primary); margin-bottom: 5px; border: none;">Discover Your Place</h2>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Express your intent to serve and begin your discernment journey.</p>
                <form onsubmit="event.preventDefault(); submitMinistryIntent(event);" style="text-align: left;">
                    <div class="form-group">
                        <label style="font-weight: bold; color: var(--text-main);">Which Ministry are you drawn to?</label>
                        <select id="ministrySelect" class="form-control" required><option value="">Loading...</option></select>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: bold; color: var(--text-main);">What draws your heart to this team?</label>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: -5px; margin-bottom: 8px;">Share a little bit about what excites you or how you'd love to contribute! 💛</p>
                        <textarea id="ministryIntentMsg" class="form-control" rows="3" placeholder="I'd love to be part of this because..." required></textarea>
                    </div>
                    <button type="button" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 10px; border-radius: 12px; background: #F59E0B; border: none;" onclick="submitMinistryIntent(event)">Send My Intent 🕊️</button>
                </form>
            </div>`;
        }
    }, 800);
});

// --- FIX 3: BULLETPROOF SUBMIT FUNCTIONS ---
window.submitCommitment = async function(e) {
    if(e) e.preventDefault();
    const msg = document.getElementById('commitmentIntentMsg').value.trim();
    if (!msg) return alert('Please share your reflection.');
    try {
        const res = await fetch('/api/youth/' + currentMember.id + '/commit', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentMember.name, intent_message: msg })
        });
        const data = await res.json();
        if (data.success) {
            alert("Welcome to the core community!");
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            closeCommitmentModal();
            if(window.renderHomeJourney) window.renderHomeJourney();
        } else { alert(data.error || 'Failed to submit commitment.'); }
    } catch(err) { alert('Network Error'); }
};

window.submitMinistryIntent = async function(e) {
    if(e) e.preventDefault();
    const minId = document.getElementById('ministrySelect').value;
    const msg = document.getElementById('ministryIntentMsg').value.trim();
    if (!minId || !msg) return alert('Please complete all fields.');
    try {
        const payload = { youth_id: currentMember.id, intent_message: msg, actor: currentMember.name || 'Member' };
        const res = await fetch(`/api/ministries/${minId}/apply`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { 
            alert('Ministry Intent submitted successfully!'); 
            closeMinistryIntentModal(); 
            if (window.renderHomeJourney) window.renderHomeJourney(); 
            if (window.loadMyV3Roles) window.loadMyV3Roles(); 
        } else { alert(data.error || 'Failed to submit application. You may already be in this ministry.'); }
    } catch(err) { alert('Network error.'); }
};

// --- FIX 4: CLARIFY EXPAND SERVICE WORKFLOW ---
window.renderHomeJourney = async function() {
    const container = document.getElementById('dynamicJourneyContainer');
    if (!container || !currentMember) return;
    let html = '';
    if (currentMember.account_tier === 'New Member' || currentMember.account_tier === 'Seeker') {
        html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Step In</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take the next step to officially become a member of our spiritual family.</p></div><button type="button" class="btn btn-primary btn-sm" style="background: var(--primary); color: white; border: none;" onclick="openCommitmentModal()">I'm Ready</button>`;
    } else {
        try {
            const res = await fetch('/api/youth/' + currentMember.id + '/ministries');
            const ministries = await res.json();
            const isApplicant = ministries.some(m => m.role === 'Applicant');
            const isActiveMember = ministries.some(m => m.role !== 'Applicant');
            
            if (isActiveMember) {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Serve & Grow</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Continue your formation</p>${isApplicant ? '<p style="font-size:0.75rem; color:#F59E0B; margin:0; font-weight:bold;">(Application Pending)</p>' : ''}</div><button type="button" class="btn btn-outline btn-sm" style="color: #F59E0B; border-color: #F59E0B;" onclick="openMinistryIntentModal()">Expand Service</button>`;
            } else if (isApplicant) {
                html = `<div><strong style="color: #F59E0B; font-size: 0.95rem;">🙏 Discerning Together</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">We are so excited you want to serve! Our team is currently praying and preparing a space for you.</p></div><button type="button" class="btn btn-secondary btn-sm" disabled>Preparing Space</button>`;
            } else {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Discover Your Gifts</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take some time to explore where you might love to serve and share those gifts with the community.</p></div><button type="button" class="btn btn-primary btn-sm" style="background: #F59E0B; border: none; color: white;" onclick="openMinistryIntentModal()">Explore Serving</button>`;
            }
        } catch(e) {}
    }
    container.innerHTML = html;
};

// --- FIX 5: ENSURE MODERATION TAB RENDERS ---
window.loadPendingApplications = async function() {
    const list = document.getElementById('pendingApplicationsList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Loading pending applications...</div>';
    
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div style="text-align:center; color:var(--danger);">Network error.</div>'; }
};

// ==========================================
// V26: ISOLATED FIXES (MESSAGES, PASSWORD BUG, MODERATION UI)
// ==========================================

// --- FIX 1: BEAUTIFUL SUCCESS MODALS FOR WORKFLOWS ---
if (!document.getElementById('customSuccessModal')) {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="customSuccessModal" class="modal" style="z-index: 99999;">
        <div class="modal-content" style="max-width: 450px; text-align: center; padding: 30px 20px;">
            <div id="csmIcon" style="font-size: 3rem; margin-bottom: 10px;">🎉</div>
            <h2 id="csmTitle" style="color: var(--primary); margin-bottom: 10px; border: none;">Success</h2>
            <p id="csmMessage" style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap; text-align: left;"></p>
            <button class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1rem; border-radius: 12px;" onclick="document.getElementById('customSuccessModal').classList.remove('active'); document.body.style.overflow = 'auto';">Awesome, thanks!</button>
        </div>
    </div>`);
}

window.showSuccessMessage = function(icon, title, message) {
    document.getElementById('csmIcon').innerText = icon;
    document.getElementById('csmTitle').innerText = title;
    document.getElementById('csmMessage').innerText = message;
    document.getElementById('customSuccessModal').style.display = 'flex';
    document.getElementById('customSuccessModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.submitCommitment = async function(e) {
    if(e) e.preventDefault();
    const msg = document.getElementById('commitmentIntentMsg').value.trim();
    if (!msg) return alert('Please share your reflection.');
    try {
        const res = await fetch('/api/youth/' + currentMember.id + '/commit', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentMember.name, intent_message: msg })
        });
        const data = await res.json();
        if (data.success) {
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            closeCommitmentModal();
            if(window.renderHomeJourney) window.renderHomeJourney();
            
            showSuccessMessage('🕊️', 'Welcome to the Family!', "Thank you for choosing to belong to Fire of God Ministries. This is a beautiful step in your spiritual journey.\n\nWe are excited to walk alongside you in faith, fellowship, and formation. Welcome home!");
        } else { alert(data.error || 'Failed to submit commitment.'); }
    } catch(err) { alert('Network Error'); }
};

window.submitMinistryIntent = async function(e) {
    if(e) e.preventDefault();
    const minId = document.getElementById('ministrySelect').value;
    const msg = document.getElementById('ministryIntentMsg').value.trim();
    if (!minId || !msg) return alert('Please complete all fields.');
    try {
        const payload = { youth_id: currentMember.id, intent_message: msg, actor: currentMember.name || 'Member' };
        const res = await fetch(`/api/ministries/${minId}/apply`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { 
            closeMinistryIntentModal(); 
            if (window.renderHomeJourney) window.renderHomeJourney(); 
            if (window.loadMyV3Roles) window.loadMyV3Roles(); 
            
            showSuccessMessage('🌱', 'Intent Received!', "Thank you for stepping out in faith to serve!\n\nPlease note that joining a ministry is a process of discernment and growth. You will be invited to undergo specific activities and formations as you journey toward becoming a full-fledged team member. \n\nWe are excited for what God will do through you!");
        } else { alert(data.error || 'Failed to submit application. You may already be in this ministry.'); }
    } catch(err) { alert('Network error.'); }
};

// --- FIX 2: PREVENT PASSWORD OVERWRITING ON ADMIN EDITS ---
window.submitFastEditProfile = async function(doCheckIn) {
    const form = document.getElementById('fastEditProfileForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('fastEditMemberId').value;
    const fileInput = document.getElementById('fastEditProfilePic');
    let picBase64 = undefined;
    if (fileInput && fileInput.files && fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('fastEditName').value, email: document.getElementById('fastEditEmail').value,
        age: document.getElementById('fastEditAge').value, birthday: document.getElementById('fastEditBirthday').value,
        social_media: document.getElementById('fastEditSocial').value, parents_name: document.getElementById('fastEditParents').value,
        profile_picture: picBase64, 
        password: '', // CRITICAL FIX: Empty string preserves the existing password in backend!
        actor: currentUser
    };
    window.triggerActionConfirmation(`Confirm updating profile for ${payload.name}?`, async () => {
        const res = await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) {
            window.closeFastEditProfileModal(); youthData = []; await window.loadDirectory();
            if(doCheckIn) window.quickCheckin(id, payload.name);
            else {
                alert("Profile updated successfully! (Password safely preserved)");
                window.updateActiveEventBanner();
                if(currentAnalyticsData) window.openAnalyticsModal(currentAnalyticsData.event.id);
            }
        }
    });
};

window.saveMemberEditWithConfirm = async function() {
    const form = document.getElementById('editMemberModal').querySelector('form');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    const id = document.getElementById('editMemberId').value;
    const fileInput = document.getElementById('editMemberProfilePic');
    let picBase64 = undefined;
    if (fileInput && fileInput.files && fileInput.files.length > 0) picBase64 = await window.getBase64(fileInput.files[0], 400);

    const payload = {
        name: document.getElementById('editMemberName').value, email: document.getElementById('editMemberEmail').value,
        age: document.getElementById('editMemberAge').value, birthday: document.getElementById('editMemberBirthday').value,
        social_media: document.getElementById('editMemberSocial').value, parents_name: document.getElementById('editMemberParents').value,
        password: '', // CRITICAL FIX: Empty string preserves the existing password in backend!
        profile_picture: picBase64, actor: currentUser
    };
    window.triggerActionConfirmation(`Confirm updating member profile for '${payload.name}'?`, async () => {
        await fetch(`/api/youth/profile/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        window.closeEditMemberModal(); youthData = []; window.loadDirectory();
    });
};

// --- FIX 3: ENSURE MODERATION TAB RENDERS HEIGHT FULLY ---
window.ensureModerationDOM = function() {
    let modTab = document.getElementById('subTabMinistryModeration');
    if (!modTab) {
        const listTab = document.getElementById('subTabMinistryList');
        if (listTab) {
            listTab.insertAdjacentHTML('afterend', `
            <div id="subTabMinistryModeration" class="ministry-sub-tab" style="display:none; animation: fadeIn 0.3s ease-out; width: 100%;">
                <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); min-height: 200px;">
                    <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Application</h3>
                    <div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px; width: 100%;"></div>
                </div>
            </div>`);
        }
    } else {
        if (!document.getElementById('pendingApplicationsList')) {
            const header = modTab.querySelector('h3');
            if (header) header.insertAdjacentHTML('afterend', '<div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px; width: 100%;"></div>');
        }
    }
};

window.switchMinistrySubTab = function(tab) {
    const tabs = ['list', 'moderation', 'create'];
    tabs.forEach(t => {
        const capitalTab = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById('subTabMinistry' + capitalTab);
        const btn = document.getElementById('btnSubMinistry' + capitalTab);
        
        if (el) el.style.display = (tab === t) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', tab === t);
    });

    if (tab === 'list') window.loadMinistries();
    if (tab === 'moderation') {
        window.ensureModerationDOM();
        if (window.loadPendingApplications) window.loadPendingApplications();
    }
};

window.loadPendingApplications = async function() {
    window.ensureModerationDOM();
    const list = document.getElementById('pendingApplicationsList');
    if (!list) return;
    
    list.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted);">Loading pending applications...</div>';
    
    try {
        const res = await fetch('/api/ministries/applications/pending');
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--danger);">Network error fetching applications.</div>'; }
};

// ==========================================
// V27: UI REFINEMENTS (ICONS, TAGLINES, MODERATION RENDER FIX)
// ==========================================

// --- FIX 1: INSPIRING SUCCESS MESSAGES & YOUTHFUL ICONS ---
window.submitCommitment = async function(e) {
    if(e) e.preventDefault();
    const msg = document.getElementById('commitmentIntentMsg').value.trim();
    if (!msg) return alert('Please share your reflection.');
    try {
        const res = await fetch('/api/youth/' + currentMember.id + '/commit', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: currentMember.name, intent_message: msg })
        });
        const data = await res.json();
        if (data.success) {
            currentMember = data.member;
            localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
            closeCommitmentModal();
            if(window.renderHomeJourney) window.renderHomeJourney();
            
            showSuccessMessage('🎉', 'Welcome to the Family!', "Thank you for choosing to belong to Fire of God Ministries. This is a beautiful step in your spiritual journey.\n\nWe are excited to walk alongside you in faith, fellowship, and formation. Welcome home!");
        } else { alert(data.error || 'Failed to submit commitment.'); }
    } catch(err) { alert('Network Error'); }
};

window.submitMinistryIntent = async function(e) {
    if(e) e.preventDefault();
    const minId = document.getElementById('ministrySelect').value;
    const msg = document.getElementById('ministryIntentMsg').value.trim();
    if (!minId || !msg) return alert('Please complete all fields.');
    try {
        const payload = { youth_id: currentMember.id, intent_message: msg, actor: currentMember.name || 'Member' };
        const res = await fetch(`/api/ministries/${minId}/apply`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { 
            closeMinistryIntentModal(); 
            if (window.renderHomeJourney) window.renderHomeJourney(); 
            if (window.loadMyV3Roles) window.loadMyV3Roles(); 
            
            showSuccessMessage('🙌', 'Intent Received!', "Thank you for stepping out in faith to serve!\n\nPlease note that joining a ministry is a process of discernment and growth. You will be invited to undergo specific activities and formations as you journey toward becoming a full-fledged team member. \n\nWe are excited for what God will do through you!");
        } else { alert(data.error || 'Failed to submit application. You may already be in this ministry.'); }
    } catch(err) { alert('Network error.'); }
};

// --- FIX 2: ENCOURAGING HEADING FOR DISCERN/EXPAND ---
window.openMinistryIntentModal = async function() {
    const modal = document.getElementById('ministryIntentModal');
    if (modal) {
        modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px; text-align: center; padding: 30px 20px;">
            <span class="close-modal" onclick="closeMinistryIntentModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer;">&times;</span>
            <div style="font-size: 3rem; margin-bottom: 10px;">🙌</div>
            <h2 style="color: var(--primary); margin-bottom: 5px; border: none;">Step Into Your Calling!</h2>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">Express your intent to serve and begin your discernment journey.</p>
            <form onsubmit="event.preventDefault(); submitMinistryIntent(event);" style="text-align: left;">
                <div class="form-group">
                    <label style="font-weight: bold; color: var(--text-main);">Which Ministry are you drawn to?</label>
                    <select id="ministrySelect" class="form-control" required><option value="">Loading...</option></select>
                </div>
                <div class="form-group">
                    <label style="font-weight: bold; color: var(--text-main);">What draws your heart to this team?</label>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: -5px; margin-bottom: 8px;">Share a little bit about what excites you or how you'd love to contribute! 💛</p>
                    <textarea id="ministryIntentMsg" class="form-control" rows="3" placeholder="I'd love to be part of this because..." required></textarea>
                </div>
                <button type="button" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1.1rem; font-weight: bold; margin-top: 10px; border-radius: 12px; background: #F59E0B; border: none;" onclick="submitMinistryIntent(event)">Send My Intent</button>
            </form>
        </div>`;
        
        modal.style.display = 'flex';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        try {
            const res = await fetch('/api/ministries');
            const ministries = await res.json();
            document.getElementById('ministrySelect').innerHTML = '<option value="">Select a Ministry...</option>' + ministries.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        } catch(e) {}
    }
};

// --- FIX 3: BULLETPROOF MODERATION DOM RENDERER ---
window.ensureModerationDOM = function() {
    // 1. Completely destroy ANY duplicate moderation tabs hiding in the background
    document.querySelectorAll('#subTabMinistryModeration').forEach(e => e.remove());
    
    // 2. Build one pristine, full-height container and attach it
    const listTab = document.getElementById('subTabMinistryList');
    if (listTab) {
        listTab.insertAdjacentHTML('afterend', `
        <div id="subTabMinistryModeration" class="ministry-sub-tab" style="display:none; width: 100%; min-height: 400px; animation: fadeIn 0.3s ease-out;">
            <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); min-height: 300px;">
                <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Application</h3>
                <div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px; width: 100%;"></div>
            </div>
        </div>`);
    }
};

window.switchMinistrySubTab = function(tab) {
    const tabs = ['list', 'moderation', 'create'];
    tabs.forEach(t => {
        const capitalTab = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById('subTabMinistry' + capitalTab);
        const btn = document.getElementById('btnSubMinistry' + capitalTab);

        if (el) el.style.display = (tab === t) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', tab === t);
    });

    if (tab === 'list') window.loadMinistries();
    if (tab === 'moderation') {
        if (window.loadPendingApplications) window.loadPendingApplications();
    }
};

window.loadPendingApplications = async function() {
    window.ensureModerationDOM(); // Guarantee DOM exists and is clean!
    const list = document.getElementById('pendingApplicationsList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size: 1rem;">Loading pending applications...</div>';

    try {
        const res = await fetch('/api/ministries/applications/pending');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size: 1rem; border: 1px dashed var(--border-color); border-radius: 8px;">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { 
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--danger); font-weight: bold;">Network error fetching applications: ${e.message}</div>`; 
    }
};

// ==========================================
// V28: NON-DESTRUCTIVE MODERATION TAB RENDER
// ==========================================

// Safely inject the tab once without destroying existing visible tabs
window.injectModerationTab = function() {
    let modTab = document.getElementById('subTabMinistryModeration');
    if (!modTab) {
        const listTab = document.getElementById('subTabMinistryList');
        if (listTab) {
            listTab.insertAdjacentHTML('afterend', `
            <div id="subTabMinistryModeration" class="ministry-sub-tab" style="display:none; width: 100%; min-height: 400px; animation: fadeIn 0.3s ease-out;">
                <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); min-height: 300px;">
                    <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Application</h3>
                    <div id="pendingApplicationsList" style="display: flex; flex-direction: column; gap: 12px; width: 100%;"></div>
                </div>
            </div>`);
        }
    }
};

// Override the destructive function to prevent it from hiding the tab
window.ensureModerationDOM = function() {
    window.injectModerationTab();
};

window.switchMinistrySubTab = function(tab) {
    window.injectModerationTab(); // Ensure it exists before trying to switch to it

    const tabs = ['list', 'moderation', 'create'];
    tabs.forEach(t => {
        const capitalTab = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById('subTabMinistry' + capitalTab);
        const btn = document.getElementById('btnSubMinistry' + capitalTab);

        if (el) el.style.display = (tab === t) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', tab === t);
    });

    if (tab === 'list') window.loadMinistries();
    if (tab === 'moderation') {
        if (window.loadPendingApplications) window.loadPendingApplications();
    }
};

window.loadPendingApplications = async function() {
    window.injectModerationTab();
    const list = document.getElementById('pendingApplicationsList');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size: 1rem;">Loading pending applications...</div>';

    try {
        const res = await fetch('/api/ministries/applications/pending');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size: 1rem; border: 1px dashed var(--border-color); border-radius: 8px;">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { 
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--danger); font-weight: bold;">Network error fetching applications: ${e.message}</div>`; 
    }
};

// Call this once on load to ensure it's staged
setTimeout(window.injectModerationTab, 1000);

// ==========================================
// V29: GHOST DOM ERADICATION & MODERATION UI
// ==========================================

window.ensureModerationDOM = function() {
    // 1. Destroy ANY existing moderation tabs or lists to prevent ghost DOM collisions
    document.querySelectorAll('#subTabMinistryModeration, #pendingApplicationsList, #pendingApplicationsListActive').forEach(el => el.remove());
    
    // 2. Build one pristine, uniquely identified container and attach it
    const listTab = document.getElementById('subTabMinistryList');
    if (listTab) {
        listTab.insertAdjacentHTML('afterend', `
        <div id="subTabMinistryModeration" class="ministry-sub-tab" style="display:none; width: 100%; min-height: 250px; animation: fadeIn 0.3s ease-out;">
            <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); min-height: 200px;">
                <h3 style="color: #F59E0B; font-size: 1.15rem; border-bottom: 2px solid #FEF3C7; padding-bottom: 8px; margin-top: 0; margin-bottom: 15px;">📋 Pending Ministry Application</h3>
                <div id="pendingApplicationsListActive" style="display: flex; flex-direction: column; gap: 12px; width: 100%;"></div>
            </div>
        </div>`);
    }
};

window.switchMinistrySubTab = function(tab) {
    if (tab === 'moderation') window.ensureModerationDOM();

    const tabs = ['list', 'moderation', 'create'];
    tabs.forEach(t => {
        const capitalTab = t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById('subTabMinistry' + capitalTab);
        const btn = document.getElementById('btnSubMinistry' + capitalTab);

        if (el) el.style.display = (tab === t) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', tab === t);
    });

    if (tab === 'list') window.loadMinistries();
    if (tab === 'moderation') {
        if (window.loadPendingApplications) window.loadPendingApplications();
    }
};

window.loadPendingApplications = async function() {
    // Target the newly injected unique ID
    const list = document.getElementById('pendingApplicationsListActive');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size: 1rem;">Loading pending applications...</div>';

    try {
        const res = await fetch('/api/ministries/applications/pending');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const apps = await res.json();

        if (!apps || apps.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-size: 1rem; border: 1px dashed var(--border-color); border-radius: 8px;">No pending applications right now!</div>';
            return;
        }

        list.innerHTML = apps.map(app => `
        <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <strong style="color: var(--text-main); font-size: 1.05rem;">${app.applicant_name}</strong>
                    <span style="font-size: 0.8rem; background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 12px; font-weight: bold; margin-left: 8px;">${app.ministry_name}</span>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin: 8px 0 0 0; font-style: italic;">"${app.intent_message || 'No message provided.'}"</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn btn-outline btn-sm text-danger" style="border-color: var(--danger);" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Denied')">Decline</button>
                    <button type="button" class="btn btn-primary btn-sm" style="background: #10B981; border: none;" onclick="processApplicationModal(${app.ministry_id}, ${app.mapping_id}, 'Integration Period')">Approve</button>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { 
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:var(--danger); font-weight: bold;">Network error fetching applications: ${e.message}</div>`; 
    }
};

// ==========================================
// V38: UNIFIED MASTER PATCH (CLEAN RECOVERY)
// ==========================================

// 1. Z-INDEX & CSS FIXES (Hides duplicate Pass ID, forces Modals to front)
const styleFixes = document.createElement('style');
styleFixes.innerHTML = `
    #editMinistryRoleModal, #editMemberModal, .modal[id*="edit"] { z-index: 99999 !important; }
    #ministryDetailsModal, #viewMinistryModal { z-index: 1050 !important; }
    .custom-success-modal { z-index: 100000 !important; }
    #modalProfileCode { display: none !important; }
`;
document.head.appendChild(styleFixes);

// 2. AUTO-HEALING UI (Prevents Screen Freezing)
setInterval(() => {
    const visibleModals = Array.from(document.querySelectorAll('.modal')).filter(m => {
        const style = window.getComputedStyle(m);
        return style.display !== 'none' && style.opacity !== '0';
    });
    if (visibleModals.length === 0) {
        if (document.body.style.overflow === 'hidden' || document.body.style.pointerEvents === 'none') {
            document.body.style.overflow = '';
            document.body.style.pointerEvents = 'auto';
        }
    }
}, 1000);

// 3. MASTER FETCH INTERCEPTOR (Safe & Unified)


// 4. DYNAMIC UI INJECTOR (Inputs & Overrides)
setInterval(() => {
    // Dropdown Override
    const select = document.querySelector('#editMinistryRoleModal select');
    if (select && !select.classList.contains('patched-v37')) {
        if (select.innerHTML.includes('value="Member"')) {
            const currentVal = select.value;
            select.innerHTML = `
                <option value="Ministry Head">Ministry Head</option>
                <option value="Assistant Ministry Head">Assistant Ministry Head</option>
                <option value="Youth Ministry Head">Youth Ministry Head</option>
                <option value="Core">Core</option>
                <option value="Member">Member</option>
                <option value="Integration Period">Integration Period</option>
            `;
            if (currentVal && !select.innerHTML.includes(currentVal)) select.innerHTML += `<option value="${currentVal}">${currentVal}</option>`;
            select.value = currentVal;
            select.classList.add('patched-v37');
        }
    }

    // Profile Form Inputs (My Profile)
    const myEmailGroup = document.getElementById('myEditEmail');
    if (myEmailGroup && !document.getElementById('myEditMobile')) {
        myEmailGroup.parentElement.insertAdjacentHTML('afterend', `
            <div class="form-group"><label>Mobile Number</label><input type="text" id="myEditMobile" class="form-control" placeholder="e.g. 09123456789"></div>
            <div class="form-group"><label>Address</label><input type="text" id="myEditAddress" class="form-control" placeholder="Enter full address"></div>
        `);
    }
    
    // Profile Form Inputs (Admin Edit)
    const edEmailGroup = document.getElementById('editMemberEmail');
    if (edEmailGroup && !document.getElementById('editMemberMobile')) {
        edEmailGroup.parentElement.insertAdjacentHTML('afterend', `
            <div class="form-group"><label>Mobile Number</label><input type="text" id="editMemberMobile" class="form-control"></div>
            <div class="form-group"><label>Address</label><input type="text" id="editMemberAddress" class="form-control"></div>
        `);
    }

    // Make Priority Button
    document.querySelectorAll('button').forEach(btn => {
        if (btn.innerText.trim() === 'Make Core Priority') {
            btn.innerText = '⭐ Make Priority';
            btn.classList.remove('btn-outline');
            btn.classList.add('btn-primary');
        }
    });
}, 1000);

// 5. PROFILE UI OVERRIDES (Pass ID & Display mapping)
const origPopV37 = window.populateProfileTab;
if (origPopV37 && !window.v37PopPatched) {
    window.populateProfileTab = function(member) {
        origPopV37(member);
        setTimeout(() => {
            // Unique Pass ID Injection
            const codeEl = document.getElementById('myProfileCode');
            if (codeEl) {
                codeEl.innerHTML = `🔑 Unique Pass ID: <strong style="letter-spacing:1px; color: #D97706;">${member.qr_code || 'N/A'}</strong>`;
                codeEl.style.display = 'inline-block';
            }

            // Input Values
            if(document.getElementById('myEditMobile')) document.getElementById('myEditMobile').value = member.mobile || '';
            if(document.getElementById('myEditAddress')) document.getElementById('myEditAddress').value = member.address || '';
            
            // Display Values
            const pTags = Array.from(document.querySelectorAll('#profileTab p, #profileTab div'));
            for (let p of pTags) {
                if (p.innerHTML.includes('<strong>Mobile:</strong>') && !p.innerHTML.includes('<strong>Address:</strong>')) {
                    p.innerHTML = p.innerHTML.replace('<strong>Mobile:</strong>', `<strong>Mobile:</strong> ${member.mobile || 'N/A'}<br><strong>Address:</strong> ${member.address || 'N/A'}<br><strong style="display:none;">Mobile:</strong>`);
                    break;
                }
            }
        }, 150);
    };
    window.v37PopPatched = true;
}

// 6. MAKE PRIORITY FUNCTION
window.makeCorePriority = async function(mappingId, youthId) {
    if(!confirm("Set this as your Priority Ministry?")) return;
    try {
        await fetch('/api/ministries-v37/priority/' + mappingId, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({youth_id: youthId})
        });
        alert('Priority Ministry Updated Successfully! ⭐');
        if (window.loadMyV3Roles) window.loadMyV3Roles();
        if (window.renderHomeJourney) window.renderHomeJourney();
    } catch(e) { alert('Error updating priority.'); }
};

// 7. MEMBERSHIP LOGS (ADMIN DASHBOARD)
// A. Inject Tab HTML
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!document.getElementById('membershipAdminTab')) {
            document.getElementById('mainContainer').insertAdjacentHTML('beforeend', `
            <div id="membershipAdminTab" class="tab-content">
                <div class="sub-nav">
                    <button id="btnSubMemCommunity" class="sub-nav-btn active" onclick="switchMemSubTab('community')">🕊️ Community Intents</button>
                    <button id="btnSubMemMinistry" class="sub-nav-btn" onclick="switchMemSubTab('ministry')">🔥 Ministry Logs</button>
                </div>
                
                <div id="subTabMemCommunity" class="mem-sub-tab" style="display:block; animation: fadeIn 0.3s ease-out;">
                    <div class="card">
                        <h2 style="color: var(--primary);">🕊️ Community Intent Logs</h2>
                        <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <input type="text" id="commFilterName" class="form-control" placeholder="🔍 Search name..." oninput="filterCommunityLogs()" style="flex:1; min-width:150px;">
                            <input type="date" id="commFilterStart" class="form-control" onchange="filterCommunityLogs()" title="Start Date">
                            <input type="date" id="commFilterEnd" class="form-control" onchange="filterCommunityLogs()" title="End Date">
                        </div>
                        <div id="communityIntentsList"></div>
                    </div>
                </div>
                
                <div id="subTabMemMinistry" class="mem-sub-tab" style="display:none; animation: fadeIn 0.3s ease-out;">
                    <div class="card">
                        <h2 style="color: #F59E0B;">🔥 Master Ministry Logs</h2>
                        <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                            <input type="text" id="minLogFilterName" class="form-control" placeholder="🔍 Search name or ministry..." oninput="filterMinistryLogs()" style="flex:1; min-width:150px;">
                            <input type="date" id="minLogFilterStart" class="form-control" onchange="filterMinistryLogs()" title="Start Date">
                            <input type="date" id="minLogFilterEnd" class="form-control" onchange="filterMinistryLogs()" title="End Date">
                        </div>
                        <div id="ministryIntentsLogList"></div>
                    </div>
                </div>
            </div>`);
        }
    }, 1000);
});

// B. Sidebar Button
const origBuildNavLogs = window.buildNav;
window.buildNav = function() {
    if(origBuildNavLogs) origBuildNavLogs();
    const sidebar = document.getElementById('sidebarNav');
    if (sidebar && (window.hasPerm('edit_entries') || currentUser === 'celsocreeriii@gmail.com')) {
        if (!document.getElementById('navBtnMembership')) {
            const dirBtn = Array.from(sidebar.querySelectorAll('.nav-btn')).find(b => b.innerText.includes('Directory'));
            if (dirBtn) {
                dirBtn.insertAdjacentHTML('afterend', `<button id="navBtnMembership" class="nav-btn" data-target="membershipAdminTab" onclick="switchTab('membershipAdminTab'); loadMembershipAdminData();">🛡️ Membership Logs</button>`);
            }
        }
    }
};

window.switchMemSubTab = function(tab) {
    document.getElementById('subTabMemCommunity').style.display = tab === 'community' ? 'block' : 'none';
    document.getElementById('subTabMemMinistry').style.display = tab === 'ministry' ? 'block' : 'none';
    document.getElementById('btnSubMemCommunity').classList.toggle('active', tab === 'community');
    document.getElementById('btnSubMemMinistry').classList.toggle('active', tab === 'ministry');
    loadMembershipAdminData();
};

// C. Data Fetching & Caching
window.cachedCommunityIntents = [];
window.cachedMinistryLogs = [];

window.loadMembershipAdminData = async function() {
    try {
        const commRes = await fetch('/api/admin/community-intents-v2');
        window.cachedCommunityIntents = await commRes.json();
        window.filterCommunityLogs();
    } catch(e) {}
    try {
        const minRes = await fetch('/api/admin/ministry-logs-v36');
        window.cachedMinistryLogs = await minRes.json();
        window.filterMinistryLogs();
    } catch(e) {}
};

window.filterCommunityLogs = function() {
    const q = document.getElementById('commFilterName') ? document.getElementById('commFilterName').value.toLowerCase().trim() : '';
    const start = document.getElementById('commFilterStart') ? document.getElementById('commFilterStart').value : '';
    const end = document.getElementById('commFilterEnd') ? document.getElementById('commFilterEnd').value : '';
    let filtered = window.cachedCommunityIntents.filter(c => {
        let matchName = (c.name || '').toLowerCase().includes(q);
        let matchDate = true;
        if(start || end) {
            const intentDate = c.commitment_date ? c.commitment_date.split(' ')[0] : '';
            if(start && intentDate < start) matchDate = false;
            if(end && intentDate > end) matchDate = false;
        }
        return matchName && matchDate;
    });
    window.renderCommunityIntents(filtered);
};

window.filterMinistryLogs = function() {
    const q = document.getElementById('minLogFilterName') ? document.getElementById('minLogFilterName').value.toLowerCase().trim() : '';
    const start = document.getElementById('minLogFilterStart') ? document.getElementById('minLogFilterStart').value : '';
    const end = document.getElementById('minLogFilterEnd') ? document.getElementById('minLogFilterEnd').value : '';
    let filtered = window.cachedMinistryLogs.filter(m => {
        let matchName = (m.applicant_name || '').toLowerCase().includes(q) || (m.ministry_name || '').toLowerCase().includes(q);
        let matchDate = true;
        if(start || end) {
            const logDate = m.assigned_at ? m.assigned_at.split(' ')[0] : '';
            if(start && logDate < start) matchDate = false;
            if(end && logDate > end) matchDate = false;
        }
        return matchName && matchDate;
    });
    window.renderMinistryLogs(filtered);
};

// D. Renderers
window.renderCommunityIntents = function(list) {
    const cList = document.getElementById('communityIntentsList');
    if (!cList) return;
    if (list.length === 0) {
        cList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">No intents match your filter.</div>';
        return;
    }
    cList.innerHTML = list.map(c => `
    <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid var(--primary); margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1;">
                <strong style="color: var(--text-main); font-size: 1.05rem;">${c.name}</strong>
                <span class="badge ${c.account_tier === 'Integration Period' ? 'badge-orange' : 'badge-blue'}">${c.account_tier}</span><br>
                <small style="color: var(--text-muted);">📅 Intent submitted: ${c.commitment_date || 'Unknown'}</small>
                ${c.commitment_accepted_at ? `<br><small style="color: var(--success); font-weight: bold;">✅ Accepted: ${c.commitment_accepted_at} by ${c.commitment_accepted_by || 'Admin'}</small>` : ''}
                <p style="font-size: 0.9rem; color: var(--text-main); margin: 8px 0 0 0; background: #FFF; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); font-style: italic;">"${c.commitment_intent || 'No message provided.'}"</p>
            </div>
            ${c.account_tier === 'Integration Period' ? `<button class="btn btn-primary btn-sm" onclick="approveFullMember(${c.id})">Grant Full Member</button>` : `<span style="font-size: 0.8rem; color: var(--success); font-weight: bold; background: #D1FAE5; padding: 4px 8px; border-radius: 8px;">Completed</span>`}
        </div>
    </div>`).join('');
};

window.renderMinistryLogs = function(list) {
    const mList = document.getElementById('ministryIntentsLogList');
    if (!mList) return;
    if (list.length === 0) {
        mList.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); border: 1px dashed var(--border-color); border-radius: 8px;">No logs match your filter.</div>';
        return;
    }
    mList.innerHTML = list.map(m => `
    <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; border-left: 4px solid #F59E0B; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
            <div style="flex: 1;">
                <strong style="color: var(--text-main); font-size: 1.05rem;">${m.applicant_name}</strong>
                <span class="badge badge-orange">${m.ministry_name}</span>
                <span class="badge" style="background: #E2E8F0; color: #475569;">Current Role: ${m.role}</span><br>
                <small style="color: var(--text-muted);">📅 Action Logged: <strong style="color:var(--text-main);">${m.timestamp || m.assigned_at || 'Unknown Time'}</strong></small><br>
                <small style="color: var(--success); font-weight: bold;">👤 Processed by: ${m.actor || 'Admin / System'}</small>
                <p style="font-size: 0.95rem; color: var(--text-main); margin: 8px 0 0 0; background: #FFF; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); font-weight: 500;">
                    📝 ${m.intent_message || 'Assigned directly by Admin.'}
                </p>
            </div>
        </div>
    </div>`).join('');
};

window.approveFullMember = async function(id) {
    if(!confirm('Advance this user from Integration Period to Full Committed Member?')) return;
    try {
        await fetch('/api/admin/community-intents-v2/' + id + '/approve', { 
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ actor: (window.currentMember && window.currentMember.name) ? window.currentMember.name : currentUser })
        });
        window.loadMembershipAdminData();
    } catch(e) { alert('Error processing approval.'); }
};

// ==========================================
// V39: FULL NAME LOGS & CLEAN PROFILE UI
// ==========================================

// 1. BULLETPROOF FETCH INTERCEPTOR (Extracts Real Name from LocalStorage)
if (!window.v39FetchPatched) {
    const nativeFetchV39 = window.fetch;
    window.fetch = async function(url, options) {
        if (options && options.method === 'PUT' && typeof url === 'string' && url.includes('/members/') && url.includes('/api/ministries')) {
            try {
                url = url.replace(/\/api\/ministries(\-v\d+)?\//, '/api/ministries-v36/');
                if (options.body) {
                    let bodyObj = JSON.parse(options.body);
                    
                    // Forcefully rip the full name directly from the local cache
                    let realName = window.currentUser || 'Admin';
                    try {
                        const localUser = JSON.parse(localStorage.getItem('fog_user'));
                        if (localUser && localUser.member && localUser.member.name) {
                            realName = localUser.member.name;
                        }
                    } catch(err) {}
                    
                    bodyObj.actor = realName;
                    options.body = JSON.stringify(bodyObj);
                }
            } catch(e) {}
        }
        
        // Profile Update Interceptor
        if (options && options.method === 'PUT' && typeof url === 'string' && url.includes('/api/youth/profile/')) {
            try {
                url = url.replace(/\/api\/youth(\-v\d+)?\/profile\//, '/api/youth-v37/profile/');
                if (options.body) {
                    let bodyObj = JSON.parse(options.body);
                    const myMob = document.getElementById('myEditMobile'), myAdd = document.getElementById('myEditAddress');
                    const edMob = document.getElementById('editMemberMobile'), edAdd = document.getElementById('editMemberAddress');
                    if (myMob && myMob.value) bodyObj.mobile = myMob.value;
                    if (myAdd && myAdd.value) bodyObj.address = myAdd.value;
                    if (edMob && edMob.value) bodyObj.mobile = edMob.value;
                    if (edAdd && edAdd.value) bodyObj.address = edAdd.value;
                    options.body = JSON.stringify(bodyObj);
                }
            } catch(e) {}
        }
        return nativeFetchV39.apply(this, [url, options]);
    };
    window.v39FetchPatched = true;
}

// 2. CLEAN PROFILE UI (Wipes Redundant Mobile)
const origPopV39 = window.populateProfileTab;
window.populateProfileTab = function(member) {
    if (origPopV39) origPopV39(member);
    setTimeout(() => {
        const pTags = Array.from(document.querySelectorAll('#profileTab p, #profileTab div'));
        for (let p of pTags) {
            // Find the exact paragraph holding the contact info and rebuild it from scratch
            if (p.innerHTML.includes('<strong>Mobile:</strong>') || p.innerHTML.includes('<strong>Email:</strong>')) {
                p.innerHTML = `<strong>Email:</strong> ${member.email || 'N/A'}<br>
                               <strong>Mobile:</strong> ${member.mobile || 'N/A'}<br>
                               <strong>Address:</strong> ${member.address || 'N/A'}`;
                break; // Stop after fixing the contact block
            }
        }
    }, 200);
};

// ==========================================
// V40: RESTORE PROFILE DETAILS & DATE UI
// ==========================================

// 2. STANDARDIZE DATE PICKER UI (Compact "From / To" Pill Design)
setInterval(() => {
    ['commFilter', 'minLogFilter'].forEach(prefix => {
        const startInput = document.getElementById(prefix + 'Start');
        if (startInput && !startInput.parentElement.classList.contains('date-pill')) {
            const container = startInput.parentElement;
            container.style.alignItems = 'center';
            
            // Wrap Start Date
            const startWrapper = document.createElement('div');
            startWrapper.className = 'date-pill';
            startWrapper.style.cssText = 'display:flex; align-items:center; gap:6px; background:#FFF; padding:6px 10px; border-radius:8px; border:1px solid #CBD5E1; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);';
            startInput.parentNode.insertBefore(startWrapper, startInput);
            startWrapper.innerHTML = '<span style="font-size:0.85rem; color:#64748B; font-weight:bold;">From</span>';
            startWrapper.appendChild(startInput);
            startInput.style.cssText = 'border:none; outline:none; background:transparent; cursor:pointer; font-size:0.9rem; color:var(--text-main);';

            // Wrap End Date
            const endInput = document.getElementById(prefix + 'End');
            if (endInput) {
                const endWrapper = document.createElement('div');
                endWrapper.className = 'date-pill';
                endWrapper.style.cssText = 'display:flex; align-items:center; gap:6px; background:#FFF; padding:6px 10px; border-radius:8px; border:1px solid #CBD5E1; box-shadow:inset 0 1px 2px rgba(0,0,0,0.05);';
                endInput.parentNode.insertBefore(endWrapper, endInput);
                endWrapper.innerHTML = '<span style="font-size:0.85rem; color:#64748B; font-weight:bold;">To</span>';
                endWrapper.appendChild(endInput);
                endInput.style.cssText = 'border:none; outline:none; background:transparent; cursor:pointer; font-size:0.9rem; color:var(--text-main);';
            }
        }
    });
}, 1000);

// ==========================================
// V48: NATIVE NAV OBSERVER & GROUPS MODAL
// ==========================================

// 1. REBUILD MISSING GROUPS FUNCTION
window.openGroupDashboard = function(id, name, logo, leader, leader_id) {
    const modal = document.getElementById('groupDashboardModal');
    if (modal) {
        // Populate the modal data natively
        const nameEl = document.getElementById('dashGroupName');
        if (nameEl) nameEl.innerText = name || 'Group Name';
        
        const metaEl = document.getElementById('dashGroupMeta');
        if (metaEl) metaEl.innerText = leader ? ('Led by ' + leader) : 'Ministry Group';
        
        const logoEl = document.getElementById('dashGroupLogo');
        if (logoEl) logoEl.innerText = logo || '👥';

        // Force it open securely
        modal.style.display = 'flex';
        modal.style.zIndex = '105000';
        modal.classList.add('active');
    } else {
        console.error("Dashboard Modal not found in DOM");
    }
};

// 2. NATIVE MUTATION OBSERVER FOR BOTTOM NAV
document.addEventListener('DOMContentLoaded', () => {
    const bNav = document.getElementById('bottomNav');
    if (bNav && !window.v48ObserverActive) {
        window.v48ObserverActive = true;
        
        const navObserver = new MutationObserver((mutations) => {
            const html = bNav.innerHTML.toLowerCase();
            
            // Intercept only when Growth Tab injects 'rank'
            if (html.includes('rank') && !bNav.classList.contains('v48-processing')) {
                bNav.classList.add('v48-processing');
                
                // Rebuild using EXACT NATIVE CLASSES. No inline CSS to ruin the layout.
                bNav.innerHTML = `
                    <button class="bottom-nav-btn" onclick="if(typeof switchTab==='function') switchTab('profileTab')"><span>👤</span>Profile</button>
                    <button class="bottom-nav-btn active" onclick="if(typeof switchTab==='function') switchTab('growthTab')"><span>🌱</span>Growth</button>
                    <button class="bottom-nav-btn" onclick="if(typeof switchTab==='function') switchTab('pathwayTab')"><span>🗺️</span>Paths</button>
                    <button class="bottom-nav-btn" onclick="if(typeof switchTab==='function') switchTab('journalTab')"><span>📖</span>Journal</button>
                    <button class="bottom-nav-btn" onclick="if(typeof switchTab==='function') switchTab('groupsTab')"><span>👥</span>Groups</button>
                    <button class="bottom-nav-btn" onclick="if(typeof openSidebar==='function') openSidebar(); else { const sb = document.getElementById('sidebarNav'); if(sb) { sb.style.display = window.getComputedStyle(sb).display === 'none' ? 'block' : 'none'; sb.style.zIndex='999999'; } }"><span>☰</span>Menu</button>
                `;
                
                setTimeout(() => { bNav.classList.remove('v48-processing'); }, 50);
            }
        });
        
        navObserver.observe(bNav, { childList: true });
    }
});

// ========================================================
// EVENT-DRIVEN NAVIGATION ARCHITECTURE
// ========================================================

window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');
    const isAdmin = currentUser === 'celsocreeriii@gmail.com' || (userPermissions && userPermissions.length > 0);

    let sidebarHtml = `<h2>Main Menu</h2>`;
    
    // Delegate bottom nav rendering strictly to renderBottomNav.
    // We only enforce its flex display state here globally.
    if (bottomNav) bottomNav.style.display = 'flex';

    if (isAdmin) {
        if(hamburger) hamburger.style.display = 'block';
        
        sidebarHtml += `<button class="nav-btn" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>`;
        sidebarHtml += `<button class="nav-btn" data-target="inboxTab" onclick="switchTab('inboxTab')">🔔 My Inbox</button>`; 
        
        if (window.hasPerm('access_checkin')) sidebarHtml += `<button class="nav-btn" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
        if (window.hasPerm('access_directory')) sidebarHtml += `<button class="nav-btn" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
        if (window.hasPerm('access_ministries')) sidebarHtml += `<button class="nav-btn" data-target="ministriesTab" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>`;
        if (window.hasPerm('access_events')) sidebarHtml += `<button class="nav-btn" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
        
        sidebarHtml += `<button class="nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">📖 Personal Growth</button>`;
        if (window.hasPerm('access_discipleship')) sidebarHtml += `<button class="nav-btn" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')">🌱 Discipleship Admin</button>`;
        if (window.hasPerm('access_worship')) sidebarHtml += `<button class="nav-btn" data-target="worshipTab" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>`;
        if (window.hasPerm('access_communications')) sidebarHtml += `<button class="nav-btn" data-target="communicationsAdminTab" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>`;
        if (window.hasPerm('access_ai')) sidebarHtml += `<button class="nav-btn" data-target="aiAssistantTab" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>`;
        
        if (window.hasPerm('access_attendance')) sidebarHtml += `<button class="nav-btn" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>`;
        if (window.hasPerm('access_activity')) sidebarHtml += `<button class="nav-btn" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">🔍 Audit Logs</button>`;
        if (window.hasPerm('access_permissions')) sidebarHtml += `<button class="nav-btn" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔐 Permissions</button>`;
        
        sidebarHtml += `<button class="nav-btn text-danger" onclick="handleLogout()">🚪 Logout (${currentUser})</button>`;
        
        if(sidebar) sidebar.innerHTML = sidebarHtml;
    } else {
        if(hamburger) hamburger.style.display = 'none';
        if(sidebar) sidebar.innerHTML = '';
    }
};

window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    
    let bHtml = '';

    if (context === 'discipleshipTab') {
        // Growth Mode (7 Icons)
        bHtml = `
        <button class="bottom-nav-btn" data-target="profileTab" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn active" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')"><span>🌱</span>Growth</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    } else {
        // Default Mode (7 Icons)
        bHtml = `
        <button class="bottom-nav-btn" data-target="pulseDashboardTab" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
        <button class="bottom-nav-btn" data-target="profileTab" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn" data-target="arcadeTab" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
        <button class="bottom-nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')"><span>🌱</span>Grow</button>
        <button class="bottom-nav-btn" data-target="inboxTab" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
        <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab'); setTimeout(() => { if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer'); }, 50);"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    }
    
    bottomNav.innerHTML = bHtml;
};

window.switchTab = function(tabId) {
    // 1. Render Navigation layout dynamically based on state first.
    // By providing the data-target attributes inside the HTML rendering above, 
    // the logic below inherently tracks them natively.
    if (typeof window.renderBottomNav === 'function') window.renderBottomNav(tabId);

    // 2. Safely apply native CSS routing classes without loops/observers
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
    
    // 3. Tab-specific logical triggers
    if (tabId !== 'checkinTab' && typeof qrScanner !== 'undefined' && qrScanner) { qrScanner.clear().catch(e => console.log(e)); qrScanner = null; }
    if (tabId === 'checkinTab') { window.switchCheckinMode('scanner'); window.updateActiveEventBanner(); }
    if (tabId === 'directoryTab') window.loadDirectory();
    if (tabId === 'eventsTab') window.loadEvents();
    if (tabId === 'ministriesTab') window.loadMinistries();
    if (tabId === 'attendanceTab') window.loadAttendanceLogs();
    if (tabId === 'activityLogsTab') window.loadActivityLogs();
    if (tabId === 'permissionsTab') window.resetPermUserList();

    if (tabId === 'profileTab' && currentUser === 'celsocreeriii@gmail.com') {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'block';
        if(typeof window.loadBackups === 'function') window.loadBackups();
    } else {
        const backupCard = document.getElementById('adminBackupCard');
        if(backupCard) backupCard.style.display = 'none';
    }
};

// ==========================================
// V41: PROFILE DETAILS & GROWTH SUB-NAV FIX
// ==========================================

// FIX 1: Restore all profile details (Overriding V39 truncation safely)
const origPopV40 = window.populateProfileTab;
window.populateProfileTab = function(member) {
    if (origPopV40) origPopV40(member);
    
    // We use a 300ms timeout to safely execute AFTER V39's 200ms wipe
    setTimeout(() => {
        const bio = document.getElementById('myBioSummary');
        if (bio) {
            bio.innerHTML = `
                <strong>Gender:</strong> ${member.gender || 'N/A'}<br>
                <strong>Email:</strong> ${member.email || 'N/A'}<br>
                <strong>Mobile:</strong> ${member.mobile || 'N/A'}<br>
                <strong>Address:</strong> ${member.address || 'N/A'}<br>
                <strong>Age:</strong> ${member.age || 'N/A'}<br>
                <strong>Birthday:</strong> ${member.birthday || 'N/A'}<br>
                <strong>Social Media Handle:</strong> ${member.social_media || 'N/A'}<br>
                <strong>Parents/Guardian:</strong> ${member.parents_name || 'N/A'}
            `;
        }
    }, 300);
};

// FIX 2: Implement missing switchGrowthSubTab mapping for Bottom Navigation
window.switchGrowthSubTab = function(subTabName) {
    // 1. Hide all growth sub-tabs
    document.querySelectorAll('.growth-sub-tab').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    
    // 2. Show the target sub-tab natively mapped to your index.html
    const targetId = 'growthSub' + subTabName;
    const targetEl = document.getElementById(targetId);
    
    if (targetEl) {
        targetEl.classList.add('active');
        targetEl.style.display = 'block';
    } else {
        // Failsafe to Growth Home
        const homeEl = document.getElementById('growthSubHome');
        if(homeEl) { homeEl.classList.add('active'); homeEl.style.display = 'block'; }
    }

    // 3. Trigger Data Loads Dynamically so pages aren't empty when clicked
    if (typeof V2Discipleship !== 'undefined') {
        if (subTabName === 'Prayer') V2Discipleship.loadPrayers();
        if (subTabName === 'Journal') V2Discipleship.loadJournals();
        if (subTabName === 'Milestones') V2Discipleship.loadPathways();
        if (subTabName === 'Groups') V2Discipleship.loadSmallGroups();
    }
};

// ========================================================
// V42: ABSOLUTE PROFILE TRUTH & GROWTH NAVIGATION FIX
// ========================================================

// 1. Definitively define the Profile Populator (Bypassing V39 wipe)
window.populateProfileTab = function(member) {
    if (!member) return;

    const safeText = (val) => val && val !== 'null' ? val : 'N/A';
    
    // Map all 8 personal details securely
    const bio = document.getElementById('myBioSummary');
    if (bio) {
        bio.innerHTML = `
            <strong>Gender:</strong> ${safeText(member.gender)}<br>
            <strong>Email:</strong> ${safeText(member.email)}<br>
            <strong>Mobile Number:</strong> ${safeText(member.mobile)}<br>
            <strong>Address:</strong> ${safeText(member.address)}<br>
            <strong>Age:</strong> ${safeText(member.age)}<br>
            <strong>Birthday:</strong> ${safeText(member.birthday)}<br>
            <strong>Social Media:</strong> ${safeText(member.social_media)}<br>
            <strong>Parents/Guardian:</strong> ${safeText(member.parents_name)}
        `;
    }

    // Map inputs safely
    ['myMemberId','myEditName','myEditEmail','myEditAge','myEditBirthday','myEditSocial','myEditParents','myEditGender','myEditMobile','myEditAddress'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let key = id.replace('myEdit', '').toLowerCase();
            if(id === 'myEditParents') key = 'parents_name';
            if(id === 'myEditSocial') key = 'social_media';
            if(id === 'myMemberId') key = 'id';
            el.value = member[key] || '';
        }
    });

    if(document.getElementById('myProfileName')) document.getElementById('myProfileName').innerText = member.name || 'Community Member';

    // QR Code
    const codeEl = document.getElementById('myProfileCode');
    if (codeEl) {
        codeEl.innerHTML = `🔑 Unique Pass ID: <strong style="letter-spacing:1px; color: #D97706;">${member.qr_code || 'N/A'}</strong>`;
        codeEl.style.display = 'inline-block';
    }

    const qrContainer = document.getElementById('myQrContainer');
    const dlBtn = document.getElementById('myDownloadQrBtn');
    if (qrContainer && dlBtn) {
        if (member.qr_code) {
            const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(member.qr_code);
            qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:100%; height:auto; border-radius:8px; border: 1px solid var(--border-color);">`;
            dlBtn.href = qrUrl;
            dlBtn.style.display = 'inline-block';
        } else {
            qrContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No QR Assigned</span>';
            dlBtn.style.display = 'none';
        }
    }

    const av = document.getElementById('myProfileAvatar');
    if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

    if (window.loadMyV3Roles) window.loadMyV3Roles(member.id, 'myMinistriesHistory');
    if (window.loadMyV3Attendance) window.loadMyV3Attendance(member.id, 'myAttendanceHistory');
};

// 2. Attach to Tab Switch for INSTANT rendering without refresh
const ogSwitchTabProf = window.switchTab;
window.switchTab = async function(tabId) {
    if (ogSwitchTabProf) ogSwitchTabProf(tabId);
    if (tabId === 'profileTab' && typeof currentMember !== 'undefined' && currentMember) {
        window.populateProfileTab(currentMember); // Instant load
        
        // Background fetch to update cache silently
        fetch('/api/youth').then(r=>r.json()).then(users => {
            const fresh = users.find(u => u.id == currentMember.id);
            if (fresh) {
                currentMember = fresh;
                localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
                window.populateProfileTab(fresh);
            }
        }).catch(e=>{});
    }
};

// 3. Prevent V39 from ruining the profile layout
setInterval(() => {
    const bio = document.getElementById('myBioSummary');
    if(bio && bio.innerHTML.split('<br>').length <= 4 && typeof currentMember !== 'undefined' && currentMember) {
        window.populateProfileTab(currentMember);
    }
}, 500);

// 4. Update the Bottom Nav to explicitly reset Growth Tab
window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;

    let bHtml = '';
    if (context === 'discipleshipTab') {
        bHtml = `
        <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn active" onclick="switchTab('discipleshipTab'); if(window.switchGrowthSubTab) window.switchGrowthSubTab('Home');"><span>🌱</span>Growth</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    } else {
        bHtml = `
        <button class="bottom-nav-btn ${context === 'pulseDashboardTab' ? 'active' : ''}" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
        <button class="bottom-nav-btn ${context === 'profileTab' ? 'active' : ''}" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn ${context === 'arcadeTab' ? 'active' : ''}" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
        <button class="bottom-nav-btn ${context === 'discipleshipTab' ? 'active' : ''}" onclick="switchTab('discipleshipTab'); if(window.switchGrowthSubTab) window.switchGrowthSubTab('Home');"><span>🌱</span>Grow</button>
        <button class="bottom-nav-btn ${context === 'inboxTab' ? 'active' : ''}" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
        <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab'); setTimeout(() => { if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer'); }, 50);"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    }
    bottomNav.innerHTML = bHtml;
};

// ========================================================
// V43: ABSOLUTE PROFILE TRUTH & GROWTH NAVIGATION FIX
// ========================================================

// 1. Definitively define the Profile Populator (Bypassing legacy wipes)
window.populateProfileTab = function(member) {
    if (!member) return;

    // Inject Gender Field securely if missing
    if (!document.getElementById('myEditGender') && document.getElementById('myEditName')) {
        document.getElementById('myEditName').parentElement.insertAdjacentHTML('afterend', `
        <div class="form-group"><label>Gender</label><select id="myEditGender" class="form-control"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>`);
    }

    // Inject Mobile and Address if missing
    const myEmailGroup = document.getElementById('myEditEmail');
    if (myEmailGroup && !document.getElementById('myEditMobile')) {
        myEmailGroup.parentElement.insertAdjacentHTML('afterend', `
            <div class="form-group"><label>Mobile Number</label><input type="text" id="myEditMobile" class="form-control" placeholder="e.g. 09123456789"></div>
            <div class="form-group"><label>Address</label><input type="text" id="myEditAddress" class="form-control" placeholder="Enter full address"></div>
        `);
    }

    const safeText = (val) => val && val !== 'null' ? val : 'N/A';
    
    // Map all 8 personal details securely
    const bio = document.getElementById('myBioSummary');
    if (bio) {
        bio.innerHTML = `
            <strong>Gender:</strong> ${safeText(member.gender)}<br>
            <strong>Email:</strong> ${safeText(member.email)}<br>
            <strong>Mobile Number:</strong> ${safeText(member.mobile)}<br>
            <strong>Address:</strong> ${safeText(member.address)}<br>
            <strong>Age:</strong> ${safeText(member.age)}<br>
            <strong>Birthday:</strong> ${safeText(member.birthday)}<br>
            <strong>Social Media Handle:</strong> ${safeText(member.social_media)}<br>
            <strong>Parents/Guardian:</strong> ${safeText(member.parents_name)}
        `;
    }

    // Map inputs safely
    ['myMemberId','myEditName','myEditEmail','myEditAge','myEditBirthday','myEditSocial','myEditParents','myEditGender','myEditMobile','myEditAddress'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let key = id.replace('myEdit', '').toLowerCase();
            if(id === 'myEditParents') key = 'parents_name';
            if(id === 'myEditSocial') key = 'social_media';
            if(id === 'myMemberId') key = 'id';
            el.value = member[key] || '';
        }
    });

    if(document.getElementById('myProfileName')) document.getElementById('myProfileName').innerText = member.name || 'Community Member';

    // QR Code Engine
    const codeEl = document.getElementById('myProfileCode');
    if (codeEl) {
        codeEl.innerHTML = `🔑 Unique Pass ID: <strong style="letter-spacing:1px; color: #D97706;">${member.qr_code || 'N/A'}</strong>`;
        codeEl.style.display = 'inline-block';
    }

    const qrContainer = document.getElementById('myQrContainer');
    const dlBtn = document.getElementById('myDownloadQrBtn');
    if (qrContainer && dlBtn) {
        if (member.qr_code) {
            const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(member.qr_code);
            qrContainer.innerHTML = `<img src="${qrUrl}" alt="QR" style="width:100%; height:auto; border-radius:8px; border: 1px solid var(--border-color);">`;
            dlBtn.href = qrUrl;
            dlBtn.style.display = 'inline-block';
        } else {
            qrContainer.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">No QR Assigned</span>';
            dlBtn.style.display = 'none';
        }
    }

    const av = document.getElementById('myProfileAvatar');
    if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

    if (window.loadMyV3Roles) window.loadMyV3Roles(member.id, 'myMinistriesHistory');
    if (window.loadMyV3Attendance) window.loadMyV3Attendance(member.id, 'myAttendanceHistory');
};

// 2. Attach to Tab Switch for INSTANT rendering without refresh
const ogSwitchTabProfV43 = window.switchTab;
window.switchTab = async function(tabId) {
    if (ogSwitchTabProfV43) ogSwitchTabProfV43(tabId);
    if (tabId === 'profileTab' && typeof currentMember !== 'undefined' && currentMember) {
        window.populateProfileTab(currentMember); // Instant load cache
        
        // Background fetch to update cache silently
        fetch('/api/youth').then(r=>r.json()).then(users => {
            const fresh = users.find(u => u.id == currentMember.id);
            if (fresh) {
                currentMember = fresh;
                localStorage.setItem('fog_user', JSON.stringify({ username: currentUser, permissions: userPermissions, member: currentMember }));
                window.populateProfileTab(fresh);
            }
        }).catch(e=>{});
    }
};

// 3. Update Bottom Nav explicitly reset Growth Tab and neutralize observers
window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    
    // Neutralize legacy V48 observer
    bottomNav.classList.add('v48-processing');

    let bHtml = '';
    if (context === 'discipleshipTab') {
        bHtml = `
        <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn active" onclick="switchTab('discipleshipTab'); if(window.switchGrowthSubTab) window.switchGrowthSubTab('Home');"><span>🌱</span>Growth</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    } else {
        bHtml = `
        <button class="bottom-nav-btn ${context === 'pulseDashboardTab' ? 'active' : ''}" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
        <button class="bottom-nav-btn ${context === 'profileTab' ? 'active' : ''}" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn ${context === 'arcadeTab' ? 'active' : ''}" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
        <button class="bottom-nav-btn ${context === 'discipleshipTab' ? 'active' : ''}" onclick="switchTab('discipleshipTab'); if(window.switchGrowthSubTab) window.switchGrowthSubTab('Home');"><span>🌱</span>Grow</button>
        <button class="bottom-nav-btn ${context === 'inboxTab' ? 'active' : ''}" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
        <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab'); setTimeout(() => { if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer'); }, 50);"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    }
    bottomNav.innerHTML = bHtml;
};

// 4. Force data fetching when Growth sub-tabs are clicked
window.switchGrowthSubTab = function(subTabName) {
    document.querySelectorAll('.growth-sub-tab').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    
    const targetEl = document.getElementById('growthSub' + subTabName);
    if (targetEl) {
        targetEl.classList.add('active');
        targetEl.style.display = 'block';
    }

    if (typeof V2Discipleship !== 'undefined') {
        if (subTabName === 'Home') {
            V2Discipleship.loadLiturgicalData();
            V2Discipleship.loadNextStep();
        }
        if (subTabName === 'Prayer') V2Discipleship.loadPrayers();
        if (subTabName === 'Journal') V2Discipleship.loadJournals();
        if (subTabName === 'Groups') V2Discipleship.loadSmallGroups();
        if (subTabName === 'Milestones') {
            V2Discipleship.loadPathways();
            if (typeof currentMember !== 'undefined' && currentMember) {
                fetch('/api/discipleship/member-progress/' + currentMember.id)
                    .then(r=>r.json())
                    .then(progress => {
                        const userList = document.getElementById('pathwaysListContainer');
                        if (userList) {
                            if (progress.length === 0) {
                                userList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No active pathways available.</p>';
                                return;
                            }
                            userList.innerHTML = progress.map(p => {
                                const isCompleted = p.status === 'Completed'; 
                                const badge = isCompleted ? '<span class="badge badge-green">✅ Completed</span>' : '<span class="badge badge-orange">⏳ Pending</span>'; 
                                const actionBtn = !isCompleted ? `<button class="btn btn-primary btn-sm" onclick="V2Discipleship.updateMilestone(${p.pathway_id}, 'Completed')">Mark Complete</button>` : '';
                                return `<div style="background:#FFF; border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:var(--text-main); font-size:1.05rem;">${p.title}</strong><div style="margin-top:5px;">${badge}</div></div><div>${actionBtn}</div></div>`;
                            }).join('');
                        }
                    });
            }
        }
    }
};

// ========================================================
// V44: DEFINITIVE UI ENFORCEMENT & ROUTING FIX
// ========================================================

// 1. Force Growth Tab to Reset to Home securely
const _v44SwitchTab = window.switchTab;
window.switchTab = async function(tabId) {
    if (_v44SwitchTab) _v44SwitchTab(tabId);
    if (tabId === 'discipleshipTab' && typeof window.switchGrowthSubTab === 'function') {
        // Slight delay ensures Bottom Nav finishes re-rendering before switching sub-tabs
        setTimeout(() => { window.switchGrowthSubTab('Home'); }, 50);
    }
};

// 2. Clean Bottom Nav HTML (Remove dangerous inline sub-tab calls)
window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    bottomNav.classList.add('v48-processing'); // Block old observers

    let bHtml = '';
    if (context === 'discipleshipTab') {
        bHtml = `
        <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn active" onclick="switchTab('discipleshipTab')"><span>🌱</span>Growth</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
        <button class="bottom-nav-btn" onclick="if(window.switchGrowthSubTab) window.switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    } else {
        bHtml = `
        <button class="bottom-nav-btn ${context === 'pulseDashboardTab' ? 'active' : ''}" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
        <button class="bottom-nav-btn ${context === 'profileTab' ? 'active' : ''}" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn ${context === 'arcadeTab' ? 'active' : ''}" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
        <button class="bottom-nav-btn ${context === 'discipleshipTab' ? 'active' : ''}" onclick="switchTab('discipleshipTab')"><span>🌱</span>Grow</button>
        <button class="bottom-nav-btn ${context === 'inboxTab' ? 'active' : ''}" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
        <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab'); setTimeout(() => { if(window.switchGrowthSubTab) window.switchGrowthSubTab('Prayer'); }, 50);"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    }
    bottomNav.innerHTML = bHtml;
};

// 3. Unbreakable Loop to Enforce Profile Gender & 8 Details
setInterval(() => {
    if (!document.getElementById('myEditGender') && document.getElementById('myEditName')) {
        document.getElementById('myEditName').parentElement.insertAdjacentHTML('afterend', `
        <div class="form-group"><label>Gender</label><select id="myEditGender" class="form-control"><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option></select></div>`);
        if(typeof currentMember !== 'undefined' && currentMember && currentMember.gender) document.getElementById('myEditGender').value = currentMember.gender;
    }

    const bio = document.getElementById('myBioSummary');
    if (bio && typeof currentMember !== 'undefined' && currentMember) {
        const safeText = (val) => val && val !== 'null' ? val : 'N/A';
        const correctHTML = `
            <strong>Gender:</strong> ${safeText(currentMember.gender)}<br>
            <strong>Email:</strong> ${safeText(currentMember.email)}<br>
            <strong>Mobile Number:</strong> ${safeText(currentMember.mobile)}<br>
            <strong>Address:</strong> ${safeText(currentMember.address)}<br>
            <strong>Age:</strong> ${safeText(currentMember.age)}<br>
            <strong>Birthday:</strong> ${safeText(currentMember.birthday)}<br>
            <strong>Social Media Handle:</strong> ${safeText(currentMember.social_media)}<br>
            <strong>Parents/Guardian:</strong> ${safeText(currentMember.parents_name)}
        `;
        if (bio.innerHTML.replace(/\s+/g, '') !== correctHTML.replace(/\s+/g, '')) {
            bio.innerHTML = correctHTML;
        }
    }
}, 1000);

// ========================================================
// V46: SERVICE WORKER ASSASSIN & ROUTER
// ========================================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            registration.unregister();
        }
    });
}

window.switchTab = function(tabId, subTabId = null) {
    if (typeof window.renderBottomNav === 'function') window.renderBottomNav(tabId);

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

    if (tabId === 'discipleshipTab') {
        if (typeof window.switchGrowthSubTab === 'function') {
            setTimeout(() => { window.switchGrowthSubTab(subTabId || 'Home'); }, 50);
        }
    }
};

window.renderBottomNav = function(context) {
    const bottomNav = document.getElementById('bottomNav');
    if (!bottomNav) return;
    
    let bHtml = '';
    if (context === 'discipleshipTab') {
        bHtml = `
        <button class="bottom-nav-btn" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn active" onclick="switchTab('discipleshipTab', 'Home')"><span>🌱</span>Growth</button>
        <button class="bottom-nav-btn" onclick="switchGrowthSubTab('Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="switchGrowthSubTab('Milestones')"><span>🗺️</span>Paths</button>
        <button class="bottom-nav-btn" onclick="switchGrowthSubTab('Journal')"><span>📖</span>Journal</button>
        <button class="bottom-nav-btn" onclick="switchGrowthSubTab('Groups')"><span>👥</span>Groups</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    } else {
        bHtml = `
        <button class="bottom-nav-btn ${context === 'pulseDashboardTab' ? 'active' : ''}" onclick="switchTab('pulseDashboardTab')"><span>🏠</span>Home</button>
        <button class="bottom-nav-btn ${context === 'profileTab' ? 'active' : ''}" onclick="switchTab('profileTab')"><span>👤</span>Profile</button>
        <button class="bottom-nav-btn ${context === 'arcadeTab' ? 'active' : ''}" onclick="switchTab('arcadeTab')"><span>🎯</span>Arcade</button>
        <button class="bottom-nav-btn ${context === 'discipleshipTab' ? 'active' : ''}" onclick="switchTab('discipleshipTab', 'Home')"><span>🌱</span>Grow</button>
        <button class="bottom-nav-btn ${context === 'inboxTab' ? 'active' : ''}" onclick="switchTab('inboxTab')"><span>🔔</span>Inbox</button>
        <button class="bottom-nav-btn" onclick="switchTab('discipleshipTab', 'Prayer')"><span>🙏</span>Prayer</button>
        <button class="bottom-nav-btn" onclick="window.openSidebar()" style="margin-left: auto;"><span>☰</span>Menu</button>
        `;
    }
    bottomNav.innerHTML = bHtml;
};

// ==========================================
// HOTFIX: SIDEBAR MEMBERSHIP LOGS & HOME JOURNEY
// ==========================================

// --- 1. DEFINITIVE SIDEBAR MENU WITH MEMBERSHIP LOGS ---
window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');
    const isAdmin = window.hasPerm && (window.hasPerm('edit_entries') || currentUser === 'celsocreeriii@gmail.com');

    if (bottomNav) bottomNav.style.display = 'flex';

    let sidebarHtml = `
        <div class="sidebar-header">
            <img src="/img/logo.png" alt="Logo" class="fog-header-logo" onerror="this.style.display='none'">
            <h2>FOG V3</h2>
        </div>
        <button class="nav-btn" data-target="pulseDashboardTab" onclick="switchTab('pulseDashboardTab')">🏠 Home</button>
        <button class="nav-btn" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>
        <button class="nav-btn" data-target="inboxTab" onclick="switchTab('inboxTab')">🔔 Inbox</button>
        <button class="nav-btn" data-target="arcadeTab" onclick="switchTab('arcadeTab')">🎯 FOG Arcade</button>
        <button class="nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">🌱 Spiritual Growth</button>
    `;

    if (isAdmin) {
        if (hamburger) hamburger.style.display = 'block';
        sidebarHtml += `
            <hr style="border-color: #334155; margin: 15px 0;">
            <p style="color: #94A3B8; font-size: 0.75rem; margin-left: 15px; text-transform: uppercase;">Leadership Tools</p>
            <button class="nav-btn" data-target="checkinTab" onclick="switchTab('checkinTab')">📸 Event Check-In</button>
            <button class="nav-btn" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Admin</button>
            <button class="nav-btn" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>
            <button class="nav-btn" data-target="membershipAdminTab" onclick="switchTab('membershipAdminTab'); if(window.loadMembershipAdminData) window.loadMembershipAdminData();">🛡️ Membership Logs</button>
            <button class="nav-btn" data-target="ministriesTab" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>
            <button class="nav-btn" data-target="worshipTab" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>
            <button class="nav-btn" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')">⚙️ Discipleship Admin</button>
            <button class="nav-btn" data-target="communicationsAdminTab" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>
            <button class="nav-btn" data-target="aiAssistantTab" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>
            <button class="nav-btn" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔑 Permissions</button>
            <button class="nav-btn" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>
            <button class="nav-btn" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">📝 Audit Logs</button>
        `;
    } else {
        if (hamburger) hamburger.style.display = 'none';
    }

    sidebarHtml += `<button class="nav-btn text-danger" onclick="logout()" style="margin-top: auto;">🚪 Logout</button>`;
    if(sidebar) sidebar.innerHTML = sidebarHtml;
    
    // Ensure Membership Admin Tab exists in HTML
    if (!document.getElementById('membershipAdminTab')) {
        document.getElementById('mainContainer').insertAdjacentHTML('beforeend', `
        <div id="membershipAdminTab" class="tab-content">
            <div class="sub-nav">
                <button id="btnSubMemCommunity" class="sub-nav-btn active" onclick="switchMemSubTab('community')">🕊️ Community Intents</button>
                <button id="btnSubMemMinistry" class="sub-nav-btn" onclick="switchMemSubTab('ministry')">🔥 Ministry Logs</button>
            </div>
            <div id="subTabMemCommunity" class="mem-sub-tab" style="display:block; animation: fadeIn 0.3s ease-out;">
                <div class="card">
                    <h2 style="color: var(--primary);">🕊️ Community Intent Logs</h2>
                    <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <input type="text" id="commFilterName" class="form-control" placeholder="🔍 Search name..." oninput="if(window.filterCommunityLogs) window.filterCommunityLogs()" style="flex:1; min-width:150px;">
                    </div>
                    <div id="communityIntentsList"></div>
                </div>
            </div>
            <div id="subTabMemMinistry" class="mem-sub-tab" style="display:none; animation: fadeIn 0.3s ease-out;">
                <div class="card">
                    <h2 style="color: #F59E0B;">🔥 Master Ministry Logs</h2>
                    <div style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; background: #F8FAFC; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                        <input type="text" id="minLogFilterName" class="form-control" placeholder="🔍 Search name or ministry..." oninput="if(window.filterMinistryLogs) window.filterMinistryLogs()" style="flex:1; min-width:150px;">
                    </div>
                    <div id="ministryIntentsLogList"></div>
                </div>
            </div>
        </div>`);
    }
};

// --- 2. HOME DASHBOARD JOURNEY BUTTONS FIX ---
window.renderHomeJourney = async function() {
    const container = document.getElementById('dynamicJourneyContainer');
    if (!container || !currentMember) return;
    let html = '';
    if (currentMember.account_tier === 'New Member' || currentMember.account_tier === 'Seeker') {
        html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Step In</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take the next step to officially become a member of our spiritual family.</p></div><button type="button" class="btn btn-primary btn-sm" style="background: var(--primary); color: white; border: none;" onclick="openCommitmentModal()">I'm Ready</button>`;
    } else {
        try {
            const res = await fetch('/api/youth/' + currentMember.id + '/ministries');
            const ministries = await res.json();
            const isApplicant = ministries.some(m => m.role === 'Applicant');
            const isActiveMember = ministries.some(m => m.role !== 'Applicant');

            if (isActiveMember) {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Serve & Grow</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Continue your formation</p>${isApplicant ? '<p style="font-size:0.75rem; color:#F59E0B; margin:0; font-weight:bold;">(Application Pending)</p>' : ''}</div><button type="button" class="btn btn-outline btn-sm" style="color: #F59E0B; border-color: #F59E0B;" onclick="openMinistryIntentModal()">Expand Service</button>`;
            } else if (isApplicant) {
                html = `<div><strong style="color: #F59E0B; font-size: 0.95rem;">🙏 Discerning Together</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">We are so excited you want to serve! Our team is currently praying and preparing a space for you.</p></div><button type="button" class="btn btn-secondary btn-sm" disabled>Preparing Space</button>`;
            } else {
                html = `<div><strong style="color: var(--text-main); font-size: 0.95rem;">Next Step: Discover Your Gifts</strong><p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Take some time to explore where you might love to serve and share those gifts with the community.</p></div><button type="button" class="btn btn-primary btn-sm" style="background: #F59E0B; border: none; color: white;" onclick="openMinistryIntentModal()">Explore Serving</button>`;
            }
        } catch(e) {}
    }
    container.innerHTML = html;
};

// Force Failsafe Render 
setInterval(() => {
    const container = document.getElementById('dynamicJourneyContainer');
    if (container && container.innerHTML === '') window.renderHomeJourney();
}, 2000);

// ==========================================
// HOTFIX: PROFILE PRIORITY BUTTON FIX
// ==========================================

window.setCorePriority = async function(mappingId) {
    if (!currentMember) return alert("Please log in.");
    if (!confirm("Set this as your ⭐ Priority Ministry?")) return;
    
    try {
        const res = await fetch('/api/ministries-v37/priority/' + mappingId, {
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ youth_id: currentMember.id })
        });
        
        if (res.ok) {
            alert('Priority Ministry Updated Successfully! ⭐');
            // Instantly refresh the roles UI
            if (window.loadMyV3Roles) window.loadMyV3Roles(currentMember.id, 'myMinistriesHistory');
        } else {
            alert('Failed to update priority.');
        }
    } catch(e) { 
        console.error(e);
        alert('Error updating priority. Please check your connection.'); 
    }
};

// ==========================================
// HOTFIX: EVENTS BUGS & TRUE FACEBOOK REACTIONS
// ==========================================

// --- 1. EVENT FORM BUTTON FIX (Safe Null Checks) ---
window.openPreregSettings = function(eventId) {
    const e = eventsData.find(ev => ev.id == eventId);
    if (!e) return;
    
    const idInput = document.getElementById('preregSetEventId');
    if (idInput) idInput.value = e.id;
    
    const titleInput = document.getElementById('preregSetTitle');
    if (titleInput) titleInput.value = e.prereg_title || e.name || '';
    
    const infoInput = document.getElementById('preregSetInfo');
    if (infoInput) infoInput.value = e.prereg_info || '';
    
    const bannerInput = document.getElementById('preregSetBanner');
    if (bannerInput) bannerInput.value = '';
    
    // The silent crash happened here. This safe check prevents it.
    const bottomBannerInput = document.getElementById('preregSetBottomBanner');
    if (bottomBannerInput) bottomBannerInput.value = ''; 
    
    const modal = document.getElementById('preregSettingsModal');
    if (modal) modal.classList.add('active');
};

// --- 2. EVENT ROLES TAB FIX (Direct Display Manipulation) ---
window.switchAnalyticsSubTab = function(tab) {
    const overviewTab = document.getElementById('analyticsTabOverview');
    const rolesTab = document.getElementById('analyticsTabRoles');
    const btnOverview = document.getElementById('btnAnalyticsTabOverview');
    const btnRoles = document.getElementById('btnAnalyticsTabRoles');

    if (overviewTab) overviewTab.style.display = (tab === 'overview') ? 'block' : 'none';
    if (rolesTab) rolesTab.style.display = (tab === 'roles') ? 'block' : 'none';

    if (btnOverview) btnOverview.classList.toggle('active', tab === 'overview');
    if (btnRoles) btnRoles.classList.toggle('active', tab === 'roles');
};

// --- 3. TRUE FACEBOOK REACTION ENGINE (Direct DOM Mutation, ZERO Reloads) ---
window.refreshReactionBadgeUI = function(type, id, reactionsObj) {
    // Keep local cache synced
    if (type === 'chat') window.chatReactionsMap[id] = reactionsObj;
    if (type === 'memory') window.memoryReactionsMap[id] = reactionsObj;

    let totalReacts = 0;
    let reactSummary = [];
    
    Object.keys(reactionsObj).forEach(emoji => {
        const count = Array.isArray(reactionsObj[emoji]) ? reactionsObj[emoji].length : reactionsObj[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    // Locate the exact badge for this specific message/memory
    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    
    if (summaryEl) {
        if (totalReacts > 0) {
            summaryEl.innerHTML = `${reactSummary.slice(0,3).join('')} <span style="margin-left: 4px; font-weight: bold;">${totalReacts}</span>`;
            summaryEl.style.display = 'flex';
        } else {
            summaryEl.innerHTML = '';
            summaryEl.style.display = 'none';
        }
    }
};

window.submitReactionMaster = async function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return alert("Please log in to react.");
    
    // 1. Instantly hide the popup picker
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    // 2. Optimistic UI: Inject the emoji to give instant visual feedback
    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
        summaryEl.style.display = 'flex';
        summaryEl.innerHTML = `${emoji} <span style="font-size: 0.7rem; opacity: 0.8; margin-left:4px;">...</span>`;
    }

    try {
        // 3. Send to API in the background
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.reactions) {
                // 4. Update the DOM directly using the verified API response!
                // NO PAGE RELOADING. The UI updates natively and securely.
                window.refreshReactionBadgeUI(type, id, data.reactions);
            }
        } else {
            // Revert on failure
            if (summaryEl) { summaryEl.innerHTML = '❌'; setTimeout(() => summaryEl.style.display = 'none', 1000); }
        }
    } catch(e) { 
        console.error("Reaction submission error", e); 
        if (summaryEl) { summaryEl.innerHTML = '❌'; setTimeout(() => summaryEl.style.display = 'none', 1000); }
    }
};


// ==========================================
// KOINONIA PHASE B: SEEKER FUNNEL & GUEST STATE
// ==========================================

window.isGuestMode = false;

// 1. URL ROUTER & LOGIN INTERCEPTOR
const origCheckLoginStatePhaseB = window.checkLoginState;
window.checkLoginState = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const playParam = urlParams.get('play');
    const readParam = urlParams.get('read');
    const eventParam = urlParams.get('event');

    const saved = localStorage.getItem('fog_user');

    // SCENARIO A: User is already logged in normally
    if (saved) {
        origCheckLoginStatePhaseB();
        
        // Route them directly to their requested content
        if (playParam) {
            setTimeout(() => { switchTab('arcadeTab'); }, 500);
        } else if (readParam === 'daily-manna') {
            setTimeout(() => { switchTab('pulseDashboardTab'); if(window.loadDailyManna) window.loadDailyManna(); }, 500);
        } else if (eventParam) {
            setTimeout(() => { switchTab('preregPublicTab'); }, 500);
        }
        return;
    }

    // SCENARIO B: Unauthenticated Seeker (Guest Mode)
    if (playParam || readParam || eventParam) {
        window.isGuestMode = true;
        window.currentUser = 'Guest';
        
        // Hide global preloader
        const loader = document.getElementById('globalPreloader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 500); }

        // Render Guest Navigation
        if (window.renderBottomNav) window.renderBottomNav('guest');

        // Route to content
        if (playParam) {
            switchTab('arcadeTab');
        } else if (readParam === 'daily-manna') {
            switchTab('pulseDashboardTab');
            setTimeout(() => { if(window.loadDailyManna) window.loadDailyManna(); }, 500);
        } else if (eventParam) {
            switchTab('preregPublicTab');
            
            // 2. ENFORCE EMAIL REQUIREMENT FOR DEDUPLICATION
            const pubEmail = document.getElementById('preregPublicEmail');
            if (pubEmail) {
                pubEmail.required = true;
                pubEmail.placeholder = "Email Address (Required for VIP Pass)";
            }
        }
    } else {
        // SCENARIO C: Default Unauthenticated (Send to Login)
        origCheckLoginStatePhaseB();
    }
};

// 3. GUEST UI MASKING (Bottom Nav)
const origRenderBottomNavPhaseB = window.renderBottomNav;
window.renderBottomNav = function(context) {
    if (window.isGuestMode || context === 'guest') {
        const bottomNav = document.getElementById('bottomNav');
        if (bottomNav) {
            bottomNav.innerHTML = `
                <button class="bottom-nav-btn text-primary" style="font-weight: bold;" onclick="window.location.href='/'"><span>🚪</span>Login</button>
                <button class="bottom-nav-btn ${window.location.search.includes('read=') ? 'active' : ''}" onclick="window.location.href='/?read=daily-manna'"><span>📖</span>Manna</button>
                <button class="bottom-nav-btn ${window.location.search.includes('play=') ? 'active' : ''}" onclick="window.location.href='/?play=arcade'"><span>🎯</span>Arcade</button>
            `;
        }
        return;
    }
    
    // Normal Member Nav
    if (origRenderBottomNavPhaseB) origRenderBottomNavPhaseB(context);
};

// ==========================================
// KOINONIA PHASE B HOTFIX: ONLOAD MASTER OVERRIDE
// ==========================================

const ogOnLoadPhaseB = window.onload;

window.onload = (e) => {
    const urlParams = new URLSearchParams(window.location.search);
    const playParam = urlParams.get('play');
    const readParam = urlParams.get('read');
    const eventParam = urlParams.get('event');
    const savedSession = localStorage.getItem('fog_user');

    // SCENARIO 1: Unauthenticated Guest accessing Manna or Arcade
    if (!savedSession && (playParam || readParam)) {
        document.getElementById('mainHeader').style.display = 'block';
        document.getElementById('mainContainer').style.display = 'block';

        window.isGuestMode = true;
        window.currentUser = 'Guest';

        const loader = document.getElementById('globalPreloader');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.style.display = 'none', 500); }

        if (window.renderBottomNav) window.renderBottomNav('guest');

        if (playParam) {
            window.switchTab('arcadeTab');
        } else if (readParam === 'daily-manna') {
            window.switchTab('pulseDashboardTab');
            setTimeout(() => { if(window.loadDailyManna) window.loadDailyManna(); }, 500);
        }
        
        // CRITICAL: Return immediately to prevent the original onload from forcing loginTab!
        return; 
    }

    // SCENARIO 2: Unauthenticated Guest accessing Event Pre-reg
    if (!savedSession && eventParam) {
        window.isGuestMode = true;
        window.currentUser = 'Guest';
        
        // Let the original script handle the event load
        if (ogOnLoadPhaseB) ogOnLoadPhaseB(e);
        
        // Enforce email deduplication & guest nav after the original load finishes
        setTimeout(() => {
            const pubEmail = document.getElementById('preregPublicEmail');
            if (pubEmail) {
                pubEmail.required = true;
                pubEmail.placeholder = "Email Address (Required for VIP Pass)";
            }
            if (window.renderBottomNav) window.renderBottomNav('guest');
        }, 500);
        return;
    }

    // SCENARIO 3: Authenticated User overriding their default start tab
    if (savedSession && (playParam || readParam || eventParam)) {
        if (ogOnLoadPhaseB) ogOnLoadPhaseB(e);
        
        // Let original logic log them in, then yank them to their requested content
        setTimeout(() => {
            if (playParam) window.switchTab('arcadeTab');
            else if (readParam === 'daily-manna') {
                window.switchTab('pulseDashboardTab');
                if(window.loadDailyManna) window.loadDailyManna();
            }
        }, 800);
        return;
    }

    // DEFAULT SCENARIO: Normal load (No special URLs)
    if (ogOnLoadPhaseB) ogOnLoadPhaseB(e);
};

// ==========================================
// KOINONIA PHASE B HOTFIX: SECURE GUEST ROUTING
// ==========================================

const ogSwitchTabGuestSec = window.switchTab;

window.switchTab = async function(tabId) {
    // 1. Intercept restricted tabs for Guests
    if (window.isGuestMode) {
        const restrictedTabs = ['eventsTab', 'discipleshipTab', 'inboxTab', 'profileTab'];
        
        if (restrictedTabs.includes(tabId)) {
            // Drop them at the login screen with a warm Koinonia message
            alert("Create a free account to unlock community events and deeper spiritual formation! 🌱");
            if (ogSwitchTabGuestSec) await ogSwitchTabGuestSec('loginTab');
            return; 
        }
    }
    
    // 2. Proceed with normal tab routing
    if (ogSwitchTabGuestSec) await ogSwitchTabGuestSec(tabId);
    
    // 3. UI Masking: Hide the "Quick Actions" block on the Guest Dashboard
    if (window.isGuestMode && tabId === 'pulseDashboardTab') {
        setTimeout(() => {
            // Find the Events quick-action button
            const eventsBtn = document.querySelector('button[onclick="switchTab(\'eventsTab\')"]');
            if (eventsBtn && eventsBtn.parentElement) {
                // Hide the grid container holding the Quick Actions
                eventsBtn.parentElement.style.display = 'none';
            }
        }, 150);
    }
};


// ==========================================
// KOINONIA PHASE B HOTFIX: GUEST UI & REGISTRATION MUTATION
// ==========================================

const ogSwitchTabGuestSecV2 = window.switchTab;

window.switchTab = async function(tabId) {
    // 1. GUEST RESTRICTION & REGISTRATION MUTATOR
    if (window.isGuestMode) {
        const restrictedTabs = ['eventsTab', 'discipleshipTab', 'inboxTab', 'profileTab'];
        
        if (restrictedTabs.includes(tabId)) {
            alert("Create a free account to unlock community events and deeper spiritual formation! 🌱");
            
            // Transform the Login Tab into a Frictionless Registration Tab
            const loginTitle = document.querySelector('#loginTab h2');
            if(loginTitle) loginTitle.innerText = "Create Free Account";
            
            // Hide the manual username/password fields and the submit button
            document.querySelectorAll('#loginTab form .form-group').forEach(el => el.style.display = 'none');
            const loginBtn = document.querySelector('#loginTab form button[type="submit"]');
            if (loginBtn) loginBtn.style.display = 'none';
            
            // Emphasize the 1-Tap Google Auth
            const orText = document.querySelector('#loginTab .text-muted');
            if (orText) orText.innerText = "Sign up instantly with Google";
            if (!orText) { // Fallback if exact class is missed
                document.querySelectorAll('#loginTab span').forEach(s => {
                    if (s.innerText.includes('continue with')) s.innerText = "Sign up instantly with Google";
                });
            }

            if (ogSwitchTabGuestSecV2) await ogSwitchTabGuestSecV2('loginTab');
            return; 
        }
    }
    
    // 2. NORMAL TAB ROUTING
    if (ogSwitchTabGuestSecV2) await ogSwitchTabGuestSecV2(tabId);
    
    // 3. GUEST DASHBOARD CLEANUP & DAILY MANNA FAILSAFE
    if (window.isGuestMode && tabId === 'pulseDashboardTab') {
        setTimeout(() => {
            // Hide all unnecessary cards (Prayer Pal, Journey)
            const dashboardCards = document.querySelectorAll('#pulseDashboardTab .card');
            if (dashboardCards.length > 1) dashboardCards[1].style.display = 'none'; 
            if (dashboardCards.length > 2) dashboardCards[2].style.display = 'none'; 

            // Force hide the Events/Campfire buttons reliably
            Array.from(document.querySelectorAll('#pulseDashboardTab button')).forEach(btn => {
                if (btn.textContent.includes('Events') || btn.textContent.includes('Campfire')) {
                    if (btn.parentElement) btn.parentElement.style.display = 'none';
                }
            });

            // Failsafe Daily Manna Load (Bypasses the broken member profile fetch)
            fetch('/api/liturgical/today')
                .then(res => res.json())
                .then(data => {
                    const mannaText = document.getElementById('pulseDailyGospelText');
                    if (mannaText) mannaText.innerText = data.gospel || "The Lord is my shepherd; I shall not want. (Psalm 23)";
                }).catch(e => {
                    const mannaText = document.getElementById('pulseDailyGospelText');
                    if (mannaText) mannaText.innerText = "The Lord is my shepherd; I shall not want. (Psalm 23)";
                });
        }, 100);
    }
};

// ==========================================
// V115: COMBINE GROWTH GAMES WITH FAITH QUEST
// ==========================================
setTimeout(() => {
    const origSwitchGamTab = window.V6Gamification ? window.V6Gamification.switchTab : null;
    if (window.V6Gamification) {
        window.V6Gamification.switchTab = function(tabName) {
            if (origSwitchGamTab) origSwitchGamTab(tabName);
            
            if (tabName === 'games') {
                const container = document.getElementById('gamTabGames');
                if (container && !document.getElementById('faithQuestGrowthEmbed')) {
                    container.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-weight:bold;">Faith Quest Challenge: Play and earn XP!</p>
                    </div>
                    <div style="height: 75vh; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); background:#FFF;">
                        <iframe id="faithQuestGrowthEmbed" src="/?faith=quest&embedded=true" style="width:100%; height:100%; border:none;"></iframe>
                    </div>`;
                }
            }
        };
    }
}, 1000);











 {
    window.ogSwitchTabInboxHookV5 = window.switchTab;
    window.switchTab = async function(tabId) {
        if(window.ogSwitchTabInboxHookV5) await window.ogSwitchTabInboxHookV5(tabId);
        if(tabId === 'inboxTab') {
            setTimeout(window.loadPersonalInbox, 200);
        }
    };
}


// --- V6 PRIVATE INBOX SPLIT-TAB ENGINE ---
window.switchInboxSubTab = function(tab) {
    const pBtn = document.getElementById('btnInboxPrayers');
    const aBtn = document.getElementById('btnInboxAnnounce');
    const pView = document.getElementById('inboxPrayersView');
    const aView = document.getElementById('inboxAnnounceView');
    
    if(!pBtn || !aBtn || !pView || !aView) return;

    pBtn.style.background = tab === 'prayers' ? '#FFF' : 'transparent';
    pBtn.style.boxShadow = tab === 'prayers' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none';
    pBtn.style.color = tab === 'prayers' ? 'var(--primary)' : 'var(--text-muted)';

    aBtn.style.background = tab === 'announcements' ? '#FFF' : 'transparent';
    aBtn.style.boxShadow = tab === 'announcements' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none';
    aBtn.style.color = tab === 'announcements' ? 'var(--primary)' : 'var(--text-muted)';

    pView.style.display = tab === 'prayers' ? 'block' : 'none';
    aView.style.display = tab === 'announcements' ? 'block' : 'none';
};

window.acknowledgePrayer = async function(inboxId, originalSenderId, action) {
    try {
        const res = await fetch('/api/inbox/personal/' + inboxId + '/respond', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sender_id: currentMember.id, original_sender_id: originalSenderId, action: action, sender_name: currentMember.name })
        });
        if(res.ok) {
            window.loadPersonalInbox(); // Instantly refresh UI to show the checkmark
        }
    } catch(e) { console.error(e); }
};

window.loadPersonalInbox = async function() {
    if(typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
    const inboxTab = document.getElementById('inboxTab');
    if(!inboxTab) return;

    // Hijack the entire native tab layout for a custom SPA feel
    inboxTab.innerHTML = `
        <div style="background:#FFF; padding:15px; position:sticky; top:0; z-index:10; border-bottom:1px solid #E2E8F0;">
            <h2 style="margin:0; color:var(--primary); font-size:1.4rem;">Community Inbox</h2>
        </div>
        <div style="padding:15px;">
            <div style="display:flex; background:#F1F5F9; border-radius:12px; padding:4px; margin-bottom:20px;">
                <button id="btnInboxPrayers" onclick="switchInboxSubTab('prayers')" style="flex:1; border-radius:10px; border:none; padding:10px; font-weight:bold; background:#FFF; box-shadow:0 2px 4px rgba(0,0,0,0.05); color:var(--primary); cursor:pointer; transition: 0.2s;">🙏 Prayers</button>
                <button id="btnInboxAnnounce" onclick="switchInboxSubTab('announcements')" style="flex:1; border-radius:10px; border:none; padding:10px; font-weight:bold; background:transparent; color:var(--text-muted); cursor:pointer; transition: 0.2s;">📢 Announcements</button>
            </div>
            <div id="inboxPrayersView">Loading prayers...</div>
            <div id="inboxAnnounceView" style="display:none;">Loading announcements...</div>
        </div>
    `;

    // 1. Load Personal Prayers
    try {
        const resP = await fetch('/api/inbox/personal/' + currentMember.id);
        const prayers = await resP.json();
        const pView = document.getElementById('inboxPrayersView');
        if(prayers.length === 0) {
            pView.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); background:#FFF; border-radius:12px; border:1px dashed #CBD5E1;">No personal prayers received yet.</div>';
        } else {
            pView.innerHTML = prayers.map(p => {
                const avatar = p.profile_picture ? `<img src="${p.profile_picture}" style="width:45px;height:45px;border-radius:50%;object-fit:cover; border: 2px solid var(--primary);">` : `<div style="width:45px;height:45px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;font-weight:bold;color:var(--primary); border: 2px solid var(--primary); font-size:1.2rem;">${p.sender_name.charAt(0)}</div>`;
                
                // Determine 1-Tap UI State
                let actionHtml = '';
                if (p.title && p.title.includes('A Prayer from')) {
                    const hasThanks = p.status && p.status.includes('thank_you');
                    const hasPraise = p.status && p.status.includes('answered');
                    
                    const thankBtn = hasThanks 
                        ? `<div style="flex:1; background:#F8FAFC; color:#3B82F6; font-weight:bold; padding:8px; border-radius:8px; text-align:center; font-size:0.85rem; border:1px solid #E2E8F0;">✓ Thanks Sent</div>`
                        : `<button class="btn btn-sm" onclick="acknowledgePrayer(${p.id}, ${p.sender_id}, 'thank_you')" style="flex:1; background:#EFF6FF; color:#3B82F6; font-weight:bold; border-radius:8px; border:none; cursor:pointer; padding:8px; transition:0.2s;">💙 Send Thanks</button>`;
                        
                    const praiseBtn = hasPraise 
                        ? `<div style="flex:1; background:#F8FAFC; color:#10B981; font-weight:bold; padding:8px; border-radius:8px; text-align:center; font-size:0.85rem; border:1px solid #E2E8F0;">✓ Praise Shared</div>`
                        : `<button class="btn btn-sm" onclick="acknowledgePrayer(${p.id}, ${p.sender_id}, 'answered')" style="flex:1; background:#ECFDF5; color:#10B981; font-weight:bold; border-radius:8px; border:none; cursor:pointer; padding:8px; transition:0.2s;">✨ Praise Report</button>`;
                        
                    actionHtml = `<div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #E2E8F0; padding-top:15px;">${thankBtn}${praiseBtn}</div>`;
                }
                
                return `
                <div style="background:#FFF; padding:15px; border-radius:16px; border:1px solid #E2E8F0; margin-bottom:15px; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                        ${avatar}
                        <div>
                            <strong style="color:var(--text-main); font-size:1.05rem; display:block;">${p.title}</strong>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${p.created_at.split(' ')[0]}</span>
                        </div>
                    </div>
                    <p style="font-size:1rem; color:var(--text-main); line-height:1.6; margin:0; font-style:italic; padding: 12px; background: #F8FAFC; border-radius: 12px; border-left: 3px solid var(--primary);">"${p.message}"</p>
                    ${actionHtml}
                </div>`;
            }).join('');
        }
    } catch(e) { console.error(e); }

    // 2. Load Global Announcements
    try {
        const resA = await fetch('/api/communications/inbox?username=' + currentMember.qr_code);
        const ann = await resA.json();
        const aView = document.getElementById('inboxAnnounceView');
        if(ann.length === 0) {
            aView.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); background:#FFF; border-radius:12px; border:1px dashed #CBD5E1;">No community announcements.</div>';
        } else {
            aView.innerHTML = ann.map(a => `
                <div style="background:#FFF; padding:15px; border-radius:12px; border:1px solid #E2E8F0; margin-bottom:15px; box-shadow:0 4px 6px rgba(0,0,0,0.02);">
                    <h4 style="margin:0 0 5px 0; color:var(--primary); font-size:1.05rem;">${a.title}</h4>
                    <p style="margin:0 0 10px 0; font-size:0.9rem; color:var(--text-main); line-height:1.5;">${a.message}</p>
                    <small style="color:var(--text-muted);">${a.created_at}</small>
                </div>
            `).join('');
        }
    } catch(e) { console.error(e); }
};

if (!window.ogSwitchTabInboxHookV6) {
    window.ogSwitchTabInboxHookV6 = window.switchTab;
    window.switchTab = async function(tabId) {
        if(window.ogSwitchTabInboxHookV6) await window.ogSwitchTabInboxHookV6(tabId);
        if(tabId === 'inboxTab') {
            setTimeout(window.loadPersonalInbox, 100);
        }
    };
}





// --- V19: DUAL RENDER ENGINE ---

// 1. RESTORE "MY JOURNEY" FOR HOME DASHBOARD
window.renderHomeJourneyCard = async function() {
    if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
    
    const dashTab = document.getElementById('pulseDashboardTab');
    if (!dashTab || dashTab.style.display === 'none') return;

    const allHeaders = Array.from(dashTab.querySelectorAll('h1, h2, h3, h4, h5'));
    const journeyHeader = allHeaders.find(el => el.innerText.toUpperCase().includes('MY JOURNEY') && el.children.length === 0);
    if (!journeyHeader) return;
    
    const journeyCard = journeyHeader.closest('.card');
    if (!journeyCard) return;

    let container = document.getElementById('dynamicHomeJourneyBox');
    if (!container) {
        journeyCard.innerHTML = `<h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin: 0 0 15px 0; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; border:none; padding:0;"><span style="color: var(--primary);">📍</span> MY JOURNEY</h3><div id="dynamicHomeJourneyBox"></div>`;
        container = document.getElementById('dynamicHomeJourneyBox');
    }

    let title = "Begin Your Walk";
    let desc = "Join an upcoming gathering to see what our family is all about.";
    let btnText = "View Events";
    let btnAction = "if(window.hubNavTo) window.hubNavTo('/?tab=events'); else window.location.href='/?tab=events';";
    let statusColor = "#3B82F6";

    if (currentMember.account_tier === 'New Member' || currentMember.account_tier === 'Seeker') {
        title = "Welcome Home";
        desc = "We would love for you to plant your roots here. Take the next step to officially become a member of our spiritual family.";
        btnText = "Join Our Family";
        btnAction = "if(typeof openCommitmentModal === 'function') openCommitmentModal(); else alert('Feature pending implementation.');";
        statusColor = "#F59E0B";
    } else {
        try {
            const res = await fetch('/api/youth/' + currentMember.id + '/ministries');
            const ministries = await res.json();
            const isApplicant = ministries.some(m => m.role === 'Applicant');
            const isActiveMember = ministries.some(m => m.role !== 'Applicant');

            if (isActiveMember) {
                title = "Serve & Grow";
                desc = "You are an active servant! Feel called to do more? You can always expand your borders and join another ministry.";
                btnText = "Expand Service";
                btnAction = "if(typeof openMinistryIntentModal === 'function') openMinistryIntentModal(); else alert('Feature pending implementation.');";
                statusColor = "#10B981";
            } else if (isApplicant) {
                title = "🙏 Discerning Together";
                desc = "We are so excited you want to serve! Our team is currently praying and preparing a space for you. We will reach out very soon.";
                btnText = "Preparing Space";
                btnAction = "";
                statusColor = "#64748B";
            } else {
                title = "Discover Your Gifts";
                desc = "God has given you beautiful, unique talents. Take some time to explore where you might love to serve and share those gifts with the community.";
                btnText = "Explore Serving";
                btnAction = "if(typeof openMinistryIntentModal === 'function') openMinistryIntentModal(); else alert('Feature pending implementation.');";
                statusColor = "#8B5CF6";
            }
        } catch(e) {}
    }

    const btnHtml = btnAction === "" ? 
        `<button class="btn" disabled style="background: #E2E8F0; color: #64748B; width: 100%; border-radius: 10px; font-weight: bold; padding: 12px; cursor: not-allowed; box-shadow: none;">${btnText}</button>` : 
        `<button class="btn btn-primary" onclick="${btnAction}" style="width: 100%; border-radius: 10px; font-weight: bold; padding: 12px; background: ${statusColor}; border-color: ${statusColor}; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">${btnText}</button>`;

    container.innerHTML = `
        <div style="background: #F8FAFC; border-radius: 12px; padding: 15px; border-left: 4px solid ${statusColor}; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <strong style="color: var(--text-main); font-size: 1.05rem; display: block; margin-bottom: 6px;">${title}</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.5;">${desc}</p>
        </div>
        ${btnHtml}
        <button onclick="document.getElementById('journeyExplanationModal').style.display='flex'" style="background: transparent; color: var(--primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px; font-size: 0.8rem; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s;">
            🌱 About The Growth Pathway
        </button>
    `;
};

// 2. INJECT 7-STAGE PATHWAY FOR GROWTH PAGE
window.renderGrowthPathwayCard = async function() {
    if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
    const growTab = document.getElementById('growTab');
    if (!growTab) return;

    // Eradicate the native green card
    Array.from(growTab.querySelectorAll('.card')).forEach(c => {
        if (c.id !== 'dynamicGrowthPathwayBox' && (c.innerText.includes('Your Next Step') || c.innerText.includes('Salvation') || c.className.includes('bg-success'))) {
            c.style.display = 'none';
        }
    });

    let container = document.getElementById('dynamicGrowthPathwayBox');
    if (!container) {
        growTab.insertAdjacentHTML('afterbegin', '<div id="dynamicGrowthPathwayBox" style="margin-bottom:20px;"></div>');
        container = document.getElementById('dynamicGrowthPathwayBox');
    }

    try {
        const res = await fetch('/api/discipleship/next-step/' + currentMember.id);
        const data = await res.json();
        
        let title = "Salvation & Baptism";
        let desc = "Accept Jesus Christ as Lord and Savior and publicly declare your faith through water baptism.";
        let stageIndex = 1;
        
        if (data && data.nextStep) { title = data.nextStep.title || title; desc = data.nextStep.description || desc; }

        const titleLower = title.toLowerCase();
        if (titleLower.includes('encounter') || titleLower.includes('come') || titleLower.includes('salvation')) stageIndex = 1;
        else if (titleLower.includes('connect') || titleLower.includes('belong')) stageIndex = 2;
        else if (titleLower.includes('pledge') || titleLower.includes('commit')) stageIndex = 3;
        else if (titleLower.includes('gift') || titleLower.includes('discover')) stageIndex = 4;
        else if (titleLower.includes('equip') || titleLower.includes('form')) stageIndex = 5;
        else if (titleLower.includes('serve') || titleLower.includes('participate')) stageIndex = 6;
        else if (titleLower.includes('commission') || titleLower.includes('sent')) stageIndex = 7;

        const progressPercent = Math.round((stageIndex / 7) * 100);

        let pastoralContext = "";
        switch(stageIndex) {
            case 1: pastoralContext = "God is inviting you to experience His love in a fresh way. Take this bold first step to explore your faith and see what He has in store."; break;
            case 2: pastoralContext = "We are not meant to walk alone. Finding your spiritual family will anchor your faith and provide brothers and sisters to support you."; break;
            case 3: pastoralContext = "You are laying a firm foundation. By committing to this spiritual home, you are planting roots that will yield immense spiritual fruit."; break;
            case 4: pastoralContext = "God has entrusted you with unique talents meant to bless others. Unpack those gifts now so you can prepare to serve His Kingdom."; break;
            case 5: pastoralContext = "This is a season of deep refinement. Lean into your formation to sharpen your character, skills, and heart for ministry."; break;
            case 6: pastoralContext = "The harvest is ready! Step out in faith to actively serve and experience the profound joy of building up your community."; break;
            case 7: pastoralContext = "You are fully equipped. Go forth with a burning passion for God and deep compassion for all, shining His light wherever you go."; break;
        }

        container.innerHTML = `
            <div class="card" style="background: #FFF; border-radius: 16px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #E2E8F0; margin: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                    <h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin: 0; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; border:none; padding:0;">
                        <span style="color: #F97316;">📍</span> MY JOURNEY
                    </h3>
                    <button onclick="document.getElementById('journeyExplanationModal').style.display='flex'" style="background: #FFFBEB; color: #D97706; border: none; border-radius: 20px; padding: 5px 12px; font-size: 0.75rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        ℹ️ About My Journey
                    </button>
                </div>
                
                <strong style="color: #F97316; font-size: 1.4rem; display: block; margin-bottom: 8px;">Step ${stageIndex}: ${title}</strong>
                
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1; height: 8px; background: #E2E8F0; border-radius: 10px; overflow: hidden;">
                        <div style="height: 100%; width: ${progressPercent}%; background: #F97316; border-radius: 10px;"></div>
                    </div>
                    <span style="font-size: 0.75rem; font-weight: bold; color: var(--text-muted);">Step ${stageIndex} of 7</span>
                </div>

                <div style="background: #FFF; padding: 15px; border-radius: 12px; border-left: 4px solid #F97316; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <p style="font-size: 0.95rem; color: var(--text-main); font-style: italic; margin: 0 0 10px 0; line-height: 1.5;">"${pastoralContext}"</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0; font-weight: 600;">🎯 Action: ${desc}</p>
                </div>

                <button class="btn btn-primary" onclick="if(window.hubNavTo) window.hubNavTo('events'); else window.location.href='/?tab=events';" style="width: 100%; border-radius: 10px; font-weight: bold; padding: 14px; background: #F97316; border-color: #F97316; font-size: 1.05rem; box-shadow: 0 4px 10px rgba(249, 115, 22, 0.2);">Take Your Next Step</button>
            </div>
        `;
    } catch(e) { console.error('Error rendering growth pathway:', e); }
};

// 3. HOOK INTERVALS
const ogIntervalV19 = setInterval(() => {
    window.renderHomeJourneyCard();
    window.renderGrowthPathwayCard();
}, 1500);
// --- END V19 ---


// ==========================================
// KIONONIA CORE UX OVERRIDES
// ==========================================
const _origCheckLoginState = window.checkLoginState;
window.checkLoginState = function() {
    if (_origCheckLoginState) _origCheckLoginState();
    
    // Aggressively force Dashboard 300ms later to override background scripts
    setTimeout(() => {
        const saved = localStorage.getItem('fog_user');
        if (saved && !window.location.search.includes('faith=quest')) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            const dash = document.getElementById('pulseDashboardTab');
            if (dash) dash.classList.add('active');
            if (typeof window.renderBottomNav === 'function') window.renderBottomNav('pulseDashboardTab');
            window.scrollTo(0,0);
        }
    }, 300);
};

const _origRenderBottomNav = window.renderBottomNav;
window.renderBottomNav = function(context) {
    if (_origRenderBottomNav) _origRenderBottomNav(context);
    
    // Wait for native rendering to finish, then swap the icon
    setTimeout(() => {
        if (context === 'discipleshipTab') {
            const navItems = Array.from(document.querySelectorAll('.bottom-nav-btn'));
            const profileBtn = navItems.find(btn => btn.innerText.includes('Profile'));
            if (profileBtn) {
                profileBtn.innerHTML = '<span>🏠</span>Home';
                profileBtn.setAttribute('onclick', "switchTab('pulseDashboardTab')");
            }
        }
    }, 50);
};

// ==========================================
// V50: PROFILE TOOLTIP LOGIC
// ==========================================
document.addEventListener('click', (e) => {
    const profTarget = e.target.closest('#overallXpBadgeToggle');
    const profTooltip = document.getElementById('xpTooltip');
    if (profTarget && profTooltip) {
        e.stopPropagation();
        profTooltip.style.display = profTooltip.style.display === 'flex' ? 'none' : 'flex';
    } else if (profTooltip) {
        profTooltip.style.display = 'none';
    }
});

// ==========================================
// V51: EVENT PLANNER & PERMISSIONS FIX
// ==========================================

// 1. Safe overriding of Granular Permissions (ensuring Super Admins get access)
window.applyGranularPermissions = function() {
    const canAdd = window.hasPerm('add_entries') || currentUser === 'celsocreeriii@gmail.com';
    
    // Safely enforce display with !important to bypass CSS conflicts
    const setDisp = (id) => { 
        const el = document.getElementById(id); 
        if (el) el.style.setProperty('display', canAdd ? 'inline-flex' : 'none', 'important'); 
    };
    
    setDisp('btnSubEventCreate');
    setDisp('btnSubMinistryCreate');
    setDisp('btnCheckinWalkin');
    setDisp('addEntryAnalyticsBtn');
    setDisp('btnDirectoryAddMember');
};

// 2. Ensuring the Sidebar lists "Event Planner" properly
const ogBuildNavV51 = window.buildNav;
window.buildNav = function() {
    if (ogBuildNavV51) ogBuildNavV51();
    const sidebar = document.getElementById('sidebarNav');
    if (sidebar) {
        const evBtn = Array.from(sidebar.querySelectorAll('.nav-btn')).find(b => b.innerText.includes('Events Admin'));
        if (evBtn) evBtn.innerHTML = '📅 Event Planner';
        window.applyGranularPermissions();
    }
};

// 3. Bulletproof Event Editor & Submitter
window.openEditEventModal = function(eventId) {
    try {
        const e = eventsData.find(ev => ev.id == eventId);
        if (!e) return alert("Event data could not be found locally. Please refresh.");

        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
        safeSet('editEvtId', e.id);
        safeSet('editEvtName', e.name || '');
        safeSet('editEvtDate', e.event_date || '');
        safeSet('editEvtTime', e.time_start || '');
        safeSet('editEvtVenue', e.venue || '');
        safeSet('editEvtPoints', e.event_points || 10);
        safeSet('editEvtPhotosUrl', e.photos_url || '');
        safeSet('editEvtMaterialsUrl', e.materials_url || '');
        safeSet('editEvtPoster', '');

        window.closeAnalyticsModal();
        const modal = document.getElementById('editEventModal');
        if (modal) modal.classList.add('active');
    } catch (err) {
        console.error("Edit Event Error:", err);
        alert("An error occurred opening the Event Editor.");
    }
};

window.submitEditEvent = async function() {
    const form = document.getElementById('editEventForm');
    if(!form.checkValidity()) { form.reportValidity(); return; }
    
    const id = document.getElementById('editEvtId').value;
    const fileInput = document.getElementById('editEvtPoster');
    
    window.triggerActionConfirmation(`Confirm saving changes to event?`, async () => {
        let posterBase64 = null;
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            posterBase64 = await window.getBase64(fileInput.files[0], 1200);
        }
        
        const safeGet = (elId) => { const el = document.getElementById(elId); return el ? el.value : ''; };
        const payload = {
            name: safeGet('editEvtName'), 
            event_date: safeGet('editEvtDate'),
            time_start: safeGet('editEvtTime'), 
            venue: safeGet('editEvtVenue'),
            poster: posterBase64, 
            photos_url: safeGet('editEvtPhotosUrl'),
            materials_url: safeGet('editEvtMaterialsUrl'), 
            event_points: safeGet('editEvtPoints') || 10,
            actor: currentUser
        };
        
        try {
            const res = await fetch(`/api/events/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) { window.closeEditEventModal(); alert("Event updated successfully!"); window.loadEvents(); }
            else { const d = await res.json(); alert(d.error || "Error updating event"); }
        } catch(e) { alert("Error connecting to server."); throw e; }
    });
};

// 4. Restore Home Dashboard "Life Points" Scroll Behavior (And suppress tooltip)
document.addEventListener('click', (e) => {
    const homeTarget = e.target.closest('#dashXpClickTarget');
    if (homeTarget) {
        e.stopPropagation();
        
        // Suppress tooltip if it was previously injected
        const homeTooltip = document.getElementById('homeXpTooltip');
        if (homeTooltip) homeTooltip.style.display = 'none';

        const hub = document.getElementById('actionHubContainer');
        if (hub) {
            hub.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const fqCard = Array.from(hub.querySelectorAll('.continuity-card')).find(el => el.innerText.includes('Faith Quest'));
            if (fqCard) {
                const ogBg = fqCard.style.background;
                fqCard.style.background = '#FEF3C7';
                setTimeout(() => fqCard.style.background = ogBg, 1200);
            }
        }
    }
});

// ==========================================
// V52: DYNAMIC DASHBOARD POINTS & EVENT TAB FIX
// ==========================================
window.updateDashboardLifePoints = function() {
    if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
        fetch('/api/gamification/points/' + currentMember.id)
            .then(res => res.json())
            .then(data => {
                window.currentLifePointsData = data;
                
                // Update Dashboard Hero Banner
                const xpCounter = document.getElementById('dashXpCounter');
                if (xpCounter) xpCounter.innerText = (data.weekly_points || 0) + ' Life Points This Week 🖱️';
                
                // Silently update Profile Tooltip variables
                const elA = document.getElementById('myArcadeXp');
                const elG = document.getElementById('myGrowthXp');
                const elE = document.getElementById('myEventXp');
                if(elA) elA.innerText = data.arcade_xp || 0;
                if(elG) elG.innerText = data.growth_xp || 0;
                if(elE) elE.innerText = data.event_xp || 0;
            }).catch(e => console.log('Points sync error', e));
    }
};

// Bind the updater to the tab switching mechanism
const ogSwitchTabV52 = window.switchTab;
window.switchTab = async function(tabId, subTabId) {
    if (ogSwitchTabV52) await ogSwitchTabV52(tabId, subTabId);
    
    // Auto-refresh points when visiting the Home Dashboard
    if (tabId === 'pulseDashboardTab') {
        if (typeof window.updateDashboardLifePoints === 'function') window.updateDashboardLifePoints();
    }
    
    // Ensure "Create Event" tab renders correctly when Events tab opens
    if (tabId === 'eventsTab') {
        setTimeout(() => { 
            if (typeof window.applyGranularPermissions === 'function') window.applyGranularPermissions(); 
        }, 100);
    }
};

// ==========================================
// V53: ULTIMATE PERMISSION & SPEED OPTIMIZATION
// ==========================================

// 1. INDESTRUCTIBLE PERMISSION ENFORCER
// Runs every 1 second in the background to guarantee UI is unlocked for admins
setInterval(() => {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    const canAdd = (typeof window.hasPerm === 'function' && window.hasPerm('add_entries')) || currentUser === 'celsocreeriii@gmail.com';
    
    const idsToUnlock = ['btnSubEventCreate', 'btnSubMinistryCreate', 'btnCheckinWalkin', 'addEntryAnalyticsBtn', 'btnDirectoryAddMember'];
    
    idsToUnlock.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (canAdd) {
                if (el.style.display === 'none' || el.style.display === '') {
                    el.style.setProperty('display', 'inline-flex', 'important');
                }
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        }
    });
}, 1000);

// 2. OPTIMISTIC UI & DEBOUNCING FOR EVENTS
// Prevents double-fetching and renders instantly using cached data
let isFetchingEvents = false;
window.loadEvents = async function() {
    if (isFetchingEvents) return;
    isFetchingEvents = true;

    // Instant Render (Optimistic UI)
    if (typeof eventsData !== 'undefined' && eventsData.length > 0) {
        const eventsTab = document.getElementById('eventsTab');
        if (eventsTab && eventsTab.classList.contains('active')) {
            window.setEventViewMode(eventViewMode);
        }
    }

    try {
        const res = await fetch('/api/events');
        eventsData = await res.json();
        
        const dropdown = document.getElementById('activeEventDropdown');
        if (dropdown) {
            const currentVal = dropdown.value;
            dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
            if (currentVal && eventsData.find(e => e.id == currentVal)) {
                dropdown.value = currentVal;
            }
        }
        
        // Re-render UI with fresh data
        const eventsTab = document.getElementById('eventsTab');
        if (eventsTab && eventsTab.classList.contains('active')) {
            window.setEventViewMode(eventViewMode);
        }
        
        const checkinTab = document.getElementById('checkinTab');
        if (checkinTab && checkinTab.classList.contains('active')) {
            window.updateActiveEventBanner();
        }
    } catch(e) {
        console.error("Failed loading events.", e);
    } finally {
        isFetchingEvents = false;
    }
};

// 3. OPTIMISTIC UI & DEBOUNCING FOR CHECK-IN ANALYTICS
let isFetchingBanner = false;
window.updateActiveEventBanner = async function() {
    if (isFetchingBanner) return;
    
    const dropdown = document.getElementById('activeEventDropdown');
    if(!dropdown) return;
    const eventId = dropdown.value;
    if (typeof checkedInYouthIds !== 'undefined') checkedInYouthIds.clear();
    
    if(eventId) {
        isFetchingBanner = true;
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
        } catch(e) { 
            console.error("Failed to load active banner stats", e); 
        } finally {
            isFetchingBanner = false;
        }
    } else {
        document.getElementById('checkinCounters').style.display = 'none';
    }
    if (typeof window.filterManualCheckin === 'function') window.filterManualCheckin();
};



// ==========================================
// V57: ROGUE DOM KILLER & LOCALSTORAGE CACHING
// ==========================================

// 1. OBLITERATE CSS CONFLICTS FOR ADMIN TABS
window.applyGranularPermissions = function() {
    const canAdd = (typeof window.hasPerm === 'function' && window.hasPerm('add_entries')) || currentUser === 'celsocreeriii@gmail.com';
    
    // Explicitly un-hide the parent container that the rogue script was previously destroying
    const eventsSubNav = document.querySelector('#eventsTab .sub-nav');
    if (eventsSubNav) eventsSubNav.style.setProperty('display', 'flex', 'important');

    const targets = ['btnSubEventCreate', 'btnSubMinistryCreate', 'btnCheckinWalkin', 'addEntryAnalyticsBtn', 'btnDirectoryAddMember'];
    targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (canAdd) {
                el.style.setProperty('display', 'inline-flex', 'important');
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        }
    });
};

// Re-bind to tab switches to guarantee execution
const ogSwitchTabV57 = window.switchTab;
window.switchTab = async function(tabId, subTabId) {
    if (ogSwitchTabV57) await ogSwitchTabV57(tabId, subTabId);
    if (tabId === 'eventsTab') {
        window.applyGranularPermissions();
        window.loadEvents();
    }
};

// 2. ZERO-LATENCY EVENT LOADING VIA LOCALSTORAGE
window.loadEvents = async function() {
    // A. INSTANT RENDER FROM CACHE (Zero Delay)
    const cachedEvents = localStorage.getItem('fog_events_cache');
    if (cachedEvents) {
        try {
            eventsData = JSON.parse(cachedEvents);
            const dropdown = document.getElementById('activeEventDropdown');
            if (dropdown && eventsData.length > 0) {
                const currentVal = dropdown.value;
                dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
                if (currentVal && eventsData.find(e => e.id == currentVal)) dropdown.value = currentVal;
            }
            if (document.getElementById('eventsTab') && document.getElementById('eventsTab').classList.contains('active')) {
                if (typeof window.setEventViewMode === 'function') window.setEventViewMode(eventViewMode);
            }
        } catch(e) {}
    }

    // B. BACKGROUND SYNC (Silently updates with fresh DB data)
    try {
        const res = await fetch('/api/events');
        const freshData = await res.json();
        
        // Only re-render if data actually changed to prevent UI flashing
        if (JSON.stringify(freshData) !== JSON.stringify(eventsData)) {
            eventsData = freshData;
            localStorage.setItem('fog_events_cache', JSON.stringify(eventsData));
            
            const dropdown = document.getElementById('activeEventDropdown');
            if (dropdown && eventsData.length > 0) {
                const currentVal = dropdown.value;
                dropdown.innerHTML = eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
                if (currentVal && eventsData.find(e => e.id == currentVal)) dropdown.value = currentVal;
            }
            if (document.getElementById('eventsTab') && document.getElementById('eventsTab').classList.contains('active')) {
                if (typeof window.setEventViewMode === 'function') window.setEventViewMode(eventViewMode);
            }
            const checkinTab = document.getElementById('checkinTab');
            if (checkinTab && checkinTab.classList.contains('active')) {
                if (typeof window.updateActiveEventBanner === 'function') window.updateActiveEventBanner();
            }
        }
    } catch(e) {
        console.error("Network sync failed for events.", e);
    }
};


// ==========================================
// V58: BULLETPROOF EVENT DATA LOADER
// ==========================================
window.loadEvents = async function() {
    try {
        // 1. Force a fresh fetch directly from the source of truth
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error("HTTP " + res.status);
        
        eventsData = await res.json();
        
        // 2. Force Render the Check-In Dropdown
        const dropdown = document.getElementById('activeEventDropdown');
        if (dropdown) {
            const currentVal = dropdown.value;
            dropdown.innerHTML = '<option value="">Select an Event...</option>' + 
                eventsData.map(e => `<option value="${e.id}">${e.name || 'Event'} (${e.event_date || ''})</option>`).join('');
            
            // Restore previous selection if it still exists
            if (currentVal && eventsData.find(e => e.id == currentVal)) {
                dropdown.value = currentVal;
            }
        }
        
        // 3. Force Render the Event Planner List
        const eventsTab = document.getElementById('eventsTab');
        if (eventsTab && eventsTab.classList.contains('active')) {
            if (typeof window.setEventViewMode === 'function') {
                window.setEventViewMode(eventViewMode || 'list');
            }
        }
        
        // 4. Force Update the Check-In Banner if active
        const checkinTab = document.getElementById('checkinTab');
        if (checkinTab && checkinTab.classList.contains('active')) {
            if (typeof window.updateActiveEventBanner === 'function') {
                window.updateActiveEventBanner();
            }
        }
        
    } catch(e) {
        console.error("CRITICAL: Failed to load events data from database.", e);
    }
};

// ==========================================
// V59: WEEKLY LIFE POINTS OVERRIDE
// ==========================================
window.updateDashboardLifePoints = function() {
    if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
        fetch('/api/gamification/points/' + currentMember.id)
            .then(res => res.json())
            .then(data => {
                window.currentLifePointsData = data;
                const xpCounter = document.getElementById('dashXpCounter');
                if (xpCounter) {
                    const text = (data.weekly_points || 0) + ' Life Points This Week';
                    if (xpCounter.innerText.includes('🖱️')) xpCounter.innerText = text + ' 🖱️';
                    else xpCounter.innerText = text;
                }
            }).catch(e => console.log('Points sync error', e));
    }
};

const ogSwitchTabV59 = window.switchTab;
window.switchTab = async function(tabId, subTabId) {
    if (ogSwitchTabV59) await ogSwitchTabV59(tabId, subTabId);
    if (tabId === 'pulseDashboardTab' && typeof window.updateDashboardLifePoints === 'function') {
        window.updateDashboardLifePoints();
    }
};

// ==========================================
// V60: FOG ARCADE PRE-GAME MODAL
// ==========================================
window.openArcadePreGame = function(gameName, icon, desc, color) {
    document.getElementById('fpgTitle').innerText = gameName;
    document.getElementById('fpgIcon').innerText = icon;
    document.getElementById('fpgDesc').innerText = desc;
    document.getElementById('fpgTop3Container').innerHTML = '<div style="text-align:center;">Loading scores...</div>';
    
    // Fetch Top 3 Scorers for this specific game
    fetch('/api/gamification/game-top/' + encodeURIComponent(gameName))
        .then(res => res.json())
        .then(scores => {
            const container = document.getElementById('fpgTop3Container');
            if (scores && scores.length > 0) {
                container.innerHTML = scores.map((s, i) => `<div style="display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid #E2E8F0;"><span>${i===0?'🥇':i===1?'🥈':'🥉'} ${s.name}</span><strong>${Number(s.high_score).toFixed(1)} XP</strong></div>`).join('');
            } else {
                container.innerHTML = '<div style="text-align:center;">Be the first to claim the top spot!</div>';
            }
        }).catch(e => {
            document.getElementById('fpgTop3Container').innerHTML = '<div style="text-align:center; color: var(--danger);">Failed to load ranks.</div>';
        });

    const startBtn = document.getElementById('fpgStartBtn');
    startBtn.style.background = color || '#059669';
    startBtn.onclick = function() {
        document.getElementById('arcadePreGameModal').classList.remove('active');
        // Trigger simulated gameplay (capped at 5)
        setTimeout(() => {
            const simulatedScore = Math.floor(Math.random() * 6); // Max 5
            fetch('/api/arcade/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youth_id: currentMember.id, game_name: gameName, score: simulatedScore, actor: currentMember.name })
            }).then(() => {
                alert(`Game Over! You scored ${simulatedScore}.0 XP.`);
                if(window.updateDashboardLifePoints) window.updateDashboardLifePoints();
            });
        }, 500);
    };

    document.getElementById('arcadePreGameModal').classList.add('active');
};

// Bind tiles dynamically
setInterval(() => {
    document.querySelectorAll('.arcade-game-tile').forEach(tile => {
        if (!tile.hasAttribute('data-modal-bound') && !tile.classList.contains('growth-game-indiv') && !tile.classList.contains('growth-game-groups')) {
            const gameName = tile.getAttribute('data-game-name');
            const icon = tile.querySelector('.game-tile-icon').innerText;
            const desc = tile.querySelector('p').innerText;
            const actionBtn = tile.querySelector('.game-tile-action');
            const color = actionBtn ? window.getComputedStyle(actionBtn).backgroundColor : '#059669';
            
            tile.onclick = () => window.openArcadePreGame(gameName, icon, desc, color);
            tile.setAttribute('data-modal-bound', 'true');
        }
    });
}, 1000);





// === V51: PREMIUM ROW LAYOUT ===
window.populateProfileTab = function(member) {
    if (!member) return;
    const safeText = (val) => val && val !== 'null' ? val : 'N/A';

    // Populate Edit Form Inputs safely
    ['myMemberId','myEditName','myEditEmail','myEditAge','myEditBirthday','myEditSocial','myEditParents','myEditGender','myEditMobile','myEditAddress'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let key = id.replace('myEdit', '').toLowerCase();
            if(id === 'myEditParents') key = 'parents_name';
            if(id === 'myEditSocial') key = 'social_media';
            if(id === 'myMemberId') key = 'id';
            el.value = member[key] || '';
        }
    });

    if(document.getElementById('myProfileName')) document.getElementById('myProfileName').innerText = member.name || 'Community Member';
    const av = document.getElementById('myProfileAvatar');
    if (av) av.innerHTML = member.profile_picture ? `<img src="${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤';

    // Isolate ID to blindfold old rogue intervals
    let bio = document.getElementById('myBioSummaryArchitect');
    if (!bio) {
        bio = document.getElementById('myBioSummary');
        if (bio) bio.id = 'myBioSummaryArchitect'; 
    }

    const form = document.querySelector('form[onsubmit="handleSelfProfileUpdate(event)"]');

    if (bio) {
        const currentState = [member.name, member.email, member.gender, member.mobile, member.address, member.age, member.birthday, member.social_media, member.parents_name].join('|');

        if (bio.getAttribute('data-sync-state') !== currentState) {
            bio.setAttribute('data-sync-state', currentState);
            bio.style.display = 'block';
            bio.style.padding = '0';

            bio.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 10px;">
                    <!-- ROW 1: Contact Info -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #EEF2FF; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">✉️</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Email Address</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.email)}">${safeText(member.email)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #ECFDF5; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">📱</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Mobile Number</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.mobile)}">${safeText(member.mobile)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #FFF7ED; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">📍</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Address</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.address)}">${safeText(member.address)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- ROW 2: Demographics (Gender, Age, Birthday) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #F5F3FF; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">🚻</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Gender</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.gender)}">${safeText(member.gender)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #F0FDF4; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">👤</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Age</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.age)}">${safeText(member.age)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #FFF1F2; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">🎂</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Birthday</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.birthday)}">${safeText(member.birthday)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- ROW 3: Connections (Social Media, Guardian) -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #F8FAFC; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">💬</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Social Media</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.social_media)}">${safeText(member.social_media)}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; background: #F8FAFC; padding: 10px 14px; border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; min-width: 0;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: #FEF2F2; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">🛡️</div>
                            <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                                <span style="font-size: 0.65rem; text-transform: uppercase; color: #64748B; font-weight: 800; letter-spacing: 0.5px;">Guardian</span>
                                <span style="font-size: 0.85rem; color: #0F172A; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeText(member.parents_name)}">${safeText(member.parents_name)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Split-Tab Logic
        if (form && !document.getElementById('architectProfileTabs')) {
            let bWrap = bio.parentElement && bio.parentElement.tagName === 'DIV' && bio.parentElement.id !== 'profileTab' ? bio.parentElement : bio;
            let fWrap = form.closest('.card') || form.parentElement;

            const legacyTitle = fWrap.querySelector('h2');
            if (legacyTitle) legacyTitle.style.display = 'none';

            const tabs = document.createElement('div');
            tabs.id = 'architectProfileTabs';
            tabs.style.cssText = 'display: flex; gap: 8px; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 10px; padding: 6px; margin-bottom: 20px; width: 100%; box-sizing: border-box; box-shadow: 0 2px 5px rgba(0,0,0,0.02);';
            tabs.innerHTML = `
                <button id="btnArchView" type="button" style="flex: 1; font-weight: 800; border-radius: 8px; font-size: 0.9rem; padding: 10px; transition: all 0.2s; background: var(--primary, #059669); color: #FFF; border: none; cursor: pointer;">👤 Personal Details</button>
                <button id="btnArchEdit" type="button" style="flex: 1; font-weight: 800; border-radius: 8px; font-size: 0.9rem; padding: 10px; background: transparent; transition: all 0.2s; color: var(--text-main, #334155); border: none; cursor: pointer;">✏️ Edit Profile Details</button>
            `;

            bWrap.parentNode.insertBefore(tabs, bWrap);

            const btnV = document.getElementById('btnArchView');
            const btnE = document.getElementById('btnArchEdit');

            btnV.onclick = () => {
                bWrap.style.display = 'block';
                fWrap.style.display = 'none';
                btnV.style.background = 'var(--primary, #059669)'; btnV.style.color = '#FFF';
                btnE.style.background = 'transparent'; btnE.style.color = 'var(--text-main, #334155)';
            };

            btnE.onclick = () => {
                bWrap.style.display = 'none';
                fWrap.style.display = 'block';
                btnV.style.background = 'transparent'; btnV.style.color = 'var(--text-main, #334155)';
                btnE.style.background = 'var(--primary, #059669)'; btnE.style.color = '#FFF';
            };

            fWrap.style.display = 'none';
            bWrap.style.display = 'block';
        }
    }
};

setTimeout(() => {
    if (document.getElementById('profileTab') && document.getElementById('profileTab').classList.contains('active') && typeof currentMember !== 'undefined') {
        window.populateProfileTab(currentMember);
    }
}, 150);
// === END V51 ===
