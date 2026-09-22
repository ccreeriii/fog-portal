'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(
    path.join(root, 'public/js/app.js'),
    'utf8'
);
const legalSource = fs.readFileSync(
    path.join(root, 'public/js/legal-acceptance.js'),
    'utf8'
);

test('existing-user legal gate is exempt from generic offline interaction blocking', () => {
    assert.match(
        appSource,
        /interactiveTarget\.closest\('#existingUserLegalGate'\)/
    );

    const functionMatch = appSource.match(
        /function blockOfflineReadonlyInteraction\(event\) \{([\s\S]*?)\n\}\n\ndocument\.addEventListener\('click'/
    );

    assert.ok(functionMatch, 'offline interaction blocker must be found');

    const fakeWindow = {
        koinoniaReadOnlyLock: true,
        notices: [],
        showOfflineNotice(message) {
            this.notices.push(message);
        }
    };

    const blocker = new Function(
        'window',
        `return function blockOfflineReadonlyInteraction(event) {
${functionMatch[1]}
};`
    )(fakeWindow);

    function makeClick({ insideLegalGate }) {
        const state = {
            prevented: false,
            stopped: false
        };

        const interactive = {
            closest(selector) {
                if (selector === '[data-koinonia-offline-control]') return null;
                if (selector === '#existingUserLegalGate') {
                    return insideLegalGate ? {} : null;
                }
                return null;
            },
            getAttribute() {
                return '';
            },
            classList: {
                contains() {
                    return false;
                }
            }
        };

        return {
            state,
            event: {
                type: 'click',
                target: {
                    closest(selector) {
                        if (
                            selector ===
                            'button, a[href], input, select, textarea, form, [onclick]'
                        ) {
                            return interactive;
                        }
                        return null;
                    }
                },
                preventDefault() {
                    state.prevented = true;
                },
                stopImmediatePropagation() {
                    state.stopped = true;
                }
            }
        };
    }

    const legalClick = makeClick({ insideLegalGate: true });
    blocker(legalClick.event);

    assert.equal(legalClick.state.prevented, false);
    assert.equal(legalClick.state.stopped, false);
    assert.equal(fakeWindow.notices.length, 0);

    const normalClick = makeClick({ insideLegalGate: false });
    blocker(normalClick.event);

    assert.equal(normalClick.state.prevented, true);
    assert.equal(normalClick.state.stopped, true);
    assert.deepEqual(fakeWindow.notices, [
        'This action requires an active internet connection.'
    ]);
});

test('legal acceptance bypasses offline mutation queuing and remains a live request', () => {
    assert.match(
        appSource,
        /'\/api\/legal\/accept'/
    );

    assert.match(
        appSource,
        /!OFFLINE_SAFE_METHODS\.has\(method\)\s*&&\s*!isAllowedPublicRead/
    );

    assert.match(
        appSource,
        /requestPath === '\/api\/legal\/accept'/
    );
});

test('legal gate provides distinct network and server failure messages', () => {
    assert.match(
        legalSource,
        /Unable to reach the Community Portal\. Please check your connection and try again\./
    );

    assert.match(
        legalSource,
        /We couldn't record your acceptance right now\. Please try again\./
    );

    assert.match(
        legalSource,
        /You must agree to the Terms of Service and acknowledge the Privacy Policy to continue\./
    );
});

test('legal acceptance is still server submitted and never created by checkbox change alone', () => {
    assert.match(
        legalSource,
        /fetch\('\/api\/legal\/accept'/
    );

    assert.match(
        legalSource,
        /body:\s*JSON\.stringify\(\{\s*legal_accepted:\s*true\s*\}\)/
    );

    const checkboxHandler = legalSource.match(
        /gate\.checkbox\.addEventListener\('change',[\s\S]*?\n\s*\}\);/
    );

    assert.ok(checkboxHandler);
    assert.doesNotMatch(
        checkboxHandler[0],
        /\/api\/legal\/accept/
    );
});
