(function installPostlaunchHotfix(root) {
    'use strict';

    const document = root.document;
    if (!document || root.__postlaunchHotfixInstalled) return;
    root.__postlaunchHotfixInstalled = true;

    const state = {
        preregGeneration: 0,
        preregEventId: null,
        communityIntents: [],
        ministryLogs: [],
        attendanceLogs: [],
        activityLogs: [],
        filteredAttendanceLogs: [],
        filteredActivityLogs: [],
        attendancePage: 1,
        activityPage: 1,
        logLoads: Object.create(null),
        logGeneration: 0,
        bellRefresh: null
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const target = byId(id);
        if (target) target.textContent = value == null ? '' : String(value);
    }

    function normalizeId(value) {
        const number = Number(value);
        return Number.isSafeInteger(number) && number > 0 ? number : null;
    }

    function avatarInitial(member) {
        const candidates = [member && member.name, root.currentUser];
        for (const candidate of candidates) {
            if (typeof candidate !== 'string' || candidate.includes('@')) continue;
            const letter = candidate.trim().match(/\p{L}/u);
            if (letter) return letter[0].toUpperCase();
        }
        return 'U';
    }

    function safeAvatarPicture(value) {
        if (typeof value !== 'string' || !value.trim()) return null;
        const picture = value.trim();
        if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(picture)) return picture;
        try {
            const url = new URL(picture, root.location.href);
            return /^https?:$/.test(url.protocol) && url.origin === root.location.origin
                ? url.href
                : null;
        } catch (error) {
            return null;
        }
    }

    function refreshHeaderProfile(memberOverride) {
        const button = byId('headerProfileAvatar');
        if (!button) return;
        const bell = byId('headerNotificationBell');
        const authenticated = root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode &&
            !(document.body && document.body.classList.contains('koinonia-offline-readonly'));
        if (document.body) document.body.classList.toggle('koinonia-authenticated-header', authenticated);
        button.hidden = !authenticated;
        if (bell) bell.style.display = authenticated ? 'grid' : 'none';
        if (!authenticated) return;
        const canonical = root.currentMember && typeof root.currentMember === 'object'
            ? root.currentMember
            : null;
        const member = memberOverride && normalizeId(memberOverride.id) &&
            normalizeId(memberOverride.id) === normalizeId(canonical && canonical.id)
            ? memberOverride
            : canonical;
        const face = button.querySelector('.header-profile-avatar-face');
        if (!face) return;
        face.replaceChildren();
        const picture = safeAvatarPicture(member && member.profile_picture);
        if (picture) {
            const image = document.createElement('img');
            image.src = picture;
            image.alt = '';
            image.addEventListener('error', () => {
                image.remove();
                face.textContent = avatarInitial(member);
            }, { once: true });
            face.appendChild(image);
        } else {
            face.textContent = avatarInitial(member);
        }
    }

    function invalidateLogIdentity() {
        ++state.logGeneration;
        state.logLoads = Object.create(null);
        state.communityIntents = [];
        state.ministryLogs = [];
        state.attendanceLogs = [];
        state.activityLogs = [];
        root.cachedCommunityIntents = [];
        root.cachedMinistryLogs = [];
        try {
            cachedAttendanceLogs = [];
            cachedActivityLogs = [];
        } catch (error) { /* app.js owns these bindings */ }
        for (const id of ['communityIntentsList', 'ministryIntentsLogList',
            'attendanceLogsContainer', 'activityLogsContainer']) {
            const container = byId(id);
            if (container) container.replaceChildren();
        }
    }

    const profileButton = byId('headerProfileAvatar');
    if (profileButton) profileButton.addEventListener('click', () => {
        if (root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode) {
            root.switchTab('profileTab');
        }
    });

    const previousRefreshNotificationBell = root.refreshNotificationBell;
    if (typeof previousRefreshNotificationBell === 'function') {
        root.refreshNotificationBell = function refreshBellOncePerTransition(...args) {
            const memberId = normalizeId(root.currentMember && root.currentMember.id);
            const recent = state.bellRefresh;
            if (recent && recent.memberId === memberId &&
                (recent.pending || Date.now() - recent.startedAt < 500)) return recent.promise;
            const entry = { memberId, startedAt: Date.now(), pending: true };
            entry.promise = Promise.resolve()
                .then(() => previousRefreshNotificationBell.apply(this, args))
                .then(result => {
                    if (root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode &&
                        !(document.body && document.body.classList.contains('koinonia-offline-readonly'))) {
                        const bell = byId('headerNotificationBell');
                        if (bell) bell.style.display = 'grid';
                    }
                    return result;
                });
            state.bellRefresh = entry;
            entry.promise.then(
                () => { entry.pending = false; },
                () => { entry.pending = false; }
            );
            return entry.promise;
        };
    }

    const previousPersistIdentity = root.persistAuthenticatedIdentity;
    if (typeof previousPersistIdentity === 'function') {
        root.persistAuthenticatedIdentity = function persistIdentityWithHeader(...args) {
            const previousId = normalizeId(root.currentMember && root.currentMember.id);
            const result = previousPersistIdentity.apply(this, args);
            if (previousId !== normalizeId(root.currentMember && root.currentMember.id)) invalidateLogIdentity();
            refreshHeaderProfile();
            if (previousId !== normalizeId(root.currentMember && root.currentMember.id) &&
                root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode &&
                !(document.body && document.body.classList.contains('koinonia-offline-readonly')) &&
                typeof root.refreshNotificationBell === 'function') {
                void root.refreshNotificationBell().catch(() => null);
            }
            return result;
        };
    }
    const previousClearIdentity = root.clearAuthenticatedClientState;
    if (typeof previousClearIdentity === 'function') {
        root.clearAuthenticatedClientState = function clearIdentityWithHeader(...args) {
            const result = previousClearIdentity.apply(this, args);
            invalidateLogIdentity();
            state.bellRefresh = null;
            refreshHeaderProfile();
            return result;
        };
    }
    const previousOfflineIdentity = root.enterOfflineReadonlyIdentity;
    if (typeof previousOfflineIdentity === 'function') {
        root.enterOfflineReadonlyIdentity = function offlineIdentityWithoutHeaderAvatar(...args) {
            const result = previousOfflineIdentity.apply(this, args);
            invalidateLogIdentity();
            state.bellRefresh = null;
            refreshHeaderProfile();
            return result;
        };
    }
    const previousPopulateProfile = root.populateProfileTab;
    if (typeof previousPopulateProfile === 'function') {
        root.populateProfileTab = function populateProfileWithHeader(member, ...args) {
            const result = previousPopulateProfile.call(this, member, ...args);
            refreshHeaderProfile(member);
            return result;
        };
    }

    function activeModals() {
        return Array.from(document.querySelectorAll('.modal.active'));
    }

    function syncModalPageState() {
        if (activeModals().length > 0) return;
        if (document.body && document.body.classList) document.body.classList.remove('modal-open');
        if (document.body && document.body.style) {
            document.body.style.overflow = '';
            document.body.style.pointerEvents = '';
            document.body.style.touchAction = '';
        }
        const bottomNav = byId('bottomNav');
        if (bottomNav && bottomNav.style) bottomNav.style.pointerEvents = '';
    }

    function openModal(target) {
        const modal = typeof target === 'string' ? byId(target) : target;
        if (!modal) return false;
        modal.style.display = '';
        modal.style.pointerEvents = '';
        modal.removeAttribute('aria-hidden');
        modal.classList.add('active');
        return true;
    }

    function closeModal(target) {
        const modal = typeof target === 'string' ? byId(target) : target;
        if (!modal) return false;
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.pointerEvents = '';
        modal.setAttribute('aria-hidden', 'true');
        syncModalPageState();
        return true;
    }

    root.__portalOpenModal = openModal;
    root.__portalCloseModal = closeModal;

    function wrapModalOpen(functionName, modalId) {
        const original = root[functionName];
        if (typeof original !== 'function') return;
        root[functionName] = async function postlaunchModalOpen(...args) {
            const modal = byId(modalId);
            if (modal) {
                modal.style.display = '';
                modal.style.pointerEvents = '';
            }
            const result = await original.apply(this, args);
            if (modal && modal.classList.contains('active')) openModal(modal);
            return result;
        };
    }

    function wrapModalClose(functionName, modalId) {
        const original = root[functionName];
        root[functionName] = function postlaunchModalClose(...args) {
            const result = typeof original === 'function' ? original.apply(this, args) : undefined;
            closeModal(modalId);
            return result;
        };
    }

    wrapModalOpen('openAnalyticsModal', 'eventAnalyticsModal');
    wrapModalOpen('openEditEventModal', 'editEventModal');
    wrapModalClose('closeAnalyticsModal', 'eventAnalyticsModal');
    wrapModalClose('closeEditEventModal', 'editEventModal');

    root.addEventListener('click', event => {
        const modal = event.target;
        if (!modal || !modal.classList || !modal.classList.contains('modal')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (modal.id === 'growthEventMappingModal' && typeof root.closeGrowthEventMapping === 'function') {
            root.closeGrowthEventMapping();
        } else if (modal.id === 'editEventModal') {
            root.closeEditEventModal();
        } else if (modal.id === 'eventAnalyticsModal') {
            root.closeAnalyticsModal();
        } else if (modal.id === 'viewProfileModal' && typeof root.closeViewProfileModal === 'function') {
            root.closeViewProfileModal();
            syncModalPageState();
        } else {
            closeModal(modal);
        }
    }, true);

    root.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        const modals = activeModals();
        const modal = modals[modals.length - 1];
        if (!modal) return;
        if (modal.id === 'growthEventMappingModal' && typeof root.closeGrowthEventMapping === 'function') {
            root.closeGrowthEventMapping();
        } else if (modal.id === 'editEventModal') {
            root.closeEditEventModal();
        } else if (modal.id === 'eventAnalyticsModal') {
            root.closeAnalyticsModal();
        } else {
            closeModal(modal);
        }
    });

    const previousRenderBottomNav = root.renderBottomNav;
    const navItems = Object.freeze([
        ['home', '🏠', 'Home'],
        ['growth', '🌱', 'Growth'],
        ['prayer', '🙏', 'Prayer'],
        ['journal', '📖', 'Journal'],
        ['groups', '👥', 'Groups'],
        ['events', '📅', 'Events'],
        ['arcade', '🎯', 'FOG Arcade'],
        ['menu', '☰', 'Menu']
    ]);

    function activeDestination(context) {
        if (['home', 'growth', 'prayer', 'journal', 'groups', 'events', 'arcade', 'menu'].includes(context)) return context;
        if (context === 'pulseDashboardTab') return 'home';
        if (context === 'eventsTab' || context === 'preregPublicTab') return 'events';
        if (context === 'arcadeTab') return 'arcade';
        if (context === 'discipleshipTab') return 'growth';
        return '';
    }

    async function navigateBottom(destination) {
        if (destination === 'home') return root.switchTab('pulseDashboardTab');
        if (destination === 'events') return root.switchTab('eventsTab');
        if (destination === 'arcade') return root.switchTab('arcadeTab');
        if (destination === 'menu') {
            root.renderBottomNav('menu');
            return root.openSidebar();
        }

        const growthDestinations = {
            growth: 'Home',
            prayer: 'Prayer',
            journal: 'Journal',
            groups: 'Groups'
        };

        const subTabName = growthDestinations[destination];
        if (!subTabName) return undefined;

        /*
         * Historical app.js wrappers reset discipleshipTab to Growth Home
         * on a 50 ms timer. Open the parent tab first, then select the
         * requested canonical dashboard after that legacy reset has settled.
         */
        await root.switchTab('discipleshipTab');

        return new Promise(resolve => {
            const schedule = typeof root.setTimeout === 'function'
                ? root.setTimeout.bind(root)
                : setTimeout;

            schedule(() => {
                const result = typeof root.switchGrowthSubTab === 'function'
                    ? root.switchGrowthSubTab(subTabName)
                    : undefined;

                root.renderBottomNav(destination);
                resolve(result);
            }, 100);
        });
    }

    root.renderBottomNav = function renderCanonicalBottomNav(context) {
        if (root.isGuestMode || context === 'guest') {
            if (typeof previousRenderBottomNav === 'function') previousRenderBottomNav(context);
            return;
        }
        const nav = byId('bottomNav');
        if (!nav) return;
        nav.replaceChildren();
        nav.classList.add('bottom-nav--canonical');
        const selected = activeDestination(context);
        for (const [destination, icon, label] of navItems) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'bottom-nav-btn';
            button.dataset.destination = destination;
            button.setAttribute('aria-label', label);
            if (destination === selected) {
                button.classList.add('active');
                button.setAttribute('aria-current', 'page');
            }
            const iconElement = document.createElement('span');
            iconElement.setAttribute('aria-hidden', 'true');
            iconElement.textContent = icon;
            const labelElement = document.createElement('span');
            labelElement.className = 'bottom-nav-label';
            labelElement.textContent = label;
            button.append(iconElement, labelElement);
            button.addEventListener('click', () => navigateBottom(destination));
            nav.appendChild(button);
        }
    };

    const previousSwitchGrowthSubTab = root.switchGrowthSubTab;
    root.switchGrowthSubTab = function switchCanonicalGrowthSubTab(subTabName) {
        const normalized = subTabName === 'Milestones' ? 'Home' : subTabName;
        const result = typeof previousSwitchGrowthSubTab === 'function'
            ? previousSwitchGrowthSubTab(normalized)
            : undefined;
        const destinations = { Home: 'growth', Prayer: 'prayer', Journal: 'journal', Groups: 'groups' };
        root.renderBottomNav(destinations[normalized] || 'growth');
        return result;
    };

    if (root.V2Discipleship) {
        root.V2Discipleship.loadPathways = async () => [];
        root.V2Discipleship.loadNextStep = async () => null;
        root.V2Discipleship.updateMilestone = () => false;
        root.V2Discipleship.renderChart = async () => null;
    }

    const previousSwitchTab = root.switchTab;
    root.switchTab = async function switchTabWithCanonicalNav(tabId, subTabId) {
        const result = typeof previousSwitchTab === 'function'
            ? await previousSwitchTab(tabId, subTabId)
            : undefined;
        if (tabId === 'discipleshipTab') {
            const destination = { Home: 'growth', Prayer: 'prayer', Journal: 'journal', Groups: 'groups' }[subTabId || 'Home'];
            root.renderBottomNav(destination || 'growth');
        } else {
            root.renderBottomNav(tabId);
        }
        refreshHeaderProfile();
        const target = byId(tabId);
        if (!target || !target.classList.contains('active')) return result;
        if (tabId === 'membershipAdminTab') {
            ensureMembershipAdminTab();
            showMembershipSubTab('community');
            await root.loadMembershipAdminData();
        } else if (tabId === 'attendanceTab') {
            await root.loadAttendanceLogs();
        } else if (tabId === 'activityLogsTab') {
            await root.loadActivityLogs();
        }
        return result;
    };

    function applyEventDetail(event, generation) {
        if (generation !== state.preregGeneration || !event) return;
        setText('preregPublicTitle', event.prereg_title || event.name || 'Event Pre-Registration');
        setText(
            'preregPublicInfo',
            event.prereg_info || `Date: ${event.event_date || 'TBA'} | Venue: ${event.venue || 'TBA'}`
        );
        if (typeof root.loadPreregHeroMedia === 'function') root.loadPreregHeroMedia(event);
        const bottomBanner = byId('preregPublicBottomBanner');
        if (!bottomBanner) return;
        bottomBanner.onload = null;
        bottomBanner.onerror = null;
        if (event.prereg_bottom_banner_url) {
            bottomBanner.src = event.prereg_bottom_banner_url;
            bottomBanner.style.display = 'block';
            bottomBanner.onerror = () => {
                bottomBanner.removeAttribute('src');
                bottomBanner.style.display = 'none';
            };
        } else {
            bottomBanner.removeAttribute('src');
            bottomBanner.style.display = 'none';
        }
        try { currentPreregEventDetail = event; } catch (error) { /* app.js owns this binding */ }
    }

    async function readJson(url) {
        const response = await root.fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    root.launchPublicPrereg = async function launchPublicPrereg(eventId, options = {}) {
        const normalizedEventId = normalizeId(eventId);
        if (!normalizedEventId) return false;
        const generation = ++state.preregGeneration;
        state.preregEventId = normalizedEventId;
        try {
            currentPreregEventId = normalizedEventId;
            currentPreregEventDetail = null;
        } catch (error) { /* app.js owns these bindings */ }

        const main = byId('mainContainer');
        if (main) main.style.display = 'block';
        setText('preregPublicTitle', 'Loading event…');
        setText('preregPublicInfo', 'Preparing pre-registration. You can continue as soon as the event details load.');
        if (typeof root.showPreregStep === 'function') root.showPreregStep(1);
        await root.switchTab('preregPublicTab');

        if (options.updateHistory !== false && root.history && root.location) {
            const url = new URL(root.location.href);
            url.searchParams.set('event', String(normalizedEventId));
            url.searchParams.delete('play');
            url.searchParams.delete('read');
            root.history.pushState({ preregEventId: normalizedEventId }, '', url.pathname + url.search + url.hash);
        }

        const eventPromise = readJson(`/api/events/${normalizedEventId}`);
        const preregPromise = readJson(`/api/events/${normalizedEventId}/preregs`);
        let needsYouth = true;
        try { needsYouth = !Array.isArray(youthData) || youthData.length === 0; } catch (error) { /* load below */ }
        const youthPromise = needsYouth ? readJson('/api/youth') : Promise.resolve(null);
        const [eventResult, preregResult, youthResult] = await Promise.allSettled([
            eventPromise,
            preregPromise,
            youthPromise
        ]);
        if (generation !== state.preregGeneration) return false;

        if (eventResult.status === 'fulfilled') {
            applyEventDetail(eventResult.value, generation);
        } else {
            setText('preregPublicTitle', 'Event Pre-Registration');
            setText('preregPublicInfo', 'Event details could not be loaded. Please try again.');
        }
        try {
            currentPreRegYouthIds = new Set(
                preregResult.status === 'fulfilled' && Array.isArray(preregResult.value)
                    ? preregResult.value.map(Number)
                    : []
            );
            if (youthResult.status === 'fulfilled' && Array.isArray(youthResult.value)) youthData = youthResult.value;
        } catch (error) { /* app.js owns these bindings */ }
        return eventResult.status === 'fulfilled';
    };

    root.closePublicPrereg = function closePublicPrereg() {
        ++state.preregGeneration;
        state.preregEventId = null;
        try {
            currentPreregEventId = null;
            currentPreregEventDetail = null;
        } catch (error) { /* app.js owns these bindings */ }
        if (root.history && root.location) {
            const url = new URL(root.location.href);
            url.searchParams.delete('event');
            root.history.pushState(null, '', url.pathname + url.search + url.hash);
        }
        const header = byId('mainHeader');
        if (header) header.style.display = 'block';
        if (root.koinoniaAuthStatus === 'authenticated') {
            root.switchTab('eventsTab');
            if (typeof root.loadEvents === 'function') root.loadEvents();
        } else if (typeof root.renderUnauthenticatedShell === 'function') {
            root.renderUnauthenticatedShell();
        } else {
            root.switchTab('loginTab');
        }
    };

    root.addEventListener('popstate', () => {
        const eventId = normalizeId(new URL(root.location.href).searchParams.get('event'));
        if (eventId) root.launchPublicPrereg(eventId, { updateHistory: false });
        else if (state.preregEventId && root.koinoniaAuthStatus === 'authenticated') root.switchTab('eventsTab');
    });

    function emptyState(container, message, isError = false) {
        if (!container) return;
        container.replaceChildren();
        const status = document.createElement('div');
        status.className = `log-state${isError ? ' log-state--error' : ''}`;
        status.setAttribute('role', isError ? 'alert' : 'status');
        status.textContent = message;
        container.appendChild(status);
    }

    function appendText(parent, tag, text, className) {
        const child = document.createElement(tag);
        if (className) child.className = className;
        child.textContent = text == null ? '' : String(text);
        parent.appendChild(child);
        return child;
    }

    function ensureMembershipAdminTab() {
        if (!byId('mainContainer')) return;
        let tab = byId('membershipAdminTab');
        if (!tab) {
            tab = document.createElement('div');
            tab.id = 'membershipAdminTab';
            tab.className = 'tab-content';
            byId('mainContainer').appendChild(tab);
        }
        if (tab.dataset.canonicalLogShell === 'true') return;
        tab.innerHTML = '<div class="sub-nav"><button id="btnSubMemCommunity" class="sub-nav-btn active" type="button">🕊️ Community Intents</button><button id="btnSubMemMinistry" class="sub-nav-btn" type="button">🔥 Ministry Logs</button></div><section id="subTabMemCommunity" class="mem-sub-tab"><div class="card"><h2>🕊️ Community Intent Logs</h2><div class="log-filters"><input type="text" id="commFilterName" class="form-control" placeholder="Search name…"><input type="date" id="commFilterStart" class="form-control" title="Start date"><input type="date" id="commFilterEnd" class="form-control" title="End date"></div><div id="communityIntentsList"></div></div></section><section id="subTabMemMinistry" class="mem-sub-tab" hidden><div class="card"><h2>🔥 Ministry Logs</h2><div class="log-filters"><input type="text" id="minLogFilterName" class="form-control" placeholder="Search member or ministry…"><input type="date" id="minLogFilterStart" class="form-control" title="Start date"><input type="date" id="minLogFilterEnd" class="form-control" title="End date"></div><div id="ministryIntentsLogList"></div></div></section>';
        tab.dataset.canonicalLogShell = 'true';
        byId('btnSubMemCommunity').addEventListener('click', () => root.switchMemSubTab('community'));
        byId('btnSubMemMinistry').addEventListener('click', () => root.switchMemSubTab('ministry'));
        for (const id of ['commFilterName', 'commFilterStart', 'commFilterEnd']) {
            byId(id).addEventListener('input', () => root.filterCommunityLogs());
        }
        for (const id of ['minLogFilterName', 'minLogFilterStart', 'minLogFilterEnd']) {
            byId(id).addEventListener('input', () => root.filterMinistryLogs());
        }
    }

    function showMembershipSubTab(tab) {
        ensureMembershipAdminTab();
        const community = tab !== 'ministry';
        byId('subTabMemCommunity').hidden = !community;
        byId('subTabMemMinistry').hidden = community;
        byId('btnSubMemCommunity').classList.toggle('active', community);
        byId('btnSubMemMinistry').classList.toggle('active', !community);
    }

    root.switchMemSubTab = function switchMemSubTab(tab) {
        showMembershipSubTab(tab);
        return root.loadMembershipAdminData();
    };

    function permissionState(kind) {
        const permission = kind === 'membership' ? 'edit_entries'
            : kind === 'attendance' ? 'access_attendance' : 'access_activity';
        if (root.koinoniaAuthStatus !== 'authenticated' || root.isGuestMode) return 'signin';
        return typeof root.hasPerm === 'function' && root.hasPerm(permission) ? 'allowed' : 'forbidden';
    }

    function loadDeniedState(container, kind) {
        const message = permissionState(kind) === 'signin'
            ? 'Please sign in to view these logs.'
            : 'You do not have permission to view these logs.';
        emptyState(container, message, true);
    }

    function singleFlightLogLoad(kind, task) {
        const previous = state.logLoads[kind];
        if (previous && (previous.pending || Date.now() - previous.startedAt < 250)) {
            return previous.promise;
        }
        const entry = { startedAt: Date.now(), pending: true };
        entry.promise = Promise.resolve().then(task);
        state.logLoads[kind] = entry;
        entry.promise.then(
            () => { entry.pending = false; },
            () => { entry.pending = false; }
        );
        return entry.promise;
    }

    async function fetchArray(url, label) {
        const response = await root.fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            const error = new Error(`${label} returned HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) throw new Error(`${label} returned an invalid response`);
        return payload;
    }

    root.loadMembershipAdminData = function loadMembershipAdminData() {
        ensureMembershipAdminTab();
        if (permissionState('membership') !== 'allowed') {
            state.communityIntents = [];
            state.ministryLogs = [];
            loadDeniedState(byId('communityIntentsList'), 'membership');
            loadDeniedState(byId('ministryIntentsLogList'), 'membership');
            return Promise.resolve();
        }
        return singleFlightLogLoad('membership', async () => {
            const generation = state.logGeneration;
            state.communityIntents = [];
            state.ministryLogs = [];
            emptyState(byId('communityIntentsList'), 'Loading Community Intent logs…');
            emptyState(byId('ministryIntentsLogList'), 'Loading ministry logs…');
            const [community, ministry] = await Promise.allSettled([
                fetchArray('/api/admin/community-intents-v2', 'Community Intent logs'),
                fetchArray('/api/admin/ministry-logs-v36', 'Ministry logs')
            ]);
            if (generation !== state.logGeneration || permissionState('membership') !== 'allowed') return;
            if (community.status === 'fulfilled') {
                state.communityIntents = community.value;
                root.cachedCommunityIntents = community.value;
                root.filterCommunityLogs();
            } else {
                emptyState(byId('communityIntentsList'),
                    community.reason && community.reason.status === 401 ? 'Please sign in to view Community Intent logs.'
                        : community.reason && community.reason.status === 403 ? 'You do not have permission to view Community Intent logs.'
                            : 'Unable to load Community Intent logs.', true);
            }
            if (ministry.status === 'fulfilled') {
                state.ministryLogs = ministry.value;
                root.cachedMinistryLogs = ministry.value;
                root.filterMinistryLogs();
            } else {
                emptyState(byId('ministryIntentsLogList'),
                    ministry.reason && ministry.reason.status === 401 ? 'Please sign in to view ministry history logs.'
                        : ministry.reason && ministry.reason.status === 403 ? 'You do not have permission to view ministry history logs.'
                            : 'Unable to load ministry logs.', true);
            }
        });
    };

    function dateMatches(value, start, end) {
        const date = String(value || '').slice(0, 10);
        if (!date && (start || end)) return false;
        return (!start || date >= start) && (!end || date <= end);
    }

    root.filterCommunityLogs = function filterCommunityLogs() {
        const query = String(byId('commFilterName')?.value || '').trim().toLowerCase();
        const start = byId('commFilterStart')?.value || '';
        const end = byId('commFilterEnd')?.value || '';
        root.renderCommunityIntents(state.communityIntents.filter(item =>
            String(item.name || '').toLowerCase().includes(query) &&
            dateMatches(item.intent_recorded_at, start, end)
        ));
    };

    root.renderCommunityIntents = function renderCommunityIntents(items) {
        const container = byId('communityIntentsList');
        if (!items.length) return emptyState(container,
            state.communityIntents.length ? 'No Community Intent logs match this filter.' : 'No Community Intent logs yet.');
        container.replaceChildren();
        for (const item of items) {
            const card = document.createElement('article');
            card.className = 'log-card log-card--community';
            appendText(card, 'strong', item.name || `Member ${item.id}`);
            appendText(card, 'small', `Intent recorded: ${item.intent_recorded_at || 'Timestamp unavailable'}`);
            if (item.commitment_accepted_at) {
                appendText(card, 'small', `Accepted: ${item.commitment_accepted_at} by ${item.commitment_accepted_by || 'Authorized leader'}`);
            }
            appendText(card, 'p', item.commitment_intent || 'No reflection was recorded.');
            const awaitingAcceptance = !item.commitment_accepted_at &&
                !['Committed Member', 'Leader'].includes(item.account_tier);
            if (awaitingAcceptance && typeof root.approveFullMember === 'function') {
                const button = appendText(card, 'button', 'Accept as Committed Member', 'btn btn-primary btn-sm');
                button.type = 'button';
                button.addEventListener('click', () => root.approveFullMember(item.id));
            }
            container.appendChild(card);
        }
    };

    root.filterMinistryLogs = function filterMinistryLogs() {
        const query = String(byId('minLogFilterName')?.value || '').trim().toLowerCase();
        const start = byId('minLogFilterStart')?.value || '';
        const end = byId('minLogFilterEnd')?.value || '';
        root.renderMinistryLogs(state.ministryLogs.filter(item =>
            (`${item.applicant_name || ''} ${item.ministry_name || ''}`).toLowerCase().includes(query) &&
            dateMatches(item.timestamp, start, end)
        ));
    };

    root.renderMinistryLogs = function renderMinistryLogs(items) {
        const container = byId('ministryIntentsLogList');
        if (!items.length) return emptyState(container,
            state.ministryLogs.length ? 'No ministry logs match this filter.' : 'No ministry history logs yet.');
        container.replaceChildren();
        for (const item of items) {
            const card = document.createElement('article');
            card.className = 'log-card log-card--ministry';
            appendText(card, 'strong', `${item.applicant_name || 'Unknown member'} — ${item.ministry_name || 'Unknown ministry'}`);
            appendText(card, 'small', `${item.timestamp || 'Timestamp unavailable'} · ${item.actor || 'System'}`);
            appendText(card, 'p', item.intent_message || `Role: ${item.role || 'Unspecified'}`);
            container.appendChild(card);
        }
    };

    function renderLogTable(container, columns, rows, emptyMessage) {
        if (!rows.length) return emptyState(container, emptyMessage);
        container.replaceChildren();
        const table = document.createElement('table');
        table.className = 'responsive-table';
        const head = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const column of columns) appendText(headerRow, 'th', column.label);
        head.appendChild(headerRow);
        const body = document.createElement('tbody');
        for (const row of rows) {
            const tr = document.createElement('tr');
            for (const column of columns) {
                const cell = document.createElement('td');
                if (typeof column.render === 'function') column.render(cell, row);
                else cell.textContent = column.value(row);
                tr.appendChild(cell);
            }
            body.appendChild(tr);
        }
        table.append(head, body);
        container.appendChild(table);
    }

    function renderPagedLogTable(kind, container, columns, rows, emptyMessage) {
        if (!rows.length) return emptyState(container, emptyMessage);
        const pageKey = kind === 'attendance' ? 'attendancePage' : 'activityPage';
        const pageSize = 10;
        const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
        state[pageKey] = Math.min(Math.max(1, state[pageKey]), pageCount);
        const start = (state[pageKey] - 1) * pageSize;
        renderLogTable(container, columns, rows.slice(start, start + pageSize), emptyMessage);
        if (pageCount === 1) return;
        const controls = document.createElement('div');
        controls.className = 'log-pagination';
        const previous = appendText(controls, 'button', 'Previous', 'btn btn-outline btn-sm');
        previous.type = 'button';
        previous.disabled = state[pageKey] === 1;
        appendText(controls, 'span', `Page ${state[pageKey]} of ${pageCount}`);
        const next = appendText(controls, 'button', 'Next', 'btn btn-outline btn-sm');
        next.type = 'button';
        next.disabled = state[pageKey] === pageCount;
        const rerender = () => kind === 'attendance' ? renderAttendancePage() : renderActivityPage();
        previous.addEventListener('click', () => { state[pageKey] -= 1; rerender(); });
        next.addEventListener('click', () => { state[pageKey] += 1; rerender(); });
        container.appendChild(controls);
    }

    function renderAttendancePage() {
        renderPagedLogTable('attendance', byId('attendanceLogsContainer'), [
            { label: 'Member', value: item => item.member_name || 'Unknown member' },
            { label: 'Event', value: item => item.event_name || 'Unknown event' },
            { label: 'Checked in', value: item => item.checked_in_at || 'Timestamp unavailable' },
            { label: 'Type', value: item => item.is_walkin ? 'Walk-in' : 'Pre-registered' },
            {
                label: 'Actions',
                render(cell, item) {
                    if (typeof root.hasPerm === 'function' && root.hasPerm('edit_entries') &&
                        typeof root.openEditAttendanceModal === 'function') {
                        const edit = appendText(cell, 'button', 'Edit', 'btn btn-outline btn-sm');
                        edit.type = 'button';
                        edit.addEventListener('click', () => root.openEditAttendanceModal(item.id, item.checked_in_at, item.is_walkin));
                    }
                    if (typeof root.hasPerm === 'function' && root.hasPerm('delete_entries') &&
                        typeof root.triggerDeleteAttendance === 'function') {
                        const remove = appendText(cell, 'button', 'Delete', 'btn btn-danger btn-sm');
                        remove.type = 'button';
                        remove.addEventListener('click', () => root.triggerDeleteAttendance(item.id, item.member_name || 'Unknown member'));
                    }
                }
            }
        ], state.filteredAttendanceLogs, 'No event attendance logs match this filter.');
    }

    root.loadAttendanceLogs = function loadAttendanceLogs() {
        const container = byId('attendanceLogsContainer');
        if (permissionState('attendance') !== 'allowed') {
            state.attendanceLogs = [];
            loadDeniedState(container, 'attendance');
            return Promise.resolve();
        }
        return singleFlightLogLoad('attendance', async () => {
            const generation = state.logGeneration;
            state.attendanceLogs = [];
            emptyState(container, 'Loading event attendance…');
            try {
                const logs = await fetchArray('/api/attendance/logs', 'Attendance logs');
                if (generation !== state.logGeneration || permissionState('attendance') !== 'allowed') return;
                state.attendanceLogs = logs;
                try { cachedAttendanceLogs = state.attendanceLogs; } catch (error) { /* app.js owns this binding */ }
                root.filterAttendanceLogs();
            } catch (error) {
                if (generation !== state.logGeneration) return;
                emptyState(container,
                    error.status === 401 ? 'Please sign in to view event attendance logs.'
                        : error.status === 403 ? 'You do not have permission to view event attendance logs.'
                            : 'Unable to load event attendance logs.', true);
            }
        });
    };

    root.filterAttendanceLogs = function filterAttendanceLogs() {
        const query = String(byId('attendanceSearchInput')?.value || '').trim().toLowerCase();
        state.filteredAttendanceLogs = state.attendanceLogs.filter(item =>
            (`${item.member_name || ''} ${item.event_name || ''}`).toLowerCase().includes(query)
        );
        state.attendancePage = 1;
        renderAttendancePage();
    };

    root.loadActivityLogs = function loadActivityLogs() {
        const container = byId('activityLogsContainer');
        if (permissionState('activity') !== 'allowed') {
            state.activityLogs = [];
            loadDeniedState(container, 'activity');
            return Promise.resolve();
        }
        return singleFlightLogLoad('activity', async () => {
            const generation = state.logGeneration;
            state.activityLogs = [];
            emptyState(container, 'Loading audit history…');
            try {
                const logs = await fetchArray('/api/activity-logs', 'Audit logs');
                if (generation !== state.logGeneration || permissionState('activity') !== 'allowed') return;
                state.activityLogs = logs;
                try { cachedActivityLogs = state.activityLogs; } catch (error) { /* app.js owns this binding */ }
                root.filterActivityLogs();
            } catch (error) {
                if (generation !== state.logGeneration) return;
                emptyState(container,
                    error.status === 401 ? 'Please sign in to view audit logs.'
                        : error.status === 403 ? 'You do not have permission to view audit logs.'
                            : 'Unable to load audit logs.', true);
            }
        });
    };

    root.filterActivityLogs = function filterActivityLogs() {
        const query = String(byId('activitySearchInput')?.value || '').trim().toLowerCase();
        state.filteredActivityLogs = state.activityLogs.filter(item =>
            (`${item.actor_display_name || item.username || ''} ${item.actor_identifier || ''} ${item.action || ''} ${item.details || ''}`).toLowerCase().includes(query)
        );
        state.activityPage = 1;
        renderActivityPage();
    };

    function renderActivityPage() {
        renderPagedLogTable('activity', byId('activityLogsContainer'), [
            { label: 'Actor', value: item => item.actor_display_name || item.username || 'System' },
            { label: 'Action', value: item => item.action || '' },
            { label: 'Details', value: item => item.details || '' },
            { label: 'Timestamp', value: item => item.created_at || 'Timestamp unavailable' }
        ], state.filteredActivityLogs, 'No audit logs match this filter.');
    }

    ensureMembershipAdminTab();
    if (!root.isGuestMode && root.koinoniaAuthStatus === 'authenticated') {
        root.renderBottomNav('pulseDashboardTab');
    }
    refreshHeaderProfile();
    Promise.resolve(root.authReady).catch(() => null).finally(() => {
        refreshHeaderProfile();
        if (root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode &&
            !(document.body && document.body.classList.contains('koinonia-offline-readonly')) &&
            typeof root.refreshNotificationBell === 'function') {
            void root.refreshNotificationBell().catch(() => null);
        }
        const eventId = normalizeId(new URL(root.location.href).searchParams.get('event'));
        if (eventId && state.preregEventId !== eventId) {
            root.launchPublicPrereg(eventId, { updateHistory: false });
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
