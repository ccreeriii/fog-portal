window.V8NoahsArk = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,
    
    // Core Game State
    level: 1,
    maxLevel: 20,
    score: 0,
    timeLeft: 0,
    timerInterval: null,
    
    // Grid & Entities
    gridSize: 40,
    cols: 9,
    rows: 9, // 360x360 canvas
    
    player: { x: 0, y: 0 }, // 🧔
    ark: { x: 8, y: 8 },    // 🚢
    animals: [],            // [{x, y, emoji, collected}]
    walls: [],              // [{x, y}]
    
    animalEmojis: ['🦁', '🐘', '🦒', '🦓', '🐑', '🕊️', '🐢', '🦘', '🦏', '🐫'],

    mountGameUI: function() {
        // Ensure shared Arcade CSS is loaded
        if (typeof V8Slingshot !== 'undefined' && typeof V8Slingshot.initStyles === 'function') {
            V8Slingshot.initStyles();
        }
        
        document.getElementById('arcadeGamesList').style.display = 'none';
        
        const area = document.getElementById('arcadeActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = `
            <div style="padding: 10px 15px; background: #1E293B; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
                <button class="btn btn-outline btn-sm" style="color: #CBD5E1; border-color: #475569;" onclick="V8NoahsArk.exitGame()">🔙 Arcade</button>
                <div style="color: #F8FAFC; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #3B82F6; margin-right: 10px;">LVL <span id="naLevelDisplay">1</span></span>
                    <span style="color: #EF4444; margin-right: 10px;">TIME: <span id="naTimeDisplay">60</span>s</span>
                    SCORE: <span id="naScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; background: #0F172A; padding: 20px 0;">
                <canvas id="noahsArkCanvas" width="360" height="360" style="background: #A7F3D0; border: 4px solid #166534; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></canvas>
                
                <div style="margin-top: 25px; display: grid; grid-template-columns: 60px 60px 60px; grid-template-rows: 60px 60px 60px; gap: 8px; justify-content: center;">
                    <div></div>
                    <button class="btn btn-primary" style="font-size: 1.5rem; border-radius: 12px;" onclick="V8NoahsArk.move(0, -1)">⬆️</button>
                    <div></div>
                    <button class="btn btn-primary" style="font-size: 1.5rem; border-radius: 12px;" onclick="V8NoahsArk.move(-1, 0)">⬅️</button>
                    <button class="btn btn-secondary" style="font-size: 1.5rem; border-radius: 12px; background: #334155;" onclick="V8NoahsArk.startGame()">🔄</button>
                    <button class="btn btn-primary" style="font-size: 1.5rem; border-radius: 12px;" onclick="V8NoahsArk.move(1, 0)">➡️</button>
                    <div></div>
                    <button class="btn btn-primary" style="font-size: 1.5rem; border-radius: 12px;" onclick="V8NoahsArk.move(0, 1)">⬇️</button>
                    <div></div>
                </div>

                <div id="naOverlay" style="position: absolute; inset: 0; background: rgba(15,23,42,0.85); display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; padding: 20px; z-index: 10;">
                    <h2 style="color: #FF6B00; margin-bottom: 10px; font-size: 1.8rem; border: none; text-align:center;">Noah's Ark: Rescue</h2>
                    <p style="text-align: center; max-width: 90%; color: #CBD5E1; margin-bottom: 20px; font-size: 0.95rem;">Control Noah (🧔) to collect all the animals and guide them to the Ark (🚢) before the flood comes!</p>
                    <button class="btn btn-primary" onclick="V8NoahsArk.startGame()">▶ Start Rescue</button>
                </div>
            </div>
        `;
        
        this.canvas = document.getElementById('noahsArkCanvas');
        this.ctx = this.canvas.getContext('2d');
    },

    exitGame: function() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        document.getElementById('arcadeActiveGameArea').style.display = 'none';
        document.getElementById('arcadeActiveGameArea').innerHTML = '';
        document.getElementById('arcadeGamesList').style.display = 'block';
    },

    startGame: function() {
        this.score = 0;
        this.level = 1;
        document.getElementById('naScoreDisplay').innerText = '0';
        this.startLevel();
    },

    startLevel: function() {
        document.getElementById('naOverlay').style.display = 'none';
        document.getElementById('naLevelDisplay').innerText = this.level;
        
        // Time gets tighter as levels go up
        this.timeLeft = Math.max(15, 45 - (this.level * 2)); 
        document.getElementById('naTimeDisplay').innerText = this.timeLeft;
        
        this.generateLevel();
        
        this.isPlaying = true;
        this.draw();

        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (!this.isPlaying) return;
            this.timeLeft--;
            document.getElementById('naTimeDisplay').innerText = this.timeLeft;
            if (this.timeLeft <= 0) {
                this.handleGameOver("The Flood Arrived! 🌊");
            }
        }, 1000);
    },

    generateLevel: function() {
        this.player = { x: 0, y: 0 };
        this.ark = { x: this.cols - 1, y: this.rows - 1 };
        this.animals = [];
        this.walls = [];

        let numAnimals = Math.min(3 + Math.floor(this.level / 2), 12);
        let numWalls = Math.min(5 + (this.level * 2), 25);

        // Helper to check if tile is occupied
        const isOccupied = (x, y) => {
            if (x === this.player.x && y === this.player.y) return true;
            if (x === this.ark.x && y === this.ark.y) return true;
            // Keep start and end clear
            if ((x === 0 && y === 1) || (x === 1 && y === 0)) return true;
            if ((x === this.cols-1 && y === this.rows-2) || (x === this.cols-2 && y === this.rows-1)) return true;
            
            for (let a of this.animals) if (a.x === x && a.y === y) return true;
            for (let w of this.walls) if (w.x === x && w.y === y) return true;
            return false;
        };

        // Place Animals
        for (let i = 0; i < numAnimals; i++) {
            let placed = false;
            while (!placed) {
                let rx = Math.floor(Math.random() * this.cols);
                let ry = Math.floor(Math.random() * this.rows);
                if (!isOccupied(rx, ry)) {
                    this.animals.push({ 
                        x: rx, y: ry, 
                        emoji: this.animalEmojis[Math.floor(Math.random() * this.animalEmojis.length)],
                        collected: false 
                    });
                    placed = true;
                }
            }
        }

        // Place Walls (Mud/Rocks)
        for (let i = 0; i < numWalls; i++) {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 50) {
                let rx = Math.floor(Math.random() * this.cols);
                let ry = Math.floor(Math.random() * this.rows);
                if (!isOccupied(rx, ry)) {
                    this.walls.push({ x: rx, y: ry });
                    placed = true;
                }
                attempts++;
            }
        }
    },

    move: function(dx, dy) {
        if (!this.isPlaying) return;

        let nx = this.player.x + dx;
        let ny = this.player.y + dy;

        // Bounds Check
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) return;

        // Wall Check
        for (let w of this.walls) {
            if (w.x === nx && w.y === ny) return; // Blocked
        }

        // Move Player
        this.player.x = nx;
        this.player.y = ny;

        // Animal Check
        for (let a of this.animals) {
            if (!a.collected && a.x === nx && a.y === ny) {
                a.collected = true;
                let earnedXP = Math.floor(5 + (this.level * 0.5));
                this.score += earnedXP;
                document.getElementById('naScoreDisplay').innerText = this.score;
            }
        }

        // Ark Check
        if (nx === this.ark.x && ny === this.ark.y) {
            const allCollected = this.animals.every(a => a.collected);
            if (allCollected) {
                this.handleLevelWin();
            } else {
                // Flash message: Collect them all first!
                this.ctx.fillStyle = "rgba(0,0,0,0.7)";
                this.ctx.fillRect(0, this.canvas.height/2 - 20, this.canvas.width, 40);
                this.ctx.fillStyle = "white";
                this.ctx.font = "14px Arial";
                this.ctx.textAlign = "center";
                this.ctx.fillText("You must collect ALL animals first!", this.canvas.width/2, this.canvas.height/2 + 5);
                setTimeout(() => this.draw(), 1000);
                return;
            }
        }

        this.draw();
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid Lines (optional for aesthetics)
        this.ctx.strokeStyle = "rgba(255,255,255,0.2)";
        for (let i = 0; i <= this.cols; i++) {
            this.ctx.beginPath(); this.ctx.moveTo(i * this.gridSize, 0); this.ctx.lineTo(i * this.gridSize, this.canvas.height); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.moveTo(0, i * this.gridSize); this.ctx.lineTo(this.canvas.width, i * this.gridSize); this.ctx.stroke();
        }

        // Draw Walls (Rocks/Mud)
        this.ctx.fillStyle = '#78350F';
        for (let w of this.walls) {
            this.ctx.fillRect(w.x * this.gridSize + 2, w.y * this.gridSize + 2, this.gridSize - 4, this.gridSize - 4);
        }

        // Draw Ark
        this.ctx.font = "28px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        // Blue water under Ark
        this.ctx.fillStyle = '#3B82F6';
        this.ctx.fillRect(this.ark.x * this.gridSize, this.ark.y * this.gridSize, this.gridSize, this.gridSize);
        this.ctx.fillText('🚢', this.ark.x * this.gridSize + 20, this.ark.y * this.gridSize + 20);

        // Draw Animals
        for (let a of this.animals) {
            if (!a.collected) {
                this.ctx.fillText(a.emoji, a.x * this.gridSize + 20, a.y * this.gridSize + 20);
            }
        }

        // Draw Player
        this.ctx.fillText('🧔', this.player.x * this.gridSize + 20, this.player.y * this.gridSize + 20);

        // Draw Trailing Animals (cute visual effect)
        let collectedCount = 0;
        for (let a of this.animals) {
            if (a.collected) {
                // Draw a small icon near the player to show they are following
                this.ctx.font = "14px Arial";
                this.ctx.fillText(a.emoji, (this.player.x * this.gridSize) + (collectedCount * 8), this.player.y * this.gridSize + 5);
                collectedCount++;
            }
        }
    },

    handleLevelWin: function() {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        this.score += (this.timeLeft * 2); // Time Bonus!
        document.getElementById('naScoreDisplay').innerText = this.score;
        
        const overlay = document.getElementById('naOverlay');
        overlay.style.display = 'flex';
        
        if (this.level >= this.maxLevel) {
            overlay.innerHTML = `
                <h2 style="color: #F59E0B; font-size: 2.2rem; margin-bottom: 5px; border:none; text-align:center;">🏆 GAME BEATEN!</h2>
                <p style="color: #FFF; font-size: 1rem; margin-bottom: 15px; text-align:center;">You saved the animals across 20 intense levels!</p>
                <div style="background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #10B981; font-weight: bold; font-size: 1.2rem;">Total XP: ${this.score}</span>
                </div>
                <button class="btn btn-primary" onclick="V8NoahsArk.handleGameOver('Victory!')">Claim XP & Exit</button>
            `;
        } else {
            overlay.innerHTML = `
                <h2 style="color: #10B981; font-size: 2rem; margin-bottom: 5px; border:none;">Level ${this.level} Cleared! 🎉</h2>
                <p style="color: #FFF; font-size: 1rem; margin-bottom: 15px;">Animals are safe!</p>
                <div style="background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">Current XP: ${this.score}</span>
                </div>
                <button class="btn btn-primary" onclick="V8NoahsArk.level++; V8NoahsArk.startLevel()">Next Level ▶</button>
            `;
        }
    },

    handleGameOver: async function(titleText = "Game Over!") {
        this.isPlaying = false;
        clearInterval(this.timerInterval);
        
        const overlay = document.getElementById('naOverlay');
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <h2 style="color: #EF4444; font-size: 2rem; margin-bottom: 5px; border:none;">${titleText}</h2>
            <p style="color: #FFF; font-size: 1rem; margin-bottom: 15px;">You made it to Level ${this.level}.</p>
            <div style="background: rgba(0,0,0,0.5); padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">${this.score} XP Earned!</span>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-secondary" onclick="V8NoahsArk.exitGame()">Exit to Arcade</button>
                <button class="btn btn-primary" onclick="V8NoahsArk.startGame()">Play Again</button>
            </div>
        `;

        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id && this.score > 0) {
            try {
                await fetch('/api/arcade/submit', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ youth_id: currentMember.id, game_name: "Noah's Ark", score: this.score, actor: typeof currentUser !== 'undefined' ? currentUser : 'System' })
                });
                
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                if (typeof window.V8Arcade !== 'undefined') {
                    window.V8Arcade.loadLeaderboard();
                    window.V8Arcade.updateTotalXP();
                }
                
                this.score = 0; 
            } catch(e) { console.error("Failed to save score.", e); }
        }
    }
};

// Keyboard listener for desktop testing (Optional, but nice to have)
window.addEventListener('keydown', (e) => {
    if (document.getElementById('arcadeActiveGameArea').style.display === 'block' && V8NoahsArk.isPlaying) {
        if (e.key === 'ArrowUp') V8NoahsArk.move(0, -1);
        if (e.key === 'ArrowDown') V8NoahsArk.move(0, 1);
        if (e.key === 'ArrowLeft') V8NoahsArk.move(-1, 0);
        if (e.key === 'ArrowRight') V8NoahsArk.move(1, 0);
    }
});
