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
        this.loadLiturgicalData();
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

    
    loadLiturgicalData: async function() {
        const container = document.getElementById('liturgicalCard');
        if(!container) return;
        try {
            const res = await fetch('/api/liturgical/today');
            const data = await res.json();
            let bgColor = '#10B981'; 
            const color = (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].colour : data.season_color || 'green';
            if (color === 'red') bgColor = '#DC2626'; 
            else if (color === 'violet' || color === 'purple') bgColor = '#7C3AED'; 
            else if (color === 'white' || color === 'gold') bgColor = '#F59E0B'; 
            else if (color === 'rose' || color === 'pink') bgColor = '#F472B6'; 
            
            container.style.background = `linear-gradient(135deg, ${bgColor}, #111)`;
            container.style.display = 'block';
            document.getElementById('liturgicalSeason').innerText = (data.season || 'Ordinary').toUpperCase() + ' TIME';
            document.getElementById('liturgicalFeast').innerText = (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].title : "Daily Mass";
            document.getElementById('liturgicalGospel').innerText = data.daily_gospel || "I am the bread of life... (John 6:35)";
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
                    html += '<h3 style="color:var(--text-main); margin-bottom: 10px;">🔥 Fire Circles</h3>';
                    html += myGroups.map(g => renderCard(g, 'Enter')).join('');
                }
                if(pendingGroups.length > 0) {
                    html += '<h3 style="color:var(--text-muted); margin-top: 20px; margin-bottom: 10px;">Pending Approvals</h3>';
                    html += pendingGroups.map(g => renderCard(g, 'Pending')).join('');
                }
                if(discoverGroups.length > 0) {
                    html += '<h3 style="color:var(--text-main); margin-top: 20px; margin-bottom: 10px;">🏕️ Discover Campfires</h3>';
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


// ==========================================
// V44: GROUP DASHBOARD & UNIVERSALIS FIXES
// ==========================================

// 1. Liturgical API Fetch & Universalis Iframe
window.V2Discipleship.loadLiturgicalData = async function() {
    const container = document.getElementById("liturgicalCard");
    if (!container) return;
    try {
        const res = await fetch("/api/liturgical/today");
        const data = await res.json();
        let bg = "#10B981"; // Default green
        const col = (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].colour : data.season_color || "green";
        if (col === "red") bg = "#DC2626";
        else if (col === "violet" || col === "purple") bg = "#7C3AED";
        else if (col === "white" || col === "gold") bg = "#F59E0B";
        else if (col === "rose" || col === "pink") bg = "#F472B6";

        container.style.background = 'linear-gradient(135deg, ' + bg + ', #111)';
        
        const txt = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        txt("liturgicalSeason", (data.season || "Ordinary").toUpperCase() + " TIME");
        txt("liturgicalFeast", (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].title : "Daily Mass");
        txt("liturgicalGospel", data.daily_gospel || "I am the bread of life... (John 6:35)");
    } catch(e) {
        console.error("Liturgical API Error:", e);
    }
};

window.openLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        const contentArea = modal.querySelector('.modal-content') || modal;
        let iframe = document.getElementById('readingsIframe');
        
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'readingsIframe';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            contentArea.appendChild(iframe);
        }
        // Universalis Daily Mass Iframe
        iframe.src = 'https://universalis.com/mass.htm';
    } else {
        alert("Readings modal not found in HTML!");
    }
};

window.closeLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

// 2. Group Dashboard Fixes
window.switchDashTab = function(tabName) {
    document.querySelectorAll('.dash-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.dash-nav-btn').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById('dashTab' + tabName);
    if (target) target.style.display = 'block';
    
    const btn = document.getElementById('btnDash' + tabName);
    if (btn) btn.classList.add('active');
};

window.launchDashCampfire = function(groupId, groupName) {
    if (typeof window.switchTab === 'function') window.switchTab('communicationsTab');
    // Hook for V4 Comm module if present
    if (typeof window.V4Communications !== 'undefined' && window.V4Communications.openThread) {
        setTimeout(() => window.V4Communications.openThread(groupId), 300);
    }
};

window.launchDashVault = function(groupId) {
    alert("Video Vault feature is currently undergoing maintenance for staging environment!");
};

window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return alert("Group dashboard modal missing!");
    
    // Fix Null Logo Bug structurally
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<img id="dashGroupLogo" src="' + safeLogo + '" style="width:60px; height:60px; border-radius:12px; object-fit:cover; margin-right:15px;">';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:60px; height:60px; border-radius:12px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin-right:15px;">👥</div>';
        }
    }
    
    if (document.getElementById('dashGroupName')) document.getElementById('dashGroupName').innerText = name;
    if (document.getElementById('dashGroupLeader')) document.getElementById('dashGroupLeader').innerText = "Led by " + (leaderName || 'TBA');
    
    const chatBtn = document.getElementById('btnDashChat');
    if (chatBtn) chatBtn.onclick = () => window.launchDashCampfire(id, name);
    
    const vidBtn = document.getElementById('btnDashVideo');
    if (vidBtn) vidBtn.onclick = () => window.launchDashVault(id);

    modal.style.display = 'flex';
    modal.classList.add('active');
    window.switchDashTab('Members'); // Auto-open Members tab
};

// 3. Ensure Liturgical Data fires when Growth Hub opens
const origLoadGrowth = window.V2Discipleship.loadUserGrowthData;
window.V2Discipleship.loadUserGrowthData = async function() {
    if (typeof this.loadLiturgicalData === 'function') this.loadLiturgicalData();
    if (origLoadGrowth) origLoadGrowth.call(this);
};


// ==========================================
// V100: ABSOLUTE TRUTH - GROUPS & LITURGICAL
// ==========================================

// --- LITURGICAL IFRAME ---
window.openLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) {
        modal.style.display = 'flex'; 
        modal.classList.add('active');
        const contentArea = modal.querySelector('.modal-content') || modal;
        let iframe = document.getElementById('readingsIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'readingsIframe';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            contentArea.appendChild(iframe);
        }
        iframe.src = 'https://universalis.com/philippines/mass.htm';
    }
};

window.closeLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) { 
        modal.style.display = 'none'; 
        modal.classList.remove('active'); 
    }
};

// --- GROUP DASHBOARD TABS & CHAT ---
window.switchDashTab = function(tabName) {
    document.querySelectorAll('.dash-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.dash-nav-btn').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('dashTab' + tabName);
    if (target) target.style.display = 'block';
    const btn = document.getElementById('btnDash' + tabName);
    if (btn) btn.classList.add('active');
};

window.launchDashCampfire = function(groupId, groupName) {
    if (typeof window.switchTab === 'function') window.switchTab('communicationsTab');
    if (typeof window.V4Communications !== 'undefined' && window.V4Communications.openThread) {
        setTimeout(() => window.V4Communications.openThread(groupId), 300);
    }
};

window.launchDashVault = function(groupId) {
    alert("Video Vault feature is currently undergoing maintenance!");
};

// --- CENTERED LOGO & DASHBOARD INIT ---
window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return alert("Group dashboard modal missing!");
    
    // Perfectly centered logo replacement
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; margin: 0 auto 15px auto;"><img src="' + safeLogo + '" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; border-radius:12px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-size:2rem; margin: 0 auto 15px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">👥</div>';
        }
    }
    
    if (document.getElementById('dashGroupName')) document.getElementById('dashGroupName').innerText = name || 'Group Name';
    if (document.getElementById('dashGroupLeader')) document.getElementById('dashGroupLeader').innerText = "Led by " + (leaderName || 'TBA');
    
    const chatBtn = document.getElementById('btnDashChat');
    if (chatBtn) chatBtn.onclick = () => window.launchDashCampfire(id, name);
    const vidBtn = document.getElementById('btnDashVideo');
    if (vidBtn) vidBtn.onclick = () => window.launchDashVault(id);

    modal.style.display = 'flex';
    modal.style.zIndex = '105000';
    modal.classList.add('active');
    window.switchDashTab('Members'); // Force members tab open by default
};

