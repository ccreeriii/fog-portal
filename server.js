const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();
// FORCE DISABLE CACHE FOR DEVELOPMENT
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); next(); });
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Standardize GMT+8 Manila Time Engine
const getManilaTime = () => {
    const d = new Date();
    const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    return `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;
};

// Automated Daily Database Backup Engine
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

function runDatabaseBackup() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const backupFile = path.join(backupDir, `fog_community_${dateStr}.db`);

    if (!fs.existsSync(backupFile) && fs.existsSync('./fog_community.db')) {
        try {
            fs.copyFileSync('./fog_community.db', backupFile);
            console.log(`[BACKUP] Auto-backup completed: ${backupFile}`);
        } catch (e) {
            console.error('[BACKUP ERROR]', e);
        }
    }
}
runDatabaseBackup();
setInterval(runDatabaseBackup, 1000 * 60 * 60); // Check every 1 hour

const db = new sqlite3.Database('./fog_community.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to local SQLite database: fog_community.db');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS youth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, age INTEGER, email TEXT, mobile TEXT,
        social_media TEXT, birthday TEXT, parents_name TEXT,
        qr_code TEXT UNIQUE, password TEXT, profile_picture TEXT,
        created_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, event_date TEXT, time_start TEXT, venue TEXT,
        poster TEXT, photos_url TEXT, materials_url TEXT, created_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youth_id INTEGER, event_id INTEGER, is_walkin INTEGER DEFAULT 0,
        checked_in_at DATETIME,
        UNIQUE(youth_id, event_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE, password TEXT, permissions TEXT, youth_id INTEGER,
        created_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT, action TEXT, details TEXT,
        created_at DATETIME
    )`);
    
    // NEW: Pre-registration workflow table
    db.run(`CREATE TABLE IF NOT EXISTS pre_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youth_id INTEGER, event_id INTEGER, created_at DATETIME,
        UNIQUE(youth_id, event_id)
    )`);

    db.run(`ALTER TABLE youth ADD COLUMN profile_picture TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN photos_url TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN materials_url TEXT`, () => {});
    
    // Safely append Pre-registration settings schema to events
    db.run(`ALTER TABLE events ADD COLUMN prereg_banner TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_title TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_info TEXT`, () => {});

    const superadminPermissions = JSON.stringify([
        'access_checkin', 'access_directory', 'access_events',
        'access_attendance', 'edit_attendance', 'access_activity', 'access_permissions'
    ]);
    const regTeamPermissions = JSON.stringify(['access_checkin']);

    db.run(`INSERT OR REPLACE INTO users (username, password, permissions, created_at) VALUES (?, ?, ?, ?)`,
        ['registrationteam', 'JesusisLord', regTeamPermissions, getManilaTime()]
    );

    db.run(`INSERT OR IGNORE INTO users (username, password, permissions, created_at) VALUES (?, ?, ?, ?)`,
        ['celsocreeriii@gmail.com', 'JesusisLord', superadminPermissions, getManilaTime()]
    );
});

function logActivity(username, action, details) {
    db.run(`INSERT INTO activity_logs (username, action, details, created_at) VALUES (?, ?, ?, ?)`,
        [username || 'System', action, details, getManilaTime()]
    );
}

// BACKUP & RESTORE API
app.get('/api/backups', (req, res) => {
    if (!fs.existsSync(backupDir)) return res.json([]);
    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const stats = fs.statSync(path.join(backupDir, f));
            return {
                name: f,
                time: stats.mtime,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB'
            };
        })
        .sort((a, b) => b.time - a.time)
        .slice(0, 10);

    files.forEach(f => {
        f.time = new Date(f.time).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    });
    res.json(files);
});

