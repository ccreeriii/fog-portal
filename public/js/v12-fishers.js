'use strict';

/*
 * Fishers of Men: Perfect Cast
 *
 * Five-cast timing game inspired by the fishing imagery
 * around Jesus' call in Matthew 4:19.
 *
 * Game Score = gameplay performance.
 * Life Points remain controlled by the shared server economy.
 */

window.V12Fishers = {
    gameName:
        'Fishers of Men: Perfect Cast',

    canvas: null,
    ctx: null,

    animationFrameId: null,
    roundTimer: null,

    boundPointerHandler: null,
    boundKeyHandler: null,

    isPlaying: false,
    finishSubmitted: false,

    MAX_CASTS: 5,

    castsCompleted: 0,

    score: 0,
    misses: 0,

    perfect: 0,
    great: 0,
    good: 0,

    streak: 0,
    bestStreak: 0,

    phase: 'idle',

    reticleX: 150,
    reticleDirection: 1,

    schoolX: 430,
    schoolY: 245,
    schoolDirection: -1,

    lastFrameTime: 0,
    startTime: 0,
    completedAt: 0,

    feedback: '',
    feedbackGrade: '',
    feedbackUntil: 0,

    castAnimation: null,


    initStyles: function() {
        if (
            document.getElementById(
                'fishers-perfect-cast-css'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'fishers-perfect-cast-css';

        style.textContent = `
            .fishers-game-shell {
                width: 100%;
                max-width: 780px;
                margin: 0 auto;

                overflow: hidden;

                border-radius: 18px;

                border:
                    1px solid #B8D7D5;

                background: #071923;

                box-shadow:
                    0 22px 60px
                    rgba(15,23,42,.22);
            }

            .fishers-game-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 10px;

                padding: 10px 14px;

                background:
                    linear-gradient(
                        135deg,
                        #F4FBFA,
                        #E5F3F1
                    );

                border-bottom:
                    1px solid #BAD7D5;
            }

            .fishers-game-stats {
                display: flex;
                align-items: center;
                justify-content: flex-end;

                flex-wrap: wrap;

                gap: 6px 12px;

                color: #334155;

                font-size: .76rem;
                font-weight: 800;
            }

            .fishers-game-stat strong {
                color: #0F766E;
            }

            .fishers-stage {
                position: relative;

                width: 100%;

                background:
                    #071923;
            }

            #fishersCanvas {
                display: block;

                width: 100%;
                max-width: 720px;
                height: auto;

                margin: 0 auto;

                touch-action: none;

                user-select: none;
                -webkit-user-select: none;
            }

            .fishers-start-overlay {
                position: absolute;
                inset: 0;

                z-index: 5;

                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;

                gap: 12px;

                padding: 28px;

                box-sizing: border-box;

                background:
                    linear-gradient(
                        180deg,
                        rgba(4,20,29,.91),
                        rgba(7,35,48,.95)
                    );

                color: #FFFFFF;

                text-align: center;
            }

            .fishers-start-overlay h2 {
                margin: 0;
                padding: 0;

                border: 0;

                color: #F5D58C;

                font-size: 1.85rem;
                line-height: 1.1;
            }

            .fishers-start-overlay p {
                max-width: 570px;

                margin: 0;

                color: #D9EEF0;

                font-size: .9rem;
                line-height: 1.55;
            }

            .fishers-start-overlay small {
                max-width: 540px;

                color: #BFD7DD;

                line-height: 1.45;
            }

            .fishers-controls {
                display: grid;

                grid-template-columns:
                    minmax(0, 1fr);

                gap: 8px;

                padding: 11px;

                background:
                    linear-gradient(
                        180deg,
                        #F7FCFB,
                        #EAF5F3
                    );

                border-top:
                    1px solid #BAD7D5;
            }

            #fmCastButton {
                min-height: 52px;

                border-radius: 13px;

                border-color: #0F766E;

                background:
                    linear-gradient(
                        135deg,
                        #0F766E,
                        #0D9488
                    );

                color: #FFFFFF;

                font-size: .88rem;
                font-weight: 900;

                letter-spacing: .025em;
            }

            #fmCastButton:disabled {
                opacity: .48;
                cursor: not-allowed;
            }


            /* ================================================
               FISHERS RESULT CONTRAST
               ================================================ */

            #fmOverlay .game-result-card {
                width: min(92%, 620px) !important;
                max-height: calc(100% - 24px) !important;

                overflow-y: auto !important;

                box-sizing: border-box !important;
                padding: 20px !important;

                background: #FFFDF7 !important;
                color: #0F172A !important;

                border: 1px solid #B8D7D5 !important;
                border-radius: 18px !important;

                box-shadow:
                    0 24px 70px
                    rgba(2,20,29,.38) !important;

                text-align: center !important;
            }

            #fmOverlay .game-result-eyebrow {
                color: #0F766E !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-card h2 {
                color: #115E59 !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-stats > div {
                background: #F0FDFA !important;
                border: 1px solid #CCFBF1 !important;

                color: #0F172A !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-stats span {
                color: #475569 !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-stats strong {
                color: #0F172A !important;
                opacity: 1 !important;

                font-weight: 900 !important;
            }

            #fmOverlay .game-cap-message {
                color: #475569 !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-actions .btn-primary {
                color: #FFFFFF !important;
                opacity: 1 !important;
            }

            #fmOverlay .game-result-actions .btn-outline {
                color: #334155 !important;
                opacity: 1 !important;
            }

            @media (max-width: 520px) {
                .fishers-game-header {
                    padding: 8px 10px;
                }

                .fishers-game-stats {
                    gap: 4px 8px;

                    font-size: .67rem;
                }

                .fishers-start-overlay {
                    padding: 19px;
                }

                .fishers-start-overlay h2 {
                    font-size: 1.5rem;
                }

                .fishers-start-overlay p {
                    font-size: .8rem;
                }

                .fishers-controls {
                    padding: 8px;
                }

                #fmCastButton {
                    min-height: 48px;

                    font-size: .78rem;
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
            <div class="fishers-game-shell">
                <div class="fishers-game-header">
                    <button
                        class="btn btn-outline btn-sm"
                        onclick="V12Fishers.exitGame()"
                    >
                        🔙 Games
                    </button>

                    <div class="fishers-game-stats">
                        <span class="fishers-game-stat">
                            CASTS
                            <strong id="fmCastDisplay">
                                0 / 5
                            </strong>
                        </span>

                        <span class="fishers-game-stat">
                            MISSES
                            <strong id="fmMissDisplay">
                                0
                            </strong>
                        </span>

                        <span class="fishers-game-stat">
                            SCORE
                            <strong id="fmScoreDisplay">
                                0
                            </strong>
                        </span>
                    </div>
                </div>

                <div class="fishers-stage">
                    <canvas
                        id="fishersCanvas"
                        width="720"
                        height="520"
                        aria-label="Fishers of Men Perfect Cast timing game"
                    ></canvas>

                    <div
                        id="fmOverlay"
                        class="fishers-start-overlay"
                    >
                        <h2>
                            FISHERS OF MEN
                        </h2>

                        <p>
                            PERFECT CAST
                        </p>

                        <p>
                            Time five casts from the boat.
                            Cast the net when the moving landing
                            marker reaches the school of fish.
                        </p>

                        <small>
                            PERFECT, GREAT and GOOD earn points.
                            A MISS still uses the cast.
                            Later casts become faster and more precise.
                            Inspired by Matthew 4:19.
                        </small>

                        <button
                            class="btn btn-primary"
                            style="
                                min-width:190px;
                                padding:12px 20px;
                                background:#0F766E;
                                border-color:#0F766E;
                            "
                            onclick="V12Fishers.startGame()"
                        >
                            🎣 BEGIN FISHING
                        </button>
                    </div>
                </div>

                <div class="fishers-controls">
                    <button
                        id="fmCastButton"
                        class="btn"
                        type="button"
                        onclick="V12Fishers.attemptCast()"
                        disabled
                    >
                        🎣 CAST THE NET
                    </button>
                </div>
            </div>
        `;

        this.canvas =
            document.getElementById(
                'fishersCanvas'
            );

        this.ctx =
            this.canvas
                ? this.canvas.getContext('2d')
                : null;

        this.bindEvents();

        this.phase = 'idle';

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
                    || this.phase !== 'aiming'
                ) {
                    return;
                }

                event.preventDefault();

                this.attemptCast();
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
                    || this.phase !== 'aiming'
                ) {
                    return;
                }

                if (
                    event.key !== ' '
                    && event.key !== 'Enter'
                ) {
                    return;
                }

                event.preventDefault();

                this.attemptCast();
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
                'fmOverlay'
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

        if (this.roundTimer) {
            clearTimeout(
                this.roundTimer
            );

            this.roundTimer = null;
        }

        this.isPlaying = true;
        this.finishSubmitted = false;

        this.castsCompleted = 0;

        this.score = 0;
        this.misses = 0;

        this.perfect = 0;
        this.great = 0;
        this.good = 0;

        this.streak = 0;
        this.bestStreak = 0;

        this.castAnimation = null;

        const now =
            performance.now();

        this.startTime = now;
        this.completedAt = 0;
        this.lastFrameTime = now;

        this.prepareCast(true);

        this.loop(now);
    },


    prepareCast: function(initial) {
        if (!this.isPlaying) {
            return;
        }

        const castIndex =
            this.castsCompleted;

        this.phase = 'aiming';

        /*
         * Alternate the reticle's starting edge so the
         * rhythm does not feel identical every cast.
         */
        if (
            (
                castIndex
                % 2
            ) === 0
        ) {
            this.reticleX = 145;
            this.reticleDirection = 1;
        } else {
            this.reticleX = 575;
            this.reticleDirection = -1;
        }

        this.schoolX =
            200
            + (
                Math.random()
                * 320
            );

        this.schoolY =
            232
            + (
                Math.random()
                * 46
            );

        this.schoolDirection =
            Math.random() > 0.5
                ? 1
                : -1;

        const now =
            performance.now();

        this.feedback =
            `CAST ${
                this.castsCompleted + 1
            } OF ${this.MAX_CASTS}`;

        this.feedbackGrade =
            'start';

        this.feedbackUntil =
            now
            + (
                initial
                    ? 1100
                    : 760
            );

        this.lastFrameTime = now;

        this.updateHud();
    },


    getReticleSpeed: function() {
        /*
         * Later casts move faster.
         */
        return (
            145
            + (
                this.castsCompleted
                * 18
            )
        );
    },


    getSchoolSpeed: function() {
        return (
            28
            + (
                this.castsCompleted
                * 7
            )
        );
    },


    getTimingWindows: function() {
        /*
         * Accuracy window tightens slightly each cast.
         */
        const good =
            Math.max(
                46,
                68
                - (
                    this.castsCompleted
                    * 5
                )
            );

        return {
            perfect:
                good * 0.28,

            great:
                good * 0.58,

            good
        };
    },


    getGrade: function(distance) {
        const windows =
            this.getTimingWindows();

        if (
            distance
            <= windows.perfect
        ) {
            return {
                name: 'PERFECT',
                points: 1200
            };
        }

        if (
            distance
            <= windows.great
        ) {
            return {
                name: 'GREAT',
                points: 900
            };
        }

        if (
            distance
            <= windows.good
        ) {
            return {
                name: 'GOOD',
                points: 650
            };
        }

        return null;
    },


    attemptCast: function() {
        if (
            !this.isPlaying
            || this.phase !== 'aiming'
        ) {
            return;
        }

        const now =
            performance.now();

        const landingX =
            this.reticleX;

        const landingY =
            this.schoolY;

        const distance =
            Math.abs(
                landingX
                - this.schoolX
            );

        const grade =
            this.getGrade(
                distance
            );

        this.castsCompleted += 1;

        if (grade) {
            this.streak += 1;

            this.bestStreak =
                Math.max(
                    this.bestStreak,
                    this.streak
                );

            const streakBonus =
                Math.min(
                    this.streak,
                    this.MAX_CASTS
                ) * 110;

            this.score +=
                grade.points
                + streakBonus;

            if (
                grade.name
                === 'PERFECT'
            ) {
                this.perfect += 1;
            } else if (
                grade.name
                === 'GREAT'
            ) {
                this.great += 1;
            } else {
                this.good += 1;
            }

            this.feedback =
                `${grade.name} CAST!`;

            this.feedbackGrade =
                grade.name;
        } else {
            this.misses += 1;
            this.streak = 0;

            this.feedback =
                'MISS — TRY THE NEXT CAST';

            this.feedbackGrade =
                'MISS';
        }

        this.feedbackUntil =
            now + 850;

        this.castAnimation = {
            start: now,

            fromX: 360,
            fromY: 426,

            toX: landingX,
            toY: landingY,

            grade:
                grade
                    ? grade.name
                    : 'MISS'
        };

        this.phase = 'casting';

        this.updateHud();

        if (this.roundTimer) {
            clearTimeout(
                this.roundTimer
            );
        }

        this.roundTimer =
            setTimeout(
                () => {
                    this.roundTimer = null;

                    if (!this.isPlaying) {
                        return;
                    }

                    if (
                        this.castsCompleted
                        >= this.MAX_CASTS
                    ) {
                        this.completedAt =
                            performance.now();

                        this.finishGame();

                        return;
                    }

                    this.prepareCast(false);
                },
                760
            );
    },


    calculateAccuracy: function() {
        const weighted =
            this.perfect
            + (
                this.great * 0.82
            )
            + (
                this.good * 0.65
            );

        return Math.round(
            (
                weighted
                / this.MAX_CASTS
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

        /*
         * Roughly 30 seconds or slower exhausts
         * the speed bonus.
         */
        const timeBonus =
            Math.max(
                0,
                2000
                - Math.floor(
                    elapsed / 15
                )
            );

        const completionBonus =
            1200;

        const perfectFiveBonus =
            this.perfect
                === this.MAX_CASTS
                ? 1500
                : 0;

        const missPenalty =
            this.misses * 200;

        return Math.max(
            0,
            Math.round(
                this.score
                + completionBonus
                + perfectFiveBonus
                + timeBonus
                - missPenalty
            )
        );
    },


    updateHud: function() {
        const castDisplay =
            document.getElementById(
                'fmCastDisplay'
            );

        const missDisplay =
            document.getElementById(
                'fmMissDisplay'
            );

        const scoreDisplay =
            document.getElementById(
                'fmScoreDisplay'
            );

        const castButton =
            document.getElementById(
                'fmCastButton'
            );

        if (castDisplay) {
            castDisplay.textContent =
                `${this.castsCompleted} / ${this.MAX_CASTS}`;
        }

        if (missDisplay) {
            missDisplay.textContent =
                String(this.misses);
        }

        if (scoreDisplay) {
            scoreDisplay.textContent =
                Number(
                    this.score
                ).toLocaleString();
        }

        if (castButton) {
            castButton.disabled =
                this.phase
                !== 'aiming';

            if (
                this.phase
                === 'aiming'
            ) {
                castButton.textContent =
                    `🎣 CAST ${
                        this.castsCompleted + 1
                    } OF ${this.MAX_CASTS}`;
            } else if (
                this.phase
                === 'casting'
            ) {
                castButton.textContent =
                    '🌊 NET IN THE WATER';
            } else {
                castButton.textContent =
                    '🎣 CAST COMPLETE';
            }
        }
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

        if (
            this.phase
            === 'aiming'
        ) {
            this.reticleX +=
                this.reticleDirection
                * this.getReticleSpeed()
                * delta;

            if (
                this.reticleX
                >= 590
            ) {
                this.reticleX = 590;
                this.reticleDirection = -1;
            }

            if (
                this.reticleX
                <= 130
            ) {
                this.reticleX = 130;
                this.reticleDirection = 1;
            }

            this.schoolX +=
                this.schoolDirection
                * this.getSchoolSpeed()
                * delta;

            if (
                this.schoolX
                >= 545
            ) {
                this.schoolX = 545;
                this.schoolDirection = -1;
            }

            if (
                this.schoolX
                <= 175
            ) {
                this.schoolX = 175;
                this.schoolDirection = 1;
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

        const ctx = this.ctx;

        ctx.clearRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );

        this.drawSky(ctx);
        this.drawWater(ctx, now);
        this.drawFishSchool(ctx, now);
        this.drawReticle(ctx, now);
        this.drawBoat(ctx);
        this.drawCastAnimation(ctx, now);
        this.drawProgress(ctx, now);
    },


    drawSky: function(ctx) {
        const sky =
            ctx.createLinearGradient(
                0,
                0,
                0,
                220
            );

        sky.addColorStop(
            0,
            '#102B3A'
        );

        sky.addColorStop(
            0.58,
            '#355B67'
        );

        sky.addColorStop(
            1,
            '#C19B6B'
        );

        ctx.fillStyle = sky;

        ctx.fillRect(
            0,
            0,
            720,
            220
        );

        /*
         * Warm horizon glow.
         */
        const glow =
            ctx.createRadialGradient(
                555,
                112,
                6,
                555,
                112,
                95
            );

        glow.addColorStop(
            0,
            'rgba(250,215,145,.70)'
        );

        glow.addColorStop(
            1,
            'rgba(250,215,145,0)'
        );

        ctx.fillStyle = glow;

        ctx.fillRect(
            430,
            10,
            250,
            190
        );

        /*
         * Distant hills.
         */
        ctx.fillStyle =
            'rgba(21,48,55,.72)';

        ctx.beginPath();

        ctx.moveTo(
            0,
            180
        );

        ctx.lineTo(
            95,
            137
        );

        ctx.lineTo(
            175,
            171
        );

        ctx.lineTo(
            285,
            123
        );

        ctx.lineTo(
            390,
            169
        );

        ctx.lineTo(
            505,
            134
        );

        ctx.lineTo(
            620,
            168
        );

        ctx.lineTo(
            720,
            140
        );

        ctx.lineTo(
            720,
            220
        );

        ctx.lineTo(
            0,
            220
        );

        ctx.closePath();
        ctx.fill();
    },


    drawWater: function(
        ctx,
        now
    ) {
        const water =
            ctx.createLinearGradient(
                0,
                195,
                0,
                520
            );

        water.addColorStop(
            0,
            '#245C69'
        );

        water.addColorStop(
            0.45,
            '#0F4857'
        );

        water.addColorStop(
            1,
            '#07323E'
        );

        ctx.fillStyle = water;

        ctx.fillRect(
            0,
            195,
            720,
            325
        );

        /*
         * Soft moving wave highlights.
         */
        ctx.save();

        ctx.lineWidth = 1.5;

        for (
            let row = 0;
            row < 8;
            row += 1
        ) {
            const y =
                220
                + (
                    row * 36
                );

            const phase =
                (
                    now / 550
                )
                + (
                    row * 0.7
                );

            ctx.beginPath();

            for (
                let x = -20;
                x <= 740;
                x += 18
            ) {
                const yy =
                    y
                    + Math.sin(
                        (
                            x / 45
                        )
                        + phase
                    ) * 3;

                if (x === -20) {
                    ctx.moveTo(
                        x,
                        yy
                    );
                } else {
                    ctx.lineTo(
                        x,
                        yy
                    );
                }
            }

            ctx.strokeStyle =
                row % 2
                    ? 'rgba(173,225,226,.13)'
                    : 'rgba(245,214,155,.10)';

            ctx.stroke();
        }

        ctx.restore();
    },


    drawFishSchool: function(
        ctx,
        now
    ) {
        const windows =
            this.getTimingWindows();

        ctx.save();

        /*
         * GOOD accuracy halo.
         */
        ctx.beginPath();

        ctx.arc(
            this.schoolX,
            this.schoolY,
            windows.good,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            'rgba(56,189,248,.055)';

        ctx.fill();

        ctx.strokeStyle =
            'rgba(125,211,252,.18)';

        ctx.lineWidth = 2;
        ctx.stroke();

        /*
         * GREAT halo.
         */
        ctx.beginPath();

        ctx.arc(
            this.schoolX,
            this.schoolY,
            windows.great,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            'rgba(52,211,153,.36)';

        ctx.lineWidth = 2;
        ctx.stroke();

        /*
         * PERFECT halo.
         */
        ctx.beginPath();

        ctx.arc(
            this.schoolX,
            this.schoolY,
            windows.perfect,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            '#F5D58C';

        ctx.lineWidth = 3;

        ctx.shadowColor =
            '#F5D58C';

        ctx.shadowBlur =
            8
            + (
                Math.sin(
                    now / 180
                ) + 1
            ) * 3;

        ctx.stroke();

        ctx.shadowBlur = 0;

        /*
         * Fish silhouettes.
         */
        const offsets = [
            [-30,-11],
            [-13,7],
            [5,-16],
            [24,8],
            [39,-7],
            [-40,17],
            [8,21]
        ];

        offsets.forEach(
            ([dx, dy], index) => {
                const fishX =
                    this.schoolX
                    + dx;

                const fishY =
                    this.schoolY
                    + dy
                    + Math.sin(
                        (
                            now / 270
                        )
                        + index
                    ) * 2;

                const direction =
                    (
                        index % 2
                    ) === 0
                        ? 1
                        : -1;

                ctx.save();

                ctx.translate(
                    fishX,
                    fishY
                );

                ctx.scale(
                    direction,
                    1
                );

                ctx.fillStyle =
                    'rgba(226,244,241,.78)';

                ctx.beginPath();

                ctx.ellipse(
                    0,
                    0,
                    7,
                    3.6,
                    0,
                    0,
                    Math.PI * 2
                );

                ctx.fill();

                ctx.beginPath();

                ctx.moveTo(
                    -6,
                    0
                );

                ctx.lineTo(
                    -11,
                    -4
                );

                ctx.lineTo(
                    -11,
                    4
                );

                ctx.closePath();

                ctx.fill();

                ctx.restore();
            }
        );

        ctx.font =
            '700 10px Arial';

        ctx.textAlign =
            'center';

        ctx.fillStyle =
            '#D8ECEC';

        ctx.fillText(
            'FISH SCHOOL',
            this.schoolX,
            this.schoolY - 78
        );

        ctx.restore();
    },


    drawReticle: function(
        ctx,
        now
    ) {
        if (
            this.phase
            !== 'aiming'
        ) {
            return;
        }

        ctx.save();

        /*
         * Landing guide from top of water to the
         * moving cast marker.
         */
        ctx.beginPath();

        ctx.moveTo(
            this.reticleX,
            205
        );

        ctx.lineTo(
            this.reticleX,
            370
        );

        ctx.strokeStyle =
            'rgba(255,255,255,.28)';

        ctx.lineWidth = 1.5;

        ctx.setLineDash(
            [6, 7]
        );

        ctx.stroke();

        ctx.setLineDash([]);

        const pulse =
            17
            + (
                Math.sin(
                    now / 120
                ) + 1
            ) * 2;

        ctx.beginPath();

        ctx.arc(
            this.reticleX,
            this.schoolY,
            pulse,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            '#FFFFFF';

        ctx.lineWidth = 3;

        ctx.shadowColor =
            '#7DD3FC';

        ctx.shadowBlur = 12;

        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.beginPath();

        ctx.arc(
            this.reticleX,
            this.schoolY,
            3.5,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            '#FFFFFF';

        ctx.fill();

        ctx.font =
            '800 10px Arial';

        ctx.textAlign =
            'center';

        ctx.fillStyle =
            '#FFFFFF';

        ctx.fillText(
            'CAST',
            this.reticleX,
            this.schoolY - 27
        );

        ctx.restore();
    },


    drawBoat: function(ctx) {
        ctx.save();

        /*
         * Shadow/reflection.
         */
        ctx.fillStyle =
            'rgba(0,0,0,.20)';

        ctx.beginPath();

        ctx.ellipse(
            360,
            459,
            92,
            12,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        /*
         * Wooden hull.
         */
        const hull =
            ctx.createLinearGradient(
                285,
                415,
                435,
                463
            );

        hull.addColorStop(
            0,
            '#9B6037'
        );

        hull.addColorStop(
            0.55,
            '#6E3F28'
        );

        hull.addColorStop(
            1,
            '#45281D'
        );

        ctx.fillStyle = hull;

        ctx.beginPath();

        ctx.moveTo(
            280,
            418
        );

        ctx.lineTo(
            440,
            418
        );

        ctx.lineTo(
            410,
            461
        );

        ctx.lineTo(
            310,
            461
        );

        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle =
            '#C58A55';

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(
            292,
            427
        );

        ctx.lineTo(
            428,
            427
        );

        ctx.stroke();

        /*
         * Simple mast and net bundle.
         */
        ctx.strokeStyle =
            '#6B442A';

        ctx.lineWidth = 5;

        ctx.beginPath();

        ctx.moveTo(
            350,
            420
        );

        ctx.lineTo(
            350,
            370
        );

        ctx.stroke();

        ctx.strokeStyle =
            'rgba(229,231,235,.75)';

        ctx.lineWidth = 1;

        for (
            let i = 0;
            i < 5;
            i += 1
        ) {
            ctx.beginPath();

            ctx.arc(
                391,
                410,
                10
                + (
                    i * 2
                ),
                0,
                Math.PI
            );

            ctx.stroke();
        }

        ctx.restore();
    },


    drawCastAnimation: function(
        ctx,
        now
    ) {
        if (!this.castAnimation) {
            return;
        }

        const duration = 690;

        const progress =
            Math.min(
                1,
                (
                    now
                    - this.castAnimation.start
                ) / duration
            );

        if (progress < 0) {
            return;
        }

        const eased =
            1
            - Math.pow(
                1 - progress,
                2
            );

        const x =
            this.castAnimation.fromX
            + (
                (
                    this.castAnimation.toX
                    - this.castAnimation.fromX
                )
                * eased
            );

        const baseY =
            this.castAnimation.fromY
            + (
                (
                    this.castAnimation.toY
                    - this.castAnimation.fromY
                )
                * eased
            );

        const arc =
            Math.sin(
                progress * Math.PI
            ) * 105;

        const y =
            baseY - arc;

        ctx.save();

        /*
         * Rope.
         */
        ctx.beginPath();

        ctx.moveTo(
            this.castAnimation.fromX,
            this.castAnimation.fromY
        );

        ctx.quadraticCurveTo(
            (
                this.castAnimation.fromX
                + this.castAnimation.toX
            ) / 2,
            260,
            x,
            y
        );

        ctx.strokeStyle =
            'rgba(235,241,235,.72)';

        ctx.lineWidth = 1.5;
        ctx.stroke();

        /*
         * Flying net.
         */
        ctx.beginPath();

        ctx.arc(
            x,
            y,
            8
            + (
                progress * 9
            ),
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            'rgba(241,245,249,.92)';

        ctx.lineWidth = 2;
        ctx.stroke();

        /*
         * Water landing ring.
         */
        if (progress > 0.72) {
            const waterProgress =
                (
                    progress - 0.72
                ) / 0.28;

            ctx.beginPath();

            ctx.ellipse(
                this.castAnimation.toX,
                this.castAnimation.toY,
                16
                    + (
                        waterProgress * 38
                    ),
                7
                    + (
                        waterProgress * 12
                    ),
                0,
                0,
                Math.PI * 2
            );

            ctx.strokeStyle =
                `rgba(224,242,254,${
                    1 - waterProgress
                })`;

            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    },


    drawProgress: function(
        ctx,
        now
    ) {
        ctx.save();

        ctx.textAlign = 'center';

        ctx.fillStyle =
            '#F6E1B2';

        ctx.font =
            '800 18px Arial';

        ctx.fillText(
            'FISHERS OF MEN — PERFECT CAST',
            360,
            34
        );

        ctx.fillStyle =
            '#C5DEE0';

        ctx.font =
            '600 11px Arial';

        ctx.fillText(
            'MATTHEW 4:19',
            360,
            53
        );

        /*
         * Five cast indicators.
         */
        const startX = 300;
        const gap = 30;
        const y = 492;

        for (
            let index = 0;
            index < this.MAX_CASTS;
            index += 1
        ) {
            const complete =
                index
                < this.castsCompleted;

            ctx.beginPath();

            ctx.arc(
                startX
                    + (
                        index * gap
                    ),
                y,
                8,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                complete
                    ? '#F5D58C'
                    : 'rgba(226,232,240,.16)';

            ctx.fill();

            ctx.strokeStyle =
                complete
                    ? '#D69E4C'
                    : 'rgba(226,232,240,.32)';

            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (
            this.feedback
            && now
                < this.feedbackUntil
        ) {
            const colors = {
                PERFECT: '#F5D58C',
                GREAT: '#6EE7B7',
                GOOD: '#93C5FD',
                MISS: '#FDA4AF',
                start: '#D8E6E8'
            };

            ctx.fillStyle =
                colors[
                    this.feedbackGrade
                ] || '#FFFFFF';

            ctx.font =
                '900 19px Arial';

            ctx.shadowColor =
                'rgba(0,0,0,.50)';

            ctx.shadowBlur = 7;

            ctx.fillText(
                this.feedback,
                360,
                82
            );

            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },


    finishGame: async function() {
        if (this.finishSubmitted) {
            return;
        }

        this.finishSubmitted = true;
        this.phase = 'finished';
        this.isPlaying = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(
                this.animationFrameId
            );

            this.animationFrameId =
                null;
        }

        if (this.roundTimer) {
            clearTimeout(
                this.roundTimer
            );

            this.roundTimer = null;
        }

        const finalScore =
            this.calculateFinalScore();

        const accuracy =
            this.calculateAccuracy();

        this.score = finalScore;

        this.updateHud();

        const overlay =
            document.getElementById(
                'fmOverlay'
            );

        if (overlay) {
            overlay.style.display =
                'flex';

            overlay.innerHTML = `
                <h2>
                    FIVE CASTS COMPLETE
                </h2>

                <p>
                    Saving your Game Score…
                </p>

                <small>
                    Perfect: ${this.perfect}
                    &nbsp;•&nbsp;
                    Great: ${this.great}
                    &nbsp;•&nbsp;
                    Good: ${this.good}
                    &nbsp;•&nbsp;
                    Misses: ${this.misses}
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
                        'Fishers of Men: Perfect Cast',

                    score:
                        finalScore,

                    overlayId:
                        'fmOverlay',

                    playAgain:
                        'V12Fishers.startGame()',

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

        if (this.roundTimer) {
            clearTimeout(
                this.roundTimer
            );

            this.roundTimer = null;
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
