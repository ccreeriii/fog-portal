'use strict';

/*
 * Jericho: Walls Fall
 *
 * Gameplay represents the climactic seventh-day march:
 * complete seven successful timing circuits around Jericho,
 * then sound the final trumpet and watch the walls fall.
 *
 * Game Score is competitive gameplay performance.
 * Life Points remain handled by the shared server economy.
 */

window.V11Jericho = {
    gameName: 'Jericho: Walls Fall',

    canvas: null,
    ctx: null,

    animationFrameId: null,
    roundTimer: null,

    boundPointerHandler: null,
    boundKeyHandler: null,

    isPlaying: false,
    finishSubmitted: false,

    MAX_CIRCUITS: 7,

    successfulCircuits: 0,

    score: 0,
    misses: 0,

    perfect: 0,
    great: 0,
    good: 0,

    streak: 0,
    bestStreak: 0,

    phase: 'idle',

    markerAngle: 0,
    targetAngle: -Math.PI / 2,

    lastFrameTime: 0,
    startTime: 0,
    completedAt: 0,

    feedback: '',
    feedbackGrade: '',
    feedbackUntil: 0,

    collapseStart: 0,

    centerX: 360,
    centerY: 250,
    routeRadius: 188,


    initStyles: function() {
        if (
            document.getElementById(
                'jericho-circular-css'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'jericho-circular-css';

        style.textContent = `
            .jericho-game-shell {
                width: 100%;
                max-width: 780px;
                margin: 0 auto;
                overflow: hidden;
                border-radius: 18px;
                border: 1px solid #D8C5A7;
                background: #111827;
                box-shadow:
                    0 22px 60px rgba(15,23,42,.20);
            }

            .jericho-game-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;

                padding: 10px 14px;

                background:
                    linear-gradient(
                        135deg,
                        #FFF9EF,
                        #F5E8D2
                    );

                border-bottom:
                    1px solid #DDC8A8;
            }

            .jericho-game-stats {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                flex-wrap: wrap;
                gap: 7px 13px;

                color: #334155;
                font-size: .78rem;
                font-weight: 800;
            }

            .jericho-game-stat strong {
                color: #92400E;
            }

            .jericho-stage {
                position: relative;
                width: 100%;
                background: #101827;
            }

            #jerichoCanvas {
                display: block;
                width: 100%;
                max-width: 720px;
                height: auto;
                margin: 0 auto;

                background: #101827;

                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
            }

            .jericho-start-overlay {
                position: absolute;
                inset: 0;

                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;

                gap: 12px;

                padding: 28px;

                background:
                    linear-gradient(
                        180deg,
                        rgba(15,23,42,.92),
                        rgba(30,41,59,.95)
                    );

                color: #FFF;
                text-align: center;

                z-index: 5;
            }

            .jericho-start-overlay h2 {
                margin: 0;
                border: 0;
                padding: 0;

                color: #F6C56F;
                font-size: 1.9rem;
                line-height: 1.1;
            }

            .jericho-start-overlay p {
                max-width: 570px;
                margin: 0;

                color: #E2E8F0;
                font-size: .91rem;
                line-height: 1.55;
            }

            .jericho-start-overlay small {
                color: #CBD5E1;
                line-height: 1.45;
            }

            .jericho-controls {
                display: grid;
                grid-template-columns:
                    minmax(0, 1fr)
                    minmax(0, 1fr);

                gap: 10px;

                padding: 11px;

                background:
                    linear-gradient(
                        180deg,
                        #FFF9EF,
                        #F8F1E7
                    );

                border-top:
                    1px solid #DDC8A8;
            }

            .jericho-action-btn {
                min-height: 52px;
                border-radius: 13px;

                font-size: .84rem;
                font-weight: 900;
                letter-spacing: .02em;
            }

            #jwMarchButton {
                background: #9A5A20;
                border-color: #9A5A20;
                color: #FFF;
            }

            #jwTrumpetButton {
                background:
                    linear-gradient(
                        135deg,
                        #F8D779,
                        #E9A83B
                    );

                border-color: #C78219;
                color: #4A2A09;
            }

            #jwTrumpetButton:disabled {
                opacity: .42;
                filter: saturate(.55);
                cursor: not-allowed;
            }

            #jwTrumpetButton.jericho-trumpet-ready {
                animation:
                    jerichoTrumpetPulse
                    1.15s ease-in-out infinite;
            }

            @keyframes jerichoTrumpetPulse {
                0%, 100% {
                    transform: scale(1);
                    box-shadow:
                        0 0 0 rgba(245,158,11,0);
                }

                50% {
                    transform: scale(1.025);
                    box-shadow:
                        0 0 24px
                        rgba(245,158,11,.34);
                }
            }


            /* ================================================
               JERICHO RESULT CONTRAST FIX
               ================================================ */

            #jwOverlay .game-result-card {
                width: min(92%, 620px) !important;
                max-height: calc(100% - 24px) !important;
                overflow-y: auto !important;

                box-sizing: border-box !important;
                padding: 20px !important;

                background: #FFFDF7 !important;
                color: #0F172A !important;

                border: 1px solid #D8C5A7 !important;
                border-radius: 18px !important;

                box-shadow:
                    0 24px 70px
                    rgba(15,23,42,.34) !important;

                text-align: center !important;
            }

            #jwOverlay .game-result-eyebrow {
                color: #92400E !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-card h2 {
                color: #7C2D12 !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-stats > div {
                background: #F1F5F9 !important;
                border: 1px solid #D9E1EA !important;
                color: #0F172A !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-stats span {
                color: #475569 !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-stats strong {
                color: #0F172A !important;
                opacity: 1 !important;
                font-weight: 900 !important;
            }

            #jwOverlay .game-cap-message {
                color: #475569 !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-actions .btn-primary {
                color: #FFFFFF !important;
                opacity: 1 !important;
            }

            #jwOverlay .game-result-actions .btn-outline {
                color: #334155 !important;
                opacity: 1 !important;
            }

            @media (max-width: 520px) {
                .jericho-game-header {
                    padding: 8px 10px;
                }

                .jericho-game-stats {
                    gap: 4px 8px;
                    font-size: .69rem;
                }

                .jericho-controls {
                    gap: 7px;
                    padding: 8px;
                }

                .jericho-action-btn {
                    min-height: 48px;
                    padding: 7px 8px;
                    font-size: .73rem;
                }

                .jericho-start-overlay {
                    padding: 20px;
                }

                .jericho-start-overlay h2 {
                    font-size: 1.55rem;
                }

                .jericho-start-overlay p {
                    font-size: .82rem;
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
            list.style.display = 'none';
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
            <div class="jericho-game-shell">
                <div class="jericho-game-header">
                    <button
                        class="btn btn-outline btn-sm"
                        onclick="V11Jericho.exitGame()"
                    >
                        🔙 Games
                    </button>

                    <div class="jericho-game-stats">
                        <span class="jericho-game-stat">
                            CIRCUITS
                            <strong id="jwCircuitDisplay">
                                0 / 7
                            </strong>
                        </span>

                        <span class="jericho-game-stat">
                            MISSES
                            <strong id="jwMissDisplay">
                                0
                            </strong>
                        </span>

                        <span class="jericho-game-stat">
                            SCORE
                            <strong id="jwScoreDisplay">
                                0
                            </strong>
                        </span>
                    </div>
                </div>

                <div class="jericho-stage">
                    <canvas
                        id="jerichoCanvas"
                        width="720"
                        height="520"
                        aria-label="Jericho circular timing game"
                    ></canvas>

                    <div
                        id="jwOverlay"
                        class="jericho-start-overlay"
                    >
                        <h2>
                            JERICHO: WALLS FALL
                        </h2>

                        <p>
                            Complete seven successful circuits
                            around Jericho. Tap when the golden
                            procession reaches the illuminated
                            timing gate.
                        </p>

                        <small>
                            PERFECT, GREAT, and GOOD complete a
                            circuit. A MISS does not advance you.
                            After Circuit 7, sound the final trumpet.
                        </small>

                        <button
                            class="btn btn-primary"
                            style="
                                min-width:190px;
                                padding:12px 20px;
                                background:#A16207;
                                border-color:#A16207;
                            "
                            onclick="V11Jericho.startGame()"
                        >
                            ▶ BEGIN THE MARCH
                        </button>
                    </div>
                </div>

                <div class="jericho-controls">
                    <button
                        id="jwMarchButton"
                        class="btn jericho-action-btn"
                        type="button"
                        onclick="V11Jericho.attemptCircuit()"
                        disabled
                    >
                        TAP THE TIMING GATE
                    </button>

                    <button
                        id="jwTrumpetButton"
                        class="btn jericho-action-btn"
                        type="button"
                        onclick="V11Jericho.soundTrumpet()"
                        disabled
                    >
                        📯 FINAL TRUMPET LOCKED
                    </button>
                </div>
            </div>
        `;

        this.canvas =
            document.getElementById(
                'jerichoCanvas'
            );

        this.ctx =
            this.canvas
                ? this.canvas.getContext('2d')
                : null;

        this.bindEvents();

        this.phase = 'idle';
        this.markerAngle =
            this.normalizeAngle(
                this.targetAngle + 0.55
            );

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
                    || this.phase !== 'marching'
                ) {
                    return;
                }

                event.preventDefault();
                this.attemptCircuit();
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
                if (!this.isPlaying) {
                    return;
                }

                if (
                    event.key !== ' '
                    && event.key !== 'Enter'
                ) {
                    return;
                }

                event.preventDefault();

                if (
                    this.phase
                    === 'trumpetReady'
                ) {
                    this.soundTrumpet();
                    return;
                }

                if (
                    this.phase
                    === 'marching'
                ) {
                    this.attemptCircuit();
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
                'jwOverlay'
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

        this.successfulCircuits = 0;

        this.score = 0;
        this.misses = 0;

        this.perfect = 0;
        this.great = 0;
        this.good = 0;

        this.streak = 0;
        this.bestStreak = 0;

        this.phase = 'marching';

        this.markerAngle =
            this.normalizeAngle(
                this.targetAngle + 0.55
            );

        const now =
            performance.now();

        this.startTime = now;
        this.completedAt = 0;
        this.lastFrameTime = now;

        this.feedback =
            'CIRCUIT 1 OF 7';

        this.feedbackGrade =
            'start';

        this.feedbackUntil =
            now + 1000;

        this.collapseStart = 0;

        this.updateHud();
        this.loop(now);
    },


    normalizeAngle: function(angle) {
        const full =
            Math.PI * 2;

        return (
            (angle % full) + full
        ) % full;
    },


    angularDistance: function(
        first,
        second
    ) {
        return Math.abs(
            Math.atan2(
                Math.sin(
                    first - second
                ),
                Math.cos(
                    first - second
                )
            )
        );
    },


    getAngularSpeed: function() {
        /*
         * Each completed circuit becomes
         * slightly faster.
         */
        return (
            2.05
            + (
                this.successfulCircuits
                * 0.14
            )
        );
    },


    getGoodWindow: function() {
        /*
         * Timing gate gets slightly narrower
         * as the seven circuits progress.
         */
        return Math.max(
            0.18,
            0.30
            - (
                this.successfulCircuits
                * 0.018
            )
        );
    },


    getTimingGrade: function(distance) {
        const goodWindow =
            this.getGoodWindow();

        const perfectWindow =
            goodWindow * 0.28;

        const greatWindow =
            goodWindow * 0.62;

        if (
            distance
            <= perfectWindow
        ) {
            return {
                name: 'PERFECT',
                points: 1200
            };
        }

        if (
            distance
            <= greatWindow
        ) {
            return {
                name: 'GREAT',
                points: 900
            };
        }

        if (
            distance
            <= goodWindow
        ) {
            return {
                name: 'GOOD',
                points: 650
            };
        }

        return null;
    },


    attemptCircuit: function() {
        if (
            !this.isPlaying
            || this.phase !== 'marching'
        ) {
            return;
        }

        const now =
            performance.now();

        const distance =
            this.angularDistance(
                this.markerAngle,
                this.targetAngle
            );

        const grade =
            this.getTimingGrade(
                distance
            );

        if (!grade) {
            this.misses += 1;
            this.streak = 0;

            this.feedback =
                'MISS — KEEP MARCHING';

            this.feedbackGrade =
                'MISS';

            this.feedbackUntil =
                now + 650;

            this.updateHud();
            return;
        }

        this.streak += 1;

        this.bestStreak =
            Math.max(
                this.bestStreak,
                this.streak
            );

        const streakBonus =
            Math.min(
                this.streak,
                7
            ) * 100;

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

        this.successfulCircuits += 1;

        this.feedback =
            `${grade.name} — CIRCUIT ${this.successfulCircuits} COMPLETE`;

        this.feedbackGrade =
            grade.name;

        this.feedbackUntil =
            now + 900;

        /*
         * Seventh successful circuit:
         * stop competitive timing and unlock
         * the final trumpet.
         */
        if (
            this.successfulCircuits
            >= this.MAX_CIRCUITS
        ) {
            this.completedAt = now;
            this.phase =
                'trumpetReady';

            this.feedback =
                'SEVENTH CIRCUIT COMPLETE';

            this.feedbackGrade =
                'FINAL';

            this.feedbackUntil =
                now + 2400;

            this.updateHud();
            return;
        }

        /*
         * Short celebration between circuits.
         * Then place the procession just after
         * the gate so it must travel almost a
         * full circle before the next timing hit.
         */
        this.phase =
            'roundPause';

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

                    this.markerAngle =
                        this.normalizeAngle(
                            this.targetAngle
                            + 0.55
                        );

                    this.phase =
                        'marching';

                    this.feedback =
                        `CIRCUIT ${
                            this.successfulCircuits + 1
                        } OF 7`;

                    this.feedbackGrade =
                        'start';

                    this.feedbackUntil =
                        performance.now()
                        + 800;

                    this.lastFrameTime =
                        performance.now();

                    this.updateHud();
                },
                560
            );
    },


    soundTrumpet: function() {
        if (
            !this.isPlaying
            || this.phase
                !== 'trumpetReady'
        ) {
            return;
        }

        this.phase =
            'collapsing';

        this.collapseStart =
            performance.now();

        this.feedback =
            'SHOUT!';

        this.feedbackGrade =
            'TRUMPET';

        this.feedbackUntil =
            this.collapseStart
            + 1500;

        this.playTrumpetSound();
        this.updateHud();
    },


    playTrumpetSound: function() {
        try {
            const AudioContextClass =
                window.AudioContext
                || window.webkitAudioContext;

            if (!AudioContextClass) {
                return;
            }

            const audio =
                new AudioContextClass();

            const master =
                audio.createGain();

            master.gain.setValueAtTime(
                0.0001,
                audio.currentTime
            );

            master.gain.exponentialRampToValueAtTime(
                0.17,
                audio.currentTime + 0.04
            );

            master.gain.exponentialRampToValueAtTime(
                0.0001,
                audio.currentTime + 1.25
            );

            master.connect(
                audio.destination
            );

            const frequencies = [
                196,
                293.66,
                392
            ];

            frequencies.forEach(
                (frequency, index) => {
                    const oscillator =
                        audio.createOscillator();

                    const gain =
                        audio.createGain();

                    oscillator.type =
                        index === 0
                            ? 'sawtooth'
                            : 'triangle';

                    oscillator.frequency.value =
                        frequency;

                    gain.gain.value =
                        index === 0
                            ? 0.65
                            : 0.25;

                    oscillator.connect(gain);
                    gain.connect(master);

                    oscillator.start(
                        audio.currentTime
                        + (
                            index * 0.04
                        )
                    );

                    oscillator.stop(
                        audio.currentTime
                        + 1.28
                    );
                }
            );

            setTimeout(
                () => {
                    audio.close()
                        .catch(() => {});
                },
                1700
            );
        } catch (_) {
            /*
             * Audio is decorative only.
             * Gameplay must still complete.
             */
        }
    },


    calculateFinalScore: function() {
        const elapsed =
            Math.max(
                0,
                this.completedAt
                - this.startTime
            );

        /*
         * Faster completion earns more.
         * Around 30 seconds or slower means
         * no remaining time bonus.
         */
        const timeBonus =
            Math.max(
                0,
                3000
                - Math.floor(
                    elapsed / 10
                )
            );

        const completionBonus =
            1500;

        const perfectSevenBonus =
            this.perfect
                === this.MAX_CIRCUITS
                ? 2000
                : 0;

        const missPenalty =
            this.misses * 250;

        return Math.max(
            0,
            Math.round(
                this.score
                + completionBonus
                + perfectSevenBonus
                + timeBonus
                - missPenalty
            )
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
                / this.MAX_CIRCUITS
            ) * 100
        );
    },


    updateHud: function() {
        const circuit =
            document.getElementById(
                'jwCircuitDisplay'
            );

        const miss =
            document.getElementById(
                'jwMissDisplay'
            );

        const score =
            document.getElementById(
                'jwScoreDisplay'
            );

        const march =
            document.getElementById(
                'jwMarchButton'
            );

        const trumpet =
            document.getElementById(
                'jwTrumpetButton'
            );

        if (circuit) {
            circuit.textContent =
                `${this.successfulCircuits} / 7`;
        }

        if (miss) {
            miss.textContent =
                String(this.misses);
        }

        if (score) {
            score.textContent =
                Number(
                    this.score
                ).toLocaleString();
        }

        if (march) {
            march.disabled =
                this.phase
                !== 'marching';

            if (
                this.phase
                === 'marching'
            ) {
                march.textContent =
                    `TAP TARGET — CIRCUIT ${
                        this.successfulCircuits + 1
                    }`;
            } else if (
                this.phase
                === 'roundPause'
            ) {
                march.textContent =
                    'CIRCUIT COMPLETE';
            } else {
                march.textContent =
                    'SEVEN CIRCUITS COMPLETE';
            }
        }

        if (trumpet) {
            const ready =
                this.phase
                === 'trumpetReady';

            trumpet.disabled =
                !ready;

            trumpet.classList.toggle(
                'jericho-trumpet-ready',
                ready
            );

            trumpet.textContent =
                ready
                    ? '📯 SOUND THE FINAL TRUMPET'
                    : this.phase
                        === 'collapsing'
                        ? '📯 TRUMPET SOUNDED'
                        : '📯 FINAL TRUMPET LOCKED';
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
            === 'marching'
        ) {
            this.markerAngle =
                this.normalizeAngle(
                    this.markerAngle
                    + (
                        this.getAngularSpeed()
                        * delta
                    )
                );
        }

        if (
            this.phase
            === 'collapsing'
        ) {
            const progress =
                (
                    now
                    - this.collapseStart
                ) / 1650;

            if (
                progress >= 1
                && !this.finishSubmitted
            ) {
                this.finishGame();
                return;
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
        const width =
            this.canvas.width;
        const height =
            this.canvas.height;

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        this.drawBackground(ctx);
        this.drawRoute(ctx, now);

        let collapseProgress = 0;

        if (
            this.phase
            === 'collapsing'
        ) {
            collapseProgress =
                Math.min(
                    1,
                    (
                        now
                        - this.collapseStart
                    ) / 1650
                );
        }

        this.drawFortress(
            ctx,
            collapseProgress
        );

        this.drawProcession(
            ctx,
            now
        );

        this.drawProgress(
            ctx,
            now
        );

        if (
            this.phase
            === 'collapsing'
        ) {
            this.drawCollapseAtmosphere(
                ctx,
                collapseProgress
            );
        }
    },


    drawBackground: function(ctx) {
        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                520
            );

        gradient.addColorStop(
            0,
            '#101827'
        );

        gradient.addColorStop(
            0.55,
            '#172033'
        );

        gradient.addColorStop(
            1,
            '#3A2B21'
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            720,
            520
        );

        /*
         * Desert ground glow behind Jericho.
         */
        const groundGlow =
            ctx.createRadialGradient(
                this.centerX,
                this.centerY,
                50,
                this.centerX,
                this.centerY,
                265
            );

        groundGlow.addColorStop(
            0,
            'rgba(245,196,118,.20)'
        );

        groundGlow.addColorStop(
            0.65,
            'rgba(181,121,65,.10)'
        );

        groundGlow.addColorStop(
            1,
            'rgba(15,23,42,0)'
        );

        ctx.fillStyle =
            groundGlow;

        ctx.fillRect(
            60,
            0,
            600,
            500
        );

        /*
         * Subtle stars / dust.
         */
        ctx.save();

        ctx.globalAlpha = 0.24;
        ctx.fillStyle = '#F8E2B7';

        const points = [
            [82,72],
            [136,124],
            [628,96],
            [574,154],
            [102,332],
            [642,350],
            [187,55],
            [530,56]
        ];

        points.forEach(
            ([x, y]) => {
                ctx.beginPath();
                ctx.arc(
                    x,
                    y,
                    1.5,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        );

        ctx.restore();
    },


    drawRoute: function(ctx, now) {
        const goodWindow =
            this.getGoodWindow();

        const perfectWindow =
            goodWindow * 0.28;

        const greatWindow =
            goodWindow * 0.62;

        ctx.save();

        /*
         * Outer march path.
         */
        ctx.beginPath();

        ctx.arc(
            this.centerX,
            this.centerY,
            this.routeRadius,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            'rgba(222,190,130,.28)';

        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.beginPath();

        ctx.arc(
            this.centerX,
            this.centerY,
            this.routeRadius,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            'rgba(248,215,144,.54)';

        ctx.lineWidth = 2;
        ctx.setLineDash(
            [8, 10]
        );

        ctx.stroke();
        ctx.setLineDash([]);

        /*
         * GOOD timing zone.
         */
        ctx.beginPath();

        ctx.arc(
            this.centerX,
            this.centerY,
            this.routeRadius,
            this.targetAngle
                - goodWindow,
            this.targetAngle
                + goodWindow
        );

        ctx.strokeStyle =
            'rgba(96,165,250,.36)';

        ctx.lineWidth = 24;
        ctx.stroke();

        /*
         * GREAT zone.
         */
        ctx.beginPath();

        ctx.arc(
            this.centerX,
            this.centerY,
            this.routeRadius,
            this.targetAngle
                - greatWindow,
            this.targetAngle
                + greatWindow
        );

        ctx.strokeStyle =
            'rgba(52,211,153,.55)';

        ctx.lineWidth = 16;
        ctx.stroke();

        /*
         * PERFECT center zone.
         */
        ctx.beginPath();

        ctx.arc(
            this.centerX,
            this.centerY,
            this.routeRadius,
            this.targetAngle
                - perfectWindow,
            this.targetAngle
                + perfectWindow
        );

        ctx.strokeStyle =
            '#F8D779';

        ctx.lineWidth = 8;

        ctx.shadowColor =
            '#F59E0B';

        ctx.shadowBlur =
            12
            + (
                Math.sin(
                    now / 180
                ) + 1
            ) * 4;

        ctx.stroke();

        ctx.shadowBlur = 0;

        /*
         * Target gate indicator.
         */
        const tx =
            this.centerX
            + Math.cos(
                this.targetAngle
            ) * this.routeRadius;

        const ty =
            this.centerY
            + Math.sin(
                this.targetAngle
            ) * this.routeRadius;

        ctx.fillStyle =
            '#F8D779';

        ctx.beginPath();

        ctx.arc(
            tx,
            ty,
            7,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.font =
            '700 11px Arial';

        ctx.textAlign =
            'center';

        ctx.fillStyle =
            '#FDE9B8';

        ctx.fillText(
            'TIMING GATE',
            tx,
            ty - 23
        );

        ctx.restore();
    },


    drawFortress: function(
        ctx,
        collapseProgress
    ) {
        const cx = this.centerX;
        const cy = this.centerY;

        ctx.save();

        /*
         * City floor.
         */
        const cityGradient =
            ctx.createRadialGradient(
                cx - 20,
                cy - 28,
                18,
                cx,
                cy,
                120
            );

        cityGradient.addColorStop(
            0,
            '#E8BD78'
        );

        cityGradient.addColorStop(
            0.65,
            '#C48D52'
        );

        cityGradient.addColorStop(
            1,
            '#8A5735'
        );

        ctx.beginPath();

        ctx.arc(
            cx,
            cy,
            105,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            cityGradient;

        ctx.shadowColor =
            'rgba(0,0,0,.42)';

        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;

        /*
         * Inner buildings.
         */
        const buildings = [
            [-42,-24,30,46],
            [-4,-48,32,54],
            [34,-14,28,42],
            [-30,32,34,34],
            [18,30,30,36]
        ];

        buildings.forEach(
            ([x, y, w, h], index) => {
                const drop =
                    collapseProgress
                    * (
                        8
                        + (index * 2)
                    );

                ctx.fillStyle =
                    index % 2
                        ? '#B77743'
                        : '#D09A5E';

                ctx.fillRect(
                    cx + x,
                    cy + y + drop,
                    w,
                    Math.max(
                        3,
                        h
                        * (
                            1
                            - collapseProgress
                                * 0.30
                        )
                    )
                );

                ctx.fillStyle =
                    'rgba(70,38,23,.28)';

                ctx.fillRect(
                    cx + x + 5,
                    cy + y + 8 + drop,
                    6,
                    11
                );
            }
        );

        /*
         * Twelve wall sections.
         * During the trumpet sequence each segment
         * falls away from the city independently.
         */
        const segments = 12;

        for (
            let index = 0;
            index < segments;
            index += 1
        ) {
            const angle =
                (
                    index
                    / segments
                ) * Math.PI * 2;

            const radialDrop =
                collapseProgress
                * (
                    18
                    + (
                        (index % 3)
                        * 6
                    )
                );

            const wallRadius =
                112 + radialDrop;

            const x =
                cx
                + Math.cos(angle)
                    * wallRadius;

            const y =
                cy
                + Math.sin(angle)
                    * wallRadius
                + (
                    collapseProgress
                    * 18
                );

            ctx.save();

            ctx.translate(x, y);
            ctx.rotate(
                angle
                + Math.PI / 2
                + (
                    collapseProgress
                    * (
                        index % 2
                            ? 0.20
                            : -0.20
                    )
                )
            );

            ctx.fillStyle =
                index % 2
                    ? '#C99358'
                    : '#D8A76A';

            ctx.shadowColor =
                'rgba(0,0,0,.28)';

            ctx.shadowBlur = 5;

            ctx.fillRect(
                -25,
                -11,
                50,
                22
            );

            ctx.fillStyle =
                '#E6BC7E';

            for (
                let tooth = -20;
                tooth <= 16;
                tooth += 12
            ) {
                ctx.fillRect(
                    tooth,
                    -17,
                    8,
                    8
                );
            }

            ctx.restore();
        }

        /*
         * Eight towers.
         */
        for (
            let index = 0;
            index < 8;
            index += 1
        ) {
            const angle =
                (
                    index
                    / 8
                ) * Math.PI * 2;

            const radialDrop =
                collapseProgress
                * (
                    24
                    + (
                        index % 2
                            ? 8
                            : 0
                    )
                );

            const radius =
                115 + radialDrop;

            const x =
                cx
                + Math.cos(angle)
                    * radius;

            const y =
                cy
                + Math.sin(angle)
                    * radius
                + (
                    collapseProgress
                    * 22
                );

            ctx.save();

            ctx.translate(x, y);

            ctx.rotate(
                collapseProgress
                * (
                    index % 2
                        ? 0.18
                        : -0.18
                )
            );

            ctx.fillStyle =
                '#B87742';

            ctx.fillRect(
                -12,
                -17,
                24,
                34
            );

            ctx.fillStyle =
                '#E1B273';

            ctx.fillRect(
                -15,
                -22,
                30,
                10
            );

            ctx.restore();
        }

        /*
         * City gate facing the target zone.
         */
        ctx.save();

        ctx.translate(
            cx,
            cy - 111
                + (
                    collapseProgress
                    * 28
                )
        );

        ctx.fillStyle =
            '#6B4228';

        ctx.fillRect(
            -17,
            -6,
            34,
            24
        );

        ctx.fillStyle =
            '#2E1A11';

        ctx.fillRect(
            -9,
            1,
            18,
            17
        );

        ctx.restore();

        ctx.restore();
    },


    drawProcession: function(
        ctx,
        now
    ) {
        const angle =
            this.markerAngle;

        /*
         * Small trailing markers suggest the
         * marching procession around the city.
         */
        for (
            let index = 5;
            index >= 1;
            index -= 1
        ) {
            const trailAngle =
                angle
                - (
                    index * 0.055
                );

            const x =
                this.centerX
                + Math.cos(
                    trailAngle
                ) * this.routeRadius;

            const y =
                this.centerY
                + Math.sin(
                    trailAngle
                ) * this.routeRadius;

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                3.2,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(248,215,121,${
                    0.12
                    + (
                        index * 0.055
                    )
                })`;

            ctx.fill();
        }

        const x =
            this.centerX
            + Math.cos(angle)
                * this.routeRadius;

        const y =
            this.centerY
            + Math.sin(angle)
                * this.routeRadius;

        ctx.save();

        ctx.shadowColor =
            '#F8D779';

        ctx.shadowBlur =
            14
            + (
                Math.sin(
                    now / 150
                ) + 1
            ) * 3;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            11,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            '#F8D779';

        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            5,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            '#7C4A16';

        ctx.fill();

        ctx.restore();
    },


    drawProgress: function(
        ctx,
        now
    ) {
        ctx.save();

        /*
         * Title.
         */
        ctx.textAlign = 'center';

        ctx.fillStyle =
            '#F8E3BA';

        ctx.font =
            '800 18px Arial';

        ctx.fillText(
            'MARCH AROUND JERICHO',
            360,
            35
        );

        ctx.font =
            '600 12px Arial';

        ctx.fillStyle =
            '#BFC8D8';

        if (
            this.phase
            === 'trumpetReady'
        ) {
            ctx.fillText(
                'SEVEN CIRCUITS COMPLETE — SOUND THE FINAL TRUMPET',
                360,
                56
            );
        } else {
            ctx.fillText(
                `Circuit ${
                    Math.min(
                        this.successfulCircuits + 1,
                        7
                    )
                } of 7`,
                360,
                56
            );
        }

        /*
         * Seven circuit indicators.
         */
        const startX = 270;
        const gap = 30;
        const y = 485;

        for (
            let index = 0;
            index < 7;
            index += 1
        ) {
            const complete =
                index
                < this.successfulCircuits;

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
                    ? '#F8D779'
                    : 'rgba(226,232,240,.18)';

            ctx.fill();

            ctx.strokeStyle =
                complete
                    ? '#F59E0B'
                    : 'rgba(226,232,240,.35)';

            ctx.lineWidth = 2;
            ctx.stroke();
        }

        /*
         * Timing feedback.
         */
        if (
            this.feedback
            && now
                < this.feedbackUntil
        ) {
            const colors = {
                PERFECT: '#F8D779',
                GREAT: '#6EE7B7',
                GOOD: '#93C5FD',
                MISS: '#FDA4AF',
                FINAL: '#FDE68A',
                TRUMPET: '#FDE68A',
                start: '#CBD5E1'
            };

            ctx.font =
                this.feedbackGrade
                    === 'TRUMPET'
                    ? '900 34px Arial'
                    : '800 18px Arial';

            ctx.fillStyle =
                colors[
                    this.feedbackGrade
                ] || '#FFF';

            ctx.shadowColor =
                'rgba(0,0,0,.5)';

            ctx.shadowBlur = 8;

            ctx.fillText(
                this.feedback,
                360,
                455
            );

            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },


    drawCollapseAtmosphere: function(
        ctx,
        progress
    ) {
        ctx.save();

        /*
         * Warm trumpet flash.
         */
        if (progress < 0.32) {
            ctx.globalAlpha =
                Math.max(
                    0,
                    0.36
                    - (
                        progress * 0.75
                    )
                );

            ctx.fillStyle =
                '#FDE68A';

            ctx.fillRect(
                0,
                0,
                720,
                520
            );
        }

        /*
         * Dust cloud.
         */
        ctx.globalAlpha =
            Math.min(
                0.42,
                progress * 0.52
            );

        ctx.fillStyle =
            '#D6B17A';

        for (
            let index = 0;
            index < 22;
            index += 1
        ) {
            const angle =
                (
                    index
                    / 22
                ) * Math.PI * 2;

            const radius =
                92
                + (
                    progress * 76
                );

            const x =
                this.centerX
                + Math.cos(angle)
                    * radius;

            const y =
                this.centerY
                + Math.sin(angle)
                    * radius
                + (
                    progress * 18
                );

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                5
                + (
                    (index % 4)
                    * 2
                ),
                0,
                Math.PI * 2
            );

            ctx.fill();
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

        this.score =
            finalScore;

        this.updateHud();

        const overlay =
            document.getElementById(
                'jwOverlay'
            );

        if (overlay) {
            overlay.style.display =
                'flex';

            overlay.innerHTML = `
                <h2>
                    THE WALLS FELL
                </h2>

                <p>
                    Seven circuits completed.
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
                        'Jericho: Walls Fall',

                    score:
                        finalScore,

                    overlayId:
                        'jwOverlay',

                    playAgain:
                        'V11Jericho.startGame()',

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

            this.roundTimer =
                null;
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
