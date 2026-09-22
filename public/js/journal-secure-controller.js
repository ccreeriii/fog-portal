(function initializeSecureJournalController(root, factory) {
    const api = factory(root);

    if (
        typeof module === 'object' &&
        module &&
        module.exports
    ) {
        module.exports = api;
    }

    if (root && typeof root === 'object') {
        root.FOGJournalSecureController = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function secureJournalControllerFactory(root) {
        'use strict';

        const memoryKeys =
            new Map();

        const memoryFingerprints =
            new Map();

        const setupPromises =
            new Map();

        const recoveryPromises =
            new Map();

        const JOURNAL_RESET_REQUEST =
            Symbol(
                'journal-reset-request'
            );

        const JOURNAL_RESET_COMPLETED =
            Symbol(
                'journal-reset-completed'
            );

        let latestAccessStatus =
            null;

        function getCryptoApi() {
            if (
                root &&
                root.FOGJournalCrypto
            ) {
                return root.FOGJournalCrypto;
            }

            if (
                typeof require ===
                    'function'
            ) {
                return require(
                    './journal-crypto.js'
                );
            }

            throw new Error(
                'Private Journal encryption is unavailable.'
            );
        }

        function canonicalOwnerId(value) {
            const parsed =
                Number(value);

            if (
                !Number.isInteger(parsed) ||
                parsed <= 0
            ) {
                throw new Error(
                    'A valid signed-in member is required.'
                );
            }

            return parsed;
        }

        function currentOwnerId() {
            return canonicalOwnerId(
                root &&
                root.currentMember &&
                root.currentMember.id
            );
        }

        function accessDecision(status) {
            if (
                status &&
                status.access_allowed ===
                    true
            ) {
                return Object.freeze({
                    allowed:
                        true,

                    code:
                        status.experience_mode ===
                            'youth_reflection'
                            ? 'youth_reflection'
                            : 'journal',

                    experience_mode:
                        status.experience_mode ||
                        'private_journal'
                });
            }

            const bracket =
                status &&
                status.age_bracket;

            if (
                status &&
                status.reason ===
                    'responsible_use_acknowledgement_required'
            ) {
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'responsible_use_acknowledgement_required',

                    message:
                        'Please review and accept the responsible-journaling promise before using Private Journal.'
                });
            }

            switch (bracket) {
            case 'AGE_13_17':
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'guardian_required',

                    message:
                        'Parent or guardian authorization is required before Private Journal can be used.'
                });

            case 'AGE_10_12':
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'guardian_required',

                    message:
                        'Parent or guardian authorization is required before Youth Reflection can be used.'
                });

            case 'UNDER_10':
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'under_10',

                    message:
                        'Private Journal is not available for members under age 10.'
                });

            case 'AGE_18_PLUS':
                /*
                 * A server response that says 18+ but does
                 * not explicitly authorize access is treated
                 * as unavailable rather than guessed open.
                 */
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'server_access_required',

                    message:
                        'Private Journal access could not be verified.'
                });

            default:
                return Object.freeze({
                    allowed:
                        false,

                    code:
                        'age_unknown',

                    message:
                        'Please complete or correct your birthday before using Private Journal.'
                });
            }
        }

        async function parseJsonResponse(
            response,
            fallbackMessage
        ) {
            let body = null;

            try {
                body =
                    await response.json();
            } catch (error) {
                // Keep generic error below.
            }

            if (!response.ok) {
                throw new Error(
                    body &&
                    typeof body.error ===
                        'string'
                        ? body.error
                        : fallbackMessage
                );
            }

            return body;
        }

        async function apiFetch(
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
                    cache: 'no-store',
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

        function rememberMasterKey(
            ownerId,
            masterKey,
            fingerprint
        ) {
            memoryKeys.set(
                ownerId,
                masterKey
            );

            if (
                typeof fingerprint !==
                    'string' ||
                !fingerprint
            ) {
                throw new Error(
                    'Journal key fingerprint is unavailable.'
                );
            }

            memoryFingerprints.set(
                ownerId,
                fingerprint
            );
        }


        function withKeyFingerprint(
            ownerId,
            encrypted
        ) {
            const fingerprint =
                memoryFingerprints.get(
                    canonicalOwnerId(
                        ownerId
                    )
                );

            if (!fingerprint) {
                throw new Error(
                    'Journal encryption identity is unavailable on this device.'
                );
            }

            return {
                ...encrypted,

                key_fingerprint:
                    fingerprint
            };
        }


async function loadStatus() {
            const response =
                await apiFetch(
                    '/api/journal-security/status'
                );

            const status =
                await parseJsonResponse(
                    response,
                    'Unable to load Private Journal security status.'
                );

            latestAccessStatus =
                status;

            return status;
        }

        async function loadEnvelope() {
            const response =
                await apiFetch(
                    '/api/journal-security/key-envelope'
                );

            return parseJsonResponse(
                response,
                'Unable to load Private Journal key protection.'
            );
        }

        async function saveEnvelope(
            envelope
        ) {
            const response =
                await apiFetch(
                    '/api/journal-security/key-envelope',
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body:
                            JSON.stringify(
                                envelope
                            )
                    }
                );

            return parseJsonResponse(
                response,
                'Unable to save Private Journal key protection.'
            );
        }

        function createOverlay(
            titleText
        ) {
            if (
                !root ||
                !root.document
            ) {
                throw new Error(
                    'Private Journal setup requires a browser.'
                );
            }

            const document =
                root.document;

            const overlay =
                document.createElement(
                    'div'
                );

            overlay.className =
                'journal-security-overlay';

            Object.assign(
                overlay.style,
                {
                    position:
                        'fixed',
                    inset:
                        '0',
                    zIndex:
                        '100000',
                    background:
                        'rgba(15,23,42,0.72)',
                    display:
                        'flex',
                    alignItems:
                        'center',
                    justifyContent:
                        'center',
                    padding:
                        '20px'
                }
            );

            const card =
                document.createElement(
                    'section'
                );

            card.className =
                'journal-security-dialog';

            Object.assign(
                card.style,
                {
                    width:
                        'min(560px, 100%)',
                    maxHeight:
                        '90vh',
                    overflowY:
                        'auto',
                    background:
                        '#fff',
                    borderRadius:
                        '16px',
                    padding:
                        '22px',
                    boxShadow:
                        '0 24px 70px rgba(0,0,0,0.28)'
                }
            );

            const title =
                document.createElement(
                    'h2'
                );

            title.textContent =
                titleText;

            title.style.marginTop =
                '0';

            card.appendChild(title);
            overlay.appendChild(card);

            return {
                overlay,
                card
            };
        }

        function appendParagraph(
            parent,
            text
        ) {
            const p =
                root.document
                    .createElement(
                        'p'
                    );

            p.textContent =
                text;

            p.style.lineHeight =
                '1.55';

            parent.appendChild(p);

            return p;
        }

        function button(
            text,
            primary = false
        ) {
            const element =
                root.document
                    .createElement(
                        'button'
                    );

            element.type =
                'button';

            element.textContent =
                text;

            element.className =
                primary
                    ? 'btn btn-primary'
                    : 'btn btn-outline';

            return element;
        }

        async function showRecoveryKeyOnce(
            recoveryCode
        ) {
            const {
                overlay,
                card
            } =
                createOverlay(
                    'Save Your Journal Recovery Key'
                );

            appendParagraph(
                card,
                'Your Private Journal is protected with a key created on this device.'
            );

            appendParagraph(
                card,
                'Save this Recovery Key somewhere private and safe, preferably separate from this device. You will need it if you change phones, lose this device, clear the browser, or use Private Journal on another device.'
            );

            appendParagraph(
                card,
                'IMPORTANT: Fire Of God Ministries does not receive or store this Recovery Key. If you lose BOTH every trusted device and this Recovery Key, your existing Journal entries cannot be recovered. You may reset Private Journal and start again, but resetting permanently removes the previous Journal entries and creates a new Recovery Key.'
            );

            const code =
                root.document
                    .createElement(
                        'div'
                    );

            code.textContent =
                recoveryCode;

            Object.assign(
                code.style,
                {
                    fontFamily:
                        'monospace',
                    overflowWrap:
                        'anywhere',
                    padding:
                        '14px',
                    margin:
                        '14px 0',
                    border:
                        '1px solid #CBD5E1',
                    borderRadius:
                        '10px',
                    background:
                        '#F8FAFC',
                    userSelect:
                        'all'
                }
            );

            card.appendChild(code);

            const copy =
                button(
                    'Copy Recovery Key'
                );

            const copyStatus =
                root.document
                    .createElement(
                        'span'
                    );

            copyStatus.style.marginLeft =
                '10px';

            copy.addEventListener(
                'click',
                async () => {
                    try {
                        await root.navigator
                            .clipboard
                            .writeText(
                                recoveryCode
                            );

                        copyStatus.textContent =
                            'Copied';
                    } catch (error) {
                        copyStatus.textContent =
                            'Select and copy the key above manually.';
                    }
                }
            );

            card.appendChild(copy);
            card.appendChild(
                copyStatus
            );

            const acknowledgement =
                root.document
                    .createElement(
                        'label'
                    );

            Object.assign(
                acknowledgement.style,
                {
                    display:
                        'flex',
                    gap:
                        '10px',
                    alignItems:
                        'flex-start',
                    marginTop:
                        '20px'
                }
            );

            const checkbox =
                root.document
                    .createElement(
                        'input'
                    );

            checkbox.type =
                'checkbox';

            const checkText =
                root.document
                    .createElement(
                        'span'
                    );

            checkText.textContent =
                'I understand that I must keep this Recovery Key safe, and that losing both my trusted device and Recovery Key means my existing Journal cannot be recovered.';

            acknowledgement
                .append(
                    checkbox,
                    checkText
                );

            card.appendChild(
                acknowledgement
            );

            const actions =
                root.document
                    .createElement(
                        'div'
                    );

            Object.assign(
                actions.style,
                {
                    display:
                        'flex',
                    gap:
                        '10px',
                    justifyContent:
                        'flex-end',
                    marginTop:
                        '22px'
                }
            );

            const cancel =
                button(
                    'Not Now'
                );

            const continueButton =
                button(
                    'Continue',
                    true
                );

            continueButton.disabled =
                true;

            checkbox.addEventListener(
                'change',
                () => {
                    continueButton.disabled =
                        !checkbox.checked;
                }
            );

            actions.append(
                cancel,
                continueButton
            );

            card.appendChild(actions);

            root.document.body
                .appendChild(
                    overlay
                );

            return new Promise(
                resolve => {
                    const finish =
                        value => {
                            overlay.remove();
                            resolve(value);
                        };

                    cancel.addEventListener(
                        'click',
                        () =>
                            finish(false)
                    );

                    continueButton
                        .addEventListener(
                            'click',
                            () =>
                                finish(true)
                        );
                }
            );
        }

        async function requestRecoveryKey() {
            const {
                overlay,
                card
            } =
                createOverlay(
                    'Unlock Your Private Journal'
                );

            appendParagraph(
                card,
                'This browser does not have your Journal key. Enter the Recovery Key you saved when Private Journal was first protected.'
            );

            const input =
                root.document
                    .createElement(
                        'input'
                    );

            input.type =
                'text';

            input.autocomplete =
                'off';

            input.spellcheck =
                false;

            input.placeholder =
                'FOG-JR1-…';

            input.className =
                'form-control';

            input.setAttribute(
                'aria-label',
                'Journal Recovery Key'
            );

            card.appendChild(input);

            const actions =
                root.document
                    .createElement(
                        'div'
                    );

            Object.assign(
                actions.style,
                {
                    display:
                        'flex',
                    gap:
                        '10px',
                    justifyContent:
                        'flex-end',
                    marginTop:
                        '20px'
                }
            );

            const lostRecovery =
                button(
                    'I lost my Recovery Key'
                );

            lostRecovery.style.marginRight =
                'auto';

            lostRecovery.style.color =
                '#7A2E2E';

            lostRecovery.style.borderColor =
                '#C98A7A';

            const cancel =
                button(
                    'Cancel'
                );

            const unlock =
                button(
                    'Unlock Journal',
                    true
                );

            actions.style.flexWrap =
                'wrap';

            actions.append(
                lostRecovery,
                cancel,
                unlock
            );

            card.appendChild(actions);

            root.document.body
                .appendChild(
                    overlay
                );

            input.focus();

            return new Promise(
                resolve => {
                    const finish =
                        value => {
                            input.value =
                                '';

                            overlay.remove();

                            resolve(value);
                        };

                    lostRecovery
                        .addEventListener(
                            'click',
                            () =>
                                finish(
                                    JOURNAL_RESET_REQUEST
                                )
                        );

                    cancel.addEventListener(
                        'click',
                        () =>
                            finish(null)
                    );

                    unlock.addEventListener(
                        'click',
                        () => {
                            const value =
                                input.value
                                    .trim();

                            if (!value) {
                                return;
                            }

                            finish(value);
                        }
                    );

                    input.addEventListener(
                        'keydown',
                        event => {
                            if (
                                event.key ===
                                'Enter'
                            ) {
                                unlock.click();
                            }
                        }
                    );
                }
            );
        }


        async function requestResponsibleUseAcknowledgement(
            status
        ) {
            const {
                overlay,
                card
            } =
                createOverlay(
                    'Use your Journal wisely'
                );

            appendParagraph(
                card,
                'Private Journal is a personal space for prayer, reflection, gratitude, questions, and growth. Your entries are encrypted on your device before they are saved.'
            );

            appendParagraph(
                card,
                'Please don’t use your Journal to store passwords, PINs, account numbers, access codes, home addresses, private security information, or other information that could put you or someone else at risk.'
            );

            appendParagraph(
                card,
                'If something is serious, unsafe, or you need help, talk with a parent, guardian, trusted adult, or appropriate ministry leader rather than relying only on your Journal.'
            );

            const acknowledgement =
                root.document
                    .createElement(
                        'label'
                    );

            acknowledgement.className =
                'journal-family-check';

            const checkbox =
                root.document
                    .createElement(
                        'input'
                    );

            checkbox.type =
                'checkbox';

            const checkText =
                root.document
                    .createElement(
                        'span'
                    );

            checkText.textContent =
                'I understand and will use Private Journal responsibly.';

            acknowledgement.append(
                checkbox,
                checkText
            );

            card.appendChild(
                acknowledgement
            );

            const feedback =
                appendParagraph(
                    card,
                    ''
                );

            feedback.setAttribute(
                'role',
                'status'
            );

            const actions =
                root.document
                    .createElement(
                        'div'
                    );

            Object.assign(
                actions.style,
                {
                    display:
                        'flex',
                    gap:
                        '10px',
                    justifyContent:
                        'flex-end',
                    marginTop:
                        '20px'
                }
            );

            const cancel =
                button('Not Now');

            const accept =
                button(
                    'I Understand and Continue',
                    true
                );

            accept.disabled =
                true;

            checkbox.addEventListener(
                'change',
                () => {
                    accept.disabled =
                        !checkbox.checked;
                }
            );

            actions.append(
                cancel,
                accept
            );

            card.appendChild(actions);
            root.document.body
                .appendChild(overlay);

            return new Promise(
                resolve => {
                    let finished =
                        false;

                    const finish = value => {
                        if (finished) {
                            return;
                        }

                        finished =
                            true;
                        overlay.remove();
                        resolve(value);
                    };

                    cancel.addEventListener(
                        'click',
                        () => finish(false)
                    );

                    accept.addEventListener(
                        'click',
                        async () => {
                            if (
                                accept.disabled ||
                                !checkbox.checked
                            ) {
                                return;
                            }

                            accept.disabled =
                                true;
                            cancel.disabled =
                                true;
                            feedback.textContent =
                                'Saving your acknowledgement…';

                            try {
                                const response =
                                    await apiFetch(
                                        '/api/journal-security/responsible-use-acknowledgement',
                                        {
                                            method:
                                                'POST',
                                            headers: {
                                                'Content-Type':
                                                    'application/json'
                                            },
                                            body:
                                                JSON.stringify({
                                                    acknowledged:
                                                        true,
                                                    policy_version:
                                                        status.responsible_use_policy_version
                                                })
                                        }
                                    );

                                await parseJsonResponse(
                                    response,
                                    'Unable to save the acknowledgement.'
                                );

                                finish(true);
                            } catch (error) {
                                feedback.textContent =
                                    error.message ||
                                    'Unable to save the acknowledgement.';
                                accept.disabled =
                                    false;
                                cancel.disabled =
                                    false;
                            }
                        }
                    );
                }
            );
        }

        async function configureNewJournalOnce(
            ownerId
        ) {
            const crypto =
                getCryptoApi();

            /*
             * A stale local key with no server envelope must
             * never be silently reused.
             */
            try {
                await crypto
                    .deleteDeviceKey(
                        ownerId
                    );
            } catch (error) {
                // Safe to continue.
            }

            const setup =
                await crypto
                    .createJournalSetup(
                        ownerId
                    );

            const acknowledged =
                await showRecoveryKeyOnce(
                    setup.recoveryCode
                );

            if (!acknowledged) {
                throw new Error(
                    'Private Journal setup was cancelled. No journal entry was saved.'
                );
            }

            /*
             * Upload ONLY the wrapped master-key envelope.
             * recoveryCode never enters this request.
             */
            await saveEnvelope(
                setup.envelope
            );

            try {
                await crypto
                    .saveDeviceKey(
                        ownerId,
                        setup.masterKey,
                        setup.envelope
                            .key_fingerprint
                    );
            } catch (error) {
                throw new Error(
                    'Your Journal protection was created, but this browser could not remember the device key. Use the Recovery Key you just saved to unlock the Journal.'
                );
            }

            rememberMasterKey(
                ownerId,
                setup.masterKey,
                setup.envelope
                    .key_fingerprint
            );

            return setup.masterKey;
        }


        function configureNewJournal(
            ownerId
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            if (
                setupPromises.has(
                    canonicalOwner
                )
            ) {
                return setupPromises.get(
                    canonicalOwner
                );
            }

            const setupPromise =
                configureNewJournalOnce(
                    canonicalOwner
                )
                    .finally(
                        () => {
                            setupPromises.delete(
                                canonicalOwner
                            );
                        }
                    );

            setupPromises.set(
                canonicalOwner,
                setupPromise
            );

            return setupPromise;
        }


        async function confirmJournalReset() {
            const {
                overlay,
                card
            } =
                createOverlay(
                    'Reset Private Journal?'
                );

            appendParagraph(
                card,
                'Use this only if you no longer have a trusted device AND you have lost your Recovery Key.'
            );

            appendParagraph(
                card,
                'Resetting Private Journal permanently removes your existing Journal entries and the old Journal key. They cannot be recovered after this reset.'
            );

            appendParagraph(
                card,
                'After the reset, you will automatically go through the current permission or responsible-use process again if required, then receive a brand-new Recovery Key.'
            );

            const instruction =
                root.document
                    .createElement(
                        'p'
                    );

            instruction.textContent =
                'Type RESET MY JOURNAL below to continue.';

            instruction.style.fontWeight =
                '700';

            instruction.style.marginTop =
                '18px';

            card.appendChild(
                instruction
            );

            const confirmation =
                root.document
                    .createElement(
                        'input'
                    );

            confirmation.type =
                'text';

            confirmation.autocomplete =
                'off';

            confirmation.spellcheck =
                false;

            confirmation.placeholder =
                'RESET MY JOURNAL';

            confirmation.className =
                'form-control';

            confirmation.setAttribute(
                'aria-label',
                'Type RESET MY JOURNAL to confirm permanent Journal reset'
            );

            card.appendChild(
                confirmation
            );

            const actions =
                root.document
                    .createElement(
                        'div'
                    );

            Object.assign(
                actions.style,
                {
                    display:
                        'flex',

                    gap:
                        '10px',

                    justifyContent:
                        'flex-end',

                    flexWrap:
                        'wrap',

                    marginTop:
                        '20px'
                }
            );

            const cancel =
                button(
                    'Cancel'
                );

            const reset =
                button(
                    'Permanently Reset Journal',
                    true
                );

            reset.disabled =
                true;

            Object.assign(
                reset.style,
                {
                    background:
                        '#7A2E2E',

                    borderColor:
                        '#7A2E2E',

                    color:
                        '#FFFFFF'
                }
            );

            actions.append(
                cancel,
                reset
            );

            card.appendChild(
                actions
            );

            root.document.body
                .appendChild(
                    overlay
                );

            confirmation.focus();

            return new Promise(
                resolve => {
                    const finish =
                        value => {
                            confirmation.value =
                                '';

                            overlay.remove();

                            resolve(value);
                        };

                    const refresh =
                        () => {
                            reset.disabled =
                                confirmation
                                    .value
                                    .trim() !==
                                'RESET MY JOURNAL';
                        };

                    confirmation
                        .addEventListener(
                            'input',
                            refresh
                        );

                    cancel
                        .addEventListener(
                            'click',
                            () =>
                                finish(false)
                        );

                    reset
                        .addEventListener(
                            'click',
                            () => {
                                if (
                                    confirmation
                                        .value
                                        .trim() !==
                                    'RESET MY JOURNAL'
                                ) {
                                    return;
                                }

                                finish(true);
                            }
                        );
                }
            );
        }


        async function resetJournalAfterLostRecovery(
            ownerId
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            const confirmed =
                await confirmJournalReset();

            if (!confirmed) {
                return false;
            }

            const response =
                await apiFetch(
                    '/api/journal-security/reset',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                confirmation:
                                    'RESET MY JOURNAL',

                                understands_data_loss:
                                    true
                            })
                    }
                );

            await parseJsonResponse(
                response,
                'Private Journal could not be reset.'
            );

            const crypto =
                getCryptoApi();

            try {
                await crypto
                    .deleteDeviceKey(
                        canonicalOwner
                    );
            } catch (error) {
                /*
                 * Server reset has already completed.
                 * Continue by clearing all in-memory state.
                 */
            }

            memoryKeys.delete(
                canonicalOwner
            );

            memoryFingerprints.delete(
                canonicalOwner
            );

            setupPromises.delete(
                canonicalOwner
            );

            latestAccessStatus =
                null;

            return true;
        }


        async function recoverJournalOnDeviceOnce(
            ownerId,
            status
        ) {
            const crypto =
                getCryptoApi();

            const response =
                await loadEnvelope();

            if (
                !response ||
                response.configured !==
                    true ||
                !response.envelope
            ) {
                throw new Error(
                    'Journal recovery information is unavailable.'
                );
            }

            const recoveryCode =
                await requestRecoveryKey();

            if (
                recoveryCode ===
                JOURNAL_RESET_REQUEST
            ) {
                const resetCompleted =
                    await resetJournalAfterLostRecovery(
                        ownerId
                    );

                if (resetCompleted) {
                    return JOURNAL_RESET_COMPLETED;
                }

                throw new Error(
                    'Private Journal remains locked on this device.'
                );
            }

            if (!recoveryCode) {
                throw new Error(
                    'Private Journal remains locked on this device.'
                );
            }

            let recovered;

            try {
                recovered =
                    await crypto
                        .recoverMasterKey(
                            ownerId,
                            recoveryCode,
                            response.envelope
                        );
            } finally {
                /*
                 * The local variable is released after this
                 * call and is never persisted by the Portal.
                 */
            }

            if (
                status.key_fingerprint &&
                recovered.keyFingerprint !==
                    status.key_fingerprint
            ) {
                throw new Error(
                    'The Recovery Key does not match this Private Journal.'
                );
            }

            await crypto
                .saveDeviceKey(
                    ownerId,
                    recovered.masterKey,
                    recovered.keyFingerprint
                );

            rememberMasterKey(
                ownerId,
                recovered.masterKey,
                recovered.keyFingerprint
            );

            return recovered.masterKey;
        }

        function recoverJournalOnDevice(
            ownerId,
            status
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            if (
                recoveryPromises.has(
                    canonicalOwner
                )
            ) {
                return recoveryPromises.get(
                    canonicalOwner
                );
            }

            const recoveryPromise =
                recoverJournalOnDeviceOnce(
                    canonicalOwner,
                    status
                )
                    .finally(
                        () => {
                            recoveryPromises.delete(
                                canonicalOwner
                            );
                        }
                    );

            recoveryPromises.set(
                canonicalOwner,
                recoveryPromise
            );

            return recoveryPromise;
        }


        async function ensureMigrationMasterKey(
            ownerId,
            status
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            if (
                !status ||
                status.migration_only !==
                    true
            ) {
                throw new Error(
                    'Legacy Journal migration is not available.'
                );
            }

            if (
                memoryKeys.has(
                    canonicalOwner
                ) &&
                memoryFingerprints.has(
                    canonicalOwner
                )
            ) {
                return memoryKeys.get(
                    canonicalOwner
                );
            }

            if (
                setupPromises.has(
                    canonicalOwner
                )
            ) {
                return setupPromises.get(
                    canonicalOwner
                );
            }

            if (
                recoveryPromises.has(
                    canonicalOwner
                )
            ) {
                return recoveryPromises.get(
                    canonicalOwner
                );
            }

            const crypto =
                getCryptoApi();

            if (
                status.device_setup_required
            ) {
                return configureNewJournal(
                    canonicalOwner
                );
            }

            let localRecord =
                null;

            try {
                localRecord =
                    await crypto
                        .loadDeviceKey(
                            canonicalOwner
                        );

            } catch (error) {
                localRecord =
                    null;
            }

            if (
                localRecord &&
                localRecord.key &&
                localRecord.fingerprint &&
                localRecord.fingerprint ===
                    status.key_fingerprint
            ) {
                rememberMasterKey(
                    canonicalOwner,
                    localRecord.key,
                    localRecord.fingerprint
                );

                return localRecord.key;
            }

            const recoveryResult =
                await recoverJournalOnDevice(
                    canonicalOwner,
                    status
                );

            if (
                recoveryResult ===
                JOURNAL_RESET_COMPLETED
            ) {
                return ensureMasterKey(
                    canonicalOwner
                );
            }

            return recoveryResult;
        }


