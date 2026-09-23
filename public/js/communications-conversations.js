'use strict';

(function communicationsConversations(root) {
    const state = {
        conversations: [],
        expandedId: null,
        loading: false
    };

    function byId(id) {
        return document.getElementById(id);
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

    function formatTime(value) {
        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return '';
        }

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
    }

    function preview(value) {
        const text =
            typeof value === 'string'
                ? value.trim()
                : '';

        return text.length > 120
            ? `${text.slice(0, 117)}…`
            : text;
    }

    function installStyles() {
        if (
            byId(
                'communicationsConversationStyles'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'communicationsConversationStyles';

        style.textContent = `
            .admin-conversation-item {
                border:1px solid #e2e8f0;
                border-radius:11px;
                overflow:hidden;
                margin:0 0 9px;
                background:#fff;
            }

            .admin-conversation-item.unread {
                border-color:#7c3aed;
            }

            .admin-conversation-toggle {
                width:100%;
                border:0;
                background:#fff;
                padding:12px;
                text-align:left;
                cursor:pointer;
            }

            .admin-conversation-top {
                display:flex;
                justify-content:space-between;
                gap:10px;
            }

            .admin-conversation-title {
                font-weight:800;
            }

            .admin-conversation-meta,
            .admin-conversation-preview {
                color:var(--text-muted,#64748b);
                font-size:.78rem;
                line-height:1.4;
                margin-top:4px;
            }

            .admin-conversation-badge {
                background:#7c3aed;
                color:#fff;
                border-radius:999px;
                padding:3px 7px;
                font-size:.68rem;
                font-weight:800;
                white-space:nowrap;
            }

            .admin-conversation-body {
                border-top:1px solid #e2e8f0;
                padding:12px;
            }

            .admin-conversation-message {
                padding:9px 11px;
                border-radius:9px;
                margin-bottom:8px;
                background:#f8fafc;
            }

            .admin-conversation-message.admin {
                background:#f5f3ff;
            }

            .admin-conversation-message-head {
                display:flex;
                justify-content:space-between;
                gap:10px;
                font-size:.75rem;
                color:var(--text-muted,#64748b);
                margin-bottom:4px;
            }

            .admin-conversation-message-text {
                white-space:pre-wrap;
                word-break:break-word;
                line-height:1.45;
            }

            .admin-conversation-controls {
                display:grid;
                gap:8px;
                margin-top:12px;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function installCard() {
        const section =
            byId(
                'communicationsBroadcastSection'
            );

        if (
            !section ||
            byId(
                'directConversationsCard'
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
            'directConversationsCard';

        card.innerHTML = `
            <div
                style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
                <div>
                    <h2 style="color:#7C3AED;margin-bottom:4px;">
                        💬 Direct Conversations
                    </h2>

                    <p
                        style="margin:0;color:var(--text-muted,#64748b);font-size:.82rem;">
                        Private Admin ↔ Member and Support conversations.
                        Unread member replies appear first.
                    </p>
                </div>

                <button
                    type="button"
                    id="directConversationsRefresh"
                    class="btn btn-outline btn-sm">
                    Refresh
                </button>
            </div>

            <div
                id="directConversationsList"
                style="margin-top:14px;">
            </div>
        `;

        const memberCard =
            byId(
                'memberBroadcastCard'
            );

        if (
            memberCard &&
            memberCard.parentElement ===
                section
        ) {
            memberCard.insertAdjacentElement(
                'afterend',
                card
            );
        } else {
            section.appendChild(
                card
            );
        }

        const refresh =
            byId(
                'directConversationsRefresh'
            );

        if (refresh) {
            refresh.addEventListener(
                'click',
                () => {
                    void load();
                }
            );
        }

        void load();
    }

    async function load() {
        if (state.loading) {
            return;
        }

        const list =
            byId(
                'directConversationsList'
            );

        if (!list) {
            return;
        }

        state.loading =
            true;

        try {
            const result =
                await requestJson(
                    '/api/communications/conversations'
                );

            state.conversations =
                Array.isArray(
                    result.conversations
                )
                    ? result.conversations
                    : [];

            renderList();

        } catch (error) {
            list.textContent =
                'Direct Conversations are temporarily unavailable.';

        } finally {
            state.loading =
                false;
        }
    }

    function renderList() {
        const list =
            byId(
                'directConversationsList'
            );

        if (!list) return;

        list.replaceChildren();

        if (
            state.conversations.length ===
            0
        ) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.style.cssText =
                'padding:18px;text-align:center;color:var(--text-muted,#64748b);';

            empty.textContent =
                'No direct conversations yet.';

            list.appendChild(
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
                'admin-conversation-item' +
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
                'admin-conversation-toggle';

            const top =
                document.createElement(
                    'div'
                );

            top.className =
                'admin-conversation-top';

            const left =
                document.createElement(
                    'div'
                );

            const title =
                document.createElement(
                    'div'
                );

            title.className =
                'admin-conversation-title';

            title.textContent =
                `${conversation.member_name || `Member ${conversation.member_youth_id}`} — ${conversation.subject || 'Private Conversation'}`;

            const meta =
                document.createElement(
                    'div'
                );

            meta.className =
                'admin-conversation-meta';

            meta.textContent =
                `${conversation.kind === 'support' ? 'Support' : 'Admin'} • ${conversation.status === 'closed' ? 'Closed' : 'Open'} • ${Number(conversation.message_count || 0)} messages • ${formatTime(conversation.latest_message_at || conversation.updated_at)}`;

            const latest =
                document.createElement(
                    'div'
                );

            latest.className =
                'admin-conversation-preview';

            latest.textContent =
                preview(
                    conversation
                        .latest_message
                );

            left.append(
                title,
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
                    'admin-conversation-badge';

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
                `adminConversationBody-${conversation.id}`;

            body.className =
                'admin-conversation-body';

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

            list.appendChild(
                article
            );
        }
    }

    async function toggleThread(id) {
        const body =
            byId(
                `adminConversationBody-${id}`
            );

        if (!body) return;

        if (!body.hidden) {
            body.hidden =
                true;

            state.expandedId =
                null;

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
                    `/api/communications/conversations/${encodeURIComponent(id)}`
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

        for (
            const message
            of (
                Array.isArray(messages)
                    ? messages
                    : []
            )
        ) {
            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'admin-conversation-message ' +
                (
                    message.sender_role ===
                        'admin'
                        ? 'admin'
                        : 'member'
                );

            const head =
                document.createElement(
                    'div'
                );

            head.className =
                'admin-conversation-message-head';

            const sender =
                document.createElement(
                    'strong'
                );

            sender.textContent =
                message.sender_display_name ||
                (
                    message.sender_role ===
                        'admin'
                        ? 'FOG Admin'
                        : 'Member'
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
                'admin-conversation-message-text';

            text.textContent =
                message.message ||
                '';

            item.append(
                head,
                text
            );

            container.appendChild(
                item
            );
        }

        if (
            conversation.status ===
                'open'
        ) {
            const controls =
                document.createElement(
                    'div'
                );

            controls.className =
                'admin-conversation-controls';

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

            textarea.placeholder =
                'Write an admin reply…';

            const send =
                document.createElement(
                    'button'
                );

            send.type =
                'button';

            send.className =
                'btn btn-primary';

            send.textContent =
                'Send Reply';

            send.addEventListener(
                'click',
                async () => {
                    const message =
                        textarea.value.trim();

                    if (!message) {
                        return;
                    }

                    send.disabled =
                        true;

                    try {
                        await requestJson(
                            `/api/communications/conversations/${encodeURIComponent(conversation.id)}/messages`,
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

                        await load();

                    } catch (error) {
                        alert(
                            error.message ||
                            'Unable to send reply.'
                        );
                    } finally {
                        send.disabled =
                            false;
                    }
                }
            );

            const close =
                document.createElement(
                    'button'
                );

            close.type =
                'button';

            close.className =
                'btn btn-outline';

            close.textContent =
                'Close Conversation / Replies';

            close.addEventListener(
                'click',
                async () => {
                    if (
                        !root.confirm(
                            'Close this conversation? The history will remain visible, but the member will no longer be able to reply.'
                        )
                    ) {
                        return;
                    }

                    close.disabled =
                        true;

                    try {
                        await requestJson(
                            `/api/communications/conversations/${encodeURIComponent(conversation.id)}/close`,
                            {
                                method:
                                    'POST'
                            }
                        );

                        state.expandedId =
                            null;

                        await load();

                    } catch (error) {
                        alert(
                            error.message ||
                            'Unable to close the conversation.'
                        );
                    } finally {
                        close.disabled =
                            false;
                    }
                }
            );

            controls.append(
                textarea,
                send,
                close
            );

            container.appendChild(
                controls
            );

        } else {
            const closed =
                document.createElement(
                    'div'
                );

            closed.className =
                'admin-conversation-meta';

            closed.textContent =
                'Conversation closed. History remains available.';

            container.appendChild(
                closed
            );
        }
    }

    function ensureUi() {
        installStyles();
        installCard();
    }

    function init() {
        ensureUi();

        document.addEventListener(
            'click',
            event => {
                const target =
                    event.target &&
                    typeof event.target.closest ===
                        'function'
                        ? event.target.closest(
                            '[data-target="communicationsAdminTab"], [onclick*="communicationsAdminTab"]'
                        )
                        : null;

                if (!target) return;

                setTimeout(
                    () => {
                        ensureUi();
                        void load();
                    },
                    0
                );
            }
        );

        if (
            typeof MutationObserver ===
                'function'
        ) {
            const observer =
                new MutationObserver(
                    () => {
                        ensureUi();
                    }
                );

            const tab =
                byId(
                    'communicationsAdminTab'
                );

            if (tab) {
                observer.observe(
                    tab,
                    {
                        childList:
                            true,
                        subtree:
                            true
                    }
                );
            }
        }
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

    root.CommunicationsConversations =
        Object.freeze({
            load,
            ensureUi
        });

})(
    window
);
