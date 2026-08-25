// ========== public/js/v10-expansion.js ==========
// FIRE OF GOD MINISTRIES - V11 GAME ENGINE

window.V10Expansion = {
    bulkDataCache: {},

    init: function() {
        this.hookNavigation();
        this.loadFeaturedGames();
        setTimeout(() => this.applyLandingPages(), 800);
        setTimeout(() => this.loadTopScorers(), 1200);
        setTimeout(() => this.patchV8ExitHooks(), 1500);

        const originalSwitchTab = window.switchTab;
        if (typeof originalSwitchTab === 'function' && !window.switchTab.isV10Patched) {
            window.switchTab = function(...args) {
                originalSwitchTab.apply(this, args);
                const tabId = args[0];
                if (tabId === 'leaderboardsHubTab') {
                    window.V10Expansion.loadSegmentedLeaderboard('overall');
                    window.V10Expansion.loadSegmentedLeaderboard('growth');
                    window.V10Expansion.loadSegmentedLeaderboard('arcade');
                }
                if (tabId === 'arcadeTab' || tabId === 'discipleshipTab') {
                    window.V10Expansion.loadFeaturedGames();
                    if (tabId === 'discipleshipTab') window.V10Expansion.filterGrowthGames('indiv');
                    setTimeout(() => window.V10Expansion.applyLandingPages(), 500);
                    setTimeout(() => window.V10Expansion.loadTopScorers(), 800);
                }
                if (tabId === 'profileTab') {
                    const settingsCard = document.getElementById('adminSettingsCard');
                    if (settingsCard) settingsCard.style.display = (currentUser === 'celsocreeriii@gmail.com' || (typeof window.hasPerm === 'function' && window.hasPerm('edit_entries'))) ? 'block' : 'none';
                }
            };
            window.switchTab.isV10Patched = true;
            if (document.getElementById('profileTab') && document.getElementById('profileTab').classList.contains('active')) window.switchTab('profileTab');
        }
        setTimeout(() => this.loadAdminFeaturedSettings(), 1000);
    },

    patchV8ExitHooks: function() {
        const modules = ['V8Slingshot', 'V8NoahsArk', 'V8RedSea', 'V8PetersLeap', 'V8JonahsDive'];
        modules.forEach(mod => {
            if (window[mod] && typeof window[mod].exitGame === 'function' && !window[mod]._v10Patched) {
                const origExit = window[mod].exitGame.bind(window[mod]);
                window[mod].exitGame = function() {
                    origExit();
                    if (window.V10Expansion) window.V10Expansion.exitGame();
                };
                window[mod]._v10Patched = true;
            }
        });
    },

    hookNavigation: function() {
        if (typeof window.buildNav === 'function') {
            const originalBuildNav = window.buildNav;
            window.buildNav = function() {
                originalBuildNav();
                const sidebar = document.getElementById('sidebarNav');
                if (sidebar && !document.getElementById('navBtnLeaderboards')) {
                    const worshipBtn = document.getElementById('navBtnWorship') || sidebar.querySelector('.text-danger');
                    if (worshipBtn) worshipBtn.insertAdjacentHTML('beforebegin', `<button id="navBtnLeaderboards" class="nav-btn" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')">🏆 Leaderboards</button>`);
                }
            };
            if (typeof currentUser !== 'undefined' && currentUser) window.buildNav();
        }
    },

    filterGrowthGames: function(category) {
        const btnIndiv = document.getElementById('btnGrowthIndiv');
        const btnGroups = document.getElementById('btnGrowthGroups');
        if (btnIndiv && btnGroups) {
            btnIndiv.className = category === 'indiv' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
            btnGroups.className = category === 'groups' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        }
        const grid = document.getElementById('growthGamesGrid');
        if (!grid) return;
        grid.querySelectorAll('.arcade-game-tile').forEach(tile => {
            if (category === 'indiv' && tile.classList.contains('growth-game-indiv')) tile.style.display = 'flex';
            else if (category === 'groups' && tile.classList.contains('growth-game-groups')) tile.style.display = 'flex';
            else tile.style.display = 'none';
        });
    },

    autoStartArcade: function(moduleObjStr) {
        const mod = window[moduleObjStr];
        if(mod && typeof mod.mountGameUI === 'function') {
            mod.mountGameUI();
            setTimeout(() => {
                const area = document.getElementById('arcadeActiveGameArea');
                if(area) {
                    const btns = area.querySelectorAll('button');
                    let clicked = false;
                    btns.forEach(b => {
                        const txt = b.innerText.toLowerCase();
                        if(!clicked && (txt.includes('start') || txt.includes('play') || txt.includes('begin'))) { b.click(); clicked = true; }
                    });
                    if(!clicked && typeof mod.startGame === 'function') mod.startGame();
                }
            }, 50);
        }
    },

    getPlayFunction: function(gameName) {
        if(gameName === "David's Slingshot") return 'V10Expansion.autoStartArcade("V8Slingshot")';
        if(gameName === "Noah's Ark: Rescue") return 'V10Expansion.autoStartArcade("V8NoahsArk")';
        if(gameName === "Moses' Red Sea Dash") return 'V10Expansion.autoStartArcade("V8RedSea")';
        if(gameName === "Peter's Leap of Faith") return 'V10Expansion.autoStartArcade("V8PetersLeap")';
        if(gameName === "Jonah's Deep Sea Dive") return 'V10Expansion.autoStartArcade("V8JonahsDive")';
        if(gameName === 'Catechism Clash') return 'V10Expansion.playCC()';
        if(gameName === 'Who Am I?') return 'V10Expansion.playWAI()';
        if(gameName === 'Daily Manna Scramble') return 'V10Expansion.playVS()';
        if(gameName === 'Emoji Sermon Translator') return 'V10Expansion.playEM()';
        if(gameName === 'The Narrow Gate') return 'V10Expansion.playNG()';
        if(gameName === 'Shield of Faith: Reflex Tap') return 'V10Expansion.playRX()';
        return '';
    },
    loadTopScorers: async function() {
        try {
            this.bulkDataCache = {};
            const games = ["David's Slingshot", "Noah's Ark: Rescue", "Moses' Red Sea Dash", "Peter's Leap of Faith", "Jonah's Deep Sea Dive", "Catechism Clash", "Daily Manna Scramble", "Emoji Sermon Translator", "The Narrow Gate", "Shield of Faith: Reflex Tap"];
            await Promise.all(games.map(async (g) => {
                try {
                    const r = await fetch(`/api/gamification/game-top/${encodeURIComponent(g)}`);
                    if(r.ok) this.bulkDataCache[g] = await r.json();
                } catch(e) {}
            }));
            document.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(card => {
                const gameName = card.getAttribute('data-game-name');
                if (!gameName || !this.bulkDataCache[gameName] || this.bulkDataCache[gameName].length === 0) return;
                if (card.classList.contains('arcade-featured-game')) return;
                if (card.querySelector('.top-scorers-container')) card.querySelector('.top-scorers-container').remove();
                const topPlayers = this.bulkDataCache[gameName];
                let html = `<div class="top-scorers-container" style="background: rgba(0,0,0,0.02); border-top: 1px solid var(--border-color); padding: 8px; display: flex; justify-content: center; gap: 8px; margin-top: auto;">`;
                topPlayers.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const avatar = p.profile_picture ? `<img src="${p.profile_picture}" title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; border: 1px solid #CBD5E1; object-fit: cover;">` : `<div title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:bold; border: 1px solid #CBD5E1;">${p.name.charAt(0)}</div>`;
                    html += `<div style="position: relative;">${avatar}<span style="position: absolute; bottom: -5px; right: -5px; font-size: 0.6rem;">${medal}</span></div>`;
                });
                html += `</div>`;
                const actionBtn = card.querySelector('.game-action') || card.querySelector('.game-tile-action');
                if (actionBtn) actionBtn.insertAdjacentHTML('beforebegin', html);
            });
        } catch (e) { console.error("Bulk Top Scorers Error", e); }
    },

    applyLandingPages: function() {
        document.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(card => {
            const gameName = card.getAttribute('data-game-name');
            if (!gameName || gameName === 'Cell Group Clash' || gameName === 'Verse Chain' || gameName === 'Would You Rather' || gameName === 'Word Matrix') return;
            const type = card.closest('#growthGamesGrid') || card.classList.contains('growth-game-indiv') ? 'growth' : 'arcade';
            const icon = card.querySelector('.game-icon') ? card.querySelector('.game-icon').innerText : (card.querySelector('.game-tile-icon') ? card.querySelector('.game-tile-icon').innerText : '🎮');
            const desc = card.querySelector('p') ? card.querySelector('p').innerText.replace(/"/g, "'").replace(/\n/g, " ") : '';
            const playFn = this.getPlayFunction(gameName);
            card.onclick = () => window.V10Expansion.openGameLanding(gameName, type, playFn, desc, icon);
        });
    },

    openGameLanding: async function(gameName, type, playFn, desc, icon) {
        let safeId = 0; let isPreview = false;
        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) { safeId = currentMember.id; }
        else if (typeof currentUser !== 'undefined' && currentUser) { safeId = 999999; isPreview = true; }
        else return alert("Please log in to play!");

        const listId = type === 'growth' ? 'growthGamesGrid' : 'arcadeGridItems';
        const fSlotId = type === 'growth' ? 'featuredGrowthGameContainer' : 'featuredArcadeGameContainer';

        document.getElementById(listId).style.display = 'none';
        if (type === 'growth' && document.getElementById('btnGrowthIndiv')) document.getElementById('btnGrowthIndiv').parentElement.style.display = 'none';
        if (fSlotId && document.getElementById(fSlotId)) document.getElementById(fSlotId).style.display = 'none';

        const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
        area.style.display = 'block';

        try {
            const topPlayers = this.bulkDataCache[gameName] || [];
            const safeKey = `fog_att_${safeId}_${gameName.replace(/\s+/g, '')}`;
            let attemptsData = { remaining: 3, highest_score: 0 };
            try {
                const stored = JSON.parse(localStorage.getItem(safeKey) || '{}');
                const today = new Date().toISOString().split('T')[0];
                if (stored.date === today) attemptsData = stored;
                else { attemptsData = { date: today, remaining: 3, highest_score: 0 }; localStorage.setItem(safeKey, JSON.stringify(attemptsData)); }
            } catch(e) {}

            let topHtml = `<p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px;">No top scorers yet. Be the first!</p>`;
            if (topPlayers.length > 0) {
                topHtml = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
                topPlayers.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const avatar = p.profile_picture ? `<img src="${p.profile_picture}" style="width:30px; height:30px; border-radius:50%; object-fit: cover;">` : `<div style="width:30px; height:30px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-weight:bold;">${p.name.charAt(0)}</div>`;
                    topHtml += `<div style="display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; padding: 8px 15px; border-radius: 8px; border: 1px solid #E2E8F0;"><div style="display: flex; align-items: center; gap: 10px;">${medal} ${avatar} <strong style="color: #0F172A; font-size: 0.95rem;">${p.name}</strong></div><span style="font-weight: 800; color: ${type === 'growth' ? '#059669' : '#F59E0B'};">${p.high_score} XP</span></div>`;
                });
                topHtml += `</div>`;
            }

            const isLocked = attemptsData.remaining <= 0;
            let playBtnHtml = isLocked ? `<button class="btn btn-secondary" style="width:100%; padding:15px; font-size:1.1rem; cursor:not-allowed;" disabled>Daily Limit Reached</button>` : `<button class="btn btn-primary" style="width:100%; padding:15px; font-size:1.1rem; background: ${type === 'growth' ? '#059669' : '#FF6B00'};" onclick='${playFn}'>▶ PLAY NOW (${attemptsData.remaining} Tries Left)</button>`;
            if (isPreview) playBtnHtml = `<button class="btn btn-primary" style="width:100%; padding:15px; font-size:1.1rem; background: ${type === 'growth' ? '#059669' : '#FF6B00'};" onclick='${playFn}'>▶ ADMIN TEST PLAY</button><p style="color: #EF4444; font-size: 0.8rem; margin-top: 10px; font-weight: bold;">Note: Leader. Scores bypass database.</p>`;

            let btnParentReset = type === 'growth' ? `if (document.getElementById('btnGrowthIndiv')) document.getElementById('btnGrowthIndiv').parentElement.style.display = 'flex';` : '';
            const returnScript = type === 'growth' ? `document.getElementById('growthActiveGameArea').style.display='none'; document.getElementById('growthGamesGrid').style.display='grid'; if(document.getElementById('featuredGrowthGameContainer')) document.getElementById('featuredGrowthGameContainer').style.display='block'; ${btnParentReset}` : `document.getElementById('arcadeActiveGameArea').style.display='none'; document.getElementById('arcadeGridItems').style.display='grid'; if(document.getElementById('featuredArcadeGameContainer')) document.getElementById('featuredArcadeGameContainer').style.display='block';`;

            area.innerHTML = `
                <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;"><button class="btn btn-outline btn-sm" onclick="${returnScript}">🔙 Back to Hub</button><div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">${icon} ${gameName}</div></div>
                <div style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
                    <div style="text-align: center; margin-bottom: 25px;"><div style="font-size: 4rem; margin-bottom: 10px;">${icon}</div><h2 style="color: ${type === 'growth' ? '#059669' : '#FF6B00'}; font-size: 1.8rem; border: none; margin-bottom: 10px; padding: 0;">${gameName}</h2><p style="color: #4B5563; font-size: 0.95rem; line-height: 1.5; margin: 0 auto; max-width: 400px;">${desc}</p></div>
                    <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 15px; border-radius: 12px; margin-bottom: 25px;"><h3 style="color: #D97706; font-size: 1rem; margin-bottom: 15px; border-bottom: 1px solid #FDE68A; padding-bottom: 5px;">🏆 Top 3 Players</h3>${topHtml}</div>
                    <div style="text-align: center; margin-bottom: 15px;"><span class="badge badge-orange">Your Daily High Score: ${attemptsData.highest_score}</span></div>
                    ${playBtnHtml}
                </div>`;
        } catch (e) { area.innerHTML = `<p style="color:red; padding: 20px;">Error loading game: ${e.message}</p>`; }
    },

    submitUniversalScore: async function(gameName, type, score) {
        let safeId = 0; let isPreview = false;
        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) { safeId = currentMember.id; }
        else if (typeof currentUser !== 'undefined' && currentUser) { safeId = 999999; isPreview = true; }
        else return;

        try {
            const safeKey = `fog_att_${safeId}_${gameName.replace(/\s+/g, '')}`;
            let stored = JSON.parse(localStorage.getItem(safeKey) || '{}');
            if (!isPreview) stored.remaining = Math.max(0, (stored.remaining || 3) - 1);

            let beatHigh = false;
            if (score > (stored.highest_score || 0)) { stored.highest_score = score; beatHigh = true; }
            localStorage.setItem(safeKey, JSON.stringify(stored));

            let pointsAwarded = score; let success = true;

            if (!isPreview && score > 0) {
                let payload = { youth_id: safeId, game_name: gameName, score: score, type: type, actor: currentUser };
                const res = await fetch('/api/games/universal-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                success = data.success; pointsAwarded = data.pointsAwarded !== undefined ? data.pointsAwarded : score;
            }

            if (success) {
                if (!isPreview && typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (!isPreview && typeof window.V8Arcade !== 'undefined' && type === 'arcade') window.V8Arcade.updateTotalXP();

                const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
                let rewardText = pointsAwarded > 0 ? `<div style="font-size: 2rem; color: #10B981; font-weight: 800; margin: 20px 0;">+${pointsAwarded} ${type.toUpperCase()} XP!</div><p style="color: #64748B;">${beatHigh ? 'You beat your daily high score!' : 'Great job!'}</p>` : `<div style="font-size: 1.2rem; color: #F59E0B; font-weight: 800; margin: 20px 0;">Score: ${score}</div><p style="color: #64748B;">Didn't beat your high score of ${stored.highest_score}.</p>`;
                if (isPreview) rewardText += `<p style="color: #EF4444; font-size: 0.85rem; font-weight: bold; margin-top: 10px;">(Admin Test: Score bypassed database)</p>`;

                let btnParentReset = type === 'growth' ? `if (document.getElementById('btnGrowthIndiv')) document.getElementById('btnGrowthIndiv').parentElement.style.display = 'flex';` : '';
                const returnScript = type === 'growth' ? `document.getElementById('growthActiveGameArea').style.display='none'; document.getElementById('growthGamesGrid').style.display='grid'; if(document.getElementById('featuredGrowthGameContainer')) document.getElementById('featuredGrowthGameContainer').style.display='block'; ${btnParentReset}` : `document.getElementById('arcadeActiveGameArea').style.display='none'; document.getElementById('arcadeGridItems').style.display='grid'; if(document.getElementById('featuredArcadeGameContainer')) document.getElementById('featuredArcadeGameContainer').style.display='block';`;

                area.innerHTML = `
                    <div style="background: #FFF; padding: 40px 20px; border-radius: 12px; text-align: center; border: 1px solid #E2E8F0;">
                        <h2 style="color: #0F172A; border: none;">Run Completed</h2>${rewardText}
                        ${!isPreview ? `<p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 25px;">You have ${stored.remaining} attempts left today.</p>` : ''}
                        <button class="btn btn-outline" style="width: 100%; max-width: 250px;" onclick="${returnScript}">Return to Hub</button>
                    </div>`;
            } else { alert("Failed to save score."); }
        } catch(e) {}
    },

    exitGame: function() {
        if(this._activeTimer) clearInterval(this._activeTimer);
        if(this.rxState && this.rxState.timerId) clearInterval(this.rxState.timerId);

        const growthArea = document.getElementById('growthActiveGameArea');
        if(growthArea) { growthArea.style.display = 'none'; growthArea.innerHTML = ''; }
        const growthGrid = document.getElementById('growthGamesGrid');
        if(growthGrid) growthGrid.style.display = 'grid';
        if(document.getElementById('featuredGrowthGameContainer')) document.getElementById('featuredGrowthGameContainer').style.display = 'block';

        if (document.getElementById('btnGrowthIndiv')) document.getElementById('btnGrowthIndiv').parentElement.style.display = 'flex';

        const arcadeArea = document.getElementById('arcadeActiveGameArea');
        if(arcadeArea) { arcadeArea.style.display = 'none'; arcadeArea.innerHTML = ''; }
        
        const arcadeGrid = document.getElementById('arcadeGridItems');
        if(arcadeGrid) arcadeGrid.style.display = 'grid';

        if(document.getElementById('featuredArcadeGameContainer')) document.getElementById('featuredArcadeGameContainer').style.display = 'block';

        setTimeout(() => {
            const activeIndiv = document.getElementById('btnGrowthIndiv');
            if(activeIndiv && activeIndiv.classList.contains('btn-primary')) this.filterGrowthGames('indiv');
            else if (activeIndiv) this.filterGrowthGames('groups');
        }, 50);
    },
    loadAdminFeaturedSettings: async function() {
        if (!document.getElementById('setFeaturedArcade')) return;
        try {
            const res = await fetch('/api/settings/featured');
            const data = await res.json();
            if(data.featured_arcade) document.getElementById('setFeaturedArcade').value = data.featured_arcade;
            if(data.featured_growth) document.getElementById('setFeaturedGrowth').value = data.featured_growth;
        } catch(e) {}
    },

    saveFeaturedGames: async function(e) {
        e.preventDefault();
        window.triggerActionConfirmation('Save these as the featured games?', async () => {
            try {
                const res = await fetch('/api/settings/featured', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ featured_arcade: document.getElementById('setFeaturedArcade').value, featured_growth: document.getElementById('setFeaturedGrowth').value, actor: currentUser })
                });
                if(res.ok) { alert('Featured games updated!'); window.V10Expansion.loadFeaturedGames(); }
            } catch(e) { alert("Network Error"); }
        });
    },

    loadFeaturedGames: async function() {
        try {
            const res = await fetch('/api/settings/featured');
            const data = await res.json();
            this.renderFeaturedSlot('arcadeGridItems', 'featuredArcadeGameContainer', data.featured_arcade || "David's Slingshot", false);
            this.renderFeaturedSlot('growthGamesGrid', 'featuredGrowthGameContainer', data.featured_growth || "Catechism Clash", true);

            setTimeout(() => {
                const btnIndiv = document.getElementById('btnGrowthIndiv');
                if(btnIndiv && btnIndiv.classList.contains('btn-primary')) this.filterGrowthGames('indiv');
                else if (btnIndiv) this.filterGrowthGames('groups');
            }, 100);
        } catch(e) {}
    },

    renderFeaturedSlot: async function(gridId, containerId, gameName, isGrowth) {
        const container = document.getElementById(containerId); const grid = document.getElementById(gridId);
        if (!container || !grid) return;

        grid.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(t => t.style.display = 'flex');
        if (!gameName || gameName === "None") return container.innerHTML = '';

        const tile = grid.querySelector(`[data-game-name="${gameName}"]`);
        if (tile) {
            tile.style.display = 'none'; // Hide from lower grid
            const icon = tile.querySelector('.game-icon') ? tile.querySelector('.game-icon').innerText : (tile.querySelector('.game-tile-icon') ? tile.querySelector('.game-tile-icon').innerText : '🎮');
            const title = tile.querySelector('h3') ? tile.querySelector('h3').innerText : gameName;
            const desc = tile.querySelector('p') ? tile.querySelector('p').innerText.replace(/"/g, "'").replace(/\n/g, " ") : 'Play our featured game!';

            const type = isGrowth ? 'growth' : 'arcade';
            const playFn = this.getPlayFunction(gameName);

            let topHtml = '';
            try {
                const topP = this.bulkDataCache ? this.bulkDataCache[gameName] : [];
                if(topP && topP.length > 0) {
                    topHtml = `<div style="display:flex; gap:6px; margin-bottom:12px; background:rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; width: fit-content;">`;
                    topP.forEach((p,i) => {
                        const m = i===0?'🥇':i===1?'🥈':'🥉';
                        const a = p.profile_picture ? `<img src="${p.profile_picture}" title="${p.name} - ${p.high_score}XP" style="width:20px; height:20px; border-radius:50%; border:1px solid #FFF; object-fit:cover;">` : `<div title="${p.name} - ${p.high_score}XP" style="width:20px; height:20px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-size:0.5rem; font-weight:bold; border:1px solid #FFF;">${p.name.charAt(0)}</div>`;
                        topHtml += `<div style="position:relative;">${a}<span style="position:absolute; bottom:-4px; right:-4px; font-size:0.6rem;">${m}</span></div>`;
                    });
                    topHtml += `</div>`;
                }
            } catch(e){}

            container.innerHTML = `
                <div class="arcade-featured-game" id="hero-${containerId}" style="max-height: 350px;">
                    <div class="featured-banner" style="padding: 15px 0;">
                        <div class="featured-badge" style="top: 10px; left: 10px; font-size: 0.7rem; padding: 4px 8px;">⭐ FEATURED GAME</div>
                        <div style="font-size: 3rem; margin-top: 5px;">${icon}</div>
                    </div>
                    <div class="featured-info" style="padding: 15px;">
                        <h3 style="font-size: 1.25rem; margin-bottom: 4px;">${title}</h3>
                        <p style="font-size: 0.85rem; margin-bottom: 10px;">${desc}</p>
                        ${topHtml}
                        <div class="featured-action" style="padding: 10px 20px; font-size: 0.85rem;">PLAY NOW</div>
                    </div>
                </div>
            `;
            setTimeout(() => { const heroCard = document.getElementById(`hero-${containerId}`); if (heroCard) heroCard.onclick = () => window.V10Expansion.openGameLanding(gameName, type, playFn, desc, icon); }, 50);
        }
    },

    switchLeaderboardTab: function(tab) {
        document.getElementById('ldrOverallView').style.display = tab === 'overall' ? 'block' : 'none';
        document.getElementById('ldrGrowthView').style.display = tab === 'growth' ? 'block' : 'none';
        document.getElementById('ldrArcadeView').style.display = tab === 'arcade' ? 'block' : 'none';
        document.getElementById('btnLdrOverall').classList.toggle('active', tab === 'overall');
        document.getElementById('btnLdrGrowth').classList.toggle('active', tab === 'growth');
        document.getElementById('btnLdrArcade').classList.toggle('active', tab === 'arcade');
    },

    loadSegmentedLeaderboard: async function(type) {
        const fetchAndRender = async (timeframe, containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            try {
                const res = await fetch(`/api/leaderboards/${type}/${timeframe}`);
                const data = await res.json();
                if (data.length === 0) return container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">No points earned in this period.</p>';
                container.innerHTML = data.map((u, i) => {
                    let rI = `<span style="color: #64748B; font-weight: bold;">#${i+1}</span>`;
                    if(i===0) rI='🥇'; if(i===1) rI='🥈'; if(i===2) rI='🥉';
                    const av = u.profile_picture ? `<img src="${u.profile_picture}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">` : `<div style="width:34px; height:34px; border-radius:50%; background:#E2E8F0; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:bold;">${u.name.charAt(0)}</div>`;
                    let sT = type === 'overall' ? `⭐ ${u.points}` : type === 'growth' ? `🌱 ${u.growth_xp}` : `🎮 ${u.arcade_xp}`;
                    const hc = type === 'overall' ? '#D97706' : type === 'growth' ? '#059669' : '#2563EB';
                    return `<div style="background: ${i===0?'#FEF3C7':'#FFFFFF'}; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;"><div style="width: 25px; text-align: center; font-size: 1.1rem;">${rI}</div>${av}<strong style="color: #0F172A; font-size: 1rem;">${u.name}</strong></div>
                        <div style="font-weight: 900; color: ${hc}; font-size: 1.1rem;">${sT}</div>
                    </div>`;
                }).join('');
            } catch(e) { container.innerHTML = '<p style="color:red;">Error.</p>'; }
        };
        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        await fetchAndRender('all_time', `ldr${typeCap}Container`);
        await fetchAndRender('last_week', `ldr${typeCap}LastWeekContainer`);
        await fetchAndRender('month', `ldr${typeCap}MonthContainer`);
    },

    playCC: async function() {
        const data = await fetch('/api/growth-games/narrow-gate').then(r=>r.json());
        this.ccState = { q: data, i: 0, s: 0, t: 60 };
        this._activeTimer = setInterval(() => {
            this.ccState.t--;
            const tEl = document.getElementById('gTimer'); if(tEl) tEl.innerText = this.ccState.t + 's';
            if(this.ccState.t <= 0) { clearInterval(this._activeTimer); this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s); }
        }, 1000);
        this.renderCC();
    },
    renderCC: function() {
        if(this.ccState.i >= 15 || this.ccState.i >= this.ccState.q.length) { clearInterval(this._activeTimer); return this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s); }
        const q = this.ccState.q[this.ccState.i]; let opts = JSON.parse(q.options);
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.ccState.s}</span><span style="color:red;" id="gTimer">${this.ccState.t}s</span><span>${this.ccState.i+1}/15</span></div>`;
        h += `<h3>${q.question}</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">`;
        opts.forEach((o, idx) => { h += `<button class="btn btn-outline" onclick="V10Expansion.ansCC(${idx}, ${q.correct_index}, this)">${o}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansCC: function(sel, cor, btn) {
        if(sel === cor){
            this.ccState.s += 10; btn.style.background='#10B981'; btn.style.color='#FFF';
            setTimeout(() => { this.ccState.i++; this.renderCC(); }, 800);
        } else {
            btn.style.background='#EF4444'; btn.style.color='#FFF';
            clearInterval(this._activeTimer);
            setTimeout(() => { this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s); }, 1000);
        }
    },

    playWAI: async function() { this.waiState = { i: 0, s: 0, clues: 1, currentQ: null }; this.nextWAI(); },
    nextWAI: async function() {
        if(this.waiState.i >= 10) return this.submitUniversalScore("Who Am I?", "growth", this.waiState.s);
        const r = await fetch('/api/growth-games/whoami'); this.waiState.currentQ = await r.json(); this.waiState.clues = 1; this.renderWAI();
    },
    renderWAI: function() {
        const q = this.waiState.currentQ; let pts = this.waiState.clues === 1 ? 15 : this.waiState.clues === 2 ? 10 : 5;
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.waiState.s}</span><span>${this.waiState.i+1}/10</span></div>`;
        h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 1:</strong> ${q.clue1}</div>`;
        if(this.waiState.clues >= 2) h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 2:</strong> ${q.clue2}</div>`;
        if(this.waiState.clues >= 3) h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 3:</strong> ${q.clue3}</div>`;
        if(this.waiState.clues < 3) h += `<button class="btn btn-secondary btn-sm" style="width:100%; margin-bottom:15px;" onclick="V10Expansion.waiState.clues++; V10Expansion.renderWAI()">Need another clue? (Drops reward to ${pts-5} XP)</button>`;
        h += `<input type="text" id="waiGuess" class="form-control" placeholder="Who am I?"><button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="V10Expansion.ansWAI('${q.answer.replace(/'/g,"\\'")}', ${pts})">Guess</button><p id="waiRes" style="margin-top:10px; font-weight:bold;"></p>`;
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansWAI: function(ans, pts) {
        const guess = document.getElementById('waiGuess').value.trim().toLowerCase();
        const resEl = document.getElementById('waiRes');
        if(!guess) return;
        if(guess === ans.toLowerCase()) {
            this.waiState.s += pts; resEl.style.color='#10B981'; resEl.innerText="Correct!";
            setTimeout(() => { this.waiState.i++; this.nextWAI(); }, 1200);
        } else {
            resEl.style.color='#EF4444'; resEl.innerText=`Wrong! It was ${ans}.`;
            setTimeout(() => { this.submitUniversalScore("Who Am I?", "growth", this.waiState.s); }, 1500);
        }
    },

    playVS: async function() { this.vsState = { i: 0, s: 0, cur: [], words: [], currentQ: null }; this.nextVS(); },
    nextVS: async function() {
        if(this.vsState.i >= 10) return this.submitUniversalScore("Daily Manna Scramble", "growth", this.vsState.s);
        const r = await fetch('/api/growth-games/verse-scramble'); this.vsState.currentQ = await r.json();
        this.vsState.correctOrder = this.vsState.currentQ.verse_text.split(' ');
        this.vsState.words = [...this.vsState.correctOrder].sort(()=>Math.random()-0.5);
        this.vsState.cur = []; this.renderVS();
    },
    renderVS: function() {
        const q = this.vsState.currentQ;
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.vsState.s}</span><span>${this.vsState.i+1}/10</span></div>`;
        h += `<h3>${q.reference}</h3><div style="min-height:60px; padding:10px; border:2px dashed #14B8A6; margin-bottom:15px; display:flex; flex-wrap:wrap; gap:5px;">`;
        this.vsState.cur.forEach((w, idx) => { h += `<button class="btn btn-primary btn-sm" onclick="V10Expansion.vsState.words.push(V10Expansion.vsState.cur.splice(${idx},1)[0]); V10Expansion.renderVS()">${w}</button>`; });
        h += `</div><div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px;">`;
        this.vsState.words.forEach((w, idx) => { h += `<button class="btn btn-outline btn-sm" onclick="V10Expansion.vsState.cur.push(V10Expansion.vsState.words.splice(${idx},1)[0]); V10Expansion.renderVS()">${w}</button>`; });
        h += `</div><button class="btn btn-primary" style="width:100%;" onclick="V10Expansion.ansVS()">Check</button><p id="vsRes" style="margin-top:10px; font-weight:bold;"></p>`;
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansVS: function() {
        const resEl = document.getElementById('vsRes');
        if(this.vsState.words.length > 0) { resEl.style.color='#EF4444'; resEl.innerText="Use all words!"; return; }
        if(this.vsState.cur.join(' ') === this.vsState.correctOrder.join(' ')) {
            this.vsState.s += 15; resEl.style.color='#10B981'; resEl.innerText="Perfect!";
            setTimeout(() => { this.vsState.i++; this.nextVS(); }, 1000);
        } else {
            resEl.style.color='#EF4444'; resEl.innerText="Incorrect order! Game Over.";
            setTimeout(() => { this.submitUniversalScore("Daily Manna Scramble", "growth", this.vsState.s); }, 1500);
        }
    },

    playEM: async function() { this.emState = { i: 0, s: 0, currentQ: null }; this.nextEM(); },
    nextEM: async function() {
        if(this.emState.i >= 15) return this.submitUniversalScore("Emoji Sermon Translator", "growth", this.emState.s);
        const safeId = (typeof currentMember !== 'undefined' && currentMember && currentMember.id) ? currentMember.id : 0;
        const r = await fetch(`/api/growth-games/emoji?youth_id=${safeId}`); const data = await r.json();
        if(data.limit_reached || data.exhausted || !data.question) return this.submitUniversalScore("Emoji Sermon Translator", "growth", this.emState.s);
        this.emState.currentQ = data.question; this.renderEM();
    },
    renderEM: function() {
        const q = this.emState.currentQ; let opts = JSON.parse(q.options);
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.emState.s}</span><span>${this.emState.i+1}/15</span></div>`;
        h += `<div style="font-size:3rem; text-align:center; letter-spacing:5px; margin-bottom:20px;">${q.emojis}</div><div style="display:flex; flex-direction:column; gap:10px;">`;
        opts.forEach(opt => { h += `<button class="btn btn-outline" onclick="V10Expansion.ansEM('${opt.replace(/'/g,"\\'")}', '${q.answer.replace(/'/g,"\\'")}', this)">${opt}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansEM: function(guess, ans, btn) {
        if(guess === ans) {
            this.emState.s += 10; btn.style.background='#10B981'; btn.style.color='#FFF'; btn.style.borderColor='#10B981';
            setTimeout(() => { this.emState.i++; this.nextEM(); }, 800);
        } else {
            btn.style.background='#EF4444'; btn.style.color='#FFF'; btn.style.borderColor='#EF4444';
            setTimeout(() => { this.submitUniversalScore("Emoji Sermon Translator", "growth", this.emState.s); }, 1000);
        }
    },

    playNG: async function() {
        const data = await fetch('/api/growth-games/narrow-gate').then(r=>r.json());
        this.ngState = { q: data, i: 0, s: 0, streak: 0 };
        this.renderNG();
    },
    renderNG: function() {
        if(this.ngState.i >= 25 || this.ngState.i >= this.ngState.q.length) return this.submitUniversalScore("The Narrow Gate", "growth", this.ngState.s);
        const q = this.ngState.q[this.ngState.i]; let opts = JSON.parse(q.options);
        let h = `<div style="color:#10B981; font-weight:900; font-size:1.2rem; margin-bottom:20px;">🔥 STREAK: ${this.ngState.streak}</div>`;
        h += `<h3 style="margin-bottom:20px; color:#FFF;">${q.question}</h3><div style="display:flex; flex-direction:column; gap:10px;">`;
        opts.forEach((o, idx) => { h += `<button class="btn btn-outline" style="border-color:#374151; color:#E5E7EB; background:#111827;" onclick="V10Expansion.ansNG(${idx}, ${q.correct_index}, this)">${o}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#1F2937; color:#FFF; padding:30px; border-radius:12px;">${h}</div>`;
    },
    ansNG: function(sel, cor, btn) {
        if(sel === cor) {
            this.ngState.streak++; this.ngState.s += this.ngState.streak * 5;
            btn.style.background='#10B981'; btn.style.borderColor='#10B981';
            setTimeout(() => { this.ngState.i++; this.renderNG(); }, 600);
        } else {
            btn.style.background='#EF4444'; btn.style.borderColor='#EF4444';
            setTimeout(() => { this.submitUniversalScore("The Narrow Gate", "growth", this.ngState.s); }, 800);
        }
    },

    playRX: function() {
        this.rxState = { armor: ["Belt of Truth", "Breastplate of Righteousness", "Shoes of Peace", "Shield of Faith", "Helmet of Salvation", "Sword of the Spirit"], i: 0, s: 0, seq: [], step: 0 };
        this.startRXRound();
    },
    startRXRound: function() {
        if(this.rxState.i >= 15) return this.submitUniversalScore("Shield of Faith: Reflex Tap", "growth", this.rxState.s);
        this.rxState.seq = []; const avail = [...this.rxState.armor];
        for(let i=0; i<3; i++) this.rxState.seq.push(avail.splice(Math.floor(Math.random()*avail.length), 1)[0]);
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.rxState.s}</span><span>Round ${this.rxState.i+1}/15</span></div>`;
        h += `<h3>Memorize:</h3><div style="color:#F59E0B; font-weight:bold; margin:20px 0; font-size:1.1rem; line-height:1.8;">1. ${this.rxState.seq[0]}<br>2. ${this.rxState.seq[1]}<br>3. ${this.rxState.seq[2]}</div><p>Hiding in 3 seconds...</p>`;
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px; text-align:center;">${h}</div>`;
        setTimeout(() => {
            this.rxState.step = 0; let opts = [...this.rxState.armor].sort(()=>Math.random()-0.5);
            let th = `<h3 style="margin-bottom:20px;">Tap Item #${this.rxState.step+1}!</h3><div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">`;
            opts.forEach(a => { th += `<button class="btn btn-outline" style="padding:15px 5px; font-size:0.85rem;" onclick="V10Expansion.ansRX('${a}', this)">${a}</button>`; });
            document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px; text-align:center;">${th}</div>`;
        }, 3000);
    },
    ansRX: function(ans, btn) {
        if(ans === this.rxState.seq[this.rxState.step]) {
            btn.style.background='#10B981'; btn.style.color='#FFF'; btn.disabled=true; this.rxState.step++;
            if(this.rxState.step >= 3) { this.rxState.s += 15; this.rxState.i++; this.startRXRound(); }
            else document.querySelector('#growthActiveGameArea h3').innerText = `Tap Item #${this.rxState.step+1}!`;
        } else this.submitUniversalScore("Shield of Faith: Reflex Tap", "growth", this.rxState.s);
    }
};

