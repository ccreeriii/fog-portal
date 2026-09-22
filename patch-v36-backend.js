const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const newRoutesV36 = `
// --- V36: PRECISION ROLE LOGGING ---
app.put('/api/ministries-v36/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id, role as old_role FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.status(404).json({error: 'Not found'});
        
        // Generate precise readable timestamp
        const timeNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
        
        // Format precision log message
        let logMsg = \`Previous role '\${row.old_role || 'None'}' updated to '\${role}'\`;
        if (role === 'Integration Period' && row.old_role !== 'Integration Period') {
            logMsg = \`Application Accepted for Integration Period (Previous: \${row.old_role || 'Applicant'})\`;
        }
        
        db.run("UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?", [role, sub_role || '', req.params.mappingId], function(err) {
            if(err) return res.status(500).json({error: err.message});
            db.run("INSERT INTO ministry_role_history (ministry_id, youth_id, role, actor, timestamp, intent_message) VALUES (?, ?, ?, ?, ?, ?)",
                [req.params.id, row.youth_id, role, actor || 'Admin', timeNow, logMsg], () => {
                    res.json({success: true});
            });
        });
    });
});

app.get('/api/admin/ministry-logs-v36', (req, res) => {
    db.all(\`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.id DESC\`, [], (err, rows) => { res.json(rows || []); });
});
`;

if (!s.includes('/api/ministries-v36/')) {
    s = s.replace(/app\.listen\(PORT/g, newRoutesV36 + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
