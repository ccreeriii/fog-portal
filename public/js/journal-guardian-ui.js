(function initializeJournalGuardianUi(root, factory) {
    const api = factory(root);

    if (
        typeof module === 'object' &&
        module &&
        module.exports
    ) {
        module.exports = api;
    }

    if (root && typeof root === 'object') {
        root.FOGJournalGuardianUI =
            api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,

    function journalGuardianUiFactory(root) {
        'use strict';

        const HASH_KEY =
            'journal-guardian';

        let processingGuardianToken =
            false;

        let guardianPollTimer =
            null;


        function documentRef() {
            return (
                root &&
                root.document
            )
                ? root.document
                : null;
        }


        function apiFetch(
            url,
            options = {}
        ) {
            if (
                !root ||
                typeof root.fetch !==
                    'function'
            ) {
                throw new Error(
                    'Network access is unavailable.'
                );
            }

            return root.fetch(
                url,
                {
                    cache:
                        'no-store',

                    credentials:
                        'same-origin',

                    ...options,

                    headers: {
                        ...(options.headers ||
                            {})
                    }
                }
            );
        }


        async function jsonResponse(
            response,
            fallback
        ) {
            let payload =
                null;

            try {
                payload =
                    await response.json();
            } catch (error) {
                // Use fallback below.
            }

            if (!response.ok) {
                const problem =
                    new Error(
                        payload &&
                        payload.error
                            ? payload.error
                            : fallback
                    );

                problem.payload =
                    payload;

                problem.status =
                    response.status;

                throw problem;
            }

            return payload;
        }


        function buildGuardianShareLink(
            token,
            baseUrl
        ) {
            if (
                typeof token !==
                    'string' ||
                token.length < 20
            ) {
                throw new TypeError(
                    'A valid guardian authorization code is required.'
                );
            }

            const locationUrl =
                baseUrl ||
                (
                    root &&
                    root.location &&
                    root.location.href
                );

            if (!locationUrl) {
                throw new Error(
                    'Unable to create guardian approval link.'
                );
            }

            const UrlConstructor =
                root.URL ||
                URL;

            const url =
                new UrlConstructor(
                    locationUrl
                );

            url.pathname =
                '/journal-guardian.html';

            url.search =
                '';

            /*
             * IMPORTANT:
             * The approval token is put in the URL fragment,
             * not the query string. Browser fragments are not
             * sent as part of the HTTP request to the server.
             */
            url.hash =
                `${HASH_KEY}=` +
                encodeURIComponent(
                    token
                );

            return url.toString();
        }


        function extractGuardianTokenFromHash(
            hash
        ) {
            const source =
                String(
                    hash || ''
                )
                    .replace(
                        /^#/,
                        ''
                    );

            if (!source) {
                return null;
            }

            const prefix =
                `${HASH_KEY}=`;

            if (
                !source.startsWith(
                    prefix
                )
            ) {
                return null;
            }

            try {
                const token =
                    decodeURIComponent(
                        source.slice(
                            prefix.length
                        )
                    );

                return token ||
                    null;

            } catch (error) {
                return null;
            }
        }


        function clearGuardianFragment() {
            if (
                !root ||
                !root.location ||
                !root.history ||
                typeof root.history
                    .replaceState !==
                    'function'
            ) {
                return;
            }

            const clean =
                root.location.pathname +
                root.location.search;

            root.history
                .replaceState(
                    null,
                    '',
                    clean
                );
        }


        function currentMemberId() {
            const id =
                Number(
                    root &&
                    root.currentMember &&
                    root.currentMember.id
                );

            return (
                Number.isInteger(id) &&
                id > 0
            )
                ? id
                : null;
        }


        function createDialog(
            titleText
        ) {
            const document =
                documentRef();

            if (!document) {
                throw new Error(
                    'Guardian authorization requires a browser.'
                );
            }

            const overlay =
                document.createElement(
                    'div'
                );

            overlay.className =
                'journal-family-overlay';

            const card =
                document.createElement(
                    'section'
                );

            card.className =
                'journal-family-dialog';

            card.setAttribute(
                'role',
                'dialog'
            );

            card.setAttribute(
                'aria-modal',
                'true'
            );

            const title =
                document.createElement(
                    'h2'
                );

            title.className =
                'journal-family-dialog__title';

            title.textContent =
                titleText;

            card.appendChild(
                title
            );

            overlay.appendChild(
                card
            );

            return {
                overlay,
                card
            };
        }


        function paragraph(
            parent,
            value,
            className
        ) {
            const element =
                documentRef()
                    .createElement(
                        'p'
                    );

            element.textContent =
                value;

            if (className) {
                element.className =
                    className;
            }

            parent.appendChild(
                element
            );

            return element;
        }


        function createButton(
            label,
            primary = false
        ) {
            const element =
                documentRef()
                    .createElement(
                        'button'
                    );

            element.type =
                'button';

            element.textContent =
                label;

            element.className =
                primary
                    ? 'journal-family-button journal-family-button--primary'
                    : 'journal-family-button';

            return element;
        }


        async function copyText(
            value
        ) {
            if (
                root.navigator &&
                root.navigator.clipboard &&
                typeof root.navigator
                    .clipboard
                    .writeText ===
                    'function'
            ) {
                await root.navigator
                    .clipboard
                    .writeText(
                        value
                    );

                return true;
            }

            return false;
        }


        function youthExplanation(
            status
        ) {
            if (
                status &&
                status.experience_mode ===
                    'youth_reflection'
            ) {
                return {
                    title:
                        'Youth Reflection',

                    intro:
                        'This is a private place to pause, pray, and write about what matters to you.',

                    detail:
                        'Because you are under 18, a parent or legal guardian needs to approve use of this feature first.'
                };
            }

            return {
                title:
                    'Private Journal',

                intro:
                    'Your journal is designed as a private place for prayer, gratitude, and reflection.',

                detail:
                    'Because you are under 18, a parent or legal guardian needs to approve use of this feature first.'
            };
        }


        async function checkYouthAuthorization() {
            const response =
                await apiFetch(
                    '/api/journal-security/status'
                );

            return jsonResponse(
                response,
                'Unable to check Journal authorization.'
            );
        }


        async function requestYouthAuthorization(
            status
        ) {
            const document =
                documentRef();

            if (!document) {
                return false;
            }

            const copy =
                youthExplanation(
                    status
                );

            const {
                overlay,
                card
            } =
                createDialog(
                    copy.title
                );

            paragraph(
                card,
                copy.intro,
                'journal-family-dialog__lead'
            );

            paragraph(
                card,
                copy.detail
            );

            const privacy =
                document.createElement(
                    'div'
                );

            privacy.className =
                'journal-family-privacy';

            const privacyTitle =
                document.createElement(
                    'strong'
                );

            privacyTitle.textContent =
                'What approval means';

            privacy.appendChild(
                privacyTitle
            );

            for (
                const item of [
                    'Your reflections are encrypted on your device before they are saved.',
                    'Parent or guardian approval lets you use the feature. It does not automatically let them read your entries.',
                    'FOG leaders do not routinely browse your Private Journal or Youth Reflections.',
                    'If you choose to ask for help later, only the reflection you intentionally share should be shared.'
                ]
            ) {
                const line =
                    document
                        .createElement(
                            'p'
                        );

                line.textContent =
                    item;

                privacy.appendChild(
                    line
                );
            }

            card.appendChild(
                privacy
            );

            const acknowledgement =
                document.createElement(
                    'label'
                );

            acknowledgement.className =
                'journal-family-check';

            const checkbox =
                document.createElement(
                    'input'
                );

            checkbox.type =
                'checkbox';

            const checkboxText =
                document.createElement(
                    'span'
                );

            checkboxText.textContent =
                'I understand this explanation and want to ask my parent or legal guardian to approve this feature.';

            acknowledgement.append(
                checkbox,
                checkboxText
            );

            card.appendChild(
                acknowledgement
            );

            const statusText =
                paragraph(
                    card,
                    '',
                    'journal-family-status'
                );

            const actions =
                document.createElement(
                    'div'
                );

            actions.className =
                'journal-family-actions';

            const cancel =
                createButton(
                    'Not Now'
                );

            const create =
                createButton(
                    'Ask Parent / Guardian',
                    true
                );

            create.disabled =
                true;

            checkbox.addEventListener(
                'change',
                () => {
                    create.disabled =
                        !checkbox.checked;
                }
            );

            actions.append(
                cancel,
                create
            );

            card.appendChild(
                actions
            );

            document.body
                .appendChild(
                    overlay
                );

            return new Promise(
                resolve => {
                    let finished =
                        false;

                    const finish =
                        result => {
                            if (finished) {
                                return;
                            }

                            finished =
                                true;

                            overlay.remove();

                            resolve(
                                result
                            );
                        };

                    cancel.addEventListener(
                        'click',
                        () =>
                            finish(false)
                    );

                    create.addEventListener(
                        'click',
                        async () => {
                            create.disabled =
                                true;

                            cancel.disabled =
                                true;

                            statusText.textContent =
                                'Creating a secure approval request…';

                            try {
                                const response =
                                    await apiFetch(
                                        '/api/journal-security/guardian-request',
                                        {
                                            method:
                                                'POST',

                                            headers: {
                                                'Content-Type':
                                                    'application/json'
                                            },

                                            body:
                                                JSON.stringify({
                                                    youth_acknowledged:
                                                        true
                                                })
                                        }
                                    );

                                const result =
                                    await jsonResponse(
                                        response,
                                        'Unable to create guardian approval request.'
                                    );

                                showYouthShareStep({
                                    card,
                                    result,
                                    finish
                                });

                            } catch (error) {
                                statusText.textContent =
                                    error.message ||
                                    'Unable to create guardian approval request.';

                                create.disabled =
                                    false;

                                cancel.disabled =
                                    false;
                            }
                        }
                    );
                }
            );
        }


        function showYouthShareStep({
            card,
            result,
            finish
        }) {
            const document =
                documentRef();

            card.replaceChildren();

            const title =
                document.createElement(
                    'h2'
                );

            title.className =
                'journal-family-dialog__title';

            title.textContent =
                'Share With Your Parent or Guardian';

            card.appendChild(
                title
            );

            paragraph(
                card,
                'Send the approval link below directly to your parent or legal guardian. The request expires after seven days.',
                'journal-family-dialog__lead'
            );

            const link =
                buildGuardianShareLink(
                    result.approval_token
                );

            const reminder =
                paragraph(
                    card,
                    'This link lets a parent or guardian review the request and verify their email. It does not unlock or reveal your reflections.',
                    'journal-family-note'
                );

            reminder.setAttribute(
                'role',
                'note'
            );

            const feedback =
                paragraph(
                    card,
                    '',
                    'journal-family-status'
                );

            const buttons =
                document.createElement(
                    'div'
                );

            buttons.className =
                'journal-family-actions journal-family-actions--wrap';

            const copyLink =
                createButton(
                    'Copy Approval Link',
                    true
                );

            const check =
                createButton(
                    'Check Approval'
                );

            const close =
                createButton(
                    'Close'
                );

            copyLink.addEventListener(
                'click',
                async () => {
                    try {
                        const copied =
                            await copyText(
                                link
                            );

                        feedback.textContent =
                            copied
                                ? 'Approval link copied.'
                                : 'Please copy the approval link manually.';
                    } catch (error) {
                        feedback.textContent =
                            'Please copy the approval link manually.';
                    }
                }
            );

            check.addEventListener(
                'click',
                async () => {
                    check.disabled =
                        true;

                    feedback.textContent =
                        'Checking approval…';

                    try {
                        const latest =
                            await checkYouthAuthorization();

                        if (
                            latest &&
                            latest.access_allowed ===
                                true
                        ) {
                            feedback.textContent =
                                'Approved. Your protected reflection space is ready.';

                            root.setTimeout(
                                () =>
                                    finish(true),
                                650
                            );

                            return;
                        }

                        feedback.textContent =
                            'Approval is still pending. Ask your parent or guardian to open the link and confirm.';

                    } catch (error) {
                        feedback.textContent =
                            error.message ||
                            'Unable to check approval.';

                    } finally {
                        check.disabled =
                            false;
                    }
                }
            );

            close.addEventListener(
                'click',
                () =>
                    finish(false)
            );

            buttons.append(
                copyLink,
                check,
                close
            );

            card.appendChild(
                buttons
            );

            /*
             * The raw token remains only in this JavaScript
             * closure while the dialog is open. It is never
             * written to persistent browser key/value storage.
             */
        }


        async function previewGuardianRequest(
            token
        ) {
            const response =
                await apiFetch(
                    '/api/journal-security/guardian-request/preview',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                approval_token:
                                    token
                            })
                    }
                );

            return jsonResponse(
                response,
                'Unable to verify guardian approval request.'
            );
        }


        async function approveGuardianRequest(
            token,
            relationship
        ) {
            const response =
                await apiFetch(
                    '/api/journal-security/guardian-request/approve',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                approval_token:
                                    token,

                                relationship,

                                guardian_attested:
                                    true
                            })
                    }
                );

            return jsonResponse(
                response,
                'Unable to approve Journal access.'
            );
        }


        async function showGuardianApproval(
            token
        ) {
            const document =
                documentRef();

            if (!document) {
                return;
            }

            let preview;

            try {
                preview =
                    await previewGuardianRequest(
                        token
                    );
            } catch (error) {
                const {
                    overlay,
                    card
                } =
                    createDialog(
                        'Journal Approval'
                    );

                paragraph(
                    card,
                    error.message ||
                    'This approval request could not be opened.',
                    'journal-family-dialog__lead'
                );

                const close =
                    createButton(
                        'Close',
                        true
                    );

                close.addEventListener(
                    'click',
                    () =>
                        overlay.remove()
                );

                card.appendChild(
                    close
                );

                document.body
                    .appendChild(
                        overlay
                    );

                return;
            }

            const request =
                preview &&
                preview.request;

            if (!request) {
                return;
            }

            const {
                overlay,
                card
            } =
                createDialog(
                    'Parent / Guardian Approval'
                );

            paragraph(
                card,
                `${request.youth_name} is asking for permission to use FOG's protected ${
                    request.age_bracket ===
                        'AGE_10_12'
                        ? 'Youth Reflection'
                        : 'Private Journal'
                } feature.`,
                'journal-family-dialog__lead'
            );

            const privacy =
                document.createElement(
                    'div'
                );

            privacy.className =
                'journal-family-privacy';

            paragraph(
                privacy,
                'Approving this request allows the young person to use the feature. It does not give you automatic access to their journal entries.'
            );

            paragraph(
                privacy,
                'Their reflections are encrypted on their device before they are stored. FOG leaders do not routinely browse the journal.'
            );

            card.appendChild(
                privacy
            );

            const relationLabel =
                document.createElement(
                    'label'
                );

            relationLabel.className =
                'journal-family-field';

            const relationTitle =
                document.createElement(
                    'span'
                );

            relationTitle.textContent =
                'Your relationship';

            const relation =
                document.createElement(
                    'select'
                );

            const parent =
                document.createElement(
                    'option'
                );

            parent.value =
                'parent';

            parent.textContent =
                'Parent';

            const guardian =
                document.createElement(
                    'option'
                );

            guardian.value =
                'legal_guardian';

            guardian.textContent =
                'Legal Guardian';

            relation.append(
                parent,
                guardian
            );

            relationLabel.append(
                relationTitle,
                relation
            );

            card.appendChild(
                relationLabel
            );

            const attestation =
                document.createElement(
                    'label'
                );

            attestation.className =
                'journal-family-check';

            const checkbox =
                document.createElement(
                    'input'
                );

            checkbox.type =
                'checkbox';

            const acknowledgement =
                document.createElement(
                    'span'
                );

            acknowledgement.textContent =
                'I confirm that I am this young person’s parent or legal guardian and I authorize them to use this protected reflection feature. I understand this does not give me routine access to their entries.';

            attestation.append(
                checkbox,
                acknowledgement
            );

            card.appendChild(
                attestation
            );

            const feedback =
                paragraph(
                    card,
                    '',
                    'journal-family-status'
                );

            const actions =
                document.createElement(
                    'div'
                );

            actions.className =
                'journal-family-actions';

            const cancel =
                createButton(
                    'Cancel'
                );

            const approve =
                createButton(
                    'Approve',
                    true
                );

            approve.disabled =
                true;

            checkbox.addEventListener(
                'change',
                () => {
                    approve.disabled =
                        !checkbox.checked;
                }
            );

            cancel.addEventListener(
                'click',
                () =>
                    overlay.remove()
            );

            approve.addEventListener(
                'click',
                async () => {
                    approve.disabled =
                        true;

                    cancel.disabled =
                        true;

                    feedback.textContent =
                        'Recording authorization…';

                    try {
                        await approveGuardianRequest(
                            token,
                            relation.value
                        );

                        card.replaceChildren();

                        const success =
                            document.createElement(
                                'h2'
                            );

                        success.className =
                            'journal-family-dialog__title';

                        success.textContent =
                            'Approval Complete';

                        card.appendChild(
                            success
                        );

                        paragraph(
                            card,
                            `${request.youth_name} can now reopen Private Journal and choose “Check Approval.”`,
                            'journal-family-dialog__lead'
                        );

                        paragraph(
                            card,
                            'This approval did not give your account access to the young person’s journal entries.',
                            'journal-family-note'
                        );

                        const done =
                            createButton(
                                'Done',
                                true
                            );

                        done.addEventListener(
                            'click',
                            () =>
                                overlay.remove()
                        );

                        card.appendChild(
                            done
                        );

                    } catch (error) {
                        feedback.textContent =
                            error.message ||
                            'Unable to record authorization.';

                        approve.disabled =
                            false;

                        cancel.disabled =
                            false;
                    }
                }
            );

            actions.append(
                cancel,
                approve
            );

            card.appendChild(
                actions
            );

            document.body
                .appendChild(
                    overlay
                );
        }


        async function consumeGuardianFragment() {
            if (
                processingGuardianToken ||
                !root ||
                !root.location
            ) {
                return false;
            }

            const token =
                extractGuardianTokenFromHash(
                    root.location.hash
                );

            if (!token) {
                return false;
            }

            /*
             * Do not consume the fragment before sign-in.
             * If login causes a page reload, the browser
             * retains the fragment and still does not send
             * it to the HTTP server.
             */
            if (!currentMemberId()) {
                return false;
            }

            processingGuardianToken =
                true;

            /*
             * Once a signed-in member has the token in
             * memory, remove it immediately from the visible
             * URL and browser-history entry.
             */
            clearGuardianFragment();

            try {
                await showGuardianApproval(
                    token
                );

                return true;

            } finally {
                processingGuardianToken =
                    false;
            }
        }


        function install() {
            if (
                !root ||
                !root.location
            ) {
                return false;
            }

            consumeGuardianFragment();

            if (
                extractGuardianTokenFromHash(
                    root.location.hash
                ) &&
                !guardianPollTimer
            ) {
                let attempts =
                    0;

                guardianPollTimer =
                    root.setInterval(
                        async () => {
                            attempts +=
                                1;

                            const consumed =
                                await consumeGuardianFragment();

                            if (
                                consumed ||
                                attempts >= 600
                            ) {
                                root.clearInterval(
                                    guardianPollTimer
                                );

                                guardianPollTimer =
                                    null;
                            }
                        },
                        500
                    );
            }

            return true;
        }


        return Object.freeze({
            install,

            requestYouthAuthorization,

            _testing:
                Object.freeze({
                    buildGuardianShareLink,
                    extractGuardianTokenFromHash
                })
        });
    }
);


if (
    typeof window !== 'undefined' &&
    window.FOGJournalGuardianUI
) {
    window
        .FOGJournalGuardianUI
        .install();
}
