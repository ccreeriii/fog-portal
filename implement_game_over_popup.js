const fs = require('fs');

try {
    let html = fs.readFileSync('public/seeker-arcade.html', 'utf8');

    // 1. SURGICALLY REMOVE OLD BROKEN INJECTIONS
    const inlineStart = '// --- ARCHITECT INJECTION: Level 3 UI ---';
    const inlineEnd = '// --- END ARCHITECT INJECTION ---';
    if (html.includes(inlineStart)) {
        const startIdx = html.indexOf(inlineStart);
        const endIdx = html.indexOf(inlineEnd) + inlineEnd.length;
        html = html.substring(0, startIdx) + html.substring(endIdx);
    }
    
    html = html.replace(/<!-- FQ ARCHITECT UI PATCH -->[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<!-- FQ MASTER RESULT LOGIC -->[\s\S]*?<\/script>/gi, '');

    // 2. INJECT THE MASTER GAME LOGIC (Timer + Popup Overlay)
    const masterLogic = `
    <!-- FQ MASTER RESULT LOGIC -->
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // A. Proxy switchGameView to control Video and catch Game Over
            if (typeof window.switchGameView === 'function' && !window.fqMasterPatched) {
                const originalSwitch = window.switchGameView;
                window.switchGameView = function(viewId) {
                    originalSwitch(viewId);
                    
                    const banner = document.getElementById('faithQuestBanner');
                    if (banner) banner.style.display = (viewId === 'lobbyView') ? 'block' : 'none';
                    
                    if (viewId !== 'playView' && window.gameTimerInterval) {
                        clearInterval(window.gameTimerInterval);
                    }
                    
                    // Trigger Custom Result Popup natively on Game Over
                    if (viewId === 'gameOverView') {
                        triggerResultPopup();
                    }
                };
                window.fqMasterPatched = true;
            }

            // B. Proxy startTriviaGame securely via Javascript reference
            if (typeof window.startTriviaGame === 'function' && !window.fqStartPatched) {
                const originalStart = window.startTriviaGame;
                window.startTriviaGame = function(...args) {
                    originalStart.apply(this, args);
                    
                    // Ensure Level 3 Header is fresh
                    let pv = document.getElementById('playView');
                    let oldHeader = document.getElementById('fqLevel3Header');
                    if (oldHeader) oldHeader.remove();

                    if (pv) {
                        const l3Html = \`<div id="fqLevel3Header" style="background: var(--primary, #059669); color: #fff; padding: 12px 15px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                                <div id="fqL3GameIconContainer" style="width: 45px; height: 45px; display: flex; justify-content: center; align-items: center; border-radius: 8px; background: rgba(255,255,255,0.2); padding: 4px; flex-shrink: 0; font-size: 1.8rem;"></div>
                                <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                                    <h3 id="fqL3GameName" style="margin:0; font-size:1.1rem; font-weight:800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Challenge</h3>
                                    <span id="fqL3Tagline" style="font-size:0.75rem; opacity:0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Play and earn Life Points!</span>
                                </div>
                            </div>
                            <div style="animation: pulse 1s infinite; flex-shrink: 0;">
                                <span style="background:#EF4444; color:#FFF; font-weight:800; padding:6px 16px; border-radius:25px; font-size:1.2rem; box-shadow:0 4px 15px rgba(239,68,68,0.4);">⏱️ <span id="fqL3TimerText">30</span>s</span>
                            </div>
                        </div>\`;
                        pv.insertAdjacentHTML('afterbegin', l3Html);
                    }

                    // Populate UI
                    document.getElementById('fqL3GameName').innerText = (typeof currentGameName !== 'undefined') ? currentGameName : 'Game';
                    const iconEl = document.getElementById('pgIcon');
                    const l3Icon = document.getElementById('fqL3GameIconContainer');
                    if (iconEl && l3Icon) l3Icon.innerHTML = (iconEl.tagName === 'IMG') ? \`<img src="\${iconEl.src}" style="width:100%; height:100%; object-fit:contain;">\` : (iconEl.innerHTML || '🎮');
                    
                    const tagEl = document.querySelector('#preGameView p');
                    if (tagEl) document.getElementById('fqL3Tagline').innerText = tagEl.innerText;
                    
                    // Initialize 30s Timer
                    document.getElementById('fqL3TimerText').innerText = '30';
                    window.gameTimeLeft = 30;
                    if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
                    
                    window.gameTimerInterval = setInterval(() => {
                        window.gameTimeLeft--;
                        const tText = document.getElementById('fqL3TimerText');
                        if (tText) tText.innerText = window.gameTimeLeft;
                        
                        // Time Up Protocol
                        if (window.gameTimeLeft <= 0) {
                            clearInterval(window.gameTimerInterval);
                            // Switch to game over natively to preserve backend save flow
                            if (typeof window.switchGameView === 'function') window.switchGameView('gameOverView');
                        }
                    }, 1000);
                };
                window.fqStartPatched = true;
            }

            // C. Result Popup Engine (The "New Layer")
            window.triggerResultPopup = function() {
                const l3Header = document.getElementById('fqLevel3Header');
                if (l3Header) l3Header.style.display = 'none';

                let finalScore = (typeof score !== 'undefined') ? Number(score).toFixed(1) : '0.0';
                let gName = (typeof currentGameName !== 'undefined') ? currentGameName : 'Game';
                let user = JSON.parse(localStorage.getItem('fog_user') || '{}');
                let youthId = user.youth_id || '';

                let overlay = document.getElementById('fqResultOverlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'fqResultOverlay';
                    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center; padding:20px;';
                    document.body.appendChild(overlay);
                }
                
                overlay.innerHTML = \`<div style="background:#FFF; padding:30px 20px; border-radius:20px; text-align:center; width:100%; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.3); animation: scaleIn 0.3s ease-out;">
                    <div style="font-size:3.5rem; margin-bottom:10px;">🏆</div>
                    <h2 style="margin:0 0 10px 0; color:var(--primary, #059669); font-size:1.8rem; font-weight:900;">Game Over!</h2>
                    <p style="margin:0 0 20px 0; font-size:1.1rem; color:var(--text-muted);">You scored <strong style="color:var(--text-main); font-size:1.3rem;">\${finalScore} XP</strong></p>
                    
                    <div id="fqTop3Message" style="margin-bottom:20px; padding:15px; border-radius:12px; background:#F8FAFC; border:1px solid #E2E8F0; font-size:0.95rem; display:block;">
                        <span style="opacity:0.7">Calculating leaderboard position...</span>
                    </div>
                    
                    <button onclick="document.getElementById('fqResultOverlay').style.display='none'; if(typeof openPreGame==='function') openPreGame('\${gName}'); else switchGameView('preGameView');" style="background:var(--primary, #059669); color:#FFF; border:none; padding:14px 25px; border-radius:12px; font-weight:800; font-size:1.1rem; width:100%; cursor:pointer; box-shadow:0 4px 10px rgba(5, 150, 105, 0.3);">
                        Continue
                    </button>
                </div>\`;
                
                overlay.style.display = 'flex';

                // Delay fetch slightly to ensure backend saved the score natively first
                setTimeout(() => {
                    fetch(\`/api/arcade/game-stats?game=\${encodeURIComponent(gName)}&youth_id=\${encodeURIComponent(youthId)}\`)
                        .then(res => res.json())
                        .then(data => {
                            const msgBox = document.getElementById('fqTop3Message');
                            if (msgBox && data.top3) {
                                let isTop3 = false;
                                const pts = parseFloat(finalScore);
                                
                                if (pts > 0) {
                                    if (data.top3.length < 3) isTop3 = true;
                                    else {
                                        const lowest = parseFloat(data.top3[data.top3.length - 1].points);
                                        if (pts >= lowest) isTop3 = true;
                                    }
                                }

                                if (isTop3) {
                                    msgBox.style.background = '#ECFDF5';
                                    msgBox.style.borderColor = '#10B981';
                                    msgBox.style.color = '#065F46';
                                    msgBox.innerHTML = '🎉 <strong>Congratulations!</strong><br>Your score qualifies for Today\\'s Top 3!';
                                } else {
                                    msgBox.innerHTML = 'Great effort! Keep playing to climb the daily leaderboard.';
                                }
                            }
                        }).catch(() => {
                            const msgBox = document.getElementById('fqTop3Message');
                            if (msgBox) msgBox.innerHTML = 'Score saved securely!';
                        });
                }, 1000);
            };
        });
    </script>\`;
    
    html = html.replace(/(<\/body>)/i, masterLogic + '\n$1');

    fs.writeFileSync('public/seeker-arcade.html', html);
    console.log("✅ Custom Game Over Popup and Top 3 Qualifier Notification injected.");
    fs.unlinkSync(__filename);

} catch(e) {
    console.error("❌ Error patching files:", e);
}
