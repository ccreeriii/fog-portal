const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const cron = require('node-cron');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = 3001;

// FORCE DISABLE CACHE FOR DEVELOPMENT
app.use((req, res, next) => { 
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); 
    next(); 
});

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

const publicVapidKey = 'BPjMZjGy5VeLPQXNdkiJvfgeMAzQ0db3Pp_0ulzDv8s222iCcF6A7W0sFMdB1uVgz3QlkH7RMU93AX_epSv4IJY';
const privateVapidKey = 'rIOhhPjfafLULXqq96N6S3g5xxVllVVrf50GkDiLmYc';
webpush.setVapidDetails('mailto:celsocreeriii@gmail.com', publicVapidKey, privateVapidKey);

const googleClient = new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');

const getManilaTime = () => {
    const d = new Date();
    const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    return `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;
};

const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

function runDatabaseBackup() {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const backupFile = path.join(backupDir, `fog_community_${dateStr}.db`);
    if (!fs.existsSync(backupFile) && fs.existsSync('./fog_community.db')) {
        try { fs.copyFileSync('./fog_community.db', backupFile); } catch (e) {}
    }
}
runDatabaseBackup();
setInterval(runDatabaseBackup, 1000 * 60 * 60);

const db = new sqlite3.Database('./fog_community.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else console.log('Connected to local SQLite database: fog_community.db');
    db.run('PRAGMA journal_mode = WAL;');
    console.log('[SCALABILITY] WAL Mode Activated for High Concurrency.');
});

// SCHEMA AUTO-HEALING
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS youth (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, email TEXT, mobile TEXT, social_media TEXT, birthday TEXT, parents_name TEXT, qr_code TEXT UNIQUE, password TEXT, profile_picture TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, permissions TEXT, youth_id INTEGER, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT, details TEXT, created_at DATETIME)`);
    
    // Social Auth Schema Additions
    db.run(`ALTER TABLE youth ADD COLUMN google_id TEXT UNIQUE`, () => {});
    db.run(`ALTER TABLE youth ADD COLUMN facebook_id TEXT UNIQUE`, () => {});
    db.run(`ALTER TABLE youth ADD COLUMN account_tier TEXT DEFAULT 'Seeker'`, () => {});
});

function logActivity(username, action, details) {
    db.run(`INSERT INTO activity_logs (username, action, details, created_at) VALUES (?, ?, ?, ?)`, [username || 'System', action, details, getManilaTime()]);
}

app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// AUTH & GOOGLE OAUTH ENDPOINT
// ==========================================
app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: '100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        const { sub: google_id, email, name, picture } = payload;

        db.get(`SELECT * FROM youth WHERE google_id = ? OR email = ?`, [google_id, email], (err, member) => {
            if (member) {
                if (!member.google_id) {
                    db.run(`UPDATE youth SET google_id = ?, profile_picture = ? WHERE id = ?`, [google_id, picture, member.id]);
                }
                logActivity(member.name, 'OAUTH_LOGIN', 'Logged in via Google');
                return res.json({ success: true, username: member.qr_code, permissions: [], member, is_admin: false });
            } else {
                db.get(`SELECT MAX(id) as maxId FROM youth`, [], (err, row) => {
                    const nextId = (row && row.maxId ? row.maxId : 0) + 1;
                    const qrCode = `FOG-SEEKER-${String(nextId).padStart(3, '0')}`;
                    db.run(`INSERT INTO youth (name, email, profile_picture, google_id, account_tier, qr_code, password, created_at) VALUES (?, ?, ?, ?, 'Seeker', ?, ?, ?)`,
                        [name, email, picture, google_id, qrCode, qrCode, getManilaTime()], function(err) {
                        const newId = this.lastID;
                        db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`, [qrCode, qrCode, newId, getManilaTime()]);
                        logActivity('System', 'SEEKER_CREATED', `Auto-provisioned Seeker '${name}' via Google`);
                        db.get(`SELECT * FROM youth WHERE id = ?`, [newId], (err, newMember) => {
                            res.json({ success: true, username: newMember.qr_code, permissions: [], member: newMember, is_admin: false, is_new: true });
                        });
                    });
                });
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ success: false, error: 'Invalid Google Token' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM youth WHERE (qr_code = ? OR email = ? OR name = ?) AND password = ?`, [username, username, username, password], (err2, member) => {
        if (member) {
            logActivity(member.name, 'LOGIN', 'Member logged into profile');
            return res.json({ success: true, username: member.qr_code, permissions: [], member, is_admin: false });
        }
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    });
});

app.post('/api/logout', (req, res) => { 
    logActivity(req.body.username, 'LOGOUT', 'User logged out'); 
    res.json({ success: true }); 
});

app.get('/api/youth', (req, res) => { 
    db.all(`SELECT * FROM youth ORDER BY name ASC`, [], (err, rows) => { res.json(rows || []); }); 
});

app.listen(PORT, () => { console.log(`Version 3 Staging Server running safely on Port ${PORT}`); });
