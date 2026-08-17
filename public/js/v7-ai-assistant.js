// ==============================================================================
// FIRE OF GOD (FOG) V7.0 - ADVANCED AI MINISTRY ASSISTANT
// ==============================================================================

window.V7AIAssistant = {
    init: function() {
        console.log('[V7 Engine] AI Ministry Assistant Initialized.');
    },

    setPrompt: function(text) {
        document.getElementById('aiChatInput').value = text;
    },

    appendMessage: function(text, sender) {
        const box = document.getElementById('aiChatHistory');
        const msgDiv = document.createElement('div');
        
        // Apply the CSS classes defined in index.html
        msgDiv.className = 'chat-msg ' + (sender === 'user' ? 'chat-user' : 'chat-ai');
        msgDiv.innerHTML = text; // Allow HTML to format line breaks and bullets
        
        box.appendChild(msgDiv);
        box.scrollTop = box.scrollHeight; // Auto-scroll to bottom
    },

    sendMessage: async function(e) {
        e.preventDefault();
        
        const inputElem = document.getElementById('aiChatInput');
        const prompt = inputElem.value.trim();
        if (!prompt) return;

        // Capture Persona and Privacy Toggle
        const persona = document.getElementById('aiPersonaSelect').value;
        const isPrivate = document.getElementById('aiPrivateToggle').checked;
        
        // Identify the user making the request (using global variable from app.js)
        const actor = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'System';

        // 1. Display User Message & Clear Input
        this.appendMessage(prompt, 'user');
        inputElem.value = '';

        // 2. Transmit to Backend
        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    persona: persona, 
                    is_private: isPrivate, 
                    actor: actor 
                })
            });
            
            if (res.ok) {
                const data = await res.json();
                this.appendMessage(data.response, 'ai');
            } else {
                this.appendMessage("<em>Connection error: Unable to process request at this time.</em>", 'ai');
            }
        } catch(err) {
            console.error("AI Assistant Fetch Error:", err);
            this.appendMessage("<em>Network error: Please check your internet connection.</em>", 'ai');
        }
    }
};

// Initialize the V7 Module when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    V7AIAssistant.init();
});