// ==========================================
// V101: DEFINITIVE GROUPS LOGIC FIX
// ==========================================

window.switchDashTab = function(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.dash-tab-content').forEach(el => el.style.display = 'none');
    // Remove active class from all tab buttons
    document.querySelectorAll('.dash-nav-btn').forEach(el => el.classList.remove('active'));

    // Show target tab content
    const target = document.getElementById('dashTab' + tabName);
    if (target) target.style.display = 'block';

    // Highlight target tab button
    const btn = document.getElementById('btnDash' + tabName);
    if (btn) btn.classList.add('active');
};

window.launchDashCampfire = function(groupId, groupName) {
    if (typeof window.switchTab === 'function') window.switchTab('communicationsTab');
    if (typeof window.V4Communications !== 'undefined' && window.V4Communications.openThread) {
        setTimeout(() => window.V4Communications.openThread(groupId), 300);
    } else {
        alert("Navigating to Chat... (Communications module loading)");
    }
};

window.launchDashVault = function(groupId) {
    alert("Video Vault feature is currently undergoing maintenance for staging environment!");
};

window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return alert("Group dashboard modal missing!");

    // Centered Logo Injection
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; margin: 0 auto 15px auto;"><img src="' + safeLogo + '" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; border-radius:12px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-size:2rem; margin: 0 auto 15px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">👥</div>';
        }
    }

    if (document.getElementById('dashGroupName')) document.getElementById('dashGroupName').innerText = name || 'Group Name';
    if (document.getElementById('dashGroupLeader')) document.getElementById('dashGroupLeader').innerText = "Led by " + (leaderName || 'TBA');

    // Forcefully wire the Action Buttons
    const chatBtn = document.getElementById('btnDashChat');
    if (chatBtn) {
        chatBtn.onclick = null; 
        chatBtn.onclick = () => window.launchDashCampfire(id, name);
    }

    const vidBtn = document.getElementById('btnDashVideo');
    if (vidBtn) {
        vidBtn.onclick = null;
        vidBtn.onclick = () => window.launchDashVault(id);
    }

    // Forcefully wire the Tabs
    const tabMap = {
        'btnDashMembers': 'Members',
        'btnDashPrayers': 'Prayers',
        'btnDashDeepDive': 'DeepDive',
        'btnDashMemories': 'Memories'
    };
    for (const [btnId, tabName] of Object.entries(tabMap)) {
        const tBtn = document.getElementById(btnId);
        if (tBtn) {
            tBtn.onclick = (e) => {
                e.preventDefault();
                window.switchDashTab(tabName);
            };
        }
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '105000';
    modal.classList.add('active');
    
    // Auto-open Members tab
    window.switchDashTab('Members'); 
};


// ==========================================
// V102: GROUP DASHBOARD & LITURGICAL FIXES
// ==========================================

// 1. Group State Tracking
window.currentDashboardGroupId = null;

// 2. Open Group Dashboard & Centered Logo
window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return alert("Group dashboard modal missing!");

    // Save ID for Campfire button
    window.currentDashboardGroupId = id;

    // Centered Logo
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; margin: 0 auto 15px auto;"><img src="' + safeLogo + '" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; border-radius:12px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-size:2rem; margin: 0 auto 15px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">👥</div>';
        }
    }

    // Populate Text
    if (document.getElementById('dashGroupName')) document.getElementById('dashGroupName').innerText = name || 'Group Name';
    
    // Fix the "Loading..." Text Bug
    const metaEl = document.getElementById('dashGroupMeta');
    if (metaEl) metaEl.innerText = "Led by " + (leaderName || 'TBA');

    modal.style.display = 'flex';
    modal.style.zIndex = '105000';
    modal.classList.add('active');
    
    // Force open the Hub (Overview) tab
    window.switchDashTab('overview');
};

// 3. Tab Switcher
window.switchDashTab = function(tabName) {
    const tabs = ['overview', 'members', 'prayers', 'deepdive', 'memories'];
    tabs.forEach(t => {
        const elId = t === 'deepdive' ? 'dashTabDeepDive' : 'dashTab' + t.charAt(0).toUpperCase() + t.slice(1);
        const btnId = t === 'deepdive' ? 'btnDashDeepDive' : 'btnDash' + t.charAt(0).toUpperCase() + t.slice(1);

        const el = document.getElementById(elId);
        const btn = document.getElementById(btnId);

        if (el) el.style.display = (tabName === t) ? 'block' : 'none';
        if (btn) {
            if (tabName === t) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
};

// 4. Action Buttons (Using saved Global ID)
window.launchDashCampfire = function() {
    if (!window.currentDashboardGroupId) return alert("Group ID not detected.");
    if (typeof window.switchTab === 'function') window.switchTab('communicationsTab');
    if (typeof window.V4Communications !== 'undefined' && window.V4Communications.openThread) {
        setTimeout(() => window.V4Communications.openThread(window.currentDashboardGroupId), 300);
    } else {
        alert("Navigating to Chat module...");
    }
};

window.launchDashVault = function() {
    alert("Video Vault feature is currently undergoing maintenance!");
};

// 5. Universalis Iframe Modal
window.openLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) {
        modal.style.display = 'flex'; 
        modal.classList.add('active');
        const contentArea = modal.querySelector('.modal-content') || modal;
        let iframe = document.getElementById('readingsIframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'readingsIframe';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            contentArea.appendChild(iframe);
        }
        iframe.src = 'https://universalis.com/philippines/mass.htm';
    }
};

window.closeLiturgicalReadings = function() {
    const modal = document.getElementById('liturgicalReadingsModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
};

// 6. Liturgical Fetcher
window.V2Discipleship.loadLiturgicalData = async function() {
    const c = document.getElementById("liturgicalCard");
    if (c) c.style.display = "block";
    try {
        const res = await fetch("/api/liturgical/today");
        const data = await res.json();
        let bg = "#10B981"; 
        const col = (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].colour : data.season_color || "green";
        if (col === "red") bg = "#DC2626";
        else if (col === "violet" || col === "purple") bg = "#7C3AED";
        else if (col === "white" || col === "gold") bg = "#F59E0B";
        else if (col === "rose" || col === "pink") bg = "#F472B6";

        if (c) c.style.background = 'linear-gradient(135deg, ' + bg + ', #111)';
        
        const txt = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
        txt("liturgicalSeason", (data.season || "Ordinary").toUpperCase() + " TIME");
        txt("liturgicalFeast", (data.celebrations && data.celebrations.length > 0) ? data.celebrations[0].title : "Daily Mass");
        txt("liturgicalGospel", data.daily_gospel || "I am the bread of life... (John 6:35)");
    } catch(e) {
        if (c) c.style.background = "linear-gradient(135deg, #10B981, #111)";
    }
};

// ==========================================
// HOTFIX: GROUP DASHBOARD & INNER TABS LOGIC
// ==========================================

// 1. Group State Tracking
window.currentDashboardGroupId = null;
window.currentDashboardGroupName = null;

// 2. Open Group Dashboard & Centered Logo + Leader Name Fix
window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return alert("Group dashboard modal missing!");

    // Save state for Inner Tabs and Action Buttons
    window.currentDashboardGroupId = id;
    window.currentDashboardGroupName = name;

    // Fix Logo Rendering & Null String Traps
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:80px; height:80px; margin: 0 auto 15px auto;"><img src="' + safeLogo + '" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block; border: 1px solid rgba(255,107,0,0.2);"></div>';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:80px; height:80px; border-radius:12px; background:#FFF0E6; border: 1px solid rgba(255,107,0,0.2); display:flex; align-items:center; justify-content:center; font-size:2rem; margin: 0 auto 15px auto;">👥</div>';
        }
    }

    // Fix Group Name
    if (document.getElementById('dashGroupName')) {
        document.getElementById('dashGroupName').innerText = name || 'Group Name';
    }

    // Fix "Loading..." Text Bug (Targeting the correct ID 'dashGroupMeta')
    const metaEl = document.getElementById('dashGroupMeta');
    if (metaEl) {
        metaEl.innerText = "Led by " + (leaderName && leaderName !== 'null' && leaderName !== 'undefined' ? leaderName : 'TBA');
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '105000';
    modal.classList.add('active');

    // Force open the Hub (Overview) tab
    window.switchDashTab('overview');
};

