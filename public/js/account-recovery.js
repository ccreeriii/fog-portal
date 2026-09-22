'use strict';

(() => {
    const match =
        /^#([A-Za-z0-9_-]{43})$/.exec(
            window.location.hash
        );

    let recoveryToken =
        match ? match[1] : null;

    window.history.replaceState(
        null,
        '',
        '/recover-account'
    );

    document.addEventListener(
        'DOMContentLoaded',
        async () => {
            const intro =
                document.getElementById(
                    'accountRecoveryIntro'
                );

            const identity =
                document.getElementById(
                    'accountRecoveryIdentity'
                );

            const member =
                document.getElementById(
                    'accountRecoveryMember'
                );

            const username =
                document.getElementById(
                    'accountRecoveryUsername'
                );

            const form =
                document.getElementById(
                    'accountRecoveryForm'
                );

            const result =
                document.getElementById(
                    'accountRecoveryResult'
                );

            const newPassword =
                document.getElementById(
                    'accountRecoveryNew'
                );

            const confirmPassword =
                document.getElementById(
                    'accountRecoveryConfirm'
                );

            if (
                !intro ||
                !identity ||
                !member ||
                !username ||
                !form ||
                !result ||
                !newPassword ||
                !confirmPassword
            ) return;

            const showResult = (
                message,
                success
            ) => {
                result.textContent = message;
                result.style.display = 'block';

                result.style.background =
                    success
                        ? '#ECFDF5'
                        : '#FEF2F2';

                result.style.color =
                    success
                        ? '#065F46'
                        : '#991B1B';
            };

            if (!recoveryToken) {
                intro.textContent =
                    'This recovery link is invalid or incomplete. Please ask your Community Portal administrator for a new Recovery QR or link.';
                return;
            }

            try {
                const response = await fetch(
                    '/api/account-recovery/preview',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        cache: 'no-store',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body: JSON.stringify({
                            token: recoveryToken
                        })
                    }
                );

                const body =
                    await response.json();

                if (
                    !response.ok ||
                    !body.success
                ) {
                    recoveryToken = null;

                    intro.textContent =
                        body.error ||
                        'This recovery link is invalid or no longer active. Please ask your administrator for a new Recovery QR or link.';

                    return;
                }

                member.textContent =
                    body.member &&
                    body.member.name
                        ? body.member.name
                        : 'Community Portal Member';

                username.textContent =
                    body.login_identifier || '';

                intro.textContent =
                    'This secure one-time link lets you restore access to your existing account. Choose a new password below.';

                identity.style.display =
                    'block';

                form.style.display =
                    'block';
            } catch (error) {
                intro.textContent =
                    'The recovery link could not be checked right now. Please check your connection and try again.';
            }

            form.addEventListener(
                'submit',
                async event => {
                    event.preventDefault();

                    result.style.display =
                        'none';

                    if (!recoveryToken) {
                        showResult(
                            'This recovery link is no longer available. Please ask your administrator for a new link.',
                            false
                        );

                        return;
                    }

                    if (
                        newPassword.value !==
                        confirmPassword.value
                    ) {
                        showResult(
                            'The passwords do not match.',
                            false
                        );

                        return;
                    }

                    if (
                        newPassword.value.length < 8 ||
                        newPassword.value.length > 128 ||
                        !/\S/.test(
                            newPassword.value
                        )
                    ) {
                        showResult(
                            'Password must be 8 to 128 characters and contain meaningful content.',
                            false
                        );

                        return;
                    }

                    const submitButton =
                        form.querySelector(
                            'button[type="submit"]'
                        );

                    submitButton.disabled =
                        true;

                    try {
                        const response =
                            await fetch(
                                '/api/account-recovery/complete',
                                {
                                    method:
                                        'POST',
                                    credentials:
                                        'same-origin',
                                    cache:
                                        'no-store',
                                    headers: {
                                        'Content-Type':
                                            'application/json'
                                    },
                                    body:
                                        JSON.stringify({
                                            token:
                                                recoveryToken,
                                            password:
                                                newPassword.value
                                        })
                                }
                            );

                        const body =
                            await response.json();

                        if (
                            response.ok &&
                            body.success
                        ) {
                            recoveryToken =
                                null;

                            newPassword.value =
                                '';

                            confirmPassword.value =
                                '';

                            form.style.display =
                                'none';

                            const loginIdentifier =
                                body.login_identifier ||
                                username.textContent ||
                                '';

                            username.textContent =
                                loginIdentifier;

                            showResult(
                                `Account recovered successfully. Your username is ${loginIdentifier}. Return to Sign In and use your new password.`,
                                true
                            );

                            return;
                        }

                        showResult(
                            body.error ||
                            'This recovery link is invalid, expired, or has already been used. Please ask your administrator for a new one.',
                            false
                        );
                    } catch (error) {
                        showResult(
                            'Your account could not be recovered right now. Check your connection and try again.',
                            false
                        );
                    } finally {
                        submitButton.disabled =
                            false;
                    }
                }
            );
        }
    );
})();
