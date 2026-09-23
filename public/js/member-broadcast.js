'use strict';

(function memberBroadcastFeature(root) {
    const state = {
        selected:
            null,

        timer:
            null
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function statusText(channel, value) {
        const labels = {
            ready:
                `${channel} ready`,

            no_subscription:
                'No Push-enabled device',

            disabled:
                `${channel} disabled by member`,

            category_disabled:
                'Community notifications disabled',

            unverified:
                'No verified Email available'
        };

        return (
            labels[value] ||
            `${channel} unavailable`
        );
    }

    function installStyles() {
        if (
            byId(
                'memberBroadcastStyles'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'memberBroadcastStyles';

        style.textContent = `
            .member-broadcast-search-results {
                margin-top:8px;
                border:1px solid var(--border-color,#ddd);
                border-radius:10px;
                overflow:hidden;
                display:none;
                background:#fff;
            }

            .member-broadcast-search-results.active {
                display:block;
            }

            .member-broadcast-result {
                display:block;
                width:100%;
                text-align:left;
                border:0;
                border-bottom:1px solid #eee;
                background:#fff;
                padding:12px 14px;
                cursor:pointer;
            }

            .member-broadcast-result:last-child {
                border-bottom:0;
            }

            .member-broadcast-result:hover,
            .member-broadcast-result:focus-visible {
                background:#f8fafc;
            }

            .member-broadcast-result-name {
                font-weight:700;
                color:var(--text-main,#333);
            }

            .member-broadcast-result-meta {
                margin-top:4px;
                font-size:.78rem;
                color:var(--text-muted,#64748b);
            }

            .member-broadcast-selected {
                margin-top:12px;
                padding:12px 14px;
                border-radius:10px;
                background:#f8fafc;
                border:1px solid #e2e8f0;
            }

            .member-broadcast-channel {
                display:flex;
                align-items:flex-start;
                gap:9px;
                padding:10px 0;
            }

            .member-broadcast-channel small {
                display:block;
                margin-top:2px;
                color:var(--text-muted,#64748b);
            }

            .member-broadcast-note {
                font-size:.82rem;
                line-height:1.5;
                color:var(--text-muted,#64748b);
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function installCard() {
        const tab =
            byId(
                'communicationsAdminTab'
            );

        const broadcastSection =
            byId(
                'communicationsBroadcastSection'
            );

        if (
            !tab ||
            !broadcastSection ||
            byId(
                'memberBroadcastCard'
            )
        ) {
            return;
        }

        const card =
            document.createElement(
                'div'
            );

        card.className =
            'card';

        card.id =
            'memberBroadcastCard';

        card.innerHTML = `
            <h2 style="color:#7C3AED;">
                👤 Direct Member Message
            </h2>

            <p class="member-broadcast-note">
                Send a private Portal notification to one member.
                Portal Inbox is always included. Push and Email are
                optional and respect the member's notification settings.
            </p>

            <form id="memberBroadcastForm">

                <div class="form-group">
                    <label for="memberBroadcastSearch">
                        Find Member *
                    </label>

                    <input
                        type="search"
                        id="memberBroadcastSearch"
                        class="form-control"
                        autocomplete="off"
                        placeholder="Type at least 2 letters of the member's name">

                    <div
                        id="memberBroadcastSearchResults"
                        class="member-broadcast-search-results"
                        role="listbox"
                        aria-label="Member search results">
                    </div>

                    <div
                        id="memberBroadcastSelected"
                        class="member-broadcast-selected"
                        hidden>
                        <strong id="memberBroadcastSelectedName"></strong>
                        <div
                            id="memberBroadcastSelectedStatus"
                            class="member-broadcast-result-meta">
                        </div>
                    </div>
                </div>

                <input
                    type="hidden"
                    id="memberBroadcastYouthId">

                <div class="form-group">
                    <label>Delivery Channels</label>

                    <div class="member-broadcast-channel">
                        <input
                            type="checkbox"
                            id="memberBroadcastPush"
                            value="push"
                            disabled
                            aria-disabled="true">

                        <label for="memberBroadcastPush">
                            <strong>Push Notification</strong>
                            <small id="memberBroadcastPushState">
                                Select a member first.
                            </small>
                        </label>
                    </div>

                    <div class="member-broadcast-channel">
                        <input
                            type="checkbox"
                            id="memberBroadcastEmail"
                            value="email"
                            disabled
                            aria-disabled="true">

                        <label for="memberBroadcastEmail">
                            <strong>Email</strong>
                            <small id="memberBroadcastEmailState">
                                Select a member first.
                            </small>
                        </label>
                    </div>

                    <div class="member-broadcast-note">
                        🔔 A Portal Inbox notification is always created,
                        even when an external channel is unavailable.
                    </div>
                </div>

                <div class="form-group">
                    <label for="memberBroadcastTitle">
                        Message Title *
                    </label>

                    <input
                        type="text"
                        id="memberBroadcastTitle"
                        class="form-control"
                        maxlength="180"
                        required>
                </div>

                <div class="form-group">
                    <label for="memberBroadcastMessage">
                        Message *
                    </label>

                    <textarea
                        id="memberBroadcastMessage"
                        class="form-control"
                        rows="5"
                        maxlength="5000"
                        required></textarea>
                </div>

                <button
                    type="submit"
                    class="btn btn-primary"
                    id="memberBroadcastSend"
                    style="width:100%;background:#7C3AED;">
                    Send Private Message
                </button>

            </form>
        `;

        const historyContainer =
            byId(
                'broadcastHistoryContainer'
            );

        const historyCard =
            historyContainer &&
            typeof historyContainer.closest === 'function'
                ? historyContainer.closest(
                    '.card'
                )
                : null;

        if (
            historyCard &&
            historyCard.parentElement ===
                broadcastSection
        ) {
            broadcastSection.insertBefore(
                card,
                historyCard
            );
        } else {
            broadcastSection.appendChild(
                card
            );
        }

        bind();
    }

    function clearResults() {
        const results =
            byId(
                'memberBroadcastSearchResults'
            );

        if (!results) {
            return;
        }

        results.replaceChildren();
        results.classList.remove(
            'active'
        );
    }

    function renderResults(members) {
        const results =
            byId(
                'memberBroadcastSearchResults'
            );

        if (!results) {
            return;
        }

        results.replaceChildren();

        if (
            !Array.isArray(members) ||
            members.length === 0
        ) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.className =
                'member-broadcast-result';

            empty.textContent =
                'No matching members found.';

            results.appendChild(
                empty
            );

            results.classList.add(
                'active'
            );

            return;
        }

        for (
            const member
            of members
        ) {
            const button =
                document.createElement(
                    'button'
                );

            button.type =
                'button';

            button.className =
                'member-broadcast-result';

            button.setAttribute(
                'role',
                'option'
            );

            const name =
                document.createElement(
                    'div'
                );

            name.className =
                'member-broadcast-result-name';

            name.textContent =
                member.name ||
                `Member ${member.id}`;

            const meta =
                document.createElement(
                    'div'
                );

            meta.className =
                'member-broadcast-result-meta';

            meta.textContent =
                [
                    statusText(
                        'Push',
                        member.push_state
                    ),
                    statusText(
                        'Email',
                        member.email_state
                    )
                ].join(' • ');

            button.append(
                name,
                meta
            );

            button.addEventListener(
                'click',
                () => {
                    selectMember(
                        member
                    );
                }
            );

            results.appendChild(
                button
            );
        }

        results.classList.add(
            'active'
        );
    }

    async function searchMembers() {
        const input =
            byId(
                'memberBroadcastSearch'
            );

        if (!input) {
            return;
        }

        const query =
            input.value.trim();

        if (
            query.length < 2
        ) {
            clearResults();
            return;
        }

        try {
            const response =
                await fetch(
                    `/api/communications/member-targets?q=${encodeURIComponent(query)}`,
                    {
                        credentials:
                            'same-origin',

                        cache:
                            'no-store'
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                throw new Error(
                    data.error ||
                    'Member search failed'
                );
            }

            renderResults(
                data.members
            );
        } catch (error) {
            clearResults();

            const results =
                byId(
                    'memberBroadcastSearchResults'
                );

            if (results) {
                const item =
                    document.createElement(
                        'div'
                    );

                item.className =
                    'member-broadcast-result';

                item.textContent =
                    'Member search is temporarily unavailable.';

                results.appendChild(
                    item
                );

                results.classList.add(
                    'active'
                );
            }
        }
    }

    function scheduleSearch() {
        clearTimeout(
            state.timer
        );

        state.timer =
            setTimeout(
                searchMembers,
                250
            );
    }

    function selectMember(member) {
        state.selected =
            member;

        const youthId =
            byId(
                'memberBroadcastYouthId'
            );

        const selectedBox =
            byId(
                'memberBroadcastSelected'
            );

        const selectedName =
            byId(
                'memberBroadcastSelectedName'
            );

        const selectedStatus =
            byId(
                'memberBroadcastSelectedStatus'
            );

        const push =
            byId(
                'memberBroadcastPush'
            );

        const email =
            byId(
                'memberBroadcastEmail'
            );

        const pushState =
            byId(
                'memberBroadcastPushState'
            );

        const emailState =
            byId(
                'memberBroadcastEmailState'
            );

        youthId.value =
            String(member.id);

        selectedName.textContent =
            member.name ||
            `Member ${member.id}`;

        selectedStatus.textContent =
            [
                statusText(
                    'Push',
                    member.push_state
                ),
                statusText(
                    'Email',
                    member.email_state
                )
            ].join(' • ');

        selectedBox.hidden =
            false;

        /*
         * After a member has been selected the administrator may request
         * either external channel. Canonical delivery still performs the
         * final preference/subscription/verification checks server-side.
         */
        push.disabled =
            false;

        email.disabled =
            false;

        push.checked =
            false;

        email.checked =
            false;

        push.setAttribute(
            'aria-disabled',
            'false'
        );

        email.setAttribute(
            'aria-disabled',
            'false'
        );

        pushState.textContent =
            statusText(
                'Push',
                member.push_state
            );

        emailState.textContent =
            statusText(
                'Email',
                member.email_state
            );

        clearResults();
    }

    function summarizeDelivery(label, result) {
        if (
            !result ||
            result.requested !== true
        ) {
            return null;
        }

        const status =
            result.status ||
            'unknown';

        const labels = {
            sent:
                'sent',

            pending:
                'queued',

            skipped:
                'skipped',

            failed:
                'failed',

            retryable:
                'queued for retry',

            unavailable:
                'unavailable',

            unknown:
                'status unknown'
        };

        return (
            `${label}: ` +
            (
                labels[status] ||
                status
            )
        );
    }

    async function performSend(form) {
        const youthId =
            Number(
                byId(
                    'memberBroadcastYouthId'
                ).value
            );

        const title =
            byId(
                'memberBroadcastTitle'
            ).value.trim();

        const message =
            byId(
                'memberBroadcastMessage'
            ).value.trim();

        const channels =
            [];

        if (
            byId(
                'memberBroadcastPush'
            ).checked
        ) {
            channels.push(
                'push'
            );
        }

        if (
            byId(
                'memberBroadcastEmail'
            ).checked
        ) {
            channels.push(
                'email'
            );
        }

        if (
            !Number.isSafeInteger(
                youthId
            ) ||
            youthId <= 0
        ) {
            alert(
                'Please search and select a member first.'
            );
            return;
        }

        if (
            !title ||
            !message
        ) {
            alert(
                'Please enter a title and message.'
            );
            return;
        }

        const button =
            byId(
                'memberBroadcastSend'
            );

        const original =
            button.textContent;

        button.disabled =
            true;

        button.textContent =
            'Sending…';

        try {
            const response =
                await fetch(
                    '/api/communications/member-message',
                    {
                        method:
                            'POST',

                        credentials:
                            'same-origin',

                        cache:
                            'no-store',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                youth_id:
                                    youthId,

                                title,

                                message,

                                channels
                            })
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {
                throw new Error(
                    data.error ||
                    'Unable to send message.'
                );
            }

            const lines = [
                '✅ Private message created.',
                'Portal Inbox: delivered'
            ];

            const pushLine =
                summarizeDelivery(
                    'Push',
                    data.deliveries &&
                    data.deliveries.push
                );

            const emailLine =
                summarizeDelivery(
                    'Email',
                    data.deliveries &&
                    data.deliveries.email
                );

            if (pushLine) {
                lines.push(
                    pushLine
                );
            }

            if (emailLine) {
                lines.push(
                    emailLine
                );
            }

            if (data.warning) {
                lines.push(
                    data.warning
                );
            }

            alert(
                lines.join('\n')
            );

            if (


                form &&


                typeof form.reset === 'function'


            ) {


                form.reset();


            }

            state.selected =
                null;

            byId(
                'memberBroadcastYouthId'
            ).value =
                '';

            byId(
                'memberBroadcastSelected'
            ).hidden =
                true;

            const resetPush =
                byId(
                    'memberBroadcastPush'
                );

            const resetEmail =
                byId(
                    'memberBroadcastEmail'
                );

            if (resetPush) {
                resetPush.checked =
                    false;

                resetPush.disabled =
                    true;

                resetPush.setAttribute(
                    'aria-disabled',
                    'true'
                );
            }

            if (resetEmail) {
                resetEmail.checked =
                    false;

                resetEmail.disabled =
                    true;

                resetEmail.setAttribute(
                    'aria-disabled',
                    'true'
                );
            }

            byId(
                'memberBroadcastPushState'
            ).textContent =
                'Select a member first.';

            byId(
                'memberBroadcastEmailState'
            ).textContent =
                'Select a member first.';

        } catch (error) {
            alert(
                '❌ ' +
                (
                    error &&
                    error.message
                        ? error.message
                        : 'Unable to send message.'
                )
            );
        } finally {
            button.disabled =
                false;

            button.textContent =
                original;
        }
    }

    function submit(event) {
        event.preventDefault();

        /*
         * currentTarget is cleared after the synchronous event handler
         * returns. Keep the form reference before opening confirmation.
         */
        const form =
            event.currentTarget;

        if (
            !state.selected
        ) {
            alert(
                'Please search and select a member first.'
            );
            return;
        }

        const name =
            state.selected.name ||
            `Member ${state.selected.id}`;

        const execute =
            () =>
                performSend(
                    form
                );

        if (
            typeof root
                .triggerActionConfirmation ===
            'function'
        ) {
            root
                .triggerActionConfirmation(
                    `Send this private Portal message to ${name}?`,
                    execute
                );

            return;
        }

        if (
            root.confirm(
                `Send this private Portal message to ${name}?`
            )
        ) {
            void execute();
        }
    }

    function bind() {
        const search =
            byId(
                'memberBroadcastSearch'
            );

        const form =
            byId(
                'memberBroadcastForm'
            );

        if (search) {
            search.addEventListener(
                'input',
                scheduleSearch
            );
        }

        if (form) {
            form.addEventListener(
                'submit',
                submit
            );
        }
    }

    function relabelCommunicationsNavigation() {
        const buttons =
            document.querySelectorAll(
                '.nav-btn[data-target="communicationsAdminTab"], ' +
                '.nav-btn[onclick*="communicationsAdminTab"]'
            );

        buttons.forEach(
            button => {
                button.textContent =
                    '💬 Communications';

                button.title =
                    'Communications';
            }
        );
    }

    function ensureUi() {
        installStyles();
        relabelCommunicationsNavigation();
        installCard();
    }

    function installSectionObserver() {
        const section =
            byId(
                'communicationsBroadcastSection'
            );

        if (
            !section ||
            section.dataset
                .memberBroadcastObserved ===
                'true' ||
            typeof MutationObserver !==
                'function'
        ) {
            return;
        }

        section.dataset
            .memberBroadcastObserved =
            'true';

        const observer =
            new MutationObserver(
                () => {
                    if (
                        !byId(
                            'memberBroadcastCard'
                        )
                    ) {
                        Promise.resolve()
                            .then(
                                ensureUi
                            )
                            .catch(
                                () => {}
                            );
                    }
                }
            );

        observer.observe(
            section,
            {
                childList:
                    true
            }
        );
    }

    function installLifecycleHooks() {
        if (
            installLifecycleHooks
                .installed
        ) {
            return;
        }

        installLifecycleHooks.installed =
            true;

        document.addEventListener(
            'click',
            event => {
                const target =
                    event &&
                    event.target &&
                    typeof event.target
                        .closest ===
                        'function'
                        ? event.target
                            .closest(
                                '[data-target="communicationsAdminTab"], ' +
                                '[onclick*="communicationsAdminTab"]'
                            )
                        : null;

                if (!target) {
                    return;
                }

                Promise.resolve()
                    .then(
                        () => {
                            ensureUi();
                            installSectionObserver();
                        }
                    )
                    .catch(
                        () => {}
                    );
            }
        );

        if (
            typeof root.buildNav ===
                'function' &&
            !root.buildNav
                .memberBroadcastWrapped
        ) {
            const previousBuildNav =
                root.buildNav;

            const wrappedBuildNav =
                function(...args) {
                    const result =
                        previousBuildNav
                            .apply(
                                this,
                                args
                            );

                    Promise.resolve()
                        .then(
                            ensureUi
                        )
                        .catch(
                            () => {}
                        );

                    return result;
                };

            wrappedBuildNav
                .memberBroadcastWrapped =
                true;

            root.buildNav =
                wrappedBuildNav;
        }

        if (
            typeof root
                .applyGranularPermissions ===
                'function' &&
            !root
                .applyGranularPermissions
                .memberBroadcastWrapped
        ) {
            const previousApplyPermissions =
                root
                    .applyGranularPermissions;

            const wrappedPermissions =
                function(...args) {
                    const result =
                        previousApplyPermissions
                            .apply(
                                this,
                                args
                            );

                    Promise.resolve()
                        .then(
                            () => {
                                ensureUi();
                                installSectionObserver();
                            }
                        )
                        .catch(
                            () => {}
                        );

                    return result;
                };

            wrappedPermissions
                .memberBroadcastWrapped =
                true;

            root.applyGranularPermissions =
                wrappedPermissions;
        }
    }

    function init() {
        ensureUi();
        installSectionObserver();
        installLifecycleHooks();
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }

    root.MemberBroadcast =
        Object.freeze({
            init,
            searchMembers
        });

})(
    window
);