// 3. Close Group Dashboard
window.closeGroupDashboard = function() {
    const modal = document.getElementById('groupDashboardModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    window.currentDashboardGroupId = null;
    window.currentDashboardGroupName = null;
};

// 4. Inner Tab Switcher Engine
window.switchDashTab = function(tabName) {
    const tabs = ['overview', 'members', 'prayers', 'deepdive', 'memories'];
    tabs.forEach(t => {
        const elId = t === 'deepdive' ? 'dashTabDeepDive' : 'dashTab' + t.charAt(0).toUpperCase() + t.slice(1);
        const btnId = t === 'deepdive' ? 'btnDashDeepDive' : 'btnDash' + t.charAt(0).toUpperCase() + t.slice(1);

        const el = document.getElementById(elId);
        const btn = document.getElementById(btnId);

        if (el) el.style.display = (tabName === t) ? 'block' : 'none';
        if (btn) {
            if (tabName === t) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
};

// 5. Open Chat (Campfire) Routing
window.launchDashCampfire = function() {
    if (!window.currentDashboardGroupId) return alert("Group ID not detected.");
    
    // Hide Dashboard Modal
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal) { dashModal.style.display = 'none'; dashModal.classList.remove('active'); }
    
    // Open Campfire Modal natively mapped in HTML
    const chatModal = document.getElementById('groupSpaceModal');
    if (chatModal) {
        document.getElementById('groupSpaceTitle').innerText = window.currentDashboardGroupName ? ('🔥 ' + window.currentDashboardGroupName) : '🔥 Campfire';
        chatModal.style.display = 'flex';
        chatModal.style.zIndex = '105000';
        chatModal.classList.add('active');
    }
};

window.closeGroupSpace = function() {
    const chatModal = document.getElementById('groupSpaceModal');
    if (chatModal) { chatModal.style.display = 'none'; chatModal.classList.remove('active'); }
    
    // Reopen Dashboard
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal && window.currentDashboardGroupId) { 
        dashModal.style.display = 'flex'; 
        dashModal.classList.add('active'); 
    }
};

// 6. Open Video Vault Routing
window.launchDashVault = function() {
    if (!window.currentDashboardGroupId) return alert("Group ID not detected.");
    
    // Hide Dashboard Modal
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal) { dashModal.style.display = 'none'; dashModal.classList.remove('active'); }

    // Open Video Vault Modal natively mapped in HTML
    const vaultModal = document.getElementById('groupVaultModal');
    if (vaultModal) {
        vaultModal.style.display = 'flex';
        vaultModal.style.zIndex = '105000';
        vaultModal.classList.add('active');
    }
};

window.closeGroupVault = function() {
    const vaultModal = document.getElementById('groupVaultModal');
    if (vaultModal) { vaultModal.style.display = 'none'; vaultModal.classList.remove('active'); }
    
    // Reopen Dashboard
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal && window.currentDashboardGroupId) { 
        dashModal.style.display = 'flex'; 
        dashModal.classList.add('active'); 
    }
};

// ==========================================
// HOTFIX: GROUPS DASHBOARD ENGINE (ALL TABS)
// ==========================================

// --- CORE: STORE LEADER ID FOR PERMISSIONS ---
const _origOpenGroupDashboardState = window.openGroupDashboard;
window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    window.currentDashboardLeaderId = leaderId;
    if (_origOpenGroupDashboardState) _origOpenGroupDashboardState(id, name, logo, leaderName, leaderId);
};

// --- TAB DATA HOOKS ---
const _origSwitchDashTabHook = window.switchDashTab;
window.switchDashTab = function(tabName) {
    if (_origSwitchDashTabHook) _origSwitchDashTabHook(tabName);
    
    // Dynamically load data when tabs are clicked
    if (tabName === 'members') window.loadGroupMembers();
    if (tabName === 'prayers') window.loadGroupPrayers();
    if (tabName === 'deepdive') window.loadGroupThreads();
    if (tabName === 'memories') window.loadGroupMemories();
};

const _origLaunchDashCampfireHook = window.launchDashCampfire;
window.launchDashCampfire = function() {
    if (_origLaunchDashCampfireHook) _origLaunchDashCampfireHook();
    window.loadGroupChat();
};

const _origLaunchDashVaultHook = window.launchDashVault;
window.launchDashVault = function() {
    if (_origLaunchDashVaultHook) _origLaunchDashVaultHook();
    
    // Override the "Under Maintenance" alert from previous code natively
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal) { dashModal.style.display = 'none'; dashModal.classList.remove('active'); }
    const vaultModal = document.getElementById('groupVaultModal');
    if (vaultModal) {
        vaultModal.style.display = 'flex';
        vaultModal.style.zIndex = '105000';
        vaultModal.classList.add('active');
        window.loadGroupVault();
    }
};

// --- 1. CHAT (CAMPFIRE) ENGINE ---
window.sendGroupMessage = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    const input = document.getElementById('groupChatInput');
    const message = input.value.trim();
    if (!message || !window.currentDashboardGroupId || !currentMember) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/chat`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ youth_id: currentMember.id, message: message })
        });
        if (res.ok) {
            input.value = '';
            window.loadGroupChat();
        }
    } catch(err) { console.error("Chat Error:", err); }
};

window.loadGroupChat = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/chat?last_id=0`);
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">Welcome to your group\'s private campfire. 🔥</p>';
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isMe = currentMember && msg.name === currentMember.name;
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--primary)' : '#E2E8F0';
            const color = isMe ? '#FFF' : 'var(--text-main)';
            const borderR = isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px';
            const avatar = msg.profile_picture ? `<img src="${msg.profile_picture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:#CBD5E1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FFF;">${msg.name.charAt(0)}</div>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:5px;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4;">
                    ${msg.message}
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:4px;">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; // Auto-scroll to bottom
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- 2. MEMBERS ENGINE ---
window.loadGroupMembers = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('dashMembersList');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading members...</p>';
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/roster-status`);
        const members = await res.json();
        
        container.innerHTML = members.map(m => {
            const avatarHtml = m.profile_picture ? `<img src="${m.profile_picture}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">` : `<div style="width:36px;height:36px;border-radius:50%;background:var(--bg-light);display:flex;align-items:center;justify-content:center;font-weight:bold;">${m.name.charAt(0)}</div>`;
            // Simplified Online tracking - logic assumes online if active today
            const isOnline = m.last_active && m.last_active.split(' ')[0] === new Date().toISOString().split('T')[0];
            const statusIndicator = isOnline ? '🟢' : '⚪';
            
            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border-color); background:#FFF; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; gap:12px; align-items:center;">
                    ${avatarHtml}
                    <div>
                        <strong style="color:var(--text-main); font-size:0.95rem;">${m.name}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${statusIndicator} ${isOnline ? 'Online Today' : 'Offline'}</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p style="text-align:center; color:var(--danger);">Failed to load members.</p>'; }
};

