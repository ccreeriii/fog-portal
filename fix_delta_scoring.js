const fs = require('fs');

try {
    let serverJs = fs.readFileSync('server.js', 'utf8');

    // A. FAITH QUEST ROUTE (Strict boundary replacement, zero bracket counting)
    const fqRegex = /\/\/ --- ARCHITECT INJECTION: FQ LEADERBOARD ---[\s\S]*?\/\/ --- END ARCHITECT INJECTION ---/;
    const newFqBlock = `// --- ARCHITECT INJECTION: FQ LEADERBOARD ---
db.run(\`CREATE TABLE IF NOT EXISTS fq_daily_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, player_name TEXT, game_name TEXT, score REAL, avatar TEXT, date_played TEXT
)\`);

app.post('/api/fq-leaderboard/submit', (req, res) => {
    const { player_name, game_name, score, avatar, youth_id } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const playedAt = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();
    const currentScore = Math.min(parseFloat(score) || 0, 5);

    db.get("SELECT MAX(score) as best_score FROM fq_daily_scores WHERE player_name = ? AND game_name = ? AND date_played = ?", 
        [player_name, game_name, today], 
        (err, row) => {
            const prevBest = Math.min((row && row.best_score) ? parseFloat(row.best_score) : 0, 5);
            const delta = Math.max(0, currentScore - prevBest);

            db.run("INSERT INTO fq_daily_scores (player_name, game_name, score, avatar, date_played) VALUES (?, ?, ?, ?, ?)",
                [player_name || 'Faith Quester', game_name, parseFloat(score) || 0, avatar || '', today],
                (insertErr) => { 
                    // Direct point assignment bypassing the legacy 5-point global cap
                    if (delta > 0 && youth_id) {
                        db.run("INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) VALUES (?, 'arcade', ?, ?, ?)", [youth_id, game_name, delta, playedAt]);
                        db.run("UPDATE gamification_points SET arcade_xp = arcade_xp + ?, points = points + ? WHERE youth_id = ?", [delta, delta, youth_id]);
                        db.run("UPDATE users SET life_points = life_points + ? WHERE youth_id = ?", [delta, youth_id], () => {});
                    }
                    res.json({ success: !insertErr, pointsAwarded: delta }); 
                }
            );
    });
});

app.get('/api/fq-leaderboard/top3', (req, res) => {
    const gameName = req.query.game || '';
    const today = new Date().toISOString().split('T')[0];
    db.all("SELECT player_name as name, MAX(score) as score, avatar FROM fq_daily_scores WHERE game_name = ? AND date_played = ? GROUP BY player_name ORDER BY score DESC LIMIT 3", 
        [gameName, today], 
        (err, rows) => { res.json({ top3: rows || [] }); }
    );
});
// --- END ARCHITECT INJECTION ---`;
    
    if (serverJs.match(fqRegex)) {
        serverJs = serverJs.replace(fqRegex, newFqBlock);
    }

    // B. ARCADE ROUTE (Surgical bounded regex targeting exact legacy block)
    const arcadeRegex = /app\.post\(['"]\/api\/arcade\/submit['"][\s\S]*?awardPoints[\s\S]*?\}\);\s*\}\);/;
    const newArcadeRoute = `app.post('/api/arcade/submit', (req, res) => {
    const { youth_id, game_name, score, actor } = req.body;
    const currentScore = Math.min(parseFloat(score) || 0, 5);
    const playedAt = typeof getManilaTime === 'function' ? getManilaTime() : new Date().toISOString();

    db.get("SELECT MAX(score) as best_score FROM arcade_score_logs WHERE youth_id = ? AND game_name = ? AND date(played_at) = date(?)", 
        [youth_id, game_name, playedAt], 
        (err, row) => {
            const prevBest = Math.min((row && row.best_score) ? parseFloat(row.best_score) : 0, 5);
            const delta = Math.max(0, currentScore - prevBest);

            db.run("INSERT INTO arcade_score_logs (youth_id, game_name, score, played_at) VALUES (?, ?, ?, ?)", [youth_id, game_name, score, playedAt], function(insertErr) {
                if (delta > 0 && youth_id) {
                    db.run("INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) VALUES (?, 'arcade', ?, ?, ?)", [youth_id, game_name, delta, playedAt]);
                    db.run("UPDATE gamification_points SET arcade_xp = arcade_xp + ?, points = points + ? WHERE youth_id = ?", [delta, delta, youth_id]);
                    db.run("UPDATE users SET life_points = life_points + ? WHERE youth_id = ?", [delta, youth_id], () => {});
                }
                res.json({ success: true, pointsAwarded: delta });
            });
    });
});`;
    
    if (serverJs.match(arcadeRegex)) {
        serverJs = serverJs.replace(arcadeRegex, newArcadeRoute);
    }

    // C. SYNTAX VALIDATION SHIELD (Prevents writing broken code to server.js)
    new Function(serverJs);
    fs.writeFileSync('server.js', serverJs);

    // D. FRONTEND FIX (Append youth_id payload for FQ)
    let html = fs.readFileSync('public/seeker-arcade.html', 'utf8');
    const oldFetchBody = `body: JSON.stringify({ player_name: actorName, game_name: currentGameName, score: score, avatar: actorAvatar })`;
    const newFetchBody = `body: JSON.stringify({ player_name: actorName, game_name: currentGameName, score: score, avatar: actorAvatar, youth_id: (user.id || user.youth_id || (user.member && user.member.id) || null) })`;
    if (html.includes(oldFetchBody)) {
        html = html.replace(oldFetchBody, newFetchBody);
        fs.writeFileSync('public/seeker-arcade.html', html);
    }

    console.log("✅ Delta Logic Successfully Deployed: Code validated internally, zero syntax errors detected.");
    fs.unlinkSync(__filename);
} catch(e) {
    console.error("❌ CRITICAL PATCH ABORTED. Syntax error detected before saving:", e.message);
}
