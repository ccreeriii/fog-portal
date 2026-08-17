const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const app = express();

// FORCE DISABLE CACHE FOR DEVELOPMENT
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); next(); });
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Set up Web Push VAPID Keys
const publicVapidKey = 'BPjMZjGy5VeLPQXNdkiJvfgeMAzQ0db3Pp_0ulzDv8s222iCcF6A7W0sFMdB1uVgz3QlkH7RMU93AX_epSv4IJY';
const privateVapidKey = 'rIOhhPjfafLULXqq96N6S3g5xxVllVVrf50GkDiLmYc';
webpush.setVapidDetails('mailto:celsocreeriii@gmail.com', publicVapidKey, privateVapidKey);

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

const imgDir = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

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
setInterval(runDatabaseBackup, 1000 * 60 * 60);

const db = new sqlite3.Database('./fog_community.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to local SQLite database: fog_community.db');
});

db.serialize(() => {
    // V1.0 TABLES
    db.run(`CREATE TABLE IF NOT EXISTS youth (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, email TEXT, mobile TEXT,
        social_media TEXT, birthday TEXT, parents_name TEXT, qr_code TEXT UNIQUE, password TEXT,
        profile_picture TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, event_date TEXT, time_start TEXT, venue TEXT,
        poster TEXT, photos_url TEXT, materials_url TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, event_id INTEGER, is_walkin INTEGER DEFAULT 0,
        checked_in_at DATETIME, UNIQUE(youth_id, event_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, permissions TEXT,
        youth_id INTEGER, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT, details TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS pre_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, event_id INTEGER, created_at DATETIME, UNIQUE(youth_id, event_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ministries (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, restricted_notes TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS ministry_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ministry_id INTEGER, youth_id INTEGER, role TEXT, assigned_at DATETIME, UNIQUE(ministry_id, youth_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS event_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, youth_id INTEGER, role_name TEXT, assigned_at DATETIME, UNIQUE(event_id, youth_id, role_name)
    )`);

    // V2.0 TABLES
    db.run(`CREATE TABLE IF NOT EXISTS discipleship_pathways (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, step_order INTEGER, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS member_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, pathway_id INTEGER, status TEXT DEFAULT 'In Progress',
        completed_at DATETIME, notes TEXT, UNIQUE(youth_id, pathway_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS private_journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, title TEXT, content TEXT, mood TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS prayer_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, title TEXT, request TEXT, is_anonymous INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Open', created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS prayer_intercessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, prayer_id INTEGER, youth_id INTEGER, prayed_at DATETIME, UNIQUE(prayer_id, youth_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS small_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, leader_id INTEGER, meeting_schedule TEXT, venue TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS small_group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, youth_id INTEGER, joined_at DATETIME, UNIQUE(group_id, youth_id)
    )`);

    // V3.0 TABLES
    db.run(`CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, artist TEXT, song_key TEXT, bpm TEXT,
        audio_url TEXT, youtube_url TEXT, chord_chart_url TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS setlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, scheduled_date TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS setlist_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, setlist_id INTEGER, song_id INTEGER, sort_order INTEGER, UNIQUE(setlist_id, song_id)
    )`);

    // V4.0 COMMUNICATIONS HUB TABLES
    db.run(`CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, message TEXT, target_audience TEXT, author TEXT, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS user_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, announcement_id INTEGER, is_read INTEGER DEFAULT 0, created_at DATETIME
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, subscription TEXT, created_at DATETIME
    )`);

    // V5.0 SCHEDULING & ROSTER TABLES
    db.run(`CREATE TABLE IF NOT EXISTS blockout_dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, block_date TEXT, reason TEXT, created_at DATETIME, UNIQUE(youth_id, block_date)
    )`);

    // SCHEMA AUTO-HEALING
    db.run(`ALTER TABLE youth ADD COLUMN profile_picture TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN photos_url TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN materials_url TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_banner TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_bottom_banner TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_title TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_info TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN youth_id INTEGER`, () => {});
    db.run(`ALTER TABLE ministry_members ADD COLUMN sub_role TEXT`, () => {});
    db.run(`ALTER TABLE event_roles ADD COLUMN sub_role TEXT`, () => {});
    db.run(`ALTER TABLE event_roles ADD COLUMN status TEXT DEFAULT 'Pending'`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN roles_restricted_notes TEXT`, () => {});
    db.run(`ALTER TABLE ministries ADD COLUMN logo TEXT`, () => {});
    db.run(`ALTER TABLE songs ADD COLUMN youtube_url TEXT`, () => {});

    // Ensure superadmin has ALL permissions
    const superadminPermissions = JSON.stringify([
        'access_checkin', 'access_directory', 'access_events',
        'access_attendance', 'access_activity', 'access_permissions',
        'access_ministries', 'access_discipleship', 'access_ai', 'access_worship', 'access_communications',
        'add_entries', 'edit_entries', 'delete_entries'
    ]);

    db.run(`INSERT OR IGNORE INTO users (username, password, permissions, created_at) VALUES (?, ?, ?, ?)`,
        ['celsocreeriii@gmail.com', 'JesusisLord', superadminPermissions, getManilaTime()]
    );
    db.run(`UPDATE users SET permissions = ? WHERE username = 'celsocreeriii@gmail.com'`, [superadminPermissions]);

    db.all(`SELECT id, qr_code FROM youth WHERE id NOT IN (SELECT youth_id FROM users WHERE youth_id IS NOT NULL)`, [], (err, rows) => {
        if (rows && rows.length > 0) {
            const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`);
            let addedCount = 0;
            rows.forEach(r => {
                if(r.qr_code) { stmt.run([r.qr_code, r.qr_code, r.id, getManilaTime()]); addedCount++; }
            });
            stmt.finalize();
        }
    });

    db.get(`SELECT COUNT(*) as cnt FROM discipleship_pathways`, [], (err, row) => {
        if (row && row.cnt === 0) {
            const defaultSteps = [
                ["Step 1: Salvation & Baptism", "Accept Jesus Christ as Lord and Savior and publicly declare your faith through water baptism.", 1],
                ["Step 2: Foundation Class", "Complete the core teachings on prayer, Bible reading, and Christian lifestyle.", 2],
                ["Step 3: Ministry Integration", "Join a department, core team, or small group to serve the community using your God-given gifts.", 3],
                ["Step 4: Discipleship Leader", "Mentor and lead others along their spiritual journey.", 4]
            ];
            const stmt = db.prepare(`INSERT INTO discipleship_pathways (title, description, step_order, created_at) VALUES (?, ?, ?, ?)`);
            defaultSteps.forEach(step => stmt.run([step[0], step[1], step[2], getManilaTime()]));
            stmt.finalize();
        }
    });
});