window.refreshAllRanks = function() {
    const activeBtns = document.querySelectorAll('button[onclick*="refreshAllRanks"]');
    activeBtns.forEach(btn => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Refreshing...';
        btn.disabled = true;
        setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 800);
    });

    if (window.V8Arcade && typeof window.V8Arcade.loadLeaderboard === 'function') window.V8Arcade.loadLeaderboard();
    if (window.V6Gamification && typeof window.V6Gamification.loadLeaderboard === 'function') window.V6Gamification.loadLeaderboard();
    if (window.V10Expansion && typeof window.V10Expansion.loadSegmentedLeaderboard === 'function') {
        window.V10Expansion.loadSegmentedLeaderboard('overall');
        window.V10Expansion.loadSegmentedLeaderboard('growth');
        window.V10Expansion.loadSegmentedLeaderboard('arcade');
    }
    if (window.V10Expansion && typeof window.V10Expansion.loadTopScorers === 'function') window.V10Expansion.loadTopScorers();
};

window.V8Arcade = Object.assign(window.V8Arcade || {}, {
    switchTab: function(tab) {
        const list = document.getElementById('arcadeGamesList');
        const ldr = document.getElementById('arcadeLeaderboardView');
        if(list) list.style.display = tab === 'games' ? 'block' : 'none';
        if(ldr) ldr.style.display = tab === 'leaderboard' ? 'block' : 'none';

        const gamesBtn = document.getElementById('btnArcadeGames');
        if (gamesBtn) gamesBtn.classList.toggle('active', tab === 'games');
        const ldrBtn = document.getElementById('btnArcadeLeaderboard');
        if (ldrBtn) ldrBtn.classList.toggle('active', tab === 'leaderboard');

        const area = document.getElementById('arcadeActiveGameArea');
        if(area) area.style.display = 'none';

        if (tab === 'leaderboard') this.loadLeaderboard();
    },
    loadLeaderboard: async function() {
        const container = document.getElementById('arcadeLeaderboardContainer');
        if (!container) return;
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading ranks...</p>';
        try {
            const res = await fetch('/api/leaderboards/arcade/all_time');
            if(!res.ok) throw new Error("API Route missing");
            const data = await res.json();
            if (data.length === 0) return container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Leaderboard is empty. Play games to rank up! 🎮</div>';
            container.innerHTML = data.map((user, index) => {
                let rankIcon = `<span style="color: #64748B; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '🥇'; if (index === 1) rankIcon = '🥈'; if (index === 2) rankIcon = '🥉';
                const avatarHtml = user.profile_picture ? `<img src="${user.profile_picture}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #F3F4F6; color: #4B5563; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(user.name||'U').charAt(0).toUpperCase()}</div>`;
                return `<div style="${index===0?'background: #FFFBEB; border-color: #FDE68A;':'background: #FFFFFF; border-color: #E5E7EB;'} border-style: solid; border-width: 1px; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;"><div style="width: 30px; text-align: center;">${rankIcon}</div>${avatarHtml}<strong style="color: #0F172A; font-size: 1.05rem;">${user.name}</strong></div>
                    <div style="font-weight: 900; color: #2563EB; font-size: 1.15rem;">🎮 ${user.points || user.arcade_xp || 0} XP</div>
                </div>`;
            }).join('');
        } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Network error loading ranks.</p>'; }
    },
    updateTotalXP: async function() {
        if (!currentMember || !currentMember.id) return;
        try {
            const res = await fetch(`/api/gamification/points/${currentMember.id}`);
            const data = await res.json();
            const el = document.getElementById('arcadeCurrentXP');
            if (el) el.innerText = data.arcade_xp || 0;
        } catch(e) {}
    }
});

