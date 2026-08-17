// ========== public/js/v9-growth-games.js ==========
// FIRE OF GOD MINISTRIES - V9 BRAIN GAMES (GROWTH XP)

window.V9GrowthGames = {
    // --------------------------------------------------------------------------
    // SHARED UI MANAGERS
    // --------------------------------------------------------------------------
    _activeTimer: null,
    
    mountGameUI: function(htmlContent) {
        document.getElementById('growthGamesGrid').style.display = 'none';
        const area = document.getElementById('growthActiveGameArea');
        area.style.display = 'block';
        area.innerHTML = htmlContent;
    },

    exitGame: function() {
        if (this._activeTimer) clearInterval(this._activeTimer);
        document.getElementById('growthActiveGameArea').style.display = 'none';
        document.getElementById('growthActiveGameArea').innerHTML = '';
        document.getElementById('growthGamesGrid').style.display = 'grid';
    },

    // --------------------------------------------------------------------------
    // GAME 1: CATECHISM CLASH (60-Second Sprint)
    // --------------------------------------------------------------------------
    ccState: {
        questions: [],
        currentIndex: 0,
        score: 0,
        timeLeft: 60,
        questionStartTime: 0
    },

    mountCatechismClash: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) {
            return alert("You must be logged in to play Brain Games!");
        }

        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V9GrowthGames.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 1rem;">
                    ⏱️ <span id="ccTimerDisplay" style="color: #EF4444;">60s</span>
                </div>
            </div>
            <div id="ccGameBody" style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 300px;">
                <h2 style="color: #059669; font-size: 1.8rem; margin-bottom: 10px; border: none;">Catechism Clash</h2>
                <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 20px;">
                    You have 60 seconds to answer as many biblical questions as possible. 
                    <br><br><strong>+10 XP</strong> per correct answer.<br><strong>+15 XP (Speed Bonus)</strong> if answered under 3 seconds!
                </p>
                <button class="btn btn-primary" style="background: #059669; width: 100%; max-width: 250px; font-size: 1.1rem; padding: 15px;" onclick="V9GrowthGames.startCatechismClash()">▶ START SPRINT</button>
            </div>
        `);
    },

    startCatechismClash: async function() {
        try {
            const res = await fetch('/api/growth-games/trivia');
            const data = await res.json();
            
            if (!data || data.length === 0) {
                document.getElementById('ccGameBody').innerHTML = `<p style="color:var(--text-muted);">No trivia questions available right now.</p>`;
                return;
            }

            this.ccState.questions = data;
            this.ccState.currentIndex = 0;
            this.ccState.score = 0;
            this.ccState.timeLeft = 60;

            this._activeTimer = setInterval(() => {
                this.ccState.timeLeft--;
                const timerEl = document.getElementById('ccTimerDisplay');
                if (timerEl) timerEl.innerText = `${this.ccState.timeLeft}s`;

                if (this.ccState.timeLeft <= 0) {
                    this.endCatechismClash("TIME'S UP!");
                }
            }, 1000);

            this.renderTriviaQuestion();

        } catch (e) {
            alert("Network error starting game.");
        }
    },

    renderTriviaQuestion: function() {
        if (this.ccState.currentIndex >= this.ccState.questions.length) {
            return this.endCatechismClash("ALL QUESTIONS ANSWERED!");
        }

        const q = this.ccState.questions[this.ccState.currentIndex];
        let options = [];
        try { options = JSON.parse(q.options); } catch(e) { options = ["A", "B", "C", "D"]; }

        this.ccState.questionStartTime = Date.now();

        let html = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold;">
                <span class="badge badge-green">Score: ${this.ccState.score} XP</span>
                <span style="color: #64748B; font-size: 0.85rem;">Q: ${this.ccState.currentIndex + 1} / ${this.ccState.questions.length}</span>
            </div>
            <h3 style="font-size: 1.2rem; color: #0F172A; margin-bottom: 25px; line-height: 1.4;">${q.question}</h3>
            <div style="display: flex; flex-direction: column; gap: 12px;">
        `;

        options.forEach((opt, idx) => {
            html += `
                <button id="ccOpt_${idx}" class="btn btn-outline" style="text-align: left; padding: 15px; font-size: 1rem; border-color: #CBD5E1; color: #334155; transition: 0.2s;" onclick="V9GrowthGames.answerTrivia(${idx}, ${q.correct_index})">
                    ${opt}
                </button>
            `;
        });

        html += `</div>`;
        document.getElementById('ccGameBody').innerHTML = html;
    },

    answerTrivia: function(selectedIndex, correctIndex) {
        const timeTaken = Date.now() - this.ccState.questionStartTime;
        const isCorrect = (selectedIndex === correctIndex);
        
        for(let i=0; i<4; i++) {
            const btn = document.getElementById(`ccOpt_${i}`);
            if(btn) btn.disabled = true;
        }

        const selectedBtn = document.getElementById(`ccOpt_${selectedIndex}`);
        const correctBtn = document.getElementById(`ccOpt_${correctIndex}`);

        if (isCorrect) {
            const pointsEarned = (timeTaken < 3000) ? 15 : 10;
            this.ccState.score += pointsEarned;
            
            selectedBtn.style.background = '#10B981';
            selectedBtn.style.color = '#FFF';
            selectedBtn.style.borderColor = '#10B981';
            selectedBtn.innerHTML += ` <span style="float:right; font-weight:bold;">+${pointsEarned} XP</span>`;
        } else {
            selectedBtn.style.background = '#EF4444';
            selectedBtn.style.color = '#FFF';
            selectedBtn.style.borderColor = '#EF4444';
            
            if (correctBtn) {
                correctBtn.style.background = '#10B981';
                correctBtn.style.color = '#FFF';
            }
        }

        setTimeout(() => {
            this.ccState.currentIndex++;
            this.renderTriviaQuestion();
        }, 1200);
    },

    endCatechismClash: async function(reasonTitle) {
        if (this._activeTimer) clearInterval(this._activeTimer);

        const body = document.getElementById('ccGameBody');
        body.innerHTML = `
            <h2 style="color: #0F172A; font-size: 1.8rem; margin-bottom: 5px; border:none;">${reasonTitle}</h2>
            <p style="color: #64748B; font-size: 1rem; margin-bottom: 20px;">Sprint Finished.</p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
                <div style="font-size: 0.9rem; color: #64748B; font-weight: bold; text-transform: uppercase;">Total Earned</div>
                <div style="font-size: 2.5rem; color: #059669; font-weight: 800;">${this.ccState.score} <span style="font-size:1.2rem;">Growth XP</span></div>
            </div>
            <p id="ccSubmitStatus" style="color: #F59E0B; font-weight: bold; margin-bottom: 15px;">Saving your score...</p>
            <button id="ccExitBtn" class="btn btn-primary" style="background: #059669; width: 100%; display: none;" onclick="V9GrowthGames.exitGame()">Claim & Exit to Arcade</button>
        `;

        if (this.ccState.score > 0 && currentMember && currentMember.id) {
            try {
                const res = await fetch('/api/growth-games/trivia/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        youth_id: currentMember.id,
                        score: this.ccState.score,
                        actor: typeof currentUser !== 'undefined' ? currentUser : 'System'
                    })
                });

                if (res.ok) {
                    document.getElementById('ccSubmitStatus').innerText = "Score saved successfully!";
                    document.getElementById('ccSubmitStatus').style.color = "#10B981";
                    document.getElementById('ccExitBtn').style.display = "block";
                    if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                } else {
                    document.getElementById('ccSubmitStatus').innerText = "Failed to save score.";
                    document.getElementById('ccSubmitStatus').style.color = "#EF4444";
                    document.getElementById('ccExitBtn').style.display = "block";
                }
            } catch (e) {
                document.getElementById('ccSubmitStatus').innerText = "Network Error.";
                document.getElementById('ccExitBtn').style.display = "block";
            }
        } else {
            document.getElementById('ccSubmitStatus').innerText = "No points to save.";
            document.getElementById('ccSubmitStatus').style.color = "#64748B";
            document.getElementById('ccExitBtn').style.display = "block";
        }
    },

    // --------------------------------------------------------------------------
    // GAME 2: WOULD YOU RATHER (Daily Habit Poll)
    // --------------------------------------------------------------------------
    mountWouldYouRather: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in!");

        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V9GrowthGames.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">⚖️ Daily Poll</div>
            </div>
            <div id="pollGameBody" style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 250px;">
                <p style="color:var(--text-muted);">Loading today's poll...</p>
            </div>
        `);

        try {
            const res = await fetch(`/api/growth-games/poll?youth_id=${currentMember.id}`);
            const data = await res.json();

            if (!data.poll) {
                document.getElementById('pollGameBody').innerHTML = `<p style="color:var(--text-muted);">No active polls today. Check back tomorrow!</p>`;
                return;
            }

            if (data.voted) this.renderPollResults(data.poll);
            else this.renderPollVoting(data.poll);
        } catch (e) {
            document.getElementById('pollGameBody').innerHTML = `<p style="color:var(--danger);">Error loading poll.</p>`;
        }
    },

    renderPollVoting: function(poll) {
        const body = document.getElementById('pollGameBody');
        body.innerHTML = `
            <div style="margin-bottom: 25px;">
                <span class="badge" style="background: #F3E8FF; color: #DB2777; font-size: 0.8rem; margin-bottom: 10px;">+5 Growth XP for voting!</span>
                <h3 style="font-size: 1.4rem; color: #0F172A; margin-bottom: 10px;">${poll.question}</h3>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <button class="btn btn-outline" style="padding: 20px 15px; font-size: 1.05rem; border-color: #8B5CF6; color: #6D28D9; background: rgba(139,92,246,0.05); font-weight: bold; white-space: normal; line-height: 1.4; height: auto;" onclick="V9GrowthGames.submitPollVote(${poll.id}, 'a')">${poll.option_a}</button>
                <div style="color: #94A3B8; font-weight: 800; font-size: 0.9rem;">OR</div>
                <button class="btn btn-outline" style="padding: 20px 15px; font-size: 1.05rem; border-color: #0ea5e9; color: #1d4ed8; background: rgba(14,165,233,0.05); font-weight: bold; white-space: normal; line-height: 1.4; height: auto;" onclick="V9GrowthGames.submitPollVote(${poll.id}, 'b')">${poll.option_b}</button>
            </div>
        `;
    },

    submitPollVote: async function(pollId, choice) {
        if (!currentMember || !currentMember.id) return;
        try {
            const res = await fetch('/api/growth-games/poll/vote', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youth_id: currentMember.id, poll_id: pollId, choice: choice, actor: typeof currentUser !== 'undefined' ? currentUser : 'System' })
            });
            const data = await res.json();
            if (data.success && data.poll) {
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                this.renderPollResults(data.poll, true);
            } else alert(data.error || "Failed to submit vote.");
        } catch (e) { alert("Network Error during voting."); }
    },

    renderPollResults: function(poll, justVoted = false) {
        const body = document.getElementById('pollGameBody');
        const totalVotes = poll.votes_a + poll.votes_b;
        let pctA = 50, pctB = 50;
        
        if (totalVotes > 0) {
            pctA = Math.round((poll.votes_a / totalVotes) * 100);
            pctB = 100 - pctA; 
        }

        let successBanner = justVoted 
            ? `<div style="background: #D1FAE5; color: #059669; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-weight: bold;">🎉 Vote locked! +5 Growth XP Earned!</div>` 
            : `<div style="background: #F3F4F6; color: #4B5563; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; font-size: 0.85rem;">You have already voted on today's poll.</div>`;

        body.innerHTML = `
            ${successBanner}
            <h3 style="font-size: 1.2rem; color: #0F172A; margin-bottom: 25px;">${poll.question}</h3>
            
            <div style="text-align: left; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; color: #4B5563; font-size: 0.9rem;">
                    <span>${poll.option_a}</span><span style="color: #8B5CF6;">${pctA}%</span>
                </div>
                <div style="width: 100%; background: #E2E8F0; border-radius: 20px; height: 16px; overflow: hidden;">
                    <div style="width: ${pctA}%; background: #8B5CF6; height: 100%; transition: width 1s ease-out;"></div>
                </div>
            </div>

            <div style="text-align: left; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; color: #4B5563; font-size: 0.9rem;">
                    <span>${poll.option_b}</span><span style="color: #0ea5e9;">${pctB}%</span>
                </div>
                <div style="width: 100%; background: #E2E8F0; border-radius: 20px; height: 16px; overflow: hidden;">
                    <div style="width: ${pctB}%; background: #0ea5e9; height: 100%; transition: width 1s ease-out;"></div>
                </div>
            </div>
            <p style="color: #94A3B8; font-size: 0.85rem;">Total Community Votes: ${totalVotes}</p>
        `;
    },

    // --------------------------------------------------------------------------
    // GAME 3: WHO AM I? (Progressive Clues)
    // --------------------------------------------------------------------------
    waiState: {
        question: null,
        cluesRevealed: 1,
        maxPoints: 15
    },

    mountWhoAmI: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in!");

        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V9GrowthGames.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">🕵️‍♂️ Who Am I?</div>
            </div>
            <div id="waiGameBody" style="background: #FFF; padding: 30px 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; min-height: 250px;">
                <p style="color:var(--text-muted);">Fetching mystery figure...</p>
            </div>
        `);

        try {
            const res = await fetch('/api/growth-games/whoami');
            const data = await res.json();
            if (!data) {
                document.getElementById('waiGameBody').innerHTML = `<p style="color:var(--text-muted);">No mystery figures available.</p>`;
                return;
            }
            this.waiState.question = data;
            this.waiState.cluesRevealed = 1;
            this.waiState.maxPoints = 15;
            this.renderWaiUI();
        } catch(e) {
            document.getElementById('waiGameBody').innerHTML = `<p style="color:var(--danger);">Error connecting.</p>`;
        }
    },

    renderWaiUI: function() {
        const q = this.waiState.question;
        const pts = this.waiState.maxPoints;

        let cluesHtml = `<div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: left;">
            <strong style="color: #D97706;">Clue 1:</strong> <span style="color: #4B5563;">${q.clue1}</span>
        </div>`;

        if (this.waiState.cluesRevealed >= 2) {
            cluesHtml += `<div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 15px; border-radius: 8px; margin-bottom: 10px; text-align: left;">
                <strong style="color: #D97706;">Clue 2:</strong> <span style="color: #4B5563;">${q.clue2}</span>
            </div>`;
        }
        if (this.waiState.cluesRevealed >= 3) {
            cluesHtml += `<div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <strong style="color: #D97706;">Clue 3:</strong> <span style="color: #4B5563;">${q.clue3}</span>
            </div>`;
        }

        const moreCluesBtn = this.waiState.cluesRevealed < 3 
            ? `<button class="btn btn-secondary btn-sm" style="width: 100%; margin-bottom: 20px;" onclick="V9GrowthGames.revealWaiClue()">Need another clue? (Drops reward to ${pts - 5} XP)</button>`
            : '';

        document.getElementById('waiGameBody').innerHTML = `
            <div style="margin-bottom: 20px;">
                <span class="badge badge-orange" style="font-size: 0.9rem;">Potential Reward: +${pts} Growth XP</span>
            </div>
            ${cluesHtml}
            ${moreCluesBtn}
            
            <div class="form-group" style="text-align: left; margin-top: 20px;">
                <label>Who am I?</label>
                <input type="text" id="waiGuessInput" class="form-control" placeholder="Type your guess here...">
            </div>
            <button class="btn btn-primary" style="background: #F59E0B; width: 100%;" onclick="V9GrowthGames.submitWaiGuess()">Submit Guess</button>
            <p id="waiStatus" style="margin-top: 15px; font-weight: bold;"></p>
        `;
    },

    revealWaiClue: function() {
        if (this.waiState.cluesRevealed < 3) {
            this.waiState.cluesRevealed++;
            this.waiState.maxPoints -= 5;
            this.renderWaiUI();
        }
    },

    submitWaiGuess: async function() {
        const guess = document.getElementById('waiGuessInput').value.trim();
        if (!guess) return alert('Please enter a guess!');

        const isCorrect = guess.toLowerCase() === this.waiState.question.answer.toLowerCase();
        
        try {
            const res = await fetch('/api/growth-games/whoami/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    youth_id: currentMember.id,
                    question_id: this.waiState.question.id,
                    clues_used: this.waiState.cluesRevealed,
                    is_correct: isCorrect,
                    actor: typeof currentUser !== 'undefined' ? currentUser : 'System'
                })
            });

            const data = await res.json();
            const statusEl = document.getElementById('waiStatus');

            if (data.error) {
                statusEl.style.color = '#EF4444';
                statusEl.innerText = data.error;
            } else if (isCorrect) {
                statusEl.style.color = '#10B981';
                statusEl.innerText = `🎉 Correct! It was ${this.waiState.question.answer}. +${data.pointsAwarded} Growth XP!`;
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                document.getElementById('waiGuessInput').disabled = true;
            } else {
                statusEl.style.color = '#EF4444';
                statusEl.innerText = `❌ Incorrect. The answer was ${this.waiState.question.answer}. Better luck next time!`;
                document.getElementById('waiGuessInput').disabled = true;
            }
        } catch(e) {
            document.getElementById('waiStatus').innerText = "Network Error.";
        }
    },

    // --------------------------------------------------------------------------
    // GAME 4: CELL GROUP CLASH (Leaderboard)
    // --------------------------------------------------------------------------
    mountGroupClash: async function() {
        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V9GrowthGames.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">⚔️ Cell Group Clash</div>
            </div>
            <div style="background: #FFF; padding: 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; min-height: 300px;">
                <h3 style="color: #DC2626; margin-bottom: 5px; text-align: center;">Small Group Leaderboard</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-bottom: 20px;">Every XP you earn from arcade games, checking in, and trivia helps your cell group climb the ranks!</p>
                <div id="cgcLeaderboardContainer" style="text-align: center;">
                    <p style="color:var(--text-muted);">Loading ranks...</p>
                </div>
            </div>
        `);

        try {
            const res = await fetch('/api/gamification/group-leaderboard');
            const data = await res.json();
            const container = document.getElementById('cgcLeaderboardContainer');

            if (data.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted);">No small groups have earned points yet.</p>`;
                return;
            }

            container.innerHTML = data.map((grp, idx) => {
                let rankIcon = `<strong style="color: #64748B;">#${idx + 1}</strong>`;
                if (idx === 0) rankIcon = '🥇';
                if (idx === 1) rankIcon = '🥈';
                if (idx === 2) rankIcon = '🥉';

                return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #E2E8F0; background: ${idx === 0 ? '#FEF2F2' : '#FFF'};">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="font-size: 1.2rem; width: 30px;">${rankIcon}</div>
                        <div style="text-align: left;">
                            <strong style="color: #0F172A; font-size: 1.05rem;">${grp.name}</strong><br>
                            <span style="font-size: 0.75rem; color: #64748B;">👥 ${grp.member_count} active members</span>
                        </div>
                    </div>
                    <div style="font-weight: 800; color: #DC2626; font-size: 1.1rem;">
                        ⭐ ${grp.total_points}
                    </div>
                </div>`;
            }).join('');
        } catch(e) {
            document.getElementById('cgcLeaderboardContainer').innerHTML = `<p style="color:var(--danger);">Error loading leaderboard.</p>`;
        }
    },

    // --------------------------------------------------------------------------
    // GAME 5: VERSE CHAIN (Cooperative Word Grid)
    // --------------------------------------------------------------------------
    vcState: {
        verse: null,
        contributions: [],
        groupId: null
    },

    mountVerseChain: async function() {
        if (typeof currentMember === 'undefined' || !currentMember || !currentMember.id) return alert("You must be logged in!");

        this.mountGameUI(`
            <div style="padding: 15px; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; border: 1px solid #E2E8F0; border-radius: 12px 12px 0 0;">
                <button class="btn btn-outline btn-sm" onclick="V9GrowthGames.exitGame()">🔙 Exit</button>
                <div style="color: #0F172A; font-weight: bold; font-size: 0.9rem;">🔗 Verse Chain</div>
            </div>
            <div id="vcGameBody" style="background: #FFF; padding: 20px; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; min-height: 250px;">
                <p style="color:var(--text-muted); text-align:center;">Loading group data...</p>
            </div>
        `);

        try {
            // First, prompt user to select their group if we don't have it cached
            const res = await fetch('/api/small-groups');
            const groups = await res.json();
            
            if (groups.length === 0) {
                document.getElementById('vcGameBody').innerHTML = `<p style="color:var(--text-muted); text-align:center;">There are no small groups available to play Verse Chain.</p>`;
                return;
            }

            document.getElementById('vcGameBody').innerHTML = `
                <h3 style="color: #2563EB; text-align: center; margin-bottom: 15px;">Select Your Small Group</h3>
                <p style="font-size: 0.85rem; color: #64748B; text-align: center; margin-bottom: 20px;">Verse Chain is a cooperative puzzle. You solve the blanks together with your group!</p>
                <select id="vcGroupSelect" class="form-control" style="margin-bottom: 15px;">
                    <option value="">-- Choose Your Group --</option>
                    ${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
                </select>
                <button class="btn btn-primary" style="width: 100%; background: #2563EB;" onclick="V9GrowthGames.loadVerseForGroup()">Access Puzzle</button>
            `;
        } catch(e) {
            document.getElementById('vcGameBody').innerHTML = `<p style="color:var(--danger); text-align:center;">Error connecting.</p>`;
        }
    },

    loadVerseForGroup: async function() {
        const select = document.getElementById('vcGroupSelect');
        const groupId = select.value;
        if (!groupId) return alert("Please select your group to proceed.");

        this.vcState.groupId = groupId;

        try {
            const res = await fetch(`/api/growth-games/verse-chain?group_id=${groupId}`);
            const data = await res.json();

            if (!data.verse) {
                document.getElementById('vcGameBody').innerHTML = `<p style="color:var(--text-muted); text-align:center;">No active verse chains this week.</p>`;
                return;
            }

            this.vcState.verse = data.verse;
            this.vcState.contributions = data.contributions;
            this.renderVersePuzzle();
        } catch(e) {
            alert('Error loading the puzzle.');
        }
    },

    renderVersePuzzle: function() {
        let text = this.vcState.verse.verse_text;
        let missingWords = [];
        try { missingWords = JSON.parse(this.vcState.verse.missing_words); } catch(e) {}

        let parts = text.split('___');
        let finalHtml = `<h3 style="color: #2563EB; text-align: center; margin-bottom: 20px;">${this.vcState.verse.reference}</h3>`;
        finalHtml += `<div style="line-height: 2.2; font-size: 1.1rem; color: #0F172A; text-align: center; background: #F8FAFC; padding: 20px; border-radius: 12px; border: 1px dashed #CBD5E1;">`;

        for (let i = 0; i < parts.length; i++) {
            finalHtml += parts[i];
            
            if (i < parts.length - 1) { // Where the '___' was
                const contrib = this.vcState.contributions.find(c => c.word_index === i);
                
                if (contrib) {
                    // Solved by a group member
                    finalHtml += `<span class="badge badge-green" style="font-size: 0.95rem; margin: 0 5px;" title="Solved by Member ID ${contrib.youth_id}">${contrib.guessed_word} ✓</span>`;
                } else {
                    // Still Unsolved - Render Input
                    finalHtml += `
                        <div style="display: inline-flex; align-items: center; margin: 0 5px; vertical-align: middle;">
                            <input type="text" id="vcInput_${i}" style="width: 80px; padding: 4px; border: 1px solid #94A3B8; border-radius: 4px 0 0 4px; font-size: 0.9rem; outline: none; text-align: center;">
                            <button style="background: #2563EB; color: #FFF; border: none; padding: 5px 8px; border-radius: 0 4px 4px 0; cursor: pointer; font-weight: bold; font-size: 0.8rem;" onclick="V9GrowthGames.submitVerseWord(${i}, '${missingWords[i]}')">Solve</button>
                        </div>
                    `;
                }
            }
        }
        finalHtml += `</div>`;
        finalHtml += `<p style="font-size: 0.8rem; color: #64748B; text-align: center; margin-top: 15px;">Work with your group! Correct words lock in <strong style="color:#10B981;">+10 Growth XP</strong> for you.</p>`;

        document.getElementById('vcGameBody').innerHTML = finalHtml;
    },

    submitVerseWord: async function(wordIndex, correctWord) {
        const inputElem = document.getElementById(`vcInput_${wordIndex}`);
        const guess = inputElem.value.trim();

        if (!guess) return alert("Enter a word first!");

        // Remove punctuation and case for fair checking
        const cleanGuess = guess.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanCorrect = correctWord.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (cleanGuess !== cleanCorrect) {
            inputElem.style.borderColor = '#EF4444';
            inputElem.style.color = '#EF4444';
            setTimeout(() => { inputElem.style.borderColor = '#94A3B8'; inputElem.style.color = '#000'; }, 1000);
            return;
        }

        try {
            const res = await fetch('/api/growth-games/verse-chain/submit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    youth_id: currentMember.id,
                    group_id: this.vcState.groupId,
                    verse_id: this.vcState.verse.id,
                    word_index: wordIndex,
                    guessed_word: correctWord, // Submit the beautifully formatted correct word
                    actor: typeof currentUser !== 'undefined' ? currentUser : 'System'
                })
            });

            const data = await res.json();
            if (data.success) {
                alert(`Correct! You solved a link in the chain! +${data.pointsAwarded} Growth XP!`);
                if (typeof window.V6Gamification !== 'undefined') window.V6Gamification.loadMyPoints();
                // Reload the puzzle to show the locked-in green badge
                this.loadVerseForGroup(); 
            } else {
                alert(data.error || "Failed to submit. Maybe someone in your group just solved it!");
                this.loadVerseForGroup(); // Reload to sync with group progress
            }
        } catch(e) {
            alert("Network error.");
        }
    }
};
