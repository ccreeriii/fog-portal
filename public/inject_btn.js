document.addEventListener('DOMContentLoaded', () => {
    setInterval(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        document.querySelectorAll('.event-card, div').forEach(card => {
            const text = card.innerText || '';
            const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch && dateMatch[1] >= todayStr) {
                const btn = card.querySelector('button');
                if (btn && (btn.innerText.includes('Details') || btn.innerText.includes('Analytics')) && !card.querySelector('.fog-prereg-btn')) {
                    const onclickText = btn.getAttribute('onclick') || '';
                    const idMatch = onclickText.match(/['"]?(\d+)['"]?/);
                    if (idMatch) {
                        const eventId = idMatch[1];
                        const regLink = document.createElement('a');
                        regLink.href = '/register.html?eventId=' + eventId;
                        regLink.target = '_blank';
                        regLink.className = 'fog-prereg-btn';
                        regLink.innerText = '📋 Pre-Registration Form';
                        regLink.style.cssText = 'background: #27ae60; color: white; text-decoration: none; padding: 8px 12px; border-radius: 5px; margin-left: 8px; font-weight: bold; font-size: 13px; display: inline-block; vertical-align: middle;';
                        btn.after(regLink);
                    }
                }
            }
        });
    }, 1000);
});
