'use strict';

(function installCommunitySpotlightMember(root) {
    const state = {
        activeCampaign: null,
        lookupInFlight: null,
        lookupComplete: false,
        sessionIdentity: null,
        sessionShownKeys: new Set(),
        mutationBusy: false,
        completionAcknowledged: false,
        prayerCovenantStep: 1,
        installed: false
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function currentMemberId() {
        const member =
            root.currentMember &&
            typeof root.currentMember === 'object'
                ? root.currentMember
                : null;

        const id =
            member && member.id != null
                ? Number(member.id)
                : NaN;

        return Number.isSafeInteger(id) && id > 0
            ? id
            : null;
    }

    function currentSessionIdentity() {
        const memberId = currentMemberId();

        if (!memberId) return null;

        const username =
            typeof root.currentUser === 'string'
                ? root.currentUser
                : '';

        return `${memberId}:${username}`;
    }

    function isOnlineAuthenticatedMember() {
        if (root.navigator && root.navigator.onLine === false) {
            return false;
        }

        if (root.koinoniaAuthStatus !== 'authenticated') {
            return false;
        }

        if (root.koinoniaReadOnlyLock === true) {
            return false;
        }

        if (
            document.body &&
            document.body.classList.contains(
                'koinonia-offline-readonly'
            )
        ) {
            return false;
        }

        return Boolean(currentMemberId());
    }

    function resetSession() {
        state.activeCampaign = null;
        state.lookupInFlight = null;
        state.lookupComplete = false;
        state.sessionIdentity = null;
        state.sessionShownKeys = new Set();
        state.mutationBusy = false;
        state.completionAcknowledged = false;

        closeVisual();
    }

    function campaignSessionKey(campaign) {
        if (!campaign) return null;

        const id = Number(campaign.id);
        const version = Number(campaign.version);

        if (
            !Number.isSafeInteger(id) ||
            id <= 0 ||
            !Number.isSafeInteger(version) ||
            version <= 0
        ) {
            return null;
        }

        return `${id}:${version}`;
    }

    async function request(url, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {})
        };

        const init = {
            ...options,
            headers,
            credentials: 'same-origin',
            cache: 'no-store'
        };

        if (Object.prototype.hasOwnProperty.call(options, 'body')) {
            headers['Content-Type'] = 'application/json';
        }

        const response =
            await root.fetch(url, init);

        let payload = {};

        try {
            payload =
                await response.clone().json();
        } catch (_) {
            payload = {};
        }

        if (!response.ok) {
            const error = new Error(
                payload &&
                typeof payload.error === 'string' &&
                payload.error.trim()
                    ? payload.error.trim()
                    : 'Community Spotlight is temporarily unavailable.'
            );

            error.status = response.status;
            error.payload = payload;

            throw error;
        }

        return payload;
    }

    function ensureModal() {
        if (byId('communitySpotlightMemberModal')) {
            return;
        }

        const overlay =
            document.createElement('div');

        overlay.id =
            'communitySpotlightMemberModal';

        overlay.className =
            'community-spotlight-member-overlay';

        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute(
            'aria-labelledby',
            'communitySpotlightMemberTitle'
        );

        overlay.innerHTML = `
            <section
                class="community-spotlight-member-card"
                tabindex="-1">
                <div
                    id="communitySpotlightMemberImageWrap"
                    class="community-spotlight-member-image-wrap">
                    <img
                        id="communitySpotlightMemberImage"
                        class="community-spotlight-member-image"
                        alt="">
                </div>

                <div class="community-spotlight-member-body">
                    <div class="community-spotlight-member-topline">
                        <div>
                            <p
                                id="communitySpotlightMemberEyebrow"
                                class="community-spotlight-member-eyebrow"></p>

                            <h2
                                id="communitySpotlightMemberTitle"
                                class="community-spotlight-member-title"></h2>
                        </div>

                        <button
                            id="communitySpotlightMemberClose"
                            class="community-spotlight-member-close"
                            type="button"
                            aria-label="Close Community Spotlight">×</button>
                    </div>

                    <div
                        id="communitySpotlightMemberMessage"
                        class="community-spotlight-member-message"></div>

                    <div
                        id="communitySpotlightMemberStatus"
                        class="community-spotlight-member-status"
                        role="status"
                        aria-live="polite"></div>

                    <div class="community-spotlight-member-actions">
                        <button
                            id="communitySpotlightMemberPrimary"
                            class="btn btn-primary community-spotlight-member-primary"
                            type="button"></button>

                        <button
                            id="communitySpotlightMemberSecondary"
                            class="btn btn-outline community-spotlight-member-secondary"
                            type="button"></button>
                    </div>

                    <div
                        id="communitySpotlightMemberDsa"
                        class="community-spotlight-member-dsa">
                        <label>
                            <input
                                id="communitySpotlightMemberDsaCheckbox"
                                type="checkbox">
                            <span
                                id="communitySpotlightMemberDsaText">Don’t show this announcement again.</span>
                        </label>
                    </div>
                </div>
            </section>
        `;

        document.body.appendChild(overlay);

        byId(
            'communitySpotlightMemberClose'
        ).addEventListener(
            'click',
            () => dismissActiveCampaign()
        );

        byId(
            'communitySpotlightMemberSecondary'
        ).addEventListener(
            'click',
            handleSecondaryAction
        );

        byId(
            'communitySpotlightMemberPrimary'
        ).addEventListener(
            'click',
            handlePrimaryAction
        );

        overlay.addEventListener(
            'click',
            event => {
                if (event.target !== overlay) {
                    return;
                }

                const card =
                    overlay.querySelector(
                        '.community-spotlight-member-card'
                    );

                if (card) {
                    card.focus();
                }
            }
        );

        document.addEventListener(
            'keydown',
            event => {
                if (
                    event.key !== 'Escape' ||
                    !state.activeCampaign ||
                    state.mutationBusy
                ) {
                    return;
                }

                dismissActiveCampaign();
            }
        );
    }

    function safeImageUrl(value) {
        const raw =
            typeof value === 'string'
                ? value.trim()
                : '';

        if (!raw) return '';

        if (
            raw.startsWith('/') &&
            !raw.startsWith('//')
        ) {
            return raw;
        }

        try {
            const parsed =
                new URL(raw);

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

    function safeInternalRoute(value) {
        const raw =
            typeof value === 'string'
                ? value.trim()
                : '';

        if (
            !raw ||
            !raw.startsWith('/') ||
            raw.startsWith('//')
        ) {
            return null;
        }

        return raw;
    }

    function safeExternalUrl(value) {
        const raw =
            typeof value === 'string'
                ? value.trim()
                : '';

        if (!raw) return null;

        try {
            const parsed =
                new URL(raw);

            if (
                parsed.protocol === 'https:' &&
                !parsed.username &&
                !parsed.password
            ) {
                return parsed.toString();
            }
        } catch (_) {}

        return null;
    }

    function setStatus(message, error = false) {
        const element =
            byId('communitySpotlightMemberStatus');

        if (!element) return;

        element.textContent = message || '';
        element.classList.toggle(
            'active',
            Boolean(message)
        );
        element.classList.toggle(
            'error',
            Boolean(message) && error
        );
    }

    function setBusy(busy) {
        state.mutationBusy =
            Boolean(busy);

        for (const id of [
            'communitySpotlightMemberPrimary',
            'communitySpotlightMemberSecondary',
            'communitySpotlightMemberClose',
            'communitySpotlightMemberDsaCheckbox'
        ]) {
            const element = byId(id);

            if (element) {
                element.disabled =
                    state.mutationBusy;
            }
        }
    }

    function isPrayerCovenantCampaign(
        campaign = state.activeCampaign
    ) {
        return Boolean(
            campaign &&
            campaign.primary_action_type ===
                'prayer_covenant_join'
        );
    }

    function clearPrayerGuideContent(container) {
        if (!container) return;

        while (container.firstChild) {
            container.removeChild(
                container.firstChild
            );
        }
    }

    function appendPrayerGuideText(
        container,
        text,
        className =
            'community-spotlight-prayer-paragraph'
    ) {
        const paragraph =
            document.createElement('p');

        paragraph.className =
            className;

        paragraph.textContent =
            text;

        container.appendChild(
            paragraph
        );

        return paragraph;
    }

    function appendPrayerGuideStrongLine(
        container,
        text
    ) {
        return appendPrayerGuideText(
            container,
            text,
            'community-spotlight-prayer-highlight'
        );
    }

    function appendPrayerGuideSteps(
        container,
        items
    ) {
        const list =
            document.createElement('ol');

        list.className =
            'community-spotlight-prayer-how-list';

        for (const item of items) {
            const entry =
                document.createElement('li');

            const heading =
                document.createElement('strong');

            const detail =
                document.createElement('span');

            heading.textContent =
                item.title;

            detail.textContent =
                item.detail;

            entry.appendChild(
                heading
            );

            entry.appendChild(
                detail
            );

            list.appendChild(
                entry
            );
        }

        container.appendChild(
            list
        );
    }

    function appendPrayerGuideCommitments(
        container,
        items
    ) {
        const list =
            document.createElement('ul');

        list.className =
            'community-spotlight-prayer-commitments';

        for (const text of items) {
            const item =
                document.createElement('li');

            item.textContent =
                text;

            list.appendChild(
                item
            );
        }

        container.appendChild(
            list
        );
    }

    function appendPrayerGuideProgress(
        container,
        currentStep
    ) {
        const progress =
            document.createElement('div');

        progress.className =
            'community-spotlight-prayer-progress';

        progress.setAttribute(
            'aria-label',
            `Prayer Covenant introduction, step ${currentStep} of 3`
        );

        for (
            let step = 1;
            step <= 3;
            step += 1
        ) {
            const dot =
                document.createElement('span');

            dot.className =
                'community-spotlight-prayer-progress-dot';

            dot.classList.toggle(
                'active',
                step <= currentStep
            );

            dot.setAttribute(
                'aria-hidden',
                'true'
            );

            progress.appendChild(
                dot
            );
        }

        container.appendChild(
            progress
        );
    }

    function renderPrayerCovenantStep(
        campaign,
        requestedStep
    ) {
        if (
            !isPrayerCovenantCampaign(
                campaign
            )
        ) {
            return;
        }

        const step =
            Math.max(
                1,
                Math.min(
                    3,
                    Number(
                        requestedStep
                    ) || 1
                )
            );

        state.prayerCovenantStep =
            step;

        const card =
            document.querySelector(
                '.community-spotlight-member-card'
            );

        const eyebrow =
            byId(
                'communitySpotlightMemberEyebrow'
            );

        const title =
            byId(
                'communitySpotlightMemberTitle'
            );

        const message =
            byId(
                'communitySpotlightMemberMessage'
            );

        const primary =
            byId(
                'communitySpotlightMemberPrimary'
            );

        const secondary =
            byId(
                'communitySpotlightMemberSecondary'
            );

        const dsa =
            byId(
                'communitySpotlightMemberDsa'
            );

        const dsaCheckbox =
            byId(
                'communitySpotlightMemberDsaCheckbox'
            );

        const dsaText =
            byId(
                'communitySpotlightMemberDsaText'
            );

        if (
            !eyebrow ||
            !title ||
            !message ||
            !primary ||
            !secondary
        ) {
            return;
        }

        if (card) {
            card.classList.add(
                'community-spotlight-prayer-guide-card'
            );
        }

        message.classList.add(
            'community-spotlight-prayer-guide'
        );

        clearPrayerGuideContent(
            message
        );

        appendPrayerGuideProgress(
            message,
            step
        );

        primary.style.display = '';
        secondary.style.display = '';

        if (step === 1) {
            eyebrow.textContent =
                '21-DAY DAILY PRAYER COVENANT';

            title.textContent =
                'What if everyone in our community was prayed for every day?';

            appendPrayerGuideStrongLine(
                message,
                'Imagine knowing that every day, someone in our FOG family is intentionally lifting you to God in prayer.'
            );

            appendPrayerGuideText(
                message,
                'Every day, each of us carries hopes, decisions, responsibilities, relationships, and dreams into the day. Prayer gives us a beautiful way to accompany one another—even when we may not know every detail.'
            );

            appendPrayerGuideText(
                message,
                'When we participate together, each person in the Prayer Covenant can be intentionally prayed for. Your prayer may be the encouragement and grace someone needs for the day ahead.'
            );

            appendPrayerGuideText(
                message,
                'And while you pray for someone else, prayer also grows in you. Even 1–3 intentional minutes each day can begin a consistent prayer rhythm and help deepen your relationship with God.'
            );

            appendPrayerGuideStrongLine(
                message,
                'One prayer. One person. Every day. Together as one family.'
            );

            primary.textContent =
                '🙏 Join the 21-Day Prayer Covenant';

            secondary.textContent =
                campaign.secondary_label ||
                'Maybe later';

            if (dsa) {
                dsa.classList.toggle(
                    'active',
                    campaign.allow_dont_show_again ===
                        true
                );
            }

            if (dsaText) {
                dsaText.textContent =
                    'Don’t show this Prayer Covenant invitation again.';
            }

            return;
        }

        if (dsa) {
            dsa.classList.remove(
                'active'
            );
        }

        if (step === 2) {
            eyebrow.textContent =
                'STEP 2 OF 3 · HOW IT WORKS';

            title.textContent =
                'A simple way to pray for one another every day';

            appendPrayerGuideSteps(
                message,
                [
                    {
                        title:
                            '1. Receive your Prayer Pal',
                        detail:
                            'Each day, the Portal gives you one participating member to intentionally pray for. Prayer Pals rotate day by day and, whenever the active group allows, you will receive someone different from your previous assignment.'
                    },
                    {
                        title:
                            '2. Choose a prayer',
                        detail:
                            'You will have 10 prayer starters to help you begin. You may use one exactly as it is, personalize it, add your own words, or write your own prayer from the heart.'
                    },
                    {
                        title:
                            '3. Review and send',
                        detail:
                            'Before anything is sent, you will review your prayer and confirm it. Nothing is sent simply because you selected a prayer starter.'
                    },
                    {
                        title:
                            '4. Your Prayer Pal receives it',
                        detail:
                            'Your prayer is delivered through the Community Portal so your Prayer Pal can receive and read the prayer offered for them.'
                    },
                    {
                        title:
                            '5. Gratitude and praise can come back to you',
                        detail:
                            'The person who receives your prayer can respond with Thank You or share a Praise Report, and you will receive that acknowledgement through the Portal.'
                    }
                ]
            );

            appendPrayerGuideStrongLine(
                message,
                'A few faithful minutes can bless another person while helping prayer become a natural part of your own daily life.'
            );

            primary.textContent =
                'Continue';

            secondary.textContent =
                'Back';

            return;
        }

        eyebrow.textContent =
            'STEP 3 OF 3 · MY COVENANT';

        title.textContent =
            'Ready to pray with our community?';

        appendPrayerGuideText(
            message,
            'For the next 21 days, I choose to make a little space each day to pray for someone in our community.'
        );

        appendPrayerGuideCommitments(
            message,
            [
                'I will receive a Prayer Pal to intentionally pray for.',
                'I can use one of the 10 prayer starters, personalize it, or pray in my own words.',
                'I will review my prayer before I confirm and send it.',
                'My prayer will be shared with the person I am praying for.',
                'I understand that this journey is about prayer, relationship with God, and caring for one another—not competition or scoring.'
            ]
        );

        appendPrayerGuideStrongLine(
            message,
            'Together, let us build a community where people are prayed for, encouraged, and accompanied every day.'
        );

        appendPrayerGuideText(
            message,
            'Your enrollment begins only when you choose the button below.',
            'community-spotlight-prayer-consent-note'
        );

        primary.textContent =
            '🙏 Start My 21-Day Prayer Covenant';

        secondary.textContent =
            'Back';

        if (dsaCheckbox) {
            /*
             * Do not silently convert a checkbox selected on page 1
             * into permanent dismissal from later pages.
             */
            dsaCheckbox.checked = false;
        }
    }

    function handleSecondaryAction() {
        const campaign =
            state.activeCampaign;

        if (
            !campaign ||
            state.mutationBusy
        ) {
            return;
        }

        if (
            state.completionAcknowledged
        ) {
            dismissActiveCampaign();
            return;
        }

        if (
            isPrayerCovenantCampaign(
                campaign
            ) &&
            state.prayerCovenantStep > 1
        ) {
            renderPrayerCovenantStep(
                campaign,
                state.prayerCovenantStep - 1
            );

            setStatus('');

            const card =
                document.querySelector(
                    '.community-spotlight-member-card'
                );

            if (card) {
                card.focus();
            }

            return;
        }

        dismissActiveCampaign();
    }

    function renderCampaign(campaign) {
        ensureModal();

        state.activeCampaign =
            campaign;

        state.completionAcknowledged =
            false;

        state.prayerCovenantStep =
            1;

        const overlay =
            byId(
                'communitySpotlightMemberModal'
            );

        const card =
            document.querySelector(
                '.community-spotlight-member-card'
            );

        const eyebrow =
            byId(
                'communitySpotlightMemberEyebrow'
            );

        const title =
            byId(
                'communitySpotlightMemberTitle'
            );

        const message =
            byId(
                'communitySpotlightMemberMessage'
            );

        const imageWrap =
            byId(
                'communitySpotlightMemberImageWrap'
            );

        const image =
            byId(
                'communitySpotlightMemberImage'
            );

        const primary =
            byId(
                'communitySpotlightMemberPrimary'
            );

        const secondary =
            byId(
                'communitySpotlightMemberSecondary'
            );

        const dsa =
            byId(
                'communitySpotlightMemberDsa'
            );

        const dsaCheckbox =
            byId(
                'communitySpotlightMemberDsaCheckbox'
            );

        const dsaText =
            byId(
                'communitySpotlightMemberDsaText'
            );

        eyebrow.textContent =
            campaign.eyebrow || '';

        title.textContent =
            campaign.title ||
            'Community Spotlight';

        message.classList.remove(
            'community-spotlight-prayer-guide'
        );

        message.textContent =
            campaign.message || '';

        if (card) {
            card.classList.remove(
                'community-spotlight-prayer-guide-card'
            );
        }

        const imageUrl =
            safeImageUrl(
                campaign.image_url
            );

        if (imageUrl) {
            image.src =
                imageUrl;

            image.alt = '';

            imageWrap.classList.add(
                'active'
            );
        } else {
            image.removeAttribute(
                'src'
            );

            image.alt = '';

            imageWrap.classList.remove(
                'active'
            );
        }

        if (dsaCheckbox) {
            dsaCheckbox.checked =
                false;
        }

        const actionType =
            campaign.primary_action_type ||
            'none';

        if (
            actionType ===
            'prayer_covenant_join'
        ) {
            renderPrayerCovenantStep(
                campaign,
                1
            );
        } else {
            if (actionType === 'none') {
                primary.style.display =
                    'none';

                primary.textContent =
                    '';
            } else {
                primary.style.display =
                    '';

                primary.textContent =
                    campaign.primary_label ||
                    'Continue';
            }

            secondary.style.display =
                '';

            secondary.textContent =
                campaign.secondary_label ||
                'Maybe later';

            if (dsa) {
                dsa.classList.toggle(
                    'active',
                    campaign.allow_dont_show_again ===
                        true
                );
            }

            if (dsaText) {
                dsaText.textContent =
                    'Don’t show this announcement again.';
            }
        }

        setStatus('');
        setBusy(false);

        if (overlay) {
            overlay.hidden = false;

            overlay.classList.add(
                'active'
            );
        }

        if (document.body) {
            document.body.classList.add(
                'community-spotlight-member-open'
            );
        }

        if (card) {
            card.focus();
        }
    }

    function closeVisual() {
        const overlay =
            byId('communitySpotlightMemberModal');

        if (overlay) {
            overlay.classList.remove('active');
            overlay.hidden = true;
        }

        if (document.body) {
            document.body.classList.remove(
                'community-spotlight-member-open'
            );
        }

        state.activeCampaign = null;
        state.mutationBusy = false;
        state.completionAcknowledged = false;
        state.prayerCovenantStep = 1;
    }

    function handleBoundaryError(error) {
        if (!error) return false;

        if (error.status === 401) {
            closeVisual();

            if (
                typeof root.handleAuthenticatedApi401 ===
                'function'
            ) {
                root.handleAuthenticatedApi401();
            }

            return true;
        }

        if (
            error.status === 428 ||
            (
                error.payload &&
                error.payload.legal_acceptance_required === true
            )
        ) {
            closeVisual();
            return true;
        }

        return false;
    }

    async function recordImpression(campaign) {
        return request(
            `/api/community-spotlight/${campaign.id}/impression`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        );
    }

    async function lookupNextCampaign() {
        if (!isOnlineAuthenticatedMember()) {
            return null;
        }

        if (state.lookupComplete) {
            return null;
        }

        if (state.lookupInFlight) {
            return state.lookupInFlight;
        }

        const attempt =
            (async () => {
                try {
                    const data =
                        await request(
                            '/api/community-spotlight/next'
                        );

                    const campaign =
                        data &&
                        data.campaign &&
                        typeof data.campaign === 'object'
                            ? data.campaign
                            : null;

                    if (!campaign) {
                        state.lookupComplete = true;
                        return null;
                    }

                    const key =
                        campaignSessionKey(campaign);

                    if (!key) {
                        state.lookupComplete = true;
                        return null;
                    }

                    if (
                        state.sessionShownKeys.has(key)
                    ) {
                        state.lookupComplete = true;
                        return null;
                    }

                    /*
                     * Server-side impression recording must
                     * succeed before anything becomes visible.
                     */
                    await recordImpression(campaign);

                    state.sessionShownKeys.add(key);
                    state.lookupComplete = true;

                    renderCampaign(campaign);

                    return campaign;
                } catch (error) {
                    handleBoundaryError(error);
                    return null;
                } finally {
                    state.lookupInFlight = null;
                }
            })();

        state.lookupInFlight =
            attempt;

        return attempt;
    }

    function beginAuthenticatedSession() {
        if (!isOnlineAuthenticatedMember()) {
            return;
        }

        const identity =
            currentSessionIdentity();

        if (!identity) return;

        if (state.sessionIdentity !== identity) {
            state.activeCampaign = null;
            state.lookupInFlight = null;
            state.lookupComplete = false;
            state.sessionIdentity = identity;
            state.sessionShownKeys = new Set();
            state.mutationBusy = false;
            closeVisual();
        }

        if (
            state.lookupComplete ||
            state.lookupInFlight
        ) {
            return;
        }

        root.setTimeout(
            () => {
                if (
                    state.sessionIdentity === identity &&
                    isOnlineAuthenticatedMember()
                ) {
                    lookupNextCampaign();
                }
            },
            300
        );
    }

    async function dismissActiveCampaign() {
        const campaign =
            state.activeCampaign;

        if (
            !campaign ||
            state.mutationBusy
        ) {
            return;
        }

        /*
         * Successful fulfillment is already durable through the
         * Spotlight completion endpoint. Closing that success state
         * is therefore a local UI action only.
         */
        if (state.completionAcknowledged) {
            closeVisual();
            return;
        }

        if (!isOnlineAuthenticatedMember()) {
            setStatus(
                'An internet connection is required to update this announcement.',
                true
            );
            return;
        }

        const dsa =
            byId(
                'communitySpotlightMemberDsaCheckbox'
            );

        const permanent =
            campaign.allow_dont_show_again === true &&
            (
                !isPrayerCovenantCampaign(
                    campaign
                ) ||
                state.prayerCovenantStep === 1
            ) &&
            Boolean(dsa && dsa.checked);

        setBusy(true);
        setStatus(
            permanent
                ? 'Saving your preference…'
                : 'Closing…'
        );

        try {
            await request(
                `/api/community-spotlight/${campaign.id}/dismiss`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        dont_show_again:
                            permanent
                    })
                }
            );

            closeVisual();
        } catch (error) {
            if (handleBoundaryError(error)) {
                return;
            }

            setStatus(
                error && error.message
                    ? error.message
                    : 'The announcement could not be closed right now.',
                true
            );

            setBusy(false);
        }
    }

    function navigateRecordedAction(action) {
        if (!action || action.executed !== false) {
            return false;
        }

        if (action.type === 'internal_route') {
            const route =
                safeInternalRoute(action.value);

            if (!route) {
                return false;
            }

            root.location.assign(route);
            return true;
        }

        if (action.type === 'external_url') {
            const url =
                safeExternalUrl(action.value);

            if (!url) {
                return false;
            }

            root.location.assign(url);
            return true;
        }

        return false;
    }

    async function recordSpotlightAction(campaign) {
        return request(
            `/api/community-spotlight/${campaign.id}/action`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        );
    }

    async function completeSpotlightCampaign(campaign) {
        return request(
            `/api/community-spotlight/${campaign.id}/complete`,
            {
                method: 'POST',
                body: JSON.stringify({})
            }
        );
    }

    function prayerCovenantSuccessMessage(joinResult) {
        const onboarding =
            joinResult &&
            joinResult.onboarding &&
            typeof joinResult.onboarding === 'object'
                ? joinResult.onboarding
                : null;

        const enrollment =
            onboarding &&
            onboarding.enrollment &&
            typeof onboarding.enrollment === 'object'
                ? onboarding.enrollment
                : null;

        const status =
            enrollment &&
            typeof enrollment.status === 'string'
                ? enrollment.status.toLowerCase()
                : '';

        if (status === 'completed') {
            return (
                'You’ve already completed the 21-Day Prayer Covenant 🙏 ' +
                'Thank you for your faithful journey of prayer.'
            );
        }

        if (
            joinResult &&
            joinResult.joined === true
        ) {
            return (
                'Welcome to the Covenant 🙏 Your 21-Day Daily Prayer Covenant ' +
                'has begun. Take it one day at a time as you build a faithful ' +
                'habit of prayer and grow closer to God.'
            );
        }

        if (status === 'active') {
            return (
                'You’re already part of the Covenant 🙏 Continue your ' +
                '21-Day Daily Prayer Covenant one day at a time.'
            );
        }

        return (
            'Your 21-Day Prayer Covenant is already part of your Growth Journey 🙏.'
        );
    }

    function showPrayerCovenantSuccess(
        joinResult,
        {
            trackingComplete = true
        } = {}
    ) {
        state.completionAcknowledged = true;
        state.mutationBusy = false;

        const primary =
            byId(
                'communitySpotlightMemberPrimary'
            );

        const secondary =
            byId(
                'communitySpotlightMemberSecondary'
            );

        const close =
            byId(
                'communitySpotlightMemberClose'
            );

        const dsa =
            byId(
                'communitySpotlightMemberDsa'
            );

        if (primary) {
            primary.style.display = 'none';
            primary.disabled = false;
        }

        if (secondary) {
            secondary.textContent = 'Close';
            secondary.disabled = false;
        }

        if (close) {
            close.disabled = false;
        }

        if (dsa) {
            dsa.classList.remove(
                'active'
            );
        }

        let message =
            prayerCovenantSuccessMessage(
                joinResult
            );

        if (!trackingComplete) {
            message += (
                ' Your Prayer Covenant is active. You can continue from ' +
                'your Growth Journey.'
            );
        }

        setStatus(message);
    }

    async function joinPrayerCovenantFromSpotlight(
        campaign
    ) {
        /*
         * Explicit opt-in occurs only after the member presses
         * the CTA. This reuses the existing canonical endpoint.
         */
        const joinResult =
            await request(
                '/api/growth-journey/prayer-covenant/join',
                {
                    method: 'POST',
                    body: JSON.stringify({})
                }
            );

        const enrollment =
            joinResult &&
            joinResult.onboarding &&
            joinResult.onboarding.enrollment &&
            typeof joinResult.onboarding.enrollment ===
                'object'
                ? joinResult.onboarding.enrollment
                : null;

        if (!enrollment) {
            throw new Error(
                'The Prayer Covenant enrollment could not be confirmed.'
            );
        }

        let trackingComplete = false;

        try {
            /*
             * Canonical enrollment succeeds first.
             * Only afterward do we record campaign analytics.
             */
            await recordSpotlightAction(
                campaign
            );

            await completeSpotlightCampaign(
                campaign
            );

            trackingComplete = true;
        } catch (trackingError) {
            if (
                handleBoundaryError(
                    trackingError
                )
            ) {
                return;
            }

            /*
             * Enrollment is already durable. Do not retry it
             * merely because Spotlight analytics failed.
             */
            console.warn(
                '[Community Spotlight] Prayer Covenant campaign tracking incomplete'
            );
        }

        showPrayerCovenantSuccess(
            joinResult,
            {
                trackingComplete
            }
        );
    }

    async function handlePrimaryAction() {
        const campaign =
            state.activeCampaign;

        if (
            !campaign ||
            state.mutationBusy ||
            campaign.primary_action_type ===
                'none'
        ) {
            return;
        }

        if (
            !isOnlineAuthenticatedMember()
        ) {
            setStatus(
                'An internet connection is required to continue.',
                true
            );

            return;
        }

        if (
            campaign.primary_action_type ===
            'prayer_covenant_join'
        ) {
            if (
                state.prayerCovenantStep < 3
            ) {
                renderPrayerCovenantStep(
                    campaign,
                    state.prayerCovenantStep + 1
                );

                setStatus('');

                const card =
                    document.querySelector(
                        '.community-spotlight-member-card'
                    );

                if (card) {
                    card.focus();
                }

                return;
            }

            /*
             * Pages 1 and 2 are explanatory only.
             * Enrollment is intentionally possible only after the
             * member reaches page 3 and presses the final covenant
             * confirmation button.
             */
            setBusy(true);

            setStatus(
                'Starting your 21-Day Prayer Covenant…'
            );

            try {
                await joinPrayerCovenantFromSpotlight(
                    campaign
                );
            } catch (error) {
                if (
                    handleBoundaryError(
                        error
                    )
                ) {
                    return;
                }

                setStatus(
                    error &&
                    error.message
                        ? error.message
                        : 'The Prayer Covenant could not be started right now.',
                    true
                );

                setBusy(false);
            }

            return;
        }

        setBusy(true);

        setStatus(
            'Recording your response…'
        );

        try {
            const data =
                await recordSpotlightAction(
                    campaign
                );

            const action =
                data &&
                data.action
                    ? data.action
                    : null;

            closeVisual();

            if (
                action &&
                navigateRecordedAction(
                    action
                )
            ) {
                return;
            }
        } catch (error) {
            if (
                handleBoundaryError(
                    error
                )
            ) {
                return;
            }

            setStatus(
                error &&
                error.message
                    ? error.message
                    : 'Your response could not be recorded right now.',
                true
            );

            setBusy(false);
        }
    }

    function installAuthHooks() {
        if (state.installed) return;
        state.installed = true;

        if (
            typeof root.refreshAuthenticatedIdentity ===
            'function'
        ) {
            const originalRefresh =
                root.refreshAuthenticatedIdentity;

            root.refreshAuthenticatedIdentity =
                function spotlightAwareIdentityRefresh(
                    ...args
                ) {
                    const result =
                        originalRefresh.apply(
                            this,
                            args
                        );

                    Promise.resolve(result)
                        .then(value => {
                            if (
                                value &&
                                value.authenticated === true
                            ) {
                                beginAuthenticatedSession();
                            }
                        })
                        .catch(() => undefined);

                    return result;
                };
        }

        if (
            typeof root.clearAuthenticatedClientState ===
            'function'
        ) {
            const originalClear =
                root.clearAuthenticatedClientState;

            root.clearAuthenticatedClientState =
                function spotlightAwareIdentityClear(
                    ...args
                ) {
                    resetSession();

                    return originalClear.apply(
                        this,
                        args
                    );
                };
        }

        root.addEventListener(
            'online',
            () => {
                if (
                    root.koinoniaAuthStatus ===
                    'authenticated'
                ) {
                    beginAuthenticatedSession();
                }
            }
        );

        root.addEventListener(
            'offline',
            () => {
                closeVisual();
            }
        );

        Promise.resolve(root.authReady)
            .then(result => {
                if (
                    (
                        result &&
                        result.authenticated === true
                    ) ||
                    root.koinoniaAuthStatus ===
                        'authenticated'
                ) {
                    beginAuthenticatedSession();
                }
            })
            .catch(() => undefined);
    }

    root.CommunitySpotlightMember = {
        init: installAuthHooks,
        beginAuthenticatedSession,
        lookupNextCampaign,
        dismissActiveCampaign,
        handlePrimaryAction,
        resetSession,
        _state: state,
        _test: {
            safeImageUrl,
            safeInternalRoute,
            safeExternalUrl,
            campaignSessionKey,
            isOnlineAuthenticatedMember
        }
    };

    document.addEventListener(
        'DOMContentLoaded',
        installAuthHooks
    );
})(window);