// --- 3. PRAYERS ENGINE ---
window.openGroupPrayerModal = function() {
    const modal = document.getElementById('groupPrayerModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
};

window.closeGroupPrayerModal = function() {
    const modal = document.getElementById('groupPrayerModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
};

window.submitGroupPrayer = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    if (!window.currentDashboardGroupId || !currentMember) return;
    
    const payload = {
        youth_id: currentMember.id,
        title: document.getElementById('gpTitle').value,
        request: document.getElementById('gpRequest').value,
        is_anonymous: document.getElementById('gpAnonymous').checked
    };
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/prayers`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        if (res.ok) {
            document.getElementById('gpTitle').value = '';
            document.getElementById('gpRequest').value = '';
            document.getElementById('gpAnonymous').checked = false;
            window.closeGroupPrayerModal();
            window.loadGroupPrayers();
        }
    } catch(err) { console.error(err); }
};

window.loadGroupPrayers = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('dashPrayersList');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/prayers`);
        const prayers = await res.json();
        
        if (prayers.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; margin-top:20px;">No prayers shared yet. Be the first!</p>';
            return;
        }
        
        container.innerHTML = prayers.map(p => {
            const author = p.is_anonymous ? 'Anonymous' : (p.author_name || 'Unknown');
            return `
            <div style="background:#FFF; padding:15px; border-radius:8px; border:1px solid #E2E8F0; margin-bottom:12px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                <div style="margin-bottom:8px;">
                    <strong style="color:#8B5CF6; font-size:1.05rem;">${p.title}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Requested by ${author} • ${p.created_at.split(' ')[0]}</div>
                </div>
                <p style="font-size:0.9rem; color:var(--text-main); white-space:pre-wrap; margin-bottom:12px;">${p.request}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn btn-outline btn-sm" onclick="intercedeGroupPrayer(${p.id})">🙏 I prayed for this</button>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

window.intercedeGroupPrayer = async function(prayerId) {
    if (!currentMember) return;
    try {
        await fetch(`/api/small-groups/prayers/${prayerId}/intercede`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ youth_id: currentMember.id, group_name: window.currentDashboardGroupName })
        });
        alert('Thank you for interceding!');
    } catch(e) {}
};

// --- 4. DEEP DIVES (FORUM) ENGINE ---
window.submitGroupThread = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    if (!window.currentDashboardGroupId || !currentMember) return;
    
    const payload = {
        youth_id: currentMember.id,
        title: document.getElementById('threadTitle').value,
        content: document.getElementById('threadContent').value
    };
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/threads`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        if (res.ok) {
            document.getElementById('threadTitle').value = '';
            document.getElementById('threadContent').value = '';
            window.loadGroupThreads();
        }
    } catch(err) { console.error(err); }
};

window.loadGroupThreads = async function() {
    if (!window.currentDashboardGroupId) return;
    
    // Ensure form is visible
    const createSection = document.getElementById('dashCreateThreadSection');
    if (createSection) createSection.style.display = 'block';

    const container = document.getElementById('dashThreadsList');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/threads`);
        const threads = await res.json();
        
        if (threads.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">No discussions started yet.</p>';
            return;
        }
        
        container.innerHTML = threads.map(t => `
        <div style="background:#FFF; padding:15px; border-radius:12px; border:1px solid var(--border-color); margin-bottom:12px; cursor:pointer; box-shadow:0 4px 6px rgba(0,0,0,0.02);" onclick="openThreadView(${t.id}, '${t.title.replace(/'/g, "\\'")}', '${t.content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}', '${t.author_name.replace(/'/g, "\\'")}', '${t.created_at}', '${t.profile_picture || ''}')">
            <h3 style="color:var(--primary); font-size:1.1rem; margin:0 0 5px 0;">${t.title}</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin:0 0 10px 0;">Started by ${t.author_name} • ${t.created_at.split(' ')[0]}</p>
            <div style="display:flex; justify-content:flex-end;">
                <span style="font-size:0.8rem; background:rgba(255,107,0,0.1); color:var(--primary); padding:4px 8px; border-radius:12px; font-weight:bold;">💬 ${t.reply_count || 0} Replies</span>
            </div>
        </div>`).join('');
    } catch(e) { console.error(e); }
};

window.openThreadView = async function(threadId, title, content, author, date, avatar) {
    const modal = document.getElementById('groupThreadModal');
    if (!modal) return;
    
    document.getElementById('viewThreadTitle').innerText = title;
    document.getElementById('viewThreadAuthor').innerText = author;
    document.getElementById('viewThreadDate').innerText = date;
    document.getElementById('viewThreadContent').innerText = content;
    document.getElementById('replyThreadId').value = threadId;
    
    const avHtml = avatar ? `<img src="${avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : author.charAt(0);
    document.getElementById('viewThreadAvatar').innerHTML = avHtml;
    
    // Hide dashboard temporarily
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal) dashModal.style.display = 'none';
    
    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // Load Replies
    const repliesContainer = document.getElementById('threadRepliesList');
    repliesContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading replies...</p>';
    
    try {
        const res = await fetch(`/api/small-groups/threads/${threadId}/replies`);
        const replies = await res.json();
        
        if (replies.length === 0) {
            repliesContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Be the first to reply!</p>';
        } else {
            repliesContainer.innerHTML = replies.map(r => {
                const rAv = r.profile_picture ? `<img src="${r.profile_picture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:var(--bg-light);display:flex;align-items:center;justify-content:center;font-size:10px;">${r.author_name.charAt(0)}</div>`;
                return `
                <div style="background:#F8FAFC; padding:12px; border-radius:8px; border:1px solid #E2E8F0;">
                    <div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">
                        ${rAv} <strong style="font-size:0.85rem; color:var(--text-main);">${r.author_name}</strong> <span style="font-size:0.7rem; color:var(--text-muted);">${r.created_at.split(' ')[0]}</span>
                    </div>
                    <p style="font-size:0.9rem; color:var(--text-main); margin:0; line-height:1.4;">${r.reply_text}</p>
                </div>`;
            }).join('');
        }
    } catch(e) { console.error(e); }
};

window.closeThreadView = function() {
    const modal = document.getElementById('groupThreadModal');
    if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
    
    // Reopen dashboard and refresh threads list
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal) { dashModal.style.display = 'flex'; window.loadGroupThreads(); }
};

window.submitThreadReply = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    if (!currentMember) return;
    
    const threadId = document.getElementById('replyThreadId').value;
    const input = document.getElementById('replyThreadInput');
    const text = input.value.trim();
    if (!text || !threadId) return;
    
    try {
        const res = await fetch(`/api/small-groups/threads/${threadId}/replies`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ youth_id: currentMember.id, reply_text: text })
        });
        if (res.ok) {
            input.value = '';
            // Refresh modal data manually without closing it
            window.openThreadView(
                threadId, 
                document.getElementById('viewThreadTitle').innerText, 
                document.getElementById('viewThreadContent').innerText, 
                document.getElementById('viewThreadAuthor').innerText, 
                document.getElementById('viewThreadDate').innerText, 
                null
            );
        }
    } catch(err) { console.error(err); }
};

