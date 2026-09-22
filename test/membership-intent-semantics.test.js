'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(repositoryRoot, 'server.js'), 'utf8');
const appSource = fs.readFileSync(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0, `missing start marker: ${startMarker}`);
    assert.ok(end > start, `missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

test('both self-service routes use one Belong intent handler without formal commitment writes', () => {
    const intentSource = sourceBetween(
        serverSource,
        "app.post('/api/youth/:id/commit'",
        "app.get('/api/admin/community-intents'"
    );
    assert.match(intentSource,
        /app\.post\('\/api\/youth\/:id\/commit', requireAuth, handleMembershipIntent\)/);
    assert.match(intentSource,
        /app\.post\('\/api\/youth\/:id\/commit-v2', requireAuth, handleMembershipIntent\)/);
    assert.match(intentSource, /SET commitment_intent = \?/);
    assert.match(intentSource, /recordMembershipIntent/);
    assert.doesNotMatch(intentSource, /SET[\s\S]*account_tier\s*=/);
    assert.doesNotMatch(intentSource, /SET[\s\S]*commitment_date\s*=/);
    assert.doesNotMatch(intentSource, /SET[\s\S]*commitment_accepted_(?:at|by)\s*=/);
});

test('the canonical leadership approval records formal status, date, and authenticated acceptance', () => {
    const approvalSource = sourceBetween(
        serverSource,
        "app.post('/api/admin/community-intents-v2/:id/approve'",
        "app.get('/api/youth-v2/:id/tier'"
    );
    assert.match(approvalSource, /requirePermission\('edit_entries'\)/);
    assert.match(approvalSource, /getCanonicalAuditActor\(req\)/);
    assert.match(approvalSource, /account_tier = 'Committed Member'/);
    assert.match(approvalSource, /commitment_date = COALESCE\(commitment_date, \?\)/);
    assert.match(approvalSource, /commitment_accepted_at = \?/);
    assert.match(approvalSource, /commitment_accepted_by = \?/);
    assert.match(serverSource, /AS intent_recorded_at/);
});

test('member and leadership UI distinguish submitted intent from formal acceptance', () => {
    assert.match(serverSource, /membership_intent_submitted: Boolean\(/);
    assert.match(appSource, /currentMember\.membership_intent_submitted === true/);
    assert.match(appSource, /Beginning Belong/);
    assert.match(appSource, /Intent Received!/);
    assert.match(appSource, /Accept as Committed Member/);
    assert.match(appSource, /c\.intent_recorded_at/);
    assert.match(appSource,
        /!c\.commitment_accepted_at && c\.account_tier !== 'Committed Member' && c\.account_tier !== 'Leader'/);
    assert.doesNotMatch(indexSource, />I Commit to the Community</);
    assert.match(indexSource, />Share My Intent</);
});
