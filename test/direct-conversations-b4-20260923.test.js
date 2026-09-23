'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const root =
    path.resolve(
        __dirname,
        '..'
    );

const server =
    fs.readFileSync(
        path.join(
            root,
            'server.js'
        ),
        'utf8'
    );

const index =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'index.html'
        ),
        'utf8'
    );

const memberInbox =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'inbox-conversations.js'
        ),
        'utf8'
    );

const adminInbox =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'communications-conversations.js'
        ),
        'utf8'
    );

const memberBroadcast =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'member-broadcast.js'
        ),
        'utf8'
    );

const sw =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'sw.js'
        ),
        'utf8'
    );

test(
    'B4 creates additive conversation and message tables with no member-to-member recipient field',
    () => {
        assert.match(
            server,
            /CREATE TABLE IF NOT EXISTS direct_conversations/
        );

        assert.match(
            server,
            /CREATE TABLE IF NOT EXISTS direct_conversation_messages/
        );

        assert.match(
            server,
            /member_youth_id INTEGER NOT NULL/
        );

        assert.doesNotMatch(
            server,
            /recipient_youth_id\s+INTEGER[\s\S]*direct_conversations/
        );
    }
);

test(
    'member conversation routes derive identity from req.auth.youthId',
    () => {
        assert.match(
            server,
            /function directConversationMemberId\(req\)[\s\S]*req\.auth[\s\S]*req\.auth\.youthId/
        );

        assert.match(
            server,
            /app\.get\(\s*'\/api\/inbox\/conversations'[\s\S]*requireAuth/
        );

        assert.match(
            server,
            /WHERE c\.id = \?[\s\S]*AND c\.member_youth_id = \?/
        );
    }
);

test(
    'members can initiate only Admin or Support conversations',
    () => {
        assert.match(
            server,
            /new Set\(\[\s*'admin',\s*'support'\s*\]\)/
        );

        assert.match(
            memberInbox,
            /💬 Message Admin/
        );

        assert.match(
            memberInbox,
            /🛟 Contact Support/
        );

        assert.doesNotMatch(
            memberInbox,
            /member search|find member|recipient member/i
        );
    }
);

test(
    'Support categories remain fixed and bounded',
    () => {
        for (
            const category
            of [
                'Account & Sign-in',
                'Profile & Member Record',
                'Events & Attendance',
                'Ministry & Community',
                'Technical Problem',
                'Other'
            ]
        ) {
            assert.ok(
                server.includes(
                    `'${category}'`
                )
            );

            assert.ok(
                memberInbox.includes(
                    `'${category}'`
                )
            );
        }
    }
);

test(
    'admin conversation APIs retain canonical Communications authority',
    () => {
        for (
            const route
            of [
                '/api/communications/conversations',
                '/api/communications/conversations/:id',
                '/api/communications/conversations/:id/messages',
                '/api/communications/conversations/:id/close'
            ]
        ) {
            assert.ok(
                server.includes(
                    route
                )
            );
        }

        assert.match(
            server,
            /requireAllPermissions\(\[\s*'access_communications',\s*'edit_entries'\s*\]\)/
        );
    }
);

test(
    'conversation messages are append-only and close preserves history',
    () => {
        assert.doesNotMatch(
            server,
            /DELETE FROM direct_conversation_messages/
        );

        assert.doesNotMatch(
            server,
            /UPDATE direct_conversation_messages[\s\S]*SET[\s\S]*message\s*=/
        );

        assert.match(
            server,
            /status = 'closed'/
        );

        assert.match(
            server,
            /allow_member_reply = 0/
        );
    }
);

test(
    'Direct Member Message exposes Allow member to reply and submits allow_reply',
    () => {
        assert.match(
            memberBroadcast,
            /memberBroadcastAllowReply/
        );

        assert.match(
            memberBroadcast,
            /Allow member to reply/
        );

        assert.match(
            memberBroadcast,
            /allow_reply:/
        );

        assert.match(
            server,
            /body\.allow_reply ===[\s\S]*true/
        );
    }
);

test(
    'member Inbox is relabeled and private threads are collapsed by default',
    () => {
        assert.match(
            memberInbox,
            /📥 Inbox/
        );

        assert.match(
            memberInbox,
            /body\.hidden =\s*true/
        );

        assert.match(
            memberInbox,
            /Private Conversations/
        );

        assert.match(
            memberInbox,
            /unread_count/
        );
    }
);

test(
    'admin Direct Conversations are collapsed and support Reply plus Close Conversation',
    () => {
        assert.match(
            adminInbox,
            /💬 Direct Conversations/
        );

        assert.match(
            adminInbox,
            /body\.hidden =\s*true/
        );

        assert.match(
            adminInbox,
            /Send Reply/
        );

        assert.match(
            adminInbox,
            /Close Conversation \/ Replies/
        );
    }
);

test(
    'member and admin message content is rendered through textContent',
    () => {
        assert.match(
            memberInbox,
            /text\.textContent =/
        );

        assert.match(
            adminInbox,
            /text\.textContent =/
        );

        assert.doesNotMatch(
            memberInbox,
            /innerHTML\s*=\s*message\.message/
        );

        assert.doesNotMatch(
            adminInbox,
            /innerHTML\s*=\s*message\.message/
        );
    }
);

test(
    'B4 client assets are versioned and included in PWA v84',
    () => {
        assert.match(
            index,
            /member-broadcast\.js\?v=20260923b5/
        );

        assert.match(
            index,
            /inbox-conversations\.js\?v=1/
        );

        assert.match(
            index,
            /communications-conversations\.js\?v=1/
        );

        assert.match(
            sw,
            /fog-portal-v84/
        );

        assert.match(
            sw,
            /inbox-conversations\.js\?v=1/
        );

        assert.match(
            sw,
            /communications-conversations\.js\?v=1/
        );
    }
);
