const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

if (!s.includes('/api/youth/:id/commit-v2')) {
    const newRoutes = `
// --- V30: NEW LOGGING & INTEGRATION API ROUTES ---
app.post('/api/youth/:id/commit-v2', (req, res) => {
    const youthId = req.params.id;
    const { actor, intent_message } = req.body;
    db.run(\`UPDATE youth SET account_tier = 'Integration Period', commitment_intent = ?, commitment_date = ? WHERE id = ?\`, [intent_message, getManilaTime(), youthId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.get(\`SELECT permissions FROM users WHERE youth_id = ?\`, [youthId], (err, user) => {
            let perms = [];
            if (user && user.permissions) { try { perms = JSON.parse(user.permissions); } catch(e) {} }
            if (!perms.includes('access_directory')) perms.push('access_directory');
            db.run(\`UPDATE users SET permissions = ? WHERE youth_id = ?\`, [JSON.stringify(perms), youthId], function(err2) {
                logActivity(actor || 'System', 'COMMITMENT_PLEDGE', \`Member ID \${youthId} committed with intent: \${intent_message}\`);
                db.get(\`SELECT * FROM youth WHERE id = ?\`, [youthId], (err3, member) => { res.json({ success: true, member, permissions: perms }); });
            });
        });
    });
});

app.get('/api/admin/community-intents', (req, res) => {
    db.all(\`SELECT id, name, email, profile_picture, account_tier, commitment_intent, commitment_date FROM youth WHERE commitment_intent IS NOT NULL ORDER BY commitment_date DESC\`, [], (err, rows) => { res.json(rows || []); });
});

app.post('/api/admin/community-intents/:id/approve', (req, res) => {
    db.run(\`UPDATE youth SET account_tier = 'Committed Member' WHERE id = ?\`, [req.params.id], function(err) { res.json({success:true}); });
});

app.get('/api/admin/ministry-logs', (req, res) => {
    db.all(\`SELECT mm.*, y.name as applicant_name, y.profile_picture, m.name as ministry_name FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id JOIN ministries m ON mm.ministry_id = m.id ORDER BY mm.assigned_at DESC\`, [], (err, rows) => { res.json(rows || []); });
});
`;
    s = s.replace(/app\.listen\(PORT/g, newRoutes + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
