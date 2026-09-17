const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'public/js/v2-discipleship.js'),
    'utf8'
);
const index = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);
const sw = fs.readFileSync(
    path.join(root, 'public/sw.js'),
    'utf8'
);

const marker = 'CAMPFIRE STORED-XSS RELEASE HARDENING';
const start = source.lastIndexOf(marker);
assert.notEqual(start, -1, 'Campfire hardening marker must exist');
const hardened = source.slice(start);

test('Campfire late renderer escapes member-authored HTML', () => {
    assert.match(hardened, /function escapeHTML\(/);
    assert.match(
        hardened,
        /renderMessageWithYoutube\(message\.message \|\| ''\)/
    );

    for (const unsafe of [
        '${msg.message}',
        '${message.message}',
        '${prayer.request}',
        '${prayer.title}',
        '${thread.title}',
        '${thread.author_name}',
        '${reply.author_name}',
        '${reply.reply_text}'
    ]) {
        assert.equal(
            hardened.includes(unsafe),
            false,
            `late hardened renderer must not contain raw interpolation ${unsafe}`
        );
    }

    assert.match(
        hardened,
        /escapeHTML\(prayer\.request \|\| ''\)/
    );
    assert.match(
        hardened,
        /escapeHTML\(thread\.title \|\| 'Discussion'\)/
    );
    assert.match(
        hardened,
        /escapeHTML\(reply\.reply_text \|\| ''\)/
    );
});

test('Deep Dive renderer does not put thread content in inline handlers', () => {
    assert.match(hardened, /onclick="openThreadViewById\(\$\{id\}\)"/);

    assert.equal(
        /onclick="openThreadView\([^"]*\$\{thread\./.test(hardened),
        false
    );

    assert.match(
        hardened,
        /titleNode\.textContent = String\(title \|\| ''\)/
    );
    assert.match(
        hardened,
        /contentNode\.textContent = String\(content \|\| ''\)/
    );
});

test('Campfire asset and service-worker cache are release-bumped', () => {
    assert.match(index, /v2-discipleship\.js\?v=12\.4/);
    assert.match(sw, /fog-portal-v56/);
});
