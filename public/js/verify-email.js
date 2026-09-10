'use strict';

(() => {
    const match = /^#([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    let verificationToken = match ? match[1] : null;
    window.history.replaceState(null, '', '/verify-email');

    document.addEventListener('DOMContentLoaded', async () => {
        const status = document.getElementById('verifyEmailStatus');
        if (!status) return;
        if (!verificationToken) {
            status.textContent = 'This verification link is invalid or incomplete. Request a new link from your profile.';
            return;
        }

        try {
            const response = await fetch('/api/auth/email-verification/confirm', {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: verificationToken })
            });
            verificationToken = null;
            const body = await response.json();
            status.textContent = response.ok && body.success
                ? body.message
                : body.message || 'This verification link is invalid or expired. Request a new one from your profile.';
        } catch (error) {
            verificationToken = null;
            status.textContent = 'We could not confirm your email right now. Please try the link again later.';
        }
    });
})();
