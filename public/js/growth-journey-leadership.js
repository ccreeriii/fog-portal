(function growthJourneyLeadershipModule(root) {
    'use strict';

    const REQUIRED_PERMISSION = 'edit_entries';

    function hasLeadershipPermission() {
        return Boolean(
            root.hasPerm &&
            root.hasPerm(REQUIRED_PERMISSION)
        );
    }

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function statusLabel(status) {
        return String(status || 'not_started')
            .replaceAll('_', ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function showMessage(container, message, isError = false) {
        container.replaceChildren();
        const messageElement = createElement('p', null, message);
        messageElement.style.color = isError ? 'var(--danger)' : 'var(--text-muted)';
        messageElement.setAttribute('role', 'status');
        container.append(messageElement);
    }

    function buildReviewModel(member, journey) {
        const currentPhase = journey && journey.currentPhase
            ? journey.currentPhase
            : null;
        const nextTitle = journey && journey.nextPhase
            ? journey.nextPhase.title
            : null;
        const canAdvance = Boolean(currentPhase && currentPhase.status === 'ready');

        return {
            member,
            phases: journey && Array.isArray(journey.phases) ? journey.phases : [],
            currentPhase,
            canAdvance,
            actionLabel: canAdvance
                ? (nextTitle ? `Advance to ${nextTitle}` : `Complete ${currentPhase.title}`)
                : null
        };
    }

    async function advanceCurrentPhase(container, member, journey) {
        const currentPhase = journey && journey.currentPhase;
        if (!currentPhase || currentPhase.status !== 'ready') return;

        const nextTitle = journey.nextPhase && journey.nextPhase.title;
        const actionLabel = nextTitle
            ? `Advance to ${nextTitle}`
            : `Complete ${currentPhase.title}`;
        const memberName = member && member.name ? member.name : 'this member';

        if (!root.confirm(`${actionLabel} for ${memberName}?`)) return;

        showMessage(container, 'Saving leadership advancement…');

        try {
            const response = await root.fetch(
                `/api/admin/growth-journey/members/${encodeURIComponent(member.id)}` +
                `/phases/${encodeURIComponent(currentPhase.phaseKey)}/complete`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{}'
                }
            );
            const body = await response.json();
            if (!response.ok || !body.success) {
                throw new Error(body.error || 'The phase could not be advanced.');
            }

            renderJourneyReview(container, body.member, body.journey);
        } catch (error) {
            showMessage(
                container,
                error && error.message
                    ? error.message
                    : 'The phase could not be advanced.',
                true
            );
        }
    }

    function renderJourneyReview(container, member, journey) {
        container.replaceChildren();
        const model = buildReviewModel(member, journey);

        const heading = createElement('h3', null, 'Growth Journey Review');
        heading.style.margin = '0 0 12px';
        heading.style.color = 'var(--primary)';
        container.append(heading);

        const phases = createElement('ol', 'growth-leadership-phases');
        phases.style.paddingLeft = '22px';
        phases.style.margin = '0 0 16px';
        for (const phase of model.phases) {
            const item = createElement(
                'li',
                null,
                `${phase.title}: ${statusLabel(phase.sequenceState)}`
            );
            item.dataset.phaseKey = phase.phaseKey;
            item.dataset.sequenceState = phase.sequenceState;
            if (phase.sequenceState === 'current') item.style.fontWeight = '800';
            phases.append(item);
        }
        container.append(phases);

        const currentPhase = model.currentPhase;
        if (!currentPhase) {
            container.append(createElement('p', null, 'No active Growth Journey phase.'));
            return;
        }

        const summary = createElement('div', 'growth-leadership-current');
        summary.style.padding = '14px';
        summary.style.border = '1px solid var(--border-color)';
        summary.style.borderRadius = '10px';
        summary.style.background = 'var(--bg-light)';

        summary.append(createElement('strong', null, `Current: ${currentPhase.title}`));
        summary.append(createElement('p', null, `Status: ${statusLabel(currentPhase.status)}`));
        summary.append(createElement(
            'p',
            null,
            `Essentials: ${currentPhase.essentialCompleted} of ${currentPhase.essentialTotal}`
        ));

        if (model.canAdvance) {
            const ready = createElement('p', 'growth-leadership-ready', 'Ready for advancement');
            ready.style.color = 'var(--success)';
            ready.style.fontWeight = '800';
            summary.append(ready);

            const button = createElement(
                'button',
                'btn btn-primary btn-sm',
                model.actionLabel
            );
            button.type = 'button';
            button.addEventListener('click', () => {
                void advanceCurrentPhase(container, member, journey);
            });
            summary.append(button);
        }

        container.append(summary);
    }

    async function mountLeadershipJourneyReview(youthId) {
        if (!hasLeadershipPermission()) return;

        const normalizedYouthId = Number(youthId);
        if (!Number.isSafeInteger(normalizedYouthId) || normalizedYouthId <= 0) return;

        const modalContent = document.querySelector('#viewProfileModal .modal-content');
        if (!modalContent) return;

        const existing = document.getElementById('growthLeadershipJourneyReview');
        if (existing) existing.remove();

        const container = createElement('section', 'card');
        container.id = 'growthLeadershipJourneyReview';
        container.dataset.youthId = String(normalizedYouthId);
        container.style.margin = '0 20px 20px';
        container.style.padding = '18px';
        modalContent.append(container);
        showMessage(container, 'Loading Growth Journey…');

        try {
            const response = await root.fetch(
                `/api/admin/growth-journey/members/${encodeURIComponent(normalizedYouthId)}`,
                {
                    credentials: 'same-origin',
                    cache: 'no-store'
                }
            );
            const body = await response.json();
            if (!response.ok || !body.success) {
                throw new Error(body.error || 'The member Growth Journey could not be loaded.');
            }
            if (!container.isConnected || container.dataset.youthId !== String(normalizedYouthId)) {
                return;
            }
            renderJourneyReview(container, body.member, body.journey);
        } catch (error) {
            if (!container.isConnected) return;
            showMessage(
                container,
                error && error.message
                    ? error.message
                    : 'The member Growth Journey could not be loaded.',
                true
            );
        }
    }

    const existingOpenViewProfileModal = root.openViewProfileModal;
    if (typeof existingOpenViewProfileModal === 'function') {
        root.openViewProfileModal = async function openLeadershipMemberProfile(youthId) {
            const result = await existingOpenViewProfileModal.apply(this, arguments);
            await mountLeadershipJourneyReview(youthId);
            return result;
        };
    }

    const publicApi = Object.freeze({
        hasLeadershipPermission,
        buildReviewModel,
        renderJourneyReview,
        mountLeadershipJourneyReview
    });
    root.GrowthJourneyLeadership = publicApi;
    if (typeof module === 'object' && module.exports) module.exports = publicApi;
})(typeof window === 'object' ? window : globalThis);
