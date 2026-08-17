window.V8Slingshot = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,
    
    // Core Game Mechanics added for Levels!
    level: 1,
    score: 0,
    stonesLeft: 3,
    
    // Physics & Game State
    gravity: 0.6,
    friction: 0.8,
    origin: { x: 80, y: 350 },
    
    stone: {
        x: 80, y: 350, r: 12,
        vx: 0, vy: 0,
        isDragging: false,
        isFlying: false,
        active: true
    },
    
    blocks: [],
    
    initStyles: function() {
        if (!document.getElementById('arcade-css')) {
            const style = document.createElement('style');
            style.id = 'arcade-css';
            style.innerHTML = `
                .arcade-grid { display: flex; flex-direction: column; gap: 15px; }
                .arcade-game-tile { background: #1E293B; border: 1px solid #334155; border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.2s; }
                .arcade-game-tile:hover { transform: translateY(-3px); border-color: #FF6B00; box-shadow: 0 5px 15px rgba(255,107,0,0.2); }
                .game-tile-icon { font-size: 2.5rem; background: #0F172A; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 12px; flex-shrink: 0; }
                .game-tile-info { flex: 1; }
                .game-tile-info h3 { color: #F8FAFC; font-size: 1.1rem; margin-bottom: 4px; }
                .game-tile-info p { color: #94A3B8; font-size: 0.8rem; margin: 0; line-height: 1.3; }
                .game-tile-action { background: #FF6B00; color: #FFF; font-weight: bold; font-size: 0.8rem; padding: 6px 12px; border-radius: 20px; }
                #slingshotCanvas { display: block; width: 100%; height: 450px; background: linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%); touch-action: none; cursor: crosshair; }
            `;
            document.head.appendChild(style);
        }
    },

    mountGameUI: function() {
        this.initStyles();
        document.getElementById('arcadeGamesList').style.display = 'none';
        
        const area = document.getElementById('arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `
            <div style="padding: 10px 15px; background: #1E293B; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
                <button class="btn btn-outline btn-sm" style="color: #CBD5E1; border-color: #475569;" onclick="V8Slingshot.exitGame()">🔙 Arcade</button>
                <div style="color: #F8FAFC; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #3B82F6; margin-right: 10px;">LVL <span id="ssLevelDisplay">1</span></span>
                    <span style="color: #F59E0B; margin-right: 10px;">STONES: <span id="ssStonesDisplay">3</span></span>
                    SCORE: <span id="ssScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            <div style="position: relative;">
                <canvas id="slingshotCanvas"></canvas>
                <div id="ssOverlay" style="position: absolute; inset: 0; background: rgba(15,23,42,0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; color: white;">
                    <h2 style="color: #FF6B00; margin-bottom: 10px; font-size: 1.8rem; border: none;">Armor Breaker</h2>
                    <p style="text-align: center; max-width: 80%; color: #CBD5E1; margin-bottom: 20px;">Destroy the blocks of Fear, Pride, and Doubt to level up!</p>
                    <button class="btn btn-primary" onclick="V8Slingshot.startGame()">▶ Start Game</button>
                </div>
            </div>
        `;
        
        this.canvas = document.getElementById('slingshotCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.bindEvents();
    },

    resizeCanvas: function() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 450;
        this.origin = { x: 60, y: this.canvas.height - 100 };
    },

    exitGame: function() {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        document.getElementById('arcadeActiveGameArea').style.display = 'none';
        document.getElementById('arcadeActiveGameArea').innerHTML = '';
        document.getElementById('arcadeGamesList').style.display = 'block';
    },

    startGame: function() {
        this.score = 0;
        this.level = 1;
        document.getElementById('ssScoreDisplay').innerText = '0';
        this.startLevel();
    },

    startLevel: function() {
        document.getElementById('ssOverlay').style.display = 'none';
        document.getElementById('ssLevelDisplay').innerText = this.level;
        this.stonesLeft = 3;
        document.getElementById('ssStonesDisplay').innerText = this.stonesLeft;
        
        this.resetStone();
        this.generateBlocks();

        this.isPlaying = true;
        this.loop();
    },

    generateBlocks: function() {
        this.blocks = [];
        const groundY = this.canvas.height - 40;
        
        // Procedural Level Difficulty Math
        let numBlocks = Math.min(3 + this.level, 18);
        let maxCols = Math.min(numBlocks, 3 + Math.floor(this.level / 3));
        let boxSize = 35;
        let startX = this.canvas.width - (maxCols * boxSize) - 20;

        const labels = ['FEAR', 'PRIDE', 'DOUBT', 'ENVY', 'LUST', 'GREED', 'HATE', 'LIES'];
        const colors = ['#EF4444', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F43F5E'];

        let bCount = 0;
        let row = 0;
        let colsInRow = maxCols;

        while(bCount < numBlocks && colsInRow > 0) {
            for(let c = 0; c < colsInRow; c++) {
                if(bCount >= numBlocks) break;
                // Add slight jitter so stacked physics feels slightly unstable/fun
                let jitterX = Math.random() * 2 - 1; 
                this.blocks.push({
                    x: startX + (c * boxSize) + jitterX,
                    y: groundY - ((row + 1) * boxSize),
                    w: boxSize - 2,
                    h: boxSize - 2,
                    active: true,
                    text: labels[bCount % labels.length],
                    color: colors[bCount % colors.length]
                });
                bCount++;
            }
            row++;
            colsInRow--; // Make it a pyramid
            startX += (boxSize / 2);
        }
    },

    resetStone: function() {
        this.stone.x = this.origin.x;
        this.stone.y = this.origin.y;
        this.stone.vx = 0;
        this.stone.vy = 0;
        this.stone.isDragging = false;
        this.stone.isFlying = false;
        this.stone.active = this.stonesLeft > 0;
    },

    bindEvents: function() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const handleDown = (e) => {
            if (!this.isPlaying || this.stone.isFlying || !this.stone.active) return;
            e.preventDefault();
            const pos = getPos(e);
            const dist = Math.hypot(pos.x - this.stone.x, pos.y - this.stone.y);
            if (dist < 40) this.stone.isDragging = true;
        };

        const handleMove = (e) => {
            if (!this.stone.isDragging) return;
            e.preventDefault();
            const pos = getPos(e);
            
            const dx = pos.x - this.origin.x;
            const dy = pos.y - this.origin.y;
            const dist = Math.hypot(dx, dy);
            const maxDrag = 80;
            
            if (dist > maxDrag) {
                this.stone.x = this.origin.x + (dx / dist) * maxDrag;
                this.stone.y = this.origin.y + (dy / dist) * maxDrag;
            } else {
                this.stone.x = pos.x;
                this.stone.y = pos.y;
            }
        };

        const handleUp = (e) => {
            if (!this.stone.isDragging) return;
            e.preventDefault();
            this.stone.isDragging = false;
            this.stone.isFlying = true;
            
            this.stonesLeft--;
            document.getElementById('ssStonesDisplay').innerText = this.stonesLeft;
            
            this.stone.vx = (this.origin.x - this.stone.x) * 0.28;
            this.stone.vy = (this.origin.y - this.stone.y) * 0.28;
        };

        this.canvas.addEventListener('mousedown', handleDown);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        this.canvas.addEventListener('touchstart', handleDown, {passive: false});
        this.canvas.addEventListener('touchmove', handleMove, {passive: false});
        window.addEventListener('touchend', handleUp);
    },

    updatePhysics: function() {
        const groundY = this.canvas.height - 40;

        // Block Gravity (Collapsing structures)
        this.blocks.forEach(b => {
            if (!b.active) return;
            if (b.y + b.h < groundY) {
                // Check if supported by another block
                let supported = false;
                this.blocks.forEach(other => {
                    if (other !== b && other.active) {
                        if (Math.abs(b.x - other.x) < b.w && Math.abs((b.y + b.h) - other.y) < 5) {
                            supported = true;
                        }
                    }
                });
                if (!supported) b.y += 5; // Fall down
            }
        });

        if (this.stone.isFlying) {
            this.stone.vy += this.gravity;
            this.stone.x += this.stone.vx;
            this.stone.y += this.stone.vy;

            // Ground Collision
            if (this.stone.y + this.stone.r >= groundY) {
                this.stone.y = groundY - this.stone.r;
                this.stone.vy *= -this.friction;
                this.stone.vx *= this.friction;
                
                // Stop rolling trigger
                if (Math.abs(this.stone.vx) < 0.5 && Math.abs(this.stone.vy) < 1) {
                    this.stone.isFlying = false;
                    setTimeout(() => this.checkGameState(), 1000); 
                }
            }

            // Screen bounds
            if (this.stone.x > this.canvas.width || this.stone.x < 0) {
                this.stone.isFlying = false;
                setTimeout(() => this.checkGameState(), 1000);
            }

            // AABB Block Collisions
            this.blocks.forEach(b => {
                if (b.active) {
                    let testX = this.stone.x;
                    let testY = this.stone.y;
                    
                    if (this.stone.x < b.x) testX = b.x;
                    else if (this.stone.x > b.x + b.w) testX = b.x + b.w;
                    
                    if (this.stone.y < b.y) testY = b.y;
                    else if (this.stone.y > b.y + b.h) testY = b.y + b.h;

                    let distance = Math.hypot(this.stone.x - testX, this.stone.y - testY);

                    if (distance <= this.stone.r) {
                        b.active = false;
                        this.stone.vx *= 0.6; 
                        this.stone.vy *= -0.6; 
                        this.score += 50;
                        document.getElementById('ssScoreDisplay').innerText = this.score;
                    }
                }
            });
        }
    },

    checkGameState: function() {
        let allBroken = this.blocks.every(b => !b.active);

        if (allBroken) {
            this.isPlaying = false;
            this.score += (this.level * 100); // Level completion bonus
            document.getElementById('ssScoreDisplay').innerText = this.score;
            this.handleLevelWin();
        } 
        else if (this.stonesLeft <= 0) {
            this.isPlaying = false;
            this.handleGameOver();
        } 
        else {
            this.resetStone(); // Load next stone
        }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const groundY = this.canvas.height - 40;

        // Ground
        this.ctx.fillStyle = '#16A34A';
        this.ctx.fillRect(0, groundY, this.canvas.width, 40);

        // Slingshot Post
        this.ctx.fillStyle = '#78350F';
        this.ctx.fillRect(this.origin.x - 5, this.origin.y, 10, groundY - this.origin.y);

        // Elastic Band
        if (this.stone.active && (!this.stone.isFlying || this.stone.isDragging)) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.origin.x, this.origin.y);
            this.ctx.lineTo(this.stone.x, this.stone.y);
            this.ctx.strokeStyle = '#111';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }

        // Blocks
        this.blocks.forEach(b => {
            if (b.active) {
                this.ctx.fillStyle = b.color;
                this.ctx.fillRect(b.x, b.y, b.w, b.h);
                
                this.ctx.fillStyle = '#FFF';
                this.ctx.font = '9px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(b.text, b.x + b.w/2, b.y + b.h/2 + 3);
            }
        });

        // Stone
        if (this.stone.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.stone.x, this.stone.y, this.stone.r, 0, Math.PI * 2);
            this.ctx.fillStyle = '#475569';
            this.ctx.fill();
            this.ctx.strokeStyle = '#0F172A';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    },

    loop: function() {
        if (!this.isPlaying) return;
        this.updatePhysics();
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    handleLevelWin: function() {
        this.draw();
        const overlay = document.getElementById('ssOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #10B981; font-size: 2rem; margin-bottom: 5px; border:none;">Level ${this.level} Cleared! 🎉</h2>
            <p style="color: #FFF; font-size: 1rem; margin-bottom: 15px;">Obstacles crushed.</p>
            <div style="background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">Total XP: ${this.score}</span>
            </div>
            <button class="btn btn-primary" onclick="V8Slingshot.level++; V8Slingshot.startLevel()">Next Level ▶</button>
        `;
    },

    handleGameOver: async function() {
        this.draw();
        const overlay = document.getElementById('ssOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #EF4444; font-size: 2rem; margin-bottom: 5px; border:none;">Out of Stones!</h2>
            <p style="color: #FFF; font-size: 1rem; margin-bottom: 15px;">You made it to Level ${this.level}.</p>
            <div style="background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">${this.score} XP Earned!</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" onclick="V8Slingshot.exitGame()">Exit</button>
                <button class="btn btn-primary" onclick="V8Slingshot.startGame()">Play Again</button>
            </div>
        `;

        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id && this.score > 0) {
            try {
                await fetch('/api/arcade/submit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youth_id: currentMember.id, game_name: "David's Slingshot", score: this.score, actor: currentUser })
                });
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (typeof window.V8Arcade !== 'undefined') window.V8Arcade.loadLeaderboard();
            } catch(e) { console.error("Failed to save score.", e); }
        }
    }
};

// V8 ARCADE LEADERBOARD ENGINE (No app.js edits needed)
window.V8Arcade = {
    switchTab: function(tab) {
        const list = document.getElementById('arcadeGamesList');
        const board = document.getElementById('arcadeLeaderboardView');
        if(list) list.style.display = tab === 'games' ? 'block' : 'none';
        if(board) board.style.display = tab === 'leaderboard' ? 'block' : 'none';
        
        document.getElementById('btnArcadeGames').classList.toggle('active', tab === 'games');
        document.getElementById('btnArcadeLeaderboard').classList.toggle('active', tab === 'leaderboard');
        
        if (tab === 'leaderboard') this.loadLeaderboard();
    },

    loadLeaderboard: async function() {
        const container = document.getElementById('arcadeLeaderboardContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/arcade/leaderboard');
            if (!res.ok) return;
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748B;">No arcade scores yet. Play a game to rank up! 🏆</div>';
                return;
            }

            container.innerHTML = data.map((user, index) => {
                let rankIcon = `<span style="color: #666; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '<span style="font-size: 1.5rem;">🥇</span>';
                if (index === 1) rankIcon = '<span style="font-size: 1.5rem;">🥈</span>';
                if (index === 2) rankIcon = '<span style="font-size: 1.5rem;">🥉</span>';

                const avatarHtml = user.profile_picture
                    ? `<img src="${user.profile_picture}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">`
                    : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #334155; color: #FFF; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(user.name||'U').charAt(0).toUpperCase()}</div>`;

                const bgStyle = index === 0 ? 'background: #1E293B; border-color: #F59E0B;' : 'background: #1E293B; border-color: #334155;';

                return `
                <div style="${bgStyle} border-style: solid; border-width: 1px; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 16px;">
                    <div style="width: 30px; text-align: center;">${rankIcon}</div>
                    ${avatarHtml}
                    <div style="flex-grow: 1; font-weight: bold; color: #F8FAFC; font-size: 1.05rem;">${user.name}</div>
                    <div style="font-weight: bold; color: #10B981; font-size: 1.1rem;">⭐ ${user.total_score} XP</div>
                </div>`;
            }).join('');
        } catch (e) {
            console.error('Failed to load arcade leaderboard', e);
        }
    }
};
