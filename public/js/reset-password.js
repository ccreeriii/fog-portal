'use strict';

(() => {
    const match = /^#([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    let resetToken = match ? match[1] : null;
    window.history.replaceState(null, '', '/reset-password');

    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('resetPasswordForm');
        const result = document.getElementById('resetPasswordResult');
        const intro = document.getElementById('resetPasswordIntro');
        const newPassword = document.getElementById('resetPasswordNew');
        const confirmPassword = document.getElementById('resetPasswordConfirm');
        if (!form || !result || !intro || !newPassword || !confirmPassword) return;

        const showResult = (message, success) => {
            result.textContent = message;
            result.style.display = 'block';
            result.style.background = success ? '#ECFDF5' : '#FEF2F2';
            result.style.color = success ? '#065F46' : '#991B1B';
        };

        if (!resetToken) {
            form.style.display = 'none';
            intro.textContent = 'This password reset link is invalid or incomplete. Request a new link from the sign-in page.';
            return;
        }

        form.addEventListener('submit', async event => {
            event.preventDefault();
            result.style.display = 'none';
            if (newPassword.value !== confirmPassword.value) {
                showResult('The passwords do not match.', false);
                return;
            }
            if (newPassword.value.length < 8 || newPassword.value.length > 128 || !/\S/.test(newPassword.value)) {
                showResult('Password must be 8 to 128 characters and contain meaningful content.', false);
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: resetToken, password: newPassword.value })
                });
                const body = await response.json();
                if (response.ok && body.success) {
                    resetToken = null;
                    newPassword.value = '';
                    confirmPassword.value = '';
                    form.style.display = 'none';
                    showResult('Password changed successfully. Return to Sign In and use your new password.', true);
                    return;
                }
                showResult(body.message || 'This password reset link is invalid or expired. Request a new one.', false);
            } catch (error) {
                showResult('The password could not be reset right now. Check your connection and try again.', false);
            } finally {
                submitButton.disabled = false;
            }
        });
    });
})();
