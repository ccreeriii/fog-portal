'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const serverSource = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

const htmlSource = fs.readFileSync(
    path.join(root, 'public', 'index.html'),
    'utf8'
);

const appSource = fs.readFileSync(
    path.join(root, 'public', 'js', 'app.js'),
    'utf8'
);

test('check-in and attendance routes use canonical permissions', () => {
    assert.match(
        serverSource,
        /app\.post\('\/api\/checkin', requirePermission\('access_checkin'\),/
    );

    assert.match(
        serverSource,
        /const\s*\{\s*youth_id,\s*event_id,\s*is_walkin,\s*qr_code\s*\}\s*=\s*req\.body;/
    );

    assert.match(
        serverSource,
        /const actor = getCanonicalAuditActor\(req\);/
    );

    assert.doesNotMatch(
        serverSource,
        /const \{ youth_id, event_id, is_walkin, actor, qr_code \} = req\.body;/
    );

    assert.match(
        serverSource,
        /app\.get\('\/api\/attendance\/logs', requirePermission\('access_attendance'\),/
    );

    assert.match(
        serverSource,
        /app\.put\('\/api\/attendance\/:id', requireAllPermissions\(\['access_attendance', 'edit_entries'\]\),/
    );

    assert.match(
        serverSource,
        /app\.delete\('\/api\/attendance\/:id', requireAllPermissions\(\['access_attendance', 'delete_entries'\]\),/
    );
});

test('permission account inventory remains protected and mutation remains strong-admin only', () => {
    assert.match(
        serverSource,
        /app\.get\('\/api\/users\/list', requirePermission\('access_permissions'\),/
    );

    assert.match(
        serverSource,
        /app\.put\('\/api\/youth\/:id\/permissions', requireStrongAdmin,/
    );
});

test('permissions page exposes accounts with permissions and preserves directory search', () => {
    assert.match(htmlSource, /Accounts with Permissions/);
    assert.match(htmlSource, /id="permAccountsSummary"/);
    assert.match(htmlSource, /id="permAccountsContainer"/);
    assert.match(htmlSource, /id="permissionAccountDetailsModal"/);
    assert.match(htmlSource, /Find \/ Assign Permissions/);

    assert.match(
        htmlSource,
        /id="permUserSearchInput"[\s\S]*oninput="filterPermUserList\(\)"/
    );

    assert.match(
        htmlSource,
        /class="permCheckModal" value="access_checkin"/
    );
});

test('permission overview lists only permission-bearing accounts and handles system accounts safely', () => {
    assert.match(
        appSource,
        /window\.loadPermissionAccountsOverview = async function\(\)/
    );

    assert.match(
        appSource,
        /fetch\('\/api\/users\/list'\)/
    );

    assert.match(
        appSource,
        /\.filter\(account => account\.permission_list\.length > 0\)/
    );

    assert.match(
        appSource,
        /window\.openPermissionAccountDetails = async function\(userId\)/
    );

    assert.match(
        appSource,
        /if \(account\.youth_id == null\)/
    );

    assert.match(
        appSource,
        /window\.loadPermissionAccountsOverview\(\);/
    );

    assert.match(
        appSource,
        /await window\.loadPermissionAccountsOverview\(\);/
    );
});

test('effective final router loads the Permissions account overview', () => {
    const finalRouterStart = appSource.lastIndexOf(
        'window.switchTab = function'
    );

    assert.notEqual(
        finalRouterStart,
        -1,
        'effective final switchTab router must exist'
    );

    const finalRouterEnd = appSource.indexOf(
        'window.renderBottomNav = function',
        finalRouterStart
    );

    assert.ok(
        finalRouterEnd > finalRouterStart,
        'effective final switchTab router boundary must be valid'
    );

    const finalRouter = appSource.slice(
        finalRouterStart,
        finalRouterEnd
    );

    assert.match(
        finalRouter,
        /tabId === 'permissionsTab'[\s\S]*window\.resetPermUserList\(\)/
    );
});

test('active shell and service worker use the current app.js revision', () => {
    const swSource = fs.readFileSync(
        path.join(root, 'public', 'sw.js'),
        'utf8'
    );

    assert.match(
        htmlSource,
        /\/js\/app\.js\?v=13\.5/
    );

    assert.match(
        swSource,
        /\/js\/app\.js\?v=13\.5/
    );

    assert.doesNotMatch(
        htmlSource,
        /\/js\/app\.js\?v=12\.8/
    );

    assert.doesNotMatch(
        swSource,
        /\/js\/app\.js\?v=12\.8/
    );
});
