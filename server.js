const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, event_date TEXT, time_start TEXT, venue TEXT,
        poster TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        youth_id INTEGER, event_id INTEGER, is_walkin INTEGER DEFAULT 0,
        checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(youth_id, event_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE, password TEXT, permissions TEXT, youth_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT, action TEXT, details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`ALTER TABLE youth ADD COLUMN profile_picture TEXT`, () => {});

    const superadminPermissions = JSON.stringify([
        'access_checkin', 'access_directory', 'access_events',
        'access_attendance', 'edit_attendance', 'access_activity', 'access_permissions'
    ]);
    const regTeamPermissions = JSON.stringify(['access_checkin']);

    db.run(`INSERT OR REPLACE INTO users (username, password, permissions) VALUES (?, ?, ?)`,
        ['registrationteam', 'JesusisLord', regTeamPermissions]
    );

    db.run(`INSERT OR IGNORE INTO users (username, password, permissions) VALUES (?, ?, ?)`,
        ['celsocreeriii@gmail.com', 'JesusisLord', superadminPermissions]
    );
});

function logActivity(username, action, details) {
    db.run(`INSERT INTO activity_logs (username, action, details) VALUES (?, ?, ?)`,
        [username || 'System', action, details]
    );
}

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
    db.run(`INSERT INTO users (username, password, permissions) VALUES (?, ?, ?)`,
        [username, password, permString],
        function (err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            logActivity(actor, 'CREATE_USER', `Created account '${username}'`);
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.get('/api/activity-logs', (req, res) => {
    db.all(`SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200`, [], (err, rows) => {
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
        db.run(`INSERT INTO youth (name, age, email, mobile, social_media, birthday, parents_name, qr_code, password, profile_picture) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, age, email || null, mobile, social_media, birthday, parents_name, qrCode, qrCode, profile_picture || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const youthId = this.lastID;
                db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id) VALUES (?, ?, '[]', ?)`, [qrCode, qrCode, youthId]);
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
        db.get(`SELECT COUNT(*) as total_youth FROM youth`, [], (err2, totalYouthRow) => {
            const totalDirectory = totalYouthRow ? totalYouthRow.total_youth : 1;
            const sqlRoster = `SELECT a.id as log_id, a.checked_in_at, a.is_walkin, a.youth_id, y.name, y.email, y.qr_code, y.profile_picture FROM attendance a JOIN youth y ON a.youth_id = y.id WHERE a.event_id = ? ORDER BY a.checked_in_at DESC`;
            db.all(sqlRoster, [eventId], (err3, roster) => {
                if (err3) return res.status(500).json({ error: err3.message });
                const totalTurnout = roster.length;
                const walkins = roster.filter(r => r.is_walkin === 1).length;
                const preReg = totalTurnout - walkins;
                const turnoutPercentage = ((totalTurnout / (totalDirectory || 1)) * 100).toFixed(1);
                res.json({ event, totalDirectory, totalTurnout, turnoutPercentage, walkins, preReg, roster });
            });
        });
    });
});

app.post('/api/events', (req, res) => {
    const { name, event_date, time_start, venue, poster, actor } = req.body;
    db.run(`INSERT INTO events (name, event_date, time_start, venue, poster) VALUES (?, ?, ?, ?, ?)`,
        [name, event_date, time_start, venue, poster],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            logActivity(actor, 'CREATE_EVENT', `Published gathering '${name}'`);
            res.json({ id: this.lastID });
        }
    );
});

app.put('/api/events/:id', (req, res) => {
    const { name, event_date, time_start, venue, poster, actor } = req.body;
    if (poster) {
        db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, poster=? WHERE id=?`,
            [name, event_date, time_start, venue, poster, req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(actor, 'EDIT_EVENT', `Updated event details and poster for '${name}'`);
                res.json({ updated: this.changes });
            }
        );
    } else {
        db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=? WHERE id=?`,
            [name, event_date, time_start, venue, req.params.id],
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

// CHECK-IN API
app.post('/api/checkin', (req, res) => {
    const { youth_id, event_id, is_walkin, actor, qr_code } = req.body;
    const processCheckin = (targetYouthId) => {
        db.get(`SELECT id FROM attendance WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, row) => {
            if (row) return res.status(400).json({ error: 'Member is ALREADY checked in for this event.' });
            db.run(`INSERT INTO attendance (youth_id, event_id, is_walkin) VALUES (?, ?, ?)`,
                [targetYouthId, event_id, is_walkin ? 1 : 0],
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

app.listen(PORT, () => {
    console.log(`Server running safely on Port ${PORT}`);
});