// --- 5. MEMORIES ENGINE ---
window.submitGroupMemory = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    if (!window.currentDashboardGroupId || !currentMember) return;
    
    const fileInput = document.getElementById('memoryImageInput');
    const captionInput = document.getElementById('memoryCaptionInput');
    
    if (fileInput.files.length === 0) return alert('Please select an image first.');
    
    try {
        // Convert to Base64
        let base64Image = null;
        if (typeof window.getBase64 === 'function') {
            base64Image = await window.getBase64(fileInput.files[0], 800);
        }
        
        if (!base64Image) return alert("Failed to process image.");
        
        const payload = {
            youth_id: currentMember.id,
            image_data: base64Image,
            caption: captionInput.value.trim()
        };
        
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/memories`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            fileInput.value = '';
            captionInput.value = '';
            window.loadGroupMemories();
        }
    } catch(err) { console.error("Memory Upload Error:", err); }
};

window.loadGroupMemories = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('dashMemoriesGrid');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/memories`);
        const memories = await res.json();
        
        if (memories.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.9rem;">No memories posted yet.</div>';
            return;
        }
        
        container.innerHTML = memories.map(m => `
        <div style="background:#FFF; border-radius:12px; overflow:hidden; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02);">
            <img src="${m.image_data}" style="width:100%; height:150px; object-fit:cover; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
            <div style="padding:10px;">
                <p style="font-size:0.85rem; color:var(--text-main); margin:0 0 5px 0; font-weight:600;">${m.caption}</p>
                <div style="font-size:0.7rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                    <span>By ${m.author_name}</span>
                    <span>${m.created_at.split(' ')[0]}</span>
                </div>
            </div>
        </div>`).join('');
    } catch(e) { console.error(e); }
};

// --- 6. VIDEO VAULT LEADER ENGINE ---
window.loadGroupVault = async function() {
    if (!window.currentDashboardGroupId) return;
    
    // Check Leader Status
    const isLeader = currentMember && (currentMember.id == window.currentDashboardLeaderId || currentUser === 'celsocreeriii@gmail.com');
    const leaderControls = document.getElementById('vaultLeaderControls');
    if (leaderControls) leaderControls.style.display = isLeader ? 'block' : 'none';
    
    const container = document.getElementById('vaultListContainer');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading sessions...</p>';
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/sessions`);
        const sessions = await res.json();
        
        if (sessions.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">No sessions scheduled yet.</p>';
            return;
        }
        
        container.innerHTML = sessions.map(s => `
        <div style="background:#FFF; border-radius:8px; padding:15px; margin-bottom:10px; border:1px solid var(--border-color); box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <strong style="color:var(--text-main); font-size:1.05rem;">${s.title}</strong>
            <p style="font-size:0.85rem; color:var(--text-muted); margin:5px 0;">📅 ${new Date(s.scheduled_at).toLocaleString()}</p>
            <a href="${s.meet_link}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-block; margin-top:5px; border-color:#2563EB; color:#2563EB; text-decoration:none;">🎥 Join Meet</a>
            ${isLeader ? `<button class="btn btn-danger btn-sm" style="margin-top:5px; margin-left:5px;" onclick="deleteGroupSession(${s.id})">Del</button>` : ''}
        </div>`).join('');
    } catch(e) { console.error(e); }
};

window.scheduleGroupSession = async function(e) {
    e.preventDefault(); // STRICT FIX: Prevents page reload
    if (!window.currentDashboardGroupId) return;
    
    const payload = {
        title: document.getElementById('vaultSessionTitle').value,
        scheduled_at: document.getElementById('vaultSessionDate').value,
        meet_link: document.getElementById('vaultSessionMeet').value
    };
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/sessions`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        if (res.ok) {
            document.getElementById('vaultSessionTitle').value = '';
            document.getElementById('vaultSessionDate').value = '';
            document.getElementById('vaultSessionMeet').value = '';
            window.loadGroupVault();
        }
    } catch(err) { console.error(err); }
};

window.deleteGroupSession = async function(sessionId) {
    if (!confirm("Delete this session?")) return;
    try {
        const res = await fetch(`/api/small-groups/sessions/${sessionId}`, { method: 'DELETE' });
        if (res.ok) window.loadGroupVault();
    } catch(e) { console.error(e); }
};


// ==========================================
// HOTFIX: GROUPS DASHBOARD POLISH & FEATURES
// ==========================================

// --- 1. PRAYER MODAL Z-INDEX FIX ---
window.openGroupPrayerModal = function() {
    const modal = document.getElementById('groupPrayerModal');
    if (modal) { 
        modal.style.zIndex = '106000'; // Forces it strictly above the 105000 Dashboard
        modal.style.display = 'flex'; 
        modal.classList.add('active'); 
    }
};

// --- 2. MEMORIES DOUBLE-CLICK PREVENTION ---
window.submitGroupMemory = async function(e) {
    e.preventDefault(); 
    if (!window.currentDashboardGroupId || !currentMember) return;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // Prevent double submission
    
    const fileInput = document.getElementById('memoryImageInput');
    const captionInput = document.getElementById('memoryCaptionInput');
    
    if (fileInput.files.length === 0) return alert('Please select an image first.');
    
    // Lock Button State
    submitBtn.disabled = true;
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Uploading... Please wait';
    
    try {
        let base64Image = null;
        if (typeof window.getBase64 === 'function') {
            base64Image = await window.getBase64(fileInput.files[0], 800);
        }
        
        if (!base64Image) {
            submitBtn.disabled = false; submitBtn.innerText = originalText;
            return alert("Failed to process image.");
        }
        
        const payload = {
            youth_id: currentMember.id,
            image_data: base64Image,
            caption: captionInput.value.trim()
        };
        
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/memories`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            fileInput.value = '';
            captionInput.value = '';
            window.loadGroupMemories();
        }
    } catch(err) { console.error("Memory Upload Error:", err); }
    
    // Unlock Button State
    submitBtn.disabled = false;
    submitBtn.innerText = originalText;
};

// --- 3. VIDEO VAULT LEADER CONTROLS FIX ---
window.loadGroupVault = async function() {
    if (!window.currentDashboardGroupId) return;
    
    // Expanded Auth: Shows controls if user is the assigned leader, OR has 'edit_entries' permission, OR is Superadmin
    const isLeader = currentMember && (
        currentMember.id == window.currentDashboardLeaderId || 
        currentUser === 'celsocreeriii@gmail.com' || 
        (typeof window.hasPerm === 'function' && window.hasPerm('edit_entries'))
    );
    
    const leaderControls = document.getElementById('vaultLeaderControls');
    if (leaderControls) leaderControls.style.display = isLeader ? 'block' : 'none';
    
    const container = document.getElementById('vaultListContainer');
    if (!container) return;
    
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading sessions...</p>';
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/sessions`);
        const sessions = await res.json();
        
        if (sessions.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">No sessions scheduled yet.</p>';
            return;
        }
        
        container.innerHTML = sessions.map(s => `
        <div style="background:#FFF; border-radius:8px; padding:15px; margin-bottom:10px; border:1px solid var(--border-color); box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <strong style="color:var(--text-main); font-size:1.05rem;">${s.title}</strong>
            <p style="font-size:0.85rem; color:var(--text-muted); margin:5px 0;">📅 ${new Date(s.scheduled_at).toLocaleString()}</p>
            <a href="${s.meet_link}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-block; margin-top:5px; border-color:#2563EB; color:#2563EB; text-decoration:none;">🎥 Join Meet</a>
            ${isLeader ? `<button class="btn btn-danger btn-sm" style="margin-top:5px; margin-left:5px;" onclick="deleteGroupSession(${s.id})">Del</button>` : ''}
        </div>`).join('');
    } catch(e) { console.error(e); }
};

