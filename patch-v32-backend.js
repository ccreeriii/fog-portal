const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const newRoutesV32 = `
// --- V32: MINISTRY ROLE HISTORY LOGGING ---
app.put('/api/ministries-v2/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.json({success:false, error: 'Mapping not found'});
        
        const youthId = row.youth_id;
        const timeNow = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
        let logMsg = role === 'Integration Period' ? 'Application Accepted for Integration Period' : \`Role updated to \${role}\`;

        // 1. Update active role
        db.run("UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?", [role, sub_role || '', req.params.mappingId], () => {
            // 2. Insert into Historical Ledger
            db.run("INSERT INTO ministry_role_history (ministry_id, youth_id, role, actor, timestamp, intent_message) VALUES (?, ?, ?, ?, ?, ?)",
                [req.params.id, youthId, role, actor || 'Admin', timeNow, logMsg], () => {
                    res.json({success:true});
            });
        });
    });
});

app.get('/api/admin/ministry-logs-v3', (req, res) => {
    db.all(\`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.timestamp DESC\`, [], (err, rows) => { res.json(rows || []); });
});
`;

if (!s.includes('/api/admin/ministry-logs-v3')) {
    s = s.replace(/app\.listen\(PORT/g, newRoutesV32 + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
