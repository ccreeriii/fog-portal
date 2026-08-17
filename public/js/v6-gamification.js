window.V6Gamification = {
    init: function() {
        // Hook into app.js tab switching to autoload Gamification data
        const originalSwitchTab = window.switchTab;
        window.switchTab = function(tabId) {
            if (originalSwitchTab) originalSwitchTab(tabId);
            if (tabId === 'discipleshipTab') {
                window.V6Gamification.loadChallenges();
                window.V6Gamification.loadLeaderboard();
            }
            if (tabId === 'profileTab') {
                window.V6Gamification.loadMyPoints();
            }
        };

        // Hook into Admin Tab switching to ensure custom tab hides properly
        const originalAdminSubTab = window.V2Discipleship ? window.V2Discipleship.switchAdminSubTab : null;
        if (originalAdminSubTab) {
            window.V2Discipleship.switchAdminSubTab = function(tab) {
                originalAdminSubTab(tab);
                const gamBtn = document.getElementById('btnSubAdminGamification');
                const gamTab = document.getElementById('subTabAdminGamification');
                if (gamBtn) gamBtn.classList.remove('active');
                if (gamTab) gamTab.style.display = 'none';
            };
        }

        // Load initial points automatically if logged in as a member
        setTimeout(() => {
            if (currentMember && currentMember.id) {
                this.loadMyPoints();
            }
        }, 1500);
    },

    loadMyPoints: async function() {
        if (!currentMember || !currentMember.id) return;
        try {
            const res = await fetch(`/api/gamification/points/${currentMember.id}`);
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
        if (currentMember && currentMember.id) {
            url += `?youth_id=${currentMember.id}`;
        }

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">No active challenges right now.</p>';
                return;
            }

            container.innerHTML = data.map(c => {
                const isCompleted = c.completed;
                const btnHtml = isCompleted 
                    ? `<button class="btn btn-sm" disabled style="background:#E2E8F0; color:#64748B; width:100%; border:none; cursor:not-allowed;">✅ Completed</button>`
                    : `<button class="btn btn-primary btn-sm" style="background:#F59E0B; width:100%; box-shadow: 0 4px 6px rgba(245,158,11,0.2);" onclick="V6Gamification.completeChallenge(${c.id}, ${c.points})">Claim +${c.points} Pts</button>`;
                
                return `
                <div style="padding: 15px; border: 1px solid ${isCompleted ? 'var(--border-color)' : '#FCD34D'}; background: ${isCompleted ? 'var(--bg-light)' : '#FFFBEB'}; border-radius: 8px; margin-bottom: 12px; display:flex; flex-direction:column; gap:10px; transition: 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 10px;">
                        <strong style="color: ${isCompleted ? 'var(--text-main)' : '#D97706'}; font-size:1.05rem;">${c.title}</strong>
                        <span class="badge" style="background:#FEF3C7; color:#D97706; white-space: nowrap;">⭐ ${c.points} Pts</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin:0; line-height:1.4;">${c.description}</p>
                    ${currentMember ? `<div style="margin-top: 5px;">${btnHtml}</div>` : ''}
                </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Failed to load gamification challenges', e);
        }
    },

    completeChallenge: function(challengeId, points) {
        if (!currentMember || !currentMember.id) {
            return alert('You must be logged in as a member to complete challenges.');
        }
        
        window.triggerActionConfirmation(`Complete this challenge and claim ${points} points?`, async () => {
            try {
                const res = await fetch(`/api/gamification/challenges/${challengeId}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youth_id: currentMember.id, actor: currentUser })
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
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:10px;">Leaderboard is empty. Start earning points to rank up!</p>';
                return;
            }

            container.innerHTML = data.map((user, index) => {
                let rankIcon = `#${index + 1}`;
                if (index === 0) rankIcon = '🥇';
                if (index === 1) rankIcon = '🥈';
                if (index === 2) rankIcon = '🥉';

                const avatarHtml = user.profile_picture 
                    ? `<img src="${user.profile_picture}" class="avatar-circle" style="width:36px; height:36px; flex-shrink:0; font-size:0.8rem; border-color: ${index < 3 ? '#F59E0B' : 'var(--border-color)'};">` 
                    : `<div class="avatar-circle" style="width:36px; height:36px; flex-shrink:0; font-size:0.8rem; border-color: ${index < 3 ? '#F59E0B' : 'var(--border-color)'};">${(user.name||'U').charAt(0).toUpperCase()}</div>`;

                const bgStyle = index === 0 ? 'background:#FFFBEB; border-color:#FDE68A;' : 'background:#FFF;';

                return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:8px; ${bgStyle}">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="font-weight:bold; font-size:1.2rem; color:var(--text-muted); width: 30px; text-align:center;">${rankIcon}</div>
                        ${avatarHtml}
                        <strong style="color:var(--text-main); font-size:0.95rem;">${user.name}</strong>
                    </div>
                    <div style="font-weight:bold; color:#D97706; background:#FEF3C7; padding:4px 10px; border-radius:12px; font-size:0.9rem;">
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
            actor: currentUser
        };

        window.triggerActionConfirmation(`Publish new challenge '${payload.title}' for ${payload.points} points to the congregation?`, async () => {
            try {
                const res = await fetch('/api/gamification/challenges', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Challenge published successfully!');
                    document.getElementById('createChallengeForm').reset();
                    // Auto-switch back to Discipleship tab to view the live challenge
                    window.switchTab('discipleshipTab');
                }
            } catch (err) {
                alert('Network Error connecting to the server.');
            }
        });
    },

    switchTab: function(tab) {
        document.getElementById('gamTabChallenges').style.display = tab === 'challenges' ? 'block' : 'none';
        document.getElementById('gamTabLeaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
        document.getElementById('btnGamTabChallenges').classList.toggle('active', tab === 'challenges');
        document.getElementById('btnGamTabLeaderboard').classList.toggle('active', tab === 'leaderboard');
    },

    switchAdminTab: function(tab) {
        // Find all buttons in the admin sub-nav and remove 'active'
        const btnGamification = document.getElementById('btnSubAdminGamification');
        if (!btnGamification) return;
        
        const navContainer = btnGamification.parentElement;
        const allNavBtns = navContainer.querySelectorAll('.sub-nav-btn');
        allNavBtns.forEach(btn => btn.classList.remove('active'));
        
        // Hide all discipleship admin sub-tabs securely
        const allTabs = document.querySelectorAll('.discipleship-admin-sub-tab');
        allTabs.forEach(t => t.style.display = 'none');

        // Show our specific Gamification admin tab
        btnGamification.classList.add('active');
        document.getElementById('subTabAdminGamification').style.display = 'block';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.V6Gamification.init();
});
