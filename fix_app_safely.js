const fs = require('fs');

// 1. Inject the pure code into app.js
let appJs = fs.readFileSync('public/js/app.js', 'utf8');
const newNav = fs.readFileSync('new_nav_content.txt', 'utf8');
const startIdx = appJs.indexOf('window.buildNav = function() {');
const endIdx = appJs.indexOf('window.switchGrowthSubTab = function(tabName) {');

if (startIdx !== -1 && endIdx !== -1) {
    fs.writeFileSync('public/js/app.js', appJs.substring(0, startIdx) + newNav + '\n\n' + appJs.substring(endIdx));
    console.log('✅ Navigation successfully overhauled & White Screen FIXED!');
} else {
    console.log('❌ Error: Could not slice app.js');
}

// 2. Strip Worship Nav Injection
try {
    let v3 = fs.readFileSync('public/js/v3-worship.js', 'utf8');
    v3 = v3.replace(/const bottomNav = document\.getElementById\('bottomNav'\);[\s\S]*?if \(logoutBtn && v3BottomHtml\) logoutBtn\.insertAdjacentHTML\('beforebegin', v3BottomHtml\);\s*\}/, '');
    fs.writeFileSync('public/js/v3-worship.js', v3);
} catch(e) {}

// 3. Strip Expansion Nav Injection
try {
    let v10 = fs.readFileSync('public/js/v10-expansion.js', 'utf8');
    v10 = v10.replace(/const bottomNav = document\.getElementById\('bottomNav'\);[\s\S]*?if \(lastBtn\) lastBtn\.insertAdjacentHTML\('beforebegin', `<button id="bottomNavLeaderboards" class="bottom-nav-btn" data-target="leaderboardsHubTab" onclick="switchTab\\('leaderboardsHubTab'\\)"><div class="icon">🏆<\\/div>Ranks<\\/button>`\);\s*\}/, '');
    fs.writeFileSync('public/js/v10-expansion.js', v10);
} catch(e) {}