document.addEventListener('DOMContentLoaded', () => { window.V10Expansion.init(); });

// ==========================================
// V100: MASTER OVERRIDE - CHAT, YOUTUBE, & FACEBOOK REACTIONS
// ==========================================

// --- 1. YOUTUBE KILL SWITCH ---
window.closeGroupSpace = function() {
    const chatModal = document.getElementById('groupSpaceModal');
    if (chatModal) { chatModal.style.display = 'none'; chatModal.classList.remove('active'); }
    
    // Kills the iframe to stop audio/video immediately
    const container = document.getElementById('groupChatMessages');
    if (container) container.innerHTML = ''; 

    const dashModal = document.getElementById('groupDashboardModal');
    if (dashModal && window.currentDashboardGroupId) { 
        dashModal.style.display = 'flex'; 
        dashModal.classList.add('active'); 
    }
};

// --- 2. SECURE STATE MAPPING FOR FACEBOOK REACTIONS ---
window.chatReactionsMap = {};
window.memoryReactionsMap = {};

window.showReactionListMaster = function(id, type) {
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
                    <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 10px;">
                        ${users.map(u => `<span style="font-size: 0.95rem; color: #0F172A; display:flex; align-items:center; gap:6px;">👤 ${u}</span>`).join('')}
                    </div>
                </div>`;
            }
        });
        
        listContainer.innerHTML = html || '<div style="text-align:center; color:#64748B;">No reactions yet.</div>';
        
        modal.style.setProperty('z-index', '108000', 'important');
        modal.style.display = 'flex';
        modal.classList.add('active');
    } catch(e) { console.error("Reaction Viewer Error:", e); }
};

window.toggleReactionPickerMaster = function(pickerId) {
    document.querySelectorAll('[id^="reactPicker_"]').forEach(el => {
        if (el.id !== 'reactPicker_' + pickerId) el.style.display = 'none';
    });
    const picker = document.getElementById('reactPicker_' + pickerId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

window.submitReactionMaster = async function(type, id, emoji) {
    if (!currentMember) return;
    const picker = document.getElementById('reactPicker_' + (type==='chat'?'chat_':'mem_') + id);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) {
            if (type === 'chat') window.loadGroupChatMaster();
            if (type === 'memory') window.loadGroupMemoriesMaster();
        }
    } catch(e) { console.error("Reaction submission error", e); }
};

// --- 3. HIJACK V4 COMMUNICATIONS (THE CHAT FIX) ---
if (typeof window.V4Communications === 'undefined') window.V4Communications = {};
window.V4Communications.openThread = function(groupId) {
    window.currentDashboardGroupId = groupId;
    const chatModal = document.getElementById('groupSpaceModal');
    if (chatModal) {
        chatModal.style.setProperty('z-index', '106000', 'important');
        chatModal.style.display = 'flex';
        chatModal.classList.add('active');
    }
    window.loadGroupChatMaster();
};

window.launchDashCampfire = function(groupId) {
    if(groupId) window.currentDashboardGroupId = groupId;
    if (!window.currentDashboardGroupId) return;
    window.V4Communications.openThread(window.currentDashboardGroupId);
};

window.loadGroupChatMaster = async function() {
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
                window.chatReactionsMap[msg.id] = reacts; 

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionListMaster(${msg.id}, 'chat')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:2px 8px; font-size:0.75rem; position:absolute; bottom:-12px; ${isMe ? 'right:10px;' : 'left:10px;'} box-shadow:0 2px 6px rgba(0,0,0,0.1); color: var(--text-main); z-index: 10; font-weight: bold;">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); margin-left:4px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; opacity:0.6; font-size:1.1rem; margin: 0 8px; user-select: none; transition: 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="toggleReactionPickerMaster('chat_${msg.id}')" title="React">😀</span>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:20px; position:relative;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="display:flex; align-items:center; flex-direction:${isMe ? 'row-reverse' : 'row'}; gap:5px; width: 100%; justify-content:${isMe ? 'flex-start' : 'flex-start'}">
                    <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4; position:relative; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        ${parsedMessage}
                        ${reactionsHtml}
                    </div>
                    <div style="position:relative;">
                        ${reactButton}
                        <div id="reactPicker_chat_${msg.id}" style="display:none; position:absolute; bottom:100%; ${isMe ? 'right:0;' : 'left:0;'} background:#FFF; border:1px solid var(--border-color); border-radius:30px; padding:8px 14px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:12px; white-space:nowrap; margin-bottom: 5px;">
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('chat', ${msg.id}, '👍')">👍</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('chat', ${msg.id}, '❤️')">❤️</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('chat', ${msg.id}, '😂')">😂</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('chat', ${msg.id}, '🙏')">🙏</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('chat', ${msg.id}, '🔥')">🔥</span>
                        </div>
                    </div>
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:8px; ${isMe ? 'margin-right:10px;' : 'margin-left:30px;'}">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; 
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- 4. HIJACK MEMORIES (THE REACTION FIX) ---
window.loadGroupMemoriesMaster = async function() {
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
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(m.reactions || '{}');
                window.memoryReactionsMap[m.id] = reacts;

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionListMaster(${m.id}, 'memory')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:4px 8px; font-size:0.85rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); color: var(--text-main); font-weight: bold;">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); margin-left:4px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<span style="cursor:pointer; font-size:1.3rem; opacity: 0.7; transition: 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" onclick="toggleReactionPickerMaster('mem_${m.id}')" title="React">😀</span>`;

            return `
            <div style="background:#FFF; border-radius:12px; overflow:visible; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column;">
                <img src="${m.image_data}" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
                <div style="padding:10px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <p style="font-size:0.85rem; color:var(--text-main); margin:0 0 10px 0; font-weight:600;">${m.caption}</p>
                    <div style="display:flex; justify-content:space-between; align-items:center; position:relative;">
                        ${reactionsHtml}
                        <div style="position:relative; margin-left:auto;">
                            ${reactButton}
                            <div id="reactPicker_mem_${m.id}" style="display:none; position:absolute; bottom:100%; right:0; background:#FFF; border:1px solid var(--border-color); border-radius:30px; padding:8px 14px; box-shadow:0 4px 15px rgba(0,0,0,0.15); z-index:100; gap:12px; white-space:nowrap; margin-bottom: 5px;">
                                <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('memory', ${m.id}, '👍')">👍</span>
                                <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('memory', ${m.id}, '❤️')">❤️</span>
                                <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('memory', ${m.id}, '😂')">😂</span>
                                <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('memory', ${m.id}, '🙏')">🙏</span>
                                <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('memory', ${m.id}, '🔥')">🔥</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

// --- 5. BIND THE MASTER OVERRIDES GLOBALLY ---
window.loadGroupChat = window.loadGroupChatMaster;
window.loadGroupMemories = window.loadGroupMemoriesMaster;

const _origSendGroupMessage = window.sendGroupMessage;
window.sendGroupMessage = async function(e) {
    e.preventDefault();
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
            window.loadGroupChatMaster();
        }
    } catch(err) { console.error(err); }
};


// ==========================================
// HOTFIX: ULTIMATE FACEBOOK REACTION ENGINE
// ==========================================

window.chatReactionsMap = {};
window.memoryReactionsMap = {};

// --- SECURE REACTION PICKER TOGGLE ---
window.toggleReactionPickerMaster = function(pickerId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    
    // Hide all others
    document.querySelectorAll('[id^="reactPicker_"]').forEach(el => {
        if (el.id !== 'reactPicker_' + pickerId) el.style.display = 'none';
    });
    
    // Toggle targeted picker
    const picker = document.getElementById('reactPicker_' + pickerId);
    if (picker) {
        picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    }
};

// --- SECURE SUBMIT REACTION ---
window.submitReactionMaster = async function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return;
    
    const picker = document.getElementById('reactPicker_' + (type==='chat'?'chat_':'mem_') + id);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) {
            // Hard Reload UI to show new counts
            if (type === 'chat') window.loadGroupChatMaster();
            if (type === 'memory') window.loadGroupMemoriesMaster();
        }
    } catch(e) { console.error("Reaction submission error", e); }
};

// --- FACEBOOK CHAT BUBBLES ---
window.loadGroupChatMaster = async function() {
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

            // Facebook Reaction Counter Map
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(msg.reactions || '{}');
                window.chatReactionsMap[msg.id] = reacts; 

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionListMaster(${msg.id}, 'chat')" style="display:flex; cursor:pointer; align-items:center; gap:4px; background:#FFF; border: 1px solid var(--border-color); border-radius:12px; padding:2px 6px; font-size:0.75rem; position:absolute; bottom:-12px; ${isMe ? 'right:10px;' : 'left:10px;'} box-shadow:0 1px 3px rgba(0,0,0,0.1); color: var(--text-main); z-index: 10; font-weight: bold;">
                        ${reactSummary.slice(0,3).join('')} <span style="color:var(--text-muted); margin-left:2px;">${totalReacts}</span>
                    </div>`;
                }
            } catch(e){}

            // High Z-Index Floating Emoji Button
            const reactButton = `<div onclick="toggleReactionPickerMaster('chat_${msg.id}', event)" style="cursor:pointer; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(0,0,0,0.05); margin:0 5px; font-size:0.85rem; z-index: 20;">😀</div>`;
            
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:24px; position:relative;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="display:flex; align-items:center; flex-direction:${isMe ? 'row-reverse' : 'row'}; gap:2px; width: 100%; justify-content:${isMe ? 'flex-start' : 'flex-start'}; position:relative;">
                    <div style="background:${bg}; color:${color}; padding:10px 14px; border-radius:${borderR}; max-width:85%; font-size:0.95rem; line-height:1.4; position:relative; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        ${parsedMessage}
                        ${reactionsHtml}
                    </div>
                    
                    <div style="position:relative;">
                        ${reactButton}
                        <div id="reactPicker_chat_${msg.id}" style="display:none; position:absolute; bottom:100%; ${isMe ? 'right:0;' : 'left:0;'} background:#FFF; border:1px solid var(--border-color); border-radius:30px; padding:6px 12px; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:999999; gap:12px; white-space:nowrap; margin-bottom: 8px;">
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('chat', ${msg.id}, '👍', event)">👍</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('chat', ${msg.id}, '❤️', event)">❤️</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('chat', ${msg.id}, '😂', event)">😂</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('chat', ${msg.id}, '🙏', event)">🙏</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('chat', ${msg.id}, '🔥', event)">🔥</span>
                        </div>
                    </div>
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:8px; ${isMe ? 'margin-right:10px;' : 'margin-left:30px;'}">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        container.scrollTop = container.scrollHeight; 
    } catch(e) { console.error("Failed to load chat", e); }
};

