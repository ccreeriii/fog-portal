'use strict';

/*
 * Zacchaeus: Tree Climb
 *
 * Three-lane vertical climbing game inspired by Luke 19:4.
 *
 * Game Score measures gameplay performance.
 * Life Points remain controlled by the shared server economy.
 */

window.V13Zacchaeus = {
    gameName:
        'Zacchaeus: Tree Climb',

    canvas: null,
    ctx: null,

    animationFrameId: null,
    finishTimer: null,

    boundPointerHandler: null,
    boundKeyHandler: null,

    isPlaying: false,
    finishSubmitted: false,

    TOTAL_LEVELS: 12,

    laneX: [
        220,
        360,
        500
    ],

    playerLane: 1,
    targetLane: 1,

    playerX: 360,
    playerY: 392,

    levelsCompleted: 0,
    safeClimbs: 0,
    misses: 0,

    streak: 0,
    bestStreak: 0,

    leavesCollected: 0,

    score: 0,

    currentRow: null,
    lastHazardLane: null,

    lastFrameTime: 0,
    startTime: 0,
    completedAt: 0,

    phase: 'idle',

    feedback: '',
    feedbackType: 'info',
    feedbackUntil: 0,


    initStyles: function() {
        if (
            document.getElementById(
                'zacchaeus-tree-climb-css'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'zacchaeus-tree-climb-css';

        style.textContent = `
            .zac-game-shell {
                width: 100%;
                max-width: 780px;

                margin: 0 auto;

                overflow: hidden;

                border:
                    1px solid #C8D7BD;

                border-radius: 18px;

                background: #162617;

                box-shadow:
                    0 22px 60px
                    rgba(15,23,42,.24);
            }

            .zac-game-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 10px;

                padding: 10px 14px;

                background:
                    linear-gradient(
                        135deg,
                        #F8FBF3,
                        #EBF4DF
                    );

                border-bottom:
                    1px solid #C9D8B8;
            }

            .zac-game-stats {
                display: flex;
                align-items: center;
                justify-content: flex-end;

                flex-wrap: wrap;

                gap: 5px 11px;

                color: #334155;

                font-size: .74rem;
                font-weight: 850;
            }

            .zac-game-stat strong {
                color: #3F6212;
            }

            .zac-stage {
                position: relative;

                width: 100%;

                background: #162617;
            }

            #zacCanvas {
                display: block;

                width: 100%;
                max-width: 720px;
                height: auto;

                margin: 0 auto;

                touch-action: none;

                user-select: none;
                -webkit-user-select: none;
            }

            .zac-overlay {
                position: absolute;
                inset: 0;

                z-index: 6;

                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;

                gap: 11px;

                box-sizing: border-box;

                padding: 26px;

                background:
                    linear-gradient(
                        180deg,
                        rgba(17,35,18,.92),
                        rgba(32,57,24,.96)
                    );

                color: #FFFFFF;

                text-align: center;
            }

            .zac-overlay h2 {
                margin: 0;

                border: 0;

                color: #F6D98A;

                font-size: 1.8rem;
                line-height: 1.12;
            }

            .zac-overlay p {
                max-width: 580px;

                margin: 0;

                color: #E5F0DB;

                line-height: 1.5;

                font-size: .88rem;
            }

            .zac-overlay small {
                max-width: 560px;

                color: #CBDBC3;

                line-height: 1.45;
            }

            .zac-controls {
                display: grid;

                grid-template-columns:
                    repeat(3, minmax(0, 1fr));

                gap: 7px;

                padding: 10px;

                background:
                    linear-gradient(
                        180deg,
                        #F7FAF3,
                        #EAF2E1
                    );

                border-top:
                    1px solid #CBDABF;
            }

            .zac-lane-btn {
                min-height: 50px;

                border-radius: 12px;

                border:
                    1px solid #AFC69F;

                background: #FFFFFF;

                color: #365314;

                font-size: .78rem;
                font-weight: 900;

                touch-action: manipulation;
            }

            .zac-lane-btn.active {
                border-color: #4D7C0F;

                background: #ECFCCB;

                color: #365314;

                box-shadow:
                    inset 0 0 0 2px
                    rgba(77,124,15,.14);
            }

            .zac-lane-btn:disabled {
                opacity: .45;
            }

            /* ===============================================
               ZACCHAEUS RESULT CONTRAST
               =============================================== */

            #zacOverlay .game-result-card {
                width: min(92%, 620px) !important;
                max-height: calc(100% - 24px) !important;

                overflow-y: auto !important;

                box-sizing: border-box !important;

                padding: 20px !important;

                background: #FFFDF7 !important;
                color: #0F172A !important;

                border:
                    1px solid #C9D8B8 !important;

                border-radius: 18px !important;

                box-shadow:
                    0 24px 70px
                    rgba(15,30,15,.38) !important;

                text-align: center !important;
            }

            #zacOverlay .game-result-eyebrow {
                color: #4D7C0F !important;
                opacity: 1 !important;
            }

            #zacOverlay .game-result-card h2 {
                color: #365314 !important;
                opacity: 1 !important;
            }

            #zacOverlay .game-result-stats > div {
                background: #F7FEE7 !important;

                border:
                    1px solid #D9F99D !important;

                color: #0F172A !important;

                opacity: 1 !important;
            }

            #zacOverlay .game-result-stats span {
                color: #475569 !important;
                opacity: 1 !important;
            }

            #zacOverlay .game-result-stats strong {
                color: #0F172A !important;
                opacity: 1 !important;

                font-weight: 900 !important;
            }

            #zacOverlay .game-cap-message {
                color: #475569 !important;
                opacity: 1 !important;
            }

            @media (max-width: 520px) {
                .zac-game-header {
                    padding: 8px 10px;
                }

                .zac-game-stats {
                    gap: 4px 8px;

                    font-size: .65rem;
                }

                .zac-overlay {
                    padding: 18px;
                }

                .zac-overlay h2 {
                    font-size: 1.45rem;
                }

                .zac-overlay p {
                    font-size: .79rem;
                }

                .zac-controls {
                    gap: 5px;

                    padding: 7px;
                }

                .zac-lane-btn {
                    min-height: 47px;

                    font-size: .70rem;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    },


    mountGameUI: function() {
        this.cleanup();
        this.initStyles();

        const list =
            document.getElementById(
                'arcadeGamesList'
            );

        if (list) {
            list.style.display =
                'none';
        }

        const area =
            document.getElementById(
                'arcadeActiveGameArea'
            );

        if (!area) {
            return;
        }

        area.hidden = false;
        area.style.display = 'block';

        area.innerHTML = `
            <div class="zac-game-shell">
                <div class="zac-game-header">
                    <button
                        class="btn btn-outline btn-sm"
                        onclick="V13Zacchaeus.exitGame()"
                    >
                        🔙 Games
                    </button>

                    <div class="zac-game-stats">
                        <span class="zac-game-stat">
                            HEIGHT
                            <strong id="zacHeight">
                                0 / 12
                            </strong>
                        </span>

                        <span class="zac-game-stat">
                            SAFE
                            <strong id="zacSafe">
                                0
                            </strong>
                        </span>

                        <span class="zac-game-stat">
                            SCORE
                            <strong id="zacScore">
                                0
                            </strong>
                        </span>
                    </div>
                </div>

                <div class="zac-stage">
                    <canvas
                        id="zacCanvas"
                        width="720"
                        height="520"
                        aria-label="Zacchaeus Tree Climb three lane game"
                    ></canvas>

                    <div
                        id="zacOverlay"
                        class="zac-overlay"
                    >
                        <h2>
                            ZACCHAEUS — TREE CLIMB
                        </h2>

                        <p>
                            Climb the sycamore-fig tree and
                            choose a safe branch at every level.
                        </p>

                        <p>
                            Move LEFT, CENTER or RIGHT before
                            the next branch reaches Zacchaeus.
                            Avoid the visibly cracked branch.
                        </p>

                        <small>
                            Golden leaves give a bonus.
                            Safe-climb streaks increase your score.
                            The climb gets faster as you approach
                            the canopy. Inspired by Luke 19:4.
                        </small>

                        <button
                            class="btn btn-primary"
                            style="
                                min-width:190px;
                                padding:12px 20px;
                                background:#4D7C0F;
                                border-color:#4D7C0F;
                            "
                            onclick="V13Zacchaeus.startGame()"
                        >
                            🌳 BEGIN CLIMB
                        </button>
                    </div>
                </div>

                <div class="zac-controls">
                    <button
                        id="zacLane0"
                        type="button"
                        class="zac-lane-btn"
                        onclick="V13Zacchaeus.chooseLane(0)"
                    >
                        ◀ LEFT
                    </button>

                    <button
                        id="zacLane1"
                        type="button"
                        class="zac-lane-btn active"
                        onclick="V13Zacchaeus.chooseLane(1)"
                    >
                        ▲ CENTER
                    </button>

                    <button
                        id="zacLane2"
                        type="button"
                        class="zac-lane-btn"
                        onclick="V13Zacchaeus.chooseLane(2)"
                    >
                        RIGHT ▶
                    </button>
                </div>
            </div>
        `;

        this.canvas =
            document.getElementById(
                'zacCanvas'
            );

        this.ctx =
            this.canvas
                ? this.canvas.getContext('2d')
                : null;

        this.bindEvents();

        this.drawScene(
            performance.now()
        );
    },


    bindEvents: function() {
        if (!this.canvas) {
            return;
        }

        this.boundPointerHandler =
            event => {
                if (
                    !this.isPlaying
                    || this.phase !== 'climbing'
                ) {
                    return;
                }

                event.preventDefault();

                const rect =
                    this.canvas
                        .getBoundingClientRect();

                if (
                    !rect.width
                    || !rect.height
                ) {
                    return;
                }

                const x =
                    (
                        event.clientX
                        - rect.left
                    )
                    * (
                        this.canvas.width
                        / rect.width
                    );

                if (x < 300) {
                    this.chooseLane(0);
                } else if (x > 420) {
                    this.chooseLane(2);
                } else {
                    this.chooseLane(1);
                }
            };

        this.canvas.addEventListener(
            'pointerdown',
            this.boundPointerHandler,
            {
                passive: false
            }
        );

        this.boundKeyHandler =
            event => {
                if (
                    !this.isPlaying
                    || this.phase !== 'climbing'
                ) {
                    return;
                }

                if (
                    event.key === 'ArrowLeft'
                    || event.key.toLowerCase() === 'a'
                ) {
                    event.preventDefault();

                    this.chooseLane(
                        Math.max(
                            0,
                            this.targetLane - 1
                        )
                    );

                    return;
                }

                if (
                    event.key === 'ArrowRight'
                    || event.key.toLowerCase() === 'd'
                ) {
                    event.preventDefault();

                    this.chooseLane(
                        Math.min(
                            2,
                            this.targetLane + 1
                        )
                    );

                    return;
                }

                if (event.key === '1') {
                    event.preventDefault();
                    this.chooseLane(0);
                }

                if (event.key === '2') {
                    event.preventDefault();
                    this.chooseLane(1);
                }

                if (event.key === '3') {
                    event.preventDefault();
                    this.chooseLane(2);
                }
            };

        window.addEventListener(
            'keydown',
            this.boundKeyHandler
        );
    },


    cleanupEvents: function() {
        if (
            this.canvas
            && this.boundPointerHandler
        ) {
            this.canvas.removeEventListener(
                'pointerdown',
                this.boundPointerHandler
            );
        }

        if (this.boundKeyHandler) {
            window.removeEventListener(
                'keydown',
                this.boundKeyHandler
            );
        }

        this.boundPointerHandler = null;
        this.boundKeyHandler = null;
    },


    startGame: function() {
        if (!this.canvas) {
            this.mountGameUI();
        }

        const overlay =
            document.getElementById(
                'zacOverlay'
            );

        if (overlay) {
            overlay.style.display =
                'none';
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(
                this.animationFrameId
            );
        }

        if (this.finishTimer) {
            clearTimeout(
                this.finishTimer
            );

            this.finishTimer = null;
        }

        this.isPlaying = true;
        this.finishSubmitted = false;

        this.levelsCompleted = 0;
        this.safeClimbs = 0;
        this.misses = 0;

        this.streak = 0;
        this.bestStreak = 0;

        this.leavesCollected = 0;

        this.score = 0;

        this.playerLane = 1;
        this.targetLane = 1;

        this.playerX =
            this.laneX[1];

        this.currentRow = null;
        this.lastHazardLane = null;

        this.phase = 'climbing';

        const now =
            performance.now();

        this.startTime = now;
        this.completedAt = 0;
        this.lastFrameTime = now;

        this.feedback =
            'CHOOSE A SAFE BRANCH';

        this.feedbackType =
            'info';

        this.feedbackUntil =
            now + 1200;

        this.spawnNextRow();

        this.updateHud();

        this.loop(now);
    },


    spawnNextRow: function() {
        if (
            !this.isPlaying
            || this.levelsCompleted
                >= this.TOTAL_LEVELS
        ) {
            return;
        }

        let hazardLane =
            Math.floor(
                Math.random() * 3
            );

        /*
         * Avoid repeating the same cracked lane
         * three decision rows in a row.
         */
        if (
            hazardLane
            === this.lastHazardLane
            && Math.random() < 0.68
        ) {
            hazardLane =
                (
                    hazardLane
                    + 1
                    + Math.floor(
                        Math.random() * 2
                    )
                ) % 3;
        }

        this.lastHazardLane =
            hazardLane;

        const safeLanes =
            [0, 1, 2].filter(
                lane =>
                    lane !== hazardLane
            );

        const bonusLane =
            safeLanes[
                Math.floor(
                    Math.random()
                    * safeLanes.length
                )
            ];

        this.currentRow = {
            y: 110,

            hazardLane,

            bonusLane,

            resolved: false,

            level:
                this.levelsCompleted
                + 1
        };
    },


    getClimbSpeed: function() {
        return (
            118
            + (
                this.levelsCompleted
                * 7.5
            )
        );
    },


    chooseLane: function(lane) {
        if (
            !this.isPlaying
            || this.phase !== 'climbing'
        ) {
            return;
        }

        const numericLane =
            Number(lane);

        if (
            !Number.isInteger(
                numericLane
            )
            || numericLane < 0
            || numericLane > 2
        ) {
            return;
        }

        this.targetLane =
            numericLane;

        this.updateLaneButtons();
    },


    updateLaneButtons: function() {
        for (
            let lane = 0;
            lane < 3;
            lane += 1
        ) {
            const button =
                document.getElementById(
                    `zacLane${lane}`
                );

            if (!button) {
                continue;
            }

            button.classList.toggle(
                'active',
                lane === this.targetLane
            );

            button.disabled =
                !this.isPlaying
                || this.phase !== 'climbing';
        }
    },


    getResolvedPlayerLane: function() {
        let nearestLane = 0;
        let nearestDistance = Infinity;

        this.laneX.forEach(
            (x, lane) => {
                const distance =
                    Math.abs(
                        this.playerX - x
                    );

                if (
                    distance
                    < nearestDistance
                ) {
                    nearestDistance =
                        distance;

                    nearestLane =
                        lane;
                }
            }
        );

        return nearestLane;
    },


    resolveBranch: function(now) {
        if (
            !this.currentRow
            || this.currentRow.resolved
        ) {
            return;
        }

        this.currentRow.resolved = true;

        const resolvedLane =
            this.getResolvedPlayerLane();

        const hitCracked =
            resolvedLane
            === this.currentRow.hazardLane;

        this.levelsCompleted += 1;

        if (hitCracked) {
            this.misses += 1;

            this.streak = 0;

            this.score =
                Math.max(
                    0,
                    this.score - 180
                );

            this.feedback =
                'CRACKED BRANCH — KEEP CLIMBING';

            this.feedbackType =
                'miss';
        } else {
            this.safeClimbs += 1;
            this.streak += 1;

            this.bestStreak =
                Math.max(
                    this.bestStreak,
                    this.streak
                );

            const streakBonus =
                Math.min(
                    this.streak,
                    10
                ) * 80;

            const leafBonus =
                resolvedLane
                === this.currentRow.bonusLane
                    ? 220
                    : 0;

            if (leafBonus) {
                this.leavesCollected += 1;
            }

            this.score +=
                500
                + streakBonus
                + leafBonus;

            if (leafBonus) {
                this.feedback =
                    'SAFE CLIMB + GOLDEN LEAF!';
            } else if (
                this.streak >= 4
            ) {
                this.feedback =
                    `${this.streak} SAFE CLIMBS!`;
            } else {
                this.feedback =
                    'SAFE BRANCH!';
            }

            this.feedbackType =
                'safe';
        }

        this.feedbackUntil =
            now + 820;

        this.updateHud();

        if (
            this.levelsCompleted
            >= this.TOTAL_LEVELS
        ) {
            this.completedAt =
                now;

            this.phase =
                'canopy';

            this.updateLaneButtons();

            this.finishTimer =
                setTimeout(
                    () => {
                        this.finishTimer = null;

                        this.finishGame();
                    },
                    850
                );

            return;
        }

        this.currentRow = null;

        this.spawnNextRow();
    },


    calculateAccuracy: function() {
        return Math.round(
            (
                this.safeClimbs
                / this.TOTAL_LEVELS
            ) * 100
        );
    },


    calculateFinalScore: function() {
        const elapsed =
            Math.max(
                0,
                this.completedAt
                - this.startTime
            );

        const timeBonus =
            Math.max(
                0,
                2400
                - Math.floor(
                    elapsed / 18
                )
            );

        const canopyBonus =
            1400;

        const perfectClimbBonus =
            this.safeClimbs
                === this.TOTAL_LEVELS
                ? 1800
                : 0;

        const bestStreakBonus =
            this.bestStreak * 100;

        const leafBonus =
            this.leavesCollected * 90;

        return Math.max(
            0,
            Math.round(
                this.score
                + timeBonus
                + canopyBonus
                + perfectClimbBonus
                + bestStreakBonus
                + leafBonus
            )
        );
    },


    updateHud: function() {
        const height =
            document.getElementById(
                'zacHeight'
            );

        const safe =
            document.getElementById(
                'zacSafe'
            );

        const score =
            document.getElementById(
                'zacScore'
            );

        if (height) {
            height.textContent =
                `${this.levelsCompleted} / ${this.TOTAL_LEVELS}`;
        }

        if (safe) {
            safe.textContent =
                String(
                    this.safeClimbs
                );
        }

        if (score) {
            score.textContent =
                Number(
                    this.score
                ).toLocaleString();
        }

        this.updateLaneButtons();
    },


    loop: function(now) {
        if (!this.isPlaying) {
            return;
        }

        const delta =
            Math.min(
                0.05,
                Math.max(
                    0,
                    (
                        now
                        - this.lastFrameTime
                    ) / 1000
                )
            );

        this.lastFrameTime = now;

        /*
         * Smooth player movement makes late lane changes
         * meaningful instead of instantly teleporting.
         */
        const targetX =
            this.laneX[
                this.targetLane
            ];

        const moveSpeed = 430;

        const difference =
            targetX
            - this.playerX;

        const maxMove =
            moveSpeed * delta;

        if (
            Math.abs(difference)
            <= maxMove
        ) {
            this.playerX =
                targetX;

            this.playerLane =
                this.targetLane;
        } else {
            this.playerX +=
                Math.sign(difference)
                * maxMove;
        }

        if (
            this.phase === 'climbing'
            && this.currentRow
        ) {
            this.currentRow.y +=
                this.getClimbSpeed()
                * delta;

            /*
             * Branch decision line.
             */
            if (
                !this.currentRow.resolved
                && this.currentRow.y
                    >= 365
            ) {
                this.resolveBranch(
                    now
                );
            }
        }

        this.drawScene(now);

        this.animationFrameId =
            requestAnimationFrame(
                next =>
                    this.loop(next)
            );
    },


    drawScene: function(now) {
        if (
            !this.ctx
            || !this.canvas
        ) {
            return;
        }

        const ctx =
            this.ctx;

        ctx.clearRect(
            0,
            0,
            720,
            520
        );

        this.drawBackground(
            ctx,
            now
        );

        this.drawTree(
            ctx,
            now
        );

        if (this.currentRow) {
            this.drawBranchRow(
                ctx,
                this.currentRow,
                now
            );
        }

        this.drawPlayer(
            ctx,
            now
        );

        this.drawProgress(
            ctx,
            now
        );
    },


    drawBackground: function(
        ctx,
        now
    ) {
        const sky =
            ctx.createLinearGradient(
                0,
                0,
                0,
                520
            );

        sky.addColorStop(
            0,
            '#D8EBC0'
        );

        sky.addColorStop(
            0.44,
            '#6F9A52'
        );

        sky.addColorStop(
            1,
            '#1F3B22'
        );

        ctx.fillStyle =
            sky;

        ctx.fillRect(
            0,
            0,
            720,
            520
        );

        /*
         * Distant road below the tree.
         */
        ctx.fillStyle =
            'rgba(188,158,109,.38)';

        ctx.beginPath();

        ctx.moveTo(
            0,
            500
        );

        ctx.quadraticCurveTo(
            340,
            425,
            720,
            500
        );

        ctx.lineTo(
            720,
            520
        );

        ctx.lineTo(
            0,
            520
        );

        ctx.closePath();

        ctx.fill();

        /*
         * Soft canopy depth.
         */
        for (
            let i = 0;
            i < 16;
            i += 1
        ) {
            const x =
                (
                    i * 93
                    + 37
                ) % 760
                - 20;

            const y =
                45
                + (
                    (
                        i * 71
                    ) % 260
                );

            const pulse =
                Math.sin(
                    now / 800
                    + i
                ) * 2;

            ctx.beginPath();

            ctx.arc(
                x,
                y + pulse,
                36
                    + (
                        i % 4
                    ) * 7,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                i % 2
                    ? 'rgba(52,88,40,.23)'
                    : 'rgba(83,122,54,.24)';

            ctx.fill();
        }
    },


    drawTree: function(
        ctx,
        now
    ) {
        ctx.save();

        const trunk =
            ctx.createLinearGradient(
                300,
                0,
                430,
                0
            );

        trunk.addColorStop(
            0,
            '#5B3922'
        );

        trunk.addColorStop(
            0.48,
            '#8A5B34'
        );

        trunk.addColorStop(
            1,
            '#4A2D1C'
        );

        ctx.fillStyle =
            trunk;

        ctx.beginPath();

        ctx.moveTo(
            307,
            520
        );

        ctx.bezierCurveTo(
            320,
            380,
            315,
            215,
            332,
            0
        );

        ctx.lineTo(
            405,
            0
        );

        ctx.bezierCurveTo(
            410,
            210,
            424,
            390,
            438,
            520
        );

        ctx.closePath();

        ctx.fill();

        /*
         * Vertical bark texture.
         */
        ctx.strokeStyle =
            'rgba(48,28,18,.35)';

        ctx.lineWidth = 3;

        for (
            let i = 0;
            i < 5;
            i += 1
        ) {
            const x =
                330
                + (
                    i * 18
                );

            const offset =
                Math.sin(
                    now / 900
                    + i
                ) * 2;

            ctx.beginPath();

            ctx.moveTo(
                x,
                500
            );

            ctx.bezierCurveTo(
                x - 10,
                370,
                x + 12 + offset,
                190,
                x,
                20
            );

            ctx.stroke();
        }

        ctx.restore();
    },


    drawBranchRow: function(
        ctx,
        row,
        now
    ) {
        ctx.save();

        for (
            let lane = 0;
            lane < 3;
            lane += 1
        ) {
            const x =
                this.laneX[lane];

            const isHazard =
                lane
                === row.hazardLane;

            const isBonus =
                lane
                === row.bonusLane
                && !isHazard;

            /*
             * Branch.
             */
            ctx.strokeStyle =
                isHazard
                    ? '#694236'
                    : '#704728';

            ctx.lineWidth =
                isHazard
                    ? 13
                    : 15;

            ctx.lineCap =
                'round';

            ctx.beginPath();

            ctx.moveTo(
                360,
                row.y + 16
            );

            ctx.quadraticCurveTo(
                (
                    360 + x
                ) / 2,
                row.y - 3,
                x,
                row.y
            );

            ctx.stroke();

            /*
             * Branch end / foothold.
             */
            ctx.beginPath();

            ctx.moveTo(
                x - 42,
                row.y
            );

            ctx.lineTo(
                x + 42,
                row.y
            );

            ctx.stroke();

            if (isHazard) {
                /*
                 * Highly visible cracks.
                 */
                ctx.strokeStyle =
                    '#FCA5A5';

                ctx.lineWidth = 3;

                ctx.beginPath();

                ctx.moveTo(
                    x - 10,
                    row.y - 8
                );

                ctx.lineTo(
                    x - 2,
                    row.y + 1
                );

                ctx.lineTo(
                    x - 11,
                    row.y + 9
                );

                ctx.moveTo(
                    x + 9,
                    row.y - 7
                );

                ctx.lineTo(
                    x + 2,
                    row.y + 2
                );

                ctx.lineTo(
                    x + 12,
                    row.y + 8
                );

                ctx.stroke();

                ctx.font =
                    '900 10px Arial';

                ctx.textAlign =
                    'center';

                ctx.fillStyle =
                    '#FECACA';

                ctx.fillText(
                    'CRACKED',
                    x,
                    row.y - 19
                );
            } else {
                /*
                 * Leaf cluster around safe footholds.
                 */
                for (
                    let leaf = 0;
                    leaf < 3;
                    leaf += 1
                ) {
                    ctx.beginPath();

                    ctx.ellipse(
                        x
                            + (
                                leaf - 1
                            ) * 17,
                        row.y - 9
                            + Math.sin(
                                now / 300
                                + leaf
                            ) * 2,
                        8,
                        4,
                        (
                            leaf - 1
                        ) * .25,
                        0,
                        Math.PI * 2
                    );

                    ctx.fillStyle =
                        '#6B8E3E';

                    ctx.fill();
                }
            }

            if (isBonus) {
                /*
                 * Golden leaf reward — gameplay bonus only,
                 * not Life Points.
                 */
                ctx.save();

                ctx.translate(
                    x,
                    row.y - 30
                );

                ctx.rotate(
                    -.45
                );

                ctx.beginPath();

                ctx.ellipse(
                    0,
                    0,
                    9,
                    5,
                    0,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    '#F5C451';

                ctx.shadowColor =
                    '#F5D98A';

                ctx.shadowBlur =
                    10;

                ctx.fill();

                ctx.restore();
            }
        }

        /*
         * Level label.
         */
        ctx.textAlign =
            'center';

        ctx.font =
            '800 11px Arial';

        ctx.fillStyle =
            '#F7FEE7';

        ctx.fillText(
            `BRANCH ${row.level}`,
            360,
            row.y - 49
        );

        /*
         * Decision line becomes visible near Zacchaeus.
         */
        if (
            row.y > 300
            && !row.resolved
        ) {
            ctx.strokeStyle =
                'rgba(245,217,138,.30)';

            ctx.lineWidth = 2;

            ctx.setLineDash(
                [7, 8]
            );

            ctx.beginPath();

            ctx.moveTo(
                150,
                365
            );

            ctx.lineTo(
                570,
                365
            );

            ctx.stroke();

            ctx.setLineDash([]);
        }

        ctx.restore();
    },


    drawPlayer: function(
        ctx,
        now
    ) {
        const x =
            this.playerX;

        const y =
            this.playerY;

        ctx.save();

        /*
         * Subtle lane guide.
         */
        ctx.beginPath();

        ctx.arc(
            x,
            y + 3,
            28,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            'rgba(245,217,138,.10)';

        ctx.fill();

        /*
         * Body.
         */
        ctx.strokeStyle =
            '#E9D5B3';

        ctx.lineWidth = 7;
        ctx.lineCap = 'round';

        ctx.beginPath();

        ctx.moveTo(
            x,
            y - 9
        );

        ctx.lineTo(
            x,
            y + 19
        );

        ctx.stroke();

        /*
         * Head.
         */
        ctx.beginPath();

        ctx.arc(
            x,
            y - 21,
            10,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            '#D9A46C';

        ctx.fill();

        /*
         * Robe.
         */
        ctx.fillStyle =
            '#6D4C7D';

        ctx.beginPath();

        ctx.moveTo(
            x - 12,
            y - 8
        );

        ctx.lineTo(
            x + 12,
            y - 8
        );

        ctx.lineTo(
            x + 17,
            y + 19
        );

        ctx.lineTo(
            x - 17,
            y + 19
        );

        ctx.closePath();

        ctx.fill();

        /*
         * Arms gripping branches/trunk.
         */
        const armLift =
            Math.sin(
                now / 170
            ) * 2;

        ctx.strokeStyle =
            '#D9A46C';

        ctx.lineWidth = 5;

        ctx.beginPath();

        ctx.moveTo(
            x - 7,
            y
        );

        ctx.lineTo(
            x - 20,
            y - 13 + armLift
        );

        ctx.moveTo(
            x + 7,
            y
        );

        ctx.lineTo(
            x + 20,
            y - 13 - armLift
        );

        ctx.stroke();

        ctx.restore();
    },


    drawProgress: function(
        ctx,
        now
    ) {
        ctx.save();

        ctx.textAlign =
            'center';

        ctx.fillStyle =
            '#FFF1BE';

        ctx.font =
            '900 18px Arial';

        ctx.fillText(
            'ZACCHAEUS — TREE CLIMB',
            360,
            31
        );

        ctx.fillStyle =
            '#E7F1DA';

        ctx.font =
            '700 10px Arial';

        ctx.fillText(
            'LUKE 19:4',
            360,
            49
        );

        /*
         * Progress track.
         */
        const progress =
            Math.min(
                1,
                this.levelsCompleted
                / this.TOTAL_LEVELS
            );

        ctx.fillStyle =
            'rgba(255,255,255,.16)';

        ctx.fillRect(
            240,
            64,
            240,
            8
        );

        ctx.fillStyle =
            '#F5D98A';

        ctx.fillRect(
            240,
            64,
            240 * progress,
            8
        );

        /*
         * Current target lane markers.
         */
        this.laneX.forEach(
            (x, lane) => {
                ctx.beginPath();

                ctx.arc(
                    x,
                    92,
                    lane
                        === this.targetLane
                            ? 8
                            : 5,
                    0,
                    Math.PI * 2
                );

                ctx.fillStyle =
                    lane
                        === this.targetLane
                            ? '#F5D98A'
                            : 'rgba(255,255,255,.28)';

                ctx.fill();
            }
        );

        if (
            this.feedback
            && now
                < this.feedbackUntil
        ) {
            const colors = {
                safe:
                    '#D9F99D',

                miss:
                    '#FECACA',

                info:
                    '#F8FAFC'
            };

            ctx.fillStyle =
                colors[
                    this.feedbackType
                ] || '#FFFFFF';

            ctx.font =
                '900 17px Arial';

            ctx.shadowColor =
                'rgba(0,0,0,.55)';

            ctx.shadowBlur = 7;

            ctx.fillText(
                this.feedback,
                360,
                121
            );

            ctx.shadowBlur = 0;
        }

        if (
            this.phase
            === 'canopy'
        ) {
            ctx.fillStyle =
                'rgba(255,246,201,.14)';

            ctx.fillRect(
                0,
                0,
                720,
                520
            );

            ctx.fillStyle =
                '#FFF1BE';

            ctx.font =
                '900 28px Arial';

            ctx.fillText(
                'CANOPY REACHED!',
                360,
                175
            );

            ctx.font =
                '700 14px Arial';

            ctx.fillStyle =
                '#F7FEE7';

            ctx.fillText(
                'A clear view from above the crowd',
                360,
                201
            );
        }

        ctx.restore();
    },


    finishGame: async function() {
        if (this.finishSubmitted) {
            return;
        }

        this.finishSubmitted = true;
        this.isPlaying = false;
        this.phase = 'finished';

        if (this.animationFrameId) {
            cancelAnimationFrame(
                this.animationFrameId
            );

            this.animationFrameId =
                null;
        }

        if (this.finishTimer) {
            clearTimeout(
                this.finishTimer
            );

            this.finishTimer = null;
        }

        const finalScore =
            this.calculateFinalScore();

        const accuracy =
            this.calculateAccuracy();

        this.score =
            finalScore;

        this.updateHud();

        const overlay =
            document.getElementById(
                'zacOverlay'
            );

        if (overlay) {
            overlay.style.display =
                'flex';

            overlay.innerHTML = `
                <h2>
                    CANOPY REACHED
                </h2>

                <p>
                    Saving your Game Score…
                </p>

                <small>
                    Safe climbs:
                    ${this.safeClimbs}/${this.TOTAL_LEVELS}
                    &nbsp;•&nbsp;
                    Golden leaves:
                    ${this.leavesCollected}
                    &nbsp;•&nbsp;
                    Best streak:
                    ${this.bestStreak}
                </small>
            `;
        }

        if (
            window.V10Expansion
            && typeof
                window.V10Expansion
                    .submitCanvasGameResult
                === 'function'
        ) {
            await window.V10Expansion
                .submitCanvasGameResult({
                    gameName:
                        'Zacchaeus: Tree Climb',

                    score:
                        finalScore,

                    overlayId:
                        'zacOverlay',

                    playAgain:
                        'V13Zacchaeus.startGame()',

                    accuracy
                });
        }
    },


    cleanup: function() {
        this.isPlaying = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(
                this.animationFrameId
            );

            this.animationFrameId =
                null;
        }

        if (this.finishTimer) {
            clearTimeout(
                this.finishTimer
            );

            this.finishTimer = null;
        }

        this.cleanupEvents();
    },


    exitGame: function() {
        this.cleanup();

        if (
            window.V10Expansion
            && typeof
                window.V10Expansion
                    .exitGame
                === 'function'
        ) {
            window.V10Expansion
                .exitGame();

            return;
        }

        const area =
            document.getElementById(
                'arcadeActiveGameArea'
            );

        if (area) {
            area.style.display =
                'none';

            area.innerHTML = '';
        }

        const list =
            document.getElementById(
                'arcadeGamesList'
            );

        if (list) {
            list.style.display =
                'block';
        }
    }
};
