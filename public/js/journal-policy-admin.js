(function privateJournalPolicyAdmin(root) {
    'use strict';

    const document = root.document;
    const section = document.getElementById('privateJournalPolicySettings');
    const toggle = document.getElementById('privateJournalTeenGuardianToggle');
    const status = document.getElementById('privateJournalPolicyStatus');
    if (!section || !toggle || !status) return;

    let savedValue = true;
    let loaded = false;

    async function responseJson(response, fallback) {
        let payload = null;
        try { payload = await response.json(); }
        catch (error) { /* Use fallback below. */ }
        if (!response.ok) throw new Error(payload && payload.error ? payload.error : fallback);
        return payload;
    }

    async function loadPolicy() {
        try {
            const response = await root.fetch('/api/admin/private-journal-policy', {
                cache: 'no-store',
                credentials: 'same-origin'
            });
            if (response.status === 401 || response.status === 403) return;
            const policy = await responseJson(response, 'Unable to load the Journal policy.');
            section.hidden = false;
            savedValue = policy.guardian_required_13_17 === true;
            toggle.checked = savedValue;
            loaded = true;
            status.textContent = policy.valid
                ? `Current policy: guardian authorization is ${savedValue ? 'required' : 'not required'} for ages 13–17.`
                : 'The setting was missing or invalid, so the server is safely requiring guardian authorization.';
        } catch (error) {
            status.textContent = error.message;
        }
    }

    toggle.addEventListener('change', async () => {
        if (!loaded) {
            toggle.checked = savedValue;
            return;
        }

        const nextValue = toggle.checked;
        const confirmed = root.confirm(
            'Changing this setting affects Private Journal access for members ages 13–17. Existing encrypted Journal entries are not deleted or exposed.'
        );
        if (!confirmed) {
            toggle.checked = savedValue;
            return;
        }

        toggle.disabled = true;
        status.textContent = 'Saving the safeguarding policy…';
        try {
            const response = await root.fetch('/api/admin/private-journal-policy', {
                method: 'PUT',
                cache: 'no-store',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guardian_required_13_17: nextValue })
            });
            const result = await responseJson(response, 'Unable to change the Journal policy.');
            savedValue = result.guardian_required_13_17 === true;
            toggle.checked = savedValue;
            status.textContent = `Saved. Guardian authorization is ${savedValue ? 'required' : 'not required'} for ages 13–17.`;
        } catch (error) {
            toggle.checked = savedValue;
            status.textContent = error.message;
        } finally {
            toggle.disabled = false;
        }
    });

    loadPolicy();
})(window);
