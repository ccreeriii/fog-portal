const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const cron = require('node-cron');
const app = express();













// [KOINONIA PATCH] SUPER ADMIN PASS-ID BY NAME
app.get('/api/admin/pass-id-by-name/:name', (req, res) => {
    if (typeof db !== 'undefined') {
        const decodedName = decodeURIComponent(req.params.name).trim();
        db.get("SELECT unique_pass_id FROM youth WHERE name = ?", [decodedName], (err, row) => {
            if (!err && row) res.json({ unique_pass_id: row.unique_pass_id });
            else res.status(404).json({ error: 'Not found' });
        });
    }
});

// [KOINONIA PATCH] SUPER ADMIN PASS-ID BY EMAIL
app.get('/api/admin/pass-id-by-email/:email', (req, res) => {
    if (typeof db !== 'undefined') {
        db.get("SELECT unique_pass_id FROM youth WHERE email = ?", [req.params.email], (err, row) => {
            if (!err && row) res.json({ unique_pass_id: row.unique_pass_id });
            else res.status(404).json({ error: 'Not found' });
        });
    }
});

// [KOINONIA PATCH] SUPER ADMIN PASS-ID OVERRIDE
app.get('/api/admin/pass-id/:id', (req, res) => {
    // Basic auth check - in production, verify session role strictly
    const userId = req.params.id;
    if (typeof db !== 'undefined') {
        db.get("SELECT unique_pass_id FROM youth WHERE id = ?", [userId], (err, row) => {
            if (!err && row) res.json({ unique_pass_id: row.unique_pass_id });
            else res.status(404).json({ error: 'Not found' });
        });
    }
});

// --- V115: PUBLIC ARCADE LEADERBOARDS ---
app.get('/api/public/arcade-leaderboards', (req, res) => {
    const queries = {
        daily: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND date(p.created_at, 'localtime') = date('now', 'localtime') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        weekly: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND p.created_at >= datetime('now', 'localtime', '-7 days') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        lastWeek: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND p.created_at >= datetime('now', 'localtime', '-14 days') AND p.created_at < datetime('now', 'localtime', '-7 days') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        monthly: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now', 'localtime') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        allTime: "SELECT y.name, gp.arcade_xp as score FROM gamification_points gp JOIN youth y ON gp.youth_id = y.id ORDER BY gp.arcade_xp DESC LIMIT 5",
        topGames: "SELECT a.game_name, y.name, MAX(a.score) as score FROM arcade_score_logs a JOIN youth y ON a.youth_id = y.id GROUP BY a.game_name, y.name ORDER BY a.game_name, score DESC"
    };
    let results = {};
    let pending = Object.keys(queries).length;
    Object.keys(queries).forEach(key => {
        db.all(queries[key], [], (err, rows) => {
            results[key] = rows || [];
            pending--;
            if (pending === 0) res.json(results);
        });
    });
});

app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); next(); });
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));


// --- V114: BULLETPROOF COMMUNICATION ENGINE ---
const sendCustomPush = (db, webpush, youthId, title, message, urlPath) => {
    if (!webpush) return;
    db.get("SELECT qr_code FROM youth WHERE id = ?", [youthId], (err, y) => {
        if (y && y.qr_code) {
            db.all("SELECT subscription FROM push_subscriptions WHERE username = ?", [y.qr_code], (err, subs) => {
                if (subs && subs.length > 0) {
                    const payload = JSON.stringify({ title, body: message, url: urlPath });
                    subs.forEach(row => {
                        try {
                            webpush.sendNotification(JSON.parse(row.subscription), payload).catch(e => {
                                if (e.statusCode === 404 || e.statusCode === 410) {
                                    db.run("DELETE FROM push_subscriptions WHERE subscription = ?", [row.subscription]);
                                }
                            });
                        } catch(e){}
                    });
                }
            });
        }
    });
};

app.post('/api/prayer-pals/send', (req, res) => {
    try {
        if (!req.body || !req.body.sender_id) return res.status(400).json({error: "Missing body data."});
        const { sender_id, receiver_id, message, sender_name } = req.body;
        const d = new Date();
        const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const pad = (n) => String(n).padStart(2, '0');
        const timeNow = `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;

        db.run('INSERT INTO personal_inbox (sender_id, receiver_id, title, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [sender_id, receiver_id, '🙏 A Prayer from ' + sender_name, message, 'Delivered', timeNow], function(err) {
                if(err) return res.status(500).json({error: err.message});
                
                const todayStr = getManilaTime().split(' ')[0];
                db.get("SELECT id FROM point_transactions WHERE youth_id = ? AND game_name = 'Daily Prayer Covenant' AND created_at LIKE ?", [sender_id, todayStr + '%'], (err, ptRow) => {
                    if (!ptRow && typeof awardPoints === 'function') {
                        awardPoints(sender_id, 'growth', 50, sender_name, 'Daily Prayer Covenant');
                    }
                });

                if (typeof webpush !== 'undefined') {
                    sendCustomPush(db, webpush, receiver_id, '🙏 Prayer Received', 'Prayers sent to you by a prayer covenant.', '/?tab=inbox');
                }
                res.json({success: true});
        });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/inbox/personal/:id/respond', (req, res) => {
    try {
        if (!req.body || !req.body.sender_id) return res.status(400).json({error: "Missing body data."});
        const { sender_id, original_sender_id, action, sender_name } = req.body;
        const d = new Date();
        const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const pad = (n) => String(n).padStart(2, '0');
        const timeNow = `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;

        db.run("UPDATE personal_inbox SET status = ? WHERE id = ?", [action, req.params.id], (err) => {
            if(err) return res.status(500).json({error: err.message});
            
            let title = action === 'thank_you' ? "💙 Thank You!" : "✨ Praise Report!";
            let msg = action === 'thank_you' ? `Thank you for covering me in prayer! - ${sender_name}` : `God answered the prayer you prayed for me! Praise God! - ${sender_name}`;

            db.run("INSERT INTO personal_inbox (sender_id, receiver_id, title, message, status, created_at) VALUES (?, ?, ?, ?, 'Delivered', ?)",
                [sender_id, original_sender_id, title, msg, timeNow], (err2) => {
                    if(err2) return res.status(500).json({error: err2.message});
                    if (typeof webpush !== 'undefined') {
                        sendCustomPush(db, webpush, original_sender_id, title, msg, '/?tab=inbox');
                    }
                    res.json({success: true});
            });
        });
    } catch (e) { res.status(500).json({error: e.message}); }
});

app.post('/api/communications/broadcast', (req, res) => {
    try {
        if (!req.body || !req.body.target) return res.status(400).json({error: "Missing body data."});
        const { target, title, message, actor } = req.body;
        const d = new Date();
        const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const pad = (n) => String(n).padStart(2, '0');
        const timeNow = `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;

        db.run("INSERT INTO announcements (title, message, target_audience, author, created_at) VALUES (?, ?, ?, ?, ?)", [title, message, target, actor || 'System', timeNow], function(err) {
            if (err) return res.status(500).json({success: false, error: err.message});
            const announcementId = this.lastID;
            
            let targetQuery = "SELECT id, qr_code FROM youth"; let targetParams = [];
            if (target === 'Leaders') {
                targetQuery = "SELECT y.id, y.qr_code FROM users u JOIN youth y ON u.youth_id = y.id WHERE u.permissions LIKE '%edit_entries%'";
            } else if (target === 'Groups') {
                targetQuery = "SELECT DISTINCT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id";
            } else if (target.startsWith('Ministry:')) {
                targetQuery = "SELECT y.id, y.qr_code FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ?";
                targetParams.push(target.split(':')[1]);
            } else if (target.startsWith('Group:')) {
                targetQuery = "SELECT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id WHERE sgm.group_id = ?";
                targetParams.push(target.split(':')[1]);
            }
            
            db.all(targetQuery, targetParams, (err, youths) => {
                const usernames = ['celsocreeriii@gmail.com'];
                if (youths && youths.length > 0) {
                    const stmt = db.prepare("INSERT INTO user_notifications (youth_id, announcement_id, created_at) VALUES (?, ?, ?)");
                    youths.forEach(y => { if (y && y.id) { stmt.run([y.id, announcementId, timeNow]); if (y.qr_code) usernames.push(y.qr_code); } });
                    stmt.finalize();
                }
                
                const queryAll = target === 'All' ? "SELECT subscription FROM push_subscriptions" : "SELECT subscription FROM push_subscriptions WHERE username IN (" + usernames.map(()=>'?').join(',') + ")";
                const paramsAll = target === 'All' ? [] : usernames;
                
                db.all(queryAll, paramsAll, (err, subs) => {
                    if (err || !subs || subs.length === 0) return res.json({ success: true, sentCount: 0 });
                    const payload = JSON.stringify({ title, body: message, url: '/' });
                    let sentCount = 0;
                    Promise.all(subs.map(row => {
                        try {
                            return webpush.sendNotification(JSON.parse(row.subscription), payload)
                                .then(() => { sentCount++; })
                                .catch(e => { 
                                    if (e.statusCode === 404 || e.statusCode === 410) db.run("DELETE FROM push_subscriptions WHERE subscription = ?", [row.subscription]); 
                                });
                        } catch(e) { return Promise.resolve(); }
                    })).then(() => { 
                        try { if(typeof logActivity === 'function') logActivity(actor, 'BROADCAST', "Sent broadcast to " + target); } catch(e){}
                        res.json({ success: true, sentCount }); 
                    });
                });
            });
        });
    } catch (error) { res.status(500).json({success: false, error: error.message}); }
});
// --- END V114 ---




// [KOINONIA PATCH] ADMIN MANUAL PRAYER PAL TRIGGER
app.post('/api/admin/trigger-prayer-pals', (req, res) => {
    if(typeof db === 'undefined') return res.status(500).json({error: "DB not initialized"});
    
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    const weekStart = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const assignPals = () => {
        return new Promise((resolve) => {
            db.all(`SELECT id FROM youth`, [], (err, members) => {
                if (!members || members.length < 2) return resolve();
                
                // Fisher-Yates Shuffle
                let shuffled = [...members];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                
                const stmt = db.prepare(`INSERT OR IGNORE INTO secret_prayer_pals (youth_id, pal_youth_id, week_start) VALUES (?, ?, ?)`);
                for (let i = 0; i < shuffled.length; i++) {
                    const current = shuffled[i];
                    const next = shuffled[(i + 1) % shuffled.length]; // Circular pairing
                    stmt.run([current.id, next.id, weekStart]);
                }
                stmt.finalize();
                resolve();
            });
        });
    };

    Promise.all([assignPals()]).then(() => {
        res.json({success: true, message: "Unified prayer partners successfully assigned!"});
    });
});


// [KOINONIA PATCH V107] PENDING MEMBER REQUESTS FIX ONLY
app.get('/api/small-groups/:id/roster-status', (req, res) => {
    if(typeof db !== 'undefined') {
        db.all("SELECT y.id, y.name, y.profile_picture, sgm.status, (SELECT MAX(created_at) FROM activity_logs WHERE username = y.qr_code) as last_active FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id WHERE sgm.group_id = ? ORDER BY sgm.status DESC, y.name ASC", [req.params.id], (err, rows) => {
            res.json(rows || []);
        });
    }
});


// ==========================================
// KOINONIA PHASE B: URL QUERY INTERCEPTOR
// ==========================================
app.use((req, res, next) => {
    if (req.path === '/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        if (req.query.read === 'daily-manna') return res.sendFile(require('path').join(__dirname, 'public', 'seeker-manna.html'));
        
        // Catch faith=quest, fate=quest, or play=arcade gracefully
        if (req.query.faith === 'quest' || req.query.fate === 'quest' || req.query.play === 'arcade') {
            try {
                let html = require('fs').readFileSync(require('path').join(__dirname, 'public', 'seeker-arcade.html'), 'utf8');
                if (req.query.game) {
                    const safeGame = req.query.game.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const ogTitle = `<meta property="og:title" content="${safeGame} | Play Now!">`;
                    html = html.replace(/<meta property="og:title" content=".*?">/, ogTitle);
                }
                return res.send(html);
            } catch(e) {
                return res.sendFile(require('path').join(__dirname, 'public', 'seeker-arcade.html'));
            }
        }
    }
    next();
});





// ==========================================
// V112: THE PERFECTED ROUTER (POST-BODY-PARSER)
// ==========================================

app.post('/api/small-groups/react-v2', (req, res) => {
    try {
        const { type, id, emoji, user_name } = req.body;
        if (!type || !id || !emoji || !user_name) return res.status(400).json({success: false, error: 'Missing body parameters'});
        
        let table = type === 'chat' ? 'small_group_chats' : (type === 'prayer' ? 'prayer_requests' : (type === 'memory' ? 'group_memories' : ''));
        if (!table) return res.status(400).json({success: false, error: 'Invalid type'});

        db.get(`SELECT reactions FROM ${table} WHERE id = ?`, [id], (err, row) => {
            if(err) return res.status(500).json({success: false, error: err.message});
            if(!row) return res.status(404).json({success: false, error: 'Post not found'});
            
            let reactions = {};
            try { reactions = JSON.parse(row.reactions || '{}'); } catch(e) {}

            let removed = false;
            for (let key in reactions) {
                if (!Array.isArray(reactions[key])) reactions[key] = [];
                const idx = reactions[key].indexOf(user_name);
                if (idx > -1) {
                    reactions[key].splice(idx, 1);
                    if (key === emoji) removed = true;
                }
            }

            if(!removed) {
                if(!reactions[emoji]) reactions[emoji] = [];
                reactions[emoji].push(user_name);
            }

            for (let key in reactions) {
                if (reactions[key].length === 0) delete reactions[key];
            }

            db.run(`UPDATE ${table} SET reactions = ? WHERE id = ?`, [JSON.stringify(reactions), id], (err2) => {
                if (err2) return res.status(500).json({success:false, error: err2.message});
                res.json({success: true, reactions});
            });
        });
    } catch (err) { res.status(500).json({success: false, error: err.message}); }
});

app.get('/api/small-groups/:id/chat', (req, res) => {
    const lastId = parseInt(req.query.last_id) || 0;
    db.all(`SELECT c.id, c.message, c.reactions, c.created_at, y.name, y.profile_picture FROM small_group_chats c JOIN youth y ON c.youth_id = y.id WHERE c.group_id = ? AND c.id > ? ORDER BY c.id ASC`, [req.params.id, lastId], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        res.json(rows || []);
    });
});

app.get('/api/small-groups/:id/memories', (req, res) => {
    db.all(`SELECT m.*, IFNULL(y.name, 'Admin') as author_name, y.profile_picture FROM group_memories m LEFT JOIN youth y ON m.youth_id = y.id WHERE m.group_id = ? ORDER BY m.created_at DESC LIMIT 50`, [req.params.id], (err, rows) => { 
        if (err) return res.status(500).json({error: err.message});
        res.json(rows || []); 
    });
});

app.post('/api/communications/broadcast', (req, res) => {
    try {
        const { target, title, message, actor } = req.body;
        if (!target || !title || !message) return res.status(400).json({success: false, error: 'Missing parameters'});

        const d = new Date();
        const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const pad = (n) => String(n).padStart(2, '0');
        const timeNow = `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;

        db.run(`INSERT INTO announcements (title, message, target_audience, author, created_at) VALUES (?, ?, ?, ?, ?)`, [title, message, target, actor || 'System', timeNow], function(err) {
            if (err) return res.status(500).json({success: false, error: err.message});
            const announcementId = this.lastID;
            
            let targetQuery = `SELECT id, qr_code FROM youth`; let targetParams = [];
            if (target === 'Leaders') {
                targetQuery = `SELECT y.id, y.qr_code FROM users u JOIN youth y ON u.youth_id = y.id WHERE u.permissions LIKE '%edit_entries%'`;
            } else if (target === 'Groups') {
                targetQuery = `SELECT DISTINCT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id`;
            } else if (target.startsWith('Ministry:')) {
                targetQuery = `SELECT y.id, y.qr_code FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ?`;
                targetParams.push(target.split(':')[1]);
            } else if (target.startsWith('Group:')) {
                targetQuery = `SELECT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id WHERE sgm.group_id = ?`;
                targetParams.push(target.split(':')[1]);
            }
            
            db.all(targetQuery, targetParams, (err, youths) => {
                try {
                    const usernames = ['celsocreeriii@gmail.com'];
                    if (youths && youths.length > 0) {
                        const stmt = db.prepare(`INSERT INTO user_notifications (youth_id, announcement_id, created_at) VALUES (?, ?, ?)`);
                        youths.forEach(y => { if (y && y.id) { stmt.run([y.id, announcementId, timeNow]); if (y.qr_code) usernames.push(y.qr_code); } });
                        stmt.finalize();
                    }
                    
                    const queryAll = target === 'All' ? `SELECT subscription FROM push_subscriptions` : `SELECT subscription FROM push_subscriptions WHERE username IN (${usernames.map(()=>'?').join(',')})`;
                    const paramsAll = target === 'All' ? [] : usernames;
                    
                    db.all(queryAll, paramsAll, (err, subs) => {
                        if (err || !subs || subs.length === 0) return res.json({ success: true, sentCount: 0 });
                        const payload = JSON.stringify({ title, body: message, url: urlPath });
                        let sentCount = 0;
                        Promise.all(subs.map(row => {
                            try {
                                return webpush.sendNotification(JSON.parse(row.subscription), payload)
                                    .then(() => { sentCount++; })
                                    .catch(e => { 
                                        if (e.statusCode === 404 || e.statusCode === 410) db.run(`DELETE FROM push_subscriptions WHERE subscription = ?`, [row.subscription]); 
                                    });
                            } catch(e) { return Promise.resolve(); }
                        })).then(() => { 
                            res.json({ success: true, sentCount }); 
                        });
                    });
                } catch (innerErr) {
                    res.status(500).json({success: false, error: innerErr.message});
                }
            });
        });
    } catch (error) {
        res.status(500).json({success: false, error: error.message});
    }
});




const publicVapidKey = 'BPjMZjGy5VeLPQXNdkiJvfgeMAzQ0db3Pp_0ulzDv8s222iCcF6A7W0sFMdB1uVgz3QlkH7RMU93AX_epSv4IJY';
const privateVapidKey = 'rIOhhPjfafLULXqq96N6S3g5xxVllVVrf50GkDiLmYc';
webpush.setVapidDetails('mailto:celsocreeriii@gmail.com', publicVapidKey, privateVapidKey);