function logActivity(username, action, details) {
    db.run(`INSERT INTO activity_logs (username, action, details, created_at) VALUES (?, ?, ?, ?)`,
        [username || 'System', action, details, getManilaTime()]
    );
}

function pushToUser(youthId, title, message) {
    db.get(`SELECT qr_code FROM youth WHERE id = ?`, [youthId], (err, y) => {
        if (y && y.qr_code) {
            db.all(`SELECT subscription FROM push_subscriptions WHERE username = ?`, [y.qr_code], (err, subs) => {
                if (subs && subs.length > 0) {
                    const payload = JSON.stringify({ title, body: message, url: '/' });
                    subs.forEach(row => {
                        try {
                            webpush.sendNotification(JSON.parse(row.subscription), payload).catch(e => {
                                if (e.statusCode === 404 || e.statusCode === 410) {
                                    db.run(`DELETE FROM push_subscriptions WHERE subscription = ?`, [row.subscription]);
                                }
                            });
                        } catch(e){}
                    });
                }
            });
        }
    });
}

// ==============================================================================
// BASE API & OPEN GRAPH
// ==============================================================================
app.get('/', (req, res, next) => {
    const eventId = req.query.event;
    if (!eventId) return next();
    db.get(`SELECT * FROM events WHERE id = ?`, [eventId], (err, event) => {
        if (err || !event) return next();
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return next();
            const title = (event.prereg_title || event.name || 'Community Event').replace(/"/g, '&quot;');
            const description = (event.prereg_info || `Join me at ${title}!`).replace(/"/g, '&quot;');
            const host = req.get('host');
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const imageUrl = `${protocol}://${host}/api/events/${eventId}/poster.jpg`;
            const metaTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${protocol}://${host}/?event=${eventId}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />`;
            res.send(data.replace('</head>', `${metaTags}\n</head>`));
        });
    });
});

app.get('/manifest.json', (req, res) => {
    const isStaging = __dirname.includes('staging');
    res.json({
        "name": isStaging ? "FOG MINISTRIES (STAGING)" : "FIRE OF GOD MINISTRIES",
        "short_name": isStaging ? "FOG Staging" : "FOG Portal",
        "description": "Community Portal, CRM, and Transformational Discipleship Engine",
        "start_url": "/", "display": "standalone", "background_color": "#F8FAFC",
        "theme_color": isStaging ? "#10B981" : "#FF6B00",
        "icons": [
            { "src": isStaging ? "/img/icon-staging.png" : "/img/icon-prod.png", "sizes": "192x192", "type": "image/png" },
            { "src": isStaging ? "/img/icon-staging.png" : "/img/icon-prod.png", "sizes": "512x512", "type": "image/png" }
        ]
    });
});

app.get('/apple-touch-icon.png', (req, res) => {
    const iconPath = __dirname.includes('staging') ? '/img/icon-staging.png' : '/img/icon-prod.png';
    const absolutePath = path.join(__dirname, 'public', iconPath);
    if (fs.existsSync(absolutePath)) res.sendFile(absolutePath); else res.status(404).send('Icon not uploaded yet.');
});

app.post('/api/settings/images', (req, res) => {
    const { logo, prodIcon, stagingIcon, actor } = req.body;
    if (actor !== 'celsocreeriii@gmail.com') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const saveImageToDisk = (base64Str, filename) => {
            if (!base64Str) return;
            const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
            fs.writeFileSync(path.join(__dirname, 'public', 'img', filename), Buffer.from(base64Data, 'base64'));
        };
        saveImageToDisk(logo, 'logo.png'); saveImageToDisk(prodIcon, 'icon-prod.png'); saveImageToDisk(stagingIcon, 'icon-staging.png');
        logActivity(actor, 'UPDATE_BRANDING', 'Updated global site logo and PWA app icons');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to write files to disk: ' + err.message }); }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/backups', (req, res) => {
    if (!fs.existsSync(backupDir)) return res.json([]);
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).map(f => {
            const stats = fs.statSync(path.join(backupDir, f));
            return { name: f, time: stats.mtime, size: (stats.size / 1024 / 1024).toFixed(2) + ' MB' };
        }).sort((a, b) => b.time - a.time).slice(0, 10);
    files.forEach(f => f.time = new Date(f.time).toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
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
        fs.copyFileSync('./fog_community.db', autoBackup);
        logActivity(actor, 'RESTORE_DB', `Restored from ${filename}. Pre-restore saved to ${path.basename(autoBackup)}`);
        db.close((err) => {
            fs.copyFileSync(targetFile, './fog_community.db');
            res.json({ success: true });
            setTimeout(() => { process.exit(0); }, 1000);
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==============================================================================
// V1.0 ENDPOINTS (USERS, EVENTS, MINISTRIES)
// ==============================================================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE (username = ? OR username = (SELECT email FROM youth WHERE qr_code = ?)) AND password = ?`, [username, username, password], (err, user) => {
        if (user) {
            logActivity(username, 'LOGIN', 'User logged in');
            if (user.youth_id) {
                db.get(`SELECT * FROM youth WHERE id = ?`, [user.youth_id], (e, member) => { return res.json({ success: true, username: user.username, permissions: JSON.parse(user.permissions || '[]'), member, is_admin: true }); });
            } else return res.json({ success: true, username: user.username, permissions: JSON.parse(user.permissions || '[]'), member: null, is_admin: true });
            return;
        }
        db.get(`SELECT * FROM youth WHERE (qr_code = ? OR email = ? OR name = ?) AND password = ?`, [username, username, username, password], (err2, member) => {
            if (member) {
                logActivity(member.name, 'LOGIN', 'Member logged into profile');
                return res.json({ success: true, username: member.qr_code, permissions: [], member, is_admin: false });
            }
            logActivity(username, 'FAILED_LOGIN', 'Invalid credentials attempt');
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        });
    });
});

app.post('/api/logout', (req, res) => { logActivity(req.body.username, 'LOGOUT', 'User logged out'); res.json({ success: true }); });

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
        db.get(`SELECT * FROM youth WHERE id = ?`, [req.params.id], (e, member) => { res.json({ success: true, member }); });
    });
});

