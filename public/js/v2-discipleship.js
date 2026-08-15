// ==============================================================================
// FIRE OF GOD (FOG) V2.0 - TRANSFORMATIONAL DISCIPLESHIP ENGINE CLIENT LOGIC
// ==============================================================================

window.V2Discipleship = {
    init: function() {
        console.log('[V2 Engine] Initializing Transformational Discipleship Engine...');
        this.hookIntoV1Lifecycle();
    },

    // SENIOR DEV ARCHITECTURE: Monkey-patching V1 functions to be 100% Additive
    hookIntoV1Lifecycle: function() {
        // 1. Intercept the Navigation Builder
        if (typeof window.buildNav === 'function') {
            const originalBuildNav = window.buildNav;
            window.buildNav = function() {
                originalBuildNav(); // Let V1 build its native nav
                V2Discipleship.injectV2NavButtons(); // Then inject V2 seamlessly
            };
        }

        // 2. Intercept the Profile Populator
        if (typeof window.populateProfileTab === 'function') {
            const originalPopulateProfileTab = window.populateProfileTab;
            window.populateProfileTab = async function(member) {
                await originalPopulateProfileTab(member); // Let V1 load standard profile
                V2Discipleship.loadModule(member.id); // Then load V2 discipleship data
            };
        }
    },

    // HELPER: Safely and independently fetch the active session from LocalStorage
    getSession: function() {
        try {
            const session = JSON.parse(localStorage.getItem('fog_user'));
            return session || { username: null, member: null };
        } catch(e) {
            return { username: null, member: null };
        }
    },

    injectV2NavButtons: function() {
        // Inject into Sidebar (For Admins/Leaders)
        const sidebar = document.getElementById('sidebarNav');
        if (sidebar && !document.getElementById('navBtnDiscipleship')) {
            const logoutBtn = sidebar.querySelector('.text-danger');
            const v2SidebarHtml = `
                <button id="navBtnDiscipleship" class="nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">🔥 Discipleship</button>
            `;
            if (logoutBtn) {
                logoutBtn.insertAdjacentHTML('beforebegin', v2SidebarHtml);
            }
        }

        // Inject into Bottom Nav (For Standard Members)
        const bottomNav = document.getElementById('bottomNav');
        if (bottomNav && !document.getElementById('bottomNavDiscipleship')) {
            const logoutBtn = bottomNav.lastElementChild;
            const v2BottomHtml = `
                <button id="bottomNavDiscipleship" class="bottom-nav-btn" data-target="discipleshipTab" onclick="switchTab('discipleshipTab')">
                    <div class="icon">🔥</div>Discipleship
                </button>
            `;
            if (logoutBtn) {
                logoutBtn.insertAdjacentHTML('beforebegin', v2BottomHtml);
            }
        }
    },

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

            // Render all pathways list
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
        } catch (e) {
            console.error('Failed to load next step with God', e);
        }
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
            } catch (err) {
                alert("Network error. Please try again.");
            }
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
            youth_id: session.member.id,
            title: document.getElementById('journalTitle').value,
            content: document.getElementById('journalContent').value,
            mood: document.getElementById('journalMood').value,
            actor: session.username
        };

        try {
            const res = await fetch('/api/journals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById('journalForm').reset();
                alert('Private journal saved securely with God.');
                this.loadJournals(session.member.id);
            }
        } catch (err) {
            alert("Failed to save journal entry.");
        }
    },

    deleteJournal: async function(id) {
        window.triggerActionConfirmation('Permanently delete this private journal entry?', async () => {
            try {
                const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
                const session = this.getSession();
                if (res.ok && session.member) this.loadJournals(session.member.id);
            } catch (err) {
                alert("Failed to delete journal.");
            }
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
            youth_id: session.member.id,
            title: document.getElementById('prayerTitle').value,
            request: document.getElementById('prayerContent').value,
            is_anonymous: document.getElementById('prayerAnonymous').checked ? 1 : 0,
            actor: session.username
        };
        try {
            const res = await fetch('/api/prayers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById('prayerForm').reset();
                alert('Prayer request shared with the community prayer center.');
                this.loadPrayerRequests();
            }
        } catch (err) {
            alert("Failed to post prayer request.");
        }
    },

    intercede: async function(prayerId) {
        const session = this.getSession();
        if (!session.member) return;
        try {
            const res = await fetch(`/api/prayers/${prayerId}/intercede`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youth_id: session.member.id })
            });
            if (res.ok) alert('Thank you for standing in faith and interceding!');
        } catch (err) {
            alert("Network error occurred.");
        }
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
            const res = await fetch(`/api/small-groups/${groupId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youth_id: session.member.id })
            });
            if (res.ok) {
                alert('Successfully joined small group!');
                this.loadSmallGroups();
            } else {
                alert('You are already a member of this small group.');
            }
        } catch (err) {
            alert('Network error occurred.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    V2Discipleship.init();
});
