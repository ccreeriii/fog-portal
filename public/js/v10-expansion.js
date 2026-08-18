// ========== public/js/v10-expansion.js ==========
// FIRE OF GOD MINISTRIES - V10 EXPANSION (LEADERBOARDS, FEATURED, & NEW GAMES)

window.V10Expansion = {
    init: function() {
        console.log("🚀 V10 Expansion Module Initialized");
        this.hookNavigation();
        this.loadFeaturedGames(); // Trigger rendering immediately on load
        
        // Auto-load Leaderboards if that tab is opened
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
                
                // Auto-refresh the featured banners when switching to these tabs
                if (tabId === 'arcadeTab' || tabId === 'discipleshipTab') {
                    window.V10Expansion.loadFeaturedGames();
                }

                // 🛡️ NATIVE PATCH: Fix Admin Settings Visibility
                // Unhides the Global Settings / Featured Games Form for Admins on Profile Tab
                if (tabId === 'profileTab') {
                    const settingsCard = document.getElementById('adminSettingsCard');
                    if (settingsCard) {
                        if (currentUser === 'celsocreeriii@gmail.com' || (typeof window.hasPerm === 'function' && window.hasPerm('edit_entries'))) {
                            settingsCard.style.display = 'block';
                        } else {
                            settingsCard.style.display = 'none';
                        }
                    }
                }
            };
            window.switchTab.isV10Patched = true;

            // Immediately trigger tab logic if already on profile page during load
            if (document.getElementById('profileTab') && document.getElementById('profileTab').classList.contains('active')) {
                window.switchTab('profileTab');
            }
        }

        // Fetch settings for the Admin Form
        setTimeout(() => this.loadAdminFeaturedSettings(), 1000);
    },

    hookNavigation: function() {
        if (typeof window.buildNav === 'function') {
            const originalBuildNav = window.buildNav;
            window.buildNav = function() {
                originalBuildNav();
                
                // Inject Global Leaderboards Tab into Sidebar (Admins)
                const sidebar = document.getElementById('sidebarNav');
                if (sidebar && !document.getElementById('navBtnLeaderboards')) {
                    const worshipBtn = document.getElementById('navBtnWorship') || sidebar.querySelector('.text-danger');
                    if (worshipBtn) {
                        worshipBtn.insertAdjacentHTML('beforebegin', `<button id="navBtnLeaderboards" class="nav-btn" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')">🏆 Leaderboards</button>`);
                    }
                }

                // Inject Global Leaderboards Tab into Bottom Nav (Everyone)
                const bottomNav = document.getElementById('bottomNav');
                if (bottomNav && !document.getElementById('bottomNavLeaderboards')) {
                    const lastBtn = bottomNav.lastElementChild;
                    if (lastBtn) {
                        lastBtn.insertAdjacentHTML('beforebegin', `
                            <button id="bottomNavLeaderboards" class="bottom-nav-btn" data-target="leaderboardsHubTab" onclick="switchTab('leaderboardsHubTab')">
                                <div class="icon">🏆</div>Ranks
                            </button>
                        `);
                    }
                }
            };
            // Re-trigger build if user is already logged in
            if (typeof currentUser !== 'undefined' && currentUser) window.buildNav();
        }
    },

    // --------------------------------------------------------------------------
    // FEATURED GAMES ENGINE (HERO BANNER)
    // --------------------------------------------------------------------------
    loadAdminFeaturedSettings: async function() {
        if (!document.getElementById('setFeaturedArcade')) return;
        try {
            const res = await fetch('/api/settings/featured');
            const data = await res.json();
            if(data.featured_arcade) document.getElementById('setFeaturedArcade').value = data.featured_arcade;
            if(data.featured_growth) document.getElementById('setFeaturedGrowth').value = data.featured_growth;
        } catch(e) { console.error("Failed to load featured settings."); }
    },

    saveFeaturedGames: async function(e) {
        e.preventDefault();
        const arcade = document.getElementById('setFeaturedArcade').value;
        const growth = document.getElementById('setFeaturedGrowth').value;

        window.triggerActionConfirmation('Save these as the featured games?', async () => {
            try {
                const res = await fetch('/api/settings/featured', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ featured_arcade: arcade, featured_growth: growth, actor: currentUser })
                });
                if(res.ok) {
                    alert('Featured games updated! Changes apply immediately.');
                    window.V10Expansion.loadFeaturedGames();
                }
            } catch(e) { alert("Network Error"); }
        });
    },

    loadFeaturedGames: async function() {
        try {
            const res = await fetch('/api/settings/featured');
            const data = await res.json();
            
            // If the database is empty, force a default game so it is ALWAYS visible
            const arcadeGame = data.featured_arcade || "David's Slingshot";
            const growthGame = data.featured_growth || "Catechism Clash";

            this.renderFeaturedSlot('arcadeGridItems', 'featuredArcadeGameContainer', arcadeGame, false);
            this.renderFeaturedSlot('growthGamesGrid', 'featuredGrowthGameContainer', growthGame, true);
        } catch(e) { 
            console.error("Error rendering featured games.", e); 
        }
    },

    renderFeaturedSlot: function(gridId, containerId, gameName, isGrowth) {
        const container = document.getElementById(containerId);
        // Fallback for ID variance
        const grid = document.getElementById(gridId) || document.getElementById('arcadeGamesList'); 
        
        if (!container || !grid) return;

        // 🛡️ NATIVE PATCH: Reset all tiles in the grid to be visible first
        const allTiles = grid.querySelectorAll('.arcade-game-card, .arcade-game-tile');
        allTiles.forEach(t => t.style.display = 'flex');

        if (!gameName || gameName === "None") {
            container.innerHTML = '';
            return;
        }

        // Find the tile by its data attribute
        const tile = grid.querySelector(`[data-game-name="${gameName}"]`);
        
        if (tile) {
            // 🛡️ NATIVE PATCH: Hide the original tile from the grid to prevent redundancy
            tile.style.display = 'none';

            // Extract the core game details from the grid tile
            const iconElem = tile.querySelector('.game-tile-icon') || tile.querySelector('.game-icon');
            const titleElem = tile.querySelector('h3');
            const descElem = tile.querySelector('p');
            const onclickAction = tile.getAttribute('onclick');

            const icon = iconElem ? iconElem.innerHTML : '🎮';
            const title = titleElem ? titleElem.innerText : gameName;
            const desc = descElem ? descElem.innerText : 'Play our featured game!';

            // Determine gradient class: Growth is Green, Arcade is Orange
            const heroClass = isGrowth ? 'hero-game-card growth-hero' : 'hero-game-card';
            
            // Generate the massive Horizontal Hero Banner HTML
            container.innerHTML = `
                <h3 style="color: var(--text-main); font-size: 1.1rem; font-weight: 800; margin-bottom: 12px; border: none; padding: 0;">⭐ Featured Game</h3>
                <div class="${heroClass}" onclick="${onclickAction}">
                    <div class="game-icon">${icon}</div>
                    <div class="game-info">
                        <h3>${title}</h3>
                        <p>${desc}</p>
                        <div class="game-action">PLAY NOW</div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    },

    // --------------------------------------------------------------------------
    // GLOBAL SEGMENTED LEADERBOARDS
    // --------------------------------------------------------------------------
    switchLeaderboardTab: function(tab) {
        document.getElementById('ldrOverallView').style.display = tab === 'overall' ? 'block' : 'none';
        document.getElementById('ldrGrowthView').style.display = tab === 'growth' ? 'block' : 'none';
        document.getElementById('ldrArcadeView').style.display = tab === 'arcade' ? 'block' : 'none';

        document.getElementById('btnLdrOverall').classList.toggle('active', tab === 'overall');
        document.getElementById('btnLdrGrowth').classList.toggle('active', tab === 'growth');
        document.getElementById('btnLdrArcade').classList.toggle('active', tab === 'arcade');
    },

    loadSegmentedLeaderboard: async function(type) {
        const containerId = type === 'overall' ? 'ldrOverallContainer' : type === 'growth' ? 'ldrGrowthContainer' : 'ldrArcadeContainer';
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const res = await fetch(`/api/gamification/leaderboard/${type}`);
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No points earned yet.</p>';
                return;
            }

            container.innerHTML = data.map((user, index) => {
                let rankIcon = `<span style="color: #64748B; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '🥇';
                if (index === 1) rankIcon = '🥈';
                if (index === 2) rankIcon = '🥉';

                const avatar = user.profile_picture ? `<img src="${user.profile_picture}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<div style="width:40px; height:40px; border-radius:50%; background:#E2E8F0; display:flex; align-items:center; justify-content:center; font-weight:bold;">${user.name.charAt(0)}</div>`;
                
                // Determine which metric to highlight based on the active tab
                let scoreText = '';
                if (type === 'overall') scoreText = `⭐ ${user.points} XP`;
                if (type === 'growth') scoreText = `🌱 ${user.growth_xp} XP`;
                if (type === 'arcade') scoreText = `🎮 ${user.arcade_xp} XP`;

                const highlightColor = type === 'overall' ? '#D97706' : type === 'growth' ? '#059669' : '#2563EB';
                const bg = index === 0 ? '#FEF3C7' : '#FFFFFF';

                return `
                <div style="background: ${bg}; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 30px; text-align: center; font-size: 1.2rem;">${rankIcon}</div>
                        ${avatar}
                        <strong style="color: #0F172A; font-size: 1.05rem;">${user.name}</strong>
                    </div>
                    <div style="font-weight: 900; color: ${highlightColor}; font-size: 1.15rem;">
                        ${scoreText}
                    </div>
                </div>`;
            }).join('');
        } catch(e) { container.innerHTML = '<p style="color:red;">Error loading leaderboard.</p>'; }
    },

    // --------------------------------------------------------------------------
    // SHARED GAME ENGINE HELPER
    // --------------------------------------------------------------------------
    mountGameUI: function(htmlContent) {
        document.getElementById('growthGamesGrid').style.display = 'none';
        
        // Hide the featured container to clear up screen space while playing
        const featuredSlot = document.getElementById('featuredGrowthGameContainer');
        if (featuredSlot) featuredSlot.style.display = 'none';

        const area = document.getElementById('growthActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = htmlContent;
    },

    exitGame: function(timerRef) {
        if (timerRef) clearInterval(timerRef);
        document.getElementById('growthActiveGameArea').style.display = 'none';
        document.getElementById('growthActiveGameArea').innerHTML = '';
        document.getElementById('growthGamesGrid').style.display = 'grid';
        
        // Bring back the featured banner
        const featuredSlot = document.getElementById('featuredGrowthGameContainer');
        if (featuredSlot) featuredSlot.style.display = 'block';
    },

    submitGrowthScore: async function(endpoint, payload, onSuccess) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success || data.pointsAwarded !== undefined) {
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (onSuccess) onSuccess(data);
            } else {
                alert(data.error || "Failed to save progress.");
            }
        } catch(e) { alert("Network Error."); }
    },

    // --------------------------------------------------------------------------
    // GAME 6: DAILY MANNA SCRAMBLE
    // --------------------------------------------------------------------------
    vsState: {
        gameId: null,
        words: [],
        currentOrder: [],
        correctOrder: [],
    },

    mountVerseScramble: async function() {
        if (!currentMember || !currentMember.id) return alert("Please log in.");
        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame()">🔙 Exit</button>
                <div style="color: #0D9488; font-weight: bold; font-size: 0.9rem;">🧩 Verse Scramble</div>
            </div>
            <div id="vsGameBody" style="background: #FFF; padding: 25px 15px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 300px;">
                <p>Loading puzzle...</p>
            </div>
        `);

        try {
            const res = await fetch('/api/growth-games/verse-scramble');
            const data = await res.json();
            if (!data) return document.getElementById('vsGameBody').innerHTML = "<p>No scrambles available.</p>";

            this.vsState.gameId = data.id;
            this.vsState.correctOrder = data.verse_text.split(' ');
            
            // Shuffle
            this.vsState.words = [...this.vsState.correctOrder];
            for (let i = this.vsState.words.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.vsState.words[i], this.vsState.words[j]] = [this.vsState.words[j], this.vsState.words[i]];
            }
            this.vsState.currentOrder = [];

            this.renderVerseScramble(data.reference);
        } catch(e) { document.getElementById('vsGameBody').innerHTML = "<p>Error loading.</p>"; }
    },

    renderVerseScramble: function(reference) {
        const body = document.getElementById('vsGameBody');
        
        // Built Box
        let builtHtml = `<div style="min-height: 80px; padding: 15px; background: #F0FDFA; border: 2px dashed #14B8A6; border-radius: 8px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;">`;
        if (this.vsState.currentOrder.length === 0) builtHtml += `<span style="color:#99F6E4;">Tap words below to build the verse...</span>`;
        this.vsState.currentOrder.forEach((w, idx) => {
            builtHtml += `<button class="btn btn-primary btn-sm" style="background: #0D9488;" onclick="V10Expansion.vsRemoveWord(${idx})">${w}</button>`;
        });
        builtHtml += `</div>`;

        // Available Box
        let bankHtml = `<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 20px;">`;
        this.vsState.words.forEach((w, idx) => {
            bankHtml += `<button class="btn btn-outline btn-sm" style="border-color: #0D9488; color: #0D9488;" onclick="V10Expansion.vsAddWord(${idx})">${w}</button>`;
        });
        bankHtml += `</div>`;

        body.innerHTML = `
            <h3 style="color: #0F172A; margin-bottom: 5px;">${reference}</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">Unscramble the verse to earn +15 XP!</p>
            ${builtHtml}
            ${bankHtml}
            <button class="btn btn-primary" style="width:100%; background: #0F172A;" onclick="V10Expansion.vsCheckAnswer()">Check Answer</button>
            <p id="vsStatus" style="margin-top:15px; font-weight:bold;"></p>
        `;
    },

    vsAddWord: function(index) {
        const word = this.vsState.words.splice(index, 1)[0];
        this.vsState.currentOrder.push(word);
        this.renderVerseScramble(document.querySelector('#vsGameBody h3').innerText);
    },

    vsRemoveWord: function(index) {
        const word = this.vsState.currentOrder.splice(index, 1)[0];
        this.vsState.words.push(word);
        this.renderVerseScramble(document.querySelector('#vsGameBody h3').innerText);
    },

    vsCheckAnswer: function() {
        const status = document.getElementById('vsStatus');
        if (this.vsState.words.length > 0) {
            status.style.color = 'var(--danger)';
            status.innerText = "Use all the words first!";
            return;
        }

        const current = this.vsState.currentOrder.join(' ');
        const correct = this.vsState.correctOrder.join(' ');

        if (current === correct) {
            status.style.color = 'var(--success)';
            status.innerText = "Perfect! Saving score...";
            this.submitGrowthScore('/api/growth-games/verse-scramble/submit', {
                youth_id: currentMember.id,
                game_id: this.vsState.gameId,
                actor: currentUser
            }, (data) => {
                status.innerText = `🎉 Success! +${data.pointsAwarded} Growth XP.`;
            });
        } else {
            status.style.color = 'var(--danger)';
            status.innerText = "Not quite right. Tap words in the top box to remove them and try again.";
        }
    },

    // --------------------------------------------------------------------------
    // GAME 7: SHIELD OF FAITH (REFLEX TAP)
    // --------------------------------------------------------------------------
    rxState: {
        timerId: null,
        timeLeft: 10,
        sequence: [],
        playerStep: 0,
        armor: ["Belt of Truth", "Breastplate of Righteousness", "Shoes of Peace", "Shield of Faith", "Helmet of Salvation", "Sword of the Spirit"]
    },

    mountReflexTap: function() {
        if (!currentMember || !currentMember.id) return alert("Please log in.");
        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame(V10Expansion.rxState.timerId)">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">🛡️ <span id="rxTimer">10.0</span>s</div>
            </div>
            <div id="rxGameBody" style="background: #FFF; padding: 25px 15px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 350px;">
                <h2 style="color: #F59E0B; margin-bottom: 10px; border:none;">Armor of God Reflex</h2>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">Memorize the sequence, then tap them in exact order before time runs out!</p>
                <button class="btn btn-primary" style="background: #F59E0B; width:100%; padding: 15px; font-size: 1.1rem;" onclick="V10Expansion.rxStartSequence()">Start Training</button>
            </div>
        `);
    },

    rxStartSequence: function() {
        this.rxState.sequence = [];
        const available = [...this.rxState.armor];
        for(let i=0; i<3; i++) {
            const r = Math.floor(Math.random() * available.length);
            this.rxState.sequence.push(available.splice(r, 1)[0]);
        }
        
        const body = document.getElementById('rxGameBody');
        body.innerHTML = `<h3 style="color:#0F172A;">Memorize this:</h3>
                          <div style="font-size:1.2rem; color:#F59E0B; margin: 20px 0; font-weight:bold;">
                            1. ${this.rxState.sequence[0]}<br><br>
                            2. ${this.rxState.sequence[1]}<br><br>
                            3. ${this.rxState.sequence[2]}
                          </div>
                          <p style="color:var(--text-muted);">Get ready... hiding in 4 seconds!</p>`;
        
        setTimeout(() => this.rxStartGameplay(), 4000);
    },

    rxStartGameplay: function() {
        this.rxState.playerStep = 0;
        this.rxState.timeLeft = 100; // 10.0 seconds stored as deci-seconds

        let buttonsHtml = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;
        const shuffledButtons = [...this.rxState.armor].sort(() => Math.random() - 0.5);
        shuffledButtons.forEach(a => {
            buttonsHtml += `<button class="btn btn-outline" style="padding:15px 5px; font-size:0.85rem; height:100%; white-space:normal; line-height:1.2; border-color:#CBD5E1;" onclick="V10Expansion.rxTap('${a}', this)">${a}</button>`;
        });
        buttonsHtml += `</div>`;

        document.getElementById('rxGameBody').innerHTML = `
            <h3 style="color:#0F172A; margin-bottom: 20px;">Tap Item #${this.rxState.playerStep + 1}!</h3>
            ${buttonsHtml}
            <p id="rxStatus" style="margin-top:15px; font-weight:bold;"></p>
        `;

        this.rxState.timerId = setInterval(() => {
            this.rxState.timeLeft--;
            document.getElementById('rxTimer').innerText = (this.rxState.timeLeft / 10).toFixed(1);
            if(this.rxState.timeLeft <= 0) {
                clearInterval(this.rxState.timerId);
                this.rxEndGame(false, "Time's Up!");
            }
        }, 100);
    },

    rxTap: function(armorName, btnElem) {
        const expected = this.rxState.sequence[this.rxState.playerStep];
        
        if (armorName === expected) {
            btnElem.style.background = '#10B981';
            btnElem.style.color = '#FFF';
            btnElem.disabled = true;
            this.rxState.playerStep++;

            if (this.rxState.playerStep >= 3) {
                clearInterval(this.rxState.timerId);
                this.rxEndGame(true, "Perfect Reflexes!");
            } else {
                document.querySelector('#rxGameBody h3').innerText = `Tap Item #${this.rxState.playerStep + 1}!`;
            }
        } else {
            clearInterval(this.rxState.timerId);
            btnElem.style.background = '#EF4444';
            btnElem.style.color = '#FFF';
            this.rxEndGame(false, "Wrong Item!");
        }
    },

    rxEndGame: function(isWin, msg) {
        document.getElementById('rxGameBody').innerHTML = `
            <h2 style="color: ${isWin ? '#10B981' : '#EF4444'}; font-size: 1.8rem; border:none;">${msg}</h2>
            <p id="rxSubmitStatus" style="margin-top: 15px;">Saving result...</p>
            <button class="btn btn-primary" style="margin-top: 20px; width:100%; display:none;" id="rxExitBtn" onclick="V10Expansion.exitGame()">Exit</button>
        `;

        this.submitGrowthScore('/api/growth-games/reflex/submit', {
            youth_id: currentMember.id,
            success: isWin,
            actor: currentUser
        }, (data) => {
            document.getElementById('rxSubmitStatus').innerText = isWin ? `+${data.pointsAwarded} XP Earned!` : `Training Failed. Try again tomorrow.`;
            document.getElementById('rxExitBtn').style.display = 'block';
        });
    },

    // --------------------------------------------------------------------------
    // GAME 8: THE NARROW GATE (Sudden Death Survival)
    // --------------------------------------------------------------------------
    ngState: {
        questions: [],
        currentIndex: 0,
        streak: 0
    },

    mountNarrowGate: async function() {
        if (!currentMember || !currentMember.id) return alert("Please log in.");
        this.mountGameUI(`
            <div style="padding: 15px; background: #111827; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" style="color:#FFF; border-color:#374151;" onclick="V10Expansion.exitGame()">🔙 Exit</button>
                <div style="color: #FFF; font-weight: bold; font-size: 0.9rem;">🚪 The Narrow Gate</div>
            </div>
            <div id="ngGameBody" style="background: #1F2937; color: #FFF; padding: 30px 20px; border-radius: 0 0 12px 12px; text-align: center; min-height: 300px;">
                <h2 style="color: #F87171; font-size: 1.8rem; margin-bottom: 10px; border: none;">Sudden Death</h2>
                <p style="color: #9CA3AF; font-size: 0.95rem; margin-bottom: 20px;">
                    One wrong answer ends the run. How long can you survive?
                </p>
                <button class="btn btn-danger" style="width: 100%; max-width: 250px; font-size: 1.1rem; padding: 15px;" onclick="V10Expansion.ngStart()">▶ ENTER THE GATE</button>
            </div>
        `);
    },

    ngStart: async function() {
        try {
            const res = await fetch('/api/growth-games/narrow-gate');
            const data = await res.json();
            if (!data || data.length === 0) return document.getElementById('ngGameBody').innerHTML = "<p>No questions available.</p>";

            this.ngState.questions = data;
            this.ngState.currentIndex = 0;
            this.ngState.streak = 0;
            this.ngRenderQuestion();
        } catch(e) { alert("Network Error"); }
    },

    ngRenderQuestion: function() {
        if (this.ngState.currentIndex >= this.ngState.questions.length) {
            return this.ngEndGame("YOU BEAT THE GAME!");
        }

        const q = this.ngState.questions[this.ngState.currentIndex];
        let options = [];
        try { options = JSON.parse(q.options); } catch(e) { options = ["A", "B", "C", "D"]; }

        let html = `
            <div style="color: #10B981; font-weight: 900; font-size: 1.2rem; margin-bottom: 20px; text-transform: uppercase;">
                🔥 Streak: ${this.ngState.streak}
            </div>
            <h3 style="font-size: 1.2rem; color: #F9FAFB; margin-bottom: 25px; line-height: 1.4;">${q.question}</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        options.forEach((opt, idx) => {
            html += `<button class="btn btn-outline" style="text-align: left; padding: 15px; font-size: 1rem; border-color: #374151; color: #E5E7EB; background: #111827;" onclick="V10Expansion.ngAnswer(${idx}, ${q.correct_index}, this)">${opt}</button>`;
        });
        html += `</div>`;
        document.getElementById('ngGameBody').innerHTML = html;
    },

    ngAnswer: function(selected, correct, btnElem) {
        if (selected === correct) {
            this.ngState.streak++;
            btnElem.style.background = '#10B981';
            btnElem.style.borderColor = '#10B981';
            setTimeout(() => {
                this.ngState.currentIndex++;
                this.ngRenderQuestion();
            }, 600);
        } else {
            btnElem.style.background = '#EF4444';
            btnElem.style.borderColor = '#EF4444';
            setTimeout(() => this.ngEndGame("YOU DIED."), 800);
        }
    },

    ngEndGame: function(msg) {
        document.getElementById('ngGameBody').innerHTML = `
            <h2 style="color: #F87171; font-size: 2rem; border:none; margin-bottom: 10px;">${msg}</h2>
            <p style="color: #9CA3AF; margin-bottom: 20px;">Final Streak: <span style="color:#FFF; font-weight:bold; font-size:1.2rem;">${this.ngState.streak}</span></p>
            <p id="ngStatus" style="color: #F59E0B;">Saving record...</p>
            <button class="btn btn-outline" style="color:#FFF; border-color:#374151; margin-top:20px; width:100%; display:none;" id="ngExitBtn" onclick="V10Expansion.exitGame()">Exit to Arcade</button>
        `;

        if (this.ngState.streak > 0) {
            this.submitGrowthScore('/api/growth-games/narrow-gate/submit', {
                youth_id: currentMember.id,
                streak: this.ngState.streak,
                actor: currentUser
            }, (data) => {
                document.getElementById('ngStatus').innerText = `Saved! +${data.pointsAwarded} Growth XP Earned.`;
                document.getElementById('ngStatus').style.color = '#10B981';
                document.getElementById('ngExitBtn').style.display = 'block';
            });
        } else {
            document.getElementById('ngStatus').innerText = "No streak achieved. 0 XP.";
            document.getElementById('ngExitBtn').style.display = 'block';
        }
    },

    // --------------------------------------------------------------------------
    // GAME 9: EMOJI TRANSLATOR
    // --------------------------------------------------------------------------
    mountEmojiTranslator: async function() {
        if (!currentMember || !currentMember.id) return alert("Please log in.");
        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">😂 Emoji Translator</div>
            </div>
            <div id="emGameBody" style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 250px;">
                <p>Loading emojis...</p>
            </div>
        `);

        try {
            const res = await fetch('/api/growth-games/emoji');
            const data = await res.json();
            if(!data) return document.getElementById('emGameBody').innerHTML = "<p>No puzzles right now.</p>";

            let options = JSON.parse(data.options);
            let html = `
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 20px;">Translate the Bible story to earn +10 XP!</p>
                <div style="font-size: 3.5rem; letter-spacing: 5px; margin-bottom: 30px;">${data.emojis}</div>
                <div style="display:flex; flex-direction:column; gap:10px;">
            `;
            options.forEach(opt => {
                html += `<button class="btn btn-outline" style="border-color:#F43F5E; color:#E11D48; padding:15px; font-weight:bold; font-size:1rem;" onclick="V10Expansion.emSubmit('${data.id}', '${opt.replace(/'/g, "\\'")}', '${data.answer.replace(/'/g, "\\'")}', this)">${opt}</button>`;
            });
            html += `</div><p id="emStatus" style="margin-top:15px; font-weight:bold;"></p>`;
            
            document.getElementById('emGameBody').innerHTML = html;
        } catch(e) { document.getElementById('emGameBody').innerHTML = "<p>Network Error</p>"; }
    },

    emSubmit: function(gameId, guess, correct, btnElem) {
        if(guess === correct) {
            btnElem.style.background = '#10B981';
            btnElem.style.color = '#FFF';
            btnElem.style.borderColor = '#10B981';
            document.getElementById('emStatus').style.color = '#10B981';
            document.getElementById('emStatus').innerText = "Correct! Saving...";
            
            this.submitGrowthScore('/api/growth-games/emoji/submit', {
                youth_id: currentMember.id, game_id: gameId, actor: currentUser
            }, (data) => { document.getElementById('emStatus').innerText = `+${data.pointsAwarded} XP!`; });
        } else {
            btnElem.style.background = '#EF4444';
            btnElem.style.color = '#FFF';
            document.getElementById('emStatus').style.color = '#EF4444';
            document.getElementById('emStatus').innerText = "Wrong answer. Read the emojis carefully!";
        }
    },

    // --------------------------------------------------------------------------
    // GAME 10: PROPHETS & PARABLES WORD MATRIX (Mini Crossword)
    // --------------------------------------------------------------------------
    cwState: {
        gameId: null,
        gridSize: 5,
        words: []
    },

    mountCrossword: async function() {
        if (!currentMember || !currentMember.id) return alert("Please log in.");
        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">📝 Word Matrix</div>
            </div>
            <div id="cwGameBody" style="background: #FFF; padding: 20px 10px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 400px; overflow-x: auto;">
                <p>Generating Matrix...</p>
            </div>
        `);

        try {
            const res = await fetch('/api/growth-games/crossword');
            const data = await res.json();
            if(!data) return document.getElementById('cwGameBody').innerHTML = "<p>No matrix available today.</p>";

            this.cwState.gameId = data.id;
            this.cwState.gridSize = data.grid_size;
            this.cwState.words = JSON.parse(data.words_json);
            this.cwRenderGrid();
        } catch(e) { document.getElementById('cwGameBody').innerHTML = "<p>Network Error</p>"; }
    },

    cwRenderGrid: function() {
        const size = this.cwState.gridSize;
        // Create 2D arrays for answers
        let answerGrid = Array(size).fill(null).map(() => Array(size).fill(''));
        
        // Plot words
        this.cwState.words.forEach(w => {
            let r = w.row, c = w.col;
            for(let i=0; i<w.word.length; i++) {
                answerGrid[r][c] = w.word[i];
                if(w.dir === 'H') c++; else r++;
            }
        });

        let tableHtml = `<table style="border-collapse: collapse; margin: 0 auto; background: #0F172A; border: 2px solid #0F172A;">`;
        for(let r=0; r<size; r++) {
            tableHtml += `<tr>`;
            for(let c=0; c<size; c++) {
                if(answerGrid[r][c] !== '') {
                    // Editable White Cell
                    tableHtml += `<td style="border: 1px solid #94A3B8; width: 45px; height: 45px; background: #FFF; padding: 0;">
                        <input type="text" id="cwCell_${r}_${c}" data-ans="${answerGrid[r][c]}" maxlength="1" style="width:100%; height:100%; border:none; text-align:center; font-size:1.2rem; font-weight:bold; text-transform:uppercase; outline:none; background:transparent;">
                    </td>`;
                } else {
                    // Blocked Dark Cell
                    tableHtml += `<td style="border: 1px solid #334155; width: 45px; height: 45px; background: #1E293B;"></td>`;
                }
            }
            tableHtml += `</tr>`;
        }
        tableHtml += `</table>`;

        let cluesHtml = `<div style="text-align: left; margin-top: 20px; font-size: 0.9rem; color: #4B5563; background: #F8FAFC; padding: 15px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <strong style="color:#7C3AED;">Clues:</strong><ul style="padding-left: 20px; margin-top: 5px; line-height:1.6;">`;
        this.cwState.words.forEach(w => {
            cluesHtml += `<li><strong>${w.dir === 'H' ? 'Across' : 'Down'}:</strong> ${w.clue}</li>`;
        });
        cluesHtml += `</ul></div>`;

        document.getElementById('cwGameBody').innerHTML = `
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Fill the matrix correctly to earn +25 Growth XP!</p>
            ${tableHtml}
            ${cluesHtml}
            <button class="btn btn-primary" style="background:#7C3AED; width:100%; margin-top:20px;" onclick="V10Expansion.cwCheck()">Check Answers</button>
            <p id="cwStatus" style="margin-top:15px; font-weight:bold;"></p>
        `;
    },

    cwCheck: function() {
        const size = this.cwState.gridSize;
        let isCorrect = true;
        let isComplete = true;

        for(let r=0; r<size; r++) {
            for(let c=0; c<size; c++) {
                const input = document.getElementById(`cwCell_${r}_${c}`);
                if(input) {
                    const expected = input.getAttribute('data-ans').toUpperCase();
                    const actual = input.value.trim().toUpperCase();
                    
                    if (actual === '') { isComplete = false; }
                    else if (actual !== expected) { isCorrect = false; input.style.color = '#EF4444'; }
                    else { input.style.color = '#10B981'; }
                }
            }
        }

        const status = document.getElementById('cwStatus');
        if (!isComplete) {
            status.style.color = '#F59E0B'; status.innerText = "Please fill in all empty white boxes first.";
        } else if (!isCorrect) {
            status.style.color = '#EF4444'; status.innerText = "Some letters are incorrect. Keep trying!";
        } else {
            status.style.color = '#10B981'; status.innerText = "Matrix Solved! Saving progress...";
            this.submitGrowthScore('/api/growth-games/crossword/submit', {
                youth_id: currentMember.id, game_id: this.cwState.gameId, actor: currentUser
            }, (data) => {
                status.innerText = `🎉 Brilliant! +${data.pointsAwarded} Growth XP Earned!`;
                // Disable inputs
                for(let r=0; r<size; r++) {
                    for(let c=0; c<size; c++) {
                        const input = document.getElementById(`cwCell_${r}_${c}`);
                        if(input) input.disabled = true;
                    }
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.V10Expansion.init();
});
