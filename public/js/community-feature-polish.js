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

    function groupLogoNode(group, size = 56) {
        const fallback = document.createElement('div');
        fallback.textContent = '🔥';
        fallback.setAttribute('aria-hidden', 'true');
        fallback.setAttribute(
            'style',
            `width:${size}px;height:${size}px;min-width:${size}px;border-radius:12px;` +
            'background:#FFF0E6;border:1px solid rgba(255,107,0,.18);' +
            'display:flex;align-items:center;justify-content:center;font-size:1.65rem;overflow:hidden;'
        );

        const rawLogo = typeof group.logo === 'string' ? group.logo.trim() : '';
        const safeLogo = rawLogo && (
            rawLogo.startsWith('data:image/') ||
            rawLogo.startsWith('/') ||
            /^https?:\/\//i.test(rawLogo)
        );

        if (!safeLogo) return fallback;

        const image = document.createElement('img');
        image.src = rawLogo;
        image.alt = `${group.name || 'Campfire'} logo`;
        image.loading = 'lazy';
        image.setAttribute(
            'style',
            `width:${size}px;height:${size}px;min-width:${size}px;border-radius:12px;` +
            'object-fit:cover;display:block;border:1px solid rgba(255,107,0,.18);'
        );

        image.addEventListener('error', () => {
            if (image.isConnected) image.replaceWith(fallback);
        }, { once: true });

        return image;
    }

    function groupCard(group, mode) {
        const card = document.createElement('article');
        card.className = 'feature-card feature-card--groups';
        const identity = document.createElement('div');
        identity.setAttribute(
            'style',
            'display:flex;gap:14px;align-items:center;margin-bottom:12px;'
        );
        identity.appendChild(groupLogoNode(group, 56));

        const identityText = document.createElement('div');
        identityText.setAttribute('style', 'min-width:0;');
        appendText(identityText, 'h3', group.name || 'Campfire', 'feature-card__title');

        const meta = [group.meeting_schedule || null, group.venue || null,
            group.leader_name ? `Led by ${group.leader_name}` : null]
            .filter(Boolean).join(' · ');
        if (meta) appendText(identityText, 'p', meta, 'feature-card__meta');

        identity.appendChild(identityText);
        card.appendChild(identity);
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
            const identity = document.createElement('div');
            identity.setAttribute(
            'style',
            'display:flex;gap:14px;align-items:center;margin-bottom:12px;'
        );
            identity.appendChild(groupLogoNode(group, 50));

            const identityText = document.createElement('div');
            identityText.setAttribute('style', 'min-width:0;');
            appendText(identityText, 'h3', group.name || 'Campfire', 'feature-card__title');
            appendText(identityText, 'p',
                `${group.leader_name || 'Leader unassigned'} · ${group.member_count || 0} members`,
                'feature-card__meta');

            identity.appendChild(identityText);
            card.appendChild(identity);
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

// ============================================================
// FINAL PRIVATE JOURNAL POLISH
// Late canonical presentation layer. Journal authorization remains
// server-owned; this layer changes presentation only.
// ============================================================
(function installPrivateJournalPolish(root) {
    'use strict';

    const document = root.document;
    const discipleship = root.V2Discipleship;

    if (!document || !discipleship || root.__privateJournalPolishInstalled) return;
    root.__privateJournalPolishInstalled = true;

    const state = {
        entries: [],
        page: 1,
        generation: 0,
        request: null
    };

    let selectJournalTab = () => {};

    function byId(id) {
        return document.getElementById(id);
    }

    function memberId() {
        const id = Number(root.currentMember && root.currentMember.id);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

    function isAuthenticated() {
        return root.koinoniaAuthStatus === 'authenticated' &&
            !root.isGuestMode &&
            memberId() !== null;
    }

    function appendText(parent, tag, value, className) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        node.textContent = value == null ? '' : String(value);
        parent.appendChild(node);
        return node;
    }

    function action(parent, label, callback, className = 'btn btn-outline btn-sm') {
        const button = appendText(parent, 'button', label, className);
        button.type = 'button';
        button.addEventListener('click', callback);
        return button;
    }

    function preview(value, limit = 145) {
        const text = String(value || '').trim();
        return text.length > limit
            ? `${text.slice(0, limit).trimEnd()}…`
            : text;
    }

    function showState(container, message, isError = false) {
        if (!container) return;

        container.replaceChildren();

        const status = appendText(
            container,
            'div',
            message,
            `feature-state${isError ? ' feature-state--error' : ''}`
        );

        status.setAttribute('role', isError ? 'alert' : 'status');
    }

    function setupJournalShell() {
        const form = byId('journalForm');
        const list = byId('journalsContainer');

        if (!form || !list) return false;

        const host = form.closest('.card') || form.parentElement;
        if (!host) return false;

        if (host.dataset.journalPolished === 'true') return true;
        host.dataset.journalPolished = 'true';
        host.classList.add('journal-feature-shell');

        for (const heading of host.querySelectorAll('h1,h2,h3')) {
            if (heading.textContent.trim() === 'Private Journal') {
                heading.hidden = true;
                break;
            }
        }

        const intro = document.createElement('section');
        intro.id = 'journalFeatureIntro';
        intro.className = 'feature-intro feature-intro--journal';
        intro.setAttribute('aria-labelledby', 'journalFeatureTitle');

        const icon = appendText(
            intro,
            'div',
            '✦',
            'feature-intro__icon'
        );
        icon.setAttribute('aria-hidden', 'true');

        const copy = document.createElement('div');

        appendText(
            copy,
            'p',
            'Private Journal · Private to you',
            'feature-intro__eyebrow'
        );

        const title = appendText(
            copy,
            'h2',
            'Pause. Reflect. Grow.'
        );
        title.id = 'journalFeatureTitle';

        appendText(
            copy,
            'p',
            'A personal space to notice what God is doing, remember prayers and lessons, and reflect on your growth.'
        );

        const privacy = appendText(
            copy,
            'p',
            '🔒 Only you can view your journal entries.',
            'feature-intro__privacy'
        );
        privacy.setAttribute('role', 'note');

        intro.appendChild(copy);

        const tabs = document.createElement('div');
        tabs.className = 'feature-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Private Journal');

        const listButton = appendText(
            tabs,
            'button',
            'My Journal',
            'feature-tab'
        );
        listButton.id = 'myJournalTabButton';
        listButton.type = 'button';
        listButton.setAttribute('role', 'tab');

        const createButton = appendText(
            tabs,
            'button',
            'New Entry',
            'feature-tab'
        );
        createButton.id = 'newJournalTabButton';
        createButton.type = 'button';
        createButton.setAttribute('role', 'tab');

        const listPanel = document.createElement('section');
        listPanel.id = 'myJournalPanel';
        listPanel.className = 'feature-panel';
        listPanel.setAttribute('role', 'tabpanel');
        listPanel.setAttribute('aria-labelledby', listButton.id);

        const createPanel = document.createElement('section');
        createPanel.id = 'newJournalPanel';
        createPanel.className = 'feature-panel';
        createPanel.setAttribute('role', 'tabpanel');
        createPanel.setAttribute('aria-labelledby', createButton.id);

        listPanel.appendChild(list);
        createPanel.appendChild(form);

        form.classList.add('journal-form-polished');

        host.prepend(intro, tabs, listPanel, createPanel);

        const buttons = [listButton, createButton];
        const panels = [listPanel, createPanel];

        selectJournalTab = index => {
            buttons.forEach((button, position) => {
                const active = position === index;

                button.classList.toggle('active', active);
                button.setAttribute(
                    'aria-selected',
                    active ? 'true' : 'false'
                );
                button.tabIndex = active ? 0 : -1;

                panels[position].hidden = !active;
            });
        };

        buttons.forEach((button, index) => {
            button.addEventListener(
                'click',
                () => selectJournalTab(index)
            );

            button.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                    return;
                }

                event.preventDefault();

                const next =
                    event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                            ? 1
                            : 1 - index;

                selectJournalTab(next);
                buttons[next].focus();
            });
        });

        selectJournalTab(0);
        return true;
    }

    function journalCard(entry) {
        const card = document.createElement('article');
        card.className = 'feature-card feature-card--journal';

        appendText(
            card,
            'h3',
            entry.title || 'Journal entry',
            'feature-card__title'
        );

        const metadata = [
            entry.created_at || null,
            entry.framework || null,
            entry.mood || null
        ].filter(Boolean).join(' · ');

        if (metadata) {
            appendText(
                card,
                'p',
                metadata,
                'feature-card__meta'
            );
        }

        const rawContent = String(entry.content || '');

        appendText(
            card,
            'p',
            preview(rawContent),
            'feature-card__preview'
        );

        const details = appendText(
            card,
            'p',
            rawContent,
            'feature-card__details'
        );

        details.hidden = true;
        details.id = `journalDetails-${entry.id}`;

        const actions = document.createElement('div');
        actions.className = 'feature-card__actions';

        if (preview(rawContent) !== rawContent.trim()) {
            const expand = action(actions, 'Read More', () => {
                details.hidden = !details.hidden;

                expand.textContent =
                    details.hidden ? 'Read More' : 'Show Less';

                expand.setAttribute(
                    'aria-expanded',
                    details.hidden ? 'false' : 'true'
                );
            });

            expand.setAttribute('aria-expanded', 'false');
            expand.setAttribute('aria-controls', details.id);
        }

        if (typeof discipleship.openEditJournalModal === 'function') {
            action(
                actions,
                'Edit',
                () => discipleship.openEditJournalModal(entry.id)
            );
        }

        if (typeof discipleship.deleteJournal === 'function') {
            action(
                actions,
                'Delete',
                () => discipleship.deleteJournal(entry.id),
                'btn btn-outline btn-sm journal-delete-action'
            );
        }

        card.appendChild(actions);
        return card;
    }

    function renderEntries() {
        const container = byId('journalsContainer');
        if (!container) return;

        if (!state.entries.length) {
            showState(
                container,
                'No journal entries yet. Your reflections will appear here.'
            );
            return;
        }

        const totalPages = Math.ceil(state.entries.length / 10);
        state.page = Math.min(
            Math.max(state.page, 1),
            totalPages
        );

        container.replaceChildren();

        const start = (state.page - 1) * 10;

        state.entries
            .slice(start, start + 10)
            .forEach(entry => container.appendChild(journalCard(entry)));

        if (totalPages <= 1) return;

        const controls = document.createElement('nav');
        controls.className = 'feature-pagination';
        controls.setAttribute('aria-label', 'Journal pages');

        const previous = action(
            controls,
            'Previous',
            () => {
                state.page -= 1;
                renderEntries();
            }
        );

        previous.disabled = state.page <= 1;

        appendText(
            controls,
            'span',
            `Page ${state.page} of ${totalPages}`
        );

        const next = action(
            controls,
            'Next',
            () => {
                state.page += 1;
                renderEntries();
            }
        );

        next.disabled = state.page >= totalPages;

        container.appendChild(controls);
    }

    discipleship.loadJournals =
        function loadCanonicalJournalList() {
            setupJournalShell();

            const container = byId('journalsContainer');
            if (!container) return Promise.resolve();

            if (!isAuthenticated()) {
                showState(
                    container,
                    'Sign in to view your private journal.',
                    true
                );
                return Promise.resolve();
            }

            const ownerId = memberId();
            const previous = state.request;

            if (
                previous &&
                previous.memberId === ownerId &&
                previous.pending
            ) {
                return previous.promise;
            }

            const generation = ++state.generation;

            const request = {
                memberId: ownerId,
                pending: true
            };

            state.request = request;

            showState(container, 'Loading journal…');

            request.promise = (async () => {
                try {
                    const response = await root.fetch(
                        `/api/journals/${ownerId}`,
                        {
                            headers: {
                                Accept: 'application/json'
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const entries = await response.json();

                    if (!Array.isArray(entries)) {
                        throw new Error(
                            'Invalid Journal response'
                        );
                    }

                    if (
                        generation !== state.generation ||
                        !isAuthenticated() ||
                        ownerId !== memberId()
                    ) {
                        return;
                    }

                    state.entries = entries;
                    state.page = 1;

                    discipleship.journalsData = entries;

                    selectJournalTab(0);
                    renderEntries();
                } catch (error) {
                    if (
                        generation === state.generation &&
                        isAuthenticated() &&
                        ownerId === memberId()
                    ) {
                        showState(
                            container,
                            'Unable to load journal entries.',
                            true
                        );
                    }
                } finally {
                    request.pending = false;
                }
            })();

            return request.promise;
        };

    setupJournalShell();

    const previousSwitchGrowthSubTab =
        root.switchGrowthSubTab;

    if (typeof previousSwitchGrowthSubTab === 'function') {
        root.switchGrowthSubTab =
            function activatePolishedJournal(
                subTabName,
                ...args
            ) {
                const result =
                    previousSwitchGrowthSubTab.call(
                        this,
                        subTabName,
                        ...args
                    );

                if (subTabName === 'Journal') {
                    setupJournalShell();
                    selectJournalTab(0);
                    void discipleship.loadJournals();
                }

                return result;
            };
    }
})(typeof window !== 'undefined' ? window : globalThis);

// ============================================================
// PRAYER + JOURNAL LIST GRID CALENDAR
// Late presentation-only layer. Canonical APIs, authorization,
// mutations, privacy, and ownership remain unchanged.
// ============================================================
(function installPrayerJournalViewModes(root) {
    'use strict';

    const document = root.document;
    const discipleship = root.V2Discipleship;

    if (
        !document ||
        !discipleship ||
        root.__prayerJournalViewModesInstalled
    ) {
        return;
    }

    root.__prayerJournalViewModesInstalled = true;

    const viewState = {
        prayerView: 'list',
        journalView: 'list',
        prayerPage: 1,
        journalPage: 1,
        prayerMonth: null,
        journalMonth: null,
        prayerSelectedDate: null,
        journalSelectedDate: null
    };

    const PAGE_SIZE = 10;

    function byId(id) {
        return document.getElementById(id);
    }

    function textNode(parent, tag, value, className) {
        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        node.textContent =
            value == null ? '' : String(value);

        parent.appendChild(node);
        return node;
    }

    function button(
        parent,
        label,
        callback,
        className = 'btn btn-outline btn-sm'
    ) {
        const node = textNode(
            parent,
            'button',
            label,
            className
        );

        node.type = 'button';
        node.addEventListener('click', callback);

        return node;
    }

    function dateKey(value) {
        const raw = String(value || '').trim();

        const match =
            raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }

        const parsed = new Date(raw);

        if (Number.isNaN(parsed.getTime())) {
            return '';
        }

        const year = parsed.getFullYear();
        const month =
            String(parsed.getMonth() + 1).padStart(2, '0');
        const day =
            String(parsed.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    function dateFromKey(key) {
        const match =
            String(key || '')
                .match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (!match) return null;

        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );
    }

    function readableDate(value) {
        const key = dateKey(value);
        const date = dateFromKey(key);

        if (!date) {
            return String(value || '');
        }

        return new Intl.DateTimeFormat(
            'en-PH',
            {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }
        ).format(date);
    }

    function monthLabel(date) {
        return new Intl.DateTimeFormat(
            'en-PH',
            {
                month: 'long',
                year: 'numeric'
            }
        ).format(date);
    }

    function newestMonth(items) {
        const keys =
            items
                .map(item => dateKey(item.created_at))
                .filter(Boolean)
                .sort();

        const newest =
            keys.length
                ? dateFromKey(keys[keys.length - 1])
                : new Date();

        return new Date(
            newest.getFullYear(),
            newest.getMonth(),
            1
        );
    }

    function ensureMonth(kind, items) {
        const property =
            kind === 'prayer'
                ? 'prayerMonth'
                : 'journalMonth';

        if (!(viewState[property] instanceof Date)) {
            viewState[property] = newestMonth(items);
        }

        return viewState[property];
    }

    function shiftMonth(kind, delta) {
        const property =
            kind === 'prayer'
                ? 'prayerMonth'
                : 'journalMonth';

        const selectedProperty =
            kind === 'prayer'
                ? 'prayerSelectedDate'
                : 'journalSelectedDate';

        const current =
            viewState[property] instanceof Date
                ? viewState[property]
                : new Date();

        viewState[property] = new Date(
            current.getFullYear(),
            current.getMonth() + delta,
            1
        );

        viewState[selectedProperty] = null;
    }

    function buildViewToolbar(
        parent,
        kind,
        currentMode,
        setMode
    ) {
        const toolbar =
            document.createElement('div');

        toolbar.className =
            'feature-view-toolbar';

        const label = textNode(
            toolbar,
            'span',
            'View',
            'feature-view-toolbar__label'
        );

        label.setAttribute('aria-hidden', 'true');

        const controls =
            document.createElement('div');

        controls.className =
            'feature-view-toggle';

        controls.setAttribute(
            'role',
            'group'
        );

        controls.setAttribute(
            'aria-label',
            `${kind === 'prayer' ? 'Prayer' : 'Journal'} view`
        );

        const modes = [
            ['list', '☰', 'List'],
            ['grid', '▦', 'Grid'],
            ['calendar', '📅', 'Calendar']
        ];

        for (const [mode, icon, title] of modes) {
            const control =
                document.createElement('button');

            control.type = 'button';

            control.className =
                `feature-view-button${
                    currentMode === mode
                        ? ' active'
                        : ''
                }`;

            control.setAttribute(
                'aria-pressed',
                currentMode === mode
                    ? 'true'
                    : 'false'
            );

            control.title = `${title} view`;

            const symbol = textNode(
                control,
                'span',
                icon,
                'feature-view-button__icon'
            );

            symbol.setAttribute(
                'aria-hidden',
                'true'
            );

            textNode(
                control,
                'span',
                title,
                'feature-view-button__label'
            );

            control.addEventListener(
                'click',
                () => setMode(mode)
            );

            controls.appendChild(control);
        }

        toolbar.appendChild(controls);
        parent.appendChild(toolbar);
    }

    function pagination(
        parent,
        page,
        totalPages,
        setPage
    ) {
        if (totalPages <= 1) return;

        const nav =
            document.createElement('nav');

        nav.className =
            'feature-pagination';

        nav.setAttribute(
            'aria-label',
            'Page navigation'
        );

        const previous = button(
            nav,
            'Previous',
            () => setPage(page - 1)
        );

        previous.disabled = page <= 1;

        textNode(
            nav,
            'span',
            `Page ${page} of ${totalPages}`
        );

        const next = button(
            nav,
            'Next',
            () => setPage(page + 1)
        );

        next.disabled =
            page >= totalPages;

        parent.appendChild(nav);
    }

    function prayerMeta(prayer) {
        const parts = [];

        if (prayer.created_at) {
            parts.push(
                readableDate(prayer.created_at)
            );
        }

        const author =
            prayer.is_anonymous
                ? 'Anonymous'
                : prayer.author_name || 'Member';

        if (author) {
            parts.push(author);
        }

        const count =
            Number(prayer.prayer_count);

        if (
            Number.isFinite(count) &&
            count > 0
        ) {
            parts.push(
                `${count} praying`
            );
        }

        return parts.join(' · ');
    }

    function prayerActions(parent, prayer) {
        button(
            parent,
            'Pray for This',
            () => discipleship.intercedePrayer(prayer.id),
            'btn btn-primary btn-sm'
        );

        if (
            prayer.is_owner &&
            typeof discipleship.openEditPrayerModal === 'function'
        ) {
            button(
                parent,
                'Edit',
                () => discipleship.openEditPrayerModal(prayer.id)
            );
        }
    }

    function prayerListRow(prayer) {
        const row =
            document.createElement('article');

        row.className =
            'feature-list-row feature-list-row--prayer';

        const main =
            document.createElement('div');

        main.className =
            'feature-list-row__main';

        row.appendChild(main);

        textNode(
            main,
            'h3',
            prayer.title || 'Prayer request',
            'feature-list-row__title'
        );

        textNode(
            main,
            'p',
            prayerMeta(prayer),
            'feature-list-row__meta'
        );

        const details = textNode(
            row,
            'p',
            prayer.request || '',
            'feature-list-row__details'
        );

        details.hidden = true;

        const detailId =
            `prayerListDetails-${prayer.id}`;

        details.id = detailId;

        const actions =
            document.createElement('div');

        actions.className =
            'feature-list-row__actions';

        const view = button(
            actions,
            'View',
            () => {
                details.hidden =
                    !details.hidden;

                view.textContent =
                    details.hidden
                        ? 'View'
                        : 'Hide';

                view.setAttribute(
                    'aria-expanded',
                    details.hidden
                        ? 'false'
                        : 'true'
                );
            }
        );

        view.setAttribute(
            'aria-expanded',
            'false'
        );

        view.setAttribute(
            'aria-controls',
            detailId
        );

        prayerActions(
            actions,
            prayer
        );

        row.appendChild(actions);

        return row;
    }

    function prayerGridCard(prayer) {
        const card =
            document.createElement('article');

        card.className =
            'feature-card feature-card--prayer';

        textNode(
            card,
            'h3',
            prayer.title || 'Prayer request',
            'feature-card__title'
        );

        textNode(
            card,
            'p',
            prayerMeta(prayer),
            'feature-card__meta'
        );

        const request =
            String(prayer.request || '');

        const preview =
            request.length > 145
                ? `${request.slice(0, 145).trimEnd()}…`
                : request;

        textNode(
            card,
            'p',
            preview,
            'feature-card__preview'
        );

        const details = textNode(
            card,
            'p',
            request,
            'feature-card__details'
        );

        details.hidden = true;

        const detailId =
            `prayerGridDetails-${prayer.id}`;

        details.id = detailId;

        const actions =
            document.createElement('div');

        actions.className =
            'feature-card__actions';

        if (preview !== request) {
            const expand = button(
                actions,
                'Read More',
                () => {
                    details.hidden =
                        !details.hidden;

                    expand.textContent =
                        details.hidden
                            ? 'Read More'
                            : 'Show Less';

                    expand.setAttribute(
                        'aria-expanded',
                        details.hidden
                            ? 'false'
                            : 'true'
                    );
                }
            );

            expand.setAttribute(
                'aria-expanded',
                'false'
            );

            expand.setAttribute(
                'aria-controls',
                detailId
            );
        }

        prayerActions(
            actions,
            prayer
        );

        card.appendChild(actions);

        return card;
    }

    function journalMeta(entry) {
        const parts = [];

        if (entry.created_at) {
            parts.push(
                readableDate(entry.created_at)
            );
        }

        if (entry.framework) {
            parts.push(entry.framework);
        }

        if (entry.mood) {
            parts.push(entry.mood);
        }

        return parts.join(' · ');
    }

    function journalActions(parent, entry) {
        if (
            typeof discipleship.openEditJournalModal === 'function'
        ) {
            button(
                parent,
                'Edit',
                () => discipleship.openEditJournalModal(entry.id)
            );
        }

        if (
            typeof discipleship.deleteJournal === 'function'
        ) {
            button(
                parent,
                'Delete',
                () => discipleship.deleteJournal(entry.id),
                'btn btn-outline btn-sm journal-delete-action'
            );
        }
    }

    function journalListRow(entry) {
        const row =
            document.createElement('article');

        row.className =
            'feature-list-row feature-list-row--journal';

        const main =
            document.createElement('div');

        main.className =
            'feature-list-row__main';

        row.appendChild(main);

        textNode(
            main,
            'h3',
            entry.title || 'Journal entry',
            'feature-list-row__title'
        );

        textNode(
            main,
            'p',
            journalMeta(entry),
            'feature-list-row__meta'
        );

        const details = textNode(
            row,
            'p',
            entry.content || '',
            'feature-list-row__details'
        );

        details.hidden = true;

        const detailId =
            `journalListDetails-${entry.id}`;

        details.id = detailId;

        const actions =
            document.createElement('div');

        actions.className =
            'feature-list-row__actions';

        const view = button(
            actions,
            'Open',
            () => {
                details.hidden =
                    !details.hidden;

                view.textContent =
                    details.hidden
                        ? 'Open'
                        : 'Close';

                view.setAttribute(
                    'aria-expanded',
                    details.hidden
                        ? 'false'
                        : 'true'
                );
            }
        );

        view.setAttribute(
            'aria-expanded',
            'false'
        );

        view.setAttribute(
            'aria-controls',
            detailId
        );

        journalActions(
            actions,
            entry
        );

        row.appendChild(actions);

        return row;
    }

    function journalGridCard(entry) {
        const card =
            document.createElement('article');

        card.className =
            'feature-card feature-card--journal';

        textNode(
            card,
            'h3',
            entry.title || 'Journal entry',
            'feature-card__title'
        );

        textNode(
            card,
            'p',
            journalMeta(entry),
            'feature-card__meta'
        );

        const content =
            String(entry.content || '');

        const preview =
            content.length > 145
                ? `${content.slice(0, 145).trimEnd()}…`
                : content;

        textNode(
            card,
            'p',
            preview,
            'feature-card__preview'
        );

        const details = textNode(
            card,
            'p',
            content,
            'feature-card__details'
        );

        details.hidden = true;

        const detailId =
            `journalGridDetails-${entry.id}`;

        details.id = detailId;

        const actions =
            document.createElement('div');

        actions.className =
            'feature-card__actions';

        if (preview !== content) {
            const expand = button(
                actions,
                'Read More',
                () => {
                    details.hidden =
                        !details.hidden;

                    expand.textContent =
                        details.hidden
                            ? 'Read More'
                            : 'Show Less';

                    expand.setAttribute(
                        'aria-expanded',
                        details.hidden
                            ? 'false'
                            : 'true'
                    );
                }
            );

            expand.setAttribute(
                'aria-expanded',
                'false'
            );

            expand.setAttribute(
                'aria-controls',
                detailId
            );
        }

        journalActions(
            actions,
            entry
        );

        card.appendChild(actions);

        return card;
    }

    function calendarView(
        parent,
        kind,
        items,
        buildListItem,
        renderCurrent
    ) {
        const month =
            ensureMonth(kind, items);

        const selectedProperty =
            kind === 'prayer'
                ? 'prayerSelectedDate'
                : 'journalSelectedDate';

        const shell =
            document.createElement('section');

        shell.className =
            'feature-calendar-shell';

        const header =
            document.createElement('div');

        header.className =
            'feature-calendar-header';

        button(
            header,
            '‹',
            () => {
                shiftMonth(kind, -1);
                renderCurrent();
            },
            'feature-calendar-nav'
        );

        textNode(
            header,
            'strong',
            monthLabel(month),
            'feature-calendar-title'
        );

        button(
            header,
            '›',
            () => {
                shiftMonth(kind, 1);
                renderCurrent();
            },
            'feature-calendar-nav'
        );

        shell.appendChild(header);

        const scroll =
            document.createElement('div');

        scroll.className =
            'feature-calendar-scroll';

        const weekdayRow =
            document.createElement('div');

        weekdayRow.className =
            'feature-calendar-weekdays';

        for (
            const day of
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        ) {
            textNode(
                weekdayRow,
                'span',
                day
            );
        }

        scroll.appendChild(weekdayRow);

        const grid =
            document.createElement('div');

        grid.className =
            'feature-calendar-grid';

        const year =
            month.getFullYear();

        const monthIndex =
            month.getMonth();

        const firstDay =
            new Date(
                year,
                monthIndex,
                1
            ).getDay();

        const daysInMonth =
            new Date(
                year,
                monthIndex + 1,
                0
            ).getDate();

        const grouped =
            new Map();

        for (const item of items) {
            const key =
                dateKey(item.created_at);

            if (!key) continue;

            if (!grouped.has(key)) {
                grouped.set(key, []);
            }

            grouped.get(key).push(item);
        }

        for (
            let blank = 0;
            blank < firstDay;
            blank += 1
        ) {
            const spacer =
                document.createElement('div');

            spacer.className =
                'feature-calendar-day feature-calendar-day--empty';

            spacer.setAttribute(
                'aria-hidden',
                'true'
            );

            grid.appendChild(spacer);
        }

        for (
            let day = 1;
            day <= daysInMonth;
            day += 1
        ) {
            const key =
                [
                    year,
                    String(monthIndex + 1).padStart(2, '0'),
                    String(day).padStart(2, '0')
                ].join('-');

            const dayItems =
                grouped.get(key) || [];

            const cell =
                document.createElement('button');

            cell.type = 'button';

            cell.className =
                'feature-calendar-day';

            if (dayItems.length) {
                cell.classList.add(
                    'feature-calendar-day--has-items'
                );
            }

            if (
                viewState[selectedProperty] === key
            ) {
                cell.classList.add(
                    'feature-calendar-day--selected'
                );
            }

            cell.setAttribute(
                'aria-label',
                `${readableDate(key)}${
                    dayItems.length
                        ? `, ${dayItems.length} ${
                            kind === 'prayer'
                                ? 'prayer request'
                                : 'journal entry'
                          }${
                            dayItems.length === 1
                                ? ''
                                : 's'
                          }`
                        : ''
                }`
            );

            textNode(
                cell,
                'span',
                String(day),
                'feature-calendar-day__number'
            );

            if (dayItems.length) {
                const preview =
                    document.createElement('span');

                preview.className =
                    'feature-calendar-day__items';

                dayItems
                    .slice(0, 2)
                    .forEach(item => {
                        textNode(
                            preview,
                            'span',
                            item.title ||
                                (
                                    kind === 'prayer'
                                        ? 'Prayer request'
                                        : 'Journal entry'
                                ),
                            'feature-calendar-day__item'
                        );
                    });

                if (dayItems.length > 2) {
                    textNode(
                        preview,
                        'span',
                        `+${dayItems.length - 2} more`,
                        'feature-calendar-day__more'
                    );
                }

                cell.appendChild(preview);
            }

            cell.addEventListener(
                'click',
                () => {
                    viewState[selectedProperty] =
                        key;

                    renderCurrent();
                }
            );

            grid.appendChild(cell);
        }

        scroll.appendChild(grid);
        shell.appendChild(scroll);

        const selectedKey =
            viewState[selectedProperty];

        const selection =
            document.createElement('section');

        selection.className =
            'feature-calendar-selection';

        if (!selectedKey) {
            textNode(
                selection,
                'p',
                `Select a date to view ${
                    kind === 'prayer'
                        ? 'prayer requests'
                        : 'journal entries'
                }.`,
                'feature-state'
            );
        } else {
            const selectedItems =
                grouped.get(selectedKey) || [];

            textNode(
                selection,
                'h3',
                readableDate(selectedKey),
                'feature-calendar-selection__title'
            );

            if (!selectedItems.length) {
                textNode(
                    selection,
                    'p',
                    `No ${
                        kind === 'prayer'
                            ? 'prayer requests'
                            : 'journal entries'
                    } on this date.`,
                    'feature-state'
                );
            } else {
                const list =
                    document.createElement('div');

                list.className =
                    'feature-list-stack';

                selectedItems.forEach(item => {
                    list.appendChild(
                        buildListItem(item)
                    );
                });

                selection.appendChild(list);
            }
        }

        shell.appendChild(selection);
        parent.appendChild(shell);
    }

    function renderPrayerView() {
        const container =
            byId('prayerWallContainer');

        if (!container) return;

        const prayers =
            Array.isArray(discipleship.prayersData)
                ? discipleship.prayersData
                : [];

        container.replaceChildren();

        buildViewToolbar(
            container,
            'prayer',
            viewState.prayerView,
            mode => {
                viewState.prayerView = mode;
                viewState.prayerPage = 1;
                renderPrayerView();
            }
        );

        if (!prayers.length) {
            textNode(
                container,
                'div',
                'No prayer requests yet.',
                'feature-state'
            );
            return;
        }

        if (
            viewState.prayerView === 'calendar'
        ) {
            calendarView(
                container,
                'prayer',
                prayers,
                prayerListRow,
                renderPrayerView
            );

            return;
        }

        const pages =
            Math.ceil(
                prayers.length / PAGE_SIZE
            );

        viewState.prayerPage =
            Math.min(
                Math.max(
                    viewState.prayerPage,
                    1
                ),
                pages
            );

        const start =
            (
                viewState.prayerPage - 1
            ) * PAGE_SIZE;

        const visible =
            prayers.slice(
                start,
                start + PAGE_SIZE
            );

        const content =
            document.createElement('div');

        content.className =
            viewState.prayerView === 'grid'
                ? 'feature-view-grid'
                : 'feature-list-stack';

        visible.forEach(prayer => {
            content.appendChild(
                viewState.prayerView === 'grid'
                    ? prayerGridCard(prayer)
                    : prayerListRow(prayer)
            );
        });

        container.appendChild(content);

        pagination(
            container,
            viewState.prayerPage,
            pages,
            page => {
                viewState.prayerPage = page;
                renderPrayerView();
            }
        );
    }

    function renderJournalView() {
        const container =
            byId('journalsContainer');

        if (!container) return;

        const entries =
            Array.isArray(discipleship.journalsData)
                ? discipleship.journalsData
                : [];

        container.replaceChildren();

        buildViewToolbar(
            container,
            'journal',
            viewState.journalView,
            mode => {
                viewState.journalView = mode;
                viewState.journalPage = 1;
                renderJournalView();
            }
        );

        if (!entries.length) {
            textNode(
                container,
                'div',
                'No journal entries yet. Your reflections will appear here.',
                'feature-state'
            );
            return;
        }

        if (
            viewState.journalView === 'calendar'
        ) {
            calendarView(
                container,
                'journal',
                entries,
                journalListRow,
                renderJournalView
            );

            return;
        }

        const pages =
            Math.ceil(
                entries.length / PAGE_SIZE
            );

        viewState.journalPage =
            Math.min(
                Math.max(
                    viewState.journalPage,
                    1
                ),
                pages
            );

        const start =
            (
                viewState.journalPage - 1
            ) * PAGE_SIZE;

        const visible =
            entries.slice(
                start,
                start + PAGE_SIZE
            );

        const content =
            document.createElement('div');

        content.className =
            viewState.journalView === 'grid'
                ? 'feature-view-grid'
                : 'feature-list-stack';

        visible.forEach(entry => {
            content.appendChild(
                viewState.journalView === 'grid'
                    ? journalGridCard(entry)
                    : journalListRow(entry)
            );
        });

        container.appendChild(content);

        pagination(
            container,
            viewState.journalPage,
            pages,
            page => {
                viewState.journalPage = page;
                renderJournalView();
            }
        );
    }

    function containsFeatureState(node) {
        if (!node) return false;

        const classes =
            String(node.className || '')
                .split(/\s+/)
                .filter(Boolean);

        if (classes.includes('feature-state')) {
            return true;
        }

        const children =
            node.children
                ? Array.from(node.children)
                : [];

        return children.some(
            child => containsFeatureState(child)
        );
    }

    const previousPrayerLoad =
        discipleship.loadPrayers;

    if (
        typeof previousPrayerLoad === 'function'
    ) {
        discipleship.loadPrayers =
            async function loadPrayerWithViews(...args) {
                const result =
                    await previousPrayerLoad.apply(
                        this,
                        args
                    );

                const container =
                    byId('prayerWallContainer');

                if (
                    container &&
                    !containsFeatureState(container)
                ) {
                    renderPrayerView();
                }

                return result;
            };
    }

    const previousJournalLoad =
        discipleship.loadJournals;

    if (
        typeof previousJournalLoad === 'function'
    ) {
        discipleship.loadJournals =
            async function loadJournalWithViews(...args) {
                const result =
                    await previousJournalLoad.apply(
                        this,
                        args
                    );

                const container =
                    byId('journalsContainer');

                if (
                    container &&
                    !containsFeatureState(container)
                ) {
                    renderJournalView();
                }

                return result;
            };
    }

    root.setPrayerViewMode =
        function setPrayerViewMode(mode) {
            if (
                !['list', 'grid', 'calendar']
                    .includes(mode)
            ) {
                return;
            }

            viewState.prayerView = mode;
            viewState.prayerPage = 1;
            renderPrayerView();
        };

    root.setJournalViewMode =
        function setJournalViewMode(mode) {
            if (
                !['list', 'grid', 'calendar']
                    .includes(mode)
            ) {
                return;
            }

            viewState.journalView = mode;
            viewState.journalPage = 1;
            renderJournalView();
        };
})(typeof window !== 'undefined' ? window : globalThis);
