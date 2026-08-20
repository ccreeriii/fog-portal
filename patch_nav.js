window.buildNav = function() {
    const sidebar = document.getElementById('sidebarNav');
    const bottomNav = document.getElementById('bottomNav');
    const hamburger = document.getElementById('hamburgerBtn');

    if(hamburger) hamburger.style.display = 'block';

    let sidebarHtml = '<h2>Main Menu</h2>';
    let bottomHtml = '';

    let currentTab = 'profileTab';
    document.querySelectorAll('.tab-content').forEach(el => { if (el.classList.contains('active')) currentTab = el.id; });

    if(bottomNav) {
        bottomNav.style.display = 'flex';
        bottomNav.style.overflowX = 'auto';
        bottomNav.style.justifyContent = 'space-evenly'; 
        bottomNav.style.gap = '4px';
        bottomNav.style.flexWrap = 'nowrap';
        bottomNav.style.webkitOverflowScrolling = 'touch';
    }

    const addBottomBtn = (target, icon, text, onclickStr, isSub = false, btnId = '') => {
        let isActive = false;
        if (isSub) {
            const targetEl = document.getElementById(target);
            isActive = (currentTab === 'discipleshipTab') && targetEl && targetEl.classList.contains('active');
        } else {
            isActive = (currentTab === target);
        }
        return `<button ${btnId ? 'id="'+btnId+'"' : ''} class="bottom-nav-btn ${isActive ? 'active' : ''}" style="flex: 1; min-width: 60px; padding: 10px 2px;" onclick="${onclickStr}">
            <div class="icon">${icon}</div><span style="white-space:nowrap; font-size:0.65rem;">${text}</span>
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
        bottomHtml += addBottomBtn('growthSubPrayer', '🙏', 'Prayer', "switchTab('discipleshipTab'); setTimeout(()=>window.switchGrowthSubTab('Prayer'),50);", false, 'navPrayerQuick');
        bottomHtml += addBottomBtn('growthSubGroups', '👥', 'Groups', "switchTab('discipleshipTab'); setTimeout(()=>window.switchGrowthSubTab('Groups'),50);", false, 'navGroupsQuick');
    }

    if(bottomNav) bottomNav.innerHTML = bottomHtml;

    sidebarHtml += `<button class="nav-btn ${currentTab === 'profileTab' ? 'active' : ''}" data-target="profileTab" onclick="switchTab('profileTab')">👤 My Profile</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'inboxTab' ? 'active' : ''}" data-target="inboxTab" onclick="switchTab('inboxTab')">🔔 My Inbox</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'arcadeTab' ? 'active' : ''}" data-target="arcadeTab" onclick="switchTab('arcadeTab')">🎯 FOG Arcade</button>`;
    sidebarHtml += `<button class="nav-btn ${currentTab === 'discipleshipTab' ? 'active' : ''}" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">🌱 Personal Growth</button>`;
    sidebarHtml += `<button id="navBtnLeaderboards" class="nav-btn ${currentTab === 'leaderboardsHubTab' ? 'active' : ''}" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')">🏆 Leaderboards</button>`;

    if (window.hasPerm('access_checkin')) sidebarHtml += `<button class="nav-btn ${currentTab === 'checkinTab' ? 'active' : ''}" data-target="checkinTab" onclick="switchTab('checkinTab')">📷 Check-In Station</button>`;
    if (window.hasPerm('access_directory')) sidebarHtml += `<button class="nav-btn ${currentTab === 'directoryTab' ? 'active' : ''}" data-target="directoryTab" onclick="switchTab('directoryTab')">👥 Directory</button>`;
    if (window.hasPerm('access_ministries')) sidebarHtml += `<button class="nav-btn ${currentTab === 'ministriesTab' ? 'active' : ''}" data-target="ministriesTab" onclick="switchTab('ministriesTab')">🏛️ Ministries</button>`;
    if (window.hasPerm('access_events')) sidebarHtml += `<button class="nav-btn ${currentTab === 'eventsTab' ? 'active' : ''}" data-target="eventsTab" onclick="switchTab('eventsTab')">📅 Events Planner</button>`;
    if (window.hasPerm('access_discipleship')) sidebarHtml += `<button class="nav-btn ${currentTab === 'discipleshipAdminTab' ? 'active' : ''}" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')">⚙️ Discipleship Admin</button>`;
    if (window.hasPerm('access_worship')) sidebarHtml += `<button class="nav-btn ${currentTab === 'worshipTab' ? 'active' : ''}" data-target="worshipTab" onclick="switchTab('worshipTab')">🎵 Worship Hub</button>`;
    if (window.hasPerm('access_communications')) sidebarHtml += `<button class="nav-btn ${currentTab === 'communicationsAdminTab' ? 'active' : ''}" data-target="communicationsAdminTab" onclick="switchTab('communicationsAdminTab')">📢 Broadcasts</button>`;
    if (window.hasPerm('access_ai')) sidebarHtml += `<button class="nav-btn ${currentTab === 'aiAssistantTab' ? 'active' : ''}" data-target="aiAssistantTab" onclick="switchTab('aiAssistantTab')">🤖 AI Assistant</button>`;
    if (window.hasPerm('access_attendance')) sidebarHtml += `<button class="nav-btn ${currentTab === 'attendanceTab' ? 'active' : ''}" data-target="attendanceTab" onclick="switchTab('attendanceTab')">📋 Attendance Logs</button>`;
    if (window.hasPerm('access_activity')) sidebarHtml += `<button class="nav-btn ${currentTab === 'activityLogsTab' ? 'active' : ''}" data-target="activityLogsTab" onclick="switchTab('activityLogsTab')">🔍 Audit Logs</button>`;
    if (window.hasPerm('access_permissions')) sidebarHtml += `<button class="nav-btn ${currentTab === 'permissionsTab' ? 'active' : ''}" data-target="permissionsTab" onclick="switchTab('permissionsTab')">🔐 Permissions</button>`;

    sidebarHtml += `<button class="nav-btn text-danger" onclick="handleLogout()">🚪 Logout</button>`;

    if(sidebar) sidebar.innerHTML = sidebarHtml;
};