// --- 4. CHAT: YOUTUBE EMBEDS & FACEBOOK REACTIONS ---
window.loadGroupChat = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/chat?last_id=0`);
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">Welcome to your group\'s private campfire. 🔥</p>';
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isMe = currentMember && msg.name === currentMember.name;
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--primary)' : '#E2E8F0';
            const color = isMe ? '#FFF' : 'var(--text-main)';
            const borderR = isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px';
            const avatar = msg.profile_picture ? `<img src="${msg.profile_picture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:#CBD5E1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FFF;font-weight:bold;">${msg.name.charAt(0)}</div>`;
            
            // 4a. YouTube Embed Parser Engine
            let parsedMessage = msg.message;
            const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g;
            parsedMessage = parsedMessage.replace(ytRegex, (match, videoId) => {
                return `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`;
            });

            // 4b. Reaction Parser Engine (Facebook Style)
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(msg.reactions || '{}');
                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    // Handle both v1 integer counts and v2 array tracking
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div style="display:flex; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:2px 6px; font-size:0.75rem; position:absolute; bottom:-12px; ${isMe ? 'right:10px;' : 'left:10px;'} box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main);">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); font-weight:bold; margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            // Reaction Picker Toggle Button
            const reactButton = `<span style="cursor:pointer; opacity:0.5; font-size:0.9rem; margin: 0 5px;" onclick="toggleReactionPicker(${msg.id})" title="React">😀</span>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:18px; position:relative;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="display:flex; align-items:center; flex-direction:${isMe ? 'row-reverse' : 'row'}; gap:5px; width: 100%; justify-content:${isMe ? 'flex-start' : 'flex-start'}">
                    <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4; position:relative; word-wrap: break-word;">
                        ${parsedMessage}
                        ${reactionsHtml}
                    </div>
                    <div style="position:relative;">
                        ${reactButton}
                        <div id="reactPicker_${msg.id}" style="display:none; position:absolute; bottom:100%; ${isMe ? 'right:0;' : 'left:0;'} background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:10px; white-space:nowrap; margin-bottom: 5px;">
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '👍')">👍</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '❤️')">❤️</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '😂')">😂</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🙏')">🙏</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🔥')">🔥</span>
                        </div>
                    </div>
                </div>
                
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px; ${isMe ? 'margin-right:10px;' : 'margin-left:30px;'}">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; // Auto-scroll to bottom
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- 5. REACTION HELPER FUNCTIONS ---
window.toggleReactionPicker = function(msgId) {
    // Hide all other open pickers first
    document.querySelectorAll('[id^="reactPicker_"]').forEach(el => {
        if (el.id !== 'reactPicker_' + msgId) el.style.display = 'none';
    });
    
    const picker = document.getElementById('reactPicker_' + msgId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

window.submitChatReaction = async function(msgId, emoji) {
    if (!currentMember) return;
    const picker = document.getElementById('reactPicker_' + msgId);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: 'chat', id: msgId, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) window.loadGroupChat(); // Soft-refresh chat to show updated emojis
    } catch(e) { console.error("Reaction error", e); }
};

// ==========================================
// HOTFIX: PRAYER Z-INDEX, YOUTUBE KILL SWITCH, FACEBOOK REACTIONS
// ==========================================

// --- 1. THE ABSOLUTE Z-INDEX FORCE OVERRIDE ---
window.openGroupPrayerModal = function() {
    const modal = document.getElementById('groupPrayerModal');
    if (modal) { 
        // This physically forces the browser to ignore the CSS !important rule
        modal.style.setProperty('z-index', '106000', 'important'); 
        modal.style.display = 'flex'; 
        modal.classList.add('active'); 
    }
};

// --- 2. YOUTUBE VIDEO KILL SWITCH ---
window.closeGroupSpace = function() {
    const chatModal = document.getElementById('groupSpaceModal');
    if (chatModal) { chatModal.style.display = 'none'; chatModal.classList.remove('active'); }
    
    // KILL THE IFRAME: Wiping the HTML stops the video/audio immediately
    const container = document.getElementById('groupChatMessages');
    if (container) container.innerHTML = ''; 

    // Reopen Dashboard natively
    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal && window.currentDashboardGroupId) { 
        dashModal.style.display = 'flex'; 
        dashModal.classList.add('active'); 
    }
};

// --- 3. FACEBOOK REACTION LIST MODAL (Who Reacted) ---
window.showReactionList = function(encodedReacts) {
    try {
        const reacts = JSON.parse(decodeURIComponent(encodedReacts));
        const modal = document.getElementById('reactionListModal');
        const listContainer = document.getElementById('reactionListNames');
        if (!modal || !listContainer) return;
        
        let html = '';
        Object.keys(reacts).forEach(emoji => {
            const users = Array.isArray(reacts[emoji]) ? reacts[emoji] : [];
            if (users.length > 0) {
                html += `<div style="margin-bottom: 15px;">
                    <div style="font-size: 1.2rem; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; display:flex; align-items:center; gap:8px;">
                        ${emoji} <span style="font-size: 0.85rem; color: #64748B; font-weight:bold;">${users.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${users.map(u => `<span style="font-size: 0.95rem; color: #0F172A;">${u}</span>`).join('')}
                    </div>
                </div>`;
            }
        });
        
        listContainer.innerHTML = html || '<div style="text-align:center; color:#64748B;">No reactions yet.</div>';
        
        // Force Z-Index above everything
        modal.style.setProperty('z-index', '107000', 'important');
        modal.style.display = 'flex';
        modal.classList.add('active');
    } catch(e) {}
};

window.toggleReactionPicker = function(pickerId) {
    // Hide all other open pickers
    document.querySelectorAll('[id^="reactPicker_"]').forEach(el => {
        if (el.id !== 'reactPicker_' + pickerId) el.style.display = 'none';
    });
    
    const picker = document.getElementById('reactPicker_' + pickerId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

// --- 4. CHAT ENGINE (With YouTube & Facebook Reactions) ---
window.submitChatReaction = async function(msgId, emoji) {
    if (!currentMember) return;
    const picker = document.getElementById('reactPicker_chat_' + msgId);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: 'chat', id: msgId, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) window.loadGroupChat(); 
    } catch(e) { console.error("Reaction error", e); }
};

