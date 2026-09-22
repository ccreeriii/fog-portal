const fs = require('fs');

// 1. Patch Server.js
let s = fs.readFileSync('server.js', 'utf8');
if (!s.includes('ALTER TABLE small_groups ADD COLUMN logo TEXT')) {
    s = s.replace("db.run(`ALTER TABLE small_groups ADD COLUMN points INTEGER DEFAULT 20`, () => {});", "db.run(`ALTER TABLE small_groups ADD COLUMN points INTEGER DEFAULT 20`, () => {});\n    db.run(`ALTER TABLE small_groups ADD COLUMN logo TEXT`, () => {});");
}
if (!s.includes("app.put('/api/journals/:id'")) {
    s = s.replace("app.delete('/api/journals/:id'", "app.put('/api/journals/:id', (req, res) => { db.run(`UPDATE private_journals SET title = ?, mood = ?, content = ? WHERE id = ?`, [req.body.title, req.body.mood, req.body.content, req.params.id], function(err) { res.json({ success: true }); }); });\napp.delete('/api/journals/:id'");
}
if (!s.includes("app.put('/api/prayers/:id'")) {
    s = s.replace("app.post('/api/prayers/:id/intercede'", "app.put('/api/prayers/:id', (req, res) => { db.run(`UPDATE prayer_requests SET title = ?, request = ?, is_anonymous = ? WHERE id = ?`, [req.body.title, req.body.request, req.body.is_anonymous ? 1 : 0, req.params.id], function(err) { res.json({ success: true }); }); });\napp.post('/api/prayers/:id/intercede'");
}
s = s.replace(/app\.post\('\/api\/small-groups',[\s\S]*?function\(err\) \{ res\.json\(\{ success: true \}\); \}\);\s*\}\);/g, "app.post('/api/small-groups', (req, res) => { db.run(`INSERT INTO small_groups (name, leader_id, meeting_schedule, venue, points, logo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, req.body.points || 20, req.body.logo || null, getManilaTime()], function(err) { res.json({ success: true }); }); });");
s = s.replace(/app\.put\('\/api\/small-groups\/:id',[\s\S]*?function\(err\) \{ res\.json\(\{ success: true \}\); \}\);\s*\}\);/g, "app.put('/api/small-groups/:id', (req, res) => { db.run(`UPDATE small_groups SET name=?, leader_id=?, meeting_schedule=?, venue=?, points=?, logo=? WHERE id=?`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, req.body.points || 20, req.body.logo || null, req.params.id], function(err) { res.json({ success: true }); }); });");
fs.writeFileSync('server.js', s);

// 2. Patch Index.html
let html = fs.readFileSync('public/index.html', 'utf8');
if (!html.includes('sgCreateLogo')) {
    html = html.replace(/(<div class="form-group"><label>Group Name \*<\/label><input type="text" id="sgCreateName" class="form-control" required><\/div>)/, "$1\n                    <div class=\"form-group\"><label>Group Logo (Optional)</label><input type=\"file\" id=\"sgCreateLogo\" class=\"form-control\" accept=\"image/*\"></div>");
}
if (!html.includes('editSgLogo')) {
    html = html.replace(/(<div class="form-group"><label>Group Name \*<\/label><input type="text" id="editSgName" class="form-control" required><\/div>)/, "$1\n            <div class=\"form-group\"><label>Group Logo</label><input type=\"file\" id=\"editSgLogo\" class=\"form-control\" accept=\"image/*\"></div>");
}
if (!html.includes('editJournalModal')) {
    html = html.replace(/(<script>\s*if \('serviceWorker' in navigator\))/, `<div id="editJournalModal" class="modal">\n    <div class="modal-content">\n        <span class="close-modal" onclick="V2Discipleship.closeEditJournalModal()" style="float:right; font-size:28px; cursor:pointer;">&times;</span>\n        <h2>Edit Journal Entry</h2>\n        <form onsubmit="V2Discipleship.updateJournal(event)">\n            <input type="hidden" id="editJournalId">\n            <div class="form-group"><label>Title *</label><input type="text" id="editJournalTitle" class="form-control" required></div>\n            <div class="form-group"><label>Mood</label><select id="editJournalMood" class="form-control"><option value="Blessed">Blessed & Grateful</option><option value="Seeking">Seeking Guidance</option><option value="Joyful">Joyful</option><option value="Reflective">Reflective</option></select></div>\n            <div class="form-group"><label>Content *</label><textarea id="editJournalContent" class="form-control" rows="4" required></textarea></div>\n            <button type="submit" class="btn btn-primary" style="width:100%;">Save Changes</button>\n        </form>\n    </div>\n</div>\n\n<div id="editPrayerModal" class="modal">\n    <div class="modal-content">\n        <span class="close-modal" onclick="V2Discipleship.closeEditPrayerModal()" style="float:right; font-size:28px; cursor:pointer;">&times;</span>\n        <h2>Edit Prayer Request</h2>\n        <form onsubmit="V2Discipleship.updatePrayer(event)">\n            <input type="hidden" id="editPrayerId">\n            <div class="form-group"><label>Prayer Title *</label><input type="text" id="editPrayerTitle" class="form-control" required></div>\n            <div class="form-group"><label>Request *</label><textarea id="editPrayerContent" class="form-control" rows="3" required></textarea></div>\n            <div class="form-group"><input type="checkbox" id="editPrayerAnonymous"><label for="editPrayerAnonymous">Anonymous</label></div>\n            <button type="submit" class="btn btn-primary" style="width:100%;">Save Changes</button>\n        </form>\n    </div>\n</div>\n\n$1`);
}
fs.writeFileSync('public/index.html', html);

// 3. Patch app.js
let a = fs.readFileSync('public/js/app.js', 'utf8');
let n = fs.readFileSync('patch_nav.js', 'utf8');
const startIdx = a.indexOf('window.buildNav = function() {');
const endIdx = a.indexOf('window.switchGrowthSubTab = function(tabName) {');
if (startIdx !== -1 && endIdx !== -1) {
    fs.writeFileSync('public/js/app.js', a.substring(0, startIdx) + n + '\n\n' + a.substring(endIdx));
}
console.log('✅ Base Patches Completed!');
