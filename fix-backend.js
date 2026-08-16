const fs = require('fs');

// 1. Patch Server.js
let srv = fs.readFileSync('server.js', 'utf8');

// Fix Inbox GET queries
srv = srv.replace(
    "SELECT title, message, created_at FROM announcements",
    "SELECT id, title, message, author as sender, created_at FROM announcements"
);
srv = srv.replace(
    "SELECT a.title, a.message, a.created_at",
    "SELECT a.id, a.title, a.message, a.author as sender, a.created_at"
);

// Add DELETE route if missing
if (!srv.includes("app.delete('/api/communications/inbox/:id'")) {
    const delRoute = `
app.delete('/api/communications/inbox/:id', (req, res) => {
    const { username } = req.body;
    db.get('SELECT id FROM youth WHERE qr_code = ?', [username], (err, youth) => {
        if (!youth) {
            if (username === 'celsocreeriii@gmail.com') {
                 db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
                 db.run('DELETE FROM user_notifications WHERE announcement_id = ?', [req.params.id]);
                 return res.json({ success: true });
            }
            return res.json({ success: false });
        }
        db.run('DELETE FROM user_notifications WHERE announcement_id = ? AND youth_id = ?', [req.params.id, youth.id], function(err) {
            res.json({ success: true });
        });
    });
});\n`;
    srv = srv.replace("app.get('/api/communications/inbox'", delRoute + "app.get('/api/communications/inbox'");
}
fs.writeFileSync('server.js', srv);

// 2. Patch Index.html Z-Indexes
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/<div id="editMinistryRoleModal" class="modal">/g, '<div id="editMinistryRoleModal" class="modal" style="z-index: 10050;">');
html = html.replace(/<div id="editMinistryModal" class="modal">/g, '<div id="editMinistryModal" class="modal" style="z-index: 10050;">');
html = html.replace(/<div id="editEventModal" class="modal">/g, '<div id="editEventModal" class="modal" style="z-index: 10050;">');
html = html.replace(/<div id="editEventRoleModal" class="modal">/g, '<div id="editEventRoleModal" class="modal" style="z-index: 10050;">');
fs.writeFileSync('public/index.html', html);
console.log("✅ Backend SQL and HTML Z-Indexes successfully patched!");