window.loadGroupChat = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/chat?last_id=0`);
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">Welcome to your group\'s private campfire. 🔥</p>';
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isMe = currentMember && msg.name === currentMember.name;
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--primary)' : '#E2E8F0';
            const color = isMe ? '#FFF' : 'var(--text-main)';
            const borderR = isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px';
            const avatar = msg.profile_picture ? `<img src="${msg.profile_picture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:#CBD5E1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FFF;font-weight:bold;">${msg.name.charAt(0)}</div>`;
            
            // YouTube Parser
            let parsedMessage = msg.message;
            const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g;
            parsedMessage = parsedMessage.replace(ytRegex, (match, videoId) => {
                return `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`;
            });

            // Facebook Reaction Parser
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(msg.reactions || '{}');
                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    const safeReacts = encodeURIComponent(JSON.stringify(reacts));
                    reactionsHtml = `<div onclick="showReactionList('${safeReacts}')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:2px 6px; font-size:0.75rem; position:absolute; bottom:-12px; ${isMe ? 'right:10px;' : 'left:10px;'} box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main); z-index: 10;">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); font-weight:bold; margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; opacity:0.5; font-size:0.9rem; margin: 0 5px;" onclick="toggleReactionPicker('chat_${msg.id}')" title="React">😀</span>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:18px; position:relative;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="display:flex; align-items:center; flex-direction:${isMe ? 'row-reverse' : 'row'}; gap:5px; width: 100%; justify-content:${isMe ? 'flex-start' : 'flex-start'}">
                    <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4; position:relative; word-wrap: break-word;">
                        ${parsedMessage}
                        ${reactionsHtml}
                    </div>
                    <div style="position:relative;">
                        ${reactButton}
                        <div id="reactPicker_chat_${msg.id}" style="display:none; position:absolute; bottom:100%; ${isMe ? 'right:0;' : 'left:0;'} background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:10px; white-space:nowrap; margin-bottom: 5px;">
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '👍')">👍</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '❤️')">❤️</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '😂')">😂</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🙏')">🙏</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🔥')">🔥</span>
                        </div>
                    </div>
                </div>
                
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px; ${isMe ? 'margin-right:10px;' : 'margin-left:30px;'}">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; // Auto-scroll to bottom
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- 5. MEMORIES ENGINE (With Facebook Reactions) ---
window.submitMemoryReaction = async function(msgId, emoji) {
    if (!currentMember) return;
    const picker = document.getElementById('reactPicker_mem_' + msgId);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: 'memory', id: msgId, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) window.loadGroupMemories(); 
    } catch(e) { console.error("Reaction error", e); }
};

window.loadGroupMemories = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('dashMemoriesGrid');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/memories`);
        const memories = await res.json();
        
        if (memories.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.9rem;">No memories posted yet.</div>';
            return;
        }
        
        container.innerHTML = memories.map(m => {
            // Facebook Reaction Parser
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(m.reactions || '{}');
                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    const safeReacts = encodeURIComponent(JSON.stringify(reacts));
                    reactionsHtml = `<div onclick="showReactionList('${safeReacts}')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:4px 8px; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main);">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); font-weight:bold; margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; font-size:1.1rem; opacity: 0.7;" onclick="toggleReactionPicker('mem_${m.id}')" title="React">😀</span>`;

            return `
            <div style="background:#FFF; border-radius:12px; overflow:visible; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column;">
                <img src="${m.image_data}" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
                <div style="padding:10px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <p style="font-size:0.85rem; color:var(--text-main); margin:0 0 10px 0; font-weight:600;">${m.caption}</p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; position:relative;">
                        ${reactionsHtml}
                        
                        <div style="position:relative; margin-left:auto;">
                            ${reactButton}
                            <div id="reactPicker_mem_${m.id}" style="display:none; position:absolute; bottom:100%; right:0; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:10px; white-space:nowrap; margin-bottom: 5px;">
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '👍')">👍</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '❤️')">❤️</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '😂')">😂</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '🙏')">🙏</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '🔥')">🔥</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

// ==========================================
// HOTFIX: BULLETPROOF FACEBOOK REACTION ENGINE
// ==========================================

window.chatReactionsMap = {};
window.memoryReactionsMap = {};

// 1. REACTION LIST MODAL (Who Reacted)
window.showReactionList = function(id, type) {
    try {
        const reacts = type === 'chat' ? window.chatReactionsMap[id] : window.memoryReactionsMap[id];
        const modal = document.getElementById('reactionListModal');
        const listContainer = document.getElementById('reactionListNames');
        if (!modal || !listContainer || !reacts) return;
        
        let html = '';
        Object.keys(reacts).forEach(emoji => {
            const users = Array.isArray(reacts[emoji]) ? reacts[emoji] : [];
            if (users.length > 0) {
                html += `<div style="margin-bottom: 15px;">
                    <div style="font-size: 1.2rem; margin-bottom: 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; display:flex; align-items:center; gap:8px;">
                        ${emoji} <span style="font-size: 0.85rem; color: #64748B; font-weight:bold;">${users.length}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${users.map(u => `<span style="font-size: 0.95rem; color: #0F172A;">${u}</span>`).join('')}
                    </div>
                </div>`;
            }
        });
        
        listContainer.innerHTML = html || '<div style="text-align:center; color:#64748B;">No reactions yet.</div>';
        
        modal.style.setProperty('z-index', '107000', 'important');
        modal.style.display = 'flex';
        modal.classList.add('active');
    } catch(e) { console.error("Show Reaction Error:", e); }
};

// 2. CHAT PARSER FIX
window.loadGroupChat = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/chat?last_id=0`);
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem; margin-top: 20px;">Welcome to your group\'s private campfire. 🔥</p>';
            return;
        }
        
        container.innerHTML = messages.map(msg => {
            const isMe = currentMember && msg.name === currentMember.name;
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? 'var(--primary)' : '#E2E8F0';
            const color = isMe ? '#FFF' : 'var(--text-main)';
            const borderR = isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px';
            const avatar = msg.profile_picture ? `<img src="${msg.profile_picture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<div style="width:24px;height:24px;border-radius:50%;background:#CBD5E1;display:flex;align-items:center;justify-content:center;font-size:10px;color:#FFF;font-weight:bold;">${msg.name.charAt(0)}</div>`;
            
            // YouTube Parser
            let parsedMessage = msg.message;
            const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g;
            parsedMessage = parsedMessage.replace(ytRegex, (match, videoId) => {
                return `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`;
            });

            // State Map Injection
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(msg.reactions || '{}');
                window.chatReactionsMap[msg.id] = reacts; // Store securely in memory

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionList(${msg.id}, 'chat')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:2px 6px; font-size:0.75rem; position:absolute; bottom:-12px; ${isMe ? 'right:10px;' : 'left:10px;'} box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main); z-index: 10;">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); font-weight:bold; margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; opacity:0.5; font-size:0.9rem; margin: 0 5px;" onclick="toggleReactionPicker('chat_${msg.id}')" title="React">😀</span>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:18px; position:relative;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="display:flex; align-items:center; flex-direction:${isMe ? 'row-reverse' : 'row'}; gap:5px; width: 100%; justify-content:${isMe ? 'flex-start' : 'flex-start'}">
                    <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4; position:relative; word-wrap: break-word;">
                        ${parsedMessage}
                        ${reactionsHtml}
                    </div>
                    <div style="position:relative;">
                        ${reactButton}
                        <div id="reactPicker_chat_${msg.id}" style="display:none; position:absolute; bottom:100%; ${isMe ? 'right:0;' : 'left:0;'} background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:10px; white-space:nowrap; margin-bottom: 5px;">
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '👍')">👍</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '❤️')">❤️</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '😂')">😂</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🙏')">🙏</span>
                            <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitChatReaction(${msg.id}, '🔥')">🔥</span>
                        </div>
                    </div>
                </div>
                
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px; ${isMe ? 'margin-right:10px;' : 'margin-left:30px;'}">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; 
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- 3. MEMORIES PARSER FIX ---
window.loadGroupMemories = async function() {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('dashMemoriesGrid');
    if (!container) return;
    
    try {
        const res = await fetch(`/api/small-groups/${window.currentDashboardGroupId}/memories`);
        const memories = await res.json();
        
        if (memories.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); font-size:0.9rem;">No memories posted yet.</div>';
            return;
        }
        
        container.innerHTML = memories.map(m => {
            // State Map Injection
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(m.reactions || '{}');
                window.memoryReactionsMap[m.id] = reacts; // Store securely in memory

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionList(${m.id}, 'memory')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:4px 8px; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main);">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); font-weight:bold; margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; font-size:1.1rem; opacity: 0.7;" onclick="toggleReactionPicker('mem_${m.id}')" title="React">😀</span>`;

            return `
            <div style="background:#FFF; border-radius:12px; overflow:visible; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column;">
                <img src="${m.image_data}" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
                <div style="padding:10px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <p style="font-size:0.85rem; color:var(--text-main); margin:0 0 10px 0; font-weight:600;">${m.caption}</p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; position:relative;">
                        ${reactionsHtml}
                        
                        <div style="position:relative; margin-left:auto;">
                            ${reactButton}
                            <div id="reactPicker_mem_${m.id}" style="display:none; position:absolute; bottom:100%; right:0; background:#FFF; border:1px solid var(--border-color); border-radius:20px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:10px; white-space:nowrap; margin-bottom: 5px;">
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '👍')">👍</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '❤️')">❤️</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '😂')">😂</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '🙏')">🙏</span>
                                <span style="cursor:pointer; font-size:1.3rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitMemoryReaction(${m.id}, '🔥')">🔥</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};


