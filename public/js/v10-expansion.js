// ========== public/js/v10-expansion.js ==========
// FIRE OF GOD MINISTRIES - V11 GAME ENGINE

window.V10Expansion = {
    bulkDataCache: {},
    gameNames: ["David's Slingshot", "Noah's Ark: Rescue", "Moses' Red Sea Dash", "Peter's Leap of Faith", "Jonah's Deep Sea Dive", "Jericho: Walls Fall", "Fishers of Men: Perfect Cast", "Zacchaeus: Tree Climb", "Lost Sheep: Shepherd's Search", "Declaration Quest", "Catechism Clash", "Daily Manna Scramble", "Emoji Sermon Translator", "The Narrow Gate", "Shield of Faith: Reflex Tap"],

    arcadeFunFacts: Object.freeze({
        "David's Slingshot": Object.freeze({
            text: 'David chose five smooth stones from the stream. The first recorded stone he slung struck Goliath in the forehead.',
            reference: '1 Samuel 17:40, 49'
        }),
        "Noah's Ark: Rescue": Object.freeze({
            text: 'After the flood, God set the rainbow in the clouds as the sign of his covenant with Noah and every living creature.',
            reference: 'Genesis 9:12–17'
        }),
        "Moses' Red Sea Dash": Object.freeze({
            text: 'The Israelites crossed the sea on dry ground, with the waters described as walls on their right and left.',
            reference: 'Exodus 14:21–22'
        }),
        "Peter's Leap of Faith": Object.freeze({
            text: 'Peter stepped out of the boat and walked on the water toward Jesus. When he began to sink, Jesus immediately reached out his hand.',
            reference: 'Matthew 14:28–31'
        }),
        "Jonah's Deep Sea Dive": Object.freeze({
            text: 'The Book of Jonah says that the Lord provided a great fish to swallow Jonah. The biblical text itself does not call it a whale.',
            reference: 'Jonah 1:17'
        }),
        'Jericho: Walls Fall': Object.freeze({
            text: 'For six days Israel marched around Jericho once each day. On the seventh day they marched around it seven times; after the trumpets sounded and the people shouted, the wall fell.',
            reference: 'Joshua 6:3–5, 15–20'
        }),
        'Fishers of Men: Perfect Cast': Object.freeze({
            text: 'Jesus called Peter and Andrew while they were casting a net into the Sea of Galilee and invited them to become fishers of people.',
            reference: 'Matthew 4:18–19'
        }),
        'Zacchaeus: Tree Climb': Object.freeze({
            text: 'Zacchaeus climbed a sycamore-fig tree because he was short and could not see Jesus over the crowd.',
            reference: 'Luke 19:3–4'
        }),
        "Lost Sheep: Shepherd's Search": Object.freeze({
            text: 'In Jesus\' parable, the shepherd leaves the ninety-nine and searches for the one lost sheep until he finds it. When he finds it, he joyfully carries it home and invites others to rejoice with him.',
            reference: 'Luke 15:4–6'
        })
    }),

    funFactDismissTimers: new WeakMap(),

    escapeLeaderboardText: function(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    safeLeaderboardAvatar: function(value) {
        if (typeof value !== 'string' || !value || value.length > 2048) return '';
        try {
            const parsed = new URL(value, window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return this.escapeLeaderboardText(parsed.href);
        } catch (error) {
            return '';
        }
    },

    init: function() {
        this.hookNavigation();
        this.switchGamesSegment('faith');
        this.loadEconomyStatus();
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
                if (tabId === 'arcadeTab') {
                    window.V10Expansion.loadFeaturedGames();
                    window.V10Expansion.loadEconomyStatus();
                    window.V10Expansion.filterGrowthGames('indiv');
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

    switchGamesSegment: function(segment) {
        const faith = segment !== 'arcade';
        const faithPanel = document.getElementById('gamesFaithQuestPanel');
        const arcadePanel = document.getElementById('gamesArcadePanel');
        const faithBtn = document.getElementById('gamesSegmentFaith');
        const arcadeBtn = document.getElementById('gamesSegmentArcade');
        if (faithPanel) faithPanel.hidden = !faith;
        if (arcadePanel) arcadePanel.hidden = faith;
        if (faithBtn) {
            faithBtn.classList.toggle('active', faith);
            faithBtn.setAttribute('aria-selected', String(faith));
        }
        if (arcadeBtn) {
            arcadeBtn.classList.toggle('active', !faith);
            arcadeBtn.setAttribute('aria-selected', String(!faith));
        }
        if (faith) this.filterGrowthGames('indiv');
        this.loadEconomyStatus();
    },

    loadEconomyStatus: async function() {
        try {
            const response = await fetch('/api/games/economy-status');
            if (!response.ok) return;
            const data = await response.json();
            [['growth', 'growthGameLpToday', 'growthGameLpStatus'], ['arcade', 'arcadeLpToday', 'arcadeLpStatus']].forEach(([key, valueId, statusId]) => {
                const economy = data[key] || {};
                const earned = Number(economy.dailyLifePoints) || 0;
                const cap = Number(economy.dailyCap) || (key === 'arcade' ? 20 : 25);
                const value = document.getElementById(valueId);
                const status = document.getElementById(statusId);
                if (value) value.textContent = String(earned);
                if (status) status.textContent = economy.capReached ? 'Daily Life Point cap reached — keep playing to improve your score and rank.' : `${Math.max(0, cap - earned)} Life Points still available today.`;
            });
        } catch (error) {
            // The page remains playable if the status meter cannot refresh.
        }
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
            if (tile.dataset.featuredGame === 'true') tile.style.display = 'none';
            else if (category === 'indiv' && tile.classList.contains('growth-game-indiv')) tile.style.display = 'flex';
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
        if(gameName === 'Jericho: Walls Fall') return 'V10Expansion.autoStartArcade("V11Jericho")';
        if(gameName === 'Fishers of Men: Perfect Cast') return 'V10Expansion.autoStartArcade("V12Fishers")';
        if(gameName === 'Zacchaeus: Tree Climb') return 'V10Expansion.autoStartArcade("V13Zacchaeus")';
        if(gameName === "Lost Sheep: Shepherd's Search") return 'V10Expansion.autoStartArcade("V14LostSheep")';
        if(gameName === 'Declaration Quest') return 'V15DeclarationQuest.startGame()';
        if(gameName === 'Catechism Clash') return 'V10Expansion.playCC()';
        if(gameName === 'Who Am I?') return 'V10Expansion.playWAI()';
        if(gameName === 'Daily Manna Scramble') return 'V10Expansion.playVS()';
        if(gameName === 'Emoji Sermon Translator') return 'V10Expansion.playEM()';
        if(gameName === 'The Narrow Gate') return 'V10Expansion.playNG()';
        if(gameName === 'Shield of Faith: Reflex Tap') return 'V10Expansion.playRX()';
        return '';
    },
    rankLabel: function(rank, rows, isTied) {
        if (!rank) return 'Unranked';
        const tied = Boolean(isTied) || (rows || []).filter(row => Number(row.rank) === Number(rank)).length > 1;
        return `${tied ? 'T-' : '#'}${rank}`;
    },

    renderLeaderboardRows: function(rows, limit) {
        const visible = (rows || []).slice(0, limit || 10);
        if (!visible.length) return '<p class="game-empty-state">No scores yet. Be the first!</p>';
        return visible.map(row => {
            const name = this.escapeLeaderboardText(row.name || 'Member');
            const score = Number(row.high_score) || 0;
            const rank = this.rankLabel(row.rank, rows);
            const avatarUrl = this.safeLeaderboardAvatar(row.profile_picture);
            const avatar = avatarUrl ? `<img class="game-rank-avatar" src="${avatarUrl}" alt="">` : `<span class="game-rank-avatar game-rank-initial">${name.charAt(0)}</span>`;
            return `<div class="game-rank-row"><span class="game-rank-position">${rank}</span>${avatar}<span class="game-rank-name">${name}</span><strong>${score.toLocaleString()} score</strong></div>`;
        }).join('');
    },

    getLeaderboardBundle: async function(gameName) {
        if (this.bulkDataCache[gameName]) return this.bulkDataCache[gameName];
        const response = await fetch(`/api/games/leaderboard/${encodeURIComponent(gameName)}?limit=10`);
        if (!response.ok) throw new Error('Unable to load rankings');
        const data = await response.json();
        this.bulkDataCache[gameName] = data;
        return data;
    },

    loadTopScorers: async function() {
        try {
            this.bulkDataCache = {};

            /*
             * Browse cards for both FOG Arcade and
             * Faith Quest / Growth games.
             */
            const cards =
                Array.from(
                    document.querySelectorAll(
                        '.arcade-game-card, .arcade-game-tile'
                    )
                );

            const gameNames =
                Array.from(
                    new Set(
                        cards
                            .map(
                                card =>
                                    card.getAttribute(
                                        'data-game-name'
                                    )
                            )
                            .filter(Boolean)
                    )
                );

            await Promise.all(
                gameNames.map(
                    async gameName => {
                        try {
                            await this.getLeaderboardBundle(
                                gameName
                            );
                        } catch (error) {
                            /*
                             * Non-competitive community cards
                             * simply do not show Top 3.
                             */
                        }
                    }
                )
            );

            cards.forEach(
                card => {
                    const gameName =
                        card.getAttribute(
                            'data-game-name'
                        );

                    const bundle =
                        this.bulkDataCache[
                            gameName
                        ];

                    /*
                     * Featured uses its own renderer and
                     * continues showing the FULL NAME.
                     *
                     * This block is only for the two-column
                     * browse/grid cards below Featured.
                     */
                    if (
                        !gameName
                        || !bundle
                        || !(
                            bundle.leaderboard
                            || []
                        ).length
                        || card.classList.contains(
                            'arcade-featured-game'
                        )
                    ) {
                        return;
                    }

                    const old =
                        card.querySelector(
                            '.top-scorers-container'
                        );

                    if (old) {
                        old.remove();
                    }

                    const rows =
                        bundle.leaderboard
                        || [];

                    const topPlayers =
                        rows.slice(0, 3);

                    const topHtml =
                        topPlayers.map(
                            row => {
                                const rank =
                                    Number(
                                        row.rank
                                    ) || 0;

                                const medal =
                                    rank === 1
                                        ? '🥇'
                                        : rank === 2
                                            ? '🥈'
                                            : rank === 3
                                                ? '🥉'
                                                : '🏅';

                                const rankText =
                                    this.rankLabel(
                                        rank,
                                        rows
                                    );

                                /*
                                 * Keep full name available for
                                 * tooltip/accessibility, but show
                                 * only the first name in compact
                                 * two-column browse cards.
                                 */
                                const rawFullName =
                                    String(
                                        row.name
                                        || 'Member'
                                    ).trim();

                                const fullName =
                                    this.escapeLeaderboardText(
                                        rawFullName
                                        || 'Member'
                                    );

                                const rawFirstName =
                                    (
                                        rawFullName
                                            .split(/\s+/)[0]
                                        || 'Member'
                                    );

                                const firstName =
                                    this.escapeLeaderboardText(
                                        rawFirstName
                                    );

                                return `
                                    <span
                                        class="top-scorer-player top-scorer-player--compact"
                                        title="${rankText} — ${fullName}"
                                        aria-label="${rankText} ${fullName}"
                                    >
                                        <span
                                            class="top-scorer-medal"
                                            aria-hidden="true"
                                        >${medal}</span>

                                        <span
                                            class="top-scorer-rank"
                                        >${rankText}</span>

                                        <span
                                            class="top-scorer-name"
                                        >${firstName}</span>
                                    </span>
                                `;
                            }
                        ).join('');

                    const html = `
                        <div
                            class="
                                top-scorers-container
                                top-scorers-container--tile
                            "
                            aria-label="Top 3 players"
                        >
                            ${topHtml}
                        </div>
                    `;

                    const action =
                        card.querySelector(
                            '.game-action'
                        )
                        || card.querySelector(
                            '.game-tile-action'
                        );

                    if (action) {
                        action.insertAdjacentHTML(
                            'beforebegin',
                            html
                        );
                    }
                }
            );
        } catch (error) {
            console.error(
                'Game rankings error',
                error
            );
        }
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
        if (typeof currentUser === 'undefined' || !currentUser) return alert('Please log in to play!');
        const listId = type === 'growth' ? 'growthGamesGrid' : 'arcadeGridItems';
        const fSlotId = type === 'growth' ? 'featuredGrowthGameContainer' : 'featuredArcadeGameContainer';
        document.getElementById(listId).style.display = 'none';
        if (fSlotId && document.getElementById(fSlotId)) document.getElementById(fSlotId).style.display = 'none';
        const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
        area.hidden = false;
        area.style.display = 'block';
        try {
            const bundle = await this.getLeaderboardBundle(gameName);
            const player = bundle.player || {};
            area.innerHTML = `
                <div class="game-landing-card">
                    <button class="btn btn-outline btn-sm" onclick="V10Expansion.exitGame()">← Back to Games</button>
                    <div class="game-landing-intro"><div class="game-landing-icon">${icon}</div><h2>${this.escapeLeaderboardText(gameName)}</h2><p>${this.escapeLeaderboardText(desc)}</p></div>
                    <div class="game-personal-standing"><span>Your best <strong>${Number(player.personalBest) || 0}</strong></span><span>Your rank <strong>${this.rankLabel(player.rank, bundle.leaderboard, player.rankTied)}</strong></span></div>
                    <section class="game-ranking-panel"><h3>Top 3</h3>${this.renderLeaderboardRows(bundle.leaderboard, 3)}</section>
                    <details class="game-ranking-panel"><summary>View Top 10</summary>${this.renderLeaderboardRows(bundle.leaderboard, 10)}</details>
                    <button class="btn btn-primary game-primary-action" onclick='${playFn}'>▶ Play now</button>
                    <p class="game-help-text">Life Point limits never stop replay. Keep playing to improve your personal best and rank.</p>
                </div>`;
        } catch (e) { area.innerHTML = `<p style="color:red; padding: 20px;">Error loading game: ${e.message}</p>`; }
    },

    ensurePostGameResultStyles: function() {
        if (typeof document === 'undefined') return;

        if (
            document.getElementById(
                'game-post-result-css'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'game-post-result-css';

        style.textContent = `
            /*
             * Shared post-game result UX.
             *
             * Result views are expanded/detail views, so Top 3
             * intentionally keeps FULL member names.
             */

            .game-result-card {
                position: relative;
            }

            .game-result-fun-fact {
                width: 100%;
                max-height: 240px;
                box-sizing: border-box;
                margin: 12px 0 14px;
                padding: 13px 15px;
                overflow: hidden;
                border: 1px solid #FCD34D;
                border-radius: 14px;
                background: linear-gradient(135deg, #FFFBEB, #FEF3C7);
                color: #78350F;
                text-align: left;
                opacity: 1;
                transform: translateY(0);
                transition:
                    opacity 420ms ease,
                    transform 420ms ease,
                    max-height 500ms ease,
                    margin 500ms ease,
                    padding 500ms ease,
                    border-width 500ms ease;
            }

            .game-result-fun-fact.is-dismissing {
                max-height: 0;
                margin-top: 0;
                margin-bottom: 0;
                padding-top: 0;
                padding-bottom: 0;
                border-width: 0;
                opacity: 0;
                transform: translateY(-6px);
            }

            .game-result-fun-fact h3 {
                margin: 0 0 6px;
                color: #92400E;
                font-size: .82rem;
                font-weight: 900;
                letter-spacing: .05em;
            }

            .game-result-fun-fact p {
                margin: 0;
                color: #78350F;
                font-size: .76rem;
                line-height: 1.45;
            }

            .game-result-fun-fact cite {
                display: block;
                margin-top: 7px;
                color: #92400E;
                font-size: .70rem;
                font-style: normal;
                font-weight: 900;
            }

            .game-result-top3 {
                width: 100%;

                box-sizing: border-box;

                margin-top: 14px;
                padding: 13px;

                border:
                    1px solid rgba(148,163,184,.28);

                border-radius: 14px;

                background:
                    rgba(248,250,252,.82);

                text-align: left;
            }

            .game-result-top3 h3 {
                margin:
                    0 0 9px;

                color: #0F172A;

                font-size: .92rem;
                font-weight: 900;

                text-align: center;
            }

            .game-result-top3 .game-rank-row {
                display: grid;

                grid-template-columns:
                    auto auto minmax(0,1fr) auto;

                align-items: center;

                gap: 8px;

                min-height: 38px;

                padding:
                    6px 4px;

                border-bottom:
                    1px solid rgba(148,163,184,.18);
            }

            .game-result-top3 .game-rank-row:last-child {
                border-bottom: 0;
            }

            .game-result-top3 .game-rank-position {
                min-width: 30px;

                color: #475569;

                font-size: .72rem;
                font-weight: 900;
            }

            .game-result-top3 .game-rank-avatar {
                width: 30px;
                height: 30px;

                flex: 0 0 30px;
            }

            .game-result-top3 .game-rank-name {
                min-width: 0;

                overflow: hidden;

                color: #0F172A;

                font-size: .78rem;
                font-weight: 800;

                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .game-result-top3 .game-rank-row strong {
                color: #334155;

                font-size: .72rem;
                font-weight: 800;

                white-space: nowrap;
            }

            .game-result-top3 .game-empty-state {
                margin: 5px 0;

                color: #64748B;

                font-size: .76rem;

                text-align: center;
            }

            /*
             * The old result already had Play Again, but the
             * action row could sit below the visible mobile
             * viewport. Keep the result scrollable while the
             * action row remains reachable and visually dominant.
             */

            #gameImmersiveHost .game-result-card {
                max-height:
                    calc(100dvh - 22px) !important;

                overflow-y:
                    auto !important;

                overscroll-behavior:
                    contain;
            }

            .game-result-actions--sticky {
                position: sticky !important;

                bottom: -1px;

                z-index: 20;

                width: 100%;

                box-sizing: border-box;

                margin-top:
                    14px !important;

                padding:
                    14px 0 3px;

                background:
                    linear-gradient(
                        180deg,
                        rgba(255,253,247,0),
                        rgba(255,253,247,.96) 22%,
                        #FFFDF7 45%
                    );
            }

            .game-result-actions--sticky .btn {
                min-height: 48px;

                font-weight: 900;
            }

            .game-result-actions--sticky .btn-primary {
                font-size: .88rem;
            }

            .game-result-replay-note {
                margin:
                    8px 0 0;

                color: #64748B;

                font-size: .70rem;

                line-height: 1.35;

                text-align: center;
            }

            .game-result-mastery-note,
            .game-result-mastery-recognition {
                width: 100%;
                box-sizing: border-box;
                margin: 10px 0 0;
                padding: 10px 12px;
                border-radius: 12px;
                text-align: center;
            }

            .game-result-mastery-note {
                border: 1px solid rgba(180,83,9,.22);
                background: #FFFBEB;
                color: #78350F;
                font-size: .72rem;
                line-height: 1.45;
            }

            .game-result-mastery-recognition {
                border: 1px solid #F59E0B;
                background: linear-gradient(135deg, #FEF3C7, #FFFBEB);
                color: #92400E;
                font-size: .86rem;
                font-weight: 900;
                letter-spacing: .04em;
            }

            @media (max-width: 520px) {
                .game-result-top3 {
                    margin-top: 10px;

                    padding: 9px;
                }

                .game-result-top3 .game-rank-row {
                    gap: 6px;

                    min-height: 34px;
                }

                .game-result-top3 .game-rank-avatar {
                    width: 27px;
                    height: 27px;
                }

                .game-result-top3 .game-rank-name {
                    font-size: .72rem;
                }

                .game-result-top3 .game-rank-row strong {
                    font-size: .66rem;
                }

                .game-result-actions--sticky {
                    gap: 7px !important;

                    padding-top: 12px;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    },

    arcadeFunFactMarkup: function(gameName) {
        const fact =
            this.arcadeFunFacts[gameName];

        if (
            !fact
            || !fact.text
            || !fact.reference
        ) {
            return '';
        }

        return `
            <aside
                class="game-result-fun-fact"
                data-arcade-fun-fact
                aria-label="Did you know"
            >
                <h3>💡 DID YOU KNOW?</h3>
                <p>
                    ${this.escapeLeaderboardText(fact.text)}
                </p>
                <cite>
                    ${this.escapeLeaderboardText(fact.reference)}
                </cite>
            </aside>
        `;
    },

    scheduleArcadeFunFactDismissal: function(container) {
        if (
            !container
            || typeof container.querySelector !== 'function'
        ) {
            return;
        }

        const factCard =
            container.querySelector(
                '[data-arcade-fun-fact]'
            );

        if (!factCard) {
            return;
        }

        const previousTimer =
            this.funFactDismissTimers.get(
                container
            );

        if (previousTimer) {
            clearTimeout(previousTimer);
        }

        const dismissTimer =
            setTimeout(
                () => {
                    factCard.classList.add(
                        'is-dismissing'
                    );

                    setTimeout(
                        () => {
                            if (factCard.isConnected) {
                                factCard.remove();
                            }
                        },
                        520
                    );
                },
                10000
            );

        this.funFactDismissTimers.set(
            container,
            dismissTimer
        );
    },

    resultTopThreeMarkup: function(rows) {
        const leaderboard =
            Array.isArray(rows)
                ? rows
                : [];

        const content =
            leaderboard.length
                ? this.renderLeaderboardRows(
                    leaderboard,
                    3
                )
                : `
                    <p class="game-empty-state">
                        Top 3 is temporarily unavailable.
                        Your score was still saved.
                    </p>
                `;

        return `
            <section
                class="game-result-top3"
                aria-label="Top 3 players"
            >
                <h3>🏆 Top 3 Players</h3>
                ${content}
            </section>
        `;
    },

    recognitionText: function(data) {
        if (Number(data.rank) === 1) return 'New #1 score!';
        if (Number(data.rank) <= 3) return 'You entered the Top 3!';
        if (Number(data.rank) <= 10) return 'You entered the Top 10!';
        if (data.isNewPersonalBest) return 'New personal best!';
        return 'Run complete — keep climbing.';
    },

    resultMarkup: function(
        gameName,
        type,
        score,
        data,
        playFn,
        accuracy,
        leaderboardRows,
        resultDetails
    ) {
        this.ensurePostGameResultStyles();

        const awarded =
            Number(
                data.pointsAwarded
            ) || 0;

        const categoryName =
            type === 'arcade'
                ? 'Arcade'
                : 'Growth Game';

        const capMessage =
            data.capReached
                ? `Daily ${
                    type === 'arcade'
                        ? 'Arcade'
                        : 'learning'
                } reward complete. Keep playing to improve your ${
                    type === 'arcade'
                        ? 'score and rank'
                        : 'score and mastery'
                }.`
                : `${awarded} Life Point${
                    awarded === 1
                        ? ''
                        : 's'
                } earned this run.`;

        const accuracyCard =
            Number.isFinite(
                Number(accuracy)
            )
                ? `
                    <div>
                        <span>Accuracy</span>
                        <strong>
                            ${
                                Math.round(
                                    Number(accuracy)
                                )
                            }%
                        </strong>
                    </div>
                `
                : '';

        const mastery =
            resultDetails
            && Number.isFinite(
                Number(resultDetails.mastery)
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            Number(resultDetails.mastery)
                        )
                    )
                )
                : null;

        const masteryCard =
            mastery === null
                ? ''
                : `
                    <div>
                        <span>Mastery %</span>
                        <strong>${mastery}%</strong>
                    </div>
                `;

        const masteryRecognition =
            mastery === 100
                ? `
                    <p class="game-result-mastery-recognition">
                        ✨ DECLARATION MASTERED
                    </p>
                `
                : '';

        const masteryNote =
            mastery === null
                ? ''
                : `
                    <p class="game-result-mastery-note">
                        Mastery measures how many declaration lines
                        you recalled correctly on the first try.
                        It is a game-learning measure, not a measure
                        of faith or spiritual growth.
                    </p>
                `;

        const previousBest =
            data.previousPersonalBest
                === null
            || data.previousPersonalBest
                === undefined
                ? 'First score'
                : Number(
                    data.previousPersonalBest
                ) || 0;

        const topThree =
            this.resultTopThreeMarkup(
                leaderboardRows
            );

        const funFact =
            type === 'arcade'
                ? this.arcadeFunFactMarkup(
                    gameName
                )
                : '';

        return `
            <div
                class="game-result-card"
                role="status"
                aria-live="polite"
            >
                <p class="game-result-eyebrow">
                    ${
                        this.escapeLeaderboardText(
                            gameName
                        )
                    }
                </p>

                <h2>
                    ${
                        this.recognitionText(
                            data
                        )
                    }
                </h2>

                ${funFact}

                <div class="game-result-stats">
                    <div>
                        <span>Game Score</span>
                        <strong>
                            ${Number(score) || 0}
                        </strong>
                    </div>

                    <div>
                        <span>Previous best</span>
                        <strong>
                            ${previousBest}
                        </strong>
                    </div>

                    <div>
                        <span>Personal best</span>
                        <strong>
                            ${
                                Number(
                                    data.personalBest
                                )
                                || Number(score)
                                || 0
                            }
                        </strong>
                    </div>

                    <div>
                        <span>Rank</span>
                        <strong>
                            ${
                                this.rankLabel(
                                    data.rank,
                                    leaderboardRows,
                                    data.rankTied
                                )
                            }
                        </strong>
                    </div>

                    ${accuracyCard}

                    ${masteryCard}

                    <div>
                        <span>
                            ${categoryName} LP Today
                        </span>

                        <strong>
                            ${
                                Number(
                                    data.dailyLifePoints
                                ) || 0
                            }
                            /
                            ${
                                Number(
                                    data.dailyCap
                                )
                                || (
                                    type === 'arcade'
                                        ? 20
                                        : 25
                                )
                            }
                        </strong>
                    </div>
                </div>

                <p class="game-cap-message">
                    ${capMessage}
                </p>

                ${masteryRecognition}

                ${masteryNote}

                ${topThree}

                <div
                    class="
                        game-result-actions
                        game-result-actions--sticky
                    "
                >
                    <button
                        class="btn btn-primary"
                        onclick='${playFn}'
                    >
                        ▶ PLAY AGAIN
                    </button>

                    <button
                        class="btn btn-outline"
                        onclick="V10Expansion.exitGame()"
                    >
                        Back to Games
                    </button>
                </div>

                <p class="game-result-replay-note">
                    Life Point limits never stop replay.
                    Keep playing for your personal best
                    and leaderboard rank.
                </p>
            </div>
        `;
    },

    submitGameScore: async function(gameName, type, score) {
        const payload = {
            game_name: gameName,
            score: Math.max(0, Math.floor(Number(score) || 0)),
            type,
            submission_id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `game-${Date.now()}-${Math.random()}`
        };
        const response = await fetch('/api/games/universal-submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Score could not be saved');
        delete this.bulkDataCache[gameName];
        this.loadEconomyStatus();
        if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
        return data;
    },

    submitUniversalScore: async function(gameName, type, score, accuracy, resultDetails) {
        const area = document.getElementById(type === 'growth' ? 'growthActiveGameArea' : 'arcadeActiveGameArea');
        try {
            const data = await this.submitGameScore(
                gameName,
                type,
                score
            );

            let leaderboardRows = [];

            try {
                const bundle =
                    await this.getLeaderboardBundle(
                        gameName
                    );

                leaderboardRows =
                    Array.isArray(
                        bundle.leaderboard
                    )
                        ? bundle.leaderboard
                        : [];
            } catch (leaderboardError) {
                console.warn(
                    'Post-game Top 3 unavailable',
                    leaderboardError
                );
            }

            if (area) {
                area.innerHTML =
                    this.resultMarkup(
                        gameName,
                        type,
                        score,
                        data,
                        this.getPlayFunction(
                            gameName
                        ),
                        accuracy,
                        leaderboardRows,
                        resultDetails
                    );

                this.scheduleArcadeFunFactDismissal(
                    area
                );
            }

            return data;
        } catch (error) {
            if (area) area.innerHTML = `<div class="game-result-card"><h2>Score not saved</h2><p>${this.escapeLeaderboardText(error.message)}</p><div class="game-result-actions"><button class="btn btn-primary" onclick='${this.getPlayFunction(gameName)}'>Try Again</button><button class="btn btn-outline" onclick="V10Expansion.exitGame()">Back to Games</button></div></div>`;
            return null;
        }
    },

    submitCanvasGameResult: async function(options) {
        const overlay = document.getElementById(options.overlayId);
        if (overlay) overlay.innerHTML = '<div class="game-result-card"><p>Saving score…</p></div>';
        try {
            const data =
                await this.submitGameScore(
                    options.gameName,
                    'arcade',
                    options.score
                );

            let leaderboardRows = [];

            try {
                const bundle =
                    await this.getLeaderboardBundle(
                        options.gameName
                    );

                leaderboardRows =
                    Array.isArray(
                        bundle.leaderboard
                    )
                        ? bundle.leaderboard
                        : [];
            } catch (leaderboardError) {
                console.warn(
                    'Post-game Top 3 unavailable',
                    leaderboardError
                );
            }

            if (overlay) {
                overlay.innerHTML =
                    this.resultMarkup(
                        options.gameName,
                        'arcade',
                        options.score,
                        data,
                        options.playAgain,
                        options.accuracy,
                        leaderboardRows
                    );

                this.scheduleArcadeFunFactDismissal(
                    overlay
                );
            }

            return data;
        } catch (error) {
            if (overlay) overlay.innerHTML = `<div class="game-result-card"><h2>Score not saved</h2><p>${this.escapeLeaderboardText(error.message)}</p><div class="game-result-actions"><button class="btn btn-primary" onclick='${options.playAgain}'>Try Again</button><button class="btn btn-outline" onclick="V10Expansion.exitGame()">Back to Games</button></div></div>`;
            return null;
        }
    },

    exitGame: function() {
        if(this._activeTimer) clearInterval(this._activeTimer);
        if(this.rxState && this.rxState.timerId) clearInterval(this.rxState.timerId);

        const growthArea = document.getElementById('growthActiveGameArea');
        if(growthArea) { growthArea.hidden = true; growthArea.style.display = 'none'; growthArea.innerHTML = ''; }
        const growthGrid = document.getElementById('growthGamesGrid');
        if(growthGrid) growthGrid.style.display = 'grid';
        if(document.getElementById('featuredGrowthGameContainer')) document.getElementById('featuredGrowthGameContainer').style.display = 'block';

        if (document.getElementById('btnGrowthIndiv')) document.getElementById('btnGrowthIndiv').parentElement.style.display = 'flex';

        const arcadeArea = document.getElementById('arcadeActiveGameArea');
        if(arcadeArea) { arcadeArea.hidden = true; arcadeArea.style.display = 'none'; arcadeArea.innerHTML = ''; }
        
        const arcadeList = document.getElementById('arcadeGamesList');
        if(arcadeList) arcadeList.style.display = 'block';

        const arcadeGrid = document.getElementById('arcadeGridItems');
        if(arcadeGrid) arcadeGrid.style.display = 'grid';

        if(document.getElementById('featuredArcadeGameContainer')) document.getElementById('featuredArcadeGameContainer').style.display = 'block';

        setTimeout(() => {
            const activeIndiv = document.getElementById('btnGrowthIndiv');
            if(activeIndiv && activeIndiv.classList.contains('btn-primary')) this.filterGrowthGames('indiv');
            else if (activeIndiv) this.filterGrowthGames('groups');
        }, 50);

        /*
         * A successful score submission invalidates the
         * per-game leaderboard cache, but the Games Home DOM
         * can still contain the old Top 3.
         *
         * Refresh only the Games ranking components when the
         * player returns to Games. No page reload or redirect.
         */
        Promise.resolve()
            .then(
                () =>
                    this.loadTopScorers()
            )
            .then(
                () =>
                    this.loadFeaturedGames()
            )
            .catch(
                error => {
                    console.warn(
                        'Unable to refresh Games rankings after play.',
                        error
                    );
                }
            );
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

        grid.querySelectorAll('.arcade-game-card, .arcade-game-tile').forEach(t => {
            t.style.display = 'flex';
            delete t.dataset.featuredGame;
        });
        if (!gameName || gameName === "None") return container.innerHTML = '';

        const tile = grid.querySelector(`[data-game-name="${gameName}"]`);
        if (tile) {
            tile.style.display = 'none'; // Hide from lower grid
            tile.dataset.featuredGame = 'true';
            const icon = tile.querySelector('.game-icon') ? tile.querySelector('.game-icon').innerText : (tile.querySelector('.game-tile-icon') ? tile.querySelector('.game-tile-icon').innerText : '🎮');
            const title = tile.querySelector('h3') ? tile.querySelector('h3').innerText : gameName;
            const desc = tile.querySelector('p') ? tile.querySelector('p').innerText.replace(/"/g, "'").replace(/\n/g, " ") : 'Play our featured game!';

            const type = isGrowth ? 'growth' : 'arcade';
            const playFn = this.getPlayFunction(gameName);

            let topHtml = '';
            try {
                const bundle =
                    (this.bulkDataCache && this.bulkDataCache[gameName])
                    || await this.getLeaderboardBundle(gameName);

                const topP =
                    bundle
                        ? (bundle.leaderboard || []).slice(0, 3)
                        : [];

                if (topP.length > 0) {
                    topHtml = `
                        <div
                            class="top-scorers-container top-scorers-container--featured"
                            aria-label="Featured game top players"
                        >
                            ${topP.map((p) => {
                                const rank = Number(p.rank) || 0;

                                const medal =
                                    rank === 1
                                        ? '🥇'
                                        : rank === 2
                                            ? '🥈'
                                            : rank === 3
                                                ? '🥉'
                                                : `#${rank || '?'}`;

                                const safeName = this.escapeLeaderboardText(
                                        p.name || 'Member'
                                    );

                                const rankLabel =
                                    rank
                                        ? `Rank ${rank}`
                                        : 'Unranked';

                                return `
                                    <div
                                        class="featured-top-player"
                                    >
                                        <span
                                            class="featured-top-player-rank"
                                            aria-label="${rankLabel}"
                                        >${medal}</span>

                                        <span
                                            class="featured-top-player-name"
                                        >${safeName}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>`;
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
                    const safeName = this.escapeLeaderboardText(u.name || 'Member');
                    const safeAvatar = this.safeLeaderboardAvatar(u.profile_picture);
                    const av = safeAvatar ? `<img src="${safeAvatar}" alt="" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">` : `<div style="width:34px; height:34px; border-radius:50%; background:#E2E8F0; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:bold;">${safeName.charAt(0)}</div>`;
                    let sT = type === 'overall' ? `⭐ ${Number(u.points) || 0} LP` : type === 'growth' ? `🌱 ${Number(u.growth_xp) || 0} LP` : `🎮 ${Number(u.arcade_xp) || 0} LP`;
                    const hc = type === 'overall' ? '#D97706' : type === 'growth' ? '#059669' : '#2563EB';
                    return `<div style="background: ${i===0?'#FEF3C7':'#FFFFFF'}; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;"><div style="width: 25px; text-align: center; font-size: 1.1rem;">${rI}</div>${av}<strong style="color: #0F172A; font-size: 1rem;">${safeName}</strong></div>
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
        this.ccState = { q: data, i: 0, s: 0, t: 60, correct: 0, answered: 0 };
        this._activeTimer = setInterval(() => {
            this.ccState.t--;
            const tEl = document.getElementById('gTimer'); if(tEl) tEl.innerText = this.ccState.t + 's';
            if(this.ccState.t <= 0) { clearInterval(this._activeTimer); this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s, this.ccState.answered ? (this.ccState.correct / this.ccState.answered) * 100 : 0); }
        }, 1000);
        this.renderCC();
    },
    renderCC: function() {
        if(this.ccState.i >= 15 || this.ccState.i >= this.ccState.q.length) { clearInterval(this._activeTimer); return this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s, this.ccState.answered ? (this.ccState.correct / this.ccState.answered) * 100 : 0); }
        const q = this.ccState.q[this.ccState.i]; let opts = JSON.parse(q.options);
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.ccState.s}</span><span style="color:red;" id="gTimer">${this.ccState.t}s</span><span>${this.ccState.i+1}/15</span></div>`;
        h += `<h3>${q.question}</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">`;
        opts.forEach((o, idx) => { h += `<button class="btn btn-outline" onclick="V10Expansion.ansCC(${idx}, ${q.correct_index}, this)">${o}</button>`; });
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansCC: function(sel, cor, btn) {
        this.ccState.answered++;
        if(sel === cor){
            this.ccState.correct++; this.ccState.s += 10; btn.style.background='#10B981'; btn.style.color='#FFF';
            setTimeout(() => { this.ccState.i++; this.renderCC(); }, 800);
        } else {
            btn.style.background='#EF4444'; btn.style.color='#FFF';
            clearInterval(this._activeTimer);
            setTimeout(() => { this.submitUniversalScore("Catechism Clash", "growth", this.ccState.s, (this.ccState.correct / this.ccState.answered) * 100); }, 1000);
        }
    },

    playWAI: async function() { this.waiState = { i: 0, s: 0, clues: 1, currentQ: null, correct: 0, answered: 0 }; this.nextWAI(); },
    nextWAI: async function() {
        if(this.waiState.i >= 10) return this.submitUniversalScore("Who Am I?", "growth", this.waiState.s, this.waiState.answered ? (this.waiState.correct / this.waiState.answered) * 100 : 0);
        const r = await fetch('/api/growth-games/whoami'); this.waiState.currentQ = await r.json(); this.waiState.clues = 1; this.renderWAI();
    },
    renderWAI: function() {
        const q = this.waiState.currentQ; let pts = this.waiState.clues === 1 ? 15 : this.waiState.clues === 2 ? 10 : 5;
        let h = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; font-weight:bold;"><span>Score: ${this.waiState.s}</span><span>${this.waiState.i+1}/10</span></div>`;
        h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 1:</strong> ${q.clue1}</div>`;
        if(this.waiState.clues >= 2) h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 2:</strong> ${q.clue2}</div>`;
        if(this.waiState.clues >= 3) h += `<div style="background:#FFFBEB; padding:15px; border-radius:8px; margin-bottom:10px;"><strong>Clue 3:</strong> ${q.clue3}</div>`;
        if(this.waiState.clues < 3) h += `<button class="btn btn-secondary btn-sm" style="width:100%; margin-bottom:15px;" onclick="V10Expansion.waiState.clues++; V10Expansion.renderWAI()">Need another clue? (Potential score: ${pts-5})</button>`;
        h += `<input type="text" id="waiGuess" class="form-control" placeholder="Who am I?"><button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="V10Expansion.ansWAI('${q.answer.replace(/'/g,"\\'")}', ${pts})">Guess</button><p id="waiRes" style="margin-top:10px; font-weight:bold;"></p>`;
        document.getElementById('growthActiveGameArea').innerHTML = `<div style="background:#FFF; padding:20px; border-radius:12px;">${h}</div>`;
    },
    ansWAI: function(ans, pts) {
        const guess = document.getElementById('waiGuess').value.trim().toLowerCase();
        const resEl = document.getElementById('waiRes');
        if(!guess) return;
        this.waiState.answered++;
        if(guess === ans.toLowerCase()) {
            this.waiState.correct++; this.waiState.s += pts; resEl.style.color='#10B981'; resEl.innerText="Correct!";
            setTimeout(() => { this.waiState.i++; this.nextWAI(); }, 1200);
        } else {
            resEl.style.color='#EF4444'; resEl.innerText=`Wrong! It was ${ans}.`;
            setTimeout(() => { this.submitUniversalScore("Who Am I?", "growth", this.waiState.s, (this.waiState.correct / this.waiState.answered) * 100); }, 1500);
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
        if(list) { list.hidden = tab !== 'games'; list.style.display = tab === 'games' ? 'block' : 'none'; }
        if(ldr) { ldr.hidden = tab !== 'leaderboard'; ldr.style.display = tab === 'leaderboard' ? 'block' : 'none'; }

        const gamesBtn = document.getElementById('btnArcadeGames');
        if (gamesBtn) {
            gamesBtn.classList.toggle('active', tab === 'games');
            if (typeof gamesBtn.setAttribute === 'function') gamesBtn.setAttribute('aria-selected', String(tab === 'games'));
        }
        const ldrBtn = document.getElementById('btnArcadeLeaderboard');
        if (ldrBtn) {
            ldrBtn.classList.toggle('active', tab === 'leaderboard');
            if (typeof ldrBtn.setAttribute === 'function') ldrBtn.setAttribute('aria-selected', String(tab === 'leaderboard'));
        }

        const area = document.getElementById('arcadeActiveGameArea');
        if(area) {
            area.hidden = true;
            area.style.display = 'none';
            if (tab === 'games') area.innerHTML = '';
        }

        if (tab === 'games') {
            const grid = document.getElementById('arcadeGridItems');
            if (grid) grid.style.display = 'grid';
            const featured = document.getElementById('featuredArcadeGameContainer');
            if (featured) featured.style.display = 'block';
        }

        if (tab === 'leaderboard') this.loadLeaderboard();
    },
    loadLeaderboard: async function() {
        const container = document.getElementById('arcadeLeaderboardContainer');
        if (!container) return;
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">Loading ranks...</p>';
        try {
            const arcadeGames = window.V10Expansion.gameNames.slice(0, 5);
            const bundles = await Promise.all(arcadeGames.map(gameName => window.V10Expansion.getLeaderboardBundle(gameName).catch(() => ({ game: gameName, leaderboard: [], player: {} }))));
            container.innerHTML = bundles.map(bundle => `<section class="game-ranking-panel game-ranking-card"><h3>${window.V10Expansion.escapeLeaderboardText(bundle.game && bundle.game.name ? bundle.game.name : 'Game')}</h3><div class="game-personal-standing"><span>Your best <strong>${Number(bundle.player && bundle.player.personalBest) || 0}</strong></span><span>Your rank <strong>${window.V10Expansion.rankLabel(bundle.player && bundle.player.rank, bundle.leaderboard)}</strong></span></div>${window.V10Expansion.renderLeaderboardRows(bundle.leaderboard, 10)}</section>`).join('');
        } catch (e) { container.innerHTML = '<p style="color:red; text-align:center;">Network error loading ranks.</p>'; }
    },
    updateTotalXP: async function() {
        if (window.V10Expansion) window.V10Expansion.loadEconomyStatus();
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
