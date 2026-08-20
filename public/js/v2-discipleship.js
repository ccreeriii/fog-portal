window.V2Discipleship = {
    _isHooked: false,
    _chartInstance: null,
    pathwaysData: [],
    groupsData: [],
    journalsData: [],
    prayersData: [],

    init: function() {
        console.log('[V2 Engine] Discipleship Module Initialized');
        this.hookIntoLifecycle();
    },

    hookIntoLifecycle: function() {
        if (this._isHooked) return;
        this._isHooked = true;

        if (typeof window.switchTab === 'function') {
            const origSwitchTab = window.switchTab;
            window.switchTab = function(tabId) {
                origSwitchTab(tabId);
                if (tabId === 'discipleshipTab') {
                    V2Discipleship.loadUserGrowthData();
                }
                if (tabId === 'discipleshipAdminTab') {
                    V2Discipleship.loadAdminData();
                }
            };
        }
    },

    loadUserGrowthData: async function() {
        this.loadNextStep();
        this.loadJournals();
        this.loadPrayers();
        this.loadSmallGroups();
        this.loadPathways();
    },

    loadAdminData: async function() {
        this.loadPathways();
        this.loadSmallGroups();
        this.loadHabitSettings();
        this.renderChart();
    },

    switchAdminSubTab: function(tab) {
        document.querySelectorAll('.discipleship-admin-sub-tab').forEach(el => { el.classList.remove('active'); el.style.display = 'none'; });
        document.querySelectorAll('.sub-nav-btn').forEach(el => { if(el.id.includes('btnSubAdmin')) el.classList.remove('active'); });

        const targetMap = { 'analytics': { tab: 'subTabAdminAnalytics', btn: 'btnSubAdminAnalytics' }, 'pathways': { tab: 'subTabAdminPathways', btn: 'btnSubAdminPathways' }, 'groups': { tab: 'subTabAdminGroups', btn: 'btnSubAdminGroups' }, 'habits': { tab: 'subTabAdminHabits', btn: 'btnSubAdminHabits' } };

        if (targetMap[tab]) {
            const t = document.getElementById(targetMap[tab].tab); const b = document.getElementById(targetMap[tab].btn);
            if(t) { t.classList.add('active'); t.style.display = 'block'; }
            if(b) b.classList.add('active');
        }

        if (tab === 'analytics') this.renderChart();
        if (tab === 'habits') this.loadHabitSettings();
    },

    loadHabitSettings: async function() {
        try {
            const res = await fetch('/api/settings/growth-habits');
            const data = await res.json();
            document.getElementById('habitJournalPts').value = data.journal_points !== undefined ? data.journal_points : 10;
            document.getElementById('habitPrayerPts').value = data.prayer_points !== undefined ? data.prayer_points : 5;
        } catch(e) {}
    },

    saveHabitSettings: async function(e) {
        e.preventDefault();
        const payload = { journal_points: document.getElementById('habitJournalPts').value, prayer_points: document.getElementById('habitPrayerPts').value, actor: currentUser };
        window.triggerActionConfirmation('Save Daily Habit Reward Points?', async () => {
            try { const res = await fetch('/api/settings/growth-habits', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                if(res.ok) alert('Habit settings saved!');
            } catch(err) { alert("Network Error"); }
        });
    },

    createPathway: async function(e) {
        e.preventDefault();
        const payload = { title: document.getElementById('pathCreateTitle').value, description: document.getElementById('pathCreateDesc').value, step_order: parseInt(document.getElementById('pathCreateOrder').value), points: parseInt(document.getElementById('pathCreatePoints').value) || 50 };
        window.triggerActionConfirmation(`Create milestone: ${payload.title}?`, async () => {
            const res = await fetch('/api/discipleship/pathways', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('createPathwayForm').reset(); V2Discipleship.loadPathways(); V2Discipleship.renderChart(); }
        });
    },

    openEditPathwayModal: function(id) {
        const p = this.pathwaysData.find(x => x.id === id); if (!p) return;
        document.getElementById('editPathId').value = p.id; document.getElementById('editPathTitle').value = p.title; document.getElementById('editPathDesc').value = p.description; document.getElementById('editPathOrder').value = p.step_order; document.getElementById('editPathPoints').value = p.points !== undefined ? p.points : 50;
        document.getElementById('editPathwayModal').classList.add('active');
    },

    closeEditPathwayModal: function() { document.getElementById('editPathwayModal').classList.remove('active'); },

    updatePathway: async function(e) {
        e.preventDefault(); const id = document.getElementById('editPathId').value;
        const payload = { title: document.getElementById('editPathTitle').value, description: document.getElementById('editPathDesc').value, step_order: parseInt(document.getElementById('editPathOrder').value), points: parseInt(document.getElementById('editPathPoints').value) || 50 };
        window.triggerActionConfirmation('Update this milestone?', async () => {
            const res = await fetch(`/api/discipleship/pathways/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { V2Discipleship.closeEditPathwayModal(); V2Discipleship.loadPathways(); }
        });
    },

    deletePathway: async function(id) {
        window.triggerActionConfirmation('Permanently delete this milestone?', async () => {
            const res = await fetch(`/api/discipleship/pathways/${id}`, { method: 'DELETE' });
            if (res.ok) { V2Discipleship.loadPathways(); V2Discipleship.renderChart(); }
        });
    },

    loadPathways: async function() {
        try {
            const res = await fetch('/api/discipleship/pathways');
            this.pathwaysData = await res.json();
            const adminList = document.getElementById('adminPathwaysList');
            if (adminList) {
                if (this.pathwaysData.length === 0) adminList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No pathways created.</p>`;
                else adminList.innerHTML = this.pathwaysData.map(p => `<div style="background:var(--bg-light); border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px;"><div style="display:flex; justify-content:space-between; align-items:center;"><strong style="color:var(--primary); font-size:1.1rem;">Step ${p.step_order}: ${p.title} <span style="color:#059669; font-size:0.85rem; margin-left:8px;">(+${p.points || 50} XP)</span></strong><div style="display:flex; gap:5px;">${typeof window.hasPerm === 'function' && window.hasPerm('edit_entries') ? `<button class="btn btn-outline btn-sm" onclick="V2Discipleship.openEditPathwayModal(${p.id})">✏️ Edit</button>` : ''}${typeof window.hasPerm === 'function' && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V2Discipleship.deletePathway(${p.id})">🗑️ Del</button>` : ''}</div></div><p style="font-size: 0.85rem; color: var(--text-main); margin-top: 5px;">${p.description}</p></div>`).join('');
            }
            if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
                const progRes = await fetch(`/api/discipleship/member-progress/${currentMember.id}`); const progress = await progRes.json();
                const userList = document.getElementById('pathwaysListContainer');
                if (userList) {
                    if (progress.length === 0) return userList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No active pathways available.</p>`;
                    userList.innerHTML = progress.map(p => {
                        const isCompleted = p.status === 'Completed'; const badge = isCompleted ? `<span class="badge badge-green">✅ Completed</span>` : `<span class="badge badge-orange">⏳ Pending</span>`; const actionBtn = !isCompleted ? `<button class="btn btn-primary btn-sm" onclick="V2Discipleship.updateMilestone(${p.pathway_id}, 'Completed')">Mark Complete</button>` : '';
                        return `<div style="background:#FFF; border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:var(--text-main); font-size:1.05rem;">${p.title}</strong><div style="margin-top:5px;">${badge}</div></div><div>${actionBtn}</div></div>`;
                    }).join('');
                }
            }
        } catch(e) {}
    },

    loadNextStep: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
        const container = document.getElementById('nextStepContainer'); if (!container) return;
        try {
            const res = await fetch(`/api/discipleship/next-step/${currentMember.id}`); const data = await res.json();
            if (data.nextStep) container.innerHTML = `<div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;"><h3 style="margin: 0 0 10px 0; color: white; border: none; font-size:1.2rem;">🌟 Your Next Step</h3><strong style="font-size:1.1rem; display:block; margin-bottom:5px;">${data.nextStep.title}</strong><p style="font-size: 0.9rem; margin: 0; opacity: 0.9;">${data.nextStep.description}</p></div>`;
            else container.innerHTML = ``;
        } catch(e) {}
    },

    updateMilestone: async function(pathwayId, status) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("Member context missing.");
        window.triggerActionConfirmation(`Mark this milestone as ${status}?`, async () => {
            const res = await fetch('/api/discipleship/milestones', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id, pathway_id: pathwayId, status: status, notes: '', actor: currentUser }) });
            if (res.ok) { V2Discipleship.loadPathways(); V2Discipleship.loadNextStep(); if(window.V6Gamification) window.V6Gamification.loadMyPoints(); }
        });
    },

    
    applyJournalTemplate: function() {
        const type = document.getElementById('journalType').value;
        const contentBox = document.getElementById('journalContent');
        const titleBox = document.getElementById('journalTitle');
        
        if (type === 'Lectio Divina') {
            titleBox.value = "Lectio Divina: ";
            contentBox.value = "📖 READ (What word or phrase stands out?):\n\n\n🤔 MEDITATE (What is God saying to you?):\n\n\n🙏 PRAY (Your response to God):\n\n\n✨ CONTEMPLATE (How will you carry this today?):\n";
        } else if (type === 'Examen') {
            titleBox.value = "Evening Examen";
            contentBox.value = "🙏 GRATITUDE (What are you thankful for today?):\n\n\n🔍 REVIEW (Where did you see God today? Where did you fail?):\n\n\n💔 REPENT (Ask for forgiveness for your shortcomings):\n\n\n🌅 RESOLVE (How will you do better tomorrow?):\n";
        } else {
            titleBox.value = "";
            contentBox.value = "";
        }
    },
    saveJournal: async function(e) {
        e.preventDefault();
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in as a member.");
        const payload = { youth_id: currentMember.id, title: document.getElementById('journalTitle').value, mood: document.getElementById('journalMood').value, content: document.getElementById('journalContent').value };
        try {
            const res = await fetch('/api/journals', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('journalForm').reset(); V2Discipleship.loadJournals(); if(window.V6Gamification) window.V6Gamification.loadMyPoints(); }
        } catch(e) {}
    },

    openEditJournalModal: function(id) {
        const j = this.journalsData.find(x => x.id === id); if(!j) return;
        document.getElementById('editJournalId').value = j.id; document.getElementById('editJournalTitle').value = j.title; document.getElementById('editJournalMood').value = j.mood; document.getElementById('editJournalContent').value = j.content;
        document.getElementById('editJournalModal').classList.add('active');
    },

    closeEditJournalModal: function() { document.getElementById('editJournalModal').classList.remove('active'); },

    updateJournal: async function(e) {
        e.preventDefault(); const id = document.getElementById('editJournalId').value;
        const payload = { title: document.getElementById('editJournalTitle').value, mood: document.getElementById('editJournalMood').value, content: document.getElementById('editJournalContent').value };
        const res = await fetch(`/api/journals/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { this.closeEditJournalModal(); this.loadJournals(); }
    },

    deleteJournal: async function(id) {
        window.triggerActionConfirmation('Delete this journal entry permanently?', async () => { const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' }); if (res.ok) V2Discipleship.loadJournals(); });
    },

    loadJournals: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
        const container = document.getElementById('journalsContainer'); if (!container) return;
        try {
            const res = await fetch(`/api/journals/${currentMember.id}`); this.journalsData = await res.json();
            if (this.journalsData.length === 0) return container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">You haven't written any journals yet.</p>`;
            container.innerHTML = this.journalsData.map(j => `
                <div style="background:var(--bg-light); padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong style="color:var(--primary); font-size:1.1rem;">${j.title}</strong><span class="badge badge-orange">${j.mood}</span></div>
                    <p style="font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; line-height:1.5;">${j.content}</p>
                    <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
                        <button class="btn btn-outline btn-sm" onclick="V2Discipleship.openEditJournalModal(${j.id})">✏️ Edit</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="V2Discipleship.deleteJournal(${j.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch(e) {}
    },

    submitPrayer: async function(e) {
        e.preventDefault();
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in to post prayers.");
        const payload = { youth_id: currentMember.id, title: document.getElementById('prayerTitle').value, request: document.getElementById('prayerContent').value, is_anonymous: document.getElementById('prayerAnonymous').checked ? 1 : 0 };
        try {
            const res = await fetch('/api/prayers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('prayerForm').reset(); V2Discipleship.loadPrayers(); if(window.V6Gamification) window.V6Gamification.loadMyPoints(); }
        } catch(e) {}
    },

    openEditPrayerModal: function(id) {
        const p = this.prayersData.find(x => x.id === id); if(!p) return;
        document.getElementById('editPrayerId').value = p.id; document.getElementById('editPrayerTitle').value = p.title; document.getElementById('editPrayerContent').value = p.request; document.getElementById('editPrayerAnonymous').checked = (p.is_anonymous === 1);
        document.getElementById('editPrayerModal').classList.add('active');
    },

    closeEditPrayerModal: function() { document.getElementById('editPrayerModal').classList.remove('active'); },

    updatePrayer: async function(e) {
        e.preventDefault(); const id = document.getElementById('editPrayerId').value;
        const payload = { title: document.getElementById('editPrayerTitle').value, request: document.getElementById('editPrayerContent').value, is_anonymous: document.getElementById('editPrayerAnonymous').checked };
        const res = await fetch(`/api/prayers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { this.closeEditPrayerModal(); this.loadPrayers(); }
    },

    intercedePrayer: async function(id) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in to intercede.");
        try { const res = await fetch(`/api/prayers/${id}/intercede`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id }) }); if (res.ok) V2Discipleship.loadPrayers(); } catch(e) {}
    },

    loadPrayers: async function() {
        const container = document.getElementById('prayerWallContainer'); if (!container) return;
        try {
            const res = await fetch('/api/prayers'); this.prayersData = await res.json();
            if (this.prayersData.length === 0) return container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No active prayer requests at the moment.</p>`;
            container.innerHTML = this.prayersData.map(p => {
                const author = p.is_anonymous ? "Anonymous" : (p.author_name || 'Unknown');
                const isOwner = currentMember && p.youth_id === currentMember.id;
                const editBtn = isOwner ? `<button class="btn btn-outline btn-sm" onclick="V2Discipleship.openEditPrayerModal(${p.id})">✏️ Edit</button>` : '';
                return `<div style="background:#FFF; padding:15px; border-radius:8px; border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 15px;"><div style="margin-bottom:8px;"><strong style="color:var(--primary); font-size:1.1rem;">${p.title}</strong><div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Requested by ${author} • ${p.created_at}</div></div><p style="font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; margin-bottom:15px;">${p.request}</p><div style="display:flex; gap:10px; align-items:center;"><button class="btn btn-outline btn-sm" onclick="V2Discipleship.intercedePrayer(${p.id})">🙏 I prayed for this!</button><div style="margin-left:auto;">${editBtn}</div></div></div>`;
            }).join('');
        } catch(e) {}
    },

    filterLeaderSearch: function() {
        const q = document.getElementById('sgLeaderSearch').value.toLowerCase().trim(); const dropdown = document.getElementById('sgLeaderDropdown');
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        if (typeof youthData !== 'undefined' && youthData.length > 0) {
            const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
            if (matches.length > 0) { dropdown.innerHTML = matches.map(y => `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #E2E8F0;" onclick="V2Discipleship.selectLeader(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name}</strong></div>`).join(''); dropdown.style.display = 'block'; } else { dropdown.innerHTML = '<div style="padding:10px; color:var(--text-muted);">No matches</div>'; dropdown.style.display = 'block'; }
        }
    },
    selectLeader: function(id, name) { document.getElementById('sgCreateLeaderId').value = id; document.getElementById('sgLeaderSearch').value = name; document.getElementById('sgLeaderDropdown').style.display = 'none'; },

    createSmallGroup: async function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('sgCreateLogo');
        let logoBase64 = null;
        if(fileInput && fileInput.files.length > 0 && typeof window.getBase64 === 'function') logoBase64 = await window.getBase64(fileInput.files[0], 400);

        const payload = { name: document.getElementById('sgCreateName').value, leader_id: document.getElementById('sgCreateLeaderId').value || null, meeting_schedule: document.getElementById('sgCreateSchedule').value, venue: document.getElementById('sgCreateVenue').value, points: parseInt(document.getElementById('sgCreatePoints').value) || 20, logo: logoBase64, privacy_level: document.getElementById('sgCreatePrivacy').value };
        window.triggerActionConfirmation(`Create Small Group '${payload.name}'?`, async () => {
            const res = await fetch('/api/small-groups', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('createSmallGroupForm').reset(); document.getElementById('sgCreateLeaderId').value = ''; V2Discipleship.loadSmallGroups(); }
        });
    },

    openEditSmallGroupModal: function(id) {
        const g = this.groupsData.find(x => x.id === id); if (!g) return;
        document.getElementById('editSgId').value = g.id; document.getElementById('editSgName').value = g.name;
        const lSearch = document.getElementById('editSgLeaderSearch'); if (lSearch) lSearch.value = g.leader_name || '';
        const lId = document.getElementById('editSgLeaderId'); if (lId) lId.value = g.leader_id || ''; document.getElementById('editSgSchedule').value = g.meeting_schedule || ''; document.getElementById('editSgVenue').value = g.venue || ''; document.getElementById('editSgPoints').value = g.points !== undefined ? g.points : 20;
        document.getElementById('editSgPrivacy').value = g.privacy_level || 'Open';
        document.getElementById('editSmallGroupModal').classList.add('active');
    },

    closeEditSmallGroupModal: function() { document.getElementById('editSmallGroupModal').classList.remove('active'); },

    updateSmallGroup: async function(e) {
        e.preventDefault();
        const id = document.getElementById('editSgId').value;
        const fileInput = document.getElementById('editSgLogo');
        let logoBase64 = undefined;
        if(fileInput && fileInput.files.length > 0 && typeof window.getBase64 === 'function') logoBase64 = await window.getBase64(fileInput.files[0], 400);

        const payload = { name: document.getElementById('editSgName').value, meeting_schedule: document.getElementById('editSgSchedule').value, venue: document.getElementById('editSgVenue').value, points: parseInt(document.getElementById('editSgPoints').value) || 20, privacy_level: document.getElementById('editSgPrivacy').value };
        if(logoBase64 !== undefined) payload.logo = logoBase64;
        
        if(document.getElementById('editSgLeaderId')) payload.leader_id = document.getElementById('editSgLeaderId').value;
        window.triggerActionConfirmation('Update this small group?', async () => {
            const res = await fetch(`/api/small-groups/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) { V2Discipleship.closeEditSmallGroupModal(); V2Discipleship.loadSmallGroups(); }
        });
    },

    deleteSmallGroup: async function(id) {
        window.triggerActionConfirmation('Permanently delete this small group?', async () => {
            const res = await fetch(`/api/small-groups/${id}`, { method: 'DELETE' });
            if (res.ok) V2Discipleship.loadSmallGroups();
        });
    },

    joinSmallGroup: async function(id) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in as a member to join a group.");
        window.triggerActionConfirmation('Request to join this Small Group?', async () => {
            const res = await fetch(`/api/small-groups/${id}/join`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id }) });
            if (res.ok) { const data = await res.json(); alert(data.status === 'Pending' ? 'Your request to join has been sent to the leader for approval!' : 'You have been added to the group!'); V2Discipleship.loadSmallGroups(); if(window.V6Gamification) window.V6Gamification.loadMyPoints(); }
        });
    },

    loadSmallGroups: async function() {
        try {
            const currentId = (typeof currentMember !== 'undefined' && currentMember) ? currentMember.id : 0;
            const res = await fetch('/api/small-groups?youth_id=' + currentId); this.groupsData = await res.json();
            const adminList = document.getElementById('adminSmallGroupsList');
            if (adminList) {
                if (this.groupsData.length === 0) adminList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No small groups established.</p>`;
                else {
                    adminList.innerHTML = this.groupsData.map(g => {
                        const logoHtml = g.logo ? `<img src="${g.logo}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0;">` : ``;
                        return `<div style="background:var(--bg-light); border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;"><div style="display:flex; gap:10px; align-items:center;">${logoHtml}<div><strong style="color:var(--primary); font-size:1.1rem;">${g.name} <span style="color:#059669; font-size:0.85rem; margin-left:8px;">(+${g.points || 20} XP)</span></strong><br><small style="color:var(--text-muted);">Leader: ${g.leader_name || 'Unassigned'} | Members: ${g.member_count}</small></div></div><div style="display:flex; gap:5px;">${typeof window.hasPerm === 'function' && window.hasPerm('edit_entries') ? `<button class="btn btn-outline btn-sm" onclick="V2Discipleship.openEditSmallGroupModal(${g.id})">✏️ Edit</button>` : ''}${typeof window.hasPerm === 'function' && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V2Discipleship.deleteSmallGroup(${g.id})">🗑️ Del</button>` : ''}</div></div>`;
                    }).join('');
                }
            }
            const userList = document.getElementById('smallGroupsContainer');
            if (userList) {
                if (this.groupsData.length === 0) return userList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">No small groups available right now.</p>';
                
                const myGroups = this.groupsData.filter(g => g.user_status === 'Approved');
                const pendingGroups = this.groupsData.filter(g => g.user_status === 'Pending');
                const discoverGroups = this.groupsData.filter(g => !g.user_status && g.privacy_level !== 'Invite-Only');
                
                const renderCard = (g, mode) => {
                    const logoHtml = g.logo ? `<img src="${g.logo}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; flex-shrink:0;">` : `<div style="width: 50px; height: 50px; background: var(--bg-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink:0;">👥</div>`;
                    let btnHtml = '';
                    if (mode === 'Enter') btnHtml = `<button class="btn btn-primary btn-sm" style="width:100%; box-shadow: 0 4px 6px rgba(255,107,0,0.2);" onclick="openGroupDashboard(${g.id}, '${g.name.replace(/'/g, "\\'")}', '${g.logo}', '${(g.leader_name||'').replace(/'/g, "\\'")}', ${g.leader_id})">🚪 Enter Dashboard</button>`;
                    else if (mode === 'Pending') btnHtml = `<button class="btn btn-secondary btn-sm" disabled style="width:100%;">⏳ Request Pending...</button>`;
                    else btnHtml = `<button class="btn btn-outline btn-sm" style="width:100%; border-color:var(--primary); color:var(--primary);" onclick="V2Discipleship.joinSmallGroup(${g.id})">${g.privacy_level === 'Approval' ? 'Request to Join' : 'Join Group'}</button>`;
                    
                    return `<div style="background:#FFF; border: 1px solid var(--border-color); padding: 15px; margin-bottom: 15px; border-radius: 8px; display:flex; gap:15px; align-items:center;">
                        ${logoHtml}
                        <div style="flex:1;">
                            <h3 style="color:var(--primary); margin-bottom:5px;">${g.name} ${g.privacy_level==='Approval'?'🔒':''}</h3>
                            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">📅 ${g.meeting_schedule || 'TBA'} <br>👤 Leader: ${g.leader_name || 'TBA'}</p>
                            ${btnHtml}
                        </div>
                    </div>`;
                };

                let html = '';
                if(myGroups.length > 0) {
                    html += '<h3 style="color:var(--text-main); margin-bottom: 10px;">My Groups</h3>';
                    html += myGroups.map(g => renderCard(g, 'Enter')).join('');
                }
                if(pendingGroups.length > 0) {
                    html += '<h3 style="color:var(--text-muted); margin-top: 20px; margin-bottom: 10px;">Pending Approvals</h3>';
                    html += pendingGroups.map(g => renderCard(g, 'Pending')).join('');
                }
                if(discoverGroups.length > 0) {
                    html += '<h3 style="color:var(--text-main); margin-top: 20px; margin-bottom: 10px;">Discover Groups</h3>';
                    html += discoverGroups.map(g => renderCard(g, 'Join')).join('');
                }
                userList.innerHTML = html;
            }
        } catch(e) {}
    },

    renderChart: async function() {
        const ctx = document.getElementById('spiritualStagesChart'); if (!ctx) return;
        try {
            const res = await fetch('/api/discipleship/analytics/stages'); const data = await res.json();
            const labels = data.stages.map(s => s.title); labels.push("Unassigned");
            const counts = data.stages.map(s => s.user_count); counts.push(data.unassigned);
            if (this._chartInstance) this._chartInstance.destroy();
            this._chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: counts, backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#E2E8F0'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } } } });
        } catch (e) {}
    }
};

document.addEventListener('DOMContentLoaded', () => { V2Discipleship.init(); });


// --- V17: EDIT LEADER SEARCH ---
window.V2Discipleship.filterEditLeaderSearch = function() {
    const q = document.getElementById('editSgLeaderSearch').value.toLowerCase().trim();
    const dropdown = document.getElementById('editSgLeaderDropdown');
    if (q.length < 2) { dropdown.style.display = 'none'; return; }
    if (typeof youthData !== 'undefined' && youthData.length > 0) {
        const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(y => `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #E2E8F0;" onclick="V2Discipleship.selectEditLeader(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name}</strong></div>`).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '<div style="padding:10px; color:var(--text-muted);">No matches</div>';
            dropdown.style.display = 'block';
        }
    }
};
window.V2Discipleship.selectEditLeader = function(id, name) {
    document.getElementById('editSgLeaderId').value = id;
    document.getElementById('editSgLeaderSearch').value = name;
    document.getElementById('editSgLeaderDropdown').style.display = 'none';
};
