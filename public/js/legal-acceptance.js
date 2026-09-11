'use strict';

(() => {
    let legalGateRequired = false;

    function getElements() {
        return {
            modal: document.getElementById('googleLegalSetupModal'),
            form: document.getElementById('googleLegalSetupForm'),
            checkbox: document.getElementById('googleLegalAccepted'),
            status: document.getElementById('googleLegalSetupStatus'),
            submit: document.getElementById('googleLegalSetupSubmit'),
            cancel: document.getElementById('googleLegalSetupCancel')
        };
    }

    function getGateElements() {
        return {
            modal: document.getElementById('existingUserLegalGate'),
            form: document.getElementById('existingUserLegalGateForm'),
            checkbox: document.getElementById('existingUserLegalAccepted'),
            status: document.getElementById('existingUserLegalGateStatus'),
            submit: document.getElementById('existingUserLegalGateSubmit'),
            logout: document.getElementById('existingUserLegalGateLogout')
        };
    }

    function hideExistingUserLegalGate() {
        const { modal, checkbox, status } = getGateElements();
        legalGateRequired = false;
        if (modal) {
            modal.classList.remove('active');
            modal.hidden = true;
        }
        if (checkbox) checkbox.checked = false;
        if (status) status.textContent = '';
        if (document.body) document.body.classList.remove('modal-open');
    }

    window.showExistingUserLegalGate = function() {
        const { modal, checkbox, status, submit } = getGateElements();
        legalGateRequired = true;
        window.koinoniaAuthStatus = 'legal-required';
        window.koinoniaReadOnlyLock = true;
        if (!modal || !checkbox) return;
        modal.hidden = false;
        modal.classList.add('active');
        if (document.body) document.body.classList.add('modal-open');
        checkbox.checked = false;
        if (submit) submit.disabled = true;
        if (status) status.textContent = '';
        const preloader = document.getElementById('globalPreloader');
        if (preloader) preloader.style.display = 'none';
        checkbox.focus();
    };

    window.isExistingUserLegalGateRequired = function() {
        return legalGateRequired;
    };

    window.refreshLegalProfileStatus = async function() {
        const container = document.getElementById('myLegalPrivacyStatus');
        if (!container || window.koinoniaAuthStatus !== 'authenticated') return;
        try {
            const response = await fetch('/api/legal/status', {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const status = await response.json();
            if (!response.ok || status.success !== true) throw new Error('Legal status unavailable');
            const acceptedAt = status.terms.accepted_at
                ? new Date(status.terms.accepted_at).toLocaleString()
                : 'Not yet accepted';
            container.textContent = '';
            const terms = document.createElement('div');
            const privacy = document.createElement('div');
            terms.style.marginBottom = '10px';
            terms.textContent = `Terms of Service — Current version: ${status.terms.current_version}; Accepted: ${acceptedAt}; Status: ${status.terms.status}`;
            privacy.textContent = `Privacy Policy — Current version: ${status.privacy.current_version}; Acknowledged: ${acceptedAt}; Status: ${status.privacy.status}`;
            container.append(terms, privacy);
        } catch (error) {
            container.textContent = 'Legal status is temporarily unavailable.';
        }
    };

    if (!window.koinoniaLegalFetchPatched) {
        const legalAwareFetch = window.fetch.bind(window);
        window.fetch = async function(resource, options) {
            const response = await legalAwareFetch(resource, options);
            if (response.status === 428) {
                try {
                    const payload = await response.clone().json();
                    if (payload && payload.legal_acceptance_required === true) {
                        window.showExistingUserLegalGate();
                    }
                } catch (error) {}
            }
            return response;
        };
        window.koinoniaLegalFetchPatched = true;
    }

    function closeGoogleLegalSetup() {
        const { modal, checkbox, status } = getElements();
        if (!modal) return;
        modal.classList.remove('active');
        modal.hidden = true;
        if (checkbox) checkbox.checked = false;
        if (status) status.textContent = '';
    }

    window.openGoogleLegalSetup = function() {
        const { modal, checkbox, status } = getElements();
        if (!modal || !checkbox) return;
        modal.hidden = false;
        modal.classList.add('active');
        status.textContent = '';
        checkbox.checked = false;
        checkbox.focus();
    };

    document.addEventListener('DOMContentLoaded', () => {
        const gate = getGateElements();
        if (gate.form && gate.checkbox && gate.status && gate.submit && gate.logout) {
            gate.checkbox.checked = false;
            gate.submit.disabled = true;
            gate.modal.addEventListener('click', event => {
                if (event.target !== gate.modal || !legalGateRequired) return;
                event.preventDefault();
                event.stopPropagation();
                gate.checkbox.focus();
            });
            gate.checkbox.addEventListener('change', () => {
                gate.submit.disabled = !gate.checkbox.checked;
                if (gate.checkbox.checked) gate.status.textContent = '';
            });
            gate.checkbox.addEventListener('invalid', () => {
                gate.status.textContent = 'You must agree to the Terms of Service and acknowledge the Privacy Policy to continue.';
            });
            gate.logout.addEventListener('click', async () => {
                if (typeof window.logout === 'function') await window.logout();
                hideExistingUserLegalGate();
            });
            gate.form.addEventListener('submit', async event => {
                event.preventDefault();
                if (!gate.checkbox.checked) {
                    gate.status.textContent = 'You must agree to the Terms of Service and acknowledge the Privacy Policy to continue.';
                    gate.checkbox.focus();
                    return;
                }
                gate.submit.disabled = true;
                gate.status.textContent = 'Recording your acceptance…';
                try {
                    const response = await fetch('/api/legal/accept', {
                        method: 'POST',
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                        body: JSON.stringify({ legal_accepted: true })
                    });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok || payload.success !== true || payload.current !== true) {
                        const message = payload && typeof payload.error === 'string' && payload.error.trim()
                            ? payload.error.trim()
                            : "We couldn't record your acceptance right now. Please try again.";
                        const serverError = new Error(message);
                        serverError.name = 'LegalAcceptanceServerError';
                        throw serverError;
                    }
                    hideExistingUserLegalGate();
                    window.location.reload();
                } catch (error) {
                    const networkFailure = !navigator.onLine ||
                        (error && (error.name === 'TypeError' || error.name === 'AbortError'));

                    gate.status.textContent = networkFailure
                        ? 'Unable to reach the Community Portal. Please check your connection and try again.'
                        : error && error.message
                            ? error.message
                            : "We couldn't record your acceptance right now. Please try again.";

                    gate.submit.disabled = !gate.checkbox.checked;
                }
            });
        }

        const { form, checkbox, status, submit, cancel } = getElements();
        if (!form || !checkbox || !status || !submit || !cancel) return;

        checkbox.addEventListener('invalid', () => {
            status.textContent = 'You must agree to the Terms of Service and acknowledge the Privacy Policy to create an account.';
        });
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) status.textContent = '';
        });
        cancel.addEventListener('click', closeGoogleLegalSetup);

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!checkbox.checked) {
                status.textContent = 'You must agree to the Terms of Service and acknowledge the Privacy Policy to create an account.';
                checkbox.focus();
                return;
            }

            submit.disabled = true;
            status.textContent = 'Creating your account…';
            try {
                const response = await fetch('/api/auth/google/complete-signup', {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ legal_accepted: true })
                });
                const payload = await response.json();
                if (!response.ok || !payload || payload.success !== true) {
                    throw new Error(payload && payload.error
                        ? payload.error
                        : 'Unable to complete account setup. Please continue with Google again.');
                }
                closeGoogleLegalSetup();
                if (typeof window.finishGooglePortalLogin === 'function') {
                    await window.finishGooglePortalLogin(payload);
                }
            } catch (error) {
                status.textContent = error && error.message
                    ? error.message
                    : 'Unable to complete account setup. Please continue with Google again.';
            } finally {
                submit.disabled = false;
            }
        });
    });
})();
