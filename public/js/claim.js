'use strict';

(() => {
    const claimTokenMatch = /^#([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    let claimToken = claimTokenMatch ? claimTokenMatch[1] : null;
    window.history.replaceState(null, '', '/claim');

    const GOOGLE_CLIENT_ID = '100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com';

    document.addEventListener('DOMContentLoaded', async () => {
        const status = document.getElementById('claimStatus');
        const actions = document.getElementById('claimActions');
        const success = document.getElementById('claimSuccess');
        const loginHelp = document.getElementById('claimLoginHelp');
        const signInIdentity = document.getElementById('claimSignInIdentity');
        const loginIdentifierElement = document.getElementById('claimLoginIdentifier');
        const copyIdentifierButton = document.getElementById('claimCopyIdentifier');
        const copyStatus = document.getElementById('claimCopyStatus');
        const successIdentity = document.getElementById('claimSuccessIdentity');
        const successLoginIdentifier = document.getElementById('claimSuccessLoginIdentifier');
        const offline = document.getElementById('claimOffline');
        const passwordForm = document.getElementById('claimPasswordForm');
        const password = document.getElementById('claimPassword');
        const confirmation = document.getElementById('claimPasswordConfirm');
        const existing = document.getElementById('claimExistingAccount');
        const existingButton = document.getElementById('claimExistingButton');
        const googleStatus = document.getElementById('claimGoogleStatus');
        if (
            !status || !actions || !success || !signInIdentity || !loginIdentifierElement ||
            !copyIdentifierButton || !copyStatus || !successIdentity || !successLoginIdentifier ||
            !passwordForm || !password || !confirmation
        ) return;

        let loginIdentifier = null;

        const updateConnectivity = () => {
            offline.hidden = navigator.onLine;
        };
        updateConnectivity();
        window.addEventListener('online', updateConnectivity);
        window.addEventListener('offline', updateConnectivity);

        const showFailure = message => {
            loginIdentifier = null;
            loginIdentifierElement.textContent = '';
            signInIdentity.hidden = true;
            actions.hidden = true;
            status.textContent = message;
        };
        const showSuccess = identifier => {
            claimToken = null;
            const confirmedIdentifier = identifier || loginIdentifier;
            password.value = '';
            confirmation.value = '';
            actions.hidden = true;
            status.hidden = true;
            success.hidden = false;
            if (confirmedIdentifier) {
                successLoginIdentifier.textContent = confirmedIdentifier;
                successIdentity.hidden = false;
            }
            loginHelp.textContent = confirmedIdentifier
                ? 'Use this Sign-in ID with your private password, or choose Continue with Google if you connected Google.'
                : 'Please sign in again using the method you just activated.';
        };
        const submitActivation = async (pathname, extraBody) => {
            if (!claimToken) throw new Error('invalid-claim');
            const response = await fetch(pathname, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: claimToken, ...extraBody })
            });
            const body = await response.json();
            if (!response.ok || !body.success) throw new Error(body.error || 'Unable to connect this account.');
            showSuccess(body.login_identifier || null);
        };

        if (!claimToken) {
            showFailure('This account invitation is invalid or incomplete. Ask a ministry administrator for a new invitation.');
            return;
        }

        try {
            const previewResponse = await fetch('/api/account-claim/preview', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: claimToken })
            });
            const preview = await previewResponse.json();
            if (
                !previewResponse.ok || !preview.success || !preview.member || !preview.member.name ||
                typeof preview.login_identifier !== 'string' || !preview.login_identifier.trim()
            ) {
                throw new Error('invalid-claim');
            }
            status.textContent = `Welcome, ${preview.member.name}! This invitation connects your existing FOG membership to the Community Portal.`;
            loginIdentifier = preview.login_identifier;
            loginIdentifierElement.textContent = loginIdentifier;
            signInIdentity.hidden = false;
            actions.hidden = false;
        } catch (error) {
            showFailure(navigator.onLine
                ? 'This account invitation is invalid or no longer active. Ask a ministry administrator for a new invitation.'
                : 'An internet connection is required to check this account invitation.');
            return;
        }

        copyIdentifierButton.addEventListener('click', async () => {
            if (!loginIdentifier) return;
            try {
                await navigator.clipboard.writeText(loginIdentifier);
                copyStatus.textContent = 'Sign-in ID copied.';
            } catch (error) {
                copyStatus.textContent = 'Copy was unavailable. Press and hold the Sign-in ID to copy it.';
            }
        });

        passwordForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (password.value !== confirmation.value) {
                status.textContent = 'The passwords do not match.';
                return;
            }
            if (password.value.length < 8 || password.value.length > 128 || !/\S/.test(password.value)) {
                status.textContent = 'Password must be 8 to 128 characters and contain meaningful content.';
                return;
            }
            const button = passwordForm.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                await submitActivation('/api/account-claim/activate-password', { password: password.value });
            } catch (error) {
                status.textContent = error.message === 'invalid-claim'
                    ? 'This account invitation is no longer active.'
                    : error.message;
            } finally {
                button.disabled = false;
            }
        });

        try {
            const authResponse = await fetch('/api/auth/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            existing.hidden = !authResponse.ok;
        } catch (error) {
            existing.hidden = true;
        }

        existingButton.addEventListener('click', async () => {
            existingButton.disabled = true;
            try {
                await submitActivation('/api/account-claim/complete', {});
            } catch (error) {
                status.textContent = 'This signed-in account cannot be connected to this membership.';
            } finally {
                existingButton.disabled = false;
            }
        });

        window.handleClaimGoogleCredential = async response => {
            if (!response || typeof response.credential !== 'string') return;
            googleStatus.textContent = 'Connecting your Google account…';
            try {
                await submitActivation('/api/account-claim/activate-google', {
                    google_token: response.credential
                });
            } catch (error) {
                googleStatus.textContent = 'This Google account could not be connected. Please choose another method or request help.';
            }
        };

        const googleScript = document.createElement('script');
        googleScript.src = 'https://accounts.google.com/gsi/client';
        googleScript.async = true;
        googleScript.onload = () => {
            if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: window.handleClaimGoogleCredential,
                auto_select: false
            });
            window.google.accounts.id.renderButton(
                document.getElementById('claimGoogleButton'),
                { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular' }
            );
        };
        document.head.appendChild(googleScript);
    });
})();
