const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./fog_community.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to local SQLite database: fog_community.db');
});

const seedMembers = [
  {"id": 1, "name": "Nathan Chua", "age": 16, "social_media": "Nathan Chua", "birthday": "Dec 14, 2009", "parents_name": "Chique Torregosa"},
  {"id": 2, "name": "David Lim", "age": 16, "social_media": "Jabereyl Lim", "birthday": "11/17/2009", "parents_name": "Magnolia and Reinhardt Ngujo"},
  {"id": 3, "name": "Daniel Lim", "age": 15, "social_media": null, "birthday": "2/1/2011", "parents_name": "Magnolia and Reinhardt Ngujo"},
  {"id": 4, "name": "Marcus Diaz", "age": 14, "social_media": null, "birthday": "3/22/2012", "parents_name": "Donna and Ezequiel Bayani"},
  {"id": 5, "name": "AC Anore", "age": 14, "social_media": null, "birthday": "6/25/2012", "parents_name": "Sean and Fame Anore"},
  {"id": 6, "name": "Cris Caballes", "age": 16, "social_media": "Glidel C", "birthday": null, "parents_name": null},
  {"id": 7, "name": "Jeremiah John Creer", "age": 17, "social_media": null, "birthday": "July 4", "parents_name": "Therese Habana"},
  {"id": 8, "name": "Joseph John Creer", "age": 14, "social_media": null, "birthday": "Dec 19", "parents_name": "Anita Abao"},
  {"id": 9, "name": "Calen Salingay", "age": 14, "social_media": null, "birthday": "May 21", "parents_name": null},
  {"id": 10, "name": "Nashley Georfo", "age": 18, "social_media": null, "birthday": null, "parents_name": "Renan and Janell"},
  {"id": 11, "name": "Denise Georfo", "age": 13, "social_media": null, "birthday": null, "parents_name": "Renan and Janell"},
  {"id": 12, "name": "Yzabela Marie Acas Torrregosa", "age": 13, "social_media": "Yza Bela", "birthday": "March 29, 2013", "parents_name": "NA"},
  {"id": 13, "name": "Sofia Ngujo", "age": 15, "social_media": "Sofia Ngujo", "birthday": "May 11, 2010", "parents_name": "NA"},
  {"id": 14, "name": "Saffron Ngujo", "age": 13, "social_media": "Saffron Ngujo", "birthday": "March 23, 2012", "parents_name": "Geopet and Jenny"},
  {"id": 15, "name": "Arrow Dominic B Anore", "age": 11, "social_media": null, "birthday": "Jan 22, 2015", "parents_name": "Magnolia and Reinhardt Ngujo"},
  {"id": 16, "name": "Catarina Jana E. Lim", "age": 11, "social_media": "NA", "birthday": "7/10/2014", "parents_name": "Joann and Randy Cabuncal"},
  {"id": 17, "name": "Cazandra Jana E. Lim", "age": 11, "social_media": "NA", "birthday": "7/10/2014", "parents_name": "Joann and Randy Cabuncal"},
  {"id": 18, "name": "Clein Daniel M. Salingay", "age": 11, "social_media": "NA", "birthday": "10/30/2014", "parents_name": "Therese Habana"},
  {"id": 19, "name": "Sienna Ngujo", "age": 11, "social_media": "NA", "birthday": "September 13, 2015", "parents_name": "Clark and Carie Ylanan"},
  {"id": 20, "name": "Mark Ryan F. Delima", "age": 17, "social_media": "Mark Ryan Francis", "birthday": "Nov 11, 2008", "parents_name": null},
  {"id": 21, "name": "Jamaica B. Relegia", "age": 15, "social_media": "Maica Relegia", "birthday": "Oct 9, 2010", "parents_name": "Amay"},
  {"id": 22, "name": "John Stephen C. Felizarta", "age": 15, "social_media": "Stepehen Suyoc", "birthday": "Mar 23, 2010", "parents_name": "Susan"},
  {"id": 23, "name": "Clylie Johana Caballes", "age": 12, "social_media": null, "birthday": "Oct 13, 2014", "parents_name": "Vidal"},
  {"id": 24, "name": "Tiffany Cabuncal", "age": 11, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 25, "name": "Jacob Cabuncal", "age": 14, "social_media": null, "birthday": "2/10/2012", "parents_name": null},
  {"id": 26, "name": "Queen Ellen Tariman", "age": 12, "social_media": "Ellen Apollo", "birthday": "July 19", "parents_name": null},
  {"id": 27, "name": "Zaniyah Amber T. Paon", "age": 11, "social_media": "Iyang Iyah Oh", "birthday": "Nov 22", "parents_name": null},
  {"id": 28, "name": "Merril Lynch", "age": 11, "social_media": "Merril Lynch", "birthday": "Aug 20", "parents_name": null},
  {"id": 29, "name": "Ella Guiroy", "age": 18, "social_media": "Louella Godinez", "birthday": "Jun 13", "parents_name": null},
  {"id": 30, "name": "Raio Habana", "age": 15, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 31, "name": "Vince Olandria", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 32, "name": "Benedict Olandria", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 33, "name": "Lorenz Olandria", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 34, "name": "Grace Olandria", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 35, "name": "Eoin Diano", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 36, "name": "Alvera Diano", "age": null, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 37, "name": "Nicole Eve Osborne", "age": 14, "social_media": "Nicole eve", "birthday": "Mar 7", "parents_name": null},
  {"id": 38, "name": "Bree", "age": 16, "social_media": "breekuan", "birthday": "Aug 15", "parents_name": null},
  {"id": 39, "name": "Elaiza Gianina M. Ladisla", "age": 18, "social_media": "nviie-01", "birthday": "Feb 3", "parents_name": null},
  {"id": 40, "name": "Alyza", "age": 18, "social_media": "yza.ao", "birthday": "Jul 24", "parents_name": null},
  {"id": 41, "name": "Mai-mai", "age": 11, "social_media": null, "birthday": "Nov 3", "parents_name": null},
  {"id": 42, "name": "Shaira Lei V. Georfo", "age": 15, "social_media": "shalaleialiiii", "birthday": "Feb 27", "parents_name": null},
  {"id": 43, "name": "Sofia Annaliza S. Adlawan", "age": 10, "social_media": "Sofia Annaliza S. Adlawan", "birthday": "Nov 12", "parents_name": null},
  {"id": 44, "name": "Jeclyllie Phiele Corpin", "age": 9, "social_media": "Jeclyllie Phiele Corpin", "birthday": "Sep 9", "parents_name": null},
  {"id": 45, "name": "Angelo Jay Osborne", "age": 11, "social_media": "Angelo Jay Osborne", "birthday": "Sep 13", "parents_name": null},
  {"id": 46, "name": "Marco Austin", "age": 17, "social_media": "Marco Austin", "birthday": "Sep 11", "parents_name": null},
  {"id": 47, "name": "Regie Abello", "age": 18, "social_media": "Regie Abello", "birthday": "July 8", "parents_name": null},
  {"id": 48, "name": "Navy", "age": 18, "social_media": null, "birthday": "Sep 8", "parents_name": null},
  {"id": 49, "name": "Marlon", "age": 11, "social_media": null, "birthday": "Apr 18", "parents_name": null},
  {"id": 50, "name": "Jonathan Beceril", "age": 21, "social_media": "Jonathan Beceril", "birthday": "Jul 21", "parents_name": null},
  {"id": 51, "name": "Ave Zalthea Curaraton", "age": 13, "social_media": "Ave Curaraton", "birthday": "Dec 15", "parents_name": null},
  {"id": 52, "name": "Jean Ashley R. Dohig", "age": 15, "social_media": "Jeanne ASh", "birthday": "Aug 12", "parents_name": null},
  {"id": 53, "name": "Chilsey P. Tajanlangit", "age": 16, "social_media": null, "birthday": "Mar 19", "parents_name": null},
  {"id": 54, "name": "Jeny Claire M. Navarro", "age": 14, "social_media": null, "birthday": "Jun 16", "parents_name": null},
  {"id": 55, "name": "Janine O. Sitoy", "age": 16, "social_media": null, "birthday": "May 26", "parents_name": null},
  {"id": 56, "name": "Jay Ann O. Degamo", "age": 12, "social_media": null, "birthday": "Mar 4", "parents_name": null},
  {"id": 57, "name": "Jochiel R. Tampus", "age": 14, "social_media": null, "birthday": "Jun 21", "parents_name": null},
  {"id": 58, "name": "Angel Mae A. Abellanosa", "age": 14, "social_media": null, "birthday": "December 24", "parents_name": null},
  {"id": 59, "name": "Andres Adol", "age": 16, "social_media": null, "birthday": "Mar 28", "parents_name": null},
  {"id": 60, "name": "Yanni Tadura", "age": 14, "social_media": null, "birthday": "Mar 2", "parents_name": null},
  {"id": 61, "name": "Karl Dustine G. Delos Santos", "age": 16, "social_media": "Karl Dustine", "birthday": "Apr 18", "parents_name": null},
  {"id": 62, "name": "James Dominic M. Yang", "age": 17, "social_media": "vergil_esper", "birthday": null, "parents_name": null},
  {"id": 63, "name": "Xianne Llenos", "age": 9, "social_media": null, "birthday": null, "parents_name": null},
  {"id": 64, "name": "Xennah Arthea Llenos", "age": 12, "social_media": "Xennah Llenos", "birthday": "Jun 12", "parents_name": null},
  {"id": 65, "name": "Angel Nudalo", "age": 16, "social_media": "Angel Nudalo", "birthday": "Jul 24", "parents_name": null},
  {"id": 66, "name": "Melrose Faith Villacorte", "age": 17, "social_media": "Faith Villacorte", "birthday": "Sep 3", "parents_name": null},
  {"id": 67, "name": "Christiamae G. Fuentes", "age": 17, "social_media": "Christiamae Gerodias", "birthday": "April 7", "parents_name": null},
  {"id": 68, "name": "Britthny Jane Gerodias", "age": 18, "social_media": "Britthny Gerodias", "birthday": "Mar 16", "parents_name": null},
  {"id": 69, "name": "Leidy Mae Abadia", "age": 16, "social_media": "Lady", "birthday": "Dec 15", "parents_name": null},
  {"id": 70, "name": "Nikka Bacus", "age": 15, "social_media": "Nikka Bacus", "birthday": "Jan 18", "parents_name": null}
];

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS youth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, age INTEGER, email TEXT, mobile TEXT,
        social_media TEXT, birthday TEXT, parents_name TEXT,
        qr_code TEXT UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    const superadminPermissions = JSON.stringify([
        'access_checkin', 'access_directory', 'access_events',
        'access_attendance', 'edit_attendance', 'access_activity', 'access_permissions'
    ]);

    // Front Desk Registration Team: CHECK-IN ONLY
    const regTeamPermissions = JSON.stringify(['access_checkin']);

    db.run(`INSERT OR REPLACE INTO users (username, password, permissions) VALUES (?, ?, ?)`,
        ['registrationteam', 'JesusisLord', regTeamPermissions]
    );

    db.run(`INSERT OR IGNORE INTO users (username, password, permissions) VALUES (?, ?, ?)`,
        ['celsocreeriii@gmail.com', 'JesusisLord', superadminPermissions]
    );

    seedMembers.forEach((member) => {
        const qrCode = `FOG-MEMBER-${String(member.id).padStart(3, '0')}`;
        const defaultUsername = qrCode; 
        const defaultPassword = qrCode;

        db.run(`INSERT OR IGNORE INTO youth (id, name, age, email, social_media, birthday, parents_name, qr_code, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [member.id, member.name, member.age, null, member.social_media, member.birthday, member.parents_name, qrCode, defaultPassword],
            function () {
                db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id) VALUES (?, ?, '[]', ?)`,
                    [defaultUsername, defaultPassword, member.id]
                );
            }
        );
    });
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
            } else {
                return res.json({ success: true, username: user.username, permissions, member: null, is_admin: true });
            }
            return;
        }

        db.get(`SELECT * FROM youth WHERE (qr_code = ? OR email = ? OR name = ?) AND password = ?`, 
            [username, username, username, password], (err2, member) => {
            if (member) {
                logActivity(member.name, 'LOGIN', 'Member logged into profile');
                return res.json({ 
                    success: true, 
                    username: member.qr_code, 
                    permissions: [], 
                    member, 
                    is_admin: false 
                });
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

// PROFILE & MEMBER EDIT APIs
app.put('/api/youth/profile/:id', (req, res) => {
    const { name, age, birthday, social_media, parents_name, password, email, actor } = req.body;
    db.run(`UPDATE youth SET name=?, age=?, birthday=?, social_media=?, parents_name=?, password=?, email=? WHERE id=?`,
        [name, age, birthday, social_media, parents_name, password, email, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`UPDATE users SET password = ? WHERE youth_id = ?`, [password, req.params.id]);
            logActivity(actor || name, 'UPDATE_PROFILE', `Updated profile details for ID ${req.params.id}`);
            db.get(`SELECT * FROM youth WHERE id = ?`, [req.params.id], (e, member) => {
                res.json({ success: true, member });
            });
        }
    );
});

// GET ALL USERS FOR ADD PERMISSIONS LIST
app.get('/api/users/list', (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.permissions, u.youth_id, y.name as member_name, y.qr_code as member_code 
        FROM users u 
        LEFT JOIN youth y ON u.youth_id = y.id 
        ORDER BY u.id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => ({
            id: r.id,
            username: r.username,
            display_name: r.member_name ? `${r.member_name} (${r.member_code || r.username})` : r.username,
            permissions: JSON.parse(r.permissions || '[]')
        })));
    });
});

