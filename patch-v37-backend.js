const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
let s = fs.readFileSync(serverPath, 'utf8');

const newRoutesV37 = `
// --- V37: PROFILE DETAILS & PRIORITY ENDPOINTS ---
app.put('/api/youth-v37/profile/:id', (req, res) => {
    const { name, email, age, birthday, gender, mobile, address, social_media, parents_name, profile_picture, password } = req.body;
    let query = "UPDATE youth SET name=?, email=?, age=?, birthday=?, gender=?, mobile=?, address=?, social_media=?, parents_name=?";
    let params = [name, email, age, birthday, gender, mobile, address, social_media, parents_name];
    
    if (profile_picture) { query += ", profile_picture=?"; params.push(profile_picture); }
    if (password) { query += ", password=?"; params.push(password); }
    query += " WHERE id=?";
    params.push(req.params.id);

    db.run(query, params, function(err) {
        if(err) return res.status(500).json({success: false, error: err.message});
        db.get("SELECT * FROM youth WHERE id=?", [req.params.id], (err, member) => { res.json({success: true, member}); });
    });
});

app.post('/api/ministries-v37/priority/:mappingId', (req, res) => {
    db.run("UPDATE ministry_members SET is_priority = 0 WHERE youth_id = ?", [req.body.youth_id], () => {
        db.run("UPDATE ministry_members SET is_priority = 1 WHERE id = ?", [req.params.mappingId], () => {
            res.json({success: true});
        });
    });
});
`;

if (!s.includes('/api/youth-v37/profile/')) {
    s = s.replace(/app\.listen\(PORT/g, newRoutesV37 + '\napp.listen(PORT');
    fs.writeFileSync(serverPath, s);
}
