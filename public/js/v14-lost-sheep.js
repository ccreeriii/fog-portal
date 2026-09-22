'use strict';

/*
 * FIRE OF GOD MINISTRIES
 * Phase 2.2D
 *
 * LOST SHEEP: SHEPHERD'S SEARCH
 *
 * Inspired by Luke 15:4–6.
 *
 * Gameplay:
 * - Three rescue rounds.
 * - Search a top-down meadow.
 * - Follow golden hoofprint clues.
 * - Optional LISTEN action gives a directional hint.
 * - Navigate bushes, rocks and fences.
 * - Find the lost sheep.
 * - Guide it safely back to the fold.
 *
 * Game Score is competitive performance.
 * Life Points remain server-controlled.
 */

window.V14LostSheep = {

    GAME_NAME:
        "Lost Sheep: Shepherd's Search",

    WIDTH: 720,

    HEIGHT: 520,

    ROUND_COUNT: 3,

    MOVE_SPEED: 188,

    PLAYER_RADIUS: 14,

    SHEEP_RADIUS: 13,

    FOLD: {
        x: 304,
        y: 430,
        w: 112,
        h: 66
    },

    canvas: null,

    ctx: null,

    overlay: null,

    area: null,

    frameId: null,

    lastFrameTime: 0,

    roundAdvanceTimer: null,

    phase: 'idle',

    roundIndex: 0,

    rescues: 0,

    score: 0,

    totalClues: 0,

    totalCollisions: 0,

    totalListens: 0,

    roundCollisions: 0,

    roundClues: 0,

    roundStartedAt: 0,

    foundAt: 0,

    gameStartedAt: 0,

    listenCooldownUntil: 0,

    listenPulseUntil: 0,

    listenArrow: '',

    message: '',

    messageUntil: 0,

    finished: false,

    player: {
        x: 360,
        y: 454
    },

    sheep: {
        x: 600,
        y: 100
    },

    clues: [],

    obstacles: [],

    keys: null,

    joystickVector: {
        x: 0,
        y: 0
    },

    joystickPointerId: null,

    boundHandlers: null,

    lastCollisionAt: 0,


    /*
     * Layouts deliberately become more complex.
     * They are fixed rather than random so score comparisons
     * remain fair between members.
     */
    layouts: [
        {
            sheep: {
                x: 595,
                y: 92
            },

            clues: [
                {
                    x: 435,
                    y: 365
                },
                {
                    x: 535,
                    y: 275
                },
                {
                    x: 610,
                    y: 178
                }
            ],

            obstacles: [
                {
                    type: 'bush',
                    x: 205,
                    y: 325,
                    w: 135,
                    h: 44
                },
                {
                    type: 'rock',
                    x: 445,
                    y: 318,
                    w: 75,
                    h: 58
                },
                {
                    type: 'fence',
                    x: 330,
                    y: 205,
                    w: 190,
                    h: 26
                },
                {
                    type: 'bush',
                    x: 105,
                    y: 135,
                    w: 155,
                    h: 48
                }
            ]
        },

        {
            sheep: {
                x: 104,
                y: 100
            },

            clues: [
                {
                    x: 275,
                    y: 372
                },
                {
                    x: 180,
                    y: 280
                },
                {
                    x: 100,
                    y: 185
                }
            ],

            obstacles: [
                {
                    type: 'fence',
                    x: 365,
                    y: 344,
                    w: 185,
                    h: 25
                },
                {
                    type: 'bush',
                    x: 170,
                    y: 315,
                    w: 120,
                    h: 50
                },
                {
                    type: 'rock',
                    x: 305,
                    y: 228,
                    w: 78,
                    h: 70
                },
                {
                    type: 'bush',
                    x: 455,
                    y: 165,
                    w: 145,
                    h: 48
                },
                {
                    type: 'fence',
                    x: 160,
                    y: 135,
                    w: 170,
                    h: 24
                }
            ]
        },

        {
            sheep: {
                x: 618,
                y: 152
            },

            clues: [
                {
                    x: 458,
                    y: 390
                },
                {
                    x: 575,
                    y: 328
                },
                {
                    x: 640,
                    y: 240
                }
            ],

            obstacles: [
                {
                    type: 'bush',
                    x: 220,
                    y: 365,
                    w: 125,
                    h: 45
                },
                {
                    type: 'rock',
                    x: 450,
                    y: 335,
                    w: 80,
                    h: 68
                },
                {
                    type: 'fence',
                    x: 280,
                    y: 282,
                    w: 230,
                    h: 25
                },
                {
                    type: 'bush',
                    x: 95,
                    y: 215,
                    w: 145,
                    h: 52
                },
                {
                    type: 'rock',
                    x: 548,
                    y: 205,
                    w: 72,
                    h: 62
                },
                {
                    type: 'fence',
                    x: 315,
                    y: 135,
                    w: 200,
                    h: 24
                }
            ]
        }
    ],


    ensureStyles: function() {

        if (
            document.getElementById(
                'lost-sheep-search-css'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'lost-sheep-search-css';

        style.textContent = `
            .ls-shell {
                width: 100%;
                max-width: 760px;
                margin: 0 auto;
                box-sizing: border-box;
            }

            .ls-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 8px;
            }

            .ls-header-title {
                min-width: 0;
            }

            .ls-header-title h2 {
                margin: 0;
                font-size: 1rem;
                line-height: 1.15;
            }

            .ls-header-title p {
                margin: 3px 0 0;
                color: #64748B;
                font-size: .70rem;
            }

            .ls-stats {
                display: flex;
                gap: 5px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }

            .ls-stat {
                min-width: 61px;
                padding: 6px 8px;
                border: 1px solid rgba(148,163,184,.25);
                border-radius: 10px;
                background: rgba(255,255,255,.9);
                text-align: center;
            }

            .ls-stat span {
                display: block;
                color: #64748B;
                font-size: .53rem;
                font-weight: 800;
                letter-spacing: .06em;
            }

            .ls-stat strong {
                display: block;
                margin-top: 1px;
                color: #0F172A;
                font-size: .82rem;
            }

            .ls-game-wrap {
                position: relative;
                width: 100%;
                overflow: hidden;
                border-radius: 16px;
                border: 1px solid rgba(15,23,42,.12);
                background: #DDECC7;
                box-shadow: 0 10px 28px rgba(15,23,42,.12);
            }

            #lsCanvas {
                display: block;
                width: 100%;
                height: auto;
                aspect-ratio: 720 / 520;
                touch-action: none;
            }

            #lsOverlay {
                position: absolute;
                inset: 0;
                z-index: 20;
                display: flex;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                padding: 15px;
                overflow: auto;
                background: rgba(15,23,42,.55);
            }

            .ls-start-card {
                width: min(92%, 480px);
                padding: 18px;
                border-radius: 18px;
                background: #FFFDF7;
                color: #0F172A;
                text-align: center;
                box-shadow: 0 18px 50px rgba(15,23,42,.24);
            }

            .ls-start-card h2 {
                margin: 0 0 8px;
                font-size: 1.25rem;
            }

            .ls-start-card p {
                margin: 7px 0;
                color: #475569;
                font-size: .78rem;
                line-height: 1.45;
            }

            .ls-start-card .ls-scripture {
                margin-top: 10px;
                color: #4D7C0F;
                font-weight: 800;
            }

            .ls-start-card .btn {
                margin-top: 10px;
                min-height: 46px;
            }

            .ls-control-deck {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: clamp(18px, 7vw, 52px);
                min-height: 142px;
                margin-top: 10px;
                padding: 10px 16px;
                border: 1px solid rgba(15,23,42,.12);
                border-radius: 16px;
                background: rgba(255,255,255,.92);
                box-shadow: 0 8px 22px rgba(15,23,42,.08);
                box-sizing: border-box;
            }

            .ls-joystick-wrap {
                display: grid;
                justify-items: center;
                gap: 5px;
            }

            .ls-control-label {
                margin: 0;
                color: #475569;
                font-size: .62rem;
                font-weight: 900;
                letter-spacing: .08em;
                text-transform: uppercase;
            }

            .ls-joystick {
                position: relative;
                width: 112px;
                height: 112px;
                border: 2px solid #94A3B8;
                border-radius: 50%;
                background:
                    radial-gradient(circle, #F8FAFC 0 23%, transparent 24%),
                    linear-gradient(90deg, transparent 49%, rgba(100,116,139,.18) 50%, transparent 51%),
                    linear-gradient(transparent 49%, rgba(100,116,139,.18) 50%, transparent 51%),
                    #E2E8F0;
                box-shadow: inset 0 4px 12px rgba(15,23,42,.12);
                cursor: grab;
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
            }

            .ls-joystick:focus-visible {
                outline: 3px solid #2563EB;
                outline-offset: 3px;
            }

            .ls-joystick.is-active {
                cursor: grabbing;
            }

            .ls-joystick-knob {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 48px;
                height: 48px;
                border: 2px solid rgba(255,255,255,.8);
                border-radius: 50%;
                background: linear-gradient(145deg, #64748B, #334155);
                box-shadow: 0 5px 12px rgba(15,23,42,.3);
                transform: translate(-50%, -50%);
                pointer-events: none;
                transition: transform 80ms ease-out;
            }

            .ls-joystick.is-active .ls-joystick-knob {
                transition: none;
            }

            .ls-listen {
                min-width: 132px;
                min-height: 76px;
                padding: 12px 18px;
                border: 2px solid #F59E0B;
                border-radius: 18px;
                background: #FEF3C7;
                color: #78350F;
                font-size: .9rem;
                font-weight: 900;
                cursor: pointer;
                touch-action: manipulation;
                user-select: none;
            }

            .ls-listen:active {
                transform: scale(.97);
            }

            .ls-listen:focus-visible {
                outline: 3px solid #2563EB;
                outline-offset: 3px;
            }

            .ls-listen small {
                display: block;
                margin-top: 4px;
                font-size: .58rem;
                letter-spacing: .06em;
            }

            .ls-help {
                margin: 7px 2px 0;
                color: #64748B;
                font-size: .68rem;
                line-height: 1.35;
                text-align: center;
            }

            /*
             * LOST SHEEP RESULT CONTRAST
             */
            #lsOverlay .game-result-card {
                background: #FFFDF7 !important;
                color: #0F172A !important;
            }

            #lsOverlay .game-result-card h2,
            #lsOverlay .game-result-card strong,
            #lsOverlay .game-result-card span,
            #lsOverlay .game-result-card p {
                color: inherit;
            }

            @media (max-width: 520px) {
                .ls-header {
                    align-items: flex-start;
                }

                .ls-header-title p {
                    display: none;
                }

                .ls-stat {
                    min-width: 51px;
                    padding: 5px 6px;
                }

                .ls-control-deck {
                    min-height: 124px;
                    gap: 18px;
                    margin-top: 7px;
                    padding: 7px 10px;
                }

                .ls-joystick {
                    width: 96px;
                    height: 96px;
                }

                .ls-joystick-knob {
                    width: 42px;
                    height: 42px;
                }

                .ls-listen {
                    min-width: 116px;
                    min-height: 68px;
                    padding: 10px 13px;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    },


    mountGameUI: function() {

        this.cleanup();

        this.ensureStyles();

        const area =
            document.getElementById(
                'arcadeActiveGameArea'
            );

        if (!area) {
            return;
        }

        this.area =
            area;

        const list =
            document.getElementById(
                'arcadeGamesList'
            );

        if (list) {
            list.style.display =
                'none';
        }

        const grid =
            document.getElementById(
                'arcadeGridItems'
            );

        if (grid) {
            grid.style.display =
                'none';
        }

        const featured =
            document.getElementById(
                'featuredArcadeGameContainer'
            );

        if (featured) {
            featured.style.display =
                'none';
        }

        area.hidden =
            false;

        area.style.display =
            'block';

        area.innerHTML = `
            <div class="ls-shell">
                <div class="ls-header">
                    <div class="ls-header-title">
                        <h2>
                            🐑 Lost Sheep: Shepherd's Search
                        </h2>

                        <p>
                            Search • Find • Guide Home
                        </p>
                    </div>

                    <div class="ls-stats">
                        <div class="ls-stat">
                            <span>RESCUED</span>
                            <strong id="lsRescues">0 / 3</strong>
                        </div>

                        <div class="ls-stat">
                            <span>CLUES</span>
                            <strong id="lsClues">0</strong>
                        </div>

                        <div class="ls-stat">
                            <span>SCORE</span>
                            <strong id="lsScore">0</strong>
                        </div>
                    </div>
                </div>

                <div class="ls-game-wrap">
                    <canvas
                        id="lsCanvas"
                        width="720"
                        height="520"
                        aria-label="Lost Sheep shepherd search game"
                    ></canvas>

                    <div
                        id="lsOverlay"
                        aria-live="polite"
                    >
                        <div class="ls-start-card">
                            <div
                                style="
                                    font-size:2.7rem;
                                    line-height:1;
                                    margin-bottom:8px;
                                "
                            >
                                🐑
                            </div>

                            <h2>
                                Find the Lost Sheep
                            </h2>

                            <p>
                                Search three meadows.
                                Follow the golden hoofprints,
                                avoid bushes, rocks and fences,
                                find the sheep, then guide it
                                safely back to the fold.
                            </p>

                            <p>
                                Use the movement controls or
                                Arrow Keys / WASD.
                                Tap <strong>LISTEN</strong>
                                for a directional bleat hint,
                                but frequent hints reduce your
                                efficiency bonus.
                            </p>

                            <p class="ls-scripture">
                                Inspired by LUKE 15:4–6
                            </p>

                            <button
                                class="btn btn-primary"
                                onclick="V14LostSheep.startGame()"
                            >
                                🐑 BEGIN SEARCH
                            </button>

                            <button
                                class="btn btn-outline"
                                onclick="V14LostSheep.exitGame()"
                                style="margin-left:6px;"
                            >
                                Back to Games
                            </button>
                        </div>
                    </div>

                </div>

                <section
                    class="ls-control-deck"
                    aria-label="Lost Sheep controls"
                >
                    <div class="ls-joystick-wrap">
                        <p class="ls-control-label">
                            Move shepherd
                        </p>

                        <div
                            class="ls-joystick"
                            data-control="joystick"
                            role="application"
                            tabindex="0"
                            aria-label="Movement joystick. Drag in any direction, or use Arrow Keys or WASD."
                        >
                            <span
                                class="ls-joystick-knob"
                                aria-hidden="true"
                            ></span>
                        </div>
                    </div>

                    <button
                        class="ls-listen"
                        data-action="listen"
                        aria-label="Listen for the sheep. Keyboard shortcut Q or Space."
                    >
                        👂 LISTEN
                        <small>Q / SPACE</small>
                    </button>
                </section>

                <p class="ls-help">
                    Find 🐑 • Collect golden hoofprints •
                    Return the sheep to the fold •
                    LISTEN gives a direction hint
                </p>
            </div>
        `;

        this.canvas =
            document.getElementById(
                'lsCanvas'
            );

        this.ctx =
            this.canvas
                ? this.canvas.getContext(
                    '2d'
                )
                : null;

        this.overlay =
            document.getElementById(
                'lsOverlay'
            );

        this.bindEvents();

        this.draw();
    },


    bindEvents: function() {

        this.cleanupEvents();

        this.keys =
            new Set();

        this.joystickVector = {
            x: 0,
            y: 0
        };

        this.joystickPointerId =
            null;

        this.boundHandlers = [];

        const keyDown =
            event => {

                const key =
                    String(
                        event.key || ''
                    ).toLowerCase();

                const movementKeys =
                    [
                        'arrowup',
                        'arrowdown',
                        'arrowleft',
                        'arrowright',
                        'w',
                        'a',
                        's',
                        'd'
                    ];

                if (
                    movementKeys.includes(
                        key
                    )
                ) {
                    event.preventDefault();

                    this.keys.add(
                        key
                    );
                }

                if (
                    key === 'q'
                    || key === ' '
                ) {
                    event.preventDefault();

                    this.listenForSheep();
                }
            };

        const keyUp =
            event => {

                const key =
                    String(
                        event.key || ''
                    ).toLowerCase();

                this.keys.delete(
                    key
                );
            };

        window.addEventListener(
            'keydown',
            keyDown,
            {
                passive: false
            }
        );

        window.addEventListener(
            'keyup',
            keyUp
        );

        this.boundHandlers.push(
            {
                target: window,
                type: 'keydown',
                handler: keyDown,
                options: {
                    passive: false
                }
            },
            {
                target: window,
                type: 'keyup',
                handler: keyUp
            }
        );

        const joystick =
            document.querySelector(
                '#arcadeActiveGameArea [data-control="joystick"]'
            );

        if (joystick) {
            const updateJoystick =
                event => {
                    if (
                        this.joystickPointerId !== null
                        && event.pointerId !== this.joystickPointerId
                    ) {
                        return;
                    }

                    event.preventDefault();

                    const rect =
                        joystick.getBoundingClientRect();

                    const centerX =
                        rect.left + rect.width / 2;

                    const centerY =
                        rect.top + rect.height / 2;

                    const deltaX =
                        event.clientX - centerX;

                    const deltaY =
                        event.clientY - centerY;

                    const distance =
                        Math.hypot(deltaX, deltaY);

                    const maxTravel =
                        Math.max(1, rect.width * 0.31);

                    const proportionalStrength =
                        Math.min(1, distance / maxTravel);

                    const normalizationScale =
                        distance > 0
                            ? proportionalStrength / distance
                            : 0;

                    this.joystickVector = {
                        x: deltaX * normalizationScale,
                        y: deltaY * normalizationScale
                    };

                    const knob =
                        joystick.querySelector(
                            '.ls-joystick-knob'
                        );

                    if (knob) {
                        const knobX =
                            this.joystickVector.x
                            * maxTravel;

                        const knobY =
                            this.joystickVector.y
                            * maxTravel;

                        knob.style.transform =
                            `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
                    }
                };

            const startJoystick =
                event => {
                    event.preventDefault();

                    this.joystickPointerId =
                        event.pointerId;

                    joystick.classList.add(
                        'is-active'
                    );

                    if (
                        typeof joystick.setPointerCapture
                        === 'function'
                    ) {
                        try {
                            joystick.setPointerCapture(
                                event.pointerId
                            );
                        } catch (error) {
                            // Pointer capture is optional.
                        }
                    }

                    updateJoystick(event);
                };

            const moveJoystick =
                event => {
                    if (
                        event.pointerId
                        === this.joystickPointerId
                    ) {
                        updateJoystick(event);
                    }
                };

            const resetJoystick =
                event => {
                    if (
                        event
                        && this.joystickPointerId !== null
                        && event.pointerId !== this.joystickPointerId
                    ) {
                        return;
                    }

                    if (event) {
                        event.preventDefault();
                    }

                    this.resetJoystick();
                };

            [
                ['pointerdown', startJoystick],
                ['pointermove', moveJoystick],
                ['pointerup', resetJoystick],
                ['pointercancel', resetJoystick],
                ['lostpointercapture', resetJoystick]
            ].forEach(
                ([type, handler]) => {
                    const options = {
                        passive: false
                    };

                    joystick.addEventListener(
                        type,
                        handler,
                        options
                    );

                    this.boundHandlers.push({
                        target: joystick,
                        type,
                        handler,
                        options
                    });
                }
            );
        }

        const listenButton =
            document.querySelector(
                '#arcadeActiveGameArea [data-action="listen"]'
            );

        if (listenButton) {

            const listen =
                event => {

                    event.preventDefault();

                    this.listenForSheep();
                };

            listenButton.addEventListener(
                'click',
                listen
            );

            this.boundHandlers.push(
                {
                    target: listenButton,
                    type: 'click',
                    handler: listen
                }
            );
        }
    },


    cleanupEvents: function() {

        if (
            Array.isArray(
                this.boundHandlers
            )
        ) {
            this.boundHandlers.forEach(
                binding => {

                    try {
                        binding.target.removeEventListener(
                            binding.type,
                            binding.handler,
                            binding.options
                        );
                    } catch (error) {
                        // Cleanup must never block exit.
                    }
                }
            );
        }

        this.boundHandlers =
            [];

        if (this.keys) {
            this.keys.clear();
        }

        this.resetJoystick();
    },


    resetJoystick: function() {

        this.joystickVector = {
            x: 0,
            y: 0
        };

        this.joystickPointerId =
            null;

        const joystick =
            document.querySelector(
                '#arcadeActiveGameArea [data-control="joystick"]'
            );

        if (!joystick) {
            return;
        }

        joystick.classList.remove(
            'is-active'
        );

        const knob =
            joystick.querySelector(
                '.ls-joystick-knob'
            );

        if (knob) {
            knob.style.transform =
                'translate(-50%, -50%)';
        }
    },


    startGame: function() {

        if (
            !this.canvas
            || !this.canvas.isConnected
        ) {
            this.mountGameUI();
        }

        if (
            !this.canvas
            || !this.ctx
        ) {
            return;
        }

        if (this.frameId) {
            cancelAnimationFrame(
                this.frameId
            );
        }

        if (this.roundAdvanceTimer) {
            clearTimeout(
                this.roundAdvanceTimer
            );

            this.roundAdvanceTimer =
                null;
        }

        this.phase =
            'search';

        this.roundIndex =
            0;

        this.rescues =
            0;

        this.score =
            0;

        this.totalClues =
            0;

        this.totalCollisions =
            0;

        this.totalListens =
            0;

        this.roundCollisions =
            0;

        this.roundClues =
            0;

        this.finished =
            false;

        this.gameStartedAt =
            performance.now();

        this.listenCooldownUntil =
            0;

        this.listenPulseUntil =
            0;

        this.message =
            'Search the meadow for the lost sheep.';

        this.messageUntil =
            performance.now()
            + 2300;

        if (this.overlay) {
            this.overlay.style.display =
                'none';
        }

        this.startRound(
            0
        );

        this.lastFrameTime =
            performance.now();

        this.frameId =
            requestAnimationFrame(
                timestamp =>
                    this.loop(
                        timestamp
                    )
            );
    },


    startRound: function(index) {

        const layout =
            this.layouts[index];

        if (!layout) {
            this.finishGame();
            return;
        }

        this.roundIndex =
            index;

        this.phase =
            'search';

        this.roundCollisions =
            0;

        this.roundClues =
            0;

        this.roundStartedAt =
            performance.now();

        this.foundAt =
            0;

        this.player = {
            x:
                this.FOLD.x
                + this.FOLD.w / 2,

            y:
                this.FOLD.y
                + 20
        };

        this.sheep = {
            x:
                layout.sheep.x,

            y:
                layout.sheep.y
        };

        this.clues =
            layout.clues.map(
                clue => ({
                    x: clue.x,
                    y: clue.y,
                    collected: false
                })
            );

        this.obstacles =
            layout.obstacles.map(
                obstacle => ({
                    ...obstacle
                })
            );

        this.message =
            `Meadow ${index + 1}: follow the clues.`;

        this.messageUntil =
            performance.now()
            + 1800;

        this.updateHud();
    },


    getMovementVector: function() {

        let x = 0;
        let y = 0;

        const keys =
            this.keys
            || new Set();

        if (
            keys.has('arrowleft')
            || keys.has('a')
        ) {
            x -= 1;
        }

        if (
            keys.has('arrowright')
            || keys.has('d')
        ) {
            x += 1;
        }

        if (
            keys.has('arrowup')
            || keys.has('w')
        ) {
            y -= 1;
        }

        if (
            keys.has('arrowdown')
            || keys.has('s')
        ) {
            y += 1;
        }

        x += Number(
            this.joystickVector
            && this.joystickVector.x
        ) || 0;

        y += Number(
            this.joystickVector
            && this.joystickVector.y
        ) || 0;

        const magnitude =
            Math.hypot(x, y);

        if (magnitude > 1) {
            x /= magnitude;
            y /= magnitude;
        }

        return {
            x,
            y
        };
    },


    circleHitsRect: function(
        cx,
        cy,
        radius,
        rect
    ) {

        const closestX =
            Math.max(
                rect.x,
                Math.min(
                    cx,
                    rect.x + rect.w
                )
            );

        const closestY =
            Math.max(
                rect.y,
                Math.min(
                    cy,
                    rect.y + rect.h
                )
            );

        const dx =
            cx - closestX;

        const dy =
            cy - closestY;

        return (
            dx * dx
            + dy * dy
        ) < (
            radius * radius
        );
    },


    collidesWithObstacle: function(
        x,
        y
    ) {

        return this.obstacles.some(
            obstacle =>
                this.circleHitsRect(
                    x,
                    y,
                    this.PLAYER_RADIUS,
                    obstacle
                )
        );
    },


    registerCollision: function() {

        const now =
            performance.now();

        if (
            now
            - this.lastCollisionAt
            < 450
        ) {
            return;
        }

        this.lastCollisionAt =
            now;

        this.totalCollisions +=
            1;

        this.roundCollisions +=
            1;

        this.score =
            Math.max(
                0,
                this.score - 35
            );

        this.message =
            'Careful — find a safe path around the obstacle.';

        this.messageUntil =
            now + 900;

        this.updateHud();
    },


    updateMovement: function(dt) {

        if (
            this.phase !== 'search'
            && this.phase !== 'return'
        ) {
            return;
        }

        const movement =
            this.getMovementVector();

        if (
            movement.x === 0
            && movement.y === 0
        ) {
            return;
        }

        const speed =
            this.MOVE_SPEED;

        const nextX =
            Math.max(
                18,
                Math.min(
                    this.WIDTH - 18,
                    this.player.x
                    + movement.x
                    * speed
                    * dt
                )
            );

        const nextY =
            Math.max(
                64,
                Math.min(
                    this.HEIGHT - 18,
                    this.player.y
                    + movement.y
                    * speed
                    * dt
                )
            );

        let moved =
            false;

        if (
            !this.collidesWithObstacle(
                nextX,
                this.player.y
            )
        ) {
            this.player.x =
                nextX;

            moved =
                true;
        }

        if (
            !this.collidesWithObstacle(
                this.player.x,
                nextY
            )
        ) {
            this.player.y =
                nextY;

            moved =
                true;
        }

        if (!moved) {
            this.registerCollision();
        }

        if (
            this.phase === 'return'
        ) {
            this.updateFollowingSheep(
                dt
            );
        }
    },


    updateFollowingSheep: function(dt) {

        const dx =
            this.player.x
            - this.sheep.x;

        const dy =
            this.player.y
            - this.sheep.y;

        const distance =
            Math.hypot(
                dx,
                dy
            );

        if (distance > 48) {

            const followSpeed =
                118
                + this.roundIndex
                * 5;

            const amount =
                Math.min(
                    distance - 43,
                    followSpeed * dt
                );

            if (distance > 0) {
                this.sheep.x +=
                    (
                        dx / distance
                    ) * amount;

                this.sheep.y +=
                    (
                        dy / distance
                    ) * amount;
            }
        }
    },


    collectClues: function() {

        if (
            this.phase !== 'search'
        ) {
            return;
        }

        this.clues.forEach(
            clue => {

                if (clue.collected) {
                    return;
                }

                const distance =
                    Math.hypot(
                        this.player.x
                        - clue.x,

                        this.player.y
                        - clue.y
                    );

                if (distance <= 27) {

                    clue.collected =
                        true;

                    this.roundClues +=
                        1;

                    this.totalClues +=
                        1;

                    this.score +=
                        180;

                    this.message =
                        'Golden hoofprints — you are on the trail!';

                    this.messageUntil =
                        performance.now()
                        + 1000;

                    this.updateHud();
                }
            }
        );
    },


    checkSheepFound: function() {

        if (
            this.phase !== 'search'
        ) {
            return;
        }

        const distance =
            Math.hypot(
                this.player.x
                - this.sheep.x,

                this.player.y
                - this.sheep.y
            );

        if (distance > 34) {
            return;
        }

        const now =
            performance.now();

        const searchSeconds =
            (
                now
                - this.roundStartedAt
            ) / 1000;

        const findBonus =
            Math.max(
                400,
                1800
                - Math.floor(
                    searchSeconds
                    * 22
                )
            );

        const clueTrailBonus =
            this.roundClues
            === this.clues.length
                ? 450
                : 0;

        this.score +=
            1200
            + findBonus
            + clueTrailBonus;

        this.phase =
            'return';

        this.foundAt =
            now;

        this.message =
            '🐑 Sheep found! Guide it safely back to the fold.';

        this.messageUntil =
            now + 2300;

        this.updateHud();
    },


    isInsideFold: function(
        point,
        padding
    ) {

        const p =
            Number(padding) || 0;

        return (
            point.x
                >= this.FOLD.x - p
            && point.x
                <= this.FOLD.x
                    + this.FOLD.w
                    + p
            && point.y
                >= this.FOLD.y - p
            && point.y
                <= this.FOLD.y
                    + this.FOLD.h
                    + p
        );
    },


    checkRescueComplete: function() {

        if (
            this.phase !== 'return'
        ) {
            return;
        }

        if (
            !this.isInsideFold(
                this.player,
                5
            )
        ) {
            return;
        }

        if (
            !this.isInsideFold(
                this.sheep,
                42
            )
        ) {
            this.message =
                'Wait for the sheep — bring it all the way home.';

            this.messageUntil =
                performance.now()
                + 800;

            return;
        }

        this.completeRescue();
    },


    completeRescue: function() {

        if (
            this.phase !== 'return'
        ) {
            return;
        }

        const now =
            performance.now();

        const returnSeconds =
            (
                now
                - this.foundAt
            ) / 1000;

        const returnBonus =
            Math.max(
                450,
                1600
                - Math.floor(
                    returnSeconds
                    * 28
                )
            );

        const safeBonus =
            this.roundCollisions === 0
                ? 700
                : 0;

        this.score +=
            900
            + returnBonus
            + safeBonus;

        this.rescues +=
            1;

        this.phase =
            'round-complete';

        this.message =
            safeBonus
                ? '🏡 SAFE RESCUE! Sheep returned home.'
                : '🏡 Rescue complete! Sheep returned home.';

        this.messageUntil =
            now + 1400;

        this.updateHud();

        if (
            this.rescues
            >= this.ROUND_COUNT
        ) {
            this.roundAdvanceTimer =
                setTimeout(
                    () => {
                        this.finishGame();
                    },
                    1000
                );

            return;
        }

        this.roundAdvanceTimer =
            setTimeout(
                () => {

                    this.startRound(
                        this.roundIndex + 1
                    );
                },
                1100
            );
    },


    listenForSheep: function() {

        if (
            this.phase !== 'search'
        ) {
            return;
        }

        const now =
            performance.now();

        if (
            now
            < this.listenCooldownUntil
        ) {
            this.message =
                'Listen again in a moment…';

            this.messageUntil =
                now + 600;

            return;
        }

        this.listenCooldownUntil =
            now + 2500;

        this.totalListens +=
            1;

        this.score =
            Math.max(
                0,
                this.score - 40
            );

        const dx =
            this.sheep.x
            - this.player.x;

        const dy =
            this.sheep.y
            - this.player.y;

        const angle =
            Math.atan2(
                dy,
                dx
            );

        const eighth =
            Math.PI / 4;

        const index =
            Math.round(
                angle / eighth
            );

        const arrows = {
            '-4': '←',
            '-3': '↖',
            '-2': '↑',
            '-1': '↗',
            '0': '→',
            '1': '↘',
            '2': '↓',
            '3': '↙',
            '4': '←'
        };

        this.listenArrow =
            arrows[String(index)]
            || '•';

        this.listenPulseUntil =
            now + 1500;

        this.message =
            `👂 Faint bleat ${this.listenArrow}`;

        this.messageUntil =
            now + 1500;

        this.updateHud();
    },


    updateHud: function() {

        const rescued =
            document.getElementById(
                'lsRescues'
            );

        const clues =
            document.getElementById(
                'lsClues'
            );

        const score =
            document.getElementById(
                'lsScore'
            );

        if (rescued) {
            rescued.textContent =
                `${this.rescues} / ${this.ROUND_COUNT}`;
        }

        if (clues) {
            clues.textContent =
                String(
                    this.totalClues
                );
        }

        if (score) {
            score.textContent =
                String(
                    Math.floor(
                        this.score
                    )
                );
        }
    },


    loop: function(timestamp) {

        /*
         * The immersive shell's generic Exit Game can remove
         * the active game area without calling V14 cleanup.
         * Stop safely if the canvas is detached.
         */
        if (
            !this.canvas
            || !this.canvas.isConnected
        ) {
            this.cleanup();
            return;
        }

        if (this.finished) {
            return;
        }

        const delta =
            Math.min(
                0.04,
                Math.max(
                    0,
                    (
                        timestamp
                        - this.lastFrameTime
                    ) / 1000
                )
            );

        this.lastFrameTime =
            timestamp;

        this.updateMovement(
            delta
        );

        this.collectClues();

        this.checkSheepFound();

        this.checkRescueComplete();

        this.draw();

        this.frameId =
            requestAnimationFrame(
                nextTimestamp =>
                    this.loop(
                        nextTimestamp
                    )
            );
    },


    draw: function() {

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
            this.WIDTH,
            this.HEIGHT
        );

        this.drawMeadow(
            ctx
        );

        this.drawFold(
            ctx
        );

        this.obstacles.forEach(
            obstacle =>
                this.drawObstacle(
                    ctx,
                    obstacle
                )
        );

        this.clues.forEach(
            clue => {

                if (!clue.collected) {
                    this.drawClue(
                        ctx,
                        clue
                    );
                }
            }
        );

        this.drawSheep(
            ctx
        );

        this.drawShepherd(
            ctx
        );

        this.drawTopBanner(
            ctx
        );

        if (
            performance.now()
            < this.listenPulseUntil
        ) {
            this.drawListenPulse(
                ctx
            );
        }
    },


    drawMeadow: function(ctx) {

        const gradient =
            ctx.createLinearGradient(
                0,
                0,
                0,
                this.HEIGHT
            );

        gradient.addColorStop(
            0,
            '#BFE6F4'
        );

        gradient.addColorStop(
            .28,
            '#D9EDC4'
        );

        gradient.addColorStop(
            1,
            '#87B75D'
        );

        ctx.fillStyle =
            gradient;

        ctx.fillRect(
            0,
            0,
            this.WIDTH,
            this.HEIGHT
        );

        ctx.fillStyle =
            'rgba(255,255,255,.25)';

        for (
            let x = 18;
            x < this.WIDTH;
            x += 58
        ) {
            const y =
                90
                + (
                    (
                        x * 37
                    ) % 320
                );

            ctx.beginPath();

            ctx.arc(
                x,
                y,
                2,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        ctx.fillStyle =
            '#6A934B';

        ctx.fillRect(
            0,
            414,
            this.WIDTH,
            106
        );

        ctx.fillStyle =
            'rgba(255,255,255,.10)';

        ctx.beginPath();

        ctx.moveTo(
            340,
            520
        );

        ctx.lineTo(
            330,
            395
        );

        ctx.lineTo(
            390,
            395
        );

        ctx.lineTo(
            382,
            520
        );

        ctx.closePath();

        ctx.fill();
    },


    drawFold: function(ctx) {

        const f =
            this.FOLD;

        ctx.save();

        ctx.fillStyle =
            'rgba(120,53,15,.18)';

        ctx.fillRect(
            f.x,
            f.y,
            f.w,
            f.h
        );

        ctx.strokeStyle =
            '#7C4A1E';

        ctx.lineWidth =
            5;

        for (
            let x = f.x;
            x <= f.x + f.w;
            x += 22
        ) {
            ctx.beginPath();

            ctx.moveTo(
                x,
                f.y
            );

            ctx.lineTo(
                x,
                f.y + f.h
            );

            ctx.stroke();
        }

        ctx.lineWidth =
            4;

        ctx.beginPath();

        ctx.moveTo(
            f.x,
            f.y + 18
        );

        ctx.lineTo(
            f.x + f.w,
            f.y + 18
        );

        ctx.moveTo(
            f.x,
            f.y + 48
        );

        ctx.lineTo(
            f.x + f.w,
            f.y + 48
        );

        ctx.stroke();

        ctx.fillStyle =
            '#FFF7D6';

        ctx.font =
            '700 13px system-ui';

        ctx.textAlign =
            'center';

        ctx.fillText(
            'THE FOLD',
            f.x + f.w / 2,
            f.y - 8
        );

        ctx.restore();
    },


    drawObstacle: function(
        ctx,
        obstacle
    ) {

        ctx.save();

        if (
            obstacle.type
            === 'bush'
        ) {
            ctx.fillStyle =
                '#3F7C42';

            const radius =
                18;

            const count =
                Math.max(
                    3,
                    Math.floor(
                        obstacle.w / 28
                    )
                );

            for (
                let i = 0;
                i < count;
                i += 1
            ) {
                const x =
                    obstacle.x
                    + (
                        i
                        / Math.max(
                            1,
                            count - 1
                        )
                    )
                    * obstacle.w;

                const y =
                    obstacle.y
                    + obstacle.h / 2
                    + (
                        i % 2
                            ? 5
                            : -4
                    );

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    radius,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }

            ctx.fillStyle =
                '#6CA15C';

            ctx.fillRect(
                obstacle.x,
                obstacle.y
                    + obstacle.h / 2,
                obstacle.w,
                obstacle.h / 2
            );
        }

        if (
            obstacle.type
            === 'rock'
        ) {
            ctx.fillStyle =
                '#64748B';

            ctx.beginPath();

            ctx.roundRect(
                obstacle.x,
                obstacle.y,
                obstacle.w,
                obstacle.h,
                18
            );

            ctx.fill();

            ctx.fillStyle =
                'rgba(255,255,255,.18)';

            ctx.beginPath();

            ctx.ellipse(
                obstacle.x
                    + obstacle.w * .35,
                obstacle.y
                    + obstacle.h * .32,
                obstacle.w * .20,
                obstacle.h * .12,
                -.25,
                0,
                Math.PI * 2
            );

            ctx.fill();
        }

        if (
            obstacle.type
            === 'fence'
        ) {
            ctx.fillStyle =
                '#8B5A2B';

            ctx.fillRect(
                obstacle.x,
                obstacle.y + 5,
                obstacle.w,
                7
            );

            ctx.fillRect(
                obstacle.x,
                obstacle.y
                    + obstacle.h - 12,
                obstacle.w,
                7
            );

            for (
                let x = obstacle.x;
                x <= obstacle.x
                    + obstacle.w;
                x += 30
            ) {
                ctx.fillRect(
                    x,
                    obstacle.y,
                    7,
                    obstacle.h
                );
            }
        }

        ctx.restore();
    },


    drawClue: function(
        ctx,
        clue
    ) {

        ctx.save();

        ctx.translate(
            clue.x,
            clue.y
        );

        const pulse =
            1
            + Math.sin(
                performance.now()
                / 220
            ) * .08;

        ctx.scale(
            pulse,
            pulse
        );

        ctx.fillStyle =
            'rgba(250,204,21,.25)';

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            18,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            '#FACC15';

        ctx.beginPath();

        ctx.ellipse(
            -5,
            1,
            5,
            9,
            -.45,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.beginPath();

        ctx.ellipse(
            7,
            -5,
            5,
            9,
            -.45,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.restore();
    },


    drawSheep: function(ctx) {

        ctx.save();

        ctx.translate(
            this.sheep.x,
            this.sheep.y
        );

        ctx.fillStyle =
            this.phase === 'search'
                ? '#FFFDF7'
                : '#FFFBEB';

        [
            [-11, 0, 11],
            [0, -7, 12],
            [11, 1, 11],
            [2, 7, 11]
        ].forEach(
            part => {

                ctx.beginPath();

                ctx.arc(
                    part[0],
                    part[1],
                    part[2],
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }
        );

        ctx.fillStyle =
            '#334155';

        ctx.beginPath();

        ctx.ellipse(
            17,
            1,
            8,
            10,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            '#0F172A';

        ctx.beginPath();

        ctx.arc(
            19,
            -2,
            1.5,
            0,
            Math.PI * 2
        );

        ctx.fill();

        if (
            this.phase
            === 'return'
        ) {
            ctx.strokeStyle =
                '#FACC15';

            ctx.lineWidth =
                3;

            ctx.beginPath();

            ctx.arc(
                0,
                0,
                25,
                0,
                Math.PI * 2
            );

            ctx.stroke();
        }

        ctx.restore();
    },


    drawShepherd: function(ctx) {

        ctx.save();

        ctx.translate(
            this.player.x,
            this.player.y
        );

        ctx.fillStyle =
            'rgba(15,23,42,.18)';

        ctx.beginPath();

        ctx.ellipse(
            0,
            13,
            12,
            5,
            0,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            '#E8C39E';

        ctx.beginPath();

        ctx.arc(
            0,
            -10,
            7,
            0,
            Math.PI * 2
        );

        ctx.fill();

        ctx.fillStyle =
            '#9A6B3E';

        ctx.beginPath();

        ctx.moveTo(
            -10,
            -2
        );

        ctx.lineTo(
            10,
            -2
        );

        ctx.lineTo(
            7,
            15
        );

        ctx.lineTo(
            -7,
            15
        );

        ctx.closePath();

        ctx.fill();

        ctx.strokeStyle =
            '#6B4423';

        ctx.lineWidth =
            3;

        ctx.beginPath();

        ctx.moveTo(
            12,
            -5
        );

        ctx.lineTo(
            13,
            20
        );

        ctx.quadraticCurveTo(
            23,
            22,
            22,
            13
        );

        ctx.stroke();

        ctx.restore();
    },


    drawTopBanner: function(ctx) {

        ctx.save();

        ctx.fillStyle =
            'rgba(15,23,42,.72)';

        ctx.fillRect(
            0,
            0,
            this.WIDTH,
            58
        );

        ctx.fillStyle =
            '#FFFFFF';

        ctx.font =
            '800 15px system-ui';

        ctx.textAlign =
            'left';

        const phaseText =
            this.phase === 'return'
                ? '🐑 GUIDE THE SHEEP HOME'
                : this.phase === 'round-complete'
                    ? '🏡 RESCUE COMPLETE'
                    : `🔎 MEADOW ${this.roundIndex + 1} — SEARCH`;

        ctx.fillText(
            phaseText,
            16,
            24
        );

        ctx.font =
            '600 11px system-ui';

        ctx.fillStyle =
            '#E2E8F0';

        const now =
            performance.now();

        const status =
            now < this.messageUntil
                ? this.message
                : (
                    this.phase
                    === 'return'
                        ? 'Return to THE FOLD with the sheep.'
                        : 'Follow hoofprints or LISTEN for a directional hint.'
                );

        ctx.fillText(
            status,
            16,
            44
        );

        ctx.textAlign =
            'right';

        ctx.fillStyle =
            '#FEF3C7';

        ctx.font =
            '800 12px system-ui';

        ctx.fillText(
            `RESCUES ${this.rescues}/${this.ROUND_COUNT}`,
            this.WIDTH - 16,
            24
        );

        ctx.restore();
    },


    drawListenPulse: function(ctx) {

        ctx.save();

        ctx.fillStyle =
            'rgba(254,243,199,.94)';

        ctx.strokeStyle =
            '#D97706';

        ctx.lineWidth =
            2;

        ctx.beginPath();

        ctx.roundRect(
            this.WIDTH / 2 - 72,
            70,
            144,
            62,
            15
        );

        ctx.fill();

        ctx.stroke();

        ctx.fillStyle =
            '#92400E';

        ctx.textAlign =
            'center';

        ctx.font =
            '900 28px system-ui';

        ctx.fillText(
            `👂 ${this.listenArrow}`,
            this.WIDTH / 2,
            105
        );

        ctx.font =
            '800 10px system-ui';

        ctx.fillText(
            'FAINT BLEAT',
            this.WIDTH / 2,
            122
        );

        ctx.restore();
    },


    finishGame: async function() {

        if (this.finished) {
            return;
        }

        this.finished =
            true;

        this.phase =
            'finished';

        if (this.frameId) {
            cancelAnimationFrame(
                this.frameId
            );

            this.frameId =
                null;
        }

        const elapsedSeconds =
            Math.max(
                0,
                (
                    performance.now()
                    - this.gameStartedAt
                ) / 1000
            );

        const completionBonus =
            1600;

        const perfectRescueBonus =
            this.totalCollisions === 0
                ? 1200
                : 0;

        const timeBonus =
            Math.max(
                0,
                2200
                - Math.floor(
                    elapsedSeconds
                    * 10
                )
            );

        const listenEfficiencyBonus =
            Math.max(
                0,
                600
                - this.totalListens
                * 75
            );

        const finalScore =
            Math.max(
                0,
                Math.floor(
                    this.score
                    + completionBonus
                    + perfectRescueBonus
                    + timeBonus
                    + listenEfficiencyBonus
                )
            );

        const accuracy =
            Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        100
                        - this.totalCollisions
                            * 5
                        - this.totalListens
                            * 2
                    )
                )
            );

        this.score =
            finalScore;

        this.updateHud();

        if (this.overlay) {
            this.overlay.style.display =
                'flex';
        }

        if (
            window.V10Expansion
            && typeof window
                .V10Expansion
                .submitCanvasGameResult
                === 'function'
        ) {
            await window
                .V10Expansion
                .submitCanvasGameResult({
                    gameName:
                        this.GAME_NAME,

                    score:
                        finalScore,

                    overlayId:
                        'lsOverlay',

                    playAgain:
                        'V14LostSheep.startGame()',

                    accuracy:
                        accuracy
                });
        }
    },


    cleanup: function() {

        if (this.frameId) {
            cancelAnimationFrame(
                this.frameId
            );

            this.frameId =
                null;
        }

        if (this.roundAdvanceTimer) {
            clearTimeout(
                this.roundAdvanceTimer
            );

            this.roundAdvanceTimer =
                null;
        }

        this.cleanupEvents();

        this.canvas =
            null;

        this.ctx =
            null;

        this.overlay =
            null;

        this.area =
            null;

        this.phase =
            'idle';
    },


    exitGame: function() {

        this.cleanup();

        if (
            window.V10Expansion
            && typeof window
                .V10Expansion
                .exitGame
                === 'function'
        ) {
            window
                .V10Expansion
                .exitGame();
        }
    }
};
