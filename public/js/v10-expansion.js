// ========== public/js/v10-expansion.js ==========
// FIRE OF GOD MINISTRIES - V11 GAME ENGINE (LANDING PAGES, 3-TRIES, SUDDEN DEATH)

window.V10Expansion = {
    init: function() {
        console.log("🚀 V11 Expansion Module Initialized");
        this.hookNavigation();
        this.loadFeaturedGames(); 
        
        // Wrap all game cards with the Landing Page Engine after DOM loads
        setTimeout(() => this.applyLandingPages(), 800);
        setTimeout(() => this.loadTopScorers(), 1200); 
        
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
                    setTimeout(() => window.V10Expansion.applyLandingPages(), 500);
                    setTimeout(() => window.V10Expansion.loadTopScorers(), 800);
                }
                if (tabId === 'profileTab') {
                    const settingsCard = document.getElementById('adminSettingsCard');
                    if (settingsCard) {
                        settingsCard.style.display = (currentUser === 'celsocreeriii@gmail.com' || (typeof window.hasPerm === 'function' && window.hasPerm('edit_entries'))) ? 'block' : 'none';
                    }
                }
            };
            window.switchTab.isV10Patched = true;
            if (document.getElementById('profileTab') && document.getElementById('profileTab').classList.contains('active')) window.switchTab('profileTab');
        }
        setTimeout(() => this.loadAdminFeaturedSettings(), 1000);
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
                const bottomNav = document.getElementById('bottomNav');
                if (bottomNav && !document.getElementById('bottomNavLeaderboards')) {
                    const lastBtn = bottomNav.lastElementChild;
                    if (lastBtn) lastBtn.insertAdjacentHTML('beforebegin', `<button id="bottomNavLeaderboards" class="bottom-nav-btn" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')"><div class="icon">🏆</div>Ranks</button>`);
                }
            };
            if (typeof currentUser !== 'undefined' && currentUser) window.buildNav();
        }
    },

    getPlayFunction: function(gameName) {
        // BYPASS OLD MENUS: Point directly to the start functions!
        if(gameName === "David's Slingshot") return 'V8Slingshot.startGame()';
        if(gameName === "Noah's Ark: Rescue") return 'V8NoahsArk.startGame()';
        if(gameName === "Moses' Red Sea Dash") return 'V8RedSea.startGame()';
        if(gameName === "Peter's Leap of Faith") return 'V8PetersLeap.startGame()';
        if(gameName === "Jonah's Deep Sea Dive") return 'V8JonahsDive.startGame()';
        if(gameName === 'Catechism Clash') return 'V10Expansion.playCC()';
        if(gameName === 'Who Am I?') return 'V10Expansion.playWAI()';
        if(gameName === 'Daily Manna Scramble') return 'V10Expansion.playVS()';
        if(gameName === 'Emoji Sermon Translator') return 'V10Expansion.playEM()';
        if(gameName === 'The Narrow Gate') return 'V10Expansion.playNG()';
        if(gameName === 'Shield of Faith: Reflex Tap') return 'V10Expansion.playRX()';
        return '';
    },

    // --------------------------------------------------------------------------
    // DYNAMIC LANDING PAGE WRAPPER & TOP 3 SCORERS
    // --------------------------------------------------------------------------
    loadTopScorers: async function() {
        try {
            const res = await fetch('/api/games/top-scorers-bulk');
            const bulkData = await res.json();

            document.querySelectorAll('.arcade-game-card:not(.hero-game-card)').forEach(card => {
                const gameName = card.getAttribute('data-game-name');
                if (!gameName || !bulkData[gameName] || bulkData[gameName].length === 0) return;
                
                if (card.querySelector('.top-scorers-container')) card.querySelector('.top-scorers-container').remove(); 

                const topPlayers = bulkData[gameName];
                let html = `<div class="top-scorers-container" style="background: rgba(0,0,0,0.02); border-top: 1px solid var(--border-color); padding: 8px; display: flex; justify-content: center; gap: 8px; margin-top: auto;">`;
                topPlayers.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const avatar = p.profile_picture ? `<img src="${p.profile_picture}" title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; border: 1px solid #CBD5E1; object-fit: cover;">` : `<div title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:bold; border: 1px solid #CBD5E1;">${p.name.charAt(0)}</div>`;
                    html += `<div style="position: relative;">${avatar}<span style="position: absolute; bottom: -5px; right: -5px; font-size: 0.6rem;">${medal}</span></div>`;
                });
                html += `</div>`;
                
                const actionBtn = card.querySelector('.game-action');
                if (actionBtn) actionBtn.insertAdjacentHTML('beforebegin', html);
            });
        } catch (e) { console.error("Bulk Top Scorers Error", e); }
    },

    applyLandingPages: function() {
        document.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(card => {
            const gameName = card.getAttribute('data-game-name');
            if (!gameName || gameName === 'Cell Group Clash' || gameName === 'Verse Chain' || gameName === 'Would You Rather' || gameName === 'Word Matrix') return;
            
            const type = card.closest('#growthGamesGrid') ? 'growth' : 'arcade';
            const icon = card.querySelector('.game-icon') ? card.querySelector('.game-icon').innerText : '🎮';
            const desc = card.querySelector('p') ? card.querySelector('p').innerText.replace(/"/g, "'").replace(/\n/g, " ") : '';
            const playFn = this.getPlayFunction(gameName);

            // Native binding prevents apostrophe crashes
            card.onclick = () => window.V10Expansion.openGameLanding(gameName, type, playFn, desc, icon);
        });
    },

    openGameLanding: async function(gameName, type, playFn, desc, icon) {
        if (!currentMember || !currentMember.id) return alert("Please log in to play!");

        const gridId = type === 'growth' ? 'growthGamesGrid' : 'arcadeGridItems';
        const fSlotId = type === 'growth' ? 'featuredGrowthGameContainer' : 'featuredArcadeGameContainer';
        
        document.getElementById(gridId).style.display = 'none';
        if (document.getElementById(fSlotId)) document.getElementById(fSlotId).style.display = 'none';

        const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `<div style="padding:40px; text-align:center;"><p style="color:var(--text-muted);">Loading Game Data...</p></div>`;

        try {
            const [topRes, attRes] = await Promise.all([
                fetch(`/api/gamification/game-top/${encodeURIComponent(gameName)}`),
                fetch(`/api/games/check-attempts?youth_id=${currentMember.id}&game_name=${encodeURIComponent(gameName)}`)
            ]);
            const topPlayers = await topRes.json();
            const attemptsData = await attRes.json();

            let topHtml = `<p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 5px;">No top scorers yet. Be the first!</p>`;
            if (topPlayers.length > 0) {
                topHtml = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
                topPlayers.forEach((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    const avatar = p.profile_picture ? `<img src="${p.profile_picture}" style="width:30px; height:30px; border-radius:50%; object-fit: cover;">` : `<div style="width:30px; height:30px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-weight:bold;">${p.name.charAt(0)}</div>`;
                    topHtml += `<div style="display: flex; align-items: center; justify-content: space-between; background: #F8FAFC; padding: 8px 15px; border-radius: 8px; border: 1px solid #E2E8F0;">
                        <div style="display: flex; align-items: center; gap: 10px;">${medal} ${avatar} <strong style="color: #0F172A; font-size: 0.95rem;">${p.name}</strong></div>
                        <span style="font-weight: 800; color: ${type === 'growth' ? '#059669' : '#F59E0B'};">${p.high_score} XP</span>
                    </div>`;
                });
                topHtml += `</div>`;
            }

            const isLocked = attemptsData.remaining <= 0;
            const playBtnHtml = isLocked 
                ? `<button class="btn btn-secondary" style="width:100%; padding:15px; font-size:1.1rem; cursor:not-allowed;" disabled>Daily Limit Reached (Check back tomorrow!)</button>`
                : `<button class="btn btn-primary" style="width:100%; padding:15px; font-size:1.1rem; background: ${type === 'growth' ? '#059669' : '#FF6B00'};" onclick="${playFn}">▶ PLAY NOW (${attemptsData.remaining} Tries Left)</button>`;

            area.innerHTML = `
                <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                    <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame()">🔙 Back to Hub</button>
                    <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">${icon} ${gameName}</div>
                </div>
                <div style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="font-size: 4rem; margin-bottom: 10px;">${icon}</div>
                        <h2 style="color: ${type === 'growth' ? '#059669' : '#FF6B00'}; font-size: 1.8rem; border: none; margin-bottom: 10px; padding: 0;">${gameName}</h2>
                        <p style="color: #4B5563; font-size: 0.95rem; line-height: 1.5; margin: 0 auto; max-width: 400px;">${desc}</p>
                    </div>
                    <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 15px; border-radius: 12px; margin-bottom: 25px;">
                        <h3 style="color: #D97706; font-size: 1rem; margin-bottom: 15px; border-bottom: 1px solid #FDE68A; padding-bottom: 5px;">🏆 Top 3 Players</h3>
                        ${topHtml}
                    </div>
                    <div style="text-align: center; margin-bottom: 15px;">
                        <span class="badge badge-orange">Your Daily High Score: ${attemptsData.highest_score}</span>
                    </div>
                    ${playBtnHtml}
                </div>
            `;
        } catch (e) { area.innerHTML = `<p style="color:red;">Error loading game.</p>`; }
    },

    submitUniversalScore: async function(gameName, type, score) {
        try {
            const res = await fetch('/api/games/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youth_id: currentMember.id, game_name: gameName, score: score, type: type, actor: currentUser })
            });
            const data = await res.json();
            
            if (data.success) {
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (typeof window.V8Arcade !== 'undefined' && type === 'arcade') window.V8Arcade.updateTotalXP();

                const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
                let rewardText = data.pointsAwarded > 0 
                    ? `<div style="font-size: 2rem; color: #10B981; font-weight: 800; margin: 20px 0;">+${data.pointsAwarded} ${type.toUpperCase()} XP!</div><p style="color: #64748B;">You beat your daily high score!</p>` 
                    : `<div style="font-size: 1.2rem; color: #F59E0B; font-weight: 800; margin: 20px 0;">Score: ${score}</div><p style="color: #64748B;">Didn't beat your high score of ${data.highestScore}.</p>`;

                area.innerHTML = `
                    <div style="background: #FFF; padding: 40px 20px; border-radius: 12px; text-align: center; border: 1px solid #E2E8F0;">
                        <h2 style="color: #0F172A; border: none;">Run Completed</h2>
                        ${rewardText}
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 25px;">You have ${data.attemptsLeft} attempts left today.</p>
                        <button class="btn btn-outline" style="width: 100%; max-width: 250px;" onclick="V10Expansion.exitGame()">Return to Hub</button>
                    </div>
                `;
            } else { alert(data.error || "Failed to save score."); }
        } catch(e) { alert("Network Error."); }
    },

    exitGame: function() {
        if(this._activeTimer) clearInterval(this._activeTimer);
        if(this.rxState && this.rxState.timerId) clearInterval(this.rxState.timerId);

        const growthArea = document.getElementById('growthActiveGameArea');
        if(growthArea) { growthArea.style.display = 'none'; growthArea.innerHTML = ''; }
        const growthGrid = document.getElementById('growthGamesGrid');
        if(growthGrid) growthGrid.style.display = 'grid';
        if(document.getElementById('featuredGrowthGameContainer')) document.getElementById('featuredGrowthGameContainer').style.display = 'block';

        const arcadeArea = document.getElementById('arcadeActiveGameArea');
        if(arcadeArea) { arcadeArea.style.display = 'none'; arcadeArea.innerHTML = ''; }
        const arcadeGrid = document.getElementById('arcadeGridItems');
        if(arcadeGrid) arcadeGrid.style.display = 'grid';
        if(document.getElementById('featuredArcadeGameContainer')) document.getElementById('featuredArcadeGameContainer').style.display = 'block';
    },

    // --------------------------------------------------------------------------
    // THE 15-SLIDE SUDDEN DEATH GAME ENGINES (1 WRONG = GAME OVER)
    // --------------------------------------------------------------------------
    playCC: async function() {
        const data = await fetch('/api/games/data/trivia').then(r=>r.json());
        this.ccState = { q: data, i: 0, s: 0, t: 60 };
        this._activeTimer = setInterval(() => {
            this.ccState.t--;
            const tEl = document.getElementById('gTimer'); if(tEl) tEl.innerText = this.ccState.t + 's';
            if(this.ccState.t <= 0) { clearInterval(this._activeTimer); this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s); }
        }, 1000);
        this.renderCC();
    },
    renderCC: function() {
        if(this.ccState.i >= this.ccState.q.length) { clearInterval(this._activeTimer); return this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s); }
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

    playWAI: async function() {
        const data = await fetch('/api/games/data/whoami').then(r=>r.json());
        this.waiState = { q: data, i: 0, s: 0, clues: 1 };
        this.renderWAI();
    },
    renderWAI: function() {
        if(this.waiState.i >= this.waiState.q.length) return this.submitUniversalScore("Who Am I?", "growth", this.waiState.s);
        const q = this.waiState.q[this.waiState.i];
        let pts = this.waiState.clues === 1 ? 15 : this.waiState.clues === 2 ? 10 : 5;
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.waiState.s}</span><span>${this.waiState.i+1}/15</span></div>`;
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
            setTimeout(() => { this.waiState.i++; this.waiState.clues=1; this.renderWAI(); }, 1200);
        } else { 
            resEl.style.color='#EF4444'; resEl.innerText=`Wrong! It was ${ans}.`; 
            setTimeout(() => { this.submitUniversalScore("Who Am I?", "growth", this.waiState.s); }, 1500);
        }
    },

    playVS: async function() {
        const data = await fetch('/api/games/data/scramble').then(r=>r.json());
        this.vsState = { q: data, i: 0, s: 0, cur: [], words: [] };
        this.setupVS();
    },
    setupVS: function() {
        if(this.vsState.i >= this.vsState.q.length) return this.submitUniversalScore("Daily Manna Scramble", "growth", this.vsState.s);
        const q = this.vsState.q[this.vsState.i];
        this.vsState.correctOrder = q.verse_text.split(' ');
        this.vsState.words = [...this.vsState.correctOrder].sort(()=>Math.random()-0.5);
        this.vsState.cur = [];
        this.renderVS();
    },
    renderVS: function() {
        const q = this.vsState.q[this.vsState.i];
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.vsState.s}</span><span>${this.vsState.i+1}/15</span></div>`;
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
            setTimeout(() => { this.vsState.i++; this.setupVS(); }, 1000);
        } else { 
            resEl.style.color='#EF4444'; resEl.innerText="Incorrect order! Game Over."; 
            setTimeout(() => { this.submitUniversalScore("Daily Manna Scramble", "growth", this.vsState.s); }, 1500);
        }
    },

    playEM: async function() {
        const data = await fetch('/api/games/data/emoji').then(r=>r.json());
        this.emState = { q: data, i: 0, s: 0 };
        this.renderEM();
    },
    renderEM: function() {
        if(this.emState.i >= this.emState.q.length) return this.submitUniversalScore("Emoji Sermon Translator", "growth", this.emState.s);
        const q = this.emState.q[this.emState.i]; let opts = JSON.parse(q.options);
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.emState.s}</span><span>${this.emState.i+1}/15</span></div>`;
        h += `<div style="font-size:3rem; text-align:center; letter-spacing:5px; margin-bottom:20px;">${q.emojis}</div><div style="display:flex; flex-direction:column; gap:10px;">`;
        opts.forEach(opt => { h += `<button class="btn btn-outline" onclick="V10Expansion.ansEM('${opt.replace(/'/g,"\\'")}', '${q.answer.replace(/'/g,"\\'")}', this)">${opt}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansEM: function(guess, ans, btn) {
        if(guess === ans) { 
            this.emState.s += 10; btn.style.background='#10B981'; btn.style.color='#FFF'; btn.style.borderColor='#10B981';
            setTimeout(() => { this.emState.i++; this.renderEM(); }, 800);
        } else { 
            btn.style.background='#EF4444'; btn.style.color='#FFF'; btn.style.borderColor='#EF4444';
            setTimeout(() => { this.submitUniversalScore("Emoji Sermon Translator", "growth", this.emState.s); }, 1000);
        }
    },

    playNG: async function() {
        const data = await fetch('/api/games/data/trivia').then(r=>r.json());
        this.ngState = { q: data, i: 0, s: 0, streak: 0 };
        this.renderNG();
    },
    renderNG: function() {
        if(this.ngState.i >= this.ngState.q.length) return this.submitUniversalScore("The Narrow Gate", "growth", this.ngState.s);
        const q = this.ngState.q[this.ngState.i]; let opts = JSON.parse(q.options);
        let h = `<div style="color:#10B981; font-weight:900; font-size:1.2rem; margin-bottom:20px;">🔥 STREAK: ${this.ngState.streak}</div>`;
        h += `<h3 style="margin-bottom:20px;">${q.question}</h3><div style="display:flex; flex-direction:column; gap:10px;">`;
        opts.forEach((o, idx) => { h += `<button class="btn btn-outline" style="border-color:#374151; color:#E5E7EB; background:#111827;" onclick="V10Expansion.ansNG(${idx}, ${q.correct_index}, this)">${o}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#1F2937; color:#FFF; padding:30px; border-radius:12px;">${h}</div>`;
    },
    ansNG: function(sel, cor, btn) {
        if(sel === cor) { 
            this.ngState.streak++; this.ngState.s = this.ngState.streak * 5; 
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
    },

    // --------------------------------------------------------------------------
    // ADMIN CONFIGURATIONS & LEADERBOARDS
    // --------------------------------------------------------------------------
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
        } catch(e) {}
    },
    renderFeaturedSlot: async function(gridId, containerId, gameName, isGrowth) {
        const container = document.getElementById(containerId); const grid = document.getElementById(gridId) || document.getElementById('arcadeGamesList'); 
        if (!container || !grid) return;

        grid.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(t => t.style.display = 'flex');
        if (!gameName || gameName === "None") return container.innerHTML = '';

        const tile = grid.querySelector(`[data-game-name="${gameName}"]`);
        if (tile) {
            tile.style.display = 'none'; // Hide from lower grid
            const icon = tile.querySelector('.game-icon') ? tile.querySelector('.game-icon').innerText : '🎮';
            const title = tile.querySelector('h3') ? tile.querySelector('h3').innerText : gameName;
            const desc = tile.querySelector('p') ? tile.querySelector('p').innerText.replace(/"/g, "'").replace(/\n/g, " ") : 'Play our featured game!';
            
            const type = isGrowth ? 'growth' : 'arcade';
            const playFn = this.getPlayFunction(gameName);
            
            let topHtml = '';
            try {
                const topP = await fetch(`/api/gamification/game-top/${encodeURIComponent(gameName)}`).then(r=>r.json());
                if(topP.length > 0) {
                    topHtml = `<div style="display:flex; gap:6px; margin-bottom:12px; background:rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 8px; width: fit-content;">`;
                    topP.forEach((p,i) => {
                        const m = i===0?'🥇':i===1?'🥈':'🥉';
                        const a = p.profile_picture ? `<img src="${p.profile_picture}" title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; border:1px solid #FFF; object-fit:cover;">` : `<div title="${p.name} - ${p.high_score}XP" style="width:24px; height:24px; border-radius:50%; background:#E2E8F0; color:#0F172A; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:bold; border:1px solid #FFF;">${p.name.charAt(0)}</div>`;
                        topHtml += `<div style="position:relative;">${a}<span style="position:absolute; bottom:-4px; right:-4px; font-size:0.6rem;">${m}</span></div>`;
                    });
                    topHtml += `</div>`;
                }
            } catch(e){}

            container.innerHTML = `
                <h3 style="color: var(--text-main); font-size: 1.1rem; font-weight: 800; margin-bottom: 12px; border: none; padding: 0;">⭐ Featured Game</h3>
                <div class="hero-game-card ${isGrowth ? 'growth-hero' : ''}" id="hero-${containerId}">
                    <div class="game-icon">${icon}</div>
                    <div class="game-info">
                        <h3>${title}</h3>
                        <p>${desc}</p>
                        ${topHtml}
                        <div class="game-action">PLAY NOW</div>
                    </div>
                </div>
            `;
            // Safe native binding prevents string breaking
            document.getElementById(`hero-${containerId}`).onclick = () => window.V10Expansion.openGameLanding(gameName, type, playFn, desc, icon);
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
            } catch(e) { container.innerHTML = '<p style="color:red; text-align:center;">Error loading leaderboard.</p>'; }
        };
        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        await fetchAndRender('all_time', `ldr${typeCap}Container`);
        await fetchAndRender('last_week', `ldr${typeCap}LastWeekContainer`);
        await fetchAndRender('month', `ldr${typeCap}MonthContainer`);
    }
};

