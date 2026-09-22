(() => {
    'use strict';

    const WATCHTOWER_PERMISSION =
        'access_prayer';

    let loading =
        false;

    function isAuthorized() {
        return Boolean(
            window.hasPerm &&
            window.hasPerm(
                WATCHTOWER_PERMISSION
            )
        );
    }

    function clear(element) {
        if (!element) return;

        while (element.firstChild) {
            element.removeChild(
                element.firstChild
            );
        }
    }

    function element(
        tag,
        {
            className = '',
            text = null
        } = {}
    ) {
        const node =
            document.createElement(tag);

        if (className) {
            node.className =
                className;
        }

        if (text !== null) {
            node.textContent =
                String(text);
        }

        return node;
    }

    function safeProfileImage(value) {
        if (
            typeof value !== 'string' ||
            !value
        ) {
            return null;
        }

        if (
            /^data:image\/(?:png|jpeg|webp);base64,/i
                .test(value)
        ) {
            return value;
        }

        try {
            const url =
                new URL(
                    value,
                    window.location.origin
                );

            return url.origin ===
                window.location.origin
                ? url.pathname
                : null;
        } catch {
            return null;
        }
    }

    async function requestJson(
        url,
        options = {}
    ) {
        const response =
            await window.fetch(
                url,
                {
                    credentials:
                        'same-origin',
                    cache:
                        'no-store',
                    headers: {
                        Accept:
                            'application/json',
                        ...(
                            options.headers ||
                            {}
                        )
                    },
                    ...options
                }
            );

        let payload =
            null;

        try {
            payload =
                await response.json();
        } catch {
            payload =
                null;
        }

        if (!response.ok) {
            const error =
                new Error(
                    payload && payload.error
                        ? payload.error
                        : 'Watchtower request failed.'
                );

            error.status =
                response.status;

            throw error;
        }

        return payload;
    }

    function setStatus(message) {
        const status =
            document.getElementById(
                'watchtowerStatus'
            );

        if (status) {
            status.textContent =
                message;
        }
    }

    async function mutate(
        youthId,
        operation
    ) {
        const normalizedId =
            Number(youthId);

        if (
            !Number.isSafeInteger(normalizedId) ||
            normalizedId <= 0
        ) {
            return;
        }

        setStatus(
            operation === 'claim'
                ? 'Claiming this prayer…'
                : 'Saving Prayer Coverage…'
        );

        try {
            await requestJson(
                `/api/prayer/watchtower/${encodeURIComponent(normalizedId)}/${operation}`,
                {
                    method:
                        'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },
                    body:
                        '{}'
                }
            );

            await loadWatchtower();
        } catch (error) {
            setStatus(
                error && error.message
                    ? error.message
                    : 'Watchtower could not be updated.'
            );
        }
    }

    function renderMember(member) {
        const card =
            element(
                'article',
                {
                    className:
                        'watchtower-member'
                }
            );

        const imageSource =
            safeProfileImage(
                member.profile_picture
            );

        if (imageSource) {
            const image =
                element(
                    'img',
                    {
                        className:
                            'watchtower-avatar'
                    }
                );

            image.src =
                imageSource;
            image.alt =
                '';
            card.appendChild(image);
        } else {
            const avatar =
                element(
                    'div',
                    {
                        className:
                            'watchtower-avatar',
                        text:
                            String(
                                member.name ||
                                '?'
                            )
                                .trim()
                                .slice(0, 1)
                                .toUpperCase()
                    }
                );

            avatar.setAttribute(
                'aria-hidden',
                'true'
            );
            avatar.style.display =
                'grid';
            avatar.style.placeItems =
                'center';
            avatar.style.fontWeight =
                '800';
            card.appendChild(avatar);
        }

        const copy =
            element(
                'div',
                {
                    className:
                        'watchtower-member-copy'
                }
            );

        copy.appendChild(
            element(
                'h3',
                {
                    className:
                        'watchtower-member-name',
                    text:
                        member.name ||
                        'Community member'
                }
            )
        );

        const description =
            member.claim_state ===
                'claimed_by_me'
                ? 'Claimed by you. Please pray before marking complete.'
                : member.claim_state ===
                    'claimed'
                    ? 'Another intercessor is praying now.'
                    : 'Available for fallback Prayer Coverage.';

        copy.appendChild(
            element(
                'p',
                {
                    text:
                        description
                }
            )
        );

        card.appendChild(copy);

        const button =
            element(
                'button',
                {
                    className:
                        'btn btn-primary',
                    text:
                        member.claim_state ===
                            'claimed_by_me'
                            ? 'Mark Prayed'
                            : member.claim_state ===
                                'claimed'
                                ? 'Claimed'
                                : 'Pray for this person'
                }
            );

        button.type =
            'button';

        if (member.claim_state === 'claimed') {
            button.disabled =
                true;
        } else {
            button.addEventListener(
                'click',
                () => {
                    button.disabled =
                        true;

                    void mutate(
                        member.youth_id,
                        member.claim_state ===
                            'claimed_by_me'
                            ? 'complete'
                            : 'claim'
                    );
                }
            );
        }

        card.appendChild(button);

        return card;
    }

    function renderState(state) {
        const list =
            document.getElementById(
                'watchtowerList'
            );

        clear(list);

        if (!state.open) {
            if (state.phase === 'before_open') {
                setStatus(
                    'Watchtower opens at 10:00 PM Asia/Manila.'
                );
            } else if (state.report) {
                setStatus(
                    `Today's window is closed. ${state.report.total_covered} of ${state.report.eligible_population} participating members received Prayer Coverage (${state.report.coverage_percent}%).`
                );
            } else {
                setStatus(
                    'Today’s Watchtower window is closed. The coverage report is being prepared.'
                );
            }

            return;
        }

        const members =
            Array.isArray(state.uncovered)
                ? state.uncovered
                : [];

        if (members.length === 0) {
            setStatus(
                'Everyone in today’s Prayer Partner circle is covered. Thank you for praying faithfully.'
            );
            return;
        }

        setStatus(
            `${members.length} ${members.length === 1 ? 'person remains' : 'people remain'} uncovered. Claims are held for ${state.claim_minutes} minutes.`
        );

        for (const member of members) {
            list.appendChild(
                renderMember(member)
            );
        }
    }

    async function loadWatchtower() {
        if (!isAuthorized() || loading) {
            return;
        }

        loading =
            true;
        setStatus(
            'Loading Watchtower…'
        );

        try {
            const state =
                await requestJson(
                    '/api/prayer/watchtower'
                );

            renderState(state);
        } catch (error) {
            setStatus(
                error && error.status === 403
                    ? 'Your Watchtower authorization is no longer active.'
                    : 'Watchtower could not be loaded. Please try again.'
            );
        } finally {
            loading =
                false;
        }
    }

    function installNavigation() {
        const sidebar =
            document.getElementById(
                'sidebarNav'
            );

        const existing =
            document.getElementById(
                'watchtowerNavButton'
            );

        if (!isAuthorized()) {
            if (existing) {
                existing.remove();
            }

            return;
        }

        if (!sidebar || existing) {
            return;
        }

        const button =
            element(
                'button',
                {
                    className:
                        'nav-btn',
                    text:
                        '🙏 Watchtower'
                }
            );

        button.id =
            'watchtowerNavButton';
        button.type =
            'button';
        button.dataset.target =
            'watchtowerTab';
        button.addEventListener(
            'click',
            () => {
                window.switchTab(
                    'watchtowerTab'
                );
            }
        );

        const logout =
            Array.from(
                sidebar.querySelectorAll(
                    '.nav-btn'
                )
            ).find(candidate =>
                /logout/i.test(
                    candidate.textContent ||
                    ''
                )
            );

        sidebar.insertBefore(
            button,
            logout || null
        );

        const hamburger =
            document.getElementById(
                'hamburgerBtn'
            );

        if (hamburger) {
            hamburger.style.display =
                'block';
        }
    }

    const originalBuildNav =
        window.buildNav;

    window.buildNav =
        function (...args) {
            const result =
                typeof originalBuildNav === 'function'
                    ? originalBuildNav.apply(
                        this,
                        args
                    )
                    : undefined;

            installNavigation();

            return result;
        };

    const originalSwitchTab =
        window.switchTab;

    window.switchTab =
        function (tabId, ...args) {
            if (
                tabId === 'watchtowerTab' &&
                !isAuthorized()
            ) {
                return;
            }

            const result =
                typeof originalSwitchTab === 'function'
                    ? originalSwitchTab.call(
                        this,
                        tabId,
                        ...args
                    )
                    : undefined;

            if (tabId === 'watchtowerTab') {
                void loadWatchtower();
            }

            return result;
        };

    window.loadWatchtower =
        loadWatchtower;

    window.addEventListener(
        'load',
        () => {
            installNavigation();

            const requestedTab =
                new URLSearchParams(
                    window.location.search
                ).get('tab');

            if (
                requestedTab === 'watchtower' &&
                isAuthorized()
            ) {
                window.switchTab(
                    'watchtowerTab'
                );
            }
        }
    );
})();
