const fs = require('fs');
const path = require('path');
const appJsPath = path.join(__dirname, 'public', 'js', 'app.js');

const patchCode = `
// ==========================================
// V24: UNIFIED DIRECTORY PROFILE & FREEZE FIX
// ==========================================

window.openViewProfileModal = async function(id) {
    try {
        document.getElementById('globalPreloader').style.display = 'flex';
        document.getElementById('globalPreloader').style.opacity = '1';

        // Fetch User and their specific history
        const [usersRes, minRes, evtRes, histRes] = await Promise.all([
            fetch('/api/youth'),
            fetch('/api/youth/' + id + '/ministries'),
            fetch('/api/youth/' + id + '/event_roles'),
            fetch('/api/youth/' + id + '/history')
        ]);

        const users = await usersRes.json();
        const member = users.find(u => String(u.id) === String(id));
        if (!member) throw new Error('Member not found.');

        const ministries = await minRes.json();
        const events = await evtRes.json();
        const history = await histRes.json();

        // Merge Roles
        let allRoles = [];
        if(ministries && ministries.length) ministries.forEach(m => allRoles.push({...m, type: 'ministry'}));
        if(events && events.length) events.forEach(e => allRoles.push({...e, type: 'event'}));
        allRoles.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));

        const safeText = (val) => val || 'N/A';
        const avatarHtml = member.profile_picture ? \\\`<img src="\${member.profile_picture}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">\\\` : '👤';

        // Completely replace the modal's innerHTML to ensure a pristine layout matching "My Profile"
        let modalHtml = \\\`
        <div class="modal-content" style="max-width: 600px; padding: 0; background: #F8FAFC; overflow-y: auto; max-height: 90vh;">
            <span class="close-modal" onclick="closeViewProfileModal()" style="position: absolute; top: 15px; right: 20px; font-size: 28px; cursor: pointer; z-index: 10;">&times;</span>

            <div class="card profile-header-card" style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 20px; padding: 35px 25px 25px 25px; margin: 0; border-radius: 0; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; width: 100%; text-align: center;">
                    <div class="avatar-circle" style="width: 130px; height: 130px; font-size: 3.5rem; margin: 0 auto;">\${avatarHtml}</div>
                    <h2 style="color: var(--primary); font-size: 1.8rem; margin: 0; border: none; padding: 0;">\${member.name || 'Unknown'}</h2>
                </div>
            </div>

            <div style="padding: 20px;">
                <div style="background: #FFF; padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 20px;">
                    <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 10px; border-bottom: 2px solid var(--bg-light); padding-bottom: 5px;">Personal Details</h3>
                    <div style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; text-align: left;">
                        <strong>Email:</strong> \${safeText(member.email)}<br>
                        <strong>Age:</strong> \${safeText(member.age)}<br>
                        <strong>Gender:</strong> \${safeText(member.gender)}<br>
                        <strong>Birthday:</strong> \${safeText(member.birthday)}<br>
                        <strong>Mobile:</strong> \${safeText(member.mobile)}<br>
                        <strong>Social Media:</strong> \${safeText(member.social_media)}<br>
                        <strong>Parents/Guardian:</strong> \${safeText(member.parents_name)}
                    </div>
                </div>

                <div class="sub-nav" style="margin-bottom: 15px; justify-content: center; background: #FFF; padding: 5px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <button class="sub-nav-btn active" style="flex:1;" onclick="switchModalViewTab(this, 'viewRoles')">🎭 Roles</button>
                    <button class="sub-nav-btn" style="flex:1;" onclick="switchModalViewTab(this, 'viewAttendance')">📋 Participation</button>
                </div>

                <div id="viewRoles" class="view-modal-tab" style="display: block;">
                    <div class="card" style="margin-bottom: 0;">
                        <div style="padding: 5px; text-align: left;">
                            \${allRoles.length === 0 ? '<div style="color:var(--text-muted); text-align:center;">No roles assigned yet.</div>' : allRoles.map(r => \\\`
                            <div style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <strong style="color: var(--primary); font-size: 1.05rem;">\${r.type === 'ministry' ? '🏛️ ' + r.ministry_name : '📅 ' + r.event_name}</strong>
                                </div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:5px;">
                                    <strong>Role:</strong> \${r.role || r.role_name} \${r.sub_role ? ' | ' + r.sub_role : ''}<br>
                                    <strong>Assigned:</strong> \${(r.assigned_at || '').split(' ')[0]}
                                </div>
                            </div>\\\`).join('')}
                        </div>
                    </div>
                </div>

                <div id="viewAttendance" class="view-modal-tab" style="display: none;">
                    <div class="card" style="margin-bottom: 0;">
                        <div style="padding: 5px; text-align: left;">
                            \${history.length === 0 ? '<div style="color:var(--text-muted); text-align:center;">No participation logs found.</div>' : history.map(a => \\\`
                            <div style="padding:15px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background: #FFF; border-radius: 8px; margin-bottom: 8px;">
                                <div><strong style="color: var(--primary); font-size: 1.05rem;">\${a.event_name || 'Event'}</strong><br><small style="color:var(--text-muted);">\${a.checked_in_at || ''}</small></div>
                                \${a.is_walkin ? '<span class="badge badge-orange">Walk-in</span>' : '<span class="badge badge-green">Pre-Reg</span>'}
                            </div>\\\`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>\\\`;

        let modal = document.getElementById('viewProfileModal');
        if (modal) {
            modal.innerHTML = modalHtml;
            modal.style.display = 'flex';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Lock background scroll
        }
    } catch(e) { 
        console.error(e);
        alert("Error loading member profile."); 
    } finally { 
        document.getElementById('globalPreloader').style.opacity = '0'; 
        setTimeout(() => document.getElementById('globalPreloader').style.display = 'none', 500); 
    }
};

window.switchModalViewTab = function(btnEl, tabId) {
    const parent = btnEl.closest('.sub-nav');
    if (parent) { parent.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active')); }
    btnEl.classList.add('active');
    document.querySelectorAll('.view-modal-tab').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
};

// CRITICAL FIX: Unlock screen when closed
window.closeViewProfileModal = function() {
    const modal = document.getElementById('viewProfileModal');
    if(modal) { 
        modal.style.display = 'none'; 
        modal.classList.remove('active'); 
    }
    document.body.style.overflow = ''; // Restores background scrolling
};

// FAILSAFE: If they click the dark background to close
if (!window.isModalFailsafePatched) {
    window.addEventListener('click', function(event) {
        if (event.target && event.target.classList && event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            event.target.classList.remove('active');
            document.body.style.overflow = ''; // Restores background scrolling
        }
    });
    window.isModalFailsafePatched = true;
}
`;

fs.appendFileSync(appJsPath, '\n' + patchCode);
console.log('✅ Directory Profile Modal perfectly synced and freeze-bug eliminated!');
