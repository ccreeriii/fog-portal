(function guardianGuestPage(root) {
    'use strict';

    const document = root.document;
    const status = document.getElementById('guardianStatus');
    const loading = document.getElementById('guardianLoading');
    const requestPanel = document.getElementById('guardianRequest');
    const revokePanel = document.getElementById('guardianRevoke');
    const completePanel = document.getElementById('guardianComplete');
    const requestForm = document.getElementById('guardianForm');
    const verifyForm = document.getElementById('guardianVerifyForm');
    const emailInput = document.getElementById('guardianEmail');
    let approvalToken = null;
    let managementToken = null;

    function tokenFromHash(name) {
        const source = String(root.location.hash || '').replace(/^#/, '');
        const prefix = `${name}=`;
        if (!source.startsWith(prefix)) return null;
        try { return decodeURIComponent(source.slice(prefix.length)) || null; }
        catch (error) { return null; }
    }

    async function requestJson(url, body) {
        const response = await root.fetch(url, {
            method: 'POST',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        let payload = null;
        try { payload = await response.json(); }
        catch (error) { /* Use the safe fallback below. */ }
        if (!response.ok) throw new Error(payload && payload.error ? payload.error : 'This request could not be completed.');
        return payload;
    }

    function setBusy(button, busy) {
        button.disabled = busy;
        button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }

    function clearSecretFragment() {
        if (
            root.history &&
            typeof root.history.replaceState ===
                'function'
        ) {
            root.history.replaceState(
                null,
                '',
                root.location.pathname
            );
        }
    }

    function showComplete(message, managementLink) {
        loading.hidden = true;
        requestPanel.hidden = true;
        revokePanel.hidden = true;
        completePanel.hidden = false;
        completePanel.className = 'guardian-success';
        completePanel.replaceChildren();
        const copy = document.createElement('p');
        copy.textContent = message;
        completePanel.appendChild(copy);
        if (managementLink) {
            const note = document.createElement('p');
            note.textContent = 'Keep this private management link if you may need to revoke authorization later:';
            const link = document.createElement('a');
            link.className = 'guardian-management-link';
            link.href = managementLink;
            link.textContent = managementLink;
            completePanel.append(note, link);
        }
        status.textContent = '';
    }

    async function loadApproval() {
        approvalToken = tokenFromHash('journal-guardian');
        managementToken = tokenFromHash('journal-guardian-revoke');

        if (managementToken) {
            const result = await requestJson(
                '/api/journal-security/guardian-guest/revoke-preview',
                {
                    management_token:
                        managementToken
                }
            );

            document.getElementById(
                'guardianRevokeSummary'
            ).textContent =
                `Authorization for ${result.authorization.youth_name}, approved as ${String(result.authorization.relationship || 'guardian').replace('_', ' ')}.`;

            loading.hidden = true;
            revokePanel.hidden = false;
            return;
        }

        if (!approvalToken) throw new Error('This guardian approval link is missing or invalid.');
        const result = await requestJson('/api/journal-security/guardian-guest/preview', { approval_token: approvalToken });
        const request = result.request;
        const feature = request.age_bracket === 'AGE_10_12' ? 'Youth Reflection' : 'Private Journal';
        document.getElementById('guardianYouthSummary').textContent = `${request.youth_name} is asking for permission to use the Portal’s protected ${feature} feature.`;
        loading.hidden = true;
        requestPanel.hidden = false;
    }

    requestForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('guardianSendCode');
        setBusy(button, true);
        status.textContent = 'Sending a verification code…';
        try {
            const result = await requestJson('/api/journal-security/guardian-guest/begin-verification', {
                approval_token: approvalToken,
                guardian_email: emailInput.value,
                relationship: document.getElementById('guardianRelationship').value,
                adult_confirmed: document.getElementById('guardianAdult').checked,
                authorized_confirmed: document.getElementById('guardianAuthorized').checked,
                permission_attested: document.getElementById('guardianPermission').checked
            });
            requestForm.hidden = true;
            verifyForm.hidden = false;
            document.getElementById('guardianCodeHelp').textContent = `Enter the code sent to ${result.guardian_email_mask}. It expires shortly.`;
            status.textContent = '';
            document.getElementById('guardianCode').focus();
        } catch (error) {
            status.textContent = error.message;
            setBusy(button, false);
        }
    });

    verifyForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('guardianApprove');
        setBusy(button, true);
        status.textContent = 'Verifying and recording your approval…';
        try {
            const result = await requestJson('/api/journal-security/guardian-guest/verify', {
                approval_token: approvalToken,
                guardian_email: emailInput.value,
                verification_code: document.getElementById('guardianCode').value
            });
            const url = new URL(root.location.href);
            url.hash = `journal-guardian-revoke=${encodeURIComponent(result.management_token)}`;
            showComplete(`Permission confirmed. Thank you—your approval has been recorded. You do not need a Community Portal account. ${result.youth_name} can now reopen the protected reflection feature. This permission does not give anyone access to their private reflections.`, url.toString());
            clearSecretFragment();
        } catch (error) {
            status.textContent = error.message;
            setBusy(button, false);
        }
    });

    document.getElementById('guardianDecline').addEventListener('click', async event => {
        setBusy(event.currentTarget, true);
        status.textContent = 'Recording your decision…';
        try {
            await requestJson('/api/journal-security/guardian-guest/decline', { approval_token: approvalToken });
            showComplete('This request was declined. No Journal entry was opened, changed, or deleted.');
            clearSecretFragment();
        } catch (error) {
            status.textContent = error.message;
            setBusy(event.currentTarget, false);
        }
    });

    document.getElementById('guardianRevokeButton').addEventListener('click', async event => {
        if (!root.confirm('Revoke this guardian authorization? Existing encrypted Journal entries will remain protected and will not be deleted.')) return;
        setBusy(event.currentTarget, true);
        status.textContent = 'Revoking authorization…';
        try {
            await requestJson('/api/journal-security/guardian-guest/revoke', { management_token: managementToken });
            showComplete('Authorization was revoked. When guardian approval is required, normal Journal use is now locked. Existing encrypted entries were not deleted or exposed.');
            clearSecretFragment();
        } catch (error) {
            status.textContent = error.message;
            setBusy(event.currentTarget, false);
        }
    });

    loadApproval().catch(error => {
        loading.textContent = error.message;
        status.textContent = '';
    });
})(window);
