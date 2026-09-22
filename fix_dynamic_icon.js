const fs = require('fs');

try {
    let html = fs.readFileSync('public/seeker-arcade.html', 'utf8');

    const oldInjectionRegex = /\/\/ --- ARCHITECT INJECTION: Level 3 UI ---[\s\S]*?\/\/ --- END ARCHITECT INJECTION ---/g;
    
    const newInjection = `// --- ARCHITECT INJECTION: Level 3 UI ---
        let pv = document.getElementById('playView');
        if (pv && !document.getElementById('fqLevel3Header')) {
            const l3Html = \`<div id="fqLevel3Header" style="background: var(--primary, #059669); color: #fff; padding: 12px 15px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                
                <!-- Left Side: Dynamic Icon & Text -->
                <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                    <div id="fqL3GameIconContainer" style="width: 45px; height: 45px; display: flex; justify-content: center; align-items: center; border-radius: 8px; background: rgba(255,255,255,0.2); padding: 4px; flex-shrink: 0; font-size: 1.8rem;"></div>
                    <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                        <h3 id="fqL3GameName" style="margin:0; font-size:1.1rem; font-weight:800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Challenge</h3>
                        <span id="fqL3Tagline" style="font-size:0.75rem; opacity:0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Play and earn Life Points!</span>
                    </div>
                </div>

                <!-- Right Side: Timer -->
                <div style="animation: pulse 1s infinite; flex-shrink: 0;">
                    <span style="background:#EF4444; color:#FFF; font-weight:800; padding:6px 16px; border-radius:25px; font-size:1.2rem; box-shadow:0 4px 15px rgba(239,68,68,0.4);">⏱️ <span id="fqL3TimerText">15</span>s</span>
                </div>
                
            </div>\`;
            pv.insertAdjacentHTML('afterbegin', l3Html);
        }
        
        if (document.getElementById('fqLevel3Header')) {
            // Populate Title
            document.getElementById('fqL3GameName').innerText = (typeof currentGameName !== 'undefined') ? currentGameName : 'Faith Quest Challenge';
            
            // Dynamically clone the exact game icon (handles emojis, SVGs, or Images)
            const iconEl = document.getElementById('pgIcon');
            const l3IconContainer = document.getElementById('fqL3GameIconContainer');
            if (iconEl && l3IconContainer) {
                if (iconEl.tagName === 'IMG') {
                    l3IconContainer.innerHTML = \`<img src="\${iconEl.src}" style="width:100%; height:100%; object-fit:contain;">\`;
                } else {
                    l3IconContainer.innerHTML = iconEl.innerHTML;
                }
            }
            
            // Populate Tagline
            const preGame = document.getElementById('preGameView');
            if (preGame) {
                const tagEl = preGame.querySelector('p');
                if (tagEl && tagEl.innerText) document.getElementById('fqL3Tagline').innerText = tagEl.innerText;
            }
            
            // Reset Timer
            document.getElementById('fqL3TimerText').innerText = '15';
        }

        window.gameTimeLeft = 15;
        if (window.gameTimerInterval) clearInterval(window.gameTimerInterval);
        
        window.gameTimerInterval = setInterval(() => {
            window.gameTimeLeft--;
            const tText = document.getElementById('fqL3TimerText');
            if (tText) tText.innerText = window.gameTimeLeft;
            
            if (window.gameTimeLeft <= 0) {
                clearInterval(window.gameTimerInterval);
                if(typeof currentQuestions !== 'undefined' && typeof renderQuestion === 'function') {
                    currentIndex = currentQuestions.length; 
                    renderQuestion(); 
                }
            }
        }, 1000);
        // --- END ARCHITECT INJECTION ---\`;

    if (oldInjectionRegex.test(html)) {
        html = html.replace(oldInjectionRegex, newInjection);
        fs.writeFileSync('public/seeker-arcade.html', html);
        console.log('✅ Level 3 Header upgraded with dynamic game icon mirroring.');
    } else {
        console.log('⚠️ Previous injection not found.');
    }

    fs.unlinkSync(__filename);
} catch(e) {
    console.error("❌ Error patching files:", e);
}
