'use strict';

(() => {
    const TRANSITION_URL =
        '/api/member-transition/me';

    const INTAKE_URL =
        '/api/member-transition/me/intake';

    const DRAFT_URL =
        '/api/member-transition/me/intake/draft';

    const SUBMIT_URL =
        '/api/member-transition/me/intake/submit';

    const STEPS = Object.freeze([
        'About You',
        'Journey With FOG',
        'Membership History',
        'Ministry History',
        'Priority Ministry',
        'Ministry Discernment',
        'Previous Formation',
        'Current Invitation',
        'Review & Attestation'
    ]);

    const adultActions = new Set([
        'adult_intake_questionnaire',
        'adult_intake_submitted',
        'adult_intake_under_review',
        'adult_intake_awaiting_recognition'
    ]);

    const state = {
        transition: null,
        transitionLoadedAt: 0,
        transitionMemberId: null,
        intakePayload: null,
        model: null,
        step: 0,
        busy: false
    };

    function el(tag, className = '', text = null) {
        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== null && text !== undefined) {
            node.textContent = String(text);
        }

        return node;
    }

    function clear(node) {
        while (node && node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function currentMemberSafe() {
        return (
            typeof window.currentMember !== 'undefined' &&
            window.currentMember
        )
            ? window.currentMember
            : {};
    }

    async function requestJson(url, options = {}) {
        const response = await window.fetch(
            url,
            {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                    ...(options.body
                        ? {
                            'Content-Type':
                                'application/json'
                        }
                        : {}),
                    ...(options.headers || {})
                },
                ...options
            }
        );

        const body =
            await response
                .json()
                .catch(() => ({}));

        if (
            !response.ok ||
            body.success === false
        ) {
            const error =
                new Error(
                    body.error ||
                    'The request could not be completed.'
                );

            error.code =
                body.code || null;

            error.status =
                response.status;

            throw error;
        }

        return body;
    }

    function normalizeModel(payload) {
        const member =
            currentMemberSafe();

        const answers = {
            ...(
                payload &&
                payload.intake &&
                payload.intake.answers
                    ? payload.intake.answers
                    : {}
            )
        };

        if (
            !answers.birthday &&
            member.birthday
        ) {
            answers.birthday =
                member.birthday;
        }

        if (
            !answers.email &&
            member.email
        ) {
            answers.email =
                member.email;
        }

        if (
            !answers.mobile &&
            member.mobile
        ) {
            answers.mobile =
                member.mobile;
        }

        const ministries =
            Array.isArray(
                payload &&
                payload.reported_ministries
            )
                ? payload.reported_ministries
                : [];

        return {
            service_state:
                payload &&
                payload.intake
                    ? (
                        payload.intake
                            .service_state ||
                        null
                    )
                    : null,

            answers,

            reported_ministries:
                ministries.map(
                    (row, index) => ({
                        key:
                            `saved-${row.id || index}`,

                        ministry_id:
                            row.ministry_id ||
                            null,

                        ministry_name_snapshot:
                            row.ministry_name_snapshot ||
                            '',

                        service_state:
                            row.service_state ||
                            'current',

                        reported_role:
                            row.reported_role ||
                            '',

                        started_when:
                            row.started_when ||
                            '',

                        wants_discernment:
                            Number(
                                row.wants_discernment
                            ) === 1,

                        selected_priority:
                            Number(
                                row.selected_priority
                            ) === 1,

                        notes:
                            row.notes ||
                            ''
                    })
                )
        };
    }

    function newMinistryRow() {
        return {
            key:
                `new-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`,

            ministry_id: null,
            ministry_name_snapshot: '',
            service_state:
                state.model &&
                state.model.service_state ===
                    'former'
                    ? 'former'
                    : 'current',
            reported_role: '',
            started_when: '',
            wants_discernment: false,
            selected_priority: false,
            notes: ''
        };
    }

    function reconcilePriority() {
        if (!state.model) return;

        const current =
            state.model
                .reported_ministries
                .filter(
                    row =>
                        row.service_state ===
                        'current' &&
                        row.ministry_name_snapshot
                            .trim()
                );

        /*
         * Do not manufacture a Priority Ministry while the member
         * is still completing a draft.
         *
         * A single current ministry will be treated as the reported
         * priority by the authoritative submitIntake() domain rule.
         * With multiple current ministries, the member must make an
         * explicit choice using the Priority Ministry radio controls.
         */
        if (current.length <= 1) {
            return;
        }

        const selected =
            current.filter(
                row =>
                    row.selected_priority
            );

        if (selected.length > 1) {
            let kept = false;

            state.model
                .reported_ministries
                .forEach(row => {
                    if (
                        row.service_state !==
                            'current' ||
                        !row.selected_priority
                    ) {
                        return;
                    }

                    if (!kept) {
                        kept = true;
                        return;
                    }

                    row.selected_priority =
                        false;
                });
        }
    }

    function payloadFromModel() {
        reconcilePriority();

        const includeMinistries =
            state.model &&
            ['current', 'former'].includes(
                state.model.service_state
            );

        return {
            service_state:
                state.model
                    ? state.model
                        .service_state
                    : null,

            answers:
                state.model
                    ? state.model.answers
                    : {},

            reported_ministries:
                includeMinistries &&
                state.model
                    ? state.model
                        .reported_ministries
                        .filter(
                            row =>
                                row
                                    .ministry_name_snapshot
                                    .trim()
                        )
                        .map(row => ({
                            ministry_id:
                                row.ministry_id ||
                                null,

                            ministry_name_snapshot:
                                row
                                    .ministry_name_snapshot
                                    .trim(),

                            service_state:
                                row.service_state,

                            reported_role:
                                row.reported_role
                                    .trim() ||
                                null,

                            started_when:
                                row.started_when
                                    .trim() ||
                                null,

                            /*
                             * Assignment context remains
                             * self-reported in notes for v1.
                             * No canonical ministry role or
                             * assignment is created here.
                             */
                            assignment_kind:
                                null,

                            wants_discernment:
                                row.wants_discernment
                                    ? 1
                                    : 0,

                            selected_priority:
                                row.selected_priority
                                    ? 1
                                    : 0,

                            notes:
                                row.notes
                                    .trim() ||
                                null
                        }))
                    : []
        };
    }

    function field(
        labelText,
        control,
        helpText = ''
    ) {
        const wrap =
            el(
                'div',
                'member-intake-field'
            );

        const label =
            el(
                'label',
                '',
                labelText
            );

        wrap.appendChild(label);
        wrap.appendChild(control);

        if (helpText) {
            wrap.appendChild(
                el(
                    'small',
                    '',
                    helpText
                )
            );
        }

        return wrap;
    }

    function answerInput(
        key,
        type = 'text',
        placeholder = ''
    ) {
        const input =
            el(
                type === 'textarea'
                    ? 'textarea'
                    : 'input',
                'form-control'
            );

        if (type !== 'textarea') {
            input.type = type;
        } else {
            input.rows = 4;
        }

        input.placeholder =
            placeholder;

        input.value =
            state.model.answers[key] ||
            '';

        input.addEventListener(
            'input',
            () => {
                state.model.answers[key] =
                    input.value;
            }
        );

        return input;
    }

    function answerSelect(
        key,
        options
    ) {
        const select =
            el(
                'select',
                'form-control'
            );

        options.forEach(
            ([value, label]) => {
                const option =
                    el(
                        'option',
                        '',
                        label
                    );

                option.value =
                    value;

                select.appendChild(
                    option
                );
            }
        );

        select.value =
            state.model.answers[key] ||
            '';

        select.addEventListener(
            'change',
            () => {
                state.model.answers[key] =
                    select.value;
            }
        );

        return select;
    }

    function section(
        title,
        intro
    ) {
        const wrap =
            el(
                'section',
                'member-intake-section'
            );

        wrap.appendChild(
            el(
                'h3',
                '',
                title
            )
        );

        wrap.appendChild(
            el(
                'p',
                '',
                intro
            )
        );

        return wrap;
    }

    function renderAbout(body) {
        const wrap =
            section(
                'About You',
                'Help leadership connect this historical journey with the person you are today.'
            );

        const member =
            currentMemberSafe();

        if (member.name) {
            const note =
                el(
                    'div',
                    'member-intake-note'
                );

            note.textContent =
                `Portal member: ${member.name}. ` +
                'The answers below belong to this intake and do not silently overwrite your official profile.';

            wrap.appendChild(
                note
            );
        }

        wrap.appendChild(
            field(
                'Preferred name',
                answerInput(
                    'preferred_name'
                )
            )
        );

        wrap.appendChild(
            field(
                'Birthday',
                answerInput(
                    'birthday',
                    'date'
                )
            )
        );

        wrap.appendChild(
            field(
                'Gender',
                answerSelect(
                    'gender',
                    [
                        ['', 'Select'],
                        ['Male', 'Male'],
                        ['Female', 'Female']
                    ]
                )
            )
        );

        wrap.appendChild(
            field(
                'Mobile number',
                answerInput(
                    'mobile',
                    'tel'
                )
            )
        );

        wrap.appendChild(
            field(
                'Email address',
                answerInput(
                    'email',
                    'email'
                )
            )
        );

        wrap.appendChild(
            field(
                'Address / area',
                answerInput(
                    'area_address'
                )
            )
        );

        wrap.appendChild(
            field(
                'Marital status',
                answerInput(
                    'marital_status'
                ),
                'Optional'
            )
        );

        wrap.appendChild(
            field(
                'Spouse / family notes',
                answerInput(
                    'family_notes',
                    'textarea'
                ),
                'Optional'
            )
        );

        body.appendChild(wrap);
    }

    function renderJourney(body) {
        const wrap =
            section(
                'Journey With FOG',
                'Share what you remember about when and how your journey with Fire Of God Ministries began.'
            );

        wrap.appendChild(
            field(
                'How would you describe your current connection with FOG?',
                answerSelect(
                    'current_connection',
                    [
                        ['', 'Select'],
                        ['existing_member', 'Existing member'],
                        ['returning_member', 'Returning member'],
                        ['regular_participant', 'Regular participant'],
                        ['friend_of_community', 'Friend of the community'],
                        ['unsure', 'Not sure']
                    ]
                )
            )
        );

        wrap.appendChild(
            field(
                'About when did your journey with FOG begin?',
                answerInput(
                    'approximate_start',
                    'text',
                    'Example: 2018, around 5 years ago, or unsure'
                )
            )
        );

        wrap.appendChild(
            field(
                'Programs, gatherings, retreats, or activities you remember joining',
                answerInput(
                    'activities_history',
                    'textarea'
                ),
                'You do not need exact dates. Share what you remember.'
            )
        );

        body.appendChild(wrap);
    }

    function renderMembership(body) {
        const wrap =
            section(
                'Membership History',
                'Tell us what you remember about your previous membership journey.'
            );

        wrap.appendChild(
            field(
                'Have you previously made a formal membership commitment with FOG?',
                answerSelect(
                    'prior_formal_commitment',
                    [
                        ['', 'Select'],
                        ['yes', 'Yes'],
                        ['no', 'No'],
                        ['unsure', 'I am not sure']
                    ]
                )
            )
        );

        wrap.appendChild(
            field(
                'Approximate date or season of that commitment',
                answerInput(
                    'prior_commitment_when',
                    'text',
                    'Optional — exact date is not required'
                )
            )
        );

        wrap.appendChild(
            field(
                'Where is your heart with the community today?',
                answerSelect(
                    'current_belonging_disposition',
                    [
                        ['', 'Select'],
                        ['yes', 'I desire to continue journeying with FOG'],
                        ['discerning', 'I am still discerning'],
                        ['not_now', 'Not at this time']
                    ]
                ),
                'This is self-reported for leadership review. Your fresh Community confirmation happens after historical recognition.'
            )
        );

        wrap.appendChild(
            field(
                'Anything you would like leadership to understand about your membership journey?',
                answerInput(
                    'membership_reflection',
                    'textarea'
                ),
                'Optional'
            )
        );

        body.appendChild(wrap);
    }

    function ministryRow(
        row,
        index
    ) {
        const card =
            el(
                'div',
                'member-intake-ministry'
            );

        const header =
            el(
                'div',
                'member-intake-ministry__header'
            );

        header.appendChild(
            el(
                'strong',
                '',
                `Ministry ${index + 1}`
            )
        );

        const remove =
            el(
                'button',
                'member-intake-remove',
                'Remove'
            );

        remove.type =
            'button';

        remove.addEventListener(
            'click',
            () => {
                state.model
                    .reported_ministries =
                    state.model
                        .reported_ministries
                        .filter(
                            item =>
                                item !== row
                        );

                reconcilePriority();
                renderStep();
            }
        );

        header.appendChild(
            remove
        );

        card.appendChild(
            header
        );

        const name =
            el(
                'input',
                'form-control'
            );

        name.value =
            row
                .ministry_name_snapshot;

        name.placeholder =
            'Ministry name';

        name.addEventListener(
            'input',
            () => {
                row.ministry_name_snapshot =
                    name.value;
            }
        );

        card.appendChild(
            field(
                'Ministry',
                name
            )
        );

        const status =
            el(
                'select',
                'form-control'
            );

        [
            ['current', 'Currently serving'],
            ['former', 'Served previously']
        ].forEach(
            ([value, label]) => {
                const option =
                    el(
                        'option',
                        '',
                        label
                    );

                option.value =
                    value;

                status.appendChild(
                    option
                );
            }
        );

        status.value =
            row.service_state;

        status.addEventListener(
            'change',
            () => {
                row.service_state =
                    status.value;

                if (
                    status.value !==
                    'current'
                ) {
                    row.selected_priority =
                        false;
                }

                reconcilePriority();
            }
        );

        card.appendChild(
            field(
                'Service status',
                status
            )
        );

        const role =
            el(
                'input',
                'form-control'
            );

        role.value =
            row.reported_role;

        role.placeholder =
            'Example: Musician, facilitator, helper';

        role.addEventListener(
            'input',
            () => {
                row.reported_role =
                    role.value;
            }
        );

        card.appendChild(
            field(
                'Role / responsibility',
                role
            )
        );

        const started =
            el(
                'input',
                'form-control'
            );

        started.value =
            row.started_when;

        started.placeholder =
            'Example: 2022 or around 3 years ago';

        started.addEventListener(
            'input',
            () => {
                row.started_when =
                    started.value;
            }
        );

        card.appendChild(
            field(
                'About when did you begin serving here?',
                started
            )
        );

        const notes =
            el(
                'textarea',
                'form-control'
            );

        notes.rows = 3;
        notes.value =
            row.notes;

        notes.placeholder =
            'You may mention whether this was a formal assignment, regular service, or informal helping.';

        notes.addEventListener(
            'input',
            () => {
                row.notes =
                    notes.value;
            }
        );

        card.appendChild(
            field(
                'Service / assignment notes',
                notes
            )
        );

        const discernWrap =
            el(
                'label',
                'member-intake-attestation'
            );

        const discern =
            el('input');

        discern.type =
            'checkbox';

        discern.checked =
            row.wants_discernment;

        discern.addEventListener(
            'change',
            () => {
                row.wants_discernment =
                    discern.checked;
            }
        );

        discernWrap.appendChild(
            discern
        );

        discernWrap.appendChild(
            el(
                'span',
                '',
                'I would be open to continued ministry discernment for this area after my historical journey is reviewed.'
            )
        );

        card.appendChild(
            discernWrap
        );

        return card;
    }

    function renderMinistryHistory(body) {
        const wrap =
            section(
                'Ministry History',
                'Share where you serve now, where you served before, or whether you are still exploring.'
            );

        const service =
            el(
                'select',
                'form-control'
            );

        [
            ['', 'Select'],
            ['current', 'I currently serve'],
            ['former', 'I served before, but not currently'],
            ['none', 'I have not served in a ministry'],
            ['interested', 'I am interested in serving']
        ].forEach(
            ([value, label]) => {
                const option =
                    el(
                        'option',
                        '',
                        label
                    );

                option.value =
                    value;

                service.appendChild(
                    option
                );
            }
        );

        service.value =
            state.model.service_state ||
            '';

        service.addEventListener(
            'change',
            () => {
                state.model.service_state =
                    service.value ||
                    null;

                renderStep();
            }
        );

        wrap.appendChild(
            field(
                'Your ministry service history',
                service
            )
        );

        if (
            ['current', 'former'].includes(
                state.model.service_state
            )
        ) {
            state.model
                .reported_ministries
                .forEach(
                    (row, index) => {
                        wrap.appendChild(
                            ministryRow(
                                row,
                                index
                            )
                        );
                    }
                );

            const add =
                el(
                    'button',
                    'btn btn-outline',
                    '+ Add another ministry'
                );

            add.type =
                'button';

            add.addEventListener(
                'click',
                () => {
                    state.model
                        .reported_ministries
                        .push(
                            newMinistryRow()
                        );

                    renderStep();
                }
            );

            wrap.appendChild(
                add
            );
        }

        body.appendChild(wrap);
    }

    function renderPriority(body) {
        reconcilePriority();

        const wrap =
            section(
                'Choose Your Priority Ministry',
                'If you currently serve in more than one ministry, choose one primary area for service, formation, and accountability. Your other ministries remain part of your history and are not removed.'
            );

        const current =
            state.model
                .reported_ministries
                .filter(
                    row =>
                        row.service_state ===
                        'current' &&
                        row
                            .ministry_name_snapshot
                            .trim()
                );

        if (current.length === 0) {
            wrap.appendChild(
                el(
                    'div',
                    'member-intake-note',
                    'No Priority Ministry is required because you have not reported a current ministry.'
                )
            );
        } else if (
            current.length === 1
        ) {
            wrap.appendChild(
                el(
                    'div',
                    'member-intake-note',
                    `${current[0].ministry_name_snapshot} is your only reported current ministry, so it will be treated as your reported priority for review.`
                )
            );
        } else {
            current.forEach(
                row => {
                    const label =
                        el(
                            'label',
                            'member-intake-priority'
                        );

                    const radio =
                        el('input');

                    radio.type =
                        'radio';

                    radio.name =
                        'memberIntakePriority';

                    radio.checked =
                        row
                            .selected_priority;

                    radio.addEventListener(
                        'change',
                        () => {
                            state.model
                                .reported_ministries
                                .forEach(
                                    item => {
                                        item.selected_priority =
                                            item === row;
                                    }
                                );
                        }
                    );

                    label.appendChild(
                        radio
                    );

                    const copy =
                        el('div');

                    copy.appendChild(
                        el(
                            'strong',
                            '',
                            row
                                .ministry_name_snapshot
                        )
                    );

                    if (
                        row.reported_role
                    ) {
                        copy.appendChild(
                            el(
                                'div',
                                '',
                                row
                                    .reported_role
                            )
                        );
                    }

                    label.appendChild(
                        copy
                    );

                    wrap.appendChild(
                        label
                    );
                }
            );
        }

        body.appendChild(wrap);
    }

    function renderDiscernment(body) {
        const wrap =
            section(
                'Ministry Discernment',
                'Share what draws your heart, what gifts you bring, and how leadership can walk with you.'
            );

        wrap.appendChild(
            field(
                'What draws you toward ministry service?',
                answerInput(
                    'ministry_calling',
                    'textarea'
                )
            )
        );

        wrap.appendChild(
            field(
                'Gifts, skills, or experience you would like to offer',
                answerInput(
                    'gifts_experience',
                    'textarea'
                )
            )
        );

        wrap.appendChild(
            field(
                'How would you like to grow through serving?',
                answerInput(
                    'growth_hopes',
                    'textarea'
                )
            )
        );

        wrap.appendChild(
            field(
                'General availability',
                answerInput(
                    'availability',
                    'text',
                    'Example: Saturdays, evenings, twice a month'
                )
            )
        );

        wrap.appendChild(
            field(
                'Would you like a conversation with a ministry leader?',
                answerSelect(
                    'leader_conversation_preference',
                    [
                        ['', 'Select'],
                        ['yes', 'Yes'],
                        ['later', 'Maybe later'],
                        ['no', 'Not right now']
                    ]
                )
            )
        );

        body.appendChild(wrap);
    }

    function renderFormation(body) {
        const wrap =
            section(
                'Previous Formation',
                'Tell us about formation, retreats, Alpha, discipleship, training, or other experiences you remember.'
            );

        wrap.appendChild(
            el(
                'div',
                'member-intake-note',
                'These answers are self-reported. They do not automatically mark Growth Journey phases as completed. Leadership will review what can be recognized.'
            )
        );

        wrap.appendChild(
            field(
                'Formation or programs you remember completing',
                answerInput(
                    'formation_history',
                    'textarea'
                )
            )
        );

        wrap.appendChild(
            field(
                'Anything else leadership should know about your formation?',
                answerInput(
                    'formation_notes',
                    'textarea'
                ),
                'Optional'
            )
        );

        body.appendChild(wrap);
    }

    function renderInvitation(body) {
        const wrap =
            section(
                'Your Current Invitation',
                'Which invitation best describes where you feel God may be leading you now?'
            );

        wrap.appendChild(
            field(
                'Where do you feel invited next?',
                answerSelect(
                    'current_invitation',
                    [
                        ['', 'Select'],
                        ['prayer', 'Deepen my prayer life'],
                        ['community', 'Reconnect with community'],
                        ['commitment', 'Deepen my commitment'],
                        ['service', 'Serve in ministry'],
                        ['return', 'Return and reconnect'],
                        ['formation', 'Continue formation'],
                        ['mission', 'Step into mission'],
                        ['still_discerning', 'I am still discerning']
                    ]
                )
            )
        );

        wrap.appendChild(
            field(
                'Optional reflection',
                answerInput(
                    'current_invitation_reflection',
                    'textarea'
                )
            )
        );

        body.appendChild(wrap);
    }

    function reviewRow(
        title,
        value
    ) {
        const row =
            el(
                'div',
                'member-intake-review-row'
            );

        row.appendChild(
            el(
                'strong',
                '',
                title
            )
        );

        row.appendChild(
            el(
                'span',
                '',
                value || 'Not provided'
            )
        );

        return row;
    }

    function renderReview(body) {
        reconcilePriority();

        const wrap =
            section(
                'Review & Attestation',
                'Review the summary below before sending your journey story to leadership.'
            );

        wrap.appendChild(
            el(
                'div',
                'member-intake-note',
                'Submitting this questionnaire does not automatically change your official Growth Journey standing, Community Intent, ministry role, or Priority Ministry. Leadership reviews and recognizes historical standing separately.'
            )
        );

        const review =
            el(
                'div',
                'member-intake-review'
            );

        review.appendChild(
            reviewRow(
                'Current connection',
                state.model
                    .answers
                    .current_connection
            )
        );

        review.appendChild(
            reviewRow(
                'Journey began',
                state.model
                    .answers
                    .approximate_start
            )
        );

        review.appendChild(
            reviewRow(
                'Previous formal membership',
                state.model
                    .answers
                    .prior_formal_commitment
            )
        );

        review.appendChild(
            reviewRow(
                'Service history',
                state.model
                    .service_state
            )
        );

        const ministryNames =
            state.model
                .reported_ministries
                .filter(
                    row =>
                        row
                            .ministry_name_snapshot
                            .trim()
                )
                .map(
                    row =>
                        row
                            .ministry_name_snapshot
                            .trim()
                )
                .join(', ');

        review.appendChild(
            reviewRow(
                'Reported ministries',
                ministryNames ||
                    'None reported'
            )
        );

        const currentMinistries =
            state.model
                .reported_ministries
                .filter(
                    row =>
                        row.service_state ===
                            'current'
                );

        const priority =
            currentMinistries.find(
                row =>
                    row.selected_priority
            ) ||
            (
                currentMinistries.length === 1
                    ? currentMinistries[0]
                    : null
            );

        review.appendChild(
            reviewRow(
                'Reported Priority Ministry',
                priority
                    ? priority
                        .ministry_name_snapshot
                    : 'Not applicable'
            )
        );

        review.appendChild(
            reviewRow(
                'Current invitation',
                state.model
                    .answers
                    .current_invitation
            )
        );

        wrap.appendChild(
            review
        );

        const attestation =
            el(
                'label',
                'member-intake-attestation'
            );

        const checkbox =
            el('input');

        checkbox.type =
            'checkbox';

        checkbox.checked =
            state.model
                .answers
                .attestation_confirmed ===
                true;

        checkbox.addEventListener(
            'change',
            () => {
                state.model
                    .answers
                    .attestation_confirmed =
                    checkbox.checked;
            }
        );

        attestation.appendChild(
            checkbox
        );

        attestation.appendChild(
            el(
                'span',
                '',
                'I confirm that the information I shared is accurate to the best of my memory, and I understand that leadership may review and verify my historical journey before recognizing official standing.'
            )
        );

        wrap.appendChild(
            attestation
        );

        body.appendChild(wrap);
    }

    function validateFinal() {
        const answers =
            state.model.answers;

        if (
            !answers
                .current_connection
        ) {
            return 'Please select your current connection with FOG.';
        }

        if (
            !answers
                .prior_formal_commitment
        ) {
            return 'Please answer the membership history question.';
        }

        if (
            !answers
                .current_belonging_disposition
        ) {
            return 'Please share where your heart is with the community today.';
        }

        if (
            !state.model
                .service_state
        ) {
            return 'Please select your ministry service history.';
        }

        if (
            ['current', 'former'].includes(
                state.model.service_state
            )
        ) {
            const rows =
                state.model
                    .reported_ministries;

            if (
                rows.length === 0
            ) {
                return 'Please add at least one ministry from your service history.';
            }

            if (
                rows.some(
                    row =>
                        !row
                            .ministry_name_snapshot
                            .trim()
                )
            ) {
                return 'Please enter the name of every ministry row or remove the empty row.';
            }
        }

        reconcilePriority();

        const current =
            state.model
                .reported_ministries
                .filter(
                    row =>
                        row.service_state ===
                            'current' &&
                        row
                            .ministry_name_snapshot
                            .trim()
                );

        if (
            current.length > 1 &&
            current.filter(
                row =>
                    row.selected_priority
            ).length !== 1
        ) {
            return 'Please choose exactly one Priority Ministry.';
        }

        if (
            !answers
                .current_invitation
        ) {
            return 'Please select your current invitation.';
        }

        if (
            answers
                .attestation_confirmed !==
                true
        ) {
            return 'Please confirm the final attestation before submitting.';
        }

        return null;
    }

    function ensureModal() {
        let modal =
            document.getElementById(
                'memberTransitionIntakeModal'
            );

        if (modal) return modal;

        modal =
            el(
                'div',
                'member-intake-modal'
            );

        modal.id =
            'memberTransitionIntakeModal';

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
            'memberIntakeTitle'
        );

        const panel =
            el(
                'div',
                'member-intake-panel'
            );

        const header =
            el(
                'div',
                'member-intake-header'
            );

        const headerRow =
            el(
                'div',
                'member-intake-header-row'
            );

        const copy =
            el('div');

        const title =
            el(
                'h2',
                '',
                'Your Journey With FOG'
            );

        title.id =
            'memberIntakeTitle';

        copy.appendChild(
            title
        );

        copy.appendChild(
            el(
                'p',
                '',
                'Help us honor the journey God has already walked with you.'
            )
        );

        const close =
            el(
                'button',
                'member-intake-close',
                '×'
            );

        close.type =
            'button';

        close.setAttribute(
            'aria-label',
            'Close Adult Member Intake'
        );

        close.addEventListener(
            'click',
            closeModal
        );

        headerRow.appendChild(
            copy
        );

        headerRow.appendChild(
            close
        );

        header.appendChild(
            headerRow
        );

        const progress =
            el(
                'div',
                'member-intake-progress'
            );

        const progressBar =
            el('span');

        progressBar.id =
            'memberIntakeProgressBar';

        progress.appendChild(
            progressBar
        );

        header.appendChild(
            progress
        );

        const stepLabel =
            el(
                'div',
                'member-intake-step-label'
            );

        stepLabel.id =
            'memberIntakeStepLabel';

        header.appendChild(
            stepLabel
        );

        const body =
            el(
                'div',
                'member-intake-body'
            );

        body.id =
            'memberIntakeBody';

        const footer =
            el(
                'div',
                'member-intake-footer'
            );

        const back =
            el(
                'button',
                'btn btn-outline',
                'Back'
            );

        back.id =
            'memberIntakeBack';

        back.type =
            'button';

        back.addEventListener(
            'click',
            () => {
                if (
                    state.step > 0 &&
                    !state.busy
                ) {
                    state.step -= 1;
                    renderStep();
                }
            }
        );

        const save =
            el(
                'button',
                'btn btn-outline',
                'Save & Continue Later'
            );

        save.id =
            'memberIntakeSave';

        save.type =
            'button';

        save.addEventListener(
            'click',
            saveDraft
        );

        const next =
            el(
                'button',
                'btn btn-primary',
                'Continue'
            );

        next.id =
            'memberIntakeNext';

        next.type =
            'button';

        next.addEventListener(
            'click',
            async () => {
                if (state.busy) return;

                if (
                    state.step <
                    STEPS.length - 1
                ) {
                    state.step += 1;
                    renderStep();
                    return;
                }

                await submitFinal();
            }
        );

        const status =
            el(
                'div',
                'member-intake-status'
            );

        status.id =
            'memberIntakeStatus';

        status.setAttribute(
            'role',
            'status'
        );

        status.setAttribute(
            'aria-live',
            'polite'
        );

        footer.appendChild(
            back
        );

        footer.appendChild(
            save
        );

        footer.appendChild(
            next
        );

        footer.appendChild(
            status
        );

        panel.appendChild(
            header
        );

        panel.appendChild(
            body
        );

        panel.appendChild(
            footer
        );

        modal.appendChild(
            panel
        );

        modal.addEventListener(
            'click',
            event => {
                if (
                    event.target ===
                    modal &&
                    !state.busy
                ) {
                    closeModal();
                }
            }
        );

        document.body.appendChild(
            modal
        );

        return modal;
    }

    function setStatus(
        message = '',
        type = ''
    ) {
        const status =
            document.getElementById(
                'memberIntakeStatus'
            );

        if (!status) return;

        status.textContent =
            message;

        status.className =
            'member-intake-status';

        if (type) {
            status.classList.add(
                `is-${type}`
            );
        }
    }

    function setBusy(busy) {
        state.busy =
            busy;

        [
            'memberIntakeBack',
            'memberIntakeSave',
            'memberIntakeNext'
        ].forEach(
            id => {
                const button =
                    document.getElementById(
                        id
                    );

                if (button) {
                    button.disabled =
                        busy;
                }
            }
        );
    }

    function renderStep() {
        const body =
            document.getElementById(
                'memberIntakeBody'
            );

        if (
            !body ||
            !state.model
        ) {
            return;
        }

        clear(body);
        setStatus();

        const progress =
            document.getElementById(
                'memberIntakeProgressBar'
            );

        const label =
            document.getElementById(
                'memberIntakeStepLabel'
            );

        if (progress) {
            progress.style.width =
                `${((state.step + 1) / STEPS.length) * 100}%`;
        }

        if (label) {
            label.textContent =
                `Step ${state.step + 1} of ${STEPS.length} — ${STEPS[state.step]}`;
        }

        const back =
            document.getElementById(
                'memberIntakeBack'
            );

        if (back) {
            back.style.visibility =
                state.step === 0
                    ? 'hidden'
                    : 'visible';
        }

        const next =
            document.getElementById(
                'memberIntakeNext'
            );

        if (next) {
            next.textContent =
                state.step ===
                STEPS.length - 1
                    ? 'Submit for Leadership Review'
                    : 'Continue';
        }

        switch (state.step) {
            case 0:
                renderAbout(body);
                break;
            case 1:
                renderJourney(body);
                break;
            case 2:
                renderMembership(body);
                break;
            case 3:
                renderMinistryHistory(body);
                break;
            case 4:
                renderPriority(body);
                break;
            case 5:
                renderDiscernment(body);
                break;
            case 6:
                renderFormation(body);
                break;
            case 7:
                renderInvitation(body);
                break;
            default:
                renderReview(body);
        }

        body.scrollTop =
            0;
    }

    async function saveDraft() {
        if (
            state.busy ||
            !state.model
        ) {
            return;
        }

        setBusy(true);
        setStatus(
            'Saving your journey…'
        );

        try {
            await requestJson(
                DRAFT_URL,
                {
                    method: 'POST',
                    body:
                        JSON.stringify(
                            payloadFromModel()
                        )
                }
            );

            setStatus(
                'Your draft has been saved. You can safely continue later.',
                'success'
            );
        } catch (error) {
            setStatus(
                error.message ||
                'Your draft could not be saved.',
                'error'
            );
        } finally {
            setBusy(false);
        }
    }

    async function submitFinal() {
        const validation =
            validateFinal();

        if (validation) {
            setStatus(
                validation,
                'error'
            );

            return;
        }

        setBusy(true);
        setStatus(
            'Submitting your journey for leadership review…'
        );

        try {
            await requestJson(
                SUBMIT_URL,
                {
                    method: 'POST',
                    body:
                        JSON.stringify(
                            payloadFromModel()
                        )
                }
            );

            setStatus(
                'Your journey has been submitted.',
                'success'
            );

            window.setTimeout(
                async () => {
                    closeModal();

                    state.transition =
                        null;

                    state.transitionLoadedAt =
                        0;

                    state.transitionMemberId =
                        null;

                    await refreshCard({
                        force: true
                    });

                    if (
                        typeof window
                            .renderJourneyDashboard ===
                            'function'
                    ) {
                        await window
                            .renderJourneyDashboard({
                                force: true
                            });
                    }
                },
                650
            );
        } catch (error) {
            setStatus(
                error.message ||
                'Your journey could not be submitted.',
                'error'
            );
        } finally {
            setBusy(false);
        }
    }

    function closeModal() {
        const modal =
            document.getElementById(
                'memberTransitionIntakeModal'
            );

        if (modal) {
            modal.classList.remove(
                'is-open'
            );
        }
    }

    async function openIntake() {
        if (
            window.navigator.onLine ===
            false
        ) {
            window.alert(
                'An internet connection is required to complete your historical journey intake.'
            );

            return;
        }

        try {
            const payload =
                await requestJson(
                    INTAKE_URL
                );

            if (
                !payload.intake ||
                ![
                    'draft',
                    'needs_changes'
                ].includes(
                    payload.intake.status
                )
            ) {
                throw new Error(
                    'This questionnaire is not currently editable.'
                );
            }

            state.intakePayload =
                payload;

            state.model =
                normalizeModel(
                    payload
                );

            state.step =
                0;

            const modal =
                ensureModal();

            modal.classList.add(
                'is-open'
            );

            renderStep();
        } catch (error) {
            window.alert(
                error.message ||
                'Your journey questionnaire could not be opened.'
            );
        }
    }

    function calloutCopy(
        transition
    ) {
        const next =
            transition.next_action;

        const intakeStatus =
            transition.intake &&
            transition.intake.status;

        if (
            next ===
            'adult_intake_questionnaire'
        ) {
            if (
                intakeStatus ===
                'needs_changes'
            ) {
                return {
                    eyebrow:
                        'Your Journey With FOG',
                    title:
                        'Review Your Journey Story',
                    description:
                        'Leadership has returned your historical journey for an update. Review your answers, make any needed changes, and submit it again.',
                    button:
                        'Review & Update',
                    actionable:
                        true
                };
            }

            return {
                eyebrow:
                    'Your Journey With FOG',
                title:
                    'Tell Us Your Journey Story',
                description:
                    'Help us honor the journey you have already walked with FOG. Share what you remember about membership, formation, and ministry service.',
                button:
                    'Begin My Journey Story',
                actionable:
                    true
            };
        }

        if (
            next ===
            'adult_intake_submitted'
        ) {
            return {
                eyebrow:
                    'Journey Story Submitted',
                title:
                    'Thank You for Sharing Your Journey',
                description:
                    'Your historical journey has been received and is waiting for leadership review.',
                button:
                    'Submitted',
                actionable:
                    false
            };
        }

        if (
            next ===
            'adult_intake_under_review'
        ) {
            return {
                eyebrow:
                    'Leadership Review',
                title:
                    'Your Journey Is Being Reviewed',
                description:
                    'Leadership is reviewing your self-reported history so your previous journey can be recognized accurately.',
                button:
                    'Under Review',
                actionable:
                    false
            };
        }

        return {
            eyebrow:
                'Historical Recognition',
            title:
                'Approved — Awaiting Recognition',
            description:
                'Your historical journey has been approved. Leadership will complete the separate recognition step before your fresh Community confirmation begins.',
            button:
                'Awaiting Recognition',
            actionable:
                false
        };
    }

    async function loadTransition(
        force = false
    ) {
        const memberId =
            Number(
                currentMemberSafe().id
            ) || null;

        /*
         * Never reuse one member's transition cache after
         * another account signs in within the same browser.
         */
        if (
            state.transitionMemberId !==
            memberId
        ) {
            state.transition =
                null;

            state.transitionLoadedAt =
                0;

            state.transitionMemberId =
                memberId;
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

        /*
         * /api/member-transition/me returns the canonical
         * transition state inside { success: true, state: {...} }.
         * Accept the envelope while retaining direct-state
         * compatibility for tests and future internal callers.
         */
        const transition =
            body &&
            body.state &&
            typeof body.state === 'object' &&
            !Array.isArray(body.state)
                ? body.state
                : body;

        if (
            !transition ||
            typeof transition !== 'object' ||
            Array.isArray(transition)
        ) {
            throw new Error(
                'Transition state is unavailable.'
            );
        }

        state.transition =
            transition;

        state.transitionMemberId =
            memberId;

        state.transitionLoadedAt =
            Date.now();

        return transition;
    }

    function transitionVisualKey(
        transition
    ) {
        const nextAction =
            transition &&
            transition.next_action
                ? transition.next_action
                : 'none';

        const intakeStatus =
            transition &&
            transition.intake &&
            transition.intake.status
                ? transition.intake.status
                : 'none';

        return (
            `${nextAction}|${intakeStatus}`
        );
    }

    function renderTransitionCallout(
        card,
        transition
    ) {
        if (
            !card ||
            !transition ||
            !adultActions.has(
                transition.next_action
            )
        ) {
            return null;
        }

        const renderKey =
            transitionVisualKey(
                transition
            );

        const previous =
            card.querySelector(
                '.member-transition-callout'
            );

        /*
         * If the visible state has not changed, leave the existing
         * DOM completely untouched. This prevents the invitation
         * from blinking during repeated Home/Journey refreshes.
         */
        if (
            previous &&
            previous.dataset
                .transitionKey ===
                renderKey
        ) {
            return previous;
        }

        const copy =
            calloutCopy(
                transition
            );

        const box =
            el(
                'div',
                'member-transition-callout'
            );

        box.dataset.transitionKey =
            renderKey;

        box.appendChild(
            el(
                'span',
                'member-transition-callout__eyebrow',
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
                    ? 'btn btn-primary'
                    : 'btn btn-outline',
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
                openIntake
            );
        }

        box.appendChild(
            button
        );

        /*
         * Replace atomically only when the transition state really
         * changed. Never remove first and leave a visible gap.
         */
        if (previous) {
            previous.replaceWith(
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
                '.member-transition-callout'
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

        /*
         * journey-dashboard may have just rebuilt journeyGrowthCard.
         * Restore the known member transition immediately from cache
         * before any network await. This removes the flash between
         * canonical Growth rendering and transition rendering.
         */
        if (
            state.transition &&
            state.transitionMemberId ===
                (
                    Number(
                        currentMemberSafe().id
                    ) || null
                ) &&
            adultActions.has(
                state.transition
                    .next_action
            )
        ) {
            renderTransitionCallout(
                card,
                state.transition
            );
        }

        /*
         * While offline, retain the already-rendered non-mutating
         * status instead of tearing it down.
         */
        if (
            window.navigator.onLine ===
            false
        ) {
            return state.transition;
        }

        try {
            const transition =
                await loadTransition(
                    options.force ===
                        true
                );

            if (
                !transition ||
                !adultActions.has(
                    transition.next_action
                )
            ) {
                const stale =
                    card.querySelector(
                        '.member-transition-callout'
                    );

                if (stale) {
                    stale.remove();
                }

                return transition;
            }

            renderTransitionCallout(
                card,
                transition
            );

            return transition;
        } catch (error) {
            /*
             * A transient refresh failure must not make an already
             * valid invitation blink or disappear.
             */
            return state.transition;
        }
    }

    window.MemberTransitionIntakeUI =
        Object.freeze({
            refreshCard,
            open:
                openIntake,
            close:
                closeModal
        });
})();
