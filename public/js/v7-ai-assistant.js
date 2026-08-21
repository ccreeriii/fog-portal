// ==============================================================================
// FIRE OF GOD (FOG) V8.0 - AI ASSISTANT & KNOWLEDGE BASE
// ==============================================================================

window.V7AIAssistant = {
    init: function() {
        console.log('[V8 Engine] AI Assistant & Knowledge Base Initialized.');
    },

    // ----------------------------------------------------
    // TAB MANAGEMENT
    // ----------------------------------------------------
    switchSubTab: function(tab) {
        document.getElementById('aiSubTabChat').style.display = tab === 'chat' ? 'block' : 'none';
        document.getElementById('aiSubTabTrain').style.display = tab === 'train' ? 'block' : 'none';
        
        document.getElementById('btnAiSubChat').classList.toggle('active', tab === 'chat');
        document.getElementById('btnAiSubTrain').classList.toggle('active', tab === 'train');

        if (tab === 'train') {
            this.loadUnanswered();
            this.loadKnowledge();
        }
    },

    // ----------------------------------------------------
    // CHAT INTERFACE
    // ----------------------------------------------------
    setPrompt: function(text) {
        document.getElementById('aiChatInput').value = text;
    },

    appendMessage: function(text, sender) {
        const box = document.getElementById('aiChatHistory');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg ' + (sender === 'user' ? 'chat-user' : 'chat-ai');
        msgDiv.innerHTML = text; 
        box.appendChild(msgDiv);
        box.scrollTop = box.scrollHeight; 
    },

    sendMessage: async function(e) {
        e.preventDefault();
        
        const inputElem = document.getElementById('aiChatInput');
        const prompt = inputElem.value.trim();
        if (!prompt) return;

        const persona = document.getElementById('aiPersonaSelect').value;
        const isPrivate = document.getElementById('aiPrivateToggle').checked;
        const actor = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'System';

        this.appendMessage(prompt, 'user');
        inputElem.value = '';

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt, persona: persona, is_private: isPrivate, actor: actor })
            });
            if (res.ok) {
                const data = await res.json();
                this.appendMessage(data.response, 'ai');
            } else {
                this.appendMessage("<em>Connection error: Unable to process request.</em>", 'ai');
            }
        } catch(err) {
            this.appendMessage("<em>Network error: Please check your connection.</em>", 'ai');
        }
    },

    // ----------------------------------------------------
    // AI TRAINING & KNOWLEDGE BASE (ADMIN ONLY)
    // ----------------------------------------------------
    loadUnanswered: async function() {
        try {
            const res = await fetch('/api/ai/unanswered');
            const data = await res.json();
            const container = document.getElementById('aiUnansweredList');
            
            if (data.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); font-size: 0.85rem; text-align:center;">No unanswered questions. The AI is fully caught up!</p>`;
                return;
            }

            container.innerHTML = data.map(q => `
                <div style="background:var(--bg-light); border:1px solid #F59E0B; padding:10px; border-radius:8px; margin-bottom:10px;">
                    <div style="font-weight:bold; color:var(--text-main); margin-bottom:5px;">"${q.prompt}"</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px;">Asked by: ${q.asked_by} | ${q.created_at}</div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="V7AIAssistant.resolvePrompt(${q.id}, '${q.prompt.replace(/'/g, "\\'")}')">Teach AI Answer</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger);" onclick="V7AIAssistant.deleteUnanswered(${q.id})">Discard</button>
                    </div>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load unanswered queries', e); }
    },

    resolvePrompt: function(id, prompt) {
        document.getElementById('trainKeywords').value = prompt.toLowerCase();
        document.getElementById('trainResponse').focus();
        // Automatically delete the unanswered query since we are processing it now
        this.deleteUnanswered(id);
    },

    deleteUnanswered: async function(id) {
        await fetch(`/api/ai/unanswered/${id}`, { method: 'DELETE' });
        this.loadUnanswered();
    },

    loadKnowledge: async function() {
        try {
            const res = await fetch('/api/ai/knowledge');
            const data = await res.json();
            const container = document.getElementById('aiKnowledgeList');
            
            if (data.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); font-size: 0.85rem; text-align:center;">No custom knowledge created yet.</p>`;
                return;
            }

            container.innerHTML = data.map(k => `
                <div style="border-bottom:1px solid var(--border-color); padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:var(--primary); font-size: 0.9rem;">Keywords: ${k.keywords}</strong><br>
                        <span style="font-size:0.85rem; color:var(--text-main); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${k.response}</span>
                    </div>
                    <button class="btn btn-danger btn-sm" style="margin-left: 10px;" onclick="V7AIAssistant.deleteKnowledge(${k.id})">🗑️</button>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load knowledge', e); }
    },

    teachAI: async function(e) {
        e.preventDefault();
        const keywords = document.getElementById('trainKeywords').value.toLowerCase();
        const response = document.getElementById('trainResponse').value;
        const actor = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'System';

        if(typeof window.triggerActionConfirmation !== 'undefined') {
            window.triggerActionConfirmation(`Teach the AI this new response?`, async () => {
                await executeTeach();
            });
        } else {
            await executeTeach();
        }

        async function executeTeach() {
            try {
                const res = await fetch('/api/ai/knowledge', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords, response, actor })
                });
                if (res.ok) {
                    document.getElementById('trainAiForm').reset();
                    V7AIAssistant.loadKnowledge();
                }
            } catch(e) { alert("Network Error"); }
        }
    },

    deleteKnowledge: async function(id) {
        if(typeof window.triggerActionConfirmation !== 'undefined') {
            window.triggerActionConfirmation(`Delete this custom knowledge? The AI will no longer know how to answer it.`, async () => {
                await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
                V7AIAssistant.loadKnowledge();
            });
        } else {
            await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
            V7AIAssistant.loadKnowledge();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    V7AIAssistant.init();
});
