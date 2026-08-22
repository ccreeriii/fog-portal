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
    const canAdd = window.hasPerm('add_entries');

    const btnSubEventCreate = document.getElementById('btnSubEventCreate');
    if(btnSubEventCreate) btnSubEventCreate.style.display = canAdd ? 'inline-block' : 'none';

    const btnSubMinistryCreate = document.getElementById('btnSubMinistryCreate');
    if(btnSubMinistryCreate) btnSubMinistryCreate.style.display = canAdd ? 'inline-block' : 'none';

    const btnCheckinWalkin = document.getElementById('btnCheckinWalkin');
    if(btnCheckinWalkin) btnCheckinWalkin.style.display = canAdd ? 'inline-block' : 'none';
    const addEntryAnalyticsBtn = document.getElementById('addEntryAnalyticsBtn');
    if(addEntryAnalyticsBtn) addEntryAnalyticsBtn.style.display = canAdd ? 'flex' : 'none';

    const btnDirectoryAddMember = document.getElementById('btnDirectoryAddMember');
    if(btnDirectoryAddMember) btnDirectoryAddMember.style.display = canAdd ? 'inline-block' : 'none';
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