// --- FACEBOOK MEMORY CARDS ---
window.loadGroupMemoriesMaster = async function() {
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
            let reactionsHtml = '';
            try {
                const reacts = JSON.parse(m.reactions || '{}');
                window.memoryReactionsMap[m.id] = reacts;

                let totalReacts = 0;
                let reactSummary = [];
                Object.keys(reacts).forEach(emoji => {
                    const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
                    if (count > 0) {
                        totalReacts += count;
                        if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
                    }
                });
                
                if (totalReacts > 0) {
                    reactionsHtml = `<div onclick="showReactionListMaster(${m.id}, 'memory')" style="display:flex; cursor:pointer; align-items:center; gap:6px; color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">
                        <span>${reactSummary.slice(0,3).join('')}</span> <span>${totalReacts} ${totalReacts === 1 ? 'Reaction' : 'Reactions'}</span>
                    </div>`;
                }
            } catch(e){}

            const reactButton = `<button type="button" onclick="toggleReactionPickerMaster('mem_${m.id}', event)" style="background:transparent; border:none; color:var(--text-muted); font-weight:600; font-size:0.9rem; cursor:pointer; display:flex; align-items:center; gap:6px; padding: 4px 8px; border-radius: 6px; transition: 0.2s;" onmouseover="this.style.background='#F1F5F9'" onmouseout="this.style.background='transparent'"><span style="font-size:1.1rem;">🤍</span> React</button>`;

            return `
            <div style="background:#FFF; border-radius:12px; overflow:visible; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column; position:relative; margin-bottom: 15px;">
                <img src="${m.image_data}" style="width:100%; height:160px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
                <div style="padding:15px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <p style="font-size:0.95rem; color:var(--text-main); margin:0 0 10px 0; font-weight:500;">${m.caption}</p>
                    
                    ${reactionsHtml ? `<div style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">${reactionsHtml}</div>` : `<div style="margin-bottom: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;"></div>`}
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; position:relative;">
                        ${reactButton}
                        <span style="font-size: 0.75rem; color: var(--text-muted);">By ${m.author_name}</span>
                        
                        <div id="reactPicker_mem_${m.id}" style="display:none; position:absolute; bottom:100%; left:0; background:#FFF; border:1px solid var(--border-color); border-radius:30px; padding:8px 14px; box-shadow:0 4px 20px rgba(0,0,0,0.15); z-index:999999; gap:12px; white-space:nowrap; margin-bottom: 10px;">
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('memory', ${m.id}, '👍', event)">👍</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('memory', ${m.id}, '❤️', event)">❤️</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('memory', ${m.id}, '😂', event)">😂</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('memory', ${m.id}, '🙏', event)">🙏</span>
                            <span style="cursor:pointer; font-size:1.5rem; transition:transform 0.2s;" onclick="submitReactionMaster('memory', ${m.id}, '🔥', event)">🔥</span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

window.loadGroupChat = window.loadGroupChatMaster;
window.loadGroupMemories = window.loadGroupMemoriesMaster;

// ==========================================
// V100: ULTIMATE INLINE REACTION ENGINE
// ==========================================

window.chatReactionsMap = {};
window.memoryReactionsMap = {};

// 1. UNIFIED REACTION UI BUILDER
window.buildReactUI = function(type, id, reactionsStr, isMe) {
    let reacts = {};
    try { reacts = JSON.parse(reactionsStr || '{}'); } catch(e){}
    
    if (type === 'chat') window.chatReactionsMap[id] = reacts;
    if (type === 'memory') window.memoryReactionsMap[id] = reacts;

    let totalReacts = 0;
    let reactSummary = [];
    Object.keys(reacts).forEach(emoji => {
        const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    // Dynamic Colors based on Chat Bubble Ownership
    const txtColor = (type === 'chat' && isMe) ? '#FFF' : 'var(--text-muted)';
    const sumBg = (type === 'chat' && isMe) ? 'rgba(255,255,255,0.2)' : 'rgba(255,107,0,0.1)';
    const sumTxt = (type === 'chat' && isMe) ? '#FFF' : 'var(--primary)';
    const borderColor = (type === 'chat' && isMe) ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';

    const summaryHtml = totalReacts > 0 ? 
        `<div onclick="showReactionListMaster(${id}, '${type}')" style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:0.85rem; color:${sumTxt}; font-weight:bold; background:${sumBg}; padding:4px 10px; border-radius:12px;">
            ${reactSummary.slice(0,3).join('')} ${totalReacts}
        </div>` : '<div></div>';

    const pickerId = `picker_${type}_${id}`;
    
    return `
    <div style="display:flex; flex-direction:column; width:100%; margin-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed ${borderColor}; padding-top: 8px;">
            <button type="button" onclick="toggleReactionPickerMaster('${pickerId}')" style="background:transparent; border:none; color:${txtColor}; font-size:0.9rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; padding:0;">
                <span style="font-size:1.1rem;">🤍</span> React
            </button>
            ${summaryHtml}
        </div>
        
        <div id="${pickerId}" style="display:none; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:16px; padding:8px 12px; margin-top:10px; gap:15px; justify-content:space-around; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
            <span style="cursor:pointer; font-size:1.4rem;" onclick="submitReactionMaster('${type}', ${id}, '👍')">👍</span>
            <span style="cursor:pointer; font-size:1.4rem;" onclick="submitReactionMaster('${type}', ${id}, '❤️')">❤️</span>
            <span style="cursor:pointer; font-size:1.4rem;" onclick="submitReactionMaster('${type}', ${id}, '😂')">😂</span>
            <span style="cursor:pointer; font-size:1.4rem;" onclick="submitReactionMaster('${type}', ${id}, '🙏')">🙏</span>
            <span style="cursor:pointer; font-size:1.4rem;" onclick="submitReactionMaster('${type}', ${id}, '🔥')">🔥</span>
        </div>
    </div>`;
};

// 2. TOGGLE & SUBMIT ACTIONS
window.toggleReactionPickerMaster = function(pickerId) {
    if (window.event) { window.event.preventDefault(); window.event.stopPropagation(); }
    document.querySelectorAll('[id^="picker_"]').forEach(el => {
        if (el.id !== pickerId) el.style.display = 'none';
    });
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

window.submitReactionMaster = async function(type, id, emoji) {
    if (window.event) { window.event.preventDefault(); window.event.stopPropagation(); }
    if (!currentMember) return;
    
    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) {
            if (type === 'chat') window.loadGroupChatMaster();
            if (type === 'memory') window.loadGroupMemoriesMaster();
        }
    } catch(e) { console.error("Reaction submission error", e); }
};

// 3. APPLY TO CHAT
window.loadGroupChatMaster = async function() {
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
            
            let parsedMessage = msg.message.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g, 
                (match, videoId) => `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`
            );

            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:20px; width:100%;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="background:${bg}; color:${color}; padding:14px; border-radius:${borderR}; width:100%; max-width:85%; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size:0.95rem; line-height:1.4; word-wrap: break-word;">${parsedMessage}</div>
                    ${window.buildReactUI('chat', msg.id, msg.reactions, isMe)}
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight; 
    } catch(e) {}
};

