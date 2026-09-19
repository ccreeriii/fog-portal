(() => {
    'use strict';

    const PERMISSION =
        'access_prayer_journey';

    let loading =
        false;

    let lastState =
        null;

    let selectedStatus =
        'all';

    function isAuthorized() {
        return Boolean(
            window.hasPerm &&
            window.hasPerm(PERMISSION)
        );
    }

    let watchtowerView =
        'coverage';

    let journeyAuthorizationDenied =
        false;

    function canViewPrayerJourney() {
        return Boolean(
            isAuthorized() &&
            !journeyAuthorizationDenied
        );
    }

    function setMonitorVisible(visible) {
        const panel =
            document.getElementById(
                'prayerMonitorPanel'
            );

        const divider =
            document.getElementById(
                'prayerMonitorDivider'
            );

        if (panel) {
            panel.hidden =
                !visible;
        }

        // The old divider is no longer needed because
        // Coverage and Prayer Journey now live in separate tabs.
        if (divider) {
            divider.hidden =
                true;
        }
    }

    function getCoverageElements() {
        const shell =
            document.querySelector(
                '.watchtower-shell'
            );

        if (!shell) {
            return [];
        }

        return [
            shell.querySelector(
                '.watchtower-intro'
            ),
            document.getElementById(
                'watchtowerStatus'
            ),
            document.getElementById(
                'watchtowerList'
            )
        ].filter(Boolean);
    }

    function setCoverageVisible(visible) {
        getCoverageElements().forEach(
            element => {
                element.hidden =
                    !visible;
            }
        );
    }

    function clearSensitiveView() {
        lastState =
            null;

        const list =
            document.getElementById(
                'prayerMonitorList'
            );

        clear(list);
        renderSummary({});

        const status =
            document.getElementById(
                'prayerMonitorStatus'
            );

        if (status) {
            status.textContent =
                '';
        }
    }

    function syncSplitTabButtons() {
        const coverageButton =
            document.getElementById(
                'watchtowerCoverageTabButton'
            );

        const journeyButton =
            document.getElementById(
                'prayerJourneyTabButton'
            );

        const journeyAllowed =
            canViewPrayerJourney();

        if (coverageButton) {
            const active =
                watchtowerView ===
                'coverage';

            coverageButton.classList.toggle(
                'active',
                active
            );

            coverageButton.setAttribute(
                'aria-selected',
                active ? 'true' : 'false'
            );
        }

        if (journeyButton) {
            journeyButton.hidden =
                !journeyAllowed;

            const active =
                journeyAllowed &&
                watchtowerView ===
                    'journey';

            journeyButton.classList.toggle(
                'active',
                active
            );

            journeyButton.setAttribute(
                'aria-selected',
                active ? 'true' : 'false'
            );
        }
    }

    function setWatchtowerView(view) {
        const journeyAllowed =
            canViewPrayerJourney();

        const nextView =
            view === 'journey' &&
            journeyAllowed
                ? 'journey'
                : 'coverage';

        watchtowerView =
            nextView;

        const showingJourney =
            nextView ===
            'journey';

        setCoverageVisible(
            !showingJourney
        );

        setMonitorVisible(
            showingJourney
        );

        syncSplitTabButtons();

        if (
            showingJourney &&
            journeyAllowed
        ) {
            bindControls();
            void loadPrayerCovenantMonitor();
        }
    }

    function ensureWatchtowerSplitTabs() {
        const shell =
            document.querySelector(
                '.watchtower-shell'
            );

        if (!shell) {
            return false;
        }

        let tabBar =
            document.getElementById(
                'watchtowerSubTabs'
            );

        if (!tabBar) {
            tabBar =
                document.createElement(
                    'div'
                );

            tabBar.id =
                'watchtowerSubTabs';

            tabBar.className =
                'watchtower-subtabs';

            tabBar.setAttribute(
                'role',
                'tablist'
            );

            tabBar.setAttribute(
                'aria-label',
                'Watchtower dashboard views'
            );

            const coverageButton =
                document.createElement(
                    'button'
                );

            coverageButton.id =
                'watchtowerCoverageTabButton';

            coverageButton.type =
                'button';

            coverageButton.className =
                'watchtower-subtab';

            coverageButton.setAttribute(
                'role',
                'tab'
            );

            coverageButton.textContent =
                'Watchtower Coverage';

            coverageButton.addEventListener(
                'click',
                () => {
                    setWatchtowerView(
                        'coverage'
                    );
                }
            );

            const journeyButton =
                document.createElement(
                    'button'
                );

            journeyButton.id =
                'prayerJourneyTabButton';

            journeyButton.type =
                'button';

            journeyButton.className =
                'watchtower-subtab';

            journeyButton.setAttribute(
                'role',
                'tab'
            );

            journeyButton.textContent =
                'Prayer Journey';

            journeyButton.addEventListener(
                'click',
                () => {
                    if (
                        !canViewPrayerJourney()
                    ) {
                        return;
                    }

                    setWatchtowerView(
                        'journey'
                    );
                }
            );

            tabBar.appendChild(
                coverageButton
            );

            tabBar.appendChild(
                journeyButton
            );

            shell.insertBefore(
                tabBar,
                shell.firstChild
            );
        }

        syncSplitTabButtons();

        return true;
    }

    function syncWatchtowerSplitTabs() {
        const journeyAllowed =
            canViewPrayerJourney();

        ensureWatchtowerSplitTabs();

        if (
            !journeyAllowed &&
            watchtowerView ===
                'journey'
        ) {
            watchtowerView =
                'coverage';
        }

        if (!journeyAllowed) {
            clearSensitiveView();
        }

        setWatchtowerView(
            watchtowerView
        );

        return journeyAllowed;
    }

    function clear(node) {
        if (!node) return;

        while (node.firstChild) {
            node.removeChild(
                node.firstChild
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

    function formatDate(value) {
        if (
            typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            return '—';
        }

        const [
            year,
            month,
            day
        ] = value.split('-');

        return `${month}/${day}/${year}`;
    }

    async function requestJson(url) {
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
                            'application/json'
                    }
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
                    payload &&
                    payload.error
                        ? payload.error
                        : 'Prayer Covenant Monitor request failed.'
                );

            error.status =
                response.status;

            throw error;
        }

        return payload;
    }

    function setStatus(message) {
        const node =
            document.getElementById(
                'prayerMonitorStatus'
            );

        if (node) {
            node.textContent =
                message;
        }
    }

    function summaryValue(
        id,
        value
    ) {
        const node =
            document.getElementById(id);

        if (node) {
            node.textContent =
                String(
                    Number(value) || 0
                );
        }
    }

    function renderSummary(summary = {}) {
        summaryValue(
            'prayerMonitorActiveCount',
            summary.activeParticipants
        );

        summaryValue(
            'prayerMonitorPrayedCount',
            summary.prayedToday
        );

        summaryValue(
            'prayerMonitorWaitingCount',
            summary.notYetToday
        );

        summaryValue(
            'prayerMonitorCompletedCount',
            summary.completedJourneys
        );

        summaryValue(
            'prayerMonitorPausedCount',
            summary.paused
        );

        summaryValue(
            'prayerMonitorIssuesCount',
            summary.dataIssues
        );
    }

    function statusLabel(participant) {
        if (participant.dataIssue) {
            return 'Data Review';
        }

        switch (participant.status) {
            case 'active':
                return participant.prayedToday
                    ? 'Prayed Today'
                    : 'Not Yet Today';

            case 'completed':
                return 'Completed';

            case 'paused':
                return 'Paused';

            default:
                return 'Data Review';
        }
    }

    function statusClass(participant) {
        if (participant.dataIssue) {
            return 'prayer-monitor-badge prayer-monitor-badge--issue';
        }

        switch (participant.status) {
            case 'active':
                return participant.prayedToday
                    ? 'prayer-monitor-badge prayer-monitor-badge--prayed'
                    : 'prayer-monitor-badge prayer-monitor-badge--waiting';

            case 'completed':
                return 'prayer-monitor-badge prayer-monitor-badge--completed';

            case 'paused':
                return 'prayer-monitor-badge prayer-monitor-badge--paused';

            default:
                return 'prayer-monitor-badge prayer-monitor-badge--issue';
        }
    }

    function matchesStatus(
        participant
    ) {
        if (selectedStatus === 'all') {
            return true;
        }

        if (selectedStatus === 'data_review') {
            return Boolean(
                participant.dataIssue
            );
        }

        if (selectedStatus === 'prayed_today') {
            return (
                !participant.dataIssue &&
                participant.status === 'active' &&
                participant.prayedToday
            );
        }

        if (selectedStatus === 'not_yet_today') {
            return (
                !participant.dataIssue &&
                participant.status === 'active' &&
                !participant.prayedToday
            );
        }

        return (
            !participant.dataIssue &&
            participant.status === selectedStatus
        );
    }

    function currentSearch() {
        const input =
            document.getElementById(
                'prayerMonitorSearch'
            );

        return input
            ? String(
                input.value || ''
            )
                .trim()
                .toLocaleLowerCase()
            : '';
    }

    function matchesSearch(
        participant,
        search
    ) {
        if (!search) {
            return true;
        }

        const haystack =
            [
                participant.name,
                participant.youthId
                    ? `youth id ${participant.youthId}`
                    : '',
                participant.status,
                statusLabel(participant)
            ]
                .join(' ')
                .toLocaleLowerCase();

        return haystack.includes(search);
    }

    function appendMeta(
        container,
        label,
        value
    ) {
        const row =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-meta-row'
                }
            );

        row.appendChild(
            element(
                'span',
                {
                    className:
                        'prayer-monitor-meta-label',
                    text:
                        label
                }
            )
        );

        row.appendChild(
            element(
                'span',
                {
                    className:
                        'prayer-monitor-meta-value',
                    text:
                        value
                }
            )
        );

        container.appendChild(row);
    }

    function renderDayGrid(
        detail,
        container
    ) {
        const section =
            element(
                'section',
                {
                    className:
                        'prayer-monitor-detail-section'
                }
            );

        section.appendChild(
            element(
                'h4',
                {
                    text:
                        '21-Day Covenant Progress'
                }
            )
        );

        const grid =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-day-grid'
                }
            );

        const days =
            Array.isArray(detail.days)
                ? detail.days
                : [];

        for (const day of days) {
            const tile =
                element(
                    'div',
                    {
                        className:
                            day.completed
                                ? 'prayer-monitor-day prayer-monitor-day--complete'
                                : 'prayer-monitor-day'
                    }
                );

            tile.appendChild(
                element(
                    'strong',
                    {
                        text:
                            `Day ${day.dayNumber}`
                    }
                )
            );

            tile.appendChild(
                element(
                    'span',
                    {
                        text:
                            day.completed
                                ? formatDate(
                                    day.completionDate
                                )
                                : 'Not yet completed'
                    }
                )
            );

            grid.appendChild(tile);
        }

        section.appendChild(grid);
        container.appendChild(section);
    }

    function renderCalendar(
        detail,
        container
    ) {
        const section =
            element(
                'section',
                {
                    className:
                        'prayer-monitor-detail-section'
                }
            );

        section.appendChild(
            element(
                'h4',
                {
                    text:
                        'Calendar Prayer Rhythm'
                }
            )
        );

        section.appendChild(
            element(
                'p',
                {
                    className:
                        'prayer-monitor-pastoral-note',
                    text:
                        'Calendar gaps do not reset the 21-Day Prayer Covenant. A missed date simply means no prayer was recorded for that date.'
                }
            )
        );

        const calendar =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-calendar'
                }
            );

        const days =
            Array.isArray(detail.calendar)
                ? detail.calendar
                : [];

        if (!days.length) {
            calendar.appendChild(
                element(
                    'p',
                    {
                        className:
                            'prayer-monitor-empty',
                        text:
                            'No calendar prayer history is available yet.'
                    }
                )
            );
        }

        for (const day of days) {
            const row =
                element(
                    'div',
                    {
                        className:
                            day.prayed
                                ? 'prayer-monitor-calendar-row prayer-monitor-calendar-row--prayed'
                                : 'prayer-monitor-calendar-row'
                    }
                );

            row.appendChild(
                element(
                    'span',
                    {
                        text:
                            formatDate(day.date)
                    }
                )
            );

            row.appendChild(
                element(
                    'strong',
                    {
                        text:
                            day.label ||
                            (
                                day.prayed
                                    ? 'Prayer recorded'
                                    : 'No prayer recorded'
                            )
                    }
                )
            );

            calendar.appendChild(row);
        }

        section.appendChild(calendar);
        container.appendChild(section);
    }

    function renderDetail(
        detail,
        container
    ) {
        clear(container);

        const metrics =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-detail-metrics'
                }
            );

        appendMeta(
            metrics,
            'Prayer days',
            `${detail.completedPrayerDays || 0} / ${detail.durationDays || 21}`
        );

        appendMeta(
            metrics,
            'Last prayer',
            formatDate(
                detail.lastRecordedPrayerDate
            )
        );

        appendMeta(
            metrics,
            'Current calendar streak',
            `${Number(detail.currentCalendarStreak) || 0} day(s)`
        );

        appendMeta(
            metrics,
            'Longest calendar streak',
            `${Number(detail.longestCalendarStreak) || 0} day(s)`
        );

        container.appendChild(metrics);

        if (
            detail.dataIssue &&
            Array.isArray(
                detail.dataIssueReasons
            ) &&
            detail.dataIssueReasons.length
        ) {
            const issue =
                element(
                    'div',
                    {
                        className:
                            'prayer-monitor-data-review-note'
                    }
                );

            issue.appendChild(
                element(
                    'strong',
                    {
                        text:
                            'Data Review'
                    }
                )
            );

            for (
                const reason
                of detail.dataIssueReasons
            ) {
                issue.appendChild(
                    element(
                        'p',
                        {
                            text:
                                reason
                        }
                    )
                );
            }

            container.appendChild(issue);
        }

        renderDayGrid(
            detail,
            container
        );

        renderCalendar(
            detail,
            container
        );
    }

    async function toggleDetail(
        participant,
        card,
        button
    ) {
        const existing =
            card.querySelector(
                '.prayer-monitor-detail'
            );

        if (
            existing &&
            existing.dataset.loaded === 'true'
        ) {
            const hidden =
                existing.hidden;

            existing.hidden =
                !hidden;

            button.textContent =
                hidden
                    ? 'Hide Prayer Journey'
                    : 'View Prayer Journey';

            return;
        }

        const detail =
            existing ||
            element(
                'div',
                {
                    className:
                        'prayer-monitor-detail'
                }
            );

        if (!existing) {
            card.appendChild(detail);
        }

        detail.hidden =
            false;

        clear(detail);

        detail.appendChild(
            element(
                'p',
                {
                    className:
                        'prayer-monitor-empty',
                    text:
                        'Loading prayer journey…'
                }
            )
        );

        button.disabled =
            true;

        try {
            const payload =
                await requestJson(
                    `/api/admin/prayer-covenant-monitor/${encodeURIComponent(participant.enrollmentId)}`
                );

            renderDetail(
                payload,
                detail
            );

            detail.dataset.loaded =
                'true';

            button.textContent =
                'Hide Prayer Journey';
        } catch (error) {
            clear(detail);

            detail.appendChild(
                element(
                    'p',
                    {
                        className:
                            'prayer-monitor-error',
                        text:
                            error &&
                            error.status === 403
                                ? 'Your Prayer leadership authorization is no longer active.'
                                : 'This Prayer Covenant record could not be loaded.'
                    }
                )
            );
        } finally {
            button.disabled =
                false;
        }
    }

    function renderParticipant(
        participant
    ) {
        const card =
            element(
                'article',
                {
                    className:
                        participant.dataIssue
                            ? 'prayer-monitor-person prayer-monitor-person--issue'
                            : 'prayer-monitor-person'
                }
            );

        const header =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-person-header'
                }
            );

        const copy =
            element(
                'div',
                {
                    className:
                        'prayer-monitor-person-copy'
                }
            );

        copy.appendChild(
            element(
                'h3',
                {
                    text:
                        participant.name ||
                        'Community member'
                }
            )
        );

        const subline =
            element(
                'p',
                {
                    text:
                        `Prayer days: ${participant.completedDays || 0} / ${participant.durationDays || 21} · Started: ${formatDate(participant.startDate)} · Last prayer: ${formatDate(participant.lastRecordedPrayerDate)}`
                }
            );

        copy.appendChild(subline);
        header.appendChild(copy);

        header.appendChild(
            element(
                'span',
                {
                    className:
                        statusClass(participant),
                    text:
                        statusLabel(participant)
                }
            )
        );

        card.appendChild(header);

        if (
            participant.dataIssue &&
            Array.isArray(
                participant.dataIssueReasons
            ) &&
            participant.dataIssueReasons.length
        ) {
            card.appendChild(
                element(
                    'p',
                    {
                        className:
                            'prayer-monitor-issue-summary',
                        text:
                            participant.dataIssueReasons
                                .join(' · ')
                    }
                )
            );
        }

        const button =
            element(
                'button',
                {
                    className:
                        'btn btn-outline prayer-monitor-detail-button',
                    text:
                        'View Prayer Journey'
                }
            );

        button.type =
            'button';

        button.addEventListener(
            'click',
            () => {
                void toggleDetail(
                    participant,
                    card,
                    button
                );
            }
        );

        card.appendChild(button);

        return card;
    }

    function allRows(state) {
        return [
            ...(
                Array.isArray(
                    state &&
                    state.participants
                )
                    ? state.participants
                    : []
            ),
            ...(
                Array.isArray(
                    state &&
                    state.dataReview
                )
                    ? state.dataReview
                    : []
            )
        ];
    }

    function renderParticipants() {
        const list =
            document.getElementById(
                'prayerMonitorList'
            );

        if (!list) {
            return;
        }

        clear(list);

        if (!lastState) {
            return;
        }

        const search =
            currentSearch();

        const rows =
            allRows(lastState)
                .filter(matchesStatus)
                .filter(participant =>
                    matchesSearch(
                        participant,
                        search
                    )
                );

        if (!rows.length) {
            list.appendChild(
                element(
                    'p',
                    {
                        className:
                            'prayer-monitor-empty',
                        text:
                            'No Prayer Covenant records match this view.'
                    }
                )
            );

            return;
        }

        for (const participant of rows) {
            list.appendChild(
                renderParticipant(
                    participant
                )
            );
        }
    }

    function applyStatusButtonState() {
        const buttons =
            document.querySelectorAll(
                '[data-prayer-monitor-filter]'
            );

        for (const button of buttons) {
            const active =
                button.dataset
                    .prayerMonitorFilter ===
                selectedStatus;

            button.classList.toggle(
                'active',
                active
            );

            button.setAttribute(
                'aria-pressed',
                active
                    ? 'true'
                    : 'false'
            );
        }
    }

    function bindControls() {
        const search =
            document.getElementById(
                'prayerMonitorSearch'
            );

        if (
            search &&
            search.dataset.bound !== 'true'
        ) {
            search.dataset.bound =
                'true';

            search.addEventListener(
                'input',
                renderParticipants
            );
        }

        const buttons =
            document.querySelectorAll(
                '[data-prayer-monitor-filter]'
            );

        for (const button of buttons) {
            if (
                button.dataset.bound ===
                'true'
            ) {
                continue;
            }

            button.dataset.bound =
                'true';

            button.addEventListener(
                'click',
                () => {
                    selectedStatus =
                        button.dataset
                            .prayerMonitorFilter ||
                        'all';

                    applyStatusButtonState();
                    renderParticipants();
                }
            );
        }

        applyStatusButtonState();
    }

    function renderState(state) {
        lastState =
            state;

        renderSummary(
            state.summary || {}
        );

        const date =
            state.asOfDate
                ? formatDate(
                    state.asOfDate
                )
                : 'today';

        setStatus(
            `Prayer Covenant pastoral view as of ${date}. Calendar gaps are shown as “No prayer recorded” and do not reset 21-day progress.`
        );

        bindControls();
        renderParticipants();
    }

    async function loadPrayerCovenantMonitor() {
        if (
            !canViewPrayerJourney() ||
            watchtowerView !== 'journey' ||
            loading
        ) {
            return;
        }

        loading =
            true;

        setStatus(
            'Loading Prayer Covenant Monitor…'
        );

        try {
            const state =
                await requestJson(
                    '/api/admin/prayer-covenant-monitor'
                );

            renderState(state);
        } catch (error) {
            lastState =
                null;

            const list =
                document.getElementById(
                    'prayerMonitorList'
                );

            clear(list);

            if (
                error &&
                error.status === 403
            ) {
                journeyAuthorizationDenied =
                    true;

                clearSensitiveView();

                ensureWatchtowerSplitTabs();

                setWatchtowerView(
                    'coverage'
                );
            } else {
                setStatus(
                    'Prayer Covenant Monitor could not be loaded. Please try again.'
                );
            }
        } finally {
            loading =
                false;
        }
    }

    const originalSwitchTab =
        window.switchTab;

    window.switchTab =
        function (
            tabId,
            ...args
        ) {
            const result =
                typeof originalSwitchTab ===
                'function'
                    ? originalSwitchTab.call(
                        this,
                        tabId,
                        ...args
                    )
                    : undefined;

            if (
                tabId ===
                'watchtowerTab'
            ) {
                ensureWatchtowerSplitTabs();

                setWatchtowerView(
                    'coverage'
                );
            }

            return result;
        };

    window.loadPrayerCovenantMonitor =
        loadPrayerCovenantMonitor;

    window.addEventListener(
        'load',
        () => {
            ensureWatchtowerSplitTabs();

            setWatchtowerView(
                'coverage'
            );
        }
    );
})();