app.post('/api/backups/restore', (req, res) => {
    const { filename, actor } = req.body;
    const targetFile = path.join(backupDir, filename);
    const currentDb = './fog_community.db';

    if (!fs.existsSync(targetFile)) return res.status(404).json({ error: 'File not found' });

    try {
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const autoBackup = path.join(backupDir, `fog_community_pre_restore_${timeStr}.db`);

        fs.copyFileSync(currentDb, autoBackup);
        logActivity(actor, 'RESTORE_DB', `Restored from ${filename}. Pre-restore saved to ${path.basename(autoBackup)}`);

        db.close((err) => {
            fs.copyFileSync(targetFile, currentDb);
            res.json({ success: true });
            setTimeout(() => { process.exit(0); }, 1000); // Forces PM2 to restart the app safely
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AUTH & LOGIN
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE (username = ? OR username = (SELECT email FROM youth WHERE qr_code = ?)) AND password = ?`, [username, username, password], (err, user) => {
        if (user) {
            const permissions = JSON.parse(user.permissions || '[]');
            logActivity(username, 'LOGIN', 'User logged in');
            if (user.youth_id) {
                db.get(`SELECT * FROM youth WHERE id = ?`, [user.youth_id], (e, member) => {
                    return res.json({ success: true, username: user.username, permissions, member, is_admin: true });
                });
            } else return res.json({ success: true, username: user.username, permissions, member: null, is_admin: true });
            return;
        }

        db.get(`SELECT * FROM youth WHERE (qr_code = ? OR email = ? OR name = ?) AND password = ?`,
            [username, username, username, password], (err2, member) => {
            if (member) {
                logActivity(member.name, 'LOGIN', 'Member logged into profile');
                return res.json({ success: true, username: member.qr_code, permissions: [], member, is_admin: false });
            }
            logActivity(username, 'FAILED_LOGIN', 'Invalid credentials attempt');
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        });
    });
});

app.post('/api/logout', (req, res) => {
    const { username } = req.body;
    logActivity(username, 'LOGOUT', 'User logged out');
    res.json({ success: true });
});

// PROFILE EDIT API
app.put('/api/youth/profile/:id', (req, res) => {
    const { name, age, birthday, social_media, parents_name, password, email, profile_picture, actor } = req.body;
    let sql = `UPDATE youth SET name=?, age=?, birthday=?, social_media=?, parents_name=?, password=?, email=? WHERE id=?`;
    let params = [name, age, birthday, social_media, parents_name, password, email, req.params.id];

    if (profile_picture !== undefined) {
        sql = `UPDATE youth SET name=?, age=?, birthday=?, social_media=?, parents_name=?, password=?, email=?, profile_picture=? WHERE id=?`;
        params = [name, age, birthday, social_media, parents_name, password, email, profile_picture, req.params.id];
    }

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`UPDATE users SET password = ? WHERE youth_id = ?`, [password, req.params.id]);
        logActivity(actor || name, 'UPDATE_PROFILE', `Updated profile details for ID ${req.params.id}`);
        db.get(`SELECT * FROM youth WHERE id = ?`, [req.params.id], (e, member) => {
            res.json({ success: true, member });
        });
    });
});

app.get('/api/users/list', (req, res) => {
    const sql = `SELECT u.id, u.username, u.permissions, u.youth_id, y.name as member_name, y.qr_code as member_code FROM users u LEFT JOIN youth y ON u.youth_id = y.id ORDER BY u.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({
            id: r.id, username: r.username, display_name: r.member_name ? `${r.member_name} (${r.member_code || r.username})` : r.username, permissions: JSON.parse(r.permissions || '[]')
        })));
    });
});

app.put('/api/users/:id/permissions', (req, res) => {
    const { permissions, actor } = req.body;
    const permString = JSON.stringify(permissions || []);
    db.run(`UPDATE users SET permissions = ? WHERE id = ?`, [permString, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(actor, 'UPDATE_PERMISSIONS', `Updated permissions for User ID ${req.params.id}`);
        res.json({ success: true, updated: this.changes });
    });
});