// 4. APPLY TO MEMORIES
window.loadGroupMemoriesMaster = async function() {
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
        <div style="background:#FFF; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column; margin-bottom: 15px;">
            <img src="${m.image_data}" style="width:100%; height:160px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
            <div style="padding:15px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                <p style="font-size:0.95rem; color:var(--text-main); margin:0 0 10px 0; font-weight:500;">${m.caption}</p>
                ${window.buildReactUI('memory', m.id, m.reactions, false)}
                <div style="font-size:0.7rem; color:var(--text-muted); text-align:right; margin-top:8px;">By ${m.author_name}</div>
            </div>
        </div>`).join('');
    } catch(e) {}
};

window.loadGroupChat = window.loadGroupChatMaster;
window.loadGroupMemories = window.loadGroupMemoriesMaster;

// ==========================================
// V101: OPTIMISTIC UI FACEBOOK REACTION ENGINE
// ==========================================

// 1. UNIFIED REACTION UI BUILDER (With ID Fixes)
window.buildReactUI = function(type, id, reactionsStr, isMe) {
    let reacts = {};
    try { reacts = JSON.parse(reactionsStr || '{}'); } catch(e){}
    
    if (type === 'chat') window.chatReactionsMap[id] = reacts;
    if (type === 'memory') window.memoryReactionsMap[id] = reacts;

    let totalReacts = 0;
    let reactSummary = [];
    Object.keys(reacts).forEach(emoji => {
        const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    const txtColor = (type === 'chat' && isMe) ? '#FFF' : 'var(--text-muted)';
    const sumBg = (type === 'chat' && isMe) ? 'rgba(255,255,255,0.2)' : 'rgba(255,107,0,0.1)';
    const sumTxt = (type === 'chat' && isMe) ? '#FFF' : 'var(--primary)';
    const borderColor = (type === 'chat' && isMe) ? 'rgba(255,255,255,0.3)' : 'var(--border-color)';

    const summaryId = `react_summary_${type}_${id}`;
    const pickerId = `picker_${type}_${id}`;

    const summaryHtml = totalReacts > 0 ? 
        `<div id="${summaryId}" onclick="showReactionListMaster(${id}, '${type}')" style="cursor:pointer; display:flex; align-items:center; gap:6px; font-size:0.85rem; color:${sumTxt}; font-weight:bold; background:${sumBg}; padding:4px 10px; border-radius:12px; transition: 0.2s;">
            ${reactSummary.slice(0,3).join('')} ${totalReacts}
        </div>` : `<div id="${summaryId}" style="display:none; cursor:pointer; align-items:center; gap:6px; font-size:0.85rem; color:${sumTxt}; font-weight:bold; background:${sumBg}; padding:4px 10px; border-radius:12px; transition: 0.2s;"></div>`;

    return `
    <div style="display:flex; flex-direction:column; width:100%; margin-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed ${borderColor}; padding-top: 8px;">
            <button type="button" onclick="toggleReactionPickerMaster('${pickerId}')" style="background:transparent; border:none; color:${txtColor}; font-size:0.9rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; padding:0;">
                <span style="font-size:1.1rem;">🤍</span> React
            </button>
            ${summaryHtml}
        </div>
        
        <div id="${pickerId}" style="display:none; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:16px; padding:8px 12px; margin-top:10px; gap:15px; justify-content:space-around; box-shadow:inset 0 2px 4px rgba(0,0,0,0.02);">
            <span style="cursor:pointer; font-size:1.4rem; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '👍', event)">👍</span>
            <span style="cursor:pointer; font-size:1.4rem; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '❤️', event)">❤️</span>
            <span style="cursor:pointer; font-size:1.4rem; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '😂', event)">😂</span>
            <span style="cursor:pointer; font-size:1.4rem; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '🙏', event)">🙏</span>
            <span style="cursor:pointer; font-size:1.4rem; transition:transform 0.1s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '🔥', event)">🔥</span>
        </div>
    </div>`;
};

// 2. TOGGLE & SUBMIT ACTIONS (Optimistic UI)
window.toggleReactionPickerMaster = function(pickerId) {
    if (window.event) { window.event.preventDefault(); window.event.stopPropagation(); }
    document.querySelectorAll('[id^="picker_"]').forEach(el => {
        if (el.id !== pickerId) el.style.display = 'none';
    });
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

window.submitReactionMaster = async function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return;
    
    // INSTANT FEEDBACK: Hide the picker immediately
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    // INSTANT FEEDBACK: Optimistic UI update on the summary badge
    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
        summaryEl.innerHTML = `${emoji} <span style="font-size: 0.7rem; opacity: 0.8;">...</span>`;
        summaryEl.style.display = 'flex';
    }

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        
        if (res.ok) {
            // Background sync successful, pull the final fresh data
            if (type === 'chat') window.loadGroupChatMaster(true);
            if (type === 'memory') window.loadGroupMemoriesMaster();
        } else {
            // Revert on failure
            if (summaryEl) summaryEl.innerHTML = `❌ Failed`;
        }
    } catch(e) { 
        console.error("Reaction submission error", e); 
        if (summaryEl) summaryEl.innerHTML = `❌ Error`;
    }
};

// 3. APPLY TO CHAT (With Scroll Preservation)
window.loadGroupChatMaster = async function(preserveScroll = false) {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    
    // Save scroll position for smooth re-rendering
    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

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
            
            let parsedMessage = msg.message.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g, 
                (match, videoId) => `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`
            );

            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:20px; width:100%;">
                ${!isMe ? `<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px; font-size:0.75rem; color:var(--text-muted);">${avatar} ${msg.name}</div>` : ''}
                
                <div style="background:${bg}; color:${color}; padding:14px; border-radius:${borderR}; width:100%; max-width:85%; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size:0.95rem; line-height:1.4; word-wrap: break-word;">${parsedMessage}</div>
                    ${window.buildReactUI('chat', msg.id, msg.reactions, isMe)}
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        // Restore scroll gracefully
        if (!preserveScroll || isScrolledToBottom) {
            container.scrollTop = container.scrollHeight; 
        }
    } catch(e) {}
};


