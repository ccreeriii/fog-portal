'use strict';

(function installCommunitySpotlightAdmin(root) {
    const state = {
        campaigns: [],
        editingId: null,
        selectedYouthIds: new Set(),
        searchTimer: null
    };

    const TEMPLATE_LABELS = {
        invitation: 'Invitation',
        event: 'Event',
        celebration: 'Celebration',
        important_notice: 'Important Notice',
        challenge: 'Challenge',
        simple_announcement: 'Simple Announcement'
    };

    const FREQUENCY_LABELS = {
        every_login: 'Every login',
        daily: 'Once per day',
        once: 'Once',
        until_action: 'Until primary action'
    };

    const ACTION_LABELS = {
        none: 'No primary action',
        internal_route: 'Portal route',
        external_url: 'External HTTPS link',
        prayer_covenant_join: 'Join Prayer Covenant'
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function create(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = String(text);
        return element;
    }

    function canRead() {
        return typeof root.hasPerm === 'function' &&
            root.hasPerm('access_communications');
    }

    function canMutate() {
        return canRead() &&
            typeof root.hasPerm === 'function' &&
            root.hasPerm('edit_entries');
    }

    function offlineReadonly() {
        return document.body &&
            document.body.classList.contains('koinonia-offline-readonly');
    }

    function setFeedback(message, error = false) {
        const element = byId('spotlightAdminFeedback');
        if (!element) return;

        element.textContent = message || '';
        element.classList.toggle('active', Boolean(message));
        element.classList.toggle('error', Boolean(message) && error);
    }

    async function request(url, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {})
        };

        const init = {
            ...options,
            headers,
            cache: 'no-store'
        };

        if (Object.prototype.hasOwnProperty.call(options, 'body')) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await root.fetch(url, init);

        let payload = null;

        try {
            payload = await response.json();
        } catch (_) {
            payload = null;
        }

        if (!response.ok) {
            const error = new Error(
                payload && typeof payload.error === 'string'
                    ? payload.error
                    : 'The request could not be completed.'
            );

            error.status = response.status;
            throw error;
        }

        return payload || {};
    }

    function readableError(error, fallback) {
        if (!error) return fallback;

        if (error.status === 401) {
            return 'Please sign in again before using Campaign Manager.';
        }

        if (error.status === 403) {
            return 'You do not have permission for this Campaign Manager action.';
        }

        if (error.status === 428) {
            return 'Please complete the current Terms and Privacy acceptance first.';
        }

        return error.message || fallback;
    }

    async function openStandalone() {
        if (!canRead()) {
            init();
            return;
        }

        init();

        if (typeof root.switchTab === 'function') {
            await root.switchTab('communitySpotlightAdminTab');
        }

        await loadCampaigns();
    }

    function switchSection(section) {
        /*
         * Backward-compatible adapter for older cached markup.
         * Campaign Manager is now its own top-level Portal tab and no longer
         * hides or modifies the Broadcast section.
         */
        if (section === 'campaigns') {
            void openStandalone();
            return;
        }

        if (section === 'broadcasts') {
            if (typeof root.switchTab === 'function') {
                root.switchTab('communicationsAdminTab');
            }

            if (
                root.V4Communications &&
                typeof root.V4Communications.loadHistory === 'function'
            ) {
                root.V4Communications.loadHistory();
            }
        }
    }

    function statusLabel(campaign) {
        if (Number(campaign.is_archived) === 1) return 'Archived';
        if (Number(campaign.is_paused) === 1) return 'Paused';
        if (Number(campaign.is_enabled) === 1) return 'Enabled';
        return 'Draft';
    }

    function badge(text, type) {
        return create(
            'span',
            `spotlight-badge${type ? ` ${type}` : ''}`,
            text
        );
    }

    function campaignAudience(campaign) {
        if (campaign.audience_type === 'selected_members') {
            try {
                const parsed = JSON.parse(campaign.audience_json || '{}');
                const ids = Array.isArray(parsed.youth_ids)
                    ? parsed.youth_ids
                    : [];

                return `${ids.length} selected member${ids.length === 1 ? '' : 's'}`;
            } catch (_) {
                return 'Selected members';
            }
        }

        if (campaign.audience_type === 'age_range') {
            try {
                const parsed = JSON.parse(campaign.audience_json || '{}');

                if (parsed.min_age != null && parsed.max_age != null) {
                    return `Ages ${parsed.min_age}–${parsed.max_age}`;
                }

                if (parsed.min_age != null) {
                    return `Age ${parsed.min_age}+`;
                }

                if (parsed.max_age != null) {
                    return `Age ${parsed.max_age} and below`;
                }
            } catch (_) {}

            return 'Age range';
        }

        return 'All members';
    }

    function renderCampaigns() {
        const container = byId('spotlightCampaignList');
        if (!container) return;

        container.replaceChildren();

        if (!state.campaigns.length) {
            const empty = create(
                'div',
                'spotlight-empty',
                'No Community Spotlight campaigns have been created yet.'
            );
            container.appendChild(empty);
            return;
        }

        for (const campaign of state.campaigns) {
            const card = create('article', 'spotlight-campaign-card');
            const head = create('div', 'spotlight-campaign-card__head');
            const titleBlock = create('div');
            const name = create(
                'h3',
                'spotlight-campaign-card__title',
                campaign.internal_name || campaign.title || 'Untitled campaign'
            );

            const meta = create(
                'p',
                'spotlight-campaign-card__meta',
                `${campaign.campaign_key} · Version ${campaign.version} · Priority ${campaign.priority}`
            );

            titleBlock.append(name, meta);

            const badges = create('div', 'spotlight-badges');
            const status = statusLabel(campaign);
            badges.appendChild(
                badge(
                    status,
                    status === 'Enabled'
                        ? 'enabled'
                        : status === 'Paused'
                            ? 'paused'
                            : status === 'Archived'
                                ? 'archived'
                                : ''
                )
            );

            badges.appendChild(
                badge(TEMPLATE_LABELS[campaign.template_type] || campaign.template_type)
            );

            badges.appendChild(
                badge(campaignAudience(campaign))
            );

            head.append(titleBlock, badges);
            card.appendChild(head);

            card.appendChild(
                create(
                    'p',
                    'spotlight-campaign-card__message',
                    campaign.title || ''
                )
            );

            const details = create(
                'p',
                'spotlight-campaign-card__meta',
                `${FREQUENCY_LABELS[campaign.display_frequency] || campaign.display_frequency} · ` +
                `${ACTION_LABELS[campaign.primary_action_type] || campaign.primary_action_type}`
            );

            card.appendChild(details);

            const actions = create('div', 'spotlight-campaign-actions');

            const analytics = create(
                'button',
                'btn btn-outline btn-sm',
                '📊 Analytics'
            );
            analytics.type = 'button';
            analytics.addEventListener(
                'click',
                () => openAnalytics(campaign.id)
            );
            actions.appendChild(analytics);

            if (canMutate() && !offlineReadonly()) {
                const edit = create(
                    'button',
                    'btn btn-outline btn-sm spotlight-mutation-control',
                    '✏️ Edit'
                );
                edit.type = 'button';
                edit.addEventListener(
                    'click',
                    () => openEditor(campaign.id)
                );

                const relaunch = create(
                    'button',
                    'btn btn-outline btn-sm spotlight-mutation-control',
                    '🔁 Relaunch'
                );
                relaunch.type = 'button';
                relaunch.addEventListener(
                    'click',
                    () => relaunchCampaign(campaign.id)
                );

                actions.append(edit, relaunch);
            }

            card.appendChild(actions);
            container.appendChild(card);
        }
    }

    async function loadCampaigns() {
        if (!canRead()) {
            setFeedback(
                'Communications permission is required to view Campaign Manager.',
                true
            );
            return;
        }

        setFeedback('Loading Campaign Manager…');

        try {
            const data = await request(
                '/api/admin/community-spotlight/campaigns'
            );

            state.campaigns = Array.isArray(data.campaigns)
                ? data.campaigns
                : [];

            renderCampaigns();
            setFeedback('');
        } catch (error) {
            state.campaigns = [];
            renderCampaigns();

            setFeedback(
                readableError(
                    error,
                    'Unable to load Community Spotlight campaigns.'
                ),
                true
            );
        }
    }

    function ensureEditorModal() {
        if (byId('spotlightCampaignModal')) return;

        const modal = create('div', 'modal spotlight-modal');
        modal.id = 'spotlightCampaignModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'spotlightCampaignModalTitle');

        modal.innerHTML = `
            <div class="modal-content">
                <div class="spotlight-modal__header">
                    <div>
                        <p class="spotlight-admin-kicker">Community Spotlight</p>
                        <h2 id="spotlightCampaignModalTitle">Campaign</h2>
                    </div>
                    <button type="button"
                        id="spotlightCampaignModalClose"
                        class="btn btn-outline btn-sm"
                        aria-label="Close Campaign Manager editor">Close</button>
                </div>

                <form id="spotlightCampaignForm">
                    <div class="spotlight-editor-grid">
                        <div class="form-group">
                            <label for="spotlightCampaignKey">Campaign Key *</label>
                            <input id="spotlightCampaignKey"
                                class="form-control"
                                maxlength="64"
                                pattern="[a-z0-9][a-z0-9_-]{1,63}"
                                required>
                            <p class="spotlight-field-note">Lowercase letters, numbers, hyphens, or underscores. Cannot change after creation.</p>
                        </div>

                        <div class="form-group">
                            <label for="spotlightCampaignVersion">Version</label>
                            <input id="spotlightCampaignVersion"
                                class="form-control"
                                value="1"
                                readonly>
                        </div>

                        <div class="form-group">
                            <label for="spotlightInternalName">Internal Name *</label>
                            <input id="spotlightInternalName"
                                class="form-control"
                                maxlength="160"
                                required>
                        </div>

                        <div class="form-group">
                            <label for="spotlightTemplateType">Template *</label>
                            <select id="spotlightTemplateType"
                                class="form-control"
                                required>
                                <option value="invitation">Invitation</option>
                                <option value="event">Event</option>
                                <option value="celebration">Celebration</option>
                                <option value="important_notice">Important Notice</option>
                                <option value="challenge">Challenge</option>
                                <option value="simple_announcement">Simple Announcement</option>
                            </select>
                        </div>

                        <div class="form-group full">
                            <label for="spotlightEyebrow">Eyebrow</label>
                            <input id="spotlightEyebrow"
                                class="form-control"
                                maxlength="100"
                                placeholder="Optional short category line">
                        </div>

                        <div class="form-group full">
                            <label for="spotlightTitle">Member-Facing Title *</label>
                            <input id="spotlightTitle"
                                class="form-control"
                                maxlength="200"
                                required>
                        </div>

                        <div class="form-group full">
                            <label for="spotlightMessage">Message *</label>
                            <textarea id="spotlightMessage"
                                class="form-control"
                                rows="6"
                                maxlength="6000"
                                required></textarea>
                        </div>

                        <div class="form-group full">
                            <label for="spotlightImageUrl">Image / Banner URL</label>
                            <input id="spotlightImageUrl"
                                class="form-control"
                                maxlength="2048"
                                placeholder="/img/example.jpg or https://…">
                            <p class="spotlight-field-note">Use an internal Portal path or HTTPS URL.</p>
                        </div>

                        <div class="form-group">
                            <label for="spotlightPrimaryLabel">Primary Button Label</label>
                            <input id="spotlightPrimaryLabel"
                                class="form-control"
                                maxlength="100">
                        </div>

                        <div class="form-group">
                            <label for="spotlightActionType">Primary Action</label>
                            <select id="spotlightActionType"
                                class="form-control">
                                <option value="none">No primary action</option>
                                <option value="internal_route">Portal route</option>
                                <option value="external_url">External HTTPS link</option>
                                <option value="prayer_covenant_join">Join Prayer Covenant</option>
                            </select>
                        </div>

                        <div class="form-group full"
                            id="spotlightActionValueGroup">
                            <label for="spotlightActionValue">Action Destination</label>
                            <input id="spotlightActionValue"
                                class="form-control"
                                maxlength="2048">
                            <p class="spotlight-field-note"
                                id="spotlightActionValueHelp"></p>
                        </div>

                        <div class="form-group full">
                            <label for="spotlightSecondaryLabel">Secondary Button Label</label>
                            <input id="spotlightSecondaryLabel"
                                class="form-control"
                                maxlength="100"
                                placeholder="Maybe later">
                        </div>

                        <div class="form-group">
                            <label for="spotlightAudienceType">Audience *</label>
                            <select id="spotlightAudienceType"
                                class="form-control">
                                <option value="all">All members</option>
                                <option value="selected_members">Selected members</option>
                                <option value="age_range">Age range</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="spotlightFrequency">Frequency *</label>
                            <select id="spotlightFrequency"
                                class="form-control">
                                <option value="once">Once</option>
                                <option value="daily">Once per day</option>
                                <option value="every_login">Every login</option>
                                <option value="until_action">Until primary action</option>
                            </select>
                        </div>

                        <div class="form-group full"
                            id="spotlightSelectedMembersGroup"
                            style="display:none;">
                            <label for="spotlightSelectedYouthIds">Selected Youth IDs *</label>
                            <input id="spotlightSelectedYouthIds"
                                class="form-control"
                                placeholder="Example: 12, 45, 78">
                            <p class="spotlight-field-note">You may enter IDs directly or use member search below.</p>

                            <input id="spotlightMemberSearch"
                                class="form-control"
                                style="margin-top:8px;"
                                placeholder="Search member name…"
                                autocomplete="off">

                            <div id="spotlightMemberSearchResults"
                                class="spotlight-member-search-results"
                                role="listbox"
                                aria-label="Member search results"></div>

                            <div id="spotlightSelectedSummary"
                                class="spotlight-selected-summary"></div>
                        </div>

                        <div class="form-group full"
                            id="spotlightAgeRangeGroup"
                            style="display:none;">
                            <div class="spotlight-inline-grid">
                                <div>
                                    <label for="spotlightMinAge">Minimum Age</label>
                                    <input id="spotlightMinAge"
                                        class="form-control"
                                        type="number"
                                        min="0"
                                        max="120">
                                </div>
                                <div>
                                    <label for="spotlightMaxAge">Maximum Age</label>
                                    <input id="spotlightMaxAge"
                                        class="form-control"
                                        type="number"
                                        min="0"
                                        max="120">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="spotlightPriority">Priority</label>
                            <input id="spotlightPriority"
                                class="form-control"
                                type="number"
                                min="-1000"
                                max="1000"
                                value="20">
                            <p class="spotlight-field-note">Higher priority eligible campaigns are shown first.</p>
                        </div>

                        <div class="form-group">
                            <label for="spotlightStartAt">Start — Manila Time</label>
                            <input id="spotlightStartAt"
                                class="form-control"
                                type="datetime-local">
                        </div>

                        <div class="form-group">
                            <label for="spotlightEndAt">End — Manila Time</label>
                            <input id="spotlightEndAt"
                                class="form-control"
                                type="datetime-local">
                        </div>

                        <div class="form-group full">
                            <div class="spotlight-checkbox-row">
                                <label>
                                    <input id="spotlightAllowDontShowAgain"
                                        type="checkbox"
                                        checked>
                                    Allow “Don’t show again”
                                </label>

                                <label>
                                    <input id="spotlightEnabled"
                                        type="checkbox">
                                    Enabled
                                </label>

                                <label>
                                    <input id="spotlightPaused"
                                        type="checkbox">
                                    Paused
                                </label>

                                <label>
                                    <input id="spotlightArchived"
                                        type="checkbox">
                                    Archived
                                </label>
                            </div>
                            <p class="spotlight-field-note">New campaigns default to Draft. Enable only when the campaign is ready to become member-eligible in Phase 3+.</p>
                        </div>

                        <div class="full">
                            <div id="spotlightCampaignPreview"
                                class="spotlight-preview"
                                aria-label="Campaign preview">
                                <img id="spotlightPreviewImage"
                                    class="spotlight-preview__image"
                                    alt="">
                                <div class="spotlight-preview__body">
                                    <p id="spotlightPreviewEyebrow"
                                        class="spotlight-preview__eyebrow"></p>
                                    <h3 id="spotlightPreviewTitle"
                                        class="spotlight-preview__title">Campaign Preview</h3>
                                    <p id="spotlightPreviewMessage"
                                        class="spotlight-preview__message"></p>
                                    <div class="spotlight-preview__actions">
                                        <button type="button"
                                            id="spotlightPreviewPrimary"
                                            class="btn btn-primary"
                                            disabled>Primary action</button>
                                        <button type="button"
                                            id="spotlightPreviewSecondary"
                                            class="btn btn-outline"
                                            disabled>Maybe later</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="spotlightEditorFeedback"
                        class="spotlight-admin-feedback"
                        role="status"
                        aria-live="polite"></div>

                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
                        <button type="button"
                            id="spotlightRefreshPreview"
                            class="btn btn-outline">👁️ Refresh Preview</button>
                        <button type="submit"
                            id="spotlightSaveCampaign"
                            class="btn btn-primary spotlight-mutation-control">Save Campaign</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        byId('spotlightCampaignModalClose').addEventListener(
            'click',
            closeEditor
        );

        byId('spotlightCampaignForm').addEventListener(
            'submit',
            saveCampaign
        );

        byId('spotlightRefreshPreview').addEventListener(
            'click',
            refreshPreview
        );

        byId('spotlightActionType').addEventListener(
            'change',
            syncActionFields
        );

        byId('spotlightAudienceType').addEventListener(
            'change',
            syncAudienceFields
        );

        byId('spotlightSelectedYouthIds').addEventListener(
            'input',
            syncSelectedIdsFromInput
        );

        byId('spotlightMemberSearch').addEventListener(
            'input',
            scheduleMemberSearch
        );

        for (const id of [
            'spotlightEyebrow',
            'spotlightTitle',
            'spotlightMessage',
            'spotlightImageUrl',
            'spotlightPrimaryLabel',
            'spotlightSecondaryLabel'
        ]) {
            byId(id).addEventListener('input', refreshPreview);
        }
    }

    function editorFeedback(message, error = false) {
        const element = byId('spotlightEditorFeedback');
        if (!element) return;

        element.textContent = message || '';
        element.classList.toggle('active', Boolean(message));
        element.classList.toggle('error', Boolean(message) && error);
    }

    function openModal(element) {
        element.style.display = 'flex';
        element.classList.add('active');
    }

    function closeModal(element) {
        element.classList.remove('active');
        element.style.display = 'none';
    }

    function closeEditor() {
        const modal = byId('spotlightCampaignModal');
        if (modal) closeModal(modal);
    }

    function parseAudienceJson(campaign) {
        try {
            const parsed = JSON.parse(
                campaign && campaign.audience_json
                    ? campaign.audience_json
                    : '{}'
            );

            return parsed && typeof parsed === 'object'
                ? parsed
                : {};
        } catch (_) {
            return {};
        }
    }

    function fromServerDate(value) {
        if (!value) return '';
        return String(value).replace(' ', 'T').slice(0, 16);
    }

    function toServerDate(value) {
        if (!value) return null;

        const normalized = String(value).trim();

        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
            throw new Error(
                'Campaign dates must use a valid Manila date and time.'
            );
        }

        return `${normalized.replace('T', ' ')}:00`;
    }

    function syncActionFields() {
        const type = byId('spotlightActionType').value;
        const group = byId('spotlightActionValueGroup');
        const input = byId('spotlightActionValue');
        const help = byId('spotlightActionValueHelp');

        const needsValue =
            type === 'internal_route' ||
            type === 'external_url';

        group.style.display = needsValue ? 'block' : 'none';
        input.required = needsValue;

        if (!needsValue) input.value = '';

        if (type === 'internal_route') {
            help.textContent =
                'Use a Portal path beginning with /, for example /events.';
        } else if (type === 'external_url') {
            help.textContent =
                'Use a full HTTPS link. Embedded credentials are not allowed.';
        } else if (type === 'prayer_covenant_join') {
            help.textContent =
                'Prayer Covenant execution remains deferred until the dedicated integration phase.';
        } else {
            help.textContent = '';
        }
    }

    function syncAudienceFields() {
        const type = byId('spotlightAudienceType').value;
        const selected = byId('spotlightSelectedMembersGroup');
        const age = byId('spotlightAgeRangeGroup');

        selected.style.display =
            type === 'selected_members'
                ? 'block'
                : 'none';

        age.style.display =
            type === 'age_range'
                ? 'block'
                : 'none';
    }

    function readSelectedIds() {
        const raw = byId('spotlightSelectedYouthIds').value || '';

        const values = raw
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        const ids = [];

        for (const value of values) {
            const number = Number(value);

            if (!Number.isSafeInteger(number) || number <= 0) {
                throw new Error(
                    'Selected member IDs must be positive whole numbers.'
                );
            }

            ids.push(number);
        }

        return [...new Set(ids)];
    }

    function updateSelectedSummary() {
        const summary = byId('spotlightSelectedSummary');

        if (!summary) return;

        const ids = [...state.selectedYouthIds];

        summary.textContent = ids.length
            ? `Selected Youth IDs: ${ids.join(', ')}`
            : 'No members selected yet.';
    }

    function syncSelectedIdsFromInput() {
        try {
            state.selectedYouthIds = new Set(readSelectedIds());
            updateSelectedSummary();
        } catch (_) {
            state.selectedYouthIds = new Set();
            updateSelectedSummary();
        }
    }

    function addSelectedYouthId(id) {
        const number = Number(id);

        if (!Number.isSafeInteger(number) || number <= 0) return;

        state.selectedYouthIds.add(number);

        byId('spotlightSelectedYouthIds').value =
            [...state.selectedYouthIds].join(', ');

        updateSelectedSummary();

        byId('spotlightMemberSearch').value = '';
        byId('spotlightMemberSearchResults').replaceChildren();
        byId('spotlightMemberSearchResults').classList.remove('active');
    }

    function scheduleMemberSearch() {
        clearTimeout(state.searchTimer);

        state.searchTimer = setTimeout(
            searchMembers,
            220
        );
    }

    async function searchMembers() {
        const query =
            byId('spotlightMemberSearch').value.trim();

        const container =
            byId('spotlightMemberSearchResults');

        container.replaceChildren();

        if (query.length < 2) {
            container.classList.remove('active');
            return;
        }

        try {
            const data = await request(
                '/api/admin/users/search?q=' +
                encodeURIComponent(query)
            );

            const members =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data.users)
                        ? data.users
                        : Array.isArray(data.results)
                            ? data.results
                            : [];

            if (!members.length) {
                container.appendChild(
                    create(
                        'div',
                        'spotlight-field-note',
                        'No matching members found.'
                    )
                );
                container.classList.add('active');
                return;
            }

            for (const member of members.slice(0, 20)) {
                const id = Number(
                    member.id ||
                    member.youth_id
                );

                if (!Number.isSafeInteger(id) || id <= 0) {
                    continue;
                }

                const button = create(
                    'button',
                    'spotlight-member-result'
                );

                button.type = 'button';
                button.setAttribute('role', 'option');

                const name = create(
                    'strong',
                    '',
                    member.name ||
                    member.full_name ||
                    `Member ${id}`
                );

                const code = create(
                    'span',
                    'spotlight-field-note',
                    `Youth ID ${id}`
                );

                button.append(name, code);

                button.addEventListener(
                    'click',
                    () => addSelectedYouthId(id)
                );

                container.appendChild(button);
            }

            container.classList.add('active');
        } catch (error) {
            container.appendChild(
                create(
                    'div',
                    'spotlight-field-note',
                    readableError(
                        error,
                        'Member search is unavailable. You can still enter Youth IDs directly.'
                    )
                )
            );

            container.classList.add('active');
        }
    }

    function safePreviewImageUrl(value) {
        const url = String(value || '').trim();

        if (!url) return '';

        if (url.startsWith('/') && !url.startsWith('//')) {
            return url;
        }

        try {
            const parsed = new URL(url);

            if (
                parsed.protocol === 'https:' &&
                !parsed.username &&
                !parsed.password
            ) {
                return parsed.toString();
            }
        } catch (_) {}

        return '';
    }

    function refreshPreview() {
        const eyebrow = byId('spotlightPreviewEyebrow');
        const title = byId('spotlightPreviewTitle');
        const message = byId('spotlightPreviewMessage');
        const primary = byId('spotlightPreviewPrimary');
        const secondary = byId('spotlightPreviewSecondary');
        const image = byId('spotlightPreviewImage');

        eyebrow.textContent =
            byId('spotlightEyebrow').value.trim();

        title.textContent =
            byId('spotlightTitle').value.trim() ||
            'Campaign Preview';

        message.textContent =
            byId('spotlightMessage').value.trim();

        const primaryText =
            byId('spotlightPrimaryLabel').value.trim();

        primary.textContent =
            primaryText || 'Primary action';

        primary.style.display =
            byId('spotlightActionType').value === 'none'
                ? 'none'
                : 'inline-flex';

        secondary.textContent =
            byId('spotlightSecondaryLabel').value.trim() ||
            'Maybe later';

        const imageUrl =
            safePreviewImageUrl(
                byId('spotlightImageUrl').value
            );

        if (imageUrl) {
            image.src = imageUrl;
            image.style.display = 'block';
        } else {
            image.removeAttribute('src');
            image.style.display = 'none';
        }
    }

    function populateEditor(campaign) {
        const editing = Boolean(campaign);
        const audience = parseAudienceJson(campaign);

        state.editingId =
            editing
                ? Number(campaign.id)
                : null;

        byId('spotlightCampaignModalTitle').textContent =
            editing
                ? `Edit Campaign — ${campaign.internal_name}`
                : 'Create Campaign';

        byId('spotlightCampaignKey').value =
            editing ? campaign.campaign_key : '';

        byId('spotlightCampaignKey').readOnly = editing;

        byId('spotlightCampaignVersion').value =
            editing ? campaign.version : 1;

        byId('spotlightInternalName').value =
            editing ? campaign.internal_name || '' : '';

        byId('spotlightTemplateType').value =
            editing
                ? campaign.template_type
                : 'invitation';

        byId('spotlightEyebrow').value =
            editing ? campaign.eyebrow || '' : '';

        byId('spotlightTitle').value =
            editing ? campaign.title || '' : '';

        byId('spotlightMessage').value =
            editing ? campaign.message || '' : '';

        byId('spotlightImageUrl').value =
            editing ? campaign.image_url || '' : '';

        byId('spotlightPrimaryLabel').value =
            editing ? campaign.primary_label || '' : '';

        byId('spotlightActionType').value =
            editing
                ? campaign.primary_action_type
                : 'none';

        byId('spotlightActionValue').value =
            editing
                ? campaign.primary_action_value || ''
                : '';

        byId('spotlightSecondaryLabel').value =
            editing
                ? campaign.secondary_label || ''
                : 'Maybe later';

        byId('spotlightAudienceType').value =
            editing
                ? campaign.audience_type
                : 'all';

        state.selectedYouthIds = new Set(
            editing &&
            campaign.audience_type === 'selected_members' &&
            Array.isArray(audience.youth_ids)
                ? audience.youth_ids.map(Number)
                : []
        );

        byId('spotlightSelectedYouthIds').value =
            [...state.selectedYouthIds].join(', ');

        byId('spotlightMinAge').value =
            editing &&
            campaign.audience_type === 'age_range' &&
            audience.min_age != null
                ? audience.min_age
                : '';

        byId('spotlightMaxAge').value =
            editing &&
            campaign.audience_type === 'age_range' &&
            audience.max_age != null
                ? audience.max_age
                : '';

        byId('spotlightPriority').value =
            editing ? campaign.priority : 20;

        byId('spotlightFrequency').value =
            editing
                ? campaign.display_frequency
                : 'once';

        byId('spotlightStartAt').value =
            editing
                ? fromServerDate(campaign.start_at)
                : '';

        byId('spotlightEndAt').value =
            editing
                ? fromServerDate(campaign.end_at)
                : '';

        byId('spotlightAllowDontShowAgain').checked =
            editing
                ? Number(campaign.allow_dont_show_again) === 1
                : true;

        byId('spotlightEnabled').checked =
            editing
                ? Number(campaign.is_enabled) === 1
                : false;

        byId('spotlightPaused').checked =
            editing
                ? Number(campaign.is_paused) === 1
                : false;

        byId('spotlightArchived').checked =
            editing
                ? Number(campaign.is_archived) === 1
                : false;

        byId('spotlightMemberSearch').value = '';
        byId('spotlightMemberSearchResults').replaceChildren();
        byId('spotlightMemberSearchResults').classList.remove('active');

        syncActionFields();
        syncAudienceFields();
        updateSelectedSummary();
        refreshPreview();
        editorFeedback('');
    }

    function openCreate() {
        if (!canMutate() || offlineReadonly()) {
            setFeedback(
                'Campaign creation requires Communications and Edit Entries permissions while online.',
                true
            );
            return;
        }

        ensureEditorModal();
        populateEditor(null);
        openModal(byId('spotlightCampaignModal'));
    }

    function openEditor(id) {
        if (!canMutate() || offlineReadonly()) {
            setFeedback(
                'Campaign editing requires Communications and Edit Entries permissions while online.',
                true
            );
            return;
        }

        const campaign =
            state.campaigns.find(
                item => Number(item.id) === Number(id)
            );

        if (!campaign) {
            setFeedback(
                'The selected campaign is no longer available.',
                true
            );
            return;
        }

        ensureEditorModal();
        populateEditor(campaign);
        openModal(byId('spotlightCampaignModal'));
    }

    function buildAudiencePayload() {
        const type = byId('spotlightAudienceType').value;

        if (type === 'all') {
            return {};
        }

        if (type === 'selected_members') {
            const ids = readSelectedIds();

            if (!ids.length) {
                throw new Error(
                    'Choose at least one selected member.'
                );
            }

            return {
                youth_ids: ids
            };
        }

        const minRaw = byId('spotlightMinAge').value;
        const maxRaw = byId('spotlightMaxAge').value;

        const minAge =
            minRaw === ''
                ? null
                : Number(minRaw);

        const maxAge =
            maxRaw === ''
                ? null
                : Number(maxRaw);

        if (minAge === null && maxAge === null) {
            throw new Error(
                'Enter a minimum age, maximum age, or both.'
            );
        }

        if (
            minAge !== null &&
            (!Number.isInteger(minAge) || minAge < 0 || minAge > 120)
        ) {
            throw new Error(
                'Minimum age must be a whole number from 0 to 120.'
            );
        }

        if (
            maxAge !== null &&
            (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 120)
        ) {
            throw new Error(
                'Maximum age must be a whole number from 0 to 120.'
            );
        }

        if (
            minAge !== null &&
            maxAge !== null &&
            minAge > maxAge
        ) {
            throw new Error(
                'Minimum age cannot be greater than maximum age.'
            );
        }

        return {
            min_age: minAge,
            max_age: maxAge
        };
    }

    function buildPayload() {
        const actionType =
            byId('spotlightActionType').value;

        let actionValue = null;

        if (
            actionType === 'internal_route' ||
            actionType === 'external_url'
        ) {
            actionValue =
                byId('spotlightActionValue').value.trim();

            if (!actionValue) {
                throw new Error(
                    'Enter the primary action destination.'
                );
            }
        }

        const priority =
            Number(byId('spotlightPriority').value);

        if (
            !Number.isSafeInteger(priority) ||
            priority < -1000 ||
            priority > 1000
        ) {
            throw new Error(
                'Priority must be a whole number from -1000 to 1000.'
            );
        }

        return {
            campaign_key:
                byId('spotlightCampaignKey').value.trim(),
            version:
                Number(byId('spotlightCampaignVersion').value),
            internal_name:
                byId('spotlightInternalName').value.trim(),
            template_type:
                byId('spotlightTemplateType').value,
            eyebrow:
                byId('spotlightEyebrow').value.trim() || null,
            title:
                byId('spotlightTitle').value.trim(),
            message:
                byId('spotlightMessage').value.trim(),
            image_url:
                byId('spotlightImageUrl').value.trim() || null,
            primary_label:
                byId('spotlightPrimaryLabel').value.trim() || null,
            primary_action_type:
                actionType,
            primary_action_value:
                actionValue,
            secondary_label:
                byId('spotlightSecondaryLabel').value.trim() || null,
            audience_type:
                byId('spotlightAudienceType').value,
            audience_json:
                buildAudiencePayload(),
            priority,
            display_frequency:
                byId('spotlightFrequency').value,
            allow_dont_show_again:
                byId('spotlightAllowDontShowAgain').checked,
            is_enabled:
                byId('spotlightEnabled').checked,
            is_paused:
                byId('spotlightPaused').checked,
            is_archived:
                byId('spotlightArchived').checked,
            start_at:
                toServerDate(
                    byId('spotlightStartAt').value
                ),
            end_at:
                toServerDate(
                    byId('spotlightEndAt').value
                )
        };
    }

    async function saveCampaign(event) {
        event.preventDefault();

        if (!canMutate() || offlineReadonly()) {
            editorFeedback(
                'Campaign changes require Communications and Edit Entries permissions while online.',
                true
            );
            return;
        }

        let payload;

        try {
            payload = buildPayload();
        } catch (error) {
            editorFeedback(error.message, true);
            return;
        }

        const button = byId('spotlightSaveCampaign');
        button.disabled = true;

        editorFeedback('Saving campaign…');

        try {
            const editing =
                Number.isSafeInteger(state.editingId) &&
                state.editingId > 0;

            const url =
                editing
                    ? `/api/admin/community-spotlight/campaigns/${state.editingId}`
                    : '/api/admin/community-spotlight/campaigns';

            const method =
                editing ? 'PUT' : 'POST';

            await request(
                url,
                {
                    method,
                    body: JSON.stringify(payload)
                }
            );

            closeEditor();

            setFeedback(
                editing
                    ? 'Campaign updated successfully.'
                    : 'Campaign created successfully.'
            );

            await loadCampaigns();
        } catch (error) {
            editorFeedback(
                readableError(
                    error,
                    'Unable to save the campaign.'
                ),
                true
            );
        } finally {
            button.disabled = false;
        }
    }

    async function relaunchCampaign(id) {
        if (!canMutate() || offlineReadonly()) {
            setFeedback(
                'Campaign relaunch requires Communications and Edit Entries permissions while online.',
                true
            );
            return;
        }

        const campaign =
            state.campaigns.find(
                item => Number(item.id) === Number(id)
            );

        if (!campaign) return;

        const confirmed = root.confirm(
            `Relaunch "${campaign.internal_name}" as a new version?\n\n` +
            'The existing version will be disabled. The new version starts as Draft so it can be reviewed before enabling.'
        );

        if (!confirmed) return;

        setFeedback('Creating the new campaign version…');

        try {
            const data = await request(
                `/api/admin/community-spotlight/campaigns/${id}/relaunch`,
                {
                    method: 'POST',
                    body: JSON.stringify({})
                }
            );

            setFeedback(
                data.campaign
                    ? `Version ${data.campaign.version} created as a new draft.`
                    : 'New campaign version created.'
            );

            await loadCampaigns();
        } catch (error) {
            setFeedback(
                readableError(
                    error,
                    'Unable to relaunch the campaign.'
                ),
                true
            );
        }
    }

    function ensureAnalyticsModal() {
        if (byId('spotlightAnalyticsModal')) return;

        const modal = create('div', 'modal spotlight-modal');
        modal.id = 'spotlightAnalyticsModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'spotlightAnalyticsTitle');

        modal.innerHTML = `
            <div class="modal-content" style="max-width:720px;">
                <div class="spotlight-modal__header">
                    <div>
                        <p class="spotlight-admin-kicker">Community Spotlight</p>
                        <h2 id="spotlightAnalyticsTitle">Campaign Analytics</h2>
                    </div>
                    <button type="button"
                        id="spotlightAnalyticsClose"
                        class="btn btn-outline btn-sm"
                        aria-label="Close campaign analytics">Close</button>
                </div>

                <div id="spotlightAnalyticsStatus"
                    class="spotlight-admin-feedback active"
                    role="status"
                    aria-live="polite">Loading analytics…</div>

                <div id="spotlightAnalyticsGrid"
                    class="spotlight-analytics-grid"></div>
            </div>
        `;

        document.body.appendChild(modal);

        byId('spotlightAnalyticsClose').addEventListener(
            'click',
            () => closeModal(modal)
        );
    }

    async function openAnalytics(id) {
        if (!canRead()) return;

        ensureAnalyticsModal();

        const modal = byId('spotlightAnalyticsModal');
        const status = byId('spotlightAnalyticsStatus');
        const grid = byId('spotlightAnalyticsGrid');

        grid.replaceChildren();
        status.textContent = 'Loading analytics…';
        status.classList.add('active');
        status.classList.remove('error');

        openModal(modal);

        try {
            const data = await request(
                `/api/admin/community-spotlight/campaigns/${id}/analytics`
            );

            const analytics = data.analytics || {};

            const metrics = [
                ['Eligible members', analytics.eligible_members],
                ['Members shown', analytics.shown_members],
                ['Total views', analytics.total_views],
                ['Clicked', analytics.clicked_members],
                ['Permanently dismissed', analytics.dismissed_members],
                ['Completed', analytics.completed_members]
            ];

            for (const [label, value] of metrics) {
                const card = create('div', 'spotlight-stat');
                const number = create(
                    'strong',
                    '',
                    Number(value || 0)
                );
                const caption = create('span', '', label);
                card.append(number, caption);
                grid.appendChild(card);
            }

            status.textContent =
                `Campaign ${analytics.campaign_key || ''} · Version ${analytics.version || ''}`;

            status.classList.add('active');
        } catch (error) {
            status.textContent = readableError(
                error,
                'Unable to load campaign analytics.'
            );
            status.classList.add('error');
        }
    }

    function ensureStandaloneNavButton() {
        const sidebar = byId('sidebarNav');
        const existing =
            byId('navCommunitySpotlightCampaignManager');

        if (!sidebar) return;

        if (!canRead()) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const button = document.createElement('button');
        button.id = 'navCommunitySpotlightCampaignManager';
        button.type = 'button';
        button.className = 'nav-btn';
        button.dataset.target = 'communitySpotlightAdminTab';
        button.textContent = '✨ Campaign Manager';

        button.addEventListener('click', () => {
            void openStandalone();
        });

        const broadcastButton =
            sidebar.querySelector(
                '[data-target="communicationsAdminTab"]'
            );

        if (broadcastButton) {
            broadcastButton.insertAdjacentElement(
                'afterend',
                button
            );
            return;
        }

        const logoutButton =
            Array.from(
                sidebar.querySelectorAll('.nav-btn')
            ).find((candidate) =>
                String(candidate.textContent || '')
                    .includes('Logout')
            );

        if (logoutButton) {
            sidebar.insertBefore(button, logoutButton);
        } else {
            sidebar.appendChild(button);
        }
    }

    function installBuildNavLifecycle() {
        const previousBuildNav = root.buildNav;

        if (
            typeof previousBuildNav !== 'function' ||
            previousBuildNav.communitySpotlightStandaloneWrapped
        ) {
            return;
        }

        const wrapped = function (...args) {
            const result =
                previousBuildNav.apply(this, args);

            ensureStandaloneNavButton();

            return result;
        };

        wrapped.communitySpotlightStandaloneWrapped = true;
        root.buildNav = wrapped;
    }

    function init() {
        const section =
            byId('communitySpotlightAdminSection');

        const newButton =
            byId('spotlightNewCampaignBtn');

        const campaignTab =
            byId('btnCommunicationsCampaigns');

        if (!section) return;

        /*
         * Authentication is established asynchronously by app.js.
         * This initializer can therefore run before hasPerm() is ready.
         *
         * Unauthorized state may hide the Campaign Manager tab, but an
         * authorized re-run MUST also restore it. This keeps the UI in
         * sync with the canonical authenticated permission state.
         */
        if (!canRead()) {
            section.style.display = 'none';

            if (campaignTab) {
                campaignTab.style.display = 'none';
            }

            ensureStandaloneNavButton();
            return;
        }

        section.style.display = 'block';
        ensureStandaloneNavButton();

        if (campaignTab) {
            campaignTab.style.display = '';
        }

        if (newButton) {
            newButton.style.display =
                canMutate() && !offlineReadonly()
                    ? 'inline-flex'
                    : 'none';

            /*
             * init() intentionally may run more than once:
             *   - DOMContentLoaded
             *   - after authReady settles
             *   - when Communications is opened
             *
             * Bind the mutation control only once.
             */
            if (
                newButton.dataset.spotlightCreateBound
                !== '1'
            ) {
                newButton.addEventListener(
                    'click',
                    openCreate
                );

                newButton.dataset.spotlightCreateBound =
                    '1';
            }
        }
    }

    function initAfterAuthReady() {
        /*
         * Preserve the immediate initialization behavior, then reconcile
         * visibility again once the asynchronous auth bootstrap settles.
         */
        init();

        if (
            root.authReady &&
            typeof root.authReady.then === 'function'
        ) {
            Promise.resolve(root.authReady)
                .then(() => init())
                .catch(() => {});
        }
    }

    function installPermissionLifecycle() {
        const previousApplyPermissions =
            root.applyGranularPermissions;

        if (
            typeof previousApplyPermissions !== 'function' ||
            previousApplyPermissions.communitySpotlightWrapped
        ) {
            return;
        }

        const wrapped = function (...args) {
            const result =
                previousApplyPermissions.apply(this, args);

            /*
             * applyGranularPermissions() is the Portal's canonical
             * post-authentication UI reconciliation point. Keep Campaign
             * Manager visibility and mutation controls synchronized there
             * instead of depending on incidental navigation timing.
             */
            init();

            return result;
        };

        wrapped.communitySpotlightWrapped = true;
        root.applyGranularPermissions = wrapped;
    }

    function handleCommunicationsNavigation(event) {
        /*
         * Login can happen after the page's initial authReady promise has
         * already settled unauthenticated. The Communications navigation
         * click is therefore another safe reconciliation point.
         *
         * Navigation buttons are generated in several Portal generations;
         * support both data-target and inline switchTab forms.
         */
        const element =
            event &&
            event.target &&
            typeof event.target.closest === 'function'
                ? event.target.closest(
                    '[data-target="communicationsAdminTab"], ' +
                    '[onclick*="communicationsAdminTab"]'
                )
                : null;

        if (!element) return;

        Promise.resolve()
            .then(() => init())
            .catch(() => {});
    }

    root.CommunitySpotlightAdmin = {
        init,
        openStandalone,
        switchSection,
        loadCampaigns,
        openCreate,
        openEditor,
        openAnalytics,
        relaunchCampaign,
        _state: state
    };

    installPermissionLifecycle();
    installBuildNavLifecycle();

    document.addEventListener(
        'DOMContentLoaded',
        initAfterAuthReady
    );

    document.addEventListener(
        'click',
        handleCommunicationsNavigation
    );
})(window);