async function ensureMasterKey(
            ownerId
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            if (
                memoryKeys.has(
                    canonicalOwner
                )
            ) {
                return memoryKeys.get(
                    canonicalOwner
                );
            }

            /*
             * Journal setup/recovery is interactive. If another
             * Journal load already started one of those flows,
             * join it instead of opening another dialog.
             */
            if (
                setupPromises.has(
                    canonicalOwner
                )
            ) {
                return setupPromises.get(
                    canonicalOwner
                );
            }

            if (
                recoveryPromises.has(
                    canonicalOwner
                )
            ) {
                return recoveryPromises.get(
                    canonicalOwner
                );
            }

            let status =
                await loadStatus();

            let decision =
                accessDecision(
                    status
                );

            if (
                !decision.allowed &&
                decision.code ===
                    'responsible_use_acknowledgement_required'
            ) {
                const acknowledged =
                    await requestResponsibleUseAcknowledgement(
                        status
                    );

                if (acknowledged) {
                    status =
                        await loadStatus();

                    decision =
                        accessDecision(
                            status
                        );
                }
            }

            if (
                !decision.allowed &&
                decision.code ===
                    'guardian_required' &&
                root &&
                root.FOGJournalGuardianUI &&
                typeof root
                    .FOGJournalGuardianUI
                    .requestYouthAuthorization ===
                    'function'
            ) {
                const authorized =
                    await root
                        .FOGJournalGuardianUI
                        .requestYouthAuthorization(
                            status
                        );

                if (authorized) {
                    status =
                        await loadStatus();

                    decision =
                        accessDecision(
                            status
                        );
                }
            }

            if (!decision.allowed) {
                throw new Error(
                    decision.message
                );
            }

            const crypto =
                getCryptoApi();

            if (
                status.device_setup_required
            ) {
                return configureNewJournal(
                    canonicalOwner
                );
            }

            let localRecord =
                null;

            try {
                localRecord =
                    await crypto
                        .loadDeviceKey(
                            canonicalOwner
                        );

            } catch (error) {
                localRecord =
                    null;
            }

            if (
                localRecord &&
                localRecord.key &&
                localRecord.fingerprint &&
                localRecord.fingerprint ===
                    status.key_fingerprint
            ) {
                rememberMasterKey(
                    canonicalOwner,
                    localRecord.key,
                    localRecord.fingerprint
                );

                return localRecord.key;
            }

            const recoveryResult =
                await recoverJournalOnDevice(
                    canonicalOwner,
                    status
                );

            if (
                recoveryResult ===
                JOURNAL_RESET_COMPLETED
            ) {
                return ensureMasterKey(
                    canonicalOwner
                );
            }

            return recoveryResult;
        }

        async function getRawEntries(
            ownerId
        ) {
            const response =
                await apiFetch(
                    `/api/journals/${canonicalOwnerId(ownerId)}`
                );

            const body =
                await parseJsonResponse(
                    response,
                    'Unable to load Private Journal.'
                );

            if (!Array.isArray(body)) {
                throw new Error(
                    'Private Journal returned an invalid response.'
                );
            }

            return body;
        }

        async function getLegacyMigrationEntries(
            ownerId
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            const response =
                await apiFetch(
                    '/api/journal-security/legacy-migration'
                );

            const rows =
                await parseJsonResponse(
                    response,
                    'Unable to load existing Journal entries for privacy protection.'
                );

            if (!Array.isArray(rows)) {
                throw new Error(
                    'Legacy Journal migration data is invalid.'
                );
            }

            return rows.filter(
                row =>
                    row &&
                    row.legacy === true
            );
        }