// ==========================================
// V102: TRUE FACEBOOK STATE ENGINE (NO RELOAD)
// ==========================================

// 1. DYNAMIC BADGE UPDATER (The Facebook Secret)
window.refreshReactionBadgeUI = function(type, id, reactionsObj) {
    // Update local memory maps
    if (type === 'chat') window.chatReactionsMap[id] = reactionsObj;
    if (type === 'memory') window.memoryReactionsMap[id] = reactionsObj;

    let totalReacts = 0;
    let reactSummary = [];
    
    Object.keys(reactionsObj).forEach(emoji => {
        const count = Array.isArray(reactionsObj[emoji]) ? reactionsObj[emoji].length : reactionsObj[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    
    if (summaryEl) {
        if (totalReacts > 0) {
            // Update the HTML cleanly
            summaryEl.innerHTML = `${reactSummary.slice(0,3).join('')} <span style="margin-left: 4px;">${totalReacts}</span>`;
            summaryEl.style.display = 'flex';
        } else {
            // Hide if user removed their reaction and count is 0
            summaryEl.innerHTML = '';
            summaryEl.style.display = 'none';
        }
    }
};

// 2. THE MASTER SUBMISSION HANDLER
window.submitReactionMaster = async function(type, id, emoji, event) {
    // Stop any bubbling or weird click behaviors
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return;
    
    // 1. Hide the emoji picker popup instantly
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    // 2. Optimistic UI: Flash the emoji immediately so the user feels it worked
    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl) {
        // If it was empty before, force it visible temporarily
        if (summaryEl.style.display === 'none') {
            summaryEl.style.display = 'flex';
            summaryEl.innerHTML = `${emoji} <span style="font-size: 0.7rem; opacity: 0.8; margin-left:4px;">...</span>`;
        }
    }

    try {
        // 3. Ping the API to save the reaction
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.reactions) {
                // 4. INSTANT INJECTION: Update the DOM directly using the exact API response!
                // No more loadGroupChatMaster() or loadGroupMemoriesMaster() page reloads.
                window.refreshReactionBadgeUI(type, id, data.reactions);
            } else {
                // Failsafe fallback
                if (type === 'chat') window.loadGroupChatMaster(true);
                if (type === 'memory') window.loadGroupMemoriesMaster();
            }
        } else {
            if (summaryEl) summaryEl.style.display = 'none'; // Revert on failure
        }
    } catch(e) { 
        console.error("Reaction submission error", e); 
        if (summaryEl) summaryEl.style.display = 'none';
    }
};


// ==========================================
// V103: EVENT FORM CLEANUP & ROLES SPLIT-TABS
// ==========================================

// --- 1. EVENT FORM BUTTON CLEANUP ---
const origLaunchPublicPreregV103 = window.launchPublicPrereg;
window.launchPublicPrereg = async function(eventId) {
    // Purify rogue DOM elements from malformed HTML immediately
    const preregPublicTab = document.getElementById('preregPublicTab');
    const successContainer = document.getElementById('preregStepSuccess');
    
    if (preregPublicTab && successContainer) {
        // Hide duplicate download buttons outside the success container
        Array.from(preregPublicTab.querySelectorAll('a#preregSuccessQrDownload')).forEach(btn => {
            if (!successContainer.contains(btn)) btn.style.display = 'none';
        });
        
        // Hide instructional text outside the success container
        Array.from(preregPublicTab.querySelectorAll('p')).forEach(p => {
            if (p.innerText.includes('long press on the QR code') || p.innerText.includes('download and keep a copy')) {
                if (!successContainer.contains(p)) p.style.display = 'none';
            }
        });
    }

    if (origLaunchPublicPreregV103) await origLaunchPublicPreregV103(eventId);
};

const origExecutePreregisterV103 = window.executePreregister;
window.executePreregister = async function(youthId, qrCode) {
    if (origExecutePreregisterV103) await origExecutePreregisterV103(youthId, qrCode);
    
    // Explicitly unhide the correct button INSIDE the success container
    const successContainer = document.getElementById('preregStepSuccess');
    if (successContainer) {
        const dlBtn = successContainer.querySelector('a#preregSuccessQrDownload');
        if (dlBtn) dlBtn.style.display = 'inline-block';
        
        Array.from(successContainer.querySelectorAll('p')).forEach(p => {
            if (p.innerText.includes('long press on the QR code') || p.innerText.includes('download and keep a copy')) {
                p.style.display = 'block';
            }
        });
    }
};

// --- 2. EVENT ROLES SPLIT-TABS ARCHITECTURE ---
const origOpenAnalyticsModalV103 = window.openAnalyticsModal;
window.openAnalyticsModal = async function(eventId) {
    // 1. Build the sub-tabs dynamically if they don't exist
    const rolesTabInner = document.querySelector('#analyticsTabRoles > div');
    if (rolesTabInner && !document.getElementById('rolesSubNav')) {
        const subNavHTML = `
        <div id="rolesSubNav" class="sub-nav" style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 8px; padding: 5px; margin-bottom: 20px;">
            <button id="btnRoleTabAssignment" class="sub-nav-btn active" style="flex:1;" onclick="switchEventRolesSubTab('assignment')">👥 Assignment</button>
            <button id="btnRoleTabNotes" class="sub-nav-btn" style="flex:1;" onclick="switchEventRolesSubTab('notes')">🔒 Notes</button>
        </div>
        `;
        rolesTabInner.insertAdjacentHTML('afterbegin', subNavHTML);

        const assignmentWrapper = document.createElement('div');
        assignmentWrapper.id = 'roleTabAssignmentContent';
        assignmentWrapper.style.display = 'block';

        const notesWrapper = document.createElement('div');
        notesWrapper.id = 'roleTabNotesContent';
        notesWrapper.style.display = 'none';

        // Migrate Assignment Elements
        const assignControls = document.getElementById('eventRoleAssignControls');
        const teamHeaders = Array.from(rolesTabInner.querySelectorAll('h3')).filter(h => h.innerText === 'Event Team');
        const teamContainer = document.getElementById('eventRolesContainer');
        
        if (assignControls) assignmentWrapper.appendChild(assignControls);
        teamHeaders.forEach(h => assignmentWrapper.appendChild(h));
        if (teamContainer) assignmentWrapper.appendChild(teamContainer);

        // Migrate Notes Elements
        const notesSection = document.getElementById('eventRolesRestrictedSection');
        if (notesSection) {
            notesWrapper.appendChild(notesSection);
            
            // Expand Text Area for Leadership
            const textarea = document.getElementById('eventRolesDetailNotes');
            if (textarea) {
                textarea.style.minHeight = '250px';
                textarea.style.fontSize = '0.95rem';
                textarea.style.lineHeight = '1.6';
                textarea.style.backgroundColor = '#FFF';
            }
        }

        rolesTabInner.appendChild(assignmentWrapper);
        rolesTabInner.appendChild(notesWrapper);
    }

    // 2. Run Original Modal Logic
    if (origOpenAnalyticsModalV103) await origOpenAnalyticsModalV103(eventId);

    // 3. Enforce Permissions and Clean Up View State
    if (window.switchEventRolesSubTab) window.switchEventRolesSubTab('assignment');
    
    // Override the legacy permission toggle to let our wrapper control visibility
    const notesSection = document.getElementById('eventRolesRestrictedSection');
    if (notesSection) notesSection.style.display = 'block'; 

    const btnNotes = document.getElementById('btnRoleTabNotes');
    if (btnNotes) {
        if (window.hasPerm('edit_entries')) {
            btnNotes.style.display = 'inline-flex';
        } else {
            btnNotes.style.display = 'none';
        }
    }
};

window.switchEventRolesSubTab = function(tab) {
    const assignTab = document.getElementById('roleTabAssignmentContent');
    const notesTab = document.getElementById('roleTabNotesContent');
    const btnAssign = document.getElementById('btnRoleTabAssignment');
    const btnNotes = document.getElementById('btnRoleTabNotes');

    if (assignTab) assignTab.style.display = (tab === 'assignment') ? 'block' : 'none';
    if (notesTab) notesTab.style.display = (tab === 'notes') ? 'block' : 'none';

    if (btnAssign) btnAssign.classList.toggle('active', tab === 'assignment');
    if (btnNotes) btnNotes.classList.toggle('active', tab === 'notes');
};

// ==========================================
// V104: FINAL POLISH - Z-INDEX, FRESH LOGIN, TRUE REACTIONS
// ==========================================

// --- 1. Z-INDEX OVERRIDES FOR EVENT ROLES MODALS ---
const origTriggerConfirmV104 = window.triggerActionConfirmation;
window.triggerActionConfirmation = function(summaryText, actionFn) {
    if (origTriggerConfirmV104) origTriggerConfirmV104(summaryText, actionFn);
    const modal = document.getElementById('confirmModal');
    if (modal) modal.style.setProperty('z-index', '109000', 'important');
};

const origOpenEditEventRoleV104 = window.openEditEventRoleModal;
window.openEditEventRoleModal = function(mappingId, roleName, subRole) {
    if (origOpenEditEventRoleV104) origOpenEditEventRoleV104(mappingId, roleName, subRole);
    const modal = document.getElementById('editEventRoleModal');
    if (modal) modal.style.setProperty('z-index', '109000', 'important');
};

// --- 2. FRESH LOGIN RENDER FIX ---
const origSwitchTabV104 = window.switchTab;
window.switchTab = async function(tabId) {
    if (origSwitchTabV104) await origSwitchTabV104(tabId);
    
    // Force a re-render 100ms AFTER the tab becomes visible 
    // This fixes the QR code canvas failing to draw on hidden elements
    if (tabId === 'profileTab' && currentMember) {
        setTimeout(() => window.populateProfileTab(currentMember), 100);
    }
    // This ensures Events are fetched immediately when looking at the tab
    if (tabId === 'eventsTab') {
        setTimeout(() => window.loadEvents(), 100);
    }
};

