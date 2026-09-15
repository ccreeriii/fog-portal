(function installCommunityFeaturePolish(root) {
    'use strict';

    const document = root.document;
    const discipleship = root.V2Discipleship;
    if (!document || !discipleship || root.__communityFeaturePolishInstalled) return;
    root.__communityFeaturePolishInstalled = true;

    const state = {
        prayers: [],
        groups: [],
        prayerPage: 1,
        prayerGeneration: 0,
        groupGeneration: 0,
        prayerRequest: null,
        groupRequest: null,
        prayerMutation: false
    };

    function byId(id) { return document.getElementById(id); }
    function memberId() {
        const id = Number(root.currentMember && root.currentMember.id);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }
    function isAuthenticated() {
        return root.koinoniaAuthStatus === 'authenticated' && !root.isGuestMode && memberId() !== null;
    }
    function appendText(parent, tag, value, className) {
        const child = document.createElement(tag);
        if (className) child.className = className;
        child.textContent = value == null ? '' : String(value);
        parent.appendChild(child);
        return child;
    }
    function showState(container, message, isError = false) {
        if (!container) return;
        container.replaceChildren();
        const status = appendText(container, 'div', message,
            `feature-state${isError ? ' feature-state--error' : ''}`);
        status.setAttribute('role', isError ? 'alert' : 'status');
    }
    function preview(value, limit = 135) {
        const text = String(value || '').trim();
        return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
    }
    function action(parent, label, callback, className = 'btn btn-outline btn-sm') {
        const button = appendText(parent, 'button', label, className);
        button.type = 'button';
        button.addEventListener('click', callback);
        return button;
    }
    function pagination(container, page, totalPages, setPage) {
        if (totalPages <= 1) return;
        const controls = document.createElement('nav');
        controls.className = 'feature-pagination';
        controls.setAttribute('aria-label', 'Page navigation');
        const previous = action(controls, 'Previous', () => setPage(page - 1));
        previous.disabled = page <= 1;
        appendText(controls, 'span', `Page ${page} of ${totalPages}`);
        const next = action(controls, 'Next', () => setPage(page + 1));
        next.disabled = page >= totalPages;
        container.appendChild(controls);
    }
    function setupSplitTabs(firstButtonId, secondButtonId, firstPanelId, secondPanelId) {
        const buttons = [byId(firstButtonId), byId(secondButtonId)];
        const panels = [byId(firstPanelId), byId(secondPanelId)];
        if (buttons.some(button => !button) || panels.some(panel => !panel)) return () => {};
        const select = index => {
            buttons.forEach((button, position) => {
                const active = position === index;
                button.classList.toggle('active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
                button.tabIndex = active ? 0 : -1;
                panels[position].hidden = !active;
            });
        };
        buttons.forEach((button, index) => {
            button.addEventListener('click', () => select(index));
            button.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
                select(next);
                buttons[next].focus();
            });
        });
        select(0);
        return select;
    }

    const showPrayerTab = setupSplitTabs(
        'prayerWallTabButton', 'prayerSubmitTabButton', 'prayerWallPanel', 'prayerSubmitPanel');
    const showGroupTab = setupSplitTabs(
        'myGroupsTabButton', 'discoverGroupsTabButton', 'myGroupsPanel', 'discoverGroupsPanel');

    function prayerCard(prayer) {
        const card = document.createElement('article');
        card.className = 'feature-card feature-card--prayer';
        appendText(card, 'h3', prayer.title || 'Prayer request', 'feature-card__title');
        const author = prayer.is_anonymous ? 'Anonymous' : prayer.author_name || 'Member';
        const count = Number(prayer.prayer_count);
        const metadata = [author, prayer.created_at || null,
            Number.isSafeInteger(count) && count > 0 ? `${count} praying` : null]
            .filter(Boolean).join(' · ');
        appendText(card, 'p', metadata, 'feature-card__meta');
        appendText(card, 'p', preview(prayer.request), 'feature-card__preview');
        const details = appendText(card, 'p', prayer.request || '', 'feature-card__details');
        details.hidden = true;
        details.id = `prayerDetails-${prayer.id}`;
        const actions = document.createElement('div');
        actions.className = 'feature-card__actions';
        const expand = action(actions, 'Read More', () => {
            details.hidden = !details.hidden;
            expand.textContent = details.hidden ? 'Read More' : 'Show Less';
            expand.setAttribute('aria-expanded', details.hidden ? 'false' : 'true');
        });
        expand.setAttribute('aria-expanded', 'false');
        expand.setAttribute('aria-controls', details.id);
        action(actions, 'Pray for This', () => discipleship.intercedePrayer(prayer.id), 'btn btn-primary btn-sm');
        if (prayer.is_owner && typeof discipleship.openEditPrayerModal === 'function') {
            action(actions, 'Edit', () => discipleship.openEditPrayerModal(prayer.id));
        }
        card.appendChild(actions);
        return card;
    }

    function renderPrayerWall() {
        const container = byId('prayerWallContainer');
        if (!container) return;
        if (!state.prayers.length) return showState(container, 'No prayer requests yet.');
        const pages = Math.ceil(state.prayers.length / 10);
        state.prayerPage = Math.min(Math.max(state.prayerPage, 1), pages);
        container.replaceChildren();
        const start = (state.prayerPage - 1) * 10;
        state.prayers.slice(start, start + 10).forEach(prayer => container.appendChild(prayerCard(prayer)));
        pagination(container, state.prayerPage, pages, next => {
            state.prayerPage = next;
            renderPrayerWall();
        });
    }

    discipleship.loadPrayers = function loadCanonicalPrayerWall() {
        const container = byId('prayerWallContainer');
        if (!container) return Promise.resolve();
        if (!isAuthenticated()) {
            showState(container, 'Sign in to view the Prayer Wall.', true);
            return Promise.resolve();
        }
        const ownerId = memberId();
        const previous = state.prayerRequest;
        if (previous && previous.memberId === ownerId && previous.pending) return previous.promise;
        if (!state.prayerMutation && previous && previous.memberId === ownerId &&
            Date.now() - previous.startedAt < 250) return previous.promise;
        const generation = ++state.prayerGeneration;
        const request = { memberId: ownerId, pending: true, startedAt: Date.now() };
        state.prayerRequest = request;
        showState(container, 'Loading prayers…');
        request.promise = (async () => {
            try {
                const response = await root.fetch('/api/prayers', { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const prayers = await response.json();
                if (!Array.isArray(prayers)) throw new Error('Invalid Prayer Wall response');
                if (generation !== state.prayerGeneration || !isAuthenticated() || ownerId !== memberId()) return;
                state.prayers = prayers;
                discipleship.prayersData = prayers;
                state.prayerPage = 1;
                renderPrayerWall();
            } catch (error) {
                if (generation === state.prayerGeneration && isAuthenticated() && ownerId === memberId()) {
                    showState(container, 'Unable to load prayer requests.', true);
                }
            } finally {
                request.pending = false;
            }
        })();
        return request.promise;
    };

    for (const method of ['submitPrayer', 'updatePrayer', 'intercedePrayer']) {
        const previous = discipleship[method];
        if (typeof previous !== 'function') continue;
        discipleship[method] = async function refreshPrayerAfterMutation(...args) {
            state.prayerMutation = true;
            try { return await previous.apply(this, args); }
            finally { state.prayerMutation = false; }
        };
    }

    function groupCard(group, mode) {
        const card = document.createElement('article');
        card.className = 'feature-card feature-card--groups';
        appendText(card, 'h3', group.name || 'Campfire', 'feature-card__title');
        const meta = [group.meeting_schedule || null, group.venue || null,
            group.leader_name ? `Led by ${group.leader_name}` : null]
            .filter(Boolean).join(' · ');
        if (meta) appendText(card, 'p', meta, 'feature-card__meta');
        const actions = document.createElement('div');
        actions.className = 'feature-card__actions';
        if (mode === 'approved') {
            action(actions, 'Open Group', () => {
                if (typeof root.openGroupDashboard === 'function') {
                    root.openGroupDashboard(group.id, group.name, group.logo,
                        group.leader_name || '', group.leader_id);
                }
            }, 'btn btn-primary btn-sm');
        } else if (mode === 'pending') {
            const pending = action(actions,
                group.user_status === 'Pending' ? 'Request Pending' : 'Invitation Pending', () => {});
            pending.disabled = true;
        } else {
            action(actions, group.privacy_level === 'Approval' ? 'Request to Join' : 'Join Group',
                () => discipleship.joinSmallGroup(group.id));
        }
        card.appendChild(actions);
        return card;
    }

    function renderGroups() {
        const mine = byId('smallGroupsContainer');
        const discover = byId('discoverGroupsContainer');
        if (!mine || !discover) return;
        const myGroups = state.groups.filter(group => Boolean(group.user_status));
        const discoverable = state.groups.filter(group =>
            !group.user_status && group.privacy_level !== 'Invite-Only');
        mine.replaceChildren();
        discover.replaceChildren();
        if (!myGroups.length) showState(mine, 'You are not in a group yet.');
        else myGroups.forEach(group => mine.appendChild(groupCard(group,
            group.user_status === 'Approved' ? 'approved' : 'pending')));
        if (!discoverable.length) showState(discover, 'No groups are available to discover right now.');
        else discoverable.forEach(group => discover.appendChild(groupCard(group, 'discover')));
    }

    function renderGroupAdminList() {
        const container = byId('adminSmallGroupsList');
        if (!container) return;
        container.replaceChildren();
        if (!state.groups.length) return showState(container, 'No groups have been established yet.');
        for (const group of state.groups) {
            const card = document.createElement('article');
            card.className = 'feature-card';
            appendText(card, 'h3', group.name || 'Campfire', 'feature-card__title');
            appendText(card, 'p', `${group.leader_name || 'Leader unassigned'} · ${group.member_count || 0} members`,
                'feature-card__meta');
            const actions = document.createElement('div');
            actions.className = 'feature-card__actions';
            if (typeof root.hasPerm === 'function' && root.hasPerm('edit_entries')) {
                action(actions, 'Edit', () => discipleship.openEditSmallGroupModal(group.id));
            }
            if (typeof root.hasPerm === 'function' && root.hasPerm('delete_entries')) {
                action(actions, 'Delete', () => discipleship.deleteSmallGroup(group.id), 'btn btn-danger btn-sm');
            }
            card.appendChild(actions);
            container.appendChild(card);
        }
    }

    discipleship.loadSmallGroups = function loadCanonicalGroupLists() {
        const mine = byId('smallGroupsContainer');
        const admin = byId('adminSmallGroupsList');
        if (!mine && !admin) return Promise.resolve();
        if (!isAuthenticated()) {
            showState(mine, 'Sign in to view your groups.', true);
            showState(byId('discoverGroupsContainer'), 'Sign in to discover groups.', true);
            return Promise.resolve();
        }
        const ownerId = memberId();
        const previous = state.groupRequest;
        if (previous && previous.memberId === ownerId && previous.pending) return previous.promise;
        const generation = ++state.groupGeneration;
        const request = { memberId: ownerId, pending: true };
        state.groupRequest = request;
        showState(mine, 'Loading groups…');
        showState(byId('discoverGroupsContainer'), 'Loading groups…');
        request.promise = (async () => {
            try {
                const response = await root.fetch(`/api/small-groups?youth_id=${ownerId}`,
                    { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const groups = await response.json();
                if (!Array.isArray(groups)) throw new Error('Invalid Groups response');
                if (generation !== state.groupGeneration || !isAuthenticated() || ownerId !== memberId()) return;
                state.groups = groups;
                discipleship.groupsData = groups;
                renderGroups();
                renderGroupAdminList();
            } catch (error) {
                if (generation === state.groupGeneration && isAuthenticated() && ownerId === memberId()) {
                    showState(mine, 'Unable to load groups.', true);
                    showState(byId('discoverGroupsContainer'), 'Unable to load groups.', true);
                }
            } finally {
                request.pending = false;
            }
        })();
        return request.promise;
    };

    const previousSwitchGrowthSubTab = root.switchGrowthSubTab;
    if (typeof previousSwitchGrowthSubTab === 'function') {
        root.switchGrowthSubTab = function activatePolishedFeatureTab(subTabName, ...args) {
            const result = previousSwitchGrowthSubTab.call(this, subTabName, ...args);
            if (subTabName === 'Prayer') {
                showPrayerTab(0);
                void discipleship.loadPrayers();
            } else if (subTabName === 'Groups') {
                showGroupTab(0);
                void discipleship.loadSmallGroups();
            }
            return result;
        };
    }
})(typeof window !== 'undefined' ? window : globalThis);