app.put('/api/youth/:id/permissions', (req, res) => {
    const youthId = parseInt(req.params.id, 10);
    const permString = JSON.stringify(req.body.permissions || []);
    const actor = req.body.actor || 'System';
    db.get('SELECT * FROM youth WHERE id = ?', [youthId], (err, youth) => {
        if (err) return res.json({ success: false, error: 'DB select error: ' + err.message });
        if (!youth) return res.json({ success: false, error: 'Member not found.' });
        const targetQr = youth.qr_code || `FOG-MEMBER-${String(youthId).padStart(3, '0')}`;
        db.get(`SELECT id FROM users WHERE youth_id = ? OR username = ?`, [youthId, targetQr], (err2, existingUser) => {
            if (existingUser) {
                db.run(`UPDATE users SET permissions = ?, youth_id = ? WHERE id = ?`, [permString, youthId, existingUser.id], function(err3) {
                    logActivity(actor, 'UPDATE_PERMISSIONS', `Updated permissions for Member ID ${youthId}`);
                    return res.json({ success: true });
                });
            } else {
                db.run(`INSERT INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, ?, ?, ?)`, [targetQr, targetQr, permString, youthId, getManilaTime()], function(err4) {
                    if (err4) {
                        const safeQr = `FOG-MEMBER-${youthId}-${Date.now()}`;
                        db.run(`INSERT INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, ?, ?, ?)`, [safeQr, safeQr, permString, youthId, getManilaTime()], function(err5) {
                            db.run(`UPDATE youth SET qr_code = ?, password = ? WHERE id = ?`, [safeQr, safeQr, youthId]);
                            return res.json({ success: true });
                        });
                    } else {
                        if (!youth.qr_code) db.run(`UPDATE youth SET qr_code = ?, password = ? WHERE id = ?`, [targetQr, targetQr, youthId]);
                        logActivity(actor, 'UPDATE_PERMISSIONS', `Created user & assigned permissions for Member ID ${youthId}`);
                        return res.json({ success: true });
                    }
                });
            }
        });
    });
});

app.get('/api/activity-logs', (req, res) => { db.all(`SELECT * FROM activity_logs ORDER BY id DESC`, [], (err, rows) => { res.json(rows); }); });
app.get('/api/youth', (req, res) => { db.all(`SELECT * FROM youth ORDER BY name ASC`, [], (err, rows) => { res.json(rows); }); });
app.get('/api/youth/:id/history', (req, res) => { db.all(`SELECT a.checked_in_at, a.is_walkin, e.name as event_name, e.event_date FROM attendance a JOIN events e ON a.event_id = e.id WHERE a.youth_id = ? ORDER BY a.checked_in_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });

app.post('/api/youth', (req, res) => {
    const { name, age, email, mobile, social_media, birthday, parents_name, profile_picture, actor } = req.body;
    db.get(`SELECT MAX(id) as maxId FROM youth`, [], (err, row) => {
        const nextId = (row && row.maxId ? row.maxId : 0) + 1;
        const qrCode = `FOG-MEMBER-${String(nextId).padStart(3, '0')}`;
        db.run(`INSERT INTO youth (name, age, email, mobile, social_media, birthday, parents_name, qr_code, password, profile_picture, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, age, email || null, mobile, social_media, birthday, parents_name, qrCode, qrCode, profile_picture || null, getManilaTime()], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                const youthId = this.lastID;
                db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`, [qrCode, qrCode, youthId, getManilaTime()]);
                logActivity(actor, 'CREATE_MEMBER', `Registered member '${name}' (${qrCode})`);
                res.json({ id: youthId, qr_code: qrCode, email });
            }
        );
    });
});
app.delete('/api/youth/:id', (req, res) => { db.run(`DELETE FROM youth WHERE id=?`, [req.params.id], function (err) { db.run(`DELETE FROM users WHERE youth_id=?`, [req.params.id]); logActivity(req.body.actor, 'DELETE_MEMBER', `Deleted member record (ID: ${req.params.id})`); res.json({ deleted: this.changes }); }); });
app.get('/api/users/list', (req, res) => { db.all(`SELECT u.id, u.username, u.permissions, u.youth_id, y.name as member_name, y.qr_code as member_code FROM users u LEFT JOIN youth y ON u.youth_id = y.id ORDER BY u.id DESC`, [], (err, rows) => { res.json(rows.map(r => ({ id: r.id, username: r.username, display_name: r.member_name ? `${r.member_name}` : r.username, qr_code: r.member_code || r.username, youth_id: r.youth_id, permissions: r.permissions || '[]' }))); }); });

// CHECKIN & EVENTS
app.post('/api/checkin', (req, res) => {
    const { youth_id, event_id, is_walkin, actor, qr_code } = req.body;
    const processCheckin = (targetYouthId) => {
        db.get(`SELECT id FROM attendance WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, row) => {
            if (row) return res.status(400).json({ error: 'Member is ALREADY checked in for this event.' });
            db.run(`INSERT INTO attendance (youth_id, event_id, is_walkin, checked_in_at) VALUES (?, ?, ?, ?)`, [targetYouthId, event_id, is_walkin ? 1 : 0, getManilaTime()], function (err) {
                logActivity(actor, 'CHECK_IN', `Checked in member ID ${targetYouthId}`);
                db.get(`SELECT name FROM youth WHERE id = ?`, [targetYouthId], (e, y) => { res.json({ success: true, member_name: y ? y.name : 'Member', youth_id: targetYouthId, log_id: this.lastID }); });
            });
        });
    };
    if (qr_code) { db.get(`SELECT id FROM youth WHERE qr_code = ?`, [qr_code], (err, row) => { if (!row) return res.status(404).json({ error: 'Invalid QR Pass Code.' }); processCheckin(row.id); }); }
    else if (youth_id) { processCheckin(youth_id); } else res.status(400).json({ error: 'Missing youth identifier for check-in.' });
});

