const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const server = fs.readFileSync(
    path.join(__dirname, '..', 'server.js'),
    'utf8'
);

test(
    'private no-store remains global default',
    () => {
        assert.match(
            server,
            /no-store,\s*no-cache,\s*must-revalidate,\s*private/
        );
    }
);

test(
    'static performance override requires version parameter',
    () => {
        assert.match(
            server,
            /const isVersioned/
        );

        assert.match(
            server,
            /v=\[A-Za-z0-9/
        );
    }
);

test(
    'JavaScript cache override is confined to /js/',
    () => {
        assert.match(
            server,
            /requestPath\.startsWith\(['"]\/js\/['"]\)/
        );
    }
);

test(
    'CSS cache override is confined to /css/',
    () => {
        assert.match(
            server,
            /requestPath\.startsWith\(['"]\/css\/['"]\)/
        );
    }
);

test(
    'shared cache policy is bounded and revalidatable',
    () => {
        assert.match(
            server,
            /public,\s*max-age=3600,\s*s-maxage=86400,\s*stale-while-revalidate=604800/
        );
    }
);

test(
    'service worker is not explicitly included in cacheable paths',
    () => {
        assert.doesNotMatch(
            server,
            /requestPath\.startsWith\(['"]\/sw/
        );
    }
);

test(
    'HTML is not explicitly included in cacheable paths',
    () => {
        assert.doesNotMatch(
            server,
            /requestPath\.startsWith\(['"]\/index/
        );
    }
);