// --- 3. TRUE FACEBOOK REACTIONS ENGINE (RESET & REBUILT) ---

// Step A: Global CSS Override to stop the emoji picker from being clipped
const styleFix = document.createElement('style');
styleFix.innerHTML = `
    .chat-bubble-override { overflow: visible !important; position: relative !important; }
    .react-picker-popup { z-index: 108000 !important; }
`;
document.head.appendChild(styleFix);

window.chatReactionsMap = {};
window.memoryReactionsMap = {};

// Step B: The UI Builder
window.buildReactUI = function(type, id, reactionsStr) {
    let reacts = {};
    try { reacts = JSON.parse(reactionsStr || '{}'); } catch(e){}
    
    if (type === 'chat') window.chatReactionsMap[id] = reacts;
    if (type === 'memory') window.memoryReactionsMap[id] = reacts;

    let totalReacts = 0;
    let reactSummary = [];
    Object.keys(reacts).forEach(emoji => {
        const count = Array.isArray(reacts[emoji]) ? reacts[emoji].length : reacts[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    const summaryId = `react_summary_${type}_${id}`;
    const pickerId = `picker_${type}_${id}`;

    // The Facebook-style counter badge
    const summaryHtml = totalReacts > 0 ? 
        `<div id="${summaryId}" onclick="showReactionListMaster(${id}, '${type}')" style="cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.85rem; color:var(--primary); font-weight:bold; background:rgba(255,107,0,0.1); padding:4px 10px; border-radius:12px; margin-left: auto;">
            ${reactSummary.slice(0,3).join('')} <span>${totalReacts}</span>
        </div>` : `<div id="${summaryId}" style="display:none; cursor:pointer; align-items:center; gap:4px; font-size:0.85rem; color:var(--primary); font-weight:bold; background:rgba(255,107,0,0.1); padding:4px 10px; border-radius:12px; margin-left: auto;"></div>`;

    // The new, unclippable action bar
    return `
    <div style="display:flex; align-items:center; width: 100%; margin-top: 8px; position: relative; padding-top: 8px; border-top: 1px dashed var(--border-color);">
        <button type="button" onclick="toggleReactionPickerMaster('${pickerId}', event)" style="background:#F1F5F9; border:1px solid #E2E8F0; color:var(--text-muted); font-size:0.85rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:12px; transition:0.2s;">
            <span style="font-size:1.1rem;">😀</span> React
        </button>
        
        ${summaryHtml}
        
        <div id="${pickerId}" class="react-picker-popup" style="display:none; position:absolute; bottom: 100%; left: 0; background:#FFF; border:1px solid #E2E8F0; border-radius:24px; padding:8px 12px; margin-bottom: 8px; gap:12px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
            <span style="cursor:pointer; font-size:1.4rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '👍', event)">👍</span>
            <span style="cursor:pointer; font-size:1.4rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '❤️', event)">❤️</span>
            <span style="cursor:pointer; font-size:1.4rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '😂', event)">😂</span>
            <span style="cursor:pointer; font-size:1.4rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '🙏', event)">🙏</span>
            <span style="cursor:pointer; font-size:1.4rem; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'" onclick="submitReactionMaster('${type}', ${id}, '🔥', event)">🔥</span>
        </div>
    </div>`;
};

// Step C: Submission Logic
window.toggleReactionPickerMaster = function(pickerId, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    document.querySelectorAll('[id^="picker_"]').forEach(el => {
        if (el.id !== pickerId) el.style.display = 'none';
    });
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};

window.submitReactionMaster = async function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return alert("Please log in to react.");
    
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    try {
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        });
        if (res.ok) {
            if (type === 'chat') window.loadGroupChatMaster(true);
            if (type === 'memory') window.loadGroupMemoriesMaster();
        }
    } catch(e) { console.error("Reaction submission error", e); }
};

// Step D: Apply to Chat
window.loadGroupChatMaster = async function(preserveScroll = false) {
    if (!window.currentDashboardGroupId) return;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;
    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

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
            const avatar = msg.profile_picture ? `<img src="${msg.profile_picture}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : `<div style="width:28px;height:28px;border-radius:50%;background:#CBD5E1;display:flex;align-items:center;justify-content:center;font-size:12px;color:#FFF;font-weight:bold;">${msg.name.charAt(0)}</div>`;
            
            let parsedMessage = msg.message.replace(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w\-]+)/g, 
                (match, videoId) => `<div style="margin-top: 8px; border-radius: 8px; overflow: hidden; position: relative; padding-bottom: 56.25%; height: 0; width: 100%; min-width: 200px;"><iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe></div>`
            );

            // Notice the "chat-bubble-override" class protecting the overflow
            return `
            <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:20px; width:100%;">
                ${!isMe ? `<div style="display:flex; gap:8px; align-items:center; margin-bottom:6px; font-size:0.8rem; color:var(--text-muted); font-weight:bold;">${avatar} ${msg.name}</div>` : ''}
                
                <div class="chat-bubble-override" style="background:${bg}; color:${color}; padding:14px; border-radius:12px; width:100%; max-width:85%; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="font-size:0.95rem; line-height:1.4; word-wrap: break-word;">${parsedMessage}</div>
                    ${window.buildReactUI('chat', msg.id, msg.reactions)}
                </div>
                <small style="font-size:0.65rem; color:var(--text-muted); margin-top:6px;">${msg.created_at.split(' ')[1]}</small>
            </div>`;
        }).join('');
        
        if (!preserveScroll || isScrolledToBottom) container.scrollTop = container.scrollHeight; 
    } catch(e) {}
};

// Step E: Apply to Memories
window.loadGroupMemoriesMaster = async function() {
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
        <div class="chat-bubble-override" style="background:#FFF; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 4px 6px rgba(0,0,0,0.02); display:flex; flex-direction:column; margin-bottom: 20px;">
            <img src="${m.image_data}" style="width:100%; height:160px; object-fit:cover; border-radius:12px 12px 0 0; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">
            <div style="padding:15px; flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                <p style="font-size:0.95rem; color:var(--text-main); margin:0 0 5px 0; font-weight:500;">${m.caption}</p>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">By ${m.author_name}</div>
                ${window.buildReactUI('memory', m.id, m.reactions)}
            </div>
        </div>`).join('');
    } catch(e) {}
};

window.loadGroupChat = window.loadGroupChatMaster;
window.loadGroupMemories = window.loadGroupMemoriesMaster;


// ==========================================
// V105: FRESH LOGIN, MINISTRY UI, TRUE REACTIONS
// ==========================================

// --- 1. INSTANT TAB RENDERING FIX ---
const origSwitchTabV105 = window.switchTab;
window.switchTab = async function(tabId) {
    if (origSwitchTabV105) await origSwitchTabV105(tabId);
    
    // Instant loads (no artificial delays)
    if (tabId === 'profileTab' && currentMember) {
        window.populateProfileTab(currentMember);
    }
    if (tabId === 'eventsTab') {
        window.loadEvents();
    }
    if (tabId === 'ministriesTab') {
        // Force the List sub-tab to render immediately on open
        window.switchMinistrySubTab('list');
    }
};

// --- 2. MINISTRY DETAILS MODAL OVERHAUL ---
window.openMinistryDetailsModal = async function(id) {
    currentMinistryId = id;
    const m = ministriesData.find(x => x.id === id);
    if (!m) return;

    const modal = document.getElementById('ministryDetailsModal');
    if (!modal) return;

    // 30% width Logo HTML
    const logoHtml = m.logo ? 
        `<img src="${m.logo}" style="width:100%; height:auto; object-fit:cover; border-radius:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer(this.src)">` : 
        `<div style="width:100%; padding-top:100%; background:var(--bg-light); border-radius:12px; position:relative; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><span style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:2.5rem;">🏛️</span></div>`;
    
    // Edit Button
    const editBtn = window.hasPerm('edit_entries') ? 
        `<button class="btn btn-outline btn-sm" style="margin-top:10px; font-weight:600;" onclick="openEditMinistryModal()">✏️ Edit Ministry</button>` : '';

    // Assign Controls HTML
    const assignHTML = window.hasPerm('add_entries') ? `
        <div style="background: var(--bg-light); padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1 1 100%; position: relative;">
                    <input type="text" id="minSearchInput" class="form-control" placeholder="Search Member..." onkeyup="filterMinistrySearch()">
                    <div id="minSearchDropdown" style="display:none; position:absolute; background:#FFF; width:100%; border: 1px solid var(--border-color); max-height: 200px; overflow-y: auto; z-index:100; border-radius:6px; box-shadow:0 4px 10px rgba(0,0,0,0.1);"></div>
                </div>
                <input type="hidden" id="minSelectedUserId">
                <select id="minRoleSelect" class="form-control" style="flex: 1 1 45%;">
                    <option value="Member">Member</option>
                    <option value="Ministry Head">Ministry Head</option>
                    <option value="Assistant Ministry Head">Assistant Ministry Head</option>
                    <option value="Core">Core</option>
                </select>
                <input type="text" id="minSubRoleInput" class="form-control" placeholder="Sub-Role" style="flex: 1 1 45%;">
                <button class="btn btn-primary" onclick="assignMinistryRole()" style="flex: 1 1 100%;">Assign Role</button>
            </div>
        </div>` : '';

    // Reconstruct the Entire Modal HTML
    modal.innerHTML = `
    <div class="modal-content" style="max-width: 700px; padding: 0; background: #F8FAFC; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh;">
        <span class="close-modal" onclick="closeMinistryDetailsModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer; z-index: 10;">&times;</span>
        
        <div style="padding: 25px 25px 15px 25px; background: #FFF; border-bottom: 1px solid var(--border-color); position: relative;">
            <div style="display:flex; gap:20px; align-items:flex-start;">
                <div style="width: 30%; flex-shrink: 0;">${logoHtml}</div>
                <div style="width: 70%; display:flex; flex-direction:column; justify-content:center;">
                    <h2 style="color: var(--primary); margin:0; font-size:1.6rem; border:none; padding-bottom:5px;">${m.name}</h2>
                    <div>${editBtn}</div>
                </div>
            </div>
            <p style="color: var(--text-muted); margin-top: 15px; line-height: 1.5;">${m.description || 'No description provided.'}</p>
        </div>

        <div class="sub-nav" style="background: #FFF; border-bottom: 1px solid var(--border-color); padding: 10px 15px 0 15px; margin: 0; justify-content:center;">
            <button id="btnMinTabList" class="sub-nav-btn active" style="flex:1; max-width: 200px;" onclick="switchMinistryDetailsTab('list')">👥 List</button>
            <button id="btnMinTabNotes" class="sub-nav-btn" style="flex:1; max-width: 200px; display:${window.hasPerm('edit_entries') ? 'inline-block' : 'none'}" onclick="switchMinistryDetailsTab('notes')">🔒 Notes</button>
        </div>

        <div style="padding: 20px; overflow-y: auto; flex: 1;">
            <div id="minTabListContent" style="display:block;">
                ${assignHTML}
                <div id="ministryRosterContainer"></div>
            </div>
            <div id="minTabNotesContent" style="display:none;">
                <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; border: 1px solid #FDE68A;">
                    <h3 style="color:#D97706; margin-top:0; border:none;">🔒 Leader's Notes</h3>
                    <textarea id="ministryDetailNotes" class="form-control" style="min-height:350px; resize:vertical; font-size:0.95rem; line-height:1.5;">${m.restricted_notes || ''}</textarea>
                    <button class="btn btn-primary" style="background: #D97706; border:none; margin-top:15px; width:100%; font-weight:bold; padding:12px;" onclick="saveMinistryNotes()">Save Notes</button>
                </div>
            </div>
        </div>
    </div>`;

    modal.style.display = 'flex';
    modal.classList.add('active');
    
    // Load roster data natively
    await window.loadMinistryRoster(id);
};

window.switchMinistryDetailsTab = function(tab) {
    const listTab = document.getElementById('minTabListContent');
    const notesTab = document.getElementById('minTabNotesContent');
    const btnList = document.getElementById('btnMinTabList');
    const btnNotes = document.getElementById('btnMinTabNotes');

    if (listTab) listTab.style.display = tab === 'list' ? 'block' : 'none';
    if (notesTab) notesTab.style.display = tab === 'notes' ? 'block' : 'none';
    if (btnList) btnList.classList.toggle('active', tab === 'list');
    if (btnNotes) btnNotes.classList.toggle('active', tab === 'notes');
};


