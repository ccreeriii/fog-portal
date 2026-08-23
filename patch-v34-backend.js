const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const newRoutesV34 = `
// --- V34: BULLETPROOF MINISTRY ROLE LOGGING ---
app.put('/api/ministries-v34/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.status(404).json({error: 'Not found'});
        const timeNow = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
        const logMsg = role === 'Integration Period' ? 'Application Accepted for Integration Period' : \`Role updated to \${role}\`;
        
        db.run("UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?", [role, sub_role || '', req.params.mappingId], function(err) {
            if(err) return res.status(500).json({error: err.message});
            db.run("INSERT INTO ministry_role_history (ministry_id, youth_id, role, actor, timestamp, intent_message) VALUES (?, ?, ?, ?, ?, ?)",
                [req.params.id, row.youth_id, role, actor || 'Admin', timeNow, logMsg], () => {
                    res.json({success: true});
            });
        });
    });
});

app.get('/api/admin/ministry-logs-v34', (req, res) => {
    db.all(\`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.timestamp DESC\`, [], (err, rows) => { res.json(rows || []); });
});
`;
if (!s.includes('/api/ministries-v34/')) {
    s = s.replace(/app\.listen\(PORT/g, newRoutesV34 + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