// ==========================================
// V103: CAMPFIRE DASHBOARD & ADMIN MODERATION
// ==========================================
window.currentDashboardGroupId = null;

window.openGroupDashboard = function(id, name, logo, leaderName, leaderId) {
    const modal = document.getElementById('groupDashboardModal');
    if (!modal) return;
    window.currentDashboardGroupId = id;

    // Centered Logo
    let safeLogo = (logo && logo !== 'null' && logo !== 'undefined') ? logo : '';
    const logoEl = document.getElementById('dashGroupLogo');
    if (logoEl) {
        if (safeLogo) {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; margin: 0 auto 15px auto;"><img src="' + safeLogo + '" style="width:100%; height:100%; border-radius:12px; object-fit:cover; display:block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>';
        } else {
            logoEl.outerHTML = '<div id="dashGroupLogo" style="width:70px; height:70px; border-radius:12px; background:var(--bg-light); display:flex; align-items:center; justify-content:center; font-size:2rem; margin: 0 auto 15px auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">🔥</div>';
        }
    }

    if (document.getElementById('dashGroupName')) document.getElementById('dashGroupName').innerText = name || 'Campfire Name';
    const metaEl = document.getElementById('dashGroupMeta');
    if (metaEl) metaEl.innerText = "Led by " + (leaderName || 'TBA');

    // Admin Access Verification
    const adminBtn = document.getElementById('btnDashAdmin');
    const isLeader = (typeof currentMember !== 'undefined' && currentMember && leaderId == currentMember.id);
    const isSuperAdmin = (typeof currentMember !== 'undefined' && currentMember && currentMember.role === 'Super Admin');

    if (adminBtn) adminBtn.style.display = (isLeader || isSuperAdmin) ? 'inline-block' : 'none';

    if (isLeader || isSuperAdmin) {
        if (typeof window.loadAdminPendingMembers === 'function') window.loadAdminPendingMembers(id);
        if (V2Discipleship && V2Discipleship.groupsData) {
            const g = V2Discipleship.groupsData.find(x => x.id === id);
            if(g && document.getElementById('dashAdminPrivacy')) document.getElementById('dashAdminPrivacy').value = g.privacy_level || 'Open';
        }
    }

    modal.style.display = 'flex';
    modal.style.zIndex = '105000';
    modal.classList.add('active');
    window.switchDashTab('overview');
};

window.switchDashTab = function(tabName) {
    const tabs = ['overview', 'members', 'prayers', 'deepdive', 'memories', 'admin'];
    tabs.forEach(t => {
        const elId = t === 'deepdive' ? 'dashTabDeepDive' : 'dashTab' + t.charAt(0).toUpperCase() + t.slice(1);
        const btnId = t === 'deepdive' ? 'btnDashDeepDive' : 'btnDash' + t.charAt(0).toUpperCase() + t.slice(1);
        const el = document.getElementById(elId);
        const btn = document.getElementById(btnId);
        if (el) el.style.display = (tabName === t) ? 'block' : 'none';
        if (btn) {
            if (tabName === t) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
};

// ADMIN: Load Pending Members
window.loadAdminPendingMembers = async function(groupId) {
    try {
        const res = await fetch('/api/small-groups/' + groupId + '/roster-status');
        const members = await res.json();
        const pending = members.filter(m => m.status === 'Pending');
        const container = document.getElementById('dashAdminPendingList');
        if (!container) return;

        if (pending.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">No pending requests at this time.</p>';
            return;
        }

        container.innerHTML = pending.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${m.profile_picture ? `<img src="${m.profile_picture}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">` : `<div style="width:30px; height:30px; background:#E2E8F0; border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>`}
                    <span style="font-weight:bold; color:var(--text-main);">${m.name}</span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-primary btn-sm" onclick="window.processMemberRequest(${groupId}, ${m.id}, 'Approved')" style="padding:4px 10px; background:#10B981; border:none;">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="window.processMemberRequest(${groupId}, ${m.id}, 'Denied')" style="padding:4px 10px; background:#EF4444; border:none;">Deny</button>
                </div>
            </div>
        `).join('');
    } catch(e) { console.error(e); }
};

// ADMIN: Process Request
window.processMemberRequest = async function(groupId, youthId, status) {
    await fetch('/api/small-groups/'+groupId+'/members/'+youthId+'/status', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: status})
    });
    window.loadAdminPendingMembers(groupId);
    if (V2Discipleship && V2Discipleship.loadSmallGroups) V2Discipleship.loadSmallGroups();
};

// ADMIN: Update Privacy
window.updateGroupPrivacy = async function() {
    const groupId = window.currentDashboardGroupId;
    const newPrivacy = document.getElementById('dashAdminPrivacy').value;
    if (!groupId) return;
    
    await fetch('/api/small-groups/' + groupId + '/privacy', {
        method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({privacy_level: newPrivacy})
    });
    alert('Campfire privacy updated to ' + newPrivacy);
    if (V2Discipleship && V2Discipleship.loadSmallGroups) V2Discipleship.loadSmallGroups();
};

// ADMIN: Search and Invite Logic
window.filterAdminInvite = function() {
    const q = document.getElementById('adminInviteSearch').value.toLowerCase().trim();
    const dropdown = document.getElementById('adminInviteDropdown');
    if(q.length < 2) { dropdown.style.display = 'none'; return; }
    
    if (typeof youthData !== 'undefined') {
        const matches = youthData.filter(y => (y.name||'').toLowerCase().includes(q));
        if(matches.length > 0) {
            dropdown.innerHTML = matches.map(y => `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;" onclick="window.selectAdminInvite(${y.id}, '${y.name.replace(/'/g, "\\'")}')">${y.name}</div>`).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '<div style="padding:10px; color:#888;">No matches found</div>';
            dropdown.style.display = 'block';
        }
    }
};

window.selectAdminInvite = function(id, name) {
    document.getElementById('adminInviteYouthId').value = id;
    document.getElementById('adminInviteSearch').value = name;
    document.getElementById('adminInviteDropdown').style.display = 'none';
};

window.submitAdminInvite = async function() {
    const youthId = document.getElementById('adminInviteYouthId').value;
    const groupId = window.currentDashboardGroupId;
    if(!youthId || !groupId) return alert("Please search and select a member first!");
    
    const res = await fetch('/api/small-groups/'+groupId+'/invite', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({youth_id: youthId})
    });
    const data = await res.json();
    if(data.success) {
        alert('Member successfully added to the Campfire!');
        document.getElementById('adminInviteSearch').value = '';
        document.getElementById('adminInviteYouthId').value = '';
        if (V2Discipleship && V2Discipleship.loadSmallGroups) V2Discipleship.loadSmallGroups();
    } else {
        alert(data.error || 'Failed to invite member.');
    }
};
