'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

const index = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);

const source = fs.readFileSync(
    path.join(root, 'public/js/community-spotlight-admin.js'),
    'utf8'
);

const css = fs.readFileSync(
    path.join(root, 'public/css/community-spotlight-admin.css'),
    'utf8'
);

const serviceWorker = fs.readFileSync(
    path.join(root, 'public/sw.js'),
    'utf8'
);

test(
    'Communications admin keeps Broadcasts and adds Campaign Manager as a separate sub-tab',
    () => {
        assert.match(
            index,
            /id="btnCommunicationsBroadcasts"/
        );

        assert.match(
            index,
            /id="btnCommunicationsCampaigns"/
        );

        assert.match(
            index,
            /id="communicationsBroadcastSection"/
        );

        assert.match(
            index,
            /id="communitySpotlightAdminSection"/
        );

        assert.match(
            index,
            /id="spotlightNewCampaignBtn"/
        );
    }
);

test(
    'Campaign Manager binds only to secured admin Spotlight APIs and never activates member Spotlight',
    () => {
        assert.match(
            source,
            /\/api\/admin\/community-spotlight\/campaigns/
        );

        assert.match(
            source,
            /\/analytics/
        );

        assert.match(
            source,
            /\/relaunch/
        );

        assert.doesNotMatch(
            source,
            /\/api\/community-spotlight\/next/
        );

        assert.doesNotMatch(
            source,
            /\/impression|\/dismiss|\/complete/
        );

        assert.doesNotMatch(
            source,
            /prayer-covenant\/join|enrollPrayerCovenantChallenge/
        );
    }
);

test(
    'Campaign Manager mirrors server authorization by separating read and mutation controls',
    () => {
        assert.match(
            source,
            /hasPerm\('access_communications'\)/
        );

        assert.match(
            source,
            /hasPerm\('edit_entries'\)/
        );

        assert.match(
            source,
            /canMutate\(\)/
        );

        assert.match(
            source,
            /spotlight-mutation-control/
        );

        assert.match(
            source,
            /koinonia-offline-readonly/
        );
    }
);

