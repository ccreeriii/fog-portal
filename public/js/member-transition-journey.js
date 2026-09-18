'use strict';

(() => {
    const TRANSITION_URL =
        '/api/member-transition/me';

    const ACTIONS = new Set([
        'initialize_transition',
        'community_intent',
        'priority_ministry',
        'ministry_discernment',
        'discernment_in_progress',
        'awaiting_ministry_verification',
        'transition_current',
        'transition_closed'
    ]);

    const state = {
        transition: null,
        transitionMemberId: null,
        transitionLoadedAt: 0,
        modal: null
    };

    function currentMemberSafe() {
        return (
            window.currentMember &&
            typeof window.currentMember ===
                'object'
        )
            ? window.currentMember
            : {};
    }

    function memberId() {
        return (
            Number(
                currentMemberSafe().id
            ) || null
        );
    }

    function el(
        tag,
        className = '',
        text = ''
    ) {
        const node =
            document.createElement(tag);

        if (className) {
            node.className =
                className;
        }

        if (
            text !== undefined &&
            text !== null &&
            text !== ''
        ) {
            node.textContent =
                String(text);
        }

        return node;
    }

    async function requestJson(
        url,
        options = {}
    ) {
        const response =
            await fetch(
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
                            options.body
                                ? {
                                    'Content-Type':
                                        'application/json'
                                }
                                : {}
                        ),

                        ...(
                            options.headers ||
                            {}
                        )
                    },

                    ...options
                }
            );

        const body =
            await response
                .json()
                .catch(
                    () => ({})
                );

        if (
            !response.ok ||
            body.success !== true
        ) {
            const error =
                new Error(
                    body.error ||
                    'Your journey could not be updated right now.'
                );

            error.code =
                body.code ||
                'TRANSITION_REQUEST_FAILED';

            error.status =
                response.status;

            throw error;
        }

        return body;
    }

    function unwrapState(body) {
        if (
            body &&
            body.state &&
            typeof body.state ===
                'object'
        ) {
            return body.state;
        }

        return body;
    }

    async function loadTransition(
        force = false
    ) {
        const id =
            memberId();

        if (
            state.transitionMemberId !==
            id
        ) {
            state.transition =
                null;

            state.transitionMemberId =
                id;

            state.transitionLoadedAt =
                0;
        }

        if (
            !force &&
            state.transition &&
            Date.now() -
                state.transitionLoadedAt <
                60 * 1000
        ) {
            return state.transition;
        }

        const body =
            await requestJson(
                TRANSITION_URL
            );

        const transition =
            unwrapState(body);

        state.transition =
            transition;

        state.transitionMemberId =
            id;

        state.transitionLoadedAt =
            Date.now();

        return transition;
    }

    function rememberTransition(
        transition
    ) {
        if (
            !transition ||
            typeof transition !==
                'object'
        ) {
            return;
        }

        state.transition =
            transition;

        state.transitionMemberId =
            memberId();

        state.transitionLoadedAt =
            Date.now();
    }

    function priorityName(
        transition
    ) {
        return (
            transition &&
            transition.ministries &&
            transition.ministries
                .priority &&
            transition.ministries
                .priority
                .ministry_name
        ) || '';
    }

    function candidates(
        transition
    ) {
        const list =
            transition &&
            transition.ministries &&
            Array.isArray(
                transition
                    .ministries
                    .candidates
            )
                ? transition
                    .ministries
                    .candidates
                : [];

        return list;
    }

    function visualKey(
        transition
    ) {
        if (!transition) {
            return 'none';
        }

        const ministries =
            candidates(transition)
                .map(
                    item =>
                        [
                            item.mapping_id,
                            item.ministry_id,
                            item.is_priority
                        ].join(':')
                )
                .join('|');

        const caseStatus =
            transition.discernment &&
            transition.discernment
                .open_case &&
            transition.discernment
                .open_case.status
                ? transition
                    .discernment
                    .open_case
                    .status
                : 'none';

        return [
            transition.next_action ||
                'none',

            transition.intake &&
            transition.intake
                .community_intent_choice
                ? transition
                    .intake
                    .community_intent_choice
                : 'none',

            ministries,
            caseStatus
        ].join('::');
    }

    function copyFor(
        transition
    ) {
        switch (
            transition.next_action
        ) {
        case 'initialize_transition':
            return {
                eyebrow:
                    'YOUR JOURNEY WITH FOG',

                title:
                    'Continue the Journey You Have Already Begun',

                description:
                    'Your history with FOG is already recognized. This short transition helps connect that journey with the Community Portal without asking you to start over.',

                button:
                    'Begin My Transition',

                actionable:
                    true
            };

        case 'community_intent':
            return {
                eyebrow:
                    'YOUR JOURNEY WITH FOG',

                title:
                    'Confirm Your Desire to Belong',

                description:
                    'Take a fresh personal moment to tell us how you desire to journey with the FOG community in this season.',

                button:
                    'Share My Response',

                actionable:
                    true
            };

        case 'priority_ministry':
            return {
                eyebrow:
                    'YOUR SERVICE JOURNEY',

                title:
                    'Choose Your Priority Ministry',

                description:
                    'Choose the ministry that will be your primary place of service, formation, and accountability. Your other ministry relationships will remain.',

                button:
                    'Choose Priority Ministry',

                actionable:
                    true
            };

        case 'ministry_discernment':
            return {
                eyebrow:
                    'YOUR SERVICE JOURNEY',

                title:
                    'Begin Ministry Discernment',

                description:
                    priorityName(
                        transition
                    )
                        ? `Take a prayerful next step with ${priorityName(transition)}.`
                        : 'Take a prayerful next step with your Priority Ministry.',

                button:
                    'Begin Discernment',

                actionable:
                    true
            };

        case 'discernment_in_progress':
            return {
                eyebrow:
                    'MINISTRY DISCERNMENT',

                title:
                    'Your Discernment Is In Progress',

                description:
                    'Your ministry discernment has been received. Continue praying and stay connected while leadership journeys with you.',

                button:
                    'View Discernment Status',

                actionable:
                    true
            };

        case 'awaiting_ministry_verification':
            return {
                eyebrow:
                    'YOUR SERVICE JOURNEY',

                title:
                    'Ministry Verification Needed',

                description:
                    'Your historical service is recognized, but leadership still needs to verify your current ministry relationship before you continue.',

                button:
                    'Waiting for Leadership',

                actionable:
                    false
            };

        case 'transition_current':
            return {
                eyebrow:
                    'YOUR JOURNEY WITH FOG',

                title:
                    'Your Journey Is Current',

                description:
                    'Your existing journey has been connected with the Community Portal. Continue walking faithfully with the community.',

                button:
                    'Journey Updated',

                actionable:
                    false
            };

        case 'transition_closed':
            return {
                eyebrow:
                    'YOUR JOURNEY WITH FOG',

                title:
                    'This Transition Is Closed',

                description:
                    'This transition journey is no longer open for changes. Please connect with leadership if something needs to be reviewed.',

                button:
                    'Closed',

                actionable:
                    false
            };

        default:
            return null;
        }
    }

    function clearModal() {
        if (
            state.modal &&
            state.modal.parentNode
        ) {
            state.modal.remove();
        }

        state.modal =
            null;

        document.body.classList
            .remove(
                'member-transition-journey-open'
            );
    }

    function modalShell(
        title,
        subtitle = ''
    ) {
        clearModal();

        const shell =
            el(
                'div',
                'member-transition-journey-modal'
            );

        shell.setAttribute(
            'role',
            'dialog'
        );

        shell.setAttribute(
            'aria-modal',
            'true'
        );

        const panel =
            el(
                'section',
                'member-transition-journey-panel'
            );

        const header =
            el(
                'header',
                'member-transition-journey-panel__header'
            );

        const headingWrap =
            el('div');

        headingWrap.appendChild(
            el(
                'h2',
                '',
                title
            )
        );

        if (subtitle) {
            headingWrap.appendChild(
                el(
                    'p',
                    '',
                    subtitle
                )
            );
        }

        const close =
            el(
                'button',
                'member-transition-journey-close',
                '×'
            );

        close.type =
            'button';

        close.setAttribute(
            'aria-label',
            'Close'
        );

        close.addEventListener(
            'click',
            clearModal
        );

        header.appendChild(
            headingWrap
        );

        header.appendChild(
            close
        );

        const body =
            el(
                'div',
                'member-transition-journey-panel__body'
            );

        const status =
            el(
                'p',
                'member-transition-journey-status'
            );

        status.hidden =
            true;

        panel.appendChild(
            header
        );

        panel.appendChild(
            body
        );

        panel.appendChild(
            status
        );

        shell.appendChild(
            panel
        );

        shell.addEventListener(
            'click',
            event => {
                if (
                    event.target ===
                    shell
                ) {
                    clearModal();
                }
            }
        );

        document.body.appendChild(
            shell
        );

        document.body.classList
            .add(
                'member-transition-journey-open'
            );

        state.modal =
            shell;

        return {
            shell,
            panel,
            body,
            status
        };
    }

    function setStatus(
        status,
        message,
        error = false
    ) {
        status.hidden =
            false;

        status.textContent =
            message;

        status.classList
            .toggle(
                'is-error',
                error
            );
    }

    function actionButton(
        label,
        handler
    ) {
        const button =
            el(
                'button',
                'member-transition-journey-primary',
                label
            );

        button.type =
            'button';

        button.addEventListener(
            'click',
            handler
        );

        return button;
    }

    function fieldLabel(
        text
    ) {
        return el(
            'label',
            'member-transition-journey-field-label',
            text
        );
    }

    function textarea(
        placeholder = ''
    ) {
        const input =
            el('textarea');

        input.rows =
            4;

        input.placeholder =
            placeholder;

        return input;
    }

    async function refreshAfterMutation(
        response
    ) {
        const transition =
            unwrapState(
                response
            );

        if (
            transition &&
            transition.next_action
        ) {
            rememberTransition(
                transition
            );
        } else {
            await loadTransition(
                true
            );
        }

        await refreshCard({
            force: false,
            transition:
                state.transition
        });
    }

    function openInitialize(
        transition
    ) {
        const modal =
            modalShell(
                'Continue Your Journey With FOG',
                'Your history is already recognized.'
            );

        modal.body.appendChild(
            el(
                'p',
                '',
                'You will not be asked to repeat the journey you have already walked. We will simply guide you through the fresh personal steps needed for this season.'
            )
        );

        modal.body.appendChild(
            el(
                'p',
                'member-transition-journey-note',
                'This begins your transition in the Community Portal. It does not erase or replace your historical Growth Journey.'
            )
        );

        const button =
            actionButton(
                'Begin My Transition',
                async () => {
                    button.disabled =
                        true;

                    try {
                        const response =
                            await requestJson(
                                '/api/member-transition/me/initialize',
                                {
                                    method:
                                        'POST'
                                }
                            );

                        await refreshAfterMutation(
                            response
                        );

                        clearModal();
                    } catch (error) {
                        button.disabled =
                            false;

                        setStatus(
                            modal.status,
                            error.message,
                            true
                        );
                    }
                }
            );

        modal.body.appendChild(
            button
        );
    }

    function openCommunityIntent(
        transition
    ) {
        const modal =
            modalShell(
                'Confirm Your Desire to Belong',
                'A fresh personal response for this season.'
            );

        modal.body.appendChild(
            el(
                'p',
                '',
                'Your history with FOG remains recognized. This response simply tells the community how you desire to journey with us now.'
            )
        );

        const choices = [
            [
                'yes',
                'I Desire to Journey With FOG'
            ],
            [
                'discerning',
                'I’m Still Discerning'
            ],
            [
                'not_now',
                'Not at This Time'
            ]
        ];

        let selected =
            transition.intake &&
            transition.intake
                .community_intent_choice
                ? transition
                    .intake
                    .community_intent_choice
                : null;

        const options =
            el(
                'div',
                'member-transition-journey-options'
            );

        choices.forEach(
            ([value, labelText]) => {
                const label =
                    el(
                        'label',
                        'member-transition-journey-option'
                    );

                const radio =
                    el('input');

                radio.type =
                    'radio';

                radio.name =
                    'memberTransitionCommunityIntent';

                radio.value =
                    value;

                radio.checked =
                    selected === value;

                radio.addEventListener(
                    'change',
                    () => {
                        selected =
                            value;
                    }
                );

                label.appendChild(
                    radio
                );

                label.appendChild(
                    el(
                        'span',
                        '',
                        labelText
                    )
                );

                options.appendChild(
                    label
                );
            }
        );

        modal.body.appendChild(
            options
        );

        modal.body.appendChild(
            fieldLabel(
                'Optional reflection'
            )
        );

        const reflection =
            textarea(
                'Share anything you would like leadership to know.'
            );

        modal.body.appendChild(
            reflection
        );

        const button =
            actionButton(
                'Save My Response',
                async () => {
                    if (!selected) {
                        setStatus(
                            modal.status,
                            'Please choose one response.',
                            true
                        );

                        return;
                    }

                    button.disabled =
                        true;

                    try {
                        const response =
                            await requestJson(
                                '/api/member-transition/me/community-intent',
                                {
                                    method:
                                        'POST',

                                    body:
                                        JSON.stringify({
                                            choice:
                                                selected,

                                            statement_text:
                                                reflection
                                                    .value
                                                    .trim() ||
                                                null
                                        })
                                }
                            );

                        await refreshAfterMutation(
                            response
                        );

                        clearModal();
                    } catch (error) {
                        button.disabled =
                            false;

                        setStatus(
                            modal.status,
                            error.message,
                            true
                        );
                    }
                }
            );

        modal.body.appendChild(
            button
        );
    }

    function openPriority(
        transition
    ) {
        const modal =
            modalShell(
                'Choose Your Priority Ministry',
                'Your primary place of service, formation, and accountability.'
            );

        modal.body.appendChild(
            el(
                'p',
                '',
                'Choosing a Priority Ministry does not remove your other ministry memberships. It simply identifies the ministry that will anchor your service journey.'
            )
        );

        const list =
            candidates(
                transition
            );

        if (!list.length) {
            modal.body.appendChild(
                el(
                    'p',
                    'member-transition-journey-note',
                    'No eligible current ministry relationship is available yet. Leadership will need to verify your ministry record.'
                )
            );

            return;
        }

        let selectedMapping =
            null;

        const options =
            el(
                'div',
                'member-transition-journey-options'
            );

        list.forEach(
            item => {
                const label =
                    el(
                        'label',
                        'member-transition-journey-option'
                    );

                const radio =
                    el('input');

                radio.type =
                    'radio';

                radio.name =
                    'memberTransitionPriority';

                radio.value =
                    String(
                        item.mapping_id
                    );

                /*
                 * Existing canonical Priority may be displayed.
                 * When no canonical Priority exists, even a single
                 * candidate requires an explicit member choice.
                 */
                radio.checked =
                    Number(
                        item.is_priority
                    ) === 1;

                if (
                    radio.checked
                ) {
                    selectedMapping =
                        Number(
                            item.mapping_id
                        );
                }

                radio.addEventListener(
                    'change',
                    () => {
                        selectedMapping =
                            Number(
                                item.mapping_id
                            );
                    }
                );

                const copy =
                    el('span');

                copy.appendChild(
                    el(
                        'strong',
                        '',
                        item.ministry_name
                    )
                );

                if (
                    item.role ||
                    item.sub_role
                ) {
                    copy.appendChild(
                        el(
                            'small',
                            '',
                            [
                                item.role,
                                item.sub_role
                            ]
                                .filter(Boolean)
                                .join(' · ')
                        )
                    );
                }

                label.appendChild(
                    radio
                );

                label.appendChild(
                    copy
                );

                options.appendChild(
                    label
                );
            }
        );

        modal.body.appendChild(
            options
        );

        const button =
            actionButton(
                'Confirm Priority Ministry',
                async () => {
                    if (
                        !selectedMapping
                    ) {
                        setStatus(
                            modal.status,
                            'Please choose one Priority Ministry.',
                            true
                        );

                        return;
                    }

                    button.disabled =
                        true;

                    try {
                        const response =
                            await requestJson(
                                `/api/member-transition/me/priority/${selectedMapping}`,
                                {
                                    method:
                                        'POST'
                                }
                            );

                        await refreshAfterMutation(
                            response
                        );

                        clearModal();
                    } catch (error) {
                        button.disabled =
                            false;

                        setStatus(
                            modal.status,
                            error.message,
                            true
                        );
                    }
                }
            );

        modal.body.appendChild(
            button
        );
    }

    function openDiscernment(
        transition
    ) {
        const priority =
            priorityName(
                transition
            );

        const modal =
            modalShell(
                'Begin Ministry Discernment',
                priority
                    ? `Priority Ministry: ${priority}`
                    : 'Walk prayerfully with your Priority Ministry.'
            );

        modal.body.appendChild(
            el(
                'p',
                '',
                'Discernment is a prayerful conversation, not an automatic ministry appointment or role change.'
            )
        );

        modal.body.appendChild(
            fieldLabel(
                'Why do you feel invited to continue or deepen your service here?'
            )
        );

        const intent =
            textarea(
                'Share your desire for this ministry.'
            );

        modal.body.appendChild(
            intent
        );

        modal.body.appendChild(
            fieldLabel(
                'Gifts or experience'
            )
        );

        const gifts =
            textarea(
                'Optional'
            );

        modal.body.appendChild(
            gifts
        );

        modal.body.appendChild(
            fieldLabel(
                'What growth are you hoping for?'
            )
        );

        const growth =
            textarea(
                'Optional'
            );

        modal.body.appendChild(
            growth
        );

        modal.body.appendChild(
            fieldLabel(
                'Availability'
            )
        );

        const availability =
            el('input');

        availability.type =
            'text';

        availability.placeholder =
            'Optional';

        modal.body.appendChild(
            availability
        );

        const conversationLabel =
            el(
                'label',
                'member-transition-journey-check'
            );

        const conversation =
            el('input');

        conversation.type =
            'checkbox';

        conversation.checked =
            true;

        conversationLabel.appendChild(
            conversation
        );

        conversationLabel.appendChild(
            el(
                'span',
                '',
                'I would welcome a conversation with a ministry leader.'
            )
        );

        modal.body.appendChild(
            conversationLabel
        );

        const button =
            actionButton(
                'Submit Discernment Intent',
                async () => {
                    const intentText =
                        intent
                            .value
                            .trim();

                    if (!intentText) {
                        setStatus(
                            modal.status,
                            'Please share your ministry discernment intent.',
                            true
                        );

                        return;
                    }

                    button.disabled =
                        true;

                    try {
                        const response =
                            await requestJson(
                                '/api/member-transition/me/discernment',
                                {
                                    method:
                                        'POST',

                                    body:
                                        JSON.stringify({
                                            intent_text:
                                                intentText,

                                            availability:
                                                availability
                                                    .value
                                                    .trim() ||
                                                null,

                                            gifts_text:
                                                gifts
                                                    .value
                                                    .trim() ||
                                                null,

                                            growth_hopes_text:
                                                growth
                                                    .value
                                                    .trim() ||
                                                null,

                                            wants_leader_conversation:
                                                conversation
                                                    .checked
                                        })
                                }
                            );

                        await refreshAfterMutation(
                            response
                        );

                        clearModal();
                    } catch (error) {
                        button.disabled =
                            false;

                        setStatus(
                            modal.status,
                            error.message,
                            true
                        );
                    }
                }
            );

        modal.body.appendChild(
            button
        );
    }

    function openDiscernmentStatus(
        transition
    ) {
        const openCase =
            transition.discernment &&
            transition.discernment
                .open_case;

        const modal =
            modalShell(
                'Ministry Discernment',
                priorityName(
                    transition
                ) || ''
            );

        if (openCase) {
            modal.body.appendChild(
                el(
                    'p',
                    'member-transition-journey-note',
                    `Current status: ${String(openCase.status || 'in progress').replaceAll('_', ' ')}`
                )
            );
        }

        const events =
            transition.discernment &&
            Array.isArray(
                transition.discernment
                    .member_visible_events
            )
                ? transition
                    .discernment
                    .member_visible_events
                : [];

        if (!events.length) {
            modal.body.appendChild(
                el(
                    'p',
                    '',
                    'Your discernment has been received. Leadership updates that are meant for you will appear here.'
                )
            );

            return;
        }

        const list =
            el(
                'div',
                'member-transition-journey-events'
            );

        events.forEach(
            event => {
                const item =
                    el(
                        'article',
                        'member-transition-journey-event'
                    );

                item.appendChild(
                    el(
                        'strong',
                        '',
                        String(
                            event.event_type ||
                            'Update'
                        )
                            .replaceAll(
                                '_',
                                ' '
                            )
                    )
                );

                if (
                    event.created_at
                ) {
                    item.appendChild(
                        el(
                            'small',
                            '',
                            event.created_at
                        )
                    );
                }

                list.appendChild(
                    item
                );
            }
        );

        modal.body.appendChild(
            list
        );
    }

    function openAction(
        transition
    ) {
        switch (
            transition.next_action
        ) {
        case 'initialize_transition':
            openInitialize(
                transition
            );
            break;

        case 'community_intent':
            openCommunityIntent(
                transition
            );
            break;

        case 'priority_ministry':
            openPriority(
                transition
            );
            break;

        case 'ministry_discernment':
            openDiscernment(
                transition
            );
            break;

        case 'discernment_in_progress':
            openDiscernmentStatus(
                transition
            );
            break;

        default:
            break;
        }
    }

    function renderCallout(
        card,
        transition
    ) {
        const existing =
            card.querySelector(
                '.member-transition-journey-callout'
            );

        if (
            !ACTIONS.has(
                transition.next_action
            )
        ) {
            if (existing) {
                existing.remove();
            }

            return null;
        }

        const copy =
            copyFor(
                transition
            );

        if (!copy) {
            if (existing) {
                existing.remove();
            }

            return null;
        }

        const key =
            visualKey(
                transition
            );

        if (
            existing &&
            existing.dataset
                .transitionJourneyKey ===
                key
        ) {
            return existing;
        }

        const box =
            el(
                'section',
                'member-transition-journey-callout'
            );

        box.dataset
            .transitionJourneyKey =
                key;

        box.appendChild(
            el(
                'span',
                'member-transition-journey-callout__eyebrow',
                copy.eyebrow
            )
        );

        box.appendChild(
            el(
                'h3',
                '',
                copy.title
            )
        );

        box.appendChild(
            el(
                'p',
                '',
                copy.description
            )
        );

        const button =
            el(
                'button',
                copy.actionable
                    ? 'member-transition-journey-primary'
                    : 'member-transition-journey-secondary',
                copy.button
            );

        button.type =
            'button';

        button.disabled =
            !copy.actionable;

        if (
            copy.actionable
        ) {
            button.addEventListener(
                'click',
                () =>
                    openAction(
                        transition
                    )
            );
        }

        box.appendChild(
            button
        );

        if (existing) {
            existing.replaceWith(
                box
            );
        } else {
            card.appendChild(
                box
            );
        }

        return box;
    }

    async function refreshCard(
        options = {}
    ) {
        const card =
            document.getElementById(
                'journeyGrowthCard'
            );

        if (!card) {
            return null;
        }

        const existing =
            card.querySelector(
                '.member-transition-journey-callout'
            );

        if (
            window.koinoniaAuthStatus !==
            'authenticated'
        ) {
            if (existing) {
                existing.remove();
            }

            return null;
        }

        try {
            let transition =
                options.transition &&
                typeof options.transition ===
                    'object'
                    ? options.transition
                    : null;

            if (transition) {
                rememberTransition(
                    transition
                );
            } else {
                transition =
                    await loadTransition(
                        options.force ===
                            true
                    );
            }

            if (
                !transition ||
                !ACTIONS.has(
                    transition.next_action
                )
            ) {
                if (existing) {
                    existing.remove();
                }

                return transition;
            }

            renderCallout(
                card,
                transition
            );

            return transition;
        } catch (_) {
            /*
             * Keep a valid existing transition callout visible during
             * transient refresh failures instead of creating UI churn.
             */
            return state.transition;
        }
    }

    window.MemberTransitionJourneyUI =
        Object.freeze({
            refreshCard,
            close:
                clearModal
        });
})();
