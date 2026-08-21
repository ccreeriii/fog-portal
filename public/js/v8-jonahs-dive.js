window.V8JonahsDive = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,

    // Progression
    score: 0,
    distance: 0,
    lives: 3,
    level: 1,

    // Physics (Jetpack Joyride style)
    gravity: 0.35,
    lift: -0.7,
    isHolding: false,

    // Entities
    player: { x: 80, y: 200, w: 32, h: 24, vy: 0 },
    pillars: [],       // [{x, y, w, h}] Top or Bottom rock formations
    hazards: [],       // [{x, y, w, h}] Anchors
    collectibles: [],  // [{x, y, w, h, collected}] Pearls

    // Game Loop
    scrollSpeed: 3,
    spawnTimer: 0,
    frames: 0,
    invincibleTimer: 0,

    mountGameUI: function() {
        if (typeof V8Slingshot !== 'undefined' && typeof V8Slingshot.initStyles === 'function') {
            V8Slingshot.initStyles();
        }

        document.getElementById('arcadeGamesList').style.display = 'none';

        const area = document.getElementById('arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `
            <div style="padding: 10px 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0;">
                <button class="btn btn-outline btn-sm" onclick="V8JonahsDive.exitGame()">🔙 Arcade</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #0284C7; margin-right: 8px;">DEPTH <span id="jdLevelDisplay">1</span></span>
                    <span style="color: #EF4444; margin-right: 8px;">❤️ <span id="jdLivesDisplay">3</span></span>
                    SCORE: <span id="jdScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; background: #FFFFFF; padding: 15px 0;">
                <canvas id="jonahsDiveCanvas" width="360" height="460" style="background: linear-gradient(to bottom, #7DD3FC, #1E3A8A); border: 4px solid #0284C7; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); touch-action: none;"></canvas>
                
                <!-- MOBILE ON-SCREEN CONTROLS -->
                <div style="margin-top: 15px; width: 100%; max-width: 360px; padding: 0 10px; box-sizing: border-box;">
                    <button class="btn btn-primary" id="jdBtnSwim" style="width: 100%; font-size: 1.4rem; font-weight: 800; padding: 16px 0; background: #0284C7; border-radius: 12px; border: 2px solid #0369A1; box-shadow: 0 4px 0 #075985; transition: transform 0.1s, box-shadow 0.1s;">🐳 HOLD TO SWIM UP</button>
                </div>

                <div id="jdOverlay" style="position: absolute; inset: 0; background: rgba(255,255,255,0.92); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; z-index: 10;">
                    <h2 style="color: #0284C7; margin-bottom: 8px; font-size: 1.8rem; border: none; text-align:center;">Jonah's Deep Sea Dive</h2>
                    <p style="text-align: center; max-width: 90%; color: #64748B; margin-bottom: 18px; font-size: 0.92rem; line-height: 1.4;">
                        Hold the button to swim up, release to sink. Dodge the cave walls and sinking anchors (⚓)! Collect Grace Pearls (✨) for XP!
                    </p>
                    <button class="btn btn-primary" style="background: #0284C7; padding: 12px 28px;" onclick="V8JonahsDive.startGame()">▶ Dive In</button>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('jonahsDiveCanvas');
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
        this.distance = 0;
        this.level = 1;
        this.lives = 3;
        
        document.getElementById('jdScoreDisplay').innerText = '0';
        document.getElementById('jdLevelDisplay').innerText = '1';
        document.getElementById('jdLivesDisplay').innerText = '3';
        document.getElementById('jdOverlay').style.display = 'none';

        this.player = { x: 80, y: 200, w: 32, h: 24, vy: 0 };
        this.pillars = [];
        this.hazards = [];
        this.collectibles = [];
        
        this.scrollSpeed = 3.5;
        this.frames = 0;
        this.invincibleTimer = 0;
        this.isHolding = false;

        this.isPlaying = true;
        this.loop();
    },

    bindEvents: function() {
        const btnSwim = document.getElementById('jdBtnSwim');
        
        const pressDown = (e) => {
            e.preventDefault();
            this.isHolding = true;
            if(btnSwim) {
                btnSwim.style.transform = 'translateY(4px)';
                btnSwim.style.boxShadow = '0 0 0 #075985';
            }
        };
        const pressUp = (e) => {
            e.preventDefault();
            this.isHolding = false;
            if(btnSwim) {
                btnSwim.style.transform = 'translateY(0)';
                btnSwim.style.boxShadow = '0 4px 0 #075985';
            }
        };

        // Button Events
        if(btnSwim) {
            btnSwim.addEventListener('touchstart', pressDown, {passive:false});
            btnSwim.addEventListener('touchend', pressUp, {passive:false});
            btnSwim.addEventListener('mousedown', pressDown);
            btnSwim.addEventListener('mouseup', pressUp);
            btnSwim.addEventListener('mouseleave', pressUp);
        }

        // Canvas Tap Events (for intuitive screen tapping)
        this.canvas.addEventListener('touchstart', pressDown, {passive:false});
        this.canvas.addEventListener('touchend', pressUp, {passive:false});
        this.canvas.addEventListener('mousedown', pressDown);
        this.canvas.addEventListener('mouseup', pressUp);

        // Keyboard Spacebar
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'ArrowUp') {
                if (document.getElementById('arcadeActiveGameArea') && document.getElementById('arcadeActiveGameArea').style.display === 'block') {
                    pressDown(e);
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === ' ' || e.key === 'ArrowUp') pressUp(e);
        });
    },

    update: function() {
        this.frames++;
        
        // --- 1. PLAYER PHYSICS ---
        if (this.isHolding) {
            this.player.vy += this.lift; // Thrust up
        }
        this.player.vy += this.gravity; // Constant gravity
        this.player.vy *= 0.9; // Friction to terminal velocity
        
        this.player.y += this.player.vy;

        // Ceiling and Floor bounds
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.vy = 0;
        } else if (this.player.y + this.player.h > this.canvas.height) {
            // Hit the floor = take damage, bounce up
            this.takeDamage();
            this.player.y = this.canvas.height - this.player.h - 10;
            this.player.vy = -5;
        }

        // Invincibility
        if (this.invincibleTimer > 0) this.invincibleTimer--;

        // --- 2. DISTANCE & LEVEL SCALING ---
        this.distance += this.scrollSpeed;
        if (this.distance > this.level * 1500) {
            this.level++;
            document.getElementById('jdLevelDisplay').innerText = this.level;
            // Cap speed increase at level 20 for playability
            this.scrollSpeed = Math.min(3.5 + (this.level * 0.15), 7);
        }

        // --- 3. SPAWNING ---
        // Spawn Cavern Pillars every N frames (scales with speed)
        if (this.frames % Math.floor(120 / (this.scrollSpeed/3)) === 0) {
            let gapSize = Math.max(120, 200 - (this.level * 3)); // Gap narrows as level increases
            let gapPosition = Math.random() * (this.canvas.height - gapSize - 60) + 30; // Random Y position of gap

            // Top Pillar
            this.pillars.push({ x: this.canvas.width, y: 0, w: 40, h: gapPosition });
            // Bottom Pillar
            this.pillars.push({ x: this.canvas.width, y: gapPosition + gapSize, w: 40, h: this.canvas.height - (gapPosition + gapSize) });

            // 50% Chance to spawn a Pearl inside the gap
            if (Math.random() > 0.5) {
                this.collectibles.push({ x: this.canvas.width + 10, y: gapPosition + (gapSize/2) - 10, w: 20, h: 20, collected: false });
            }
        }

        // Spawn Floating Anchors randomly
        if (this.frames % Math.floor(200 / (this.scrollSpeed/3)) === 0 && this.level > 2) {
            let anchorY = Math.random() * (this.canvas.height - 100) + 50;
            this.hazards.push({ x: this.canvas.width, y: anchorY, w: 24, h: 24, active: true });
        }

        // --- 4. MOVEMENT & COLLISIONS ---
        const AABB = (r1, r2) => {
            return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
        };

        // Move Pillars
        for (let i = this.pillars.length - 1; i >= 0; i--) {
            let p = this.pillars[i];
            p.x -= this.scrollSpeed;
            
            if (this.invincibleTimer <= 0 && AABB(this.player, p)) {
                this.takeDamage();
            }
            if (p.x + p.w < 0) this.pillars.splice(i, 1);
        }

        // Move Hazards (Anchors)
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            let h = this.hazards[i];
            h.x -= this.scrollSpeed;
            
            if (h.active && this.invincibleTimer <= 0 && AABB(this.player, h)) {
                h.active = false;
                this.takeDamage();
            }
            if (h.x + h.w < 0) this.hazards.splice(i, 1);
        }

        // Move Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            let c = this.collectibles[i];
            c.x -= this.scrollSpeed;
            
            if (!c.collected && AABB(this.player, c)) {
                c.collected = true;
                let earnedXP = Math.min(15, Math.floor(5 + (this.level * 0.5)));
                this.score += earnedXP;
                document.getElementById('jdScoreDisplay').innerText = this.score;
            }
            if (c.x + c.w < 0) this.collectibles.splice(i, 1);
        }

        // Passive survival score (1 point per ~30 frames)
        if (this.frames % 30 === 0) {
            this.score += 1;
            document.getElementById('jdScoreDisplay').innerText = this.score;
        }
    },

    takeDamage: function() {
        if (this.invincibleTimer > 0) return;
        this.lives--;
        document.getElementById('jdLivesDisplay').innerText = this.lives;
        this.invincibleTimer = 60; // About 1 second of iframes
        
        // Knockback physics
        this.player.vy = -3;
        
        if (this.lives <= 0) {
            this.handleGameOver("Sank to the bottom!");
        }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Pillars (Cavern Rocks)
        this.ctx.fillStyle = '#0F172A'; // Dark Slate
        for (let p of this.pillars) {
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
            // Highlight edge for 3D depth
            this.ctx.fillStyle = '#334155';
            this.ctx.fillRect(p.x, p.y, 4, p.h);
            this.ctx.fillStyle = '#0F172A'; // Reset
        }

        // Draw Hazards (Anchors)
        this.ctx.font = "24px Arial";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "top";
        for (let h of this.hazards) {
            if (h.active) this.ctx.fillText('⚓', h.x, h.y);
        }

        // Draw Collectibles (Pearls)
        for (let c of this.collectibles) {
            if (!c.collected) this.ctx.fillText('✨', c.x, c.y);
        }

        // Draw Player (Whale) with Invincibility Flicker
        if (this.invincibleTimer % 8 < 4) {
            this.ctx.font = "32px Arial";
            // Tilt the whale based on velocity
            this.ctx.save();
            this.ctx.translate(this.player.x + 16, this.player.y + 12);
            let angle = Math.min(Math.max(this.player.vy * 0.05, -0.5), 0.5);
            this.ctx.rotate(angle);
            this.ctx.fillText('🐋', -16, -12);
            this.ctx.restore();
            
            // Draw thrust bubbles if holding
            if (this.isHolding) {
                this.ctx.fillStyle = "rgba(255,255,255,0.6)";
                this.ctx.beginPath();
                this.ctx.arc(this.player.x, this.player.y + 20, Math.random() * 4 + 2, 0, Math.PI*2);
                this.ctx.fill();
            }
        }
    },

    loop: function() {
        if (!this.isPlaying) return;
        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },

    handleGameOver: async function(titleText) {
        this.isPlaying = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

        const overlay = document.getElementById('jdOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #EF4444; font-size: 1.8rem; margin-bottom: 5px; border:none; text-align:center;">${titleText}</h2>
            <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px; text-align:center;">You survived to Depth ${this.level}.</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #10B981; font-weight: bold; font-size: 1.2rem;">${this.score} XP Earned!</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" onclick="V8JonahsDive.exitGame()">Arcade</button>
                <button class="btn btn-primary" style="background: #0284C7;" onclick="V8JonahsDive.startGame()">Dive Again</button>
            </div>
        `;

        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id && this.score > 0) {
            try {
                await fetch('/api/arcade/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        youth_id: currentMember.id,
                        game_name: "Jonah's Deep Sea Dive",
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
