(function () {
    'use strict';

    const API =
        '/api/admin/member-transitions';

    const state = {
        list: [],
        selectedId: null,
        detail: null,
        loading: false
    };

    const ANSWER_LABELS = Object.freeze({
        preferred_name: 'Preferred Name',
        email: 'Email',
        area_address: 'Area / Address',
        gender: 'Gender',
        current_connection: 'Current Connection With FOG',
        approximate_start: 'Journey With FOG Began',
        activities_history: 'FOG Activities / Journey History',
        prior_formal_commitment: 'Previous Formal Commitment',
        prior_commitment_when: 'Commitment When',
        current_belonging_disposition: 'Current Desire to Belong',
        current_invitation: 'Current Invitation',
        leader_conversation_preference: 'Leader Conversation Preference',
        attestation_confirmed: 'Attestation Confirmed'
    });

    const STATUS_LABELS = Object.freeze({
        draft: 'Draft',
        submitted: 'Submitted',
        under_review: 'Under Review',
        needs_changes: 'Needs Changes',
        approved: 'Approved — Awaiting Recognition',
        recognized: 'Recognized',
        closed: 'Closed'
    });

    const STANDING_LABELS = Object.freeze({
        none: 'No Historical Standing',
        formal_member: 'Formal Member',
        active_servant: 'Active Servant'
    });

    function byId(id) {
        return document.getElementById(id);
    }

    function el(tag, className, text) {
        const node =
            document.createElement(tag);

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

    function normalizeText(value) {
        if (
            value === undefined ||
            value === null
        ) {
            return '';
        }

        return String(value).trim();
    }

    function safeJson(value, fallback = {}) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            return value;
        }

        if (
            typeof value !== 'string' ||
            !value.trim()
        ) {
            return fallback;
        }

        try {
            const parsed =
                JSON.parse(value);

            return (
                parsed &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed)
            )
                ? parsed
                : fallback;
        } catch (_) {
            return fallback;
        }
    }

    function humanize(value) {
        return normalizeText(value)
            .replace(/_/g, ' ')
            .replace(
                /\b\w/g,
                letter =>
                    letter.toUpperCase()
            );
    }

    function statusLabel(status) {
        return (
            STATUS_LABELS[status] ||
            humanize(status) ||
            'Unknown'
        );
    }

    function hasReviewPermission() {
        return (
            typeof window.hasPerm ===
                'function' &&
            window.hasPerm(
                'access_discipleship'
            ) &&
            window.hasPerm(
                'edit_entries'
            )
        );
    }

    function setStatus(
        message,
        kind = 'info'
    ) {
        const node =
            byId(
                'memberJourneyReviewStatus'
            );

        if (!node) return;

        node.textContent =
            message || '';

        node.className =
            'member-journey-review-status ' +
            (
                message
                    ? `is-${kind}`
                    : ''
            );
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

        let payload = null;

        try {
            payload =
                await response.json();
        } catch (_) {
            payload = null;
        }

        if (!response.ok) {
            const message =
                payload &&
                typeof payload.error ===
                    'string'
                    ? payload.error
                    : payload &&
                      typeof payload.message ===
                        'string'
                        ? payload.message
                        : 'The request could not be completed.';

            const error =
                new Error(message);

            error.status =
                response.status;

            throw error;
        }

        return payload || {};
    }

    function button(
        label,
        className,
        handler
    ) {
        const node =
            el(
                'button',
                className,
                label
            );

        node.type =
            'button';

        node.addEventListener(
            'click',
            handler
        );

        return node;
    }

    function clear(node) {
        while (
            node &&
            node.firstChild
        ) {
            node.removeChild(
                node.firstChild
            );
        }
    }

    function formatDate(value) {
        const text =
            normalizeText(value);

        if (!text) {
            return '—';
        }

        const parsed =
            new Date(
                text.includes('T')
                    ? text
                    : text.replace(
                        ' ',
                        'T'
                    ) + 'Z'
            );

        if (
            Number.isNaN(
                parsed.getTime()
            )
        ) {
            return text;
        }

        return parsed
            .toLocaleString();
    }

    function field(
        label,
        value
    ) {
        const wrapper =
            el(
                'div',
                'member-journey-review-field'
            );

        wrapper.appendChild(
            el(
                'div',
                'member-journey-review-field__label',
                label
            )
        );

        wrapper.appendChild(
            el(
                'div',
                'member-journey-review-field__value',
                normalizeText(value) ||
                    '—'
            )
        );

        return wrapper;
    }

    function renderList() {
        const container =
            byId(
                'memberJourneyReviewList'
            );

        if (!container) return;

        clear(container);

        const adult =
            state.list.filter(
                item =>
                    item &&
                    item.intake_kind ===
                        'adult_historical'
            );

        if (!adult.length) {
            container.appendChild(
                el(
                    'div',
                    'member-journey-review-empty-state',
                    'No Adult Member Intakes are available for review.'
                )
            );

            return;
        }

        for (const item of adult) {
            const card =
                el(
                    'button',
                    'member-journey-review-list-item'
                );

            card.type =
                'button';

            if (
                Number(item.id) ===
                Number(
                    state.selectedId
                )
            ) {
                card.classList.add(
                    'is-selected'
                );
            }

            const top =
                el(
                    'div',
                    'member-journey-review-list-item__top'
                );

            top.appendChild(
                el(
                    'strong',
                    '',
                    item.member_name ||
                        `Member ${item.youth_id}`
                )
            );

            const badge =
                el(
                    'span',
                    'member-journey-review-badge',
                    statusLabel(
                        item.status
                    )
                );

            badge.dataset.status =
                item.status || '';

            top.appendChild(
                badge
            );

            card.appendChild(top);

            card.appendChild(
                el(
                    'div',
                    'member-journey-review-list-item__meta',
                    [
                        item.member_code,
                        item.member_email
                    ]
                        .filter(Boolean)
                        .join(' • ')
                )
            );

            card.appendChild(
                el(
                    'div',
                    'member-journey-review-list-item__date',
                    item.submitted_at
                        ? `Submitted ${formatDate(item.submitted_at)}`
                        : 'Not yet submitted'
                )
            );

            card.addEventListener(
                'click',
                () =>
                    selectIntake(
                        item.id
                    )
            );

            container.appendChild(
                card
            );
        }
    }

    function answerObject(intake) {
        if (
            intake &&
            intake.answers &&
            typeof intake.answers ===
                'object'
        ) {
            return intake.answers;
        }

        return safeJson(
            intake &&
                intake.answers_json,
            {}
        );
    }

    function renderAnswers(
        parent,
        intake
    ) {
        const answers =
            answerObject(intake);

        const section =
            el(
                'section',
                'member-journey-review-section'
            );

        section.appendChild(
            el(
                'h3',
                '',
                'Member Journey Story'
            )
        );

        const grid =
            el(
                'div',
                'member-journey-review-grid'
            );

        const keys =
            Object.keys(answers);

        if (!keys.length) {
            grid.appendChild(
                el(
                    'p',
                    'member-journey-review-muted',
                    'No questionnaire answers are available.'
                )
            );
        }

        for (const key of keys) {
            const value =
                answers[key];

            let display = value;

            if (
                typeof value ===
                'boolean'
            ) {
                display =
                    value
                        ? 'Yes'
                        : 'No';
            } else if (
                value &&
                typeof value ===
                    'object'
            ) {
                display =
                    JSON.stringify(value);
            }

            grid.appendChild(
                field(
                    ANSWER_LABELS[key] ||
                        humanize(key),
                    display
                )
            );
        }

        section.appendChild(grid);
        parent.appendChild(section);
    }

    function renderMinistries(
        parent,
        ministries
    ) {
        const section =
            el(
                'section',
                'member-journey-review-section'
            );

        section.appendChild(
            el(
                'h3',
                '',
                'Self-Reported Ministry History'
            )
        );

        if (
            !Array.isArray(ministries) ||
            !ministries.length
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-muted',
                    'No ministry history was reported.'
                )
            );

            parent.appendChild(section);
            return;
        }

        for (const ministry of ministries) {
            const card =
                el(
                    'div',
                    'member-journey-review-ministry'
                );

            const title =
                el(
                    'div',
                    'member-journey-review-ministry__title'
                );

            title.appendChild(
                el(
                    'strong',
                    '',
                    ministry
                        .ministry_name_snapshot ||
                        'Unnamed Ministry'
                )
            );

            if (
                Number(
                    ministry
                        .selected_priority
                ) === 1
            ) {
                title.appendChild(
                    el(
                        'span',
                        'member-journey-review-priority',
                        'Reported Priority'
                    )
                );
            }

            card.appendChild(title);

            const details =
                [
                    ministry.service_state &&
                        `Service: ${humanize(ministry.service_state)}`,

                    ministry.reported_role &&
                        `Role: ${ministry.reported_role}`,

                    ministry.started_when &&
                        `Since: ${ministry.started_when}`,

                    ministry.assignment_kind &&
                        `Assignment: ${humanize(ministry.assignment_kind)}`,

                    Number(
                        ministry
                            .wants_discernment
                    ) === 1 &&
                        'Wants discernment'
                ]
                    .filter(Boolean)
                    .join(' • ');

            card.appendChild(
                el(
                    'div',
                    'member-journey-review-muted',
                    details || 'No additional details'
                )
            );

            if (ministry.notes) {
                card.appendChild(
                    el(
                        'p',
                        'member-journey-review-ministry__notes',
                        ministry.notes
                    )
                );
            }

            section.appendChild(card);
        }

        parent.appendChild(section);
    }

    function latestReview(reviews) {
        if (
            !Array.isArray(reviews) ||
            !reviews.length
        ) {
            return null;
        }

        return reviews[
            reviews.length - 1
        ];
    }

    function renderReviewHistory(
        parent,
        reviews,
        recognition
    ) {
        const section =
            el(
                'section',
                'member-journey-review-section'
            );

        section.appendChild(
            el(
                'h3',
                '',
                'Leadership Review History'
            )
        );

        if (
            !Array.isArray(reviews) ||
            !reviews.length
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-muted',
                    'No leadership decision has been recorded yet.'
                )
            );
        } else {
            for (const review of reviews) {
                const card =
                    el(
                        'div',
                        'member-journey-review-history'
                    );

                card.appendChild(
                    el(
                        'strong',
                        '',
                        humanize(
                            review.decision
                        )
                    )
                );

                const proposed =
                    review
                        .proposed_standing
                        ? (
                            STANDING_LABELS[
                                review
                                    .proposed_standing
                            ] ||
                            humanize(
                                review
                                    .proposed_standing
                            )
                        )
                        : null;

                card.appendChild(
                    el(
                        'div',
                        'member-journey-review-muted',
                        [
                            proposed &&
                                `Proposed standing: ${proposed}`,
                            review
                                .reviewer_name &&
                                `By ${review.reviewer_name}`,
                            review
                                .created_at &&
                                formatDate(
                                    review.created_at
                                )
                        ]
                            .filter(Boolean)
                            .join(' • ')
                    )
                );

                if (review.notes) {
                    card.appendChild(
                        el(
                            'p',
                            '',
                            review.notes
                        )
                    );
                }

                section.appendChild(
                    card
                );
            }
        }

        if (recognition) {
            const recognized =
                el(
                    'div',
                    'member-journey-review-recognition'
                );

            recognized.appendChild(
                el(
                    'strong',
                    '',
                    'Historical Standing Recognized'
                )
            );

            recognized.appendChild(
                el(
                    'div',
                    'member-journey-review-muted',
                    [
                        recognition
                            .recognized_standing &&
                            (
                                STANDING_LABELS[
                                    recognition
                                        .recognized_standing
                                ] ||
                                humanize(
                                    recognition
                                        .recognized_standing
                                )
                            ),
                        recognition
                            .recognized_by_name &&
                            `By ${recognition.recognized_by_name}`,
                        recognition
                            .created_at &&
                            formatDate(
                                recognition.created_at
                            )
                    ]
                        .filter(Boolean)
                        .join(' • ')
                )
            );

            section.appendChild(
                recognized
            );
        }

        parent.appendChild(section);
    }

    function textareaField(
        label,
        placeholder
    ) {
        const wrapper =
            el(
                'label',
                'member-journey-review-form-field'
            );

        wrapper.appendChild(
            el(
                'span',
                '',
                label
            )
        );

        const input =
            document.createElement(
                'textarea'
            );

        input.rows = 3;
        input.placeholder =
            placeholder || '';

        wrapper.appendChild(input);

        return {
            wrapper,
            input
        };
    }

    async function mutate(
        url,
        body,
        successMessage
    ) {
        setStatus(
            'Saving leadership action…',
            'info'
        );

        try {
            await requestJson(
                url,
                {
                    method: 'POST',

                    ...(
                        body === undefined
                            ? {}
                            : {
                                body:
                                    JSON.stringify(
                                        body
                                    )
                            }
                    )
                }
            );

            setStatus(
                successMessage,
                'success'
            );

            await loadList({
                preserveSelection:
                    true
            });

            if (state.selectedId) {
                await selectIntake(
                    state.selectedId,
                    {
                        silent:
                            true
                    }
                );
            }

            return true;
        } catch (error) {
            setStatus(
                error.message ||
                    'Leadership action failed.',
                'error'
            );

            return false;
        }
    }

    function renderActions(
        parent,
        payload
    ) {
        const intake =
            payload.intake || {};

        const reviews =
            Array.isArray(
                payload.reviews
            )
                ? payload.reviews
                : [];

        const recognition =
            payload.recognition ||
            null;

        const latest =
            latestReview(reviews);

        const section =
            el(
                'section',
                'member-journey-review-section member-journey-review-actions'
            );

        section.appendChild(
            el(
                'h3',
                '',
                'Leadership Action'
            )
        );

        if (
            intake.intake_kind !==
            'adult_historical'
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-warning',
                    'Historical recognition is available only for Adult Historical Intake.'
                )
            );

            parent.appendChild(section);
            return;
        }

        if (
            intake.status ===
            'submitted'
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-muted',
                    'Begin review before recording a leadership decision.'
                )
            );

            section.appendChild(
                button(
                    'Start Review',
                    'btn btn-primary member-journey-review-primary',
                    async () => {
                        await mutate(
                            `${API}/${intake.id}/review/start`,
                            undefined,
                            'Review started.'
                        );
                    }
                )
            );

            parent.appendChild(section);
            return;
        }

        if (
            intake.status ===
            'under_review'
        ) {
            const notes =
                textareaField(
                    'Leadership Notes',
                    'Record a concise pastoral review note.'
                );

            section.appendChild(
                notes.wrapper
            );

            const actions =
                el(
                    'div',
                    'member-journey-review-action-row'
                );

            actions.appendChild(
                button(
                    'Request Changes',
                    'btn btn-outline member-journey-review-secondary',
                    async () => {
                        const value =
                            notes.input.value.trim();

                        if (!value) {
                            setStatus(
                                'Add a clear note explaining what the member needs to update.',
                                'error'
                            );

                            notes.input.focus();
                            return;
                        }

                        await mutate(
                            `${API}/${intake.id}/review/needs-changes`,
                            {
                                decision_data: {
                                    reason:
                                        value
                                },
                                notes:
                                    value
                            },
                            'Changes requested from the member.'
                        );
                    }
                )
            );

            const approval =
                el(
                    'div',
                    'member-journey-review-approval'
                );

            const standingLabel =
                el(
                    'label',
                    'member-journey-review-form-field'
                );

            standingLabel.appendChild(
                el(
                    'span',
                    '',
                    'Historical Standing to Approve'
                )
            );

            const select =
                document.createElement(
                    'select'
                );

            select.appendChild(
                new Option(
                    'Choose standing…',
                    ''
                )
            );

            select.appendChild(
                new Option(
                    'Formal Member',
                    'formal_member'
                )
            );

            select.appendChild(
                new Option(
                    'Active Servant',
                    'active_servant'
                )
            );

            select.appendChild(
                new Option(
                    'No Historical Standing',
                    'none'
                )
            );

            standingLabel.appendChild(
                select
            );

            approval.appendChild(
                standingLabel
            );

            approval.appendChild(
                button(
                    'Approve Historical Standing',
                    'btn btn-primary member-journey-review-primary',
                    async () => {
                        if (!select.value) {
                            setStatus(
                                'Choose the historical standing being approved.',
                                'error'
                            );

                            select.focus();
                            return;
                        }

                        await mutate(
                            `${API}/${intake.id}/review/approve`,
                            {
                                proposed_standing:
                                    select.value,

                                decision_data: {
                                    source:
                                        'member_journey_review_ui'
                                },

                                notes:
                                    notes.input
                                        .value
                                        .trim() ||
                                    null
                            },
                            'Review approved. Recognition is still pending.'
                        );
                    }
                )
            );

            section.appendChild(
                actions
            );

            section.appendChild(
                approval
            );

            parent.appendChild(section);
            return;
        }

        if (
            intake.status ===
            'needs_changes'
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-warning',
                    'Changes have been requested. Wait for the member to update and resubmit the Adult Intake before reviewing again.'
                )
            );

            parent.appendChild(section);
            return;
        }

        if (
            intake.status ===
            'approved'
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-warning',
                    'Approval records the leadership proposal only. Historical standing has not yet been recognized.'
                )
            );

            if (
                latest &&
                latest.decision ===
                    'approved' &&
                !recognition
            ) {
                const proposed =
                    STANDING_LABELS[
                        latest
                            .proposed_standing
                    ] ||
                    humanize(
                        latest
                            .proposed_standing
                    );

                section.appendChild(
                    el(
                        'p',
                        '',
                        `Approved proposal: ${proposed || '—'}`
                    )
                );

                section.appendChild(
                    button(
                        'Recognize Historical Standing',
                        'btn btn-primary member-journey-review-recognize',
                        async () => {
                            const confirmed =
                                window.confirm(
                                    'Recognize this approved historical standing now? This is a separate canonical leadership action.'
                                );

                            if (!confirmed) {
                                return;
                            }

                            await mutate(
                                `${API}/${intake.id}/reviews/${latest.id}/recognize`,
                                {},
                                'Historical standing recognized.'
                            );
                        }
                    )
                );
            }

            parent.appendChild(section);
            return;
        }

        if (
            intake.status ===
            'recognized' ||
            recognition
        ) {
            section.appendChild(
                el(
                    'p',
                    'member-journey-review-success',
                    'Historical standing has been recognized. No further review action is required.'
                )
            );

            parent.appendChild(section);
            return;
        }

        section.appendChild(
            el(
                'p',
                'member-journey-review-muted',
                `No leadership action is available while this intake is ${statusLabel(intake.status)}.`
            )
        );

        parent.appendChild(section);
    }

    function renderDetail(payload) {
        const container =
            byId(
                'memberJourneyReviewDetail'
            );

        if (!container) return;

        clear(container);

        const intake =
            payload &&
            payload.intake
                ? payload.intake
                : null;

        if (!intake) {
            container.appendChild(
                el(
                    'div',
                    'member-journey-review-empty-state',
                    'Select an Adult Member Intake to review.'
                )
            );

            return;
        }

        const header =
            el(
                'div',
                'member-journey-review-detail-header'
            );

        header.appendChild(
            el(
                'h2',
                '',
                intake.member_name ||
                    `Member ${intake.youth_id}`
            )
        );

        const badge =
            el(
                'span',
                'member-journey-review-badge',
                statusLabel(
                    intake.status
                )
            );

        badge.dataset.status =
            intake.status || '';

        header.appendChild(badge);

        container.appendChild(header);

        const meta =
            el(
                'div',
                'member-journey-review-grid member-journey-review-summary'
            );

        meta.appendChild(
            field(
                'Member Code',
                intake.member_code
            )
        );

        meta.appendChild(
            field(
                'Email',
                intake.member_email
            )
        );

        meta.appendChild(
            field(
                'Service State',
                humanize(
                    intake.service_state
                )
            )
        );

        meta.appendChild(
            field(
                'Submitted',
                formatDate(
                    intake.submitted_at
                )
            )
        );

        meta.appendChild(
            field(
                'Review Started',
                formatDate(
                    intake.review_started_at
                )
            )
        );

        meta.appendChild(
            field(
                'Recognized',
                formatDate(
                    intake.recognized_at
                )
            )
        );

        container.appendChild(meta);

        renderAnswers(
            container,
            intake
        );

        renderMinistries(
            container,
            payload
                .reported_ministries
        );

        renderReviewHistory(
            container,
            payload.reviews,
            payload.recognition
        );

        renderActions(
            container,
            payload
        );
    }

    async function selectIntake(
        intakeId,
        options = {}
    ) {
        const id =
            Number(intakeId);

        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {
            return;
        }

        state.selectedId =
            id;

        renderList();

        if (!options.silent) {
            setStatus(
                'Loading Adult Member Intake…',
                'info'
            );
        }

        try {
            const payload =
                await requestJson(
                    `${API}/${id}`
                );

            state.detail =
                payload;

            renderDetail(payload);

            if (!options.silent) {
                setStatus('', 'info');
            }
        } catch (error) {
            state.detail =
                null;

            renderDetail(null);

            setStatus(
                error.message ||
                    'Unable to load this Adult Member Intake.',
                'error'
            );
        }
    }

    async function loadList(
        options = {}
    ) {
        if (state.loading) {
            return;
        }

        state.loading =
            true;

        if (!options.silent) {
            setStatus(
                'Loading Adult Member Intakes…',
                'info'
            );
        }

        try {
            const payload =
                await requestJson(
                    API
                );

            state.list =
                Array.isArray(
                    payload.intakes
                )
                    ? payload.intakes
                    : [];

            renderList();

            if (
                !options.preserveSelection &&
                !state.selectedId
            ) {
                const first =
                    state.list.find(
                        item =>
                            item &&
                            item
                                .intake_kind ===
                                'adult_historical'
                    );

                if (first) {
                    await selectIntake(
                        first.id,
                        {
                            silent:
                                true
                        }
                    );
                }
            }

            if (!options.silent) {
                setStatus('', 'info');
            }
        } catch (error) {
            state.list = [];
            renderList();

            setStatus(
                error.message ||
                    'Unable to load Member Journey Review.',
                'error'
            );
        } finally {
            state.loading =
                false;
        }
    }

    function activatePanel() {
        const admin =
            byId(
                'discipleshipAdminTab'
            );

        const panel =
            byId(
                'subTabAdminMemberJourney'
            );

        const buttonNode =
            byId(
                'btnSubAdminMemberJourney'
            );

        if (
            !admin ||
            !panel ||
            !buttonNode
        ) {
            return false;
        }

        admin
            .querySelectorAll(
                '.discipleship-admin-sub-tab'
            )
            .forEach(
                node => {
                    node.classList.remove(
                        'active'
                    );

                    node.style.display =
                        'none';
                }
            );

        admin
            .querySelectorAll(
                '.sub-nav > .sub-nav-btn'
            )
            .forEach(
                node =>
                    node.classList.remove(
                        'active'
                    )
            );

        panel.style.display =
            'block';

        panel.classList.add(
            'active'
        );

        buttonNode.classList.add(
            'active'
        );

        return true;
    }

    async function open() {
        if (!hasReviewPermission()) {
            setStatus(
                'You do not have permission to review Adult Member Intakes.',
                'error'
            );

            return;
        }

        if (!activatePanel()) {
            return;
        }

        await loadList();
    }

    function refreshPermissionVisibility() {
        const buttonNode =
            byId(
                'btnSubAdminMemberJourney'
            );

        if (!buttonNode) {
            return;
        }

        buttonNode.style.display =
            hasReviewPermission()
                ? ''
                : 'none';
    }

    window.MemberTransitionLeadershipUI =
        Object.freeze({
            open,
            loadList,
            selectIntake,
            refreshPermissionVisibility
        });

    function schedulePermissionVisibilityRefresh() {
        refreshPermissionVisibility();

        /*
         * Authentication/permission state may be restored shortly
         * after DOMContentLoaded. Keep the leadership button hidden
         * by default and re-check only for a short bounded window.
         */
        [
            250,
            750,
            1500,
            3000
        ].forEach(
            delay => {
                window.setTimeout(
                    refreshPermissionVisibility,
                    delay
                );
            }
        );
    }

    document.addEventListener(
        'DOMContentLoaded',
        schedulePermissionVisibilityRefresh
    );

    window.addEventListener(
        'member-auth-updated',
        refreshPermissionVisibility
    );
})();
