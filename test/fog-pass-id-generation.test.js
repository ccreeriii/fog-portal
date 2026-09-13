const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const serverSource = fs.readFileSync(
    path.join(__dirname, '..', 'server.js'),
    'utf8'
);

function sourceBetween(startMarker, endMarker) {
    const start = serverSource.indexOf(startMarker);

    assert.notEqual(
        start,
        -1,
        `Missing source marker: ${startMarker}`
    );

    const end = serverSource.indexOf(
        endMarker,
        start + startMarker.length
    );

    assert.notEqual(
        end,
        -1,
        `Missing source marker: ${endMarker}`
    );

    return serverSource.slice(start, end);
}

test(
    'FOG Pass formatter is based on the authoritative inserted youth ID',
    () => {
        assert.match(
            serverSource,
            /function formatFogPassId\(youthId\)/
        );

        assert.match(
            serverSource,
            /FOG-PASS-\$\{String\(numericId\)\.padStart\(3, '0'\)\}/
        );
    }
);

test(
    'Google signup does not predict the youth ID with MAX(id)',
    () => {
        const route = sourceBetween(
            "app.post('/api/auth/google/complete-signup'",
            'function inspectAccountClaimTarget'
        );

        assert.doesNotMatch(
            route,
            /SELECT MAX\(id\).*FROM youth/
        );

        assert.match(
            route,
            /formatFogPassId\(memberInsert\.lastID\)/
        );

        assert.match(
            route,
            /UPDATE youth SET qr_code = \? WHERE id = \?/
        );

        assert.match(
            route,
            /\[qrCode, memberInsert\.lastID\]/
        );
    }
);

test(
    'Wanderer registration does not predict the youth ID with MAX(id)',
    () => {
        const route = sourceBetween(
            "app.post('/api/public/register-wanderer'",
            'startServerAfterRuntimeSchemaReady();'
        );

        assert.doesNotMatch(
            route,
            /SELECT MAX\(id\).*FROM youth/
        );

        assert.match(
            route,
            /formatFogPassId\(memberInsert\.lastID\)/
        );

        assert.match(
            route,
            /UPDATE youth SET qr_code = \? WHERE id = \?/
        );

        assert.match(
            route,
            /\[qrCode, memberInsert\.lastID\]/
        );
    }
);
