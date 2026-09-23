'use strict';

(function inboxConversationsFeature(root) {
    const state = {
        conversations: [],
        expandedId: null,
        loading: false,
        observer: null
    };

    const SUPPORT_CATEGORIES = [
        'Account & Sign-in',
        'Profile & Member Record',
        'Events & Attendance',
        'Ministry & Community',
        'Technical Problem',
        'Other'
    ];

    function byId(id) {
        return document.getElementById(id);
    }

    function formatTime(value) {
        if (!value) return '';

        const date = new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return '';
        }

        try {
            return date.toLocaleString(
                undefined,
                {
                    month:
                        'short',
                    day:
                        'numeric',
                    hour:
                        'numeric',
                    minute:
                        '2-digit'
                }
            );
        } catch {
            return value;
        }
    }

    function preview(value) {
        const text =
            typeof value === 'string'
                ? value.trim()
                : '';

        return text.length > 110
            ? `${text.slice(0, 107)}…`
            : text;
    }

    function requestJson(
        url,
        options = {}
    ) {
        return fetch(
            url,
            {
                credentials:
                    'same-origin',
                cache:
                    'no-store',
                ...options,
                headers: {
                    Accept:
                        'application/json',
                    ...(
                        options.headers ||
                        {}
                    )
                }
            }
        ).then(
            async response => {
                let body = null;

                try {
                    body =
                        await response.json();
                } catch {
                    body =
                        null;
                }

                if (
                    !response.ok ||
                    !body ||
                    body.success === false
                ) {
                    throw new Error(
                        body &&
                        (
                            body.error ||
                            body.message
                        )
                            ? (
                                body.error ||
                                body.message
                            )
                            : 'Request failed.'
                    );
                }

                return body;
            }
        );
    }

    function installStyles() {
        if (
            byId(
                'directInboxConversationStyles'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'directInboxConversationStyles';

        style.textContent = `
            .direct-inbox-actions {
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:10px;
                margin:0 0 14px;
            }

            .direct-inbox-action {
                border:1px solid #e2e8f0;
                background:#fff;
                border-radius:12px;
                padding:12px 10px;
                font-weight:800;
                cursor:pointer;
                text-align:center;
            }

            .direct-inbox-compose {
                margin:0 0 16px;
                padding:14px;
                border:1px solid #e2e8f0;
                border-radius:12px;
                background:#f8fafc;
            }

            .direct-inbox-thread {
                border:1px solid #e2e8f0;
                border-radius:12px;
                background:#fff;
                margin:0 0 10px;
                overflow:hidden;
            }

            .direct-inbox-thread.unread {
                border-color:#7c3aed;
                box-shadow:0 0 0 1px rgba(124,58,237,.08);
            }

            .direct-inbox-thread-toggle {
                width:100%;
                border:0;
                background:transparent;
                padding:13px 14px;
                cursor:pointer;
                text-align:left;
            }

            .direct-inbox-thread-top {
                display:flex;
                justify-content:space-between;
                gap:10px;
                align-items:flex-start;
            }

            .direct-inbox-thread-subject {
                font-weight:800;
                color:var(--text-main,#1f2937);
            }

            .direct-inbox-thread-meta,
            .direct-inbox-thread-preview {
                font-size:.8rem;
                color:var(--text-muted,#64748b);
                margin-top:4px;
                line-height:1.4;
            }

            .direct-inbox-unread {
                display:inline-flex;
                align-items:center;
                border-radius:999px;
                background:#7c3aed;
                color:#fff;
                font-size:.7rem;
                font-weight:800;
                padding:3px 7px;
                white-space:nowrap;
            }

            .direct-inbox-thread-body {
                border-top:1px solid #e2e8f0;
                padding:12px 14px 14px;
            }

            .direct-inbox-message {
                padding:10px 12px;
                border-radius:10px;
                margin:0 0 9px;
                background:#f8fafc;
            }

            .direct-inbox-message.member {
                background:#f5f3ff;
            }

            .direct-inbox-message-head {
                display:flex;
                justify-content:space-between;
                gap:10px;
                font-size:.76rem;
                color:var(--text-muted,#64748b);
                margin-bottom:5px;
            }

            .direct-inbox-message-text {
                white-space:pre-wrap;
                word-break:break-word;
                line-height:1.5;
            }

            .direct-inbox-reply {
                margin-top:12px;
                display:grid;
                gap:8px;
            }

            .direct-inbox-empty {
                text-align:center;
                padding:18px;
                color:var(--text-muted,#64748b);
                border:1px dashed #cbd5e1;
                border-radius:12px;
                background:#fff;
            }

            @media (max-width:520px) {
                .direct-inbox-actions {
                    grid-template-columns:1fr;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function relabelInbox() {
        const inbox =
            byId(
                'inboxTab'
            );

        if (!inbox) {
            return;
        }

        const heading =
            inbox.querySelector(
                'h2'
            );

        if (heading) {
            heading.textContent =
                '📥 Inbox';
        }

        const updates =
            byId(
                'btnInboxNotifications'
            );

        if (updates) {
            updates.textContent =
                '📥 Inbox';
        }

        const summary =
            byId(
                'notificationInboxSummary'
            );

        if (
            summary &&
            /updates/i.test(
                summary.textContent ||
                ''
            )
        ) {
            summary.textContent =
                'Your messages and community updates';
        }
    }

    function buildPanel() {
        const view =
            byId(
                'inboxNotificationsView'
            );

        if (
            !view ||
            byId(
                'directInboxConversationPanel'
            )
        ) {
            return;
        }

        const panel =
            document.createElement(
                'section'
            );

        panel.id =
            'directInboxConversationPanel';

        const actions =
            document.createElement(
                'div'
            );

        actions.className =
            'direct-inbox-actions';

        const adminButton =
            document.createElement(
                'button'
            );

        adminButton.type =
            'button';

        adminButton.className =
            'direct-inbox-action';

        adminButton.textContent =
            '💬 Message Admin';

        adminButton.addEventListener(
            'click',
            () =>
                openComposer(
                    'admin'
                )
        );

        const supportButton =
            document.createElement(
                'button'
            );

        supportButton.type =
            'button';

        supportButton.className =
            'direct-inbox-action';

        supportButton.textContent =
            '🛟 Contact Support';

        supportButton.addEventListener(
            'click',
            () =>
                openComposer(
                    'support'
                )
        );

        actions.append(
            adminButton,
            supportButton
        );

        const compose =
            document.createElement(
                'form'
            );

        compose.id =
            'directInboxCompose';

        compose.className =
            'direct-inbox-compose';

        compose.hidden =
            true;

        compose.innerHTML = `
            <input
                type="hidden"
                id="directInboxKind">

            <div
                id="directInboxComposeTitle"
                style="font-weight:800;margin-bottom:10px;">
            </div>

            <div
                id="directInboxSupportCategoryWrap"
                style="display:none;margin-bottom:10px;">
                <label
                    for="directInboxSupportCategory"
                    style="display:block;font-weight:700;margin-bottom:5px;">
                    Support Category
                </label>

                <select
                    id="directInboxSupportCategory"
                    class="form-control">
                </select>
            </div>

            <div style="margin-bottom:10px;">
                <label
                    for="directInboxSubject"
                    style="display:block;font-weight:700;margin-bottom:5px;">
                    Subject
                </label>

                <input
                    id="directInboxSubject"
                    class="form-control"
                    maxlength="180"
                    required>
            </div>

            <div style="margin-bottom:10px;">
                <label
                    for="directInboxMessage"
                    style="display:block;font-weight:700;margin-bottom:5px;">
                    Message
                </label>

                <textarea
                    id="directInboxMessage"
                    class="form-control"
                    rows="4"
                    maxlength="5000"
                    required>
                </textarea>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button
                    type="submit"
                    class="btn btn-primary">
                    Send Message
                </button>

                <button
                    type="button"
                    class="btn btn-outline"
                    id="directInboxComposeCancel">
                    Cancel
                </button>
            </div>
        `;

        compose.addEventListener(
            'submit',
            submitComposer
        );

        const cancel =
            compose.querySelector(
                '#directInboxComposeCancel'
            );

        if (cancel) {
            cancel.addEventListener(
                'click',
                () => {
                    compose.reset();
                    compose.hidden =
                        true;
                }
            );
        }

        const heading =
            document.createElement(
                'div'
            );

        heading.style.cssText =
            'font-weight:800;margin:14px 0 8px;';

        heading.textContent =
            'Private Conversations';

        const list =
            document.createElement(
                'div'
            );

        list.id =
            'directInboxConversationList';

        panel.append(
            actions,
            compose,
            heading,
            list
        );

        view.insertBefore(
            panel,
            view.firstChild
        );

        populateSupportCategories();
        void loadConversations();
    }

    function populateSupportCategories() {
        const select =
            byId(
                'directInboxSupportCategory'
            );

        if (!select) return;

        select.replaceChildren();

        const prompt =
            document.createElement(
                'option'
            );

        prompt.value =
            '';

        prompt.textContent =
            'Choose a category';

        select.appendChild(
            prompt
        );

        for (
            const category
            of SUPPORT_CATEGORIES
        ) {
            const option =
                document.createElement(
                    'option'
                );

            option.value =
                category;

            option.textContent =
                category;

            select.appendChild(
                option
            );
        }
    }

    function openComposer(kind) {
        const compose =
            byId(
                'directInboxCompose'
            );

        if (!compose) return;

        const kindInput =
            byId(
                'directInboxKind'
            );

        const title =
            byId(
                'directInboxComposeTitle'
            );

        const supportWrap =
            byId(
                'directInboxSupportCategoryWrap'
            );

        kindInput.value =
            kind;

        title.textContent =
            kind === 'support'
                ? '🛟 Contact Support'
                : '💬 Message Admin';

        supportWrap.style.display =
            kind === 'support'
                ? 'block'
                : 'none';

        compose.hidden =
            false;

        const subject =
            byId(
                'directInboxSubject'
            );

        if (subject) {
            subject.focus();
        }
    }

    async function submitComposer(event) {
        event.preventDefault();

        const form =
            event.currentTarget;

        const kind =
            byId(
                'directInboxKind'
            ).value;

        const subject =
            byId(
                'directInboxSubject'
            ).value.trim();

        const message =
            byId(
                'directInboxMessage'
            ).value.trim();

        const category =
            byId(
                'directInboxSupportCategory'
            ).value;

        const button =
            form.querySelector(
                'button[type="submit"]'
            );

        button.disabled =
            true;

        try {
            const body = {
                kind,
                subject,
                message
            };

            if (
                kind === 'support'
            ) {
                body.support_category =
                    category;
            }

            const result =
                await requestJson(
                    '/api/inbox/conversations',
                    {
                        method:
                            'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body:
                            JSON.stringify(
                                body
                            )
                    }
                );

            form.reset();
            form.hidden =
                true;

            state.expandedId =
                Number(
                    result.conversation_id
                );

            await loadConversations();

        } catch (error) {
            alert(
                error.message ||
                'Unable to send the message.'
            );
        } finally {
            button.disabled =
                false;
        }
    }

    async function loadConversations() {
        if (state.loading) {
            return;
        }

        const container =
            byId(
                'directInboxConversationList'
            );

        if (!container) {
            return;
        }

        state.loading =
            true;

        try {
            const result =
                await requestJson(
                    '/api/inbox/conversations'
                );

            state.conversations =
                Array.isArray(
                    result.conversations
                )
                    ? result.conversations
                    : [];

            renderConversationList();

            const requested =
                new URLSearchParams(
                    root.location.search
                ).get(
                    'conversation'
                );

            const requestedId =
                Number(
                    requested
                );

            if (
                Number.isSafeInteger(
                    requestedId
                ) &&
                requestedId > 0
            ) {
                state.expandedId =
                    requestedId;
            }

            if (
                state.expandedId
            ) {
                const body =
                    byId(
                        `directInboxThreadBody-${state.expandedId}`
                    );

                if (
                    body &&
                    body.hidden
                ) {
                    await toggleThread(
                        state.expandedId
                    );
                }
            }

        } catch (error) {
            container.replaceChildren();

            const empty =
                document.createElement(
                    'div'
                );

            empty.className =
                'direct-inbox-empty';

            empty.textContent =
                'Private conversations are temporarily unavailable.';

            container.appendChild(
                empty
            );

        } finally {
            state.loading =
                false;
        }
    }

    function renderConversationList() {
        const container =
            byId(
                'directInboxConversationList'
            );

        if (!container) return;

        container.replaceChildren();

        if (
            state.conversations.length ===
            0
        ) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.className =
                'direct-inbox-empty';

            empty.textContent =
                'No private conversations yet.';

            container.appendChild(
                empty
            );

            return;
        }

        for (
            const conversation
            of state.conversations
        ) {
            const article =
                document.createElement(
                    'article'
                );

            article.className =
                'direct-inbox-thread' +
                (
                    Number(
                        conversation
                            .unread_count
                    ) > 0
                        ? ' unread'
                        : ''
                );

            const toggle =
                document.createElement(
                    'button'
                );

            toggle.type =
                'button';

            toggle.className =
                'direct-inbox-thread-toggle';

            const top =
                document.createElement(
                    'div'
                );

            top.className =
                'direct-inbox-thread-top';

            const left =
                document.createElement(
                    'div'
                );

            const subject =
                document.createElement(
                    'div'
                );

            subject.className =
                'direct-inbox-thread-subject';

            subject.textContent =
                conversation.subject ||
                'Private Conversation';

            const meta =
                document.createElement(
                    'div'
                );

            meta.className =
                'direct-inbox-thread-meta';

            const kind =
                conversation.kind ===
                    'support'
                    ? 'Support'
                    : 'Admin';

            meta.textContent =
                `${kind} • ${Number(conversation.message_count || 0)} message${Number(conversation.message_count || 0) === 1 ? '' : 's'} • ${formatTime(conversation.latest_message_at || conversation.updated_at)}`;

            const latest =
                document.createElement(
                    'div'
                );

            latest.className =
                'direct-inbox-thread-preview';

            latest.textContent =
                preview(
                    conversation
                        .latest_message
                );

            left.append(
                subject,
                meta,
                latest
            );

            top.appendChild(
                left
            );

            const unread =
                Number(
                    conversation
                        .unread_count
                );

            if (unread > 0) {
                const badge =
                    document.createElement(
                        'span'
                    );

                badge.className =
                    'direct-inbox-unread';

                badge.textContent =
                    `${unread} unread`;

                top.appendChild(
                    badge
                );
            }

            toggle.appendChild(
                top
            );

            const body =
                document.createElement(
                    'div'
                );

            body.id =
                `directInboxThreadBody-${conversation.id}`;

            body.className =
                'direct-inbox-thread-body';

            body.hidden =
                true;

            toggle.addEventListener(
                'click',
                () => {
                    void toggleThread(
                        Number(
                            conversation.id
                        )
                    );
                }
            );

            article.append(
                toggle,
                body
            );

            container.appendChild(
                article
            );
        }
    }

    async function toggleThread(id) {
        const body =
            byId(
                `directInboxThreadBody-${id}`
            );

        if (!body) return;

        if (!body.hidden) {
            body.hidden =
                true;

            if (
                state.expandedId ===
                id
            ) {
                state.expandedId =
                    null;
            }

            return;
        }

        body.hidden =
            false;

        body.textContent =
            'Loading conversation…';

        state.expandedId =
            id;

        try {
            const result =
                await requestJson(
                    `/api/inbox/conversations/${encodeURIComponent(id)}`
                );

            renderThread(
                body,
                result.conversation,
                result.messages
            );

        } catch (error) {
            body.textContent =
                error.message ||
                'Unable to load the conversation.';
        }
    }

    function renderThread(
        container,
        conversation,
        messages
    ) {
        container.replaceChildren();

        const list =
            document.createElement(
                'div'
            );

        for (
            const message
            of (
                Array.isArray(messages)
                    ? messages
                    : []
            )
        ) {
            const card =
                document.createElement(
                    'div'
                );

            card.className =
                'direct-inbox-message ' +
                (
                    message.sender_role ===
                        'member'
                        ? 'member'
                        : 'admin'
                );

            const head =
                document.createElement(
                    'div'
                );

            head.className =
                'direct-inbox-message-head';

            const sender =
                document.createElement(
                    'strong'
                );

            sender.textContent =
                message.sender_role ===
                    'member'
                    ? 'You'
                    : (
                        message
                            .sender_display_name ||
                        'FOG Admin'
                    );

            const when =
                document.createElement(
                    'span'
                );

            when.textContent =
                formatTime(
                    message.created_at
                );

            head.append(
                sender,
                when
            );

            const text =
                document.createElement(
                    'div'
                );

            text.className =
                'direct-inbox-message-text';

            text.textContent =
                message.message ||
                '';

            card.append(
                head,
                text
            );

            list.appendChild(
                card
            );
        }

        container.appendChild(
            list
        );

        if (
            conversation.status ===
                'open' &&
            Number(
                conversation
                    .allow_member_reply
            ) === 1
        ) {
            const form =
                document.createElement(
                    'form'
                );

            form.className =
                'direct-inbox-reply';

            const textarea =
                document.createElement(
                    'textarea'
                );

            textarea.className =
                'form-control';

            textarea.rows =
                3;

            textarea.maxLength =
                5000;

            textarea.required =
                true;

            textarea.placeholder =
                'Write a reply…';

            const button =
                document.createElement(
                    'button'
                );

            button.type =
                'submit';

            button.className =
                'btn btn-primary';

            button.textContent =
                'Reply';

            form.append(
                textarea,
                button
            );

            form.addEventListener(
                'submit',
                async event => {
                    event.preventDefault();

                    const message =
                        textarea.value.trim();

                    if (!message) return;

                    button.disabled =
                        true;

                    try {
                        await requestJson(
                            `/api/inbox/conversations/${encodeURIComponent(conversation.id)}/messages`,
                            {
                                method:
                                    'POST',
                                headers: {
                                    'Content-Type':
                                        'application/json'
                                },
                                body:
                                    JSON.stringify({
                                        message
                                    })
                            }
                        );

                        await toggleThread(
                            Number(
                                conversation.id
                            )
                        );

                        await toggleThread(
                            Number(
                                conversation.id
                            )
                        );

                        await loadConversations();

                    } catch (error) {
                        alert(
                            error.message ||
                            'Unable to send the reply.'
                        );
                    } finally {
                        button.disabled =
                            false;
                    }
                }
            );

            container.appendChild(
                form
            );

        } else {
            const closed =
                document.createElement(
                    'div'
                );

            closed.className =
                'direct-inbox-thread-meta';

            closed.textContent =
                'Replies are closed for this conversation.';

            container.appendChild(
                closed
            );
        }
    }

    function ensureUi() {
        installStyles();
        relabelInbox();
        buildPanel();
    }

    function installObserver() {
        const inbox =
            byId(
                'inboxTab'
            );

        if (
            !inbox ||
            state.observer ||
            typeof MutationObserver !==
                'function'
        ) {
            return;
        }

        state.observer =
            new MutationObserver(
                () => {
                    Promise.resolve()
                        .then(
                            ensureUi
                        )
                        .catch(
                            () => {}
                        );
                }
            );

        state.observer.observe(
            inbox,
            {
                childList:
                    true,
                subtree:
                    true
            }
        );
    }

    function wrapInboxOpeners() {
        if (
            typeof root
                .openNotificationCenter ===
                'function' &&
            !root
                .openNotificationCenter
                .directConversationWrapped
        ) {
            const previous =
                root
                    .openNotificationCenter;

            const wrapped =
                async function(...args) {
                    const result =
                        await previous.apply(
                            this,
                            args
                        );

                    ensureUi();
                    await loadConversations();

                    return result;
                };

            wrapped
                .directConversationWrapped =
                true;

            root.openNotificationCenter =
                wrapped;
        }

        if (
            typeof root
                .switchInboxSubTab ===
                'function' &&
            !root
                .switchInboxSubTab
                .directConversationWrapped
        ) {
            const previous =
                root
                    .switchInboxSubTab;

            const wrapped =
                function(section, ...args) {
                    const result =
                        previous.call(
                            this,
                            section,
                            ...args
                        );

                    if (
                        section ===
                        'notifications'
                    ) {
                        Promise.resolve()
                            .then(
                                () => {
                                    ensureUi();
                                    return loadConversations();
                                }
                            )
                            .catch(
                                () => {}
                            );
                    }

                    return result;
                };

            wrapped
                .directConversationWrapped =
                true;

            root.switchInboxSubTab =
                wrapped;
        }
    }

    function init() {
        ensureUi();
        installObserver();
        wrapInboxOpeners();

        document.addEventListener(
            'click',
            event => {
                const target =
                    event.target &&
                    typeof event.target.closest ===
                        'function'
                        ? event.target.closest(
                            '#headerNotificationBell, [data-target="inboxTab"], [onclick*="inboxTab"]'
                        )
                        : null;

                if (!target) {
                    return;
                }

                setTimeout(
                    () => {
                        ensureUi();
                        void loadConversations();
                    },
                    0
                );
            }
        );
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

    root.InboxConversations =
        Object.freeze({
            load:
                loadConversations,
            ensureUi
        });

})(
    window
);
