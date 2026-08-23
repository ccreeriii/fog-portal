const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const newRoutes = `
// --- V31: V2 ENDPOINTS FOR FILTERS & ACCEPTANCE LOGS ---
app.get('/api/admin/community-intents-v2', (req, res) => {
    db.all("SELECT id, name, email, profile_picture, account_tier, commitment_intent, commitment_date, commitment_accepted_at, commitment_accepted_by FROM youth WHERE commitment_intent IS NOT NULL ORDER BY commitment_date DESC", [], (err, rows) => { res.json(rows || []); });
});

app.post('/api/admin/community-intents-v2/:id/approve', (req, res) => {
    const { actor } = req.body;
    const timeNow = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
    db.run("UPDATE youth SET account_tier = 'Committed Member', commitment_accepted_at = ?, commitment_accepted_by = ? WHERE id = ?", [timeNow, actor || 'Admin', req.params.id], function(err) { res.json({success:true}); });
});

app.get('/api/youth-v2/:id/tier', (req, res) => {
    db.get("SELECT account_tier FROM youth WHERE id = ?", [req.params.id], (err, row) => { res.json(row || {}); });
});
`;

if (!s.includes('/api/admin/community-intents-v2')) {
    s = s.replace(/app\.listen\(PORT/g, newRoutes + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
