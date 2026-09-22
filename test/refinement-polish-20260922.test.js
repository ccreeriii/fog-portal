const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const app = fs.readFileSync(
    path.join(root, 'public', 'js', 'app.js'),
    'utf8'
);

const journal = fs.readFileSync(
    path.join(
        root,
        'public',
        'js',
        'journal-policy-admin.js'
    ),
    'utf8'
);

const server = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

test(
    'Ministries exposes canonical Discernment tab for editing leaders',
    () => {
        assert.match(
            app,
            /id="btnSubMinistryDiscernment"/
        );

        assert.match(
            app,
            /switchMinistrySubTab\('discernment'\)/
        );

        assert.match(
            app,
            /btnSubMinistryDiscernment[\s\S]{0,250}hasPerm\('edit_entries'\)/
        );
    }
);

test(
    'Notification Center defaults to Announcements then Prayers then Updates',
    () => {
        const marker =
            app.indexOf(
                'PHASE 2C-B3 CANONICAL NOTIFICATION CENTER UI'
            );

        assert.ok(marker >= 0);

        const block =
            app.slice(marker);

        assert.match(
            block,
            /section:\s*'announcements'/
        );

        const announcements =
            block.indexOf(
                '>📢 Announcements</button>'
            );

        const prayers =
            block.indexOf(
                '>🙏 Prayers</button>'
            );

        const updates =
            block.indexOf(
                '>🔔 Updates</button>'
            );

        assert.ok(
            announcements >= 0 &&
            prayers > announcements &&
            updates > prayers
        );
    }
);

test(
    'Broadcast mirrors are hidden from Updates but clear when Announcements is viewed',
    () => {
        const marker =
            app.indexOf(
                'PHASE 2C-B3 CANONICAL NOTIFICATION CENTER UI'
            );

        const block =
            app.slice(marker);

        assert.match(
            block,
            /source_type\s*!==\s*[\r\n\s]*'announcement'/
        );

        assert.match(
            block,
            /markAnnouncementNotificationsRead/
        );

        assert.match(
            block,
            /\/api\/notifications\/\$\{Number\([\s\S]{0,160}recipient_id[\s\S]{0,160}\)\}\/read/
        );
    }
);

test(
    'Journal teen policy remains visible with a strong-admin explanation on forbidden access',
    () => {
        assert.match(
            journal,
            /response\.status\s*===\s*403/
        );

        assert.match(
            journal,
            /section\.hidden\s*=\s*false/
        );

        assert.match(
            journal,
            /toggle\.disabled\s*=\s*true/
        );

        assert.match(
            journal,
            /Strong Admin account/
        );
    }
);

test(
    'new Communications broadcasts create canonical announcement notifications',
    () => {
        const start =
            server.indexOf(
                "app.post('/api/communications/broadcast'"
            );

        const end =
            server.indexOf(
                "app.get('/api/communications/history'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            server.slice(start, end);

        assert.match(
            route,
            /NotificationCenter[\s\S]{0,80}\.createNotification/
        );

        assert.match(
            route,
            /communications:broadcast:\$\{announcementId\}:v1/
        );

        assert.match(
            route,
            /sourceType:[\s\r\n]*'announcement'/
        );

        assert.match(
            route,
            /recipientYouthIds/
        );
    }
);


test(
    'Communications broadcast separates audit identity from display identity',
    () => {
        const start =
            server.indexOf(
                "app.post('/api/communications/broadcast'"
            );

        const end =
            server.indexOf(
                "app.get('/api/communications/history'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            server.slice(start, end);

        assert.match(
            route,
            /getCanonicalAuditActor\(req\)/
        );

        assert.match(
            route,
            /getCanonicalDisplayActor\(req\)/
        );

        assert.match(
            route,
            /const auditActor\s*=/
        );

        assert.match(
            route,
            /const displayActor\s*=/
        );

        assert.match(
            route,
            /sourceActor:[\s\r\n]*displayActor/
        );

        assert.match(
            route,
            /logActivity\([\s\r\n]*auditActor,[\s\r\n]*'BROADCAST'/
        );

        assert.doesNotMatch(
            route,
            /logActivity\([\s\r\n]*actor,[\s\r\n]*'BROADCAST'/
        );
    }
);
