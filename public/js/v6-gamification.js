// ========== public/js/v6-gamification.js ==========

window.V6Gamification = {
    init: function() {
        console.log("🎮 V6 Gamification Module Initialized & Native Patches Applied");

        // 🛡️ NATIVE PATCH 1: Fix Profile Tabs (Confirmed Working)
        window.switchMyProfileTab = function(tab) {
            const tabs = ['roles', 'schedule', 'attendance'];
            tabs.forEach(t => {
                let contentId = '';
                let btnId = '';
                if (t === 'roles') { contentId = 'myProfileTabRoles'; btnId = 'btnMyProfileTabRoles'; }
                if (t === 'schedule') { contentId = 'myProfileTabSchedule'; btnId = 'btnMyProfileTabSchedule'; }
                if (t === 'attendance') { contentId = 'myProfileTabAttendance'; btnId = 'btnMyProfileTabAttendance'; }

                const content = document.getElementById(contentId);
                const btn = document.getElementById(btnId);

                if (content) content.style.display = tab === t ? 'block' : 'none';
                if (btn) {
                    if (tab === t) btn.classList.add('active');
                    else btn.classList.remove('active');
                }
            });
        };

        // 🛡️ NATIVE PATCH 2: DOM-Level Hijack for Discipleship Admin Tabs
        // Overrides the HTML strictly to prevent V2 blind-spot overlapping bugs
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
                    // Strip the old failing inline HTML commands
                    btn.removeAttribute('onclick'); 
                    
                    // Attach the new bulletproof UI engine
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();

                        // 1. Let V2 fetch its data silently if it exists (e.g., for charts)
                        try {
                            if (typeof V2Discipleship !== 'undefined' && typeof V2Discipleship.switchAdminSubTab === 'function') {
                                V2Discipleship.switchAdminSubTab(t);
                            }
                        } catch(err) {}

                        // 2. Force the correct UI rendering guaranteed
                        window.V6Gamification.forceAdminTabUI(t);
                    });
                }
            });
        };
        hijackAdminTabs();

        // 🛡️ TIE MAIN TABS: Auto-load data when switching main portal tabs
        const originalSwitchTab = window.switchTab;
        if (typeof originalSwitchTab === 'function' && !window.switchTab.isGamificationPatched) {
            window.switchTab = function(...args) {
                try { originalSwitchTab.apply(this, args); } catch(e) {}
                try {
                    const tabId = args[0];
                    if (tabId === 'discipleshipTab') {
                        window.V6Gamification.loadChallenges();
                        window.V6Gamification.loadLeaderboard();
                    }
                    if (tabId === 'profileTab') {
                        window.V6Gamification.loadMyPoints();
                    }
                } catch(e) {}
            };
            window.switchTab.isGamificationPatched = true;
        }

        // Load initial points automatically if logged in as a member
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
            const badgeEl = document.getElementById('myProfilePoints');
            if (pointsEl && badgeEl) {
                pointsEl.innerText = data.points || 0;
                badgeEl.style.display = 'inline-block';
            }
        } catch (e) {
            console.error('Failed to load gamification points', e);
        }
    },

    loadChallenges: async function() {
        const container = document.getElementById('gamActiveChallengesList');
        if (!container) return;

        let url = '/api/gamification/challenges';
        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
            url += `?youth_id=${currentMember.id}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No active challenges right now. 🎯</div>';
                return;
            }

            container.innerHTML = data.map(c => {
                const isCompleted = c.completed;
                const btnHtml = isCompleted 
                    ? `<button class="btn" style="background: #eee; color: #888; cursor: not-allowed;" disabled>✅ Completed</button>`
                    : `<button class="btn btn-primary" onclick="window.V6Gamification.completeChallenge(${c.id}, ${c.points})">Claim Points</button>`;
                
                return `
                <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h4 style="margin: 0; font-size: 1.1rem; color: #111;">${c.title}</h4>
                        <span style="background: #FFFBEB; color: #D97706; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">⭐ ${c.points} Pts</span>
                    </div>
                    <p style="color: #4B5563; font-size: 0.9rem; margin-bottom: 12px;">${c.description}</p>
                    <div style="text-align: right;">
                        ${(typeof currentMember !== 'undefined' && currentMember) ? btnHtml : ''}
                    </div>
                </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Failed to load gamification challenges', e);
        }
    },

    completeChallenge: function(challengeId, points) {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) {
            return alert('You must be logged in as a member to complete challenges.');
        }
        
        window.triggerActionConfirmation(`Complete this challenge and claim ${points} points?`, async () => {
            try {
                const res = await fetch(`/api/gamification/challenges/${challengeId}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youth_id: currentMember.id, actor: typeof currentUser !== 'undefined' ? currentUser : 'System' })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    alert(`🎉 Challenge Completed! You earned +${data.pointsAwarded} Points!`);
                    window.V6Gamification.loadChallenges();
                    window.V6Gamification.loadMyPoints();
                    window.V6Gamification.loadLeaderboard();
                } else {
                    alert(data.error || 'Failed to claim challenge.');
                }
            } catch (e) {
                alert('Network Error connecting to the server.');
            }
        });
    },

    loadLeaderboard: async function() {
        const container = document.getElementById('gamLeaderboardList');
        if (!container) return;

        try {
            const res = await fetch('/api/gamification/leaderboard');
            if (!res.ok) return;
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Leaderboard is empty. Start earning points to rank up! 🏆</div>';
                return;
            }

            container.innerHTML = data.map((user, index) => {
                let rankIcon = `<span style="color: #666; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '<span style="font-size: 1.5rem;">🥇</span>';
                if (index === 1) rankIcon = '<span style="font-size: 1.5rem;">🥈</span>';
                if (index === 2) rankIcon = '<span style="font-size: 1.5rem;">🥉</span>';

                const avatarHtml = user.profile_picture 
                    ? `<img src="${user.profile_picture}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` 
                    : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #F3F4F6; color: #4B5563; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(user.name||'U').charAt(0).toUpperCase()}</div>`;

                const bgStyle = index === 0 ? 'background: #FFFBEB; border-color: #FDE68A;' : 'background: #FFFFFF; border-color: #E5E7EB;';

                return `
                <div style="${bgStyle} border-style: solid; border-width: 1px; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 16px;">
                    <div style="width: 30px; text-align: center;">
                        ${rankIcon}
                    </div>
                    ${avatarHtml}
                    <div style="flex-grow: 1; font-weight: bold; color: #111; font-size: 1.05rem;">
                        ${user.name}
                    </div>
                    <div style="font-weight: bold; color: #D97706; font-size: 1.1rem;">
                        ⭐ ${user.points}
                    </div>
                </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Failed to load gamification leaderboard', e);
        }
    },

    createChallenge: function(e) {
        e.preventDefault();
        const payload = {
            title: document.getElementById('gamCreateTitle').value,
            description: document.getElementById('gamCreateDesc').value,
            points: parseInt(document.getElementById('gamCreatePoints').value) || 0,
            actor: typeof currentUser !== 'undefined' ? currentUser : 'System'
        };

        window.triggerActionConfirmation(`Publish new challenge '${payload.title}' for ${payload.points} points?`, async () => {
            try {
                const res = await fetch('/api/gamification/challenges', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Challenge published successfully!');
                    document.getElementById('createChallengeForm').reset();
                    window.V6Gamification.switchAdminTab('challenges');
                    window.V6Gamification.loadChallenges();
                }
            } catch (err) {
                alert('Network Error connecting to the server.');
            }
        });
    },

    switchTab: function(tab) {
        // This handles the sub-tabs INSIDE the main Gamification view (Weekly Challenges vs Leaderboard)
        document.getElementById('gamTabChallenges').style.display = tab === 'challenges' ? 'block' : 'none';
        document.getElementById('gamTabLeaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
        
        document.getElementById('btnGamTabChallenges').classList.toggle('active', tab === 'challenges');
        document.getElementById('btnGamTabLeaderboard').classList.toggle('active', tab === 'leaderboard');
    },

    // Centralized UI Engine for Admin Tabs
    forceAdminTabUI: function(tab) {
        const tabs = ['analytics', 'pathways', 'groups', 'gamification'];
        tabs.forEach(t => {
            let contentId = '';
            let btnId = '';
            if (t === 'analytics') { contentId = 'subTabAdminAnalytics'; btnId = 'btnSubAdminAnalytics'; }
            if (t === 'pathways') { contentId = 'subTabAdminPathways'; btnId = 'btnSubAdminPathways'; }
            if (t === 'groups') { contentId = 'subTabAdminGroups'; btnId = 'btnSubAdminGroups'; }
            if (t === 'gamification') { contentId = 'subTabAdminGamification'; btnId = 'btnSubAdminGamification'; }

            const content = document.getElementById(contentId);
            const btn = document.getElementById(btnId);

            if (content) {
                content.style.display = tab === t ? 'block' : 'none';
                if (tab === t) content.classList.add('active');
                else content.classList.remove('active');
            }
            if (btn) {
                if (tab === t) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });
    },

    switchAdminTab: function(tab) {
        this.forceAdminTabUI(tab);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.V6Gamification.init();
});
