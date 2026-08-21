window.V8PetersLeap = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,

    // Progression
    score: 0,
    level: 1,
    heightReached: 0,
    lives: 3,

    // Physics
    gravity: 0.35,
    jumpStrength: -9.5,
    cameraY: 0,

    // Entities
    player: { x: 160, y: 350, w: 24, h: 24, vx: 0, vy: 0 },
    platforms: [],
    collectibles: [],
    hazards: [], // Storm clouds

    // Inputs
    keys: { left: false, right: false },

    mountGameUI: function() {
        if (typeof V8Slingshot !== 'undefined' && typeof V8Slingshot.initStyles === 'function') {
            V8Slingshot.initStyles();
        }

        document.getElementById('arcadeGamesList').style.display = 'none';

        const area = document.getElementById('arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `
            <div style="padding: 10px 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0;">
                <button class="btn btn-outline btn-sm" onclick="V8PetersLeap.exitGame()">🔙 Arcade</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #3B82F6; margin-right: 8px;">LVL <span id="plLevelDisplay">1</span></span>
                    <span style="color: #EF4444; margin-right: 8px;">❤️ <span id="plLivesDisplay">3</span></span>
                    SCORE: <span id="plScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; background: #FFFFFF; padding: 15px 0;">
                <canvas id="petersLeapCanvas" width="360" height="460" style="background: linear-gradient(to bottom, #DBEAFE, #EFF6FF); border: 4px solid #8B5CF6; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"></canvas>
                
                <!-- MOBILE ON-SCREEN CONTROLS -->
                <div style="margin-top: 15px; display: flex; gap: 15px; width: 100%; max-width: 360px; padding: 0 10px; box-sizing: border-box;">
                    <button class="btn btn-primary" id="plBtnLeft" style="flex: 1; font-size: 1.4rem; padding: 15px 0; background: #8B5CF6; border-radius: 12px;">⬅️ LEFT</button>
                    <button class="btn btn-primary" id="plBtnRight" style="flex: 1; font-size: 1.4rem; padding: 15px 0; background: #8B5CF6; border-radius: 12px;">RIGHT ➡️</button>
                </div>

                <div id="plOverlay" style="position: absolute; inset: 0; background: rgba(255,255,255,0.92); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; z-index: 10;">
                    <h2 style="color: #8B5CF6; margin-bottom: 8px; font-size: 1.8rem; border: none; text-align:center;">Peter's Leap of Faith</h2>
                    <p style="text-align: center; max-width: 90%; color: #64748B; margin-bottom: 18px; font-size: 0.92rem; line-height: 1.4;">
                        Keep your eyes on Jesus! Bounce on waves (🌊) and rocks (🪨) to climb higher. Collect Faith Stars (⭐) but dodge the storms (⛈️)!
                    </p>
                    <button class="btn btn-primary" style="background: #8B5CF6; padding: 12px 28px;" onclick="V8PetersLeap.startGame()">▶ Start Bouncing</button>
                </div>
            </div>
        `;

        this.canvas = document.getElementById('petersLeapCanvas');
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
        this.heightReached = 0;
        this.lives = 3;
        this.cameraY = 0;

        document.getElementById('plScoreDisplay').innerText = '0';
        document.getElementById('plLevelDisplay').innerText = '1';
        document.getElementById('plLivesDisplay').innerText = '3';
        document.getElementById('plOverlay').style.display = 'none';

        this.player = { x: 160, y: 350, w: 24, h: 24, vx: 0, vy: 0 };
        this.platforms = [];
        this.collectibles = [];
        this.hazards = [];

        // Generate initial starting platforms
        this.platforms.push({ x: 130, y: 400, w: 60, type: 'rock', moving: false });
        for (let i = 0; i < 7; i++) {
            this.generatePlatformPair(350 - (i * 70));
        }

        this.isPlaying = true;
        this.loop();
    },

    generatePlatformPair: function(baseY) {
        let x = Math.random() * (this.canvas.width - 60);
        
        // Base width decreases slightly as level increases
        let width = Math.max(30, 65 - (this.level * 1.5));
        let isMoving = this.level > 2 && Math.random() < (this.level * 0.05);

        this.platforms.push({
            x: x, 
            y: baseY, 
            w: width, 
            type: Math.random() > 0.5 ? 'wave' : 'rock',
            moving: isMoving,
            vx: isMoving ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0
        });

        // 20% chance to spawn a Faith Star on a platform
        if (Math.random() < 0.20) {
            this.collectibles.push({ x: x + 15, y: baseY - 25, collected: false });
        }

        // 10% chance to spawn a Storm Cloud slightly above/between platforms
        if (this.level > 1 && Math.random() < 0.10) {
            this.hazards.push({ x: Math.random() * (this.canvas.width - 30), y: baseY - 40, active: true });
        }
    },

    bindEvents: function() {
        const btnLeft = document.getElementById('plBtnLeft');
        const btnRight = document.getElementById('plBtnRight');

        if(btnLeft) {
            btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.left = true; }, {passive:false});
            btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.left = false; }, {passive:false});
            btnLeft.addEventListener('mousedown', () => this.keys.left = true);
            btnLeft.addEventListener('mouseup', () => this.keys.left = false);
            btnLeft.addEventListener('mouseleave', () => this.keys.left = false);
        }
        if(btnRight) {
            btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.right = true; }, {passive:false});
            btnRight.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.right = false; }, {passive:false});
            btnRight.addEventListener('mousedown', () => this.keys.right = true);
            btnRight.addEventListener('mouseup', () => this.keys.right = false);
            btnRight.addEventListener('mouseleave', () => this.keys.right = false);
        }

        // Keyboard Fallbacks
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
        });
    },

    update: function() {
        // Player Horizontal Movement
        if (this.keys.left) this.player.vx -= 0.6;
        else if (this.keys.right) this.player.vx += 0.6;
        else this.player.vx *= 0.8; // Friction

        // Cap speed
        this.player.vx = Math.max(-5, Math.min(5, this.player.vx));
        this.player.x += this.player.vx;

        // Screen Wrap (Doodle Jump mechanic)
        if (this.player.x > this.canvas.width) this.player.x = -this.player.w;
        else if (this.player.x < -this.player.w) this.player.x = this.canvas.width;

        // Player Vertical Gravity
        this.player.vy += this.gravity;
        this.player.y += this.player.vy;

        // Platform Collisions (Only when falling down!)
        if (this.player.vy > 0) {
            for (let p of this.platforms) {
                // Check X and Y bounds
                if (
                    this.player.x + this.player.w > p.x &&
                    this.player.x < p.x + p.w &&
                    this.player.y + this.player.h >= p.y &&
                    this.player.y + this.player.h <= p.y + 15 // Snap margin
                ) {
                    this.player.vy = this.jumpStrength; // BOUNCE!
                    
                    // Minor score for bouncing on a new platform
                    this.score += 2;
                    document.getElementById('plScoreDisplay').innerText = this.score;
                    break;
                }
            }
        }

        // Collectibles (Stars)
        for (let c of this.collectibles) {
            if (!c.collected && Math.abs(this.player.x - c.x) < 25 && Math.abs(this.player.y - c.y) < 25) {
                c.collected = true;
                this.score += 25; // XP Boost
                document.getElementById('plScoreDisplay').innerText = this.score;
            }
        }

        // Hazards (Storms)
        for (let h of this.hazards) {
            if (h.active && Math.abs(this.player.x - h.x) < 25 && Math.abs(this.player.y - h.y) < 25) {
                h.active = false;
                this.lives--;
                document.getElementById('plLivesDisplay').innerText = this.lives;
                
                // Small bounce to prevent hitting it twice instantly
                this.player.vy = this.jumpStrength * 0.7; 

                if (this.lives <= 0) {
                    this.handleGameOver("The storm overtook you!");
                    return;
                }
            }
        }

        // Camera Scroll Logic (Keep Peter in middle of screen)
        if (this.player.y < this.canvas.height / 2) {
            let diff = (this.canvas.height / 2) - this.player.y;
            this.player.y = this.canvas.height / 2;
            
            // Move everything else down
            for (let p of this.platforms) p.y += diff;
            for (let c of this.collectibles) c.y += diff;
            for (let h of this.hazards) h.y += diff;

            this.heightReached += diff;
            this.score += Math.floor(diff * 0.1); // Height score
            document.getElementById('plScoreDisplay').innerText = this.score;

            // Level Up logic
            if (this.heightReached > this.level * 1500) {
                this.level++;
                document.getElementById('plLevelDisplay').innerText = this.level;
            }

            // Spawn new platforms at the top
            let highestPlatformY = Math.min(...this.platforms.map(p => p.y));
            if (highestPlatformY > 50) {
                this.generatePlatformPair(highestPlatformY - (60 + Math.random() * 30));
            }
        }

        // Moving Platforms Logic
        for (let p of this.platforms) {
            if (p.moving) {
                p.x += p.vx;
                if (p.x < 0 || p.x + p.w > this.canvas.width) p.vx *= -1;
            }
        }

        // Cleanup entities that fall below screen
        this.platforms = this.platforms.filter(p => p.y < this.canvas.height + 50);
        this.collectibles = this.collectibles.filter(c => c.y < this.canvas.height + 50);
        this.hazards = this.hazards.filter(h => h.y < this.canvas.height + 50);

        // Death by falling off screen
        if (this.player.y > this.canvas.height) {
            this.lives--;
            document.getElementById('plLivesDisplay').innerText = this.lives;
            if (this.lives <= 0) {
                this.handleGameOver("You fell into the deep!");
                return;
            } else {
                // Bounce back up and give an emergency platform
                this.player.vy = this.jumpStrength * 1.5;
                this.player.y = this.canvas.height - 50;
                this.platforms.push({ x: this.player.x - 20, y: this.canvas.height - 20, w: 60, type: 'rock', moving: false });
            }
        }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Platforms
        for (let p of this.platforms) {
            if (p.type === 'wave') {
                this.ctx.fillStyle = '#3B82F6'; // Blue wave
                this.ctx.fillRect(p.x, p.y, p.w, 12);
                this.ctx.fillStyle = '#93C5FD'; // Crest
                this.ctx.fillRect(p.x, p.y, p.w, 4);
            } else {
                this.ctx.fillStyle = '#64748B'; // Gray rock
                this.ctx.fillRect(p.x, p.y, p.w, 14);
                this.ctx.fillStyle = '#94A3B8';
                this.ctx.fillRect(p.x+2, p.y+2, p.w-4, 4);
            }
        }

        // Collectibles (Stars)
        this.ctx.font = "20px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        for (let c of this.collectibles) {
            if (!c.collected) this.ctx.fillText('⭐', c.x, c.y);
        }

        // Hazards (Storms)
        for (let h of this.hazards) {
            if (h.active) this.ctx.fillText('⛈️', h.x, h.y);
        }

        // Player (Peter)
        this.ctx.font = "28px Arial";
        this.ctx.fillText('🚶‍♂️', this.player.x + 12, this.player.y + 12);
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

        const overlay = document.getElementById('plOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #EF4444; font-size: 1.8rem; margin-bottom: 5px; border:none; text-align:center;">${titleText}</h2>
            <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px; text-align:center;">You reached Level ${this.level}.</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">${this.score} XP Earned!</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" onclick="V8PetersLeap.exitGame()">Arcade</button>
                <button class="btn btn-primary" style="background: #8B5CF6;" onclick="V8PetersLeap.startGame()">Leap Again</button>
            </div>
        `;

        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id && this.score > 0) {
            try {
                await fetch('/api/arcade/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        youth_id: currentMember.id,
                        game_name: "Peter's Leap of Faith",
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
