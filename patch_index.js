const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Add Daily Habits Tab Button
if (!html.includes('btnSubAdminHabits')) {
    html = html.replace(
        /(<button id="btnSubAdminGamification"[^>]*>🎯 Gamification<\/button>)/,
        "$1\n            <button id=\"btnSubAdminHabits\" class=\"sub-nav-btn\" onclick=\"V2Discipleship.switchAdminSubTab('habits')\">📖 Daily Habits</button>"
    );
}

// 2. Add Daily Habits Content Panel
if (!html.includes('subTabAdminHabits')) {
    html = html.replace(
        /(<div id="subTabAdminGamification"[^>]*>)/,
        `<div id="subTabAdminHabits" class="discipleship-admin-sub-tab" style="display:none;">
            <div class="card">
                <h2 style="color:#10B981;">📖 Daily Habit Rewards</h2>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: -10px; margin-bottom: 15px;">Set the Growth XP members earn for daily spiritual habits (awarded once per day).</p>
                <form id="habitSettingsForm" onsubmit="V2Discipleship.saveHabitSettings(event)">
                    <div style="display:flex; gap:15px;">
                        <div class="form-group" style="flex:1;">
                            <label>Journal Points (Daily) *</label>
                            <input type="number" id="habitJournalPts" class="form-control" required>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Prayer Points (Daily) *</label>
                            <input type="number" id="habitPrayerPts" class="form-control" required>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%; background: #10B981; border: none;">Save Habit Settings</button>
                </form>
            </div>
        </div>\n$1`
    );
}

// 3. Add Points field to Pathway Form
if (!html.includes('pathCreatePoints')) {
    html = html.replace(
        /(<div class="form-group"><label>Step Order \(Number\) \*<\/label><input type="number" id="pathCreateOrder" class="form-control" required><\/div>)/,
        "$1\n                    <div class=\"form-group\"><label>Points Awarded (Growth XP) *</label><input type=\"number\" id=\"pathCreatePoints\" class=\"form-control\" value=\"50\" required></div>"
    );
}

// 4. Add Points field to Small Groups Form
if (!html.includes('sgCreatePoints')) {
    html = html.replace(
        /(<div class="form-group" style="flex:1;"><label>Venue<\/label><input type="text" id="sgCreateVenue" class="form-control"><\/div>\s*<\/div>)/,
        "$1\n                    <div class=\"form-group\"><label>Points Awarded on Join (Growth XP) *</label><input type=\"number\" id=\"sgCreatePoints\" class=\"form-control\" value=\"20\" required></div>"
    );
}

// 5. Inject Modals before script tags
if (html.indexOf('editPathwayModal') === -1) {
    html = html.replace(
        /(<script>\s*if \('serviceWorker' in navigator\))/,
        `<div id="editPathwayModal" class="modal">
    <div class="modal-content">
        <span class="close-modal" onclick="V2Discipleship.closeEditPathwayModal()" style="float:right; font-size:28px; cursor:pointer;">&times;</span>
        <h2>Edit Milestone</h2>
        <form onsubmit="V2Discipleship.updatePathway(event)">
            <input type="hidden" id="editPathId">
            <div class="form-group"><label>Milestone Title *</label><input type="text" id="editPathTitle" class="form-control" required></div>
            <div class="form-group"><label>Description *</label><textarea id="editPathDesc" class="form-control" rows="2" required></textarea></div>
            <div style="display:flex; gap:15px;">
                <div class="form-group" style="flex:1;"><label>Step Order *</label><input type="number" id="editPathOrder" class="form-control" required></div>
                <div class="form-group" style="flex:1;"><label>Points Awarded *</label><input type="number" id="editPathPoints" class="form-control" required></div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Save Changes</button>
        </form>
    </div>
</div>

<div id="editSmallGroupModal" class="modal">
    <div class="modal-content">
        <span class="close-modal" onclick="V2Discipleship.closeEditSmallGroupModal()" style="float:right; font-size:28px; cursor:pointer;">&times;</span>
        <h2>Edit Small Group</h2>
        <form onsubmit="V2Discipleship.updateSmallGroup(event)">
            <input type="hidden" id="editSgId">
            <div class="form-group"><label>Group Name *</label><input type="text" id="editSgName" class="form-control" required></div>
            <div style="display:flex; gap:15px;">
                <div class="form-group" style="flex:1;"><label>Schedule</label><input type="text" id="editSgSchedule" class="form-control"></div>
                <div class="form-group" style="flex:1;"><label>Venue</label><input type="text" id="editSgVenue" class="form-control"></div>
            </div>
            <div class="form-group"><label>Points Awarded on Join *</label><input type="number" id="editSgPoints" class="form-control" required></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Save Changes</button>
        </form>
    </div>
</div>\n\n$1`
    );
}

fs.writeFileSync('public/index.html', html);
console.log('✅ SUCCESS: Modals and Daily Habits UI securely injected into index.html!');