async function migrateLegacyEntry(
            ownerId,
            masterKey,
            row
        ) {
            const crypto =
                getCryptoApi();

            const entryUuid =
                crypto.createEntryUuid();

            const encrypted =
                await crypto.encryptEntry(
                    ownerId,
                    masterKey,
                    {
                        entryUuid,
                        title:
                            String(
                                row.title ||
                                ''
                            ),
                        mood:
                            String(
                                row.mood ||
                                ''
                            ),
                        content:
                            String(
                                row.content ||
                                ''
                            )
                    }
                );

            const protectedPayload =
                withKeyFingerprint(
                    ownerId,
                    encrypted
                );

            const response =
                await apiFetch(
                    `/api/journals/${row.id}/migrate`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body:
                            JSON.stringify(
                                protectedPayload
                            )
                    }
                );

            await parseJsonResponse(
                response,
                'Unable to protect an existing Journal entry.'
            );

            return {
                id:
                    row.id,
                entry_uuid:
                    entryUuid,
                title:
                    String(
                        row.title ||
                        ''
                    ),
                mood:
                    String(
                        row.mood ||
                        ''
                    ),
                content:
                    String(
                        row.content ||
                        ''
                    ),
                created_at:
                    row.created_at ||
                    null,
                legacy:
                    false
            };
        }

        async function decryptStoredEntry(
            ownerId,
            masterKey,
            row
        ) {
            const crypto =
                getCryptoApi();

            return crypto.decryptEntry(
                ownerId,
                masterKey,
                row
            );
        }

        async function loadEntries(
            ownerId
        ) {
            const canonicalOwner =
                canonicalOwnerId(
                    ownerId
                );

            const initialStatus =
                await loadStatus();

            /*
             * Existing owners who are currently blocked by
             * age/guardian policy are permitted to protect
             * their old plaintext first.
             *
             * Nothing returned by this migration-only route
             * is handed to the visible Journal renderer.
             */
            if (
                initialStatus &&
                initialStatus.migration_only ===
                    true
            ) {
                const migrationKey =
                    await ensureMigrationMasterKey(
                        canonicalOwner,
                        initialStatus
                    );

                const legacyRows =
                    await getLegacyMigrationEntries(
                        canonicalOwner
                    );

                for (
                    const row of legacyRows
                ) {
                    await migrateLegacyEntry(
                        canonicalOwner,
                        migrationKey,
                        row
                    );
                }

                const refreshed =
                    await loadStatus();

                const decision =
                    accessDecision(
                        refreshed
                    );

                throw new Error(
                    'Your existing Journal reflections were protected successfully. ' +
                    (
                        decision.message ||
                        'Complete the required Journal access step before viewing them.'
                    )
                );
            }

            const masterKey =
                await ensureMasterKey(
                    canonicalOwner
                );

            const rows =
                await getRawEntries(
                    canonicalOwner
                );

            const entries = [];

            for (const row of rows) {
                if (
                    row &&
                    row.legacy === true
                ) {
                    entries.push(
                        await migrateLegacyEntry(
                            canonicalOwner,
                            masterKey,
                            row
                        )
                    );

                    continue;
                }

                entries.push(
                    await decryptStoredEntry(
                        canonicalOwner,
                        masterKey,
                        row
                    )
                );
            }

            return entries;
        }

        function getInputValue(id) {
            const element =
                root.document &&
                root.document
                    .getElementById(
                        id
                    );

            return element
                ? String(
                    element.value ||
                    ''
                )
                : '';
        }

        function showUserMessage(
            message
        ) {
            if (
                root &&
                typeof root.alert ===
                    'function'
            ) {
                root.alert(message);
            }
        }

        async function saveJournal(
            event
        ) {
            if (
                event &&
                typeof event.preventDefault ===
                    'function'
            ) {
                event.preventDefault();
            }

            const ownerId =
                currentOwnerId();

            const masterKey =
                await ensureMasterKey(
                    ownerId
                );

            const crypto =
                getCryptoApi();

            const encrypted =
                await crypto.encryptEntry(
                    ownerId,
                    masterKey,
                    {
                        entryUuid:
                            crypto
                                .createEntryUuid(),
                        title:
                            getInputValue(
                                'journalTitle'
                            ),
                        mood:
                            getInputValue(
                                'journalMood'
                            ),
                        content:
                            getInputValue(
                                'journalContent'
                            )
                    }
                );

            const protectedPayload =
                withKeyFingerprint(
                    ownerId,
                    encrypted
                );

            const response =
                await apiFetch(
                    '/api/journals',
                    {
                        method:
                            'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body:
                            JSON.stringify(
                                protectedPayload
                            )
                    }
                );

            await parseJsonResponse(
                response,
                'Unable to save your protected Journal entry.'
            );

            const form =
                root.document &&
                root.document
                    .getElementById(
                        'journalForm'
                    );

            if (
                form &&
                typeof form.reset ===
                    'function'
            ) {
                form.reset();
            }

            if (
                root.V2Discipleship &&
                typeof root
                    .V2Discipleship
                    .loadJournals ===
                    'function'
            ) {
                await root
                    .V2Discipleship
                    .loadJournals();
            }

            if (
                root.V6Gamification &&
                typeof root
                    .V6Gamification
                    .loadMyPoints ===
                    'function'
            ) {
                root
                    .V6Gamification
                    .loadMyPoints();
            }
        }

        function openEditJournalModal(
            id
        ) {
            const discipleship =
                root.V2Discipleship;

            const entry =
                discipleship &&
                Array.isArray(
                    discipleship
                        .journalsData
                )
                    ? discipleship
                        .journalsData
                        .find(
                            item =>
                                Number(
                                    item.id
                                ) ===
                                Number(id)
                        )
                    : null;

            if (!entry) {
                showUserMessage(
                    'Journal entry is unavailable.'
                );

                return;
            }

            const fields = {
                editJournalId:
                    entry.id,
                editJournalTitle:
                    entry.title,
                editJournalMood:
                    entry.mood,
                editJournalContent:
                    entry.content
            };

            for (
                const [fieldId, value]
                of Object.entries(fields)
            ) {
                const field =
                    root.document
                        .getElementById(
                            fieldId
                        );

                if (field) {
                    field.value =
                        value == null
                            ? ''
                            : String(
                                value
                            );
                }
            }

            const modal =
                root.document
                    .getElementById(
                        'editJournalModal'
                    );

            if (modal) {
                modal.classList.add(
                    'active'
                );
            }
        }

        function closeEditJournalModal() {
            const modal =
                root.document &&
                root.document
                    .getElementById(
                        'editJournalModal'
                    );

            if (modal) {
                modal.classList.remove(
                    'active'
                );
            }
        }

        async function updateJournal(
            event
        ) {
            if (
                event &&
                typeof event.preventDefault ===
                    'function'
            ) {
                event.preventDefault();
            }

            const ownerId =
                currentOwnerId();

            const id =
                Number(
                    getInputValue(
                        'editJournalId'
                    )
                );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                throw new Error(
                    'Journal entry is unavailable.'
                );
            }

            const discipleship =
                root.V2Discipleship;

            const existing =
                discipleship &&
                Array.isArray(
                    discipleship
                        .journalsData
                )
                    ? discipleship
                        .journalsData
                        .find(
                            item =>
                                Number(
                                    item.id
                                ) === id
                        )
                    : null;

            if (
                !existing ||
                !existing.entry_uuid
            ) {
                throw new Error(
                    'Journal entry is not ready for secure editing.'
                );
            }

            const masterKey =
                await ensureMasterKey(
                    ownerId
                );

            const encrypted =
                await getCryptoApi()
                    .encryptEntry(
                        ownerId,
                        masterKey,
                        {
                            entryUuid:
                                existing
                                    .entry_uuid,
                            title:
                                getInputValue(
                                    'editJournalTitle'
                                ),
                            mood:
                                getInputValue(
                                    'editJournalMood'
                                ),
                            content:
                                getInputValue(
                                    'editJournalContent'
                                )
                        }
                    );

            const protectedPayload =
                withKeyFingerprint(
                    ownerId,
                    encrypted
                );

            const response =
                await apiFetch(
                    `/api/journals/${id}`,
                    {
                        method:
                            'PUT',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body:
                            JSON.stringify(
                                protectedPayload
                            )
                    }
                );

            await parseJsonResponse(
                response,
                'Unable to update your protected Journal entry.'
            );

            closeEditJournalModal();

            if (
                discipleship &&
                typeof discipleship
                    .loadJournals ===
                    'function'
            ) {
                await discipleship
                    .loadJournals();
            }
        }

        async function deleteJournal(
            id
        ) {
            const entryId =
                Number(id);

            if (
                !Number.isInteger(
                    entryId
                ) ||
                entryId <= 0
            ) {
                return;
            }

            const performDelete =
                async () => {
                    const response =
                        await apiFetch(
                            `/api/journals/${entryId}`,
                            {
                                method:
                                    'DELETE'
                            }
                        );

                    await parseJsonResponse(
                        response,
                        'Unable to delete Journal entry.'
                    );

                    if (
                        root.V2Discipleship &&
                        typeof root
                            .V2Discipleship
                            .loadJournals ===
                            'function'
                    ) {
                        await root
                            .V2Discipleship
                            .loadJournals();
                    }
                };

            if (
                root &&
                typeof root
                    .triggerActionConfirmation ===
                    'function'
            ) {
                return root
                    .triggerActionConfirmation(
                        'Delete this journal entry permanently?',
                        performDelete
                    );
            }

            if (
                !root.confirm ||
                root.confirm(
                    'Delete this journal entry permanently?'
                )
            ) {
                return performDelete();
            }
        }

        function renderFallbackEntries(
            entries
        ) {
            const container =
                root.document &&
                root.document
                    .getElementById(
                        'journalsContainer'
                    );

            if (!container) {
                return;
            }

            container.replaceChildren();

            if (!entries.length) {
                const empty =
                    root.document
                        .createElement(
                            'p'
                        );

                empty.textContent =
                    'No journal entries yet. Your reflections will appear here.';

                container.appendChild(
                    empty
                );

                return;
            }

            for (const entry of entries) {
                const card =
                    root.document
                        .createElement(
                            'article'
                        );

                card.className =
                    'feature-card feature-card--journal';

                const title =
                    root.document
                        .createElement(
                            'h3'
                        );

                title.textContent =
                    entry.title ||
                    'Journal entry';

                const meta =
                    root.document
                        .createElement(
                            'p'
                        );

                meta.textContent =
                    [
                        entry.created_at,
                        entry.mood
                    ]
                        .filter(Boolean)
                        .join(' · ');

                const content =
                    root.document
                        .createElement(
                            'p'
                        );

                content.textContent =
                    entry.content ||
                    '';

                content.style.whiteSpace =
                    'pre-wrap';

                card.append(
                    title,
                    meta,
                    content
                );

                container.appendChild(
                    card
                );
            }
        }

        async function loadJournalFallback() {
            const ownerId =
                currentOwnerId();

            try {
                const entries =
                    await loadEntries(
                        ownerId
                    );

                if (
                    root.V2Discipleship
                ) {
                    root
                        .V2Discipleship
                        .journalsData =
                        entries;
                }

                renderFallbackEntries(
                    entries
                );

                return entries;
            } catch (error) {
                const container =
                    root.document &&
                    root.document
                        .getElementById(
                            'journalsContainer'
                        );

                if (container) {
                    container
                        .replaceChildren();

                    const notice =
                        root.document
                            .createElement(
                                'p'
                            );

                    notice.textContent =
                        error &&
                        error.message
                            ? error.message
                            : 'Private Journal could not be opened safely.';

                    container.appendChild(
                        notice
                    );
                }

                return [];
            }
        }

        function install() {
            const discipleship =
                root &&
                root.V2Discipleship;

            if (!discipleship) {
                return false;
            }

            discipleship.saveJournal =
                async event => {
                    try {
                        return await saveJournal(
                            event
                        );
                    } catch (error) {
                        showUserMessage(
                            error.message ||
                            'Journal could not be saved safely.'
                        );
                    }
                };

            discipleship
                .openEditJournalModal =
                openEditJournalModal;

            discipleship
                .closeEditJournalModal =
                closeEditJournalModal;

            discipleship.updateJournal =
                async event => {
                    try {
                        return await updateJournal(
                            event
                        );
                    } catch (error) {
                        showUserMessage(
                            error.message ||
                            'Journal could not be updated safely.'
                        );
                    }
                };

            discipleship.deleteJournal =
                async id => {
                    try {
                        return await deleteJournal(
                            id
                        );
                    } catch (error) {
                        showUserMessage(
                            error.message ||
                            'Journal could not be deleted.'
                        );
                    }
                };

            return true;
        }

        function clearMemoryKeys() {
            memoryKeys.clear();
            memoryFingerprints.clear();
            setupPromises.clear();
            recoveryPromises.clear();
        }

        if (
            root &&
            typeof root.addEventListener ===
                'function'
        ) {
            root.addEventListener(
                'pagehide',
                clearMemoryKeys
            );
        }

        return Object.freeze({
            install,

            loadStatus,
            loadEntries,

            getExperienceMode:
                () =>
                    latestAccessStatus &&
                    latestAccessStatus
                        .experience_mode
                        ? latestAccessStatus
                            .experience_mode
                        : 'private_journal',

            getLatestAccessStatus:
                () =>
                    latestAccessStatus
                        ? {
                            ...latestAccessStatus
                        }
                        : null,

            saveJournal,
            updateJournal,
            deleteJournal,

            openEditJournalModal,
            closeEditJournalModal,

            loadJournalFallback,
            clearMemoryKeys,

            _testing:
                Object.freeze({
                    accessDecision,
                    canonicalOwnerId,
                    configureNewJournal
                })
        });
    }
);

if (
    typeof window !== 'undefined' &&
    window.FOGJournalSecureController
) {
    window.FOGJournalSecureController
        .install();
}