test(
    'Campaign payload uses canonical audience, action, frequency, status, and Manila date contracts',
    () => {
        assert.match(
            source,
            /youth_ids:\s*ids/
        );

        assert.match(
            source,
            /min_age:\s*minAge/
        );

        assert.match(
            source,
            /max_age:\s*maxAge/
        );

        for (const value of [
            'every_login',
            'daily',
            'once',
            'until_action',
            'internal_route',
            'external_url',
            'prayer_covenant_join'
        ]) {
            assert.match(
                source,
                new RegExp(value)
            );
        }

        assert.match(
            source,
            /replace\('T', ' '\)/
        );

        assert.match(
            source,
            /:00`/
        );
    }
);

test(
    'Campaign Manager renders campaign/member data through text APIs and stores no authority in browser persistence',
    () => {
        assert.match(
            source,
            /\.textContent/
        );

        assert.match(
            source,
            /replaceChildren/
        );

        assert.match(
            source,
            /\/api\/admin\/users\/search\?q=/
        );

        assert.doesNotMatch(
            source,
            /localStorage|sessionStorage|indexedDB/
        );

        assert.doesNotMatch(
            source,
            /caches\s*\./
        );
    }
);

test(
    'Campaign Manager publishes through a fresh coordinated PWA shell',
    () => {
        assert.ok(
            index.indexOf('/js/community-spotlight-admin.js?v=4') >
            index.indexOf('/js/v4-communications.js?v=12.3')
        );

        assert.match(
            index,
            /\/css\/community-spotlight-admin\.css\?v=1/
        );

        assert.match(
            serviceWorker,
            /const CACHE_NAME = 'fog-portal-v67'/
        );

        assert.match(
            serviceWorker,
            /'\/js\/community-spotlight-admin\.js\?v=4'/
        );

        assert.match(
            serviceWorker,
            /'\/css\/community-spotlight-admin\.css\?v=1'/
        );

        assert.match(
            css,
            /\.spotlight-campaign-card/
        );

        assert.match(
            css,
            /body\.koinonia-offline-readonly/
        );
    }
);

function createLifecycleHarness() {
    class FakeElement {
        constructor(id) {
            this.id = id;
            this.dataset = {};
            this.listeners = {};
            this.style = {
                display: '',
                setProperty(name, value) {
                    this[name] = value;
                }
            };
            this.classList = {
                contains: () => false,
                toggle() {}
            };
        }

        addEventListener(type, listener) {
            this.listeners[type] = listener;
        }
    }

    const ids = [
        'communicationsAdminTab',
        'communicationsBroadcastSection',
        'communitySpotlightAdminSection',
        'btnCommunicationsBroadcasts',
        'btnCommunicationsCampaigns',
        'spotlightNewCampaignBtn'
    ];
    const elements = Object.fromEntries(
        ids.map(id => [id, new FakeElement(id)])
    );
    const listeners = {};
    const document = {
        body: {
            classList: {
                contains: () => false
            }
        },
        getElementById: id => elements[id] || null,
        createElement: tag => new FakeElement(tag),
        addEventListener(type, listener) {
            (listeners[type] ||= []).push(listener);
        }
    };
    const state = {
        permissions: [],
        applyPermissionsCalls: 0,
        built: false,
        opened: null
    };
    const window = {
        document,
        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({ campaigns: [] })
        }),
        koinoniaAuthStatus: 'unauthenticated',
        authReady: Promise.resolve({ authenticated: false }),
        hasPerm(permission) {
            return this.koinoniaAuthStatus === 'authenticated' &&
                state.permissions.includes(permission);
        },
        applyGranularPermissions() {
            state.applyPermissionsCalls += 1;
        },
        buildNav() {
            state.built = true;
        },
        switchTab(tabId) {
            state.opened = tabId;
        }
    };

    vm.runInNewContext(source, {
        window,
        document,
        Promise,
        Set,
        console,
        setTimeout,
        clearTimeout
    });

    return { window, elements, listeners, state };
}

test(
    'Campaign Manager follows the canonical asynchronous authentication and permission lifecycle',
    async () => {
        const { window, elements, listeners, state } =
            createLifecycleHarness();

        for (const listener of listeners.DOMContentLoaded || []) {
            listener();
        }
        await Promise.resolve();
        await Promise.resolve();

        assert.equal(
            elements.btnCommunicationsCampaigns.style.display,
            'none',
            'the initial unauthenticated lifecycle hides Campaign Manager'
        );

        window.koinoniaAuthStatus = 'authenticated';
        state.permissions = [
            'access_communications',
            'edit_entries'
        ];

        window.applyGranularPermissions();
        window.buildNav();
        window.switchTab('communicationsAdminTab');

        assert.equal(state.applyPermissionsCalls, 1);
        assert.equal(state.built, true);
        assert.equal(state.opened, 'communicationsAdminTab');
        assert.equal(
            elements.btnCommunicationsCampaigns.style.display,
            '',
            'canonical permission application restores the readable sub-tab'
        );
        assert.equal(
            elements.spotlightNewCampaignBtn.style.display,
            'inline-flex',
            'edit permission enables mutation controls'
        );

        state.permissions = ['access_communications'];
        window.applyGranularPermissions();
        assert.equal(
            elements.btnCommunicationsCampaigns.style.display,
            '',
            'read permission alone keeps Campaign Manager visible'
        );
        assert.equal(
            elements.spotlightNewCampaignBtn.style.display,
            'none',
            'read permission alone does not enable mutation controls'
        );

        state.permissions = [];
        window.applyGranularPermissions();
        assert.equal(
            elements.btnCommunicationsCampaigns.style.display,
            'none',
            'unauthorized users remain denied'
        );
    }
);