app.get('/api/attendance/logs', (req, res) => { db.all(`SELECT a.id, a.checked_in_at, a.is_walkin, y.name as member_name, e.name as event_name, a.youth_id, a.event_id FROM attendance a JOIN youth y ON a.youth_id = y.id JOIN events e ON a.event_id = e.id ORDER BY a.checked_in_at DESC`, [], (err, rows) => { res.json(rows); }); });
app.put('/api/attendance/:id', (req, res) => { db.run(`UPDATE attendance SET checked_in_at = ?, is_walkin = ? WHERE id = ?`, [req.body.checked_in_at, req.body.is_walkin ? 1 : 0, req.params.id], function (err) { logActivity(req.body.actor, 'EDIT_ATTENDANCE', `Modified attendance record ID ${req.params.id}`); res.json({ updated: this.changes }); }); });
app.delete('/api/attendance/:id', (req, res) => { db.run(`DELETE FROM attendance WHERE id=?`, [req.params.id], function (err) { logActivity(req.body.actor, 'DELETE_ATTENDANCE', `Removed attendance log ID ${req.params.id}`); res.json({ deleted: this.changes }); }); });

app.get('/api/events', (req, res) => { db.all(`SELECT * FROM events ORDER BY event_date DESC`, [], (err, rows) => { res.json(rows); }); });
app.get('/api/events/:id/analytics', (req, res) => {
    const eventId = req.params.id;
    db.get(`SELECT * FROM events WHERE id = ?`, [eventId], (err, event) => {
        if (!event) return res.status(404).json({ error: 'Event not found' });
        db.get(`SELECT COUNT(*) as total_youth FROM youth WHERE age IS NOT NULL AND age != ''`, [], (err2, totalYouthRow) => {
            const totalDirectory = totalYouthRow ? totalYouthRow.total_youth : 1;
            db.all(`SELECT a.id as log_id, a.checked_in_at, a.is_walkin, a.youth_id, y.name, y.age, y.email, y.qr_code, y.profile_picture FROM attendance a JOIN youth y ON a.youth_id = y.id WHERE a.event_id = ? ORDER BY a.checked_in_at DESC`, [eventId], (err3, roster) => {
                db.all(`SELECT p.youth_id, p.created_at, y.name, y.age, y.email, y.qr_code, y.profile_picture FROM pre_registrations p JOIN youth y ON p.youth_id = y.id WHERE p.event_id = ? ORDER BY p.created_at DESC`, [eventId], (err4, preRegList) => {
                    const totalTurnout = roster.length; const walkins = roster.filter(r => r.is_walkin === 1).length; const checkedInPreRegs = totalTurnout - walkins; const totalPreRegistered = preRegList.length;
                    res.json({ event, totalDirectory, totalTurnout, turnoutPercentage: totalPreRegistered > 0 ? ((checkedInPreRegs / totalPreRegistered) * 100).toFixed(1) : '0.0', walkins, preReg: checkedInPreRegs, totalPreRegistered, roster, preRegList });
                });
            });
        });
    });
});
app.get('/api/events/:id/poster.jpg', (req, res) => { db.get(`SELECT poster, prereg_banner FROM events WHERE id = ?`, [req.params.id], (err, event) => { if (!event) return res.status(404).send('Not found'); const b64 = event.poster || event.prereg_banner; if (b64 && b64.startsWith('data:image')) { const parts = b64.split(';'); res.writeHead(200, { 'Content-Type': parts[0].split(':')[1] }); res.end(Buffer.from(parts[1].split(',')[1], 'base64')); } else res.status(404).send('No image'); }); });
app.post('/api/events', (req, res) => { db.run(`INSERT INTO events (name, event_date, time_start, venue, poster, photos_url, materials_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.poster, req.body.photos_url, req.body.materials_url, getManilaTime()], function (err) { logActivity(req.body.actor, 'CREATE_EVENT', `Published event '${req.body.name}'`); res.json({ id: this.lastID }); }); });
app.put('/api/events/:id', (req, res) => { if (req.body.poster !== undefined && req.body.poster !== null) { db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, poster=?, photos_url=?, materials_url=? WHERE id=?`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.poster, req.body.photos_url, req.body.materials_url, req.params.id], function(err) { res.json({ updated: this.changes }); }); } else { db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, photos_url=?, materials_url=? WHERE id=?`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.photos_url, req.body.materials_url, req.params.id], function(err) { res.json({ updated: this.changes }); }); } });
app.delete('/api/events/:id', (req, res) => { db.run(`DELETE FROM events WHERE id=?`, [req.params.id], function (err) { logActivity(req.body.actor, 'DELETE_EVENT', `Deleted event record (ID: ${req.params.id})`); res.json({ deleted: this.changes }); }); });
app.post('/api/events/:id/prereg-settings', (req, res) => { db.run(`UPDATE events SET prereg_banner = ?, prereg_bottom_banner = ?, prereg_title = ?, prereg_info = ? WHERE id = ?`, [req.body.banner, req.body.bottom_banner, req.body.title, req.body.info, req.params.id], function(err) { res.json({ success: true }); }); });
app.get('/api/events/:id/preregs', (req, res) => { db.all(`SELECT youth_id FROM pre_registrations WHERE event_id = ?`, [req.params.id], (err, rows) => { res.json(rows.map(r => r.youth_id)); }); });
app.post('/api/preregister', (req, res) => { db.run(`INSERT OR IGNORE INTO pre_registrations (event_id, youth_id, created_at) VALUES (?, ?, ?)`, [req.body.event_id, req.body.youth_id, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.delete('/api/events/:event_id/preregs/:youth_id', (req, res) => {
    db.run(`DELETE FROM pre_registrations WHERE event_id = ? AND youth_id = ?`, [req.params.event_id, req.params.youth_id], function(err) {
        logActivity(req.body.actor, 'DELETE_PREREG', `Removed pre-registration for youth ID ${req.params.youth_id} from Event ${req.params.event_id}`);
        res.json({ success: true, deleted: this.changes });
    });
});

// MINISTRIES
app.get('/api/ministries', (req, res) => { db.all(`SELECT m.*, (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = m.id) as member_count FROM ministries m ORDER BY m.name ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/ministries', (req, res) => { db.run(`INSERT INTO ministries (name, description, logo, created_at) VALUES (?, ?, ?, ?)`, [req.body.name, req.body.description, req.body.logo, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.put('/api/ministries/:id', (req, res) => {
    let sql = `UPDATE ministries SET name = ?, description = ?, restricted_notes = ? WHERE id = ?`;
    let params = [req.body.name, req.body.description, req.body.restricted_notes, req.params.id];
    if (req.body.logo !== undefined) { sql = `UPDATE ministries SET name = ?, description = ?, restricted_notes = ?, logo = ? WHERE id = ?`; params = [req.body.name, req.body.description, req.body.restricted_notes, req.body.logo, req.params.id]; }
    db.run(sql, params, function(err) { res.json({ success: true }); });
});
app.delete('/api/ministries/:id', (req, res) => { db.run(`DELETE FROM ministries WHERE id = ?`, [req.params.id], function(err) { db.run(`DELETE FROM ministry_members WHERE ministry_id = ?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/ministries/:id/members', (req, res) => { db.all(`SELECT mm.id as mapping_id, mm.role, mm.sub_role, mm.assigned_at, y.id, y.name, y.qr_code, y.profile_picture FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ? ORDER BY mm.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.post('/api/ministries/:id/members', (req, res) => { db.run(`INSERT INTO ministry_members (ministry_id, youth_id, role, sub_role, assigned_at) VALUES (?, ?, ?, ?, ?)`, [req.params.id, req.body.youth_id, req.body.role, req.body.sub_role, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.put('/api/ministries/:ministry_id/members/:mapping_id', (req, res) => { db.run(`UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?`, [req.body.role, req.body.sub_role, req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.delete('/api/ministries/:ministry_id/members/:mapping_id', (req, res) => { db.run(`DELETE FROM ministry_members WHERE id = ?`, [req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.get('/api/youth/:id/ministries', (req, res) => { db.all(`SELECT m.name as ministry_name, mm.role, mm.sub_role, mm.assigned_at FROM ministry_members mm JOIN ministries m ON mm.ministry_id = m.id WHERE mm.youth_id = ? ORDER BY mm.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });

// ==============================================================================
// V5.0 EVENT ROLES & BLOCKOUT DATES (VOLUNTEER SCHEDULING)
// ==============================================================================
app.get('/api/events/:id/roles', (req, res) => {
    db.all(`SELECT er.id as mapping_id, er.role_name, er.sub_role, er.assigned_at, er.status, y.id, y.name, y.qr_code, y.profile_picture FROM event_roles er JOIN youth y ON er.youth_id = y.id WHERE er.event_id = ? ORDER BY er.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); });
});

app.post('/api/events/:id/roles', (req, res) => {
    const eventId = req.params.id;
    const { youth_id, role_name, sub_role, actor } = req.body;

    // Verify Date against Blockouts
    db.get(`SELECT name, event_date FROM events WHERE id = ?`, [eventId], (err, evt) => {
        if (!evt) return res.status(404).json({ error: 'Event not found.' });

        db.get(`SELECT reason FROM blockout_dates WHERE youth_id = ? AND block_date = ?`, [youth_id, evt.event_date], (err, blockout) => {
            if (blockout) {
                return res.status(400).json({ error: `Cannot schedule! This member has blocked out ${evt.event_date}. Reason: ${blockout.reason || 'Unavailable'}` });
            }

            // Insert if safe
            db.run(`INSERT INTO event_roles (event_id, youth_id, role_name, sub_role, assigned_at, status) VALUES (?, ?, ?, ?, ?, 'Pending')`,
                [eventId, youth_id, role_name, sub_role, getManilaTime()], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    pushToUser(youth_id, "📅 Scheduling Invite", `You've been invited to serve as ${role_name} for ${evt.name}. Check your profile to accept!`);
                    res.json({ success: true });
            });
        });
    });
});

app.post('/api/events/:id/roles-notes', (req, res) => { db.run(`UPDATE events SET roles_restricted_notes = ? WHERE id = ?`, [req.body.roles_restricted_notes, req.params.id], function(err) { res.json({ success: true }); }); });
app.put('/api/events/:event_id/roles/:mapping_id', (req, res) => { db.run(`UPDATE event_roles SET role_name = ?, sub_role = ? WHERE id = ?`, [req.body.role_name, req.body.sub_role, req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.delete('/api/events/:event_id/roles/:mapping_id', (req, res) => { db.run(`DELETE FROM event_roles WHERE id = ?`, [req.params.mapping_id], function(err) { res.json({ success: true }); }); });

app.get('/api/youth/:id/event_roles', (req, res) => {
    db.all(`SELECT er.id as mapping_id, e.id as event_id, e.name as event_name, er.role_name, er.sub_role, er.assigned_at, er.status, e.event_date FROM event_roles er JOIN events e ON er.event_id = e.id WHERE er.youth_id = ? ORDER BY e.event_date DESC`, [req.params.id], (err, rows) => { res.json(rows); });
});

// Member Accept/Decline Invite
app.put('/api/events/:event_id/roles/:mapping_id/status', (req, res) => {
    db.run(`UPDATE event_roles SET status = ? WHERE id = ?`, [req.body.status, req.params.mapping_id], function(err) {
        logActivity(req.body.actor, 'RESPOND_INVITE', `Marked role mapping ${req.params.mapping_id} as ${req.body.status}`);
        res.json({ success: true });
    });
});

app.get('/api/youth/:id/blockouts', (req, res) => {
    db.all(`SELECT * FROM blockout_dates WHERE youth_id = ? ORDER BY block_date ASC`, [req.params.id], (err, rows) => { res.json(rows); });
});

app.post('/api/blockouts', (req, res) => {
    const { youth_id, block_date, reason } = req.body;
    db.run(`INSERT INTO blockout_dates (youth_id, block_date, reason, created_at) VALUES (?, ?, ?, ?)`,
        [youth_id, block_date, reason, getManilaTime()], function(err) {
            if (err) return res.status(400).json({ error: 'Date already blocked or invalid.' });
            res.json({ success: true });
        });
});

app.delete('/api/blockouts/:id', (req, res) => {
    db.run(`DELETE FROM blockout_dates WHERE id = ?`, [req.params.id], function(err) {
        res.json({ success: true });
    });
});

// ==============================================================================
// V2.0 DISCIPLESHIP ENGINE
// ==============================================================================
app.get('/api/discipleship/next-step/:youth_id', (req, res) => {
    db.all(`SELECT p.*, m.status as member_status, m.completed_at FROM discipleship_pathways p LEFT JOIN member_milestones m ON p.id = m.pathway_id AND m.youth_id = ? ORDER BY p.step_order ASC`, [req.params.youth_id], (err, steps) => {
        let nextStep = steps.find(s => s.member_status !== 'Completed');
        if (!nextStep && steps.length > 0) nextStep = steps[steps.length - 1];
        res.json({ nextStep, allSteps: steps });
    });
});
app.post('/api/discipleship/milestones', (req, res) => { db.run(`INSERT INTO member_milestones (youth_id, pathway_id, status, completed_at, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(youth_id, pathway_id) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at, notes = excluded.notes`, [req.body.youth_id, req.body.pathway_id, req.body.status, req.body.status === 'Completed' ? getManilaTime() : null, req.body.notes], function(err) { res.json({ success: true }); }); });
app.get('/api/discipleship/pathways', (req, res) => { db.all(`SELECT * FROM discipleship_pathways ORDER BY step_order ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/discipleship/pathways', (req, res) => { db.run(`INSERT INTO discipleship_pathways (title, description, step_order, created_at) VALUES (?, ?, ?, ?)`, [req.body.title, req.body.description, req.body.step_order, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.put('/api/discipleship/pathways/:id', (req, res) => { db.run(`UPDATE discipleship_pathways SET title=?, description=?, step_order=? WHERE id=?`, [req.body.title, req.body.description, req.body.step_order, req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/discipleship/pathways/:id', (req, res) => { db.run(`DELETE FROM discipleship_pathways WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM member_milestones WHERE pathway_id=?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/discipleship/member-progress/:youth_id', (req, res) => { db.all(`SELECT p.id as pathway_id, p.title, m.status, m.completed_at, m.notes as pastoral_notes FROM discipleship_pathways p LEFT JOIN member_milestones m ON p.id = m.pathway_id AND m.youth_id = ? ORDER BY p.step_order ASC`, [req.params.youth_id], (err, rows) => { res.json(rows); }); });
app.get('/api/discipleship/analytics/stages', (req, res) => {
    db.all(`WITH UserMaxStep AS (SELECT youth_id, MAX(pathway_id) as max_path_id FROM member_milestones WHERE status = 'Completed' OR status = 'In Progress' GROUP BY youth_id) SELECT p.title, COUNT(u.youth_id) as user_count FROM discipleship_pathways p LEFT JOIN UserMaxStep u ON p.id = u.max_path_id GROUP BY p.id, p.title ORDER BY p.step_order ASC`, [], (err, stepRows) => {
        db.get(`SELECT COUNT(*) as total FROM youth`, [], (err, youthRow) => {
            const totalYouth = youthRow ? youthRow.total : 0; let assignedYouth = 0; stepRows.forEach(r => assignedYouth += r.user_count);
            res.json({ stages: stepRows, unassigned: totalYouth - assignedYouth > 0 ? totalYouth - assignedYouth : 0 });
        });
    });
});

app.get('/api/journals/:youth_id', (req, res) => { db.all(`SELECT * FROM private_journals WHERE youth_id = ? ORDER BY created_at DESC`, [req.params.youth_id], (err, rows) => { res.json(rows); }); });
app.post('/api/journals', (req, res) => { db.run(`INSERT INTO private_journals (youth_id, title, content, mood, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.youth_id, req.body.title, req.body.content, req.body.mood, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.delete('/api/journals/:id', (req, res) => { db.run(`DELETE FROM private_journals WHERE id = ?`, [req.params.id], function(err) { res.json({ success: true }); }); });

app.get('/api/prayers', (req, res) => { db.all(`SELECT p.*, y.name as author_name FROM prayer_requests p LEFT JOIN youth y ON p.youth_id = y.id ORDER BY p.created_at DESC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/prayers', (req, res) => { db.run(`INSERT INTO prayer_requests (youth_id, title, request, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.youth_id, req.body.title, req.body.request, req.body.is_anonymous ? 1 : 0, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.post('/api/prayers/:id/intercede', (req, res) => { db.run(`INSERT OR IGNORE INTO prayer_intercessions (prayer_id, youth_id, prayed_at) VALUES (?, ?, ?)`, [req.params.id, req.body.youth_id, getManilaTime()], function(err) { res.json({ success: true }); }); });

app.get('/api/small-groups', (req, res) => { db.all(`SELECT g.*, y.name as leader_name, (SELECT COUNT(*) FROM small_group_members WHERE group_id = g.id) as member_count FROM small_groups g LEFT JOIN youth y ON g.leader_id = y.id ORDER BY g.name ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/small-groups', (req, res) => { db.run(`INSERT INTO small_groups (name, leader_id, meeting_schedule, venue, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.put('/api/small-groups/:id', (req, res) => { db.run(`UPDATE small_groups SET name=?, leader_id=?, meeting_schedule=?, venue=? WHERE id=?`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/small-groups/:id', (req, res) => { db.run(`DELETE FROM small_groups WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM small_group_members WHERE group_id=?`, [req.params.id]); res.json({ success: true }); }); });
app.post('/api/small-groups/:id/join', (req, res) => { db.run(`INSERT OR IGNORE INTO small_group_members (group_id, youth_id, joined_at) VALUES (?, ?, ?)`, [req.params.id, req.body.youth_id, getManilaTime()], function(err) { res.json({ success: true }); }); });

app.post('/api/ai/chat', (req, res) => {
    const q = (req.body.prompt || '').toLowerCase();
    if (q.includes('missing') || q.includes('absent') || q.includes('not attend')) {
        db.all(`SELECT y.name, MAX(a.checked_in_at) as last_seen FROM youth y LEFT JOIN attendance a ON y.id = a.youth_id GROUP BY y.id ORDER BY last_seen ASC LIMIT 10`, [], (err, rows) => {
            let msg = "Haven't checked in recently:<br>"; rows.forEach(r => msg += `• ${r.name}<br>`); res.json({ response: msg });
        }); return;
    }
    if (q.includes('how many member') || q.includes('total member')) { db.get(`SELECT count(*) as total FROM youth`, [], (err, row) => { res.json({ response: `We currently have <strong>${row.total} members</strong>.` }); }); return; }
    setTimeout(() => { res.json({ response: `Hello! I am your <strong>FOG Ministry AI Assistant</strong>.` }); }, 600);
});

// V3.0 WORSHIP HUB
app.get('/api/worship/songs', (req, res) => { db.all(`SELECT * FROM songs ORDER BY title ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/worship/songs', (req, res) => { db.run(`INSERT INTO songs (title, artist, song_key, bpm, audio_url, youtube_url, chord_chart_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [req.body.title, req.body.artist, req.body.song_key, req.body.bpm, req.body.audio_url, req.body.youtube_url, req.body.chord_chart_url, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.put('/api/worship/songs/:id', (req, res) => { db.run(`UPDATE songs SET title=?, artist=?, song_key=?, bpm=?, audio_url=?, youtube_url=?, chord_chart_url=? WHERE id=?`, [req.body.title, req.body.artist, req.body.song_key, req.body.bpm, req.body.audio_url, req.body.youtube_url, req.body.chord_chart_url, req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/worship/songs/:id', (req, res) => { db.run(`DELETE FROM songs WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM setlist_songs WHERE song_id=?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/worship/setlists', (req, res) => { db.all(`SELECT * FROM setlists ORDER BY scheduled_date DESC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/worship/setlists', (req, res) => { db.run(`INSERT INTO setlists (name, scheduled_date, created_at) VALUES (?, ?, ?)`, [req.body.name, req.body.scheduled_date, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.delete('/api/worship/setlists/:id', (req, res) => { db.run(`DELETE FROM setlists WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM setlist_songs WHERE setlist_id=?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/worship/setlists/:id/songs', (req, res) => { db.all(`SELECT ss.id as mapping_id, s.* FROM setlist_songs ss JOIN songs s ON ss.song_id = s.id WHERE ss.setlist_id = ? ORDER BY ss.sort_order ASC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.post('/api/worship/setlists/:id/songs', (req, res) => { db.get(`SELECT MAX(sort_order) as max_sort FROM setlist_songs WHERE setlist_id = ?`, [req.params.id], (err, row) => { const nextSort = (row && row.max_sort !== null ? row.max_sort : 0) + 1; db.run(`INSERT OR IGNORE INTO setlist_songs (setlist_id, song_id, sort_order) VALUES (?, ?, ?)`, [req.params.id, req.body.song_id, nextSort], function(err) { res.json({ success: true }); }); }); });
app.delete('/api/worship/setlists/:setlist_id/songs/:mapping_id', (req, res) => { db.run(`DELETE FROM setlist_songs WHERE id=?`, [req.params.mapping_id], function(err) { res.json({ success: true }); }); });

// ==============================================================================
// V4.0 - COMMUNICATIONS & PUSH NOTIFICATIONS ENGINE
// ==============================================================================
app.post('/api/communications/subscribe', (req, res) => {
    const { username, subscription } = req.body;
    if (!username || !subscription) return res.status(400).json({ error: 'Missing data' });

    db.run(`INSERT INTO push_subscriptions (username, subscription, created_at) VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET subscription = excluded.subscription`,
        [username, JSON.stringify(subscription), getManilaTime()],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.post('/api/communications/unsubscribe', (req, res) => {
    const { username } = req.body;
    db.run(`DELETE FROM push_subscriptions WHERE username = ?`, [username], function(err) {
        res.json({ success: true });
    });
});

app.post('/api/communications/broadcast', (req, res) => {
    const { target, title, message, actor } = req.body;
    if (!title || !message || !target) return res.status(400).json({ error: "Missing fields" });

    db.run(`INSERT INTO announcements (title, message, target_audience, author, created_at) VALUES (?, ?, ?, ?, ?)`,
        [title, message, target, actor || 'System', getManilaTime()], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const announcementId = this.lastID;

            let targetQuery = `SELECT id, qr_code FROM youth`;
            let targetParams = [];

            if (target === 'Leaders') {
                targetQuery = `SELECT y.id, y.qr_code FROM users u JOIN youth y ON u.youth_id = y.id WHERE u.permissions LIKE '%edit_entries%'`;
            } else if (target.startsWith('Ministry:')) {
                const minId = target.split(':')[1];
                targetQuery = `SELECT y.id, y.qr_code FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ?`;
                targetParams.push(minId);
            } else if (target.startsWith('Group:')) {
                const groupId = target.split(':')[1];
                targetQuery = `SELECT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id WHERE sgm.group_id = ?`;
                targetParams.push(groupId);
            }

            db.all(targetQuery, targetParams, (err, youths) => {
                if (err) console.error("Broadcast routing error:", err);
                const usernames = ['celsocreeriii@gmail.com'];

                if (youths && youths.length > 0) {
                    const stmt = db.prepare(`INSERT INTO user_notifications (youth_id, announcement_id, created_at) VALUES (?, ?, ?)`);
                    youths.forEach(y => {
                        if (y && y.id) {
                            stmt.run([y.id, announcementId, getManilaTime()]);
                            if (y.qr_code) usernames.push(y.qr_code);
                        }
                    });
                    stmt.finalize();
                }

                const placeholders = usernames.map(() => '?').join(',');
                db.all(`SELECT subscription FROM push_subscriptions WHERE username IN (${placeholders})`, usernames, (err, subs) => {
                    if (err || !subs || subs.length === 0) return res.json({ success: true, sentCount: 0 });

                    const payload = JSON.stringify({ title, body: message, url: '/' });
                    let sentCount = 0;

                    Promise.all(subs.map(row => {
                        try {
                            const pushSub = JSON.parse(row.subscription);
                            return webpush.sendNotification(pushSub, payload)
                                .then(() => { sentCount++; })
                                .catch(e => {
                                    if (e.statusCode === 404 || e.statusCode === 410) {
                                        db.run(`DELETE FROM push_subscriptions WHERE subscription = ?`, [row.subscription]);
                                    }
                                });
                        } catch(e) { return Promise.resolve(); }
                    })).then(() => {
                        logActivity(actor, 'BROADCAST', `Sent broadcast '${title}' to ${target}`);
                        res.json({ success: true, sentCount });
                    });
                });
            });
    });
});

app.get('/api/communications/history', (req, res) => {
    db.all(`SELECT id, title, target_audience as target, message, author as sender, created_at FROM announcements ORDER BY created_at DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

/* THE FIX: DYNAMIC AUTHORIZATION FOR DELETING BROADCASTS */
app.delete('/api/communications/broadcast/:id', (req, res) => {
    const { actor } = req.body;

    // Immediately pass the superadmin
    if (actor === 'celsocreeriii@gmail.com') {
        executeDelete();
        return;
    }

    // Dynamic Permission Check for other users
    db.get(`SELECT permissions FROM users WHERE username = ?`, [actor], (err, user) => {
        if (err || !user) return res.status(403).json({ error: 'Unauthorized: User not found.' });
        
        let perms = [];
        try { perms = JSON.parse(user.permissions); } catch(e) {}

        if (perms.includes('delete_entries')) {
            executeDelete();
        } else {
            return res.status(403).json({ error: 'Unauthorized: Missing delete_entries permission.' });
        }
    });

    function executeDelete() {
        db.run(`DELETE FROM announcements WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM user_notifications WHERE announcement_id = ?`, [req.params.id]);
            logActivity(actor, 'DELETE_BROADCAST', `Deleted global broadcast ID ${req.params.id}`);
            res.json({ success: true, deleted: this.changes });
        });
    }
});

app.get('/api/communications/inbox', (req, res) => {
    const username = req.query.username;
    if (username === 'celsocreeriii@gmail.com') {
        db.all(`SELECT id as notification_id, title, message, author, created_at FROM announcements ORDER BY created_at DESC LIMIT 50`, [], (err, rows) => {
            res.json(rows || []);
        });
        return;
    }
    db.get(`SELECT id FROM youth WHERE qr_code = ?`, [username], (err, youth) => {
        if (!youth) return res.json([]);
        const sql = `SELECT n.id as notification_id, a.title, a.message, a.author, a.created_at
                     FROM user_notifications n
                     JOIN announcements a ON n.announcement_id = a.id
                     WHERE n.youth_id = ?
                     ORDER BY a.created_at DESC LIMIT 50`;
        db.all(sql, [youth.id], (err, rows) => {
            res.json(rows || []);
        });
    });
});

app.delete('/api/communications/inbox/:id', (req, res) => {
    const { actor, username } = req.body;
    if (username === 'celsocreeriii@gmail.com') {
        db.run(`DELETE FROM announcements WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.run(`DELETE FROM user_notifications WHERE announcement_id = ?`, [req.params.id]);
            logActivity(actor, 'DELETE_INBOX_MSG', `Admin deleted global broadcast ID ${req.params.id}`);
            res.json({ success: true });
        });
    } else {
        db.run(`DELETE FROM user_notifications WHERE id = ?`, [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running safely on Port ${PORT} (V5.0 Rostering Engine Active)`);
});
