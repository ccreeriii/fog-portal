(function (root, factory) {
    'use strict';

    const createGrowthEventMappingUI = factory;
    if (typeof module === 'object' && module.exports) {
        module.exports = createGrowthEventMappingUI;
        return;
    }

    root.GrowthEventMappingUI = createGrowthEventMappingUI(root);
    root.GrowthEventMappingUI.install();
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGrowthEventMappingUI(root) {
    'use strict';

    const state = {
        eventId: null,
        series: [],
        tasks: [],
        assignment: null,
        directMappings: [],
        effectiveMappings: [],
        seriesMappings: [],
        loadGeneration: 0,
        seriesLoadGeneration: 0,
        mutationPending: false
    };

    function element(id) {
        return root.document && root.document.getElementById(id);
    }

    function canConfigure() {
        return typeof root.hasPerm === 'function' &&
            root.hasPerm('access_events') && root.hasPerm('edit_entries');
    }

    function setText(id, value) {
        const target = element(id);
        if (target) target.textContent = value == null ? '' : String(value);
    }

    function clear(target) {
        if (target) target.replaceChildren();
    }

    function appendTextElement(parent, tagName, text, className = '') {
        const child = root.document.createElement(tagName);
        if (className) child.className = className;
        child.textContent = text == null ? '' : String(text);
        parent.append(child);
        return child;
    }

    function setStatus(message, kind = 'info') {
        const status = element('growthEventMappingStatus');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.kind = kind;
        status.style.display = message ? 'block' : 'none';
        status.style.color = kind === 'error' ? 'var(--danger)' : 'var(--text-muted)';
    }

    function friendlyError(error, fallback) {
        if (error && (error.status === 401 || error.status === 403)) {
            return 'You do not have permission to configure Growth Journey mappings.';
        }
        return (error && error.message) || fallback;
    }

    async function request(url, options = {}) {
        const response = await root.fetch(url, options);
        let data = null;
        try {
            data = await response.json();
        } catch (_) {
            // A non-JSON failure still receives a safe generic message below.
        }
        if (!response.ok) {
            const error = new Error((data && data.error) || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    function normalizePositiveId(value) {
        const id = Number(value);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    }

    function formationAreaForTask(taskId) {
        const task = state.tasks.find(item => Number(item.id) === Number(taskId));
        const match = task && String(task.task_key || '')
            .match(/^form-(spiritual|community|servanthood|ministry|mission)$/);
        return match ? match[1] : '';
    }

    function mappingSourceLabel(mapping) {
        return mapping && mapping.source_type === 'series'
            ? 'Inherited from Event Series'
            : 'Direct Event Mapping';
    }

    function taskTitle(item) {
        return item.task_title || item.title || item.task_key || 'Growth task';
    }

    function taskPhase(item) {
        return item.phase_title || item.phase_key || 'Not specified';
    }

    function requirementLabel(item) {
        if (item && item.classification) return item.classification;
        if (item && item.task_classification) return item.task_classification;

        const taskId = Number(item && (item.task_id || item.id));
        const task = state.tasks.find(entry => Number(entry.id) === taskId);

        return task && task.classification
            ? task.classification
            : 'Not specified';
    }

    function evidenceLabel(item) {
        return item.evidence_mode || item.task_evidence_type || item.evidence_type || 'attendance';
    }

    function appendMetadata(parent, label, value) {
        const row = root.document.createElement('p');
        row.style.margin = '4px 0';
        const strong = appendTextElement(row, 'strong', `${label}: `);
        strong.style.color = 'var(--text-main)';
        row.append(root.document.createTextNode(String(value == null ? '' : value)));
        parent.append(row);
    }

    function appendMappingCard(parent, mapping, options = {}) {
        const card = root.document.createElement('div');
        card.className = 'growth-mapping-card';
        card.style.cssText = 'border:1px solid var(--border-color); border-radius:8px; padding:12px; margin:8px 0;';

        appendTextElement(card, 'strong', taskTitle(mapping));
        appendMetadata(card, 'Phase', taskPhase(mapping));
        appendMetadata(card, 'Requirement', requirementLabel(mapping));
        appendMetadata(card, 'Evidence', evidenceLabel(mapping));
        appendMetadata(card, 'Status', Number(mapping.is_active) === 0 ? 'Inactive' : 'Active');
        appendMetadata(card, 'Source', options.sourceLabel || mappingSourceLabel(mapping));
        if (mapping.source_type === 'series' && mapping.series_name) {
            appendMetadata(card, 'Event Series', mapping.series_name);
        }

        if (options.actionLabel && typeof options.onAction === 'function') {
            const button = appendTextElement(card, 'button', options.actionLabel, 'btn btn-outline btn-sm');
            button.type = 'button';
            button.dataset.growthMutationControl = 'true';
            button.style.marginTop = '8px';
            button.disabled = state.mutationPending;
            button.addEventListener('click', options.onAction);
        }
        parent.append(card);
    }

    function renderEmpty(container, message) {
        clear(container);
        const empty = appendTextElement(container, 'p', message);
        empty.style.color = 'var(--text-muted)';
        empty.style.margin = '6px 0';
    }

    function renderEffectiveMappings() {
        const container = element('growthEventEffectiveMappings');
        if (!container) return;
        clear(container);
        const uniqueMappings = [];
        const seenTasks = new Set();
        for (const mapping of state.effectiveMappings) {
            const taskId = Number(mapping.task_id);
            if (seenTasks.has(taskId)) continue;
            seenTasks.add(taskId);
            uniqueMappings.push(mapping);
        }
        setText(
            'growthEventContributionSummary',
            uniqueMappings.length
                ? `Yes — this event contributes to ${uniqueMappings.length} Growth task${uniqueMappings.length === 1 ? '' : 's'}.`
                : 'No — this event does not currently contribute to a Growth task.'
        );
        if (!uniqueMappings.length) {
            renderEmpty(container, 'No effective Growth Journey mappings.');
            return;
        }
        for (const mapping of uniqueMappings) appendMappingCard(container, mapping);
    }

    function renderDirectMappings() {
        const container = element('growthEventDirectMappings');
        if (!container) return;
        clear(container);
        if (!state.directMappings.length) {
            renderEmpty(container, 'No direct mappings. Series mappings, if any, remain inherited.');
            return;
        }
        for (const mapping of state.directMappings) {
            const active = Number(mapping.is_active) !== 0;
            appendMappingCard(container, mapping, {
                sourceLabel: 'This Event',
                actionLabel: active ? 'Remove direct mapping' : 'Activate direct mapping',
                onAction: active
                    ? () => removeDirectMapping(mapping.id)
                    : () => activateDirectMapping(mapping.id)
            });
        }
    }

    function appendOption(select, value, label) {
        const option = root.document.createElement('option');
        option.value = value == null ? '' : String(value);
        option.textContent = label;
        select.append(option);
        return option;
    }

    function renderSeriesOptions() {
        const select = element('growthEventSeriesSelect');
        if (!select) return;
        clear(select);
        appendOption(select, '', 'No Event Series');
        const selectedId = state.assignment && normalizePositiveId(state.assignment.id);
        for (const series of state.series) {
            if (!Number(series.is_active) && Number(series.id) !== selectedId) continue;
            appendOption(
                select,
                series.id,
                `${series.name || series.series_key || 'Event Series'}${Number(series.is_active) ? '' : ' (inactive)'}`
            );
        }
        select.value = selectedId ? String(selectedId) : '';

        const managerSelect = element('growthSeriesManagerSelect');
        if (!managerSelect) return;
        const previous = managerSelect.value;
        clear(managerSelect);
        appendOption(managerSelect, '', 'Create new series');
        for (const series of state.series) {
            appendOption(
                managerSelect,
                series.id,
                `${series.name || series.series_key || 'Event Series'}${Number(series.is_active) ? '' : ' (inactive)'}`
            );
        }
        if (state.series.some(series => String(series.id) === previous)) managerSelect.value = previous;
    }

    function renderSelectedTaskMetadata() {
        const select = element('growthEventTaskSelect');
        const container = element('growthEventSelectedTaskMetadata');
        if (!container) return;
        clear(container);
        const selectedId = select && normalizePositiveId(select.value);
        const task = state.tasks.find(item => Number(item.id) === selectedId);
        const addButton = element('addGrowthEventDirectMappingButton');
        if (addButton) addButton.disabled = state.mutationPending || !task;
        if (!task) {
            appendTextElement(container, 'p', state.tasks.length
                ? 'Select a Growth task to review its canonical details.'
                : 'No active Growth tasks are available.');
            return;
        }
        appendMetadata(container, 'Phase', taskPhase(task));
        appendMetadata(container, 'Requirement', requirementLabel(task));
        appendMetadata(container, 'Evidence type', evidenceLabel(task));
        appendMetadata(container, 'Task key', task.task_key || 'Not specified');
    }

    function renderTaskSelect() {
        const select = element('growthEventTaskSelect');
        if (!select) return;
        const previous = select.value;
        clear(select);
        appendOption(select, '', state.tasks.length ? 'Choose an active Growth task' : 'No active Growth tasks available');
        const activeDirectTaskIds = new Set(
            state.directMappings.filter(mapping => Number(mapping.is_active) !== 0).map(mapping => Number(mapping.task_id))
        );
        for (const task of state.tasks) {
            if (activeDirectTaskIds.has(Number(task.id))) continue;
            appendOption(select, task.id, `${task.title || task.task_key} — ${taskPhase(task)}`);
        }
        if (Array.from(select.children).some(option => option.value === previous)) select.value = previous;
        renderSelectedTaskMetadata();
    }

    function setMutationPending(pending) {
        state.mutationPending = Boolean(pending);
        const modal = element('growthEventMappingModal');
        if (!modal || typeof modal.querySelectorAll !== 'function') return;
        for (const control of modal.querySelectorAll('[data-growth-mutation-control]')) {
            control.disabled = state.mutationPending;
        }
    }

    function renderLoadedEvent() {
        setMutationPending(false);
        renderSeriesOptions();
        renderEffectiveMappings();
        renderDirectMappings();
        renderTaskSelect();
        const content = element('growthEventMappingContent');
        if (content) content.style.display = 'block';
        setStatus('');
    }

    function eventTitle(eventId) {
        const events = Array.isArray(root.eventsData) ? root.eventsData : [];
        const event = events.find(item => Number(item.id) === Number(eventId));
        return event ? event.name : `Event ${eventId}`;
    }

    async function openGrowthEventMapping(eventId) {
        const normalizedEventId = normalizePositiveId(eventId);
        if (!normalizedEventId) return;
        updateEntryPoints();
        const generation = ++state.loadGeneration;
        state.eventId = null;
        state.assignment = null;
        state.directMappings = [];
        state.effectiveMappings = [];
        setText('growthEventMappingTitle', eventTitle(normalizedEventId));
        setText('growthEventContributionSummary', 'Loading Growth Journey mappings…');
        renderEmpty(element('growthEventEffectiveMappings'), 'Loading mappings…');
        renderEmpty(element('growthEventDirectMappings'), 'Loading direct mappings…');
        const content = element('growthEventMappingContent');
        if (content) content.style.display = 'none';
        const modal = element('growthEventMappingModal');
        if (modal) modal.classList.add('active');
        const seriesManager = element('growthSeriesManager');
        if (seriesManager) seriesManager.style.display = 'none';
        setStatus('Loading Growth Journey configuration…');

        if (!canConfigure()) {
            setStatus('You do not have permission to configure Growth Journey mappings.', 'error');
            return;
        }

        try {
            const [series, tasks, assignment, mappings] = await Promise.all([
                request('/api/admin/growth/event-series'),
                request('/api/admin/growth/tasks'),
                request(`/api/admin/growth/events/${normalizedEventId}/series`),
                request(`/api/admin/growth/events/${normalizedEventId}/mappings`)
            ]);
            if (generation !== state.loadGeneration) return;
            state.eventId = normalizedEventId;
            state.series = Array.isArray(series) ? series : [];
            state.tasks = Array.isArray(tasks) ? tasks : [];
            state.assignment = assignment && assignment.series ? assignment.series : null;
            state.directMappings = Array.isArray(mappings && mappings.direct_mappings)
                ? mappings.direct_mappings : [];
            state.effectiveMappings = Array.isArray(mappings && mappings.effective_mappings)
                ? mappings.effective_mappings : [];
            renderLoadedEvent();
        } catch (error) {
            if (generation !== state.loadGeneration) return;
            state.eventId = null;
            state.directMappings = [];
            state.effectiveMappings = [];
            setText('growthEventContributionSummary', 'Growth mapping details are unavailable.');
            renderEmpty(element('growthEventEffectiveMappings'), 'No mapping data is being shown.');
            renderEmpty(element('growthEventDirectMappings'), 'No direct mapping data is being shown.');
            setStatus(friendlyError(error, 'Unable to load Growth Journey configuration.'), 'error');
            setMutationPending(false);
        }
    }

    function closeGrowthEventMapping() {
        ++state.loadGeneration;
        ++state.seriesLoadGeneration;
        state.eventId = null;
        state.directMappings = [];
        state.effectiveMappings = [];
        const modal = element('growthEventMappingModal');
        if (modal) modal.classList.remove('active');
        clear(element('growthEventEffectiveMappings'));
        clear(element('growthEventDirectMappings'));
        setStatus('');
    }

    async function runEventMutation(action, successMessage) {
        if (state.mutationPending || !canConfigure()) return;
        const eventId = state.eventId;
        if (!eventId) return;
        setMutationPending(true);
        setStatus('Saving Growth Journey configuration…');
        try {
            await action(eventId);
            if (eventId !== state.eventId) return;
            await openGrowthEventMapping(eventId);
            if (state.eventId === eventId) setStatus(successMessage);
        } catch (error) {
            if (eventId === state.eventId) {
                setStatus(friendlyError(error, 'Unable to save Growth Journey configuration.'), 'error');
                setMutationPending(false);
            }
        }
    }

    function saveEventSeriesAssignment() {
        const select = element('growthEventSeriesSelect');
        const value = select ? select.value : '';
        return runEventMutation(
            eventId => request(`/api/admin/growth/events/${eventId}/series`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ series_id: value ? Number(value) : null })
            }),
            value ? 'Event Series assignment saved.' : 'Event Series assignment removed.'
        );
    }

    function addDirectMapping() {
        if (!canConfigure()) {
            setStatus('You do not have permission to configure Growth Journey mappings.', 'error');
            return;
        }
        const select = element('growthEventTaskSelect');
        const taskId = select && normalizePositiveId(select.value);
        const task = state.tasks.find(item => Number(item.id) === taskId);
        if (!task) {
            setStatus('Choose an active Growth task first.', 'error');
            return;
        }
        const inactive = state.directMappings.find(mapping =>
            Number(mapping.task_id) === taskId && Number(mapping.is_active) === 0);
        return runEventMutation(
            eventId => inactive
                ? request(`/api/admin/growth/event-mappings/${inactive.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: true })
                })
                : request('/api/admin/growth/event-mappings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event_id: eventId,
                        task_id: taskId,
                        evidence_mode: 'attendance',
                        formation_area: formationAreaForTask(taskId)
                    })
                }),
            'Direct Growth task mapping added.'
        );
    }

    function removeDirectMapping(mappingId) {
        if (!canConfigure()) return;
        const id = normalizePositiveId(mappingId);
        if (!id || !state.directMappings.some(mapping => Number(mapping.id) === id)) return;
        return runEventMutation(
            () => request(`/api/admin/growth/event-mappings/${id}`, { method: 'DELETE' }),
            'Direct Growth task mapping removed.'
        );
    }

    function activateDirectMapping(mappingId) {
        if (!canConfigure()) return;
        const id = normalizePositiveId(mappingId);
        if (!id || !state.directMappings.some(mapping => Number(mapping.id) === id)) return;
        return runEventMutation(
            () => request(`/api/admin/growth/event-mappings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: true })
            }),
            'Direct Growth task mapping activated.'
        );
    }

    function renderSeriesTaskChoices(selectedTaskIds) {
        const container = element('growthSeriesTaskList');
        if (!container) return;
        clear(container);
        const selected = new Set((selectedTaskIds || []).map(Number));
        if (!state.tasks.length) {
            renderEmpty(container, 'No active Growth tasks are available.');
            return;
        }
        let phaseKey = null;
        for (const task of state.tasks) {
            if (task.phase_key !== phaseKey) {
                phaseKey = task.phase_key;
                const heading = appendTextElement(container, 'strong', taskPhase(task));
                heading.style.cssText = 'display:block; margin:12px 0 6px; color:var(--primary);';
            }
            const label = root.document.createElement('label');
            label.style.cssText = 'display:flex; gap:8px; align-items:flex-start; margin:6px 0;';
            const input = root.document.createElement('input');
            input.type = 'checkbox';
            input.dataset.growthTaskId = String(task.id);
            input.checked = selected.has(Number(task.id));
            label.append(input);
            appendTextElement(label, 'span', `${task.title || task.task_key} (${task.task_key})`);
            container.append(label);
        }
    }

    function toggleGrowthSeriesManager() {
        const manager = element('growthSeriesManager');
        if (!manager) return;
        manager.style.display = manager.style.display === 'none' ? 'block' : 'none';
        if (manager.style.display === 'block') loadGrowthSeriesEditor();
    }

    function startNewGrowthSeries() {
        const select = element('growthSeriesManagerSelect');
        if (select) select.value = '';
        loadGrowthSeriesEditor();
    }

    async function loadGrowthSeriesEditor() {
        const select = element('growthSeriesManagerSelect');
        const selectedId = select && normalizePositiveId(select.value);
        const generation = ++state.seriesLoadGeneration;
        const series = state.series.find(item => Number(item.id) === selectedId) || null;
        element('growthSeriesId').value = series ? series.id : '';
        element('growthSeriesName').value = series ? series.name : '';
        element('growthSeriesKey').value = series ? series.series_key : '';
        element('growthSeriesDescription').value = series ? (series.description || '') : '';
        element('growthSeriesAudience').value = series ? series.audience : 'all';
        element('growthSeriesActive').checked = series ? Boolean(series.is_active) : true;
        state.seriesMappings = [];
        if (series) {
            try {
                const mappings = await request(`/api/admin/growth/event-series/${series.id}/mappings`);
                if (generation !== state.seriesLoadGeneration) return;
                state.seriesMappings = Array.isArray(mappings) ? mappings : [];
            } catch (error) {
                if (generation !== state.seriesLoadGeneration) return;
                setStatus(friendlyError(error, 'Unable to load Event Series mappings.'), 'error');
            }
        }
        renderSeriesTaskChoices(state.seriesMappings
            .filter(mapping => Number(mapping.is_active) !== 0)
            .map(mapping => mapping.task_id));
    }

    async function syncSeriesMappings(seriesId) {
        const container = element('growthSeriesTaskList');
        const selected = new Set(Array.from(
            container ? container.querySelectorAll('[data-growth-task-id]:checked') : []
        ).map(input => Number(input.dataset.growthTaskId)));
        const byTask = new Map(state.seriesMappings.map(mapping => [Number(mapping.task_id), mapping]));
        for (const [taskId, mapping] of byTask) {
            if (!selected.has(taskId)) {
                await request(`/api/admin/growth/event-mappings/${mapping.id}`, { method: 'DELETE' });
            } else if (Number(mapping.is_active) === 0) {
                await request(`/api/admin/growth/event-mappings/${mapping.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_active: true })
                });
            }
        }
        for (const taskId of selected) {
            if (byTask.has(taskId)) continue;
            await request('/api/admin/growth/event-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    series_id: seriesId,
                    task_id: taskId,
                    evidence_mode: 'attendance',
                    formation_area: formationAreaForTask(taskId)
                })
            });
        }
    }

    async function saveGrowthSeries() {
        if (state.mutationPending || !canConfigure()) return;
        const existingId = normalizePositiveId(element('growthSeriesId').value);
        const name = element('growthSeriesName').value.trim();
        let seriesKey = element('growthSeriesKey').value.trim().toLowerCase();
        if (!seriesKey && name) {
            seriesKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        }
        const payload = {
            series_key: seriesKey,
            name,
            description: element('growthSeriesDescription').value.trim(),
            audience: element('growthSeriesAudience').value,
            is_active: element('growthSeriesActive').checked
        };
        setMutationPending(true);
        setStatus('Saving Event Series…');
        try {
            const saved = await request(
                existingId ? `/api/admin/growth/event-series/${existingId}` : '/api/admin/growth/event-series',
                {
                    method: existingId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
            const seriesId = existingId || normalizePositiveId(saved && saved.id);
            await syncSeriesMappings(seriesId);
            state.series = await request('/api/admin/growth/event-series');
            renderSeriesOptions();
            element('growthSeriesManagerSelect').value = String(seriesId);
            await loadGrowthSeriesEditor();
            setStatus('Event Series saved.');
        } catch (error) {
            setStatus(friendlyError(error, 'Unable to save Event Series.'), 'error');
        } finally {
            setMutationPending(false);
        }
    }

    function updateEntryPoints() {
        const allowed = canConfigure();
        const editButton = element('openGrowthEventMappingFromEditor');
        if (editButton) editButton.style.display = allowed ? 'inline-flex' : 'none';
        const seriesManagerToggle = element('growthSeriesManagerToggle');
        if (seriesManagerToggle) seriesManagerToggle.style.display = allowed ? 'inline-flex' : 'none';
        setText(
            'growthEventEditAccessMessage',
            allowed
                ? 'Configure direct Growth tasks and any inherited Event Series mappings.'
                : 'Growth Journey mapping requires Event access and Edit Entries permission.'
        );
    }

    function openFromEventEditor() {
        const eventIdInput = element('editEvtId');
        const eventId = eventIdInput && normalizePositiveId(eventIdInput.value);
        if (!eventId) {
            setText('growthEventEditAccessMessage', 'Save this event first to configure Growth Journey mappings.');
            return;
        }
        openGrowthEventMapping(eventId);
    }

    function install() {
        root.openGrowthEventMapping = openGrowthEventMapping;
        root.closeGrowthEventMapping = closeGrowthEventMapping;
        root.renderGrowthSelectedTaskMetadata = renderSelectedTaskMetadata;
        root.saveGrowthEventSeriesAssignment = saveEventSeriesAssignment;
        root.addGrowthEventDirectMapping = addDirectMapping;
        root.removeGrowthEventDirectMapping = removeDirectMapping;
        root.toggleGrowthSeriesManager = toggleGrowthSeriesManager;
        root.startNewGrowthSeries = startNewGrowthSeries;
        root.loadGrowthSeriesEditor = loadGrowthSeriesEditor;
        root.saveGrowthSeries = saveGrowthSeries;
        root.openGrowthEventMappingFromEditor = openFromEventEditor;

        const previousApplyPermissions = root.applyGranularPermissions;
        if (typeof previousApplyPermissions === 'function' && !previousApplyPermissions.growthMappingWrapped) {
            const wrapped = function (...args) {
                const result = previousApplyPermissions.apply(this, args);
                updateEntryPoints();
                return result;
            };
            wrapped.growthMappingWrapped = true;
            root.applyGranularPermissions = wrapped;
        }
        updateEntryPoints();
    }

    return {
        install,
        canConfigure,
        openGrowthEventMapping,
        closeGrowthEventMapping,
        renderSelectedTaskMetadata,
        saveEventSeriesAssignment,
        addDirectMapping,
        removeDirectMapping,
        updateEntryPoints,
        mappingSourceLabel,
        _state: state
    };
}));
