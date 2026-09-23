(function privateJournalPolicyAdmin(root) {
    'use strict';

    const document = root.document;

    const section =
        document.getElementById(
            'privateJournalPolicySettings'
        );

    const toggle =
        document.getElementById(
            'privateJournalTeenGuardianToggle'
        );

    const status =
        document.getElementById(
            'privateJournalPolicyStatus'
        );

    const profileTab =
        document.getElementById(
            'profileTab'
        );

    if (!section || !toggle || !status) return;

    let savedValue = null;
    let loaded = false;
    let loadGeneration = 0;

    function showUnknown(message) {
        section.hidden = false;

        loaded = false;
        savedValue = null;

        toggle.disabled = true;
        toggle.checked = false;
        toggle.indeterminate = true;

        toggle.setAttribute(
            'aria-checked',
            'mixed'
        );

        status.textContent = message;
    }

    function showLoaded(value, message) {
        section.hidden = false;

        savedValue = value === true;
        loaded = true;

        toggle.indeterminate = false;
        toggle.removeAttribute(
            'aria-checked'
        );

        toggle.checked = savedValue;
        toggle.disabled = false;

        status.textContent = message;
    }

    function showChecking() {
        section.hidden = false;

        toggle.disabled = true;
        toggle.checked = false;
        toggle.indeterminate = true;

        toggle.setAttribute(
            'aria-checked',
            'mixed'
        );

        status.textContent =
            'Checking safeguarding policy…';
    }

    async function responseJson(
        response,
        fallback
    ) {
        let payload = null;

        try {
            payload = await response.json();
        } catch (error) {
            /* Use fallback below. */
        }

        if (!response.ok) {
            throw new Error(
                payload &&
                payload.error
                    ? payload.error
                    : fallback
            );
        }

        return payload;
    }

    async function loadPolicy() {
        const generation =
            ++loadGeneration;

        showChecking();

        try {
            const response =
                await root.fetch(
                    '/api/admin/private-journal-policy',
                    {
                        cache: 'no-store',
                        credentials: 'same-origin'
                    }
                );

            /*
             * Ignore an older request if a newer Profile activation
             * already started another policy check.
             */
            if (generation !== loadGeneration) {
                return;
            }

            if (response.status === 401) {
                showUnknown(
                    'Waiting for an authenticated Strong Admin session. ' +
                    'After signing in, reopen Profile to load this policy.'
                );
                return;
            }

            if (response.status === 403) {
                showUnknown(
                    'This safeguarding option can only be changed by the ' +
                    'Strong Admin account. The current policy state is not ' +
                    'shown here.'
                );
                return;
            }

            const policy =
                await responseJson(
                    response,
                    'Unable to load the Journal safeguarding policy.'
                );

            if (generation !== loadGeneration) {
                return;
            }

            const value =
                policy.guardian_required_13_17 === true;

            const message =
                policy.valid
                    ? `Current policy: guardian authorization is ${
                        value
                            ? 'required'
                            : 'not required'
                    } for ages 13–17.`
                    : 'The setting was missing or invalid, so the server ' +
                      'is safely requiring guardian authorization.';

            showLoaded(
                value,
                message
            );
        } catch (error) {
            if (generation !== loadGeneration) {
                return;
            }

            showUnknown(
                'Unable to load the safeguarding policy. ' +
                'No setting was changed.'
            );
        }
    }

    toggle.addEventListener(
        'change',
        async () => {
            if (!loaded) {
                showUnknown(
                    status.textContent ||
                    'The safeguarding policy has not loaded yet.'
                );
                return;
            }

            const previousValue =
                savedValue;

            const nextValue =
                toggle.checked;

            const confirmed =
                root.confirm(
                    'Changing this setting affects Private Journal access ' +
                    'for members ages 13–17. Existing encrypted Journal ' +
                    'entries are not deleted or exposed.'
                );

            if (!confirmed) {
                toggle.checked =
                    previousValue;
                return;
            }

            toggle.disabled = true;

            status.textContent =
                'Saving the safeguarding policy…';

            try {
                const response =
                    await root.fetch(
                        '/api/admin/private-journal-policy',
                        {
                            method: 'PUT',
                            cache: 'no-store',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type':
                                    'application/json'
                            },
                            body: JSON.stringify({
                                guardian_required_13_17:
                                    nextValue
                            })
                        }
                    );

                if (response.status === 401) {
                    showUnknown(
                        'Your authenticated session is no longer active. ' +
                        'Sign in again before changing this policy.'
                    );
                    return;
                }

                if (response.status === 403) {
                    showUnknown(
                        'Only the Strong Admin account can change this ' +
                        'safeguarding policy.'
                    );
                    return;
                }

                const result =
                    await responseJson(
                        response,
                        'Unable to change the Journal safeguarding policy.'
                    );

                const value =
                    result.guardian_required_13_17 ===
                    true;

                showLoaded(
                    value,
                    `Saved. Guardian authorization is ${
                        value
                            ? 'required'
                            : 'not required'
                    } for ages 13–17.`
                );
            } catch (error) {
                /*
                 * Do not re-enable a control whose current server state
                 * could not be confirmed after a failed save.
                 */
                showUnknown(
                    'Unable to save the safeguarding policy. ' +
                    'No confirmed setting is shown. Reopen Profile to retry.'
                );
            }
        }
    );

    /*
     * The previous implementation checked only once when this script
     * loaded. At that point the user can still be on the login screen,
     * so a legitimate later Strong Admin session was never rechecked.
     *
     * Observe the Profile tab itself instead. Every time Profile becomes
     * active after login, request the authoritative server policy again.
     */
    if (
        profileTab &&
        typeof root.MutationObserver ===
            'function'
    ) {
        const observer =
            new root.MutationObserver(
                mutations => {
                    const becameActive =
                        mutations.some(
                            mutation =>
                                mutation.type ===
                                    'attributes' &&
                                mutation.attributeName ===
                                    'class'
                        ) &&
                        profileTab.classList.contains(
                            'active'
                        );

                    if (becameActive) {
                        void loadPolicy();
                    }
                }
            );

        observer.observe(
            profileTab,
            {
                attributes: true,
                attributeFilter: ['class']
            }
        );
    }

    /*
     * Navigation buttons already carry data-target="profileTab".
     * This provides a second safe reload path across the Portal's
     * layered switchTab implementations.
     */
    document.addEventListener(
        'click',
        event => {
            const element =
                event.target &&
                typeof event.target.closest ===
                    'function'
                    ? event.target.closest(
                        '[data-target="profileTab"]'
                    )
                    : null;

            if (!element) return;

            root.setTimeout(
                () => {
                    void loadPolicy();
                },
                0
            );
        }
    );

    /*
     * Returning to an already-open Profile after authentication or
     * another tab/window should also refresh the authoritative policy.
     */
    root.addEventListener(
        'focus',
        () => {
            if (
                profileTab &&
                profileTab.classList.contains(
                    'active'
                )
            ) {
                void loadPolicy();
            }
        }
    );

    /*
     * Explicit hook for diagnostics and future Portal integration.
     */
    root.FOGPrivateJournalPolicyAdmin =
        Object.freeze({
            reload: loadPolicy
        });

    /*
     * Initial attempt remains useful for an already-authenticated
     * browser. A 401 is now visible and, crucially, no longer final.
     */
    void loadPolicy();
})(window);
