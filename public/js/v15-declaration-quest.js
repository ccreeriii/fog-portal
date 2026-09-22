'use strict';

/*
 * FIRE OF GOD MINISTRIES
 * Phase 3
 *
 * DECLARATION QUEST
 * I Am a Child of God
 *
 * Game Score measures gameplay performance only.
 * Mastery measures first-attempt recall in this game only.
 * Life Points are calculated and capped by the server.
 */

window.V15DeclarationQuest = {
    GAME_NAME: 'Declaration Quest',

    GAME_TYPE: 'growth',

    MASTERY_RECOGNITION: 'DECLARATION MASTERED',

    CANONICAL_DECLARATION: `I AM A CHILD OF GOD

I am a Child of God
I am fearfully and wonderfully made (Psalm 139:14)
I am the light of the world
and the salt of the earth (Mt 5:13-14)
I am a Child of God
I am created to prosper (Jeremiah 29:11)
I am more than a conqueror
through Jesus Christ (Rom 8:37)
I am a Child of God
Blessings are chasing after me (Deut 28:6)
Goodness & kindness will follow me
all the days of my life (Psalm 23:6)
I am a Child of God
I am healed by the stripes of Jesus (1 Pt 2:24)
I can do all things through Christ who strengthens me (Phil 4:13)
In Jesus’ name I declare,
I AM A CHILD OF GOD`,

    STAGES: Object.freeze([
        Object.freeze({
            title: 'IDENTITY',
            refrain: 'I am a Child of God'
        }),
        Object.freeze({
            title: 'PURPOSE & STRENGTH',
            refrain: 'I am a Child of God'
        }),
        Object.freeze({
            title: "GOD'S GOODNESS",
            refrain: 'I am a Child of God'
        }),
        Object.freeze({
            title: 'HEALING & STRENGTH',
            refrain: 'I am a Child of God'
        }),
        Object.freeze({
            title: 'DECLARATION FINALE',
            refrain: 'In Jesus’ name I declare,'
        })
    ]),

    CHALLENGES: Object.freeze([
        Object.freeze({
            stage: 0,
            prompt: 'I am fearfully and wonderfully ______',
            answer: 'made',
            choices: Object.freeze(['made', 'chosen', 'strengthened', 'sent']),
            statement: 'I am fearfully and wonderfully made',
            reference: 'Psalm 139:14'
        }),
        Object.freeze({
            stage: 0,
            prompt: 'I am the light of the world and the ______ of the earth',
            answer: 'salt',
            choices: Object.freeze(['hope', 'salt', 'voice', 'joy']),
            statement: 'I am the light of the world\nand the salt of the earth',
            reference: 'Mt 5:13-14'
        }),
        Object.freeze({
            stage: 1,
            prompt: 'I am created to ______',
            answer: 'prosper',
            choices: Object.freeze(['prosper', 'wander', 'compete', 'hide']),
            statement: 'I am created to prosper',
            reference: 'Jeremiah 29:11'
        }),
        Object.freeze({
            stage: 1,
            prompt: 'I am more than a conqueror ______',
            answer: 'through Jesus Christ',
            choices: Object.freeze([
                'through Jesus Christ',
                'through my own strength',
                'because I never struggle',
                'when life is easy'
            ]),
            statement: 'I am more than a conqueror\nthrough Jesus Christ',
            reference: 'Rom 8:37'
        }),
        Object.freeze({
            stage: 2,
            prompt: 'Blessings are ______ after me',
            answer: 'chasing',
            choices: Object.freeze(['waiting', 'chasing', 'hiding', 'turning']),
            statement: 'Blessings are chasing after me',
            reference: 'Deut 28:6'
        }),
        Object.freeze({
            stage: 2,
            prompt: 'Goodness & kindness will follow me ______',
            answer: 'all the days of my life',
            choices: Object.freeze([
                'all the days of my life',
                'only when I succeed',
                'for a little while',
                'when I earn them'
            ]),
            statement: 'Goodness & kindness will follow me\nall the days of my life',
            reference: 'Psalm 23:6'
        }),
        Object.freeze({
            stage: 3,
            prompt: 'I am healed by the ______ of Jesus',
            answer: 'stripes',
            choices: Object.freeze(['words', 'stripes', 'journeys', 'parables']),
            statement: 'I am healed by the stripes of Jesus',
            reference: '1 Pt 2:24'
        }),
        Object.freeze({
            stage: 3,
            prompt: 'I can do all things through Christ who ______ me',
            answer: 'strengthens',
            choices: Object.freeze(['strengthens', 'tests', 'follows', 'rewards']),
            statement: 'I can do all things through Christ who strengthens me',
            reference: 'Phil 4:13'
        }),
        Object.freeze({
            stage: 4,
            prompt: 'In Jesus’ name I ______,',
            answer: 'declare',
            choices: Object.freeze(['declare', 'wonder', 'compete', 'retreat']),
            statement: 'In Jesus’ name I declare,',
            reference: ''
        }),
        Object.freeze({
            stage: 4,
            prompt: 'I AM A ______',
            answer: 'CHILD OF GOD',
            choices: Object.freeze([
                'CHILD OF GOD',
                'LIGHT OF THE WORLD',
                'MORE THAN A CONQUEROR',
                'BELOVED CREATION'
            ]),
            statement: 'I AM A CHILD OF GOD',
            reference: ''
        })
    ]),

    area: null,
    root: null,
    monitorFrameId: null,
    boundHandlers: [],
    state: null,

    escapeText: function(value) {
        if (
            window.V10Expansion
            && typeof window.V10Expansion.escapeLeaderboardText === 'function'
        ) {
            return window.V10Expansion.escapeLeaderboardText(value);
        }

        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    formatLines: function(value) {
        return this.escapeText(value).replace(/\n/g, '<br>');
    },

    ensureStyles: function() {
        if (
            typeof document === 'undefined'
            || document.getElementById('declaration-quest-css')
        ) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'declaration-quest-css';
        style.textContent = `
            .dq-shell {
                width: 100%;
                max-width: 760px;
                margin: 0 auto;
                box-sizing: border-box;
                color: #3F2D20;
            }

            .dq-card {
                width: 100%;
                box-sizing: border-box;
                padding: clamp(15px, 3vw, 24px);
                border: 1px solid rgba(180,83,9,.18);
                border-radius: 20px;
                background:
                    radial-gradient(circle at top right, rgba(253,230,138,.48), transparent 34%),
                    linear-gradient(150deg, #FFFDF7, #FFF7E6);
                box-shadow: 0 14px 34px rgba(120,53,15,.13);
            }

            .dq-start {
                text-align: center;
            }

            .dq-icon {
                margin-bottom: 8px;
                font-size: 3rem;
                line-height: 1;
            }

            .dq-start h2,
            .dq-question-card h2 {
                margin: 0;
                color: #78350F;
                font-size: clamp(1.2rem, 5vw, 1.7rem);
            }

            .dq-subtitle {
                margin: 4px 0 12px;
                color: #A16207;
                font-size: .82rem;
                font-weight: 900;
                letter-spacing: .04em;
                text-transform: uppercase;
            }

            .dq-intro,
            .dq-learning-note {
                color: #57534E;
                font-size: .78rem;
                line-height: 1.5;
            }

            .dq-learning-note {
                margin: 12px 0;
                padding: 10px 12px;
                border-radius: 12px;
                background: rgba(254,243,199,.78);
            }

            .dq-declaration-details {
                margin: 12px 0;
                text-align: left;
            }

            .dq-declaration-details summary {
                color: #92400E;
                font-size: .76rem;
                font-weight: 800;
                cursor: pointer;
            }

            .dq-declaration-details pre {
                max-height: 210px;
                margin: 8px 0 0;
                padding: 12px;
                overflow: auto;
                border-radius: 12px;
                background: rgba(255,255,255,.78);
                color: #57534E;
                font: 600 .68rem/1.5 system-ui, sans-serif;
                white-space: pre-wrap;
            }

            .dq-start-actions,
            .dq-feedback-actions {
                display: flex;
                gap: 9px;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 14px;
            }

            .dq-start-actions .btn,
            .dq-feedback-actions .btn {
                min-height: 48px;
                min-width: 150px;
            }

            .dq-hud {
                display: grid;
                grid-template-columns: minmax(0,1.4fr) repeat(3,minmax(62px,.7fr));
                gap: 7px;
                margin-bottom: 10px;
            }

            .dq-hud-stage,
            .dq-hud-stat {
                min-width: 0;
                padding: 8px 9px;
                border: 1px solid rgba(180,83,9,.15);
                border-radius: 12px;
                background: rgba(255,255,255,.86);
            }

            .dq-hud span {
                display: block;
                color: #78716C;
                font-size: .54rem;
                font-weight: 900;
                letter-spacing: .06em;
                text-transform: uppercase;
            }

            .dq-hud strong {
                display: block;
                margin-top: 2px;
                overflow: hidden;
                color: #78350F;
                font-size: .78rem;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .dq-progress-track {
                height: 8px;
                margin-bottom: 12px;
                overflow: hidden;
                border-radius: 999px;
                background: #FDE68A;
            }

            .dq-progress-fill {
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #D97706, #F59E0B);
                transition: width 220ms ease;
            }

            .dq-stage-banner {
                margin-bottom: 12px;
                padding: 10px 12px;
                border-radius: 13px;
                background: linear-gradient(135deg, #78350F, #A16207);
                color: #FFFDF7;
                text-align: center;
            }

            .dq-stage-banner span {
                display: block;
                font-size: .60rem;
                font-weight: 900;
                letter-spacing: .11em;
            }

            .dq-stage-banner strong {
                display: block;
                margin-top: 3px;
                font-size: .88rem;
            }

            .dq-prompt-label {
                margin: 0 0 5px;
                color: #A16207;
                font-size: .62rem;
                font-weight: 900;
                letter-spacing: .08em;
                text-align: center;
                text-transform: uppercase;
            }

            .dq-prompt {
                min-height: 2.8em;
                margin: 0 0 14px;
                color: #3F2D20;
                font-size: clamp(1.05rem, 4.6vw, 1.45rem);
                line-height: 1.35;
                text-align: center;
            }

            .dq-choices {
                display: grid;
                grid-template-columns: repeat(2, minmax(0,1fr));
                gap: 9px;
            }

            .dq-choice {
                min-height: 58px;
                padding: 11px 12px;
                border: 2px solid rgba(180,83,9,.24);
                border-radius: 14px;
                background: #FFFFFF;
                color: #573415;
                font: 800 .82rem/1.3 system-ui, sans-serif;
                cursor: pointer;
                touch-action: manipulation;
                transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
            }

            .dq-choice:hover,
            .dq-choice:focus-visible {
                border-color: #D97706;
                outline: none;
                transform: translateY(-1px);
            }

            .dq-choice.is-wrong {
                border-color: #FCA5A5;
                background: #FEF2F2;
                color: #991B1B;
            }

            .dq-choice:disabled {
                cursor: default;
                opacity: .72;
                transform: none;
            }

            .dq-feedback {
                margin-top: 12px;
                padding: 12px;
                border-radius: 14px;
                background: #ECFDF5;
                color: #14532D;
                text-align: center;
            }

            .dq-feedback h3 {
                margin: 0 0 5px;
                font-size: .88rem;
            }

            .dq-complete-line {
                margin: 0;
                font-size: .9rem;
                font-weight: 900;
                line-height: 1.4;
            }

            .dq-reference {
                margin: 6px 0 0;
                color: #166534;
                font-size: .72rem;
                font-weight: 800;
            }

            .dq-gentle-hint {
                min-height: 1.35em;
                margin: 9px 0 0;
                color: #9A3412;
                font-size: .72rem;
                font-weight: 700;
                text-align: center;
            }

            .dq-footer-note {
                margin: 10px 0 0;
                color: #78716C;
                font-size: .66rem;
                line-height: 1.4;
                text-align: center;
            }

            @media (max-width: 560px) {
                .dq-card {
                    padding: 12px;
                    border-radius: 16px;
                }

                .dq-hud {
                    grid-template-columns: repeat(3, minmax(0,1fr));
                }

                .dq-hud-stage {
                    grid-column: 1 / -1;
                }

                .dq-hud-stage strong {
                    white-space: normal;
                }

                .dq-choices {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }

                .dq-choice {
                    min-height: 52px;
                }

                .dq-start-actions,
                .dq-feedback-actions {
                    display: grid;
                    grid-template-columns: 1fr;
                }

                .dq-start-actions .btn,
                .dq-feedback-actions .btn {
                    width: 100%;
                    min-width: 0;
                }
            }
        `;

        document.head.appendChild(style);
    },

    mountGameUI: function() {
        this.cleanup();
        this.ensureStyles();

        const area = document.getElementById('growthActiveGameArea');
        if (!area) return;

        this.area = area;

        const grid = document.getElementById('growthGamesGrid');
        const featured = document.getElementById('featuredGrowthGameContainer');
        const filter = document.getElementById('btnGrowthIndiv');

        if (grid) grid.style.display = 'none';
        if (featured) featured.style.display = 'none';
        if (filter && filter.parentElement) filter.parentElement.style.display = 'none';

        area.hidden = false;
        area.style.display = 'block';
        area.innerHTML = `
            <div class="dq-shell" data-declaration-quest-root>
                <section class="dq-card dq-start">
                    <div class="dq-icon" aria-hidden="true">📜</div>
                    <h2>Declaration Quest</h2>
                    <p class="dq-subtitle">I Am a Child of God</p>
                    <p class="dq-intro">
                        Complete each declaration line through five stages.
                        Scripture references appear only after you answer.
                    </p>
                    <p class="dq-learning-note">
                        Game Score measures gameplay only. Mastery measures
                        first-attempt recall in this game, not faith,
                        holiness, spiritual worth, or closeness to God.
                    </p>
                    <details class="dq-declaration-details">
                        <summary>Read the Portal declaration</summary>
                        <pre>${this.escapeText(this.CANONICAL_DECLARATION)}</pre>
                    </details>
                    <div class="dq-start-actions">
                        <button class="btn btn-primary" type="button" data-action="start">
                            ▶ BEGIN QUEST
                        </button>
                        <button class="btn btn-outline" type="button" data-action="exit">
                            Back to Games
                        </button>
                    </div>
                </section>
            </div>
        `;

        this.root = area.querySelector('[data-declaration-quest-root]');
        this.bindEvents();
        this.monitorImmersiveHost();
    },

    bindEvents: function() {
        this.cleanupEvents();
        if (!this.root) return;

        const clickHandler = event => {
            const action = event.target.closest('[data-action]');
            if (action && this.root && this.root.contains(action)) {
                if (action.dataset.action === 'start') this.startGame();
                if (action.dataset.action === 'next') this.nextChallenge();
                if (action.dataset.action === 'exit') this.exitGame();
                return;
            }

            const choice = event.target.closest('[data-choice-index]');
            if (
                choice
                && this.root
                && this.root.contains(choice)
                && !choice.disabled
            ) {
                this.selectChoice(Number(choice.dataset.choiceIndex));
            }
        };

        const keyHandler = event => {
            if (!this.root || !this.root.isConnected || !this.state) return;

            if (/^[1-4]$/.test(event.key) && !this.state.locked) {
                const button = this.root.querySelector(
                    `[data-choice-index="${Number(event.key) - 1}"]`
                );

                if (button && !button.disabled) {
                    event.preventDefault();
                    button.click();
                }
            }
        };

        this.root.addEventListener('click', clickHandler);
        window.addEventListener('keydown', keyHandler);

        this.boundHandlers.push(
            { target: this.root, type: 'click', handler: clickHandler },
            { target: window, type: 'keydown', handler: keyHandler }
        );
    },

    cleanupEvents: function() {
        if (Array.isArray(this.boundHandlers)) {
            this.boundHandlers.forEach(binding => {
                try {
                    binding.target.removeEventListener(
                        binding.type,
                        binding.handler,
                        binding.options
                    );
                } catch (error) {
                    // Cleanup must never block exit or replay.
                }
            });
        }

        this.boundHandlers = [];
    },

    monitorImmersiveHost: function() {
        if (this.monitorFrameId) cancelAnimationFrame(this.monitorFrameId);

        const monitor = () => {
            if (!this.root || !this.root.isConnected) {
                this.cleanup();
                return;
            }

            this.monitorFrameId = requestAnimationFrame(monitor);
        };

        this.monitorFrameId = requestAnimationFrame(monitor);
    },

    startGame: function() {
        if (!this.root || !this.root.isConnected) {
            this.mountGameUI();
        }

        if (!this.root) return;

        this.state = {
            challengeIndex: 0,
            score: 0,
            streak: 0,
            firstAttemptCorrect: 0,
            totalAttempts: 0,
            attemptsForCurrent: 0,
            challengeStartedAt: performance.now(),
            locked: false
        };

        this.renderChallenge();
    },

    renderChallenge: function() {
        if (!this.root || !this.state) return;

        const challenge = this.CHALLENGES[this.state.challengeIndex];
        if (!challenge) {
            this.finishGame();
            return;
        }

        const stage = this.STAGES[challenge.stage];
        const progress = Math.round(
            (this.state.challengeIndex / this.CHALLENGES.length) * 100
        );

        this.state.attemptsForCurrent = 0;
        this.state.challengeStartedAt = performance.now();
        this.state.locked = false;

        this.root.innerHTML = `
            <section class="dq-card dq-question-card" aria-labelledby="dqPrompt">
                <div class="dq-hud" aria-label="Declaration Quest progress">
                    <div class="dq-hud-stage">
                        <span>Stage ${challenge.stage + 1} / ${this.STAGES.length}</span>
                        <strong>${this.escapeText(stage.title)}</strong>
                    </div>
                    <div class="dq-hud-stat">
                        <span>Progress</span>
                        <strong>${this.state.challengeIndex + 1} / ${this.CHALLENGES.length}</strong>
                    </div>
                    <div class="dq-hud-stat">
                        <span>Score</span>
                        <strong data-dq-score>${this.state.score}</strong>
                    </div>
                    <div class="dq-hud-stat">
                        <span>Streak</span>
                        <strong data-dq-streak>${this.state.streak}</strong>
                    </div>
                </div>

                <div class="dq-progress-track" aria-hidden="true">
                    <div class="dq-progress-fill" style="width:${progress}%"></div>
                </div>

                <div class="dq-stage-banner">
                    <span>${this.escapeText(stage.title)}</span>
                    <strong>${this.escapeText(stage.refrain)}</strong>
                </div>

                <p class="dq-prompt-label">Choose the declaration completion</p>
                <h2 class="dq-prompt" id="dqPrompt">${this.escapeText(challenge.prompt)}</h2>

                <div class="dq-choices" role="group" aria-labelledby="dqPrompt">
                    ${challenge.choices.map((choice, index) => `
                        <button
                            class="dq-choice"
                            type="button"
                            data-choice-index="${index}"
                            aria-label="Choice ${index + 1}: ${this.escapeText(choice)}"
                        >
                            ${this.escapeText(choice)}
                        </button>
                    `).join('')}
                </div>

                <p class="dq-gentle-hint" data-dq-hint aria-live="polite"></p>
                <p class="dq-footer-note">
                    Tap a phrase tile or use number keys 1–4.
                    Scripture context appears after the answer.
                </p>
            </section>
        `;
    },

    selectChoice: function(choiceIndex) {
        if (!this.state || this.state.locked) return;

        const challenge = this.CHALLENGES[this.state.challengeIndex];
        const selected = challenge && challenge.choices[choiceIndex];
        if (!challenge || selected === undefined) return;

        this.state.attemptsForCurrent += 1;
        this.state.totalAttempts += 1;

        if (selected !== challenge.answer) {
            this.state.streak = 0;

            const button = this.root.querySelector(
                `[data-choice-index="${choiceIndex}"]`
            );

            if (button) {
                button.disabled = true;
                button.classList.add('is-wrong');
                button.setAttribute('aria-label', `${button.textContent.trim()}, try another`);
            }

            const hint = this.root.querySelector('[data-dq-hint]');
            if (hint) {
                hint.textContent = 'Keep going — choose another phrase. Every line can be completed.';
            }

            this.updateHud();
            return;
        }

        this.state.locked = true;

        const firstAttempt = this.state.attemptsForCurrent === 1;
        if (firstAttempt) {
            this.state.firstAttemptCorrect += 1;
            this.state.streak += 1;
        } else {
            this.state.streak = 0;
        }

        const elapsedSeconds = Math.max(
            0,
            (performance.now() - this.state.challengeStartedAt) / 1000
        );

        const baseScore = firstAttempt
            ? 650
            : this.state.attemptsForCurrent === 2
                ? 420
                : 260;

        const speedBonus = Math.max(
            0,
            240 - Math.floor(elapsedSeconds * 15)
        );

        const streakBonus = firstAttempt
            ? this.state.streak * 75
            : 0;

        const nextChallenge = this.CHALLENGES[this.state.challengeIndex + 1];
        const sectionCompletionBonus =
            !nextChallenge || nextChallenge.stage !== challenge.stage
                ? 350
                : 0;

        const finaleCompletionBonus =
            this.state.challengeIndex === this.CHALLENGES.length - 1
                ? 800
                : 0;

        this.state.score +=
            baseScore
            + speedBonus
            + streakBonus
            + sectionCompletionBonus
            + finaleCompletionBonus;

        this.showCorrectFeedback(
            challenge,
            {
                baseScore,
                speedBonus,
                streakBonus,
                sectionCompletionBonus,
                finaleCompletionBonus
            }
        );
    },

    showCorrectFeedback: function(challenge, points) {
        if (!this.root || !this.state) return;

        const earned = Object.values(points).reduce(
            (total, value) => total + value,
            0
        );

        const reference = challenge.reference
            ? `<p class="dq-reference">Scripture context: ${this.escapeText(challenge.reference)}</p>`
            : '';

        const choiceArea = this.root.querySelector('.dq-choices');
        if (choiceArea) {
            choiceArea.querySelectorAll('button').forEach(button => {
                button.disabled = true;
            });

            choiceArea.insertAdjacentHTML(
                'afterend',
                `
                    <div class="dq-feedback" role="status" aria-live="polite">
                        <h3>✓ Declaration completed · +${earned}</h3>
                        <p class="dq-complete-line">${this.formatLines(challenge.statement)}</p>
                        ${reference}
                        <div class="dq-feedback-actions">
                            <button class="btn btn-primary" type="button" data-action="next">
                                ${this.state.challengeIndex === this.CHALLENGES.length - 1 ? 'See Results' : 'Continue →'}
                            </button>
                        </div>
                    </div>
                `
            );
        }

        const hint = this.root.querySelector('[data-dq-hint]');
        if (hint) hint.remove();
        this.updateHud();

        const nextButton = this.root.querySelector('[data-action="next"]');
        if (nextButton) nextButton.focus();
    },

    updateHud: function() {
        if (!this.root || !this.state) return;

        const score = this.root.querySelector('[data-dq-score]');
        const streak = this.root.querySelector('[data-dq-streak]');
        if (score) score.textContent = String(this.state.score);
        if (streak) streak.textContent = String(this.state.streak);
    },

    nextChallenge: function() {
        if (!this.state || !this.state.locked) return;

        this.state.challengeIndex += 1;
        if (this.state.challengeIndex >= this.CHALLENGES.length) {
            this.finishGame();
            return;
        }

        this.renderChallenge();
    },

    finishGame: async function() {
        if (!this.state || !this.area) return;

        const finalScore = Math.max(0, Math.floor(this.state.score));
        const accuracy = Math.round(
            (this.CHALLENGES.length / Math.max(1, this.state.totalAttempts)) * 100
        );
        const mastery = Math.round(
            (this.state.firstAttemptCorrect / this.CHALLENGES.length) * 100
        );

        this.cleanupEvents();
        if (this.monitorFrameId) {
            cancelAnimationFrame(this.monitorFrameId);
            this.monitorFrameId = null;
        }

        this.area.innerHTML = `
            <div class="game-result-card" role="status">
                <p>Saving Declaration Quest score…</p>
            </div>
        `;

        this.root = null;

        if (
            window.V10Expansion
            && typeof window.V10Expansion.submitUniversalScore === 'function'
        ) {
            await window.V10Expansion.submitUniversalScore(
                this.GAME_NAME,
                this.GAME_TYPE,
                finalScore,
                accuracy,
                {
                    mastery,
                    recognition: this.MASTERY_RECOGNITION
                }
            );
        }
    },

    cleanup: function() {
        if (this.monitorFrameId) {
            cancelAnimationFrame(this.monitorFrameId);
            this.monitorFrameId = null;
        }

        this.cleanupEvents();
        this.state = null;
        this.root = null;
    },

    exitGame: function() {
        this.cleanup();

        if (
            window.V10Expansion
            && typeof window.V10Expansion.exitGame === 'function'
        ) {
            window.V10Expansion.exitGame();
        }
    }
};
