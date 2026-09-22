(function (root) {
    'use strict';

    if (
        !root ||
        !root.document
    ) {
        return;
    }

    if (
        root
            .__birthdayBlessingsUiInstalled
    ) {
        return;
    }

    root
        .__birthdayBlessingsUiInstalled =
        true;

    const document =
        root.document;

    const state = {
        today:
            null,

        loadingToday:
            null,

        selectedCelebrantId:
            null,

        admin:
            null,

        adminView:
            'upcoming',

        adminLoading:
            null,

        profileLoading:
            null,

        deepLinkHandled:
            false
    };

    const FALLBACK_AVATAR =
        '/img/logo.png';


    function authenticated() {
        return (
            root.koinoniaAuthStatus ===
                'authenticated' &&
            root.currentMember &&
            Number.isSafeInteger(
                Number(
                    root.currentMember.id
                )
            ) &&
            Number(
                root.currentMember.id
            ) > 0
        );
    }


    function hasDirectoryPermission() {
        return Boolean(
            typeof root.hasPerm ===
                'function' &&
            root.hasPerm(
                'access_directory'
            )
        );
    }


    function create(
        tag,
        className,
        text
    ) {
        const node =
            document.createElement(
                tag
            );

        if (className) {
            node.className =
                className;
        }

        if (
            text !== undefined &&
            text !== null
        ) {
            node.textContent =
                String(text);
        }

        return node;
    }


    function clear(
        node
    ) {
        while (
            node &&
            node.firstChild
        ) {
            node.removeChild(
                node.firstChild
            );
        }
    }


    function firstName(
        name
    ) {
        if (
            typeof name !==
            'string'
        ) {
            return '';
        }

        return (
            name
                .trim()
                .split(/\s+/)[0] ||
            ''
        );
    }


    function initials(
        name
    ) {
        if (
            typeof name !==
            'string'
        ) {
            return '🎂';
        }

        const parts =
            name
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (
            parts.length === 0
        ) {
            return '🎂';
        }

        return parts
            .slice(0, 2)
            .map(
                part =>
                    part.charAt(0)
                        .toUpperCase()
            )
            .join('');
    }


    function safeImageSource(
        value
    ) {
        if (
            typeof value !==
            'string'
        ) {
            return null;
        }

        const source =
            value.trim();

        if (!source) {
            return null;
        }

        if (
            /^https?:\/\/[^\s]+$/i
                .test(source) ||
            /^\/(?!\/)[^\s]*$/
                .test(source) ||
            /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i
                .test(source)
        ) {
            return source;
        }

        return null;
    }


    function avatar(
        person,
        extraClass = ''
    ) {
        const holder =
            create(
                'span',
                `birthday-avatar ${extraClass}`
                    .trim()
            );

        const source =
            safeImageSource(
                person &&
                person
                    .profile_picture
            );

        if (source) {
            const image =
                document.createElement(
                    'img'
                );

            image.src =
                source;

            image.alt =
                person &&
                person.name
                    ? `${person.name} profile picture`
                    : 'Member profile picture';

            image.loading =
                'lazy';

            image.onerror =
                () => {
                    image.remove();
                    holder.textContent =
                        initials(
                            person &&
                            person.name
                        );
                };

            holder.appendChild(
                image
            );
        } else {
            holder.textContent =
                initials(
                    person &&
                    person.name
                );
        }

        return holder;
    }


    function ensureHomeCard() {
        let card =
            document.getElementById(
                'birthdayBlessingsCard'
            );

        if (card) {
            return card;
        }

        const dashboard =
            document.getElementById(
                'journeyFirstDashboard'
            );

        const welcome =
            dashboard &&
            dashboard.querySelector(
                '.journey-home__welcome'
            );

        if (
            !dashboard ||
            !welcome
        ) {
            return null;
        }

        card =
            create(
                'section',
                'journey-card birthday-card'
            );

        card.id =
            'birthdayBlessingsCard';

        card.hidden =
            true;

        card.setAttribute(
            'aria-live',
            'polite'
        );

        welcome.insertAdjacentElement(
            'afterend',
            card
        );

        return card;
    }


    function renderHomeCard() {
        const card =
            ensureHomeCard();

        if (!card) {
            return;
        }

        const payload =
            state.today;

        const celebrants =
            payload &&
            Array.isArray(
                payload.celebrants
            )
                ? payload
                    .celebrants
                : [];

        if (
            !authenticated() ||
            celebrants.length ===
                0
        ) {
            card.hidden =
                true;

            clear(card);

            return;
        }

        card.hidden =
            false;

        clear(card);

        const header =
            create(
                'div',
                'birthday-card__header'
            );

        const copy =
            create('div');

        copy.appendChild(
            create(
                'p',
                'birthday-card__eyebrow',
                'Birthday Blessings'
            )
        );

        copy.appendChild(
            create(
                'h3',
                'birthday-card__title',
                celebrants.length ===
                    1
                    ? 'Today we celebrate'
                    : `Today we celebrate ${celebrants.length} members`
            )
        );

        copy.appendChild(
            create(
                'p',
                'birthday-card__subtitle',
                'Help someone in our FOG family feel remembered, prayed for, and celebrated today.'
            )
        );

        header.appendChild(
            copy
        );

        header.appendChild(
            create(
                'span',
                'birthday-card__icon',
                '🎂'
            )
        );

        card.appendChild(
            header
        );

        const list =
            create(
                'div',
                'birthday-celebrant-list'
            );

        celebrants.forEach(
            celebrant => {
                const row =
                    create(
                        'button',
                        'birthday-celebrant-row'
                    );

                row.type =
                    'button';

                if (
                    celebrant.is_me ===
                    true
                ) {
                    row.classList.add(
                        'birthday-celebrant-row--me'
                    );
                }

                row.appendChild(
                    avatar(
                        celebrant
                    )
                );

                const body =
                    create(
                        'span',
                        'birthday-celebrant-row__body'
                    );

                body.appendChild(
                    create(
                        'span',
                        'birthday-celebrant-row__name',
                        celebrant.is_me
                            ? `${celebrant.name} — that's you!`
                            : celebrant.name
                    )
                );

                const blessingCount =
                    Math.max(
                        0,
                        Number(
                            celebrant
                                .blessing_count
                        ) || 0
                    );

                let meta =
                    `${celebrant.birthday_label} · ` +
                    `${blessingCount} ` +
                    (
                        blessingCount === 1
                            ? 'blessing'
                            : 'blessings'
                    );

                if (
                    celebrant
                        .viewer_blessing_key
                ) {
                    meta +=
                        ' · Your blessing was sent ✓';
                }

                body.appendChild(
                    create(
                        'span',
                        'birthday-celebrant-row__meta',
                        meta
                    )
                );

                row.appendChild(
                    body
                );

                row.appendChild(
                    create(
                        'span',
                        'birthday-celebrant-row__action',
                        celebrant.is_me
                            ? 'View blessings ›'
                            : celebrant
                                .viewer_blessing_key
                                ? 'Blessed ✓'
                                : 'Send blessing ›'
                    )
                );

                row.addEventListener(
                    'click',
                    () =>
                        openCelebration(
                            celebrant.id
                        )
                );

                list.appendChild(
                    row
                );
            }
        );

        card.appendChild(
            list
        );

        card.appendChild(
            create(
                'div',
                'birthday-card__footer',
                'Birthday Blessings are about remembering one another—there are no Life Points or rankings here.'
            )
        );
    }


    async function loadToday({
        force = false
    } = {}) {
        if (!authenticated()) {
            state.today =
                null;

            renderHomeCard();

            return null;
        }

        if (
            state.loadingToday
        ) {
            return state
                .loadingToday;
        }

        if (
            !force &&
            state.today
        ) {
            renderHomeCard();

            return state.today;
        }

        state.loadingToday =
            (async () => {
                const response =
                    await root.fetch(
                        '/api/birthdays/today',
                        {
                            credentials:
                                'same-origin',

                            headers: {
                                Accept:
                                    'application/json'
                            }
                        }
                    );

                const payload =
                    await response.json();

                if (
                    !response.ok ||
                    !payload ||
                    payload.success !==
                        true
                ) {
                    throw new Error(
                        'birthday_today_unavailable'
                    );
                }

                state.today =
                    payload;

                renderHomeCard();

                return payload;
            })()
                .catch(
                    error => {
                        console.error(
                            '[Birthday Blessings] today load failed',
                            error
                        );

                        const card =
                            ensureHomeCard();

                        if (card) {
                            card.hidden =
                                true;
                        }

                        return null;
                    }
                )
                .finally(
                    () => {
                        state.loadingToday =
                            null;
                    }
                );

        return state
            .loadingToday;
    }


    function ensureModal() {
        let modal =
            document.getElementById(
                'birthdayCelebrationModal'
            );

        if (modal) {
            return modal;
        }

        modal =
            create(
                'div',
                'birthday-modal'
            );

        modal.id =
            'birthdayCelebrationModal';

        modal.hidden =
            true;

        modal.setAttribute(
            'role',
            'dialog'
        );

        modal.setAttribute(
            'aria-modal',
            'true'
        );

        modal.setAttribute(
            'aria-labelledby',
            'birthdayCelebrationTitle'
        );

        const dialog =
            create(
                'div',
                'birthday-modal__dialog'
            );

        const closeButton =
            create(
                'button',
                'birthday-modal__close',
                '×'
            );

        closeButton.type =
            'button';

        closeButton.setAttribute(
            'aria-label',
            'Close Birthday Blessings'
        );

        closeButton.addEventListener(
            'click',
            closeCelebration
        );

        dialog.appendChild(
            closeButton
        );

        const content =
            create('div');

        content.id =
            'birthdayCelebrationContent';

        dialog.appendChild(
            content
        );

        modal.appendChild(
            dialog
        );

        modal.addEventListener(
            'click',
            event => {
                if (
                    event.target ===
                    modal
                ) {
                    closeCelebration();
                }
            }
        );

        document.body.appendChild(
            modal
        );

        return modal;
    }


    function closeCelebration() {
        const modal =
            document.getElementById(
                'birthdayCelebrationModal'
            );

        if (!modal) {
            return;
        }

        modal.hidden =
            true;

        document.body
            .classList
            .remove(
                'birthday-modal-open'
            );
    }


    function presetByKey(
        key
    ) {
        const presets =
            state.today &&
            Array.isArray(
                state.today.presets
            )
                ? state
                    .today
                    .presets
                : [];

        return (
            presets.find(
                preset =>
                    preset.key ===
                    key
            ) ||
            null
        );
    }


    async function sendBlessing(
        celebrant,
        blessingKey,
        statusNode
    ) {
        if (
            !celebrant ||
            !blessingKey
        ) {
            return;
        }

        statusNode.textContent =
            'Sending your Birthday Blessing…';

        const response =
            await root.fetch(
                `/api/birthdays/${encodeURIComponent(
                    String(
                        celebrant.id
                    )
                )}/bless`,
                {
                    method:
                        'POST',

                    credentials:
                        'same-origin',

                    headers: {
                        'Content-Type':
                            'application/json',

                        Accept:
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            blessing_key:
                                blessingKey
                        })
                }
            );

        const payload =
            await response.json();

        if (
            !response.ok ||
            !payload ||
            payload.success !==
                true
        ) {
            throw new Error(
                payload &&
                payload.error
                    ? payload.error
                    : 'Unable to send Birthday Blessing.'
            );
        }

        const result =
            payload.result ||
            {};

        celebrant
            .viewer_blessing_key =
            result.blessing_key ||
            blessingKey;

        celebrant
            .blessing_count =
            Number(
                result
                    .blessing_count
            ) || celebrant
                .blessing_count ||
            0;

        const preset =
            presetByKey(
                celebrant
                    .viewer_blessing_key
            );

        statusNode.textContent =
            preset
                ? `Birthday Blessing sent: ${preset.label}. Thank you for helping ${firstName(
                    celebrant.name
                ) || 'our celebrant'} feel remembered today.`
                : 'Birthday Blessing sent. Thank you for helping make their day special.';

        renderHomeCard();

        renderCelebration(
            celebrant.id
        );
    }


    async function loadMyReceivedBlessings() {
        const response =
            await root.fetch(
                '/api/birthdays/me/blessings',
                {
                    credentials:
                        'same-origin',

                    headers: {
                        Accept:
                            'application/json'
                    }
                }
            );

        const payload =
            await response.json();

        if (
            !response.ok ||
            !payload ||
            payload.success !==
                true
        ) {
            throw new Error(
                'birthday_received_unavailable'
            );
        }

        return payload;
    }


    async function renderCelebration(
        celebrantId
    ) {
        const payload =
            state.today;

        const celebrants =
            payload &&
            Array.isArray(
                payload.celebrants
            )
                ? payload
                    .celebrants
                : [];

        const celebrant =
            celebrants.find(
                item =>
                    Number(
                        item.id
                    ) ===
                    Number(
                        celebrantId
                    )
            );

        if (!celebrant) {
            return;
        }

        state
            .selectedCelebrantId =
            celebrant.id;

        const content =
            document.getElementById(
                'birthdayCelebrationContent'
            );

        if (!content) {
            return;
        }

        clear(content);

        const hero =
            create(
                'div',
                'birthday-modal__hero'
            );

        const modalAvatar =
            avatar(
                celebrant,
                'birthday-modal__avatar'
            );

        hero.appendChild(
            modalAvatar
        );

        hero.appendChild(
            create(
                'p',
                'birthday-modal__eyebrow',
                celebrant.is_me
                    ? 'Today we celebrate you'
                    : 'Birthday Blessings'
            )
        );

        const title =
            create(
                'h2',
                '',
                celebrant.is_me
                    ? `Happy Birthday, ${firstName(
                        celebrant.name
                    ) || celebrant.name}! 🎉`
                    : `Celebrate ${firstName(
                        celebrant.name
                    ) || celebrant.name} 🎂`
            );

        title.id =
            'birthdayCelebrationTitle';

        hero.appendChild(
            title
        );

        hero.appendChild(
            create(
                'p',
                'birthday-modal__copy',
                celebrant.is_me
                    ? 'May this new year of life draw you closer to God, fill you with joy, and remind you that your FOG family is grateful for you.'
                    : 'Choose a simple blessing below. Your greeting becomes part of today’s celebration without turning it into a competition.'
            )
        );

        const count =
            Math.max(
                0,
                Number(
                    celebrant
                        .blessing_count
                ) || 0
            );

        hero.appendChild(
            create(
                'span',
                'birthday-modal__count',
                `❤️ ${count} ${
                    count === 1
                        ? 'birthday blessing'
                        : 'birthday blessings'
                }`
            )
        );

        content.appendChild(
            hero
        );

        const body =
            create(
                'div',
                'birthday-modal__body'
            );

        if (
            celebrant.is_me ===
            true
        ) {
            const loading =
                create(
                    'div',
                    'birthday-empty',
                    'Loading the people who celebrated with you…'
                );

            body.appendChild(
                loading
            );

            content.appendChild(
                body
            );

            try {
                const received =
                    await loadMyReceivedBlessings();

                clear(body);

                if (
                    !received
                        .is_birthday_today
                ) {
                    body.appendChild(
                        create(
                            'div',
                            'birthday-empty',
                            'Your Birthday Blessings will appear here on your birthday.'
                        )
                    );

                    return;
                }

                const blessings =
                    Array.isArray(
                        received
                            .blessings
                    )
                        ? received
                            .blessings
                        : [];

                if (
                    blessings.length ===
                    0
                ) {
                    body.appendChild(
                        create(
                            'div',
                            'birthday-empty',
                            'Your community celebration has started. Birthday Blessings from members will appear here throughout the day.'
                        )
                    );

                    return;
                }

                const intro =
                    create(
                        'p',
                        'birthday-modal__copy',
                        blessings.length === 1
                            ? 'One member has already helped make your day special.'
                            : `${blessings.length} members have already helped make your day special.`
                    );

                body.appendChild(
                    intro
                );

                const list =
                    create(
                        'div',
                        'birthday-received-list'
                    );

                blessings.forEach(
                    blessing => {
                        const row =
                            create(
                                'div',
                                'birthday-received-row'
                            );

                        row.appendChild(
                            avatar(
                                blessing
                            )
                        );

                        const text =
                            create(
                                'div'
                            );

                        text.appendChild(
                            create(
                                'strong',
                                '',
                                blessing.name
                            )
                        );

                        const preset =
                            presetByKey(
                                blessing
                                    .blessing_key
                            );

                        text.appendChild(
                            create(
                                'span',
                                '',
                                preset
                                    ? preset.message
                                    : 'Sent a Birthday Blessing'
                            )
                        );

                        row.appendChild(
                            text
                        );

                        list.appendChild(
                            row
                        );
                    }
                );

                body.appendChild(
                    list
                );

            } catch (error) {
                console.error(
                    '[Birthday Blessings] received list failed',
                    error
                );

                loading.textContent =
                    'Your Birthday Blessings could not be loaded right now.';
            }

            return;
        }

        const presets =
            payload &&
            Array.isArray(
                payload.presets
            )
                ? payload
                    .presets
                : [];

        const grid =
            create(
                'div',
                'birthday-preset-grid'
            );

        const status =
            create(
                'div',
                'birthday-blessing-status'
            );

        presets.forEach(
            preset => {
                const button =
                    create(
                        'button',
                        'birthday-preset'
                    );

                button.type =
                    'button';

                if (
                    celebrant
                        .viewer_blessing_key ===
                    preset.key
                ) {
                    button.classList.add(
                        'birthday-preset--selected'
                    );
                }

                button.appendChild(
                    create(
                        'strong',
                        '',
                        preset.label
                    )
                );

                button.appendChild(
                    create(
                        'span',
                        '',
                        preset.message
                    )
                );

                button.addEventListener(
                    'click',
                    async () => {
                        Array.from(
                            grid.querySelectorAll(
                                '.birthday-preset'
                            )
                        ).forEach(
                            node =>
                                node.disabled =
                                    true
                        );

                        try {
                            await sendBlessing(
                                celebrant,
                                preset.key,
                                status
                            );
                        } catch (error) {
                            status.textContent =
                                error &&
                                error.message
                                    ? error.message
                                    : 'Unable to send Birthday Blessing.';
                        } finally {
                            Array.from(
                                grid.querySelectorAll(
                                    '.birthday-preset'
                                )
                            ).forEach(
                                node =>
                                    node.disabled =
                                        false
                            );
                        }
                    }
                );

                grid.appendChild(
                    button
                );
            }
        );

        body.appendChild(
            grid
        );

        if (
            celebrant
                .viewer_blessing_key
        ) {
            const selected =
                presetByKey(
                    celebrant
                        .viewer_blessing_key
                );

            status.textContent =
                selected
                    ? `You already sent “${selected.label}”. You can choose another preset if you want to update it.`
                    : 'You already sent a Birthday Blessing.';
        }

        body.appendChild(
            status
        );

        content.appendChild(
            body
        );
    }


    async function openCelebration(
        celebrantId = null
    ) {
        const payload =
            await loadToday();

        if (
            !payload ||
            !Array.isArray(
                payload.celebrants
            ) ||
            payload
                .celebrants
                .length ===
                0
        ) {
            return;
        }

        let selectedId =
            Number(
                celebrantId
            );

        if (
            !Number.isSafeInteger(
                selectedId
            ) ||
            selectedId <= 0
        ) {
            const own =
                payload
                    .celebrants
                    .find(
                        item =>
                            item.is_me ===
                            true
                    );

            selectedId =
                own
                    ? own.id
                    : payload
                        .celebrants[0]
                        .id;
        }

        const modal =
            ensureModal();

        modal.hidden =
            false;

        document.body
            .classList
            .add(
                'birthday-modal-open'
            );

        await renderCelebration(
            selectedId
        );
    }


    /* -----------------------------------------------------
       PROFILE PRIVACY CONTROLS
       ----------------------------------------------------- */

    function ensureProfilePreferences() {
        let section =
            document.getElementById(
                'birthdayProfilePreferences'
            );

        if (section) {
            return section;
        }

        const legal =
            document.getElementById(
                'myLegalPrivacySection'
            );

        if (!legal) {
            return null;
        }

        section =
            create(
                'section',
                'birthday-profile-section'
            );

        section.id =
            'birthdayProfilePreferences';

        section.hidden =
            true;

        const heading =
            create(
                'h3',
                '',
                '🎂 Birthday Blessings'
            );

        section.appendChild(
            heading
        );

        section.appendChild(
            create(
                'p',
                'birthday-profile-intro',
                'Choose how Birthday Blessings works for you. Your public birthday celebration shows only the month and day—not your age or birth year.'
            )
        );

        const date =
            create(
                'div',
                'birthday-profile-date'
            );

        date.id =
            'birthdayProfileDate';

        section.appendChild(
            date
        );

        const celebrationRow =
            create(
                'label',
                'birthday-pref-row'
            );

        const celebrationCopy =
            create('span');

        celebrationCopy.appendChild(
            create(
                'strong',
                '',
                'Celebrate my birthday in the Community Portal'
            )
        );

        celebrationCopy.appendChild(
            create(
                'small',
                '',
                'When enabled, your name, profile photo, and birthday month/day can appear in Birthday Blessings on your birthday.'
            )
        );

        const celebrationToggle =
            document.createElement(
                'input'
            );

        celebrationToggle.type =
            'checkbox';

        celebrationToggle.id =
            'birthdayCelebrationEnabled';

        celebrationToggle.className =
            'birthday-toggle';

        celebrationRow.appendChild(
            celebrationCopy
        );

        celebrationRow.appendChild(
            celebrationToggle
        );

        section.appendChild(
            celebrationRow
        );

        const notificationRow =
            create(
                'label',
                'birthday-pref-row'
            );

        const notificationCopy =
            create('span');

        notificationCopy.appendChild(
            create(
                'strong',
                '',
                'Receive Birthday Blessings notifications'
            )
        );

        notificationCopy.appendChild(
            create(
                'small',
                '',
                'Allow Birthday Blessings community notifications to reach your Portal account, subject to your Membership & Community notification settings.'
            )
        );

        const notificationToggle =
            document.createElement(
                'input'
            );

        notificationToggle.type =
            'checkbox';

        notificationToggle.id =
            'birthdayNotificationsEnabled';

        notificationToggle.className =
            'birthday-toggle';

        notificationRow.appendChild(
            notificationCopy
        );

        notificationRow.appendChild(
            notificationToggle
        );

        section.appendChild(
            notificationRow
        );

        const status =
            create(
                'div',
                'birthday-profile-save-status'
            );

        status.id =
            'birthdayProfileSaveStatus';

        status.setAttribute(
            'role',
            'status'
        );

        section.appendChild(
            status
        );

        async function save() {
            status.textContent =
                'Saving Birthday Blessings preferences…';

            celebrationToggle.disabled =
                true;

            notificationToggle.disabled =
                true;

            try {
                const response =
                    await root.fetch(
                        '/api/birthdays/preferences',
                        {
                            method:
                                'PUT',

                            credentials:
                                'same-origin',

                            headers: {
                                'Content-Type':
                                    'application/json',

                                Accept:
                                    'application/json'
                            },

                            body:
                                JSON.stringify({
                                    celebration_enabled:
                                        celebrationToggle
                                            .checked,

                                    include_in_notifications:
                                        notificationToggle
                                            .checked
                                })
                        }
                    );

                const payload =
                    await response.json();

                if (
                    !response.ok ||
                    !payload ||
                    payload.success !==
                        true
                ) {
                    throw new Error(
                        'Unable to save Birthday preferences.'
                    );
                }

                status.textContent =
                    'Birthday Blessings preferences saved.';

                state.today =
                    null;

                await loadToday({
                    force:
                        true
                });

            } catch (error) {
                console.error(
                    '[Birthday Blessings] profile preference save failed',
                    error
                );

                status.textContent =
                    'Birthday preferences could not be saved right now.';

                await loadProfilePreferences({
                    force:
                        true
                });

            } finally {
                celebrationToggle.disabled =
                    false;

                notificationToggle.disabled =
                    false;
            }
        }

        celebrationToggle
            .addEventListener(
                'change',
                save
            );

        notificationToggle
            .addEventListener(
                'change',
                save
            );

        legal.insertAdjacentElement(
            'afterend',
            section
        );

        return section;
    }


    async function loadProfilePreferences({
        force = false
    } = {}) {
        if (!authenticated()) {
            return null;
        }

        const section =
            ensureProfilePreferences();

        if (!section) {
            return null;
        }

        if (
            state.profileLoading &&
            !force
        ) {
            return state
                .profileLoading;
        }

        state.profileLoading =
            (async () => {
                const response =
                    await root.fetch(
                        '/api/birthdays/preferences',
                        {
                            credentials:
                                'same-origin',

                            headers: {
                                Accept:
                                    'application/json'
                            }
                        }
                    );

                const payload =
                    await response.json();

                if (
                    !response.ok ||
                    !payload ||
                    payload.success !==
                        true
                ) {
                    throw new Error(
                        'birthday_preferences_unavailable'
                    );
                }

                const preferences =
                    payload.preferences ||
                    {};

                section.hidden =
                    false;

                const date =
                    document.getElementById(
                        'birthdayProfileDate'
                    );

                if (date) {
                    date.textContent =
                        preferences
                            .has_birthday
                            ? `Birthday on your community profile: ${preferences.birthday_label}`
                            : 'No birthday is currently saved on your profile. Add it through Edit Profile so the community can celebrate with you.';
                }

                const celebration =
                    document.getElementById(
                        'birthdayCelebrationEnabled'
                    );

                const notifications =
                    document.getElementById(
                        'birthdayNotificationsEnabled'
                    );

                if (celebration) {
                    celebration.checked =
                        preferences
                            .celebration_enabled ===
                        true;
                }

                if (notifications) {
                    notifications.checked =
                        preferences
                            .include_in_notifications ===
                        true;
                }

                return preferences;
            })()
                .catch(
                    error => {
                        console.error(
                            '[Birthday Blessings] profile preferences failed',
                            error
                        );

                        section.hidden =
                            true;

                        return null;
                    }
                )
                .finally(
                    () => {
                        state.profileLoading =
                            null;
                    }
                );

        return state
            .profileLoading;
    }


    /* -----------------------------------------------------
       ADMIN BIRTHDAY CENTER
       ----------------------------------------------------- */

    function ensureAdminTab() {
        let tab =
            document.getElementById(
                'birthdayAdminTab'
            );

        if (tab) {
            return tab;
        }

        const directoryTab =
            document.getElementById(
                'directoryTab'
            );

        if (
            !directoryTab ||
            !directoryTab.parentElement
        ) {
            return null;
        }

        tab =
            create(
                'div',
                'tab-content'
            );

        tab.id =
            'birthdayAdminTab';

        const shell =
            create(
                'div',
                'birthday-admin-shell'
            );

        const heading =
            create(
                'div',
                'birthday-admin-heading'
            );

        const headingCopy =
            create('div');

        headingCopy.appendChild(
            create(
                'h2',
                '',
                '🎂 Birthday Center'
            )
        );

        headingCopy.appendChild(
            create(
                'p',
                '',
                'See upcoming celebrations and help keep member birthday information complete.'
            )
        );

        const refresh =
            create(
                'button',
                'btn btn-outline btn-sm',
                '↻ Refresh'
            );

        refresh.type =
            'button';

        refresh.addEventListener(
            'click',
            () =>
                loadAdmin({
                    force:
                        true
                })
        );

        heading.appendChild(
            headingCopy
        );

        heading.appendChild(
            refresh
        );

        shell.appendChild(
            heading
        );

        const summary =
            create(
                'div',
                'birthday-admin-summary'
            );

        summary.id =
            'birthdayAdminSummary';

        shell.appendChild(
            summary
        );

        const tabs =
            create(
                'div',
                'birthday-admin-tabs'
            );

        [
            [
                'upcoming',
                'Upcoming'
            ],
            [
                'calendar',
                'Calendar'
            ],
            [
                'missing',
                'Missing Birthday'
            ]
        ].forEach(
            item => {
                const button =
                    create(
                        'button',
                        'birthday-admin-tab',
                        item[1]
                    );

                button.type =
                    'button';

                button.dataset
                    .birthdayAdminView =
                    item[0];

                if (
                    item[0] ===
                    state.adminView
                ) {
                    button.classList.add(
                        'active'
                    );
                }

                button.addEventListener(
                    'click',
                    () => {
                        state.adminView =
                            item[0];

                        renderAdmin();
                    }
                );

                tabs.appendChild(
                    button
                );
            }
        );

        shell.appendChild(
            tabs
        );

        const panel =
            create(
                'div',
                'birthday-admin-panel'
            );

        panel.id =
            'birthdayAdminPanel';

        panel.appendChild(
            create(
                'div',
                'birthday-empty',
                'Open Birthday Center to load community birthdays.'
            )
        );

        shell.appendChild(
            panel
        );

        tab.appendChild(
            shell
        );

        directoryTab
            .parentElement
            .insertBefore(
                tab,
                directoryTab
                    .nextSibling
            );

        return tab;
    }


    function ensureAdminNavigation() {
        if (
            !hasDirectoryPermission()
        ) {
            document
                .querySelectorAll(
                    '[data-birthday-admin-nav="1"]'
                )
                .forEach(
                    node =>
                        node.remove()
                );

            return;
        }

        ensureAdminTab();

        const directoryButtons =
            Array.from(
                document.querySelectorAll(
                    'button.nav-btn[data-target="directoryTab"]'
                )
            );

        directoryButtons.forEach(
            directoryButton => {
                const parent =
                    directoryButton
                        .parentElement;

                if (!parent) {
                    return;
                }

                const already =
                    Array.from(
                        parent.children
                    ).some(
                        child =>
                            child.dataset &&
                            child.dataset
                                .birthdayAdminNav ===
                                '1'
                    );

                if (already) {
                    return;
                }

                const button =
                    create(
                        'button',
                        'nav-btn',
                        '🎂 Birthday Center'
                    );

                button.type =
                    'button';

                button.dataset
                    .birthdayAdminNav =
                    '1';

                button.dataset
                    .target =
                    'birthdayAdminTab';

                button.addEventListener(
                    'click',
                    () => {
                        if (
                            typeof root
                                .switchTab ===
                            'function'
                        ) {
                            root.switchTab(
                                'birthdayAdminTab'
                            );
                        }
                    }
                );

                directoryButton
                    .insertAdjacentElement(
                        'afterend',
                        button
                    );
            }
        );
    }


    function renderAdminSummary(
        summary
    ) {
        const holder =
            document.getElementById(
                'birthdayAdminSummary'
            );

        if (!holder) {
            return;
        }

        clear(holder);

        const items = [
            [
                'Today',
                summary.today
            ],
            [
                'Next 7 Days',
                summary
                    .next_7_days
            ],
            [
                'This Month',
                summary
                    .this_month
            ],
            [
                'Missing Birthday',
                summary
                    .missing_birthdays
            ]
        ];

        items.forEach(
            item => {
                const stat =
                    create(
                        'div',
                        'birthday-admin-stat'
                    );

                stat.appendChild(
                    create(
                        'span',
                        '',
                        item[0]
                    )
                );

                stat.appendChild(
                    create(
                        'strong',
                        '',
                        Number(
                            item[1]
                        ) || 0
                    )
                );

                holder.appendChild(
                    stat
                );
            }
        );
    }


    function renderUpcoming(
        panel,
        payload
    ) {
        const calendar =
            Array.isArray(
                payload.calendar
            )
                ? payload.calendar
                : [];

        if (
            calendar.length ===
            0
        ) {
            panel.appendChild(
                create(
                    'div',
                    'birthday-empty',
                    'No birthdays are listed in the upcoming window.'
                )
            );

            return;
        }

        calendar.forEach(
            day => {
                const group =
                    create(
                        'div',
                        'birthday-upcoming-group'
                    );

                group.appendChild(
                    create(
                        'div',
                        'birthday-upcoming-date',
                        day.date_key
                    )
                );

                const celebrants =
                    Array.isArray(
                        day.celebrants
                    )
                        ? day
                            .celebrants
                        : [];

                celebrants.forEach(
                    person => {
                        const row =
                            create(
                                'div',
                                'birthday-admin-person'
                            );

                        row.appendChild(
                            avatar(
                                person
                            )
                        );

                        const copy =
                            create('div');

                        copy.appendChild(
                            create(
                                'strong',
                                '',
                                person.name
                            )
                        );

                        copy.appendChild(
                            create(
                                'small',
                                '',
                                `${person.birthday_label} · ${Number(
                                    person
                                        .blessing_count
                                ) || 0} blessings`
                            )
                        );

                        row.appendChild(
                            copy
                        );

                        group.appendChild(
                            row
                        );
                    }
                );

                panel.appendChild(
                    group
                );
            }
        );
    }


    function weekdayOffset(
        dateKey
    ) {
        const match =
            /^(\d{4})-(\d{2})-(\d{2})$/
                .exec(
                    dateKey ||
                    ''
                );

        if (!match) {
            return 0;
        }

        return new Date(
            Date.UTC(
                Number(
                    match[1]
                ),
                Number(
                    match[2]
                ) - 1,
                Number(
                    match[3]
                )
            )
        ).getUTCDay();
    }


    function renderCalendar(
        panel,
        payload
    ) {
        const month =
            payload
                .month_calendar;

        if (
            !month ||
            !Array.isArray(
                month.days
            )
        ) {
            panel.appendChild(
                create(
                    'div',
                    'birthday-empty',
                    'Birthday calendar is unavailable.'
                )
            );

            return;
        }

        panel.appendChild(
            create(
                'h3',
                'birthday-calendar-title',
                `${month.month_label} ${month.year}`
            )
        );

        const weekdays =
            create(
                'div',
                'birthday-calendar-weekdays'
            );

        [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ].forEach(
            day =>
                weekdays
                    .appendChild(
                        create(
                            'span',
                            '',
                            day
                        )
                    )
        );

        panel.appendChild(
            weekdays
        );

        const grid =
            create(
                'div',
                'birthday-calendar-grid'
            );

        const firstDay =
            month.days[0];

        const blanks =
            firstDay
                ? weekdayOffset(
                    firstDay
                        .date_key
                )
                : 0;

        for (
            let i = 0;
            i < blanks;
            i += 1
        ) {
            grid.appendChild(
                create(
                    'div',
                    'birthday-calendar-day birthday-calendar-day--empty'
                )
            );
        }

        month.days.forEach(
            day => {
                const cell =
                    create(
                        'div',
                        'birthday-calendar-day'
                    );

                if (
                    day.date_key ===
                    payload.date_key
                ) {
                    cell.classList.add(
                        'birthday-calendar-day--today'
                    );
                }

                cell.appendChild(
                    create(
                        'span',
                        'birthday-calendar-day__number',
                        day.day
                    )
                );

                const celebrants =
                    Array.isArray(
                        day.celebrants
                    )
                        ? day
                            .celebrants
                        : [];

                celebrants.forEach(
                    person => {
                        cell.appendChild(
                            create(
                                'span',
                                'birthday-calendar-person',
                                person.name
                            )
                        );
                    }
                );

                grid.appendChild(
                    cell
                );
            }
        );

        panel.appendChild(
            grid
        );
    }


    function renderMissing(
        panel,
        payload
    ) {
        const missing =
            Array.isArray(
                payload
                    .missing_birthdays
            )
                ? payload
                    .missing_birthdays
                : [];

        if (
            missing.length ===
            0
        ) {
            panel.appendChild(
                create(
                    'div',
                    'birthday-empty',
                    'Wonderful—every Portal-linked member currently has birthday information.'
                )
            );

            return;
        }

        panel.appendChild(
            create(
                'p',
                'birthday-profile-intro',
                'These Portal-linked members do not yet have birthday information. Their age or birthday is not guessed.'
            )
        );

        const list =
            create(
                'div',
                'birthday-missing-list'
            );

        missing.forEach(
            member => {
                const row =
                    create(
                        'div',
                        'birthday-missing-row'
                    );

                row.appendChild(
                    create(
                        'span',
                        '',
                        member.name
                    )
                );

                row.appendChild(
                    create(
                        'small',
                        '',
                        `Member ID ${member.id}`
                    )
                );

                list.appendChild(
                    row
                );
            }
        );

        panel.appendChild(
            list
        );
    }


    function renderAdmin() {
        const payload =
            state.admin;

        const panel =
            document.getElementById(
                'birthdayAdminPanel'
            );

        if (!panel) {
            return;
        }

        document
            .querySelectorAll(
                '[data-birthday-admin-view]'
            )
            .forEach(
                button => {
                    button
                        .classList
                        .toggle(
                            'active',
                            button.dataset
                                .birthdayAdminView ===
                                state
                                    .adminView
                        );
                }
            );

        clear(panel);

        if (!payload) {
            panel.appendChild(
                create(
                    'div',
                    'birthday-empty',
                    'Loading Birthday Center…'
                )
            );

            return;
        }

        renderAdminSummary(
            payload.summary ||
            {}
        );

        if (
            state.adminView ===
            'calendar'
        ) {
            renderCalendar(
                panel,
                payload
            );

            return;
        }

        if (
            state.adminView ===
            'missing'
        ) {
            renderMissing(
                panel,
                payload
            );

            return;
        }

        renderUpcoming(
            panel,
            payload
        );
    }


    async function loadAdmin({
        force = false
    } = {}) {
        if (
            !authenticated() ||
            !hasDirectoryPermission()
        ) {
            return null;
        }

        ensureAdminTab();
        ensureAdminNavigation();

        if (
            state.adminLoading
        ) {
            return state
                .adminLoading;
        }

        if (
            state.admin &&
            !force
        ) {
            renderAdmin();

            return state.admin;
        }

        state.adminLoading =
            (async () => {
                const response =
                    await root.fetch(
                        '/api/admin/birthdays/overview?days=60',
                        {
                            credentials:
                                'same-origin',

                            headers: {
                                Accept:
                                    'application/json'
                            }
                        }
                    );

                const payload =
                    await response.json();

                if (
                    !response.ok ||
                    !payload ||
                    payload.success !==
                        true
                ) {
                    throw new Error(
                        'birthday_admin_unavailable'
                    );
                }

                state.admin =
                    payload;

                renderAdmin();

                return payload;
            })()
                .catch(
                    error => {
                        console.error(
                            '[Birthday Blessings] Birthday Center failed',
                            error
                        );

                        const panel =
                            document.getElementById(
                                'birthdayAdminPanel'
                            );

                        if (panel) {
                            clear(panel);

                            panel.appendChild(
                                create(
                                    'div',
                                    'birthday-empty',
                                    'Birthday Center could not be loaded right now.'
                                )
                            );
                        }

                        return null;
                    }
                )
                .finally(
                    () => {
                        state.adminLoading =
                            null;
                    }
                );

        return state
            .adminLoading;
    }


    /* -----------------------------------------------------
       NAVIGATION / DEEP LINK HOOKS
       ----------------------------------------------------- */

    function wrapPermissions() {
        const previous =
            root
                .applyGranularPermissions;

        if (
            typeof previous !==
                'function' ||
            previous
                .birthdayBlessingsWrapped
        ) {
            ensureAdminNavigation();

            return;
        }

        const wrapped =
            function (...args) {
                const result =
                    previous.apply(
                        this,
                        args
                    );

                root.setTimeout(
                    ensureAdminNavigation,
                    0
                );

                return result;
            };

        wrapped
            .birthdayBlessingsWrapped =
            true;

        root
            .applyGranularPermissions =
            wrapped;
    }


    function wrapSwitchTab() {
        const previous =
            root.switchTab;

        if (
            typeof previous !==
                'function' ||
            previous
                .birthdayBlessingsWrapped
        ) {
            return;
        }

        const wrapped =
            async function (
                tabId,
                subTabId
            ) {
                const result =
                    await previous.call(
                        this,
                        tabId,
                        subTabId
                    );

                if (
                    tabId ===
                    'pulseDashboardTab'
                ) {
                    root.setTimeout(
                        () =>
                            loadToday({
                                force:
                                    true
                            }),
                        30
                    );
                }

                if (
                    tabId ===
                    'profileTab'
                ) {
                    root.setTimeout(
                        () =>
                            loadProfilePreferences({
                                force:
                                    true
                            }),
                        30
                    );
                }

                if (
                    tabId ===
                    'birthdayAdminTab'
                ) {
                    root.setTimeout(
                        () =>
                            loadAdmin({
                                force:
                                    true
                            }),
                        30
                    );
                }

                return result;
            };

        wrapped
            .birthdayBlessingsWrapped =
            true;

        root.switchTab =
            wrapped;
    }


    async function handleDeepLink() {
        if (
            state.deepLinkHandled ||
            !authenticated()
        ) {
            return;
        }

        const params =
            new URLSearchParams(
                root.location.search
            );

        if (
            params.get(
                'birthday'
            ) !==
            '1'
        ) {
            return;
        }

        state.deepLinkHandled =
            true;

        if (
            typeof root.switchTab ===
            'function'
        ) {
            await root.switchTab(
                'pulseDashboardTab'
            );
        }

        await loadToday({
            force:
                true
        });

        await openCelebration();

        params.delete(
            'birthday'
        );

        const nextSearch =
            params.toString();

        const nextUrl =
            root.location.pathname +
            (
                nextSearch
                    ? `?${nextSearch}`
                    : ''
            ) +
            root.location.hash;

        root.history.replaceState(
            null,
            '',
            nextUrl
        );
    }


    function installMutationObserver() {
        if (
            typeof MutationObserver !==
            'function'
        ) {
            return;
        }

        let timer =
            null;

        const observer =
            new MutationObserver(
                () => {
                    if (timer) {
                        root.clearTimeout(
                            timer
                        );
                    }

                    timer =
                        root.setTimeout(
                            () => {
                                ensureAdminNavigation();
                                ensureHomeCard();
                                ensureProfilePreferences();
                            },
                            50
                        );
                }
            );

        observer.observe(
            document.body,
            {
                childList:
                    true,

                subtree:
                    true
            }
        );
    }


    async function initializeAuthenticated() {
        if (!authenticated()) {
            return;
        }

        ensureHomeCard();
        ensureProfilePreferences();
        ensureAdminNavigation();

        await loadToday({
            force:
                true
        });

        if (
            document
                .getElementById(
                    'profileTab'
                ) &&
            document
                .getElementById(
                    'profileTab'
                )
                .classList
                .contains(
                    'active'
                )
        ) {
            await loadProfilePreferences({
                force:
                    true
            });
        }

        await handleDeepLink();
    }


    function begin() {
        ensureHomeCard();
        ensureModal();
        ensureProfilePreferences();
        ensureAdminTab();

        wrapPermissions();
        wrapSwitchTab();

        installMutationObserver();

        Promise
            .resolve(
                root.authReady
            )
            .catch(
                () => null
            )
            .finally(
                () => {
                    wrapPermissions();
                    wrapSwitchTab();

                    void initializeAuthenticated();
                }
            );

        root.addEventListener(
            'online',
            () => {
                if (
                    authenticated()
                ) {
                    void loadToday({
                        force:
                            true
                    });
                }
            }
        );
    }


    root.BirthdayBlessingsUI =
        Object.freeze({
            loadToday,

            open:
                openCelebration,

            close:
                closeCelebration,

            loadProfilePreferences,

            loadAdmin,

            ensureAdminNavigation
        });


    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            begin,
            {
                once:
                    true
            }
        );
    } else {
        begin();
    }

})(typeof window !== 'undefined'
    ? window
    : null);
