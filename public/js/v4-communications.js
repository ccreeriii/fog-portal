// Your unique Public VAPID Key from the backend
const PUBLIC_VAPID_KEY = 'BPjMZjGy5VeLPQXNdkiJvfgeMAzQ0db3Pp_0ulzDv8s222iCcF6A7W0sFMdB1uVgz3QlkH7RMU93AX_epSv4IJY';

// Helper function to convert the VAPID key for the browser
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

window.V4Communications = {
    init: function() {
        // Only load status if user is logged in
        if (currentUser) {
            setTimeout(() => {
                this.updateUIStatus();
            }, 1000);
        }
    },

    updateUIStatus: async function() {
        const btn = document.getElementById('notifToggleBtn');
        const statusTxt = document.getElementById('notifStatusText');
        const subTxt = document.getElementById('notifSubtext');
        const iosWarn = document.getElementById('iosWarning');

        if (!btn || !statusTxt) return;

        // Apple iOS Check
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        
        if (isIos && !isStandalone) {
            statusTxt.innerText = "Status: Unavailable";
            statusTxt.style.color = "var(--danger)";
            subTxt.innerText = "App must be added to Home Screen.";
            btn.style.display = 'none';
            iosWarn.style.display = 'block';
            return;
        }

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            statusTxt.innerText = "Status: Not Supported";
            subTxt.innerText = "Your browser does not support Web Push.";
            btn.disabled = true;
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                statusTxt.innerText = "Status: Enabled";
                statusTxt.style.color = "var(--success)";
                subTxt.innerText = "You are receiving notifications.";
                btn.innerText = "Disable";
                btn.className = "btn btn-outline btn-sm";
                btn.disabled = false;
            } else {
                statusTxt.innerText = "Status: Disabled";
                statusTxt.style.color = "var(--text-main)";
                
                if (Notification.permission === 'denied') {
                    subTxt.innerText = "Blocked in browser settings.";
                    btn.disabled = true;
                    btn.innerText = "Blocked";
                } else {
                    subTxt.innerText = "Click to turn on alerts.";
                    btn.innerText = "Enable";
                    btn.className = "btn btn-primary btn-sm";
                    btn.disabled = false;
                }
            }
        } catch(e) {
            console.error("UI Status check failed", e);
        }
    },

    togglePush: async function() {
        const btn = document.getElementById('notifToggleBtn');
        btn.disabled = true;
        btn.innerText = "Working...";

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // User wants to Disable
                await subscription.unsubscribe();
                await fetch('/api/communications/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser })
                });
                this.updateUIStatus();
            } else {
                // User wants to Enable
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert('Notifications denied. Please enable them in your browser settings.');
                    this.updateUIStatus();
                    return;
                }

                const newSub = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                });

                const res = await fetch('/api/communications/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser, subscription: newSub })
                });

                if (res.ok) {
                    alert('Push notifications enabled successfully!');
                    this.updateUIStatus();
                } else {
                    alert('Failed to save subscription to server.');
                    this.updateUIStatus();
                }
            }
        } catch (err) {
            console.error('Failed to toggle:', err);
            alert('Failed to toggle notifications. Ensure you are using HTTPS.');
            this.updateUIStatus();
        }
    },

    sendBroadcast: async function(e) {
        e.preventDefault();
        const targetSelect = document.getElementById('bcTargetSelect');
        const titleInput = document.getElementById('bcTitle');
        const messageInput = document.getElementById('bcMessage');
        
        if(!targetSelect || !titleInput || !messageInput) return;

        const target = targetSelect.value;
        const title = titleInput.value;
        const message = messageInput.value;

        window.triggerActionConfirmation(`Send this live push notification broadcast to: ${target}?`, async () => {
            try {
                const res = await fetch('/api/communications/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, title, message, actor: currentUser })
                });
                
                const data = await res.json();
                if(data.success) {
                    alert(`Broadcast sent successfully! Delivered to ${data.sentCount} devices.`);
                    document.getElementById('broadcastForm').reset();
                    V4Communications.loadHistory();
                } else {
                    alert('Failed: ' + (data.error || 'Unknown error'));
                }
            } catch(err) {
                alert('Network error sending broadcast.');
            }
        });
    },

    loadHistory: async function() {
        const container = document.getElementById('broadcastHistoryContainer');
        if(!container) return;
        try {
            const res = await fetch('/api/communications/history');
            const data = await res.json();
            if(data.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No broadcasts sent yet.</p>';
                return;
            }
            container.innerHTML = data.map(b => `
                <div style="padding:15px; border-bottom:1px solid var(--border-color);">
                    <strong style="color:var(--text-main); font-size:1.05rem;">${b.title}</strong>
                    <span class="badge badge-blue" style="float:right;">${b.target}</span>
                    <p style="font-size:0.9rem; color:var(--text-muted); margin:8px 0;">${b.message}</p>
                    <small style="color:var(--text-muted);">Sent by ${b.sender} on ${b.created_at}</small>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load history'); }
    },

    loadInbox: async function() {
        const container = document.getElementById('inboxContainer');
        if(!container) return;
        try {
            const res = await fetch(`/api/communications/inbox?username=${encodeURIComponent(currentUser)}`);
            const data = await res.json();
            if(data.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding:40px 20px;"><p style="color:var(--text-muted);">You have no new messages.</p></div>';
                return;
            }
            container.innerHTML = data.map(b => `
                <div style="padding:15px; border-bottom:1px solid var(--border-color); background: #FFF; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <strong style="color:var(--primary); font-size:1.05rem;">${b.title}</strong>
                    <p style="font-size:0.9rem; color:var(--text-main); margin:8px 0;">${b.message}</p>
                    <small style="color:var(--text-muted);">📅 ${b.created_at}</small>
                </div>
            `).join('');
        } catch(e) { console.error('Failed to load inbox'); }
    }
};

// Hook into app.js tab switching to load data automatically when tabs are clicked
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if(originalSwitchTab) originalSwitchTab(tabId);
    if(tabId === 'profileTab') window.V4Communications.updateUIStatus();
    if(tabId === 'communicationsAdminTab') window.V4Communications.loadHistory();
    if(tabId === 'inboxTab') window.V4Communications.loadInbox();
};

document.addEventListener('DOMContentLoaded', () => {
    window.V4Communications.init();
});