// ==============================================================================
// V8 ARCADE RE-INJECTION FOR TAB ROUTING
// ==============================================================================
window.V8Arcade = {
    switchTab: function(tab) {
        document.getElementById('arcadeGamesList').style.display = tab === 'games' ? 'block' : 'none';
        document.getElementById('arcadeLeaderboardView').style.display = tab === 'leaderboard' ? 'block' : 'none';
        document.getElementById('btnArcadeGames').classList.toggle('active', tab === 'games');
        const ldrBtn = document.getElementById('btnArcadeLeaderboard');
        if (ldrBtn) ldrBtn.classList.toggle('active', tab === 'leaderboard');
        if (tab === 'leaderboard') this.loadLeaderboard();
    },
    loadLeaderboard: async function() {
        const container = document.getElementById('arcadeLeaderboardContainer');
        if (!container) return;
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading ranks...</p>';
        try {
            const res = await fetch('/api/leaderboards/arcade/all_time');
            const data = await res.json();
            if (data.length === 0) return container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Leaderboard is empty. Play games to rank up! 🎮</div>';
            container.innerHTML = data.map((user, index) => {
                let rankIcon = `<span style="color: #64748B; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '🥇'; if (index === 1) rankIcon = '🥈'; if (index === 2) rankIcon = '🥉';
                const avatarHtml = user.profile_picture ? `<img src="${user.profile_picture}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">` : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #F3F4F6; color: #4B5563; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(user.name||'U').charAt(0).toUpperCase()}</div>`;
                return `<div style="${index===0?'background: #FFFBEB; border-color: #FDE68A;':'background: #FFFFFF; border-color: #E5E7EB;'} border-style: solid; border-width: 1px; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;"><div style="width: 30px; text-align: center;">${rankIcon}</div>${avatarHtml}<strong style="color: #0F172A; font-size: 1.05rem;">${user.name}</strong></div>
                    <div style="font-weight: 900; color: #2563EB; font-size: 1.15rem;">🎮 ${user.arcade_xp || 0} XP</div>
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
};

document.addEventListener('DOMContentLoaded', () => { window.V10Expansion.init(); });
