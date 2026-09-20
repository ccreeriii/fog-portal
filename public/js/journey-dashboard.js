(function(root, factory) {
    'use strict';

    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (root && root.document) {
        root.JourneyFirstDashboard = api;
        api.install(root, root.document);
    }
})(typeof window !== 'undefined' ? window : null, function() {
    'use strict';

    const PHASES = Object.freeze([
        { key: 'encounter', title: 'Encounter' },
        { key: 'belong', title: 'Belong' },
        { key: 'commit', title: 'Commit' },
        { key: 'discern', title: 'Discern' },
        { key: 'form', title: 'Form' },
        { key: 'serve', title: 'Serve' },
        { key: 'be_sent', title: 'Be Sent' }
    ]);
    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(Number(value) || 0, minimum), maximum);
    }

    function manilaDateKey(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        return `${values.year}-${values.month}-${values.day}`;
    }

    function buildPrayerModel(payload = {}, hasPrayerPartner = false) {
        const onboarding = payload.onboarding || null;
        const enrollment = onboarding && onboarding.enrollment;
        const rhythm = payload.prayerRhythm || {};
        const duration = Math.max(Number(onboarding && onboarding.durationDays) || 21, 1);
        const completedDays = clamp(enrollment && enrollment.completedDays, 0, duration);
        const completedToday = rhythm.completedToday === true;
        const activeChallenge = Boolean(enrollment && enrollment.status === 'active');
        const completedChallenge = Boolean(enrollment && enrollment.status === 'completed');

        let state = 'rhythm';
        let eyebrow = 'Prayer Covenant';
        let status = completedToday ? 'Prayer offered today' : null;
        let title = 'Your Prayer Habit';
        let description = completedToday
            ? 'You prayed today. Keep making prayer part of your everyday walk with God and our community.'
            : 'Take a moment to pray today and continue building a steady rhythm with God and your community.';
        let challengeProgress = null;

        if (activeChallenge) {
            state = 'active_challenge';
            eyebrow = '21-Day Prayer Covenant';
            const displayedDay = completedToday
                ? Math.max(completedDays, 1)
                : Math.min(completedDays + 1, duration);
            title = `Day ${displayedDay} of ${duration}`;
            status = completedToday ? 'Prayer offered today' : 'Keep going';
            description = 'Keep showing up in prayer each day. If you miss a day, simply continue—every prayer matters.';
            challengeProgress = {
                completedDays,
                duration,
                percent: Math.round((completedDays / duration) * 100)
            };
        } else if (completedChallenge) {
            state = 'completed_challenge';
            status = completedToday ? 'Prayer offered today' : 'Journey completed';
            title = `${duration}-Day Prayer Covenant Completed`;
            description = `You completed the ${duration}-day journey. Keep making prayer part of your everyday walk with God.`;
        } else if (completedToday) {
            state = 'rhythm_complete_today';
            status = 'Prayer offered today';
        }

        if (completedToday && activeChallenge === false && completedChallenge === false) {
            state = 'rhythm_complete_today';
        }

        let action = 'Pray Today';
        let actionDisabled = false;
        if (completedToday) {
            action = 'Prayer offered today';
            actionDisabled = true;
        } else if (!hasPrayerPartner) {
            action = 'Prayer Partner pending';
            actionDisabled = true;
        } else if (activeChallenge) {
            action = 'Continue Prayer';
        }

        const qualifyingDays = Math.max(Number(rhythm.qualifyingDays) || 0, 0);
        const targetDays = Math.max(Number(rhythm.targetDays) || 7, 1);
        const windowDays = Math.max(Number(rhythm.windowDays) || 14, 1);

        return {
            state,
            eyebrow,
            status,
            title,
            description,
            action,
            actionDisabled,
            completedToday,
            challengeProgress,
            showRhythm: !activeChallenge,
            joinAvailable: Boolean(
                onboarding &&
                onboarding.templateCode === 'prayer-covenant-21' &&
                !enrollment &&
                onboarding.paused !== true
            ),
            rhythm: {
                available: rhythm.available === true,
                qualifyingDays,
                targetDays,
                windowDays,
                percent: clamp(rhythm.consistencyPercent, 0, 100)
            }
        };
    }

    function buildJourneyModel(journey = {}) {
        const received = Array.isArray(journey.phases) ? journey.phases : [];
        const byKey = new Map(received.map(phase => [phase.phaseKey, phase]));
        const current = journey.currentPhase || null;
        const currentKey = current && current.status !== 'completed'
            ? current.phaseKey
            : null;
        const phases = PHASES.map((definition, index) => {
            const phase = byKey.get(definition.key) || {};
            const sequenceState = definition.key === currentKey
                ? 'current'
                : phase.sequenceState === 'completed'
                    ? 'completed'
                    : 'upcoming';
            return {
                order: index + 1,
                key: definition.key,
                title: phase.title || definition.title,
                sequenceState,
                rawStatus: phase.status || 'not_started'
            };
        });
        const progressPercent = clamp(current && current.progressPercent, 0, 100);

        return {
            phases,
            current: current
                ? {
                    key: current.phaseKey,
                    title: current.title || 'Your Growth Journey',
                    progressPercent,
                    essentialCompleted: Math.max(Number(current.essentialCompleted) || 0, 0),
                    essentialTotal: Math.max(Number(current.essentialTotal) || 0, 0),
                    status: current.status || 'not_started'
                }
                : null,
            nextPhase: journey.nextPhase || null,
            invitation: journey.nextInvitation || null
        };
    }

    function selectUpcomingEvents(events, asOf = new Date()) {
        const today = manilaDateKey(asOf);
        if (!today || !Array.isArray(events)) return [];

        return events
            .filter(event => {
                const key = typeof event.event_date === 'string'
                    ? event.event_date.slice(0, 10)
                    : '';
                return /^\d{4}-\d{2}-\d{2}$/.test(key) && key >= today;
            })
            .sort((left, right) => {
                const leftKey = `${left.event_date || ''} ${left.time_start || ''}`;
                const rightKey = `${right.event_date || ''} ${right.time_start || ''}`;
                return leftKey.localeCompare(rightKey);
            })
            .slice(0, 3)
            .map(event => ({
                id: Number(event.id),
                name: typeof event.name === 'string' ? event.name : 'Community gathering',
                eventDate: event.event_date.slice(0, 10),
                timeStart: typeof event.time_start === 'string' ? event.time_start : '',
                venue: typeof event.venue === 'string' ? event.venue : ''
            }));
    }

    function element(document, tagName, className, text) {
        const node = document.createElement(tagName);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function clear(node) {
        while (node && node.firstChild) node.removeChild(node.firstChild);
    }

    function appendCardHeading(document, container, eyebrow, title, titleId, copy) {
        const head = element(document, 'div', 'journey-card__head');
        const titleBlock = element(document, 'div');
        titleBlock.appendChild(element(document, 'p', 'journey-card__eyebrow', eyebrow));
        const heading = element(document, 'h3', '', title);
        heading.id = titleId;
        titleBlock.appendChild(heading);
        if (copy) titleBlock.appendChild(element(document, 'p', 'journey-card__copy', copy));
        head.appendChild(titleBlock);
        container.appendChild(head);
        return head;
    }

    function formatEventDate(dateKey) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
        if (!match) return { month: '', day: '' };
        return {
            month: months[Number(match[2]) - 1] || '',
            day: String(Number(match[3]))
        };
    }

    function navigateTo(window, destination) {
        if (destination === 'events' && typeof window.hubNavTo === 'function') {
            window.hubNavTo('events');
            return;
        }
        if (destination === 'groups' && typeof window.hubNavTo === 'function') {
            window.hubNavTo('groups');
            return;
        }
        if (destination === 'arcade') {
            window.location.href = '/?faith=quest';
            return;
        }
        const target = destination === 'inbox' ? 'inboxTab' : 'discipleshipTab';
        if (typeof window.switchTab === 'function') window.switchTab(target);
    }

    const PRAYER_STARTERS = Object.freeze([
        Object.freeze({
            icon: '🕊️',
            title: 'Peace & Strength',
            text: 'Lord, I lift up my prayer pal to You today. Please grant them deep peace, physical strength, and joy in whatever they are facing. Amen.'
        }),
        Object.freeze({
            icon: '❤️',
            title: 'Blessing & Love',
            text: 'Father, thank You for my prayer pal. I ask that You bless their day, protect their mind, and let them feel Your overwhelming love for them. Amen.'
        }),
        Object.freeze({
            icon: '✨',
            title: 'Breakthrough',
            text: 'God, I pray for a breakthrough and clear guidance for my prayer pal today. Lead their steps and supply all their needs according to Your riches. Amen.'
        }),
        Object.freeze({
            icon: '🌿',
            title: 'Healing & Comfort',
            text: 'Lord, I pray for absolute healing and comfort over my prayer pal. Restore their body, mind, and spirit completely. Amen.'
        }),
        Object.freeze({
            icon: '💡',
            title: 'Guidance & Wisdom',
            text: 'Holy Spirit, grant my prayer pal profound wisdom and clarity in all their decisions this week. Light their path. Amen.'
        }),
        Object.freeze({
            icon: '🙏',
            title: 'Protection',
            text: 'Heavenly Father, please place a hedge of protection around my prayer pal and their family. Guard them from harm and give them safe travels. Amen.'
        }),
        Object.freeze({
            icon: '😌',
            title: 'Anxiety & Worry',
            text: 'Lord, I ask You to quiet any anxious thoughts in my prayer pal’s mind. Replace their worries with Your perfect peace that surpasses all understanding. Amen.'
        }),
        Object.freeze({
            icon: '💼',
            title: 'Work & Provision',
            text: 'God, I lift up my prayer pal’s career, studies, and finances to You. Open doors of opportunity and bless the work of their hands. Amen.'
        }),
        Object.freeze({
            icon: '🤝',
            title: 'Relationships',
            text: 'Father, bless the friendships and family ties of my prayer pal. Bring reconciliation where needed and surround them with supportive people. Amen.'
        }),
        Object.freeze({
            icon: '🔥',
            title: 'Spiritual Fire',
            text: 'Holy Spirit, ignite a fresh passion and hunger for Your Word in my prayer pal’s heart. Draw them closer to You today than ever before. Amen.'
        })
    ]);

    function applyDailyPrayerActionState(
        model,
        dailyPal,
        prayedToday
    ) {
        if (
            !model ||
            typeof model !== 'object'
        ) {
            return model;
        }

        if (prayedToday === true) {
            model.action =
                'Prayer offered today';

            model.actionDisabled =
                true;

            return model;
        }

        if (dailyPal) {
            model.actionDisabled =
                false;

            if (model.completedToday) {
                model.action =
                    'Pray for Today’s Prayer Pal';
            }
        }

        return model;
    }

    function renderPrayer(document, window, payload, partner, growthMoment) {
        const card = document.getElementById('journeyPrayerCard');
        if (!card) return;
        clear(card);

        const dailyPal =
            partner &&
            partner.available === true &&
            partner.prayerPal &&
            Number.isInteger(
                Number(
                    partner.prayerPal.youthId
                )
            )
                ? partner.prayerPal
                : null;

        const model =
            buildPrayerModel(
                payload,
                Boolean(
                    dailyPal
                )
            );

        applyDailyPrayerActionState(
            model,
            dailyPal,
            Boolean(
                partner &&
                partner.prayedToday === true
            )
        );
        if (growthMoment) {
            card.appendChild(element(document, 'div', 'journey-growth-moment', growthMoment));
        }

        const head = appendCardHeading(
            document,
            card,
            model.eyebrow,
            model.title,
            'journeyPrayerTitle',
            null
        );
        if (model.status) {
            head.appendChild(element(document, 'span', 'journey-status-pill', model.status));
        }
        card.appendChild(element(document, 'p', 'journey-card__copy', model.description));

        if (model.challengeProgress) {
            const progress = element(document, 'div', 'journey-progress');
            const track = element(document, 'div', 'journey-progress__track');
            track.setAttribute('role', 'progressbar');
            track.setAttribute('aria-label', '21-Day Prayer Covenant progress');
            track.setAttribute('aria-valuemin', '0');
            track.setAttribute('aria-valuemax', String(model.challengeProgress.duration));
            track.setAttribute('aria-valuenow', String(model.challengeProgress.completedDays));
            const fill = element(document, 'div', 'journey-progress__fill');
            fill.style.width = `${model.challengeProgress.percent}%`;
            track.appendChild(fill);
            progress.appendChild(track);
            const caption = element(document, 'div', 'journey-progress__caption');
            caption.appendChild(element(document, 'span', '', `${model.challengeProgress.completedDays} prayer days completed`));
            caption.appendChild(element(document, 'span', '', `${model.challengeProgress.duration}-day journey`));
            progress.appendChild(caption);
            card.appendChild(progress);
        }

        if (model.showRhythm) {
            const rhythm = element(document, 'div', 'journey-rhythm');
            rhythm.appendChild(element(
                document,
                'span',
                'journey-rhythm__label',
                'Your rhythm grows as you keep returning to prayer.'
            ));
            rhythm.appendChild(element(
                document,
                'span',
                'journey-rhythm__value',
                model.rhythm.available
                    ? `${model.rhythm.qualifyingDays} of ${model.rhythm.targetDays} prayer days`
                    : 'Prayer is always here for you'
            ));
            card.appendChild(rhythm);
        }

        const action = element(document, 'button', 'journey-action', model.action);
        action.type = 'button';
        action.disabled = model.actionDisabled;
        if (
            !model.actionDisabled &&
            dailyPal
        ) {
            action.addEventListener('click', () => {
                if (
                    typeof window.openDailyPrayerCovenant ===
                        'function'
                ) {
                    window.openDailyPrayerCovenant(
                        dailyPal.name ||
                            'your Prayer Pal',
                        Number(
                            dailyPal.youthId
                        )
                    );
                }
            });
        }
        card.appendChild(action);

        if (model.joinAvailable) {
            const joinAction = element(
                document,
                'button',
                'journey-action journey-action--secondary',
                'Join the 21-Day Prayer Covenant Challenge'
            );
            joinAction.id = 'journeyPrayerJoinAction';
            joinAction.type = 'button';
            joinAction.addEventListener('click', () => {
                if (typeof window.joinPrayerCovenantChallenge === 'function') {
                    window.joinPrayerCovenantChallenge();
                }
            });
            card.appendChild(joinAction);
        }
    }

    function invitationDestination(invitation) {
        if (!invitation) return 'growth';
        if (invitation.taskKey === 'belong-membership-intent') return 'membership';
        if (/event|come-and-see/.test(invitation.taskKey || '')) return 'events';
        return 'growth';
    }

    function renderGrowth(document, window, payload) {
        const card = document.getElementById('journeyGrowthCard');
        if (!card) return;
        clear(card);
        const model = buildJourneyModel(payload.journey || {});
        appendCardHeading(
            document,
            card,
            'Your Growth Journey',
            model.current ? `Your Journey Now: ${model.current.title}` : 'Walking together',
            'journeyGrowthTitle',
            model.current
                ? ({
                    encounter: 'This is where your journey begins. Take your next step in faith, friendship, and community.',
                    belong: 'Grow roots in friendship, prayer, and life with your spiritual family.',
                    commit: 'Take a faithful step toward calling this community your spiritual home.',
                    discern: 'Discover the gifts God has placed in you and where they may serve others.',
                    form: 'Grow in character, wisdom, and readiness alongside people who will walk with you.',
                    serve: 'Put your gifts into practice with love, humility, and the support of your community.',
                    be_sent: 'Go forward with courage, carrying God’s love wherever you are sent.'
                }[model.current.key] || 'Take your next step in faith, friendship, and community.')
                : 'Your Growth Journey will appear here as you begin.'
        );

        const phaseList = element(document, 'div', 'journey-phases');
        phaseList.setAttribute('aria-label', 'Seven Growth Journey phases');
        model.phases.forEach(phase => {
            const item = element(document, 'div', 'journey-phase');
            item.dataset.state = phase.sequenceState;
            item.setAttribute('aria-label', `${phase.title}: ${phase.sequenceState}`);
            item.appendChild(element(
                document,
                'span',
                'journey-phase__dot',
                phase.sequenceState === 'completed' ? '✓' : phase.order
            ));
            item.appendChild(element(document, 'span', 'journey-phase__name', phase.title));
            phaseList.appendChild(item);
        });
        card.appendChild(phaseList);

        if (model.invitation) {
            const invitation = element(document, 'div', 'journey-invitation');
            invitation.appendChild(element(document, 'span', 'journey-invitation__eyebrow', 'Your next step'));
            invitation.appendChild(element(document, 'strong', '', model.invitation.title));
            invitation.appendChild(element(document, 'span', '', model.invitation.description));
            card.appendChild(invitation);

            const destination = invitationDestination(model.invitation);
            const button = element(
                document,
                'button',
                'journey-action journey-action--primary',
                destination === 'events' ? 'See upcoming events' :
                    destination === 'membership' ? 'Continue this step' : 'Open Growth Journey'
            );
            button.type = 'button';
            button.addEventListener('click', () => {
                if (destination === 'membership' && typeof window.openCommitmentModal === 'function') {
                    window.openCommitmentModal();
                } else {
                    navigateTo(window, destination);
                }
            });
            card.appendChild(button);
        }
    }

    function renderEvents(document, window, payload) {
        const card = document.getElementById('journeyEventsCard');
        if (!card) return;
        clear(card);
        appendCardHeading(
            document,
            card,
            'Coming Up',
            'Gather with the community',
            'journeyEventsTitle',
            'Your next invitation may begin with simply showing up.'
        );
        const events = selectUpcomingEvents(payload.upcomingEvents || []);
        if (events.length === 0) {
            card.appendChild(element(
                document,
                'div',
                'journey-empty',
                'No upcoming gatherings are listed yet. Check Events again soon.'
            ));
            return;
        }

        const list = element(document, 'div', 'journey-events__list');
        events.forEach(event => {
            const button = element(document, 'button', 'journey-event');
            button.type = 'button';
            button.addEventListener('click', () => navigateTo(window, 'events'));
            const date = formatEventDate(event.eventDate);
            const dateBlock = element(document, 'span', 'journey-event__date');
            dateBlock.appendChild(element(document, 'span', '', date.month));
            dateBlock.appendChild(element(document, 'span', '', date.day));
            button.appendChild(dateBlock);
            const detail = element(document, 'span');
            detail.appendChild(element(document, 'span', 'journey-event__name', event.name));
            const metadata = [event.timeStart, event.venue].filter(Boolean).join(' · ');
            detail.appendChild(element(document, 'span', 'journey-event__meta', metadata || 'Details in Events'));
            button.appendChild(detail);
            button.appendChild(element(document, 'span', 'journey-event__arrow', '›'));
            list.appendChild(button);
        });
        card.appendChild(list);
    }

    function renderConnected(document, window) {
        const card = document.getElementById('journeyConnectedCard');
        if (!card) return;
        clear(card);
        appendCardHeading(
            document,
            card,
            'For You',
            'Stay connected',
            'journeyConnectedTitle',
            'A few simple ways to remain close to your spiritual family.'
        );
        const shortcuts = element(document, 'div', 'journey-shortcuts');
        [
            { icon: '🔔', label: 'Inbox', destination: 'inbox' },
            { icon: '🔥', label: 'Campfire', destination: 'groups' },
            { icon: '🎯', label: 'Faith Quest', destination: 'arcade' }
        ].forEach(item => {
            const button = element(document, 'button', 'journey-shortcut');
            button.type = 'button';
            button.appendChild(element(document, 'span', '', item.icon));
            button.appendChild(document.createTextNode(item.label));
            button.addEventListener('click', () => navigateTo(window, item.destination));
            shortcuts.appendChild(button);
        });
        card.appendChild(shortcuts);
    }

    function renderError(document, message) {
        ['journeyPrayerCard', 'journeyGrowthCard', 'journeyEventsCard'].forEach(id => {
            const card = document.getElementById(id);
            if (!card) return;
            clear(card);
            card.appendChild(element(document, 'div', 'journey-error', message));
        });
    }

    function install(window, document) {
        if (window.__journeyFirstDashboardInstalled) return;
        window.__journeyFirstDashboardInstalled = true;

        const state = {
            loadPromise: null,
            lastLoadedAt: 0,
            growthMoment: null
        };

        function authenticatedMember() {
            const member = window.currentMember;
            return member && Number.isInteger(Number(member.id)) && Number(member.id) > 0
                ? member
                : null;
        }

        async function readOfflinePayload(member) {
            if (!window.KoinoniaOfflineData || !member) return null;
            const snapshot = await window.KoinoniaOfflineData
                .getDashboardSnapshot(`member:${Number(member.id)}`);
            return snapshot && snapshot.journeyFirstDashboard
                ? snapshot.journeyFirstDashboard
                : null;
        }

        const HOME_PORTRAIT_FALLBACK =
            '/img/logo.png';

        function safeHomePortraitSource(value) {
            if (typeof value !== 'string') {
                return HOME_PORTRAIT_FALLBACK;
            }

            const source = value.trim();

            if (!source) {
                return HOME_PORTRAIT_FALLBACK;
            }

            if (
                /^https?:\/\/[^\s]+$/i.test(source) ||
                /^\/(?!\/)[^\s]*$/.test(source) ||
                /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(source)
            ) {
                return source;
            }

            return HOME_PORTRAIT_FALLBACK;
        }

        function renderHomeIdentity(member) {
            const greeting =
                document.getElementById(
                    'journeyHomeGreeting'
                );

            const firstName =
                typeof member.name === 'string'
                    ? member.name
                        .trim()
                        .split(/\s+/)[0]
                    : '';

            if (greeting) {
                greeting.textContent =
                    firstName
                        ? `Welcome home, ${firstName}`
                        : 'Welcome home';
            }

            const portrait =
                document.getElementById(
                    'journeyHomePortrait'
                );

            const frame =
                document.getElementById(
                    'journeyHomePortraitFrame'
                );

            if (!portrait) return;

            const source =
                safeHomePortraitSource(
                    member.profile_picture
                );

            const fallback =
                source ===
                HOME_PORTRAIT_FALLBACK;

            if (frame) {
                frame.classList.toggle(
                    'journey-home__portrait--fallback',
                    fallback
                );
            }

            portrait.onerror = () => {
                portrait.onerror = null;
                portrait.src =
                    HOME_PORTRAIT_FALLBACK;
                portrait.alt =
                    'Fire Of God Ministries logo';

                if (frame) {
                    frame.classList.add(
                        'journey-home__portrait--fallback'
                    );
                }
            };

            portrait.src = source;

            portrait.alt =
                fallback
                    ? 'Fire Of God Ministries logo'
                    : firstName
                        ? `${firstName}'s profile picture`
                        : 'Member profile picture';
        }

        async function renderDashboard(options = {}) {
            const member = authenticatedMember();
            const dashboard = document.getElementById('journeyFirstDashboard');
            if (!member || !dashboard) return null;
            const force = options.force === true;
            if (state.loadPromise) return state.loadPromise;
            if (!force && Date.now() - state.lastLoadedAt < 5 * 60 * 1000) return null;

            state.loadPromise = (async () => {
                renderHomeIdentity(member);
                renderConnected(document, window);

                if (window.koinoniaAuthStatus === 'offline-readonly' || window.navigator.onLine === false) {
                    const cached = await readOfflinePayload(member);
                    if (!cached) {
                        renderError(document, 'Reconnect to refresh your Prayer Covenant and Growth Journey.');
                        state.lastLoadedAt = Date.now();
                        return null;
                    }
                    renderPrayer(document, window, cached, null, null);
                    renderGrowth(document, window, cached);
                    renderEvents(document, window, cached);
                    state.lastLoadedAt = Date.now();
                    return cached;
                }

                const [journeyResponse, partner] = await Promise.all([
                    window.fetch('/api/growth-journey/me', {
                        headers: { Accept: 'application/json' },
                        cache: 'no-store'
                    }),
                    window.fetch(
                        '/api/prayer-covenant/daily-pal',
                        { headers: { Accept: 'application/json' }, cache: 'no-store' }
                    ).then(response => response.ok ? response.json() : null)
                        .catch(() => null)
                ]);
                if (!journeyResponse.ok) throw new Error('dashboard_unavailable');
                const payload = await journeyResponse.json();
                if (!payload || payload.success !== true) throw new Error('dashboard_unavailable');

                renderPrayer(document, window, payload, partner, state.growthMoment);
                state.growthMoment = null;
                renderGrowth(document, window, payload);
                renderEvents(document, window, payload);
                state.lastLoadedAt = Date.now();

                if (window.KoinoniaOfflineData) {
                    window.KoinoniaOfflineData.saveDashboardSnapshot(
                        `member:${Number(member.id)}`,
                        { journeyFirstDashboard: payload }
                    ).catch(() => {});
                }
                return payload;
            })().catch(() => {
                renderError(document, 'Your Home could not be refreshed right now. Please try again shortly.');
                state.lastLoadedAt = Date.now();
                return null;
            }).finally(() => {
                state.loadPromise = null;
            });

            return state.loadPromise;
        }

        window.joinPrayerCovenantChallenge = async function() {
            const button = document.getElementById('journeyPrayerJoinAction');
            if (!authenticatedMember() || !button || button.disabled) return;
            button.disabled = true;
            button.textContent = 'Joining the challenge…';

            try {
                const response = await window.fetch(
                    '/api/growth-journey/prayer-covenant/join',
                    {
                        method: 'POST',
                        headers: { Accept: 'application/json' }
                    }
                );
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success !== true) {
                    throw new Error(result.error || 'The challenge could not be joined right now.');
                }
                state.lastLoadedAt = 0;
                await renderDashboard({ force: true });
            } catch (error) {
                button.disabled = false;
                button.textContent = 'Join the 21-Day Prayer Covenant Challenge';
                const message = element(
                    document,
                    'p',
                    'journey-action-status',
                    error.message || 'The challenge could not be joined right now.'
                );
                message.setAttribute('role', 'status');
                button.insertAdjacentElement('afterend', message);
            }
        };

        let dailyPrayerDraft =
            null;

        let dailyPrayerSending =
            false;

        function dailyPrayerElement(id) {
            return document.getElementById(
                id
            );
        }

        function setDailyPrayerStatus(
            id,
            message,
            isError = false
        ) {
            const status =
                dailyPrayerElement(
                    id
                );

            if (!status) return;

            status.textContent =
                message || '';

            status.style.color =
                isError
                    ? 'var(--danger)'
                    : '#806B5A';
        }

        function setDailyPrayerStage(
            stage
        ) {
            const compose =
                dailyPrayerElement(
                    'dailyCovenantComposeStep'
                );

            const review =
                dailyPrayerElement(
                    'dailyCovenantReviewStep'
                );

            if (!compose || !review) {
                return;
            }

            const reviewing =
                stage === 'review';

            compose.hidden =
                reviewing;

            review.hidden =
                !reviewing;

            if (reviewing) {
                const reviewText =
                    dailyPrayerElement(
                        'dailyCovenantReviewText'
                    );

                if (
                    reviewText &&
                    typeof reviewText.focus ===
                        'function'
                ) {
                    reviewText.focus();
                }
            } else {
                const textarea =
                    dailyPrayerElement(
                        'dailyCovenantPrayerText'
                    );

                if (
                    textarea &&
                    typeof textarea.focus ===
                        'function'
                ) {
                    textarea.focus();
                }
            }
        }

        function renderDailyPrayerStarters() {
            const list =
                dailyPrayerElement(
                    'dailyCovenantStarterList'
                );

            const textarea =
                dailyPrayerElement(
                    'dailyCovenantPrayerText'
                );

            if (
                !list ||
                !textarea
            ) {
                return;
            }

            while (
                list.firstChild
            ) {
                list.removeChild(
                    list.firstChild
                );
            }

            const prayers =
                PRAYER_STARTERS.slice();

            for (
                let index =
                    prayers.length - 1;
                index > 0;
                index -= 1
            ) {
                const swapIndex =
                    Math.floor(
                        Math.random() *
                            (index + 1)
                    );

                [
                    prayers[index],
                    prayers[swapIndex]
                ] = [
                    prayers[swapIndex],
                    prayers[index]
                ];
            }

            for (
                const prayer
                of prayers
            ) {
                const button =
                    document.createElement(
                        'button'
                    );

                button.type =
                    'button';

                button.className =
                    'btn';

                button.style.cssText =
                    'text-align:left;font-size:0.85rem;background:#FFF8EE;' +
                    'border:1px solid #E6D5C3;color:var(--text-main);' +
                    'padding:10px 12px;border-radius:10px;cursor:pointer;' +
                    'line-height:1.4;';

                button.textContent =
                    `${prayer.icon} Prayer for ${prayer.title}`;

                button.addEventListener(
                    'click',
                    () => {
                        textarea.value =
                            prayer.text;

                        setDailyPrayerStatus(
                            'dailyCovenantComposeStatus',
                            `${prayer.title} starter selected. You can personalize it before reviewing.`
                        );

                        textarea.focus();
                    }
                );

                list.appendChild(
                    button
                );
            }
        }

        window.closeDailyPrayerCovenant =
            function() {
                if (
                    dailyPrayerSending
                ) {
                    setDailyPrayerStatus(
                        'dailyCovenantReviewStatus',
                        'Your prayer is being sent. Please keep this window open for a moment.'
                    );

                    return;
                }

                const modal =
                    dailyPrayerElement(
                        'dailyCovenantPrayerModal'
                    );

                if (modal) {
                    modal.style.display =
                        'none';
                }

                dailyPrayerDraft =
                    null;

                setDailyPrayerStage(
                    'compose'
                );
            };

        window.openDailyPrayerCovenant =
            function(
                palName,
                palId
            ) {
                const receiverId =
                    Number(
                        palId
                    );

                if (
                    !Number.isInteger(
                        receiverId
                    ) ||
                    receiverId <= 0
                ) {
                    return;
                }

                const modal =
                    dailyPrayerElement(
                        'dailyCovenantPrayerModal'
                    );

                const name =
                    dailyPrayerElement(
                        'dailyCovenantPalName'
                    );

                const reviewName =
                    dailyPrayerElement(
                        'dailyCovenantReviewPalName'
                    );

                const id =
                    dailyPrayerElement(
                        'dailyCovenantPalId'
                    );

                const textarea =
                    dailyPrayerElement(
                        'dailyCovenantPrayerText'
                    );

                if (
                    !modal ||
                    !name ||
                    !reviewName ||
                    !id ||
                    !textarea
                ) {
                    return;
                }

                const safeName =
                    String(
                        palName ||
                        'your Prayer Pal'
                    ).trim() ||
                    'your Prayer Pal';

                name.textContent =
                    safeName;

                reviewName.textContent =
                    safeName;

                id.value =
                    String(
                        receiverId
                    );

                textarea.value =
                    '';

                dailyPrayerDraft =
                    null;

                dailyPrayerSending =
                    false;

                setDailyPrayerStatus(
                    'dailyCovenantComposeStatus',
                    ''
                );

                setDailyPrayerStatus(
                    'dailyCovenantReviewStatus',
                    ''
                );

                renderDailyPrayerStarters();

                setDailyPrayerStage(
                    'compose'
                );

                modal.style.display =
                    'flex';

                textarea.focus();
            };

        window.reviewDailyPrayerCovenant =
            function() {
                const textarea =
                    dailyPrayerElement(
                        'dailyCovenantPrayerText'
                    );

                const id =
                    dailyPrayerElement(
                        'dailyCovenantPalId'
                    );

                const name =
                    dailyPrayerElement(
                        'dailyCovenantPalName'
                    );

                const reviewText =
                    dailyPrayerElement(
                        'dailyCovenantReviewText'
                    );

                if (
                    !textarea ||
                    !id ||
                    !reviewText
                ) {
                    return;
                }

                const message =
                    textarea.value.trim();

                const receiverId =
                    Number(
                        id.value
                    );

                if (!message) {
                    setDailyPrayerStatus(
                        'dailyCovenantComposeStatus',
                        'Choose a prayer starter or write your own prayer first.',
                        true
                    );

                    textarea.focus();

                    return;
                }

                if (
                    message.length > 4000
                ) {
                    setDailyPrayerStatus(
                        'dailyCovenantComposeStatus',
                        'Please keep your prayer within 4,000 characters.',
                        true
                    );

                    return;
                }

                if (
                    !Number.isInteger(
                        receiverId
                    ) ||
                    receiverId <= 0
                ) {
                    setDailyPrayerStatus(
                        'dailyCovenantComposeStatus',
                        'Today’s Prayer Pal could not be confirmed. Please close this window and refresh.',
                        true
                    );

                    return;
                }

                dailyPrayerDraft = {
                    receiverId,
                    palName:
                        name
                            ? name.textContent.trim()
                            : 'your Prayer Pal',
                    message
                };

                reviewText.textContent =
                    message;

                setDailyPrayerStatus(
                    'dailyCovenantReviewStatus',
                    ''
                );

                setDailyPrayerStage(
                    'review'
                );
            };

        window.editDailyPrayerCovenant =
            function() {
                if (
                    dailyPrayerSending
                ) {
                    return;
                }

                setDailyPrayerStage(
                    'compose'
                );
            };

        window.confirmDailyPrayerCovenant =
            async function() {
                const member =
                    authenticatedMember();

                const button =
                    dailyPrayerElement(
                        'dailyCovenantConfirmBtn'
                    );

                if (
                    !member ||
                    !button ||
                    !dailyPrayerDraft ||
                    dailyPrayerSending
                ) {
                    return;
                }

                if (
                    window.navigator &&
                    window.navigator.onLine ===
                        false
                ) {
                    setDailyPrayerStatus(
                        'dailyCovenantReviewStatus',
                        'Reconnect to the internet before sending your prayer.',
                        true
                    );

                    return;
                }

                dailyPrayerSending =
                    true;

                button.disabled =
                    true;

                button.textContent =
                    'Sending prayer…';

                setDailyPrayerStatus(
                    'dailyCovenantReviewStatus',
                    ''
                );

                let sent =
                    false;

                try {
                    const response =
                        await window.fetch(
                            '/api/prayer-covenant/daily-pal/send',
                            {
                                method:
                                    'POST',

                                headers: {
                                    'Content-Type':
                                        'application/json',

                                    Accept:
                                        'application/json'
                                },

                                body:
                                    JSON.stringify({
                                        receiver_id:
                                            dailyPrayerDraft.receiverId,

                                        message:
                                            dailyPrayerDraft.message
                                    })
                            }
                        );

                    const result =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        !response.ok ||
                        result.success !== true
                    ) {
                        throw new Error(
                            result.error ||
                            'Prayer could not be sent.'
                        );
                    }

                    sent =
                        true;

                    button.textContent =
                        'Prayer sent ✓';

                    setDailyPrayerStatus(
                        'dailyCovenantReviewStatus',
                        `Your prayer was delivered to ${dailyPrayerDraft.palName}. They can respond with Thank You or a Praise Report through the Community Portal.`
                    );

                    state.growthMoment =
                        'Growth Moment: you intentionally prayed for someone in our community today.';

                    state.lastLoadedAt =
                        0;

                    await renderDashboard({
                        force: true
                    });

                    dailyPrayerSending =
                        false;

                    const showPrayerSuccess =
                        typeof window.showSuccessMessage ===
                            'function'
                            ? window.showSuccessMessage
                            : (
                                typeof showSuccessMessage ===
                                    'function'
                                    ? showSuccessMessage
                                    : null
                            );

                    if (showPrayerSuccess) {
                        window
                            .closeDailyPrayerCovenant();

                        showPrayerSuccess(
                            '🙏',
                            'Prayer Sent!',
                            'Your prayer was delivered privately to your Prayer Pal.\n\n' +
                                'Today’s Prayer Covenant prayer is complete. Thank you for carrying someone in our community in prayer.\n\n' +
                                'Your Prayer Pal can respond with Thank You or a Praise Report through the Community Portal.'
                        );

                        if (
                            typeof window.scrollTo ===
                                'function'
                        ) {
                            window.scrollTo({
                                top: 0,
                                behavior:
                                    'smooth'
                            });
                        }
                    } else if (
                        typeof window.alert ===
                            'function'
                    ) {
                        window.alert(
                            'Prayer sent. Your prayer was delivered privately to your Prayer Pal.'
                        );

                        window
                            .closeDailyPrayerCovenant();
                    } else {
                        button.disabled =
                            true;
                    }
                } catch (error) {
                    setDailyPrayerStatus(
                        'dailyCovenantReviewStatus',
                        error &&
                        error.message
                            ? error.message
                            : 'Prayer could not be sent. Please try again.',
                        true
                    );
                } finally {
                    if (!sent) {
                        dailyPrayerSending =
                            false;

                        button.disabled =
                            false;

                        button.textContent =
                            'Confirm & Send';
                    }
                }
            };

        document.addEventListener(
            'keydown',
            event => {
                if (
                    event.key !== 'Escape'
                ) {
                    return;
                }

                const modal =
                    dailyPrayerElement(
                        'dailyCovenantPrayerModal'
                    );

                if (
                    modal &&
                    modal.style.display ===
                        'flex'
                ) {
                    window
                        .closeDailyPrayerCovenant();
                }
            }
        );

        function prayerStatusElement() {
            let status = document.getElementById('guidedPrayerStatus');
            if (status) return status;
            const button = document.getElementById('guidedPrayerSubmitBtn');
            if (!button || !button.parentNode) return null;
            status = element(document, 'p', '', '');
            status.id = 'guidedPrayerStatus';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            status.style.cssText = 'min-height:1.4em;margin:10px 0 0;color:var(--text-muted);font-size:0.85rem;text-align:center;';
            button.parentNode.insertBefore(status, button);
            return status;
        }

        window.submitGuidedPrayer = async function() {
            const member = authenticatedMember();
            const button = document.getElementById('guidedPrayerSubmitBtn');
            const message = document.getElementById('guidedPrayerText')?.value.trim() || '';
            const receiverId = Number(document.getElementById('guidedPalId')?.value);
            const status = prayerStatusElement();
            if (!member || !button) return;
            if (!message) {
                if (status) status.textContent = 'Choose a guided prayer or write your own first.';
                return;
            }
            if (!Number.isInteger(receiverId) || receiverId <= 0) {
                if (status) status.textContent = 'Your Prayer Partner could not be confirmed.';
                return;
            }

            button.disabled = true;
            button.textContent = 'Sending prayer…';
            if (status) status.textContent = '';
            try {
                const response = await window.fetch('/api/prayer-pals/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_id: Number(member.id),
                        receiver_id: receiverId,
                        message
                    })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success !== true) {
                    throw new Error(result.error || 'Prayer could not be sent.');
                }

                button.textContent = 'Prayer sent';
                if (status) status.textContent = 'Your prayer was delivered. Thank you for carrying your Prayer Partner today.';
                state.growthMoment = 'Growth Moment: your prayer was offered today. Continue with your next invitation below.';
                state.lastLoadedAt = 0;
                await renderDashboard({ force: true });

                window.setTimeout(() => {
                    const modal = document.getElementById('guidedPrayerModal');
                    if (modal) modal.style.display = 'none';
                    if (typeof window.switchTab === 'function') window.switchTab('pulseDashboardTab');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 900);
            } catch (error) {
                if (status) status.textContent = error.message || 'Prayer could not be sent. Please try again.';
            } finally {
                window.setTimeout(() => {
                    button.disabled = false;
                    button.textContent = 'Send Prayer';
                }, 1000);
            }
        };

        window.renderJourneyDashboard = renderDashboard;
        window.renderHomeJourney = () => renderDashboard();
        window.renderHomeJourneyCard = () => {
            const tab = document.getElementById('pulseDashboardTab');
            return tab && tab.classList.contains('active')
                ? renderDashboard()
                : null;
        };
        window.loadSecretPrayerPal = () => renderDashboard({ force: true });

        const previousSwitchTab = window.switchTab;
        window.switchTab = async function(tabId, subTabId) {
            const result = previousSwitchTab
                ? await previousSwitchTab(tabId, subTabId)
                : undefined;
            if (tabId === 'pulseDashboardTab') {
                window.setTimeout(() => renderDashboard(), 30);
            }
            return result;
        };

        function begin() {
            Promise.resolve(window.authReady)
                .catch(() => null)
                .finally(() => renderDashboard({ force: true }));
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', begin, { once: true });
        } else {
            begin();
        }
        window.addEventListener('online', () => renderDashboard({ force: true }));
    }

    return {
        PHASES,
        PRAYER_STARTERS,
        manilaDateKey,
        buildPrayerModel,
        applyDailyPrayerActionState,
        buildJourneyModel,
        selectUpcomingEvents,
        install
    };
});
