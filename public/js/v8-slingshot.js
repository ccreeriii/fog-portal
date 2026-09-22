window.V8Slingshot = {
    canvas: null,
    ctx: null,
    animationFrameId: null,
    isPlaying: false,
    
    // Core Game Mechanics
    level: 1,
    maxLevel: 50,
    score: 0,
    stonesLeft: 5,
    
    // Physics & Game State
    gravity: 0.6,
    friction: 0.8,

    // Strong target ricochet with deliberately soft ground rebound.
    blockBounceRetention: 0.94,
    minRicochetSpeed: 7,
    groundBounce: 0.00,

    // Sling launch tuning.
    // Significantly stronger than the original 80px / 0.28 setup.
    maxDragDistance: 120,
    launchPower: 0.40,
    maxLaunchSpeed: 46,
    minLaunchPull: 14,

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
                .arcade-game-tile { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .arcade-game-tile:hover { transform: translateY(-3px); border-color: #FF6B00; box-shadow: 0 5px 15px rgba(255,107,0,0.1); }
                .game-tile-icon { font-size: 2.5rem; background: #F8FAFC; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 12px; flex-shrink: 0; border: 1px solid #E2E8F0; }
                .game-tile-info { flex: 1; }
                .game-tile-info h3 { color: #0F172A; font-size: 1.1rem; margin-bottom: 4px; border:none; padding:0; }
                .game-tile-info p { color: #64748B; font-size: 0.8rem; margin: 0; line-height: 1.3; }
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
            <div style="padding: 10px 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0;">
                <button class="btn btn-outline btn-sm" onclick="V8Slingshot.exitGame()">🔙 Arcade</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem; text-align: right;">
                    <span style="color: #3B82F6; margin-right: 10px;">LVL <span id="ssLevelDisplay">1</span></span>
                    <span style="color: #F59E0B; margin-right: 10px;">STONES: <span id="ssStonesDisplay">5</span></span>
                    SCORE: <span id="ssScoreDisplay" style="color: #10B981;">0</span>
                </div>
            </div>
            <div style="position: relative;">
                <canvas id="slingshotCanvas"></canvas>
                <div id="ssOverlay" style="position: absolute; inset: 0; background: rgba(255,255,255,0.9); display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; z-index: 10;">
                    <h2 style="color: #FF6B00; margin-bottom: 10px; font-size: 1.8rem; border: none; text-align:center;">Armor Breaker</h2>
                    <p style="text-align: center; max-width: 90%; color: #64748B; margin-bottom: 20px; font-size: 0.95rem;">Destroy the blocks of Fear, Pride, and Doubt! Target points scale up as levels get harder.</p>
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
        this.stonesLeft = 5;
        document.getElementById('ssStonesDisplay').innerText = this.stonesLeft;
        
        this.resetStone();
        this.generateBlocks();

        this.isPlaying = true;
        this.loop();
    },

    generateBlocks: function() {
        this.blocks = [];
        const groundY = this.canvas.height - 40;
        
        let numBlocks = Math.min(3 + this.level, 20); 
        let boxSize = 35;
        
        const labels = ['FEAR', 'PRIDE', 'DOUBT', 'ENVY', 'LUST', 'GREED', 'HATE', 'LIES'];
        const colors = ['#EF4444', '#8B5CF6', '#F59E0B', '#3B82F6', '#EC4899', '#10B981', '#6366F1', '#F43F5E'];

        if (this.level < 5) {
            let cols = 3 + Math.floor(this.level / 2);
            let startX = this.canvas.width - (cols * boxSize) - 30;
            let row = 0;
            while (cols > 0 && this.blocks.length < numBlocks) {
                for (let c = 0; c < cols; c++) {
                    if (this.blocks.length >= numBlocks) break;
                    let jitterX = Math.random() * 2 - 1;
                    this.blocks.push({
                        x: startX + (c * boxSize) + jitterX,
                        y: groundY - ((row + 1) * boxSize),
                        w: boxSize - 2, h: boxSize - 2, active: true, floating: false, moving: false,
                        text: labels[this.blocks.length % labels.length],
                        color: colors[this.blocks.length % colors.length]
                    });
                }
                row++; cols--; startX += (boxSize / 2);
            }
        } 
        else if (this.level < 10) {
            for (let i = 0; i < numBlocks; i++) {
                let col = i % 3; 
                let row = Math.floor(i / 3);
                this.blocks.push({
                    x: this.canvas.width - 60 - (col * 80), 
                    y: groundY - ((row + 1) * boxSize),
                    w: boxSize - 2, h: boxSize - 2, active: true, floating: false, moving: false,
                    text: labels[i % labels.length], color: colors[i % colors.length]
                });
            }
        } 
        else if (this.level < 20) {
            for (let i = 0; i < numBlocks; i++) {
                this.blocks.push({
                    x: (this.canvas.width / 2) + Math.random() * (this.canvas.width / 2 - 40),
                    y: 40 + Math.random() * (groundY - 140),
                    w: boxSize, h: boxSize, active: true, floating: true, moving: false,
                    text: labels[i % labels.length], color: colors[i % colors.length]
                });
            }
        } 
        else {
            for (let i = 0; i < numBlocks; i++) {
                let baseSpeed = 1 + (this.level * 0.05); 
                let speedY = baseSpeed * (Math.random() > 0.5 ? 1 : -1);
                
                this.blocks.push({
                    x: (this.canvas.width / 2) + Math.random() * (this.canvas.width / 2 - 40),
                    y: 60 + Math.random() * (groundY - 180),
                    vy: speedY,
                    w: boxSize, h: boxSize, active: true, floating: true, moving: true,
                    text: labels[i % labels.length], color: colors[i % colors.length]
                });
            }
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
        const canvas = this.canvas;

        /*
         * IMPORTANT:
         *
         * Immersive Game Mode can visually scale the canvas.
         * Pointer coordinates arrive in CSS viewport pixels,
         * while the game physics use the canvas's internal
         * coordinate system.
         *
         * Convert between them so finger movement corresponds
         * correctly to the actual sling pull distance.
         */
        const getPos = (event) => {
            const rect =
                canvas.getBoundingClientRect();

            const scaleX =
                canvas.width
                / Math.max(1, rect.width);

            const scaleY =
                canvas.height
                / Math.max(1, rect.height);

            return {
                x:
                    (event.clientX - rect.left)
                    * scaleX,

                y:
                    (event.clientY - rect.top)
                    * scaleY
            };
        };

        let activePointerId = null;

        const beginDrag = (event) => {
            if (
                !this.isPlaying
                || this.stone.isFlying
                || !this.stone.active
            ) {
                return;
            }

            const pos =
                getPos(event);

            const distance =
                Math.hypot(
                    pos.x - this.stone.x,
                    pos.y - this.stone.y
                );

            /*
             * A slightly larger grab zone is much more
             * comfortable for thumbs on a phone.
             */
            if (distance > 48) {
                return;
            }

            event.preventDefault();

            activePointerId =
                event.pointerId
                ?? 'legacy';

            this.stone.isDragging = true;

            if (
                event.pointerId !== undefined
                && canvas.setPointerCapture
            ) {
                try {
                    canvas.setPointerCapture(
                        event.pointerId
                    );
                } catch (_) {}
            }
        };

        const moveDrag = (event) => {
            if (!this.stone.isDragging) {
                return;
            }

            if (
                event.pointerId !== undefined
                && activePointerId !== null
                && activePointerId !== 'legacy'
                && event.pointerId !== activePointerId
            ) {
                return;
            }

            event.preventDefault();

            const pos =
                getPos(event);

            const dx =
                pos.x - this.origin.x;

            const dy =
                pos.y - this.origin.y;

            const distance =
                Math.hypot(dx, dy);

            const maxDrag =
                this.maxDragDistance;

            if (
                distance > maxDrag
                && distance > 0
            ) {
                this.stone.x =
                    this.origin.x
                    + (
                        dx
                        / distance
                    ) * maxDrag;

                this.stone.y =
                    this.origin.y
                    + (
                        dy
                        / distance
                    ) * maxDrag;
            } else {
                this.stone.x = pos.x;
                this.stone.y = pos.y;
            }
        };

        const releaseStone = (event) => {
            if (!this.stone.isDragging) {
                return;
            }

            if (
                event.pointerId !== undefined
                && activePointerId !== null
                && activePointerId !== 'legacy'
                && event.pointerId !== activePointerId
            ) {
                return;
            }

            event.preventDefault();

            const pullX =
                this.origin.x
                - this.stone.x;

            const pullY =
                this.origin.y
                - this.stone.y;

            const pullDistance =
                Math.hypot(
                    pullX,
                    pullY
                );

            /*
             * Tiny accidental touches should not consume
             * one of the player's three stones.
             */
            if (
                pullDistance
                < this.minLaunchPull
            ) {
                this.stone.isDragging = false;
                activePointerId = null;
                this.resetStone();
                return;
            }

            this.stone.isDragging = false;
            this.stone.isFlying = true;

            this.stonesLeft--;

            const stonesDisplay =
                document.getElementById(
                    'ssStonesDisplay'
                );

            if (stonesDisplay) {
                stonesDisplay.innerText =
                    this.stonesLeft;
            }

            let vx =
                pullX
                * this.launchPower;

            let vy =
                pullY
                * this.launchPower;

            /*
             * Strong enough to cross the game field,
             * but capped so extreme drags cannot create
             * unstable physics.
             */
            const launchSpeed =
                Math.hypot(vx, vy);

            if (
                launchSpeed
                > this.maxLaunchSpeed
            ) {
                const scale =
                    this.maxLaunchSpeed
                    / launchSpeed;

                vx *= scale;
                vy *= scale;
            }

            this.stone.vx = vx;
            this.stone.vy = vy;

            if (
                event.pointerId !== undefined
                && canvas.releasePointerCapture
            ) {
                try {
                    if (
                        canvas.hasPointerCapture
                        && canvas.hasPointerCapture(
                            event.pointerId
                        )
                    ) {
                        canvas.releasePointerCapture(
                            event.pointerId
                        );
                    }
                } catch (_) {}
            }

            activePointerId = null;
        };

        const cancelDrag = (event) => {
            if (!this.stone.isDragging) {
                return;
            }

            if (
                event
                && event.pointerId !== undefined
                && activePointerId !== null
                && activePointerId !== 'legacy'
                && event.pointerId !== activePointerId
            ) {
                return;
            }

            this.stone.isDragging = false;
            activePointerId = null;
            this.resetStone();
        };

        /*
         * Pointer Events provide one reliable path for:
         *   - touch
         *   - Apple Pencil/stylus
         *   - mouse
         *
         * Pointer capture is especially important because
         * the finger can leave the stone/canvas while pulling.
         */
        if (window.PointerEvent) {
            canvas.addEventListener(
                'pointerdown',
                beginDrag,
                {
                    passive: false
                }
            );

            canvas.addEventListener(
                'pointermove',
                moveDrag,
                {
                    passive: false
                }
            );

            canvas.addEventListener(
                'pointerup',
                releaseStone,
                {
                    passive: false
                }
            );

            canvas.addEventListener(
                'pointercancel',
                cancelDrag,
                {
                    passive: false
                }
            );

            canvas.addEventListener(
                'lostpointercapture',
                event => {
                    /*
                     * Do not cancel after a normal release.
                     * releaseStone() already clears the ID.
                     */
                    if (
                        activePointerId !== null
                        && this.stone.isDragging
                    ) {
                        cancelDrag(event);
                    }
                }
            );
        } else {
            /*
             * Legacy fallback for browsers without
             * Pointer Events.
             */
            const touchToPointer = touch => ({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                pointerId: undefined
            });

            canvas.addEventListener(
                'mousedown',
                beginDrag,
                {
                    passive: false
                }
            );

            window.addEventListener(
                'mousemove',
                moveDrag,
                {
                    passive: false
                }
            );

            window.addEventListener(
                'mouseup',
                releaseStone,
                {
                    passive: false
                }
            );

            canvas.addEventListener(
                'touchstart',
                event => {
                    if (!event.touches.length) {
                        return;
                    }

                    event.preventDefault();

                    const pointer =
                        touchToPointer(
                            event.touches[0]
                        );

                    pointer.preventDefault =
                        () => event.preventDefault();

                    beginDrag(pointer);
                },
                {
                    passive: false
                }
            );

            window.addEventListener(
                'touchmove',
                event => {
                    if (
                        !this.stone.isDragging
                        || !event.touches.length
                    ) {
                        return;
                    }

                    event.preventDefault();

                    const pointer =
                        touchToPointer(
                            event.touches[0]
                        );

                    pointer.preventDefault =
                        () => event.preventDefault();

                    moveDrag(pointer);
                },
                {
                    passive: false
                }
            );

            window.addEventListener(
                'touchend',
                event => {
                    if (!this.stone.isDragging) {
                        return;
                    }

                    event.preventDefault();

                    releaseStone({
                        clientX: this.stone.x,
                        clientY: this.stone.y,
                        preventDefault: () =>
                            event.preventDefault(),
                        pointerId: undefined
                    });
                },
                {
                    passive: false
                }
            );

            window.addEventListener(
                'touchcancel',
                cancelDrag,
                {
                    passive: false
                }
            );
        }
    },

    reflectStoneFromBlock: function(b) {
        /*
         * Forward carry-through:
         * destroy the block without bouncing backward.
         * This lets one well-aimed stone continue through
         * several aligned targets.
         */
        const direction =
            this.stone.vx >= 0
                ? 1
                : -1;

        const forwardSpeed =
            Math.max(
                Math.abs(this.stone.vx),
                this.minRicochetSpeed
            );

        this.stone.vx =
            direction * forwardSpeed;

        this.stone.vy *= 0.92;

        if (
            Math.abs(this.stone.vy)
            < 0.75
        ) {
            this.stone.vy = 0;
        }

        /*
         * Move past the block that was just destroyed.
         */
        if (
            b
            && Number.isFinite(b.x)
            && Number.isFinite(b.w)
        ) {
            this.stone.x =
                direction > 0
                    ? b.x
                        + b.w
                        + this.stone.r
                        + 2
                    : b.x
                        - this.stone.r
                        - 2;
        }
    },

    updatePhysics: function() {
        const groundY = this.canvas.height - 40;

        this.blocks.forEach(b => {
            if (!b.active) return;
            
            if (!b.floating) {
                if (b.y + b.h < groundY) {
                    let supported = false;
                    this.blocks.forEach(other => {
                        if (other !== b && other.active && !other.floating) {
                            if (Math.abs(b.x - other.x) < b.w && Math.abs((b.y + b.h) - other.y) < 5) {
                                supported = true;
                            }
                        }
                    });
                    if (!supported) b.y += 5; 
                }
            } else if (b.moving) {
                b.y += b.vy;
                if (b.y < 30 || b.y + b.h > groundY - 30) {
                    b.vy *= -1; 
                }
            }
        });

        if (this.stone.isFlying) {
            this.stone.vy += this.gravity;
            this.stone.x += this.stone.vx;
            this.stone.y += this.stone.vy;

            if (this.stone.y + this.stone.r >= groundY) {
                this.stone.y = groundY - this.stone.r;
                // Ground bounce stays low.
                this.stone.vy =
                    -Math.min(
                        Math.abs(this.stone.vy)
                            * this.groundBounce,
                        3.5
                    );

                this.stone.vx *= 0.58;
                
                if (Math.abs(this.stone.vx) < 0.5 && Math.abs(this.stone.vy) < 0.8) {
                    this.stone.isFlying = false;
                    setTimeout(() => this.checkGameState(), 1000); 
                }
            }

            if (this.stone.x > this.canvas.width || this.stone.x < 0) {
                this.stone.isFlying = false;
                setTimeout(() => this.checkGameState(), 1000);
            }

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
                        this.reflectStoneFromBlock(b);
                        
                        let earnedXP = Math.min(10, Math.floor(5 + (this.level * 0.1)));
                        this.score += earnedXP;
                        
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
            this.score += Math.floor(10 + (this.level * 0.5)); 
            document.getElementById('ssScoreDisplay').innerText = this.score;
            this.handleLevelWin();
        } 
        else if (this.stonesLeft <= 0) {
            this.isPlaying = false;
            this.handleGameOver();
        } 
        else {
            this.resetStone(); 
        }
    },

    draw: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const groundY = this.canvas.height - 40;

        this.ctx.fillStyle = '#16A34A';
        this.ctx.fillRect(0, groundY, this.canvas.width, 40);

        /*
         * Enhanced Y-shaped wooden slingshot.
         */
        this.ctx.save();

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.strokeStyle = '#78350F';
        this.ctx.lineWidth = 12;

        this.ctx.beginPath();
        this.ctx.moveTo(
            this.origin.x,
            groundY
        );
        this.ctx.lineTo(
            this.origin.x,
            this.origin.y + 12
        );
        this.ctx.stroke();

        this.ctx.strokeStyle = '#92400E';
        this.ctx.lineWidth = 10;

        this.ctx.beginPath();
        this.ctx.moveTo(
            this.origin.x,
            this.origin.y + 14
        );
        this.ctx.lineTo(
            this.origin.x - 20,
            this.origin.y - 26
        );

        this.ctx.moveTo(
            this.origin.x,
            this.origin.y + 14
        );
        this.ctx.lineTo(
            this.origin.x + 20,
            this.origin.y - 26
        );
        this.ctx.stroke();

        /*
         * Bands stay with the sling.
         * They disappear immediately after launch.
         */
        if (
            this.stone.active
            && !this.stone.isFlying
        ) {
            this.ctx.strokeStyle = '#3F2A1D';
            this.ctx.lineWidth = 4;

            this.ctx.beginPath();

            this.ctx.moveTo(
                this.origin.x - 20,
                this.origin.y - 26
            );

            this.ctx.lineTo(
                this.stone.x,
                this.stone.y
            );

            this.ctx.moveTo(
                this.origin.x + 20,
                this.origin.y - 26
            );

            this.ctx.lineTo(
                this.stone.x,
                this.stone.y
            );

            this.ctx.stroke();
        }

        this.ctx.restore();

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
        
        if (this.level >= this.maxLevel) {
            overlay.innerHTML = `
                <h2 style="color: #F59E0B; font-size: 2.2rem; margin-bottom: 5px; border:none; text-align:center;">🏆 GAME BEATEN!</h2>
                <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px; text-align:center;">You cleared all 50 levels of Armor Breaker!</p>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #10B981; font-weight: bold; font-size: 1.2rem;">Game Score: ${this.score}</span>
                </div>
                <button class="btn btn-primary" onclick="V8Slingshot.handleGameOver()">Save Score & Exit</button>
            `;
        } else {
            overlay.innerHTML = `
                <h2 style="color: #10B981; font-size: 2rem; margin-bottom: 5px; border:none;">Level ${this.level} Cleared! 🎉</h2>
                <p style="color: #0F172A; font-size: 1rem; margin-bottom: 15px;">Obstacles crushed.</p>
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 20px; border-radius: 12px; margin-bottom: 20px;">
                    <span style="color: #F59E0B; font-weight: bold; font-size: 1.2rem;">Current Score: ${this.score}</span>
                </div>
                <button class="btn btn-primary" onclick="V8Slingshot.level++; V8Slingshot.startLevel()">Next Level ▶</button>
            `;
        }
    },

    handleGameOver: async function() {
        this.draw();
        const overlay = document.getElementById('ssOverlay');
        overlay.style.display = 'flex';
        const finalScore = this.score;
        await window.V10Expansion.submitCanvasGameResult({ gameName: "David's Slingshot", score: finalScore, overlayId: 'ssOverlay', playAgain: 'V8Slingshot.startGame()' });
        this.score = 0;
    }
};

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

    updateTotalXP: async function() {
        if (typeof currentMember !== 'undefined' && currentMember && currentMember.id) {
            try {
                const res = await fetch(`/api/gamification/points/${currentMember.id}`);
                if (res.ok) {
                    const data = await res.json();
                    const xpDisplay = document.getElementById('arcadeCurrentXP');
                    if (xpDisplay) xpDisplay.innerText = data.points || 0;
                }
            } catch (e) { console.error("XP Fetch Error", e); }
        }
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
                let rankIcon = `<span style="color: #64748B; font-weight: bold;">#${index + 1}</span>`;
                if (index === 0) rankIcon = '<span style="font-size: 1.5rem;">🥇</span>';
                if (index === 1) rankIcon = '<span style="font-size: 1.5rem;">🥈</span>';
                if (index === 2) rankIcon = '<span style="font-size: 1.5rem;">🥉</span>';

                const avatarHtml = user.profile_picture
                    ? `<img src="${user.profile_picture}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #E2E8F0;">`
                    : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(user.name||'U').charAt(0).toUpperCase()}</div>`;

                const bgStyle = index === 0 ? 'background: #FFFBEB; border-color: #FDE68A;' : 'background: #FFFFFF; border-color: #E2E8F0;';

                return `
                <div style="${bgStyle} border-style: solid; border-width: 1px; border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="width: 30px; text-align: center;">${rankIcon}</div>
                    ${avatarHtml}
                    <div style="flex-grow: 1; font-weight: bold; color: #0F172A; font-size: 1.05rem;">${user.name}</div>
                    <div style="font-weight: bold; color: #10B981; font-size: 1.1rem;">⭐ ${user.total_score} Life Points</div>
                </div>`;
            }).join('');
        } catch (e) {
            console.error('Failed to load arcade leaderboard', e);
        }
    }
};

(function hijackTabForArcade() {
    const originalSwitchTab = window.switchTab;
    if (typeof originalSwitchTab === 'function') {
        window.switchTab = function(...args) {
            originalSwitchTab.apply(this, args);
            if (args[0] === 'arcadeTab' && window.V8Arcade) {
                window.V8Arcade.updateTotalXP();
            }
        };
    }
})();