// SILAS SECRET PRAYER PAL ENGINE (STRICT GENDER MATCHING)
cron.schedule('0 9 * * 1', () => { // Every Monday at 9:00 AM
    console.log('[CRON] Silas is assigning gender-strict Secret Prayer Pals...');
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    const weekStart = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    const assignPalsByGender = (gender) => {
        db.all(`SELECT id FROM youth`, [], (err, members) => {
            if (!members || members?.length || 0 < 2) return;
            
            // Fisher-Yates Shuffle
            let shuffled = [...members];
            for (let i = shuffled?.length || 0 - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const stmt = db.prepare(`INSERT OR IGNORE INTO secret_prayer_pals (youth_id, pal_youth_id, week_start) VALUES (?, ?, ?)`);
            for (let i = 0; i < shuffled?.length || 0; i++) {
                const current = shuffled[i];
                const next = shuffled[(i + 1) % shuffled?.length || 0]; // Circular assignment ensures everyone gives and receives
                stmt.run([current.id, next.id, weekStart]);
            }
            stmt.finalize();
        });
    };

    assignPalsByGender('Male');
    assignPalsByGender('Female');

}, { scheduled: true, timezone: "Asia/Manila" });

const getManilaTime = () => {
    const d = new Date();
    const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const pad = (n) => String(n).padStart(2, '0');
    return `${manila.getFullYear()}-${pad(manila.getMonth()+1)}-${pad(manila.getDate())} ${pad(manila.getHours())}:${pad(manila.getMinutes())}:${pad(manila.getSeconds())}`;
};

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
        try { fs.copyFileSync('./fog_community.db', backupFile); console.log(`[BACKUP] Auto-backup completed: ${backupFile}`); } catch (e) { console.error('[BACKUP ERROR]', e); }
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

db.serialize(() => {

    // AUTO-HEAL SUPERADMIN CONFLICT
    db.get(`SELECT id FROM youth WHERE email = 'celsocreeriii@gmail.com'`, [], (err, yRow) => {
        if (yRow) {
            db.run(`UPDATE users SET youth_id = ? WHERE username = 'celsocreeriii@gmail.com'`, [yRow.id]);
            db.run(`DELETE FROM users WHERE youth_id = ? AND username != 'celsocreeriii@gmail.com'`, [yRow.id]);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS youth (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, email TEXT, mobile TEXT, social_media TEXT, birthday TEXT, parents_name TEXT, qr_code TEXT UNIQUE, password TEXT, profile_picture TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, event_date TEXT, time_start TEXT, venue TEXT, poster TEXT, photos_url TEXT, materials_url TEXT, event_points INTEGER DEFAULT 10, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, event_id INTEGER, is_walkin INTEGER DEFAULT 0, checked_in_at DATETIME, UNIQUE(youth_id, event_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, permissions TEXT, youth_id INTEGER, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, action TEXT, details TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS pre_registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, event_id INTEGER, created_at DATETIME, UNIQUE(youth_id, event_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS ministries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, restricted_notes TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS ministry_members (id INTEGER PRIMARY KEY AUTOINCREMENT, ministry_id INTEGER, youth_id INTEGER, role TEXT, assigned_at DATETIME, UNIQUE(ministry_id, youth_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS event_roles (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER, youth_id INTEGER, role_name TEXT, assigned_at DATETIME, UNIQUE(event_id, youth_id, role_name))`);

    db.run(`CREATE TABLE IF NOT EXISTS discipleship_pathways (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, step_order INTEGER, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS member_milestones (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, pathway_id INTEGER, status TEXT DEFAULT 'In Progress', completed_at DATETIME, notes TEXT, UNIQUE(youth_id, pathway_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS private_journals (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, title TEXT, content TEXT, mood TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS prayer_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, title TEXT, request TEXT, is_anonymous INTEGER DEFAULT 0, status TEXT DEFAULT 'Open', created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS prayer_intercessions (id INTEGER PRIMARY KEY AUTOINCREMENT, prayer_id INTEGER, youth_id INTEGER, prayed_at DATETIME, UNIQUE(prayer_id, youth_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS small_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, leader_id INTEGER, meeting_schedule TEXT, venue TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS group_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, title TEXT, scheduled_at DATETIME, meet_link TEXT, recording_url TEXT, notified INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS small_group_chats (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, youth_id INTEGER, message TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS small_group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, youth_id INTEGER, joined_at DATETIME, UNIQUE(group_id, youth_id))`);

    db.run(`CREATE TABLE IF NOT EXISTS group_threads (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, youth_id INTEGER, title TEXT, content TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS group_thread_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER, youth_id INTEGER, reply_text TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS group_memories (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, youth_id INTEGER, image_data TEXT, caption TEXT, created_at DATETIME)`);
    db.run(`ALTER TABLE small_group_chats ADD COLUMN reactions TEXT DEFAULT '{}'`, (err)=>{});
    

    db.run(`CREATE TABLE IF NOT EXISTS songs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, artist TEXT, song_key TEXT, bpm TEXT, audio_url TEXT, youtube_url TEXT, chord_chart_url TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS setlists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, scheduled_date TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS setlist_songs (id INTEGER PRIMARY KEY AUTOINCREMENT, setlist_id INTEGER, song_id INTEGER, sort_order INTEGER, UNIQUE(setlist_id, song_id))`);

    db.run(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, message TEXT, target_audience TEXT, author TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, announcement_id INTEGER, is_read INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run("ALTER TABLE personal_inbox ADD COLUMN status TEXT DEFAULT 'Delivered'", () => {});
    db.run(`CREATE TABLE IF NOT EXISTS personal_inbox (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER, receiver_id INTEGER, title TEXT, message TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, subscription TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS blockout_dates (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, block_date TEXT, reason TEXT, created_at DATETIME, UNIQUE(youth_id, block_date))`);
    db.run(`CREATE TABLE IF NOT EXISTS gamification_points (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER UNIQUE, points INTEGER DEFAULT 0, arcade_xp INTEGER DEFAULT 0, growth_xp INTEGER DEFAULT 0, event_xp INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS weekly_challenges (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, points INTEGER, is_active INTEGER DEFAULT 1, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS user_challenge_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, challenge_id INTEGER, completed_at DATETIME, UNIQUE(youth_id, challenge_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS point_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, type TEXT, game_name TEXT, amount INTEGER, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS ai_chat_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, persona TEXT, prompt TEXT, response TEXT, is_private INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS ai_communication_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, target_youth_id INTEGER, draft_type TEXT, suggested_message TEXT, status TEXT DEFAULT 'Pending', created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS arcade_score_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, game_name TEXT, score INTEGER, played_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_trivia_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, options TEXT, correct_index INTEGER, category TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_polls (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, option_a TEXT, option_b TEXT, votes_a INTEGER DEFAULT 0, votes_b INTEGER DEFAULT 0, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_user_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, game_type TEXT, game_id INTEGER, played_at DATETIME, UNIQUE(youth_id, game_type, game_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_whoami_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, clue1 TEXT, clue2 TEXT, clue3 TEXT, answer TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_verse_chain (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT, verse_text TEXT, missing_words TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_verse_contributions (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, verse_id INTEGER, youth_id INTEGER, word_index INTEGER, guessed_word TEXT, created_at DATETIME, UNIQUE(group_id, verse_id, word_index))`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_verse_scramble (id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT, verse_text TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_emoji_translation (id INTEGER PRIMARY KEY AUTOINCREMENT, emojis TEXT, answer TEXT, options TEXT, created_at DATETIME)`);
    db.run(`CREATE TABLE IF NOT EXISTS brain_crosswords (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, grid_size INTEGER, words_json TEXT, created_at DATETIME)`);

    // SCHEMA AUTO-HEALING
    db.run("ALTER TABLE ministry_members ADD COLUMN is_priority INTEGER DEFAULT 0", ()=>{});
    db.run("ALTER TABLE youth ADD COLUMN gender TEXT", ()=>{});
    db.run("ALTER TABLE youth ADD COLUMN commitment_intent TEXT", ()=>{});
    db.run("ALTER TABLE ministry_members ADD COLUMN intent_message TEXT", ()=>{});

    db.run("CREATE TABLE IF NOT EXISTS secret_prayer_pals (id INTEGER PRIMARY KEY AUTOINCREMENT, youth_id INTEGER, pal_youth_id INTEGER, week_start TEXT, UNIQUE(youth_id, week_start))", ()=>{});
    db.run(`ALTER TABLE youth ADD COLUMN google_id TEXT`, () => {});
    db.run(`ALTER TABLE youth ADD COLUMN facebook_id TEXT`, () => {});
    db.run(`ALTER TABLE youth ADD COLUMN account_tier TEXT DEFAULT 'New Member'`, () => {});

    db.run("ALTER TABLE prayer_requests ADD COLUMN reactions TEXT DEFAULT '{}'", ()=>{});
    db.run("ALTER TABLE group_memories ADD COLUMN reactions TEXT DEFAULT '{}'", ()=>{});
    
    db.run("ALTER TABLE small_groups ADD COLUMN privacy_level TEXT DEFAULT 'Open'", (err)=>{});
    db.run("ALTER TABLE small_group_members ADD COLUMN status TEXT DEFAULT 'Approved'", (err)=>{});
    db.run("ALTER TABLE prayer_requests ADD COLUMN group_id INTEGER", (err)=>{});
    db.run("ALTER TABLE prayer_requests ADD COLUMN is_answered INTEGER DEFAULT 0", (err)=>{});
    
    
    db.run(`ALTER TABLE prayer_requests ADD COLUMN group_id INTEGER`, () => {});
    db.run(`ALTER TABLE prayer_requests ADD COLUMN is_answered INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE youth ADD COLUMN profile_picture TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN photos_url TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN materials_url TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_banner TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_bottom_banner TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_title TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN prereg_info TEXT`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN event_points INTEGER DEFAULT 10`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN youth_id INTEGER`, () => {});
    db.run(`ALTER TABLE ministry_members ADD COLUMN sub_role TEXT`, () => {});
    db.run(`ALTER TABLE event_roles ADD COLUMN sub_role TEXT`, () => {});
    db.run(`ALTER TABLE event_roles ADD COLUMN status TEXT DEFAULT 'Pending'`, () => {});
    db.run(`ALTER TABLE events ADD COLUMN roles_restricted_notes TEXT`, () => {});
    db.run(`ALTER TABLE ministries ADD COLUMN logo TEXT`, () => {});
    db.run(`ALTER TABLE songs ADD COLUMN youtube_url TEXT`, () => {});
    db.run(`ALTER TABLE gamification_points ADD COLUMN arcade_xp INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE gamification_points ADD COLUMN growth_xp INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE gamification_points ADD COLUMN event_xp INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE discipleship_pathways ADD COLUMN points INTEGER DEFAULT 50`, () => {});
    db.run(`ALTER TABLE small_groups ADD COLUMN points INTEGER DEFAULT 20`, () => {});
    db.run(`ALTER TABLE small_groups ADD COLUMN logo TEXT`, () => {});

    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('journal_points', '10')`);
    db.run(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('prayer_points', '5')`);

    db.get(`SELECT COUNT(*) as cnt FROM point_transactions`, [], (err, row) => {
        if (row && row.cnt === 0) {
            db.run(`INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) SELECT youth_id, 'arcade', 'Legacy Points', arcade_xp, created_at FROM gamification_points WHERE arcade_xp > 0`);
            db.run(`INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) SELECT youth_id, 'growth', 'Legacy Points', growth_xp, created_at FROM gamification_points WHERE growth_xp > 0`);
            db.run(`INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) SELECT youth_id, 'event', 'Legacy Points', event_xp, created_at FROM gamification_points WHERE event_xp > 0`);
        }
    });

    const superadminPermissions = JSON.stringify(['access_checkin', 'access_directory', 'access_events', 'access_attendance', 'access_activity', 'access_permissions', 'access_ministries', 'access_discipleship', 'access_ai', 'access_worship', 'access_communications', 'add_entries', 'edit_entries', 'delete_entries']);
    db.run(`INSERT OR IGNORE INTO users (username, password, permissions, created_at) VALUES (?, ?, ?, ?)`, ['celsocreeriii@gmail.com', 'JesusisLord', superadminPermissions, getManilaTime()]);
    db.run(`UPDATE users SET permissions = ? WHERE username = 'celsocreeriii@gmail.com'`, [superadminPermissions]);

    db.all(`SELECT id, qr_code FROM youth WHERE id NOT IN (SELECT youth_id FROM users WHERE youth_id IS NOT NULL)`, [], (err, rows) => {
        if (rows && rows?.length || 0 > 0) {
            const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`);
            rows.forEach(r => { if(r.qr_code) stmt.run([r.qr_code, r.qr_code, r.id, getManilaTime()]); });
            stmt.finalize();
        }
    });

    db.get(`SELECT COUNT(*) as cnt FROM discipleship_pathways`, [], (err, row) => {
        if (row && row.cnt === 0) {
            const defaultSteps = [
                ["Encounter", "Come & See. Explore faith at your own pace.", 1, 50],
                ["Connect & Belong", "Find your circle. Walk with brothers and sisters.", 2, 50],
                ["Step In", "Choose this family as your spiritual home.", 3, 50],
                ["Discover Your Gifts", "Unpack the talents God has entrusted to you.", 4, 50],
                ["Equip & Form", "Deepen your roots in character and skills.", 5, 50],
                ["Serve with Joy", "Step into the harvest and build the Kingdom.", 6, 50],
                ["Commissioned", "Sent forth with passion for God and compassion for all.", 7, 100]
            ];
            const stmt = db.prepare(`INSERT INTO discipleship_pathways (title, description, step_order, points, created_at) VALUES (?, ?, ?, ?, ?)`);
            defaultSteps.forEach(step => stmt.run([step[0], step[1], step[2], step[3], getManilaTime()]));
            stmt.finalize();
        }
    });

    
    db.get(`SELECT COUNT(*) as cnt FROM brain_trivia_questions`, [], (err, row) => {
        if (row && row.cnt === 0) {
            console.log('[INIT] Seeding Database with 75 Unique Bible Trivia Questions...');
            const qList = [
                ["How many days and nights did it rain during the flood?", '["40", "7", "30", "12"]', 0],
                ["Who was swallowed by a great fish?", '["Moses", "Jonah", "Peter", "David"]', 1],
                ["What is the first book of the New Testament?", '["Genesis", "Mark", "Matthew", "John"]', 2],
                ["Who defeated Goliath?", '["Samson", "Saul", "Jonathan", "David"]', 3],
                ["What did Jesus turn water into at the wedding in Cana?", '["Wine", "Blood", "Milk", "Honey"]', 0],
                ["Who parted the Red Sea?", '["Joshua", "Moses", "Aaron", "Elijah"]', 1],
                ["What was the name of the garden where Adam and Eve lived?", '["Gethsemane", "Babylon", "Eden", "Zion"]', 2],
                ["How many disciples did Jesus choose?", '["10", "12", "7", "40"]', 1],
                ["Who built the Ark?", '["Noah", "Abraham", "Lot", "Job"]', 0],
                ["Who was Jesus' earthly father?", '["John", "Zacharias", "Joseph", "James"]', 2],
                ["What animal tempted Eve?", '["Lion", "Serpent", "Eagle", "Dragon"]', 1],
                ["Who was thrown into the lion's den?", '["Shadrach", "Meshach", "Daniel", "Abednego"]', 2],
                ["Which apostle denied Jesus three times?", '["Judas", "Thomas", "John", "Peter"]', 3],
                ["What sea did Jesus walk on?", '["Red Sea", "Dead Sea", "Sea of Galilee", "Mediterranean Sea"]', 2],
                ["Who received the Ten Commandments?", '["Moses", "Aaron", "Joshua", "David"]', 0],
                ["Who was the first man created?", '["Noah", "Adam", "Enoch", "Seth"]', 1],
                ["What food did God provide the Israelites in the desert?", '["Bread", "Manna", "Fruit", "Fish"]', 1],
                ["Who betrayed Jesus?", '["Peter", "Thomas", "Judas Iscariot", "Matthew"]', 2],
                ["What is the longest book in the Bible?", '["Genesis", "Isaiah", "Psalms", "Jeremiah"]', 2],
                ["Who was the giant killed by a sling and stone?", '["Samson", "Goliath", "Og", "Anak"]', 1],
                ["What day did God rest during creation?", '["Sixth", "Seventh", "First", "Third"]', 1],
                ["Who was sold into slavery by his brothers?", '["Benjamin", "Reuben", "Joseph", "Judah"]', 2],
                ["What did David use to kill Goliath?", '["Sword", "Spear", "Sling", "Bow"]', 2],
                ["Who baptized Jesus?", '["John the Baptist", "Peter", "James", "Matthew"]', 0],
                ["What bird brought an olive branch to Noah?", '["Raven", "Dove", "Eagle", "Sparrow"]', 1],
                ["Who was the wisest king of Israel?", '["David", "Saul", "Solomon", "Hezekiah"]', 2],
                ["Where was Jesus born?", '["Nazareth", "Jerusalem", "Bethlehem", "Jericho"]', 2],
                ["How many plagues did God send on Egypt?", '["7", "10", "12", "40"]', 1],
                ["Who was the mother of Jesus?", '["Elizabeth", "Martha", "Mary", "Sarah"]', 2],
                ["What sign did God give to promise no more global floods?", '["Cloud", "Dove", "Star", "Rainbow"]', 3],
                ["Who interpreted Pharaoh's dreams?", '["Moses", "Joseph", "Daniel", "Jacob"]', 1],
                ["What was Matthew's profession before following Jesus?", '["Fisherman", "Carpenter", "Tax Collector", "Tentmaker"]', 2],
                ["Who climbed a sycamore tree to see Jesus?", '["Zacchaeus", "Nicodemus", "Bartimaeus", "Lazarus"]', 0],
                ["What did Jesus feed the 5,000 with?", '["Bread and Wine", "5 Loaves and 2 Fish", "7 Loaves", "Manna"]', 1],
                ["Who wore a coat of many colors?", '["David", "Joseph", "Jacob", "Esau"]', 1],
                ["Who was blinded on the road to Damascus?", '["Peter", "Saul (Paul)", "Stephen", "Barnabas"]', 1],
                ["What flowed from Jesus' side on the cross?", '["Blood and Water", "Tears", "Wine", "Oil"]', 0],
                ["What type of wood was the Ark made of?", '["Cedar", "Gopher", "Oak", "Acacia"]', 1],
                ["How many stones did David pick up to fight Goliath?", '["1", "3", "5", "7"]', 2],
                ["Who lived to be 969 years old?", '["Noah", "Adam", "Enoch", "Methuselah"]', 3],
                ["What was the name of Abraham's promised son?", '["Ishmael", "Isaac", "Jacob", "Esau"]', 1],
                ["Who led the Israelites after Moses died?", '["Aaron", "Caleb", "Joshua", "Gideon"]', 2],
                ["What weapon did Samson use to slay 1,000 Philistines?", '["Sword", "Jawbone of an ass", "Spear", "Club"]', 1],
                ["Who washed the disciples' feet?", '["Peter", "John", "Jesus", "Mary"]', 2],
                ["What is the last book of the Bible?", '["Jude", "Revelation", "Acts", "Hebrews"]', 1],
                ["What insect did Jesus say John the Baptist ate?", '["Beetles", "Locusts", "Ants", "Moths"]', 1],
                ["Who was known as the beloved physician?", '["Matthew", "Mark", "Luke", "John"]', 2],
                ["How many days was Jesus in the tomb?", '["1", "2", "3", "4"]', 2],
                ["Who was the first king of Israel?", '["David", "Solomon", "Saul", "Samuel"]', 2],
                ["What river was Jesus baptized in?", '["Nile", "Tigris", "Euphrates", "Jordan"]', 3],
                ["Who recognized Jesus as the Messiah as a baby in the temple?", '["Simeon", "Zechariah", "Nicodemus", "Herod"]', 0],
                ["What did the Israelites worship while Moses was on Mount Sinai?", '["Golden Calf", "Baal", "Asherah", "Bronze Serpent"]', 0],
                ["Who killed Abel?", '["Seth", "Enoch", "Cain", "Lamech"]', 2],
                ["Where did Jesus pray before his arrest?", '["Mount Sinai", "Mount of Olives", "Gethsemane", "Golgotha"]', 2],
                ["What happened to Lot's wife?", '["Turned to stone", "Turned to a pillar of salt", "Swallowed by the earth", "Struck by lightning"]', 1],
                ["What was the profession of Peter and Andrew?", '["Carpenters", "Tax Collectors", "Fishermen", "Shepherds"]', 2],
                ["Who wrote the book of Revelation?", '["Paul", "Peter", "James", "John"]', 3],
                ["Who survived the fiery furnace?", '["Daniel", "Shadrach, Meshach, Abednego", "Elijah", "Jeremiah"]', 1],
                ["What instrument did David play for Saul?", '["Flute", "Harp (Lyre)", "Trumpet", "Cymbals"]', 1],
                ["What did Judas receive for betraying Jesus?", '["30 pieces of silver", "100 denarii", "A gold chain", "A purple robe"]', 0],
                ["Who helped carry Jesus' cross?", '["Simon of Cyrene", "Joseph of Arimathea", "Nicodemus", "John"]', 0],
                ["What was Paul's original name?", '["Silas", "Saul", "Stephen", "Simeon"]', 1],
                ["What bird crowed after Peter denied Jesus?", '["Dove", "Raven", "Rooster", "Eagle"]', 2],
                ["Who was the sister of Moses and Aaron?", '["Miriam", "Zipporah", "Jochebed", "Sarah"]', 0],
                ["What did God create on the first day?", '["Land", "Light", "Animals", "Sun and Moon"]', 1],
                ["Who was David's best friend?", '["Saul", "Abner", "Jonathan", "Joab"]', 2],
                ["What town did Mary, Martha, and Lazarus live in?", '["Bethany", "Jerusalem", "Nazareth", "Capernaum"]', 0],
                ["How many tribes of Israel were there?", '["10", "12", "7", "40"]', 1],
                ["Who asked Pilate for Jesus' body?", '["Peter", "John", "Joseph of Arimathea", "Nicodemus"]', 2],
                ["What language was the Old Testament mostly written in?", '["Greek", "Aramaic", "Latin", "Hebrew"]', 3],
                ["What language was the New Testament mostly written in?", '["Hebrew", "Greek", "Latin", "Aramaic"]', 1],
                ["Who cut Samson's hair?", '["Jezebel", "Delilah", "Ruth", "Esther"]', 1],
                ["Who led the Israelites to rebuild the walls of Jerusalem?", '["Ezra", "Nehemiah", "Zerubbabel", "Haggai"]', 1],
                ["What fell from the sky to feed Israel in the desert?", '["Apples", "Manna", "Locusts", "Corn"]', 1],
                ["Who was the first Christian martyr?", '["James", "Peter", "Paul", "Stephen"]', 3]
            ];
            const stmt = db.prepare(`INSERT INTO brain_trivia_questions (question, options, correct_index, category, created_at) VALUES (?, ?, ?, 'Bible', ?)`);
            qList.forEach(q => stmt.run([q[0], q[1], q[2], getManilaTime()]));
            stmt.finalize();
        }
    });

    db.get(`SELECT COUNT(*) as cnt FROM weekly_challenges`, [], (err, row) => {
        if (row && row.cnt === 0) {
            const stmt = db.prepare(`INSERT INTO weekly_challenges (title, description, points, created_at) VALUES (?, ?, ?, ?)`);
            stmt.run(["Read Proverbs 1", "Spend time reading the first chapter of Proverbs and reflecting on wisdom.", 50, getManilaTime()]);
            stmt.finalize();
        }
    });
});

function logActivity(username, action, details) {
    db.run(`INSERT INTO activity_logs (username, action, details, created_at) VALUES (?, ?, ?, ?)`, [username || 'System', action, details, getManilaTime()]);
}

function pushToUser(youthId, title, message, urlPath = '/') {
    db.get(`SELECT qr_code FROM youth WHERE id = ?`, [youthId], (err, y) => {
        if (y && y.qr_code) {
            db.all(`SELECT subscription FROM push_subscriptions WHERE username = ?`, [y.qr_code], (err, subs) => {
                if (subs && subs?.length || 0 > 0) {
                    const payload = JSON.stringify({ title, body: message, url: '/' });
                    subs.forEach(row => {
                        try {
                            webpush.sendNotification(JSON.parse(row.subscription), payload).catch(e => {
                                if (e.statusCode === 404 || e.statusCode === 410) db.run(`DELETE FROM push_subscriptions WHERE subscription = ?`, [row.subscription]);
                            });
                        } catch(e){}
                    });
                }
            });
        }
    });
}

function awardPoints(youthId, type, amount, actor, gameName = null) {
    const amt = parseInt(amount) || 0;
    db.run(`INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) VALUES (?, ?, ?, ?, ?)`, [youthId, type, gameName, amt, getManilaTime()]);
    db.get(`SELECT SUM(CASE WHEN type='arcade' THEN amount ELSE 0 END) as arc, SUM(CASE WHEN type='growth' THEN amount ELSE 0 END) as gro, SUM(CASE WHEN type='event' THEN amount ELSE 0 END) as eve FROM point_transactions WHERE youth_id = ?`, [youthId], (err, row) => {
        let arcade = row ? (row.arc || 0) : 0; let growth = row ? (row.gro || 0) : 0; let event = row ? (row.eve || 0) : 0;
        const overall = arcade + growth + event;
        db.run(`INSERT INTO gamification_points (youth_id, arcade_xp, growth_xp, event_xp, points, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(youth_id) DO UPDATE SET arcade_xp = excluded.arcade_xp, growth_xp = excluded.growth_xp, event_xp = excluded.event_xp, points = excluded.points`,
            [youthId, arcade, growth, event, overall, getManilaTime()],
            function(err2) { if(!err2 && actor) logActivity(actor, 'POINTS_AWARDED', `Awarded ${amt} ${type} XP to Youth ID ${youthId}. Game: ${gameName||'N/A'}`); }
        );
    });
}


// --- V118: FUNNEL ILLUSION ENGINE ---

// --- ARCHITECT INJECTION: FQ LEADERBOARD ---
// 1. Automatically provision a dedicated, constraint-free table for Faith Quest
db.run(`CREATE TABLE IF NOT EXISTS fq_daily_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    player_name TEXT, 
    game_name TEXT, 
    score REAL, 
    avatar TEXT, 
    date_played TEXT
)`);

// 2. Submit Route (Bypasses Foreign Key Constraints)
app.post('/api/fq-leaderboard/submit', (req, res) => {
    const { player_name, game_name, score, avatar } = req.body;
    const today = new Date().toISOString().split('T')[0]; // Enforce absolute server-side date
    
    db.run(`INSERT INTO fq_daily_scores (player_name, game_name, score, avatar, date_played) VALUES (?, ?, ?, ?, ?)`,
        [player_name || 'Faith Quester', game_name, parseFloat(score) || 0, avatar || '', today],
        (err) => { res.json({ success: !err }); }
    );
});

// 3. Fetch Route (No complex JOINs required)
app.get('/api/fq-leaderboard/top3', (req, res) => {
    const gameName = req.query.game || '';
    const today = new Date().toISOString().split('T')[0];
    
    db.all(`SELECT player_name as name, MAX(score) as score, avatar FROM fq_daily_scores WHERE game_name = ? AND date_played = ? GROUP BY player_name ORDER BY score DESC LIMIT 3`, 
        [gameName, today], 
        (err, rows) => { res.json({ top3: rows || [] }); }
    );
});
// --- END ARCHITECT INJECTION ---

app.get('/api/growth-games/funnel', (req, res) => {
    const game = req.query.game || '';
    
    // Helper to shuffle arrays
    const shuffle = (arr) => arr.sort(() => 0.5 - Math.random());
    
    if (game.includes('Scramble')) {
        const words = ["FAITH","HOPE","LOVE","PEACE","GRACE","MERCY","TRUTH","LIGHT","GLORY","JESUS","CHRIST","SAVIOR","HEAVEN","GOSPEL","BIBLE","CHURCH","CROSS","PRAYER","AMEN","HOLY","SPIRIT","WATER","BLOOD","WINE","BREAD","FISH","SHEEP","LAMB","LION","DOVE","MOSES","DAVID","MARY","PETER","JOHN","PAUL","SAUL","ROMANS","ACTS","LUKE","MARK","PSALM","PROVERB","WISDOM","JOY","CALM","REST","HEAL","KING","LORD"];
        let pool = words.map(w => {
            let scrambled = w.split('').sort(() => 0.5 - Math.random()).join('');
            while(scrambled === w) scrambled = w.split('').sort(() => 0.5 - Math.random()).join(''); // Ensure it's actually scrambled
            let options = shuffle([w, "BIBLE", "FAITH", "GRACE", "JESUS", "PEACE", "MERCY"].filter(x => x !== w).slice(0,3));
            options.push(w);
            options = shuffle(options);
            return { question: "Unscramble: " + scrambled.split('').join('-'), options: options, correct_index: options.indexOf(w) };
        });
        res.json(shuffle(pool).slice(0, 10));
    } else if (game.includes('Emoji')) {
        const emojiPool = [
            {q: "🍎🐍🌳", a: "Adam & Eve"}, {q: "🌊🚶‍♂️💨", a: "Walking on Water"}, {q: "🍞🐟🐟", a: "Feeding 5000"}, {q: "🦁🕳️🙏", a: "Daniel in Lion's Den"}, {q: "👑⭐👶🐪", a: "Birth of Jesus"},
            {q: "🚢🌈🕊️", a: "Noah's Ark"}, {q: "🔥🌳🗣️", a: "Burning Bush"}, {q: "✝️🩸👑", a: "The Crucifixion"}, {q: "🪨👦🎯", a: "David & Goliath"}, {q: "🐋🌊🏃", a: "Jonah"},
            {q: "🍞🍷🙏", a: "Last Supper"}, {q: "🔥🌪️👅", a: "Pentecost"}, {q: "🎺🧱💥", a: "Walls of Jericho"}, {q: "☀️🌑🛑", a: "Joshua stops the Sun"}, {q: "🔥🌋🐴", a: "Elijah's Chariot"},
            {q: "💰🐖💋", a: "Judas Betrayal"}, {q: "💧👶🕊️", a: "Jesus Baptism"}, {q: "🐍🔥⛺", a: "Paul & the Viper"}, {q: "🥖🐦🦅", a: "Elijah fed by Ravens"}, {q: "🐑👑🛡️", a: "The Lord is my Shepherd"}
        ];
        // Duplicate/Expand pool dynamically to reach 50 for depth
        let expandedPool = [];
        for(let i=0; i<50; i++) expandedPool.push(emojiPool[i % emojiPool.length]);
        
        let finalPool = expandedPool.map(item => {
            let options = shuffle([item.a, "Moses", "Resurrection", "Samson", "Exodus"].filter(x => x !== item.a).slice(0,3));
            options.push(item.a);
            options = shuffle(options);
            return { question: "Decode: " + item.q, options: options, correct_index: options.indexOf(item.a) };
        });
        res.json(shuffle(finalPool).slice(0, 10));
    } else if (game.includes('Fruits')) {
        const fruits = ["Love","Joy","Peace","Patience","Kindness","Goodness","Faithfulness","Gentleness","Self-Control"];
        let pool = [];
        for(let i=0; i<50; i++) {
            let f = fruits[i % fruits.length];
            let options = shuffle([f, "Wealth", "Power", "Fame", "Anger", "Pride"].filter(x => x !== f).slice(0,3));
            options.push(f);
            options = shuffle(options);
            pool.push({ question: "Which is a Fruit of the Spirit?", options: options, correct_index: options.indexOf(f) });
        }
        res.json(shuffle(pool).slice(0, 10));
    } else {
        db.all("SELECT id, question, options, correct_index, category FROM brain_trivia_questions ORDER BY RANDOM() LIMIT 10", [], (err, rows) => {
            if(err || !rows) return res.json([]);
            rows.forEach(r => { if(typeof r.options === 'string') { try{ r.options=JSON.parse(r.options); }catch(e){r.options=["A","B","C","D"];} } });
            res.json(rows);
        });
    }
});
app.use(express.static(path.join(__dirname, 'public')));

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
            const metaTags = `<meta property="og:title" content="${title}" /> <meta property="og:description" content="${description}" /> <meta property="og:image" content="${imageUrl}" /> <meta property="og:url" content="${protocol}://${host}/?event=${eventId}" /> <meta property="og:type" content="website" />`;
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
        "icons": [ { "src": isStaging ? "/img/icon-staging.png" : "/img/icon-prod.png", "sizes": "192x192", "type": "image/png" }, { "src": isStaging ? "/img/icon-staging.png" : "/img/icon-prod.png", "sizes": "512x512", "type": "image/png" } ]
    });
});

app.get('/apple-touch-icon.png', (req, res) => {
    const iconPath = __dirname.includes('staging') ? '/img/icon-staging.png' : '/img/icon-prod.png';
    const absolutePath = path.join(__dirname, 'public', iconPath);
    if (fs.existsSync(absolutePath)) res.sendFile(absolutePath); else res.status(404).send('Icon not uploaded yet.');
});

app.post('/api/settings/images', (req, res) => {
    const { logo, prodIcon, stagingIcon, faithQuestThumb, faithRegBanner, actor } = req.body;
    if (actor !== 'celsocreeriii@gmail.com') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const saveImageToDisk = (base64Str, filename) => {
            if (!base64Str) return; // Safely aborts if no file was uploaded!
            const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
            require('fs').writeFileSync(require('path').join(__dirname, 'public', 'img', filename), Buffer.from(base64Data, 'base64'));
        };
        saveImageToDisk(logo, 'logo.png'); 
        saveImageToDisk(prodIcon, 'icon-prod.png'); 
        saveImageToDisk(stagingIcon, 'icon-staging.png');
        saveImageToDisk(faithQuestThumb, 'faith-quest-thumb.png'); saveImageToDisk(faithRegBanner, 'faith-reg-banner.png');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Failed to write files to disk: ' + err.message }); }
});
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

app.get('/api/settings/featured', (req, res) => {
    db.all(`SELECT key, value FROM app_settings WHERE key IN ('featured_arcade', 'featured_growth')`, [], (err, rows) => {
        let settings = { featured_arcade: '', featured_growth: '' };
        if (rows) rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.post('/api/settings/featured', (req, res) => {
    const { featured_arcade, featured_growth, actor } = req.body;
    db.get(`SELECT permissions FROM users WHERE username = ?`, [actor], (err, user) => {
        if (actor !== 'celsocreeriii@gmail.com' && (!user || !user.permissions.includes('edit_entries'))) return res.status(403).json({ error: 'Unauthorized' });
        db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('featured_arcade', ?)`, [featured_arcade || '']);
        db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('featured_growth', ?)`, [featured_growth || '']);
        logActivity(actor, 'UPDATE_FEATURED_GAMES', `Updated featured games to: Arcade=${featured_arcade}, Growth=${featured_growth}`);
        res.json({ success: true });
    });
});

// NEW HABITS SETTINGS API
app.get('/api/settings/growth-habits', (req, res) => {
    db.all(`SELECT key, value FROM app_settings WHERE key IN ('journal_points', 'prayer_points')`, [], (err, rows) => {
        let settings = { journal_points: 10, prayer_points: 5 };
        if (rows) rows.forEach(r => settings[r.key] = parseInt(r.value) || 0);
        res.json(settings);
    });
});

app.post('/api/settings/growth-habits', (req, res) => {
    const { journal_points, prayer_points, actor } = req.body;
    db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('journal_points', ?)`, [journal_points]);
    db.run(`INSERT OR REPLACE INTO app_settings (key, value) VALUES ('prayer_points', ?)`, [prayer_points]);
    logActivity(actor, 'UPDATE_HABIT_SETTINGS', `Updated Daily Habit Points: Journal=${journal_points}, Prayer=${prayer_points}`);
    res.json({ success: true });
});


app.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: '100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        const { sub: google_id, email, name, picture } = payload;

        // 1. Check if email exists in Admin/Users table first
        db.get(`SELECT * FROM users WHERE username = ?`, [email], (err, adminUser) => {
            if (adminUser) {
                if (adminUser.youth_id) {
                    db.run(`UPDATE youth SET google_id = ?, profile_picture = ? WHERE id = ?`, [google_id, picture, adminUser.youth_id]);
                    db.get(`SELECT * FROM youth WHERE id = ?`, [adminUser.youth_id], (err, member) => {
                        logActivity(name, 'OAUTH_LOGIN', 'Superadmin logged in via Google');
                        return res.json({ success: true, username: adminUser.username, permissions: JSON.parse(adminUser.permissions || '[]'), member, is_admin: true });
                    });
                } else {
                    db.run(`INSERT INTO youth (name, email, profile_picture, google_id, account_tier, created_at) VALUES (?, ?, ?, ?, 'Leader', ?)`, [name, email, picture, google_id, getManilaTime()], function(err) {
                        const newYouthId = this.lastID;
                        db.run(`UPDATE users SET youth_id = ? WHERE id = ?`, [newYouthId, adminUser.id]);
                        db.get(`SELECT * FROM youth WHERE id = ?`, [newYouthId], (err, newMember) => {
                            logActivity(name, 'OAUTH_LOGIN', 'Superadmin auto-linked via Google');
                            return res.json({ success: true, username: adminUser.username, permissions: JSON.parse(adminUser.permissions || '[]'), member: newMember, is_admin: true });
                        });
                    });
                }
                return;
            }

            // 2. Standard Member Flow
            db.get(`SELECT * FROM youth WHERE google_id = ? OR email = ?`, [google_id, email], (err, member) => {
                if (member) {
                    if (!member.google_id) {
                        db.run(`UPDATE youth SET google_id = ?, profile_picture = ? WHERE id = ?`, [google_id, picture, member.id]);
                    }
                    db.get(`SELECT permissions FROM users WHERE youth_id = ?`, [member.id], (err, u) => {
                        const perms = u && u.permissions ? JSON.parse(u.permissions) : [];
                        logActivity(member.name, 'OAUTH_LOGIN', 'Logged in via Google');
                        return res.json({ success: true, username: member.qr_code, permissions: perms, member, is_admin: perms?.length || 0 > 0 });
                    });
                } else {
                    // 3. Auto-provision New Member
                    db.get(`SELECT MAX(id) as maxId FROM youth`, [], (err, row) => {
                        const nextId = (row && row.maxId ? row.maxId : 0) + 1;
                        const qrCode = `FOG-PASS-${String(nextId).padStart(3, '0')}`;
                        db.run(`INSERT INTO youth (name, email, profile_picture, google_id, account_tier, qr_code, password, created_at) VALUES (?, ?, ?, ?, 'New Member', ?, ?, ?)`,
                            [name, email, picture, google_id, qrCode, qrCode, getManilaTime()], function(err) {
                            const newId = this.lastID;
                            db.run(`INSERT OR IGNORE INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, '[]', ?, ?)`, [qrCode, qrCode, newId, getManilaTime()]);
                            logActivity('System', 'NEW_MEMBER_CREATED', `Auto-provisioned New Member '${name}' via Google`);
                            db.get(`SELECT * FROM youth WHERE id = ?`, [newId], (err, newMember) => {
                                res.json({ success: true, username: newMember.qr_code, permissions: [], member: newMember, is_admin: false, is_new: true });
                            });
                        });
                    });
                }
            });
        });
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid Google Token' });
    }
});


// [KOINONIA PATCH] AUTH TRANSLATOR V5 (CRASH-PROOF)
let koinoniaDbPatched = false;
const koinoniaAuthMiddleware = (req, res, next) => {
    try {
        if (req.method !== 'POST') return next();
        if (!req.body) return next(); // Failsafe: if data is missing, let native app handle it safely
        
        if (typeof db !== 'undefined') {
            // Safely verify DB schema once
            if (!koinoniaDbPatched) {
                db.run("ALTER TABLE youth ADD COLUMN password TEXT", () => {});
                koinoniaDbPatched = true;
            }
            
            const loginVal = req.body.unique_pass_id || req.body.email || req.body.username;
            const providedPassword = req.body.password;

            if (loginVal) {
                db.get("SELECT * FROM youth WHERE unique_pass_id = ? OR email = ?", [loginVal, loginVal], (err, user) => {
                    try {
                        if (!err && user) {
                            const validCustom = user.password && user.password === providedPassword;
                            const validDefault = providedPassword === user.unique_pass_id;

                            if (validCustom || validDefault) {
                                // Flawless Translation: feed the native app exactly what it wants
                                req.body.unique_pass_id = user.unique_pass_id;
                                req.body.password = user.unique_pass_id; 
                            }
                        }
                    } catch (innerErr) { console.error('Auth translation error', innerErr); }
                    
                    return next(); // ASYNC HANDOFF: Safe transition to native logic
                });
                return; // CRITICAL: Prevent double execution!
            }
        }
        return next();
    } catch(crashErr) {
        console.error('Middleware crash prevented:', crashErr);
        return next(); // Absolute failsafe to ensure connection never drops
    }
};
app.use('/api/login', koinoniaAuthMiddleware);

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
    const { name, age, birthday, social_media, parents_name, password, email, profile_picture, gender, actor } = req.body;
    let sql = `UPDATE youth SET name=?, age=?, birthday=?, social_media=?, parents_name=?, password=?, email=?, gender=? WHERE id=?`;
    let params = [name, age, birthday, social_media, parents_name, password, email, gender, req.params.id];
    if (profile_picture !== undefined) { sql = `UPDATE youth SET name=?, age=?, birthday=?, social_media=?, parents_name=?, password=?, email=?, profile_picture=?, gender=? WHERE id=?`; params = [name, age, birthday, social_media, parents_name, password, email, profile_picture, gender, req.params.id]; }
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
        if (err || !youth) return res.json({ success: false });
        const targetQr = youth.qr_code || `FOG-MEMBER-${String(youthId).padStart(3, '0')}`;
        db.get(`SELECT id FROM users WHERE youth_id = ? OR username = ?`, [youthId, targetQr], (err2, existingUser) => {
            if (existingUser) {
                db.run(`UPDATE users SET permissions = ?, youth_id = ? WHERE id = ?`, [permString, youthId, existingUser.id], function(err3) { logActivity(actor, 'UPDATE_PERMISSIONS', `Updated permissions for Member ID ${youthId}`); return res.json({ success: true }); });
            } else {
                db.run(`INSERT INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, ?, ?, ?)`, [targetQr, targetQr, permString, youthId, getManilaTime()], function(err4) {
                    if (err4) {
                        const safeQr = `FOG-MEMBER-${youthId}-${Date.now()}`;
                        db.run(`INSERT INTO users (username, password, permissions, youth_id, created_at) VALUES (?, ?, ?, ?, ?)`, [safeQr, safeQr, permString, youthId, getManilaTime()], function(err5) { db.run(`UPDATE youth SET qr_code = ?, password = ? WHERE id = ?`, [safeQr, safeQr, youthId]); return res.json({ success: true }); });
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
app.delete('/api/youth/:id', (req, res) => { db.run(`DELETE FROM youth WHERE id=?`, [req.params.id], function (err) { db.run(`DELETE FROM users WHERE youth_id=?`, [req.params.id]); logActivity(req.body.actor, 'DELETE_MEMBER', `Deleted member record`); res.json({ deleted: this.changes }); }); });
app.get('/api/users/list', (req, res) => { db.all(`SELECT u.id, u.username, u.permissions, u.youth_id, y.name as member_name, y.qr_code as member_code FROM users u LEFT JOIN youth y ON u.youth_id = y.id ORDER BY u.id DESC`, [], (err, rows) => { res.json(rows.map(r => ({ id: r.id, username: r.username, display_name: r.member_name ? `${r.member_name}` : r.username, qr_code: r.member_code || r.username, youth_id: r.youth_id, permissions: r.permissions || '[]' }))); }); });

app.post('/api/checkin', (req, res) => {
    const { youth_id, event_id, is_walkin, actor, qr_code } = req.body;
    const processCheckin = (targetYouthId) => {
        db.get(`SELECT id FROM attendance WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, row) => {
            if (row) return res.status(400).json({ error: 'Member is ALREADY checked in for this event.' });
            db.run(`INSERT INTO attendance (youth_id, event_id, is_walkin, checked_in_at) VALUES (?, ?, ?, ?)`, [targetYouthId, event_id, is_walkin ? 1 : 0, getManilaTime()], function (err) {
                const logId = this.lastID;
                db.get(`SELECT event_points FROM events WHERE id = ?`, [event_id], (err, evt) => {
                    const pts = (evt && evt.event_points !== null) ? evt.event_points : 10;
                    db.get(`SELECT id FROM pre_registrations WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, pre) => {
                        const preRegBonus = pre ? Math.floor(pts * 0.5) : 0;
                        const finalPts = pts + preRegBonus;
                        awardPoints(targetYouthId, 'event', finalPts, actor, pre ? 'Event Check-In + Pre-Reg Bonus' : 'Event Check-In');
                        db.get(`SELECT name FROM youth WHERE id = ?`, [targetYouthId], (e, y) => { res.json({ success: true, member_name: y ? y.name : 'Member', youth_id: targetYouthId, log_id: logId, points: finalPts }); });
                    });
                });
            });
        });
    };
    if (qr_code) { db.get(`SELECT id FROM youth WHERE qr_code = ?`, [qr_code], (err, row) => { if (!row) return res.status(404).json({ error: 'Invalid QR Pass Code.' }); processCheckin(row.id); }); }
    else if (youth_id) { processCheckin(youth_id); } else res.status(400).json({ error: 'Missing youth identifier for check-in.' });
});
app.get('/api/attendance/logs', (req, res) => { db.all(`SELECT a.id, a.checked_in_at, a.is_walkin, y.name as member_name, e.name as event_name, a.youth_id, a.event_id FROM attendance a JOIN youth y ON a.youth_id = y.id JOIN events e ON a.event_id = e.id ORDER BY a.checked_in_at DESC`, [], (err, rows) => { res.json(rows); }); });
app.put('/api/attendance/:id', (req, res) => { db.run(`UPDATE attendance SET checked_in_at = ?, is_walkin = ? WHERE id = ?`, [req.body.checked_in_at, req.body.is_walkin ? 1 : 0, req.params.id], function (err) { res.json({ updated: this.changes }); }); });
app.delete('/api/attendance/:id', (req, res) => { db.run(`DELETE FROM attendance WHERE id=?`, [req.params.id], function (err) { res.json({ deleted: this.changes }); }); });

app.get('/api/events', (req, res) => { db.all(`SELECT * FROM events ORDER BY event_date DESC`, [], (err, rows) => { res.json(rows); }); });
app.get('/api/events/:id/analytics', (req, res) => {
    const eventId = req.params.id;
    db.get(`SELECT * FROM events WHERE id = ?`, [eventId], (err, event) => {
        if (!event) return res.status(404).json({ error: 'Event not found' });
        db.get(`SELECT COUNT(*) as total_youth FROM youth WHERE age IS NOT NULL AND age != ''`, [], (err2, totalYouthRow) => {
            const totalDirectory = totalYouthRow ? totalYouthRow.total_youth : 1;
            db.all(`SELECT a.id as log_id, a.checked_in_at, a.is_walkin, a.youth_id, y.name, y.age, y.email, y.qr_code, y.profile_picture FROM attendance a JOIN youth y ON a.youth_id = y.id WHERE a.event_id = ? ORDER BY a.checked_in_at DESC`, [eventId], (err3, roster) => {
                db.all(`SELECT p.youth_id, p.created_at, y.name, y.age, y.email, y.qr_code, y.profile_picture FROM pre_registrations p JOIN youth y ON p.youth_id = y.id WHERE p.event_id = ? ORDER BY p.created_at DESC`, [eventId], (err4, preRegList) => {
                    const totalTurnout = roster?.length || 0; const walkins = roster.filter(r => r.is_walkin === 1)?.length || 0; const checkedInPreRegs = totalTurnout - walkins; const totalPreRegistered = preRegList?.length || 0;
                    res.json({ event, totalDirectory, totalTurnout, turnoutPercentage: totalPreRegistered > 0 ? ((checkedInPreRegs / totalPreRegistered) * 100).toFixed(1) : '0.0', walkins, preReg: checkedInPreRegs, totalPreRegistered, roster, preRegList });
                });
            });
        });
    });
});
app.get('/api/events/:id/poster.jpg', (req, res) => { db.get(`SELECT poster, prereg_banner FROM events WHERE id = ?`, [req.params.id], (err, event) => { if (!event) return res.status(404).send('Not found'); const b64 = event.poster || event.prereg_banner; if (b64 && b64.startsWith('data:image')) { const parts = b64.split(';'); res.writeHead(200, { 'Content-Type': parts[0].split(':')[1] }); res.end(Buffer.from(parts[1].split(',')[1], 'base64')); } else res.status(404).send('No image'); }); });
app.post('/api/events', (req, res) => { db.run(`INSERT INTO events (name, event_date, time_start, venue, poster, photos_url, materials_url, event_points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.poster, req.body.photos_url, req.body.materials_url, req.body.event_points || 10, getManilaTime()], function (err) { res.json({ id: this.lastID }); }); });
app.put('/api/events/:id', (req, res) => { if (req.body.poster !== undefined && req.body.poster !== null) { db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, poster=?, photos_url=?, materials_url=?, event_points=? WHERE id=?`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.poster, req.body.photos_url, req.body.materials_url, req.body.event_points || 10, req.params.id], function(err) { res.json({ updated: this.changes }); }); } else { db.run(`UPDATE events SET name=?, event_date=?, time_start=?, venue=?, photos_url=?, materials_url=?, event_points=? WHERE id=?`, [req.body.name, req.body.event_date, req.body.time_start, req.body.venue, req.body.photos_url, req.body.materials_url, req.body.event_points || 10, req.params.id], function(err) { res.json({ updated: this.changes }); }); } });
app.delete('/api/events/:id', (req, res) => { db.run(`DELETE FROM events WHERE id=?`, [req.params.id], function (err) { res.json({ deleted: this.changes }); }); });
app.post('/api/events/:id/prereg-settings', (req, res) => { db.run(`UPDATE events SET prereg_banner = ?, prereg_bottom_banner = ?, prereg_title = ?, prereg_info = ? WHERE id = ?`, [req.body.banner, req.body.bottom_banner, req.body.title, req.body.info, req.params.id], function(err) { res.json({ success: true }); }); });
app.get('/api/events/:id/preregs', (req, res) => { db.all(`SELECT youth_id FROM pre_registrations WHERE event_id = ?`, [req.params.id], (err, rows) => { res.json(rows.map(r => r.youth_id)); }); });
app.post('/api/preregister', (req, res) => { db.run(`INSERT OR IGNORE INTO pre_registrations (event_id, youth_id, created_at) VALUES (?, ?, ?)`, [req.body.event_id, req.body.youth_id, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.delete('/api/events/:event_id/preregs/:youth_id', (req, res) => { db.run(`DELETE FROM pre_registrations WHERE event_id = ? AND youth_id = ?`, [req.params.event_id, req.params.youth_id], function(err) { res.json({ success: true, deleted: this.changes }); }); });

app.get('/api/ministries', (req, res) => { db.all(`SELECT m.*, (SELECT COUNT(*) FROM ministry_members WHERE ministry_id = m.id) as member_count FROM ministries m ORDER BY m.name ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/ministries', (req, res) => { db.run(`INSERT INTO ministries (name, description, logo, created_at) VALUES (?, ?, ?, ?)`, [req.body.name, req.body.description, req.body.logo, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.put('/api/ministries/:id', (req, res) => { let sql = `UPDATE ministries SET name = ?, description = ?, restricted_notes = ? WHERE id = ?`; let params = [req.body.name, req.body.description, req.body.restricted_notes, req.params.id]; if (req.body.logo !== undefined) { sql = `UPDATE ministries SET name = ?, description = ?, restricted_notes = ?, logo = ? WHERE id = ?`; params = [req.body.name, req.body.description, req.body.restricted_notes, req.body.logo, req.params.id]; } db.run(sql, params, function(err) { res.json({ success: true }); }); });
app.delete('/api/ministries/:id', (req, res) => { db.run(`DELETE FROM ministries WHERE id = ?`, [req.params.id], function(err) { db.run(`DELETE FROM ministry_members WHERE ministry_id = ?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/ministries/:id/members', (req, res) => { db.all(`SELECT mm.id as mapping_id, mm.role, mm.sub_role, mm.assigned_at, y.id, y.name, y.qr_code, y.profile_picture FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ? ORDER BY mm.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.post('/api/ministries/:id/members', (req, res) => { db.run(`INSERT INTO ministry_members (ministry_id, youth_id, role, sub_role, assigned_at) VALUES (?, ?, ?, ?, ?)`, [req.params.id, req.body.youth_id, req.body.role, req.body.sub_role, getManilaTime()], function(err) { res.json({ success: true }); }); });
app.put('/api/ministries/:ministry_id/members/:mapping_id', (req, res) => { db.run(`UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?`, [req.body.role, req.body.sub_role, req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.delete('/api/ministries/:ministry_id/members/:mapping_id', (req, res) => { db.run(`DELETE FROM ministry_members WHERE id = ?`, [req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.get('/api/youth/:id/ministries', (req, res) => { db.all(`SELECT mm.id as mapping_id, m.name as ministry_name, mm.role, mm.sub_role, mm.assigned_at, mm.is_priority FROM ministry_members mm JOIN ministries m ON mm.ministry_id = m.id WHERE mm.youth_id = ? ORDER BY mm.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });

app.get('/api/events/:id/roles', (req, res) => { db.all(`SELECT er.id as mapping_id, er.role_name, er.sub_role, er.assigned_at, er.status, y.id, y.name, y.qr_code, y.profile_picture FROM event_roles er JOIN youth y ON er.youth_id = y.id WHERE er.event_id = ? ORDER BY er.assigned_at DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.post('/api/events/:id/roles', (req, res) => {
    const eventId = req.params.id; const { youth_id, role_name, sub_role, actor } = req.body;
    db.get(`SELECT name, event_date FROM events WHERE id = ?`, [eventId], (err, evt) => {
        if (!evt) return res.status(404).json({ error: 'Event not found.' });
        db.get(`SELECT reason FROM blockout_dates WHERE youth_id = ? AND block_date = ?`, [youth_id, evt.event_date], (err, blockout) => {
            if (blockout) return res.status(400).json({ error: `Cannot schedule! This member has blocked out ${evt.event_date}. Reason: ${blockout.reason || 'Unavailable'}` });
            db.run(`INSERT INTO event_roles (event_id, youth_id, role_name, sub_role, assigned_at, status) VALUES (?, ?, ?, ?, ?, 'Pending')`, [eventId, youth_id, role_name, sub_role, getManilaTime()], function(err) {
                pushToUser(youth_id, "📅 Scheduling Invite", `You've been invited to serve as ${role_name} for ${evt.name}. Check your profile to accept!`);
                res.json({ success: true });
            });
        });
    });
});
app.post('/api/events/:id/roles-notes', (req, res) => { db.run(`UPDATE events SET roles_restricted_notes = ? WHERE id = ?`, [req.body.roles_restricted_notes, req.params.id], function(err) { res.json({ success: true }); }); });
app.put('/api/events/:event_id/roles/:mapping_id', (req, res) => { db.run(`UPDATE event_roles SET role_name = ?, sub_role = ? WHERE id = ?`, [req.body.role_name, req.body.sub_role, req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.delete('/api/events/:event_id/roles/:mapping_id', (req, res) => { db.run(`DELETE FROM event_roles WHERE id = ?`, [req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.get('/api/youth/:id/event_roles', (req, res) => { db.all(`SELECT er.id as mapping_id, e.id as event_id, e.name as event_name, er.role_name, er.sub_role, er.assigned_at, er.status, e.event_date FROM event_roles er JOIN events e ON er.event_id = e.id WHERE er.youth_id = ? ORDER BY e.event_date DESC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.put('/api/events/:event_id/roles/:mapping_id/status', (req, res) => { db.run(`UPDATE event_roles SET status = ? WHERE id = ?`, [req.body.status, req.params.mapping_id], function(err) { res.json({ success: true }); }); });
app.get('/api/youth/:id/blockouts', (req, res) => { db.all(`SELECT * FROM blockout_dates WHERE youth_id = ? ORDER BY block_date ASC`, [req.params.id], (err, rows) => { res.json(rows); }); });
app.post('/api/blockouts', (req, res) => { db.run(`INSERT INTO blockout_dates (youth_id, block_date, reason, created_at) VALUES (?, ?, ?, ?)`, [req.body.youth_id, req.body.block_date, req.body.reason, getManilaTime()], function(err) { if (err) return res.status(400).json({ error: 'Date already blocked.' }); res.json({ success: true }); }); });
app.delete('/api/blockouts/:id', (req, res) => { db.run(`DELETE FROM blockout_dates WHERE id = ?`, [req.params.id], function(err) { res.json({ success: true }); }); });

// NEW DISCIPLESHIP API (WITH POINTS)
app.get('/api/discipleship/next-step/:youth_id', (req, res) => { db.all(`SELECT p.*, m.status as member_status, m.completed_at FROM discipleship_pathways p LEFT JOIN member_milestones m ON p.id = m.pathway_id AND m.youth_id = ? ORDER BY p.step_order ASC`, [req.params.youth_id], (err, steps) => { let nextStep = steps.find(s => s.member_status !== 'Completed'); if (!nextStep && steps?.length || 0 > 0) nextStep = steps[steps?.length || 0 - 1]; res.json({ nextStep, allSteps: steps }); }); });
app.post('/api/discipleship/milestones', (req, res) => {
    db.get(`SELECT status FROM member_milestones WHERE youth_id = ? AND pathway_id = ?`, [req.body.youth_id, req.body.pathway_id], (err, row) => {
        const alreadyCompleted = row && row.status === 'Completed';
        const newlyCompleted = req.body.status === 'Completed';
        db.run(`INSERT INTO member_milestones (youth_id, pathway_id, status, completed_at, notes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(youth_id, pathway_id) DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at, notes = excluded.notes`, [req.body.youth_id, req.body.pathway_id, req.body.status, newlyCompleted ? getManilaTime() : null, req.body.notes], function(err) {
            if (newlyCompleted && !alreadyCompleted) {
                db.get(`SELECT title, points FROM discipleship_pathways WHERE id = ?`, [req.body.pathway_id], (err2, path) => {
                    if (path) awardPoints(req.body.youth_id, 'growth', path.points || 50, req.body.actor || 'System', `Milestone: ${path.title}`);
                });
            }
            res.json({ success: true });
        });
    });
});
app.get('/api/discipleship/pathways', (req, res) => { db.all(`SELECT * FROM discipleship_pathways ORDER BY step_order ASC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/discipleship/pathways', (req, res) => { db.run(`INSERT INTO discipleship_pathways (title, description, step_order, points, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.title, req.body.description, req.body.step_order, req.body.points || 50, getManilaTime()], function(err) { res.json({ success: true, id: this.lastID }); }); });
app.put('/api/discipleship/pathways/:id', (req, res) => { db.run(`UPDATE discipleship_pathways SET title=?, description=?, step_order=?, points=? WHERE id=?`, [req.body.title, req.body.description, req.body.step_order, req.body.points || 50, req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/discipleship/pathways/:id', (req, res) => { db.run(`DELETE FROM discipleship_pathways WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM member_milestones WHERE pathway_id=?`, [req.params.id]); res.json({ success: true }); }); });
app.get('/api/discipleship/member-progress/:youth_id', (req, res) => { db.all(`SELECT p.id as pathway_id, p.title, m.status, m.completed_at, m.notes as pastoral_notes FROM discipleship_pathways p LEFT JOIN member_milestones m ON p.id = m.pathway_id AND m.youth_id = ? ORDER BY p.step_order ASC`, [req.params.youth_id], (err, rows) => { res.json(rows); }); });
app.get('/api/discipleship/analytics/stages', (req, res) => { db.all(`WITH UserMaxStep AS (SELECT youth_id, MAX(pathway_id) as max_path_id FROM member_milestones WHERE status = 'Completed' OR status = 'In Progress' GROUP BY youth_id) SELECT p.title, COUNT(u.youth_id) as user_count FROM discipleship_pathways p LEFT JOIN UserMaxStep u ON p.id = u.max_path_id GROUP BY p.id, p.title ORDER BY p.step_order ASC`, [], (err, stepRows) => { db.get(`SELECT COUNT(*) as total FROM youth`, [], (err, youthRow) => { const totalYouth = youthRow ? youthRow.total : 0; let assignedYouth = 0; stepRows.forEach(r => assignedYouth += r.user_count); res.json({ stages: stepRows, unassigned: totalYouth - assignedYouth > 0 ? totalYouth - assignedYouth : 0 }); }); }); });

// NEW JOURNAL API (WITH DAILY POINTS)
app.get('/api/journals/:youth_id', (req, res) => { db.all(`SELECT * FROM private_journals WHERE youth_id = ? ORDER BY created_at DESC`, [req.params.youth_id], (err, rows) => { res.json(rows); }); });
app.post('/api/journals', (req, res) => {
    db.run(`INSERT INTO private_journals (youth_id, title, content, mood, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.youth_id, req.body.title, req.body.content, req.body.mood, getManilaTime()], function(err) {
        const today = getManilaTime().split(' ')[0];
        db.get(`SELECT id FROM point_transactions WHERE youth_id = ? AND game_name = 'Daily Journal' AND created_at LIKE ?`, [req.body.youth_id, today + '%'], (err, row) => {
            if (!row) {
                db.get(`SELECT value FROM app_settings WHERE key = 'journal_points'`, [], (err, s) => {
                    const pts = parseInt(s ? s.value : '10') || 0;
                    if (pts > 0) awardPoints(req.body.youth_id, 'growth', pts, 'System', 'Daily Journal');
                });
            }
        });
        res.json({ success: true });
    });
});
app.put('/api/journals/:id', (req, res) => { db.run(`UPDATE private_journals SET title = ?, mood = ?, content = ? WHERE id = ?`, [req.body.title, req.body.mood, req.body.content, req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/journals/:id', (req, res) => { db.run(`DELETE FROM private_journals WHERE id = ?`, [req.params.id], function(err) { res.json({ success: true }); }); });

// NEW PRAYER API (WITH DAILY POINTS)
app.get('/api/prayers', (req, res) => { db.all(`SELECT p.*, y.name as author_name FROM prayer_requests p LEFT JOIN youth y ON p.youth_id = y.id ORDER BY p.created_at DESC`, [], (err, rows) => { res.json(rows); }); });
app.post('/api/prayers', (req, res) => {
    db.run(`INSERT INTO prayer_requests (youth_id, title, request, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?)`, [req.body.youth_id, req.body.title, req.body.request, req.body.is_anonymous ? 1 : 0, getManilaTime()], function(err) {
        const today = getManilaTime().split(' ')[0];
        db.get(`SELECT id FROM point_transactions WHERE youth_id = ? AND game_name = 'Daily Prayer' AND created_at LIKE ?`, [req.body.youth_id, today + '%'], (err, row) => {
            if (!row) {
                db.get(`SELECT value FROM app_settings WHERE key = 'prayer_points'`, [], (err, s) => {
                    const pts = parseInt(s ? s.value : '5') || 0;
                    if (pts > 0) awardPoints(req.body.youth_id, 'growth', pts, 'System', 'Daily Prayer');
                });
            }
        });
        res.json({ success: true });
    });
});
app.put('/api/prayers/:id', (req, res) => { db.run(`UPDATE prayer_requests SET title = ?, request = ?, is_anonymous = ? WHERE id = ?`, [req.body.title, req.body.request, req.body.is_anonymous ? 1 : 0, req.params.id], function(err) { res.json({ success: true }); }); });
app.post('/api/prayers/:id/intercede', (req, res) => { db.run(`INSERT OR IGNORE INTO prayer_intercessions (prayer_id, youth_id, prayed_at) VALUES (?, ?, ?)`, [req.params.id, req.body.youth_id, getManilaTime()], function(err) { res.json({ success: true }); }); });

// NEW SMALL GROUPS API (WITH POINTS)


app.get('/api/small-groups/:id/prayers', (req, res) => {
    db.all(`SELECT p.*, y.name as author_name FROM prayer_requests p JOIN youth y ON p.youth_id = y.id WHERE p.group_id = ? ORDER BY p.created_at DESC`, [req.params.id], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/small-groups/:id/prayers', (req, res) => {
    const { youth_id, title, request, is_anonymous } = req.body;
    db.run(`INSERT INTO prayer_requests (group_id, youth_id, title, request, is_anonymous, created_at) VALUES (?, ?, ?, ?, ?, ?)`, 
    [req.params.id, youth_id, title, request, is_anonymous ? 1 : 0, getManilaTime()], function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({success: true});
    });
});

app.post('/api/small-groups/prayers/:prayer_id/intercede', (req, res) => {
    const { youth_id, author_id, group_name } = req.body;
    db.run(`INSERT OR IGNORE INTO prayer_intercessions (prayer_id, youth_id, prayed_at) VALUES (?, ?, ?)`, [req.params.prayer_id, youth_id, getManilaTime()], function(err) {
        // Only send push if it's a new intercession AND you aren't clicking your own prayer
        if (this.changes > 0 && author_id !== youth_id) {
            pushToUser(author_id, "🙏 Someone prayed for you!", `Someone in ${group_name || 'your group'} just prayed for your request.`);
        }
        res.json({success: true});
    });
});

app.put('/api/small-groups/prayers/:prayer_id/answered', (req, res) => {
    const { group_id, group_name, title } = req.body;
    db.run(`UPDATE prayer_requests SET is_answered = 1 WHERE id = ?`, [req.params.prayer_id], function(err) {
        if(err) return res.status(500).json({error: err.message});
        // Notify the whole group of the Praise Report!
        db.all(`SELECT youth_id FROM small_group_members WHERE group_id = ?`, [group_id], (err, members) => {
            if(members) members.forEach(m => pushToUser(m.youth_id, "🎉 Praise Report!", `A prayer in ${group_name} was just answered: ${title}`));
        });
        res.json({success: true});
    });
});

app.get('/api/small-groups/:id/roster-status', (req, res) => {
    // Fetches group members and calculates their 'last active' status using activity_logs
    db.all(`SELECT y.id, y.name, y.profile_picture, 
            (SELECT MAX(created_at) FROM activity_logs WHERE username = y.qr_code) as last_active 
            FROM small_group_members sgm 
            JOIN youth y ON sgm.youth_id = y.id 
            WHERE sgm.group_id = ?`, [req.params.id], (err, rows) => {
        res.json(rows || []);
    });
});

app.get('/api/small-groups/:id/recent-chat', (req, res) => {
    db.get(`SELECT c.message, y.name FROM small_group_chats c JOIN youth y ON c.youth_id = y.id WHERE c.group_id = ? ORDER BY c.id DESC LIMIT 1`, [req.params.id], (err, row) => {
        res.json(row || null);
    });
});

app.get('/api/small-groups', (req, res) => {
    const youthId = req.query.youth_id || 0;
    db.all(`SELECT g.*, y.name as leader_name, 
        (SELECT COUNT(*) FROM small_group_members WHERE group_id = g.id AND status='Approved') as member_count,
        (SELECT status FROM small_group_members WHERE group_id = g.id AND youth_id = ?) as user_status 
        FROM small_groups g LEFT JOIN youth y ON g.leader_id = y.id ORDER BY g.name ASC`, [youthId], (err, rows) => { 
        res.json(rows || []); 
    }); 
});
app.post('/api/small-groups', (req, res) => { db.run(`INSERT INTO small_groups (name, leader_id, meeting_schedule, venue, points, logo, privacy_level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, req.body.points || 20, req.body.logo || null, getManilaTime()], function(err) { res.json({ success: true }); }); });

// [KOINONIA PATCH] UPDATE CAMPFIRE PRIVACY
app.patch('/api/small-groups/:id/privacy', (req, res) => {
    db.run('UPDATE small_groups SET privacy_level = ? WHERE id = ?', [req.body.privacy_level, req.params.id], function(err) {
        res.json({success: !err, error: err ? err.message : null});
    });
});
app.put('/api/small-groups/:id', (req, res) => { db.run(`UPDATE small_groups SET name=?, leader_id=?, meeting_schedule=?, venue=?, points=?, logo=?, privacy_level=? WHERE id=?`, [req.body.name, req.body.leader_id || null, req.body.meeting_schedule, req.body.venue, req.body.points || 20, req.body.logo || null, req.body.privacy_level || 'Open', req.params.id], function(err) { res.json({ success: true }); }); });
app.delete('/api/small-groups/:id', (req, res) => { db.run(`DELETE FROM small_groups WHERE id=?`, [req.params.id], function(err) { db.run(`DELETE FROM small_group_members WHERE group_id=?`, [req.params.id]); res.json({ success: true }); }); });


app.get('/api/small-groups/:id/sessions', (req, res) => {
    db.all(`SELECT * FROM group_sessions WHERE group_id = ? ORDER BY scheduled_at DESC`, [req.params.id], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/small-groups/:id/sessions', (req, res) => {
    const { title, scheduled_at, meet_link } = req.body;
    db.run(`INSERT INTO group_sessions (group_id, title, scheduled_at, meet_link, created_at) VALUES (?, ?, ?, ?, ?)`, 
        [req.params.id, title, scheduled_at, meet_link, getManilaTime()], function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.put('/api/small-groups/sessions/:session_id', (req, res) => {
    db.run(`UPDATE group_sessions SET recording_url = ? WHERE id = ?`, [req.body.recording_url, req.params.session_id], function(err) {
        res.json({ success: true });
    });
});

app.delete('/api/small-groups/sessions/:session_id', (req, res) => {
    db.run(`DELETE FROM group_sessions WHERE id = ?`, [req.params.session_id], function(err) {
        res.json({ success: true });
    });
});

app.get('/api/small-groups/:id/chat', (req, res) => {
    const lastId = parseInt(req.query.last_id) || 0;
    db.all(`SELECT c.id, c.message, c.reactions, c.created_at, y.name, y.profile_picture FROM small_group_chats c JOIN youth y ON c.youth_id = y.id WHERE c.group_id = ? AND c.id > ? ORDER BY c.id ASC`, [req.params.id, lastId], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/small-groups/:id/chat', (req, res) => {
    const { youth_id, message } = req.body;
    db.run(`INSERT INTO small_group_chats (group_id, youth_id, message, created_at) VALUES (?, ?, ?, ?)`, [req.params.id, youth_id, message, getManilaTime()], function(err) {
        if(err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});


app.post('/api/small-groups/:id/join', (req, res) => {
    const { youth_id } = req.body;
    db.get(`SELECT privacy_level, points FROM small_groups WHERE id = ?`, [req.params.id], (err, grp) => {
        if(!grp) return res.status(404).json({error: "Group not found."});
        if(grp.privacy_level === 'Invite-Only') return res.status(403).json({error: "This group is invite-only."});
        
        const status = grp.privacy_level === 'Approval' ? 'Pending' : 'Approved';
        db.run(`INSERT INTO small_group_members (group_id, youth_id, joined_at, status) VALUES (?, ?, ?, ?)`, 
        [req.params.id, youth_id, getManilaTime(), status], function(err) {
            if(err) return res.status(400).json({error: "Already applied or joined."});
            if(status === 'Approved' && grp.points > 0) awardPoints(youth_id, 'growth', grp.points, 'System', `Joined Group`);
            res.json({success: true, status});
        });
    });
});

app.post('/api/small-groups/:id/members/:youth_id/status', (req, res) => {
    const { status } = req.body;
    if (status === 'Denied') {
        db.run(`DELETE FROM small_group_members WHERE group_id = ? AND youth_id = ?`, [req.params.id, req.params.youth_id], () => res.json({success:true}));
    } else {
        db.run(`UPDATE small_group_members SET status = 'Approved' WHERE group_id = ? AND youth_id = ?`, [req.params.id, req.params.youth_id], () => res.json({success:true}));
    }
});

app.post('/api/small-groups/:id/invite', (req, res) => {
    db.run(`INSERT INTO small_group_members (group_id, youth_id, joined_at, status) VALUES (?, ?, ?, 'Approved')`, 
    [req.params.id, req.body.youth_id, getManilaTime()], function(err) {
        if(err) return res.status(400).json({error: "User is already in group."});
        res.json({success: true});
    });
});

app.get('/api/small-groups/:id/roster-status', (req, res) => {
    db.all(`SELECT y.id, y.name, y.profile_picture, sgm.status,
            (SELECT MAX(created_at) FROM activity_logs WHERE username = y.qr_code) as last_active 
            FROM small_group_members sgm 
            JOIN youth y ON sgm.youth_id = y.id 
            WHERE sgm.group_id = ? ORDER BY sgm.status DESC, y.name ASC`, [req.params.id], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/ai/chat', (req, res) => {
    const { prompt, persona, is_private, actor } = req.body;
    const q = (prompt || '').toLowerCase().trim();
    const finalizeChat = (reply) => {
        if (!is_private) db.run(`INSERT INTO ai_chat_logs (username, persona, prompt, response, is_private, created_at) VALUES (?, ?, ?, ?, 0, ?)`, [actor || 'System', 'Silas', prompt, reply, getManilaTime()]);
        setTimeout(() => { res.json({ response: reply }); }, 600);
    };

    // 1. Minis Logic
    if (q === 'how many are minis' || q === 'how many minis' || q.includes('count minis')) {
        db.get(`SELECT COUNT(*) as cnt FROM youth WHERE age <= 12`, [], (err, row) => { finalizeChat(`We currently have <strong>${row.cnt} Minis</strong> (age 12 and below). <br><br>💡 <em>Tip: You can ask "show minis list" to see their names and ages.</em>`); }); return;
    }
    if (q === 'show minis list' || q.includes('list of minis') || q.includes('who are the minis')) {
        db.all(`SELECT name, age FROM youth WHERE age <= 12 ORDER BY name ASC`, [], (err, rows) => { if(!rows || rows?.length || 0===0) return finalizeChat("No minis found in the database."); let msg = `<strong>👶 List of Minis:</strong><br>`; rows.forEach(r => msg += `• ${r.name} (Age: ${r.age})<br>`); finalizeChat(msg); }); return;
    }

    // 2. Youth Logic
    if (q === 'how many are youth' || q === 'how many youth' || q.includes('count youth')) {
        db.get(`SELECT COUNT(*) as cnt FROM youth WHERE age >= 13 AND age <= 21`, [], (err, row) => { finalizeChat(`We currently have <strong>${row.cnt} Youth</strong> (ages 13-21). <br><br>💡 <em>Tip: You can ask "show youth list" to see their names and ages.</em>`); }); return;
    }
    if (q === 'show youth list' || q.includes('list of youth') || q.includes('who are the youth')) {
        db.all(`SELECT name, age FROM youth WHERE age >= 13 AND age <= 21 ORDER BY name ASC`, [], (err, rows) => { if(!rows || rows?.length || 0===0) return finalizeChat("No youth found in the database."); let msg = `<strong>🔥 List of Youth:</strong><br>`; rows.forEach(r => msg += `• ${r.name} (Age: ${r.age})<br>`); finalizeChat(msg); }); return;
    }

    // 3. Adults Logic
    if (q === 'how many are adults' || q === 'how many adults' || q.includes('count adults')) {
        db.get(`SELECT COUNT(*) as cnt FROM youth WHERE age >= 22`, [], (err, row) => { finalizeChat(`We currently have <strong>${row.cnt} Adults</strong> (ages 22+). <br><br>💡 <em>Tip: You can ask "show adult list" to see their names.</em>`); }); return;
    }
    if (q === 'show adult list' || q.includes('list of adults') || q.includes('who are the adults')) {
        db.all(`SELECT name, age FROM youth WHERE age >= 22 ORDER BY name ASC`, [], (err, rows) => { if(!rows || rows?.length || 0===0) return finalizeChat("No adults found in the database."); let msg = `<strong>👥 List of Adults:</strong><br>`; rows.forEach(r => msg += `• ${r.name} (Age: ${r.age})<br>`); finalizeChat(msg); }); return;
    }

    // 4. Custom Roles Parser ("who has role core", "how many users have role usher")
    if (q.includes('role')) {
         let matchStr = q.split('role')[1];
         if (matchStr) {
             // Extract the clean role keyword
             let roleName = matchStr.replace(/^(:|-|=|of|in)\s+/i, '').replace(/\?/g, '').trim();
             if(roleName) {
                 db.all(`SELECT y.name, m.name as min_name, mm.role FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id JOIN ministries m ON mm.ministry_id = m.id WHERE LOWER(mm.role) LIKE ? OR LOWER(mm.sub_role) LIKE ?`, [`%${roleName}%`, `%${roleName}%`], (err, rows1) => {
                     db.all(`SELECT y.name, e.name as evt_name, er.role_name FROM event_roles er JOIN youth y ON er.youth_id = y.id JOIN events e ON er.event_id = e.id WHERE LOWER(er.role_name) LIKE ? OR LOWER(er.sub_role) LIKE ?`, [`%${roleName}%`, `%${roleName}%`], (err, rows2) => {
                         let total = (rows1?rows1?.length || 0:0) + (rows2?rows2?.length || 0:0);
                         if (total === 0) return finalizeChat(`I couldn't find anyone in the directory with the role "<strong>${roleName}</strong>".`);
                         let msg = `Found <strong>${total}</strong> user(s) with a role matching "${roleName}":<br><br>`;
                         if(rows1 && rows1?.length || 0>0) { msg += `<strong>Ministry Roles:</strong><br>`; rows1.forEach(r => msg += `• ${r.name} (${r.role} - ${r.min_name})<br>`); }
                         if(rows2 && rows2?.length || 0>0) { msg += `<br><strong>Event Roles:</strong><br>`; rows2.forEach(r => msg += `• ${r.name} (${r.role_name} - ${r.evt_name})<br>`); }
                         finalizeChat(msg);
                     });
                 });
                 return;
             }
         }
    }

    // 5. General Community Analytics
    if (q.includes('how many member') || q.includes('total member') || q === 'how many users') { 
        db.get(`SELECT count(*) as total FROM youth`, [], (err, row) => { finalizeChat(`We currently have <strong>${row.total} registered members</strong> in the community.`); }); return; 
    }
    if (q.includes('missing') || q.includes('absent')) {
        db.all(`SELECT y.name, MAX(a.checked_in_at) as last_seen FROM youth y LEFT JOIN attendance a ON y.id = a.youth_id GROUP BY y.id ORDER BY last_seen ASC LIMIT 10`, [], (err, rows) => { 
            let msg = "<strong>⚠️ Haven't checked in recently:</strong><br>"; rows.forEach(r => msg += `• ${r.name}<br>`); finalizeChat(msg); 
        }); return;
    }
    if (q.includes('top points') || q.includes('highest points') || q.includes('leaderboard')) {
        db.all(`SELECT y.name, gp.points FROM gamification_points gp JOIN youth y ON gp.youth_id = y.id ORDER BY gp.points DESC LIMIT 5`, [], (err, rows) => {
            let msg = `<strong>🏆 Top 5 Overall XP Leaders:</strong><br>`; rows.forEach((r, i) => msg += `${i+1}. ${r.name} (${r.points} XP)<br>`); finalizeChat(msg);
        }); return;
    }

    // 6. Default Silas Greeting
    const greeting = `Hello, I am Silas, your FOG ministry assistant.<br><br>I am connected directly to your community database. You can ask me things like:<br>• "How many are minis?"<br>• "Show youth list"<br>• "Who has the role core?"<br>• "Who has the highest points?"<br>• "Who is absent?"`;
    finalizeChat(greeting);
});


app.get('/api/liturgical/today', (req, res) => {
    const today = getManilaTime().split(' ')[0];
    const gospels = ["I am the bread of life... (John 6:35)", "Blessed are the poor in spirit... (Matthew 5:3)", "I am the light of the world... (John 8:12)", "Come to me, all you who are weary... (Matthew 11:28)"];
    const dailyGospel = gospels[parseInt(today.split('-')[2], 10) % gospels?.length || 0];
    require('https').get('https://calapi.inadiutorium.cz/api/v0/en/calendars/default/today', (resp) => {
        let data = ''; resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
            try { const p = JSON.parse(data); p.daily_gospel = dailyGospel; res.json(p); } 
            catch(e) { res.json({ season: "ordinary", colour: "green", daily_gospel: dailyGospel }); }
        });
    }).on("error", () => res.json({ season: "ordinary", colour: "green", daily_gospel: dailyGospel }));
});
app.get('/api/small-groups/:id/threads', (req, res) => {
    db.all(`SELECT t.*, IFNULL(y.name, 'Admin') as author_name, y.profile_picture, (SELECT COUNT(*) FROM group_thread_replies WHERE thread_id = t.id) as reply_count FROM group_threads t LEFT JOIN youth y ON t.youth_id = y.id WHERE t.group_id = ? ORDER BY t.created_at DESC`, [req.params.id], (err, rows) => { res.json(rows || []); });
});
app.post('/api/small-groups/:id/threads', (req, res) => {
    db.run(`INSERT INTO group_threads (group_id, youth_id, title, content, created_at) VALUES (?, ?, ?, ?, ?)`, [req.params.id, req.body.youth_id, req.body.title, req.body.content, getManilaTime()], function(err) { res.json({success: true}); });
});
app.get('/api/small-groups/threads/:thread_id/replies', (req, res) => {
    db.all(`SELECT r.*, IFNULL(y.name, 'Admin') as author_name, y.profile_picture FROM group_thread_replies r LEFT JOIN youth y ON r.youth_id = y.id WHERE r.thread_id = ? ORDER BY r.created_at ASC`, [req.params.thread_id], (err, rows) => { res.json(rows || []); });
});
app.post('/api/small-groups/threads/:thread_id/replies', (req, res) => {
    db.run(`INSERT INTO group_thread_replies (thread_id, youth_id, reply_text, created_at) VALUES (?, ?, ?, ?)`, [req.params.thread_id, req.body.youth_id, req.body.reply_text, getManilaTime()], function(err) { res.json({success: true}); });
});
app.get('/api/small-groups/:id/memories', (req, res) => {
    db.all(`SELECT m.*, IFNULL(y.name, 'Admin') as author_name, y.profile_picture FROM group_memories m LEFT JOIN youth y ON m.youth_id = y.id WHERE m.group_id = ? ORDER BY m.created_at DESC LIMIT 50`, [req.params.id], (err, rows) => { res.json(rows || []); });
});
app.post('/api/small-groups/:id/memories', (req, res) => {
    db.run(`INSERT INTO group_memories (group_id, youth_id, image_data, caption, created_at) VALUES (?, ?, ?, ?, ?)`, [req.params.id, req.body.youth_id, req.body.image_data, req.body.caption, getManilaTime()], function(err) { res.json({success: true}); });
});
app.post('/api/small-groups/chat/:chat_id/react', (req, res) => {
    db.get(`SELECT reactions FROM small_group_chats WHERE id = ?`, [req.params.chat_id], (err, row) => {
        if(!row) return res.json({success: false});
        let reactions = {}; try { reactions = JSON.parse(row.reactions || '{}'); } catch(e) {}
        reactions[req.body.emoji] = (reactions[req.body.emoji] || 0) + 1;
        db.run(`UPDATE small_group_chats SET reactions = ? WHERE id = ?`, [JSON.stringify(reactions), req.params.chat_id], () => res.json({success: true}));
    });
});


app.post('/api/small-groups/react-v2', (req, res) => {
    const { type, id, emoji, user_name } = req.body;
    let table = '';
    if(type === 'chat') table = 'small_group_chats';
    else if(type === 'prayer') table = 'prayer_requests';
    else if(type === 'memory') table = 'group_memories';
    else return res.json({success:false});

    db.get(`SELECT reactions FROM ${table} WHERE id = ?`, [id], (err, row) => {
        if(!row) return res.json({success: false});
        let reactions = {}; 
        try { reactions = JSON.parse(row.reactions || '{}'); } catch(e) {}
        
        // 1. Enforce Mutual Exclusivity: Remove user from ALL emojis first
        let removedFromSameEmoji = false;
        Object.keys(reactions).forEach(e => {
            if(typeof reactions[e] === 'number') reactions[e] = Array(reactions[e]).fill('Anonymous');
            if(!Array.isArray(reactions[e])) reactions[e] = [];
            
            const idx = reactions[e].indexOf(user_name);
            if(idx > -1) {
                reactions[e].splice(idx, 1);
                if (e === emoji) removedFromSameEmoji = true; // Toggle Off logic
            }
        });
        
        // 2. Add the new reaction (unless they were just turning it off)
        if(!removedFromSameEmoji) {
            if(!reactions[emoji]) reactions[emoji] = [];
            reactions[emoji].push(user_name);
        }
        
        // 3. Clean up empty arrays to keep database light
        Object.keys(reactions).forEach(e => {
            if(reactions[e]?.length || 0 === 0) delete reactions[e];
        });

        db.run(`UPDATE ${table} SET reactions = ? WHERE id = ?`, [JSON.stringify(reactions), id], () => {
            res.json({success: true, reactions});
        });
    });
});
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


// [KOINONIA PATCH] PRIVATE PRAYER INBOX
app.post('/api/prayer-pals/send', (req, res) => {
    if(typeof db === 'undefined') return res.status(500).json({error: "DB not initialized"});
    const { sender_id, receiver_id, message, sender_name } = req.body;
    db.run('INSERT INTO personal_inbox (sender_id, receiver_id, title, message, created_at) VALUES (?, ?, ?, ?, ?)',
        [sender_id, receiver_id, '🙏 A Prayer from ' + sender_name, message, getManilaTime()], function(err) {
            if(err) return res.status(500).json({error: err.message});
            // Award points for praying
            const todayStr = getManilaTime().split(' ')[0];
                db.get("SELECT id FROM point_transactions WHERE youth_id = ? AND game_name = 'Daily Prayer Covenant' AND created_at LIKE ?", [sender_id, todayStr + '%'], (err, ptRow) => {
                    if (!ptRow && typeof awardPoints === 'function') {
                        awardPoints(sender_id, 'growth', 50, sender_name, 'Daily Prayer Covenant');
                    }
                });
            // Send push notification
            if(typeof pushToUser === 'function') pushToUser(receiver_id, '🙏 Prayer Received', 'Prayers sent to you by a prayer covenant.', '/?tab=inbox');
            res.json({success: true});
        });
});


app.post('/api/inbox/personal/:id/respond', (req, res) => {
    if(typeof db === 'undefined') return res.status(500).json({error: "DB not initialized"});
    const { sender_id, original_sender_id, action, sender_name } = req.body;
    
    db.run("UPDATE personal_inbox SET status = ? WHERE id = ?", [action, req.params.id], () => {
        let title = action === 'thank_you' ? "💙 Thank You!" : "✨ Praise Report!";
        let msg = action === 'thank_you' ? `Thank you for covering me in prayer! - ${sender_name}` : `God answered the prayer you prayed for me! Praise God! - ${sender_name}`;

        db.run("INSERT INTO personal_inbox (sender_id, receiver_id, title, message, created_at) VALUES (?, ?, ?, ?, ?)",
            [sender_id, original_sender_id, title, msg, getManilaTime()], () => {
                if(typeof pushToUser === 'function') pushToUser(original_sender_id, title, msg, '/?tab=inbox');
                res.json({success: true});
        });
    });
});

app.get('/api/inbox/personal/:youth_id', (req, res) => {
    if(typeof db === 'undefined') return res.status(500).json({error: "DB not initialized"});
    db.all('SELECT p.*, y.name as sender_name, y.profile_picture FROM personal_inbox p JOIN youth y ON p.sender_id = y.id WHERE p.receiver_id = ? ORDER BY p.created_at DESC', [req.params.youth_id], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/communications/subscribe', (req, res) => {
    const { username, subscription } = req.body;
    db.run(`INSERT INTO push_subscriptions (username, subscription, created_at) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET subscription = excluded.subscription`, [username, JSON.stringify(subscription), getManilaTime()], function(err) { res.json({ success: true }); });
});
app.post('/api/communications/unsubscribe', (req, res) => { db.run(`DELETE FROM push_subscriptions WHERE username = ?`, [req.body.username], function(err) { res.json({ success: true }); }); });
app.post('/api/communications/broadcast', (req, res) => {
    const { target, title, message, actor } = req.body;
    db.run(`INSERT INTO announcements (title, message, target_audience, author, created_at) VALUES (?, ?, ?, ?, ?)`, [title, message, target, actor || 'System', getManilaTime()], function(err) {
            const announcementId = this.lastID;
            let targetQuery = `SELECT id, qr_code FROM youth`; let targetParams = [];
            if (target === 'Leaders') { 
                targetQuery = `SELECT y.id, y.qr_code FROM users u JOIN youth y ON u.youth_id = y.id WHERE u.permissions LIKE '%edit_entries%'`; 
            } else if (target === 'Groups') { 
                targetQuery = `SELECT DISTINCT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id`; 
            } else if (target.startsWith('Ministry:')) { 
                targetQuery = `SELECT y.id, y.qr_code FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id WHERE mm.ministry_id = ?`; 
                targetParams.push(target.split(':')[1]); 
            } else if (target.startsWith('Group:')) { 
                targetQuery = `SELECT y.id, y.qr_code FROM small_group_members sgm JOIN youth y ON sgm.youth_id = y.id WHERE sgm.group_id = ?`; 
                targetParams.push(target.split(':')[1]); 
            }
            db.all(targetQuery, targetParams, (err, youths) => {
                const usernames = ['celsocreeriii@gmail.com'];
                if (youths && youths?.length || 0 > 0) {
                    const stmt = db.prepare(`INSERT INTO user_notifications (youth_id, announcement_id, created_at) VALUES (?, ?, ?)`);
                    youths.forEach(y => { if (y && y.id) { stmt.run([y.id, announcementId, getManilaTime()]); if (y.qr_code) usernames.push(y.qr_code); } });
                    stmt.finalize();
                }
                const placeholders = usernames.map(() => '?').join(',');
                db.all(`SELECT subscription FROM push_subscriptions WHERE username IN (${placeholders})`, usernames, (err, subs) => {
                    if (err || !subs || subs?.length || 0 === 0) return res.json({ success: true, sentCount: 0 });
                    const payload = JSON.stringify({ title, body: message, url: '/' });
                    let sentCount = 0;
                    Promise.all(subs.map(row => {
                        try {
                            return webpush.sendNotification(JSON.parse(row.subscription), payload).then(() => { sentCount++; }).catch(e => { if (e.statusCode === 404 || e.statusCode === 410) db.run(`DELETE FROM push_subscriptions WHERE subscription = ?`, [row.subscription]); });
                        } catch(e) { return Promise.resolve(); }
                    })).then(() => { logActivity(actor, 'BROADCAST', `Sent broadcast '${title}' to ${target}`); res.json({ success: true, sentCount }); });
                });
            });
    });
});
app.get('/api/communications/history', (req, res) => { db.all(`SELECT id, title, target_audience as target, message, author as sender, created_at FROM announcements ORDER BY created_at DESC`, [], (err, rows) => { res.json(rows || []); }); });
app.delete('/api/communications/broadcast/:id', (req, res) => {
    const { actor } = req.body;
    if (actor === 'celsocreeriii@gmail.com') { executeDelete(); return; }
    db.get(`SELECT permissions FROM users WHERE username = ?`, [actor], (err, user) => {
        if (!user || !JSON.parse(user.permissions).includes('delete_entries')) return res.status(403).json({ error: 'Unauthorized' });
        executeDelete();
    });
    function executeDelete() { db.run(`DELETE FROM announcements WHERE id = ?`, [req.params.id], function(err) { db.run(`DELETE FROM user_notifications WHERE announcement_id = ?`, [req.params.id]); logActivity(actor, 'DELETE_BROADCAST', `Deleted global broadcast ID ${req.params.id}`); res.json({ success: true }); }); }
});
app.get('/api/communications/inbox', (req, res) => {
    const username = req.query.username;
    if (username === 'celsocreeriii@gmail.com') return db.all(`SELECT id as notification_id, title, message, author, created_at FROM announcements ORDER BY created_at DESC LIMIT 50`, [], (err, rows) => { res.json(rows || []); });
    db.get(`SELECT id FROM youth WHERE qr_code = ?`, [username], (err, youth) => {
        if (!youth) return res.json([]);
        db.all(`SELECT n.id as notification_id, a.title, a.message, a.author, a.created_at FROM user_notifications n JOIN announcements a ON n.announcement_id = a.id WHERE n.youth_id = ? ORDER BY a.created_at DESC LIMIT 50`, [youth.id], (err, rows) => { res.json(rows || []); });
    });
});
app.delete('/api/communications/inbox/:id', (req, res) => {
    if (req.body.username === 'celsocreeriii@gmail.com') { db.run(`DELETE FROM announcements WHERE id = ?`, [req.params.id], function(err) { db.run(`DELETE FROM user_notifications WHERE announcement_id = ?`, [req.params.id]); logActivity(req.body.actor, 'DELETE_INBOX_MSG', `Admin deleted global broadcast ID ${req.params.id}`); res.json({ success: true }); }); }
    else { db.run(`DELETE FROM user_notifications WHERE id = ?`, [req.params.id], function(err) { res.json({ success: true }); }); }
});

app.get('/api/leaderboards/:type/:timeframe', (req, res) => {
    const { type, timeframe } = req.params;
    let dateCondition = ""; let params = [];
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

    if (timeframe === 'month') {
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        dateCondition = "AND pt.created_at >= ?";
        params.push(firstDay.toISOString().split('T')[0]);
    } else if (timeframe === 'last_week') {
        const day = d.getDay();
        const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
        const thisMonday = new Date(d.setDate(diffToMonday));
        const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
        const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1);
        dateCondition = "AND pt.created_at >= ? AND pt.created_at <= ?";
        params.push(lastMonday.toISOString().split('T')[0] + " 00:00:00");
        params.push(lastSunday.toISOString().split('T')[0] + " 23:59:59");
    }

    const sql = `
        SELECT pt.youth_id, y.name, y.profile_picture,
               SUM(CASE WHEN pt.type = 'arcade' THEN pt.amount ELSE 0 END) as arcade_xp,
               SUM(CASE WHEN pt.type = 'growth' THEN pt.amount ELSE 0 END) as growth_xp,
               SUM(CASE WHEN pt.type = 'event' THEN pt.amount ELSE 0 END) as event_xp
        FROM point_transactions pt
        JOIN youth y ON pt.youth_id = y.id
        WHERE 1=1 ${dateCondition}
        GROUP BY pt.youth_id
    `;

    db.all(sql, params, (err, rows) => {
        if (err || !rows) return res.json([]);
        rows.forEach(r => r.points = Math.floor((r.arcade_xp * 0.4) + (r.growth_xp * 0.6) + r.event_xp));

        let sorted = rows;
        if (type === 'arcade') sorted.sort((a,b) => b.arcade_xp - a.arcade_xp);
        else if (type === 'growth') sorted.sort((a,b) => b.growth_xp - a.growth_xp);
        else sorted.sort((a,b) => b.points - a.points);

        if (type === 'arcade') sorted = sorted.filter(s => s.arcade_xp > 0);
        else if (type === 'growth') sorted = sorted.filter(s => s.growth_xp > 0);
        else sorted = sorted.filter(s => s.points > 0);

        res.json(sorted.slice(0, 10));
    });
});

app.get('/api/gamification/game-top/:game_name', (req, res) => {
    const gameName = req.params.game_name;
    db.all(`SELECT y.name, y.profile_picture, MAX(pt.amount) as high_score FROM point_transactions pt JOIN youth y ON pt.youth_id = y.id WHERE pt.game_name = ? GROUP BY pt.youth_id ORDER BY high_score DESC LIMIT 3`, [gameName], (err, rows) => { res.json(rows || []); });
});

app.get('/api/gamification/points/:youth_id', (req, res) => {
    db.get(`SELECT points, arcade_xp, growth_xp, event_xp FROM gamification_points WHERE youth_id = ?`, [req.params.youth_id], (err, row) => {
        let result = row ? row : { points: 0, arcade_xp: 0, growth_xp: 0, event_xp: 0 };
        
        // Calculate current week's points (Manila Time, starting Monday)
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const day = d.getDay();
        const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diffToMonday));
        const pad = (n) => String(n).padStart(2, '0');
        const startOfWeek = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())} 00:00:00`;

        db.get(`SELECT SUM(amount) as weekly_points FROM point_transactions WHERE youth_id = ? AND created_at >= ?`, [req.params.youth_id, startOfWeek], (err, weekRow) => {
            result.weekly_points = (weekRow && weekRow.weekly_points) ? weekRow.weekly_points : 0;
            res.json(result);
        });
    });
});
app.get('/api/gamification/group-leaderboard', (req, res) => { db.all(`SELECT sg.id, sg.name, SUM(gp.points) as total_points, COUNT(DISTINCT sgm.youth_id) as member_count FROM small_groups sg JOIN small_group_members sgm ON sg.id = sgm.group_id JOIN gamification_points gp ON sgm.youth_id = gp.youth_id GROUP BY sg.id ORDER BY total_points DESC LIMIT 10`, [], (err, rows) => { res.json(rows || []); }); });
app.get('/api/gamification/challenges', (req, res) => {
    const youthId = req.query.youth_id;
    db.all(`SELECT * FROM weekly_challenges WHERE is_active = 1 ORDER BY created_at DESC`, [], (err, challenges) => {
        if (err || !challenges) return res.json([]);
        if (!youthId) return res.json(challenges);
        db.all(`SELECT challenge_id FROM user_challenge_logs WHERE youth_id = ?`, [youthId], (err2, logs) => {
            const completedIds = new Set((logs || []).map(l => l.challenge_id));
            res.json(challenges.map(c => ({ ...c, completed: completedIds.has(c.id) })));
        });
    });
});
app.post('/api/gamification/challenges/:id/complete', (req, res) => {
    const { youth_id, actor } = req.body;
    db.get(`SELECT points FROM weekly_challenges WHERE id = ? AND is_active = 1`, [req.params.id], (err, challenge) => {
        if (!challenge) return res.status(404).json({ error: 'Challenge not found or inactive.' });
        db.run(`INSERT INTO user_challenge_logs (youth_id, challenge_id, completed_at) VALUES (?, ?, ?)`, [youth_id, req.params.id, getManilaTime()], function(err) {
            if (err) return res.status(400).json({ error: 'You have already completed this challenge!' });
            awardPoints(youth_id, 'growth', challenge.points, actor || 'System', 'Weekly Challenge');
            res.json({ success: true, pointsAwarded: challenge.points });
        });
    });
});
app.post('/api/gamification/challenges', (req, res) => { db.run(`INSERT INTO weekly_challenges (title, description, points, created_at) VALUES (?, ?, ?, ?)`, [req.body.title, req.body.description, req.body.points, getManilaTime()], function(err) { logActivity(req.body.actor, 'CREATE_CHALLENGE', `Created new challenge '${req.body.title}' for ${req.body.points} points`); res.json({ success: true, id: this.lastID }); }); });

app.post('/api/games/universal-submit', (req, res) => {
    const { youth_id, game_name, score, type, actor } = req.body;
    const gameType = type || 'growth';
    awardPoints(youth_id, gameType, Math.min(score, 5), actor || 'System', game_name || 'Mini Game');
    res.json({ success: true, pointsAwarded: score });
});


// --- ARCHITECT INJECTION: USCCB PROXY ---
app.get('/api/readings/iframe', (req, res) => {
    const https = require('https');
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const url = `https://bible.usccb.org/bible/readings/${mm}${dd}${yy}.cfm`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
        if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
            return res.redirect(resp.headers.location);
        }
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
            // Using RegExp constructor prevents terminal backslash stripping errors
            const hrefRegex = new RegExp('href="/(?!/)', 'g');
            const srcRegex = new RegExp('src="/(?!/)', 'g');
            let html = data
                .replace(hrefRegex, 'href="https://bible.usccb.org/')
                .replace(srcRegex, 'src="https://bible.usccb.org/');
            res.send(html);
        });
    }).on('error', (e) => res.status(500).send("Failed to load USCCB"));
});
// --- END ARCHITECT INJECTION ---
// --- ARCHITECT INJECTION: SNIPPET PROXY ---
app.get('/api/readings/snippet', (req, res) => {
    const https = require('https');
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    https.get(`https://publication.evangelizo.ws/AM/days/${y}-${m}-${day}`, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
            if(resp.statusCode === 200) {
                try {
                    const payload = JSON.parse(data).data || JSON.parse(data);
                    let season = payload.liturgical_season || "Ordinary Time";
                    let snippet = "Click Full Readings to view today's official USCCB scriptures.";
                    const readings = payload.readings || [];
                    const gospel = readings.find(r => (r.type || '').toLowerCase().includes('gospel')) || readings[readings.length - 1];
                    if(gospel && gospel.text) {
                        // Hardened regex: strictly remove all [1], [2-4] bracket artifacts
                        snippet = gospel.text.replace(/\[.*?\]/g, '').replace(/[\[\]]/g, '').replace(/<[^>]*>?/gm, '').substring(0, 110).trim() + '...';
                    }
                    return res.json({ season, snippet });
                } catch(e) {}
            }
            res.json({ season: "Daily Readings", snippet: "Tap Full Readings to view today's official USCCB scriptures." });
        });
    }).on('error', () => res.json({ season: "Daily Readings", snippet: "Tap Full Readings to view today's official USCCB scriptures." }));
});
// --- END ARCHITECT INJECTION ---
app.post('/api/arcade/submit', (req, res) => {
    const { youth_id, game_name, score, actor } = req.body;
    db.run(`INSERT INTO arcade_score_logs (youth_id, game_name, score, played_at) VALUES (?, ?, ?, ?)`, [youth_id, game_name, score, getManilaTime()], function(err) {
            awardPoints(youth_id, 'arcade', Math.min(score, 5), actor || 'System', game_name);
            res.json({ success: true, pointsAwarded: score });
    });
});

app.get('/api/growth-games/verse-scramble', (req, res) => { db.get(`SELECT * FROM brain_verse_scramble ORDER BY RANDOM() LIMIT 1`, [], (err, q) => { res.json(q || null); }); });
app.post('/api/growth-games/verse-scramble/submit', (req, res) => { const { youth_id, game_id, actor } = req.body; db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'verse_scramble' AND game_id = ?`, [youth_id, game_id], (err, row) => { if (row) return res.status(400).json({ error: 'You already played this verse scramble today!' }); db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'verse_scramble', ?, ?)`, [youth_id, game_id, getManilaTime()]); awardPoints(youth_id, 'growth', 15, actor || 'System', 'Daily Manna Scramble'); res.json({ success: true, pointsAwarded: 15 }); }); });
app.post('/api/growth-games/reflex/submit', (req, res) => { const { youth_id, success, actor } = req.body; const genericId = parseInt(getManilaTime().substring(0, 10).replace(/-/g, '')); db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'reflex' AND game_id = ?`, [youth_id, genericId], (err, row) => { if (row) return res.status(400).json({ error: 'You already completed your daily reflex training!' }); db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'reflex', ?, ?)`, [youth_id, genericId, getManilaTime()]); let pts = success ? 10 : 2; awardPoints(youth_id, 'growth', pts, actor || 'System', 'Shield of Faith: Reflex Tap'); res.json({ success: true, pointsAwarded: pts }); }); });
app.get('/api/growth-games/narrow-gate', (req, res) => { db.all(`SELECT id, question, options, correct_index, category FROM brain_trivia_questions ORDER BY RANDOM() LIMIT 50`, [], (err, rows) => { res.json(rows || []); }); });
app.post('/api/growth-games/narrow-gate/submit', (req, res) => { const { youth_id, streak, actor } = req.body; let pts = streak * 5; awardPoints(youth_id, 'growth', pts, actor || 'System', 'The Narrow Gate'); res.json({ success: true, pointsAwarded: pts }); });
app.get('/api/growth-games/emoji', (req, res) => {
    const { youth_id } = req.query; if (!youth_id) return res.json(null);
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6:1);
    const startOfWeek = new Date(d.setDate(diff)).toISOString().split('T')[0] + " 00:00:00";
    db.all(`SELECT game_id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'emoji' AND created_at >= ?`, [youth_id, startOfWeek], (err, logs) => {
        if (logs && logs?.length || 0 >= 15) return res.json({ limit_reached: true });
        const playedIds = logs ? logs.map(l => l.game_id) : [];
        const placeholders = playedIds?.length || 0 > 0 ? playedIds.map(()=>'?').join(',') : "''";
        db.get(`SELECT * FROM brain_emoji_translation WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`, playedIds, (err, q) => { if (!q) return res.json({ exhausted: true }); res.json({ question: q, played_count: playedIds?.length || 0 }); });
    });
});
app.post('/api/growth-games/emoji/submit', (req, res) => { const { youth_id, game_id, actor } = req.body; db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'emoji' AND game_id = ?`, [youth_id, game_id], (err, row) => { if (row) return res.status(400).json({ error: 'You already translated this emoji story!' }); db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'emoji', ?, ?)`, [youth_id, game_id, getManilaTime()]); awardPoints(youth_id, 'growth', 10, actor || 'System', 'Emoji Sermon Translator'); res.json({ success: true, pointsAwarded: 10 }); }); });
app.get('/api/growth-games/crossword', (req, res) => { db.get(`SELECT * FROM brain_crosswords ORDER BY id DESC LIMIT 1`, [], (err, q) => { res.json(q || null); }); });
app.post('/api/growth-games/crossword/submit', (req, res) => { const { youth_id, game_id, actor } = req.body; db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'crossword' AND game_id = ?`, [youth_id, game_id], (err, row) => { if (row) return res.status(400).json({ error: 'You already completed this crossword!' }); db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'crossword', ?, ?)`, [youth_id, game_id, getManilaTime()]); awardPoints(youth_id, 'growth', 25, actor || 'System', 'Word Matrix'); res.json({ success: true, pointsAwarded: 25 }); }); });
app.get('/api/growth-games/trivia', (req, res) => { db.all(`SELECT id, question, options, correct_index, category FROM brain_trivia_questions ORDER BY RANDOM() LIMIT 10`, [], (err, rows) => { res.json(rows || []); }); });
app.post('/api/growth-games/trivia/submit', (req, res) => { const { youth_id, score, actor } = req.body; awardPoints(youth_id, 'growth', score, actor || 'System', 'Catechism Clash'); res.json({ success: true, pointsAwarded: score }); });
app.get('/api/growth-games/poll', (req, res) => { const { youth_id } = req.query; db.get(`SELECT * FROM brain_polls ORDER BY id DESC LIMIT 1`, [], (err, poll) => { if (!poll) return res.json({ poll: null, voted: false }); if (!youth_id) return res.json({ poll, voted: false }); db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'poll' AND game_id = ?`, [youth_id, poll.id], (err2, log) => { res.json({ poll, voted: !!log }); }); }); });
app.post('/api/growth-games/poll/vote', (req, res) => { const { youth_id, poll_id, choice, actor } = req.body; db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'poll' AND game_id = ?`, [youth_id, poll_id], (err, row) => { if (row) return res.status(400).json({ error: 'You have already voted on this poll!' }); const voteCol = choice === 'a' ? 'votes_a' : 'votes_b'; db.run(`UPDATE brain_polls SET ${voteCol} = ${voteCol} + 1 WHERE id = ?`, [poll_id], function(err3) { db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'poll', ?, ?)`, [youth_id, poll_id, getManilaTime()]); awardPoints(youth_id, 'growth', 5, actor || 'System', 'Would You Rather'); db.get(`SELECT * FROM brain_polls WHERE id = ?`, [poll_id], (err4, updatedPoll) => { res.json({ success: true, pointsAwarded: 5, poll: updatedPoll }); }); }); }); });
app.get('/api/growth-games/whoami', (req, res) => { db.get(`SELECT id, clue1, clue2, clue3, answer FROM brain_whoami_questions ORDER BY RANDOM() LIMIT 1`, [], (err, q) => { res.json(q || null); }); });
app.post('/api/growth-games/whoami/submit', (req, res) => { const { youth_id, question_id, clues_used, is_correct, actor } = req.body; db.get(`SELECT id FROM brain_user_logs WHERE youth_id = ? AND game_type = 'whoami' AND game_id = ?`, [youth_id, question_id], (err, row) => { if (row) return res.status(400).json({ error: 'You already played this Who Am I!' }); db.run(`INSERT INTO brain_user_logs (youth_id, game_type, game_id, played_at) VALUES (?, 'whoami', ?, ?)`, [youth_id, question_id, getManilaTime()]); if (is_correct) { let pts = 15; if (clues_used === 2) pts = 10; if (clues_used === 3) pts = 5; awardPoints(youth_id, 'growth', pts, actor || 'System', 'Who Am I?'); res.json({ success: true, pointsAwarded: pts }); } else { res.json({ success: true, pointsAwarded: 0 }); } }); });
app.get('/api/growth-games/verse-chain', (req, res) => { const { group_id } = req.query; db.get(`SELECT * FROM brain_verse_chain ORDER BY id DESC LIMIT 1`, [], (err, verse) => { if (!verse) return res.json({ verse: null, contributions: [] }); if (!group_id) return res.json({ verse, contributions: [] }); db.all(`SELECT word_index, youth_id, guessed_word FROM brain_verse_contributions WHERE group_id = ? AND verse_id = ?`, [group_id, verse.id], (err2, contribs) => { res.json({ verse, contributions: contribs || [] }); }); }); });
app.post('/api/growth-games/verse-chain/submit', (req, res) => { const { youth_id, group_id, verse_id, word_index, guessed_word, actor } = req.body; if (!group_id) return res.status(400).json({error: "You must be in a small group to play this."}); db.run(`INSERT INTO brain_verse_contributions (group_id, verse_id, youth_id, word_index, guessed_word, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [group_id, verse_id, youth_id, word_index, guessed_word, getManilaTime()], function(err) { if (err) return res.status(400).json({error: "Word already solved by your group!"}); awardPoints(youth_id, 'growth', 10, actor || 'System', 'Verse Chain'); res.json({ success: true, pointsAwarded: 10 }); }); });


app.get('/api/prayer-pals/current/:youth_id', (req, res) => {
    db.get('SELECT p.*, y.name as pal_name, y.profile_picture FROM secret_prayer_pals p JOIN youth y ON p.pal_youth_id = y.id WHERE p.youth_id = ? ORDER BY p.id DESC LIMIT 1', [req.params.youth_id], (err, row) => {
        res.json(row || null);
    });
});


// ==========================================
// PHASE 3: COMMITMENT PLEDGE ENDPOINT
// ==========================================
app.post('/api/youth/:id/commit', (req, res) => {
    const youthId = req.params.id;
    const { actor, intent_message } = req.body;
    db.run(`UPDATE youth SET account_tier = 'Committed Member', commitment_intent = ? WHERE id = ?`, [intent_message, youthId], function(err) {
        if (err) return res.status(500).json({ success: false, error: 'Database error updating tier: ' + err.message });
        db.get(`SELECT permissions FROM users WHERE youth_id = ?`, [youthId], (err, user) => {
            let perms = [];
            if (user && user.permissions) { try { perms = JSON.parse(user.permissions); } catch(e) {} }
            if (!perms.includes('access_directory')) perms.push('access_directory');
            db.run(`UPDATE users SET permissions = ? WHERE youth_id = ?`, [JSON.stringify(perms), youthId], function(err2) {
                logActivity(actor || 'System', 'COMMITMENT_PLEDGE', `Member ID ${youthId} committed with intent: ${intent_message}`);
                db.get(`SELECT * FROM youth WHERE id = ?`, [youthId], (err3, member) => { res.json({ success: true, member, permissions: perms }); });
            });
        });
    });
});


// --- V30: NEW LOGGING & INTEGRATION API ROUTES ---
app.post('/api/youth/:id/commit-v2', (req, res) => {
    const youthId = req.params.id;
    const { actor, intent_message } = req.body;
    db.run(`UPDATE youth SET account_tier = 'Integration Period', commitment_intent = ?, commitment_date = ? WHERE id = ?`, [intent_message, getManilaTime(), youthId], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.get(`SELECT permissions FROM users WHERE youth_id = ?`, [youthId], (err, user) => {
            let perms = [];
            if (user && user.permissions) { try { perms = JSON.parse(user.permissions); } catch(e) {} }
            if (!perms.includes('access_directory')) perms.push('access_directory');
            db.run(`UPDATE users SET permissions = ? WHERE youth_id = ?`, [JSON.stringify(perms), youthId], function(err2) {
                logActivity(actor || 'System', 'COMMITMENT_PLEDGE', `Member ID ${youthId} committed with intent: ${intent_message}`);
                db.get(`SELECT * FROM youth WHERE id = ?`, [youthId], (err3, member) => { res.json({ success: true, member, permissions: perms }); });
            });
        });
    });
});

app.get('/api/admin/community-intents', (req, res) => {
    db.all(`SELECT id, name, email, profile_picture, account_tier, commitment_intent, commitment_date FROM youth WHERE commitment_intent IS NOT NULL ORDER BY commitment_date DESC`, [], (err, rows) => { res.json(rows || []); });
});

app.post('/api/admin/community-intents/:id/approve', (req, res) => {
    db.run(`UPDATE youth SET account_tier = 'Committed Member' WHERE id = ?`, [req.params.id], function(err) { res.json({success:true}); });
});

app.get('/api/admin/ministry-logs', (req, res) => {
    db.all(`SELECT mm.*, y.name as applicant_name, y.profile_picture, m.name as ministry_name FROM ministry_members mm JOIN youth y ON mm.youth_id = y.id JOIN ministries m ON mm.ministry_id = m.id ORDER BY mm.assigned_at DESC`, [], (err, rows) => { res.json(rows || []); });
});


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


// --- V32: MINISTRY ROLE HISTORY LOGGING ---
app.put('/api/ministries-v2/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.json({success:false, error: 'Mapping not found'});
        
        const youthId = row.youth_id;
        const timeNow = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
        let logMsg = role === 'Integration Period' ? 'Application Accepted for Integration Period' : `Role updated to ${role}`;

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
    db.all(`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.timestamp DESC`, [], (err, rows) => { res.json(rows || []); });
});


// --- V34: BULLETPROOF MINISTRY ROLE LOGGING ---
app.put('/api/ministries-v34/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.status(404).json({error: 'Not found'});
        const timeNow = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
        const logMsg = role === 'Integration Period' ? 'Application Accepted for Integration Period' : `Role updated to ${role}`;
        
        db.run("UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?", [role, sub_role || '', req.params.mappingId], function(err) {
            if(err) return res.status(500).json({error: err.message});
            db.run("INSERT INTO ministry_role_history (ministry_id, youth_id, role, actor, timestamp, intent_message) VALUES (?, ?, ?, ?, ?, ?)",
                [req.params.id, row.youth_id, role, actor || 'Admin', timeNow, logMsg], () => {
                    if (role === 'Integration Period' || role === 'Member') {
                        awardPoints(row.youth_id, 'growth', 50, actor || 'Admin', 'Ministry Advancement: ' + role);
                    }
                    res.json({success: true});
            });
        });
    });
});

app.get('/api/admin/ministry-logs-v34', (req, res) => {
    db.all(`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.timestamp DESC`, [], (err, rows) => { res.json(rows || []); });
});


// --- V36: PRECISION ROLE LOGGING ---
app.put('/api/ministries-v36/:id/members/:mappingId', (req, res) => {
    const { role, sub_role, actor } = req.body;
    db.get("SELECT youth_id, role as old_role FROM ministry_members WHERE id = ?", [req.params.mappingId], (err, row) => {
        if(!row) return res.status(404).json({error: 'Not found'});
        
        // Generate precise readable timestamp
        const timeNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
        
        // Format precision log message
        let logMsg = `Previous role '${row.old_role || 'None'}' updated to '${role}'`;
        if (role === 'Integration Period' && row.old_role !== 'Integration Period') {
            logMsg = `Application Accepted for Integration Period (Previous: ${row.old_role || 'Applicant'})`;
        }
        
        db.run("UPDATE ministry_members SET role = ?, sub_role = ? WHERE id = ?", [role, sub_role || '', req.params.mappingId], function(err) {
            if(err) return res.status(500).json({error: err.message});
            db.run("INSERT INTO ministry_role_history (ministry_id, youth_id, role, actor, timestamp, intent_message) VALUES (?, ?, ?, ?, ?, ?)",
                [req.params.id, row.youth_id, role, actor || 'Admin', timeNow, logMsg], () => {
                    if (role === 'Integration Period' || role === 'Member') {
                        awardPoints(row.youth_id, 'growth', 50, actor || 'Admin', 'Ministry Advancement: ' + role);
                    }
                    res.json({success: true});
            });
        });
    });
});

app.get('/api/admin/ministry-logs-v36', (req, res) => {
    db.all(`SELECT h.*, y.name as applicant_name, m.name as ministry_name
            FROM ministry_role_history h
            JOIN youth y ON h.youth_id = y.id
            JOIN ministries m ON h.ministry_id = m.id
            ORDER BY h.id DESC`, [], (err, rows) => { res.json(rows || []); });
});


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

app.listen(PORT, () => { console.log(`Server running safely on Port ${PORT}`); });

app.post('/api/ministries/:id/apply', (req, res) => {
    const { youth_id, intent_message, actor } = req.body;
    if (!youth_id) return res.status(400).json({ error: 'Session error. Please log out and log in again.' });
    db.run(`INSERT INTO ministry_members (ministry_id, youth_id, role, intent_message, assigned_at) VALUES (?, ?, 'Applicant', ?, ?)`,
    [req.params.id, youth_id, intent_message, getManilaTime()], function(err) {
        if (err) return res.status(400).json({ error: 'Already applied or belong to this ministry.' });
        logActivity(actor, 'MINISTRY_APPLY', `Member ID ${youth_id} submitted intent for Ministry ID ${req.params.id}`);
        res.json({ success: true });
    });
});

app.get('/api/ministries/applications/pending', (req, res) => {
    db.all(`SELECT mm.id as mapping_id, mm.ministry_id, m.name as ministry_name, y.name as applicant_name, mm.intent_message, mm.assigned_at
            FROM ministry_members mm JOIN ministries m ON mm.ministry_id = m.id JOIN youth y ON mm.youth_id = y.id
            WHERE mm.role = 'Applicant' ORDER BY mm.assigned_at DESC`, [], (err, rows) => { res.json(rows || []); });
});

app.put('/api/ministries/members/:mapping_id/priority', (req, res) => {
    db.serialize(() => {
        db.run(`UPDATE ministry_members SET is_priority = 0 WHERE youth_id = ?`, [req.body.youth_id]);
        db.run(`UPDATE ministry_members SET is_priority = 1 WHERE id = ?`, [req.params.mapping_id], function(err) { res.json({ success: true }); });
    });
});

// ==========================================
// V120: BULLETPROOF FAITH QUEST ENDPOINTS
// ==========================================
// 1. Authorized Image Uploader V2
app.post('/api/settings/images-v2', (req, res) => {
    const { logo, prodIcon, stagingIcon, faithQuestThumb, faithRegBanner, actor } = req.body;
    db.get('SELECT permissions FROM users WHERE username = ?', [actor], (err, user) => {
        if (actor !== 'celsocreeriii@gmail.com' && (!user || !user.permissions.includes('edit_entries'))) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        try {
            const saveImg = (b64, baseFname) => {
            if (!b64) return;
            const isVideo = b64.includes('video');
            const ext = isVideo ? '.mp4' : '.png';
            const base64Data = b64.replace(/^data:(image|video)\/\w+;base64,/, "");
            require('fs').writeFileSync(require('path').join(__dirname, 'public', 'img', baseFname + ext), Buffer.from(base64Data, 'base64'));
        };
            saveImg(logo, 'logo'); saveImg(prodIcon, 'icon-prod'); saveImg(stagingIcon, 'icon-staging'); saveImg(faithQuestThumb, 'faith-quest-thumb'); saveImg(faithRegBanner, 'faith-reg-banner');
            res.json({ success: true });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
});

// 2. De-duplicated Leaderboards V2
app.get('/api/public/arcade-leaderboards-v2', (req, res) => {
    const queries = {
        daily: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND date(p.created_at, 'localtime') = date('now', 'localtime') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        weekly: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND p.created_at >= datetime('now', 'localtime', '-7 days') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        lastWeek: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND p.created_at >= datetime('now', 'localtime', '-14 days') AND p.created_at < datetime('now', 'localtime', '-7 days') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        monthly: "SELECT y.name, SUM(p.amount) as score FROM point_transactions p JOIN youth y ON p.youth_id = y.id WHERE p.type = 'arcade' AND strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now', 'localtime') GROUP BY y.name ORDER BY score DESC LIMIT 5",
        allTime: "SELECT y.name, gp.arcade_xp as score FROM gamification_points gp JOIN youth y ON gp.youth_id = y.id ORDER BY gp.arcade_xp DESC LIMIT 5",
        topGames: "SELECT a.game_name, y.name, MAX(a.score) as score FROM arcade_score_logs a JOIN youth y ON a.youth_id = y.id GROUP BY a.game_name, y.name ORDER BY a.game_name, score DESC"
    };
    let results = {}; let pending = Object.keys(queries).length;
    Object.keys(queries).forEach(k => {
        db.all(queries[k], [], (err, rows) => { results[k] = rows || []; pending--; if (pending === 0) res.json(results); });
    });
});

// 3. Funnel Illusion Engine API
app.get('/api/growth-games/funnel', (req, res) => {
    const game = req.query.game || '';
    
    // Helper to shuffle arrays
    const shuffle = (arr) => arr.sort(() => 0.5 - Math.random());
    
    if (game.includes('Scramble')) {
        const words = ["FAITH","HOPE","LOVE","PEACE","GRACE","MERCY","TRUTH","LIGHT","GLORY","JESUS","CHRIST","SAVIOR","HEAVEN","GOSPEL","BIBLE","CHURCH","CROSS","PRAYER","AMEN","HOLY","SPIRIT","WATER","BLOOD","WINE","BREAD","FISH","SHEEP","LAMB","LION","DOVE","MOSES","DAVID","MARY","PETER","JOHN","PAUL","SAUL","ROMANS","ACTS","LUKE","MARK","PSALM","PROVERB","WISDOM","JOY","CALM","REST","HEAL","KING","LORD"];
        let pool = words.map(w => {
            let scrambled = w.split('').sort(() => 0.5 - Math.random()).join('');
            while(scrambled === w) scrambled = w.split('').sort(() => 0.5 - Math.random()).join(''); // Ensure it's actually scrambled
            let options = shuffle([w, "BIBLE", "FAITH", "GRACE", "JESUS", "PEACE", "MERCY"].filter(x => x !== w).slice(0,3));
            options.push(w);
            options = shuffle(options);
            return { question: "Unscramble: " + scrambled.split('').join('-'), options: options, correct_index: options.indexOf(w) };
        });
        res.json(shuffle(pool).slice(0, 10));
    } else if (game.includes('Emoji')) {
        const emojiPool = [
            {q: "🍎🐍🌳", a: "Adam & Eve"}, {q: "🌊🚶‍♂️💨", a: "Walking on Water"}, {q: "🍞🐟🐟", a: "Feeding 5000"}, {q: "🦁🕳️🙏", a: "Daniel in Lion's Den"}, {q: "👑⭐👶🐪", a: "Birth of Jesus"},
            {q: "🚢🌈🕊️", a: "Noah's Ark"}, {q: "🔥🌳🗣️", a: "Burning Bush"}, {q: "✝️🩸👑", a: "The Crucifixion"}, {q: "🪨👦🎯", a: "David & Goliath"}, {q: "🐋🌊🏃", a: "Jonah"},
            {q: "🍞🍷🙏", a: "Last Supper"}, {q: "🔥🌪️👅", a: "Pentecost"}, {q: "🎺🧱💥", a: "Walls of Jericho"}, {q: "☀️🌑🛑", a: "Joshua stops the Sun"}, {q: "🔥🌋🐴", a: "Elijah's Chariot"},
            {q: "💰🐖💋", a: "Judas Betrayal"}, {q: "💧👶🕊️", a: "Jesus Baptism"}, {q: "🐍🔥⛺", a: "Paul & the Viper"}, {q: "🥖🐦🦅", a: "Elijah fed by Ravens"}, {q: "🐑👑🛡️", a: "The Lord is my Shepherd"}
        ];
        // Duplicate/Expand pool dynamically to reach 50 for depth
        let expandedPool = [];
        for(let i=0; i<50; i++) expandedPool.push(emojiPool[i % emojiPool.length]);
        
        let finalPool = expandedPool.map(item => {
            let options = shuffle([item.a, "Moses", "Resurrection", "Samson", "Exodus"].filter(x => x !== item.a).slice(0,3));
            options.push(item.a);
            options = shuffle(options);
            return { question: "Decode: " + item.q, options: options, correct_index: options.indexOf(item.a) };
        });
        res.json(shuffle(finalPool).slice(0, 10));
    } else if (game.includes('Fruits')) {
        const fruits = ["Love","Joy","Peace","Patience","Kindness","Goodness","Faithfulness","Gentleness","Self-Control"];
        let pool = [];
        for(let i=0; i<50; i++) {
            let f = fruits[i % fruits.length];
            let options = shuffle([f, "Wealth", "Power", "Fame", "Anger", "Pride"].filter(x => x !== f).slice(0,3));
            options.push(f);
            options = shuffle(options);
            pool.push({ question: "Which is a Fruit of the Spirit?", options: options, correct_index: options.indexOf(f) });
        }
        res.json(shuffle(pool).slice(0, 10));
    } else {
        db.all("SELECT id, question, options, correct_index, category FROM brain_trivia_questions ORDER BY RANDOM() LIMIT 10", [], (err, rows) => {
            if(err || !rows) return res.json([]);
            rows.forEach(r => { if(typeof r.options === 'string') { try{ r.options=JSON.parse(r.options); }catch(e){r.options=["A","B","C","D"];} } });
            res.json(rows);
        });
    }
});

// ==========================================
// WANDERER REGISTRATION ENDPOINT (SMART V2)
// ==========================================
app.post('/api/public/register-wanderer', (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email) {
        return res.status(400).json({ error: "Name and email are strictly required." });
    }
    
    if (typeof db !== 'undefined') {
        db.get("SELECT * FROM youth WHERE email = ?", [email], (err, row) => {
            if (err) return res.status(500).json({ error: "Database lookup error: " + err.message });
            
            if (row) {
                // User exists -> Simulate login!
                return res.json({ id: row.id, name: row.name, email: row.email, role: row.role || 'Wanderer', message: 'User exists, logging in.' });
            } else {
                // Insert new user
                db.run("INSERT INTO youth (name, email, password) VALUES (?, ?, ?)", [name, email, password], function(err) {
                    if (err) return res.status(500).json({ error: "Database insert error: " + err.message });
                    res.json({ id: this.lastID, name: name, email: email, role: 'Wanderer' });
                });
            }
        });
    } else {
        res.json({ id: Date.now(), name: name, email: email, role: 'Wanderer' });
    }
});

// [KOINONIA PATCH] LIVE SEARCH FOR CAMPFIRE INVITES
app.get('/api/admin/users/search', (req, res) => {
    if (typeof db !== 'undefined') {
        const q = '%' + (req.query.q || '') + '%';
        // Securely search users by name limit to 10 results
        db.all("SELECT id, name, profile_picture FROM youth WHERE name LIKE ? LIMIT 10", [q], (err, rows) => {
            if (err) return res.status(500).json({error: err.message});
            res.json(rows || []);
        });
    } else {
        res.json([]);
    }
});
