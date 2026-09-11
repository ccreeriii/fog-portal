'use strict';

(() => {
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