app.post('/api/users', (req, res) => {
    const { actor, username, password, permissions } = req.body;
    const permString = JSON.stringify(permissions || []);
    db.run(`INSERT INTO users (username, password, permissions, created_at) VALUES (?, ?, ?, ?)`,
        [username, password, permString, getManilaTime()],
        function (err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            logActivity(actor, 'CREATE_USER', `Created account '${username}'`);
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.get('/api/activity-logs', (req, res) => {
    db.all(`SELECT * FROM activity_logs ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// DIRECTORY API
app.get('/api/youth', (req, res) => {
    db.all(`SELECT * FROM youth ORDER BY name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/youth/:id/history', (req, res) => {
    const sql = `SELECT a.checked_in_at, a.is_walkin, e.name as event_name, e.event_date FROM attendance a JOIN events e ON a.event_id = e.id WHERE a.youth_id = ? ORDER BY a.checked_in_at DESC`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/youth', (req, res) => {
    const { name, age, email, mobile, social_media, birthday, parents_name, profile_picture, actor } = req.body;
    db.get(`SELECT MAX(id) as maxId FROM youth`, [], (err, row) => {
        const nextId = (row && row.maxId ? row.maxId : 0) + 1;
        const qrCode = `FOG-MEMBER-${String(nextId).padStart(3, '0')}`;
        const defaultUsername = qrCode;
        const defaultPassword = qrCode;

        db.run(`INSERT INTO youth (name, age, email, mobile, social_media, birthday, parents_name, qr_code, password, profile_picture, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, age, email || null, mobile, social_media, birthday, parents_name, qrCode, defaultPassword, profile_picture || null, getManilaTime()],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const youthId = this.lastID;
                db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`, [defaultUsername, defaultPassword, youthId, getManilaTime()]);
                logActivity(actor, 'CREATE_MEMBER', `Registered member '${name}' (${qrCode})`);
                res.json({ id: youthId, qr_code: qrCode, email });
            }
        );
    });
});

app.delete('/api/youth/:id', (req, res) => {
    const { actor } = req.body;
    db.run(`DELETE FROM youth WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`DELETE FROM users WHERE youth_id=?`, [req.params.id]);
        logActivity(actor, 'DELETE_MEMBER', `Deleted member record (ID: ${req.params.id})`);
        res.json({ deleted: this.changes });
    });
});

// EVENTS API
app.get('/api/events', (req, res) => {
    db.all(`SELECT * FROM events ORDER BY event_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/events/:id/analytics', (req, res) => {
    const eventId = req.params.id;
    db.get(`SELECT * FROM events WHERE id = ?`, [eventId], (err, event) => {
        if (err || !event) return res.status(404).json({ error: 'Event not found' });
        
        db.get(`SELECT COUNT(*) as total_youth FROM youth WHERE age IS NOT NULL AND age != ''`, [], (err2, totalYouthRow) => {
            const totalDirectory = totalYouthRow ? totalYouthRow.total_youth : 1;
            
            // Appended y.age so the modal search filter works natively
            const sqlRoster = `SELECT a.id as log_id, a.checked_in_at, a.is_walkin, a.youth_id, y.name, y.age, y.email, y.qr_code, y.profile_picture FROM attendance a JOIN youth y ON a.youth_id = y.id WHERE a.event_id = ? ORDER BY a.checked_in_at DESC`;
            
            db.all(sqlRoster, [eventId], (err3, roster) => {
                if (err3) return res.status(500).json({ error: err3.message });
                
                // Fetch the new Pre-Registration data count
                db.get(`SELECT COUNT(*) as prereg_count FROM pre_registrations WHERE event_id = ?`, [eventId], (err4, preRegRow) => {
                    const totalTurnout = roster.length;
                    const walkins = roster.filter(r => r.is_walkin === 1).length;
                    const checkedInPreRegs = totalTurnout - walkins;
                    const totalPreRegistered = preRegRow ? preRegRow.prereg_count : 0;
                    
                    // Turnout Rate computed strictly via Checked-in Pre-Reg vs Total Pre-Reg
                    let turnoutPercentage = '0.0';
                    if (totalPreRegistered > 0) {
                        turnoutPercentage = ((checkedInPreRegs / totalPreRegistered) * 100).toFixed(1);
                    }

                    res.json({ 
                        event, 
                        totalDirectory, 
                        totalTurnout, 
                        turnoutPercentage, 
                        walkins, 
                        preReg: checkedInPreRegs, 
                        totalPreRegistered, 
                        roster 
                    });
                });
            });
        });
    });
});

app.post('/api/events', (req, res) => {
    const { name, event_date, time_start, venue, poster, photos_url, materials_url, actor } = req.body;
    db.run(`INSERT INTO events (name, event_date, time_start, venue, poster, photos_url, materials_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, event_date, time_start, venue, poster, photos_url, materials_url, getManilaTime()],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logActivity(actor, 'CREATE_EVENT', `Published event '${name}'`);
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/events/:id', (req, res) => {
    const { name, event_date, time_start, venue, poster, photos_url, materials_url, actor } = req.body;
    if (poster !== undefined && poster !== null) {
        db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, poster=?, photos_url=?, materials_url=? WHERE id=?`,
            [name, event_date, time_start, venue, poster, photos_url, materials_url, req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(actor, 'EDIT_EVENT', `Updated event details and poster for '${name}'`);
                res.json({ updated: this.changes });
            }
        );
    } else {
        db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, photos_url=?, materials_url=? WHERE id=?`,
            [name, event_date, time_start, venue, photos_url, materials_url, req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(actor, 'EDIT_EVENT', `Updated details for event '${name}'`);
                res.json({ updated: this.changes });
            }
        );
    }
});

app.delete('/api/events/:id', (req, res) => {
    const { actor } = req.body;
    db.run(`DELETE FROM events WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(actor, 'DELETE_EVENT', `Deleted event record (ID: ${req.params.id})`);
        res.json({ deleted: this.changes });
    });
});

// PRE-REGISTRATION ENDPOINTS (NEW)
app.post('/api/events/:id/prereg-settings', (req, res) => {
    const { banner, title, info, actor } = req.body;
    db.run(`UPDATE events SET prereg_banner = ?, prereg_title = ?, prereg_info = ? WHERE id = ?`,
        [banner, title, info, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            logActivity(actor || 'System', 'UPDATE_PREREG', `Updated pre-registration settings for Event ID ${req.params.id}`);
            res.json({ success: true });
    });
});

app.post('/api/preregister', (req, res) => {
    const { event_id, youth_id } = req.body;
    db.run(`INSERT OR IGNORE INTO pre_registrations (event_id, youth_id, created_at) VALUES (?, ?, ?)`,
        [event_id, youth_id, getManilaTime()], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
    });
});

// CHECK-IN API
app.post('/api/checkin', (req, res) => {
    const { youth_id, event_id, is_walkin, actor, qr_code } = req.body;
    const processCheckin = (targetYouthId) => {
        db.get(`SELECT id FROM attendance WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, row) => {
            if (row) return res.status(400).json({ error: 'Member is ALREADY checked in for this event.' });
            db.run(`INSERT INTO attendance (youth_id, event_id, is_walkin, checked_in_at) VALUES (?, ?, ?, ?)`,
                [targetYouthId, event_id, is_walkin ? 1 : 0, getManilaTime()],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    logActivity(actor, 'CHECK_IN', `Checked in member ID ${targetYouthId}`);
                    db.get(`SELECT name FROM youth WHERE id = ?`, [targetYouthId], (e, y) => {
                        res.json({ success: true, member_name: y ? y.name : 'Member', youth_id: targetYouthId, log_id: this.lastID });
                    });
                }
            );
        });
    };

    if (qr_code) {
        db.get(`SELECT id FROM youth WHERE qr_code = ?`, [qr_code], (err, row) => {
            if (!row) return res.status(404).json({ error: 'Invalid QR Pass Code.' });
            processCheckin(row.id);
        });
    } else if (youth_id) {
        processCheckin(youth_id);
    } else res.status(400).json({ error: 'Missing youth identifier for check-in.' });
});

app.get('/api/attendance/logs', (req, res) => {
    const sql = `SELECT a.id, a.checked_in_at, a.is_walkin, y.name as member_name, e.name as event_name, a.youth_id, a.event_id FROM attendance a JOIN youth y ON a.youth_id = y.id JOIN events e ON a.event_id = e.id ORDER BY a.checked_in_at DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/attendance/:id', (req, res) => {
    const { checked_in_at, is_walkin, actor } = req.body;
    db.run(`UPDATE attendance SET checked_in_at = ?, is_walkin = ? WHERE id = ?`,
        [checked_in_at, is_walkin ? 1 : 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logActivity(actor, 'EDIT_ATTENDANCE', `Modified attendance record ID ${req.params.id}`);
            res.json({ updated: this.changes });
        }
    );
});

app.delete('/api/attendance/:id', (req, res) => {
    const { actor } = req.body;
    db.run(`DELETE FROM attendance WHERE id=?`, [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(actor, 'DELETE_ATTENDANCE', `Removed attendance log ID ${req.params.id}`);
        res.json({ deleted: this.changes });
    });
});

app.get('/api/directory/export', (req, res) => {
    db.all("SELECT * FROM members ORDER BY full_name ASC", [], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            db.all("SELECT * FROM youth ORDER BY name ASC", [], (e, r) => sendCSV(res, r || []));
        } else { sendCSV(res, rows); }
    });
});

function sendCSV(res, rows) {
    let csv = 'Name,Age,Role,Phone,Email,Status\n';
    (rows || []).forEach(r => { csv += `"${r.full_name||r.name||''}","${r.age||''}","${r.role||''}","${r.phone||r.mobile||''}","${r.email||''}","${r.status||''}"\n`; });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=Community_Directory.csv');
    res.status(200).send(csv);
}

app.listen(PORT, () => {
    console.log(`Server running safely on Port ${PORT}`);
});
