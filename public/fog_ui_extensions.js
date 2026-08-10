
// 1. Navigation Highlighting
setInterval(() => {
    const visible = document.querySelector('.section:not(.hidden)');
    if (visible) {
        document.querySelectorAll('nav button, .bottom-nav button, .sidebar button').forEach(btn => {
            const action = btn.getAttribute('onclick') || '';
            if (action.includes(visible.id)) {
                btn.style.backgroundColor = '#e2e8f0';
                btn.style.color = '#0f172a';
                btn.style.fontWeight = '800';
                btn.style.borderRadius = '8px';
            } else {
                btn.style.backgroundColor = 'transparent';
                btn.style.color = '#7f8c8d';
                btn.style.fontWeight = 'normal';
            }
        });
    }
}, 300);

// 2. Events Tabs (Published vs Create)
setInterval(() => {
    const eventsSec = document.getElementById('events');
    if (eventsSec && !eventsSec.classList.contains('hidden')) {
        if (!document.getElementById('fog-event-tabs')) {
            const formEl = eventsSec.querySelector('form');
            const listEl = eventsSec.querySelector('.grid') || document.getElementById('eventsList') || document.getElementById('upcomingEvents');
            
            if (formEl && listEl) {
                const formCard = formEl.closest('.card') || formEl;
                const listCard = listEl.closest('.card') || listEl;

                const tabs = document.createElement('div');
                tabs.id = 'fog-event-tabs';
                tabs.style.cssText = 'display:flex; gap:10px; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;';

                const btnPub = document.createElement('button');
                btnPub.innerText = '📅 Published Gatherings';
                btnPub.style.cssText = 'padding:10px 15px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:#27ae60; color:white; flex:1; font-size:14px;';

                const btnCreate = document.createElement('button');
                btnCreate.innerText = '➕ Create New Gathering';
                btnCreate.style.cssText = 'padding:10px 15px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:#f1f5f9; color:#64748b; flex:1; font-size:14px;';

                tabs.appendChild(btnPub);
                tabs.appendChild(btnCreate);

                const h2 = eventsSec.querySelector('h2');
                if (h2) h2.after(tabs);
                else eventsSec.prepend(tabs);

                // Default State
                formCard.style.display = 'none';
                listCard.style.display = 'block';

                btnPub.onclick = (e) => {
                    e.preventDefault();
                    btnPub.style.background = '#27ae60'; btnPub.style.color = 'white';
                    btnCreate.style.background = '#f1f5f9'; btnCreate.style.color = '#64748b';
                    listCard.style.display = 'block';
                    formCard.style.display = 'none';
                };

                btnCreate.onclick = (e) => {
                    e.preventDefault();
                    btnCreate.style.background = '#27ae60'; btnCreate.style.color = 'white';
                    btnPub.style.background = '#f1f5f9'; btnPub.style.color = '#64748b';
                    formCard.style.display = 'block';
                    listCard.style.display = 'none';
                };
            }
        }
    }
}, 300);
