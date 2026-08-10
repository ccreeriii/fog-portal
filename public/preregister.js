const eventId = window.location.pathname.split('/').pop();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
            const event = await response.json();
            document.getElementById('public-title').innerText = event.name;
            document.getElementById('public-info').innerText = event.additional_info || '';
            
            if (event.poster) {
                const banner = document.getElementById('public-banner');
                banner.src = event.poster;
                banner.classList.remove('hidden');
            }
        } else {
            document.getElementById('public-title').innerText = "Event Not Found";
        }
    } catch (error) {
        console.error("Error loading event:", error);
    }
});

function showSearch() {
    document.getElementById('search-section').classList.remove('hidden');
    document.getElementById('new-user-section').classList.add('hidden');
    document.getElementById('search-results').innerHTML = ''; 
}

function showNewForm() {
    document.getElementById('new-user-section').classList.remove('hidden');
    document.getElementById('search-section').classList.add('hidden');
}

async function searchUser() {
    const query = document.getElementById('search-name').value;
    if (!query) return alert('Please enter a name to search.');

    try {
        const response = await fetch(`/api/youth/search?q=${query}`);
        const users = await response.json();
        
        const resultsDiv = document.getElementById('search-results');
        resultsDiv.innerHTML = ''; 

        if (users.length === 0) {
            resultsDiv.innerHTML = '<p style="color:red; text-align:center;">No records found. Please register as new.</p>';
            return;
        }

        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'search-result';
            // We pass the youth ID, their QR string, and their name to the submission function
            userDiv.innerHTML = `
                <span><strong>${user.name}</strong> (Age: ${user.age})</span>
                <button class="btn" style="background:#27ae60;" onclick="submitPreRegistration(${user.id}, '${user.qr_code}', '${user.name}')">Pre-register Now</button>
            `;
            resultsDiv.appendChild(userDiv);
        });
    } catch (error) {
        console.error("Search error:", error);
    }
}

async function submitPreRegistration(youthId, qrCodeString, youthName) {
    try {
        const response = await fetch('/api/attendance/preregister', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youth_id: youthId, event_id: eventId })
        });

        const result = await response.json();
        
        if (response.ok) {
            showSuccessScreen(qrCodeString, youthName);
        } else {
            alert(result.error || 'You are already pre-registered for this event.');
        }
    } catch (error) {
        console.error("Registration error:", error);
        alert('An error occurred. Please try again.');
    }
}

async function registerNewUser() {
    const name = document.getElementById('new-name').value;
    const age = document.getElementById('new-age').value;
    const mobile = document.getElementById('new-mobile').value;

    if (!name || !age) return alert('Name and Age are required.');

    try {
        const userRes = await fetch('/api/youth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, age, mobile })
        });
        const newUser = await userRes.json();

        if (newUser.id) {
            // New user created, immediately pre-register them
            await submitPreRegistration(newUser.id, newUser.qr_code, newUser.name);
        }
    } catch (error) {
        console.error("Error creating user:", error);
    }
}

function showSuccessScreen(qrCodeString, youthName) {
    // Hide the divider
    document.getElementById('divider').style.display = 'none';

    // Replace the registration section with the QR code and Thank You message
    const regSection = document.getElementById('registration-section');
    
    // Fallback if they don't have a QR code generated in the DB yet
    const qrData = qrCodeString && qrCodeString !== 'null' ? qrCodeString : `FOG-ID-${youthName}`;

    regSection.innerHTML = `
        <div class="success-message">
            <h2>🎉 You are all set, ${youthName}!</h2>
            <p>Your pre-registration was successful. Please take a screenshot of your QR Pass below and present it at the entrance.</p>
            <div id="qrcode"></div>
            <p style="font-size: 12px; color: #888; margin-top: 10px;">ID: ${qrData}</p>
        </div>
    `;

    // Generate the actual visual QR code inside the #qrcode div
    new QRCode(document.getElementById("qrcode"), {
        text: qrData,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
}
