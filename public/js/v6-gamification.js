// ========== public/js/v6-gamification.js ==========

window.V6Gamification = {
    adminChallenges: [],

    escapeHtml: function(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    },

    init: function() {
        console.log("🎮 V6 Gamification Module Initialized & Native Patches Applied");

        window.switchMyProfileTab = function(tab) {
            const tabs = ['roles', 'schedule', 'attendance'];
            tabs.forEach(t => {
                let contentId = ''; let btnId = '';
                if (t === 'roles') { contentId = 'myProfileTabRoles'; btnId = 'btnMyProfileTabRoles'; }
                if (t === 'schedule') { contentId = 'myProfileTabSchedule'; btnId = 'btnMyProfileTabSchedule'; }
                if (t === 'attendance') { contentId = 'myProfileTabAttendance'; btnId = 'btnMyProfileTabAttendance'; }
                const content = document.getElementById(contentId);
                const btn = document.getElementById(btnId);
                if (content) content.style.display = tab === t ? 'block' : 'none';
                if (btn) btn.classList.toggle('active', tab === t);
            });
        };

        const hijackAdminTabs = () => {
            const tabs = ['analytics', 'pathways', 'groups', 'gamification'];
            tabs.forEach(t => {
                let btnId = '';
                if (t === 'analytics') btnId = 'btnSubAdminAnalytics';
                if (t === 'pathways') btnId = 'btnSubAdminPathways';
                if (t === 'groups') btnId = 'btnSubAdminGroups';
                if (t === 'gamification') btnId = 'btnSubAdminGamification';

                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.removeAttribute('onclick');
                    btn.addEventListener('click', e => {
                        e.preventDefault();
                        try {
                            if (typeof V2Discipleship !== 'undefined') {
                                V2Discipleship.switchAdminSubTab(t);
                            }
                        } catch (err) {}
                        window.V6Gamification.forceAdminTabUI(t);
                    });
                }
            });
        };

        hijackAdminTabs();

        const originalSwitchTab = window.switchTab;
        if (typeof originalSwitchTab === 'function' && !window.switchTab.isGamificationPatched) {
            window.switchTab = function(...args) {
                try { originalSwitchTab.apply(this, args); } catch (e) {}
                try {
                    const tabId = args[0];
                    if (tabId === 'discipleshipTab') {
                        window.V6Gamification.loadChallenges();
                        window.V6Gamification.loadLeaderboard();
                    }
                    if (tabId === 'profileTab') window.V6Gamification.loadMyPoints();
                } catch (e) {}
            };
            window.switchTab.isGamificationPatched = true;
        }

        setTimeout(() => {
            if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
                this.loadMyPoints();
            }
        }, 1500);
    },

    loadMyPoints: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return;

        try {
            const res = await fetch(`/api/gamification/points/${currentMember.id}`);
            if (!res.ok) return;

            const data = await res.json();
            const pointsEl = document.getElementById('myPointsValue');
            const arcadeEl = document.getElementById('myArcadeXp');
            const growthEl = document.getElementById('myGrowthXp');
            const eventEl = document.getElementById('myEventXp');
            const badgeContainer = document.getElementById('myGamificationBadges');

            if (pointsEl && badgeContainer) {
                pointsEl.innerText = data.points || 0;
                if (arcadeEl) arcadeEl.innerText = data.arcade_xp || 0;
                if (growthEl) growthEl.innerText = data.growth_xp || 0;
                if (eventEl) eventEl.innerText = data.event_xp || 0;
                badgeContainer.style.display = 'flex';
            }
        } catch (e) {
            console.error('Failed to load points', e);
        }
    },

    loadChallenges: async function() {
        const container = document.getElementById('gamActiveChallengesList');
        if (!container) return;

        const url = '/api/gamification/challenges';

        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (!data.length) {
                container.innerHTML =
                    '<div style="text-align:center;padding:20px;color:#666;">No active weekly challenges right now. 🌱</div>';
                return;
            }

            container.innerHTML = data.map(c => {
                const isCompleted = Boolean(c.completed);
                const btnHtml = isCompleted
                    ? '<button class="btn" style="background:#eee;color:#667085;cursor:not-allowed;" disabled>✅ Completed</button>'
                    : `<button class="btn btn-primary" onclick="window.V6Gamification.completeChallenge(${Number(c.id)}, ${Number(c.points) || 0})">Mark as Completed</button>`;

                return `
                    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,.02);">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
                            <h4 style="margin:0;font-size:1.1rem;color:#111;">${this.escapeHtml(c.title)}</h4>
                            <span style="background:#D1FAE5;color:#047857;padding:4px 8px;border-radius:6px;font-weight:bold;font-size:.84rem;white-space:nowrap;">🌱 ${Number(c.points) || 0} Life Points</span>
                        </div>
                        <p style="color:#4B5563;font-size:.9rem;margin-bottom:12px;line-height:1.5;">${this.escapeHtml(c.description)}</p>
                        <div style="text-align:right;">${(typeof currentMember !== 'undefined' && currentMember) ? btnHtml : ''}</div>
                    </div>`;
            }).join('');
        } catch (e) {
            console.error('Failed to load challenges', e);
            container.innerHTML =
                '<p style="text-align:center;color:var(--danger);">Unable to load weekly challenges.</p>';
        }
    },

    completeChallenge: function(challengeId, points) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) {
            return alert('You must be logged in as a member to complete challenges.');
        }

        const message =
            `Have you completed this weekly challenge?\n\n` +
            `If yes, we’ll mark it as completed and add ${points} Life Points to your journey. ` +
            `Thank you for taking another step in growing your faith.`;

        window.triggerActionConfirmation(message, async () => {
            try {
                const res = await fetch(`/api/gamification/challenges/${challengeId}/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: '{}'
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    alert(`🌱 Challenge completed! Keep growing in faith.\n\n+${data.pointsAwarded} Life Points added.`);
                    this.loadChallenges();
                    this.loadMyPoints();
                    this.loadLeaderboard();
                } else {
                    alert(data.error || 'Unable to mark this challenge as completed.');
                }
            } catch (e) {
                alert('Network error. Please try again.');
            }
        });
    },

    loadLeaderboard: async function() {
        const container = document.getElementById('gamLeaderboardList');
        if (!container) return;

        container.innerHTML =
            '<p style="text-align:center;color:var(--text-muted);">Loading our Journey Board…</p>';

        try {
            const res = await fetch('/api/leaderboards/growth/all_time');
            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();

            if (!data.length) {
                container.innerHTML =
                    '<div style="text-align:center;padding:20px;color:#666;">No shared growth activity yet. Every step counts. 🌱</div>';
                return;
            }

            container.innerHTML = data.map((user, index) => {
                const avatarHtml = user.profile_picture
                    ? `<img src="${this.escapeHtml(user.profile_picture)}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
                    : `<div style="width:40px;height:40px;border-radius:50%;background:#F3F4F6;color:#4B5563;display:flex;align-items:center;justify-content:center;font-weight:bold;">${this.escapeHtml((user.name || 'U').charAt(0).toUpperCase())}</div>`;

                return `
                    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
                            <div style="width:30px;text-align:center;color:#64748B;font-weight:800;">${index + 1}</div>
                            ${avatarHtml}
                            <strong style="color:#0F172A;font-size:1.02rem;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(user.name)}</strong>
                        </div>
                        <div style="font-weight:800;color:#047857;font-size:1rem;white-space:nowrap;">🌱 ${Number(user.growth_xp) || 0} Life Points</div>
                    </div>`;
            }).join('');
        } catch (e) {
            container.innerHTML =
                '<p style="color:var(--danger);text-align:center;">Unable to load the Journey Board.</p>';
        }
    },

    switchAdminGamificationTab: function(tab) {
        const listTab = document.getElementById('gamAdminChallengesListTab');
        const createTab = document.getElementById('gamAdminCreateTab');
        const listBtn = document.getElementById('btnGamAdminList');
        const createBtn = document.getElementById('btnGamAdminCreate');

        if (listTab) listTab.style.display = tab === 'list' ? 'block' : 'none';
        if (createTab) createTab.style.display = tab === 'create' ? 'block' : 'none';
        if (listBtn) listBtn.classList.toggle('active', tab === 'list');
        if (createBtn) createBtn.classList.toggle('active', tab === 'create');

        if (tab === 'list') this.loadAdminChallenges();
    },

    loadAdminChallenges: async function() {
        const container = document.getElementById('gamAdminChallengesList');
        if (!container) return;

        container.innerHTML =
            '<p style="text-align:center;color:var(--text-muted);">Loading weekly challenges…</p>';

        try {
            const res = await fetch('/api/admin/gamification/challenges', {
                headers: { Accept: 'application/json' }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            this.adminChallenges = Array.isArray(data) ? data : [];

            if (!this.adminChallenges.length) {
                container.innerHTML =
                    '<div style="text-align:center;padding:20px;color:var(--text-muted);">No weekly challenges have been created yet.</div>';
                return;
            }

            const canEdit = typeof window.hasPerm !== 'function' || window.hasPerm('edit_entries');
            const canDelete = typeof window.hasPerm !== 'function' || window.hasPerm('delete_entries');

            container.innerHTML = this.adminChallenges.map(c => {
                const active = Number(c.is_active) === 1;
                const status = active
                    ? '<span style="background:#DCFCE7;color:#166534;padding:3px 8px;border-radius:999px;font-size:.78rem;font-weight:700;">Active</span>'
                    : '<span style="background:#F1F5F9;color:#64748B;padding:3px 8px;border-radius:999px;font-size:.78rem;font-weight:700;">Archived</span>';

                const editButton = canEdit
                    ? `<button class="btn btn-outline btn-sm" onclick="V6Gamification.openEditChallengeModal(${Number(c.id)})">✏️ Edit</button>`
                    : '';

                const deleteButton = canDelete && active
                    ? `<button class="btn btn-danger btn-sm" onclick="V6Gamification.deleteChallenge(${Number(c.id)})">🗑️ Delete</button>`
                    : '';

                return `
                    <div style="border:1px solid var(--border-color);border-radius:12px;padding:15px;margin-bottom:10px;background:#fff;">
                        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                            <div style="min-width:0;">
                                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                    <strong style="font-size:1.05rem;color:var(--text-main);">${this.escapeHtml(c.title)}</strong>
                                    ${status}
                                </div>
                                <p style="margin:7px 0;color:var(--text-muted);font-size:.9rem;line-height:1.45;">${this.escapeHtml(c.description)}</p>
                                <span style="font-size:.84rem;font-weight:700;color:#047857;">🌱 ${Number(c.points) || 0} Life Points</span>
                            </div>
                            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                                ${editButton}${deleteButton}
                            </div>
                        </div>
                    </div>`;
            }).join('');
        } catch (e) {
            console.error('Failed to load admin weekly challenges', e);
            container.innerHTML =
                '<p style="color:var(--danger);text-align:center;">Unable to load weekly challenges.</p>';
        }
    },

    createChallenge: function(e) {
        e.preventDefault();

        const payload = {
            title: document.getElementById('gamCreateTitle').value.trim(),
            description: document.getElementById('gamCreateDesc').value.trim(),
            points: parseInt(document.getElementById('gamCreatePoints').value, 10) || 0
        };

        window.triggerActionConfirmation(
            `Publish the weekly challenge “${payload.title}” with ${payload.points} Life Points?`,
            async () => {
                try {
                    const res = await fetch('/api/gamification/challenges', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        alert(data.error || 'Unable to create the challenge.');
                        return;
                    }

                    alert('Weekly challenge published successfully!');
                    document.getElementById('createChallengeForm').reset();
                    this.switchAdminGamificationTab('list');
                    this.loadChallenges();
                } catch (err) {
                    alert('Network error. Please try again.');
                }
            }
        );
    },

    openEditChallengeModal: function(id) {
        const challenge = this.adminChallenges.find(item => Number(item.id) === Number(id));
        if (!challenge) return alert('Weekly challenge could not be found.');

        document.getElementById('gamEditId').value = challenge.id;
        document.getElementById('gamEditTitle').value = challenge.title || '';
        document.getElementById('gamEditDesc').value = challenge.description || '';
        document.getElementById('gamEditPoints').value = Number(challenge.points) || 0;
        document.getElementById('gamEditStatus').value = Number(challenge.is_active) === 1 ? '1' : '0';

        const modal = document.getElementById('editWeeklyChallengeModal');
        if (modal) modal.classList.add('active');
    },

    closeEditChallengeModal: function() {
        const modal = document.getElementById('editWeeklyChallengeModal');
        if (modal) modal.classList.remove('active');
    },

    updateChallenge: function(e) {
        e.preventDefault();

        const id = Number(document.getElementById('gamEditId').value);
        const payload = {
            title: document.getElementById('gamEditTitle').value.trim(),
            description: document.getElementById('gamEditDesc').value.trim(),
            points: parseInt(document.getElementById('gamEditPoints').value, 10) || 0,
            is_active: Number(document.getElementById('gamEditStatus').value)
        };

        window.triggerActionConfirmation(
            `Save changes to “${payload.title}”?`,
            async () => {
                try {
                    const res = await fetch(`/api/admin/gamification/challenges/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        alert(data.error || 'Unable to update the challenge.');
                        return;
                    }

                    alert('Weekly challenge updated.');
                    this.closeEditChallengeModal();
                    this.loadAdminChallenges();
                    this.loadChallenges();
                    this.loadLeaderboard();
                } catch (err) {
                    alert('Network error. Please try again.');
                }
            }
        );
    },

    deleteChallenge: function(id) {
        const challenge = this.adminChallenges.find(item => Number(item.id) === Number(id));
        if (!challenge) return alert('Weekly challenge could not be found.');

        const message =
            `Remove “${challenge.title}” from active weekly challenges?\n\n` +
            `Existing member completion history and previously earned Life Points will be preserved.`;

        window.triggerActionConfirmation(message, async () => {
            try {
                const res = await fetch(`/api/admin/gamification/challenges/${id}`, {
                    method: 'DELETE'
                });

                const data = await res.json();

                if (!res.ok) {
                    alert(data.error || 'Unable to delete the challenge.');
                    return;
                }

                alert('Weekly challenge removed from the active list.');
                this.loadAdminChallenges();
                this.loadChallenges();
            } catch (err) {
                alert('Network error. Please try again.');
            }
        });
    },

    switchTab: function(tab) {
        document.getElementById('gamTabChallenges').style.display =
            tab === 'challenges' ? 'block' : 'none';

        const gamesTab = document.getElementById('gamTabGames');
        if (gamesTab) gamesTab.style.display = tab === 'games' ? 'block' : 'none';

        document.getElementById('gamTabLeaderboard').style.display =
            tab === 'leaderboard' ? 'block' : 'none';

        document.getElementById('btnGamTabChallenges').classList.toggle('active', tab === 'challenges');

        const btnGames = document.getElementById('btnGamTabGames');
        if (btnGames) btnGames.classList.toggle('active', tab === 'games');

        document.getElementById('btnGamTabLeaderboard').classList.toggle('active', tab === 'leaderboard');

        const featuredSlot = document.getElementById('featuredGrowthGameContainer');
        if (featuredSlot) featuredSlot.style.display = tab === 'games' ? 'block' : 'none';

        if (tab === 'leaderboard') this.loadLeaderboard();
    },

    forceAdminTabUI: function(tab) {
        const tabs = ['analytics', 'pathways', 'groups', 'gamification'];

        tabs.forEach(t => {
            let contentId = ''; let btnId = '';

            if (t === 'analytics') {
                contentId = 'subTabAdminAnalytics';
                btnId = 'btnSubAdminAnalytics';
            }
            if (t === 'pathways') {
                contentId = 'subTabAdminPathways';
                btnId = 'btnSubAdminPathways';
            }
            if (t === 'groups') {
                contentId = 'subTabAdminGroups';
                btnId = 'btnSubAdminGroups';
            }
            if (t === 'gamification') {
                contentId = 'subTabAdminGamification';
                btnId = 'btnSubAdminGamification';
            }

            const content = document.getElementById(contentId);
            const btn = document.getElementById(btnId);

            if (content) {
                content.style.display = tab === t ? 'block' : 'none';
                content.classList.toggle('active', tab === t);
            }

            if (btn) btn.classList.toggle('active', tab === t);
        });

        if (tab === 'gamification') {
            this.switchAdminGamificationTab('list');
        }
    },

    switchAdminTab: function(tab) {
        this.forceAdminTabUI(tab);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.V6Gamification.init();
});
