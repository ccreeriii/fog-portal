const fs = require('fs');
const path = './public/js/app.js';
let js = fs.readFileSync(path, 'utf8');

// Safely locate the broken function boundaries
const startIndex = js.search(/(?:window\.)?setEventViewMode\s*=\s*function\s*\(mode\)\s*\{|function\s+setEventViewMode\s*\(mode\)\s*\{/);
const endIndex = js.search(/(?:window\.)?loadEvents\s*=\s*async\s*function\s*\(\)\s*\{|async\s+function\s+loadEvents\s*\(\)\s*\{/);

if (startIndex !== -1 && endIndex !== -1) {
    const isWindow = js.substring(startIndex, startIndex + 25).includes('window.');
    const prefix = isWindow ? 'window.setEventViewMode = function(mode) {\n' : 'function setEventViewMode(mode) {\n';
    
    const newFunction = prefix + `    eventViewMode = mode;
    const btnList = document.getElementById('viewBtnList');
    const btnGrid = document.getElementById('viewBtnGrid');
    const btnCal = document.getElementById('viewBtnCal');
    const calControls = document.getElementById('calendarControls');

    if (btnList) btnList.classList.toggle('active', mode === 'list');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    if (btnCal) btnCal.classList.toggle('active', mode === 'calendar');
    if (calControls) calControls.style.display = mode === 'calendar' ? 'flex' : 'none';

    const container = document.getElementById('eventsListContainer');
    if (!container) return;

    // FIX 1: Eradicates the infinite loop
    if (!eventsData || eventsData.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No events found. Click Create New Gathering to start.</div>';
        container.className = '';
        return; 
    }

    // FIX 2: Safely handles permissions without causing ReferenceErrors
    const hasEditPerm = typeof window.hasPerm === 'function' ? window.hasPerm('edit_entries') : true;
    const hasDelPerm = typeof window.hasPerm === 'function' ? window.hasPerm('delete_entries') : true;

    if (mode === 'list') {
        container.className = 'events-list-view';
        container.innerHTML = eventsData.map(e => {
            const safeName = e.name || 'Event';
            let linkBadges = '';
            if (e.photos_url) linkBadges += \`<a href="\${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>\`;
            if (e.materials_url) linkBadges += \`<a href="\${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>\`;
            
            return \`
            <div style="border-bottom: 1px solid var(--border-color); padding: 15px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <strong style="cursor: pointer; color: var(--primary); font-size: 1.1rem;" onclick="openAnalyticsModal(\${e.id})">\${safeName}</strong><br>
                    <small style="color: var(--text-muted); font-size: 0.85rem;">📅 \${e.event_date} \${e.time_start ? '@ ' + e.time_start : ''} | 📍 \${e.venue || 'No Location'}</small>
                    \${linkBadges ? \`<div style="margin-top: 8px;">\${linkBadges}</div>\` : ''}
                </div>
                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-primary btn-sm" onclick="openAnalyticsModal(\${e.id})">Details</button>
                    \${hasEditPerm ? \`<button type="button" class="btn btn-secondary btn-sm" style="background:#8e44ad; color:white; border:none;" onclick="openPreregSettings(\${e.id})">Form</button>\` : ''}
                    \${hasEditPerm ? \`<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(\${e.id})">Edit</button>\` : ''}
                    \${hasDelPerm ? \`<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(\${e.id}, '\${safeName.replace(/'/g, "\\\\'")}')">Delete</button>\` : ''}
                </div>
            </div>\`;
        }).join('');
    } else if (mode === 'grid') {
        container.className = 'events-grid-view';
        container.innerHTML = eventsData.map(e => {
            const safeName = e.name || 'Event';
            let linkBadges = '';
            if (e.photos_url) linkBadges += \`<a href="\${e.photos_url}" target="_blank" class="badge badge-orange" style="text-decoration:none; margin-right: 4px;">📷 Photos</a>\`;
            if (e.materials_url) linkBadges += \`<a href="\${e.materials_url}" target="_blank" class="badge badge-blue" style="text-decoration:none;">📁 Materials</a>\`;
            
            return \`
            <div class="event-card">
                \${e.poster ? \`<img src="\${e.poster}" class="event-card-img" style="cursor:pointer;" onclick="openAnalyticsModal(\${e.id})" alt="Poster">\` : \`<div class="event-card-img" style="background: var(--bg-light); border-bottom: 1px solid var(--border-color); cursor:pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.85rem;" onclick="openAnalyticsModal(\${e.id})">Blank Thumbnail</div>\`}
                <div style="padding: 15px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <h3 style="font-size: 1.1rem; margin-bottom: 6px; color: var(--text-main); cursor: pointer;" onclick="openAnalyticsModal(\${e.id})">\${safeName}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">📅 \${e.event_date} \${e.time_start ? '@ ' + e.time_start : ''}<br>📍 \${e.venue || 'No Location'}</p>
                        \${linkBadges ? \`<div style="margin-bottom: 12px;">\${linkBadges}</div>\` : ''}
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 10px;">
                        <button type="button" class="btn btn-primary btn-sm" style="flex: 1;" onclick="openAnalyticsModal(\${e.id})">Details</button>
                        \${hasEditPerm ? \`<button type="button" class="btn btn-secondary btn-sm" style="background:#8e44ad; color:white; border:none;" onclick="openPreregSettings(\${e.id})">Form</button>\` : ''}
                        \${hasEditPerm ? \`<button type="button" class="btn btn-outline btn-sm" onclick="openEditEventModal(\${e.id})">Edit</button>\` : ''}
                        \${hasDelPerm ? \`<button type="button" class="btn btn-danger btn-sm" onclick="triggerDeleteEvent(\${e.id}, '\${safeName.replace(/'/g, "\\\\'")}')">Delete</button>\` : ''}
                    </div>
                </div>
            </div>\`;
        }).join('');
    } else if (mode === 'calendar') {
        if (typeof window.renderCalendarView === 'function') window.renderCalendarView(container);
        else if (typeof renderCalendarView === 'function') renderCalendarView(container);
    }
}
`;
    
    js = js.substring(0, startIndex) + newFunction + '\n\n' + js.substring(endIndex);
    fs.writeFileSync(path, js);
    console.log("✅ SUCCESS: Event rendering logic successfully patched! Broken strings removed and infinite loop prevented.");
} else {
    console.error("❌ ERROR: Could not locate the setEventViewMode function in app.js");
}
