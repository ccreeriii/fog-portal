// ========== public/js/v2-discipleship.js ==========
// FIRE OF GOD MINISTRIES - V2.0 DISCIPLESHIP ENGINE

window.V2Discipleship = {
    _isHooked: false,
    _chartInstance: null,

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

    // ==========================================
    // DATA LOADERS
    // ==========================================
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
        this.renderChart();
    },

    switchAdminSubTab: function(tab) {
        document.querySelectorAll('.discipleship-admin-sub-tab').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });
        document.querySelectorAll('.sub-nav-btn').forEach(el => {
            if(el.id.includes('btnSubAdmin')) el.classList.remove('active');
        });

        const targetMap = {
            'analytics': { tab: 'subTabAdminAnalytics', btn: 'btnSubAdminAnalytics' },
            'pathways': { tab: 'subTabAdminPathways', btn: 'btnSubAdminPathways' },
            'groups': { tab: 'subTabAdminGroups', btn: 'btnSubAdminGroups' }
        };

        if (targetMap[tab]) {
            const t = document.getElementById(targetMap[tab].tab);
            const b = document.getElementById(targetMap[tab].btn);
            if(t) { t.classList.add('active'); t.style.display = 'block'; }
            if(b) b.classList.add('active');
        }

        if (tab === 'analytics') this.renderChart();
    },

    // ==========================================
    // PATHWAYS & MILESTONES
    // ==========================================
    createPathway: async function(e) {
        e.preventDefault();
        const payload = {
            title: document.getElementById('pathCreateTitle').value,
            description: document.getElementById('pathCreateDesc').value,
            step_order: parseInt(document.getElementById('pathCreateOrder').value)
        };

        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation(`Create milestone: ${payload.title}?`, async () => {
                const res = await fetch('/api/discipleship/pathways', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                if (res.ok) {
                    document.getElementById('createPathwayForm').reset();
                    V2Discipleship.loadPathways();
                    V2Discipleship.renderChart();
                }
            });
        }
    },

    deletePathway: async function(id) {
        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation('Permanently delete this milestone?', async () => {
                const res = await fetch(`/api/discipleship/pathways/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    V2Discipleship.loadPathways();
                    V2Discipleship.renderChart();
                }
            });
        }
    },

    loadPathways: async function() {
        try {
            const res = await fetch('/api/discipleship/pathways');
            const data = await res.json();

            // Admin List rendering
            const adminList = document.getElementById('adminPathwaysList');
            if (adminList) {
                if (data.length === 0) {
                    adminList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No pathways created.</p>`;
                } else {
                    adminList.innerHTML = data.map(p => `
                        <div style="background:var(--bg-light); border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="color:var(--primary); font-size:1.1rem;">Step ${p.step_order}: ${p.title}</strong>
                                ${typeof window.hasPerm === 'function' && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V2Discipleship.deletePathway(${p.id})">🗑️ Delete</button>` : ''}
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-main); margin-top: 5px;">${p.description}</p>
                        </div>
                    `).join('');
                }
            }

            // User List rendering
            if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
                const progRes = await fetch(`/api/discipleship/member-progress/${currentMember.id}`);
                const progress = await progRes.json();
                
                const userList = document.getElementById('pathwaysListContainer');
                if (userList) {
                    if (progress.length === 0) {
                        userList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No active pathways available.</p>`;
                        return;
                    }
                    userList.innerHTML = progress.map(p => {
                        const isCompleted = p.status === 'Completed';
                        const badge = isCompleted ? `<span class="badge badge-green">✅ Completed</span>` : `<span class="badge badge-orange">⏳ Pending</span>`;
                        const actionBtn = !isCompleted ? `<button class="btn btn-primary btn-sm" onclick="V2Discipleship.updateMilestone(${p.pathway_id}, 'Completed')">Mark Complete</button>` : '';
                        
                        return `
                        <div style="background:#FFF; border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="color:var(--text-main); font-size:1.05rem;">${p.title}</strong>
                                <div style="margin-top:5px;">${badge}</div>
                            </div>
                            <div>${actionBtn}</div>
                        </div>`;
                    }).join('');
                }
            }
        } catch(e) { console.error('Pathway Load Error:', e); }
    },

    loadNextStep: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
        const container = document.getElementById('nextStepContainer');
        if (!container) return;

        try {
            const res = await fetch(`/api/discipleship/next-step/${currentMember.id}`);
            const data = await res.json();

            if (data.nextStep) {
                container.innerHTML = `
                    <div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px 0; color: white; border: none; font-size:1.2rem;">🌟 Your Next Step</h3>
                        <strong style="font-size:1.1rem; display:block; margin-bottom:5px;">${data.nextStep.title}</strong>
                        <p style="font-size: 0.9rem; margin: 0; opacity: 0.9;">${data.nextStep.description}</p>
                    </div>
                `;
            } else {
                container.innerHTML = ``;
            }
        } catch(e) {}
    },

    updateMilestone: async function(pathwayId, status) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("Member context missing.");
        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation(`Mark this milestone as ${status}?`, async () => {
                const res = await fetch('/api/discipleship/milestones', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ youth_id: currentMember.id, pathway_id: pathwayId, status: status, notes: '' })
                });
                if (res.ok) {
                    V2Discipleship.loadPathways();
                    V2Discipleship.loadNextStep();
                }
            });
        }
    },

    // ==========================================
    // JOURNALS
    // ==========================================
    saveJournal: async function(e) {
        e.preventDefault();
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in as a member.");
        
        const payload = {
            youth_id: currentMember.id,
            title: document.getElementById('journalTitle').value,
            mood: document.getElementById('journalMood').value,
            content: document.getElementById('journalContent').value
        };

        try {
            const res = await fetch('/api/journals', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('journalForm').reset();
                V2Discipleship.loadJournals();
            }
        } catch(e) {}
    },

    deleteJournal: async function(id) {
        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation('Delete this journal entry permanently?', async () => {
                const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
                if (res.ok) V2Discipleship.loadJournals();
            });
        }
    },

    loadJournals: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;
        const container = document.getElementById('journalsContainer');
        if (!container) return;

        try {
            const res = await fetch(`/api/journals/${currentMember.id}`);
            const data = await res.json();
            
            if (data.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">You haven't written any journals yet.</p>`;
                return;
            }

            container.innerHTML = data.map(j => `
                <div style="background:var(--bg-light); padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong style="color:var(--primary); font-size:1.1rem;">${j.title}</strong>
                        <span class="badge badge-orange">${j.mood}</span>
                    </div>
                    <p style="font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; line-height:1.5;">${j.content}</p>
                    <div style="text-align:right; margin-top:10px;">
                        <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="V2Discipleship.deleteJournal(${j.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch(e) {}
    },

    // ==========================================
    // PRAYER CENTER
    // ==========================================
    submitPrayer: async function(e) {
        e.preventDefault();
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in to post prayers.");

        const payload = {
            youth_id: currentMember.id,
            title: document.getElementById('prayerTitle').value,
            request: document.getElementById('prayerContent').value,
            is_anonymous: document.getElementById('prayerAnonymous').checked ? 1 : 0
        };

        try {
            const res = await fetch('/api/prayers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('prayerForm').reset();
                V2Discipleship.loadPrayers();
            }
        } catch(e) {}
    },

    intercedePrayer: async function(id) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in to intercede.");
        try {
            const res = await fetch(`/api/prayers/${id}/intercede`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id }) });
            if (res.ok) V2Discipleship.loadPrayers();
        } catch(e) {}
    },

    loadPrayers: async function() {
        const container = document.getElementById('prayerWallContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/prayers');
            const data = await res.json();
            
            if (data.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No active prayer requests at the moment.</p>`;
                return;
            }

            container.innerHTML = data.map(p => {
                const author = p.is_anonymous ? "Anonymous" : (p.author_name || 'Unknown');
                return `
                <div style="background:#FFF; padding:15px; border-radius:8px; border:1px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 15px;">
                    <div style="margin-bottom:8px;">
                        <strong style="color:var(--primary); font-size:1.1rem;">${p.title}</strong>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Requested by ${author} • ${p.created_at}</div>
                    </div>
                    <p style="font-size:0.95rem; color:var(--text-main); white-space:pre-wrap; margin-bottom:15px;">${p.request}</p>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <button class="btn btn-outline btn-sm" onclick="V2Discipleship.intercedePrayer(${p.id})">🙏 I prayed for this!</button>
                    </div>
                </div>
                `;
            }).join('');
        } catch(e) {}
    },

    // ==========================================
    // SMALL GROUPS
    // ==========================================
    filterLeaderSearch: function() {
        const q = document.getElementById('sgLeaderSearch').value.toLowerCase().trim();
        const dropdown = document.getElementById('sgLeaderDropdown');
        if (q.length < 2) { dropdown.style.display = 'none'; return; }
        
        if (typeof youthData !== 'undefined' && youthData.length > 0) {
            const matches = youthData.filter(y => (y.name || '').toLowerCase().includes(q));
            if (matches.length > 0) {
                dropdown.innerHTML = matches.map(y => `<div style="padding:10px; cursor:pointer; border-bottom:1px solid #E2E8F0;" onclick="V2Discipleship.selectLeader(${y.id}, '${(y.name||'').replace(/'/g, "\\'")}')"><strong style="color:var(--text-main);">${y.name}</strong></div>`).join('');
                dropdown.style.display = 'block';
            } else {
                dropdown.innerHTML = '<div style="padding:10px; color:var(--text-muted);">No matches</div>';
                dropdown.style.display = 'block';
            }
        }
    },

    selectLeader: function(id, name) {
        document.getElementById('sgCreateLeaderId').value = id;
        document.getElementById('sgLeaderSearch').value = name;
        document.getElementById('sgLeaderDropdown').style.display = 'none';
    },

    createSmallGroup: async function(e) {
        e.preventDefault();
        const payload = {
            name: document.getElementById('sgCreateName').value,
            leader_id: document.getElementById('sgCreateLeaderId').value || null,
            meeting_schedule: document.getElementById('sgCreateSchedule').value,
            venue: document.getElementById('sgCreateVenue').value
        };

        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation(`Create Small Group '${payload.name}'?`, async () => {
                const res = await fetch('/api/small-groups', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
                if (res.ok) {
                    document.getElementById('createSmallGroupForm').reset();
                    document.getElementById('sgCreateLeaderId').value = '';
                    V2Discipleship.loadSmallGroups();
                }
            });
        }
    },

    deleteSmallGroup: async function(id) {
        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation('Permanently delete this small group?', async () => {
                const res = await fetch(`/api/small-groups/${id}`, { method: 'DELETE' });
                if (res.ok) V2Discipleship.loadSmallGroups();
            });
        }
    },

    joinSmallGroup: async function(id) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in as a member to join a group.");
        if (typeof window.triggerActionConfirmation === 'function') {
            window.triggerActionConfirmation('Request to join this Small Group?', async () => {
                const res = await fetch(`/api/small-groups/${id}/join`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ youth_id: currentMember.id }) });
                if (res.ok) {
                    alert("You have been added to the group!");
                    V2Discipleship.loadSmallGroups();
                }
            });
        }
    },

    loadSmallGroups: async function() {
        try {
            const res = await fetch('/api/small-groups');
            const data = await res.json();

            // Admin List rendering
            const adminList = document.getElementById('adminSmallGroupsList');
            if (adminList) {
                if (data.length === 0) {
                    adminList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No small groups established.</p>`;
                } else {
                    adminList.innerHTML = data.map(g => `
                        <div style="background:var(--bg-light); border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <strong style="color:var(--primary); font-size:1.1rem;">${g.name}</strong><br>
                                <small style="color:var(--text-muted);">Leader: ${g.leader_name || 'Unassigned'} | Members: ${g.member_count}</small>
                            </div>
                            ${typeof window.hasPerm === 'function' && window.hasPerm('delete_entries') ? `<button class="btn btn-danger btn-sm" onclick="V2Discipleship.deleteSmallGroup(${g.id})">🗑️ Delete</button>` : ''}
                        </div>
                    `).join('');
                }
            }

            // User List rendering
            const userList = document.getElementById('smallGroupsContainer');
            if (userList) {
                if (data.length === 0) {
                    userList.innerHTML = `<p style="color:var(--text-muted); text-align:center;">No small groups available right now.</p>`;
                    return;
                }
                userList.innerHTML = data.map(g => `
                    <div style="background:#FFF; border: 1px solid var(--border-color); padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                        <h3 style="color:var(--primary); margin-bottom:5px;">${g.name}</h3>
                        <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">📅 ${g.meeting_schedule || 'TBA'} <br>📍 ${g.venue || 'TBA'} <br>👤 Leader: ${g.leader_name || 'TBA'}</p>
                        <button class="btn btn-outline btn-sm" style="width:100%; border-color:var(--primary); color:var(--primary);" onclick="V2Discipleship.joinSmallGroup(${g.id})">Join Group</button>
                    </div>
                `).join('');
            }
        } catch(e) { console.error('Small Groups Load Error:', e); }
    },

    // ==========================================
    // ANALYTICS CHART
    // ==========================================
    renderChart: async function() {
        const ctx = document.getElementById('spiritualStagesChart');
        if (!ctx) return;

        try {
            const res = await fetch('/api/discipleship/analytics/stages');
            const data = await res.json();
            
            const labels = data.stages.map(s => s.title);
            labels.push("Unassigned");
            const counts = data.stages.map(s => s.user_count);
            counts.push(data.unassigned);
            
            if (this._chartInstance) this._chartInstance.destroy();
            
            this._chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: counts,
                        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#E2E8F0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 12 } } }
                    }
                }
            });
        } catch (e) { console.error("Chart Error", e); }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    V2Discipleship.init();
});
