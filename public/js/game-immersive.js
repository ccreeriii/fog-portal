(function () {
    'use strict';

    const GameImmersiveMode = {
        activeArea: null,
        currentGameName: '',
        placeholder: null,
        host: null,

        scrollY: 0,
        savedBody: null,
        savedHtml: null,

        observerArcade: null,
        observerGrowth: null,
        resizeObserver: null,

        fitFrame: null,
        evaluationFrame: null,

        initialized: false,

        engineByGame: {
            "David's Slingshot": 'V8Slingshot',
            "Noah's Ark: Rescue": 'V8NoahsArk',
            "Moses' Red Sea Dash": 'V8RedSea',
            "Peter's Leap of Faith": 'V8PetersLeap',
            "Jonah's Deep Sea Dive": 'V8JonahsDive',
            "Jericho: Walls Fall": 'V11Jericho'
        },

        init: function () {
            if (this.initialized) return;
            this.initialized = true;

            const arcade =
                document.getElementById(
                    'arcadeActiveGameArea'
                );

            const growth =
                document.getElementById(
                    'growthActiveGameArea'
                );

            if (!arcade || !growth) {
                console.warn(
                    '[Games] Immersive mode could not find active game areas.'
                );
                return;
            }

            const watch = area => {
                const observer =
                    new MutationObserver(
                        () => this.scheduleEvaluation()
                    );

                observer.observe(
                    area,
                    {
                        childList: true,
                        attributes: true,
                        attributeFilter: [
                            'hidden',
                            'style',
                            'class'
                        ]
                    }
                );

                return observer;
            };

            this.observerArcade = watch(arcade);
            this.observerGrowth = watch(growth);

            /*
             * Remember which game the player selected.
             * This lets the universal Exit button call the
             * legacy game's own cleanup function when available.
             */
            document.addEventListener(
                'click',
                event => {
                    const tile =
                        event.target.closest(
                            '[data-game-name]'
                        );

                    if (!tile) return;

                    const belongsToGames =
                        tile.closest(
                            '#arcadeGridItems'
                        )
                        || tile.closest(
                            '#growthGamesGrid'
                        )
                        || tile.closest(
                            '#featuredArcadeGameContainer'
                        )
                        || tile.closest(
                            '#featuredGrowthGameContainer'
                        );

                    if (!belongsToGames) return;

                    this.currentGameName =
                        tile.dataset.gameName
                        || '';

                    this.scheduleEvaluation();
                },
                true
            );

            /*
             * Escape exits gameplay on desktop.
             * Browser zoom shortcuts are suppressed only
             * while a game is active.
             */
            document.addEventListener(
                'keydown',
                event => {
                    if (!this.activeArea) return;

                    if (
                        event.key === 'Escape'
                        && !event.ctrlKey
                        && !event.metaKey
                    ) {
                        event.preventDefault();
                        this.requestExit();
                        return;
                    }

                    if (
                        event.ctrlKey
                        || event.metaKey
                    ) {
                        const blocked = [
                            '+',
                            '-',
                            '=',
                            '0'
                        ];

                        if (
                            blocked.includes(event.key)
                        ) {
                            event.preventDefault();
                        }
                    }
                },
                true
            );

            /*
             * Trackpad pinch is commonly exposed as Ctrl+wheel.
             */
            document.addEventListener(
                'wheel',
                event => {
                    if (
                        this.activeArea
                        && event.ctrlKey
                    ) {
                        event.preventDefault();
                    }
                },
                {
                    passive: false,
                    capture: true
                }
            );

            /*
             * Prevent multi-touch pinch while game mode is active.
             * Single-touch game controls remain available.
             */
            document.addEventListener(
                'touchmove',
                event => {
                    if (
                        this.activeArea
                        && event.touches
                        && event.touches.length > 1
                    ) {
                        event.preventDefault();
                    }
                },
                {
                    passive: false,
                    capture: true
                }
            );

            /*
             * Safari gesture events.
             */
            [
                'gesturestart',
                'gesturechange',
                'gestureend'
            ].forEach(type => {
                document.addEventListener(
                    type,
                    event => {
                        if (!this.activeArea) return;
                        event.preventDefault();
                    },
                    {
                        passive: false,
                        capture: true
                    }
                );
            });

            /*
             * Avoid browser double-click zoom during gameplay.
             */
            document.addEventListener(
                'dblclick',
                event => {
                    if (!this.activeArea) return;

                    if (
                        this.host
                        && this.host.contains(
                            event.target
                        )
                    ) {
                        event.preventDefault();
                    }
                },
                {
                    passive: false,
                    capture: true
                }
            );

            window.addEventListener(
                'resize',
                () => this.scheduleFit()
            );

            window.addEventListener(
                'orientationchange',
                () => {
                    setTimeout(
                        () => this.scheduleFit(),
                        80
                    );
                }
            );

            if (window.visualViewport) {
                window.visualViewport
                    .addEventListener(
                        'resize',
                        () => this.scheduleFit()
                    );
            }

            this.scheduleEvaluation();
        },

        isAreaActive: function (area) {
            if (!area) return false;

            if (
                area.childElementCount === 0
                && area.textContent.trim() === ''
            ) {
                return false;
            }

            if (area.hidden) {
                return false;
            }

            const display =
                window.getComputedStyle(area)
                    .display;

            return display !== 'none';
        },

        scheduleEvaluation: function () {
            if (this.evaluationFrame) {
                cancelAnimationFrame(
                    this.evaluationFrame
                );
            }

            this.evaluationFrame =
                requestAnimationFrame(
                    () => {
                        this.evaluationFrame = null;
                        this.evaluate();
                    }
                );
        },

        evaluate: function () {
            if (this.activeArea) {
                const stillHasContent =
                    this.activeArea
                        .childElementCount > 0
                    || this.activeArea
                        .textContent.trim() !== '';

                const stillShown =
                    !this.activeArea.hidden
                    && window
                        .getComputedStyle(
                            this.activeArea
                        )
                        .display !== 'none';

                if (
                    !stillHasContent
                    || !stillShown
                ) {
                    this.release();
                    return;
                }

                this.scheduleFit();
                return;
            }

            const arcade =
                document.getElementById(
                    'arcadeActiveGameArea'
                );

            const growth =
                document.getElementById(
                    'growthActiveGameArea'
                );

            if (this.isAreaActive(arcade)) {
                this.enter(arcade, 'arcade');
                return;
            }

            if (this.isAreaActive(growth)) {
                this.enter(growth, 'growth');
            }
        },

        createHost: function (kind) {
            const host =
                document.createElement('div');

            host.id = 'gameImmersiveHost';

            host.setAttribute(
                'role',
                'dialog'
            );

            host.setAttribute(
                'aria-modal',
                'true'
            );

            host.setAttribute(
                'aria-label',
                kind === 'arcade'
                    ? 'FOG Arcade game'
                    : 'Faith Quest game'
            );

            const toolbar =
                document.createElement('div');

            toolbar.className =
                'game-immersive-toolbar';

            const label =
                document.createElement('div');

            label.className =
                'game-immersive-label';

            label.textContent =
                this.currentGameName
                || (
                    kind === 'arcade'
                        ? '🎮 FOG Arcade'
                        : '✨ Faith Quest'
                );

            const exit =
                document.createElement('button');

            exit.type = 'button';

            exit.className =
                'game-immersive-exit';

            exit.textContent =
                '✕ Exit Game';

            exit.setAttribute(
                'aria-label',
                'Exit game and return to Games'
            );

            exit.addEventListener(
                'click',
                () => this.requestExit()
            );

            toolbar.append(
                label,
                exit
            );

            const stage =
                document.createElement('div');

            stage.className =
                'game-immersive-stage';

            host.append(
                toolbar,
                stage
            );

            document.body.appendChild(host);

            return {
                host,
                stage
            };
        },

        saveProperty: function (
            element,
            property
        ) {
            return {
                value:
                    element.style
                        .getPropertyValue(
                            property
                        ),
                priority:
                    element.style
                        .getPropertyPriority(
                            property
                        )
            };
        },

        restoreProperty: function (
            element,
            property,
            saved
        ) {
            if (
                saved
                && saved.value
            ) {
                element.style.setProperty(
                    property,
                    saved.value,
                    saved.priority || ''
                );
            } else {
                element.style.removeProperty(
                    property
                );
            }
        },

        lockPortal: function () {
            const body = document.body;
            const html =
                document.documentElement;

            this.scrollY =
                window.scrollY
                || window.pageYOffset
                || 0;

            this.savedBody = {
                position:
                    this.saveProperty(
                        body,
                        'position'
                    ),
                top:
                    this.saveProperty(
                        body,
                        'top'
                    ),
                left:
                    this.saveProperty(
                        body,
                        'left'
                    ),
                right:
                    this.saveProperty(
                        body,
                        'right'
                    ),
                width:
                    this.saveProperty(
                        body,
                        'width'
                    ),
                overflow:
                    this.saveProperty(
                        body,
                        'overflow'
                    )
            };

            this.savedHtml = {
                overflow:
                    this.saveProperty(
                        html,
                        'overflow'
                    )
            };

            body.style.setProperty(
                'position',
                'fixed',
                'important'
            );

            body.style.setProperty(
                'top',
                `-${this.scrollY}px`,
                'important'
            );

            body.style.setProperty(
                'left',
                '0',
                'important'
            );

            body.style.setProperty(
                'right',
                '0',
                'important'
            );

            body.style.setProperty(
                'width',
                '100%',
                'important'
            );

            body.style.setProperty(
                'overflow',
                'hidden',
                'important'
            );

            html.style.setProperty(
                'overflow',
                'hidden',
                'important'
            );

            html.classList.add(
                'game-immersive-active'
            );

            body.classList.add(
                'game-immersive-active'
            );
        },

        unlockPortal: function () {
            const body = document.body;
            const html =
                document.documentElement;

            if (this.savedBody) {
                Object.entries(
                    this.savedBody
                ).forEach(
                    ([property, saved]) => {
                        this.restoreProperty(
                            body,
                            property,
                            saved
                        );
                    }
                );
            }

            if (this.savedHtml) {
                Object.entries(
                    this.savedHtml
                ).forEach(
                    ([property, saved]) => {
                        this.restoreProperty(
                            html,
                            property,
                            saved
                        );
                    }
                );
            }

            html.classList.remove(
                'game-immersive-active'
            );

            body.classList.remove(
                'game-immersive-active'
            );

            const y = this.scrollY;

            this.savedBody = null;
            this.savedHtml = null;

            requestAnimationFrame(
                () => {
                    window.scrollTo(
                        0,
                        y
                    );
                }
            );
        },

        enter: function (area, kind) {
            if (
                !area
                || this.activeArea
            ) {
                return;
            }

            const originalParent =
                area.parentNode;

            if (!originalParent) return;

            this.activeArea = area;

            this.placeholder =
                document.createComment(
                    'game-immersive-placeholder'
                );

            originalParent.insertBefore(
                this.placeholder,
                area
            );

            this.lockPortal();

            const created =
                this.createHost(kind);

            this.host = created.host;

            area.classList.add(
                'game-immersive-surface'
            );

            created.stage.appendChild(area);

            if (
                window.ResizeObserver
            ) {
                this.resizeObserver =
                    new ResizeObserver(
                        () =>
                            this.scheduleFit()
                    );

                this.resizeObserver
                    .observe(area);
            }

            /*
             * Run after game layout has settled.
             */
            requestAnimationFrame(
                () => {
                    requestAnimationFrame(
                        () => this.fit()
                    );
                }
            );
        },

        scheduleFit: function () {
            if (!this.activeArea) return;

            if (this.fitFrame) {
                cancelAnimationFrame(
                    this.fitFrame
                );
            }

            this.fitFrame =
                requestAnimationFrame(
                    () => {
                        this.fitFrame = null;
                        this.fit();
                    }
                );
        },

        fit: function () {
            if (
                !this.activeArea
                || !this.host
            ) return;

            const stage =
                this.host.querySelector(
                    '.game-immersive-stage'
                );

            if (!stage) return;

            const area =
                this.activeArea;

            /*
             * Measure unscaled natural dimensions.
             */
            area.style.setProperty(
                '--game-fit-scale',
                '1'
            );

            const availableWidth =
                Math.max(
                    1,
                    stage.clientWidth - 12
                );

            const availableHeight =
                Math.max(
                    1,
                    stage.clientHeight - 12
                );

            const naturalWidth =
                Math.max(
                    1,
                    area.scrollWidth,
                    area.offsetWidth
                );

            const naturalHeight =
                Math.max(
                    1,
                    area.scrollHeight,
                    area.offsetHeight
                );

            const scale =
                Math.min(
                    1,
                    availableWidth
                        / naturalWidth,
                    availableHeight
                        / naturalHeight
                );

            area.style.setProperty(
                '--game-fit-scale',
                String(
                    Number.isFinite(scale)
                        && scale > 0
                        ? scale
                        : 1
                )
            );
        },

        requestExit: function () {
            if (!this.activeArea) return;

            const area =
                this.activeArea;

            /*
             * Faith Quest games use V10's common cleanup.
             */
            if (
                area.id
                === 'growthActiveGameArea'
            ) {
                if (
                    window.V10Expansion
                    && typeof
                        window.V10Expansion
                            .exitGame
                        === 'function'
                ) {
                    window
                        .V10Expansion
                        .exitGame();
                } else {
                    area.innerHTML = '';
                    area.style.display =
                        'none';
                    area.hidden = true;
                }

                setTimeout(
                    () => {
                        if (
                            this.activeArea
                        ) {
                            this.release();
                        }
                    },
                    80
                );

                return;
            }

            /*
             * Arcade: prefer each legacy engine's own
             * cleanup so animations/timers are stopped.
             */
            const engineName =
                this.engineByGame[
                    this.currentGameName
                ];

            const engine =
                engineName
                    ? window[engineName]
                    : null;

            if (
                engine
                && typeof engine.exitGame
                    === 'function'
            ) {
                engine.exitGame();
            } else {
                /*
                 * If we don't know which engine launched,
                 * first look for one currently playing.
                 */
                const candidates =
                    Object.values(
                        this.engineByGame
                    );

                let handled = false;

                for (
                    const candidate
                    of candidates
                ) {
                    const object =
                        window[candidate];

                    if (
                        object
                        && object.isPlaying
                        && typeof object.exitGame
                            === 'function'
                    ) {
                        object.exitGame();
                        handled = true;
                        break;
                    }
                }

                if (
                    !handled
                    && window.V10Expansion
                    && typeof
                        window.V10Expansion
                            .exitGame
                        === 'function'
                ) {
                    window
                        .V10Expansion
                        .exitGame();
                }
            }

            setTimeout(
                () => {
                    if (
                        this.activeArea
                    ) {
                        this.release();
                    }
                },
                80
            );
        },

        release: function () {
            const area =
                this.activeArea;

            if (!area) return;

            if (this.resizeObserver) {
                this.resizeObserver
                    .disconnect();

                this.resizeObserver = null;
            }

            if (this.fitFrame) {
                cancelAnimationFrame(
                    this.fitFrame
                );

                this.fitFrame = null;
            }

            area.classList.remove(
                'game-immersive-surface'
            );

            area.style.removeProperty(
                '--game-fit-scale'
            );

            /*
             * Put the existing game container back at
             * its exact original location.
             */
            if (
                this.placeholder
                && this.placeholder.parentNode
            ) {
                this.placeholder
                    .parentNode
                    .insertBefore(
                        area,
                        this.placeholder
                    );

                this.placeholder.remove();
            }

            this.placeholder = null;

            if (this.host) {
                this.host.remove();
            }

            this.host = null;
            this.activeArea = null;

            this.unlockPortal();

            /*
             * Keep currentGameName until the next selection
             * so replay/exit cleanup remains predictable.
             */

            setTimeout(
                () => {
                    window.dispatchEvent(
                        new Event('resize')
                    );
                },
                30
            );
        }
    };

    window.GameImmersiveMode =
        GameImmersiveMode;

    if (
        document.readyState
        === 'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            () =>
                GameImmersiveMode.init(),
            {
                once: true
            }
        );
    } else {
        GameImmersiveMode.init();
    }
})();