app.put('/api/users/:id/permissions', (req, res) => {
    const { permissions, actor } = req.body;
    const permString = JSON.stringify(permissions || []);
    db.run(`UPDATE users SET permissions = ? WHERE id = ?`, [permString, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        logActivity(actor, 'UPDATE_PERMISSIONS', `Updated permissions for User ID ${req.params.id}: ${permString}`);
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
            logActivity(actor, 'CREATE_USER', `Created account '${username}' with permissions: ${permString}`);
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

// DIRECTORY & MEMBERS
app.get('/api/youth', (req, res) => {
    db.all(`SELECT * FROM youth ORDER BY name ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/youth/:id/history', (req, res) => {
    const sql = `SELECT a.checked_in_at, a.is_walkin, e.name as event_name, e.event_date 
                 FROM attendance a 
                 JOIN events e ON a.event_id = e.id 
                 WHERE a.youth_id = ? ORDER BY a.checked_in_at DESC`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/youth', (req, res) => {
    const { name, age, email, mobile, social_media, birthday, parents_name, actor } = req.body;
    db.get(`SELECT MAX(id) as maxId FROM youth`, [], (err, row) => {
        const nextId = (row && row.maxId ? row.maxId : 0) + 1;
        const qrCode = `FOG-MEMBER-${String(nextId).padStart(3, '0')}`;
        const defaultUsername = qrCode;
        const defaultPassword = qrCode;

        db.run(`INSERT INTO youth (name, age, email, mobile, social_media, birthday, parents_name, qr_code, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, age, email || null, mobile, social_media, birthday, parents_name, qrCode, defaultPassword],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const youthId = this.lastID;
                db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id) VALUES (?, ?, '[]', ?)`,
                    [defaultUsername, defaultPassword, youthId]
                );
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

// EVENTS & ANALYTICS
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

            const sqlRoster = `
                SELECT a.id as log_id, a.checked_in_at, a.is_walkin, y.name, y.email, y.qr_code
                FROM attendance a
                JOIN youth y ON a.youth_id = y.id
                WHERE a.event_id = ?
                ORDER BY a.checked_in_at DESC`;

            db.all(sqlRoster, [eventId], (err3, roster) => {
                if (err3) return res.status(500).json({ error: err3.message });

                const totalTurnout = roster.length;
                const walkins = roster.filter(r => r.is_walkin === 1).length;
                const preReg = totalTurnout - walkins;
                const turnoutPercentage = ((totalTurnout / (totalDirectory || 1)) * 100).toFixed(1);

                res.json({
                    event,
                    totalDirectory,
                    totalTurnout,
                    turnoutPercentage,
                    walkins,
                    preReg,
                    roster
                });
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
            logActivity(actor, 'CREATE_EVENT', `Published gathering '${name}' on ${event_date}`);
            res.json({ id: this.lastID });
        }
    );
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
                    logActivity(actor, 'CHECK_IN', `Checked in member ID ${targetYouthId} for Event ID ${event_id}`);
                    db.get(`SELECT name FROM youth WHERE id = ?`, [targetYouthId], (e, y) => {
                        res.json({ success: true, member_name: y ? y.name : 'Member', id: this.lastID });
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
    } else {
        res.status(400).json({ error: 'Missing youth identifier for check-in.' });
    }
});

app.get('/api/attendance/logs', (req, res) => {
    const sql = `SELECT a.id, a.checked_in_at, a.is_walkin, y.name as member_name, e.name as event_name, a.youth_id, a.event_id
                 FROM attendance a
                 JOIN youth y ON a.youth_id = y.id
                 JOIN events e ON a.event_id = e.id
                 ORDER BY a.checked_in_at DESC`;
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
