// ==============================================================================
// FIRE OF GOD (FOG) V2.0 - TRANSFORMATIONAL DISCIPLESHIP ENGINE CLIENT LOGIC
// ==============================================================================

window.V2Discipleship = {
    init: function() {
        console.log('[V2 Engine] Initializing Transformational Discipleship Engine with Admin Controls...');
        this.hookIntoV1Lifecycle();
    },

    getSession: function() {
        try {
            const session = JSON.parse(localStorage.getItem('fog_user'));
            return session || { username: null, member: null };
        } catch(e) {
            return { username: null, member: null };
        }
    },

    hookIntoV1Lifecycle: function() {
        // Intercept Navigation Builder
        if (typeof window.buildNav === 'function') {
            const originalBuildNav = window.buildNav;
            window.buildNav = function() {
                originalBuildNav(); 
                V2Discipleship.injectV2NavButtons(); 
            };
        }

        // Intercept Profile Populator
        if (typeof window.populateProfileTab === 'function') {
            const originalPopulateProfileTab = window.populateProfileTab;
            window.populateProfileTab = async function(member) {
                await originalPopulateProfileTab(member); 
                V2Discipleship.loadModule(member.id); 
            };
        }

        // Intercept Profile Modal Tabs
        if (typeof window.switchProfileModalTab === 'function') {
            const origSwitch = window.switchProfileModalTab;
            window.switchProfileModalTab = function(tab) {
                origSwitch(tab);
                const pastTab = document.getElementById('profileTabPastoral');
                const pastBtn = document.getElementById('btnProfileTabPastoral');
                if(pastTab) pastTab.style.display = tab === 'pastoral' ? 'block' : 'none';
                if(pastBtn) {
                    if (tab === 'pastoral') { pastBtn.classList.add('active'); pastBtn.style.border = '1px solid #8B5CF6'; }
                    else { pastBtn.classList.remove('active'); pastBtn.style.border = 'none'; }
                }
            };
        }

        // Intercept Modal Opener to inject Pastoral Data
        if (typeof window.openViewProfileModal === 'function') {
            const origOpenViewProfile = window.openViewProfileModal;
            window.openViewProfileModal = async function(youthId) {
                await origOpenViewProfile(youthId);
                const pastBtn = document.getElementById('btnProfileTabPastoral');
                if (window.hasPerm && (window.hasPerm('access_discipleship') || window.hasPerm('edit_entries'))) {
                    if(pastBtn) pastBtn.style.display = 'inline-block';
                    V2Discipleship.loadPastoralOversight(youthId);
                } else {
                    if(pastBtn) pastBtn.style.display = 'none';
                }
            };
        }

        // Intercept Top Level Tab Switcher
        if (typeof window.switchTab === 'function') {
            const origSwitchTab = window.switchTab;
            window.switchTab = function(tabId) {
                origSwitchTab(tabId);
                if (tabId === 'discipleshipAdminTab') {
                    V2Discipleship.loadAdminModule();
                }
            };
        }
    },

    injectV2NavButtons: function() {
        const sidebar = document.getElementById('sidebarNav');
        if (sidebar && !document.getElementById('navBtnDiscipleshipAdmin')) {
            const logoutBtn = sidebar.querySelector('.text-danger');
            
            // Standard Discipleship Tab for Everyone
            let v2SidebarHtml = `<button id="navBtnDiscipleship" class="nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">🔥 Discipleship</button>`;
            
            // Admin-Only Discipleship Tab
            if (window.hasPerm && (window.hasPerm('access_discipleship') || window.hasPerm('edit_entries'))) {
                v2SidebarHtml += `<button id="navBtnDiscipleshipAdmin" class="nav-btn" data-target="discipleshipAdminTab" onclick="switchTab('discipleshipAdminTab')" style="color: #8B5CF6;">👑 Discipleship Admin</button>`;
            }

            if (logoutBtn) logoutBtn.insertAdjacentHTML('beforebegin', v2SidebarHtml);
        }

        const bottomNav = document.getElementById('bottomNav');
        if (bottomNav && !document.getElementById('bottomNavDiscipleship')) {
            const logoutBtn = bottomNav.lastElementChild;
            const v2BottomHtml = `
                <button id="bottomNavDiscipleship" class="bottom-nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">
                    <div class="icon">🔥</div>Discipleship
                </button>
            `;
            if (logoutBtn) logoutBtn.insertAdjacentHTML('beforebegin', v2BottomHtml);
        }
    },

    // ==========================================
    // MEMBER DISCIPLESHIP METHODS
    // ==========================================
    loadModule: async function(memberId) {
        if (!memberId) return;
        await Promise.all([
            this.loadNextStepWithGod(memberId),
            this.loadJournals(memberId),
            this.loadPrayerRequests(memberId),
            this.loadSmallGroups(memberId)
        ]);
    },

    loadNextStepWithGod: async function(youthId) {
        try {
            const res = await fetch(`/api/discipleship/next-step/${youthId}`);
            if (!res.ok) throw new Error("Network response was not ok");
            const data = await res.json();
            const container = document.getElementById('nextStepContainer');
            if (!container) return;

            if (data.nextStep) {
                const step = data.nextStep;
                const isCompleted = step.member_status === 'Completed';
                container.innerHTML = `
                    <div class="fog-spiritual-hero">
                        <h2>🙏 What is my next step with God?</h2>
                        <p style="font-size: 1.1rem; font-weight: 600; margin-top: 5px;">Current Milestone: ${step.title}</p>
                        <p>${step.description}</p>
                        <div class="fog-next-step-box" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <span class="badge ${isCompleted ? 'badge-green' : 'badge-orange'}" style="background: #FFF; color: var(--primary);">Status: ${step.member_status || 'In Progress'}</span>
                            </div>
                            <div>
                                ${!isCompleted ? `<button class="btn btn-sm" style="background: #FFF; color: var(--primary); font-weight: bold;" onclick="V2Discipleship.completeStep(${youthId}, ${step.id})">✅ Mark as Completed</button>` : `<span style="font-weight: bold; color: #FFF;">🎉 Milestone Achieved!</span>`}
                            </div>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `<div class="fog-spiritual-hero"><h2>🎉 All Discipleship Milestones Completed!</h2><p>You have successfully journeyed through all foundational steps. Keep discipling others!</p></div>`;
            }

            const listContainer = document.getElementById('pathwaysListContainer');
            if (listContainer && data.allSteps) {
                listContainer.innerHTML = data.allSteps.map(s => `
                    <div class="pathway-step-card">
                        <div class="pathway-step-info">
                            <h4>${s.title}</h4>
                            <p>${s.description}</p>
                        </div>
                        <div>
                            <span class="badge ${s.member_status === 'Completed' ? 'badge-green' : 'badge-orange'}">${s.member_status || 'Pending'}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) { console.error('Failed to load next step', e); }
    },

    completeStep: async function(youthId, pathwayId) {
        window.triggerActionConfirmation('Mark this discipleship milestone as completed?', async () => {
            try {
                const session = this.getSession();
                const res = await fetch('/api/discipleship/milestones', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youth_id: youthId, pathway_id: pathwayId, status: 'Completed', actor: session.username || 'System' })
                });
                if (res.ok) {
                    alert('Milestone updated successfully! Glory to God!');
                    V2Discipleship.loadNextStepWithGod(youthId);
                }
            } catch (err) { alert("Network error. Please try again."); }
        });
    },

    loadJournals: async function(youthId) {
        try {
            const res = await fetch(`/api/journals/${youthId}`);
            const journals = await res.json();
            const container = document.getElementById('journalsContainer');
            if (!container) return;

            if (journals.length === 0) {
                container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 15px;">No private journal entries yet. Write your reflections with God below.</p>`;
                return;
            }

            container.innerHTML = journals.map(j => `
                <div class="journal-card">
                    <div class="journal-card-header">
                        <strong style="font-size: 1.05rem; color: var(--text-main);">${j.title}</strong>
                        <span class="journal-mood-badge badge-orange">${j.mood || 'Blessed'}</span>
                    </div>
                    <p style="color: var(--text-main); white-space: pre-wrap; margin: 10px 0;">${j.content}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 8px; font-size: 0.75rem; color: var(--text-muted);">
                        <span>📅 ${j.created_at}</span>
                        <button type="button" class="btn btn-danger btn-sm" style="padding: 2px 6px; font-size: 0.7rem;" onclick="V2Discipleship.deleteJournal(${j.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    },

    saveJournal: async function(e) {
        e.preventDefault();
        const session = this.getSession();
        if (!session.member) return alert('Member profile required to save journals.');
        
        const payload = {
            youth_id: session.member.id, title: document.getElementById('journalTitle').value,
            content: document.getElementById('journalContent').value, mood: document.getElementById('journalMood').value,
            actor: session.username
        };

        try {
            const res = await fetch('/api/journals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('journalForm').reset(); alert('Private journal saved securely with God.'); this.loadJournals(session.member.id); }
        } catch (err) { alert("Failed to save journal entry."); }
    },

    deleteJournal: async function(id) {
        window.triggerActionConfirmation('Permanently delete this private journal entry?', async () => {
            try {
                const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
                const session = this.getSession();
                if (res.ok && session.member) this.loadJournals(session.member.id);
            } catch (err) { alert("Failed to delete journal."); }
        });
    },

    loadPrayerRequests: async function() {
        try {
            const res = await fetch('/api/prayers');
            const prayers = await res.json();
            const container = document.getElementById('prayerWallContainer');
            if (!container) return;

            if (prayers.length === 0) {
                container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 15px; grid-column: 1 / -1;">No prayer requests shared yet.</p>`;
                return;
            }

            const session = this.getSession();

            container.innerHTML = prayers.map(p => `
                <div class="prayer-card">
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span class="badge badge-blue">${p.is_anonymous ? 'Anonymous' : (p.author_name || 'Community Member')}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: bold;">${p.status}</span>
                        </div>
                        <h4>${p.title}</h4>
                        <p>${p.request}</p>
                    </div>
                    <div style="border-top: 1px solid var(--border-color); padding-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${p.created_at}</span>
                        ${session.member ? `<button type="button" class="btn btn-primary btn-sm" onclick="V2Discipleship.intercede(${p.id})">🙏 Pray</button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    },

    submitPrayer: async function(e) {
        e.preventDefault();
        const session = this.getSession();
        if (!session.member) return alert('Member login required.');
        const payload = {
            youth_id: session.member.id, title: document.getElementById('prayerTitle').value,
            request: document.getElementById('prayerContent').value,
            is_anonymous: document.getElementById('prayerAnonymous').checked ? 1 : 0, actor: session.username
        };
        try {
            const res = await fetch('/api/prayers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) { document.getElementById('prayerForm').reset(); alert('Prayer request shared with the community prayer center.'); this.loadPrayerRequests(); }
        } catch (err) { alert("Failed to post prayer request."); }
    },

    intercede: async function(prayerId) {
        const session = this.getSession();
        if (!session.member) return;
        try {
            const res = await fetch(`/api/prayers/${prayerId}/intercede`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: session.member.id }) });
            if (res.ok) alert('Thank you for standing in faith and interceding!');
        } catch (err) { alert("Network error occurred."); }
    },

    loadSmallGroups: async function() {
        try {
            const res = await fetch('/api/small-groups');
            const groups = await res.json();
            const container = document.getElementById('smallGroupsContainer');
            if (!container) return;

            if (groups.length === 0) {
                container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 15px;">No small groups active yet.</p>`;
                return;
            }

            const session = this.getSession();

            container.innerHTML = groups.map(g => `
                <div class="card" style="margin-bottom: 15px; box-shadow: none;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h3 style="color: var(--primary); margin-bottom: 4px; border:none; padding:0;">👥 ${g.name}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin:0;">Leader: ${g.leader_name || 'TBA'} | Schedule: ${g.meeting_schedule || 'Weekly'} | Venue: ${g.venue || 'Online / TBD'}</p>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span class="badge badge-blue">${g.member_count || 0} Members</span>
                            ${session.member ? `<button type="button" class="btn btn-primary btn-sm" onclick="V2Discipleship.joinGroup(${g.id})">Join Group</button>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (e) { console.error(e); }
    },

    joinGroup: async function(groupId) {
        const session = this.getSession();
        if (!session.member) return;
        try {
            const res = await fetch(`/api/small-groups/${groupId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ youth_id: session.member.id }) });
            if (res.ok) { alert('Successfully joined small group!'); this.loadSmallGroups(); }
            else alert('You are already a member of this small group.');
        } catch (err) { alert('Network error occurred.'); }
    },

    // ==========================================
    // ADMIN DISCIPLESHIP METHODS
    // ==========================================
    
    switchAdminSubTab: function(tab) {
        document.getElementById('subTabAdminPathways').style.display = tab === 'pathways' ? 'block' : 'none';
        document.getElementById('subTabAdminGroups').style.display = tab === 'groups' ? 'block' : 'none';
        document.getElementById('btnSubAdminPathways').classList.toggle('active', tab === 'pathways');
        document.getElementById('btnSubAdminGroups').classList.toggle('active', tab === 'groups');
    },

    loadAdminModule: async function() {
        await Promise.all([
            this.loadAdminPathways(),
            this.loadAdminSmallGroups()
        ]);
        if (window.youthData && window.youthData.length === 0 && window.loadDirectory) {
            window.loadDirectory();
        }
    },

    loadAdminPathways: async function() {
        try {
            const res = await fetch('/api/discipleship/pathways');
            const pathways = await res.json();
            const container = document.getElementById('adminPathwaysList');
            if(!container) return;

            if(pathways.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No pathways created.</p>`;
                return;
            }

            container.innerHTML = pathways.map(p => `
                <div style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; background: #FFF;">
                    <div>
                        <span class="badge badge-orange" style="margin-bottom: 5px;">Step ${p.step_order}</span>
                        <strong style="font-size: 1.1rem; color: var(--text-main); display: block;">${p.title}</strong>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 5px 0 0 0;">${p.description}</p>
                    </div>
                    <div>
                        <button class="btn btn-danger btn-sm" onclick="V2Discipleship.deletePathway(${p.id})">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load admin pathways', e); }
    },

    createPathway: async function(e) {
        e.preventDefault();
        const payload = {
            title: document.getElementById('pathCreateTitle').value,
            description: document.getElementById('pathCreateDesc').value,
            step_order: document.getElementById('pathCreateOrder').value,
            actor: this.getSession().username
        };
        window.triggerActionConfirmation('Create this new Discipleship Milestone?', async () => {
            const res = await fetch('/api/discipleship/pathways', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) {
                document.getElementById('createPathwayForm').reset();
                V2Discipleship.loadAdminPathways();
            }
        });
    },

    deletePathway: async function(id) {
        window.triggerActionConfirmation('Permanently delete this pathway? Associated member progress will be removed.', async () => {
            const res = await fetch(`/api/discipleship/pathways/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({actor: this.getSession().username}) });
            if(res.ok) V2Discipleship.loadAdminPathways();
        });
    },

    filterLeaderSearch: function() {
        const q = document.getElementById('sgLeaderSearch').value.toLowerCase().trim();
        const dropdown = document.getElementById('sgLeaderDropdown');
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        
        const matches = (window.youthData || []).filter(y => (y.name || '').toLowerCase().includes(q));
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(y => `
                <div style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="V2Discipleship.selectLeader(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')">
                    <strong style="color:var(--text-main);">${y.name || 'Unknown'}</strong>
                </div>
            `).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = `<div style="padding:10px; color:var(--text-muted);">No matches</div>`;
            dropdown.style.display = 'block';
        }
    },

    selectLeader: function(id, name) {
        document.getElementById('sgCreateLeaderId').value = id;
        document.getElementById('sgLeaderSearch').value = name;
        document.getElementById('sgLeaderDropdown').style.display = 'none';
    },

    loadAdminSmallGroups: async function() {
        try {
            const res = await fetch('/api/small-groups');
            const groups = await res.json();
            const container = document.getElementById('adminSmallGroupsList');
            if(!container) return;

            if(groups.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No small groups created.</p>`;
                return;
            }

            container.innerHTML = groups.map(g => `
                <div style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; background: #FFF; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="font-size: 1.1rem; color: var(--primary); display: block;">${g.name}</strong>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 5px 0 0 0;">Leader: ${g.leader_name || 'None'} | ${g.meeting_schedule} | ${g.venue}</p>
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <span class="badge badge-blue" style="display:flex; align-items:center;">👥 ${g.member_count} Members</span>
                        <button class="btn btn-danger btn-sm" onclick="V2Discipleship.deleteSmallGroup(${g.id})">🗑️ Delete</button>
                    </div>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load admin small groups', e); }
    },

    createSmallGroup: async function(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('sgCreateName').value,
            leader_id: document.getElementById('sgCreateLeaderId').value || null,
            meeting_schedule: document.getElementById('sgCreateSchedule').value,
            venue: document.getElementById('sgCreateVenue').value,
            actor: this.getSession().username
        };
        window.triggerActionConfirmation('Create this new Small Group?', async () => {
            const res = await fetch('/api/small-groups', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) {
                document.getElementById('createSmallGroupForm').reset();
                document.getElementById('sgCreateLeaderId').value = '';
                V2Discipleship.loadAdminSmallGroups();
            }
        });
    },

    deleteSmallGroup: async function(id) {
        window.triggerActionConfirmation('Permanently delete this small group?', async () => {
            const res = await fetch(`/api/small-groups/${id}`, { method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({actor: this.getSession().username}) });
            if(res.ok) V2Discipleship.loadAdminSmallGroups();
        });
    },

    // ==========================================
    // PASTORAL CARE OVERSIGHT
    // ==========================================
    loadPastoralOversight: async function(youthId) {
        try {
            const res = await fetch(`/api/discipleship/member-progress/${youthId}`);
            const pathways = await res.json();
            const container = document.getElementById('modalPastoralHistory');
            if (!container) return;

            if (pathways.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No pathways active for this member.</p>`;
                return;
            }

            container.innerHTML = pathways.map(p => `
                <div style="background: #FFF; border: 1px solid var(--border-color); border-left: 4px solid #8B5CF6; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <strong style="color:var(--text-main); font-size:1.05rem;">${p.title}</strong>
                        <span class="badge ${p.status === 'Completed' ? 'badge-green' : 'badge-orange'}">${p.status || 'Pending'}</span>
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label style="font-size:0.8rem; color:var(--text-muted);">Pastoral / Growth Notes (Hidden from Member)</label>
                        <textarea id="pastoralNotes_${p.pathway_id}" class="form-control" rows="2" placeholder="Leave leadership notes on their spiritual progress...">${p.pastoral_notes || ''}</textarea>
                    </div>
                    <div style="text-align: right;">
                        <button class="btn btn-sm" style="background:#8B5CF6; color:#FFF;" onclick="V2Discipleship.savePastoralNotes(${youthId}, ${p.pathway_id}, '${p.status || 'In Progress'}')">💾 Save Notes</button>
                    </div>
                </div>
            `).join('');

        } catch (e) { console.error('Failed to load pastoral oversight', e); }
    },

    savePastoralNotes: async function(youthId, pathwayId, currentStatus) {
        const notes = document.getElementById(`pastoralNotes_${pathwayId}`).value;
        const payload = {
            youth_id: youthId,
            pathway_id: pathwayId,
            status: currentStatus,
            notes: notes,
            actor: this.getSession().username
        };
        window.triggerActionConfirmation('Save private pastoral notes?', async () => {
            const res = await fetch('/api/discipleship/milestones', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if(res.ok) alert('Pastoral notes saved securely.');
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    V2Discipleship.init();
});
