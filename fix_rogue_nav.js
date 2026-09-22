const fs = require('fs');

// --- 1. Clean v3-worship.js ---
try {
    let v3 = fs.readFileSync('public/js/v3-worship.js', 'utf8');
    // We target the exact block that injects the bottom nav button
    const v3Regex = /const bottomNav = document\.getElementById\('bottomNav'\);[\s\S]*?if \(logoutBtn && v3BottomHtml\) logoutBtn\.insertAdjacentHTML\('beforebegin', v3BottomHtml\);\s*\}/;
    
    if (v3Regex.test(v3)) {
        v3 = v3.replace(v3Regex, '');
        fs.writeFileSync('public/js/v3-worship.js', v3);
        console.log('✅ Removed Bottom Nav injection from V3 Worship.');
    } else {
        console.log('ℹ️ V3 Worship injection not found (already removed?).');
    }
} catch (e) {
    console.error('❌ Error updating v3-worship.js:', e.message);
}

// --- 2. Clean v10-expansion.js ---
try {
    let v10 = fs.readFileSync('public/js/v10-expansion.js', 'utf8');
    // We target the exact block that injects the bottom nav leaderboards button
    const v10Regex = /const bottomNav = document\.getElementById\('bottomNav'\);[\s\S]*?if \(lastBtn\) lastBtn\.insertAdjacentHTML\('beforebegin', `<button id="bottomNavLeaderboards" class="bottom-nav-btn" data-target="leaderboardsHubTab" onclick="switchTab\\('leaderboardsHubTab'\\)"><div class="icon">🏆<\\/div>Ranks<\\/button>`\);\s*\}/;
    
    if (v10Regex.test(v10)) {
        v10 = v10.replace(v10Regex, '');
        fs.writeFileSync('public/js/v10-expansion.js', v10);
        console.log('✅ Removed Bottom Nav injection from V10 Expansion.');
    } else {
        console.log('ℹ️ V10 Expansion injection not found (already removed?).');
    }
} catch (e) {
    console.error('❌ Error updating v10-expansion.js:', e.message);
}
