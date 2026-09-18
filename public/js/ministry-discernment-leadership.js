(function () {
    'use strict';

    const API = '/api/admin/ministry-discernment';

    const TERMINAL = new Set([
        'completed',
        'withdrawn',
        'not_recommended'
    ]);

    const state = {
        cases: [],
        selectedId: null,
        detail: null,
        loadingList: false,
        loadingDetail: false,
        mutating: false
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function clear(node) {
        if (!node) return;
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    function el(tag, options = {}) {
        const node = document.createElement(tag);

        if (options.className) {
            node.className = options.className;
        }

        if (options.text !== undefined) {
            node.textContent = String(options.text);
        }

        if (options.type) {
            node.type = options.type;
        }

        if (options.value !== undefined) {
            node.value = options.value;
        }

        if (options.placeholder) {
            node.placeholder = options.placeholder;
        }

        if (options.disabled) {
            node.disabled = true;
        }

        return node;
    }

    function append(parent, ...children) {
        children
            .filter(Boolean)
            .forEach(child => parent.appendChild(child));

        return parent;
    }

    function hasLeadershipPermission() {
        return (
            typeof window.hasPerm === 'function' &&
            window.hasPerm('access_ministries') &&
            window.hasPerm('edit_entries')
        );
    }

    function statusLabel(value) {
        const labels = {
            intent_submitted: 'Intent Submitted',
            consultation_pending: 'Consultation Pending',
            consultation_complete: 'Consultation Complete',
            assessment_pending: 'Assessment In Progress',
            assessment_complete: 'Assessment Complete',
            recommended: 'Recommended',
            not_recommended: 'Not Recommended',
            completed: 'Discernment Complete',
            withdrawn: 'Withdrawn'
        };

        return labels[value] || value || 'Unknown';
    }

    function eventLabel(value) {
        const labels = {
            intent_submitted: 'Member Intent Submitted',
            leader_consultation_completed:
                'Leadership Consultation Completed',
            assessment_started:
                'Assessment Started',
            assessment_completed:
                'Assessment Completed',
            recommended:
                'Recommended for Ministry',
            not_recommended:
                'Not Recommended',
            discernment_completed:
                'Discernment Completed',
            discernment_withdrawn:
                'Discernment Withdrawn'
        };

        return labels[value] || value || 'Event';
    }

    function sourceLabel(value) {
        const labels = {
            profile: 'Profile',
            adult_intake: 'Adult Intake',
            accelerated_transition:
                'Existing Member Transition',
            new_application:
                'New Ministry Application'
        };

        return labels[value] || value || 'Unknown';
    }

    function formatDate(value) {
        if (!value) return '—';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString();
    }

    function setMessage(message, kind = '') {
        const node = byId('ministryDiscernmentStatus');

        if (!node) return;

        node.textContent = message || '';
        node.className =
            'ministry-discernment-status' +
            (kind ? ` ${kind}` : '');
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            ...options
        });

        let payload = {};

        try {
            payload = await response.json();
        } catch (_) {
            payload = {};
        }

        if (!response.ok) {
            const error = new Error(
                payload.error ||
                'The request could not be completed.'
            );

            error.code =
                payload.code ||
                `HTTP_${response.status}`;

            throw error;
        }

        return payload;
    }

    function badge(status) {
        return el(
            'span',
            {
                className:
                    `ministry-discernment-badge status-${status}`,
                text: statusLabel(status)
            }
        );
    }

    function infoRow(label, value) {
        const row =
            el('div', {
                className: 'ministry-discernment-info'
            });

        append(
            row,
            el('div', {
                className: 'ministry-discernment-info-label',
                text: label
            }),
            el('div', {
                className: 'ministry-discernment-info-value',
                text: value || '—'
            })
        );

        return row;
    }

    function renderList() {
        const container =
            byId('ministryDiscernmentCaseList');

        if (!container) return;

        clear(container);

        if (state.loadingList) {
            container.appendChild(
                el('div', {
                    className: 'ministry-discernment-empty',
                    text: 'Loading discernment cases…'
                })
            );
            return;
        }

        if (!state.cases.length) {
            container.appendChild(
                el('div', {
                    className: 'ministry-discernment-empty',
                    text:
                        'No ministry discernment cases are available.'
                })
            );
            return;
        }

        state.cases.forEach(item => {
            const button =
                el('button', {
                    className:
                        'ministry-discernment-case-card' +
                        (
                            Number(item.id) ===
                            Number(state.selectedId)
                                ? ' active'
                                : ''
                        ),
                    type: 'button'
                });

            button.dataset.caseId =
                String(item.id);

            button.addEventListener(
                'click',
                () => selectCase(item.id)
            );

            const top =
                el('div', {
                    className:
                        'ministry-discernment-case-top'
                });

            append(
                top,
                el('strong', {
                    text:
                        item.member_name ||
                        `Member ${item.youth_id}`
                }),
                badge(item.status)
            );

            append(
                button,
                top,
                el('div', {
                    className:
                        'ministry-discernment-ministry',
                    text:
                        item.ministry_name ||
                        `Ministry ${item.ministry_id}`
                }),
                el('div', {
                    className:
                        'ministry-discernment-case-meta',
                    text:
                        `${sourceLabel(item.source_type)} • ` +
                        `Opened ${formatDate(item.opened_at)}`
                })
            );

            if (Number(item.priority_at_open) === 1) {
                button.appendChild(
                    el('span', {
                        className:
                            'ministry-discernment-priority',
                        text:
                            'Priority Ministry at opening'
                    })
                );
            }

            container.appendChild(button);
        });
    }

    function renderJourneyStory(
        parent,
        discernmentCase
    ) {
        const section =
            el('section', {
                className:
                    'ministry-discernment-section'
            });

        section.appendChild(
            el('h3', {
                text: 'Member Discernment Story'
            })
        );

        append(
            section,
            infoRow(
                'Intent',
                discernmentCase.intent_text
            ),
            infoRow(
                'Availability',
                discernmentCase.availability
            ),
            infoRow(
                'Gifts / Strengths',
                discernmentCase.gifts_text
            ),
            infoRow(
                'Growth Hopes',
                discernmentCase.growth_hopes_text
            ),
            infoRow(
                'Leader Conversation Requested',
                Number(
                    discernmentCase
                        .wants_leader_conversation
                ) === 1
                    ? 'Yes'
                    : 'No'
            ),
            infoRow(
                'Priority Ministry When Opened',
                Number(
                    discernmentCase.priority_at_open
                ) === 1
                    ? 'Yes'
                    : 'No'
            )
        );

        parent.appendChild(section);
    }

    function renderTimeline(parent, events) {
        const section =
            el('section', {
                className:
                    'ministry-discernment-section'
            });

        section.appendChild(
            el('h3', {
                text: 'Discernment History'
            })
        );

        if (!events || !events.length) {
            section.appendChild(
                el('div', {
                    className:
                        'ministry-discernment-empty',
                    text:
                        'No discernment events have been recorded.'
                })
            );

            parent.appendChild(section);
            return;
        }

        const timeline =
            el('div', {
                className:
                    'ministry-discernment-timeline'
            });

        events.forEach(event => {
            const item =
                el('div', {
                    className:
                        'ministry-discernment-event'
                });

            const heading =
                el('div', {
                    className:
                        'ministry-discernment-event-heading'
                });

            append(
                heading,
                el('strong', {
                    text: eventLabel(event.event_type)
                }),
                el('span', {
                    className:
                        'ministry-discernment-visibility',
                    text:
                        event.visibility === 'member'
                            ? 'Member Visible'
                            : 'Leadership'
                })
            );

            append(
                item,
                heading,
                el('div', {
                    className:
                        'ministry-discernment-event-meta',
                    text:
                        `${event.actor_name || 'System'} • ` +
                        `${formatDate(event.created_at)}`
                })
            );

            const details =
                event.details &&
                typeof event.details === 'object'
                    ? event.details
                    : null;

            if (
                details &&
                Object.keys(details).length
            ) {
                const detailList =
                    el('div', {
                        className:
                            'ministry-discernment-event-details'
                    });

                Object.entries(details)
                    .forEach(([key, value]) => {
                        if (
                            value === null ||
                            value === undefined ||
                            value === ''
                        ) {
                            return;
                        }

                        detailList.appendChild(
                            infoRow(
                                key
                                    .replaceAll('_', ' ')
                                    .replace(
                                        /\b\w/g,
                                        letter =>
                                            letter.toUpperCase()
                                    ),
                                typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)
                            )
                        );
                    });

                item.appendChild(detailList);
            }

            timeline.appendChild(item);
        });

        section.appendChild(timeline);
        parent.appendChild(section);
    }

    function actionButton(
        label,
        className,
        handler
    ) {
        const button =
            el('button', {
                type: 'button',
                className:
                    `btn ${className || 'btn-outline'}`,
                text: label,
                disabled: state.mutating
            });

        button.addEventListener(
            'click',
            handler
        );

        return button;
    }

    function getLeadershipNote() {
        const input =
            byId('ministryDiscernmentLeadershipNote');

        return input
            ? input.value.trim()
            : '';
    }

    function mutationDetails(extra = {}) {
        const note =
            getLeadershipNote();

        return {
            source:
                'ministry_discernment_leadership_ui',
            ...(note ? { note } : {}),
            ...extra
        };
    }

    async function mutate(
        path,
        body,
        successMessage
    ) {
        if (
            state.mutating ||
            !state.selectedId
        ) {
            return;
        }

        if (!hasLeadershipPermission()) {
            setMessage(
                'You do not have permission to manage ministry discernment.',
                'error'
            );
            return;
        }

        state.mutating = true;
        renderDetail();

        try {
            await requestJson(
                `${API}/${encodeURIComponent(
                    state.selectedId
                )}${path}`,
                {
                    method: 'POST',
                    body: JSON.stringify(body || {})
                }
            );

            setMessage(
                successMessage,
                'success'
            );

            await loadList({
                preserveSelection: true
            });

            await loadDetail(
                state.selectedId
            );
        } catch (error) {
            setMessage(
                error.message ||
                'The discernment action could not be completed.',
                'error'
            );

            await loadDetail(
                state.selectedId
            ).catch(() => {});
        } finally {
            state.mutating = false;
            renderDetail();
        }
    }

    function confirmAndMutate(
        question,
        path,
        body,
        successMessage
    ) {
        if (!window.confirm(question)) {
            return;
        }

        mutate(
            path,
            body,
            successMessage
        );
    }

    function renderActions(
        parent,
        discernmentCase
    ) {
        const section =
            el('section', {
                className:
                    'ministry-discernment-section ministry-discernment-actions'
            });

        section.appendChild(
            el('h3', {
                text: 'Leadership Action'
            })
        );

        if (TERMINAL.has(discernmentCase.status)) {
            section.appendChild(
                el('div', {
                    className:
                        'ministry-discernment-terminal',
                    text:
                        discernmentCase.status === 'completed'
                            ? 'This discernment journey has been completed. No further leadership action is required.'
                            : discernmentCase.status === 'not_recommended'
                                ? 'This discernment journey closed without a recommendation.'
                                : 'This discernment journey was withdrawn.'
                })
            );

            parent.appendChild(section);
            return;
        }

        const label =
            el('label', {
                className:
                    'ministry-discernment-note-label',
                text:
                    'Leadership Note (optional)'
            });

        const note =
            el('textarea', {
                className: 'form-control',
                placeholder:
                    'Add a concise note for this leadership step.'
            });

        note.id =
            'ministryDiscernmentLeadershipNote';

        note.rows = 3;

        const actions =
            el('div', {
                className:
                    'ministry-discernment-action-grid'
            });

        const status =
            discernmentCase.status;

        if (
            status === 'intent_submitted' ||
            status === 'consultation_pending'
        ) {
            actions.appendChild(
                actionButton(
                    'Complete Consultation',
                    'btn-primary',
                    () =>
                        confirmAndMutate(
                            'Mark the leadership consultation as complete?',
                            '/consultation/complete',
                            {
                                details:
                                    mutationDetails({
                                        step:
                                            'consultation_complete'
                                    })
                            },
                            'Leadership consultation completed.'
                        )
                )
            );
        }

        if (status === 'consultation_complete') {
            actions.appendChild(
                actionButton(
                    'Start Assessment',
                    'btn-outline',
                    () =>
                        confirmAndMutate(
                            'Start a ministry assessment for this discernment case?',
                            '/assessment/start',
                            {
                                details:
                                    mutationDetails({
                                        step:
                                            'assessment_started'
                                    })
                            },
                            'Assessment started.'
                        )
                )
            );

            actions.appendChild(
                actionButton(
                    'Recommend',
                    'btn-primary',
                    () =>
                        confirmAndMutate(
                            'Recommend this member for the ministry without requiring an assessment?',
                            '/recommendation',
                            {
                                recommended: true,
                                assessment_required: false,
                                details:
                                    mutationDetails({
                                        decision:
                                            'recommended',
                                        assessment_required:
                                            false
                                    })
                            },
                            'Member recommended for ministry.'
                        )
                )
            );

            actions.appendChild(
                actionButton(
                    'Not Recommended',
                    'btn-outline',
                    () =>
                        confirmAndMutate(
                            'Close this discernment case as not recommended?',
                            '/recommendation',
                            {
                                recommended: false,
                                assessment_required: false,
                                details:
                                    mutationDetails({
                                        decision:
                                            'not_recommended',
                                        assessment_required:
                                            false
                                    })
                            },
                            'Discernment closed as not recommended.'
                        )
                )
            );
        }

        if (status === 'assessment_pending') {
            actions.appendChild(
                actionButton(
                    'Complete Assessment',
                    'btn-primary',
                    () =>
                        confirmAndMutate(
                            'Mark the ministry assessment as complete?',
                            '/assessment/complete',
                            {
                                details:
                                    mutationDetails({
                                        step:
                                            'assessment_complete'
                                    })
                            },
                            'Assessment completed.'
                        )
                )
            );
        }

        if (status === 'assessment_complete') {
            actions.appendChild(
                actionButton(
                    'Recommend',
                    'btn-primary',
                    () =>
                        confirmAndMutate(
                            'Recommend this member after the completed assessment?',
                            '/recommendation',
                            {
                                recommended: true,
                                assessment_required: true,
                                details:
                                    mutationDetails({
                                        decision:
                                            'recommended',
                                        assessment_required:
                                            true
                                    })
                            },
                            'Member recommended after assessment.'
                        )
                )
            );

            actions.appendChild(
                actionButton(
                    'Not Recommended',
                    'btn-outline',
                    () =>
                        confirmAndMutate(
                            'Close this discernment case as not recommended after assessment?',
                            '/recommendation',
                            {
                                recommended: false,
                                assessment_required: true,
                                details:
                                    mutationDetails({
                                        decision:
                                            'not_recommended',
                                        assessment_required:
                                            true
                                    })
                            },
                            'Discernment closed as not recommended.'
                        )
                )
            );
        }

        if (status === 'recommended') {
            actions.appendChild(
                actionButton(
                    'Complete Discernment',
                    'btn-primary',
                    () =>
                        confirmAndMutate(
                            'Complete this ministry discernment journey?',
                            '/complete',
                            {
                                details:
                                    mutationDetails({
                                        step:
                                            'discernment_completed'
                                    })
                            },
                            'Ministry discernment completed.'
                        )
                )
            );
        }

        if (!TERMINAL.has(status)) {
            actions.appendChild(
                actionButton(
                    'Withdraw Discernment',
                    'btn-outline',
                    () =>
                        confirmAndMutate(
                            'Withdraw this ministry discernment case? This closes the current discernment journey.',
                            '/withdraw',
                            {
                                details:
                                    mutationDetails({
                                        reason:
                                            'leadership_withdrawal'
                                    })
                            },
                            'Discernment withdrawn.'
                        )
                )
            );
        }

        append(
            section,
            label,
            note,
            actions
        );

        parent.appendChild(section);
    }

    function renderDetail() {
        const container =
            byId('ministryDiscernmentCaseDetail');

        if (!container) return;

        clear(container);

        if (state.loadingDetail) {
            container.appendChild(
                el('div', {
                    className:
                        'ministry-discernment-empty',
                    text:
                        'Loading discernment details…'
                })
            );
            return;
        }

        if (
            !state.detail ||
            !state.detail.case
        ) {
            container.appendChild(
                el('div', {
                    className:
                        'ministry-discernment-empty',
                    text:
                        'Select a discernment case to review it.'
                })
            );
            return;
        }

        const item =
            state.detail.case;

        const header =
            el('div', {
                className:
                    'ministry-discernment-detail-header'
            });

        const titleBlock =
            el('div');

        append(
            titleBlock,
            el('h2', {
                text:
                    item.member_name ||
                    `Member ${item.youth_id}`
            }),
            el('div', {
                className:
                    'ministry-discernment-detail-ministry',
                text:
                    item.ministry_name ||
                    `Ministry ${item.ministry_id}`
            })
        );

        append(
            header,
            titleBlock,
            badge(item.status)
        );

        container.appendChild(header);

        const summary =
            el('section', {
                className:
                    'ministry-discernment-section'
            });

        append(
            summary,
            infoRow(
                'Member Code',
                item.member_code
            ),
            infoRow(
                'Source',
                sourceLabel(item.source_type)
            ),
            infoRow(
                'Opened',
                formatDate(item.opened_at)
            ),
            infoRow(
                'Last Updated',
                formatDate(item.updated_at)
            )
        );

        if (item.closed_at) {
            summary.appendChild(
                infoRow(
                    'Closed',
                    formatDate(item.closed_at)
                )
            );
        }

        container.appendChild(summary);

        renderJourneyStory(
            container,
            item
        );

        renderTimeline(
            container,
            state.detail.events || []
        );

        renderActions(
            container,
            item
        );
    }

    async function loadDetail(caseId) {
        if (!caseId) return;

        state.loadingDetail = true;
        state.selectedId = Number(caseId);
        renderList();
        renderDetail();

        try {
            state.detail =
                await requestJson(
                    `${API}/${encodeURIComponent(caseId)}`
                );
        } catch (error) {
            state.detail = null;

            setMessage(
                error.message ||
                'Unable to load discernment details.',
                'error'
            );
        } finally {
            state.loadingDetail = false;
            renderList();
            renderDetail();
        }
    }

    async function selectCase(caseId) {
        await loadDetail(caseId);
    }

    async function loadList(
        {
            preserveSelection = false
        } = {}
    ) {
        if (!hasLeadershipPermission()) {
            return;
        }

        state.loadingList = true;
        renderList();

        try {
            const payload =
                await requestJson(API);

            state.cases =
                Array.isArray(payload.cases)
                    ? payload.cases
                    : [];

            if (
                preserveSelection &&
                state.selectedId &&
                state.cases.some(
                    item =>
                        Number(item.id) ===
                        Number(state.selectedId)
                )
            ) {
                return;
            }

            if (
                !state.selectedId &&
                state.cases.length
            ) {
                state.selectedId =
                    Number(state.cases[0].id);
            }
        } catch (error) {
            state.cases = [];

            setMessage(
                error.message ||
                'Unable to load ministry discernment cases.',
                'error'
            );
        } finally {
            state.loadingList = false;
            renderList();
        }
    }

    function activatePanel() {
        document
            .querySelectorAll('.ministry-sub-tab')
            .forEach(node =>
                node.classList.remove('active')
            );

        [
            'btnSubMinistryList',
            'btnSubMinistryCreate',
            'btnSubMinistryDiscernment'
        ].forEach(id => {
            const button = byId(id);
            if (button) {
                button.classList.remove('active');
            }
        });

        const panel =
            byId('subTabMinistryDiscernment');

        const button =
            byId('btnSubMinistryDiscernment');

        if (panel) {
            panel.classList.add('active');
        }

        if (button) {
            button.classList.add('active');
        }
    }

    async function open() {
        if (!hasLeadershipPermission()) {
            setMessage(
                'Ministry discernment leadership requires Ministries and Edit Entries permissions.',
                'error'
            );
            return;
        }

        activatePanel();

        setMessage(
            'Reviewing ministry discernment journeys.',
            ''
        );

        await loadList();

        if (state.selectedId) {
            await loadDetail(
                state.selectedId
            );
        }
    }

    function refreshPermissionVisibility() {
        const button =
            byId('btnSubMinistryDiscernment');

        if (!button) return;

        button.style.display =
            hasLeadershipPermission()
                ? ''
                : 'none';
    }

    function schedulePermissionVisibilityRefresh() {
        refreshPermissionVisibility();

        [250, 750, 1500, 3000]
            .forEach(delay => {
                window.setTimeout(
                    refreshPermissionVisibility,
                    delay
                );
            });
    }

    window.MinistryDiscernmentLeadershipUI =
        Object.freeze({
            open,
            refreshPermissionVisibility
        });

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            schedulePermissionVisibilityRefresh,
            { once: true }
        );
    } else {
        schedulePermissionVisibilityRefresh();
    }

    window.addEventListener(
        'member-auth-updated',
        refreshPermissionVisibility
    );
})();
