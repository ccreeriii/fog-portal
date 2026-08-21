window.V8RedSea = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,

    // Progression
    level: 1,
    maxLevel: 50,
    score: 0,
    mannaCollected: 0,
    mannaTarget: 10,
    lives: 3,
    invincibleTimer: 0,

    // Lane Coordinates
    lanes: [100, 180, 260],
    currentLane: 1, // 0 = Left, 1 = Center, 2 = Right
    targetX: 180,
    playerX: 180,
    playerY: 380,

    // Jump Physics
    isJumping: false,
    jumpProgress: 0,
    jumpHeight: 0,

    // Game Loop & Spawns
    speed: 3.5,
    obstacles: [],   // [{x, y, lane, type, isJumpable, emoji, w, h}]
    collectibles: [],// [{x, y, lane, emoji, collected}]
    spawnTimer: 0,
    waveOffset: 0,

    mountGameUI: function() {
        if (typeof V8Slingshot !== 'undefined' && typeof V8Slingshot.initStyles === 'function') {
            V8Slingshot.initStyles();
        }

        document.getElementById('arcadeGamesList').style.display = 'none';

        const area = document.getElementById('arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `
            <div style="padding: 10px 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0;">
                <button class="btn btn-outline btn-sm" onclick="V8RedSea.exitGame()">🔙 Arcade</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #3B82F6; margin-right: 8px;">LVL <span id="rsLevelDisplay">1</span></span>
                    <span style="color: #EF4444; margin-right: 8px;">❤️ <span id="rsLivesDisplay">3</span></span>
                    <span style="color: #F59E0B; margin-right: 8px;">🍞 <span id="rsMannaDisplay">0</span>/10</span>
                    SCORE: <span id="rsScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; background: #FFFFFF; padding: 15px 0;">
                <canvas id="redSeaCanvas" width="360" height="460" style="background: #FEF3C7; border: 4px solid #3B82F6; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"></canvas>
                
                <!-- MOBILE ON-SCREEN CONTROLS -->
                <div style="margin-top: 15px; display: flex; gap: 15px; width: 100%; max-width: 360px; padding: 0 10px; box-sizing: border-box;">
                    <button class="btn btn-outline" style="flex: 1; font-size: 1.4rem; padding: 12px 0; background: #F8FAFC; border-radius: 12px;" onclick="V8RedSea.moveLane(-1)">⬅️ Left</button>
                    <button class="btn btn-primary" style="flex: 1; font-size: 1.4rem; padding: 12px 0; background: #3B82F6; border-radius: 12px;" onclick="V8RedSea.jump()">⬆️ Jump</button>
                    <button class="btn btn-outline" style="flex: 1; font-size: 1.4rem; padding: 12px 0; background: #F8FAFC; border-radius: 12px;" onclick="V8RedSea.moveLane(1)">Right ➡️</button>
                </div>

                <div id="rsOverlay" style="position: absolute; inset: 0; background: rgba(255,255,255,0.92); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; z-index: 10;">
                    <h2 style="color: #3B82F6; margin-bottom: 8px; font-size: 1.8rem; border: none; text-align:center;">Moses' Red Sea Dash</h2>
                    <p style="text-align: center; max-width: 90%; color: #64748B; margin-bottom: 18px; font-size: 0.92rem; line-height: 1.4;">
                        Dodge Pharaoh's chariots (🛒), leap over rocks (🪨) & crabs (🦀), and collect Manna (🍞) as you cross to safety!
                    </p>
                    <button class="btn btn-primary" style="background: #3B82F6; padding: 12px 28px;" onclick="V8RedSea.startGame()">▶ Start Dash</button>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('redSeaCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.bindEvents();
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
        this.lives = 3;
        document.getElementById('rsScoreDisplay').innerText = '0';
        this.startLevel();
    },

    startLevel: function() {
        document.getElementById('rsOverlay').style.display = 'none';
        document.getElementById('rsLevelDisplay').innerText = this.level;
        document.getElementById('rsLivesDisplay').innerText = this.lives;
        
        this.mannaCollected = 0;
        this.mannaTarget = Math.min(8 + (this.level * 2), 25);
        document.getElementById('rsMannaDisplay').innerText = `0/${this.mannaTarget}`;

        this.currentLane = 1;
        this.playerX = this.lanes[1];
        this.targetX = this.lanes[1];
        this.isJumping = false;
        this.jumpHeight = 0;
        this.invincibleTimer = 0;

        // Speed curve (capped safely for smooth mobile response)
        this.speed = Math.min(3.5 + (this.level * 0.15), 7.5);
        this.obstacles = [];
        this.collectibles = [];
        this.spawnTimer = 0;

        this.isPlaying = true;
        this.loop();
    },

    bindEvents: function() {
        // Touch Swipe on Canvas
        let touchStartX = 0;
        let touchStartY = 0;

        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isPlaying) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isPlaying) return;
            const diffX = e.changedTouches[0].clientX - touchStartX;
            const diffY = e.changedTouches[0].clientY - touchStartY;

            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (diffX > 30) this.moveLane(1);
                else if (diffX < -30) this.moveLane(-1);
            } else {
                if (diffY < -30) this.jump();
            }
        }, { passive: true });
    },

    moveLane: function(dir) {
        if (!this.isPlaying) return;
        this.currentLane = Math.max(0, Math.min(2, this.currentLane + dir));
        this.targetX = this.lanes[this.currentLane];
    },

    jump: function() {
        if (!this.isPlaying || this.isJumping) return;
        this.isJumping = true;
        this.jumpProgress = 0;
    },

    update: function() {
        // Smooth horizontal interpolation
        this.playerX += (this.targetX - this.playerX) * 0.35;

        // Jump trajectory
        if (this.isJumping) {
            this.jumpProgress += 0.07;
            this.jumpHeight = Math.sin(this.jumpProgress * Math.PI) * 45;
            if (this.jumpProgress >= 1) {
                this.isJumping = false;
                this.jumpHeight = 0;
            }
        }

        if (this.invincibleTimer > 0) {
            this.invincibleTimer--;
        }

        this.waveOffset += 0.05;

        // Procedural Spawning
        this.spawnTimer += this.speed;
        if (this.spawnTimer > 130) {
            this.spawnTimer = 0;
            const lane = Math.floor(Math.random() * 3);
            const isObstacle = Math.random() < 0.65;

            if (isObstacle) {
                const types = [
                    { emoji: '🛒', isJumpable: false }, // Chariot (must dodge)
                    { emoji: '🪨', isJumpable: true },  // Rock (can jump or dodge)
                    { emoji: '🦀', isJumpable: true }   // Crab (can jump or dodge)
                ];
                const selected = types[Math.floor(Math.random() * types.length)];
                this.obstacles.push({
                    x: this.lanes[lane],
                    y: -30,
                    lane: lane,
                    emoji: selected.emoji,
                    isJumpable: selected.isJumpable
                });
            } else {
                this.collectibles.push({
                    x: this.lanes[lane],
                    y: -30,
                    lane: lane,
                    emoji: '🍞',
                    collected: false
                });
            }
        }

        // Update Obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y += this.speed;

            // Collision check (Hitbox: ~30px radius around player)
            if (Math.abs(obs.y - this.playerY) < 28 && Math.abs(obs.x - this.playerX) < 25) {
                const avoidedByJump = obs.isJumpable && this.jumpHeight > 18;
                if (!avoidedByJump && this.invincibleTimer <= 0) {
                    this.lives--;
                    this.invincibleTimer = 40; // Invincibility flash
                    document.getElementById('rsLivesDisplay').innerText = this.lives;
                    
                    if (this.lives <= 0) {
                        this.handleGameOver("Caught by Obstacles!");
                        return;
                    }
                }
            }

            if (obs.y > this.canvas.height + 40) {
                this.obstacles.splice(i, 1);
            }
        }

        // Update Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const item = this.collectibles[i];
            item.y += this.speed;

            if (!item.collected && Math.abs(item.y - this.playerY) < 32 && Math.abs(item.x - this.playerX) < 28) {
                item.collected = true;
                this.mannaCollected++;
                
                let earnedXP = Math.min(10, Math.floor(5 + (this.level * 0.1)));
                this.score += earnedXP;
                
                document.getElementById('rsMannaDisplay').innerText = `${this.mannaCollected}/${this.mannaTarget}`;
                document.getElementById('rsScoreDisplay').innerText = this.score;

                if (this.mannaCollected >= this.mannaTarget) {
                    this.handleLevelWin();
                    return;
                }
            }

            if (item.y > this.canvas.height + 40) {
                this.collectibles.splice(i, 1);
            }
        }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Dry Sandy Seafloor Path
        this.ctx.fillStyle = '#FEF3C7';
        this.ctx.fillRect(50, 0, 260, this.canvas.height);

        // Subtle Lane Dividers
        this.ctx.strokeStyle = 'rgba(217, 119, 6, 0.15)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([12, 12]);
        this.ctx.beginPath();
        this.ctx.moveTo(140, 0); this.ctx.lineTo(140, this.canvas.height);
        this.ctx.moveTo(220, 0); this.ctx.lineTo(220, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Left & Right Parted Water Walls
        for (let y = 0; y < this.canvas.height; y += 20) {
            let waveLeft = Math.sin((y * 0.05) + this.waveOffset) * 6;
            let waveRight = Math.cos((y * 0.05) + this.waveOffset) * 6;

            // Left Sea Wall
            this.ctx.fillStyle = '#2563EB';
            this.ctx.fillRect(0, y, 50 + waveLeft, 22);
            this.ctx.fillStyle = '#93C5FD';
            this.ctx.fillRect(45 + waveLeft, y, 6, 22);

            // Right Sea Wall
            this.ctx.fillStyle = '#2563EB';
            this.ctx.fillRect(310 + waveRight, y, 50, 22);
            this.ctx.fillStyle = '#93C5FD';
            this.ctx.fillRect(305 + waveRight, y, 6, 22);
        }

        // Draw Collectibles
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        for (let item of this.collectibles) {
            if (!item.collected) {
                this.ctx.fillText(item.emoji, item.x, item.y);
            }
        }

        // Draw Obstacles
        for (let obs of this.obstacles) {
            this.ctx.fillText(obs.emoji, obs.x, obs.y);
        }

        // Draw Player (Moses) with Invincibility Flicker & Jump Shadow
        if (this.invincibleTimer % 4 < 2) {
            // Shadow under player during jump
            if (this.isJumping) {
                this.ctx.beginPath();
                this.ctx.ellipse(this.playerX, this.playerY + 12, 14, 6, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(0,0,0,0.15)';
                this.ctx.fill();
            }

            // Moses Character
            this.ctx.font = "30px Arial";
            this.ctx.fillText('🧙‍♂️', this.playerX, this.playerY - this.jumpHeight);
        }
    },

    loop: function() {
        if (!this.isPlaying) return;
        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    handleLevelWin: function() {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        this.score += (this.level * 50); // Level completion bonus
        document.getElementById('rsScoreDisplay').innerText = this.score;

        const overlay = document.getElementById('rsOverlay');
        overlay.style.display = 'flex';

        if (this.level >= this.maxLevel) {
            overlay.innerHTML = `
                <h2 style="color: #F59E0B; font-size: 2.2rem; margin-bottom: 5px; border:none; text-align:center;">🏆 EXODUS COMPLETE!</h2>
                <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px; text-align:center;">You guided the people across all 50 levels of the Red Sea!</p>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #10B981; font-weight: bold; font-size: 1.2rem;">Total XP: ${this.score}</span>
                </div>
                <button class="btn btn-primary" style="background: #3B82F6;" onclick="V8RedSea.handleGameOver('Victory!')">Claim XP & Exit</button>
            `;
        } else {
            overlay.innerHTML = `
                <h2 style="color: #10B981; font-size: 2rem; margin-bottom: 5px; border:none; text-align:center;">Stage ${this.level} Cleared! 🎉</h2>
                <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px;">Manna gathered!</p>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">Current XP: ${this.score}</span>
                </div>
                <button class="btn btn-primary" style="background: #3B82F6;" onclick="V8RedSea.level++; V8RedSea.startLevel()">Next Stage ▶</button>
            `;
        }
    },

    handleGameOver: async function(titleText = "Run Ended!") {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        const overlay = document.getElementById('rsOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #EF4444; font-size: 2rem; margin-bottom: 5px; border:none; text-align:center;">${titleText}</h2>
            <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px; text-align:center;">You reached Level ${this.level}.</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">${this.score} XP Earned!</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" onclick="V8RedSea.exitGame()">Exit to Arcade</button>
                <button class="btn btn-primary" style="background: #3B82F6;" onclick="V8RedSea.startGame()">Play Again</button>
            </div>
        `;

        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id && this.score > 0) {
            try {
                await fetch('/api/arcade/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        youth_id: currentMember.id,
                        game_name: "Moses' Red Sea Dash",
                        score: this.score,
                        actor: typeof currentUser !== 'undefined' ? currentUser : 'System'
                    })
                });

                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (typeof window.V8Arcade !== 'undefined') {
                    window.V8Arcade.loadLeaderboard();
                    window.V8Arcade.updateTotalXP();
                }

                this.score = 0;
            } catch(e) {
                console.error("Failed to submit score.", e);
            }
        }
    }
};

// Keyboard Arrow & Spacebar listeners for desktop testing
window.addEventListener('keydown', (e) => {
    if (document.getElementById('arcadeActiveGameArea') && document.getElementById('arcadeActiveGameArea').style.display === 'block' && V8RedSea.isPlaying) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') V8RedSea.moveLane(-1);
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') V8RedSea.moveLane(1);
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
            e.preventDefault();
            V8RedSea.jump();
        }
    }
});