// --- 3. TRUE OPTIMISTIC FACEBOOK REACTION ENGINE ---

window.refreshReactionBadgeUI = function(type, id, reactionsObj) {
    if (type === 'chat') window.chatReactionsMap[id] = reactionsObj;
    if (type === 'memory') window.memoryReactionsMap[id] = reactionsObj;

    let totalReacts = 0;
    let reactSummary = [];
    
    Object.keys(reactionsObj).forEach(emoji => {
        const count = Array.isArray(reactionsObj[emoji]) ? reactionsObj[emoji].length : reactionsObj[emoji];
        if (count > 0) {
            totalReacts += count;
            if(!reactSummary.includes(emoji)) reactSummary.push(emoji);
        }
    });

    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    
    if (summaryEl) {
        if (totalReacts > 0) {
            summaryEl.innerHTML = `${reactSummary.slice(0,3).join('')} <span style="margin-left: 4px;">${totalReacts}</span>`;
            summaryEl.style.display = 'flex';
        } else {
            summaryEl.innerHTML = '';
            summaryEl.style.display = 'none';
        }
    }
};

// Simplified parameterless event handling
window.submitReactionMaster = function(type, id, emoji) {
    if (!currentMember) return alert("Please log in to react.");
    
    // 1. Hide picker instantly
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    // 2. Fetch current local state
    const map = type === 'chat' ? window.chatReactionsMap : window.memoryReactionsMap;
    let currentReacts = map[id] || {};
    
    // 3. Optimistically calculate new state (Toggle logic)
    let removed = false;
    Object.keys(currentReacts).forEach(e => {
        if(Array.isArray(currentReacts[e])) {
            const idx = currentReacts[e].indexOf(currentMember.name);
            if (idx > -1) {
                currentReacts[e].splice(idx, 1);
                if (e === emoji) removed = true; // They clicked the same emoji, so remove it
            }
        }
    });

    // If they didn't toggle it off, add the new emoji
    if (!removed) {
        if (!currentReacts[emoji]) currentReacts[emoji] = [];
        currentReacts[emoji].push(currentMember.name);
    }

    // Clean up empty emoji arrays
    Object.keys(currentReacts).forEach(e => {
        if(currentReacts[e].length === 0) delete currentReacts[e];
    });

    // 4. Update the UI IMMEDIATELY (Zero Server Lag)
    window.refreshReactionBadgeUI(type, id, currentReacts);

    // 5. Sync to server silently in the background
    try {
        fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        }).catch(err => console.error("Reaction Sync Failed", err));
    } catch(e) {}
};


// ==========================================
// V106: TEXTAREA HEIGHT & TRUE SERVER SYNC
// ==========================================

// --- 1. FIX TEXT AREA HEIGHT ---
const origOpenMinistryDetailsModalV106 = window.openMinistryDetailsModal;
window.openMinistryDetailsModal = async function(id) {
    if(origOpenMinistryDetailsModalV106) await origOpenMinistryDetailsModalV106(id);
    
    // Locate the textarea and reduce the height to prevent cutting off the button
    const textarea = document.getElementById('ministryDetailNotes');
    if (textarea) {
        textarea.style.minHeight = '240px'; 
    }
};

// --- 2. BULLETPROOF OPTIMISTIC SYNC ---
window.submitReactionMaster = function(type, id, emoji) {
    if (!currentMember) return alert("Please log in to react.");
    
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    const map = type === 'chat' ? window.chatReactionsMap : window.memoryReactionsMap;
    
    // Deep copy to ensure we don't accidentally corrupt local references
    let currentReacts = JSON.parse(JSON.stringify(map[id] || {}));
    
    let removed = false;
    Object.keys(currentReacts).forEach(e => {
        if(Array.isArray(currentReacts[e])) {
            const idx = currentReacts[e].indexOf(currentMember.name);
            if (idx > -1) {
                currentReacts[e].splice(idx, 1);
                if (e === emoji) removed = true; 
            }
        }
    });

    if (!removed) {
        if (!currentReacts[emoji]) currentReacts[emoji] = [];
        currentReacts[emoji].push(currentMember.name);
    }

    Object.keys(currentReacts).forEach(e => {
        if(currentReacts[e].length === 0) delete currentReacts[e];
    });

    // Update UI instantly
    window.refreshReactionBadgeUI(type, id, currentReacts);

    // Send to server and lock in the TRUE database state
    try {
        fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.reactions) {
                // The server confirmed it! Lock in the database truth.
                window.refreshReactionBadgeUI(type, id, data.reactions);
            }
        })
        .catch(err => console.error("Reaction Sync Failed", err));
    } catch(e) {}
};

// ==========================================
// V107: THE KOINONIA PATCH - TRUE REACTIONS & SORTING
// ==========================================

// --- 1. PROFILE ROLES: PRIORITY SORTING ---
window.loadMyV3Roles = async function(targetMemberId, containerId) {
    const id = targetMemberId || (typeof currentMember !== 'undefined' && currentMember ? currentMember.id : null);
    const cId = containerId || 'myMinistriesHistory';
    const container = document.getElementById(cId);
    if (!container || !id) return;

    container.innerHTML = '<div style="text-align:center; padding:10px; color:var(--text-muted);">Loading roles...</div>';
    try {
        const [minRes, evtRes] = await Promise.all([ fetch('/api/youth/' + id + '/ministries'), fetch('/api/youth/' + id + '/event_roles') ]);
        const ministries = await minRes.json(); const events = await evtRes.json();

        let allRoles = [];
        if(ministries && ministries.length) ministries.forEach(m => allRoles.push({...m, type: 'ministry'}));
        if(events && events.length) events.forEach(e => allRoles.push({...e, type: 'event'}));
        if (allRoles.length === 0) return container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:10px;">No roles assigned yet.</div>';

        // NEW SORTING: Priority first, then Ministry, then Event, then Date
        allRoles.sort((a, b) => {
            const aPrio = a.is_priority ? 1 : 0;
            const bPrio = b.is_priority ? 1 : 0;
            if (aPrio !== bPrio) return bPrio - aPrio; // Forces Priority to the top!
            if (a.type !== b.type) return a.type === 'ministry' ? -1 : 1;
            return new Date(b.assigned_at) - new Date(a.assigned_at);
        });

        container.innerHTML = allRoles.map(r => {
            const isPriority = r.is_priority === 1;
            const priorityBadge = isPriority ? '<span style="background:#FEF3C7; color:#D97706; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold; margin-left:8px;">⭐ Priority</span>' : '';
            const badge = r.type === 'ministry' ? '<span class="badge badge-blue">🏛️ Ministry</span>' : '<span class="badge badge-orange">📅 Event</span>';
            const title = r.type === 'ministry' ? r.ministry_name : r.event_name;
            const actionBtn = (r.type === 'ministry' && r.role !== 'Applicant' && !isPriority && currentMember && id == currentMember.id && cId === 'myMinistriesHistory')
                ? `<button class="btn btn-primary btn-sm" style="margin-top:10px; font-size:0.75rem; font-weight:bold;" onclick="setCorePriority(${r.mapping_id})">⭐ Make Priority</button>` : '';

            return `<div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid ${isPriority ? '#F59E0B' : 'var(--border-color)'};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;"><strong style="color: var(--primary); font-size: 1.05rem;">${title || 'Unknown'} ${priorityBadge}</strong>${badge}</div>
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;"><strong>Role:</strong> ${r.role || r.role_name} ${r.sub_role ? ' | '+r.sub_role : ''}</div>${actionBtn}
            </div>`;
        }).join('');
    } catch(e) { container.innerHTML = '<div style="color:var(--danger); text-align:center;">Failed to load roles.</div>'; }
};

// --- 2. FLAWLESS FACEBOOK REACTION ENGINE ---
window.submitReactionMaster = async function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return alert("Please log in to react.");
    
    // 1. Hide picker instantly
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    // 2. Visual Cue
    const summaryId = `react_summary_${type}_${id}`;
    const summaryEl = document.getElementById(summaryId);
    if (summaryEl && summaryEl.style.display === 'none') {
        summaryEl.style.display = 'flex';
        summaryEl.innerHTML = `⏳`;
    }

    try {
        // 3. Direct API Call (Let the server do the math securely)
        const res = await fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name || 'Member' })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.reactions) {
                // 4. Paint the true state from the server directly to the DOM!
                window.refreshReactionBadgeUI(type, id, data.reactions);
            }
        }
    } catch(e) { 
        console.error("Reaction submission error", e); 
        if (summaryEl && summaryEl.innerHTML === `⏳`) summaryEl.style.display = 'none';
    }
};


// ==========================================
// V108: TRUE OPTIMISTIC REACTIONS & BROADCAST OVERRIDE
// ==========================================

// --- 1. THE PERFECT OPTIMISTIC REACTION ENGINE (Restored & Perfected) ---
window.submitReactionMaster = function(type, id, emoji, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!currentMember) return alert("Please log in to react.");
    
    // 1. Hide picker instantly
    const pickerId = `picker_${type}_${id}`;
    const picker = document.getElementById(pickerId);
    if (picker) picker.style.display = 'none';

    const map = type === 'chat' ? window.chatReactionsMap : window.memoryReactionsMap;
    
    // 2. Deep copy to calculate local state
    let currentReacts = JSON.parse(JSON.stringify(map[id] || {}));
    
    let removed = false;
    Object.keys(currentReacts).forEach(e => {
        if(Array.isArray(currentReacts[e])) {
            const idx = currentReacts[e].indexOf(currentMember.name);
            if (idx > -1) {
                currentReacts[e].splice(idx, 1);
                if (e === emoji) removed = true; 
            }
        }
    });

    if (!removed) {
        if (!currentReacts[emoji]) currentReacts[emoji] = [];
        currentReacts[emoji].push(currentMember.name);
    }

    Object.keys(currentReacts).forEach(e => {
        if(currentReacts[e].length === 0) delete currentReacts[e];
    });

    // 3. INSTANT UI UPDATE (Zero lag, zero server waiting)
    window.refreshReactionBadgeUI(type, id, currentReacts);

    // 4. Send to server silently in the background
    try {
        fetch(`/api/small-groups/react-v2`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ type: type, id: id, emoji: emoji, user_name: currentMember.name })
        }).catch(err => console.error("Reaction Sync Failed", err));
    } catch(e) {}
};


// --- 2. BROADCAST PUSH NOTIFICATION OVERRIDE ---
if (typeof window.V4Communications === 'undefined') window.V4Communications = {};

window.V4Communications.sendBroadcast = async function(e) {
    e.preventDefault(); // Stop the page from refreshing!
    
    const target = document.getElementById('bcTargetSelect').value;
    const title = document.getElementById('bcTitle').value;
    const message = document.getElementById('bcMessage').value;
    
    if (!title || !message) return alert("Please fill out all fields.");

    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerText;
    btn.innerText = '📡 Broadcasting...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/communications/broadcast', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ target, title, message, actor: currentUser || 'Admin' })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`✅ Broadcast sent successfully!\nIt was delivered to ${data.sentCount} connected devices.`);
            document.getElementById('broadcastForm').reset();
            
            // Refresh history natively if the function exists
            if (typeof window.loadBroadcastHistory === 'function') window.loadBroadcastHistory();
        } else {
            alert('❌ Failed to send broadcast. Check server connection.');
        }
    } catch(err) {
        console.error(err);
        alert('❌ Network error sending broadcast.');
    }
    
    btn.innerText = origText;
    btn.disabled = false;
};

if (typeof window.V4Communications !== 'undefined') {
    window.V4Communications.sendBroadcast = async function(e) {
        e.preventDefault();
        const target = document.getElementById('bcTargetSelect').value;
        const title = document.getElementById('bcTitle').value;
        const message = document.getElementById('bcMessage').value;
        if (!title || !message) return alert("Please fill out all fields.");

        const btn = e.target.querySelector('button[type="submit"]');
        const origText = btn.innerText;
        btn.innerText = '📡 Broadcasting...';
        btn.disabled = true;

        try {
            const res = await fetch('/api/communications/broadcast', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ target, title, message, actor: currentUser || 'Admin' })
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Broadcast sent successfully!\nDelivered to ${data.sentCount} connected devices.`);
                document.getElementById('broadcastForm').reset();
            } else {
                alert('❌ Server Error: ' + (data.error || 'Unknown Error in Backend'));
            }
        } catch(err) {
            console.error(err);
            alert('❌ Critical Network Error. Check browser console.');
        }
        btn.innerText = origText;
        btn.disabled = false;
    };
}
